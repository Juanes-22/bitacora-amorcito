import Phaser from "phaser";
import type { GameplayConfig, Point } from "../../config/types";
import type { Direction } from "../bridge/events";
import { findAnimation } from "../../assets/frameDefinitions";
import type { AssetRegistry } from "../../config/assetRegistry";
import { GroundShadow } from "../systems/GroundShadow";
import { IdleBehavior } from "../systems/IdleBehavior";
import { animKey, ensureSheet, restFrameOf } from "../systems/sheets";
import { REF_PLAYER_SCALE } from "../systems/worldScale";

type PlayerSpec = GameplayConfig["player"];

const WALK_KEYS: Record<Direction, keyof PlayerSpec["animations"]> = {
  down: "walkDown",
  left: "walkLeft",
  right: "walkRight",
  up: "walkUp",
};

/**
 * Vanessa (y Jerry, si el sprite ya lo incluye). El cuerpo Arcade es un rectángulo pequeño en los pies
 * (`gameplay.player.body`, píxeles de textura × scale, medido desde el punto de apoyo); el sprite solo lo
 * sigue. Así el cuerpo no se mueve al cambiar de pose aunque cada frame tenga un tamaño distinto.
 */
export class Player {
  readonly feet: Phaser.GameObjects.Zone;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly hasSheet: boolean;
  private readonly center: Point; // desplazamiento del centro del cuerpo respecto de los pies
  private facing: Direction = "down";
  private idle?: IdleBehavior;
  private shadow?: GroundShadow;
  private walking = false;
  private celebrating = false;
  /** Desplazamiento vertical visual de la celebración (un efecto, no una mecánica: el cuerpo no se mueve). */
  private hop = { y: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly spec: PlayerSpec, start: Point, idle?: { assets: AssetRegistry; reducedMotion: boolean }) {
    const { body, scale } = spec;
    this.center = { x: (body.offset.x + body.width / 2) * scale, y: (body.offset.y + body.height / 2) * scale };
    this.feet = scene.add.zone(start.x + this.center.x, start.y + this.center.y, body.width * scale, body.height * scale);
    scene.physics.add.existing(this.feet);
    const arcade = this.body;
    arcade.setCollideWorldBounds(true);

    this.hasSheet = ensureSheet(scene, spec.assetId);
    this.sprite = scene.add.sprite(start.x, start.y, spec.assetId);
    this.sprite.setScale(spec.scale);
    if (idle) this.enableIdle(idle);
    if (spec.shadow) this.shadow = new GroundShadow(scene, this.sprite, spec.shadow);
    if (this.hasSheet) this.rest();
    else this.sprite.setOrigin(spec.origin.x, spec.origin.y); // sin frames: imagen estática con su origen
    this.syncSprite();
  }

  /**
   * Activa el reposo animado cuando sus hojas están cargadas. Se llama al crear a Vanessa y otra vez si las hojas llegan después
   * (carga por etapas: al principio se ve la pose de reposo de la hoja de caminar).
   */
  enableIdle(idle: { assets: AssetRegistry; reducedMotion: boolean }): void {
    if (this.idle || !this.hasSheet || !this.spec.idle) return;
    const behavior = new IdleBehavior(this.scene, this.sprite, this.spec.idle, idle.assets, idle.reducedMotion, this.spec.scale);
    if (behavior.available) this.idle = behavior;
    else behavior.destroy();
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.feet.body as Phaser.Physics.Arcade.Body;
  }

  /** Pies de Vanessa en coordenadas del mundo: de aquí salen proximidad y checkpoints. */
  get position(): Point {
    return { x: this.feet.x - this.center.x, y: this.feet.y - this.center.y };
  }

  /** Colocación directa (aparición, restauración, cambio de zona): sincroniza el cuerpo. */
  place(p: Point): void {
    this.feet.setPosition(p.x + this.center.x, p.y + this.center.y);
    this.body.reset(this.feet.x - this.body.halfWidth, this.feet.y - this.body.halfHeight);
    this.stop();
    this.syncSprite();
  }

  /** `vector` ya viene normalizado; la velocidad está en unidades del mundo por segundo. */
  update(vector: { x: number; y: number }, speed: number, deltaMs = 16): void {
    if (this.celebrating) {
      this.body.setVelocity(0, 0); // celebrando: sin caminar, pero la cámara y la profundidad siguen vigentes
      this.syncSprite();
      return;
    }
    this.body.setVelocity(vector.x * speed, vector.y * speed);
    const moving = vector.x !== 0 || vector.y !== 0;
    if (moving) {
      this.facing = Math.abs(vector.x) >= Math.abs(vector.y) ? (vector.x < 0 ? "left" : "right") : vector.y < 0 ? "up" : "down";
    }
    this.animate(moving, deltaMs);
    this.syncSprite();
  }

  stop(): void {
    this.body.setVelocity(0, 0);
    this.animate(false, 0);
  }

  /**
   * Jugar con Jerry (SPEC 6.2). Lo pide el visitante con una tecla o un botón: detiene a Vanessa y reproduce, una vez, la
   * siguiente acción (buscar el peluche o los trucos con dar la pata). No arranca durante una celebración ni si no hay hojas;
   * una acción en curso no se reinicia. Devuelve cuál arrancó.
   */
  requestAction(): "fetch" | "tricks" | null {
    if (!this.idle?.canAct || this.celebrating) return null;
    this.body.setVelocity(0, 0);
    return this.idle.requestAction();
  }

  get isCelebrating(): boolean {
    return this.celebrating;
  }

  /**
   * Pose de celebración con la hoja que declara `animations.celebrate` (puede ser otra hoja del mismo
   * personaje). Es un efecto visual: no cambia colisiones ni permite saltarse nada. Con movimiento reducido
   * se muestra una pose estática, sin animación ni saltos. Devuelve la duración en ms, o 0 si no hay animación.
   */
  celebrate(reducedMotion: boolean): number {
    const animId = this.spec.animations.celebrate;
    const found = animId ? findAnimation(animId) : undefined;
    if (!animId || !found || this.celebrating || !ensureSheet(this.scene, found.sheet.assetId)) return 0;
    const { sheet, spec } = found;
    this.celebrating = true;
    this.idle?.cancel();
    this.body.setVelocity(0, 0);
    this.sprite.anims.stop();
    this.sprite.setScale(this.spec.scale * (sheet.scale ?? 1));
    let duration: number;
    if (reducedMotion) {
      this.sprite.setTexture(sheet.assetId, spec.stillFrame ?? spec.frames[0]);
      duration = 1600;
    } else {
      this.sprite.setTexture(sheet.assetId, spec.frames[0]);
      this.sprite.anims.play(animKey(sheet.assetId, animId));
      duration = (spec.frames.length / spec.frameRate) * 1000 + 600;
      this.scene.tweens.add({ targets: this.hop, y: -16 * (this.spec.scale / REF_PLAYER_SCALE), duration: 220, yoyo: true, repeat: 1, ease: "Sine.easeOut", delay: 450 });
    }
    this.scene.time.delayedCall(duration, () => this.endCelebration());
    return duration;
  }

  private endCelebration(): void {
    if (!this.celebrating || !this.sprite.active) return;
    this.celebrating = false;
    this.hop.y = 0;
    this.sprite.anims.stop();
    this.sprite.setTexture(this.spec.assetId);
    this.sprite.setScale(this.spec.scale);
    this.walking = false;
    this.rest(this.spec.animations[WALK_KEYS[this.facing]]);
    this.syncSprite();
  }

  private animate(moving: boolean, deltaMs: number): void {
    if (!this.hasSheet) return;
    const walkId = this.spec.animations[WALK_KEYS[this.facing]];
    if (moving && walkId) {
      this.idle?.cancel();
      this.sprite.anims.play(animKey(this.spec.assetId, walkId), true);
    } else if (this.idle && !moving) {
      this.idle.update(deltaMs, this.facing); // quieta: respira, parpadea y, con el tiempo, se mira con Jerry y juega
    } else if (this.walking || !moving) {
      this.sprite.anims.stop();
      this.rest(walkId);
    }
    this.walking = moving && !!walkId;
  }

  private rest(walkId?: string): void {
    const frame =
      (walkId && restFrameOf(this.spec.assetId, walkId)) ||
      (this.spec.animations.idle && restFrameOf(this.spec.assetId, this.spec.animations.idle));
    if (frame) this.sprite.setFrame(frame);
  }

  private syncSprite(): void {
    const { x, y } = this.position;
    this.sprite.setPosition(x, y + this.hop.y);
    this.sprite.setDepth(y); // orden por la altura de los pies
    this.shadow?.update(this.hop.y);
  }

  destroy(): void {
    this.idle?.destroy();
    this.shadow?.destroy();
    this.sprite.destroy();
    this.feet.destroy();
  }
}
