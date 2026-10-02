// Plantillas de texto del JSON: solo variables de una lista permitida, nunca expresiones (SPEC 12.7).

export const DIALOGUE_VARIABLES = [
  "studentName", "learningTitle", "previousLearningTitle", "badgeTitle", "completedCount", "totalCount",
] as const;
export type DialogueVariable = (typeof DIALOGUE_VARIABLES)[number];

/** Variables permitidas en cada plantilla de `ui.labels` (las demás etiquetas no admiten variables). */
export const LABEL_TEMPLATE_VARIABLES = {
  progressTemplate: ["completedCount", "totalCount"],
  stationTitleTemplate: ["number", "title"],
  remainingTemplate: ["remaining"],
  xpTemplate: ["xp", "maxXp"],
  levelTemplate: ["level"],
  earnedOnTemplate: ["date"],
  badgeCountTemplate: ["completedCount", "totalCount"],
  preparationTemplate: ["pending"],
} as const;

/** Sustituye `{nombre}` solo si está en `values`; una variable desconocida se deja tal cual. */
export function renderTemplate(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([^{}]*)\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );
}

export function variablesIn(template: string): string[] {
  return [...template.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
}
