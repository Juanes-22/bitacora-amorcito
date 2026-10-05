/**
 * Contratos del motor de efectos de sonido (SPEC 6.5). El servicio (`SfxService`) y los emisores (`Soundscape`) no conocen Phaser ni el
 * navegador: hablan con un `SfxBackend`, así que se prueban sin una tarjeta de audio.
 */

/** Una voz que suena en el backend. */
export interface BackendVoice {
  /** 0..1, ya con todos los factores aplicados. */
  setVolume(volume: number): void;
  setRate(rate: number): void;
  stop(): void;
  /** Se avisa una sola vez cuando la voz termina por sí sola (no cuando se detiene con `stop`). */
  onEnd(callback: () => void): void;
}

export interface LoadedSound {
  key: string;
  durationSeconds: number;
  /** Memoria que ocupa decodificado. */
  bytes: number;
}

export type BackendStatus = "locked" | "ready" | "unavailable";

export interface SfxBackend {
  readonly kind: "webaudio" | "html5" | "none";
  /** `locked`: el navegador exige un gesto del visitante; `unavailable`: no hay audio. */
  status(): BackendStatus;
  /** Intenta desbloquear el audio (se llama desde un gesto del visitante). */
  unlock(): Promise<void>;
  load(key: string, url: string): Promise<LoadedSound>;
  /** Decodifica datos que ya están en memoria (un archivo elegido en el laboratorio). */
  loadData(key: string, data: ArrayBuffer): Promise<LoadedSound>;
  has(key: string): boolean;
  unload(key: string): void;
  play(key: string, options: { volume: number; rate: number; loop: boolean }): BackendVoice | null;
  /** Avisa cuando cambia `status()`. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

/** Para qué suena una voz: define su prioridad cuando se llega al límite. */
export type VoiceKind = "ambient" | "event" | "test";

/** Los factores que forman el volumen efectivo de una voz (se muestran en el diagnóstico del laboratorio). */
export interface VoiceFactors {
  /** Volumen del emisor o del preset. */
  base: number;
  /** Ganancia por distancia (1 en un efecto de interfaz o en una prueba neutral). */
  spatial: number;
  /** Fundido de entrada y de salida. */
  fade: number;
}

export interface VoiceRequest {
  key: string;
  kind: VoiceKind;
  label: string;
  volume: number;
  rate: number;
  loop: boolean;
  spatial?: number;
  fade?: number;
  /** Para el modo «solo» del laboratorio: a quién pertenece (el soundId del emisor o el id de la prueba). */
  owner?: string;
}

/** La voz tal como la ve quien la pidió: puede cambiarla en vivo y saber si sigue sonando. */
export interface VoiceRef {
  readonly id: number;
  readonly alive: boolean;
  update(factors: Partial<VoiceFactors>): void;
  setRate(rate: number): void;
  stop(): void;
  onEnd(callback: () => void): void;
}

export type SfxStatus = "idle" | "locked" | "ready" | "unavailable";

export interface SfxState {
  /** `idle`: sin backend o aún sin gesto del visitante. */
  status: SfxStatus;
  /** Hay efectos configurados y activados (`audio.sfx.active`). */
  enabled: boolean;
  muted: boolean;
  /** El visitante ya dio su gesto («Comenzar»): antes no suena nada. */
  unlocked: boolean;
  hidden: boolean;
  suspended: readonly string[];
  voices: number;
  maxVoices: number;
  loading: number;
  failed: readonly string[];
  /** Errores de carga y reproducción en palabras, para el diagnóstico. */
  errors: readonly string[];
}

export interface VoiceDiagnostic {
  id: number;
  kind: VoiceKind;
  label: string;
  key: string;
  factors: VoiceFactors;
  /** Volumen que se envía al backend. */
  effective: number;
  rate: number;
  loop: boolean;
}

export interface EmitterDiagnostic {
  id: string;
  label: string;
  distance: number;
  gain: number;
  fade: number;
  /** Volumen efectivo de su voz (0 si no suena). */
  effective: number;
  state: "silencioso" | "sonando" | "esperando" | "apagado" | "fuera de alcance" | "cargando";
  /** Milisegundos hasta el próximo disparo (modo intervalo). */
  waitMs: number | null;
  playing: boolean;
  muted: boolean;
}

export interface SfxDiagnostics {
  state: SfxState;
  listener: { x: number; y: number } | null;
  listenerVirtual: boolean;
  emitters: EmitterDiagnostic[];
  voices: VoiceDiagnostic[];
  master: number;
  decodedBytes: number;
}
