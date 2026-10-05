/**
 * Las piezas del kit de la presentación (`kind` «presentation-part» en `assets.json`) que usa la portada. Se piden con el prefijo de
 * `ui.presentation.assetPrefix`; `validateConfig` comprueba que existan todas. Los marcos son imágenes de nueve zonas: sus cortes salen
 * del manifiesto (`nineSlice`) y llegan al CSS como variables (`--prs-<pieza>` y `--prs-<pieza>-slice`).
 */
export const PRESENTATION_PARTS = [
  "panel-parchment", "title-wood-flowers", "welcome-vanessa-jerry", "button-continue", "leaf-sprig", "divider-seed", "sprout-flat",
] as const;

export type PresentationPart = (typeof PRESENTATION_PARTS)[number];
