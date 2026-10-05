import type { PreferencesStorage } from "../storage/preferencesStorage";
import type { MusicPlayer, MusicTrack } from "./MusicPlayer";
import type { SfxService } from "./SfxService";

export interface SoundControlState {
  /** El visitante silenció el juego (música y efectos). */
  muted: boolean;
  /** El navegador exige un gesto para que suene: el botón ofrece «Activar audio». */
  blocked: boolean;
  /** La música falló del todo (ninguna pista se pudo cargar) y no hay efectos que sigan sonando. */
  failed: boolean;
  hasMusic: boolean;
  hasSfx: boolean;
  track: MusicTrack | null;
}

/**
 * El botón público «Sonido» (SPEC 6.4 y 6.5): silencia y reactiva el audio del juego completo —la música y los efectos— con una sola
 * preferencia del visitante (`soundMuted`), y reintenta el audio si el navegador lo bloqueó. No reproduce nada por sí mismo: coordina
 * al `MusicPlayer` y al `SfxService`, que siguen siendo independientes.
 */
export class SoundControl {
  private state: SoundControlState;
  private muted: boolean;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribes: Array<() => void> = [];

  constructor(private readonly music: MusicPlayer | null, private readonly sfx: SfxService | null, private readonly preferences: PreferencesStorage) {
    this.muted = music ? music.getState().muted : sfx ? sfx.getState().muted : preferences.soundMuted;
    this.state = this.compute();
    this.connect();
  }

  /**
   * Se suscribe a la música y a los efectos. El constructor ya lo hace; React (StrictMode, en desarrollo) vuelve a montar el efecto de
   * limpieza con la misma instancia, así que el efecto que la desecha también la reconecta. Idempotente.
   */
  connect(): () => void {
    if (this.unsubscribes.length === 0) {
      if (this.music) this.unsubscribes.push(this.music.subscribe(() => this.onChange()));
      if (this.sfx) this.unsubscribes.push(this.sfx.subscribe(() => this.onChange()));
      this.onChange();
    }
    return () => this.dispose();
  }

  getState = (): SoundControlState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Silencia o reactiva todo el audio y lo recuerda. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.preferences.setSoundMuted(muted);
    this.music?.setMuted(muted);
    this.sfx?.setMuted(muted);
    this.onChange();
  }

  /** Pulsar el botón: si el audio está bloqueado lo reintenta (el gesto lo desbloquea); si no, alterna el silencio. */
  toggle(): void {
    if (this.state.blocked && !this.muted) {
      this.music?.toggle(); // con la música bloqueada, `toggle` reintenta en lugar de apagar
      void this.sfx?.unlock();
      return;
    }
    this.setMuted(!this.muted);
  }

  dispose(): void {
    this.unsubscribes.splice(0).forEach((off) => off());
    this.listeners.clear();
  }

  private onChange(): void {
    // Si alguien silenció o reactivó uno de los dos por su cuenta (una prueba, otro componente), el botón sigue lo que dice la música.
    const musicMuted = this.music?.getState().muted;
    if (musicMuted !== undefined && musicMuted !== this.muted) this.muted = musicMuted;
    const next = this.compute();
    const prev = this.state;
    if (next.muted === prev.muted && next.blocked === prev.blocked && next.failed === prev.failed && next.hasMusic === prev.hasMusic && next.hasSfx === prev.hasSfx && next.track === prev.track) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  private compute(): SoundControlState {
    const music = this.music?.getState();
    const sfx = this.sfx?.getState();
    const hasSfx = !!sfx?.enabled;
    const musicBlocked = music?.status === "blocked";
    const sfxBlocked = hasSfx && sfx?.status === "locked";
    const musicFailed = music?.status === "error";
    return {
      muted: this.muted,
      blocked: !this.muted && (musicBlocked || sfxBlocked),
      failed: !this.muted && musicFailed && !hasSfx,
      hasMusic: !!this.music,
      hasSfx,
      track: music?.track ?? null,
    };
  }
}
