import type { MusicPlayer } from "../../audio/MusicPlayer";
import type { SfxService } from "../../audio/SfxService";
import type { SfxDiagnostics, VoiceRef } from "../../audio/sfxTypes";
import type { ControlReasons } from "../../app/controlReasons";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { SfxEventId } from "../../config/sounds";
import type { BitacoraConfig, MapSound, OneShotPreset, Point, SfxConfig } from "../../config/types";
import {
  assetKeysOf, buildPackage, buildSaveRequest, clampPreset, clampSound, draftsFromPackage, emptyDrafts, formatOf, hasDrafts, isLocalAssetId, localAssetId,
  localKeyOf, newSound, parsePackage, readingAt, sameValue, sfxWith, soundKey, splitSoundKey, zoneSoundsWith, base64ToBytes, type Drafts, type LocalFile, type SaveScope, type Selection,
} from "./draft";
import { AUDIO_LAB_HEADER, AUDIO_LAB_LIMITS, AUDIO_LAB_ROUTE, type FileVersions, type SaveRequest, type SaveResult } from "./protocol";

/**
 * El laboratorio de sonidos (SPEC 6.5), sin React: el estado que muestra el panel y todo lo que hace con el servicio de efectos. Solo
 * existe en desarrollo (`?audioLab=1`). No crea otro juego ni otro contexto de audio: usa el `SfxService` del juego en marcha, así que
 * los cambios se oyen en vivo y recargar el juego no es necesario.
 */

export type LabMode = "virtual" | "walking";

export interface TestVoiceInfo {
  id: number;
  label: string;
  loop: boolean;
  /** A quién pertenece la prueba: `zona/emisor`, `preset:acción` o `file:clave`. */
  owner: string;
}

export interface ServerStatus {
  status: "checking" | "ready" | "offline";
  versions?: FileVersions;
  /** Zonas con mapa de Tiled: solo en ellas se guardan emisores. */
  zones: string[];
  message?: string;
}

export interface SaveStatus {
  status: "idle" | "working" | "ok" | "error";
  /** `check` (solo comprobar) o `save`. */
  action?: "check" | "save";
  messages: string[];
  warnings: string[];
}

export interface LabState {
  /** La zona que se ve en el mapa del laboratorio. */
  zoneId: string;
  mode: LabMode;
  /** Posición del oyente virtual (modo mapa congelado). */
  virtual: Point;
  selection: Selection | null;
  drafts: Drafts;
  files: LocalFile[];
  tests: TestVoiceInfo[];
  repeat: boolean;
  /** «Detener todo» calló también el ambiente del mapa; sigue callado hasta «Reanudar el ambiente» o hasta cerrar el panel. */
  ambientPaused: boolean;
  solo: boolean;
  /** Aplicar la distancia al oyente a las pruebas (apagado: se oye al volumen del emisor, sin atenuar). */
  spatialTest: boolean;
  diagnostics: SfxDiagnostics;
  server: ServerStatus;
  save: SaveStatus;
  /** Última frase de estado (se anuncia con `aria-live`). */
  notice: string;
  /** Sesión: lo ya aplicado a la sesión del juego (para el aviso «aplicado»). */
  applied: boolean;
}

interface TestVoice {
  ref: VoiceRef;
  /** A quién pertenece: `zona/emisor`, `preset:acción` o `file:clave`. Una prueba nueva del mismo dueño sustituye a la anterior. */
  owner: string;
  info: TestVoiceInfo;
  /** Cómo se calcula su volumen en cada paso: el emisor en edición o un preset. */
  source: { kind: "emitter"; key: string } | { kind: "neutral"; volume: () => number; rate: () => number };
  startedAt: number;
  stopping: number | null;
  fadeInMs: number;
  fadeOutMs: number;
}

export interface LabDeps {
  sfx: SfxService;
  music: MusicPlayer | null;
  config: BitacoraConfig;
  assets: AssetRegistry;
  controls: ControlReasons;
  /** Para pruebas: sustituye `fetch`. */
  fetcher?: typeof fetch;
  now?: () => number;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}

const FREEZE = "audio-lab";
const STORAGE_KEY = "bitacora:audio-lab:v1";
const STEP_MS = 80;
const REPEAT_GAP_MS = 350;
const MAX_LOCAL_FILES = 8;

const clone = <T,>(v: T): T => structuredClone(v);

export class AudioLabController {
  private state: LabState;
  private readonly listeners = new Set<() => void>();
  private tests: TestVoice[] = [];
  private stepTimer: ReturnType<typeof setInterval> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private repeatTimer: ReturnType<typeof setTimeout> | undefined;
  private fileToken = 0;
  private nextFile = 1;
  private nextEmitter = 1;
  private open = false;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly storage: LabDeps["storage"];

  constructor(private readonly deps: LabDeps) {
    this.fetcher = deps.fetcher ?? ((...a) => fetch(...a));
    this.now = deps.now ?? (() => performance.now());
    this.storage = deps.storage === undefined ? safeStorage() : deps.storage;
    const zoneId = deps.sfx.zoneId ?? Object.keys(deps.config.maps)[0] ?? "";
    const stored = this.restore();
    this.state = {
      zoneId: stored.zoneId && deps.config.maps[stored.zoneId] ? stored.zoneId : zoneId,
      mode: "virtual",
      virtual: this.defaultListener(stored.zoneId && deps.config.maps[stored.zoneId] ? stored.zoneId : zoneId),
      selection: stored.selection ?? null,
      drafts: stored.drafts ?? emptyDrafts(),
      files: [],
      tests: [],
      repeat: false,
      ambientPaused: false,
      solo: false,
      spatialTest: true,
      diagnostics: deps.sfx.diagnostics(),
      server: { status: "checking", zones: [] },
      save: { status: "idle", messages: [], warnings: [] },
      notice: "",
      applied: false,
    };
  }

  // ---- estado ------------------------------------------------------------------------------------------------------

  getState = (): LabState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<LabState>): void {
    this.state = { ...this.state, ...patch };
    this.persist();
    this.listeners.forEach((l) => l());
  }

  private notice(text: string): void {
    this.set({ notice: text });
  }

  // ---- ciclo del panel ------------------------------------------------------------------------------------------------

  /** El panel se abre: congela el mapa (modo mapa), activa el oyente virtual y empieza a medir. */
  async opened(): Promise<void> {
    this.open = true;
    this.applyMode(this.state.mode);
    this.pollTimer ??= setInterval(() => this.set({ diagnostics: this.deps.sfx.diagnostics() }), 250);
    await this.refreshServer();
  }

  /** El panel se cierra: nada de lo del laboratorio queda sonando ni congelando el mapa. Los borradores se conservan. */
  closed(): void {
    this.open = false;
    this.stopTests();
    this.setSolo(false);
    this.setAmbientPaused(false);
    this.deps.controls.set(FREEZE, false);
    this.deps.sfx.setListenerOverride(null);
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  dispose(): void {
    this.closed();
    for (const f of this.state.files) this.deps.sfx.releaseTemp(f.key);
    this.listeners.clear();
  }

  // ---- modo y oyente -------------------------------------------------------------------------------------------------

  private defaultListener(zoneId: string): Point {
    const zone = this.deps.config.maps[zoneId];
    if (!zone) return { x: 0, y: 0 };
    const spawn = zone.spawns[zone.initialSpawnId];
    return spawn ?? { x: Math.round(zone.width / 2), y: Math.round(zone.height / 2) };
  }

  private applyMode(mode: LabMode): void {
    const virtual = mode === "virtual";
    this.deps.controls.set(FREEZE, virtual && this.open);
    this.deps.sfx.setListenerOverride(virtual && this.open ? this.state.virtual : null);
  }

  setMode(mode: LabMode): void {
    if (mode === this.state.mode) return;
    this.set({ mode });
    this.applyMode(mode);
    this.notice(mode === "virtual" ? "Modo mapa: Vanessa queda quieta y escuchas desde el punto que muevas." : "Modo recorrido: camina con las flechas y escucha lo que oiría el visitante.");
  }

  moveListener(point: Point): void {
    const zone = this.deps.config.maps[this.state.zoneId];
    const p = { x: Math.round(Math.min(zone?.width ?? point.x, Math.max(0, point.x))), y: Math.round(Math.min(zone?.height ?? point.y, Math.max(0, point.y))) };
    this.set({ virtual: p });
    if (this.state.mode === "virtual" && this.state.zoneId === this.deps.sfx.zoneId) this.deps.sfx.setListenerOverride(p);
  }

  setZone(zoneId: string): void {
    if (!this.deps.config.maps[zoneId] || zoneId === this.state.zoneId) return;
    this.set({ zoneId, virtual: this.defaultListener(zoneId) });
    if (this.state.mode === "virtual" && zoneId === this.deps.sfx.zoneId) this.deps.sfx.setListenerOverride(this.defaultListener(zoneId));
  }

  /** La posición desde la que se escucha una prueba ahora mismo. */
  listener(): Point {
    if (this.state.mode === "virtual") return this.state.virtual;
    return this.deps.sfx.diagnostics().listener ?? this.state.virtual;
  }

  // ---- selección y borradores ------------------------------------------------------------------------------------------

  select(selection: Selection | null): void {
    if (selection && sameValue(selection, this.state.selection)) return;
    this.set({ selection });
  }

  /** El emisor tal como está guardado en el proyecto. */
  savedSound(zoneId: string, soundId: string): MapSound | undefined {
    return this.deps.config.maps[zoneId]?.sounds?.[soundId];
  }

  /** El emisor con su borrador aplicado (lo que se oye y se muestra en el panel). */
  soundOf(zoneId: string, soundId: string): MapSound | undefined {
    return this.state.drafts.sounds[soundKey(zoneId, soundId)] ?? this.savedSound(zoneId, soundId);
  }

  zoneSounds(zoneId: string): Record<string, MapSound> {
    return zoneSoundsWith(zoneId, this.deps.config.maps[zoneId]?.sounds, this.state.drafts);
  }

  /** Cambia un emisor (un borrador): lo que ya coincide con lo guardado deja de ser borrador. */
  editSound(zoneId: string, soundId: string, next: MapSound): void {
    const key = soundKey(zoneId, soundId);
    const value = clampSound(next);
    const saved = this.savedSound(zoneId, soundId);
    const drafts = clone(this.state.drafts);
    if (saved && sameValue(saved, value)) delete drafts.sounds[key];
    else drafts.sounds[key] = value;
    this.set({ drafts, applied: false, save: IDLE_SAVE });
    // Un emisor que ya suena en el mapa se oye con el cambio en el acto; uno nuevo espera a «Aplicar a esta sesión».
    if (zoneId === this.deps.sfx.zoneId && this.deps.sfx.emitterIds().includes(soundId) && !isLocalAssetId(value.assetId)) this.deps.sfx.setEmitterDraft(soundId, value);
  }

  editPreset(event: SfxEventId, preset: OneShotPreset | null): void {
    const saved = this.deps.config.audio.sfx?.events?.[event] ?? null;
    const value = preset === null ? null : clampPreset(preset);
    const drafts = clone(this.state.drafts);
    if (sameValue(saved, value)) delete drafts.presets[event];
    else drafts.presets[event] = value;
    this.set({ drafts, applied: false, save: IDLE_SAVE });
  }

  editGeneral(patch: Partial<NonNullable<Drafts["general"]>>): void {
    const saved = this.deps.config.audio.sfx;
    const drafts = clone(this.state.drafts);
    const merged = { ...drafts.general, ...patch };
    for (const k of Object.keys(merged) as Array<keyof typeof merged>) {
      if (k === "volume" && merged.volume !== undefined) merged.volume = Math.min(1, Math.max(0, merged.volume));
      if (k === "maxVoices" && merged.maxVoices !== undefined) merged.maxVoices = Math.min(64, Math.max(1, Math.round(merged.maxVoices)));
      if (saved && saved[k] === merged[k]) delete merged[k];
    }
    drafts.general = merged;
    this.set({ drafts, applied: false, save: IDLE_SAVE });
    // El volumen general se oye en vivo: no depende del mapa.
    this.deps.sfx.setConfig(sfxWith(saved, drafts));
  }

  /** Un emisor nuevo en la posición del oyente, con el recurso dado. Devuelve su identificador. */
  addEmitter(shape: "point" | "rect", assetId: string): string {
    const zoneId = this.state.zoneId;
    const existing = this.zoneSounds(zoneId);
    let soundId = `nuevo-${this.nextEmitter++}`;
    while (existing[soundId]) soundId = `nuevo-${this.nextEmitter++}`;
    this.editSound(zoneId, soundId, newSound(shape, assetId, this.listener(), `Sonido nuevo ${this.nextEmitter - 1}`));
    this.select({ kind: "emitter", zoneId, soundId });
    return soundId;
  }

  /** Quita los borradores de lo seleccionado y vuelve a lo guardado (también en la sesión). */
  reset(scope: Selection | "all"): void {
    const drafts = clone(this.state.drafts);
    const removed: string[] = [];
    if (scope === "all") {
      removed.push(...Object.keys(drafts.sounds));
      drafts.sounds = {};
      drafts.presets = {};
      drafts.general = {};
    } else if (scope.kind === "emitter") {
      const key = soundKey(scope.zoneId, scope.soundId);
      delete drafts.sounds[key];
      removed.push(key);
    } else if (scope.kind === "preset") delete drafts.presets[scope.event];
    else drafts.general = {};
    this.set({ drafts, applied: false, save: IDLE_SAVE });
    for (const key of removed) {
      const { zoneId, soundId } = splitSoundKey(key);
      if (zoneId === this.deps.sfx.zoneId) this.deps.sfx.setEmitterDraft(soundId, null);
    }
    this.syncSession();
    this.notice(scope === "all" ? "Se descartaron todos los ajustes sin guardar." : "Se restablecieron los valores guardados en el proyecto.");
  }

  /** Aplica los borradores a la sesión del juego (sin tocar el disco ni recrear el juego). */
  apply(): void {
    this.syncSession();
    this.set({ applied: true });
    this.notice("Ajustes aplicados a esta sesión. Aún no están guardados en el proyecto.");
  }

  private syncSession(): void {
    const { sfx, config } = this.deps;
    sfx.setConfig(sfxWith(config.audio.sfx, this.state.drafts));
    const zone = sfx.zoneId;
    if (zone !== null) {
      const sounds = this.zoneSounds(zone);
      // Un recurso local aún no existe en el catálogo: su emisor se oye con la prueba; en el mapa se aplica el resto.
      sfx.replaceZoneSounds(sounds);
    }
  }

  // ---- archivos de prueba --------------------------------------------------------------------------------------------

  /** Los recursos de efectos del catálogo, para elegir. */
  catalog(): Array<{ id: string; label: string; durationSeconds?: number }> {
    return this.deps.assets
      .entries()
      .filter(([, e]) => e.kind === "sfx")
      .map(([id, e]) => ({ id, label: e.label, durationSeconds: e.durationSeconds }));
  }

  /** Cuánta memoria de audio decodificado usan los archivos de prueba. */
  localBytes(files = this.state.files): number {
    return files.reduce((n, f) => n + f.decodedBytes, 0);
  }

  /**
   * Incorpora archivos elegidos por el visitante del laboratorio. Una selección más nueva sustituye a una anterior que aún se esté
   * decodificando (gana la última), y la memoria de prueba tiene tope: si no cabe, se descartan los archivos que ningún borrador usa.
   */
  async addFiles(list: File[]): Promise<void> {
    const token = ++this.fileToken;
    const added: string[] = [];
    for (const file of list) {
      if (token !== this.fileToken) return; // llegó otra selección
      const problem = await this.addOne(file, token);
      if (problem === "stale") return;
      this.notice(problem ?? `«${file.name}» está listo para probar.`);
      if (!problem) added.push(file.name);
    }
  }

  private async addOne(file: File, token: number): Promise<string | "stale" | null> {
    const format = formatOf(file.name);
    if (!format) return `«${file.name}»: formato no admitido. Usa WAV, MP3, OGG o M4A.`;
    if (file.size > AUDIO_LAB_LIMITS.maxFileBytes) return `«${file.name}» pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${AUDIO_LAB_LIMITS.maxFileBytes / 1024 / 1024} MB.`;
    if (this.state.files.length >= MAX_LOCAL_FILES && !this.makeRoom(0)) return `Ya hay ${MAX_LOCAL_FILES} archivos de prueba en uso. Quita alguno para añadir otro.`;
    const status = this.deps.sfx.getState().status;
    if (status === "idle" || status === "unavailable") return "El audio del juego aún no está listo: pulsa «Comenzar» o espera a que cargue el mapa.";
    const key = `${this.nextFile++}`;
    const data = await file.arrayBuffer();
    if (token !== this.fileToken) return "stale";
    await this.deps.sfx.unlock();
    let loaded;
    try {
      loaded = await this.deps.sfx.loadTemp(localAssetId(key), data);
    } catch (e) {
      return `«${file.name}»: no se pudo decodificar (${e instanceof Error ? e.message : String(e)}).`;
    }
    if (token !== this.fileToken) {
      this.deps.sfx.releaseTemp(localAssetId(key));
      return "stale";
    }
    if (loaded.durationSeconds > AUDIO_LAB_LIMITS.maxSeconds) {
      this.deps.sfx.releaseTemp(localAssetId(key));
      return `«${file.name}» dura ${loaded.durationSeconds.toFixed(1)} s; el máximo es ${AUDIO_LAB_LIMITS.maxSeconds} s.`;
    }
    if (!this.makeRoom(loaded.bytes)) {
      this.deps.sfx.releaseTemp(localAssetId(key));
      return `«${file.name}» no cabe en la memoria de prueba (${(AUDIO_LAB_LIMITS.maxDecodedBytes / 1024 / 1024).toFixed(0)} MB): quita archivos que no uses.`;
    }
    const name = file.name.split(/[\\/]/).pop() ?? file.name;
    const local: LocalFile = { key, name, label: `Efecto de sonido: ${name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")}`, data, durationSeconds: loaded.durationSeconds, sizeBytes: file.size, decodedBytes: loaded.bytes, format };
    this.set({ files: [...this.state.files, local] });
    return null;
  }

  /** Libera memoria quitando los archivos de prueba más viejos que ningún borrador usa, hasta que `extra` bytes quepan. */
  private makeRoom(extra: number): boolean {
    let files = [...this.state.files];
    const used = this.usedKeys();
    while (files.length && (this.localBytes(files) + extra > AUDIO_LAB_LIMITS.maxDecodedBytes || files.length >= MAX_LOCAL_FILES + (extra ? 1 : 0))) {
      const victim = files.find((f) => !used.has(f.key));
      if (!victim) return this.localBytes(files) + extra <= AUDIO_LAB_LIMITS.maxDecodedBytes && files.length < MAX_LOCAL_FILES + (extra ? 1 : 0);
      this.deps.sfx.releaseTemp(localAssetId(victim.key));
      files = files.filter((f) => f !== victim);
    }
    if (files.length !== this.state.files.length) this.set({ files });
    return this.localBytes(files) + extra <= AUDIO_LAB_LIMITS.maxDecodedBytes;
  }

  private usedKeys(): Set<string> {
    const out = new Set<string>();
    const d = this.state.drafts;
    for (const s of Object.values(d.sounds)) if (isLocalAssetId(s.assetId)) out.add(localKeyOf(s.assetId));
    for (const p of Object.values(d.presets)) if (p && isLocalAssetId(p.assetId)) out.add(localKeyOf(p.assetId));
    return out;
  }

  removeFile(key: string): void {
    if (this.usedKeys().has(key)) {
      this.notice("Ese archivo lo usa un ajuste sin guardar: reasigna o restablece ese ajuste primero.");
      return;
    }
    this.stopAll();
    this.deps.sfx.releaseTemp(localAssetId(key));
    this.set({ files: this.state.files.filter((f) => f.key !== key) });
  }

  // ---- pruebas -------------------------------------------------------------------------------------------------------

  private ensureStepper(): void {
    this.stepTimer ??= setInterval(() => this.step(), STEP_MS);
  }

  private async ready(assetId: string): Promise<boolean> {
    await this.deps.sfx.unlock();
    const status = this.deps.sfx.getState().status;
    if (status === "unavailable" || status === "idle") {
      this.notice("El audio del juego aún no está listo.");
      return false;
    }
    if (isLocalAssetId(assetId)) return true;
    const ok = await this.deps.sfx.ensure(assetId);
    if (!ok) this.notice(`No se pudo cargar «${assetId}». Mira el diagnóstico.`);
    return ok;
  }

  /** ¿Por qué no sonó una prueba? Las pruebas respetan el silencio global y el permiso de audio. */
  private whyNotAudible(): string {
    const s = this.deps.sfx.getState();
    if (s.muted) return "El sonido está silenciado: actívalo con el botón «Sonido» para escuchar las pruebas.";
    if (s.hidden) return "La pestaña está en segundo plano: las pruebas se detienen hasta que vuelva.";
    if (s.status === "locked") return "El navegador no ha dado permiso de audio todavía: vuelve a pulsar «Probar».";
    return "No se pudo reproducir: hay demasiadas voces o el audio no está disponible. Mira el diagnóstico.";
  }

  /** «Probar» un emisor con sus valores actuales (borrador incluido), a la distancia del oyente. */
  async playEmitter(zoneId: string, soundId: string): Promise<void> {
    const sound = this.soundOf(zoneId, soundId);
    if (!sound) return;
    if (!(await this.ready(sound.assetId))) return;
    const key = soundKey(zoneId, soundId);
    this.stopOwner(key);
    const loop = sound.playback.mode === "loop";
    const ref = this.deps.sfx.startVoice({
      key: sound.assetId, kind: "test", label: `Prueba: ${sound.label}`, volume: sound.volume, rate: sound.rate, loop, spatial: this.state.spatialTest ? readingAt(sound, this.listener()).gain : 1, fade: sound.fadeInMs > 0 ? 0 : 1, owner: key,
    });
    if (!ref) return this.notice(this.whyNotAudible());
    this.track({ ref, owner: key, info: { id: ref.id, label: sound.label, loop, owner: key }, source: { kind: "emitter", key }, startedAt: this.now(), stopping: null, fadeInMs: sound.fadeInMs, fadeOutMs: sound.fadeOutMs });
    if (!loop) ref.onEnd(() => this.maybeRepeat(zoneId, soundId, ref.id));
    this.notice(`Probando «${sound.label}»${this.state.spatialTest ? ` desde (${Math.round(this.listener().x)}, ${Math.round(this.listener().y)})` : " sin distancia"}.`);
  }

  /** «Probar» un efecto de interfaz con un preset (o el guardado). */
  async playPreset(event: SfxEventId): Promise<void> {
    const preset = this.presetOf(event);
    if (!preset) return this.notice("Esta acción no tiene efecto asignado.");
    if (!(await this.ready(preset.assetId))) return;
    this.stopOwner(`preset:${event}`);
    const ref = this.deps.sfx.startVoice({ key: preset.assetId, kind: "test", label: `Prueba: ${event}`, volume: preset.volume, rate: preset.rate, loop: false, spatial: 1, fade: 1, owner: `preset:${event}` });
    if (!ref) return this.notice(this.whyNotAudible());
    this.track({ ref, owner: `preset:${event}`, info: { id: ref.id, label: event, loop: false, owner: `preset:${event}` }, source: { kind: "neutral", volume: () => this.presetOf(event)?.volume ?? preset.volume, rate: () => this.presetOf(event)?.rate ?? preset.rate }, startedAt: this.now(), stopping: null, fadeInMs: 0, fadeOutMs: 0 });
    this.notice(`Probando el efecto de «${event}».`);
  }

  /** Oye un archivo de prueba tal cual, sin mapa ni distancia. */
  async playFile(key: string): Promise<void> {
    const file = this.state.files.find((f) => f.key === key);
    if (!file) return;
    if (!(await this.ready(localAssetId(key)))) return;
    this.stopOwner(`file:${key}`);
    const ref = this.deps.sfx.startVoice({ key: localAssetId(key), kind: "test", label: `Archivo: ${file.name}`, volume: 0.8, rate: 1, loop: false, spatial: 1, fade: 1, owner: `file:${key}` });
    if (!ref) return this.notice(this.whyNotAudible());
    this.track({ ref, owner: `file:${key}`, info: { id: ref.id, label: file.name, loop: false, owner: `file:${key}` }, source: { kind: "neutral", volume: () => 0.8, rate: () => 1 }, startedAt: this.now(), stopping: null, fadeInMs: 0, fadeOutMs: 0 });
    this.notice(`Probando «${file.name}».`);
  }

  /** `audio.sfx` tal como está guardado en el proyecto. */
  sfxSaved(): SfxConfig | undefined {
    return this.deps.config.audio.sfx;
  }

  /** Asigna un archivo de prueba a lo seleccionado (el recurso del emisor o del efecto). */
  useFile(key: string): void {
    const sel = this.state.selection;
    const assetId = localAssetId(key);
    if (sel?.kind === "emitter") {
      const sound = this.soundOf(sel.zoneId, sel.soundId);
      if (sound) this.editSound(sel.zoneId, sel.soundId, { ...sound, assetId });
    } else if (sel?.kind === "preset") {
      const preset = this.presetOf(sel.event);
      this.editPreset(sel.event, { assetId, volume: preset?.volume ?? 0.6, rate: preset?.rate ?? 1 });
    }
  }

  /** Olvida los errores de carga para reintentar tras corregir un archivo. */
  clearFailures(): void {
    this.deps.sfx.clearFailures();
    this.set({ diagnostics: this.deps.sfx.diagnostics() });
  }

  presetOf(event: SfxEventId): OneShotPreset | null {
    const draft = this.state.drafts.presets[event];
    return draft !== undefined ? draft : (this.deps.config.audio.sfx?.events?.[event] ?? null);
  }

  /** Activa o desactiva repetir una prueba terminada. */
  setRepeat(repeat: boolean): void {
    this.set({ repeat });
    if (!repeat) clearTimeout(this.repeatTimer);
  }

  private maybeRepeat(zoneId: string, soundId: string, voiceId: number): void {
    if (!this.state.repeat || !this.open) return;
    const ended = this.tests.find((t) => t.ref.id === voiceId);
    if (ended?.stopping !== null && ended?.stopping !== undefined) return; // la detuvo el visitante
    clearTimeout(this.repeatTimer);
    this.repeatTimer = setTimeout(() => {
      if (this.state.repeat && this.open) void this.playEmitter(zoneId, soundId);
    }, REPEAT_GAP_MS);
  }

  private track(t: TestVoice): void {
    this.tests = [...this.tests.filter((x) => x.ref.alive), t];
    t.ref.onEnd(() => {
      this.tests = this.tests.filter((x) => x !== t);
      this.set({ tests: this.tests.map((x) => x.info) });
    });
    this.ensureStepper();
    this.set({ tests: this.tests.map((x) => x.info) });
  }

  private stopOwner(owner: string): void {
    for (const t of this.tests) if (t.owner === owner) t.ref.stop();
  }

  /** Un paso: lleva a cada voz de prueba al volumen que le corresponde ahora (borrador, distancia y fundidos) y retira las terminadas. */
  private step(): void {
    const now = this.now();
    const listener = this.listener();
    for (const t of [...this.tests]) {
      if (!t.ref.alive) continue;
      let fade = t.fadeInMs > 0 ? Math.min(1, (now - t.startedAt) / t.fadeInMs) : 1;
      if (t.stopping !== null) {
        const out = t.fadeOutMs > 0 ? Math.max(0, 1 - (now - t.stopping) / t.fadeOutMs) : 0;
        if (out <= 0) {
          t.ref.stop();
          continue;
        }
        fade = Math.min(fade, out);
      }
      if (t.source.kind === "emitter") {
        const sound = this.state.drafts.sounds[t.source.key] ?? this.savedFor(t.source.key);
        if (!sound) continue;
        t.ref.update({ base: sound.volume, spatial: this.state.spatialTest ? readingAt(sound, listener).gain : 1, fade });
        t.ref.setRate(sound.rate);
      } else {
        t.ref.update({ base: t.source.volume(), fade });
        t.ref.setRate(t.source.rate());
      }
    }
    if (!this.tests.some((t) => t.ref.alive)) {
      clearInterval(this.stepTimer);
      this.stepTimer = undefined;
    }
  }

  private savedFor(key: string): MapSound | undefined {
    const k = splitSoundKey(key);
    return this.savedSound(k.zoneId, k.soundId);
  }

  /** «Detener»: las pruebas de este emisor (los bucles se apagan con su fundido de salida). */
  stopEmitter(zoneId: string, soundId: string): void {
    const key = soundKey(zoneId, soundId);
    const now = this.now();
    for (const t of this.tests) if (t.source.kind === "emitter" && t.source.key === key && t.stopping === null) t.stopping = now;
    clearTimeout(this.repeatTimer);
    this.set({ repeat: false });
  }

  /** «Detener todo»: todas las pruebas y los sonidos del mapa, al instante. */
  stopAll(): void {
    this.stopTests();
    this.deps.sfx.stopAll();
    this.setAmbientPaused(true);
    this.notice("Todo detenido, también el ambiente del mapa. «Reanudar el ambiente» lo devuelve.");
  }

  /** Detiene solo las voces de prueba (y la repetición). */
  private stopTests(): void {
    clearTimeout(this.repeatTimer);
    this.deps.sfx.stopTests();
    this.tests = [];
    clearInterval(this.stepTimer);
    this.stepTimer = undefined;
    this.set({ tests: [], repeat: false });
  }

  /** Calla (o devuelve) el ambiente de todos los emisores de la zona activa: un silencio del laboratorio, no de la configuración. */
  setAmbientPaused(paused: boolean): void {
    for (const id of this.deps.sfx.emitterIds()) this.deps.sfx.setEmitterMuted(id, paused);
    if (paused !== this.state.ambientPaused) this.set({ ambientPaused: paused });
  }

  resumeAmbient(): void {
    this.setAmbientPaused(false);
    this.notice("El ambiente del mapa vuelve a sonar según dónde esté el oyente.");
  }

  /** «Solo»: se oye únicamente lo seleccionado; la música y los demás emisores bajan a cero mientras dura. */
  setSolo(on: boolean): void {
    const sel = this.state.selection;
    const owner = on && sel?.kind === "emitter" ? soundKey(sel.zoneId, sel.soundId) : null;
    const active = on && owner !== null;
    this.deps.sfx.setSolo(active ? splitSoundKey(owner as string).soundId : null, 0);
    this.deps.music?.setSessionGain(active ? 0 : 1);
    if (active !== this.state.solo) this.set({ solo: active });
  }

  setSpatialTest(on: boolean): void {
    this.set({ spatialTest: on });
  }

  /** «Silenciar este emisor» en el mapa, sin tocar su configuración. */
  muteEmitter(soundId: string, muted: boolean): void {
    this.deps.sfx.setEmitterMuted(soundId, muted);
  }

  // ---- servidor de desarrollo: guardar y comprobar --------------------------------------------------------------------------

  private headers(): HeadersInit {
    return { [AUDIO_LAB_HEADER]: "1" };
  }

  async refreshServer(): Promise<void> {
    try {
      const r = await this.fetcher(`${AUDIO_LAB_ROUTE}/state`, { headers: this.headers(), cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as { versions: FileVersions; zones: string[] };
      this.set({ server: { status: "ready", versions: body.versions, zones: body.zones } });
    } catch (e) {
      this.set({ server: { status: "offline", zones: [], message: `El servidor de desarrollo no responde (${e instanceof Error ? e.message : String(e)}). «Guardar en el proyecto» necesita \`npm run dev\`.` } });
    }
  }

  /** ¿Se puede guardar este alcance? Devuelve el motivo si no. */
  canSave(scope: Selection | null): string | null {
    if (!scope) return "Elige un emisor, una acción o los ajustes generales.";
    if (this.state.server.status !== "ready") return this.state.server.message ?? "Comprobando el servidor de desarrollo…";
    if (scope.kind === "emitter" && !this.state.server.zones.includes(scope.zoneId)) return `La zona «${scope.zoneId}» no tiene mapa de Tiled en tools/tiled/maps: sin él no hay dónde guardar el emisor.`;
    const request = buildSaveRequest(this.state.server.versions as FileVersions, this.state.drafts, new Map(this.state.files.map((f) => [f.key, f])), scope);
    if ("error" in request) return request.error === "no hay cambios que guardar en lo seleccionado" ? "No hay cambios sin guardar en lo seleccionado." : request.error;
    return null;
  }

  async save(scope: Selection, dryRun = false): Promise<void> {
    const why = this.canSave(scope);
    if (why) return this.set({ save: { status: "error", action: dryRun ? "check" : "save", messages: [why], warnings: [] } });
    const request = buildSaveRequest(this.state.server.versions as FileVersions, this.state.drafts, new Map(this.state.files.map((f) => [f.key, f])), scope) as SaveRequest;
    this.set({ save: { status: "working", action: dryRun ? "check" : "save", messages: [dryRun ? "Comprobando…" : "Guardando…"], warnings: [] } });
    let result: SaveResult;
    try {
      const r = await this.fetcher(`${AUDIO_LAB_ROUTE}/save${dryRun ? "?dryRun=1" : ""}`, { method: "POST", headers: { ...this.headers(), "content-type": "application/json" }, body: JSON.stringify(request) });
      result = (await r.json()) as SaveResult;
    } catch (e) {
      return this.set({ save: { status: "error", action: dryRun ? "check" : "save", messages: [`No se pudo hablar con el servidor de desarrollo: ${e instanceof Error ? e.message : String(e)}`], warnings: [] } });
    }
    if (!result.ok) {
      if (result.reason === "conflict") void this.refreshServer();
      return this.set({ save: { status: "error", action: dryRun ? "check" : "save", messages: result.errors, warnings: [] } });
    }
    if (dryRun) return this.set({ save: { status: "ok", action: "check", messages: ["Todo es válido: se puede guardar.", ...result.saved], warnings: result.warnings } });

    // Guardado: lo guardado deja de ser borrador. El servidor avisa al navegador para recargar la página UNA vez; los borradores del
    // resto de la sesión se conservan en `sessionStorage` y el archivo local, que ya está en el proyecto, no hace falta.
    const drafts = clone(this.state.drafts);
    for (const c of request.changes) {
      if (c.type === "sound") delete drafts.sounds[soundKey(c.zoneId, c.soundId)];
      else if (c.type === "preset") delete drafts.presets[c.event];
      else if (c.type === "general") drafts.general = {};
    }
    this.set({ drafts, server: { ...this.state.server, versions: result.versions }, save: { status: "ok", action: "save", messages: [...result.saved, "La página se recarga sola para usar lo guardado."], warnings: result.warnings }, applied: false });
    this.persist();
  }

  // ---- exportar e importar ajustes -------------------------------------------------------------------------------------------

  /** El paquete de ajustes de toda la sesión como texto JSON listo para descargar, o el motivo por el que no hay nada. */
  exportText(): { text: string; name: string } | { error: string } {
    const base = this.state.server.versions ?? { manifest: "", project: "", maps: "", config: "", zones: {} };
    const pkg = buildPackage(base, this.state.drafts, new Map(this.state.files.map((f) => [f.key, f])));
    if ("error" in pkg) return pkg;
    const stamp = pkg.exportedAt.replace(/[:.]/g, "-");
    return { text: `${JSON.stringify(pkg, null, 2)}\n`, name: `ajustes-sonidos-${stamp}.json` };
  }

  /** Carga un paquete exportado: sus archivos se decodifican como archivos de prueba y sus cambios pasan a ser borradores. */
  async importText(text: string): Promise<void> {
    const pkg = parsePackage(text);
    if ("error" in pkg) return this.notice(`No se pudo importar: ${pkg.error}.`);
    const drafts = draftsFromPackage(pkg);
    const keyMap = new Map<string, string>();
    for (const a of pkg.assets) {
      let data: ArrayBuffer;
      try {
        data = base64ToBytes(a.dataBase64);
      } catch {
        return this.notice(`No se pudo importar: los datos de «${a.name}» no son válidos.`);
      }
      const file = new File([data], a.name);
      const token = ++this.fileToken;
      const before = new Set(this.state.files.map((f) => f.key));
      const problem = await this.addOne(file, token);
      if (problem) return this.notice(problem === "stale" ? "Importación cancelada por otra selección." : problem);
      const created = this.state.files.find((f) => !before.has(f.key));
      if (created) keyMap.set(a.key, created.key);
    }
    // Las claves del paquete se sustituyen por las del laboratorio.
    const remap = (assetId: string) => (isLocalAssetId(assetId) ? localAssetId(keyMap.get(localKeyOf(assetId)) ?? localKeyOf(assetId)) : assetId);
    for (const [k, s] of Object.entries(drafts.sounds)) drafts.sounds[k] = { ...s, assetId: remap(s.assetId) };
    for (const [e, p] of Object.entries(drafts.presets) as Array<[SfxEventId, OneShotPreset | null]>) if (p) drafts.presets[e] = { ...p, assetId: remap(p.assetId) };
    this.set({ drafts: { sounds: { ...this.state.drafts.sounds, ...drafts.sounds }, presets: { ...this.state.drafts.presets, ...drafts.presets }, general: { ...this.state.drafts.general, ...drafts.general } }, applied: false });
    this.notice(`Paquete importado: ${pkg.changes.length} ajuste(s) y ${pkg.assets.length} archivo(s) como borradores. Revísalos y guárdalos.`);
  }

  get dirty(): boolean {
    return hasDrafts(this.state.drafts);
  }

  /** Los archivos locales que usaría guardar este alcance. */
  assetKeysFor(scope: SaveScope): string[] {
    const request = buildSaveRequest(this.state.server.versions as FileVersions, this.state.drafts, new Map(this.state.files.map((f) => [f.key, f])), scope);
    return "error" in request ? [] : assetKeysOf(request.changes);
  }

  // ---- persistencia de la sesión --------------------------------------------------------------------------------------

  /** Los borradores sin archivos locales y la selección sobreviven a la recarga que sigue a un guardado. */
  private persist(): void {
    if (!this.storage) return;
    try {
      const { drafts, selection, zoneId } = this.state;
      const plain: Drafts = {
        sounds: Object.fromEntries(Object.entries(drafts.sounds).filter(([, s]) => !isLocalAssetId(s.assetId))),
        presets: Object.fromEntries(Object.entries(drafts.presets).filter(([, p]) => !p || !isLocalAssetId(p.assetId))),
        general: drafts.general,
      };
      if (!hasDrafts(plain) && !selection) this.storage.removeItem(STORAGE_KEY);
      else this.storage.setItem(STORAGE_KEY, JSON.stringify({ drafts: plain, selection, zoneId }));
    } catch {
      /* sin almacenamiento: el laboratorio funciona igual, solo que no recuerda nada tras recargar */
    }
  }

  private restore(): { drafts?: Drafts; selection?: Selection; zoneId?: string } {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return {};
      const p = JSON.parse(raw) as { drafts?: Drafts; selection?: Selection; zoneId?: string };
      return { drafts: p.drafts && typeof p.drafts === "object" ? { ...emptyDrafts(), ...p.drafts } : undefined, selection: p.selection ?? undefined, zoneId: typeof p.zoneId === "string" ? p.zoneId : undefined };
    } catch {
      return {};
    }
  }
}

const IDLE_SAVE: SaveStatus = { status: "idle", messages: [], warnings: [] };

function safeStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}
