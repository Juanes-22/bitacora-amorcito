import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import type { AssetManifest, BitacoraConfig } from "../src/config/types";

// AC-45: las ondas quedan dentro del agua y la espuma y las cascadas nacen en ella. «Agua» es el azul saturado del
// terreno que ninguna capa de profundidad intermedia tapa. Es una auditoría estática del maps.json real.

const manifestPath = resolve("public/assets/assets.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AssetManifest;
const config = JSON.parse(readFileSync(resolve("public/config/maps.json"), "utf8")) as Pick<BitacoraConfig, "maps">;
const root = dirname(manifestPath);

const water = (terrainId: string) => {
  const png = PNG.sync.read(readFileSync(join(root, manifest.assets[terrainId].path)));
  const mask = new Uint8Array(png.width * png.height);
  for (let i = 0; i < mask.length; i++) {
    const [r, g, b, a] = [png.data[i * 4], png.data[i * 4 + 1], png.data[i * 4 + 2], png.data[i * 4 + 3]];
    mask[i] = a > 128 && b > r + 50 && b > g - 10 ? 1 : 0;
  }
  return { width: png.width, height: png.height, at: (x: number, y: number) => x >= 0 && y >= 0 && x < png.width && y < png.height && mask[Math.floor(y) * png.width + Math.floor(x)] === 1 };
};

describe("AC-45: ondas, espuma y cascadas en el agua (bitacora.json real)", () => {
  for (const [zoneId, zone] of Object.entries(config.maps)) {
    const terrain = zone.layers.map((l) => l.assetId).find((id) => manifest.assets[id].layer === "terrain");
    it(`${zoneId}: tiene capa de terreno`, () => expect(terrain).toBeDefined());
    if (!terrain) continue;
    const mask = water(terrain);
    zone.ambient.forEach((fx, i) => {
      if (fx.type === "swim") {
        it(`${zoneId}.ambient[${i}] ${fx.assetId}: toda su trayectoria nada por agua (AC-49)`, () => {
          const dry: string[] = [];
          for (let k = 0; k + 1 < fx.path.length; k++) {
            const a = fx.path[k], b = fx.path[k + 1];
            const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
            for (let t = 0; t <= steps; t++) {
              const x = a.x + ((b.x - a.x) * t) / steps, y = a.y + ((b.y - a.y) * t) / steps;
              if (!mask.at(x, y)) dry.push(`(${Math.round(x)}, ${Math.round(y)})`);
            }
          }
          expect(dry).toEqual([]);
        });
        return;
      }
      if (fx.type !== "animation" || !fx.assetId.startsWith("animation.water.")) return;
      const entry = manifest.assets[fx.assetId];
      const s = (entry.recommendedScale ?? 1) * (fx.scale ?? 1);
      const label = `${zoneId}.ambient[${i}] ${fx.assetId} en (${fx.position.x}, ${fx.position.y})`;

      if (fx.assetId === "animation.water.ripples") {
        it(`${label}: al menos el 75 % de su caja cae sobre agua`, () => {
          const b = entry.contentBounds!, size = entry.sourceFrameSize!;
          const x0 = fx.position.x + (b.x - entry.origin!.x * size.width) * s, y0 = fx.position.y + (b.y - entry.origin!.y * size.height) * s;
          let hit = 0, total = 0;
          for (let y = y0; y < y0 + b.height * s; y++) for (let x = x0; x < x0 + b.width * s; x++) { total++; if (mask.at(x, y)) hit++; }
          expect(hit / total).toBeGreaterThanOrEqual(0.75);
        });
      } else {
        it(`${label}: su base está a ≤ 16 px del agua`, () => {
          let near = false;
          for (let dy = -16; dy <= 16 && !near; dy++) for (let dx = -16; dx <= 16 && !near; dx++) near = mask.at(fx.position.x + dx, fx.position.y + dy);
          expect(near).toBe(true);
        });
      }
    });
  }

  it("cada zona tiene animaciones de agua y al menos un pato", () => {
    for (const zone of Object.values(config.maps)) {
      expect(zone.ambient.filter((f) => f.type === "animation" && f.assetId.startsWith("animation.water.")).length).toBeGreaterThan(0);
      expect(zone.ambient.filter((f) => f.type === "swim").length).toBeGreaterThan(0);
    }
  });
});
