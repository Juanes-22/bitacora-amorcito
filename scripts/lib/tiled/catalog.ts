import { AMBIENT_KINDS, AMBIENT_MOTION, KINDS } from "../../../src/config/validateConfig";
import type { AssetEntry, AssetManifest, BitacoraConfig } from "../../../src/config/types";
import type { TiledProperty, TiledTile, TiledTileset } from "./types";
import { prop } from "./util";

// Qué assets del manifiesto puede colocar el editor y cómo se dibujan. Las reglas de compatibilidad son las de
// validateConfig (misma tabla de `kind` y `motion`): el catálogo no inventa usos que el juego no soporta.

export type Role = "ambient" | "decoration" | "critter" | "station";
export type AmbientKind = "animation" | "sway" | "drift" | "glow" | "swim" | "particles";

/** Clase de Tiled (objeto y tile) de cada rol. */
export const ROLE_CLASS: Record<Role, string> = { ambient: "Ambient", decoration: "Decoration", critter: "Critter", station: "Station" };
export const CLASS_ROLE: Record<string, Role> = { Ambient: "ambient", Decoration: "decoration", Critter: "critter", Station: "station" };

export const TILESET_NAME = "catalogo";

/** Tipo de efecto ambiental que le corresponde a un asset por su `kind` y su `motion` (los mismos requisitos que validateConfig). */
export function ambientKindOf(entry: AssetEntry): AmbientKind | null {
  if (entry.type !== "image") return null;
  if (AMBIENT_KINDS.animation.includes(entry.kind as never) && entry.atlasPath && entry.animation) return entry.motion?.type === "swim" ? "swim" : "animation";
  for (const type of ["sway", "drift", "glow", "particles"] as const) {
    if ((AMBIENT_KINDS[type] as readonly string[]).includes(entry.kind) && entry.motion?.type === AMBIENT_MOTION[type]) return type;
  }
  return null;
}

/** ¿Es una hoja con atlas (un fotograma se dibuja con su región) y no una imagen entera? */
export const isSheet = (entry: AssetEntry): boolean => Boolean(entry.atlasPath);

/** Geometría de un asset: lienzo lógico que dibuja Phaser, tamaño visual con multiplicador 1 y punto de anclaje. */
export interface Geometry {
  logicalW: number;
  logicalH: number;
  baseW: number;
  baseH: number;
  origin: { x: number; y: number };
}

/** Escala por defecto de una decoración nueva cuando el asset no recomienda ninguna: que su lado mayor mida unos 128 px. */
const DECORATION_FALLBACK_SIDE = 128;

/** Escala con la que se dibuja una decoración nueva (`decoration.scale` es un dato obligatorio: aquí solo se sugiere). */
export function defaultDecorationScale(entry: AssetEntry): number {
  if (entry.recommendedScale) return entry.recommendedScale;
  if (entry.recommendedDisplay && entry.width) return entry.recommendedDisplay.width / entry.width;
  return Math.min(1, DECORATION_FALLBACK_SIDE / Math.max(entry.width ?? 1, entry.height ?? 1));
}

/**
 * Geometría que aplica el juego a `entry` cuando cumple `role`. Devuelve `null` si le falta metadata para colocarlo.
 *
 * - ambient: lienzo lógico × `recommendedScale` (AmbientBuilder); origen del manifiesto o el centro.
 * - critter: `recommendedDisplay.width / sourceFrameSize.width` (CritterBuilder); origen del manifiesto o los pies.
 * - station: imagen entera × `gameplay.signScale` (Station); origen del manifiesto o la base del poste.
 * - decoration: imagen entera; su escala es un dato de cada decoración (aquí, la sugerida).
 */
export function geometryOf(role: Role, entry: AssetEntry, signScale: number): Geometry | null {
  const sheet = entry.sourceFrameSize;
  if (role === "ambient") {
    const logical = entry.animation && sheet ? { w: sheet.width, h: sheet.height } : entry.width && entry.height ? { w: entry.width, h: entry.height } : null;
    if (!logical) return null;
    const k = entry.recommendedScale ?? 1;
    return { logicalW: logical.w, logicalH: logical.h, baseW: logical.w * k, baseH: logical.h * k, origin: entry.origin ?? { x: 0.5, y: 0.5 } };
  }
  if (role === "critter") {
    if (!sheet || !entry.recommendedDisplay) return null;
    const k = entry.recommendedDisplay.width / sheet.width;
    return { logicalW: sheet.width, logicalH: sheet.height, baseW: sheet.width * k, baseH: sheet.height * k, origin: entry.origin ?? { x: 0.5, y: 1 } };
  }
  if (!entry.width || !entry.height) return null;
  const k = role === "station" ? signScale : defaultDecorationScale(entry);
  return { logicalW: entry.width, logicalH: entry.height, baseW: entry.width * k, baseH: entry.height * k, origin: entry.origin ?? { x: 0.5, y: 1 } };
}

/** Tamaño en píxeles del preview de un tile: el tamaño visual base, redondeado (así un objeto recién insertado ya tiene el tamaño del juego). */
export const previewSize = (g: Geometry): { width: number; height: number } => ({ width: Math.max(1, Math.round(g.baseW)), height: Math.max(1, Math.round(g.baseH)) });

export interface CatalogEntry {
  role: Role;
  assetId: string;
  entry: AssetEntry;
  geometry: Geometry;
  /** Fotograma que se dibuja como preview (hojas animadas); `null` = la imagen entera. */
  frameName: string | null;
  /** Ruta del preview relativa a `tools/tiled/previews` (siempre con `/`). */
  previewFile: string;
}

/**
 * IDs de los assets de la interfaz (`ui.assets`): no son objetos del mundo aunque su `kind` encaje. Se exceptúan los que algún
 * mapa ya usa como efecto o decoración (p. ej. los destellos dorados también adornan una escena): el editor siempre debe poder
 * representar lo que hay.
 */
export function uiAssetIds(config: BitacoraConfig): Set<string> {
  const used = new Set<string>();
  for (const zone of Object.values(config.maps)) {
    zone.ambient.forEach((fx) => used.add(fx.assetId));
    zone.decorations.forEach((d) => used.add(d.assetId));
  }
  return new Set(Object.values(config.ui.assets).filter((v): v is string => typeof v === "string" && !used.has(v)));
}

/**
 * Todos los (rol, asset) que el editor puede colocar, en el orden del manifiesto. Los assets de la interfaz, la música y lo
 * que no cumple los requisitos de un uso no entran: el catálogo es solo de objetos del mundo.
 */
export function catalogEntries(manifest: AssetManifest, config: BitacoraConfig): CatalogEntry[] {
  const ui = uiAssetIds(config);
  const out: CatalogEntry[] = [];
  const signScale = config.gameplay.signScale;
  const add = (role: Role, assetId: string, entry: AssetEntry, frameName: string | null) => {
    const geometry = geometryOf(role, entry, signScale);
    if (geometry) out.push({ role, assetId, entry, geometry, frameName, previewFile: `${role}/${assetId}.png` });
  };
  for (const [assetId, entry] of Object.entries(manifest.assets)) {
    if (entry.type !== "image") continue;
    const ambient = ambientKindOf(entry);
    if (ambient && ambient !== "swim" && ambient !== "particles" && !ui.has(assetId)) add("ambient", assetId, entry, entry.animation?.frameNames[0] ?? null);
    if ((KINDS.stationObject as readonly string[]).includes(entry.kind) && !isSheet(entry) && !ui.has(assetId)) add("decoration", assetId, entry, null);
    if (entry.kind === "critter-sheet") add("critter", assetId, entry, entry.critterAnimations?.find((a) => a.state === "idle")?.frameNames[0] ?? entry.critterAnimations?.[0]?.frameNames[0] ?? null);
    if ((KINDS.sign as readonly string[]).includes(entry.kind)) add("station", assetId, entry, null);
  }
  return out;
}

/** Los assets de un tipo que se eligen por su ID en una lista (partículas, patos, animales): para los enums del proyecto. */
export function idsByAmbientKind(manifest: AssetManifest, kind: "particles" | "swim"): string[] {
  return Object.entries(manifest.assets).filter(([, e]) => ambientKindOf(e) === kind).map(([id]) => id);
}
export const critterIds = (manifest: AssetManifest): string[] => Object.entries(manifest.assets).filter(([, e]) => e.kind === "critter-sheet").map(([id]) => id);
/** Los efectos de sonido del catálogo: lo único que ofrece el selector `SoundAsset` de Tiled (nunca la música ni una imagen). */
export const sfxIds = (manifest: AssetManifest): string[] => Object.entries(manifest.assets).filter(([, e]) => e.kind === "sfx" && e.type === "audio").map(([id]) => id);

export const tileKey = (role: Role, assetId: string): string => `${role}:${assetId}`;

/** Propiedades por defecto de un tile según su rol: lo que hereda cada objeto que se coloca desde el catálogo. */
export function tileProperties(c: CatalogEntry): TiledProperty[] {
  const props: TiledProperty[] = [prop("assetId", c.assetId)];
  if (c.role === "ambient") props.push(prop("ambientType", ambientKindOf(c.entry) as string, "AmbientType"));
  if (c.role === "decoration") props.push(prop("originX", c.geometry.origin.x), prop("originY", c.geometry.origin.y));
  return props;
}

/**
 * Tileset de colección de imágenes con los objetos colocables. Los IDs de tile son estables: un asset que ya estaba conserva su
 * ID aunque se añadan o desaparezcan otros (los objetos de los mapas guardan el GID, así que si cambiara apuntarían a otra
 * imagen). Los nuevos reciben el siguiente ID libre. Un asset que ya no es colocable conserva su tile marcado `obsolete`, para que
 * Tiled siga dibujando lo que lo use y el importador lo rechace con un mensaje claro.
 */
export function buildTileset(entries: CatalogEntry[], existing?: TiledTileset): { tileset: TiledTileset; added: string[]; obsolete: string[] } {
  const ids = new Map<string, number>();
  const stale: TiledTile[] = [];
  let next = 0;
  for (const tile of existing?.tiles ?? []) {
    const role = CLASS_ROLE[tile.class ?? tile.type ?? ""];
    const assetId = tile.properties?.find((p) => p.name === "assetId")?.value;
    if (role && typeof assetId === "string") ids.set(tileKey(role, assetId), tile.id);
    next = Math.max(next, tile.id + 1);
  }
  const live = new Set(entries.map((e) => tileKey(e.role, e.assetId)));
  const added: string[] = [];
  const tiles: TiledTile[] = [];
  for (const e of entries) {
    const key = tileKey(e.role, e.assetId);
    let id = ids.get(key);
    if (id === undefined) {
      id = next++;
      added.push(key);
    }
    const size = previewSize(e.geometry);
    tiles.push({
      id,
      class: ROLE_CLASS[e.role],
      image: `../previews/${e.previewFile}`,
      imagewidth: size.width,
      imageheight: size.height,
      properties: tileProperties(e),
    });
  }
  const obsolete: string[] = [];
  for (const tile of existing?.tiles ?? []) {
    const role = CLASS_ROLE[tile.class ?? tile.type ?? ""];
    const assetId = tile.properties?.find((p) => p.name === "assetId")?.value;
    if (!role || typeof assetId !== "string") continue;
    const key = tileKey(role, assetId);
    if (live.has(key)) continue;
    obsolete.push(key);
    const props = (tile.properties ?? []).filter((p) => p.name !== "obsolete");
    stale.push({ ...tile, properties: [...props, prop("obsolete", true)] });
  }
  const all = [...tiles, ...stale].sort((a, b) => a.id - b.id);
  const width = Math.max(1, ...all.map((t) => t.imagewidth ?? 1));
  const height = Math.max(1, ...all.map((t) => t.imageheight ?? 1));
  const tileset: TiledTileset = {
    columns: 0,
    grid: { height: 1, orientation: "orthogonal", width: 1 },
    margin: 0,
    name: TILESET_NAME,
    objectalignment: "topleft",
    spacing: 0,
    tilecount: all.length,
    tiledversion: "1.12.2",
    tileheight: height,
    tiles: all,
    tilewidth: width,
    type: "tileset",
    version: "1.10",
  };
  return { tileset, added, obsolete };
}
