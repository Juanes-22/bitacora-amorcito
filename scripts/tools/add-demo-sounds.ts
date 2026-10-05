// Demostración reproducible de los efectos de sonido (SPEC 6.5): con los sonidos de prueba de generate-test-sfx.ts crea cinco emisores
// en los mapas (un río y unos pájaros en la zona A; una cascada, un viento y una campana de entrada en la zona B) y asocia un sonido a
// la apertura, la confirmación, la recompensa y el viaje. Usa el MISMO guardado del laboratorio de sonidos, así que es también una
// prueba de que funciona. Idempotente: volver a ejecutarlo no cambia nada. Uso:  npx tsx scripts/tools/add-demo-sounds.ts
import type { MapSound } from "../../src/config/types";
import type { SaveChange } from "../../src/dev/audio-lab/protocol";
import { saveAudioLab } from "../lib/audio-lab/save";
import { readVersions } from "../lib/audio-lab/versions";
import { defaultPaths } from "../lib/tiled/files";

const base = { enabled: true, rate: 1, fadeInMs: 250, fadeOutMs: 400 };
const point = (label: string, assetId: string, x: number, y: number, volume: number, extra: Partial<MapSound> = {}): MapSound =>
  ({ ...base, label, assetId, volume, playback: { mode: "loop" }, shape: "point", position: { x, y }, innerRadius: 60, radius: 320, ...extra }) as MapSound;

const changes: SaveChange[] = [
  { type: "general", sfx: { active: true, volume: 0.8, maxVoices: 12 } },
  { type: "preset", event: "ui.open", preset: { assetId: "audio.sfx.test-ui-open", volume: 0.5, rate: 1 } },
  { type: "preset", event: "ui.confirm", preset: { assetId: "audio.sfx.test-ui-confirm", volume: 0.5, rate: 1 } },
  { type: "preset", event: "badge.earned", preset: { assetId: "audio.sfx.test-badge", volume: 0.7, rate: 1 } },
  { type: "preset", event: "portal.travel", preset: { assetId: "audio.sfx.test-portal", volume: 0.5, rate: 1 } },
  { type: "sound", zoneId: "zona-a", soundId: "rio-pradera", sound: point("Río de la pradera (sonido de prueba)", "audio.sfx.test-river", 1110, 780, 0.25) },
  {
    type: "sound",
    zoneId: "zona-a",
    soundId: "pajaros-cerezo",
    sound: point("Pájaros del cerezo (sonido de prueba)", "audio.sfx.test-birds", 810, 260, 0.3, { innerRadius: 40, radius: 300, playback: { mode: "interval", minMs: 14000, maxMs: 30000 } }),
  },
  { type: "sound", zoneId: "zona-b", soundId: "cascada-pabellon", sound: point("Cascada junto al puente (sonido de prueba)", "audio.sfx.test-river", 260, 850, 0.25, { rate: 1.15 }) },
  {
    type: "sound",
    zoneId: "zona-b",
    soundId: "viento-lomas",
    sound: { ...base, label: "Viento sobre las lomas (sonido de prueba)", assetId: "audio.sfx.test-wind", volume: 0.12, playback: { mode: "loop" }, shape: "rect", area: { x: 0, y: 0, width: 1448, height: 300 }, edgeFadePx: 150 },
  },
  {
    type: "sound",
    zoneId: "zona-b",
    soundId: "campana-entrada",
    sound: { ...base, label: "Campanilla de la entrada (sonido de prueba)", assetId: "audio.sfx.test-ui-confirm", volume: 0.3, playback: { mode: "enter", cooldownMs: 20000 }, shape: "rect", area: { x: 640, y: 400, width: 560, height: 150 }, edgeFadePx: 40 },
  },
];

const paths = defaultPaths();
const result = await saveAudioLab(paths, { version: 1, base: readVersions(paths), assets: [], changes });
if (!result.ok) {
  console.error(`✖ ${result.reason}:\n${result.errors.map((e) => `  ${e}`).join("\n")}`);
  process.exit(1);
}
for (const line of result.saved) console.log(`• ${line}`);
for (const w of result.warnings) console.warn(`⚠ ${w}`);
