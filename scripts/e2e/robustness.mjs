// E2E de robustez (SPEC 12.3, 13; AC-09, AC-20, AC-29): configuración o manifiesto rotos, assets que no cargan y
// almacenamiento no disponible, siempre sin perder el avance guardado. Uso: npm run test:e2e
import { configJson, harness, SPOT_A, stationSpot } from "./helpers.mjs";

const { open, check, finish } = await harness();
const L = configJson.ui.labels;
const KEY = `bitacora:progress:v3:${configJson.contentSetId}:demo`;
const SAVED = JSON.stringify({
  schemaVersion: 3, contentSetId: configJson.contentSetId, mode: "demo", currentZoneId: "zona-a", player: { x: 330, y: 990 }, checkpoints: {},
  entries: Object.fromEntries(configJson.route.map((id, i) => [id, i === 0
    ? { contentRevision: 1, readSectionIds: ["lived", "learning", "reflection", "classroom"], completedAt: "2026-09-30T10:00:00.000Z" }
    : { contentRevision: 1, readSectionIds: [] }])),
});
const seed = { [KEY]: SAVED };
const errorText = (t) => t.page.locator("[role=alert]").first().innerText();
const failed = { waitFor: "[role=alert]" };

try {
  // ---- Configuración inválida: error localizado, sin mundo parcial y sin tocar el avance ------------------
  const broken = [
    ["assetId inexistente en una ubicación", { edit: (c) => { c.placements["apr-c"].decorationAssetId = "station.item.no-existe"; } }, /station\.item\.no-existe/],
    ["referencia cruzada inválida (ubicación en una zona inexistente)", { edit: (c) => { c.placements["apr-b"].zoneId = "zona-fantasma"; } }, /zona-fantasma/],
    ["ID desconocido en la ruta", { edit: (c) => { c.route.push("apr-no-existe"); } }, /apr-no-existe/],
    ["metadata incompatible (un botón con el kind de otro asset)", { edit: (c) => { c.ui.assets.button = "station.sign.wooden"; } }, /station\.sign\.wooden/],
    ["manifiesto con assetCount incoherente", { editAssets: (m) => { m.assetCount += 3; } }, /assetCount/],
    ["manifiesto con categoryCounts incoherentes", { editAssets: (m) => { m.categoryCounts.ui += 4; } }, /categoryCounts/],
    ["metadata inválida en el manifiesto (nineSlice negativo)", { editAssets: (m) => { m.assets["ui.panel.cream.nine-slice"].nineSlice.top = -5; } }, /nineSlice|top/],
    ["hoja de poses sin frames inspeccionados (animación inexistente)", { edit: (c) => { c.gameplay.player.assetId = "character.vanessa-jerry.walk.poses-v4"; c.gameplay.player.animations = { walkUp: "animacion-fantasma" }; } }, /frame|animacion-fantasma|poses/i],
  ];
  for (const [name, options, pattern] of broken) {
    const t = await open({ ...options, ...failed, seed });
    const text = await errorText(t);
    check(`AC-29: ${name} → error con el elemento afectado`, pattern.test(text), text.slice(0, 200).replace(/\n/g, " "));
    check("   sin canvas ni mundo parcial, con «Reintentar»", (await t.page.locator("canvas:not(.hud__portrait canvas)").count()) === 0 && (await t.page.getByRole("button", { name: "Reintentar" }).count()) === 1);
    check("   el avance guardado no se ha modificado", (await t.stored())[KEY] === SAVED);
    check("   sin excepciones sin capturar", t.errors.filter((e) => e.startsWith("pageerror")).length === 0, t.errors.join(" | "));
    await t.close();
  }

  // «Reintentar» recupera cuando el problema se corrige
  {
    const t = await open({ ...{ edit: (c) => { c.placements["apr-c"].decorationAssetId = "station.item.no-existe"; } }, ...failed, seed });
    await t.page.unroute("**/config/bitacora.json");
    await t.page.getByRole("button", { name: "Reintentar" }).click();
    await t.page.waitForSelector(".cover");
    check("AC-20: «Reintentar» recarga la configuración corregida y llega a la portada con el avance intacto", (await t.page.getByText("Continuar recorrido").count()) === 1 && (await t.stored())[KEY] === SAVED);
    await t.close();
  }

  // ---- Un asset que no carga: diagnóstico con el ID y la lista accesible sigue disponible ------------------
  {
    const t = await open({ seed, editAssets: (m) => { m.assets["background.zone-01.terrain"].path = "backgrounds/zone-01/no-existe.png"; } });
    await t.start();
    const alertText = await t.page.locator(".asset-alert").innerText();
    check("AC-20: un path roto da un aviso con el ID del asset y la ruta resuelta", /background\.zone-01\.terrain/.test(alertText) && /no-existe\.png/.test(alertText), alertText.replace(/\n/g, " "));
    check("AC-20: el mundo sigue vivo con las demás capas y el avance no se pierde", (await t.page.locator("canvas:not(.hud__portrait canvas)").count()) === 1 && JSON.parse((await t.stored())[KEY]).entries["apr-a"].completedAt === "2026-09-30T10:00:00.000Z");
    await t.page.getByRole("button", { name: L.index }).click();
    await t.page.waitForTimeout(300);
    check("AC-20: la lista accesible sigue disponible y refleja el avance guardado", (await t.page.locator(".learning-list__state").first().innerText()) === L.stateCompleted);
    await t.close();
  }
  {
    const t = await open({ seed, blockUrl: "**/station-sign-wooden*.png" });
    await t.start();
    check("AC-20: un archivo ausente (404) de otro asset no tira la aplicación", (await t.page.locator("canvas:not(.hud__portrait canvas)").count()) === 1);
    await t.close();
  }

  // ---- Almacenamiento no disponible o dañado -------------------------------------------------------------
  {
    const init = () => {
      const boom = () => { throw new DOMException("bloqueado", "SecurityError"); };
      Object.defineProperty(window, "localStorage", { configurable: true, get: boom });
    };
    const t = await open({ init });
    await t.start();
    check("AC-09: con el almacenamiento bloqueado la aplicación arranca y avisa de que el avance no se guarda", (await t.page.locator("canvas:not(.hud__portrait canvas)").count()) === 1 && /no se está guardando/i.test(await t.page.locator(".hud").innerText()));
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(250);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(300);
    await t.page.click("text=Siguiente");
    await t.page.click("text=Marcar sección como leída");
    await t.page.waitForTimeout(200);
    check("AC-09: sigue funcionando en memoria (la sección queda marcada)", (await t.page.locator(".block-heading, .reading").count()) > 0 && /leída/i.test(await t.page.locator("[role=dialog]").innerText()));
    check("AC-09: sin excepciones sin capturar", t.errors.filter((e) => e.startsWith("pageerror")).length === 0, t.errors.join(" | "));
    await t.close();
  }
  {
    const t = await open({ seed: { [KEY]: "{esto no es json" } });
    await t.start();
    check("AC-09: un guardado corrupto no rompe la aplicación: se empieza de cero", (await t.page.locator("canvas:not(.hud__portrait canvas)").count()) === 1 && /0 de 6/.test(await t.page.locator(".hud").innerText()));
    await t.close();
  }
  {
    const t = await open({ seed: { [KEY]: JSON.stringify({ schemaVersion: 3, contentSetId: "otra-bitacora", mode: "demo", currentZoneId: "zona-a", player: { x: 1, y: 1 }, checkpoints: {}, entries: {} }) } });
    await t.start();
    check("AC-09: un guardado de otro contenido no se aplica", (await t.page.locator("canvas:not(.hud__portrait canvas)").count()) === 1 && /0 de 6/.test(await t.page.locator(".hud").innerText()));
    await t.close();
  }
  {
    // Cuota agotada al escribir: el avance sigue en memoria y se avisa
    const init = () => { Storage.prototype.setItem = () => { throw new DOMException("cuota", "QuotaExceededError"); }; };
    const t = await open({ init });
    await t.start();
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(250);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(300);
    await t.page.click("text=Siguiente");
    await t.page.click("text=Marcar sección como leída");
    await t.page.waitForTimeout(300);
    check("AC-09: con la cuota agotada no hay excepciones y se avisa de que el avance no se guarda", t.errors.filter((e) => e.startsWith("pageerror")).length === 0 && /no se está guardando/i.test(await t.page.locator(".hud").innerText()), t.errors.join(" | "));
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
