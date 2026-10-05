// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "./fixtures/realConfig";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { IconButton } from "../components/ui/IconButton";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig } from "../config/types";

afterEach(cleanup);
const config = bitacoraJson as unknown as BitacoraConfig;
const registry = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost/assets/assets.json");
const wrap = (ui: React.ReactElement) => render(<BitacoraProvider config={config} assets={registry}>{ui}</BitacoraProvider>);

describe("IconButton (botones de la cabecera con el arte del catálogo)", () => {
  it("usa el asset por su ID: la imagen es decorativa y el nombre accesible va en el botón", () => {
    wrap(<IconButton assetId="ui.button.paw.default" label="Jugar con Jerry (P)" />);
    const button = screen.getByRole("button", { name: "Jugar con Jerry (P)" });
    const img = button.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("http://localhost/assets/ui/buttons/paw-button.png");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("aria-hidden")).toBe("true");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("title")).toBe("Jugar con Jerry (P)");
  });

  it("escala y centra la imagen con su contentBounds para que el marco llene la caja del botón", () => {
    wrap(<IconButton assetId="ui.button.audio.default" label="Audio" />);
    const style = (screen.getByRole("button").style);
    const box = manifestJson.assets["ui.button.audio.default" as keyof typeof manifestJson.assets] as unknown as { contentBounds: { x: number; y: number; width: number; height: number } };
    const { x, y, width, height } = box.contentBounds;
    expect(parseFloat(style.getPropertyValue("--icon-w"))).toBeCloseTo((1254 / width) * 100, 4);
    expect(parseFloat(style.getPropertyValue("--icon-tx"))).toBeCloseTo(-((x + width / 2) / 1254) * 100, 4);
    expect(parseFloat(style.getPropertyValue("--icon-ty"))).toBeCloseTo(-((y + height / 2) / 1254) * 100, 4);
  });

  it("el texto de ayuda puede ser más largo que el nombre accesible", () => {
    wrap(<IconButton assetId="ui.button.audio.default" label="Silenciar música" hint="Silenciar música — Beyond The Clouds" />);
    const button = screen.getByRole("button", { name: "Silenciar música" });
    expect(button.getAttribute("title")).toContain("Beyond The Clouds");
  });

  it("reenvía clics, desactivado y atributos", () => {
    const onClick = vi.fn();
    const { rerender } = wrap(<IconButton assetId="ui.button.badges.default" label="Insignias" onClick={onClick} data-x="1" />);
    fireEvent.click(screen.getByRole("button", { name: "Insignias" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button").getAttribute("data-x")).toBe("1");
    rerender(<BitacoraProvider config={config} assets={registry}><IconButton assetId="ui.button.badges.default" label="Insignias" onClick={onClick} disabled /></BitacoraProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Insignias" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("los cinco botones de la cabecera salen de ui.assets y existen en el catálogo como botones", () => {
    const a = config.ui.assets;
    for (const id of [a.badgesButton, a.listButton, a.musicButton, a.jerryButton]) expect(registry.get(id).kind).toBe("button");
  });
});
