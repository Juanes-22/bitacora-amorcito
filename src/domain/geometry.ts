import type { BitacoraConfig, MapZone, Point } from "../config/types";

/** Radio del cuerpo de Vanessa en unidades del mundo: de `gameplay.player.body` × `scale`. */
export function bodyRadius(config: BitacoraConfig): number {
  const { body, scale } = config.gameplay.player;
  return (Math.max(body.width, body.height) * scale) / 2;
}

/**
 * ¿Puede el cuerpo (círculo de `radius`) estar en `p`? Dentro del mundo y fuera de los obstáculos
 * inflados. No garantiza conexión con el resto del mapa; para eso están los spawns y la alcanzabilidad.
 */
export function isSafePoint(zone: MapZone, p: Point, radius: number): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  if (p.x < radius || p.y < radius || p.x > zone.width - radius || p.y > zone.height - radius) return false;
  return !zone.obstacles.some((o) =>
    o.type === "rect"
      ? p.x > o.x - radius && p.x < o.x + o.width + radius && p.y > o.y - radius && p.y < o.y + o.height + radius
      : Math.hypot(p.x - o.x, p.y - o.y) < o.radius + radius,
  );
}
