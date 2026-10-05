import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { ReloadGate } from "./scripts/vite/reloadGate";

/** Una sola recarga del navegador por tanda de cambios en la configuración (también la de un guardado del laboratorio de sonidos). */
const reloadGate = new ReloadGate();

/**
 * En desarrollo, recarga la página cuando cambia `public/config/bitacora.json` (el contenido) o `public/config/maps.json` (la geometría;
 * p. ej. al importar una edición de Tiled con `npm run tiled:import` o `npm run tiled:watch`). Es una recarga completa: la escena de
 * Phaser no se actualiza en caliente.
 */
function reloadOnConfigChange(): Plugin {
  return {
    name: "bitacora-config-reload",
    apply: "serve",
    configureServer(server) {
      // También `assets.json`: el laboratorio de sonidos incorpora recursos nuevos al catálogo.
      const files = ["config/bitacora.json", "config/maps.json", "assets/assets.json"].map((name) => resolve(server.config.root, "public", name));
      for (const file of files) server.watcher.add(file);
      reloadGate.attach(() => server.ws.send({ type: "full-reload", path: "*" }));
      server.watcher.on("change", (file) => {
        if (files.includes(resolve(file))) reloadGate.request();
      });
    },
  };
}

// base relativa: el destino de publicación aún no está decidido y los assets
// se resuelven en runtime desde la URL del manifiesto (SPEC 12.2).
/**
 * En desarrollo, importa a `maps.json` las ediciones de los mapas de Tiled al guardarlas y muestra los errores sobre la página
 * (`scripts/vite/tiledImport.ts`). No actúa en las pruebas ni con `TILED_WATCH=0`. Se carga bajo demanda: arrancar las pruebas o el
 * build no paga por él.
 */
function tiledImportOnSave(): Plugin {
  return {
    name: "bitacora-tiled-import",
    apply: "serve",
    async configureServer(server) {
      if (process.env.VITEST || process.env.TILED_WATCH === "0") return;
      const { setupTiledImport } = await import("./scripts/vite/tiledImport");
      const stop = setupTiledImport(server);
      server.httpServer?.once("close", stop);
    },
  };
}

/**
 * Solo en desarrollo: las rutas con las que el laboratorio de sonidos (`?audioLab=1`) guarda en el proyecto (`scripts/vite/audioLab.ts`).
 * No actúa en las pruebas ni en el build, y las rutas no existen en `dist`.
 */
function audioLabSave(): Plugin {
  return {
    name: "bitacora-audio-lab",
    apply: "serve",
    async configureServer(server) {
      if (process.env.VITEST) return;
      const { setupAudioLab } = await import("./scripts/vite/audioLab");
      setupAudioLab(server, { gate: reloadGate });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), reloadOnConfigChange(), tiledImportOnSave(), audioLabSave()],
  build: {
    outDir: "dist",
    // El código compilado no debe compartir carpeta con public/assets/ (assets.json y sus imágenes).
    assetsDir: "bundle",
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ["src/tests/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
