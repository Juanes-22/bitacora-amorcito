import { useEffect, useRef, type ReactNode } from "react";
import { useFocusTrap } from "../reading/useFocusTrap";
import { WindowPanel } from "./WindowPanel";

interface Props {
  labelledBy: string;
  /** `alertdialog` para confirmaciones destructivas. */
  role?: "dialog" | "alertdialog";
  onEscape: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Marco modal común: capa sobre el mapa, ventana crema, foco contenido y Escape. El foco inicial va al primer
 * elemento con `data-autofocus` (o al propio diálogo); quien lo cierra devuelve el foco al mapa (SPEC 7).
 */
export function Modal({ labelledBy, role = "dialog", onEscape, children, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onEscape);
  useEffect(() => {
    (ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current)?.focus();
  }, []);
  return (
    <div className="reading-layer">
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`reading ${className}`.trim()}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.repeat) e.preventDefault(); // Enter mantenido no reactiva el control enfocado
        }}
      >
        <WindowPanel className="reading__window">
          <div className="reading__frame">{children}</div>
        </WindowPanel>
      </div>
    </div>
  );
}
