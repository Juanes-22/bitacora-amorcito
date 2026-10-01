import type { ComponentPropsWithRef, CSSProperties } from "react";
import { useBitacora } from "../../app/BitacoraProvider";

/** Botón verde con los assets `ui.assets.button` y `ui.assets.buttonHover`. */
export function PixelButton({ style, className = "", type = "button", ...rest }: ComponentPropsWithRef<"button">) {
  const { config, assets } = useBitacora();
  const { button, buttonHover } = config.ui.assets;
  const vars = {
    "--button-url": `url("${assets.url(button)}")`,
    ...(buttonHover ? { "--button-hover-url": `url("${assets.url(buttonHover)}")` } : {}),
    ...style,
  } as CSSProperties;
  return <button type={type} className={`pixel-button ${className}`.trim()} style={vars} {...rest} />;
}
