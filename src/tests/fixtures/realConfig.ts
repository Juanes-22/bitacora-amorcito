import bitacoraContent from "../../../public/config/bitacora.json";
import mapsFile from "../../../public/config/maps.json";
import { mergeConfig } from "../../config/mapsFile";
import type { BitacoraConfig, BitacoraContent, MapsFile } from "../../config/types";

/**
 * La configuración real tal como la usa el juego: `bitacora.json` (contenido) y `maps.json` (geometría) en un solo objeto. Las pruebas
 * que trabajan sobre «la configuración real» importan esto en lugar de uno solo de los dos archivos.
 */
export const realConfig: BitacoraConfig = mergeConfig(bitacoraContent as unknown as BitacoraContent, mapsFile as unknown as MapsFile);
export default realConfig;
