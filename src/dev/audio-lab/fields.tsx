import { useEffect, useId, useState, type ReactNode } from "react";

/** Campos del laboratorio: etiqueta visible, objetivo táctil de 44 px y valores que no se «pisan» mientras se escribe. */

export function NumberField({ label, value, min, max, step = 1, unit, onChange, hint }: { label: string; value: number; min?: number; max?: number; step?: number; unit?: string; onChange: (n: number) => void; hint?: string }) {
  const id = useId();
  const [text, setText] = useState(String(value));
  // Si el valor cambia desde fuera (restablecer, importar) el campo lo sigue; mientras se escribe «0.» no se pisa.
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="lab-field">
      <label htmlFor={id}>{label}{unit ? <span className="lab-unit"> ({unit})</span> : null}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    </div>
  );
}

export function RangeField({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; format?: (n: number) => string }) {
  const id = useId();
  return (
    <div className="lab-field lab-field--range">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id}>{format ? format(value) : String(value)}</output>
    </div>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  const id = useId();
  return (
    <div className="lab-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (s: string) => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className="lab-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}

export function CheckField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (b: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="lab-field lab-field--check">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={hint ? `${id}-hint` : undefined} />
      <label htmlFor={id}>{label}</label>
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    </div>
  );
}
