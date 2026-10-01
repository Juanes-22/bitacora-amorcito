import Phaser from "phaser";
import type { GameBridge } from "../bridge/GameBridge";
import type { Direction } from "../bridge/events";

/**
 * Único punto de entrada del movimiento: teclado y controles táctiles de React (`ui:*`) confluyen aquí
 * (SPEC 6.1). El teclado escucha solo en el contenedor del mapa (config `input.keyboard.target`), así
 * que las flechas no se capturan cuando el foco está fuera.
 */
export class InputController {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly enter: Phaser.Input.Keyboard.Key;
  private readonly ui = new Set<Direction>();
  private pendingInteract = false;
  private pendingAction = false;
  private actionKey?: Phaser.Input.Keyboard.Key;
  private enabled = true;
  private readonly offs: Array<() => void> = [];
  private readonly host: HTMLElement | null;

  constructor(private readonly scene: Phaser.Scene, bridge: GameBridge, actionKeyCode?: string) {
    const keyboard = scene.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin;
    this.cursors = keyboard.createCursorKeys();
    // Solo una pulsación NUEVA interactúa: `down` no se repite con la tecla mantenida.
    this.enter = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER, true, false);
    // La autorepetición del sistema no cuenta: con Enter mantenido el foco puede pasar por un diálogo
    // y volver, y Phaser vería un nuevo `down`. `event.repeat` lo distingue (SPEC 6.3).
    this.enter.on("down", (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      if (!event?.repeat) this.press();
    });

    // Jugar con Jerry: una tecla de letra (config `idle.actionKey`) o el botón (`ui:jerry-action`). Solo una pulsación NUEVA.
    if (actionKeyCode) {
      this.actionKey = keyboard.addKey(actionKeyCode, false, false);
      this.actionKey.on("down", (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
        if (!event?.repeat && this.enabled) this.pendingAction = true;
      });
    }
    this.offs.push(
      bridge.on("ui:jerry-action", () => {
        if (this.enabled) this.pendingAction = true;
      }),
      bridge.on("ui:direction", ({ direction, pressed }) => void (pressed ? this.ui.add(direction) : this.ui.delete(direction))),
      bridge.on("ui:interact", ({ pressed }) => pressed && this.press()),
    );

    // Pérdida de foco, pestaña oculta o ventana sin foco: limpiar todo para no dejar teclas «pegadas».
    this.host = (scene.game.config.inputKeyboardEventTarget as HTMLElement | null) ?? null;
    const reset = () => this.reset();
    this.host?.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    window.addEventListener("blur", reset);
    this.offs.push(() => {
      this.host?.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
      window.removeEventListener("blur", reset);
    });
  }

  private press(): void {
    if (this.enabled) this.pendingInteract = true;
  }

  /** Pide interactuar con lo que haya cerca (Enter, «Explorar» o el toque sobre la estación). */
  requestInteract(): void {
    this.press();
  }

  /** Vector de movimiento de longitud ≤ 1: la diagonal no es más rápida. Direcciones opuestas se anulan. */
  vector(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    const left = this.cursors.left.isDown || this.ui.has("left");
    const right = this.cursors.right.isDown || this.ui.has("right");
    const up = this.cursors.up.isDown || this.ui.has("up");
    const down = this.cursors.down.isDown || this.ui.has("down");
    const x = Number(right) - Number(left);
    const y = Number(down) - Number(up);
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  /** `true` una sola vez por pulsación nueva. */
  consumeInteract(): boolean {
    const pressed = this.pendingInteract;
    this.pendingInteract = false;
    return pressed;
  }

  /** `true` una sola vez por petición de jugar con Jerry. */
  consumeAction(): boolean {
    const pressed = this.pendingAction;
    this.pendingAction = false;
    return pressed;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  reset(): void {
    this.scene.input.keyboard?.resetKeys();
    this.ui.clear();
    this.pendingInteract = false;
    this.pendingAction = false;
  }

  destroy(): void {
    this.offs.forEach((off) => off());
    this.offs.length = 0;
    this.enter.removeAllListeners();
    this.scene.input.keyboard?.removeKey(this.enter);
    if (this.actionKey) {
      this.actionKey.removeAllListeners();
      this.scene.input.keyboard?.removeKey(this.actionKey);
    }
    this.reset();
  }
}
