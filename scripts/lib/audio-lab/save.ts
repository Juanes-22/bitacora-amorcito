import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { mergeConfig } from "../../../src/config/mapsFile";
import { SFX_EVENT_IDS, SOUND_LIMITS } from "../../../src/config/sounds";
import type { AssetEntry, AssetManifest, BitacoraContent, MapSound, MapsFile, OneShotPreset, SfxConfig } from "../../../src/config/types";
import { AUDIO_LAB_LIMITS, type FileVersions, type NewAsset, type SaveChange, type SaveRequest, type SaveResult } from "../../../src/dev/audio-lab/protocol";
import { backupFile, readProject, writeAtomic, type Paths } from "../tiled/files";
import { projectJson, computeImport, runImport, type ImportInputs } from "../tiled/run";
import { mergeProject } from "../tiled/project";
import { tiledJson, usesUnicodeEscapes } from "../tiled/tiledJson";
import type { ImportReport } from "../tiled/run";
import type { TiledMap } from "../tiled/types";
import { AudioFileError, inspectAudioFile, slugify } from "./audioFile";
import { readAudioSfx, setAudioSfx } from "./configText";
import { acquireSaveLock, SaveBusyError } from "./lock";
import { addAssetEntries } from "./manifestText";
import { patchSound, PatchError } from "./tmj";
import { readVersions, zoneMaps } from "./versions";

// Guardado del laboratorio de sonidos en el proyecto (SPEC 6.5). UNA operación serializada que comparten el servidor de desarrollo y la
// importación por línea de comandos: lee los archivos, comprueba que no cambiaron desde que los vio el panel, construye todo el resultado
// en memoria, lo valida con la misma validación del proyecto y, solo entonces, escribe con copias previas y recuperación si algo falla.

const CLEAN_DEFAULT_SFX: SfxConfig = { active: true, volume: 0.8, maxVoices: 12 };

export interface SaveOptions {
  /** No comprobar las huellas de `base` (la importación de un paquete puede aceptar archivos distintos a los de su origen). */
  ignoreBase?: boolean;
  /** Solo construir y validar: no se escribe nada. */
  dryRun?: boolean;
  /** Se llama al empezar a escribir y al terminar (con los archivos tocados), para que quien vigila los JSON recargue una sola vez. */
  onWrite?: { begin(): void; end(written: string[]): void };
}

interface Write {
  file: string;
  data: string | Uint8Array;
}

/** Una cola: dos guardados nunca se mezclan dentro del proceso (entre procesos lo impide el cerrojo). */
let queue: Promise<unknown> = Promise.resolve();
export function saveAudioLab(paths: Paths, request: SaveRequest, options: SaveOptions = {}): Promise<SaveResult> {
  const run = queue.then(() => saveNow(paths, request, options));
  queue = run.catch(() => undefined);
  return run;
}

const fail = (reason: "conflict" | "invalid" | "busy" | "error", errors: string[], changed?: string[]): SaveResult => ({ ok: false, reason, errors, ...(changed ? { changed } : {}) });
const rel = (paths: Paths, file: string): string => relative(paths.root, file).split("\\").join("/");

/** Comprueba la forma de la solicitud (viene de un navegador o de un archivo: no se confía en ella). */
export function validateRequest(req: unknown): string[] {
  const errors: string[] = [];
  const r = req as Partial<SaveRequest> | null;
  if (typeof r !== "object" || r === null || r.version !== 1) return ["la solicitud no es de la versión 1"];
  if (typeof r.base !== "object" || r.base === null) errors.push("falta `base` (las huellas de los archivos que vio el panel)");
  if (!Array.isArray(r.assets)) errors.push("`assets` debe ser una lista");
  if (!Array.isArray(r.changes) || r.changes.length === 0) errors.push("no hay cambios que guardar");
  if (errors.length) return errors;
  const keys = new Set<string>();
  for (const a of r.assets as NewAsset[]) {
    if (typeof a?.key !== "string" || typeof a.name !== "string" || typeof a.dataBase64 !== "string" || typeof a.durationSeconds !== "number") errors.push("un archivo nuevo no tiene key, name, dataBase64 y durationSeconds");
    else if (keys.has(a.key)) errors.push(`el archivo «${a.key}» está repetido`);
    else keys.add(a.key);
  }
  (r.changes as SaveChange[]).forEach((c, i) => {
    const at = `changes[${i}]`;
    if (c?.type === "sound") {
      if (typeof c.zoneId !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(c.soundId ?? "") || typeof c.sound !== "object" || c.sound === null) errors.push(`${at}: un sonido necesita zoneId, un soundId válido y sus valores`);
      else if (c.sound.shape !== "point" && c.sound.shape !== "rect") errors.push(`${at}.sound.shape: debe ser «point» o «rect»`);
      else if (typeof c.sound.playback !== "object" || c.sound.playback === null) errors.push(`${at}.sound.playback: falta`);
    } else if (c?.type === "preset") {
      if (!(SFX_EVENT_IDS as readonly string[]).includes(c.event)) errors.push(`${at}.event: «${String(c.event)}» no es una acción con sonido (${SFX_EVENT_IDS.join(", ")})`);
      else if (c.preset !== null && (typeof c.preset !== "object" || typeof c.preset.assetId !== "string")) errors.push(`${at}.preset: debe ser null o {assetId, volume, rate}`);
    } else if (c?.type === "general") {
      if (typeof c.sfx !== "object" || c.sfx === null) errors.push(`${at}.sfx: falta`);
    } else if (c?.type === "asset") {
      if (typeof c.assetKey !== "string") errors.push(`${at}.assetKey: falta`);
    } else errors.push(`${at}.type: desconocido`);
    const key = (c as { assetKey?: string })?.assetKey;
    if (key !== undefined && !keys.has(key)) errors.push(`${at}: el archivo «${key}» no está en la solicitud`);
  });
  return errors;
}

/** Qué archivos va a escribir cada cambio: de ahí salen los conflictos que cuentan (lo que cambió y no se va a tocar no importa). */
function touchedBy(changes: SaveChange[], hasAssets: boolean): { manifest: boolean; project: boolean; maps: boolean; config: boolean; zones: Set<string> } {
  const t = { manifest: hasAssets, project: hasAssets, maps: false, config: false, zones: new Set<string>() };
  for (const c of changes) {
    if (c.type === "sound") {
      t.maps = true;
      t.zones.add(c.zoneId);
    } else if (c.type === "preset" || c.type === "general") t.config = true;
  }
  return t;
}

function saveNow(paths: Paths, request: SaveRequest, options: SaveOptions): SaveResult {
  const problems = validateRequest(request);
  if (problems.length) return fail("invalid", problems);
  let release: (() => void) | undefined;
  const written: string[] = [];
  const journal: Array<{ file: string; previous: Buffer | null }> = [];
  let began = false;
  try {
    if (!options.dryRun) release = acquireSaveLock(paths);

    // 1. Lo que hay en el disco y si es lo que vio el panel.
    const current = readVersions(paths);
    const t = touchedBy(request.changes, request.assets.length > 0);
    if (!options.ignoreBase) {
      const changed: string[] = [];
      const b = request.base as FileVersions;
      if (t.manifest && b.manifest !== current.manifest) changed.push(rel(paths, paths.manifestFile));
      if (t.project && b.project !== current.project) changed.push(rel(paths, paths.projectFile));
      if (t.maps && b.maps !== current.maps) changed.push(rel(paths, paths.mapsFile));
      if (t.config && b.config !== current.config) changed.push(rel(paths, paths.configFile));
      for (const z of t.zones) if (b.zones?.[z] !== current.zones[z]) changed.push(`tools/tiled/maps (zona «${z}»)`);
      if (changed.length) return fail("conflict", [`cambió en el disco desde que se abrió el laboratorio: ${changed.join(", ")}. Recarga la página para ver la versión actual y vuelve a aplicar tus ajustes.`], changed);
    }

    const manifestText = readFileSync(paths.manifestFile, "utf8");
    const manifest = JSON.parse(manifestText) as AssetManifest;
    const configText = readFileSync(paths.configFile, "utf8");
    const mapsText = readFileSync(paths.mapsFile, "utf8");
    const project = readProject(paths);

    // 2. Archivos nuevos: se comprueban y se les da un ID y un nombre que no existan (nunca se sustituye un recurso).
    const staged: Array<{ file: string; bytes: Buffer }> = [];
    const entries: Array<[string, AssetEntry]> = [];
    const registered: Record<string, string> = {};
    for (const a of request.assets) {
      let bytes: Buffer;
      try {
        bytes = Buffer.from(a.dataBase64, "base64");
      } catch {
        return fail("invalid", [`«${a.name}»: los datos no son base64 válido`]);
      }
      let info;
      try {
        info = inspectAudioFile(a.name, bytes, a.durationSeconds);
      } catch (e) {
        if (e instanceof AudioFileError) return fail("invalid", [e.message]);
        throw e;
      }
      const sha = createHash("sha256").update(bytes).digest("hex");
      const same = Object.entries(manifest.assets).find(([, e]) => e.kind === "sfx" && e.sha256 === sha);
      if (same) {
        registered[a.key] = same[0]; // el mismo archivo ya está en el catálogo: se reutiliza
        continue;
      }
      const base = slugify(a.name);
      let slug = base;
      for (let n = 2; manifest.assets[`audio.sfx.${slug}`] || entries.some(([id]) => id === `audio.sfx.${slug}`) || existsSync(join(paths.assetsDir, "audio", "sfx", `${slug}.${info.format}`)); n++) slug = `${base}-${n}`;
      const id = `audio.sfx.${slug}`;
      const path = `audio/sfx/${slug}.${info.format}`;
      const label = a.label?.trim() || `Efecto de sonido: ${base.replace(/-/g, " ")}`;
      entries.push([id, { path, type: "audio", format: info.format, category: "audio", label, kind: "sfx", sizeBytes: bytes.length, sha256: sha, originalPath: basename(a.name), durationSeconds: info.durationSeconds }]);
      staged.push({ file: join(paths.assetsDir, path), bytes });
      registered[a.key] = id;
    }
    const manifestNext = entries.length ? addAssetEntries(manifestText, entries) : manifestText;
    const manifestJson = entries.length ? (JSON.parse(manifestNext) as AssetManifest) : manifest;
    const projectNext = entries.length ? projectJson(mergeProject(project, manifestJson)) : null;

    // 3. Los cambios: emisores en los mapas de Tiled; asociaciones y volumen general en audio.sfx.
    const maps = zoneMaps(paths);
    const patched = new Map<string, { file: string; map: TiledMap; original: string }>();
    const notes: string[] = [];
    let sfx: SfxConfig | undefined = readAudioSfx(configText);
    let sfxTouched = false;
    const resolveAsset = (assetId: string, key?: string): string => (key !== undefined ? registered[key] : assetId);
    for (const c of request.changes) {
      if (c.type === "sound") {
        const zone = maps.get(c.zoneId);
        if (!zone) return fail("invalid", [`la zona «${c.zoneId}» no tiene un mapa de Tiled en tools/tiled/maps`]);
        const entry = patched.get(c.zoneId) ?? { file: zone.file, map: JSON.parse(zone.text) as TiledMap, original: zone.text };
        patched.set(c.zoneId, entry);
        const sound: MapSound = { ...c.sound, assetId: resolveAsset(c.sound.assetId, c.assetKey) };
        try {
          const r = patchSound(entry.map, c.soundId, sound);
          notes.push(`${c.zoneId}.${c.soundId}: ${r.action === "created" ? "creado" : r.action === "updated" ? "actualizado" : "sin cambios"}`);
        } catch (e) {
          if (e instanceof PatchError) return fail("invalid", [e.message]);
          throw e;
        }
      } else if (c.type === "preset") {
        sfx = { ...CLEAN_DEFAULT_SFX, ...(sfx ?? {}) };
        const events = { ...(sfx.events ?? {}) } as Partial<Record<(typeof SFX_EVENT_IDS)[number], OneShotPreset>>;
        if (c.preset === null) delete events[c.event];
        else events[c.event] = { assetId: resolveAsset(c.preset.assetId, c.assetKey), volume: c.preset.volume, rate: c.preset.rate };
        sfx = { ...sfx, events };
        sfxTouched = true;
        notes.push(`audio.sfx.events.${c.event}: ${c.preset === null ? "quitado" : "guardado"}`);
      } else if (c.type === "general") {
        sfx = { ...CLEAN_DEFAULT_SFX, ...(sfx ?? {}) };
        const g = c.sfx;
        if (g.active !== undefined) sfx.active = g.active;
        if (g.volume !== undefined) sfx.volume = Math.min(SOUND_LIMITS.volume.max, Math.max(SOUND_LIMITS.volume.min, g.volume));
        if (g.maxVoices !== undefined) sfx.maxVoices = g.maxVoices;
        sfxTouched = true;
        notes.push("audio.sfx: ajustes generales guardados");
      } else notes.push(`${registered[c.assetKey]}: incorporado al catálogo`);
    }
    const configNext = sfxTouched && sfx ? setAudioSfx(configText, sfx) : configText;

    // 4. El resultado completo, validado en memoria con la validación del proyecto. Los archivos nuevos ya tienen que existir para ello.
    for (const s of staged) {
      mkdirSync(dirname(s.file), { recursive: true });
      journal.push({ file: s.file, previous: null });
      writeAtomic(s.file, s.bytes);
    }
    const inputs: ImportInputs = {
      manifestJson,
      base: mergeConfig(JSON.parse(configNext) as BitacoraContent, JSON.parse(mapsText) as MapsFile),
      mapsText,
      project: project && projectNext ? (JSON.parse(projectNext) as typeof project) : project,
      maps: [...maps].map(([zoneId, m]) => ({ file: m.file, map: patched.get(zoneId)?.map ?? (JSON.parse(m.text) as TiledMap) })),
    };
    const report: ImportReport = { ok: false, inSync: false, written: false, errors: [], warnings: [], changes: [], zones: [], info: [] };
    const computed = computeImport(paths, inputs, report);
    if (!computed.ok) {
      rollback(journal);
      return fail("invalid", computed.report.errors);
    }
    if (options.dryRun) {
      rollback(journal);
      return { ok: true, versions: current, saved: notes, assets: registered, warnings: report.warnings };
    }

    // 5. Escritura, con copia de lo que se sustituye; si algo falla, se recupera todo.
    const writes: Write[] = [];
    if (entries.length) writes.push({ file: paths.manifestFile, data: manifestNext });
    if (projectNext !== null && projectNext !== readFileSync(paths.projectFile, "utf8")) writes.push({ file: paths.projectFile, data: projectNext });
    for (const e of patched.values()) {
      const text = tiledJson(e.map as unknown as Record<string, unknown>, { asciiOnly: usesUnicodeEscapes(e.original) });
      if (text !== e.original) writes.push({ file: e.file, data: text });
    }
    if (computed.mapsText !== null && computed.mapsText !== mapsText) writes.push({ file: paths.mapsFile, data: computed.mapsText });
    if (configNext !== configText) writes.push({ file: paths.configFile, data: configNext });

    options.onWrite?.begin();
    began = true;
    for (const w of writes) {
      const previous = existsSync(w.file) ? readFileSync(w.file) : null;
      if (previous) backupFile(paths, w.file);
      journal.push({ file: w.file, previous });
      writeAtomic(w.file, w.data);
      written.push(rel(paths, w.file));
    }
    for (const s of staged) written.push(rel(paths, s.file));

    // 6. Comprobación final sobre lo escrito (lo mismo que hace `tiled:check` en el build).
    const after = runImport(paths, { apply: false });
    if (!after.ok || !after.inSync) {
      rollback(journal);
      return fail("error", ["lo escrito no pasa la comprobación final de Tiled; se recuperó el estado anterior.", ...after.errors, ...(after.inSync ? [] : after.changes.map((c) => `pendiente: ${c}`))]);
    }
    return { ok: true, versions: readVersions(paths), saved: [...notes, ...written.map((w) => `escrito ${w}`)], assets: registered, warnings: report.warnings };
  } catch (e) {
    rollback(journal);
    if (e instanceof SaveBusyError) return fail("busy", [e.message]);
    return fail("error", [`el guardado falló y se recuperó el estado anterior: ${(e as Error).message}`]);
  } finally {
    if (began) options.onWrite?.end(written);
    release?.();
  }
}

/** Devuelve cada archivo escrito a lo que tenía (o lo borra si no existía), del último al primero. */
function rollback(journal: Array<{ file: string; previous: Buffer | null }>): void {
  for (const j of [...journal].reverse()) {
    try {
      if (j.previous === null) rmSync(j.file, { force: true });
      else writeAtomic(j.file, j.previous);
    } catch {
      /* se intenta con el resto: lo que no se pueda devolver queda anotado en las copias de tools/tiled/backups */
    }
  }
  journal.length = 0;
}

