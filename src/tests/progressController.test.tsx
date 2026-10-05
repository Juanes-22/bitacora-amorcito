// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import bitacoraJson from "./fixtures/realConfig";
import { ProgressStore } from "../app/progressStore";
import { useProgressController } from "../app/useProgressController";
import type { BitacoraConfig, SectionId } from "../config/types";
import { GameBridge } from "../game/bridge/GameBridge";
import type { BridgeEvents } from "../game/bridge/events";
import { ProgressStorage, storageKey, type StorageLike } from "../storage/progressStorage";
import { classicOf, demoOf } from "./fixtures/demoConfig";

afterEach(cleanup);
const real = bitacoraJson as unknown as BitacoraConfig;
/** Sin la Bitácora de aprendizajes: la lectura sencilla, que abre con su ventana de apertura. La real entra directo a la lectura (más abajo). */
const base = classicOf(demoOf(real));
const ALL: SectionId[] = ["learning", "reflection", "lived"];
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

  it("con la Bitácora de aprendizajes se entra directo a la lectura (sin ventana de apertura ni de relectura) y se retoma donde se quedó", () => {
    config = demoOf(real);
    const first = setup();
    open("apr-a");
    expect(first.result.current.reading).toEqual({ kind: "reading", learningId: "apr-a", active: "learning" });
    expect(resolvedFor("r-apr-a")).toEqual([{ requestId: "r-apr-a", accepted: true, reason: undefined }]);
    expect(log.controls.at(-1)).toEqual(["reading"]);
    act(() => first.result.current.actions.markRead("learning"));
    act(() => first.result.current.actions.selectSection("reflection"));
    act(() => first.result.current.actions.close());
    open("apr-a", "r-again");
    expect(first.result.current.reading).toEqual({ kind: "reading", learningId: "apr-a", active: "reflection" });
    // Una completada también se relee directo.
    ALL.forEach((s) => act(() => first.result.current.actions.markRead(s)));
    act(() => first.result.current.actions.claimBadge());
    act(() => first.result.current.actions.close());
    open("apr-a", "r-done");
    expect(first.result.current.reading).toMatchObject({ kind: "reading", learningId: "apr-a" });
  });

  it("con la Bitácora de aprendizajes, bloqueada y pendiente siguen mostrando su mensaje; «volver a la bitácora» y «ver insignia» abren sus ventanas", () => {
    config = demoOf(real);
    const r = setup();
    act(() => bridge.emit("game:nearby-changed", { target: { kind: "learning", id: "apr-a" }, token }));
    open("apr-b");
    expect(r.result.current.reading).toEqual({ kind: "message", learningId: "apr-b", event: "locked" });
    act(() => r.result.current.actions.close());
    open("apr-a");
    act(() => r.result.current.actions.backToList());
    expect(r.result.current.reading).toBeNull();
    expect(r.result.current.overlay).toEqual({ kind: "list" });
    expect(log.controls.at(-1)).toEqual(["overlay"]); // el mapa sigue detenido, sin un instante libre
    act(() => r.result.current.overlayActions.openFromList("apr-a"));
    expect(r.result.current.reading).toMatchObject({ kind: "reading", learningId: "apr-a" });
    act(() => r.result.current.actions.openBadge());
    expect(r.result.current.reading).toBeNull();
    expect(r.result.current.overlay).toEqual({ kind: "collection", completion: false, learningId: "apr-a" });
    expect(log.controls.at(-1)).toEqual(["overlay"]);
    // Ninguna de las dos concede nada ni marca lecturas.
    expect(Object.values(r.store.getState().entries).every((e) => e.completedAt === undefined && e.readSectionIds.length === 0)).toBe(true);
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
    expect(first.result.current.reading).toEqual({ kind: "reading", learningId: "apr-a", active: "learning" });
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

  it("sin las tres secciones no se concede la insignia", () => {
    const r = setup();
    toReading(r);
    ["learning", "reflection"].forEach((s) => act(() => r.result.current.actions.markRead(s as SectionId)));
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

  describe("lista accesible (SPEC 14, AC-11)", () => {
    const openList = (r: ReturnType<typeof setup>) => act(() => r.result.current.overlayActions.openList());
    const fromList = (r: ReturnType<typeof setup>, id: string) => act(() => r.result.current.overlayActions.openFromList(id));
    /** Vanessa está junto a la estación (lo que avisa el mapa); `null`, lejos de todas. */
    const near = (id: string | null) => act(() => bridge.emit("game:nearby-changed", { target: id ? { kind: "learning", id } : null, token }));

    it("abre la lista, detiene el mapa y se cierra devolviendo el control", () => {
      const r = setup();
      openList(r);
      expect(r.result.current.overlay).toEqual({ kind: "list" });
      expect(log.controls.at(-1)).toEqual(["overlay"]);
      act(() => r.result.current.overlayActions.closeOverlay());
      expect(r.result.current.overlay).toBeNull();
      expect(log.controls.at(-1)).toEqual([]);
    });

    it("abrir el aprendizaje disponible muestra su introducción igual que junto a la estación, sin mover al personaje", () => {
      const r = setup();
      near("apr-a");
      openList(r);
      fromList(r, "apr-a");
      expect(r.result.current.reading).toEqual({ kind: "intro", learningId: "apr-a", event: "open" });
      expect(r.result.current.overlay).toBeNull();
      expect(log.controls.at(-1)).toEqual(["reading"]);
      expect(log.zone).toEqual([]);
    });

    it("las mismas reglas de secuencia: uno bloqueado solo muestra su mensaje y no se puede marcar ni recoger", () => {
      const r = setup();
      openList(r);
      fromList(r, "apr-c");
      expect(r.result.current.reading).toEqual({ kind: "message", learningId: "apr-c", event: "locked" });
      act(() => r.result.current.actions.markRead("lived"));
      act(() => r.result.current.actions.claimBadge());
      expect(r.result.current.reading?.kind).toBe("message");
      expect(r.store.getState().entries["apr-c"]).toMatchObject({ readSectionIds: [] });
      expect(r.store.getState().entries["apr-c"].completedAt).toBeUndefined();
    });

    it("en modo final un contenido sin aprobar se muestra como pendiente, no se abre", () => {
      config.mode = "final";
      const r = setup();
      near("apr-a");
      openList(r);
      fromList(r, "apr-a");
      expect(r.result.current.reading).toEqual({ kind: "message", learningId: "apr-a", event: "pending" });
    });

    it("al cerrar la lectura vuelve a la lista (sin parpadeo de controles) y se puede cerrar con otro cierre", () => {
      const r = setup();
      near("apr-a");
      openList(r);
      fromList(r, "apr-a");
      const before = log.controls.length;
      act(() => r.result.current.actions.close());
      expect(r.result.current.reading).toBeNull();
      expect(r.result.current.overlay).toEqual({ kind: "list" });
      expect(log.controls.slice(before).every((c) => c.includes("overlay"))).toBe(true); // nunca quedó libre entre medias
      expect(log.controls.at(-1)).toEqual(["overlay"]);
      act(() => r.result.current.overlayActions.closeOverlay());
      expect(log.controls.at(-1)).toEqual([]);
    });

    it("lejos de su estación, un aprendizaje sin completar NO se explora desde la Bitácora: muestra su aviso, no marca nada y vuelve a la lista", () => {
      const r = setup();
      near(null);
      openList(r);
      fromList(r, "apr-a");
      expect(r.result.current.reading).toEqual({ kind: "message", learningId: "apr-a", event: "away" });
      act(() => r.result.current.actions.markRead("learning"));
      act(() => r.result.current.actions.claimBadge());
      expect(r.store.getState().entries["apr-a"].readSectionIds).toEqual([]);
      expect(r.store.getState().entries["apr-a"].completedAt).toBeUndefined();
      act(() => r.result.current.actions.close());
      expect(r.result.current.overlay).toEqual({ kind: "list" });
      near("apr-b"); // junto a otra estación tampoco vale
      act(() => r.result.current.overlayActions.closeOverlay());
      near("apr-b");
      openList(r);
      fromList(r, "apr-a");
      expect(r.result.current.reading).toEqual({ kind: "message", learningId: "apr-a", event: "away" });
    });

    it("junto a su estación sí se explora, aunque al abrir la Bitácora el mapa «limpie» lo cercano al detenerse", () => {
      const r = setup();
      near("apr-a");
      openList(r);
      near(null); // la escena pausada avisa que ya no hay nada cercano: no cuenta como alejarse
      fromList(r, "apr-a");
      expect(r.result.current.reading).toMatchObject({ learningId: "apr-a" });
      expect(r.result.current.reading?.kind).not.toBe("message");
    });

    it("al alejarse con el mapa libre se pierde la presencia: hay que volver a la estación", () => {
      const r = setup();
      near("apr-a");
      near(null);
      openList(r);
      fromList(r, "apr-a");
      expect(r.result.current.reading).toEqual({ kind: "message", learningId: "apr-a", event: "away" });
    });

    it("un aprendizaje completado se relee desde cualquier sitio (lejos de su estación)", () => {
      const store = newStore();
      ALL.forEach((s) => store.markSection("apr-a", s));
      store.claimBadge("apr-a");
      const r = setup(store);
      near(null);
      openList(r);
      fromList(r, "apr-a");
      expect(r.result.current.reading).toMatchObject({ learningId: "apr-a" });
      expect(r.result.current.reading?.kind).not.toBe("message");
      // …y el siguiente, que sigue sin completar, sigue exigiendo su estación.
      act(() => r.result.current.actions.close());
      fromList(r, "apr-b");
      expect(r.result.current.reading).toEqual({ kind: "message", learningId: "apr-b", event: "away" });
    });

    it("«Ver aprendizaje» desde el detalle de una insignia abre ese aprendizaje con las mismas reglas y, al cerrar, vuelve a la insignia", () => {
      config = demoOf(real);
      const store = newStore();
      ALL.forEach((s) => store.markSection("apr-a", s));
      store.claimBadge("apr-a");
      const r = setup(store);
      near(null);
      act(() => r.result.current.overlayActions.openCollection());
      expect(r.result.current.overlay).toEqual({ kind: "collection", completion: false });
      fromList(r, "apr-a"); // completado: se relee aunque esté lejos
      expect(r.result.current.overlay).toBeNull();
      expect(r.result.current.reading).toMatchObject({ kind: "reading", learningId: "apr-a" });
      act(() => r.result.current.actions.close());
      expect(r.result.current.overlay).toEqual({ kind: "collection", completion: false, learningId: "apr-a" });
      // El siguiente, sin completar y lejos de su estación, muestra el aviso y vuelve a la colección.
      fromList(r, "apr-b");
      expect(r.result.current.reading).toEqual({ kind: "message", learningId: "apr-b", event: "away" });
      act(() => r.result.current.actions.close());
      expect(r.result.current.overlay).toEqual({ kind: "collection", completion: false, learningId: "apr-b" });
      // Uno bloqueado muestra su mensaje de siempre.
      fromList(r, "apr-d");
      expect(r.result.current.reading).toEqual({ kind: "message", learningId: "apr-d", event: "locked" });
      // Y junto a su estación, el siguiente sí se abre.
      act(() => r.result.current.actions.close());
      act(() => r.result.current.overlayActions.closeOverlay());
      near("apr-b");
      act(() => r.result.current.overlayActions.openCollection());
      fromList(r, "apr-b");
      expect(r.result.current.reading).toMatchObject({ kind: "reading", learningId: "apr-b" });
    });

    it("ganar la insignia desde la lista cierra la lectura en el mapa y celebra (no vuelve a la lista)", () => {
      const r = setup();
      near("apr-a");
      openList(r);
      fromList(r, "apr-a");
      act(() => r.result.current.actions.continueReading());
      ALL.forEach((s) => act(() => r.result.current.actions.markRead(s)));
      act(() => r.result.current.actions.claimBadge());
      act(() => r.result.current.actions.close());
      expect(r.result.current.overlay).toBeNull();
      expect(log.celebrate).toHaveLength(1);
      expect(log.controls.at(-1)).toEqual([]);
      // la lista refleja ahora el estado nuevo
      expect(r.store.getState().entries["apr-a"].completedAt).toBeDefined();
    });

    it("no abre con otra ventana abierta, ignora IDs ajenos y no deja bloqueos colgados", () => {
      const r = setup();
      near("apr-a");
      toReading(r);
      openList(r);
      expect(r.result.current.overlay).toBeNull(); // hay una lectura abierta
      act(() => r.result.current.actions.close());
      openList(r);
      fromList(r, "no-existe");
      expect(r.result.current.reading).toBeNull();
      expect(r.result.current.overlay).toEqual({ kind: "list" });
      expect(log.controls.at(-1)).toEqual(["overlay"]);
      fromList(r, "apr-a");
      fromList(r, "apr-a"); // doble clic: la segunda ya no hay lista abierta
      expect(r.result.current.reading?.kind).toBe("intro");
    });

    it("no otorga nada por abrir: el estado del progreso no cambia", () => {
      const r = setup();
      const before = JSON.stringify(r.store.getState().entries);
      openList(r);
      fromList(r, "apr-a");
      act(() => r.result.current.actions.close());
      expect(JSON.stringify(r.store.getState().entries)).toBe(before);
    });
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
