// Reduce el peso de los PNG de la carpeta publicada (dist/assets): paleta de 256 colores con difuminado, pensada para arte de píxeles
// (≈ −55 %; a simple vista no se distingue). Los originales de public/assets no se tocan, así que los hashes de assets.json siguen
// valiendo; `npm run build:full` publica los originales sin recomprimir. Con `--lossless` solo recomprime sin cambiar un píxel (ahorra
// apenas un 3 %: estos PNG ya vienen bien comprimidos). Si `sharp` no está disponible, o un archivo falla o no alcanza la calidad
// mínima, se publica el original: nunca rompe el build. Uso: tsx scripts/tools/optimize-dist.ts [carpeta] [--lossless]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { optimizePng, type Mode, type Sharp } from "../lib/optimizePng";

const root = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "dist/assets";
const mode: Mode = process.argv.includes("--lossless") ? "lossless" : "light";
let sharp: Sharp;
try {
  sharp = ((await import("sharp")) as unknown as { default: Sharp }).default;
} catch {
  console.warn("⚠ sharp no está instalado: los PNG se publican sin recomprimir.");
  process.exit(0);
}

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".png") ? [join(dir, e.name)] : []));
let files: string[];
try {
  files = walk(root);
} catch {
  console.warn(`⚠ no existe ${root}: nada que recomprimir.`);
  process.exit(0);
}

let before = 0;
let after = 0;
let changed = 0;
const failed: string[] = [];
const queue = [...files];
const worker = async () => {
  for (let file = queue.pop(); file; file = queue.pop()) {
    try {
      const original = readFileSync(file);
      before += original.length;
      const smaller = await optimizePng(sharp, original, mode);
      if (smaller) {
        writeFileSync(file, smaller);
        after += smaller.length;
        changed++;
      } else after += original.length;
    } catch (e) {
      failed.push(`${file}: ${(e as Error).message}`);
    }
  }
};
await Promise.all([worker(), worker(), worker(), worker()]);
const mb = (n: number) => (n / 1e6).toFixed(1);
console.log(`• PNG recomprimidos (${mode === "light" ? "ligero, paleta de 256 colores" : "sin pérdida"}): ${changed} de ${files.length}; ${mb(before)} MB → ${mb(after)} MB (−${before ? Math.round((1 - after / before) * 100) : 0} %)`);
for (const f of failed) console.warn(`⚠ ${f} (se publica el original)`);
