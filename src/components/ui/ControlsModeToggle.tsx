import { useBitacora } from "../../app/BitacoraProvider";
import type { ControlsMode } from "../../game/bridge/events";

/**
 * Cambia entre tocar para caminar y la cruceta (SPEC 6.1). Solo se ve en pantallas táctiles o estrechas (CSS): en
 * escritorio con ratón se usa el teclado. El botón dice a qué modo pasa; el icono es decorativo.
 */
export function ControlsModeToggle({ mode, onToggle }: { mode: ControlsMode; onToggle: () => void }) {
  const { config } = useBitacora();
  const label = mode === "tap" ? config.ui.labels.controlsUseDpad : config.ui.labels.controlsUseTap;
  return (
    <button type="button" className="hud__controls" aria-label={label} title={label} data-mode={mode} onClick={(e) => { onToggle(); if (e.detail > 0) (document.querySelector(".game-host") as HTMLElement | null)?.focus(); }}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        {mode === "tap" ? (
          // pasa a la cruceta: se dibuja una cruz direccional
          <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        ) : (
          // pasa a tocar: se dibuja un dedo tocando
          <path d="M9 11V5a2 2 0 0 1 4 0v5l5 1.5a2 2 0 0 1 1.4 2.2L18.6 19a2 2 0 0 1-2 1.6H11a2 2 0 0 1-1.6-.8L5 14l1.6-1.4L9 14z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}
