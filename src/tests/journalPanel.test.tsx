// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "./fixtures/realConfig";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { ProgressStore } from "../app/progressStore";
import { ProgressProvider } from "../app/ProgressProvider";
import type { ReadingActions, ReadingState } from "../app/useProgressController";
import { LearningDialog } from "../components/reading/LearningDialog";
import { JournalIndex } from "../components/ui/JournalIndex";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig, SectionId } from "../config/types";
import { ProgressStorage, type StorageLike } from "../storage/progressStorage";
import { demoOf } from "./fixtures/demoConfig";

afterEach(cleanup);
const assets = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost:5173/assets/assets.json");
const base = demoOf(bitacoraJson as unknown as BitacoraConfig);
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

describe("JournalIndex: la Bitácora de aprendizajes", () => {
  const show = (config: BitacoraConfig, store: ProgressStore) => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(
      <BitacoraProvider config={config} assets={assets}>
        <ProgressProvider store={store}>
          <JournalIndex onOpen={onOpen} onClose={onClose} />
        </ProgressProvider>
      </BitacoraProvider>,
    );
    return { onOpen, onClose };
  };
  const cards = () => [...document.querySelectorAll<HTMLElement>(".jp-card")];

  it("es un diálogo modal con título, subtítulo y los aprendizajes agrupados por zona con su rango", () => {
    show(base, makeStore(base));
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("heading", { level: 1, name: "Bitácora de aprendizajes" })).toBeTruthy();
    expect(dialog.textContent).toContain("Lo vivido, lo aprendido y lo descubierto.");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Pradera del cerezo", "Jardín del pabellón"]);
    expect([...document.querySelectorAll(".jp-zone small")].map((s) => s.textContent)).toEqual(["Aprendizajes 1 – 3", "Aprendizajes 4 – 6"]);
    expect(cards()).toHaveLength(6);
    expect(cards().map((c) => c.querySelector(".jp-number")?.textContent)).toEqual(["01", "02", "03", "04", "05", "06"]);
    expect(cards().map((c) => c.querySelector("h3")?.textContent)).toEqual(base.route.map((id) => base.learnings[id].title));
  });

  it("cada tarjeta muestra su ilustración del kit (decorativa) y el título; sin texto horneado en las imágenes", () => {
    show(base, makeStore(base));
    for (const c of cards()) {
      const img = c.querySelector<HTMLImageElement>(".jp-card-illustration");
      expect(img?.getAttribute("src")).toContain("/ui/journal-panel/illustrations/");
      expect(img?.getAttribute("alt")).toBe("");
    }
  });

  it("el estado se dice con texto: completado, disponible (con la cinta «Siguiente») y por descubrir con su requisito", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    show(base, store);
    const [one, two, three] = cards();
    expect(one.textContent).toContain("Completado");
    expect(one.textContent).toContain("Volver a leer");
    expect(two.textContent).toContain("Disponible");
    expect(two.textContent).toContain("Explorar");
    expect(two.querySelector(".jp-ribbon")?.textContent).toBe("Siguiente");
    expect(three.textContent).toContain("Por descubrir");
    expect(three.textContent).toContain("Completa el aprendizaje 2");
    expect(document.querySelectorAll(".jp-ribbon")).toHaveLength(1); // solo el siguiente
    expect(cards()[5].textContent).toContain("Completa el aprendizaje 5");
  });

  it("la cápsula cuenta los completados y pinta un segmento por aprendizaje", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    complete(store, "apr-b");
    show(base, store);
    const progress = screen.getByRole("img", { name: "2 de 6 completados" });
    expect(progress.textContent).toContain("2 de 6 completados");
    const segments = [...progress.querySelectorAll<HTMLImageElement>(".jp-segment")];
    expect(segments).toHaveLength(6);
    expect(segments.map((s) => s.src.includes("progress-filled"))).toEqual([true, true, false, false, false, false]);
  });

  it("abrir una tarjeta llama a onOpen con su ID: también la bloqueada (su mensaje lo decide el controlador) y la completada", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    const { onOpen } = show(base, store);
    fireEvent.click(screen.getByRole("button", { name: /Volver a leer: .*Las plantas y las semillas/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explorar: .*La plastilina casera/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explorar: .*El museo y la taxidermia\. Por descubrir\. Completa el aprendizaje 2/ }));
    expect(onOpen.mock.calls.map((c) => c[0])).toEqual(["apr-a", "apr-b", "apr-c"]);
  });

  it("el foco inicial va a la acción del siguiente aprendizaje; Escape, la X y «Volver al mapa» cierran", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    const { onClose } = show(base, store);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Explorar: .*La plastilina casera/ }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar bitácora" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver al mapa" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("con la ruta vacía lo explica y no hay tarjetas ni zonas", () => {
    const c = structuredClone(base);
    c.route = [];
    show(c, makeStore(c));
    expect(cards()).toHaveLength(0);
    expect(screen.getByRole("dialog").textContent).toContain("Contenido por definir");
  });

  it("los textos salen de la configuración: cambiar una etiqueta cambia la interfaz", () => {
    const c = structuredClone(base);
    c.ui.journalPanel!.labels.title = "Mi diario";
    c.ui.journalPanel!.labels.progressTemplate = "{completed}/{total} listos";
    show(c, makeStore(c));
    expect(screen.getByRole("heading", { level: 1, name: "Mi diario" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "0/6 listos" })).toBeTruthy();
  });

  it("una zona sin icono configurado o sin ilustración de un aprendizaje no rompe nada", () => {
    const c = structuredClone(base);
    delete c.ui.journalPanel!.zoneIcons;
    delete c.learnings["apr-a"].illustrationAssetId;
    show(c, makeStore(c));
    expect(cards()).toHaveLength(6);
    expect(cards()[0].querySelector(".jp-card-illustration")).toBeNull();
    expect(document.querySelector(".jp-zone img")).toBeNull();
  });
});

describe("JournalReader: la lectura de un aprendizaje", () => {
  /** La lectura con las acciones del controlador simuladas sobre el almacén real (como `Host` de las pruebas de la ventana sencilla). */
  function Host({ config, store, spies }: { config: BitacoraConfig; store: ProgressStore; spies: Record<"close" | "backToList" | "openBadge", () => void> }) {
    const [reading, setReading] = useState<ReadingState | null>({ kind: "reading", learningId: "apr-a", active: "learning" });
    if (!reading) return null;
    const id = reading.learningId;
    const actions: ReadingActions = {
      continueReading: () => undefined,
      selectSection: (active) => setReading({ kind: "reading", learningId: id, active }),
      markRead: (s) => void store.markSection(id, s),
      claimBadge: () => { const r = store.claimBadge(id); if (r.ok && r.changed) setReading({ kind: "reward", learningId: id }); },
      close: () => { spies.close(); setReading(null); },
      backToList: () => { spies.backToList(); setReading(null); },
      openBadge: () => { spies.openBadge(); setReading(null); },
    };
    return (
      <BitacoraProvider config={config} assets={assets}>
        <ProgressProvider store={store}>
          <LearningDialog reading={reading} actions={actions} />
        </ProgressProvider>
      </BitacoraProvider>
    );
  }
  const show = (config = base, store = makeStore(config)) => {
    const spies = { close: vi.fn(), backToList: vi.fn(), openBadge: vi.fn() };
    render(<Host config={config} store={store} spies={spies} />);
    return { store, ...spies };
  };
  const tab = (name: string) => screen.getByRole("tab", { name: new RegExp(name) });
  const primary = () => document.querySelector<HTMLButtonElement>(".jp-reader-footer .jp-action--primary") as HTMLButtonElement;

  it("es un diálogo con el título, el estado «En curso», la zona y las tres pestañas con el texto de la sección", () => {
    show();
    const dialog = screen.getByRole("dialog", { name: "Las plantas y las semillas" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByText("En curso")).toBeTruthy();
    expect(dialog.textContent).toContain("Aprendizaje 1 · Pradera del cerezo");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Resumen", "Reflexión", "Lo vivido"]);
    expect(tab("Resumen").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("Por medio de una exploración");
    expect(dialog.textContent).toContain("0 de 3 secciones leídas");
  });

  it("el foco inicial está en el propio diálogo (sin anillo sobre ningún botón) y desde ahí Escape lo cierra", () => {
    const { close } = show();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
    expect(document.activeElement).not.toBe(tab("Resumen"));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("abrir otra pestaña NO marca nada como leído; con las flechas se navega sin salir del lector", () => {
    const { store } = show();
    fireEvent.click(tab("Reflexión"));
    expect(screen.getByRole("tabpanel").textContent).toContain("Esta experiencia me hizo pensar");
    fireEvent.keyDown(tab("Reflexión"), { key: "ArrowRight" });
    expect(tab("Lo vivido").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab("Lo vivido"), { key: "Home" });
    expect(tab("Resumen").getAttribute("aria-selected")).toBe("true");
    expect(store.getState().entries["apr-a"].readSectionIds).toEqual([]);
    expect(screen.getByRole("dialog").textContent).toContain("0 de 3 secciones leídas");
  });

  it("«Marcar como leído y continuar» marca la sección actual y pasa a la siguiente pendiente; con la última, ofrece recoger la insignia", () => {
    const { store } = show();
    expect(primary().textContent).toContain("Marcar como leído y continuar");
    expect(screen.getByRole("status").textContent).toContain("Estás leyendo Resumen");
    fireEvent.click(primary());
    expect(store.getState().entries["apr-a"].readSectionIds).toEqual(["learning"]);
    expect(tab("Reflexión").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("dialog").textContent).toContain("1 de 3 secciones leídas");
    fireEvent.click(tab("Lo vivido")); // se salta una: la del medio sigue pendiente
    fireEvent.click(primary());
    expect(store.getState().entries["apr-a"].readSectionIds).toEqual(["learning", "lived"]);
    expect(tab("Reflexión").getAttribute("aria-selected")).toBe("true"); // la pendiente
    fireEvent.click(primary());
    expect(store.getState().entries["apr-a"].readSectionIds).toEqual(["learning", "lived", "reflection"]);
    expect(tab("Reflexión").getAttribute("aria-selected")).toBe("true"); // era la última: se queda
    expect(primary().textContent).toContain("Recoger insignia");
    expect(store.getState().entries["apr-a"].completedAt).toBeUndefined(); // leer las tres no concede nada: hace falta recoger
  });

  it("una sección ya leída no se marca dos veces y su pie dice «Sección leída» con «Continuar lectura»", () => {
    const { store } = show();
    fireEvent.click(primary());
    fireEvent.click(tab("Resumen"));
    expect(screen.getByRole("status").textContent).toContain("Sección leída");
    expect(primary().textContent).toContain("Continuar lectura");
    fireEvent.click(primary());
    expect(store.getState().entries["apr-a"].readSectionIds).toEqual(["learning"]);
    expect(tab("Reflexión").getAttribute("aria-selected")).toBe("true");
  });

  it("con 0/3 la insignia está por obtener (en gris, con candado) y dice cuántas secciones faltan; «Ver insignia» abre su detalle", () => {
    const { openBadge } = show();
    expect(screen.getByRole("heading", { level: 2, name: "Insignia por obtener" })).toBeTruthy();
    expect(document.querySelector(".jp-medal--pending")).toBeTruthy();
    expect(document.querySelector(".jp-medal-lock")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain("Lee las 3 secciones para conseguirla.");
    expect(screen.getByRole("dialog").textContent).toContain("Curiosidad que florece");
    fireEvent.click(screen.getByRole("button", { name: /Ver insignia/ }));
    expect(openBadge).toHaveBeenCalledOnce();
  });

  it("«Recoger insignia» completa el aprendizaje una sola vez y pasa a la ventana de recompensa", () => {
    const { store } = show();
    ALL.forEach((s) => store.markSection("apr-a", s));
    fireEvent.click(tab("Lo vivido")); // nada por marcar: el pie ofrece recoger
    expect(primary().textContent).toContain("Recoger insignia");
    fireEvent.click(primary());
    expect(store.getState().entries["apr-a"].completedAt).toBeDefined();
    expect(screen.getByText(base.ui.labels.rewardTitle)).toBeTruthy(); // la recompensa conserva su ventana
    const when = store.getState().entries["apr-a"].completedAt;
    const again = store.claimBadge("apr-a");
    expect(again.ok && again.changed).toBe(false);
    expect(store.getState().entries["apr-a"].completedAt).toBe(when);
  });

  it("completado: «Completado», «Insignia obtenida» con su color, y el pie recorre las secciones hasta «Volver a la bitácora»", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    const { backToList } = show(base, store);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Completado")).toBeTruthy();
    expect(dialog.textContent).toContain("3 de 3 secciones leídas");
    expect(screen.getByRole("heading", { level: 2, name: "Insignia obtenida" })).toBeTruthy();
    expect(document.querySelector(".jp-medal--pending")).toBeNull();
    expect(document.querySelector(".jp-medal-lock")).toBeNull();
    expect(dialog.textContent).not.toContain("Lee las 3 secciones");
    expect(screen.getAllByRole("tab").every((t) => t.textContent === `${["Resumen", "Reflexión", "Lo vivido"][screen.getAllByRole("tab").indexOf(t)]}, Sección leída`)).toBe(true);
    expect(primary().textContent).toContain("Ver reflexión");
    fireEvent.click(primary());
    expect(tab("Reflexión").getAttribute("aria-selected")).toBe("true");
    expect(primary().textContent).toContain("Ver lo vivido");
    fireEvent.click(primary());
    expect(primary().textContent).toContain("Volver a la bitácora");
    fireEvent.click(primary());
    expect(backToList).toHaveBeenCalledOnce();
  });

  it("la flecha «Bitácora de aprendizajes» vuelve al índice, la X y Escape cierran, y nada de eso marca ni concede", () => {
    const { store, backToList, close } = show();
    fireEvent.click(screen.getByRole("button", { name: "Bitácora de aprendizajes" }));
    expect(backToList).toHaveBeenCalledOnce();
    cleanup();
    const second = show(base, store);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar bitácora" }));
    expect(second.close).toHaveBeenCalledTimes(1);
    cleanup();
    const third = show(base, store);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(third.close).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(store.getState().entries["apr-a"].readSectionIds).toEqual([]);
    expect(store.getState().entries["apr-a"].completedAt).toBeUndefined();
  });

  it("el lateral muestra la ilustración y las palabras clave de la configuración", () => {
    show();
    const side = document.querySelector(".jp-sidebar") as HTMLElement;
    expect(within(side).getByRole("heading", { level: 2, name: "En este aprendizaje" })).toBeTruthy();
    expect([...side.querySelectorAll(".jp-keyword")].map((k) => k.textContent)).toEqual(["Semillas", "Germinación", "Plantas medicinales"]);
    expect(side.querySelector(".jp-sidebar-illustration")?.getAttribute("src")).toContain("learning-plants-seeds");
  });

  it("sin la Bitácora de aprendizajes en la configuración, la lectura es la ventana sencilla (el respaldo)", () => {
    const classic = structuredClone(base);
    delete classic.ui.journalPanel;
    show(classic);
    expect(document.querySelector(".jp-dialog")).toBeNull();
    expect(document.querySelector(".reading")).toBeTruthy();
  });
});
