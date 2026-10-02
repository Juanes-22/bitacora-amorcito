import { useSyncExternalStore } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import type { MusicPlayer } from "../../audio/MusicPlayer";
import { IconButton } from "./IconButton";

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
    <IconButton
      assetId={silent && config.ui.assets.musicMutedButton ? config.ui.assets.musicMutedButton : config.ui.assets.musicButton}
      label={label}
      caption={config.ui.labels.captionSound}
      hint={title}
      className="hud__music"
      data-music={silent ? "off" : "on"}
      onClick={(e) => {
        player.toggle();
        // Con ratón o toque el foco vuelve al mapa para seguir caminando; con teclado (detail 0) se queda en el botón.
        if (e.detail > 0) onPointerUse?.();
      }}
    >
      {silent && !config.ui.assets.musicMutedButton ? <span className="icon-button__slash" aria-hidden="true" /> : null}
    </IconButton>
  );
}
