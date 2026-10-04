// E2E de las gallinas y los pollitos (SPEC 3.3; AC-78) en un navegador real.
// Uso: npm run test:e2e
import { configJson, harness } from "./helpers.mjs";

const { open, check, finish } = await harness();
const KEY = `bitacora:progress:v3:${configJson.contentSetId}:demo`;
const seedIn = (zone) => {
  const m = configJson.maps[zone];
  const p = m.spawns[m.initialSpawnId];
  return { [KEY]: JSON.stringify({ schemaVersion: 3, contentSetId: configJson.contentSetId, mode: "demo", currentZoneId: zone, player: p, checkpoints: {}, entries: {} }) };
};
const wanted = (zone) => (configJson.maps[zone].critters ?? []).reduce((n, k) => n + 1 + (k.type === "family" ? k.chicks : 0), 0);

/** Los animalitos de la escena con su posición, animación, orientación y profundidad. */
const critters = (t) =>
  t.page.evaluate(() =>
    window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list
      .filter((o) => o.name === "critter")
      .map((o) => ({ tex: o.texture.key, x: o.x, y: o.y, depth: o.depth, flip: o.flipX, state: o.anims.currentAnim?.key.split(":")[1] ?? null, playing: o.anims.isPlaying, frame: o.frame.name, visible: o.visible })));
const shadows = (t) =>
  t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list.filter((o) => o.name === "critter-shadow").length);
const homes = (zone) => (configJson.maps[zone].critters ?? []).flatMap((k) => (k.type === "family" ? [{ ...k, mother: true }] : [k]));
/** ¿A qué casa pertenece un animalito? La más cercana de las de su textura (la familia se mide con su cola). */
const owner = (zone, a) => {
  const cands = homes(zone).filter((k) => k.assetId === a.tex || (k.type === "family" && k.chickAssetId === a.tex));
  return cands.map((k) => ({ k, d: Math.hypot(a.x - k.position.x, a.y - k.position.y) })).sort((p, q) => p.d - q.d)[0];
};

try {
  for (const zone of Object.keys(configJson.maps)) {
    const t = await open({ seed: seedIn(zone) });
    await t.start();
    await t.page.waitForTimeout(800);
    const first = await critters(t);
    check(`AC-78: la ${zone} tiene ${wanted(zone)} animalitos (cada gallina y cada pollito), ni uno más ni uno menos`, first.length === wanted(zone), String(first.length));
    const texs = new Set(first.map((a) => a.tex));
    const expectTexs = new Set((configJson.maps[zone].critters ?? []).flatMap((k) => (k.type === "family" ? [k.assetId, k.chickAssetId] : [k.assetId])));
    check(`AC-78: y son exactamente las razas de su configuración (${[...expectTexs].map((x) => x.split(".").slice(1).join(" ")).join(", ")})`, texs.size === expectTexs.size && [...texs].every((x) => expectTexs.has(x)), JSON.stringify([...texs]));
    check("AC-78: cada animalito tiene su sombra, y se ordenan por profundidad con su altura (como Vanessa)", (await shadows(t)) === first.length && first.every((a) => Math.abs(a.depth - a.y) < 0.01), String(await shadows(t)));

    // Muestreo durante 14 s: merodean dentro de su círculo, reposan, picotean y pasean
    const states = new Set();
    let maxOut = 0;
    const startPos = first.map((a) => [a.x, a.y]);
    let moved = 0;
    for (let i = 0; i < 70; i++) {
      const now = await critters(t);
      now.forEach((a, j) => {
        if (a.state) states.add(a.state);
        const o = owner(zone, a);
        const allowed = o.k.radius + (o.k.type === "family" ? 4 + o.k.chicks * 20 : 1.5);
        maxOut = Math.max(maxOut, o.d - allowed);
        moved = Math.max(moved, Math.hypot(a.x - startPos[j][0], a.y - startPos[j][1]));
      });
      await t.page.waitForTimeout(200);
    }
    check("AC-78: reposan, picotean y pasean (se ven los tres estados)", states.has("idle") && states.has("peck") && states.has("walk"), JSON.stringify([...states]));
    check("AC-78: nunca salen del círculo por el que merodean (la familia, con su cola)", maxOut <= 0.5, maxOut.toFixed(2));
    check("AC-78: se mueven de verdad (alguna se aleja de donde empezó al menos 4 px)", moved >= 4, moved.toFixed(1));
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- La familia: los pollitos siguen a la madre ----------------------------------------------------------------
  {
    const t = await open({ seed: seedIn("zona-b") });
    await t.start();
    const fam = homes("zona-b").find((k) => k.mother);
    let maxApart = 0;
    let motherTravel = 0;
    let chickTravel = 0;
    let prev = null;
    for (let i = 0; i < 80; i++) {
      const all = await critters(t);
      const mother = all.find((a) => a.tex === fam.assetId && Math.hypot(a.x - fam.position.x, a.y - fam.position.y) < fam.radius + 4);
      const chicks = all.filter((a) => a.tex === fam.chickAssetId && Math.hypot(a.x - fam.position.x, a.y - fam.position.y) < fam.radius + 120);
      if (mother) chicks.forEach((c) => (maxApart = Math.max(maxApart, Math.hypot(c.x - mother.x, c.y - mother.y))));
      if (prev && mother) {
        motherTravel += Math.hypot(mother.x - prev.mother.x, mother.y - prev.mother.y);
        chickTravel += chicks.reduce((s, c, j) => s + (prev.chicks[j] ? Math.hypot(c.x - prev.chicks[j].x, c.y - prev.chicks[j].y) : 0), 0);
      }
      prev = mother ? { mother, chicks } : prev;
      await t.page.waitForTimeout(200);
    }
    const nChicks = (await critters(t)).filter((a) => a.tex === fam.chickAssetId).length;
    check(`AC-78: la familia tiene su gallina blanca esponjosa y ${fam.chicks} pollitos`, nChicks === fam.chicks, String(nChicks));
    check("AC-78: los pollitos nunca se separan de la madre más de 90 px", maxApart <= 90, maxApart.toFixed(1));
    check("AC-78: cuando ella pasea, ellos la siguen (se mueven también)", motherTravel < 1 || chickTravel > motherTravel * 0.5, JSON.stringify({ motherTravel: Math.round(motherTravel), chickTravel: Math.round(chickTravel) }));
    await t.close();
  }

  // ---- Movimiento reducido: quietos en su primer fotograma ------------------------------------------------------
  {
    const t = await open({ seed: seedIn("zona-a"), reducedMotion: true });
    await t.start();
    await t.page.waitForTimeout(600);
    const a = await critters(t);
    await t.page.waitForTimeout(3500);
    const b = await critters(t);
    check("AC-78: con movimiento reducido las gallinas se quedan quietas en su primer fotograma, sin animar", a.length === wanted("zona-a") && b.every((x, i) => Math.abs(x.x - a[i].x) < 0.01 && Math.abs(x.y - a[i].y) < 0.01 && !x.playing && x.frame === "idle-00"), JSON.stringify(b[0]));
    await t.close();
  }

  // ---- Una hoja que no carga: el resto sigue y se avisa -----------------------------------------------------------
  {
    const t = await open({ seed: seedIn("zona-a"), blockUrl: "**/hen-brown.png" });
    await t.page.locator(".pixel-button").dispatchEvent("click"); // el aviso de recurso cubre la portada
    await t.page.waitForTimeout(1000);
    const all = await critters(t);
    const brown = (configJson.maps["zona-a"].critters ?? []).filter((k) => k.assetId === "fauna.hen.brown").length;
    check("si la hoja de una raza no carga, las demás gallinas siguen y el juego también, y se informa del archivo", all.length === wanted("zona-a") - brown && all.every((x) => x.tex !== "fauna.hen.brown") && (await t.page.locator(".asset-alert").innerText()).includes("hen-brown"), JSON.stringify({ n: all.length, brown }));
    await t.close();
  }

  // ---- Sin configuración, sin gallinas ---------------------------------------------------------------------------
  {
    const t = await open({ seed: seedIn("zona-a"), edit: (c) => { delete c.maps["zona-a"].critters; } });
    await t.start();
    await t.page.waitForTimeout(500);
    check("sin `critters` en la zona no hay animalitos", (await critters(t)).length === 0);
    await t.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
