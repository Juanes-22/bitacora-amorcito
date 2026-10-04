import bitacoraSchema from "../../public/config/bitacora.schema.json";
import { DIALOGUE_VARIABLES, LABEL_TEMPLATE_VARIABLES, variablesIn } from "../domain/templates";
import { ajvIssues, compileSchema } from "./schemaValidation";
import { BADGE_PANEL_PARTS, BADGE_PANEL_TEMPLATE_VARIABLES } from "./badgePanelParts";
import type {
  AssetManifest,
  BitacoraConfig,
  ConfigIssue,
  ContentBlock,
  FrameDefinitions,
  MapZone,
  ValidationResult,
} from "./types";

const validateShape = compileSchema(bitacoraSchema);

const DIALOGUE_VARIABLE_SET = new Set<string>(DIALOGUE_VARIABLES);
const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const SECTION_IDS = ["learning", "reflection", "lived"];
// Orden de profundidad esperado de las capas de fondo del catálogo (SPEC 3.1).
const LAYER_ORDER = ["horizon", "terrain", "midground", "foreground"];

/** `kind` admitidos por cada uso de un assetId (AC-29: metadata incompatible). */
const KINDS = {
  sign: ["station-sign"],
  stationObject: ["station-item", "foliage"],
  layer: ["background-layer", "complete-background"],
  badge: ["badge", "station-item", "icon"],
  portrait: ["portrait", "character-sprite"],
  actor: ["character-sprite", "pose-sheet"],
  uiAsset: {
    window: ["panel"], button: ["button"], buttonHover: ["button"], stationSign: ["station-sign"],
    titleSign: ["title-sign"], portrait: ["portrait"], xpBar: ["progress-frame"],
    xpStar: ["icon"], openBook: ["icon"], lockIcon: ["station-item", "icon"], glow: ["glow"],
    xpStarEffect: ["animation-sheet"], nextStationGlow: ["animation-sheet"], statusPanel: ["panel"], avatarAnimations: ["avatar-sheet"],
    musicMutedButton: ["button"], completedBadge: ["status-pill"], exitSign: ["exit-sign"], stationSparkle: ["animation-sheet"],
    badgesButton: ["button"], listButton: ["button"], musicButton: ["button"], jerryButton: ["button"],
  } as Record<string, string[]>,
};

/** `kind` admitido por cada tipo de efecto ambiental (SPEC 3.2). */
const AMBIENT_KINDS = {
  animation: ["animation-sheet"], sway: ["foliage", "light-prop"], drift: ["sky-element"], particles: ["particle"],
  glow: ["light-glow"], swim: ["animation-sheet"],
} as const;
/** Presupuesto de efectos por zona (SPEC 3.2, AC-57). */
export const MAX_AMBIENT_PER_ZONE = 60;
/** Presupuesto de animalitos por zona (gallinas y pollitos, contados uno a uno). */
export const MAX_CRITTERS_PER_ZONE = 30;
const AMBIENT_MOTION = { sway: "sway", drift: "drift", particles: "particle", glow: "pulse", swim: "swim" } as const;

export interface ValidateOptions {
  /** Definiciones de frames inspeccionadas. Sin ellas ninguna animación declarada es válida. */
  frameDefinitions?: FrameDefinitions;
}

function inside(zone: MapZone, x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= zone.width && y <= zone.height;
}

function inObstacle(zone: MapZone, x: number, y: number): boolean {
  return zone.obstacles.some((o) =>
    o.type === "rect"
      ? x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height
      : Math.hypot(x - o.x, y - o.y) <= o.radius,
  );
}

/**
 * Forma (bitacora.schema.json) y después integridad de referencias cruzadas contra el
 * manifiesto real. No corrige ni descarta nada: devuelve todos los errores con su ruta.
 */
export function validateBitacora(
  data: unknown,
  manifest: AssetManifest,
  options: ValidateOptions = {},
): ValidationResult<BitacoraConfig> {
  if (!validateShape(data)) return { ok: false, issues: ajvIssues(validateShape.errors) };
  const c = data as unknown as BitacoraConfig;
  const issues: ConfigIssue[] = [];
  const err = (path: string, message: string) => issues.push({ path, message });

  const checkAsset = (path: string, assetId: string, kinds?: readonly string[], type = "image") => {
    const a = manifest.assets[assetId];
    if (!a) return err(path, `asset ID no encontrado: «${assetId}»`);
    if (a.type !== type) err(path, `«${assetId}» es de type «${a.type}»; se esperaba «${type}»`);
    if (kinds && !kinds.includes(a.kind)) {
      err(path, `«${assetId}» es de kind «${a.kind}»; se esperaba: ${kinds.join(", ")}`);
    }
  };

  const checkBlocks = (path: string, blocks: ContentBlock[]) => {
    blocks.forEach((b, i) => {
      if (b.type === "image") checkAsset(`${path}[${i}].assetId`, b.assetId);
      if (b.type === "reference" && b.url !== undefined) {
        let protocol = "";
        try {
          protocol = new URL(b.url).protocol;
        } catch {
          /* protocolo vacío → error abajo */
        }
        if (!ALLOWED_URL_PROTOCOLS.has(protocol)) {
          err(`${path}[${i}].url`, `«${b.url}» no es una URL con protocolo admitido (${[...ALLOWED_URL_PROTOCOLS].join(" ")})`);
        }
      }
    });
  };

  // -- route, placements, learnings -----------------------------------------
  c.route.forEach((id, i) => {
    if (!c.learnings[id]) err(`route[${i}]`, `ID «${id}» no existe en learnings`);
    const p = c.placements[id];
    if (!p) err(`route[${i}]`, `ID «${id}» no tiene ubicación en placements`);
  });
  const activeBadges = new Map<string, string>();
  for (const id of c.route) {
    const badgeId = c.learnings[id]?.badgeId;
    if (!badgeId) continue;
    const other = activeBadges.get(badgeId);
    if (other) err(`learnings.${id}.badgeId`, `«${badgeId}» ya la usa «${other}»; cada aprendizaje activo necesita su insignia`);
    else activeBadges.set(badgeId, id);
  }

  for (const [id, p] of Object.entries(c.placements)) {
    const at = `placements.${id}`;
    const zone = c.maps[p.zoneId];
    if (!zone) err(`${at}.zoneId`, `zona «${p.zoneId}» no existe en maps`);
    if (p.signAssetId) checkAsset(`${at}.signAssetId`, p.signAssetId, KINDS.sign);
    if (p.decorationAssetId) checkAsset(`${at}.decorationAssetId`, p.decorationAssetId, KINDS.stationObject);
    if (zone) {
      if (!inside(zone, p.position.x, p.position.y)) err(`${at}.position`, "queda fuera de las dimensiones de la zona");
      const ix = p.position.x + p.interactionOffset.x;
      const iy = p.position.y + p.interactionOffset.y;
      if (!inside(zone, ix, iy)) err(`${at}.interactionOffset`, "el punto de interacción queda fuera de la zona");
      else if (inObstacle(zone, ix, iy)) err(`${at}.interactionOffset`, "el punto de interacción cae dentro de un obstáculo");
    }
  }

  for (const [id, l] of Object.entries(c.learnings)) {
    const at = `learnings.${id}`;
    if (!c.badges[l.badgeId]) err(`${at}.badgeId`, `insignia «${l.badgeId}» no existe en badges`);
    for (const s of SECTION_IDS) checkBlocks(`${at}.sections.${s}`, l.sections[s as keyof typeof l.sections]);
    for (const [ev, dId] of Object.entries(l.dialogueOverrides ?? {})) {
      if (!c.dialogues[dId]) err(`${at}.dialogueOverrides.${ev}`, `diálogo «${dId}» no existe en dialogues`);
    }
  }
  checkBlocks("project.finalReflection", c.project.finalReflection);

  for (const [id, b] of Object.entries(c.badges)) {
    checkAsset(`badges.${id}.assetId`, b.assetId, KINDS.badge);
    if (b.awardedFor) {
      if (b.xp !== 0) err(`badges.${id}.xp`, "una insignia que se concede al terminar el recorrido no suma XP: debe ser 0");
      const user = Object.entries(c.learnings).find(([, l]) => l.badgeId === id);
      if (user) err(`learnings.${user[0]}.badgeId`, `«${id}» se concede al terminar el recorrido y no puede ser la insignia de un aprendizaje`);
    }
  }

  for (const [id, d] of Object.entries(c.dialogues)) {
    d.lines.forEach((line, i) => {
      if (line.portraitAssetId) checkAsset(`dialogues.${id}.lines[${i}].portraitAssetId`, line.portraitAssetId, KINDS.portrait);
      for (const v of variablesIn(line.text)) {
        if (!DIALOGUE_VARIABLE_SET.has(v)) err(`dialogues.${id}.lines[${i}].text`, `variable «{${v}}» no permitida`);
      }
    });
  }

  // -- ui ---------------------------------------------------------------------
  const tabIds = c.ui.tabs.map((t) => t.id);
  if (new Set(tabIds).size !== SECTION_IDS.length) {
    err("ui.tabs", `deben existir exactamente las secciones ${SECTION_IDS.join(", ")}, sin duplicados`);
  }
  for (const [key, assetId] of Object.entries(c.ui.assets)) {
    checkAsset(`ui.assets.${key}`, assetId, KINDS.uiAsset[key]);
  }
  for (const [ev, dId] of Object.entries(c.ui.defaultDialogueIds)) {
    if (!c.dialogues[dId]) err(`ui.defaultDialogueIds.${ev}`, `diálogo «${dId}» no existe en dialogues`);
  }
  for (const [key, allowed] of Object.entries(LABEL_TEMPLATE_VARIABLES)) {
    for (const v of variablesIn(c.ui.labels[key as keyof typeof LABEL_TEMPLATE_VARIABLES])) {
      if (!(allowed as readonly string[]).includes(v)) err(`ui.labels.${key}`, `variable «{${v}}» no permitida`);
    }
  }

  // Panel de insignias con el kit de interfaz: todas sus piezas existen y los textos usan solo sus variables.
  const panel = c.ui.badgePanel;
  if (panel) {
    for (const name of BADGE_PANEL_PARTS) checkAsset(`ui.badgePanel.assetPrefix`, `${panel.assetPrefix}${name}`, ["badge-panel-part"]);
    for (const [key, allowed] of Object.entries(BADGE_PANEL_TEMPLATE_VARIABLES)) {
      for (const v of variablesIn(panel.labels[key as keyof typeof BADGE_PANEL_TEMPLATE_VARIABLES])) {
        if (!(allowed as readonly string[]).includes(v)) err(`ui.badgePanel.labels.${key}`, `variable «{${v}}» no permitida`);
      }
    }
  }

  // -- maps ---------------------------------------------------------------------
  for (const [zid, zone] of Object.entries(c.maps)) {
    const at = `maps.${zid}`;
    zone.layers.forEach((layer, i) => checkAsset(`${at}.layers[${i}].assetId`, layer.assetId, KINDS.layer));
    const layerEntries = zone.layers.map((l) => manifest.assets[l.assetId]).filter(Boolean);
    const zones = new Set(layerEntries.map((a) => a.zone).filter(Boolean));
    if (zones.size > 1) err(`${at}.layers`, `mezcla capas de zonas distintas del catálogo: ${[...zones].join(", ")}`);
    const seen = new Set<string>();
    zone.layers.forEach((l, i) => {
      const role = manifest.assets[l.assetId]?.layer;
      if (!role) return;
      if (seen.has(role)) err(`${at}.layers[${i}].assetId`, `ya hay otra variante de la capa «${role}»; usa una sola`);
      seen.add(role);
    });
    const ordered = zone.layers
      .filter((l) => LAYER_ORDER.includes(manifest.assets[l.assetId]?.layer ?? ""))
      .map((l) => ({ role: manifest.assets[l.assetId].layer as string, depth: l.depth }));
    for (const lower of ordered) {
      for (const upper of ordered) {
        if (LAYER_ORDER.indexOf(lower.role) < LAYER_ORDER.indexOf(upper.role) && lower.depth >= upper.depth) {
          err(`${at}.layers`, `«${lower.role}» debe dibujarse detrás de «${upper.role}» (${LAYER_ORDER.join(" < ")}): revisa sus depth`);
        }
      }
    }
    zone.decorations.forEach((d, i) => checkAsset(`${at}.decorations[${i}].assetId`, d.assetId, KINDS.stationObject));

    if (zone.ambient.length > MAX_AMBIENT_PER_ZONE) err(`${at}.ambient`, `tiene ${zone.ambient.length} efectos; el máximo por zona es ${MAX_AMBIENT_PER_ZONE} (presupuesto de rendimiento)`);
    zone.ambient.forEach((fx, i) => {
      const ap = `${at}.ambient[${i}]`;
      checkAsset(`${ap}.assetId`, fx.assetId, AMBIENT_KINDS[fx.type]);
      const entry = manifest.assets[fx.assetId];
      if (entry) {
        if (fx.type === "animation" || fx.type === "swim") {
          if (!entry.atlasPath || !entry.animation) err(`${ap}.assetId`, `«${fx.assetId}» no es una hoja animada (falta atlasPath o animation)`);
          if (fx.type === "animation" && entry.motion?.type === "swim") err(`${ap}.type`, `«${fx.assetId}» declara motion «swim»: usa un efecto de tipo «swim» con su trayectoria`);
          if (fx.type === "swim" && entry.motion?.type !== "swim") err(`${ap}.type`, `«swim» exige que «${fx.assetId}» declare motion de tipo «swim» (tiene ${entry.motion?.type ?? "ninguno"})`);
        } else if (entry.motion?.type !== AMBIENT_MOTION[fx.type]) {
          err(`${ap}.type`, `«${fx.type}» exige que «${fx.assetId}» declare motion de tipo «${AMBIENT_MOTION[fx.type]}» (tiene ${entry.motion?.type ?? "ninguno"})`);
        }
        if (!entry.origin || !entry.recommendedScale) err(`${ap}.assetId`, `«${fx.assetId}» no declara origin y recommendedScale`);
      }
      if (fx.type === "particles") {
        const r = fx.area;
        if (r.x < 0 || r.y < 0 || r.x + r.width > zone.width || r.y + r.height > zone.height) err(`${ap}.area`, "queda fuera de las dimensiones de la zona");
      } else if (fx.type === "swim") {
        fx.path.forEach((p, k) => {
          if (!inside(zone, p.x, p.y)) err(`${ap}.path[${k}]`, "queda fuera de las dimensiones de la zona");
        });
      } else if (!inside(zone, fx.position.x, fx.position.y)) {
        err(`${ap}.position`, "queda fuera de las dimensiones de la zona");
      }
    });

    const critters = zone.critters ?? [];
    const critterCount = critters.reduce((n, k) => n + 1 + (k.type === "family" ? k.chicks : 0), 0);
    if (critterCount > MAX_CRITTERS_PER_ZONE) err(`${at}.critters`, `tiene ${critterCount} animalitos; el máximo por zona es ${MAX_CRITTERS_PER_ZONE} (presupuesto de rendimiento)`);
    critters.forEach((k, i) => {
      const kp = `${at}.critters[${i}]`;
      for (const [field, id] of k.type === "family" ? ([["assetId", k.assetId], ["chickAssetId", k.chickAssetId]] as const) : ([["assetId", k.assetId]] as const)) {
        checkAsset(`${kp}.${field}`, id, ["critter-sheet"]);
      }
      if (!inside(zone, k.position.x, k.position.y)) err(`${kp}.position`, "queda fuera de las dimensiones de la zona");
      else if (k.position.x - k.radius < 0 || k.position.x + k.radius > zone.width || k.position.y - k.radius < 0 || k.position.y + k.radius > zone.height) {
        err(`${kp}.radius`, "el área por la que merodea se sale de la zona");
      }
    });

    if (!zone.spawns[zone.initialSpawnId]) err(`${at}.initialSpawnId`, `spawn «${zone.initialSpawnId}» no existe en spawns`);
    for (const [sid, s] of Object.entries(zone.spawns)) {
      if (!inside(zone, s.x, s.y)) err(`${at}.spawns.${sid}`, "queda fuera de las dimensiones de la zona");
      else if (inObstacle(zone, s.x, s.y)) err(`${at}.spawns.${sid}`, "cae dentro de un obstáculo");
    }
    for (const [pid, p] of Object.entries(zone.portals)) {
      const pat = `${at}.portals.${pid}`;
      const target = c.maps[p.targetZoneId];
      if (!target) err(`${pat}.targetZoneId`, `zona «${p.targetZoneId}» no existe en maps`);
      else if (!target.spawns[p.targetSpawnId]) err(`${pat}.targetSpawnId`, `spawn «${p.targetSpawnId}» no existe en la zona «${p.targetZoneId}»`);
      if (p.targetZoneId === zid) err(`${pat}.targetZoneId`, "un portal no puede llevar a su propia zona");
      else if (target?.spawns[p.targetSpawnId]) {
        // Aparecer dentro del radio de un portal avisaría de inmediato de un viaje de regreso: sin bucles.
        const arrival = target.spawns[p.targetSpawnId];
        for (const [otherId, other] of Object.entries(target.portals)) {
          if (Math.hypot(arrival.x - other.interaction.x, arrival.y - other.interaction.y) <= other.interaction.radius) {
            err(`${pat}.targetSpawnId`, `el punto de aparición cae dentro del radio del portal «${otherId}» de la zona «${p.targetZoneId}»`);
          }
        }
      }
      if (!inside(zone, p.interaction.x, p.interaction.y)) err(`${pat}.interaction`, "queda fuera de las dimensiones de la zona");
      else if (inObstacle(zone, p.interaction.x, p.interaction.y)) err(`${pat}.interaction`, "cae dentro de un obstáculo");
    }
  }

  // -- gameplay ---------------------------------------------------------------
  const startZone = c.maps[c.gameplay.start.zoneId];
  if (!startZone) err("gameplay.start.zoneId", `zona «${c.gameplay.start.zoneId}» no existe en maps`);
  else if (!startZone.spawns[c.gameplay.start.spawnId]) {
    err("gameplay.start.spawnId", `spawn «${c.gameplay.start.spawnId}» no existe en la zona «${c.gameplay.start.zoneId}»`);
  }

  // -- audio (SPEC 6.4) ---------------------------------------------------------
  const music = c.audio.music;
  const seen = new Set<string>();
  music.tracks.forEach((id, i) => {
    const at = `audio.music.tracks[${i}]`;
    if (seen.has(id)) err(at, `la pista «${id}» está repetida`);
    seen.add(id);
    checkAsset(at, id, ["music"], "audio");
  });
  if (music.active && music.tracks.length === 0) err("audio.music.tracks", "la música está activada pero la lista de pistas está vacía");
  const shortest = Math.min(...music.tracks.map((id) => manifest.assets[id]?.durationSeconds ?? Infinity));
  if (Number.isFinite(shortest) && music.crossfadeMs >= (shortest * 1000) / 2) {
    err("audio.music.crossfadeMs", `debe ser menor que la mitad de la pista más corta (${Math.round(shortest * 500)} ms)`);
  }

  if (c.gameplay.camera.maxZoom < c.gameplay.cameraZoom) err("gameplay.camera.maxZoom", "no puede ser menor que cameraZoom (el zoom base)");

  const checkActor = (path: string, actor: BitacoraConfig["gameplay"]["player"] | NonNullable<BitacoraConfig["gameplay"]["companion"]["actor"]>) => {
    checkAsset(`${path}.assetId`, actor.assetId, KINDS.actor);
    const entry = manifest.assets[actor.assetId];
    const frames = options.frameDefinitions?.[actor.assetId];
    if (entry?.requiresFrameDefinition && !frames) {
      err(`${path}.assetId`, `«${actor.assetId}» es una hoja de poses sin frames validados; no puede usarse como sprite`);
    }
    for (const [name, animId] of Object.entries(actor.animations)) {
      // La celebración puede estar en otra hoja validada del mismo personaje (hoja de salto/celebración).
      const elsewhere = name === "celebrate" && Object.values(options.frameDefinitions ?? {}).some((d) => d.animations.includes(animId as string));
      if (!frames?.animations.includes(animId as string) && !elsewhere) {
        err(`${path}.animations.${name}`, `animación «${animId}» sin definición de frames validada para «${actor.assetId}»`);
      }
    }
  };
  checkActor("gameplay.player", c.gameplay.player);
  const idle = c.gameplay.player.idle;
  if (idle) {
    // Reposo y mirada necesitan una animación por dirección; el juego, al menos una (SPEC 6.2).
    const DIRECTIONS = ["front", "left", "right", "back"];
    for (const slot of ["rest", "glance", "play"] as const) {
      const path = `gameplay.player.idle.${slot}`;
      checkAsset(path, idle[slot], ["idle-sheet"]);
      const sheet = manifest.assets[idle[slot]];
      if (!sheet?.animations) continue;
      const have = new Set(sheet.animations.map((a) => a.direction));
      if (slot === "play") {
        if (!have.has("front")) err(path, `«${idle[slot]}» no tiene una animación de frente: el juego con Jerry se reproduce de frente`);
      } else {
        const missing = DIRECTIONS.filter((d) => !have.has(d as never));
        if (missing.length) err(path, `«${idle[slot]}» no tiene animación para: ${missing.join(", ")}`);
      }
    }
    // Cada gesto extra es una hoja con una animación que cubre todos sus fotogramas (la secuencia completa del kit).
    const fullSequence = (assetId: string) => {
      const sheet = manifest.assets[assetId];
      return sheet?.animations?.some((a) => new Set(a.frameNames).size === sheet.frameCount);
    };
    if (idle.tricks) {
      checkAsset("gameplay.player.idle.tricks.sheet", idle.tricks.sheet, ["idle-sheet"]);
      if (manifest.assets[idle.tricks.sheet] && !fullSequence(idle.tricks.sheet)) err("gameplay.player.idle.tricks.sheet", `«${idle.tricks.sheet}» no tiene una animación con la secuencia completa`);
    }
    if (idle.fetch) {
      checkAsset("gameplay.player.idle.fetch.sheet", idle.fetch.sheet, ["idle-sheet"]);
      if (manifest.assets[idle.fetch.sheet] && !fullSequence(idle.fetch.sheet)) err("gameplay.player.idle.fetch.sheet", `«${idle.fetch.sheet}» no tiene una animación con la secuencia completa`);
    }
    if ((idle.tricks || idle.fetch) && !idle.actionKey) err("gameplay.player.idle.actionKey", "es obligatoria cuando hay trucos o búsqueda del peluche: es la tecla con la que se piden");
    if (idle.playAfterMs < idle.glanceAfterMs) err("gameplay.player.idle.playAfterMs", "no puede ser menor que glanceAfterMs (primero se miran y después juegan)");
  }
  const comp = c.gameplay.companion;
  if (comp.mode === "separate" && !comp.actor) err("gameplay.companion.actor", "es obligatorio cuando mode es «separate»");
  if (comp.mode === "included" && comp.actor) err("gameplay.companion.actor", "no debe existir cuando mode es «included» (el sprite ya incluye a Jerry)");
  if (comp.actor) checkActor("gameplay.companion.actor", comp.actor);

  // -- zonas alcanzables mediante portales (ida y regreso) -------------------------
  if (startZone) {
    const used = new Set<string>([c.gameplay.start.zoneId]);
    for (const id of c.route) if (c.placements[id] && c.maps[c.placements[id].zoneId]) used.add(c.placements[id].zoneId);
    const reach = (from: string): Set<string> => {
      const seen = new Set([from]);
      const queue = [from];
      while (queue.length) {
        const z = queue.pop() as string;
        for (const p of Object.values(c.maps[z]?.portals ?? {})) {
          if (c.maps[p.targetZoneId] && !seen.has(p.targetZoneId)) {
            seen.add(p.targetZoneId);
            queue.push(p.targetZoneId);
          }
        }
      }
      return seen;
    };
    const fromStart = reach(c.gameplay.start.zoneId);
    for (const z of used) {
      if (!fromStart.has(z)) err(`maps.${z}`, `no se puede llegar desde la zona inicial «${c.gameplay.start.zoneId}» mediante portales`);
      else if (!reach(z).has(c.gameplay.start.zoneId)) err(`maps.${z}`, `no hay portales de regreso hacia la zona inicial «${c.gameplay.start.zoneId}»`);
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true, value: c };
}

export function formatIssues(issues: ConfigIssue[]): string {
  return issues.map((i) => `${i.path}: ${i.message}`).join("\n");
}
