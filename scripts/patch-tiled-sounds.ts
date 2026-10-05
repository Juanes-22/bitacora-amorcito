// Añade la capa de objetos `sonidos` (vacía) a los mapas de Tiled que aún no la tienen, sin tocar nada más del mapa: se conservan los
// ids, las propiedades y las posiciones. Deja una copia de cada mapa que modifica. Uso:  npm run tiled:sounds
import { readFileSync } from "node:fs";
import { basename, relative } from "node:path";
import { ensureSoundLayer } from "./lib/audio-lab/tmj";
import { backupMaps, defaultPaths, listMapFiles, writeAtomic } from "./lib/tiled/files";
import { tiledJson, usesUnicodeEscapes } from "./lib/tiled/tiledJson";
import type { TiledMap } from "./lib/tiled/types";

const paths = defaultPaths();
const { maps } = listMapFiles(paths);
if (maps.length === 0) {
  console.error(`✖ no hay mapas .tmj en ${relative(paths.root, paths.mapsDir)}: ejecuta npm run tiled:generate`);
  process.exit(1);
}
const changes: Array<{ file: string; map: TiledMap; style: boolean }> = [];
for (const file of maps) {
  const text = readFileSync(file, "utf8");
  const map = JSON.parse(text) as TiledMap;
  if (ensureSoundLayer(map).added) changes.push({ file, map, style: usesUnicodeEscapes(text) });
  else console.log(`• ${basename(file)}: ya tiene la capa «sonidos»`);
}
if (changes.length === 0) {
  console.log("\ntiled:sounds: nada que hacer.");
} else {
  const backup = backupMaps(paths, changes.map((c) => c.file));
  for (const c of changes) {
    writeAtomic(c.file, tiledJson(c.map as unknown as Record<string, unknown>, { asciiOnly: c.style }));
    console.log(`✔ ${basename(c.file)}: añadida la capa «sonidos»`);
  }
  console.log(`• copia recuperable de lo que había en ${relative(paths.root, backup)}\n\ntiled:sounds OK. Si tienes los mapas abiertos en Tiled, vuelve a cargarlos desde el disco (Archivo › Recargar) antes de seguir editando.`);
}
