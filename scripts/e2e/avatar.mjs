// E2E del avatar animado de la cabecera (SPEC 14, AC-71): reposo, alegría al completar una estación, movimiento reducido y respaldo.
// Uso: npm run test:e2e
import { configJson, harness } from "./helpers.mjs";

const { open, check, finish } = await harness();
const L = configJson.ui.labels;
const SHEET = configJson.ui.assets.avatarAnimations;
const sheet = JSON.parse((await import("node:fs")).readFileSync("public/assets/assets.json", "utf8")).assets[SHEET];
const HAPPY = sheet.avatarAnimations.find((a) => a.state === "happy");
const HAPPY_MS = 3 * HAPPY.durationsMs.reduce((a, b) => a + b, 0);

/** Una huella corta de lo que hay dibujado en el lienzo del avatar. */
const shot = (t) =>
  t.page.evaluate(() => {
    const c = document.querySelector(".hud__portrait canvas");
    if (!c) return null;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0;
    return h;
  });
const sample = async (t, ms, every = 60) => {
  const seen = new Set();
  const end = Date.now() + ms;
  while (Date.now() < end) { seen.add(await shot(t)); await t.page.waitForTimeout(every); }
  seen.delete(null);
  return seen;
};
const celebrate = (t) => t.page.evaluate(() => window.__BITACORA_BRIDGE__.emit("app:celebrate", { effectId: "demo@1", learningId: "apr-a" }));

try {
  // ---- Reposo, alegría y vuelta al reposo ------------------------------------------------------------------------
  {
    const t = await open();
    await t.start();
    await t.page.waitForTimeout(600);
    const dom = await t.page.evaluate(() => { const p = document.querySelector(".hud__portrait"); const r = p?.getBoundingClientRect(); const img = p?.querySelector("img"); return { canvas: !!p?.querySelector("canvas"), imgHidden: img?.hidden && getComputedStyle(img).display === "none", w: r?.width, h: r?.height, canvasInside: p?.querySelector("canvas").getBoundingClientRect().bottom <= r.bottom + 1 }; });
    check("AC-71: el retrato de la cabecera es un lienzo animado (el avatar estático queda oculto)", dom.canvas && dom.imgHidden === true && dom.canvasInside && dom.h > 60 && dom.w > dom.h, JSON.stringify(dom));
    const idle = await sample(t, 3200);
    check("AC-71: en reposo cambia de fotograma (respira y parpadea)", idle.size >= 2 && idle.size <= 4, JSON.stringify([...idle]));
    await celebrate(t);
    const happy = await sample(t, 1600, 40);
    const fresh = [...happy].filter((h) => !idle.has(h));
    check("AC-71: al completar una estación hace la animación feliz (fotogramas distintos a los del reposo)", fresh.length >= 2, JSON.stringify({ idle: [...idle], happy: [...happy] }));
    await t.page.waitForTimeout(HAPPY_MS);
    const after = await sample(t, 3200);
    check("AC-71: pasadas unas vueltas vuelve al reposo", [...after].every((h) => idle.has(h)), JSON.stringify({ idle: [...idle], after: [...after] }));
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Completar de verdad una estación desde la interfaz ----------------------------------------------------------
  {
    const t = await open();
    await t.start();
    await t.page.waitForTimeout(400);
    const idle = await sample(t, 2800);
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
    await t.page.waitForTimeout(800);
    await t.page.click("[role=dialog] >> text=Cerrar");
    const happy = await sample(t, 1500, 40);
    check("AC-71: al cerrar la recompensa de una estación el avatar se pone feliz", [...happy].filter((h) => !idle.has(h)).length >= 2, JSON.stringify({ idle: [...idle], happy: [...happy] }));
    await t.close();
  }

  // ---- Movimiento reducido -----------------------------------------------------------------------------------------
  {
    const t = await open({ reducedMotion: true });
    await t.start();
    await t.page.waitForTimeout(600);
    const still = await sample(t, 2500, 100);
    check("AC-71: con movimiento reducido el avatar queda quieto", still.size === 1, JSON.stringify([...still]));
    await celebrate(t);
    await t.page.waitForTimeout(300);
    const smile = await sample(t, 800, 100);
    check("AC-71: y al completar una estación muestra un fotograma feliz fijo", smile.size === 1 && ![...smile].some((h) => still.has(h)), JSON.stringify({ still: [...still], smile: [...smile] }));
    await t.page.waitForTimeout(HAPPY_MS + 600);
    const back = await sample(t, 600, 100);
    check("AC-71: y después vuelve al fotograma de reposo", back.size === 1 && still.has([...back][0]), JSON.stringify({ still: [...still], back: [...back] }));
    await t.close();
  }

  // ---- La hoja no carga: se queda el avatar estático --------------------------------------------------------------
  {
    const t = await open({ blockUrl: "**/vanessa-jerry-avatar-idle-happy.png" });
    await t.page.locator(".pixel-button").dispatchEvent("click");
    await t.page.waitForTimeout(800);
    const dom = await t.page.evaluate(() => { const p = document.querySelector(".hud__portrait"); const img = p?.querySelector("img"); return { canvas: !!p?.querySelector("canvas"), imgHidden: img?.hidden, loaded: !!img?.complete && img.naturalWidth > 0, src: img?.getAttribute("src") }; });
    check("AC-71: si la hoja no carga, la cabecera conserva el avatar estático y el juego sigue", !dom.canvas && dom.imgHidden === false && dom.loaded && /vanessa-jerry-avatar\.png/.test(dom.src) && (await t.page.locator("canvas").count()) >= 1, JSON.stringify(dom));
    await t.close();
  }

  // ---- Encaje con la cabecera ----------------------------------------------------------------------------------------
  for (const [w, h] of [[1280, 720], [768, 1024], [390, 844], [320, 568]]) {
    const t = await open({ viewport: { width: w, height: h } });
    await t.start();
    await t.page.waitForTimeout(400);
    const r = await t.page.evaluate(() => {
      const hud = document.querySelector(".hud").getBoundingClientRect();
      const p = document.querySelector(".hud__portrait");
      const pr = p.getBoundingClientRect();
      const text = document.querySelector(".hud__main").getBoundingClientRect();
      return { shown: getComputedStyle(p).display !== "none", inside: pr.left >= hud.left && pr.right <= hud.right && pr.top >= hud.top && pr.bottom <= hud.bottom, overlapsText: pr.width > 0 && pr.right > text.left + 1, scroll: document.documentElement.scrollWidth > innerWidth };
    });
    check(`AC-71: a ${w}×${h} el avatar cabe en la cabecera sin pisar el texto${w <= 480 ? " (en estrecho se oculta, como antes)" : ""}`, !r.scroll && (w <= 480 ? !r.shown : r.shown && r.inside && !r.overlapsText), JSON.stringify(r));
    await t.close();
  }
} finally {
  await finish();
}
