import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * En desarrollo, recarga la página cuando cambia `public/config/bitacora.json` (p. ej. al importar una edición de Tiled con
 * `npm run tiled:import` o `npm run tiled:watch`). Es una recarga completa: la escena de Phaser no se actualiza en caliente.
 */
function reloadOnConfigChange(): Plugin {
  return {
    name: "bitacora-config-reload",
    apply: "serve",
    configureServer(server) {
      const config = resolve(server.config.root, "public/config/bitacora.json");
      server.watcher.add(config);
      server.watcher.on("change", (file) => {
        if (resolve(file) === config) server.ws.send({ type: "full-reload", path: "*" });
      });
    },
  };
}

// base relativa: el destino de publicación aún no está decidido y los assets
// se resuelven en runtime desde la URL del manifiesto (SPEC 12.2).
export default defineConfig({
  base: "./",
  plugins: [react(), reloadOnConfigChange()],
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
