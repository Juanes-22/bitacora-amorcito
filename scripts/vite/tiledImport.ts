import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ViteDevServer } from "vite";
import { defaultPaths, type ImportReport, type Paths } from "../lib/tiled/run";
import { startWatch } from "../lib/tiled/watch";

export interface TiledImportOptions {
  paths?: Paths;
  debounceMs?: number;
  settleMs?: number;
  pollMs?: number;
  /** Importa al arrancar si los archivos de Tiled son más nuevos que maps.json (por defecto sí). */
  startupCheck?: boolean;
}

const TILED_FILE = /\.(tmj|tsj|tiled-project)$/;

/** Fecha de la última modificación entre los archivos de Tiled que se vigilan (0 si no hay). */
function newestTiledChange(paths: Paths): number {
  let newest = 0;
  for (const dir of [paths.mapsDir, paths.tilesetsDir, dirname(paths.projectFile)]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) if (TILED_FILE.test(name)) newest = Math.max(newest, statSync(join(dir, name)).mtimeMs);
  }
  return newest;
}

/** El texto del aviso que se muestra sobre la página: los errores del importador, con un tope para que quepa. */
export function overlayMessage(report: ImportReport, limit = 8): string {
  const shown = report.errors.slice(0, limit);
  const more = report.errors.length - shown.length;
  return [`Los mapas de Tiled tienen ${report.errors.length} error(es) y maps.json NO se actualizó.`, "", ...shown.map((e) => `✖ ${e}`), ...(more > 0 ? [`… y ${more} más (mira la terminal).`] : []), "", "Corrígelo en Tiled y guarda otra vez: se importa solo."].join("\n");
}

/**
 * Importa los mapas de Tiled a maps.json cada vez que se guardan, mientras corre `npm run dev`: es el equivalente a la
 * «exportación automática al guardar» de Tiled. Si el importador falla, el error sale en la terminal y como aviso sobre la página
 * (también en las pestañas que se abran después); al corregirlo el aviso se quita. Cuando maps.json cambia, la página se recarga
 * sola (ver `reloadOnConfigChange` en vite.config.ts). Devuelve la función que lo detiene.
 */
export function setupTiledImport(server: ViteDevServer, options: TiledImportOptions = {}): () => void {
  const paths = options.paths ?? defaultPaths(server.config.root);
  const logger = server.config.logger;
  let failure: string | null = null;

  const showError = (message: string) => server.ws.send({ type: "error", err: { message, stack: "", plugin: "tiled:import" } });
  const watcher = startWatch(paths, {
    debounceMs: options.debounceMs,
    settleMs: options.settleMs,
    pollMs: options.pollMs,
    log: (line) => {
      const text = line.replace(" Recarga la página para verlo.", " La página se recarga sola.");
      if (text.includes("✖")) logger.error(text, { timestamp: false });
      else logger.info(text, { timestamp: false });
    },
    onReport: (report) => {
      for (const w of report.warnings.filter((x) => x.includes("escala no era"))) logger.warn(`[tiled] ${w}`, { timestamp: true });
      if (!report.ok) {
        failure = overlayMessage(report);
        showError(failure);
        return;
      }
      if (failure !== null) {
        failure = null;
        // Si maps.json cambió, la recarga ya la pide `reloadOnConfigChange`; si no cambió, hay que quitar el aviso igualmente.
        if (!report.written) server.ws.send({ type: "full-reload", path: "*" });
      }
    },
  });
  // Una pestaña que se abre con un error pendiente lo ve también.
  server.ws.on("connection", () => {
    if (failure !== null) showError(failure);
  });
  if (options.startupCheck !== false && newestTiledChange(paths) > (existsSync(paths.mapsFile) ? statSync(paths.mapsFile).mtimeMs : 0)) void watcher.run();
  logger.info("  ➜  Tiled: los cambios de tools/tiled se importan solos al guardar (se desactiva con TILED_WATCH=0).", { timestamp: false });
  return () => watcher.stop();
}
