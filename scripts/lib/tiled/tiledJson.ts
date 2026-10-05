// Serializador con el estilo de los archivos .tmj/.tsj/.tiled-project que escribe Tiled, para que guardar desde el editor
// no reformatee todo el archivo (claves en orden alfabético, sangrías de Tiled, `\/` escapado).

const esc = (s: string): string => JSON.stringify(s).replace(/\//g, "\\/");

const sortedKeys = (o: Record<string, unknown>): string[] => Object.keys(o).filter((k) => o[k] !== undefined).sort();

function value(v: unknown, keyIndent: number): string {
  if (v === null) return "null";
  if (typeof v === "string") return esc(v);
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const pad = " ".repeat(keyIndent + 7);
    const items = v.map((x) => (x !== null && typeof x === "object" ? node(x as Record<string, unknown>, keyIndent + 7) : value(x, keyIndent)));
    return `[\n${items.map((s, i) => `${pad}${s}${i < items.length - 1 ? ", " : ""}`).join("\n")}]`;
  }
  return `\n${" ".repeat(keyIndent + 3)}${node(v as Record<string, unknown>, keyIndent + 3)}`;
}

/** Un objeto con su `{` ya colocada por el llamador, claves a `indent + 1` y `}` a `indent`. */
function node(o: Record<string, unknown>, indent: number): string {
  const keys = sortedKeys(o);
  if (keys.length === 0) return "{}";
  const pad = " ".repeat(indent + 1);
  return `{\n${keys.map((k) => `${pad}${esc(k)}:${value(o[k], indent + 1)}`).join(",\n")}\n${" ".repeat(indent)}}`;
}

/** Texto de un documento de Tiled (mapa, tileset o proyecto) con su estilo. */
export function tiledJson(doc: Record<string, unknown>): string {
  const keys = sortedKeys(doc);
  const body = keys.map((k, i) => `${i === 0 ? "" : " "}${esc(k)}:${value(doc[k], 1)}`).join(",\n");
  return `{ ${body}\n}`;
}
