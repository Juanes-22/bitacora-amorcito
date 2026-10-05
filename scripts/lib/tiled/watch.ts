import { existsSync, readdirSync, statSync, watch, type FSWatcher } from "node:fs";
import { dirname, join } from "node:path";
import { runImport, type ImportReport, type Paths } from "./run";

export interface WatchOptions {
  /** Silencio tras el último evento antes de importar (los guardados de Tiled llegan en ráfagas). */
  debounceMs?: number;
  /** Intervalo con el que se comprueba que el guardado terminó (tamaño y fecha estables). */
  settleMs?: number;
  /** Cada cuánto se comprueba por sondeo si cambió algo sin que llegara un evento del sistema de archivos. */
  pollMs?: number;
  log?: (line: string) => void;
  /** Se llama con el informe de cada importación (para pruebas y para el modo desarrollo). */
  onReport?: (report: ImportReport) => void;
}

const WATCHED = /\.(tmj|tsj|tiled-project)$/;

/** Firma de los archivos vigilados: cambia mientras alguien (Tiled) sigue escribiéndolos. */
function signature(paths: Paths): string {
  const parts: string[] = [];
  const add = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      if (!WATCHED.test(name)) continue;
      const s = statSync(join(dir, name));
      parts.push(`${name}:${s.size}:${s.mtimeMs}`);
    }
  };
  add(paths.mapsDir);
  add(paths.tilesetsDir);
  add(dirname(paths.projectFile));
  return parts.join("|");
}

/**
 * Observa los mapas, tilesets y el proyecto de Tiled y, tras cada guardado completo, importa y valida. Agrupa los eventos
 * consecutivos, espera a que los archivos dejen de cambiar y no vigila bitacora.json (así no se produce ningún bucle).
 * Un error se informa y la sesión sigue: el siguiente guardado vuelve a intentarlo.
 */
export function startWatch(paths: Paths, options: WatchOptions = {}): { stop(): void; run(): Promise<ImportReport> } {
  const { debounceMs = 400, settleMs = 150, pollMs = 1500 } = options;
  const log = options.log ?? ((line: string) => console.log(line));
  const watchers: FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let again = false;
  let stopped = false;
  /** Firma de los archivos en la última importación: si cambia sin que haya llegado un evento, el sondeo la detecta. */
  let lastSignature = signature(paths);

  const once = async (): Promise<ImportReport> => {
    // Espera a que el guardado termine: la firma de los archivos debe repetirse.
    let previous = signature(paths);
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, settleMs));
      const now = signature(paths);
      if (now === previous) break;
      previous = now;
    }
    lastSignature = previous;
    const stamp = new Date().toLocaleTimeString("es");
    let report: ImportReport;
    try {
      report = runImport(paths, { apply: true });
    } catch (e) {
      report = { ok: false, inSync: false, written: false, errors: [(e as Error).message], warnings: [], changes: [], zones: [], info: [] };
    }
    if (!report.ok) {
      log(`[${stamp}] ✖ ${report.errors.length} error(es); bitacora.json no se modificó:`);
      for (const e of report.errors) log(`  ✖ ${e}`);
    } else if (report.written) {
      log(`[${stamp}] ✔ bitacora.json actualizado (${report.zones.join(", ")}): ${report.changes.length} cambio(s). Recarga la página para verlo.`);
      for (const c of report.changes) log(`  • ${c}`);
    } else {
      log(`[${stamp}] • sin cambios: los mapas coinciden con bitacora.json.`);
    }
    options.onReport?.(report);
    return report;
  };

  const run = async (): Promise<ImportReport> => {
    if (running) {
      again = true;
      return once();
    }
    running = true;
    try {
      let report = await once();
      while (again && !stopped) {
        again = false;
        report = await once();
      }
      return report;
    } finally {
      running = false;
    }
  };

  const schedule = (name: string | null) => {
    if (stopped || (name !== null && !WATCHED.test(name))) return;
    clearTimeout(timer);
    timer = setTimeout(() => void run(), debounceMs);
  };

  for (const dir of [paths.mapsDir, paths.tilesetsDir, dirname(paths.projectFile)]) {
    if (!existsSync(dir)) continue;
    try {
      watchers.push(watch(dir, (_event, name) => schedule(name ? String(name) : null)));
    } catch (e) {
      log(`⚠ no se pudo vigilar ${dir}: ${(e as Error).message}`);
    }
  }
  // Red de seguridad: `fs.watch` puede perder un evento (justo al arrancar, o con ciertos editores y sistemas de archivos). Cada
  // pocos segundos se compara la firma de los archivos y, si cambió, se importa igual.
  const poll = setInterval(() => {
    if (!stopped && !running && signature(paths) !== lastSignature) schedule(null);
  }, pollMs);
  poll.unref();
  return {
    run,
    stop() {
      stopped = true;
      clearTimeout(timer);
      clearInterval(poll);
      watchers.forEach((w) => w.close());
    },
  };
}
