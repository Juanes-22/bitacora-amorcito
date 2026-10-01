import type { BitacoraConfig, Point, SectionId } from "../config/types";
import { claimBadge, markSectionRead, setActiveSection } from "../domain/progression";
import { initialProgress, reconcileProgress } from "../domain/reconcileProgress";
import type { SavedProgress, Transition } from "../domain/types";
import type { ProgressStorage } from "../storage/progressStorage";

type Listener = () => void;

/** Mínimo entre escrituras de posición (los checkpoints llegan al detenerse, no por fotograma). */
const CHECKPOINT_WRITE_MS = 1500;

/**
 * Controlador de aplicación del progreso: UNA fuente de verdad (SPEC 11.1). Ejecuta las transiciones puras
 * del dominio y, solo cuando algo cambió de verdad, guarda. No emite celebraciones: quien llama las
 * decide a partir de `changed`, por eso repetir una acción no puede duplicar efectos.
 * Compatible con useSyncExternalStore: `getState` devuelve la misma referencia mientras nada cambie.
 */
export class ProgressStore {
  private state: SavedProgress;
  private readonly listeners = new Set<Listener>();
  private persistOk: boolean;
  private lastWrite = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;

  constructor(
    private readonly config: BitacoraConfig,
    private readonly storage: ProgressStorage,
    private readonly clock: () => Date = () => new Date(),
  ) {
    const loaded = storage.load(config.contentSetId, config.mode);
    this.persistOk = loaded.available;
    this.state = reconcileProgress(config, loaded.saved);
  }

  readonly getState = (): SavedProgress => this.state;

  /** false cuando el almacenamiento no está disponible o falló: el avance puede perderse al cerrar. */
  readonly isPersisting = (): boolean => this.persistOk;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  markSection(id: string, section: SectionId): Transition {
    const result = markSectionRead(this.state, this.config, id, section);
    if (result.ok && result.changed) this.commit(result.state, true);
    return result;
  }

  /** `changed` verdadero ⇒ es una transición NUEVA: solo entonces hay recompensa que celebrar. */
  claimBadge(id: string): Transition {
    const result = claimBadge(this.state, this.config, id, this.clock());
    if (result.ok && result.changed) this.commit(result.state, true);
    return result;
  }

  setActiveSection(id: string, section: SectionId): void {
    const next = setActiveSection(this.state, this.config, id, section);
    if (next !== this.state) this.commit(next, false);
  }

  /** Posición de los pies. `immediate` en cambios de zona; el resto se espacia. */
  setLocation(zoneId: string, position: Point, immediate = false): void {
    const s = this.state;
    const same = s.currentZoneId === zoneId && s.player.x === position.x && s.player.y === position.y;
    if (same && s.checkpoints[zoneId]?.x === position.x && s.checkpoints[zoneId]?.y === position.y) return;
    this.commit({ ...s, currentZoneId: zoneId, player: { ...position }, checkpoints: { ...s.checkpoints, [zoneId]: { ...position } } }, immediate, !immediate);
  }

  /** «Reiniciar recorrido»: borra solo la clave de esta bitácora y modo, y vuelve al estado inicial. */
  reset(): void {
    clearTimeout(this.timer);
    this.dirty = false;
    this.persistOk = this.storage.clear(this.config.contentSetId, this.config.mode) && this.persistOk;
    this.state = initialProgress(this.config);
    this.notify();
  }

  /** Escribe ahora lo pendiente (al ocultar la pestaña o descargar la página). */
  flush(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.dirty) return;
    this.dirty = false;
    this.lastWrite = Date.now();
    this.persistOk = this.storage.save(this.state);
    this.notify();
  }

  private commit(next: SavedProgress, immediate: boolean, throttled = false): void {
    this.state = next;
    this.dirty = true;
    if (immediate) {
      this.flush();
      return;
    }
    if (throttled && Date.now() - this.lastWrite < CHECKPOINT_WRITE_MS) {
      this.timer ??= setTimeout(() => this.flush(), CHECKPOINT_WRITE_MS);
    } else {
      this.flush();
      return;
    }
    this.notify();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
