// E2E de «Guardar en el proyecto» del laboratorio de sonidos (SPEC 6.5), sobre una COPIA temporal del proyecto: se guarda un emisor, un
// conflicto con una edición hecha fuera, un archivo nuevo que entra al catálogo y un preset. Se comprueba lo que queda en disco (mapas
// de Tiled, maps.json, bitacora.json, assets.json) y que cada guardado recarga la página una sola vez. No toca el repositorio.
// Uso: node scripts/e2e/audio-lab-save.mjs
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { harness } from "./helpers.mjs";
import { writeTestFiles } from "./wav.mjs";
import { makeWorkspace } from "./workspace.mjs";

const { wav: WAV, fake: FAKE, dir: TMP } = writeTestFiles();
const ws = makeWorkspace();
const at = (f) => join(ws.root, f);
const read = (f) => readFileSync(at(f), "utf8");
const json = (f) => JSON.parse(read(f));
const sha = (f) => createHash("sha256").update(readFileSync(at(f))).digest("hex");
const tmjSound = (zoneFile, soundId) => {
  const map = JSON.parse(readFileSync(at(`tools/tiled/maps/${zoneFile}.tmj`), "utf8"));
  const layer = map.layers.find((l) => l.name === "sonidos");
  const obj = layer.objects.find((o) => o.properties?.some((p) => p.name === "soundId" && p.value === soundId));
  return Object.fromEntries(obj.properties.map((p) => [p.name, p.value]));
};
const lines = (a, b) => { const x = a.split("\n"), y = b.split("\n"); return Math.max(x.length, y.length) - x.filter((l, i) => l === y[i]).length; };

const h = await harness({ root: ws.root });
const { check } = h;
const panel = (page) => page.locator("[data-testid=audio-lab]");
const toggle = (page) => page.getByRole("button", { name: /^Sonidos/ });
const orig = { bitacora: read("public/config/bitacora.json"), assets: read("public/assets/assets.json"), maps: read("public/config/maps.json"), zonaB: read("tools/tiled/maps/zona-b.tmj") };

/** Abre la página con el laboratorio (el panel recuerda que estaba abierto tras recargar) y devuelve el contador de cargas. */
async function session(t) {
  const loads = { n: 0 };
  t.page.on("load", () => loads.n++);
  return loads;
}

try {
  const t = await h.open({ query: "?audioLab=1" });
  const loads = await session(t);
  await t.start();
  await toggle(t.page).click();
  await panel(t.page).waitFor();
  await t.page.waitForTimeout(600);
  await panel(t.page).locator(".lab-emitter", { hasText: "rio-pradera" }).click();
  const loadsBefore = loads.n;

  // ---- 1. Guardar un emisor: Tiled, maps.json, y nada más ------------------------------------------------------
  await panel(t.page).getByLabel("Volumen", { exact: true }).fill("0.4");
  await panel(t.page).getByLabel("Velocidad", { exact: true }).fill("1.25");
  const reloaded = t.page.waitForEvent("load", { timeout: 15000 }).then(() => true, () => false);
  await panel(t.page).getByRole("button", { name: "Guardar en el proyecto" }).first().click();
  const didReload = await reloaded;
  await t.page.waitForTimeout(1500);
  const maps1 = json("public/config/maps.json");
  const tmj1 = tmjSound("zona-a", "rio-pradera");
  check("SAVE-1: el emisor guardado queda en maps.json con sus valores", maps1.maps["zona-a"].sounds["rio-pradera"].volume === 0.4 && maps1.maps["zona-a"].sounds["rio-pradera"].rate === 1.25, JSON.stringify(maps1.maps["zona-a"].sounds["rio-pradera"]));
  check("SAVE-2: y en el objeto de Tiled (el .tmj es la fuente), con el mismo volumen y velocidad", tmj1.volume === 0.4 && tmj1.rate === 1.25, JSON.stringify(tmj1));
  check("SAVE-3: bitacora.json queda byte a byte igual (un emisor solo toca el mapa), y también assets.json y la otra zona", read("public/config/bitacora.json") === orig.bitacora && read("public/assets/assets.json") === orig.assets && read("tools/tiled/maps/zona-b.tmj") === orig.zonaB);
  check("SAVE-4: la página se recarga una sola vez tras guardar", didReload && loads.n === loadsBefore + 1, JSON.stringify({ didReload, loads: loads.n, loadsBefore }));
  check("SAVE-5: tras recargar el laboratorio sigue abierto con el emisor elegido y su valor guardado, sin borradores", (await panel(t.page).count()) === 1 && (await panel(t.page).getByLabel("Volumen", { exact: true }).inputValue()) === "0.4" && !/\d/.test((await toggle(t.page).innerText()).replace("Sonidos", "")));
  check("SAVE-6: `tiled:check` no encuentra diferencias entre Tiled y maps.json", (() => { try { execFileSync("npx", ["tsx", "scripts/import-tiled.ts", "--check"], { cwd: ws.root, stdio: "pipe", timeout: 120000 }); return true; } catch (e) { console.error(String(e.stdout) + String(e.stderr)); return false; } })());

  // ---- 2. Conflicto: se editó el mapa fuera del laboratorio (p. ej. en Tiled) mientras estaba abierto -------------------
  const tmjPath = at("tools/tiled/maps/zona-a.tmj");
  const external = readFileSync(tmjPath, "utf8").replace(/"value":0\.4(?!\d)/, '"value":0.45');
  writeFileSync(tmjPath, external);
  const mapsAfterOne = read("public/config/maps.json");
  await panel(t.page).getByLabel("Volumen", { exact: true }).fill("0.35");
  await panel(t.page).getByRole("button", { name: "Guardar en el proyecto" }).first().click();
  await panel(t.page).locator(".lab-save--error").waitFor({ timeout: 8000 });
  const conflict = await panel(t.page).locator(".lab-save").innerText();
  check("SAVE-7: si el mapa cambió en el disco, el guardado avisa del conflicto con el archivo y no escribe nada", /cambió en el disco/.test(conflict) && readFileSync(tmjPath, "utf8") === external && read("public/config/maps.json") === mapsAfterOne, conflict);
  check("SAVE-8: el borrador del usuario se conserva tras el conflicto", (await panel(t.page).getByLabel("Volumen", { exact: true }).inputValue()) === "0.35");
  // Se recarga para ver lo del disco y se vuelve a aplicar el ajuste
  await t.page.reload();
  await panel(t.page).waitFor();
  await t.page.waitForTimeout(800);

  // ---- 3. Un archivo nuevo entra al catálogo -------------------------------------------------------------------------
  await t.start();
  await panel(t.page).getByRole("tab", { name: "Archivo de prueba" }).click();
  await panel(t.page).locator("#lab-file-input").setInputFiles(WAV);
  await panel(t.page).locator(".lab-filelist li").first().waitFor();
  await panel(t.page).locator(".lab-filelist li").first().getByRole("button", { name: "Usar en lo seleccionado" }).click();
  await panel(t.page).getByRole("tab", { name: "Mapa" }).click();
  const reloaded2 = t.page.waitForEvent("load", { timeout: 15000 }).then(() => true, () => false);
  await panel(t.page).getByRole("button", { name: "Guardar en el proyecto" }).first().click();
  const didReload2 = await reloaded2;
  await t.page.waitForTimeout(1500);
  const manifest = json("public/assets/assets.json");
  const entry = manifest.assets["audio.sfx.tono-nuevo"];
  check("SAVE-9: el archivo nuevo se copia a public/assets/audio/sfx con el nombre del archivo", existsSync(at("public/assets/audio/sfx/tono-nuevo.wav")) && sha("public/assets/audio/sfx/tono-nuevo.wav") === createHash("sha256").update(readFileSync(WAV)).digest("hex"));
  check("SAVE-10: y se registra en assets.json con kind «sfx», tamaño, sha256 y duración reales", !!entry && entry.kind === "sfx" && entry.type === "audio" && entry.category === "audio" && entry.format === "wav" && entry.sizeBytes === readFileSync(WAV).length && entry.sha256 === createHash("sha256").update(readFileSync(WAV)).digest("hex") && Math.abs(entry.durationSeconds - 0.4) < 0.02, JSON.stringify(entry));
  check("SAVE-11: assets.json añade UNA entrada y conserva el texto del resto (assetCount coherente)", manifest.assetCount === Object.keys(manifest.assets).length && Object.keys(manifest.assets).length === Object.keys(JSON.parse(orig.assets).assets).length + 1);
  check("SAVE-12: el emisor y el objeto de Tiled usan el recurso nuevo", json("public/config/maps.json").maps["zona-a"].sounds["rio-pradera"].assetId === "audio.sfx.tono-nuevo" && tmjSound("zona-a", "rio-pradera").assetId === "audio.sfx.tono-nuevo");
  check("SAVE-13: el guardado con archivo nuevo recarga una vez y `tiled:check` sigue en paz", didReload2 && (() => { try { execFileSync("npx", ["tsx", "scripts/import-tiled.ts", "--check"], { cwd: ws.root, stdio: "pipe", timeout: 120000 }); return true; } catch { return false; } })());
  check("SAVE-14: tras el conflicto y la recarga, el borrador del usuario (0.35) se conserva y, ya con el disco al día, se guarda sobre la edición externa (0.45)", tmjSound("zona-a", "rio-pradera").volume === 0.35, JSON.stringify(tmjSound("zona-a", "rio-pradera")));

  // ---- 4. Un preset solo toca la región audio.sfx de bitacora.json ------------------------------------------------------
  const cfgBefore = read("public/config/bitacora.json");
  const mapsBefore = read("public/config/maps.json");
  await panel(t.page).getByRole("tab", { name: "Presets" }).click();
  const region = panel(t.page).getByRole("region", { name: /Efecto: Ganar una insignia/ });
  await region.getByLabel("Volumen", { exact: true }).fill("0.3");
  const reloaded3 = t.page.waitForEvent("load", { timeout: 15000 }).then(() => true, () => false);
  await region.getByRole("button", { name: "Guardar en el proyecto" }).click();
  const didReload3 = await reloaded3;
  await t.page.waitForTimeout(1500);
  const cfgAfter = read("public/config/bitacora.json");
  check("SAVE-15: guardar un preset cambia solo el volumen de «badge.earned» en bitacora.json (una línea) y no toca maps.json ni Tiled", json("public/config/bitacora.json").audio.sfx.events["badge.earned"].volume === 0.3 && lines(cfgBefore, cfgAfter) === 1 && read("public/config/maps.json") === mapsBefore, `líneas distintas: ${lines(cfgBefore, cfgAfter)}`);
  check("SAVE-16: el resto de bitacora.json (rutas, textos, insignias) no cambió", JSON.stringify({ ...json("public/config/bitacora.json"), audio: null }) === JSON.stringify({ ...JSON.parse(cfgBefore), audio: null }));
  check("SAVE-17: recarga una vez", didReload3);
  // El conflicto de SAVE-7 es una respuesta 409 buscada: el navegador la anota como error de recurso; cualquier otro error sí cuenta.
  const unexpected = t.errors.filter((e) => !/status of 409/.test(e));
  check("SAVE-18: sin más errores en la consola que el 409 buscado del conflicto", unexpected.length === 0 && t.errors.length <= 1, t.errors.join(" | "));
  await t.close();
} catch (e) {
  console.error(`✖ la prueba falló con una excepción: ${e.stack ?? e}`);
  process.exitCode = 1;
} finally {
  await h.finish();
  ws.cleanup();
}
