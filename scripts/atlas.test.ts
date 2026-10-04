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
const IDLE_IDS = ["character.vanessa-jerry.idle-anim.look", "character.vanessa-jerry.idle-anim.play", "character.vanessa-jerry.idle-anim.rest"];
const TRICKS_IDS = ["character.vanessa-jerry.idle-anim.fetch", "character.vanessa-jerry.idle-anim.tricks"];
const TOOLBAR_IDS = ["decoration.learning-corner", "station.item.open-book", "ui.button.audio.default", "ui.button.badges.default", "ui.button.journal.default", "ui.button.paw.default", "ui.button.settings.default"];
const STATION_FX_IDS = ["effect.player-glow.next-station", "effect.xp-star.complete", "ui.panel.player-status.default"];
const AVATAR_IDS = ["character.vanessa-jerry.avatar", "character.vanessa-jerry.avatar.animations"];
const UI_V2_IDS = ["effect.station-glow.pulse", "map.sign.exit-right", "station.sign.board", "ui.badge.completed-pill", "ui.button.jerry.labeled", "ui.button.journal.labeled", "ui.button.sound-off.labeled", "ui.button.sound-on.labeled"];
const CHICKEN_IDS = ["fauna.chick.black", "fauna.hen.black-crested", "fauna.hen.brown", "fauna.hen.grey-fluffy", "fauna.hen.white", "fauna.hen.white-fluffy"];
const BADGE_IDS = ["ui.badge.jerry", "ui.badge.museo-taxidermia", "ui.badge.pinguinos-adaptacion", "ui.badge.plantas-origen", "ui.badge.plantas-semillas", "ui.badge.plastilina-casera", "ui.badge.tierra-movimientos"];
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
  it("el manifiesto con los dos kits y la música es válido: 113 entradas y recuentos coherentes", () => {
    const r = validateAssetManifest(manifest);
    expect(r.ok ? "" : JSON.stringify(r.ok ? [] : r.issues)).toBe("");
    expect(manifest.assetCount).toBe(113);
    expect(manifest.categoryCounts).toMatchObject({ audio: 3, backgrounds: 17, characters: 14, decorations: 18, effects: 18, stations: 10, ui: 31 });
  });

  it("las 45 entradas originales siguen en su sitio y con sus campos (el kit solo se añadió)", () => {
    const ids = Object.keys(manifest.assets);
    expect(ids.slice(0, 45)).toContain("ui.panel.cream.nine-slice");
    expect(manifest.assets["character.vanessa-jerry.walk.poses-v4"].requiresFrameDefinition).toBe(true);
    expect(manifest.assets["ui.panel.cream.nine-slice"].nineSlice).toEqual({ top: 32, right: 32, bottom: 32, left: 32 });
    expect(ids.slice(45, 55).sort()).toEqual(KIT_IDS);
    expect(ids.slice(55, 66).sort()).toEqual(EXTRAS_IDS);
    expect(ids.slice(66, 69)).toEqual(MUSIC_IDS);
    expect(ids.slice(69, 75).sort()).toEqual(FLORA_IDS);
    expect(ids.slice(75, 78).sort()).toEqual(IDLE_IDS);
    expect(ids.slice(78, 80).sort()).toEqual(TRICKS_IDS);
    expect(ids.slice(80, 87).sort()).toEqual(TOOLBAR_IDS);
    expect(ids.slice(87, 90).sort()).toEqual(STATION_FX_IDS);
    expect(ids.slice(90, 92).sort()).toEqual(AVATAR_IDS);
    expect(ids.slice(92, 100).sort()).toEqual(UI_V2_IDS);
    expect(ids.slice(100, 106).sort()).toEqual(CHICKEN_IDS);
    expect(ids.slice(106).sort()).toEqual(BADGE_IDS);
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

  it("los diecisiete atlas son válidos contra su imagen real", () => {
    expect(checkAtlases(manifest, manifestPath)).toEqual([]);
  });

  it.each(ATLAS_IDS)("%s: 8 regiones, nombres de la animación y sin solapes", (id) => {
    const { atlas, entry } = load(id);
    expect(Object.keys(atlas.frames)).toHaveLength(8);
    expect(entry.animation?.frameNames).toEqual(Object.keys(atlas.frames));
    expect(issues(id)).toEqual([]);
  });
});

describe("assets de interfaz y estaciones del paquete bitacora-ui-assets (SPEC 4.3 y 14, AC-72)", () => {
  const e = (id: string) => manifest.assets[id];

  it("el letrero de estación trae las zonas del número y del título y el ancla del estado, dentro de la imagen", () => {
    const s = e("station.sign.board");
    expect(s).toMatchObject({ kind: "station-sign", category: "stations", width: 384, height: 320, origin: { x: 0.5, y: 0.95 } });
    expect(s.labelZones).toMatchObject({ number: { x: 160, y: 52, width: 64, height: 64, maxLines: 1 }, title: { x: 43, y: 137, width: 298, height: 54, maxLines: 2 } });
    expect(s.attachments?.completed).toEqual({ x: 192, y: 218, width: 230, height: 72 });
    for (const z of Object.values(s.labelZones!)) {
      expect(z.x + z.width).toBeLessThanOrEqual(384);
      expect(z.y + z.height).toBeLessThanOrEqual(320);
    }
  });

  it("la señal de cambio de mapa, la insignia «Completado» y los cuatro botones traen su zona de texto", () => {
    expect(e("map.sign.exit-right")).toMatchObject({ kind: "exit-sign", width: 384, height: 176, direction: "right", origin: { x: 0.69, y: 0.95 } });
    expect(e("map.sign.exit-right").labelZones?.destination).toMatchObject({ x: 31, y: 48, width: 249, height: 40 });
    expect(e("ui.badge.completed-pill")).toMatchObject({ kind: "status-pill", width: 256, height: 80 });
    expect(e("ui.badge.completed-pill").labelZones?.label).toMatchObject({ x: 78, y: 23, width: 154, height: 32, color: "#184c2a" });
    for (const id of ["ui.button.journal.labeled", "ui.button.jerry.labeled", "ui.button.sound-on.labeled", "ui.button.sound-off.labeled"]) {
      expect(e(id), id).toMatchObject({ kind: "button", width: 256, height: 256 });
      expect(e(id).labelZones?.label, id).toMatchObject({ x: 40, y: 182, width: 176, height: 34 });
    }
  });

  it("el brillo es una hoja de 8 fotogramas de 256 × 128 a 8 fps en bucle, con opacidad 0,72", () => {
    expect(e("effect.station-glow.pulse")).toMatchObject({ kind: "animation-sheet", width: 1024, height: 256, frameCount: 8, sourceFrameSize: { width: 256, height: 128 }, animation: { frameRate: 8, repeat: -1 } });
    expect(e("effect.station-glow.pulse").opacityByFrame).toEqual(Array(8).fill(0.72));
    expect(issues("effect.station-glow.pulse")).toEqual([]);
  });

  it("los PNG de las entradas nuevas existen con su tamaño y su transparencia", () => {
    for (const id of UI_V2_IDS) {
      const entry = e(id);
      const png = PNG.sync.read(readFileSync(join(root, entry.path)));
      expect([png.width, png.height], id).toEqual([entry.width, entry.height]);
      expect(entry.originalPath, id).toMatch(/^bitacora-ui-assets\//);
    }
  });

  it("el validador rechaza una zona de texto que se sale de la imagen", () => {
    const m = structuredClone(manifest);
    m.assets["station.sign.board"].labelZones!.title.width = 999;
    const r = validateAssetManifest(m);
    expect(r.ok ? [] : r.issues.map((i) => i.message)).toEqual(expect.arrayContaining([expect.stringContaining("se sale")]));
  });
});

describe("insignias de los aprendizajes y de Jerry (SPEC 7, AC-79)", () => {
  it.each(BADGE_IDS)("%s: insignia de 1254 × 1254 con transparencia, recortes y hash del paquete", (id) => {
    const e = manifest.assets[id];
    expect(e).toMatchObject({ kind: "badge", category: "ui", width: 1254, height: 1254, hasAlphaChannel: true, transparent: true, recommendedDisplay: { width: 64, height: 64 } });
    expect(e.contentBounds!.width).toBeGreaterThan(1000);
    expect(e.meaning!.length).toBeGreaterThan(20);
    const png = PNG.sync.read(readFileSync(join(root, e.path)));
    expect([png.width, png.height]).toEqual([1254, 1254]);
    expect(png.data[3]).toBe(0); // esquina transparente: solo el medallón es opaco
  });

  it("los PNG son los originales del paquete (hash) y la insignia de escucha activa anterior sigue intacta", () => {
    expect(checkAssetFiles(manifest, manifestPath).warnings).toEqual([]);
    expect(manifest.assets["ui.badge.active-listening"]).toMatchObject({ kind: "badge", width: 320, height: 318 });
  });
});

describe("gallinas y pollito animados (SPEC 3.3, AC-78)", () => {
  it.each(CHICKEN_IDS)("%s: hoja de 12 fotogramas de 448 × 448 con reposo, caminar y picotear, y su atlas es válido", (id) => {
    const e = manifest.assets[id];
    expect(e).toMatchObject({ kind: "critter-sheet", category: "decorations", width: 1448, height: 1086, frameCount: 12, sourceFrameSize: { width: 448, height: 448 }, facing: "right", flipForLeft: true });
    expect(e.critterAnimations!.map((a) => a.state)).toEqual(["idle", "walk", "peck"]);
    expect(e.critterAnimations![0].durationsMs).toEqual([1200, 450, 130, 600]);
    expect(e.critterAnimations![1].durationsMs).toEqual([140, 140, 140, 140]);
    expect(e.critterAnimations![2].durationsMs).toEqual([650, 180, 220, 200]);
    expect(e.recommendedDisplay).toEqual(id === "fauna.chick.black" ? { width: 24, height: 24 } : { width: 48, height: 48 });
    expect(issues(id)).toEqual([]);
  });

  it("los PNG son los originales del paquete (hash) y no hay avisos de archivos", () => {
    expect(checkAssetFiles(manifest, manifestPath).warnings).toEqual([]);
  });

  it("el validador rechaza una hoja sin el estado de picotear o con duraciones que no cuadran", () => {
    const check = (mutate: (e: AssetEntry) => void) => {
      const m = structuredClone(manifest);
      mutate(m.assets["fauna.hen.brown"]);
      const r = validateAssetManifest(m);
      return r.ok ? [] : r.issues.map((i) => i.message);
    };
    expect(check((e) => { e.critterAnimations = e.critterAnimations!.filter((a) => a.state !== "peck"); })).toEqual(expect.arrayContaining([expect.stringContaining("«peck»")]));
    expect(check((e) => { e.critterAnimations![1].durationsMs = [140, 140]; })).toEqual(expect.arrayContaining([expect.stringContaining("duraciones")]));
  });
});

describe("avatar animado de la cabecera (SPEC 14, AC-71)", () => {
  const sheet = () => manifest.assets["character.vanessa-jerry.avatar.animations"];

  it("el avatar estático es un retrato con sus límites de contenido y la hoja, un avatar-sheet de 8 fotogramas de 386 × 386", () => {
    expect(manifest.assets["character.vanessa-jerry.avatar"]).toMatchObject({ kind: "portrait", category: "characters", width: 1254, height: 1254, contentBounds: { x: 86, y: 62, width: 1109, height: 1162 } });
    expect(sheet()).toMatchObject({ kind: "avatar-sheet", category: "characters", width: 1774, height: 887, frameCount: 8, sourceFrameSize: { width: 386, height: 386 } });
  });

  it("tiene una animación de reposo y una feliz, con una duración en ms por fotograma", () => {
    const anims = sheet().avatarAnimations!;
    expect(anims.map((a) => a.state)).toEqual(["idle", "happy"]);
    expect(anims[0]).toMatchObject({ frameNames: ["idle-00", "idle-01", "idle-02", "idle-03"], durationsMs: [1800, 300, 120, 500], repeat: -1 });
    expect(anims[1]).toMatchObject({ frameNames: ["happy-00", "happy-01", "happy-02", "happy-03"], durationsMs: [350, 250, 250, 350], repeat: -1 });
  });

  it("el atlas es válido contra su imagen y no hay avisos de archivos", () => {
    expect(issues("character.vanessa-jerry.avatar.animations")).toEqual([]);
    expect(checkAssetFiles(manifest, manifestPath).warnings).toEqual([]);
  });

  it("el validador rechaza una hoja sin el estado feliz o con duraciones que no cuadran", () => {
    const check = (mutate: (e: AssetEntry) => void) => {
      const m = structuredClone(manifest);
      mutate(m.assets["character.vanessa-jerry.avatar.animations"]);
      const r = validateAssetManifest(m);
      return r.ok ? [] : r.issues.map((i) => i.message);
    };
    expect(check((e) => { e.avatarAnimations = e.avatarAnimations!.slice(0, 1); })).toEqual(expect.arrayContaining([expect.stringContaining("«happy»")]));
    expect(check((e) => { e.avatarAnimations![1].durationsMs = [350, 250]; })).toEqual(expect.arrayContaining([expect.stringContaining("duraciones")]));
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

describe("estrella de XP, aro de la próxima estación y panel de la cabecera (SPEC 4.3 y 14; AC-68 a AC-70)", () => {
  const glow = "effect.player-glow.next-station", xp = "effect.xp-star.complete", panel = "ui.panel.player-status.default";

  it.each([glow, xp])("%s: hoja de 8 fotogramas de 512 × 640 en 4 × 2, validada contra su imagen", (id) => {
    const { atlas, entry } = load(id);
    expect(entry).toMatchObject({ kind: "animation-sheet", category: "effects", width: 2048, height: 1280, frameCount: 8, sourceFrameSize: { width: 512, height: 640 }, recommendedScale: 0.5 });
    expect(Object.keys(atlas.frames)).toHaveLength(8);
    expect(entry.animation!.frameNames).toEqual(Object.keys(atlas.frames));
    expect(issues(id)).toEqual([]);
    expect(entry.opacityByFrame).toHaveLength(8);
    expect(entry.opacityByFrame!.every((o) => o > 0 && o <= 1)).toBe(true);
  });

  it("la hoja de la estrella de XP está a 12 fps (el juego la reutiliza en entrada y bucle); el aro, en bucle a 8 fps", () => {
    expect(manifest.assets[xp]).toMatchObject({ animation: { frameRate: 12, repeat: 0 }, hideOnComplete: true, origin: { x: 0.5, y: 0.55 } });
    expect(manifest.assets[glow]).toMatchObject({ animation: { frameRate: 8, repeat: -1 }, hideOnComplete: false, origin: { x: 0.5, y: 0.65 } });
    expect(manifest.assets[xp].opacityByFrame).toEqual([0.3, 0.75, 1, 1, 1, 0.85, 0.5, 0.15]); // aparece, destella y se desvanece
  });

  it("el panel: PNG de 2124 × 390 con nueve zonas de 112 px y el contenido libre dentro", () => {
    const e = manifest.assets[panel];
    expect(e).toMatchObject({ kind: "panel", category: "ui", width: 2124, height: 390, transparent: true, nineSlice: { top: 112, right: 112, bottom: 112, left: 112 } });
    expect(e.nineSlice).not.toHaveProperty("units"); // el contrato del manifiesto no lo admite: va en píxeles de la imagen
    expect((e as { intendedContents?: string[] }).intendedContents).toContain("avatar");
  });

  it("los archivos existen con su hash y tamaño; los fotogramas sueltos y los APNG del paquete no se copiaron", () => {
    expect(checkAssetFiles(manifest, manifestPath)).toEqual({ errors: [], warnings: [] });
  });

  it("el manifiesto rechaza una opacidad por fotograma que no cuadra con el número de fotogramas", () => {
    const m = structuredClone(manifest);
    m.assets[glow].opacityByFrame!.pop();
    const r = validateAssetManifest(m);
    expect(r.ok ? "" : r.issues.map((i) => i.message).join("|")).toContain("una por fotograma");
    const n = structuredClone(manifest);
    n.assets[glow].opacityByFrame![0] = 1.5;
    expect(validateAssetManifest(n).ok).toBe(false);
  });
});

describe("botones de la cabecera y assets sueltos (paquete bitacora-assets-senalados-v2)", () => {
  const BUTTONS = ["ui.button.journal.default", "ui.button.settings.default", "ui.button.audio.default", "ui.button.paw.default", "ui.button.badges.default"];

  it.each(BUTTONS)("%s: botón de 1254 × 1254 con transparencia exterior, su marco y su contentBounds", (id) => {
    const e = manifest.assets[id];
    expect(e).toMatchObject({ kind: "button", category: "ui", type: "image", width: 1254, height: 1254, transparent: true, hasAlphaChannel: true });
    expect(e.contentBounds!.alphaThreshold).toBe(128);
    expect(e.contentBounds!.width).toBeGreaterThan(800);
    expect(e.contentBounds!.x + e.contentBounds!.width).toBeLessThanOrEqual(1254);
  });

  it("los siete archivos existen con su hash y tamaño, sin avisos de huérfanos", () => {
    expect(checkAssetFiles(manifest, manifestPath)).toEqual({ errors: [], warnings: [] });
  });

  it("se conservan las entradas de los botones verdes anteriores", () => {
    expect(manifest.assets["ui.button.green.default"].kind).toBe("button");
    expect(manifest.assets["ui.icon.open-book"]).toBeDefined();
  });
});

describe("hojas de reposo de Vanessa y Jerry (SPEC 6.2; AC-62)", () => {
  const rest = "character.vanessa-jerry.idle-anim.rest", look = "character.vanessa-jerry.idle-anim.look", play = "character.vanessa-jerry.idle-anim.play";

  it.each(IDLE_IDS)("%s: 12 regiones de un lienzo lógico de 362 × 362, validadas contra la imagen", (id) => {
    const { atlas, entry } = load(id);
    expect(entry).toMatchObject({ kind: "idle-sheet", category: "characters", frameCount: 12, sourceFrameSize: { width: 362, height: 362 }, width: 1086, height: 1448 });
    expect(Object.keys(atlas.frames)).toHaveLength(12);
    expect(new Set(entry.animations!.flatMap((a) => a.frameNames))).toEqual(new Set(Object.keys(atlas.frames)));
    expect(issues(id)).toEqual([]);
    expect(entry.origin!.y).toBeGreaterThan(0.9); // los pies, en la base del lienzo
  });

  it("reposo y mirada tienen una animación por dirección; el juego, una de frente que se reproduce una vez", () => {
    for (const id of [rest, look]) expect(manifest.assets[id].animations!.map((a) => a.direction).sort()).toEqual(["back", "front", "left", "right"]);
    expect(manifest.assets[play].animations).toHaveLength(1);
    expect(manifest.assets[play].animations![0]).toMatchObject({ direction: "front", repeat: 0, frameRate: 6 });
    expect(manifest.assets[rest].animations!.every((a) => a.repeat === -1 && a.repeatDelay === 1700)).toBe(true);
    expect(manifest.assets[look].animations!.every((a) => a.repeat === 0)).toBe(true);
  });

  it("las claves de animación no chocan con las de otras hojas", () => {
    const keys = IDLE_IDS.flatMap((id) => manifest.assets[id].animations!.map((a) => a.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  const bad = (edit: (m: AssetManifest) => void) => {
    const m = structuredClone(manifest);
    edit(m);
    const r = validateAssetManifest(m);
    return r.ok ? "" : r.issues.map((i) => `${i.path}: ${i.message}`).join("|");
  };
  it("el manifiesto rechaza una hoja de reposo incompleta", () => {
    expect(bad((m) => { delete m.assets[rest].atlasPath; })).toContain("necesita su atlas");
    expect(bad((m) => { delete m.assets[rest].animations; })).toContain("necesita animations");
    expect(bad((m) => { delete m.assets[rest].origin; })).toContain("necesita origin");
    expect(bad((m) => { m.assets[rest].animations![1].key = m.assets[rest].animations![0].key; })).toContain("no pueden repetirse");
    expect(bad((m) => { m.assets[rest].animations!.pop(); })).toContain("frameCount");
  });
});

describe("trucos de Jerry y búsqueda del peluche (SPEC 6.2; AC-65)", () => {
  const tricks = "character.vanessa-jerry.idle-anim.tricks", fetch = "character.vanessa-jerry.idle-anim.fetch";

  it.each(TRICKS_IDS)("%s: 12 fotogramas cronológicos validados contra la imagen, con los pies como origen", (id) => {
    const { atlas, entry } = load(id);
    expect(entry).toMatchObject({ kind: "idle-sheet", category: "characters", frameCount: 12, width: 1086, height: 1448 });
    expect(Object.keys(atlas.frames)).toHaveLength(12);
    expect(issues(id)).toEqual([]);
    expect(entry.origin!.y).toBeGreaterThan(0.9);
    expect(entry.animations!.some((a) => new Set(a.frameNames).size === 12)).toBe(true); // la secuencia completa
  });

  it("los trucos traen la secuencia completa y sus partes (salto, sentarse, dar la pata, levantarse)", () => {
    const keys = manifest.assets[tricks].animations!.map((a) => a.key);
    expect(keys).toEqual(["vanessa-jerry-tricks", "jerry-jump", "jerry-sit", "jerry-give-paw", "jerry-stand"]);
    expect(manifest.assets[tricks].animations!.every((a) => a.repeat === 0)).toBe(true);
  });

  it("la hoja de trucos corregida (v2) trae escala y origen por fotograma para igualar la altura de Vanessa", () => {
    const e = manifest.assets[tricks];
    expect(e.referenceHeightPx).toBe(316);
    expect(e.sourceFrameSize).toBeUndefined(); // recortes sin relleno: el origen va en cada fotograma
    expect(e.frameAdjust).toHaveLength(12);
    expect(e.frameAdjust!.map((f) => f.name)).toEqual(Array.from({ length: 12 }, (_, i) => `frame-${String(i).padStart(2, "0")}`));
    for (const f of e.frameAdjust!) {
      expect(f.scaleMultiplier).toBeGreaterThan(0.9); // la v1 dibujaba a Vanessa entre un 3 % y un 5 % más grande
      expect(f.scaleMultiplier).toBeLessThan(1);
      expect(f.origin.x).toBeGreaterThan(0);
      expect(f.origin.y).toBeGreaterThan(0.9); // los pies, en la base del recorte
    }
    const { atlas } = load(tricks);
    expect(Object.values(atlas.frames).every((f: any) => f.sourceSize.w === f.frame.w && f.sourceSize.h === f.frame.h)).toBe(true); // sin relleno
    expect(manifest.assets[fetch].frameAdjust).toBeUndefined(); // la búsqueda del peluche no cambió
  });

  it("el manifiesto rechaza un ajuste por fotograma incompleto, repetido o ajeno", () => {
    const bad = (edit: (m: AssetManifest) => void) => {
      const m = structuredClone(manifest);
      edit(m);
      const r = validateAssetManifest(m);
      return r.ok ? "" : r.issues.map((i) => `${i.path}: ${i.message}`).join("|");
    };
    expect(bad((m) => { m.assets[tricks].frameAdjust!.pop(); })).toContain("falta el ajuste");
    expect(bad((m) => { m.assets[tricks].frameAdjust!.push({ ...m.assets[tricks].frameAdjust![0] }); })).toContain("repetidos");
    expect(bad((m) => { m.assets[tricks].frameAdjust![0].name = "frame-99"; })).toContain("no es un fotograma");
    expect(bad((m) => { m.assets[tricks].frameAdjust![0].scaleMultiplier = 0; })).not.toBe("");
    expect(bad((m) => { delete m.assets[tricks].frameAdjust; })).toContain("sourceFrameSize");
  });

  it("la búsqueda es una sola secuencia que se reproduce una vez, en un lienzo más ancho (405 × 362)", () => {
    expect(manifest.assets[fetch].animations).toHaveLength(1);
    expect(manifest.assets[fetch].animations![0]).toMatchObject({ key: "vanessa-jerry-fetch-plush", repeat: 0, frameRate: 6 });
    expect(manifest.assets[fetch].sourceFrameSize).toEqual({ width: 405, height: 362 });
  });

  it("las claves de animación no chocan con las del reposo", () => {
    const keys = [...IDLE_IDS, ...TRICKS_IDS].flatMap((id) => manifest.assets[id].animations!.map((a) => a.key));
    expect(new Set(keys).size).toBe(keys.length);
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

  it("nombres que no coinciden con los fotogramas de las animaciones, o distinto número de regiones", () => {
    expect(issues(id, (a) => { a.frames["extra"] = a.frames["frame-00"]; delete a.frames["frame-07"]; }).join("|")).toContain("no coinciden con los fotogramas de las animaciones");
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
