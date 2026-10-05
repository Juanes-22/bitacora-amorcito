import { afterEach, describe, expect, it, vi } from "vitest";
import bitacoraJson from "./fixtures/realConfig";
import { ControlReasons } from "../app/controlReasons";
import { MusicPlayer, type AudioLike } from "../audio/MusicPlayer";
import type { LoadedSound } from "../audio/sfxTypes";
import type { BitacoraConfig, MapSound } from "../config/types";
import { AudioLabController } from "../dev/audio-lab/controller";
import {
  base64ToBytes, buildPackage, buildSaveRequest, bytesToBase64, changesFor, clampPreset, clampSound, draftsFromPackage, emptyDrafts, formatOf, hasDrafts, isLocalAssetId, newSound,
  parsePackage, sfxWith, soundKey, splitSoundKey, zoneSoundsWith, type Drafts, type LocalFile,
} from "../dev/audio-lab/draft";
import { AUDIO_LAB_LIMITS, type FileVersions, type SaveResult } from "../dev/audio-lab/protocol";
import { GameBridge } from "../game/bridge/GameBridge";
import { FakeBackend, flush, harness, registry } from "./fixtures/fakeSfx";

// Laboratorio de sonidos (SPEC 6.5): el modelo de borradores y el controlador, sin navegador ni audio real.

const config = bitacoraJson as unknown as BitacoraConfig;
const BASE: FileVersions = { manifest: "m", project: "p", maps: "x", config: "c", zones: { "zona-a": "a", "zona-b": "b" } };
const river = (): MapSound => structuredClone(config.maps["zona-a"].sounds!["rio-pradera"]);
const file = (key: string, over: Partial<LocalFile> = {}): LocalFile => ({ key, name: `${key}.wav`, label: `Efecto ${key}`, data: new Uint8Array([1, 2, 3]).buffer, durationSeconds: 0.5, sizeBytes: 3, decodedBytes: 1000, format: "wav", ...over });

describe("modelo de borradores (AC-93, AC-94)", () => {
  it("clampSound deja cada campo dentro del contrato", () => {
    const s = clampSound({ ...river(), volume: 3, rate: 0.1, fadeInMs: -50, fadeOutMs: 1e9, label: "   ", playback: { mode: "interval", minMs: 9000, maxMs: 100 }, innerRadius: 900, radius: 100 } as MapSound);
    expect(s).toMatchObject({ volume: 1, rate: 0.5, fadeInMs: 0, fadeOutMs: 60000, label: "Sonido", playback: { mode: "interval", minMs: 9000, maxMs: 9000 } });
    expect((s as { innerRadius: number; radius: number }).innerRadius).toBeLessThanOrEqual((s as { radius: number }).radius);
    expect(clampSound({ ...river(), volume: Number.NaN } as MapSound).volume).toBe(0);
    expect(clampPreset({ assetId: "x", volume: -1, rate: 5 })).toEqual({ assetId: "x", volume: 0, rate: 2 });
  });

  it("newSound crea un punto o un área con los valores por defecto de Tiled", () => {
    expect(newSound("point", "audio.sfx.test-wind", { x: 10.4, y: 20.6 })).toMatchObject({ shape: "point", position: { x: 10, y: 21 }, volume: 0.3, rate: 1, playback: { mode: "loop" }, enabled: true });
    expect(newSound("rect", "audio.sfx.test-wind", { x: 300, y: 300 })).toMatchObject({ shape: "rect", edgeFadePx: 80 });
  });

  it("zoneSoundsWith y sfxWith aplican los borradores sin tocar lo guardado", () => {
    const d = emptyDrafts();
    d.sounds[soundKey("zona-a", "rio-pradera")] = { ...river(), volume: 0.9 } as MapSound;
    d.sounds[soundKey("zona-a", "nuevo")] = newSound("point", "audio.sfx.test-wind", { x: 5, y: 5 });
    d.sounds[soundKey("zona-b", "otro")] = newSound("point", "audio.sfx.test-wind", { x: 5, y: 5 });
    const zone = zoneSoundsWith("zona-a", config.maps["zona-a"].sounds, d);
    expect(Object.keys(zone).sort()).toEqual(["nuevo", "pajaros-cerezo", "rio-pradera"]);
    expect(zone["rio-pradera"].volume).toBe(0.9);
    expect(config.maps["zona-a"].sounds!["rio-pradera"].volume).not.toBe(0.9);
    d.presets["ui.open"] = null;
    d.presets["portal.travel"] = { assetId: "audio.sfx.test-portal", volume: 0.2, rate: 1 };
    d.general = { volume: 0.5 };
    const sfx = sfxWith(config.audio.sfx, d)!;
    expect(sfx.events?.["ui.open"]).toBeUndefined();
    expect(sfx.events?.["portal.travel"]?.volume).toBe(0.2);
    expect(sfx.volume).toBe(0.5);
    expect(config.audio.sfx?.events?.["ui.open"]).toBeDefined();
    expect(sfxWith(undefined, emptyDrafts())).toBeUndefined();
  });

  it("changesFor reparte los borradores por alcance y traduce los archivos locales a `assetKey`", () => {
    const d: Drafts = {
      sounds: { [soundKey("zona-a", "rio-pradera")]: { ...river(), assetId: "local:7" } as MapSound, [soundKey("zona-b", "x")]: newSound("point", "audio.sfx.test-wind", { x: 1, y: 1 }) },
      presets: { "badge.earned": { assetId: "local:8", volume: 0.5, rate: 1 }, "ui.open": null },
      general: { maxVoices: 6 },
    };
    expect(changesFor(d, { kind: "emitter", zoneId: "zona-a", soundId: "rio-pradera" })).toEqual([expect.objectContaining({ type: "sound", assetKey: "7" })]);
    expect(changesFor(d, { kind: "emitter", zoneId: "zona-b", soundId: "x" })[0]).not.toHaveProperty("assetKey");
    expect(changesFor(d, { kind: "preset", event: "badge.earned" })).toEqual([expect.objectContaining({ type: "preset", assetKey: "8" })]);
    expect(changesFor(d, { kind: "preset", event: "ui.open" })).toEqual([{ type: "preset", event: "ui.open", preset: null }]);
    expect(changesFor(d, { kind: "preset", event: "portal.travel" })).toEqual([]);
    expect(changesFor(d, { kind: "general" })).toEqual([{ type: "general", sfx: { maxVoices: 6 } }]);
    expect(changesFor(d, "all")).toHaveLength(5);
    expect(hasDrafts(d)).toBe(true);
    expect(hasDrafts(emptyDrafts())).toBe(false);
  });

  it("buildSaveRequest incluye solo los archivos que el alcance usa y avisa si falta alguno", () => {
    const d: Drafts = { sounds: { [soundKey("zona-a", "rio-pradera")]: { ...river(), assetId: "local:7" } as MapSound }, presets: { "badge.earned": { assetId: "local:8", volume: 0.5, rate: 1 } }, general: {} };
    const files = new Map([["7", file("7")], ["8", file("8")]]);
    const one = buildSaveRequest(BASE, d, files, { kind: "emitter", zoneId: "zona-a", soundId: "rio-pradera" });
    expect("error" in one).toBe(false);
    if (!("error" in one)) {
      expect(one.assets.map((a) => a.key)).toEqual(["7"]);
      expect(one.assets[0]).toMatchObject({ name: "7.wav", durationSeconds: 0.5 });
      expect(base64ToBytes(one.assets[0].dataBase64).byteLength).toBe(3);
    }
    expect(buildSaveRequest(BASE, d, new Map(), "all")).toEqual({ error: expect.stringContaining("ya no está cargado") });
    expect(buildSaveRequest(BASE, emptyDrafts(), files, "all")).toEqual({ error: expect.stringContaining("no hay cambios") });
  });

  it("el paquete de ajustes se exporta, se lee y se convierte otra vez en borradores", () => {
    const d: Drafts = { sounds: { [soundKey("zona-a", "rio-pradera")]: { ...river(), assetId: "local:7", volume: 0.4 } as MapSound }, presets: { "portal.travel": { assetId: "audio.sfx.test-portal", volume: 0.1, rate: 1 } }, general: { active: false } };
    const pkg = buildPackage(BASE, d, new Map([["7", file("7")]]), new Date("2026-10-05T12:00:00Z"));
    expect("error" in pkg).toBe(false);
    if ("error" in pkg) return;
    expect(pkg).toMatchObject({ format: "bitacora-audio-lab", version: 1, exportedAt: "2026-10-05T12:00:00.000Z", base: BASE });
    const parsed = parsePackage(JSON.stringify(pkg));
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    const back = draftsFromPackage(parsed);
    expect(back.sounds[soundKey("zona-a", "rio-pradera")]).toMatchObject({ assetId: "local:7", volume: 0.4 });
    expect(back.presets["portal.travel"]?.volume).toBe(0.1);
    expect(back.general).toEqual({ active: false });
    expect(buildPackage(BASE, emptyDrafts(), new Map())).toEqual({ error: expect.any(String) });
  });

  it("parsePackage rechaza lo que no es un paquete o es de otra versión", () => {
    expect(parsePackage("no json")).toEqual({ error: "el archivo no es JSON" });
    expect(parsePackage("{}")).toEqual({ error: expect.stringContaining("no es un paquete") });
    expect(parsePackage(JSON.stringify({ format: "bitacora-audio-lab", version: 2 }))).toEqual({ error: expect.stringContaining("versión") });
    expect(parsePackage(JSON.stringify({ format: "bitacora-audio-lab", version: 1, changes: [] }))).toEqual({ error: expect.stringContaining("faltan") });
  });

  it("base64 ida y vuelta con datos grandes, y utilidades de nombres", () => {
    const big = new Uint8Array(300_000).map((_, i) => i % 251);
    expect(new Uint8Array(base64ToBytes(bytesToBase64(big.buffer)))).toEqual(big);
    expect(formatOf("a.WAV")).toBe("wav");
    expect(formatOf("a.flac")).toBeNull();
    expect(formatOf("sinextension")).toBeNull();
    expect(isLocalAssetId("local:3")).toBe(true);
    expect(isLocalAssetId("audio.sfx.test-river")).toBe(false);
    expect(splitSoundKey("zona-a/rio-pradera")).toEqual({ zoneId: "zona-a", soundId: "rio-pradera" });
  });
});

describe("AudioLabController (AC-93, AC-94)", () => {
  const storage = () => {
    const data = new Map<string, string>();
    return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  };
  const fakeAudio = (): AudioLike => ({ src: "", volume: 0, currentTime: 0, duration: 100, paused: true, preload: "", play: () => Promise.resolve(), pause: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined });
  const timers: Array<() => void> = [];
  afterEach(() => {
    timers.splice(0).forEach((t) => t());
    vi.useRealTimers();
  });

  async function setup(fetcher?: typeof fetch) {
    const h = await harness();
    h.svc.setZone("zona-a", config.maps["zona-a"].sounds, 1);
    h.svc.setListener({ x: 200, y: 200 });
    const bridge = new GameBridge();
    const controls = new ControlReasons(bridge);
    const published: string[][] = [];
    bridge.on("app:controls", (e) => published.push([...e.reasons]));
    const music = new MusicPlayer({ tracks: [{ id: "a", url: "a.mp3", title: "A", artist: "" }], order: "sequential", volume: 0.3, crossfadeMs: 100 }, false, { createAudio: fakeAudio, visibility: { isHidden: () => false, subscribe: () => () => undefined } });
    const store = storage();
    const clock = { now: 0 };
    const lab = new AudioLabController({ sfx: h.svc, music, config, assets: registry, controls, fetcher, storage: store, now: () => clock.now });
    timers.push(() => lab.dispose());
    return { h, lab, controls, published, music, store, clock };
  }
  const okResult = (over: Partial<Extract<SaveResult, { ok: true }>> = {}): SaveResult => ({ ok: true, versions: { ...BASE, maps: "nueva" }, saved: ["zona-a.rio-pradera: actualizado"], assets: {}, warnings: [], ...over });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fakeServer = (save: (body: unknown, url: string) => Response | Promise<Response> = () => json(okResult())) => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });
      if (String(url).endsWith("/state")) return json({ ok: true, versions: BASE, zones: ["zona-a", "zona-b"] });
      return save(body, String(url));
    }) as unknown as typeof fetch;
    return { fetcher, calls };
  };

  it("abrir congela el mapa con el motivo «audio-lab» y cerrar lo quita junto con el oyente virtual, las pruebas y el solo", async () => {
    const { lab, controls, h, music } = await setup(fakeServer().fetcher);
    await lab.opened();
    expect(controls.has("audio-lab")).toBe(true);
    expect(h.svc.diagnostics().listenerVirtual).toBe(true);
    await lab.playEmitter("zona-a", "rio-pradera");
    lab.select({ kind: "emitter", zoneId: "zona-a", soundId: "rio-pradera" });
    lab.setSolo(true);
    expect(music.mixGain).toBe(0);
    lab.closed();
    expect(controls.has("audio-lab")).toBe(false);
    expect(h.svc.diagnostics().listenerVirtual).toBe(false);
    expect(h.svc.diagnostics().voices.filter((v) => v.kind === "test")).toHaveLength(0);
    expect(music.mixGain).toBe(1);
    expect(lab.getState().solo).toBe(false);
  });

  it("el modo recorrido quita la pausa y vuelve a poner al oyente en Vanessa; las reglas de otros motivos siguen intactas", async () => {
    const { lab, controls } = await setup(fakeServer().fetcher);
    controls.add("reading");
    await lab.opened();
    lab.setMode("walking");
    expect(controls.has("audio-lab")).toBe(false);
    expect(controls.has("reading")).toBe(true); // el laboratorio no pisa los motivos de la lectura
    lab.setMode("virtual");
    expect(controls.has("audio-lab")).toBe(true);
  });

  it("editar crea un borrador; volver al valor guardado lo quita; restablecer descarta", async () => {
    const { lab } = await setup(fakeServer().fetcher);
    const saved = lab.savedSound("zona-a", "rio-pradera")!;
    lab.editSound("zona-a", "rio-pradera", { ...saved, volume: 0.9 } as MapSound);
    expect(lab.dirty).toBe(true);
    expect(lab.soundOf("zona-a", "rio-pradera")?.volume).toBe(0.9);
    lab.editSound("zona-a", "rio-pradera", saved);
    expect(lab.dirty).toBe(false);
    lab.editSound("zona-a", "rio-pradera", { ...saved, rate: 1.5 } as MapSound);
    lab.reset({ kind: "emitter", zoneId: "zona-a", soundId: "rio-pradera" });
    expect(lab.dirty).toBe(false);
    expect(lab.soundOf("zona-a", "rio-pradera")).toEqual(saved);
  });

  it("un cambio sobre un emisor que suena en el mapa se aplica en vivo; «Aplicar a esta sesión» incluye los emisores nuevos", async () => {
    const { lab, h } = await setup(fakeServer().fetcher);
    const saved = lab.savedSound("zona-a", "rio-pradera")!;
    lab.editSound("zona-a", "rio-pradera", { ...saved, volume: 0.77 } as MapSound);
    expect(h.svc.liveSound("rio-pradera")?.volume).toBe(0.77);
    lab.select(null);
    const id = lab.addEmitter("point", "audio.sfx.test-wind");
    expect(h.svc.emitterIds()).not.toContain(id); // aún solo es un borrador
    lab.apply();
    expect(h.svc.emitterIds()).toContain(id);
    expect(lab.getState().applied).toBe(true);
    lab.reset("all");
    expect(h.svc.emitterIds()).not.toContain(id);
    expect(h.svc.liveSound("rio-pradera")?.volume).toBe(saved.volume);
  });

  it("los ajustes generales y los presets son borradores que se aplican y se restablecen", async () => {
    const { lab, h } = await setup(fakeServer().fetcher);
    lab.editGeneral({ volume: 0.2, maxVoices: 3 });
    expect(h.svc.master).toBe(0.2);
    expect(lab.getState().drafts.general).toEqual({ volume: 0.2, maxVoices: 3 });
    lab.editGeneral({ volume: config.audio.sfx!.volume }); // vuelve al guardado: deja de ser borrador
    expect(lab.getState().drafts.general).toEqual({ maxVoices: 3 });
    lab.editPreset("ui.open", { assetId: "audio.sfx.test-ui-confirm", volume: 0.9, rate: 1.5 });
    expect(lab.presetOf("ui.open")).toEqual({ assetId: "audio.sfx.test-ui-confirm", volume: 0.9, rate: 1.5 });
    lab.editPreset("ui.open", null);
    expect(lab.presetOf("ui.open")).toBeNull();
    lab.reset({ kind: "preset", event: "ui.open" });
    expect(lab.presetOf("ui.open")).toEqual(config.audio.sfx!.events!["ui.open"]);
    lab.reset("all");
    expect(h.svc.master).toBe(config.audio.sfx!.volume);
  });

  it("«Probar» respeta el silencio global, aplica la distancia y los cambios en vivo, y «Detener» apaga con el fundido", async () => {
    const { lab, h, clock } = await setup(fakeServer().fetcher);
    await lab.opened();
    lab.moveListener({ x: 1110, y: 780 }); // sobre el río
    await lab.playEmitter("zona-a", "rio-pradera");
    await flush();
    const voice = () => h.svc.diagnostics().voices.find((v) => v.kind === "test");
    expect(voice()).toMatchObject({ kind: "test", key: "audio.sfx.test-river", loop: true });
    expect(voice()?.factors.spatial).toBe(1);
    lab.moveListener({ x: 1110 + 150, y: 780 });
    clock.now += 100;
    (lab as unknown as { step(): void }).step();
    expect(voice()?.factors.spatial).toBeLessThan(1);
    expect(voice()?.factors.spatial).toBeGreaterThan(0);
    lab.setSpatialTest(false);
    clock.now += 100;
    (lab as unknown as { step(): void }).step();
    expect(voice()?.factors.spatial).toBe(1);
    lab.editSound("zona-a", "rio-pradera", { ...lab.soundOf("zona-a", "rio-pradera")!, volume: 0.05 } as MapSound);
    clock.now += 100;
    (lab as unknown as { step(): void }).step();
    expect(voice()?.factors.base).toBe(0.05);
    lab.stopEmitter("zona-a", "rio-pradera");
    clock.now += 1000; // más que el fundido de salida
    (lab as unknown as { step(): void }).step();
    expect(voice()).toBeUndefined();
    // Silenciado el juego, la prueba no suena y se explica por qué
    h.svc.setMuted(true);
    await lab.playEmitter("zona-a", "rio-pradera");
    expect(voice()).toBeUndefined();
    expect(lab.getState().notice).toContain("silenciado");
  });

  it("«Detener todo» calla también el ambiente hasta «Reanudar»", async () => {
    const { lab, h } = await setup(fakeServer().fetcher);
    lab.moveListener({ x: 1110, y: 780 });
    h.svc.setListener({ x: 1110, y: 780 });
    await flush();
    h.advance(1500);
    expect(h.svc.diagnostics().voices.some((v) => v.kind === "ambient")).toBe(true);
    lab.stopAll();
    h.advance(1500);
    expect(h.svc.diagnostics().voices).toHaveLength(0);
    expect(lab.getState().ambientPaused).toBe(true);
    lab.resumeAmbient();
    h.advance(1500);
    expect(h.svc.diagnostics().voices.some((v) => v.kind === "ambient")).toBe(true);
  });

  it("guardar: comprueba, manda los cambios del alcance con las huellas vistas y deja el borrador limpio", async () => {
    const server = fakeServer();
    const { lab } = await setup(server.fetcher);
    await lab.opened();
    const sel = { kind: "emitter", zoneId: "zona-a", soundId: "rio-pradera" } as const;
    lab.select(sel);
    expect(lab.canSave(sel)).toContain("No hay cambios");
    lab.editSound("zona-a", "rio-pradera", { ...lab.savedSound("zona-a", "rio-pradera")!, volume: 0.6 } as MapSound);
    expect(lab.canSave(sel)).toBeNull();
    await lab.save(sel, true);
    expect(lab.getState().save.status).toBe("ok");
    expect(server.calls.at(-1)?.url).toContain("dryRun=1");
    expect(lab.dirty).toBe(true); // comprobar no guarda
    await lab.save(sel);
    const last = server.calls.at(-1)!;
    expect(last.url).toBe("/__audio-lab/save");
    expect(last.body).toMatchObject({ version: 1, base: BASE, assets: [], changes: [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera" }] });
    expect(lab.getState().save.status).toBe("ok");
    expect(lab.dirty).toBe(false);
    expect(lab.getState().server.versions?.maps).toBe("nueva");
  });

  it("un conflicto o un error del servidor deja el borrador y muestra los motivos; sin servidor se explica", async () => {
    const conflict = fakeServer(() => json({ ok: false, reason: "conflict", errors: ["cambió en el disco desde que se abrió"], changed: ["x"] }, 409));
    const { lab } = await setup(conflict.fetcher);
    await lab.opened();
    const sel = { kind: "emitter", zoneId: "zona-a", soundId: "rio-pradera" } as const;
    lab.editSound("zona-a", "rio-pradera", { ...lab.savedSound("zona-a", "rio-pradera")!, volume: 0.6 } as MapSound);
    await lab.save(sel);
    expect(lab.getState().save).toMatchObject({ status: "error", messages: ["cambió en el disco desde que se abrió"] });
    expect(lab.dirty).toBe(true);

    const offline = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const second = await setup(offline);
    await second.lab.opened();
    expect(second.lab.getState().server.status).toBe("offline");
    second.lab.select(sel);
    expect(second.lab.canSave(sel)).toContain("npm run dev");
  });

  it("no se puede guardar un emisor de una zona sin mapa de Tiled", async () => {
    const server = fakeServer();
    const { lab } = await setup(server.fetcher);
    await lab.opened();
    lab.select({ kind: "emitter", zoneId: "zona-a", soundId: "rio-pradera" });
    const sound = newSound("point", "audio.sfx.test-wind", { x: 5, y: 5 });
    lab.editSound("zona-z", "nuevo", sound);
    expect(lab.canSave({ kind: "emitter", zoneId: "zona-z", soundId: "nuevo" })).toContain("no tiene mapa de Tiled");
  });

  it("los borradores y la selección sobreviven a recargar la página (sin los archivos locales)", async () => {
    const { lab, store } = await setup(fakeServer().fetcher);
    lab.select({ kind: "emitter", zoneId: "zona-a", soundId: "rio-pradera" });
    lab.editSound("zona-a", "rio-pradera", { ...lab.savedSound("zona-a", "rio-pradera")!, volume: 0.66 } as MapSound);
    lab.editSound("zona-a", "con-archivo", { ...newSound("point", "local:1", { x: 5, y: 5 }) });
    const saved = JSON.parse(store.data.get("bitacora:audio-lab:v1") as string);
    expect(saved.drafts.sounds["zona-a/rio-pradera"].volume).toBe(0.66);
    expect(saved.drafts.sounds["zona-a/con-archivo"]).toBeUndefined(); // un archivo local no sobrevive a una recarga
    expect(saved.selection).toEqual({ kind: "emitter", zoneId: "zona-a", soundId: "rio-pradera" });
  });

  it("archivos de prueba: rechaza formatos y tamaños, y acepta uno válido con su duración", async () => {
    const { lab } = await setup(fakeServer().fetcher);
    await lab.addFiles([new File([new Uint8Array(10)], "malo.flac")]);
    expect(lab.getState().notice).toContain("formato no admitido");
    await lab.addFiles([new File([new Uint8Array(AUDIO_LAB_LIMITS.maxFileBytes + 1)], "grande.wav")]);
    expect(lab.getState().notice).toContain("el máximo es 8 MB");
    await lab.addFiles([new File([new Uint8Array(2000)], "bueno.wav")]);
    expect(lab.getState().files).toHaveLength(1);
    expect(lab.getState().files[0]).toMatchObject({ name: "bueno.wav", format: "wav", durationSeconds: 1 });
  });

  it("la última selección gana: una decodificación lenta de una selección anterior se descarta y libera su memoria", async () => {
    const { lab, h } = await setup(fakeServer().fetcher);
    const backend = h.backend as FakeBackend;
    const original = backend.loadData.bind(backend);
    const gates: Array<() => void> = [];
    backend.loadData = async (key: string, data: ArrayBuffer): Promise<LoadedSound> => {
      await new Promise<void>((r) => gates.push(r));
      return original(key, data);
    };
    const first = lab.addFiles([new File([new Uint8Array(100)], "lento.wav")]);
    await flush();
    const second = lab.addFiles([new File([new Uint8Array(200)], "nuevo.wav")]);
    await flush();
    gates.splice(0).forEach((g) => g());
    await Promise.all([first, second]);
    expect(lab.getState().files.map((f) => f.name)).toEqual(["nuevo.wav"]);
    expect([...backend.loaded.keys()].filter((k) => k.startsWith("local:"))).toHaveLength(1);
  });

  it("la memoria de prueba tiene tope: descarta archivos sin uso y se niega a descartar uno que usa un ajuste", async () => {
    const { lab, h } = await setup(fakeServer().fetcher);
    const backend = h.backend as FakeBackend;
    backend.loadData = async (key: string): Promise<LoadedSound> => {
      backend.loaded.set(key, 40 * 1024 * 1024);
      return { key, durationSeconds: 1, bytes: 40 * 1024 * 1024 };
    };
    await lab.addFiles([new File([new Uint8Array(10)], "uno.wav")]);
    await lab.addFiles([new File([new Uint8Array(10)], "dos.wav")]);
    expect(lab.getState().files.map((f) => f.name)).toEqual(["dos.wav"]); // 40 + 40 MB no caben en 64: el viejo sin uso se libera
    lab.editSound("zona-a", "rio-pradera", { ...lab.savedSound("zona-a", "rio-pradera")!, assetId: "local:2" } as MapSound);
    await lab.addFiles([new File([new Uint8Array(10)], "tres.wav")]);
    expect(lab.getState().files.map((f) => f.name)).toEqual(["dos.wav"]); // lo usa un ajuste: no se descarta
    expect(lab.getState().notice).toContain("no cabe");
    lab.removeFile("2");
    expect(lab.getState().notice).toContain("lo usa un ajuste");
  });

  it("exportar e importar: el paquete devuelve los mismos borradores (con sus archivos)", async () => {
    const a = await setup(fakeServer().fetcher);
    await a.lab.opened();
    await a.lab.addFiles([new File([new Uint8Array([9, 8, 7, 6])], "mio.wav")]);
    a.lab.editSound("zona-a", "rio-pradera", { ...a.lab.savedSound("zona-a", "rio-pradera")!, assetId: "local:1", volume: 0.12 } as MapSound);
    a.lab.editPreset("ui.open", { assetId: "audio.sfx.test-ui-confirm", volume: 0.4, rate: 1 });
    const out = a.lab.exportText();
    expect("error" in out).toBe(false);
    if ("error" in out) return;
    expect(out.name).toMatch(/^ajustes-sonidos-.*\.json$/);
    const b = await setup(fakeServer().fetcher);
    await b.lab.importText(out.text);
    expect(b.lab.soundOf("zona-a", "rio-pradera")).toMatchObject({ volume: 0.12 });
    expect(b.lab.getState().files).toHaveLength(1);
    expect(isLocalAssetId(b.lab.soundOf("zona-a", "rio-pradera")!.assetId)).toBe(true);
    expect(b.lab.presetOf("ui.open")?.volume).toBe(0.4);
    await b.lab.importText("esto no es un paquete");
    expect(b.lab.getState().notice).toContain("No se pudo importar");
  });
});
