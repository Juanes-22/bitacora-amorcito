import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MapSound, MapsFile, SfxConfig } from "../src/config/types";
import { AUDIO_LAB_HEADER, AUDIO_LAB_ROUTE, type SaveRequest, type SaveResult } from "../src/dev/audio-lab/protocol";
import { readAudioSfx, setAudioSfx } from "./lib/audio-lab/configText";
import { acquireSaveLock, isSaveLocked, SaveBusyError } from "./lib/audio-lab/lock";
import { saveAudioLab, validateRequest } from "./lib/audio-lab/save";
import { patchSound, PatchError, findSoundObject, listSoundIds } from "./lib/audio-lab/tmj";
import { readVersions } from "./lib/audio-lab/versions";
import { inspectAudioFile, AudioFileError, slugify } from "./lib/audio-lab/audioFile";
import { defaultPaths, type Paths } from "./lib/tiled/files";
import { runImport } from "./lib/tiled/run";
import type { TiledMap } from "./lib/tiled/types";
import { rejectReason, setupAudioLab } from "./vite/audioLab";
import { ReloadGate } from "./vite/reloadGate";

// Guardado del laboratorio de sonidos (SPEC 6.5) sobre COPIAS temporales del proyecto: nunca se escribe en el repositorio.

// Cada guardado valida el proyecto entero (como `tiled:check`) y cada prueba monta su propia copia: con la suite completa en paralelo tarda.
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

const real = defaultPaths();
const COPIED = ["public/config", "public/assets/assets.json", "public/assets/audio/sfx", "tools/tiled"];
const SKIP = new Set(["tools/tiled/backups", "tools/tiled/previews", "tools/tiled/bitacora.tiled-session", "tools/tiled/.audio-lab.lock"]);
const dirs: string[] = [];

/** Copia lo que se escribe y enlaza lo pesado (imágenes, música): lo suficiente para que el importador valide como en el proyecto real. */
function mirror(source: string, target: string, rel: string): void {
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(source)) {
    const r = `${rel}/${name}`;
    if (SKIP.has(r)) continue;
    if (COPIED.includes(r)) cpSync(join(source, name), join(target, name), { recursive: true, filter: (f) => !SKIP.has(`${rel}/${f.slice(source.length + 1)}`) });
    else if (COPIED.some((c) => c.startsWith(`${r}/`))) mirror(join(source, name), join(target, name), r);
    else symlinkSync(join(source, name), join(target, name));
  }
}
function workspace(): Paths {
  const root = mkdtempSync(join(tmpdir(), "audio-lab-ws-"));
  dirs.push(root);
  mirror(join(real.root, "public"), join(root, "public"), "public");
  mirror(join(real.root, "tools"), join(root, "tools"), "tools");
  return defaultPaths(root);
}
afterAll(() => {
  for (const d of dirs) {
    try {
      chmodSync(join(d, "tools/tiled/maps"), 0o755);
    } catch {
      /* ya no está */
    }
    rmSync(d, { recursive: true, force: true });
  }
});

const text = (f: string) => readFileSync(f, "utf8");
const sha = (f: string | Buffer) => createHash("sha256").update(typeof f === "string" ? readFileSync(f) : f).digest("hex");
const mapsOf = (p: Paths) => JSON.parse(text(p.mapsFile)) as MapsFile;
const tmjOf = (p: Paths, zone: string) => JSON.parse(text(join(p.mapsDir, `${zone}.tmj`))) as TiledMap;
const snapshot = (p: Paths) => Object.fromEntries([p.configFile, p.mapsFile, p.manifestFile, p.projectFile, join(p.mapsDir, "zona-a.tmj"), join(p.mapsDir, "zona-b.tmj")].map((f) => [f.slice(p.root.length), sha(f)]));
const river = (p: Paths): MapSound => mapsOf(p).maps["zona-a"].sounds!["rio-pradera"];
const lines = (a: string, b: string) => {
  const x = a.split("\n");
  const y = b.split("\n");
  return Math.max(x.length, y.length) - x.filter((l, i) => l === y[i]).length;
};

/** Un WAV PCM de 16 bits, mono, 22 050 Hz y `ms` milisegundos, con un tono: lo suficiente para que el servidor lo mida. */
function wav(ms = 300, hz = 440): Buffer {
  const rate = 22050;
  const n = Math.round((rate * ms) / 1000);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * hz * i) / rate)), 44 + i * 2);
  return b;
}
const asset = (key: string, name: string, bytes: Buffer, durationSeconds = 0.3) => ({ key, name, dataBase64: bytes.toString("base64"), durationSeconds });
const request = (p: Paths, changes: SaveRequest["changes"], assets: SaveRequest["assets"] = []): SaveRequest => ({ version: 1, base: readVersions(p), assets, changes });
const withRiver = (p: Paths, patch: Partial<MapSound>): MapSound => ({ ...river(p), ...patch }) as MapSound;
const ok = (r: SaveResult) => {
  if (!r.ok) throw new Error(`se esperaba éxito: ${r.reason}: ${r.errors.join(" | ")}`);
  return r;
};

describe("saveAudioLab: un emisor del mapa (AC-94)", () => {
  it("actualiza el objeto de Tiled y maps.json y deja bitacora.json y assets.json byte a byte iguales", async () => {
    const p = workspace();
    const before = snapshot(p);
    const versionsBefore = readVersions(p);
    const r = ok(await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.4, rate: 1.25 }) }])));
    const after = snapshot(p);
    expect(river(p)).toMatchObject({ volume: 0.4, rate: 1.25 });
    expect(after["/public/config/bitacora.json"]).toBe(before["/public/config/bitacora.json"]);
    expect(after["/public/assets/assets.json"]).toBe(before["/public/assets/assets.json"]);
    expect(after["/tools/tiled/maps/zona-b.tmj"]).toBe(before["/tools/tiled/maps/zona-b.tmj"]);
    expect(after["/tools/tiled/maps/zona-a.tmj"]).not.toBe(before["/tools/tiled/maps/zona-a.tmj"]);
    expect(r.versions.maps).not.toBe(versionsBefore.maps);
    expect(r.versions.zones["zona-a"]).not.toBe(versionsBefore.zones["zona-a"]);
    expect(r.versions.config).toBe(versionsBefore.config);
    // Tiled y maps.json coinciden: la comprobación que hace el build no encuentra nada pendiente.
    const check = runImport(p, { apply: false });
    expect(check.ok && check.inSync).toBe(true);
  });

  it("un valor que no cambia no reescribe nada", async () => {
    const p = workspace();
    const before = snapshot(p);
    const r = ok(await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: river(p) }])));
    expect(snapshot(p)).toEqual(before);
    expect(r.saved.join(" ")).toContain("sin cambios");
  });

  it("crea un emisor nuevo con su capa y objeto en Tiled y lo importa", async () => {
    const p = workspace();
    const sound: MapSound = { label: "Grillos", assetId: "audio.sfx.test-wind", enabled: true, volume: 0.2, rate: 1, fadeInMs: 100, fadeOutMs: 100, playback: { mode: "loop" }, shape: "point", position: { x: 300, y: 400 }, innerRadius: 30, radius: 200 };
    ok(await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "grillos", sound }])));
    expect(mapsOf(p).maps["zona-a"].sounds!.grillos).toMatchObject({ label: "Grillos", position: { x: 300, y: 400 } });
    expect(listSoundIds(tmjOf(p, "zona-a"))).toContain("grillos");
  });

  it("cambia la posición convirtiendo las coordenadas del mundo a las locales de la capa", async () => {
    const p = workspace();
    const map = tmjOf(p, "zona-a");
    const layer = map.layers.find((l) => l.name === "sonidos");
    expect(layer).toBeTruthy();
    // Una capa desplazada: el objeto guarda coordenadas locales, el mundo las ve sumadas.
    (layer as { offsetx?: number; offsety?: number }).offsetx = 40;
    (layer as { offsetx?: number; offsety?: number }).offsety = -20;
    writeFileSync(join(p.mapsDir, "zona-a.tmj"), JSON.stringify(map, null, 1));
    runImport(p, { apply: true }); // maps.json al día con la capa desplazada
    const sound = river(p);
    const moved = { ...sound, position: { x: (sound as { position: { x: number; y: number } }).position.x + 100, y: (sound as { position: { x: number; y: number } }).position.y + 50 } } as MapSound;
    ok(await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: moved }])));
    expect((river(p) as { position: { x: number; y: number } }).position).toEqual((moved as { position: { x: number; y: number } }).position);
    const located = findSoundObject(tmjOf(p, "zona-a"), "rio-pradera");
    expect(located?.dx).toBe(40);
    expect(located?.dy).toBe(-20);
  });

  it("un valor inválido se rechaza con un error claro y no se escribe nada", async () => {
    const p = workspace();
    const before = snapshot(p);
    const r = await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { assetId: "audio.music.beyond-the-clouds" }) }]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid");
      expect(r.errors.join(" ")).toMatch(/sfx|audio\.music\.beyond-the-clouds/);
    }
    expect(snapshot(p)).toEqual(before);
  });

  it("una zona sin mapa de Tiled se rechaza", async () => {
    const p = workspace();
    const r = await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-z", soundId: "x", sound: river(p) }]));
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("no cambia la forma de un objeto existente (punto ↔ área)", async () => {
    const p = workspace();
    const area: MapSound = { label: "Área", assetId: "audio.sfx.test-wind", enabled: true, volume: 0.2, rate: 1, fadeInMs: 0, fadeOutMs: 0, playback: { mode: "loop" }, shape: "rect", area: { x: 0, y: 0, width: 100, height: 100 }, edgeFadePx: 10 };
    const r = await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: area }]));
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
    if (!r.ok) expect(r.errors.join(" ")).toContain("forma");
  });
});

describe("saveAudioLab: conflictos y cerrojo (AC-94)", () => {
  it("si un archivo que se iba a escribir cambió desde que lo vio el panel, es un conflicto y no se escribe nada", async () => {
    const p = workspace();
    const req = request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.4 }) }]);
    const file = join(p.mapsDir, "zona-a.tmj");
    writeFileSync(file, text(file).replace(/"value":\s*0\.25(?!\d)/, '"value": 0.26'));
    const before = snapshot(p);
    const r = await saveAudioLab(p, req);
    expect(r).toMatchObject({ ok: false, reason: "conflict" });
    if (!r.ok) expect(r.errors.join(" ")).toContain("cambió en el disco");
    expect(snapshot(p)).toEqual(before);
  });

  it("un cambio en un archivo que NO se va a tocar no es conflicto", async () => {
    const p = workspace();
    const req = request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.4 }) }]);
    const other = join(p.mapsDir, "zona-b.tmj");
    writeFileSync(other, text(other)); // misma ruta, mismo contenido: no cambia nada
    ok(await saveAudioLab(p, req));
    const stale = request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.5 }) }]);
    const cfg = p.configFile;
    writeFileSync(cfg, `${text(cfg)}\n`); // bitacora.json cambió, pero este guardado no lo escribe
    const r = await saveAudioLab(p, { ...stale, base: { ...stale.base, config: "otra-huella" } });
    expect(r.ok).toBe(true);
  });

  it("dos guardados seguidos se serializan y el segundo ve el resultado del primero", async () => {
    const p = workspace();
    const first = request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.31 }) }]);
    const second = { ...first, changes: [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.32 }) }] as SaveRequest["changes"] };
    const [a, b] = await Promise.all([saveAudioLab(p, first), saveAudioLab(p, second, { ignoreBase: true })]);
    expect(a.ok && b.ok).toBe(true);
    expect(river(p).volume).toBe(0.32);
  });

  it("el cerrojo existe mientras se guarda, impide un segundo guardado y se libera siempre", async () => {
    const p = workspace();
    expect(isSaveLocked(p)).toBe(false);
    const release = acquireSaveLock(p);
    expect(isSaveLocked(p)).toBe(true);
    expect(() => acquireSaveLock(p)).toThrow(SaveBusyError);
    const r = await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.4 }) }]));
    expect(r).toMatchObject({ ok: false, reason: "busy" });
    release();
    expect(isSaveLocked(p)).toBe(false);
    ok(await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.4 }) }])));
    expect(isSaveLocked(p)).toBe(false);
  });

  it("un cerrojo viejo (de un guardado que murió) se ignora", () => {
    const p = workspace();
    const release = acquireSaveLock(p);
    expect(isSaveLocked(p, Date.now() + 10 * 60 * 1000)).toBe(false);
    release();
  });

  it("«dryRun» valida sin escribir ni dejar cerrojo", async () => {
    const p = workspace();
    const before = snapshot(p);
    const r = ok(await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.4 }) }]), { dryRun: true }));
    expect(r.saved.join(" ")).toContain("actualizado");
    expect(snapshot(p)).toEqual(before);
    expect(isSaveLocked(p)).toBe(false);
  });

  it("avisa de cuándo empieza y termina de escribir y con qué archivos, para recargar una sola vez", async () => {
    const p = workspace();
    const calls: string[] = [];
    ok(await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.4 }) }]), { onWrite: { begin: () => calls.push("begin"), end: (w) => calls.push(`end:${w.length}`) } }));
    expect(calls[0]).toBe("begin");
    expect(calls[1]).toMatch(/^end:[2-9]/);
  });
});

describe("saveAudioLab: presets y ajustes generales (AC-94)", () => {
  it("un preset solo cambia la región audio.sfx de bitacora.json", async () => {
    const p = workspace();
    const before = text(p.configFile);
    const mapsBefore = text(p.mapsFile);
    const tmjBefore = sha(join(p.mapsDir, "zona-a.tmj"));
    const preset = { assetId: "audio.sfx.test-badge", volume: 0.3, rate: 1.1 };
    ok(await saveAudioLab(p, request(p, [{ type: "preset", event: "badge.earned", preset }])));
    const after = text(p.configFile);
    expect(readAudioSfx(after)?.events?.["badge.earned"]).toEqual(preset);
    expect(lines(before, after)).toBeLessThanOrEqual(2);
    expect(JSON.stringify({ ...JSON.parse(after), audio: null })).toBe(JSON.stringify({ ...JSON.parse(before), audio: null }));
    expect(text(p.mapsFile)).toBe(mapsBefore);
    expect(sha(join(p.mapsDir, "zona-a.tmj"))).toBe(tmjBefore);
  });

  it("quitar un preset (null) lo borra del archivo", async () => {
    const p = workspace();
    ok(await saveAudioLab(p, request(p, [{ type: "preset", event: "portal.travel", preset: null }])));
    expect(readAudioSfx(text(p.configFile))?.events?.["portal.travel"]).toBeUndefined();
    expect(readAudioSfx(text(p.configFile))?.events?.["ui.open"]).toBeDefined();
  });

  it("los ajustes generales cambian el volumen y el límite de voces dentro de sus límites", async () => {
    const p = workspace();
    ok(await saveAudioLab(p, request(p, [{ type: "general", sfx: { volume: 0.55, maxVoices: 8 } }])));
    expect(readAudioSfx(text(p.configFile))).toMatchObject({ volume: 0.55, maxVoices: 8, active: true });
    const bad = await saveAudioLab(p, request(p, [{ type: "general", sfx: { maxVoices: 200 } }]));
    expect(bad.ok).toBe(false);
  });

  it("un preset con un recurso que no es de efectos se rechaza", async () => {
    const p = workspace();
    const before = snapshot(p);
    const r = await saveAudioLab(p, request(p, [{ type: "preset", event: "ui.open", preset: { assetId: "audio.music.beyond-the-clouds", volume: 0.3, rate: 1 } }]));
    expect(r.ok).toBe(false);
    expect(snapshot(p)).toEqual(before);
  });

  it("setAudioSfx añade audio.sfx si falta, sin tocar audio.music", () => {
    const base = '{\n  "audio": {\n    "music": {\n      "active": true\n    }\n  }\n}\n';
    const sfx: SfxConfig = { active: true, volume: 0.5, maxVoices: 4 };
    const out = setAudioSfx(base, sfx);
    expect(JSON.parse(out).audio.music).toEqual({ active: true });
    expect(readAudioSfx(out)).toEqual(sfx);
    expect(setAudioSfx(out, { ...sfx, volume: 0.6 }).length).toBeGreaterThan(0);
    expect(readAudioSfx(base)).toBeUndefined();
  });
});

describe("saveAudioLab: archivos nuevos en el catálogo (AC-94)", () => {
  it("copia el archivo, lo registra con sha256, tamaño y duración medidos, y lo usa el emisor", async () => {
    const p = workspace();
    const bytes = wav(400);
    const manifestBefore = text(p.manifestFile);
    const r = ok(await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { assetId: "local:1" }), assetKey: "1" }], [asset("1", "Tono Nuevo.wav", bytes, 99)])));
    const id = r.assets["1"];
    expect(id).toBe("audio.sfx.tono-nuevo");
    const manifest = JSON.parse(text(p.manifestFile));
    expect(manifest.assets[id]).toMatchObject({ kind: "sfx", type: "audio", category: "audio", format: "wav", sizeBytes: bytes.length, sha256: sha(bytes), path: "audio/sfx/tono-nuevo.wav" });
    expect(manifest.assets[id].durationSeconds).toBeCloseTo(0.4, 2); // la mide el servidor, no se confía en el 99 que dijo el cliente
    expect(sha(join(p.assetsDir, "audio/sfx/tono-nuevo.wav"))).toBe(sha(bytes));
    expect(river(p).assetId).toBe(id);
    expect(manifest.assetCount).toBe(Object.keys(manifest.assets).length);
    // El texto del resto del catálogo no se reescribe: solo cambian los contadores y la coma del último elemento, y se añade la entrada.
    const afterLines = new Set(text(p.manifestFile).split("\n"));
    const removed = manifestBefore.split("\n").filter((l) => !afterLines.has(l));
    expect(removed.length).toBeLessThanOrEqual(4);
  });

  it("el mismo contenido que ya está en el catálogo se reutiliza (no se duplica)", async () => {
    const p = workspace();
    const existing = readFileSync(join(p.assetsDir, "audio/sfx/test-wind.wav"));
    const r = ok(await saveAudioLab(p, request(p, [{ type: "asset", assetKey: "k" }], [asset("k", "otro-nombre.wav", existing, 1)])));
    expect(r.assets.k).toBe("audio.sfx.test-wind");
    expect(existsSync(join(p.assetsDir, "audio/sfx/otro-nombre.wav"))).toBe(false);
  });

  it("dos archivos distintos con el mismo nombre reciben IDs y archivos distintos, sin sustituir nada", async () => {
    const p = workspace();
    const a = wav(200, 300);
    const b = wav(200, 500);
    const r = ok(await saveAudioLab(p, request(p, [{ type: "asset", assetKey: "a" }, { type: "asset", assetKey: "b" }], [asset("a", "tono.wav", a, 0.2), asset("b", "tono.wav", b, 0.2)])));
    expect(new Set([r.assets.a, r.assets.b]).size).toBe(2);
    expect(sha(join(p.assetsDir, "audio/sfx/tono.wav"))).toBe(sha(a));
    expect(sha(join(p.assetsDir, "audio/sfx/tono-2.wav"))).toBe(sha(b));
  });

  it("rechaza un formato no admitido, un contenido que no es lo que dice su extensión y un archivo demasiado largo", async () => {
    const p = workspace();
    const before = snapshot(p);
    for (const [name, bytes, message] of [
      ["x.flac", wav(100), /formato/],
      ["x.wav", Buffer.from("esto no es un wav, es texto plano de más de doce bytes"), /contenido/],
      ["largo.wav", wav(61_000), /dura/],
    ] as const) {
      const r = await saveAudioLab(p, request(p, [{ type: "asset", assetKey: "k" }], [asset("k", name, bytes, 1)]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join(" ")).toMatch(message);
    }
    expect(snapshot(p)).toEqual(before);
    expect(readdirSync(join(p.assetsDir, "audio/sfx")).filter((f) => !f.startsWith("test-"))).toEqual([]);
  });

  it("si la escritura falla a medias, se recupera TODO (catálogo, archivo copiado y mapas)", async () => {
    if (process.getuid?.() === 0) return; // como administrador los permisos no impiden escribir
    const p = workspace();
    const before = snapshot(p);
    const filesBefore = readdirSync(join(p.assetsDir, "audio/sfx")).sort();
    chmodSync(p.mapsDir, 0o555); // el mapa de Tiled no se podrá reemplazar: falla DESPUÉS de haber escrito el catálogo
    const r = await saveAudioLab(p, request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { assetId: "local:1" }), assetKey: "1" }], [asset("1", "recuperable.wav", wav(150), 0.15)]));
    chmodSync(p.mapsDir, 0o755);
    expect(r.ok).toBe(false);
    expect(snapshot(p)).toEqual(before);
    expect(readdirSync(join(p.assetsDir, "audio/sfx")).sort()).toEqual(filesBefore);
    expect(isSaveLocked(p)).toBe(false);
  });
});

describe("validateRequest, audioFile y parcheo de Tiled", () => {
  it("rechaza solicitudes mal formadas con la causa", () => {
    expect(validateRequest(null)).toEqual(["la solicitud no es de la versión 1"]);
    expect(validateRequest({ version: 1, base: {}, assets: [], changes: [] })[0]).toContain("no hay cambios");
    expect(validateRequest({ version: 1, base: {}, assets: [], changes: [{ type: "preset", event: "no.existe", preset: null }] })[0]).toContain("no.existe");
    expect(validateRequest({ version: 1, base: {}, assets: [], changes: [{ type: "sound", zoneId: "zona-a", soundId: "con espacios", sound: {} }] })[0]).toContain("soundId");
    expect(validateRequest({ version: 1, base: {}, assets: [], changes: [{ type: "asset", assetKey: "falta" }] })[0]).toContain("no está en la solicitud");
  });

  it("inspectAudioFile mide los WAV y comprueba la firma de los demás formatos", () => {
    expect(inspectAudioFile("a.wav", wav(500), 0)).toEqual({ format: "wav", durationSeconds: 0.5 });
    expect(() => inspectAudioFile("a.mp3", Buffer.from("no es mp3 en absoluto"), 1)).toThrow(AudioFileError);
    expect(inspectAudioFile("a.mp3", Buffer.concat([Buffer.from("ID3"), Buffer.alloc(40)]), 2.5)).toEqual({ format: "mp3", durationSeconds: 2.5 });
    expect(inspectAudioFile("a.ogg", Buffer.concat([Buffer.from("OggS"), Buffer.alloc(40)]), 1)).toEqual({ format: "ogg", durationSeconds: 1 });
    expect(() => inspectAudioFile("a.ogg", Buffer.concat([Buffer.from("OggS"), Buffer.alloc(40)]), 0)).toThrow(/duración/);
    expect(slugify("Río del Cerezo (v2).WAV")).toBe("rio-del-cerezo-v2");
    expect(slugify("¡¡¡.wav")).toBe("sonido");
  });

  it("patchSound conserva las propiedades ajenas, el id y los demás objetos", () => {
    const p = workspace();
    const map = tmjOf(p, "zona-a");
    const located = findSoundObject(map, "rio-pradera")!;
    located.obj.properties = [...(located.obj.properties ?? []), { name: "nota", type: "string", value: "mía" }];
    const id = located.obj.id;
    const others = located.layer.objects.length;
    const r = patchSound(map, "rio-pradera", withRiver(p, { volume: 0.9 }));
    expect(r).toMatchObject({ action: "updated", objectId: id });
    const after = findSoundObject(map, "rio-pradera")!;
    expect(after.obj.properties?.find((q) => q.name === "nota")?.value).toBe("mía");
    expect(after.layer.objects).toHaveLength(others);
    expect(() => patchSound(map, "rio-pradera", { ...withRiver(p, {}), shape: "rect", area: { x: 0, y: 0, width: 1, height: 1 }, edgeFadePx: 0 } as MapSound)).toThrow(PatchError);
  });

  it("patchSound crea la capa «sonidos» si el mapa no la tiene", () => {
    const p = workspace();
    const map = tmjOf(p, "zona-a");
    map.layers = map.layers.filter((l) => l.name !== "sonidos");
    const sound = withRiver(p, {});
    const r = patchSound(map, "rio-pradera", sound);
    expect(r.action).toBe("created");
    expect(map.layers.some((l) => l.name === "sonidos")).toBe(true);
  });
});

describe("rutas de desarrollo del laboratorio (AC-94, AC-95)", () => {
  let server: Server;
  let base = "";
  let p: Paths;
  const reloads: string[] = [];
  beforeAll(async () => {
    p = workspace();
    const stack: Array<{ route: string; fn: (req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void) => void }> = [];
    const fake = { config: { root: p.root }, middlewares: { use: (route: string, fn: (typeof stack)[number]["fn"]) => stack.push({ route, fn }) } };
    const gate = new ReloadGate(40);
    gate.attach(() => reloads.push("reload"));
    setupAudioLab(fake as never, { paths: p, gate });
    server = createServer((req, res) => {
      const m = stack.find((s) => (req.url ?? "").startsWith(s.route));
      if (!m) return void (res.statusCode = 404, res.end());
      req.url = (req.url ?? "").slice(m.route.length) || "/";
      m.fn(req, res, () => void (res.statusCode = 404, res.end()));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => void server.close());
  const call = (path: string, init: RequestInit = {}, headers: Record<string, string> = { [AUDIO_LAB_HEADER]: "1" }) => fetch(`${base}${AUDIO_LAB_ROUTE}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });

  it("rechaza lo que no trae la cabecera del laboratorio, otro origen u otra máquina", async () => {
    expect((await call("/state", {}, {})).status).toBe(403);
    expect((await call("/state", { headers: { origin: "http://sitio-ajeno.example" } })).status).toBe(403);
    expect(rejectReason({ headers: { [AUDIO_LAB_HEADER]: "1", host: "localhost:5173", origin: "http://localhost:5173" }, socket: { remoteAddress: "127.0.0.1" }, method: "GET" } as never)).toBeNull();
    expect(rejectReason({ headers: { [AUDIO_LAB_HEADER]: "1" }, socket: { remoteAddress: "192.168.1.20" }, method: "GET" } as never)).toContain("esta máquina");
  });

  it("GET /state devuelve las huellas y las zonas con mapa de Tiled", async () => {
    const r = await call("/state");
    const body = (await r.json()) as { versions: { zones: Record<string, string> }; zones: string[] };
    expect(r.status).toBe(200);
    expect(body.zones.sort()).toEqual(["zona-a", "zona-b"]);
    expect(Object.keys(body.versions.zones).sort()).toEqual(["zona-a", "zona-b"]);
  });

  it("POST /save valida, guarda y pide UNA recarga; /save?dryRun=1 no escribe; un cuerpo enorme o que no es JSON se rechaza", async () => {
    const post = (path: string, body: string, type = "application/json") => call(path, { method: "POST", body, headers: { "content-type": type } });
    const req = request(p, [{ type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: withRiver(p, { volume: 0.41 }) }]);
    const before = snapshot(p);
    expect((await post("/save?dryRun=1", JSON.stringify(req))).status).toBe(200);
    expect(snapshot(p)).toEqual(before);
    expect(reloads).toHaveLength(0);
    const saved = await post("/save", JSON.stringify(req));
    expect(saved.status).toBe(200);
    expect(river(p).volume).toBe(0.41);
    await new Promise((r) => setTimeout(r, 150));
    expect(reloads).toEqual(["reload"]); // varios archivos escritos, una sola recarga
    const stale = await post("/save", JSON.stringify(req)); // las huellas ya no coinciden
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { reason: string }).reason).toBe("conflict");
    expect((await post("/save", "{no es json")).status).toBe(400);
    expect((await post("/save", "{}", "text/plain")).status).toBe(415);
    expect((await call("/save")).status).toBe(405);
    const huge = `{"pad":"${"x".repeat(25 * 1024 * 1024)}"}`;
    const big = await post("/save", huge).catch(() => null);
    expect(big === null || big.status === 413).toBe(true);
  });
});

describe("ReloadGate: una sola recarga por tanda", () => {
  it("agrupa los avisos, espera a que termine un guardado y recarga una vez", async () => {
    const gate = new ReloadGate(30);
    const calls: number[] = [];
    gate.attach(() => calls.push(Date.now()));
    gate.request();
    gate.request();
    gate.hold();
    gate.request();
    await new Promise((r) => setTimeout(r, 80));
    expect(calls).toHaveLength(0); // retenida mientras dura el guardado
    gate.release();
    await new Promise((r) => setTimeout(r, 80));
    expect(calls).toHaveLength(1);
    gate.request();
    await new Promise((r) => setTimeout(r, 80));
    expect(calls).toHaveLength(2);
    gate.dispose();
  });
});

