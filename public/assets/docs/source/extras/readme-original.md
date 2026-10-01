# Bitácora Amorcito — assets extra del paisaje

Once assets nuevos para complementar el pack de agua y vegetación. Estilo y
paleta inspirados en la referencia del árbol iluminado. Todos los PNG tienen
transparencia real.

| Asset | Formato | Movimiento sugerido |
| --- | --- | --- |
| Guirnalda dorada animada | 8 fotogramas + atlas | 6 fps |
| Farol cálido para el árbol | PNG independiente | Tween o emisor |
| Halo de luz dorada | PNG independiente | Tween o emisor |
| Rayos de luz entre las hojas | PNG independiente | Tween o emisor |
| Destello dorado animado | 8 fotogramas + atlas | 12 fps |
| Partícula luminosa | PNG independiente | Tween o emisor |
| Polen flotante | PNG independiente | Tween o emisor |
| Nube pequeña | PNG independiente | Tween o emisor |
| Nube alargada | PNG independiente | Tween o emisor |
| Patito amarillo nadando | 8 fotogramas + atlas | 8 fps |
| Patico blanco nadando | 8 fotogramas + atlas | 8 fps |

## Contenido

- assets/lights/: guirnalda animada, farol, halo dorado y rayos de luz.
- assets/particles/: destello animado, mota luminosa y polen.
- assets/clouds/: nube compacta y nube alargada.
- assets/ducks/: patito amarillo y patico blanco, con ocho fases cada uno.
- assets.json: dimensiones reales, escalas, orígenes y parámetros iniciales.
- phaser-extras.js: carga, creación de animaciones y colocación de assets.
- generation-prompts.json: prompts usados para generar cada PNG.

## Importante para las animaciones

Cargar las cuatro secuencias mediante sus .atlas.json. Los atlas recortan
regiones del PNG y asignan a todos los fotogramas un lienzo lógico común,
alineado al centro o a la base. Así se compensa el desplazamiento del dibujo
entre filas. No cargar esas hojas como una cuadrícula con load.spritesheet().

La normalización se realiza exclusivamente en los metadatos: los PNG conservan
sus bytes originales. Hay pequeñas variaciones dibujadas de forma y tamaño
entre los fotogramas. El tamaño sugerido es el de la silueta visible, no el de
todo el archivo, que incluye margen transparente.

Las sugerencias de motionSuggestion son datos orientativos; no se pasan
directamente como configuración de Phaser.

## Integración con React + Vite + Phaser

Extraer assets/ en public/landscape-extras/assets/. Colocar assets.json y
phaser-extras.js en src/landscape-extras/. Importarlos en la Scene y activar
pixelArt: true en la configuración del juego.

```js
import extras from "./landscape-extras/assets.json";
import {
  preloadLandscapeExtras,
  createLandscapeExtrasAnimations,
  addLandscapeExtra
} from "./landscape-extras/phaser-extras.js";

// Dentro de la Scene:
preload() {
  preloadLandscapeExtras(this, extras, "/landscape-extras/");
}

create() {
  createLandscapeExtrasAnimations(this, extras);

  // Coordenadas de ejemplo: reemplazarlas por las de tu mapa.
  const halo = addLandscapeExtra(
    this, extras, "warm-light-glow", 780, 310, { depth: 40 }
  );
  this.tweens.add({
    targets: halo, alpha: 0.09, duration: 2200,
    yoyo: true, repeat: -1, ease: "Sine.easeInOut"
  });

  addLandscapeExtra(
    this, extras, "tree-fairy-lights", 790, 210, { depth: 50 }
  );

  const pato = addLandscapeExtra(
    this, extras, "duckling-swim", 360, 750, { depth: 30 }
  );
  const startX = pato.x;
  this.tweens.add({
    targets: pato, x: startX + 50, duration: 7000,
    yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    onYoyo: () => pato.setFlipX(true),
    onRepeat: () => pato.setFlipX(false)
  });
}
```

## Iluminación del árbol

- Guirnalda y farol: mezcla NORMAL para conservar su cuerda y marco.
- Halo y rayos: mezcla ADD con opacidad baja; el halo empieza en 0.14 y los
  rayos en 0.08. Ajustar intensidad y tamaño sobre el árbol del mapa.
- El farol se ancla en la parte superior de su cordón. Los rayos se anclan
  cerca de su fuente en la esquina superior izquierda de la silueta.
- Poner la guirnalda entre las capas del tronco y las hojas que deban cubrirla.
  Poner los destellos y motas donde quieras que permanezcan visibles.
- Los efectos son sprites de luz: no recalculan la iluminación ni las sombras
  del terreno. Su pulso se obtiene animando alpha.

## Partículas, nubes y paticos

- Mota y polen: usar sus textureKey en emisores de partículas y aplicar la
  escala indicada en assets.json; los archivos tienen margen transparente.
  Emitir despacio y desvanecer la opacidad al final de su vida.
- Destello: puede colocarse como sprite animado en las ramas. Para una emisión
  puntual, reproducir su animación con repeat: 0 y destruir el sprite al
  terminar.
- Nubes: desplazar en X y reubicar al salir de la pantalla. Situar detrás de las
  montañas. Usar velocidades distintas de 3 y 5 píxeles por segundo.
- Paticos: las hojas animan el gesto de nado; mover el sprite por un tramo
  navegable del río. Ambos miran a la derecha; setFlipX(true) permite mirar
  a la izquierda. El patico blanco incluye una pequeña ondulación azul de
  agua. Añadir al amarillo los ripples del pack anterior si se desea.
- Ajustar la posición sobre el río y evitar que el recorrido cruce puentes,
  rocas u orillas. No incluyen físicas, rutas ni colisiones configuradas.

## Verificación

Comprobados: alfa de los once PNG, ocho regiones no vacías en cada secuencia,
coordenadas y márgenes de atlas, hashes de PNG conservados e integridad ZIP.
El helper JavaScript pasa la comprobación de sintaxis. El ejemplo debe ajustarse
a tu Scene; no se ha ejecutado dentro del proyecto.

Referencias oficiales de Phaser consultadas:
- https://docs.phaser.io/phaser/concepts/textures
- https://docs.phaser.io/phaser/concepts/animations
- https://docs.phaser.io/phaser/concepts/tweens
- https://docs.phaser.io/api-documentation/namespace/gameobjects-components-blendmode
