import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { summarize, type ProgressSummary } from "../domain/progression";
import type { SavedProgress } from "../domain/types";
import { useBitacora } from "./BitacoraProvider";
import type { ProgressStore } from "./progressStore";

const ProgressContext = createContext<ProgressStore | null>(null);

export function ProgressProvider({ store, children }: { store: ProgressStore; children: ReactNode }) {
  return <ProgressContext.Provider value={store}>{children}</ProgressContext.Provider>;
}

export function useProgressStore(): ProgressStore {
  const store = useContext(ProgressContext);
  if (!store) throw new Error("useProgressStore debe usarse dentro de <ProgressProvider>");
  return store;
}

/** Estado vigente y totales derivados; se vuelve a pintar solo cuando el estado cambia de verdad. */
export function useProgress(): { state: SavedProgress; summary: ProgressSummary; persisting: boolean } {
  const store = useProgressStore();
  const { config } = useBitacora();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const persisting = useSyncExternalStore(store.subscribe, store.isPersisting);
  return { state, summary: summarize(config, state), persisting };
}
