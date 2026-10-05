# Presentación corregida — Bitácora Amorcito (v2)

Esta revisión sigue la segunda imagen adjunta. Incluye 7 PNG nuevos, 4 elementos reutilizados sin modificar, un índice de assets y ejemplos actualizados.

## Qué cambió

- Marco de madera con borde crema grueso, escalones y esquinas doradas.
- Letrero de madera más ancho y claro, con flores pequeñas a los lados.
- Vanessa y Jerry con halo verde lleno y libro, conservando el side labret a la izquierda del labio, visto desde la imagen.
- Botón jade con esquinas escalonadas, más ancho, texto y flecha blancos.
- Ramitas sin tierra para ambos lados del botón.
- Brote sencillo para la asignatura y la frase inicial.
- Separador fino con semilla central, en lugar del adorno dorado grande.
- Panel horizontal de 1040 × 716, proporciones, tipografía y espacios ajustados a la referencia.

## Integración

1. Copia el contenido de `public/assets/` al `public/assets/` de tu juego. Sobrescribe los dos PNG previos de la presentación (`title-wood-flowers.png` y `welcome-vanessa-jerry.png`). Los nuevos elementos están en `assets/ui/presentation/`.
2. Reemplaza también el componente y la hoja de estilos por `examples/Presentation.jsx` y `examples/presentation-react.css`. La distribución corregida depende de esta nueva CSS.
3. Usa `<Presentation onContinue={continuarRecorrido} />`. La referencia no tiene botón X; si necesitas cerrar, pasa `onClose={cerrarPresentacion}` para habilitarlo. Los assets de cerrar y destellos se reutilizan desde `ui/badge-panel/`.
4. Coloca la presentación por encima del mapa Phaser ya existente; el overlay oscuro permite verlo detrás. Los textos siguen siendo editables con la prop `content`.
5. En escritorio se respetan las coordenadas de la referencia. Entre 801 y 1080 px se ajustan proporciones; hasta 800 px se usa una columna con scroll. En dispositivos bajos el contenedor permite desplazamiento.

## Uso de los PNG

- `panel-parchment.png`: nine-slice con 160 px por lado, borde visible de 60 px (40 en móvil). La CSS ya aplica estos valores para conservar las esquinas.
- `title-wood-flowers.png` e ilustración: mantener proporción, `object-fit: contain`.
- `button-continue.png`: fondo vacío; texto y flecha blancos colocados desde HTML/React. Hover con brillo por CSS.
- `leaf-sprig.png`: reflejar horizontalmente para el lado derecho.
- `sprout-flat.png`: 30 × 30, o 37 × 39 junto a la frase inicial.
- `divider-seed.png`: separador de 442 × 24.

Los nuevos archivos fueron recreados con ImageGen usando la referencia. Pueden conservar pequeñas diferencias de trazo respecto a la imagen original. No llevan texto incrustado ni forman animaciones.

## Demo y revisión

Abre `examples/index.html`. El botón Continuar muestra un estado de demostración y permite volver. El fondo de esta demo usa la imagen de referencia para dar contexto visual; esa captura no es un mapa ni un asset para producción. En React usa tu escena Phaser real detrás.

`previews/comparison.png` compara la referencia con un montaje de los assets nuevos. `previews/corrected-desktop-montage.png` y `previews/catalog.png` permiten inspeccionarlos. Son composiciones de los PNG reales, no capturas del navegador.

Se verificaron rutas, dimensiones, transparencia, integridad del ZIP y coincidencia byte por byte de los 4 elementos reutilizados. La prueba de navegador no pudo ejecutarse porque no hay Chromium instalado. `verification.json` registra esta limitación.

## Archivos

- `assets.json`: dimensiones, rutas, tamaños recomendados, hash SHA-256 y nine-slice.
- `generation-prompts.json`: instrucciones usadas en ImageGen para cada pieza.
- `examples/`: demo HTML y componente React, sin nuevas dependencias para la demo.
- `references/`: referencia proporcionada.
- `previews/`: catálogo y comparación visual.
