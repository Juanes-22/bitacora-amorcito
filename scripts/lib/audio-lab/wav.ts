// Lectura y escritura mínimas de WAV PCM (16 bits, mono o estéreo): lo que necesitan los sonidos de prueba y el registro de archivos.

export interface WavInfo {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  frames: number;
  durationSeconds: number;
}

/** Codifica muestras en coma flotante (−1..1) como un WAV PCM de 16 bits mono. */
export function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Lee la cabecera de un WAV PCM; `null` si no lo es o está incompleto. */
export function readWavInfo(file: Uint8Array): WavInfo | null {
  const b = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  if (b.length < 44 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") return null;
  let offset = 12;
  let fmt: { channels: number; sampleRate: number; bitsPerSample: number; format: number } | null = null;
  while (offset + 8 <= b.length) {
    const id = b.toString("ascii", offset, offset + 4);
    const size = b.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt " && body + 16 <= b.length) {
      fmt = { format: b.readUInt16LE(body), channels: b.readUInt16LE(body + 2), sampleRate: b.readUInt32LE(body + 4), bitsPerSample: b.readUInt16LE(body + 14) };
    } else if (id === "data") {
      if (!fmt || fmt.format !== 1 || fmt.channels < 1 || fmt.sampleRate <= 0 || fmt.bitsPerSample <= 0) return null;
      const bytes = Math.min(size, b.length - body);
      const frames = Math.floor(bytes / (fmt.channels * (fmt.bitsPerSample / 8)));
      return { channels: fmt.channels, sampleRate: fmt.sampleRate, bitsPerSample: fmt.bitsPerSample, frames, durationSeconds: frames / fmt.sampleRate };
    }
    offset = body + size + (size % 2);
  }
  return null;
}
