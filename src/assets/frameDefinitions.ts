// Definiciones de frames de las hojas de poses (SPEC 3.1). NO forman parte de assets.json y no lo
// modifican: cada una referencia el assetId real del catálogo.
//
// La hoja de caminar NO es una cuadrícula regular: hay poses cuyo contenido cruza los límites
// nominales de 362 px (p. ej. el cabello de la fila «up» empieza en y=1081 y la cola de Jerry de
// «left» llega a x=368). Por eso cada frame es la caja real de su pose con 4 px de margen
// transparente. Valores medidos con scripts/tools/derive-frames.py sobre el archivo y comprobados
// contra la imagen en scripts/frame-definitions.test.ts y en `npm run validate:config`.
//
// `feetX`/`feetY` son el punto de apoyo (suelo bajo Vanessa) dentro del recorte, en píxeles de la
// textura; se usan como pivote del frame para que no «salte» al cambiar de pose.

import type { FrameDefinitions } from "../config/types";

export interface FrameSpec {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  feetX: number;
  feetY: number;
}

export interface AnimationSpec {
  frames: readonly string[];
  frameRate: number;
  /** -1 = bucle. */
  repeat: number;
  /** Pose con la que se queda el personaje al detenerse. */
  restFrame?: string;
  /** Pose estática que se muestra en lugar de animar cuando se pide movimiento reducido. */
  stillFrame?: string;
}

export interface SheetDefinition {
  assetId: string;
  /** Multiplica la escala del actor: las hojas se dibujaron a distinto tamaño y Vanessa debe medir lo mismo. */
  scale?: number;
  frames: readonly FrameSpec[];
  animations: Readonly<Record<string, AnimationSpec>>;
}

export const WALK_SHEET_ID = "character.vanessa-jerry.walk.poses-v4";

const walkFrames: readonly FrameSpec[] = [
  { name: "down-0", x: 66, y: 20, width: 261, height: 328, feetX: 115, feetY: 324 },
  { name: "down-1", x: 433, y: 20, width: 257, height: 328, feetX: 106, feetY: 324 },
  { name: "down-2", x: 794, y: 20, width: 259, height: 328, feetX: 110, feetY: 324 },
  { name: "left-0", x: 75, y: 374, width: 298, height: 329, feetX: 85, feetY: 325 },
  { name: "left-1", x: 434, y: 374, width: 296, height: 330, feetX: 88, feetY: 326 },
  { name: "left-2", x: 800, y: 374, width: 284, height: 330, feetX: 87, feetY: 326 },
  { name: "right-0", x: 74, y: 727, width: 293, height: 335, feetX: 108, feetY: 331 },
  { name: "right-1", x: 422, y: 727, width: 304, height: 335, feetX: 111, feetY: 331 },
  { name: "right-2", x: 792, y: 727, width: 290, height: 335, feetX: 105, feetY: 331 },
  { name: "up-0", x: 60, y: 1080, width: 289, height: 344, feetX: 109, feetY: 340 },
  { name: "up-1", x: 422, y: 1078, width: 289, height: 346, feetX: 113, feetY: 342 },
  { name: "up-2", x: 786, y: 1077, width: 281, height: 347, feetX: 114, feetY: 343 },
];

/** Cada fila es una dirección (rowDirections del manifiesto); la columna central es la pose de pie. */
const walkAnimation = (dir: string): AnimationSpec => ({
  frames: [`${dir}-0`, `${dir}-1`, `${dir}-2`, `${dir}-1`],
  frameRate: 8,
  repeat: -1,
  restFrame: `${dir}-1`,
});

export const CELEBRATE_SHEET_ID = "character.vanessa-jerry.celebrate-jump.poses";

// Hoja de celebración (3×2, medida con `derive-frames.py --sheet celebrate`): las poses se separan por los
// huecos transparentes reales; la chispa que acompaña a la pose 2 forma parte de su recorte. Vanessa mide ~390 px
// aquí y ~320 px en la hoja de caminar: `scale` 0.82 iguala su altura en pantalla.
const celebrateFrames: readonly FrameSpec[] = [
  { name: "celebrate-0", x: 96, y: 82, width: 336, height: 405, feetX: 124, feetY: 401 },
  { name: "celebrate-1", x: 576, y: 82, width: 384, height: 406, feetX: 145, feetY: 402 },
  { name: "celebrate-2", x: 1098, y: 84, width: 374, height: 405, feetX: 130, feetY: 401 },
  { name: "celebrate-3", x: 69, y: 539, width: 421, height: 415, feetX: 166, feetY: 411 },
  { name: "celebrate-4", x: 587, y: 557, width: 388, height: 397, feetX: 137, feetY: 393 },
  { name: "celebrate-5", x: 1102, y: 558, width: 356, height: 398, feetX: 123, feetY: 394 },
];

export const frameDefinitions: Readonly<Record<string, SheetDefinition>> = {
  [CELEBRATE_SHEET_ID]: {
    assetId: CELEBRATE_SHEET_ID,
    scale: 0.82,
    frames: celebrateFrames,
    animations: {
      // Sin salto real en el arte: las poses 3 y 4 (brazos arriba, estrellas) son el punto álgido.
      "vanessa-celebrate": { frames: ["celebrate-0", "celebrate-1", "celebrate-2", "celebrate-3", "celebrate-4", "celebrate-5"], frameRate: 6, repeat: 0, restFrame: "celebrate-5", stillFrame: "celebrate-3" },
    },
  },
  [WALK_SHEET_ID]: {
    assetId: WALK_SHEET_ID,
    frames: walkFrames,
    animations: {
      "vanessa-idle": { frames: ["down-1"], frameRate: 1, repeat: -1, restFrame: "down-1" },
      "vanessa-walk-down": walkAnimation("down"),
      "vanessa-walk-left": walkAnimation("left"),
      "vanessa-walk-right": walkAnimation("right"),
      "vanessa-walk-up": walkAnimation("up"),
    },
  },
};

/** Forma que consume validateBitacora: qué animaciones están validadas por assetId. */
export function toValidatedFrames(defs: Readonly<Record<string, SheetDefinition>> = frameDefinitions): FrameDefinitions {
  return Object.fromEntries(Object.entries(defs).map(([id, d]) => [id, { animations: Object.keys(d.animations) }]));
}

/** Hoja y especificación de una animación por su ID (los IDs son únicos entre hojas). */
export function findAnimation(animId: string): { sheet: SheetDefinition; spec: AnimationSpec } | undefined {
  for (const sheet of Object.values(frameDefinitions)) {
    const spec = sheet.animations[animId];
    if (spec) return { sheet, spec };
  }
  return undefined;
}
