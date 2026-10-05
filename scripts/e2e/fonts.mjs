// E2E de las tipografías propias (SPEC 14): Nunito (interfaz y letreros) y Gelasio (lecturas) se sirven desde el propio sitio, llegan
// ANTES de crear el mapa, las usa el HTML y el texto que dibuja Phaser, y la bitácora abre igual si no llegan. Así el móvil no depende de las
// fuentes que traiga el sistema (Android no trae Trebuchet MS ni Georgia).
// Uso: node scripts/e2e/fonts.mjs
import { harness } from "./helpers.mjs";

const { open, check, finish } = await harness();
const faces = (page) => page.evaluate(() => [...document.fonts].map((f) => ({ family: f.family.replace(/"/g, ""), style: f.style, status: f.status })));
const loaded = (list, family, style = "normal") => list.some((f) => f.family === family && f.style === style && f.status === "loaded");
const phaserFonts = (page) => page.evaluate(() => [...new Set(window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list.filter((o) => o.type === "Text").map((o) => o.style.fontFamily))]);
/** Los elementos con texto propio cuya tipografía NO es una de las dos de la bitácora (si hay alguno, depende de lo que traiga el sistema). */
const strays = (page) => page.evaluate(() => [...document.querySelectorAll("body *")]
  .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !/^"?(Nunito|Gelasio)/.test(getComputedStyle(e).fontFamily))
  .map((e) => `${e.tagName.toLowerCase()}.${e.className}: ${getComputedStyle(e).fontFamily.slice(0, 40)}`).slice(0, 10));
const familyOf = (page, selector) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).fontFamily, selector);

try {
  for (const [name, viewport] of [["escritorio", { width: 1280, height: 720 }], ["móvil", { width: 390, height: 844 }]]) {
    const requests = [];
    const t = await open({ viewport, waitFor: "#root" });
    t.page.on("request", (r) => /\.woff2(\?|$)/.test(r.url()) && requests.push(r.url()));
    await t.page.reload();
    await t.page.waitForSelector(".cover");
    await t.page.waitForTimeout(800);
    const before = await faces(t.page);
    check(`FONT-1 (${name}): antes de «Comenzar» ya están cargadas Nunito y Gelasio (normal y cursiva), no se espera a que se usen`, loaded(before, "Nunito") && loaded(before, "Gelasio") && loaded(before, "Gelasio", "italic"), JSON.stringify(before));
    check(`FONT-2 (${name}): se descargan del propio sitio (tres archivos .woff2 del mismo origen, sin servidores externos)`, requests.length === 3 && requests.every((u) => new URL(u).origin === new URL(t.base).origin), JSON.stringify(requests));
    check(`FONT-3a (${name}): todo el texto de la portada usa una de las dos tipografías`, (await strays(t.page)).length === 0, JSON.stringify(await strays(t.page)));
    check(`FONT-3 (${name}): la portada usa Nunito (interfaz) y Gelasio (texto de bienvenida)`, /Nunito/.test(await familyOf(t.page, ".prs-cover")) && /Gelasio/.test(await familyOf(t.page, ".prs-intro")), `${await familyOf(t.page, ".prs-cover")} | ${await familyOf(t.page, ".prs-intro")}`);
    await t.start();
    await t.page.waitForTimeout(500);
    const fonts = await phaserFonts(t.page);
    check(`FONT-4 (${name}): el texto de los letreros que dibuja Phaser usa la misma tipografía (Nunito primero)`, fonts.length > 0 && fonts.every((f) => /^"?Nunito/.test(f)), JSON.stringify(fonts));
    check(`FONT-5 (${name}): las etiquetas de los botones de la cabecera usan Nunito`, /Nunito/.test(await familyOf(t.page, ".icon-button__caption")));
    check(`FONT-5a (${name}): y todo el texto de la cabecera y del mapa`, (await strays(t.page)).length === 0, JSON.stringify(await strays(t.page)));
    // Las ventanas: la Bitácora (lista), una lectura y la colección de insignias
    await t.page.getByRole("button", { name: "Bitácora" }).click();
    await t.page.waitForTimeout(300);
    check(`FONT-5b (${name}): la Bitácora de aprendizajes`, (await strays(t.page)).length === 0, JSON.stringify(await strays(t.page)));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(300);
    await t.travelTo("apr-a");
    await t.page.waitForTimeout(300);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(500);
    const reading = await strays(t.page);
    const body = await t.page.evaluate(() => { const e = document.querySelector(".jp-dialog--reader p, .reading p, [role=dialog] p"); return e ? getComputedStyle(e).fontFamily : ""; });
    check(`FONT-5c (${name}): la lectura abierta (título, pestañas, párrafos y botones) solo usa las tipografías de la bitácora`, reading.length === 0 && /^"?(Nunito|Gelasio)/.test(body), JSON.stringify({ reading, body }));
    await t.page.screenshot({ path: `/tmp/fonts-${name === "móvil" ? "mobile" : "desktop"}-reading.png` });
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(300);
    await t.page.getByRole("button", { name: "Insignias" }).click();
    await t.page.waitForTimeout(300);
    check(`FONT-5d (${name}): el panel de insignias`, (await strays(t.page)).length === 0, JSON.stringify(await strays(t.page)));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(200);
    await t.page.screenshot({ path: `/tmp/fonts-${name === "móvil" ? "mobile" : "desktop"}.png` });
    check(`FONT-6 (${name}): sin errores de consola`, t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // Si las fuentes no llegan (red caída, archivo bloqueado) la bitácora abre igual, con la letra de reserva, y sin errores graves
  {
    const t = await open({ viewport: { width: 390, height: 844 }, blockUrl: /\.woff2(\?|$)/ });
    await t.start();
    const fonts = await phaserFonts(t.page);
    const ok = (await t.scene()).zone === "zona-a";
    check("FONT-7: con los archivos de fuente bloqueados la bitácora abre y se puede recorrer, con las fuentes de reserva", ok && fonts.length > 0, JSON.stringify(fonts));
    await t.close();
  }
} catch (e) {
  check(`excepción no controlada: ${String(e?.stack ?? e).split("\n").slice(0, 2).join(" ")}`, false);
} finally {
  await finish();
}
