// Migración única: separa `placements` y `maps` de public/config/bitacora.json en public/config/maps.json, conservando byte a byte el
// texto de esas dos regiones (su estilo escrito a mano). Herramienta de integración, fuera del build. Es idempotente: si maps.json ya
// existe, aborta. Uso:  npx tsx scripts/tools/split-maps.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { topLevelValueRange } from "../lib/tiled/jsonStyle";

const CONFIG = "public/config/bitacora.json";
const MAPS = "public/config/maps.json";
if (existsSync(MAPS)) {
  console.error(`${MAPS} ya existe: nada que hacer.`);
  process.exit(1);
}

let text = readFileSync(CONFIG, "utf8");
const region = (key: string) => {
  const r = topLevelValueRange(text, key);
  if (!r) throw new Error(`no se localizó «${key}» en ${CONFIG}`);
  return r;
};
const placements = region("placements");
const maps = region("maps");
const placementsText = text.slice(placements.start, placements.end);
const mapsText = text.slice(maps.start, maps.end);

// Quita de bitacora.json la línea de cada clave (de la última a la primera para no mover los desplazamientos).
const removals = [placements, maps].sort((a, b) => b.start - a.start);
for (const r of removals) {
  const keyStart = text.lastIndexOf('"', text.lastIndexOf(":", r.start) - 1 - 0);
  const open = text.lastIndexOf('"', keyStart - 1);
  const lineStart = text.lastIndexOf("\n", open) + 1;
  let i = r.end;
  while (/\s/.test(text[i])) i++;
  if (text[i] !== ",") throw new Error("se esperaba una coma tras el valor");
  i++;
  while (text[i] === " " || text[i] === "\t") i++;
  if (text[i] === "\r") i++;
  if (text[i] !== "\n") throw new Error("se esperaba un salto de línea tras la coma");
  text = text.slice(0, lineStart) + text.slice(i + 1);
}

writeFileSync(MAPS, `{\n  "$schema": "./maps.schema.json",\n  "placements": ${placementsText},\n  "maps": ${mapsText}\n}\n`);
writeFileSync(CONFIG, text);
console.log(`placements (${placementsText.length} caracteres) y maps (${mapsText.length}) movidos a ${MAPS}; ${CONFIG} ahora tiene ${text.length}.`);
