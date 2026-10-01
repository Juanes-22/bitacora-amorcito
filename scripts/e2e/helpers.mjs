// Arnés común de las pruebas E2E: servidor de Vite propio, navegador, páginas con la configuración editada
// solo para esa página y comprobaciones con resumen. Uso: const h = await harness(); ...; await h.finish().
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { createServer } from "vite";

export const configJson = JSON.parse(readFileSync("public/config/bitacora.json", "utf8"));
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export async function harness() {
  const failures = [];
  let total = 0;
  const check = (name, ok, detail = "") => {
    total++;
    if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`${ok ? "✔" : "✖"} ${name}${!ok && detail ? ` (${detail})` : ""}`);
  };
  const server = await createServer({ server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
  await server.listen();
  const base = server.resolvedUrls.local[0];
  const browser = await chromium.launch();

  /**
   * Abre la app y espera `waitFor`. `edit(config)` modifica bitacora.json solo para esta página;
   * `seed` escribe en localStorage antes de cargar (progreso previo); `init` es un script previo a la carga.
   */
  async function open({ viewport = { width: 1280, height: 720 }, query = "", edit, reducedMotion, blockUrl, waitFor = ".cover", seed, init, context } = {}) {
    const ctx = context ?? (await browser.newContext({ viewport, reducedMotion: reducedMotion ? "reduce" : "no-preference" }));
    const page = await ctx.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    if (init) await page.addInitScript(init);
    if (seed) await page.addInitScript((entries) => { for (const [k, v] of Object.entries(entries)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, seed);
    if (edit) {
      await page.route("**/config/bitacora.json", (route) => {
        const copy = structuredClone(configJson);
        edit(copy);
        route.fulfill({ contentType: "application/json", body: JSON.stringify(copy) });
      });
    }
    if (blockUrl) await page.route(blockUrl, (r) => r.fulfill({ status: 404, body: "" }));
    await page.goto(base + query);
    await page.waitForSelector(waitFor);
    await page.waitForTimeout(500);
    const api = {
      page, ctx, errors, base,
      start: async () => { await page.click(".pixel-button"); await page.waitForTimeout(700); },
      scene: () => page.evaluate(() => {
        const g = window.__PHASER_GAME__; const s = g.scene.getScene("ExplorationScene");
        return { pos: s.player.position, vel: [s.player.body.velocity.x, s.player.body.velocity.y], zone: s.zoneId, paused: g.scene.isPaused("ExplorationScene"), frame: s.player.sprite.frame.name };
      }),
      place: (x, y) => page.evaluate(([x, y]) => window.__PHASER_GAME__.scene.getScene("ExplorationScene").player.place({ x, y }), [x, y]),
      hold: async (keys, ms) => {
        for (const k of keys) await page.keyboard.down(k);
        const a = await api.scene(); await page.waitForTimeout(ms); const m = await api.scene();
        for (const k of keys) await page.keyboard.up(k);
        await page.waitForTimeout(80);
        return { a, m };
      },
      log: () => page.evaluate(() => window.__log.splice(0)),
      watch: () => page.evaluate(() => {
        window.__log = []; const br = window.__BITACORA_BRIDGE__;
        for (const e of ["game:ready", "game:nearby-changed", "game:learning-open-request", "game:portal-request", "app:request-resolved", "app:controls", "app:zone-change", "app:celebrate", "app:sync"]) br.on(e, (pl) => window.__log.push([e, pl]));
      }),
      stations: () => page.evaluate(() => [...window.__PHASER_GAME__.scene.getScene("ExplorationScene").world.stations.values()].map((s) => ({ id: s.learningId, number: s.number, state: s.currentState, interaction: s.interaction }))),
      /** Auditoría de accesibilidad con axe-core; devuelve las violaciones (id, impacto, nodos). */
      axe: async () => {
        await page.addScriptTag({ content: AXE });
        return page.evaluate(async () => {
          const r = await window.axe.run(document, { resultTypes: ["violations"] });
          return r.violations.map((v) => `${v.impact}:${v.id} → ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`);
        });
      },
      stored: () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
      close: () => ctx.close(),
    };
    return api;
  }

  async function finish() {
    await browser.close();
    await server.close();
    console.log(`\n${total - failures.length}/${total} comprobaciones correctas.`);
    if (failures.length) {
      console.error(`\nFALLARON ${failures.length}:\n- ${failures.join("\n- ")}`);
      process.exit(1);
    }
  }
  return { open, check, finish, browser };
}
