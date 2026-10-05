// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "./fixtures/realConfig";
import { App } from "../app/App";
import { createAssetRegistry } from "../config/assetRegistry";
import type { LoadResult } from "../config/loadApp";
import type { AssetManifest, BitacoraConfig } from "../config/types";

// jsdom no tiene WebGL: el motor se sustituye por un contenedor que registra sus propiedades.
const mounts = vi.hoisted(() => ({ count: 0, inertValues: [] as Array<boolean | undefined> }));
vi.mock("../components/game/PhaserGame", async () => {
  const React = await import("react");
  return {
    PhaserGame: ({ inert, hostRef }: { inert?: boolean; hostRef?: React.Ref<HTMLDivElement> }) => {
      React.useEffect(() => { mounts.count += 1; }, []);
      mounts.inertValues.push(inert);
      return React.createElement("div", { "data-testid": "host", tabIndex: 0, ref: hostRef, inert });
    },
  };
});

afterEach(() => {
  cleanup();
  mounts.count = 0;
  mounts.inertValues.length = 0;
});

const assets = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost:5173/assets/assets.json");
const okResult = (): LoadResult => ({
  ok: true,
  config: structuredClone(bitacoraJson) as unknown as BitacoraConfig,
  assets,
  urls: { config: "http://localhost:5173/config/bitacora.json", maps: "http://localhost:5173/config/maps.json", assets: "http://localhost:5173/assets/assets.json" },
});

describe("App", () => {
  it("muestra un estado de carga y después la portada", async () => {
    let resolve!: (r: LoadResult) => void;
    render(<App load={() => new Promise<LoadResult>((r) => { resolve = r; })} />);
    expect(screen.getByRole("status").textContent).toContain("Cargando");
    await act(async () => resolve(okResult()));
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(document.title).toBe("Mi bitácora — Un recorrido de aprendizajes | Vanessa Estrada");
  });

  it("mientras la portada está abierta, el mapa es inert y el botón tiene el foco", async () => {
    render(<App load={() => Promise.resolve(okResult())} />);
    const button = await screen.findByRole("button", { name: "Comenzar recorrido" });
    expect(screen.getByTestId("host").hasAttribute("inert")).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("«Comenzar» cierra la portada, habilita el mapa, lo enfoca y no lo vuelve a montar", async () => {
    render(<App load={() => Promise.resolve(okResult())} />);
    fireEvent.click(await screen.findByRole("button", { name: "Comenzar recorrido" }));
    await waitFor(() => expect(screen.queryByRole("heading", { level: 1 })).toBeNull());
    const host = screen.getByTestId("host");
    expect(host.hasAttribute("inert")).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(host));
    expect(mounts.count).toBe(1);
  });

  it("una carga fallida muestra el motivo, conserva el aviso del avance y permite reintentar", async () => {
    const load = vi
      .fn<() => Promise<LoadResult>>()
      .mockResolvedValueOnce({ ok: false, failure: { stage: "network", url: "http://x/assets/assets.json", message: "HTTP 404 Not Found" } })
      .mockResolvedValueOnce(okResult());
    render(<App load={load} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("HTTP 404 Not Found");
    expect(alert.textContent).toContain("Tu avance guardado no se ha modificado");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("una bitácora inválida lista cada error con su ruta y no construye el mundo", async () => {
    const load = () =>
      Promise.resolve<LoadResult>({
        ok: false,
        failure: { stage: "bitacora", url: "u", issues: [{ path: "placements.apr-c.decorationAssetId", message: "asset ID no encontrado: «x»" }] },
      });
    render(<App load={load} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("placements.apr-c.decorationAssetId: asset ID no encontrado");
    expect(screen.queryByTestId("host")).toBeNull();
  });
});
