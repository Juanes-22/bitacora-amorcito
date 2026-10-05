// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import bitacoraJson from "./fixtures/realConfig";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { MusicPlayer, type AudioLike } from "../audio/MusicPlayer";
import { musicTracks } from "../audio/createMusicPlayer";
import { SoundControl } from "../audio/SoundControl";
import { SoundToggle } from "../components/ui/SoundToggle";
import type { BitacoraConfig } from "../config/types";
import { PREFERENCES_KEY, PreferencesStorage } from "../storage/preferencesStorage";
import { DEFAULT_SFX, harness, registry } from "./fixtures/fakeSfx";

// El botón público «Sonido» (SPEC 6.4 y 6.5, AC-51): silencia y reactiva la música Y los efectos con una sola preferencia, ofrece
// «Activar audio» si el navegador bloqueó el sonido y existe también cuando hay efectos pero no música.

afterEach(cleanup);
const config = bitacoraJson as unknown as BitacoraConfig;
const fakeAudio = (): AudioLike => ({
  src: "", volume: 0, currentTime: 0, duration: 100, paused: true, preload: "",
  play: () => Promise.resolve(), pause: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined,
});
const memory = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};
const music = (muted = false) =>
  new MusicPlayer({ tracks: musicTracks(config, registry), order: "sequential", volume: 0.3, crossfadeMs: 1000 }, muted, { createAudio: fakeAudio, visibility: { isHidden: () => false, subscribe: () => () => undefined } });
const view = (control: SoundControl) =>
  render(
    <BitacoraProvider config={config} assets={registry}>
      <SoundToggle control={control} />
    </BitacoraProvider>,
  );

describe("SoundControl (AC-90)", () => {
  it("silenciar apaga la música y los efectos a la vez y guarda UNA preferencia (con el nombre antiguo también)", async () => {
    const store = memory();
    const prefs = new PreferencesStorage(store);
    const m = music();
    const { svc, backend } = await harness(DEFAULT_SFX);
    const control = new SoundControl(m, svc, prefs);
    control.setMuted(true);
    expect(m.getState().muted).toBe(true);
    expect(svc.getState().muted).toBe(true);
    expect(JSON.parse(store.data.get(PREFERENCES_KEY) as string)).toEqual({ soundMuted: true, musicMuted: true });
    expect(backend.live).toHaveLength(0);
    control.setMuted(false);
    expect(m.getState().muted).toBe(false);
    expect(svc.getState().muted).toBe(false);
    control.dispose();
  });

  it("existe y funciona con efectos y SIN música", async () => {
    const prefs = new PreferencesStorage(memory());
    const { svc } = await harness(DEFAULT_SFX);
    const control = new SoundControl(null, svc, prefs);
    expect(control.getState()).toMatchObject({ hasMusic: false, hasSfx: true, muted: false });
    control.toggle();
    expect(control.getState().muted).toBe(true);
    expect(svc.getState().muted).toBe(true);
    expect(prefs.soundMuted).toBe(true);
  });

  it("arranca con la preferencia guardada (también la de antes, `musicMuted`) en música y efectos", async () => {
    const store = memory();
    store.setItem(PREFERENCES_KEY, JSON.stringify({ musicMuted: true }));
    const prefs = new PreferencesStorage(store);
    expect(prefs.soundMuted).toBe(true);
    const { svc } = await harness(DEFAULT_SFX, { muted: prefs.soundMuted });
    expect(new SoundControl(null, svc, prefs).getState().muted).toBe(true);
    expect(svc.getState().muted).toBe(true);
  });

  it("la preferencia nueva manda sobre la antigua", () => {
    const store = memory();
    store.setItem(PREFERENCES_KEY, JSON.stringify({ soundMuted: false, musicMuted: true }));
    expect(new PreferencesStorage(store).soundMuted).toBe(false);
  });

  it("con el audio bloqueado por el navegador pulsar lo reintenta en lugar de silenciar", async () => {
    const prefs = new PreferencesStorage(memory());
    const { svc, backend } = await harness(DEFAULT_SFX, { unlock: false });
    backend.setStatus("locked");
    await svc.unlock();
    const control = new SoundControl(null, svc, prefs);
    expect(control.getState().blocked).toBe(true);
    const before = backend.unlockCalls;
    control.toggle();
    expect(backend.unlockCalls).toBeGreaterThan(before);
    expect(control.getState().muted).toBe(false);
  });
});

describe("SoundToggle (AC-90, AC-51)", () => {
  it("con efectos habla de «sonido»; es un botón real con etiqueta textual y cambia con el estado", async () => {
    const { svc } = await harness(DEFAULT_SFX);
    const control = new SoundControl(music(), svc, new PreferencesStorage(memory()));
    view(control);
    const button = screen.getByRole("button", { name: config.ui.labels.soundMute as string });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("data-sound")).toBe("on");
    expect(button.querySelector("img")?.getAttribute("alt")).toBe("");
    fireEvent.click(button);
    const off = screen.getByRole("button", { name: config.ui.labels.soundUnmute as string });
    expect(off.getAttribute("data-sound")).toBe("off");
    expect(svc.getState().muted).toBe(true);
    fireEvent.click(off);
    expect(screen.getByRole("button", { name: config.ui.labels.soundMute as string })).toBeTruthy();
  });

  it("sin efectos conserva el texto de siempre («música») y sigue funcionando", () => {
    const m = music();
    view(new SoundControl(m, null, new PreferencesStorage(memory())));
    const button = screen.getByRole("button", { name: config.ui.labels.musicMute });
    fireEvent.click(button);
    expect(m.getState().muted).toBe(true);
    expect(screen.getByRole("button", { name: config.ui.labels.musicUnmute })).toBeTruthy();
  });

  it("si el navegador bloqueó el audio ofrece «Activar audio»", async () => {
    const { svc, backend } = await harness(DEFAULT_SFX, { unlock: false });
    backend.setStatus("locked");
    await svc.unlock();
    view(new SoundControl(null, svc, new PreferencesStorage(memory())));
    expect(screen.getByRole("button", { name: config.ui.labels.soundActivate as string }).getAttribute("data-sound")).toBe("blocked");
  });

  it("un efecto de sonido desactivado en la configuración no cuenta como «efectos»", async () => {
    const { svc } = await harness({ ...DEFAULT_SFX, active: false });
    const control = new SoundControl(music(), svc, new PreferencesStorage(memory()));
    expect(control.getState().hasSfx).toBe(false);
    view(control);
    expect(screen.getByRole("button", { name: config.ui.labels.musicMute })).toBeTruthy();
  });
});
