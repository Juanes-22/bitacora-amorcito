// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { ControlsModeToggle } from "../components/ui/ControlsModeToggle";
import { NearbyPrompt } from "../components/ui/NearbyPrompt";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig } from "../config/types";

afterEach(cleanup);
const config = bitacoraJson as unknown as BitacoraConfig;
const registry = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost/assets/assets.json");
const L = config.ui.labels;
const wrap = (ui: React.ReactElement) => render(<BitacoraProvider config={config} assets={registry}>{ui}</BitacoraProvider>);

describe("ControlsModeToggle", () => {
  it("en modo tocar ofrece la cruceta y en modo cruceta ofrece tocar para caminar", () => {
    const { rerender } = wrap(<ControlsModeToggle mode="tap" onToggle={() => undefined} />);
    expect(screen.getByRole("button", { name: L.controlsUseDpad })).toBeTruthy();
    rerender(<BitacoraProvider config={config} assets={registry}><ControlsModeToggle mode="dpad" onToggle={() => undefined} /></BitacoraProvider>);
    expect(screen.getByRole("button", { name: L.controlsUseTap })).toBeTruthy();
  });

  it("es un botón con el arte del engranaje (decorativo) y avisa al pulsarse", () => {
    const onToggle = vi.fn();
    wrap(<ControlsModeToggle mode="tap" onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: L.controlsUseDpad });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(button.querySelector("img")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("la configuración por defecto es tocar para caminar", () => {
    expect(config.gameplay.touchControls).toBe("tap");
  });
});

describe("NearbyPrompt: invita según cómo se maneje", () => {
  const station = { kind: "learning", id: "apr-a" } as const;
  const portal = { kind: "portal", id: "a-b" } as const;
  it("con el dedo en modo tocar: «Toca la estación para explorar» y «Toca el portal para viajar»", () => {
    wrap(<NearbyPrompt target={station} hint="tap" />);
    expect(screen.getByText(new RegExp(L.tapExplore))).toBeTruthy();
    cleanup();
    wrap(<NearbyPrompt target={portal} hint="tap" />);
    expect(screen.getByText(new RegExp(L.tapTravel))).toBeTruthy();
  });
  it("con cruceta: nombra el botón «Explorar»; con teclado: Enter", () => {
    wrap(<NearbyPrompt target={station} hint="button" />);
    expect(screen.getByText(/— Explorar$/)).toBeTruthy();
    cleanup();
    wrap(<NearbyPrompt target={station} hint="key" />);
    expect(screen.getByText(/Explorar \(Enter\)/)).toBeTruthy();
  });
  it("sin objetivo no dice nada", () => {
    wrap(<NearbyPrompt target={null} hint="tap" />);
    expect(screen.queryByText(/Toca/)).toBeNull();
  });
});
