import { useRef, type KeyboardEvent } from "react";
import type { SectionId } from "../../config/types";

export interface TabInfo {
  id: SectionId;
  label: string;
  read: boolean;
}

interface Props {
  tabs: readonly TabInfo[];
  active: SectionId;
  /** Etiqueta textual del estado «leída», accesible además del símbolo. */
  readLabel: string;
  idPrefix: string;
  onSelect: (id: SectionId) => void;
}

export const tabId = (prefix: string, id: SectionId) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: SectionId) => `${prefix}-panel-${id}`;

/**
 * Pestañas con el patrón WAI-ARIA (roles, asociaciones y teclado): flechas, Inicio y Fin cambian de pestaña
 * y la activan. Las flechas se consumen aquí: no llegan al mapa ni mueven al personaje (SPEC 7).
 */
export function LearningTabs({ tabs, active, readLabel, idPrefix, onSelect }: Props) {
  const refs = useRef<Partial<Record<SectionId, HTMLButtonElement | null>>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === active);
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div role="tablist" aria-label="Secciones del aprendizaje" className="tabs" onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => void (refs.current[t.id] = el)}
          role="tab"
          type="button"
          id={tabId(idPrefix, t.id)}
          aria-selected={t.id === active}
          aria-controls={panelId(idPrefix, t.id)}
          tabIndex={t.id === active ? 0 : -1}
          data-autofocus={t.id === active ? "" : undefined}
          className={`tab${t.id === active ? " tab--active" : ""}`}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
          {t.read ? (
            <>
              <span aria-hidden="true" className="tab__check"> ✓</span>
              <span className="visually-hidden">, {readLabel}</span>
            </>
          ) : null}
        </button>
      ))}
    </div>
  );
}
