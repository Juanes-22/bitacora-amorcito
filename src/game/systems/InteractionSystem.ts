import type { Point } from "../../config/types";
import type { GameBridge } from "../bridge/GameBridge";
import type { NearbyTarget } from "../bridge/events";

export interface InteractionTarget {
  target: NearbyTarget;
  x: number;
  y: number;
  radius: number;
  /** Desempate determinista: menor orden gana (estaciones por `route`, después portales). */
  order: number;
}

const keyOf = (t: NearbyTarget | null) => (t ? `${t.kind}:${t.id}` : "");

/**
 * Proximidad e interacción explícita (SPEC 6.3). Mide desde los pies hasta el punto de interacción, elige
 * un único objetivo por distancia y luego por orden, avisa solo cuando cambia y solicita (no abre) al
 * recibir una pulsación nueva. Mientras una solicitud está pendiente no admite otra.
 */
export class InteractionSystem {
  private current: NearbyTarget | null = null;
  private pending: string | null = null;
  private counter = 0;
  private readonly off: () => void;

  constructor(
    private readonly bridge: GameBridge,
    private readonly token: number,
    private readonly zoneId: string,
    private readonly targets: readonly InteractionTarget[],
  ) {
    // Toda solicitud se resuelve una vez; una denegación también libera el bloqueo.
    this.off = bridge.on("app:request-resolved", ({ requestId }) => {
      if (requestId === this.pending) this.pending = null;
    });
  }

  /** Objetivo más cercano dentro de su radio, o null. */
  nearest(feet: Point): NearbyTarget | null {
    let best: InteractionTarget | null = null;
    let bestDistance = Infinity;
    for (const t of this.targets) {
      const d = Math.hypot(feet.x - t.x, feet.y - t.y);
      if (d > t.radius) continue;
      if (d < bestDistance || (d === bestDistance && best !== null && t.order < best.order)) {
        best = t;
        bestDistance = d;
      }
    }
    return best ? best.target : null;
  }

  /** Devuelve true si emitió una solicitud en este fotograma (la escena detiene al personaje). */
  update(feet: Point, interactPressed: boolean): boolean {
    const near = this.nearest(feet);
    if (keyOf(near) !== keyOf(this.current)) {
      this.current = near;
      this.bridge.emit("game:nearby-changed", { target: near, token: this.token });
    }
    if (!interactPressed || !this.current || this.pending) return false;

    const requestId = `${this.token}-${++this.counter}`;
    this.pending = requestId;
    if (this.current.kind === "learning") {
      this.bridge.emit("game:learning-open-request", { learningId: this.current.id, token: this.token, requestId });
    } else {
      this.bridge.emit("game:portal-request", { portalId: this.current.id, fromZoneId: this.zoneId, token: this.token, requestId });
    }
    return true;
  }

  /** Olvida el objetivo actual (p. ej. al reanudar) para que el siguiente fotograma lo reavise. */
  clearNearby(): void {
    if (this.current) this.bridge.emit("game:nearby-changed", { target: null, token: this.token });
    this.current = null;
  }

  get hasPending(): boolean {
    return this.pending !== null;
  }

  destroy(): void {
    this.off();
  }
}
