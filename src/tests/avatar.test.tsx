// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import atlasJson from "../../public/assets/characters/avatar/vanessa-jerry-avatar-idle-happy.atlas.json";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { ProgressStore } from "../app/progressStore";
import { ProgressProvider } from "../app/ProgressProvider";
import { AvatarPortrait } from "../components/ui/AvatarPortrait";
import { cycleMs, frameIndexAt, HAPPY_CYCLES, stillFrameName } from "../components/ui/avatarTimeline";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, AvatarAnimation, BitacoraConfig } from "../config/types";
import { GameBridge } from "../game/bridge/GameBridge";
import { ProgressStorage, type StorageLike } from "../storage/progressStorage";

const manifest = manifestJson as unknown as AssetManifest;
const config = bitacoraJson as unknown as BitacoraConfig;
const sheet = manifest.assets["character.vanessa-jerry.avatar.animations"];
const IDLE = sheet.avatarAnimations!.find((a) => a.state === "idle") as AvatarAnimation;
const HAPPY = sheet.avatarAnimations!.find((a) => a.state === "happy") as AvatarAnimation;

describe("línea de tiempo del avatar", () => {
  it("el reposo respira y parpadea: el fotograma depende del tiempo y da vueltas sin fin", () => {
    expect(cycleMs(IDLE)).toBe(2720);
    expect([0, 1799, 1800, 2099, 2100, 2219, 2220, 2719, 2720].map((t) => frameIndexAt(IDLE, t))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 0]);
    expect(frameIndexAt(IDLE, 2720 * 5 + 1900)).toBe(1);
  });

  it("la alegría dura 1,2 s por vuelta y se repite", () => {
    expect(cycleMs(HAPPY)).toBe(1200);
    expect([0, 349, 350, 600, 850, 1199, 1200].map((t) => frameIndexAt(HAPPY, t))).toEqual([0, 0, 1, 2, 3, 3, 0]);
    expect(HAPPY_CYCLES * cycleMs(HAPPY)).toBe(7200);
  });

  it("con movimiento reducido: reposo en su primer fotograma y alegría en la sonrisa abierta", () => {
    expect(stillFrameName(IDLE)).toBe("idle-00");
    expect(stillFrameName(HAPPY)).toBe("happy-01");
  });
});

describe("AvatarPortrait", () => {
  let run = 0; // una URL distinta por prueba: la carga de la hoja se guarda por URL y no debe pasar de una prueba a otra
  class MemoryStorage implements StorageLike {
    data = new Map<string, string>();
    getItem(k: string) { return this.data.get(k) ?? null; }
    setItem(k: string, v: string) { this.data.set(k, v); }
    removeItem(k: string) { this.data.delete(k); }
  }
  const mount = (bridge?: GameBridge) => {
    const assets = createAssetRegistry(manifest, `http://localhost:5173/run-${++run}/assets.json`);
    return render(
      <BitacoraProvider config={config} assets={assets}>
        <ProgressProvider store={new ProgressStore(config, new ProgressStorage(() => new MemoryStorage()))}>
          <AvatarPortrait bridge={bridge} />
        </ProgressProvider>
      </BitacoraProvider>,
    );
  };
  const drawn = vi.fn();
  const frames = new Map(Object.entries(atlasJson.frames).map(([name, f]) => [`${f.frame.x},${f.frame.y}`, name]));
  const names = () => drawn.mock.calls.map((c) => frames.get(`${c[1]},${c[2]}`));

  beforeEach(() => {
    drawn.mockClear();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ clearRect() {}, drawImage: drawn } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal("Image", class { onload?: () => void; set src(_v: string) { queueMicrotask(() => this.onload?.()); } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => atlasJson })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("antes de cargar la hoja muestra el avatar estático del catálogo, sin lienzo", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = mount();
    const img = container.querySelector(".hud__portrait img") as HTMLImageElement;
    expect(img.src).toMatch(/characters\/avatar\/vanessa-jerry-avatar\.png$/);
    expect(img.hidden).toBe(false);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("con la hoja cargada pasa a un lienzo (el estático se oculta) y dibuja el reposo", async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector("canvas")).not.toBeNull());
    expect((container.querySelector(".hud__portrait img") as HTMLImageElement).hidden).toBe(true);
    expect(container.querySelector("canvas")?.getAttribute("aria-hidden")).toBe("true");
    await waitFor(() => expect(names()).toContain("idle-00"));
  });

  it("si el atlas no carga se queda el avatar estático", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const { container } = mount();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(container.querySelector("canvas")).toBeNull();
    expect((container.querySelector(".hud__portrait img") as HTMLImageElement).hidden).toBe(false);
  });

  it("al completar una estación (app:celebrate) muestra la sonrisa y, con movimiento reducido, vuelve al reposo", async () => {
    const bridge = new GameBridge();
    const { container } = mount(bridge);
    await waitFor(() => expect(container.querySelector("canvas")).not.toBeNull());
    await waitFor(() => expect(names()).toEqual(["idle-00"]));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    act(() => bridge.emit("app:celebrate", { effectId: "demo@1", learningId: "apr-a" }));
    expect(names().at(-1)).toBe("happy-01");
    act(() => { vi.advanceTimersByTime(HAPPY_CYCLES * cycleMs(HAPPY) + 100); });
    expect(names().at(-1)).toBe("idle-00");
    vi.useRealTimers();
  });
});
