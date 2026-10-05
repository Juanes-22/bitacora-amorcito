import { describe, expect, it } from "vitest";
import bitacoraJson from "./fixtures/realConfig";
import type { BitacoraConfig, Point } from "../config/types";
import { navigationGrid } from "../config/reachability";
import { findPath, lineOfSight, type NavGrid } from "../domain/pathfinding";
import { PathFollower } from "../game/systems/PathFollower";

/** Rejilla de 40×30 celdas de 10 px; las celdas dadas por `walls` (x0,y0,x1,y1 en celdas) están bloqueadas. */
function grid(walls: Array<[number, number, number, number]> = []): NavGrid {
  const g: NavGrid = { cols: 40, rows: 30, cell: 10, blocked: new Uint8Array(40 * 30) };
  for (const [x0, y0, x1, y1] of walls) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.blocked[y * 40 + x] = 1;
  return g;
}
const everySegmentFree = (g: NavGrid, from: Point, path: Point[]) => {
  let a = from;
  for (const b of path) {
    if (!lineOfSight(g, a, b)) return false;
    a = b;
  }
  return true;
};

describe("findPath (toque para caminar, SPEC 6.1)", () => {
  it("en campo abierto va en línea recta al punto tocado", () => {
    const g = grid();
    expect(findPath(g, { x: 15, y: 15 }, { x: 355, y: 255 })).toEqual({ waypoints: [{ x: 355, y: 255 }], adjusted: false });
  });

  it("rodea un muro por el hueco y ningún tramo lo atraviesa", () => {
    const g = grid([[19, 0, 20, 19]]); // muro vertical con hueco abajo (filas 20-29)
    const from = { x: 55, y: 55 }, to = { x: 345, y: 55 };
    const r = findPath(g, from, to) as NonNullable<ReturnType<typeof findPath>>;
    expect(r.adjusted).toBe(false);
    expect(r.waypoints.length).toBeGreaterThan(1);
    expect(r.waypoints.at(-1)).toEqual(to);
    expect(everySegmentFree(g, from, r.waypoints)).toBe(true);
    expect(Math.max(...r.waypoints.map((p) => p.y))).toBeGreaterThanOrEqual(200); // pasa por el hueco, abajo
  });

  it("tocar un obstáculo lleva a su orilla alcanzable más cercana (y avisa de que se ajustó)", () => {
    const g = grid([[20, 10, 30, 20]]);
    const r = findPath(g, { x: 15, y: 15 }, { x: 250, y: 150 }) as NonNullable<ReturnType<typeof findPath>>;
    expect(r.adjusted).toBe(true);
    const end = r.waypoints.at(-1) as Point;
    expect(g.blocked[Math.floor(end.y / 10) * 40 + Math.floor(end.x / 10)]).toBe(0);
    expect(Math.hypot(end.x - 250, end.y - 150)).toBeLessThan(80);
  });

  it("un destino en una zona cerrada lleva al punto alcanzable más cercano en vez de fallar", () => {
    const g = grid([[30, 0, 30, 29]]); // muro completo: la parte derecha es inalcanzable
    const r = findPath(g, { x: 15, y: 15 }, { x: 350, y: 150 }) as NonNullable<ReturnType<typeof findPath>>;
    expect(r.adjusted).toBe(true);
    expect((r.waypoints.at(-1) as Point).x).toBeLessThan(300);
  });

  it("si el cuerpo roza un obstáculo inflado, sale a la celda libre más cercana", () => {
    const g = grid([[0, 0, 3, 3]]);
    const r = findPath(g, { x: 15, y: 15 }, { x: 200, y: 200 });
    expect(r).not.toBeNull();
  });

  it("sin salida alguna devuelve null", () => {
    const g = grid([[0, 0, 39, 29]]);
    expect(findPath(g, { x: 15, y: 15 }, { x: 200, y: 200 })).toBeNull();
  });

  it("no corta esquinas en diagonal entre dos obstáculos que se tocan", () => {
    const g = grid([[10, 10, 10, 10], [11, 11, 11, 11]]);
    const from = { x: 105, y: 115 }, to = { x: 125, y: 105 };
    const r = findPath(g, from, to) as NonNullable<ReturnType<typeof findPath>>;
    expect(everySegmentFree(g, from, r.waypoints)).toBe(true);
  });
});

describe("findPath sobre el bitacora.json real", () => {
  const config = bitacoraJson as unknown as BitacoraConfig;

  it("llega a cada estación y a cada portal desde el punto de aparición, sin ajustar el destino", () => {
    for (const [zoneId, zone] of Object.entries(config.maps)) {
      const g = navigationGrid(config, zoneId);
      const start = zone.spawns[zone.initialSpawnId];
      const targets: Array<[string, Point]> = [
        ...Object.entries(config.placements).filter(([, p]) => p.zoneId === zoneId).map(([id, p]) => [id, { x: p.position.x + p.interactionOffset.x, y: p.position.y + p.interactionOffset.y }] as [string, Point]),
        ...Object.entries(zone.portals).map(([id, p]) => [id, { x: p.interaction.x, y: p.interaction.y }] as [string, Point]),
      ];
      for (const [id, point] of targets) {
        const r = findPath(g, start, point);
        expect(r, `${zoneId}/${id}`).not.toBeNull();
        expect(r?.adjusted, `${zoneId}/${id} ajustado`).toBe(false);
        expect(everySegmentFree(g, start, (r as NonNullable<typeof r>).waypoints), `${zoneId}/${id} línea libre`).toBe(true);
      }
    }
  });

  it("tocar un arbusto (zona no transitable) lleva a la orilla del camino y calcula rápido", () => {
    const g = navigationGrid(config, "zona-a");
    const start = config.maps["zona-a"].spawns.inicio;
    const t0 = performance.now();
    const r = findPath(g, start, { x: 700, y: 650 }) as NonNullable<ReturnType<typeof findPath>>; // dentro del macizo de girasoles
    const ms = performance.now() - t0;
    expect(r.adjusted).toBe(true);
    expect(ms).toBeLessThan(250);
  });
});

describe("PathFollower", () => {
  const follow = (f: PathFollower, from: Point, speed = 150, fps = 60) => {
    // Simula el movimiento: avanza a `speed` por el vector hasta que se detiene (o hasta 20 s).
    let p = { ...from };
    const dt = 1000 / fps;
    for (let t = 0; t < 20_000; t += dt) {
      const v = f.vector(p, dt, speed);
      if (v.x === 0 && v.y === 0) return { p, t, stuck: f.isStuck };
      p = { x: p.x + (v.x * speed * dt) / 1000, y: p.y + (v.y * speed * dt) / 1000 };
    }
    return { p, t: 20_000, stuck: f.isStuck };
  };

  it("recorre los puntos en orden y se detiene en el último, sin oscilar, a 60 y a 20 fps", () => {
    for (const fps of [60, 20]) {
      const f = new PathFollower();
      f.set([{ x: 100, y: 0 }, { x: 100, y: 100 }]);
      const r = follow(f, { x: 0, y: 0 }, 150, fps);
      expect(Math.hypot(r.p.x - 100, r.p.y - 100)).toBeLessThan(150 / fps + 3);
      expect(r.t).toBeLessThan(2000);
      expect(f.active).toBe(false);
    }
  });

  it("stopDistance detiene antes de llegar (estaciones y portales)", () => {
    const f = new PathFollower();
    f.set([{ x: 200, y: 0 }], 40);
    const r = follow(f, { x: 0, y: 0 });
    expect(r.p.x).toBeGreaterThan(150);
    expect(r.p.x).toBeLessThanOrEqual(165);
  });

  it("sin recorrido no hay vector; clear() lo anula", () => {
    const f = new PathFollower();
    expect(f.vector({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    f.set([{ x: 50, y: 0 }]);
    expect(f.active).toBe(true);
    f.clear();
    expect(f.vector({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("detecta que se atascó (no se acerca) y se detiene", () => {
    const f = new PathFollower();
    f.set([{ x: 100, y: 0 }]);
    let last = { x: 0, y: 0 };
    for (let i = 0; i < 60 && !f.isStuck; i++) last = f.vector({ x: 0, y: 0 }, 16, 150); // el cuerpo no se mueve
    expect(f.isStuck).toBe(true);
    expect(last).toEqual({ x: 0, y: 0 });
    expect(f.active).toBe(false);
  });

  it("la dirección es unitaria", () => {
    const f = new PathFollower();
    f.set([{ x: 30, y: 40 }]);
    const v = f.vector({ x: 0, y: 0 });
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 6);
  });
});
