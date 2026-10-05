import { PNG } from "pngjs";

/** El módulo `sharp` (se carga aparte para poder publicar sin él si no se puede instalar). */
export type Sharp = (input: Buffer) => { png(options: Record<string, unknown>): { toBuffer(): Promise<Buffer> } };

/** `lossless`: mismos píxeles, solo recompresión (ahorra poco: estos PNG ya vienen bien comprimidos). `light`: paleta de 256 colores (≈ −65 %). */
export type Mode = "lossless" | "light";

/** Por debajo de esta relación señal/ruido (dB) un archivo «ligero» se descarta y se publica el original. */
export const MIN_PSNR = 24;

/**
 * Compara dos PNG: `identical` si tienen exactamente los mismos píxeles y `psnr` (dB) sobre los píxeles visibles. El color de un
 * píxel totalmente transparente no se dibuja, y cada codificador puede escribir ahí lo que quiera: no cuenta.
 */
export function compare(a: Buffer, b: Buffer): { identical: boolean; psnr: number } {
  const x = PNG.sync.read(a);
  const y = PNG.sync.read(b);
  if (x.width !== y.width || x.height !== y.height) return { identical: false, psnr: 0 };
  let squares = 0;
  let count = 0;
  let identical = true;
  for (let i = 0; i < x.data.length; i += 4) {
    const visible = x.data[i + 3] !== 0 || y.data[i + 3] !== 0;
    if (x.data[i + 3] !== y.data[i + 3]) identical = false;
    if (!visible) continue;
    for (let c = 0; c < 4; c++) {
      const d = x.data[i + c] - y.data[i + c];
      if (d !== 0) identical = false;
      squares += d * d;
      count++;
    }
  }
  const mse = count ? squares / count : 0;
  return { identical, psnr: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse) };
}

/** ¿Tienen estas dos imágenes los mismos píxeles visibles? */
export const samePixels = (a: Buffer, b: Buffer): boolean => compare(a, b).identical;

/**
 * Recomprime un PNG. En `lossless` solo se acepta si los píxeles son idénticos; en `light` (paleta de 256 colores con difuminado,
 * pensada para arte de píxeles) si la calidad no baja de `MIN_PSNR`. Devuelve el nuevo contenido solo si pesa al menos un 2 % menos;
 * si no, `null` y el original se queda como está. Ojo: en `sharp`, `effort`, `quality` o `colours` activan la paleta (con pérdida),
 * por eso el modo sin pérdida no los pasa.
 */
export async function optimizePng(sharp: Sharp, original: Buffer, mode: Mode = "lossless"): Promise<Buffer | null> {
  const options = mode === "light" ? { palette: true, colours: 256, quality: 100, effort: 10, dither: 1 } : { compressionLevel: 9, adaptiveFiltering: true };
  const out = await sharp(original).png(options).toBuffer();
  if (out.length > original.length * 0.98) return null;
  const result = compare(original, out);
  return (mode === "lossless" ? result.identical : result.psnr >= MIN_PSNR) ? out : null;
}
