import type { BitacoraConfig } from "../../config/types";

/**
 * Escalas de referencia con las que se diseñaron las proporciones de los elementos del mundo (tamaños de
 * fuente, desplazamientos e iconos). Agrandar al personaje o a las señales por configuración los escala en
 * la misma proporción, para que los textos y marcas no queden pequeños junto a un dibujo mayor (SPEC 6.3).
 */
export const REF_PLAYER_SCALE = 0.24;
export const REF_SIGN_SCALE = 0.16;

/** Factor aplicado a los elementos que acompañan a las señales y portales. */
export const signFactor = (config: BitacoraConfig): number => config.gameplay.signScale / REF_SIGN_SCALE;

/** Factor aplicado a los efectos que acompañan al personaje (celebración, salto). */
export const playerFactor = (config: BitacoraConfig): number => config.gameplay.player.scale / REF_PLAYER_SCALE;
