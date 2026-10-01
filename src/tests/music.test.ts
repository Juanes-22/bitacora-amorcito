import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firstIndex, nextIndex } from "../audio/playlist";
import { MusicPlayer, type AudioLike, type MusicTrack } from "../audio/MusicPlayer";
import { PREFERENCES_KEY, PreferencesStorage } from "../storage/preferencesStorage";

class FakeAudio implements AudioLike {
  static all: FakeAudio[] = [];
  static playError: { name: string } | null = null;
  src: string;
  volume = 1;
  currentTime = 0;
  duration = 100;
  preload = "";
  isPaused = true;
  playCalls = 0;
  removedSrc = false;
  private listeners: Record<string, Array<() => void>> = {};
  constructor(url: string) {
    this.src = url;
    FakeAudio.all.push(this);
  }
  get paused() { return this.isPaused; }
  play() {
    this.playCalls++;
    if (FakeAudio.playError) return Promise.reject(FakeAudio.playError);
    this.isPaused = false;
    return Promise.resolve();
  }
  pause() { this.isPaused = true; }
  removeAttribute(name: string) { if (name === "src") this.removedSrc = true; }
  addEventListener(type: string, fn: () => void) { (this.listeners[type] ??= []).push(fn); }
  removeEventListener(type: string, fn: () => void) { this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn); }
  emit(type: string) { (this.listeners[type] ?? []).slice().forEach((f) => f()); }
  hasListeners() { return Object.values(this.listeners).some((l) => l.length > 0); }
}

const TRACKS: MusicTrack[] = [
  { id: "a", url: "/a.mp3", title: "A", artist: "X" },
  { id: "b", url: "/b.mp3", title: "B", artist: "X" },
  { id: "c", url: "/c.ogg", title: "C", artist: "Y" },
];

function visibility() {
  let hidden = false;
  const listeners = new Set<() => void>();
  return {
    isHidden: () => hidden,
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
    set(value: boolean) { hidden = value; listeners.forEach((l) => l()); },
    count: () => listeners.size,
  };
}

function make(options: Partial<{ tracks: MusicTrack[]; order: "sequential" | "shuffle"; crossfadeMs: number; muted: boolean; random: () => number }> = {}) {
  const vis = visibility();
  const onMutedChange = vi.fn();
  const player = new MusicPlayer(
    { tracks: options.tracks ?? TRACKS, order: options.order ?? "sequential", volume: 0.4, crossfadeMs: options.crossfadeMs ?? 2000 },
    options.muted ?? false,
    { createAudio: (url) => new FakeAudio(url), visibility: vis, onMutedChange, random: options.random, now: () => 0 },
  );
  return { player, vis, onMutedChange };
}
const flush = () => Promise.resolve().then(() => Promise.resolve());
const ticks = (player: MusicPlayer, n: number) => { for (let i = 0; i < n; i++) player.tick(100); };
const audio = (i: number) => FakeAudio.all[i];

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudio.all = [];
  FakeAudio.playError = null;
});
afterEach(() => vi.useRealTimers());

describe("playlist", () => {
  it("sequential rota y vuelve a la primera tras la última", () => {
    expect([0, 1, 2].map((i) => nextIndex(3, i, "sequential"))).toEqual([1, 2, 0]);
    expect(nextIndex(1, 0, "sequential")).toBe(0);
  });

  it("shuffle nunca repite la pista que acaba de sonar y alcanza todas las demás", () => {
    for (const current of [0, 1, 2]) {
      const seen = new Set<number>();
      for (let r = 0; r < 1; r += 0.05) seen.add(nextIndex(3, current, "shuffle", () => r));
      expect(seen.has(current)).toBe(false);
      expect(seen.size).toBe(2);
    }
  });

  it("firstIndex: sequential empieza en la primera; shuffle elige cualquiera", () => {
    expect(firstIndex(3, "sequential", () => 0.9)).toBe(0);
    expect(firstIndex(3, "shuffle", () => 0.9)).toBe(2);
  });
});

describe("MusicPlayer: inicio (AC-50)", () => {
  it("no crea ni reproduce audio antes de start()", () => {
    make();
    expect(FakeAudio.all).toHaveLength(0);
  });

  it("start() reproduce la primera pista con fundido de entrada y volumen acotado", async () => {
    const { player } = make();
    player.start();
    await flush();
    expect(FakeAudio.all).toHaveLength(1);
    expect(audio(0)).toMatchObject({ src: "/a.mp3", playCalls: 1, preload: "auto" });
    expect(player.getState()).toMatchObject({ status: "playing", muted: false });
    expect(player.getState().track?.id).toBe("a");
    ticks(player, 30); // el volumen sube con el fundido y nunca supera el configurado
    audio(0).currentTime = 10;
    ticks(player, 1);
    expect(audio(0).volume).toBeCloseTo(0.4, 5);
    player.dispose();
  });

  it("con la música silenciada start() no crea audio; al encenderla suena", async () => {
    const { player } = make({ muted: true });
    player.start();
    expect(FakeAudio.all).toHaveLength(0);
    player.setMuted(false);
    await flush();
    expect(FakeAudio.all).toHaveLength(1);
    expect(player.getState().status).toBe("playing");
    player.dispose();
  });

  it("start() repetido no duplica la reproducción", async () => {
    const { player } = make();
    player.start();
    player.start();
    await flush();
    expect(FakeAudio.all).toHaveLength(1);
    player.dispose();
  });

  it("sin pistas no hace nada", () => {
    const { player } = make({ tracks: [] });
    player.start();
    expect(FakeAudio.all).toHaveLength(0);
  });
});

describe("MusicPlayer: rotación y fundido (AC-50)", () => {
  async function finish(player: MusicPlayer, index: number) {
    // Tramo final: precarga la siguiente, la arranca al entrar en el fundido y, al terminar, esta pasa a sonar.
    const head = audio(index);
    head.currentTime = 85;
    ticks(player, 1);
    const next = FakeAudio.all[FakeAudio.all.length - 1];
    head.currentTime = 99;
    ticks(player, 1);
    await flush();
    head.currentTime = 100;
    head.emit("ended");
    await flush();
    return next;
  }

  it("rota A → B → C → A en orden y solo mantiene la pista que suena y la siguiente", async () => {
    const { player } = make();
    player.start();
    await flush();
    ticks(player, 10);

    const b = await finish(player, 0);
    expect(b.src).toBe("/b.mp3");
    expect(b.playCalls).toBe(1);
    expect(player.getState().track?.id).toBe("b");
    expect(audio(0)).toMatchObject({ removedSrc: true, isPaused: true });
    expect(audio(0).hasListeners()).toBe(false);

    const c = await finish(player, 1);
    expect(c.src).toBe("/c.ogg");
    expect(player.getState().track?.id).toBe("c");

    const again = await finish(player, 2);
    expect(again.src).toBe("/a.mp3");
    expect(player.getState().track?.id).toBe("a");
    // Nunca hay más de dos elementos de audio vivos a la vez.
    expect(FakeAudio.all.filter((a) => !a.removedSrc)).toHaveLength(1);
    player.dispose();
  });

  it("durante el fundido las dos pistas suenan con volúmenes complementarios", async () => {
    const { player } = make({ crossfadeMs: 2000 });
    player.start();
    await flush();
    ticks(player, 10);
    audio(0).currentTime = 50;
    ticks(player, 1);
    audio(0).currentTime = 99; // quedan 1000 ms de 2000
    ticks(player, 1);
    audio(1).currentTime = 1; // lleva 1000 ms sonando
    ticks(player, 1);
    expect(audio(0).volume).toBeCloseTo(0.4 * 0.5, 2);
    expect(audio(1).volume).toBeCloseTo(0.4 * 0.5, 2);
    player.dispose();
  });

  it("una sola pista se repite al terminar", async () => {
    const { player } = make({ tracks: [TRACKS[0]] });
    player.start();
    await flush();
    audio(0).emit("ended");
    await flush();
    expect(FakeAudio.all).toHaveLength(2);
    expect(audio(1).src).toBe("/a.mp3");
    player.dispose();
  });

  it("sin fundido (crossfadeMs 0) la siguiente empieza al terminar", async () => {
    const { player } = make({ crossfadeMs: 0 });
    player.start();
    await flush();
    audio(0).currentTime = 99.95;
    ticks(player, 1);
    audio(0).emit("ended");
    await flush();
    expect(player.getState().track?.id).toBe("b");
    expect(audio(1).playCalls).toBe(1);
    player.dispose();
  });

  it("shuffle: la siguiente nunca es la que acaba de sonar", async () => {
    const { player } = make({ order: "shuffle", random: () => 0 });
    player.start();
    await flush();
    audio(0).currentTime = 85;
    ticks(player, 1);
    expect(FakeAudio.all[1].src).not.toBe(audio(0).src);
    player.dispose();
  });
});

describe("MusicPlayer: apagar y encender (AC-51)", () => {
  it("apagar baja el volumen con fundido, pausa y avisa de la preferencia; encender reanuda", async () => {
    const { player, onMutedChange } = make();
    player.start();
    await flush();
    ticks(player, 10);
    audio(0).currentTime = 30;
    ticks(player, 1);
    expect(audio(0).volume).toBeGreaterThan(0.3);

    player.setMuted(true);
    expect(onMutedChange).toHaveBeenLastCalledWith(true);
    expect(player.getState().muted).toBe(true);
    ticks(player, 2);
    expect(audio(0).volume).toBeLessThan(0.3);
    ticks(player, 5);
    expect(audio(0).isPaused).toBe(true);
    expect(player.getState().status).toBe("paused");

    player.setMuted(false);
    await flush();
    expect(onMutedChange).toHaveBeenLastCalledWith(false);
    expect(audio(0).isPaused).toBe(false);
    expect(FakeAudio.all).toHaveLength(1); // reanuda la misma pista, no abre otra
    ticks(player, 10);
    expect(audio(0).volume).toBeCloseTo(0.4, 2);
    expect(player.getState().status).toBe("playing");
    player.dispose();
  });

  it("toggle() alterna y no repite el aviso si el estado no cambia", async () => {
    const { player, onMutedChange } = make();
    player.start();
    await flush();
    player.toggle();
    player.setMuted(true);
    player.toggle();
    expect(onMutedChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
    player.dispose();
  });

  it("los suscriptores se enteran de cada cambio y el estado es estable entre cambios", async () => {
    const { player } = make();
    const listener = vi.fn();
    const off = player.subscribe(listener);
    const before = player.getState();
    expect(player.getState()).toBe(before);
    player.setMuted(true);
    expect(listener).toHaveBeenCalled();
    expect(player.getState()).not.toBe(before);
    off();
    const calls = listener.mock.calls.length;
    player.setMuted(false);
    expect(listener.mock.calls.length).toBe(calls);
  });
});

describe("MusicPlayer: pestaña oculta, bloqueo y fallos (AC-52)", () => {
  it("se pausa con la pestaña oculta y reanuda al volver si estaba encendida", async () => {
    const { player, vis } = make();
    player.start();
    await flush();
    vis.set(true);
    expect(audio(0).isPaused).toBe(true);
    vis.set(false);
    await flush();
    expect(audio(0).isPaused).toBe(false);
    expect(player.getState().status).toBe("playing");
    player.dispose();
  });

  it("no reanuda sola si estaba silenciada, y no suena si start() ocurre con la pestaña oculta", async () => {
    const { player, vis } = make();
    player.start();
    await flush();
    player.setMuted(true);
    ticks(player, 6);
    vis.set(true);
    vis.set(false);
    await flush();
    expect(audio(0).isPaused).toBe(true);
    player.dispose();

    FakeAudio.all = [];
    const hidden = make();
    hidden.vis.set(true);
    hidden.player.start();
    await flush();
    expect(FakeAudio.all[0].playCalls).toBe(0);
    hidden.vis.set(false);
    await flush();
    expect(FakeAudio.all[0].playCalls).toBe(1);
    hidden.player.dispose();
  });

  it("si el navegador bloquea la reproducción queda 'blocked' y pulsar el botón la reintenta", async () => {
    FakeAudio.playError = { name: "NotAllowedError" };
    const { player } = make();
    player.start();
    await flush();
    expect(player.getState().status).toBe("blocked");
    expect(player.getState().muted).toBe(false);

    FakeAudio.playError = null;
    player.toggle();
    await flush();
    expect(audio(0).playCalls).toBe(2);
    expect(player.getState().status).toBe("playing");
    expect(player.getState().muted).toBe(false);
    player.dispose();
  });

  it("una pista que falla se omite y suena la siguiente; el fallo queda anotado", async () => {
    const { player } = make();
    player.start();
    await flush();
    audio(0).emit("error");
    await flush();
    expect(player.getState().failed).toEqual(["a"]);
    expect(FakeAudio.all[1].src).toBe("/b.mp3");
    expect(FakeAudio.all[1].playCalls).toBe(1);
    expect(player.getState().status).toBe("playing");
    player.dispose();
  });

  it("si fallan todas, queda en 'error' sin lanzar ni entrar en bucle", async () => {
    const { player } = make();
    player.start();
    await flush();
    for (let i = 0; i < 3; i++) {
      FakeAudio.all[FakeAudio.all.length - 1].emit("error");
      await flush();
    }
    expect(player.getState().status).toBe("error");
    expect(player.getState().failed).toEqual(["a", "b", "c"]);
    expect(FakeAudio.all).toHaveLength(3);
  });

  it("un error inesperado al reproducir también omite la pista", async () => {
    FakeAudio.playError = { name: "EncodingError" };
    const { player } = make({ tracks: [TRACKS[0], TRACKS[1]] });
    player.start();
    await flush();
    await flush();
    expect(player.getState().failed.length).toBeGreaterThan(0);
    player.dispose();
  });

  it("dispose() libera los audios y los oyentes; se puede volver a empezar (React StrictMode)", async () => {
    const { player, vis } = make();
    player.start();
    await flush();
    expect(vis.count()).toBe(1);
    player.dispose();
    expect(audio(0)).toMatchObject({ isPaused: true, removedSrc: true });
    expect(audio(0).hasListeners()).toBe(false);
    expect(vis.count()).toBe(0);
    expect(player.getState().status).toBe("idle");

    player.start();
    await flush();
    expect(FakeAudio.all).toHaveLength(2);
    expect(player.getState().status).toBe("playing");
    player.dispose();
  });
});

describe("PreferencesStorage (AC-51)", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  };

  it("por defecto la música está encendida y la preferencia se guarda y se recupera", () => {
    const store = memory();
    const a = new PreferencesStorage(store);
    expect(a.musicMuted).toBe(false);
    a.setMusicMuted(true);
    expect(JSON.parse(store.data.get(PREFERENCES_KEY) as string)).toEqual({ musicMuted: true });
    expect(new PreferencesStorage(store).musicMuted).toBe(true);
  });

  it("ignora un valor corrupto o con forma inesperada", () => {
    for (const raw of ["{no json", "[]", '{"musicMuted":"si"}', "null"]) {
      const store = memory();
      store.data.set(PREFERENCES_KEY, raw);
      expect(new PreferencesStorage(store).musicMuted).toBe(false);
    }
  });

  it("si el almacenamiento falla o no existe, sigue en memoria sin lanzar", () => {
    const broken = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cuota"); }, removeItem: () => undefined };
    const a = new PreferencesStorage(broken);
    expect(() => a.setMusicMuted(true)).not.toThrow();
    expect(a.musicMuted).toBe(true);
    const none = new PreferencesStorage(null);
    none.setMusicMuted(true);
    expect(none.musicMuted).toBe(true);
  });

  it("guarda el modo de controles táctiles junto a la música, sin pisarse", () => {
    const store = memory();
    const a = new PreferencesStorage(store);
    expect(a.touchControls).toBeUndefined();
    a.setTouchControls("dpad");
    a.setMusicMuted(true);
    expect(JSON.parse(store.data.get(PREFERENCES_KEY) as string)).toEqual({ musicMuted: true, touchControls: "dpad" });
    const b = new PreferencesStorage(store);
    expect(b.touchControls).toBe("dpad");
    expect(b.musicMuted).toBe(true);
    b.setTouchControls("tap");
    expect(new PreferencesStorage(store)).toMatchObject({ touchControls: "tap", musicMuted: true });
  });

  it("ignora un modo de controles desconocido", () => {
    const store = memory();
    store.data.set(PREFERENCES_KEY, JSON.stringify({ musicMuted: false, touchControls: "joystick" }));
    expect(new PreferencesStorage(store).touchControls).toBeUndefined();
  });

  it("es independiente del progreso: usa su propia clave", () => {
    expect(PREFERENCES_KEY).not.toContain("progress");
  });
});
