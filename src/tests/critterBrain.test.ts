import { describe, expect, it } from "vitest";
import { DEFAULT_BRAIN, nextAction, randomPointInDisc, stepToward, Trail, type Rng } from "../game/systems/critterBrain";

/** Un generador que devuelve los valores dados en bucle, para controlar cada decisión. */
const seq = (...values: number[]): Rng => {
  let i = 0;
  return () => values[i++ % values.length];
};
const HOME = { x: 100, y: 200 };

describe("randomPointInDisc", () => {
  it("siempre cae dentro del círculo de su casa", () => {
    let n = 0;
    const rng: Rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 400; i++) {
      const p = randomPointInDisc(rng, HOME, 30);
      expect(Math.hypot(p.x - HOME.x, p.y - HOME.y)).toBeLessThanOrEqual(30 + 1e-9);
    }
  });

  it("con radio cero es su casa", () => {
    expect(randomPointInDisc(seq(0.3, 0.7), HOME, 0)).toEqual(HOME);
  });
});

describe("nextAction: qué hace a continuación", () => {
  it("tras reposar, con suerte menor que peckChance, picotea entre 1 y 3 veces", () => {
    const a = nextAction(seq(0.1, 0.0), "idle", HOME, 30, HOME);
    expect(a).toEqual({ kind: "peck", loops: 1 });
    const b = nextAction(seq(0.1, 0.999), "idle", HOME, 30, HOME);
    expect(b).toEqual({ kind: "peck", loops: 3 });
  });

  it("tras reposar, con suerte mayor, pasea a un punto de su círculo y no muy cerca de donde está", () => {
    const a = nextAction(seq(0.9, 0.5, 0.9, 0.5, 0.9), "idle", HOME, 30, HOME);
    expect(a.kind).toBe("walk");
    if (a.kind === "walk") {
      expect(Math.hypot(a.target.x - HOME.x, a.target.y - HOME.y)).toBeLessThanOrEqual(30);
      expect(Math.hypot(a.target.x - HOME.x, a.target.y - HOME.y)).toBeGreaterThanOrEqual(10);
    }
  });

  it("tras pasear siempre reposa entre idleMs[0] y idleMs[1]", () => {
    for (const r of [0, 0.5, 0.999]) {
      const a = nextAction(seq(r), "walk", HOME, 30, HOME);
      expect(a.kind).toBe("idle");
      if (a.kind === "idle") {
        expect(a.ms).toBeGreaterThanOrEqual(DEFAULT_BRAIN.idleMs[0]);
        expect(a.ms).toBeLessThanOrEqual(DEFAULT_BRAIN.idleMs[1]);
      }
    }
  });

  it("tras picotear reposa un rato más corto o pasea", () => {
    const rest = nextAction(seq(0.9, 0.5), "peck", HOME, 30, HOME);
    expect(rest.kind).toBe("idle");
    if (rest.kind === "idle") expect(rest.ms).toBeLessThan(DEFAULT_BRAIN.idleMs[1] * 0.4 + 1);
    expect(nextAction(seq(0.1, 0.5, 0.9, 0.5), "peck", HOME, 30, HOME).kind).toBe("walk");
  });

  it("sin radio (o con uno diminuto) no pasea nunca: picotea o reposa", () => {
    for (let i = 0; i < 40; i++) {
      const r = (i % 10) / 10;
      expect(nextAction(seq(r, 0.5, 0.5, 0.5), "idle", HOME, 0, HOME).kind).not.toBe("walk");
      expect(nextAction(seq(r, 0.5, 0.5, 0.5), "peck", HOME, 3, HOME).kind).not.toBe("walk");
    }
  });
});

describe("stepToward", () => {
  it("avanza a la velocidad pedida y llega sin pasarse", () => {
    const a = stepToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 500);
    expect(a.pos).toEqual({ x: 10, y: 0 });
    expect(a.arrived).toBe(false);
    const b = stepToward({ x: 95, y: 0 }, { x: 100, y: 0 }, 20, 500);
    expect(b).toEqual({ pos: { x: 100, y: 0 }, arrived: true });
  });
});

describe("Trail: el recorrido de la madre", () => {
  const trail = () => {
    const t = new Trail(3, 100);
    t.seed([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }]);
    return t;
  };

  it("devuelve el punto que queda a una distancia por detrás de la cabeza, siguiendo el camino", () => {
    const t = trail();
    expect(t.pointBehind({ x: 30, y: 0 }, 5)).toEqual({ x: 25, y: 0 });
    expect(t.pointBehind({ x: 30, y: 0 }, 22)).toEqual({ x: 8, y: 0 });
  });

  it("si no llega, devuelve el punto más antiguo", () => {
    expect(trail().pointBehind({ x: 30, y: 0 }, 500)).toEqual({ x: 0, y: 0 });
  });

  it("sigue las curvas: la distancia se mide a lo largo del recorrido, no en línea recta", () => {
    const t = new Trail(1, 100);
    t.seed([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(t.pointBehind({ x: 10, y: 10 }, 15)).toEqual({ x: 5, y: 0 });
  });

  it("solo guarda puntos separados por el paso y recorta lo que sobra de longitud", () => {
    const t = new Trail(5, 30);
    for (let x = 0; x <= 200; x += 1) t.push({ x, y: 0 });
    expect(t.length).toBeLessThanOrEqual(30 / 5 + 3);
    expect(t.pointBehind({ x: 200, y: 0 }, 10).x).toBeCloseTo(190, 0);
  });
});
