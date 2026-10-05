import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { AUDIO_LAB_HEADER, AUDIO_LAB_LIMITS, AUDIO_LAB_ROUTE, type SaveRequest, type SaveResult } from "../../src/dev/audio-lab/protocol";
import { saveAudioLab } from "../lib/audio-lab/save";
import { readVersions, zoneMaps } from "../lib/audio-lab/versions";
import { defaultPaths, type Paths } from "../lib/tiled/run";
import type { ReloadGate } from "./reloadGate";

/**
 * Rutas del laboratorio de sonidos en el servidor de desarrollo (SPEC 6.5). Solo existen con `npm run dev`: el plugin es `apply: "serve"`,
 * la compilación de producción no las incluye y el panel que las usa tampoco. Protecciones: solo peticiones desde esta misma máquina,
 * del mismo origen (o sin `Origin`, como `curl`) y con la cabecera propia del laboratorio, que un sitio ajeno no puede enviar sin
 * permiso del servidor; las solicitudes tienen tope de tamaño; nunca se aceptan rutas de archivo del cliente (solo datos).
 */

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const STATUS: Record<string, number> = { conflict: 409, invalid: 422, busy: 423, error: 500 };

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(text);
}

/** Lee el cuerpo con tope de tamaño; lanza si se pasa (sin cargarlo entero en memoria). */
function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new RangeError(`la solicitud supera el límite de ${Math.round(limit / 1024 / 1024)} MB`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** ¿La petición viene de esta máquina, del mismo origen y del laboratorio? Devuelve el motivo del rechazo, o `null`. */
export function rejectReason(req: Pick<IncomingMessage, "headers" | "socket" | "method">): string | null {
  const addr = req.socket?.remoteAddress ?? "";
  if (!LOOPBACK.has(addr)) return "el laboratorio solo acepta peticiones desde esta máquina";
  if (req.headers[AUDIO_LAB_HEADER] !== "1") return `falta la cabecera ${AUDIO_LAB_HEADER}`;
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let host = "";
    try {
      host = new URL(origin).host;
    } catch {
      return "origen no válido";
    }
    if (host !== req.headers.host) return "el origen no coincide con el servidor de desarrollo";
  }
  return null;
}

export interface AudioLabServerOptions {
  paths?: Paths;
  gate?: ReloadGate;
}

/** Monta las rutas en el servidor de desarrollo de Vite. */
export function setupAudioLab(server: ViteDevServer, options: AudioLabServerOptions = {}): void {
  const paths = options.paths ?? defaultPaths(server.config.root);
  const gate = options.gate;

  server.middlewares.use(AUDIO_LAB_ROUTE, (req, res, next) => {
    void handle(req, res, next).catch((e) => send(res, 500, { ok: false, reason: "error", errors: [(e as Error).message] } satisfies SaveResult));
  });

  async function handle(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const route = url.pathname.replace(/\/+$/, "") || "/";
    if (route !== "/state" && route !== "/save") return next();
    const denied = rejectReason(req);
    if (denied) return send(res, 403, { ok: false, reason: "error", errors: [denied] } satisfies SaveResult);

    if (route === "/state") {
      if (req.method !== "GET") return send(res, 405, { ok: false, reason: "error", errors: ["usa GET"] } satisfies SaveResult);
      // Las huellas actuales y las zonas que tienen mapa de Tiled (solo en ellas se pueden guardar emisores).
      return send(res, 200, { ok: true, versions: readVersions(paths), zones: [...zoneMaps(paths).keys()], limits: AUDIO_LAB_LIMITS });
    }

    if (req.method !== "POST") return send(res, 405, { ok: false, reason: "error", errors: ["usa POST"] } satisfies SaveResult);
    if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return send(res, 415, { ok: false, reason: "invalid", errors: ["el cuerpo debe ser JSON"] } satisfies SaveResult);
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req, AUDIO_LAB_LIMITS.maxRequestBytes));
    } catch (e) {
      const tooBig = e instanceof RangeError;
      return send(res, tooBig ? 413 : 400, { ok: false, reason: "invalid", errors: [tooBig ? (e as Error).message : "el cuerpo no es JSON válido"] } satisfies SaveResult);
    }
    const dryRun = url.searchParams.get("dryRun") === "1";
    const result = await saveAudioLab(paths, body as SaveRequest, {
      dryRun,
      onWrite: gate ? { begin: () => gate.hold(), end: (written) => { gate.release(); if (written.length) gate.request(); } } : undefined,
    });
    send(res, result.ok ? 200 : (STATUS[result.reason] ?? 500), result);
  }
}
