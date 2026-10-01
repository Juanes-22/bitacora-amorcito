import Phaser from "phaser";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { AmbientDepth, AmbientEffect, AssetEntry, BitacoraConfig } from "../../config/types";
import { swimmer } from "./swimPath";

export interface Ambient {
  destroy(): void;
}

/** Tope de partículas vivas por emisor: el ambiente no debe costar fotogramas (SPEC 3.2, AC-43). */
const MAX_ALIVE_PARTICLES = 24;

const depthOf = (d: AmbientDepth, y: number) => (d.mode === "fixed" ? d.value : y + d.offset);
const loopKey = (assetId: string) => `${assetId}:loop`;

/**
 * Anima el paisaje a partir de `maps[zona].ambient` (SPEC 3.2): hojas animadas con su atlas, vaivén de plantas, deriva
 * de nubes y partículas. Origen, escala recomendada, fotogramas y movimiento se leen de la metadata del manifiesto; la
 * configuración solo dice dónde, con qué profundidad y qué multiplicador de escala. Con movimiento reducido no hay
 * bucles, vaivenes, deriva ni partículas: las hojas animadas muestran su primer fotograma. Todo se destruye con la zona.
 */
export function buildAmbient(scene: Phaser.Scene, config: BitacoraConfig, assets: AssetRegistry, zoneId: string, reducedMotion: boolean): Ambient {
  const zone = config.maps[zoneId];
  const objects: Phaser.GameObjects.GameObject[] = [];
  const stops: Array<() => void> = [];

  /** Origen, escala, profundidad, mezcla y opacidad base: todo sale de la metadata del manifiesto y del efecto. */
  const place = <T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(object: T, entry: AssetEntry, fx: AmbientEffect & { position: { x: number; y: number } }): T => {
    const base = entry.recommendedScale ?? 1;
    object.setOrigin(entry.origin?.x ?? 0.5, entry.origin?.y ?? 0.5).setScale(base * (fx.scale ?? 1)).setDepth(depthOf(fx.depth, fx.position.y));
    if (entry.blendMode === "ADD") object.setBlendMode(Phaser.BlendModes.ADD);
    object.setAlpha(("alpha" in fx ? fx.alpha : undefined) ?? entry.opacity ?? 1);
    objects.push(object);
    return object;
  };

  for (const fx of zone.ambient) {
    if (!scene.textures.exists(fx.assetId)) continue; // falló la carga: ya se informó con su ID
    const entry = assets.get(fx.assetId);

    if (fx.type === "animation" && entry.animation) {
      const names = entry.animation.frameNames;
      const key = loopKey(fx.assetId);
      if (!scene.anims.exists(key)) {
        scene.anims.create({ key, frames: names.map((frame) => ({ key: fx.assetId, frame })), frameRate: entry.animation.frameRate, repeat: entry.animation.repeat });
      }
      const sprite = place(scene.add.sprite(fx.position.x, fx.position.y, fx.assetId, names[0]), entry, fx);
      sprite.setFlipX(fx.flipX ?? false);
      // Cada pieza arranca en un fotograma distinto para que varias a la vez no parezcan un solo reloj.
      if (!reducedMotion) sprite.anims.play({ key, startFrame: Phaser.Math.Between(0, names.length - 1) });
    } else if (fx.type === "sway" && entry.motion?.type === "sway") {
      const image = place(scene.add.image(fx.position.x, fx.position.y, fx.assetId), entry, fx);
      const m = entry.motion;
      if (!reducedMotion) {
        const tween: Phaser.Types.Tweens.TweenBuilderConfig = {
          targets: image,
          duration: m.durationMs,
          yoyo: m.yoyo ?? true,
          repeat: m.repeat ?? -1,
          ease: m.ease ?? "Sine.easeInOut",
          delay: Phaser.Math.Between(0, m.durationMs),
        };
        if (m.angleDegrees) {
          image.setAngle(m.angleDegrees.from);
          tween.angle = m.angleDegrees.to;
        }
        if (m.offsetXPx) {
          image.x = fx.position.x + m.offsetXPx.from;
          tween.x = fx.position.x + m.offsetXPx.to;
        }
        scene.tweens.add(tween);
      }
    } else if (fx.type === "drift" && entry.motion?.type === "drift") {
      const image = place(scene.add.image(fx.position.x, fx.position.y, fx.assetId), entry, fx);
      const m = entry.motion;
      if (!reducedMotion) {
        const dir = m.direction === "right" ? 1 : -1;
        const half = image.displayWidth / 2;
        const onUpdate = (_time: number, delta: number) => {
          image.x += (dir * m.speedPxPerSecond * delta) / 1000;
          // Al salir por un borde del mapa reaparece por el opuesto (la nube se recorta de forma natural).
          if (m.wrapAtMapEdge !== false) {
            if (dir > 0 && image.x - half > zone.width) image.x = -half;
            if (dir < 0 && image.x + half < 0) image.x = zone.width + half;
          }
        };
        scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
        stops.push(() => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
      }
    } else if (fx.type === "glow" && entry.motion?.type === "pulse") {
      const image = place(scene.add.image(fx.position.x, fx.position.y, fx.assetId), entry, fx);
      const m = entry.motion;
      if (!reducedMotion) {
        // El pulso del manifiesto está dado para la opacidad base; un `alpha` del efecto lo escala en proporción.
        const k = fx.alpha !== undefined && entry.opacity ? fx.alpha / entry.opacity : 1;
        image.setAlpha(m.alphaMin * k);
        scene.tweens.add({ targets: image, alpha: m.alphaMax * k, duration: m.durationMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Phaser.Math.Between(0, m.durationMs) });
      }
    } else if (fx.type === "swim" && entry.animation && entry.motion?.type === "swim") {
      const names = entry.animation.frameNames;
      const key = loopKey(fx.assetId);
      if (!scene.anims.exists(key)) {
        scene.anims.create({ key, frames: names.map((frame) => ({ key: fx.assetId, frame })), frameRate: entry.animation.frameRate, repeat: entry.animation.repeat });
      }
      const start = fx.path[0];
      const sprite = place(scene.add.sprite(start.x, start.y, fx.assetId, names[0]), entry, { ...fx, position: start });
      const swim = swimmer(fx.path, entry.motion.speedPxPerSecond * (fx.speedFactor ?? 1), entry.facing ?? "right");
      sprite.setFlipX(swim.at(0).flipX);
      if (!reducedMotion) {
        sprite.anims.play({ key, startFrame: Phaser.Math.Between(0, names.length - 1) });
        let travelled = Phaser.Math.FloatBetween(0, swim.length * 2); // cada pato arranca en un punto distinto del recorrido
        const onUpdate = (_time: number, delta: number) => {
          travelled += (swim.speed * delta) / 1000;
          const at = swim.at(travelled);
          sprite.setPosition(at.x, at.y).setFlipX(at.flipX);
          if (fx.depth.mode === "y") sprite.setDepth(at.y + fx.depth.offset);
        };
        scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
        stops.push(() => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
        onUpdate(0, 0);
      }
    } else if (fx.type === "particles" && entry.motion?.type === "particle") {
      if (reducedMotion) continue; // sin partículas con movimiento reducido
      const m = entry.motion;
      const emitter = scene.add.particles(0, 0, fx.assetId, {
        emitZone: {
          type: "random",
          // Un punto aleatorio dentro del área configurada, en coordenadas del mundo.
          source: {
            getRandomPoint: (point: { x: number; y: number }) => {
              point.x = Phaser.Math.FloatBetween(fx.area.x, fx.area.x + fx.area.width);
              point.y = Phaser.Math.FloatBetween(fx.area.y, fx.area.y + fx.area.height);
            },
          },
        } satisfies Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: m.lifespanMaxMs ? { min: m.lifespanMs, max: m.lifespanMaxMs } : m.lifespanMs,
        speedX: { min: m.speedX.min, max: m.speedX.max },
        speedY: { min: m.speedY.min, max: m.speedY.max },
        gravityY: m.gravityY ?? 0,
        scale: (entry.recommendedScale ?? 1) * (fx.scale ?? 1),
        alpha: { start: entry.opacity ?? 1, end: 0 },
        blendMode: entry.blendMode === "ADD" ? "ADD" : "NORMAL",
        rotate: { min: 0, max: 360 },
        frequency: fx.frequencyMs,
        quantity: 1,
        maxAliveParticles: MAX_ALIVE_PARTICLES,
      });
      emitter.setDepth(depthOf(fx.depth, fx.area.y + fx.area.height));
      objects.push(emitter);
    }
  }

  return {
    destroy() {
      stops.forEach((stop) => stop());
      objects.forEach((o) => {
        scene.tweens.killTweensOf(o);
        o.destroy();
      });
    },
  };
}
