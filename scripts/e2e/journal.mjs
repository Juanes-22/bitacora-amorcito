// E2E de la Bitácora de aprendizajes (índice y lector, SPEC 7 y 14, AC-83): se abre desde la cabecera, abre cada aprendizaje directo en su
// lectura (sin ventana de apertura), respeta las reglas de progreso del juego (abrir una pestaña no marca; marcar avanza; recoger concede
// una sola vez), enlaza con el detalle de la insignia y la lista, y es accesible y utilizable en escritorio, portátil y móvil.
import { configJson, harness, stationSpot, START } from "./helpers.mjs";

const h = await harness();
const { check } = h;
const KEY = `bitacora:progress:v3:${configJson.contentSetId}:${configJson.mode}`;
const DONE = { contentRevision: 1, readSectionIds: ["learning", "reflection", "lived"], completedAt: "2026-09-30T10:00:00.000Z" };
const seed = (entries = {}) => ({
  [KEY]: JSON.stringify({
    schemaVersion: 3, contentSetId: configJson.contentSetId, mode: configJson.mode, currentZoneId: "zona-a", player: { x: 200, y: 1030 }, checkpoints: {},
    entries: Object.fromEntries(configJson.route.map((id) => [id, entries[id] ?? { contentRevision: 1, readSectionIds: [] }])),
  }),
});
const stored = async (t) => JSON.parse((await t.stored())[KEY]);
const dialogText = (t) => t.page.locator("[role=dialog]").innerText().then((x) => x.replace(/\s+/g, " "));
const openIndex = async (t) => {
  await t.page.getByRole("button", { name: /Bitácora/ }).first().click();
  await t.page.waitForSelector(".jp-dialog");
  await t.page.waitForTimeout(250);
};
const titleOf = (id) => configJson.learnings[id].title;
/** Vanessa junto a la estación (en su punto de interacción): un aprendizaje sin completar solo se explora desde ahí. */
const atStation = async (t, id) => {
  await t.place(...stationSpot(id));
  await t.page.waitForTimeout(350);
};
const noOverflow = (t) => t.page.evaluate(() => {
  const d = document.querySelector(".jp-dialog").getBoundingClientRect();
  return { fits: d.left >= 0 && d.right <= innerWidth && d.top >= 0 && d.bottom <= innerHeight + 1, scrollX: document.documentElement.scrollWidth > innerWidth };
});

try {
  // ---- Escritorio: índice ----
  {
    const t = await h.open({ viewport: { width: 1672, height: 941 }, seed: seed({ "apr-a": DONE }) });
    await t.start();
    await openIndex(t);
    const text = await dialogText(t);
    check("K1 el índice es un diálogo con título, subtítulo, los dos grupos por zona y «1 de 6 completados»", text.includes("Bitácora de aprendizajes") && text.includes("Lo vivido, lo aprendido y lo descubierto.") && text.includes("Pradera del cerezo") && text.includes("Jardín del pabellón") && text.includes("1 de 6 completados"), text.slice(0, 200));
    check("K2 seis tarjetas con ilustración, estado en texto (Completado, Disponible con «Siguiente», Por descubrir) y su acción", (await t.page.locator(".jp-card").count()) === 6 && text.includes("Completado") && text.includes("Disponible") && text.includes("Volver a leer") && text.includes("Completa el aprendizaje 2") && (await t.page.locator(".jp-ribbon").count()) === 1);
    check("K3 el foco inicial está en la acción del siguiente aprendizaje (dentro del diálogo)", await t.page.evaluate(() => document.activeElement?.closest(".jp-dialog") !== null && /Explorar/.test(document.activeElement?.textContent ?? "")));
    const axe = await t.axe();
    check("K4 el índice no tiene violaciones de accesibilidad (axe)", axe.length === 0, axe.join(" | "));
    check("K5 el mapa se detiene mientras está abierto y Escape lo cierra devolviendo el control", (await t.page.locator(".game-host[inert]").count()) === 1);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    check("K6 Escape cierra la bitácora y el mapa vuelve a estar activo", (await t.page.locator(".jp-dialog").count()) === 0 && (await t.page.locator(".game-host[inert]").count()) === 0);
    check("K7 sin errores de consola en el índice", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Lectura: entrar directo y reglas de progreso ----
  {
    const t = await h.open({ viewport: { width: 1672, height: 941 }, seed: seed({ "apr-a": DONE }) });
    await t.start();
    // Lejos de su estación, un aprendizaje sin completar no se explora desde la Bitácora: aviso y vuelta al índice.
    await openIndex(t);
    await t.page.getByRole("button", { name: /Explorar: .*La plastilina casera/ }).click();
    await t.page.waitForTimeout(300);
    const away = await dialogText(t);
    check("L0 lejos de la estación, «Explorar» muestra el aviso con el título y la zona y NO abre la lectura ni marca nada", away.includes("Para explorar «La plastilina casera» ve a su estación en Pradera del cerezo") && (await t.page.locator(".jp-dialog--reader").count()) === 0 && (await t.page.locator("[role=tab]").count()) === 0 && (await stored(t)).entries["apr-b"].readSectionIds.length === 0, away.slice(0, 200));
    await t.page.locator("[role=dialog] >> text=Cerrar").first().click();
    await t.page.waitForSelector(".jp-dialog:not(.jp-dialog--reader)");
    check("L0b al cerrar el aviso se vuelve al índice", (await dialogText(t)).includes("1 de 6 completados"));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    await atStation(t, "apr-b");
    await openIndex(t);
    await t.page.getByRole("button", { name: /Explorar: .*La plastilina casera/ }).click();
    await t.page.waitForSelector(".jp-dialog--reader");
    await t.page.waitForTimeout(250);
    const text = await dialogText(t);
    check("L1 «Explorar» abre la lectura directo, sin ventana de apertura ni «Siguiente»: título, «En curso» y «0 de 3 secciones leídas»", text.includes(titleOf("apr-b")) && text.includes("En curso") && text.includes("0 de 3 secciones leídas") && !(await t.page.getByRole("button", { name: "Siguiente", exact: true }).count()), text.slice(0, 160));
    const axe = await t.axe();
    check("L2 el lector no tiene violaciones de accesibilidad (axe)", axe.length === 0, axe.join(" | "));
    await t.page.getByRole("tab", { name: "Reflexión" }).click();
    await t.page.getByRole("tab", { name: "Lo vivido" }).click();
    await t.page.keyboard.press("Home");
    check("L3 abrir pestañas (con el ratón y con el teclado) no marca ninguna sección como leída", (await stored(t)).entries["apr-b"].readSectionIds.length === 0 && (await dialogText(t)).includes("0 de 3 secciones leídas"));
    await t.page.getByRole("button", { name: "Marcar como leído y continuar" }).click();
    await t.page.waitForTimeout(150);
    const s = await stored(t);
    check("L4 «Marcar como leído y continuar» guarda la sección actual y pasa a la siguiente: «1 de 3» y la pestaña Reflexión", JSON.stringify(s.entries["apr-b"].readSectionIds) === '["learning"]' && (await dialogText(t)).includes("1 de 3 secciones leídas") && (await t.page.getByRole("tab", { name: /Reflexión/ }).getAttribute("aria-selected")) === "true");
    await t.page.reload();
    await t.page.waitForSelector(START);
    await t.start();
    await atStation(t, "apr-b");
    await openIndex(t);
    await t.page.getByRole("button", { name: /Explorar: .*La plastilina casera/ }).click();
    await t.page.waitForSelector(".jp-dialog--reader");
    check("L5 al recargar y volver a abrir se conserva lo leído y se retoma en la última sección", (await dialogText(t)).includes("1 de 3 secciones leídas") && (await t.page.getByRole("tab", { name: /Reflexión/ }).getAttribute("aria-selected")) === "true");
    await t.page.getByRole("button", { name: "Marcar como leído y continuar" }).click();
    await t.page.getByRole("button", { name: "Marcar como leído y continuar" }).click();
    await t.page.waitForTimeout(150);
    const before = await stored(t);
    check("L6 con las tres leídas el pie ofrece «Recoger insignia»; leer no concede nada todavía", (await t.page.locator(".jp-reader-footer .jp-action--primary").innerText()).includes("Recoger insignia") && before.entries["apr-b"].completedAt === undefined && before.entries["apr-b"].readSectionIds.length === 3);
    await t.watch();
    await t.page.locator(".jp-reader-footer .jp-action--primary").click();
    await t.page.waitForTimeout(700);
    const reward = await dialogText(t);
    check("L7 recoger la insignia abre la recompensa (su ventana de siempre) y concede una sola vez", reward.includes(configJson.ui.labels.rewardTitle) && (await stored(t)).entries["apr-b"].completedAt !== undefined);
    await t.page.click("[role=dialog] >> text=Cerrar");
    await t.page.waitForTimeout(800);
    const log = await t.log();
    check("L8 la celebración se reproduce una sola vez y la cabecera dice «2 de 6 aprendizajes»", log.filter((e) => e[0] === "app:celebrate").length === 1 && (await t.page.locator(".hud").innerText()).includes("2 de 6"), JSON.stringify(log.filter((e) => e[0] === "app:celebrate")));
    check("L9 sin errores de consola en la lectura", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Completado, navegación y enlaces ----
  {
    const t = await h.open({ viewport: { width: 1672, height: 941 }, seed: seed({ "apr-a": DONE }) });
    await t.start();
    await openIndex(t);
    await t.page.getByRole("button", { name: /Volver a leer: .*Las plantas/ }).click();
    await t.page.waitForSelector(".jp-dialog--reader");
    const text = await dialogText(t);
    check("M1 un aprendizaje completado se relee directo: «Completado», «Insignia obtenida», tres de tres y sin botón de marcar ni de recoger", text.includes("Completado") && text.includes("Insignia obtenida") && text.includes("3 de 3 secciones leídas") && !text.includes("Marcar como leído") && !text.includes("Recoger insignia"));
    const done = await t.axe();
    check("M2 el lector completado no tiene violaciones de accesibilidad (axe)", done.length === 0, done.join(" | "));
    const primary = t.page.locator(".jp-reader-footer .jp-action--primary");
    await primary.click();
    const second = (await t.page.getByRole("tab", { name: /Reflexión/ }).getAttribute("aria-selected")) === "true";
    await primary.click();
    check("M3 el pie recorre las secciones («Ver reflexión», «Ver lo vivido») y termina en «Volver a la bitácora»", second && (await primary.innerText()).includes("Volver a la bitácora"));
    await primary.click();
    await t.page.waitForSelector(".jp-dialog:not(.jp-dialog--reader)");
    check("M4 «Volver a la bitácora» regresa al índice sin marcar ni conceder nada", (await dialogText(t)).includes("1 de 6 completados") && (await stored(t)).entries["apr-b"].readSectionIds.length === 0);
    await t.page.getByRole("button", { name: /Volver a leer: .*Las plantas/ }).click();
    await t.page.waitForSelector(".jp-dialog--reader");
    await t.page.getByRole("button", { name: /Ver insignia/ }).click();
    await t.page.waitForSelector(".bpk-dialog");
    const badge = await dialogText(t);
    // «Ver aprendizaje» lleva al aprendizaje de la insignia: uno completado se relee desde cualquier sitio.
    await t.page.getByRole("button", { name: "Ver aprendizaje" }).click();
    await t.page.waitForSelector(".jp-dialog--reader");
    check("M5b «Ver aprendizaje» en el detalle de una insignia abre la lectura de ese aprendizaje (completado: se relee estando lejos)", (await dialogText(t)).includes(titleOf("apr-a")) && (await dialogText(t)).includes("Completado"));
    await t.page.keyboard.press("Escape");
    await t.page.waitForSelector(".bpk-dialog");
    check("M5c al cerrar esa lectura se vuelve al detalle de la insignia", (await dialogText(t)).includes("Qué representa"));
    check("M5 «Ver insignia» abre el detalle de la insignia de ese aprendizaje en el panel de insignias", badge.includes(configJson.badges[configJson.learnings["apr-a"].badgeId].title) && badge.includes("Qué representa"), badge.slice(0, 160));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    check("M5d la insignia de Rocky es secreta: la colección no la muestra ni la nombra mientras falte algún aprendizaje", (await t.page.locator(".bpk-special").count()) === 1 && !(await dialogText(t)).includes("Rocky"));
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(250);
    check("M6 Escape vuelve de la insignia a la colección y la cierra: el mapa queda libre", (await t.page.locator("[role=dialog]").count()) === 0);
    await t.close();
  }

  // ---- Secuencia: un aprendizaje bloqueado no se abre ----
  {
    const t = await h.open({ seed: seed() });
    await t.start();
    await openIndex(t);
    await t.page.getByRole("button", { name: /Explorar: .*La plastilina casera.*Por descubrir/ }).click();
    await t.page.waitForTimeout(300);
    const text = await dialogText(t);
    check("N1 un aprendizaje bloqueado muestra su mensaje y no abre la lectura ni marca nada", (await t.page.locator(".jp-dialog--reader").count()) === 0 && (await t.page.locator("[role=tab]").count()) === 0 && text.length > 0 && JSON.stringify((await stored(t)).entries["apr-b"].readSectionIds) === "[]");
    await t.close();
  }

  // ---- Portátil y móvil ----
  for (const [name, viewport, scale = 1] of [
    ["portátil 1280×720", { width: 1280, height: 720 }],
    ["portátil 1366×768", { width: 1366, height: 768 }],
    ["portátil 1366×768 con letra al 125 %", { width: 1366, height: 768 }, 1.25],
    ["escritorio 1440×900 con letra al 125 %", { width: 1440, height: 900 }, 1.25],
    ["móvil 390×844", { width: 390, height: 844 }],
  ]) {
    const t = await h.open({ viewport, seed: seed({ "apr-a": DONE }) });
    await t.start();
    if (scale !== 1) await t.page.evaluate((s) => { document.documentElement.style.fontSize = `${16 * s}px`; }, scale);
    await atStation(t, "apr-b");
    await openIndex(t);
    const index = await noOverflow(t);
    check(`P1 ${name}: el índice cabe en la pantalla y no hay desplazamiento horizontal`, index.fits && !index.scrollX, JSON.stringify(index));
    const axeIndex = await t.axe();
    check(`P2 ${name}: el índice no tiene violaciones de accesibilidad`, axeIndex.length === 0, axeIndex.join(" | "));
    await t.page.getByRole("button", { name: /Explorar: .*La plastilina casera/ }).click();
    await t.page.waitForSelector(".jp-dialog--reader");
    await t.page.waitForTimeout(250);
    const reader = await noOverflow(t);
    check(`P3 ${name}: el lector cabe en la pantalla y no hay desplazamiento horizontal`, reader.fits && !reader.scrollX, JSON.stringify(reader));
    const small = await t.page.evaluate(() => [...document.querySelectorAll(".jp-dialog button")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.height < 40 || r.width < 40) && getComputedStyle(b).display !== "none" && !b.closest("[hidden]"); }).map((b) => `${b.textContent.trim().slice(0, 24) || b.className}: ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`));
    check(`P4 ${name}: todos los botones del lector miden al menos 40 px`, small.length === 0, small.join(" | "));
    const axeReader = await t.axe();
    check(`P5 ${name}: el lector no tiene violaciones de accesibilidad`, axeReader.length === 0, axeReader.join(" | "));
    const overlap = await t.page.evaluate(() => {
      const name = document.querySelector(".jp-badge-name")?.getBoundingClientRect();
      const stage = document.querySelector(".jp-medal-stage")?.getBoundingClientRect();
      return name && stage ? { gap: Math.round(name.top - stage.bottom) } : null;
    });
    check(`P6 ${name}: el nombre de la insignia no se monta sobre el medallón (queda debajo, con aire)`, overlap !== null && overlap.gap >= 4, JSON.stringify(overlap));
    if (viewport.width > 740) {
      const keywords = await t.page.evaluate(() => [...document.querySelectorAll(".jp-keyword")].filter((k) => k.getBoundingClientRect().height > 0).length);
      check(`P9 ${name}: las palabras clave de «En este aprendizaje» siguen a la vista`, keywords === configJson.learnings["apr-b"].keywords.length, String(keywords));
    }
    if (viewport.width > 740) {
      // El lateral conserva el tamaño natural de la ilustración y la insignia; si no cabe todo, se desplaza dentro de sí mismo.
      const side = await t.page.evaluate(() => {
        const sb = document.querySelector(".jp-sidebar");
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const illus = document.querySelector(".jp-sidebar-illustration").getBoundingClientRect().height / rem;
        sb.scrollTop = sb.scrollHeight;
        const box = sb.getBoundingClientRect();
        const link = document.querySelector(".jp-link").getBoundingClientRect();
        const card = document.querySelectorAll(".jp-sidebar-card")[1].getBoundingClientRect();
        return { illus: Math.round(illus * 100) / 100, linkVisible: link.top >= box.top && link.bottom <= box.bottom + 1, linkInsideCard: link.bottom <= card.bottom + 1 };
      });
      check(`P8 ${name}: la ilustración y la insignia del lateral conservan su tamaño natural y «Ver insignia» se alcanza (desplazando si hace falta) dentro de su recuadro`, side.illus >= 7.4 && side.linkVisible && side.linkInsideCard, JSON.stringify(side));
      const focus = await t.page.evaluate(() => ({ onDialog: document.activeElement?.classList.contains("jp-dialog"), ring: !!document.querySelector(".jp-tab:focus-visible") }));
      check(`P10 ${name}: al abrir un aprendizaje el foco está en el diálogo y «Resumen» no lleva anillo de foco`, focus.onDialog && !focus.ring, JSON.stringify(focus));
      const hit = await t.page.evaluate(() => { const b = document.querySelector(".jp-reader-footer .jp-action--primary").getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest(".jp-action--primary") !== null; });
      check(`P12 ${name}: nada del lateral (aunque se desplace) tapa el botón de acción del pie`, hit);
      const closeBg = () => t.page.evaluate(() => getComputedStyle(document.querySelector(".jp-close")).backgroundImage);
      const closeBefore = await closeBg();
      await t.page.hover(".jp-close");
      await t.page.waitForTimeout(150);
      check(`P11 ${name}: la X cambia de aspecto al poner el cursor encima, como en «Mis insignias»`, (await closeBg()) !== closeBefore && /close/.test(await closeBg()), `${closeBefore} → ${await closeBg()}`);
      await t.page.mouse.move(5, 5);
    }
    check(`P7 ${name}: sin errores de consola`, t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }
} catch (e) {
  console.error(`✖ la prueba falló con una excepción: ${e.stack ?? e}`);
  process.exitCode = 1;
} finally {
  await h.finish();
}
