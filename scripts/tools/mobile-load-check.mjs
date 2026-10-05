// Herramienta manual: simula un celular con una conexión limitada y mide cuánto tarda en aparecer el mapa (la barra de carga
// desaparece) y en cargar las imágenes de la interfaz. Uso: node scripts/tools/mobile-load-check.mjs [URL] [Mbps]
// Capturas en /tmp/slow-<Mbps>mbps-*.png. Con el sitio publicado antes de la carga por etapas no hay barra: mide solo las imágenes.
import { chromium } from "playwright";

const URL = process.argv[2] ?? "http://localhost:4173/";
const mbps = Number(process.argv[3] ?? 8);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: (2 * 1e6) / 8 });
let bytes = 0;
cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; });
const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".pixel-button", { timeout: 120000 });
console.log(`cubierta lista a los ${((Date.now() - t0) / 1000).toFixed(1)} s (${(bytes / 1e6).toFixed(1)} MB)`);
await page.click(".pixel-button");
const tStart = Date.now();
let mapAt = null, uiAt = null;
for (let i = 0; i < 400 && (mapAt === null || uiAt === null); i++) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({
    loading: !!document.querySelector(".map-loading"),
    pct: document.querySelector(".map-loading [role=progressbar]")?.getAttribute("aria-valuenow") ?? null,
    imgs: [...document.querySelectorAll(".hud img, .hud__tools img, .hud-panel img")].filter((i) => i.complete && i.naturalWidth).length,
    hud: !!document.querySelector(".hud"),
    ready: window.__PHASER_GAME__?.scene?.getScene?.("ExplorationScene")?.fullyLoaded,
  }));
  const t = (Date.now() - tStart) / 1000;
  if (i % 10 === 0) console.log(`  +${t.toFixed(0)} s  barra=${s.loading ? `${s.pct}%` : "no"}  MB=${(bytes / 1e6).toFixed(1)}`);
  if (i === 20) await page.screenshot({ path: `/tmp/slow-${mbps}mbps-10s.png` });
  if (mapAt === null && !s.loading) { mapAt = t; await page.screenshot({ path: `/tmp/slow-${mbps}mbps-map.png` }); }
  if (uiAt === null && s.hud && !s.loading) uiAt = t;
}
console.log(`mapa visible tras ${mapAt?.toFixed(1) ?? "—"} s desde «Comenzar» (${(bytes / 1e6).toFixed(1)} MB descargados hasta entonces)`);
await browser.close();
