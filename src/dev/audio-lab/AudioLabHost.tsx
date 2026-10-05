import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ControlReasons } from "../../app/controlReasons";
import type { MusicPlayer } from "../../audio/MusicPlayer";
import type { SfxService } from "../../audio/SfxService";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { BitacoraConfig } from "../../config/types";
import { AudioLabController } from "./controller";
import { splitSoundKey } from "./draft";
import { MapView } from "./MapView";
import { Diagnostics, EmitterEditor, FilePanel, PresetsPanel } from "./panels";
import { SelectField } from "./fields";
import "./audioLab.css";

/**
 * Laboratorio de sonidos (SPEC 6.5): SOLO en desarrollo y con `?audioLab=1`. Un botón «Sonidos» abre un panel con tres pestañas
 * (Mapa, Presets y Archivo de prueba) para escuchar, ajustar y guardar los sonidos del mapa y los efectos de interfaz sin recrear el
 * juego. Se carga con `import()` bajo `import.meta.env.DEV`: la compilación de producción no lo incluye.
 */

type Tab = "map" | "presets" | "files";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "map", label: "Mapa" },
  { id: "presets", label: "Presets" },
  { id: "files", label: "Archivo de prueba" },
];

export interface AudioLabHostProps {
  sfx: SfxService;
  music: MusicPlayer | null;
  config: BitacoraConfig;
  assets: AssetRegistry;
  controls: ControlReasons;
  /** El visitante ya pasó la portada: el modo recorrido solo funciona entonces. */
  started: boolean;
}

export default function AudioLabHost({ sfx, music, config, assets, controls, started }: AudioLabHostProps) {
  const lab = useMemo(() => new AudioLabController({ sfx, music, config, assets, controls }), [sfx, music, config, assets, controls]);
  const state = useSyncExternalStore(lab.subscribe, lab.getState);
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem("bitacora:audio-lab:open") === "1";
    } catch {
      return false;
    }
  });
  const [tab, setTab] = useState<Tab>("map");
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const fileImport = useRef<HTMLInputElement | null>(null);

  const setPanel = useCallback((next: boolean) => {
    setOpen(next);
    try {
      sessionStorage.setItem("bitacora:audio-lab:open", next ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void lab.opened();
    return () => lab.closed();
  }, [lab, open]);
  useEffect(() => () => lab.dispose(), [lab]);

  // Atajo: Alt + Mayús + S abre y cierra el panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyS") {
        e.preventDefault();
        setPanel(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setPanel]);

  const zone = config.maps[state.zoneId];
  const sounds = lab.zoneSounds(state.zoneId);
  const drafted = useMemo(() => new Set(Object.keys(state.drafts.sounds).map((k) => splitSoundKey(k)).filter((k) => k.zoneId === state.zoneId).map((k) => k.soundId)), [state.drafts, state.zoneId]);
  const diagMap = useMemo(() => new Map(state.diagnostics.emitters.map((e) => [e.id, e])), [state.diagnostics]);
  const selectedId = state.selection?.kind === "emitter" && state.selection.zoneId === state.zoneId ? state.selection.soundId : null;
  const dirtyCount = Object.keys(state.drafts.sounds).length + Object.keys(state.drafts.presets).length + Object.keys(state.drafts.general).length;
  const listener = state.mode === "virtual" ? state.virtual : (state.diagnostics.listener ?? state.virtual);
  const sfxActive = sfx.enabled;

  const exportSettings = () => {
    const out = lab.exportText();
    if ("error" in out) return;
    const url = URL.createObjectURL(new Blob([out.text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = out.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importSettings = async (list: FileList | null) => {
    const file = list?.[0];
    if (file) await lab.importText(await file.text());
    if (fileImport.current) fileImport.current.value = "";
  };

  return (
    <>
      <button ref={toggleRef} type="button" className="lab-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setPanel(!open)}>
        Sonidos{dirtyCount ? <span className="lab-badge" aria-label={`${dirtyCount} ajuste(s) sin guardar`}>{dirtyCount}</span> : null}
      </button>
      {open ? (
        <aside id={panelId} className="lab" role="region" aria-label="Laboratorio de sonidos" data-testid="audio-lab">
          <header className="lab__header">
            <h2>Laboratorio de sonidos <span className="lab-tag">solo desarrollo</span></h2>
            <button type="button" className="lab-btn" onClick={() => { setPanel(false); toggleRef.current?.focus(); }}>Cerrar</button>
          </header>

          {!sfxActive ? <p className="lab-warn">Los efectos están <strong>desactivados</strong> en la configuración (`audio.sfx.active`): los sonidos del mapa no suenan en el recorrido, pero aquí puedes probarlos. Actívalos en la pestaña Presets.</p> : null}

          <div className="lab__global">
            <fieldset className="lab-modes">
              <legend>Cómo escuchas</legend>
              <label><input type="radio" name="lab-mode" checked={state.mode === "virtual"} onChange={() => lab.setMode("virtual")} /> Mapa (Vanessa quieta, mueves el oyente)</label>
              <label><input type="radio" name="lab-mode" checked={state.mode === "walking"} onChange={() => lab.setMode("walking")} /> Recorrido (caminas con las flechas)</label>
              {state.mode === "walking" && !started ? <small>Pulsa «Comenzar» en la portada para poder caminar.</small> : null}
              {state.mode === "walking" && started ? (
                <button type="button" className="lab-btn" onClick={() => document.querySelector<HTMLElement>(".game-host")?.focus()}>Ir al mapa del juego (las flechas mueven a Vanessa)</button>
              ) : null}
            </fieldset>
            <div className="lab-actions">
              <button type="button" className="lab-btn" onClick={() => lab.stopAll()}>Detener todo</button>
              {state.ambientPaused ? <button type="button" className="lab-btn lab-btn--primary" onClick={() => lab.resumeAmbient()}>Reanudar el ambiente</button> : null}
              <button type="button" className="lab-btn" onClick={() => { lab.reset("all"); }} disabled={dirtyCount === 0}>Descartar todo</button>
            </div>
          </div>

          <p role="status" aria-live="polite" className="lab-notice">{state.notice}</p>

          <div role="tablist" aria-label="Secciones del laboratorio" className="lab-tabs">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`${panelId}-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`${panelId}-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} className="lab-tab" onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  const i = TABS.findIndex((x) => x.id === tab);
                  const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length] : null;
                  if (next) {
                    e.preventDefault();
                    setTab(next.id);
                    document.getElementById(`${panelId}-tab-${next.id}`)?.focus();
                  }
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "map" && zone ? (
            <div role="tabpanel" id={`${panelId}-panel-map`} aria-labelledby={`${panelId}-tab-map`} className="lab-tabpanel">
              <SelectField label="Zona" value={state.zoneId} onChange={(z) => lab.setZone(z)}>
                {Object.entries(config.maps).map(([id, z]) => <option key={id} value={id}>{z.label} ({id})</option>)}
              </SelectField>
              {state.zoneId !== sfx.zoneId ? <p className="lab-hint">Esta no es la zona que está jugando: puedes probar y guardar sus emisores, pero el ambiente del mapa solo se oye en la zona activa ({sfx.zoneId ?? "ninguna"}).</p> : null}
              <MapView
                zone={zone}
                sounds={sounds}
                drafts={drafted}
                selectedId={selectedId}
                listener={listener}
                virtual={state.mode === "virtual"}
                emitters={diagMap}
                onSelect={(soundId) => lab.select({ kind: "emitter", zoneId: state.zoneId, soundId })}
                onListener={(p) => lab.moveListener(p)}
                onMoveEmitter={(soundId, p) => {
                  const s = lab.soundOf(state.zoneId, soundId);
                  if (s?.shape === "point") lab.editSound(state.zoneId, soundId, { ...s, position: p });
                }}
              />
              <p className="lab-meta">Oyente: {Math.round(listener.x)}, {Math.round(listener.y)}{state.mode === "virtual" ? " · arrastra sobre el mapa o usa las flechas" : " · es Vanessa"}</p>

              <h3 className="lab-h3">Emisores de la zona</h3>
              {Object.keys(sounds).length === 0 ? <p className="lab-empty">Esta zona no tiene sonidos. Crea uno o colócalo en Tiled (capa «sonidos»).</p> : null}
              <ul className="lab-emitters">
                {Object.entries(sounds).map(([id, s]) => {
                  const d = diagMap.get(id);
                  return (
                    <li key={id}>
                      <button type="button" className="lab-emitter" aria-pressed={selectedId === id} onClick={() => lab.select({ kind: "emitter", zoneId: state.zoneId, soundId: id })}>
                        <span>{s.label}</span>
                        <span className="lab-meta">{id} · {s.playback.mode === "loop" ? "bucle" : s.playback.mode === "interval" ? "intervalo" : "al entrar"}{!s.enabled ? " · apagado" : ""}{d && state.zoneId === sfx.zoneId ? ` · ${d.state}` : ""}{drafted.has(id) ? " · sin guardar" : ""}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="lab-actions">
                <button type="button" className="lab-btn" onClick={() => { const first = lab.catalog()[0]; if (first) lab.addEmitter("point", first.id); }} disabled={!lab.catalog().length}>Nuevo emisor puntual aquí</button>
                <button type="button" className="lab-btn" onClick={() => { const first = lab.catalog()[0]; if (first) lab.addEmitter("rect", first.id); }} disabled={!lab.catalog().length}>Nueva área aquí</button>
              </div>
              {selectedId ? (
                <>
                  <EmitterEditor lab={lab} state={state} zoneId={state.zoneId} soundId={selectedId} />
                  <div className="lab-actions" role="group" aria-label="Sobre el mapa">
                    {state.zoneId === sfx.zoneId && sfx.emitterIds().includes(selectedId) ? (
                      <>
                        <button type="button" className="lab-btn" onClick={() => { void sfx.unlock().then(() => sfx.fireEmitter(selectedId)); }}>Disparar en el mapa</button>
                        <button type="button" className="lab-btn" onClick={() => lab.muteEmitter(selectedId, true)}>Silenciar este emisor</button>
                        <button type="button" className="lab-btn" onClick={() => lab.muteEmitter(selectedId, false)}>Reactivar este emisor</button>
                      </>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="lab-empty">Elige un emisor del mapa o de la lista para ajustarlo.</p>
              )}
            </div>
          ) : null}

          {tab === "presets" ? (
            <div role="tabpanel" id={`${panelId}-panel-presets`} aria-labelledby={`${panelId}-tab-presets`} className="lab-tabpanel">
              <PresetsPanel lab={lab} state={state} />
            </div>
          ) : null}
          {tab === "files" ? (
            <div role="tabpanel" id={`${panelId}-panel-files`} aria-labelledby={`${panelId}-tab-files`} className="lab-tabpanel">
              <FilePanel lab={lab} state={state} />
            </div>
          ) : null}

          {state.save.status !== "idle" ? (
            <div className={`lab-save lab-save--${state.save.status}`} role={state.save.status === "error" ? "alert" : "status"}>
              <strong>{state.save.status === "working" ? "Trabajando…" : state.save.status === "ok" ? (state.save.action === "check" ? "Comprobado" : "Guardado") : "No se guardó"}</strong>
              <ul>{state.save.messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
              {state.save.warnings.length ? <ul className="lab-warnings">{state.save.warnings.map((m, i) => <li key={i}>{m}</li>)}</ul> : null}
            </div>
          ) : null}

          <section className="lab-session" aria-label="Ajustes de la sesión">
            <h3 className="lab-h3">Sesión</h3>
            <p className="lab-meta">{dirtyCount ? `${dirtyCount} ajuste(s) sin guardar${state.applied ? " · aplicados a esta sesión" : ""}` : "Sin ajustes pendientes."}</p>
            <div className="lab-actions">
              <button type="button" className="lab-btn" onClick={() => lab.apply()} disabled={dirtyCount === 0}>Aplicar a esta sesión</button>
              <button type="button" className="lab-btn" onClick={exportSettings} disabled={dirtyCount === 0}>Exportar ajustes</button>
              <label className="lab-btn lab-btn--file">
                Importar ajustes
                <input ref={fileImport} type="file" accept="application/json,.json" onChange={(e) => void importSettings(e.target.files)} aria-label="Importar un paquete de ajustes" />
              </label>
            </div>
            <p className="lab-hint">Un paquete exportado se aplica a otro proyecto con <code>npm run audio-lab:import -- archivo.json</code>.</p>
          </section>

          <Diagnostics diagnostics={state.diagnostics} onClearFailures={() => lab.clearFailures()} />
          {state.server.status === "offline" ? <p className="lab-warn" role="alert">{state.server.message}</p> : null}
        </aside>
      ) : null}
    </>
  );
}
