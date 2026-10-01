import Phaser from "phaser";
import type { Portal } from "../../config/types";

/** Marcador de un portal entre zonas: un anillo y su etiqueta. Los portales están abiertos desde el inicio. */
export class ZonePortal {
  readonly interaction: Portal["interaction"];
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, readonly portalId: string, portal: Portal, worldWidth: number, k: number, reducedMotion: boolean) {
    this.interaction = portal.interaction;
    const { x, y, radius } = portal.interaction;
    this.ring = scene.add.circle(x, y, radius * 0.55, 0xfff1c9, 0.22).setStrokeStyle(3 * k, 0xf5c542, 0.9).setDepth(y - 1);
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

  destroy(): void {
    this.ring.destroy();
    this.label.destroy();
  }
}
