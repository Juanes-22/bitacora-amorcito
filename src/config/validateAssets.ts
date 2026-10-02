import assetsSchema from "../../public/assets/assets.schema.json";
import { ajvIssues, compileSchema } from "./schemaValidation";
import type { AssetManifest, ConfigIssue, ValidationResult } from "./types";

const validateShape = compileSchema(assetsSchema);

/** Una ruta de asset debe ser relativa al directorio del manifiesto (SPEC 3.1, AC-34). */
function pathProblem(path: string): string | null {
  if (path.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(path)) return "debe ser relativo al directorio de assets.json";
  if (path.split("/").some((s) => s === "..")) return "no puede salir del directorio de assets.json";
  return null;
}

/**
 * Forma (assets.schema.json) + coherencia de inventario y de la metadata especializada.
 * No toca el disco: la existencia de archivos se comprueba en scripts/validate-config.ts.
 */
export function validateAssetManifest(data: unknown): ValidationResult<AssetManifest> {
  if (!validateShape(data)) return { ok: false, issues: ajvIssues(validateShape.errors) };
  const m = data as unknown as AssetManifest;
  const issues: ConfigIssue[] = [];
  const entries = Object.entries(m.assets);

  if (m.assetCount !== entries.length) {
    issues.push({ path: "assetCount", message: `declara ${m.assetCount} pero assets tiene ${entries.length} entradas` });
  }
  const counted: Record<string, number> = {};
  for (const [, a] of entries) counted[a.category] = (counted[a.category] ?? 0) + 1;
  for (const cat of new Set([...Object.keys(counted), ...Object.keys(m.categoryCounts)])) {
    if ((counted[cat] ?? 0) !== (m.categoryCounts[cat] ?? 0)) {
      issues.push({
        path: `categoryCounts.${cat}`,
        message: `declara ${m.categoryCounts[cat] ?? 0} pero hay ${counted[cat] ?? 0} entradas de esa categoría`,
      });
    }
  }

  for (const [id, a] of entries) {
    const at = `assets.${id}`;
    const problem = pathProblem(a.path);
    if (problem) issues.push({ path: `${at}.path`, message: `«${a.path}» ${problem}` });

    if (a.visualLayout && a.poseCount !== undefined && a.visualLayout.columns * a.visualLayout.rows !== a.poseCount) {
      issues.push({ path: `${at}.poseCount`, message: "no coincide con columns × rows de visualLayout" });
    }
    if (a.rowDirections && a.visualLayout && a.rowDirections.length !== a.visualLayout.rows) {
      issues.push({ path: `${at}.rowDirections`, message: "debe tener una dirección por fila de visualLayout" });
    }
    if (a.requiresFrameDefinition && a.kind !== "pose-sheet") {
      issues.push({ path: `${at}.requiresFrameDefinition`, message: "solo aplica a recursos de kind «pose-sheet»" });
    }
    // Kit de animaciones del paisaje (SPEC 3.2): lo que el motor necesita para construir cada pieza.
    if (a.atlasPath) {
      const atlasProblem = pathProblem(a.atlasPath);
      if (atlasProblem) issues.push({ path: `${at}.atlasPath`, message: `«${a.atlasPath}» ${atlasProblem}` });
    }
    if (a.kind === "animation-sheet") {
      if (!a.atlasPath) issues.push({ path: `${at}.atlasPath`, message: "una hoja animada necesita su atlas" });
      if (!a.animation) issues.push({ path: `${at}.animation`, message: "una hoja animada necesita animation (frameNames, frameRate, repeat)" });
      else if (a.frameCount !== undefined && a.animation.frameNames.length !== a.frameCount) {
        issues.push({ path: `${at}.animation.frameNames`, message: `hay ${a.animation.frameNames.length} nombres y frameCount es ${a.frameCount}` });
      }
      if (!a.origin || !a.recommendedScale) issues.push({ path: at, message: "una hoja animada necesita origin y recommendedScale" });
    }
    if (a.opacityByFrame) {
      const frames = a.animation?.frameNames.length ?? a.frameCount;
      if (frames !== undefined && a.opacityByFrame.length !== frames) {
        issues.push({ path: `${at}.opacityByFrame`, message: `hay ${a.opacityByFrame.length} opacidades y ${frames} fotogramas: debe haber una por fotograma` });
      }
    }
    if (a.kind === "idle-sheet") {
      if (!a.atlasPath) issues.push({ path: `${at}.atlasPath`, message: "una hoja de reposo necesita su atlas" });
      if (!a.animations?.length) issues.push({ path: `${at}.animations`, message: "una hoja de reposo necesita animations (clave, fotogramas, velocidad)" });
      if (!a.origin || (!a.sourceFrameSize && !a.frameAdjust)) issues.push({ path: at, message: "una hoja de reposo necesita origin (los pies) y, o bien sourceFrameSize (el lienzo lógico común), o bien frameAdjust (origen por fotograma)" });
      if (a.frameAdjust) {
        const used = new Set((a.animations ?? []).flatMap((x) => x.frameNames));
        const adjusted = new Set(a.frameAdjust.map((f) => f.name));
        for (const f of a.frameAdjust) if (!used.has(f.name)) issues.push({ path: `${at}.frameAdjust`, message: `«${f.name}» no es un fotograma de las animaciones` });
        for (const name of used) if (!adjusted.has(name)) issues.push({ path: `${at}.frameAdjust`, message: `falta el ajuste del fotograma «${name}»: o todos o ninguno` });
        if (adjusted.size !== a.frameAdjust.length) issues.push({ path: `${at}.frameAdjust`, message: "hay fotogramas repetidos" });
      }
      const keys = (a.animations ?? []).map((x) => x.key);
      if (new Set(keys).size !== keys.length) issues.push({ path: `${at}.animations`, message: "las claves de animación no pueden repetirse" });
      const names = new Set((a.animations ?? []).flatMap((x) => x.frameNames));
      if (a.frameCount !== undefined && names.size !== a.frameCount) {
        issues.push({ path: `${at}.animations`, message: `las animaciones usan ${names.size} fotogramas distintos y frameCount es ${a.frameCount}` });
      }
    }
    if (a.kind === "avatar-sheet") {
      if (!a.atlasPath) issues.push({ path: `${at}.atlasPath`, message: "la hoja del avatar necesita su atlas" });
      if (!a.sourceFrameSize) issues.push({ path: `${at}.sourceFrameSize`, message: "la hoja del avatar necesita sourceFrameSize (el lienzo lógico común)" });
      const states = (a.avatarAnimations ?? []).map((x) => x.state);
      for (const needed of ["idle", "happy"]) {
        if (!states.includes(needed as "idle")) issues.push({ path: `${at}.avatarAnimations`, message: `falta la animación del estado «${needed}»` });
      }
      if (new Set(states).size !== states.length) issues.push({ path: `${at}.avatarAnimations`, message: "cada estado puede tener una sola animación" });
      for (const x of a.avatarAnimations ?? []) {
        if (x.durationsMs.length !== x.frameNames.length) {
          issues.push({ path: `${at}.avatarAnimations`, message: `«${x.key}»: hay ${x.durationsMs.length} duraciones y ${x.frameNames.length} fotogramas` });
        }
      }
      const used = new Set((a.avatarAnimations ?? []).flatMap((x) => x.frameNames));
      if (a.frameCount !== undefined && used.size !== a.frameCount) {
        issues.push({ path: `${at}.avatarAnimations`, message: `las animaciones usan ${used.size} fotogramas distintos y frameCount es ${a.frameCount}` });
      }
    }
    if (a.kind === "particle" && a.motion?.type !== "particle") {
      issues.push({ path: `${at}.motion`, message: "una partícula necesita motion de tipo «particle»" });
    }
    if (a.kind === "light-glow" && a.motion?.type !== "pulse") {
      issues.push({ path: `${at}.motion`, message: "una luz (light-glow) necesita motion de tipo «pulse»" });
    }
    if (a.kind === "light-prop" && a.motion?.type !== "sway") {
      issues.push({ path: `${at}.motion`, message: "un objeto de luz (light-prop) necesita motion de tipo «sway»" });
    }
    if (a.motion?.type === "pulse" && a.motion.alphaMin > a.motion.alphaMax) {
      issues.push({ path: `${at}.motion`, message: "alphaMin no puede superar a alphaMax" });
    }
    if (a.kind === "music") {
      if (a.type !== "audio") issues.push({ path: `${at}.type`, message: "una pista de música debe ser de type «audio»" });
      if (a.durationSeconds === undefined) issues.push({ path: `${at}.durationSeconds`, message: "una pista de música necesita durationSeconds" });
      if (!a.credit) issues.push({ path: `${at}.credit`, message: "una pista de música necesita credit (título, autor, licencia y si está verificada)" });
      else if (a.credit.verified && !a.credit.attribution) issues.push({ path: `${at}.credit.attribution`, message: "una atribución verificada necesita su texto de atribución" });
    }
    if (a.motion && (!a.origin || !a.recommendedScale)) {
      issues.push({ path: at, message: "un asset con motion necesita origin y recommendedScale" });
    }
    if (a.placement && !(a.placement.relativeTo in m.assets)) {
      issues.push({ path: `${at}.placement.relativeTo`, message: `asset ID no encontrado: «${a.placement.relativeTo}»` });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: m };
}
