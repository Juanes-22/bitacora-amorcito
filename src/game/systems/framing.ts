export interface Size {
  width: number;
  height: number;
}

export interface CameraSettings {
  /** Zoom base (mínimo). */
  baseZoom: number;
  fit: "cover" | "fixed";
  maxZoom: number;
  /** Altura visible del personaje a zoom 1 (px del mundo). Con `minPlayerHeight` fija un suelo de zoom. */
  playerHeight?: number;
  /** Fracción mínima de la altura del canvas que debe ocupar el personaje (SPEC 6.3, AC-38). */
  minPlayerHeight?: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Zoom efectivo (SPEC 6.3). Con `cover` es el mayor entre el zoom base y el necesario para que el mundo cubra
 * todo el canvas, acotado por `maxZoom`; con `fixed`, el zoom base. Se redondea hacia arriba a centésimas para
 * que un error de coma flotante nunca deje una franja de un píxel sin cubrir.
 */
export function effectiveZoom(view: Size, world: Size, { baseZoom, fit, maxZoom, playerHeight, minPlayerHeight }: CameraSettings): number {
  if (fit === "fixed") return baseZoom;
  const cover = Math.max(view.width / world.width, view.height / world.height);
  // En ventanas altas (tabletas verticales) cubrir el mundo no basta para que el personaje se vea grande.
  const forPlayer = playerHeight && minPlayerHeight ? (minPlayerHeight * view.height) / playerHeight : 0;
  const zoom = Math.ceil(Math.max(baseZoom, cover, forPlayer) * 100) / 100;
  return Math.min(Math.max(zoom, baseZoom), Math.max(maxZoom, baseZoom));
}

/**
 * Límites de la cámara. Si la vista (en unidades del mundo) es mayor que el mundo en un eje, los límites se
 * ensanchan simétricamente para que el mundo quede CENTRADO en lugar de anclado a la esquina superior izquierda.
 */
export function cameraBounds(view: Size, zoom: number, world: Size): Bounds {
  const visibleW = view.width / zoom;
  const visibleH = view.height / zoom;
  const x = visibleW > world.width ? -(visibleW - world.width) / 2 : 0;
  const y = visibleH > world.height ? -(visibleH - world.height) / 2 : 0;
  return { x, y, width: Math.max(world.width, visibleW), height: Math.max(world.height, visibleH) };
}
