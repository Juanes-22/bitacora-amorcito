// E2E de los efectos de sonido del juego (SPEC 6.5) en un navegador real: autorización por el gesto de «Comenzar», sonidos del mapa por
// distancia, silencio de lectura, botón «Sonido», efectos de interfaz y de recompensa, cambio de zona y configuraciones sin efectos.
// Los sonidos son tonos de prueba generados: aquí se comprueba el comportamiento (voces, volúmenes, peticiones), no cómo SUENAN.
// Uso: node scripts/e2e/sfx.mjs
import { configJson, harness } from "./helpers.mjs";

const { open, check, finish } = await harness();

const diag = (page) => page.evaluate(() => {
  const s = window.__BITACORA_SFX__;
  if (!s) return { status: "none", unlocked: false, muted: false, hidden: false, suspended: [], zone: null, emitters: [], voices: [], errors: [] };
  const d = s.diagnostics();
  return { status: d.state.status, unlocked: d.state.unlocked, muted: d.state.muted, hidden: d.state.hidden, suspended: [...d.state.suspended], zone: s.zoneId, emitters: d.emitters.map((e) => ({ id: e.id, state: e.state, playing: e.playing })), voices: d.voices.map((v) => ({ kind: v.kind, key: v.key, effective: v.effective, spatial: v.factors.spatial })), errors: [...d.state.errors] };
});
const ambient = (d) => d.voices.filter((v) => v.kind === "ambient");
const spyEvents = (page) => page.evaluate(() => {
  const s = window.__BITACORA_SFX__;
  window.__ev = [];
  const original = s.playEvent.bind(s);
  s.playEvent = (e, o) => { window.__ev.push([e, o?.effectId ?? null]); return original(e, o); };
});
const events = (page) => page.evaluate(() => window.__ev.splice(0));
const soundButton = (page) => page.locator(".hud__music");
const sfxRequests = (page, list) => page.on("request", (r) => /\/audio\/sfx\//.test(r.url()) && list.push(r.url().split("/").pop()));
const RIVER = [1110, 770]; // junto al río de la pradera
const FAR = [100, 1000]; // lejos de todo sonido de la zona A

try {
  // ---- Autorización: nada suena ni se pide antes del gesto --------------------------------------------------
  {
    const requests = [];
    const t = await open({ query: "" });
    sfxRequests(t.page, requests);
    await t.page.waitForTimeout(1500);
    const d = await diag(t.page);
    // Los sonidos de la zona activa pueden precargarse detrás de la portada (no suenan); los efectos de interfaz se cargan con el gesto.
    check("SFX-1: antes de pulsar «Comenzar» no hay voces, el audio no está autorizado y no se piden los efectos de interfaz", d.voices.length === 0 && !d.unlocked && !requests.some((r) => /test-(ui-open|ui-confirm|badge|portal)\.wav/.test(r)), JSON.stringify({ d, requests }));
    await t.start();
    await t.page.waitForTimeout(1500);
    const after = await diag(t.page);
    check("SFX-2: tras «Comenzar» el audio queda autorizado y listo", after.unlocked && after.status === "ready", JSON.stringify(after));
    check("SFX-3: se precargan los efectos de interfaz configurados (y no los de otras zonas)", ["test-ui-open.wav", "test-ui-confirm.wav", "test-badge.wav", "test-portal.wav"].every((f) => requests.includes(f)), JSON.stringify(requests));

    // ---- Sonidos del mapa por distancia --------------------------------------------------------------------
    await t.place(...RIVER);
    await t.page.waitForTimeout(1800);
    const near = await diag(t.page);
    check("SFX-4: junto al río suena su bucle, con volumen por distancia", ambient(near).length >= 1 && ambient(near).some((v) => v.key === "audio.sfx.test-river" && v.effective > 0), JSON.stringify(near.voices));
    await t.place(...FAR);
    await t.page.waitForTimeout(2200);
    const far = await diag(t.page);
    check("SFX-5: lejos de todo alcance no queda ninguna voz de ambiente", ambient(far).length === 0, JSON.stringify(far.voices));

    // ---- Lectura: el ambiente calla y vuelve --------------------------------------------------------------
    await spyEvents(t.page);
    await t.place(...RIVER);
    await t.page.waitForTimeout(1500);
    await t.exploreFromIndex("apr-a");
    await t.page.waitForTimeout(500);
    const reading = await diag(t.page);
    check("SFX-6: con una lectura abierta el ambiente se suspende (sin voces de ambiente)", reading.suspended.includes("reading") && ambient(reading).length === 0, JSON.stringify(reading));
    const opened = await events(t.page);
    // Se abrió el panel de la Bitácora (una apertura real) y desde él la lectura (otra): dos «ui.open», ninguno de más.
    check("SFX-7: «ui.open» suena solo en aperturas reales: el panel de la Bitácora y la lectura (dos), nada más", opened.length === 2 && opened.every(([e]) => e === "ui.open"), JSON.stringify(opened));

    // ---- Recompensa: confirmar una sola vez por sección y una vez la insignia ---------------------------------
    await t.readAndClaim();
    await t.page.waitForTimeout(900);
    const reward = await events(t.page);
    check("SFX-8: cada sección marcada hace «ui.confirm» una vez y la insignia «badge.earned» una sola vez, con su identificador", reward.filter(([e]) => e === "ui.confirm").length === 3 && reward.filter(([e]) => e === "badge.earned").length === 1 && reward.find(([e]) => e === "badge.earned")[1], JSON.stringify(reward));

    // Cerrar la celebración devuelve el ambiente
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(600);
    const closeButton = t.page.getByRole("button", { name: /Cerrar|Seguir/i }).first();
    if (await closeButton.count()) await closeButton.click().catch(() => undefined);
    await t.page.waitForTimeout(800);
    await t.place(...RIVER);
    await t.page.waitForTimeout(1800);
    const back = await diag(t.page);
    check("SFX-9: al cerrar la lectura el ambiente vuelve", !back.suspended.includes("reading") && ambient(back).length >= 1, JSON.stringify(back));

    // ---- Botón «Sonido» ------------------------------------------------------------------------------------
    await soundButton(t.page).click();
    await t.page.waitForTimeout(600);
    const muted = await diag(t.page);
    check("SFX-10: «Sonido» silencia los efectos: ninguna voz, y la preferencia se guarda", muted.muted && muted.voices.length === 0 && JSON.parse((await t.stored())["bitacora:preferences:v1"]).soundMuted === true, JSON.stringify(muted));
    await soundButton(t.page).click();
    await t.page.waitForTimeout(1800);
    const unmuted = await diag(t.page);
    check("SFX-11: al reactivarlo los bucles vuelven a empezar", !unmuted.muted && ambient(unmuted).length >= 1, JSON.stringify(unmuted));

    // ---- Pestaña oculta ------------------------------------------------------------------------------------
    await t.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await t.page.waitForTimeout(400);
    const hidden = await diag(t.page);
    await t.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    await t.page.waitForTimeout(1800);
    const visible = await diag(t.page);
    check("SFX-12: con la pestaña oculta no suena nada y al volver el ambiente se reanuda", hidden.voices.length === 0 && ambient(visible).length >= 1, JSON.stringify({ hidden, visible }));

    // ---- Cambio de zona -------------------------------------------------------------------------------------
    await t.place(1380, 440);
    await t.page.waitForTimeout(250);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(1600);
    const zoneB = await diag(t.page);
    const portalEvents = await events(t.page);
    check("SFX-13: al cruzar el portal suena «portal.travel» y los emisores son los de la nueva zona", zoneB.zone === "zona-b" && portalEvents.some(([e]) => e === "portal.travel") && zoneB.emitters.map((e) => e.id).sort().join() === "campana-entrada,cascada-pabellon,viento-lomas" && !zoneB.emitters.some((e) => e.id === "rio-pradera"), JSON.stringify({ zoneB, portalEvents }));
    check("SFX-14: sin errores de consola ni de carga de audio", t.errors.length === 0 && zoneB.errors.length === 0, JSON.stringify({ errors: t.errors, audio: zoneB.errors }));
    await t.close();
  }

  // ---- Configuraciones sin efectos ----------------------------------------------------------------------------
  {
    const requests = [];
    const t = await open({ edit: (c) => { c.audio.sfx.active = false; } });
    sfxRequests(t.page, requests);
    await t.start();
    await t.place(...RIVER);
    await t.page.waitForTimeout(1800);
    const d = await diag(t.page);
    check("SFX-15: con audio.sfx.active = false no se pide ningún efecto ni suena nada, y la música sigue con su botón", requests.length === 0 && d.voices.length === 0 && (await soundButton(t.page).count()) === 1, JSON.stringify({ requests, d }));
    check("SFX-16: con los efectos apagados el botón habla de música", (await soundButton(t.page).getAttribute("aria-label")) === configJson.ui.labels.musicMute);
    await t.close();
  }
  {
    // Una configuración antigua (sin `audio.sfx` ni `sounds`) carga igual y conserva la música
    const t = await open({ init: () => { window.__audios = []; const O = window.Audio; window.Audio = function (src) { const a = new O(src); window.__audios.push(a); return a; }; window.Audio.prototype = O.prototype; }, edit: (c) => { delete c.audio.sfx; for (const z of Object.values(c.maps)) delete z.sounds; } });
    await t.start();
    await t.place(...RIVER);
    await t.page.waitForTimeout(2000);
    const sfx = await t.page.evaluate(() => window.__BITACORA_SFX__);
    const music = await t.page.evaluate(() => window.__audios.filter((a) => !a.paused).length);
    check("SFX-17: sin `audio.sfx` ni `sounds` (configuración antigua) no existe el servicio de efectos, la música sigue sonando y el juego funciona igual", sfx === null && music === 1 && t.errors.length === 0, JSON.stringify({ sfx, music, errors: t.errors }));
    await t.close();
  }
  {
    const t = await open({ viewport: { width: 390, height: 844 } });
    await t.start();
    await t.place(...RIVER);
    await t.page.waitForTimeout(1800);
    const box = await soundButton(t.page).boundingBox();
    check("SFX-18: en móvil el botón «Sonido» mide ≥ 44 px y los efectos funcionan igual", box.width >= 43.5 && box.height >= 43.5 && ambient(await diag(t.page)).length >= 1, JSON.stringify(box));
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.stack ?? error).split("\n").slice(0, 3).join(" ")}`, false);
} finally {
  await finish();
}
