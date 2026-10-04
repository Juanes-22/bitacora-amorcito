// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { ProgressProvider } from "../app/ProgressProvider";
import { ProgressStore } from "../app/progressStore";
import { LearningList } from "../components/ui/LearningList";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig } from "../config/types";
import { ProgressStorage, type StorageLike } from "../storage/progressStorage";

afterEach(cleanup);
const registry = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost/assets/assets.json");
const base = bitacoraJson as unknown as BitacoraConfig;

class Memory implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

function mount(edit?: (c: BitacoraConfig) => void) {
  const config = structuredClone(base);
  edit?.(config);
  const store = new ProgressStore(config, new ProgressStorage(() => new Memory()));
  const onOpen = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <BitacoraProvider config={config} assets={registry}>
      <ProgressProvider store={store}>
        <LearningList onOpen={onOpen} onClose={onClose} />
      </ProgressProvider>
    </BitacoraProvider>,
  );
  return { ...view, config, store, onOpen, onClose };
}

describe("LearningList (AC-11)", () => {
  it("es un diálogo modal con el título «Bitácora de aprendizajes» y una lista ordenada de los seis aprendizajes", () => {
    mount();
    const dialog = screen.getByRole("dialog", { name: base.ui.labels.index });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(6);
    expect(within(dialog).getByRole("list").tagName).toBe("OL");
  });

  it("dice el estado con texto (no solo con color) y la zona de cada aprendizaje", () => {
    mount();
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain(base.ui.labels.stateAvailable);
    expect(items[1].textContent).toContain(base.ui.labels.stateLocked);
    expect(items[0].textContent).toContain(base.maps["zona-a"].label);
    expect(items[3].textContent).toContain(base.maps["zona-b"].label);
  });

  it("cada botón tiene un nombre que identifica el aprendizaje y su estado; el primero recibe el foco", () => {
    mount();
    const first = screen.getAllByRole("button", { name: /Explorar: Aprendizaje 1/ })[0];
    expect(first.getAttribute("aria-label")).toContain(base.learnings["apr-a"].title);
    expect(first.getAttribute("aria-label")).toContain(base.ui.labels.stateAvailable);
    expect(document.activeElement).toBe(first);
  });

  it("pulsar un aprendizaje, incluso bloqueado, lo pide con su ID (las reglas las aplica el controlador)", () => {
    const { onOpen } = mount();
    fireEvent.click(screen.getAllByRole("button", { name: /Explorar: Aprendizaje 2/ })[0]);
    expect(onOpen).toHaveBeenCalledWith("apr-b");
  });

  it("tiene un solo botón «Cerrar» (el verde del pie) y Escape también cierra", () => {
    const { onClose } = mount();
    expect(screen.getAllByRole("button", { name: base.ui.labels.close })).toHaveLength(1);
    expect(screen.getByRole("button", { name: base.ui.labels.close }).className).toContain("pixel-button");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: base.ui.labels.close }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("con la ruta vacía muestra el mensaje y ninguna fila", () => {
    mount((c) => { c.route = []; });
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(base.ui.labels.emptyRouteLabel)).toBeTruthy();
  });

  it("los textos largos no rompen el diseño: el título admite partirse en cualquier punto", () => {
    mount((c) => { c.learnings["apr-a"].title = "Pseudo".repeat(40); });
    expect(screen.getAllByText(/Pseudo/)[0].className).toContain("learning-list__title");
  });
});
