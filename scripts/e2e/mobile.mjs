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
const reasons = (t) => t.page.evaluate(() => [...window.__BITACORA_BRIDGE__.controlReasons]);
const speedOf = async (t) => { const s = await t.scene(); return Math.hypot(...s.vel); };
const dialogs = (t) => t.page.locator("[role=dialog]").count();
const nearStation = (id) => { const p = configJson.placements[id]; return [p.position.x + p.interactionOffset.x, p.position.y + p.interactionOffset.y]; };
const OPEN_SPOT = [330, 990]; // junto a «apr-a»: zona abierta del camino

try {
  // ---- Cruceta táctil -----------------------------------------------------------------------------------
  {
    const t = await touchCtx(390, 844);
    await t.start();
    await t.place(...OPEN_SPOT);
    await t.page.waitForTimeout(300);
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
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Sin puntero táctil y con pantalla ancha no hay cruceta -------------------------------------------
  {
    const t = await open({ viewport: { width: 1280, height: 720 } });
    await t.start();
    check("en escritorio con ratón la cruceta no se muestra (se usa el teclado)", await t.page.locator(".touch").isHidden());
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
      await t.page.waitForTimeout(200);
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
        return { hscroll: document.documentElement.scrollWidth > innerWidth, hud: inside(".hud"), tools: inside(".hud__tools > *"), touch: inside(".touch__arrow, .touch__explore"), dialog: inside("[role=dialog]") };
      });
      const base = await fits();
      check(`${name}: cabecera, herramientas y controles caben sin scroll horizontal`, !base.hscroll && base.hud && base.tools && base.touch, JSON.stringify(base));
      const overlap = await t.page.evaluate(() => {
        const rects = [".hud", ".hud__tools > *", ".touch__pad", ".touch__explore"].flatMap((s) => [...document.querySelectorAll(s)].map((e) => [s, e.getBoundingClientRect()]));
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const bad = [];
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (hit(rects[i][1], rects[j][1]) && !(rects[i][0] === ".hud" && rects[j][0].startsWith(".hud__tools"))) bad.push(`${rects[i][0]} × ${rects[j][0]}`);
        return bad;
      });
      check(`${name}: la cabecera, las herramientas y los controles táctiles no se solapan`, overlap.length === 0, overlap.join(", "));
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

  // ---- Con movimiento reducido la cruceta y la lista funcionan igual -------------------------------------
  {
    const t = await touchCtx(390, 844, { reducedMotion: true });
    await t.start();
    await t.place(...OPEN_SPOT);
    const x0 = (await t.scene()).pos.x;
    await finger(t, ARROW("right"), "pointerdown", 1);
    await t.page.waitForTimeout(400);
    await finger(t, ARROW("right"), "pointerup", 1);
    check("con prefers-reduced-motion la cruceta sigue moviendo a Vanessa (el movimiento reducido no es un modo sin juego)", (await t.scene()).pos.x > x0 + 20);
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
