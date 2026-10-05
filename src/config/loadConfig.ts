import { fetchJson, type Fetcher, type LoadFailure } from "./fetchJson";
import type { AssetRegistry } from "./assetRegistry";
import type { BitacoraConfig, FrameDefinitions } from "./types";
import { validateBitacoraFiles } from "./validateConfig";

export type ConfigLoad = { ok: true; config: BitacoraConfig } | { ok: false; failure: LoadFailure };

/**
 * Carga bitacora.json (contenido) y maps.json (geometría) a la vez y los valida contra sus esquemas y, juntos, contra el registro de
 * assets ya construido. Un fallo de cualquiera de los dos —de red, de JSON o de validación— es el fallo de la carga.
 */
export async function loadConfig(
  configUrl: string,
  mapsUrl: string,
  fetcher: Fetcher,
  registry: AssetRegistry,
  frameDefinitions?: FrameDefinitions,
): Promise<ConfigLoad> {
  const [content, maps] = await Promise.all([fetchJson(configUrl, fetcher), fetchJson(mapsUrl, fetcher)]);
  if (!content.ok) return content;
  if (!maps.ok) return maps;
  const result = validateBitacoraFiles(content.data, maps.data, registry.manifest, { frameDefinitions });
  if (!result.ok) return { ok: false, failure: { stage: "bitacora", url: configUrl, issues: result.issues } };
  return { ok: true, config: result.value };
}
