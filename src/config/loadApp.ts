import { toValidatedFrames } from "../assets/frameDefinitions";
import type { AssetRegistry } from "./assetRegistry";
import type { Fetcher, LoadFailure } from "./fetchJson";
import { loadAssets } from "./loadAssets";
import { loadConfig } from "./loadConfig";
import type { BitacoraConfig, FrameDefinitions } from "./types";

export interface LoadOptions {
  /** Base de despliegue de Vite. Por defecto `import.meta.env.BASE_URL`. */
  baseUrl?: string;
  /** URL contra la que se resuelve la base. Por defecto `document.baseURI`. */
  documentBase?: string;
  fetcher?: Fetcher;
  frameDefinitions?: FrameDefinitions;
}

export type LoadResult =
  | { ok: true; config: BitacoraConfig; assets: AssetRegistry; urls: { config: string; assets: string } }
  | { ok: false; failure: LoadFailure };

/** URLs de ambos documentos bajo la base de despliegue (`public/config` y `public/assets`). */
export function documentUrls(options: LoadOptions = {}): { config: string; assets: string } {
  const base = options.baseUrl ?? import.meta.env.BASE_URL;
  const doc = options.documentBase ?? document.baseURI;
  const root = base.endsWith("/") ? base : `${base}/`;
  return {
    config: new URL(`${root}config/bitacora.json`, doc).href,
    assets: new URL(`${root}assets/assets.json`, doc).href,
  };
}

/**
 * Secuencia de SPEC 12.2: obtener ambos JSON → validar → comprobar referencias cruzadas →
 * construir el AssetRegistry. Devuelve configuración y registro ya coherentes o el primer fallo;
 * nunca una configuración parcial.
 */
export async function loadApp(options: LoadOptions = {}): Promise<LoadResult> {
  const fetcher: Fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const urls = documentUrls(options);
  const assets = await loadAssets(urls.assets, fetcher);
  if (!assets.ok) return assets;
  const config = await loadConfig(urls.config, fetcher, assets.registry, options.frameDefinitions ?? toValidatedFrames());
  if (!config.ok) return config;
  return { ok: true, config: config.config, assets: assets.registry, urls };
}

/**
 * Carga una sola vez por sesión: las llamadas repetidas comparten la misma promesa. Un fallo no se
 * guarda, de modo que «reintentar» vuelve a pedir los documentos.
 */
export function createLoader(options: LoadOptions = {}): () => Promise<LoadResult> {
  let pending: Promise<LoadResult> | undefined;
  return () => {
    pending ??= loadApp(options).then((r) => {
      if (!r.ok) pending = undefined;
      return r;
    });
    return pending;
  };
}

export function describeFailure(f: LoadFailure): string {
  const where = f.stage === "assets" ? "assets.json" : f.stage === "bitacora" ? "bitacora.json" : f.url;
  if (f.stage === "assets" || f.stage === "bitacora") {
    return `${where} no es válido:\n${f.issues.map((i) => `  ${i.path}: ${i.message}`).join("\n")}`;
  }
  return f.stage === "network" ? `No se pudo cargar ${where}: ${f.message}` : `${where} no es JSON válido: ${f.message}`;
}
