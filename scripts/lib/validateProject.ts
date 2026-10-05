import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { frameDefinitions, toValidatedFrames } from "../../src/assets/frameDefinitions";
import { createAssetRegistry, resolveAssetBase } from "../../src/config/assetRegistry";
import { configFileOf } from "../../src/config/mapsFile";
import { checkAmbientPlacement, checkWorldReachability } from "../../src/config/reachability";
import { releaseBlockers } from "../../src/config/releaseBlockers";
import type { AssetManifest, BitacoraConfig, ConfigIssue } from "../../src/config/types";
import { validateAssetManifest } from "../../src/config/validateAssets";
import { validateBitacora, validateBitacoraFiles } from "../../src/config/validateConfig";
import { checkAtlases } from "./validateAtlas";
import { validateFrameDefinitions } from "./validateFrames";

export interface ProjectReport {
  errors: ConfigIssue[];
  warnings: ConfigIssue[];
  /** Resumen legible de lo que se comprobó. */
  info: string[];
}

/** Cabecera PNG: ancho y alto. `null` si el archivo no es un PNG legible. */
function pngSize(file: Buffer): { width: number; height: number } | null {
  if (file.length < 24 || file.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/**
 * Comprueba los archivos reales. Existencia = error (AC-20). `sizeBytes`, `sha256` y dimensiones son
 * metadata de inventario: si difieren solo avisan, porque sustituir un archivo conservando su ID
 * es una operación válida (AC-12). Las rutas se resuelven con el mismo AssetRegistry del runtime.
 */
export function checkAssetFiles(manifest: AssetManifest, manifestPath: string): Pick<ProjectReport, "errors" | "warnings"> {
  const errors: ConfigIssue[] = [];
  const warnings: ConfigIssue[] = [];
  const registry = createAssetRegistry(manifest, pathToFileURL(manifestPath));
  const root = dirname(manifestPath);
  const known = new Set<string>([manifestPath]);

  for (const [id, a] of registry.entries()) {
    const at = `assets.${id}`;
    let file: string;
    try {
      file = fileURLToPath(registry.url(id));
    } catch (e) {
      errors.push({ path: `${at}.path`, message: (e as Error).message });
      continue;
    }
    known.add(file);
    if (a.atlasPath) known.add(join(root, a.atlasPath)); // el atlas es parte del asset: no es un archivo huérfano
    if (!existsSync(file) || !statSync(file).isFile()) {
      errors.push({ path: `${at}.path`, message: `archivo no encontrado: ${relative(process.cwd(), file)}` });
      continue;
    }
    const bytes = readFileSync(file);
    if (a.sizeBytes !== undefined && a.sizeBytes !== bytes.length) {
      warnings.push({ path: `${at}.sizeBytes`, message: `declara ${a.sizeBytes} B pero el archivo pesa ${bytes.length} B` });
    }
    if (a.sha256 && a.sha256 !== createHash("sha256").update(bytes).digest("hex")) {
      warnings.push({ path: `${at}.sha256`, message: "el hash no coincide con el archivo (¿se sustituyó la imagen?)" });
    }
    if (a.format === "png") {
      const size = pngSize(bytes);
      if (!size) errors.push({ path: `${at}.path`, message: "declara format png pero el archivo no es un PNG válido" });
      else if ((a.width && a.width !== size.width) || (a.height && a.height !== size.height)) {
        warnings.push({ path: `${at}.width`, message: `declara ${a.width}×${a.height} pero la imagen mide ${size.width}×${size.height}` });
      }
    }
  }

  const base = fileURLToPath(resolveAssetBase(pathToFileURL(manifestPath), manifest.basePath));
  for (const doc of manifest.sourceDocuments ?? []) {
    const file = join(base, doc.path);
    known.add(file);
    if (!existsSync(file)) errors.push({ path: `sourceDocuments.${doc.path}`, message: "archivo no encontrado" });
  }

  const ignored = new Set(["README.md", "assets.schema.json", ".DS_Store"]);
  for (const file of listFiles(root)) {
    const name = file.split(sep).pop() as string;
    if (!known.has(file) && !ignored.has(name)) {
      warnings.push({ path: relative(root, file), message: "archivo en la carpeta de assets que ningún asset del manifiesto referencia" });
    }
  }
  return { errors, warnings };
}

/** Una ruta de error de la configuración, con el archivo en el que está (`bitacora.json › route[2]`, `maps.json › maps.zona-a...`). */
const inFile = (issue: ConfigIssue): string => `${configFileOf(issue)} › ${issue.path}`;

/**
 * Validación completa del proyecto: manifiesto, archivos, bitácora, referencias y alcanzabilidad.
 * `configJson` es la configuración en un solo objeto o, si se da `options.mapsJson`, el contenido (bitacora.json) con la geometría
 * (maps.json) aparte: así cada archivo se valida con su esquema y los extras que no se ven al unirlos tampoco pasan.
 */
export function validateProject(
  manifestJson: unknown,
  configJson: unknown,
  manifestPath: string,
  options: { release?: boolean; mapsJson?: unknown } = {},
): ProjectReport {
  const report: ProjectReport = { errors: [], warnings: [], info: [] };
  const manifest = validateAssetManifest(manifestJson);
  if (!manifest.ok) {
    report.errors.push(...manifest.issues.map((i) => ({ path: `assets.json › ${i.path}`, message: i.message })));
    report.info.push("assets.json: inválido; no se comprobaron archivos ni la configuración (bitacora.json y maps.json)");
    return report;
  }
  report.info.push(`assets.json: válido (${Object.keys(manifest.value.assets).length} entradas, assetCount y categoryCounts coherentes)`);

  const files = checkAssetFiles(manifest.value, manifestPath);
  report.errors.push(...files.errors.map((i) => ({ path: `assets.json › ${i.path}`, message: i.message })));
  report.warnings.push(...files.warnings.map((i) => ({ path: `assets.json › ${i.path}`, message: i.message })));
  report.info.push(`archivos: ${files.errors.length === 0 ? "todos los path existen" : `${files.errors.length} error(es)`}, ${files.warnings.length} aviso(s)`);

  const atlases = checkAtlases(manifest.value, manifestPath);
  report.errors.push(...atlases);
  report.info.push(`atlas: ${Object.values(manifest.value.assets).filter((a) => a.atlasPath).length} hoja(s) animada(s) ${atlases.length === 0 ? "validadas contra su imagen" : `con ${atlases.length} error(es)`}`);

  const frames = validateFrameDefinitions(frameDefinitions, manifest.value, manifestPath);
  report.errors.push(...frames.map((i) => ({ path: i.path, message: i.message })));
  report.info.push(
    `frames: ${Object.keys(frameDefinitions).length} hoja(s) de poses ${frames.length === 0 ? "validadas contra la imagen real" : `con ${frames.length} error(es)`}`,
  );

  const frameOptions = { frameDefinitions: toValidatedFrames() };
  const config = options.mapsJson !== undefined ? validateBitacoraFiles(configJson, options.mapsJson, manifest.value, frameOptions) : validateBitacora(configJson, manifest.value, frameOptions);
  if (!config.ok) {
    report.errors.push(...config.issues.map((i) => ({ path: inFile(i), message: i.message })));
    report.info.push("bitacora.json / maps.json: inválidos; no se comprobó la alcanzabilidad");
    return report;
  }
  const c: BitacoraConfig = config.value;
  report.info.push(
    `bitacora.json y maps.json: válidos (modo ${c.mode}, ${c.route.length} aprendizajes activos, ${Object.keys(c.maps).length} zonas, ${Object.keys(c.learnings).length - c.route.length} archivados)`,
  );
  const reach = [...checkWorldReachability(c), ...checkAmbientPlacement(c)];
  report.errors.push(...reach.map((i) => ({ path: inFile(i), message: i.message })));
  report.info.push(`alcanzabilidad: ${reach.length === 0 ? "estaciones, portales y spawns alcanzables" : `${reach.length} problema(s)`}`);

  // Bloqueos de publicación: avisos en modo final (el contenido sin aprobar se muestra como pendiente), errores con --release.
  if (options.release || c.mode === "final") {
    const blockers = releaseBlockers(c, manifest.value).map((i) => ({ path: inFile(i), message: `bloquea la publicación: ${i.message}` }));
    (options.release ? report.errors : report.warnings).push(...blockers);
    report.info.push(`publicación: ${blockers.length === 0 ? "sin bloqueos" : `${blockers.length} bloqueo(s)`}`);
  }
  return report;
}
