// Verifica con la CLI de Tiled (opcional) que el editor abre los mapas y el catálogo generados. Uso: npm run tiled:cli-check
// La CLI se busca en TILED_BIN, el PATH y las ubicaciones habituales; si no está, se informa y se sale sin error.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { findTiled, runTiled } from "../lib/tiled/cli";
import { defaultPaths, listMapFiles } from "../lib/tiled/files";

const bin = findTiled();
if (!bin) {
  console.log("• Tiled no está instalado (o indica su ruta con TILED_BIN): no hay nada que verificar con la CLI. La importación no la necesita.");
  process.exit(0);
}
const paths = defaultPaths();
const out = mkdtempSync(join(tmpdir(), "tiled-cli-"));
let failed = 0;
const check = (label: string, args: string[]) => {
  const r = runTiled(bin, args);
  console.log(`${r.ok ? "✔" : "✖"} ${label}`);
  if (!r.ok) {
    failed++;
    console.error(r.output);
  }
};
check("catálogo (catalogo.tsj)", ["--export-tileset", "json", paths.tilesetFile, join(out, "catalogo.tsj")]);
for (const map of listMapFiles(paths).maps) check(`mapa ${basename(map)}`, ["--export-map", "json", "--project", paths.projectFile, "--resolve-types-and-properties", map, join(out, basename(map))]);
console.log(`\nCLI: ${bin}`);
process.exit(failed ? 1 : 0);
