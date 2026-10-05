// Capturas de revisión de las gallinas: un recorte por cada una (y por la familia) de la configuración. Herramienta manual.
// Uso: node scripts/tools/critter-shots.mjs DIRECTORIO
import { mkdirSync } from "node:fs";
import { configJson, harness } from "../e2e/helpers.mjs";

const out = process.argv[2];
if (!out) throw new Error("Indica el directorio de salida");
mkdirSync(out, { recursive: true });
const { open } = await harness();
const KEY = `bitacora:progress:v3:${configJson.contentSetId}:${configJson.mode}`;
const state = (zone, pos) => ({ [KEY]: JSON.stringify({ schemaVersion: 3, contentSetId: configJson.contentSetId, mode: configJson.mode, currentZoneId: zone, player: pos, checkpoints: {}, entries: {} }) });
for (const [zone, m] of Object.entries(configJson.maps)) {
  const t = await open({ seed: state(zone, m.spawns[m.initialSpawnId]), viewport: { width: 1280, height: 720 } });
  await t.start();
  await t.page.addStyleTag({ content: ".hud, .nearby-region { display: none !important; }" });
  await t.page.waitForTimeout(1500);
  for (const [i, k] of (m.critters ?? []).entries()) {
    await t.place(k.position.x, k.position.y);
    await t.page.evaluate(() => { const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); s.player.sprite.setVisible(false); });
    await t.page.waitForTimeout(700);
    const c = await t.page.evaluate(({ x, y }) => { const cam = window.__PHASER_GAME__.scene.getScene("ExplorationScene").cameras.main; return { sx: (x - cam.worldView.x) * cam.zoom, sy: (y - cam.worldView.y) * cam.zoom }; }, k.position);
    const x0 = Math.max(0, Math.min(1280 - 260, c.sx - 130));
    const y0 = Math.max(0, Math.min(720 - 180, c.sy - 110));
    await t.page.screenshot({ path: `${out}/${zone}-${i}.png`, clip: { x: x0, y: y0, width: 260, height: 180 } });
  }
  await t.close();
}
process.exit(0);
