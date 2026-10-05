import type { AssetRegistry } from "../config/assetRegistry";
import { SFX_EVENT_IDS, SOUND_LIMITS, type SfxEventId } from "../config/sounds";
import type { MapSound, OneShotPreset, Point, SfxConfig } from "../config/types";
import { Soundscape } from "./Soundscape";
import type {
  BackendVoice, LoadedSound, SfxBackend, SfxDiagnostics, SfxState, VoiceDiagnostic, VoiceFactors, VoiceKind, VoiceRef, VoiceRequest,
} from "./sfxTypes";

/**
 * Servicio de efectos de sonido (SPEC 6.5): una instancia por juego. Reúne los emisores del mapa (`Soundscape`), los efectos de
 * interfaz y de recompensa y las pruebas del laboratorio bajo un mismo reparto de voces, una mezcla (volumen general, silencio,
 * fundidos, distancia) y un ciclo de vida. No conoce Phaser: reproduce a través de un `SfxBackend`. Nada suena antes del gesto del
 * visitante (`unlock`), y cualquier fallo de carga o de reproducción se anota en el estado y nunca lanza.
 */

export interface SfxDeps {
  now?: () => number;
  random?: () => number;
  /** Visibilidad de la pestaña; por defecto, `document`. */
  visibility?: { isHidden(): boolean; subscribe(listener: () => void): () => void };
  /** Temporizador del servicio (se sustituye en las pruebas). */
  scheduler?: { every(ms: number, callback: () => void): () => void };
}

const TICK_MS = 50;
/** Un salto de reloj mayor (pestaña en segundo plano) no se acumula: no se reproduce una cola de efectos antiguos. */
const MAX_DELTA_MS = 250;
/** Un efecto de interfaz que tarda más que esto en cargar se descarta: ya no es lo que el visitante acaba de hacer. */
const EVENT_STALE_MS = 900;
/** Memoria máxima de audio decodificado que conserva el servicio, en bytes. */
export const SFX_CACHE_LIMIT_BYTES = 48 * 1024 * 1024;
/** Cuántos identificadores de efecto ya reproducidos se recuerdan para no repetir un aviso duplicado. */
const DEDUPE_LIMIT = 64;

const PRIORITY: Record<VoiceKind, number> = { ambient: 1, event: 2, test: 3 };
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const EVENT_IDS = new Set<string>(SFX_EVENT_IDS);

interface Voice {
  id: number;
  request: VoiceRequest;
  handle: BackendVoice;
  factors: VoiceFactors;
  rate: number;
  alive: boolean;
  effective: number;
  endCallbacks: Array<() => void>;
}

interface Cached {
  bytes: number;
  lastUse: number;
  /** Los que lo retienen: la zona activa, los efectos de interfaz y las voces vivas. */
  pinned: boolean;
  temp: boolean;
}

export class SfxService {
  private backend: SfxBackend | null = null;
  private unsubscribeBackend: (() => void) | undefined;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly visibility: NonNullable<SfxDeps["visibility"]>;
  private readonly scheduler: NonNullable<SfxDeps["scheduler"]>;
  private unsubscribeVisibility: (() => void) | undefined;
  private stopTicker: (() => void) | undefined;
  private lastTick = 0;
  private readonly soundscape: Soundscape;

  private config: SfxConfig | undefined;
  private muted = false;
  private unlocked = false;
  private hidden = false;
  private readonly suspended = new Set<string>();
  private zoneToken = 0;
  private listenerPoint: Point | null = null;
  private listenerOverride: Point | null = null;
  private voices: Voice[] = [];
  private nextVoiceId = 1;
  private readonly loading = new Map<string, Promise<boolean>>();
  private readonly cache = new Map<string, Cached>();
  private readonly failed = new Set<string>();
  private errors: string[] = [];
  private readonly consumed: string[] = [];
  private state: SfxState;
  // Mezcla del laboratorio
  private solo: string | null = null;
  private othersGain = 1;
  private readonly zonePins = new Set<string>();
  private disposed = false;

  constructor(config: SfxConfig | undefined, private readonly assets: AssetRegistry, deps: SfxDeps = {}, muted = false) {
    this.config = config;
    this.muted = muted;
    this.now = deps.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    this.random = deps.random ?? Math.random;
    this.visibility = deps.visibility ?? documentVisibility();
    this.scheduler = deps.scheduler ?? { every: (ms, cb) => { const t = setInterval(cb, ms); return () => clearInterval(t); } };
    this.hidden = this.visibility.isHidden();
    this.soundscape = new Soundscape({
      now: this.now,
      random: this.random,
      audible: () => this.canPlay("ambient"),
      unlocked: () => this.unlocked,
      isLoaded: (id) => this.backend?.has(id) ?? false,
      ensure: (id) => void this.ensure(id),
      start: (request) => this.startVoice(request),
      mixFor: (id) => (this.solo === null ? 1 : this.solo === id ? 1 : this.othersGain),
    });
    this.state = this.snapshot();
    this.unsubscribeVisibility = this.visibility.subscribe(() => this.setHidden(this.visibility.isHidden()));
  }

  // ---- estado --------------------------------------------------------------------------------------------------

  getState = (): SfxState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** ¿Hay efectos configurados y activados? Sin ellos el juego es el de siempre. */
  get enabled(): boolean {
    return this.config?.active === true;
  }

  get sfxConfig(): SfxConfig | undefined {
    return this.config;
  }

  /** El volumen general, 0..1. */
  get master(): number {
    return clamp01(this.config?.volume ?? 1);
  }

  private get maxVoices(): number {
    return Math.min(SOUND_LIMITS.maxVoices.max, Math.max(SOUND_LIMITS.maxVoices.min, this.config?.maxVoices ?? 12));
  }

  private snapshot(): SfxState {
    const status = !this.backend ? "idle" : this.backend.status() === "unavailable" ? "unavailable" : !this.unlocked ? "idle" : this.backend.status() === "locked" ? "locked" : "ready";
    return {
      status, enabled: this.enabled, muted: this.muted, unlocked: this.unlocked, hidden: this.hidden, suspended: [...this.suspended].sort(),
      voices: this.voices.length, maxVoices: this.maxVoices, loading: this.loading.size, failed: [...this.failed], errors: this.errors,
    };
  }

  private publish(): void {
    const next = this.snapshot();
    const prev = this.state;
    const same = next.status === prev.status && next.enabled === prev.enabled && next.muted === prev.muted && next.unlocked === prev.unlocked && next.hidden === prev.hidden
      && next.voices === prev.voices && next.maxVoices === prev.maxVoices && next.loading === prev.loading && next.failed.length === prev.failed.length
      && next.errors === prev.errors && next.suspended.join() === prev.suspended.join();
    if (same) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  /** Reemplaza la configuración (el laboratorio aplica el volumen general o el límite de voces en vivo). */
  setConfig(config: SfxConfig | undefined): void {
    this.config = config;
    this.refreshAll();
    this.publish();
  }

  // ---- ciclo de vida ----------------------------------------------------------------------------------------------

  /** Conecta el reproductor real (el juego ya existe). */
  attach(backend: SfxBackend): void {
    this.detach();
    this.backend = backend;
    this.unsubscribeBackend = backend.subscribe(() => this.publish());
    this.publish();
  }

  /**
   * Suelta el reproductor (se destruye el juego): detiene todo y libera la memoria de audio. Con `only`, solo si ese es el reproductor
   * conectado: el aviso tardío de un juego ya sustituido no desconecta al juego actual (solo libera el suyo).
   */
  detach(only?: SfxBackend): void {
    if (only && only !== this.backend) {
      only.dispose();
      return;
    }
    const previous = this.backend;
    this.stopAll();
    this.soundscape.clear();
    this.cancelTicker();
    for (const key of [...this.cache.keys()]) this.backend?.unload(key);
    this.cache.clear();
    this.loading.clear();
    this.unsubscribeBackend?.();
    this.unsubscribeBackend = undefined;
    this.backend = null;
    try {
      previous?.dispose();
    } catch {
      /* ya liberado */
    }
    this.publish();
  }

  dispose(): void {
    if (this.disposed) return;
    this.detach();
    this.unsubscribeVisibility?.();
    this.unsubscribeVisibility = undefined;
    this.listeners.clear();
    this.disposed = true;
  }

  /**
   * Deshace `dispose()`. React, en desarrollo (StrictMode), ejecuta la limpieza de un efecto y lo vuelve a montar con la MISMA instancia:
   * el servicio tiene que poder seguir funcionando después. Idempotente.
   */
  revive(): void {
    if (!this.disposed) return;
    this.disposed = false;
    this.hidden = this.visibility.isHidden();
    this.unsubscribeVisibility = this.visibility.subscribe(() => this.setHidden(this.visibility.isHidden()));
    this.publish();
  }

  /** El gesto del visitante («Comenzar»/«Continuar» o una prueba del laboratorio): desde aquí puede sonar. */
  async unlock(): Promise<void> {
    this.unlocked = true;
    this.publish();
    try {
      await this.backend?.unlock();
    } catch (e) {
      this.fail(`no se pudo activar el audio: ${(e as Error).message}`);
    }
    this.ensureTicker();
    this.warmEvents();
    this.publish();
  }

  setMuted(muted: boolean): void {
    if (muted === this.muted) return;
    this.muted = muted;
    if (muted) this.stopAll(); // en silencio no se mantiene ninguna voz: al volver, los bucles arrancan de nuevo
    this.publish();
  }

  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    this.lastTick = this.now(); // al volver no se acumula el tiempo que se estuvo fuera
    if (hidden) this.stopAll();
    this.publish();
  }

  /** Motivos por los que el ambiente se suspende (una lectura abierta, una pausa del laboratorio…). Los efectos de interfaz no se ven afectados. */
  setSuspended(reason: string, on: boolean): void {
    const had = this.suspended.has(reason);
    if (on === had) return;
    if (on) this.suspended.add(reason);
    else {
      this.suspended.delete(reason);
      this.lastTick = this.now();
    }
    this.publish();
  }

  // ---- puertas de la reproducción ---------------------------------------------------------------------------------

  /** ¿Puede sonar una voz de ese tipo ahora? */
  canPlay(kind: VoiceKind): boolean {
    if (!this.backend || !this.unlocked || this.muted || this.hidden || this.backend.status() !== "ready") return false;
    if (kind === "test") return true;
    if (!this.enabled) return false;
    if (kind === "ambient") return this.suspended.size === 0;
    return true;
  }

  // ---- el mapa ---------------------------------------------------------------------------------------------------

  /** Activa los emisores de una zona. `token` identifica la escena: una llamada tardía de una escena ya cerrada se ignora. */
  setZone(zoneId: string, sounds: Record<string, MapSound> | undefined, token: number): void {
    this.zoneToken = token;
    this.soundscape.setZone(zoneId, this.enabled ? sounds : undefined);
    this.zonePins.clear();
    for (const s of Object.values(this.enabled ? sounds ?? {} : {})) this.zonePins.add(s.assetId);
    this.repin();
    this.ensureTicker();
    this.publish();
  }

  clearZone(token: number): void {
    if (token !== this.zoneToken) return;
    this.soundscape.clear();
    this.zonePins.clear();
    this.repin();
    this.publish();
  }

  get zoneId(): string | null {
    return this.soundscape.zone;
  }

  /** El token de la escena que activó la zona (el laboratorio lo reutiliza al reemplazar sus emisores). */
  get token(): number {
    return this.zoneToken;
  }

  /**
   * Reemplaza los emisores de la zona activa por estos (el laboratorio de sonidos aplica a la sesión sus emisores nuevos y editados),
   * sin recrear el juego ni cambiar de escena. Sin zona activa no hace nada.
   */
  replaceZoneSounds(sounds: Record<string, MapSound> | undefined): void {
    const zone = this.soundscape.zone;
    if (zone !== null) this.setZone(zone, sounds, this.zoneToken);
  }

  /** La posición real de los pies de Vanessa (cada fotograma de la escena). */
  setListener(point: Point): void {
    this.listenerPoint = point;
    this.soundscape.setListener(this.listenerOverride ?? point, this.listenerOverride !== null);
  }

  /** El oyente virtual del laboratorio: mientras exista, el ambiente se oye desde él en lugar de desde Vanessa. */
  setListenerOverride(point: Point | null): void {
    this.listenerOverride = point;
    const at = point ?? this.listenerPoint;
    if (at) this.soundscape.setListener(at, point !== null);
  }

  // ---- efectos de interfaz y de recompensa ------------------------------------------------------------------------------

  /** Reproduce el efecto asociado a una acción. Con `effectId` se reproduce una sola vez por identificador (un aviso duplicado no suena dos veces). */
  playEvent(event: SfxEventId, options: { effectId?: string } = {}): boolean {
    if (!this.enabled || !EVENT_IDS.has(event)) return false;
    const preset = this.config?.events?.[event];
    if (!preset) return false;
    if (options.effectId !== undefined) {
      const key = `${event}:${options.effectId}`;
      if (this.consumed.includes(key)) return false;
      this.consumed.push(key);
      if (this.consumed.length > DEDUPE_LIMIT) this.consumed.shift();
    }
    return this.playPreset(preset, `Acción: ${event}`, "event");
  }

  /** Reproduce un preset una vez (una acción del juego o una prueba del laboratorio). Si aún no está cargado, espera un instante; si tarda, se descarta. */
  playPreset(preset: OneShotPreset, label: string, kind: VoiceKind = "event"): boolean {
    if (!this.canPlay(kind)) return false;
    const play = () => this.startVoice({ key: preset.assetId, kind, label, volume: preset.volume, rate: preset.rate, loop: false, spatial: 1, fade: 1 }) !== null;
    if (this.backend?.has(preset.assetId)) return play();
    const asked = this.now();
    void this.ensure(preset.assetId).then((ok) => {
      if (ok && this.now() - asked <= EVENT_STALE_MS && this.canPlay(kind)) play();
    });
    return true;
  }

  /** Carga los efectos de interfaz configurados (después del gesto del visitante, sin retrasar el mapa). */
  warmEvents(): void {
    if (!this.enabled) return;
    for (const preset of Object.values(this.config?.events ?? {})) if (preset) void this.ensure(preset.assetId);
  }

  // ---- voces ------------------------------------------------------------------------------------------------------

  /** Pide una voz: respeta el gesto, el silencio, la visibilidad y el límite de voces (una voz de ambiente lejana cede ante un efecto). */
  startVoice(request: VoiceRequest): VoiceRef | null {
    if (!this.canPlay(request.kind) || !this.backend?.has(request.key)) return null;
    if (this.voices.length >= this.maxVoices) {
      const victim = this.pickVictim(request.kind);
      if (!victim) return null;
      this.stopVoice(victim);
    }
    const factors: VoiceFactors = { base: request.volume, spatial: request.spatial ?? 1, fade: request.fade ?? 1 };
    const effective = this.effective(request, factors);
    let handle: BackendVoice | null = null;
    try {
      handle = this.backend.play(request.key, { volume: effective, rate: request.rate, loop: request.loop });
    } catch (e) {
      this.fail(`no se pudo reproducir «${request.key}»: ${(e as Error).message}`);
      return null;
    }
    if (!handle) return null;
    const voice: Voice = { id: this.nextVoiceId++, request, handle, factors, rate: request.rate, alive: true, effective, endCallbacks: [] };
    handle.onEnd(() => this.finish(voice));
    this.voices.push(voice);
    this.touch(request.key);
    this.repin();
    this.ensureTicker();
    this.publish();
    return this.refOf(voice);
  }

  private refOf(voice: Voice): VoiceRef {
    return {
      id: voice.id,
      get alive() {
        return voice.alive;
      },
      update: (f) => {
        if (!voice.alive) return;
        voice.factors = { ...voice.factors, ...f };
        this.apply(voice);
      },
      setRate: (rate) => {
        if (!voice.alive || rate === voice.rate) return;
        voice.rate = rate;
        voice.handle.setRate(rate);
      },
      stop: () => this.stopVoice(voice),
      onEnd: (cb) => (voice.alive ? voice.endCallbacks.push(cb) : cb()),
    };
  }

  private pickVictim(kind: VoiceKind): Voice | undefined {
    const lower = this.voices.filter((v) => PRIORITY[v.request.kind] < PRIORITY[kind]);
    return lower.sort((a, b) => PRIORITY[a.request.kind] - PRIORITY[b.request.kind] || a.effective - b.effective)[0];
  }

  private effective(request: VoiceRequest, f: VoiceFactors): number {
    const mix = request.kind === "ambient" && this.solo !== null && request.owner !== this.solo ? this.othersGain : 1;
    return this.muted ? 0 : clamp01(f.base * f.spatial * f.fade * this.master * mix);
  }

  private apply(voice: Voice): void {
    const v = this.effective(voice.request, voice.factors);
    if (Math.abs(v - voice.effective) < 1e-4) return;
    voice.effective = v;
    voice.handle.setVolume(v);
  }

  private refreshAll(): void {
    for (const v of this.voices) this.apply(v);
  }

  private stopVoice(voice: Voice): void {
    if (!voice.alive) return;
    voice.alive = false;
    try {
      voice.handle.stop();
    } catch {
      /* ya detenida */
    }
    this.voices = this.voices.filter((v) => v !== voice);
    voice.endCallbacks.splice(0).forEach((cb) => cb());
    this.repin();
    this.publish();
  }

  private finish(voice: Voice): void {
    if (!voice.alive) return;
    voice.alive = false;
    this.voices = this.voices.filter((v) => v !== voice);
    voice.endCallbacks.splice(0).forEach((cb) => cb());
    this.repin();
    this.publish();
  }

  /** Detiene todas las voces (silencio, pestaña oculta, cierre). No toca los recursos cargados. */
  stopAll(): void {
    for (const v of [...this.voices]) this.stopVoice(v);
  }

  /** Detiene solo las voces de prueba del laboratorio. */
  stopTests(): void {
    for (const v of [...this.voices]) if (v.request.kind === "test") this.stopVoice(v);
  }

  // ---- carga y memoria ---------------------------------------------------------------------------------------------

  /** Carga un recurso del catálogo (una vez, aunque se pida varias veces). Devuelve si quedó listo. */
  ensure(assetId: string): Promise<boolean> {
    const backend = this.backend;
    if (!backend) return Promise.resolve(false);
    if (backend.has(assetId)) {
      this.touch(assetId);
      return Promise.resolve(true);
    }
    const pending = this.loading.get(assetId);
    if (pending) return pending;
    if (this.failed.has(assetId)) return Promise.resolve(false);
    if (!this.assets.has(assetId)) {
      this.markFailed(assetId, `el recurso «${assetId}» no está en el catálogo`);
      return Promise.resolve(false);
    }
    const job = backend
      .load(assetId, this.assets.url(assetId))
      .then((loaded) => this.loaded(backend, loaded, false))
      .catch((e: unknown) => {
        this.markFailed(assetId, `no se pudo cargar «${assetId}»: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      })
      .finally(() => {
        this.loading.delete(assetId);
        this.publish();
      });
    this.loading.set(assetId, job);
    this.publish();
    return job;
  }

  /** Decodifica un archivo temporal (el laboratorio): vive en el caché con una clave propia hasta que se libere. */
  async loadTemp(key: string, data: ArrayBuffer): Promise<LoadedSound> {
    const backend = this.backend;
    if (!backend) throw new Error("el audio no está disponible");
    const loaded = await backend.loadData(key, data);
    this.loaded(backend, loaded, true);
    return loaded;
  }

  /** Libera un archivo temporal si ninguna voz lo está usando. */
  releaseTemp(key: string): boolean {
    if (this.voices.some((v) => v.request.key === key)) return false;
    this.backend?.unload(key);
    this.cache.delete(key);
    return true;
  }

  private loaded(backend: SfxBackend, loaded: LoadedSound, temp: boolean): boolean {
    this.cache.set(loaded.key, { bytes: loaded.bytes, lastUse: this.now(), pinned: false, temp });
    this.repin();
    this.trim(backend);
    return true;
  }

  private touch(key: string): void {
    const c = this.cache.get(key);
    if (c) c.lastUse = this.now();
  }

  /** Marca como retenidos los recursos de la zona, los efectos de interfaz y las voces vivas: no se descartan al recortar el caché. */
  private repin(): void {
    const keep = new Set<string>(this.zonePins);
    for (const p of Object.values(this.config?.events ?? {})) if (p) keep.add(p.assetId);
    for (const v of this.voices) keep.add(v.request.key);
    for (const [key, c] of this.cache) c.pinned = keep.has(key) || c.temp;
  }

  /** Mantiene el audio decodificado por debajo del límite descartando lo que nadie usa, lo más antiguo primero. */
  private trim(backend: SfxBackend): void {
    let total = [...this.cache.values()].reduce((n, c) => n + c.bytes, 0);
    if (total <= SFX_CACHE_LIMIT_BYTES) return;
    const evictable = [...this.cache.entries()].filter(([, c]) => !c.pinned).sort((a, b) => a[1].lastUse - b[1].lastUse);
    for (const [key, c] of evictable) {
      if (total <= SFX_CACHE_LIMIT_BYTES) break;
      backend.unload(key);
      this.cache.delete(key);
      total -= c.bytes;
    }
  }

  private markFailed(assetId: string, message: string): void {
    this.failed.add(assetId);
    this.fail(message);
  }

  private fail(message: string): void {
    this.errors = [...this.errors.slice(-9), message];
    this.publish();
  }

  /** Olvida los fallos de carga (el laboratorio reintenta tras corregir un archivo). */
  clearFailures(): void {
    this.failed.clear();
    this.errors = [];
    this.publish();
  }

  // ---- el reloj --------------------------------------------------------------------------------------------------

  /**
   * Un paso de reloj (público para las pruebas; lo llama el temporizador). El ambiente avanza solo mientras puede sonar: con el audio
   * sin permiso, en silencio, con la pestaña oculta o suspendido, las esperas no corren y los bucles se apagan con su fundido.
   */
  tick(deltaMs: number): void {
    if (this.disposed) return;
    this.soundscape.update(Math.min(MAX_DELTA_MS, Math.max(0, deltaMs)));
  }

  private ensureTicker(): void {
    if (this.stopTicker || !this.backend || this.disposed) return;
    this.lastTick = this.now();
    this.stopTicker = this.scheduler.every(TICK_MS, () => {
      const t = this.now();
      this.tick(t - this.lastTick);
      this.lastTick = t;
      if (!this.soundscape.has() && this.voices.length === 0) this.cancelTicker();
    });
  }

  private cancelTicker(): void {
    this.stopTicker?.();
    this.stopTicker = undefined;
  }

  // ---- mezcla del laboratorio ----------------------------------------------------------------------------------------

  /** Solo: el emisor o prueba `owner` suena y los demás emisores bajan a `othersGain` (0 por defecto). `null` restaura la mezcla. */
  setSolo(owner: string | null, othersGain = 0): void {
    this.solo = owner;
    this.othersGain = owner === null ? 1 : clamp01(othersGain);
    this.refreshAll();
  }

  /** Aplica un borrador a un emisor de la zona activa, en vivo. */
  setEmitterDraft(soundId: string, sound: MapSound | null): void {
    this.soundscape.setDraft(soundId, sound);
  }

  setEmitterMuted(soundId: string, muted: boolean): void {
    this.soundscape.setMuted(soundId, muted);
  }

  /** Dispara ahora un emisor del mapa con sus ajustes reales (la prueba «en el mapa» del laboratorio). */
  fireEmitter(soundId: string): boolean {
    return this.soundscape.fire(soundId);
  }

  liveSound(soundId: string): MapSound | undefined {
    return this.soundscape.liveSound(soundId);
  }

  emitterIds(): string[] {
    return this.soundscape.ids();
  }

  diagnostics(): SfxDiagnostics {
    const voices: VoiceDiagnostic[] = this.voices.map((v) => ({
      id: v.id, kind: v.request.kind, label: v.request.label, key: v.request.key, factors: { ...v.factors }, effective: v.effective, rate: v.rate, loop: v.request.loop,
    }));
    return {
      state: this.state,
      listener: this.listenerOverride ?? this.listenerPoint,
      listenerVirtual: this.listenerOverride !== null,
      emitters: this.soundscape.diagnostics(),
      voices,
      master: this.master,
      decodedBytes: [...this.cache.values()].reduce((n, c) => n + c.bytes, 0),
    };
  }
}

function documentVisibility(): NonNullable<SfxDeps["visibility"]> {
  return {
    isHidden: () => typeof document !== "undefined" && document.visibilityState === "hidden",
    subscribe: (listener) => {
      if (typeof document === "undefined") return () => undefined;
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
  };
}
