// E2E de la música de fondo (SPEC 6.4; AC-50, AC-51, AC-52) en un navegador real.
// Uso: npm run test:e2e
import { configJson, harness } from "./helpers.mjs";

const { open, check, finish } = await harness();
const TRACKS = configJson.audio.music.tracks.length;

/** Registra cada `new Audio()` que crea la aplicación: es la única forma de observar un audio que no está en el DOM. */
const spy = () => {
  window.__audios = [];
  const Original = window.Audio;
  window.Audio = function (src) {
    const audio = new Original(src);
    window.__audios.push(audio);
    return audio;
  };
  window.Audio.prototype = Original.prototype;
};
const audios = (page) => page.evaluate(() => window.__audios.map((a) => ({ src: a.src.split("/").pop(), paused: a.paused, t: a.currentTime, d: a.duration, volume: a.volume, hasSrc: a.hasAttribute("src") })));
const label = (page) => page.getByRole("button", { name: /música/i }).first();

try {
  // ---- Inicio, apagado y encendido, continuidad entre zonas, rotación ---------------------------------------
  {
    const requests = [];
    const t = await open({ init: spy });
    t.page.on("request", (r) => /\/audio\//.test(r.url()) && requests.push(r.url().split("/").pop()));
    await t.page.waitForTimeout(1500);
    check("AC-50: antes de pulsar «Comenzar» no hay audio ni se piden las pistas", (await audios(t.page)).length === 0 && requests.length === 0, JSON.stringify(requests));
    check("AC-50: la portada no muestra créditos de la música", !(await t.page.locator(".cover").innerText()).match(/Matthew Pablo|CC BY|Beyond The Clouds/i));

    await t.start();
    await t.page.waitForTimeout(2500);
    const a = await audios(t.page);
    check("AC-50: tras «Comenzar» suena la primera pista, que avanza", a.length === 1 && a[0].src === "beyond-the-clouds.mp3" && !a[0].paused && a[0].t > 0.5, JSON.stringify(a));
    check("AC-52: solo se ha pedido la pista que suena (no las tres)", requests.every((r) => r === "beyond-the-clouds.mp3"), JSON.stringify([...new Set(requests)]));
    check("AC-50: el volumen es el configurado o menor", a[0].volume > 0 && a[0].volume <= configJson.audio.music.volume + 1e-6, String(a[0].volume));

    const button = label(t.page);
    const box = await button.boundingBox();
    check("AC-51: el botón de música está en la cabecera, con etiqueta «Silenciar música» y mide ≥ 44 px", (await button.getAttribute("aria-label")) === configJson.ui.labels.musicMute && box.width >= 43.5 && box.height >= 43.5, JSON.stringify(box));

    await button.focus();
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(1000);
    const muted = await audios(t.page);
    check("AC-51: pulsar el botón (con teclado) apaga la música y cambia la etiqueta a «Activar música»", muted[0].paused && (await button.getAttribute("aria-label")) === configJson.ui.labels.musicUnmute, JSON.stringify(muted));
    const stored = await t.stored();
    check("AC-51: la preferencia se guarda aparte del progreso", JSON.parse(stored["bitacora:preferences:v1"]).musicMuted === true && Object.keys(stored).some((k) => k.startsWith("bitacora:progress")) !== undefined, JSON.stringify(Object.keys(stored)));

    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(1500);
    const back = await audios(t.page);
    check("AC-51: volver a pulsar la enciende (misma pista, sin reiniciar)", back.length === 1 && !back[0].paused && back[0].t >= muted[0].t, JSON.stringify(back));

    // Con teclado el foco se queda en el botón; con ratón vuelve al mapa y las flechas siguen funcionando
    check("AC-51: tras pulsar con teclado el foco sigue en el botón", await t.page.evaluate(() => document.activeElement?.classList.contains("hud__music")));
    await label(t.page).click();
    await t.page.waitForTimeout(300);
    check("AC-51: tras pulsar con ratón el foco vuelve al mapa", await t.page.evaluate(() => document.activeElement?.classList.contains("game-host")));
    await label(t.page).click();
    await t.page.waitForTimeout(1200);
    const resumed = await audios(t.page);
    check("AC-51: el ratón también enciende y apaga (volvió a sonar)", !resumed[0].paused, JSON.stringify(resumed));
    const walk = await t.hold(["ArrowRight"], 300);
    check("AC-51: tras usar el botón con ratón Vanessa sigue moviéndose con las flechas", walk.m.pos.x > walk.a.pos.x, JSON.stringify(walk));

    // Continuidad: cambiar de zona y abrir una lectura no corta ni reinicia la música
    await t.place(1380, 440);
    await t.page.waitForTimeout(200);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(900);
    const zone = (await t.scene()).zone;
    const after = await audios(t.page);
    check("AC-52: cambiar de zona no corta ni reinicia la música (misma pista, sigue avanzando)", zone === "zona-b" && after.length === 1 && !after[0].paused && after[0].t > resumed[0].t, JSON.stringify({ zone, after }));

    // Rotación: al final de la pista empieza la siguiente y se libera la anterior
    await t.page.evaluate(() => { const a = window.__audios[0]; a.currentTime = a.duration - 3; });
    await t.page.waitForTimeout(6000);
    const rotated = await audios(t.page);
    check("AC-50: al terminar la primera pista empieza «Enchanted Festival» y la anterior se libera", rotated.length >= 2 && rotated[1].src === "enchanted-festival.mp3" && !rotated[1].paused && !rotated[0].hasSrc, JSON.stringify(rotated));
    check("AC-52: nunca hay más de dos audios activos a la vez", rotated.filter((x) => x.hasSrc).length <= 2);
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Pestaña oculta: pausa y reanuda ---------------------------------------------------------------------
  {
    const t = await open({ init: spy });
    await t.start();
    await t.page.waitForTimeout(1500);
    await t.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await t.page.waitForTimeout(300);
    const hidden = await audios(t.page);
    await t.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    await t.page.waitForTimeout(800);
    const visible = await audios(t.page);
    check("AC-52: con la pestaña oculta se pausa y al volver reanuda", hidden[0].paused && !visible[0].paused, JSON.stringify({ hidden, visible }));
    await t.close();
  }

  // ---- La preferencia sobrevive: apagada, no suena sola en la siguiente visita ------------------------------
  {
    const t = await open({ init: spy, seed: { "bitacora:preferences:v1": JSON.stringify({ musicMuted: true }) } });
    await t.start();
    await t.page.waitForTimeout(1500);
    const a = await audios(t.page);
    check("AC-51: con la música apagada en una visita anterior, «Comenzar» no la hace sonar", a.length === 0 && (await label(t.page).getAttribute("aria-label")) === configJson.ui.labels.musicUnmute, JSON.stringify(a));
    await label(t.page).click();
    await t.page.waitForTimeout(1500);
    const on = await audios(t.page);
    check("AC-51: y al encenderla empieza la primera pista", on.length === 1 && on[0].src === "beyond-the-clouds.mp3" && !on[0].paused, JSON.stringify(on));
    await t.close();
  }

  // ---- Un archivo que falla no rompe el juego: se omite y suena la siguiente --------------------------------
  {
    const t = await open({ init: spy, blockUrl: "**/beyond-the-clouds.mp3" });
    await t.start();
    await t.page.waitForTimeout(3500);
    const a = await audios(t.page);
    const before = (await t.scene()).pos;
    const { m } = await t.hold(["ArrowRight"], 400);
    check("AC-52: si la primera pista no carga se pasa a la siguiente", a.some((x) => x.src === "enchanted-festival.mp3" && !x.paused), JSON.stringify(a));
    check("AC-52: y el juego sigue funcionando (Vanessa se mueve)", m.pos.x > before.x, JSON.stringify({ before, m: m.pos }));
    await t.close();
  }

  // ---- Música desactivada por configuración: no hay botón ni audio ------------------------------------------
  {
    const t = await open({ init: spy, edit: (c) => { c.audio.music.active = false; } });
    await t.start();
    await t.page.waitForTimeout(1000);
    check("con audio.music.active = false no hay audio ni botón de música", (await audios(t.page)).length === 0 && (await label(t.page).count()) === 0);
    await t.close();
  }

  // ---- La música no es movimiento: con movimiento reducido sigue pudiendo sonar -----------------------------
  {
    const t = await open({ init: spy, reducedMotion: true });
    await t.start();
    await t.page.waitForTimeout(2000);
    const a = await audios(t.page);
    check("la música es independiente de prefers-reduced-motion (sigue el control del visitante)", a.length === 1 && !a[0].paused, JSON.stringify(a));
    check(`la lista tiene ${TRACKS} pistas configuradas`, TRACKS === 3);
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
