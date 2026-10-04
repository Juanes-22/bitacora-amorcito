import type { AppMode, Point, SectionId } from "../config/types";

export const SECTION_IDS: readonly SectionId[] = ["learning", "reflection", "lived"];

/** Avance de un aprendizaje, por ID estable. La revisión permite saber si sigue vigente (SPEC 13.1). */
export interface LearningProgress {
  contentRevision: number;
  readSectionIds: SectionId[];
  lastSectionId?: SectionId;
  /** ISO 8601. Presente solo si la insignia se recogió con esta revisión. */
  completedAt?: string;
}

/**
 * Contrato del guardado (SPEC 13.1). No contiene totales, XP, insignias aparte ni el siguiente
 * aprendizaje: todo eso se deriva de `entries` y de la configuración.
 */
export interface SavedProgress {
  schemaVersion: 3;
  contentSetId: string;
  mode: AppMode;
  currentZoneId: string;
  /** Pies de Vanessa en coordenadas del mundo. */
  player: Point;
  checkpoints: Record<string, Point>;
  entries: Record<string, LearningProgress>;
}

export type Denial = "unknown-learning" | "locked" | "not-admissible" | "unknown-section" | "incomplete";

/** Resultado de una transición pura: `changed` es false cuando la operación ya estaba aplicada. */
export type Transition = { ok: true; state: SavedProgress; changed: boolean } | { ok: false; reason: Denial };
