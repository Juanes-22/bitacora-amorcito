import type { CSSProperties, ReactNode } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import { useProgress } from "../../app/ProgressProvider";
import { stationNumber } from "../../domain/progression";
import { renderTemplate } from "../../domain/templates";
import { IconButton } from "./IconButton";

/**
 * Cabecera compacta: retrato, progreso directo («3 de 6 aprendizajes»), XP, nivel y el objetivo actual.
 * Todo se deriva de `route`, `badges` y el progreso; ningún total está escrito en el componente.
 * La barra usa el marco y recorta el relleno según la metadata `placement` del manifiesto.
 */
export function ProgressHUD({ onOpenBadges, tools }: { onOpenBadges?: () => void; tools?: ReactNode }) {
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

  const objective =
    summary.totalCount === 0
      ? labels.emptyRouteLabel
      : summary.inPreparation
        ? renderTemplate(labels.preparationTemplate, { pending: summary.pendingCount })
        : summary.finished
        ? labels.finishedLabel
        : renderTemplate(labels.objectiveTemplate, { number: stationNumber(config.route, summary.nextLearningId as string) });

  return (
    <section className={`hud${panelStyle ? " hud--panel" : ""}`} style={panelStyle} aria-label={config.project.title}>
      <img className="hud__portrait" src={assets.url(ui.portrait)} alt="" />
      <div className="hud__main">
        <p className="hud__progress">
          <span>{renderTemplate(labels.progressTemplate, { completedCount: summary.completedCount, totalCount: summary.totalCount })}</span>
          <span className="hud__level">{renderTemplate(labels.levelTemplate, { level: summary.level })}</span>
        </p>
        <div className="hud__xp">
          <div className="xp-bar" style={barStyle} role="img" aria-label={renderTemplate(labels.xpTemplate, { xp: summary.xp, maxXp: summary.maxXp })}>
            <img className="xp-bar__frame" src={assets.url(frameId)} alt="" />
            {fill ? <img className="xp-bar__fill" src={assets.url(fill[0])} alt="" /> : null}
          </div>
          <span className="hud__xp-text">{renderTemplate(labels.xpTemplate, { xp: summary.xp, maxXp: summary.maxXp })}</span>
        </div>
        <p className="hud__objective">{objective}</p>
      </div>
      {onOpenBadges ? (
        <IconButton assetId={ui.badgesButton} label={labels.badges} className="hud__badges" onClick={onOpenBadges} />
      ) : null}
      {tools ? <div className="hud__tools">{tools}</div> : null}
      {!persisting ? <p className="hud__warning" role="status">El avance no se está guardando en este navegador.</p> : null}
    </section>
  );
}
