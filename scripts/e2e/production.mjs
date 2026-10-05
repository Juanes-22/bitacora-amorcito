// E2E de la compilación de producción (`dist`, tras `npm run build`): los efectos de sonido funcionan y el laboratorio de sonidos y sus
// rutas de escritura NO existen (SPEC 6.5, AC-95). Sirve `dist` con `vite preview` y no toca el repositorio.
// Uso: npm run build && node scripts/e2e/production.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { preview } from "vite";

if (!existsSync("dist/index.html")) {
  console.log("OMITIDO: no hay `dist`; ejecuta `npm run build` y vuelve a lanzar esta prueba. (No cuenta como superada.)");
  process.exit(0);
}
const failures = [];
let total = 0;
const check = (name, ok, detail = "") => {
  total++;
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "✔" : "✖"} ${name}${!ok && detail ? ` (${detail})` : ""}`);
};

const server = await preview({ preview: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
try {
  // ---- El código publicado -------------------------------------------------------------------------------
  const bundleDir = join("dist", "bundle");
  const files = readdirSync(bundleDir);
  const text = files.map((f) => readFileSync(join(bundleDir, f), "utf8")).join("\n");
  check("PROD-1: el build no incluye ningún fragmento del laboratorio (un único JS y un CSS)", files.filter((f) => f.endsWith(".js")).length === 1 && !files.some((f) => /lab/i.test(f)), files.join(", "));
  check("PROD-2: ni sus textos, ni sus rutas de guardado, ni su cabecera, ni la inspección de desarrollo", !/__audio-lab|x-audio-lab|Laboratorio de sonidos|AudioLabHost|__BITACORA_SFX__|audioLab=1/.test(text));

  // ---- El servidor no tiene las rutas de escritura ---------------------------------------------------------
  const state = await fetch(`${base}__audio-lab/state`, { headers: { "x-audio-lab": "1" } });
  const save = await fetch(`${base}__audio-lab/save`, { method: "POST", headers: { "x-audio-lab": "1", "content-type": "application/json" }, body: "{}" });
  check("PROD-3: /__audio-lab/state no devuelve JSON del laboratorio y /__audio-lab/save no guarda", !(state.headers.get("content-type") ?? "").includes("json") && save.status >= 400);

  // ---- La página -----------------------------------------------------------------------------------------
  const requests = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(`${base}?audioLab=1`);
  await page.waitForSelector(".cover");
  await page.waitForTimeout(800);
  check("PROD-4: con ?audioLab=1 no hay botón «Sonidos» ni panel", (await page.getByRole("button", { name: /^Sonidos/ }).count()) === 0 && (await page.locator("[data-testid=audio-lab]").count()) === 0);
  // Los sonidos de la zona activa pueden precargarse detrás de la portada (no suenan); los efectos de interfaz se cargan con el gesto.
  check("PROD-5: antes de «Comenzar» no se piden los efectos de interfaz", !requests.some((u) => /test-(ui-open|ui-confirm|badge|portal)\.wav/.test(u)));
  await page.locator(".cover .prs-continue, .cover .pixel-button").dispatchEvent("click");
  await page.waitForTimeout(3500);
  const sfx = [...new Set(requests.filter((u) => /\/audio\/sfx\//.test(u)).map((u) => u.split("/").pop()))].sort();
  check("PROD-6: tras «Comenzar» se cargan los efectos de interfaz y los sonidos de la zona activa (y no los de la otra)", ["test-badge.wav", "test-birds.wav", "test-portal.wav", "test-river.wav", "test-ui-confirm.wav", "test-ui-open.wav"].every((f) => sfx.includes(f)) && !sfx.includes("test-wind.wav"), sfx.join(", "));
  const button = page.locator(".hud__music");
  check("PROD-7: el botón «Sonido» está en la cabecera, con etiqueta y ≥ 44 px", (await button.count()) === 1 && (await button.getAttribute("aria-label")) === "Silenciar sonido" && (await button.boundingBox()).width >= 43.5);
  check("PROD-8: sin errores en la consola", errors.length === 0, errors.join(" | "));
  await ctx.close();
} catch (e) {
  check(`excepción no controlada: ${String(e?.stack ?? e).split("\n").slice(0, 2).join(" ")}`, false);
} finally {
  await browser.close();
  await server.close();
  console.log(`\n${total - failures.length}/${total} comprobaciones correctas.`);
  if (failures.length) {
    console.error(`\nFALLARON ${failures.length}:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
}
