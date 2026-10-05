import { basename, resolve as resolvePath } from "node:path";
import { KINDS } from "../../../src/config/validateConfig";
import type { AmbientEffect, AssetManifest, BitacoraConfig, Critter, Decoration, MapLayer, MapZone, Obstacle, Placement, Point, Portal } from "../../../src/config/types";
import { ambientKindOf, CLASS_ROLE, geometryOf, type Geometry, type Role } from "./catalog";
import { classDefaults } from "./project";
import type { Source, TiledImageLayer, TiledIssue, TiledLayer, TiledMap, TiledObject, TiledObjectLayer, TiledProject, TiledTile, TiledTileset } from "./types";
import { alignmentOf, classOf, clean, decodeGid, near, propsOf, TOLERANCE, type Prop, type PropMap } from "./util";

// Lectura de un mapa de Tiled (.tmj) y conversión a los datos espaciales de maps.json: la operación inversa de export.ts.
// Todo lo que el contrato del juego no puede representar se rechaza con un error que señala el archivo, la capa y el objeto.

export interface ImportContext {
  manifest: AssetManifest;
  /** Configuración vigente: de ella salen `route`, `learnings`, `ui.assets` y `gameplay.signScale`. */
  config: BitacoraConfig;
  project?: TiledProject;
  /** Directorio absoluto de `public/assets` y del mapa, para comprobar que las capas de imagen apuntan al asset correcto. */
  assetsDir: string;
  mapDir: string;
  /** Lee un tileset externo (ruta relativa al mapa); `undefined` si no existe o no se puede leer. */
  loadTileset: (source: string) => TiledTileset | undefined;
}

export interface StationImport {
  learningId: string;
  placement: Placement;
  source: Source;
}

export interface ZoneImport {
  zoneId: string;
  file: string;
  zone: MapZone;
  stations: StationImport[];
  /** Origen en Tiled de cada elemento importado, por su ruta en maps.json (`maps.zona-a.ambient[3]`). */
  sources: Map<string, Source>;
}

type TileRef = { tile: TiledTile; tileset: TiledTileset; props: PropMap };

/** Lector de propiedades tipadas: acumula errores con su origen y devuelve `undefined` si falta o no es del tipo esperado. */
class Reader {
  failed = false;
  constructor(readonly props: PropMap, readonly source: Source, private readonly issues: TiledIssue[]) {}

  fail(property: string | undefined, message: string): void {
    this.failed = true;
    this.issues.push({ source: { ...this.source, property }, message });
  }
  has(name: string): boolean {
    return this.props.has(name);
  }
  from(name: string): Prop["from"] {
    return this.props.get(name)?.from;
  }
  str(name: string, required = true): string | undefined {
    const p = this.props.get(name);
    if (!p) {
      if (required) this.fail(name, "falta la propiedad");
      return undefined;
    }
    if (typeof p.value !== "string") {
      this.fail(name, `debe ser texto (es ${typeof p.value})`);
      return undefined;
    }
    if (required && p.value.trim() === "") {
      this.fail(name, "no puede estar vacía");
      return undefined;
    }
    return p.value;
  }
  num(name: string, required = true, check?: { min?: number; max?: number; exclusiveMin?: number; int?: boolean }): number | undefined {
    const p = this.props.get(name);
    if (!p) {
      if (required) this.fail(name, "falta la propiedad");
      return undefined;
    }
    if (typeof p.value !== "number" || !Number.isFinite(p.value)) {
      this.fail(name, `debe ser un número (es ${typeof p.value})`);
      return undefined;
    }
    const v = p.value;
    if (check?.int && !Number.isInteger(v)) this.fail(name, `debe ser un entero (es ${v})`);
    else if (check?.min !== undefined && v < check.min) this.fail(name, `debe ser ≥ ${check.min} (es ${v})`);
    else if (check?.exclusiveMin !== undefined && v <= check.exclusiveMin) this.fail(name, `debe ser > ${check.exclusiveMin} (es ${v})`);
    else if (check?.max !== undefined && v > check.max) this.fail(name, `debe ser ≤ ${check.max} (es ${v})`);
    else return v;
    return undefined;
  }
  depth(): { mode: "fixed"; value: number } | { mode: "y"; offset: number } | undefined {
    const mode = this.str("depthMode");
    const n = this.num("depth");
    if (mode === undefined || n === undefined) return undefined;
    if (mode === "fixed") return { mode, value: n };
    if (mode === "y") return { mode, offset: n };
    this.fail("depthMode", `debe ser «fixed» o «y» (es «${mode}»)`);
    return undefined;
  }
  /** Campos opcionales con valor explícito igual al de por defecto, que el tamaño o el reflejo del objeto no pueden indicar (propiedad `explicit`). */
  explicit(): Set<string> {
    const p = this.props.get("explicit");
    return new Set(typeof p?.value === "string" ? p.value.split(",").map((s) => s.trim()).filter(Boolean) : []);
  }
}

/**
 * Diferencia máxima (relativa) entre la escala horizontal y la vertical de un objeto para aceptarlo como uniforme con un aviso
 * (lo que deja arrastrar una esquina sin Mayús). Por encima es un estiramiento y se rechaza.
 */
export const UNIFORM_LENIENCY = 0.05;

/** Límites de las gallinas en maps.schema.json (una prueba comprueba que siguen coincidiendo): se avisan aquí con su objeto. */
export const CRITTER_LIMITS = { scale: 4, radius: 120, chicks: 8, chickScale: 4 } as const;

const MAP_CLASSES = new Set(["Station", "Decoration", "Ambient", "Critter", "Particles", "Swim", "Collision", "Spawn", "Portal"]);

/** Resuelve las propiedades de un objeto: valores por defecto de su clase < propiedades del tile < propiedades del propio objeto. */
export function resolveProps(defaults: Map<string, PropMap>, className: string, tileProps: PropMap | undefined, own: PropMap): PropMap {
  const out: PropMap = new Map();
  for (const [k, v] of defaults.get(className) ?? []) out.set(k, { ...v, from: "class" });
  for (const [k, v] of tileProps ?? []) out.set(k, { ...v, from: "tile" });
  for (const [k, v] of own) out.set(k, { ...v, from: "object" });
  return out;
}

const isEditorOnly = (o: { class?: string; type?: string; properties?: import("./types").TiledProperty[] }): boolean =>
  classOf(o) === "EditorOnly" || propsOf(o.properties).get("editorOnly")?.value === true;

interface Walked {
  imageLayers: Array<{ layer: TiledImageLayer; path: string[] }>;
  objects: Array<{ obj: TiledObject; layer: TiledObjectLayer; dx: number; dy: number }>;
}

/**
 * Importa un mapa. Devuelve `result` solo si no hubo errores de lectura o de conversión; la validación posterior del proyecto
 * completo (esquemas, referencias, alcanzabilidad) la hace el llamador con la configuración candidata.
 */
export function importMap(file: string, map: TiledMap, ctx: ImportContext): { result?: ZoneImport; issues: TiledIssue[]; warnings: TiledIssue[] } {
  const issues: TiledIssue[] = [];
  const warnings: TiledIssue[] = [];
  const fileName = basename(file);
  const here = (extra: Partial<Source> = {}): Source => ({ file: fileName, ...extra });
  const fail = (message: string, extra: Partial<Source> = {}) => issues.push({ source: here(extra), message });
  const defaults = classDefaults(ctx.project);
  const { config, manifest } = ctx;

  // -- Mapa: orientación, dimensiones y datos de la zona -----------------------------------------------------------------
  if (map.orientation !== "orthogonal") fail(`la orientación «${map.orientation}» no está soportada: el mapa debe ser ortogonal`);
  if (map.infinite) fail("los mapas infinitos no están soportados");
  if (!(map.width > 0 && map.height > 0 && map.tilewidth > 0 && map.tileheight > 0)) fail("el mapa no declara dimensiones válidas (width, height, tilewidth, tileheight)");
  const mapProps = resolveProps(defaults, classOf(map), undefined, propsOf(map.properties));
  const mapReader = new Reader(mapProps, here(), issues);
  const zoneId = mapReader.str("zoneId");
  const label = mapReader.str("label");
  const initialSpawnId = mapReader.str("initialSpawnId");
  const width = clean(map.width * map.tilewidth);
  const height = clean(map.height * map.tileheight);

  // -- Tilesets ----------------------------------------------------------------------------------------------------------
  const tilesets: Array<{ firstgid: number; tileset: TiledTileset; byId: Map<number, TiledTile> }> = [];
  for (const ref of map.tilesets ?? []) {
    let tileset: TiledTileset | undefined;
    if (typeof ref.source === "string") {
      if (!ref.source.endsWith(".tsj") && !ref.source.endsWith(".json")) fail(`el tileset «${ref.source}» no es JSON (.tsj): conviértelo o usa el catálogo generado`);
      tileset = ctx.loadTileset(ref.source);
      if (!tileset) fail(`no se pudo leer el tileset «${ref.source}» (¿falta el archivo?)`);
    } else tileset = ref as unknown as TiledTileset;
    if (tileset) tilesets.push({ firstgid: ref.firstgid, tileset, byId: new Map((tileset.tiles ?? []).map((t) => [t.id, t])) });
  }
  tilesets.sort((a, b) => b.firstgid - a.firstgid);
  const findTile = (gid: number): TileRef | undefined => {
    const ts = tilesets.find((t) => gid >= t.firstgid);
    const tile = ts?.byId.get(gid - (ts?.firstgid ?? 0));
    return ts && tile ? { tile, tileset: ts.tileset, props: propsOf(tile.properties) } : undefined;
  };

  // -- Recorrido de capas (acumulando los desplazamientos de grupos y capas) ---------------------------------------------
  const walked: Walked = { imageLayers: [], objects: [] };
  const walk = (layers: TiledLayer[], dx: number, dy: number, path: string[]) => {
    for (const layer of layers) {
      if (isEditorOnly(layer)) continue; // guías de la herramienta: se ignoran
      const ox = dx + (layer.offsetx ?? 0);
      const oy = dy + (layer.offsety ?? 0);
      if (layer.type === "group") {
        walk(layer.layers, ox, oy, [...path, layer.name]);
      } else if (layer.type === "imagelayer") {
        if (ox !== 0 || oy !== 0) fail(`la capa de imagen tiene un desplazamiento de (${ox}, ${oy}): el juego dibuja cada capa del paisaje en (0, 0)`, { layer: layer.name });
        walked.imageLayers.push({ layer, path });
      } else if (layer.type === "objectgroup") {
        if ((layer.parallaxx ?? 1) !== 1 || (layer.parallaxy ?? 1) !== 1) fail("la capa usa parallax: el juego no lo reproduce", { layer: layer.name });
        for (const obj of layer.objects) walked.objects.push({ obj, layer, dx: ox, dy: oy });
      } else {
        fail("las capas de teselas no se usan: elimínala o márcala como EditorOnly", { layer: layer.name });
      }
    }
  };
  walk(map.layers ?? [], 0, 0, []);

  // -- Capas del paisaje ---------------------------------------------------------------------------------------------------
  const layers: MapLayer[] = [];
  for (const { layer } of walked.imageLayers) {
    const source = here({ layer: layer.name });
    const reader = new Reader(resolveProps(defaults, classOf(layer), undefined, propsOf(layer.properties)), source, issues);
    const assetId = reader.str("assetId");
    const depth = reader.num("depth");
    const bad = (m: string) => reader.fail(undefined, m);
    if ((layer.opacity ?? 1) !== 1) bad(`la opacidad ${layer.opacity} no está soportada en las capas del paisaje`);
    if (layer.tintcolor) bad("el tinte no está soportado en las capas del paisaje");
    if ((layer.parallaxx ?? 1) !== 1 || (layer.parallaxy ?? 1) !== 1) bad("el parallax no está soportado en las capas del paisaje");
    if (layer.repeatx || layer.repeaty) bad("la repetición no está soportada en las capas del paisaje");
    if (assetId === undefined || depth === undefined) continue;
    const entry = manifest.assets[assetId];
    if (!entry) {
      reader.fail("assetId", `asset ID no encontrado en assets.json: «${assetId}»`);
      continue;
    }
    if (!(KINDS.layer as readonly string[]).includes(entry.kind)) reader.fail("assetId", `«${assetId}» es de kind «${entry.kind}»; se esperaba: ${KINDS.layer.join(", ")}`);
    else if (resolve_(ctx.mapDir, layer.image) !== resolve_(ctx.assetsDir, entry.path)) {
      reader.fail("assetId", `la imagen de la capa («${layer.image}») no es la de «${assetId}» (${entry.path}): cambia la propiedad assetId o la imagen`);
    }
    if (!reader.failed) layers.push({ assetId, depth });
  }

  // -- Objetos -------------------------------------------------------------------------------------------------------------
  const ambient: AmbientEffect[] = [];
  const critters: Critter[] = [];
  const decorations: Decoration[] = [];
  const obstacles: Obstacle[] = [];
  const spawns: Record<string, Point> = {};
  const portals: Record<string, Portal> = {};
  const stations: StationImport[] = [];
  const sources = new Map<string, Source>();
  const zoneKey = zoneId ?? "?";
  const signScale = config.gameplay.signScale;

  /** Posición absoluta de la esquina superior izquierda de un objeto-tile (alineación del tileset y desplazamientos). */
  for (const { obj, layer, dx, dy } of walked.objects) {
    if (isEditorOnly(obj)) continue;
    const source = here({ layer: layer.name, objectId: obj.id, objectName: obj.name || undefined });
    const fail_ = (property: string | undefined, message: string) => issues.push({ source: { ...source, property }, message });
    if (obj.template) {
      fail_(undefined, `usa la plantilla «${obj.template}»: las plantillas de objetos no están soportadas (sepáralo con «Detach»)`);
      continue;
    }
    if ((obj.rotation ?? 0) !== 0) {
      fail_("rotation", `la rotación ${obj.rotation}° no está soportada`);
      continue;
    }

    let tileRef: TileRef | undefined;
    let flipH = false;
    if (obj.gid !== undefined) {
      const g = decodeGid(obj.gid);
      if (g.flipV || g.flipD || g.rotHex120) {
        fail_("gid", `usa un reflejo vertical, diagonal o una rotación (${[g.flipV && "vertical", g.flipD && "diagonal", g.rotHex120 && "rotación hexagonal"].filter(Boolean).join(", ")}) que el juego no reproduce`);
        continue;
      }
      flipH = g.flipH;
      tileRef = findTile(g.gid);
      if (!tileRef) {
        fail_("gid", `el tile ${g.gid} no existe en ningún tileset del mapa (¿falta un tileset externo?)`);
        continue;
      }
    }

    const layerDefault = propsOf(layer.properties).get("defaultClass")?.value;
    const className = classOf(obj) || (tileRef ? classOf(tileRef.tile) : "") || (typeof layerDefault === "string" ? layerDefault : "");
    if (!className) {
      fail_(undefined, "no tiene clase: asígnale una (Station, Decoration, Ambient, Critter, Particles, Swim, Collision, Spawn o Portal)");
      continue;
    }
    if (!MAP_CLASSES.has(className)) {
      fail_(undefined, `la clase «${className}» no se reconoce`);
      continue;
    }
    const props = resolveProps(defaults, className, tileRef?.props, propsOf(obj.properties));
    const r = new Reader(props, source, issues);

    // Posición y tamaño visibles del objeto en el mundo.
    const w = obj.width ?? 0;
    const h = obj.height ?? 0;
    let left = obj.x + dx;
    let top = obj.y + dy;
    if (tileRef) {
      const a = alignmentOf(tileRef.tileset.objectalignment);
      left -= a.x * w;
      top -= a.y * h;
    }

    // Un objeto-tile: de qué asset es, comprobado contra la propiedad `assetId` por si alguien la cambió a mano.
    const tileAsset = (): string | undefined => {
      if (!tileRef) {
        r.fail(undefined, `la clase «${className}» necesita un objeto-tile del catálogo`);
        return undefined;
      }
      const fromTile = tileRef.props.get("assetId")?.value;
      const own = propsOf(obj.properties).get("assetId")?.value;
      const assetId = typeof own === "string" && own !== "" ? own : fromTile;
      if (typeof assetId !== "string" || assetId === "") {
        r.fail("assetId", "el tile no declara el asset al que corresponde");
        return undefined;
      }
      if (typeof fromTile === "string" && fromTile !== assetId) {
        r.fail("assetId", `el tile dibuja «${fromTile}» pero la propiedad dice «${assetId}»: la imagen y el dato deben coincidir`);
        return undefined;
      }
      if (tileRef.tileset.tiles && propsOf(tileRef.tile.properties).get("obsolete")?.value === true) {
        r.fail("assetId", `«${assetId}» ya no está en el catálogo de assets (tile obsoleto)`);
        return undefined;
      }
      if (!manifest.assets[assetId]) {
        r.fail("assetId", `asset ID no encontrado en assets.json: «${assetId}»`);
        return undefined;
      }
      return assetId;
    };
    const native = tileRef ? near(w, tileRef.tile.imagewidth ?? -1) && near(h, tileRef.tile.imageheight ?? -1) : false;
    /** Multiplicador de escala del objeto respecto de su tamaño base: uniforme y positivo, o error. */
    const scaleOf = (g: Geometry, baseW: number, baseH: number): number | undefined => {
      if (!(w > 0 && h > 0)) {
        r.fail(undefined, "el objeto no tiene tamaño (ancho y alto deben ser positivos)");
        return undefined;
      }
      if (native) return 1;
      const dev = Math.abs(w - (h * baseW) / baseH);
      if (dev <= TOLERANCE) return clean(w / baseW);
      // Un arrastre de esquina sin Mayús deja una diferencia pequeña entre las dos escalas: se importa la media y se avisa. Una
      // diferencia grande es un estiramiento de verdad, que el juego no puede dibujar, y se rechaza.
      const sx = w / baseW;
      const sy = h / baseH;
      const relative = Math.abs(sx - sy) / Math.max(sx, sy);
      if (relative <= UNIFORM_LENIENCY) {
        const mean = clean((sx + sy) / 2);
        warnings.push({ source, message: `la escala no era del todo uniforme (${clean(w)} × ${clean(h)} px: ${clean(sx)} y ${clean(sy)}, ${(relative * 100).toFixed(1)} % de diferencia): se usó la media, ${mean}. Para evitarlo, redimensiona manteniendo la proporción (Mayús)` });
        return mean;
      }
      r.fail(undefined, `la escala no es uniforme (${clean(w)} × ${clean(h)} px, ${(relative * 100).toFixed(0)} % de diferencia entre el ancho y el alto frente a una proporción de ${clean(g.logicalW)} × ${clean(g.logicalH)}): redimensiona manteniendo la proporción (Mayús)`);
      return undefined;
    };
    const noFlip = () => {
      if (flipH) r.fail("gid", `«${className}» no admite reflejo horizontal (no tiene el campo flipX). Deshaz el volteo en Tiled (Objects › Flip Horizontally, tecla X).`);
    };
    const roleOf = (): Role | undefined => (tileRef ? CLASS_ROLE[classOf(tileRef.tile)] : undefined);
    const checkRole = (expected: Role): boolean => {
      const role = roleOf();
      if (role !== undefined && role !== expected) {
        r.fail(undefined, `el tile es de la clase «${classOf(tileRef!.tile)}» pero el objeto es «${className}»`);
        return false;
      }
      return true;
    };
    const kindIn = (assetId: string, kinds: readonly string[], property = "assetId"): boolean => {
      const e = manifest.assets[assetId];
      if (!kinds.includes(e.kind)) {
        r.fail(property, `«${assetId}» es de kind «${e.kind}»; se esperaba: ${kinds.join(", ")}`);
        return false;
      }
      return true;
    };
    const record = (key: string) => sources.set(key, source);

    switch (className) {
      case "Station": {
        if (!checkRole("station")) break;
        const assetId = tileAsset();
        const learningId = r.str("learningId");
        const offX = r.num("interactionOffsetX");
        const offY = r.num("interactionOffsetY");
        const radius = r.num("interactionRadius", true, { exclusiveMin: 0 });
        noFlip();
        if (assetId === undefined || learningId === undefined || offX === undefined || offY === undefined || radius === undefined || !kindIn(assetId, KINDS.sign)) break;
        if (!config.learnings[learningId]) {
          r.fail("learningId", `el aprendizaje «${learningId}» no existe en learnings`);
          break;
        }
        if (!config.route.includes(learningId)) {
          r.fail("learningId", `«${learningId}» está archivado (no está en route): solo las estaciones activas se colocan aquí`);
          break;
        }
        const g = geometryOf("station", manifest.assets[assetId], signScale);
        if (!g) {
          r.fail("assetId", `«${assetId}» no declara la metadata de un letrero`);
          break;
        }
        if (!native && !(near(w, g.baseW) && near(h, g.baseH))) {
          r.fail(undefined, `los letreros conservan la escala global gameplay.signScale (${signScale}): miden ${clean(g.baseW)} × ${clean(g.baseH)} px y este mide ${clean(w)} × ${clean(h)}; no se pueden redimensionar uno a uno`);
          break;
        }
        const placement: Placement = {
          zoneId: zoneKey,
          position: { x: clean(left + g.origin.x * w), y: clean(top + g.origin.y * h) },
          interactionOffset: { x: offX, y: offY },
          interactionRadius: radius,
        };
        const defaultSign = config.ui.assets.stationSign;
        if (assetId !== defaultSign || propsOf(obj.properties).has("signAssetId")) placement.signAssetId = assetId;
        if (r.has("decorationAssetId")) {
          const d = r.str("decorationAssetId");
          if (d !== undefined) placement.decorationAssetId = d;
        }
        if (r.has("decorationOffsetX") || r.has("decorationOffsetY")) {
          const x = r.num("decorationOffsetX");
          const y = r.num("decorationOffsetY");
          if (x !== undefined && y !== undefined) placement.decorationOffset = { x, y };
        }
        if (!r.failed) stations.push({ learningId, placement, source });
        break;
      }
      case "Decoration": {
        if (!checkRole("decoration")) break;
        const assetId = tileAsset();
        const ox = r.num("originX");
        const oy = r.num("originY");
        const depth = r.depth();
        noFlip();
        if (assetId === undefined || ox === undefined || oy === undefined || depth === undefined || !kindIn(assetId, KINDS.stationObject)) break;
        const g = geometryOf("decoration", manifest.assets[assetId], signScale);
        if (!g) {
          r.fail("assetId", `«${assetId}» no declara el tamaño de su imagen`);
          break;
        }
        const k = scaleOf(g, g.logicalW, g.logicalH);
        // La escala de una decoración es respecto de su imagen entera; un objeto recién colocado trae el tamaño sugerido.
        const scale = k === undefined ? undefined : native ? clean(w / g.logicalW) : k;
        if (scale === undefined || r.failed) break;
        decorations.push({ assetId, position: { x: clean(left + ox * w), y: clean(top + oy * h) }, origin: { x: ox, y: oy }, scale, depth });
        record(`maps.${zoneKey}.decorations[${decorations.length - 1}]`);
        break;
      }
      case "Ambient": {
        if (!checkRole("ambient")) break;
        const assetId = tileAsset();
        const depth = r.depth();
        if (assetId === undefined || depth === undefined) break;
        const type = ambientKindOf(manifest.assets[assetId]);
        if (!type || type === "swim" || type === "particles") {
          r.fail("assetId", `«${assetId}» no es un efecto colocable como objeto (los patos son polilíneas «Swim» y las partículas, rectángulos «Particles»)`);
          break;
        }
        const declared = r.str("ambientType", false);
        if (declared !== undefined && r.from("ambientType") !== "class" && declared !== type) {
          r.fail("ambientType", `«${declared}» no corresponde a «${assetId}», que es un efecto de tipo «${type}»`);
          break;
        }
        const g = geometryOf("ambient", manifest.assets[assetId], signScale);
        if (!g) {
          r.fail("assetId", `«${assetId}» no declara la metadata para colocarlo`);
          break;
        }
        const k = scaleOf(g, g.baseW, g.baseH);
        const marks = r.explicit();
        const alpha = r.has("alpha") ? r.num("alpha", true, { min: 0, max: 1 }) : undefined;
        const speed = r.has("speedFactor") ? r.num("speedFactor", true, { exclusiveMin: 0 }) : undefined;
        if (flipH && type !== "animation") r.fail("gid", `«${type}» no admite reflejo horizontal (solo las animaciones tienen flipX). Deshaz el volteo en Tiled (Objects › Flip Horizontally, tecla X).`);
        if (type !== "animation" && type !== "glow" && r.has("alpha")) r.fail("alpha", `«${type}» no admite alpha`);
        if (type !== "animation" && r.has("speedFactor")) r.fail("speedFactor", `«${type}» no admite speedFactor`);
        if (k === undefined || r.failed) break;
        const position = { x: clean(left + g.origin.x * w), y: clean(top + g.origin.y * h) };
        const fx: Record<string, unknown> = { type, assetId, position };
        if (!near(k, 1, 1e-9) || marks.has("scale")) fx.scale = k;
        if (type === "animation" && (flipH || marks.has("flipX"))) fx.flipX = flipH;
        if (alpha !== undefined) fx.alpha = alpha;
        if (speed !== undefined) fx.speedFactor = speed;
        fx.depth = depth;
        ambient.push(fx as unknown as AmbientEffect);
        record(`maps.${zoneKey}.ambient[${ambient.length - 1}]`);
        break;
      }
      case "Critter": {
        if (!checkRole("critter")) break;
        const assetId = tileAsset();
        const type = r.str("critterType");
        const radius = r.num("radius", true, { exclusiveMin: 0, max: CRITTER_LIMITS.radius });
        if (assetId === undefined || type === undefined || radius === undefined || !kindIn(assetId, ["critter-sheet"])) break;
        if (type !== "wander" && type !== "family") {
          r.fail("critterType", `debe ser «wander» o «family» (es «${type}»)`);
          break;
        }
        const g = geometryOf("critter", manifest.assets[assetId], signScale);
        if (!g) {
          r.fail("assetId", `«${assetId}» no declara sourceFrameSize y recommendedDisplay`);
          break;
        }
        const k = scaleOf(g, g.baseW, g.baseH);
        const marks = r.explicit();
        let chickAssetId: string | undefined;
        let chicks: number | undefined;
        let chickScale: number | undefined;
        if (type === "family") {
          if (flipH) r.fail("gid", "una familia no admite reflejo horizontal (no tiene el campo flipX). Deshaz el volteo en Tiled (Objects › Flip Horizontally, tecla X).");
          chickAssetId = r.str("chickAssetId");
          chicks = r.num("chicks", true, { int: true, min: 1, max: CRITTER_LIMITS.chicks });
          if (chickAssetId !== undefined && !manifest.assets[chickAssetId]) r.fail("chickAssetId", `asset ID no encontrado en assets.json: «${chickAssetId}»`);
          else if (chickAssetId !== undefined) kindIn(chickAssetId, ["critter-sheet"], "chickAssetId");
          if (r.has("chickScale")) chickScale = r.num("chickScale", true, { exclusiveMin: 0, max: CRITTER_LIMITS.chickScale });
        }
        if (k !== undefined && k > CRITTER_LIMITS.scale) {
          r.fail(undefined, `el animal mide ${clean(k)} veces su tamaño recomendado y el máximo es ${CRITTER_LIMITS.scale} (≈ ${Math.round(CRITTER_LIMITS.scale * g.baseW)} × ${Math.round(CRITTER_LIMITS.scale * g.baseH)} px; ahora ${clean(w)} × ${clean(h)} px): hazlo más pequeño`);
        }
        if (k === undefined || r.failed) break;
        const position = { x: clean(left + g.origin.x * w), y: clean(top + g.origin.y * h) };
        const c: Record<string, unknown> = type === "family" ? { type, assetId, chickAssetId, chicks, position, radius } : { type, assetId, position, radius };
        if (!near(k, 1, 1e-9) || marks.has("scale")) c.scale = k;
        if (type === "family" && chickScale !== undefined) c.chickScale = chickScale;
        if (type === "wander" && (flipH || marks.has("flipX"))) c.flipX = flipH;
        critters.push(c as unknown as Critter);
        record(`maps.${zoneKey}.critters[${critters.length - 1}]`);
        break;
      }
      case "Particles": {
        const assetId = r.str("assetId");
        const frequencyMs = r.num("frequencyMs", true, { exclusiveMin: 0 });
        const depth = r.depth();
        const scale = r.has("scale") ? r.num("scale", true, { exclusiveMin: 0 }) : undefined;
        if (obj.gid !== undefined || obj.ellipse || obj.point || obj.polygon || obj.polyline) r.fail(undefined, "el área de partículas debe ser un rectángulo");
        else if (!(w > 0 && h > 0)) r.fail(undefined, "el área de partículas necesita un ancho y un alto positivos");
        if (assetId === undefined || frequencyMs === undefined || depth === undefined) break;
        if (!manifest.assets[assetId]) r.fail("assetId", `asset ID no encontrado en assets.json: «${assetId}»`);
        else if (ambientKindOf(manifest.assets[assetId]) !== "particles") r.fail("assetId", `«${assetId}» no es una partícula`);
        if (r.failed) break;
        const fx: Record<string, unknown> = { type: "particles", assetId, area: { x: clean(left), y: clean(top), width: clean(w), height: clean(h) }, frequencyMs };
        if (scale !== undefined) fx.scale = scale;
        fx.depth = depth;
        ambient.push(fx as unknown as AmbientEffect);
        record(`maps.${zoneKey}.ambient[${ambient.length - 1}]`);
        break;
      }
      case "Swim": {
        const assetId = r.str("assetId");
        const depth = r.depth();
        const scale = r.has("scale") ? r.num("scale", true, { exclusiveMin: 0 }) : undefined;
        const speed = r.has("speedFactor") ? r.num("speedFactor", true, { exclusiveMin: 0 }) : undefined;
        if (!obj.polyline) r.fail(undefined, "la trayectoria debe ser una polilínea");
        else if (obj.polyline.length < 2) r.fail(undefined, "la trayectoria necesita al menos dos puntos");
        if (assetId === undefined || depth === undefined) break;
        if (!manifest.assets[assetId]) r.fail("assetId", `asset ID no encontrado en assets.json: «${assetId}»`);
        else if (ambientKindOf(manifest.assets[assetId]) !== "swim") r.fail("assetId", `«${assetId}» no es un nadador (hoja animada con motion «swim»)`);
        if (r.failed || !obj.polyline) break;
        const path = obj.polyline.map((p) => ({ x: clean(left + p.x), y: clean(top + p.y) }));
        const fx: Record<string, unknown> = { type: "swim", assetId, path };
        if (scale !== undefined) fx.scale = scale;
        if (speed !== undefined) fx.speedFactor = speed;
        fx.depth = depth;
        ambient.push(fx as unknown as AmbientEffect);
        record(`maps.${zoneKey}.ambient[${ambient.length - 1}]`);
        break;
      }
      case "Collision": {
        if (obj.gid !== undefined || obj.point || obj.polygon || obj.polyline || obj.text) {
          r.fail(undefined, "las colisiones admitidas son rectángulos sin rotación y círculos (elipses con ancho y alto iguales)");
          break;
        }
        if (!(w > 0 && h > 0)) {
          r.fail(undefined, "la colisión necesita un ancho y un alto positivos");
          break;
        }
        if (obj.ellipse) {
          if (!near(w, h)) {
            r.fail(undefined, `una elipse solo se importa como círculo: ancho y alto deben ser iguales (${clean(w)} × ${clean(h)})`);
            break;
          }
          obstacles.push({ type: "circle", x: clean(left + w / 2), y: clean(top + h / 2), radius: clean(w / 2) });
        } else obstacles.push({ type: "rect", x: clean(left), y: clean(top), width: clean(w), height: clean(h) });
        record(`maps.${zoneKey}.obstacles[${obstacles.length - 1}]`);
        break;
      }
      case "Spawn": {
        const spawnId = r.str("spawnId");
        if (!obj.point) r.fail(undefined, "un punto de aparición debe ser un punto");
        if (spawnId === undefined) break;
        if (Object.hasOwn(spawns, spawnId)) r.fail("spawnId", `el punto de aparición «${spawnId}» está repetido en esta zona`);
        if (r.failed) break;
        spawns[spawnId] = { x: clean(left), y: clean(top) };
        record(`maps.${zoneKey}.spawns.${spawnId}`);
        break;
      }
      case "Portal": {
        const portalId = r.str("portalId");
        const portalLabel = r.str("label");
        const targetZoneId = r.str("targetZoneId");
        const targetSpawnId = r.str("targetSpawnId");
        if (!obj.ellipse) r.fail(undefined, "el portal debe ser un círculo (una elipse con ancho y alto iguales) centrado en su punto de interacción");
        else if (!(w > 0) || !near(w, h)) r.fail(undefined, `el círculo del portal necesita ancho y alto iguales y positivos (${clean(w)} × ${clean(h)})`);
        if (portalId === undefined || portalLabel === undefined || targetZoneId === undefined || targetSpawnId === undefined) break;
        if (Object.hasOwn(portals, portalId)) r.fail("portalId", `el portal «${portalId}» está repetido en esta zona`);
        if (r.failed) break;
        portals[portalId] = { label: portalLabel, interaction: { x: clean(left + w / 2), y: clean(top + h / 2), radius: clean(w / 2) }, targetZoneId, targetSpawnId };
        record(`maps.${zoneKey}.portals.${portalId}`);
        break;
      }
    }
  }

  if (issues.length > 0 || zoneId === undefined || label === undefined || initialSpawnId === undefined) return { issues, warnings };
  const zone: MapZone = { label, width, height, layers, initialSpawnId, spawns, obstacles, decorations, ambient, ...(critters.length ? { critters } : {}), portals };
  return { result: { zoneId, file: fileName, zone, stations, sources }, issues, warnings };
}

const resolve_ = (dir: string, rel: string): string => resolvePath(dir, rel);
