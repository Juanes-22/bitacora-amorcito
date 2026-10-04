import Phaser from "phaser";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { Portal } from "../../config/types";

/** La señal de cambio de mapa (SPEC 4.3): su imagen y la escala con la que se dibuja en el mundo. */
export interface ExitSign {
  assets: AssetRegistry;
  assetId: string;
  scale: number;
}

const FONT = '"Trebuchet MS", system-ui, sans-serif';

/**
 * Marcador de un portal entre zonas. Con la imagen de señal del catálogo es un cartel de madera con una flecha y el nombre del
 * destino (vuelto hacia el borde del mapa por el que se sale); sin ella, un anillo y su etiqueta. En ambos casos conserva el
 * anillo de interacción. Los portales están abiertos desde el inicio.
 */
export class ZonePortal {
  readonly interaction: Portal["interaction"];
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;

  private readonly sign?: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, readonly portalId: string, portal: Portal, worldWidth: number, k: number, reducedMotion: boolean, exit?: ExitSign) {
    this.interaction = portal.interaction;
    const { x, y, radius } = portal.interaction;
    this.ring = scene.add.circle(x, y, radius * 0.55, 0xfff1c9, 0.22).setStrokeStyle(3 * k, 0xf5c542, 0.9).setDepth(y - 1);
    const entry = exit && exit.assets.has(exit.assetId) && scene.textures.exists(exit.assetId) ? exit.assets.get(exit.assetId) : undefined;
    const zone = entry?.labelZones?.destination;
    if (exit && entry && zone) {
      // Cartel hacia el borde por el que se sale: a la derecha si el portal está en la mitad derecha del mundo; si no, volteado.
      const flip = x < worldWidth / 2;
      const o = entry.origin ?? { x: 0.5, y: 1 };
      const ox = flip ? 1 - o.x : o.x;
      const W = entry.width ?? 1;
      const H = entry.height ?? 1;
      const s = exit.scale;
      // El cartel entero cabe en el mundo: se desplaza si el portal está pegado al borde.
      const left = x - ox * W * s;
      const bx = Phaser.Math.Clamp(x, x - left + 4, worldWidth - (W - ox * W) * s - 4);
      const by = y - radius * 0.35;
      this.sign = scene.add.image(bx, by, exit.assetId).setOrigin(ox, o.y).setScale(s).setFlipX(flip).setDepth(by);
      const zx = flip ? W - (zone.x + zone.width) : zone.x;
      this.label = scene.add
        .text(bx + (zx + zone.width / 2 - ox * W) * s, by + (zone.y + zone.height / 2 - o.y * H) * s, portal.label, { fontFamily: FONT, fontStyle: "bold", color: zone.color ?? "#4b2b18", align: "center" })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(by + 1);
      const maxW = zone.width * s;
      let size = Math.round((zone.fontSize ?? 25) * s);
      this.label.setFontSize(size);
      while (this.label.width > maxW && size > 7) this.label.setFontSize(--size);
      this.ring.setAlpha(0).setStrokeStyle(0); // sigue siendo el área sensible, sin dibujarse
      return;
    }
    this.label = scene.add
      .text(x, y - radius * 0.55 - 10 * k, portal.label, { fontFamily: '"Trebuchet MS", system-ui, sans-serif', fontStyle: "bold", fontSize: `${Math.round(15 * k)}px`, color: "#fff7e9", stroke: "#502010", strokeThickness: Math.round(4 * k) })
      .setOrigin(0.5, 1)
      .setResolution(2)
      .setDepth(y + 1);
    // Un portal junto al borde no debe dejar su etiqueta cortada fuera del mundo.
    const half = this.label.displayWidth / 2;
    this.label.setX(Phaser.Math.Clamp(x, half + 6, Math.max(half + 6, worldWidth - half - 6)));
    if (!reducedMotion) {
      scene.tweens.add({ targets: this.ring, scale: 1.12, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  /** ¿Cae el punto del mundo sobre el cartel del portal o su anillo (con un margen para dedos gruesos)? */
  contains(x: number, y: number, pad = 0): boolean {
    if (this.sign) {
      const b = this.sign.getBounds();
      if (x >= b.x - pad && x <= b.right + pad && y >= b.y - pad && y <= b.bottom + pad) return true;
    }
    return Math.hypot(x - this.interaction.x, y - this.interaction.y) <= this.ring.radius * this.ring.scaleX + pad;
  }

  destroy(): void {
    this.sign?.destroy();
    this.ring.destroy();
    this.label.destroy();
  }
}
