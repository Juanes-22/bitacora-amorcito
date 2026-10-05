/**
 * ¿Se pidió el laboratorio de sonidos? Solo existe en desarrollo (`npm run dev`) y con `?audioLab=1`. En la compilación de
 * producción `import.meta.env.DEV` vale `false` y el compilador elimina el laboratorio y esta comprobación: no hay botón, ni
 * código, ni rutas de guardado en `dist`.
 */
export function audioLabRequested(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return new URLSearchParams(window.location.search).get("audioLab") === "1";
  } catch {
    return false;
  }
}
