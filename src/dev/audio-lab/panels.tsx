import { useRef, useState, type DragEvent } from "react";
import { SFX_EVENT_IDS, SOUND_LIMITS, type SfxEventId } from "../../config/sounds";
import type { MapSound } from "../../config/types";
import type { SfxDiagnostics } from "../../audio/sfxTypes";
import type { AudioLabController, LabState } from "./controller";
import { localAssetId, soundKey } from "./draft";
import { CheckField, NumberField, RangeField, SelectField, TextField } from "./fields";

/** Los paneles del laboratorio de sonidos: el editor de un emisor, los presets de interfaz, los archivos de prueba y el diagnóstico. */

const pct = (n: number) => `${Math.round(n * 100)} %`;
const MODE_LABEL = { loop: "Bucle (continuo)", interval: "Intervalo (se repite con esperas)", enter: "Al entrar (una vez al acercarse)" } as const;
const EVENT_LABEL: Record<SfxEventId, string> = {
  "ui.open": "Abrir una lectura o un panel",
  "ui.confirm": "Marcar una sección como leída",
  "badge.earned": "Ganar una insignia",
  "portal.travel": "Viajar por un portal",
};

/** Las opciones de archivo: los efectos del catálogo y los archivos de prueba cargados. */
function AssetOptions({ lab, state, current }: { lab: AudioLabController; state: LabState; current: string }) {
  const catalog = lab.catalog();
  const known = catalog.some((c) => c.id === current) || state.files.some((f) => localAssetId(f.key) === current);
  return (
    <>
      {!known && current ? <option value={current}>{current} (no está en el catálogo)</option> : null}
      <optgroup label="Catálogo del proyecto">
        {catalog.map((c) => (
          <option key={c.id} value={c.id}>{c.label}{c.durationSeconds ? ` · ${c.durationSeconds.toFixed(1)} s` : ""}</option>
        ))}
      </optgroup>
      {state.files.length ? (
        <optgroup label="Archivos de prueba (sin guardar)">
          {state.files.map((f) => (
            <option key={f.key} value={localAssetId(f.key)}>{f.name} · {f.durationSeconds.toFixed(1)} s</option>
          ))}
        </optgroup>
      ) : null}
    </>
  );
}

export function EmitterEditor({ lab, state, zoneId, soundId }: { lab: AudioLabController; state: LabState; zoneId: string; soundId: string }) {
  const sound = state.drafts.sounds[soundKey(zoneId, soundId)] ?? lab.savedSound(zoneId, soundId);
  if (!sound) return <p className="lab-empty">Ese emisor ya no existe.</p>;
  const key = soundKey(zoneId, soundId);
  const isDraft = key in state.drafts.sounds;
  const isNew = !lab.savedSound(zoneId, soundId);
  const edit = (patch: Partial<MapSound>) => lab.editSound(zoneId, soundId, { ...sound, ...patch } as MapSound);
  const editPlayback = (patch: Record<string, unknown>) => lab.editSound(zoneId, soundId, { ...sound, playback: { ...sound.playback, ...patch } } as MapSound);
  const diag = state.diagnostics.emitters.find((e) => e.id === soundId);
  const asset = sound.assetId;
  const playing = state.tests.some((t) => t.owner === key);
  const reason = lab.canSave({ kind: "emitter", zoneId, soundId });

  return (
    <section className="lab-editor" aria-label={`Ajustes de ${sound.label}`}>
      <h3>{sound.label}{isNew ? <span className="lab-tag">nuevo</span> : isDraft ? <span className="lab-tag">sin guardar</span> : null}</h3>
      <p className="lab-meta">{soundId} · zona {zoneId} · {sound.shape === "point" ? "SoundEmitter (punto)" : "SoundArea (área)"}</p>

      <div className="lab-actions" role="group" aria-label="Probar">
        <button type="button" className="lab-btn lab-btn--primary" onClick={() => void lab.playEmitter(zoneId, soundId)}>Probar</button>
        <button type="button" className="lab-btn" onClick={() => lab.stopEmitter(zoneId, soundId)} disabled={!playing}>Detener</button>
        <button type="button" className="lab-btn" onClick={() => lab.stopAll()}>Detener todo</button>
      </div>
      <div className="lab-checks">
        <CheckField label="Repetir" checked={state.repeat} onChange={(b) => lab.setRepeat(b)} hint="Vuelve a sonar al terminar (los bucles ya se repiten)." />
        <CheckField label="Solo" checked={state.solo} onChange={(b) => lab.setSolo(b)} hint="Calla la música y los demás emisores mientras esté activo." />
        <CheckField label="Con distancia" checked={state.spatialTest} onChange={(b) => lab.setSpatialTest(b)} hint="Aplica la atenuación según dónde esté el oyente." />
      </div>

      <TextField label="Nombre" value={sound.label} onChange={(label) => edit({ label })} />
      <SelectField label="Archivo de sonido" value={asset} onChange={(assetId) => edit({ assetId })}>
        <AssetOptions lab={lab} state={state} current={asset} />
      </SelectField>
      <CheckField label="Activo en el recorrido" checked={sound.enabled} onChange={(enabled) => edit({ enabled })} hint="Apagado, el emisor nunca suena en el recorrido (sí puedes probarlo aquí)." />

      <RangeField label="Volumen" value={sound.volume} min={SOUND_LIMITS.volume.min} max={SOUND_LIMITS.volume.max} step={0.01} onChange={(volume) => edit({ volume })} format={pct} />
      <RangeField label="Velocidad" value={sound.rate} min={SOUND_LIMITS.rate.min} max={SOUND_LIMITS.rate.max} step={0.01} onChange={(rate) => edit({ rate })} format={(n) => `${n.toFixed(2)}×`} />

      <SelectField label="Modo" value={sound.playback.mode} onChange={(mode) => {
        if (mode === "loop") edit({ playback: { mode: "loop" } });
        else if (mode === "interval") edit({ playback: { mode: "interval", minMs: 12000, maxMs: 28000 } });
        else edit({ playback: { mode: "enter", cooldownMs: 1500 } });
      }}>
        {(Object.keys(MODE_LABEL) as Array<keyof typeof MODE_LABEL>).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
      </SelectField>
      {sound.playback.mode === "interval" ? (
        <div className="lab-row">
          <NumberField label="Espera mínima" unit="ms" value={sound.playback.minMs} min={0} step={500} onChange={(minMs) => editPlayback({ minMs })} />
          <NumberField label="Espera máxima" unit="ms" value={sound.playback.maxMs} min={0} step={500} onChange={(maxMs) => editPlayback({ maxMs })} />
        </div>
      ) : null}
      {sound.playback.mode === "enter" ? <NumberField label="Enfriamiento" unit="ms" value={sound.playback.cooldownMs} min={0} step={100} onChange={(cooldownMs) => editPlayback({ cooldownMs })} hint="Tiempo mínimo entre dos disparos al volver a entrar." /> : null}

      <div className="lab-row">
        <NumberField label="Fundido de entrada" unit="ms" value={sound.fadeInMs} min={0} step={50} onChange={(fadeInMs) => edit({ fadeInMs })} />
        <NumberField label="Fundido de salida" unit="ms" value={sound.fadeOutMs} min={0} step={50} onChange={(fadeOutMs) => edit({ fadeOutMs })} />
      </div>

      {sound.shape === "point" ? (
        <>
          <div className="lab-row">
            <NumberField label="Posición X" unit="px" value={sound.position.x} step={10} onChange={(x) => edit({ position: { ...sound.position, x } })} />
            <NumberField label="Posición Y" unit="px" value={sound.position.y} step={10} onChange={(y) => edit({ position: { ...sound.position, y } })} />
          </div>
          <div className="lab-row">
            <NumberField label="Radio interior" unit="px" value={sound.innerRadius} min={0} step={10} onChange={(innerRadius) => edit({ innerRadius })} hint="Volumen completo hasta aquí." />
            <NumberField label="Radio exterior" unit="px" value={sound.radius} min={1} step={10} onChange={(radius) => edit({ radius })} hint="Silencio desde aquí." />
          </div>
        </>
      ) : (
        <>
          <div className="lab-row">
            <NumberField label="Área X" unit="px" value={sound.area.x} step={10} onChange={(x) => edit({ area: { ...sound.area, x } })} />
            <NumberField label="Área Y" unit="px" value={sound.area.y} step={10} onChange={(y) => edit({ area: { ...sound.area, y } })} />
          </div>
          <div className="lab-row">
            <NumberField label="Ancho" unit="px" value={sound.area.width} min={1} step={10} onChange={(width) => edit({ area: { ...sound.area, width } })} />
            <NumberField label="Alto" unit="px" value={sound.area.height} min={1} step={10} onChange={(height) => edit({ area: { ...sound.area, height } })} />
          </div>
          <NumberField label="Caída fuera del área" unit="px" value={sound.edgeFadePx} min={0} step={10} onChange={(edgeFadePx) => edit({ edgeFadePx })} hint="Con 0, fuera del área hay silencio." />
        </>
      )}

      {diag ? (
        <dl className="lab-diag" aria-label="Diagnóstico de este emisor">
          <div><dt>Estado</dt><dd>{diag.state}</dd></div>
          <div><dt>Distancia</dt><dd>{Math.round(diag.distance)} px</dd></div>
          <div><dt>Ganancia por distancia</dt><dd>{pct(diag.gain)}</dd></div>
          <div><dt>Fundido</dt><dd>{pct(diag.fade)}</dd></div>
          <div><dt>Volumen efectivo</dt><dd>{pct(diag.effective)}</dd></div>
          {diag.waitMs !== null ? <div><dt>Próximo disparo</dt><dd>{(diag.waitMs / 1000).toFixed(1)} s</dd></div> : null}
        </dl>
      ) : null}

      <div className="lab-actions" role="group" aria-label="Guardar">
        <button type="button" className="lab-btn" onClick={() => lab.reset({ kind: "emitter", zoneId, soundId })} disabled={!isDraft}>Restablecer</button>
        <button type="button" className="lab-btn" onClick={() => lab.apply()} disabled={!lab.dirty}>Aplicar a esta sesión</button>
        <button type="button" className="lab-btn" onClick={() => void lab.save({ kind: "emitter", zoneId, soundId }, true)} disabled={!!reason}>Comprobar</button>
        <button type="button" className="lab-btn lab-btn--primary" onClick={() => void lab.save({ kind: "emitter", zoneId, soundId })} disabled={!!reason} aria-describedby="lab-save-why">Guardar en el proyecto</button>
      </div>
      {reason ? <p id="lab-save-why" className="lab-hint">{reason}</p> : null}
    </section>
  );
}

export function PresetsPanel({ lab, state }: { lab: AudioLabController; state: LabState }) {
  const sfx = lab.sfxSaved();
  const general = { active: state.drafts.general.active ?? sfx?.active ?? false, volume: state.drafts.general.volume ?? sfx?.volume ?? 0.8, maxVoices: state.drafts.general.maxVoices ?? sfx?.maxVoices ?? 12 };
  const generalReason = lab.canSave({ kind: "general" });
  return (
    <div className="lab-presets">
      <section className="lab-editor" aria-label="Ajustes generales de los efectos">
        <h3>Efectos de sonido{Object.keys(state.drafts.general).length ? <span className="lab-tag">sin guardar</span> : null}</h3>
        <CheckField label="Efectos activos" checked={general.active} onChange={(active) => lab.editGeneral({ active })} hint="Apagados, el juego no reproduce ningún efecto (la música sigue)." />
        <RangeField label="Volumen general" value={general.volume} min={0} max={1} step={0.01} onChange={(volume) => lab.editGeneral({ volume })} format={pct} />
        <NumberField label="Voces simultáneas" value={general.maxVoices} min={SOUND_LIMITS.maxVoices.min} max={SOUND_LIMITS.maxVoices.max} onChange={(maxVoices) => lab.editGeneral({ maxVoices })} hint="Al llegar al límite, un efecto de interfaz cede el sitio a uno de ambiente." />
        <div className="lab-actions">
          <button type="button" className="lab-btn" onClick={() => lab.reset({ kind: "general" })} disabled={!Object.keys(state.drafts.general).length}>Restablecer</button>
          <button type="button" className="lab-btn lab-btn--primary" onClick={() => void lab.save({ kind: "general" })} disabled={!!generalReason}>Guardar en el proyecto</button>
        </div>
        {generalReason ? <p className="lab-hint">{generalReason}</p> : null}
      </section>
      {SFX_EVENT_IDS.map((event) => {
        const preset = lab.presetOf(event);
        const isDraft = event in state.drafts.presets;
        const reason = lab.canSave({ kind: "preset", event });
        return (
          <section key={event} className="lab-editor" aria-label={`Efecto: ${EVENT_LABEL[event]}`}>
            <h3>{EVENT_LABEL[event]}{isDraft ? <span className="lab-tag">sin guardar</span> : null}</h3>
            <p className="lab-meta">{event}</p>
            <SelectField label="Archivo de sonido" value={preset?.assetId ?? ""} onChange={(assetId) => lab.editPreset(event, assetId ? { assetId, volume: preset?.volume ?? 0.6, rate: preset?.rate ?? 1 } : null)}>
              <option value="">(sin efecto)</option>
              <AssetOptions lab={lab} state={state} current={preset?.assetId ?? ""} />
            </SelectField>
            {preset ? (
              <>
                <RangeField label="Volumen" value={preset.volume} min={0} max={1} step={0.01} onChange={(volume) => lab.editPreset(event, { ...preset, volume })} format={pct} />
                <RangeField label="Velocidad" value={preset.rate} min={SOUND_LIMITS.rate.min} max={SOUND_LIMITS.rate.max} step={0.01} onChange={(rate) => lab.editPreset(event, { ...preset, rate })} format={(n) => `${n.toFixed(2)}×`} />
              </>
            ) : null}
            <div className="lab-actions">
              <button type="button" className="lab-btn lab-btn--primary" onClick={() => void lab.playPreset(event)} disabled={!preset}>Probar</button>
              <button type="button" className="lab-btn" onClick={() => lab.stopAll()}>Detener</button>
              <button type="button" className="lab-btn" onClick={() => lab.reset({ kind: "preset", event })} disabled={!isDraft}>Restablecer</button>
              <button type="button" className="lab-btn lab-btn--primary" onClick={() => void lab.save({ kind: "preset", event })} disabled={!!reason}>Guardar en el proyecto</button>
            </div>
            {reason && isDraft ? <p className="lab-hint">{reason}</p> : null}
          </section>
        );
      })}
      <p className="lab-hint">Las pruebas de aquí no entregan ni revelan insignias: solo suenan. Los efectos reales salen de las acciones del recorrido.</p>
    </div>
  );
}

const MB = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export function FilePanel({ lab, state }: { lab: AudioLabController; state: LabState }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const pick = (list: FileList | null) => {
    if (list && list.length) void lab.addFiles([...list]);
    if (input.current) input.current.value = "";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    pick(e.dataTransfer.files);
  };
  const selection = state.selection;
  const used = (key: string) => [...Object.entries(state.drafts.sounds).filter(([, s]) => s.assetId === localAssetId(key)).map(([k]) => k), ...Object.entries(state.drafts.presets).filter(([, p]) => p?.assetId === localAssetId(key)).map(([k]) => k)];
  return (
    <div className="lab-files">
      <div
        className={`lab-drop${over ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <p>Suelta aquí un archivo WAV, MP3, OGG o M4A (máx. 8 MB y 60 s) o elígelo:</p>
        <input ref={input} id="lab-file-input" type="file" accept=".wav,.mp3,.ogg,.m4a,audio/*" multiple onChange={(e) => pick(e.target.files)} aria-label="Elegir archivos de sonido de prueba" />
        <p className="lab-hint">Los archivos viven en la memoria de esta pestaña ({MB(lab.localBytes())} de {MB(64 * 1024 * 1024)}). Solo se copian al proyecto cuando guardas un emisor o un efecto que los usa.</p>
      </div>
      {state.files.length === 0 ? <p className="lab-empty">Aún no hay archivos de prueba.</p> : null}
      <ul className="lab-filelist">
        {state.files.map((f) => {
          const users = used(f.key);
          const assign = selection && selection.kind !== "general";
          return (
            <li key={f.key}>
              <div>
                <strong>{f.name}</strong>
                <span className="lab-meta"> · {f.format.toUpperCase()} · {f.durationSeconds.toFixed(2)} s · {(f.sizeBytes / 1024).toFixed(0)} KB{users.length ? ` · usado en ${users.length} ajuste(s)` : ""}</span>
              </div>
              <div className="lab-actions">
                <button type="button" className="lab-btn lab-btn--primary" onClick={() => void lab.playFile(f.key)}>Probar</button>
                <button type="button" className="lab-btn" onClick={() => lab.stopAll()}>Detener</button>
                <button
                  type="button"
                  className="lab-btn"
                  disabled={!assign}
                  onClick={() => lab.useFile(f.key)}
                  title={assign ? "Asigna este archivo a lo seleccionado" : "Selecciona un emisor o una acción"}
                >
                  Usar en lo seleccionado
                </button>
                <button type="button" className="lab-btn" onClick={() => lab.removeFile(f.key)} disabled={users.length > 0}>Quitar</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Diagnostics({ diagnostics, onClearFailures }: { diagnostics: SfxDiagnostics; onClearFailures: () => void }) {
  const s = diagnostics.state;
  const point = diagnostics.listener;
  return (
    <details className="lab-diagnostics" open>
      <summary>Diagnóstico</summary>
      <dl className="lab-diag">
        <div><dt>Audio</dt><dd>{s.status === "ready" ? "listo" : s.status === "locked" ? "bloqueado por el navegador" : s.status === "unavailable" ? "no disponible" : "esperando el gesto"}</dd></div>
        <div><dt>Silencio</dt><dd>{s.muted ? "sí" : "no"}</dd></div>
        <div><dt>Voces</dt><dd>{s.voices} de {s.maxVoices}</dd></div>
        <div><dt>Memoria</dt><dd>{MB(diagnostics.decodedBytes)}</dd></div>
        <div><dt>Cargando</dt><dd>{s.loading}</dd></div>
        <div><dt>Oyente</dt><dd>{point ? `${Math.round(point.x)}, ${Math.round(point.y)}${diagnostics.listenerVirtual ? " (virtual)" : " (Vanessa)"}` : "—"}</dd></div>
        <div><dt>Suspendido por</dt><dd>{s.suspended.length ? s.suspended.join(", ") : "nada"}</dd></div>
        <div><dt>Volumen general</dt><dd>{pct(diagnostics.master)}</dd></div>
      </dl>
      {s.errors.length ? (
        <div role="alert" className="lab-errors">
          <ul>{s.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          <button type="button" className="lab-btn" onClick={onClearFailures}>Descartar errores</button>
        </div>
      ) : null}
      <table className="lab-table">
        <caption>Emisores del mapa</caption>
        <thead><tr><th scope="col">Emisor</th><th scope="col">Estado</th><th scope="col">Dist.</th><th scope="col">Ganancia</th><th scope="col">Efectivo</th></tr></thead>
        <tbody>
          {diagnostics.emitters.length === 0 ? <tr><td colSpan={5}>Sin emisores activos en la zona.</td></tr> : null}
          {diagnostics.emitters.map((e) => (
            <tr key={e.id}><th scope="row">{e.label}</th><td>{e.state}</td><td>{Math.round(e.distance)}</td><td>{pct(e.gain)}</td><td>{pct(e.effective)}</td></tr>
          ))}
        </tbody>
      </table>
      <table className="lab-table">
        <caption>Voces sonando</caption>
        <thead><tr><th scope="col">Voz</th><th scope="col">Tipo</th><th scope="col">Base</th><th scope="col">Espacial</th><th scope="col">Fundido</th><th scope="col">Efectivo</th></tr></thead>
        <tbody>
          {diagnostics.voices.length === 0 ? <tr><td colSpan={6}>Ninguna.</td></tr> : null}
          {diagnostics.voices.map((v) => (
            <tr key={v.id}><th scope="row">{v.label}</th><td>{v.kind}</td><td>{pct(v.factors.base)}</td><td>{pct(v.factors.spatial)}</td><td>{pct(v.factors.fade)}</td><td>{pct(v.effective)}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
