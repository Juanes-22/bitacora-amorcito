import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import { JOURNAL_PANEL_SHARED_PARTS, type JournalPanelPart, type JournalPanelSharedPart } from "../../config/journalPanelParts";
import type { BadgePanelConfig, JournalPanelConfig } from "../../config/types";

/**
 * Lo común del índice y el lector de la Bitácora de aprendizajes: sus textos, las imágenes del kit y las variables CSS de los
 * marcos de nueve zonas (`--bpk-<pieza>` y `--bpk-<pieza>-slice`, resueltas con el registro de assets: el CSS no tiene rutas).
 * Las piezas compartidas con el panel de insignias se piden con su prefijo; las propias del kit, con el de `ui.journalPanel`.
 */
export function useJournalKit() {
  const { config, assets } = useBitacora();
  const journal = config.ui.journalPanel as JournalPanelConfig;
  const badges = config.ui.badgePanel as BadgePanelConfig;

  const vars = useMemo(() => {
    const out: Record<string, string> = {};
    for (const name of JOURNAL_PANEL_SHARED_PARTS) {
      const id = `${badges.assetPrefix}${name}`;
      if (!assets.has(id)) continue;
      out[`--bpk-${name}`] = `url("${assets.url(id)}")`;
      const s = assets.get(id).nineSlice;
      if (s) out[`--bpk-${name}-slice`] = `${s.top} ${s.right} ${s.bottom} ${s.left}`;
    }
    return out as CSSProperties;
  }, [assets, badges.assetPrefix]);

  const own = (name: JournalPanelPart) => assets.url(`${journal.assetPrefix}${name}`);
  const shared = (name: JournalPanelSharedPart) => assets.url(`${badges.assetPrefix}${name}`);
  /** Imagen decorativa de una pieza compartida (los textos son HTML, nunca parte de la imagen). */
  const icon = (name: JournalPanelSharedPart, className = "jp-icon"): ReactNode => <img src={shared(name)} className={className} alt="" aria-hidden="true" draggable={false} />;
  const ownIcon = (name: JournalPanelPart, className = "jp-icon"): ReactNode => <img src={own(name)} className={className} alt="" aria-hidden="true" draggable={false} />;

  return { config, assets, journal, t: journal.labels, vars, own, shared, icon, ownIcon };
}

export type JournalState = "completed" | "available" | "locked" | "in-course";

/** Etiqueta de estado: se dice con texto y con su icono, no solo con el color. */
export function JournalStatus({ state, text, icon }: { state: JournalState; text: string; icon: (name: JournalPanelSharedPart) => ReactNode }) {
  if (state === "available") {
    return (
      <span className="jp-status jp-status--available">
        <span className="jp-play" aria-hidden="true">▶</span>
        {text}
      </span>
    );
  }
  const name: JournalPanelSharedPart = state === "completed" ? "check-white" : state === "in-course" ? "book-brown" : "lock-seal";
  return (
    <span className={`jp-status jp-status--${state}`}>
      {icon(name)}
      {text}
    </span>
  );
}
