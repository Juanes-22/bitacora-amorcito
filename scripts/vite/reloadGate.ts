/**
 * Compuerta de la recarga del navegador en desarrollo. Varios archivos de configuración pueden cambiar a la vez (un guardado del
 * laboratorio de sonidos escribe `maps.json`, `bitacora.json`, `assets.json` y un `.tmj`): sin compuerta cada uno recargaría la página.
 * Aquí todos los avisos se agrupan en UNA recarga, y mientras un guardado esté en curso (`hold`) no se recarga hasta que termine.
 */
export class ReloadGate {
  private holds = 0;
  private pending = false;
  private timer: NodeJS.Timeout | undefined;
  private reload: (() => void) | null = null;

  constructor(private readonly settleMs = 250) {}

  /** Lo que hace la recarga (el servidor de desarrollo la conecta al arrancar). */
  attach(reload: () => void): void {
    this.reload = reload;
  }

  /** Un archivo vigilado cambió: la página debe recargarse (una sola vez, cuando todo se asiente). */
  request(): void {
    this.pending = true;
    this.arm();
  }

  /** Empieza un guardado: no se recarga hasta que termine. */
  hold(): void {
    this.holds++;
  }

  release(): void {
    this.holds = Math.max(0, this.holds - 1);
    this.arm();
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.reload = null;
  }

  private arm(): void {
    clearTimeout(this.timer);
    if (!this.pending || this.holds > 0) return;
    // Los eventos del sistema de archivos llegan después de la escritura: se espera a que dejen de llegar.
    this.timer = setTimeout(() => {
      if (this.holds > 0 || !this.pending) return;
      this.pending = false;
      this.reload?.();
    }, this.settleMs);
  }
}
