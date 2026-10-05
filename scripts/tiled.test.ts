import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { PNG } from "pngjs";
import { beforeAll, describe, expect, it } from "vitest";
import { navigationGrid } from "../src/config/reachability";
import type { AmbientEffect, AssetManifest, BitacoraConfig } from "../src/config/types";
import { buildCandidate, jsonEqual } from "./lib/tiled/apply";
import { buildTileset, catalogEntries, CLASS_ROLE, geometryOf, tileKey } from "./lib/tiled/catalog";
import { findTiled, runTiled } from "./lib/tiled/cli";
import { cellSizeFor, exportZone } from "./lib/tiled/export";
import { defaultPaths, readJsonFile, tilesetLoader, type Paths } from "./lib/tiled/files";
import { importMap, resolveProps, type ZoneImport } from "./lib/tiled/import";
import { formatValue, replaceTopLevel } from "./lib/tiled/jsonStyle";
import { renderFrame, resizeArea } from "./lib/tiled/preview";
import { classDefaults, mergeProject, projectTypes } from "./lib/tiled/project";
import { runGenerate, runImport } from "./lib/tiled/run";
import { tiledJson } from "./lib/tiled/tiledJson";
import type { TiledMap, TiledObject, TiledObjectLayer, TiledProject, TiledTileset } from "./lib/tiled/types";
import { classOf, decodeGid, encodeGid, propsOf } from "./lib/tiled/util";
import { startWatch } from "./lib/tiled/watch";

const real = defaultPaths();
const manifest = readJsonFile<AssetManifest>(real.manifestFile, "assets.json");
const config = readJsonFile<BitacoraConfig>(real.configFile, "bitacora.json");
const project = readJsonFile<TiledProject>(real.projectFile, "proyecto");
const tileset = readJsonFile<TiledTileset>(real.tilesetFile, "catálogo");
const clone = <T>(v: T): T => structuredClone(v);

const tileIds = new Map<string, number>();
for (const t of tileset.tiles ?? []) {
  const role = CLASS_ROLE[t.class ?? ""];
  const assetId = t.properties?.find((p) => p.name === "assetId")?.value;
  if (role && typeof assetId === "string") tileIds.set(tileKey(role, assetId), t.id);
}
const exportCtx = (c: BitacoraConfig, zoneId: string) => ({
  config: c, manifest, tileIds, firstgid: 1, tilesetSource: "../tilesets/catalogo.tsj", assetsBase: "../../../public/assets", cell: cellSizeFor(c.maps[zoneId].width, c.maps[zoneId].height),
});
const exportAll = (c: BitacoraConfig = config): Record<string, TiledMap> => Object.fromEntries(Object.keys(c.maps).map((z) => [z, exportZone(exportCtx(c, z), z)]));

/** Importa mapas en memoria (sin tocar archivos) con el catálogo y el proyecto reales. */
function importAll(maps: Record<string, TiledMap>, base: BitacoraConfig = config, loadTileset?: (s: string) => TiledTileset | undefined) {
  const zones: ZoneImport[] = [];
  const issues: string[] = [];
  for (const [zoneId, map] of Object.entries(maps)) {
    const file = join(real.mapsDir, `${zoneId}.tmj`);
    const r = importMap(file, map, { manifest, config: base, project, assetsDir: real.assetsDir, mapDir: real.mapsDir, loadTileset: loadTileset ?? tilesetLoader(file) });
    issues.push(...r.issues.map((i) => `${i.source.layer ?? ""}#${i.source.objectId ?? ""}@${i.source.property ?? ""}: ${i.message}`));
    if (r.result) zones.push(r.result);
  }
  const built = issues.length ? { candidate: undefined, issues: [] } : buildCandidate(base, zones);
  return { candidate: built.candidate, issues: [...issues, ...built.issues.map((i) => i.message)] };
}

const layerOf = (map: TiledMap, name: string) => map.layers.find((l) => l.name === name) as TiledObjectLayer;
const prop = (o: TiledObject, name: string) => o.properties?.find((p) => p.name === name);
const setProp = (o: TiledObject, name: string, value: unknown) => {
  const p = prop(o, name);
  if (p) p.value = value;
  else o.properties = [...(o.properties ?? []), { name, type: typeof value === "number" ? "float" : "string", value }];
};
const stationOf = (map: TiledMap, id: string) => layerOf(map, "estaciones").objects.find((o) => prop(o, "learningId")?.value === id) as TiledObject;
const nextId = (map: TiledMap) => Math.max(...map.layers.flatMap((l) => (l.type === "objectgroup" ? l.objects.map((o) => o.id) : [0]))) + 1;

describe("migración sin cambios (ida y vuelta)", () => {
  it("exportar e importar cada zona devuelve la configuración entera sin cambios", () => {
    const { candidate, issues } = importAll(exportAll());
    expect(issues).toEqual([]);
    expect(jsonEqual(candidate!.config, config)).toBe(true);
    expect(candidate!.managed).toEqual(Object.keys(config.maps));
  });

  it("conserva obstáculos, ambiente, animales, spawns y portales (cantidades de esta revisión, sin ser límites)", () => {
    const { candidate } = importAll(exportAll());
    const z = candidate!.config.maps;
    expect([z["zona-a"].obstacles.length, z["zona-b"].obstacles.length]).toEqual([342, 245]);
    expect([z["zona-a"].ambient.length, z["zona-b"].ambient.length]).toEqual([35, 36]);
    expect([z["zona-a"].critters?.length, z["zona-b"].critters?.length]).toEqual([10, 7]);
    expect(z["zona-a"].decorations).toEqual([]);
    expect(Object.keys(z["zona-a"].portals)).toEqual(["a-b"]);
    expect(z["zona-a"].obstacles).toEqual(config.maps["zona-a"].obstacles);
  });

  it("distingue un opcional omitido de su valor explícito (scale: 1, flipX, speedFactor)", () => {
    const { candidate } = importAll(exportAll());
    const a = candidate!.config.maps["zona-a"].ambient;
    const b = config.maps["zona-a"].ambient;
    a.forEach((fx, i) => expect(Object.keys(fx).sort()).toEqual(Object.keys(b[i]).sort()));
    expect(b.some((fx) => "scale" in fx && fx.scale === 1)).toBe(true); // el caso explícito existe en los datos
  });

  it("los archivos .tmj versionados coinciden con bitacora.json (lo que comprueba tiled:check en el build)", () => {
    const r = runImport(real, { apply: false });
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.inSync).toBe(true);
  }, 30000);

  it("la tolerancia numérica es de 1e-6 y las posiciones editadas conservan sus decimales", () => {
    const maps = exportAll();
    const s = stationOf(maps["zona-a"], "apr-a");
    s.x += 0.123456789;
    const { candidate } = importAll(maps);
    expect(candidate!.config.placements["apr-a"].position.x).toBeCloseTo(config.placements["apr-a"].position.x + 0.123456789, 8);
  });
});

describe("ediciones representativas", () => {
  it("mover apr-a cambia su posición y conserva el vínculo, el offset, el radio y el recorrido", () => {
    const maps = exportAll();
    const s = stationOf(maps["zona-a"], "apr-a");
    s.x += 30;
    s.y -= 12;
    const { candidate, issues } = importAll(maps);
    expect(issues).toEqual([]);
    const c = candidate!.config;
    expect(c.placements["apr-a"].position).toEqual({ x: config.placements["apr-a"].position.x + 30, y: config.placements["apr-a"].position.y - 12 });
    expect(c.placements["apr-a"].interactionOffset).toEqual(config.placements["apr-a"].interactionOffset);
    expect(c.placements["apr-a"].interactionRadius).toBe(70);
    expect(c.route).toEqual(config.route);
    expect(c.learnings).toEqual(config.learnings);
    expect(c.badges).toEqual(config.badges);
  });

  it("duplicar una gallina añade otra instancia con su animación y su comportamiento", () => {
    const maps = exportAll();
    const layer = layerOf(maps["zona-a"], "animales");
    const hen = clone(layer.objects[0]);
    hen.id = nextId(maps["zona-a"]);
    hen.x += 40;
    layer.objects.push(hen);
    const { candidate } = importAll(maps);
    const k = candidate!.config.maps["zona-a"].critters!;
    expect(k).toHaveLength(config.maps["zona-a"].critters!.length + 1);
    const orig = config.maps["zona-a"].critters![0];
    expect(k[k.length - 1]).toMatchObject({ type: orig.type, assetId: orig.assetId, radius: orig.radius, scale: orig.scale });
    expect(k[k.length - 1].position.x).toBeCloseTo(orig.position.x + 40, 6);
  });

  it("mover y escalar una planta animada: el tamaño visual y el anclaje coinciden con Phaser", () => {
    const maps = exportAll();
    const layer = layerOf(maps["zona-a"], "ambiente");
    const i = config.maps["zona-a"].ambient.findIndex((f) => f.type === "animation" && f.assetId.startsWith("animation.flora."));
    const o = layer.objects[i];
    const fx = config.maps["zona-a"].ambient[i];
    const entry = manifest.assets[fx.assetId];
    const g = geometryOf("ambient", entry, config.gameplay.signScale)!;
    const factor = 1.5;
    const w = o.width! * factor;
    const h = o.height! * factor;
    o.x = 500;
    o.y = 400;
    o.width = w;
    o.height = h;
    const { candidate, issues } = importAll(maps);
    expect(issues).toEqual([]);
    const got = candidate!.config.maps["zona-a"].ambient[i];
    if (got.type !== "animation") throw new Error("tipo");
    const prev = fx.scale ?? 1;
    expect(got.scale).toBeCloseTo(prev * factor, 8);
    // Phaser: la imagen mide lienzo × recommendedScale × scale y su origen está en `position`.
    const phaserW = g.logicalW * (entry.recommendedScale ?? 1) * (got.scale ?? 1);
    expect(phaserW).toBeCloseTo(w, 6);
    expect(got.position.x).toBeCloseTo(500 + g.origin.x * w, 6);
    expect(got.position.y).toBeCloseTo(400 + g.origin.y * h, 6);
  });

  it("el reflejo horizontal conserva el punto de anclaje y se traduce a flipX", () => {
    const maps = exportAll();
    const layer = layerOf(maps["zona-a"], "ambiente");
    const i = config.maps["zona-a"].ambient.findIndex((f) => f.type === "animation" && f.flipX === undefined);
    const o = layer.objects[i];
    o.gid = encodeGid(decodeGid(o.gid!).gid, true);
    const { candidate } = importAll(maps);
    const got = candidate!.config.maps["zona-a"].ambient[i];
    const orig = config.maps["zona-a"].ambient[i];
    expect(got).toMatchObject({ type: "animation", flipX: true });
    if (got.type === "animation" && orig.type === "animation") expect(got.position).toEqual(orig.position); // el reflejo no mueve el anclaje
  });

  it("eliminar un efecto quita la instancia, no el asset del catálogo", () => {
    const maps = exportAll();
    const layer = layerOf(maps["zona-b"], "ambiente");
    const removed = layer.objects.shift() as TiledObject;
    const assetId = prop(removed, "assetId")!.value as string;
    const { candidate } = importAll(maps);
    expect(candidate!.config.maps["zona-b"].ambient).toHaveLength(config.maps["zona-b"].ambient.length - 1);
    expect(manifest.assets[assetId]).toBeDefined();
    expect(tileIds.has(tileKey("ambient", assetId)) || assetId.startsWith("particle.") || assetId.includes("duck") || assetId.includes("duckling")).toBe(true);
  });

  it("cambiar una familia y su cantidad de pollitos", () => {
    const maps = exportAll();
    const o = layerOf(maps["zona-b"], "animales").objects.find((x) => prop(x, "critterType")?.value === "family") as TiledObject;
    setProp(o, "chicks", 6);
    setProp(o, "chickScale", 0.9);
    const { candidate } = importAll(maps);
    const fam = candidate!.config.maps["zona-b"].critters!.find((k) => k.type === "family")!;
    expect(fam).toMatchObject({ type: "family", chicks: 6, chickScale: 0.9, chickAssetId: "fauna.chick.black" });
  });

  it("editar el área de un emisor y la trayectoria de un pato", () => {
    const maps = exportAll();
    const layer = layerOf(maps["zona-a"], "ambiente");
    const emitter = layer.objects.find((o) => o.class === "Particles") as TiledObject;
    emitter.x += 10;
    emitter.width! += 20;
    const duck = layer.objects.find((o) => o.class === "Swim") as TiledObject;
    duck.polyline = [...duck.polyline!, { x: 200, y: 4 }];
    const { candidate } = importAll(maps);
    const fx = candidate!.config.maps["zona-a"].ambient;
    const iE = layer.objects.indexOf(emitter);
    const iD = layer.objects.indexOf(duck);
    const e = fx[iE];
    const d = fx[iD];
    if (e.type !== "particles" || d.type !== "swim") throw new Error("tipo");
    const oe = config.maps["zona-a"].ambient[iE];
    if (oe.type !== "particles") throw new Error("tipo");
    expect(e.area).toEqual({ ...oe.area, x: oe.area.x + 10, width: oe.area.width + 20 });
    expect(e.frequencyMs).toBe(oe.frequencyMs);
    expect(d.path).toHaveLength(3);
    expect(d.path[2]).toEqual({ x: duck.x + 200, y: duck.y + 4 });
  });

  it("cambiar un obstáculo cambia la rejilla de navegación por toque", () => {
    const maps = exportAll();
    const layer = layerOf(maps["zona-a"], "colisiones");
    const before = navigationGrid(config, "zona-a");
    // Un bloque nuevo en pleno camino transitable.
    const spawn = config.maps["zona-a"].spawns.inicio;
    layer.objects.push({ id: nextId(maps["zona-a"]), class: "Collision", x: spawn.x - 20, y: spawn.y - 40, width: 40, height: 40, rotation: 0, visible: true });
    layer.objects.push({ id: nextId(maps["zona-a"]) + 1, class: "Collision", x: 700, y: 700, width: 30, height: 30, ellipse: true, rotation: 0, visible: true });
    const { candidate } = importAll(maps);
    const z = candidate!.config.maps["zona-a"];
    expect(z.obstacles).toHaveLength(config.maps["zona-a"].obstacles.length + 2);
    expect(z.obstacles[z.obstacles.length - 1]).toEqual({ type: "circle", x: 715, y: 715, radius: 15 });
    const after = navigationGrid(candidate!.config, "zona-a");
    const at = (g: typeof before, x: number, y: number) => g.blocked[Math.floor(y / g.cell) * g.cols + Math.floor(x / g.cell)];
    expect(at(after, 715, 715)).toBe(1);
    expect(after.blocked.reduce((n, v) => n + v, 0)).toBeGreaterThan(before.blocked.reduce((n, v) => n + v, 0));
  });

  it("editar spawns y portales conserva la ida y el regreso", () => {
    const maps = exportAll();
    const pts = layerOf(maps["zona-a"], "puntos");
    const spawn = pts.objects.find((o) => prop(o, "spawnId")?.value === "desde-b") as TiledObject;
    spawn.x -= 15;
    const portal = layerOf(maps["zona-b"], "puntos").objects.find((o) => o.class === "Portal") as TiledObject;
    portal.width! += 10;
    portal.height! += 10;
    portal.x -= 5;
    portal.y -= 5;
    const { candidate } = importAll(maps);
    const c = candidate!.config.maps;
    expect(c["zona-a"].spawns["desde-b"].x).toBe(config.maps["zona-a"].spawns["desde-b"].x - 15);
    expect(c["zona-b"].portals["b-a"].interaction).toEqual({ ...config.maps["zona-b"].portals["b-a"].interaction, radius: config.maps["zona-b"].portals["b-a"].interaction.radius + 5 });
    expect(c["zona-b"].portals["b-a"].targetSpawnId).toBe("desde-b");
    expect(c["zona-a"].portals["a-b"].targetSpawnId).toBe("desde-a");
  });

  it("una modificación de los textos académicos de bitacora.json no se pierde al importar", () => {
    const edited = clone(config);
    edited.learnings["apr-a"].title = "Título editado a mano";
    edited.badges[edited.learnings["apr-a"].badgeId].xp = 150;
    const { candidate } = importAll(exportAll(config), edited);
    expect(candidate!.config.learnings["apr-a"].title).toBe("Título editado a mano");
    expect(candidate!.config.badges[edited.learnings["apr-a"].badgeId].xp).toBe(150);
  });
});

describe("propiedades heredadas, grupos y objetos nuevos", () => {
  it("un objeto recién insertado hereda la clase y el asset del tile y los valores por defecto de la clase", () => {
    const maps = exportAll();
    const sun = (tileset.tiles ?? []).find((t) => t.properties?.some((p) => p.value === "animation.flora.sunflowers") && t.class === "Ambient")!;
    const hen = (tileset.tiles ?? []).find((t) => t.properties?.some((p) => p.value === "fauna.hen.white") && t.class === "Critter")!;
    layerOf(maps["zona-a"], "ambiente").objects.push({ id: 9001, x: 100, y: 100, width: sun.imagewidth, height: sun.imageheight, gid: sun.id + 1, rotation: 0, visible: true });
    layerOf(maps["zona-a"], "animales").objects.push({ id: 9002, x: 200, y: 100, width: hen.imagewidth, height: hen.imageheight, gid: hen.id + 1, rotation: 0, visible: true });
    const { candidate, issues } = importAll(maps);
    expect(issues).toEqual([]);
    const z = candidate!.config.maps["zona-a"];
    const entry = manifest.assets["animation.flora.sunflowers"];
    const g = geometryOf("ambient", entry, 0.46)!;
    const added = z.ambient[z.ambient.length - 1] as Extract<AmbientEffect, { type: "animation" }>;
    expect(added).toMatchObject({ type: "animation", assetId: "animation.flora.sunflowers", depth: { mode: "y", offset: 0 } });
    expect(Object.keys(added).sort()).toEqual(["assetId", "depth", "position", "type"]); // tamaño nativo del catálogo = escala 1 (se omite)
    expect(added.position.x).toBeCloseTo(100 + g.origin.x * sun.imagewidth!, 6);
    expect(added.position.y).toBeCloseTo(100 + g.origin.y * sun.imageheight!, 6);
    expect(z.critters![z.critters!.length - 1]).toMatchObject({ type: "wander", assetId: "fauna.hen.white", radius: 24 });
  });

  it("acumula el desplazamiento de los grupos de capas", () => {
    const maps = exportAll();
    const m = maps["zona-a"];
    const layer = layerOf(m, "animales");
    m.layers = m.layers.filter((l) => l !== layer);
    m.layers.push({ id: 900, type: "group", name: "g", offsetx: 10, offsety: -4, layers: [{ ...layer, offsetx: 5, offsety: 2 }] });
    const { candidate } = importAll(maps);
    const [a, b] = [config.maps["zona-a"].critters![0], candidate!.config.maps["zona-a"].critters![0]];
    expect(b.position).toEqual({ x: a.position.x + 15, y: a.position.y - 2 });
  });

  it("ignora las guías marcadas EditorOnly y no las demás capas ocultas", () => {
    const maps = exportAll();
    const m = maps["zona-a"];
    m.layers.push({ id: 901, type: "objectgroup", name: "guia", class: "EditorOnly", objects: [{ id: 9100, x: 1, y: 1, class: "Lo-que-sea", rotation: 0, visible: true }] });
    layerOf(m, "colisiones").visible = false; // ocultar para trabajar no elimina los objetos
    const { candidate, issues } = importAll(maps);
    expect(issues).toEqual([]);
    expect(candidate!.config.maps["zona-a"].obstacles).toHaveLength(config.maps["zona-a"].obstacles.length);
  });

  it("la precedencia es clase < tile < objeto", () => {
    const maps = exportAll();
    const sun = (tileset.tiles ?? []).find((t) => t.properties?.some((p) => p.value === "animation.flora.sunflowers") && t.class === "Ambient")!;
    layerOf(maps["zona-a"], "ambiente").objects.push({ id: 9003, x: 100, y: 100, width: sun.imagewidth, height: sun.imageheight, gid: sun.id + 1, rotation: 0, visible: true, properties: [{ name: "depthMode", type: "string", value: "fixed" }, { name: "depth", type: "float", value: 77 }] });
    const { candidate } = importAll(maps);
    const z = candidate!.config.maps["zona-a"].ambient;
    expect(z[z.length - 1].depth).toEqual({ mode: "fixed", value: 77 });
  });

  it("acepta `type` además de `class` (versiones anteriores de Tiled)", () => {
    const maps = exportAll();
    for (const o of layerOf(maps["zona-a"], "colisiones").objects) {
      o.type = o.class;
      delete o.class;
    }
    const { candidate, issues } = importAll(maps);
    expect(issues).toEqual([]);
    expect(candidate!.config.maps["zona-a"].obstacles).toHaveLength(config.maps["zona-a"].obstacles.length);
  });

  it("un rectángulo sin clase en la capa de colisiones usa la clase por defecto de la capa", () => {
    const maps = exportAll();
    layerOf(maps["zona-a"], "colisiones").objects.push({ id: 9200, x: 10, y: 10, width: 8, height: 8, rotation: 0, visible: true });
    const { candidate } = importAll(maps);
    expect(candidate!.config.maps["zona-a"].obstacles.at(-1)).toEqual({ type: "rect", x: 10, y: 10, width: 8, height: 8 });
  });
});

describe("fallos que deben bloquear la importación", () => {
  const fails = (mutate: (maps: Record<string, TiledMap>) => void, expected: RegExp, loader?: (s: string) => TiledTileset | undefined) => {
    const maps = exportAll();
    mutate(maps);
    const { candidate, issues } = importAll(maps, config, loader);
    expect(candidate).toBeUndefined();
    expect(issues.join("\n")).toMatch(expected);
  };

  it("assetId desconocido", () => fails((m) => setProp(layerOf(m["zona-a"], "animales").objects[0], "assetId", "fauna.hen.no-existe"), /fauna\.hen\.no-existe/));
  it("estación duplicada", () => {
    fails((m) => {
      const dup = clone(stationOf(m["zona-b"], "apr-d"));
      dup.id = nextId(m["zona-b"]);
      layerOf(m["zona-a"], "estaciones").objects.push(dup);
    }, /apr-d.*aparece 2 veces/);
  });
  it("estación faltante: no se borra el aprendizaje, se indica archivarlo en route", () => {
    fails((m) => {
      const layer = layerOf(m["zona-a"], "estaciones");
      layer.objects = layer.objects.filter((o) => prop(o, "learningId")?.value !== "apr-b");
    }, /apr-b.*route/);
  });
  it("archivar un aprendizaje (quitarlo de route) y borrar su estación conserva su ubicación y no toca sus textos", () => {
    const archived = clone(config);
    archived.route = archived.route.filter((id) => id !== "apr-f");
    const maps = exportAll(config);
    const layer = layerOf(maps["zona-b"], "estaciones");
    layer.objects = layer.objects.filter((o) => prop(o, "learningId")?.value !== "apr-f");
    const { candidate, issues } = importAll(maps, archived);
    expect(issues).toEqual([]);
    expect(candidate!.config.placements["apr-f"]).toEqual(config.placements["apr-f"]);
    expect(candidate!.config.learnings["apr-f"]).toEqual(config.learnings["apr-f"]);
    // Y dejar la estación de un archivado en el mapa se rechaza.
    const again = importAll(exportAll(config), archived);
    expect(again.candidate).toBeUndefined();
    expect(again.issues.join("\n")).toMatch(/apr-f.*archivado/);
  });
  it("una estación de un aprendizaje inexistente o archivado", () => {
    fails((m) => setProp(stationOf(m["zona-a"], "apr-a"), "learningId", "apr-z"), /apr-z.*no existe/);
  });
  it("tile de un tileset externo ausente", () => fails(() => undefined, /no se pudo leer el tileset/, () => undefined));
  it("flags de transformación no admitidos (vertical y diagonal)", () => {
    fails((m) => {
      const o = layerOf(m["zona-a"], "ambiente").objects.find((x) => x.gid !== undefined) as TiledObject;
      o.gid = (o.gid! + 0x40000000) >>> 0;
    }, /reflejo vertical/);
    fails((m) => {
      const o = layerOf(m["zona-a"], "ambiente").objects.find((x) => x.gid !== undefined) as TiledObject;
      o.gid = (o.gid! + 0x20000000) >>> 0;
    }, /diagonal/);
  });
  it("flipX en un tipo que no tiene ese campo (una familia, un balanceo)", () => {
    fails((m) => {
      const o = layerOf(m["zona-b"], "animales").objects.find((x) => prop(x, "critterType")?.value === "family") as TiledObject;
      o.gid = encodeGid(decodeGid(o.gid!).gid, true);
    }, /una familia no admite reflejo.*Flip Horizontally/);
    fails((m) => {
      const layer = layerOf(m["zona-a"], "ambiente");
      const i = config.maps["zona-a"].ambient.findIndex((f) => f.type === "sway");
      layer.objects[i].gid = encodeGid(decodeGid(layer.objects[i].gid!).gid, true);
    }, /no admite reflejo horizontal/);
  });
  it("escala no uniforme", () => fails((m) => (layerOf(m["zona-a"], "animales").objects[0].width! *= 1.3), /no es uniforme/));
  it("redimensionar un letrero individualmente", () => fails((m) => (stationOf(m["zona-a"], "apr-a").width! *= 1.2), /gameplay\.signScale/));
  it("rotación libre", () => fails((m) => (layerOf(m["zona-a"], "ambiente").objects[0].rotation = 15), /rotación 15/));
  it("geometría de colisión no soportada (polígono y elipse no circular)", () => {
    fails((m) => layerOf(m["zona-a"], "colisiones").objects.push({ id: 9300, class: "Collision", x: 0, y: 0, polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 9 }], rotation: 0, visible: true }), /rectángulos sin rotación y círculos/);
    fails((m) => layerOf(m["zona-a"], "colisiones").objects.push({ id: 9301, class: "Collision", x: 0, y: 0, width: 20, height: 10, ellipse: true, rotation: 0, visible: true }), /solo se importa como círculo/);
  });
  it("capas del paisaje movidas, con opacidad o tinte", () => {
    fails((m) => (m["zona-a"].layers[0].offsetx = 12), /desplazamiento de \(12, 0\)/);
    fails((m) => (m["zona-a"].layers[0].opacity = 0.5), /opacidad/);
    fails((m) => (m["zona-a"].layers[0].tintcolor = "#ff0000"), /tinte/);
  });
  it("tipos incompatibles: un tile de otra clase y una partícula que no lo es", () => {
    fails((m) => (layerOf(m["zona-a"], "animales").objects[0].class = "Ambient"), /clase «Critter» pero el objeto es «Ambient»/);
    fails((m) => setProp(layerOf(m["zona-a"], "ambiente").objects.find((o) => o.class === "Particles") as TiledObject, "assetId", "animation.flora.daisies"), /no es una partícula/);
  });
  it("propiedades con tipo equivocado o faltantes", () => {
    fails((m) => setProp(layerOf(m["zona-a"], "animales").objects[0], "radius", "grande"), /debe ser un número/);
    fails((m) => (layerOf(m["zona-a"], "puntos").objects[0].properties = []), /falta la propiedad|no puede estar vacía/);
  });
  it("las plantillas de objetos no se admiten", () => fails((m) => (layerOf(m["zona-a"], "animales").objects[0].template = "x.tx"), /plantilla/));
  it("el error señala archivo, capa, objeto y propiedad", () => {
    const maps = exportAll();
    setProp(layerOf(maps["zona-a"], "animales").objects[0], "radius", "grande");
    const { issues } = importAll(maps);
    expect(issues[0]).toMatch(/^animales#\d+@radius:/);
  });
  it("una referencia cruzada rota se detecta en la validación del proyecto y se anota con el objeto", () => {
    const ws = workspace();
    const file = join(ws.paths.mapsDir, "zona-a.tmj");
    const map = JSON.parse(readFileSync(file, "utf8")) as TiledMap;
    setProp(layerOf(map, "puntos").objects.find((o) => o.class === "Portal") as TiledObject, "targetSpawnId", "no-existe");
    writeFileSync(file, tiledJson(map as never));
    const before = readFileSync(ws.paths.configFile, "utf8");
    const r = runImport(ws.paths, { apply: true });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/zona-a\.tmj › capa «puntos» › objeto #\d+ «a-b».*no-existe/);
    expect(readFileSync(ws.paths.configFile, "utf8")).toBe(before);
  }, 60000);
});

// -- Archivos reales en una copia de trabajo ---------------------------------------------------------------------------------

let pristine: { dir: string; paths: Paths };
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "tiled-pristine-"));
  const paths = pathsIn(dir);
  writeFileSync(paths.configFile, readFileSync(real.configFile));
  mkdirSync(paths.tiledDir, { recursive: true });
  runGenerate(paths, { catalogOnly: false, force: false });
  pristine = { dir, paths };
}, 120000);
function pathsIn(dir: string): Paths {
  const tiledDir = join(dir, "tiled");
  return {
    ...real,
    tiledDir,
    mapsDir: join(tiledDir, "maps"),
    tilesetsDir: join(tiledDir, "tilesets"),
    tilesetFile: join(tiledDir, "tilesets/catalogo.tsj"),
    previewsDir: join(tiledDir, "previews"),
    backupsDir: join(tiledDir, "backups"),
    projectFile: join(tiledDir, "bitacora.tiled-project"),
    configFile: join(dir, "bitacora.json"),
  };
}
let counter = 0;
function workspace(): { dir: string; paths: Paths } {
  const dir = mkdtempSync(join(tmpdir(), `tiled-ws-${counter++}-`));
  cpSync(pristine.dir, dir, { recursive: true });
  // Los mapas llevan rutas relativas a public/assets: se regeneran junto a la copia para que apunten al mismo sitio.
  return { dir, paths: pathsIn(dir) };
}

describe("archivos: generar, importar y escribir", () => {

  it("la primera generación crea catálogo, previews, proyecto y un mapa por zona, y no sobrescribe en la siguiente", () => {
    const { paths } = workspace();
    expect(existsSync(join(paths.mapsDir, "zona-a.tmj"))).toBe(true);
    expect(existsSync(join(paths.mapsDir, "zona-b.tmj"))).toBe(true);
    const marker = join(paths.mapsDir, "zona-a.tmj");
    writeFileSync(marker, `${readFileSync(marker, "utf8")}\n`);
    const again = runGenerate(paths, { catalogOnly: false, force: false });
    expect(again.skipped).toHaveLength(2);
    expect(readFileSync(marker, "utf8").endsWith("\n")).toBe(true); // intacto
    const forced = runGenerate(paths, { catalogOnly: false, force: true, zones: ["zona-a"] });
    expect(forced.backups).toHaveLength(1);
    expect(readFileSync(marker, "utf8").endsWith("\n")).toBe(false);
  }, 60000);

  it("importar sin cambios es idempotente: no escribe ni toca el archivo", () => {
    const { paths } = workspace();
    const before = readFileSync(paths.configFile, "utf8");
    const r = runImport(paths, { apply: true });
    expect(r.errors).toEqual([]);
    expect(r.inSync).toBe(true);
    expect(r.written).toBe(false);
    expect(readFileSync(paths.configFile, "utf8")).toBe(before);
  }, 60000);

  it("una edición válida se aplica con copia previa, solo cambia `maps`/`placements` y respeta el estilo del archivo", () => {
    const { paths } = workspace();
    const file = join(paths.mapsDir, "zona-a.tmj");
    const map = JSON.parse(readFileSync(file, "utf8")) as TiledMap;
    stationOf(map, "apr-b").x += 25;
    writeFileSync(file, tiledJson(map as never));
    const before = readFileSync(paths.configFile, "utf8");
    const r = runImport(paths, { apply: true });
    expect(r.errors).toEqual([]);
    expect(r.written).toBe(true);
    expect(r.changes).toEqual(["placements.apr-b: cambió position"]);
    expect(existsSync(r.backup as string)).toBe(true);
    const after = readFileSync(paths.configFile, "utf8");
    const a = before.split("\n");
    const b = after.split("\n");
    expect(b).toHaveLength(a.length);
    const diff = a.map((l, i) => [l, b[i]]).filter(([x, y]) => x !== y);
    expect(diff.filter(([x]) => !x.includes('"scale": 1.0'))).toHaveLength(1); // solo la x de apr-b (y la normalización de 1.0)
    const parsed = JSON.parse(after) as BitacoraConfig;
    expect(parsed.placements["apr-b"].position.x).toBe(config.placements["apr-b"].position.x + 25);
    expect(parsed.learnings).toEqual(config.learnings);
    expect(parsed.configRevision).toBe(config.configRevision);
    // Tras aplicar, el check queda en sincronía.
    expect(runImport(paths, { apply: false }).inSync).toBe(true);
  }, 60000);

  it("un error no modifica bitacora.json; un JSON incompleto se informa", () => {
    const { paths } = workspace();
    const file = join(paths.mapsDir, "zona-b.tmj");
    const before = readFileSync(paths.configFile, "utf8");
    writeFileSync(file, readFileSync(file, "utf8").slice(0, 400));
    const r = runImport(paths, { apply: true });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/zona-b\.tmj no es JSON válido/);
    expect(readFileSync(paths.configFile, "utf8")).toBe(before);
  }, 60000);

  it("un tileset externo ausente bloquea la importación sin escribir nada", () => {
    const { paths } = workspace();
    const before = readFileSync(paths.configFile, "utf8");
    writeFileSync(paths.tilesetFile, "{}");
    cpSync(paths.tilesetFile, `${paths.tilesetFile}.bak`);
    const map = JSON.parse(readFileSync(join(paths.mapsDir, "zona-a.tmj"), "utf8")) as TiledMap;
    map.tilesets[0].source = "../tilesets/no-existe.tsj";
    writeFileSync(join(paths.mapsDir, "zona-a.tmj"), tiledJson(map as never));
    const r = runImport(paths, { apply: true });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/no se pudo leer el tileset «..\/tilesets\/no-existe.tsj»/);
    expect(readFileSync(paths.configFile, "utf8")).toBe(before);
  }, 60000);

  it("una zona nueva se añade solo con su mapa, sin un listado fijo en el código", () => {
    const { paths } = workspace();
    const map = JSON.parse(readFileSync(join(paths.mapsDir, "zona-b.tmj"), "utf8")) as TiledMap;
    setProp({ properties: map.properties } as TiledObject, "zoneId", "zona-c");
    map.properties!.find((p) => p.name === "zoneId")!.value = "zona-c";
    for (const l of map.layers) if (l.type === "objectgroup") l.objects = l.objects.filter((o) => !["Station", "Portal"].includes(String(o.class)));
    writeFileSync(join(paths.mapsDir, "zona-c.tmj"), tiledJson(map as never));
    const r = runImport(paths, { apply: true });
    expect(r.errors).toEqual([]);
    expect(r.zones).toEqual(["zona-a", "zona-b", "zona-c"]);
    expect(r.changes).toContain("zona-c: zona nueva");
    const written = JSON.parse(readFileSync(paths.configFile, "utf8")) as BitacoraConfig;
    expect(Object.keys(written.maps)).toEqual(["zona-a", "zona-b", "zona-c"]);
    expect(written.maps["zona-c"].label).toBe(config.maps["zona-b"].label);
  }, 60000);

  it("los archivos .tmx antiguos se ignoran con un aviso (no se importan dos veces)", () => {
    const { paths } = workspace();
    writeFileSync(join(paths.mapsDir, "zona-a.tmx"), "<map/>");
    const r = runImport(paths, { apply: false });
    expect(r.ok).toBe(true);
    expect(r.warnings.join("\n")).toMatch(/zona-a\.tmx.*no se importa/);
  }, 60000);

  it("el observador agrupa los guardados, importa y sobrevive a los errores", async () => {
    const { paths } = workspace();
    const reports: Array<{ ok: boolean; written: boolean }> = [];
    const watcher = startWatch(paths, { debounceMs: 80, settleMs: 40, log: () => undefined, onReport: (r) => reports.push({ ok: r.ok, written: r.written }) });
    const file = join(paths.mapsDir, "zona-a.tmj");
    const map = JSON.parse(readFileSync(file, "utf8")) as TiledMap;
    /** Espera (con un tope generoso) a que se cumpla una condición: los tiempos del observador dependen de la carga de la máquina. */
    const until = async (cond: () => boolean, ms = 20000) => {
      const end = Date.now() + ms;
      while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
    };
    try {
      writeFileSync(file, "{ roto"); // un guardado incompleto no mata la sesión
      await until(() => reports.some((r) => !r.ok));
      stationOf(map, "apr-c").y += 10;
      writeFileSync(file, tiledJson(map as never));
      await until(() => reports.some((r) => r.ok && r.written));
    } finally {
      watcher.stop();
    }
    expect(reports.some((r) => !r.ok)).toBe(true);
    expect(reports.at(-1)).toEqual({ ok: true, written: true });
    expect((JSON.parse(readFileSync(paths.configFile, "utf8")) as BitacoraConfig).placements["apr-c"].position.y).toBe(config.placements["apr-c"].position.y + 10);
  }, 90000);
});

// -- Catálogo, previews y utilidades ---------------------------------------------------------------------------------------

describe("catálogo y previews", () => {
  it("solo ofrece objetos del mundo compatibles con el contrato (nada de UI ni música)", () => {
    const entries = catalogEntries(manifest, config);
    const ids = new Set(entries.map((e) => e.assetId));
    expect([...ids].some((id) => id.startsWith("ui.") || id.startsWith("audio."))).toBe(false);
    expect(entries.filter((e) => e.role === "critter").map((e) => e.assetId)).toContain("fauna.hen.white-fluffy");
    expect(entries.filter((e) => e.role === "ambient").map((e) => e.assetId)).toContain("animation.flora.sunflowers");
    expect(ids.has("animation.fauna.duckling-swim")).toBe(false); // los patos son polilíneas Swim
  });

  it("los IDs de tile no cambian al añadir o quitar assets", () => {
    const entries = catalogEntries(manifest, config);
    const first = buildTileset(entries).tileset;
    const idOf = (ts: TiledTileset, key: string) => ts.tiles!.find((t) => tileKey(CLASS_ROLE[t.class!], String(t.properties![0].value)) === key)!.id;
    const grown = clone(manifest);
    grown.assets["fauna.hen.nueva"] = { ...grown.assets["fauna.hen.white"], label: "nueva" };
    const withNew = buildTileset(catalogEntries(grown, config), first);
    expect(withNew.added).toEqual(["critter:fauna.hen.nueva"]);
    for (const t of first.tiles!) expect(idOf(withNew.tileset, tileKey(CLASS_ROLE[t.class!], String(t.properties![0].value)))).toBe(t.id);
    // Si desaparece un asset, su tile se conserva marcado «obsolete» y sus vecinos no se mueven.
    const shrunk = clone(manifest);
    delete shrunk.assets["fauna.hen.white"];
    const without = buildTileset(catalogEntries(shrunk, config), first);
    expect(without.obsolete).toEqual(["critter:fauna.hen.white"]);
    expect(without.tileset.tiles!.find((t) => t.properties?.some((p) => p.value === "fauna.hen.white"))!.properties).toContainEqual({ name: "obsolete", type: "bool", value: true });
    expect(idOf(without.tileset, "critter:fauna.hen.brown")).toBe(idOf(first, "critter:fauna.hen.brown"));
  });

  it("el tamaño del preview es el visual del juego (un objeto nuevo ya tiene el tamaño correcto)", () => {
    const hen = (tileset.tiles ?? []).find((t) => t.properties?.some((p) => p.value === "fauna.hen.white-fluffy"))!;
    expect([hen.imagewidth, hen.imageheight]).toEqual([48, 48]); // recommendedDisplay, no el lienzo de 448 ni la hoja de 1448×1086
    const sign = (tileset.tiles ?? []).find((t) => t.class === "Station" && t.properties?.some((p) => p.value === "station.sign.board"))!;
    expect([sign.imagewidth, sign.imageheight]).toEqual([Math.round(384 * 0.46), Math.round(320 * 0.46)]);
    const png = PNG.sync.read(readFileSync(join(real.previewsDir, String(hen.image).replace("../previews/", ""))));
    expect([png.width, png.height]).toEqual([48, 48]);
  });

  it("renderFrame reconstruye el lienzo lógico de un fotograma recortado y rechaza los rotados", () => {
    const sheet = new PNG({ width: 20, height: 10 });
    for (let y = 0; y < 10; y++) for (let x = 0; x < 20; x++) sheet.data.set([x * 10, y * 20, 7, 255], (y * 20 + x) * 4);
    const frame = { frame: { x: 4, y: 2, w: 6, h: 5 }, rotated: false, trimmed: true, spriteSourceSize: { x: 3, y: 1, w: 6, h: 5 }, sourceSize: { w: 12, h: 9 } };
    const out = renderFrame(sheet, frame);
    expect([out.width, out.height]).toEqual([12, 9]);
    const px = (x: number, y: number) => [...out.data.slice((y * 12 + x) * 4, (y * 12 + x) * 4 + 4)];
    expect(px(0, 0)[3]).toBe(0); // fuera del recorte: transparente
    expect(px(3, 1)).toEqual([40, 40, 7, 255]); // esquina del recorte = (4, 2) de la hoja
    expect(px(8, 5)).toEqual([90, 120, 7, 255]);
    expect(() => renderFrame(sheet, { ...frame, rotated: true })).toThrow(/rotado/);
    expect(() => renderFrame(sheet, { frame: { x: 18, y: 0, w: 6, h: 5 } })).toThrow(/fuera de la hoja/);
  });

  it("resizeArea promedia con alfa premultiplicado (los bordes transparentes no manchan el color)", () => {
    const src = new PNG({ width: 2, height: 1 });
    src.data.set([255, 0, 0, 255, 0, 255, 0, 0], 0); // rojo opaco + verde totalmente transparente
    const out = resizeArea(src, 1, 1);
    expect([...out.data]).toEqual([255, 0, 0, 128]);
  });

  it("los tipos del proyecto salen del manifiesto y se fusionan sin perder los del usuario", () => {
    const t = projectTypes(manifest);
    expect(t.enums.find((e) => e.name === "ParticleAsset")!.values).toContain("particle.petal");
    expect(t.enums.find((e) => e.name === "SwimAsset")!.values).toEqual(["animation.fauna.duckling-swim", "animation.fauna.white-duck-swim"]);
    const mine: TiledProject = { ...project, propertyTypes: [...(project.propertyTypes ?? []), { id: 99, name: "MiClase", type: "class", color: "#fff", members: [], useAs: ["object"] }] };
    const merged = mergeProject(mine, manifest);
    expect(merged.propertyTypes!.find((p) => p.name === "MiClase")!.id).toBe(99);
    const station = (a: TiledProject) => a.propertyTypes!.find((p) => p.name === "Station")!.id;
    expect(station(merged)).toBe(station(project)); // los IDs de lo gestionado se conservan
    expect(merged.folders).toEqual(project.folders);
  });
});

describe("utilidades", () => {
  it("separa el GID real de sus banderas", () => {
    expect(decodeGid(5)).toEqual({ gid: 5, flipH: false, flipV: false, flipD: false, rotHex120: false });
    expect(decodeGid(encodeGid(5, true))).toMatchObject({ gid: 5, flipH: true });
    expect(decodeGid(0x80000000 + 0x40000000 + 0x20000000 + 7)).toEqual({ gid: 7, flipH: true, flipV: true, flipD: true, rotHex120: false });
    expect(decodeGid(0x10000000 + 9)).toMatchObject({ gid: 9, rotHex120: true });
  });

  it("reescribe solo `maps` y `placements` y deja el resto del archivo byte a byte igual", () => {
    const text = readFileSync(real.configFile, "utf8");
    const out = replaceTopLevel(text, { placements: config.placements, maps: config.maps })!;
    const a = text.split("\n");
    const b = out.split("\n");
    expect(b).toHaveLength(a.length);
    expect(a.map((l, i) => [l, b[i]]).filter(([x, y]) => x !== y).every(([x]) => x.includes('"scale": 1.0'))).toBe(true);
    const moved = clone(config);
    moved.placements["apr-a"].position.x = 345;
    const edited = replaceTopLevel(text, { placements: moved.placements, maps: moved.maps })!;
    expect(JSON.parse(edited).placements["apr-a"].position.x).toBe(345);
    expect(JSON.parse(edited).editorNotes).toBe(config.editorNotes);
    expect(replaceTopLevel("{}", { maps: {} })).toBeNull();
  });

  it("formatValue sigue las reglas del archivo (planos en línea, el resto indentado)", () => {
    expect(formatValue({ a: 1, b: { x: 1, y: 2 } }, 0)).toBe('{\n  "a": 1,\n  "b": {"x": 1, "y": 2}\n}');
    expect(formatValue([1, 2], 0)).toBe("[1, 2]");
    expect(formatValue({ critters: [{ type: "wander", position: { x: 1, y: 2 } }] }, 0)).toBe('{\n  "critters": [\n    {"type": "wander", "position": {"x": 1, "y": 2}}\n  ]\n}');
  });

  it("tiledJson escribe como Tiled (claves ordenadas, sangrías propias)", () => {
    const text = tiledJson({ version: "1.10", layers: [{ id: 1, name: "a" }], grid: { width: 1 } });
    expect(text).toBe('{ "grid":\n    {\n     "width":1\n    },\n "layers":[\n        {\n         "id":1,\n         "name":"a"\n        }],\n "version":"1.10"\n}');
    expect(relative(real.root, dirname(real.mapsDir))).toBe("tools/tiled");
  });
});

// -- Con la CLI de Tiled (solo si está instalada; la integración no la necesita) ------------------------------------------------

const tiledBin = findTiled();
describe.skipIf(!tiledBin)("con la CLI de Tiled", () => {
  it("Tiled abre y vuelve a guardar los mapas y la importación sigue dando lo mismo (como si el usuario guardara en el editor)", () => {
    const { paths } = workspace();
    for (const zone of Object.keys(config.maps)) {
      const file = join(paths.mapsDir, `${zone}.tmj`);
      const tmp = join(paths.mapsDir, `${zone}.resaved.tmj`);
      const r = runTiled(tiledBin as string, ["--export-map", "json", "--project", paths.projectFile, file, tmp]);
      expect(r.ok, r.output).toBe(true);
      renameSync(tmp, file);
    }
    const r = runImport(paths, { apply: false });
    expect(r.errors).toEqual([]);
    expect(r.inSync).toBe(true);
  }, 120000);

  it("la resolución de propiedades (clase < tile < objeto) coincide con la de Tiled", () => {
    const { paths } = workspace();
    const file = join(paths.mapsDir, "zona-a.tmj");
    const map = JSON.parse(readFileSync(file, "utf8")) as TiledMap;
    const local = readJsonFile<TiledTileset>(paths.tilesetFile, "catálogo");
    const sun = (local.tiles ?? []).find((t) => t.properties?.some((p) => p.value === "animation.flora.sunflowers") && t.class === "Ambient")!;
    const hen = (local.tiles ?? []).find((t) => t.properties?.some((p) => p.value === "fauna.hen.white") && t.class === "Critter")!;
    const extra: TiledObject[] = [
      { id: 9001, x: 100, y: 100, width: 50, height: 62, gid: sun.id + 1, rotation: 0, visible: true },
      { id: 9002, x: 200, y: 100, width: 48, height: 48, gid: hen.id + 1, rotation: 0, visible: true, properties: [{ name: "radius", type: "float", value: 33 }] },
      { id: 9003, x: 300, y: 100, width: 40, height: 40, class: "Particles", rotation: 0, visible: true },
    ];
    layerOf(map, "ambiente").objects.push(...extra);
    writeFileSync(file, tiledJson(map as never));
    const out = join(paths.mapsDir, "resolved.tmj");
    const r = runTiled(tiledBin as string, ["--export-map", "json", "--resolve-types-and-properties", "--project", paths.projectFile, file, out]);
    expect(r.ok, r.output).toBe(true);
    const resolved = JSON.parse(readFileSync(out, "utf8")) as TiledMap;
    const defaults = classDefaults(project);
    const byId = new Map((layerOf(resolved, "ambiente").objects as TiledObject[]).map((o) => [o.id, o]));
    for (const o of extra) {
      const tile = o.gid ? (local.tiles ?? []).find((t) => t.id === o.gid! - 1) : undefined;
      const mine = resolveProps(defaults, classOf(o) || (tile ? classOf(tile) : ""), tile ? propsOf(tile.properties) : undefined, propsOf(o.properties));
      const theirs = propsOf(byId.get(o.id)!.properties);
      expect([...mine.keys()].sort(), `objeto ${o.id}`).toEqual([...theirs.keys()].sort());
      for (const [k, v] of mine) expect(theirs.get(k)!.value, `objeto ${o.id} › ${k}`).toEqual(v.value);
    }
  }, 120000);
});
