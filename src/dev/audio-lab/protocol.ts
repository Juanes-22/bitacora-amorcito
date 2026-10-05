import type { MapSound, OneShotPreset, SfxConfig } from "../../config/types";
import type { SfxEventId } from "../../config/sounds";

/**
 * Contrato entre el laboratorio de sonidos (en el navegador) y el servidor de desarrollo que guarda en el proyecto (SPEC 6.5). Es solo
 * de desarrollo: ni el panel ni estas rutas existen en la publicación. Los tipos los comparten el panel, el servidor y la importación
 * por línea de comandos.
 */

/** Prefijo de las rutas del servidor de desarrollo y cabecera que las protege (un sitio ajeno no puede enviarla sin permiso de origen). */
export const AUDIO_LAB_ROUTE = "/__audio-lab";
export const AUDIO_LAB_HEADER = "x-audio-lab";

/** Límites documentados (SPEC 6.5): el servidor los comprueba y el panel muestra qué límite se alcanzó. */
export const AUDIO_LAB_LIMITS = {
  /** Tamaño máximo de un archivo de sonido, en bytes. */
  maxFileBytes: 8 * 1024 * 1024,
  /** Duración máxima de un efecto, en segundos. */
  maxSeconds: 60,
  /** Memoria máxima de audio decodificado que conserva el laboratorio para sus pruebas, en bytes (PCM de 32 bits en coma flotante). */
  maxDecodedBytes: 64 * 1024 * 1024,
  /** Tamaño máximo de una solicitud al servidor. */
  maxRequestBytes: 24 * 1024 * 1024,
} as const;

export const AUDIO_FORMATS = ["wav", "mp3", "ogg", "m4a"] as const;
export type AudioFormat = (typeof AUDIO_FORMATS)[number];

/** Huellas de los archivos que vio el panel: si alguno de los que se van a escribir cambió, el guardado es un conflicto. */
export interface FileVersions {
  manifest: string;
  project: string;
  maps: string;
  config: string;
  /** Mapa de Tiled de cada zona, por `zoneId`. */
  zones: Record<string, string>;
}

/** Un archivo de audio que se incorpora al catálogo: nunca una ruta ni un `blob:`, sino sus datos. */
export interface NewAsset {
  /** Clave temporal con la que lo referencian los cambios de la misma solicitud. */
  key: string;
  /** Nombre original del archivo (sin carpeta): fija el formato y sugiere el ID. */
  name: string;
  label?: string;
  dataBase64: string;
  /** Duración que midió el navegador al decodificarlo (los WAV se miden también en el servidor). */
  durationSeconds: number;
}

export type SaveChange =
  /** Crea o actualiza un emisor del mapa. `assetKey` sustituye a `sound.assetId` por el recurso recién incorporado. */
  | { type: "sound"; zoneId: string; soundId: string; sound: MapSound; assetKey?: string }
  /** Cambia (o quita, con `null`) el efecto asociado a una acción del juego. */
  | { type: "preset"; event: SfxEventId; preset: OneShotPreset | null; assetKey?: string }
  /** Cambia el volumen general, el límite de voces o si los efectos están activos. */
  | { type: "general"; sfx: Partial<Pick<SfxConfig, "active" | "volume" | "maxVoices">> }
  /** Solo incorpora el archivo al catálogo (para poder asignarlo después). */
  | { type: "asset"; assetKey: string };

export interface SaveRequest {
  version: 1;
  base: FileVersions;
  assets: NewAsset[];
  changes: SaveChange[];
}

export type SaveResult =
  | { ok: true; versions: FileVersions; /** Qué se escribió, en frases. */ saved: string[]; /** ID registrado de cada archivo nuevo, por su clave. */ assets: Record<string, string>; warnings: string[] }
  | { ok: false; reason: "conflict" | "invalid" | "busy" | "error"; errors: string[]; /** Archivos que cambiaron en el disco (conflicto). */ changed?: string[] };

/** Paquete de ajustes exportado: JSON versionado y portable (con los archivos nuevos dentro) que reutiliza el mismo guardado. */
export interface AdjustmentsPackage {
  format: "bitacora-audio-lab";
  version: 1;
  exportedAt: string;
  base: FileVersions;
  assets: NewAsset[];
  changes: SaveChange[];
}

export const ADJUSTMENTS_FORMAT = "bitacora-audio-lab" as const;
