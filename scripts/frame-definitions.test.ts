import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { frameDefinitions, WALK_SHEET_ID, type SheetDefinition } from "../src/assets/frameDefinitions";
import type { AssetManifest } from "../src/config/types";
import { validateFrameDefinitions } from "./lib/validateFrames";

const manifestPath = resolve("public/assets/assets.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AssetManifest;
const clone = (): Record<string, SheetDefinition> => structuredClone(frameDefinitions) as Record<string, SheetDefinition>;
const issuesOf = (defs: Record<string, SheetDefinition>) => validateFrameDefinitions(defs, manifest, manifestPath);
type Mutable = { frames: SheetDefinition["frames"][number][]; animations: SheetDefinition["animations"] };
const walk = (d: Record<string, SheetDefinition>) => d[WALK_SHEET_ID] as unknown as Mutable;

describe("definiciones de frames de la hoja de caminar (AC-35)", () => {
  it("coinciden con la imagen real: sin recortes, sin vacíos, sin solapes", () => {
    expect(issuesOf(clone())).toEqual([]);
  });

  it("cubren las 12 poses de rowDirections × columnas, no una división automática", () => {
    const entry = manifest.assets[WALK_SHEET_ID];
    expect(entry.requiresFrameDefinition).toBe(true);
    expect(frameDefinitions[WALK_SHEET_ID].frames).toHaveLength(entry.poseCount as number);
    // La cuadrícula nominal de 362×362 NO es válida: hay frames que la cruzan.
    const crossing = frameDefinitions[WALK_SHEET_ID].frames.filter(
      (f) => [362, 724].some((c) => f.x < c && f.x + f.width > c) || [362, 724, 1086].some((c) => f.y < c && f.y + f.height > c),
    );
    expect(crossing.length).toBeGreaterThan(0);
  });

  it("detecta un recorte que corta la pose", () => {
    const d = clone();
    walk(d).frames[0] = { ...walk(d).frames[0], x: walk(d).frames[0].x + 60, width: walk(d).frames[0].width - 60 };
    expect(issuesOf(d).some((i) => i.message.includes("recorta la pose"))).toBe(true);
  });

  it("detecta un recorte vacío, uno fuera de la imagen y un solapamiento", () => {
    const d = clone();
    walk(d).frames[1] = { ...walk(d).frames[1], x: 0, y: 700, width: 40, height: 20 }; // zona transparente
    walk(d).frames[2] = { ...walk(d).frames[2], x: 1000, width: 400 };
    walk(d).frames[4] = { ...walk(d).frames[3], name: "left-1" }; // mismo rectángulo que left-0
    const msgs = issuesOf(d).map((i) => i.message).join("|");
    expect(msgs).toContain("vacío");
    expect(msgs).toContain("fuera de la imagen");
    expect(msgs).toContain("solapa");
  });

  it("detecta nombres que no siguen rowDirections, poseCount distinto y animaciones con frames inexistentes", () => {
    const d = clone();
    walk(d).frames.pop();
    walk(d).frames[0] = { ...walk(d).frames[0], name: "abajo-0" };
    walk(d).animations = { ...walk(d).animations, "vanessa-walk-down": { frames: ["down-0", "fantasma"], frameRate: 8, repeat: -1 } };
    const msgs = issuesOf(d).map((i) => i.message).join("|");
    expect(msgs).toContain("poseCount");
    expect(msgs).toContain("rowDirections");
    expect(msgs).toContain("frame inexistente «fantasma»");
  });

  it("rechaza un assetId inexistente o que no es hoja de poses", () => {
    const d = { "no.existe": { assetId: "no.existe", frames: [], animations: {} }, "ui.icon.xp-star": { assetId: "ui.icon.xp-star", frames: [], animations: {} } };
    const msgs = issuesOf(d as Record<string, SheetDefinition>).map((i) => i.message).join("|");
    expect(msgs).toContain("asset ID no encontrado");
    expect(msgs).toContain("no es una hoja de poses");
  });

  it("el punto de apoyo está en la base de la pose, bajo Vanessa", () => {
    for (const f of frameDefinitions[WALK_SHEET_ID].frames) {
      expect(f.feetY).toBeGreaterThan(f.height - 8);
      expect(f.feetX).toBeGreaterThan(0);
      expect(f.feetX).toBeLessThan(f.width * 0.6);
    }
  });
});
