import type { AppMode, Point } from "../config/types";
import { SECTION_IDS, type LearningProgress, type SavedProgress } from "../domain/types";

/** Subconjunto de la API de Storage que usa la aplicación (permite sustituirlo en pruebas). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** La clave incluye el contenido, el modo y la versión del guardado; NO la `configRevision` (SPEC 13.1). */
export const storageKey = (contentSetId: string, mode: AppMode) => `bitacora:progress:v3:${contentSetId}:${mode}`;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const point = (v: unknown): Point | null =>
  isObject(v) && typeof v.x === "number" && typeof v.y === "number" && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: v.x, y: v.y } : null;
const validDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));

/**
 * Valida la FORMA de un guardado y devuelve una copia saneada, o null si no es utilizable. No decide
 * qué aprendizajes existen ni si la posición es transitable: eso lo hace reconcileProgress con la
 * configuración. Nunca se confía en JSON previo sin pasar por aquí.
 */
export function parseSavedProgress(raw: unknown): SavedProgress | null {
  if (!isObject(raw) || raw.schemaVersion !== 3) return null;
  const { contentSetId, mode, currentZoneId } = raw;
  if (typeof contentSetId !== "string" || !contentSetId || (mode !== "demo" && mode !== "final") || typeof currentZoneId !== "string" || !currentZoneId) return null;
  const player = point(raw.player);
  if (!player || !isObject(raw.checkpoints) || !isObject(raw.entries)) return null;

  const checkpoints: Record<string, Point> = {};
  for (const [zone, value] of Object.entries(raw.checkpoints)) {
    const p = point(value);
    if (p) checkpoints[zone] = p;
  }
  const entries: Record<string, LearningProgress> = {};
  for (const [id, value] of Object.entries(raw.entries)) {
    if (!isObject(value) || !Number.isInteger(value.contentRevision) || (value.contentRevision as number) < 1 || !Array.isArray(value.readSectionIds)) continue;
    const read = SECTION_IDS.filter((s) => (value.readSectionIds as unknown[]).includes(s));
    const last = SECTION_IDS.find((s) => s === value.lastSectionId);
    entries[id] = {
      contentRevision: value.contentRevision as number,
      readSectionIds: [...read],
      ...(last ? { lastSectionId: last } : {}),
      ...(validDate(value.completedAt) ? { completedAt: value.completedAt } : {}),
    };
  }
  return { schemaVersion: 3, contentSetId, mode, currentZoneId, player, checkpoints, entries };
}

export interface LoadResult {
  saved: SavedProgress | null;
  /** false si localStorage no existe, está bloqueado o lanzó un error: se continúa en memoria. */
  available: boolean;
}

/**
 * Adaptador de almacenamiento. Pertenece a la aplicación: Phaser no escribe localStorage. Toda lectura y
 * escritura va en try/catch (el acceso a `localStorage` puede lanzar con cookies bloqueadas, modo privado
 * o cuota agotada) y un fallo nunca destruye datos válidos ni interrumpe la lectura.
 */
export class ProgressStorage {
  constructor(private readonly resolve: () => StorageLike | null = defaultStorage) {}

  load(contentSetId: string, mode: AppMode): LoadResult {
    let storage: StorageLike | null;
    try {
      storage = this.resolve();
    } catch {
      storage = null;
    }
    if (!storage) return { saved: null, available: false };
    try {
      const text = storage.getItem(storageKey(contentSetId, mode));
      return { saved: text === null ? null : parseSavedProgress(JSON.parse(text)), available: true };
    } catch {
      // JSON corrupto o lectura fallida: se ignora sin borrarlo; el siguiente guardado lo sustituye.
      return { saved: null, available: true };
    }
  }

  /** Devuelve false si no se pudo escribir (el avance seguirá solo en memoria). */
  save(state: SavedProgress): boolean {
    try {
      const storage = this.resolve();
      if (!storage) return false;
      storage.setItem(storageKey(state.contentSetId, state.mode), JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  /** Borra solo la clave de esta bitácora y este modo, nunca el almacenamiento del origen. */
  clear(contentSetId: string, mode: AppMode): boolean {
    try {
      this.resolve()?.removeItem(storageKey(contentSetId, mode));
      return true;
    } catch {
      return false;
    }
  }
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // el simple acceso puede lanzar SecurityError
  }
}
