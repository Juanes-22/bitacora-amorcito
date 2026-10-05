// Subconjunto del formato JSON de Tiled (mapas .tmj, tilesets .tsj y proyecto .tiled-project) que usa la integración.
// Referencia: https://doc.mapeditor.org/en/stable/reference/json-map-format/ (Tiled 1.12).

export type TiledPropertyType = "string" | "int" | "float" | "bool" | "color" | "file" | "object" | "class";

export interface TiledProperty {
  name: string;
  type?: TiledPropertyType;
  /** Tipo personalizado (enum o clase) de la propiedad. Tiled 1.12 escribe `propertytype`; el proyecto usa `propertyType`. */
  propertytype?: string;
  value: unknown;
}

export interface TiledObject {
  id: number;
  name?: string;
  /** Tiled ≥ 1.9 escribe `class`; las versiones anteriores, `type`. */
  class?: string;
  type?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible?: boolean;
  gid?: number;
  point?: boolean;
  ellipse?: boolean;
  polygon?: Array<{ x: number; y: number }>;
  polyline?: Array<{ x: number; y: number }>;
  text?: unknown;
  template?: string;
  properties?: TiledProperty[];
}

interface LayerBase {
  id: number;
  name: string;
  class?: string;
  type: string;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  offsetx?: number;
  offsety?: number;
  parallaxx?: number;
  parallaxy?: number;
  tintcolor?: string;
  x?: number;
  y?: number;
  properties?: TiledProperty[];
}

export interface TiledImageLayer extends LayerBase {
  type: "imagelayer";
  image: string;
  imagewidth?: number;
  imageheight?: number;
  repeatx?: boolean;
  repeaty?: boolean;
  transparentcolor?: string;
}

export interface TiledObjectLayer extends LayerBase {
  type: "objectgroup";
  draworder?: string;
  objects: TiledObject[];
}

export interface TiledGroupLayer extends LayerBase {
  type: "group";
  layers: TiledLayer[];
}

export interface TiledTileLayer extends LayerBase {
  type: "tilelayer";
  [key: string]: unknown;
}

export type TiledLayer = TiledImageLayer | TiledObjectLayer | TiledGroupLayer | TiledTileLayer;

export interface TiledTile {
  id: number;
  class?: string;
  type?: string;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  properties?: TiledProperty[];
}

export interface TiledTileset {
  type?: "tileset";
  name: string;
  version?: string;
  tiledversion?: string;
  tilewidth: number;
  tileheight: number;
  tilecount?: number;
  columns?: number;
  margin?: number;
  spacing?: number;
  objectalignment?: string;
  grid?: { orientation: string; width: number; height: number };
  tiles?: TiledTile[];
  properties?: TiledProperty[];
  class?: string;
  image?: string;
}

export interface TiledMapTilesetRef {
  firstgid: number;
  /** Tileset externo (ruta relativa al mapa). Los embebidos traen sus campos en el propio objeto. */
  source?: string;
  [key: string]: unknown;
}

export interface TiledMap {
  type?: "map";
  version?: string;
  tiledversion?: string;
  orientation: string;
  renderorder?: string;
  infinite?: boolean;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  nextlayerid?: number;
  nextobjectid?: number;
  compressionlevel?: number;
  class?: string;
  layers: TiledLayer[];
  tilesets: TiledMapTilesetRef[];
  properties?: TiledProperty[];
  [key: string]: unknown;
}

// -- Proyecto (.tiled-project) -----------------------------------------------------------------------------------------

export interface ProjectMember {
  name: string;
  type: TiledPropertyType;
  propertyType?: string;
  value: unknown;
}

export interface ProjectEnum {
  id: number;
  name: string;
  type: "enum";
  storageType: "string" | "int";
  values: string[];
  valuesAsFlags: boolean;
}

export interface ProjectClass {
  id: number;
  name: string;
  type: "class";
  color: string;
  drawFill?: boolean;
  members: ProjectMember[];
  useAs: string[];
}

export type ProjectPropertyType = ProjectEnum | ProjectClass;

export interface TiledProject {
  automappingRulesFile?: string;
  commands?: unknown[];
  compatibilityVersion?: number;
  extensionsPath?: string;
  folders?: string[];
  properties?: unknown[];
  propertyTypes?: ProjectPropertyType[];
  [key: string]: unknown;
}

// -- Resultado de leer los archivos ---------------------------------------------------------------------------------------

/** Dónde se encontró algo en los archivos de Tiled: para mensajes de error precisos. */
export interface Source {
  file: string;
  layer?: string;
  objectId?: number;
  objectName?: string;
  property?: string;
}

export interface TiledIssue {
  source: Source;
  message: string;
}

export const formatSource = (s: Source): string =>
  [s.file, s.layer ? `capa «${s.layer}»` : "", s.objectId !== undefined ? `objeto #${s.objectId}${s.objectName ? ` «${s.objectName}»` : ""}` : "", s.property ? `propiedad «${s.property}»` : ""]
    .filter(Boolean)
    .join(" › ");

export const formatIssue = (i: TiledIssue): string => `${formatSource(i.source)}: ${i.message}`;
