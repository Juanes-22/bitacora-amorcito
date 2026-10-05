// Arnés común de las pruebas E2E: servidor de Vite propio, navegador, páginas con la configuración editada
// solo para esa página y comprobaciones con resumen. Uso: const h = await harness(); ...; await h.finish().
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { createServer } from "vite";

// La configuración vive en dos archivos: bitacora.json (contenido) y maps.json (mapas y colocaciones de las estaciones). Aquí se une en un
// solo objeto, como la ve el juego; `open({ edit })` la edita así y la sirve de nuevo separada en los dos archivos.
const mapsFileJson = JSON.parse(readFileSync("public/config/maps.json", "utf8"));
export const configJson = { ...JSON.parse(readFileSync("public/config/bitacora.json", "utf8")), placements: mapsFileJson.placements, maps: mapsFileJson.maps };
const splitConfig = ({ placements, maps, ...content }) => ({ content, mapsFile: { placements, maps } });
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

/** El punto de interacción de una estación (su posición más su desplazamiento): dónde se está «junto a ella». */
export const stationSpot = (id) => {
  const pl = configJson.placements[id];
  return [pl.position.x + pl.interactionOffset.x, pl.position.y + pl.interactionOffset.y];
};
export const SPOT_A = stationSpot("apr-a");
/** Puntos transitables junto a cada portal, para cruzar de una zona a la otra con Enter. */
export const PORTAL_SPOT = { "a-b": [1380, 440], "b-a": [60, 440] };

/** El botón de la portada: «Comenzar/Continuar recorrido» de la presentación con su kit o el botón verde de la portada sencilla. */
export const START = ".cover .prs-continue, .cover .pixel-button";
/** Su texto, sin la flecha decorativa de la presentación. */
export const startLabel = async (page) => (await page.locator(START).innerText()).replace(/\s*›\s*$/, "").trim();

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * `root`: otra carpeta de proyecto que servir (una copia temporal, ver `workspace.mjs`) en lugar de la del repositorio. Con ella las
 * pruebas pueden GUARDAR (laboratorio de sonidos, importaciones) sin tocar los archivos reales.
 */
export async function harness({ root } = {}) {
  const failures = [];
  let total = 0;
  const check = (name, ok, detail = "") => {
    total++;
    if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`${ok ? "✔" : "✖"} ${name}${!ok && detail ? ` (${detail})` : ""}`);
  };
  // Las pruebas no deben importar mapas de Tiled por su cuenta (lo prueba tiled.mjs aparte).
  process.env.TILED_WATCH = "0";
  const server = await createServer(
    root
      ? { root, configFile: join(root, "vite.config.ts"), server: { port: 0, host: "127.0.0.1", fs: { strict: false } }, logLevel: "error" }
      : { server: { port: 0, host: "127.0.0.1" }, logLevel: "error" },
  );
  await server.listen();
  const base = server.resolvedUrls.local[0];
  const browser = await chromium.launch();

  /**
   * Abre la app y espera `waitFor`. `edit(config)` modifica la configuración (bitacora.json y maps.json unidos) y `editAssets(manifest)` assets.json solo para esta página;
   * `seed` escribe en localStorage antes de cargar (progreso previo); `init` es un script previo a la carga.
   */
  async function open({ viewport = { width: 1280, height: 720 }, query = "", edit, editAssets, reducedMotion, blockUrl, waitFor = ".cover", seed, init, context } = {}) {
    const ctx = context ?? (await browser.newContext({ viewport, reducedMotion: reducedMotion ? "reduce" : "no-preference" }));
    const page = await ctx.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    if (init) await page.addInitScript(init);
    if (seed) await page.addInitScript((entries) => { for (const [k, v] of Object.entries(entries)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, seed);
    if (edit) {
      const serve = (part) => (route) => {
        const copy = structuredClone(configJson);
        edit(copy);
        const { content, mapsFile } = splitConfig(copy);
        route.fulfill({ contentType: "application/json", body: JSON.stringify(part === "maps" ? mapsFile : content) });
      };
      await page.route("**/config/bitacora.json", serve("content"));
      await page.route("**/config/maps.json", serve("maps"));
    }
    if (editAssets) {
      // Igual que `edit`, pero para assets.json (manifiesto roto o incoherente solo para esta página).
      const manifest = JSON.parse(readFileSync("public/assets/assets.json", "utf8"));
      await page.route("**/assets/assets.json", (route) => {
        const copy = structuredClone(manifest);
        editAssets(copy);
        route.fulfill({ contentType: "application/json", body: JSON.stringify(copy) });
      });
    }
    if (blockUrl) await page.route(blockUrl, (r) => r.fulfill({ status: 404, body: "" }));
    await page.goto(base + query);
    await page.waitForSelector(waitFor);
    await page.waitForTimeout(500);
    const api = {
      page, ctx, errors, base,
      // Empieza y espera a que terminen todas las etapas de carga (esenciales, paisaje vivo y extras; ver SPEC 11.4).
      start: async () => {
        // `dispatchEvent`: el aviso de un recurso que falla puede quedar encima de la portada y un clic del ratón no llegaría al botón.
        await page.locator(START).dispatchEvent("click");
        await page.waitForTimeout(700);
        await page.waitForFunction(() => window.__PHASER_GAME__?.scene.getScene("ExplorationScene")?.fullyLoaded === true, null, { timeout: 20000 }).catch(() => undefined);
      },
      /** Pasa la ventana de apertura de un aprendizaje si la hay (con la Bitácora de aprendizajes se entra directo a la lectura). */
      skipIntro: async () => {
        const next = page.getByRole("button", { name: "Siguiente", exact: true });
        if (await next.count()) await next.click();
      },
      /** Lleva a Vanessa al punto de interacción de la estación `id`, cruzando por el portal si está en otra zona. */
      travelTo: async (id) => {
        const pl = configJson.placements[id];
        const zone = (await api.scene()).zone;
        if (zone !== pl.zoneId) {
          const portalId = Object.entries(configJson.maps[zone].portals).find(([, v]) => v.targetZoneId === pl.zoneId)[0];
          await api.place(...PORTAL_SPOT[portalId]);
          await page.waitForTimeout(250);
          await page.keyboard.press("Enter");
          await page.waitForTimeout(800);
        }
        await api.place(...stationSpot(id));
      },
      /**
       * Abre desde la Bitácora el aprendizaje `id` (sin completar): un aprendizaje así solo se explora junto a su estación, así que primero
       * pone a Vanessa en su punto de interacción. Con la lectura sencilla pasa además la ventana de apertura.
       */
      exploreFromIndex: async (id) => {
        await api.travelTo(id);
        await page.waitForTimeout(400);
        await page.getByRole("button", { name: configJson.ui.labels.index }).click();
        await page.waitForTimeout(250);
        await page.getByRole("button", { name: new RegExp(`${configJson.ui.labels.explore}: Aprendizaje ${configJson.route.indexOf(id) + 1}:`) }).click();
        await page.waitForTimeout(250);
        await api.skipIntro();
      },
      /** Marca la sección que se lee del aprendizaje abierto, con la lectura que haya (la de la Bitácora de aprendizajes o la sencilla). */
      markSection: async () => {
        if (await page.locator(".jp-dialog--reader").count()) await page.getByRole("button", { name: "Marcar como leído y continuar" }).click();
        else await page.click("text=Marcar sección como leída");
      },
      /** Marca las tres secciones del aprendizaje abierto y recoge su insignia (SPEC 8), con la lectura que haya. */
      readAndClaim: async () => {
        const kit = (await page.locator(".jp-dialog--reader").count()) > 0;
        for (let s = 0; s < 3; s++) {
          await api.markSection();
          await page.waitForTimeout(80);
          if (!kit && s < 2) await page.getByRole("tab").nth(s + 1).click();
        }
        await page.getByRole("button", { name: /Recoger insignia/ }).click();
      },
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
