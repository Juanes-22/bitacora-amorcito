// Serializador con el estilo de los archivos .tmj/.tsj/.tiled-project que escribe Tiled, para que guardar desde el editor
// no reformatee todo el archivo (claves en orden alfabético, sangrías de Tiled, `\/` escapado).

type Esc = (s: string) => string;

const escUtf8: Esc = (s) => JSON.stringify(s).replace(/\//g, "\\/");
/** Los caracteres que no son ASCII como `\uXXXX`: el estilo con el que Tiled guarda un mapa con tildes en los nombres. */
const escAscii: Esc = (s) => escUtf8(s).replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

/** ¿El texto de un archivo de Tiled escribe sus caracteres no ASCII como `\uXXXX`? Así se sabe con qué estilo volver a guardarlo. */
export const usesUnicodeEscapes = (text: string): boolean => /\\u[0-9a-fA-F]{4}/.test(text);

const sortedKeys = (o: Record<string, unknown>): string[] => Object.keys(o).filter((k) => o[k] !== undefined).sort();

function value(v: unknown, keyIndent: number, esc: Esc): string {
  if (v === null) return "null";
  if (typeof v === "string") return esc(v);
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const pad = " ".repeat(keyIndent + 7);
    const items = v.map((x) => (x !== null && typeof x === "object" ? node(x as Record<string, unknown>, keyIndent + 7, esc) : value(x, keyIndent, esc)));
    return `[\n${items.map((s, i) => `${pad}${s}${i < items.length - 1 ? ", " : ""}`).join("\n")}]`;
  }
  return `\n${" ".repeat(keyIndent + 3)}${node(v as Record<string, unknown>, keyIndent + 3, esc)}`;
}

/** Un objeto con su `{` ya colocada por el llamador, claves a `indent + 1` y `}` a `indent`. */
function node(o: Record<string, unknown>, indent: number, esc: Esc): string {
  const keys = sortedKeys(o);
  if (keys.length === 0) return "{}";
  const pad = " ".repeat(indent + 1);
  return `{\n${keys.map((k) => `${pad}${esc(k)}:${value(o[k], indent + 1, esc)}`).join(",\n")}\n${" ".repeat(indent)}}`;
}

/** Texto de un documento de Tiled (mapa, tileset o proyecto) con su estilo. `asciiOnly`: los caracteres no ASCII como `\uXXXX`. */
export function tiledJson(doc: Record<string, unknown>, options: { asciiOnly?: boolean } = {}): string {
  const esc = options.asciiOnly ? escAscii : escUtf8;
  const keys = sortedKeys(doc);
  const body = keys.map((k, i) => `${i === 0 ? "" : " "}${esc(k)}:${value(doc[k], 1, esc)}`).join(",\n");
  return `{ ${body}\n}`;
}
