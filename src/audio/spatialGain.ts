import type { MapSound, Point } from "../config/types";

/**
 * Ganancia espacial de un sonido del mapa (SPEC 6.5). Una sola implementación, la misma en el juego y en el laboratorio de sonidos, y
 * en píxeles del mundo: no depende de la cámara ni del tamaño de la pantalla.
 */

/** Un emisor puntual: volumen completo hasta `innerRadius`, silencio desde `radius` y una caída suave (cuadrática) entre ambos. */
export function pointGain(d: number, innerRadius: number, radius: number): number {
  if (d <= innerRadius) return 1;
  if (d >= radius) return 0;
  const t = (d - innerRadius) / (radius - innerRadius);
  return (1 - t) ** 2;
}

/** Distancia desde un punto al rectángulo más cercano (0 si está dentro o en el borde). */
export function distanceToRect(p: Point, r: { x: number; y: number; width: number; height: number }): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

/** Un área: volumen completo dentro; fuera, la misma caída hasta llegar a 0 a `edgeFadePx` del borde (con 0, fuera es silencio). */
export function areaGain(d: number, edgeFadePx: number): number {
  if (d <= 0) return 1;
  if (edgeFadePx <= 0 || d >= edgeFadePx) return 0;
  return (1 - d / edgeFadePx) ** 2;
}

export interface SpatialReading {
  /** Distancia al centro del punto o al borde del área (0 dentro del área). */
  distance: number;
  /** 0..1 */
  gain: number;
}

/** Distancia y ganancia de un sonido para un oyente (los pies de Vanessa o el oyente virtual del laboratorio). */
export function spatialReading(sound: MapSound, listener: Point): SpatialReading {
  if (sound.shape === "point") {
    const distance = Math.hypot(listener.x - sound.position.x, listener.y - sound.position.y);
    return { distance, gain: pointGain(distance, sound.innerRadius, sound.radius) };
  }
  const distance = distanceToRect(listener, sound.area);
  return { distance, gain: areaGain(distance, sound.edgeFadePx) };
}

/** Hasta dónde se oye el sonido: el radio exterior del punto o el borde del área más su caída. */
export function audibleExtent(sound: MapSound): number {
  return sound.shape === "point" ? sound.radius : sound.edgeFadePx;
}
