import type { AppSnapshot, BridgeEventName, BridgeEvents, ControlsMode } from "./events";

type Handler<K extends BridgeEventName> = (payload: BridgeEvents[K]) => void;

/**
 * Puente tipado, acotado al ciclo de vida del host (una instancia por Phaser.Game). Los eventos son
 * avisos, no la fuente de verdad: por eso conserva la última instantánea y la última lista de
 * bloqueos para quien arranque después del emisor (SPEC 11.5).
 */
export class GameBridge {
  private handlers = new Map<BridgeEventName, Set<(payload: never) => void>>();
  private tokenCounter = 0;
  private activeToken = 0;
  private lastSnapshot: AppSnapshot | null = null;
  private lastControls: readonly string[] = [];
  private lastMode: ControlsMode = "tap";

  /** Suscribe y devuelve la función que retira exactamente esa suscripción. */
  on<K extends BridgeEventName>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(handler as (payload: never) => void);
    return () => void set.delete(handler as (payload: never) => void);
  }

  emit<K extends BridgeEventName>(event: K, payload: BridgeEvents[K]): void {
    if (event === "app:sync") this.lastSnapshot = payload as AppSnapshot;
    if (event === "app:controls") this.lastControls = (payload as BridgeEvents["app:controls"]).reasons;
    if (event === "app:controls-mode") this.lastMode = (payload as BridgeEvents["app:controls-mode"]).mode;
    // Copia: un manejador puede darse de baja mientras se emite.
    for (const handler of [...(this.handlers.get(event) ?? [])]) (handler as Handler<K>)(payload);
  }

  /** Nueva instancia de escena: invalida los mensajes de la anterior. */
  beginScene(): number {
    this.activeToken = ++this.tokenCounter;
    return this.activeToken;
  }

  isActive(token: number): boolean {
    return token === this.activeToken;
  }

  get snapshot(): AppSnapshot | null {
    return this.lastSnapshot;
  }

  /** Último modo de controles táctiles publicado (para quien arranque después del emisor). */
  get controlsMode(): ControlsMode {
    return this.lastMode;
  }

  get controlReasons(): readonly string[] {
    return this.lastControls;
  }

  listenerCount(event?: BridgeEventName): number {
    if (event) return this.handlers.get(event)?.size ?? 0;
    let total = 0;
    for (const set of this.handlers.values()) total += set.size;
    return total;
  }

  /** Al destruir el host: libera las suscripciones de este puente, no las de otros componentes. */
  dispose(): void {
    this.handlers.clear();
    this.lastSnapshot = null;
    this.lastControls = [];
    this.activeToken = 0;
  }
}
