import { describe, expect, it } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import { frameDefinitions, toValidatedFrames } from "../assets/frameDefinitions";
import { mergeConfig, splitConfig } from "../config/mapsFile";
import { validateAssetManifest } from "../config/validateAssets";
import { validateBitacora, validateBitacoraFiles } from "../config/validateConfig";
import type { AssetManifest, BitacoraConfig, ConfigIssue, MapSound } from "../config/types";
import bitacoraJson from "./fixtures/realConfig";
import { makeConfig } from "./fixtures/makeConfig";

// Contrato de los sonidos del mapa y de audio.sfx (SPEC 6.5): validación del esquema y de las reglas entre campos y con el catálogo.

const manifest = (() => {
  const r = validateAssetManifest(manifestJson);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.value;
})();
const clone = <T>(v: T): T => structuredClone(v);
const real = bitacoraJson as unknown as BitacoraConfig;

const point = (over: Partial<Extract<MapSound, { shape: "point" }>> = {}): MapSound => ({
  label: "Río", assetId: "audio.sfx.test-river", enabled: true, volume: 0.3, rate: 1, fadeInMs: 250, fadeOutMs: 400, playback: { mode: "loop" },
  shape: "point", position: { x: 500, y: 500 }, innerRadius: 50, radius: 260, ...over,
});
const rect = (over: Partial<Extract<MapSound, { shape: "rect" }>> = {}): MapSound => ({
  label: "Viento", assetId: "audio.sfx.test-wind", enabled: true, volume: 0.2, rate: 1, fadeInMs: 0, fadeOutMs: 0, playback: { mode: "loop" },
  shape: "rect", area: { x: 0, y: 0, width: 400, height: 200 }, edgeFadePx: 80, ...over,
});
const issues = (edit: (c: BitacoraConfig) => void): ConfigIssue[] => {
  const c = makeConfig();
  edit(c);
  const r = validateBitacora(c, manifest);
  return r.ok ? [] : r.issues;
};
const paths = (list: ConfigIssue[]) => list.map((i) => i.path);

describe("audio.sfx y los sonidos del mapa en la configuración real (AC-89)", () => {
  it("la configuración real, con sus sonidos de prueba, es válida", () => {
    const r = validateBitacora(real, manifest, { frameDefinitions: toValidatedFrames(frameDefinitions) });
    expect(r.ok ? "" : JSON.stringify(r.issues)).toBe("");
    expect(Object.keys(real.maps["zona-a"].sounds ?? {})).toContain("rio-pradera");
    expect(real.audio.sfx?.events?.["badge.earned"]?.assetId).toBe("audio.sfx.test-badge");
  });

  it("audio.sfx vive en bitacora.json y los sonidos de cada zona en maps.json", () => {
    const { content, mapsFile } = splitConfig(real);
    expect(content.audio.sfx).toBeDefined();
    expect(Object.keys(content)).not.toContain("maps");
    expect(mapsFile.maps["zona-a"].sounds).toBeDefined();
    expect(JSON.stringify(content)).not.toContain('"rio-pradera"');
  });

  it("omitir `sounds` y `{}` son cosas distintas y se conservan al unir y separar", () => {
    const c = makeConfig();
    c.maps["zona-a"].sounds = {};
    delete c.maps["zona-b"].sounds;
    const { content, mapsFile } = splitConfig(c);
    expect(mapsFile.maps["zona-a"].sounds).toEqual({});
    expect("sounds" in mapsFile.maps["zona-b"]).toBe(false);
    const back = mergeConfig(content, mapsFile);
    expect(back.maps["zona-a"].sounds).toEqual({});
    expect("sounds" in back.maps["zona-b"]).toBe(false);
    expect(validateBitacoraFiles(content, mapsFile, manifest).ok).toBe(true);
  });
});

describe("configuración dividida: cada dato en su archivo (AC-86, AC-89)", () => {
  it("`audio.sfx` en maps.json o `sounds` en bitacora.json se detectan antes de combinarlos", () => {
    const { content, mapsFile } = splitConfig(real);
    const misplacedAudio = validateBitacoraFiles(content, { ...mapsFile, audio: { sfx: content.audio.sfx } } as never, manifest);
    expect(misplacedAudio.ok).toBe(false);
    const misplacedSounds = validateBitacoraFiles({ ...content, sounds: mapsFile.maps["zona-a"].sounds } as never, mapsFile, manifest);
    expect(misplacedSounds.ok).toBe(false);
    for (const r of [misplacedAudio, misplacedSounds]) if (!r.ok) expect(r.issues.some((i) => /audio|sounds/.test(i.path + i.message))).toBe(true);
  });

  it("un sonido mal formado en maps.json se atribuye a maps.json y un efecto mal formado en bitacora.json, a bitacora.json", () => {
    const { content, mapsFile } = splitConfig(real);
    const badSound = structuredClone(mapsFile);
    badSound.maps["zona-a"].sounds!["rio-pradera"].volume = 4;
    const a = validateBitacoraFiles(content, badSound, manifest);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.issues.some((i) => i.path.startsWith("maps.zona-a.sounds.rio-pradera"))).toBe(true);
    const badSfx = structuredClone(content);
    badSfx.audio.sfx!.maxVoices = 0;
    const b = validateBitacoraFiles(badSfx, mapsFile, manifest);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.issues.some((i) => i.path.startsWith("audio.sfx"))).toBe(true);
  });
});

describe("validación de un sonido del mapa (AC-89)", () => {
  it("acepta un punto y un área válidos en los tres modos", () => {
    const list = issues((c) => {
      c.maps["zona-a"].sounds = {
        loop: point(),
        interval: point({ playback: { mode: "interval", minMs: 1000, maxMs: 5000 }, position: { x: 100, y: 100 } }),
        enter: rect({ playback: { mode: "enter", cooldownMs: 1500 } }),
      };
    });
    expect(list).toEqual([]);
  });

  it("el recurso debe existir y ser de kind «sfx»: ni música ni imágenes ni inexistentes", () => {
    const list = issues((c) => {
      c.maps["zona-a"].sounds = {
        musica: point({ assetId: "audio.music.beyond-the-clouds" }),
        imagen: point({ assetId: "ui.panel.cream.nine-slice" }),
        nada: point({ assetId: "audio.sfx.no-existe" }),
      };
    });
    expect(paths(list)).toEqual(expect.arrayContaining(["maps.zona-a.sounds.musica.assetId", "maps.zona-a.sounds.imagen.assetId", "maps.zona-a.sounds.nada.assetId"]));
  });

  it("rechaza volumen, velocidad, fundidos y radios fuera de contrato, con la ruta del campo", () => {
    for (const [name, sound] of [
      ["volume", point({ volume: 1.2 })],
      ["volume", point({ volume: -0.1 })],
      ["rate", point({ rate: 0.4 })],
      ["rate", point({ rate: 2.5 })],
      ["fadeInMs", point({ fadeInMs: -5 })],
      ["fadeOutMs", point({ fadeOutMs: -1 })],
    ] as const) {
      const list = issues((c) => { c.maps["zona-a"].sounds = { x: sound }; });
      expect(list.some((i) => i.path.endsWith(`.${name}`)), `${name}: ${JSON.stringify(list)}`).toBe(true);
    }
    expect(paths(issues((c) => { c.maps["zona-a"].sounds = { x: point({ innerRadius: 300, radius: 260 }) }; }))).toContain("maps.zona-a.sounds.x.innerRadius");
  });

  it("rechaza un intervalo con mínimo mayor que máximo y una forma desconocida", () => {
    expect(paths(issues((c) => { c.maps["zona-a"].sounds = { x: point({ playback: { mode: "interval", minMs: 9000, maxMs: 1000 } }) }; }))).toContain("maps.zona-a.sounds.x.playback");
    expect(issues((c) => { c.maps["zona-a"].sounds = { x: { ...point(), shape: "polygon" } as unknown as MapSound }; }).length).toBeGreaterThan(0);
    expect(issues((c) => { c.maps["zona-a"].sounds = { x: { ...point(), playback: { mode: "random" } } as unknown as MapSound }; }).length).toBeGreaterThan(0);
  });

  it("rechaza un punto o un área fuera de las dimensiones de la zona", () => {
    const w = makeConfig().maps["zona-a"].width;
    expect(paths(issues((c) => { c.maps["zona-a"].sounds = { x: point({ position: { x: w + 50, y: 10 } }) }; }))).toContain("maps.zona-a.sounds.x.position");
    expect(paths(issues((c) => { c.maps["zona-a"].sounds = { x: rect({ area: { x: 0, y: 0, width: w + 100, height: 10 } }) }; }))).toContain("maps.zona-a.sounds.x.area");
  });

  it("un campo desconocido o un identificador de sonido inválido se rechaza", () => {
    expect(issues((c) => { c.maps["zona-a"].sounds = { x: { ...point(), extra: 1 } as unknown as MapSound }; }).length).toBeGreaterThan(0);
    expect(issues((c) => { c.maps["zona-a"].sounds = { "Con Espacios": point() }; }).length).toBeGreaterThan(0);
  });
});

describe("validación de audio.sfx (AC-89)", () => {
  it("acepta efectos con los cuatro eventos y rechaza eventos desconocidos, recursos que no son sfx y valores fuera de rango", () => {
    expect(issues((c) => { c.audio.sfx = { active: true, volume: 0.8, maxVoices: 12, events: { "ui.open": { assetId: "audio.sfx.test-ui-open", volume: 0.5, rate: 1 } } }; })).toEqual([]);
    expect(issues((c) => { c.audio.sfx = { active: true, volume: 0.8, maxVoices: 12, events: { "ui.nope": { assetId: "audio.sfx.test-ui-open", volume: 0.5, rate: 1 } } as never }; }).length).toBeGreaterThan(0);
    expect(paths(issues((c) => { c.audio.sfx = { active: true, volume: 0.8, maxVoices: 12, events: { "ui.open": { assetId: "audio.music.beyond-the-clouds", volume: 0.5, rate: 1 } } }; }))).toContain("audio.sfx.events.ui.open.assetId");
    expect(issues((c) => { c.audio.sfx = { active: true, volume: 1.5, maxVoices: 12 }; }).length).toBeGreaterThan(0);
    expect(issues((c) => { c.audio.sfx = { active: true, volume: 0.5, maxVoices: 0 }; }).length).toBeGreaterThan(0);
    expect(issues((c) => { c.audio.sfx = { active: true, volume: 0.5, maxVoices: 65 }; }).length).toBeGreaterThan(0);
  });

  it("sin audio.sfx la configuración sigue siendo válida (los efectos son opcionales)", () => {
    expect(issues((c) => { delete c.audio.sfx; })).toEqual([]);
  });

  it("las etiquetas del botón de sonido son opcionales", () => {
    expect(issues((c) => { delete c.ui.labels.soundMute; delete c.ui.labels.soundUnmute; delete c.ui.labels.soundActivate; })).toEqual([]);
  });
});

describe("assets.json: recursos de efectos (kind «sfx», AC-89)", () => {
  const sfxIds = Object.entries(manifest.assets).filter(([, e]) => e.kind === "sfx").map(([id]) => id);
  const bad = (edit: (m: AssetManifest, id: string) => void): string => {
    const m = clone(manifestJson) as unknown as AssetManifest;
    edit(m, sfxIds[0]);
    const r = validateAssetManifest(m);
    return r.ok ? "" : JSON.stringify(r.issues);
  };

  it("hay siete sonidos de prueba, todos con duración, tamaño y huella, y bajo public/assets/audio/sfx", () => {
    expect(sfxIds).toHaveLength(7);
    for (const id of sfxIds) {
      const e = manifest.assets[id];
      expect(e).toMatchObject({ type: "audio", category: "audio", kind: "sfx" });
      expect(e.path.startsWith("audio/sfx/")).toBe(true);
      expect(e.durationSeconds).toBeGreaterThan(0);
      expect(e.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(e.sizeBytes).toBeGreaterThan(0);
    }
  });

  it("un efecto sin duración, con una ruta fuera de audio/sfx o sin tipo audio se rechaza", () => {
    expect(bad((m, id) => { delete m.assets[id].durationSeconds; })).toContain("durationSeconds");
    expect(bad((m, id) => { m.assets[id].type = "image" as never; })).not.toBe("");
    expect(bad((m, id) => { m.assets[id].category = "ui" as never; })).not.toBe("");
  });
});
