/**
 * Las piezas de interfaz de la Bitácora de aprendizajes (índice y lector) del kit `bitacora-panel-aprendizajes`. Las propias
 * (`kind` «journal-panel-part») se piden con el prefijo de `ui.journalPanel.assetPrefix`; las compartidas con el panel de
 * insignias (`kind` «badge-panel-part»), con el de `ui.badgePanel.assetPrefix`. `validateConfig` comprueba que existan todas.
 */
export const JOURNAL_PANEL_PARTS = [
  "learning-plants-seeds", "learning-homemade-dough", "learning-taxidermy-museum", "learning-penguin-adaptation", "learning-earth-movements", "learning-plants-origin",
  "journal-book-sprout", "zone-cherry-tree", "zone-white-flowers", "tab-reflection-bubble", "ribbon-next-blank",
] as const;

export const JOURNAL_PANEL_SHARED_PARTS = [
  "panel-frame", "card-pending", "card-earned", "card-earned-hover", "button-close", "button-close-hover", "button-primary", "button-primary-hover",
  "button-secondary", "button-secondary-hover", "label-earned", "label-pending", "label-xp", "progress-capsule", "progress-filled", "progress-empty",
  "check-white", "lock-seal", "book-brown", "book-cream", "sprout", "chevron-left", "chevron-right", "sparkle-gold",
  "branch-green-left", "branch-green-right", "branch-muted-left", "branch-muted-right",
] as const;

export type JournalPanelPart = (typeof JOURNAL_PANEL_PARTS)[number];
export type JournalPanelSharedPart = (typeof JOURNAL_PANEL_SHARED_PARTS)[number];

/** Variables permitidas en las plantillas de los textos del panel. */
export const JOURNAL_PANEL_TEMPLATE_VARIABLES = {
  progressTemplate: ["completed", "total"],
  groupRangeTemplate: ["from", "to"],
  groupSingleTemplate: ["number"],
  cardNumberTemplate: ["number"],
  requirementTemplate: ["previous"],
  readerSubtitleTemplate: ["number", "zone"],
  badgeInstructionTemplate: ["count"],
  sectionsReadTemplate: ["read", "total"],
  readingTemplate: ["section"],
  seeSectionTemplate: ["section"],
} as const;
