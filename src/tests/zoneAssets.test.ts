import { describe, expect, it } from "vitest";
import assetsJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import type { BitacoraConfig } from "../config/types";
import { zoneAssetIds, zoneAssetPlan } from "../game/systems/zoneAssets";

const config = bitacoraJson as unknown as BitacoraConfig;
const manifest = assetsJson as unknown as { assets: Record<string, { sizeBytes?: number; atlasPath?: string }> };

describe("zoneAssetIds (SPEC 3.1: una sola variante por capa)", () => {
  it("incluye solo las capas elegidas de la zona, no todas las variantes del catálogo", () => {
    const a = zoneAssetIds(config, "zona-a");
    expect(a).toEqual(expect.arrayContaining(config.maps["zona-a"].layers.map((l) => l.assetId)));
    expect(a).not.toContain("background.zone-01.foreground.foliage.v01");
    expect(a).not.toContain("background.zone-01.midground.cherry-tree.v02");
    expect(a.filter((id) => id.startsWith("background.zone-02"))).toEqual([]);
    expect(a).not.toContain("background.complete.garden");
  });

  it("incluye el personaje, la señal y los iconos de estado, sin duplicados", () => {
    const b = zoneAssetIds(config, "zona-b");
    expect(b).toContain(config.gameplay.player.assetId);
    expect(b).toContain(config.ui.assets.stationSign);
    expect(b).toContain("station.item.padlock");
    expect(new Set(b).size).toBe(b.length);
  });

  it("una estación archivada no hace cargar sus assets", () => {
    const c = structuredClone(config);
    c.placements["apr-d"].signAssetId = "station.sign.wooden-large";
    expect(zoneAssetIds(c, "zona-b")).toContain("station.sign.wooden-large");
    c.route = c.route.filter((id) => id !== "apr-d");
    expect(zoneAssetIds(c, "zona-b")).not.toContain("station.sign.wooden-large");
  });
});

describe("zoneAssetPlan (carga por etapas, SPEC 11.4)", () => {
  const plan = zoneAssetPlan(config, "zona-a");

  it("lo esencial es lo que hace falta para ver la zona y caminar: capas, letrero, iconos y la hoja de Vanessa", () => {
    expect(plan.essential).toEqual(expect.arrayContaining(config.maps["zona-a"].layers.map((l) => l.assetId)));
    expect(plan.essential).toContain(config.ui.assets.stationSign);
    expect(plan.essential).toContain("station.item.padlock");
    expect(plan.essential).toContain(config.gameplay.player.assetId);
  });

  it("el paisaje vivo, los extras y las insignias no bloquean el arranque", () => {
    const idle = config.gameplay.player.idle!;
    expect(plan.scenery).toContain("animation.flora.sunflowers");
    expect(plan.scenery).toContain("fauna.hen.white");
    expect(plan.extras).toEqual(expect.arrayContaining([idle.rest, idle.glance, idle.play, idle.tricks!.sheet, idle.fetch!.sheet]));
    expect(plan.onDemand).toEqual(config.route.map((id) => config.badges[config.learnings[id].badgeId].assetId));
    for (const id of [...plan.scenery, ...plan.extras, ...plan.onDemand]) expect(plan.essential).not.toContain(id);
  });

  it("las etapas no comparten assets y su unión es zoneAssetIds", () => {
    const all = [...plan.essential, ...plan.scenery, ...plan.extras, ...plan.onDemand];
    expect(new Set(all).size).toBe(all.length);
    expect(zoneAssetIds(config, "zona-a")).toEqual(all);
  });

  it("lo esencial pesa una fracción de la zona entera (el mapa aparece pronto en un móvil)", () => {
    const size = (ids: string[]) => ids.reduce((n, id) => n + ((manifest.assets[id]?.sizeBytes ?? 0) + (manifest.assets[id]?.atlasPath ? 20000 : 0)), 0);
    const total = size(zoneAssetIds(config, "zona-a"));
    expect(size(plan.essential)).toBeLessThan(total * 0.5);
    expect(size(plan.essential)).toBeLessThan(20 * 1024 * 1024);
  });
});
