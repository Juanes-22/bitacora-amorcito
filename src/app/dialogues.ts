import { blockingLearningId, completedIds, summarize } from "../domain/progression";
import { renderTemplate } from "../domain/templates";
import type { SavedProgress } from "../domain/types";
import type { BitacoraConfig, DialogueEvent } from "../config/types";

export interface DialogueLine {
  speaker: "vanessa" | "narrator";
  text: string;
}

/**
 * Líneas de un diálogo ya con sus variables sustituidas (SPEC 12.7). El mensaje sale de
 * `learnings[id].dialogueOverrides[event]` o, si no hay, de `ui.defaultDialogueIds[event]`. El controlador
 * calcula los valores; las cadenas nunca ejecutan expresiones.
 */
export function dialogueLines(config: BitacoraConfig, state: SavedProgress, learningId: string, event: DialogueEvent): DialogueLine[] {
  const learning = config.learnings[learningId];
  const dialogueId = learning.dialogueOverrides?.[event] ?? config.ui.defaultDialogueIds[event];
  const done = completedIds(config, state.entries);
  const blocking = blockingLearningId(config.route, done, learningId);
  const summary = summarize(config, state);
  const values = {
    studentName: config.project.studentName,
    learningTitle: learning.title,
    previousLearningTitle: blocking ? (config.learnings[blocking]?.title ?? "") : "",
    badgeTitle: config.badges[learning.badgeId]?.title ?? "",
    completedCount: summary.completedCount,
    totalCount: summary.totalCount,
  };
  return config.dialogues[dialogueId].lines.map((l) => ({ speaker: l.speaker, text: renderTemplate(l.text, values) }));
}
