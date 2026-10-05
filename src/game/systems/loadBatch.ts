import Phaser from "phaser";
import type { AssetRegistry } from "../../config/assetRegistry";

/**
 * Carga, sin bloquear la escena, los assets de `ids` que aún no son texturas y avisa cuando todos llegaron o fallaron (un archivo
 * ausente o ilegible no debe dejar la etapa esperando). `onDone` se llama una sola vez, también si pasan `timeoutMs`. Las hojas
 * animadas se piden con su atlas. Devuelve la función que cancela el aviso (al cerrar la escena).
 */
export function loadBatch(scene: Phaser.Scene, assets: AssetRegistry, ids: readonly string[], onDone: () => void, timeoutMs = 90000): () => void {
  const pending = new Set(ids.filter((id) => assets.has(id) && !scene.textures.exists(id)));
  if (pending.size === 0) {
    onDone();
    return () => undefined;
  }
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    finished = true;
    clearTimeout(timer);
    scene.textures.off(Phaser.Textures.Events.ADD, onAdd);
    scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  };
  const settle = (key: string) => {
    pending.delete(key);
    if (pending.size === 0 && !finished) {
      stop();
      onDone();
    }
  };
  const onAdd = (key: string) => settle(key);
  const onError = (file: Phaser.Loader.File) => settle(file.key);
  scene.textures.on(Phaser.Textures.Events.ADD, onAdd);
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  timer = setTimeout(() => {
    if (finished) return;
    stop();
    onDone();
  }, timeoutMs);

  for (const id of pending) {
    if (assets.isAtlas(id)) scene.load.atlas(id, assets.url(id), assets.atlasUrl(id));
    else scene.load.image(id, assets.url(id));
  }
  if (!scene.load.isLoading()) scene.load.start();
  return () => {
    if (!finished) stop();
  };
}
