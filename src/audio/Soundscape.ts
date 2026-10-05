import type { MapSound, Point } from "../config/types";
import { spatialReading, type SpatialReading } from "./spatialGain";
import type { EmitterDiagnostic, VoiceRef, VoiceRequest } from "./sfxTypes";

/**
 * Los emisores de una zona (SPEC 6.5): un pequeño autómata por sonido del mapa que decide cuándo debe sonar según dónde está el oyente
 * y cómo está configurado (bucle, intervalo o entrada). No toca el audio: le pide las voces al anfitrión (`SfxService`), que aplica los
 * límites, la mezcla y el silencio. Toda su lógica va por el reloj que le dan (`update(deltaMs)`), así que se prueba sin tiempo real.
 */

/** Por debajo de esta ganancia un sonido se considera fuera de alcance (evita voces inaudibles). */
const AUDIBLE = 0.001;
/** Margen (px) que se añade al salir de la zona de un sonido de entrada antes de dar por terminada la visita: evita disparos por vibrar en el borde. */
export const ENTER_HYSTERESIS_PX = 16;
/** Espera tras un fallo al pedir la voz (límite de voces, audio no listo) para no insistir en cada fotograma. */
const RETRY_MS = 500;

export interface SoundscapeHost {
  now(): number;
  random(): number;
  /** ¿Puede sonar el ambiente ahora? (con gesto del visitante, sin silencio, pestaña visible y sin lectura abierta) */
  audible(): boolean;
  /** ¿El visitante ya dio su gesto? Antes de eso un sonido de entrada espera. */
  unlocked(): boolean;
  isLoaded(assetId: string): boolean;
  /** Empieza a cargar un recurso (no espera). */
  ensure(assetId: string): void;
  start(request: VoiceRequest): VoiceRef | null;
  /** Factor del modo «solo» y del silencio por fuente del laboratorio (1 normal, 0 apagado). */
  mixFor(soundId: string): number;
}

interface Emitter {
  id: string;
  /** Lo que está en la configuración (maps.json). */
  registered: MapSound;
  /** Lo que se aplica ahora: el borrador del laboratorio si lo hay. */
  live: MapSound;
  fade: number;
  voice: VoiceRef | null;
  /** Ms que faltan para el próximo disparo (modo intervalo); solo avanza dentro del alcance. */
  wait: number | null;
  inside: boolean;
  lastFire: number;
  retryAt: number;
  reading: SpatialReading;
  muted: boolean;
  /** Pendiente la entrada inicial (el visitante ya estaba dentro al activarse la zona). */
  armed: boolean;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export class Soundscape {
  private emitters = new Map<string, Emitter>();
  private zoneId: string | null = null;
  private listener: Point | null = null;
  private virtual = false;

  constructor(private readonly host: SoundscapeHost) {}

  get zone(): string | null {
    return this.zoneId;
  }

  /** Activa una zona: sustituye los emisores anteriores (sus voces se detienen en el acto). */
  setZone(zoneId: string, sounds: Record<string, MapSound> | undefined): void {
    this.clear();
    this.zoneId = zoneId;
    for (const [id, sound] of Object.entries(sounds ?? {})) {
      this.emitters.set(id, {
        id, registered: sound, live: sound, fade: 0, voice: null, wait: null, inside: false, lastFire: Number.NEGATIVE_INFINITY, retryAt: 0,
        reading: { distance: Infinity, gain: 0 }, muted: false, armed: sound.playback.mode === "enter",
      });
      if (sound.enabled) this.host.ensure(sound.assetId);
    }
  }

  /** Detiene y suelta todo (cambio de zona, cierre del juego o del panel). */
  clear(): void {
    for (const e of this.emitters.values()) e.voice?.stop();
    this.emitters.clear();
    this.zoneId = null;
  }

  has(): boolean {
    return this.emitters.size > 0;
  }

  /** El borrador del laboratorio para un emisor (o `null` para volver al guardado). Se aplica en vivo, sin recargar nada. */
  setDraft(soundId: string, sound: MapSound | null): void {
    const e = this.emitters.get(soundId);
    if (!e) return;
    const next = sound ?? e.registered;
    if (next.assetId !== e.live.assetId) {
      e.voice?.stop(); // otro archivo: la voz anterior se suelta y la nueva empieza al siguiente tic
      e.voice = null;
      this.host.ensure(next.assetId);
    }
    if (next.playback.mode !== e.live.playback.mode) {
      e.wait = null;
      e.armed = false;
    }
    e.live = next;
  }

  setMuted(soundId: string, muted: boolean): void {
    const e = this.emitters.get(soundId);
    if (e) e.muted = muted;
  }

  setListener(point: Point, virtual = false): void {
    this.listener = point;
    this.virtual = virtual;
  }

  /** Dispara ahora un emisor con sus ajustes reales (la prueba «en el mapa» del laboratorio): ignora la espera y el enfriamiento. */
  fire(soundId: string): boolean {
    const e = this.emitters.get(soundId);
    if (!e || !this.listener) return false;
    this.host.ensure(e.live.assetId);
    if (!this.host.isLoaded(e.live.assetId)) return false;
    e.reading = spatialReading(e.live, this.listener);
    if (e.live.playback.mode === "loop") {
      if (!e.voice?.alive) e.voice = this.begin(e, true);
    } else if (!e.voice?.alive) {
      e.voice = this.begin(e, false);
    }
    return !!e.voice;
  }

  update(deltaMs: number): void {
    const listener = this.listener;
    const now = this.host.now();
    const canSound = this.host.audible();
    for (const e of this.emitters.values()) {
      const s = e.live;
      const reading = listener ? spatialReading(s, listener) : { distance: Infinity, gain: 0 };
      e.reading = reading;
      const solo = this.host.mixFor(e.id);
      const inRange = reading.gain > AUDIBLE;
      const active = s.enabled && !e.muted && solo > 0 && canSound;
      const wanted = active && inRange;

      if (s.playback.mode === "enter") this.updateEnter(e, now, active, canSound);
      else if (s.playback.mode === "interval") this.updateInterval(e, deltaMs, now, wanted);
      else this.updateLoop(e, now, wanted);

      if (e.voice && !e.voice.alive) e.voice = null; // terminó sola
      this.fade(e, deltaMs, e.voice !== null && wanted);
      if (e.voice) {
        e.voice.update({ base: s.volume * solo, spatial: reading.gain, fade: e.fade });
        e.voice.setRate(s.rate);
        if (e.fade <= 0 && !wanted) {
          e.voice.stop();
          e.voice = null;
        }
      }
    }
  }

  // ---- modos ----------------------------------------------------------------------------------------------------

  /** Bucle: una sola voz mientras sea audible; al salir, fundido y parada. */
  private updateLoop(e: Emitter, now: number, wanted: boolean): void {
    if (!wanted || e.voice?.alive || now < e.retryAt) return;
    if (!this.host.isLoaded(e.live.assetId)) {
      this.host.ensure(e.live.assetId);
      return;
    }
    e.voice = this.begin(e, true);
    if (!e.voice) e.retryAt = now + RETRY_MS;
  }

  /** Intervalo: un disparo, y una espera aleatoria entre `minMs` y `maxMs` después de que termina; el reloj solo avanza en alcance. */
  private updateInterval(e: Emitter, delta: number, now: number, wanted: boolean): void {
    const p = e.live.playback;
    if (p.mode !== "interval" || e.voice?.alive || !wanted) return;
    if (e.wait === null) e.wait = p.minMs + this.host.random() * (p.maxMs - p.minMs);
    e.wait -= delta;
    if (e.wait > 0 || now < e.retryAt) return;
    if (!this.host.isLoaded(e.live.assetId)) {
      this.host.ensure(e.live.assetId);
      return;
    }
    e.voice = this.begin(e, false);
    if (e.voice) {
      e.wait = null; // la próxima espera se sortea cuando este disparo termina
    } else e.retryAt = now + RETRY_MS;
  }

  /** Entrada: un disparo al pasar de fuera a dentro (con enfriamiento e histéresis); sin acumular lo que no pudo sonar. */
  private updateEnter(e: Emitter, now: number, active: boolean, canSound: boolean): void {
    const p = e.live.playback;
    if (p.mode !== "enter") return;
    const limit = e.live.shape === "point" ? e.live.radius : 0;
    const d = e.reading.distance;
    // Dentro: dentro del radio exterior del punto o del rectángulo; se sale con una pequeña histéresis.
    const nowInside = e.inside ? d <= limit + ENTER_HYSTERESIS_PX : d <= limit;
    const entered = nowInside && !e.inside;
    e.inside = nowInside;
    let fire = entered;
    if (e.armed) {
      if (!this.host.unlocked()) return; // espera al gesto del visitante: la entrada inicial se evalúa al desbloquear
      e.armed = false;
      fire = nowInside && canSound; // si en ese momento no se pudo (silencio, lectura…) se pierde: no se acumula nada para después
    }
    if (!fire || !active || now - e.lastFire < p.cooldownMs || e.voice?.alive) return;
    if (!this.host.isLoaded(e.live.assetId)) {
      this.host.ensure(e.live.assetId);
      return;
    }
    e.voice = this.begin(e, false);
    if (e.voice) e.lastFire = now;
  }

  /** Sube o baja el fundido del emisor según lo que pida el estado (con 0 ms, el cambio es inmediato). */
  private fade(e: Emitter, delta: number, up: boolean): void {
    const ms = up ? e.live.fadeInMs : e.live.fadeOutMs;
    const step = ms > 0 ? delta / ms : 1;
    e.fade = clamp01(e.fade + (up ? step : -step));
  }

  private begin(e: Emitter, loop: boolean): VoiceRef | null {
    const s = e.live;
    const ref = this.host.start({
      key: s.assetId,
      kind: "ambient",
      label: s.label,
      volume: s.volume,
      rate: s.rate,
      loop,
      spatial: e.reading.gain,
      fade: s.fadeInMs > 0 ? 0 : 1,
      owner: e.id,
    });
    if (ref) e.fade = s.fadeInMs > 0 ? 0 : 1;
    return ref;
  }

  // ---- diagnóstico ----------------------------------------------------------------------------------------------

  diagnostics(): EmitterDiagnostic[] {
    return [...this.emitters.values()].map((e) => {
      const playing = e.voice?.alive === true;
      const inRange = e.reading.gain > AUDIBLE;
      const state: EmitterDiagnostic["state"] = !e.live.enabled || e.muted ? "apagado" : playing ? "sonando" : !this.host.isLoaded(e.live.assetId) ? "cargando" : !inRange && e.live.playback.mode !== "enter" ? "fuera de alcance" : e.live.playback.mode === "interval" && e.wait !== null ? "esperando" : "silencioso";
      return { id: e.id, label: e.live.label, distance: e.reading.distance, gain: e.reading.gain, fade: e.fade, effective: playing ? e.live.volume * e.reading.gain * e.fade : 0, state, waitMs: e.wait, playing, muted: e.muted };
    });
  }

  /** Lo que se aplica a un emisor (con el borrador del laboratorio si lo hay). */
  liveSound(soundId: string): MapSound | undefined {
    return this.emitters.get(soundId)?.live;
  }

  ids(): string[] {
    return [...this.emitters.keys()];
  }

  get virtualListener(): boolean {
    return this.virtual;
  }

  get listenerPoint(): Point | null {
    return this.listener;
  }
}
