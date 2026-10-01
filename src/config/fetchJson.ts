import type { ConfigIssue } from "./types";

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Fallo de carga con la etapa que lo produjo; nunca se sustituye por una configuración vacía. */
export type LoadFailure =
  | { stage: "network"; url: string; message: string }
  | { stage: "parse"; url: string; message: string }
  | { stage: "assets"; url: string; issues: ConfigIssue[] }
  | { stage: "bitacora"; url: string; issues: ConfigIssue[] };

export type Fetched = { ok: true; data: unknown } | { ok: false; failure: LoadFailure };

/**
 * GET de un JSON con revalidación HTTP (`no-cache`): la edición del archivo se ve en la siguiente
 * recarga sin service workers ni sondeos (SPEC 12.2).
 */
export async function fetchJson(url: string, fetcher: Fetcher): Promise<Fetched> {
  let response: Response;
  try {
    response = await fetcher(url, { cache: "no-cache" });
  } catch (e) {
    return { ok: false, failure: { stage: "network", url, message: e instanceof Error ? e.message : String(e) } };
  }
  if (!response.ok) {
    return { ok: false, failure: { stage: "network", url, message: `HTTP ${response.status} ${response.statusText}`.trim() } };
  }
  try {
    return { ok: true, data: await response.json() };
  } catch (e) {
    return { ok: false, failure: { stage: "parse", url, message: e instanceof Error ? e.message : String(e) } };
  }
}
