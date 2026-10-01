import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressStore } from "../app/progressStore";
import { summarize } from "../domain/progression";
import { ProgressStorage, storageKey, type StorageLike } from "../storage/progressStorage";
import type { SectionId } from "../config/types";
import { makeConfig } from "./fixtures/makeConfig";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  writes = 0;
  fail = false;
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.fail) throw new Error("cuota"); this.writes++; this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const ALL: SectionId[] = ["lived", "learning", "reflection", "classroom"];
const KEY = storageKey("bitacora-prueba", "demo");

describe("ProgressStore", () => {
  let mem: MemoryStorage;
  const config = makeConfig();
  const make = () => new ProgressStore(config, new ProgressStorage(() => mem), () => new Date("2026-10-01T12:00:00.000Z"));
  beforeEach(() => { mem = new MemoryStorage(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it("al crearse reconcilia el guardado y no escribe nada (cargar no es una acción)", () => {
    const store = make();
    expect(store.getState().entries["apr-a"]).toEqual({ contentRevision: 1, readSectionIds: [] });
    expect(mem.writes).toBe(0);
  });

  it("marcar una sección guarda; repetirla no vuelve a escribir ni a notificar", () => {
    const store = make();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.markSection("apr-a", "lived")).toMatchObject({ ok: true, changed: true });
    expect(mem.writes).toBe(1);
    const calls = listener.mock.calls.length;
    expect(store.markSection("apr-a", "lived")).toMatchObject({ ok: true, changed: false });
    expect(mem.writes).toBe(1);
    expect(listener.mock.calls.length).toBe(calls);
  });

  it("getState conserva la referencia mientras nada cambia (useSyncExternalStore)", () => {
    const store = make();
    const a = store.getState();
    store.markSection("apr-a", "lived");
    const b = store.getState();
    expect(b).not.toBe(a);
    store.markSection("apr-a", "lived");
    expect(store.getState()).toBe(b);
  });

  it("recoger la insignia: solo la primera vez es un cambio; doble clic no la duplica", () => {
    const store = make();
    ALL.forEach((s) => store.markSection("apr-a", s));
    const first = store.claimBadge("apr-a");
    const second = store.claimBadge("apr-a");
    const third = store.claimBadge("apr-a");
    expect([first, second, third].map((r) => r.ok && r.changed)).toEqual([true, false, false]);
    expect(summarize(config, store.getState())).toMatchObject({ completedCount: 1, xp: 100 });
  });

  it("recargar recupera el avance sin repetir efectos: la nueva carga ve la insignia como histórica", () => {
    const store = make();
    ALL.forEach((s) => store.markSection("apr-a", s));
    store.claimBadge("apr-a");
    const reloaded = make();
    expect(summarize(config, reloaded.getState())).toMatchObject({ completedCount: 1, nextLearningId: "apr-b" });
    const again = reloaded.claimBadge("apr-a");
    expect(again).toMatchObject({ ok: true, changed: false }); // volver a pedirla no celebra de nuevo
  });

  it("los datos guardados nunca incluyen totales ni XP", () => {
    const store = make();
    ALL.forEach((s) => store.markSection("apr-a", s));
    store.claimBadge("apr-a");
    const saved = JSON.parse(mem.data.get(KEY)!);
    expect(JSON.stringify(saved)).not.toMatch(/xp|total|level|nextLearning/i);
  });

  it("una denegación no guarda: bloqueado, incompleto o ajeno a la ruta", () => {
    const store = make();
    expect(store.markSection("apr-b", "lived")).toEqual({ ok: false, reason: "locked" });
    expect(store.claimBadge("apr-a")).toEqual({ ok: false, reason: "incomplete" });
    expect(store.markSection("zzz", "lived")).toEqual({ ok: false, reason: "unknown-learning" });
    expect(mem.writes).toBe(0);
  });

  it("la pestaña activa se recuerda y se recupera tras recargar", () => {
    const store = make();
    store.setActiveSection("apr-a", "reflection");
    expect(make().getState().entries["apr-a"].lastSectionId).toBe("reflection");
  });

  it("los checkpoints se espacian: ráfagas de detenciones no escriben cada vez, y flush escribe lo pendiente", () => {
    const store = make();
    store.setLocation("zona-a", { x: 300, y: 600 }, true); // cambio de zona: inmediato
    expect(mem.writes).toBe(1);
    store.setLocation("zona-a", { x: 310, y: 600 });
    store.setLocation("zona-a", { x: 320, y: 600 });
    store.setLocation("zona-a", { x: 330, y: 600 });
    expect(mem.writes).toBe(1);
    expect(store.getState().player).toEqual({ x: 330, y: 600 });
    vi.advanceTimersByTime(1600);
    expect(mem.writes).toBe(2);
    expect(JSON.parse(mem.data.get(KEY)!).player).toEqual({ x: 330, y: 600 });
    store.setLocation("zona-a", { x: 340, y: 600 });
    store.flush();
    expect(JSON.parse(mem.data.get(KEY)!).player).toEqual({ x: 340, y: 600 });
  });

  it("una posición repetida no produce cambios", () => {
    const store = make();
    store.setLocation("zona-a", { x: 300, y: 600 }, true);
    const writes = mem.writes;
    store.setLocation("zona-a", { x: 300, y: 600 }, true);
    expect(mem.writes).toBe(writes);
  });

  it("si el almacenamiento falla, el avance sigue en memoria y se avisa; al volver, se guarda", () => {
    const store = make();
    expect(store.isPersisting()).toBe(true);
    mem.fail = true;
    store.markSection("apr-a", "lived");
    expect(store.isPersisting()).toBe(false);
    expect(store.getState().entries["apr-a"].readSectionIds).toEqual(["lived"]);
    mem.fail = false;
    store.markSection("apr-a", "learning");
    expect(store.isPersisting()).toBe(true);
    expect(JSON.parse(mem.data.get(KEY)!).entries["apr-a"].readSectionIds).toEqual(["lived", "learning"]);
  });

  it("sin localStorage (bloqueado) arranca igualmente y avisa de que no persistirá", () => {
    const store = new ProgressStore(config, new ProgressStorage(() => { throw new Error("SecurityError"); }));
    expect(store.isPersisting()).toBe(false);
    expect(store.markSection("apr-a", "lived")).toMatchObject({ ok: true, changed: true });
  });

  it("reiniciar borra solo su clave y vuelve al inicio, sin tocar el otro modo", () => {
    const store = make();
    store.markSection("apr-a", "lived");
    mem.data.set(storageKey("bitacora-prueba", "final"), '{"otro":"modo"}');
    mem.data.set("ajeno", "1");
    store.reset();
    expect(mem.data.has(KEY)).toBe(false);
    expect(mem.data.get(storageKey("bitacora-prueba", "final"))).toBe('{"otro":"modo"}');
    expect(mem.data.get("ajeno")).toBe("1");
    expect(store.getState().entries["apr-a"].readSectionIds).toEqual([]);
  });

  it("un guardado de demo no contamina el modo final", () => {
    const demo = make();
    ALL.forEach((s) => demo.markSection("apr-a", s));
    demo.claimBadge("apr-a");
    const finalConfig = { ...config, mode: "final" as const };
    const finalStore = new ProgressStore(finalConfig, new ProgressStorage(() => mem));
    expect(summarize(finalConfig, finalStore.getState()).completedCount).toBe(0);
  });

  it("darse de baja detiene las notificaciones", () => {
    const store = make();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.markSection("apr-a", "lived");
    off();
    store.markSection("apr-a", "learning");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
