// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { TouchControls } from "../components/ui/TouchControls";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig } from "../config/types";
import { GameBridge } from "../game/bridge/GameBridge";
import type { BridgeEvents } from "../game/bridge/events";

const config = bitacoraJson as unknown as BitacoraConfig;
const registry = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost/assets/assets.json");
const L = config.ui.labels;

afterEach(cleanup);

describe("TouchControls (SPEC 6.1, AC-03)", () => {
  let bridge: GameBridge;
  let dirs: Array<BridgeEvents["ui:direction"]>;
  let interacts: number;
  const mount = () => render(<BitacoraProvider config={config} assets={registry}><TouchControls bridge={bridge} /></BitacoraProvider>);
  const button = (name: string) => screen.getByRole("button", { name });
  /** jsdom no tiene PointerEvent ni captura de punteros: se crea el evento y se le fija el `pointerId`. */
  const KINDS: Record<string, "pointerDown" | "pointerUp" | "pointerCancel" | "lostPointerCapture"> = {
    pointerdown: "pointerDown", pointerup: "pointerUp", pointercancel: "pointerCancel", lostpointercapture: "lostPointerCapture",
  };
  const pointer = (el: Element, type: string, pointerId: number) => {
    const event = createEvent[KINDS[type]](el);
    Object.defineProperty(event, "pointerId", { value: pointerId });
    fireEvent(el, event);
  };
  const state = () => {
    const held = new Set<string>();
    for (const d of dirs) d.pressed ? held.add(d.direction) : held.delete(d.direction);
    return [...held].sort();
  };

  beforeEach(() => {
    Element.prototype.setPointerCapture = () => undefined;
    bridge = new GameBridge();
    dirs = [];
    interacts = 0;
    bridge.on("ui:direction", (e) => dirs.push(e));
    bridge.on("ui:interact", (e) => e.pressed && interacts++);
  });

  it("es una región con etiqueta, cuatro botones con nombre textual y «Explorar»", () => {
    mount();
    expect(screen.getByRole("region", { name: L.controlsLabel })).toBeTruthy();
    for (const name of [L.moveUp, L.moveDown, L.moveLeft, L.moveRight, L.explore]) expect(button(name)).toBeTruthy();
    expect(button(L.moveUp).querySelector("[aria-hidden=true]")).not.toBeNull();
  });

  it("mantener una dirección la pulsa y levantar el dedo la suelta", () => {
    mount();
    pointer(button(L.moveLeft), "pointerdown", 1);
    expect(state()).toEqual(["left"]);
    pointer(button(L.moveLeft), "pointerup", 1);
    expect(state()).toEqual([]);
  });

  it("pointercancel y pérdida de captura también sueltan (no queda ninguna entrada atascada)", () => {
    mount();
    pointer(button(L.moveUp), "pointerdown", 1);
    pointer(button(L.moveUp), "pointercancel", 1);
    expect(state()).toEqual([]);
    pointer(button(L.moveRight), "pointerdown", 2);
    pointer(button(L.moveRight), "lostpointercapture", 2);
    expect(state()).toEqual([]);
  });

  it("dos dedos: una dirección mantenida y «Explorar» a la vez, sin soltar la dirección", () => {
    mount();
    pointer(button(L.moveDown), "pointerdown", 1);
    pointer(button(L.explore), "pointerdown", 2);
    expect(interacts).toBe(1);
    expect(state()).toEqual(["down"]);
    pointer(button(L.moveDown), "pointerup", 1);
    expect(state()).toEqual([]);
  });

  it("dos dedos en la misma dirección: se suelta solo cuando se levantan los dos", () => {
    mount();
    pointer(button(L.moveLeft), "pointerdown", 1);
    pointer(button(L.moveLeft), "pointerdown", 2);
    pointer(button(L.moveLeft), "pointerup", 1);
    expect(state()).toEqual(["left"]);
    pointer(button(L.moveLeft), "pointerup", 2);
    expect(state()).toEqual([]);
  });

  it("dos direcciones a la vez (diagonal) y soltar una deja la otra", () => {
    mount();
    pointer(button(L.moveUp), "pointerdown", 1);
    pointer(button(L.moveRight), "pointerdown", 2);
    expect(state()).toEqual(["right", "up"]);
    pointer(button(L.moveUp), "pointerup", 1);
    expect(state()).toEqual(["right"]);
  });

  it("un pointerup de un puntero desconocido no hace nada", () => {
    mount();
    pointer(button(L.moveLeft), "pointerup", 9);
    expect(dirs).toEqual([]);
  });

  it("con teclado (Enter o Espacio) mantiene mientras se pulsa y suelta al levantar o perder el foco", () => {
    mount();
    fireEvent.keyDown(button(L.moveUp), { key: "Enter" });
    expect(state()).toEqual(["up"]);
    fireEvent.keyDown(button(L.moveUp), { key: "Enter", repeat: true });
    expect(dirs.filter((d) => d.pressed)).toHaveLength(1); // la autorepetición no cuenta
    fireEvent.keyUp(button(L.moveUp), { key: "Enter" });
    expect(state()).toEqual([]);
    fireEvent.keyDown(button(L.moveLeft), { key: " " });
    fireEvent.blur(button(L.moveLeft));
    expect(state()).toEqual([]);
    fireEvent.keyDown(button(L.explore), { key: "Enter" });
    fireEvent.keyDown(button(L.explore), { key: "Enter", repeat: true });
    expect(interacts).toBe(1);
  });

  it("ocultar la pestaña, perder el foco de la ventana o desmontar sueltan todo", () => {
    const view = mount();
    pointer(button(L.moveUp), "pointerdown", 1);
    pointer(button(L.moveLeft), "pointerdown", 2);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(state()).toEqual([]);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    pointer(button(L.moveRight), "pointerdown", 3);
    window.dispatchEvent(new Event("blur"));
    expect(state()).toEqual([]);
    pointer(button(L.moveDown), "pointerdown", 4);
    view.unmount();
    expect(state()).toEqual([]);
  });

  it("no deja listeners de ventana ni de documento al desmontar", () => {
    const added: string[] = [];
    const removed: string[] = [];
    const add = window.addEventListener, remove = window.removeEventListener;
    window.addEventListener = ((t: string, ...rest: never[]) => { added.push(t); return (add as (...a: unknown[]) => void)(t, ...rest); }) as typeof add;
    window.removeEventListener = ((t: string, ...rest: never[]) => { removed.push(t); return (remove as (...a: unknown[]) => void)(t, ...rest); }) as typeof remove;
    try {
      mount().unmount();
    } finally {
      window.addEventListener = add;
      window.removeEventListener = remove;
    }
    expect(added.filter((t) => t === "blur").length).toBe(removed.filter((t) => t === "blur").length);
  });

  it("los controles evitan el menú contextual del toque largo", () => {
    mount();
    const event = createEvent.contextMenu(button(L.moveUp));
    fireEvent(button(L.moveUp), event);
    expect(event.defaultPrevented).toBe(true);
  });
});
