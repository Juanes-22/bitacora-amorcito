// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import bitacoraJson from "../../public/config/bitacora.json";
import { ProgressStore } from "../app/progressStore";
import { useProgressController } from "../app/useProgressController";
import type { BitacoraConfig, SectionId } from "../config/types";
import { GameBridge } from "../game/bridge/GameBridge";
import type { BridgeEvents } from "../game/bridge/events";
import { ProgressStorage, storageKey, type StorageLike } from "../storage/progressStorage";

afterEach(cleanup);
const base = bitacoraJson as unknown as BitacoraConfig;
const ALL: SectionId[] = ["lived", "learning", "reflection", "classroom"];
const KEY = (c: BitacoraConfig) => storageKey(c.contentSetId, c.mode);

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe("useProgressController", () => {
  let bridge: GameBridge;
  let token: number;
  let host: HTMLDivElement;
  let mem: MemoryStorage;
  let config: BitacoraConfig;
  let hostRef: { current: HTMLDivElement };
  const log = { sync: [] as Array<BridgeEvents["app:sync"]>, controls: [] as Array<readonly string[]>, resolved: [] as Array<BridgeEvents["app:request-resolved"]>, zone: [] as Array<BridgeEvents["app:zone-change"]>, celebrate: [] as Array<BridgeEvents["app:celebrate"]>, order: [] as string[] };

  const newStore = () => new ProgressStore(config, new ProgressStorage(() => mem));
  const setup = (store = newStore()) => ({ store, ...renderHook(() => useProgressController(bridge, config, store, hostRef)) });
  const open = (learningId: string, requestId = `r-${learningId}`) => act(() => bridge.emit("game:learning-open-request", { learningId, token, requestId }));
  const resolvedFor = (id: string) => log.resolved.filter((r) => r.requestId === id);

  beforeEach(() => {
    config = structuredClone(base);
    bridge = new GameBridge();
    token = bridge.beginScene();
    host = document.createElement("div");
    host.tabIndex = 0;
    document.body.append(host);
    hostRef = { current: host };
    mem = new MemoryStorage();
    log.sync = []; log.controls = []; log.resolved = []; log.zone = []; log.celebrate = []; log.order = [];
    bridge.on("app:sync", (e) => log.sync.push(e));
    bridge.on("app:controls", (e) => { log.controls.push(e.reasons); log.order.push(`controls:${e.reasons.join("+") || "-"}`); });
    bridge.on("app:request-resolved", (e) => log.resolved.push(e));
    bridge.on("app:zone-change", (e) => log.zone.push(e));
    bridge.on("app:celebrate", (e) => { log.celebrate.push(e); log.order.push("celebrate"); });
  });
  afterEach(() => host.remove());

  /** Lleva «apr-a» a la fase de lectura. */
  const toReading = (r: ReturnType<typeof setup>, id = "apr-a") => {
    open(id);
    act(() => r.result.current.actions.continueReading());
  };
  const finish = (r: ReturnType<typeof setup>) => {
    toReading(r);
    ALL.forEach((s) => act(() => r.result.current.actions.markRead(s)));
    act(() => r.result.current.actions.claimBadge());
  };

  it("al montar entrega la instantánea completa y los bloqueos aunque la escena arrancara antes", () => {
    setup();
    expect(log.sync.at(-1)?.stations).toEqual({ "apr-a": "available", "apr-b": "locked", "apr-c": "locked", "apr-d": "locked", "apr-e": "locked", "apr-f": "locked" });
    expect(log.controls.at(-1)).toEqual([]);
  });

  it("game:ready vuelve a enviar la instantánea y NO celebra nada aunque haya insignias históricas", () => {
    const first = setup();
    finish(first);
    act(() => first.result.current.actions.close());
    expect(log.celebrate).toHaveLength(1);
    cleanup();
    log.celebrate = [];
    const reloaded = setup(); // simula recargar: otro almacén sobre el mismo guardado
    act(() => bridge.emit("game:ready", { zoneId: "zona-a", token, position: { x: 200, y: 1030 } }));
    expect(log.sync.at(-1)?.stations["apr-a"]).toBe("completed");
    expect(log.celebrate).toEqual([]);
    expect(reloaded.result.current.reading).toBeNull();
  });

  it("abrir una estación disponible muestra el diálogo de apertura, acepta y bloquea la exploración", () => {
    const { result } = setup();
    open("apr-a");
    expect(result.current.reading).toEqual({ kind: "intro", learningId: "apr-a", event: "open" });
    expect(resolvedFor("r-apr-a")).toEqual([{ requestId: "r-apr-a", accepted: true, reason: undefined }]);
    expect(log.controls.at(-1)).toEqual(["reading"]);
  });

  it("una estación bloqueada se deniega con su mensaje y no abre contenido", () => {
    const { result } = setup();
    open("apr-b");
    expect(result.current.reading).toEqual({ kind: "message", learningId: "apr-b", event: "locked" });
    expect(resolvedFor("r-apr-b")[0]).toMatchObject({ accepted: false, reason: "locked" });
    act(() => result.current.actions.continueReading());
    act(() => result.current.actions.markRead("lived"));
    expect(result.current.reading).toEqual({ kind: "message", learningId: "apr-b", event: "locked" });
  });

  it("en modo final un contenido no aprobado se muestra como pendiente, no se abre", () => {
    config.mode = "final";
    const { result } = setup();
    open("apr-a");
    expect(result.current.reading).toEqual({ kind: "message", learningId: "apr-a", event: "pending" });
    expect(resolvedFor("r-apr-a")[0]).toMatchObject({ accepted: false, reason: "not-admissible" });
  });

  it("descarta mensajes de una escena sustituida y rechaza IDs ajenos a la ruta", () => {
    const { result } = setup();
    const old = token;
    token = bridge.beginScene();
    act(() => bridge.emit("game:learning-open-request", { learningId: "apr-a", token: old, requestId: "viejo" }));
    expect(result.current.reading).toBeNull();
    expect(resolvedFor("viejo")).toEqual([]);
    open("apr-zzz");
    expect(resolvedFor("r-apr-zzz")[0]).toMatchObject({ accepted: false, reason: "unknown-learning" });
  });

  it("continuar abre la primera pestaña, o la última recordada", () => {
    const first = setup();
    toReading(first);
    expect(first.result.current.reading).toEqual({ kind: "reading", learningId: "apr-a", active: "lived" });
    act(() => first.result.current.actions.selectSection("reflection"));
    act(() => first.result.current.actions.close());
    expect(first.store.getState().entries["apr-a"].lastSectionId).toBe("reflection");
    open("apr-a", "r2");
    act(() => first.result.current.actions.continueReading());
    expect(first.result.current.reading).toMatchObject({ active: "reflection" });
  });

  it("abrir o cambiar de pestaña no marca nada: solo la acción explícita", () => {
    const r = setup();
    toReading(r);
    ALL.forEach((s) => act(() => r.result.current.actions.selectSection(s)));
    expect(r.store.getState().entries["apr-a"].readSectionIds).toEqual([]);
    act(() => r.result.current.actions.markRead("learning"));
    expect(r.store.getState().entries["apr-a"].readSectionIds).toEqual(["learning"]);
  });

  it("sin las cuatro secciones no se concede la insignia", () => {
    const r = setup();
    toReading(r);
    ["lived", "learning", "reflection"].forEach((s) => act(() => r.result.current.actions.markRead(s as SectionId)));
    act(() => r.result.current.actions.claimBadge());
    expect(r.result.current.reading?.kind).toBe("reading");
    expect(log.sync.at(-1)?.stations["apr-b"]).toBe("locked");
  });

  it("recoger la insignia: recompensa, siguiente habilitada y celebración SOLO al cerrar y con la escena reanudada", () => {
    const r = setup();
    finish(r);
    expect(r.result.current.reading).toEqual({ kind: "reward", learningId: "apr-a" });
    expect(log.sync.at(-1)?.stations).toMatchObject({ "apr-a": "completed", "apr-b": "available" });
    expect(log.celebrate).toEqual([]); // aún hay una ventana encima del mapa
    act(() => r.result.current.actions.close());
    expect(r.result.current.reading).toBeNull();
    expect(log.celebrate).toHaveLength(1);
    expect(log.celebrate[0].learningId).toBe("apr-a");
    // La escena se reanuda ANTES de celebrar: la animación no queda detrás de la ventana.
    expect(log.order.slice(-2)).toEqual(["controls:-", "celebrate"]);
  });

  it("doble clic en «Recoger insignia» o Enter mantenido no duplican la recompensa ni la celebración", () => {
    const r = setup();
    toReading(r);
    ALL.forEach((s) => act(() => r.result.current.actions.markRead(s)));
    act(() => { r.result.current.actions.claimBadge(); r.result.current.actions.claimBadge(); r.result.current.actions.claimBadge(); });
    act(() => r.result.current.actions.close());
    act(() => r.result.current.actions.close());
    expect(log.celebrate).toHaveLength(1);
    expect(Object.values(r.store.getState().entries).filter((e) => e.completedAt).length).toBe(1);
  });

  it("releer una completada no vuelve a celebrar ni a conceder", () => {
    const r = setup();
    finish(r);
    act(() => r.result.current.actions.close());
    log.celebrate = [];
    open("apr-a", "again");
    expect(r.result.current.reading).toEqual({ kind: "intro", learningId: "apr-a", event: "completed" });
    act(() => r.result.current.actions.continueReading());
    act(() => r.result.current.actions.claimBadge());
    act(() => r.result.current.actions.close());
    expect(log.celebrate).toEqual([]);
  });

  it("cerrar sin recoger la insignia no celebra", () => {
    const r = setup();
    toReading(r);
    act(() => r.result.current.actions.markRead("lived"));
    act(() => r.result.current.actions.close());
    expect(log.celebrate).toEqual([]);
    expect(log.controls.at(-1)).toEqual([]);
  });

  it("guarda al marcar, al conceder la insignia y al cambiar de zona", () => {
    const r = setup();
    toReading(r);
    expect(mem.data.has(KEY(config))).toBe(false); // abrir no guarda
    act(() => r.result.current.actions.markRead("lived"));
    expect(JSON.parse(mem.data.get(KEY(config))!).entries["apr-a"].readSectionIds).toEqual(["lived"]);
    act(() => bridge.emit("game:portal-request", { portalId: "a-b", fromZoneId: "zona-a", token, requestId: "p" }));
    token = bridge.beginScene();
    act(() => bridge.emit("game:ready", { zoneId: "zona-b", token, position: { x: 130, y: 470 } }));
    expect(JSON.parse(mem.data.get(KEY(config))!)).toMatchObject({ currentZoneId: "zona-b", player: { x: 130, y: 470 } });
  });

  it("los checkpoints de la escena activa se guardan y los de una escena antigua no", () => {
    const r = setup();
    act(() => bridge.emit("game:checkpoint", { zoneId: "zona-a", position: { x: 330, y: 990 }, token }));
    expect(r.store.getState().player).toEqual({ x: 330, y: 990 });
    act(() => bridge.emit("game:checkpoint", { zoneId: "zona-a", position: { x: 1, y: 1 }, token: token + 50 }));
    expect(r.store.getState().player).toEqual({ x: 330, y: 990 });
  });

  it("portal: valida origen y destino contra los datos y bloquea durante la transición", () => {
    setup();
    act(() => bridge.emit("game:portal-request", { portalId: "a-b", fromZoneId: "zona-a", token, requestId: "p1" }));
    expect(resolvedFor("p1")[0]).toMatchObject({ accepted: true });
    expect(log.zone).toEqual([{ zoneId: "zona-b", spawnId: "desde-a" }]);
    expect(log.controls.at(-1)).toEqual(["transition"]);
    token = bridge.beginScene();
    act(() => bridge.emit("game:ready", { zoneId: "zona-b", token, position: { x: 130, y: 470 } }));
    expect(log.controls.at(-1)).toEqual([]);
  });

  it("portal: rechaza un origen distinto de la zona actual, un portal inexistente y un mensaje antiguo; viajar no desbloquea", () => {
    setup();
    const before = JSON.stringify(log.sync.at(-1)!.stations);
    act(() => bridge.emit("game:portal-request", { portalId: "b-a", fromZoneId: "zona-b", token, requestId: "p2" }));
    act(() => bridge.emit("game:portal-request", { portalId: "no-existe", fromZoneId: "zona-a", token, requestId: "p3" }));
    const old = token;
    token = bridge.beginScene();
    act(() => bridge.emit("game:portal-request", { portalId: "a-b", fromZoneId: "zona-a", token: old, requestId: "p4" }));
    expect(resolvedFor("p2")[0]).toMatchObject({ accepted: false, reason: "invalid-portal" });
    expect(resolvedFor("p3")[0]).toMatchObject({ accepted: false, reason: "invalid-portal" });
    expect(resolvedFor("p4")).toEqual([]);
    expect(log.zone).toEqual([]);
    expect(JSON.stringify(log.sync.at(-1)!.stations)).toBe(before);
  });

  it("los checkpoints no repintan estaciones: solo se emite app:sync si cambian los estados", () => {
    setup();
    const n = log.sync.length;
    act(() => bridge.emit("game:checkpoint", { zoneId: "zona-a", position: { x: 300, y: 300 }, token }));
    expect(log.sync.length).toBe(n);
  });

  it("publica el objetivo cercano solo para la escena activa", () => {
    const { result } = setup();
    act(() => bridge.emit("game:nearby-changed", { target: { kind: "learning", id: "apr-a" }, token }));
    expect(result.current.nearby).toEqual({ kind: "learning", id: "apr-a" });
    act(() => bridge.emit("game:nearby-changed", { target: null, token: token + 99 }));
    expect(result.current.nearby).toEqual({ kind: "learning", id: "apr-a" });
  });

  it("al desmontar retira sus receptores y guarda lo pendiente", () => {
    const base0 = bridge.listenerCount();
    const r = setup();
    expect(bridge.listenerCount()).toBeGreaterThan(base0);
    act(() => bridge.emit("game:checkpoint", { zoneId: "zona-a", position: { x: 330, y: 990 }, token })); // el primero se escribe
    act(() => bridge.emit("game:checkpoint", { zoneId: "zona-a", position: { x: 340, y: 995 }, token })); // el siguiente se espacia
    expect(JSON.parse(mem.data.get(KEY(config))!).player).toEqual({ x: 330, y: 990 });
    r.unmount();
    expect(bridge.listenerCount()).toBe(base0);
    expect(JSON.parse(mem.data.get(KEY(config))!).player).toEqual({ x: 340, y: 995 }); // al desmontar se guarda lo pendiente
  });
});
