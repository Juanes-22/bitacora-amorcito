// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { ProgressStore } from "../app/progressStore";
import { ProgressProvider } from "../app/ProgressProvider";
import { useProgressController } from "../app/useProgressController";
import { BadgeCollection } from "../components/ui/BadgeCollection";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Cover } from "../components/ui/Cover";
import { ProgressHUD } from "../components/ui/ProgressHUD";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig, SectionId } from "../config/types";
import { GameBridge } from "../game/bridge/GameBridge";
import type { BridgeEvents } from "../game/bridge/events";
import { ProgressStorage, storageKey, type StorageLike } from "../storage/progressStorage";

afterEach(cleanup);
const assets = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost:5173/assets/assets.json");
const base = bitacoraJson as unknown as BitacoraConfig;
const ALL: SectionId[] = ["lived", "learning", "reflection", "classroom"];

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const makeStore = (config: BitacoraConfig, mem = new MemoryStorage()) => new ProgressStore(config, new ProgressStorage(() => mem));
const wrap = (config: BitacoraConfig, store: ProgressStore, ui: React.ReactNode) =>
  render(<BitacoraProvider config={config} assets={assets}><ProgressProvider store={store}>{ui}</ProgressProvider></BitacoraProvider>);
const withRoute = (ids: string[], edit?: (c: BitacoraConfig) => void) => {
  const c = structuredClone(base);
  c.route = ids;
  edit?.(c);
  return c;
};
const complete = (store: ProgressStore, id: string) => {
  ALL.forEach((s) => store.markSection(id, s));
  store.claimBadge(id);
};

describe("useProgressController: ventanas de insignias, cierre del recorrido y reinicio", () => {
  let bridge: GameBridge;
  let token: number;
  let host: HTMLDivElement;
  let hostRef: { current: HTMLDivElement };
  let mem: MemoryStorage;
  const log = { sync: [] as Array<BridgeEvents["app:sync"]>, controls: [] as Array<readonly string[]>, zone: [] as Array<BridgeEvents["app:zone-change"]>, celebrate: [] as Array<BridgeEvents["app:celebrate"]> };

  const setup = (config: BitacoraConfig) => {
    const store = makeStore(config, mem);
    return { store, config, ...renderHook(() => useProgressController(bridge, config, store, hostRef)) };
  };
  const open = (id: string, requestId = `r-${id}`) => act(() => bridge.emit("game:learning-open-request", { learningId: id, token, requestId }));
  /** Recorre una lectura completa mediante las acciones del controlador y cierra la recompensa. */
  const finishLearning = (r: ReturnType<typeof setup>, id: string) => {
    open(id);
    act(() => r.result.current.actions.continueReading());
    ALL.forEach((s) => act(() => r.result.current.actions.markRead(s)));
    act(() => r.result.current.actions.claimBadge());
    act(() => r.result.current.actions.close());
  };

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = new GameBridge();
    token = bridge.beginScene();
    host = document.createElement("div");
    host.tabIndex = 0;
    document.body.append(host);
    hostRef = { current: host };
    mem = new MemoryStorage();
    log.sync = []; log.controls = []; log.zone = []; log.celebrate = [];
    bridge.on("app:sync", (e) => log.sync.push(e));
    bridge.on("app:controls", (e) => log.controls.push(e.reasons));
    bridge.on("app:zone-change", (e) => log.zone.push(e));
    bridge.on("app:celebrate", (e) => log.celebrate.push(e));
  });
  afterEach(() => {
    host.remove();
    vi.useRealTimers();
  });

  it("la colección se abre desde la cabecera, bloquea el mapa y al cerrarla lo libera", () => {
    const r = setup(base);
    act(() => r.result.current.overlayActions.openCollection());
    expect(r.result.current.overlay).toEqual({ kind: "collection", completion: false });
    expect(log.controls.at(-1)).toEqual(["overlay"]);
    act(() => r.result.current.overlayActions.closeOverlay());
    expect(r.result.current.overlay).toBeNull();
    expect(log.controls.at(-1)).toEqual([]);
  });

  it("no se abre la colección encima de una lectura", () => {
    const r = setup(base);
    open("apr-a");
    act(() => r.result.current.overlayActions.openCollection());
    expect(r.result.current.overlay).toBeNull();
    expect(r.result.current.reading?.kind).toBe("intro");
  });

  it("una solicitud del juego mientras hay otra ventana se rechaza sin abrir nada", () => {
    const r = setup(base);
    act(() => r.result.current.overlayActions.openCollection());
    const resolved: Array<BridgeEvents["app:request-resolved"]> = [];
    bridge.on("app:request-resolved", (e) => resolved.push(e));
    open("apr-a", "x");
    expect(resolved).toEqual([{ requestId: "x", accepted: false, reason: "busy" }]);
    expect(r.result.current.reading).toBeNull();
  });

  it("la instantánea lista los aprendizajes sin aprobar solo en modo final", () => {
    setup(base);
    expect(log.sync.at(-1)?.pending).toEqual([]);
    cleanup();
    const final = structuredClone(base);
    final.mode = "final";
    final.learnings["apr-b"].editorialStatus = "ready";
    mem = new MemoryStorage();
    setup(final);
    expect(log.sync.at(-1)?.pending).toEqual(["apr-a", "apr-c", "apr-d", "apr-e", "apr-f"]);
  });

  it("al recoger la ÚLTIMA insignia: celebra y, cuando la celebración ya terminó, abre el cierre con la colección", () => {
    const r = setup(withRoute(["apr-a", "apr-b"]));
    finishLearning(r, "apr-a");
    expect(r.result.current.overlay).toBeNull(); // no es la última: sin cierre
    vi.advanceTimersByTime(5000);
    expect(r.result.current.overlay).toBeNull();
    finishLearning(r, "apr-b");
    expect(log.celebrate).toHaveLength(2);
    expect(r.result.current.overlay).toBeNull(); // aún no: no debe tapar la celebración
    act(() => void vi.advanceTimersByTime(3400));
    expect(r.result.current.overlay).toEqual({ kind: "collection", completion: true });
    expect(log.controls.at(-1)).toEqual(["overlay"]);
  });

  it("el cierre del recorrido no se abre si en ese momento ya hay otra ventana", () => {
    const r = setup(withRoute(["apr-a"]));
    finishLearning(r, "apr-a");
    act(() => r.result.current.overlayActions.openCollection()); // el visitante abre la colección antes de que acabe la espera
    act(() => void vi.advanceTimersByTime(4000));
    expect(r.result.current.overlay).toEqual({ kind: "collection", completion: false });
  });

  it("recargar con el recorrido ya completo no abre el cierre ni celebra otra vez", () => {
    const first = setup(withRoute(["apr-a"]));
    finishLearning(first, "apr-a");
    cleanup();
    log.celebrate = [];
    const again = setup(withRoute(["apr-a"]));
    act(() => bridge.emit("game:ready", { zoneId: "zona-a", token, position: { x: 200, y: 1030 } }));
    act(() => void vi.advanceTimersByTime(6000));
    expect(again.result.current.overlay).toBeNull();
    expect(log.celebrate).toEqual([]);
  });

  it("reiniciar pide confirmación; cancelar vuelve a la colección sin borrar nada", () => {
    const r = setup(base);
    complete(r.store, "apr-a");
    act(() => r.result.current.overlayActions.askReset());
    expect(r.result.current.overlay).toBeNull(); // solo se puede pedir desde la colección
    act(() => r.result.current.overlayActions.openCollection());
    act(() => r.result.current.overlayActions.askReset());
    expect(r.result.current.overlay).toEqual({ kind: "confirm-reset" });
    act(() => r.result.current.overlayActions.cancelReset());
    expect(r.result.current.overlay).toEqual({ kind: "collection", completion: false });
    expect(r.store.getState().entries["apr-a"].completedAt).toBeDefined();
  });

  it("confirmar el reinicio borra solo el avance de esta bitácora y modo, reinicia la escena y suelta los controles", () => {
    const r = setup(base);
    complete(r.store, "apr-a");
    mem.data.set(storageKey(base.contentSetId, "final"), '{"otro":"modo"}');
    mem.data.set("ajeno", "1");
    act(() => r.result.current.overlayActions.openCollection());
    act(() => r.result.current.overlayActions.askReset());
    act(() => r.result.current.overlayActions.confirmReset());
    expect(r.result.current.overlay).toBeNull();
    expect(Object.values(r.store.getState().entries).every((e) => e.completedAt === undefined && e.readSectionIds.length === 0)).toBe(true);
    expect(mem.data.get(storageKey(base.contentSetId, "final"))).toBe('{"otro":"modo"}');
    expect(mem.data.get("ajeno")).toBe("1");
    expect(log.zone.at(-1)).toEqual({ zoneId: base.gameplay.start.zoneId, spawnId: base.gameplay.start.spawnId });
    expect(log.sync.at(-1)?.stations).toMatchObject({ "apr-a": "available", "apr-b": "locked" });
    expect(log.controls.at(-1)).toEqual(["transition"]); // hasta que la escena nueva avise
    token = bridge.beginScene();
    act(() => bridge.emit("game:ready", { zoneId: "zona-a", token, position: { x: 200, y: 1030 } }));
    expect(log.controls.at(-1)).toEqual([]);
  });

  it("reiniciar con el cierre pendiente cancela su apertura", () => {
    const r = setup(withRoute(["apr-a"]));
    finishLearning(r, "apr-a");
    act(() => r.result.current.overlayActions.openCollection());
    act(() => r.result.current.overlayActions.askReset());
    act(() => r.result.current.overlayActions.confirmReset());
    act(() => void vi.advanceTimersByTime(6000));
    expect(r.result.current.overlay).toBeNull();
  });

  it("confirmar sin haber pedido el reinicio no hace nada", () => {
    const r = setup(base);
    complete(r.store, "apr-a");
    act(() => r.result.current.overlayActions.confirmReset());
    expect(r.store.getState().entries["apr-a"].completedAt).toBeDefined();
    expect(log.zone).toEqual([]);
  });
});

describe("BadgeCollection", () => {
  const show = (config: BitacoraConfig, store: ProgressStore, props: Partial<React.ComponentProps<typeof BadgeCollection>> = {}) => {
    const onClose = vi.fn();
    const onReset = vi.fn();
    wrap(config, store, <BadgeCollection completion={false} onClose={onClose} onReset={onReset} {...props} />);
    return { onClose, onReset };
  };

  it("sin progreso lista las insignias del recorrido como «Por obtener» y no muestra la reflexión final", () => {
    show(base, makeStore(base));
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items.every((li) => li.textContent?.includes("Por obtener"))).toBe(true);
    expect(screen.getByRole("dialog").textContent).toContain("0 de 6 insignias · 0 / 600 XP · Nivel 0");
    expect(screen.queryByText("Reflexión final")).toBeNull();
  });

  it("una insignia obtenida muestra su nombre, descripción y fecha; las demás, una silueta decorativa", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    show(base, store);
    const first = screen.getAllByRole("listitem")[0];
    expect(first.textContent).toContain("Semilla de descubrimiento");
    expect(first.textContent).toContain("Insignia obtenida · Obtenida el");
    expect(first.textContent).toMatch(/20\d\d/);
    expect(within(first).getByRole("img", { name: "Semilla de descubrimiento" })).toBeTruthy();
    const second = screen.getAllByRole("listitem")[1];
    expect(second.textContent).toContain("Aprendizaje 2: Tema por definir");
    expect(within(second).queryByRole("img")).toBeNull(); // alt vacío: decorativa, el texto ya lo dice
    expect(screen.getByRole("dialog").textContent).toContain("1 de 6 insignias · 100 / 600 XP · Nivel 1");
  });

  it("solo aparecen las insignias de la ruta ACTIVA: los archivados no cuentan ni se muestran", () => {
    const config = withRoute(["apr-a", "apr-c"]);
    const store = makeStore(config);
    show(config, store);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("dialog").textContent).toContain("0 de 2 insignias · 0 / 200 XP");
    expect(screen.getByRole("dialog").textContent).not.toContain("Aprendizaje 6");
  });

  it("al terminar el recorrido muestra el espacio de la reflexión final: un aviso mientras la autora no la aporte", () => {
    const config = withRoute(["apr-a"]);
    const store = makeStore(config);
    complete(store, "apr-a");
    show(config, store, { completion: true });
    const dialog = screen.getByRole("dialog", { name: "¡Recorrido completo!" });
    expect(within(dialog).getByRole("heading", { name: "Reflexión final" })).toBeTruthy();
    expect(dialog.textContent).toContain("La reflexión final de Vanessa se añadirá aquí cuando la escriba.");
  });

  it("la reflexión final es editable en el JSON: sus bloques se muestran y reemplazan al aviso", () => {
    const config = withRoute(["apr-a"], (c) => {
      c.project.finalReflection = [{ type: "heading", text: "Cierre" }, { type: "paragraph", text: "Texto aportado por la autora." }];
    });
    const store = makeStore(config);
    complete(store, "apr-a");
    show(config, store, { completion: true });
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Texto aportado por la autora.");
    expect(dialog.textContent).not.toContain("se añadirá aquí");
  });

  it("no inventa una conclusión: con el recorrido incompleto no hay reflexión final", () => {
    const store = makeStore(base);
    complete(store, "apr-a");
    show(base, store);
    expect(screen.queryByText("Reflexión final")).toBeNull();
  });

  it("tiene foco inicial en «Cerrar», Escape cierra y ofrece el reinicio", () => {
    const { onClose, onReset } = show(base, makeStore(base));
    expect(document.activeElement).toBe(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Cerrar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar recorrido" }));
    expect(onReset).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("ConfirmDialog (reinicio)", () => {
  it("es un alertdialog que explica qué se borra y pone el foco en «Cancelar»", () => {
    wrap(base, makeStore(base), <ConfirmDialog onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole("alertdialog", { name: "¿Reiniciar el recorrido?" });
    expect(dialog.textContent).toContain("Se borrará el avance guardado en este navegador");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancelar" }));
  });

  it("Escape cancela, confirmar confirma y solo confirmar es destructivo", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    wrap(base, makeStore(base), <ConfirmDialog onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, reiniciar" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("Enter mantenido no confirma el reinicio por accidente", () => {
    const onConfirm = vi.fn();
    wrap(base, makeStore(base), <ConfirmDialog onConfirm={onConfirm} onCancel={() => {}} />);
    const confirm = screen.getByRole("button", { name: "Sí, reiniciar" });
    expect(fireEvent.keyDown(confirm, { key: "Enter", repeat: true })).toBe(false);
  });
});

describe("cabecera y portada en modo final", () => {
  const finalConfig = () => {
    const c = structuredClone(base);
    c.mode = "final";
    return c;
  };

  it("la cabecera presenta el recorrido «en preparación» mientras haya contenido sin aprobar", () => {
    const c = finalConfig();
    wrap(c, makeStore(c), <ProgressHUD />);
    const hud = screen.getByRole("region", { name: c.project.title });
    expect(hud.textContent).toContain("Recorrido en preparación: faltan 6 por aprobar");
  });

  it("con todo aprobado desaparece el aviso y la cabecera no dice qué sigue (lo dice el letrero de la estación)", () => {
    const c = finalConfig();
    for (const id of c.route) c.learnings[id].editorialStatus = "ready";
    wrap(c, makeStore(c), <ProgressHUD />);
    const text = screen.getByRole("region", { name: c.project.title }).textContent;
    expect(text).not.toContain("en preparación");
    expect(text).not.toContain("Continúa en Aprendizaje");
    expect(document.querySelector(".hud__objective")).toBeNull();
  });

  it("el botón «Insignias» solo existe si hay una acción y la dispara", () => {
    const onOpenBadges = vi.fn();
    const { rerender } = wrap(base, makeStore(base), <ProgressHUD onOpenBadges={onOpenBadges} />);
    fireEvent.click(screen.getByRole("button", { name: "Insignias" }));
    expect(onOpenBadges).toHaveBeenCalledOnce();
    rerender(<BitacoraProvider config={base} assets={assets}><ProgressProvider store={makeStore(base)}><ProgressHUD /></ProgressProvider></BitacoraProvider>);
    expect(screen.queryByRole("button", { name: "Insignias" })).toBeNull();
  });

  it("la portada identifica el contenido en preparación (final) o de demostración (demo), sin mezclarlos", () => {
    const c = finalConfig();
    const { unmount } = wrap(c, makeStore(c), <Cover hasProgress={false} onStart={() => {}} />);
    expect(screen.getByText("Recorrido en preparación: faltan 6 por aprobar")).toBeTruthy();
    expect(screen.queryByText("Contenido de demostración")).toBeNull();
    unmount();
    wrap(base, makeStore(base), <Cover hasProgress={false} onStart={() => {}} />);
    expect(screen.getByText("Contenido de demostración")).toBeTruthy();
    expect(screen.queryByText(/en preparación/)).toBeNull();
  });
});
