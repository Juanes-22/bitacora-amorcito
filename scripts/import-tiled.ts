// Importa las ediciones de Tiled a bitacora.json (solo `maps` y `placements`). Uso:
//   npm run tiled:import           lee, valida y aplica los cambios
//   npm run tiled:check            valida y detecta desincronización SIN escribir (código de salida 1 si hay errores o cambios pendientes)
import { defaultPaths, runImport } from "./lib/tiled/run";

const check = process.argv.includes("--check");
const r = runImport(defaultPaths(), { apply: !check });
for (const line of r.info) console.log(`• ${line}`);
for (const w of r.warnings) console.warn(`⚠ ${w}`);
if (!r.ok) {
  for (const e of r.errors) console.error(`✖ ${e}`);
  console.error(`\n${check ? "tiled:check" : "tiled:import"} FALLÓ con ${r.errors.length} error(es). bitacora.json no se modificó.`);
  process.exit(1);
}
if (r.inSync) {
  console.log(`\n${check ? "tiled:check" : "tiled:import"} OK: los mapas de Tiled (${r.zones.join(", ")}) coinciden con bitacora.json.`);
} else if (check) {
  for (const c of r.changes) console.error(`✖ pendiente: ${c}`);
  console.error("\ntiled:check: los mapas de Tiled no coinciden con bitacora.json. Ejecuta npm run tiled:import para aplicarlos.");
  process.exit(1);
} else {
  for (const c of r.changes) console.log(`✔ ${c}`);
  if (r.backup) console.log(`• copia del bitacora.json anterior en ${r.backup}`);
  console.log(`\ntiled:import OK: bitacora.json actualizado (${r.zones.join(", ")}). Recarga la página para verlo.`);
}
