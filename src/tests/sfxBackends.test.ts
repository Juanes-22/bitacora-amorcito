// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { HtmlSfxBackend } from "../audio/HtmlSfxBackend";
import { createGameSfxBackend, PhaserSfxBackend } from "../audio/PhaserSfxBackend";

// Los dos reproductores de efectos (SPEC 6.5) con dobles de prueba: el de Phaser/Web Audio y el de elementos de audio normales.

class FakeAudio {
  listeners = new Map<string, Array<() => void>>();
  volume = 1;
  playbackRate = 1;
  loop = false;
  preload = "";
  duration = Number.NaN;
  paused = true;
  attrs = new Map<string, string>();
  playResult: Promise<void> = Promise.resolve();
  constructor(public src: string) {}
  addEventListener(name: string, cb: () => void) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), cb]); }
  emit(name: string) { (this.listeners.get(name) ?? []).forEach((cb) => cb()); }
  play() { this.paused = false; return this.playResult; }
  pause() { this.paused = true; }
  removeAttribute(n: string) { this.attrs.delete(n); }
  load() { /* sin efecto */ }
}

describe("HtmlSfxBackend (AC-88, respaldo sin Web Audio)", () => {
  let created: FakeAudio[];
  const make = () => new HtmlSfxBackend(((url: string) => {
    const a = new FakeAudio(url);
    created.push(a);
    return a as unknown as HTMLAudioElement;
  }) as never);
  beforeEach(() => { created = []; });

  it("empieza bloqueado y el gesto lo desbloquea", async () => {
    const b = make();
    expect(b.kind).toBe("html5");
    expect(b.status()).toBe("locked");
    let changes = 0;
    b.subscribe(() => changes++);
    await b.unlock();
    expect(b.status()).toBe("ready");
    expect(changes).toBe(1);
  });

  it("carga un recurso al conocer su duración, y falla con un mensaje si el navegador no puede leerlo", async () => {
    const b = make();
    const ok = b.load("a", "http://x/a.wav");
    created[0].duration = 1.5;
    created[0].emit("loadedmetadata");
    await expect(ok).resolves.toMatchObject({ key: "a", durationSeconds: 1.5 });
    expect(b.has("a")).toBe(true);
    const bad = b.load("b", "http://x/b.wav");
    created[1].emit("error");
    await expect(bad).rejects.toThrow(/no pudo leer/);
    expect(b.has("b")).toBe(false);
  });

  it("reproduce con volumen y velocidad acotados, los cambia en vivo, avisa del final y se detiene", async () => {
    const b = make();
    const loaded = b.load("a", "http://x/a.wav");
    created[0].duration = 2;
    created[0].emit("loadedmetadata");
    await loaded;
    const voice = b.play("a", { volume: 3, rate: 1.5, loop: true })!;
    const audio = created[1];
    expect(audio).toMatchObject({ volume: 1, playbackRate: 1.5, loop: true, paused: false });
    voice.setVolume(-1);
    expect(audio.volume).toBe(0);
    voice.setRate(0.5);
    expect(audio.playbackRate).toBe(0.5);
    const ended = vi.fn();
    voice.onEnd(ended);
    audio.emit("ended");
    expect(ended).toHaveBeenCalledTimes(1);
    voice.stop();
    expect(audio.paused).toBe(true);
    expect(b.play("desconocido", { volume: 1, rate: 1, loop: false })).toBeNull();
  });

  it("si el navegador rechaza el audio sin gesto, vuelve a «bloqueado»", async () => {
    const b = make();
    await b.unlock();
    const loaded = b.load("a", "u");
    created[0].duration = 1;
    created[0].emit("loadedmetadata");
    await loaded;
    const blocked = new Promise<void>((_, reject) => reject(Object.assign(new Error("no"), { name: "NotAllowedError" })));
    blocked.catch(() => undefined);
    const original = FakeAudio.prototype.play;
    FakeAudio.prototype.play = function () { return blocked; };
    try {
      b.play("a", { volume: 1, rate: 1, loop: false });
      await Promise.resolve();
      await Promise.resolve();
      expect(b.status()).toBe("locked");
    } finally {
      FakeAudio.prototype.play = original;
    }
  });

  it("libera los archivos locales (objectURL) al descargarlos y al cerrar", async () => {
    const create = vi.fn(() => "blob:fake");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    try {
      const b = make();
      const p = b.loadData("local", new ArrayBuffer(10));
      created[0].duration = 0.5;
      created[0].emit("loadedmetadata");
      await expect(p).resolves.toMatchObject({ key: "local", bytes: 10 });
      b.unload("local");
      expect(revoke).toHaveBeenCalledWith("blob:fake");
      const p2 = b.loadData("otro", new ArrayBuffer(4));
      created[1].duration = 0.5;
      created[1].emit("loadedmetadata");
      await p2;
      b.dispose();
      expect(revoke).toHaveBeenCalledTimes(2);
      expect(b.has("otro")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("PhaserSfxBackend (AC-88, Web Audio del juego)", () => {
  interface FakeSound { destroyed: boolean; stopped: boolean; rate: number; handlers: Map<string, () => void>; volumeNode: { gain: { cancelScheduledValues: ReturnType<typeof vi.fn>; setTargetAtTime: ReturnType<typeof vi.fn> } }; play: () => boolean; stop: () => void; destroy: () => void; setRate: (r: number) => void; once: (e: string, cb: () => void) => void }
  let sounds: FakeSound[];
  let cache: Map<string, unknown>;
  let canPlay: boolean;
  const context = () => {
    const listeners = new Map<string, Array<() => void>>();
    return {
      state: "suspended",
      currentTime: 5,
      resume: vi.fn(async function (this: { state: string }) { this.state = "running"; listeners.get("statechange")?.forEach((l) => l()); }),
      decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({ duration: data.byteLength / 1000, length: data.byteLength, numberOfChannels: 2 })),
      addEventListener: (n: string, cb: () => void) => listeners.set(n, [...(listeners.get(n) ?? []), cb]),
      removeEventListener: (n: string, cb: () => void) => listeners.set(n, (listeners.get(n) ?? []).filter((x) => x !== cb)),
      emit: (n: string) => listeners.get(n)?.forEach((l) => l()),
    };
  };
  const game = () => ({
    cache: { audio: { add: (k: string, v: unknown) => cache.set(k, v), exists: (k: string) => cache.has(k), remove: (k: string) => cache.delete(k) } },
    sound: {
      add: vi.fn((_k: string, _o: unknown) => {
        const handlers = new Map<string, () => void>();
        const s: FakeSound = {
          destroyed: false, stopped: false, rate: 1, handlers,
          volumeNode: { gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } },
          play: () => canPlay, stop() { s.stopped = true; }, destroy() { s.destroyed = true; }, setRate(r) { s.rate = r; },
          once: (e, cb) => void handlers.set(e, cb),
        };
        sounds.push(s);
        return s;
      }),
    },
  });
  beforeEach(() => { sounds = []; cache = new Map(); canPlay = true; });
  afterEach(() => vi.restoreAllMocks());

  it("usa el contexto del juego: bloqueado hasta el gesto, y avisa al cambiar su estado", async () => {
    const ctx = context();
    const b = new PhaserSfxBackend(game() as never, ctx as never);
    expect(b.kind).toBe("webaudio");
    expect(b.status()).toBe("locked");
    let changes = 0;
    b.subscribe(() => changes++);
    await b.unlock();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(b.status()).toBe("ready");
    expect(changes).toBeGreaterThan(0);
    await b.unlock();
    expect(ctx.resume).toHaveBeenCalledTimes(1); // ya desbloqueado: no insiste
    ctx.state = "closed";
    expect(b.status()).toBe("unavailable");
  });

  it("descarga, decodifica con el contexto del juego y guarda en su caché de audio con la clave del recurso", async () => {
    const ctx = context();
    const b = new PhaserSfxBackend(game() as never, ctx as never, (async () => new Response(new Uint8Array(2000))) as never);
    const loaded = await b.load("audio.sfx.x", "http://x/x.wav");
    expect(loaded).toEqual({ key: "audio.sfx.x", durationSeconds: 2, bytes: 2000 * 2 * 4 });
    expect(b.has("audio.sfx.x")).toBe(true);
    const data = await b.loadData("local:1", new ArrayBuffer(500));
    expect(data.bytes).toBe(500 * 2 * 4);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(2);
    b.unload("audio.sfx.x");
    expect(b.has("audio.sfx.x")).toBe(false);
    const failing = new PhaserSfxBackend(game() as never, ctx as never, (async () => new Response("no", { status: 404 })) as never);
    await expect(failing.load("k", "http://x/404.wav")).rejects.toThrow("HTTP 404");
  });

  it("cada voz es un sonido de Phaser que se destruye al detenerse o terminar; el volumen cambia con suavizado y la velocidad en vivo", () => {
    const ctx = context();
    const b = new PhaserSfxBackend(game() as never, ctx as never);
    const voice = b.play("k", { volume: 0.5, rate: 1.2, loop: true })!;
    const s = sounds[0];
    voice.setVolume(3);
    expect(s.volumeNode.gain.cancelScheduledValues).toHaveBeenCalledWith(5);
    expect(s.volumeNode.gain.setTargetAtTime.mock.calls[0][0]).toBe(1); // acotado a 0..1
    voice.setRate(0.7);
    expect(s.rate).toBe(0.7);
    const ended = vi.fn();
    voice.onEnd(ended);
    s.handlers.get("complete")?.();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(s.destroyed).toBe(true);
    voice.setVolume(0.2); // una voz terminada ya no hace nada
    expect(s.volumeNode.gain.setTargetAtTime).toHaveBeenCalledTimes(1);

    const second = b.play("k", { volume: 0.5, rate: 1, loop: false })!;
    second.stop();
    expect(sounds[1]).toMatchObject({ stopped: true, destroyed: true });
    second.stop(); // idempotente
  });

  it("si Phaser no logra reproducir, la voz no existe y no queda un sonido colgado", () => {
    canPlay = false;
    const b = new PhaserSfxBackend(game() as never, context() as never);
    expect(b.play("k", { volume: 1, rate: 1, loop: false })).toBeNull();
    expect(sounds[0].destroyed).toBe(true);
  });

  it("dispose suelta los avisos del contexto; el reproductor del juego es Web Audio si lo hay y HTML si no", () => {
    const ctx = context();
    const b = new PhaserSfxBackend(game() as never, ctx as never);
    let changes = 0;
    b.subscribe(() => changes++);
    b.dispose();
    ctx.emit("statechange");
    expect(changes).toBe(0);
    expect(createGameSfxBackend({ ...game(), sound: { ...game().sound, context: ctx } } as unknown as Phaser.Game).kind).toBe("webaudio");
    expect(createGameSfxBackend({ ...game(), sound: { add: vi.fn() } } as unknown as Phaser.Game).kind).toBe("html5");
  });
});
