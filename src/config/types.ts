// Tipos de los dos contratos externos. Se contrastan con bitacora.schema.json y
// assets.schema.json en src/tests/config.test.ts: no sustituyen a la validación en runtime.

import type { SfxEventId } from "./sounds";

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
  /**
   * Opcionales de la presentación (portada con el kit): `subtitle` va bajo el título en el letrero («Un recorrido de aprendizajes») y
   * `welcomeTitle` es la frase destacada sobre el texto de bienvenida. Con `subtitle`, el título completo —el de la pestaña del
   * navegador y el de la cabecera— es «título — subtítulo» (`fullTitle`).
   */
  subtitle?: string;
  welcomeTitle?: string;
  finalReflection: ContentBlock[];
}

export interface Learning {
  title: string;
  topic: string;
  /** Título corto que va en el letrero de la estación (cabe en dos líneas); sin él se usa `title`. */
  signTitle?: string;
  /** Ilustración del aprendizaje en el índice y en el lector (`kind` «journal-panel-part»); sin ella no se muestra ninguna. */
  illustrationAssetId?: string;
  /** Palabras clave que se muestran junto a su ilustración en el lector (hasta cuatro). */
  keywords?: string[];
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
  /**
   * Una insignia que no pertenece a ningún aprendizaje: se concede al terminar todo el recorrido (la de Jerry, compañero de
   * aventuras). No suma XP ni cuenta en «n de m insignias».
   */
  awardedFor?: "route-complete";
  /** Color de su halo y sus ramitas en el panel de insignias (por defecto `jade`). */
  tone?: "jade" | "lavender" | "gold";
  /** «Lo que me llevo»: lo que la autora se queda de esta insignia, en primera persona. Sin él, el panel no muestra esa sección. */
  takeaway?: string;
  /**
   * Solo con `awardedFor`: el carácter de la insignia especial. `friendship` (por defecto) celebra una compañía (Jerry); `memorial`
   * guarda el recuerdo de alguien (Rocky): su ficha usa los textos de `ui.badgePanel.labels.memorial`.
   */
  specialType?: "friendship" | "memorial";
  /** Solo con `awardedFor`: una línea bajo el nombre en la colección y en el detalle (p. ej. «Siempre en nuestro corazón»). */
  subtitle?: string;
  /** Solo con `awardedFor`: cómo se desbloquea, mientras está por descubrir (sin él, el texto genérico `completeRoute`). */
  unlockCondition?: string;
  /**
   * Solo con `awardedFor`: una insignia secreta no aparece en la colección (ni cuenta) hasta que se concede; no deja pistas de que existe.
   * La de Rocky: surge al terminar todos los aprendizajes.
   */
  secret?: boolean;
}

/** Textos del panel de insignias (SPEC 7). Las plantillas solo admiten sus variables: `{completedCount}`, `{totalCount}`, `{number}`, `{xp}`. */
export interface BadgePanelLabels {
  title: string; subtitle: string; obtainedTemplate: string;
  obtained: string; pending: string; special: string; viewBadge: string; hint: string;
  backToMap: string; backToCollection: string; myCollection: string; closePanel: string;
  eyebrowLearning: string; eyebrowSpecial: string; stillPending: string;
  represents: string; howEarned: string; howToEarn: string;
  completingTemplate: string; completeTemplate: string; completeRoute: string; routeEarned: string;
  takeaway: string; viewLearning: string; xpTemplate: string;
  /** Línea del detalle de una insignia especial que aún no se ha desbloqueado (sin ella, `stillPending`). */
  unlocksAtEnd?: string;
  /** Textos de las insignias `specialType: "memorial"`: obligatorios si alguna existe. `placeTemplate` admite `{name}`. */
  memorial?: BadgePanelMemorialLabels;
}

export interface BadgePanelMemorialLabels {
  /** Sobre el nombre en el detalle (p. ej. «Un recuerdo lleno de amor»). */
  eyebrow: string;
  /** Título de la sección que sustituye a «Cómo la conseguí» y su texto, con `{name}` = título de la insignia. */
  place: string; placeTemplate: string;
  /** Título de la sección que sustituye a «Lo que me llevo» (p. ej. «Con mucho cariño»). */
  takeaway: string;
}

/** Textos propios de la presentación; el resto sale de `project` y de `ui.labels` (semestre, docente, comenzar o continuar). */
export interface PresentationLabels {
  /** Rótulo sobre la asignatura («ASIGNATURA»). */
  subjectLabel: string;
  /** Texto alternativo de la ilustración de Vanessa y Jerry. */
  heroAlt: string;
}

export interface PresentationConfig {
  /** Prefijo de los IDs del kit en `assets.json` (p. ej. `ui.presentation.`). */
  assetPrefix: string;
  labels: PresentationLabels;
}

/** El panel de insignias hecho con el kit de interfaz `ui.badgePanel.*`. Sin él se usa la lista sencilla. */
export interface BadgePanelConfig {
  /** Prefijo de los IDs del kit en `assets.json` (p. ej. `ui.badgePanel.`). */
  assetPrefix: string;
  labels: BadgePanelLabels;
}

/**
 * Textos de la Bitácora de aprendizajes (índice y lector, SPEC 7). Las plantillas solo admiten sus variables
 * (`JOURNAL_PANEL_TEMPLATE_VARIABLES`); los nombres de las secciones salen de `ui.tabs`.
 */
export interface JournalPanelLabels {
  title: string;
  subtitle: string;
  progressTemplate: string;
  closePanel: string;
  backToMap: string;
  footerNote: string;
  groupRangeTemplate: string;
  groupSingleTemplate: string;
  cardNumberTemplate: string;
  nextRibbon: string;
  statusCompleted: string;
  statusAvailable: string;
  statusLocked: string;
  statusInProgress: string;
  actionReread: string;
  actionExplore: string;
  requirementTemplate: string;
  backToJournal: string;
  readerSubtitleTemplate: string;
  sectionsLabel: string;
  sidebarTitle: string;
  badgeObtained: string;
  badgePending: string;
  badgeInstructionTemplate: string;
  viewBadge: string;
  sectionsReadTemplate: string;
  readingTemplate: string;
  sectionRead: string;
  markAndContinue: string;
  continueReading: string;
  seeSectionTemplate: string;
  backToJournalAction: string;
}

/** La Bitácora de aprendizajes con el kit `ui.journal-panel.*`. Sin ella se usan la lista y la lectura sencillas. Requiere `ui.badgePanel` (comparte sus piezas). */
export interface JournalPanelConfig {
  /** Prefijo de los IDs propios del kit en `assets.json` (p. ej. `ui.journal-panel.`). */
  assetPrefix: string;
  /** Icono de cada zona junto a su título en el índice: nombre de una pieza propia (`zone-cherry-tree`…) por ID de zona. */
  zoneIcons?: Record<string, string>;
  labels: JournalPanelLabels;
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

/** Cómo suena un sonido del mapa (SPEC 6.5): continuo, repetido con esperas aleatorias, o una vez al entrar en su zona. */
export type SoundPlayback =
  | { mode: "loop" }
  | { mode: "interval"; minMs: number; maxMs: number }
  | { mode: "enter"; cooldownMs: number };

interface MapSoundBase {
  /** Nombre legible (el laboratorio y los mensajes de error). */
  label: string;
  /** Recurso de `assets.json` de `kind` «sfx». */
  assetId: string;
  /** Apagarlo sin borrarlo: en el recorrido un emisor deshabilitado nunca suena. */
  enabled: boolean;
  /** 0..1 */
  volume: number;
  /** 0.5..2; 1 es la velocidad original. */
  rate: number;
  fadeInMs: number;
  fadeOutMs: number;
  playback: SoundPlayback;
}

/**
 * Un sonido colocado en el mapa, con su alcance: un punto (volumen completo hasta `innerRadius` y silencio desde `radius`) o un
 * rectángulo (completo dentro y con caída de `edgeFadePx` fuera). La clave del registro es su `soundId` dentro de la zona.
 */
export type MapSound = MapSoundBase &
  (
    | { shape: "point"; position: Point; innerRadius: number; radius: number }
    | { shape: "rect"; area: { x: number; y: number; width: number; height: number }; edgeFadePx: number }
  );

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
  /** Sonidos del mapa (opcional, SPEC 6.5): los coloca Tiled. Omitido si la zona nunca tuvo; `{}` si se vació a propósito. */
  sounds?: Record<string, MapSound>;
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
  /** Panel de insignias con el kit de interfaz (opcional). */
  badgePanel?: BadgePanelConfig;
  /** Índice y lector de la Bitácora de aprendizajes con su kit de interfaz (opcional; requiere `badgePanel`). */
  journalPanel?: JournalPanelConfig;
  /** La presentación (portada) con su kit de interfaz `ui.presentation.*`. Sin ella se usa la portada sencilla. */
  presentation?: PresentationConfig;
  tabs: Array<{ id: SectionId; label: string; required: boolean }>;
  labels: {
    explore: string; markRead: string; claimBadge: string; close: string;
    index: string; reset: string; continueRoute: string; startRoute: string;
    pending: string; previous: string; next: string;
    /** Aviso de contenido de demostración (modo `demo`): opcional; sin él no se muestra ninguno. */
    demo?: string;
    progressTemplate: string; stationTitleTemplate: string;
    semester: string; teacher: string; sectionRead: string; sectionUnread: string; badgeEarned: string;
    remainingTemplate: string; rewardTitle: string; xpTemplate: string; levelTemplate: string;
    emptyRouteLabel: string; mapLabel: string;
    /** Texto de la barra de carga del mapa (opcional; por defecto «Cargando el mapa…»). */
    loadingMap?: string;
    /** Aviso al intentar explorar desde la Bitácora un aprendizaje sin completar estando lejos de su estación. Variables: {number}, {title} y {zone} (opcional; hay un texto por defecto). */
    awayFromStationTemplate?: string;
    badges: string; notEarned: string; routeBadgeLocked: string; earnedOnTemplate: string; badgeCountTemplate: string; completionTitle: string;
    finalReflectionTitle: string;
    /** Ya no se muestra (sin reflexión final no hay aviso); se admite por compatibilidad con configuraciones anteriores. */
    finalReflectionPending?: string; resetConfirmTitle: string; resetConfirmText: string;
    resetConfirm: string; cancel: string; preparationTemplate: string;
    musicMute: string; musicUnmute: string;
    /** El botón «Sonido» cuando hay efectos de sonido (SPEC 6.5): silenciar/activar todo el audio y reintentar si el navegador lo bloqueó. Sin ellos se usan los de la música. */
    soundMute?: string; soundUnmute?: string; soundActivate?: string;
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

/** Un efecto de una sola vez asociado a una acción del juego (SPEC 6.5). */
export interface OneShotPreset {
  assetId: string;
  volume: number;
  rate: number;
}

/** Efectos de sonido (SPEC 6.5): el volumen general, el límite de voces y qué suena en cada acción. Los emisores del mapa viven en `maps.json`. */
export interface SfxConfig {
  active: boolean;
  /** Volumen general de los efectos, 0..1. */
  volume: number;
  /** Cuántos efectos pueden sonar a la vez. */
  maxVoices: number;
  events?: Partial<Record<SfxEventId, OneShotPreset>>;
}

/** Música de fondo (SPEC 6.4) y efectos de sonido (SPEC 6.5). Las rutas viven en assets.json. */
export interface AudioConfig {
  music: {
    active: boolean;
    tracks: string[];
    rotation: "sequential" | "shuffle";
    volume: number;
    crossfadeMs: number;
  };
  sfx?: SfxConfig;
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

/**
 * `maps.json`: la geometría del mundo —las zonas (`maps`) y dónde está la estación de cada aprendizaje (`placements`)—, que administra
 * Tiled. Aparte del contenido (`bitacora.json`), para que una edición de un mapa no toque textos ni insignias y al revés.
 */
export interface MapsFile {
  $schema?: string;
  placements: Record<string, Placement>;
  maps: Record<string, MapZone>;
}

/** `bitacora.json` tal como está en el archivo: todo menos la geometría. */
export type BitacoraContent = Omit<BitacoraConfig, "placements" | "maps">;

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
  /** Carpeta o familia a la que pertenece una pieza de un kit (p. ej. `frames`, `icons` en el panel de insignias). */
  group?: string;
  /** Qué significa el recurso (insignias): texto de referencia del paquete, no se muestra por sí solo. */
  meaning?: string;
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
  /** El archivo de la configuración al que pertenece, cuando no se deduce de la ruta (p. ej. una clave de más en maps.json). */
  file?: "bitacora.json" | "maps.json";
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ConfigIssue[] };

/** Definiciones de frames validadas contra la imagen real (SPEC 3.1). Aún no existen. */
export type FrameDefinitions = Record<string, { animations: readonly string[] }>;
