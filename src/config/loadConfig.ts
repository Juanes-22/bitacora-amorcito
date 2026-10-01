import { fetchJson, type Fetcher, type LoadFailure } from "./fetchJson";
import type { AssetRegistry } from "./assetRegistry";
import type { BitacoraConfig, FrameDefinitions } from "./types";
import { validateBitacora } from "./validateConfig";

export type ConfigLoad = { ok: true; config: BitacoraConfig } | { ok: false; failure: LoadFailure };

/** Carga bitacora.json y lo valida contra el esquema y contra el registro de assets ya construido. */
export async function loadConfig(
  configUrl: string,
  fetcher: Fetcher,
  registry: AssetRegistry,
  frameDefinitions?: FrameDefinitions,
): Promise<ConfigLoad> {
  const fetched = await fetchJson(configUrl, fetcher);
  if (!fetched.ok) return fetched;
  const result = validateBitacora(fetched.data, registry.manifest, { frameDefinitions });
  if (!result.ok) return { ok: false, failure: { stage: "bitacora", url: configUrl, issues: result.issues } };
  return { ok: true, config: result.value };
}
