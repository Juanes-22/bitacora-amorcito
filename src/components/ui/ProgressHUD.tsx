import type { CSSProperties, ReactNode } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import { useProgress } from "../../app/ProgressProvider";
import { renderTemplate } from "../../domain/templates";
import type { GameBridge } from "../../game/bridge/GameBridge";
import { AvatarPortrait } from "./AvatarPortrait";
import { IconButton } from "./IconButton";
import { fullTitle } from "../../domain/projectTitle";

/**
 * Cabecera compacta (SPEC 14): el panel con el avatar —nombre y nivel, barra de XP con su valor y «1 de 6 aprendizajes»—, la
 * insignia de la colección y las herramientas. Lo que sigue lo dice el letrero de la estación («Siguiente»), no la cabecera;
 * solo el aviso de que el recorrido está en preparación (modo final con aprendizajes sin aprobar) sigue aquí. Todo se deriva de `route`, `badges` y el progreso;
 * ningún total está escrito en el componente. En pantallas anchas flota sobre el mapa; en las estrechas se apila por
 * encima y por debajo de él (la disposición es de CSS). La barra usa el marco y recorta el relleno según la metadata
 * `placement` del manifiesto.
 */
export function ProgressHUD({ onOpenBadges, tools, bridge }: { onOpenBadges?: () => void; tools?: ReactNode; bridge?: GameBridge }) {
  const { config, assets } = useBitacora();
  const { summary, persisting } = useProgress();
  const { labels, assets: ui } = config.ui;

  const frameId = ui.xpBar;
  const frame = assets.get(frameId);
  const fill = assets.entries().find(([, a]) => a.placement?.relativeTo === frameId);
  const fraction = summary.maxXp > 0 ? Math.min(1, summary.xp / summary.maxXp) : 0;
  const barStyle = fill && frame.width && frame.height
    ? ({
        "--bar-ratio": String(frame.width / frame.height),
        "--fill-left": `${((fill[1].placement?.x ?? 0) / frame.width) * 100}%`,
        "--fill-top": `${((fill[1].placement?.y ?? 0) / frame.height) * 100}%`,
        "--fill-width": `${((fill[1].width ?? 0) / frame.width) * 100}%`,
        "--fill-clip": `${(1 - fraction) * 100}%`,
      } as CSSProperties)
    : undefined;

  // Panel de nueve zonas del catálogo (SPEC 14): el PNG aporta marco y fondo y el contenido se monta encima.
  const panelStyle = ui.statusPanel ? ({ "--panel-url": `url("${assets.url(ui.statusPanel)}")`, "--panel-slice": String(assets.get(ui.statusPanel).nineSlice?.top ?? 112) } as CSSProperties) : undefined;

  const notice = summary.totalCount > 0 && summary.inPreparation ? renderTemplate(labels.preparationTemplate, { pending: summary.pendingCount }) : null;
  const xpText = renderTemplate(labels.xpTemplate, { xp: summary.xp, maxXp: summary.maxXp });

  return (
    <section className="hud" aria-label={fullTitle(config.project)}>
      <div className="hud__stack">
      <div className="hud__panel hud--panel" style={panelStyle}>
        <AvatarPortrait bridge={bridge} />
        <div className="hud__main">
          <p className="hud__name">
            <span>{labels.playerName}</span>
            <span className="hud__level">{renderTemplate(labels.levelTemplate, { level: summary.level })}</span>
          </p>
          <div className="hud__xp">
            <div className="xp-bar" style={barStyle} role="img" aria-label={xpText}>
              <img className="xp-bar__frame" src={assets.url(frameId)} alt="" />
              {fill ? <img className="xp-bar__fill" src={assets.url(fill[0])} alt="" /> : null}
            </div>
            <span className="hud__xp-text">{xpText}</span>
          </div>
          <p className="hud__progress">{renderTemplate(labels.progressTemplate, { completedCount: summary.completedCount, totalCount: summary.totalCount })}</p>
        </div>
        {onOpenBadges ? <IconButton assetId={ui.badgesButton} label={labels.badges} className="hud__badges" onClick={onOpenBadges} /> : null}
      </div>
      {notice ? <p className="hud__objective" role="status">{notice}</p> : null}
      {!persisting ? <p className="hud__warning" role="status">El avance no se está guardando en este navegador.</p> : null}
      </div>
      {tools ? <div className="hud__tools">{tools}</div> : null}
    </section>
  );
}
