import { useBitacora } from "../../app/BitacoraProvider";
import { useProgress } from "../../app/ProgressProvider";
import { stationNumber, stationStatesOf, type StationState } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";
import { Modal } from "./Modal";
import { PixelButton } from "./PixelButton";

interface Props {
  onOpen: (learningId: string) => void;
  onClose: () => void;
}

/**
 * Lista accesible de aprendizajes (SPEC 14, AC-11): abre cualquier aprendizaje sin mover al personaje, con las mismas
 * reglas que el mapa. Un aprendizaje bloqueado o pendiente muestra su mensaje igual que junto a la estación; la lista
 * no otorga insignias ni se salta la secuencia. El estado se dice con texto, no solo con el color.
 */
export function LearningList({ onOpen, onClose }: Props) {
  const { config } = useBitacora();
  const { state } = useProgress();
  const { labels } = config.ui;
  const stations = stationStatesOf(config, state);
  const stateLabel: Record<StationState, string> = { locked: labels.stateLocked, available: labels.stateAvailable, completed: labels.stateCompleted };
  const zoneOf = (id: string) => config.maps[config.placements[id]?.zoneId]?.label ?? "";

  return (
    <Modal labelledBy="list-title" onEscape={onClose}>
      <div className="reading__header">
        <h2 id="list-title" className="reading__title">{labels.index}</h2>
      </div>
      <div className="reading__body">
        {config.route.length === 0 ? <p className="reading__line">{labels.emptyRouteLabel}</p> : null}
        <ol className="learning-list">
          {config.route.map((id, index) => {
            const learning = config.learnings[id];
            const status = stations[id] ?? "locked";
            const heading = renderTemplate(labels.stationTitleTemplate, { number: stationNumber(config.route, id), title: learning.title });
            return (
              <li key={id} className={`learning-list__item learning-list__item--${status}`}>
                <div className="learning-list__text">
                  <p className="learning-list__title">{heading}</p>
                  <p className="learning-list__meta">
                    <span className="learning-list__state">{stateLabel[status]}</span>
                    {zoneOf(id) ? <span className="learning-list__zone"> · {zoneOf(id)}</span> : null}
                  </p>
                </div>
                <button
                  type="button"
                  className="learning-list__open"
                  onClick={() => onOpen(id)}
                  aria-label={`${labels.explore}: ${heading}. ${stateLabel[status]}`}
                  data-autofocus={index === 0 ? "" : undefined}
                >
                  {labels.explore}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="reading__footer">
        <PixelButton onClick={onClose}>{labels.close}</PixelButton>
      </div>
    </Modal>
  );
}
