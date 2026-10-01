import type { BitacoraConfig, Point } from "../config/types";
import { bodyRadius, isSafePoint } from "./geometry";
import { emptyEntry } from "./progression";
import { SECTION_IDS, type LearningProgress, type SavedProgress } from "./types";

/** Punto de partida configurado para el modo actual. */
function startPoint(config: BitacoraConfig): Point {
  const { zoneId, spawnId } = config.gameplay.start;
  const zone = config.maps[zoneId];
  return zone.spawns[spawnId] ?? zone.spawns[zone.initialSpawnId];
}

export function initialProgress(config: BitacoraConfig): SavedProgress {
  return {
    schemaVersion: 3,
    contentSetId: config.contentSetId,
    mode: config.mode,
    currentZoneId: config.gameplay.start.zoneId,
    player: { ...startPoint(config) },
    checkpoints: {},
    entries: Object.fromEntries(config.route.map((id) => [id, emptyEntry(config.learnings[id])])),
  };
}

const validDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Reconcilia el guardado con la configuración vigente (SPEC 13.2). Función pura: no escribe nada.
 * - Mover estaciones, reordenar `route` o cambiar `configRevision` no toca el avance.
 * - Un aprendizaje nuevo recibe una entrada vacía; uno retirado conserva la suya (archivada) sin contar.
 * - Una `contentRevision` distinta invalida solo las secciones y la finalización de ese aprendizaje.
 * - Un guardado de otro `contentSetId` o de otro modo se ignora (demo y final no se mezclan).
 * - La posición se valida contra la zona actual; si ya no es transitable se usa un punto seguro.
 */
export function reconcileProgress(config: BitacoraConfig, saved: SavedProgress | null): SavedProgress {
  if (!saved || saved.contentSetId !== config.contentSetId || saved.mode !== config.mode) return initialProgress(config);

  const tabIds = new Set(config.ui.tabs.map((t) => t.id));
  const required = config.ui.tabs.filter((t) => t.required).map((t) => t.id);
  const entries: Record<string, LearningProgress> = {};

  for (const [id, raw] of Object.entries(saved.entries)) {
    const learning = config.learnings[id];
    if (!learning) continue; // ID que ya no existe en ninguna parte: no se reutiliza ni se conserva
    if (raw.contentRevision !== learning.contentRevision) {
      entries[id] = emptyEntry(learning); // revisión sustancial: solo este aprendizaje se reinicia
      continue;
    }
    const read = SECTION_IDS.filter((s) => tabIds.has(s) && raw.readSectionIds.includes(s));
    const completedAt = validDate(raw.completedAt) ? raw.completedAt : undefined;
    entries[id] = {
      contentRevision: raw.contentRevision,
      // Una insignia recogida implica haber marcado las secciones requeridas.
      readSectionIds: completedAt ? SECTION_IDS.filter((s) => read.includes(s) || required.includes(s)) : read,
      ...(raw.lastSectionId && tabIds.has(raw.lastSectionId) ? { lastSectionId: raw.lastSectionId } : {}),
      ...(completedAt ? { completedAt } : {}),
    };
  }
  for (const id of config.route) entries[id] ??= emptyEntry(config.learnings[id]);

  const radius = bodyRadius(config);
  const zoneExists = !!config.maps[saved.currentZoneId];
  const currentZoneId = zoneExists ? saved.currentZoneId : config.gameplay.start.zoneId;
  const zone = config.maps[currentZoneId];
  const fallback = zoneExists ? zone.spawns[zone.initialSpawnId] : startPoint(config);
  const player = zoneExists && isSafePoint(zone, saved.player, radius) ? { ...saved.player } : { ...fallback };
  const checkpoints = Object.fromEntries(
    Object.entries(saved.checkpoints).filter(([zid, p]) => config.maps[zid] && isSafePoint(config.maps[zid], p, radius)),
  );

  return { schemaVersion: 3, contentSetId: config.contentSetId, mode: config.mode, currentZoneId, player, checkpoints, entries };
}
