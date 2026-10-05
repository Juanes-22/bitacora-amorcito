import type { CSSProperties, Ref } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import { renderTemplate } from "../../domain/templates";
import { unapprovedIds } from "../../domain/progression";
import { PixelButton } from "./PixelButton";
import { Presentation } from "./Presentation";
import { WindowPanel } from "./WindowPanel";

interface Props {
  /** Hay progreso guardado: la acción pasa de «Comenzar» a «Continuar». */
  hasProgress: boolean;
  onStart: () => void;
  startRef?: Ref<HTMLButtonElement>;
}

/** Portada: todo el texto sale de `project` y `ui.labels`; nada se copia en el componente. */
export function Cover({ hasProgress, onStart, startRef }: Props) {
  const { config, assets } = useBitacora();
  // Con `ui.presentation` la portada es la presentación del kit; sin ella, la portada sencilla de siempre.
  if (config.ui.presentation) return <Presentation hasProgress={hasProgress} onStart={onStart} startRef={startRef} />;
  const { project, ui, mode } = config;
  const title = assets.get(ui.assets.titleSign);
  const titleStyle = {
    "--title-url": `url("${assets.url(ui.assets.titleSign)}")`,
    "--title-ratio": title.width && title.height ? String(title.width / title.height) : undefined,
  } as CSSProperties;

  return (
    <section className="cover" aria-labelledby="cover-title">
      <WindowPanel className="cover__window">
        <h1 id="cover-title" className="cover__title" style={titleStyle}>
          <span>{project.title}</span>
        </h1>
        <p className="cover__course">{project.courseName}</p>
        <ul className="cover__identity">
          <li className="cover__student">{project.studentName}</li>
          <li>{project.program}</li>
          <li>{project.university}</li>
          <li>{ui.labels.semester} {project.semester}</li>
          {project.teacherName ? <li>{ui.labels.teacher} {project.teacherName}</li> : null}
        </ul>
        <p className="cover__welcome">{project.welcomeText}</p>
        {mode === "demo" && ui.labels.demo ? <span className="cover__demo">{ui.labels.demo}</span> : null}
        {mode === "final" && unapprovedIds(config).length > 0 ? (
          <span className="cover__demo">{renderTemplate(ui.labels.preparationTemplate, { pending: unapprovedIds(config).length })}</span>
        ) : null}
        <div className="cover__actions">
          <PixelButton ref={startRef} onClick={onStart}>
            {hasProgress ? ui.labels.continueRoute : ui.labels.startRoute}
          </PixelButton>
        </div>
      </WindowPanel>
    </section>
  );
}
