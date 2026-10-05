import { describe, expect, it } from "vitest";
import manifestJson from "../../public/assets/assets.json";
import bitacoraJson from "./fixtures/realConfig";
import { findAnimation, frameDefinitions, toValidatedFrames } from "../assets/frameDefinitions";
import { checkAmbientPlacement, checkWorldReachability } from "../config/reachability";
import { validateAssetManifest } from "../config/validateAssets";
import { formatIssues, validateBitacora } from "../config/validateConfig";
import type { BitacoraConfig } from "../config/types";
import { makeConfig } from "./fixtures/makeConfig";

const manifest = (() => {
  const r = validateAssetManifest(manifestJson);
  if (!r.ok) throw new Error(formatIssues(r.issues));
  return r.value;
})();

const result = validateBitacora(bitacoraJson, manifest, { frameDefinitions: toValidatedFrames() });

describe("public/config/bitacora.json (configuración inicial)", () => {
  it("es válido contra el esquema y el assets.json real", () => {
    expect(result.ok ? "" : formatIssues(result.issues)).toBe("");
  });

  const c = (result.ok ? result.value : undefined) as BitacoraConfig;

  it("AC-01: precarga los datos académicos confirmados y omite la docente", () => {
    expect(c.project).toMatchObject({
      studentName: "Vanessa Estrada",
      university: "Universidad de Antioquia",
      program: "Licenciatura en Educación Infantil",
      semester: "2026 - 2",
      courseName: "Desarrollo de la actitud científica en la infancia",
      teacherName: null,
      finalReflection: [],
    });
  });

  it("define seis aprendizajes en dos zonas, con el orden solo en route", () => {
    expect(c.route).toHaveLength(6);
    expect(new Set(c.route.map((id) => c.placements[id].zoneId))).toEqual(new Set(["zona-a", "zona-b"]));
    expect(Object.keys(c.maps)).toHaveLength(2);
    // `enabled` es del contrato de los emisores de sonido (apagar uno sin borrarlo), no de la ruta: se revisa fuera de `sounds`.
    const withoutSounds = JSON.stringify(c, (key, value) => (key === "sounds" ? undefined : value));
    for (const forbidden of ["order", "nextLearningId", "totalStations", "enabled"]) {
      expect(withoutSounds).not.toContain(`"${forbidden}"`);
    }
  });

  it("usa 100 XP por estación: 600 XP en total", () => {
    expect(c.route.map((id) => c.badges[c.learnings[id].badgeId].xp).reduce((a, b) => a + b, 0)).toBe(600);
  });

  it("carga los seis aprendizajes de Vanessa, revisados y aprobados por ella: modo final con todos en `ready`", () => {
    expect(c.mode).toBe("final");
    expect(c.route.map((id) => c.learnings[id].title)).toEqual([
      "Las plantas y las semillas", "La plastilina casera", "El museo y la taxidermia",
      "Pingüinos: cómo se adaptan los seres vivos", "La Tierra y sus movimientos", "Plantas: su origen",
    ]);
    for (const id of c.route) {
      const l = c.learnings[id];
      expect(l.editorialStatus, id).toBe("ready");
      expect(Object.keys(l.sections).sort(), id).toEqual(["learning", "lived", "reflection"]);
      for (const blocks of Object.values(l.sections)) {
        expect(blocks.length, id).toBeGreaterThan(0);
        for (const b of blocks) expect(b.type === "paragraph" && b.text.trim().length > 20 && !b.text.includes("**"), id).toBe(true);
      }
      expect(JSON.stringify(l.sections), id).not.toContain("Contenido de demostración");
    }
    expect(c.editorNotes).toContain("PROVISIONALES"); // la geometría sigue marcada como provisional hasta que la autora la confirme
  });

  it("cada aprendizaje tiene un título corto de letrero que cabe (hasta 40 caracteres)", () => {
    for (const id of c.route) {
      const t = c.learnings[id].signTitle as string;
      expect(t.length, id).toBeGreaterThan(0);
      expect(t.length, id).toBeLessThanOrEqual(40);
    }
  });

  it("no incrusta rutas físicas ni metadata del manifiesto", () => {
    const text = JSON.stringify(c);
    expect(text).not.toMatch(/\.png|\.jpg|sha256|sizeBytes|originalPath/);
  });

  it("usa una sola variante por capa y no sobrepone todas las variantes", () => {
    for (const zone of Object.values(c.maps)) {
      const roles = zone.layers.map((l) => manifest.assets[l.assetId].layer);
      expect(new Set(roles).size).toBe(roles.length);
      expect(zone.layers).toHaveLength(4);
    }
  });

  it("el personaje usa la hoja de poses solo con frames validados contra la imagen (AC-35)", () => {
    const player = c.gameplay.player;
    expect(manifest.assets[player.assetId].requiresFrameDefinition).toBe(true);
    expect(frameDefinitions[player.assetId]).toBeDefined();
    for (const [name, animId] of Object.entries(player.animations)) {
      // La celebración vive en otra hoja de poses del mismo personaje, también con frames validados.
      const owner = name === "celebrate" ? findAnimation(animId as string)?.sheet : frameDefinitions[player.assetId];
      expect(owner?.animations[animId as string], `${name}: ${animId}`).toBeDefined();
    }
    expect(manifest.assets[findAnimation(player.animations.celebrate as string)!.sheet.assetId].requiresFrameDefinition).toBe(true);
    expect(Object.keys(player.animations).sort()).toEqual(["celebrate", "idle", "walkDown", "walkLeft", "walkRight", "walkUp"]);
    expect(c.gameplay.companion.mode).toBe("included"); // la hoja ya incluye a Jerry
  });

  it("todas las estaciones, portales y spawns son alcanzables con el cuerpo real de Vanessa", () => {
    expect(formatIssues(checkWorldReachability(c))).toBe("");
  });
});

describe("checkWorldReachability", () => {
  it("el fixture sin obstáculos relevantes es alcanzable", () => {
    expect(checkWorldReachability(makeConfig())).toEqual([]);
  });

  it("detecta una estación encerrada por obstáculos", () => {
    const cfg = makeConfig();
    const p = cfg.placements["apr-a"];
    const cx = p.position.x + p.interactionOffset.x;
    const cy = p.position.y + p.interactionOffset.y;
    cfg.maps["zona-a"].obstacles.push({ type: "rect", x: cx - 200, y: cy - 200, width: 400, height: 400 });
    cfg.maps["zona-a"].obstacles.push({ type: "rect", x: cx - 100, y: cy - 100, width: 5, height: 5 }); // hueco irrelevante
    const issues = checkWorldReachability(cfg);
    expect(issues.map((i) => i.path)).toContain("placements.apr-a.interactionRadius");
  });

  it("detecta un portal separado del spawn por un muro completo", () => {
    const cfg = makeConfig();
    cfg.maps["zona-a"].obstacles.push({ type: "rect", x: 1000, y: 0, width: 30, height: 1086 });
    const paths = checkWorldReachability(cfg).map((i) => i.path);
    expect(paths).toContain("maps.zona-a.portals.a-b.interaction");
    expect(paths).toContain("maps.zona-a.spawns.desde-b");
  });

  it("un pasillo más estrecho que el cuerpo no cuenta como transitable", () => {
    const cfg = makeConfig();
    const gap = 6; // el diámetro del cuerpo es mayor que 6 px
    cfg.maps["zona-a"].obstacles.push(
      { type: "rect", x: 1000, y: 0, width: 30, height: 500 },
      { type: "rect", x: 1000, y: 500 + gap, width: 30, height: 1086 - 500 - gap },
    );
    expect(checkWorldReachability(cfg).map((i) => i.path)).toContain("maps.zona-a.portals.a-b.interaction");
  });
});

describe("checkAmbientPlacement (AC-45)", () => {
  const sway = { type: "sway", assetId: "decoration.plant.bush", position: { x: 500, y: 500 }, depth: { mode: "y", offset: 0 } } as const;

  it("detecta un vaivén o una animación sobre suelo transitable", () => {
    const cfg = makeConfig();
    cfg.maps["zona-a"].ambient = [structuredClone(sway), { ...structuredClone(sway), type: "sway" }];
    const paths = checkAmbientPlacement(cfg).map((i) => i.path);
    expect(paths).toEqual(["maps.zona-a.ambient[0].position", "maps.zona-a.ambient[1].position"]);
  });

  it("acepta la pieza si queda sobre un obstáculo", () => {
    const cfg = makeConfig();
    cfg.maps["zona-a"].obstacles.push({ type: "rect", x: 450, y: 450, width: 100, height: 100 });
    cfg.maps["zona-a"].ambient = [structuredClone(sway)];
    expect(checkAmbientPlacement(cfg)).toEqual([]);
  });

  it("detecta una trayectoria de pato que cruza suelo transitable y nombra el punto", () => {
    const cfg = makeConfig();
    cfg.maps["zona-a"].obstacles.push({ type: "rect", x: 300, y: 400, width: 100, height: 100 });
    cfg.maps["zona-a"].ambient = [{ type: "swim", assetId: "animation.fauna.duckling-swim", path: [{ x: 320, y: 450 }, { x: 380, y: 450 }, { x: 700, y: 450 }], depth: { mode: "y", offset: 0 } }];
    const issues = checkAmbientPlacement(cfg);
    expect(issues.map((i) => i.path)).toEqual(["maps.zona-a.ambient[0].path[1]"]);
    expect(issues[0].message).toContain("cruza suelo transitable");
  });

  it("acepta una trayectoria que queda toda sobre obstáculos", () => {
    const cfg = makeConfig();
    cfg.maps["zona-a"].obstacles.push({ type: "rect", x: 300, y: 400, width: 300, height: 100 });
    cfg.maps["zona-a"].ambient = [{ type: "swim", assetId: "animation.fauna.duckling-swim", path: [{ x: 320, y: 450 }, { x: 580, y: 450 }], depth: { mode: "y", offset: 0 } }];
    expect(checkAmbientPlacement(cfg)).toEqual([]);
  });

  it("no comprueba nubes, luces ni partículas: pasan por encima del escenario", () => {
    const cfg = makeConfig();
    cfg.maps["zona-a"].ambient = [
      { type: "drift", assetId: "background.sky.cloud", position: { x: 500, y: 500 }, depth: { mode: "fixed", value: 5 } },
      { type: "particles", assetId: "particle.petal", area: { x: 400, y: 400, width: 100, height: 100 }, frequencyMs: 500, depth: { mode: "fixed", value: 1500 } },
      { type: "glow", assetId: "decoration.light.warm-glow", position: { x: 500, y: 500 }, depth: { mode: "fixed", value: 54 } },
    ];
    expect(checkAmbientPlacement(cfg)).toEqual([]);
  });

  it("el bitacora.json real coloca animaciones y plantas fuera del camino", () => {
    const real = (result.ok ? result.value : undefined) as BitacoraConfig;
    expect(formatIssues(checkAmbientPlacement(real))).toBe("");
    for (const zone of Object.values(real.maps)) {
      const tipos = new Set(zone.ambient.map((fx) => fx.type));
      expect([...tipos].sort()).toEqual(["animation", "drift", "glow", "particles", "sway", "swim"]);
    }
  });
});
