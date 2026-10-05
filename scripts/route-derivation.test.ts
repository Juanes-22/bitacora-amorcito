import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completedIds, nextLearningId, stationNumber, stationStates, summarize } from "../src/domain/progression";
import { initialProgress, reconcileProgress } from "../src/domain/reconcileProgress";
import type { SavedProgress } from "../src/domain/types";
import { makeConfig } from "../src/tests/fixtures/makeConfig";

/** Generador pseudoaleatorio con semilla: las variantes son reproducibles. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
function shuffle<T>(items: T[], next: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const DONE = (rev = 1) => ({ contentRevision: rev, readSectionIds: ["learning", "reflection", "lived"] as const, completedAt: "2026-10-01T00:00:00.000Z" });

describe("totales, numeración, siguiente y finalización dependen SOLO de route (SPEC 4.1, AC-25/26)", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("variante aleatoria %i: archivados y orden de claves no alteran ningún derivado", (seed) => {
    const next = rng(seed);
    const config = makeConfig(7);
    // Archivar algunos, barajar la ruta y el orden de las claves de learnings/badges/placements.
    const active = shuffle(config.route, next).slice(0, 3 + Math.floor(next() * 4));
    config.route = active;
    config.learnings = Object.fromEntries(shuffle(Object.entries(config.learnings), next));
    config.badges = Object.fromEntries(shuffle(Object.entries(config.badges), next));
    config.placements = Object.fromEntries(shuffle(Object.entries(config.placements), next));

    const completedSome = active.slice(0, Math.floor(next() * (active.length + 1)));
    const state: SavedProgress = initialProgress(config);
    for (const id of completedSome) state.entries[id] = { ...DONE(), readSectionIds: [...DONE().readSectionIds] };
    for (const id of Object.keys(config.learnings)) state.entries[id] ??= { contentRevision: 1, readSectionIds: [] };

    const s = summarize(config, state);
    expect(s.totalCount).toBe(active.length);
    expect(s.maxXp).toBe(active.length * 100);
    expect(s.completedCount).toBe(completedSome.length);
    expect(s.xp).toBe(completedSome.length * 100);
    expect(s.level).toBe(completedSome.length);
    expect(s.nextLearningId).toBe(active[completedSome.length] ?? null);
    expect(s.finished).toBe(completedSome.length === active.length);
    active.forEach((id, i) => expect(stationNumber(active, id)).toBe(i + 1));
    expect(Object.keys(stationStates(active, completedIds(config, state.entries)))).toEqual(active);
    expect(nextLearningId(active, new Set(completedSome))).toBe(s.nextLearningId);
  });

  it("archivar y reactivar por ID cambia los totales y conserva el avance (AC-26)", () => {
    const config = makeConfig(6);
    const saved = initialProgress(config);
    saved.entries["apr-b"] = { ...DONE(), readSectionIds: [...DONE().readSectionIds] };
    const archived = structuredClone(config);
    archived.route = archived.route.filter((id) => id !== "apr-b");
    expect(summarize(archived, reconcileProgress(archived, saved))).toMatchObject({ totalCount: 5, maxXp: 500, completedCount: 0 });
    const back = reconcileProgress(config, reconcileProgress(archived, saved));
    expect(summarize(config, back)).toMatchObject({ totalCount: 6, completedCount: 1, xp: 100 });
  });

  it("reordenar route renumera y recalcula pendientes sin tocar el avance por ID (AC-25)", () => {
    const config = makeConfig(4);
    const saved = initialProgress(config);
    saved.entries["apr-a"] = { ...DONE(), readSectionIds: [...DONE().readSectionIds] };
    const reordered = structuredClone(config);
    reordered.route = ["apr-c", "apr-a", "apr-d", "apr-b"];
    const r = reconcileProgress(reordered, saved);
    expect(r.entries["apr-a"].completedAt).toBeDefined();
    expect(stationNumber(reordered.route, "apr-a")).toBe(2);
    expect(summarize(reordered, r)).toMatchObject({ nextLearningId: "apr-c", completedCount: 1 });
    expect(stationStates(reordered.route, completedIds(reordered, r.entries))).toEqual({ "apr-c": "available", "apr-a": "completed", "apr-d": "locked", "apr-b": "locked" });
  });
});

/** Recorre los fuentes (no las pruebas) buscando prácticas que romperían «route es la única fuente». */
function sources(dir: string): Array<{ file: string; text: string }> {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "tests" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [{ file: path, text: readFileSync(path, "utf8") }] : [];
  });
}

describe("auditoría estática del código fuente", () => {
  const files = sources("src");

  it("ningún componente ni sistema incrusta totales, XP máxima ni el número de aprendizajes", () => {
    const forbidden = [/\b600\s*XP\b|\/\s*600\b/, /route\.length\s*[=!]==?\s*[1-9]/, /totalCount:\s*\d/, /maxXp:\s*\d/, /\b(de|of)\s+6\b/, /totalStations/];
    for (const { file, text } of files) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const pattern of forbidden) expect(code, `${file} contiene ${pattern}`).not.toMatch(pattern);
    }
  });

  it("solo el validador recorre el contenido de `learnings`: nada de la interfaz o el juego itera los archivados", () => {
    const offenders = files
      .filter(({ file }) => !file.endsWith("validateConfig.ts"))
      .filter(({ text }) => /Object\.(keys|entries|values)\([A-Za-z.]*learnings\)/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("el contrato de configuración no tiene campos que dupliquen la ruta: order, nextLearningId, totalStations, enabled", () => {
    const contract = [
      // Solo el contrato de la BITÁCORA (antes del bloque del manifiesto): un atlas tiene su propio `layout.order` de fotogramas.
      readFileSync("src/config/types.ts", "utf8").split("// ---- assets.json real")[0].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
      readFileSync("public/config/bitacora.schema.json", "utf8"),
      readFileSync("public/config/bitacora.json", "utf8"),
      readFileSync("public/config/maps.schema.json", "utf8"),
      readFileSync("public/config/maps.json", "utf8"),
    ];
    for (const text of contract) expect(text).not.toMatch(/["\s](order|nextLearningId|totalStations|enabled)["\s]*[:?]/);
    // El guardado tampoco contiene derivados.
    expect(Object.keys(initialProgress(makeConfig())).sort()).toEqual(["checkpoints", "contentSetId", "currentZoneId", "entries", "mode", "player", "schemaVersion"]);
  });
});
