// E2E de la composición en móviles reales (iPhone con la barra del navegador: 393 × 664; Android pequeño: 360 × 640; 320 × 568): la
// cápsula de avance no pisa su borde, el índice de la Bitácora se desplaza entero con el pie siempre a la vista, el botón de cerrar de la
// colección queda junto al título y nada se sale por los lados. Mide cajas (no hay referencia de píxeles).
// Uso: node scripts/e2e/mobile-layout.mjs
import { configJson, harness } from "./helpers.mjs";

const { open, check, finish } = await harness();
const KEY = `bitacora:progress:v3:${configJson.contentSetId}:${configJson.mode}`;
const DONE = { contentRevision: 1, readSectionIds: ["learning", "reflection", "lived"], completedAt: "2026-09-30T10:00:00.000Z" };
const progress = (n) => ({ [KEY]: JSON.stringify({ schemaVersion: 3, contentSetId: configJson.contentSetId, mode: configJson.mode, currentZoneId: "zona-a", player: { x: 200, y: 1030 }, checkpoints: {}, entries: Object.fromEntries(configJson.route.map((id, i) => [id, i < n ? DONE : { contentRevision: 1, readSectionIds: [] }])) }) });
const box = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
/** ¿Todo el contenido de la cápsula cae dentro de su caja, sin tocar el borde decorativo (el ancho del borde es el de la imagen)? */
const pillFits = (page, sel) => page.evaluate((s) => {
  const pill = document.querySelector(s);
  const r = pill.getBoundingClientRect();
  const border = parseFloat(getComputedStyle(pill).borderLeftWidth);
  const kids = [...pill.querySelectorAll("span, div, img")].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0);
  const left = Math.min(...kids.map((b) => b.left));
  const right = Math.max(...kids.map((b) => b.right));
  return { ok: left >= r.left + border - 0.5 && right <= r.right - border + 0.5, left: Math.round(left - r.left), right: Math.round(r.right - right), border: Math.round(border) };
}, sel);
const noSideOverflow = (page) => page.evaluate(() => [...document.querySelectorAll(".jp-dialog, .bpk-dialog, .prs-panel, .prs-cover")].every((e) => e.scrollWidth <= e.clientWidth + 1));

try {
  for (const vp of [{ width: 393, height: 664 }, { width: 360, height: 640 }, { width: 320, height: 568 }]) {
    const tag = `${vp.width}×${vp.height}`;
    const t = await open({ viewport: vp, seed: progress(2) });
    check(`ML-1 (${tag}): la frase y el texto de bienvenida de la portada usan la misma letra que el resto (Nunito)`, /^"?Nunito/.test(await t.page.evaluate(() => getComputedStyle(document.querySelector(".prs-intro")).fontFamily)));
    check(`ML-2 (${tag}): la portada no se sale por los lados`, await noSideOverflow(t.page));
    await t.start();
    await t.page.getByRole("button", { name: "Bitácora" }).click();
    await t.page.waitForTimeout(500);

    const fit = await pillFits(t.page, ".jp-progress");
    check(`ML-3 (${tag}): "2 de 6 completados" y sus cuadritos quedan dentro de la cápsula, sin pisar el borde`, fit.ok, JSON.stringify(fit));
    check(`ML-4 (${tag}): el índice no se sale por los lados`, await noSideOverflow(t.page));

    const dlg = await t.page.evaluate(() => { const d = document.querySelector(".jp-dialog--index"); const s = document.querySelector(".jp-scroll"); return { scrolls: d.scrollHeight > d.clientHeight, innerScroll: getComputedStyle(s).overflowY, view: innerHeight }; });
    check(`ML-5 (${tag}): el índice se desplaza entero (no hay una ventanita de lista entre la cabecera y el pie)`, dlg.scrolls && dlg.innerScroll === "visible", JSON.stringify(dlg));

    const footer = () => box(t.page, ".jp-dialog--index .jp-footer .jp-action");
    const f0 = await footer();
    check(`ML-6 (${tag}): «Volver al mapa» está a la vista al abrir y mide al menos 44 px`, f0.b <= vp.height && f0.h >= 43.5, JSON.stringify(f0));
    await t.page.locator(".jp-dialog--index").evaluate((e) => (e.scrollTop = e.scrollHeight));
    await t.page.waitForTimeout(250);
    const f1 = await footer();
    check(`ML-7 (${tag}): y sigue a la vista al desplazarse hasta el final`, f1.b <= vp.height && Math.abs(f1.y - f0.y) < 2, JSON.stringify({ f0, f1 }));

    // Con el pie y la cabecera, queda sitio para ver una tarjeta casi entera (cabecera desplazada)
    await t.page.locator(".jp-dialog--index").evaluate((e) => (e.scrollTop = 0));
    const card = await t.page.evaluate(() => { const c = document.querySelector(".jp-card"); const f = document.querySelector(".jp-dialog--index .jp-footer"); const cr = c.getBoundingClientRect(); const fr = f.getBoundingClientRect(); return { cardH: Math.round(cr.height), visibleFooterTop: Math.round(fr.top), vh: innerHeight }; });
    await t.page.locator(".jp-card").first().scrollIntoViewIfNeeded();
    const room = await t.page.evaluate(() => { const c = document.querySelector(".jp-card").getBoundingClientRect(); const f = document.querySelector(".jp-dialog--index .jp-footer").getBoundingClientRect(); const d = document.querySelector(".jp-dialog--index").getBoundingClientRect(); return Math.round(f.top - Math.max(d.top, 0)); });
    check(`ML-8 (${tag}): entre el borde de arriba y el pie hay sitio para una tarjeta entera (${card.cardH} px)`, room >= card.cardH, JSON.stringify({ room, card }));

    // Abrir una tarjeta y volver: sin errores
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(300);

    // Colección de insignias
    await t.page.getByRole("button", { name: "Insignias" }).click();
    await t.page.waitForTimeout(500);
    const title = await box(t.page, ".bpk-header h1");
    const close = await box(t.page, ".bpk-header:not(.bpk-header--detail) .bpk-icon-button--close");
    check(`ML-9 (${tag}): en la colección el botón de cerrar queda arriba a la derecha, en la misma fila que el título`, close && title && close.y < title.b && close.r <= vp.width && close.x > title.x, JSON.stringify({ title, close }));
    const fit2 = await pillFits(t.page, ".bpk-progress");
    check(`ML-10 (${tag}): la cápsula "n de 6 obtenidas" queda dentro de su borde`, fit2.ok, JSON.stringify(fit2));
    check(`ML-11 (${tag}): la colección no se sale por los lados`, await noSideOverflow(t.page));
    check(`ML-12 (${tag}): sin errores de consola`, t.errors.length === 0, t.errors.join(" | "));
    await t.page.screenshot({ path: `/tmp/ml-${vp.width}x${vp.height}-badges.png` });
    await t.close();
  }
} catch (e) {
  check(`excepción no controlada: ${String(e?.stack ?? e).split("\n").slice(0, 2).join(" ")}`, false);
} finally {
  await finish();
}
