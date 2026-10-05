// Un WAV de prueba para las pruebas E2E del laboratorio de sonidos: PCM de 16 bits, mono, 22 050 Hz y 0,4 s con un tono que decae.
// Es distinto de los tonos del proyecto (otro contenido, otro sha256), así que entra al catálogo como un recurso nuevo.
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function wavBytes(ms = 400, hz = 660, rate = 22050) {
  const n = Math.round((rate * ms) / 1000);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / rate) * (1 - i / n)), 44 + i * 2);
  return b;
}

/** Escribe el WAV (y un «WAV» que no lo es) en una carpeta temporal y devuelve sus rutas. */
export function writeTestFiles() {
  const dir = join(tmpdir(), "bitacora-lab-e2e");
  mkdirSync(dir, { recursive: true });
  const wav = join(dir, "tono-nuevo.wav");
  const fake = join(dir, "roto.wav");
  writeFileSync(wav, wavBytes());
  writeFileSync(fake, "esto no es audio, solo texto que finge ser un archivo de sonido");
  return { dir, wav, fake };
}
