import Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { World } from "./WorldBuilder";

/** Vista de depuración SOLO en desarrollo y con `?debug`: cuerpos, radios y coordenadas de los pies (SPEC 4.4). */
export function debugEnabled(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has("debug");
}

export function setupDebugOverlay(scene: Phaser.Scene, world: World, player: Player): () => void {
  scene.physics.world.createDebugGraphic();
  scene.physics.world.drawDebug = true;
  const g = scene.add.graphics().setDepth(100000);
  for (const t of world.targets) {
    g.lineStyle(2, t.target.kind === "learning" ? 0x00ffff : 0xff00ff, 0.9).strokeCircle(t.x, t.y, t.radius);
    g.fillStyle(0xffffff, 1).fillCircle(t.x, t.y, 3);
  }
  const text = scene.add.text(8, 8, "", { fontFamily: "monospace", fontSize: "14px", color: "#ffffff", backgroundColor: "#000000aa" }).setScrollFactor(0).setDepth(100001);
  const update = () => {
    const p = player.position;
    text.setText(`pies x:${p.x.toFixed(1)} y:${p.y.toFixed(1)}  vel:${player.body.velocity.length().toFixed(0)}`);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  return () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, update);
    g.destroy();
    text.destroy();
  };
}
