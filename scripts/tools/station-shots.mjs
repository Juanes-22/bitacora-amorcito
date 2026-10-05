// Capturas de revisión de cada estación y su entorno (para comprobar que apoyan en pasto). Herramienta manual.
// Uso: node scripts/tools/station-shots.mjs DIRECTORIO [ANCHOxALTO]
import { mkdirSync } from "node:fs";
import { configJson, harness } from "../e2e/helpers.mjs";

const out = process.argv[2];
if (!out) throw new Error("Indica el directorio de salida");
mkdirSync(out, { recursive: true });
const [w, h] = (process.argv[3] ?? "1280x720").split("x").map(Number);
const { open } = await harness();
const KEY = `bitacora:progress:v3:${configJson.contentSetId}:${configJson.mode}`;
const state = (zone, pos) => ({ [KEY]: JSON.stringify({ schemaVersion: 3, contentSetId: configJson.contentSetId, mode: configJson.mode, currentZoneId: zone, player: pos, checkpoints: {}, entries: Object.fromEntries(configJson.route.map((id) => [id, { contentRevision: 1, readSectionIds: [] }])) }) });
for (const id of configJson.route) {
  const p = configJson.placements[id];
  const zone = p.zoneId;
  const t = await open({ seed: state(zone, { x: p.position.x + 150, y: p.position.y + 90 }), viewport: { width: w, height: h } });
  await t.start();
  await t.page.addStyleTag({ content: ".hud, .nearby-region { display: none !important; }" });
  await t.page.waitForTimeout(900);
  const c = await t.page.evaluate(({ x, y }) => { const cam = window.__PHASER_GAME__.scene.getScene("ExplorationScene").cameras.main; return { sx: (x - cam.worldView.x) * cam.zoom, sy: (y - cam.worldView.y) * cam.zoom, z: cam.zoom }; }, p.position);
  const x0 = Math.max(0, c.sx - 260);
  const y0 = Math.max(0, c.sy - 260);
  await t.page.screenshot({ path: `${out}/${id}.png`, clip: { x: x0, y: y0, width: Math.min(520, w - x0), height: Math.min(340, h - y0) } });
  console.log(id, zone, JSON.stringify(c));
  await t.close();
}
process.exit(0);
