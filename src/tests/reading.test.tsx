// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { dialogueLines } from "../app/dialogues";
import { ProgressStore } from "../app/progressStore";
import { ProgressProvider } from "../app/ProgressProvider";
import type { ReadingActions, ReadingState } from "../app/useProgressController";
import { ContentRenderer } from "../components/reading/ContentRenderer";
import { LearningDialog } from "../components/reading/LearningDialog";
import { LearningTabs } from "../components/reading/LearningTabs";
import { ProgressHUD } from "../components/ui/ProgressHUD";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig, ContentBlock, SectionId } from "../config/types";
import { initialProgress } from "../domain/reconcileProgress";
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
const wrap = (config: BitacoraConfig, store: ProgressStore, ui: React.ReactNode) =>
  render(<BitacoraProvider config={config} assets={assets}><ProgressProvider store={store}>{ui}</ProgressProvider></BitacoraProvider>);

/** Reproduce el papel del controlador: las acciones de la ventana pasan por el almacén real. */
function Harness({ config, store, initial, onClose }: { config: BitacoraConfig; store: ProgressStore; initial: ReadingState; onClose?: () => void }) {
  const [reading, setReading] = useState<ReadingState | null>(initial);
  if (!reading) return null;
  const id = reading.learningId;
  const actions: ReadingActions = {
    continueReading: () => setReading({ kind: "reading", learningId: id, active: config.ui.tabs[0].id }),
    selectSection: (active) => setReading({ kind: "reading", learningId: id, active }),
    markRead: (s) => void store.markSection(id, s),
    claimBadge: () => { const r = store.claimBadge(id); if (r.ok && r.changed) setReading({ kind: "reward", learningId: id }); },
    close: () => { setReading(null); onClose?.(); },
  };
  return <LearningDialog reading={reading} actions={actions} />;
}

describe("ContentRenderer (SPEC 7 y 12.7)", () => {
  const render1 = (blocks: ContentBlock[]) => wrap(base, makeStore(base), <ContentRenderer blocks={blocks} />);

  it("renderiza los cinco tipos de bloque como texto semántico", () => {
    const { container } = render1([
      { type: "heading", text: "Subtítulo" },
      { type: "paragraph", text: "Un párrafo." },
      { type: "quote", text: "Una cita.", source: "Alguien" },
      { type: "reference", label: "Fuente A", url: "https://example.org/a" },
      { type: "image", assetId: "station.item.books", alt: "Una pila de libros", caption: "Pie de la imagen" },
    ]);
    expect(screen.getByRole("heading", { level: 3, name: "Subtítulo" })).toBeTruthy();
    expect(screen.getByText("Un párrafo.").tagName).toBe("P");
    expect(container.querySelector("blockquote")?.textContent).toContain("— Alguien");
    const img = screen.getByRole("img", { name: "Una pila de libros" }) as HTMLImageElement;
    expect(img.src).toBe("http://localhost:5173/assets/stations/items/books-stack.png"); // URL del registro, no una ruta escrita
    expect(screen.getByText("Pie de la imagen").tagName).toBe("FIGCAPTION");
  });

  it("los enlaces externos se abren sin darle acceso a la ventana original", () => {
    render1([{ type: "reference", label: "Fuente A", url: "https://example.org/a" }]);
    const link = screen.getByRole("link", { name: "Fuente A" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("una referencia sin URL es solo texto", () => {
    render1([{ type: "reference", label: "Libro sin enlace" }]);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Libro sin enlace")).toBeTruthy();
  });

  it("el texto se escapa: HTML en un párrafo se muestra literal y no crea elementos", () => {
    const { container } = render1([{ type: "paragraph", text: '<img src=x onerror="alert(1)"><script>alert(2)</script><b>negrita</b>' }]);
    expect(container.querySelector("script, b")).toBeNull();
    expect(container.querySelector("img[onerror]")).toBeNull();
    expect(container.textContent).toContain("<script>alert(2)</script>");
  });

  it("un tipo de bloque desconocido es un error editorial visible, nunca ejecución", () => {
    render1([{ type: "video", url: "x" } as unknown as ContentBlock]);
    expect(screen.getByRole("alert").textContent).toContain("Bloque no soportado: «video»");
  });

  it("una lista vacía no rompe nada", () => {
    const { container } = render1([]);
    expect(container.querySelector(".content")?.children).toHaveLength(0);
  });
});

describe("LearningTabs (patrón ARIA)", () => {
  const tabs = ALL.map((id, i) => ({ id, label: ["Resumen", "Reflexión", "Lo vivido"][i], read: id === "learning" }));
  const parentKey = vi.fn();
  const setup = (active: SectionId = "learning") => {
    const onSelect = vi.fn();
    parentKey.mockClear();
    render(
      <div onKeyDown={parentKey}>
        <LearningTabs tabs={tabs} active={active} readLabel="Sección leída" idPrefix="t" onSelect={onSelect} />
      </div>,
    );
    return onSelect;
  };

  it("expone tablist, tabs con aria-selected, aria-controls y foco itinerante", () => {
    setup("learning");
    expect(screen.getByRole("tablist")).toBeTruthy();
    const all = screen.getAllByRole("tab");
    expect(all).toHaveLength(3);
    expect(all.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(all.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(all[0].getAttribute("aria-controls")).toBe("t-panel-learning");
  });

  it("las flechas, Inicio y Fin cambian de pestaña y no se propagan (no mueven al personaje)", () => {
    const onSelect = setup("learning");
    const tablist = screen.getByRole("tablist");
    expect(fireEvent.keyDown(tablist, { key: "ArrowRight" })).toBe(false); // preventDefault
    expect(onSelect).toHaveBeenLastCalledWith("reflection");
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenLastCalledWith("lived"); // da la vuelta
    fireEvent.keyDown(tablist, { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith("lived");
    fireEvent.keyDown(tablist, { key: "Home" });
    expect(onSelect).toHaveBeenLastCalledWith("learning");
    expect(parentKey).not.toHaveBeenCalled();
  });

  it("el estado «leída» se anuncia con texto, no solo con un símbolo", () => {
    setup();
    const learning = screen.getByRole("tab", { name: /Resumen/ });
    expect(learning.textContent).toContain("✓");
    expect(learning.textContent).toContain("Sección leída");
    expect(screen.getByRole("tab", { name: "Lo vivido" }).textContent).not.toContain("✓");
  });
});

describe("LearningDialog", () => {
  const open = (config: BitacoraConfig, initial: ReadingState, store = makeStore(config), onClose?: () => void) => {
    wrap(config, store, <Harness config={config} store={store} initial={initial} onClose={onClose} />);
    return store;
  };
  const intro: ReadingState = { kind: "intro", learningId: "apr-a", event: "open" };

  it("modal accesible con título del aprendizaje, cierre visible y foco inicial en «Siguiente»", () => {
    open(base, intro);
    const dialog = screen.getByRole("dialog", { name: /Aprendizaje 1: Las plantas y las semillas/ });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Siguiente" }));
    expect(dialog.textContent).toContain("Lee cada sección y márcala como leída");
  });

  it("de la apertura pasa a la lectura con las tres pestañas y el foco en la activa", () => {
    open(base, intro);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Resumen", "Reflexión", "Lo vivido"]);
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Resumen" }));
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(screen.getByRole("tab", { name: "Resumen" }).id);
    expect(screen.getByRole("tabpanel").textContent).toContain("Por medio de una exploración");
  });

  it("muestra el estado de cada sección con texto y ofrece «Marcar sección como leída»", () => {
    open(base, { kind: "reading", learningId: "apr-a", active: "lived" });
    expect(screen.getByRole("status").textContent).toBe("Sin marcar");
    fireEvent.click(screen.getByRole("button", { name: "Marcar sección como leída" }));
    expect(screen.getByRole("status").textContent).toBe("✓ Sección leída");
    expect(screen.queryByRole("button", { name: "Marcar sección como leída" })).toBeNull();
    expect(screen.getByRole("tab", { name: /Lo vivido/ }).textContent).toContain("Sección leída");
  });

  it("al marcar, el foco no se pierde: pasa a la pestaña activa", () => {
    open(base, { kind: "reading", learningId: "apr-a", active: "lived" });
    fireEvent.click(screen.getByRole("button", { name: "Marcar sección como leída" }));
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: /Lo vivido/ }));
  });

  it("«Recoger insignia y continuar» está deshabilitada hasta marcar las tres y dice cuántas faltan", () => {
    open(base, { kind: "reading", learningId: "apr-a", active: "lived" });
    const claim = screen.getByRole("button", { name: "Recoger insignia y continuar" }) as HTMLButtonElement;
    expect(claim.disabled).toBe(true);
    expect(claim.getAttribute("aria-describedby")).toBe("reading-remaining");
    expect(screen.getByText("Faltan 3 por marcar")).toBeTruthy();
    for (const s of ALL) {
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(["Resumen", "Reflexión", "Lo vivido"][ALL.indexOf(s)]) }));
      fireEvent.click(screen.getByRole("button", { name: "Marcar sección como leída" }));
    }
    expect((screen.getByRole("button", { name: "Recoger insignia y continuar" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/Faltan/)).toBeNull();
  });

  it("recoger la insignia muestra la recompensa: título, insignia con texto alternativo, XP y nivel derivados", () => {
    const store = makeStore(base);
    ALL.forEach((s) => store.markSection("apr-a", s));
    open(base, { kind: "reading", learningId: "apr-a", active: "lived" }, store);
    fireEvent.click(screen.getByRole("button", { name: "Recoger insignia y continuar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("¡Aprendizaje recorrido!")).toBeTruthy();
    expect((within(dialog).getByRole("img", { name: "Curiosidad que florece" }) as HTMLImageElement).src).toContain("/ui/badges/badge-plantas-semillas.png");
    expect(dialog.textContent).toContain("100 / 600 XP · Nivel 1");
    expect(dialog.textContent).toContain("Obtuviste «Curiosidad que florece». Llevas 1 de 6.");
  });

  it("releer una completada muestra «Insignia obtenida», sin botón de recoger ni de marcar", () => {
    const store = makeStore(base);
    ALL.forEach((s) => store.markSection("apr-a", s));
    store.claimBadge("apr-a");
    open(base, { kind: "reading", learningId: "apr-a", active: "lived" }, store);
    expect(screen.getByText(/Insignia obtenida: Curiosidad que florece/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Recoger insignia y continuar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar sección como leída" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("✓ Sección leída");
  });

  it("un aprendizaje bloqueado o pendiente solo muestra su mensaje, sin pestañas ni contenido", () => {
    open(base, { kind: "message", learningId: "apr-b", event: "locked" });
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("dialog").textContent).toContain("Primero recorre «Las plantas y las semillas»");
    cleanup();
    const final = structuredClone(base);
    final.mode = "final";
    open(final, { kind: "message", learningId: "apr-a", event: "pending" });
    expect(screen.getByRole("dialog").textContent).toContain("Pendiente de revisión");
    expect(screen.queryByText(/Para mí fue una experiencia muy bonita/)).toBeNull();
  });

  it("en la fase de mensaje el foco entra en la ventana (en «Cerrar»): si no, Escape no la cerraría", () => {
    const onClose = vi.fn();
    open(base, { kind: "message", learningId: "apr-b", event: "locked" }, undefined, onClose);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Escape cierra y Tab no saca el foco de la ventana", () => {
    const onClose = vi.fn();
    open(base, { kind: "reading", learningId: "apr-a", active: "lived" }, undefined, onClose);
    const dialog = screen.getByRole("dialog");
    const outside = document.createElement("button");
    document.body.append(outside);
    for (let i = 0; i < 12; i++) {
      fireEvent.keyDown(document.activeElement ?? dialog, { key: "Tab" });
      const next = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      const cur = document.activeElement as HTMLElement;
      const idx = next.indexOf(cur);
      (next[(idx + 1) % next.length] ?? next[0]).focus(); // el navegador avanzaría; el trap solo intercepta los extremos
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    outside.remove();
  });

  it("Tab desde el último control vuelve al primero y Mayús+Tab desde el primero va al último", () => {
    open(base, { kind: "reading", learningId: "apr-a", active: "lived" });
    const dialog = screen.getByRole("dialog");
    const focusables = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(first);
    expect(fireEvent.keyDown(first, { key: "Tab", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(last);
  });

  it("los textos de la ventana salen de ui.labels: cambiar una etiqueta cambia la interfaz sin tocar el componente", () => {
    const edited = structuredClone(base);
    edited.ui.labels.markRead = "Ya lo leí";
    edited.ui.labels.close = "Salir";
    edited.ui.labels.sectionUnread = "Pendiente";
    open(edited, { kind: "reading", learningId: "apr-a", active: "lived" });
    expect(screen.getByRole("button", { name: "Ya lo leí" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salir" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Pendiente");
  });

  it("modo final: sin la etiqueta de demostración; modo demo: la muestra", () => {
    open(base, { kind: "reading", learningId: "apr-a", active: "lived" });
    expect(screen.getByText("Contenido de demostración")).toBeTruthy();
    cleanup();
    const final = structuredClone(base);
    final.mode = "final";
    final.learnings["apr-a"].editorialStatus = "ready";
    open(final, { kind: "reading", learningId: "apr-a", active: "lived" });
    expect(screen.queryByText("Contenido de demostración")).toBeNull();
  });
});

describe("ProgressHUD", () => {
  it("muestra el nombre, el nivel, la XP y el progreso derivados de route y badges, y ya no el siguiente objetivo", () => {
    const store = makeStore(base);
    ALL.forEach((s) => store.markSection("apr-a", s));
    store.claimBadge("apr-a");
    wrap(base, store, <ProgressHUD />);
    const text = screen.getByRole("region", { name: "Mi bitácora — Un recorrido de aprendizajes" }).textContent;
    expect(text).toContain("1 de 6 aprendizajes");
    expect(text).toContain("100 / 600 XP");
    expect(text).toContain("Nivel 1");
    expect(text).toContain("Vanessa");
    expect(text).not.toContain("Continúa en Aprendizaje");
    expect(document.querySelector(".hud__sign, .hud__objective")).toBeNull();
  });

  it("la barra recorta el relleno según la fracción y usa la metadata de posición del manifiesto", () => {
    const store = makeStore(base);
    ALL.forEach((s) => store.markSection("apr-a", s));
    store.claimBadge("apr-a");
    const { container } = wrap(base, store, <ProgressHUD />);
    const bar = container.querySelector(".xp-bar") as HTMLElement;
    expect(bar.getAttribute("aria-label")).toBe("100 / 600 XP");
    expect(parseFloat(bar.style.getPropertyValue("--fill-clip"))).toBeCloseTo((1 - 100 / 600) * 100, 3);
    expect(parseFloat(bar.style.getPropertyValue("--fill-left"))).toBeCloseTo((16 / 880) * 100, 3); // placement.x / ancho del marco
    expect(parseFloat(bar.style.getPropertyValue("--fill-top"))).toBeCloseTo((20 / 80) * 100, 3);
  });

  it("sin progreso la barra está vacía y con una ruta vacía el total es cero", () => {
    const { container } = wrap(base, makeStore(base), <ProgressHUD />);
    expect(parseFloat((container.querySelector(".xp-bar") as HTMLElement).style.getPropertyValue("--fill-clip"))).toBe(100);
    cleanup();
    const empty = structuredClone(base);
    empty.route = [];
    wrap(empty, makeStore(empty), <ProgressHUD />);
    expect(screen.getByRole("region", { name: "Mi bitácora — Un recorrido de aprendizajes" }).textContent).toContain("0 de 0 aprendizajes");
  });

  it("al terminar toda la ruta la barra queda llena y el progreso es completo", () => {
    const small = structuredClone(base);
    small.route = ["apr-a"];
    const store = makeStore(small);
    ALL.forEach((s) => store.markSection("apr-a", s));
    store.claimBadge("apr-a");
    const { container } = wrap(small, store, <ProgressHUD />);
    expect(screen.getByRole("region", { name: "Mi bitácora — Un recorrido de aprendizajes" }).textContent).toContain("1 de 1 aprendizajes");
    expect(parseFloat((container.querySelector(".xp-bar") as HTMLElement).style.getPropertyValue("--fill-clip"))).toBe(0);
  });

  it("avisa discretamente si el almacenamiento no está disponible y el avance puede perderse", () => {
    const blocked = new ProgressStore(base, new ProgressStorage(() => { throw new Error("SecurityError"); }));
    wrap(base, blocked, <ProgressHUD />);
    expect(screen.getByText(/no se está guardando/)).toBeTruthy();
  });

  it("se actualiza al instante cuando cambia el progreso", () => {
    const store = makeStore(base);
    wrap(base, store, <ProgressHUD />);
    expect(screen.getByRole("region", { name: "Mi bitácora — Un recorrido de aprendizajes" }).textContent).toContain("0 de 6");
    act(() => {
      ALL.forEach((s) => store.markSection("apr-a", s));
      store.claimBadge("apr-a");
    });
    expect(screen.getByRole("region", { name: "Mi bitácora — Un recorrido de aprendizajes" }).textContent).toContain("1 de 6");
  });
});

describe("dialogueLines (SPEC 12.7)", () => {
  it("sustituye solo las variables permitidas y usa overrides por aprendizaje", () => {
    const config = structuredClone(base);
    config.dialogues["propio"] = { lines: [{ speaker: "vanessa", text: "{studentName} aprendió «{learningTitle}» ({completedCount}/{totalCount}) {secreto}" }] };
    config.learnings["apr-a"].dialogueOverrides = { open: "propio" };
    const lines = dialogueLines(config, initialProgress(config), "apr-a", "open");
    expect(lines).toEqual([{ speaker: "vanessa", text: "Vanessa Estrada aprendió «Las plantas y las semillas» (0/6) {secreto}" }]);
    // Los demás aprendizajes siguen usando el diálogo común.
    expect(dialogueLines(config, initialProgress(config), "apr-b", "open")[0].text).toContain("Lee cada sección");
  });

  it("el mensaje de bloqueo nombra el aprendizaje pendiente más cercano", () => {
    expect(dialogueLines(base, initialProgress(base), "apr-c", "locked")[0].text).toContain("«Las plantas y las semillas»");
  });
});
