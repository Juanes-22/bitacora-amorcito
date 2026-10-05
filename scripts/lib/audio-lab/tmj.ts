import type { MapSound } from "../../../src/config/types";
import { SOUND_PROPERTY_NAMES, soundProperties, soundShape } from "../tiled/sounds";
import type { TiledLayer, TiledMap, TiledObject, TiledObjectLayer, TiledProperty } from "../tiled/types";
import { classOf, isRecord, propsOf, tidy } from "../tiled/util";

// Parcheo de un mapa de Tiled ya existente para los sonidos (SPEC 6.5): se añade la capa `sonidos` y se crea o actualiza UN objeto,
// conservando su id numérico, las propiedades que no gestiona la integración, su capa y todos los demás objetos. Nunca se regenera el mapa.

export const SOUND_LAYER = "sonidos";
const SOUND_CLASSES = new Set(["SoundEmitter", "SoundArea"]);
const MANAGED = new Set<string>(SOUND_PROPERTY_NAMES);

const isEditorOnly = (o: { class?: string; type?: string; properties?: TiledProperty[] }): boolean => classOf(o) === "EditorOnly" || propsOf(o.properties).get("editorOnly")?.value === true;

export interface LocatedSound {
  obj: TiledObject;
  layer: TiledObjectLayer;
  /** Desplazamiento acumulado de la capa y sus grupos: lo que hay que sumar a las coordenadas del objeto para obtener las del mundo. */
  dx: number;
  dy: number;
}

/** Busca el objeto de sonido con ese `soundId` (los de capas marcadas `EditorOnly` no cuentan: el importador los ignora). */
export function findSoundObject(map: TiledMap, soundId: string): LocatedSound | undefined {
  let found: LocatedSound | undefined;
  const walk = (layers: TiledLayer[], dx: number, dy: number) => {
    for (const layer of layers) {
      if (found || isEditorOnly(layer)) continue;
      const ox = dx + (layer.offsetx ?? 0);
      const oy = dy + (layer.offsety ?? 0);
      if (layer.type === "group") walk(layer.layers, ox, oy);
      else if (layer.type === "objectgroup") {
        for (const obj of layer.objects) {
          if (isEditorOnly(obj) || !SOUND_CLASSES.has(classOf(obj))) continue;
          if (propsOf(obj.properties).get("soundId")?.value === soundId) {
            found = { obj, layer, dx: ox, dy: oy };
            return;
          }
        }
      }
    }
  };
  walk(map.layers ?? [], 0, 0);
  return found;
}

/** El objeto con las claves ordenadas: así dos objetos iguales se comparan como iguales aunque sus claves estén en otro orden. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_key, value: unknown) => (isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]])) : value));

const maxId = (ids: number[]): number => ids.reduce((m, n) => Math.max(m, n), 0);

function allLayers(layers: TiledLayer[]): TiledLayer[] {
  return layers.flatMap((l) => (l.type === "group" ? [l, ...allLayers(l.layers)] : [l]));
}

function nextLayerId(map: TiledMap): number {
  const id = map.nextlayerid ?? maxId(allLayers(map.layers).map((l) => l.id)) + 1;
  map.nextlayerid = id + 1;
  return id;
}

function nextObjectId(map: TiledMap): number {
  const objects = allLayers(map.layers).flatMap((l) => (l.type === "objectgroup" ? l.objects.map((o) => o.id) : []));
  const id = Math.max(map.nextobjectid ?? 0, maxId(objects) + 1);
  map.nextobjectid = id + 1;
  return id;
}

/**
 * La capa de objetos `sonidos` de primer nivel; si el mapa no la tiene la añade, vacía, tras `puntos` (o antes de `colisiones`, o al
 * final). Devuelve si hubo que añadirla.
 */
export function ensureSoundLayer(map: TiledMap): { layer: TiledObjectLayer; added: boolean } {
  const existing = map.layers.find((l): l is TiledObjectLayer => l.type === "objectgroup" && l.name === SOUND_LAYER);
  if (existing) return { layer: existing, added: false };
  const layer: TiledObjectLayer = { id: nextLayerId(map), type: "objectgroup", name: SOUND_LAYER, draworder: "topdown", opacity: 1, visible: true, x: 0, y: 0, objects: [] };
  const after = map.layers.findIndex((l) => l.name === "puntos");
  const before = map.layers.findIndex((l) => l.name === "colisiones");
  const at = after >= 0 ? after + 1 : before >= 0 ? before : map.layers.length;
  map.layers.splice(at, 0, layer);
  return { layer, added: true };
}

/** Aplica las propiedades deseadas a un objeto: sustituye las gestionadas (en su sitio), quita las que ya no corresponden y añade las que faltan; las ajenas quedan igual. */
function applyProperties(obj: TiledObject, desired: TiledProperty[]): void {
  const wanted = new Map(desired.map((p) => [p.name, p]));
  const out: TiledProperty[] = [];
  for (const p of obj.properties ?? []) {
    if (!MANAGED.has(p.name)) out.push(p);
    else if (wanted.has(p.name)) {
      out.push(wanted.get(p.name) as TiledProperty);
      wanted.delete(p.name);
    }
  }
  out.push(...wanted.values());
  obj.properties = out;
}

export interface PatchResult {
  action: "created" | "updated" | "unchanged";
  objectId: number;
  layer: string;
}

export class PatchError extends Error {}

/**
 * Crea o actualiza el objeto de `soundId` con los valores de `sound` (coordenadas del mundo). Para uno existente solo cambia sus
 * propiedades gestionadas y su posición o tamaño (convertidos a las coordenadas locales de su capa y grupos); su forma (punto o
 * rectángulo) no puede cambiar.
 */
export function patchSound(map: TiledMap, soundId: string, sound: MapSound): PatchResult {
  const located = findSoundObject(map, soundId);
  if (!located) {
    const { layer } = ensureSoundLayer(map);
    const obj: TiledObject = { id: nextObjectId(map), name: soundId, ...soundShape(sound), rotation: 0, visible: true, properties: soundProperties(soundId, sound) };
    layer.objects.push(obj);
    return { action: "created", objectId: obj.id, layer: layer.name };
  }
  const { obj, layer, dx, dy } = located;
  const before = canonical(obj);
  const wantsPoint = sound.shape === "point";
  if (wantsPoint !== (classOf(obj) === "SoundEmitter")) throw new PatchError(`«${soundId}» es ${wantsPoint ? "un área" : "un emisor"} en Tiled: no se cambia su forma desde el laboratorio`);
  const shape = soundShape(sound);
  obj.x = tidy(shape.x - dx);
  obj.y = tidy(shape.y - dy);
  if (!wantsPoint) {
    obj.width = shape.width;
    obj.height = shape.height;
  }
  applyProperties(obj, soundProperties(soundId, sound));
  return { action: canonical(obj) === before ? "unchanged" : "updated", objectId: obj.id, layer: layer.name };
}

/** Los sonidos que ya están en el mapa, por `soundId` (para listar o comprobar). */
export function listSoundIds(map: TiledMap): string[] {
  const ids: string[] = [];
  for (const layer of allLayers(map.layers)) {
    if (layer.type !== "objectgroup" || isEditorOnly(layer)) continue;
    for (const o of layer.objects) {
      const id = propsOf(o.properties).get("soundId")?.value;
      if (SOUND_CLASSES.has(classOf(o)) && typeof id === "string" && !isEditorOnly(o)) ids.push(id);
    }
  }
  return ids;
}

export const isTiledMap = (v: unknown): v is TiledMap => isRecord(v) && Array.isArray(v.layers);
