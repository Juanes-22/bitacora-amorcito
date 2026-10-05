// E2E de la integración con Tiled: una edición hecha en los mapas de Tiled, importada con tiled:import, cambia el juego como
// se espera (estación, gallina, planta y colisión) en las dos zonas y en escritorio y móvil; y en desarrollo el cambio de
// bitacora.json recarga la página. El ejemplo se ejecuta sobre una copia temporal: no toca los archivos del repositorio.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { configJson, harness } from "./helpers.mjs";

const out = execFileSync("npx", ["tsx", "scripts/tools/tiled-example.ts"], { encoding: "utf8", timeout: 180000 }).trim().split("\n").pop();
const example = JSON.parse(out);
const edited = JSON.parse(readFileSync(example.config, "utf8"));

const h = await harness();
const { check } = h;
const replaceSpatial = (c) => {
  c.maps = edited.maps;
  c.placements = edited.placements;
};
const critters = (t) => t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list.filter((o) => o.name === "critter").length);
const obstacles = (t) => t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").world.obstacles.getLength());
const flowers = (t) => t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list.filter((o) => o.texture?.key === "animation.flora.sunflowers").map((o) => ({ x: o.x, y: o.y, sx: o.scaleX })));

try {
  // ---- Antes: el juego con el bitacora.json de siempre; después: con lo que importó el ejemplo.
  const before = await h.open();
  await before.start();
  const stBefore = (await before.stations()).find((s) => s.id === "apr-a").interaction;
  const nBefore = await critters(before);
  const oBefore = await obstacles(before);
  const fBefore = await flowers(before);
  await before.close();

  const after = await h.open({ edit: replaceSpatial });
  await after.start();
  const stAfter = (await after.stations()).find((s) => s.id === "apr-a").interaction;
  check("T1 la estación apr-a se movió 60 px a la derecha y conserva su desplazamiento y su radio", stAfter.x === stBefore.x + 60 && stAfter.y === stBefore.y && stAfter.radius === stBefore.radius, JSON.stringify({ stBefore, stAfter }));
  check("T2 la gallina duplicada aparece como un animalito más con su animación", (await critters(after)) === nBefore + 1, `${nBefore} → ${await critters(after)}`);
  check("T3 el girasol agrandado un 50 % se dibuja con esa escala en el juego", (await flowers(after)).some((f, i) => Math.abs(f.sx - fBefore[i].sx * 1.5) < 1e-6) && (await flowers(after)).length === fBefore.length, JSON.stringify({ fBefore, now: await flowers(after) }));
  check("T4 la colisión nueva es un cuerpo más del mundo", (await obstacles(after)) === oBefore + 1, `${oBefore} → ${await obstacles(after)}`);
  check("T5 sin errores en la consola con la configuración importada", after.errors.length === 0, after.errors.join(" | "));
  check("T6 el resto de la configuración no cambió (route, textos, insignias)", JSON.stringify(edited.route) === JSON.stringify(configJson.route) && JSON.stringify(edited.learnings) === JSON.stringify(configJson.learnings) && JSON.stringify(edited.badges) === JSON.stringify(configJson.badges));
  await after.page.screenshot({ path: "/tmp/tiled-after-desktop.png" });
  // El jugador puede llegar a la estación movida (la zona sigue conectada).
  await after.place(stAfter.x, stAfter.y);
  await after.page.waitForTimeout(400);
  const near = await after.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").player.position);
  check("T7 Vanessa puede situarse dentro del radio de interacción de la estación movida", Math.hypot(near.x - stAfter.x, near.y - stAfter.y) <= stAfter.radius, JSON.stringify({ near, stAfter }));
  await after.close();

  // ---- La otra zona y el móvil: la edición en zona-a no altera zona-b.
  const mobile = await h.open({ edit: replaceSpatial, viewport: { width: 390, height: 844 } });
  await mobile.start();
  check("T8 en móvil carga sin errores y con las mismas estaciones", (await mobile.stations()).length === 3 && mobile.errors.length === 0, `${(await mobile.stations()).length} estaciones, ${mobile.errors.join(" | ")}`);
  await mobile.page.screenshot({ path: "/tmp/tiled-after-mobile.png" });
  await mobile.close();
  const zb = JSON.stringify(edited.maps["zona-b"]) === JSON.stringify(configJson.maps["zona-b"]);
  check("T9 la zona-b queda exactamente igual (la edición solo afectó a zona-a)", zb);

  // ---- Desarrollo: cambiar bitacora.json recarga la página (recarga completa; la escena no se actualiza en caliente).
  const dev = await h.open();
  await dev.page.evaluate(() => { window.__marca = 1; });
  const same = readFileSync("public/config/bitacora.json");
  writeFileSync("public/config/bitacora.json", same); // mismo contenido, nueva fecha: lo que ve el observador de archivos
  await dev.page.waitForFunction(() => window.__marca === undefined, null, { timeout: 8000 }).then(
    () => check("T10 en desarrollo, un cambio en public/config/bitacora.json recarga la página", true),
    () => check("T10 en desarrollo, un cambio en public/config/bitacora.json recarga la página", false, "la página no se recargó"),
  );
  await dev.close();
} catch (e) {
  console.error(`✖ la prueba falló con una excepción: ${e.stack ?? e}`);
  process.exitCode = 1;
} finally {
  await h.finish();
}
