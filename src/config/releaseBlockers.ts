import type { AssetManifest, BitacoraConfig, ConfigIssue } from "./types";

/**
 * Qué impide presentar el sitio como entrega final (SPEC 10 y 16). Función pura y sin efectos: la usan
 * `validate:config` (avisos en modo final) y `validate:release` (errores). La aprobación del contenido y la
 * autorización de publicar son decisiones de la autora, no de este código: esto solo las hace visibles.
 */
export function releaseBlockers(config: BitacoraConfig, manifest?: AssetManifest): ConfigIssue[] {
  const blockers: ConfigIssue[] = [];
  const add = (path: string, message: string) => blockers.push({ path, message });

  if (config.mode !== "final") add("mode", `el modo es «${config.mode}»: la entrega final requiere mode «final»`);
  if (config.route.length === 0) add("route", "el recorrido activo está vacío");
  for (const id of config.route) {
    const status = config.learnings[id]?.editorialStatus;
    if (status !== "ready") add(`learnings.${id}.editorialStatus`, `«${status}»: contenido sin aprobar por la autora`);
  }
  if (config.project.finalReflection.length === 0) add("project.finalReflection", "la reflexión final de la autora está vacía");
  if (config.editorNotes?.trim()) add("editorNotes", "hay notas del editor: confirma que ya no queda geometría ni contenido provisional");
  // Música (SPEC 6.4): una pista sin atribución o licencia verificada no puede salir en la entrega final.
  if (manifest && config.audio.music.active) {
    for (const id of config.audio.music.tracks) {
      const credit = manifest.assets[id]?.credit;
      if (!credit?.verified) add(`audio.music.tracks.${id}`, `la atribución o licencia de «${credit?.title ?? id}» no está verificada: confírmala o quita la pista`);
    }
  }
  return blockers;
}
