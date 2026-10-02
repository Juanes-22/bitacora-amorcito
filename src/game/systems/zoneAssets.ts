import { findAnimation } from "../../assets/frameDefinitions";
import type { BitacoraConfig } from "../../config/types";

/**
 * assetIds que una zona necesita en Phaser: capas, decoraciones, señales y objetos de sus estaciones
 * activas, iconos de estado, el brillo y los actores. Archivadas y otras zonas no se cargan.
 */
export function zoneAssetIds(config: BitacoraConfig, zoneId: string): string[] {
  const zone = config.maps[zoneId];
  const ids = new Set<string>();
  zone.layers.forEach((l) => ids.add(l.assetId));
  zone.decorations.forEach((d) => ids.add(d.assetId));
  zone.ambient.forEach((fx) => ids.add(fx.assetId));
  for (const id of config.route) {
    const p = config.placements[id];
    if (!p || p.zoneId !== zoneId) continue;
    ids.add(p.signAssetId ?? config.ui.assets.stationSign);
    if (p.decorationAssetId) ids.add(p.decorationAssetId);
  }
  const { glow, lockIcon, xpStar, xpStarEffect, nextStationGlow, completedBadge, exitSign, stationSparkle } = config.ui.assets;
  [glow, lockIcon, xpStar, xpStarEffect, nextStationGlow, completedBadge, exitSign, stationSparkle].forEach((a) => a && ids.add(a));
  ids.add(config.gameplay.player.assetId);
  const idle = config.gameplay.player.idle;
  if (idle) [idle.rest, idle.glance, idle.play, idle.tricks?.sheet, idle.fetch?.sheet].forEach((a) => a && ids.add(a));
  // La celebración puede venir de otra hoja y usa el asset de la insignia de cada aprendizaje activo.
  const celebrate = config.gameplay.player.animations.celebrate;
  const sheet = celebrate ? findAnimation(celebrate)?.sheet.assetId : undefined;
  if (sheet) ids.add(sheet);
  for (const id of config.route) {
    const badge = config.badges[config.learnings[id]?.badgeId];
    if (badge) ids.add(badge.assetId);
  }
  if (config.gameplay.companion.actor) ids.add(config.gameplay.companion.actor.assetId);
  return [...ids];
}
