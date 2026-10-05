// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import realConfig from "./fixtures/realConfig";
import { BitacoraProvider } from "../app/BitacoraProvider";
import { Cover } from "../components/ui/Cover";
import { createAssetRegistry } from "../config/assetRegistry";
import { PRESENTATION_PARTS } from "../config/presentationParts";
import type { AssetManifest, BitacoraConfig } from "../config/types";
import { demoOf } from "./fixtures/demoConfig";

afterEach(cleanup);

const registry = createAssetRegistry(manifestJson as unknown as AssetManifest, "http://localhost:5173/assets/assets.json");

function renderCover(config: BitacoraConfig = realConfig, edit?: (c: BitacoraConfig) => void, props: Partial<Parameters<typeof Cover>[0]> = {}) {
  const c = structuredClone(config);
  edit?.(c);
  const onStart = vi.fn();
  const view = render(
    <BitacoraProvider config={c} assets={registry}>
      <Cover hasProgress={false} onStart={onStart} {...props} />
    </BitacoraProvider>,
  );
  return { ...view, onStart, config: c };
}

describe("Presentación con el kit (AC-87)", () => {
  it("el bitacora.json real usa el kit: título y subtítulo en el letrero, la asignatura, la estudiante y la bienvenida", () => {
    renderCover();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mi bitácora");
    expect(screen.getByText("Un recorrido de aprendizajes")).toBeTruthy();
    expect(screen.getByText("ASIGNATURA")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Desarrollo de la actitud científica en la infancia");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Vanessa Estrada");
    for (const text of ["Licenciatura en Educación Infantil", "Universidad de Antioquia", "Semestre 2026 - 2"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText("Cada experiencia deja una semilla.").tagName).toBe("STRONG");
    expect(screen.getByText(/^Acompáñame a recorrer los aprendizajes/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Mi bitácora" })).toBeTruthy();
  });

  it("la ilustración de Vanessa y Jerry tiene su texto alternativo y el resto de las imágenes es decorativo", () => {
    const { container } = renderCover();
    expect(screen.getByRole("img", { name: "Vanessa y Jerry junto a un libro abierto y un brote" })).toBeTruthy();
    const decorative = [...container.querySelectorAll("img")].filter((i) => i.getAttribute("alt") === "");
    expect(decorative).toHaveLength(7);
    expect(decorative.every((i) => i.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(container.querySelectorAll("img")).toHaveLength(decorative.length + 1);
  });

  it("las imágenes salen del registro de assets con el prefijo `ui.presentation.`", () => {
    const { container } = renderCover();
    const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src") as string);
    for (const part of ["title-wood-flowers", "sprout-flat", "divider-seed", "welcome-vanessa-jerry", "leaf-sprig", "button-continue"]) {
      expect(srcs.some((s) => s.endsWith(`/ui/presentation/${part}.png`)), part).toBe(true);
    }
    expect(srcs.filter((s) => s.endsWith("/leaf-sprig.png"))).toHaveLength(2); // la del lado derecho se refleja con CSS
  });

  it("el pergamino es de nueve zonas: sus cortes salen del manifiesto, no del componente", () => {
    const { container } = renderCover();
    const panel = container.querySelector(".prs-panel") as HTMLElement;
    expect(panel.style.getPropertyValue("--prs-panel-parchment-slice")).toBe("160 160 160 160");
    expect(panel.style.getPropertyValue("--prs-panel-parchment")).toContain("/ui/presentation/panel-parchment.png");
    for (const name of PRESENTATION_PARTS) expect(panel.style.getPropertyValue(`--prs-${name}`), name).toContain(`${name}.png`);
  });

  it("el botón dice «Comenzar recorrido» o, con progreso, «Continuar recorrido», e inicia el recorrido", () => {
    const first = renderCover();
    fireEvent.click(screen.getByRole("button", { name: "Comenzar recorrido" }));
    expect(first.onStart).toHaveBeenCalledOnce();
    cleanup();
    renderCover(realConfig, undefined, { hasProgress: true });
    expect(screen.getByRole("button", { name: "Continuar recorrido" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Comenzar recorrido" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1); // sin botón de cerrar: solo se continúa
  });

  it("el botón recibe la referencia para el foco inicial", () => {
    const ref = { current: null as HTMLButtonElement | null };
    renderCover(realConfig, undefined, { startRef: ref });
    expect(ref.current).toBe(screen.getByRole("button", { name: "Comenzar recorrido" }));
  });

  it("los textos salen de project, ui.labels y ui.presentation, no del componente", () => {
    renderCover(realConfig, (c) => {
      c.project.title = "Otro título";
      c.project.subtitle = "Otro subtítulo";
      c.project.studentName = "Otra Persona";
      c.project.courseName = "Otra asignatura";
      c.project.welcomeTitle = "Otra frase.";
      c.project.welcomeText = "Otro texto de bienvenida.";
      c.ui.labels.semester = "Periodo";
      c.ui.labels.startRoute = "Empezar ya";
      (c.ui.presentation as NonNullable<typeof c.ui.presentation>).labels.subjectLabel = "MATERIA";
    });
    for (const text of ["Otro título", "Otro subtítulo", "Otra Persona", "Otra asignatura", "Otra frase.", "Otro texto de bienvenida.", "Periodo 2026 - 2", "MATERIA"]) expect(screen.getByText(text), text).toBeTruthy();
    expect(screen.getByRole("button", { name: "Empezar ya" })).toBeTruthy();
  });

  it("omite lo opcional que falta: sin subtítulo, sin frase de bienvenida y sin docente no quedan huecos ni «null»", () => {
    const { container } = renderCover(realConfig, (c) => { delete c.project.subtitle; delete c.project.welcomeTitle; });
    expect(container.querySelector(".prs-subtitle")).toBeNull();
    expect(container.querySelector(".prs-intro strong")).toBeNull();
    expect(container.textContent).not.toMatch(/null|undefined|Docente/);
    expect(within(container.querySelector(".prs-academic") as HTMLElement).getAllByRole("listitem")).toHaveLength(3);
  });

  it("muestra al docente cuando se informa", () => {
    renderCover(realConfig, (c) => { c.project.teacherName = "Nombre de prueba"; });
    expect(screen.getByText("Docente Nombre de prueba")).toBeTruthy();
  });

  it("en modo demostración muestra el aviso (si hay etiqueta) y en modo final con contenido sin aprobar, el de preparación", () => {
    renderCover(demoOf(realConfig), (c) => { c.ui.labels.demo = "Contenido de demostración"; });
    expect(screen.getByText("Contenido de demostración")).toBeTruthy();
    cleanup();
    renderCover(realConfig, (c) => { c.learnings["apr-a"].editorialStatus = "draft"; });
    expect(screen.getByText(/Recorrido en preparación: faltan 1 por aprobar/)).toBeTruthy();
    cleanup();
    renderCover();
    expect(screen.queryByText(/en preparación/)).toBeNull(); // todo aprobado: sin aviso
  });

  it("sin `ui.presentation` se usa la portada sencilla de siempre, con el título completo", () => {
    const { container } = renderCover(realConfig, (c) => { delete c.ui.presentation; });
    expect(container.querySelector(".prs-panel")).toBeNull();
    expect(container.querySelector(".cover__window")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mi bitácora"); // sin subtítulo propio: el título del proyecto
  });
});
