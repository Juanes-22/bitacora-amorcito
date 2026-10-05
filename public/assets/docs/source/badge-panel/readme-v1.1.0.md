# Bitácora Amorcito · Panel de insignias

Kit para reconstruir las dos vistas propuestas: colección de tarjetas clickeables y detalle de una insignia. Estilo pixel art, crema, verde jade, dorado y lavanda.

## Qué incluye

**60 PNG de UI con transparencia** y **ocho insignias: seis aprendizajes, Jerry y Rocky**, copiadas sin modificar sus bytes.

| Carpeta dentro de public/assets/ui/badge-panel/ | PNG | Contenido |
| --- | ---: | --- |
| frames | 6 | Panel, tarjeta obtenida, hover, pendiente, especial y exhibición |
| buttons | 8 | Cerrar, volver, botón principal y secundario; normal y hover |
| labels | 4 | Obtenida, pendiente, especial y XP |
| controls | 4 | Cápsula de progreso, pie de tarjeta y recuadros de reflexión/aprendizaje |
| icons | 17 | Check, candado, calendario, libros, brote, corazón, estrella XP, huellas, flechas, X, destellos y cursor |
| decorations | 15 | Ramitas verdes, apagadas y lavanda, esquinas doradas, flores, divisor y huellas |
| effects | 6 | Halos jade, dorado y lavanda, destellos alrededor y segmentos de progreso |

Las insignias existentes están en **public/assets/ui/badges/**. Jerry y Rocky pertenecen a la colección especial. Ambas se desbloquean al completar todos los aprendizajes activos de la bitácora y se excluyen del contador de aprendizajes.

Los **labels y botones largos no tienen palabras dibujadas**. El texto se pone encima desde React. Los botones cuadrados de cerrar y volver sí incluyen el símbolo X o la flecha; esos símbolos también existen como iconos independientes.

## Estructura

- **public/assets/ui/badge-panel/**: los componentes de UI separados.
- **public/assets/ui/badges/**: tus ocho insignias, incluida **badge-rocky.png**.
- **assets.json**: índice con rutas, dimensiones, tamaños sugeridos y cortes nine-slice.
- **generation-prompts.json**: prompts completos de los cinco atlas y método de extracción.
- **source/atlases/**: atlas originales del arte generado.
- **references/**: las dos imágenes de diseño que guiaron el kit.
- **examples/**: componente React, estilos, datos de ejemplo y demo autónoma.
- **preview/**: catálogo de PNG, montajes de referencia con los assets reales y comprobaciones.
- **scripts/extract-assets.mjs**: extracción reproducible a partir de los atlas.

## Ver el panel

Abre **examples/index.html** en un navegador. Funciona directamente como archivo local, sin instalar dependencias ni usar internet.

Puedes abrir cualquiera de las seis tarjetas o las tarjetas especiales de Jerry y Rocky, volver a la colección, cerrar y reabrir el panel. Las pendientes muestran cómo obtenerlas. Escape vuelve de detalle a colección y, desde la colección, cierra. El panel usa scroll vertical en pantallas pequeñas.

El botón **Ver aprendizaje** emite el evento **badge-panel:open-learning**, con **badgeId** y **learningId**. La demo no contiene las pantallas académicas del juego.

Los textos académicos, fechas e IDs de aprendizaje de **example-badges.json** son datos de demostración. Conecta estos campos con **public/config/bitacora.json** y con tu progreso real; no deben sustituir las reflexiones académicas. La condición final de Jerry y Rocky —completar toda la bitácora— y la dedicatoria de Rocky corresponden a esta actualización solicitada.

## Rocky y Jerry: desbloqueo al finalizar la bitácora

La versión **1.1.0** agrega **public/assets/ui/badges/badge-rocky.png** y la entrada **badge.rocky** al índice. El PNG de Rocky se incorpora exactamente como fue proporcionado, con su aureola y su boquita abierta.

En **examples/example-badges.json**, tanto Jerry como Rocky tienen **category: "special"**, **unlockAt: "journal-complete"** y **xp: 0**. El componente React y la demo calculan su disponibilidad a partir de los aprendizajes: debe haber al menos uno activo y todos deben tener **earned: true**. Por eso, con cinco de seis completados ambas siguen pendientes; con seis de seis se desbloquean juntas. Si agregas un aprendizaje activo, también debe estar completado. Conecta **earned** de cada aprendizaje a su estado real y vuelve a pasar los datos actualizados al componente.

Las insignias especiales se excluyen del contador de aprendizajes y no otorgan XP. Hasta completar la bitácora, ambas se muestran en escala de grises con el estado **Por descubrir** y explican su condición al abrir la ficha. La demo comienza con dos de seis aprendizajes completados.

Rocky tiene además **specialType: "memorial"** y el subtítulo **Siempre en nuestro corazón**. Después de desbloquearse, su ficha muestra **Siempre presente**, **Un lugar para recordarlo** y **Con mucho cariño**, sin asignarle una fecha de homenaje. Jerry conserva su ficha de amistad. Los textos de Rocky son:

> El amor y el cariño que sentimos por Rocky, un perrito muy especial en la vida de Vanessa.

> Aunque ya no esté a nuestro lado, Rocky sigue siendo parte de nuestra historia. Lo recordamos con mucho amor y le guardamos un lugar en esta bitácora y en nuestro corazón.

**preview/collection-assets.png** muestra ambas especiales pendientes. **preview/rocky-detail-assets.png** muestra la ficha de Rocky en el estado final, con la bitácora completada. Los marcos, huellas, halos, flores y etiquetas se reutilizan del paquete existente.

## Integrar en React + Vite

1. Copia el contenido de **public/assets/** dentro de **public/assets/** de tu proyecto.
2. Copia estos cinco archivos de **examples/** a una misma carpeta en tu código:
   **BadgePanel.tsx**, **BadgePanel.css**, **asset-styles.css**, **asset-files.ts** y **example-badges.json**.
3. Adapta los datos de ejemplo a tus aprendizajes y a tu estado de progreso.
4. Monta el panel sobre Phaser. Pausa el movimiento del juego mientras esté abierto.
5. Usa **onOpenLearning** para abrir la UI React del aprendizaje correspondiente.

Ejemplo:

~~~tsx
import { useState } from "react";
import BadgePanel, { type Badge } from "./BadgePanel";
import demo from "./example-badges.json";

export function Insignias() {
  const [open, setOpen] = useState(false);
  const badges = demo as Badge[]; // Reemplazar por config + progreso real.

  return <>
    <button onClick={() => setOpen(true)}>Insignias</button>
    <BadgePanel
      open={open}
      badges={badges}
      assetBase={import.meta.env.BASE_URL + "assets/ui/"}
      onClose={() => setOpen(false)}
      onOpenLearning={(badge) => {
        window.dispatchEvent(new CustomEvent("badge-panel:open-learning", {
          detail: { badgeId: badge.id, learningId: badge.learningId },
        }));
      }}
    />
  </>;
}
~~~

Las ocho insignias conservan los bytes de las imágenes proporcionadas. En la vista pendiente se utiliza **filter: grayscale(1)** en CSS y un candado superpuesto.

**assets.json** es un índice del paquete. Fusiona las entradas que necesites con tu índice existente; no reemplaces todo **public/assets/assets.json** sin adaptar su esquema. Las claves nuevas usan el prefijo **ui.badgePanel.**; las insignias usan **badge.**.

## Marcos que se adaptan al tamaño

Los marcos y labels se ofrecen como PNG para **nine-slice**, o nueve segmentos. Los cortes se expresan en píxeles del archivo fuente. El CSS de ejemplo ya contiene los valores concretos de cada asset.

~~~css
.panel {
  border-style: solid;
  border-color: transparent;
  border-width: 22px;
  border-image-source: url("/assets/ui/badge-panel/frames/panel-frame.png");
  /* Copiar top/right/bottom/left de assets.json. */
  border-image-slice: 78 78 78 78 fill;
  border-image-width: 22px;
  border-image-repeat: stretch;
  image-rendering: pixelated;
}
~~~

El ejemplo anterior explica la técnica; **asset-styles.css** contiene los cortes reales. Mantén un ancho de borde fijo y estira solo el centro para conservar las esquinas. No estires una imagen completa con **background-size: 100% 100%** para las tarjetas.

## Montaje visual

- **Colección:** frame del panel → frame de tarjeta → halo tenue → ramitas → insignia → destellos o candado → título → label con texto HTML.
- **Detalle:** frame de exhibición → halo → ramitas → insignia grande → estado → label XP → flores inferiores.
- **Jerry y Rocky:** tarjetas especiales lavanda → huella → insignia → título → label especial → estado. Rocky añade el subtítulo «Siempre en nuestro corazón».
- **Progreso:** cápsula vacía → contador HTML → seis segmentos, llenos según el total de obtenidas.
- **Divisor:** usa las partes izquierda, diamante central y derecha. Estira las líneas y conserva el tamaño del diamante.

Los PNG originales mantienen su resolución; **recommendedDisplaySize** indica tamaños visuales de referencia, no una escala obligatoria. Usa **image-rendering: pixelated** y evita escalas muy pequeñas para las ramitas.

## Paleta y textos

Crema **#fff7e8**, marrón **#70432a**, dorado **#d6a640**, jade **#397d62** y lavanda **#a877c2**. Texto principal sugerido **#58331f**.

Estados sugeridos: **Obtenida**, **Por descubrir**, **Especial**, **+100 XP**. Mantén estas palabras como texto accesible, no como parte de la imagen.

## Regenerar la extracción

El arte se creó con la herramienta integrada de generación de imágenes, tomando las dos referencias del panel. Los componentes se separaron mediante recortes de atlas; no se redibujaron desde código.

Para volver a separar los mismos atlas:

~~~bash
npm install --prefix scripts
node scripts/extract-assets.mjs generation-prompts.json .
~~~

Esto reconstruye los PNG individuales, **assets.json** y **qa-report.json**. Los recortes usan detección de espacios transparentes, porque las filas de un atlas generado pueden variar levemente de posición. La transparencia RGBA original se conserva.

El cursor pequeño es la única exportación con cambio de resolución: **cursor-hand-32.png**, 32 × 32, nearest-neighbor. Las tres partes del divisor son subregiones del divisor original.

## Referencias y comprobaciones

**preview/asset-catalog.html** permite revisar cada PNG sobre un fondo de transparencia. **collection-assets.png**, **detail-assets.png** y **rocky-detail-assets.png** son montajes deterministas de los assets separados y tus insignias; muestran las capas y los marcos nine-slice. No son capturas de un navegador. **preview/verification.json** registra la validación de los archivos y las limitaciones de la comprobación, y **qa-report.json** las dimensiones, cortes y hashes de las insignias originales.

La demo incluye estilos para escritorio y móvil. La comprobación automática en navegador y la compilación de React no se ejecutaron en este entorno. El JavaScript de la demo y los scripts pasaron la comprobación de sintaxis. También se ejecutó la demo en un entorno DOM mínimo: se verificaron los estados pendientes y finales de Jerry y Rocky, la dedicatoria y la navegación con Escape. Esta prueba no verifica el layout real de un navegador. La regeneración de la extracción conserva las ocho insignias y sus reglas de desbloqueo. Comprueba el componente dentro de tu proyecto al integrar el kit.

El kit contiene arte y ejemplos de integración. No modifica tu repositorio ni el progreso guardado del juego.
