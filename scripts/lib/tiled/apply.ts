import type { BitacoraConfig, MapSound, MapZone, Placement } from "../../../src/config/types";
import type { ConfigIssue } from "../../../src/config/types";
import type { Source, TiledIssue } from "./types";
import { formatSource } from "./types";
import type { ZoneImport } from "./import";
import { isRecord, TOLERANCE } from "./util";

/** Igualdad profunda de datos JSON: sin importar el orden de las claves y con la tolerancia numérica de las conversiones. */
export function jsonEqual(a: unknown, b: unknown, tol = TOLERANCE): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= tol;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => jsonEqual(x, b[i], tol));
  if (isRecord(a) && isRecord(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && jsonEqual(a[k], b[k], tol));
  }
  return a === b;
}

/** Reordena las claves de `value` como las de `like` (las que tenga) para que reescribir no mueva líneas sin necesidad. */
function reorderLike<T>(value: T, like: unknown): T {
  if (!isRecord(value) || !isRecord(like)) return value;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(like)) if (Object.hasOwn(value, k)) out[k] = reorderLike(value[k], like[k]);
  for (const k of Object.keys(value)) if (!Object.hasOwn(out, k)) out[k] = value[k];
  return out as T;
}

/** Los elementos de una colección toman el orden de claves de su par en la misma posición cuando son del mismo tipo y asset. */
function reorderCollection<T extends object>(items: T[], base: unknown): T[] {
  const baseItems = Array.isArray(base) ? base : [];
  return items.map((item, i) => {
    const b = baseItems[i];
    const same = isRecord(b) && (item as Record<string, unknown>).type === b.type && (item as Record<string, unknown>).assetId === b.assetId;
    return same || (isRecord(b) && !("assetId" in item)) ? reorderLike(item, b) : item;
  });
}

const ZONE_KEYS = ["label", "width", "height", "layers", "initialSpawnId", "spawns", "obstacles", "decorations", "ambient", "critters", "portals", "sounds"];

function shapeZone(zone: MapZone, base: MapZone | undefined): MapZone {
  const z: Record<string, unknown> = { ...zone };
  z.layers = reorderCollection(zone.layers, base?.layers);
  z.obstacles = reorderCollection(zone.obstacles, base?.obstacles);
  z.decorations = reorderCollection(zone.decorations, base?.decorations);
  z.ambient = reorderCollection(zone.ambient, base?.ambient);
  if (zone.critters) z.critters = reorderCollection(zone.critters, base?.critters);
  // `critters` es opcional: si la zona no lo tenía y sigue sin animales, no se añade; si lo tenía vacío, se conserva.
  if (!zone.critters && base && Object.hasOwn(base, "critters")) z.critters = [];
  // `sounds`, igual: omitido si la zona nunca tuvo sonidos; `{}` si tenía un registro explícito y se quedó sin emisores.
  if (zone.sounds) z.sounds = reorderRegistry(zone.sounds, base?.sounds);
  else if (base && Object.hasOwn(base, "sounds")) z.sounds = {};
  const ordered: Record<string, unknown> = {};
  for (const k of base ? [...Object.keys(base)] : ZONE_KEYS) if (Object.hasOwn(z, k)) ordered[k] = z[k];
  for (const k of ZONE_KEYS) if (!Object.hasOwn(ordered, k) && Object.hasOwn(z, k)) ordered[k] = z[k];
  return ordered as unknown as MapZone;
}

/** Un registro por ID (los sonidos): conserva el orden de las claves del anterior y, en cada valor, el de sus campos. */
function reorderRegistry(items: Record<string, MapSound>, base: Record<string, MapSound> | undefined): Record<string, MapSound> {
  const out: Record<string, MapSound> = {};
  for (const [id, item] of Object.entries(items)) out[id] = reorderLike(item, base?.[id]);
  return out;
}

export interface Candidate {
  config: BitacoraConfig;
  /** Zonas administradas por Tiled (las que tienen mapa). */
  managed: string[];
  /** Origen en Tiled de cada elemento: por su ruta en maps.json. */
  sources: Map<string, Source>;
}

/**
 * Configuración candidata: la actual con `maps` y `placements` sustituidos por lo que dicen los mapas de Tiled, solo en las
 * zonas y aprendizajes que Tiled administra. Todo lo demás (textos, route, insignias, diálogos, interfaz, progreso) se copia
 * tal cual. Nada se escribe aquí: lo valida el llamador antes de aplicarlo.
 */
export function buildCandidate(base: BitacoraConfig, zones: ZoneImport[]): { candidate?: Candidate; issues: TiledIssue[] } {
  const issues: TiledIssue[] = [];
  const bySpot = new Map<string, ZoneImport>();
  for (const z of zones) {
    const previous = bySpot.get(z.zoneId);
    if (previous) issues.push({ source: { file: z.file, property: "zoneId" }, message: `la zona «${z.zoneId}» ya la define ${previous.file}: cada mapa debe tener un zoneId único` });
    else bySpot.set(z.zoneId, z);
  }

  const config = structuredClone(base);
  const maps: Record<string, MapZone> = {};
  for (const [id, zone] of Object.entries(base.maps)) maps[id] = bySpot.has(id) ? shapeZone((bySpot.get(id) as ZoneImport).zone, zone) : zone;
  for (const [id, z] of bySpot) if (!Object.hasOwn(maps, id)) maps[id] = shapeZone(z.zone, undefined);
  config.maps = maps;

  // Estaciones: exactamente una por aprendizaje activo entre los mapas administrados.
  const found = new Map<string, Array<{ zoneId: string; placement: Placement; source: Source }>>();
  for (const z of zones) for (const s of z.stations) found.set(s.learningId, [...(found.get(s.learningId) ?? []), { zoneId: z.zoneId, placement: s.placement, source: s.source }]);
  for (const [id, list] of found) {
    if (list.length > 1) {
      for (const f of list) issues.push({ source: { ...f.source, property: "learningId" }, message: `la estación «${id}» aparece ${list.length} veces (${list.map((l) => l.source.file).join(", ")}): debe haber una sola` });
    }
  }
  const placements: Record<string, Placement> = {};
  const sources = new Map<string, Source>();
  for (const z of zones) for (const [k, v] of z.sources) sources.set(k, v);
  for (const [id, p] of Object.entries(base.placements)) {
    const mine = found.get(id)?.[0];
    if (mine) {
      placements[id] = reorderLike({ ...mine.placement, zoneId: mine.zoneId }, p);
      sources.set(`placements.${id}`, mine.source);
    } else {
      if (config.route.includes(id) && bySpot.has(p.zoneId)) {
        issues.push({
          source: { file: bySpot.get(p.zoneId)?.file ?? p.zoneId, property: "learningId" },
          message: `falta la estación de «${id}» en la zona «${p.zoneId}»: para retirar un aprendizaje del recorrido archívalo quitándolo de route en bitacora.json; no se borra desde Tiled`,
        });
      }
      placements[id] = p;
    }
  }
  for (const [id, list] of found) {
    if (Object.hasOwn(placements, id)) continue;
    placements[id] = { ...list[0].placement, zoneId: list[0].zoneId };
    sources.set(`placements.${id}`, list[0].source);
  }
  for (const id of config.route) {
    if (!Object.hasOwn(placements, id)) issues.push({ source: { file: "(ningún mapa)", property: "learningId" }, message: `el aprendizaje activo «${id}» no tiene estación en ningún mapa ni ubicación en placements` });
  }
  config.placements = placements;
  if (issues.length) return { issues };
  return { candidate: { config, managed: [...bySpot.keys()], sources }, issues };
}

/** Lo que cambia entre dos configuraciones en el alcance de Tiled (`maps` y `placements`), en frases legibles. */
export function describeChanges(before: BitacoraConfig, after: BitacoraConfig): string[] {
  const out: string[] = [];
  const ids = [...new Set([...Object.keys(before.maps), ...Object.keys(after.maps)])];
  for (const id of ids) {
    const a = before.maps[id];
    const b = after.maps[id];
    if (!a) {
      out.push(`${id}: zona nueva`);
      continue;
    }
    if (!b) {
      out.push(`${id}: zona eliminada`);
      continue;
    }
    for (const key of ["label", "width", "height", "initialSpawnId"] as const) if (!jsonEqual(a[key], b[key])) out.push(`${id}.${key}: ${JSON.stringify(a[key])} → ${JSON.stringify(b[key])}`);
    for (const key of ["layers", "obstacles", "decorations", "ambient", "critters"] as const) {
      const x = (a[key] ?? []) as unknown[];
      const y = (b[key] ?? []) as unknown[];
      if (x.length !== y.length) out.push(`${id}.${key}: ${x.length} → ${y.length} (${y.length > x.length ? "+" : ""}${y.length - x.length})`);
      const changed = x.slice(0, Math.min(x.length, y.length)).filter((v, i) => !jsonEqual(v, y[i])).length;
      if (changed) out.push(`${id}.${key}: ${changed} modificado(s)`);
    }
    // Los sonidos se comparan por su identificador (`soundId`), no por posición.
    const sx = a.sounds ?? {};
    const sy = b.sounds ?? {};
    for (const k of new Set([...Object.keys(sx), ...Object.keys(sy)])) {
      if (!(k in sx)) out.push(`${id}.sounds.${k}: nuevo`);
      else if (!(k in sy)) out.push(`${id}.sounds.${k}: eliminado`);
      else if (!jsonEqual(sx[k], sy[k])) out.push(`${id}.sounds.${k}: modificado`);
    }
    for (const key of ["spawns", "portals"] as const) {
      const x = a[key] as Record<string, unknown>;
      const y = b[key] as Record<string, unknown>;
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (!(k in x)) out.push(`${id}.${key}.${k}: nuevo`);
        else if (!(k in y)) out.push(`${id}.${key}.${k}: eliminado`);
        else if (!jsonEqual(x[k], y[k])) out.push(`${id}.${key}.${k}: modificado`);
      }
    }
  }
  for (const id of new Set([...Object.keys(before.placements), ...Object.keys(after.placements)])) {
    const a = before.placements[id];
    const b = after.placements[id];
    if (!a) out.push(`placements.${id}: nuevo`);
    else if (!b) out.push(`placements.${id}: eliminado`);
    else if (!jsonEqual(a, b)) {
      const parts = (Object.keys({ ...a, ...b }) as Array<keyof Placement>).filter((k) => !jsonEqual(a[k], b[k])).join(", ");
      out.push(`placements.${id}: cambió ${parts}`);
    }
  }
  return out;
}

/** Anota un error de validación con el objeto de Tiled que lo causó, buscando el origen más específico de su ruta. */
export function annotate(issue: ConfigIssue, sources: Map<string, Source>): string {
  const path = issue.path.replace(/^(bitacora|maps)\.json › /, "");
  let best: { key: string; source: Source } | undefined;
  for (const [key, source] of sources) if ((path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`)) && (!best || key.length > best.key.length)) best = { key, source };
  return best ? `${formatSource(best.source)} (${path}): ${issue.message}` : `${issue.path}: ${issue.message}`;
}
