import { createAssetRegistry, type AssetRegistry } from "./assetRegistry";
import { fetchJson, type Fetcher, type LoadFailure } from "./fetchJson";
import { validateAssetManifest } from "./validateAssets";

export type AssetsLoad = { ok: true; registry: AssetRegistry } | { ok: false; failure: LoadFailure };

/** Carga y valida assets.json y construye el AssetRegistry a partir de su propia URL. */
export async function loadAssets(manifestUrl: string, fetcher: Fetcher): Promise<AssetsLoad> {
  const fetched = await fetchJson(manifestUrl, fetcher);
  if (!fetched.ok) return fetched;
  const result = validateAssetManifest(fetched.data);
  if (!result.ok) return { ok: false, failure: { stage: "assets", url: manifestUrl, issues: result.issues } };
  return { ok: true, registry: createAssetRegistry(result.value, manifestUrl) };
}
