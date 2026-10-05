import { spatialReading } from "../../audio/spatialGain";
import { SFX_EVENT_IDS, SOUND_DEFAULTS, SOUND_LIMITS, type SfxEventId } from "../../config/sounds";
import type { MapSound, OneShotPreset, Point, SfxConfig } from "../../config/types";
import { ADJUSTMENTS_FORMAT, AUDIO_FORMATS, type AdjustmentsPackage, type AudioFormat, type FileVersions, type NewAsset, type SaveChange, type SaveRequest } from "./protocol";

/**
 * El modelo de los borradores del laboratorio de sonidos (SPEC 6.5), sin React ni audio: qué se editó, qué archivos de prueba se
 * usan y cómo se convierte todo en una solicitud de guardado o en un paquete de ajustes exportable. Todo es probable sin navegador.
 */

/** Un archivo elegido en el laboratorio se referencia así hasta que se guarda en el proyecto; nunca se escribe esta cadena en un JSON. */
export const LOCAL_PREFIX = "local:";
export const isLocalAssetId = (id: string): boolean => id.startsWith(LOCAL_PREFIX);
export const localKeyOf = (id: string): string => id.slice(LOCAL_PREFIX.length);
export const localAssetId = (key: string): string => `${LOCAL_PREFIX}${key}`;

export interface LocalFile {
  key: string;
  /** Nombre original, sin carpeta. */
  name: string;
  label: string;
  data: ArrayBuffer;
  durationSeconds: number;
  sizeBytes: number;
  /** Memoria que ocupa decodificado. */
  decodedBytes: number;
  format: AudioFormat;
}

export type Selection =
  | { kind: "emitter"; zoneId: string; soundId: string }
  | { kind: "preset"; event: SfxEventId }
  | { kind: "general" };

export interface Drafts {
  /** Emisores editados o nuevos, por `zoneId/soundId`. */
  sounds: Record<string, MapSound>;
  /** Presets editados; `null` es «quitar el efecto de esta acción». */
  presets: Partial<Record<SfxEventId, OneShotPreset | null>>;
  general: Partial<Pick<SfxConfig, "active" | "volume" | "maxVoices">>;
}

export const emptyDrafts = (): Drafts => ({ sounds: {}, presets: {}, general: {} });
export const soundKey = (zoneId: string, soundId: string): string => `${zoneId}/${soundId}`;
export const splitSoundKey = (key: string): { zoneId: string; soundId: string } => {
  const i = key.indexOf("/");
  return { zoneId: key.slice(0, i), soundId: key.slice(i + 1) };
};

export const hasDrafts = (d: Drafts): boolean => Object.keys(d.sounds).length + Object.keys(d.presets).length + Object.keys(d.general).length > 0;

/** Comparación por contenido, sin depender del orden de las claves. */
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
export const sameValue = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

const clamp = (n: number, min: number, max: number): number => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
const round = (n: number, digits = 3): number => Math.round(n * 10 ** digits) / 10 ** digits;

/** Un emisor nuevo con los valores por defecto de las clases del proyecto de Tiled, en la posición dada. */
export function newSound(shape: "point" | "rect", assetId: string, at: Point, label = "Sonido nuevo"): MapSound {
  const base = { label, assetId, enabled: true, volume: SOUND_DEFAULTS.volume, rate: SOUND_DEFAULTS.rate, fadeInMs: SOUND_DEFAULTS.fadeInMs, fadeOutMs: SOUND_DEFAULTS.fadeOutMs, playback: { mode: "loop" } as const };
  const at0 = { x: Math.round(at.x), y: Math.round(at.y) };
  return shape === "point"
    ? { ...base, shape: "point", position: at0, innerRadius: SOUND_DEFAULTS.innerRadius, radius: SOUND_DEFAULTS.radius }
    : { ...base, shape: "rect", area: { x: at0.x - 100, y: at0.y - 60, width: 200, height: 120 }, edgeFadePx: SOUND_DEFAULTS.edgeFadePx };
}

/** Deja un borrador dentro de los límites del contrato (lo que el panel permite escribir ya cae en ellos; esto lo asegura). */
export function clampSound(s: MapSound): MapSound {
  const common = {
    ...s,
    label: s.label.trim() || "Sonido",
    volume: round(clamp(s.volume, SOUND_LIMITS.volume.min, SOUND_LIMITS.volume.max)),
    rate: round(clamp(s.rate, SOUND_LIMITS.rate.min, SOUND_LIMITS.rate.max)),
    fadeInMs: Math.round(clamp(s.fadeInMs, 0, 60_000)),
    fadeOutMs: Math.round(clamp(s.fadeOutMs, 0, 60_000)),
  };
  const playback =
    s.playback.mode === "interval"
      ? (() => {
          const minMs = Math.round(clamp(s.playback.minMs, 0, 3_600_000));
          return { mode: "interval" as const, minMs, maxMs: Math.max(minMs, Math.round(clamp(s.playback.maxMs, 0, 3_600_000))) };
        })()
      : s.playback.mode === "enter"
        ? { mode: "enter" as const, cooldownMs: Math.round(clamp(s.playback.cooldownMs, 0, 3_600_000)) }
        : { mode: "loop" as const };
  if (s.shape === "point") {
    const radius = Math.max(1, Math.round(clamp(s.radius, 1, 100_000)));
    return { ...common, playback, shape: "point", position: { x: Math.round(s.position.x), y: Math.round(s.position.y) }, innerRadius: Math.min(radius, Math.round(clamp(s.innerRadius, 0, 100_000))), radius };
  }
  return {
    ...common,
    playback,
    shape: "rect",
    area: { x: Math.round(s.area.x), y: Math.round(s.area.y), width: Math.max(1, Math.round(s.area.width)), height: Math.max(1, Math.round(s.area.height)) },
    edgeFadePx: Math.round(clamp(s.edgeFadePx, 0, 100_000)),
  };
}

export const clampPreset = (p: OneShotPreset): OneShotPreset => ({
  assetId: p.assetId,
  volume: round(clamp(p.volume, SOUND_LIMITS.volume.min, SOUND_LIMITS.volume.max)),
  rate: round(clamp(p.rate, SOUND_LIMITS.rate.min, SOUND_LIMITS.rate.max)),
});

/** Los emisores de una zona tal como quedan aplicando los borradores a los guardados. */
export function zoneSoundsWith(zoneId: string, saved: Record<string, MapSound> | undefined, drafts: Drafts): Record<string, MapSound> {
  const out: Record<string, MapSound> = { ...(saved ?? {}) };
  for (const [key, sound] of Object.entries(drafts.sounds)) {
    const k = splitSoundKey(key);
    if (k.zoneId === zoneId) out[k.soundId] = sound;
  }
  return out;
}

/** La configuración `audio.sfx` aplicando los borradores (volumen general, límite de voces y presets). */
export function sfxWith(saved: SfxConfig | undefined, drafts: Drafts): SfxConfig | undefined {
  if (!saved && !Object.keys(drafts.presets).length && !Object.keys(drafts.general).length) return saved;
  const events = { ...(saved?.events ?? {}) } as NonNullable<SfxConfig["events"]>;
  for (const [event, preset] of Object.entries(drafts.presets) as Array<[SfxEventId, OneShotPreset | null]>) {
    if (preset === null) delete events[event];
    else events[event] = preset;
  }
  return { active: true, volume: 0.8, maxVoices: 12, ...(saved ?? {}), ...drafts.general, events };
}

/** El volumen con el que se oye un emisor en una posición del oyente, y su distancia (la misma fórmula del juego). */
export const readingAt = (sound: MapSound, listener: Point) => spatialReading(sound, listener);

// ---- solicitudes de guardado y paquetes ---------------------------------------------------------------------------------

export type SaveScope = Selection | "all";

function changeFor(key: string, drafts: Drafts): SaveChange[] {
  const out: SaveChange[] = [];
  const sound = drafts.sounds[key];
  if (sound) {
    const { zoneId, soundId } = splitSoundKey(key);
    out.push(isLocalAssetId(sound.assetId) ? { type: "sound", zoneId, soundId, sound, assetKey: localKeyOf(sound.assetId) } : { type: "sound", zoneId, soundId, sound });
  }
  return out;
}

function presetChange(event: SfxEventId, preset: OneShotPreset | null): SaveChange {
  return preset !== null && isLocalAssetId(preset.assetId) ? { type: "preset", event, preset, assetKey: localKeyOf(preset.assetId) } : { type: "preset", event, preset };
}

/** Los cambios que corresponden a un alcance: un emisor, un preset, los ajustes generales o todo. */
export function changesFor(drafts: Drafts, scope: SaveScope): SaveChange[] {
  if (scope === "all") {
    return [
      ...Object.keys(drafts.sounds).flatMap((k) => changeFor(k, drafts)),
      ...SFX_EVENT_IDS.filter((e) => e in drafts.presets).map((e) => presetChange(e, drafts.presets[e] ?? null)),
      ...(Object.keys(drafts.general).length ? [{ type: "general", sfx: drafts.general } as SaveChange] : []),
    ];
  }
  if (scope.kind === "emitter") return changeFor(soundKey(scope.zoneId, scope.soundId), drafts);
  if (scope.kind === "preset") return scope.event in drafts.presets ? [presetChange(scope.event, drafts.presets[scope.event] ?? null)] : [];
  return Object.keys(drafts.general).length ? [{ type: "general", sfx: drafts.general }] : [];
}

export const assetKeysOf = (changes: SaveChange[]): string[] => [...new Set(changes.flatMap((c) => ("assetKey" in c && c.assetKey ? [c.assetKey] : [])))];

export function bytesToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToBytes(text: string): ArrayBuffer {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

function newAssets(keys: string[], files: Map<string, LocalFile>): NewAsset[] | string {
  const out: NewAsset[] = [];
  for (const key of keys) {
    const f = files.get(key);
    if (!f) return `el archivo de prueba «${key}» ya no está cargado en el laboratorio: vuelve a elegirlo`;
    out.push({ key, name: f.name, label: f.label, dataBase64: bytesToBase64(f.data), durationSeconds: f.durationSeconds });
  }
  return out;
}

/** La solicitud al servidor de desarrollo para guardar un alcance, con solo los archivos nuevos que ese alcance usa. */
export function buildSaveRequest(base: FileVersions, drafts: Drafts, files: Map<string, LocalFile>, scope: SaveScope): SaveRequest | { error: string } {
  const changes = changesFor(drafts, scope);
  if (!changes.length) return { error: "no hay cambios que guardar en lo seleccionado" };
  const assets = newAssets(assetKeysOf(changes), files);
  if (typeof assets === "string") return { error: assets };
  return { version: 1, base, assets, changes };
}

/** El paquete de ajustes exportable: JSON versionado, portable (lleva dentro los archivos nuevos) e importable por la línea de comandos. */
export function buildPackage(base: FileVersions, drafts: Drafts, files: Map<string, LocalFile>, now = new Date()): AdjustmentsPackage | { error: string } {
  const request = buildSaveRequest(base, drafts, files, "all");
  if ("error" in request) return { error: "no hay ajustes que exportar" };
  return { format: ADJUSTMENTS_FORMAT, version: 1, exportedAt: now.toISOString(), base: request.base, assets: request.assets, changes: request.changes };
}

/** Lee un paquete (de un archivo) comprobando su forma. Devuelve el paquete o el motivo por el que no vale. */
export function parsePackage(text: string): AdjustmentsPackage | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "el archivo no es JSON" };
  }
  const p = raw as Partial<AdjustmentsPackage> | null;
  if (typeof p !== "object" || p === null || p.format !== ADJUSTMENTS_FORMAT) return { error: "no es un paquete de ajustes del laboratorio de sonidos" };
  if (p.version !== 1) return { error: `versión de paquete no admitida (${String(p.version)}); este laboratorio entiende la 1` };
  if (!Array.isArray(p.changes) || !Array.isArray(p.assets) || typeof p.base !== "object" || p.base === null) return { error: "al paquete le faltan `changes`, `assets` o `base`" };
  return p as AdjustmentsPackage;
}

/** Aplica un paquete importado sobre los borradores: sus archivos pasan a `local:<key>` y sus cambios se vuelven borradores. */
export function draftsFromPackage(pkg: AdjustmentsPackage): Drafts {
  const d = emptyDrafts();
  for (const c of pkg.changes) {
    if (c.type === "sound") d.sounds[soundKey(c.zoneId, c.soundId)] = c.assetKey ? { ...c.sound, assetId: localAssetId(c.assetKey) } : c.sound;
    else if (c.type === "preset") d.presets[c.event] = c.preset === null ? null : c.assetKey ? { ...c.preset, assetId: localAssetId(c.assetKey) } : c.preset;
    else if (c.type === "general") d.general = { ...d.general, ...c.sfx };
  }
  return d;
}

/** El formato de un archivo por su extensión (o `null` si el laboratorio no lo admite). */
export function formatOf(name: string): AudioFormat | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return (AUDIO_FORMATS as readonly string[]).includes(ext) ? (ext as AudioFormat) : null;
}
