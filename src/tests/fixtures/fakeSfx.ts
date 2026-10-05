import { createAssetRegistry } from "../../config/assetRegistry";
import type { AssetManifest, MapSound, SfxConfig } from "../../config/types";
import { SfxService, type SfxDeps } from "../../audio/SfxService";
import type { BackendStatus, BackendVoice, LoadedSound, SfxBackend } from "../../audio/sfxTypes";
import manifestJson from "../../../public/assets/assets.json";

/** Una voz falsa: anota el volumen, la velocidad y si se detuvo, y deja terminar «a mano». */
export class FakeVoice implements BackendVoice {
  volume: number;
  rate: number;
  stopped = false;
  ended = false;
  private callbacks: Array<() => void> = [];
  constructor(readonly key: string, readonly loop: boolean, volume: number, rate: number) {
    this.volume = volume;
    this.rate = rate;
  }
  setVolume(v: number) { this.volume = v; }
  setRate(r: number) { this.rate = r; }
  stop() { this.stopped = true; }
  onEnd(cb: () => void) { this.callbacks.push(cb); }
  /** Termina por sí sola (el archivo llegó a su fin). */
  finish() { if (!this.stopped && !this.ended) { this.ended = true; this.callbacks.forEach((c) => c()); } }
  get sounding() { return !this.stopped && !this.ended; }
}

/** Un backend sin audio: carga al instante (o falla a petición), guarda las voces que se piden y se desbloquea cuando se le dice. */
export class FakeBackend implements SfxBackend {
  kind: "webaudio" = "webaudio";
  state: BackendStatus = "ready";
  loaded = new Map<string, number>();
  voices: FakeVoice[] = [];
  loadCalls: string[] = [];
  failLoad = new Set<string>();
  unlockCalls = 0;
  private listeners = new Set<() => void>();
  /** Bytes que «ocupa» cada recurso decodificado. */
  bytesPer = 1000;
  status() { return this.state; }
  async unlock() { this.unlockCalls++; }
  async load(key: string, _url: string): Promise<LoadedSound> {
    this.loadCalls.push(key);
    if (this.failLoad.has(key)) throw new Error("404");
    this.loaded.set(key, this.bytesPer);
    return { key, durationSeconds: 1, bytes: this.bytesPer };
  }
  async loadData(key: string, data: ArrayBuffer): Promise<LoadedSound> {
    this.loaded.set(key, data.byteLength);
    return { key, durationSeconds: 1, bytes: data.byteLength };
  }
  has(key: string) { return this.loaded.has(key); }
  unload(key: string) { this.loaded.delete(key); }
  play(key: string, o: { volume: number; rate: number; loop: boolean }) {
    if (!this.has(key)) return null;
    const v = new FakeVoice(key, o.loop, o.volume, o.rate);
    this.voices.push(v);
    return v;
  }
  subscribe(l: () => void) { this.listeners.add(l); return () => this.listeners.delete(l); }
  setStatus(s: BackendStatus) { this.state = s; this.listeners.forEach((l) => l()); }
  dispose() {}
  get live() { return this.voices.filter((v) => v.sounding); }
}

export const registry = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost:5173/assets/assets.json");

export const DEFAULT_SFX: SfxConfig = {
  active: true, volume: 0.8, maxVoices: 12,
  events: {
    "ui.open": { assetId: "audio.sfx.test-ui-open", volume: 0.5, rate: 1 },
    "badge.earned": { assetId: "audio.sfx.test-badge", volume: 0.7, rate: 1 },
  },
};

export const pointSound = (over: Partial<MapSound> = {}): MapSound =>
  ({ label: "Río", assetId: "audio.sfx.test-river", enabled: true, volume: 0.5, rate: 1, fadeInMs: 100, fadeOutMs: 200, playback: { mode: "loop" }, shape: "point", position: { x: 100, y: 100 }, innerRadius: 50, radius: 250, ...over }) as MapSound;

export const areaSound = (over: Partial<MapSound> = {}): MapSound =>
  ({ label: "Viento", assetId: "audio.sfx.test-wind", enabled: true, volume: 0.5, rate: 1, fadeInMs: 100, fadeOutMs: 200, playback: { mode: "loop" }, shape: "rect", area: { x: 0, y: 0, width: 200, height: 100 }, edgeFadePx: 100, ...over }) as MapSound;

export interface Harness {
  svc: SfxService;
  backend: FakeBackend;
  clock: { now: number };
  /** Avanza el reloj y el servicio, en pasos de 50 ms. */
  advance(ms: number): void;
  setHidden(hidden: boolean): void;
}

/** Un servicio con reloj, azar y visibilidad controlados, ya con un backend y el gesto del visitante dados. */
export async function harness(config: SfxConfig | null = DEFAULT_SFX, options: { unlock?: boolean; random?: () => number; muted?: boolean } = {}): Promise<Harness> {
  const clock = { now: 1000 };
  let hidden = false;
  const listeners = new Set<() => void>();
  const deps: SfxDeps = {
    now: () => clock.now,
    random: options.random ?? (() => 0.5),
    visibility: { isHidden: () => hidden, subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); } },
    scheduler: { every: () => () => undefined },
  };
  const svc = new SfxService(config ?? undefined, registry, deps, options.muted ?? false);
  const backend = new FakeBackend();
  svc.attach(backend);
  if (options.unlock !== false) await svc.unlock();
  return {
    svc, backend, clock,
    advance(ms) { for (let t = 0; t < ms; t += 50) { clock.now += 50; svc.tick(50); } },
    setHidden(h) { hidden = h; listeners.forEach((l) => l()); },
  };
}

/** Deja resolver las promesas pendientes (las cargas del backend falso). */
export const flush = () => new Promise<void>((r) => setTimeout(r, 0));
