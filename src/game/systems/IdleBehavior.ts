import Phaser from "phaser";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { AssetEntry, IdleAnimation, IdleConfig } from "../../config/types";
import type { Direction } from "../bridge/events";
import { IdleTimeline, type Facing, type IdleAction, type IdleState } from "./IdleTimeline";

/** La dirección del juego en la del kit: «down» es de frente y «up» de espaldas. */
const KIT_DIRECTION: Record<Direction, NonNullable<IdleAnimation["direction"]>> = { down: "front", up: "back", left: "left", right: "right" };

interface Slot {
  assetId: string;
  entry: AssetEntry;
}

/**
 * Reposo animado de Vanessa y Jerry (SPEC 6.2). Aplica al sprite lo que dicta `IdleTimeline`: respiración y parpadeo en
 * bucle al detenerse, una mirada a los pocos segundos y un juego después, cada uno una sola vez. Las hojas son atlas con
 * los pies alineados en un lienzo lógico, así que basta fijar el origen de cada hoja y conservar la escala del caminar.
 * Con movimiento reducido se muestra el primer fotograma del reposo, sin bucle ni gestos. Si una hoja no cargó, no está
 * disponible y Player conserva la pose quieta de la hoja de caminar.
 */
export class IdleBehavior {
  readonly available: boolean;
  private readonly timeline: IdleTimeline;
  private readonly slots: { rest: Slot; glance: Slot; play: Slot; tricks?: Slot; fetch?: Slot };
  private readonly holdMs: number;
  /** Qué toca la próxima vez que el visitante pide jugar con Jerry: se turnan la búsqueda del peluche y los trucos. */
  private actionIndex = 0;
  private holdTimer?: Phaser.Time.TimerEvent;
  private lastKey = "";
  private direction: Direction = "down";
  private onComplete?: (animation: Phaser.Animations.Animation) => void;
  private onFrame?: (animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sprite: Phaser.GameObjects.Sprite,
    config: IdleConfig,
    assets: AssetRegistry,
    private readonly reducedMotion: boolean,
    /** Escala del personaje al caminar (`gameplay.player.scale`): las hojas se muestran a esa escala, corregida si traen `frameAdjust`. */
    private readonly baseScale: number,
  ) {
    const slot = (id: string): Slot => ({ assetId: id, entry: assets.get(id) });
    this.slots = {
      rest: slot(config.rest),
      glance: slot(config.glance),
      play: slot(config.play),
      ...(config.tricks ? { tricks: slot(config.tricks.sheet) } : {}),
      ...(config.fetch ? { fetch: slot(config.fetch.sheet) } : {}),
    };
    this.holdMs = config.fetch?.holdMs ?? 0;
    // Con movimiento reducido no hay gestos solos: los umbrales infinitos dejan a la máquina siempre en reposo.
    // La búsqueda del peluche la pide el visitante, así que sigue disponible (como una pose fija).
    this.timeline = new IdleTimeline(
      reducedMotion
        ? { glanceAfterMs: Infinity, playAfterMs: Infinity, gestureCooldownMs: 0 }
        : { glanceAfterMs: config.glanceAfterMs, playAfterMs: config.playAfterMs, gestureCooldownMs: config.gestureCooldownMs },
    );
    // Si falta la hoja de un gesto opcional, ese gesto no existe; si falta cualquiera de las tres básicas, no hay reposo animado.
    const basic = [this.slots.rest, this.slots.glance, this.slots.play];
    this.available = basic.every((s) => scene.textures.exists(s.assetId));
    if (this.slots.tricks && !scene.textures.exists(this.slots.tricks.assetId)) this.slots.tricks = undefined;
    if (this.slots.fetch && !scene.textures.exists(this.slots.fetch.assetId)) this.slots.fetch = undefined;
    if (this.available) for (const s of Object.values(this.slots)) if (s) this.createAnimations(s);
  }

  private createAnimations({ assetId, entry }: Slot): void {
    for (const a of entry.animations ?? []) {
      if (this.scene.anims.exists(a.key)) continue;
      this.scene.anims.create({
        key: a.key,
        frames: a.frameNames.map((frame) => ({ key: assetId, frame })),
        frameRate: a.frameRate,
        repeat: a.repeat,
        repeatDelay: a.repeatDelay ?? 0,
      });
    }
  }

  /** Estado actual del reposo (para pruebas y depuración). */
  get state(): IdleState {
    return this.timeline.state;
  }

  /** Llamar cada fotograma mientras Vanessa está quieta. */
  update(deltaMs: number, facing: Facing): void {
    if (!this.available) return;
    this.direction = facing;
    const changed = this.timeline.tick(deltaMs, false, facing);
    if (changed || this.lastKey === "") this.apply();
  }

  /** Las acciones que el visitante puede pedir, en el orden en que se turnan. */
  private actions(): IdleAction[] {
    return [...(this.slots.fetch ? (["fetch"] as const) : []), ...(this.slots.tricks ? (["tricks"] as const) : [])];
  }

  /** ¿Hay alguna acción (buscar el peluche o trucos) disponible? */
  get canAct(): boolean {
    return this.available && this.actions().length > 0;
  }

  /**
   * El visitante pide jugar con Jerry (tecla o botón): cada vez toca la siguiente acción, primero buscar el peluche y
   * después los trucos (salto, sentarse, dar la pata y levantarse). Devuelve la acción que arrancó, o `null` si no hay
   * ninguna disponible o ya hay una en curso (no se reinicia).
   */
  requestAction(): IdleAction | null {
    const list = this.actions();
    if (!this.available || list.length === 0) return null;
    const action = list[this.actionIndex % list.length];
    if (!this.timeline.startAction(action)) return null;
    this.actionIndex++;
    this.apply();
    return action;
  }

  /** Vanessa se mueve o celebra: se corta cualquier gesto y el temporizador vuelve a empezar. */
  cancel(): void {
    if (!this.available) return;
    this.detach();
    this.sprite.setScale(this.baseScale); // al volver a caminar, la escala de siempre
    this.timeline.cancel();
    this.lastKey = "";
  }

  /** La animación de la hoja para la dirección actual; los gestos de una sola secuencia usan la que cubre todos los fotogramas. */
  private find(slot: Slot): IdleAnimation | undefined {
    const animations = slot.entry.animations ?? [];
    const directional = animations.find((a) => a.direction === KIT_DIRECTION[this.direction]);
    if (directional && (slot === this.slots.rest || slot === this.slots.glance)) return directional;
    return animations.find((a) => a.direction === "front") ?? animations.find((a) => new Set(a.frameNames).size === slot.entry.frameCount) ?? animations[0];
  }

  private apply(): void {
    const state = this.timeline.state;
    const slot =
      (state === "glance" ? this.slots.glance : state === "play" ? this.slots.play : state === "tricks" ? this.slots.tricks : state === "fetch" ? this.slots.fetch : undefined) ?? this.slots.rest;
    const animation = this.find(slot);
    if (!animation) return;
    this.detach();
    this.lastKey = animation.key;
    this.sprite.setScale(this.baseScale);
    this.sprite.setOrigin(slot.entry.origin?.x ?? 0.5, slot.entry.origin?.y ?? 1);
    this.watchFrames(slot, animation);
    if (this.reducedMotion) {
      // Sin bucle ni gestos: un fotograma fijo. El reposo, el primero en la dirección en que mira; lo que pide el visitante,
      // un fotograma que lo cuenta (el peluche, o Jerry dando la pata) el tiempo de espera.
      this.sprite.anims.stop();
      this.sprite.setTexture(slot.assetId, state === "fetch" ? animation.frameNames[animation.frameNames.length - 1] : state === "tricks" ? this.pawFrame(slot, animation) : animation.frameNames[0]);
      this.adjust(slot, state === "fetch" ? animation.frameNames[animation.frameNames.length - 1] : state === "tricks" ? this.pawFrame(slot, animation) : animation.frameNames[0]);
      if (state === "fetch" || state === "tricks") this.hold();
      return;
    }
    this.sprite.anims.play(animation.key);
    if (state !== "rest" && state !== "walk") {
      this.onComplete = (done) => {
        if (done.key !== animation.key) return;
        this.detach();
        if (state === "fetch") return this.hold(); // se queda el último fotograma, con el peluche
        if (state === "tricks" ? this.timeline.actionDone() : this.timeline.gestureDone()) this.apply();
      };
      this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onComplete);
    }
  }

  /**
   * Algunas hojas (los trucos regenerados) no dibujan a Vanessa a la misma altura en todas las poses: `frameAdjust` trae,
   * por fotograma, el factor de escala y el origen (los pies) que la dejan a la altura del caminar. Se aplican al cambiar
   * de fotograma; solo es visual, no toca el cuerpo de colisión.
   */
  private watchFrames(slot: Slot, animation: IdleAnimation): void {
    if (!slot.entry.frameAdjust || this.reducedMotion) return;
    this.onFrame = (_anim, frame) => this.adjust(slot, frame.textureFrame as string);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_START, this.onFrame);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onFrame);
    this.adjust(slot, animation.frameNames[0]);
  }

  private adjust(slot: Slot, frameName: string): void {
    const adjust = slot.entry.frameAdjust?.find((f) => f.name === frameName);
    if (!adjust) return;
    this.sprite.setScale(this.baseScale * adjust.scaleMultiplier);
    this.sprite.setOrigin(adjust.origin.x, adjust.origin.y);
  }

  /** Con movimiento reducido, el fotograma de «dar la pata»: el central de esa parte de la secuencia. */
  private pawFrame(slot: Slot, full: IdleAnimation): string {
    const paw = slot.entry.animations?.find((a) => a.key === "jerry-give-paw");
    const names = paw?.frameNames ?? full.frameNames;
    return names[Math.floor(names.length / 2)];
  }

  /** Mantiene el último fotograma de la búsqueda `holdMs` y vuelve al reposo. */
  private hold(): void {
    this.holdTimer?.remove(false);
    this.holdTimer = this.scene.time.delayedCall(this.holdMs, () => {
      this.holdTimer = undefined;
      if (this.timeline.actionDone()) this.apply();
    });
  }

  private detach(): void {
    if (this.onFrame) {
      this.sprite.off(Phaser.Animations.Events.ANIMATION_START, this.onFrame);
      this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.onFrame);
      this.onFrame = undefined;
    }
    this.holdTimer?.remove(false);
    this.holdTimer = undefined;
    if (this.onComplete) this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onComplete);
    this.onComplete = undefined;
  }

  destroy(): void {
    this.detach();
  }
}
