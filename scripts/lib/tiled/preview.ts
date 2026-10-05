import { PNG } from "pngjs";

export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated?: boolean;
  trimmed?: boolean;
  spriteSourceSize?: { x: number; y: number; w: number; h: number };
  sourceSize?: { w: number; h: number };
}

export class PreviewError extends Error {}

/**
 * Reconstruye el lienzo lógico de un fotograma (`sourceSize`): copia la región `frame` de la hoja en la posición
 * `spriteSourceSize` y deja transparente el recorte. Las hojas del proyecto no están rotadas; un fotograma rotado se
 * rechaza con un error explícito en lugar de dibujarse mal.
 */
export function renderFrame(sheet: PNG, atlasFrame: AtlasFrame, name = "fotograma"): PNG {
  if (atlasFrame.rotated) throw new PreviewError(`${name}: el fotograma está rotado (rotated: true) y la integración de Tiled no lo soporta`);
  const { x, y, w, h } = atlasFrame.frame;
  if (![x, y, w, h].every(Number.isInteger) || w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > sheet.width || y + h > sheet.height) {
    throw new PreviewError(`${name}: la región (${x}, ${y}, ${w}×${h}) queda fuera de la hoja de ${sheet.width}×${sheet.height}`);
  }
  const sourceW = atlasFrame.sourceSize?.w ?? w;
  const sourceH = atlasFrame.sourceSize?.h ?? h;
  const at = atlasFrame.spriteSourceSize ?? { x: 0, y: 0, w, h };
  if (at.w !== w || at.h !== h) throw new PreviewError(`${name}: spriteSourceSize (${at.w}×${at.h}) no coincide con la región (${w}×${h})`);
  if (at.x < 0 || at.y < 0 || at.x + w > sourceW || at.y + h > sourceH) throw new PreviewError(`${name}: el recorte no cabe en el lienzo lógico de ${sourceW}×${sourceH}`);

  const out = new PNG({ width: sourceW, height: sourceH });
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * sheet.width + x) * 4;
    const to = ((at.y + row) * sourceW + at.x) * 4;
    sheet.data.copy(out.data, to, from, from + w * 4);
  }
  return out;
}

/**
 * Reduce (o amplía) una imagen promediando el área que cubre cada píxel destino, con alfa premultiplicado para que los
 * bordes transparentes no manchen el color. Es la mejor opción para un preview que el editor vuelve a escalar.
 */
export function resizeArea(src: PNG, width: number, height: number): PNG {
  const dw = Math.max(1, Math.round(width));
  const dh = Math.max(1, Math.round(height));
  if (dw === src.width && dh === src.height) return src;
  const out = new PNG({ width: dw, height: dh });
  const sx = src.width / dw;
  const sy = src.height / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < dw; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      let r = 0, g = 0, b = 0, a = 0, weight = 0;
      for (let py = Math.floor(y0); py < Math.min(src.height, Math.ceil(y1)); py++) {
        const wy = Math.min(py + 1, y1) - Math.max(py, y0);
        for (let px = Math.floor(x0); px < Math.min(src.width, Math.ceil(x1)); px++) {
          const w = wy * (Math.min(px + 1, x1) - Math.max(px, x0));
          const i = (py * src.width + px) * 4;
          const alpha = src.data[i + 3] / 255;
          r += src.data[i] * alpha * w;
          g += src.data[i + 1] * alpha * w;
          b += src.data[i + 2] * alpha * w;
          a += alpha * w;
          weight += w;
        }
      }
      const o = (y * dw + x) * 4;
      if (a > 0 && weight > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
        out.data[o + 3] = Math.round((a / weight) * 255);
      }
    }
  }
  return out;
}
