import Phaser from "phaser";
import type { BitacoraConfig } from "../../config/types";
import type { Player } from "../entities/Player";
import { playerFactor } from "./worldScale";

/** Tamaño máximo (px del mundo) con el que flota la insignia sobre Vanessa. */
const BADGE_SIZE = 76;

/**
 * Celebración breve en el mapa tras una transición NUEVA y aceptada: pose del personaje con Jerry, resplandor
 * y la insignia del aprendizaje. Solo pinta: la recompensa ya se decidió en el dominio (SPEC 8). Con movimiento
 * reducido no hay saltos, destellos ni desplazamientos: una pose y la insignia estáticas unos instantes.
 */
export function playCelebration(
  scene: Phaser.Scene,
  config: BitacoraConfig,
  player: Player,
  learningId: string,
  reducedMotion: boolean,
): void {
  const { x, y } = player.position;
  const k = playerFactor(config); // la celebración crece con el personaje
  const duration = Math.max(player.celebrate(reducedMotion), 1600);
  const made: Phaser.GameObjects.Image[] = [];

  const glowId = config.ui.assets.glow;
  if (scene.textures.exists(glowId)) {
    const glow = scene.add.image(x, y - 24 * k, glowId).setDepth(y - 1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9 * k);
    glow.setAlpha(reducedMotion ? 0.55 : 0.9);
    if (!reducedMotion) scene.tweens.add({ targets: glow, alpha: 0, scale: 1.4 * k, duration: duration - 200, ease: "Sine.easeOut" });
    made.push(glow);
  }

  const badge = config.badges[config.learnings[learningId]?.badgeId];
  if (badge && scene.textures.exists(badge.assetId)) {
    const image = scene.add.image(x, y - 130 * k, badge.assetId).setDepth(y + 5000);
    image.setScale((BADGE_SIZE * k) / Math.max(image.width, image.height));
    if (!reducedMotion) {
      scene.tweens.add({ targets: image, y: y - 160 * k, alpha: { from: 1, to: 0 }, duration, delay: duration * 0.4, ease: "Sine.easeInOut" });
    }
    made.push(image);
  }

  scene.time.delayedCall(duration, () => made.forEach((o) => o.destroy()));
}
