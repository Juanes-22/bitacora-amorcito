import Phaser from "phaser";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { AssetEntry } from "../../config/types";

/** Fotograma que se muestra quieto con movimiento reducido: el de mayor presencia de cada efecto (el aro; la estrella plena). */
const STILL_FRAME = 3;

interface Fx {
  assetId: string;
  entry: AssetEntry;
  names: string[];
  key: string;
}

/** Registra (una vez) la animación de una hoja de efecto y devuelve sus datos; `null` si la hoja no cargó. */
function prepare(scene: Phaser.Scene, assets: AssetRegistry, assetId: string): Fx | null {
  if (!scene.textures.exists(assetId) || !assets.has(assetId)) return null;
  const entry = assets.get(assetId);
  const a = entry.animation;
  if (!a) return null;
  const key = `${assetId}:fx`;
  if (!scene.anims.exists(key)) {
    scene.anims.create({ key, frames: a.frameNames.map((frame) => ({ key: assetId, frame })), frameRate: a.frameRate, repeat: a.repeat });
  }
  return { assetId, entry, names: a.frameNames, key };
}

/** La opacidad de cada fotograma (el pulso del aro, el desvanecimiento de la estrella) viene del manifiesto. */
function followOpacity(sprite: Phaser.GameObjects.Sprite, fx: Fx): void {
  const opacity = fx.entry.opacityByFrame;
  if (!opacity) return;
  const apply = (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
    sprite.setAlpha(opacity[fx.names.indexOf(frame.textureFrame as string)] ?? 1);
  };
  sprite.on(Phaser.Animations.Events.ANIMATION_START, apply);
  sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, apply);
}

function place(scene: Phaser.Scene, fx: Fx, x: number, y: number, depth: number, scale: number): Phaser.GameObjects.Sprite {
  return scene.add
    .sprite(x, y, fx.assetId, fx.names[0])
    .setOrigin(fx.entry.origin?.x ?? 0.5, fx.entry.origin?.y ?? 0.5)
    .setScale(scale)
    .setDepth(depth)
    .setAlpha(fx.entry.opacityByFrame?.[0] ?? 1);
}

/**
 * Aro de «próxima estación» (SPEC 4.3): se repite mientras la estación es la siguiente del recorrido. Su pulso de opacidad
 * sale del manifiesto. Mide `displayWidth` en el mundo (el ancho del fotograma se ajusta a él). Con movimiento reducido es un
 * fotograma fijo. Devuelve `null` si la hoja no cargó.
 */
export function createNextStationGlow(scene: Phaser.Scene, assets: AssetRegistry, assetId: string, x: number, y: number, depth: number, displayWidth: number, reducedMotion: boolean): Phaser.GameObjects.Sprite | null {
  const fx = prepare(scene, assets, assetId);
  if (!fx) return null;
  const frameWidth = fx.entry.sourceFrameSize?.width ?? scene.textures.getFrame(assetId, fx.names[0]).width;
  const sprite = place(scene, fx, x, y, depth, displayWidth / frameWidth);
  if (reducedMotion) {
    sprite.setFrame(fx.names[STILL_FRAME] ?? fx.names[0]).setAlpha(fx.entry.opacityByFrame?.[STILL_FRAME] ?? 1);
  } else {
    followOpacity(sprite, fx);
    sprite.play({ key: fx.key, startFrame: 0 });
  }
  return sprite;
}

/** Fotogramas de la estrella: crece (0 a 3) y después titila sin desvanecerse (3, 4, 5, 4). */
const STAR_ENTER = [0, 1, 2, 3];
const STAR_LOOP = [3, 4, 5, 4];
const STAR_LOOP_FPS = 5;

/**
 * Estrella de XP de una estación completada (SPEC 4.3): una vez que aparece sobre la estación **se queda animada**: titila
 * en bucle sin desvanecerse. Al completarse el aprendizaje entra creciendo (`entrance`); al cargar una partida con la
 * estación ya completada empieza directamente en el titileo. Su opacidad por fotograma sale del manifiesto. Con movimiento
 * reducido es un fotograma fijo, sin entrada ni bucle. Devuelve `null` si la hoja no cargó.
 */
export function createXpStar(scene: Phaser.Scene, assets: AssetRegistry, assetId: string, x: number, y: number, depth: number, scale: number, reducedMotion: boolean, entrance: boolean): Phaser.GameObjects.Sprite | null {
  const fx = prepare(scene, assets, assetId);
  if (!fx) return null;
  const sprite = place(scene, fx, x, y, depth, scale);
  const frames = (indices: number[]) => indices.map((i) => ({ key: assetId, frame: fx.names[i] ?? fx.names[0] }));
  const enterKey = `${assetId}:star-enter`;
  const loopKey = `${assetId}:star-loop`;
  if (!scene.anims.exists(enterKey)) scene.anims.create({ key: enterKey, frames: frames(STAR_ENTER), frameRate: fx.entry.animation?.frameRate ?? 12, repeat: 0 });
  if (!scene.anims.exists(loopKey)) scene.anims.create({ key: loopKey, frames: frames(STAR_LOOP), frameRate: STAR_LOOP_FPS, repeat: -1 });
  if (reducedMotion) {
    sprite.setFrame(fx.names[STILL_FRAME] ?? fx.names[0]).setAlpha(1);
    return sprite;
  }
  followOpacity(sprite, fx);
  if (entrance) {
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.active && sprite.play(loopKey));
    sprite.play(enterKey);
  } else {
    sprite.play({ key: loopKey, startFrame: Phaser.Math.Between(0, STAR_LOOP.length - 1) }); // cada estrella en su fase
  }
  return sprite;
}

/** Un grupo de destellos que centellean alrededor del brillo de la próxima estación. */
export interface Sparkles {
  setVisible(visible: boolean): void;
  destroy(): void;
}

/** Cuántos destellos hay a la vez y cuánto esperan, al azar, entre un centelleo y el siguiente. */
/** Nombre de los destellos de las estaciones: los distingue de los efectos del paisaje (que usan la misma hoja). */
export const SPARKLE_NAME = "station-sparkle";
const SPARKLE_COUNT = 5;
const SPARKLE_WAIT_MS = { min: 150, max: 1100 };

/**
 * Destellos dorados («sparkles») alrededor del brillo de la próxima estación (SPEC 4.3): cada uno aparece en un punto al azar
 * de la elipse que rodea la señal, centellea una vez (crece y se apaga, con la hoja de destellos del catálogo), espera un
 * momento y reaparece en otro sitio. Con movimiento reducido no hay destellos (como el resto de las partículas). Devuelve
 * `null` si la hoja no cargó.
 */
export function createStationSparkles(
  scene: Phaser.Scene, assets: AssetRegistry, assetId: string,
  cx: number, cy: number, rx: number, ry: number, depth: number, scale: number, reducedMotion: boolean,
): Sparkles | null {
  const fx = prepare(scene, assets, assetId);
  if (!fx || reducedMotion) return null;
  const key = `${assetId}:sparkle`;
  if (!scene.anims.exists(key)) {
    scene.anims.create({ key, frames: fx.names.map((frame) => ({ key: assetId, frame })), frameRate: fx.entry.animation?.frameRate ?? 12, repeat: 0 });
  }
  let visible = false;
  const timers: Phaser.Time.TimerEvent[] = [];
  const sprites = Array.from({ length: SPARKLE_COUNT }, () =>
    scene.add.sprite(cx, cy, assetId, fx.names[0]).setName(SPARKLE_NAME).setScale(scale).setDepth(depth).setVisible(false).setAlpha(fx.entry.opacity ?? 1),
  );
  const schedule = (sprite: Phaser.GameObjects.Sprite, delay: number) => {
    timers.push(scene.time.delayedCall(delay, () => {
      if (!sprite.active) return;
      if (!visible) return schedule(sprite, 400); // la estación ya no es la próxima: espera sin dibujar
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const r = Math.sqrt(Phaser.Math.FloatBetween(0.15, 1));
      sprite.setPosition(cx + Math.cos(angle) * rx * r, cy + Math.sin(angle) * ry * r).setVisible(true).setScale(scale * Phaser.Math.FloatBetween(0.7, 1.15));
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        sprite.setVisible(false);
        schedule(sprite, Phaser.Math.Between(SPARKLE_WAIT_MS.min, SPARKLE_WAIT_MS.max));
      });
      sprite.play(key);
    }));
  };
  sprites.forEach((s) => schedule(s, Phaser.Math.Between(0, SPARKLE_WAIT_MS.max)));
  return {
    setVisible(v: boolean) {
      visible = v;
      if (!v) sprites.forEach((s) => s.setVisible(false));
    },
    destroy() {
      timers.forEach((t) => t.remove(false));
      sprites.forEach((s) => s.destroy());
    },
  };
}
