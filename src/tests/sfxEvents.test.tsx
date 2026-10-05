// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bitacoraJson from "./fixtures/realConfig";
import { ProgressStore } from "../app/progressStore";
import { useProgressController } from "../app/useProgressController";
import type { SfxService } from "../audio/SfxService";
import type { BitacoraConfig, SectionId } from "../config/types";
import { GameBridge } from "../game/bridge/GameBridge";
import { ProgressStorage, type StorageLike } from "../storage/progressStorage";
import { classicOf, demoOf } from "./fixtures/demoConfig";

// Los efectos de interfaz y de recompensa nacen en las acciones reales del controlador (SPEC 6.5): una apertura real, una sección
// realmente marcada, una insignia realmente concedida (una vez por transacción, con su identificador), un viaje aceptado.

afterEach(cleanup);
const real = bitacoraJson as unknown as BitacoraConfig;
const ALL: SectionId[] = ["learning", "reflection", "lived"];

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe("efectos de interfaz y de recompensa en el controlador (AC-91)", () => {
  let bridge: GameBridge;
  let token: number;
  let host: HTMLDivElement;
  let config: BitacoraConfig;
  let mem: MemoryStorage;
  let playEvent: ReturnType<typeof vi.fn>;
  let hostRef: { current: HTMLDivElement };
  const events = () => playEvent.mock.calls.map((c) => c[0] as string);

  const setup = (cfg = config, sfx: Pick<SfxService, "playEvent"> | null = { playEvent } as never) => {
    config = cfg;
    const store = new ProgressStore(cfg, new ProgressStorage(() => mem));
    return { store, ...renderHook(() => useProgressController(bridge, cfg, store, hostRef, { sfx: sfx as SfxService | null })) };
  };
  const open = (id: string, requestId = `r-${id}`) => act(() => bridge.emit("game:learning-open-request", { learningId: id, token, requestId }));
  type R = ReturnType<typeof setup>;
  const toReading = (r: R, id = "apr-a") => {
    open(id);
    act(() => r.result.current.actions.continueReading());
  };
  const complete = (r: R, id: string) => {
    toReading(r, id);
    ALL.forEach((s) => act(() => r.result.current.actions.markRead(s)));
    act(() => r.result.current.actions.claimBadge());
    act(() => r.result.current.actions.close());
  };

  beforeEach(() => {
    bridge = new GameBridge();
    token = bridge.beginScene();
    host = document.createElement("div");
    host.tabIndex = 0;
    document.body.append(host);
    hostRef = { current: host }; // estable: el controlador reinicia su estado si cambia la referencia
    mem = new MemoryStorage();
    config = structuredClone(classicOf(demoOf(real)));
    playEvent = vi.fn(() => true);
  });
  afterEach(() => host.remove());

  it("abrir una lectura suena «ui.open» una vez; un mensaje de «bloqueada» o un id ajeno, no", () => {
    const r = setup();
    open("apr-b", "bloq"); // bloqueada: solo un mensaje
    expect(r.result.current.reading?.kind).toBe("message");
    act(() => r.result.current.actions.close());
    open("no-existe", "x");
    expect(events()).toEqual([]);
    open("apr-a");
    expect(events()).toEqual(["ui.open"]);
    expect(r.result.current.reading?.kind).toBe("intro");
  });

  it("con una ventana abierta, otra solicitud (ocupado) no suena de más", () => {
    const r = setup();
    open("apr-a");
    open("apr-a", "otra");
    expect(events()).toEqual(["ui.open"]);
    expect(r.result.current.reading).toBeTruthy();
  });

  it("abrir la Bitácora (lista o insignias) suena «ui.open» y con una ventana abierta no repite", () => {
    const r = setup();
    act(() => r.result.current.overlayActions.openList());
    act(() => r.result.current.overlayActions.openList());
    act(() => r.result.current.overlayActions.openCollection());
    expect(events()).toEqual(["ui.open"]);
  });

  it("marcar una sección nueva suena «ui.confirm»; marcarla otra vez, no", () => {
    const r = setup();
    toReading(r);
    playEvent.mockClear();
    act(() => r.result.current.actions.markRead("learning"));
    act(() => r.result.current.actions.markRead("learning"));
    act(() => r.result.current.actions.markRead("lived"));
    expect(events()).toEqual(["ui.confirm", "ui.confirm"]);
  });

  it("recoger la insignia suena «badge.earned» UNA vez con su identificador; el doble clic y releer no repiten", () => {
    const r = setup();
    toReading(r);
    ALL.forEach((s) => act(() => r.result.current.actions.markRead(s)));
    playEvent.mockClear();
    act(() => { r.result.current.actions.claimBadge(); r.result.current.actions.claimBadge(); r.result.current.actions.claimBadge(); });
    act(() => r.result.current.actions.close());
    const earned = playEvent.mock.calls.filter((c) => c[0] === "badge.earned");
    expect(earned).toHaveLength(1);
    expect(earned[0][1]).toMatchObject({ effectId: expect.stringContaining("apr-a@") });
    // Releer y volver a «recoger» una completada no concede ni suena.
    playEvent.mockClear();
    open("apr-a", "again");
    act(() => r.result.current.actions.continueReading());
    act(() => r.result.current.actions.claimBadge());
    expect(events().filter((e) => e === "badge.earned")).toEqual([]);
  });

  it("la última lectura (la que concede además a Jerry y a Rocky) hace sonar la recompensa una sola vez", () => {
    const r = setup();
    for (const id of config.route.slice(0, -1)) complete(r, id);
    playEvent.mockClear();
    const last = config.route.at(-1) as string;
    toReading(r, last);
    ALL.forEach((s) => act(() => r.result.current.actions.markRead(s)));
    act(() => r.result.current.actions.claimBadge());
    act(() => r.result.current.actions.close());
    expect(events().filter((e) => e === "badge.earned")).toHaveLength(1);
  });

  it("un viaje por portal aceptado suena «portal.travel»; uno inválido, no", () => {
    setup();
    act(() => bridge.emit("game:portal-request", { portalId: "no-existe", fromZoneId: "zona-a", token, requestId: "p0" }));
    expect(events()).toEqual([]);
    act(() => bridge.emit("game:portal-request", { portalId: "a-b", fromZoneId: "zona-a", token, requestId: "p1" }));
    expect(events()).toEqual(["portal.travel"]);
  });

  it("un mensaje de una escena antigua no hace sonar nada", () => {
    setup();
    const old = token;
    token = bridge.beginScene();
    act(() => bridge.emit("game:learning-open-request", { learningId: "apr-a", token: old, requestId: "viejo" }));
    act(() => bridge.emit("game:portal-request", { portalId: "a-b", fromZoneId: "zona-a", token: old, requestId: "viejo2" }));
    expect(events()).toEqual([]);
  });

  it("sin servicio de efectos el controlador funciona igual", () => {
    const r = setup(config, null);
    toReading(r);
    ALL.forEach((s) => act(() => r.result.current.actions.markRead(s)));
    act(() => r.result.current.actions.claimBadge());
    expect(r.result.current.reading?.kind).toBe("reward");
  });
});
