import { describe, expect, it } from "vitest";
import { completedIds, summarize } from "../domain/progression";
import { initialProgress, reconcileProgress } from "../domain/reconcileProgress";
import type { SavedProgress } from "../domain/types";
import type { BitacoraConfig } from "../config/types";
import { makeConfig } from "./fixtures/makeConfig";

const T = "2026-10-01T12:00:00.000Z";
const done = (rev = 1) => ({ contentRevision: rev, readSectionIds: ["learning", "reflection", "lived"] as SavedProgress["entries"][string]["readSectionIds"], completedAt: T });
const withProgress = (config: BitacoraConfig, entries: SavedProgress["entries"], patch: Partial<SavedProgress> = {}): SavedProgress => ({
  ...initialProgress(config), entries: { ...initialProgress(config).entries, ...entries }, ...patch,
});
const ids = (c: BitacoraConfig) => [...completedIds(c, reconcileProgress(c, withProgress(c, {}, {})).entries)];

describe("initialProgress / sin guardado", () => {
  it("empieza vacío en el punto de partida configurado, con una entrada por aprendizaje activo", () => {
    const c = makeConfig();
    const p = initialProgress(c);
    expect(p).toMatchObject({ schemaVersion: 3, contentSetId: c.contentSetId, mode: "demo", currentZoneId: "zona-a", checkpoints: {} });
    expect(p.player).toEqual(c.maps["zona-a"].spawns.inicio);
    expect(Object.keys(p.entries)).toEqual(c.route);
    expect(reconcileProgress(c, null)).toEqual(p);
  });

  it("no guarda totales, XP, siguiente aprendizaje ni lista de insignias (SPEC 13.1)", () => {
    const keys = Object.keys(initialProgress(makeConfig()));
    expect(keys.sort()).toEqual(["checkpoints", "contentSetId", "currentZoneId", "entries", "mode", "player", "schemaVersion"]);
  });
});

describe("reconcileProgress: tabla de la SPEC 13.2", () => {
  it("mover una estación, reordenar route o cambiar configRevision no reinicia nada", () => {
    const c = makeConfig();
    const saved = withProgress(c, { "apr-a": done(), "apr-b": done() });
    const moved = structuredClone(c);
    moved.placements["apr-a"].position = { x: 111, y: 222 };
    moved.route = ["apr-b", "apr-a", "apr-c", "apr-d", "apr-e", "apr-f"];
    moved.configRevision = "otra";
    expect([...completedIds(moved, reconcileProgress(moved, saved).entries)].sort()).toEqual(["apr-a", "apr-b"]);
  });

  it("añadir una estación crea avance vacío solo para el nuevo ID", () => {
    const c = makeConfig(5);
    const saved = withProgress(c, { "apr-a": done() });
    const bigger = makeConfig(6);
    const r = reconcileProgress(bigger, saved);
    expect(r.entries["apr-f"]).toEqual({ contentRevision: 1, readSectionIds: [] });
    expect(r.entries["apr-a"].completedAt).toBe(T);
  });

  it("insertar una estación antes de las completadas conserva lo completado y bloquea los pendientes posteriores", () => {
    const c = makeConfig(3);
    const saved = withProgress(c, { "apr-a": done(), "apr-b": done() });
    const inserted = structuredClone(c);
    inserted.learnings["apr-n"] = structuredClone(inserted.learnings["apr-a"]);
    inserted.badges["insignia-apr-n"] = structuredClone(inserted.badges["insignia-apr-a"]);
    inserted.learnings["apr-n"].badgeId = "insignia-apr-n";
    inserted.placements["apr-n"] = structuredClone(inserted.placements["apr-a"]);
    inserted.route = ["apr-n", "apr-a", "apr-b", "apr-c"];
    const r = reconcileProgress(inserted, saved);
    const s = summarize(inserted, r);
    expect(s.completedCount).toBe(2); // apr-a y apr-b siguen completadas
    expect(s.nextLearningId).toBe("apr-n"); // el nuevo es el siguiente y bloquea a apr-c
  });

  it("retirar un ID de route lo excluye de totales y requisitos pero conserva su entrada; reactivar lo recupera", () => {
    const c = makeConfig();
    const saved = withProgress(c, { "apr-a": done(), "apr-b": done() });
    const retired = structuredClone(c);
    retired.route = retired.route.filter((id) => id !== "apr-b");
    const r = reconcileProgress(retired, saved);
    expect(summarize(retired, r)).toMatchObject({ completedCount: 1, totalCount: 5, maxXp: 500, xp: 100 });
    expect(r.entries["apr-b"].completedAt).toBe(T); // archivada, conservada
    const back = reconcileProgress(c, r); // reactivar el mismo ID y revisión
    expect(summarize(c, back).completedCount).toBe(2);
  });

  it("un ID que ya no existe en learnings se descarta", () => {
    const c = makeConfig(3);
    const saved = withProgress(c, {});
    saved.entries["fantasma"] = done();
    expect(reconcileProgress(c, saved).entries["fantasma"]).toBeUndefined();
  });

  it("un cambio sustancial de contentRevision invalida solo ese aprendizaje", () => {
    const c = makeConfig();
    const saved = withProgress(c, { "apr-a": done(), "apr-b": done() });
    const revised = structuredClone(c);
    revised.learnings["apr-a"].contentRevision = 2;
    const r = reconcileProgress(revised, saved);
    expect(r.entries["apr-a"]).toEqual({ contentRevision: 2, readSectionIds: [] });
    expect(r.entries["apr-b"].completedAt).toBe(T);
    // apr-a vuelve a estar pendiente y bloquea a lo posterior, pero apr-b conserva su insignia
    expect(summarize(revised, r)).toMatchObject({ completedCount: 1, nextLearningId: "apr-a" });
  });

  it("cambiar una insignia (nombre, imagen o XP) recalcula totales sin tocar el avance", () => {
    const c = makeConfig();
    const saved = withProgress(c, { "apr-a": done() });
    const changed = structuredClone(c);
    changed.badges["insignia-apr-a"].xp = 250;
    changed.badges["insignia-apr-a"].title = "Otro nombre";
    changed.badges["insignia-apr-a"].assetId = "station.item.books";
    const r = reconcileProgress(changed, saved);
    expect(r.entries["apr-a"]).toEqual(saved.entries["apr-a"]);
    expect(summarize(changed, r)).toMatchObject({ xp: 250, maxXp: 250 + 500 });
  });

  it("demo y final no se mezclan, ni siquiera con el mismo contentSetId", () => {
    const demo = makeConfig();
    const saved = withProgress(demo, { "apr-a": done(), "apr-b": done() });
    const final = structuredClone(demo);
    final.mode = "final";
    expect(summarize(final, reconcileProgress(final, saved)).completedCount).toBe(0);
    const other = structuredClone(demo);
    other.contentSetId = "otra-bitacora";
    expect(summarize(other, reconcileProgress(other, saved)).completedCount).toBe(0);
  });

  it("una posición que ya no es transitable se reubica sin borrar las lecturas", () => {
    const c = makeConfig();
    const saved = withProgress(c, { "apr-a": done() }, { currentZoneId: "zona-a", player: { x: 540, y: 140 } });
    const blocked = reconcileProgress(c, saved); // (540,140) cae dentro del obstáculo del fixture
    expect(blocked.player).toEqual(c.maps["zona-a"].spawns.inicio);
    expect(blocked.entries["apr-a"].completedAt).toBe(T);
  });

  it("una zona eliminada o renombrada devuelve a la zona de partida, y los checkpoints inválidos se descartan", () => {
    const c = makeConfig();
    const saved = withProgress(c, {}, { currentZoneId: "zona-borrada", player: { x: 300, y: 300 }, checkpoints: { "zona-borrada": { x: 1, y: 1 }, "zona-b": { x: 400, y: 400 }, "zona-a": { x: -9, y: 5 } } });
    const r = reconcileProgress(c, saved);
    expect(r.currentZoneId).toBe("zona-a");
    expect(r.player).toEqual(c.maps["zona-a"].spawns.inicio);
    expect(r.checkpoints).toEqual({ "zona-b": { x: 400, y: 400 } });
  });

  it("una posición válida se conserva tal cual", () => {
    const c = makeConfig();
    const r = reconcileProgress(c, withProgress(c, {}, { currentZoneId: "zona-b", player: { x: 500, y: 500 } }));
    expect(r).toMatchObject({ currentZoneId: "zona-b", player: { x: 500, y: 500 } });
  });
});

describe("reconcileProgress: saneamiento", () => {
  it("depura secciones inválidas o repetidas y fechas no válidas", () => {
    const c = makeConfig(3);
    const saved = withProgress(c, {});
    saved.entries["apr-a"] = { contentRevision: 1, readSectionIds: ["lived", "lived", "inventada", "reflection"] as never, completedAt: "ayer" };
    const e = reconcileProgress(c, saved).entries["apr-a"];
    expect(e.readSectionIds).toEqual(["reflection", "lived"]);
    expect(e.completedAt).toBeUndefined();
  });

  it("una insignia recogida implica las secciones requeridas leídas", () => {
    const c = makeConfig(3);
    const saved = withProgress(c, {});
    saved.entries["apr-a"] = { contentRevision: 1, readSectionIds: ["lived"], completedAt: T };
    expect(reconcileProgress(c, saved).entries["apr-a"].readSectionIds).toEqual(["learning", "reflection", "lived"]);
  });

  it("es idempotente y no modifica su entrada", () => {
    const c = makeConfig();
    const saved = withProgress(c, { "apr-a": done() });
    const snapshot = JSON.stringify(saved);
    const once = reconcileProgress(c, saved);
    expect(JSON.stringify(saved)).toBe(snapshot);
    expect(reconcileProgress(c, once)).toEqual(once);
    expect(ids(c)).toEqual([]);
  });
});
