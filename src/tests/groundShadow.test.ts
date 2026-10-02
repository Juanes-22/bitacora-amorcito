import { describe, expect, it } from "vitest";
import { footprints } from "../game/systems/GroundShadow";

/** Un lienzo RGBA transparente de w × h con rectángulos opacos [x, y, ancho, alto]. */
function canvas(w: number, h: number, rects: Array<[number, number, number, number]>): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (const [rx, ry, rw, rh] of rects) {
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) px[(y * w + x) * 4 + 3] = 255;
  }
  return px;
}

describe("footprints: dónde apoya un fotograma", () => {
  it("un fotograma vacío no apoya en ninguna parte", () => {
    expect(footprints(canvas(20, 20, []), 20, 20)).toEqual([]);
  });

  it("una sola figura da una pisada con su ancho y su fila más baja", () => {
    // Cuerpo de 10 × 30 y zapatos de 14 × 3 abajo
    const r = footprints(canvas(40, 40, [[15, 2, 10, 30], [13, 32, 14, 3]]), 40, 40);
    expect(r).toEqual([{ x0: 13, x1: 26, bottom: 34 }]);
  });

  it("Vanessa y Jerry, separados por un hueco, dan dos pisadas de izquierda a derecha, cada una con su suelo", () => {
    const r = footprints(canvas(80, 60, [[8, 5, 20, 50], [6, 52, 24, 4], [50, 30, 14, 25], [50, 52, 14, 2]]), 80, 60);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ x0: 6, x1: 29, bottom: 55 });
    expect(r[1]).toMatchObject({ x0: 50, x1: 63, bottom: 54 });
  });

  it("un pie en el aire (fuera de la franja baja) no cuenta y los mechones estrechos se ignoran", () => {
    // Vanessa apoya con un pie; el otro cuelga más arriba. Un mechón de 1 px baja al lado.
    const r = footprints(canvas(60, 60, [[10, 0, 20, 40], [12, 40, 6, 14], [24, 40, 6, 6], [45, 0, 1, 56]]), 60, 60);
    expect(r).toHaveLength(1);
    expect(r[0].x0).toBe(12);
    expect(r[0].bottom).toBe(53);
  });

  it("los huecos pequeños dentro de una misma figura se unen", () => {
    const r = footprints(canvas(60, 40, [[5, 0, 30, 30], [5, 30, 12, 5], [18, 30, 17, 5]]), 60, 40);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ x0: 5, x1: 34 });
  });
});
