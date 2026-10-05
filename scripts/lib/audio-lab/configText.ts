import type { SfxConfig } from "../../../src/config/types";
import { formatValue, valueRangeAt } from "../tiled/jsonStyle";

// Edición de la región `audio.sfx` de bitacora.json por texto: solo cambia esa región (o la añade tras `music`); `audio.music`, el
// contenido y el resto del archivo quedan byte a byte igual.

/** El texto de bitacora.json con `audio.sfx` sustituido o añadido. */
export function setAudioSfx(text: string, sfx: SfxConfig): string {
  const formatted = formatValue(sfx, 4, "sfx");
  const current = valueRangeAt(text, ["audio", "sfx"]);
  if (current) return text.slice(0, current.start) + formatted + text.slice(current.end);
  const audio = valueRangeAt(text, ["audio"]);
  if (!audio) throw new Error("bitacora.json no tiene «audio»");
  const close = text.lastIndexOf("}", audio.end - 1);
  const lastValueEnd = text.slice(0, close).replace(/\s+$/, "").length;
  return `${text.slice(0, lastValueEnd)},\n    "sfx": ${formatted}${text.slice(lastValueEnd)}`;
}

/** `audio.sfx` tal como está en el texto, o `undefined` si no lo tiene. */
export function readAudioSfx(text: string): SfxConfig | undefined {
  const r = valueRangeAt(text, ["audio", "sfx"]);
  return r ? (JSON.parse(text.slice(r.start, r.end)) as SfxConfig) : undefined;
}
