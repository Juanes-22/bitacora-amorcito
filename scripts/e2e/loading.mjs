// E2E de la carga por etapas (SPEC 11.4, AC-82): el mapa aparece cuando llega lo esencial, con una barra de carga mientras tanto;
// el paisaje vivo y los extras llegan después sin bloquear; las insignias solo se cargan al celebrar; y la interfaz no se queda
// sin sus imágenes mientras el mapa descarga. Las demoras se simulan en la red de la página.
import { configJson, harness, START } from "./helpers.mjs";

const h = await harness();
const { check } = h;
const scene = (t, fn, arg) => t.page.evaluate(fn, arg);
const state = (t) => scene(t, () => {
  const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene");
  const names = (list) => list.filter((id) => s.textures.exists(id));
  return {
    ready: !!s.player,
    fullyLoaded: s.fullyLoaded,
    ambientSprites: s.children.list.filter((o) => o.texture?.key?.startsWith("animation.flora.")).length,
    critters: s.children.list.filter((o) => o.name === "critter").length,
    hasLayer: s.textures.exists("background.zone-01.horizon"),
    hasHen: s.textures.exists("fauna.hen.white"),
    hasIdle: s.textures.exists("character.vanessa-jerry.idle-anim.rest"),
    badgeTextures: names(Object.values(window.__BADGES__ ?? {})),
  };
});
const delayed = async (pattern, ms) => {
  const ctx = await h.browser.newContext({ viewport: { width: 412, height: 800 }, isMobile: true, hasTouch: true });
  await ctx.route(pattern, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue().catch(() => undefined);
  });
  return ctx;
};
const badgeIds = Object.values(configJson.badges).map((b) => b.assetId);

try {
  // ---- L1: con lo esencial lento se ve la barra de carga y la interfaz ya tiene sus imágenes; luego desaparece.
  {
    const ctx = await delayed("**/backgrounds/zone-01/*.png", 1800);
    const t = await h.open({ context: ctx });
    await t.page.click(START);
    await t.page.waitForSelector(".map-loading", { timeout: 4000 });
    const first = await t.page.evaluate(() => ({ text: document.querySelector(".map-loading__text")?.textContent, now: Number(document.querySelector(".map-loading [role=progressbar]")?.getAttribute("aria-valuenow")) }));
    check("L1 mientras llega lo esencial se muestra «Cargando el mapa…» con una barra de progreso", first.text === configJson.ui.labels.loadingMap && first.now >= 0 && first.now < 100, JSON.stringify(first));
    const hudImages = await t.page.evaluate(() => [...document.querySelectorAll(".hud img")].map((i) => i.complete && i.naturalWidth > 0));
    check("L1 la interfaz (cabecera y botones) tiene sus imágenes mientras el mapa carga", hudImages.length > 0 && hudImages.every(Boolean), JSON.stringify(hudImages));
    await t.page.waitForSelector(".map-loading", { state: "detached", timeout: 15000 });
    const s = await state(t);
    check("L1 al terminar lo esencial la barra desaparece y el mapa ya se puede recorrer", s.ready && s.hasLayer, JSON.stringify(s));
    check("L1 sin errores en la consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- L2: con el paisaje y los extras lentos, el mapa ya funciona; llegan después y se construyen solos.
  {
    // Solo el paisaje vivo y los extras (no lo esencial: los destellos dorados de la estación sí son esenciales).
    const ctx = await delayed((url) => /\/assets\/(animations|particles|decorations\/(chickens|plants|lights)|backgrounds\/sky|characters)\//.test(url.pathname) && !/gold-sparkle|walk/.test(url.pathname), 2500);
    const t = await h.open({ context: ctx });
    await t.page.click(START);
    await t.page.waitForTimeout(900);
    const early = await state(t);
    check("L2 el mapa está listo antes de que llegue el paisaje vivo (sin plantas ni gallinas todavía)", early.ready && !early.fullyLoaded && early.ambientSprites === 0 && early.critters === 0, JSON.stringify(early));
    await t.place(configJson.maps["zona-a"].spawns.inicio.x + 40, configJson.maps["zona-a"].spawns.inicio.y);
    const moved = (await t.hold(["ArrowRight"], 250)).m.pos;
    check("L2 mientras tanto Vanessa ya camina", moved.x > configJson.maps["zona-a"].spawns.inicio.x + 40, JSON.stringify(moved));
    await t.page.waitForFunction(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").fullyLoaded === true, null, { timeout: 30000 });
    const late = await state(t);
    check("L2 después llegan y se crean las plantas, las gallinas y el reposo animado", late.ambientSprites > 0 && late.critters > 0 && late.hasIdle, JSON.stringify(late));
    check("L2 sin errores en la consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- L3: las insignias no se cargan hasta celebrar; al celebrar se cargan y se muestran.
  {
    const t = await h.open({ viewport: { width: 412, height: 800 } });
    await t.start();
    const before = await scene(t, (ids) => ids.filter((id) => window.__PHASER_GAME__.scene.getScene("ExplorationScene").textures.exists(id)), badgeIds);
    check("L3 al empezar no hay ninguna insignia cargada en el mapa (ahorra memoria)", before.length === 0, JSON.stringify(before));
    const badge = configJson.badges[configJson.learnings["apr-a"].badgeId].assetId;
    await scene(t, (id) => window.__BITACORA_BRIDGE__.emit("app:celebrate", { effectId: "test-effect-1", learningId: id }), "apr-a");
    await t.page.waitForTimeout(1500);
    const after = await scene(t, (id) => window.__PHASER_GAME__.scene.getScene("ExplorationScene").textures.exists(id), badge);
    check("L3 al celebrar un aprendizaje se carga su insignia", after === true);
    const others = await scene(t, (ids) => ids.filter((id) => window.__PHASER_GAME__.scene.getScene("ExplorationScene").textures.exists(id)).length, badgeIds);
    check("L3 y solo esa", others === 1, String(others));
    check("L3 sin errores en la consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- L4: un archivo del paisaje que falta se avisa al terminar su etapa y el resto sigue.
  {
    const t = await h.open({ blockUrl: "**/hen-brown.png" });
    await t.page.locator(START).dispatchEvent("click");
    await t.page.waitForFunction(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").fullyLoaded === true, null, { timeout: 20000 });
    await t.page.waitForTimeout(300);
    const alert = await t.page.locator(".asset-alert").innerText().catch(() => "");
    check("L4 un gráfico del paisaje que no carga se avisa con su ID, sin detener el mapa", /fauna\.hen\.brown/.test(alert), alert);
    check("L4 las demás gallinas sí se crean", (await state(t)).critters > 0);
    await t.close();
  }

  // ---- L5: el cambio de zona vuelve a cargar por etapas y no duplica nada.
  {
    const t = await h.open();
    await t.start();
    const a = await state(t);
    await t.page.evaluate(() => window.__BITACORA_BRIDGE__.emit("app:zone-change", { zoneId: "zona-b", spawnId: "desde-a" }));
    await t.page.waitForFunction(() => { const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); return s.zoneId === "zona-b" && s.fullyLoaded === true; }, null, { timeout: 20000 });
    const b = await state(t);
    check("L5 la zona B carga por etapas y crea su paisaje y sus animales", b.ready && b.ambientSprites > 0 && b.critters > 0, JSON.stringify({ a, b }));
    await t.page.evaluate(() => window.__BITACORA_BRIDGE__.emit("app:zone-change", { zoneId: "zona-a", spawnId: "desde-b" }));
    await t.page.waitForFunction(() => { const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); return s.zoneId === "zona-a" && s.fullyLoaded === true; }, null, { timeout: 20000 });
    const back = await state(t);
    check("L5 al volver a la zona A queda lo mismo que al empezar", back.ambientSprites === a.ambientSprites && back.critters === a.critters, JSON.stringify({ a, back }));
    check("L5 sin errores en la consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }
} catch (e) {
  console.error(`✖ la prueba falló con una excepción: ${e.stack ?? e}`);
  process.exitCode = 1;
} finally {
  await h.finish();
}
