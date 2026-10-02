// E2E del paisaje vivo (SPEC 3.2; AC-41, AC-42, AC-43, AC-46) en un navegador real.
// Uso: npm run test:e2e
import { readFileSync } from "node:fs";
import { configJson, harness, SPOT_A, stationSpot } from "./helpers.mjs";

const { open, check, finish } = await harness();
const manifest = JSON.parse(readFileSync("public/assets/assets.json", "utf8"));
// Hojas animadas del paisaje (con atlas; no las de reposo del personaje ni los efectos de las estaciones) y nubes del manifiesto: lo que el motor crea como sprites animados o como nubes a la deriva.
const KIT = new Set(Object.entries(manifest.assets).filter(([id, a]) => a.atlasPath && a.kind !== "idle-sheet" && ![configJson.ui.assets.nextStationGlow, configJson.ui.assets.xpStarEffect].includes(id)).map(([id]) => id));
const CLOUDS = Object.keys(manifest.assets).filter((id) => id.startsWith("background.sky.cloud"));
const DUCKS = Object.keys(manifest.assets).filter((id) => id.startsWith("animation.fauna."));

/** Fotografía del ambiente de la escena: objetos, tweens y oyentes que deberían ser exactamente los de la zona. */
const snapshot = (page) => page.evaluate(({ kit, clouds, ducks }) => {
  const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene");
  const list = s.children.list;
  const sprites = list.filter((o) => o.type === "Sprite" && o.name !== "station-sparkle" && kit.includes(o.texture.key)); // los destellos de las estaciones comparten hoja con el paisaje, pero son de la estación
  const emitters = list.filter((o) => o.type === "ParticleEmitter");
  return {
    zone: s.zoneId, children: list.length,
    animated: sprites.length, playing: sprites.filter((o) => o.anims.isPlaying).length,
    frames: sprites.map((o) => o.frame.name).join(),
    sway: s.tweens.getTweens().length, emitters: emitters.length,
    alive: emitters.reduce((n, e) => n + e.getAliveParticleCount(), 0),
    updateListeners: s.events.listenerCount("update"), cloudX: list.filter((o) => clouds.includes(o.texture?.key)).map((o) => o.x),
    ducks: list.filter((o) => ducks.includes(o.texture?.key)).map((o) => ({ x: o.x, y: o.y, flip: o.flipX })),
    additive: list.filter((o) => o.blendMode === 1).length,
    flora: list.filter((o) => o.type === "Sprite" && o.texture.key.startsWith("animation.flora.")).map((o) => ({ frame: o.frame.name, scale: o.anims.timeScale, playing: o.anims.isPlaying })),
  };
}, { kit: [...KIT], clouds: CLOUDS, ducks: DUCKS });

const expected = (zone) => {
  const fx = configJson.maps[zone].ambient;
  const count = (type) => fx.filter((f) => f.type === type).length;
  return { animation: count("animation") + count("swim"), sway: count("sway"), glow: count("glow"), swim: count("swim"), drift: count("drift"), particles: count("particles") };
};

try {
  // ---- Movimiento normal: lo configurado existe, se mueve y no cuesta fotogramas ----------------------
  {
    const t = await open();
    await t.start();
    await t.page.waitForTimeout(800);
    const a = await snapshot(t.page);
    const want = expected("zona-a");
    check(`AC-41/48/49: zona A crea ${want.animation} hojas animadas (con ${want.swim} patos), ${want.sway} balanceos, ${want.glow} luces, ${want.drift} nubes y ${want.particles} emisores`,
      a.animated === want.animation && a.sway >= want.sway + want.glow && a.emitters === want.particles && a.cloudX.length === want.drift && a.ducks.length === want.swim, JSON.stringify(a));
    const flora = configJson.maps["zona-a"].ambient.filter((f) => f.assetId.startsWith("animation.flora."));
    check(`AC-56: la zona A tiene ${flora.length} flores y arbustos animados, todos reproduciéndose`, a.flora.length === flora.length && flora.length >= 8 && a.flora.every((p) => p.playing), JSON.stringify(a.flora));
    check("AC-56: con fases y velocidades distintas (no se balancean todas a la vez)", new Set(a.flora.map((p) => p.frame)).size >= 3 && new Set(a.flora.map((p) => p.scale)).size >= 3, JSON.stringify(a.flora));
    check("AC-48: el halo y los rayos usan mezcla aditiva", a.additive >= want.glow, `${a.additive} objetos ADD`);
    check("AC-41: todas las hojas animadas están reproduciéndose", a.playing === a.animated, `${a.playing}/${a.animated}`);
    await t.page.waitForTimeout(1500);
    const b = await snapshot(t.page);
    check("AC-41: los fotogramas realmente cambian con el tiempo", a.frames !== b.frames, `${a.frames} → ${b.frames}`);
    check("AC-41: las nubes se desplazan hacia la derecha", b.cloudX.every((x, i) => x > a.cloudX[i]), JSON.stringify([a.cloudX, b.cloudX]));
    await t.page.waitForTimeout(4500);
    const c = await snapshot(t.page);
    const moved = c.ducks.map((d, i) => Math.hypot(d.x - a.ducks[i].x, d.y - a.ducks[i].y));
    check("AC-49: los patos nadan (se desplazan varios píxeles) y siguen dentro de su trayectoria", moved.every((m) => m > 3) && c.ducks.every((d, i) => {
      const path = configJson.maps["zona-a"].ambient.filter((f) => f.type === "swim")[i].path;
      const xs = path.map((p) => p.x), ys = path.map((p) => p.y);
      return d.x >= Math.min(...xs) - 1 && d.x <= Math.max(...xs) + 1 && d.y >= Math.min(...ys) - 1 && d.y <= Math.max(...ys) + 1;
    }), JSON.stringify({ a: a.ducks, c: c.ducks }));
    check("AC-41: las partículas aparecen y respetan el tope por emisor (24)", c.alive > 0 && c.alive <= 24 * want.particles, `${c.alive} vivas`);

    const fps = await t.page.evaluate(async () => {
      const samples = [];
      let last = performance.now();
      await new Promise((resolve) => {
        const tick = (now) => { samples.push(1000 / (now - last)); last = now; samples.length < 180 ? requestAnimationFrame(tick) : resolve(); };
        requestAnimationFrame(tick);
      });
      samples.sort((x, y) => x - y);
      return { median: samples[samples.length >> 1], p10: samples[Math.floor(samples.length * 0.1)] };
    });
    check(`AC-43: con todo el ambiente activo la mediana es ≥ 50 fps (${fps.median.toFixed(1)} fps, p10 ${fps.p10.toFixed(1)})`, fps.median >= 50, JSON.stringify(fps));

    // ---- Ciclo de vida: ir y volver entre zonas no deja nada residual -----------------------------------
    await t.place(...SPOT_A);
    const base = await snapshot(t.page);
    const trips = [];
    for (let i = 0; i < 8; i++) {
      const z = (await t.scene()).zone;
      await t.place(...(z === "zona-a" ? [1380, 440] : [60, 440]));
      await t.page.waitForTimeout(200);
      await t.page.keyboard.press("Enter");
      await t.page.waitForTimeout(600);
      trips.push(await snapshot(t.page));
    }
    const inA = trips.filter((s) => s.zone === "zona-a"), inB = trips.filter((s) => s.zone === "zona-b");
    const same = (xs, keys) => xs.every((s) => keys.every((k) => s[k] === xs[0][k]));
    const keys = ["children", "animated", "sway", "emitters", "updateListeners"];
    check("AC-43: ocho cambios de zona dejan siempre los mismos objetos, tweens, emisores y oyentes en cada zona", same(inA, keys) && same(inB, keys), JSON.stringify({ base, inA: inA[0], inB: inB[0] }));
    check("AC-43: al volver a la zona A queda lo mismo que al empezar", inA[0].children === base.children && inA[0].sway === base.sway && inA[0].updateListeners === base.updateListeners, JSON.stringify({ base, back: inA[0] }));
    const wantB = expected("zona-b");
    check(`AC-41: la zona B crea ${wantB.animation} hojas animadas y ${wantB.particles} emisores`, inB[0].animated === wantB.animation && inB[0].emitters === wantB.particles, JSON.stringify(inB[0]));
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Movimiento reducido: nada se mueve --------------------------------------------------------------
  {
    const t = await open({ reducedMotion: true });
    await t.start();
    await t.page.waitForTimeout(800);
    const a = await snapshot(t.page);
    await t.page.waitForTimeout(2500);
    const b = await snapshot(t.page);
    const want = expected("zona-a");
    check("AC-42: con movimiento reducido las hojas animadas existen pero no se reproducen", a.animated === want.animation && a.playing === 0 && a.frames === b.frames, JSON.stringify({ a, b }));
    check("AC-42: sin vaivén, sin pulso, sin deriva de nubes y sin partículas", b.sway === 0 && b.emitters === 0 && b.alive === 0 && JSON.stringify(a.cloudX) === JSON.stringify(b.cloudX), JSON.stringify(b));
    check("AC-56: con movimiento reducido la flora queda en un fotograma fijo", b.flora.length > 0 && b.flora.every((p) => !p.playing) && JSON.stringify(a.flora) === JSON.stringify(b.flora), JSON.stringify(b.flora));
    check("AC-49: con movimiento reducido los patos quedan quietos en el primer punto de su trayectoria", JSON.stringify(a.ducks) === JSON.stringify(b.ducks) && b.ducks.length === want.swim, JSON.stringify(b.ducks));
    check("AC-42: las nubes y plantas siguen visibles (estáticas)", b.cloudX.length === want.drift, JSON.stringify(b.cloudX));
    check("sin errores de consola con movimiento reducido", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Edición por JSON (AC-46): quitar y añadir un efecto solo cambia la configuración ---------------
  {
    const t = await open({ edit: (c) => { c.maps["zona-a"].ambient = []; c.maps["zona-b"].ambient = c.maps["zona-b"].ambient.slice(0, 1); } });
    await t.start();
    await t.page.waitForTimeout(500);
    const a = await snapshot(t.page);
    check("AC-46: con ambient vacío la zona funciona sin animaciones, nubes ni partículas", a.animated === 0 && a.emitters === 0 && a.cloudX.length === 0, JSON.stringify(a));
    check("AC-46: sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
