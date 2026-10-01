import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import type { AssetEntry, AssetManifest } from "../src/config/types";
import { validateAssetManifest } from "../src/config/validateAssets";
import { checkAtlases, validateAtlasData } from "./lib/validateAtlas";
import { checkAssetFiles } from "./lib/validateProject";

const manifestPath = resolve("public/assets/assets.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AssetManifest;
const root = dirname(manifestPath);
const KIT_IDS = [
  "animation.water.foam-splash", "animation.water.ripples", "animation.water.waterfall", "background.sky.cloud",
  "decoration.plant.bush", "decoration.plant.daisies", "decoration.tree.oak-canopy", "particle.leaf", "particle.petal", "particle.water-droplet",
];
const EXTRAS_IDS = [
  "animation.fauna.duckling-swim", "animation.fauna.white-duck-swim", "animation.light.fairy-lights", "animation.light.gold-sparkle",
  "background.sky.cloud-long", "background.sky.cloud-small", "decoration.light.hanging-lantern", "decoration.light.tree-rays",
  "decoration.light.warm-glow", "particle.firefly-mote", "particle.pollen",
];
const FLORA_IDS = [
  "animation.flora.daisies", "animation.flora.flowering-bush", "animation.flora.pink-flowers",
  "animation.flora.purple-spikes", "animation.flora.round-bush", "animation.flora.sunflowers",
];
const MUSIC_IDS = ["audio.music.beyond-the-clouds", "audio.music.enchanted-festival", "audio.music.little-town-orchestral"];
const ATLAS_IDS = [
  "animation.water.ripples", "animation.water.waterfall", "animation.water.foam-splash",
  "animation.light.fairy-lights", "animation.light.gold-sparkle", "animation.fauna.duckling-swim", "animation.fauna.white-duck-swim",
  ...FLORA_IDS,
];

const load = (id: string) => {
  const entry = manifest.assets[id];
  return { entry, atlas: JSON.parse(readFileSync(join(root, entry.atlasPath as string), "utf8")), png: PNG.sync.read(readFileSync(join(root, entry.path))) };
};
const issues = (id: string, mutate?: (atlas: any, entry: AssetEntry) => void) => {
  const { entry, atlas, png } = load(id);
  const e = structuredClone(entry);
  const a = structuredClone(atlas);
  mutate?.(a, e);
  return validateAtlasData(id, e, a, png).map((i) => `${i.path}: ${i.message}`);
};

describe("kit de animaciones del paisaje en el manifiesto real (SPEC 3.2, AC-40)", () => {
  it("el manifiesto con los dos kits y la música es válido: 75 entradas y recuentos coherentes", () => {
    const r = validateAssetManifest(manifest);
    expect(r.ok ? "" : JSON.stringify(r.ok ? [] : r.issues)).toBe("");
    expect(manifest.assetCount).toBe(75);
    expect(manifest.categoryCounts).toMatchObject({ audio: 3, backgrounds: 17, decorations: 11, effects: 15 });
  });

  it("las 45 entradas originales siguen en su sitio y con sus campos (el kit solo se añadió)", () => {
    const ids = Object.keys(manifest.assets);
    expect(ids.slice(0, 45)).toContain("ui.panel.cream.nine-slice");
    expect(manifest.assets["character.vanessa-jerry.walk.poses-v4"].requiresFrameDefinition).toBe(true);
    expect(manifest.assets["ui.panel.cream.nine-slice"].nineSlice).toEqual({ top: 32, right: 32, bottom: 32, left: 32 });
    expect(ids.slice(45, 55).sort()).toEqual(KIT_IDS);
    expect(ids.slice(55, 66).sort()).toEqual(EXTRAS_IDS);
    expect(ids.slice(66, 69)).toEqual(MUSIC_IDS);
    expect(ids.slice(69).sort()).toEqual(FLORA_IDS);
  });

  it("el kit conserva su metadata (origen, escala recomendada, animación y movimiento) sin duplicarla en otro sitio", () => {
    const w = manifest.assets["animation.water.waterfall"];
    expect(w).toMatchObject({ kind: "animation-sheet", frameCount: 8, origin: { x: 0.513812, y: 0.943015 }, recommendedScale: 0.251889, animation: { frameRate: 10, repeat: -1 } });
    expect(manifest.assets["background.sky.cloud"].motion).toMatchObject({ type: "drift", direction: "right", speedPxPerSecond: 4 });
    expect(manifest.assets["particle.water-droplet"].motion).toMatchObject({ type: "particle", gravityY: 180 });
    expect(manifest.assets["decoration.plant.bush"].motion).toMatchObject({ type: "sway" });
  });

  it("todos los archivos (imagen y atlas) existen y no hay avisos de hash, tamaño ni huérfanos", () => {
    const r = checkAssetFiles(manifest, manifestPath);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("los trece atlas son válidos contra su imagen real", () => {
    expect(checkAtlases(manifest, manifestPath)).toEqual([]);
  });

  it.each(ATLAS_IDS)("%s: 8 regiones, nombres de la animación y sin solapes", (id) => {
    const { atlas, entry } = load(id);
    expect(Object.keys(atlas.frames)).toHaveLength(8);
    expect(entry.animation?.frameNames).toEqual(Object.keys(atlas.frames));
    expect(issues(id)).toEqual([]);
  });
});

describe("piezas adicionales del paisaje y música (SPEC 3.2 y 6.4; AC-47)", () => {
  const a = (id: string) => manifest.assets[id];

  it("conservan la mezcla y la opacidad base del kit", () => {
    expect(a("decoration.light.warm-glow")).toMatchObject({ kind: "light-glow", blendMode: "ADD", opacity: 0.14 });
    expect(a("decoration.light.tree-rays")).toMatchObject({ kind: "light-glow", blendMode: "ADD", opacity: 0.08 });
    expect(a("particle.firefly-mote")).toMatchObject({ blendMode: "ADD", opacity: 0.65 });
    expect(a("background.sky.cloud-small")).toMatchObject({ blendMode: "NORMAL", opacity: 0.88 });
  });

  it("traducen las sugerencias de movimiento al motion que interpreta la lógica", () => {
    expect(a("decoration.light.warm-glow").motion).toEqual({ type: "pulse", alphaMin: 0.09, alphaMax: 0.18, durationMs: 2200 });
    expect(a("decoration.light.hanging-lantern").motion).toMatchObject({ type: "sway", angleDegrees: { from: -1.5, to: 1.5 }, durationMs: 2600 });
    expect(a("background.sky.cloud-long").motion).toMatchObject({ type: "drift", direction: "right", speedPxPerSecond: 3 });
    expect(a("particle.firefly-mote").motion).toMatchObject({ type: "particle", lifespanMs: 2200, lifespanMaxMs: 4400 });
    expect(a("animation.fauna.duckling-swim").motion).toEqual({ type: "swim", speedPxPerSecond: 7.14 });
    expect(a("animation.fauna.white-duck-swim")).toMatchObject({ facing: "right", flipForLeft: true });
  });

  it("las pistas llevan duración, tamaño, hash y crédito; una sin verificar queda marcada", () => {
    for (const id of MUSIC_IDS) expect(a(id)).toMatchObject({ category: "audio", kind: "music", type: "audio" });
    expect(a(MUSIC_IDS[0]).credit).toMatchObject({ artist: "Matthew Pablo", license: "CC BY 3.0", verified: true });
    expect(a(MUSIC_IDS[2]).credit?.verified).toBe(false);
  });

  const bad = (edit: (m: AssetManifest) => void) => {
    const m = structuredClone(manifest);
    edit(m);
    const r = validateAssetManifest(m);
    return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`).join("|");
  };
  it("rechaza luces sin pulso, pulsos al revés y pistas sin crédito", () => {
    expect(bad((m) => { m.assets["decoration.light.warm-glow"].motion = { type: "drift", direction: "left", speedPxPerSecond: 1 }; })).toContain("pulse");
    expect(bad((m) => { m.assets["decoration.light.warm-glow"].motion = { type: "pulse", alphaMin: 0.5, alphaMax: 0.1, durationMs: 100 }; })).toContain("alphaMin");
    expect(bad((m) => { delete m.assets[MUSIC_IDS[0]].credit; })).toContain("credit");
    expect(bad((m) => { delete m.assets[MUSIC_IDS[0]].durationSeconds; })).toContain("durationSeconds");
    expect(bad((m) => { (m.assets[MUSIC_IDS[0]].credit as { attribution?: string }).attribution = ""; })).toContain("atribución");
  });
});

describe("flores y arbustos animados (SPEC 3.2; AC-55)", () => {
  it.each(FLORA_IDS)("%s: hoja animada de 8 fotogramas con la raíz como origen y escala recomendada", (id) => {
    const e = manifest.assets[id];
    expect(e).toMatchObject({ category: "decorations", kind: "animation-sheet", frameCount: 8, filter: "nearest", blendMode: "NORMAL", opacity: 1 });
    expect(e.origin!.y).toBeGreaterThan(0.95); // la raíz, en la base del fotograma
    expect(e.origin!.y).toBeLessThan(1);
    expect(e.recommendedScale).toBeGreaterThan(0);
    expect(e.animation).toMatchObject({ repeat: -1 });
    expect([4, 6]).toContain(e.animation!.frameRate);
    expect(e.motion).toBeUndefined(); // se animan por fotogramas, no por rotación
  });

  it("los arbustos van a 4 fps y las flores a 6 fps, como indica el kit", () => {
    expect(manifest.assets["animation.flora.round-bush"].animation!.frameRate).toBe(4);
    expect(manifest.assets["animation.flora.flowering-bush"].animation!.frameRate).toBe(4);
    expect(manifest.assets["animation.flora.daisies"].animation!.frameRate).toBe(6);
  });
});

describe("validateAtlasData detecta atlas incoherentes", () => {
  const id = "animation.water.waterfall";

  it("una región fuera de la imagen", () => {
    expect(issues(id, (a) => { a.frames["frame-03"].frame.x = 1400; }).join("|")).toContain("queda fuera de la imagen");
  });

  it("una región vacía (zona transparente de la imagen)", () => {
    expect(issues(id, (a) => { a.frames["frame-00"].frame = { x: 0, y: 0, w: 20, h: 20 }; }).join("|")).toContain("está vacía");
  });

  it("dos regiones solapadas", () => {
    expect(issues(id, (a) => { a.frames["frame-01"].frame = { ...a.frames["frame-00"].frame }; }).join("|")).toContain("se solapa con");
  });

  it("nombres que no coinciden con animation.frameNames, o distinto número de regiones", () => {
    expect(issues(id, (a) => { a.frames["extra"] = a.frames["frame-00"]; delete a.frames["frame-07"]; }).join("|")).toContain("no coinciden con animation.frameNames");
    expect(issues(id, (_a, e) => { e.frameCount = 6; }).join("|")).toContain("frameCount es 6");
  });

  it("meta.image o meta.size que no corresponden a la imagen real", () => {
    expect(issues(id, (a) => { a.meta.image = "otra.png"; }).join("|")).toContain("no coincide con el archivo del asset");
    expect(issues(id, (a) => { a.meta.size = { w: 100, h: 100 }; }).join("|")).toContain("la imagen mide");
  });

  it("sourceSize distinto de sourceFrameSize y regiones con valores inválidos", () => {
    expect(issues(id, (a) => { a.frames["frame-00"].sourceSize = { w: 10, h: 10 }; }).join("|")).toContain("no coincide con sourceFrameSize");
    expect(issues(id, (a) => { a.frames["frame-00"].frame.w = -3; }).join("|")).toContain("región inválida");
  });

  it("algo que no es un atlas", () => {
    const { entry, png } = load(id);
    expect(validateAtlasData(id, entry, { hola: 1 }, png)[0].message).toContain("no tiene la forma de un atlas");
  });
});

describe("el manifiesto rechaza entradas incompletas del kit", () => {
  const bad = (edit: (m: AssetManifest) => void) => {
    const m = structuredClone(manifest);
    edit(m);
    const r = validateAssetManifest(m);
    return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
  };

  it("una hoja animada sin atlas o sin animación", () => {
    expect(bad((m) => { delete m.assets["animation.water.ripples"].atlasPath; }).join("|")).toContain("necesita su atlas");
    expect(bad((m) => { delete m.assets["animation.water.ripples"].animation; }).join("|")).toContain("necesita animation");
  });

  it("frameNames que no suman frameCount; falta origin o recommendedScale; partícula sin motion de partícula", () => {
    expect(bad((m) => { m.assets["animation.water.ripples"].animation!.frameNames.pop(); }).join("|")).toContain("frameCount");
    expect(bad((m) => { delete m.assets["decoration.plant.bush"].origin; }).join("|")).toContain("necesita origin y recommendedScale");
    expect(bad((m) => { m.assets["particle.leaf"].motion = { type: "drift", direction: "left", speedPxPerSecond: 1 }; }).join("|")).toContain("partícula necesita motion");
  });

  it("un motion con forma inválida lo detecta el esquema", () => {
    expect(bad((m) => { (m.assets["decoration.plant.bush"] as any).motion = { type: "sway" }; }).length).toBeGreaterThan(0);
    expect(bad((m) => { (m.assets["particle.leaf"] as any).motion = { type: "teletransporte" }; }).length).toBeGreaterThan(0);
  });

  it("un atlasPath absoluto o que sale del directorio", () => {
    expect(bad((m) => { m.assets["animation.water.ripples"].atlasPath = "/animations/x.json"; }).join("|")).toContain("atlasPath");
    expect(bad((m) => { m.assets["animation.water.ripples"].atlasPath = "../x.json"; }).join("|")).toContain("atlasPath");
  });
});
