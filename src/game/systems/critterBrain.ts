import type { Point } from "../../config/types";

/**
 * Lógica pura de las gallinas y los pollitos (SPEC 3.3): qué hacen y adónde van. No sabe nada de Phaser, así que se prueba
 * con un generador de números aleatorios controlado.
 */

export interface BrainParams {
  /** Cuánto reposa entre una cosa y la siguiente (ms, mínimo y máximo). */
  idleMs: readonly [number, number];
  /** Velocidad al caminar (píxeles del mundo por segundo). */
  walkSpeed: number;
  /** Probabilidad de picotear en vez de pasear tras reposar. */
  peckChance: number;
  /** Cuántas veces seguidas picotea (mínimo y máximo de repeticiones de la animación). */
  peckLoops: readonly [number, number];
}

/** Valores de partida del paquete: reposo de 2 a 5 s, picoteo el 40 % de las veces y pasos lentos y cortos. */
export const DEFAULT_BRAIN: BrainParams = { idleMs: [2000, 5000], walkSpeed: 18, peckChance: 0.4, peckLoops: [1, 3] };

export type CritterState = "idle" | "walk" | "peck";

export type Action =
  | { kind: "idle"; ms: number }
  | { kind: "peck"; loops: number }
  | { kind: "walk"; target: Point };

export type Rng = () => number;

const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

/** Un punto al azar del círculo de `radius` alrededor de `home` (uniforme en área). */
export function randomPointInDisc(rng: Rng, home: Point, radius: number): Point {
  const angle = between(rng, 0, Math.PI * 2);
  const r = Math.sqrt(rng()) * radius;
  return { x: home.x + Math.cos(angle) * r, y: home.y + Math.sin(angle) * r };
}

/**
 * Qué hace a continuación. Tras reposar: picotea (con `peckChance`) o pasea a un punto del círculo de su casa que no esté
 * demasiado cerca; tras picotear: reposa un rato corto o pasea; tras pasear: reposa. Sin radio no pasea nunca.
 */
export function nextAction(rng: Rng, previous: CritterState, home: Point, radius: number, at: Point, p: BrainParams = DEFAULT_BRAIN): Action {
  const canWalk = radius >= 6;
  const walk = (): Action => {
    for (let i = 0; i < 6; i++) {
      const target = randomPointInDisc(rng, home, radius);
      if (Math.hypot(target.x - at.x, target.y - at.y) >= Math.min(10, radius)) return { kind: "walk", target };
    }
    return { kind: "idle", ms: between(rng, p.idleMs[0], p.idleMs[1]) };
  };
  if (previous === "walk") return { kind: "idle", ms: between(rng, p.idleMs[0], p.idleMs[1]) };
  if (previous === "peck") {
    if (canWalk && rng() < 0.4) return walk();
    return { kind: "idle", ms: between(rng, p.idleMs[0] * 0.3, p.idleMs[1] * 0.4) };
  }
  if (rng() < p.peckChance) return { kind: "peck", loops: Math.floor(between(rng, p.peckLoops[0], p.peckLoops[1] + 1)) };
  return canWalk ? walk() : { kind: "peck", loops: 1 };
}

/**
 * El recorrido reciente de la madre: los pollitos van a los puntos del camino que ella dejó, cada uno a su distancia. Guarda
 * puntos separados al menos `step` px y solo la longitud que hace falta.
 */
export class Trail {
  private points: Point[] = [];

  constructor(private readonly step = 3, private readonly maxLength = 200) {}

  /** Empieza el recorrido: la cabeza es el último punto que se añade. */
  seed(points: readonly Point[]): void {
    this.points = points.map((p) => ({ ...p }));
  }

  push(p: Point): void {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < this.step) return;
    this.points.push({ ...p });
    this.trim();
  }

  /** El punto del recorrido que queda `distance` px por detrás de la cabeza (`head`); si no llega, el más antiguo. */
  pointBehind(head: Point, distance: number): Point {
    let remaining = distance;
    let from = head;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const to = this.points[i];
      const d = Math.hypot(to.x - from.x, to.y - from.y);
      if (d >= remaining && d > 0) {
        const t = remaining / d;
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      }
      remaining -= d;
      from = to;
    }
    return { ...(this.points[0] ?? head) };
  }

  get length(): number {
    return this.points.length;
  }

  private trim(): void {
    let total = 0;
    for (let i = this.points.length - 1; i > 0; i--) {
      total += Math.hypot(this.points[i].x - this.points[i - 1].x, this.points[i].y - this.points[i - 1].y);
      if (total > this.maxLength) {
        this.points.splice(0, i - 1);
        return;
      }
    }
  }
}

/** Un paso hacia `target` a `speed` px/s durante `dtMs`; devuelve la nueva posición y si llegó. */
export function stepToward(at: Point, target: Point, speed: number, dtMs: number): { pos: Point; arrived: boolean } {
  const dx = target.x - at.x;
  const dy = target.y - at.y;
  const d = Math.hypot(dx, dy);
  const move = (speed * dtMs) / 1000;
  if (d <= move || d === 0) return { pos: { ...target }, arrived: true };
  return { pos: { x: at.x + (dx / d) * move, y: at.y + (dy / d) * move }, arrived: false };
}
