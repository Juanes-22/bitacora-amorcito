// Importa las ediciones de Tiled cada vez que se guardan. Uso: npm run tiled:watch (en otra terminal junto a npm run dev).
import { defaultPaths } from "./lib/tiled/run";
import { startWatch } from "./lib/tiled/watch";

const paths = defaultPaths();
console.log("Vigilando tools/tiled (mapas, tilesets y proyecto). Guarda en Tiled para importar; Ctrl+C para salir.");
const watcher = startWatch(paths);
void watcher.run(); // estado inicial
process.on("SIGINT", () => {
  watcher.stop();
  process.exit(0);
});
