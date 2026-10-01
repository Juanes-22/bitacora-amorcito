import { describe, expect, it } from "vitest";
import { allRequiredRead, claimBadge, completedIds, isAdmissible, markSectionRead, requiredSectionIds, setActiveSection, stationStatesOf, summarize } from "../domain/progression";
import { initialProgress } from "../domain/reconcileProgress";
import type { SavedProgress } from "../domain/types";
import type { BitacoraConfig, SectionId } from "../config/types";
import { makeConfig } from "./fixtures/makeConfig";

const NOW = new Date("2026-10-01T12:00:00.000Z");
const ALL: SectionId[] = ["lived", "learning", "reflection", "classroom"];

/** Aplica transiciones exigiendo que sean válidas. */
function mark(config: BitacoraConfig, state: SavedProgress, id: string, sections: SectionId[]): SavedProgress {
  return sections.reduce((s, section) => {
    const r = markSectionRead(s, config, id, section);
    if (!r.ok) throw new Error(`denegado: ${r.reason}`);
    return r.state;
  }, state);
}
function complete(config: BitacoraConfig, state: SavedProgress, id: string): SavedProgress {
  const r = claimBadge(mark(config, state, id, ALL), config, id, NOW);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

describe("markSectionRead (AC-05)", () => {
  it("marca una sección y recuerda cuál fue la última", () => {
    const c = makeConfig();
    const r = markSectionRead(initialProgress(c), c, "apr-a", "reflection");
    expect(r).toMatchObject({ ok: true, changed: true });
    if (r.ok) expect(r.state.entries["apr-a"]).toMatchObject({ readSectionIds: ["reflection"], lastSectionId: "reflection" });
  });

  it("es idempotente: marcar dos veces la misma sección no cambia nada ni duplica", () => {
    const c = makeConfig();
    const once = mark(c, initialProgress(c), "apr-a", ["lived"]);
    const twice = markSectionRead(once, c, "apr-a", "lived");
    expect(twice).toEqual({ ok: true, state: once, changed: false });
    expect(once.entries["apr-a"].readSectionIds).toEqual(["lived"]);
  });

  it("no modifica el estado de entrada (transición pura)", () => {
    const c = makeConfig();
    const s0 = initialProgress(c);
    const snapshot = JSON.stringify(s0);
    markSectionRead(s0, c, "apr-a", "lived");
    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it("un aprendizaje bloqueado no se puede marcar (intento de marcar un pendiente bloqueado)", () => {
    const c = makeConfig();
    expect(markSectionRead(initialProgress(c), c, "apr-b", "lived")).toEqual({ ok: false, reason: "locked" });
  });

  it("rechaza IDs ajenos a la ruta (archivados incluidos) y secciones desconocidas", () => {
    const c = makeConfig();
    c.learnings["apr-archivado"] = structuredClone(c.learnings["apr-a"]);
    expect(markSectionRead(initialProgress(c), c, "apr-archivado", "lived")).toEqual({ ok: false, reason: "unknown-learning" });
    expect(markSectionRead(initialProgress(c), c, "no-existe", "lived")).toEqual({ ok: false, reason: "unknown-learning" });
    expect(markSectionRead(initialProgress(c), c, "apr-a", "inventada" as SectionId)).toEqual({ ok: false, reason: "unknown-section" });
  });

  it("en una completada no cambia nada: la relectura es posible sin tocar el avance", () => {
    const c = makeConfig();
    const s = complete(c, initialProgress(c), "apr-a");
    expect(markSectionRead(s, c, "apr-a", "lived")).toEqual({ ok: true, state: s, changed: false });
  });
});

describe("claimBadge (AC-06, AC-07)", () => {
  it("exige las cuatro secciones: con tres marcadas no se concede", () => {
    const c = makeConfig();
    const s = mark(c, initialProgress(c), "apr-a", ["lived", "learning", "reflection"]);
    expect(allRequiredRead(s, c, "apr-a")).toBe(false);
    expect(claimBadge(s, c, "apr-a", NOW)).toEqual({ ok: false, reason: "incomplete" });
  });

  it("con las cuatro marcadas una única transición completa, registra la fecha y habilita la siguiente", () => {
    const c = makeConfig();
    const s = mark(c, initialProgress(c), "apr-a", ALL);
    const r = claimBadge(s, c, "apr-a", NOW);
    expect(r).toMatchObject({ ok: true, changed: true });
    if (!r.ok) return;
    expect(r.state.entries["apr-a"].completedAt).toBe("2026-10-01T12:00:00.000Z");
    expect(stationStatesOf(c, r.state)).toMatchObject({ "apr-a": "completed", "apr-b": "available", "apr-c": "locked" });
  });

  it("es idempotente: doble clic, tecla mantenida o releer no vuelven a conceder ni cambian la fecha", () => {
    const c = makeConfig();
    const first = claimBadge(mark(c, initialProgress(c), "apr-a", ALL), c, "apr-a", NOW);
    if (!first.ok) throw new Error();
    const later = claimBadge(first.state, c, "apr-a", new Date("2027-01-01T00:00:00Z"));
    expect(later).toEqual({ ok: true, state: first.state, changed: false });
    expect(summarize(c, first.state).xp).toBe(100);
    let state = first.state;
    for (let i = 0; i < 5; i++) {
      const again = claimBadge(state, c, "apr-a", NOW);
      if (again.ok) state = again.state;
    }
    expect(summarize(c, state).xp).toBe(100);
    expect(state.entries["apr-a"].completedAt).toBe("2026-10-01T12:00:00.000Z");
  });

  it("no se puede recoger la insignia de una estación bloqueada, aunque se fuerce", () => {
    const c = makeConfig();
    const forced = { ...initialProgress(c), entries: { ...initialProgress(c).entries, "apr-b": { contentRevision: 1, readSectionIds: ALL } } };
    expect(claimBadge(forced, c, "apr-b", NOW)).toEqual({ ok: false, reason: "locked" });
  });

  it("recorre toda la ruta en orden y termina; una ruta vacía no se celebra", () => {
    const c = makeConfig(5);
    let s = initialProgress(c);
    for (const id of c.route) s = complete(c, s, id);
    expect(summarize(c, s)).toMatchObject({ completedCount: 5, totalCount: 5, xp: 500, maxXp: 500, level: 5, nextLearningId: null, finished: true });
    const empty = structuredClone(c);
    empty.route = [];
    expect(summarize(empty, initialProgress(empty))).toMatchObject({ totalCount: 0, finished: false, nextLearningId: null });
  });

  it("los requisitos salen de ui.tabs: una pestaña no requerida no bloquea la insignia", () => {
    const c = makeConfig();
    c.ui.tabs[3].required = false;
    expect(requiredSectionIds(c)).toEqual(["lived", "learning", "reflection"]);
    const r = claimBadge(mark(c, initialProgress(c), "apr-a", ["lived", "learning", "reflection"]), c, "apr-a", NOW);
    expect(r).toMatchObject({ ok: true, changed: true });
  });
});

describe("secuencia con progreso no contiguo (SPEC 13.2)", () => {
  it("completar fuera de orden por una reordenación deja pendientes entre completadas, y solo los nuevos accesos exigen el prefijo", () => {
    const c = makeConfig();
    const s = complete(c, initialProgress(c), "apr-a");
    const reordered = structuredClone(c);
    reordered.route = ["apr-b", "apr-a", "apr-c", "apr-d", "apr-e", "apr-f"];
    expect(stationStatesOf(reordered, s)).toMatchObject({ "apr-b": "available", "apr-a": "completed", "apr-c": "locked" });
    expect(markSectionRead(s, reordered, "apr-c", "lived")).toEqual({ ok: false, reason: "locked" });
  });
});

describe("modo final y admisibilidad editorial (SPEC 10)", () => {
  it("en demo todo contenido activo es admisible; en final solo el aprobado", () => {
    const c = makeConfig();
    expect(isAdmissible(c, "apr-a")).toBe(true);
    const final = structuredClone(c);
    final.mode = "final";
    expect(isAdmissible(final, "apr-a")).toBe(false); // «demo» no es contenido aprobado
    final.learnings["apr-a"].editorialStatus = "draft";
    expect(isAdmissible(final, "apr-a")).toBe(false);
    final.learnings["apr-a"].editorialStatus = "ready";
    expect(isAdmissible(final, "apr-a")).toBe(true);
  });

  it("en final un borrador activo no se marca ni concede insignia, y no se omite en silencio", () => {
    const c = makeConfig();
    c.mode = "final";
    const s = initialProgress(c);
    expect(markSectionRead(s, c, "apr-a", "lived")).toEqual({ ok: false, reason: "not-admissible" });
    expect(claimBadge(s, c, "apr-a", NOW)).toEqual({ ok: false, reason: "not-admissible" });
    expect(stationStatesOf(c, s)["apr-b"]).toBe("locked"); // la ruta no se salta el borrador
  });
});

describe("setActiveSection y totales derivados", () => {
  it("recuerda la pestaña activa sin contarla como lectura", () => {
    const c = makeConfig();
    const s = setActiveSection(initialProgress(c), c, "apr-a", "classroom");
    expect(s.entries["apr-a"]).toMatchObject({ lastSectionId: "classroom", readSectionIds: [] });
    expect(setActiveSection(s, c, "apr-a", "classroom")).toBe(s);
  });

  it("deriva «3 de 6» y «300 / 600 XP» desde route y badges, sin números incrustados", () => {
    const c = makeConfig();
    let s = initialProgress(c);
    for (const id of ["apr-a", "apr-b", "apr-c"]) s = complete(c, s, id);
    expect(summarize(c, s)).toMatchObject({ completedCount: 3, totalCount: 6, xp: 300, maxXp: 600, level: 3, nextLearningId: "apr-d" });
    const richer = structuredClone(c);
    richer.badges["insignia-apr-a"].xp = 500;
    expect(summarize(richer, s)).toMatchObject({ xp: 700, maxXp: 1000 }); // cambiar la XP no concede nada nuevo
    expect([...completedIds(richer, s.entries)]).toEqual(["apr-a", "apr-b", "apr-c"]);
  });

  it("el nivel sube una sola vez por estación (0 al inicio)", () => {
    const c = makeConfig();
    expect(summarize(c, initialProgress(c)).level).toBe(0);
  });
});
