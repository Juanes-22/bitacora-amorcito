import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhaserGame } from "../components/game/PhaserGame";
import { Cover } from "../components/ui/Cover";
import { LearningDialog } from "../components/reading/LearningDialog";
import { BadgeCollection } from "../components/ui/BadgeCollection";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { LearningList } from "../components/ui/LearningList";
import { ControlsModeToggle } from "../components/ui/ControlsModeToggle";
import { JerryActionButton } from "../components/ui/JerryActionButton";
import { MusicToggle } from "../components/ui/MusicToggle";
import { TouchControls } from "../components/ui/TouchControls";
import { ProgressHUD } from "../components/ui/ProgressHUD";
import { NearbyPrompt, type PromptHint } from "../components/ui/NearbyPrompt";
import type { AssetRegistry } from "../config/assetRegistry";
import { createLoader, describeFailure, type LoadResult } from "../config/loadApp";
import type { BitacoraConfig } from "../config/types";
import { GameBridge } from "../game/bridge/GameBridge";
import type { AssetFailure, ControlsMode } from "../game/bridge/events";
import { BitacoraProvider } from "./BitacoraProvider";
import { createMusicPlayer } from "../audio/createMusicPlayer";
import { PreferencesStorage } from "../storage/preferencesStorage";
import { ProgressStorage } from "../storage/progressStorage";
import { ProgressProvider } from "./ProgressProvider";
import { ProgressStore } from "./progressStore";
import { useProgressController } from "./useProgressController";
import { useTouchMode } from "./useTouchMode";

type Loader = () => Promise<LoadResult>;
const defaultLoader: Loader = createLoader();

export function App({ load = defaultLoader }: { load?: Loader }) {
  const [state, setState] = useState<{ phase: "loading" } | { phase: "done"; result: LoadResult }>({ phase: "loading" });

  const run = useCallback(() => {
    setState({ phase: "loading" });
    load().then((result) => setState({ phase: "done", result }));
  }, [load]);
  useEffect(run, [run]);

  if (state.phase === "loading") {
    return (
      <div className="app">
        <p className="status" role="status">Cargando bitácora…</p>
      </div>
    );
  }
  const { result } = state;
  if (!result.ok) {
    return (
      <div className="app">
        <div className="status" role="alert">
          <div>
            <p>No se pudo abrir la bitácora. Tu avance guardado no se ha modificado.</p>
            <pre style={{ whiteSpace: "pre-wrap", textAlign: "left" }}>{describeFailure(result.failure)}</pre>
            <button type="button" onClick={run}>Reintentar</button>
          </div>
        </div>
      </div>
    );
  }
  return <Loaded config={result.config} assets={result.assets} />;
}

/** Pantalla con la configuración ya validada: un almacén de progreso, un puente, un juego y un controlador por carga. */
function Loaded({ config, assets }: { config: BitacoraConfig; assets: AssetRegistry }) {
  // Crear el almacén solo LEE el guardado y lo reconcilia; nada se escribe hasta que hay una acción.
  const store = useMemo(() => new ProgressStore(config, new ProgressStorage()), [config]);
  const bridge = useMemo(() => new GameBridge(), [config, assets]);
  const initial = useMemo(() => ({ zoneId: store.getState().currentZoneId, position: store.getState().player }), [store]);
  // La música es independiente del mapa y del progreso: no se corta al cambiar de zona ni al reiniciar el recorrido.
  const preferences = useMemo(() => new PreferencesStorage(), []);
  const music = useMemo(() => createMusicPlayer(config, assets, preferences), [config, assets, preferences]);
  // Controles táctiles: el visitante elige; sin elección manda la configuración (por defecto, tocar para caminar).
  const [controlsMode, setControlsMode] = useState<ControlsMode>(() => preferences.touchControls ?? config.gameplay.touchControls);
  useEffect(() => bridge.emit("app:controls-mode", { mode: controlsMode }), [bridge, controlsMode]);
  const toggleControls = () => {
    const next: ControlsMode = controlsMode === "tap" ? "dpad" : "tap";
    preferences.setTouchControls(next);
    setControlsMode(next);
  };
  useEffect(() => () => music?.dispose(), [music]);
  const [started, setStarted] = useState(false);
  const [assetFailures, setAssetFailures] = useState<AssetFailure[]>([]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);

  // Al destruir el host se liberan las suscripciones de ESTE puente, no las de otros componentes.
  useEffect(() => () => bridge.dispose(), [bridge]);
  useEffect(() => bridge.on("game:asset-failures", ({ failures }) => setAssetFailures(failures)), [bridge]);

  const { nearby, reading, actions, overlay, overlayActions } = useProgressController(bridge, config, store, hostRef);

  useEffect(() => {
    document.title = `${config.project.title} | ${config.project.studentName}`;
  }, [config]);
  useEffect(() => {
    if (!started) startRef.current?.focus();
  }, [started]);
  // El mapa es `inert` con la portada o la lectura abiertas: el foco vuelve a él cuando ya dejó de serlo.
  const readingWasOpen = useRef(false);
  useEffect(() => {
    const open = !!reading || !!overlay;
    if (started && !open && (readingWasOpen.current || !document.activeElement || document.activeElement === document.body)) {
      hostRef.current?.focus();
    }
    readingWasOpen.current = open;
  }, [started, reading, overlay]);

  // Herramientas junto a la cabecera: la lista accesible (SPEC 14) y, si hay música, su botón de apagar/encender.
  const modalOpen = !!reading || !!overlay;
  const touchMode = useTouchMode();
  const hint: PromptHint = !touchMode ? "key" : controlsMode === "tap" ? "tap" : "button";
  const tools = (
    <>
      <button type="button" className="hud__list" onClick={overlayActions.openList} disabled={modalOpen}>
        {config.ui.labels.index}
      </button>
      <JerryActionButton bridge={bridge} disabled={modalOpen} />
      <ControlsModeToggle mode={controlsMode} onToggle={toggleControls} />
      {music ? <MusicToggle player={music} onPointerUse={() => { if (!modalOpen) hostRef.current?.focus(); }} /> : null}
    </>
  );

  return (
    <BitacoraProvider config={config} assets={assets}>
      <ProgressProvider store={store}>
        <div className="app">
          <PhaserGame config={config} assets={assets} bridge={bridge} initial={initial} inert={!started || !!reading || !!overlay} hostRef={hostRef} />
          {started ? <ProgressHUD onOpenBadges={reading || overlay ? undefined : overlayActions.openCollection} tools={tools} /> : null}
          {started ? <NearbyPrompt target={reading ? null : nearby} hint={hint} /> : null}
          {started && !modalOpen && controlsMode === "dpad" ? <TouchControls bridge={bridge} /> : null}
          {reading ? <LearningDialog reading={reading} actions={actions} /> : null}
          {overlay?.kind === "collection" ? (
            <BadgeCollection completion={overlay.completion} onClose={overlayActions.closeOverlay} onReset={overlayActions.askReset} />
          ) : null}
          {overlay?.kind === "list" ? <LearningList onOpen={overlayActions.openFromList} onClose={overlayActions.closeOverlay} /> : null}
          {overlay?.kind === "confirm-reset" ? <ConfirmDialog onConfirm={overlayActions.confirmReset} onCancel={overlayActions.cancelReset} /> : null}
          {!started ? <Cover hasProgress={hasProgress(store)} onStart={() => { music?.start(); setStarted(true); }} startRef={startRef} /> : null}
          {assetFailures.length ? (
            <div className="asset-alert" role="alert">
              <p>No se pudieron cargar algunos gráficos del mapa:</p>
              <ul>
                {assetFailures.map((f) => (
                  <li key={f.assetId}>
                    {f.assetId} — {f.url}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </ProgressProvider>
    </BitacoraProvider>
  );
}

/** «Continuar recorrido» si hay lecturas marcadas o insignias; «Comenzar» si es la primera visita. */
function hasProgress(store: ProgressStore): boolean {
  return Object.values(store.getState().entries).some((e) => e.readSectionIds.length > 0 || e.completedAt !== undefined);
}
