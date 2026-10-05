// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "./fixtures/realConfig";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { Cover } from "../components/ui/Cover";
import { createAssetRegistry } from "../config/assetRegistry";
import type { AssetManifest, BitacoraConfig } from "../config/types";
import { classicOf, demoOf } from "./fixtures/demoConfig";

afterEach(cleanup);

const registry = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost:5173/assets/assets.json");
// La portada sencilla (el respaldo); la presentación con el kit la prueba presentation.test.tsx.
const baseConfig = classicOf(demoOf(bitacoraJson as unknown as BitacoraConfig));

function renderCover(edit?: (c: BitacoraConfig) => void, props: Partial<Parameters<typeof Cover>[0]> = {}) {
  const config = structuredClone(baseConfig);
  edit?.(config);
  const onStart = vi.fn();
  const view = render(
    <BitacoraProvider config={config} assets={registry}>
      <Cover hasProgress={false} onStart={onStart} {...props} />
    </BitacoraProvider>,
  );
  return { ...view, onStart, config };
}

describe("Cover (AC-01)", () => {
  it("muestra título, asignatura exacta, estudiante, programa, universidad y semestre", () => {
    renderCover();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mi bitácora — Un recorrido de aprendizajes");
    expect(screen.getByText("Desarrollo de la actitud científica en la infancia")).toBeTruthy();
    expect(screen.getByText("Vanessa Estrada")).toBeTruthy();
    expect(screen.getByText("Licenciatura en Educación Infantil")).toBeTruthy();
    expect(screen.getByText("Universidad de Antioquia")).toBeTruthy();
    expect(screen.getByText("Semestre 2026 - 2")).toBeTruthy();
    expect(screen.getByText(/Cada experiencia deja una semilla/)).toBeTruthy();
  });

  it("omite al docente cuando es null: sin texto 'null', 'undefined' ni huecos", () => {
    const { container } = renderCover();
    expect(container.textContent).not.toMatch(/null|undefined|Docente/);
    expect(within(container.querySelector(".cover__identity") as HTMLElement).getAllByRole("listitem")).toHaveLength(4);
  });

  it("muestra al docente cuando se informa", () => {
    renderCover((c) => { c.project.teacherName = "Nombre de prueba"; });
    expect(screen.getByText("Docente Nombre de prueba")).toBeTruthy();
  });

  it("toma los textos de project y ui.labels, no de constantes del componente", () => {
    renderCover((c) => {
      c.project.studentName = "Otra Persona";
      c.project.courseName = "Otra asignatura";
      c.ui.labels.startRoute = "Empezar ya";
    });
    expect(screen.getByText("Otra Persona")).toBeTruthy();
    expect(screen.getByText("Otra asignatura")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Empezar ya" })).toBeTruthy();
    expect(screen.queryByText("Vanessa Estrada")).toBeNull();
  });

  it("ofrece «Continuar recorrido» solo si hay progreso y «Comenzar» si no", () => {
    renderCover(undefined, { hasProgress: true });
    expect(screen.getByRole("button", { name: "Continuar recorrido" })).toBeTruthy();
    cleanup();
    renderCover();
    expect(screen.getByRole("button", { name: "Comenzar recorrido" })).toBeTruthy();
  });

  it("identifica el contenido de demostración (si la configuración define la etiqueta) y no lo muestra en modo final", () => {
    renderCover((c) => { c.ui.labels.demo = "Contenido de demostración"; });
    expect(screen.getByText("Contenido de demostración")).toBeTruthy();
    cleanup();
    renderCover((c) => { c.ui.labels.demo = "Contenido de demostración"; c.mode = "final"; });
    expect(screen.queryByText("Contenido de demostración")).toBeNull();
  });

  it("sin la etiqueta `demo` en la configuración (la real) la portada no muestra ningún aviso de demostración", () => {
    renderCover((c) => { delete c.ui.labels.demo; });
    expect(screen.queryByText(/demostración/i)).toBeNull();
    expect(document.querySelector(".cover__demo")).toBeNull();
    expect(screen.getByRole("button", { name: "Comenzar recorrido" })).toBeTruthy();
  });

  it("el botón inicia el recorrido y usa los assets del registro", () => {
    const { onStart } = renderCover();
    const button = screen.getByRole("button", { name: "Comenzar recorrido" });
    fireEvent.click(button);
    expect(onStart).toHaveBeenCalledOnce();
    expect(button.style.getPropertyValue("--button-url")).toContain("http://localhost:5173/assets/ui/buttons/button-green.png");
    expect(button.style.getPropertyValue("--button-hover-url")).toContain("button-green-hover.png");
  });

  it("el panel usa los márgenes de nueve secciones del manifiesto", () => {
    const { container } = renderCover();
    const win = container.querySelector(".window") as HTMLElement;
    expect(win.style.getPropertyValue("--panel-slice")).toBe("32 32 32 32");
    expect(win.style.getPropertyValue("--panel-url")).toContain("panel-cream-9slice.png");
  });

  it("tiene región etiquetada por su título", () => {
    const { container } = renderCover();
    const section = container.querySelector("section") as HTMLElement;
    expect(section.getAttribute("aria-labelledby")).toBe("cover-title");
    expect(container.querySelector("#cover-title")?.tagName).toBe("H1");
  });
});
