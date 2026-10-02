import Phaser from "phaser";
import { stationNumber } from "../../domain/progression";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { BitacoraConfig } from "../../config/types";
import { Station } from "../entities/Station";
import { ZonePortal } from "../entities/ZonePortal";
import type { InteractionTarget } from "./InteractionSystem";
import { signFactor } from "./worldScale";

export interface World {
  width: number;
  height: number;
  obstacles: Phaser.GameObjects.Group;
  stations: Map<string, Station>;
  portals: ZonePortal[];
  targets: InteractionTarget[];
  destroy(): void;
}

/**
 * Construye una zona a partir de `maps[zoneId]`, `route` y `placements`: capas elegidas explícitamente,
 * decoraciones, obstáculos estáticos, una Station por aprendizaje activo de la zona y sus portales.
 * Todo recurso se resuelve por assetId; nada depende del número ni del orden de las zonas.
 */
export function buildWorld(
  scene: Phaser.Scene,
  config: BitacoraConfig,
  assets: AssetRegistry,
  zoneId: string,
  reducedMotion: boolean,
): World {
  const zone = config.maps[zoneId];
  const created: Array<{ destroy(): void }> = [];

  for (const layer of zone.layers) {
    if (!scene.textures.exists(layer.assetId)) continue; // falló la carga: ya se informó con su ID
    created.push(scene.add.image(0, 0, layer.assetId).setOrigin(0, 0).setDepth(layer.depth));
  }
  for (const d of zone.decorations) {
    if (!scene.textures.exists(d.assetId)) continue;
    const image = scene.add.image(d.position.x, d.position.y, d.assetId).setOrigin(d.origin.x, d.origin.y).setScale(d.scale);
    image.setDepth(d.depth.mode === "fixed" ? d.depth.value : d.position.y + d.depth.offset);
    created.push(image);
  }

  // Obstáculos: cuerpos estáticos sin imagen (rectángulos o círculos), como pide la SPEC 4.4.
  const obstacles = scene.add.group();
  for (const o of zone.obstacles) {
    const w = o.type === "rect" ? o.width : o.radius * 2;
    const h = o.type === "rect" ? o.height : o.radius * 2;
    const cx = o.type === "rect" ? o.x + o.width / 2 : o.x;
    const cy = o.type === "rect" ? o.y + o.height / 2 : o.y;
    const body = scene.add.zone(cx, cy, w, h);
    scene.physics.add.existing(body, true);
    if (o.type === "circle") (body.body as Phaser.Physics.Arcade.StaticBody).setCircle(o.radius);
    obstacles.add(body);
  }

  const stations = new Map<string, Station>();
  const targets: InteractionTarget[] = [];
  config.route.forEach((id, index) => {
    const placement = config.placements[id];
    if (!placement || placement.zoneId !== zoneId) return;
    const sign = placement.signAssetId ?? config.ui.assets.stationSign;
    const station = new Station(
      scene,
      id,
      stationNumber(config.route, id),
      placement,
      {
        sign,
        glow: config.ui.assets.glow,
        lockIcon: config.ui.assets.lockIcon,
        doneIcon: config.ui.assets.xpStar,
        // Título y número sobre el letrero, y el estado debajo; un letrero sin `labelZones` conserva solo el número.
        identity: {
          assets,
          title: config.learnings[id].signTitle ?? config.learnings[id].title,
          completedLabel: config.ui.labels.stateCompleted,
          nextLabel: config.ui.labels.nextBadge,
          completedBadge: config.ui.assets.completedBadge,
        },
        effects: { assets, nextGlow: config.ui.assets.nextStationGlow, xpStar: config.ui.assets.xpStarEffect, sparkle: config.ui.assets.stationSparkle },
      },
      config.gameplay.signScale,
      reducedMotion,
    );
    stations.set(id, station);
    targets.push({ target: { kind: "learning", id }, ...station.interaction, order: index });
  });

  const portals = Object.entries(zone.portals).map(([portalId, portal], i) => {
    targets.push({ target: { kind: "portal", id: portalId }, ...portal.interaction, order: config.route.length + i });
    return new ZonePortal(scene, portalId, portal, zone.width, signFactor(config), reducedMotion, config.ui.assets.exitSign ? { assets, assetId: config.ui.assets.exitSign, scale: config.gameplay.signScale } : undefined);
  });
  void assets; // las URLs ya se resolvieron al cargar las texturas con las mismas claves

  return {
    width: zone.width,
    height: zone.height,
    obstacles,
    stations,
    portals,
    targets,
    destroy() {
      created.forEach((o) => o.destroy());
      stations.forEach((s) => s.destroy());
      portals.forEach((p) => p.destroy());
      obstacles.destroy(true);
    },
  };
}
