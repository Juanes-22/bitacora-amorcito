import type { Point } from "../../config/types";

export interface SwimPosition {
  x: number;
  y: number;
  /** `true` cuando hay que voltear el sprite para que mire hacia donde nada. */
  flipX: boolean;
}

export interface Swimmer {
  /** Longitud de un trayecto de ida. */
  length: number;
  speed: number;
  /** Posición tras recorrer `distance` píxeles: ida y vuelta por la trayectoria, de forma cíclica. */
  at(distance: number): SwimPosition;
}

/**
 * Recorrido de ida y vuelta por una trayectoria de puntos (SPEC 3.2). Función pura sin Phaser: el motor solo
 * aplica la posición y el volteo. El dibujo mira a `facing`; se voltea cuando el pato avanza hacia el lado opuesto.
 * Un tramo vertical conserva el último sentido para no parpadear.
 */
export function swimmer(path: readonly Point[], speed: number, facing: "left" | "right"): Swimmer {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const l = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    lengths.push(l);
    total += l;
  }
  // Hacia la derecha si el primer tramo con avance horizontal así lo hace.
  let lastRight = true;
  for (let i = 0; i + 1 < path.length; i++) {
    const dx = path[i + 1].x - path[i].x;
    if (Math.abs(dx) > 0.01) { lastRight = dx > 0; break; }
  }

  const at = (distance: number): SwimPosition => {
    if (total === 0) return { x: path[0].x, y: path[0].y, flipX: facing === "left" };
    const m = ((distance % (2 * total)) + 2 * total) % (2 * total);
    const forward = m <= total;
    let remaining = forward ? m : 2 * total - m;
    let i = 0;
    while (i < lengths.length - 1 && remaining > lengths[i]) {
      remaining -= lengths[i];
      i++;
    }
    const a = path[i], b = path[i + 1];
    const t = lengths[i] === 0 ? 0 : Math.min(1, remaining / lengths[i]);
    const dx = (b.x - a.x) * (forward ? 1 : -1);
    if (Math.abs(dx) > 0.01) lastRight = dx > 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, flipX: lastRight !== (facing === "right") };
  };
  return { length: total, speed, at };
}
