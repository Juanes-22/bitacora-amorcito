import type Phaser from "phaser";
import { HtmlSfxBackend } from "./HtmlSfxBackend";
import type { BackendStatus, BackendVoice, LoadedSound, SfxBackend } from "./sfxTypes";

/** Constante de tiempo (s) con la que el volumen de una voz sigue a su objetivo: sin saltos audibles entre un paso del reloj y el siguiente. */
const VOLUME_SMOOTHING_S = 0.035;

/**
 * Reproductor de efectos sobre el Sound Manager del juego (SPEC 6.5): usa el contexto de audio de Phaser (no crea otro), decodifica con
 * él cada archivo una vez y lo guarda en el caché de audio de Phaser con la clave del recurso. Las voces son sonidos de Phaser que se
 * destruyen al terminar o al detenerse. La música no pasa por aquí: sigue siendo del `MusicPlayer`.
 */
export class PhaserSfxBackend implements SfxBackend {
  readonly kind = "webaudio" as const;
  private readonly listeners = new Set<() => void>();
  private readonly onState = () => this.listeners.forEach((l) => l());

  constructor(
    private readonly game: Phaser.Game,
    private readonly context: AudioContext,
    private readonly fetcher: (url: string) => Promise<Response> = (url) => fetch(url),
  ) {
    context.addEventListener("statechange", this.onState);
  }

  status(): BackendStatus {
    const s = this.context.state as string;
    return s === "running" ? "ready" : s === "closed" ? "unavailable" : "locked";
  }

  async unlock(): Promise<void> {
    if (this.status() === "locked") await this.context.resume();
  }

  async load(key: string, url: string): Promise<LoadedSound> {
    const response = await this.fetcher(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return this.decode(key, await response.arrayBuffer());
  }

  loadData(key: string, data: ArrayBuffer): Promise<LoadedSound> {
    return this.decode(key, data);
  }

  private async decode(key: string, data: ArrayBuffer): Promise<LoadedSound> {
    const buffer = await this.context.decodeAudioData(data.slice(0));
    this.game.cache.audio.add(key, buffer);
    return { key, durationSeconds: buffer.duration, bytes: buffer.length * buffer.numberOfChannels * 4 };
  }

  has(key: string): boolean {
    return this.game.cache.audio.exists(key);
  }

  unload(key: string): void {
    this.game.cache.audio.remove(key);
  }

  play(key: string, o: { volume: number; rate: number; loop: boolean }): BackendVoice | null {
    const sound = this.game.sound.add(key, { volume: o.volume, rate: o.rate, loop: o.loop }) as Phaser.Sound.WebAudioSound;
    let stopped = false;
    if (!sound.play()) {
      sound.destroy();
      return null;
    }
    const release = () => {
      if (stopped) return;
      stopped = true;
      sound.destroy();
    };
    return {
      setVolume: (v) => {
        if (stopped) return;
        const gain = sound.volumeNode?.gain;
        if (!gain) return;
        const now = this.context.currentTime;
        gain.cancelScheduledValues(now);
        gain.setTargetAtTime(Math.min(1, Math.max(0, v)), now, VOLUME_SMOOTHING_S);
      },
      setRate: (r) => {
        if (!stopped) sound.setRate(r);
      },
      stop: () => {
        if (stopped) return;
        sound.stop();
        release();
      },
      onEnd: (cb) => {
        sound.once("complete", () => {
          release();
          cb();
        });
      },
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.context.removeEventListener("statechange", this.onState);
    this.listeners.clear();
  }
}

/** El reproductor que corresponde al juego: Web Audio (el contexto de Phaser) o, si no hay, elementos de audio normales. */
export function createGameSfxBackend(game: Phaser.Game): SfxBackend {
  const manager = game.sound as unknown as { context?: AudioContext };
  return manager.context ? new PhaserSfxBackend(game, manager.context) : new HtmlSfxBackend();
}
