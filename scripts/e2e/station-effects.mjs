// E2E del aro de «próxima estación», la estrella de XP y el panel de la cabecera (SPEC 4.3 y 14; AC-68, AC-69) en un navegador real.
// Uso: npm run test:e2e
import { configJson, harness } from "./helpers.mjs";

const { open, check, finish } = await harness();
const L = configJson.ui.labels;
const GLOW = configJson.ui.assets.nextStationGlow;
const XP = configJson.ui.assets.xpStarEffect;
const KEY = `bitacora:progress:v3:${configJson.contentSetId}:demo`;
const DONE = { contentRevision: 1, readSectionIds: ["lived", "learning", "reflection", "classroom"], completedAt: "2026-09-30T10:00:00.000Z" };
const saved = (completed) => ({
  [KEY]: JSON.stringify({
    schemaVersion: 3, contentSetId: configJson.contentSetId, mode: "demo", currentZoneId: "zona-a", player: { x: 200, y: 1030 }, checkpoints: {},
    entries: Object.fromEntries(configJson.route.map((id) => [id, completed.includes(id) ? DONE : { contentRevision: 1, readSectionIds: [] }])),
  }),
});

/** Los sprites de un efecto en la escena: visibles o no, con su animación, su opacidad y su posición. */
const sprites = (t, textureKey) =>
  t.page.evaluate((key) => window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list
    .filter((o) => o.type === "Sprite" && o.texture.key === key)
    .map((o) => ({ visible: o.visible, playing: o.anims.isPlaying, frame: o.frame.name, alpha: o.alpha, x: o.x, y: o.y, depth: o.depth })), textureKey);
const station = (id) => configJson.placements[id].position;

try {
  // ---- Aro de la próxima estación -------------------------------------------------------------------------
  {
    const t = await open({ seed: saved([]) });
    await t.start();
    await t.page.waitForTimeout(500);
    const a = await sprites(t, GLOW);
    const visible = a.filter((s) => s.visible);
    check("AC-68: en la zona A hay un aro por estación y solo el de la próxima (la 1) se ve", a.length === 3 && visible.length === 1 && Math.abs(visible[0].x - station("apr-a").x) < 1, JSON.stringify(a));
    check("AC-68: el aro está animado (en bucle) y por debajo de la señal", visible[0].playing && visible[0].depth < station("apr-a").y, JSON.stringify(visible[0]));
    const alphas = new Set();
    const frames = new Set();
    for (let i = 0; i < 25; i++) { const s = (await sprites(t, GLOW)).find((x) => x.visible); alphas.add(s.alpha.toFixed(2)); frames.add(s.frame); await t.page.waitForTimeout(60); }
    check("AC-68: sus fotogramas cambian y su opacidad late con la del manifiesto (entre 0,78 y 1)", frames.size >= 4 && alphas.size >= 3 && [...alphas].every((v) => +v >= 0.77 && +v <= 1.001), JSON.stringify({ frames: [...frames], alphas: [...alphas] }));
    check("al cargar, sin nada completado, no hay ninguna estrella de XP", (await sprites(t, XP)).length === 0);
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- El aro se mueve a la siguiente estación; nada de estrella al cargar ------------------------------------
  {
    const t = await open({ seed: saved(["apr-a"]) });
    await t.start();
    await t.page.waitForTimeout(500);
    const visible = (await sprites(t, GLOW)).filter((s) => s.visible);
    check("AC-68: con la 1 completada, el aro pasa a la 2", visible.length === 1 && Math.abs(visible[0].x - station("apr-b").x) < 1, JSON.stringify(visible));
    const star = await sprites(t, XP);
    const loop = new Set();
    for (let i = 0; i < 25; i++) { const s = (await sprites(t, XP))[0]; if (s) loop.add(s.frame); await t.page.waitForTimeout(80); }
    check("AC-69: cargar con una estación completada la muestra con su estrella ya titilando (sin entrada), y solo a esa", star.length === 1 && star[0].visible && star[0].playing && Math.abs(star[0].x - station("apr-a").x) < 1 && star[0].y < station("apr-a").y, JSON.stringify(star));
    check("AC-69: la estrella titila en bucle con los fotogramas xp-003..xp-005 (nunca vuelve al principio)", loop.size >= 2 && [...loop].every((f) => ["xp-003", "xp-004", "xp-005"].includes(f)), JSON.stringify([...loop]));
    await t.close();
  }
  {
    const t = await open({ seed: saved(configJson.route) });
    await t.start();
    await t.page.waitForTimeout(500);
    check("AC-68: con todo completado no queda ningún aro visible", (await sprites(t, GLOW)).every((s) => !s.visible));
    check("AC-69: y la zona A muestra una estrella por cada estación completada", (await sprites(t, XP)).length === 3);
    await t.close();
  }

  // ---- Estrella de XP al completar una estación ----------------------------------------------------------------
  {
    const t = await open();
    await t.start();
    await t.page.getByRole("button", { name: L.index }).click();
    await t.page.waitForTimeout(250);
    await t.page.getByRole("button", { name: new RegExp(`${L.explore}: Aprendizaje 1:`) }).click();
    await t.page.waitForTimeout(250);
    await t.page.click("text=Siguiente");
    for (let s = 0; s < 4; s++) {
      await t.page.click("text=Marcar sección como leída");
      await t.page.waitForTimeout(80);
      if (s < 3) await t.page.getByRole("tab").nth(s + 1).click();
    }
    await t.page.click("text=Recoger insignia y continuar");
    await t.page.waitForTimeout(700);
    check("AC-69: mientras se muestra la recompensa aún no hay estrella (el mapa está detenido)", (await sprites(t, XP)).length === 0);
    await t.page.click("[role=dialog] >> text=Cerrar");
    const seen = new Set();
    const alphas = new Set();
    let first;
    for (let i = 0; i < 40; i++) {
      const s = (await sprites(t, XP))[0];
      if (s) { first ??= s; seen.add(s.frame); alphas.add(s.alpha.toFixed(2)); }
      await t.page.waitForTimeout(40);
    }
    const star = await sprites(t, XP);
    check("AC-69: al cerrar la recompensa sale una estrella de XP sobre la estación completada, animada", star.length === 1 && star[0].playing && Math.abs(star[0].x - station("apr-a").x) < 1 && star[0].y < station("apr-a").y, JSON.stringify(star));
    check("AC-69: entra creciendo (xp-000..xp-002) y pasa al titileo (xp-003..xp-005), con la opacidad del manifiesto", ["xp-000", "xp-001", "xp-002"].some((f) => seen.has(f)) && ["xp-003", "xp-004", "xp-005"].some((f) => seen.has(f)) && alphas.size >= 3, JSON.stringify({ seen: [...seen], alphas: [...alphas] }));
    await t.page.waitForTimeout(2500);
    const later = await sprites(t, XP);
    check("AC-69: la estrella no se retira: sigue sobre la estación y siempre animada", later.length === 1 && later[0].visible && later[0].playing && ["xp-003", "xp-004", "xp-005"].includes(later[0].frame), JSON.stringify(later));
    const after = (await sprites(t, GLOW)).filter((s) => s.visible);
    check("y el aro de la próxima estación ya está en la 2", after.length === 1 && Math.abs(after[0].x - station("apr-b").x) < 1, JSON.stringify(after));
    await t.close();
  }

  // ---- Movimiento reducido: sin animación, pero con el resultado visible -------------------------------------
  {
    const t = await open({ seed: saved([]), reducedMotion: true });
    await t.start();
    await t.page.waitForTimeout(500);
    const glow = (await sprites(t, GLOW)).filter((s) => s.visible);
    await t.page.waitForTimeout(400);
    const glow2 = (await sprites(t, GLOW)).filter((s) => s.visible);
    check("AC-69: con movimiento reducido el aro es un fotograma fijo, sin animación", glow.length === 1 && !glow[0].playing && glow[0].frame === glow2[0].frame && glow[0].alpha === glow2[0].alpha, JSON.stringify({ glow, glow2 }));
    await t.close();
  }
  {
    const t = await open({ seed: saved(["apr-a"]), reducedMotion: true });
    await t.start();
    await t.page.waitForTimeout(500);
    const star = await sprites(t, XP);
    await t.page.waitForTimeout(1200);
    const later = await sprites(t, XP);
    check("AC-69: con movimiento reducido la estrella es un fotograma fijo (xp-003) y permanece", star.length === 1 && !star[0].playing && star[0].frame === "xp-003" && later.length === 1 && later[0].frame === "xp-003" && later[0].visible, JSON.stringify({ star, later }));
    await t.close();
  }

  // ---- Una hoja que no carga: se conserva el brillo de siempre y el juego sigue -------------------------------
  {
    const t = await open({ seed: saved([]), blockUrl: "**/player-glow-next.png" });
    await t.page.locator(".pixel-button").dispatchEvent("click"); // el aviso de recurso cubre la portada
    await t.page.waitForTimeout(700);
    check("si el aro animado no carga, la estación conserva su brillo estático y el juego sigue", (await sprites(t, GLOW)).length === 0 && (await t.page.locator("canvas").count()) === 1 && /player-glow-next|effect\.player-glow\.next-station/.test(await t.page.locator(".asset-alert").innerText()));
    await t.close();
  }

  // ---- Panel de la cabecera ------------------------------------------------------------------------------------
  {
    const t = await open({ viewport: { width: 1280, height: 720 } });
    await t.start();
    const panel = await t.page.evaluate(() => { const s = getComputedStyle(document.querySelector(".hud")); return { image: s.borderImageSource, slice: s.borderImageSlice, bg: s.backgroundColor, rendering: s.imageRendering }; });
    check("AC-70: la cabecera usa el panel de nueve zonas del catálogo (PNG con esquinas sin estirar)", /player-status-panel\.png/.test(panel.image) && /112/.test(panel.slice) && panel.bg === "rgba(0, 0, 0, 0)" && panel.rendering === "pixelated", JSON.stringify(panel));
    const sizes = [[1280, 720], [768, 1024], [390, 844], [320, 568], [844, 390]];
    for (const [w, h] of sizes) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.page.waitForTimeout(300);
      const fit = await t.page.evaluate(() => {
        const r = (sel) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
        const inside = (rs) => rs.every((b) => b.left >= -0.5 && b.top >= -0.5 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5);
        const hud = r(".hud")[0], badges = r(".hud__badges")[0];
        const text = document.querySelector(".hud__main").getBoundingClientRect();
        return { hud: inside([hud]), tools: inside(r(".hud__tools > *")), hscroll: document.documentElement.scrollWidth > innerWidth, textClear: text.right <= badges.left + 1, textFits: document.querySelector(".hud__main").scrollWidth <= document.querySelector(".hud__main").clientWidth + 1 };
      });
      check(`AC-70: con el panel, a ${w}×${h} la cabecera y sus herramientas caben, sin scroll, y el texto no pisa el botón de insignias`, fit.hud && fit.tools && !fit.hscroll && fit.textClear && fit.textFits, JSON.stringify(fit));
    }
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
