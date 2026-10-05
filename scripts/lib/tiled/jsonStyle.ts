// Escritura de bitacora.json que respeta el estilo con el que está mantenido a mano: solo se reescriben las regiones
// `placements` y `maps` (lo único que administra Tiled) y el resto del archivo queda byte a byte igual.

const isPrim = (v: unknown): boolean => v === null || typeof v !== "object";

/** Una sola línea, con `, ` y `: ` como separadores (el estilo del archivo). */
export function compact(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(compact).join(", ")}]`;
  if (isPrim(v)) return JSON.stringify(v);
  return `{${Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${JSON.stringify(k)}: ${compact(x)}`)
    .join(", ")}}`;
}

const flat = (v: unknown): boolean => !isPrim(v) && !Array.isArray(v) && Object.values(v as Record<string, unknown>).every(isPrim);

/** Colecciones cuyos elementos van cada uno en su línea. */
const INLINE_ITEMS = new Set(["critters", "obstacles", "layers"]);
/** Un mapa de puntos pequeño (`spawns`) cabe en una línea. */
const INLINE_MAX = 110;

/** Da formato a un valor con las reglas del archivo: objetos planos y listas de valores simples en línea; el resto, indentado. */
export function formatValue(v: unknown, indent: number, key?: string): string {
  if (isPrim(v)) return JSON.stringify(v);
  const arr = Array.isArray(v);
  const entries: Array<[string | null, unknown]> = arr ? (v as unknown[]).map((x) => [null, x]) : Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return arr ? "[]" : "{}";
  if (arr ? (v as unknown[]).every(isPrim) : flat(v)) return compact(v);
  if (key === "spawns" && compact(v).length <= INLINE_MAX) return compact(v);
  const pad = " ".repeat(indent + 2);
  const lines = entries.map(([k, x]) => `${pad}${k === null ? "" : `${JSON.stringify(k)}: `}${INLINE_ITEMS.has(key ?? "") && arr ? compact(x) : formatValue(x, indent + 2, k ?? undefined)}`);
  return `${arr ? "[" : "{"}\n${lines.join(",\n")}\n${" ".repeat(indent)}${arr ? "]" : "}"}`;
}

/**
 * Rango (offsets del texto) del valor de una clave de primer nivel del objeto JSON raíz. Recorre el texto respetando cadenas
 * y anidación; no interpreta nada más. `null` si la clave no está.
 */
export function topLevelValueRange(text: string, key: string): { start: number; end: number } | null {
  let depth = 0;
  let i = 0;
  const n = text.length;
  const skipString = (from: number): number => {
    let j = from + 1;
    while (j < n && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
    return j + 1;
  };
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      const end = skipString(i);
      if (depth === 1) {
        let k = end;
        while (k < n && /\s/.test(text[k])) k++;
        if (text[k] === ":" && JSON.parse(text.slice(i, end)) === key) {
          let s = k + 1;
          while (s < n && /\s/.test(text[s])) s++;
          return { start: s, end: valueEnd(text, s) };
        }
      }
      i = end;
      continue;
    }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    i++;
  }
  return null;
}

/** Fin del valor JSON que empieza en `start`. */
function valueEnd(text: string, start: number): number {
  const c = text[start];
  if (c === '"') {
    let j = start + 1;
    while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
    return j + 1;
  }
  if (c === "{" || c === "[") {
    let depth = 0;
    let j = start;
    while (j < text.length) {
      const d = text[j];
      if (d === '"') {
        j++;
        while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      } else if (d === "{" || d === "[") depth++;
      else if (d === "}" || d === "]") {
        depth--;
        if (depth === 0) return j + 1;
      }
      j++;
    }
    return text.length;
  }
  let j = start;
  while (j < text.length && !/[,}\]\s]/.test(text[j])) j++;
  return j;
}

/**
 * Sustituye en `text` los valores de primer nivel de `values` (p. ej. `placements` y `maps`) por su versión formateada.
 * Devuelve `null` si alguna clave no se localiza (el llamador decide qué hacer: reescribir todo el archivo).
 */
export function replaceTopLevel(text: string, values: Record<string, unknown>): string | null {
  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (const [key, value] of Object.entries(values)) {
    const range = topLevelValueRange(text, key);
    if (!range) return null;
    edits.push({ ...range, text: formatValue(value, 2, key) });
  }
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}
