import type { BackendStatus, BackendVoice, LoadedSound, SfxBackend } from "./sfxTypes";

/**
 * Reproductor de efectos con elementos de audio normales, para los navegadores sin Web Audio (SPEC 6.5): funciona en mono, con volumen
 * y velocidad, pero sin fundidos finos ni mezcla avanzada. Es el mismo contrato que el reproductor de Phaser.
 */
export class HtmlSfxBackend implements SfxBackend {
  readonly kind = "html5" as const;
  private readonly sources = new Map<string, { url: string; blob: boolean; duration: number }>();
  private readonly listeners = new Set<() => void>();
  private state: BackendStatus;

  constructor(private readonly createAudio: (url: string) => HTMLAudioElement = (url) => new Audio(url)) {
    this.state = typeof Audio === "undefined" ? "unavailable" : "locked";
  }

  status(): BackendStatus {
    return this.state;
  }

  async unlock(): Promise<void> {
    if (this.state === "locked") this.set("ready"); // si el navegador sigue bloqueando, el primer `play()` lo detecta
  }

  load(key: string, url: string): Promise<LoadedSound> {
    return this.probe(key, url, false);
  }

  async loadData(key: string, data: ArrayBuffer): Promise<LoadedSound> {
    return this.probe(key, URL.createObjectURL(new Blob([data])), true, data.byteLength);
  }

  private probe(key: string, url: string, blob: boolean, size?: number): Promise<LoadedSound> {
    return new Promise((resolve, reject) => {
      const audio = this.createAudio(url);
      audio.preload = "auto";
      const done = () => {
        this.sources.set(key, { url, blob, duration: audio.duration });
        resolve({ key, durationSeconds: Number.isFinite(audio.duration) ? audio.duration : 0, bytes: size ?? Math.round((Number.isFinite(audio.duration) ? audio.duration : 1) * 44100 * 2) });
      };
      audio.addEventListener("loadedmetadata", done, { once: true });
      audio.addEventListener("error", () => {
        if (blob) URL.revokeObjectURL(url);
        reject(new Error("el navegador no pudo leer el archivo de audio"));
      }, { once: true });
    });
  }

  has(key: string): boolean {
    return this.sources.has(key);
  }

  unload(key: string): void {
    const s = this.sources.get(key);
    if (s?.blob) URL.revokeObjectURL(s.url);
    this.sources.delete(key);
  }

  play(key: string, o: { volume: number; rate: number; loop: boolean }): BackendVoice | null {
    const s = this.sources.get(key);
    if (!s || this.state === "unavailable") return null;
    const audio = this.createAudio(s.url);
    audio.volume = Math.min(1, Math.max(0, o.volume));
    audio.playbackRate = o.rate;
    audio.loop = o.loop;
    let ended = false;
    let callback: (() => void) | undefined;
    audio.addEventListener("ended", () => {
      ended = true;
      callback?.();
    });
    void audio.play().catch((e: unknown) => {
      if ((e as { name?: string } | undefined)?.name === "NotAllowedError") this.set("locked");
    });
    return {
      setVolume: (v) => void (audio.volume = Math.min(1, Math.max(0, v))),
      setRate: (r) => void (audio.playbackRate = r),
      stop: () => {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      },
      onEnd: (cb) => {
        callback = cb;
        if (ended) cb();
      },
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    for (const key of [...this.sources.keys()]) this.unload(key);
    this.listeners.clear();
  }

  private set(next: BackendStatus): void {
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }
}
