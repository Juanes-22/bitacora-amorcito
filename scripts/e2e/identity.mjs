// E2E de la identidad de las estaciones (título corto, icono y número en el letrero) y de las sombras bajo Vanessa y Jerry
// (SPEC 4.3 y 6.2; AC-72, AC-73) en un navegador real.
// Uso: npm run test:e2e
import { readFileSync } from "node:fs";
import { configJson, harness } from "./helpers.mjs";

const { open, check, finish } = await harness();
const KEY = `bitacora:progress:v3:${configJson.contentSetId}:demo`;
const DONE = { contentRevision: 1, readSectionIds: ["learning", "reflection", "lived"], completedAt: "2026-09-30T10:00:00.000Z" };
const saved = (completed) => ({
  [KEY]: JSON.stringify({
    schemaVersion: 3, contentSetId: configJson.contentSetId, mode: "demo", currentZoneId: "zona-a", player: { x: 200, y: 1030 }, checkpoints: {},
    entries: Object.fromEntries(configJson.route.map((id) => [id, completed.includes(id) ? DONE : { contentRevision: 1, readSectionIds: [] }])),
  }),
});
const ZONE_A = configJson.route.filter((id) => configJson.placements[id].zoneId === "zona-a");
const learn = (id) => configJson.learnings[id];
const manifest = JSON.parse(readFileSync("public/assets/assets.json", "utf8")).assets;
const SIGN = manifest[configJson.ui.assets.stationSign];
const ZONES = SIGN.labelZones;
const ATTACH = SIGN.attachments.completed;
const LABELS = configJson.ui.labels;

/** Lo que hay pintado en la escena de una estación: título, número, estado y candado, con sus cajas y su opacidad. */
const probe = (t, id) =>
  t.page.evaluate(({ id, title, number, p, signKey, lockKey, badgeKey, texts }) => {
    const list = window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list;
    const sign = list.find((o) => o.type === "Image" && o.texture.key === signKey && Math.abs(o.x - p.x) < 1 && Math.abs(o.y - p.y) < 1);
    if (!sign) return null;
    const sb = sign.getBounds();
    const near = (o) => o.x > sb.x - 10 && o.x < sb.right + 10 && o.y > sb.y - 10 && o.y < sb.bottom + 40;
    const box = (o) => { const b = o.getBounds(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; };
    const text = (str) => list.find((o) => o.type === "Text" && o.text.replace(/\n/g, " ") === str && near(o));
    const t = text(title), n = text(String(number)), done = text(texts.completed), next = text(texts.next);
    const lock = list.find((o) => o.type === "Image" && o.texture.key === lockKey && near(o));
    const badge = list.find((o) => o.type === "Image" && o.texture.key === badgeKey && near(o));
    return {
      sign: { x: sb.x, y: sb.y, w: sb.width, h: sb.height },
      title: t && { ...box(t), alpha: t.alpha, size: parseInt(t.style.fontSize), lines: t.text.split("\n").length },
      number: n && { ...box(n), alpha: n.alpha },
      completed: done && { ...box(done), visible: done.visible },
      completedBadge: badge && { ...box(badge), visible: badge.visible },
      next: next && { ...box(next), visible: next.visible },
      lock: lock && { ...box(lock), visible: lock.visible },
    };
  }, { id, title: learn(id).signTitle ?? learn(id).title, number: configJson.route.indexOf(id) + 1, p: configJson.placements[id].position, signKey: configJson.ui.assets.stationSign, lockKey: configJson.ui.assets.lockIcon, badgeKey: configJson.ui.assets.completedBadge, texts: { completed: LABELS.stateCompleted, next: LABELS.nextBadge } });

/** Un rectángulo de la textura del letrero (píxeles, esquina superior izquierda) llevado al mundo. */
const zoneBox = (sign, z) => { const k = sign.w / SIGN.width; return { x: sign.x + z.x * k, y: sign.y + z.y * k, right: sign.x + (z.x + z.width) * k, bottom: sign.y + (z.y + z.height) * k, cx: sign.x + (z.x + z.width / 2) * k, cy: sign.y + (z.y + z.height / 2) * k }; };
const inside = (box, z, tol = 1.5) => box.x >= z.x - tol && box.right <= z.right + tol && box.y >= z.y - tol && box.bottom <= z.bottom + tol;

try {
  // ---- Cada letrero: número en el círculo, título en la placa y el estado debajo --------------------------------
  {
    const t = await open({ seed: saved(["apr-a"]) });
    await t.start();
    await t.page.waitForTimeout(600);
    for (const id of ZONE_A) {
      const r = await probe(t, id);
      const n = configJson.route.indexOf(id) + 1;
      const tz = r && zoneBox(r.sign, ZONES.title);
      const nz = r && zoneBox(r.sign, ZONES.number);
      check(`AC-72: la estación ${n} muestra su título corto («${learn(id).signTitle}») dentro de la placa`, !!r?.title && inside(r.title, tz), JSON.stringify({ title: r?.title, tz }));
      check(`AC-72: y su número (${n}) va centrado en el círculo de arriba`, !!r?.number && Math.abs(r.number.cx - nz.cx) < 2 && Math.abs(r.number.cy - nz.cy) < 2, JSON.stringify({ number: r?.number, nz }));
    }
    const a = await probe(t, "apr-a"); // completada
    const att = (r) => ({ x: r.sign.x + ATTACH.x * (r.sign.w / SIGN.width), y: r.sign.y + ATTACH.y * (r.sign.w / SIGN.width) });
    check("AC-72: la estación completada lleva la insignia «Completado» (con su texto) bajo la placa, en el ancla del letrero", a.completedBadge?.visible === true && a.completed?.visible === true && Math.abs(a.completedBadge.cx - att(a).x) < 3 && Math.abs(a.completedBadge.cy - att(a).y) < 3 && a.next?.visible !== true, JSON.stringify({ badge: a.completedBadge, att: att(a) }));
    check("AC-72: el texto «Completado» cabe dentro de la insignia", a.completed.x >= a.completedBadge.x && a.completed.right <= a.completedBadge.right, JSON.stringify(a.completed));
    const b = await probe(t, "apr-b"); // la próxima
    check("AC-72: la próxima estación lleva la píldora verde «Siguiente» en el mismo sitio y no la insignia de completado", b.next?.visible === true && b.completed?.visible !== true && Math.abs(b.next.cx - att(b).x) < 3 && Math.abs(b.next.cy - att(b).y) < 3, JSON.stringify({ next: b.next, att: att(b) }));
    const c = await probe(t, "apr-c"); // bloqueada
    check("AC-72: la estación bloqueada muestra el candado en ese sitio, ni «Siguiente» ni «Completado», y su título atenuado", c.lock?.visible === true && c.next?.visible !== true && c.completed?.visible !== true && c.title.alpha < 1 && c.number.alpha < 1 && Math.abs(c.lock.cx - att(c).x) < 3, JSON.stringify(c));
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- Un título largo se ajusta o se acorta, nunca se sale de la placa -------------------------------------------
  {
    const LONG = "Aprender con los sentidos las plantas, las semillas y todos los saberes de la comunidad".slice(0, 40);
    const t = await open({ seed: saved([]), edit: (c) => { c.learnings["apr-a"].signTitle = LONG; } });
    await t.start();
    await t.page.waitForTimeout(600);
    const probeLong = await t.page.evaluate(({ p, key }) => {
      const list = window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list;
      const sign = list.find((x) => x.type === "Image" && x.texture.key === key && Math.abs(x.x - p.x) < 1);
      const sb = sign.getBounds();
      const o = list.find((x) => x.type === "Text" && x.x > sb.x && x.x < sb.right && x.y > sb.y && x.y < sb.bottom && x.text.replace(/\n/g, " ").startsWith("Aprender"));
      const b = o.getBounds();
      return { text: o.text, b: { x: b.x, y: b.y, right: b.right, bottom: b.bottom }, s: { x: sb.x, y: sb.y, w: sb.width } };
    }, { p: configJson.placements["apr-a"].position, key: configJson.ui.assets.stationSign });
    check("AC-72: un título de 40 caracteres cabe en la placa (letra más pequeña o acortado con «…»)", inside(probeLong.b, zoneBox(probeLong.s, ZONES.title)), JSON.stringify(probeLong));
    await t.close();
  }

  // ---- Un letrero sin zonas de texto conserva solo el número ---------------------------------------------------------
  {
    const t = await open({ seed: saved([]), edit: (c) => { c.placements["apr-a"].signAssetId = "station.sign.wooden"; } });
    await t.start();
    await t.page.waitForTimeout(600);
    const texts = await t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").children.list.filter((o) => o.type === "Text" && Math.abs(o.x - 330) < 400 && o.y > 800).map((o) => o.text));
    check("un letrero propio sin zonas de texto (station.sign.wooden) lleva solo el número, sin título", texts.includes("1") && !texts.some((x) => x.includes("Semillas")), JSON.stringify(texts));
    await t.close();
  }

  // ---- Sombras bajo Vanessa y Jerry ----------------------------------------------------------------------------------
  const shadows = (t) =>
    t.page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene("ExplorationScene");
      const p = scene.player.sprite;
      return {
        sprite: { x: p.x, y: p.y, depth: p.depth },
        list: scene.children.list.filter((o) => o.texture?.key === "__ground-shadow" && o.visible).map((o) => ({ x: o.x, y: o.y, w: o.displayWidth, h: o.displayHeight, alpha: o.alpha, depth: o.depth })).sort((a, b) => a.x - b.x),
      };
    });
  {
    const t = await open({ seed: saved([]) });
    await t.start();
    await t.page.waitForTimeout(600);
    const s = await shadows(t);
    check("AC-73: en reposo hay dos sombras, una bajo Vanessa y otra bajo Jerry (a su derecha)", s.list.length === 2 && s.list[0].x < s.list[1].x && s.list[1].x > s.sprite.x, JSON.stringify(s));
    check("AC-73: son elipses bajas (más anchas que altas), suaves y justo debajo del sprite en profundidad", s.list.every((o) => o.w > o.h * 2 && o.alpha > 0.2 && o.alpha < 0.6 && o.depth === s.sprite.depth - 1), JSON.stringify(s));
    check("AC-73: quedan a la altura de los pies, no flotando ni lejos", s.list.every((o) => Math.abs(o.y - s.sprite.y) < 12), JSON.stringify(s));
    await t.page.keyboard.down("ArrowRight");
    await t.page.waitForTimeout(500);
    const m = await shadows(t);
    await t.page.keyboard.up("ArrowRight");
    check("AC-73: al caminar las sombras acompañan a Vanessa y a Jerry", m.list.length >= 1 && m.sprite.x > s.sprite.x + 20 && m.list.every((o) => Math.abs(o.y - m.sprite.y) < 12 && Math.abs(o.x - m.sprite.x) < 90), JSON.stringify({ s, m }));
    await t.page.waitForTimeout(300);
    const before = await shadows(t);
    await t.page.evaluate(() => window.__BITACORA_BRIDGE__.emit("app:celebrate", { effectId: "demo@sombra", learningId: "apr-a" }));
    let lifted = 0;
    let groundMoved = 0;
    for (let i = 0; i < 25; i++) {
      const c = await shadows(t);
      lifted = Math.max(lifted, before.sprite.y - c.sprite.y);
      if (c.list[0]) groundMoved = Math.max(groundMoved, Math.abs(c.list[0].y - before.list[0].y));
      await t.page.waitForTimeout(60);
    }
    check("AC-73: si Vanessa salta al celebrar, la sombra se queda en el suelo (casi no se mueve mientras ella sube)", lifted > 10 && groundMoved < 8, JSON.stringify({ lifted, groundMoved }));
    check("sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }
  {
    const t = await open({ seed: saved([]), edit: (c) => { delete c.gameplay.player.shadow; } });
    await t.start();
    await t.page.waitForTimeout(500);
    check("sin gameplay.player.shadow no hay sombras", (await shadows(t)).list.length === 0);
    await t.close();
  }
  {
    const t = await open({ seed: saved([]), reducedMotion: true });
    await t.start();
    await t.page.waitForTimeout(500);
    check("AC-73: con movimiento reducido las sombras se ven igual", (await shadows(t)).list.length === 2);
    await t.close();
  }
} finally {
  await finish();
}
