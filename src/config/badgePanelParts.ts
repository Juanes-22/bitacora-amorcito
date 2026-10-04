/**
 * Las piezas del kit de interfaz del panel de insignias (`kind` «badge-panel-part» en `assets.json`) que usan el componente y
 * su CSS. Se piden con el prefijo de `ui.badgePanel.assetPrefix`; `validateConfig` comprueba que existan todas.
 */
export const BADGE_PANEL_PARTS = [
  "panel-frame", "card-earned", "card-earned-hover", "card-pending", "card-special", "card-display",
  "button-close", "button-close-hover", "button-back", "button-back-hover", "button-primary", "button-primary-hover", "button-secondary", "button-secondary-hover",
  "label-earned", "label-pending", "label-special", "label-xp", "progress-capsule", "card-hover-footer", "reflection-callout", "lesson-callout",
  "check-white", "lock-seal", "calendar", "book-brown", "book-cream", "sprout", "heart-green", "xp-star", "paw-lavender", "chevron-left", "chevron-right", "sparkle-gold",
  "branch-green-left", "branch-green-right", "branch-muted-left", "branch-muted-right", "branch-lavender-left", "branch-lavender-right",
  "flowers-bottom-left", "flowers-bottom-right", "halo-jade", "halo-gold", "halo-lavender", "progress-filled", "progress-empty",
  "divider-line-left", "divider-diamond", "divider-line-right",
] as const;

export type BadgePanelPart = (typeof BADGE_PANEL_PARTS)[number];

/** Variables permitidas en las plantillas de los textos del panel. */
export const BADGE_PANEL_TEMPLATE_VARIABLES = {
  obtainedTemplate: ["completedCount", "totalCount"],
  completingTemplate: ["number"],
  completeTemplate: ["number"],
  xpTemplate: ["xp"],
} as const;
