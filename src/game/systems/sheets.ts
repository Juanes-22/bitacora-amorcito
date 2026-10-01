import type Phaser from "phaser";
import { frameDefinitions } from "../../assets/frameDefinitions";

/** Clave global de una animación: incluye el assetId para que dos hojas puedan repetir nombres. */
export const animKey = (assetId: string, animId: string) => `${assetId}:${animId}`;

/**
 * Registra los frames explícitos de una hoja de poses (pivote en los pies) y sus animaciones. Es
 * idempotente: las zonas se reinician sin volver a crear nada global (SPEC 3). Si el asset no tiene
 * definición de frames devuelve false y debe usarse como imagen estática.
 */
export function ensureSheet(scene: Phaser.Scene, assetId: string): boolean {
  const def = frameDefinitions[assetId];
  if (!def || !scene.textures.exists(assetId)) return false;
  const texture = scene.textures.get(assetId);
  for (const f of def.frames) {
    if (texture.has(f.name)) continue;
    const frame = texture.add(f.name, 0, f.x, f.y, f.width, f.height);
    if (!frame) continue;
    frame.customPivot = true;
    frame.pivotX = f.feetX / f.width;
    frame.pivotY = f.feetY / f.height;
  }
  for (const [animId, a] of Object.entries(def.animations)) {
    const key = animKey(assetId, animId);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: a.frames.map((frame) => ({ key: assetId, frame })),
      frameRate: a.frameRate,
      repeat: a.repeat,
    });
  }
  return true;
}

export function restFrameOf(assetId: string, animId: string): string | undefined {
  return frameDefinitions[assetId]?.animations[animId]?.restFrame;
}
