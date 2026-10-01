import type { ReactNode } from "react";
import { useBitacora } from "../../app/BitacoraProvider";
import type { AssetRegistry } from "../../config/assetRegistry";
import type { ContentBlock } from "../../config/types";

type Renderer<T extends ContentBlock["type"]> = (block: Extract<ContentBlock, { type: T }>, ctx: { assets: AssetRegistry }) => ReactNode;

/**
 * Registro explícito de renderizadores (SPEC 12.7): añadir una evidencia no obliga a tocar el componente
 * de lectura, y un tipo no registrado produce un error editorial visible, nunca ejecución dinámica.
 * Los textos se entregan como texto de React (escapado): no se usa HTML crudo.
 */
const RENDERERS: { [T in ContentBlock["type"]]: Renderer<T> } = {
  paragraph: (b) => <p className="block-paragraph">{b.text}</p>,
  heading: (b) => <h3 className="block-heading">{b.text}</h3>,
  image: (b, { assets }) => (
    <figure className="block-figure">
      <img src={assets.url(b.assetId)} alt={b.alt} loading="lazy" />
      {b.caption ? <figcaption>{b.caption}</figcaption> : null}
    </figure>
  ),
  quote: (b) => (
    <blockquote className="block-quote">
      <p>{b.text}</p>
      {b.source ? <footer>— {b.source}</footer> : null}
    </blockquote>
  ),
  reference: (b) => (
    <p className="block-reference">
      {b.url ? (
        <a href={b.url} target="_blank" rel="noopener noreferrer">{b.label}</a>
      ) : (
        <span>{b.label}</span>
      )}
    </p>
  ),
};

export function ContentRenderer({ blocks }: { blocks: readonly ContentBlock[] }) {
  const { assets } = useBitacora();
  return (
    <div className="content">
      {blocks.map((block, i) => {
        const render = (RENDERERS as Record<string, ((b: ContentBlock, c: { assets: AssetRegistry }) => ReactNode) | undefined>)[block.type];
        return render ? (
          <div key={i} className="content__block">{render(block, { assets })}</div>
        ) : (
          <p key={i} className="content__error" role="alert">
            Bloque no soportado: «{String((block as { type?: unknown }).type)}». Revisa la bitácora.
          </p>
        );
      })}
    </div>
  );
}
