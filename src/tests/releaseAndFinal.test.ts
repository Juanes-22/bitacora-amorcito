import { describe, expect, it } from "vitest";
import bitacoraJson from "../../public/config/bitacora.json";
import { releaseBlockers } from "../config/releaseBlockers";
import type { BitacoraConfig } from "../config/types";
import { claimBadge, isAdmissible, markSectionRead, summarize, unapprovedIds } from "../domain/progression";
import { initialProgress } from "../domain/reconcileProgress";
import { makeConfig } from "./fixtures/makeConfig";

const real = bitacoraJson as unknown as BitacoraConfig;
const ready = (c: BitacoraConfig) => {
  c.mode = "final";
  for (const id of c.route) c.learnings[id].editorialStatus = "ready";
  c.project.finalReflection = [{ type: "paragraph", text: "Reflexión aportada por la autora." }];
  delete c.editorNotes;
  return c;
};

describe("releaseBlockers (SPEC 10 y 16)", () => {
  it("la configuración actual (demostración) tiene bloqueos y los enumera con su ruta", () => {
    const paths = releaseBlockers(real).map((b) => b.path);
    expect(paths).toContain("mode");
    expect(paths).toContain("learnings.apr-a.editorialStatus");
    expect(paths).toContain("project.finalReflection");
    expect(paths).toContain("editorNotes");
    expect(paths.filter((p) => p.endsWith("editorialStatus"))).toHaveLength(6);
  });

  it("una entrega aprobada, final y sin notas no tiene bloqueos", () => {
    expect(releaseBlockers(ready(makeConfig()))).toEqual([]);
  });

  it("cada condición bloquea por separado", () => {
    const c = ready(makeConfig());
    expect(releaseBlockers({ ...c, mode: "demo" }).map((b) => b.path)).toEqual(["mode"]);
    const draft = structuredClone(c);
    draft.learnings["apr-c"].editorialStatus = "draft";
    expect(releaseBlockers(draft).map((b) => b.path)).toEqual(["learnings.apr-c.editorialStatus"]);
    expect(releaseBlockers({ ...c, route: [] }).map((b) => b.path)).toEqual(["route"]);
    expect(releaseBlockers({ ...c, editorNotes: "pendiente" }).map((b) => b.path)).toEqual(["editorNotes"]);
    expect(releaseBlockers({ ...c, project: { ...c.project, finalReflection: [] } }).map((b) => b.path)).toEqual(["project.finalReflection"]);
  });

  it("un aprendizaje archivado en borrador NO bloquea: no forma parte de la entrega", () => {
    const c = ready(makeConfig());
    c.learnings["apr-archivado"] = { ...structuredClone(c.learnings["apr-a"]), editorialStatus: "draft" };
    expect(releaseBlockers(c)).toEqual([]);
  });
});

describe("modo final: contenido sin aprobar (SPEC 10)", () => {
  it("en demo nada está sin aprobar; en final lo están todos los activos que no son «ready»", () => {
    const c = makeConfig();
    expect(unapprovedIds(c)).toEqual([]);
    c.mode = "final";
    expect(unapprovedIds(c)).toEqual(c.route);
    c.learnings["apr-b"].editorialStatus = "ready";
    expect(unapprovedIds(c)).not.toContain("apr-b");
  });

  it("el recorrido en final con pendientes se presenta «en preparación», no como terminado", () => {
    const c = makeConfig(3);
    c.mode = "final";
    expect(summarize(c, initialProgress(c))).toMatchObject({ inPreparation: true, pendingCount: 3, finished: false });
    for (const id of c.route) c.learnings[id].editorialStatus = "ready";
    expect(summarize(c, initialProgress(c))).toMatchObject({ inPreparation: false, pendingCount: 0 });
  });

  it("un borrador no se completa «como si fuera definitivo»: ni se marca, ni se recoge, ni se salta", () => {
    const c = makeConfig(3);
    c.mode = "final";
    c.learnings["apr-a"].editorialStatus = "ready";
    c.learnings["apr-b"].editorialStatus = "draft";
    c.learnings["apr-c"].editorialStatus = "ready";
    let s = initialProgress(c);
    for (const sec of ["learning", "reflection", "lived"] as const) {
      const r = markSectionRead(s, c, "apr-a", sec);
      if (r.ok) s = r.state;
    }
    const a = claimBadge(s, c, "apr-a", new Date());
    if (!a.ok) throw new Error("apr-a debía poder completarse");
    expect(markSectionRead(a.state, c, "apr-b", "lived")).toEqual({ ok: false, reason: "not-admissible" });
    expect(claimBadge(a.state, c, "apr-b", new Date())).toEqual({ ok: false, reason: "not-admissible" });
    expect(isAdmissible(c, "apr-c")).toBe(true);
    expect(markSectionRead(a.state, c, "apr-c", "lived")).toEqual({ ok: false, reason: "locked" }); // el borrador sigue bloqueando
    expect(summarize(c, a.state)).toMatchObject({ completedCount: 1, inPreparation: true, finished: false });
  });

  it("aunque todo esté completado, un contenido sin aprobar impide darlo por terminado", () => {
    const c = makeConfig(2);
    const done = { contentRevision: 1, readSectionIds: ["learning", "reflection", "lived"] as const, completedAt: "2026-10-01T00:00:00.000Z" };
    const state = { ...initialProgress(c), entries: { "apr-a": { ...done, readSectionIds: [...done.readSectionIds] }, "apr-b": { ...done, readSectionIds: [...done.readSectionIds] } } };
    expect(summarize(c, state).finished).toBe(true);
    c.mode = "final"; // mismo avance, ahora el contenido no está aprobado
    const final = { ...state, mode: "final" as const };
    expect(summarize(c, final)).toMatchObject({ completedCount: 2, finished: false, inPreparation: true });
  });
});
