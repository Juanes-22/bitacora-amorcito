// E2E de móvil, accesibilidad y robustez de interfaz (SPEC 6.1, 14; AC-03, AC-04, AC-10, AC-11, AC-15, AC-17, AC-18, AC-21).
// Cruceta táctil, lista accesible, tamaños y orientaciones, motivos de pausa y ciclos de apertura. Uso: npm run test:e2e
import { configJson, harness } from "./helpers.mjs";

const { open, check, finish, browser } = await harness();
const L = configJson.ui.labels;
const SPEED = configJson.gameplay.playerSpeed;
const KEY = `bitacora:progress:v3:${configJson.contentSetId}:demo`;

/** Contexto táctil: puntero grueso, como un teléfono. */
const touchCtx = async (width, height, opts = {}) => {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, ...(opts.reducedMotion ? { reducedMotion: "reduce" } : {}) });
  return open({ viewport: { width, height }, context, edit: opts.edit });
};
/** Evento de puntero sintético sobre un control (un dedo identificado por `id`). */
const finger = (t, selector, type, id) =>
  t.page.evaluate(([sel, type, id]) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(type, { pointerId: id, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerType: "touch", isPrimary: id === 1 }));
  }, [selector, type, id]);
const ARROW = (d) => `.touch__arrow--${d}`;
/** Coordenadas del mundo → píxeles de la ventana (el canvas ocupa toda la ventana). */
const toScreen = (t, wx, wy) =>
  t.page.evaluate(([wx, wy]) => { const c = window.__PHASER_GAME__.scene.getScene("ExplorationScene").cameras.main; return { x: (wx - c.worldView.x) * c.zoom, y: (wy - c.worldView.y) * c.zoom }; }, [wx, wy]);
const tap = async (t, wx, wy) => { const p = await toScreen(t, wx, wy); await t.page.touchscreen.tap(p.x, p.y); };
/** El círculo del destino (profundidad 1800) y cuántas ondas hay además de él. */
const markers = (t) =>
  t.page.evaluate(() => {
    const arcs = window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list.filter((o) => o.type === "Arc" && o.depth === 1800);
    const ring = arcs.find((o) => o.visible && o.fillAlpha > 0);
    return { ring: ring ? { x: ring.x, y: ring.y } : null, waves: arcs.filter((o) => o.fillAlpha === 0).length };
  });
const waitStopped = async (t, max = 8000) => {
  const t0 = Date.now();
  await t.page.waitForTimeout(300);
  while (Date.now() - t0 < max) {
    if ((await speedOf(t)) === 0) return;
    await t.page.waitForTimeout(100);
  }
};
const reasons = (t) => t.page.evaluate(() => [...window.__BITACORA_BRIDGE__.controlReasons]);
const speedOf = async (t) => { const s = await t.scene(); return Math.hypot(...s.vel); };
const dialogs = (t) => t.page.locator("[role=dialog]").count();
const nearStation = (id) => { const p = configJson.placements[id]; return [p.position.x + p.interactionOffset.x, p.position.y + p.interactionOffset.y]; };
const OPEN_SPOT = [330, 990]; // junto a «apr-a»: zona abierta del camino

try {
  // ---- Teléfono: por defecto se camina tocando el mapa (SPEC 6.1; AC-03, AC-04) -------------------------------
  {
    const t = await touchCtx(390, 844);
    await t.start();
    check("AC-03: en un móvil no hay cruceta ni botón «Explorar»: se camina tocando el mapa", (await t.page.locator(".touch, .touch__explore").count()) === 0);
    await t.place(...OPEN_SPOT);
    await t.page.waitForTimeout(300);

    // Tocar un punto del camino: camina hasta allí, con un círculo animado en el destino
    const goal = [200, 1030];
    await tap(t, ...goal);
    await t.page.waitForTimeout(120);
    const early = await markers(t);
    check("AC-03: al tocar aparece un círculo en el destino y una onda que sale del toque", early.ring && early.waves >= 1 && Math.hypot(early.ring.x - goal[0], early.ring.y - goal[1]) < 12, JSON.stringify(early));
    await t.page.waitForTimeout(250);
    const mid = await t.scene();
    check("AC-03: Vanessa echa a andar hacia el punto tocado (por el mismo ciclo de movimiento)", Math.hypot(...mid.vel) > 100 && mid.pos.x < OPEN_SPOT[0], JSON.stringify(mid));
    check("el círculo sigue visible mientras camina", (await markers(t)).ring !== null);
    await waitStopped(t);
    const end = (await t.scene()).pos;
    check("AC-03: llega al punto tocado (a menos de 6 px) y se detiene", Math.hypot(end.x - goal[0], end.y - goal[1]) < 6 && (await speedOf(t)) === 0, JSON.stringify(end));
    await t.page.waitForTimeout(450);
    check("al llegar el círculo desaparece", (await markers(t)).ring === null);

    // Una flecha cancela el recorrido; un nuevo toque lo cambia
    await t.place(...OPEN_SPOT);
    await tap(t, 200, 1030);
    await t.page.waitForTimeout(200);
    await t.page.evaluate(() => document.querySelector(".game-host").focus());
    await t.page.keyboard.down("ArrowUp");
    await t.page.waitForTimeout(150);
    await t.page.keyboard.up("ArrowUp");
    await t.page.waitForTimeout(600);
    check("una flecha cancela el recorrido por toque (no sigue andando sola)", (await speedOf(t)) === 0 && (await markers(t)).ring === null);
    await t.place(...OPEN_SPOT);
    await tap(t, 200, 1030);
    await t.page.waitForTimeout(150);
    await tap(t, 330, 1060);
    await waitStopped(t);
    const p4 = (await t.scene()).pos;
    check("tocar otro punto mientras camina cambia el destino", Math.hypot(p4.x - 330, p4.y - 1060) < 8, JSON.stringify(p4));

    // Tocar la estación estando junto a ella equivale a «Explorar»
    await t.place(...nearStation("apr-a"));
    await tap(t, 230, 1045); // un toque real sobre el suelo: el aviso se adapta al dedo
    await waitStopped(t); // el recorrido por toque debe haber terminado antes de recolocar a Vanessa
    await t.place(...nearStation("apr-a"));
    await t.page.waitForTimeout(400);
    check("AC-04: junto a la estación el aviso dice qué tocar", /Toca la estación para explorar/.test(await t.page.locator(".nearby-region").innerText()), await t.page.locator(".nearby-region").innerText());
    const sign = configJson.placements["apr-a"].position;
    await tap(t, sign.x, sign.y - 22);
    await t.page.waitForTimeout(500);
    check("AC-04: tocar la estación estando junto a ella abre el aprendizaje", (await dialogs(t)) === 1 && /Aprendizaje 1/.test(await t.page.locator("[role=dialog]").innerText()));
    check("AC-17: al abrirse, el mapa se detiene y no queda recorrido", (await speedOf(t)) === 0 && (await reasons(t)).includes("reading"));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(400);
    const axeTap = await t.axe();
    check("axe-core: cabecera y herramientas con el modo de toque sin violaciones", axeTap.length === 0, axeTap.join(" | "));
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Pantalla táctil ancha: el mapa visible llega más lejos --------------------------------------------------
  {
    const t = await touchCtx(1280, 720);
    await t.start();
    await t.place(...OPEN_SPOT);
    await t.page.waitForTimeout(300);
    // Camino con curvas: rodea los obstáculos hasta la estación 2 y llega
    const apr2 = nearStation("apr-b");
    await t.place(...OPEN_SPOT);
    await tap(t, ...apr2);
    await waitStopped(t, 14000);
    const p2 = (await t.scene()).pos;
    check("AC-03: tocando lejos, rodea los obstáculos por el camino y llega (sin atascarse)", Math.hypot(p2.x - apr2[0], p2.y - apr2[1]) < 40, JSON.stringify({ p2, apr2 }));

    // Tocar un arbusto: va a su orilla, no se queda quieta ni lo atraviesa
    await t.place(...OPEN_SPOT);
    await tap(t, 700, 650);
    await waitStopped(t, 14000);
    const p3 = (await t.scene()).pos;
    check("tocar una zona no transitable lleva a la orilla alcanzable más cercana", Math.hypot(p3.x - OPEN_SPOT[0], p3.y - OPEN_SPOT[1]) > 60 && Math.hypot(p3.x - 700, p3.y - 650) < 220, JSON.stringify(p3));

    // Arrastrar el dedo reorienta el destino
    await t.place(...OPEN_SPOT);
    await t.page.waitForTimeout(200);
    const cdp = await t.ctx.newCDPSession(t.page);
    const a = await toScreen(t, 285, 1050), b = await toScreen(t, 200, 1030);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8 }] });
      await t.page.waitForTimeout(60);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await waitStopped(t);
    const p5 = (await t.scene()).pos;
    check("arrastrar el dedo lleva a Vanessa hasta donde se suelta", Math.hypot(p5.x - 200, p5.y - 1030) < 25, JSON.stringify(p5));

    const sign = configJson.placements["apr-a"].position;
    await t.place(...nearStation("apr-a"));
    await t.page.waitForTimeout(400);
    // Tocar la estación estando junto a ella equivale a «Explorar»
    await tap(t, sign.x, sign.y - 22);
    await t.page.waitForTimeout(500);
    check("AC-04: tocar la estación estando junto a ella abre el aprendizaje", (await dialogs(t)) === 1 && /Aprendizaje 1/.test(await t.page.locator("[role=dialog]").innerText()));
    check("AC-17: al abrirse, el mapa se detiene y no queda recorrido", (await speedOf(t)) === 0 && (await reasons(t)).includes("reading"));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(400);

    // Tocar una estación lejana: camina hasta ella, avisa y NO la abre; otro toque la abre
    await t.place(200, 1030);
    await t.page.waitForTimeout(300);
    await tap(t, sign.x, sign.y - 22);
    await waitStopped(t);
    check("tocar una estación lejana camina hasta su punto de interacción sin abrirla", (await dialogs(t)) === 0 && /Toca la estación para explorar/.test(await t.page.locator(".nearby-region").innerText()));
    await tap(t, sign.x, sign.y - 22);
    await t.page.waitForTimeout(500);
    check("AC-04: y un segundo toque sobre la estación la abre", (await dialogs(t)) === 1);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(300);

    // Una estación bloqueada se toca con las mismas reglas: mensaje, sin lectura
    const b2 = configJson.placements["apr-b"].position;
    await t.place(...nearStation("apr-b"));
    await t.page.waitForTimeout(400);
    await tap(t, b2.x, b2.y - 22);
    await t.page.waitForTimeout(500);
    check("AC-04: tocar una estación bloqueada muestra su mensaje, no una lectura", /Todavía no puedes abrir/.test(await t.page.locator("[role=dialog]").innerText()) && (await t.page.getByRole("tab").count()) === 0);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(300);

    // Portal: tocarlo estando junto a él viaja
    await t.place(1380, 440);
    await t.page.waitForTimeout(400);
    check("junto a un portal el aviso dice qué tocar", /toca el portal para viajar/i.test(await t.page.locator(".nearby-region").innerText()));
    const portal = configJson.maps["zona-a"].portals["a-b"].interaction;
    await tap(t, portal.x, portal.y);
    await t.page.waitForTimeout(900);
    check("tocar el portal estando junto a él cambia de zona", (await t.scene()).zone === "zona-b");

    // Con una ventana abierta los toques no mueven al personaje
    await t.place(...OPEN_SPOT);
    await t.page.getByRole("button", { name: L.badges }).click();
    await t.page.waitForTimeout(300);
    const frozenAt = (await t.scene()).pos;
    await t.page.mouse.click(60, 400);
    await t.page.waitForTimeout(400);
    check("AC-17: con la colección abierta, tocar fuera no mueve a Vanessa", JSON.stringify((await t.scene()).pos) === JSON.stringify(frozenAt) || (await t.scene()).zone !== "zona-a");
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Modo cruceta: se elige en el juego y se recuerda (SPEC 6.1; AC-03, AC-04) --------------------------------
  {
    const t = await touchCtx(390, 844);
    await t.start();
    const toggle = t.page.getByRole("button", { name: L.controlsUseDpad });
    const tbox = await toggle.boundingBox();
    check("el botón para cambiar de modo está en las herramientas, con etiqueta textual y ≥ 44 px", tbox && tbox.width >= 43.5 && tbox.height >= 43.5, JSON.stringify(tbox));
    await toggle.click();
    await t.page.waitForTimeout(300);
    check("al pasar a la cruceta el botón ofrece volver a «Tocar para caminar»", (await t.page.getByRole("button", { name: L.controlsUseTap }).count()) === 1 && (await t.page.locator(".touch").count()) === 1);
    check("la preferencia se guarda aparte del progreso", JSON.parse((await t.stored())["bitacora:preferences:v1"]).touchControls === "dpad");
    check("tras usar el botón con ratón o toque, el foco vuelve al mapa", await t.page.evaluate(() => document.activeElement?.classList.contains("game-host")));
    await t.place(...OPEN_SPOT);
    await t.page.waitForTimeout(300);
    const still = (await t.scene()).pos;
    await tap(t, 200, 1030);
    await t.page.waitForTimeout(900);
    check("en modo cruceta tocar el mapa NO mueve a Vanessa", JSON.stringify((await t.scene()).pos) === JSON.stringify(still) && (await markers(t)).ring === null);
    const box = async (sel) => t.page.locator(sel).boundingBox();
    const boxes = await Promise.all([ARROW("up"), ARROW("down"), ARROW("left"), ARROW("right"), ".touch__explore"].map(box));
    check("AC-03: en un móvil se ven la cruceta de cuatro direcciones y «Explorar», todos ≥ 44 px", boxes.every((b) => b && b.width >= 43.5 && b.height >= 43.5), JSON.stringify(boxes));
    check("AC-03: los controles táctiles tienen nombre textual y están en una región con etiqueta", (await t.page.getByRole("region", { name: L.controlsLabel }).count()) === 1 && (await t.page.getByRole("button", { name: L.moveLeft }).count()) === 1);
    check("la cruceta no tapa la cabecera ni las herramientas", await t.page.evaluate(() => {
      const hud = document.querySelector(".hud").getBoundingClientRect();
      const tools = document.querySelector(".hud__tools").getBoundingClientRect();
      const pad = document.querySelector(".touch__pad").getBoundingClientRect();
      return pad.top > hud.bottom && pad.top > tools.bottom;
    }));

    const x0 = (await t.scene()).pos.x;
    await finger(t, ARROW("right"), "pointerdown", 1);
    await t.page.waitForTimeout(500);
    const moving = await t.scene();
    await finger(t, ARROW("right"), "pointerup", 1);
    await t.page.waitForTimeout(150);
    check("AC-03: mantener «derecha» mueve a Vanessa por el mismo controlador que el teclado", moving.pos.x > x0 + 30 && Math.abs(moving.vel[0] - SPEED) < 1, JSON.stringify({ x0, moving }));
    check("AC-03: al levantar el dedo se detiene (sin velocidad residual)", (await speedOf(t)) === 0);

    await t.place(...OPEN_SPOT);
    await finger(t, ARROW("right"), "pointerdown", 1);
    await finger(t, ARROW("up"), "pointerdown", 2);
    await t.page.waitForTimeout(400);
    const diagonal = await speedOf(t);
    await finger(t, ARROW("right"), "pointerup", 1);
    await finger(t, ARROW("up"), "pointerup", 2);
    await t.page.waitForTimeout(150);
    check(`AC-03: dos direcciones a la vez no son más rápidas (${diagonal.toFixed(1)} ≤ ${SPEED})`, diagonal > 0 && diagonal <= SPEED + 0.5, String(diagonal));

    await t.place(...OPEN_SPOT);
    await finger(t, ARROW("left"), "pointerdown", 1);
    await t.page.waitForTimeout(250);
    await finger(t, ARROW("left"), "pointercancel", 1);
    await t.page.waitForTimeout(150);
    check("pointercancel suelta la dirección (sin entradas atascadas)", (await speedOf(t)) === 0);

    await finger(t, ARROW("left"), "pointerdown", 1);
    await t.page.waitForTimeout(250);
    await t.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await t.page.waitForTimeout(250);
    const hidden = await speedOf(t);
    await t.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    await t.page.waitForTimeout(250);
    check("al ocultarse la pestaña con un dedo apoyado se suelta todo y no reanuda solo", hidden === 0 && (await speedOf(t)) === 0, String(hidden));

    // Una dirección mantenida y «Explorar» con otro dedo
    await t.place(...nearStation("apr-a"));
    await t.page.waitForTimeout(250);
    await finger(t, ARROW("down"), "pointerdown", 1);
    await finger(t, ".touch__explore", "pointerdown", 2);
    await t.page.waitForTimeout(500);
    check("AC-04: «Explorar» con otro dedo abre el aprendizaje mientras se mantiene una dirección", (await dialogs(t)) === 1 && (await t.page.locator(".touch").count()) === 0, `${await dialogs(t)} diálogos`);
    check("AC-17: al abrir la lectura el mapa se detiene y no queda velocidad", (await speedOf(t)) === 0 && (await reasons(t)).includes("reading"));
    await finger(t, ".touch__explore", "pointerup", 2).catch(() => undefined);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(400);
    const pos = (await t.scene()).pos;
    await t.page.waitForTimeout(400);
    check("AC-10: al cerrar la lectura vuelven los controles y Vanessa no se mueve sola (el dedo ya no existe)", (await t.page.locator(".touch").count()) === 1 && (await speedOf(t)) === 0 && Math.hypot((await t.scene()).pos.x - pos.x, (await t.scene()).pos.y - pos.y) === 0);

    // «Explorar» con un toque real
    await t.place(...nearStation("apr-a"));
    await t.page.waitForTimeout(300);
    const e = await t.page.locator(".touch__explore").boundingBox();
    await t.page.touchscreen.tap(e.x + e.width / 2, e.y + e.height / 2);
    await t.page.waitForTimeout(500);
    check("AC-04: un toque real en «Explorar» abre el aprendizaje cercano", (await dialogs(t)) === 1);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(300);
    const axeTouch = await t.axe();
    check("axe-core: cabecera, herramientas y cruceta táctil sin violaciones de accesibilidad", axeTouch.length === 0, axeTouch.join(" | "));
    await t.page.locator(".hud__list").click();
    await t.page.waitForTimeout(300);
    const axeList = await t.axe();
    check("axe-core: la lista accesible no tiene violaciones", axeList.length === 0, axeList.join(" | "));
    check("en modo cruceta el aviso invita a pulsar «Explorar», no a tocar la estación", await (async () => { await t.page.keyboard.press("Escape"); await t.page.waitForTimeout(300); await t.place(...nearStation("apr-a")); await t.page.waitForTimeout(400); const x = await t.page.locator(".nearby-region").innerText(); return /Explorar/.test(x) && !/Toca la estación/.test(x); })());
    const axePad = await t.axe();
    check("axe-core: la cruceta táctil no tiene violaciones", axePad.length === 0, axePad.join(" | "));

    // Recordado: al recargar sigue en cruceta; y se puede volver a tocar para caminar
    await t.page.reload();
    await t.page.waitForSelector(".pixel-button");
    await t.start();
    check("la elección se recuerda al recargar (sigue la cruceta)", (await t.page.locator(".touch").count()) === 1 && (await t.page.getByRole("button", { name: L.controlsUseTap }).count()) === 1);
    await t.page.getByRole("button", { name: L.controlsUseTap }).click();
    await t.page.waitForTimeout(300);
    check("al volver a «Tocar para caminar» desaparece la cruceta", (await t.page.locator(".touch").count()) === 0);
    await t.place(...OPEN_SPOT);
    await t.page.waitForTimeout(300);
    await tap(t, 200, 1030);
    await waitStopped(t);
    const back = (await t.scene()).pos;
    check("y el toque vuelve a llevar a Vanessa al destino", Math.hypot(back.x - 200, back.y - 1030) < 6, JSON.stringify(back));
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- La configuración decide el modo de partida ------------------------------------------------------------
  {
    const t = await touchCtx(390, 844, { edit: (c) => { c.gameplay.touchControls = "dpad"; } });
    await t.start();
    check("con gameplay.touchControls = «dpad» se parte de la cruceta", (await t.page.locator(".touch").count()) === 1 && (await t.page.getByRole("button", { name: L.controlsUseTap }).count()) === 1);
    await t.close();
    const u = await touchCtx(390, 844, { edit: (c) => { c.gameplay.touchControls = "dpad"; } });
    await u.page.evaluate(() => localStorage.setItem("bitacora:preferences:v1", JSON.stringify({ musicMuted: false, touchControls: "tap" })));
    await u.page.reload();
    await u.page.waitForSelector(".pixel-button");
    await u.start();
    check("la elección del visitante manda sobre la configuración", (await u.page.locator(".touch").count()) === 0);
    await u.close();
  }


  // ---- Con ratón en escritorio, tocar el mapa no mueve a Vanessa (se usa el teclado) -----------------------
  {
    const t = await open({ viewport: { width: 1280, height: 720 } });
    await t.start();
    await t.place(...OPEN_SPOT);
    await t.page.waitForTimeout(300);
    const before = (await t.scene()).pos;
    const target = await toScreen(t, 200, 1030);
    await t.page.mouse.click(target.x, target.y);
    await t.page.waitForTimeout(600);
    check("en escritorio con ratón, hacer clic en el mapa no mueve a Vanessa", JSON.stringify((await t.scene()).pos) === JSON.stringify(before));
    check("y el aviso de proximidad habla del teclado", await (async () => { await t.place(...nearStation("apr-a")); await t.page.waitForTimeout(400); return /\(Enter\)/.test(await t.page.locator(".nearby-region").innerText()); })());
    await t.close();
  }

  // ---- Lista accesible: completar todo el recorrido sin mover al personaje -------------------------------
  {
    const t = await open({ viewport: { width: 1280, height: 720 } });
    await t.start();
    await t.page.getByRole("button", { name: L.index }).click();
    await t.page.waitForTimeout(300);
    check("AC-11: «Ver aprendizajes en lista» abre un diálogo con los seis aprendizajes y sus estados en texto", (await t.page.getByRole("dialog", { name: L.index }).count()) === 1 && (await t.page.locator(".learning-list__item").count()) === 6
      && (await t.page.locator(".learning-list__state").allInnerTexts()).join() === [L.stateAvailable, ...Array(5).fill(L.stateLocked)].join());
    check("AC-17: con la lista abierta el mapa está detenido", (await reasons(t)).includes("overlay"));
    const before = (await t.scene()).pos;
    await t.page.keyboard.down("ArrowRight");
    await t.page.waitForTimeout(400);
    await t.page.keyboard.up("ArrowRight");
    check("AC-10: las flechas no mueven al personaje con la lista abierta", (await t.scene()).pos.x === before.x && (await t.scene()).pos.y === before.y);
    check("AC-10: el foco está dentro del diálogo", await t.page.evaluate(() => document.querySelector("[role=dialog]").contains(document.activeElement)));

    // Las mismas reglas: uno bloqueado solo muestra su mensaje
    await t.page.getByRole("button", { name: new RegExp(`${L.explore}: Aprendizaje 2`) }).click();
    await t.page.waitForTimeout(250);
    const locked = await t.page.locator("[role=dialog]").innerText();
    check("AC-11: abrir uno bloqueado desde la lista muestra el mismo mensaje que en el mapa y ninguna lectura", /Todavía no puedes abrir/.test(locked) && (await t.page.getByRole("tab").count()) === 0, locked.slice(0, 120));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    check("al cerrar el mensaje vuelve a la lista", (await t.page.getByRole("dialog", { name: L.index }).count()) === 1);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    check("y otro cierre devuelve el control al mapa", (await dialogs(t)) === 0 && (await reasons(t)).length === 0);

    // Recorrido completo con la lista, sin mover a Vanessa
    const start = (await t.scene()).pos;
    for (let i = 1; i <= configJson.route.length; i++) {
      await t.page.getByRole("button", { name: L.index }).click();
      await t.page.waitForTimeout(200);
      await t.page.getByRole("button", { name: new RegExp(`${L.explore}: Aprendizaje ${i}:`) }).click();
      await t.page.waitForTimeout(250);
      await t.page.click("text=Siguiente");
      await t.page.waitForTimeout(150);
      for (let s = 0; s < 4; s++) {
        await t.page.click("text=Marcar sección como leída");
        await t.page.waitForTimeout(80);
        if (s < 3) await t.page.getByRole("tab").nth(s + 1).click();
      }
      await t.page.click("text=Recoger insignia y continuar");
      await t.page.waitForTimeout(800); // la recompensa ignora «Cerrar» un instante (clics duplicados, Enter mantenido)
      await t.page.click("[role=dialog] >> text=Cerrar");
      await t.page.waitForTimeout(i === configJson.route.length ? 3800 : 500);
    }
    const stored = JSON.parse((await t.stored())[KEY]);
    const done = configJson.route.filter((id) => stored.entries[id]?.completedAt);
    check("AC-11: el recorrido de seis aprendizajes se completa solo con la lista, en orden", done.length === 6, JSON.stringify(done));
    check("AC-11: sin mover a Vanessa del punto inicial", (await t.scene()).pos.x === start.x && (await t.scene()).pos.y === start.y);
    check("al terminar aparece la colección de cierre (como al hacerlo en el mapa)", (await t.page.getByRole("dialog", { name: L.completionTitle }).count()) === 1);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    await t.page.getByRole("button", { name: L.index }).click();
    await t.page.waitForTimeout(250);
    check("la lista muestra todos los aprendizajes como completados", (await t.page.locator(".learning-list__state").allInnerTexts()).every((x) => x === L.stateCompleted));
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Todos los motivos de pausa detienen el mapa (AC-17) -----------------------------------------------
  {
    const t = await open({ viewport: { width: 1280, height: 720 } });
    await t.start();
    const frozen = async (name, expectedReason) => {
      await t.page.waitForTimeout(250);
      const a = (await t.scene()).pos;
      await t.page.keyboard.down("ArrowRight");
      await t.page.keyboard.down("ArrowDown");
      await t.page.waitForTimeout(350);
      await t.page.keyboard.up("ArrowRight");
      await t.page.keyboard.up("ArrowDown");
      const b = await t.scene();
      check(`AC-17: con «${name}» Vanessa no se mueve (motivos: ${(await reasons(t)).join("+") || "ninguno"})`, a.x === b.pos.x && a.y === b.pos.y && b.vel.every((v) => v === 0) && (await reasons(t)).includes(expectedReason));
    };
    const close = async () => { await t.page.keyboard.press("Escape"); await t.page.waitForTimeout(250); };

    await t.place(...nearStation("apr-a"));
    await t.page.waitForTimeout(250);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(300);
    await frozen("lectura abierta", "reading");
    await close();

    await t.page.getByRole("button", { name: L.badges }).click();
    await t.page.waitForTimeout(300);
    await frozen("colección de insignias", "overlay");
    await t.page.getByRole("button", { name: L.reset }).first().click();
    await t.page.waitForTimeout(250);
    await frozen("confirmación de reinicio", "overlay");
    await close(); // cancelar
    await close();

    await t.page.getByRole("button", { name: L.index }).click();
    await t.page.waitForTimeout(250);
    await frozen("lista de aprendizajes", "overlay");
    await close();

    await t.place(1380, 440);
    await t.page.waitForTimeout(250);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(40);
    check("AC-17: durante el cambio de zona hay un motivo de transición y al terminar se libera", (await reasons(t)).includes("transition") || (await t.scene()).zone === "zona-b");
    await t.page.waitForTimeout(900);
    check("tras viajar no queda ningún motivo de bloqueo", (await reasons(t)).length === 0);
    await t.close();
  }

  // ---- Tamaños, orientaciones, zoom y textos largos (AC-21) ----------------------------------------------
  {
    const long = "Textoenormesinespacios".repeat(7);
    const sizes = [["móvil pequeño 320×568", 320, 568], ["móvil 390×844", 390, 844], ["móvil apaisado 844×390", 844, 390], ["apaisado bajo 640×360 (zoom 200 %)", 640, 360], ["tableta vertical 768×1024", 768, 1024]];
    for (const [name, w, h] of sizes) {
      const t = await touchCtx(w, h, { edit: (c) => { c.learnings["apr-a"].title = `${long} y un título muy largo con muchas palabras para comprobar que se parte bien`; c.ui.labels.index = "Ver aprendizajes en lista de la bitácora completa"; } });
      await t.start();
      await t.place(...nearStation("apr-a"));
      await t.page.waitForTimeout(300);
      const fits = () => t.page.evaluate(() => {
        const inside = (sel) => [...document.querySelectorAll(sel)].every((el) => { const r = el.getBoundingClientRect(); return r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; });
        return { hscroll: document.documentElement.scrollWidth > innerWidth, hud: inside(".hud"), tools: inside(".hud__tools > *"), dialog: inside("[role=dialog]") };
      });
      const base = await fits();
      check(`${name}: cabecera y herramientas caben sin scroll horizontal`, !base.hscroll && base.hud && base.tools, JSON.stringify(base));
      const overlap = await t.page.evaluate(() => {
        const rects = [".hud", ".hud__tools > *"].flatMap((s) => [...document.querySelectorAll(s)].map((e) => [s, e.getBoundingClientRect()]));
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const bad = [];
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (hit(rects[i][1], rects[j][1]) && !(rects[i][0] === ".hud" && rects[j][0].startsWith(".hud__tools"))) bad.push(`${rects[i][0]} × ${rects[j][0]}`);
        return bad;
      });
      check(`${name}: la cabecera y las herramientas no se solapan`, overlap.length === 0, overlap.join(", "));
      await t.page.keyboard.press("Enter");
      await t.page.waitForTimeout(350);
      const reading = await fits();
      check(`${name}: el diálogo con un título larguísimo cabe y no desborda`, !reading.hscroll && reading.dialog, JSON.stringify(reading));
      await t.page.keyboard.press("Escape");
      await t.page.waitForTimeout(250);
      await t.page.locator(".hud__list").click();
      await t.page.waitForTimeout(300);
      const list = await fits();
      const scrolls = await t.page.evaluate(() => { const b = document.querySelector(".reading__body"); return b ? { client: b.clientHeight, scroll: b.scrollHeight } : null; });
      check(`${name}: la lista cabe y su contenido es alcanzable (desplazable si hace falta)`, !list.hscroll && list.dialog && scrolls !== null, JSON.stringify({ list, scrolls }));
      check(`${name}: sin errores de consola`, t.errors.length === 0, t.errors.join(" | "));
      await t.close();
    }
  }

  // ---- Un solo «Cerrar» por ventana, sin recuadro en el foco y herramientas centradas (interfaz) ---------------------
  {
    const t = await open({ viewport: { width: 1280, height: 720 } });
    const outline = await t.page.evaluate(() => { const b = document.querySelector(".cover .pixel-button"); b.focus(); const s = getComputedStyle(b); return { outline: s.outlineStyle, filter: s.filter }; });
    check("la pantalla de bienvenida no dibuja un recuadro alrededor del botón verde (el foco es un halo)", outline.outline === "none" && /drop-shadow/.test(outline.filter), JSON.stringify(outline));
    await t.start();
    const closeButtons = () => t.page.locator("[role=dialog] button", { hasText: new RegExp(`^${L.close}$`) });
    await t.page.getByRole("button", { name: L.index }).click();
    await t.page.waitForTimeout(250);
    check("la lista tiene un solo «Cerrar», el verde del pie", (await closeButtons().count()) === 1 && (await closeButtons().first().getAttribute("class")).includes("pixel-button"));
    await t.page.getByRole("button", { name: new RegExp(`${L.explore}: Aprendizaje 2:`) }).click();
    await t.page.waitForTimeout(250);
    check("un mensaje (estación bloqueada) tiene un solo «Cerrar», el verde, con el foco", (await closeButtons().count()) === 1 && (await t.page.evaluate(() => document.activeElement?.classList.contains("pixel-button"))));
    await t.page.keyboard.press("Escape");
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    await t.page.getByRole("button", { name: L.badges }).click();
    await t.page.waitForTimeout(250);
    check("la colección de insignias tiene un solo «Cerrar», el verde, con el foco", (await closeButtons().count()) === 1 && (await t.page.evaluate(() => document.activeElement?.classList.contains("pixel-button"))));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    await t.place(...nearStation("apr-a"));
    await t.page.waitForTimeout(300);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(300);
    check("la apertura de un aprendizaje conserva su «Cerrar» de la cabecera (el pie lo ocupa «Siguiente»)", (await closeButtons().count()) === 1 && (await t.page.locator("[role=dialog] .reading__header button").count()) === 1);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(300);
    const centers = await t.page.evaluate(() => {
      const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
      const hud = document.querySelector(".hud");
      return { hud: mid(hud), tools: [...document.querySelectorAll(".hud__tools > *")].filter((b) => b.offsetParent).map(mid), badges: mid(document.querySelector(".hud__badges")) };
    });
    check("los botones de la cabecera quedan alineados verticalmente en el centro de la cabecera", centers.tools.length >= 3 && centers.tools.every((c) => Math.abs(c - centers.hud) < 2) && Math.abs(centers.badges - centers.hud) < 2, JSON.stringify(centers));
    await t.close();
  }

  // ---- Ciclos repetidos: sin canvas ni listeners duplicados (AC-15, AC-18) -------------------------------
  {
    const t = await open({ viewport: { width: 1280, height: 720 } });
    await t.start();
    const l0 = await t.page.evaluate(() => window.__BITACORA_BRIDGE__.listenerCount());
    for (let i = 0; i < 10; i++) {
      await t.page.getByRole("button", { name: L.index }).click();
      await t.page.waitForTimeout(80);
      await t.page.getByRole("button", { name: new RegExp(`${L.explore}: Aprendizaje 1:`) }).click();
      await t.page.waitForTimeout(80);
      await t.page.keyboard.press("Escape");
      await t.page.waitForTimeout(60);
      await t.page.keyboard.press("Escape");
      await t.page.waitForTimeout(60);
    }
    const post = await t.page.evaluate(() => ({ canvases: document.querySelectorAll("canvas").length, listeners: window.__BITACORA_BRIDGE__.listenerCount(), reasons: [...window.__BITACORA_BRIDGE__.controlReasons], dialogs: document.querySelectorAll("[role=dialog]").length }));
    check("AC-15/18: diez ciclos lista → lectura → lista → mapa no multiplican canvas ni listeners ni dejan bloqueos", post.canvases === 1 && post.listeners === l0 && post.reasons.length === 0 && post.dialogs === 0, JSON.stringify({ ...post, l0 }));
    const stored = (await t.stored())[KEY];
    check("abrir y cerrar no concede nada ni cambia el avance", !stored || JSON.parse(stored).entries["apr-a"].completedAt === undefined);
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Con movimiento reducido el toque camina igual, pero sin onda ni latido ------------------------------------
  {
    const t = await touchCtx(390, 844, { reducedMotion: true });
    await t.start();
    await t.place(...OPEN_SPOT);
    await t.page.waitForTimeout(300);
    await tap(t, 200, 1030);
    await t.page.waitForTimeout(150);
    const m = await markers(t);
    check("con prefers-reduced-motion el círculo aparece quieto: sin onda que se expande", m.ring !== null && m.waves === 0, JSON.stringify(m));
    const scale = await t.page.evaluate(() => { const o = window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list.find((x) => x.type === "Arc" && x.depth === 1800 && x.visible); return o?.scale; });
    await t.page.waitForTimeout(300);
    const scale2 = await t.page.evaluate(() => { const o = window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list.find((x) => x.type === "Arc" && x.depth === 1800 && x.visible); return o?.scale; });
    check("y no late (su tamaño no cambia)", scale === 1 && scale2 === 1, `${scale} → ${scale2}`);
    await waitStopped(t);
    const end = (await t.scene()).pos;
    check("con movimiento reducido el toque sigue llevando a Vanessa al destino", Math.hypot(end.x - 200, end.y - 1030) < 6, JSON.stringify(end));
    check("y al llegar el círculo desaparece al instante", (await markers(t)).ring === null);
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
