import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import { useProgress } from "../../app/ProgressProvider";
import { BADGE_PANEL_PARTS, type BadgePanelPart } from "../../config/badgePanelParts";
import type { Badge, BadgePanelConfig } from "../../config/types";
import { isEntryCompleted } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";
import { ContentRenderer } from "../reading/ContentRenderer";
import { useFocusTrap } from "../reading/useFocusTrap";

interface Props {
  /** Se abrió al terminar el recorrido: título de cierre en lugar del de la colección. */
  completion: boolean;
  onClose: () => void;
  onReset: () => void;
  /** «Ver aprendizaje»: cierra el panel y abre ese aprendizaje con las mismas reglas que el mapa. */
  onOpenLearning: (learningId: string) => void;
}

/** Una insignia lista para pintar: la de un aprendizaje (con su posición en la ruta) o una de recorrido (la de Jerry). */
interface Item {
  key: string;
  badge: Badge;
  learningId?: string;
  learningTitle?: string;
  number?: number;
  earned: boolean;
  earnedAt?: string;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" });
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Panel de insignias (SPEC 7) hecho con el kit de interfaz `ui.badge-panel.*`: una colección de tarjetas clicables —seis de
 * aprendizaje, la de Jerry aparte y una cápsula de progreso— y el detalle de cada una. Todo sale de la configuración y del
 * progreso: nombres, significado, fechas, número de aprendizaje y los textos del panel (`ui.badgePanel.labels`). Los marcos
 * son imágenes de nueve zonas: llegan como variables CSS desde el registro de assets. Escape vuelve del detalle a la
 * colección y, desde la colección, la cierra; el foco queda dentro del panel. «Lo que me llevo» solo aparece si la autora
 * la escribió (`badges[id].takeaway`): nunca se inventa.
 */
export function BadgePanel({ completion, onClose, onReset, onOpenLearning }: Props) {
  const { config, assets } = useBitacora();
  const { state, summary } = useProgress();
  const panel = config.ui.badgePanel as BadgePanelConfig;
  const t = panel.labels;
  const { labels } = config.ui;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const items = useMemo<Item[]>(() => {
    const learning = config.route.map<Item>((id, i) => {
      const l = config.learnings[id];
      const entry = state.entries[id];
      return { key: id, badge: config.badges[l.badgeId], learningId: id, learningTitle: l.title, number: i + 1, earned: isEntryCompleted(entry, l), earnedAt: entry?.completedAt };
    });
    return learning.filter((it) => it.badge);
  }, [config, state.entries]);
  const finishedAt = config.route.map((id) => state.entries[id]?.completedAt).filter((d): d is string => !!d).sort().at(-1);
  const special = useMemo<Item[]>(
    () => Object.entries(config.badges).filter(([, b]) => b.awardedFor === "route-complete").map(([id, badge]) => ({ key: id, badge, earned: summary.finished, earnedAt: summary.finished ? finishedAt : undefined })),
    [config.badges, summary.finished, finishedAt],
  );
  const all = [...items, ...special];
  const selected = all.find((it) => it.key === selectedKey);
  const total = items.length;
  const count = items.filter((it) => it.earned).length;

  const vars = useMemo(() => {
    const out: Record<string, string> = {};
    for (const name of BADGE_PANEL_PARTS) {
      const id = `${panel.assetPrefix}${name}`;
      if (!assets.has(id)) continue;
      out[`--bpk-${name}`] = `url("${assets.url(id)}")`;
      const s = assets.get(id).nineSlice;
      if (s) out[`--bpk-${name}-slice`] = `${s.top} ${s.right} ${s.bottom} ${s.left}`;
    }
    return out as CSSProperties;
  }, [assets, panel.assetPrefix]);
  const src = (name: BadgePanelPart) => assets.url(`${panel.assetPrefix}${name}`);
  const icon = (name: BadgePanelPart, className = "bpk-icon") => <img src={src(name)} className={className} alt="" aria-hidden="true" />;

  const back = () => setSelectedKey(null);
  useFocusTrap(dialog, () => (selectedKey ? back() : onClose()));
  // Al cambiar de vista el foco pasa al primer botón (el elemento que tenía desaparece).
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
  }, [selectedKey]);

  const status = (it: Item, expanded = false) => (
    <span className={`bpk-status ${it.earned ? "bpk-status--earned" : "bpk-status--pending"}`}>
      {it.earned ? icon("check-white") : null}
      {it.earned ? (expanded ? labels.badgeEarned : t.obtained) : t.pending}
    </span>
  );
  const medal = (it: Item, alt = "") => {
    const tone = it.badge.tone ?? "jade";
    const branch = !it.earned ? "branch-muted-" : tone === "lavender" ? "branch-lavender-" : "branch-green-";
    return (
      <div className="bpk-medal-stage">
        {it.earned ? icon(`halo-${tone}` as BadgePanelPart, "bpk-halo") : null}
        {icon(`${branch}left` as BadgePanelPart, "bpk-branch bpk-branch--left")}
        {icon(`${branch}right` as BadgePanelPart, "bpk-branch bpk-branch--right")}
        <img src={assets.url(it.badge.assetId)} className={`bpk-medal${it.earned ? "" : " bpk-medal--pending"}`} alt={it.earned ? alt : ""} />
        {it.earned ? (
          <>
            {icon("sparkle-gold", "bpk-glint bpk-glint--left")}
            {icon("sparkle-gold", "bpk-glint bpk-glint--right")}
          </>
        ) : (
          icon("lock-seal", "bpk-lock")
        )}
      </div>
    );
  };
  const button = (text: string, primary: boolean, onClick: () => void, left?: BadgePanelPart, extra = "") => (
    <button type="button" className={`bpk-button ${primary ? "bpk-button--primary" : "bpk-button--secondary"} ${extra}`.trim()} onClick={onClick}>
      {left ? icon(left) : null}
      {text}
    </button>
  );
  const closeButton = <button type="button" className="bpk-icon-button bpk-icon-button--close" aria-label={t.closePanel} onClick={onClose} />;
  const learningNumber = (it: Item) => String(it.number);

  return (
    <div className="bpk-overlay">
      <section ref={dialog} className="bpk-dialog" style={vars} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}>
        {!selected ? (
          <>
            <header className="bpk-header">
              <div>
                <h1 id={headingId}>{completion ? labels.completionTitle : t.title}</h1>
                <p className="bpk-subtitle">
                  {t.subtitle}
                  {" · "}
                  {renderTemplate(labels.xpTemplate, { xp: summary.xp, maxXp: summary.maxXp })}
                  {" · "}
                  {renderTemplate(labels.levelTemplate, { level: summary.level })}
                </p>
              </div>
              <div className="bpk-progress" role="img" aria-label={renderTemplate(labels.badgeCountTemplate, { completedCount: count, totalCount: total })}>
                <span>{renderTemplate(t.obtainedTemplate, { completedCount: count, totalCount: total })}</span>
                <div className="bpk-progress-segments" aria-hidden="true">
                  {items.map((it, i) => (
                    <img key={it.key} src={src(i < count ? "progress-filled" : "progress-empty")} alt="" />
                  ))}
                </div>
              </div>
              {closeButton}
            </header>
            {config.route.length === 0 ? <p className="reading__line">{labels.emptyRouteLabel}</p> : null}
            <div className="bpk-grid">
              {items.map((it) => (
                <button
                  type="button"
                  key={it.key}
                  className={`bpk-card ${it.earned ? "bpk-card--earned" : "bpk-card--pending"}`}
                  aria-label={`${it.badge.title}. ${it.earned ? t.obtained : t.pending}. ${t.viewBadge}`}
                  onClick={() => setSelectedKey(it.key)}
                >
                  <span className="bpk-number">{pad(it.number as number)} / {pad(total)}</span>
                  {medal(it)}
                  <span className="bpk-card-title">{it.badge.title}</span>
                  {status(it)}
                  <span className="bpk-card-footer">
                    {t.viewBadge}
                    {icon("chevron-right")}
                  </span>
                </button>
              ))}
            </div>
            {special.map((it) => (
              <button
                type="button"
                key={it.key}
                className="bpk-special"
                data-route-badge={it.key}
                aria-label={`${it.badge.title}. ${it.earned ? t.obtained : t.pending}. ${t.special}. ${t.viewBadge}`}
                onClick={() => setSelectedKey(it.key)}
              >
                {icon("paw-lavender")}
                <img src={assets.url(it.badge.assetId)} className={`bpk-medal${it.earned ? "" : " bpk-medal--pending"}`} alt="" />
                <div>
                  <p className="bpk-special-title">{it.badge.title}</p>
                  <span className="bpk-status bpk-status--special">
                    {icon("paw-lavender")}
                    {t.special}
                  </span>
                </div>
                <span className="bpk-special-status">
                  {it.earned ? status(it) : (<>{icon("lock-seal")}{t.pending}</>)}
                </span>
                {icon("chevron-right")}
              </button>
            ))}
            {summary.finished ? (
              <section className="bpk-reflection" aria-labelledby="bpk-reflection-title">
                <h3 id="bpk-reflection-title">{labels.finalReflectionTitle}</h3>
                {config.project.finalReflection.length > 0 ? <ContentRenderer blocks={config.project.finalReflection} /> : <p>{labels.finalReflectionPending}</p>}
              </section>
            ) : null}
            <footer className="bpk-footer">
              <p className="bpk-hint">{t.hint}</p>
              <div className="bpk-footer-actions">
                <button type="button" className="bpk-reset" onClick={onReset}>{labels.reset}</button>
                {button(t.backToMap, true, onClose)}
              </div>
            </footer>
          </>
        ) : (
          <>
            <header className="bpk-header bpk-header--detail">
              {/* La flecha repite lo que hace «Mi colección», el botón con texto de al lado: no es una parada más del teclado ni un nombre repetido. */}
              <button type="button" className="bpk-icon-button bpk-icon-button--back" aria-hidden="true" tabIndex={-1} onClick={back} />
              <button type="button" className="bpk-back-label" onClick={back}>{t.myCollection}</button>
              {closeButton}
            </header>
            <div className="bpk-detail">
              <div className="bpk-hero">
                <span className="bpk-number">{selected.number ? `${pad(selected.number)} / ${pad(total)}` : t.special.toUpperCase()}</span>
                {medal(selected, selected.badge.title)}
                {status(selected, true)}
                {selected.earned && selected.badge.xp > 0 ? (
                  <span className="bpk-status bpk-status--xp">
                    {icon("xp-star")}
                    {renderTemplate(t.xpTemplate, { xp: selected.badge.xp })}
                  </span>
                ) : null}
                {icon("flowers-bottom-left", "bpk-hero-flower bpk-hero-flower--left")}
                {icon("flowers-bottom-right", "bpk-hero-flower bpk-hero-flower--right")}
              </div>
              <article className="bpk-detail-copy">
                <p className="bpk-eyebrow">{selected.number ? t.eyebrowLearning : t.eyebrowSpecial}</p>
                <h2 id={headingId}>{selected.badge.title}</h2>
                <p className="bpk-date">
                  {icon(selected.earned ? "calendar" : "lock-seal")}
                  {selected.earned ? (selected.earnedAt ? renderTemplate(labels.earnedOnTemplate, { date: formatDate(selected.earnedAt) }) : labels.badgeEarned) : t.stillPending}
                </p>
                <div className="bpk-divider" aria-hidden="true">
                  {icon("divider-line-left", "bpk-divider-line")}
                  {icon("divider-diamond", "bpk-divider-center")}
                  {icon("divider-line-right", "bpk-divider-line")}
                </div>
                <section className="bpk-detail-section">
                  <h3>{icon("sprout")}{t.represents}</h3>
                  <p>{selected.badge.description}</p>
                </section>
                <section className="bpk-detail-section">
                  <h3>{icon("book-brown")}{selected.earned ? t.howEarned : t.howToEarn}</h3>
                  <p>
                    {selected.number
                      ? renderTemplate(selected.earned ? t.completingTemplate : t.completeTemplate, { number: learningNumber(selected) })
                      : selected.earned ? t.routeEarned : t.completeRoute}
                  </p>
                  {selected.learningTitle ? <div className="bpk-lesson-callout">{icon("sprout")}{selected.learningTitle}</div> : null}
                </section>
                {selected.earned && selected.badge.takeaway ? (
                  <section className="bpk-detail-section">
                    <h3>{icon("heart-green")}{t.takeaway}</h3>
                    <div className="bpk-reflection-callout">{icon("sprout")}<span>{selected.badge.takeaway}</span></div>
                  </section>
                ) : null}
              </article>
            </div>
            <footer className="bpk-footer bpk-detail-footer">
              {button(t.backToCollection, false, back, "chevron-left")}
              {selected.learningId ? button(t.viewLearning, true, () => onOpenLearning(selected.learningId as string), "book-cream") : null}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
