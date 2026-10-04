import Phaser from "phaser";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { AssetEntry, BitacoraConfig, CritterAnimation, Point } from "../../config/types";
import { DEFAULT_BRAIN, nextAction, stepToward, Trail, type Action, type CritterState } from "./critterBrain";
import { ensureTexture, SHADOW_TEXTURE_KEY } from "./GroundShadow";

export interface Critters {
  destroy(): void;
}

/** Nombre de los sprites de los animalitos (los pruebas y los distinguen del resto del mapa). */
export const CRITTER_NAME = "critter";
/** Nombre de la sombra de cada animalito (para distinguirla de la de Vanessa y Jerry). */
export const CRITTER_SHADOW_NAME = "critter-shadow";

const SHADOW = { alpha: 0.3, width: 0.42, aspect: 0.34 };
/** Separación entre pollitos a lo largo del recorrido de la madre (px del mundo, a escala 1) y velocidad máxima al alcanzarla. */
const CHICK_SPACING = 15;
const CHICK_MAX_SPEED = 64;
const CHICK_PECK_MS: readonly [number, number] = [1800, 4200];

const animKey = (assetId: string, state: CritterState) => `${assetId}:${state}`;

/** Registra (una vez) las tres animaciones de la hoja con la duración propia de cada fotograma. */
function ensureAnimations(scene: Phaser.Scene, assetId: string, entry: AssetEntry): Record<CritterState, CritterAnimation> | null {
  const list = entry.critterAnimations;
  if (!list) return null;
  const byState = Object.fromEntries(list.map((a) => [a.state, a])) as Record<CritterState, CritterAnimation>;
  for (const a of list) {
    const key = animKey(assetId, a.state);
    if (scene.anims.exists(key)) continue;
    // La duración de cada fotograma va en la propia animación; la velocidad base de 1 ms por fotograma la deja tal cual.
    scene.anims.create({ key, frames: a.frameNames.map((frame, i) => ({ key: assetId, frame, duration: a.durationsMs[i] })), frameRate: 1000, repeat: a.repeat });
  }
  return byState;
}

const cycleMs = (a: CritterAnimation) => a.durationsMs.reduce((sum, d) => sum + d, 0);

interface Body {
  assetId: string;
  entry: AssetEntry;
  anims: Record<CritterState, CritterAnimation>;
  scale: number;
}

/** Un animalito: su sprite, su sombra y su estado. Las gallinas merodean; los pollitos siguen el recorrido de la madre. */
class Animal {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  pos: Point;
  state: CritterState = "idle";
  /** Hasta cuándo dura el estado actual (tiempo de la escena en ms). */
  private until = 0;
  private target: Point | null = null;
  private speed: number;

  constructor(scene: Phaser.Scene, private readonly body: Body, start: Point, flipX: boolean, private readonly reduced: boolean, speedFactor: number) {
    this.pos = { ...start };
    this.speed = DEFAULT_BRAIN.walkSpeed * speedFactor;
    const o = body.entry.origin ?? { x: 0.5, y: 1 };
    const names = body.anims.idle.frameNames;
    this.sprite = scene.add
      .sprite(start.x, start.y, body.assetId, names[0])
      .setName(CRITTER_NAME)
      .setOrigin(o.x, o.y)
      .setScale(body.scale)
      .setFlipX(flipX);
    ensureTexture(scene);
    const shadowW = body.scale * (body.entry.sourceFrameSize?.width ?? 448) * SHADOW.width;
    this.shadow = scene.add.image(start.x, start.y, SHADOW_TEXTURE_KEY).setName(CRITTER_SHADOW_NAME).setAlpha(SHADOW.alpha).setDisplaySize(shadowW, shadowW * SHADOW.aspect);
    this.syncView();
  }

  private play(state: CritterState, startRandom = false): void {
    this.state = state;
    if (this.reduced) return;
    const a = this.body.anims[state];
    this.sprite.anims.play({ key: animKey(this.body.assetId, state), startFrame: startRandom ? Phaser.Math.Between(0, a.frameNames.length - 1) : 0 });
  }

  /** Aplica lo que decide el cerebro. */
  apply(action: Action, now: number): void {
    if (action.kind === "walk") {
      this.target = action.target;
      this.sprite.setFlipX(action.target.x < this.pos.x ? true : action.target.x > this.pos.x ? false : this.sprite.flipX);
      this.until = Infinity;
      this.play("walk");
    } else if (action.kind === "peck") {
      this.target = null;
      this.until = now + action.loops * cycleMs(this.body.anims.peck);
      this.play("peck");
    } else {
      this.target = null;
      this.until = now + action.ms;
      this.play("idle", true);
    }
  }

  /** Avanza un fotograma de la escena. `decide` pide la siguiente acción cuando acaba la actual. */
  update(now: number, dtMs: number, decide: (previous: CritterState, at: Point) => Action): void {
    if (this.reduced) return;
    if (this.state === "walk" && this.target) {
      const step = stepToward(this.pos, this.target, this.speed, dtMs);
      this.pos = step.pos;
      if (step.arrived) this.apply(decide("walk", this.pos), now);
    } else if (now >= this.until) {
      this.apply(decide(this.state, this.pos), now);
    }
    this.syncView();
  }

  /** Un pollito: va hacia `target` (un punto del recorrido de la madre) y descansa o picotea cuando ya está allí. */
  follow(now: number, dtMs: number, target: Point, rng: () => number): void {
    if (this.reduced) return;
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5) {
      const speed = Math.min(CHICK_MAX_SPEED, d * 3.2 + 6);
      this.pos = stepToward(this.pos, target, speed, dtMs).pos;
      if (Math.abs(dx) > 0.4) this.sprite.setFlipX(dx < 0);
      if (this.state !== "walk") {
        this.play("walk");
        this.until = Infinity;
      }
    } else if (this.state === "walk") {
      this.apply({ kind: "idle", ms: 800 + rng() * 1400 }, now);
    } else if (now >= this.until) {
      const peck = rng() < 0.5;
      this.apply(peck ? { kind: "peck", loops: 1 } : { kind: "idle", ms: CHICK_PECK_MS[0] + rng() * (CHICK_PECK_MS[1] - CHICK_PECK_MS[0]) }, now);
    }
    this.syncView();
  }

  setStill(frame = 0): void {
    this.sprite.setFrame(this.body.anims.idle.frameNames[frame]);
  }

  teleport(p: Point): void {
    this.pos = { ...p };
    this.syncView();
  }

  private syncView(): void {
    this.sprite.setPosition(this.pos.x, this.pos.y).setDepth(this.pos.y);
    this.shadow.setPosition(this.pos.x, this.pos.y + 1).setDepth(this.pos.y - 1);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

/**
 * Las gallinas y los pollitos de la zona (SPEC 3.3), a partir de `maps[zona].critters`. Cada gallina merodea en un círculo
 * alrededor de su casa: reposa, picotea y da paseos cortos, con tiempos y velocidad algo distintos para que no vayan
 * sincronizadas. La familia es una gallina con sus pollitos, que siguen su recorrido a distancia. Con movimiento reducido
 * se quedan quietos en su primer fotograma. Se destruye con la zona.
 */
export function buildCritters(scene: Phaser.Scene, config: BitacoraConfig, assets: AssetRegistry, zoneId: string, reducedMotion: boolean): Critters {
  const zone = config.maps[zoneId];
  const animals: Animal[] = [];
  const updaters: Array<(now: number, dt: number) => void> = [];
  const rng = Math.random;

  const bodyOf = (assetId: string, scaleMultiplier = 1): Body | null => {
    if (!scene.textures.exists(assetId) || !assets.has(assetId)) return null; // falló la carga: ya se informó con su ID
    const entry = assets.get(assetId);
    const anims = ensureAnimations(scene, assetId, entry);
    if (!anims || !entry.sourceFrameSize || !entry.recommendedDisplay) return null;
    return { assetId, entry, anims, scale: (entry.recommendedDisplay.width / entry.sourceFrameSize.width) * scaleMultiplier };
  };

  for (const critter of zone.critters ?? []) {
    const body = bodyOf(critter.assetId, critter.scale);
    if (!body) continue;
    const home = critter.position;
    const mother = new Animal(scene, body, home, critter.type === "wander" ? (critter.flipX ?? rng() < 0.5) : false, reducedMotion, 0.85 + rng() * 0.3);
    animals.push(mother);
    const decide = (previous: CritterState, at: Point) => nextAction(rng, previous, home, critter.radius, at);
    if (reducedMotion) mother.setStill();
    else mother.apply({ kind: "idle", ms: rng() * 2500 }, scene.time.now); // cada una arranca en su momento

    if (critter.type === "family") {
      const chickBody = bodyOf(critter.chickAssetId, critter.chickScale ?? critter.scale);
      const chicks: Animal[] = [];
      const trail = new Trail(3, (critter.chicks + 2) * CHICK_SPACING * 2);
      if (chickBody) {
        // La cola de la madre al empezar: hacia el borde más cercano del mundo si cabe (los pollitos no arrancan sobre lo que
        // haya hacia dentro), y si no cabe, hacia el otro lado.
        const spacing = CHICK_SPACING * (chickBody.scale / (chickBody.entry.recommendedDisplay!.width / chickBody.entry.sourceFrameSize!.width));
        const tail = (critter.chicks + 1) * spacing + 6;
        const toEdge = home.x < zone.width / 2 ? -1 : 1;
        const room = toEdge < 0 ? home.x : zone.width - home.x;
        const dir = room >= tail ? toEdge : -toEdge;
        const seed: Point[] = [];
        for (let k = (critter.chicks + 1) * Math.ceil(spacing / 3); k >= 0; k--) seed.push({ x: home.x + dir * k * 3, y: home.y });
        trail.seed(seed);
        for (let i = 0; i < critter.chicks; i++) {
          const at = trail.pointBehind(home, (i + 1) * spacing);
          const chick = new Animal(scene, chickBody, { x: at.x, y: at.y + (i % 2 ? 3 : -3) }, dir < 0, reducedMotion, 1);
          chicks.push(chick);
          animals.push(chick);
          if (reducedMotion) chick.setStill();
          else chick.apply({ kind: "idle", ms: 400 + rng() * 2500 }, scene.time.now);
        }
        const lateral = chicks.map((_, i) => ({ x: (rng() - 0.5) * 6, y: (i % 2 ? 2 : -2) * (0.5 + rng()) }));
        updaters.push((now, dt) => {
          if (reducedMotion) return;
          trail.push(mother.pos);
          chicks.forEach((chick, i) => {
            const t = trail.pointBehind(mother.pos, (i + 1) * spacing);
            chick.follow(now, dt, { x: t.x + lateral[i].x, y: t.y + lateral[i].y }, rng);
          });
        });
      }
    }
    updaters.unshift((now, dt) => mother.update(now, dt, decide));
  }

  const onUpdate = (_time: number, delta: number) => {
    const now = scene.time.now;
    const dt = Math.min(delta, 100);
    for (const u of updaters) u(now, dt);
  };
  if (!reducedMotion && updaters.length) scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

  return {
    destroy() {
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      animals.forEach((a) => a.destroy());
      animals.length = 0;
      updaters.length = 0;
    },
  };
}
