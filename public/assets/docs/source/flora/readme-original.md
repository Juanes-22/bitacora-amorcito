# Bitácora Amorcito — flores y arbustos animados

Seis plantas nuevas en pixel art, con ocho fotogramas cada una: 48 fotogramas
en total. Las hojas usan transparencia real y conservan la paleta de los
midground de referencia: margaritas crema, flores rosadas, girasoles, espigas
moradas y arbustos en verde lima, esmeralda y azul verdoso.

| Planta | Velocidad inicial | Altura visible sugerida |
| --- | --- | --- |
| Margaritas al viento | 6 fps | 42 px |
| Flores rosadas al viento | 6 fps | 38 px |
| Girasoles al viento | 6 fps | 58 px |
| Flores moradas al viento | 6 fps | 52 px |
| Arbusto redondo al viento | 4 fps | 58 px |
| Arbusto con flores al viento | 4 fps | 60 px |

## Archivos

- assets/flowers/: cuatro PNG y sus atlas JSON.
- assets/bushes/: dos PNG y sus atlas JSON.
- assets.json: índice, tamaños reales, anclajes, escalas y animaciones.
- phaser-flora.js: carga, registro de animaciones y colocación.
- generation-prompts.json: prompts de generación y ajustes de los girasoles.

## Anclaje y recorte

Usar los .atlas.json para cargar las animaciones. Las hojas muestran cuatro
columnas y dos filas, pero los dibujos no tienen idénticos márgenes en todos
los fotogramas. Los atlas contienen sus regiones exactas y compensan la
posición de la raíz en un lienzo lógico común. Esto evita el desplazamiento
grande entre las filas y conserva la inclinación de la parte superior.

El anclaje se estima sobre los píxeles opacos de la base de cada planta; su
error de alineación en los metadatos es menor o igual a medio píxel del PNG
fuente. Los PNG se incluyen con sus bytes originales, sin recortar o
reescalar sus píxeles. Puede haber pequeñas variaciones dibujadas de hojas y
pétalos entre fotogramas.

La altura sugerida corresponde a la silueta visible. El tamaño lógico del
fotograma es independiente del tamaño completo de la hoja.

## React + Vite + Phaser

Extraer assets/ en public/flora/assets/. Colocar assets.json y phaser-flora.js
en src/flora/. Usar pixelArt: true en la configuración del juego.

```js
import flora from "./flora/assets.json";
import {
  preloadFlora,
  createFloraAnimations,
  addAnimatedPlant
} from "./flora/phaser-flora.js";

// Estos métodos van dentro de tu Scene.
preload() {
  preloadFlora(this, flora, "/flora/");
}

create() {
  createFloraAnimations(this, flora);

  // Posiciones de ejemplo: ajustar al mapa.
  addAnimatedPlant(this, flora, "daisies-sway", 420, 720, {
    depth: 30,
    startFrame: 0
  });
  addAnimatedPlant(this, flora, "pink-flowers-sway", 470, 735, {
    depth: 30,
    startFrame: 3,
    frameRate: 5
  });
  addAnimatedPlant(this, flora, "round-bush-sway", 550, 745, {
    depth: 30,
    startFrame: 5
  });
}
```

El helper interpreta x,y como la posición de la raíz en el mapa. Variar
startFrame y frameRate por instancia evita que todas se balanceen al mismo
tiempo. Ajustar depth según las capas del proyecto y scale para cambiar la
altura respecto del valor sugerido.

## Colocación en los mapas de referencia

Las flores y arbustos de los midground adjuntos ya están pintados en esas
capas. Estos assets son piezas independientes: colocarlos en espacios libres
o sustituir el elemento estático correspondiente si quieres animarlo. La
superposición directa sobre una planta ya pintada puede producir un doble
contorno durante el balanceo.

Mantener la raíz sobre el césped o borde del sendero. Situar las plantas detrás
de las cercas que deban taparlas, y evitar bloquear visualmente los puntos
interactivos. Estos archivos no modifican los dos midground originales.

## Validación

Comprobados: alfa de los seis PNG, 48 regiones no vacías, márgenes exteriores,
límites de recorte, anclajes, hashes de PNG e integridad del ZIP. El helper pasa
la comprobación de sintaxis JavaScript. No se ha ejecutado dentro del proyecto.

Referencia de integración:
- https://docs.phaser.io/phaser/concepts/textures
- https://docs.phaser.io/phaser/concepts/animations
