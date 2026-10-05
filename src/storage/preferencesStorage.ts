import type { StorageLike } from "./progressStorage";

/** Preferencias del visitante, separadas del progreso: reiniciar el recorrido no las borra (SPEC 6.4 y 6.5). */
export const PREFERENCES_KEY = "bitacora:preferences:v1";

export interface Preferences {
  /**
   * El silencio del juego completo: música y efectos de sonido (el botón «Sonido»). Antes solo silenciaba la música (`musicMuted`): un
   * guardado antiguo sin `soundMuted` conserva esa intención —quien silenció la música sigue sin oír nada—, y al guardar se escriben
   * ambos campos con el mismo valor.
   */
  soundMuted: boolean;
}

const DEFAULTS: Preferences = { soundMuted: false };

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // el acceso puede lanzar con cookies bloqueadas
  }
}

/** Lectura y escritura tolerantes: si el almacenamiento falla se sigue en memoria, sin lanzar nunca. */
export class PreferencesStorage {
  private readonly storage: StorageLike | null;
  private memory: Preferences = { ...DEFAULTS };

  constructor(storage: StorageLike | null | undefined = undefined) {
    this.storage = storage === undefined ? defaultStorage() : storage;
    this.memory = this.read();
  }

  get soundMuted(): boolean {
    return this.memory.soundMuted;
  }

  setSoundMuted(muted: boolean): void {
    this.write({ soundMuted: muted });
  }

  /** Alias de `soundMuted` (el nombre anterior, cuando el botón solo silenciaba la música). */
  get musicMuted(): boolean {
    return this.soundMuted;
  }

  setMusicMuted(muted: boolean): void {
    this.setSoundMuted(muted);
  }

  private write(patch: Partial<Preferences>): void {
    this.memory = { ...this.memory, ...patch };
    try {
      // `musicMuted` se sigue escribiendo, con el mismo valor, para que una versión anterior lea la misma preferencia.
      this.storage?.setItem(PREFERENCES_KEY, JSON.stringify({ soundMuted: this.memory.soundMuted, musicMuted: this.memory.soundMuted }));
    } catch {
      /* cuota agotada o almacenamiento bloqueado: la preferencia vale para esta sesión */
    }
  }

  private read(): Preferences {
    try {
      const raw = this.storage?.getItem(PREFERENCES_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        const p = parsed as Record<string, unknown>;
        if (typeof p.soundMuted === "boolean") return { soundMuted: p.soundMuted };
        if (typeof p.musicMuted === "boolean") return { soundMuted: p.musicMuted }; // migración: el guardado anterior
      }
    } catch {
      /* JSON corrupto: se ignora */
    }
    return { ...DEFAULTS };
  }
}
