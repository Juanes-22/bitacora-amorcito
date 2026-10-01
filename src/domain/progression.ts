// Reglas puras del recorrido (SPEC 8 y 12.8). Sin React, Phaser, eventos ni almacenamiento:
// las transiciones reciben un estado y devuelven otro; los efectos (guardar, celebrar) los ejecuta
// el controlador de aplicación solo cuando `changed` es verdadero.

import type { BitacoraConfig, Learning, SectionId } from "../config/types";
import { SECTION_IDS, type LearningProgress, type SavedProgress, type Transition } from "./types";

export type StationState = "locked" | "available" | "completed";

/**
 * Una estación completada permite relectura. Una pendiente solo está disponible si TODAS las
 * anteriores del recorrido activo están completadas; no se asume que lo completado sea un prefijo.
 */
export function stationStates(route: readonly string[], completed: ReadonlySet<string>): Record<string, StationState> {
  const states: Record<string, StationState> = {};
  let previousAllDone = true;
  for (const id of route) {
    const done = completed.has(id);
    states[id] = done ? "completed" : previousAllDone ? "available" : "locked";
    previousAllDone &&= done;
  }
  return states;
}

/** Primer aprendizaje activo sin completar; `null` si la ruta está vacía o terminada. */
export function nextLearningId(route: readonly string[], completed: ReadonlySet<string>): string | null {
  return route.find((id) => !completed.has(id)) ?? null;
}

/** Número visible (1-based) derivado de `route`; 0 si el ID no está activo. */
export function stationNumber(route: readonly string[], id: string): number {
  return route.indexOf(id) + 1;
}

/** Aprendizaje pendiente más cercano antes de `id`: lo que hay que recorrer primero. */
export function blockingLearningId(route: readonly string[], completed: ReadonlySet<string>, id: string): string | null {
  const index = route.indexOf(id);
  if (index < 0) return null;
  return route.slice(0, index).find((previous) => !completed.has(previous)) ?? null;
}

// ---- avance de lectura --------------------------------------------------------

export function emptyEntry(learning: Learning): LearningProgress {
  return { contentRevision: learning.contentRevision, readSectionIds: [] };
}

/** La entrada vigente de un aprendizaje: una revisión distinta no cuenta (SPEC 13.2). */
export function currentEntry(state: SavedProgress, config: BitacoraConfig, id: string): LearningProgress {
  const learning = config.learnings[id];
  const entry = state.entries[id];
  return entry && learning && entry.contentRevision === learning.contentRevision ? entry : emptyEntry(learning);
}

export function isEntryCompleted(entry: LearningProgress | undefined, learning: Learning | undefined): boolean {
  return !!entry && !!learning && entry.completedAt !== undefined && entry.contentRevision === learning.contentRevision;
}

/** IDs de la ruta activa con finalización vigente. Los archivados nunca cuentan. */
export function completedIds(config: BitacoraConfig, entries: SavedProgress["entries"]): Set<string> {
  return new Set(config.route.filter((id) => isEntryCompleted(entries[id], config.learnings[id])));
}

export function requiredSectionIds(config: BitacoraConfig): SectionId[] {
  return config.ui.tabs.filter((t) => t.required).map((t) => t.id);
}

/** En demo todo contenido activo es admisible; en final solo el aprobado (`ready`), SPEC 10. */
export function isAdmissible(config: BitacoraConfig, id: string): boolean {
  const learning = config.learnings[id];
  return !!learning && (config.mode === "demo" || learning.editorialStatus === "ready");
}

/** Aprendizajes ACTIVOS no admisibles en el modo actual (en final: los que no están `ready`). Vacío en demo. */
export function unapprovedIds(config: BitacoraConfig): string[] {
  return config.route.filter((id) => !isAdmissible(config, id));
}

export function stationStatesOf(config: BitacoraConfig, state: SavedProgress): Record<string, StationState> {
  return stationStates(config.route, completedIds(config, state.entries));
}

export function readSections(state: SavedProgress, config: BitacoraConfig, id: string): SectionId[] {
  return currentEntry(state, config, id).readSectionIds;
}

export function allRequiredRead(state: SavedProgress, config: BitacoraConfig, id: string): boolean {
  const read = new Set(readSections(state, config, id));
  return requiredSectionIds(config).every((s) => read.has(s));
}

function withEntry(state: SavedProgress, id: string, entry: LearningProgress): SavedProgress {
  return { ...state, entries: { ...state.entries, [id]: entry } };
}

/** Comprobaciones comunes de acceso: ID activo, no bloqueado y admisible en el modo actual. */
function gate(config: BitacoraConfig, state: SavedProgress, id: string): "unknown-learning" | "locked" | "not-admissible" | null {
  if (!config.route.includes(id) || !config.learnings[id]) return "unknown-learning";
  const access = stationStatesOf(config, state)[id];
  if (access === "completed") return null; // la relectura siempre está disponible
  if (access === "locked") return "locked";
  return isAdmissible(config, id) ? null : "not-admissible";
}

/**
 * «Marcar sección como leída». Idempotente: repetirla no cambia nada. Abrir una pestaña NO la marca;
 * solo esta acción explícita registra la lectura (SPEC 8).
 */
export function markSectionRead(state: SavedProgress, config: BitacoraConfig, id: string, section: SectionId): Transition {
  const denied = gate(config, state, id);
  if (denied) return { ok: false, reason: denied };
  if (!SECTION_IDS.includes(section) || !config.ui.tabs.some((t) => t.id === section)) return { ok: false, reason: "unknown-section" };
  const entry = currentEntry(state, config, id);
  if (entry.readSectionIds.includes(section) || isEntryCompleted(entry, config.learnings[id])) {
    return { ok: true, state, changed: false };
  }
  const next: LearningProgress = { ...entry, readSectionIds: [...entry.readSectionIds, section], lastSectionId: section };
  return { ok: true, state: withEntry(state, id, next), changed: true };
}

/** Recuerda la pestaña activa (conveniencia de navegación; no cuenta como lectura). */
export function setActiveSection(state: SavedProgress, config: BitacoraConfig, id: string, section: SectionId): SavedProgress {
  if (!config.route.includes(id) || !config.ui.tabs.some((t) => t.id === section)) return state;
  const entry = currentEntry(state, config, id);
  return entry.lastSectionId === section ? state : withEntry(state, id, { ...entry, lastSectionId: section });
}

/**
 * «Recoger insignia y continuar»: una única transición marca la estación como completada y registra la
 * fecha. Repetirla (doble clic, tecla mantenida, relectura) devuelve `changed: false` y no concede nada.
 * La celebración y el guardado solo corresponden cuando `changed` es verdadero.
 */
export function claimBadge(state: SavedProgress, config: BitacoraConfig, id: string, now: Date): Transition {
  const denied = gate(config, state, id);
  if (denied) return { ok: false, reason: denied };
  const entry = currentEntry(state, config, id);
  if (isEntryCompleted(entry, config.learnings[id])) return { ok: true, state, changed: false };
  if (!allRequiredRead(state, config, id)) return { ok: false, reason: "incomplete" };
  return { ok: true, state: withEntry(state, id, { ...entry, completedAt: now.toISOString() }), changed: true };
}

// ---- totales derivados (nunca se guardan) -----------------------------------------

export interface ProgressSummary {
  completedCount: number;
  totalCount: number;
  xp: number;
  maxXp: number;
  /** Nivel de recorrido = insignias obtenidas (SPEC 8); no es una evaluación académica. */
  level: number;
  nextLearningId: string | null;
  /** La ruta no está vacía, todos sus aprendizajes tienen finalización vigente y ninguno está sin aprobar. */
  finished: boolean;
  /** Aprendizajes activos sin aprobar (solo en modo final). */
  pendingCount: number;
  /** Modo final con contenido sin aprobar: se presenta como «en preparación», no como entrega terminada (SPEC 10). */
  inPreparation: boolean;
}

export function summarize(config: BitacoraConfig, state: SavedProgress): ProgressSummary {
  const done = completedIds(config, state.entries);
  const xpOf = (id: string) => config.badges[config.learnings[id].badgeId]?.xp ?? 0;
  const completedCount = config.route.filter((id) => done.has(id)).length;
  const pendingCount = unapprovedIds(config).length;
  return {
    completedCount,
    totalCount: config.route.length,
    xp: config.route.filter((id) => done.has(id)).reduce((sum, id) => sum + xpOf(id), 0),
    maxXp: config.route.reduce((sum, id) => sum + xpOf(id), 0),
    level: completedCount,
    nextLearningId: nextLearningId(config.route, done),
    finished: config.route.length > 0 && completedCount === config.route.length && pendingCount === 0,
    pendingCount,
    inPreparation: config.mode === "final" && pendingCount > 0,
  };
}
