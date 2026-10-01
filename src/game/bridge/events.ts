import type { StationState } from "../../domain/progression";
import type { Point } from "../../config/types";

export type Direction = "up" | "down" | "left" | "right";

/** Controles táctiles: `tap` (tocar para caminar) o `dpad` (cruceta y «Explorar»). */
export type ControlsMode = "tap" | "dpad";

/** Lo que el visitante tiene al alcance: un aprendizaje o un portal (SPEC 11.5). */
export type NearbyTarget = { kind: "learning"; id: string } | { kind: "portal"; id: string };

/** Un asset gráfico que no cargó: el ID del catálogo y la URL resuelta (SPEC 12.3, AC-20). */
export interface AssetFailure {
  assetId: string;
  url: string;
}

/** Instantánea derivada que la aplicación entrega a Phaser: pinta, nunca decide (SPEC 11.1). */
export interface AppSnapshot {
  version: number;
  stations: Readonly<Record<string, StationState>>;
  /** Aprendizajes activos aún sin aprobar (modo final): se identifican como pendientes, no se ocultan. */
  pending: readonly string[];
}

/**
 * Contrato del puente entre Phaser y la aplicación. Los nombres son de esta aplicación, no de Phaser.
 * `token` identifica la instancia de escena: se descartan los mensajes de una escena ya sustituida.
 */
export interface BridgeEvents {
  "game:ready": { zoneId: string; token: number; position: Point };
  "game:nearby-changed": { target: NearbyTarget | null; token: number };
  "game:learning-open-request": { learningId: string; token: number; requestId: string };
  "game:portal-request": { portalId: string; fromZoneId: string; token: number; requestId: string };
  "game:checkpoint": { zoneId: string; position: Point; token: number };
  "game:asset-failures": { failures: AssetFailure[]; token: number };

  "app:sync": AppSnapshot;
  "app:zone-change": { zoneId: string; spawnId: string };
  /** Una solicitud se resuelve una sola vez; una denegación también libera el bloqueo temporal. */
  "app:request-resolved": { requestId: string; accepted: boolean; reason?: string };
  /** Motivos de bloqueo activos (lectura, transición…): con alguno, la exploración se detiene. */
  "app:controls": { reasons: readonly string[] };
  "app:celebrate": { effectId: string; learningId: string };
  /** Cómo se maneja con el dedo: tocar para caminar o cruceta (SPEC 6.1). El teclado funciona siempre. */
  "app:controls-mode": { mode: ControlsMode };

  "ui:direction": { direction: Direction; pressed: boolean };
  "ui:interact": { pressed: boolean };
}

export type BridgeEventName = keyof BridgeEvents;
