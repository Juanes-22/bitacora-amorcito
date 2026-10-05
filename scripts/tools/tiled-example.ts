// Ejemplo reproducible de la integración con Tiled, sin tocar los archivos del repositorio: copia el proyecto a una carpeta
// temporal, aplica sobre sus mapas tres ediciones reales (mover la estación apr-a, duplicar una gallina y agrandar una
// planta), ejecuta el importador y escribe el bitacora.json resultante. Lo usa scripts/e2e/tiled.mjs para ver la edición en el juego.
// Uso: npx tsx scripts/tools/tiled-example.ts [directorio-de-salida]
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultPaths, readJsonFile } from "../lib/tiled/files";
import { runGenerate, runImport } from "../lib/tiled/run";
import { tiledJson } from "../lib/tiled/tiledJson";
import type { TiledMap, TiledObjectLayer } from "../lib/tiled/types";

const real = defaultPaths();
const dir = process.argv[2] ?? mkdtempSync(join(tmpdir(), "tiled-example-"));
mkdirSync(dir, { recursive: true });
const tiledDir = join(dir, "tiled");
const paths = {
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
cpSync(real.configFile, paths.configFile);
cpSync(real.projectFile, paths.projectFile);
cpSync(real.tilesetsDir, paths.tilesetsDir, { recursive: true });
cpSync(real.previewsDir, paths.previewsDir, { recursive: true });
runGenerate(paths, { catalogOnly: false, force: false }); // los mapas se crean junto a la copia, con sus rutas relativas a public/assets

const file = join(paths.mapsDir, "zona-a.tmj");
const map = readJsonFile<TiledMap>(file, "zona-a.tmj");
const layer = (name: string) => map.layers.find((l) => l.name === name) as TiledObjectLayer;
const prop = (o: { properties?: Array<{ name: string; value: unknown }> }, n: string) => o.properties?.find((p) => p.name === n)?.value;

// 1) Mover la estación apr-a 60 px a la derecha.
const station = layer("estaciones").objects.find((o) => prop(o, "learningId") === "apr-a");
if (!station) throw new Error("no se encontró la estación apr-a");
station.x += 60;
// 2) Duplicar la primera gallina (copiar y pegar en Tiled) y moverla 50 px.
const animals = layer("animales");
const hen = structuredClone(animals.objects[0]);
hen.id = map.nextobjectid ?? 9000;
hen.x += 50;
animals.objects.push(hen);
// 3) Agrandar un girasol un 50 % (redimensionar con Mayús, proporcional).
const flower = layer("ambiente").objects.find((o) => prop(o, "assetId") === "animation.flora.sunflowers");
if (!flower) throw new Error("no se encontró un girasol animado en zona-a");
flower.width = (flower.width as number) * 1.5;
flower.height = (flower.height as number) * 1.5;
// 4) Una colisión nueva (un rectángulo de 40 × 40 en una esquina del mapa).
layer("colisiones").objects.push({ id: hen.id + 1, class: "Collision", x: 20, y: 700, width: 40, height: 40, rotation: 0, visible: true });
writeFileSync(file, tiledJson(map as unknown as Record<string, unknown>));

const report = runImport(paths, { apply: true });
if (!report.ok) {
  console.error(report.errors.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ config: paths.configFile, changes: report.changes, original: JSON.parse(readFileSync(real.configFile, "utf8")).placements["apr-a"].position }));
