import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateProject } from "./lib/validateProject";

// Uso: npm run validate:config [-- --config ruta/bitacora.json --assets ruta/assets.json]
//      npm run validate:release   (además exige que no quede ningún bloqueo de publicación)
const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return resolve(i >= 0 && args[i + 1] ? args[i + 1] : fallback);
};
const configPath = opt("--config", "public/config/bitacora.json");
const assetsPath = opt("--assets", "public/assets/assets.json");

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`✖ No se pudo leer ${path}: ${(e as Error).message}`);
    process.exit(1);
  }
}

const release = args.includes("--release");
const report = validateProject(readJson(assetsPath), readJson(configPath), assetsPath, { release });
for (const line of report.info) console.log(`• ${line}`);
for (const w of report.warnings) console.warn(`⚠ ${w.path}: ${w.message}`);
for (const e of report.errors) console.error(`✖ ${e.path}: ${e.message}`);
if (report.errors.length) {
  console.error(`\n${release ? "validate:release" : "validate:config"} FALLÓ con ${report.errors.length} error(es) y ${report.warnings.length} aviso(s).`);
  process.exit(1);
}
console.log(`\n${release ? "validate:release" : "validate:config"} OK (${report.warnings.length} aviso(s)).`);
