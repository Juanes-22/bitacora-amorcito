import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// base relativa: el destino de publicación aún no está decidido y los assets
// se resuelven en runtime desde la URL del manifiesto (SPEC 12.2).
export default defineConfig({
  base: "./",
  plugins: [react()],
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
