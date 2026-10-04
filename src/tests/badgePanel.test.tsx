// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { ProgressStore } from "../app/progressStore";
import { ProgressProvider } from "../app/ProgressProvider";
import { BadgePanel } from "../components/ui/BadgePanel";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig, SectionId } from "../config/types";
import { ProgressStorage, type StorageLike } from "../storage/progressStorage";

afterEach(cleanup);
const assets = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost:5173/assets/assets.json");
const base = bitacoraJson as unknown as BitacoraConfig;
const ALL: SectionId[] = ["learning", "reflection", "lived"];

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const makeStore = (config: BitacoraConfig) => new ProgressStore(config, new ProgressStorage(() => new MemoryStorage()));
const complete = (store: ProgressStore, id: string) => {
  ALL.forEach((s) => store.markSection(id, s));
  store.claimBadge(id);
};
const withRoute = (ids: string[], edit?: (c: BitacoraConfig) => void) => {
  const c = structuredClone(base);
  c.route = ids;
  edit?.(c);
  return c;
};

function show(config: BitacoraConfig, store: ProgressStore, props: { completion?: boolean } = {}) {
  const onClose = vi.fn();
  const onReset = vi.fn();
  const onOpenLearning = vi.fn();
  render(
    <BitacoraProvider config={config} assets={assets}>
      <ProgressProvider store={store}>
        <BadgePanel completion={props.completion ?? false} onClose={onClose} onReset={onReset} onOpenLearning={onOpenLearning} />
      </ProgressProvider>
    </BitacoraProvider>,
  );
  return { onClose, onReset, onOpenLearning };
}
const dialog = () => screen.getByRole("dialog");
const cards = () => [...document.querySelectorAll<HTMLElement>(".bpk-card")];

describe("BadgePanel: la colección", () => {
  it("es un diálogo modal con el título «Mis insignias», seis tarjetas numeradas y la de Jerry aparte", () => {
    show(base, makeStore(base));
    expect(dialog().getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("heading", { level: 1, name: "Mis insignias" })).toBeTruthy();
    expect(cards()).toHaveLength(6);
    expect(cards().map((c) => c.querySelector(".bpk-number")?.textContent)).toEqual(["01 / 06", "02 / 06", "03 / 06", "04 / 06", "05 / 06", "06 / 06"]);
    expect(cards().map((c) => c.querySelector(".bpk-card-title")?.textContent)).toEqual(["Curiosidad que florece", "Crear juntas", "Mirar de cerca", "Cuidar la vida", "Imaginar para comprender", "Detenerse a descubrir"]);
    const jerry = document.querySelector<HTMLElement>(".bpk-special") as HTMLElement;
    expect(jerry.textContent).toContain("Compañero de aventuras");
    expect(jerry.textContent).toContain("Especial");
    expect(jerry.textContent).toContain("Por descubrir");
  });

  it("la cápsula de progreso cuenta las obtenidas y pinta un segmento por insignia; la XP y el nivel van en el subtítulo", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    complete(store, "apr-b");
    show(base, store);
    expect(screen.getByRole("img", { name: "2 de 6 insignias" })).toBeTruthy();
    expect(document.querySelector(".bpk-progress")?.textContent).toContain("2 de 6 obtenidas");
    const segs = [...document.querySelectorAll<HTMLImageElement>(".bpk-progress-segments img")].map((i) => i.src);
    expect(segs).toHaveLength(6);
    expect(segs.filter((s) => s.endsWith("progress-filled.png"))).toHaveLength(2);
    expect(document.querySelector(".bpk-subtitle")?.textContent).toBe("Colección de aprendizajes · 200 / 600 XP · Nivel 2");
  });

  it("las obtenidas y las pendientes se distinguen por su texto, no solo por el color, y cada tarjeta tiene nombre accesible", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    show(base, store);
    expect(cards()[0].className).toContain("bpk-card--earned");
    expect(cards()[0].textContent).toContain("Obtenida");
    expect(cards()[0].getAttribute("aria-label")).toBe("Curiosidad que florece. Obtenida. Ver insignia");
    expect(cards()[1].className).toContain("bpk-card--pending");
    expect(cards()[1].textContent).toContain("Por descubrir");
    expect(cards()[1].getAttribute("aria-label")).toBe("Crear juntas. Por descubrir. Ver insignia");
    expect(cards()[1].querySelector(".bpk-lock")).toBeTruthy(); // candado sobre la pendiente
    expect(cards()[0].querySelector(".bpk-lock")).toBeNull();
    expect(cards()[1].querySelector(".bpk-medal--pending")).toBeTruthy();
  });

  it("solo aparecen las insignias de la ruta ACTIVA", () => {
    const config = withRoute(["apr-a", "apr-c"]);
    show(config, makeStore(config));
    expect(cards()).toHaveLength(2);
    expect(document.querySelector(".bpk-progress")?.textContent).toContain("0 de 2 obtenidas");
  });

  it("la insignia de Jerry se obtiene al terminar el recorrido, con la fecha del último, sin sumar XP ni contar", () => {
    const config = withRoute(["apr-a", "apr-c"]);
    const store = makeStore(config);
    complete(store, "apr-a");
    complete(store, "apr-c");
    show(config, store);
    const jerry = document.querySelector<HTMLElement>(".bpk-special") as HTMLElement;
    expect(jerry.textContent).toContain("Obtenida");
    expect(jerry.querySelector(".bpk-lock")).toBeNull();
    expect(document.querySelector(".bpk-progress")?.textContent).toContain("2 de 2 obtenidas"); // Jerry no cuenta
    expect(document.querySelector(".bpk-subtitle")?.textContent).toContain("200 / 200 XP"); // ni suma
  });

  it("al terminar muestra «¡Recorrido completo!» y el espacio de la reflexión final: un aviso mientras la autora no la aporte", () => {
    const config = withRoute(["apr-a"]);
    const store = makeStore(config);
    complete(store, "apr-a");
    show(config, store, { completion: true });
    expect(screen.getByRole("heading", { level: 1, name: "¡Recorrido completo!" })).toBeTruthy();
    expect(within(dialog()).getByRole("heading", { name: "Reflexión final" })).toBeTruthy();
    expect(dialog().textContent).toContain("La reflexión final de Vanessa se añadirá aquí cuando la escriba.");
    cleanup();
    const sin = withRoute(["apr-a"]);
    show(sin, makeStore(sin));
    expect(screen.queryByText("Reflexión final")).toBeNull();
  });

  it("«Volver al mapa» y la X cierran, «Reiniciar recorrido» pide reiniciar y Escape cierra", () => {
    const { onClose, onReset } = show(base, makeStore(base));
    fireEvent.click(screen.getByRole("button", { name: "Volver al mapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar panel de insignias" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar recorrido" }));
    expect(onReset).toHaveBeenCalledOnce();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("con la ruta vacía lo explica y no hay tarjetas ni cierre", () => {
    const config = withRoute([]);
    show(config, makeStore(config));
    expect(cards()).toHaveLength(0);
    expect(dialog().textContent).toContain("Contenido por definir");
    expect(dialog().textContent).not.toContain("Reflexión final");
  });
});

describe("BadgePanel: el detalle", () => {
  const open = (config: BitacoraConfig, store: ProgressStore, index: number) => {
    const handlers = show(config, store);
    fireEvent.click(cards()[index]);
    return handlers;
  };

  it("una obtenida muestra número, nombre, fecha, XP, qué representa, con qué aprendizaje se consiguió y «Ver aprendizaje»", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    const { onOpenLearning } = open(base, store, 0);
    expect(screen.getByRole("heading", { level: 2, name: "Curiosidad que florece" })).toBeTruthy();
    const text = dialog().textContent as string;
    expect(text).toContain("01 / 06");
    expect(text).toContain("INSIGNIA DE APRENDIZAJE");
    expect(text).toMatch(/Obtenida el .*20\d\d/);
    expect(text).toContain("Insignia obtenida");
    expect(text).toContain("+100 XP");
    expect(text).toContain("Valorar cómo nacen las plantas");
    expect(text).toContain("Cómo la conseguí");
    expect(text).toContain("Completando el aprendizaje 1:");
    expect(document.querySelector(".bpk-lesson-callout")?.textContent).toBe("Las plantas y las semillas");
    expect(within(dialog()).getByRole("img", { name: "Curiosidad que florece" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver aprendizaje" }));
    expect(onOpenLearning).toHaveBeenCalledWith("apr-a");
  });

  it("«Lo que me llevo» solo aparece si la autora lo escribió", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    open(base, store, 0);
    expect(dialog().textContent).not.toContain("Lo que me llevo");
    cleanup();
    const config = structuredClone(base);
    config.badges["curiosidad-que-florece"].takeaway = "Una semilla me invita a observar.";
    const store2 = makeStore(config);
    complete(store2, "apr-a");
    open(config, store2, 0);
    expect(dialog().textContent).toContain("Lo que me llevo");
    expect(document.querySelector(".bpk-reflection-callout")?.textContent).toBe("Una semilla me invita a observar.");
  });

  it("una pendiente dice que está por descubrir y cómo conseguirla, sin fecha ni XP", () => {
    open(base, makeStore(base), 1);
    const text = dialog().textContent as string;
    expect(text).toContain("Crear juntas");
    expect(text).toContain("Aún está por descubrir");
    expect(text).toContain("Cómo conseguirla");
    expect(text).toContain("Completa el aprendizaje 2:");
    expect(document.querySelector(".bpk-lesson-callout")?.textContent).toBe("La plastilina casera");
    expect(text).not.toContain("Obtenida el");
    expect(text).not.toContain("+100 XP");
  });

  it("la de Jerry es «especial»: sin aprendizaje ni «Ver aprendizaje», con la condición de terminar el recorrido", () => {
    show(base, makeStore(base));
    fireEvent.click(document.querySelector(".bpk-special") as HTMLElement);
    const text = dialog().textContent as string;
    expect(text).toContain("INSIGNIA DE AMISTAD");
    expect(text).toContain("ESPECIAL");
    expect(text).toContain("Completa todo el recorrido de aprendizajes.");
    expect(screen.queryByRole("button", { name: "Ver aprendizaje" })).toBeNull();
    expect(document.querySelector(".bpk-lesson-callout")).toBeNull();
  });

  it("«Volver a la colección», la flecha, «Mi colección» y Escape vuelven a la colección; Escape en la colección cierra", () => {
    const { onClose } = open(base, makeStore(base), 0);
    fireEvent.click(screen.getByRole("button", { name: "Volver a la colección" }));
    expect(cards()).toHaveLength(6);
    fireEvent.click(cards()[0]);
    fireEvent.click(document.querySelector(".bpk-icon-button--back") as HTMLElement); // la flecha
    expect(cards()).toHaveLength(6);
    fireEvent.click(cards()[0]);
    fireEvent.click(screen.getByRole("button", { name: "Mi colección" }));
    expect(cards()).toHaveLength(6);
    fireEvent.click(cards()[0]);
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(cards()).toHaveLength(6);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("el foco pasa al primer botón al cambiar de vista y Tab no sale del diálogo", () => {
    show(base, makeStore(base));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar panel de insignias" }));
    fireEvent.click(cards()[0]);
    expect(dialog().contains(document.activeElement)).toBe(true);
    const buttons = [...dialog().querySelectorAll<HTMLElement>("button")];
    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(dialog(), { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
  });
});

describe("BadgePanel: las imágenes salen del registro de assets", () => {
  it("define la imagen y el corte de nueve zonas de cada pieza como variables CSS, sin rutas en el componente", () => {
    show(base, makeStore(base));
    const style = (dialog() as HTMLElement).style;
    expect(style.getPropertyValue("--bpk-panel-frame")).toBe('url("http://localhost:5173/assets/ui/badge-panel/frames/panel-frame.png")');
    expect(style.getPropertyValue("--bpk-panel-frame-slice")).toBe("78 78 78 78");
    expect(style.getPropertyValue("--bpk-button-primary-slice")).toBe("30 61 30 61");
    expect(style.getPropertyValue("--bpk-check-white-slice")).toBe(""); // los iconos no son de nueve zonas
    expect(document.querySelector<HTMLImageElement>(".bpk-medal")?.src).toBe("http://localhost:5173/assets/ui/badges/badge-plantas-semillas.png");
  });
});
