import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Paths } from "../tiled/files";

// Cerrojo de un guardado del laboratorio de sonidos: mientras existe, los observadores de Tiled (el del plugin de Vite y `tiled:watch`) no
// importan, para no leer una transacción a medias. Es un archivo y no una bandera en memoria porque `tiled:watch` es otro proceso.

export const SAVE_LOCK_NAME = ".audio-lab.lock";
/** Un cerrojo más viejo que esto es de un guardado que murió: se ignora. */
const STALE_MS = 2 * 60 * 1000;

export const saveLockFile = (paths: Paths): string => join(paths.tiledDir, SAVE_LOCK_NAME);

export function isSaveLocked(paths: Paths, now = Date.now()): boolean {
  const file = saveLockFile(paths);
  if (!existsSync(file)) return false;
  try {
    return now - statSync(file).mtimeMs < STALE_MS;
  } catch {
    return false;
  }
}

export class SaveBusyError extends Error {}

/** Toma el cerrojo (falla si otro guardado está en curso) y devuelve la función que lo libera. */
export function acquireSaveLock(paths: Paths): () => void {
  const file = saveLockFile(paths);
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file) && !isSaveLocked(paths)) rmSync(file, { force: true });
  try {
    writeFileSync(file, `${process.pid} ${new Date().toISOString()}\n`, { flag: "wx" });
  } catch {
    throw new SaveBusyError("hay otro guardado del laboratorio de sonidos en curso");
  }
  return () => rmSync(file, { force: true });
}
