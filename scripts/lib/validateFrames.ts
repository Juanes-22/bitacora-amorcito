import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import type { SheetDefinition } from "../../src/assets/frameDefinitions";
import { createAssetRegistry } from "../../src/config/assetRegistry";
import type { AssetManifest, ConfigIssue } from "../../src/config/types";

const ALPHA = 16; // por debajo de este alpha un píxel se considera transparente

/**
 * Valida definiciones de frames contra la imagen real y la metadata del manifiesto (AC-35):
 * dentro de la imagen, sin recortar contenido (el borde de cada frame es transparente), sin vacíos,
 * sin solaparse, con el pivote dentro del frame y coherentes con poseCount/visualLayout/rowDirections.
 */
export function validateFrameDefinitions(
  defs: Readonly<Record<string, SheetDefinition>>,
  manifest: AssetManifest,
  manifestPath: string,
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const registry = createAssetRegistry(manifest, pathToFileURL(manifestPath));

  for (const [key, def] of Object.entries(defs)) {
    const at = `frameDefinitions.${key}`;
    if (def.assetId !== key) issues.push({ path: at, message: `assetId «${def.assetId}» no coincide con su clave` });
    if (!registry.has(def.assetId)) {
      issues.push({ path: `${at}.assetId`, message: `asset ID no encontrado: «${def.assetId}»` });
      continue;
    }
    if (def.scale !== undefined && !(def.scale > 0)) issues.push({ path: `${at}.scale`, message: "debe ser positivo" });
    const entry = registry.get(def.assetId);
    if (entry.kind !== "pose-sheet") issues.push({ path: `${at}.assetId`, message: `«${def.assetId}» no es una hoja de poses (kind ${entry.kind})` });

    const png = PNG.sync.read(readFileSync(fileURLToPath(registry.url(def.assetId))));
    const opaque = (x: number, y: number) => png.data[(y * png.width + x) * 4 + 3] > ALPHA;

    if (entry.poseCount !== undefined && def.frames.length !== entry.poseCount) {
      issues.push({ path: `${at}.frames`, message: `hay ${def.frames.length} frames y el manifiesto declara poseCount ${entry.poseCount}` });
    }
    const expected = (entry.rowDirections ?? []).flatMap((d) =>
      Array.from({ length: entry.visualLayout?.columns ?? 0 }, (_, c) => `${d}-${c}`),
    );
    if (expected.length && JSON.stringify(def.frames.map((f) => f.name)) !== JSON.stringify(expected)) {
      issues.push({ path: `${at}.frames`, message: `los nombres deben seguir rowDirections × columnas: ${expected.join(", ")}` });
    }

    const names = new Set<string>();
    def.frames.forEach((f, i) => {
      const p = `${at}.frames[${i}](${f.name})`;
      if (names.has(f.name)) issues.push({ path: p, message: "nombre de frame repetido" });
      names.add(f.name);
      if (f.width <= 0 || f.height <= 0) return void issues.push({ path: p, message: "tamaño no positivo" });
      if (f.x < 0 || f.y < 0 || f.x + f.width > png.width || f.y + f.height > png.height) {
        return void issues.push({ path: p, message: `queda fuera de la imagen (${png.width}×${png.height})` });
      }
      let content = 0;
      let clipped = 0;
      for (let y = f.y; y < f.y + f.height; y++) {
        for (let x = f.x; x < f.x + f.width; x++) {
          if (!opaque(x, y)) continue;
          content++;
          if (x === f.x || y === f.y || x === f.x + f.width - 1 || y === f.y + f.height - 1) clipped++;
        }
      }
      if (content === 0) issues.push({ path: p, message: "el recorte está vacío" });
      if (clipped) issues.push({ path: p, message: `recorta la pose: ${clipped} píxel(es) opacos en su borde` });
      if (f.feetX < 0 || f.feetX > f.width || f.feetY < 0 || f.feetY > f.height) {
        issues.push({ path: p, message: "el punto de apoyo (feetX/feetY) cae fuera del frame" });
      }
      def.frames.forEach((g, j) => {
        if (j > i && f.x < g.x + g.width && g.x < f.x + f.width && f.y < g.y + g.height && g.y < f.y + f.height) {
          issues.push({ path: p, message: `se solapa con el frame «${g.name}»` });
        }
      });
    });

    for (const [aid, anim] of Object.entries(def.animations)) {
      const ap = `${at}.animations.${aid}`;
      if (anim.frames.length === 0) issues.push({ path: ap, message: "sin frames" });
      for (const n of [...anim.frames, ...(anim.restFrame ? [anim.restFrame] : [])]) {
        if (!names.has(n)) issues.push({ path: ap, message: `frame inexistente «${n}»` });
      }
      if (!(anim.frameRate > 0)) issues.push({ path: ap, message: "frameRate debe ser positivo" });
    }
  }
  return issues;
}
