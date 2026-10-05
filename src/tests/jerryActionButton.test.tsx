// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "./fixtures/realConfig";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { JerryActionButton } from "../components/ui/JerryActionButton";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig } from "../config/types";
import { GameBridge } from "../game/bridge/GameBridge";

afterEach(cleanup);
const config = bitacoraJson as unknown as BitacoraConfig;
const registry = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost/assets/assets.json");
const mount = (bridge: GameBridge, disabled = false, c = config) => render(<BitacoraProvider config={c} assets={registry}><JerryActionButton bridge={bridge} disabled={disabled} /></BitacoraProvider>);

describe("JerryActionButton", () => {
  it("es un botón con la etiqueta y la tecla, icono decorativo, que pide buscar el peluche por el puente", () => {
    const bridge = new GameBridge();
    const seen = vi.fn();
    bridge.on("ui:jerry-action", seen);
    mount(bridge);
    const button = screen.getByRole("button", { name: "Jugar con Jerry (P)" });
    expect(button.getAttribute("aria-keyshortcuts")).toBe("P");
    expect(button.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(button.querySelector("img")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(button);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("desactivado (ventana abierta) no pide nada", () => {
    const bridge = new GameBridge();
    const seen = vi.fn();
    bridge.on("ui:jerry-action", seen);
    mount(bridge, true);
    fireEvent.click(screen.getByRole("button", { name: /Jugar con Jerry/ }));
    expect(seen).not.toHaveBeenCalled();
  });

  it("sin ninguna acción (ni trucos ni búsqueda) o sin tecla en la configuración no existe", () => {
    const c = structuredClone(config);
    delete c.gameplay.player.idle!.fetch;
    delete c.gameplay.player.idle!.tricks;
    expect(mount(new GameBridge(), false, c).container.querySelector(".hud__jerry")).toBeNull();
    cleanup();
    const d = structuredClone(config);
    delete d.gameplay.player.idle!.actionKey;
    expect(mount(new GameBridge(), false, d).container.querySelector(".hud__jerry")).toBeNull();
  });

  it("basta una de las dos acciones para que exista", () => {
    const c = structuredClone(config);
    delete c.gameplay.player.idle!.fetch;
    expect(mount(new GameBridge(), false, c).container.querySelector(".hud__jerry")).not.toBeNull();
  });

  it("usa la tecla configurada", () => {
    const c = structuredClone(config);
    c.gameplay.player.idle!.actionKey = "J";
    mount(new GameBridge(), false, c);
    expect(screen.getByRole("button", { name: "Jugar con Jerry (J)" })).toBeTruthy();
  });
});
