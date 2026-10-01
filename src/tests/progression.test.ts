import { describe, expect, it } from "vitest";
import { blockingLearningId, nextLearningId, stationNumber, stationStates } from "../domain/progression";
import { DIALOGUE_VARIABLES, renderTemplate, variablesIn } from "../domain/templates";

const route = ["a", "b", "c", "d"];
const done = (...ids: string[]) => new Set(ids);

describe("stationStates (SPEC 12.8)", () => {
  it("sin progreso: solo el primero está disponible", () => {
    expect(stationStates(route, done())).toEqual({ a: "available", b: "locked", c: "locked", d: "locked" });
  });

  it("completar uno habilita el siguiente y conserva la relectura", () => {
    expect(stationStates(route, done("a"))).toEqual({ a: "completed", b: "available", c: "locked", d: "locked" });
  });

  it("lo completado no tiene por qué ser un prefijo: un pendiente intermedio bloquea a los posteriores", () => {
    expect(stationStates(route, done("a", "c"))).toEqual({ a: "completed", b: "available", c: "completed", d: "locked" });
    expect(stationStates(route, done("c", "d"))).toEqual({ a: "available", b: "locked", c: "completed", d: "completed" });
  });

  it("ruta completa: todo completado; ruta vacía: nada", () => {
    expect(Object.values(stationStates(route, done(...route)))).toEqual(Array(4).fill("completed"));
    expect(stationStates([], done())).toEqual({});
  });

  it("ignora IDs completados que ya no están en la ruta (archivados)", () => {
    expect(stationStates(["a", "b"], done("archivado"))).toEqual({ a: "available", b: "locked" });
  });

  it("reordenar route cambia la secuencia sin tocar lo completado por ID", () => {
    expect(stationStates(["c", "a", "b"], done("a"))).toEqual({ c: "available", a: "completed", b: "locked" });
  });
});

describe("nextLearningId, stationNumber y blockingLearningId", () => {
  it("el siguiente es el primero activo sin completar, calculado de route", () => {
    expect(nextLearningId(route, done("a", "b"))).toBe("c");
    expect(nextLearningId(route, done(...route))).toBeNull();
    expect(nextLearningId([], done())).toBeNull();
  });

  it("la numeración sale del índice en route, no del ID", () => {
    expect(stationNumber(route, "c")).toBe(3);
    expect(stationNumber(["d", "c"], "c")).toBe(2);
    expect(stationNumber(route, "archivado")).toBe(0);
  });

  it("indica qué hay que recorrer antes de una estación bloqueada", () => {
    expect(blockingLearningId(route, done("a"), "d")).toBe("b");
    expect(blockingLearningId(route, done(), "a")).toBeNull();
    expect(blockingLearningId(route, done(), "archivado")).toBeNull();
  });
});

describe("renderTemplate", () => {
  it("sustituye solo las variables entregadas y no ejecuta nada", () => {
    expect(renderTemplate("Hola {studentName}, {completedCount} de {totalCount}", { studentName: "Ana", completedCount: 2, totalCount: 6 })).toBe("Hola Ana, 2 de 6");
    expect(renderTemplate("{desconocida} y {constructor}", { studentName: "x" })).toBe("{desconocida} y {constructor}");
    expect(renderTemplate("{1+1}", {})).toBe("{1+1}");
  });

  it("lista las variables permitidas para diálogos", () => {
    expect([...DIALOGUE_VARIABLES]).toEqual(["studentName", "learningTitle", "previousLearningTitle", "badgeTitle", "completedCount", "totalCount"]);
    expect(variablesIn("a {x} b {y}")).toEqual(["x", "y"]);
  });
});
