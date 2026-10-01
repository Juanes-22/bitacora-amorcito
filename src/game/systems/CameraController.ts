import Phaser from "phaser";
import type { GameplayConfig } from "../../config/types";
import type { Player } from "../entities/Player";
import { cameraBounds, effectiveZoom } from "./framing";
import type { World } from "./WorldBuilder";

/**
 * Cámara con seguimiento que SIEMPRE cubre el canvas: zoom «cover» acotado y, si la vista aun así excede el
 * mundo, límites ensanchados para centrarlo (SPEC 6.3). Transforma el escenario, no las ventanas HTML ni las
 * coordenadas del mundo. Se recalcula al cambiar el tamaño del contenedor. Devuelve su limpieza.
 */
export function setupCamera(scene: Phaser.Scene, world: World, player: Player, gameplay: GameplayConfig, reducedMotion: boolean): () => void {
  const cam = scene.cameras.main;
  const settings = {
    baseZoom: gameplay.cameraZoom,
    fit: gameplay.camera.fit,
    maxZoom: gameplay.camera.maxZoom,
    playerHeight: player.sprite.displayHeight, // pose de pie: lo que mide el personaje a zoom 1
    minPlayerHeight: gameplay.camera.minPlayerHeight,
  };

  const frame = () => {
    const view = { width: scene.scale.width, height: scene.scale.height };
    const zoom = effectiveZoom(view, world, settings);
    const b = cameraBounds(view, zoom, world);
    cam.setZoom(zoom);
    cam.setBounds(b.x, b.y, b.width, b.height);
  };

  cam.setRoundPixels(true);
  frame();
  // Sin suavizado con movimiento reducido; con él, un seguimiento corto que no desenfoca el pixel art.
  const lerp = reducedMotion ? 1 : 0.2;
  cam.startFollow(player.sprite, true, lerp, lerp);
  cam.centerOn(player.position.x, player.position.y); // la primera imagen ya sale centrada, sin barrido

  scene.scale.on(Phaser.Scale.Events.RESIZE, frame);
  return () => void scene.scale.off(Phaser.Scale.Events.RESIZE, frame);
}
