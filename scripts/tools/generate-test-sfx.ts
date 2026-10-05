// Genera los sonidos de PRUEBA del laboratorio de sonidos (SPEC 6.5) y los registra en public/assets/assets.json. No son sonidos
// definitivos: son tonos y ruido sintetizados con una semilla fija, para demostrar el flujo completo sin depender de ninguna descarga
// externa ni de la autoría de nadie. Se pueden reemplazar por archivos reales desde el laboratorio («Añadir al catálogo»).
// Es reproducible (mismos bytes siempre) e idempotente. Uso:  npx tsx scripts/tools/generate-test-sfx.ts
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AssetEntry, AssetManifest } from "../../src/config/types";
import { addAssetEntries } from "../lib/audio-lab/manifestText";
import { encodeWav, readWavInfo } from "../lib/audio-lab/wav";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..", "..", "public", "assets");
const RATE = 22050;

/** Generador pseudoaleatorio con semilla (mulberry32): el mismo archivo en cada ejecución. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const samplesFor = (seconds: number) => Math.round(seconds * RATE);
const env = (i: number, n: number, attack: number, release: number): number => Math.min(1, i / Math.max(1, attack * RATE)) * Math.min(1, (n - i) / Math.max(1, release * RATE));

/** Ruido filtrado en bucle: el final se mezcla con el principio para que no se oiga el corte al repetirse. */
function loopNoise(seconds: number, seed: number, low: number, high: number, wobbleHz: number, depth: number): Float32Array {
  const n = samplesFor(seconds);
  const fade = samplesFor(0.4);
  const r = rng(seed);
  const total = n + fade;
  const raw = new Float32Array(total);
  let lp1 = 0;
  let lp2 = 0;
  const a1 = 1 - Math.exp(-2 * Math.PI * high / RATE);
  const a2 = 1 - Math.exp(-2 * Math.PI * low / RATE);
  for (let i = 0; i < total; i++) {
    const x = r() * 2 - 1;
    lp1 += a1 * (x - lp1);
    lp2 += a2 * (x - lp2);
    raw[i] = lp1 - lp2;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const w = i < fade ? i / fade : 1;
    const mixed = i < fade ? raw[i] * w + raw[n + i] * (1 - w) : raw[i];
    const wobble = 1 - depth + depth * (0.5 + 0.5 * Math.sin((2 * Math.PI * wobbleHz * i) / RATE));
    out[i] = mixed * wobble * 6;
  }
  return out;
}

function tone(freqAt: (t: number) => number, seconds: number, attack: number, release: number, harmonics: Array<[number, number]> = [[1, 1]]): Float32Array {
  const n = samplesFor(seconds);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += (2 * Math.PI * freqAt(t)) / RATE;
    let v = 0;
    for (const [mult, amp] of harmonics) v += amp * Math.sin(phase * mult);
    out[i] = v * env(i, n, attack, release);
  }
  return out;
}

const mix = (parts: Array<{ at: number; data: Float32Array; gain?: number }>, seconds: number): Float32Array => {
  const out = new Float32Array(samplesFor(seconds));
  for (const p of parts) {
    const start = samplesFor(p.at);
    for (let i = 0; i < p.data.length && start + i < out.length; i++) out[start + i] += p.data[i] * (p.gain ?? 1);
  }
  return out;
};

const normalize = (a: Float32Array, peak = 0.7): Float32Array => {
  let max = 0;
  for (const v of a) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < a.length; i++) a[i] = (a[i] / max) * peak;
  return a;
};

const NOTES = { c5: 523.25, e5: 659.25, g5: 783.99, c6: 1046.5 };

interface TestSound {
  id: string;
  file: string;
  label: string;
  samples: () => Float32Array;
}

export const TEST_SOUNDS: TestSound[] = [
  { id: "audio.sfx.test-river", file: "test-river.wav", label: "Sonido de prueba: río (ruido filtrado, para repetir en bucle)", samples: () => normalize(loopNoise(4, 11, 180, 2200, 0.5, 0.35), 0.6) },
  { id: "audio.sfx.test-wind", file: "test-wind.wav", label: "Sonido de prueba: viento (ruido grave, para repetir en bucle)", samples: () => normalize(loopNoise(5, 23, 40, 700, 0.2, 0.6), 0.6) },
  {
    id: "audio.sfx.test-birds",
    file: "test-birds.wav",
    label: "Sonido de prueba: pájaros (tres trinos cortos)",
    samples: () =>
      normalize(
        mix(
          [0, 0.28, 0.62].map((at, i) => ({ at, data: tone((t) => 2600 + (i % 2 ? -1 : 1) * 1100 * (t / 0.16) + 120 * Math.sin(t * 90), 0.16, 0.01, 0.06), gain: 1 - i * 0.15 })),
          1.0,
        ),
        0.6,
      ),
  },
  { id: "audio.sfx.test-ui-open", file: "test-ui-open.wav", label: "Sonido de prueba: abrir (dos notas suaves)", samples: () => normalize(mix([{ at: 0, data: tone(() => NOTES.c5, 0.12, 0.005, 0.08, [[1, 1], [2, 0.25]]) }, { at: 0.08, data: tone(() => NOTES.g5, 0.16, 0.005, 0.12, [[1, 1], [2, 0.25]]) }], 0.3), 0.55) },
  { id: "audio.sfx.test-ui-confirm", file: "test-ui-confirm.wav", label: "Sonido de prueba: confirmar (una nota corta)", samples: () => normalize(tone(() => NOTES.e5, 0.14, 0.003, 0.1, [[1, 1], [3, 0.2]]), 0.55) },
  {
    id: "audio.sfx.test-badge",
    file: "test-badge.wav",
    label: "Sonido de prueba: recompensa (arpegio brillante)",
    samples: () => normalize(mix([NOTES.c5, NOTES.e5, NOTES.g5, NOTES.c6].map((f, i) => ({ at: i * 0.11, data: tone(() => f, 0.9 - i * 0.05, 0.004, 0.7, [[1, 1], [2, 0.35], [3, 0.12]]) })), 1.5), 0.65),
  },
  { id: "audio.sfx.test-portal", file: "test-portal.wav", label: "Sonido de prueba: viajar (barrido ascendente)", samples: () => normalize(tone((t) => 300 + 900 * (t / 0.5) ** 1.5, 0.55, 0.03, 0.2, [[1, 1], [2, 0.3]]), 0.5) },
];

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

function main(): void {
  const manifestPath = join(ROOT, "assets.json");
  const text = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(text) as AssetManifest;
  mkdirSync(join(ROOT, "audio", "sfx"), { recursive: true });
  const added: Array<[string, AssetEntry]> = [];
  for (const s of TEST_SOUNDS) {
    const wav = encodeWav(s.samples(), RATE);
    const info = readWavInfo(wav);
    if (!info) throw new Error(`${s.file}: WAV inválido`);
    writeFileSync(join(ROOT, "audio", "sfx", s.file), wav);
    const entry: AssetEntry = {
      path: `audio/sfx/${s.file}`,
      type: "audio",
      format: "wav",
      category: "audio",
      label: s.label,
      kind: "sfx",
      sizeBytes: wav.length,
      sha256: sha256(wav),
      originalPath: "scripts/tools/generate-test-sfx.ts",
      durationSeconds: Math.round(info.durationSeconds * 1000) / 1000,
    };
    const current = manifest.assets[s.id];
    if (current === undefined) added.push([s.id, entry]);
    else if (JSON.stringify(current) !== JSON.stringify(entry)) throw new Error(`${s.id} ya existe en assets.json con otros valores: bórralo antes de regenerar`);
  }
  if (added.length === 0) {
    console.log("assets.json ya tiene los sonidos de prueba al día.");
    return;
  }
  const note = "Añadidos los sonidos de prueba del laboratorio de sonidos (scripts/tools/generate-test-sfx.ts): tonos y ruido sintetizados, no son sonidos definitivos. Las entradas anteriores no se modificaron.";
  writeFileSync(manifestPath, addAssetEntries(text, added, note));
  console.log(`assets.json: ${added.length} entradas añadidas.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
