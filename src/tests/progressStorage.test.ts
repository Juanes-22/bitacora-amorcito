import { describe, expect, it } from "vitest";
import { initialProgress } from "../domain/reconcileProgress";
import type { SavedProgress } from "../domain/types";
import { ProgressStorage, parseSavedProgress, storageKey, type StorageLike } from "../storage/progressStorage";
import { makeConfig } from "./fixtures/makeConfig";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  writes = 0;
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.writes++; this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const sample = (): SavedProgress => {
  const s = initialProgress(makeConfig());
  s.entries["apr-a"] = { contentRevision: 1, readSectionIds: ["lived", "learning"], lastSectionId: "learning", completedAt: "2026-10-01T12:00:00.000Z" };
  s.checkpoints = { "zona-a": { x: 330, y: 990 } };
  return s;
};

describe("storageKey (SPEC 13.1)", () => {
  it("incluye contenido, modo y versión del guardado, pero no la configRevision", () => {
    expect(storageKey("bitacora-x", "demo")).toBe("bitacora:progress:v3:bitacora-x:demo");
    expect(storageKey("bitacora-x", "final")).not.toBe(storageKey("bitacora-x", "demo"));
    expect(storageKey("bitacora-x", "demo")).not.toContain("revision");
  });
});

describe("parseSavedProgress", () => {
  it("acepta un guardado válido y lo devuelve idéntico", () => {
    expect(parseSavedProgress(JSON.parse(JSON.stringify(sample())))).toEqual(sample());
  });

  it.each([
    ["null", null],
    ["un número", 7],
    ["un arreglo", []],
    ["versión anterior", { ...sample(), schemaVersion: 2 }],
    ["sin contentSetId", { ...sample(), contentSetId: "" }],
    ["modo desconocido", { ...sample(), mode: "beta" }],
    ["posición no finita", { ...sample(), player: { x: Infinity, y: 0 } }],
    ["posición con texto", { ...sample(), player: { x: "1", y: 2 } }],
    ["entries no objeto", { ...sample(), entries: [] }],
    ["sin zona actual", { ...sample(), currentZoneId: 4 }],
  ])("rechaza %s", (_name, raw) => {
    expect(parseSavedProgress(raw)).toBeNull();
  });

  it("depura entradas y checkpoints inválidos sin descartar todo el guardado", () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.entries["malo-1"] = { contentRevision: 0, readSectionIds: [] };
    raw.entries["malo-2"] = { contentRevision: 1, readSectionIds: "lived" };
    raw.entries["malo-3"] = "texto";
    raw.entries["apr-b"] = { contentRevision: 1, readSectionIds: ["lived", "lived", "inventada"], lastSectionId: "inventada", completedAt: "ayer" };
    raw.checkpoints["zona-b"] = { x: "a" };
    const parsed = parseSavedProgress(raw)!;
    expect(Object.keys(parsed.entries).sort()).toEqual(["apr-a", "apr-b", "apr-c", "apr-d", "apr-e", "apr-f"]);
    expect(Object.keys(parsed.entries).some((k) => k.startsWith("malo"))).toBe(false);
    expect(parsed.entries["apr-b"]).toEqual({ contentRevision: 1, readSectionIds: ["lived"] });
    expect(parsed.checkpoints).toEqual({ "zona-a": { x: 330, y: 990 } });
  });

  it("descarta campos desconocidos (p. ej. contadores de XP que alguien añadiera)", () => {
    const raw = { ...JSON.parse(JSON.stringify(sample())), xp: 9999, nextLearningId: "apr-f" };
    expect(Object.keys(parseSavedProgress(raw)!).sort()).toEqual(["checkpoints", "contentSetId", "currentZoneId", "entries", "mode", "player", "schemaVersion"]);
  });
});

describe("ProgressStorage", () => {
  it("guarda y recupera el avance", () => {
    const mem = new MemoryStorage();
    const storage = new ProgressStorage(() => mem);
    expect(storage.save(sample())).toBe(true);
    expect(storage.load("bitacora-prueba", "demo")).toEqual({ saved: sample(), available: true });
  });

  it("sin guardado devuelve null pero disponible", () => {
    expect(new ProgressStorage(() => new MemoryStorage()).load("x", "demo")).toEqual({ saved: null, available: true });
  });

  it("JSON corrupto o inválido no rompe nada y no se borra", () => {
    const mem = new MemoryStorage();
    mem.data.set(storageKey("bitacora-prueba", "demo"), "{ esto no es json");
    const r = new ProgressStorage(() => mem).load("bitacora-prueba", "demo");
    expect(r).toEqual({ saved: null, available: true });
    expect(mem.data.get(storageKey("bitacora-prueba", "demo"))).toBe("{ esto no es json");
  });

  it("si el simple acceso a localStorage lanza (cookies bloqueadas), continúa sin almacenamiento", () => {
    const storage = new ProgressStorage(() => { throw new Error("SecurityError"); });
    expect(storage.load("x", "demo")).toEqual({ saved: null, available: false });
    expect(storage.save(sample())).toBe(false);
    expect(storage.clear("x", "demo")).toBe(false);
  });

  it("sin almacenamiento (null) o con cuota agotada, save devuelve false sin lanzar", () => {
    expect(new ProgressStorage(() => null).save(sample())).toBe(false);
    const full: StorageLike = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); }, removeItem: () => {} };
    expect(new ProgressStorage(() => full).save(sample())).toBe(false);
  });

  it("clear borra solo la clave de esta bitácora y modo, nunca datos ajenos ni el otro modo", () => {
    const mem = new MemoryStorage();
    const storage = new ProgressStorage(() => mem);
    storage.save(sample());
    storage.save({ ...sample(), mode: "final" });
    mem.data.set("otra-app:tema", "oscuro");
    storage.clear("bitacora-prueba", "demo");
    expect([...mem.data.keys()].sort()).toEqual(["bitacora:progress:v3:bitacora-prueba:final", "otra-app:tema"]);
  });
});
