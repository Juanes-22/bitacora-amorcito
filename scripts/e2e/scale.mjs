// E2E de encuadre, escala del mundo e interfaz proporcional (SPEC 6.3 y 14; AC-37, AC-38, AC-39) en un navegador real.
// Uso: npm run test:e2e
import { configJson, harness, SPOT_A, stationSpot } from "./helpers.mjs";

const { open, check, finish } = await harness();

const SIZES = [
  ["móvil 390×844", 390, 844], ["móvil pequeño 320×568", 320, 568], ["móvil apaisado 844×390", 844, 390],
  ["tableta vertical 768×1024", 768, 1024], ["portátil 1280×720", 1280, 720], ["1080p 1920×1080", 1920, 1080],
  ["captura del usuario 2177×1385", 2177, 1385], ["1440p 2560×1440", 2560, 1440], ["4K 3840×2160", 3840, 2160],
  ["ultraancho 3440×1440", 3440, 1440], ["5K ultraancho 5120×1440", 5120, 1440],
];
const MIN_PLAYER = configJson.gameplay.camera.minPlayerHeight;
const roots = {};

try {
  for (const [name, w, h] of SIZES) {
    const t = await open({ viewport: { width: w, height: h } });
    await t.start();
    await t.place(...SPOT_A);
    await t.page.waitForTimeout(500);
    const m = await t.page.evaluate(() => {
      const g = window.__PHASER_GAME__; const s = g.scene.getScene("ExplorationScene"); const c = s.cameras.main;
      const sign = [...s.world.stations.values()][0];
      const hud = document.querySelector(".hud").getBoundingClientRect();
      const interactive = [...document.querySelectorAll("button, [role=tab]")].filter((b) => b.offsetParent !== null);
      return {
        canvas: [g.scale.width, g.scale.height], zoom: c.zoom, view: { x: c.worldView.x, y: c.worldView.y, r: c.worldView.right, b: c.worldView.bottom },
        bounds: { x: c._bounds.x, y: c._bounds.y, r: c._bounds.right, b: c._bounds.bottom }, world: [s.world.width, s.world.height],
        player: s.player.sprite.displayHeight * c.zoom, sign: sign.sign.displayHeight * c.zoom,
        root: parseFloat(getComputedStyle(document.documentElement).fontSize),
        hudInside: hud.left >= 0 && hud.top >= 0 && hud.right <= innerWidth && hud.bottom <= innerHeight,
        hscroll: document.documentElement.scrollWidth > innerWidth,
        smallestTarget: Math.min(...interactive.map((b) => b.getBoundingClientRect().height)),
      };
    });
    roots[w] = m.root;
    const eps = 1;
    // AC-37: lo visible nunca excede el mundo salvo cuando el tope de zoom obliga a centrarlo (límites simétricos)
    const visibleW = m.canvas[0] / m.zoom, visibleH = m.canvas[1] / m.zoom;
    const coversWorld = visibleW <= m.world[0] + eps && visibleH <= m.world[1] + eps
      ? m.view.x >= -eps && m.view.y >= -eps && m.view.r <= m.world[0] + eps && m.view.b <= m.world[1] + eps
      : Math.abs(m.bounds.x + m.bounds.r - m.world[0]) < 1.5 || Math.abs(m.bounds.y + m.bounds.b - m.world[1]) < 1.5;
    check(`${name}: el mapa cubre todo el canvas (zoom ${m.zoom.toFixed(2)}), sin anclarse a una esquina`, m.canvas[0] === w && m.canvas[1] === h && coversWorld, JSON.stringify(m));
    const frac = m.player / h;
    check(`${name}: el personaje mide ${(frac * 100).toFixed(1)} % de la altura (≥ 12 %) y la señal lo supera`, (frac >= MIN_PLAYER - 0.006 || m.zoom >= configJson.gameplay.camera.maxZoom - 0.001) && m.sign > m.player, `personaje ${m.player.toFixed(0)} px, señal ${m.sign.toFixed(0)} px`);
    check(`${name}: la cabecera cabe, no hay scroll horizontal y todo control mide ≥ 44 px`, m.hudInside && !m.hscroll && m.smallestTarget >= 43.5, JSON.stringify({ hud: m.hudInside, hscroll: m.hscroll, target: m.smallestTarget }));
    check(`${name}: sin errores de consola`, t.errors.length === 0, t.errors.join(" | "));
    await t.close();
  }
  check(`AC-39: a 1920 px la raíz de la interfaz es ≥ 1,2 × la de 1280 px (${roots[1920].toFixed(1)} / ${roots[1280].toFixed(1)})`, roots[1920] / roots[1280] >= 1.2);
  check("AC-39: la raíz nunca baja de 17 px ni supera 28 px", Object.values(roots).every((r) => r >= 17 - 0.01 && r <= 28 + 0.01));

  // Redimensionar en caliente: el encuadre se recalcula sin mover al personaje
  {
    const t = await open({ viewport: { width: 1280, height: 720 } });
    await t.start();
    await t.place(...SPOT_A);
    const before = (await t.scene()).pos;
    await t.page.setViewportSize({ width: 2560, height: 1440 });
    await t.page.waitForTimeout(600);
    const r = await t.page.evaluate(() => { const s = window.__PHASER_GAME__.scene.getScene("ExplorationScene"); const c = s.cameras.main; return { zoom: c.zoom, covers: c.worldView.x >= -1 && c.worldView.y >= -1 && c.worldView.right <= s.world.width + 1 && c.worldView.bottom <= s.world.height + 1, pos: s.player.position }; });
    check("redimensionar de 1280×720 a 2560×1440 recalcula el zoom, sigue cubriendo y no mueve a Vanessa", r.zoom > 1.7 && r.covers && Math.hypot(r.pos.x - before.x, r.pos.y - before.y) === 0, JSON.stringify(r));
    await t.page.setViewportSize({ width: 390, height: 844 });
    await t.page.waitForTimeout(600);
    const back = await t.page.evaluate(() => window.__PHASER_GAME__.scene.getScene("ExplorationScene").cameras.main.zoom);
    check("y de vuelta a un móvil el zoom vuelve al base", back === 1, String(back));
    await t.close();
  }

  // La lectura también escala: la ventana usa el ancho útil y sus controles crecen con la raíz
  {
    const small = await open({ viewport: { width: 1280, height: 720 } });
    const big = await open({ viewport: { width: 2560, height: 1440 } });
    const metrics = [];
    for (const t of [small, big]) {
      await t.start();
      await t.place(...SPOT_A);
      await t.page.waitForTimeout(300);
      await t.page.keyboard.press("Enter");
      await t.page.waitForTimeout(300);
      await t.skipIntro();
      await t.page.waitForTimeout(250);
      metrics.push(await t.page.evaluate(() => {
        const para = document.querySelector(".block-paragraph");
        const d = document.querySelector("[role=dialog]").getBoundingClientRect();
        return { font: parseFloat(getComputedStyle(para).fontSize), dialogW: d.width, fits: d.right <= innerWidth && d.bottom <= innerHeight && d.left >= 0 && d.top >= 0 };
      }));
    }
    check(`el texto de lectura crece con la pantalla (${metrics[0].font.toFixed(1)} px → ${metrics[1].font.toFixed(1)} px) y la ventana cabe`, metrics[1].font / metrics[0].font >= 1.3 && metrics[0].fits && metrics[1].fits, JSON.stringify(metrics));
    await small.close();
    await big.close();
  }
} catch (error) {
  check(`excepción no controlada: ${String(error?.message ?? error).split("\n")[0]}`, false);
} finally {
  await finish();
}
