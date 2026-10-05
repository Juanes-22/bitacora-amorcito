import { describe, expect, it } from "vitest";
import bitacoraJson from "./fixtures/realConfig";
import type { BitacoraConfig } from "../config/types";
import { IdleTimeline, type Facing } from "../game/systems/IdleTimeline";

const TIMING = { glanceAfterMs: 4500, playAfterMs: 10000, gestureCooldownMs: 8000 };
/** Deja pasar `ms` quieta en pasos de 100 ms y devuelve el primer estado de gesto que aparezca (o el actual). */
const wait = (t: IdleTimeline, ms: number, facing: Facing = "down") => {
  for (let i = 0; i < ms / 100; i++) {
    t.tick(100, false, facing);
    if (t.state === "glance" || t.state === "play") return t.state;
  }
  return t.state;
};

describe("IdleTimeline (SPEC 6.2)", () => {
  it("la configuración usa los tiempos del kit: 4,5 s, 10 s y 8 s", () => {
    const idle = (bitacoraJson as unknown as BitacoraConfig).gameplay.player.idle;
    expect(idle).toMatchObject({ glanceAfterMs: 4500, playAfterMs: 10000, gestureCooldownMs: 8000 });
  });

  it("empieza caminando; al detenerse pasa a reposo al instante", () => {
    const t = new IdleTimeline(TIMING);
    expect(t.state).toBe("walk");
    expect(t.tick(16, false, "down")).toBe(true);
    expect(t.state).toBe("rest");
    expect(t.tick(16, false, "down")).toBe(false);
  });

  it("se miran a los 4,5 s sin entrada, no antes", () => {
    const t = new IdleTimeline(TIMING);
    expect(wait(t, 4400)).toBe("rest");
    expect(wait(t, 200)).toBe("glance");
  });

  it("tras la mirada, vuelve a reposo y el juego llega a los 10 s (de frente), alternando", () => {
    const t = new IdleTimeline(TIMING);
    wait(t, 5000);
    expect(t.state).toBe("glance");
    expect(t.gestureDone()).toBe(true);
    expect(t.state).toBe("rest");
    expect(wait(t, 9800)).toBe("rest");
    expect(wait(t, 400)).toBe("play");
    t.gestureDone();
    expect(wait(t, 8000)).toBe("glance"); // después del juego vuelve a tocar la mirada, respetando la pausa de 8 s
  });

  it("entre gestos hay siempre al menos la pausa configurada", () => {
    const t = new IdleTimeline({ glanceAfterMs: 1000, playAfterMs: 1000, gestureCooldownMs: 8000 });
    wait(t, 1200);
    t.gestureDone();
    expect(wait(t, 7800)).toBe("rest");
    expect(wait(t, 400)).toBe("play");
  });

  it("de lado o de espaldas no hay juego: se repite la mirada", () => {
    for (const facing of ["left", "right", "up"] as const) {
      const t = new IdleTimeline({ glanceAfterMs: 1000, playAfterMs: 2000, gestureCooldownMs: 500 });
      const seen = new Set<string>();
      for (let n = 0; n < 4; n++) {
        const s = wait(t, 6000, facing);
        seen.add(s);
        t.gestureDone();
      }
      expect([...seen]).toEqual(["glance"]);
    }
  });

  it("moverse cancela el gesto y reinicia el temporizador", () => {
    const t = new IdleTimeline(TIMING);
    wait(t, 5000);
    expect(t.state).toBe("glance");
    expect(t.tick(16, true, "right")).toBe(true);
    expect(t.state).toBe("walk");
    t.tick(16, false, "right");
    expect(t.state).toBe("rest");
    expect(wait(t, 4400)).toBe("rest"); // empieza de cero
    expect(wait(t, 200)).toBe("glance");
  });

  it("mientras dura un gesto no se encadena otro", () => {
    const t = new IdleTimeline({ glanceAfterMs: 500, playAfterMs: 500, gestureCooldownMs: 0 });
    wait(t, 600);
    expect(t.state).toBe("glance");
    for (let i = 0; i < 100; i++) t.tick(100, false, "down");
    expect(t.state).toBe("glance"); // sigue siendo la misma hasta que gestureDone() la cierra
  });

  it("gestureDone() sin gesto no hace nada y cancel() vuelve a caminar", () => {
    const t = new IdleTimeline(TIMING);
    t.tick(16, false, "down");
    expect(t.gestureDone()).toBe(false);
    t.cancel();
    expect(t.state).toBe("walk");
  });
});

describe("IdleTimeline: jugar con Jerry (buscar el peluche y trucos)", () => {
  const TIMING = { glanceAfterMs: 1000, playAfterMs: 2000, gestureCooldownMs: 500 };
  const nextGesture = (t: IdleTimeline, facing: Facing = "down") => {
    const s = wait(t, 20000, facing);
    t.gestureDone();
    return s;
  };

  it("los trucos ya no salen solos: la rotación automática es solo mirada y juego", () => {
    const t = new IdleTimeline(TIMING);
    const seen = [nextGesture(t), nextGesture(t), nextGesture(t), nextGesture(t), nextGesture(t), nextGesture(t)];
    expect(seen).toEqual(["glance", "play", "glance", "play", "glance", "play"]);
  });

  it("el visitante pide una acción desde el reposo, desde un gesto en curso o recién parada", () => {
    for (const action of ["fetch", "tricks"] as const) {
      const a = new IdleTimeline(TIMING);
      a.tick(16, false, "down");
      expect(a.startAction(action)).toBe(true);
      expect(a.state).toBe(action);
      const b = new IdleTimeline(TIMING);
      wait(b, 1200);
      expect(b.state).toBe("glance");
      expect(b.startAction(action)).toBe(true);
      expect(new IdleTimeline(TIMING).startAction(action)).toBe(true); // aunque aún figure como «walk»
    }
  });

  it("una acción en curso no se reinicia ni se sustituye por la otra", () => {
    const t = new IdleTimeline(TIMING);
    t.tick(16, false, "down");
    expect(t.startAction("tricks")).toBe(true);
    expect(t.startAction("tricks")).toBe(false);
    expect(t.startAction("fetch")).toBe(false);
    expect(t.state).toBe("tricks");
  });

  it("durante la acción no salen gestos solos; al terminar vuelve al reposo con su pausa", () => {
    const t = new IdleTimeline(TIMING);
    t.tick(16, false, "down");
    t.startAction("fetch");
    for (let i = 0; i < 200; i++) t.tick(100, false, "down");
    expect(t.state).toBe("fetch");
    expect(t.actionDone()).toBe(true);
    expect(t.state).toBe("rest");
    expect(wait(t, 400)).toBe("rest"); // dentro de la pausa de 500 ms
    expect(t.actionDone()).toBe(false);
  });

  it("moverse cancela la acción", () => {
    for (const action of ["fetch", "tricks"] as const) {
      const t = new IdleTimeline(TIMING);
      t.startAction(action);
      expect(t.tick(16, true, "right")).toBe(true);
      expect(t.state).toBe("walk");
    }
  });

  it("las acciones no alteran la rotación de gestos", () => {
    const t = new IdleTimeline(TIMING);
    nextGesture(t); // mirada
    t.startAction("tricks");
    t.actionDone();
    expect(nextGesture(t)).toBe("play");
  });

  it("gestureDone() no cierra una acción ni actionDone() un gesto", () => {
    const t = new IdleTimeline(TIMING);
    t.startAction("fetch");
    expect(t.gestureDone()).toBe(false);
    const u = new IdleTimeline(TIMING);
    wait(u, 1200);
    expect(u.actionDone()).toBe(false);
  });
});
