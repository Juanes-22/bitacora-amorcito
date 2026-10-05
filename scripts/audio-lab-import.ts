// Aplica a ESTE proyecto un paquete de ajustes exportado por el laboratorio de sonidos («Exportar ajustes»). Hace lo mismo que
// «Guardar en el proyecto» (misma transacción, misma validación, copias previas y recuperación), sin servidor ni navegador. Uso:
//   npm run audio-lab:import -- ajustes.json               aplica el paquete
//   npm run audio-lab:import -- ajustes.json --dry-run     solo valida: no escribe nada
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePackage } from "../src/dev/audio-lab/draft";
import { saveAudioLab } from "./lib/audio-lab/save";
import { defaultPaths } from "./lib/tiled/run";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!file) {
  console.error("Uso: npm run audio-lab:import -- ajustes.json [--dry-run]");
  process.exit(2);
}

let text: string;
try {
  text = readFileSync(resolve(file), "utf8");
} catch (e) {
  console.error(`✖ no se pudo leer ${file}: ${(e as Error).message}`);
  process.exit(1);
}
const pkg = parsePackage(text);
if ("error" in pkg) {
  console.error(`✖ ${file}: ${pkg.error}.`);
  process.exit(1);
}

// El paquete puede venir de otra copia del proyecto: sus huellas (`base`) describen los archivos de allí, no estos. Se aplica sobre lo que
// hay aquí; si un emisor ya no existe, se crea; si un archivo ya está en el catálogo (mismo sha256), se reutiliza.
const result = await saveAudioLab(defaultPaths(), { version: 1, base: pkg.base, assets: pkg.assets, changes: pkg.changes }, { ignoreBase: true, dryRun });
if (!result.ok) {
  for (const e of result.errors) console.error(`✖ ${e}`);
  console.error(`\naudio-lab:import FALLÓ (${result.reason}). No se modificó nada.`);
  process.exit(1);
}
for (const line of result.saved) console.log(`✔ ${line}`);
for (const w of result.warnings) console.warn(`⚠ ${w}`);
console.log(`\naudio-lab:import OK${dryRun ? " (comprobación: no se escribió nada)" : ""}: ${pkg.changes.length} ajuste(s) y ${pkg.assets.length} archivo(s).`);
