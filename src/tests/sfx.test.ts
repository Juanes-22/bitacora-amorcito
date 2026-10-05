import { describe, expect, it } from "vitest";
import { areaGain, distanceToRect, pointGain, spatialReading } from "../audio/spatialGain";
import { ENTER_HYSTERESIS_PX } from "../audio/Soundscape";
import { SFX_CACHE_LIMIT_BYTES } from "../audio/SfxService";
import { areaSound, DEFAULT_SFX, flush, harness, pointSound } from "./fixtures/fakeSfx";

describe("atenuación espacial (AC-88)", () => {
  it("un punto: completo hasta el radio interior, silencio desde el exterior y caída cuadrática entre ambos", () => {
    expect(pointGain(0, 50, 250)).toBe(1);
    expect(pointGain(50, 50, 250)).toBe(1);
    expect(pointGain(250, 50, 250)).toBe(0);
    expect(pointGain(400, 50, 250)).toBe(0);
    expect(pointGain(150, 50, 250)).toBeCloseTo(0.25, 10); // mitad del trayecto: (1 − 0.5)²
    expect(pointGain(51, 50, 250)).toBeLessThan(1);
    expect(pointGain(249, 50, 250)).toBeGreaterThan(0);
  });

  it("la caída es monótona decreciente entre los radios", () => {
    let last = 1;
    for (let d = 50; d <= 250; d += 10) {
      const g = pointGain(d, 50, 250);
      expect(g).toBeLessThanOrEqual(last);
      last = g;
    }
  });

  it("un área: completa dentro y en el borde; fuera cae hasta 0 a edgeFadePx; con 0, fuera es silencio", () => {
    expect(areaGain(0, 100)).toBe(1);
    expect(areaGain(-5, 100)).toBe(1);
    expect(areaGain(50, 100)).toBeCloseTo(0.25, 10);
    expect(areaGain(100, 100)).toBe(0);
    expect(areaGain(1, 0)).toBe(0);
    expect(areaGain(0, 0)).toBe(1);
  });

  it("la distancia a un rectángulo cuenta el borde y las esquinas con la distancia real", () => {
    const r = { x: 100, y: 100, width: 200, height: 100 };
    expect(distanceToRect({ x: 150, y: 150 }, r)).toBe(0);
    expect(distanceToRect({ x: 100, y: 100 }, r)).toBe(0);
    expect(distanceToRect({ x: 50, y: 150 }, r)).toBe(50);
    expect(distanceToRect({ x: 150, y: 260 }, r)).toBe(60);
    expect(distanceToRect({ x: 60, y: 60 }, r)).toBeCloseTo(Math.hypot(40, 40), 10); // esquina
    expect(distanceToRect({ x: 340, y: 240 }, r)).toBeCloseTo(Math.hypot(40, 40), 10);
  });

  it("spatialReading une la distancia y la ganancia para un punto y para un área", () => {
    const p = spatialReading(pointSound(), { x: 100, y: 200 });
    expect(p.distance).toBe(100);
    expect(p.gain).toBeCloseTo(pointGain(100, 50, 250), 10);
    const a = spatialReading(areaSound(), { x: 100, y: 150 });
    expect(a.distance).toBe(50);
    expect(a.gain).toBeCloseTo(0.25, 10);
    expect(spatialReading(areaSound(), { x: 100, y: 50 }).gain).toBe(1);
  });
});

describe("emisores en bucle (AC-88)", () => {
  it("una sola voz por emisor mientras es audible; no se crea ni se reinicia en cada actualización", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound() }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(1000);
    expect(h.backend.live).toHaveLength(1);
    expect(h.backend.voices).toHaveLength(1);
    h.advance(5000);
    expect(h.backend.voices).toHaveLength(1);
    expect(h.backend.live[0].loop).toBe(true);
  });

  it("el volumen efectivo combina emisor × volumen general × distancia × fundido, una sola vez", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound({ volume: 0.5 }) }, 1);
    h.svc.setListener({ x: 100, y: 200 }); // 100 px: ganancia (1 − 50/200)² = 0.5625
    await flush();
    h.advance(1000); // el fundido de entrada (100 ms) ya terminó
    const v = h.backend.live[0];
    expect(v.volume).toBeCloseTo(0.5 * 0.8 * 0.5625, 4);
    const d = h.svc.diagnostics();
    expect(d.voices[0].factors).toMatchObject({ base: 0.5, fade: 1 });
    expect(d.voices[0].factors.spatial).toBeCloseTo(0.5625, 4);
    expect(d.master).toBe(0.8);
  });

  it("el fundido de entrada sube el volumen de 0 al final en fadeInMs, y al salir hay fundido y parada", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound({ fadeInMs: 400, fadeOutMs: 400 }) }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(50);
    const v = h.backend.live[0];
    expect(v.volume).toBeLessThan(0.5 * 0.8 * 0.3);
    h.advance(600);
    expect(v.volume).toBeCloseTo(0.5 * 0.8, 4);
    h.svc.setListener({ x: 1000, y: 1000 }); // fuera de alcance
    h.advance(200);
    expect(v.sounding).toBe(true); // a mitad del fundido de salida
    expect(v.volume).toBeLessThan(0.5 * 0.8);
    h.advance(400);
    expect(v.sounding).toBe(false);
    expect(h.backend.live).toHaveLength(0);
  });

  it("al volver al alcance arranca una voz nueva y fuera de alcance no hay ninguna voz", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound() }, 1);
    h.svc.setListener({ x: 2000, y: 2000 });
    await flush();
    h.advance(2000);
    expect(h.backend.voices).toHaveLength(0);
    h.svc.setListener({ x: 100, y: 100 });
    h.advance(500);
    expect(h.backend.live).toHaveLength(1);
  });

  it("un emisor deshabilitado nunca suena en el recorrido", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound({ enabled: false }) }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(2000);
    expect(h.backend.voices).toHaveLength(0);
  });

  it("la velocidad se aplica a la voz, y un cambio en vivo (borrador del laboratorio) cambia volumen y velocidad sin crear otra voz", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound({ rate: 1 }) }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(500);
    const v = h.backend.live[0];
    expect(v.rate).toBe(1);
    h.svc.setEmitterDraft("rio", pointSound({ rate: 1.5, volume: 0.2 }));
    h.advance(100);
    expect(v.rate).toBe(1.5);
    expect(v.volume).toBeCloseTo(0.2 * 0.8, 4);
    expect(h.backend.voices).toHaveLength(1);
    h.svc.setEmitterDraft("rio", null);
    h.advance(100);
    expect(v.rate).toBe(1);
  });

  it("cambiar el alcance en vivo cambia la ganancia al instante", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound() }, 1);
    h.svc.setListener({ x: 100, y: 200 });
    await flush();
    h.advance(500);
    const before = h.backend.live[0].volume;
    h.svc.setEmitterDraft("rio", pointSound({ radius: 130 }));
    h.advance(100);
    expect(h.backend.live[0].volume).toBeLessThan(before);
  });
});

describe("emisores por intervalo (AC-88)", () => {
  it("espera entre minMs y maxMs, suena una vez, y no se solapa consigo mismo", async () => {
    const h = await harness(DEFAULT_SFX, { random: () => 0 }); // la espera mínima
    h.svc.setZone("zona-a", { pajaros: pointSound({ playback: { mode: "interval", minMs: 2000, maxMs: 5000 }, fadeInMs: 0 }) }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(1900);
    expect(h.backend.voices).toHaveLength(0);
    h.advance(300);
    expect(h.backend.voices).toHaveLength(1);
    expect(h.backend.voices[0].loop).toBe(false);
    h.advance(10_000); // sigue sonando (no ha terminado): ningún segundo disparo
    expect(h.backend.voices).toHaveLength(1);
    h.backend.voices[0].finish();
    h.advance(100); // la espera nueva empieza al terminar
    expect(h.backend.voices).toHaveLength(1);
    h.advance(2100);
    expect(h.backend.voices).toHaveLength(2);
  });

  it("la espera sortea entre el mínimo y el máximo", async () => {
    const h = await harness(DEFAULT_SFX, { random: () => 1 });
    h.svc.setZone("zona-a", { pajaros: pointSound({ playback: { mode: "interval", minMs: 2000, maxMs: 5000 }, fadeInMs: 0 }) }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(4900);
    expect(h.backend.voices).toHaveLength(0);
    h.advance(300);
    expect(h.backend.voices).toHaveLength(1);
  });

  it("el reloj solo avanza en alcance, con el audio autorizado y sin silencio", async () => {
    const h = await harness(DEFAULT_SFX, { random: () => 0 });
    h.svc.setZone("zona-a", { pajaros: pointSound({ playback: { mode: "interval", minMs: 1000, maxMs: 1000 }, fadeInMs: 0 }) }, 1);
    h.svc.setListener({ x: 3000, y: 3000 });
    await flush();
    h.advance(5000); // lejos: no corre
    expect(h.backend.voices).toHaveLength(0);
    h.svc.setListener({ x: 100, y: 100 });
    h.svc.setMuted(true);
    h.advance(5000); // en silencio: tampoco
    expect(h.backend.voices).toHaveLength(0);
    h.svc.setMuted(false);
    h.advance(900);
    expect(h.backend.voices).toHaveLength(0);
    h.advance(200);
    expect(h.backend.voices).toHaveLength(1);
  });
});

describe("emisores por entrada (AC-88)", () => {
  const enter = (over = {}) => areaSound({ playback: { mode: "enter", cooldownMs: 3000 }, fadeInMs: 0, edgeFadePx: 40, ...over });

  it("suena una vez al pasar de fuera a dentro, no en cada fotograma", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { campana: enter() }, 1);
    h.svc.setListener({ x: 500, y: 500 });
    await flush();
    h.advance(500);
    expect(h.backend.voices).toHaveLength(0);
    h.svc.setListener({ x: 100, y: 50 });
    h.advance(2000);
    expect(h.backend.voices).toHaveLength(1);
    expect(h.backend.voices[0].loop).toBe(false);
  });

  it("el enfriamiento impide repetir el disparo y la histéresis evita que vibrar en el borde dispare varias veces", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { campana: enter({ playback: { mode: "enter", cooldownMs: 0 } }) }, 1);
    h.svc.setListener({ x: 500, y: 500 });
    await flush();
    h.advance(100);
    h.svc.setListener({ x: 100, y: 50 }); // entra
    h.advance(100);
    h.backend.voices[0].finish();
    for (let i = 0; i < 6; i++) {
      h.svc.setListener({ x: 201 + (i % 2 ? 0 : 6), y: 50 }); // vibra apenas fuera del borde (6 px < histéresis)
      h.advance(50);
    }
    expect(h.backend.voices).toHaveLength(1);
    h.svc.setListener({ x: 200 + ENTER_HYSTERESIS_PX + 10, y: 50 }); // sale de verdad
    h.advance(50);
    h.svc.setListener({ x: 150, y: 50 }); // y vuelve a entrar
    h.advance(50);
    expect(h.backend.voices).toHaveLength(2);
  });

  it("el enfriamiento (cooldownMs) frena una segunda entrada demasiado pronto", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { campana: enter({ playback: { mode: "enter", cooldownMs: 5000 } }) }, 1);
    h.svc.setListener({ x: 500, y: 500 });
    await flush();
    h.advance(100);
    h.svc.setListener({ x: 100, y: 50 });
    h.advance(100);
    h.backend.voices[0].finish();
    h.svc.setListener({ x: 500, y: 500 });
    h.advance(100);
    h.svc.setListener({ x: 100, y: 50 });
    h.advance(100);
    expect(h.backend.voices).toHaveLength(1); // aún en enfriamiento
    h.svc.setListener({ x: 500, y: 500 });
    h.advance(5000);
    h.svc.setListener({ x: 100, y: 50 });
    h.advance(100);
    expect(h.backend.voices).toHaveLength(2);
  });

  it("al activar la zona con el visitante ya dentro, suena una vez cuando el audio está autorizado", async () => {
    const h = await harness(DEFAULT_SFX, { unlock: false });
    h.svc.setZone("zona-a", { campana: enter() }, 1);
    h.svc.setListener({ x: 100, y: 50 });
    await flush();
    h.advance(1000);
    expect(h.backend.voices).toHaveLength(0); // sin gesto del visitante no suena
    await h.svc.unlock();
    await flush();
    h.advance(100);
    expect(h.backend.voices).toHaveLength(1);
    h.advance(3000);
    expect(h.backend.voices).toHaveLength(1);
  });

  it("si en ese momento no se pudo (silencio), no se acumula nada para después", async () => {
    const h = await harness(DEFAULT_SFX, { muted: true });
    h.svc.setZone("zona-a", { campana: enter() }, 1);
    h.svc.setListener({ x: 100, y: 50 });
    await flush();
    h.advance(500);
    h.svc.setMuted(false);
    h.advance(3000);
    expect(h.backend.voices).toHaveLength(0);
  });
});

describe("pausas, silencio y ciclo de vida (AC-88, AC-90)", () => {
  it("al abrir una lectura el ambiente se suspende (fundido y parada) y al cerrarla vuelve; los efectos de interfaz no se ven afectados", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound() }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(500);
    expect(h.backend.live).toHaveLength(1);
    h.svc.setSuspended("reading", true);
    h.advance(1000);
    expect(h.backend.live).toHaveLength(0);
    await flush();
    expect(h.svc.playEvent("ui.open")).toBe(true);
    await flush();
    expect(h.backend.live.some((v) => v.key === "audio.sfx.test-ui-open")).toBe(true);
    h.svc.setSuspended("reading", false);
    h.advance(500);
    expect(h.backend.live.some((v) => v.key === "audio.sfx.test-river")).toBe(true);
  });

  it("el silencio detiene todo y al reactivarlo los bucles arrancan de nuevo", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound() }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(500);
    h.svc.setMuted(true);
    expect(h.backend.live).toHaveLength(0);
    expect(h.svc.playEvent("ui.open")).toBe(false);
    h.advance(1000);
    expect(h.backend.live).toHaveLength(0);
    h.svc.setMuted(false);
    h.advance(500);
    expect(h.backend.live).toHaveLength(1);
  });

  it("al ocultar la pestaña se detiene todo y al volver solo se reanuda el ambiente, sin cola de efectos antiguos", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound() }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(500);
    h.setHidden(true);
    expect(h.backend.live).toHaveLength(0);
    h.svc.playEvent("ui.open"); // oculta: no suena ni se guarda
    h.setHidden(false);
    h.advance(500);
    await flush();
    expect(h.backend.live.map((v) => v.key)).toEqual(["audio.sfx.test-river"]);
  });

  it("cambiar de zona detiene los loops anteriores, cancela las esperas y descarta las cargas tardías", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound(), pajaros: pointSound({ assetId: "audio.sfx.test-birds", playback: { mode: "interval", minMs: 500, maxMs: 500 } }) }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(300);
    const before = h.backend.live.length;
    expect(before).toBeGreaterThan(0);
    h.svc.setZone("zona-b", {}, 2);
    expect(h.backend.live).toHaveLength(0);
    h.advance(5000);
    expect(h.backend.live).toHaveLength(0);
    h.svc.clearZone(1); // una limpieza tardía de la escena anterior no toca la actual
    h.svc.setZone("zona-a", { rio: pointSound() }, 3);
    h.svc.clearZone(2);
    h.advance(500);
    expect(h.backend.live).toHaveLength(1);
    h.svc.clearZone(3);
    expect(h.backend.live).toHaveLength(0);
  });

  it("sin el gesto del visitante no suena nada; con el audio bloqueado se informa y el juego sigue", async () => {
    const h = await harness(DEFAULT_SFX, { unlock: false });
    h.svc.setZone("zona-a", { rio: pointSound() }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(1000);
    expect(h.backend.voices).toHaveLength(0);
    expect(h.svc.getState().status).toBe("idle");
    h.backend.setStatus("locked");
    await h.svc.unlock();
    expect(h.svc.getState().status).toBe("locked");
    h.advance(1000);
    expect(h.backend.voices).toHaveLength(0);
    h.backend.setStatus("ready");
    h.advance(500);
    expect(h.svc.getState().status).toBe("ready");
    expect(h.backend.live).toHaveLength(1);
  });

  it("sin audio.sfx (o desactivado) el juego sigue sin efectos", async () => {
    for (const cfg of [null, { ...DEFAULT_SFX, active: false }]) {
      const h = await harness(cfg);
      h.svc.setZone("zona-a", { rio: pointSound() }, 1);
      h.svc.setListener({ x: 100, y: 100 });
      await flush();
      h.advance(1000);
      expect(h.backend.voices).toHaveLength(0);
      expect(h.svc.playEvent("ui.open")).toBe(false);
      expect(h.svc.getState().enabled).toBe(false);
    }
  });

  it("un archivo que no carga se anota con su ID y el resto sigue sonando", async () => {
    const h = await harness();
    h.backend.failLoad.add("audio.sfx.test-birds");
    h.svc.setZone("zona-a", { rio: pointSound(), pajaros: pointSound({ assetId: "audio.sfx.test-birds" }) }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(500);
    expect(h.svc.getState().failed).toEqual(["audio.sfx.test-birds"]);
    expect(h.svc.getState().errors.join()).toContain("audio.sfx.test-birds");
    expect(h.backend.live.map((v) => v.key)).toEqual(["audio.sfx.test-river"]);
  });

  it("al destruir el servicio se detiene todo y se libera el caché", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { rio: pointSound() }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(500);
    h.svc.dispose();
    expect(h.backend.live).toHaveLength(0);
    expect(h.backend.loaded.size).toBe(0);
  });
});

describe("efectos de interfaz y de recompensa (AC-91)", () => {
  it("un efecto por acción configurada, con el volumen del preset por el general", async () => {
    const h = await harness();
    h.svc.playEvent("ui.open");
    await flush();
    expect(h.backend.live).toHaveLength(1);
    expect(h.backend.live[0].key).toBe("audio.sfx.test-ui-open");
    expect(h.backend.live[0].volume).toBeCloseTo(0.5 * 0.8, 4);
    expect(h.svc.playEvent("portal.travel")).toBe(false); // sin preset
  });

  it("con effectId suena una sola vez: un aviso duplicado no lo repite", async () => {
    const h = await harness();
    expect(h.svc.playEvent("badge.earned", { effectId: "apr-a@2026" })).toBe(true);
    await flush();
    expect(h.svc.playEvent("badge.earned", { effectId: "apr-a@2026" })).toBe(false);
    expect(h.svc.playEvent("badge.earned", { effectId: "apr-a@2026" })).toBe(false);
    expect(h.backend.voices).toHaveLength(1);
    expect(h.svc.playEvent("badge.earned", { effectId: "apr-b@2026" })).toBe(true);
    await flush();
    expect(h.backend.voices).toHaveLength(2);
  });

  it("el límite de voces cede el ambiente ante un efecto y rechaza más ambiente", async () => {
    const h = await harness({ ...DEFAULT_SFX, maxVoices: 2 });
    h.svc.setZone("zona-a", { a: pointSound(), b: pointSound({ position: { x: 110, y: 100 } }), c: pointSound({ position: { x: 120, y: 100 } }) }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(500);
    expect(h.backend.live).toHaveLength(2); // el tercero no cabe
    h.svc.playEvent("badge.earned");
    await flush();
    expect(h.backend.live).toHaveLength(2);
    expect(h.backend.live.some((v) => v.key === "audio.sfx.test-badge")).toBe(true);
    expect(h.svc.getState().voices).toBe(2);
    expect(h.svc.getState().maxVoices).toBe(2);
  });

  it("un efecto que tarda demasiado en cargar se descarta en lugar de sonar tarde", async () => {
    const h = await harness();
    h.backend.unload("audio.sfx.test-ui-open"); // aún no cargado
    const load = h.backend.load.bind(h.backend);
    h.backend.load = async (key, url) => {
      await new Promise((r) => setTimeout(r, 5));
      h.clock.now += 5000; // la carga «tardó» cinco segundos
      return load(key, url);
    };
    h.svc.playEvent("ui.open");
    await new Promise((r) => setTimeout(r, 30));
    expect(h.backend.voices).toHaveLength(0);
  });
});

describe("memoria y archivos temporales (AC-88, AC-93)", () => {
  it("el audio decodificado se recorta por debajo del límite sin tocar lo que usa la zona activa ni las voces vivas", async () => {
    const h = await harness();
    h.backend.bytesPer = Math.floor(SFX_CACHE_LIMIT_BYTES / 3) + 1;
    h.svc.setZone("zona-a", { rio: pointSound() }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(300);
    for (const id of ["audio.sfx.test-birds", "audio.sfx.test-wind", "audio.sfx.test-portal"]) await h.svc.ensure(id);
    expect(h.svc.diagnostics().decodedBytes).toBeLessThanOrEqual(SFX_CACHE_LIMIT_BYTES);
    expect(h.backend.has("audio.sfx.test-river")).toBe(true); // el de la zona activa se conserva
  });

  it("un archivo temporal se libera solo cuando ninguna voz lo usa", async () => {
    const h = await harness();
    await h.svc.loadTemp("lab:1", new ArrayBuffer(4000));
    expect(h.backend.has("lab:1")).toBe(true);
    const voice = h.svc.startVoice({ key: "lab:1", kind: "test", label: "prueba", volume: 1, rate: 1, loop: true });
    expect(voice).not.toBeNull();
    expect(h.svc.releaseTemp("lab:1")).toBe(false);
    voice?.stop();
    expect(h.svc.releaseTemp("lab:1")).toBe(true);
    expect(h.backend.has("lab:1")).toBe(false);
  });
});

describe("mezcla del laboratorio (AC-93)", () => {
  it("Solo baja los demás emisores y restaura la mezcla al salir; el oyente virtual sustituye a Vanessa", async () => {
    const h = await harness();
    h.svc.setZone("zona-a", { a: pointSound(), b: pointSound({ position: { x: 110, y: 100 } }) }, 1);
    h.svc.setListener({ x: 100, y: 100 });
    await flush();
    h.advance(500);
    const [va, vb] = h.backend.live;
    const full = va.volume;
    h.svc.setSolo("a");
    h.advance(100);
    expect(va.volume).toBeCloseTo(full, 4);
    expect(vb.volume).toBe(0);
    h.svc.setSolo(null);
    h.advance(100);
    expect(vb.volume).toBeGreaterThan(0);
    h.svc.setListenerOverride({ x: 5000, y: 5000 });
    expect(h.svc.diagnostics().listenerVirtual).toBe(true);
    h.advance(1000);
    expect(h.backend.live).toHaveLength(0);
    h.svc.setListenerOverride(null);
    h.advance(500);
    expect(h.backend.live).toHaveLength(2);
  });

  it("una prueba (test) suena aunque el ambiente esté suspendido, y respeta el silencio y el gesto", async () => {
    const h = await harness();
    await h.svc.loadTemp("lab:1", new ArrayBuffer(10));
    h.svc.setSuspended("audio-lab", true);
    expect(h.svc.startVoice({ key: "lab:1", kind: "test", label: "t", volume: 1, rate: 1, loop: false })).not.toBeNull();
    h.svc.setMuted(true);
    expect(h.svc.startVoice({ key: "lab:1", kind: "test", label: "t", volume: 1, rate: 1, loop: false })).toBeNull();
  });
});
