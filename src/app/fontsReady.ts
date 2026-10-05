/**
 * Las tipografías de la bitácora (SPEC 14), tal como las declara `styles/fonts.css`. El texto que dibuja Phaser sobre el canvas se
 * pinta una sola vez: si la fuente aún no llegó, queda con la de reserva para siempre. Por eso la aplicación espera a estas descargas
 * (con un tope) antes de crear el mapa; el texto HTML, en cambio, se actualizaría solo.
 */
export const APP_FONTS = ['400 1em "Nunito"', '700 1em "Nunito"', '800 1em "Nunito"', '400 1em "Gelasio"', 'italic 400 1em "Gelasio"', '700 1em "Gelasio"'] as const;

/** Cuánto se espera, como máximo, a las fuentes: con una red lenta la bitácora abre igual, con la letra de reserva. */
export const FONTS_TIMEOUT_MS = 4000;

interface FontSet {
  load(font: string, text?: string): Promise<unknown>;
}

/**
 * Pide las fuentes y espera a que lleguen o se agote el tiempo. Nunca rechaza: una fuente que falla (sin red, archivo ausente) se
 * ignora y el texto usa la siguiente de la lista. Sin `document.fonts` (pruebas con jsdom, navegadores antiguos) resuelve al instante.
 */
export function fontsReady(fonts: FontSet | undefined = (globalThis as { document?: { fonts?: FontSet } }).document?.fonts, timeoutMs = FONTS_TIMEOUT_MS): Promise<void> {
  if (!fonts) return Promise.resolve();
  const loads = Promise.all(APP_FONTS.map((f) => fonts.load(f).catch(() => undefined))).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([loads, timeout]).catch(() => undefined);
}
