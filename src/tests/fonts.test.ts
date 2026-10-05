// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { FONTS_TIMEOUT_MS, APP_FONTS, fontsReady } from "../app/fontsReady";
import { uiFont } from "../game/fonts";

// Tipografías propias (SPEC 14): se esperan antes de crear el mapa, nunca bloquean la bitácora y Phaser usa la misma que el CSS.

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.style.removeProperty("--font-ui");
});

describe("fontsReady", () => {
  it("pide todas las tipografías de la bitácora y espera a que lleguen", async () => {
    const asked: string[] = [];
    const release: Array<() => void> = [];
    const fonts = { load: (f: string) => new Promise<void>((r) => { asked.push(f); release.push(r); }) };
    let done = false;
    const p = fontsReady(fonts, 5000).then(() => (done = true));
    await Promise.resolve();
    expect(asked).toEqual([...APP_FONTS]);
    expect(done).toBe(false);
    release.forEach((r) => r());
    await p;
    expect(done).toBe(true);
  });

  it("sin `document.fonts` (jsdom, navegadores antiguos) resuelve al instante", async () => {
    await expect(fontsReady(undefined)).resolves.toBeUndefined();
    await expect(fontsReady()).resolves.toBeUndefined();
  });

  it("una fuente que falla no impide abrir: se ignora", async () => {
    const fonts = { load: (f: string) => (f.includes("Gelasio") ? Promise.reject(new Error("404")) : Promise.resolve()) };
    await expect(fontsReady(fonts, 5000)).resolves.toBeUndefined();
  });

  it("con una red lenta abre a los pocos segundos con la letra de reserva", async () => {
    vi.useFakeTimers();
    const fonts = { load: () => new Promise<void>(() => undefined) }; // nunca llega
    let done = false;
    const p = fontsReady(fonts).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(FONTS_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await p;
    expect(done).toBe(true);
  });
});

describe("uiFont (el texto de Phaser usa la misma tipografía que el HTML)", () => {
  it("lee --font-ui al dibujar", () => {
    document.documentElement.style.setProperty("--font-ui", ' "Nunito", sans-serif ');
    expect(uiFont()).toBe('"Nunito", sans-serif');
  });

  it("sin la variable usa la lista de reserva, que empieza por la propia", () => {
    expect(uiFont()).toMatch(/^"Nunito"/);
  });
});
