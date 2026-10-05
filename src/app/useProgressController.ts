import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { isAdmissible, stationStatesOf, summarize, unapprovedIds } from "../domain/progression";
import type { BitacoraConfig, DialogueEvent, SectionId } from "../config/types";
import type { GameBridge } from "../game/bridge/GameBridge";
import type { NearbyTarget } from "../game/bridge/events";
import type { SfxService } from "../audio/SfxService";
import { ControlReasons } from "./controlReasons";
import type { ProgressStore } from "./progressStore";

/** Lo que muestra la ventana de lectura (SPEC 12.7): mensaje → lectura → recompensa, o solo un mensaje. */
export type ReadingState =
  | { kind: "message"; learningId: string; event: Extract<DialogueEvent, "locked"> | "pending" | "away" }
  | { kind: "intro"; learningId: string; event: Extract<DialogueEvent, "open" | "completed"> }
  | { kind: "reading"; learningId: string; active: SectionId }
  | { kind: "reward"; learningId: string };

/** Ventanas que no son una lectura: la colección de insignias (o el cierre del recorrido), la confirmación de reinicio y la lista accesible de aprendizajes. */
/** `learningId`: la colección se abre en el detalle de la insignia de ese aprendizaje (desde «Ver insignia» del lector). */
export type OverlayState = { kind: "collection"; completion: boolean; learningId?: string } | { kind: "confirm-reset" } | { kind: "list" };

export interface OverlayActions {
  openCollection: () => void;
  /** Lista accesible de aprendizajes (SPEC 14): abre los mismos aprendizajes con las mismas reglas que el mapa. */
  openList: () => void;
  openFromList: (learningId: string) => void;
  closeOverlay: () => void;
  askReset: () => void;
  cancelReset: () => void;
  confirmReset: () => void;
}

export interface ReadingActions {
  continueReading: () => void;
  selectSection: (section: SectionId) => void;
  markRead: (section: SectionId) => void;
  claimBadge: () => void;
  close: () => void;
  /** Del lector a la lista de aprendizajes (la Bitácora): la lectura se cierra sin conceder nada. */
  backToList: () => void;
  /** Del lector al detalle de la insignia de ese aprendizaje en el panel de insignias. */
  openBadge: () => void;
}

export interface ProgressController {
  nearby: NearbyTarget | null;
  reading: ReadingState | null;
  actions: ReadingActions;
  overlay: OverlayState | null;
  overlayActions: OverlayActions;
}

const NO_ACTIONS: ReadingActions = {
  continueReading() {}, selectSection() {}, markRead() {}, claimBadge() {}, close() {}, backToList() {}, openBadge() {},
};
const NO_OVERLAY_ACTIONS: OverlayActions = { openCollection() {}, openList() {}, openFromList() {}, closeOverlay() {}, askReset() {}, cancelReset() {}, confirmReset() {} };

/** Cuánto esperar tras la última insignia para mostrar el cierre: que la celebración no quede tapada (SPEC 11.6). */
const COMPLETION_DELAY_MS = 3300;
const COMPLETION_DELAY_REDUCED_MS = 1900;

/**
 * Controlador de aplicación: valida las solicitudes del juego contra los datos configurados y el progreso
 * vigente, ejecuta las transiciones mediante el ProgressStore (única fuente de verdad), mantiene los motivos
 * de bloqueo del mapa y decide cuándo hay una celebración. Phaser solo recibe instantáneas derivadas.
 * Los receptores se registran aquí antes de que la escena avise y todo se lee del almacén en el momento de
 * actuar (nunca de un cierre sobre estado viejo).
 */
export function useProgressController(
  bridge: GameBridge | null,
  config: BitacoraConfig | null,
  store: ProgressStore | null,
  hostRef: RefObject<HTMLElement | null>,
  extras: {
    /** Efectos de sonido de las acciones del juego (SPEC 6.5). Sin él el juego es el de siempre. */
    sfx?: SfxService | null;
    /** El propietario compartido de los motivos de pausa (el laboratorio de sonidos añade el suyo). Por defecto, uno propio. */
    controls?: ControlReasons;
  } = {},
): ProgressController {
  const { sfx, controls } = extras;
  const [nearby, setNearby] = useState<NearbyTarget | null>(null);
  const [reading, setReading] = useState<ReadingState | null>(null);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const actionsRef = useRef<ReadingActions>(NO_ACTIONS);
  const overlayRef = useRef<OverlayActions>(NO_OVERLAY_ACTIONS);

  useEffect(() => {
    if (!bridge || !config || !store) return;
    const reasons = controls ?? new ControlReasons(bridge);
    let zoneId = store.getState().currentZoneId;
    let version = 0;
    let lastStates = "";
    let current: ReadingState | null = null;
    let currentOverlay: OverlayState | null = null;
    let celebration: { effectId: string; learningId: string } | null = null;
    // La lectura se abrió desde una ventana de la Bitácora (la lista o la colección de insignias): al cerrarla se vuelve a ella (salvo
    // que haya celebración).
    let origin: OverlayState | null = null;
    // La estación junto a la que está Vanessa (la última que avisó el mapa antes de abrirse una ventana): un aprendizaje sin completar
    // solo se explora y se completa estando en su estación; uno completado se relee desde cualquier sitio.
    let stationHere: string | null = null;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    const pending = unapprovedIds(config);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const show = (next: ReadingState | null) => {
      current = next;
      setReading(next);
    };
    const publishControls = () => reasons.publish();
    const sync = (force = false) => {
      const stations = stationStatesOf(config, store.getState());
      const key = JSON.stringify(stations);
      if (!force && key === lastStates) return; // los checkpoints no repintan estaciones
      lastStates = key;
      bridge.emit("app:sync", { version: ++version, stations, pending });
    };
    const resolve = (requestId: string, accepted: boolean, reason?: string) =>
      bridge.emit("app:request-resolved", { requestId, accepted, reason });

    const showOverlay = (next: OverlayState | null) => {
      currentOverlay = next;
      setOverlay(next);
    };
    const openOverlay = (next: OverlayState) => {
      showOverlay(next);
      reasons.add("overlay");
      publishControls();
    };
    const closeOverlay = () => {
      showOverlay(null);
      reasons.delete("overlay");
      publishControls();
    };

    const open = (next: ReadingState) => {
      show(next);
      reasons.add("reading");
      publishControls();
    };

    /** La sección con la que se abre la lectura: donde se quedó la última vez, o la primera. */
    const resumeSection = (learningId: string): SectionId => {
      const entry = store.getState().entries[learningId];
      return entry?.lastSectionId && config.ui.tabs.some((t) => t.id === entry.lastSectionId) ? entry.lastSectionId : config.ui.tabs[0].id;
    };

    /**
     * Única regla para abrir un aprendizaje, la use el mapa (al pulsar Enter junto a una estación) o la lista accesible:
     * una estación bloqueada o pendiente solo muestra su mensaje; nunca se salta la secuencia (SPEC 8 y 14).
     */
    const tryOpen = (learningId: string, source: "map" | "bitacora" = "map"): { accepted: boolean; reason?: string } => {
      if (!config.route.includes(learningId)) return { accepted: false, reason: "unknown-learning" };
      if (currentOverlay || current) return { accepted: false, reason: "busy" };
      const state = stationStatesOf(config, store.getState())[learningId];
      if (state === "locked") {
        open({ kind: "message", learningId, event: "locked" });
        return { accepted: false, reason: "locked" };
      }
      if (state !== "completed" && !isAdmissible(config, learningId)) {
        open({ kind: "message", learningId, event: "pending" });
        return { accepted: false, reason: "not-admissible" };
      }
      // Desde la Bitácora, un aprendizaje sin completar exige estar en su estación (el mapa ya lo exige por sí mismo).
      if (source === "bitacora" && state !== "completed" && stationHere !== learningId) {
        open({ kind: "message", learningId, event: "away" });
        return { accepted: false, reason: "away" };
      }
      // Con la Bitácora de aprendizajes (su lector), se entra directo a la lectura: sin ventana de apertura ni de relectura.
      sfx?.playEvent("ui.open"); // la apertura real de una lectura (un mensaje de «bloqueado», «pendiente» o «lejos» no cuenta)
      if (config.ui.journalPanel && config.ui.badgePanel) {
        open({ kind: "reading", learningId, active: resumeSection(learningId) });
        return { accepted: true };
      }
      open({ kind: "intro", learningId, event: state === "completed" ? "completed" : "open" });
      return { accepted: true };
    };

    const offs = [
      bridge.on("game:ready", ({ zoneId: z, token, position }) => {
        if (!bridge.isActive(token)) return;
        const changed = z !== zoneId;
        zoneId = z;
        reasons.delete("transition");
        store.setLocation(z, position, changed); // un cambio de zona se guarda al momento
        sync(true); // siempre la instantánea completa al estar lista la escena
        publishControls();
      }),
      bridge.on("game:nearby-changed", ({ target, token }) => {
        if (!bridge.isActive(token)) return;
        setNearby(target);
        // Con una ventana abierta el mapa se detiene y «limpia» lo cercano: eso no cuenta como alejarse.
        if (!reasons.has("overlay") && !reasons.has("reading")) stationHere = target?.kind === "learning" ? target.id : null;
      }),
      bridge.on("game:checkpoint", ({ zoneId: z, position, token }) => {
        if (bridge.isActive(token)) store.setLocation(z, position);
      }),
      bridge.on("game:learning-open-request", ({ learningId, token, requestId }) => {
        if (!bridge.isActive(token)) return; // mensaje de una escena sustituida
        const result = tryOpen(learningId);
        resolve(requestId, result.accepted, result.reason);
      }),
      bridge.on("game:portal-request", ({ portalId, fromZoneId, token, requestId }) => {
        if (!bridge.isActive(token)) return;
        // No se confía en el destino que envía el juego: se comprueba contra los datos del portal.
        const portal = fromZoneId === zoneId ? config.maps[fromZoneId]?.portals[portalId] : undefined;
        const target = portal ? config.maps[portal.targetZoneId] : undefined;
        if (!portal || !target?.spawns[portal.targetSpawnId]) return resolve(requestId, false, "invalid-portal");
        resolve(requestId, true);
        sfx?.playEvent("portal.travel");
        stationHere = null;
        reasons.add("transition");
        publishControls();
        bridge.emit("app:zone-change", { zoneId: portal.targetZoneId, spawnId: portal.targetSpawnId });
      }),
      store.subscribe(() => sync()),
    ];

    const flush = () => store.flush();
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);

    actionsRef.current = {
      continueReading() {
        if (current?.kind !== "intro") return;
        show({ kind: "reading", learningId: current.learningId, active: resumeSection(current.learningId) });
      },
      selectSection(section) {
        if (current?.kind !== "reading") return;
        store.setActiveSection(current.learningId, section);
        show({ ...current, active: section });
      },
      markRead(section) {
        if (current?.kind !== "reading") return;
        const result = store.markSection(current.learningId, section);
        if (result.ok && result.changed) sfx?.playEvent("ui.confirm"); // solo cuando de verdad se marca algo nuevo
      },
      claimBadge() {
        if (current?.kind !== "reading") return;
        const result = store.claimBadge(current.learningId);
        // Solo una transición NUEVA celebra: doble clic o Enter mantenido devuelven changed=false.
        if (result.ok && result.changed) {
          const completedAt = result.state.entries[current.learningId].completedAt;
          celebration = { effectId: `${current.learningId}@${completedAt}`, learningId: current.learningId };
          // El aviso de recompensa suena AQUÍ, al confirmarse la transición y abrirse la ventana de recompensa (no al celebrar después, que
          // duplicaría el sonido). Una sola vez por transacción: Jerry y Rocky, que se conceden con la última, no añaden otro.
          sfx?.playEvent("badge.earned", { effectId: celebration.effectId });
          show({ kind: "reward", learningId: current.learningId });
        }
      },
      backToList() {
        if (current?.kind !== "reading") return;
        origin = null;
        show(null);
        reasons.delete("reading");
        openOverlay({ kind: "list" }); // el mapa sigue detenido, sin parpadeo de controles
      },
      openBadge() {
        if (current?.kind !== "reading") return;
        const learningId = current.learningId;
        origin = null;
        show(null);
        reasons.delete("reading");
        openOverlay({ kind: "collection", completion: false, learningId });
      },
      close() {
        if (!current) return;
        const pending = celebration;
        celebration = null;
        const back = pending ? null : origin;
        origin = null;
        show(null);
        reasons.delete("reading");
        if (back) {
          openOverlay(back); // vuelve a la ventana de la que se vino: el mapa sigue detenido, sin parpadeo de controles
          return;
        }
        publishControls(); // la escena se reanuda antes de celebrar: la animación no queda tras la ventana
        if (pending) {
          bridge.emit("app:celebrate", pending);
          // La última insignia cierra el recorrido: se muestra la colección y la reflexión final cuando la
          // celebración ya terminó, no encima de ella. Solo se abre si no hay otra ventana en ese momento.
          if (summarize(config, store.getState()).finished) {
            clearTimeout(completionTimer);
            completionTimer = setTimeout(() => {
              if (!current && !currentOverlay) openOverlay({ kind: "collection", completion: true });
            }, reduced ? COMPLETION_DELAY_REDUCED_MS : COMPLETION_DELAY_MS);
          }
        }
      },
    };

    overlayRef.current = {
      openCollection() {
        if (current || currentOverlay) return;
        sfx?.playEvent("ui.open");
        openOverlay({ kind: "collection", completion: false });
      },
      openList() {
        if (current || currentOverlay) return;
        sfx?.playEvent("ui.open");
        openOverlay({ kind: "list" });
      },
      /** Abre un aprendizaje desde una ventana de la Bitácora: la lista o el detalle de una insignia («Ver aprendizaje»). */
      openFromList(learningId) {
        if (currentOverlay?.kind !== "list" && currentOverlay?.kind !== "collection") return;
        const from = currentOverlay;
        showOverlay(null);
        reasons.delete("overlay");
        origin = from.kind === "collection" ? { kind: "collection", completion: false, learningId } : from;
        const result = tryOpen(learningId, "bitacora");
        if (!result.accepted && !current) {
          // Id desconocido o nada que abrir: se vuelve a la ventana de origen sin dejar bloqueos colgados.
          const back = origin;
          origin = null;
          openOverlay(back);
        }
      },
      closeOverlay,
      askReset() {
        if (currentOverlay?.kind === "collection") showOverlay({ kind: "confirm-reset" });
      },
      cancelReset() {
        if (currentOverlay?.kind === "confirm-reset") showOverlay({ kind: "collection", completion: false });
      },
      confirmReset() {
        if (currentOverlay?.kind !== "confirm-reset") return;
        // Reinicia el avance de ESTA bitácora y modo, la escena, los controles y las celebraciones pendientes.
        sfx?.playEvent("ui.confirm");
        clearTimeout(completionTimer);
        celebration = null;
        store.reset();
        showOverlay(null);
        reasons.delete("overlay");
        reasons.add("transition");
        sync(true);
        publishControls();
        bridge.emit("app:zone-change", { zoneId: config.gameplay.start.zoneId, spawnId: config.gameplay.start.spawnId });
      },
    };

    // Si la escena arrancó antes de este efecto, la instantánea retenida y los bloqueos se entregan ahora.
    sync(true);
    publishControls();
    return () => {
      offs.forEach((off) => off());
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      store.flush();
      clearTimeout(completionTimer);
      actionsRef.current = NO_ACTIONS;
      overlayRef.current = NO_OVERLAY_ACTIONS;
      setNearby(null);
      setReading(null);
      setOverlay(null);
    };
  }, [bridge, config, store, hostRef, sfx, controls]);

  const actions: ReadingActions = {
    continueReading: useCallback(() => actionsRef.current.continueReading(), []),
    selectSection: useCallback((s) => actionsRef.current.selectSection(s), []),
    markRead: useCallback((s) => actionsRef.current.markRead(s), []),
    claimBadge: useCallback(() => actionsRef.current.claimBadge(), []),
    close: useCallback(() => actionsRef.current.close(), []),
    backToList: useCallback(() => actionsRef.current.backToList(), []),
    openBadge: useCallback(() => actionsRef.current.openBadge(), []),
  };
  const overlayActions: OverlayActions = {
    openCollection: useCallback(() => overlayRef.current.openCollection(), []),
    openList: useCallback(() => overlayRef.current.openList(), []),
    openFromList: useCallback((id) => overlayRef.current.openFromList(id), []),
    closeOverlay: useCallback(() => overlayRef.current.closeOverlay(), []),
    askReset: useCallback(() => overlayRef.current.askReset(), []),
    cancelReset: useCallback(() => overlayRef.current.cancelReset(), []),
    confirmReset: useCallback(() => overlayRef.current.confirmReset(), []),
  };
  return { nearby, reading, actions, overlay, overlayActions };
}
