import Phaser from "phaser";
import type { Point } from "../../config/types";
import type { AppSnapshot, AssetFailure, ControlsMode } from "../bridge/events";
import { Player } from "../entities/Player";
import { getDeps, type GameDeps } from "../createGame";
import { setupCamera } from "../systems/CameraController";
import { debugEnabled, setupDebugOverlay } from "../systems/DebugOverlay";
import { InputController } from "../systems/InputController";
import { buildAmbient, type Ambient } from "../systems/AmbientBuilder";
import { navigationGrid } from "../../config/reachability";
import { InteractionSystem } from "../systems/InteractionSystem";
import { TapNavigation } from "../systems/TapNavigation";
import { playCelebration } from "../systems/Celebration";
import { buildWorld, type World } from "../systems/WorldBuilder";
import { zoneAssetIds } from "../systems/zoneAssets";

export const EXPLORATION_SCENE = "ExplorationScene";

export interface ExplorationData {
  zoneId?: string;
  spawnId?: string;
  position?: Point;
}

/**
 * Escena reutilizable: se configura por `zoneId` y se reinicia para cambiar de zona. No sabe cuántas
 * estaciones hay ni en qué zona están: lo lee de `maps`, `route` y `placements` (SPEC 4.4).
 */
export class ExplorationScene extends Phaser.Scene {
  private deps!: GameDeps;
  private data0: ExplorationData = {};
  private zoneId = "";
  private token = 0;
  private world?: World;
  private ambient?: Ambient;
  private player?: Player;
  private input2?: InputController;
  private tap?: TapNavigation;
  private controlsMode: ControlsMode = "tap";
  private interaction?: InteractionSystem;
  private cleanups: Array<() => void> = [];
  private failures: AssetFailure[] = [];
  private appliedVersion = -1;
  private wasMoving = false;

  constructor() {
    super(EXPLORATION_SCENE);
  }

  init(data: ExplorationData): void {
    this.deps = getDeps(this);
    this.data0 = data ?? {};
    const initial = this.data0.zoneId === undefined ? this.deps.initial : undefined; // solo el primer arranque
    if (initial) this.data0 = { zoneId: initial.zoneId, position: initial.position };
    this.zoneId = this.data0.zoneId ?? this.deps.config.gameplay.start.zoneId;
    this.failures = [];
    this.appliedVersion = -1;
    this.wasMoving = false;
  }

  preload(): void {
    const { config, assets } = this.deps;
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.failures.push({ assetId: file.key, url: String(file.url) });
    });
    for (const id of zoneAssetIds(config, this.zoneId)) {
      if (this.textures.exists(id)) continue;
      // Las hojas animadas se cargan con su atlas (regiones explícitas); el resto, como imagen.
      if (assets.isAtlas(id)) this.load.atlas(id, assets.url(id), assets.atlasUrl(id));
      else this.load.image(id, assets.url(id));
    }
  }

  create(): void {
    const { config, assets, bridge, reducedMotion } = this.deps;
    const zone = config.maps[this.zoneId];
    const spawnId = this.data0.spawnId ?? zone.initialSpawnId;
    const start = this.data0.position ?? zone.spawns[spawnId] ?? zone.spawns[zone.initialSpawnId];
    this.token = bridge.beginScene();
    // Un archivo que «carga» pero no se puede decodificar (p. ej. un servidor que devuelve la página de inicio en lugar de
    // un 404) no dispara FILE_LOAD_ERROR: se detecta por la textura que falta, con su ID y su ruta (SPEC 12.3, AC-20).
    for (const id of zoneAssetIds(config, this.zoneId)) {
      if (!this.textures.exists(id) && !this.failures.some((f) => f.assetId === id)) this.failures.push({ assetId: id, url: assets.url(id) });
    }

    this.world = buildWorld(this, config, assets, this.zoneId, reducedMotion);
    this.ambient = buildAmbient(this, config, assets, this.zoneId, reducedMotion);
    this.player = new Player(this, config.gameplay.player, start, { assets, reducedMotion });
    this.physics.world.setBounds(0, 0, zone.width, zone.height);
    this.physics.add.collider(this.player.feet, this.world.obstacles);
    this.cleanups.push(setupCamera(this, this.world, this.player, config.gameplay, reducedMotion));

    this.input2 = new InputController(this, bridge, config.gameplay.player.idle?.actionKey);
    this.interaction = new InteractionSystem(bridge, this.token, this.zoneId, this.world.targets);
    // Tocar para caminar y tocar la estación para explorar (SPEC 6.1): usa la misma rejilla que valida la alcanzabilidad.
    this.tap = new TapNavigation(this, {
      grid: navigationGrid(config, this.zoneId),
      targets: this.world.targets,
      stations: this.world.stations,
      portals: this.world.portals,
      position: () => this.player?.position ?? start,
      nearest: (feet) => this.interaction?.nearest(feet) ?? null,
      requestInteract: () => this.input2?.requestInteract(),
      enabled: () => this.controlsMode === "tap" && !!this.input2 && !this.scene.isPaused() && !this.interaction?.hasPending,
      reducedMotion,
    });
    if (debugEnabled()) this.cleanups.push(setupDebugOverlay(this, this.world, this.player));

    this.controlsMode = bridge.controlsMode;
    // Receptores antes de avisar: los eventos son avisos; la instantánea retenida es la verdad (SPEC 11.5).
    this.cleanups.push(
      bridge.on("app:controls-mode", ({ mode }) => {
        this.controlsMode = mode;
        this.tap?.cancel(); // al cambiar de modo se detiene cualquier recorrido por toque
      }),
      bridge.on("app:sync", (snapshot) => this.applySnapshot(snapshot)),
      bridge.on("app:celebrate", ({ effectId, learningId }) => {
        // Cada efecto se consume una sola vez (también ante emisiones duplicadas o comprobaciones de desarrollo).
        if (this.deps.celebrated.has(effectId) || !this.player) return;
        this.deps.celebrated.add(effectId);
        playCelebration(this, this.deps.config, this.player, learningId, this.deps.reducedMotion);
      }),
      bridge.on("app:zone-change", ({ zoneId, spawnId: target }) => {
        if (this.scene.isPaused()) this.scene.resume();
        this.scene.restart({ zoneId, spawnId: target });
      }),
    );
    this.events.on(Phaser.Scenes.Events.PAUSE, this.onPause, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    if (bridge.snapshot) this.applySnapshot(bridge.snapshot);
    if (this.failures.length) bridge.emit("game:asset-failures", { failures: this.failures, token: this.token });
    bridge.emit("game:ready", { zoneId: this.zoneId, token: this.token, position: this.player.position });
    // Un bloqueo que ya estaba activo (lectura, transición) se respeta desde el primer fotograma.
    if (bridge.controlReasons.length) this.scene.pause();
  }

  update(_time: number, delta: number): void {
    const { config, bridge } = this.deps;
    if (!this.player || !this.input2 || !this.interaction) return;
    // Las flechas mandan: cualquier tecla cancela el recorrido por toque. Si no, el recorrido entrega su dirección.
    if (this.input2.consumeAction()) {
      this.tap?.cancel(); // jugar con Jerry detiene cualquier recorrido por toque
      this.player.requestAction();
    }
    const manual = this.input2.vector();
    const manualActive = manual.x !== 0 || manual.y !== 0;
    if (manualActive) this.tap?.cancel();
    const vector = manualActive ? manual : (this.tap?.vector(this.player.position, delta, config.gameplay.playerSpeed) ?? manual);
    this.player.update(vector, config.gameplay.playerSpeed, delta);

    const requested = this.interaction.update(this.player.position, this.input2.consumeInteract());
    if (requested) {
      this.player.stop(); // detención inmediata mientras la aplicación valida
      this.input2.reset();
      this.tap?.cancel();
    }

    // Checkpoint al detenerse (no por fotograma).
    const moving = vector.x !== 0 || vector.y !== 0;
    if (this.wasMoving && !moving) {
      bridge.emit("game:checkpoint", { zoneId: this.zoneId, position: this.player.position, token: this.token });
    }
    this.wasMoving = moving;
  }

  private applySnapshot(snapshot: AppSnapshot): void {
    if (snapshot.version < this.appliedVersion) return;
    this.appliedVersion = snapshot.version;
    const pending = new Set(snapshot.pending);
    const label = this.deps.config.ui.labels.pending;
    this.world?.stations.forEach((station, id) => {
      station.setState(snapshot.stations[id] ?? "locked");
      station.setPending(pending.has(id) ? label : null);
    });
  }

  private onPause(): void {
    this.player?.stop();
    this.input2?.reset();
    this.tap?.cancel();
    this.interaction?.clearNearby();
  }

  private onResume(): void {
    // Antes de reanudar: instantánea vigente, entradas y velocidades limpias.
    const snapshot = this.deps.bridge.snapshot;
    if (snapshot) this.applySnapshot(snapshot);
    this.player?.stop();
    this.input2?.reset();
    this.tap?.cancel();
    this.wasMoving = false;
  }

  private onShutdown(): void {
    if (this.player && this.wasMoving) {
      this.deps.bridge.emit("game:checkpoint", { zoneId: this.zoneId, position: this.player.position, token: this.token });
    }
    this.events.off(Phaser.Scenes.Events.PAUSE, this.onPause, this);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.cleanups.forEach((off) => off());
    this.cleanups = [];
    this.tap?.destroy();
    this.interaction?.destroy();
    this.input2?.destroy();
    this.player?.destroy();
    this.ambient?.destroy();
    this.world?.destroy();
    this.ambient = undefined;
    this.interaction = undefined;
    this.tap = undefined;
    this.input2 = undefined;
    this.player = undefined;
    this.world = undefined;
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR);
  }
}
