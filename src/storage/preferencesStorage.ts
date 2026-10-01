import type { StorageLike } from "./progressStorage";

/** Preferencias del visitante, separadas del progreso: reiniciar el recorrido no las borra (SPEC 6.4). */
export const PREFERENCES_KEY = "bitacora:preferences:v1";

export interface Preferences {
  musicMuted: boolean;
  /** Modo de controles táctiles elegido por el visitante; sin valor, manda `gameplay.touchControls`. */
  touchControls?: "tap" | "dpad";
}

const DEFAULTS: Preferences = { musicMuted: false };

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

  get musicMuted(): boolean {
    return this.memory.musicMuted;
  }

  get touchControls(): "tap" | "dpad" | undefined {
    return this.memory.touchControls;
  }

  setMusicMuted(muted: boolean): void {
    this.write({ musicMuted: muted });
  }

  setTouchControls(mode: "tap" | "dpad"): void {
    this.write({ touchControls: mode });
  }

  private write(patch: Partial<Preferences>): void {
    this.memory = { ...this.memory, ...patch };
    try {
      this.storage?.setItem(PREFERENCES_KEY, JSON.stringify(this.memory));
    } catch {
      /* cuota agotada o almacenamiento bloqueado: la preferencia vale para esta sesión */
    }
  }

  private read(): Preferences {
    try {
      const raw = this.storage?.getItem(PREFERENCES_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && typeof (parsed as Record<string, unknown>).musicMuted === "boolean") {
        const mode = (parsed as Preferences).touchControls;
        return { musicMuted: (parsed as Preferences).musicMuted, ...(mode === "tap" || mode === "dpad" ? { touchControls: mode } : {}) };
      }
    } catch {
      /* JSON corrupto: se ignora */
    }
    return { ...DEFAULTS };
  }
}
