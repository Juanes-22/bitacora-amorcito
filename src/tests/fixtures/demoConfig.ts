import type { BitacoraConfig } from "../../config/types";
import { fullTitle } from "../../domain/projectTitle";

/**
 * La configuración sin la Bitácora de aprendizajes ni la presentación con sus kits: ejercita la lista, la lectura y la portada sencillas
 * (el respaldo). La portada sencilla muestra el título completo y la bienvenida en un solo texto, así que se vuelven a unir.
 */
export function classicOf(config: BitacoraConfig): BitacoraConfig {
  const c = structuredClone(config);
  delete c.ui.journalPanel;
  delete c.ui.presentation;
  c.project.title = fullTitle(c.project);
  delete c.project.subtitle;
  if (c.project.welcomeTitle) c.project.welcomeText = `${c.project.welcomeTitle} ${c.project.welcomeText}`;
  delete c.project.welcomeTitle;
  return c;
}

/**
 * La configuración real en modo demostración: los textos de los aprendizajes como borrador (`draft`). La configuración real ya está
 * en modo final con los seis aprobados; las pruebas que ejercitan el modo demo (contenido sin aprobar, avisos, progreso separado)
 * parten de esta copia.
 */
export function demoOf(config: BitacoraConfig): BitacoraConfig {
  const c = structuredClone(config);
  c.mode = "demo";
  for (const learning of Object.values(c.learnings)) learning.editorialStatus = "draft";
  return c;
}
