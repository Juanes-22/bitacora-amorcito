import { useBitacora } from "../../app/BitacoraProvider";
import type { ControlsMode } from "../../game/bridge/events";
import { IconButton } from "./IconButton";

/**
 * Cambia entre tocar para caminar y la cruceta (SPEC 6.1). Solo se ve en pantallas táctiles o estrechas (CSS): en
 * escritorio con ratón se usa el teclado. El botón dice a qué modo pasa; el arte es el del engranaje de ajustes.
 */
export function ControlsModeToggle({ mode, onToggle }: { mode: ControlsMode; onToggle: () => void }) {
  const { config } = useBitacora();
  const label = mode === "tap" ? config.ui.labels.controlsUseDpad : config.ui.labels.controlsUseTap;
  return (
    <IconButton
      assetId={config.ui.assets.controlsButton}
      label={label}
      className="hud__controls"
      data-mode={mode}
      onClick={(e) => {
        onToggle();
        if (e.detail > 0) (document.querySelector(".game-host") as HTMLElement | null)?.focus(); // con ratón o toque, el foco vuelve al mapa
      }}
    />
  );
}
