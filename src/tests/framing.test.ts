import { describe, expect, it } from "vitest";
import bitacoraJson from "../../public/config/bitacora.json";
import { frameDefinitions } from "../assets/frameDefinitions";
import type { BitacoraConfig } from "../config/types";
import { cameraBounds, effectiveZoom } from "../game/systems/framing";
import { playerFactor, REF_PLAYER_SCALE, REF_SIGN_SCALE, signFactor } from "../game/systems/worldScale";

const WORLD = { width: 1448, height: 1086 };
const COVER = { baseZoom: 1, fit: "cover" as const, maxZoom: 3 };
const SIZES: Array<[string, number, number]> = [
  ["móvil vertical", 390, 844], ["móvil pequeño", 320, 480], ["móvil apaisado", 844, 390], ["tableta", 768, 1024],
  ["portátil", 1280, 720], ["1080p", 1920, 1080], ["captura del usuario", 2177, 1385], ["1440p", 2560, 1440],
  ["4K", 3840, 2160], ["ultraancho", 3440, 1440],
];

describe("effectiveZoom: «cover» (SPEC 6.3, AC-37)", () => {
  it.each(SIZES)("%s (%i×%i): la vista cabe dentro del mundo, sin franjas vacías", (_n, w, h) => {
    const view = { width: w, height: h };
    const zoom = effectiveZoom(view, WORLD, COVER);
    const b = cameraBounds(view, zoom, WORLD);
    expect(zoom).toBeGreaterThanOrEqual(1);
    expect(zoom).toBeLessThanOrEqual(3);
    // Lo que se ve (en unidades del mundo) nunca es mayor que el mundo: el mapa cubre todo el canvas.
    expect(w / zoom).toBeLessThanOrEqual(WORLD.width + 1e-6);
    expect(h / zoom).toBeLessThanOrEqual(WORLD.height + 1e-6);
    expect(b).toEqual({ x: 0, y: 0, width: WORLD.width, height: WORLD.height });
  });

  it("no pasa de 1 cuando la ventana es más pequeña que el mundo (se sigue al personaje)", () => {
    expect(effectiveZoom({ width: 1280, height: 720 }, WORLD, COVER)).toBe(1);
    expect(effectiveZoom({ width: 390, height: 844 }, WORLD, COVER)).toBe(1);
  });

  it("en pantallas grandes sube el zoom lo justo para cubrir (caso 2177×1385 → 1,51)", () => {
    expect(effectiveZoom({ width: 2177, height: 1385 }, WORLD, COVER)).toBeCloseTo(1.51, 2);
    expect(effectiveZoom({ width: 1920, height: 1080 }, WORLD, COVER)).toBeCloseTo(1.33, 2);
  });

  it("el eje limitante manda: una ventana alta cubre por el alto, una ancha por el ancho", () => {
    expect(effectiveZoom({ width: 1000, height: 2200 }, WORLD, COVER)).toBeCloseTo(2200 / 1086, 1);
    expect(effectiveZoom({ width: 3000, height: 800 }, WORLD, COVER)).toBeCloseTo(3000 / 1448, 1);
  });

  it("el zoom nunca deja un hueco por redondeo: el mundo escalado cubre el canvas", () => {
    for (let w = 300; w <= 4000; w += 137) {
      for (const h of [400, 720, 1000, 1500]) {
        const z = effectiveZoom({ width: w, height: h }, WORLD, COVER);
        if (z < COVER.maxZoom) {
          expect(WORLD.width * z).toBeGreaterThanOrEqual(w);
          expect(WORLD.height * z).toBeGreaterThanOrEqual(h);
        }
      }
    }
  });

  it("«fixed» conserva el zoom base y lo ignora todo lo demás", () => {
    expect(effectiveZoom({ width: 3840, height: 2160 }, WORLD, { baseZoom: 1.25, fit: "fixed", maxZoom: 3 })).toBe(1.25);
  });

  it("un zoom base mayor que el de cobertura se respeta; maxZoom nunca baja del base", () => {
    expect(effectiveZoom({ width: 1280, height: 720 }, WORLD, { ...COVER, baseZoom: 1.4 })).toBe(1.4);
    expect(effectiveZoom({ width: 3840, height: 2160 }, WORLD, { baseZoom: 2, fit: "cover", maxZoom: 1 })).toBe(2);
  });
});

describe("cameraBounds: centrado de respaldo cuando el tope de zoom deja la vista mayor que el mundo", () => {
  it("5120×1440 con tope 3: el zoom queda en 3 y el mundo se centra en lugar de anclarse a la esquina", () => {
    const view = { width: 5120, height: 1440 };
    const zoom = effectiveZoom(view, WORLD, { ...COVER, maxZoom: 3 });
    expect(zoom).toBe(3);
    const b = cameraBounds(view, zoom, WORLD);
    const visibleW = view.width / zoom;
    expect(visibleW).toBeGreaterThan(WORLD.width);
    expect(b.x).toBeCloseTo(-(visibleW - WORLD.width) / 2, 6); // margen simétrico a izquierda y derecha
    expect(b.x + b.width - WORLD.width).toBeCloseTo(-b.x, 6);
    expect(b.y).toBe(0); // el eje que sí cubre no se ensancha
  });

  it("si el mundo cabe y sobra en ambos ejes, se centra en los dos", () => {
    const b = cameraBounds({ width: 4000, height: 3000 }, 1, { width: 1000, height: 800 });
    expect(b).toEqual({ x: -1500, y: -1100, width: 4000, height: 3000 });
  });

  it("si la vista es menor que el mundo, los límites son el mundo", () => {
    expect(cameraBounds({ width: 800, height: 600 }, 1, WORLD)).toEqual({ x: 0, y: 0, width: WORLD.width, height: WORLD.height });
  });
});

// ---- Escala del personaje (SPEC 6.3, AC-38) con los valores reales de la configuración ----------------------

const config = bitacoraJson as unknown as BitacoraConfig;
const rest = frameDefinitions[config.gameplay.player.assetId].frames.find((f) => f.name === "down-1")!;
const PLAYER_PX = rest.height * config.gameplay.player.scale; // altura del personaje a zoom 1
const settings = { baseZoom: config.gameplay.cameraZoom, fit: config.gameplay.camera.fit, maxZoom: config.gameplay.camera.maxZoom, playerHeight: PLAYER_PX, minPlayerHeight: config.gameplay.camera.minPlayerHeight };

describe("el personaje mide al menos el 12 % de la altura del canvas en cualquier ventana (AC-38)", () => {
  const ALL: Array<[string, number, number]> = [...SIZES, ["tableta vertical", 768, 1024], ["tableta apaisada", 1024, 768], ["ventana muy alta", 1000, 2200], ["ventana muy ancha", 3000, 800], ["5K ultraancho", 5120, 1440]];

  it.each(ALL)("%s (%i×%i)", (_n, w, h) => {
    const view = { width: w, height: h };
    const zoom = effectiveZoom(view, WORLD, settings);
    const fraction = (PLAYER_PX * zoom) / h;
    // Si el tope de zoom lo impide, el límite es el tope, no el suelo del personaje.
    if (zoom < settings.maxZoom) expect(fraction).toBeGreaterThanOrEqual(config.gameplay.camera.minPlayerHeight - 0.005);
    expect(zoom).toBeLessThanOrEqual(settings.maxZoom);
  });

  it("sin el suelo por personaje una tableta vertical se quedaría por debajo del 12 % (por eso existe)", () => {
    const view = { width: 768, height: 1024 };
    const sin = effectiveZoom(view, WORLD, { ...settings, minPlayerHeight: undefined });
    expect((PLAYER_PX * sin) / 1024).toBeLessThan(0.12);
    expect((PLAYER_PX * effectiveZoom(view, WORLD, settings)) / 1024).toBeGreaterThanOrEqual(0.12);
  });

  it("el personaje es ahora bastante mayor que antes (79 px → ≥ 110 px a zoom 1) y las señales lo superan en altura", () => {
    expect(PLAYER_PX).toBeGreaterThanOrEqual(110);
    const signH = 609 * config.gameplay.signScale; // station.sign.wooden mide 520×609
    expect(signH).toBeGreaterThan(PLAYER_PX);
  });

  it("el cuerpo de colisión conserva su tamaño físico (≈ 14×9 px en el mundo) al agrandar el dibujo", () => {
    const { body, scale } = config.gameplay.player;
    expect(body.width * scale).toBeCloseTo(14.4, 0);
    expect(body.height * scale).toBeCloseTo(8.6, 0);
  });
});

describe("factores de escala del mundo", () => {
  it("las referencias son las del diseño original y los factores son proporcionales", () => {
    expect(REF_PLAYER_SCALE).toBe(0.24);
    expect(REF_SIGN_SCALE).toBe(0.16);
    expect(signFactor(config)).toBeCloseTo(config.gameplay.signScale / 0.16, 6);
    expect(playerFactor(config)).toBeCloseTo(config.gameplay.player.scale / 0.24, 6);
    expect(signFactor(config)).toBeGreaterThan(1);
  });
});
