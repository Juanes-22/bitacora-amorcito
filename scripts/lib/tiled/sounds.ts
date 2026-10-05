import { SOUND_CLASSES } from "../../../src/config/sounds";
import type { MapSound } from "../../../src/config/types";
import type { TiledObject, TiledProperty } from "./types";
import { floatProp, prop, tidy } from "./util";

// La representación de un sonido del mapa como objeto de Tiled (clase, geometría y propiedades): la usan la exportación, el parcheo de
// un mapa existente (laboratorio de sonidos) y las pruebas, para que ida y vuelta coincidan siempre.

/** Propiedades que gestiona la integración en un objeto de sonido; cualquier otra que el usuario añada a mano se conserva. */
export const SOUND_PROPERTY_NAMES = [
  "soundId", "label", "assetId", "enabled", "volume", "rate", "playback", "fadeInMs", "fadeOutMs", "intervalMinMs", "intervalMaxMs", "cooldownMs",
  "innerRadius", "radius", "edgeFadePx",
] as const;

/** Las propiedades de un sonido en el orden de Tiled; solo las del modo y la forma elegidos (las demás son valores por defecto de la clase). */
export function soundProperties(soundId: string, s: MapSound): TiledProperty[] {
  const props: TiledProperty[] = [
    prop("soundId", soundId),
    prop("label", s.label),
    prop("assetId", s.assetId, "SoundAsset"),
    prop("enabled", s.enabled),
    floatProp("volume", s.volume),
    floatProp("rate", s.rate),
    prop("playback", s.playback.mode, "SoundPlayback"),
    prop("fadeInMs", s.fadeInMs),
    prop("fadeOutMs", s.fadeOutMs),
  ];
  if (s.playback.mode === "interval") props.push(prop("intervalMinMs", s.playback.minMs), prop("intervalMaxMs", s.playback.maxMs));
  else if (s.playback.mode === "enter") props.push(prop("cooldownMs", s.playback.cooldownMs));
  if (s.shape === "point") props.push(floatProp("innerRadius", s.innerRadius), floatProp("radius", s.radius));
  else props.push(floatProp("edgeFadePx", s.edgeFadePx));
  return props;
}

/** Clase y geometría de Tiled de un sonido: un punto para el emisor y un rectángulo para el área (coordenadas del mundo, sin desplazamientos de capa). */
export function soundShape(s: MapSound): Pick<TiledObject, "class" | "x" | "y" | "width" | "height" | "point"> {
  if (s.shape === "point") return { class: SOUND_CLASSES.point, x: tidy(s.position.x), y: tidy(s.position.y), width: 0, height: 0, point: true };
  return { class: SOUND_CLASSES.rect, x: tidy(s.area.x), y: tidy(s.area.y), width: tidy(s.area.width), height: tidy(s.area.height) };
}
