import { describe, expect, it } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "./fixtures/realConfig";
import { AssetError, createAssetRegistry, resolveAssetBase } from "../config/assetRegistry";
import type { AssetManifest } from "../config/types";
import { validateAssetManifest } from "../config/validateAssets";
import { toValidatedFrames } from "../assets/frameDefinitions";
import { validateBitacora } from "../config/validateConfig";

const manifest = manifestJson as unknown as AssetManifest;
const clone = (): AssetManifest => structuredClone(manifest);
const at = (url: string, m: AssetManifest = manifest) => createAssetRegistry(m, url);

describe("AssetRegistry: resolución de rutas (AC-34)", () => {
  it("resuelve cada path respecto al directorio del propio assets.json, sin repetir assets/", () => {
    const r = at("http://localhost:5173/assets/assets.json");
    expect(r.url("ui.icon.xp-star")).toBe("http://localhost:5173/assets/ui/icons/xp-star.png");
    expect(r.url("background.zone-01.terrain")).toBe("http://localhost:5173/assets/backgrounds/zone-01/terrain-meadow-river-bridges.png");
    for (const id of r.ids()) {
      expect(r.url(id)).not.toContain("assets/assets");
      expect(r.url(id).endsWith(`/${r.get(id).path}`)).toBe(true);
    }
  });

  it("funciona bajo un subdirectorio de despliegue y con el manifiesto en otro origen", () => {
    expect(at("https://user.github.io/bitacora/assets/assets.json").url("effect.player.glow")).toBe(
      "https://user.github.io/bitacora/assets/effects/glow/player-glow.png",
    );
    expect(at("https://cdn.example.org/x/y/assets.json").url("effect.player.glow")).toBe(
      "https://cdn.example.org/x/y/effects/glow/player-glow.png",
    );
  });

  it("respeta basePath relativo al directorio del manifiesto", () => {
    expect(resolveAssetBase("http://h/a/assets.json", ".").href).toBe("http://h/a/");
    expect(resolveAssetBase("http://h/a/assets.json", "files").href).toBe("http://h/a/files/");
    expect(resolveAssetBase("http://h/a/assets.json", "./files/").href).toBe("http://h/a/files/");
    const m = clone();
    m.basePath = "img";
    expect(at("http://h/a/assets.json", m).url("ui.icon.xp-star")).toBe("http://h/a/img/ui/icons/xp-star.png");
  });

  it("nunca usa originalPath", () => {
    const r = at("http://h/sitio/assets.json");
    for (const [id, a] of r.entries()) {
      expect(a.originalPath).toBeTruthy();
      expect(r.url(id)).not.toContain(String(a.originalPath));
      expect(r.url(id)).toBe(`http://h/sitio/${a.path}`);
    }
  });

  it("cambiar el path de un ID sustituye el recurso sin tocar bitacora.json (AC-12)", () => {
    const m = clone();
    m.assets["ui.badge.active-listening"].path = "ui/badges/otra-insignia.png";
    const before = at("http://h/assets/assets.json").url("ui.badge.active-listening");
    const after = at("http://h/assets/assets.json", m).url("ui.badge.active-listening");
    expect(after).not.toBe(before);
    expect(after).toBe("http://h/assets/ui/badges/otra-insignia.png");
    const valid = validateAssetManifest(m);
    expect(valid.ok && validateBitacora(bitacoraJson, valid.value, { frameDefinitions: toValidatedFrames() }).ok).toBe(true);
  });
});

describe("AssetRegistry: metadata y errores", () => {
  const r = at("http://h/assets/assets.json");

  it("expone la metadata especializada sin transformarla", () => {
    expect(r.nineSlice("ui.panel.cream.nine-slice")).toEqual({ top: 32, right: 32, bottom: 32, left: 32 });
    expect(r.placement("ui.progress.xp.fill")).toEqual({ relativeTo: "ui.progress.xp.frame", x: 16, y: 20 });
    expect(r.nineSlice("ui.icon.xp-star")).toBeUndefined();
    expect(r.get("ui.button.green.hover").state).toBe("hover");
    expect(r.get("background.zone-01.terrain")).toMatchObject({ zone: "zone-01", layer: "terrain" });
  });

  it("distingue las hojas de poses que requieren definición de frames", () => {
    expect(r.byKind("pose-sheet")).toHaveLength(5);
    for (const [id] of r.byKind("pose-sheet")) expect(r.needsFrameDefinition(id)).toBe(true);
    expect(r.needsFrameDefinition("character.vanessa-jerry.idle")).toBe(false);
  });

  it("conserva metadata futura que no conoce", () => {
    const m = clone();
    m.assets["ui.icon.xp-star"].futuro = { a: 1 };
    expect(at("http://h/assets/assets.json", m).get("ui.icon.xp-star").futuro).toEqual({ a: 1 });
  });

  it("un ID inexistente lanza AssetError con el ID, también para claves heredadas de Object", () => {
    expect(() => r.get("no.existe")).toThrow(AssetError);
    expect(() => r.url("no.existe")).toThrow(/assetId «no\.existe»/);
    for (const id of ["constructor", "__proto__", "toString"]) {
      expect(r.has(id)).toBe(false);
      expect(() => r.get(id)).toThrow(AssetError);
    }
    try {
      r.get("otro.id");
    } catch (e) {
      expect((e as AssetError).assetId).toBe("otro.id");
    }
  });

  it("no modifica el manifiesto que recibe", () => {
    const m = clone();
    const snapshot = JSON.stringify(m);
    const reg = at("http://h/assets/assets.json", m);
    reg.ids().forEach((id) => reg.url(id));
    expect(JSON.stringify(m)).toBe(snapshot);
    expect(reg.manifest).toBe(m);
  });
});
