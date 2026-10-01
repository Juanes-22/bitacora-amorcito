import { stationNumber } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";
import { useBitacora } from "../../app/BitacoraProvider";
import type { NearbyTarget } from "../../game/bridge/events";

/** Aviso contextual al acercarse a una estación o un portal. No abre nada: solo informa (SPEC 5). Con el dedo dice qué tocar; con teclado, qué pulsar. */
/** Cómo se invita a actuar: tocando la estación, con el botón «Explorar» o con Enter. */
export type PromptHint = "tap" | "button" | "key";

export function NearbyPrompt({ target, hint = "key" }: { target: NearbyTarget | null; hint?: PromptHint }) {
  const { config } = useBitacora();
  let text = "";
  if (target?.kind === "learning") {
    const title = config.learnings[target.id]?.title ?? "";
    text = `${renderTemplate(config.ui.labels.stationTitleTemplate, { number: stationNumber(config.route, target.id), title })} — ${hint === "tap" ? config.ui.labels.tapExplore : hint === "button" ? config.ui.labels.explore : `${config.ui.labels.explore} (Enter)`}`;
  } else if (target?.kind === "portal") {
    const label = Object.values(config.maps).flatMap((z) => Object.entries(z.portals)).find(([id]) => id === target.id)?.[1].label ?? "";
    text = hint === "tap" ? `${label} — ${config.ui.labels.tapTravel}` : hint === "button" ? `${label} — ${config.ui.labels.explore}` : `${label} (Enter)`;
  }
  return (
    <div className="nearby-region" role="status" aria-live="polite">
      {text ? <p className="nearby">{text}</p> : null}
    </div>
  );
}
