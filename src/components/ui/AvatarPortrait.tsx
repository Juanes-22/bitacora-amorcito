import { useEffect, useRef, useState } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import type { GameBridge } from "../../game/bridge/GameBridge";
import type { AvatarAnimation } from "../../config/types";
import { cycleMs, frameIndexAt, HAPPY_CYCLES, stillFrameName } from "./avatarTimeline";

/** Margen superior que se recorta del lienzo lógico (386 × 386): los fotogramas ocupan de la fila 22 a la 350. */
const CROP_TOP = 16;
const CROP_HEIGHT = 340;

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number };
}
interface Loaded {
  image: HTMLImageElement;
  frames: Record<string, AtlasFrame>;
}

const cache = new Map<string, Promise<Loaded>>();

/** Carga (una vez por URL) el PNG de la hoja y los recortes de su atlas; se rechaza si cualquiera de los dos falla. */
function load(imageUrl: string, atlasUrl: string): Promise<Loaded> {
  const key = `${imageUrl}|${atlasUrl}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = Promise.all([
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`no cargó ${imageUrl}`));
        image.src = imageUrl;
      }),
      fetch(atlasUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`no cargó ${atlasUrl}`)))),
    ]).then(([image, atlas]) => ({ image, frames: atlas.frames as Record<string, AtlasFrame> }));
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
  }
  return hit;
}

/**
 * Retrato de la cabecera: el avatar de Vanessa y Jerry en reposo (respira, parpadea) y feliz cuando se completa una
 * estación (`app:celebrate`, el mismo aviso que la estrella de XP). Los fotogramas y sus tiempos salen del manifiesto
 * (`avatar-sheet`). Mientras la hoja no carga —o si falla— se ve el avatar estático; con movimiento reducido no se
 * anima: reposo quieto y, al completar, el fotograma de la sonrisa abierta unos segundos.
 */
export function AvatarPortrait({ bridge }: { bridge?: GameBridge }) {
  const { config, assets } = useBitacora();
  const { portrait, avatarAnimations: sheetId } = config.ui.assets;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const happyUntil = useRef(0);
  const wake = useRef<() => void>(() => {});

  const entry = sheetId && assets.has(sheetId) ? assets.get(sheetId) : undefined;
  const tracks = entry?.avatarAnimations;
  const size = entry?.sourceFrameSize;

  useEffect(() => {
    if (!sheetId || !entry) return;
    let alive = true;
    load(assets.url(sheetId), assets.atlasUrl(sheetId)).then((l) => alive && setLoaded(l), () => {});
    return () => void (alive = false);
  }, [assets, sheetId, entry]);

  useEffect(() => {
    if (!bridge || !tracks) return;
    const happy = tracks.find((t) => t.state === "happy");
    if (!happy) return;
    return bridge.on("app:celebrate", () => {
      happyUntil.current = performance.now() + HAPPY_CYCLES * cycleMs(happy);
      wake.current();
    });
  }, [bridge, tracks]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !loaded || !tracks || !size) return;
    const idle = tracks.find((t) => t.state === "idle");
    const happy = tracks.find((t) => t.state === "happy");
    if (!idle || !happy) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let raf = 0;
    let timer = 0;
    let start = 0;
    let state: AvatarAnimation["state"] | null = null;
    let shown = "";
    const draw = (name: string) => {
      const f = loaded.frames[name];
      if (!f || name === shown) return;
      shown = name;
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.drawImage(loaded.image, f.frame.x, f.frame.y, f.frame.w, f.frame.h, f.spriteSourceSize.x, f.spriteSourceSize.y - CROP_TOP, f.frame.w, f.frame.h);
    };
    const tick = (now: number) => {
      const next = now < happyUntil.current ? happy : idle;
      if (next.state !== state) { state = next.state; start = now; }
      draw(next.frameNames[frameIndexAt(next, now - start)]);
      raf = requestAnimationFrame(tick);
    };
    const still = () => {
      const happyNow = performance.now() < happyUntil.current;
      draw(stillFrameName(happyNow ? happy : idle));
      window.clearTimeout(timer);
      if (happyNow) timer = window.setTimeout(still, Math.max(0, happyUntil.current - performance.now()) + 20);
    };
    if (reduced) {
      wake.current = still;
      still();
    } else {
      wake.current = () => {};
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      wake.current = () => {};
    };
  }, [loaded, tracks, size]);

  const animated = !!loaded && !!tracks && !!size;
  return (
    <span className={`hud__portrait${animated ? " hud__portrait--animated" : ""}`}>
      <img src={assets.url(portrait)} alt="" hidden={animated} />
      {animated ? <canvas ref={canvas} width={size.width} height={CROP_HEIGHT} aria-hidden="true" /> : null}
    </span>
  );
}
