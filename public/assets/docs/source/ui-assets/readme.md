# Assets de la bitácora

Assets de UI y estaciones basados en la imagen seleccionada del juego. Todos los PNG de uso directo tienen transparencia real. Los botones, los letreros y el indicador de completado están **sin texto**. Los dos letreros tienen pasto corto y discreto en la base.

## Archivos de uso directo

| ID en `assets.json` | Archivo | Tamaño nativo |
| --- | --- | --- |
| `station-sign` | `map/signs/station-sign.png` | 384 × 320 |
| `completed-badge` | `ui/badges/completed.png` | 256 × 80 |
| `button-bitacora` | `ui/buttons/button-bitacora.png` | 256 × 256 |
| `button-jerry` | `ui/buttons/button-jerry.png` | 256 × 256 |
| `button-sound-on` | `ui/buttons/button-sound-on.png` | 256 × 256 |
| `button-sound-off` | `ui/buttons/button-sound-off.png` | 256 × 256 |
| `map-exit-right` | `map/signs/map-exit-right.png` | 384 × 176 |
| `station-glow` | `effects/station-glow/station-glow-sheet.png` | 1024 × 256 |
| `station-glow-static` | `effects/station-glow/station-glow.png` | 256 × 128 |

El glow tiene 8 fotogramas de 256 × 128 en una cuadrícula de 4 columnas y 2 filas. Se reproduce a 8 FPS, en un bucle de un segundo. También se incluyen los 8 PNG individuales, un APNG con transparencia y un GIF de muestra con fondo verde. **El glow no incluye partículas.**

## Etiquetas y números

`labelZones` usa coordenadas en píxeles de cada textura final, medidas desde su esquina superior izquierda. Cada zona incluye posición, tamaño, alineación, tamaño de fuente y color recomendado. Las palabras de `defaultLabels` existen únicamente en JSON; no forman parte del PNG.

- En los botones, colocar la etiqueta en la zona `label`, debajo del ícono.
- En Completado, colocar la etiqueta en `label`, a la derecha del check.
- En la estación, dibujar el número en `number` y el título en `title`.
- En el cambio de mapa, colocar el destino en `destination`; la flecha ya está dibujada.

Si el asset se muestra a otro tamaño, multiplicar las coordenadas de sus zonas por la misma escala que la imagen. No estirar solo un eje. En React, el ejemplo `examples/AssetButton.tsx` calcula esa escala; en Phaser, `examples/phaser-assets.ts` usa un contenedor para escalar conjuntamente imagen y texto.

## Integración

1. Copiar `map/`, `ui/`, `effects/` y `assets.json` a una carpeta, por ejemplo `public/assets/ui-v2/`.
2. Resolver todas las rutas desde esa carpeta: `/assets/ui-v2/`.
3. Usar `pixelArt: true` y `antialias: false` en Phaser, y `image-rendering: pixelated` en CSS.
4. Dibujar el glow debajo del letrero y del personaje, con una opacidad inicial de 0.72; las partículas se crean en otra capa.
5. Cambiar entre los IDs de sonido activado/silenciado según el estado del audio. La etiqueta externa puede permanecer como “Sonido”.

Este `assets.json` es un índice independiente. Para sumarlo a un índice existente, combinar sus entradas y conservar los IDs o adaptar el cargador; no reemplazar los assets anteriores del proyecto.

## Previsualización y regeneración

Abrir `previews/index.html` para ver los assets, activar etiquetas externas, inspeccionar sus zonas y reproducir el glow. Funciona sin conexión y sin un servidor.

`previews/assets-preview.png` muestra los assets sin etiquetas. `generation-prompts.md` contiene los prompts finales y las reglas explícitas de texto vacío, pasto sutil y glow sin partículas. `sources/` conserva los originales generados en alta resolución y las referencias usadas. `export-info.json` documenta los recortes y tamaños de exportación.

`examples/` contiene ejemplos de integración para adaptar al juego. El paquete aporta imágenes y metadatos; no modifica la configuración ni los contenidos de los aprendizajes.
