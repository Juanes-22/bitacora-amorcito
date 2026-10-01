import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import type { GameBridge } from "../../game/bridge/GameBridge";
import type { Direction } from "../../game/bridge/events";
import { PixelButton } from "./PixelButton";

const ARROWS: Record<Direction, string> = { up: "▲", down: "▼", left: "◀", right: "▶" };
const GRID: Record<Direction, string> = { up: "up", left: "left", right: "right", down: "down" };

/**
 * Cruceta de cuatro direcciones y botón «Explorar» (SPEC 6.1). Sus pulsaciones viajan por el puente al mismo
 * InputController que el teclado: no hay un segundo sistema de movimiento. Cada puntero se sigue por separado, así que
 * se puede mantener una dirección y pulsar «Explorar» con otro dedo. Toda salida (levantar, cancelar, perder la
 * captura, ocultar la pestaña, desmontar) libera la dirección: nunca queda una entrada atascada.
 */
export function TouchControls({ bridge }: { bridge: GameBridge }) {
  const { config } = useBitacora();
  const { labels } = config.ui;
  const held = useRef(new Map<number, Direction>()); // puntero → dirección
  const keyHeld = useRef(new Set<Direction>());

  const setDirection = useCallback((direction: Direction, pressed: boolean) => bridge.emit("ui:direction", { direction, pressed }), [bridge]);

  /** Libera una dirección solo si ya ningún puntero ni tecla la mantiene. */
  const release = useCallback(
    (direction: Direction) => {
      const stillHeld = [...held.current.values()].includes(direction) || keyHeld.current.has(direction);
      if (!stillHeld) setDirection(direction, false);
    },
    [setDirection],
  );
  const releaseAll = useCallback(() => {
    const directions = new Set([...held.current.values(), ...keyHeld.current]);
    held.current.clear();
    keyHeld.current.clear();
    directions.forEach((d) => setDirection(d, false));
  }, [setDirection]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && releaseAll();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", releaseAll);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", releaseAll);
      releaseAll(); // desmontar (se abrió una lectura) libera lo que siguiera pulsado
    };
  }, [releaseAll]);

  const down = (direction: Direction) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* el puntero ya no existe */
    }
    held.current.set(e.pointerId, direction);
    setDirection(direction, true);
  };
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const direction = held.current.get(e.pointerId);
    if (!direction) return;
    held.current.delete(e.pointerId);
    release(direction);
  };
  const keyDown = (direction: Direction) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      e.preventDefault();
      keyHeld.current.add(direction);
      setDirection(direction, true);
    }
  };
  const keyUp = (direction: Direction) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      keyHeld.current.delete(direction);
      release(direction);
    }
  };
  const blur = (direction: Direction) => () => {
    if (keyHeld.current.delete(direction)) release(direction);
  };

  const label: Record<Direction, string> = { up: labels.moveUp, down: labels.moveDown, left: labels.moveLeft, right: labels.moveRight };

  return (
    <section className="touch" aria-label={labels.controlsLabel}>
      <div className="touch__pad">
        {(Object.keys(ARROWS) as Direction[]).map((direction) => (
          <button
            key={direction}
            type="button"
            className={`touch__arrow touch__arrow--${GRID[direction]}`}
            aria-label={label[direction]}
            onPointerDown={down(direction)}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
            onKeyDown={keyDown(direction)}
            onKeyUp={keyUp(direction)}
            onBlur={blur(direction)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span aria-hidden="true">{ARROWS[direction]}</span>
          </button>
        ))}
      </div>
      <PixelButton
        className="touch__explore"
        onPointerDown={(e) => {
          e.preventDefault();
          bridge.emit("ui:interact", { pressed: true });
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
            e.preventDefault();
            bridge.emit("ui:interact", { pressed: true });
          }
        }}
        onClick={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {labels.explore}
      </PixelButton>
    </section>
  );
}
