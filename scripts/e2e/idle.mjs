// E2E del reposo de Vanessa y Jerry (SPEC 6.2; AC-62, AC-63, AC-64) en un navegador real.
// Uso: npm run test:e2e
import { readFileSync } from "node:fs";
import { configJson, harness, SPOT_A, stationSpot } from "./helpers.mjs";
const manifest = JSON.parse(readFileSync("public/assets/assets.json", "utf8"));

const { open, check, finish, browser } = await harness();
const IDLE = configJson.gameplay.player.idle;
const WALK = configJson.gameplay.player.assetId;
/** Tiempos cortos solo para esta página (la configuración real usa 4,5 s / 10 s / 8 s). */
const FAST = (c) => { Object.assign(c.gameplay.player.idle, { glanceAfterMs: 700, playAfterMs: 1500, gestureCooldownMs: 600 }); c.gameplay.player.idle.fetch.holdMs = 1200; };

const sprite = (t) =>
  t.page.evaluate(() => {
    const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene");
    const sp = s.player.sprite;
    return { texture: sp.texture.key, frame: sp.frame.name, anim: sp.anims.currentAnim?.key ?? null, playing: sp.anims.isPlaying, originX: sp.originX, originY: sp.originY, x: sp.x, y: sp.y, scale: sp.scaleX, pos: s.player.position };
  });
/** Muestrea las animaciones que van saliendo durante `ms`. */
const watch = async (t, ms, step = 80) => {
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await sprite(t);
    if (s.anim && seen.at(-1) !== s.anim) seen.push(s.anim);
    await t.page.waitForTimeout(step);
  }
  return seen;
};
const ADJUST = Object.fromEntries(manifest.assets["character.vanessa-jerry.idle-anim.tricks"].frameAdjust.map((f) => [f.name, f]));
const BASE = configJson.gameplay.player.scale;
const A = (name) => `vanessa-jerry-idle${name}`;
const TRICKS = "vanessa-jerry-tricks", FETCH = "vanessa-jerry-fetch-plush";
const focusMap = (t) => t.page.evaluate(() => document.querySelector(".game-host").focus());

try {
  // ---- Reposo al detenerse, en cada dirección ----------------------------------------------------------------
  {
    const t = await open();
    await t.start();
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(700);
    const s0 = await sprite(t);
    check("AC-62: al quedarse quieta respira y parpadea (hoja de reposo, de frente, en bucle)", s0.texture === IDLE.rest && s0.anim === A("-front") && s0.playing, JSON.stringify(s0));
    check("AC-62: conserva la escala del caminar y los pies sobre el punto de apoyo", Math.abs(s0.scale - configJson.gameplay.player.scale) < 1e-6 && Math.abs(s0.x - s0.pos.x) < 0.01 && Math.abs(s0.y - s0.pos.y) < 0.01, JSON.stringify(s0));

    for (const [dir, expected] of [["ArrowRight", "-right"], ["ArrowLeft", "-left"], ["ArrowUp", "-back"], ["ArrowDown", "-front"]]) {
      await t.page.evaluate(() => document.querySelector(".game-host").focus());
      await t.page.keyboard.down(dir);
      await t.page.waitForTimeout(250);
      const walking = await sprite(t);
      await t.page.keyboard.up(dir);
      await t.page.waitForTimeout(160);
      const resting = await sprite(t);
      check(`AC-62: caminando (${dir}) usa la hoja de caminar y al soltar pasa al reposo «${expected.slice(1)}» sin esperar`, walking.texture === WALK && resting.texture === IDLE.rest && resting.anim === A(expected) && resting.playing, JSON.stringify({ walking: walking.anim, resting: resting.anim }));
    }
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Gestos: mirada, luego juego, cada uno una sola vez y sin solaparse --------------------------------------
  {
    const t = await open({ edit: FAST });
    await t.start();
    await t.place(...SPOT_A);
    // Un paso hacia abajo reinicia la espera (y deja a Vanessa de frente): la secuencia se observa desde el principio.
    await t.page.evaluate(() => document.querySelector(".game-host").focus());
    await t.page.keyboard.down("ArrowDown");
    await t.page.waitForTimeout(100);
    await t.page.keyboard.up("ArrowDown");
    const seen = (await watch(t, 9000)).filter((k) => !/walk/.test(k));
    const gestures = seen.filter((k) => k !== A("-front"));
    check("AC-63: la secuencia es reposo → mirada a Jerry → reposo → juego → reposo", JSON.stringify(seen.slice(0, 5)) === JSON.stringify([A("-front"), A("-look-front"), A("-front"), A("-play"), A("-front")]), JSON.stringify(seen));
    check("AC-63: los gestos se turnan después (mirada, juego, mirada…) y los trucos no salen solos", JSON.stringify(gestures.slice(0, 3)) === JSON.stringify([A("-look-front"), A("-play"), A("-look-front")]) && !seen.includes(TRICKS) && !seen.includes(FETCH), JSON.stringify(gestures));
    const texturesUsed = await t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").player.sprite.texture.key);
    check("el sprite nunca queda con dos animaciones a la vez (una sola hoja activa)", [IDLE.rest, IDLE.glance, IDLE.play].includes(texturesUsed));
    await t.close();
  }

  // ---- Moverse cancela el gesto; cerrar una lectura lo reanuda --------------------------------------------------
  {
    const t = await open({ edit: FAST });
    await t.start();
    await t.place(...SPOT_A);
    for (let i = 0; i < 60 && (await sprite(t)).anim !== A("-look-front"); i++) await t.page.waitForTimeout(100);
    check("(preparación) llegó la mirada", (await sprite(t)).anim === A("-look-front"));
    await t.page.evaluate(() => document.querySelector(".game-host").focus());
    await t.page.keyboard.down("ArrowRight");
    await t.page.waitForTimeout(150);
    const cancelled = await sprite(t);
    await t.page.keyboard.up("ArrowRight");
    await t.page.waitForTimeout(150);
    const after = await sprite(t);
    check("AC-63: al recibir movimiento se cancela el gesto y se camina de inmediato", cancelled.texture === WALK && /walk-right/.test(cancelled.anim ?? ""), JSON.stringify(cancelled));
    check("AC-63: al soltar vuelve al reposo mirando a la derecha y el temporizador empieza de cero", after.anim === A("-right"), JSON.stringify(after));

    // Una lectura detiene el mapa; al cerrarla el reposo sigue vivo
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(300);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(500);
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(700);
    const resumed = await sprite(t);
    check("AC-17: tras abrir y cerrar una lectura Vanessa vuelve a su reposo animado", resumed.texture !== WALK && resumed.playing, JSON.stringify(resumed));
    await t.close();
  }

  // ---- De lado no hay juego, solo la mirada -----------------------------------------------------------------------
  {
    const t = await open({ edit: FAST });
    await t.start();
    await t.place(...SPOT_A);
    await t.page.evaluate(() => document.querySelector(".game-host").focus());
    await t.page.keyboard.down("ArrowLeft");
    await t.page.waitForTimeout(150);
    await t.page.keyboard.up("ArrowLeft");
    const seen = await watch(t, 6000);
    check("AC-63: mirando a la izquierda se repite la mirada y nunca hay juego", seen.includes(A("-look-left")) && !seen.includes(A("-play")), JSON.stringify(seen));
    await t.close();
  }

  // ---- Movimiento reducido: pose fija, sin bucle ni gestos ------------------------------------------------------
  {
    const t = await open({ edit: FAST, reducedMotion: true });
    await t.start();
    await t.place(...SPOT_A);
    const seen = await watch(t, 3500);
    const s = await sprite(t);
    check("AC-64: con prefers-reduced-motion queda el primer fotograma del reposo, sin animación", s.texture === IDLE.rest && s.frame === "front-00" && !s.playing && seen.length === 0, JSON.stringify({ s, seen }));
    await t.page.evaluate(() => document.querySelector(".game-host").focus());
    await t.page.keyboard.down("ArrowRight");
    await t.page.waitForTimeout(250);
    const walking = await sprite(t);
    await t.page.keyboard.up("ArrowRight");
    await t.page.waitForTimeout(200);
    const stopped = await sprite(t);
    check("AC-64: caminar sigue animándose y al detenerse vuelve a la pose fija mirando a la derecha", walking.texture === WALK && stopped.texture === IDLE.rest && stopped.frame === "right-00" && !stopped.playing, JSON.stringify({ walking: walking.anim, stopped }));
    await t.close();
  }

  // ---- Cambio de zona: el reposo funciona en la zona nueva --------------------------------------------------------
  {
    const t = await open();
    await t.start();
    await t.place(1380, 440);
    await t.page.waitForTimeout(250);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(900);
    const s = await sprite(t);
    check("tras cambiar de zona Vanessa reposa con su animación", (await t.scene()).zone === "zona-b" && s.texture === IDLE.rest && s.playing, JSON.stringify(s));
    check("sin errores de consola tras el cambio de zona", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Una hoja de reposo que no carga: se queda la pose quieta de caminar y el juego sigue -----------------------
  {
    const t = await open({ blockUrl: "**/vanessa-jerry-idle-look.png" });
    await t.start();
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(600);
    const s = await sprite(t);
    check("si falta una hoja de reposo se conserva la pose quieta de la hoja de caminar", s.texture === WALK, JSON.stringify(s));
    const { m } = await t.hold(["ArrowRight"], 300);
    check("y el juego sigue funcionando (Vanessa se mueve)", m.pos.x > SPOT_A[0], JSON.stringify(m.pos));
    await t.close();
  }
  // ---- Jugar con Jerry: la tecla P y el botón alternan buscar el peluche y los trucos (SPEC 6.2; AC-65, AC-66) ----
  {
    const t = await open({ edit: (c) => { c.gameplay.player.idle.fetch.holdMs = 1500; } });
    await t.start();
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(500);
    const before = (await t.scene()).pos;
    await focusMap(t);
    await t.page.keyboard.press("p");
    await t.page.waitForTimeout(200);
    const early = await sprite(t);
    check("AC-65: la primera vez que se pulsa P, Jerry busca el peluche (hoja de la búsqueda, una vez)", early.texture === IDLE.fetch.sheet && early.anim === FETCH && early.playing, JSON.stringify(early));
    await t.page.keyboard.press("p");
    await t.page.waitForTimeout(150);
    check("AC-65: pulsar P durante la acción no la reinicia ni la cambia", (await sprite(t)).anim === FETCH && !(await t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").player.sprite.anims.currentFrame.isFirst)));
    check("AC-65: Vanessa permanece fija en el mapa mientras tanto", JSON.stringify((await sprite(t)).pos) === JSON.stringify(before));
    await t.page.waitForTimeout(2200); // 12 fotogramas a 6 fps = 2 s
    const held = await sprite(t);
    check("AC-65: al terminar se mantiene el último fotograma con el peluche", held.texture === IDLE.fetch.sheet && held.frame === "frame-11" && !held.playing, JSON.stringify(held));
    await t.page.waitForTimeout(1700);
    const back = await sprite(t);
    check("AC-65: tras la espera vuelve al reposo", back.texture === IDLE.rest && back.anim === A("-front") && back.playing, JSON.stringify(back));

    // La segunda vez: los trucos de Jerry, con dar la pata
    await t.page.keyboard.press("p");
    await t.page.waitForTimeout(200);
    const second = await sprite(t);
    check("AC-65: la segunda vez que se pulsa P, Jerry hace sus trucos (salto, sentarse, dar la pata, levantarse)", second.texture === IDLE.tricks.sheet && second.anim === TRICKS && second.playing, JSON.stringify(second));
    const frames = new Set();
    const wrong = [];
    for (let i = 0; i < 60; i++) {
      const s = await sprite(t);
      frames.add(s.frame);
      // Corrección de la hoja v2: en cada fotograma, la escala del caminar por su factor y el origen de sus pies.
      const adj = ADJUST[s.frame];
      if (s.anim === TRICKS && adj && (Math.abs(s.scale - BASE * adj.scaleMultiplier) > 1e-6 || Math.abs(s.originX - adj.origin.x) > 1e-6 || Math.abs(s.originY - adj.origin.y) > 1e-6)) wrong.push({ frame: s.frame, scale: s.scale, originX: s.originX, originY: s.originY });
      await t.page.waitForTimeout(40);
    }
    check("AC-65: pasa por la parte de dar la pata (fotogramas 6 a 9) de la secuencia", ["frame-06", "frame-07", "frame-08", "frame-09"].every((f) => frames.has(f)), JSON.stringify([...frames]));
    check("AC-65: durante los trucos cada fotograma lleva la escala y el origen corregidos (Vanessa no se ve más grande)", wrong.length === 0 && frames.size >= 6, JSON.stringify(wrong.slice(0, 3)));
    await t.page.waitForTimeout(500);
    const afterTricks = await sprite(t);
    check("AC-65: al acabar los trucos vuelve directo al reposo (sin mantener nada)", afterTricks.texture === IDLE.rest && afterTricks.playing, JSON.stringify(afterTricks));
    check("AC-65: y recupera la escala del caminar", Math.abs(afterTricks.scale - BASE) < 1e-6, String(afterTricks.scale));
    await t.page.keyboard.press("p");
    await t.page.waitForTimeout(200);
    check("AC-65: y la tercera vez vuelve a ser buscar el peluche (se turnan)", (await sprite(t)).anim === FETCH);

    // Moverse cancela la acción
    await t.page.keyboard.down("ArrowRight");
    await t.page.waitForTimeout(200);
    const walking = await sprite(t);
    await t.page.keyboard.up("ArrowRight");
    check("AC-65: moverse cancela la acción y se camina de inmediato", walking.texture === WALK, JSON.stringify(walking));

    // Con una ventana abierta la tecla no hace nada, ni al cerrarla
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(300);
    await t.page.keyboard.press("Enter");
    await t.page.waitForTimeout(400);
    await t.page.keyboard.press("p");
    await t.page.keyboard.press("Escape");
    await t.page.waitForTimeout(600);
    const aft = await sprite(t);
    check("AC-65: la tecla pulsada con una lectura abierta no hace nada al cerrarla", aft.anim !== FETCH && aft.anim !== TRICKS, JSON.stringify(aft));
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  {
    const t = await open({ viewport: { width: 390, height: 844 } });
    await t.start();
    const button = t.page.getByRole("button", { name: /Jugar con Jerry/ });
    const box = await button.boundingBox();
    check("AC-66: en un móvil hay un botón «Jugar con Jerry (P)» en la cabecera, de ≥ 44 px", !!box && box.width >= 43.5 && box.height >= 43.5, JSON.stringify(box));
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(500);
    await button.click();
    await t.page.waitForTimeout(300);
    check("AC-66: pulsar el botón hace que Jerry busque el peluche", (await sprite(t)).anim === FETCH, JSON.stringify(await sprite(t)));
    check("AC-66: tras pulsarlo el foco vuelve al mapa", await t.page.evaluate(() => document.activeElement?.classList.contains("game-host")));
    await t.page.waitForTimeout(5200); // 2 s de búsqueda + 2,2 s de espera
    await button.click();
    await t.page.waitForTimeout(300);
    check("AC-66: pulsarlo otra vez lanza los trucos de Jerry", (await sprite(t)).anim === TRICKS, JSON.stringify(await sprite(t)));
    await t.page.waitForTimeout(500);
    const a11y = await t.axe();
    check("axe-core: la cabecera con el nuevo botón no tiene violaciones", a11y.length === 0, a11y.join(" | "));
    await t.page.getByRole("button", { name: /Bitácora de aprendizajes/ }).click();
    await t.page.waitForTimeout(300);
    check("AC-66: con una ventana abierta el botón está desactivado", await button.isDisabled());
    await t.close();
  }

  {
    // Se puede pedir mientras camina por toque: detiene el recorrido
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const t = await open({ viewport: { width: 390, height: 844 }, context });
    await t.start();
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(300);
    const p = await t.page.evaluate(() => { const c = window.__PHASER_GAME__.scene.getScene("ExplorationScene").cameras.main; return { x: (200 - c.worldView.x) * c.zoom, y: (1030 - c.worldView.y) * c.zoom }; });
    await t.page.touchscreen.tap(p.x, p.y);
    await t.page.waitForTimeout(250);
    check("(preparación) camina por toque", Math.hypot(...(await t.scene()).vel) > 100);
    await t.page.getByRole("button", { name: /Jugar con Jerry/ }).tap();
    await t.page.waitForTimeout(300);
    const s = await sprite(t);
    check("AC-66: pedirlo mientras camina por toque detiene a Vanessa y empieza la acción", s.anim === FETCH && Math.hypot(...(await t.scene()).vel) === 0, JSON.stringify(s));
    await t.close();
  }

  {
    // Movimiento reducido: sin animación, pero el visitante ve el resultado el tiempo de espera
    const t = await open({ reducedMotion: true, edit: (c) => { c.gameplay.player.idle.fetch.holdMs = 1200; } });
    await t.start();
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(400);
    await focusMap(t);
    await t.page.keyboard.press("p");
    await t.page.waitForTimeout(250);
    const s = await sprite(t);
    check("AC-64: con movimiento reducido la búsqueda muestra un solo fotograma, el del peluche, sin animar", s.texture === IDLE.fetch.sheet && s.frame === "frame-11" && !s.playing, JSON.stringify(s));
    await t.page.waitForTimeout(1500);
    const back = await sprite(t);
    check("y después vuelve a la pose fija del reposo", back.texture === IDLE.rest && !back.playing, JSON.stringify(back));
    await t.page.keyboard.press("p");
    await t.page.waitForTimeout(250);
    const paw = await sprite(t);
    check("AC-64: la segunda vez muestra un solo fotograma de Jerry dando la pata, sin animar y con la escala corregida", paw.texture === IDLE.tricks.sheet && paw.frame === "frame-08" && !paw.playing && Math.abs(paw.scale - BASE * ADJUST["frame-08"].scaleMultiplier) < 1e-6, JSON.stringify(paw));
    await t.page.waitForTimeout(1500);
    check("y vuelve a la pose fija del reposo", (await sprite(t)).texture === IDLE.rest);
    await t.close();
  }

  {
    // Solo trucos: la tecla siempre los lanza; solo búsqueda: siempre el peluche; sin ninguna: sin botón ni tecla
    const only = async (edit, expected, label) => {
      const t = await open({ edit });
      await t.start();
      await t.place(...SPOT_A);
      await focusMap(t);
      await t.page.waitForTimeout(300);
      await t.page.keyboard.press("p");
      await t.page.waitForTimeout(250);
      const first = (await sprite(t)).anim;
      check(`${label}: la primera pulsación`, first === expected, String(first));
      await t.close();
    };
    await only((c) => { delete c.gameplay.player.idle.fetch; }, TRICKS, "solo trucos configurados");
    await only((c) => { delete c.gameplay.player.idle.tricks; }, FETCH, "solo búsqueda configurada");
    const t = await open({ edit: (c) => { delete c.gameplay.player.idle.fetch; delete c.gameplay.player.idle.tricks; } });
    await t.start();
    await t.place(...SPOT_A);
    await focusMap(t);
    await t.page.keyboard.press("p");
    await t.page.waitForTimeout(300);
    check("sin trucos ni búsqueda no hay botón y la tecla no hace nada", (await t.page.getByRole("button", { name: /Jugar con Jerry/ }).count()) === 0 && ![FETCH, TRICKS].includes((await sprite(t)).anim));
    await t.close();
  }

  {
    // Una hoja que no carga: la acción no existe, lo demás sigue
    const t = await open({ blockUrl: "**/vanessa-jerry-fetch-plush.png" });
    // El aviso de recurso que falta cubre la portada: se pulsa «Comenzar» sin pasar por el aviso.
    await t.page.locator(".pixel-button").dispatchEvent("click");
    await t.page.waitForTimeout(700);
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(400);
    await focusMap(t);
    await t.page.keyboard.press("p");
    await t.page.waitForTimeout(300);
    const s = await sprite(t);
    check("si la hoja de la búsqueda no carga, la tecla lanza directamente los trucos y todo sigue en pie", s.anim === TRICKS && s.playing, JSON.stringify(s));
    await t.close();
  }

} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
