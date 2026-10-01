// Prueba de extremo a extremo de la exploración en un navegador real (Playwright + servidor de Vite).
// Uso: npm run test:e2e   (instalar el navegador una vez: npx playwright install chromium)
// Comprueba movimiento, colisiones, proximidad, apertura, pausa, foco, portales, escala y edición por JSON.
import { configJson, dist, harness } from "./helpers.mjs";

const { open, check, finish } = await harness();

try {
  // ---- A. Arranque, un canvas, capas elegidas (P2-01, P2-07) --------------------------------
  {
    const t = await open();
    await t.start();
    const info = await t.page.evaluate(() => {
      const g = window.__PHASER_GAME__;
      return { canvases: document.querySelectorAll("canvas").length, active: g.scene.isActive("ExplorationScene"), keys: g.textures.getTextureKeys().filter((k) => k.startsWith("background.")), size: [g.scale.width, g.scale.height] };
    });
    check("A1 un solo canvas y la escena activa", info.canvases === 1 && info.active);
    check("A2 solo se cargan las capas elegidas de la zona y los fondos ambientales (no todas las variantes)", JSON.stringify(info.keys.sort()) === JSON.stringify([...new Set([...configJson.maps["zona-a"].layers.map((l) => l.assetId), ...configJson.maps["zona-a"].ambient.map((a) => a.assetId).filter((id) => id.startsWith("background."))])].sort()), info.keys.join(","));
    const st = await t.stations();
    check("A3 estaciones de la zona con numeración derivada de route y estados correctos", JSON.stringify(st.map((s) => [s.id, s.number, s.state])) === JSON.stringify([["apr-a", 1, "available"], ["apr-b", 2, "locked"], ["apr-c", 3, "locked"]]), JSON.stringify(st));
    check("A4 sin errores de consola", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- B/C/D/E. Movimiento, interacción, portales, foco y escala --------------------------------
  {
    const t = await open();
    await t.start();
    await t.watch();

    await t.place(330, 990); await t.page.waitForTimeout(150);
    const diag = await t.hold(["ArrowUp", "ArrowRight"], 200);
    check("B1 la diagonal no es más rápida (|v| = playerSpeed)", Math.abs(Math.hypot(...diag.m.vel) - configJson.gameplay.playerSpeed) < 0.5, `${Math.hypot(...diag.m.vel)}`);
    await t.place(200, 1030);
    for (const [k, ms] of [["ArrowDown", 800], ["ArrowLeft", 1200], ["ArrowRight", 1200], ["ArrowUp", 2200]]) await t.hold([k], ms);
    const col = await t.page.evaluate(() => {
      const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); const b = s.player.body;
      const hits = s.world.obstacles.getChildren().filter((c) => { const r = c.body; return b.x < r.x + r.width && r.x < b.x + b.width && b.y < r.y + r.height && r.y < b.y + b.height; }).length;
      return { hits, inWorld: b.x >= 0 && b.y >= 0 && b.right <= s.world.width && b.bottom <= s.world.height };
    });
    check("B2 el cuerpo nunca entra en un obstáculo ni sale del mundo", col.hits === 0 && col.inWorld, JSON.stringify(col));
    const frames = new Set();
    await t.place(330, 990); await t.page.keyboard.down("ArrowUp");
    for (let i = 0; i < 10; i++) { await t.page.waitForTimeout(80); frames.add((await t.scene()).frame); }
    await t.page.keyboard.up("ArrowUp"); await t.page.waitForTimeout(150);
    const rest = (await t.scene()).frame;
    check("B3 animación de caminar con frames explícitos y pose de pie al detenerse", [...frames].every((f) => f.startsWith("up-")) && frames.size >= 2 && rest === "up-1", `${[...frames]} rest=${rest}`);

    // Pestaña oculta con una flecha pulsada y regreso (SPEC 6.2). Un navegador real detiene requestAnimationFrame
    // al ocultarse la pestaña; aquí se reproduce esa cadena (hidden + sleep, luego wake + visible) y se exige
    // demostrar que los fotogramas realmente se detuvieron.
    await t.place(200, 1030);
    await t.page.keyboard.down("ArrowLeft");
    await t.page.waitForTimeout(150);
    const frameOf = () => t.page.evaluate(() => window.__PHASER_GAME__.getFrame());
    await t.page.evaluate(() => { const g = window.__PHASER_GAME__; g.events.emit("hidden"); g.loop.sleep(); });
    const f1 = await frameOf();
    await t.page.waitForTimeout(1800);
    const f2 = await frameOf();
    await t.page.evaluate(() => { const g = window.__PHASER_GAME__; g.loop.wake(); g.events.emit("visible"); });
    await t.page.waitForTimeout(600);
    const back = await t.page.evaluate(() => {
      const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); const b = s.player.body;
      const hits = s.world.obstacles.getChildren().filter((c) => { const r = c.body; return b.x < r.x + r.width && r.x < b.x + b.width && b.y < r.y + r.height && r.y < b.y + b.height; }).length;
      return { hits, inWorld: b.x >= 0 && b.y >= 0 && b.right <= s.world.width && b.bottom <= s.world.height };
    });
    await t.page.keyboard.up("ArrowLeft");
    check("B4 la simulación detuvo de verdad el bucle (sin fotogramas mientras estaba oculta)", f2 - f1 <= 1, `avanzó ${f2 - f1} fotogramas`);
    check("B5 volver de una pestaña oculta no atraviesa obstáculos ni saca al personaje del mundo", back.hits === 0 && back.inWorld, JSON.stringify(back));

    // proximidad, apertura y pausa
    await t.place(330, 990); await t.page.waitForTimeout(250);
    check("C1 el aviso muestra la estación cercana", (await t.page.locator(".nearby").innerText()).startsWith("Aprendizaje 1:"));
    await t.log();
    await t.page.keyboard.press("Enter"); await t.page.waitForTimeout(300);
    const after = await t.log();
    check("C2 Enter solicita la apertura una vez y el diálogo se abre", after.filter((e) => e[0] === "game:learning-open-request").length === 1 && (await t.page.locator("[role=dialog]").count()) === 1);
    check("C3 la exploración queda pausada y las flechas no mueven al personaje", await (async () => {
      const before = await t.scene(); await t.page.keyboard.down("ArrowRight"); await t.page.waitForTimeout(250); await t.page.keyboard.up("ArrowRight");
      const now = await t.scene(); return before.paused && dist(before.pos, now.pos) === 0;
    })());
    await t.page.keyboard.press("Escape"); await t.page.waitForTimeout(300);
    check("C4 Escape cierra, reanuda y devuelve el foco al mapa", (await t.page.locator("[role=dialog]").count()) === 0 && !(await t.scene()).paused && await t.page.evaluate(() => document.activeElement?.classList.contains("game-host")));
    await t.log();
    await t.page.keyboard.down("Enter"); for (let i = 0; i < 6; i++) { await t.page.keyboard.down("Enter"); await t.page.waitForTimeout(50); }
    await t.page.waitForTimeout(200); await t.page.keyboard.up("Enter");
    check("C5 Enter mantenido genera una sola solicitud", (await t.log()).filter((e) => e[0] === "game:learning-open-request").length === 1);
    await t.page.keyboard.press("Escape"); await t.page.waitForTimeout(250);
    await t.place(410, 635); await t.page.waitForTimeout(250); await t.log();
    await t.page.keyboard.press("Enter"); await t.page.waitForTimeout(300);
    const locked = await t.log();
    check("C6 una estación bloqueada se deniega, libera el bloqueo y no abre contenido", locked.some((e) => e[0] === "app:request-resolved" && e[1].accepted === false) && (await t.page.locator("[role=dialog]").innerText()).includes("Primero recorre"));
    await t.page.keyboard.press("Escape"); await t.page.waitForTimeout(250);
    check("C7 tras la denegación el mapa vuelve a moverse", !(await t.scene()).paused);

    // portales y cambios repetidos de zona
    const l0 = await t.page.evaluate(() => window.__BITACORA_BRIDGE__.listenerCount());
    const trips = [];
    let firstTripStates = [];
    for (let i = 0; i < 6; i++) {
      const z = (await t.scene()).zone;
      await t.place(...(z === "zona-a" ? [1380, 440] : [60, 440])); await t.page.waitForTimeout(200);
      await t.page.keyboard.press("Enter"); await t.page.waitForTimeout(600);
      const s = await t.scene(); trips.push([z, s.zone, Math.round(s.pos.x), Math.round(s.pos.y)]);
      if (i === 0) firstTripStates = await t.stations();
    }
    const expected = [["zona-a", "zona-b", 130, 470], ["zona-b", "zona-a", 1330, 450]];
    check("D1 portales de ida y regreso al punto de aparición configurado", trips.every((t2, i) => JSON.stringify(t2) === JSON.stringify(expected[i % 2])), JSON.stringify(trips));
    const post = await t.page.evaluate(() => ({ canvases: document.querySelectorAll("canvas").length, listeners: window.__BITACORA_BRIDGE__.listenerCount(), reasons: [...window.__BITACORA_BRIDGE__.controlReasons] }));
    check("D2 seis cambios de zona no multiplican canvas ni listeners ni dejan bloqueos", post.canvases === 1 && post.listeners === l0 && post.reasons.length === 0, JSON.stringify({ ...post, l0 }));
    check("D3 viajar no desbloquea nada (la zona B sigue bloqueada, numerada 4–6)", firstTripStates.length === 3 && firstTripStates.every((s) => s.state === "locked") && firstTripStates.map((s) => s.number).join() === "4,5,6", JSON.stringify(firstTripStates.map((s) => [s.id, s.number, s.state])));

    // foco, pérdida de foco y escala
    await t.page.evaluate(() => document.querySelector(".game-host").focus());
    await t.place(330, 990); await t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").scene.restart({ zoneId: "zona-a" })); await t.page.waitForTimeout(500);
    await t.page.evaluate(() => document.querySelector(".game-host").focus()); await t.place(330, 990);
    await t.page.evaluate(() => document.activeElement.blur());
    const f0 = await t.scene(); await t.page.keyboard.down("ArrowUp"); await t.page.waitForTimeout(250); await t.page.keyboard.up("ArrowUp");
    check("E1 sin foco en el mapa las flechas no mueven", dist(f0.pos, (await t.scene()).pos) === 0);
    await t.page.evaluate(() => document.querySelector(".game-host").focus());
    await t.page.keyboard.down("ArrowUp"); await t.page.waitForTimeout(120);
    await t.page.evaluate(() => document.activeElement.blur()); await t.page.waitForTimeout(200);
    check("E2 perder el foco con una flecha pulsada no deja velocidad", (await t.scene()).vel.every((v) => v === 0));
    await t.page.keyboard.up("ArrowUp");
    await t.page.evaluate(() => document.querySelector(".game-host").focus()); await t.place(330, 990);
    const r0 = (await t.scene()).pos;
    await t.page.setViewportSize({ width: 390, height: 844 }); await t.page.waitForTimeout(500);
    const r1 = await t.page.evaluate(() => { const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); const c = s.cameras.main; const sp = s.player.sprite; return { pos: s.player.position, x: (sp.x - c.worldView.x) * c.zoom, y: (sp.y - c.worldView.y) * c.zoom, w: c.width, h: c.height }; });
    check("E3 redimensionar no cambia las coordenadas lógicas y el personaje sigue a la vista", dist(r0, r1.pos) === 0 && r1.x > 0 && r1.x < r1.w && r1.y > 0 && r1.y < r1.h, JSON.stringify(r1));
    check("E4 sin errores de consola en toda la sesión", t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }

  // ---- F. Edición solo por JSON (AC-24, AC-25) --------------------------------------------
  {
    const invalid = await open({ edit: (c) => { c.placements["apr-a"].position = { x: 600, y: 700 }; }, waitFor: "[role=alert]" });
    const msg = await invalid.page.locator("[role=alert]").innerText();
    check("F0 una estación colocada dentro de un obstáculo no construye un mundo parcial y dice cuál es el error (AC-29)", msg.includes("placements.apr-a.interactionOffset") && (await invalid.page.locator("canvas").count()) === 0, msg);
    await invalid.close();

    const moved = await open({ edit: (c) => { c.placements["apr-a"].position = { x: 1330, y: 420 }; } });
    await moved.start();
    const a = (await moved.stations()).find((s) => s.id === "apr-a");
    check("F1 mover una estación en placements mueve su punto de interacción y no cambia número ni orden", a.interaction.x === 1330 && a.interaction.y === 450 && a.number === 1, JSON.stringify(a));
    await moved.close();

    const crossZone = await open({ edit: (c) => { c.placements["apr-c"].zoneId = "zona-b"; c.placements["apr-c"].position = { x: 955, y: 540 }; } });
    await crossZone.start();
    check("F2 mover una estación de zona la retira de esta zona sin tocar los demás aprendizajes", JSON.stringify((await crossZone.stations()).map((s) => s.id)) === JSON.stringify(["apr-a", "apr-b"]));
    await crossZone.close();

    const reordered = await open({ edit: (c) => { c.route = ["apr-b", "apr-a", "apr-c", "apr-d", "apr-e", "apr-f"]; } });
    await reordered.start();
    const r = (await reordered.stations()).sort((x, y) => x.id.localeCompare(y.id));
    const unmoved = r.every((s) => s.interaction.x === configJson.placements[s.id].position.x + configJson.placements[s.id].interactionOffset.x);
    check("F3 reordenar route renumera y redefine el desbloqueo sin mover señales", JSON.stringify(r.map((s) => [s.id, s.number, s.state])) === JSON.stringify([["apr-a", 2, "locked"], ["apr-b", 1, "available"], ["apr-c", 3, "locked"]]) && unmoved, JSON.stringify(r));
    await reordered.close();

    const seven = await open({ edit: (c) => {
      c.learnings["apr-g"] = structuredClone(c.learnings["apr-f"]); c.badges["insignia-demo-g"] = structuredClone(c.badges["insignia-demo-f"]); c.learnings["apr-g"].badgeId = "insignia-demo-g";
      c.placements["apr-g"] = { zoneId: "zona-a", position: { x: 410, y: 605 }, interactionOffset: { x: 0, y: 30 }, interactionRadius: 70 }; c.route.push("apr-g");
    } });
    await seven.start();
    const s7 = await seven.stations();
    check("F4 una séptima estación aparece con el mismo código y numeración 7", s7.length === 4 && s7.at(-1).id === "apr-g" && s7.at(-1).number === 7, JSON.stringify(s7.map((s) => [s.id, s.number])));
    await seven.close();
  }

  // ---- G. Depuración, movimiento reducido y fallo de un asset ------------------------------
  {
    const dbg = await open({ query: "?debug" });
    await dbg.start();
    check("G1 la vista de depuración (?debug, solo desarrollo) arranca sin errores", dbg.errors.length === 0 && (await dbg.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").physics.world.drawDebug)), dbg.errors.join(" | "));
    await dbg.close();

    const calm = await open({ reducedMotion: true });
    await calm.start();
    const rm = await calm.page.evaluate(() => { const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); return { lerp: s.cameras.main.lerp.x, tweens: s.tweens.getTweens().length }; });
    check("G2 con prefers-reduced-motion no hay tweens decorativos ni seguimiento suavizado", rm.tweens === 0 && rm.lerp === 1, JSON.stringify(rm));
    await calm.close();

    const full = await open();
    await full.start();
    const tw = await full.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").tweens.getTweens().length);
    check("G3 sin esa preferencia sí hay animaciones decorativas (control de la prueba anterior)", tw > 0, String(tw));
    await full.close();

    const broken = await open({ blockUrl: "**/terrain-meadow-river-bridges.png" });
    const alert = await broken.page.locator(".asset-alert").innerText();
    await broken.start();
    check("G4 un asset que falla se informa con su ID y la zona sigue jugable", alert.includes("background.zone-01.terrain") && (await broken.scene()).zone === "zona-a" && (await broken.stations()).length === 3, alert);
    await broken.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
