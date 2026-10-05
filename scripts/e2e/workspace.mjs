// Una copia de trabajo del proyecto para las pruebas que GUARDAN en disco (laboratorio de sonidos, importaciones): copia lo que se
// escribe (configuración, catálogo, sonidos, mapas de Tiled, código) y enlaza lo pesado (imágenes, música, node_modules). Así una prueba
// puede modificar «el proyecto» sin tocar ningún archivo del repositorio.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Lo que se COPIA (rutas relativas al proyecto); todo lo demás de `public/assets` se enlaza. */
const COPIED = ["public/config", "public/assets/assets.json", "public/assets/audio/sfx", "src", "scripts", "tools/tiled"];
const FILES = ["index.html", "package.json", "tsconfig.json", "tsconfig.node.json", "vite.config.ts"];
const SKIP = new Set(["tools/tiled/backups", "tools/tiled/previews", "tools/tiled/bitacora.tiled-session", "tools/tiled/.audio-lab.lock"]);

function mirror(source, target, rel = "") {
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(source)) {
    const r = rel ? `${rel}/${name}` : name;
    const from = join(source, name);
    const to = join(target, name);
    if (SKIP.has(r)) continue;
    if (COPIED.includes(r)) cpSync(from, to, { recursive: true, filter: (f) => !SKIP.has(resolve(f).slice(resolve(source).length - rel.length)) });
    else if (COPIED.some((c) => c.startsWith(`${r}/`))) mirror(from, to, r);
    else symlinkSync(from, to);
  }
}

/** Crea la copia y devuelve su carpeta y cómo borrarla. */
export function makeWorkspace(project = process.cwd()) {
  const root = mkdtempSync(join(tmpdir(), "bitacora-lab-"));
  for (const f of FILES) if (existsSync(join(project, f))) cpSync(join(project, f), join(root, f));
  mirror(join(project, "public"), join(root, "public"), "public");
  mirror(join(project, "tools"), join(root, "tools"), "tools");
  for (const dir of ["src", "scripts"]) cpSync(join(project, dir), join(root, dir), { recursive: true });
  symlinkSync(join(project, "node_modules"), join(root, "node_modules"));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
