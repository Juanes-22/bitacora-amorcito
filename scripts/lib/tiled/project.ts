import type { AssetManifest } from "../../../src/config/types";
import { critterIds, idsByAmbientKind } from "./catalog";
import type { ProjectClass, ProjectEnum, ProjectMember, ProjectPropertyType, TiledProject } from "./types";
import { isRecord, type PropMap } from "./util";

// Clases y enums del proyecto de Tiled: lo que hace reconocibles los objetos (Station, Ambient, Critter…) y da a cada uno
// sus propiedades con valores por defecto. El importador lee estos mismos valores por defecto como último eslabón de la
// precedencia (clase < tile < objeto), de modo que no depende de ninguna opción de exportación de Tiled.

const str = (name: string, value = ""): ProjectMember => ({ name, type: "string", value });
const num = (name: string, value: number): ProjectMember => ({ name, type: "float", value });
const int = (name: string, value: number): ProjectMember => ({ name, type: "int", value });
const en = (name: string, propertyType: string, value: string): ProjectMember => ({ name, type: "string", propertyType, value });

export const CLASS_NAMES = ["Station", "Decoration", "Ambient", "Critter", "Particles", "Swim", "Collision", "Spawn", "Portal", "EditorOnly", "Zone", "BackgroundLayer"] as const;
export const ENUM_NAMES = ["DepthMode", "AmbientType", "CritterType", "ParticleAsset", "SwimAsset", "CritterAsset"] as const;

const depth = (mode: "fixed" | "y", value: number): ProjectMember[] => [en("depthMode", "DepthMode", mode), num("depth", value)];

/** Definiciones que genera la integración. Los enums de assets salen del manifiesto. */
export function projectTypes(manifest: AssetManifest): { enums: Array<Omit<ProjectEnum, "id">>; classes: Array<Omit<ProjectClass, "id">> } {
  const particles = idsByAmbientKind(manifest, "particles");
  const swimmers = idsByAmbientKind(manifest, "swim");
  const critters = critterIds(manifest);
  const enumOf = (name: string, values: string[]): Omit<ProjectEnum, "id"> => ({ name, type: "enum", storageType: "string", values, valuesAsFlags: false });
  const first = (list: string[]) => list[0] ?? "";
  const cls = (name: string, color: string, members: ProjectMember[], useAs: string[]): Omit<ProjectClass, "id"> => ({ name, type: "class", color, drawFill: true, members, useAs });
  return {
    enums: [
      enumOf("DepthMode", ["fixed", "y"]),
      enumOf("AmbientType", ["animation", "sway", "drift", "glow"]),
      enumOf("CritterType", ["wander", "family"]),
      enumOf("ParticleAsset", particles),
      enumOf("SwimAsset", swimmers),
      enumOf("CritterAsset", critters),
    ],
    classes: [
      cls("Station", "#ffe0a03c", [str("learningId"), num("interactionOffsetX", 0), num("interactionOffsetY", 0), num("interactionRadius", 70)], ["object", "tile"]),
      cls("Decoration", "#ff6aa84f", [str("assetId"), num("originX", 0.5), num("originY", 1), ...depth("y", 0)], ["object", "tile"]),
      cls("Ambient", "#ff4a90d9", [str("assetId"), en("ambientType", "AmbientType", "animation"), ...depth("y", 0)], ["object", "tile"]),
      cls("Critter", "#ffd98a4a", [str("assetId"), en("critterType", "CritterType", "wander"), num("radius", 24), en("chickAssetId", "CritterAsset", critters.find((id) => id.includes("chick")) ?? first(critters)), int("chicks", 0)], ["object", "tile"]),
      cls("Particles", "#ffb06ad9", [en("assetId", "ParticleAsset", first(particles)), int("frequencyMs", 700), ...depth("fixed", 1500)], ["object"]),
      cls("Swim", "#ff3fb8b8", [en("assetId", "SwimAsset", first(swimmers)), ...depth("y", 0)], ["object"]),
      cls("Collision", "#ffd9453f", [], ["object"]),
      cls("Spawn", "#ff3fd96a", [str("spawnId")], ["object"]),
      cls("Portal", "#ffd9d93f", [str("portalId"), str("label"), str("targetZoneId"), str("targetSpawnId")], ["object"]),
      cls("EditorOnly", "#ff9e9e9e", [], ["object", "layer"]),
      cls("Zone", "#ff6a6ad9", [str("zoneId"), str("label"), str("initialSpawnId")], ["map"]),
      cls("BackgroundLayer", "#ff8a6a4a", [str("assetId"), int("depth", 0)], ["layer"]),
    ],
  };
}

/**
 * Pone al día `propertyTypes` del proyecto: sustituye las clases y enums que gestiona la integración (conservando sus IDs) y
 * deja intactos los demás tipos y el resto del archivo (carpetas, comandos, ajustes del usuario).
 */
export function mergeProject(existing: TiledProject | undefined, manifest: AssetManifest): TiledProject {
  const project: TiledProject = existing ? { ...existing } : { automappingRulesFile: "", commands: [], compatibilityVersion: 1100, extensionsPath: "extensions", folders: [".", "../../public/assets"], properties: [] };
  const managed = new Set<string>([...CLASS_NAMES, ...ENUM_NAMES]);
  const old = project.propertyTypes ?? [];
  const ids = new Map(old.filter((t) => managed.has(t.name)).map((t) => [t.name, t.id]));
  const kept = old.filter((t) => !managed.has(t.name));
  let next = Math.max(0, ...old.map((t) => t.id)) + 1;
  const idOf = (name: string) => ids.get(name) ?? next++;
  const { enums, classes } = projectTypes(manifest);
  const mine: ProjectPropertyType[] = [...enums.map((e) => ({ ...e, id: idOf(e.name) })), ...classes.map((c) => ({ ...c, id: idOf(c.name) }))];
  project.propertyTypes = [...kept, ...mine];
  return project;
}

/** Valores por defecto de los miembros de cada clase del proyecto, por nombre de clase. */
export function classDefaults(project: TiledProject | undefined): Map<string, PropMap> {
  const out = new Map<string, PropMap>();
  for (const t of project?.propertyTypes ?? []) {
    if (!isRecord(t) || t.type !== "class") continue;
    const members: PropMap = new Map();
    for (const m of (t as unknown as ProjectClass).members ?? []) {
      if (m.type === "class") continue; // los miembros de tipo clase no se usan en este contrato
      members.set(m.name, { type: m.type, value: m.value });
    }
    out.set(t.name, members);
  }
  return out;
}
