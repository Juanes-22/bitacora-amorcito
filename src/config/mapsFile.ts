import type { BitacoraConfig, BitacoraContent, ConfigIssue, MapsFile } from "./types";

/**
 * La configuración vive en dos archivos: `bitacora.json` (contenido: textos, ruta, insignias, diálogos, interfaz) y `maps.json` (la
 * geometría que administra Tiled). En memoria, y para todo el código que la usa, es un solo objeto `BitacoraConfig` con `maps` y
 * `placements` en el primer nivel: estas funciones convierten entre ambas formas.
 */

export const CONTENT_FILE = "bitacora.json" as const;
export const MAPS_FILE = "maps.json" as const;

export function mergeConfig(content: BitacoraContent, mapsFile: Pick<MapsFile, "placements" | "maps">): BitacoraConfig {
  return { ...content, placements: mapsFile.placements, maps: mapsFile.maps };
}

export function splitConfig(config: BitacoraConfig): { content: BitacoraContent; mapsFile: MapsFile } {
  const { placements, maps, ...content } = config;
  return { content, mapsFile: { placements, maps } };
}

/** En qué archivo está lo que señala una ruta de error de la configuración (`maps.zona-a.layers[0]`, `route[2]`...). */
export function configFileOf(path: string | ConfigIssue): typeof CONTENT_FILE | typeof MAPS_FILE {
  if (typeof path !== "string") return path.file ?? configFileOf(path.path);
  return /^(maps|placements)(\.|\[|$)/.test(path) ? MAPS_FILE : CONTENT_FILE;
}
