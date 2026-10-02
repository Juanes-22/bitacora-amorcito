import type { BitacoraConfig, ContentBlock, Learning, SectionId } from "../../config/types";

// Configuración mínima válida para pruebas: IDs reales de public/assets/assets.json,
// dos zonas con portales de ida y regreso y N aprendizajes (5, 6 o 7 en las variantes).
// La geometría es provisional; no es el bitacora.json del sitio.

const SECTIONS: SectionId[] = ["lived", "learning", "reflection", "classroom"];
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

const demoBlocks = (label: string): ContentBlock[] => [
  { type: "paragraph", text: `Contenido de demostración (${label}).` },
];

export function learningId(index: number): string {
  return `apr-${LETTERS[index]}`;
}

export function makeConfig(count = 6): BitacoraConfig {
  const ids = Array.from({ length: count }, (_, i) => learningId(i));
  const slots = [
    { zoneId: "zona-a", x: 300, y: 600 }, { zoneId: "zona-a", x: 700, y: 400 },
    { zoneId: "zona-a", x: 1000, y: 700 }, { zoneId: "zona-b", x: 400, y: 600 },
    { zoneId: "zona-b", x: 800, y: 400 }, { zoneId: "zona-b", x: 1100, y: 700 },
    { zoneId: "zona-b", x: 600, y: 900 },
  ];

  const layers = (zone: "01" | "02") =>
    zone === "01"
      ? [
          { assetId: "background.zone-01.horizon", depth: 0 },
          { assetId: "background.zone-01.terrain", depth: 10 },
          { assetId: "background.zone-01.midground.cherry-tree.v01", depth: 20 },
          { assetId: "background.zone-01.foreground.foliage.v03", depth: 1000 },
        ]
      : [
          { assetId: "background.zone-02.horizon.v01", depth: 0 },
          { assetId: "background.zone-02.terrain", depth: 10 },
          { assetId: "background.zone-02.midground.pavilion.v01", depth: 20 },
          { assetId: "background.zone-02.foreground.foliage", depth: 1000 },
        ];

  return {
    schemaVersion: 1,
    contentSetId: "bitacora-prueba",
    configRevision: "test-1",
    mode: "demo",
    project: {
      title: "Mi bitácora — Un recorrido de aprendizajes",
      studentName: "Vanessa Estrada",
      university: "Universidad de Antioquia",
      program: "Licenciatura en Educación Infantil",
      semester: "2026 - 2",
      courseName: "Desarrollo de la actitud científica en la infancia",
      teacherName: null,
      welcomeText: "Texto de bienvenida provisional.",
      finalReflection: [],
    },
    route: ids,
    placements: Object.fromEntries(
      ids.map((id, i) => [
        id,
        {
          zoneId: slots[i].zoneId,
          position: { x: slots[i].x, y: slots[i].y },
          interactionOffset: { x: 0, y: 45 },
          interactionRadius: 65,
        },
      ]),
    ),
    maps: {
      "zona-a": {
        label: "Zona A",
        width: 1448,
        height: 1086,
        layers: layers("01"),
        initialSpawnId: "inicio",
        spawns: { inicio: { x: 200, y: 900 }, "desde-b": { x: 1250, y: 900 } },
        obstacles: [{ type: "rect", x: 500, y: 100, width: 100, height: 80 }],
        decorations: [],
        ambient: [],
        portals: {
          "a-b": {
            label: "Ir a la zona B",
            interaction: { x: 1300, y: 520, radius: 60 },
            targetZoneId: "zona-b",
            targetSpawnId: "desde-a",
          },
        },
      },
      "zona-b": {
        label: "Zona B",
        width: 1448,
        height: 1086,
        layers: layers("02"),
        initialSpawnId: "desde-a",
        spawns: { "desde-a": { x: 200, y: 900 } },
        obstacles: [{ type: "circle", x: 1200, y: 200, radius: 50 }],
        decorations: [],
        ambient: [],
        portals: {
          "b-a": {
            label: "Volver a la zona A",
            interaction: { x: 150, y: 520, radius: 60 },
            targetZoneId: "zona-a",
            targetSpawnId: "desde-b",
          },
        },
      },
    },
    learnings: Object.fromEntries(
      ids.map((id) => {
        const sections = Object.fromEntries(SECTIONS.map((s) => [s, demoBlocks(s)])) as Learning["sections"];
        const learning: Learning = {
          title: "Tema por definir",
          topic: "Tema por definir",
          editorialStatus: "demo",
          contentRevision: 1,
          badgeId: `insignia-${id}`,
          sections,
        };
        return [id, learning];
      }),
    ),
    badges: Object.fromEntries(
      ids.map((id) => [
        `insignia-${id}`,
        { title: "Insignia de demostración", description: "Insignia provisional.", assetId: "ui.badge.active-listening", xp: 100 },
      ]),
    ),
    dialogues: {
      abrir: { lines: [{ speaker: "narrator", text: "Estás ante «{learningTitle}»." }] },
      bloqueado: { lines: [{ speaker: "narrator", text: "Antes lee «{previousLearningTitle}»." }] },
      completado: { lines: [{ speaker: "narrator", text: "Ya recorriste este aprendizaje." }] },
      recompensa: {
        lines: [{ speaker: "narrator", text: "¡Aprendizaje recorrido! {completedCount} de {totalCount}: {badgeTitle}." }],
      },
    },
    ui: {
      tabs: [
        { id: "lived", label: "Lo vivido", required: true },
        { id: "learning", label: "Aprendizajes", required: true },
        { id: "reflection", label: "Reflexión", required: true },
        { id: "classroom", label: "En el aula", required: true },
      ],
      labels: {
        explore: "Explorar", markRead: "Marcar sección como leída", claimBadge: "Recoger insignia y continuar",
        close: "Cerrar", index: "Ver aprendizajes en lista", reset: "Reiniciar recorrido",
        continueRoute: "Continuar recorrido", startRoute: "Comenzar recorrido", pending: "Pendiente",
        demo: "Contenido de demostración", previous: "Anterior", next: "Siguiente",
        progressTemplate: "{completedCount} de {totalCount} aprendizajes",
        stationTitleTemplate: "Aprendizaje {number}: {title}",
        semester: "Semestre",
        teacher: "Docente",
        sectionRead: "Sección leída",
        sectionUnread: "Sin marcar",
        badgeEarned: "Insignia obtenida",
        remainingTemplate: "Faltan {remaining} por marcar",
        rewardTitle: "¡Aprendizaje recorrido!",
        xpTemplate: "{xp} / {maxXp} XP",
        levelTemplate: "Nivel {level}",
        emptyRouteLabel: "Contenido por definir",
        mapLabel: "Mapa de la bitácora",
        badges: "Insignias",
        notEarned: "Por obtener",
        earnedOnTemplate: "Obtenida el {date}",
        badgeCountTemplate: "{completedCount} de {totalCount} insignias",
        completionTitle: "¡Recorrido completo!",
        finalReflectionTitle: "Reflexión final",
        finalReflectionPending: "La reflexión final de Vanessa se añadirá aquí cuando la escriba.",
        resetConfirmTitle: "¿Reiniciar el recorrido?",
        resetConfirmText: "Se borrará el avance guardado en este navegador. Esta acción no se puede deshacer.",
        resetConfirm: "Sí, reiniciar",
        cancel: "Cancelar",
        preparationTemplate: "Recorrido en preparación: faltan {pending} por aprobar",
        musicMute: "Silenciar música",
        musicUnmute: "Activar música",
        stateLocked: "Bloqueado",
        stateAvailable: "Disponible",
        stateCompleted: "Completado",
        tapExplore: "Toca la estación para explorar",
        tapTravel: "Toca el portal para viajar",
        jerryAction: "Jugar con Jerry",
        playerName: "Vanessa",
        nextBadge: "Siguiente",
        captionJournal: "Bitácora",
        captionJerry: "Jerry",
        captionSound: "Sonido",
      },
      assets: {
        window: "ui.panel.cream.nine-slice",
        button: "ui.button.green.default",
        buttonHover: "ui.button.green.hover",
        stationSign: "station.sign.wooden",
        titleSign: "ui.title.blank",
        portrait: "character.vanessa-jerry.portrait.xp",
        xpBar: "ui.progress.xp.frame",
        xpStar: "ui.icon.xp-star",
        openBook: "ui.icon.open-book",
        lockIcon: "station.item.padlock",
        glow: "effect.player.glow",
        badgesButton: "ui.button.badges.default",
        listButton: "ui.button.journal.default",
        musicButton: "ui.button.audio.default",
        jerryButton: "ui.button.paw.default",
      },
      defaultDialogueIds: { open: "abrir", locked: "bloqueado", completed: "completado", reward: "recompensa" },
    },
    gameplay: {
      progressionMode: "sequential",
      zoneTravel: "free",
      start: { zoneId: "zona-a", spawnId: "inicio" },
      playerSpeed: 160,
      cameraZoom: 1,
      camera: { fit: "cover", maxZoom: 3, minPlayerHeight: 0.12 },
      signScale: 0.16,
      player: {
        assetId: "character.vanessa-jerry.idle",
        origin: { x: 0.5, y: 1 },
        scale: 0.1,
        animations: {},
        body: { width: 24, height: 16, offset: { x: 0, y: 0 } },
      },
      companion: { mode: "included", followDistance: 0 },
    },
    audio: {
      music: {
        active: true,
        tracks: ["audio.music.beyond-the-clouds", "audio.music.enchanted-festival", "audio.music.little-town-orchestral"],
        rotation: "sequential",
        volume: 0.35,
        crossfadeMs: 2500,
      },
    },
  };
}
