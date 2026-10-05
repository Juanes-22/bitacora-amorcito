/**
 * Contrato compartido de los sonidos (SPEC 6.5): lo usan el importador de Tiled, la validación, el motor de SFX y el laboratorio, para que
 * los límites y los valores por defecto estén en un solo sitio.
 */

/** Los efectos de interfaz y de recompensa que se pueden asociar a un sonido en `audio.sfx.events` (no salen de Tiled). */
export const SFX_EVENT_IDS = ["ui.open", "ui.confirm", "badge.earned", "portal.travel"] as const;
export type SfxEventId = (typeof SFX_EVENT_IDS)[number];

/** Límites de los parámetros de un sonido o de un preset. */
export const SOUND_LIMITS = {
  volume: { min: 0, max: 1 },
  /** Velocidad de reproducción: 1 es la original. */
  rate: { min: 0.5, max: 2 },
  maxVoices: { min: 1, max: 64 },
} as const;

/** Valores iniciales de un emisor nuevo (los mismos que los valores por defecto de las clases del proyecto de Tiled). */
export const SOUND_DEFAULTS = {
  volume: 0.3,
  rate: 1,
  fadeInMs: 250,
  fadeOutMs: 400,
  innerRadius: 50,
  radius: 260,
  edgeFadePx: 80,
  intervalMinMs: 12000,
  intervalMaxMs: 28000,
  cooldownMs: 1500,
} as const;

export const SOUND_PLAYBACK_MODES = ["loop", "interval", "enter"] as const;
export const SOUND_SHAPES = ["point", "rect"] as const;
export const SOUND_CLASSES = { point: "SoundEmitter", rect: "SoundArea" } as const;
