import Phaser from "phaser";
import type { StationState } from "../../domain/progression";
import type { AssetEntry, LabelZone, Placement, Point } from "../../config/types";
import type { AssetRegistry } from "../../config/assetRegistry";
import { createNextStationGlow, createStationSparkles, createXpStar, type Sparkles } from "../systems/stationEffects";
import { uiFont } from "../fonts";
import { REF_SIGN_SCALE } from "../systems/worldScale";

/** El aro mide esta fracción del ancho del letrero; la estrella de XP, su escala respecto del factor de la señal. */
const GLOW_WIDTH = 0.85;
const XP_SCALE = 0.06;
const SPARKLE_SCALE = 0.08; // los destellos, respecto del factor de la señal

export interface StationAssets {
  sign: string;
  glow?: string;
  lockIcon?: string;
  doneIcon?: string;
  /**
   * Identidad de la estación sobre el letrero (SPEC 4.3): su título corto y los textos de estado. Con un letrero que trae
   * `labelZones` (número y título) el número va en el círculo, el título en la placa y el estado debajo; sin ellos,
   * solo el número centrado, como antes.
   */
  identity?: { assets: AssetRegistry; title: string; completedLabel: string; nextLabel: string; completedBadge?: string };
  /** Efectos animados (SPEC 4.3): el aro de la próxima estación y la estrella de XP al completarla. */
  effects?: { assets: AssetRegistry; nextGlow?: string; xpStar?: string; sparkle?: string };
}

/**
 * Ajusta un texto a su zona: la letra más grande (hasta `max`) con la que cabe en `maxLines` líneas, con saltos entre
 * palabras; si ni a `min` cabe, se acorta con «…».
 */
function fitText(text: Phaser.GameObjects.Text, full: string, maxW: number, maxH: number, max: number, min: number): void {
  const fits = () => text.width <= maxW + 0.5 && text.height <= maxH + 0.5;
  for (let size = Math.round(max); size >= Math.max(6, Math.round(min)); size--) {
    text.setFontSize(size).setWordWrapWidth(maxW, true).setText(full);
    if (fits()) return;
  }
  const words = full.split(/\s+/);
  while (words.length > 1 && !fits()) {
    words.pop();
    text.setText(`${words.join(" ")}…`);
  }
}

/** Los destellos rodean la señal: más anchos que ella y desde el suelo hasta la placa. */
function createNextSparkles(scene: Phaser.Scene, fx: NonNullable<StationAssets["effects"]>, x: number, y: number, w: number, h: number, depth: number, k: number, reducedMotion: boolean): Sparkles | null {
  return createStationSparkles(scene, fx.assets, fx.sparkle as string, x, y - h * 0.42, w * 0.62, h * 0.55, depth + 4, SPARKLE_SCALE * k, reducedMotion);
}

/**
 * Una estación del recorrido: la señal con su número y su título, y el estado debajo («Siguiente», «Completado» o el
 * candado). Es la única clase de estación; no hay una por aprendizaje. El punto de interacción es la posición de la señal
 * más su desplazamiento, así que moverla en `placements` mueve también la interacción.
 */
export class Station {
  readonly interaction: Point & { radius: number };
  private readonly sign: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly title?: Phaser.GameObjects.Text;
  private readonly completed: Phaser.GameObjects.GameObject[] = [];
  private readonly next: Phaser.GameObjects.GameObject[] = [];
  private readonly glow?: Phaser.GameObjects.Image;
  private glowFx?: Phaser.GameObjects.Sprite | null;
  private sparkles?: Sparkles | null;
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
  /** Posición del estado bajo el letrero y de la estrella de XP sobre el círculo del número. */
  private readonly starAt: Point;
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

    const signEntry: AssetEntry | undefined = assets.identity?.assets.has(assets.sign) ? assets.identity.assets.get(assets.sign) : undefined;
    const origin = signEntry?.origin ?? { x: 0.5, y: 1 };
    this.sign = scene.add.image(x, y, assets.sign).setOrigin(origin.x, origin.y).setScale(signScale).setDepth(depth);
    const w = this.sign.displayWidth;
    const h = this.sign.displayHeight;
    // Píxeles de la textura del letrero → mundo (la imagen se coloca por su origen en la base del poste).
    const texW = this.sign.width;
    const texH = this.sign.height;
    const at = (px: number, py: number): Point => ({ x: x + (px - origin.x * texW) * signScale, y: y + (py - origin.y * texH) * signScale });
    const zone = (z: LabelZone): { c: Point; w: number; h: number } => ({ c: at(z.x + z.width / 2, z.y + z.height / 2), w: z.width * signScale, h: z.height * signScale });

    const zones = signEntry?.labelZones;
    const id = assets.identity;
    this.starAt = { x, y: y - h * 0.9 };

    // El aro animado de «próxima estación» sustituye al brillo estático; si su hoja no carga, vale el brillo de siempre.
    if (assets.effects?.nextGlow) {
      this.glowFx = createNextStationGlow(scene, assets.effects.assets, assets.effects.nextGlow, x, y + 4 * k, depth - 1, GLOW_WIDTH * w, reducedMotion);
      this.glowFx?.setVisible(false);
      // Destellos dorados alrededor del brillo y de la señal, mientras es la próxima estación.
      if (assets.effects.sparkle) {
        this.sparkles = createNextSparkles(scene, assets.effects, x, y, w, h, depth, k, reducedMotion);
        this.sparkles?.setVisible(false);
      }
    }
    if (assets.glow && !this.glowFx) {
      this.glow = scene.add.image(x, y - 6 * k, assets.glow).setScale(0.55 * k).setDepth(depth - 1).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      if (!reducedMotion) {
        scene.tweens.add({ targets: this.glow, scaleX: 0.62 * k, scaleY: 0.62 * k, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }

    if (id && zones?.number && zones.title) {
      const n = zone(zones.number);
      const t = zone(zones.title);
      this.label = scene.add
        .text(n.c.x, n.c.y, String(number), { fontFamily: uiFont(), fontStyle: "bold", fontSize: `${Math.round((zones.number.fontSize ?? 44) * signScale)}px`, color: zones.number.color ?? "#4b2b18" })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(depth + 1);
      this.title = scene.add
        .text(t.c.x, t.c.y, id.title, { fontFamily: uiFont(), fontStyle: "bold", color: zones.title.color ?? "#4b2b18", align: "center" })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(depth + 1);
      fitText(this.title, id.title, t.w, t.h, (zones.title.fontSize ?? 26) * signScale, 8);
      this.starAt = { x: n.c.x, y: n.c.y - n.h * 0.5 - 10 * k };

      // El estado va bajo la placa, centrado en el ancla «completed» del letrero.
      const a = signEntry?.attachments?.completed;
      const c = a ? at(a.x, a.y) : { x, y: y - h * 0.1 };
      const aw = (a?.width ?? 230) * signScale;
      const ah = (a?.height ?? 72) * signScale;
      const badge = id.completedBadge && id.assets.has(id.completedBadge) && scene.textures.exists(id.completedBadge) ? id.assets.get(id.completedBadge) : undefined;
      const labelZone = badge?.labelZones?.label;
      if (id.completedBadge && badge && labelZone) {
        const img = scene.add.image(c.x, c.y, id.completedBadge).setDisplaySize(aw, ah).setDepth(depth + 2);
        const sx = aw / (badge.width ?? 256);
        const text = scene.add
          .text(c.x - aw / 2 + (labelZone.x + labelZone.width / 2) * sx, c.y - ah / 2 + (labelZone.y + labelZone.height / 2) * sx, id.completedLabel, { fontFamily: uiFont(), fontStyle: "bold", color: labelZone.color ?? "#184c2a", align: "center" })
          .setOrigin(0.5)
          .setResolution(2)
          .setDepth(depth + 3);
        fitText(text, id.completedLabel, labelZone.width * sx, labelZone.height * sx, (labelZone.fontSize ?? 24) * sx, 7);
        this.completed.push(img, text);
      }
      // «Siguiente»: una píldora verde en el mismo sitio, para la estación a la que toca ir.
      const pw = aw * 0.72;
      const ph = ah * 0.62;
      const pill = scene.add.graphics().setDepth(depth + 2);
      pill
        .fillStyle(0x2f8f4a, 1)
        .fillRoundedRect(c.x - pw / 2, c.y - ph / 2, pw, ph, ph / 2)
        .lineStyle(Math.max(1.5, 2.2 * signScale * 2), 0x184c2a, 1)
        .strokeRoundedRect(c.x - pw / 2, c.y - ph / 2, pw, ph, ph / 2)
        .fillStyle(0xffffff, 0.18)
        .fillRoundedRect(c.x - pw / 2 + ph * 0.3, c.y - ph / 2 + ph * 0.12, pw - ph * 0.6, ph * 0.28, ph * 0.14);
      const nt = scene.add.text(c.x, c.y, id.nextLabel, { fontFamily: uiFont(), fontStyle: "bold", color: "#ffffff", align: "center" }).setOrigin(0.5).setResolution(2).setDepth(depth + 3);
      fitText(nt, id.nextLabel, pw - ph * 0.6, ph * 0.8, ph * 0.62, 7);
      this.next.push(pill, nt);
      [...this.completed, ...this.next].forEach((o) => (o as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject).setVisible(false));
      if (assets.lockIcon && scene.textures.exists(assets.lockIcon)) {
        const lockH = scene.textures.getFrame(assets.lockIcon).height;
        this.lock = scene.add.image(c.x, c.y, assets.lockIcon).setScale((ah * 0.95) / lockH).setDepth(depth + 2).setVisible(false); // cabe en el alto del estado
      }
    } else {
      this.label = scene.add
        .text(x, y - h * 0.36, String(number), { fontFamily: uiFont(), fontStyle: "bold", fontSize: `${Math.round(30 * k)}px`, color: "#502010" })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(depth + 1);
      if (assets.lockIcon) this.lock = scene.add.image(x, y - h * 0.74, assets.lockIcon).setScale(0.032 * k).setDepth(depth + 1).setVisible(false);
    }
    if (assets.doneIcon) this.done = scene.add.image(this.starAt.x + this.sign.displayWidth * 0.0, this.starAt.y, assets.doneIcon).setScale(0.2 * k).setDepth(depth + 1).setVisible(false);
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
    this.star = createXpStar(this.scene, fx.assets, fx.xpStar, this.starAt.x, this.starAt.y, this.base.y + 5000, XP_SCALE * this.k, this.reducedMotion, entrance);
  }

  /** Solo pinta; la decisión de desbloqueo es del dominio (SPEC 11.1). */
  setState(state: StationState): void {
    if (state === this.state) return;
    const previous = this.state;
    this.state = state;
    this.sign.setTint(state === "locked" ? 0xb8b8b8 : 0xffffff);
    [this.label, this.title].forEach((o) => o?.setAlpha(state === "locked" ? 0.55 : 1));
    this.lock?.setVisible(state === "locked");
    this.completed.forEach((o) => (o as Phaser.GameObjects.Image).setVisible(state === "completed"));
    this.next.forEach((o) => (o as Phaser.GameObjects.Image).setVisible(state === "available"));
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
    this.sparkles?.setVisible(state === "available");
  }

  /** Identifica un aprendizaje activo sin aprobar (modo final) con una etiqueta; `null` la quita. */
  setPending(label: string | null): void {
    if (label === null) return void this.pendingTag?.setVisible(false);
    this.pendingTag ??= this.scene.add
      .text(this.base.x, this.base.y - this.sign.displayHeight - 3, label, { fontFamily: uiFont(), fontStyle: "bold", fontSize: `${Math.round(13 * this.k)}px`, color: "#fff7e9", backgroundColor: "#7a4a34", padding: { x: Math.round(6 * this.k), y: Math.round(2 * this.k) } })
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
    this.sparkles?.destroy();
    this.star?.destroy();
    [this.sign, this.label, this.title, ...this.completed, ...this.next, this.glow, this.lock, this.done, this.pendingTag].forEach((o) => o?.destroy());
  }
}
