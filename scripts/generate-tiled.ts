// Migración inicial y catálogo del editor de mapas (Tiled). Uso:
//   npm run tiled:generate                       crea los mapas que aún no existen (y actualiza el catálogo y los previews)
//   npm run tiled:generate -- --force [--zone Z]  regenera mapas que ya existen, con copia previa en tools/tiled/backups
//   npm run tiled:catalog                        actualiza solo el catálogo, los previews y el proyecto
import { defaultPaths, runGenerate } from "./lib/tiled/run";

const args = process.argv.slice(2);
const zones: string[] = [];
args.forEach((a, i) => {
  if (a === "--zone" && args[i + 1]) zones.push(args[i + 1]);
});
const catalogOnly = args.includes("--catalog");
try {
  const r = runGenerate(defaultPaths(), { catalogOnly, force: args.includes("--force"), zones: zones.length ? zones : undefined });
  console.log(`• catálogo: ${r.tileCount} tiles${r.addedTiles.length ? ` (${r.addedTiles.length} nuevos: ${r.addedTiles.join(", ")})` : ""}, ${r.previews} preview(s) escritos`);
  if (r.obsoleteTiles.length) console.warn(`⚠ ${r.obsoleteTiles.length} tile(s) de assets que ya no son colocables se conservan marcados «obsolete»: ${r.obsoleteTiles.join(", ")}`);
  for (const f of r.written) console.log(`✔ escrito ${f}`);
  for (const f of r.skipped) console.log(`• ya existe ${f}: no se toca (usa --force para regenerarlo; se guarda una copia antes)`);
  for (const b of r.backups) console.log(`• copia recuperable de lo que había en ${b}`);
  for (const w of r.warnings) console.warn(`⚠ ${w}`);
  if (!catalogOnly && r.written.length === 0 && r.skipped.length === 0) console.log("• nada que generar");
} catch (e) {
  console.error(`✖ ${(e as Error).message}`);
  process.exit(1);
}
