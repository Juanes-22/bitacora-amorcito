import Phaser from "phaser";
import type { AssetRegistry } from "../config/assetRegistry";
import type { BitacoraConfig, Point } from "../config/types";
import type { GameBridge } from "./bridge/GameBridge";
import { EXPLORATION_SCENE, ExplorationScene } from "./scenes/ExplorationScene";

export type { AssetFailure } from "./bridge/events";

export interface GameDeps {
  /** IDs de efectos ya consumidos (celebraciones): cada uno se reproduce una sola vez por juego. */
  celebrated: Set<string>;
  config: BitacoraConfig;
  assets: AssetRegistry;
  bridge: GameBridge;
  /** Zona y pies restaurados del guardado; solo se usan en el primer arranque (los cambios de zona traen su spawn). */
  initial?: { zoneId: string; position: Point };
  /** prefers-reduced-motion: sin sacudidas, destellos ni seguimiento suavizado (SPEC 14). */
  reducedMotion: boolean;
}

/** Clave del DataManager global de Phaser donde las escenas encuentran sus dependencias. */
export const DEPS_KEY = "app";

export function getDeps(scene: Phaser.Scene): GameDeps {
  return scene.registry.get(DEPS_KEY) as GameDeps;
}

export function createGame(parent: HTMLElement, input: Omit<GameDeps, "celebrated">): Phaser.Game {
  const deps: GameDeps = { ...input, celebrated: new Set() };
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    pixelArt: true,
    backgroundColor: "#1f2a1f",
    scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
    // El teclado escucha solo en el contenedor del mapa: sin foco no hay captura de flechas (SPEC 6.1).
    input: { keyboard: { target: parent } },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    // Pocas descargas a la vez y las imágenes como <img>: así compiten en igualdad con las de la interfaz (con XHR tienen prioridad
    // alta y, en una conexión lenta de móvil, la cabecera y los botones se quedaban sin sus imágenes hasta el final de la carga).
    loader: { maxParallelDownloads: 6, imageLoadType: "HTMLImageElement" },
    callbacks: { preBoot: (g) => g.registry.set(DEPS_KEY, deps) },
    scene: [ExplorationScene],
  });

  // La pausa se decide aquí, fuera de update(): una escena pausada no podría leer una orden (SPEC 11.6).
  const off = deps.bridge.on("app:controls", ({ reasons }) => {
    const scenes = game.scene;
    if (reasons.length > 0) {
      if (scenes.isActive(EXPLORATION_SCENE)) scenes.pause(EXPLORATION_SCENE);
    } else if (scenes.isPaused(EXPLORATION_SCENE)) {
      scenes.resume(EXPLORATION_SCENE);
    }
  });
  game.events.once(Phaser.Core.Events.DESTROY, off);

  // Solo desarrollo: lo usa el harness de /phaser-playtest y permite inspeccionar escenas y el puente.
  if (import.meta.env.DEV) {
    const w = window as unknown as { __PHASER_GAME__?: Phaser.Game; __BITACORA_BRIDGE__?: GameBridge };
    w.__PHASER_GAME__ = game;
    w.__BITACORA_BRIDGE__ = deps.bridge;
  }
  return game;
}
