import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Visible según su estilo calculado (no `offsetParent`, que es null en elementos `position: fixed`). */
function isVisible(node: HTMLElement): boolean {
  if (node.hidden || node.closest("[hidden]")) return false;
  const style = getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden";
}

/**
 * Mantiene Tab y Mayús+Tab dentro del contenedor mientras está montado (diálogo modal, SPEC 7). Los
 * elementos con tabindex=-1 (pestañas inactivas, con foco «itinerante») quedan fuera del ciclo.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, onEscape?: () => void): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.stopPropagation();
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisible);
      if (items.length === 0) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || !el.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !el.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [ref, onEscape]);
}
