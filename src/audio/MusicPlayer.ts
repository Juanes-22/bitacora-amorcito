import { firstIndex, nextIndex, type PlaylistOrder } from "./playlist";

/** Subconjunto de HTMLAudioElement que usa el reproductor (permite sustituirlo en pruebas). */
export interface AudioLike {
  src: string;
  volume: number;
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  preload: string;
  play(): Promise<void>;
  pause(): void;
  removeAttribute?(name: string): void;
  load?(): void;
  addEventListener(type: "ended" | "error", listener: () => void): void;
  removeEventListener(type: "ended" | "error", listener: () => void): void;
}

export interface MusicTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
}

export interface MusicOptions {
  tracks: readonly MusicTrack[];
  order: PlaylistOrder;
  /** 0..1 */
  volume: number;
  /** Fundido entre pistas, también al principio y al final de cada una. */
  crossfadeMs: number;
}

export interface MusicDeps {
  createAudio?: (url: string) => AudioLike;
  random?: () => number;
  now?: () => number;
  /** Visibilidad de la pestaña; por defecto, `document`. */
  visibility?: { isHidden(): boolean; subscribe(listener: () => void): () => void };
  /** Cuando cambia la preferencia de silencio. */
  onMutedChange?: (muted: boolean) => void;
}

export type MusicStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";

export interface MusicState {
  status: MusicStatus;
  muted: boolean;
  /** Pista que suena (o sonaría) ahora; `null` antes de empezar. */
  track: MusicTrack | null;
  /** IDs de las pistas que fallaron al cargar o reproducirse. */
  failed: readonly string[];
}

const TICK_MS = 100;
/** Con tanta antelación se empieza a descargar la pista siguiente (por flujo, no entera en memoria). */
const PREFETCH_S = 20;
/** Fundido al encender o apagar. */
const MASTER_FADE_MS = 500;

interface Slot {
  index: number;
  audio: AudioLike;
  started: boolean;
  onEnded: () => void;
  onError: () => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Música de fondo con rotación de pistas (SPEC 6.4). Independiente de Phaser y de React: usa elementos de audio que
 * se transmiten por flujo y solo mantiene la pista que suena y, durante el fundido, la siguiente. `start()` debe
 * llamarse desde un gesto del visitante (pulsar «Comenzar»); antes no suena nada. Cualquier fallo de carga o de
 * reproducción se anota en el estado y nunca lanza: la bitácora funciona igual sin música.
 */
export class MusicPlayer {
  private state: MusicState;
  private readonly listeners = new Set<() => void>();
  private readonly createAudio: (url: string) => AudioLike;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly visibility: NonNullable<MusicDeps["visibility"]>;
  private slots: Slot[] = [];
  private started = false;
  private suspended = false;
  private master = 0;
  private masterTarget = 0;
  private current = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastTick = 0;
  private unsubscribeVisibility: (() => void) | undefined;
  private failuresInRow = 0;

  constructor(private readonly options: MusicOptions, muted: boolean, private readonly deps: MusicDeps = {}) {
    this.createAudio = deps.createAudio ?? ((url) => new Audio(url));
    this.random = deps.random ?? Math.random;
    this.now = deps.now ?? (() => Date.now());
    this.visibility = deps.visibility ?? documentVisibility();
    this.state = { status: "idle", muted, track: null, failed: [] };
  }

  getState = (): MusicState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Empieza la reproducción (gesto del visitante). Con la música silenciada solo se arma: sonará al encenderla. */
  start(): void {
    if (this.started || this.options.tracks.length === 0) return;
    this.started = true;
    this.unsubscribeVisibility = this.visibility.subscribe(() => this.onVisibility());
    if (!this.state.muted) this.begin();
  }

  setMuted(muted: boolean): void {
    if (muted === this.state.muted) return;
    this.deps.onMutedChange?.(muted);
    this.set({ muted });
    if (!this.started) return;
    if (muted) {
      this.masterTarget = 0; // el tic baja el volumen y pausa
      this.ensureTimer();
    } else if (this.slots.length === 0) {
      this.begin();
    } else {
      this.masterTarget = 1;
      this.resume();
    }
  }

  /** Apaga o enciende; si el navegador había bloqueado la reproducción, el gesto reintenta en lugar de apagar. */
  toggle(): void {
    if (this.state.status === "blocked" && !this.state.muted) {
      this.masterTarget = 1;
      this.resume();
      return;
    }
    this.setMuted(!this.state.muted);
  }

  /** Detiene todo y suelta los elementos de audio. Se puede volver a llamar a `start()` después. */
  dispose(): void {
    this.stopTimer();
    this.unsubscribeVisibility?.();
    this.unsubscribeVisibility = undefined;
    for (const slot of [...this.slots]) this.release(slot);
    this.slots = [];
    this.started = false;
    this.suspended = false;
    this.master = 0;
    this.masterTarget = 0;
    this.failuresInRow = 0;
    this.set({ status: "idle", track: null });
  }

  /** Un tic de reproducción (público para las pruebas; lo llama el temporizador). */
  tick(deltaMs: number): void {
    const step = deltaMs / MASTER_FADE_MS;
    this.master = this.masterTarget > this.master ? Math.min(this.masterTarget, this.master + step) : Math.max(this.masterTarget, this.master - step);

    const { crossfadeMs, volume } = this.options;
    const [head, next] = this.slots;
    if (head && head.started) {
      if (head.audio.currentTime > 1) this.failuresInRow = 0; // sonó de verdad: los fallos anteriores no cuentan
      const remainingS = Number.isFinite(head.audio.duration) ? head.audio.duration - head.audio.currentTime : Infinity;
      if (!next && remainingS <= PREFETCH_S && this.options.tracks.length > 1) this.openNext(head);
      if (next && !next.started && remainingS * 1000 <= Math.max(crossfadeMs, TICK_MS)) this.playSlot(next);
    }
    for (const slot of this.slots) {
      const played = slot.audio.currentTime * 1000;
      const remaining = Number.isFinite(slot.audio.duration) ? slot.audio.duration * 1000 - played : Infinity;
      const gain = crossfadeMs > 0 ? Math.min(clamp01(played / crossfadeMs), clamp01(remaining / crossfadeMs)) : 1;
      slot.audio.volume = clamp01(gain * volume * this.master);
    }
    if (this.masterTarget === 0 && this.master === 0 && !this.suspended) {
      this.pauseAll();
      this.set({ status: "paused" });
    }
  }

  // ---- internos -----------------------------------------------------------------------------------------------

  private begin(): void {
    this.current = firstIndex(this.options.tracks.length, this.options.order, this.random);
    this.masterTarget = 1;
    this.master = 0;
    this.suspended = this.visibility.isHidden();
    const slot = this.open(this.current);
    if (!this.suspended) this.playSlot(slot);
    this.ensureTimer();
  }

  private open(index: number): Slot {
    const track = this.options.tracks[index];
    const audio = this.createAudio(track.url);
    audio.preload = "auto";
    audio.volume = 0;
    const slot: Slot = { index, audio, started: false, onEnded: () => this.onEnded(slot), onError: () => this.onError(slot) };
    audio.addEventListener("ended", slot.onEnded);
    audio.addEventListener("error", slot.onError);
    this.slots.push(slot);
    return slot;
  }

  private openNext(head: Slot): void {
    const index = nextIndex(this.options.tracks.length, head.index, this.options.order, this.random);
    this.open(index);
  }

  private playSlot(slot: Slot): void {
    slot.started = true;
    if (slot === this.slots[0]) this.set({ status: this.state.status === "playing" ? "playing" : "loading", track: this.options.tracks[slot.index] });
    let result: Promise<void> | undefined;
    try {
      result = slot.audio.play();
    } catch {
      this.onError(slot);
      return;
    }
    result?.then(
      () => {
        if (this.slots[0] === slot) this.set({ status: this.suspended || this.state.muted ? this.state.status : "playing", track: this.options.tracks[slot.index] });
      },
      (error: unknown) => {
        if ((error as { name?: string } | undefined)?.name === "NotAllowedError") {
          // El navegador exige un gesto: la música queda lista y se reintenta al encenderla otra vez.
          slot.started = false;
          this.set({ status: "blocked" });
          this.stopTimer();
        } else {
          this.onError(slot);
        }
      },
    );
  }

  private onEnded(slot: Slot): void {
    const wasHead = this.slots[0] === slot;
    this.release(slot);
    this.slots = this.slots.filter((s) => s !== slot);
    if (!wasHead) return;
    const [next] = this.slots;
    if (next) {
      this.current = next.index;
      if (!next.started && !this.suspended) this.playSlot(next);
      this.set({ track: this.options.tracks[next.index] });
    } else if (this.started && !this.state.muted) {
      // Sin fundido ni pista preparada (lista de una sola pista o duración desconocida): sigue la siguiente.
      this.current = nextIndex(this.options.tracks.length, slot.index, this.options.order, this.random);
      const fresh = this.open(this.current);
      if (!this.suspended) this.playSlot(fresh);
    }
  }

  private onError(slot: Slot): void {
    const track = this.options.tracks[slot.index];
    const wasHead = this.slots[0] === slot;
    this.release(slot);
    this.slots = this.slots.filter((s) => s !== slot);
    this.failuresInRow++;
    this.set({ failed: this.state.failed.includes(track.id) ? this.state.failed : [...this.state.failed, track.id] });
    if (this.failuresInRow >= this.options.tracks.length) {
      this.stopTimer();
      this.set({ status: "error" });
      return;
    }
    if (!wasHead || !this.started || this.state.muted) return;
    const [next] = this.slots;
    if (next) {
      // La siguiente ya estaba preparada: pasa a ser la que suena.
      this.current = next.index;
      this.set({ track: this.options.tracks[next.index] });
      if (!this.suspended && !next.started) this.playSlot(next);
    } else {
      this.current = nextIndex(this.options.tracks.length, slot.index, this.options.order, this.random);
      const fresh = this.open(this.current);
      if (!this.suspended) this.playSlot(fresh);
    }
  }

  private release(slot: Slot): void {
    slot.audio.removeEventListener("ended", slot.onEnded);
    slot.audio.removeEventListener("error", slot.onError);
    try {
      slot.audio.pause();
      slot.audio.removeAttribute?.("src");
      slot.audio.load?.();
    } catch {
      /* ya liberado */
    }
  }

  private pauseAll(): void {
    for (const slot of this.slots) {
      try {
        slot.audio.pause();
      } catch {
        /* nada que pausar */
      }
    }
    this.stopTimer();
  }

  private resume(): void {
    if (this.suspended || this.state.muted) return;
    this.ensureTimer();
    for (const slot of this.slots) {
      if (slot.started || slot === this.slots[0]) this.playSlot(slot);
    }
  }

  private onVisibility(): void {
    if (!this.started) return;
    if (this.visibility.isHidden()) {
      this.suspended = true;
      this.pauseAll();
      if (!this.state.muted && this.state.status === "playing") this.set({ status: "paused" });
    } else {
      this.suspended = false;
      if (this.state.muted) return;
      if (this.slots.length === 0) this.begin();
      else this.resume();
    }
  }

  private ensureTimer(): void {
    if (this.timer !== undefined) return;
    this.lastTick = this.now();
    this.timer = setInterval(() => {
      const t = this.now();
      this.tick(Math.min(1000, t - this.lastTick));
      this.lastTick = t;
    }, TICK_MS);
  }

  private stopTimer(): void {
    if (this.timer === undefined) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private set(partial: Partial<MusicState>): void {
    const next = { ...this.state, ...partial };
    if (next.status === this.state.status && next.muted === this.state.muted && next.track === this.state.track && next.failed === this.state.failed) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }
}

function documentVisibility(): NonNullable<MusicDeps["visibility"]> {
  return {
    isHidden: () => typeof document !== "undefined" && document.visibilityState === "hidden",
    subscribe: (listener) => {
      if (typeof document === "undefined") return () => undefined;
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
  };
}
