import { useSyncExternalStore } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import type { MusicPlayer } from "../../audio/MusicPlayer";

/**
 * Botón para apagar y encender la música (SPEC 6.4, AC-51). Es un botón real con etiqueta textual que cambia con el
 * estado; el icono es decorativo. Si el navegador bloqueó la reproducción, pulsarlo la reintenta. Tras pulsarlo con
 * ratón o toque devuelve el foco al mapa (`onPointerUse`) para que las flechas sigan moviendo a Vanessa.
 */
export function MusicToggle({ player, onPointerUse }: { player: MusicPlayer; onPointerUse?: () => void }) {
  const { config } = useBitacora();
  const state = useSyncExternalStore(player.subscribe, player.getState);
  const silent = state.muted || state.status === "blocked" || state.status === "error";
  const label = silent ? config.ui.labels.musicUnmute : config.ui.labels.musicMute;
  const title = !silent && state.track ? `${label} — ${state.track.title}` : label;
  return (
    <button type="button" className="hud__music" aria-label={label} title={title} data-music={silent ? "off" : "on"} onClick={(e) => {
        player.toggle();
        // Con ratón o toque el foco vuelve al mapa para seguir caminando; con teclado (detail 0) se queda en el botón.
        if (e.detail > 0) onPointerUse?.();
      }}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        {silent ? (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}
      </svg>
    </button>
  );
}
