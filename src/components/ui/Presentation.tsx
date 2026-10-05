import { useMemo, type CSSProperties, type Ref } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import { PRESENTATION_PARTS, type PresentationPart } from "../../config/presentationParts";
import type { PresentationConfig } from "../../config/types";
import { unapprovedIds } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";

interface Props {
  /** Hay progreso guardado: la acción pasa de «Comenzar» a «Continuar». */
  hasProgress: boolean;
  onStart: () => void;
  startRef?: Ref<HTMLButtonElement>;
}

/**
 * La presentación (portada) hecha con el kit `ui.presentation.*`: el letrero de madera con el título, la asignatura, la estudiante, la
 * ilustración de Vanessa y Jerry, la frase de bienvenida y el botón de continuar, sobre un pergamino de nueve zonas. Todo el texto sale
 * de `project` y `ui.labels` (más los dos rótulos de `ui.presentation.labels`); los archivos se resuelven con `assetPrefix` y el corte
 * del pergamino llega al CSS desde el manifiesto (`--prs-panel-parchment`). Sin botón de cerrar: solo se continúa.
 */
export function Presentation({ hasProgress, onStart, startRef }: Props) {
  const { config, assets } = useBitacora();
  const { project, ui, mode } = config;
  const presentation = ui.presentation as PresentationConfig;
  const t = presentation.labels;
  const labels = ui.labels;

  const vars = useMemo(() => {
    const out: Record<string, string> = {};
    for (const name of PRESENTATION_PARTS) {
      const id = `${presentation.assetPrefix}${name}`;
      if (!assets.has(id)) continue;
      out[`--prs-${name}`] = `url("${assets.url(id)}")`;
      const s = assets.get(id).nineSlice;
      if (s) out[`--prs-${name}-slice`] = `${s.top} ${s.right} ${s.bottom} ${s.left}`;
    }
    return out as CSSProperties;
  }, [assets, presentation.assetPrefix]);
  const src = (name: PresentationPart) => assets.url(`${presentation.assetPrefix}${name}`);
  const unapproved = mode === "final" ? unapprovedIds(config).length : 0;

  return (
    <section className="cover prs-cover" aria-labelledby="cover-title">
      <div className="prs-panel" style={vars}>
        <div className="prs-frame" aria-hidden="true" />
        <header className="prs-title">
          <img className="prs-title-bg" src={src("title-wood-flowers")} alt="" aria-hidden="true" draggable={false} />
          <h1 id="cover-title">{project.title}</h1>
          {project.subtitle ? <p className="prs-subtitle">{project.subtitle}</p> : null}
        </header>
        <div className="prs-copy">
          <p className="prs-label">
            <img src={src("sprout-flat")} alt="" aria-hidden="true" draggable={false} />
            {t.subjectLabel}
          </p>
          <h2 className="prs-subject">{project.courseName}</h2>
          <img className="prs-divider" src={src("divider-seed")} alt="" aria-hidden="true" draggable={false} />
          <h3 className="prs-name">{project.studentName}</h3>
          <ul className="prs-academic">
            <li>{project.program}</li>
            <li>{project.university}</li>
            <li>{labels.semester} {project.semester}</li>
            {project.teacherName ? <li>{labels.teacher} {project.teacherName}</li> : null}
          </ul>
          <div className="prs-intro">
            <img src={src("sprout-flat")} alt="" aria-hidden="true" draggable={false} />
            {project.welcomeTitle ? <strong>{project.welcomeTitle}</strong> : null}
            <p>{project.welcomeText}</p>
          </div>
          {mode === "demo" && labels.demo ? <span className="cover__demo prs-note">{labels.demo}</span> : null}
          {unapproved > 0 ? <span className="cover__demo prs-note">{renderTemplate(labels.preparationTemplate, { pending: unapproved })}</span> : null}
        </div>
        <img className="prs-hero" src={src("welcome-vanessa-jerry")} alt={t.heroAlt} draggable={false} />
        <footer className="prs-footer">
          <img className="prs-leaf" src={src("leaf-sprig")} alt="" aria-hidden="true" draggable={false} />
          <button type="button" className="prs-continue" ref={startRef} onClick={onStart}>
            <img className="prs-button-bg" src={src("button-continue")} alt="" aria-hidden="true" draggable={false} />
            <span>{hasProgress ? labels.continueRoute : labels.startRoute}</span>
            <span className="prs-chevron" aria-hidden="true">›</span>
          </button>
          <img className="prs-leaf prs-leaf--right" src={src("leaf-sprig")} alt="" aria-hidden="true" draggable={false} />
        </footer>
      </div>
    </section>
  );
}
