import { useBitacora } from "../../app/BitacoraProvider";
import type { GameBridge } from "../../game/bridge/GameBridge";

/**
 * «Jugar con Jerry» (SPEC 6.2): pide que Jerry traiga el peluche y, la vez siguiente, haga sus trucos (salto, sentarse, dar
 * la pata), igual que la tecla configurada (por defecto P). Es el camino táctil de esas acciones y también un recordatorio
 * de la tecla en escritorio. Solo existe si la configuración trae alguna acción; se desactiva mientras hay una ventana
 * abierta.
 */
export function JerryActionButton({ bridge, disabled }: { bridge: GameBridge; disabled: boolean }) {
  const { config } = useBitacora();
  const idle = config.gameplay.player.idle;
  if (!idle?.actionKey || (!idle.fetch && !idle.tricks)) return null;
  const label = `${config.ui.labels.jerryAction} (${idle.actionKey})`;
  return (
    <button
      type="button"
      className="hud__jerry"
      aria-label={label}
      title={label}
      aria-keyshortcuts={idle.actionKey}
      disabled={disabled}
      onClick={(e) => {
        bridge.emit("ui:jerry-action", {});
        if (e.detail > 0) (document.querySelector(".game-host") as HTMLElement | null)?.focus(); // con ratón o toque, el foco vuelve al mapa
      }}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <ellipse cx="12" cy="16" rx="5" ry="4" fill="currentColor" />
        <ellipse cx="5.5" cy="11" rx="2" ry="2.6" fill="currentColor" />
        <ellipse cx="9.5" cy="6.5" rx="2" ry="2.8" fill="currentColor" />
        <ellipse cx="14.5" cy="6.5" rx="2" ry="2.8" fill="currentColor" />
        <ellipse cx="18.5" cy="11" rx="2" ry="2.6" fill="currentColor" />
      </svg>
    </button>
  );
}
