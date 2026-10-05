import type { AssetEntry } from "../../../src/config/types";
import { valueRangeAt } from "../tiled/jsonStyle";

// Escritura de assets.json por texto: se añaden entradas al final de `assets` y se actualizan los contadores y las notas, y todo lo
// demás queda byte a byte igual (reescribir el archivo entero cambiaría números como `6.0`, que son lo mismo pero distinto texto).

const indent = (text: string, spaces: number): string => text.replace(/\n/g, `\n${" ".repeat(spaces)}`);

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** Texto de assets.json con las entradas añadidas al final de `assets` y `assetCount`, `categoryCounts` y, si se da, una nota al día. */
export function addAssetEntries(text: string, entries: Array<[string, AssetEntry]>, note?: string): string {
  if (entries.length === 0) return text;
  const data = JSON.parse(text) as { assets: Record<string, AssetEntry>; notes?: string[] };
  const counts: Record<string, number> = {};
  for (const a of [...Object.values(data.assets), ...entries.map(([, e]) => e)]) counts[a.category] = (counts[a.category] ?? 0) + 1;
  const range = (path: string[]) => {
    const r = valueRangeAt(text, path);
    if (!r) throw new Error(`assets.json no tiene «${path.join(".")}»`);
    return r;
  };
  const edits: Edit[] = [];
  edits.push({ ...range(["assetCount"]), text: String(Object.keys(data.assets).length + entries.length) });
  edits.push({ ...range(["categoryCounts"]), text: indent(JSON.stringify(Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))), null, 2), 2) });
  if (note !== undefined && data.notes) edits.push({ ...range(["notes"]), text: indent(JSON.stringify([...data.notes.filter((n) => n !== note), note], null, 2), 2) });
  const assets = range(["assets"]);
  const lastEntryEnd = text.lastIndexOf("}", assets.end - 2) + 1;
  edits.push({ start: lastEntryEnd, end: lastEntryEnd, text: `,\n${entries.map(([id, e]) => `    ${JSON.stringify(id)}: ${indent(JSON.stringify(e, null, 2), 4)}`).join(",\n")}` });
  let out = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}
