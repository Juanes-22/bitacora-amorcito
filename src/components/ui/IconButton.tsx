import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useBitacora } from "../../app/BitacoraProvider";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> {
  /** assetId del botón (arte con su marco, `ui.assets.*Button`). */
  assetId: string;
  /** Nombre accesible; también el texto de ayuda al pasar el ratón. */
  label: string;
  /** Texto de ayuda al pasar el ratón, si debe ser más largo que el nombre accesible. */
  hint?: string;
  /** Texto visible sobre el botón, en la zona `labelZones.label` de su imagen (los botones con etiqueta del catálogo). */
  caption?: string;
  children?: ReactNode;
}

/**
 * Botón de la cabecera hecho con el arte del catálogo (SPEC 7). El PNG trae su marco y un margen transparente, así que la
 * imagen se coloca y se escala con su `contentBounds` para que el MARCO ocupe exactamente la caja del botón (que es el
 * objetivo táctil de ≥ 44 px). La imagen es decorativa; el nombre accesible va en el botón.
 */
export function IconButton({ assetId, label, hint, caption, className = "", children, style, type = "button", ...rest }: Props) {
  const { assets } = useBitacora();
  const entry = assets.get(assetId);
  const W = entry.width ?? 1;
  const H = entry.height ?? 1;
  const box = entry.contentBounds ?? { x: 0, y: 0, width: W, height: H };
  const zone = entry.labelZones?.label;
  const vars = {
    ...(zone ? { "--cap-x": `${(zone.x / W) * 100}%`, "--cap-y": `${(zone.y / H) * 100}%`, "--cap-w": `${(zone.width / W) * 100}%`, "--cap-h": `${(zone.height / H) * 100}%` } : {}),
    "--icon-w": `${(W / box.width) * 100}%`,
    "--icon-tx": `-${((box.x + box.width / 2) / W) * 100}%`,
    "--icon-ty": `-${((box.y + box.height / 2) / H) * 100}%`,
    ...style,
  } as CSSProperties;
  return (
    <button type={type} className={`icon-button ${className}`.trim()} aria-label={label} title={hint ?? label} style={vars} {...rest}>
      <img className="icon-button__img" src={assets.url(assetId)} alt="" aria-hidden="true" draggable={false} />
      {caption && zone ? <span className="icon-button__caption" aria-hidden="true">{caption}</span> : null}
      {children}
    </button>
  );
}
