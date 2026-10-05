import { findAnimation } from "../../assets/frameDefinitions";
import type { BitacoraConfig } from "../../config/types";

/**
 * Los assets de una zona en el orden en que se cargan (SPEC 11.4, «carga por etapas»). El mapa se muestra cuando llegan los
 * esenciales; el resto se pide después, sin bloquear al visitante:
 *
 * - `essential`: lo necesario para ver la zona y caminar por ella (capas, decoraciones, letreros e iconos de estado, efectos de las
 *   estaciones y la hoja con la que camina Vanessa).
 * - `scenery`: el paisaje vivo (efectos ambientales y animales); aparece en cuanto llega.
 * - `extras`: lo que solo se usa al rato (reposo animado de Vanessa y Jerry, la pose de celebración).
 * - `onDemand`: las insignias; solo se cargan al celebrar, no ocupan memoria antes (la colección las muestra desde el HTML).
 *
 * Los de otras zonas y los de aprendizajes archivados no se cargan.
 */
export interface ZoneAssetPlan {
  essential: string[];
  scenery: string[];
  extras: string[];
  onDemand: string[];
}

export function zoneAssetPlan(config: BitacoraConfig, zoneId: string): ZoneAssetPlan {
  const zone = config.maps[zoneId];
  const seen = new Set<string>();
  /** Añade a `list` lo que no estaba ya en una etapa anterior. */
  const stage = (...groups: Array<Array<string | undefined>>): string[] => {
    const out: string[] = [];
    for (const g of groups) for (const id of g) if (id && !seen.has(id)) (seen.add(id), out.push(id));
    return out;
  };
  const { glow, lockIcon, xpStar, xpStarEffect, nextStationGlow, completedBadge, exitSign, stationSparkle } = config.ui.assets;
  const stations = config.route.flatMap((id) => {
    const p = config.placements[id];
    return p && p.zoneId === zoneId ? [p.signAssetId ?? config.ui.assets.stationSign, p.decorationAssetId] : [];
  });

  const essential = stage(
    zone.layers.map((l) => l.assetId),
    zone.decorations.map((d) => d.assetId),
    stations,
    [glow, lockIcon, xpStar, xpStarEffect, nextStationGlow, completedBadge, exitSign, stationSparkle],
    [config.gameplay.player.assetId, config.gameplay.companion.actor?.assetId],
  );
  const scenery = stage(
    zone.ambient.map((fx) => fx.assetId),
    (zone.critters ?? []).flatMap((k) => (k.type === "family" ? [k.assetId, k.chickAssetId] : [k.assetId])),
  );
  const idle = config.gameplay.player.idle;
  // La celebración puede venir de otra hoja del personaje.
  const celebrate = config.gameplay.player.animations.celebrate;
  const extras = stage(idle ? [idle.rest, idle.glance, idle.play, idle.tricks?.sheet, idle.fetch?.sheet] : [], [celebrate ? findAnimation(celebrate)?.sheet.assetId : undefined]);
  const onDemand = stage(config.route.map((id) => config.badges[config.learnings[id]?.badgeId]?.assetId));
  return { essential, scenery, extras, onDemand };
}

/** Todos los assetIds que una zona puede llegar a cargar, en el orden de las etapas y sin repetir. */
export function zoneAssetIds(config: BitacoraConfig, zoneId: string): string[] {
  const p = zoneAssetPlan(config, zoneId);
  return [...p.essential, ...p.scenery, ...p.extras, ...p.onDemand];
}
