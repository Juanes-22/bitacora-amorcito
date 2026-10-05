import { useEffect, useId, useMemo, useRef } from "react";
import { useProgress } from "../../app/ProgressProvider";
import { isAdmissible, stationNumber, stationStatesOf } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";
import type { JournalPanelPart } from "../../config/journalPanelParts";
import { useFocusTrap } from "../reading/useFocusTrap";
import { JournalStatus, useJournalKit } from "./journalKit";

interface Props {
  onOpen: (learningId: string) => void;
  onClose: () => void;
}

interface Group {
  zoneId: string;
  ids: string[];
}

/**
 * La Bitácora de aprendizajes (índice, SPEC 7 y 14): los aprendizajes agrupados por zona, cada uno con su ilustración, su estado y su
 * acción. Abre cualquier aprendizaje con las mismas reglas que el mapa: uno bloqueado o pendiente muestra su mensaje y nunca se salta
 * la secuencia; esta ventana no concede insignias. Todo el texto sale de la configuración (`ui.journalPanel.labels`) y del progreso; las
 * imágenes y los marcos del kit llegan del registro de assets. Escape y «Volver al mapa» cierran; el foco queda dentro.
 */
export function JournalIndex({ onOpen, onClose }: Props) {
  const { config, assets, t, vars, own, icon, ownIcon } = useJournalKit();
  const { state } = useProgress();
  const { labels } = config.ui;
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(dialog, onClose);

  const stations = stationStatesOf(config, state);
  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    for (const id of config.route) {
      const zoneId = config.placements[id]?.zoneId ?? "";
      let g = out.find((x) => x.zoneId === zoneId);
      if (!g) out.push((g = { zoneId, ids: [] }));
      g.ids.push(id);
    }
    return out;
  }, [config.route, config.placements]);
  const total = config.route.length;
  const completed = config.route.filter((id) => stations[id] === "completed").length;
  const progress = renderTemplate(t.progressTemplate, { completed, total });
  const nextId = config.route.find((id) => stations[id] === "available");

  // El foco inicial va a la acción que continúa el recorrido (el aprendizaje siguiente) o, si no hay, a la primera.
  useEffect(() => {
    const root = dialog.current;
    (root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>("button"))?.focus();
  }, []);

  const range = (ids: string[]) => {
    const numbers = ids.map((id) => stationNumber(config.route, id));
    return numbers.length === 1
      ? renderTemplate(t.groupSingleTemplate, { number: numbers[0] })
      : renderTemplate(t.groupRangeTemplate, { from: Math.min(...numbers), to: Math.max(...numbers) });
  };

  return (
    <div className="jp-overlay">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="jp-dialog" style={vars} tabIndex={-1}>
        <button type="button" className="jp-close" aria-label={t.closePanel} onClick={onClose} />
        <header className="jp-header">
          {ownIcon("journal-book-sprout", "jp-heading-icon")}
          <div className="jp-title-block">
            <h1 id={titleId}>{t.title}</h1>
            <p className="jp-subtitle">{t.subtitle}</p>
          </div>
          <div className="jp-progress" role="img" aria-label={progress}>
            <span>{progress}</span>
            <span className="jp-progress-segments" aria-hidden="true">
              {config.route.map((id, i) => (i < completed ? <span key={id}>{icon("progress-filled", "jp-segment")}</span> : <span key={id}>{icon("progress-empty", "jp-segment")}</span>))}
            </span>
          </div>
        </header>

        <div className="jp-scroll">
        {total === 0 ? <p className="jp-empty">{labels.emptyRouteLabel}</p> : null}
        {groups.map((group) => {
          const zone = config.maps[group.zoneId]?.label ?? "";
          const zoneIcon = config.ui.journalPanel?.zoneIcons?.[group.zoneId] as JournalPanelPart | undefined;
          return (
            <section key={group.zoneId} className="jp-group" aria-label={zone || undefined}>
              <div className="jp-zone">
                {zoneIcon ? <img src={own(zoneIcon)} alt="" aria-hidden="true" draggable={false} /> : null}
                {zone ? <h2>{zone}</h2> : null}
                <small>{range(group.ids)}</small>
              </div>
              <ul className="jp-grid">
                {group.ids.map((id) => {
                  const learning = config.learnings[id];
                  const status = stations[id] ?? "locked";
                  const number = stationNumber(config.route, id);
                  const pendingReview = status !== "completed" && !isAdmissible(config, id);
                  const isNext = id === nextId;
                  const heading = renderTemplate(labels.stationTitleTemplate, { number, title: learning.title });
                  const statusText = status === "completed" ? t.statusCompleted : status === "available" ? t.statusAvailable : pendingReview ? labels.pending : t.statusLocked;
                  const actionText = status === "completed" ? t.actionReread : t.actionExplore;
                  const requirement = status === "locked" && !pendingReview ? renderTemplate(t.requirementTemplate, { previous: number - 1 }) : null;
                  const open = () => onOpen(id);
                  return (
                    <li key={id} className={`jp-card${isNext ? " jp-card--next" : ""}${status === "locked" ? " jp-card--locked" : ""}`} data-state={status}>
                      <span className="jp-number">{String(number).padStart(2, "0")}</span>
                      {isNext ? (
                        <div className="jp-ribbon">
                          <img src={own("ribbon-next-blank")} alt="" aria-hidden="true" draggable={false} />
                          <span>{t.nextRibbon}</span>
                        </div>
                      ) : null}
                      {learning.illustrationAssetId && assets.has(learning.illustrationAssetId) ? <img className="jp-card-illustration" src={assets.url(learning.illustrationAssetId)} alt="" aria-hidden="true" draggable={false} /> : null}
                      <p className="jp-lesson-number">{renderTemplate(t.cardNumberTemplate, { number })}</p>
                      <h3>{learning.title}</h3>
                      <JournalStatus state={status} text={statusText} icon={icon} />
                      {requirement ? (
                        <button type="button" className="jp-requirement" onClick={open} aria-label={`${actionText}: ${heading}. ${statusText}. ${requirement}`}>
                          {requirement}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`jp-action ${isNext ? "jp-action--primary" : "jp-action--secondary"}`}
                          onClick={open}
                          aria-label={`${actionText}: ${heading}. ${statusText}`}
                          data-autofocus={isNext ? "" : undefined}
                        >
                          {actionText}
                          {icon("chevron-right", "jp-chevron")}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        </div>

        <footer className="jp-footer">
          <span className="jp-footer-copy">
            {icon("sparkle-gold")}
            {t.footerNote}
          </span>
          <button type="button" className="jp-action jp-action--primary" onClick={onClose}>
            {t.backToMap}
          </button>
        </footer>
      </div>
    </div>
  );
}
