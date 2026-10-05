import { useEffect, useRef } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import { dialogueLines } from "../../app/dialogues";
import { useProgress } from "../../app/ProgressProvider";
import type { ReadingActions, ReadingState } from "../../app/useProgressController";
import { currentEntry, isEntryCompleted, requiredSectionIds, stationNumber } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";
import type { SectionId } from "../../config/types";
import { PixelButton } from "../ui/PixelButton";
import { WindowPanel } from "../ui/WindowPanel";
import { ContentRenderer } from "./ContentRenderer";
import { JournalReader } from "./JournalReader";
import { LearningTabs, panelId, tabId } from "./LearningTabs";
import { useFocusTrap } from "./useFocusTrap";

const ID = "reading";
/** Tiempo tras mostrarse la recompensa durante el que se ignora «Cerrar» (clics duplicados, Enter mantenido). */
const REWARD_GUARD_MS = 450;

/**
 * Una sola ventana para TODOS los aprendizajes (SPEC 11.3): apertura → lectura por pestañas → recompensa,
 * o solo un mensaje si está bloqueado o pendiente. Es HTML de React fuera del canvas: los párrafos son texto
 * seleccionable y accesible, nunca texto de Phaser. Modal: título, cierre visible, foco inicial coherente,
 * foco contenido y Escape; quien la cierra devuelve el foco al mapa.
 */
export function LearningDialog(props: { reading: ReadingState; actions: ReadingActions }) {
  const { config } = useBitacora();
  // Con el kit de la Bitácora de aprendizajes, la lectura es su lector; la apertura, los mensajes y la recompensa conservan su ventana.
  if (props.reading.kind === "reading" && config.ui.journalPanel && config.ui.badgePanel) return <JournalReader reading={props.reading} actions={props.actions} />;
  return <ClassicLearningDialog {...props} />;
}

function ClassicLearningDialog({ reading, actions }: { reading: ReadingState; actions: ReadingActions }) {
  const { config, assets } = useBitacora();
  const { state, summary } = useProgress();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, actions.close);

  const { labels } = config.ui;
  const learning = config.learnings[reading.learningId];
  const entry = currentEntry(state, config, reading.learningId);
  const completed = isEntryCompleted(entry, learning);
  const title = renderTemplate(labels.stationTitleTemplate, { number: stationNumber(config.route, reading.learningId), title: learning.title });

  // Un doble clic en «Recoger insignia» no debe cerrar al instante la pantalla de recompensa que aparece en su lugar.
  const phaseStart = useRef(0);
  const closeReward = () => {
    if (performance.now() - phaseStart.current >= REWARD_GUARD_MS) actions.close();
  };

  // Foco inicial por fase: el control que continúa la tarea.
  useEffect(() => {
    phaseStart.current = performance.now();
    const target = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current;
    target?.focus(); // si no hay un control claro, el propio diálogo: así Escape y Tab siempre llegan a él
  }, [reading.kind]);

  // Al marcar una sección su botón desaparece: el foco pasa a la pestaña activa para no perderse en <body>
  // y poder seguir con las flechas.
  const activeSection = reading.kind === "reading" ? reading.active : null;
  const activeRead = activeSection !== null && entry.readSectionIds.includes(activeSection);
  const justMarked = useRef(false);
  useEffect(() => {
    if (justMarked.current && activeRead && activeSection) {
      justMarked.current = false;
      document.getElementById(tabId(ID, activeSection))?.focus();
    }
  }, [activeRead, activeSection]);

  const header = (
    <div className="reading__header">
      <h2 id={`${ID}-title`} className="reading__title">{title}</h2>
      {/* Un solo «Cerrar»: el verde del pie cuando lo hay (mensaje y recompensa); en la apertura y la lectura, donde el pie
          lo ocupa la acción principal, el de la cabecera. */}
      {reading.kind === "intro" || reading.kind === "reading" ? (
        <button type="button" className="reading__close" onClick={actions.close}>
          {labels.close}
        </button>
      ) : null}
    </div>
  );

  let body: React.ReactNode;
  if (reading.kind === "message") {
    const away = renderTemplate(labels.awayFromStationTemplate ?? "Ve a la estación de «{title}» en {zone} para explorarlo.", {
      number: stationNumber(config.route, reading.learningId),
      title: learning.title,
      zone: config.maps[config.placements[reading.learningId]?.zoneId]?.label ?? "",
    });
    const lines =
      reading.event === "pending" ? [{ speaker: "narrator" as const, text: labels.pending }]
      : reading.event === "away" ? [{ speaker: "narrator" as const, text: away }]
      : dialogueLines(config, state, reading.learningId, "locked");
    body = (
      <>
        <div className="reading__body">
          <Lines lines={lines} />
          {config.mode === "demo" && labels.demo ? <p className="reading__demo">{labels.demo}</p> : null}
        </div>
        <div className="reading__footer">
          <PixelButton data-autofocus onClick={actions.close}>{labels.close}</PixelButton>
        </div>
      </>
    );
  } else if (reading.kind === "intro") {
    body = (
      <>
        <div className="reading__body">
          <Lines lines={dialogueLines(config, state, reading.learningId, reading.event)} />
          {config.mode === "demo" && labels.demo ? <p className="reading__demo">{labels.demo}</p> : null}
        </div>
        <div className="reading__footer">
          <PixelButton data-autofocus onClick={actions.continueReading}>{labels.next}</PixelButton>
        </div>
      </>
    );
  } else if (reading.kind === "reward") {
    const badge = config.badges[learning.badgeId];
    body = (
      <>
        <div className="reading__body reading__reward">
          <p className="reading__reward-title">{labels.rewardTitle}</p>
          {badge ? <img className="reading__badge" src={assets.url(badge.assetId)} alt={badge.title} /> : null}
          {badge ? <p className="reading__badge-name">{badge.title}</p> : null}
          <Lines lines={dialogueLines(config, state, reading.learningId, "reward")} />
          <p className="reading__totals">
            {renderTemplate(labels.xpTemplate, { xp: summary.xp, maxXp: summary.maxXp })} · {renderTemplate(labels.levelTemplate, { level: summary.level })}
          </p>
        </div>
        <div className="reading__footer">
          <PixelButton data-autofocus onClick={closeReward}>{labels.close}</PixelButton>
        </div>
      </>
    );
  } else {
    const read = new Set(entry.readSectionIds);
    const required = requiredSectionIds(config);
    const remaining = required.filter((s) => !read.has(s)).length;
    const active: SectionId = reading.active;
    const badge = config.badges[learning.badgeId];
    body = (
      <>
        <LearningTabs
          idPrefix={ID}
          tabs={config.ui.tabs.map((t) => ({ id: t.id, label: t.label, read: read.has(t.id) }))}
          active={active}
          readLabel={labels.sectionRead}
          onSelect={actions.selectSection}
        />
        <div
          role="tabpanel"
          id={panelId(ID, active)}
          aria-labelledby={tabId(ID, active)}
          tabIndex={0}
          className="reading__body reading__panel"
        >
          {config.mode === "demo" && labels.demo ? <p className="reading__demo">{labels.demo}</p> : null}
          <ContentRenderer blocks={learning.sections[active]} />
          <div className="reading__section-actions">
            <p className={`reading__status${activeRead ? " reading__status--read" : ""}`} role="status">
              {activeRead ? `✓ ${labels.sectionRead}` : labels.sectionUnread}
            </p>
            {!activeRead && !completed ? (
              <PixelButton
                onClick={() => {
                  justMarked.current = true;
                  actions.markRead(active);
                }}
              >
                {labels.markRead}
              </PixelButton>
            ) : null}
          </div>
        </div>
        <div className="reading__footer">
          {completed ? (
            <p className="reading__earned">
              {badge ? <img src={assets.url(badge.assetId)} alt="" className="reading__earned-img" /> : null}
              {labels.badgeEarned}
              {badge ? `: ${badge.title}` : ""}
            </p>
          ) : (
            <>
              <PixelButton disabled={remaining > 0} aria-describedby={`${ID}-remaining`} onClick={actions.claimBadge}>
                {labels.claimBadge}
              </PixelButton>
              {remaining > 0 ? (
                <p id={`${ID}-remaining`} className="reading__remaining">{renderTemplate(labels.remainingTemplate, { remaining })}</p>
              ) : null}
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="reading-layer">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ID}-title`}
        className="reading"
        tabIndex={-1}
        onKeyDown={(e) => {
          // Enter mantenido no vuelve a activar el control que tenga el foco (p. ej. «Cerrar» tras la recompensa).
          if (e.key === "Enter" && e.repeat) e.preventDefault();
        }}
      >
        <WindowPanel className="reading__window">
          <div className="reading__frame">
            {header}
            {body}
          </div>
        </WindowPanel>
      </div>
    </div>
  );
}

function Lines({ lines }: { lines: Array<{ speaker: "vanessa" | "narrator"; text: string }> }) {
  const { config } = useBitacora();
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className="reading__line">
          {line.speaker === "vanessa" ? <strong>{config.project.studentName}: </strong> : null}
          {line.text}
        </p>
      ))}
    </>
  );
}
