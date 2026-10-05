import type { AmbientEffect, AssetManifest, BitacoraConfig, Critter, Placement } from "../../../src/config/types";
import { geometryOf, ROLE_CLASS, tileKey, type Role } from "./catalog";
import type { TiledImageLayer, TiledMap, TiledObject, TiledObjectLayer, TiledProperty } from "./types";
import { encodeGid, prop, tidy } from "./util";

export class ExportError extends Error {}

/** Capa de imagen → nombre de la capa en Tiled (el rol de la capa en el catálogo, en español). */
const LAYER_NAMES: Record<string, string> = { horizon: "horizonte", terrain: "terreno", midground: "medio", foreground: "primer-plano" };

export interface ExportContext {
  config: BitacoraConfig;
  manifest: AssetManifest;
  /** ID de tile del catálogo por `tileKey(rol, assetId)`. */
  tileIds: Map<string, number>;
  firstgid: number;
  /** Ruta del tileset desde el mapa. */
  tilesetSource: string;
  /** Ruta de `public/assets` desde el mapa. */
  assetsBase: string;
  /** Tamaño de la celda del editor (px). */
  cell: number;
}

const last = (assetId: string): string => assetId.split(".").pop() as string;

function depthProps(d: { mode: "fixed"; value: number } | { mode: "y"; offset: number }): TiledProperty[] {
  return [prop("depthMode", d.mode, "DepthMode"), prop("depth", d.mode === "fixed" ? d.value : d.offset)];
}

/** Rango de enteros de la celda: la rejilla de ayuda de 2 px cuando las dimensiones son pares; si no, de 1 px. */
export const cellSizeFor = (width: number, height: number): number => (Number.isInteger(width / 2) && Number.isInteger(height / 2) ? 2 : 1);

/**
 * Mapa de Tiled de una zona de `bitacora.json`: las capas del paisaje y un objeto por cada elemento colocado, con sus
 * posiciones, tamaños y propiedades convertidos (SPEC: «Tiled»). Cada objeto lleva todas las propiedades explícitas; lo que
 * no se escribe es porque el dato también falta en la configuración (un opcional omitido sigue omitido).
 */
export function exportZone(ctx: ExportContext, zoneId: string): TiledMap {
  const { config, manifest } = ctx;
  const zone = config.maps[zoneId];
  if (!zone) throw new ExportError(`la zona «${zoneId}» no existe en maps`);
  let nextObject = 1;
  let nextLayer = 1;
  const signScale = config.gameplay.signScale;

  const tile = (role: Role, assetId: string, where: string): number => {
    const id = ctx.tileIds.get(tileKey(role, assetId));
    if (id === undefined) throw new ExportError(`${where}: «${assetId}» no está en el catálogo de Tiled como «${role}»; ejecuta npm run tiled:catalog`);
    return id;
  };
  const object = (o: Omit<TiledObject, "id" | "rotation" | "visible">): TiledObject => ({ id: nextObject++, rotation: 0, visible: true, ...o });

  /** Objeto-tile de `role` con su esquina superior izquierda deducida del punto de anclaje de la configuración. */
  const tileObject = (role: Role, assetId: string, where: string, name: string, at: { x: number; y: number }, size: { w: number; h: number }, origin: { x: number; y: number }, flipX: boolean, props: TiledProperty[]): TiledObject =>
    object({
      name,
      class: ROLE_CLASS[role],
      gid: encodeGid(ctx.firstgid + tile(role, assetId, where), flipX),
      x: tidy(at.x - origin.x * size.w),
      y: tidy(at.y - origin.y * size.h),
      width: tidy(size.w),
      height: tidy(size.h),
      properties: props,
    });

  const entryOf = (assetId: string, where: string) => {
    const e = manifest.assets[assetId];
    if (!e) throw new ExportError(`${where}: asset «${assetId}» no encontrado en assets.json`);
    return e;
  };
  const geometry = (role: Role, assetId: string, where: string) => {
    const g = geometryOf(role, entryOf(assetId, where), signScale);
    if (!g) throw new ExportError(`${where}: «${assetId}» no declara la metadata para colocarlo como «${role}»`);
    return g;
  };
  const explicit = (fields: string[]): TiledProperty[] => (fields.length ? [prop("explicit", fields.join(","))] : []);

  // -- Capas de imagen -------------------------------------------------------------------------------------------------
  const imageLayer = (assetId: string, depth: number, i: number): TiledImageLayer => {
    const e = entryOf(assetId, `maps.${zoneId}.layers[${i}]`);
    return {
      id: nextLayer++,
      type: "imagelayer",
      name: (e.layer && LAYER_NAMES[e.layer]) || last(assetId),
      class: "BackgroundLayer",
      locked: true,
      image: `${ctx.assetsBase}/${e.path}`,
      imagewidth: e.width,
      imageheight: e.height,
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
      properties: [prop("assetId", assetId), prop("depth", depth)],
    };
  };
  const below: TiledImageLayer[] = [];
  const above: TiledImageLayer[] = [];
  zone.layers.forEach((l, i) => (l.depth >= zone.height ? above : below).push(imageLayer(l.assetId, l.depth, i)));

  const objectLayer = (name: string, objects: TiledObject[], extra: TiledProperty[] = []): TiledObjectLayer => ({
    id: nextLayer++,
    type: "objectgroup",
    name,
    draworder: "topdown",
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
    objects,
    ...(extra.length ? { properties: extra } : {}),
  });

  // -- Ambiente --------------------------------------------------------------------------------------------------------
  const ambient: TiledObject[] = zone.ambient.map((fx, i) => ambientObject(fx, i));
  function ambientObject(fx: AmbientEffect, i: number): TiledObject {
    const where = `maps.${zoneId}.ambient[${i}]`;
    if (fx.type === "particles") {
      const props = [prop("assetId", fx.assetId, "ParticleAsset"), prop("frequencyMs", fx.frequencyMs), ...depthProps(fx.depth)];
      if (fx.scale !== undefined) props.push(prop("scale", fx.scale));
      return object({ name: last(fx.assetId), class: "Particles", x: fx.area.x, y: fx.area.y, width: fx.area.width, height: fx.area.height, properties: props });
    }
    if (fx.type === "swim") {
      const [first] = fx.path;
      const props = [prop("assetId", fx.assetId, "SwimAsset"), ...depthProps(fx.depth)];
      if (fx.scale !== undefined) props.push(prop("scale", fx.scale));
      if (fx.speedFactor !== undefined) props.push(prop("speedFactor", fx.speedFactor));
      return object({ name: last(fx.assetId), class: "Swim", x: first.x, y: first.y, width: 0, height: 0, polyline: fx.path.map((p) => ({ x: tidy(p.x - first.x), y: tidy(p.y - first.y) })), properties: props });
    }
    const g = geometry("ambient", fx.assetId, where);
    const m = fx.scale ?? 1;
    const props = [prop("assetId", fx.assetId), prop("ambientType", fx.type, "AmbientType"), ...depthProps(fx.depth)];
    const marks: string[] = [];
    if (fx.scale === 1) marks.push("scale");
    if (fx.type === "animation") {
      if (fx.flipX === false) marks.push("flipX");
      if (fx.alpha !== undefined) props.push(prop("alpha", fx.alpha));
      if (fx.speedFactor !== undefined) props.push(prop("speedFactor", fx.speedFactor));
    } else if (fx.type === "glow" && fx.alpha !== undefined) props.push(prop("alpha", fx.alpha));
    return tileObject("ambient", fx.assetId, where, last(fx.assetId), fx.position, { w: g.baseW * m, h: g.baseH * m }, g.origin, fx.type === "animation" && fx.flipX === true, [...props, ...explicit(marks)]);
  }

  // -- Animales --------------------------------------------------------------------------------------------------------
  const critters: TiledObject[] = (zone.critters ?? []).map((k, i) => critterObject(k, i));
  function critterObject(k: Critter, i: number): TiledObject {
    const where = `maps.${zoneId}.critters[${i}]`;
    const g = geometry("critter", k.assetId, where);
    const m = k.scale ?? 1;
    const props = [prop("assetId", k.assetId), prop("critterType", k.type, "CritterType"), prop("radius", k.radius)];
    const marks: string[] = [];
    if (k.scale === 1) marks.push("scale");
    if (k.type === "family") {
      props.push(prop("chickAssetId", k.chickAssetId, "CritterAsset"), prop("chicks", k.chicks));
      if (k.chickScale !== undefined) props.push(prop("chickScale", k.chickScale));
    } else if (k.flipX === false) marks.push("flipX");
    return tileObject("critter", k.assetId, where, `${last(k.assetId)}${k.type === "family" ? " + pollitos" : ""}`, k.position, { w: g.baseW * m, h: g.baseH * m }, g.origin, k.type === "wander" && k.flipX === true, [...props, ...explicit(marks)]);
  }

  // -- Decoraciones ----------------------------------------------------------------------------------------------------
  const decorations: TiledObject[] = zone.decorations.map((d, i) => {
    const where = `maps.${zoneId}.decorations[${i}]`;
    const g = geometry("decoration", d.assetId, where);
    const props = [prop("assetId", d.assetId), prop("originX", d.origin.x), prop("originY", d.origin.y), ...depthProps(d.depth)];
    return tileObject("decoration", d.assetId, where, last(d.assetId), d.position, { w: g.logicalW * d.scale, h: g.logicalH * d.scale }, d.origin, false, props);
  });

  // -- Estaciones (una por aprendizaje activo de la zona) ----------------------------------------------------------------
  const stations: TiledObject[] = [];
  config.route.forEach((id) => {
    const p: Placement | undefined = config.placements[id];
    if (!p || p.zoneId !== zoneId) return;
    const where = `placements.${id}`;
    const sign = p.signAssetId ?? config.ui.assets.stationSign;
    const g = geometry("station", sign, where);
    const title = config.learnings[id]?.signTitle ?? config.learnings[id]?.title ?? id;
    const props = [prop("learningId", id), prop("interactionOffsetX", p.interactionOffset.x), prop("interactionOffsetY", p.interactionOffset.y), prop("interactionRadius", p.interactionRadius)];
    if (p.signAssetId !== undefined) props.push(prop("signAssetId", p.signAssetId));
    if (p.decorationAssetId !== undefined) props.push(prop("decorationAssetId", p.decorationAssetId));
    if (p.decorationOffset !== undefined) props.push(prop("decorationOffsetX", p.decorationOffset.x), prop("decorationOffsetY", p.decorationOffset.y));
    stations.push(tileObject("station", sign, where, `${id} · ${title}`, p.position, { w: g.baseW, h: g.baseH }, g.origin, false, props));
  });

  // -- Puntos de aparición y portales ----------------------------------------------------------------------------------
  const points: TiledObject[] = [
    ...Object.entries(zone.spawns).map(([spawnId, p]) => object({ name: spawnId, class: "Spawn", x: p.x, y: p.y, width: 0, height: 0, point: true, properties: [prop("spawnId", spawnId)] })),
    ...Object.entries(zone.portals).map(([portalId, p]) => {
      const r = p.interaction.radius;
      return object({
        name: portalId,
        class: "Portal",
        x: tidy(p.interaction.x - r),
        y: tidy(p.interaction.y - r),
        width: 2 * r,
        height: 2 * r,
        ellipse: true,
        properties: [prop("portalId", portalId), prop("label", p.label), prop("targetZoneId", p.targetZoneId), prop("targetSpawnId", p.targetSpawnId)],
      });
    }),
  ];

  // -- Colisiones ------------------------------------------------------------------------------------------------------
  const collisions: TiledObject[] = zone.obstacles.map((o) =>
    o.type === "rect"
      ? object({ class: "Collision", x: o.x, y: o.y, width: o.width, height: o.height })
      : object({ class: "Collision", x: tidy(o.x - o.radius), y: tidy(o.y - o.radius), width: 2 * o.radius, height: 2 * o.radius, ellipse: true }),
  );

  const layers = [
    ...below,
    objectLayer("ambiente", ambient),
    objectLayer("animales", critters),
    objectLayer("decoraciones", decorations),
    objectLayer("estaciones", stations),
    ...above,
    objectLayer("puntos", points),
    objectLayer("colisiones", collisions, [prop("defaultClass", "Collision")]),
  ];

  return {
    type: "map",
    class: "Zone",
    version: "1.10",
    tiledversion: "1.12.2",
    orientation: "orthogonal",
    renderorder: "right-down",
    infinite: false,
    compressionlevel: -1,
    width: zone.width / ctx.cell,
    height: zone.height / ctx.cell,
    tilewidth: ctx.cell,
    tileheight: ctx.cell,
    nextlayerid: nextLayer,
    nextobjectid: nextObject,
    tilesets: [{ firstgid: ctx.firstgid, source: ctx.tilesetSource }],
    properties: [prop("zoneId", zoneId), prop("label", zone.label), prop("initialSpawnId", zone.initialSpawnId)],
    layers,
  };
}

