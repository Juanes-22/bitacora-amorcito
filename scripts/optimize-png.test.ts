import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { compare, optimizePng, samePixels, type Sharp } from "./lib/optimizePng";

/** Una imagen con mucho espacio vacío y un degradado, codificada sin compresión útil (como los PNG poco optimizados). */
function sample(): Buffer {
  const png = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) png.data.set(x < 32 ? [x * 8, y * 4, 90, 255] : [0, 0, 0, 0], (y * 64 + x) * 4);
  return PNG.sync.write(png, { deflateLevel: 0, filterType: 0 });
}

const sharp = (await import("sharp").then((m) => m.default as unknown as Sharp).catch(() => undefined)) as Sharp | undefined;

describe("optimizePng (recompresión de lo publicado)", () => {
  it.skipIf(!sharp)("sin pérdida: reduce el peso y deja exactamente los mismos píxeles", async () => {
    const original = sample();
    const smaller = await optimizePng(sharp as Sharp, original, "lossless");
    expect(smaller).not.toBeNull();
    expect((smaller as Buffer).length).toBeLessThan(original.length * 0.5);
    expect(samePixels(original, smaller as Buffer)).toBe(true);
  });

  it.skipIf(!sharp)("sin pérdida nunca acepta un resultado con otros píxeles (la paleta de 256 colores cambiaría una imagen con más colores)", async () => {
    const colorful = new PNG({ width: 96, height: 96 });
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) colorful.data.set([(x * 5 + y * 3) % 256, (x * 2 + y * 7) % 256, (x + y * 4) % 256, 255], (y * 96 + x) * 4);
    const original = PNG.sync.write(colorful, { deflateLevel: 1 });
    const result = await optimizePng(sharp as Sharp, original, "lossless");
    if (result) expect(samePixels(original, result)).toBe(true);
  });

  it.skipIf(!sharp)("ligero: usa una paleta de 256 colores y conserva la calidad", async () => {
    const noise = new PNG({ width: 96, height: 96 });
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) noise.data.set([(x * 5 + y * 3) % 256, (x * 2 + y * 7) % 256, (x + y * 4) % 256, 255], (y * 96 + x) * 4);
    const original = PNG.sync.write(noise, { deflateLevel: 1 });
    const light = await optimizePng(sharp as Sharp, original, "light");
    expect(light).not.toBeNull();
    expect((light as Buffer).length).toBeLessThan(original.length * 0.7);
    const result = compare(original, light as Buffer);
    expect(result.identical).toBe(false);
    expect(result.psnr).toBeGreaterThan(24);
  });

  it("compare detecta un píxel distinto, pero no el color de un píxel transparente", () => {
    const a = PNG.sync.read(sample());
    const b = PNG.sync.read(sample());
    const at = (x: number, y: number) => (y * 64 + x) * 4;
    b.data[at(40, 5)] = 200; // color de un píxel transparente: no se ve
    expect(samePixels(PNG.sync.write(a), PNG.sync.write(b))).toBe(true);
    b.data[at(10, 5)] += 1; // color de un píxel visible
    expect(compare(PNG.sync.write(a), PNG.sync.write(b)).identical).toBe(false);
    expect(compare(PNG.sync.write(a), PNG.sync.write(b)).psnr).toBeGreaterThan(50);
    const c = PNG.sync.read(sample());
    c.data[at(40, 5) + 3] = 255; // el alfa cambia
    expect(samePixels(PNG.sync.write(a), PNG.sync.write(c))).toBe(false);
  });

  it("no sustituye el archivo si no gana al menos un 2 %", async () => {
    const fake: Sharp = () => ({ png: () => ({ toBuffer: async () => Buffer.alloc(sample().length) }) });
    expect(await optimizePng(fake, sample())).toBeNull();
  });
});
