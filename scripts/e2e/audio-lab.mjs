// E2E del laboratorio de sonidos (SPEC 6.5), solo desarrollo: aparece únicamente con ?audioLab=1, congela el mapa en el modo «mapa»,
// prueba emisores y efectos con sus ajustes y la distancia del oyente, usa archivos de prueba locales, aplica ajustes a la sesión y los
// exporta. La parte de GUARDAR en el proyecto corre sobre una copia temporal del proyecto (scripts/e2e/workspace.mjs): no toca el repositorio.
// Los sonidos son tonos de prueba: aquí se comprueban voces, volúmenes y archivos, no cómo se oyen.
// Uso: node scripts/e2e/audio-lab.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { configJson, harness } from "./helpers.mjs";
import { writeTestFiles } from "./wav.mjs";

const { wav: WAV, fake: FAKE, dir: TMP } = writeTestFiles();
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const REPO_FILES = ["public/config/bitacora.json", "public/config/maps.json", "public/assets/assets.json", "tools/tiled/maps/zona-a.tmj", "tools/tiled/maps/zona-b.tmj"];
const repoHashes = () => Object.fromEntries(REPO_FILES.map((f) => [f, sha(f)]));

const panel = (page) => page.locator("[data-testid=audio-lab]");
const toggle = (page) => page.getByRole("button", { name: /^Sonidos/ });
const diag = (page) => page.evaluate(() => {
  const d = window.__BITACORA_SFX__.diagnostics();
  return { state: d.state, listener: d.listener, virtual: d.listenerVirtual, emitters: d.emitters, voices: d.voices.map((v) => ({ id: v.id, kind: v.kind, key: v.key, label: v.label, effective: v.effective, spatial: v.factors.spatial, base: v.factors.base })) };
});
const tests = (d) => d.voices.filter((v) => v.kind === "test");
const reasons = (page) => page.evaluate(() => window.__LAST_CONTROLS__ ?? null);
const watchControls = (page) => page.evaluate(() => { window.__BITACORA_BRIDGE__.on("app:controls", (p) => { window.__LAST_CONTROLS__ = p.reasons; }); });
const openLab = async (page) => {
  await toggle(page).click();
  await panel(page).waitFor();
  await page.waitForTimeout(500);
};
/** Hace clic sobre el mapa del laboratorio en un punto del MUNDO (convierte a píxeles de pantalla con la matriz del SVG). */
const clickWorld = async (page, x, y) => {
  const at = await page.evaluate(([x, y]) => {
    const svg = document.querySelector("svg.lab-map");
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    const p = pt.matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }, [x, y]);
  await page.mouse.click(at.x, at.y);
};
const pickEmitter = (page, id) => panel(page).locator(".lab-emitter", { hasText: id }).click();

const repoBefore = repoHashes();
/** El progreso y las preferencias del visitante en el almacenamiento (el laboratorio no debe tocarlos). */
const stateOf = async (t) => {
  const stored = await t.stored();
  return { progress: Object.fromEntries(Object.entries(stored).filter(([k]) => k.startsWith("bitacora:progress"))), prefs: stored["bitacora:preferences:v1"] ?? null };
};
const h = await harness();
const { check } = h;

try {
  // ---- Sin ?audioLab=1 no existe ----------------------------------------------------------------------------
  {
    const chunks = [];
    const t = await h.open();
    t.page.on("request", (r) => /audio-lab|AudioLab/.test(r.url()) && chunks.push(r.url()));
    await t.start();
    check("LAB-1: sin ?audioLab=1 no hay botón «Sonidos» ni panel", (await toggle(t.page).count()) === 0 && (await panel(t.page).count()) === 0);
    check("LAB-2: ni se descarga ningún código del laboratorio", chunks.length === 0, chunks.join(", "));
    await t.close();
  }

  // ---- Con ?audioLab=1: panel, modos, pruebas ----------------------------------------------------------------
  {
    const t = await h.open({ query: "?audioLab=1" });
    await watchControls(t.page);
    check("LAB-3: con ?audioLab=1 aparece el botón «Sonidos» (ya en la portada)", (await toggle(t.page).count()) === 1);
    await t.start();
    const stateBefore = await stateOf(t);
    await openLab(t.page);
    check("LAB-4: el botón queda expandido y el panel tiene las tres pestañas", (await toggle(t.page).getAttribute("aria-expanded")) === "true" && (await panel(t.page).getByRole("tab").allInnerTexts()).join("|") === "Mapa|Presets|Archivo de prueba");

    // Modo mapa: la escena queda congelada
    await t.page.waitForTimeout(300);
    const frozen = await reasons(t.page);
    const p0 = (await t.scene()).pos;
    const walk = await t.hold(["ArrowRight"], 400);
    check("LAB-5: en el modo mapa el laboratorio congela la escena y Vanessa no se mueve con las flechas", Array.isArray(frozen) && frozen.includes("audio-lab") && Math.abs(walk.m.pos.x - p0.x) < 1, JSON.stringify({ frozen, p0, m: walk.m.pos }));

    // Selección, prueba espacial y detener
    await pickEmitter(t.page, "rio-pradera");
    const listItem = panel(t.page).locator(".lab-emitter[aria-pressed=true]");
    check("LAB-6: elegir un emisor lo marca y muestra su editor", (await listItem.count()) === 1 && (await panel(t.page).getByRole("region", { name: /Ajustes de Río de la pradera/ }).count()) === 1);
    // El oyente virtual: junto al río (campo del mapa con flechas) — se coloca con el controlador del teclado
    const svg = panel(t.page).locator("svg.lab-map");
    await svg.focus();
    const startAt = await t.page.evaluate(() => window.__BITACORA_SFX__.diagnostics().listener);
    for (let i = 0; i < 3; i++) await t.page.keyboard.press("Shift+ArrowRight");
    await t.page.waitForTimeout(250);
    const moved = await t.page.evaluate(() => window.__BITACORA_SFX__.diagnostics().listener);
    check("LAB-7: las flechas sobre el mapa mueven el oyente virtual (no a Vanessa)", moved.x > startAt.x + 100 && Math.abs((await t.scene()).pos.x - p0.x) < 1, JSON.stringify({ startAt, moved }));

    await panel(t.page).getByRole("button", { name: "Probar", exact: true }).click();
    await t.page.waitForTimeout(900);
    const playing = await diag(t.page);
    check("LAB-8: «Probar» crea una voz de prueba con el volumen del emisor y la distancia del oyente", tests(playing).length === 1 && tests(playing)[0].key === "audio.sfx.test-river" && tests(playing)[0].base > 0 && tests(playing)[0].spatial >= 0, JSON.stringify(playing.voices));
    await panel(t.page).getByRole("button", { name: "Detener", exact: true }).first().click();
    await t.page.waitForTimeout(1000);
    check("LAB-9: «Detener» apaga el bucle con su fundido de salida", tests(await diag(t.page)).length === 0);

    // Ajustes en vivo: volumen, borrador y restablecer (con el oyente junto al río, para que la distancia no lo calle)
    await clickWorld(t.page, 1180, 780);
    await t.page.waitForTimeout(250);
    check("LAB-10a: hacer clic en el mapa coloca al oyente virtual en ese punto", await t.page.evaluate(() => { const l = window.__BITACORA_SFX__.diagnostics().listener; return Math.abs(l.x - 1180) < 8 && Math.abs(l.y - 780) < 8; }));
    await panel(t.page).getByRole("button", { name: "Probar", exact: true }).click();
    await t.page.waitForTimeout(700);
    const before = tests(await diag(t.page))[0];
    await panel(t.page).getByLabel("Volumen", { exact: true }).fill("0.05");
    await t.page.waitForTimeout(500);
    const after = tests(await diag(t.page))[0];
    check("LAB-10: cambiar el volumen mientras suena se aplica en vivo a la voz de prueba", after && before && after.base < before.base && after.effective < before.effective, JSON.stringify({ before, after }));
    check("LAB-11: el cambio queda como borrador visible (etiqueta «sin guardar» y contador en el botón)", (await panel(t.page).getByText("sin guardar").count()) >= 1 && /1/.test(await toggle(t.page).innerText()));
    check("LAB-12: nada se escribió en el proyecto (los archivos del repositorio siguen idénticos)", JSON.stringify(repoHashes()) === JSON.stringify(repoBefore));
    await panel(t.page).getByRole("button", { name: "Restablecer", exact: true }).first().click();
    await t.page.waitForTimeout(300);
    check("LAB-13: «Restablecer» vuelve al valor guardado y quita el borrador", Math.abs(Number(await panel(t.page).getByLabel("Volumen", { exact: true }).inputValue()) - configJson.maps["zona-a"].sounds["rio-pradera"].volume) < 0.011 && !/\d/.test((await toggle(t.page).innerText()).replace("Sonidos", "")));

    // Aplicar a esta sesión
    await panel(t.page).getByLabel("Volumen", { exact: true }).fill("0.11");
    await panel(t.page).getByRole("button", { name: "Aplicar a esta sesión" }).first().click();
    await t.page.waitForTimeout(300);
    const live = await t.page.evaluate(() => window.__BITACORA_SFX__.liveSound("rio-pradera").volume);
    check("LAB-14: «Aplicar a esta sesión» cambia el emisor en vivo sin tocar el proyecto ni recrear el juego", Math.abs(live - 0.11) < 0.001 && JSON.stringify(repoHashes()) === JSON.stringify(repoBefore));

    // Comprobar (sin escribir)
    await panel(t.page).getByRole("button", { name: "Comprobar" }).click();
    await t.page.waitForTimeout(1200);
    const checkText = await panel(t.page).locator(".lab-save").innerText();
    check("LAB-15: «Comprobar» valida el cambio en el servidor sin escribir nada", /Comprobado/.test(checkText) && JSON.stringify(repoHashes()) === JSON.stringify(repoBefore), checkText);

    // Solo
    await panel(t.page).getByLabel("Solo", { exact: true }).check();
    const solo = await t.page.evaluate(() => window.__BITACORA_SFX__.diagnostics().state.errors.length);
    check("LAB-16: «Solo» no produce errores y se puede desactivar", solo === 0);
    await panel(t.page).getByLabel("Solo", { exact: true }).uncheck();

    // Detener todo
    await panel(t.page).getByRole("button", { name: "Probar", exact: true }).click();
    await t.page.waitForTimeout(500);
    await panel(t.page).getByRole("button", { name: "Detener todo" }).first().click();
    await t.page.waitForTimeout(300);
    check("LAB-17: «Detener todo» deja el diagnóstico sin voces (también las del ambiente) y ofrece «Reanudar el ambiente»", (await diag(t.page)).voices.length === 0 && (await panel(t.page).getByRole("button", { name: "Reanudar el ambiente" }).count()) === 1);
    await panel(t.page).getByRole("button", { name: "Reanudar el ambiente" }).click();
    await t.page.waitForTimeout(1500);
    check("LAB-17b: y «Reanudar el ambiente» devuelve el sonido del mapa", (await diag(t.page)).voices.some((v) => v.kind === "ambient"));

    // Archivo de prueba local
    await panel(t.page).getByRole("tab", { name: "Archivo de prueba" }).click();
    await panel(t.page).locator("#lab-file-input").setInputFiles(WAV);
    await panel(t.page).locator(".lab-filelist li").first().waitFor();
    const fileRow = await panel(t.page).locator(".lab-filelist li").first().innerText();
    check("LAB-18: un WAV elegido aparece con su formato y duración", /tono-nuevo\.wav/.test(fileRow) && /WAV/.test(fileRow) && /0[.,]40 s/.test(fileRow), fileRow);
    await panel(t.page).locator(".lab-filelist li").first().getByRole("button", { name: "Probar" }).click();
    await t.page.waitForTimeout(250);
    const fileVoice = tests(await diag(t.page));
    check("LAB-19: se puede probar el archivo local (voz de prueba con su clave temporal)", fileVoice.length >= 1 && fileVoice.some((v) => v.key.startsWith("local:")), JSON.stringify(fileVoice));
    await panel(t.page).locator(".lab-filelist li").first().getByRole("button", { name: "Usar en lo seleccionado" }).click();
    await t.page.waitForTimeout(300);
    await panel(t.page).getByRole("tab", { name: "Mapa" }).click();
    check("LAB-20: «Usar en lo seleccionado» asigna el archivo local al emisor como borrador", /tono-nuevo/.test(await panel(t.page).getByLabel("Archivo de sonido").inputValue().catch(() => "")) || (await panel(t.page).getByLabel("Archivo de sonido").evaluate((el) => el.options[el.selectedIndex].text)).includes("tono-nuevo"));

    // Un archivo inválido no se añade, se explica y no rompe nada
    await panel(t.page).getByRole("tab", { name: "Archivo de prueba" }).click();
    await panel(t.page).locator("#lab-file-input").setInputFiles(FAKE);
    await t.page.waitForTimeout(600);
    check("LAB-20b: un «WAV» que no es audio no se añade, se explica y el juego sigue funcionando", (await panel(t.page).locator(".lab-filelist li").count()) === 1 && /decodificar|contenido|formato/i.test(await panel(t.page).locator(".lab-notice").innerText()) && t.errors.length === 0, await panel(t.page).locator(".lab-notice").innerText());
    await panel(t.page).getByRole("tab", { name: "Mapa" }).click();

    // Exportar
    const [download] = await Promise.all([t.page.waitForEvent("download"), panel(t.page).getByRole("button", { name: "Exportar ajustes" }).click()]);
    const pkgPath = join(TMP, "ajustes.json");
    await download.saveAs(pkgPath);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    check("LAB-21: «Exportar ajustes» descarga un paquete versionado con el cambio y el archivo dentro", pkg.format === "bitacora-audio-lab" && pkg.version === 1 && pkg.changes.some((c) => c.type === "sound" && c.soundId === "rio-pradera" && c.assetKey) && pkg.assets.length === 1 && pkg.assets[0].name === "tono-nuevo.wav" && pkg.assets[0].dataBase64.length > 100, JSON.stringify({ ...pkg, assets: pkg.assets.map((a) => ({ ...a, dataBase64: `${a.dataBase64.length} chars` })) }).slice(0, 400));

    // Presets: probar sin conceder insignias
    await panel(t.page).getByRole("tab", { name: "Presets" }).click();
    const progressBefore = JSON.stringify((await t.stored())["bitacora:progress:v1"] ?? (await t.stored()));
    await panel(t.page).getByRole("region", { name: /Efecto: Ganar una insignia/ }).getByRole("button", { name: "Probar" }).click();
    await t.page.waitForTimeout(400);
    const presetVoice = tests(await diag(t.page));
    check("LAB-22: probar el efecto «badge.earned» solo suena: no entrega insignias ni cambia el progreso", presetVoice.some((v) => v.key === "audio.sfx.test-badge") && JSON.stringify((await t.stored())["bitacora:progress:v1"] ?? (await t.stored())) === progressBefore, JSON.stringify(presetVoice));

    // Con la escena congelada nada de esto produce checkpoints ni cambia el progreso (caminar en el modo recorrido sí mueve a Vanessa)
    await t.page.waitForTimeout(1500);
    const frozenAfter = await stateOf(t);
    check("LAB-22b: con el mapa congelado, tras probar, «solo», «detener todo» y mover el oyente, el progreso (incluida la posición guardada) y las preferencias siguen idénticos", JSON.stringify(frozenAfter) === JSON.stringify(stateBefore), JSON.stringify({ stateBefore, frozenAfter }).slice(0, 300));

    // Recorrido: se descongela y se puede caminar
    await panel(t.page).getByLabel(/Recorrido/).check();
    await t.page.waitForTimeout(300);
    const unfrozen = await reasons(t.page);
    await panel(t.page).getByRole("button", { name: /Ir al mapa del juego/ }).click();
    const w = await t.hold(["ArrowRight"], 350);
    check("LAB-23: en el modo recorrido se quita la pausa del laboratorio y Vanessa camina de nuevo", !(unfrozen ?? []).includes("audio-lab") && w.m.pos.x > w.a.pos.x + 5, JSON.stringify({ unfrozen, a: w.a.pos, m: w.m.pos }));

    // Cerrar: sin voces ni pausa
    await panel(t.page).getByRole("button", { name: "Cerrar" }).click();
    await t.page.waitForTimeout(400);
    check("LAB-24: al cerrar el panel no queda pausa, ni voces de prueba, ni oyente virtual", (await panel(t.page).count()) === 0 && !((await reasons(t.page)) ?? []).includes("audio-lab") && (await diag(t.page)).voices.filter((v) => v.kind === "test").length === 0 && !(await diag(t.page)).virtual);
    const stateAfter = await stateOf(t);
    check("LAB-24b: tras toda la sesión del laboratorio las preferencias del visitante (silencio) siguen idénticas y ninguna lectura se marcó", stateAfter.prefs === stateBefore.prefs && Object.values(stateAfter.progress).every((v) => !/"readSectionIds":\[[^\]]/.test(v) && !/completedAt/.test(v)), JSON.stringify({ stateBefore: stateBefore.prefs, stateAfter: stateAfter.prefs }));
    check("LAB-25: sin errores en la consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }
} catch (e) {
  console.error(`✖ la prueba falló con una excepción: ${e.stack ?? e}`);
  process.exitCode = 1;
} finally {
  check("LAB-26: al terminar, los archivos reales del proyecto siguen idénticos (la prueba no escribió en el repositorio)", JSON.stringify(repoHashes()) === JSON.stringify(repoBefore));
  await h.finish();
}
