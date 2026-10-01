import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkAssetFiles, validateProject } from "./lib/validateProject";
import type { AssetManifest } from "../src/config/types";

const manifestPath = resolve("public/assets/assets.json");
const manifestJson = JSON.parse(readFileSync(manifestPath, "utf8"));
const configJson = JSON.parse(readFileSync(resolve("public/config/bitacora.json"), "utf8"));
const clone = <T>(v: T): T => structuredClone(v);
const paths = (list: Array<{ path: string }>) => list.map((i) => i.path);

// PNG de 1×1 válido, para fabricar un directorio de assets mínimo.
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describe("validateProject sobre los archivos reales", () => {
  it("el proyecto actual valida sin errores ni avisos", () => {
    const r = validateProject(manifestJson, configJson, manifestPath);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.info.join("\n")).toContain("alcanzabilidad: estaciones, portales y spawns alcanzables");
  });

  it("un path roto es un error con el ID del asset", () => {
    const m = clone(manifestJson);
    m.assets["ui.icon.xp-star"].path = "ui/icons/no-esta.png";
    const r = validateProject(m, configJson, manifestPath);
    expect(paths(r.errors)).toContain("assets.json › assets.ui.icon.xp-star.path");
  });

  it("sustituir un archivo conservando el ID solo avisa (hash y tamaño son inventario)", () => {
    const m = clone(manifestJson);
    m.assets["ui.icon.xp-star"].path = "ui/icons/open-book.png"; // otro PNG existente
    const r = validateProject(m, configJson, manifestPath);
    expect(r.errors).toEqual([]);
    expect(paths(r.warnings)).toContain("assets.json › assets.ui.icon.xp-star.sha256");
  });

  it("assetCount incoherente impide seguir y se informa", () => {
    const m = clone(manifestJson);
    m.assetCount = 3;
    const r = validateProject(m, configJson, manifestPath);
    expect(paths(r.errors)).toEqual(["assets.json › assetCount"]);
  });

  it("referencias cruzadas inválidas en bitacora.json", () => {
    const c = clone(configJson);
    c.placements["apr-c"].decorationAssetId = "station.item.no-existe";
    const r = validateProject(manifestJson, c, manifestPath);
    expect(paths(r.errors)).toEqual(["bitacora.json › placements.apr-c.decorationAssetId"]);
  });

  it("un obstáculo sobre el punto de interacción se informa como referencia inválida", () => {
    const c = clone(configJson);
    const p = c.placements["apr-b"];
    const x = p.position.x + p.interactionOffset.x;
    const y = p.position.y + p.interactionOffset.y;
    c.maps[p.zoneId].obstacles.push({ type: "rect", x: x - 150, y: y - 150, width: 300, height: 300 });
    const r = validateProject(manifestJson, c, manifestPath);
    expect(paths(r.errors)).toEqual(["bitacora.json › placements.apr-b.interactionOffset"]);
  });

  it("una estación rodeada por muros (con su punto libre) se informa como inalcanzable", () => {
    const c = clone(configJson);
    const p = c.placements["apr-b"];
    const x = p.position.x + p.interactionOffset.x;
    const y = p.position.y + p.interactionOffset.y;
    // Anillo a 80–100 px del punto de interacción: el radio de interacción (70) no sale del anillo.
    c.maps[p.zoneId].obstacles.push(
      { type: "rect", x: x - 100, y: y - 100, width: 200, height: 20 },
      { type: "rect", x: x - 100, y: y + 80, width: 200, height: 20 },
      { type: "rect", x: x - 100, y: y - 100, width: 20, height: 200 },
      { type: "rect", x: x + 80, y: y - 100, width: 20, height: 200 },
    );
    const r = validateProject(manifestJson, c, manifestPath);
    expect(paths(r.errors)).toContain("bitacora.json › placements.apr-b.interactionRadius");
  });
});

describe("checkAssetFiles en un directorio mínimo", () => {
  const dir = mkdtempSync(join(tmpdir(), "bitacora-assets-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "img"));
  writeFileSync(join(dir, "img", "a.png"), PNG_1X1);
  writeFileSync(join(dir, "img", "huerfano.png"), PNG_1X1);
  writeFileSync(join(dir, "img", "falso.png"), "no soy un png");
  const file = join(dir, "assets.json");
  const manifest = (assets: AssetManifest["assets"]): AssetManifest => ({
    version: 1, project: "t", basePath: ".", pathConvention: "relativo", assetCount: Object.keys(assets).length, categoryCounts: {}, assets,
  });
  const entry = (path: string, extra = {}) => ({ path, type: "image", format: "png", category: "ui", label: "x", kind: "icon", ...extra });

  it("acepta un archivo correcto y avisa de los huérfanos", () => {
    const r = checkAssetFiles(manifest({ "ui.a": entry("img/a.png", { width: 1, height: 1 }) }), file);
    expect(r.errors).toEqual([]);
    expect(paths(r.warnings)).toEqual(expect.arrayContaining(["img/huerfano.png", "img/falso.png"]));
  });

  it("avisa si las dimensiones declaradas no coinciden, sin fallar", () => {
    const r = checkAssetFiles(manifest({ "ui.a": entry("img/a.png", { width: 10, height: 10 }) }), file);
    expect(r.errors).toEqual([]);
    expect(paths(r.warnings)).toContain("assets.ui.a.width");
  });

  it("un archivo ausente o que no es PNG es un error", () => {
    const r = checkAssetFiles(manifest({ "ui.a": entry("img/falta.png"), "ui.b": entry("img/falso.png") }), file);
    expect(paths(r.errors)).toEqual(["assets.ui.a.path", "assets.ui.b.path"]);
  });
});
