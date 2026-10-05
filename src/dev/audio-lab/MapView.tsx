import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { EmitterDiagnostic } from "../../audio/sfxTypes";
import type { MapSound, MapZone, Point } from "../../config/types";

/**
 * El mapa de la zona en el laboratorio: obstáculos, portales, los emisores con su alcance (círculo interior y exterior, o área con su
 * caída) y el oyente. En el modo mapa el oyente se arrastra con el ratón o el dedo, o se mueve con las flechas (Mayús = paso grande).
 */

const KEY_STEP = 20;

export interface MapViewProps {
  zone: MapZone;
  sounds: Record<string, MapSound>;
  drafts: ReadonlySet<string>;
  selectedId: string | null;
  listener: Point;
  /** `true`: el oyente se mueve desde aquí; `false`: es Vanessa (solo se muestra). */
  virtual: boolean;
  emitters: ReadonlyMap<string, EmitterDiagnostic>;
  onSelect: (soundId: string) => void;
  onListener: (p: Point) => void;
  onMoveEmitter: (soundId: string, p: Point) => void;
}

const stateClass = (e: EmitterDiagnostic | undefined, sound: MapSound): string => {
  if (!sound.enabled) return "off";
  if (!e) return "idle";
  return e.playing ? "playing" : e.state === "fuera de alcance" ? "idle" : "near";
};

export function MapView({ zone, sounds, drafts, selectedId, listener, virtual, emitters, onSelect, onListener, onMoveEmitter }: MapViewProps) {
  const svg = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ kind: "listener" } | { kind: "emitter"; id: string } | null>(null);

  const toWorld = (e: PointerEvent): Point | null => {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return null;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!virtual || drag.current) return;
    const p = toWorld(e);
    if (!p) return;
    drag.current = { kind: "listener" };
    e.currentTarget.setPointerCapture(e.pointerId);
    onListener(p);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toWorld(e);
    if (!p) return;
    if (d.kind === "listener") onListener(p);
    else onMoveEmitter(d.id, p);
  };
  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!virtual) return;
    const step = e.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    const d: Point | null = e.key === "ArrowLeft" ? { x: -step, y: 0 } : e.key === "ArrowRight" ? { x: step, y: 0 } : e.key === "ArrowUp" ? { x: 0, y: -step } : e.key === "ArrowDown" ? { x: 0, y: step } : null;
    if (!d) return;
    e.preventDefault();
    onListener({ x: listener.x + d.x, y: listener.y + d.y });
  };

  const r = Math.max(zone.width, zone.height) / 90; // tamaño de los marcadores, proporcional al mapa
  return (
    <svg
      ref={svg}
      className="lab-map"
      viewBox={`0 0 ${zone.width} ${zone.height}`}
      role="application"
      tabIndex={0}
      aria-label={virtual ? "Mapa de sonidos. Las flechas mueven el oyente; con Mayús, más lejos." : "Mapa de sonidos. En el modo recorrido el oyente es Vanessa."}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
    >
      <rect className="lab-map__ground" x={0} y={0} width={zone.width} height={zone.height} />
      {zone.obstacles.map((o, i) =>
        o.type === "rect" ? <rect key={i} className="lab-map__obstacle" x={o.x} y={o.y} width={o.width} height={o.height} /> : <circle key={i} className="lab-map__obstacle" cx={o.x} cy={o.y} r={o.radius} />,
      )}
      {Object.entries(zone.portals).map(([id, p]) => (
        <g key={id} className="lab-map__portal">
          <circle cx={p.interaction.x} cy={p.interaction.y} r={p.interaction.radius} />
          <text x={p.interaction.x} y={p.interaction.y} fontSize={r * 2} textAnchor="middle">{p.label}</text>
        </g>
      ))}
      {Object.entries(sounds).map(([id, s]) => {
        const diag = emitters.get(id);
        const cls = `lab-map__sound lab-map__sound--${stateClass(diag, s)}${selectedId === id ? " is-selected" : ""}${drafts.has(id) ? " is-draft" : ""}`;
        const pick = (e: PointerEvent) => {
          e.stopPropagation();
          onSelect(id);
        };
        if (s.shape === "point") {
          return (
            <g key={id} className={cls} data-sound-id={id}>
              <circle className="lab-map__outer" cx={s.position.x} cy={s.position.y} r={s.radius} />
              <circle className="lab-map__inner" cx={s.position.x} cy={s.position.y} r={s.innerRadius} />
              <circle
                className="lab-map__dot"
                cx={s.position.x}
                cy={s.position.y}
                r={r}
                onPointerDown={(e) => {
                  pick(e);
                  if (selectedId === id) {
                    drag.current = { kind: "emitter", id };
                    svg.current?.setPointerCapture(e.pointerId);
                  }
                }}
              />
              <text x={s.position.x} y={s.position.y - r * 1.6} fontSize={r * 1.8} textAnchor="middle">{s.label}</text>
            </g>
          );
        }
        return (
          <g key={id} className={cls} data-sound-id={id}>
            <rect className="lab-map__outer" x={s.area.x - s.edgeFadePx} y={s.area.y - s.edgeFadePx} width={s.area.width + 2 * s.edgeFadePx} height={s.area.height + 2 * s.edgeFadePx} rx={s.edgeFadePx} />
            <rect className="lab-map__inner" x={s.area.x} y={s.area.y} width={s.area.width} height={s.area.height} onPointerDown={pick} />
            <text x={s.area.x + s.area.width / 2} y={s.area.y + s.area.height / 2} fontSize={r * 1.8} textAnchor="middle">{s.label}</text>
          </g>
        );
      })}
      <g className={`lab-map__listener${virtual ? " is-virtual" : ""}`} aria-hidden="true">
        <circle cx={listener.x} cy={listener.y} r={r * 1.5} />
        <path d={`M ${listener.x - r} ${listener.y} H ${listener.x + r} M ${listener.x} ${listener.y - r} V ${listener.y + r}`} />
      </g>
    </svg>
  );
}
