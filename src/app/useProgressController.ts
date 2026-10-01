import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { isAdmissible, stationStatesOf, summarize, unapprovedIds } from "../domain/progression";
import type { BitacoraConfig, DialogueEvent, SectionId } from "../config/types";
import type { GameBridge } from "../game/bridge/GameBridge";
import type { NearbyTarget } from "../game/bridge/events";
import type { ProgressStore } from "./progressStore";

/** Lo que muestra la ventana de lectura (SPEC 12.7): mensaje → lectura → recompensa, o solo un mensaje. */
export type ReadingState =
  | { kind: "message"; learningId: string; event: Extract<DialogueEvent, "locked"> | "pending" }
  | { kind: "intro"; learningId: string; event: Extract<DialogueEvent, "open" | "completed"> }
  | { kind: "reading"; learningId: string; active: SectionId }
  | { kind: "reward"; learningId: string };

/** Ventanas que no son una lectura: la colección de insignias (o el cierre del recorrido) y la confirmación de reinicio. */
export type OverlayState = { kind: "collection"; completion: boolean } | { kind: "confirm-reset" };

export interface OverlayActions {
  openCollection: () => void;
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
}

export interface ProgressController {
  nearby: NearbyTarget | null;
  reading: ReadingState | null;
  actions: ReadingActions;
  overlay: OverlayState | null;
  overlayActions: OverlayActions;
}

const NO_ACTIONS: ReadingActions = {
  continueReading() {}, selectSection() {}, markRead() {}, claimBadge() {}, close() {},
};
const NO_OVERLAY_ACTIONS: OverlayActions = { openCollection() {}, closeOverlay() {}, askReset() {}, cancelReset() {}, confirmReset() {} };

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
): ProgressController {
  const [nearby, setNearby] = useState<NearbyTarget | null>(null);
  const [reading, setReading] = useState<ReadingState | null>(null);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const actionsRef = useRef<ReadingActions>(NO_ACTIONS);
  const overlayRef = useRef<OverlayActions>(NO_OVERLAY_ACTIONS);

  useEffect(() => {
    if (!bridge || !config || !store) return;
    const reasons = new Set<string>();
    let zoneId = store.getState().currentZoneId;
    let version = 0;
    let lastStates = "";
    let current: ReadingState | null = null;
    let currentOverlay: OverlayState | null = null;
    let celebration: { effectId: string; learningId: string } | null = null;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    const pending = unapprovedIds(config);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const show = (next: ReadingState | null) => {
      current = next;
      setReading(next);
    };
    const publishControls = () => bridge.emit("app:controls", { reasons: [...reasons] });
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
        if (bridge.isActive(token)) setNearby(target);
      }),
      bridge.on("game:checkpoint", ({ zoneId: z, position, token }) => {
        if (bridge.isActive(token)) store.setLocation(z, position);
      }),
      bridge.on("game:learning-open-request", ({ learningId, token, requestId }) => {
        if (!bridge.isActive(token)) return; // mensaje de una escena sustituida
        if (!config.route.includes(learningId)) return resolve(requestId, false, "unknown-learning");
        if (currentOverlay || current) return resolve(requestId, false, "busy");
        const state = stationStatesOf(config, store.getState())[learningId];
        if (state === "locked") {
          resolve(requestId, false, "locked");
          return open({ kind: "message", learningId, event: "locked" });
        }
        if (state !== "completed" && !isAdmissible(config, learningId)) {
          resolve(requestId, false, "not-admissible");
          return open({ kind: "message", learningId, event: "pending" });
        }
        resolve(requestId, true);
        open({ kind: "intro", learningId, event: state === "completed" ? "completed" : "open" });
      }),
      bridge.on("game:portal-request", ({ portalId, fromZoneId, token, requestId }) => {
        if (!bridge.isActive(token)) return;
        // No se confía en el destino que envía el juego: se comprueba contra los datos del portal.
        const portal = fromZoneId === zoneId ? config.maps[fromZoneId]?.portals[portalId] : undefined;
        const target = portal ? config.maps[portal.targetZoneId] : undefined;
        if (!portal || !target?.spawns[portal.targetSpawnId]) return resolve(requestId, false, "invalid-portal");
        resolve(requestId, true);
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
        const entry = store.getState().entries[current.learningId];
        const first = config.ui.tabs[0].id;
        const last = entry?.lastSectionId && config.ui.tabs.some((t) => t.id === entry.lastSectionId) ? entry.lastSectionId : first;
        show({ kind: "reading", learningId: current.learningId, active: last });
      },
      selectSection(section) {
        if (current?.kind !== "reading") return;
        store.setActiveSection(current.learningId, section);
        show({ ...current, active: section });
      },
      markRead(section) {
        if (current?.kind === "reading") store.markSection(current.learningId, section);
      },
      claimBadge() {
        if (current?.kind !== "reading") return;
        const result = store.claimBadge(current.learningId);
        // Solo una transición NUEVA celebra: doble clic o Enter mantenido devuelven changed=false.
        if (result.ok && result.changed) {
          const completedAt = result.state.entries[current.learningId].completedAt;
          celebration = { effectId: `${current.learningId}@${completedAt}`, learningId: current.learningId };
          show({ kind: "reward", learningId: current.learningId });
        }
      },
      close() {
        if (!current) return;
        const pending = celebration;
        celebration = null;
        show(null);
        reasons.delete("reading");
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
        if (!current && !currentOverlay) openOverlay({ kind: "collection", completion: false });
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
  }, [bridge, config, store, hostRef]);

  const actions: ReadingActions = {
    continueReading: useCallback(() => actionsRef.current.continueReading(), []),
    selectSection: useCallback((s) => actionsRef.current.selectSection(s), []),
    markRead: useCallback((s) => actionsRef.current.markRead(s), []),
    claimBadge: useCallback(() => actionsRef.current.claimBadge(), []),
    close: useCallback(() => actionsRef.current.close(), []),
  };
  const overlayActions: OverlayActions = {
    openCollection: useCallback(() => overlayRef.current.openCollection(), []),
    closeOverlay: useCallback(() => overlayRef.current.closeOverlay(), []),
    askReset: useCallback(() => overlayRef.current.askReset(), []),
    cancelReset: useCallback(() => overlayRef.current.cancelReset(), []),
    confirmReset: useCallback(() => overlayRef.current.confirmReset(), []),
  };
  return { nearby, reading, actions, overlay, overlayActions };
}
