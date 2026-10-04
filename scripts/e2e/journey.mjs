// E2E de recorridos completos, variantes editoriales solo con JSON, modo final y reinicio (SPEC 4, 5, 10, 12, 13).
// Uso: npm run test:e2e
import { configJson, harness, SPOT_A, stationSpot } from "./helpers.mjs";

const { open, check, finish, browser } = await harness();

const KEY = (mode = "demo") => `bitacora:progress:v3:${configJson.contentSetId}:${mode}`;
const DONE = { contentRevision: 1, readSectionIds: ["learning", "reflection", "lived"], completedAt: "2026-09-30T10:00:00.000Z" };
const saved = ({ entries = {}, zone = "zona-a", player = { x: 200, y: 1030 }, mode = "demo", route = configJson.route } = {}) => ({
  [KEY(mode)]: JSON.stringify({
    schemaVersion: 3, contentSetId: configJson.contentSetId, mode, currentZoneId: zone, player, checkpoints: {},
    entries: Object.fromEntries(route.map((id) => [id, entries[id] ?? { contentRevision: 1, readSectionIds: [] }])),
  }),
});
const hud = (t) => t.page.locator(".hud").innerText().then((x) => x.replace(/\s+/g, " "));
const withEdit = (edit) => { const c = structuredClone(configJson); edit?.(c); return c; };
/** Puntos transitables junto a cada portal (los mismos que usa la E2E de exploración). */
const PORTAL_SPOT = { "a-b": [1380, 440], "b-a": [60, 440] };

/** Lleva a Vanessa hasta la estación (cruzando por el portal si está en otra zona) y la abre con Enter. */
async function goToStation(t, config, id) {
  const p = config.placements[id];
  const zone = (await t.scene()).zone;
  if (zone !== p.zoneId) {
    const portalId = Object.entries(config.maps[zone].portals).find(([, v]) => v.targetZoneId === p.zoneId)[0];
    await t.place(...PORTAL_SPOT[portalId]);
    await t.page.waitForTimeout(250);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(800);
  }
  await t.place(p.position.x + p.interactionOffset.x, p.position.y + p.interactionOffset.y);
  await t.page.waitForTimeout(250);
  await t.page.keyboard.press("Enter");
  await t.page.waitForTimeout(350);
}

/** Lectura completa de la estación abierta: apertura → tres secciones → recoger → cerrar la recompensa. */
async function readAndClaim(t) {
  await t.page.click("text=Siguiente");
  await t.page.waitForTimeout(200);
  for (let i = 0; i < 3; i++) {
    if (i > 0) await t.page.keyboard.press("ArrowRight");
    await t.page.click("text=Marcar sección como leída");
    await t.page.waitForTimeout(60);
  }
  await t.page.click("text=Recoger insignia y continuar");
  await t.page.waitForTimeout(650); // supera la guarda del «Cerrar» de la recompensa
  await t.page.click("[role=dialog] >> text=Cerrar");
  await t.page.waitForTimeout(150);
}

/** Recorre TODA la ruta de `config` por la interfaz y devuelve cuántos aprendizajes se completaron. */
async function playJourney(t, config) {
  for (const id of config.route) {
    await goToStation(t, config, id);
    await readAndClaim(t);
  }
}

try {
  // ---- J. Los seis aprendizajes de demostración, en orden y cruzando las dos zonas --------------------------
  {
    const t = await open();
    await t.start();
    await t.watch();
    const celebrations = [];
    for (const [i, id] of configJson.route.entries()) {
      await goToStation(t, configJson, id);
      const intro = await t.page.locator("[role=dialog]").innerText();
      if (id === "apr-d") {
        const onB = await t.stations();
        check("J1 al cruzar a la zona B tras el tercero, apr-d está disponible y apr-e y apr-f siguen bloqueadas", (await t.scene()).zone === "zona-b" && JSON.stringify(onB.map((s) => [s.id, s.number, s.state])) === JSON.stringify([["apr-d", 4, "available"], ["apr-e", 5, "locked"], ["apr-f", 6, "locked"]]), JSON.stringify(onB));
      }
      await readAndClaim(t);
      celebrations.push((await t.log()).filter((e) => e[0] === "app:celebrate").length);
      if (i < 5) {
        const h = await hud(t);
        check(`J${2 + i} aprendizaje ${i + 1}: «${i + 1} de 6», ${(i + 1) * 100} / 600 XP y se celebra una vez`, h.includes(`${i + 1} de 6 aprendizajes`) && h.includes(`${(i + 1) * 100} / 600 XP`) && celebrations.at(-1) === 1 && intro.includes("Lee cada sección"), `${h} | celebraciones ${celebrations.at(-1)}`);
      }
    }
    // el último: espera a que acabe la celebración y se abra el cierre
    await t.page.waitForSelector("[role=dialog]:has-text('¡Recorrido completo!')", { timeout: 6000 });
    const end = await t.page.locator("[role=dialog]").innerText();
    check("J7 al completar la ruta: «6 de 6 insignias · 600 / 600 XP · Nivel 6» y el cierre del recorrido", end.includes("6 de 6 insignias · 600 / 600 XP · Nivel 6") && end.includes("¡Recorrido completo!"), end.replace(/\s+/g, " ").slice(0, 160));
    check("J8 el cierre lista las seis insignias obtenidas y la de Jerry, con fecha, y el espacio de la reflexión final (aviso, sin inventar)", (await t.page.locator(".collection__item--earned").count()) === 7 && (await t.page.locator("[data-route-badge].collection__item--earned").count()) === 1 && end.includes("Obtenida el") && end.includes("Reflexión final") && end.includes("La reflexión final de Vanessa se añadirá aquí"));
    const stored = JSON.parse((await t.stored())[KEY()]);
    check("J9 se guardaron seis finalizaciones y ningún total ni XP", Object.values(stored.entries).filter((e) => e.completedAt).length === 6 && !/xp|total|level|nextLearning/i.test(JSON.stringify(stored)));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(400);
    check("J10 cerrada la ventana, la cabecera dice «6 de 6 aprendizajes» y el mapa se reanuda", (await hud(t)).includes("6 de 6 aprendizajes") && !(await t.scene()).paused && (await t.page.evaluate(() => document.activeElement?.classList.contains("game-host"))));
    check("J11 todas las estaciones de la zona quedan completadas", (await t.stations()).every((s) => s.state === "completed"));

    // colección desde la cabecera, y reinicio con confirmación
    await t.page.getByRole("button", { name: "Insignias" }).click();
    await t.page.waitForTimeout(300);
    check("J12 «Insignias» abre la colección y pausa el mapa", (await t.page.locator("[role=dialog]").innerText()).includes("6 de 6 insignias") && (await t.scene()).paused);
    await t.page.click("text=Reiniciar recorrido");
    await t.page.waitForTimeout(250);
    check("J13 el reinicio pide confirmación (alertdialog) con el foco en «Cancelar»", (await t.page.locator("[role=alertdialog]").count()) === 1 && (await t.page.evaluate(() => document.activeElement?.textContent)) === "Cancelar");
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    check("J14 cancelar no borra nada y vuelve a la colección", (await t.page.locator("[role=alertdialog]").count()) === 0 && (await t.page.locator("[role=dialog]").innerText()).includes("6 de 6 insignias") && JSON.parse((await t.stored())[KEY()]).entries["apr-a"].completedAt !== undefined);
    await t.page.click("text=Reiniciar recorrido");
    await t.page.waitForTimeout(250);
    await t.page.click("text=Sí, reiniciar");
    await t.page.waitForTimeout(1200);
    const afterReset = await t.scene();
    const keptStored = JSON.parse((await t.stored())[KEY()] ?? '{"entries":{}}');
    check("J15 confirmar reinicia: sin insignias, vuelve al inicio, estaciones reiniciadas y controles libres", (await hud(t)).includes("0 de 6 aprendizajes") && afterReset.zone === "zona-a" && Math.hypot(afterReset.pos.x - 200, afterReset.pos.y - 1030) < 1 && !afterReset.paused && Object.values(keptStored.entries).every((e) => !e.completedAt) && JSON.stringify((await t.stations()).map((s) => s.state)) === JSON.stringify(["available", "locked", "locked"]), JSON.stringify({ hud: await hud(t), afterReset }));
    await t.page.reload();
    await t.page.waitForSelector(".cover");
    check("J16 tras reiniciar y recargar la portada vuelve a «Comenzar recorrido»", (await t.page.locator(".pixel-button").innerText()) === "Comenzar recorrido");
    check("J17 sin errores de consola en todo el recorrido", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- K. Variantes de cinco y siete aprendizajes: SOLO se edita el JSON (AC-23, AC-24) --------------------
  {
    const five = withEdit((c) => { c.route = c.route.filter((id) => id !== "apr-f"); });
    const t5 = await open({ edit: (c) => { c.route = c.route.filter((id) => id !== "apr-f"); } });
    await t5.start();
    await playJourney(t5, five);
    const zoneB = await t5.stations();
    check("K1 con cinco aprendizajes el mapa de la zona B solo tiene dos estaciones (apr-f archivada no aparece)", JSON.stringify(zoneB.map((s) => s.id)) === JSON.stringify(["apr-d", "apr-e"]), JSON.stringify(zoneB.map((s) => s.id)));
    await t5.page.waitForSelector("[role=dialog]:has-text('¡Recorrido completo!')", { timeout: 6000 });
    const end5 = await t5.page.locator("[role=dialog]").innerText();
    check("K2 cinco aprendizajes: «5 de 5 insignias · 500 / 500 XP», sin tocar el código", end5.includes("5 de 5 insignias · 500 / 500 XP · Nivel 5") && (await t5.page.locator(".collection__item:not([data-route-badge])").count()) === 5);
    const zoneB5 = await t5.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").zoneId);
    check("K3 el progreso de cinco no guarda nada de la sexta (archivada, sin avance)", JSON.parse((await t5.stored())[KEY()]).entries["apr-f"]?.completedAt === undefined && zoneB5 === "zona-b");
    await t5.close();

    // siete: la nueva estación se inserta en medio de la ruta y vive en la zona A, así el recorrido cruza zonas en otro orden
    const edit7 = (c) => {
      c.learnings["apr-g"] = structuredClone(c.learnings["apr-f"]);
      c.learnings["apr-g"].badgeId = "insignia-demo-g";
      c.badges["insignia-demo-g"] = structuredClone(c.badges["detenerse-a-descubrir"]);
      c.placements["apr-g"] = { zoneId: "zona-a", position: { x: 1330, y: 420 }, interactionOffset: { x: 0, y: 30 }, interactionRadius: 70 };
      c.route.splice(3, 0, "apr-g"); // a, b, c, g, d, e, f
    };
    const seven = withEdit(edit7);
    const t7 = await open({ edit: edit7 });
    await t7.start();
    await playJourney(t7, seven);
    await t7.page.waitForSelector("[role=dialog]:has-text('¡Recorrido completo!')", { timeout: 6000 });
    const end7 = await t7.page.locator("[role=dialog]").innerText();
    check("K4 siete aprendizajes con uno insertado en medio y en otra zona: «7 de 7 insignias · 700 / 700 XP»", end7.includes("7 de 7 insignias · 700 / 700 XP · Nivel 7") && (await t7.page.locator(".collection__item:not([data-route-badge])").count()) === 7);
    const order = await t7.page.locator(".collection__item:not([data-route-badge]) .collection__where").allInnerTexts();
    check("K5 la numeración sale de route: apr-g es el aprendizaje 4 y los siguientes se renumeran", order[3].startsWith("Aprendizaje 4:") && order.length === 7, order.join(" | "));
    check("K6 sin errores de consola en las variantes", t5.errors.length === 0 && t7.errors.length === 0, [...t5.errors, ...t7.errors].join(" | "));
    await t7.close();
  }

  // ---- L. Archivar, reactivar, reordenar y revisar con progreso previo (AC-25 a AC-28) ----------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const seed = saved({ entries: { "apr-a": DONE, "apr-b": DONE } });
    const archived = await open({ context: ctx, seed, edit: (c) => { c.route = c.route.filter((id) => id !== "apr-b"); } });
    await archived.start();
    const stations = await archived.stations();
    check("L1 archivar apr-b la retira del mapa, de los totales (1 de 5, 100 / 500 XP) y de los requisitos (apr-c queda disponible)", JSON.stringify(stations.map((s) => [s.id, s.number, s.state])) === JSON.stringify([["apr-a", 1, "completed"], ["apr-c", 2, "available"]]) && (await hud(archived)).includes("1 de 5 aprendizajes") && (await hud(archived)).includes("100 / 500 XP"), JSON.stringify(stations));
    await archived.place(...SPOT_A);
    await archived.hold(["ArrowUp"], 400); // genera un guardado con la configuración archivada
    await archived.page.waitForTimeout(1700);
    await archived.page.close();

    const reactivated = await open({ context: ctx });
    await reactivated.start();
    check("L2 reactivar el mismo ID recupera su avance vigente (2 de 6, 200 / 600 XP)", (await hud(reactivated)).includes("2 de 6 aprendizajes") && (await hud(reactivated)).includes("200 / 600 XP") && JSON.parse((await reactivated.stored())[KEY()]).entries["apr-b"].completedAt === DONE.completedAt);
    await ctx.close();

    const reordered = await open({ seed: saved({ entries: { "apr-a": DONE } }), edit: (c) => { c.route = ["apr-b", "apr-a", "apr-c", "apr-d", "apr-e", "apr-f"]; } });
    await reordered.start();
    const r = (await reordered.stations()).sort((x, y) => x.number - y.number).map((s) => [s.id, s.number, s.state]);
    check("L3 reordenar route con progreso: lo completado se conserva por ID y los pendientes se recalculan", JSON.stringify(r) === JSON.stringify([["apr-b", 1, "available"], ["apr-a", 2, "completed"], ["apr-c", 3, "locked"]]), JSON.stringify(r));
    await reordered.close();

    const revised = await open({ seed: saved({ entries: { "apr-a": DONE, "apr-b": DONE } }), edit: (c) => { c.learnings["apr-a"].contentRevision = 2; } });
    await revised.start();
    check("L4 una revisión sustancial invalida solo ese aprendizaje (1 de 6)", (await hud(revised)).includes("1 de 6 aprendizajes") && (await hud(revised)).includes("100 / 600 XP"));
    await goToStation(revised, withEdit((c) => { c.learnings["apr-a"].contentRevision = 2; }), "apr-a");
    await readAndClaim(revised);
    check("L5 releer y recoger de nuevo lo revisado cuenta una sola vez: 2 de 6 y 200 / 600 XP (no 300)", (await hud(revised)).includes("2 de 6 aprendizajes") && (await hud(revised)).includes("200 / 600 XP"), await hud(revised));
    await revised.close();

    const badgeChange = await open({ seed: saved({ entries: { "apr-a": DONE } }), edit: (c) => { c.badges["curiosidad-que-florece"].xp = 300; c.badges["curiosidad-que-florece"].title = "Nombre nuevo"; c.badges["curiosidad-que-florece"].assetId = "station.item.books"; } });
    await badgeChange.start();
    await badgeChange.watch();
    await badgeChange.page.waitForTimeout(800);
    check("L6 cambiar el nombre, la imagen y la XP de una insignia recalcula totales (300 / 800) sin celebrar ni conceder otra", (await hud(badgeChange)).includes("300 / 800 XP") && (await badgeChange.log()).filter((e) => e[0] === "app:celebrate").length === 0);
    await badgeChange.close();
  }

  // ---- M. Modo final: contenido sin aprobar, separación del progreso y recorrido aprobado (AC-13) ---------
  {
    const t = await open({ edit: (c) => { c.mode = "final"; } });
    check("M1 en final la portada identifica el recorrido «en preparación»", (await t.page.locator(".cover").innerText()).includes("Recorrido en preparación: faltan 6 por aprobar"));
    await t.start();
    const tags = await t.page.evaluate(() => [...window.__PHASER_GAME__.scene.getScene("ExplorationScene").world.stations.values()].map((s) => s.pendingTag?.visible === true));
    check("M2 cada estación activa sin aprobar se marca como pendiente en el mapa (no se elimina de la secuencia)", tags.length === 3 && tags.every(Boolean) && (await t.stations()).length === 3, JSON.stringify(tags));
    check("M3 la cabecera dice «en preparación» y no propone un siguiente aprendizaje", (await hud(t)).includes("Recorrido en preparación: faltan 6 por aprobar") && !(await hud(t)).includes("Continúa en Aprendizaje"));
    await goToStation(t, configJson, "apr-a");
    const msg = await t.page.locator("[role=dialog]").innerText();
    check("M4 abrir un contenido sin aprobar solo muestra «Pendiente de revisión», sin pestañas ni lectura", msg.includes("Pendiente de revisión") && (await t.page.locator("[role=tab]").count()) === 0 && !msg.includes("Durante una exploración"));
    await t.close();

    const approved = (c) => { c.mode = "final"; for (const id of c.route) c.learnings[id].editorialStatus = "ready"; };
    const ok = await open({ edit: approved, seed: saved({ entries: { "apr-a": DONE }, mode: "demo" }) });
    await ok.start();
    check("M5 con todo aprobado el modo final se recorre normalmente y NO hereda el progreso de demostración (0 de 6, sin «preparación»)", (await hud(ok)).includes("0 de 6 aprendizajes") && !(await hud(ok)).includes("preparación"));
    await goToStation(ok, withEdit(approved), "apr-a");
    await readAndClaim(ok);
    const keys = Object.keys(await ok.stored());
    check("M6 en final el avance se guarda bajo su propia clave y el de demostración no se toca", keys.includes(KEY("final")) && JSON.parse((await ok.stored())[KEY("demo")]).entries["apr-a"].completedAt === DONE.completedAt && JSON.parse((await ok.stored())[KEY("final")]).entries["apr-a"].completedAt !== DONE.completedAt && !(await ok.page.locator(".cover__demo").count()));
    check("M7 sin errores de consola", ok.errors.length === 0, ok.errors.join(" | "));
    await ok.close();
  }
  // ---- N. Ruta vacía: preparación, nunca una celebración por cero aprendizajes (AC-30) -------------------------
  {
    const t = await open({ edit: (c) => { c.route = []; } });
    await t.start();
    await t.watch();
    await t.page.waitForTimeout(800);
    check("N1 con la ruta vacía no hay estaciones y la cabecera dice «0 de 0 aprendizajes»", (await t.stations()).length === 0 && (await hud(t)).includes("0 de 0 aprendizajes"));
    await t.page.getByRole("button", { name: "Insignias" }).click();
    await t.page.waitForTimeout(300);
    const dlg = await t.page.locator("[role=dialog]").innerText();
    check("N2 la colección lo explica y no presenta un cierre ni reflexión final", dlg.includes("Contenido por definir") && !dlg.includes("¡Recorrido completo!") && !dlg.includes("Reflexión final"));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(3800);
    check("N3 pasados unos segundos sigue sin celebrar ni abrir ningún cierre", (await t.page.locator("[role=dialog]").count()) === 0 && (await t.log()).filter((e) => e[0] === "app:celebrate").length === 0 && t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
