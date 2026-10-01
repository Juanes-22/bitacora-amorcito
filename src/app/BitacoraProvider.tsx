import { createContext, useContext, type ReactNode } from "react";
import type { AssetRegistry } from "../config/assetRegistry";
import type { BitacoraConfig } from "../config/types";

interface BitacoraContextValue {
  config: BitacoraConfig;
  assets: AssetRegistry;
}

const BitacoraContext = createContext<BitacoraContextValue | null>(null);

/** Reparte la configuración validada y el AssetRegistry; React y Phaser consumen los mismos objetos. */
export function BitacoraProvider({ config, assets, children }: BitacoraContextValue & { children: ReactNode }) {
  return <BitacoraContext.Provider value={{ config, assets }}>{children}</BitacoraContext.Provider>;
}

export function useBitacora(): BitacoraContextValue {
  const value = useContext(BitacoraContext);
  if (!value) throw new Error("useBitacora debe usarse dentro de <BitacoraProvider>");
  return value;
}
