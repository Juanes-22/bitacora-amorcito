import { beforeEach, describe, expect, it } from "vitest";
import { GameBridge } from "../game/bridge/GameBridge";
import type { BridgeEvents } from "../game/bridge/events";
import { InteractionSystem, type InteractionTarget } from "../game/systems/InteractionSystem";

const learning = (id: string, x: number, y: number, order: number, radius = 70): InteractionTarget => ({ target: { kind: "learning", id }, x, y, radius, order });
const portal = (id: string, x: number, y: number, order: number, radius = 60): InteractionTarget => ({ target: { kind: "portal", id }, x, y, radius, order });

describe("InteractionSystem", () => {
  let bridge: GameBridge;
  let token: number;
  let nearby: Array<BridgeEvents["game:nearby-changed"]>;
  let opens: Array<BridgeEvents["game:learning-open-request"]>;
  let travels: Array<BridgeEvents["game:portal-request"]>;

  const make = (targets: InteractionTarget[]) => new InteractionSystem(bridge, token, "zona-a", targets);

  beforeEach(() => {
    bridge = new GameBridge();
    token = bridge.beginScene();
    nearby = [];
    opens = [];
    travels = [];
    bridge.on("game:nearby-changed", (e) => nearby.push(e));
    bridge.on("game:learning-open-request", (e) => opens.push(e));
    bridge.on("game:portal-request", (e) => travels.push(e));
  });

  it("mide desde los pies al punto de interacción, dentro de su radio", () => {
    const s = make([learning("a", 100, 100, 0)]);
    expect(s.nearest({ x: 100, y: 170 })).toEqual({ kind: "learning", id: "a" }); // justo en el radio
    expect(s.nearest({ x: 100, y: 171 })).toBeNull();
  });

  it("con varias cercanas elige por distancia y, a igualdad, por orden", () => {
    const near = make([learning("a", 100, 100, 0), learning("b", 130, 100, 1)]);
    expect(near.nearest({ x: 125, y: 100 })).toEqual({ kind: "learning", id: "b" });
    const tie = make([learning("late", 80, 100, 5), learning("early", 120, 100, 2)]);
    expect(tie.nearest({ x: 100, y: 100 })).toEqual({ kind: "learning", id: "early" });
    // El empate se resuelve igual sin importar el orden del arreglo.
    const tieReversed = make([learning("early", 120, 100, 2), learning("late", 80, 100, 5)]);
    expect(tieReversed.nearest({ x: 100, y: 100 })).toEqual({ kind: "learning", id: "early" });
  });

  it("avisa solo cuando cambia el objetivo, no en cada fotograma", () => {
    const s = make([learning("a", 100, 100, 0)]);
    for (let i = 0; i < 30; i++) s.update({ x: 100, y: 100 }, false);
    expect(nearby).toHaveLength(1);
    s.update({ x: 400, y: 400 }, false);
    s.update({ x: 400, y: 400 }, false);
    expect(nearby.map((n) => n.target)).toEqual([{ kind: "learning", id: "a" }, null]);
    expect(nearby.every((n) => n.token === token)).toBe(true);
  });

  it("la proximidad sola no abre nada: hace falta una pulsación", () => {
    const s = make([learning("a", 100, 100, 0)]);
    s.update({ x: 100, y: 100 }, false);
    expect(opens).toHaveLength(0);
    expect(s.update({ x: 100, y: 100 }, true)).toBe(true);
    expect(opens).toHaveLength(1);
    expect(opens[0]).toMatchObject({ learningId: "a", token });
  });

  it("sin objetivo cercano una pulsación no solicita nada", () => {
    const s = make([learning("a", 100, 100, 0)]);
    expect(s.update({ x: 900, y: 900 }, true)).toBe(false);
    expect(opens).toHaveLength(0);
  });

  it("bloquea nuevas solicitudes mientras una se resuelve y se libera al resolverla (también si se deniega)", () => {
    const s = make([learning("a", 100, 100, 0)]);
    s.update({ x: 100, y: 100 }, true);
    expect(s.hasPending).toBe(true);
    expect(s.update({ x: 100, y: 100 }, true)).toBe(false);
    expect(opens).toHaveLength(1);
    bridge.emit("app:request-resolved", { requestId: "otra", accepted: true });
    expect(s.hasPending).toBe(true); // una resolución ajena no libera
    bridge.emit("app:request-resolved", { requestId: opens[0].requestId, accepted: false, reason: "locked" });
    expect(s.hasPending).toBe(false);
    s.update({ x: 100, y: 100 }, true);
    expect(opens).toHaveLength(2);
    expect(opens[1].requestId).not.toBe(opens[0].requestId);
  });

  it("los portales solicitan viaje con su zona de origen", () => {
    const s = make([portal("a-b", 500, 500, 10)]);
    s.update({ x: 500, y: 500 }, true);
    expect(travels).toEqual([{ portalId: "a-b", fromZoneId: "zona-a", token, requestId: expect.any(String) }]);
    expect(opens).toHaveLength(0);
  });

  it("clearNearby avisa null una vez para que el siguiente fotograma reavise", () => {
    const s = make([learning("a", 100, 100, 0)]);
    s.update({ x: 100, y: 100 }, false);
    s.clearNearby();
    s.clearNearby();
    s.update({ x: 100, y: 100 }, false);
    expect(nearby.map((n) => n.target?.kind ?? null)).toEqual(["learning", null, "learning"]);
  });

  it("destroy retira su suscripción y no deja listeners", () => {
    const before = bridge.listenerCount("app:request-resolved");
    const s = make([]);
    expect(bridge.listenerCount("app:request-resolved")).toBe(before + 1);
    s.destroy();
    expect(bridge.listenerCount("app:request-resolved")).toBe(before);
  });
});
