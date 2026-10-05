import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { useProgress } from "../../app/ProgressProvider";
import type { ReadingActions, ReadingState } from "../../app/useProgressController";
import type { SectionId } from "../../config/types";
import { currentEntry, isEntryCompleted, requiredSectionIds, stationNumber } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";
import type { JournalPanelPart, JournalPanelSharedPart } from "../../config/journalPanelParts";
import { JournalStatus, useJournalKit } from "../ui/journalKit";
import { ContentRenderer } from "./ContentRenderer";
import { useFocusTrap } from "./useFocusTrap";

type Reading = Extract<ReadingState, { kind: "reading" }>;

/** Icono de cada sección: el libro (resumen), la burbuja (reflexión) y el brote (lo vivido). */
const TAB_ICON: Record<SectionId, { own?: JournalPanelPart; shared?: JournalPanelSharedPart }> = {
  learning: { shared: "book-brown" },
  reflection: { own: "tab-reflection-bubble" },
  lived: { shared: "sprout" },
};

/**
 * La lectura de un aprendizaje en la Bitácora (SPEC 7): título y estado, las secciones como pestañas (Resumen, Reflexión y Lo vivido),
 * el texto a la izquierda y, a la derecha, la ilustración con sus palabras clave y la insignia. Las reglas de progreso son las del juego:
 * abrir una pestaña NO marca nada; la acción explícita del pie marca la sección actual y pasa a la siguiente pendiente; con todas las
 * requeridas leídas el pie ofrece «Recoger insignia», que es la única forma de completar el aprendizaje. Una insignia pendiente se ve en
 * gris con su candado. «Ver insignia» abre su detalle y la flecha vuelve a la Bitácora.
 */
export function JournalReader({ reading, actions }: { reading: Reading; actions: ReadingActions }) {
  const { config, assets, t, vars, icon, ownIcon } = useJournalKit();
  const { state } = useProgress();
  const dialog = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  useFocusTrap(dialog, actions.close);
  // Foco inicial en el propio diálogo (sin anillo de foco sobre ningún botón): así Escape y Tab llegan al diálogo desde el primer momento.
  useEffect(() => {
    dialog.current?.focus();
  }, []);

  const learning = config.learnings[reading.learningId];
  const entry = currentEntry(state, config, reading.learningId);
  const completed = isEntryCompleted(entry, learning);
  const tabs = config.ui.tabs;
  const read = new Set(entry.readSectionIds);
  const required = requiredSectionIds(config);
  const remaining = required.filter((s) => !read.has(s)).length;
  const active = reading.active;
  const activeIndex = Math.max(0, tabs.findIndex((x) => x.id === active));
  const activeRead = read.has(active);
  const labelOf = (id: SectionId) => tabs.find((x) => x.id === id)?.label ?? id;
  const number = stationNumber(config.route, reading.learningId);
  const zone = config.maps[config.placements[reading.learningId]?.zoneId]?.label ?? "";
  const badge = config.badges[learning.badgeId];
  const tabId = (id: SectionId) => `${uid}-tab-${id}`;
  const panelId = `${uid}-panel`;
  const readCount = tabs.filter((x) => read.has(x.id)).length;

  /** La siguiente pestaña sin leer después de la actual (dando la vuelta), o `null` si no queda otra. */
  const nextPending = (): SectionId | null => {
    for (let step = 1; step < tabs.length; step++) {
      const candidate = tabs[(activeIndex + step) % tabs.length].id;
      if (!read.has(candidate)) return candidate;
    }
    return null;
  };

  const onTabKeys = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation(); // las flechas no llegan al mapa ni mueven al personaje
    const n = tabs.length;
    const next = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (activeIndex + (e.key === "ArrowRight" ? 1 : n - 1)) % n;
    actions.selectSection(tabs[next].id);
    requestAnimationFrame(() => document.getElementById(tabId(tabs[next].id))?.focus());
  };

  // Acción principal del pie, según el estado del aprendizaje y de la sección que se lee.
  let primary: { text: string; run: () => void; claim?: boolean };
  if (completed) {
    const last = activeIndex === tabs.length - 1;
    primary = last
      ? { text: t.backToJournalAction, run: actions.backToList }
      : { text: renderTemplate(t.seeSectionTemplate, { section: labelOf(tabs[activeIndex + 1].id).toLowerCase() }), run: () => actions.selectSection(tabs[activeIndex + 1].id) };
  } else if (!activeRead) {
    primary = {
      text: t.markAndContinue,
      run: () => {
        actions.markRead(active);
        const target = nextPending();
        if (target) actions.selectSection(target); // si era la última, se queda en ella: el pie ofrece recoger la insignia
      },
    };
  } else if (remaining === 0) {
    primary = { text: config.ui.labels.claimBadge, run: actions.claimBadge, claim: true };
  } else {
    primary = { text: t.continueReading, run: () => { const target = nextPending(); if (target) actions.selectSection(target); } };
  }
  const readingNow = completed || activeRead;

  const medal = () => {
    const branch = completed ? "branch-green-" : "branch-muted-";
    return (
      <div className="jp-medal-stage">
        {icon(`${branch}left` as JournalPanelSharedPart, "jp-branch jp-branch--left")}
        {icon(`${branch}right` as JournalPanelSharedPart, "jp-branch jp-branch--right")}
        {badge ? <img src={assets.url(badge.assetId)} className={`jp-medal${completed ? "" : " jp-medal--pending"}`} alt="" aria-hidden="true" draggable={false} /> : null}
        {completed ? (
          <>
            {icon("sparkle-gold", "jp-sparkle jp-sparkle--left")}
            {icon("sparkle-gold", "jp-sparkle jp-sparkle--right")}
          </>
        ) : (
          icon("lock-seal", "jp-medal-lock")
        )}
      </div>
    );
  };

  return (
    <div className="jp-overlay">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="jp-dialog jp-dialog--reader"
        style={vars}
        tabIndex={-1}
        onKeyDown={(e) => {
          // Enter mantenido no vuelve a activar el control que tenga el foco (p. ej. «Recoger insignia» tras la recompensa).
          if (e.key === "Enter" && e.repeat) e.preventDefault();
        }}
      >
        <button type="button" className="jp-close" aria-label={t.closePanel} onClick={actions.close} />
        <button type="button" className="jp-back-link" onClick={actions.backToList}>
          {icon("chevron-left", "jp-back-icon")}
          {t.backToJournal}
        </button>
        <header className="jp-reader-heading">
          <div className="jp-reader-title">
            <h1 id={`${uid}-title`}>{learning.title}</h1>
            <JournalStatus state={completed ? "completed" : "in-course"} text={completed ? t.statusCompleted : t.statusInProgress} icon={icon} />
          </div>
          <p className="jp-subtitle">{renderTemplate(t.readerSubtitleTemplate, { number, zone })}</p>
        </header>

        <div className="jp-tabs">
          <div className="jp-tablist" role="tablist" aria-label={t.sectionsLabel}>
          {tabs.map((tab) => {
            const selected = tab.id === active;
            const spec = TAB_ICON[tab.id] ?? TAB_ICON.learning;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={tabId(tab.id)}
                className={`jp-tab ${selected ? "jp-tab--active" : ""}`}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => actions.selectSection(tab.id)}
                onKeyDown={onTabKeys}
              >
                {spec.own ? ownIcon(spec.own) : icon(tab.id === "learning" && selected ? "book-cream" : (spec.shared ?? "book-brown"))}
                {tab.label}
                {read.has(tab.id) ? (
                  <>
                    {icon("check-white", "jp-tab-check")}
                    <span className="visually-hidden">, {t.sectionRead}</span>
                  </>
                ) : null}
              </button>
            );
          })}
          </div>
          <span className="jp-section-count" aria-live="polite">
            {renderTemplate(t.sectionsReadTemplate, { read: readCount, total: tabs.length })}
            <span className="jp-section-dots" aria-hidden="true">
              {tabs.map((tab) => <i key={tab.id} className="jp-section-dot" data-read={read.has(tab.id)} />)}
            </span>
          </span>
        </div>

        <div className="jp-reader-body">
          <div id={panelId} className="jp-article" role="tabpanel" aria-labelledby={tabId(active)} tabIndex={0}>
            <ContentRenderer blocks={learning.sections[active]} />
          </div>
          <aside className="jp-sidebar">
            <section className={`jp-sidebar-card${learning.illustrationAssetId && assets.has(learning.illustrationAssetId) ? " jp-sidebar-card--art" : ""}`}>
              <h2>{t.sidebarTitle}</h2>
              {learning.illustrationAssetId && assets.has(learning.illustrationAssetId) ? <img src={assets.url(learning.illustrationAssetId)} className="jp-sidebar-illustration" alt="" aria-hidden="true" draggable={false} /> : null}
              {learning.keywords?.length ? (
                <ul className="jp-keywords">
                  {learning.keywords.map((k) => <li key={k} className="jp-keyword">{k}</li>)}
                </ul>
              ) : null}
            </section>
            <section className={`jp-sidebar-card jp-sidebar-card--badge ${completed ? "jp-sidebar-card--earned" : ""}`}>
              <h2>{completed ? t.badgeObtained : t.badgePending}</h2>
              {medal()}
              {badge ? <p className="jp-badge-name">{badge.title}</p> : null}
              {!completed ? <p className="jp-badge-instruction">{renderTemplate(t.badgeInstructionTemplate, { count: required.length })}</p> : null}
              <button type="button" className="jp-link" onClick={actions.openBadge}>
                {t.viewBadge}
                {icon("chevron-right", "jp-chevron")}
              </button>
            </section>
          </aside>
        </div>

        <footer className="jp-footer jp-reader-footer">
          <span className={`jp-footer-copy${readingNow ? " jp-footer-copy--read" : ""}`} role="status">
            {icon(readingNow ? "check-white" : "book-brown")}
            {readingNow ? t.sectionRead : renderTemplate(t.readingTemplate, { section: labelOf(active) })}
          </span>
          <button type="button" className="jp-action jp-action--primary" onClick={primary.run}>
            {primary.text}
            {icon("chevron-right", "jp-chevron")}
          </button>
        </footer>
      </div>
    </div>
  );
}
