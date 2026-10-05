/** La lista de reserva si la variable CSS no se puede leer (pruebas sin hojas de estilo). Debe coincidir con `--font-ui` de `styles/tokens.css`. */
const FALLBACK = '"Nunito", "Trebuchet MS", system-ui, sans-serif';

/**
 * La tipografía de la interfaz para el texto que dibuja Phaser sobre el canvas (números, títulos y etiquetas de los letreros y los
 * portales): se lee de `--font-ui`, así que el mapa y el HTML usan SIEMPRE la misma y se cambia en un solo sitio. Se lee al dibujar, no
 * al importar el módulo, para que las hojas de estilo ya estén aplicadas.
 */
export function uiFont(): string {
  if (typeof document === "undefined") return FALLBACK;
  const value = getComputedStyle(document.documentElement).getPropertyValue("--font-ui").trim();
  return value || FALLBACK;
}
