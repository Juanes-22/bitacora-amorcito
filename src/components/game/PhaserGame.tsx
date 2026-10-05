import { useEffect, useRef, useState, type Ref, type RefObject } from "react";
import type Phaser from "phaser";
import type { SfxService } from "../../audio/SfxService";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { BitacoraConfig, Point } from "../../config/types";
import { createGame } from "../../game/createGame";
import type { GameBridge } from "../../game/bridge/GameBridge";

interface Props {
  config: BitacoraConfig;
  assets: AssetRegistry;
  bridge: GameBridge;
  /** Ubicación restaurada del guardado para el primer arranque. */
  initial?: { zoneId: string; position: Point };
  inert?: boolean;
  hostRef?: Ref<HTMLDivElement>;
  /** Efectos de sonido del juego (SPEC 6.5). Debe ser estable: cambiar su identidad recrearía el juego. */
  sfx?: SfxService | null;
}

/**
 * Aloja la única instancia de Phaser.Game. Solo se recrea si cambian la configuración, el registro o el
 * puente (es decir, tras una recarga), nunca por progreso, pestañas ni insignias (SPEC 11.4).
 */
export function PhaserGame({ config, assets, bridge, initial, inert, hostRef, sfx }: Props) {
  const initialRef = useRef(initial); // solo el primer arranque: no debe recrear el juego si cambia el progreso
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Avance de la carga de lo esencial de la zona (0..1); `null` cuando el mapa ya está listo.
  const [loading, setLoading] = useState<number | null>(0);

  useEffect(() => {
    const offProgress = bridge.on("game:load-progress", ({ value }) => setLoading((prev) => (prev === null ? value : Math.max(prev, value))));
    const offReady = bridge.on("game:ready", () => setLoading(null));
    return () => {
      offProgress();
      offReady();
    };
  }, [bridge]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const game: Phaser.Game = createGame(container, { config, assets, bridge, reducedMotion, initial: initialRef.current, sfx });
    // Un clic en el mapa le da el foco: el teclado del juego solo escucha ahí.
    const focus = () => container.focus({ preventScroll: true });
    container.addEventListener("pointerdown", focus);
    return () => {
      container.removeEventListener("pointerdown", focus);
      game.destroy(true);
    };
  }, [config, assets, bridge, sfx]);

  const label = config.ui.labels.loadingMap ?? "Cargando el mapa…";
  return (
    <>
      <div
        className="game-host"
        ref={(el) => {
          containerRef.current = el;
          if (typeof hostRef === "function") hostRef(el);
          else if (hostRef) (hostRef as RefObject<HTMLDivElement | null>).current = el;
        }}
        tabIndex={0}
        role="region"
        aria-label={config.ui.labels.mapLabel}
        inert={inert}
      />
      {loading !== null ? (
        <div className="map-loading" role="status">
          <p className="map-loading__text">{label}</p>
          <div className="map-loading__bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(loading * 100)}>
            <div className="map-loading__fill" style={{ width: `${Math.round(loading * 100)}%` }} />
          </div>
        </div>
      ) : null}
    </>
  );
}
