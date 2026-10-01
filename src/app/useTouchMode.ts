import { useEffect, useState } from "react";

/**
 * ¿Se maneja con el dedo? Verdadero si el dispositivo tiene puntero grueso (teléfono, tableta) o en cuanto llega un
 * toque; vuelve a falso si luego se usa una tecla de movimiento. Solo cambia los textos de ayuda («Toca la estación» en
 * lugar de «Enter»): el juego acepta los dos modos siempre.
 */
export function useTouchMode(): boolean {
  const [touch, setTouch] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches);
  useEffect(() => {
    const onPointer = (e: PointerEvent) => setTouch(e.pointerType === "touch" || e.pointerType === "pen" ? true : window.matchMedia?.("(pointer: coarse)").matches ?? false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key.startsWith("Arrow") || e.key === "Enter") setTouch(false);
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);
  return touch;
}
