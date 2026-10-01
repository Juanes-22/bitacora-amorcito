import { describe, expect, it } from "vitest";
import bitacoraJson from "../../public/config/bitacora.json";
import type { BitacoraConfig } from "../config/types";
import { zoneAssetIds } from "../game/systems/zoneAssets";

const config = bitacoraJson as unknown as BitacoraConfig;

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
