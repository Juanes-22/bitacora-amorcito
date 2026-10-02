import Phaser from "phaser";
import type { StationState } from "../../domain/progression";
import type { Placement, Point } from "../../config/types";
import type { AssetRegistry } from "../../config/assetRegistry";
import { createNextStationGlow, createXpStar } from "../systems/stationEffects";
import { REF_SIGN_SCALE } from "../systems/worldScale";

/** Escalas de los efectos de las estaciones respecto del factor de la señal (se ajustaron a la vista sobre el mapa). */
const GLOW_SCALE = 0.3;
const XP_SCALE = 0.09;

export interface StationAssets {
  sign: string;
  glow?: string;
  lockIcon?: string;
  doneIcon?: string;
  /** Efectos animados (SPEC 4.3): el aro de la próxima estación y la estrella de XP al completarla. */
  effects?: { assets: AssetRegistry; nextGlow?: string; xpStar?: string };
}

/**
 * Una estación del recorrido: la señal, su número (derivado de `route`) y un marcador de estado.
 * Es la única clase de estación; no hay una por aprendizaje. El punto de interacción es la posición de
 * la señal más su desplazamiento, así que moverla en `placements` mueve también la interacción.
 */
export class Station {
  readonly interaction: Point & { radius: number };
  private readonly sign: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly glow?: Phaser.GameObjects.Image;
  private glowFx?: Phaser.GameObjects.Sprite | null;
  private star?: Phaser.GameObjects.Sprite | null;
  private readonly lock?: Phaser.GameObjects.Image;
  private readonly done?: Phaser.GameObjects.Image;
  private state: StationState | null = null;
  private pendingTag?: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private readonly base: Point;
  private readonly k: number;
  private readonly effects?: StationAssets["effects"];
  private readonly reducedMotion: boolean;
  /** Se completó en esta sesión y la estrella entrará con la celebración (mientras tanto no se ve la estática). */
  private waitingForCelebration = false;

  constructor(
    scene: Phaser.Scene,
    readonly learningId: string,
    readonly number: number,
    placement: Placement,
    assets: StationAssets,
    /** `gameplay.signScale`: escala de la señal en el mundo. */
    signScale: number,
    reducedMotion: boolean,
  ) {
    const k = signScale / REF_SIGN_SCALE; // los textos e iconos crecen con la señal
    const { x, y } = placement.position;
    this.scene = scene;
    this.effects = assets.effects;
    this.reducedMotion = reducedMotion;
    this.base = { x, y };
    this.k = k;
    this.interaction = {
      x: x + placement.interactionOffset.x,
      y: y + placement.interactionOffset.y,
      radius: placement.interactionRadius,
    };
    const depth = y;

    // El aro animado de «próxima estación» sustituye al brillo estático; si su hoja no carga, vale el brillo de siempre.
    if (assets.effects?.nextGlow) {
      this.glowFx = createNextStationGlow(scene, assets.effects.assets, assets.effects.nextGlow, x, y + 14 * k, depth - 1, GLOW_SCALE * k, reducedMotion);
      this.glowFx?.setVisible(false);
    }
    if (assets.glow && !this.glowFx) {
      this.glow = scene.add.image(x, y - 6 * k, assets.glow).setScale(0.55 * k).setDepth(depth - 1).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      if (!reducedMotion) {
        scene.tweens.add({ targets: this.glow, scaleX: 0.62 * k, scaleY: 0.62 * k, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
    this.sign = scene.add.image(x, y, assets.sign).setOrigin(0.5, 1).setScale(signScale).setDepth(depth);
    const h = this.sign.displayHeight;
    this.label = scene.add
      .text(x, y - h * 0.36, String(number), { fontFamily: '"Trebuchet MS", system-ui, sans-serif', fontStyle: "bold", fontSize: `${Math.round(30 * k)}px`, color: "#502010" })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(depth + 1);
    if (assets.lockIcon) this.lock = scene.add.image(x, y - h * 0.74, assets.lockIcon).setScale(0.032 * k).setDepth(depth + 1).setVisible(false);
    if (assets.doneIcon) this.done = scene.add.image(x + this.sign.displayWidth * 0.36, y - h * 0.9, assets.doneIcon).setScale(0.2 * k).setDepth(depth + 1).setVisible(false);
  }

  /**
   * La estrella de XP entra sobre la señal al completar la estación (la dispara la celebración, nunca al cargar) y se queda
   * animada. Si la estación no está completada o ya la tiene, no hace nada.
   */
  playXpReward(): void {
    if (this.state !== "completed" || this.star) return;
    this.waitingForCelebration = false;
    this.showStar(true);
    this.done?.setVisible(!this.hasAnimatedStar());
  }

  private hasAnimatedStar(): boolean {
    return !!this.star || this.waitingForCelebration;
  }

  private showStar(entrance: boolean): void {
    const fx = this.effects;
    if (!fx?.xpStar) return;
    this.star = createXpStar(this.scene, fx.assets, fx.xpStar, this.base.x, this.base.y - this.sign.displayHeight * 1.1, this.base.y + 5000, XP_SCALE * this.k, this.reducedMotion, entrance);
  }

  /** Solo pinta; la decisión de desbloqueo es del dominio (SPEC 11.1). */
  setState(state: StationState): void {
    if (state === this.state) return;
    const previous = this.state;
    this.state = state;
    this.sign.setTint(state === "locked" ? 0xb8b8b8 : 0xffffff);
    this.label.setAlpha(state === "locked" ? 0.55 : 1);
    this.lock?.setVisible(state === "locked");
    if (state !== "completed") {
      this.star?.destroy();
      this.star = undefined;
      this.waitingForCelebration = false;
    } else if (!this.star && previous === null) {
      this.showStar(false); // partida cargada con la estación ya completada: titila desde el principio, sin entrada
    } else if (!this.star && this.effects?.xpStar && this.scene.textures.exists(this.effects.xpStar)) {
      this.waitingForCelebration = true; // recién completada: la estrella entrará cuando se cierre la recompensa
    }
    // La estrella de XP animada sustituye a la estática en cuanto está (o va a estar) en pantalla; sin ella, o si su hoja no cargó, la de siempre.
    this.done?.setVisible(state === "completed" && !this.hasAnimatedStar());
    this.glow?.setAlpha(state === "available" ? 0.85 : 0);
    this.glowFx?.setVisible(state === "available");
  }

  /** Identifica un aprendizaje activo sin aprobar (modo final) con una etiqueta; `null` la quita. */
  setPending(label: string | null): void {
    if (label === null) return void this.pendingTag?.setVisible(false);
    this.pendingTag ??= this.scene.add
      .text(this.base.x, this.base.y - this.sign.displayHeight - 3, label, { fontFamily: '"Trebuchet MS", system-ui, sans-serif', fontStyle: "bold", fontSize: `${Math.round(13 * this.k)}px`, color: "#fff7e9", backgroundColor: "#7a4a34", padding: { x: Math.round(6 * this.k), y: Math.round(2 * this.k) } })
      .setOrigin(0.5, 1) // encima de la señal: debajo se queda Vanessa al interactuar y taparía la etiqueta
      .setResolution(2)
      .setDepth(this.base.y + 2);
    this.pendingTag.setText(label).setVisible(true);
  }

  /** ¿Cae el punto del mundo sobre la señal (con un margen para dedos gruesos)? Lo usa el toque para explorar. */
  contains(x: number, y: number, pad = 0): boolean {
    const b = this.sign.getBounds();
    return x >= b.x - pad && x <= b.right + pad && y >= b.y - pad && y <= b.bottom + pad;
  }

  get currentState(): StationState | null {
    return this.state;
  }

  destroy(): void {
    this.glowFx?.destroy();
    this.star?.destroy();
    [this.sign, this.label, this.glow, this.lock, this.done, this.pendingTag].forEach((o) => o?.destroy());
  }
}
