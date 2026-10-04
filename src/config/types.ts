// Tipos de los dos contratos externos. Se contrastan con bitacora.schema.json y
// assets.schema.json en src/tests/config.test.ts: no sustituyen a la validación en runtime.

export type AppMode = "demo" | "final";
export type SectionId = "learning" | "reflection" | "lived";
export type DialogueEvent = "open" | "locked" | "completed" | "reward";
export type Point = { x: number; y: number };

export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "image"; assetId: string; alt: string; caption?: string }
  | { type: "quote"; text: string; source?: string }
  | { type: "reference"; label: string; url?: string };

export interface ProjectConfig {
  title: string;
  studentName: string;
  university: string;
  program: string;
  semester: string;
  courseName: string;
  teacherName: string | null;
  welcomeText: string;
  finalReflection: ContentBlock[];
}

export interface Learning {
  title: string;
  topic: string;
  /** Título corto que va en el letrero de la estación (cabe en dos líneas); sin él se usa `title`. */
  signTitle?: string;
  editorialStatus: "demo" | "draft" | "ready";
  contentRevision: number;
  badgeId: string;
  sections: Record<SectionId, ContentBlock[]>;
  dialogueOverrides?: Partial<Record<DialogueEvent, string>>;
}

export interface Badge {
  title: string;
  description: string;
  assetId: string;
  xp: number;
}

export interface Dialogue {
  lines: Array<{ speaker: "vanessa" | "narrator"; text: string; portraitAssetId?: string }>;
}

export interface Placement {
  zoneId: string;
  position: Point;
  interactionOffset: Point;
  interactionRadius: number;
  signAssetId?: string;
  decorationAssetId?: string;
  decorationOffset?: Point;
}

export type Obstacle =
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "circle"; x: number; y: number; radius: number };

export interface Decoration {
  assetId: string;
  position: Point;
  origin: Point;
  scale: number;
  depth: { mode: "fixed"; value: number } | { mode: "y"; offset: number };
}

/** Capa de fondo elegida explícitamente (SPEC 3.1); `depth` fija su orden de dibujo. */
export interface MapLayer {
  assetId: string;
  depth: number;
}

export interface Portal {
  label: string;
  interaction: Point & { radius: number };
  targetZoneId: string;
  targetSpawnId: string;
}

export type Rect = { x: number; y: number; width: number; height: number };
export type AmbientDepth = { mode: "fixed"; value: number } | { mode: "y"; offset: number };

/**
 * Animación ambiental (SPEC 3.2). `scale` multiplica la `recommendedScale` del asset (por defecto 1); el origen, los
 * fotogramas y el movimiento salen de la metadata del manifiesto, no se repiten aquí.
 */
export type AmbientEffect =
  | { type: "animation"; assetId: string; position: Point; scale?: number; flipX?: boolean; alpha?: number; speedFactor?: number; depth: AmbientDepth }
  | { type: "sway"; assetId: string; position: Point; scale?: number; depth: AmbientDepth }
  | { type: "drift"; assetId: string; position: Point; scale?: number; depth: AmbientDepth }
  | { type: "particles"; assetId: string; area: Rect; frequencyMs: number; scale?: number; depth: AmbientDepth }
  | { type: "glow"; assetId: string; position: Point; scale?: number; alpha?: number; depth: AmbientDepth }
  | { type: "swim"; assetId: string; path: Point[]; scale?: number; speedFactor?: number; depth: AmbientDepth };

/**
 * Un animalito (o una familia) que anda por la zona (SPEC 3.3). Merodea dentro de `radius` alrededor de `position` (las patas):
 * reposa, picotea y da paseos cortos. `scale` multiplica el tamaño recomendado del asset. Las gallinas no chocan con nada: el
 * mapa decide dónde caben (pasto despejado) y la configuración lo respeta.
 */
export type Critter =
  | { type: "wander"; assetId: string; position: Point; radius: number; scale?: number; flipX?: boolean }
  | { type: "family"; assetId: string; chickAssetId: string; chicks: number; position: Point; radius: number; scale?: number; chickScale?: number };

export interface MapZone {
  label: string;
  width: number;
  height: number;
  layers: MapLayer[];
  initialSpawnId: string;
  spawns: Record<string, Point>;
  obstacles: Obstacle[];
  decorations: Decoration[];
  /** Animaciones del paisaje (puede estar vacío). */
  ambient: AmbientEffect[];
  /** Gallinas y pollitos que andan por la zona (opcional, SPEC 3.3). */
  critters?: Critter[];
  portals: Record<string, Portal>;
}

export type AnimationName = "idle" | "walkUp" | "walkDown" | "walkLeft" | "walkRight" | "celebrate";

export interface ActorSpec {
  assetId: string;
  origin: Point;
  scale: number;
  animations: Partial<Record<AnimationName, string>>;
}

/**
 * Reposo de Vanessa y Jerry (SPEC 6.2): tres hojas de `kind` «idle-sheet» y los tiempos de los gestos. Al quedarse quieta
 * respira y parpadea (`rest`); tras `glanceAfterMs` sin entrada se miran (`glance`); tras `playAfterMs`, estando de
 * frente, juegan (`play`). Entre gestos pasan al menos `gestureCooldownMs`. Aparte, el visitante pide jugar con Jerry
 * (tecla `actionKey` o botón): se turnan `fetch` (trae el peluche) y `tricks` (sus trucos, con dar la pata).
 */
export interface IdleConfig {
  rest: string;
  glance: string;
  play: string;
  glanceAfterMs: number;
  playAfterMs: number;
  gestureCooldownMs: number;
  /** Trucos de Jerry (salto, sentarse, dar la pata, levantarse): una de las acciones que pide el visitante. */
  tricks?: { sheet: string };
  /** Búsqueda del peluche: la otra acción que pide el visitante; el último fotograma se mantiene `holdMs`. */
  fetch?: { sheet: string; holdMs: number };
  /** Tecla (una letra mayúscula) con la que el visitante pide jugar con Jerry; el botón de la cabecera hace lo mismo. */
  actionKey?: string;
}

export interface UiConfig {
  tabs: Array<{ id: SectionId; label: string; required: boolean }>;
  labels: {
    explore: string; markRead: string; claimBadge: string; close: string;
    index: string; reset: string; continueRoute: string; startRoute: string;
    pending: string; demo: string; previous: string; next: string;
    progressTemplate: string; stationTitleTemplate: string;
    semester: string; teacher: string; sectionRead: string; sectionUnread: string; badgeEarned: string;
    remainingTemplate: string; rewardTitle: string; xpTemplate: string; levelTemplate: string;
    emptyRouteLabel: string; mapLabel: string;
    badges: string; notEarned: string; earnedOnTemplate: string; badgeCountTemplate: string; completionTitle: string;
    finalReflectionTitle: string; finalReflectionPending: string; resetConfirmTitle: string; resetConfirmText: string;
    resetConfirm: string; cancel: string; preparationTemplate: string;
    musicMute: string; musicUnmute: string;
    stateLocked: string; stateAvailable: string; stateCompleted: string;
    tapExplore: string; tapTravel: string;
    jerryAction: string; playerName: string; nextBadge: string;
    captionJournal: string; captionJerry: string; captionSound: string;
  };
  assets: {
    window: string; button: string; buttonHover?: string; stationSign: string;
    titleSign: string; portrait: string; xpBar: string; xpStar?: string;
    openBook?: string; lockIcon?: string; glow: string;
    /** Botones de la cabecera (SPEC 7): arte con su marco; el nombre accesible sale de `ui.labels`. */
    badgesButton: string; listButton: string; musicButton: string; jerryButton: string;
    /** Efectos animados de las estaciones y panel de la cabecera (opcionales: sin ellos se usan el brillo y el fondo sencillos). */
    xpStarEffect?: string; nextStationGlow?: string; statusPanel?: string;
    /** Avatar animado de la cabecera (reposo y alegría al completar una estación); sin él se usa `portrait`, estático. */
    avatarAnimations?: string;
    /** Botón de sonido silenciado (si no se da, el de sonido activado se atenúa), insignia «Completado», señal de cambio de mapa (opcionales). */
    musicMutedButton?: string; completedBadge?: string; exitSign?: string;
    /** Hoja de destellos que centellean alrededor de la próxima estación (opcional). */
    stationSparkle?: string;
  };
  defaultDialogueIds: Record<DialogueEvent, string>;
}

export interface GameplayConfig {
  progressionMode: "sequential";
  zoneTravel: "free";
  start: { zoneId: string; spawnId: string };
  playerSpeed: number;
  /** Zoom base (mínimo). */
  cameraZoom: number;
  camera: { fit: "cover" | "fixed"; maxZoom: number; minPlayerHeight: number };
  /** Escala en el mundo de las señales de estación (y de los textos que las acompañan). */
  signScale: number;
  player: ActorSpec & {
    /** Animaciones de reposo; sin ellas se queda la pose quieta de la hoja de caminar. */
    idle?: IdleConfig; body: { width: number; height: number; offset: Point };
    /** Sombra suave bajo cada «pie» de la hoja (Vanessa, Jerry): opacidad, ancho respecto del pie y alto respecto del ancho. Sin ella no hay sombra. */
    shadow?: { alpha: number; widthFactor: number; aspect: number } };
  companion: { mode: "separate" | "included"; actor?: ActorSpec; followDistance: number };
}

/** Música de fondo (SPEC 6.4): qué pistas, en qué orden y cómo suenan. Las rutas viven en assets.json. */
export interface AudioConfig {
  music: {
    active: boolean;
    tracks: string[];
    rotation: "sequential" | "shuffle";
    volume: number;
    crossfadeMs: number;
  };
}

export interface BitacoraConfig {
  $schema?: string;
  schemaVersion: 1;
  contentSetId: string;
  configRevision: string;
  mode: AppMode;
  editorNotes?: string;
  project: ProjectConfig;
  route: string[];
  placements: Record<string, Placement>;
  maps: Record<string, MapZone>;
  learnings: Record<string, Learning>;
  badges: Record<string, Badge>;
  dialogues: Record<string, Dialogue>;
  ui: UiConfig;
  gameplay: GameplayConfig;
  audio: AudioConfig;
}

// ---- assets.json real ----------------------------------------------------

/** Sugerencia de movimiento del kit de animaciones (SPEC 3.2): la lógica la interpreta, no se pasa tal cual a Phaser. */
export type AssetMotion =
  | { type: "sway"; angleDegrees?: { from: number; to: number }; offsetXPx?: { from: number; to: number }; durationMs: number; yoyo?: boolean; repeat?: number; ease?: string }
  | { type: "drift"; direction: "left" | "right"; speedPxPerSecond: number; wrapAtMapEdge?: boolean }
  | { type: "pulse"; alphaMin: number; alphaMax: number; durationMs: number }
  | { type: "swim"; speedPxPerSecond: number }
  | { type: "particle"; lifespanMs: number; lifespanMaxMs?: number; speedX: { min: number; max: number }; speedY: { min: number; max: number }; gravityY?: number };

/** Escala y origen de un fotograma de una hoja de reposo cuya altura no es uniforme. */
export interface FrameAdjust {
  name: string;
  scaleMultiplier: number;
  origin: { x: number; y: number };
}

/** Una animación de una hoja de reposo; `direction` es la del kit (`front` = de frente, `back` = de espaldas). */
/** Animación del avatar de la cabecera: fotogramas con su duración en ms; `state` es lo que la interfaz pide (reposo o alegría). */
export interface AvatarAnimation {
  key: string;
  state: "idle" | "happy";
  frameNames: string[];
  durationsMs: number[];
  repeat: number;
}

/** Animación de una gallina o un pollito: fotogramas con su duración en ms por estado (reposo, caminar, picotear). */
export interface CritterAnimation {
  key: string;
  state: "idle" | "walk" | "peck";
  frameNames: string[];
  durationsMs: number[];
  repeat: number;
}

export interface LabelZone {
  x: number; y: number; width: number; height: number;
  align?: "left" | "center" | "right"; color?: string; fontSize?: number; fontWeight?: number; maxLines?: number;
}

export interface IdleAnimation {
  key: string;
  direction?: "front" | "left" | "right" | "back";
  frameNames: string[];
  frameRate: number;
  repeat: number;
  repeatDelay?: number;
}

/** Atribución de una pista. `verified: false` impide la entrega final: no se supone ninguna licencia (SPEC 6.4). */
export interface MusicCredit {
  title: string;
  artist: string;
  license: string;
  licenseUrl?: string;
  sourceUrl?: string;
  attribution?: string;
  verified: boolean;
}

export interface AssetEntry {
  path: string;
  type: string;
  format?: string;
  category: string;
  label: string;
  kind: string;
  width?: number;
  height?: number;
  hasAlphaChannel?: boolean;
  transparent?: boolean;
  sizeBytes?: number;
  sha256?: string;
  originalPath?: string;
  zone?: string;
  layer?: string;
  variant?: string;
  state?: string;
  text?: string;
  exampleFraction?: number;
  nineSlice?: { top: number; right: number; bottom: number; left: number };
  placement?: { relativeTo: string; x: number; y: number };
  poseCount?: number;
  visualLayout?: { columns: number; rows: number };
  rowDirections?: string[];
  requiresFrameDefinition?: boolean;
  // Kit de animaciones del paisaje (SPEC 3.2)
  atlasPath?: string;
  frameCount?: number;
  sourceFrameSize?: { width: number; height: number };
  layout?: { columns: number; rows: number; order: string };
  animation?: { frameNames: string[]; frameRate: number; repeat: number };
  /** Hojas de reposo (`kind` «idle-sheet»): varias animaciones por hoja, una por dirección. */
  animations?: IdleAnimation[];
  /** Hoja del avatar de la cabecera (`kind` «avatar-sheet»): reposo y alegría, con la duración de cada fotograma. */
  avatarAnimations?: AvatarAnimation[];
  /** Hoja de un animalito que anda por el mapa (`kind` «critter-sheet»): reposo, caminar y picotear con su duración por fotograma. */
  critterAnimations?: CritterAnimation[];
  anchor?: string;
  /**
   * Zonas de texto sobre la imagen (letreros, botones, insignias), en píxeles de la textura desde su esquina superior izquierda:
   * la imagen no trae el texto dibujado. `x`/`y` es la esquina de la zona.
   */
  labelZones?: Record<string, LabelZone>;
  /** Puntos de anclaje de lo que se pega a la imagen (p. ej. la insignia «Completado» bajo el letrero): `x`/`y` es el centro. */
  attachments?: Record<string, { x: number; y: number; width: number; height: number }>;
  /** Zona sensible (píxeles de la textura, esquina superior izquierda). */
  hitArea?: { x: number; y: number; width: number; height: number };
  /** Tamaño recomendado en pantalla, en píxeles CSS / del mundo. */
  recommendedDisplay?: { width: number; height: number };
  /** Hacia dónde apunta una señal de cambio de mapa. */
  direction?: "left" | "right";
  /** Altura de Vanessa en la hoja de referencia (px); las hojas con `frameAdjust` la normalizan fotograma a fotograma. */
  referenceHeightPx?: number;
  /** Opacidad de cada fotograma de una hoja de efecto (0..1): el pulso o el desvanecimiento del efecto. */
  opacityByFrame?: number[];
  /** Efecto de una sola vez: se retira al terminar. */
  hideOnComplete?: boolean;
  /** Corrección visual por fotograma (SPEC 6.2): factor de escala y origen (los pies, respecto del recorte). */
  frameAdjust?: FrameAdjust[];
  motion?: AssetMotion;
  origin?: { x: number; y: number };
  recommendedScale?: number;
  recommendedContentHeightPx?: number;
  contentBounds?: { x: number; y: number; width: number; height: number; alphaThreshold?: number };
  /** Ancho orientativo (px) con que se muestra el lienzo completo de un botón, y su nombre accesible sugerido. */
  recommendedDisplayWidth?: number;
  ariaLabel?: string;
  filter?: string;
  /** Mezcla y opacidad base de las luces y partículas (piezas adicionales, SPEC 3.2). */
  blendMode?: "NORMAL" | "ADD";
  opacity?: number;
  /** Hacia dónde mira el dibujo; `flipForLeft` indica que se voltea para mirar a la izquierda. */
  facing?: "left" | "right";
  flipForLeft?: boolean;
  /** Pistas de música (SPEC 6.4). */
  durationSeconds?: number;
  credit?: MusicCredit;
  /** Metadata futura: se conserva sin interpretarla. */
  [key: string]: unknown;
}

export interface SourceDocument {
  path: string;
  originalPath?: string;
  sizeBytes?: number;
  sha256?: string;
  [key: string]: unknown;
}

export interface AssetManifest {
  version: number;
  project: string;
  basePath: string;
  pathConvention: string;
  assetCount: number;
  categoryCounts: Record<string, number>;
  notes?: string[];
  assets: Record<string, AssetEntry>;
  sourceDocuments?: SourceDocument[];
  [key: string]: unknown;
}

// ---- validación ------------------------------------------------------------

/** `path` usa notación con puntos, p. ej. `placements.apr-c.decorationAssetId`. */
export interface ConfigIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ConfigIssue[] };

/** Definiciones de frames validadas contra la imagen real (SPEC 3.1). Aún no existen. */
export type FrameDefinitions = Record<string, { animations: readonly string[] }>;
