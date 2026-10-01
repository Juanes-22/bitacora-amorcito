export type PlaylistOrder = "sequential" | "shuffle";

/**
 * Pista que sigue a `current`. `sequential` rota en el orden de la lista y, tras la última, vuelve a la primera;
 * `shuffle` elige al azar sin repetir la pista que acaba de sonar (si hay más de una).
 */
export function nextIndex(count: number, current: number, order: PlaylistOrder, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  if (order === "sequential") return (current + 1) % count;
  const pick = Math.floor(random() * (count - 1)); // 0..count-2
  return pick >= current ? pick + 1 : pick;
}

/** Pista con la que arranca la reproducción. */
export function firstIndex(count: number, order: PlaylistOrder, random: () => number = Math.random): number {
  return order === "shuffle" && count > 1 ? Math.floor(random() * count) : 0;
}
