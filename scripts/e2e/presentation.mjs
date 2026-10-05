// E2E de la presentación (portada con el kit `ui.presentation.*`, SPEC 7, AC-87): se ve completa y proporcionada en escritorio, portátil,
// tableta y móvil, sin desplazamiento horizontal, con todas sus imágenes cargadas, accesible y con su botón funcionando. Uso: node scripts/e2e/presentation.mjs
import { configJson, harness, START, startLabel } from "./helpers.mjs";

const h = await harness();
const { check } = h;
const P = configJson.project;

try {
  for (const [name, viewport] of [
    ["escritorio 1672×941", { width: 1672, height: 941 }],
    ["portátil 1366×768", { width: 1366, height: 768 }],
    ["portátil 1280×720", { width: 1280, height: 720 }],
    ["tableta 1024×768", { width: 1024, height: 768 }],
    ["tableta vertical 820×1180", { width: 820, height: 1180 }],
    ["móvil 390×844", { width: 390, height: 844 }],
    ["móvil pequeño 360×640", { width: 360, height: 640 }],
  ]) {
    const t = await h.open({ viewport });
    await t.page.waitForTimeout(500);
    const wide = viewport.width > 800;
    const m = await t.page.evaluate(() => {
      const r = (s) => document.querySelector(s)?.getBoundingClientRect();
      const panel = r(".prs-panel"); const title = r(".prs-title"); const hero = r(".prs-hero"); const copy = r(".prs-copy"); const btn = r(".prs-continue");
      const cover = document.querySelector(".cover");
      const images = [...document.querySelectorAll(".prs-panel img")];
      return {
        panel: panel && { w: panel.width, h: panel.height, top: panel.top, bottom: panel.bottom, left: panel.left, right: panel.right },
        titleTop: title?.top, heroInside: hero ? hero.left >= panel.left && hero.right <= panel.right + 1 && hero.bottom <= panel.bottom + 1 : false,
        copyRight: copy?.right, heroLeft: hero?.left, btn: btn && { w: btn.width, h: btn.height, bottom: btn.bottom, top: btn.top },
        coverScroll: cover.scrollHeight - cover.clientHeight, hscroll: document.documentElement.scrollWidth > innerWidth || cover.scrollWidth > cover.clientWidth + 1,
        broken: images.filter((i) => !(i.complete && i.naturalWidth > 0)).length, images: images.length, viewportH: innerHeight, viewportW: innerWidth,
        active: document.activeElement?.className, focusRing: !!document.querySelector(".prs-continue:focus-visible"),
      };
    });
    check(`${name}: el panel y su letrero caben a lo ancho y no hay desplazamiento horizontal`, m.panel.left >= 0 && m.panel.right <= m.viewportW + 1 && !m.hscroll, JSON.stringify(m.panel));
    if (wide) check(`${name}: el panel entero cabe en la pantalla, con su letrero, sin desplazarse`, m.panel.bottom <= m.viewportH && m.titleTop >= 0 && m.coverScroll <= 1, JSON.stringify({ bottom: m.panel.bottom, titleTop: m.titleTop, scroll: m.coverScroll }));
    else check(`${name}: en una columna, el panel se desplaza y el botón se alcanza`, m.btn.h >= 40 && m.btn.w >= 120, JSON.stringify(m.btn));
    check(`${name}: la proporción de la maqueta se conserva (1040 × 716)`, !wide || Math.abs(m.panel.w / m.panel.h - 1040 / 716) < 0.02, `${m.panel.w}×${m.panel.h}`);
    if (wide) check(`${name}: el texto no pasa sobre la ilustración (la columna de texto termina donde empieza Vanessa)`, m.copyRight <= m.heroLeft + 20, `${m.copyRight} vs ${m.heroLeft}`);
    check(`${name}: la ilustración queda dentro del panel y las ${m.images} imágenes cargaron`, m.heroInside && m.broken === 0, `${m.broken} sin cargar`);
    check(`${name}: el botón mide al menos 40 px de alto y el foco inicial está en él, sin anillo`, m.btn.h >= 40 && /prs-continue/.test(m.active) && !m.focusRing, JSON.stringify({ btn: m.btn, active: m.active, ring: m.focusRing }));
    const axe = await t.axe();
    check(`${name}: sin violaciones de accesibilidad (axe)`, axe.length === 0, axe.join(" | "));
    check(`${name}: sin errores de consola`, t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Contenido y comportamiento ----
  {
    const t = await h.open();
    const text = (await t.page.locator(".cover").innerText()).replace(/\s+/g, " ");
    check("la presentación muestra el título, el subtítulo, la asignatura, la estudiante, el programa, la universidad y el semestre del bitacora.json", [P.title, P.subtitle, P.courseName, P.studentName, P.program, P.university, `${configJson.ui.labels.semester} ${P.semester}`, P.welcomeTitle, P.welcomeText.slice(0, 40), configJson.ui.presentation.labels.subjectLabel].every((x) => text.includes(x)), text.slice(0, 200));
    check("el título de la pestaña del navegador es «título — subtítulo | estudiante»", (await t.page.title()) === `${P.title} — ${P.subtitle} | ${P.studentName}`, await t.page.title());
    check("la presentación no tiene botón de cerrar: solo el de continuar", (await t.page.locator(".cover button").count()) === 1 && (await startLabel(t.page)) === "Comenzar recorrido");
    const before = await t.page.evaluate(() => getComputedStyle(document.querySelector(".prs-button-bg")).filter);
    await t.page.hover(".prs-continue");
    await t.page.waitForTimeout(150);
    check("al pasar el cursor el botón se ilumina", (await t.page.evaluate(() => getComputedStyle(document.querySelector(".prs-button-bg")).filter)) !== before);
    await t.page.evaluate(() => document.activeElement?.blur());
    let ring = false;
    for (let i = 0; i < 4 && !ring; i++) {
      await t.page.keyboard.press("Tab");
      ring = await t.page.evaluate(() => document.activeElement?.classList.contains("prs-continue") && !!document.querySelector(".prs-continue:focus-visible"));
    }
    check("con el teclado (Tab) el botón muestra su anillo de foco", ring);
    check("Enter sobre el botón inicia el recorrido y la portada desaparece", await (async () => { await t.page.focus(".prs-continue"); await t.page.keyboard.press("Enter"); await t.page.waitForTimeout(500); return (await t.page.locator(".cover").count()) === 0 && (await t.page.locator(".hud").count()) === 1; })());
    await t.close();
  }

  // ---- Letra grande: la presentación sigue entera (el panel crece con el tamaño de letra hasta el límite de la pantalla) ----
  {
    const t = await h.open({ viewport: { width: 1366, height: 768 } });
    await t.page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });
    await t.page.waitForTimeout(300);
    const m = await t.page.evaluate(() => { const p = document.querySelector(".prs-panel").getBoundingClientRect(); const c = document.querySelector(".cover"); return { bottom: p.bottom, h: innerHeight, scroll: c.scrollHeight - c.clientHeight, right: p.right, w: innerWidth }; });
    check("con letra al 125 % el panel sigue entero en la pantalla (se reduce a lo que cabe)", m.bottom <= m.h && m.right <= m.w && m.scroll <= 1, JSON.stringify(m));
    await t.close();
  }

  // ---- Respaldo: sin `ui.presentation` se ve la portada sencilla ----
  {
    const t = await h.open({ edit: (c) => { delete c.ui.presentation; } });
    check("sin `ui.presentation` se usa la portada sencilla (su ventana y su botón verde), con el título completo", (await t.page.locator(".prs-panel").count()) === 0 && (await t.page.locator(".cover__window .pixel-button").count()) === 1 && (await t.page.locator(".cover h1").innerText()).includes(P.title), "");
    await t.close();
  }
} catch (e) {
  console.error(`✖ la prueba falló con una excepción: ${e.stack ?? e}`);
  process.exitCode = 1;
} finally {
  await h.finish();
}
