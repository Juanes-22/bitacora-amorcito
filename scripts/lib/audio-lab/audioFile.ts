import { AUDIO_FORMATS, AUDIO_LAB_LIMITS, type AudioFormat } from "../../../src/dev/audio-lab/protocol";
import { readWavInfo } from "./wav";

export class AudioFileError extends Error {}

export interface AudioFileInfo {
  format: AudioFormat;
  durationSeconds: number;
}

const extensionOf = (name: string): string => (name.includes(".") ? (name.split(".").pop() as string).toLowerCase() : "");

/** ¿Los primeros bytes son los de ese contenedor? La extensión sola no demuestra nada (SPEC 6.5). */
function sniff(format: AudioFormat, b: Buffer): boolean {
  switch (format) {
    case "wav":
      return b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE";
    case "ogg":
      return b.length > 4 && b.toString("ascii", 0, 4) === "OggS";
    case "mp3":
      return b.length > 3 && (b.toString("ascii", 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));
    case "m4a":
      return b.length > 12 && b.toString("ascii", 4, 8) === "ftyp";
  }
}

/** Comprueba un archivo de audio recibido: extensión admitida, tamaño, contenido y duración. Lanza `AudioFileError` con un mensaje claro. */
export function inspectAudioFile(name: string, bytes: Uint8Array, claimedSeconds: number): AudioFileInfo {
  const ext = extensionOf(name);
  if (!(AUDIO_FORMATS as readonly string[]).includes(ext)) throw new AudioFileError(`«${name}»: el formato «${ext || "sin extensión"}» no se admite; usa ${AUDIO_FORMATS.join(", ")}`);
  const format = ext as AudioFormat;
  if (bytes.length === 0) throw new AudioFileError(`«${name}»: el archivo está vacío`);
  if (bytes.length > AUDIO_LAB_LIMITS.maxFileBytes) throw new AudioFileError(`«${name}»: pesa ${(bytes.length / 1048576).toFixed(1)} MB y el máximo es ${AUDIO_LAB_LIMITS.maxFileBytes / 1048576} MB`);
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!sniff(format, buffer)) throw new AudioFileError(`«${name}»: el contenido no es un archivo ${format.toUpperCase()} válido`);
  let seconds = claimedSeconds;
  if (format === "wav") {
    const info = readWavInfo(bytes);
    if (!info) throw new AudioFileError(`«${name}»: el WAV está incompleto o no es PCM`);
    seconds = info.durationSeconds; // el servidor mide los WAV; en los demás formatos se confía en lo que midió el navegador al decodificarlo
  }
  if (!Number.isFinite(seconds) || seconds <= 0) throw new AudioFileError(`«${name}»: no se pudo medir su duración`);
  if (seconds > AUDIO_LAB_LIMITS.maxSeconds) throw new AudioFileError(`«${name}»: dura ${seconds.toFixed(1)} s y el máximo para un efecto es ${AUDIO_LAB_LIMITS.maxSeconds} s`);
  return { format, durationSeconds: Math.round(seconds * 1000) / 1000 };
}

/** Un nombre de archivo y de ID seguro: minúsculas, números y guiones. */
export function slugify(name: string): string {
  const base = name.replace(/\.[^.]*$/, "");
  const slug = base.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || "sonido";
}
