# Gallinas y pollitos animados · Bitácora Amorcito

Cinco gallinas adultas: gris esponjosa (foto 1), negra con copete blanco y negro (fotos 2 y 3 del mismo animal), blanca común, café común y la mamá blanca esponjosa de la nueva foto. También se incluye un pollito negro y gris que puedes reutilizar para formar el grupo de pequeños. Cada tipo tiene tres animaciones de cuatro fotogramas: reposo, caminar y picotear. Total: 72 fotogramas en seis hojas.

## Archivos

- `decorations/chickens/`: seis hojas PNG con transparencia y seis atlas JSON de TexturePacker.
- `assets.json`: índice de assets, recortes, márgenes, origen, escala recomendada y tiempos por fotograma.
- `preview.html`: vista previa autónoma con controles y ejemplo de distribución; funciona al abrir el archivo, sin servidor.
- `chickens-canvas.js`: reproductor Canvas 2D opcional, sin dependencias.
- `chicken-family.js`: posiciones y estados para que los pollitos sigan el recorrido de la madre; puede usarse con Canvas o con tu motor.
- `placements.example.json`: ejemplo de configuración para colocar varios animales. Sustituye los identificadores de mapa y coordenadas por los reales.
- `generation-prompts.json`: instrucciones de generación, guardadas por variante.

## Escala y recortes

Los PNG se entregan en su resolución de generación, 1448 × 1086, sin remuestrear. Tienen cuatro columnas y tres filas; las posiciones exactas se indican en los atlas. Usa los atlas en lugar de dividir la imagen con una cuadrícula fija: algunas poses se extienden más que otras.

Cada fotograma tiene un lienzo virtual común de 448 × 448. Se añaden márgenes transparentes mediante el atlas, sin editar los píxeles. El punto de apoyo de las patas está alineado. El tamaño inicial recomendado para mostrar cada lienzo adulto en el mapa es 48 × 48; la silueta visible ocupa aproximadamente 30–37 píxeles de alto. Para los pollitos se recomienda 24 × 24, con una silueta visible de unos 15 píxeles de alto. El tamaño específico aparece en `displaySize` de cada asset. Puedes ajustarlo según la escala del paisaje.

Las tres animaciones miran hacia la derecha. Usa `flipX` para mirar hacia la izquierda. No se incluyen vistas frontal ni trasera. El caminar ocurre en el sitio: el motor mueve la posición del animal mientras reproduce los pasos.

Las imágenes no incluyen sombras de suelo, césped ni partículas. Esto facilita colocarlas en cualquier parte de los mapas.

## Animaciones

| Estado | Fotogramas | Duración de los fotogramas |
| --- | --- | --- |
| Reposo / idle | idle-00 a idle-03 | 1200, 450, 130, 600 ms |
| Caminar / walk | walk-00 a walk-03 | 140, 140, 140, 140 ms |
| Picotear / peck | peck-00 a peck-03 | 650, 180, 220, 200 ms |

Todos los estados forman bucles. El reposo contiene una pausa larga y un parpadeo corto; el picoteo baja la cabeza y la devuelve a la posición inicial.

## Colocarlas en el juego

Copia `decorations/chickens/` dentro de `public/assets/`. Añade las entradas de este `assets.json` al índice de tu proyecto conservando sus rutas. Para Phaser, carga cada PNG y su atlas con el cargador de atlas TexturePacker JSON Hash. Los nombres de fotograma coinciden con `frameNames` del índice.

Configura el origen de cada sprite con los valores `origin` del índice y aplica el tamaño de visualización después de cargar el atlas. Desactiva el suavizado del renderer para conservar los bordes del pixel art.

Coloca varias instancias de la misma variante; no hace falta duplicar el PNG. Alterna reposo de 2–5 segundos, picoteo y caminatas cortas dentro de un radio de 20–40 píxeles del punto inicial. Varía la pausa y la velocidad un poco entre animales para evitar que se muevan sincronizados.

Antes de iniciar una caminata, comprueba que el destino y el trayecto sean transitables en tu sistema de colisiones: las gallinas deben mantenerse en tierra firme y lejos de paredes, agua y letreros. El ejemplo de distribución es una plantilla; sus posiciones no se han aplicado a tus mapas.

## La mamá y los pollitos

La gallina blanca esponjosa y los pollitos negros están en hojas independientes. El grupo `white-hen-family` de `assets.json` enlaza sus assets y propone cuatro pollitos; puedes cambiar la cantidad. Cada pollito reutiliza la misma textura, con su propio estado y ritmo.

`chicken-family.js` conserva el recorrido reciente de la madre y calcula posiciones separadas para los pequeños. Recibe la posición de la madre y devuelve posición, orientación y estado de cada pollito:

```js
const family = createChickenFamily(manifest, { x: mother.x, y: mother.y });
// Dentro del bucle del juego:
const followers = family.update(mother, deltaMs, timeMs);
// Dibuja cada follower con su assetId, posición, flipX y state.
```

La madre se mueve con tu sistema de navegación y colisiones. Los pequeños siguen esa ruta; valida que el recorrido y su espacio permitan pasar al grupo. La vista previa muestra el seguimiento y las pausas sobre un terreno de prueba.

## Reproductor Canvas opcional

Importa `createChickenPlayer` de `chickens-canvas.js`. Recibe la imagen ya cargada y la entrada de la gallina en el índice:

```js
const player = createChickenPlayer(image, manifest.assets['hen-grey-fluffy']);
player.setState('peck');
player.draw(context, x, y, { size: 48, flipX: false, now: performance.now() });
```

`x,y` es la posición de las patas. Llama a `draw` dentro del bucle de renderizado. El reproductor no crea temporizadores ni mueve el animal; esas acciones pertenecen al juego.

Las ilustraciones se generaron con la herramienta integrada de imágenes y se comprobaron visualmente. Los atlas, metadatos y la vista previa se prepararon a partir de los PNG originales. No se adjuntan las fotografías personales.
