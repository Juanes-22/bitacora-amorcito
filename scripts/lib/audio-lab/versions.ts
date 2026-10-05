import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import type { FileVersions } from "../../../src/dev/audio-lab/protocol";
import { listMapFiles, type Paths } from "../tiled/files";
import { propsOf } from "../tiled/util";
import type { TiledMap } from "../tiled/types";

const hash = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex").slice(0, 16);
const hashFile = (file: string): string => (existsSync(file) ? hash(readFileSync(file)) : "-");

/** El `zoneId` que declara un mapa de Tiled en sus propiedades (el de la clase `Zone`). */
export function zoneIdOf(map: TiledMap): string | undefined {
  const v = propsOf(map.properties).get("zoneId")?.value;
  return typeof v === "string" ? v : undefined;
}

/** Los mapas de Tiled por `zoneId` (archivo y contenido leído); los que no declaran su zona se omiten. */
export function zoneMaps(paths: Paths): Map<string, { file: string; text: string; map: TiledMap }> {
  const out = new Map<string, { file: string; text: string; map: TiledMap }>();
  for (const file of listMapFiles(paths).maps) {
    try {
      const text = readFileSync(file, "utf8");
      const map = JSON.parse(text) as TiledMap;
      const id = zoneIdOf(map) ?? basename(file, ".tmj");
      out.set(id, { file, text, map });
    } catch {
      /* un mapa ilegible no impide ver las versiones de los demás: el importador lo informará */
    }
  }
  return out;
}

/** Las huellas actuales de los archivos que puede tocar el laboratorio. */
export function readVersions(paths: Paths): FileVersions {
  return {
    manifest: hashFile(paths.manifestFile),
    project: hashFile(paths.projectFile),
    maps: hashFile(paths.mapsFile),
    config: hashFile(paths.configFile),
    zones: Object.fromEntries([...zoneMaps(paths)].map(([id, m]) => [id, hash(m.text)])),
  };
}

export { hash as hashBytes };
