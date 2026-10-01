// Capturas de revisión visual de ambas zonas en varios tamaños. Herramienta manual, fuera del build y de las pruebas.
// Uso: [TOUCH=1] node scripts/tools/screenshots.mjs DIRECTORIO_DE_SALIDA [ANCHOxALTO,ANCHOxALTO…]
import { mkdirSync } from "node:fs";
import { harness } from "../e2e/helpers.mjs";

const out = process.argv[2];
if (!out) throw new Error("Indica el directorio de salida");
mkdirSync(out, { recursive: true });
const { open, finish, browser } = await harness();
const TOUCH = process.env.TOUCH === "1"; // TOUCH=1: dispositivo táctil (puntero grueso), como un teléfono
const SIZES = (process.argv[3] ?? "390x844,1280x720,2177x1385,3840x2160").split(",").map((v) => v.split("x").map(Number));

try {
  for (const [w, h] of SIZES) {
    const t = await open({ viewport: { width: w, height: h }, ...(TOUCH ? { context: await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true }) } : {}) });
    await t.start();
    for (const [zone, spot] of [["zona-a", [1000, 880]], ["zona-b", [330, 780]]]) {
      if ((await t.scene()).zone !== zone) {
        await t.place(...(zone === "zona-b" ? [1380, 440] : [60, 440]));
        await t.page.waitForTimeout(200);
        await t.page.keyboard.press("Enter");
        await t.page.waitForTimeout(700);
      }
      await t.place(...spot);
      await t.page.waitForTimeout(2500);
      await t.page.screenshot({ path: `${out}/${zone}-${w}x${h}.png` });
    }
    await t.close();
  }
} finally {
  await finish();
}
