import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { PNG } from "pngjs";
import { validateProject } from "../validateProject";
import type { AssetManifest, BitacoraConfig } from "../../../src/config/types";
import { annotate, buildCandidate, describeChanges, jsonEqual } from "./apply";
import { buildTileset, catalogEntries, CLASS_ROLE, previewSize, tileKey } from "./catalog";
import { cellSizeFor, exportZone } from "./export";
import { backupFile, backupMaps, defaultPaths, FileError, listMapFiles, readConfig, readJsonFile, readMap, readProject, tilesetLoader, writeAtomic, type Paths } from "./files";
import { importMap, type ZoneImport } from "./import";
import { replaceTopLevel } from "./jsonStyle";
import { mergeProject } from "./project";
import { renderFrame, resizeArea, type AtlasFrame } from "./preview";
import { tiledJson } from "./tiledJson";
import type { TiledIssue, TiledProject, TiledTileset } from "./types";
import { formatIssue } from "./types";

export { defaultPaths };
export type { Paths };

const posix = (p: string): string => p.split("\\").join("/");

// -- Importar ------------------------------------------------------------------------------------------------------------

export interface ImportReport {
  /** Sin errores: los mapas se leen, convierten y validan. */
  ok: boolean;
  /** Los mapas coinciden con `maps.json` (nada que aplicar). */
  inSync: boolean;
  /** Se escribió `maps.json` en esta ejecución. */
  written: boolean;
  errors: string[];
  warnings: string[];
  changes: string[];
  zones: string[];
  backup?: string;
  info: string[];
}

export interface ImportOptions {
  /** Escribe `maps.json` si hay cambios. Sin esto solo se comprueba (dry-run / check). */
  apply: boolean;
}

/**
 * Lee los mapas de Tiled, construye la configuración candidata completa en memoria y la valida con el mismo `validateProject`
 * del build. Solo si todo pasa y se pide `apply`, reemplaza `maps` y `placements` en maps.json (archivo temporal + renombrado
 * atómico, con copia del anterior); `bitacora.json` (el contenido) no se toca nunca. Con cualquier error la configuración previa
 * queda intacta.
 */
export function runImport(paths: Paths, options: ImportOptions): ImportReport {
  const report: ImportReport = { ok: false, inSync: false, written: false, errors: [], warnings: [], changes: [], zones: [], info: [] };
  let manifestJson: AssetManifest;
  let mapsText: string;
  let base: BitacoraConfig;
  let project: TiledProject | undefined;
  try {
    manifestJson = readJsonFile<AssetManifest>(paths.manifestFile, "assets.json");
    mapsText = readFileSync(paths.mapsFile, "utf8");
    base = readConfig(paths);
    project = readProject(paths);
  } catch (e) {
    report.errors.push((e as Error).message);
    return report;
  }

  const { maps: files, ignored } = listMapFiles(paths);
  for (const name of ignored) report.warnings.push(`tools/tiled/maps/${name}: no se importa (la integración lee solo archivos .tmj)`);
  if (files.length === 0) {
    report.errors.push(`no hay mapas .tmj en ${posix(relative(paths.root, paths.mapsDir))}: ejecuta npm run tiled:generate`);
    return report;
  }

  const issues: TiledIssue[] = [];
  const zones: ZoneImport[] = [];
  for (const file of files) {
    let map;
    try {
      map = readMap(file);
    } catch (e) {
      report.errors.push((e as Error).message);
      continue;
    }
    const r = importMap(file, map, { manifest: manifestJson, config: base, project, assetsDir: paths.assetsDir, mapDir: dirname(file), loadTileset: tilesetLoader(file) });
    issues.push(...r.issues);
    report.warnings.push(...r.warnings.map(formatIssue));
    if (r.result) zones.push(r.result);
  }
  report.errors.push(...issues.map(formatIssue));
  if (report.errors.length) return report;

  const built = buildCandidate(base, zones);
  report.errors.push(...built.issues.map(formatIssue));
  if (!built.candidate) return report;
  const { candidate } = built;
  report.zones = candidate.managed;

  const validation = validateProject(manifestJson, candidate.config, paths.manifestFile);
  report.errors.push(...validation.errors.filter((e) => /^(bitacora|maps|assets)\.json/.test(e.path)).map((e) => annotate({ path: e.path, message: e.message }, candidate.sources)));
  report.warnings.push(...validation.warnings.map((w) => `${w.path}: ${w.message}`));
  report.info.push(...validation.info);
  if (report.errors.length) return report;

  report.changes = describeChanges(base, candidate.config);
  report.inSync = jsonEqual(base.maps, candidate.config.maps) && jsonEqual(base.placements, candidate.config.placements);
  report.ok = true;
  if (report.inSync || !options.apply) return report;

  const text = replaceTopLevel(mapsText, { placements: candidate.config.placements, maps: candidate.config.maps });
  if (text === null) {
    report.warnings.push("no se localizaron `placements` y `maps` en maps.json: se reescribió el archivo entero con formato estándar");
  }
  report.backup = backupFile(paths, paths.mapsFile);
  writeAtomic(paths.mapsFile, text ?? `${JSON.stringify({ $schema: "./maps.schema.json", placements: candidate.config.placements, maps: candidate.config.maps }, null, 2)}\n`);
  report.written = true;
  return report;
}

// -- Generar -------------------------------------------------------------------------------------------------------------

export interface GenerateOptions {
  /** Solo actualiza el catálogo, los previews y el proyecto: no toca los mapas. */
  catalogOnly: boolean;
  /** Regenera mapas que ya existen (con copia previa). */
  force: boolean;
  /** Limita los mapas a estas zonas. */
  zones?: string[];
}

export interface GenerateReport {
  tileCount: number;
  addedTiles: string[];
  obsoleteTiles: string[];
  previews: number;
  written: string[];
  skipped: string[];
  backups: string[];
  warnings: string[];
}

const pngCache = new Map<string, PNG>();
const readPng = (file: string): PNG => {
  let png = pngCache.get(file);
  if (!png) {
    png = PNG.sync.read(readFileSync(file));
    pngCache.set(file, png);
  }
  return png;
};

/** Renderiza el preview de un tile: el fotograma (o la imagen) reducido al tamaño visual base del asset. */
function renderPreview(paths: Paths, entry: AssetManifest["assets"][string], frameName: string | null, width: number, height: number, label: string): PNG {
  const sheet = readPng(join(paths.assetsDir, entry.path));
  if (!frameName || !entry.atlasPath) return resizeArea(sheet, width, height);
  const atlas = readJsonFile<{ frames: Record<string, AtlasFrame> }>(join(paths.assetsDir, entry.atlasPath), `el atlas de ${label}`);
  const frame = atlas.frames[frameName];
  if (!frame) throw new FileError(`${label}: el atlas no tiene el fotograma «${frameName}»`);
  return resizeArea(renderFrame(sheet, frame, `${label} › ${frameName}`), width, height);
}

/** Estilo del proyecto: 4 espacios, claves ordenadas y los arreglos vacíos con su salto de línea (como lo escribe Tiled). */
function projectJson(project: TiledProject): string {
  const ind = (n: number) => " ".repeat(n * 4);
  const put = (v: unknown, level: number): string => {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return v.length === 0 ? `[\n${ind(level)}]` : `[\n${v.map((x) => `${ind(level + 1)}${put(x, level + 1)}`).join(",\n")}\n${ind(level)}]`;
    const keys = Object.keys(v as object).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort();
    return keys.length === 0 ? "{\n" + ind(level) + "}" : `{\n${keys.map((k) => `${ind(level + 1)}${JSON.stringify(k)}: ${put((v as Record<string, unknown>)[k], level + 1)}`).join(",\n")}\n${ind(level)}}`;
  };
  return `${put(project, 0)}\n`;
}

const sameBytes = (file: string, data: Uint8Array | string): boolean => {
  if (!existsSync(file)) return false;
  const current = readFileSync(file);
  return Buffer.compare(current, typeof data === "string" ? Buffer.from(data) : Buffer.from(data)) === 0;
};

export function runGenerate(paths: Paths, options: GenerateOptions): GenerateReport {
  const manifest = readJsonFile<AssetManifest>(paths.manifestFile, "assets.json");
  const config = readConfig(paths);
  const report: GenerateReport = { tileCount: 0, addedTiles: [], obsoleteTiles: [], previews: 0, written: [], skipped: [], backups: [], warnings: [] };
  const rel = (f: string) => posix(relative(paths.root, f));

  // Catálogo: tileset con IDs estables y un preview por tile.
  const existing = existsSync(paths.tilesetFile) ? readJsonFile<TiledTileset>(paths.tilesetFile, "el catálogo de Tiled") : undefined;
  const entries = catalogEntries(manifest, config);
  const { tileset, added, obsolete } = buildTileset(entries, existing);
  report.tileCount = tileset.tiles?.length ?? 0;
  report.addedTiles = added;
  report.obsoleteTiles = obsolete;
  for (const e of entries) {
    const size = previewSize(e.geometry);
    const png = renderPreview(paths, e.entry, e.frameName, size.width, size.height, e.assetId);
    const bytes = PNG.sync.write(png);
    const file = join(paths.previewsDir, e.previewFile);
    if (!sameBytes(file, bytes)) {
      writeAtomic(file, bytes);
      report.previews++;
    }
  }
  const tilesetText = tiledJson(tileset as unknown as Record<string, unknown>);
  if (!sameBytes(paths.tilesetFile, tilesetText)) {
    writeAtomic(paths.tilesetFile, tilesetText);
    report.written.push(rel(paths.tilesetFile));
  }
  const projectText = projectJson(mergeProject(readProject(paths), manifest));
  if (!sameBytes(paths.projectFile, projectText)) {
    writeAtomic(paths.projectFile, projectText);
    report.written.push(rel(paths.projectFile));
  }
  if (options.catalogOnly) return report;

  // Mapas: los que no existen se crean; los que ya existen solo se regeneran con `force` y una copia previa.
  const tileIds = new Map<string, number>();
  for (const t of tileset.tiles ?? []) {
    const role = CLASS_ROLE[t.class ?? ""];
    const assetId = t.properties?.find((p) => p.name === "assetId")?.value;
    if (role && typeof assetId === "string") tileIds.set(tileKey(role, assetId), t.id);
  }
  const zoneIds = options.zones ?? Object.keys(config.maps);
  for (const zoneId of zoneIds) {
    if (!config.maps[zoneId]) {
      report.warnings.push(`la zona «${zoneId}» no existe en maps.json`);
      continue;
    }
    const file = join(paths.mapsDir, `${zoneId}.tmj`);
    if (existsSync(file)) {
      if (!options.force) {
        report.skipped.push(rel(file));
        continue;
      }
      report.backups.push(rel(backupMaps(paths, [file])));
    }
    const zone = config.maps[zoneId];
    const map = exportZone(
      { config, manifest, tileIds, firstgid: 1, tilesetSource: posix(relative(paths.mapsDir, paths.tilesetFile)), assetsBase: posix(relative(paths.mapsDir, paths.assetsDir)), cell: cellSizeFor(zone.width, zone.height) },
      zoneId,
    );
    writeAtomic(file, tiledJson(map as unknown as Record<string, unknown>));
    report.written.push(rel(file));
  }
  return report;
}

