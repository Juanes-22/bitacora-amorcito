// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { createMusicPlayer, musicTracks } from "../audio/createMusicPlayer";
import { MusicPlayer, type AudioLike } from "../audio/MusicPlayer";
import { Cover } from "../components/ui/Cover";
import { MusicToggle } from "../components/ui/MusicToggle";
import { createAssetRegistry } from "../config/assetRegistry";
import { releaseBlockers } from "../config/releaseBlockers";
import type { AssetManifest, BitacoraConfig } from "../config/types";
import { PREFERENCES_KEY, PreferencesStorage } from "../storage/preferencesStorage";
import { makeConfig } from "./fixtures/makeConfig";

const manifest = manifestJson as unknown as AssetManifest;
const registry = createAssetRegistry(manifest, "http://localhost/assets/assets.json");
const config = bitacoraJson as unknown as BitacoraConfig;

const fakeAudio = (): AudioLike => ({
  src: "", volume: 0, currentTime: 0, duration: 100, paused: true, preload: "",
  play: () => Promise.resolve(), pause: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined,
});
const memory = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};
const playerWith = (muted = false) =>
  new MusicPlayer({ tracks: musicTracks(config, registry), order: "sequential", volume: 0.3, crossfadeMs: 1000 }, muted, {
    createAudio: fakeAudio, visibility: { isHidden: () => false, subscribe: () => () => undefined },
  });

afterEach(cleanup);

describe("musicTracks y createMusicPlayer", () => {
  it("resuelven URL, título y autor desde el manifiesto, en el orden de la configuración", () => {
    const tracks = musicTracks(config, registry);
    expect(tracks.map((t) => t.id)).toEqual(config.audio.music.tracks);
    expect(tracks[0]).toMatchObject({ url: "http://localhost/assets/audio/music/beyond-the-clouds.mp3", artist: "Matthew Pablo" });
    expect(tracks[2].url).toBe("http://localhost/assets/audio/music/little-town-orchestral.ogg");
  });

  it("no crea reproductor si la música está desactivada o sin pistas", () => {
    const off = structuredClone(config);
    off.audio.music.active = false;
    expect(createMusicPlayer(off, registry, new PreferencesStorage(memory()))).toBeNull();
    const empty = structuredClone(config);
    empty.audio.music.tracks = [];
    expect(createMusicPlayer(empty, registry, new PreferencesStorage(memory()))).toBeNull();
  });

  it("arranca con la preferencia guardada y la actualiza al apagar o encender", () => {
    const store = memory();
    store.setItem(PREFERENCES_KEY, JSON.stringify({ musicMuted: true }));
    const prefs = new PreferencesStorage(store);
    const player = createMusicPlayer(config, registry, prefs, { createAudio: fakeAudio, visibility: { isHidden: () => false, subscribe: () => () => undefined } }) as MusicPlayer;
    expect(player.getState().muted).toBe(true);
    player.setMuted(false);
    expect(JSON.parse(store.data.get(PREFERENCES_KEY) as string)).toEqual({ musicMuted: false });
  });
});

describe("MusicToggle (AC-51)", () => {
  const renderToggle = (player: MusicPlayer) =>
    render(
      <BitacoraProvider config={config} assets={registry}>
        <MusicToggle player={player} />
      </BitacoraProvider>,
    );

  it("es un botón con etiqueta textual que cambia con el estado y alterna al pulsarlo", () => {
    const player = playerWith(false);
    renderToggle(player);
    const button = screen.getByRole("button", { name: "Silenciar música" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(button);
    expect(player.getState().muted).toBe(true);
    expect(screen.getByRole("button", { name: "Activar música" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Activar música" }));
    expect(player.getState().muted).toBe(false);
    expect(screen.getByRole("button", { name: "Silenciar música" })).toBeTruthy();
  });

  it("si la música empieza silenciada ofrece activarla", () => {
    renderToggle(playerWith(true));
    expect(screen.getByRole("button", { name: "Activar música" }).getAttribute("data-music")).toBe("off");
  });
});

describe("la portada no muestra créditos de la música", () => {
  it("ni título de pista, ni autor, ni licencia", () => {
    const { container } = render(
      <BitacoraProvider config={config} assets={registry}>
        <Cover hasProgress={false} onStart={() => undefined} />
      </BitacoraProvider>,
    );
    expect(container.textContent).not.toMatch(/Matthew Pablo|Beyond The Clouds|Enchanted|Little Town|CC BY|Música/i);
    expect(container.querySelector(".cover__music")).toBeNull();
  });
});

describe("releaseBlockers: música (SPEC 6.4, AC-54)", () => {
  const ready = () => {
    const c = makeConfig();
    c.mode = "final";
    for (const id of c.route) c.learnings[id].editorialStatus = "ready";
    c.project.finalReflection = [{ type: "paragraph", text: "Reflexión." }];
    return c;
  };

  it("una pista con la atribución sin verificar bloquea la entrega y nombra la pista", () => {
    const blockers = releaseBlockers(ready(), manifest);
    expect(blockers.map((b) => b.path)).toEqual(["audio.music.tracks.audio.music.little-town-orchestral"]);
    expect(blockers[0].message).toContain("Little Town");
  });

  it("verificadas todas, o la música desactivada, no bloquea", () => {
    const m = structuredClone(manifest);
    m.assets["audio.music.little-town-orchestral"].credit = { ...m.assets["audio.music.little-town-orchestral"].credit!, verified: true, attribution: "x" };
    expect(releaseBlockers(ready(), m)).toEqual([]);
    const off = ready();
    off.audio.music.active = false;
    expect(releaseBlockers(off, manifest)).toEqual([]);
  });

  it("sin manifiesto no evalúa la música (compatibilidad)", () => {
    expect(releaseBlockers(ready())).toEqual([]);
  });
});

