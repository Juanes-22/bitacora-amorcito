import type { GameBridge } from "../game/bridge/GameBridge";

/**
 * Los motivos por los que el mapa está detenido (lectura, transición, ventana, laboratorio de sonidos…). Hay un solo propietario por
 * juego: el puente publica la lista COMPLETA en cada aviso (`app:controls`), así que dos emisores independientes se pisarían. El
 * controlador de progreso y el laboratorio añaden y quitan sus motivos aquí y llaman a `publish()`; el mapa se detiene mientras haya alguno.
 */
export class ControlReasons {
  private readonly reasons = new Set<string>();

  constructor(private readonly bridge: GameBridge) {}

  has(reason: string): boolean {
    return this.reasons.has(reason);
  }

  add(reason: string): void {
    this.reasons.add(reason);
  }

  delete(reason: string): void {
    this.reasons.delete(reason);
  }

  list(): string[] {
    return [...this.reasons];
  }

  /** Avisa al mapa de la lista vigente (se detiene si no está vacía). */
  publish(): void {
    this.bridge.emit("app:controls", { reasons: this.list() });
  }

  /** Añade o quita un motivo y avisa. */
  set(reason: string, on: boolean): void {
    if (on) this.reasons.add(reason);
    else this.reasons.delete(reason);
    this.publish();
  }
}
