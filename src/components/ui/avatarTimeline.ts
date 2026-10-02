import type { AvatarAnimation } from "../../config/types";

/** Cuántas vueltas de la animación feliz se ven cuando se completa una estación antes de volver al reposo. */
export const HAPPY_CYCLES = 3;

/** Duración total de una vuelta de la animación (ms). */
export function cycleMs(anim: Pick<AvatarAnimation, "durationsMs">): number {
  return anim.durationsMs.reduce((sum, d) => sum + d, 0);
}

/** Índice del fotograma que toca a los `elapsedMs` desde que empezó; la animación da vueltas sin fin. */
export function frameIndexAt(anim: Pick<AvatarAnimation, "durationsMs">, elapsedMs: number): number {
  const total = cycleMs(anim);
  if (total <= 0) return 0;
  let t = ((elapsedMs % total) + total) % total;
  for (let i = 0; i < anim.durationsMs.length; i++) {
    if (t < anim.durationsMs[i]) return i;
    t -= anim.durationsMs[i];
  }
  return anim.durationsMs.length - 1;
}

/** Fotograma que se muestra quieto con movimiento reducido: el primero del reposo; con la alegría, el de la sonrisa abierta. */
export function stillFrameName(anim: Pick<AvatarAnimation, "state" | "frameNames">): string {
  return anim.state === "happy" ? anim.frameNames[Math.min(1, anim.frameNames.length - 1)] : anim.frameNames[0];
}
