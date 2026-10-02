// E2E de lectura, recompensa, persistencia y casos límite (SPEC 7, 8, 9 y 13) en un navegador real.
// Uso: npm run test:e2e
import { configJson, dist, harness } from "./helpers.mjs";

const { open, check, finish } = await harness();

const KEY = (mode = "demo") => `bitacora:progress:v3:${configJson.contentSetId}:${mode}`;
const DONE = { contentRevision: 1, readSectionIds: ["lived", "learning", "reflection", "classroom"], completedAt: "2026-09-30T10:00:00.000Z" };
/** Guardado v3 válido para sembrar localStorage antes de cargar la página. */
const saved = ({ entries = {}, zone = "zona-a", player = { x: 200, y: 1030 }, mode = "demo" } = {}) => ({
  [KEY(mode)]: JSON.stringify({
    schemaVersion: 3, contentSetId: configJson.contentSetId, mode, currentZoneId: zone, player, checkpoints: {},
    entries: Object.fromEntries(configJson.route.map((id) => [id, entries[id] ?? { contentRevision: 1, readSectionIds: [] }])),
  }),
});
const sectionText = (id, section) => configJson.learnings[id].sections[section][0].text;
const hud = (t) => t.page.locator(".hud").innerText().then((x) => x.replace(/\s+/g, " "));
const openStation1 = async (t) => { await t.place(330, 990); await t.page.waitForTimeout(250); await t.page.keyboard.press("Enter"); await t.page.waitForTimeout(350); };

try {
  // ---- A. Flujo principal: abrir → leer → marcar → recoger → celebrar → recargar --------------------------
  {
    const t = await open();
    await t.start();
    await t.watch();
    await openStation1(t);
    const dialog = t.page.locator("[role=dialog]");
    check("A1 la apertura se muestra con el foco en «Siguiente»", (await dialog.innerText()).includes("Lee cada sección") && (await t.page.evaluate(() => document.activeElement?.textContent)) === "Siguiente");
    await t.page.click("text=Siguiente");
    await t.page.waitForTimeout(250);
    check("A2 la lectura muestra exactamente las cuatro pestañas en orden", JSON.stringify(await t.page.locator("[role=tab]").allInnerTexts()) === JSON.stringify(["Lo vivido", "Aprendizajes", "Reflexión", "En el aula"]));
    check("A3 el contenido sale de bitacora.json (primera sección)", (await t.page.locator("[role=tabpanel]").innerText()).includes(sectionText("apr-a", "lived")));
    const before = await t.scene();
    await t.page.keyboard.press("ArrowRight");
    await t.page.waitForTimeout(200);
    check("A4 las flechas cambian de pestaña sin mover al personaje", (await t.page.locator("[role=tab][aria-selected=true]").innerText()).startsWith("Aprendizajes") && dist(before.pos, (await t.scene()).pos) === 0 && (await t.page.locator("[role=tabpanel]").innerText()).includes(sectionText("apr-a", "learning")));
    check("A5 abrir y cambiar de pestaña no marca nada ni concede la insignia", !Object.values(JSON.parse((await t.stored())[KEY()] ?? "{\"entries\":{}}").entries).some((e) => e.readSectionIds.length || e.completedAt));
    const claim = t.page.locator("text=Recoger insignia y continuar");
    check("A6 «Recoger insignia» está deshabilitada y dice cuántas secciones faltan", (await claim.isDisabled()) && (await t.page.locator(".reading__remaining").innerText()) === "Faltan 4 por marcar");

    await t.page.click("[role=tab]:has-text('Lo vivido')");
    for (let i = 0; i < 4; i++) {
      if (i > 0) await t.page.keyboard.press("ArrowRight");
      await t.page.click("text=Marcar sección como leída");
      await t.page.waitForTimeout(80);
    }
    check("A7 cada pestaña marcada lo indica con texto", (await t.page.locator("[role=tab]").allInnerTexts()).every((x) => x.includes("Sección leída")));
    check("A8 con las cuatro marcadas se habilita «Recoger insignia»", !(await claim.isDisabled()));
    await t.log();
    await t.page.dblclick("text=Recoger insignia y continuar");
    await t.page.waitForTimeout(500);
    const reward = await dialog.innerText();
    check("A9 un doble clic concede una sola insignia y muestra la recompensa (sin cerrarla)", reward.includes("¡Aprendizaje recorrido!") && reward.includes("Semilla de descubrimiento") && reward.includes("100 / 600 XP · Nivel 1") && (await t.page.locator("[role=dialog]").count()) === 1);
    const stored = JSON.parse((await t.stored())[KEY()]);
    check("A10 se guardó una sola finalización con fecha, sin totales ni XP", Object.values(stored.entries).filter((e) => e.completedAt).length === 1 && /^\d{4}-\d\d-\d\dT/.test(stored.entries["apr-a"].completedAt) && !/xp|total|level|nextLearning/i.test(JSON.stringify(stored)));
    check("A11 la celebración aún no se dispara con la ventana abierta", (await t.log()).filter((e) => e[0] === "app:celebrate").length === 0);

    await t.page.waitForTimeout(500);
    await t.page.click("[role=dialog] >> text=Cerrar");
    await t.page.waitForTimeout(500);
    const celebrate = (await t.log()).filter((e) => e[0] === "app:celebrate");
    const during = await t.page.evaluate(() => { const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); return { celebrating: s.player.isCelebrating, frame: s.player.sprite.frame.name }; });
    check("A12 al cerrar la recompensa se celebra exactamente una vez en el mapa", celebrate.length === 1 && during.celebrating && during.frame.startsWith("celebrate-"), JSON.stringify({ n: celebrate.length, ...during }));
    check("A13 el foco vuelve al mapa", await t.page.evaluate(() => document.activeElement?.classList.contains("game-host")));
    await t.page.waitForTimeout(2800);
    check("A14 la celebración termina y Vanessa vuelve a su reposo de frente", !(await t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").player.isCelebrating)) && /^front-0[0-2]$/.test((await t.scene()).frame));
    check("A15 la cabecera muestra el progreso, la XP y el siguiente objetivo derivados", (await hud(t)).includes("1 de 6 aprendizajes") && (await hud(t)).includes("100 / 600 XP") && (await hud(t)).includes("Continúa en Aprendizaje 2"));
    check("A16 la estación 1 queda completada y la 2 disponible", JSON.stringify((await t.stations()).map((s) => [s.id, s.state])) === JSON.stringify([["apr-a", "completed"], ["apr-b", "available"], ["apr-c", "locked"]]));

    // relectura
    await t.log();
    await openStation1(t);
    check("A17 releer muestra el mensaje de relectura", (await dialog.innerText()).includes("Ya recorriste este aprendizaje"));
    await t.page.click("text=Siguiente");
    await t.page.waitForTimeout(250);
    check("A18 al releer: «Insignia obtenida», sin botón de recoger ni de marcar", (await t.page.locator(".reading__earned").innerText()).includes("Insignia obtenida") && (await t.page.locator("text=Recoger insignia y continuar").count()) === 0 && (await t.page.locator("text=Marcar sección como leída").count()) === 0);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(500);
    check("A19 releer no vuelve a celebrar ni a conceder", (await t.log()).filter((e) => e[0] === "app:celebrate").length === 0 && (await hud(t)).includes("100 / 600 XP"));
    check("A20 sin errores de consola en todo el flujo", t.errors.length === 0, t.errors.join(" | "));

    // recarga
    await t.page.reload();
    await t.page.waitForSelector(".cover");
    check("A21 tras recargar la portada ofrece «Continuar recorrido»", (await t.page.locator(".pixel-button").innerText()) === "Continuar recorrido");
    await t.page.evaluate(() => { window.__celebrations = 0; });
    await t.page.click(".pixel-button");
    await t.watch();
    await t.page.waitForTimeout(1500);
    check("A22 recargar restaura el avance y pinta las estaciones correctas sin celebrar lo histórico", (await hud(t)).includes("1 de 6 aprendizajes") && JSON.stringify((await t.stations()).map((s) => s.state)) === JSON.stringify(["completed", "available", "locked"]) && (await t.log()).filter((e) => e[0] === "app:celebrate").length === 0);
    await t.close();
  }

  // ---- I. Cierre a medias, Enter mantenido, ciclo de vida del motor y recorrido solo con teclado ----------
  {
    const t = await open();
    await t.start();
    await t.page.evaluate(() => { window.__g0 = window.__PHASER_GAME__; window.__c0 = document.querySelector("canvas"); });
    await openStation1(t);
    await t.page.click("text=Siguiente");
    await t.page.click("text=Marcar sección como leída"); // «Lo vivido»
    await t.page.keyboard.press("ArrowRight"); // pasa a «Aprendizajes» sin marcarla
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(400);
    await openStation1(t);
    await t.page.click("text=Siguiente");
    await t.page.waitForTimeout(250);
    check("I1 cerrar a medias conserva la sección marcada y la pestaña activa al volver a abrir", (await t.page.locator("[role=tab][aria-selected=true]").innerText()).startsWith("Aprendizajes") && (await t.page.locator("[role=tab]:has-text('Lo vivido')").innerText()).includes("Sección leída") && (await t.page.locator(".reading__status").innerText()) === "Sin marcar");

    for (const tab of ["Aprendizajes", "Reflexión", "En el aula"]) {
      await t.page.click(`[role=tab]:has-text('${tab}')`);
      await t.page.click("text=Marcar sección como leída");
    }
    await t.page.focus("text=Recoger insignia y continuar");
    await t.page.keyboard.down("Enter");
    for (let i = 0; i < 8; i++) { await t.page.keyboard.down("Enter"); await t.page.waitForTimeout(60); }
    await t.page.keyboard.up("Enter");
    await t.page.waitForTimeout(500);
    const stored = JSON.parse((await t.stored())[KEY()]);
    check("I2 Enter mantenido sobre «Recoger insignia» concede una sola vez y no cierra la recompensa", Object.values(stored.entries).filter((e) => e.completedAt).length === 1 && (await t.page.locator("[role=dialog]").innerText()).includes("¡Aprendizaje recorrido!"));
    await t.page.waitForTimeout(500);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(500);
    const same = await t.page.evaluate(() => ({ game: window.__g0 === window.__PHASER_GAME__, canvas: window.__c0 === document.querySelector("canvas") && document.querySelectorAll("canvas").length === 1 }));
    check("I3 abrir lecturas y ganar una insignia no reinicia el motor: misma instancia y mismo canvas (AC-15)", same.game && same.canvas, JSON.stringify(same));
    await t.close();

    const kb = await open();
    await kb.start();
    await openStation1(kb);
    await kb.page.keyboard.press("Enter"); // «Siguiente» (foco inicial)
    await kb.page.waitForTimeout(250);
    for (let i = 0; i < 4; i++) {
      if (i > 0) await kb.page.keyboard.press("ArrowRight");
      await kb.page.keyboard.press("Tab"); // panel
      await kb.page.keyboard.press("Tab"); // «Marcar sección como leída»
      await kb.page.keyboard.press("Enter");
      await kb.page.waitForTimeout(120);
    }
    await kb.page.keyboard.press("Tab"); // panel
    await kb.page.keyboard.press("Tab"); // «Recoger insignia y continuar»
    await kb.page.keyboard.press("Enter");
    await kb.page.waitForTimeout(700);
    check("I4 un aprendizaje completo se puede recorrer solo con teclado, hasta la recompensa (AC-11)", (await kb.page.locator("[role=dialog]").innerText()).includes("¡Aprendizaje recorrido!") && (await hud(kb)).includes("1 de 6"), await kb.page.locator("[role=dialog]").innerText());
    await kb.page.keyboard.press("Enter");
    await kb.page.waitForTimeout(500);
    check("I5 y se cierra con teclado devolviendo el foco al mapa", (await kb.page.locator("[role=dialog]").count()) === 0 && (await kb.page.evaluate(() => document.activeElement?.classList.contains("game-host"))));
    await kb.close();
  }

  // ---- Z. Accesibilidad con axe-core en cada pantalla (contraste, roles, nombres, landmarks) ----------------
  {
    const t = await open();
    check("Z1 portada sin violaciones de accesibilidad", (await t.axe()).length === 0, (await t.axe()).join(" | "));
    await t.start();
    await t.place(330, 990);
    await t.page.waitForTimeout(300);
    const map = await t.axe();
    check("Z2 mapa con cabecera y aviso de proximidad sin violaciones", map.length === 0, map.join(" | "));
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(300);
    const intro = await t.axe();
    check("Z3 ventana en la fase de apertura sin violaciones", intro.length === 0, intro.join(" | "));
    await t.page.click("text=Siguiente");
    await t.page.waitForTimeout(250);
    const reading = await t.axe();
    check("Z4 ventana de lectura (pestañas, panel, botones) sin violaciones", reading.length === 0, reading.join(" | "));
    for (let i = 0; i < 4; i++) { if (i) await t.page.keyboard.press("ArrowRight"); await t.page.click("text=Marcar sección como leída"); }
    await t.page.click("text=Recoger insignia y continuar");
    await t.page.waitForTimeout(600);
    const rewardA11y = await t.axe();
    check("Z5 pantalla de recompensa sin violaciones", rewardA11y.length === 0, rewardA11y.join(" | "));
    await t.page.waitForTimeout(500);
    await t.page.click("[role=dialog] >> text=Cerrar");
    await t.page.waitForTimeout(300);
    await t.page.keyboard.press("Tab"); // del mapa a la cabecera
    await t.page.getByRole("button", { name: "Insignias" }).click();
    await t.page.waitForTimeout(300);
    const collection = await t.axe();
    check("Z6 colección de insignias sin violaciones", collection.length === 0, collection.join(" | "));
    await t.page.click("text=Reiniciar recorrido");
    await t.page.waitForTimeout(250);
    const confirm = await t.axe();
    check("Z7 confirmación de reinicio (alertdialog) sin violaciones", confirm.length === 0, confirm.join(" | "));
    await t.close();

    const final = await open({ edit: (c) => { c.mode = "final"; } });
    await final.start();
    await final.page.waitForTimeout(300);
    const finalMap = await final.axe();
    check("Z8 mapa y cabecera en modo final («en preparación») sin violaciones", finalMap.length === 0, finalMap.join(" | "));
    await final.close();
  }

  // ---- B. Móvil: la ventana cabe, se desplaza por dentro y los controles son táctiles ------------------
  {
    const t = await open({ viewport: { width: 390, height: 844 } });
    await t.start();
    await openStation1(t);
    await t.page.click("text=Siguiente");
    await t.page.waitForTimeout(300);
    const m = await t.page.evaluate(() => {
      const d = document.querySelector("[role=dialog]").getBoundingClientRect();
      const panel = document.querySelector("[role=tabpanel]");
      const buttons = [...document.querySelectorAll("[role=dialog] button")].filter((b) => b.offsetParent !== null).map((b) => b.getBoundingClientRect().height);
      return { dialog: [Math.round(d.left), Math.round(d.right), Math.round(d.top), Math.round(d.bottom)], vw: innerWidth, vh: innerHeight, hscroll: document.documentElement.scrollWidth > innerWidth, scrolls: panel.scrollHeight > panel.clientHeight, minButton: Math.min(...buttons) };
    });
    check("B1 en móvil la ventana ocupa casi toda la pantalla y no desborda", m.dialog[0] >= 0 && m.dialog[1] <= m.vw && m.dialog[3] <= m.vh && !m.hscroll && m.dialog[1] - m.dialog[0] >= m.vw - 20, JSON.stringify(m));
    check("B2 los botones táctiles miden al menos 44 px de alto", m.minButton >= 44, String(m.minButton));
    await t.page.setViewportSize({ width: 320, height: 480 });
    await t.page.waitForTimeout(300);
    const small = await t.page.evaluate(() => {
      const d = document.querySelector("[role=dialog]").getBoundingClientRect();
      const claim = [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.includes("Recoger"));
      const c = claim.getBoundingClientRect();
      return { bottom: Math.round(d.bottom), vh: innerHeight, claimVisible: c.bottom <= innerHeight && c.top >= 0, hscroll: document.documentElement.scrollWidth > innerWidth };
    });
    check("B3 en 320×480 el botón de recoger sigue a la vista y no hay scroll horizontal", small.claimVisible && small.bottom <= small.vh && !small.hscroll, JSON.stringify(small));
    await t.close();
  }

  // ---- C. Movimiento reducido: celebración estática ---------------------------------------------------
  {
    const t = await open({ reducedMotion: true });
    await t.start();
    await openStation1(t);
    await t.page.click("text=Siguiente");
    for (let i = 0; i < 4; i++) { if (i) await t.page.keyboard.press("ArrowRight"); await t.page.click("text=Marcar sección como leída"); }
    await t.page.click("text=Recoger insignia y continuar");
    await t.page.waitForTimeout(600);
    await t.page.click("[role=dialog] >> text=Cerrar");
    await t.page.waitForTimeout(500);
    const r = await t.page.evaluate(() => { const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); return { frame: s.player.sprite.frame.name, playing: s.player.sprite.anims.isPlaying, tweens: s.tweens.getTweens().length, celebrating: s.player.isCelebrating }; });
    check("C1 con movimiento reducido la celebración es una pose estática: sin animación, saltos ni tweens", r.celebrating && r.frame === "celebrate-3" && !r.playing && r.tweens === 0, JSON.stringify(r));
    await t.close();
  }

  // ---- D. Almacenamiento no disponible o corrupto (AC-09) -----------------------------------------------
  {
    const blocked = await open({ init: () => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denegado", "SecurityError"); } }) });
    await blocked.start();
    check("D1 con localStorage bloqueado la app arranca y avisa discretamente", (await blocked.page.locator(".hud__warning").count()) === 1 && blocked.errors.length === 0, blocked.errors.join(" | "));
    await openStation1(blocked);
    await blocked.page.click("text=Siguiente");
    for (let i = 0; i < 4; i++) { if (i) await blocked.page.keyboard.press("ArrowRight"); await blocked.page.click("text=Marcar sección como leída"); }
    await blocked.page.click("text=Recoger insignia y continuar");
    await blocked.page.waitForTimeout(600);
    await blocked.page.keyboard.press("Escape").catch(() => {});
    await blocked.page.click("[role=dialog] >> text=Cerrar").catch(() => {});
    await blocked.page.waitForTimeout(400);
    check("D2 sin almacenamiento el recorrido sigue funcionando en memoria", (await hud(blocked)).includes("1 de 6 aprendizajes"));
    await blocked.close();

    const corrupt = await open({ seed: { [KEY()]: "{ esto no es json", [KEY("final")]: JSON.stringify({ schemaVersion: 2 }) } });
    check("D3 un guardado corrupto se ignora: portada de primera visita y sin errores", (await corrupt.page.locator(".pixel-button").innerText()) === "Comenzar recorrido" && corrupt.errors.length === 0, corrupt.errors.join(" | "));
    await corrupt.start();
    check("D4 con un guardado corrupto se parte de cero", (await hud(corrupt)).includes("0 de 6 aprendizajes"));
    await corrupt.close();

    const foreign = await open({ seed: { "otra-app:tema": "oscuro", ...saved({ entries: { "apr-a": DONE } }) } });
    await foreign.start();
    await foreign.page.evaluate(() => { document.querySelector(".game-host").focus(); });
    check("D5 un guardado ajeno en el mismo origen no interfiere", (await foreign.stored())["otra-app:tema"] === "oscuro" && (await hud(foreign)).includes("1 de 6 aprendizajes"));
    await foreign.close();
  }

  // ---- E. Edición solo con JSON: contenido, etiquetas, insignia y XP (AC-12) -----------------------------
  {
    const t = await open({
      edit: (c) => {
        c.learnings["apr-a"].sections.lived[0] = { type: "paragraph", text: "Texto editado solo en el JSON." };
        c.ui.labels.markRead = "Ya lo leí";
        c.badges["semilla-de-descubrimiento"].xp = 250;
        c.badges["semilla-de-descubrimiento"].title = "Otro nombre";
        c.dialogues["abrir"].lines[0].text = "Mensaje de apertura editado.";
      },
    });
    await t.start();
    await openStation1(t);
    const intro = await t.page.locator("[role=dialog]").innerText();
    await t.page.click("text=Siguiente");
    await t.page.waitForTimeout(250);
    check("E1 cambiar un texto, un diálogo y una etiqueta en el JSON cambia la interfaz sin tocar componentes", intro.includes("Mensaje de apertura editado.") && (await t.page.locator("[role=tabpanel]").innerText()).includes("Texto editado solo en el JSON.") && (await t.page.locator("text=Ya lo leí").count()) === 1);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(300);
    check("E2 la XP máxima se deriva de las insignias vigentes (250 + 5 × 100 = 750)", (await hud(t)).includes("0 / 750 XP"), await hud(t));
    await t.close();
  }

  // ---- F. Revisión de contenido y reconciliación (AC-27, AC-28) -------------------------------------------
  {
    const t = await open({ seed: saved({ entries: { "apr-a": DONE, "apr-b": DONE } }), edit: (c) => { c.learnings["apr-a"].contentRevision = 2; } });
    await t.start();
    check("F1 una revisión nueva invalida solo ese aprendizaje: apr-a vuelve a pendiente y apr-b conserva su insignia", JSON.stringify((await t.stations()).map((s) => [s.id, s.state])) === JSON.stringify([["apr-a", "available"], ["apr-b", "completed"], ["apr-c", "locked"]]) && (await hud(t)).includes("1 de 6 aprendizajes"), JSON.stringify(await t.stations()));
    await t.close();

    const inserted = await open({
      seed: saved({ entries: { "apr-a": DONE, "apr-b": DONE } }),
      edit: (c) => {
        c.learnings["apr-n"] = structuredClone(c.learnings["apr-c"]); c.learnings["apr-n"].badgeId = "insignia-demo-n"; c.badges["insignia-demo-n"] = structuredClone(c.badges["insignia-demo-c"]);
        c.placements["apr-n"] = { zoneId: "zona-a", position: { x: 410, y: 605 }, interactionOffset: { x: 0, y: 30 }, interactionRadius: 70 };
        c.route = ["apr-n", ...c.route];
      },
    });
    await inserted.start();
    const byNumber = (await inserted.stations()).sort((x, y) => x.number - y.number).map((s) => [s.id, s.number, s.state]);
    check("F2 insertar un pendiente antes de lo completado conserva lo completado y lo vuelve requisito de lo siguiente", JSON.stringify(byNumber) === JSON.stringify([["apr-n", 1, "available"], ["apr-a", 2, "completed"], ["apr-b", 3, "completed"], ["apr-c", 4, "locked"]]), JSON.stringify(byNumber));
    await inserted.close();
  }

  // ---- G. Restaurar posición y zona (AC-16) --------------------------------------------------------------
  {
    const t = await open({ seed: saved({ zone: "zona-b", player: { x: 315, y: 605 }, entries: { "apr-a": DONE, "apr-b": DONE, "apr-c": DONE } }) });
    await t.start();
    const s = await t.scene();
    check("G1 recargar devuelve a Vanessa a su zona y posición guardadas", s.zone === "zona-b" && dist(s.pos, { x: 315, y: 605 }) < 1, JSON.stringify(s));
    check("G2 las estaciones de esa zona se pintan con el progreso (4 disponible, 5 y 6 bloqueadas)", JSON.stringify((await t.stations()).map((x) => [x.number, x.state])) === JSON.stringify([[4, "available"], [5, "locked"], [6, "locked"]]));
    await t.close();

    const invalid = await open({ seed: saved({ zone: "zona-a", player: { x: 540, y: 140 } }) }); // dentro de un obstáculo
    await invalid.start();
    const p = await invalid.scene();
    check("G3 una posición guardada no transitable se sustituye por un punto seguro", dist(p.pos, configJson.maps["zona-a"].spawns.inicio) < 1, JSON.stringify(p.pos));
    await invalid.close();
  }

  // ---- H. Demo y final no se mezclan (AC-13) -------------------------------------------------------------
  {
    const t = await open({ seed: saved({ entries: { "apr-a": DONE } }), edit: (c) => { c.mode = "final"; } });
    check("H1 el progreso de demostración no pasa al modo final", (await t.page.locator(".pixel-button").innerText()) === "Comenzar recorrido");
    await t.start();
    check("H2 en final, sin heredar insignias: 0 de 6", (await hud(t)).includes("0 de 6 aprendizajes"));
    await openStation1(t);
    const msg = await t.page.locator("[role=dialog]").innerText();
    check("H3 en final un contenido no aprobado se muestra como pendiente y no se abre", msg.includes("Pendiente de revisión") && (await t.page.locator("[role=tab]").count()) === 0 && !msg.includes("Siguiente"));
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
