import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

/**
 * Localiza la CLI de Tiled sin depender de una ruta personal: la variable de entorno `TILED_BIN`, después el PATH (`tiled`,
 * `Tiled`, `tiled.exe`) y por último las ubicaciones habituales de cada sistema. `null` si no está instalada: la integración
 * (importar, comprobar, observar) nunca la necesita; solo sirve para verificar que Tiled abre los archivos.
 */
export function findTiled(env: NodeJS.ProcessEnv = process.env): string | null {
  const candidates: string[] = [];
  if (env.TILED_BIN) candidates.push(env.TILED_BIN);
  for (const dir of (env.PATH ?? "").split(delimiter)) for (const name of ["tiled", "Tiled", "tiled.exe"]) candidates.push(join(dir, name));
  candidates.push(
    "/Applications/Tiled.app/Contents/MacOS/tiled",
    "/usr/bin/tiled",
    "/usr/local/bin/tiled",
    "/opt/tiled/bin/tiled",
    "C:\\Program Files\\Tiled\\tiled.exe",
    "C:\\Program Files (x86)\\Tiled\\tiled.exe",
  );
  return candidates.find((c) => c && existsSync(c)) ?? null;
}

export interface CliResult {
  ok: boolean;
  output: string;
}

/** Ejecuta la CLI de Tiled (sin interfaz) con los argumentos dados. */
export function runTiled(bin: string, args: string[]): CliResult {
  const r = spawnSync(bin, args, { encoding: "utf8", timeout: 120000, env: { ...process.env, QT_QPA_PLATFORM: process.env.QT_QPA_PLATFORM ?? "" } });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}
