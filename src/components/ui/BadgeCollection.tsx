import { useBitacora } from "../../app/BitacoraProvider";
import { useProgress } from "../../app/ProgressProvider";
import { isEntryCompleted, stationNumber } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";
import { ContentRenderer } from "../reading/ContentRenderer";
import { Modal } from "./Modal";
import { PixelButton } from "./PixelButton";

interface Props {
  /** Se abrió al terminar el recorrido: título de cierre en lugar del de la colección. */
  completion: boolean;
  onClose: () => void;
  onReset: () => void;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" });

/**
 * Colección de insignias del recorrido ACTIVO (los archivados no aparecen) y, cuando el recorrido está
 * completo, el espacio para la reflexión final editable de la autora (`project.finalReflection`). Si todavía
 * está vacío se muestra un aviso: nunca se inventa un texto por ella (SPEC 5).
 */
export function BadgeCollection({ completion, onClose, onReset }: Props) {
  const { config, assets } = useBitacora();
  const { state, summary } = useProgress();
  const { labels } = config.ui;
  const title = completion ? labels.completionTitle : labels.badges;
  // Insignias de recorrido (la de Jerry): se obtienen al terminar todo y llevan la fecha del último aprendizaje.
  const routeBadges = Object.entries(config.badges).filter(([, b]) => b.awardedFor === "route-complete");
  const finishedAt = config.route.map((id) => state.entries[id]?.completedAt).filter((d): d is string => !!d).sort().at(-1);

  return (
    <Modal labelledBy="collection-title" onEscape={onClose}>
      <div className="reading__header">
        <h2 id="collection-title" className="reading__title">{title}</h2>
      </div>
      <div className="reading__body">
        <p className="collection__count">
          {renderTemplate(labels.badgeCountTemplate, { completedCount: summary.completedCount, totalCount: summary.totalCount })}
          {" · "}
          {renderTemplate(labels.xpTemplate, { xp: summary.xp, maxXp: summary.maxXp })}
          {" · "}
          {renderTemplate(labels.levelTemplate, { level: summary.level })}
        </p>
        {config.route.length === 0 ? <p className="reading__line">{labels.emptyRouteLabel}</p> : null}
        <ul className="collection">
          {config.route.map((id) => {
            const learning = config.learnings[id];
            const badge = config.badges[learning.badgeId];
            const entry = state.entries[id];
            const earned = isEntryCompleted(entry, learning);
            const heading = renderTemplate(labels.stationTitleTemplate, { number: stationNumber(config.route, id), title: learning.title });
            return (
              <li key={id} className={`collection__item${earned ? " collection__item--earned" : ""}`}>
                {badge ? <img className="collection__img" src={assets.url(badge.assetId)} alt={earned ? badge.title : ""} /> : null}
                <div className="collection__text">
                  <p className="collection__name">{earned ? badge?.title : heading}</p>
                  {earned && badge ? <p className="collection__desc">{badge.description}</p> : null}
                  <p className="collection__status">
                    {earned && entry?.completedAt
                      ? `${labels.badgeEarned} · ${renderTemplate(labels.earnedOnTemplate, { date: formatDate(entry.completedAt) })}`
                      : labels.notEarned}
                  </p>
                  {earned ? <p className="collection__where">{heading}</p> : null}
                </div>
              </li>
            );
          })}
          {routeBadges.map(([id, badge]) => (
            <li key={id} className={`collection__item${summary.finished ? " collection__item--earned" : ""}`} data-route-badge={id}>
              <img className="collection__img" src={assets.url(badge.assetId)} alt={summary.finished ? badge.title : ""} />
              <div className="collection__text">
                <p className="collection__name">{summary.finished ? badge.title : labels.routeBadgeLocked}</p>
                {summary.finished ? <p className="collection__desc">{badge.description}</p> : null}
                <p className="collection__status">
                  {summary.finished
                    ? `${labels.badgeEarned}${finishedAt ? ` · ${renderTemplate(labels.earnedOnTemplate, { date: formatDate(finishedAt) })}` : ""}`
                    : labels.notEarned}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {summary.finished ? (
          <section className="collection__reflection" aria-labelledby="reflection-title">
            <h3 id="reflection-title" className="block-heading">{labels.finalReflectionTitle}</h3>
            {config.project.finalReflection.length > 0 ? (
              <ContentRenderer blocks={config.project.finalReflection} />
            ) : (
              <p className="reading__line collection__pending">{labels.finalReflectionPending}</p>
            )}
          </section>
        ) : null}
      </div>
      <div className="reading__footer">
        <PixelButton data-autofocus onClick={onClose}>{labels.close}</PixelButton>
        <button type="button" className="reading__close collection__reset" onClick={onReset}>{labels.reset}</button>
      </div>
    </Modal>
  );
}
