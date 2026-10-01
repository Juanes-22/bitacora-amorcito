import { describe, expect, it, vi } from "vitest";
import { GameBridge } from "../game/bridge/GameBridge";

describe("GameBridge: modo de controles", () => {
  it("conserva el último modo para quien arranque después y parte de «tap»", () => {
    const bridge = new GameBridge();
    expect(bridge.controlsMode).toBe("tap");
    bridge.emit("app:controls-mode", { mode: "dpad" });
    expect(bridge.controlsMode).toBe("dpad");
    bridge.emit("app:controls-mode", { mode: "tap" });
    expect(bridge.controlsMode).toBe("tap");
  });
});

describe("GameBridge", () => {
  it("entrega a quien se suscribió y permite darse de baja solo a esa suscripción", () => {
    const bridge = new GameBridge();
    const a = vi.fn();
    const b = vi.fn();
    const offA = bridge.on("ui:interact", a);
    bridge.on("ui:interact", b);
    bridge.emit("ui:interact", { pressed: true });
    offA();
    bridge.emit("ui:interact", { pressed: false });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    expect(bridge.listenerCount("ui:interact")).toBe(1);
  });

  it("darse de baja mientras se emite no rompe la entrega a los demás", () => {
    const bridge = new GameBridge();
    const seen: string[] = [];
    const off = bridge.on("ui:interact", () => { seen.push("a"); off(); });
    bridge.on("ui:interact", () => seen.push("b"));
    bridge.emit("ui:interact", { pressed: true });
    bridge.emit("ui:interact", { pressed: true });
    expect(seen).toEqual(["a", "b", "b"]);
  });

  it("conserva la última instantánea y los bloqueos para quien arranque después", () => {
    const bridge = new GameBridge();
    expect(bridge.snapshot).toBeNull();
    bridge.emit("app:sync", { version: 3, stations: { a: "available" }, pending: [] });
    bridge.emit("app:controls", { reasons: ["dialogue"] });
    expect(bridge.snapshot).toEqual({ version: 3, stations: { a: "available" }, pending: [] });
    expect([...bridge.controlReasons]).toEqual(["dialogue"]);
  });

  it("descarta los mensajes de una escena sustituida mediante el token", () => {
    const bridge = new GameBridge();
    const first = bridge.beginScene();
    expect(bridge.isActive(first)).toBe(true);
    const second = bridge.beginScene();
    expect(second).toBeGreaterThan(first);
    expect(bridge.isActive(first)).toBe(false);
    expect(bridge.isActive(second)).toBe(true);
  });

  it("dispose libera todo lo de este puente y no afecta a otro", () => {
    const one = new GameBridge();
    const two = new GameBridge();
    const handler = vi.fn();
    one.on("ui:interact", handler);
    two.on("ui:interact", handler);
    one.emit("app:sync", { version: 1, stations: {}, pending: [] });
    one.dispose();
    one.emit("ui:interact", { pressed: true });
    two.emit("ui:interact", { pressed: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(one.listenerCount()).toBe(0);
    expect(one.snapshot).toBeNull();
    expect(two.listenerCount()).toBe(1);
  });
});
