import { describe, expect, it } from "vitest";
import { swimmer } from "../game/systems/swimPath";

describe("swimmer: ida y vuelta por una trayectoria (AC-49)", () => {
  const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }];

  it("mide el trayecto y recorre los tramos en orden", () => {
    const s = swimmer(path, 10, "right");
    expect(s.length).toBe(150);
    expect(s.at(0)).toMatchObject({ x: 0, y: 0 });
    expect(s.at(50)).toMatchObject({ x: 50, y: 0 });
    expect(s.at(125)).toMatchObject({ x: 100, y: 25 });
    expect(s.at(150)).toMatchObject({ x: 100, y: 50 });
  });

  it("vuelve por el mismo camino y es cíclico", () => {
    const s = swimmer(path, 10, "right");
    expect(s.at(175)).toMatchObject({ x: 100, y: 25 });
    expect(s.at(250)).toMatchObject({ x: 50, y: 0 });
    expect(s.at(300)).toMatchObject({ x: 0, y: 0 });
    expect(s.at(350)).toMatchObject({ x: 50, y: 0 });
    expect(s.at(-50)).toMatchObject({ x: 50, y: 0 });
  });

  it("mira hacia donde nada: no se voltea de ida a la derecha y sí de vuelta; al revés si el dibujo mira a la izquierda", () => {
    const right = swimmer(path, 10, "right");
    expect(right.at(50).flipX).toBe(false);
    expect(right.at(250).flipX).toBe(true);
    const left = swimmer(path, 10, "left");
    expect(left.at(50).flipX).toBe(true);
    expect(left.at(250).flipX).toBe(false);
  });

  it("un tramo vertical conserva el sentido anterior y un recorrido hacia la izquierda se voltea", () => {
    const s = swimmer(path, 10, "right");
    expect(s.at(125).flipX).toBe(false); // tramo vertical de ida
    expect(s.at(175).flipX).toBe(false); // vertical de vuelta: sigue mirando a donde miraba, sin parpadear
    const west = swimmer([{ x: 100, y: 0 }, { x: 0, y: 0 }], 10, "right");
    expect(west.at(10).flipX).toBe(true);
    expect(west.at(0).flipX).toBe(true);
  });

  it("una trayectoria sin longitud se queda quieta", () => {
    const s = swimmer([{ x: 5, y: 5 }, { x: 5, y: 5 }], 10, "right");
    expect(s.at(999)).toMatchObject({ x: 5, y: 5 });
  });
});
