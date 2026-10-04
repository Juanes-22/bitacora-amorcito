import { describe, expect, it } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "../../public/config/bitacora.json";
import bitacoraSchema from "../../public/config/bitacora.schema.json";
import { validateAssetManifest } from "../config/validateAssets";
import { validateBitacora, type ValidateOptions } from "../config/validateConfig";
import type { AssetManifest, BitacoraConfig, ConfigIssue } from "../config/types";
import { learningId, makeConfig } from "./fixtures/makeConfig";

const realManifest = (() => {
  const r = validateAssetManifest(manifestJson);
  if (!r.ok) throw new Error(`assets.json real inválido: ${JSON.stringify(r.issues)}`);
  return r.value;
})();

const clone = <T>(v: T): T => structuredClone(v);

/** Aplica `edit` a una copia del fixture y devuelve los errores (o [] si es válido). */
function issuesOf(edit: (c: BitacoraConfig) => void, options?: ValidateOptions, count = 6): ConfigIssue[] {
  const c = makeConfig(count);
  edit(c);
  const r = validateBitacora(c, realManifest, options);
  return r.ok ? [] : r.issues;
}
const manifestIssues = (edit: (m: AssetManifest) => void): ConfigIssue[] => {
  const m = clone(manifestJson) as unknown as AssetManifest;
  edit(m);
  const r = validateAssetManifest(m);
  return r.ok ? [] : r.issues;
};
const at = (issues: ConfigIssue[], path: string) => issues.filter((i) => i.path === path);

describe("assets.json real", () => {
  it("es válido y conserva sus entradas originales sin migrar", () => {
    expect(Object.keys(realManifest.assets)).toHaveLength(100);
    expect(realManifest.assets["ui.panel.cream.nine-slice"].nineSlice).toEqual({ top: 32, right: 32, bottom: 32, left: 32 });
    expect(realManifest.assets["character.vanessa-jerry.walk.poses-v4"].requiresFrameDefinition).toBe(true);
    expect(realManifest).not.toHaveProperty("animations");
  });

  it("detecta assetCount y categoryCounts incoherentes", () => {
    const i = manifestIssues((m) => {
      m.assetCount = 44;
      m.categoryCounts.ui = 99;
    });
    expect(at(i, "assetCount")).toHaveLength(1);
    expect(at(i, "categoryCounts.ui")).toHaveLength(1);
  });

  it("rechaza paths absolutos o que salen del directorio del manifiesto", () => {
    const i = manifestIssues((m) => {
      m.assets["ui.icon.xp-star"].path = "/assets/ui/icons/xp-star.png";
      m.assets["ui.icon.open-book"].path = "../open-book.png";
    });
    expect(at(i, "assets.ui.icon.xp-star.path")).toHaveLength(1);
    expect(at(i, "assets.ui.icon.open-book.path")).toHaveLength(1);
  });

  it("valida la metadata especializada solo cuando está presente", () => {
    const i = manifestIssues((m) => {
      m.assets["character.vanessa-jerry.walk.poses-v4"].poseCount = 11;
      m.assets["ui.progress.xp.fill"].placement = { relativeTo: "ui.progress.no-existe", x: 16, y: 20 };
      m.assets["ui.icon.xp-star"].requiresFrameDefinition = true;
    });
    expect(at(i, "assets.character.vanessa-jerry.walk.poses-v4.poseCount")).toHaveLength(1);
    expect(at(i, "assets.ui.progress.xp.fill.placement.relativeTo")).toHaveLength(1);
    expect(at(i, "assets.ui.icon.xp-star.requiresFrameDefinition")).toHaveLength(1);
  });

  it("falla por forma si falta un campo común o un tipo es incorrecto", () => {
    const i = manifestIssues((m) => {
      delete (m.assets["ui.icon.xp-star"] as Partial<AssetManifest["assets"][string]>).path;
      (m.assets["ui.icon.open-book"] as Record<string, unknown>).width = -5;
    });
    expect(at(i, "assets.ui.icon.xp-star.path")).toHaveLength(1);
    expect(at(i, "assets.ui.icon.open-book.width")).toHaveLength(1);
  });

  it("conserva metadata desconocida en lugar de rechazarla", () => {
    const m = clone(manifestJson) as unknown as AssetManifest;
    m.assets["ui.icon.xp-star"].futureField = { a: 1 };
    const r = validateAssetManifest(m);
    expect(r.ok && r.value.assets["ui.icon.xp-star"].futureField).toEqual({ a: 1 });
  });
});

describe("bitacora.json: forma", () => {
  it.each([5, 6, 7])("acepta el fixture con %i aprendizajes con el mismo código", (n) => {
    expect(issuesOf(() => {}, undefined, n)).toEqual([]);
  });

  it("acepta modo final y ruta vacía (estado de preparación, no error)", () => {
    expect(issuesOf((c) => { c.mode = "final"; })).toEqual([]);
    expect(issuesOf((c) => { c.route = []; })).toEqual([]);
  });

  it("localiza propiedades obligatorias ausentes y sobrantes", () => {
    const i = issuesOf((c) => {
      delete (c.project as Partial<typeof c.project>).courseName;
      (c as unknown as Record<string, unknown>).totalStations = 6;
    });
    expect(at(i, "project.courseName")).toHaveLength(1);
    expect(at(i, "totalStations")).toHaveLength(1);
  });

  it("rechaza IDs repetidos en route y claves con formato inválido", () => {
    const i = issuesOf((c) => { c.route = ["apr-a", "apr-a"]; });
    expect(at(i, "route")).toHaveLength(1);
  });

  it("trata un tipo de bloque desconocido como error editorial, sin ejecutarlo", () => {
    const i = issuesOf((c) => {
      (c.learnings["apr-a"].sections.lived as unknown[]).push({ type: "script", text: "alert(1)" });
    });
    expect(i.some((x) => x.path.startsWith("learnings.apr-a.sections.lived[1]"))).toBe(true);
  });

  it("exige exactamente las tres secciones", () => {
    const i = issuesOf((c) => {
      delete (c.learnings["apr-a"].sections as Partial<typeof c.learnings["apr-a"]["sections"]>).lived;
    });
    expect(at(i, "learnings.apr-a.sections.lived")).toHaveLength(1);
  });

  it("el tipo BitacoraConfig y el esquema coinciden en las claves de nivel superior", () => {
    const typed: BitacoraConfig = makeConfig();
    expect(Object.keys(typed).sort()).toEqual([...bitacoraSchema.required].sort());
    const optional = Object.keys(bitacoraSchema.properties).filter((k) => !bitacoraSchema.required.includes(k));
    expect(optional.sort()).toEqual(["$schema", "editorNotes"]);
  });
});

describe("bitacora.json: referencias cruzadas", () => {
  it("ID de route sin learnings o sin placement", () => {
    const i = issuesOf((c) => {
      c.route.push("apr-x");
      delete c.placements["apr-b"];
    });
    expect(at(i, "route[6]")).toHaveLength(2);
    expect(at(i, "route[1]")).toHaveLength(1);
  });

  it("un aprendizaje archivado no necesita ubicación, pero sus referencias se validan", () => {
    const ok = issuesOf((c) => {
      c.learnings["apr-archivado"] = clone(c.learnings["apr-a"]);
      c.badges["insignia-archivada"] = clone(c.badges["insignia-apr-a"]);
      c.learnings["apr-archivado"].badgeId = "insignia-archivada";
    });
    expect(ok).toEqual([]);
    const bad = issuesOf((c) => {
      c.learnings["apr-archivado"] = clone(c.learnings["apr-a"]);
      c.learnings["apr-archivado"].badgeId = "no-existe";
    });
    expect(at(bad, "learnings.apr-archivado.badgeId")).toHaveLength(1);
  });

  it("assetId inexistente da error localizado con ruta", () => {
    const i = issuesOf((c) => {
      c.placements["apr-c"].decorationAssetId = "station.item.no-existe";
    });
    expect(at(i, "placements.apr-c.decorationAssetId")).toEqual([
      { path: "placements.apr-c.decorationAssetId", message: "asset ID no encontrado: «station.item.no-existe»" },
    ]);
  });

  it("assetId de otro kind o resuelto por nombre de archivo es incompatible", () => {
    const i = issuesOf((c) => {
      c.badges["insignia-apr-a"].assetId = "ui.panel.cream.small";
      c.placements["apr-a"].signAssetId = "ui.icon.xp-star";
      c.ui.assets.window = "ui.button.green.default";
    });
    expect(at(i, "badges.insignia-apr-a.assetId")).toHaveLength(1);
    expect(at(i, "placements.apr-a.signAssetId")).toHaveLength(1);
    expect(at(i, "ui.assets.window")).toHaveLength(1);
  });

  it("verifica assets de imágenes de evidencias y portadas de diálogo", () => {
    const i = issuesOf((c) => {
      c.learnings["apr-a"].sections.lived.push({ type: "image", assetId: "evidencia.falsa", alt: "x" });
      c.dialogues.abrir.lines[0].portraitAssetId = "character.fantasma";
    });
    expect(at(i, "learnings.apr-a.sections.lived[1].assetId")).toHaveLength(1);
    expect(at(i, "dialogues.abrir.lines[0].portraitAssetId")).toHaveLength(1);
  });

  it("cada aprendizaje activo necesita una insignia distinta", () => {
    const i = issuesOf((c) => { c.learnings["apr-b"].badgeId = c.learnings["apr-a"].badgeId; });
    expect(at(i, "learnings.apr-b.badgeId")).toHaveLength(1);
  });

  it("diálogos referenciados deben existir", () => {
    const i = issuesOf((c) => {
      c.ui.defaultDialogueIds.reward = "no-hay";
      c.learnings["apr-a"].dialogueOverrides = { open: "tampoco" };
    });
    expect(at(i, "ui.defaultDialogueIds.reward")).toHaveLength(1);
    expect(at(i, "learnings.apr-a.dialogueOverrides.open")).toHaveLength(1);
  });

  it("solo admite variables de diálogo de la lista permitida", () => {
    const i = issuesOf((c) => {
      c.dialogues.abrir.lines[0].text = "Hola {studentName} {secreto}";
      c.ui.labels.progressTemplate = "{number} de {totalCount}";
    });
    expect(at(i, "dialogues.abrir.lines[0].text")).toHaveLength(1);
    expect(at(i, "ui.labels.progressTemplate")).toHaveLength(1);
  });

  it("limita los protocolos de los enlaces de referencias", () => {
    const i = issuesOf((c) => {
      c.learnings["apr-a"].sections.lived.push(
        { type: "reference", label: "ok", url: "https://example.org/x" },
        { type: "reference", label: "mal", url: "javascript:alert(1)" },
        { type: "reference", label: "relativa", url: "/x" },
      );
    });
    expect(at(i, "learnings.apr-a.sections.lived[1].url")).toHaveLength(0);
    expect(at(i, "learnings.apr-a.sections.lived[2].url")).toHaveLength(1);
    expect(at(i, "learnings.apr-a.sections.lived[3].url")).toHaveLength(1);
  });

  it("las pestañas deben cubrir las tres secciones sin duplicados", () => {
    const i = issuesOf((c) => { c.ui.tabs[2].id = "reflection"; });
    expect(at(i, "ui.tabs")).toHaveLength(1);
  });
});

describe("bitacora.json: mapas, portales y accesibilidad", () => {
  it("ubicaciones: zona inexistente, fuera de la zona o interacción dentro de un obstáculo", () => {
    const i = issuesOf((c) => {
      c.placements["apr-a"].zoneId = "zona-z";
      c.placements["apr-b"].position = { x: 5000, y: 10 };
      c.placements["apr-c"].position = { x: 550, y: 100 };
      c.placements["apr-c"].interactionOffset = { x: 0, y: 40 };
    });
    expect(at(i, "placements.apr-a.zoneId")).toHaveLength(1);
    expect(at(i, "placements.apr-b.position")).toHaveLength(1);
    expect(at(i, "placements.apr-c.interactionOffset")).toHaveLength(1);
  });

  it("spawns válidos: dentro del mundo, fuera de obstáculos y con inicial existente", () => {
    const i = issuesOf((c) => {
      c.maps["zona-a"].spawns.inicio = { x: 520, y: 120 };
      c.maps["zona-b"].initialSpawnId = "no-existe";
      c.maps["zona-b"].spawns["desde-a"] = { x: -1, y: 5 };
    });
    expect(at(i, "maps.zona-a.spawns.inicio")).toHaveLength(1);
    expect(at(i, "maps.zona-b.initialSpawnId")).toHaveLength(1);
    expect(at(i, "maps.zona-b.spawns.desde-a")).toHaveLength(1);
  });

  it("portales: destino y punto de aparición reales, sin bucle a la misma zona", () => {
    const i = issuesOf((c) => {
      c.maps["zona-a"].portals["a-b"].targetSpawnId = "no-existe";
      c.maps["zona-b"].portals["b-a"].targetZoneId = "zona-b";
    });
    expect(at(i, "maps.zona-a.portals.a-b.targetSpawnId")).toHaveLength(1);
    expect(at(i, "maps.zona-b.portals.b-a.targetZoneId")).toHaveLength(1);
  });

  it("el punto de aparición de un portal no puede caer dentro del radio de otro portal (sin bucles)", () => {
    const i = issuesOf((c) => {
      c.maps["zona-b"].spawns["desde-a"] = { x: 150, y: 520 }; // sobre el portal «b-a» (150,520, radio 60)
    });
    expect(at(i, "maps.zona-a.portals.a-b.targetSpawnId")).toHaveLength(1);
    expect(issuesOf(() => {})).toEqual([]);
  });

  it("exige poder llegar a cada zona usada y regresar de ella", () => {
    const sinIda = issuesOf((c) => { c.maps["zona-a"].portals = {}; });
    expect(at(sinIda, "maps.zona-b")).toHaveLength(1);
    const sinRegreso = issuesOf((c) => { c.maps["zona-b"].portals = {}; });
    expect(at(sinRegreso, "maps.zona-b")).toHaveLength(1);
  });

  it("zona sin estaciones activas no exige portales", () => {
    const i = issuesOf((c) => {
      c.route = ["apr-a", "apr-b", "apr-c"];
      c.maps["zona-a"].portals = {};
      c.maps["zona-b"].portals = {};
    });
    expect(i).toEqual([]);
  });

  it("zona de partida inexistente", () => {
    const i = issuesOf((c) => { c.gameplay.start.zoneId = "zona-q"; });
    expect(at(i, "gameplay.start.zoneId")).toHaveLength(1);
  });
});

describe("bitacora.json: capas de fondo (SPEC 3.1)", () => {
  it("rechaza dos variantes de la misma capa", () => {
    const i = issuesOf((c) => {
      c.maps["zona-a"].layers.push({ assetId: "background.zone-01.midground.cherry-tree.v02", depth: 21 });
    });
    expect(at(i, "maps.zona-a.layers[4].assetId")).toHaveLength(1);
  });

  it("rechaza capas de zonas distintas del catálogo en un mismo mapa", () => {
    const i = issuesOf((c) => { c.maps["zona-a"].layers[0].assetId = "background.zone-02.horizon.v01"; });
    expect(at(i, "maps.zona-a.layers")).toHaveLength(1);
  });

  it("rechaza profundidades que contradicen horizon < terrain < midground < foreground", () => {
    const i = issuesOf((c) => { c.maps["zona-a"].layers[3].depth = 5; });
    expect(at(i, "maps.zona-a.layers").length).toBeGreaterThan(0);
  });

  it("un asset que no es capa no sirve de fondo", () => {
    const i = issuesOf((c) => { c.maps["zona-a"].layers[0].assetId = "station.item.books"; });
    expect(at(i, "maps.zona-a.layers[0].assetId")).toHaveLength(1);
  });

  it("permite el paisaje completo como alternativa explícita", () => {
    const i = issuesOf((c) => {
      c.maps["zona-a"].layers = [{ assetId: "background.complete.garden", depth: 0 }];
    });
    expect(i).toEqual([]);
  });
});

describe("bitacora.json: animaciones del paisaje (SPEC 3.2)", () => {
  const ripple = { type: "animation", assetId: "animation.water.ripples", position: { x: 500, y: 500 }, depth: { mode: "fixed", value: 11 } } as const;
  const sway = { type: "sway", assetId: "decoration.plant.bush", position: { x: 500, y: 500 }, depth: { mode: "y", offset: 0 } } as const;
  const drift = { type: "drift", assetId: "background.sky.cloud", position: { x: 500, y: 40 }, depth: { mode: "fixed", value: 5 } } as const;
  const rain = { type: "particles", assetId: "particle.petal", area: { x: 100, y: 100, width: 200, height: 100 }, frequencyMs: 500, depth: { mode: "fixed", value: 1500 } } as const;
  const withFx = (...fx: BitacoraConfig["maps"][string]["ambient"]) => (c: BitacoraConfig) => { c.maps["zona-a"].ambient = clone(fx); };

  it("acepta un efecto de cada tipo con su asset", () => {
    expect(issuesOf(withFx(ripple, sway, drift, rain))).toEqual([]);
  });

  it("rechaza un asset inexistente, nombrando su ID", () => {
    const i = issuesOf(withFx({ ...ripple, assetId: "animation.water.no-existe" }));
    expect(at(i, "maps.zona-a.ambient[0].assetId")[0]?.message).toContain("animation.water.no-existe");
  });

  it("rechaza un asset de otro tipo (kind) para el efecto", () => {
    expect(at(issuesOf(withFx({ ...ripple, assetId: "decoration.plant.bush" })), "maps.zona-a.ambient[0].assetId").length).toBeGreaterThan(0);
    expect(at(issuesOf(withFx({ ...sway, assetId: "animation.water.ripples" })), "maps.zona-a.ambient[0].assetId").length).toBeGreaterThan(0);
  });

  it("rechaza un movimiento que no corresponde al tipo (vaivén sobre una nube)", () => {
    const i = issuesOf(withFx({ ...sway, assetId: "background.sky.cloud" }));
    expect(at(i, "maps.zona-a.ambient[0].assetId").length + at(i, "maps.zona-a.ambient[0].type").length).toBeGreaterThan(0);
  });

  it("rechaza posiciones y áreas fuera de la zona", () => {
    expect(at(issuesOf(withFx({ ...ripple, position: { x: -5, y: 10 } })), "maps.zona-a.ambient[0].position")).toHaveLength(1);
    expect(at(issuesOf(withFx({ ...ripple, position: { x: 1449, y: 10 } })), "maps.zona-a.ambient[0].position")).toHaveLength(1);
    expect(at(issuesOf(withFx({ ...rain, area: { x: 1400, y: 100, width: 100, height: 50 } })), "maps.zona-a.ambient[0].area")).toHaveLength(1);
  });

  it("exige que el asset declare origin y recommendedScale", () => {
    const m = clone(manifestJson) as unknown as AssetManifest;
    delete (m.assets["background.sky.cloud"] as { origin?: unknown }).origin;
    const r = validateBitacora((() => { const c = makeConfig(); c.maps["zona-a"].ambient = [clone(drift)]; return c; })(), m);
    expect(r.ok).toBe(false);
  });

  const glow = { type: "glow", assetId: "decoration.light.warm-glow", position: { x: 500, y: 500 }, depth: { mode: "fixed", value: 54 } } as const;
  const swim = { type: "swim", assetId: "animation.fauna.white-duck-swim", path: [{ x: 100, y: 100 }, { x: 200, y: 100 }] as Array<{ x: number; y: number }>, depth: { mode: "y", offset: 0 } } as const;
  const lantern = { type: "sway", assetId: "decoration.light.hanging-lantern", position: { x: 500, y: 500 }, depth: { mode: "fixed", value: 52 } } as const;

  it("acepta luces (glow), un farol que se mece, patos (swim) y las nubes y partículas nuevas", () => {
    const extra = [
      { type: "drift", assetId: "background.sky.cloud-long", position: { x: 500, y: 40 }, depth: { mode: "fixed", value: 5 } },
      { type: "particles", assetId: "particle.firefly-mote", area: { x: 100, y: 100, width: 100, height: 50 }, frequencyMs: 700, depth: { mode: "fixed", value: 1500 } },
      { type: "animation", assetId: "animation.light.gold-sparkle", position: { x: 300, y: 300 }, depth: { mode: "fixed", value: 60 } },
    ] as const;
    expect(issuesOf(withFx(glow, swim, lantern, ...extra))).toEqual([]);
  });

  it("glow exige una luz con pulso; swim exige un pato con motion swim y una trayectoria dentro de la zona", () => {
    expect(at(issuesOf(withFx({ ...glow, assetId: "decoration.light.hanging-lantern" })), "maps.zona-a.ambient[0].assetId").length).toBeGreaterThan(0);
    expect(at(issuesOf(withFx({ ...swim, assetId: "animation.water.ripples" })), "maps.zona-a.ambient[0].type").length).toBeGreaterThan(0);
    expect(at(issuesOf(withFx({ ...swim, path: [{ x: 100, y: 100 }, { x: 5000, y: 100 }] })), "maps.zona-a.ambient[0].path[1]")).toHaveLength(1);
    expect(at(issuesOf(withFx({ ...ripple, assetId: "animation.fauna.white-duck-swim" })), "maps.zona-a.ambient[0].type")).toHaveLength(1);
  });

  it("acepta flora animada con velocidad propia (speedFactor) y rechaza una velocidad no positiva", () => {
    const flora = { type: "animation", assetId: "animation.flora.sunflowers", position: { x: 500, y: 500 }, speedFactor: 1.3, depth: { mode: "y", offset: 0 } } as const;
    expect(issuesOf(withFx(flora))).toEqual([]);
    expect(issuesOf(withFx({ ...flora, speedFactor: 0 })).length).toBeGreaterThan(0);
    expect(issuesOf(withFx({ ...flora, speedFactor: -1 })).length).toBeGreaterThan(0);
  });

  it("limita los efectos por zona (presupuesto de rendimiento, AC-57)", () => {
    const many = Array.from({ length: 61 }, (_, i) => ({ ...ripple, position: { x: 10 + i, y: 10 } }));
    const i = issuesOf(withFx(...many));
    expect(at(i, "maps.zona-a.ambient")[0]?.message).toContain("el máximo por zona es 60");
    expect(at(issuesOf(withFx(...many.slice(0, 60))), "maps.zona-a.ambient")).toHaveLength(0);
  });

  it("el esquema exige al menos dos puntos en la trayectoria y un alpha entre 0 y 1", () => {
    expect(issuesOf(withFx({ ...swim, path: [{ x: 1, y: 1 }] } as never)).length).toBeGreaterThan(0);
    expect(issuesOf(withFx({ ...glow, alpha: 2 } as never)).length).toBeGreaterThan(0);
  });

  it("el esquema exige la lista ambient en cada zona", () => {
    const c = makeConfig() as unknown as { maps: Record<string, Record<string, unknown>> };
    delete c.maps["zona-a"].ambient;
    expect(validateBitacora(c, realManifest).ok).toBe(false);
  });
});

describe("bitacora.json: personajes y frames (AC-35)", () => {
  it("una hoja de poses con requiresFrameDefinition no sirve como sprite sin frames validados", () => {
    const i = issuesOf((c) => { c.gameplay.player.assetId = "character.vanessa-jerry.walk.poses-v4"; });
    expect(at(i, "gameplay.player.assetId")).toHaveLength(1);
  });

  it("una animación declarada exige una definición de frames validada", () => {
    const edit = (c: BitacoraConfig) => { c.gameplay.player.animations = { idle: "vanessa-idle" }; };
    expect(at(issuesOf(edit), "gameplay.player.animations.idle")).toHaveLength(1);
    const withFrames: ValidateOptions = {
      frameDefinitions: { "character.vanessa-jerry.idle": { animations: ["vanessa-idle"] } },
    };
    expect(issuesOf(edit, withFrames)).toEqual([]);
  });

  it("la hoja de poses sí es válida cuando tiene definición de frames", () => {
    const edit = (c: BitacoraConfig) => {
      c.gameplay.player.assetId = "character.vanessa-jerry.walk.poses-v4";
      c.gameplay.player.animations = { walkDown: "walk-down" };
      c.gameplay.companion = { mode: "included", followDistance: 0 };
    };
    const opts: ValidateOptions = {
      frameDefinitions: { "character.vanessa-jerry.walk.poses-v4": { animations: ["walk-down"] } },
    };
    expect(issuesOf(edit, opts)).toEqual([]);
  });

  it("companion separate exige actor; included no admite otro perro", () => {
    const sin = issuesOf((c) => { c.gameplay.companion = { mode: "separate", followDistance: 30 }; });
    expect(at(sin, "gameplay.companion.actor")).toHaveLength(1);
    const doble = issuesOf((c) => {
      c.gameplay.companion = {
        mode: "included",
        followDistance: 0,
        actor: { assetId: "character.vanessa-jerry.idle", origin: { x: 0.5, y: 1 }, scale: 0.1, animations: {} },
      };
    });
    expect(at(doble, "gameplay.companion.actor")).toHaveLength(1);
  });
});

describe("bitacora.json: orden por route", () => {
  it("el orden de las claves de learnings no importa; learningId es estable", () => {
    const c = makeConfig(5);
    c.learnings = Object.fromEntries(Object.entries(c.learnings).reverse());
    expect(validateBitacora(c, realManifest).ok).toBe(true);
    expect(c.route[2]).toBe(learningId(2));
  });
});

describe("bitacora.json: música de fondo (SPEC 6.4; AC-53)", () => {
  const MUSIC = ["audio.music.beyond-the-clouds", "audio.music.enchanted-festival", "audio.music.little-town-orchestral"];
  const music = (c: BitacoraConfig) => c.audio.music;

  it("el fixture con las tres pistas es válido", () => {
    expect(issuesOf(() => undefined)).toEqual([]);
  });

  it("rechaza un ID inexistente, una imagen como pista y una pista repetida", () => {
    expect(at(issuesOf((c) => { music(c).tracks = [MUSIC[0], "audio.music.no-existe"]; }), "audio.music.tracks[1]")[0]?.message).toContain("audio.music.no-existe");
    expect(at(issuesOf((c) => { music(c).tracks = ["station.item.books"]; }), "audio.music.tracks[0]").length).toBeGreaterThan(0);
    expect(at(issuesOf((c) => { music(c).tracks = [MUSIC[0], MUSIC[0]]; }), "audio.music.tracks[1]")[0]?.message).toContain("repetida");
  });

  it("rechaza volumen fuera de rango, rotación desconocida y fundido imposible", () => {
    expect(issuesOf((c) => { music(c).volume = 1.5; }).length).toBeGreaterThan(0);
    expect(issuesOf((c) => { (music(c) as { rotation: string }).rotation = "aleatorio"; }).length).toBeGreaterThan(0);
    expect(at(issuesOf((c) => { music(c).crossfadeMs = 70_000; }), "audio.music.crossfadeMs")).toHaveLength(1);
    expect(at(issuesOf((c) => { music(c).crossfadeMs = 60_000; }), "audio.music.crossfadeMs")).toHaveLength(0);
  });

  it("una lista vacía solo es válida con la música desactivada", () => {
    expect(at(issuesOf((c) => { music(c).tracks = []; }), "audio.music.tracks")).toHaveLength(1);
    expect(issuesOf((c) => { music(c).tracks = []; music(c).active = false; })).toEqual([]);
  });

  it("la sección audio y las etiquetas del botón son obligatorias", () => {
    const c = makeConfig() as unknown as Record<string, unknown>;
    delete c.audio;
    expect(validateBitacora(c, realManifest).ok).toBe(false);
    const d = makeConfig() as unknown as { ui: { labels: Record<string, unknown> } };
    delete d.ui.labels.musicMute;
    expect(validateBitacora(d, realManifest).ok).toBe(false);
  });
});

describe("bitacora.json: reposo de Vanessa y Jerry (SPEC 6.2; AC-62)", () => {
  const IDLE = { rest: "character.vanessa-jerry.idle-anim.rest", glance: "character.vanessa-jerry.idle-anim.look", play: "character.vanessa-jerry.idle-anim.play", glanceAfterMs: 4500, playAfterMs: 10000, gestureCooldownMs: 8000 };
  const withIdle = (idle: Partial<typeof IDLE> | undefined) => (c: BitacoraConfig) => { c.gameplay.player.idle = idle === undefined ? undefined : { ...IDLE, ...idle }; };

  it("es opcional y con las tres hojas del kit es válido", () => {
    expect(issuesOf(withIdle(undefined))).toEqual([]);
    expect(issuesOf(withIdle({}))).toEqual([]);
  });

  it("rechaza un asset inexistente o que no es una hoja de reposo, con su ruta", () => {
    expect(at(issuesOf(withIdle({ rest: "character.vanessa-jerry.no-existe" })), "gameplay.player.idle.rest")[0]?.message).toContain("no-existe");
    expect(at(issuesOf(withIdle({ glance: "character.vanessa-jerry.idle" })), "gameplay.player.idle.glance")[0]?.message).toContain("idle-sheet");
  });

  it("el reposo y la mirada exigen las cuatro direcciones; el juego, una de frente", () => {
    const m = structuredClone(manifestJson) as unknown as AssetManifest;
    m.assets["character.vanessa-jerry.idle-anim.rest"].animations = m.assets["character.vanessa-jerry.idle-anim.rest"].animations!.filter((a) => a.direction !== "back");
    m.assets["character.vanessa-jerry.idle-anim.play"].animations![0].direction = "left";
    const c = makeConfig();
    c.gameplay.player.idle = { ...IDLE };
    const r = validateBitacora(c, m);
    const issues = r.ok ? [] : r.issues;
    expect(at(issues, "gameplay.player.idle.rest")[0]?.message).toContain("back");
    expect(at(issues, "gameplay.player.idle.play")[0]?.message).toContain("de frente");
  });

  it("los tiempos: positivos, el juego no antes que la mirada y la pausa puede ser cero", () => {
    expect(at(issuesOf(withIdle({ playAfterMs: 1000 })), "gameplay.player.idle.playAfterMs")).toHaveLength(1);
    expect(issuesOf(withIdle({ glanceAfterMs: 0 })).length).toBeGreaterThan(0);
    expect(issuesOf(withIdle({ gestureCooldownMs: -1 })).length).toBeGreaterThan(0);
    expect(issuesOf(withIdle({ gestureCooldownMs: 0 }))).toEqual([]);
  });

  it("el esquema exige todos los campos del reposo", () => {
    const c = makeConfig();
    c.gameplay.player.idle = { ...IDLE };
    delete (c.gameplay.player.idle as Partial<typeof IDLE>).play;
    expect(validateBitacora(c, realManifest).ok).toBe(false);
  });

  describe("jugar con Jerry: trucos, búsqueda del peluche y tecla", () => {
    const TRICKS = { sheet: "character.vanessa-jerry.idle-anim.tricks" };
    const FETCH = { sheet: "character.vanessa-jerry.idle-anim.fetch", holdMs: 2200 };
    const withExtras = (extra: Partial<NonNullable<BitacoraConfig["gameplay"]["player"]["idle"]>>) => (c: BitacoraConfig) => { c.gameplay.player.idle = { ...IDLE, ...extra }; };

    it("son opcionales y, con las hojas del kit y la tecla, válidos", () => {
      expect(issuesOf(withExtras({ tricks: TRICKS, fetch: FETCH, actionKey: "P" }))).toEqual([]);
      expect(issuesOf(withExtras({ tricks: TRICKS, actionKey: "P" }))).toEqual([]);
      expect(issuesOf(withExtras({ fetch: FETCH, actionKey: "P" }))).toEqual([]);
    });

    it("la tecla es obligatoria si hay alguna acción", () => {
      expect(at(issuesOf(withExtras({ tricks: TRICKS })), "gameplay.player.idle.actionKey")).toHaveLength(1);
      expect(at(issuesOf(withExtras({ fetch: FETCH })), "gameplay.player.idle.actionKey")).toHaveLength(1);
    });

    it("rechazan un asset inexistente, de otro kind o sin la secuencia completa", () => {
      expect(at(issuesOf(withExtras({ tricks: { sheet: "character.vanessa-jerry.no-existe" }, actionKey: "P" })), "gameplay.player.idle.tricks.sheet")[0]?.message).toContain("no-existe");
      expect(at(issuesOf(withExtras({ fetch: { ...FETCH, sheet: "character.vanessa-jerry.idle" }, actionKey: "P" })), "gameplay.player.idle.fetch.sheet")[0]?.message).toContain("idle-sheet");
      const m = structuredClone(manifestJson) as unknown as AssetManifest;
      m.assets["character.vanessa-jerry.idle-anim.tricks"].animations![0].frameNames.pop();
      const c = makeConfig();
      c.gameplay.player.idle = { ...IDLE, tricks: TRICKS, actionKey: "P" };
      const r = validateBitacora(c, m);
      expect(at(r.ok ? [] : r.issues, "gameplay.player.idle.tricks.sheet").length).toBeGreaterThan(0);
    });

    it("la tecla es una sola letra mayúscula y la espera de la búsqueda no es negativa", () => {
      for (const actionKey of ["p", "PP", "1", "", "Enter"]) expect(issuesOf(withExtras({ fetch: FETCH, actionKey })).length, actionKey).toBeGreaterThan(0);
      expect(issuesOf(withExtras({ fetch: { ...FETCH, holdMs: 0 }, actionKey: "P" }))).toEqual([]);
      expect(issuesOf(withExtras({ fetch: { ...FETCH, holdMs: -1 }, actionKey: "P" })).length).toBeGreaterThan(0);
    });

    it("el kit real trae las dos acciones y la tecla P", () => {
      const idle = (bitacoraJson as unknown as BitacoraConfig).gameplay.player.idle!;
      expect(idle.actionKey).toBe("P");
      expect(idle.tricks?.sheet).toBe("character.vanessa-jerry.idle-anim.tricks");
      expect(idle.fetch?.sheet).toBe("character.vanessa-jerry.idle-anim.fetch");
    });
  });
});

describe("bitacora.json: efectos de las estaciones y panel de la cabecera (AC-68 a AC-70)", () => {
  const ui = (edit: (a: BitacoraConfig["ui"]["assets"]) => void) => (c: BitacoraConfig) => edit(c.ui.assets);

  it("son opcionales: sin ellos el fixture sigue siendo válido", () => {
    expect(issuesOf(ui((a) => { delete a.xpStarEffect; delete a.nextStationGlow; delete a.statusPanel; delete a.avatarAnimations; }))).toEqual([]);
  });

  it("con los assets del catálogo son válidos", () => {
    expect(issuesOf(ui((a) => { a.xpStarEffect = "effect.xp-star.complete"; a.nextStationGlow = "effect.player-glow.next-station"; a.statusPanel = "ui.panel.player-status.default"; a.avatarAnimations = "character.vanessa-jerry.avatar.animations"; }))).toEqual([]);
  });

  it("rechazan un asset inexistente o de otro tipo, con su ruta", () => {
    expect(at(issuesOf(ui((a) => { a.xpStarEffect = "effect.xp-star.no-existe"; })), "ui.assets.xpStarEffect")[0]?.message).toContain("no-existe");
    expect(at(issuesOf(ui((a) => { a.nextStationGlow = "ui.panel.player-status.default"; })), "ui.assets.nextStationGlow")[0]?.message).toContain("animation-sheet");
    expect(at(issuesOf(ui((a) => { a.statusPanel = "effect.xp-star.complete"; })), "ui.assets.statusPanel")[0]?.message).toContain("panel");
    expect(at(issuesOf(ui((a) => { a.avatarAnimations = "character.vanessa-jerry.avatar"; })), "ui.assets.avatarAnimations")[0]?.message).toContain("avatar-sheet");
  });

  it("el bitacora.json real los referencia", () => {
    const a = (bitacoraJson as unknown as BitacoraConfig).ui.assets;
    expect([a.xpStarEffect, a.nextStationGlow, a.statusPanel, a.avatarAnimations, a.portrait]).toEqual(["effect.xp-star.complete", "effect.station-glow.pulse", "ui.panel.player-status.default", "character.vanessa-jerry.avatar.animations", "character.vanessa-jerry.avatar"]);
  });
});


describe("bitacora.json: identidad de las estaciones, assets de interfaz y sombras (AC-72, AC-73)", () => {
  const real = bitacoraJson as unknown as BitacoraConfig;
  const ui = (edit: (a: BitacoraConfig["ui"]["assets"]) => void) => (c: BitacoraConfig) => edit(c.ui.assets);

  it("cada aprendizaje de la ruta lleva un título corto de letrero (hasta 40 caracteres) y el letrero trae las zonas de texto", () => {
    for (const id of real.route) {
      const l = real.learnings[id];
      expect(l.signTitle?.length, id).toBeGreaterThan(0);
      expect(l.signTitle!.length, id).toBeLessThanOrEqual(40);
    }
    expect(real.learnings["apr-a"].signTitle).toBe("Plantas y semillas");
    expect(realManifest.assets[real.ui.assets.stationSign].labelZones).toHaveProperty("title");
  });

  it("el título es opcional y el esquema rechaza uno vacío o de más de 40 caracteres", () => {
    expect(issuesOf((c) => { delete c.learnings["apr-a"].signTitle; })).toEqual([]);
    expect(issuesOf((c) => { c.learnings["apr-a"].signTitle = ""; }).length).toBeGreaterThan(0);
    expect(issuesOf((c) => { c.learnings["apr-a"].signTitle = "x".repeat(41); }).length).toBeGreaterThan(0);
  });

  it("el bitacora.json real referencia los assets del paquete de interfaz", () => {
    const a = real.ui.assets;
    expect([a.stationSign, a.listButton, a.jerryButton, a.musicButton, a.musicMutedButton, a.completedBadge, a.exitSign, a.stationSparkle, a.nextStationGlow]).toEqual([
      "station.sign.board", "ui.button.journal.labeled", "ui.button.jerry.labeled", "ui.button.sound-on.labeled", "ui.button.sound-off.labeled",
      "ui.badge.completed-pill", "map.sign.exit-right", "animation.light.gold-sparkle", "effect.station-glow.pulse",
    ]);
  });

  it("los assets opcionales de interfaz deben existir y ser del kind que se espera", () => {
    expect(issuesOf(ui((a) => { delete a.musicMutedButton; delete a.completedBadge; delete a.exitSign; delete a.stationSparkle; }))).toEqual([]);
    expect(at(issuesOf(ui((a) => { a.exitSign = "map.sign.no-existe"; })), "ui.assets.exitSign")).toHaveLength(1);
    expect(at(issuesOf(ui((a) => { a.completedBadge = "ui.button.journal.labeled"; })), "ui.assets.completedBadge")[0]?.message).toContain("status-pill");
    expect(at(issuesOf(ui((a) => { a.musicMutedButton = "ui.badge.completed-pill"; })), "ui.assets.musicMutedButton")[0]?.message).toContain("button");
    expect(at(issuesOf(ui((a) => { a.stationSparkle = "ui.badge.completed-pill"; })), "ui.assets.stationSparkle")[0]?.message).toContain("animation-sheet");
    expect(issuesOf(ui((a) => { a.stationSparkle = "animation.light.gold-sparkle"; }))).toEqual([]);
  });

  it("la sombra de Vanessa y Jerry es opcional y admite opacidad, ancho y proporción válidos", () => {
    expect(real.gameplay.player.shadow).toMatchObject({ alpha: 0.4 });
    expect(issuesOf((c) => { delete c.gameplay.player.shadow; })).toEqual([]);
    expect(issuesOf((c) => { c.gameplay.player.shadow = { alpha: 0.4, widthFactor: 1.4, aspect: 0.36 }; })).toEqual([]);
    expect(issuesOf((c) => { c.gameplay.player.shadow = { alpha: 0, widthFactor: 1.4, aspect: 0.36 }; }).length).toBeGreaterThan(0);
    expect(issuesOf((c) => { c.gameplay.player.shadow = { alpha: 0.4, widthFactor: 1.4, aspect: 2 }; }).length).toBeGreaterThan(0);
  });
});
