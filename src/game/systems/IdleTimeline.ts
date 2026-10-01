export type IdleState = "walk" | "rest" | "glance" | "play" | "tricks" | "fetch";
/** Lo que pide el visitante (tecla o botón): Jerry trae el peluche o hace sus trucos. */
export type IdleAction = "fetch" | "tricks";
export type Facing = "up" | "down" | "left" | "right";
type Gesture = "glance" | "play";

export interface IdleTiming {
  /** Quieta este tiempo sin entrada: Vanessa y Jerry se miran. */
  glanceAfterMs: number;
  /** Quieta este tiempo desde el último gesto, de frente: juegan. */
  playAfterMs: number;
  /** Mínimo entre el final de un gesto y el comienzo del siguiente. */
  gestureCooldownMs: number;
}

/**
 * Cuándo toca cada animación de reposo (SPEC 6.2). Es una máquina de estados pura, sin Phaser: recibe el paso del tiempo,
 * si hay movimiento y hacia dónde mira, y dice en qué estado está. Al moverse siempre manda «walk» (cancela cualquier gesto
 * y reinicia el temporizador). Al quedarse quieta, «rest» al instante; después se turnan la mirada y el juego (el juego solo
 * de frente; de lado o de espaldas se repite la mirada), nunca dos a la vez y siempre con una pausa entre ellos. Las
 * acciones «fetch» (buscar el peluche) y «tricks» (los trucos de Jerry) no salen solas: las pide el visitante con
 * `startAction()`, cortan cualquier gesto y no alteran la rotación.
 */
export class IdleTimeline {
  private current: IdleState = "walk";
  private idleMs = 0;
  private cooldownLeft = 0;
  private readonly order: Gesture[];
  private index = 0;

  constructor(private readonly timing: IdleTiming) {
    this.order = ["glance", "play"];
  }

  get state(): IdleState {
    return this.current;
  }

  /** Avanza `dt` ms. Devuelve `true` si el estado cambió. */
  tick(dt: number, moving: boolean, facing: Facing): boolean {
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    const before = this.current;
    if (moving) {
      this.current = "walk";
      this.idleMs = 0;
      return before !== "walk";
    }
    if (this.current === "walk") {
      this.current = "rest";
      this.idleMs = 0;
      return true;
    }
    if (this.current !== "rest") return false; // un gesto en curso termina por sí solo (gestureDone / actionDone)
    this.idleMs += dt;
    if (this.cooldownLeft > 0) return false;
    const due = this.dueAfter(this.order[this.index]);
    const front = facing === "down";
    if (this.order[this.index] !== "glance" && front && this.idleMs >= due) this.current = this.order[this.index];
    else if (this.idleMs >= this.timing.glanceAfterMs && (this.order[this.index] === "glance" || !front)) this.current = "glance";
    return this.current !== before;
  }

  private dueAfter(gesture: Gesture): number {
    return gesture === "glance" ? this.timing.glanceAfterMs : this.timing.playAfterMs;
  }

  /** El gesto terminó de reproducirse: vuelve al reposo, se reinicia la espera y empieza la pausa entre gestos. */
  gestureDone(): boolean {
    if (this.current !== "glance" && this.current !== "play") return false;
    this.index = (this.index + 1) % this.order.length;
    return this.finish();
  }

  /** El visitante pide una acción: corta cualquier gesto y arranca; no se reinicia si ya hay una en curso. */
  startAction(action: IdleAction): boolean {
    if (this.current === "fetch" || this.current === "tricks") return false;
    this.current = action;
    this.idleMs = 0;
    return true;
  }

  /** La acción terminó (y, en la búsqueda, se mantuvo el último fotograma): vuelve al reposo con su pausa. */
  actionDone(): boolean {
    if (this.current !== "fetch" && this.current !== "tricks") return false;
    return this.finish();
  }

  private finish(): boolean {
    this.current = "rest";
    this.idleMs = 0;
    this.cooldownLeft = this.timing.gestureCooldownMs;
    return true;
  }

  /** Corta cualquier gesto y vuelve a empezar (movimiento, celebración, cambio de hoja). */
  cancel(): void {
    this.current = "walk";
    this.idleMs = 0;
  }
}
