import Phaser from "phaser";

/** Una pisada: el tramo de la parte baja de un fotograma donde algo apoya en el suelo (en píxeles del recorte). */
export interface Footprint {
  x0: number;
  x1: number;
  /** Fila más baja con píxeles opacos dentro de esas columnas. */
  bottom: number;
}

const ALPHA_MIN = 128;
const BAND = 0.08; // la franja baja que cuenta como «suelo»: el 8 % de la altura del contenido
const GAP = 0.03; // dos tramos separados menos que esto (en ancho del contenido) se unen
const MIN_RUN = 0.06; // los tramos más estrechos que esto son ruido (un mechón, una oreja)
const MAX_RUNS = 3;

/**
 * Calcula dónde apoya un fotograma: recorre su franja inferior y devuelve un tramo por cada «pie» (Vanessa, Jerry…), de
 * izquierda a derecha. Función pura sobre los píxeles RGBA del recorte, para poder probarla sin Phaser.
 */
export function footprints(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Footprint[] {
  const opaque = (x: number, y: number) => rgba[(y * width + x) * 4 + 3] >= ALPHA_MIN;
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!opaque(x, y)) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return [];
  const contentW = right - left + 1;
  const bandTop = Math.max(top, bottom - Math.max(3, Math.round((bottom - top + 1) * BAND)));
  const gap = Math.max(2, Math.round(contentW * GAP));
  const runs: Footprint[] = [];
  let current: Footprint | null = null;
  let lastX = -Infinity;
  for (let x = left; x <= right; x++) {
    let lowest = -1;
    for (let y = bottom; y >= bandTop; y--) {
      if (opaque(x, y)) { lowest = y; break; }
    }
    if (lowest < 0) continue;
    if (current && x - lastX <= gap + 1) {
      current.x1 = x;
      current.bottom = Math.max(current.bottom, lowest);
    } else {
      current = { x0: x, x1: x, bottom: lowest };
      runs.push(current);
    }
    lastX = x;
  }
  return runs
    .filter((r) => r.x1 - r.x0 + 1 >= contentW * MIN_RUN)
    .sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0))
    .slice(0, MAX_RUNS)
    .sort((a, b) => a.x0 - b.x0);
}

export interface ShadowStyle {
  /** Opacidad de la sombra (0..1). */
  alpha: number;
  /** Cuánto sobresale la sombra del tramo que apoya (1 = justo su ancho). */
  widthFactor: number;
  /** Alto de la elipse respecto de su ancho. */
  aspect: number;
}

const TEXTURE_KEY = "__ground-shadow";

/** Una elipse suave (centro oscuro que se difumina hacia el borde), creada una vez por escena con un lienzo. */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEY)) return;
  const tex = scene.textures.createCanvas(TEXTURE_KEY, 64, 32);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(30,20,10,1)");
  g.addColorStop(0.6, "rgba(30,20,10,0.75)");
  g.addColorStop(1, "rgba(30,20,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.restore();
  tex.refresh();
}

/**
 * Sombras bajo lo que apoya en el suelo: una elipse suave por cada «pie» del fotograma visible del sprite (Vanessa y Jerry
 * tienen la suya), calculadas de los propios píxeles y recolocadas con cada fotograma, así que siguen el paso, el reposo
 * y los gestos sin tablas a mano. Quedan justo debajo del sprite en el orden de profundidad.
 */
export class GroundShadow {
  private readonly shadows: Phaser.GameObjects.Image[] = [];
  private readonly cache = new Map<string, Footprint[]>();
  private readonly sheets = new Map<string, ImageData | null>();

  constructor(private readonly scene: Phaser.Scene, private readonly sprite: Phaser.GameObjects.Sprite, private readonly style: ShadowStyle) {
    ensureTexture(scene);
  }

  /** `liftY`: cuánto se ha despegado el sprite del suelo (un salto): la sombra se queda abajo. */
  update(liftY = 0): void {
    const { sprite } = this;
    const runs = sprite.visible ? this.runsOf(sprite.texture.key, sprite.frame) : [];
    const f = sprite.frame;
    const scale = Math.abs(sprite.scaleX);
    for (let i = 0; i < Math.max(runs.length, this.shadows.length); i++) {
      const run = runs[i];
      let img = this.shadows[i];
      if (!run) { img?.setVisible(false); continue; }
      if (!img) img = this.shadows[i] = this.scene.add.image(0, 0, TEXTURE_KEY).setAlpha(this.style.alpha);
      const flip = sprite.flipX ? -1 : 1;
      const cx = f.x + (run.x0 + run.x1 + 1) / 2 - sprite.originX * f.realWidth;
      const cy = f.y + run.bottom + 1 - sprite.originY * f.realHeight;
      const width = (run.x1 - run.x0 + 1) * scale * this.style.widthFactor;
      const lift = Math.min(1, Math.max(0, -liftY / (0.08 * f.realHeight * scale))); // 0 en el suelo, 1 en lo alto del salto
      const w = width * (1 - 0.2 * lift);
      const h = width * this.style.aspect * (1 - 0.2 * lift);
      img
        .setPosition(sprite.x + cx * scale * flip, sprite.y - liftY + cy * Math.abs(sprite.scaleY) + h * 0.15) // un poco por debajo del pie: asoma por delante del contorno
        .setDisplaySize(w, h)
        .setAlpha(this.style.alpha * (1 - 0.35 * lift))
        .setDepth(sprite.depth - 1)
        .setVisible(true);
    }
  }

  destroy(): void {
    this.shadows.forEach((s) => s.destroy());
    this.shadows.length = 0;
    this.cache.clear();
    this.sheets.clear();
  }

  private runsOf(key: string, frame: Phaser.Textures.Frame): Footprint[] {
    const id = `${key}|${frame.name}`;
    let hit = this.cache.get(id);
    if (!hit) {
      hit = this.measure(key, frame);
      this.cache.set(id, hit);
    }
    return hit;
  }

  private measure(key: string, frame: Phaser.Textures.Frame): Footprint[] {
    let sheet = this.sheets.get(key);
    if (sheet === undefined) {
      sheet = null;
      try {
        const src = this.scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
        const canvas = document.createElement("canvas");
        canvas.width = src.width;
        canvas.height = src.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(src, 0, 0);
          sheet = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
      } catch {
        /* sin lectura de píxeles (entorno sin lienzo): sin sombra */
      }
      this.sheets.set(key, sheet);
    }
    if (!sheet) return [];
    const w = frame.cutWidth;
    const h = frame.cutHeight;
    const crop = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const from = ((frame.cutY + y) * sheet.width + frame.cutX) * 4;
      crop.set(sheet.data.subarray(from, from + w * 4), y * w * 4);
    }
    return footprints(crop, w, h);
  }
}
