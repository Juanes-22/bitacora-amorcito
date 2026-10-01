import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PNG } from "pngjs";
import type { AssetEntry, AssetManifest, ConfigIssue } from "../../src/config/types";

const ALPHA = 16;

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  sourceSize?: { w: number; h: number };
  spriteSourceSize?: { x: number; y: number; w: number; h: number };
}
interface Atlas {
  frames: Record<string, AtlasFrame>;
  meta: { image: string; size: { w: number; h: number } };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Valida un atlas (formato «JSON hash» de Phaser) contra su imagen y la metadata del manifiesto (SPEC 3.2, AC-40):
 * la definición de frames ES el atlas, así que se comprueba que sea coherente con la imagen real y con la animación
 * declarada. Función pura sobre datos ya leídos.
 */
export function validateAtlasData(
  assetId: string,
  entry: AssetEntry,
  atlas: unknown,
  png: { width: number; height: number; data: Uint8Array | Buffer },
): ConfigIssue[] {
  const at = `assets.${assetId}.atlas`;
  const issues: ConfigIssue[] = [];
  const err = (path: string, message: string) => issues.push({ path: `${at}${path}`, message });

  if (!isObj(atlas) || !isObj(atlas.frames) || !isObj(atlas.meta)) return [{ path: at, message: "no tiene la forma de un atlas (frames y meta)" }];
  const a = atlas as unknown as Atlas;
  if (a.meta.image !== basename(entry.path)) err(".meta.image", `«${a.meta.image}» no coincide con el archivo del asset («${basename(entry.path)}»)`);
  if (a.meta.size?.w !== png.width || a.meta.size?.h !== png.height) {
    err(".meta.size", `declara ${a.meta.size?.w}×${a.meta.size?.h} pero la imagen mide ${png.width}×${png.height}`);
  }

  const names = Object.keys(a.frames);
  const expected = entry.animation?.frameNames ?? [];
  if (JSON.stringify([...names].sort()) !== JSON.stringify([...expected].sort())) {
    err(".frames", `los nombres del atlas (${names.join(", ")}) no coinciden con animation.frameNames (${expected.join(", ")})`);
  }
  if (entry.frameCount !== undefined && names.length !== entry.frameCount) err(".frames", `hay ${names.length} regiones y frameCount es ${entry.frameCount}`);

  const rects: Array<[string, AtlasFrame["frame"]]> = [];
  for (const name of names) {
    const f = a.frames[name];
    const r = f?.frame;
    const p = `.frames.${name}`;
    if (!r || ![r.x, r.y, r.w, r.h].every(Number.isInteger) || r.w <= 0 || r.h <= 0) {
      err(p, "región inválida (x, y, w, h enteros y positivos)");
      continue;
    }
    if (r.x < 0 || r.y < 0 || r.x + r.w > png.width || r.y + r.h > png.height) {
      err(p, `queda fuera de la imagen (${png.width}×${png.height})`);
      continue;
    }
    if (entry.sourceFrameSize && f.sourceSize && (f.sourceSize.w !== entry.sourceFrameSize.width || f.sourceSize.h !== entry.sourceFrameSize.height)) {
      err(p, `sourceSize ${f.sourceSize.w}×${f.sourceSize.h} no coincide con sourceFrameSize ${entry.sourceFrameSize.width}×${entry.sourceFrameSize.height}`);
    }
    const s = f.spriteSourceSize;
    if (s && f.sourceSize && (s.x < 0 || s.y < 0 || s.x + s.w > f.sourceSize.w || s.y + s.h > f.sourceSize.h)) err(p, "spriteSourceSize cae fuera de sourceSize");
    let content = 0;
    for (let y = r.y; y < r.y + r.h && !content; y++) for (let x = r.x; x < r.x + r.w; x++) if (png.data[(y * png.width + x) * 4 + 3] > ALPHA) { content++; break; }
    if (!content) err(p, "la región está vacía (sin píxeles opacos)");
    rects.push([name, r]);
  }
  rects.forEach(([n, r], i) => {
    for (const [m, q] of rects.slice(i + 1)) {
      if (r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h) err(`.frames.${n}`, `se solapa con «${m}»`);
    }
  });
  return issues;
}

/** Lee del disco el atlas y la imagen de cada asset con `atlasPath` y los valida. */
export function checkAtlases(manifest: AssetManifest, manifestPath: string): ConfigIssue[] {
  const root = join(dirname(manifestPath), manifest.basePath);
  const issues: ConfigIssue[] = [];
  for (const [id, entry] of Object.entries(manifest.assets)) {
    if (!entry.atlasPath) continue;
    const atlasFile = join(root, entry.atlasPath);
    const imageFile = join(root, entry.path);
    if (!existsSync(atlasFile)) {
      issues.push({ path: `assets.${id}.atlasPath`, message: `archivo no encontrado: ${entry.atlasPath}` });
      continue;
    }
    if (!existsSync(imageFile)) continue; // ya lo informa checkAssetFiles
    let atlas: unknown;
    try {
      atlas = JSON.parse(readFileSync(atlasFile, "utf8"));
    } catch (e) {
      issues.push({ path: `assets.${id}.atlasPath`, message: `el atlas no es JSON válido: ${(e as Error).message}` });
      continue;
    }
    issues.push(...validateAtlasData(id, entry, atlas, PNG.sync.read(readFileSync(imageFile))));
  }
  return issues;
}
