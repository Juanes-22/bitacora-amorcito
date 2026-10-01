import type { CSSProperties, ReactNode } from "react";
import { useBitacora } from "../../app/BitacoraProvider";

interface Props {
  children: ReactNode;
  className?: string;
}

/** Ventana crema: nueve secciones con los márgenes que declara `ui.assets.window` en assets.json. */
export function WindowPanel({ children, className = "" }: Props) {
  const { config, assets } = useBitacora();
  const id = config.ui.assets.window;
  const slice = assets.nineSlice(id);
  const style = {
    "--panel-url": `url("${assets.url(id)}")`,
    "--panel-slice": slice ? `${slice.top} ${slice.right} ${slice.bottom} ${slice.left}` : "32",
  } as CSSProperties;
  return (
    <div className={`window ${className}`.trim()} style={style}>
      <div className="window__body">{children}</div>
    </div>
  );
}
