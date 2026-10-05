import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhaserGame } from "../components/game/PhaserGame";
import { Cover } from "../components/ui/Cover";
import { LearningDialog } from "../components/reading/LearningDialog";
import { BadgeCollection } from "../components/ui/BadgeCollection";
import { BadgePanel } from "../components/ui/BadgePanel";
import { JournalIndex } from "../components/ui/JournalIndex";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { LearningList } from "../components/ui/LearningList";
import { IconButton } from "../components/ui/IconButton";
import { JerryActionButton } from "../components/ui/JerryActionButton";
import { SoundToggle } from "../components/ui/SoundToggle";
import { ProgressHUD } from "../components/ui/ProgressHUD";
import { NearbyPrompt, type PromptHint } from "../components/ui/NearbyPrompt";
import type { AssetRegistry } from "../config/assetRegistry";
import { createLoader, describeFailure, type LoadResult } from "../config/loadApp";
import { fullTitle } from "../domain/projectTitle";
import type { BitacoraConfig } from "../config/types";
import { GameBridge } from "../game/bridge/GameBridge";
import type { AssetFailure } from "../game/bridge/events";
import { BitacoraProvider } from "./BitacoraProvider";
import { ControlReasons } from "./controlReasons";
import { createMusicPlayer } from "../audio/createMusicPlayer";
import { SfxService } from "../audio/SfxService";
import { SoundControl } from "../audio/SoundControl";
import { audioLabRequested } from "../dev/audioLabFlag";
import { PreferencesStorage } from "../storage/preferencesStorage";
import { ProgressStorage } from "../storage/progressStorage";
import { ProgressProvider } from "./ProgressProvider";
import { ProgressStore } from "./progressStore";
import { useProgressController } from "./useProgressController";
import { useTouchMode } from "./useTouchMode";

// El laboratorio de sonidos (SPEC 6.5) solo existe en desarrollo: `import.meta.env.DEV` vale `false` al compilar y el compilador elimina
// esta rama, el `import()` y el panel con ella. No hay código de laboratorio en `dist`.
const AudioLabHost = import.meta.env.DEV ? lazy(() => import("../dev/audio-lab/AudioLabHost")) : null;

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
  useEffect(() => () => music?.dispose(), [music]);
  // Los efectos de sonido (SPEC 6.5) son otro servicio, también ajeno al progreso: uno por carga, que el juego recibe y al que se conecta.
  // Solo existe si están configurados y activos (o si el laboratorio de desarrollo lo pide); sin él el juego es el de siempre.
  const labRequested = audioLabRequested();
  const sfx = useMemo(
    () => (config.audio.sfx?.active || labRequested ? new SfxService(config.audio.sfx, assets, {}, preferences.soundMuted) : null),
    [config, assets, preferences, labRequested],
  );
  useEffect(() => {
    sfx?.revive(); // React (StrictMode) puede limpiar y volver a montar el efecto con la misma instancia
    return () => sfx?.dispose();
  }, [sfx]);
  const soundControl = useMemo(() => (music || sfx?.enabled ? new SoundControl(music, sfx, preferences) : null), [music, sfx, preferences]);
  useEffect(() => soundControl?.connect(), [soundControl]);
  const [started, setStarted] = useState(false);
  const [assetFailures, setAssetFailures] = useState<AssetFailure[]>([]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);

  // Al destruir el host se liberan las suscripciones de ESTE puente, no las de otros componentes.
  useEffect(() => () => bridge.dispose(), [bridge]);
  // Un solo propietario de los motivos por los que el mapa está detenido: lo comparten el controlador de progreso y el laboratorio.
  const controls = useMemo(() => new ControlReasons(bridge), [bridge]);
  // Mientras hay una lectura abierta el ambiente del mapa calla (los efectos de interfaz no); al cerrarla, los bucles vuelven.
  useEffect(() => {
    if (!sfx) return;
    return bridge.on("app:controls", ({ reasons }) => sfx.setSuspended("reading", reasons.includes("reading")));
  }, [bridge, sfx]);
  useEffect(() => bridge.on("game:asset-failures", ({ failures }) => setAssetFailures(failures)), [bridge]);

  const { nearby, reading, actions, overlay, overlayActions } = useProgressController(bridge, config, store, hostRef, { sfx, controls });

  useEffect(() => {
    document.title = `${fullTitle(config.project)} | ${config.project.studentName}`;
  }, [config]);
  useEffect(() => {
    // El foco inicial va al botón de la portada sin anillo (no es una pulsación de teclado) y sin desplazar la portada (en un móvil
    // es más alta que la pantalla y debe verse desde el título): el anillo sale al usar el teclado.
    if (!started) startRef.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
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
  const hint: PromptHint = touchMode ? "tap" : "key"; // con el dedo se camina y se explora tocando; con teclado, Enter
  const tools = (
    <>
      <IconButton assetId={config.ui.assets.listButton} label={config.ui.labels.index} caption={config.ui.labels.captionJournal} className="hud__list" onClick={overlayActions.openList} disabled={modalOpen} />
      <JerryActionButton bridge={bridge} disabled={modalOpen} />
      {soundControl ? <SoundToggle control={soundControl} onPointerUse={() => { if (!modalOpen) hostRef.current?.focus(); }} /> : null}
    </>
  );

  return (
    <BitacoraProvider config={config} assets={assets}>
      <ProgressProvider store={store}>
        <div className="app">
          <main className="stage">
            <PhaserGame config={config} assets={assets} bridge={bridge} initial={initial} inert={!started || !!reading || !!overlay} hostRef={hostRef} sfx={sfx} />
            {started ? <NearbyPrompt target={reading ? null : nearby} hint={hint} /> : null}
          </main>
          {started ? <ProgressHUD bridge={bridge} onOpenBadges={reading || overlay ? undefined : overlayActions.openCollection} tools={tools} /> : null}
          {reading ? <LearningDialog reading={reading} actions={actions} /> : null}
          {overlay?.kind === "collection" ? (
            config.ui.badgePanel ? (
              <BadgePanel completion={overlay.completion} onClose={overlayActions.closeOverlay} onReset={overlayActions.askReset} onOpenLearning={overlayActions.openFromList} initialLearningId={overlay.learningId} />
            ) : (
              <BadgeCollection completion={overlay.completion} onClose={overlayActions.closeOverlay} onReset={overlayActions.askReset} />
            )
          ) : null}
          {overlay?.kind === "list" ? (
            config.ui.journalPanel && config.ui.badgePanel ? (
              <JournalIndex onOpen={overlayActions.openFromList} onClose={overlayActions.closeOverlay} />
            ) : (
              <LearningList onOpen={overlayActions.openFromList} onClose={overlayActions.closeOverlay} />
            )
          ) : null}
          {overlay?.kind === "confirm-reset" ? <ConfirmDialog onConfirm={overlayActions.confirmReset} onCancel={overlayActions.cancelReset} /> : null}
          {!started ? <Cover hasProgress={hasProgress(store)} onStart={() => { music?.start(); void sfx?.unlock(); setStarted(true); }} startRef={startRef} /> : null}
          {labRequested && AudioLabHost && sfx ? (
            <Suspense fallback={null}>
              <AudioLabHost sfx={sfx} music={music} config={config} assets={assets} controls={controls} started={started} />
            </Suspense>
          ) : null}
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
