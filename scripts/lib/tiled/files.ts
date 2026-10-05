import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { mergeConfig } from "../../../src/config/mapsFile";
import type { BitacoraConfig, BitacoraContent, MapsFile } from "../../../src/config/types";
import type { TiledMap, TiledProject, TiledTileset } from "./types";

/** Rutas de la integración, todas derivadas de la raíz del repositorio (nada depende de una ruta personal). */
export interface Paths {
  root: string;
  tiledDir: string;
  mapsDir: string;
  tilesetsDir: string;
  tilesetFile: string;
  previewsDir: string;
  backupsDir: string;
  projectFile: string;
  /** `bitacora.json`: el contenido. Tiled no lo toca. */
  configFile: string;
  /** `maps.json`: la geometría (`maps` y `placements`): lo único que escribe la importación. */
  mapsFile: string;
  manifestFile: string;
  assetsDir: string;
}

export function defaultPaths(root: string = process.cwd()): Paths {
  const tiledDir = join(root, "tools/tiled");
  return {
    root,
    tiledDir,
    mapsDir: join(tiledDir, "maps"),
    tilesetsDir: join(tiledDir, "tilesets"),
    tilesetFile: join(tiledDir, "tilesets/catalogo.tsj"),
    previewsDir: join(tiledDir, "previews"),
    backupsDir: join(tiledDir, "backups"),
    projectFile: join(tiledDir, "bitacora.tiled-project"),
    configFile: join(root, "public/config/bitacora.json"),
    mapsFile: join(root, "public/config/maps.json"),
    manifestFile: join(root, "public/assets/assets.json"),
    assetsDir: join(root, "public/assets"),
  };
}

export class FileError extends Error {}

export function readJsonFile<T>(file: string, what: string): T {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new FileError(`no se pudo leer ${what} (${file})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new FileError(`${what} no es JSON válido (${file}): ${(e as Error).message}`);
  }
}

/** La configuración en un solo objeto, leída de `bitacora.json` y `maps.json` (sin validar: eso lo hace `validateProject`). */
export function readConfig(paths: Paths): BitacoraConfig {
  return mergeConfig(readJsonFile<BitacoraContent>(paths.configFile, "bitacora.json"), readJsonFile<MapsFile>(paths.mapsFile, "maps.json"));
}

/** Escribe `text` en `file` sin dejar nunca un archivo a medias: archivo temporal en la misma carpeta y reemplazo atómico. */
export function writeAtomic(file: string, text: string | Uint8Array): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/** Mapas activos: los `.tmj` de la carpeta de mapas (otros formatos, como el TMX antiguo, no se importan). */
export function listMapFiles(paths: Paths): { maps: string[]; ignored: string[] } {
  if (!existsSync(paths.mapsDir)) return { maps: [], ignored: [] };
  const names = readdirSync(paths.mapsDir).sort();
  return {
    maps: names.filter((n) => n.endsWith(".tmj")).map((n) => join(paths.mapsDir, n)),
    ignored: names.filter((n) => /\.(tmx|json|tmj\..*|tmx\..*)$/.test(n) && !n.endsWith(".tmj")),
  };
}

export const readMap = (file: string): TiledMap => readJsonFile<TiledMap>(file, `el mapa ${basename(file)}`);
export const readProject = (paths: Paths): TiledProject | undefined => (existsSync(paths.projectFile) ? readJsonFile<TiledProject>(paths.projectFile, "el proyecto de Tiled") : undefined);

/** Lector de tilesets externos de un mapa: ruta relativa al mapa; `undefined` si falta o no es legible. */
export function tilesetLoader(mapFile: string): (source: string) => TiledTileset | undefined {
  return (source) => {
    const file = resolve(dirname(mapFile), source);
    if (!existsSync(file) || !statSync(file).isFile()) return undefined;
    try {
      return JSON.parse(readFileSync(file, "utf8")) as TiledTileset;
    } catch {
      return undefined;
    }
  };
}

/** Copia `file` a la carpeta de copias con una marca de tiempo (se conservan las últimas `keep`). Devuelve la ruta de la copia. */
export function backupFile(paths: Paths, file: string, keep = 20): string {
  mkdirSync(paths.backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(paths.backupsDir, `${stamp}-${basename(file)}`);
  copyFileSync(file, target);
  const same = readdirSync(paths.backupsDir).filter((n) => n.endsWith(`-${basename(file)}`)).sort();
  for (const old of same.slice(0, Math.max(0, same.length - keep))) rmSync(join(paths.backupsDir, old), { force: true });
  return target;
}

/** Copia una carpeta de copias de mapas (`<fecha>/`) con los archivos dados: la «copia recuperable» antes de regenerar. */
export function backupMaps(paths: Paths, files: string[]): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(paths.backupsDir, `${stamp}-mapas`);
  mkdirSync(dir, { recursive: true });
  for (const f of files) copyFileSync(f, join(dir, basename(f)));
  return dir;
}
