import Phaser from "phaser";
import type { Point } from "../../config/types";
import { findPath, type NavGrid } from "../../domain/pathfinding";
import type { NearbyTarget } from "../bridge/events";
import type { Station } from "../entities/Station";
import type { ZonePortal } from "../entities/ZonePortal";
import type { InteractionTarget } from "./InteractionSystem";
import { PathFollower } from "./PathFollower";

/** Margen alrededor de una señal o un portal para que cuente un dedo algo desviado. */
const HIT_PAD = 14;
/** El portal es un blanco que se busca desde lejos y su cartel es delgado: su zona sensible es más generosa. */
const PORTAL_PAD = 36;
/** Con el dedo arrastrado, el destino se recalcula como mucho cada tanto y solo si se movió lo suficiente. */
const DRAG_REPLAN_MS = 140;
const DRAG_MIN_MOVE = 12;
/** Radio del marcador en el mundo y colores (los del portal, para que se lean como parte del mismo juego). */
const MARKER_RADIUS = 18;
const MARKER_DEPTH = 1800;
const COLOR_STROKE = 0x7a4a34; // marrón de la interfaz: se lee sobre el césped claro y sobre el camino
const COLOR_FILL = 0xf5c542;

export interface TapNavigationDeps {
  grid: NavGrid;
  targets: readonly InteractionTarget[];
  stations: ReadonlyMap<string, Station>;
  portals: readonly ZonePortal[];
  /** Posición de los pies de Vanessa. */
  position: () => Point;
  /** Objetivo a su alcance ahora mismo (el mismo cálculo que el aviso de proximidad). */
  nearest: (feet: Point) => NearbyTarget | null;
  requestInteract: () => void;
  /** `false` mientras hay una ventana abierta, una solicitud pendiente o la escena está detenida. */
  enabled: () => boolean;
  reducedMotion: boolean;
}

const keyOf = (t: NearbyTarget) => `${t.kind}:${t.id}`;

/**
 * Tocar o hacer clic para caminar (SPEC 6.1). Un toque (o un clic del ratón) en el mapa lleva a Vanessa hasta ese punto
 * rodeando los obstáculos, con un círculo animado en el destino; un toque sobre una estación o un portal que ya está a su alcance los abre (el equivalente
 * a «Explorar»), y si aún no lo está camina hasta su punto de interacción. Arrastrar el dedo (o mantener el botón del ratón) reorienta el destino. No mueve
 * nada por su cuenta: entrega un vector al mismo ciclo de movimiento que usan las flechas, y cualquier flecha lo cancela.
 */
export class TapNavigation {
  private readonly follower = new PathFollower();
  private readonly marker: TapMarker;
  private pointerDown = false;
  private lastPlan: { at: number; point: Point } = { at: 0, point: { x: -1e9, y: -1e9 } };
  private goal: { point: Point; stop: number } | null = null;
  private replans = 0;
  private readonly onDown: (p: Phaser.Input.Pointer) => void;
  private readonly onMove: (p: Phaser.Input.Pointer) => void;
  private readonly onUp: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly deps: TapNavigationDeps) {
    this.marker = new TapMarker(scene, deps.reducedMotion);
    this.onDown = (p) => {
      if (!this.accepts(p)) return;
      this.pointerDown = true;
      this.tap(p.worldX, p.worldY);
    };
    this.onMove = (p) => {
      if (!this.pointerDown || !p.isDown || !this.deps.enabled()) return;
      const now = this.scene.time.now;
      const point = { x: p.worldX, y: p.worldY };
      if (now - this.lastPlan.at < DRAG_REPLAN_MS || Math.hypot(point.x - this.lastPlan.point.x, point.y - this.lastPlan.point.y) < DRAG_MIN_MOVE) return;
      this.walkTo(point, 0, false);
    };
    this.onUp = () => {
      this.pointerDown = false;
    };
    scene.input.mouse?.disableContextMenu(); // el clic derecho también camina: sin el menú del navegador
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp);
  }

  /**
   * Táctil y lápiz siempre. Con el ratón (escritorio) se camina con un clic, como en los juegos de ratón: vale el botón
   * izquierdo y el derecho (el menú del navegador no se abre sobre el mapa); el botón central no hace nada.
   */
  private accepts(p: Phaser.Input.Pointer): boolean {
    if (!this.deps.enabled()) return false;
    if (p.wasTouch || (p.event as PointerEvent | undefined)?.pointerType === "pen") return true;
    return p.button === 0 || p.button === 2;
  }

  private hit(x: number, y: number): { target: NearbyTarget; point: Point; radius: number } | null {
    for (const t of this.deps.targets) {
      const inside =
        t.target.kind === "learning"
          ? !!this.deps.stations.get(t.target.id)?.contains(x, y, HIT_PAD) || Math.hypot(x - t.x, y - t.y) <= HIT_PAD * 1.5
          : this.deps.portals.some((p) => p.portalId === t.target.id && p.contains(x, y, PORTAL_PAD));
      if (inside) return { target: t.target, point: { x: t.x, y: t.y }, radius: t.radius };
    }
    return null;
  }

  private tap(x: number, y: number): void {
    const feet = this.deps.position();
    const hit = this.hit(x, y);
    if (hit) {
      const near = this.deps.nearest(feet);
      if (near && keyOf(near) === keyOf(hit.target)) {
        // Ya está junto a ella: tocarla equivale a «Explorar».
        this.cancel();
        this.marker.ripple(hit.point.x, hit.point.y);
        this.deps.requestInteract();
        return;
      }
      this.walkTo(hit.point, hit.radius * 0.6, true);
      return;
    }
    this.walkTo({ x, y }, 0, true);
  }

  private walkTo(point: Point, stop: number, ripple: boolean): void {
    const found = findPath(this.deps.grid, this.deps.position(), point);
    this.lastPlan = { at: this.scene.time.now, point };
    if (ripple) this.marker.ripple(point.x, point.y);
    if (!found || found.waypoints.length === 0) {
      this.cancelPath();
      return;
    }
    const destination = found.waypoints[found.waypoints.length - 1];
    this.goal = { point, stop };
    this.replans = 0;
    this.follower.set(found.waypoints, stop);
    this.marker.show(destination.x, destination.y);
  }

  /** Dirección de este fotograma, o (0, 0) si no hay recorrido. */
  vector(feet: Point, deltaMs: number, speed: number): { x: number; y: number } {
    if (!this.follower.active) {
      if (this.follower.isStuck && this.goal && this.replans < 2) {
        // Un obstáculo que la rejilla no previó: se recalcula desde donde está, un par de veces como máximo.
        this.replans++;
        const found = findPath(this.deps.grid, feet, this.goal.point);
        if (found && found.waypoints.length) this.follower.set(found.waypoints, this.goal.stop);
      } else if (this.marker.visible) {
        this.marker.hide();
        this.goal = null;
      }
      if (!this.follower.active) return { x: 0, y: 0 };
    }
    const v = this.follower.vector(feet, deltaMs, speed);
    if (!this.follower.active && !this.follower.isStuck) {
      this.marker.arrive();
      this.goal = null;
    }
    return v;
  }

  get walking(): boolean {
    return this.follower.active;
  }

  /** Detiene el recorrido y quita el marcador (flechas, ventana abierta, solicitud, cambio de zona). */
  cancel(): void {
    this.pointerDown = false;
    this.cancelPath();
  }

  private cancelPath(): void {
    this.follower.clear();
    this.goal = null;
    this.marker.hide();
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp);
    this.marker.destroy();
  }
}

/**
 * Círculo del destino: un anillo que late mientras Vanessa camina hacia él y una onda que sale en el instante del toque.
 * Con movimiento reducido no late ni hay onda: el anillo aparece quieto y desaparece al llegar.
 */
class TapMarker {
  private readonly ring: Phaser.GameObjects.Arc;
  private pulse?: Phaser.Tweens.Tween;
  private readonly ripples = new Set<Phaser.GameObjects.Arc>();

  constructor(private readonly scene: Phaser.Scene, private readonly reduced: boolean) {
    this.ring = scene.add.circle(0, 0, MARKER_RADIUS, COLOR_FILL, 0.55).setStrokeStyle(4, COLOR_STROKE, 0.95).setDepth(MARKER_DEPTH).setVisible(false);
  }

  get visible(): boolean {
    return this.ring.visible;
  }

  show(x: number, y: number): void {
    this.pulse?.stop();
    this.scene.tweens.killTweensOf(this.ring);
    this.ring.setPosition(x, y).setScale(1).setAlpha(1).setVisible(true);
    if (!this.reduced) {
      this.pulse = this.scene.tweens.add({ targets: this.ring, scale: 1.3, alpha: 0.55, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  /** Onda que se expande y se desvanece donde se tocó. */
  ripple(x: number, y: number): void {
    if (this.reduced) return;
    const wave = this.scene.add.circle(x, y, MARKER_RADIUS, COLOR_FILL, 0).setStrokeStyle(4, COLOR_STROKE, 0.95).setDepth(MARKER_DEPTH).setScale(0.3);
    this.ripples.add(wave);
    this.scene.tweens.add({
      targets: wave, scale: 1.9, alpha: 0, duration: 520, ease: "Cubic.easeOut",
      onComplete: () => {
        this.ripples.delete(wave);
        wave.destroy();
      },
    });
  }

  /** Al llegar: el anillo se desvanece (o desaparece al instante con movimiento reducido). */
  arrive(): void {
    this.pulse?.stop();
    this.pulse = undefined;
    if (this.reduced || !this.ring.visible) return this.hide();
    this.scene.tweens.add({ targets: this.ring, alpha: 0, scale: 0.6, duration: 220, onComplete: () => this.ring.setVisible(false) });
  }

  hide(): void {
    this.pulse?.stop();
    this.pulse = undefined;
    this.scene.tweens.killTweensOf(this.ring);
    this.ring.setVisible(false);
  }

  destroy(): void {
    this.pulse?.stop();
    this.scene.tweens.killTweensOf(this.ring);
    this.ripples.forEach((r) => {
      this.scene.tweens.killTweensOf(r);
      r.destroy();
    });
    this.ripples.clear();
    this.ring.destroy();
  }
}
