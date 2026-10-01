import type { AssetEntry, AssetManifest } from "./types";

/** Error de un asset concreto: lleva el ID y, cuando se conoce, la ruta resuelta (AC-20). */
export class AssetError extends Error {
  constructor(
    message: string,
    readonly assetId: string,
    readonly resolvedUrl?: string,
  ) {
    super(`${message} (assetId «${assetId}»${resolvedUrl ? `, ruta ${resolvedUrl}` : ""})`);
    this.name = "AssetError";
  }
}

export interface AssetRegistry {
  /** URL absoluta del assets.json de la que parte toda resolución. */
  readonly manifestUrl: string;
  /** Directorio contra el que se resuelven los `path` (manifiesto + basePath). */
  readonly baseUrl: string;
  readonly manifest: AssetManifest;
  has(assetId: string): boolean;
  /** Entrada completa, con toda su metadata. Lanza AssetError si el ID no existe. */
  get(assetId: string): AssetEntry;
  /** URL absoluta del archivo. Es también lo que se registra como textura bajo la misma clave `assetId`. */
  url(assetId: string): string;
  ids(): string[];
  entries(): Array<[string, AssetEntry]>;
  byKind(kind: string): Array<[string, AssetEntry]>;
  nineSlice(assetId: string): NonNullable<AssetEntry["nineSlice"]> | undefined;
  placement(assetId: string): NonNullable<AssetEntry["placement"]> | undefined;
  /** URL del atlas JSON de una hoja animada (relativo al manifiesto, como `path`). Lanza AssetError si el asset no tiene atlas. */
  atlasUrl(assetId: string): string;
  isAtlas(assetId: string): boolean;
  /** `true` para hojas de poses que aún necesitan frames inspeccionados: no son spritesheets (SPEC 3.1). */
  needsFrameDefinition(assetId: string): boolean;
}

/**
 * Directorio de los assets: el del propio manifiesto, desplazado por `basePath`
 * (la convención real del catálogo es «paths relativos al directorio de assets.json»).
 */
export function resolveAssetBase(manifestUrl: string | URL, basePath: string): URL {
  const dir = new URL(".", manifestUrl);
  const bp = basePath === "" ? "." : basePath;
  return new URL(bp.endsWith("/") ? bp : `${bp}/`, dir);
}

/**
 * Construye el registro compartido por React y Phaser. El manifiesto debe haber pasado por
 * validateAssetManifest; aquí no se copia ni transforma, solo se indexa.
 * `originalPath` nunca se usa para cargar nada.
 */
export function createAssetRegistry(manifest: AssetManifest, manifestUrl: string | URL): AssetRegistry {
  const manifestHref = new URL(manifestUrl).href;
  const base = resolveAssetBase(manifestHref, manifest.basePath);

  const get = (assetId: string): AssetEntry => {
    const entry = Object.hasOwn(manifest.assets, assetId) ? manifest.assets[assetId] : undefined;
    if (!entry) throw new AssetError("asset ID no encontrado en assets.json", assetId);
    return entry;
  };
  const url = (assetId: string): string => {
    const entry = get(assetId);
    try {
      return new URL(entry.path, base).href;
    } catch {
      throw new AssetError(`path no resoluble «${entry.path}»`, assetId);
    }
  };

  return {
    manifestUrl: manifestHref,
    baseUrl: base.href,
    manifest,
    has: (assetId) => Object.hasOwn(manifest.assets, assetId),
    get,
    url,
    ids: () => Object.keys(manifest.assets),
    entries: () => Object.entries(manifest.assets),
    byKind: (kind) => Object.entries(manifest.assets).filter(([, a]) => a.kind === kind),
    atlasUrl: (assetId) => {
      const path = get(assetId).atlasPath;
      if (!path) throw new AssetError("el asset no tiene atlas (atlasPath)", assetId);
      try {
        return new URL(path, base).href;
      } catch {
        throw new AssetError(`atlasPath no resoluble «${path}»`, assetId);
      }
    },
    isAtlas: (assetId) => typeof get(assetId).atlasPath === "string",
    nineSlice: (assetId) => get(assetId).nineSlice,
    placement: (assetId) => get(assetId).placement,
    needsFrameDefinition: (assetId) => get(assetId).requiresFrameDefinition === true,
  };
}
