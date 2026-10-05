// Herramienta de colocación (no forma parte del build): vuelca por zona un PNG con las capas del mapa, las celdas
// transitables (azul), los efectos ya colocados (magenta), las estaciones/portales/puntos de aparición (amarillo) y una
// cuadrícula cada 100 px, para decidir dónde caben plantas nuevas. Uso: npx tsx scripts/tools/ambient-map.ts DIRECTORIO
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { reachableCells } from "../../src/config/reachability";
import { mergeConfig } from "../../src/config/mapsFile";
import type { AssetManifest, BitacoraConfig, BitacoraContent, MapsFile } from "../../src/config/types";

const out = process.argv[2];
if (!out) throw new Error("Indica el directorio de salida");
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync("public/assets/assets.json", "utf8")) as AssetManifest;
const config: BitacoraConfig = mergeConfig(
  JSON.parse(readFileSync("public/config/bitacora.json", "utf8")) as BitacoraContent,
  JSON.parse(readFileSync("public/config/maps.json", "utf8")) as MapsFile,
);

for (const [zoneId, zone] of Object.entries(config.maps)) {
  const canvas = new PNG({ width: zone.width, height: zone.height });
  for (let i = 0; i < canvas.data.length; i += 4) canvas.data.set([0, 0, 0, 255], i);
  const over = (src: PNG, x0: number, y0: number, opacity = 1) => {
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
      const X = x + x0, Y = y + y0;
      if (X < 0 || Y < 0 || X >= canvas.width || Y >= canvas.height) continue;
      const s = (y * src.width + x) * 4, d = (Y * canvas.width + X) * 4, a = (src.data[s + 3] / 255) * opacity;
      for (let c = 0; c < 3; c++) canvas.data[d + c] = Math.round(src.data[s + c] * a + canvas.data[d + c] * (1 - a));
    }
  };
  for (const layer of [...zone.layers].sort((a, b) => a.depth - b.depth)) over(PNG.sync.read(readFileSync(join("public/assets", manifest.assets[layer.assetId].path))), 0, 0);
  const { cols, rows, cell, reach } = reachableCells(config, zoneId);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    if (!reach[cy * cols + cx]) continue;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const d = ((cy * cell + y) * canvas.width + cx * cell + x) * 4;
      if (d + 3 < canvas.data.length) { canvas.data[d] = canvas.data[d] * 0.25; canvas.data[d + 1] = canvas.data[d + 1] * 0.25; canvas.data[d + 2] = Math.min(255, canvas.data[d + 2] * 0.25 + 190); }
    }
  }
  // Máscara en bruto (1 = transitable) a resolución del mundo, para herramientas de análisis.
  const raw = new PNG({ width: zone.width, height: zone.height });
  for (let y = 0; y < zone.height; y++) for (let x = 0; x < zone.width; x++) {
    const v = reach[Math.floor(y / cell) * cols + Math.floor(x / cell)] ? 255 : 0;
    raw.data.set([v, v, v, 255], (y * zone.width + x) * 4);
  }
  writeFileSync(join(out, `${zoneId}-transitable.png`), PNG.sync.write(raw));
  const dot = (x: number, y: number, rgb: [number, number, number], r = 4) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = Math.round(x) + dx, Y = Math.round(y) + dy;
      if (X < 0 || Y < 0 || X >= canvas.width || Y >= canvas.height || dx * dx + dy * dy > r * r) continue;
      canvas.data.set([...rgb, 255], (Y * canvas.width + X) * 4);
    }
  };
  for (const fx of zone.ambient) {
    if (fx.type === "swim") fx.path.forEach((p) => dot(p.x, p.y, [255, 0, 255], 3));
    else if (fx.type === "particles") dot(fx.area.x, fx.area.y, [255, 0, 255], 3);
    else dot(fx.position.x, fx.position.y, [255, 0, 255], 3);
  }
  for (const p of Object.values(config.placements)) if (p.zoneId === zoneId) dot(p.position.x, p.position.y, [255, 255, 0], 7);
  for (const p of Object.values(zone.portals)) dot(p.interaction.x, p.interaction.y, [0, 255, 255], 7);
  for (const p of Object.values(zone.spawns)) dot(p.x, p.y, [0, 255, 0], 7);
  for (let x = 0; x < zone.width; x += 100) for (let y = 0; y < zone.height; y++) canvas.data.set([255, 255, 255, 255], (y * canvas.width + x) * 4);
  for (let y = 0; y < zone.height; y += 100) for (let x = 0; x < zone.width; x++) canvas.data.set([255, 255, 255, 255], (y * canvas.width + x) * 4);
  writeFileSync(join(out, `${zoneId}-colocacion.png`), PNG.sync.write(canvas));
}
console.log(`mapas de colocación en ${out}`);
