import type { TiledProperty } from "./types";

/** Tolerancia numérica de las conversiones de coordenadas y tamaños (píxeles del mundo). */
export const TOLERANCE = 1e-6;

/**
 * Quita el ruido de coma flotante de una conversión (p. ej. 1.1500000000000001 → 1.15) sin perder datos: nueve decimales
 * están muy por debajo de la tolerancia y de cualquier posición que Tiled pueda guardar.
 */
export const clean = (n: number): number => {
  const r = Math.round(n * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
};

/**
 * Quita el ruido de coma flotante (~1e-13) de lo que se escribe en los mapas de Tiled, con 12 decimales: así el archivo no
 * lleva números como 1109.9999999999998 y, al volver a importar (nueve decimales), no se acumula ningún error.
 */
export const tidy = (n: number): number => {
  const r = Math.round(n * 1e12) / 1e12;
  return Object.is(r, -0) ? 0 : r;
};

export const near = (a: number, b: number, tol = TOLERANCE): boolean => Math.abs(a - b) <= tol;

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// -- Banderas del GID de un tile (https://doc.mapeditor.org/en/stable/reference/global-tile-ids/) ------------------------

const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;
const ROT_HEX_120 = 0x10000000;

export interface DecodedGid {
  /** GID real del tile, sin banderas. */
  gid: number;
  flipH: boolean;
  flipV: boolean;
  flipD: boolean;
  rotHex120: boolean;
}

/** Separa el GID real de sus banderas de reflejo/rotación (se manejan sin operadores de bits con signo). */
export function decodeGid(raw: number): DecodedGid {
  let rest = raw >>> 0;
  const take = (flag: number): boolean => {
    if (rest >= flag) {
      rest -= flag;
      return true;
    }
    return false;
  };
  const flipH = take(FLIP_H);
  const flipV = take(FLIP_V);
  const flipD = take(FLIP_D);
  const rotHex120 = take(ROT_HEX_120);
  return { gid: rest, flipH, flipV, flipD, rotHex120 };
}

export const encodeGid = (gid: number, flipH = false): number => (gid + (flipH ? FLIP_H : 0)) >>> 0;

// -- Propiedades --------------------------------------------------------------------------------------------------------------

export interface Prop {
  type: string;
  value: unknown;
  /** De dónde viene el valor al resolverlo: el objeto, su tile o el valor por defecto de su clase. */
  from?: "object" | "tile" | "class";
}
export type PropMap = Map<string, Prop>;

const inferType = (v: unknown): string => (typeof v === "number" ? (Number.isInteger(v) ? "int" : "float") : typeof v === "boolean" ? "bool" : "string");

export function propsOf(list: TiledProperty[] | undefined): PropMap {
  const map: PropMap = new Map();
  for (const p of list ?? []) map.set(p.name, { type: p.type ?? inferType(p.value), value: p.value });
  return map;
}

export function prop(name: string, value: string | number | boolean, enumType?: string): TiledProperty {
  const type = inferType(value) as TiledProperty["type"];
  return enumType ? { name, type, propertytype: enumType, value } : { name, type, value };
}

/** Nombre de la clase de un objeto, capa, tile o mapa: `class` (Tiled ≥ 1.9) o `type` (anteriores). */
export const classOf = (o: { class?: string; type?: string }, legacyTypeAllowed = true): string => {
  if (o.class) return o.class;
  return legacyTypeAllowed && o.type && !["tilelayer", "objectgroup", "imagelayer", "group", "map", "tileset"].includes(o.type) ? o.type : "";
};

/** Alineación de los objetos-tile → fracción del tamaño que hay entre la esquina superior izquierda y el punto (x, y) guardado. */
export const ALIGNMENT: Record<string, { x: number; y: number }> = {
  topleft: { x: 0, y: 0 },
  top: { x: 0.5, y: 0 },
  topright: { x: 1, y: 0 },
  left: { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  right: { x: 1, y: 0.5 },
  bottomleft: { x: 0, y: 1 },
  bottom: { x: 0.5, y: 1 },
  bottomright: { x: 1, y: 1 },
};

/** Sin `objectalignment`, Tiled usa abajo a la izquierda en mapas ortogonales. */
export const alignmentOf = (name: string | undefined): { x: number; y: number } => ALIGNMENT[name ?? "unspecified"] ?? ALIGNMENT.bottomleft;
