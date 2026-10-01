import { useEffect, useRef, type Ref, type RefObject } from "react";
import type Phaser from "phaser";
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
}

/**
 * Aloja la única instancia de Phaser.Game. Solo se recrea si cambian la configuración, el registro o el
 * puente (es decir, tras una recarga), nunca por progreso, pestañas ni insignias (SPEC 11.4).
 */
export function PhaserGame({ config, assets, bridge, initial, inert, hostRef }: Props) {
  const initialRef = useRef(initial); // solo el primer arranque: no debe recrear el juego si cambia el progreso
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const game: Phaser.Game = createGame(container, { config, assets, bridge, reducedMotion, initial: initialRef.current });
    // Un clic en el mapa le da el foco: el teclado del juego solo escucha ahí.
    const focus = () => container.focus({ preventScroll: true });
    container.addEventListener("pointerdown", focus);
    return () => {
      container.removeEventListener("pointerdown", focus);
      game.destroy(true);
    };
  }, [config, assets, bridge]);

  return (
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
  );
}
