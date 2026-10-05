import { describe, expect, it } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import realConfig from "./fixtures/realConfig";
import { splitConfig } from "../config/mapsFile";
import { describeFailure, documentUrls, createLoader, loadApp } from "../config/loadApp";
import type { Fetcher } from "../config/fetchJson";

const BASE = { baseUrl: "/", documentBase: "http://localhost:5173/" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, statusText: status === 404 ? "Not Found" : "OK" });

/** Servidor falso: responde por sufijo de URL y cuenta las peticiones. */
function server(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) return new Response("", { status: 404, statusText: "Not Found" });
    return routes[key]();
  };
  return { fetcher, calls };
}
const { content: contentFile, mapsFile } = splitConfig(realConfig);
const good = () => ({
  "assets/assets.json": () => json(manifestJson),
  "config/bitacora.json": () => json(contentFile),
  "config/maps.json": () => json(mapsFile),
});

describe("documentUrls: base de despliegue", () => {
  it("resuelve los documentos bajo cualquier base de Vite", () => {
    expect(documentUrls({ baseUrl: "./", documentBase: "http://h/app/" })).toEqual({
      config: "http://h/app/config/bitacora.json",
      maps: "http://h/app/config/maps.json",
      assets: "http://h/app/assets/assets.json",
    });
    expect(documentUrls({ baseUrl: "/bitacora/", documentBase: "http://h/bitacora/index.html" }).assets).toBe("http://h/bitacora/assets/assets.json");
    expect(documentUrls({ baseUrl: "/bitacora", documentBase: "http://h/" }).config).toBe("http://h/bitacora/config/bitacora.json");
  });
});

describe("loadApp", () => {
  it("carga, valida y construye configuración y registro coherentes", async () => {
    const s = server(good());
    const r = await loadApp({ ...BASE, fetcher: s.fetcher });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.route).toHaveLength(6);
    expect(r.assets.url("ui.icon.xp-star")).toBe("http://localhost:5173/assets/ui/icons/xp-star.png");
    expect(r.urls.config).toBe("http://localhost:5173/config/bitacora.json");
    expect(r.urls.maps).toBe("http://localhost:5173/config/maps.json");
    expect(Object.keys(r.config.maps)).toEqual(Object.keys(realConfig.maps)); // la geometría viene de maps.json
    expect(r.config.placements["apr-a"]).toEqual(realConfig.placements["apr-a"]);
    expect(s.calls.map((c) => c.init?.cache)).toEqual(["no-cache", "no-cache", "no-cache"]);
  });

  it("HTTP 404 en assets.json: falla de red con la URL y sin pedir bitacora.json", async () => {
    const s = server({ "config/bitacora.json": () => json(contentFile), "config/maps.json": () => json(mapsFile) });
    const r = await loadApp({ ...BASE, fetcher: s.fetcher });
    expect(r).toMatchObject({ ok: false, failure: { stage: "network", url: "http://localhost:5173/assets/assets.json" } });
    expect(s.calls).toHaveLength(1);
  });

  it("error de red: etapa network con el mensaje", async () => {
    const r = await loadApp({ ...BASE, fetcher: () => Promise.reject(new Error("sin conexión")) });
    expect(r).toMatchObject({ ok: false, failure: { stage: "network", message: "sin conexión" } });
  });

  it("JSON mal formado: etapa parse", async () => {
    const s = server({ ...good(), "config/bitacora.json": () => new Response("{ no es json") });
    const r = await loadApp({ ...BASE, fetcher: s.fetcher });
    expect(r).toMatchObject({ ok: false, failure: { stage: "parse", url: "http://localhost:5173/config/bitacora.json" } });
  });

  it("maps.json mal formado o ausente: falla la carga con la URL de ese archivo", async () => {
    const parse = await loadApp({ ...BASE, fetcher: server({ ...good(), "config/maps.json": () => new Response("{ no es json") }).fetcher });
    expect(parse).toMatchObject({ ok: false, failure: { stage: "parse", url: "http://localhost:5173/config/maps.json" } });
    const missing = await loadApp({ ...BASE, fetcher: server({ "assets/assets.json": () => json(manifestJson), "config/bitacora.json": () => json(contentFile) }).fetcher });
    expect(missing).toMatchObject({ ok: false, failure: { stage: "network", url: "http://localhost:5173/config/maps.json" } });
  });

  it("manifiesto incoherente: etapa assets con la ruta del problema", async () => {
    const bad = { ...manifestJson, assetCount: 1 };
    const s = server({ ...good(), "assets/assets.json": () => json(bad) });
    const r = await loadApp({ ...BASE, fetcher: s.fetcher });
    expect(r.ok).toBe(false);
    if (r.ok || r.failure.stage !== "assets") throw new Error("se esperaba stage assets");
    expect(r.failure.issues.map((i) => i.path)).toContain("assetCount");
  });

  it("manifiesto válido pero bitácora inválida: etapa bitacora, sin mundo parcial", async () => {
    const bad = structuredClone(contentFile) as unknown as { route: string[] };
    bad.route.push("fantasma");
    const s = server({ ...good(), "config/bitacora.json": () => json(bad) });
    const r = await loadApp({ ...BASE, fetcher: s.fetcher });
    expect(r.ok).toBe(false);
    if (r.ok || r.failure.stage !== "bitacora") throw new Error("se esperaba stage bitacora");
    expect(r.failure.issues[0].path).toBe("route[6]");
    expect("config" in r).toBe(false);
  });

  it("maps.json inválido: etapa bitacora con las rutas de ese archivo (forma y referencias cruzadas)", async () => {
    const badShape = structuredClone(mapsFile) as unknown as { maps: Record<string, { width: unknown }>; sobra: number };
    badShape.sobra = 1;
    badShape.maps["zona-a"].width = "ancho";
    const shape = await loadApp({ ...BASE, fetcher: server({ ...good(), "config/maps.json": () => json(badShape) }).fetcher });
    if (shape.ok || shape.failure.stage !== "bitacora") throw new Error("se esperaba stage bitacora");
    expect(shape.failure.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["sobra", "maps.zona-a.width"]));
    const badRef = structuredClone(mapsFile) as unknown as { placements: Record<string, { zoneId: string }> };
    badRef.placements["apr-a"].zoneId = "zona-fantasma";
    const ref = await loadApp({ ...BASE, fetcher: server({ ...good(), "config/maps.json": () => json(badRef) }).fetcher });
    if (ref.ok || ref.failure.stage !== "bitacora") throw new Error("se esperaba stage bitacora");
    expect(ref.failure.issues.some((i) => i.path.startsWith("placements.apr-a"))).toBe(true);
  });
});

describe("createLoader: una sola carga y reintento", () => {
  it("las llamadas simultáneas y posteriores comparten la carga", async () => {
    const s = server(good());
    const load = createLoader({ ...BASE, fetcher: s.fetcher });
    const [a, b] = await Promise.all([load(), load()]);
    expect(a).toBe(b);
    await load();
    expect(s.calls).toHaveLength(3);
  });

  it("un fallo no se guarda: reintentar vuelve a pedir los documentos", async () => {
    let online = false;
    const base = server(good());
    const fetcher: Fetcher = (url, init) => (online ? base.fetcher(url, init) : Promise.reject(new Error("offline")));
    const load = createLoader({ ...BASE, fetcher });
    expect((await load()).ok).toBe(false);
    online = true;
    expect((await load()).ok).toBe(true);
    expect(base.calls).toHaveLength(3); // assets, bitacora y maps, solo de la segunda carga (la primera falló sin conexión)
  });
});

describe("describeFailure", () => {
  it("formatea cada etapa", () => {
    expect(describeFailure({ stage: "network", url: "u", message: "HTTP 404" })).toBe("No se pudo cargar u: HTTP 404");
    expect(describeFailure({ stage: "parse", url: "u", message: "x" })).toContain("no es JSON válido");
    expect(describeFailure({ stage: "bitacora", url: "u", issues: [{ path: "route[0]", message: "m" }, { path: "maps.zona-a.width", message: "n" }, { path: "placements.apr-a", message: "o" }] })).toBe(
      "bitacora.json o maps.json no es válido:\n  bitacora.json › route[0]: m\n  maps.json › maps.zona-a.width: n\n  maps.json › placements.apr-a: o",
    );
  });
});
