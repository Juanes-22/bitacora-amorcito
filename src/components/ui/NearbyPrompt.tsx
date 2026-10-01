import { stationNumber } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";
import { useBitacora } from "../../app/BitacoraProvider";
import type { NearbyTarget } from "../../game/bridge/events";

/** Aviso contextual al acercarse a una estación o un portal. No abre nada: solo informa (SPEC 5). */
export function NearbyPrompt({ target }: { target: NearbyTarget | null }) {
  const { config } = useBitacora();
  let text = "";
  if (target?.kind === "learning") {
    const title = config.learnings[target.id]?.title ?? "";
    text = `${renderTemplate(config.ui.labels.stationTitleTemplate, { number: stationNumber(config.route, target.id), title })} — ${config.ui.labels.explore} (Enter)`;
  } else if (target?.kind === "portal") {
    const label = Object.values(config.maps).flatMap((z) => Object.entries(z.portals)).find(([id]) => id === target.id)?.[1].label ?? "";
    text = `${label} (Enter)`;
  }
  return (
    <div className="nearby-region" role="status" aria-live="polite">
      {text ? <p className="nearby">{text}</p> : null}
    </div>
  );
}
