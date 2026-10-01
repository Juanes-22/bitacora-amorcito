import type { Point } from "../../config/types";

/** Aproximación a un punto intermedio para darlo por alcanzado. */
const WAYPOINT_REACHED = 3;
/** Sin acercarse al menos esto durante `STUCK_MS`, se considera atascado (un obstáculo que la rejilla no previó). */
const MIN_PROGRESS = 1.5;
const STUCK_MS = 450;

/**
 * Sigue una lista de puntos y entrega, cada fotograma, la dirección hacia el siguiente (SPEC 6.1). No mueve nada: el
 * vector se entrega al mismo controlador de movimiento que usa el teclado. Función pura de estado, sin Phaser.
 */
export class PathFollower {
  private waypoints: Point[] = [];
  private index = 0;
  private stopDistance = 0;
  private bestDistance = Infinity;
  private sinceProgress = 0;
  private stuck = false;

  /** Empieza un recorrido nuevo. `stopDistance` > 0 detiene antes de llegar al último punto (estaciones y portales). */
  set(waypoints: readonly Point[], stopDistance = 0): void {
    this.waypoints = waypoints.map((p) => ({ ...p }));
    this.index = 0;
    this.stopDistance = stopDistance;
    this.resetProgress();
    this.stuck = false;
  }

  clear(): void {
    this.waypoints = [];
    this.index = 0;
    this.stuck = false;
  }

  get active(): boolean {
    return this.index < this.waypoints.length;
  }

  /** El recorrido se atascó: quien lo llamó debe recalcular o rendirse. */
  get isStuck(): boolean {
    return this.stuck;
  }

  get destination(): Point | null {
    return this.waypoints.length ? this.waypoints[this.waypoints.length - 1] : null;
  }

  /** Dirección unitaria hacia el siguiente punto, o (0, 0) si no hay recorrido o ya se llegó. */
  vector(feet: Point, deltaMs = 16, speed = 0): { x: number; y: number } {
    if (!this.active) return { x: 0, y: 0 };
    const last = this.waypoints[this.waypoints.length - 1];
    if (this.stopDistance > 0 && Math.hypot(last.x - feet.x, last.y - feet.y) <= this.stopDistance) {
      this.clear();
      return { x: 0, y: 0 };
    }
    // Avanza al siguiente punto cuando ya se alcanzó el actual. El umbral nunca baja de lo que se recorre en un fotograma:
    // con pocos fotogramas por segundo, un umbral fijo haría oscilar a Vanessa alrededor del destino.
    const reached = Math.max(WAYPOINT_REACHED, (speed * deltaMs) / 1000);
    while (this.index < this.waypoints.length) {
      const w = this.waypoints[this.index];
      const d = Math.hypot(w.x - feet.x, w.y - feet.y);
      if (d > reached) break;
      this.index++;
      this.resetProgress();
    }
    if (!this.active) return { x: 0, y: 0 };

    const w = this.waypoints[this.index];
    const dx = w.x - feet.x, dy = w.y - feet.y;
    const d = Math.hypot(dx, dy);
    if (d < this.bestDistance - MIN_PROGRESS) {
      this.bestDistance = d;
      this.sinceProgress = 0;
    } else {
      this.sinceProgress += deltaMs;
      if (this.sinceProgress >= STUCK_MS) {
        this.clear();
        this.stuck = true;
        return { x: 0, y: 0 };
      }
    }
    return { x: dx / d, y: dy / d };
  }

  private resetProgress(): void {
    this.bestDistance = Infinity;
    this.sinceProgress = 0;
  }
}
