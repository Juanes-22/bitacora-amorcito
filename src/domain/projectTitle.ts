import type { ProjectConfig } from "../config/types";

/** El título completo del proyecto: «título — subtítulo» si hay subtítulo (el de la pestaña del navegador y el de la cabecera). */
export const fullTitle = (project: Pick<ProjectConfig, "title" | "subtitle">): string =>
  project.subtitle ? `${project.title} — ${project.subtitle}` : project.title;
