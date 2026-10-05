import { useSyncExternalStore } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import type { SoundControl } from "../../audio/SoundControl";
import { IconButton } from "./IconButton";

/**
 * Botón «Sonido»: silencia y reactiva el audio del juego completo (la música y los efectos), SPEC 6.4 y 6.5, AC-51. Es un botón real con
 * etiqueta textual que cambia con el estado (con efectos habla de «sonido»; solo con música, de «música»); el icono es decorativo. Si el
 * navegador bloqueó el audio ofrece «Activar audio» y pulsarlo lo reintenta. Tras pulsarlo con ratón o toque devuelve el foco al mapa
 * (`onPointerUse`) para que las flechas sigan moviendo a Vanessa.
 */
export function SoundToggle({ control, onPointerUse }: { control: SoundControl; onPointerUse?: () => void }) {
  const { config } = useBitacora();
  const state = useSyncExternalStore(control.subscribe, control.getState);
  const labels = config.ui.labels;
  const silent = state.muted || state.blocked || state.failed;
  const sound = state.hasSfx;
  const unmute = (sound ? labels.soundUnmute : undefined) ?? labels.musicUnmute;
  const mute = (sound ? labels.soundMute : undefined) ?? labels.musicMute;
  const label = state.blocked ? (labels.soundActivate ?? unmute) : silent ? unmute : mute;
  const title = !silent && state.track ? `${label} — ${state.track.title}` : label;
  return (
    <IconButton
      assetId={silent && config.ui.assets.musicMutedButton ? config.ui.assets.musicMutedButton : config.ui.assets.musicButton}
      label={label}
      caption={labels.captionSound}
      hint={title}
      className="hud__music"
      data-music={silent ? "off" : "on"}
      data-sound={state.blocked ? "blocked" : silent ? "off" : "on"}
      onClick={(e) => {
        control.toggle();
        // Con ratón o toque el foco vuelve al mapa para seguir caminando; con teclado (detail 0) se queda en el botón.
        if (e.detail > 0) onPointerUse?.();
      }}
    >
      {silent && !config.ui.assets.musicMutedButton ? <span className="icon-button__slash" aria-hidden="true" /> : null}
    </IconButton>
  );
}
