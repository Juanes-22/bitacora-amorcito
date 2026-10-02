# Animaciones XP y player glow

Dos efectos basados en `xp-star.png` y `player-glow.png`, con transparencia real. Abre `preview.html` para verlos, cambiar el fondo, pausar y revisar cada fotograma. Funciona sin conexión.

| Efecto | ID en assets.json | Fotogramas | Velocidad | Comportamiento |
| --- | --- | --- | --- | --- |
| Estrella XP | `effect.xp-star.complete` | 8 | 12 fps | Aparece, destella y se desvanece en 0,67 s; se elimina al terminar. |
| Próxima estación | `effect.player-glow.next-station` | 8 | 8 fps | Aro dorado con partículas; bucle de 1 s hasta cambiar o completar la próxima estación. |

## Archivos

- `assets/effects/xp-star-complete.png` y `player-glow-next.png`: spritesheets RGBA de **2048 × 1280**, cuatro columnas y dos filas.
- Cada celda mide **512 × 640**. Orden: izquierda a derecha, fila superior primero. Margen y separación: cero. El espacio transparente dentro de cada celda permite conservar todos los píxeles originales y alinear el efecto.
- `assets/effects/*.atlas.json`: atlas compatibles con Phaser, con ocho frames nombrados. También puedes cargar las hojas como spritesheets con las dimensiones anteriores.
- `assets/effects/frames/`: 16 PNG individuales, con la misma alineación que sus hojas.
- `assets/effects/*.apng`: versiones animadas con alpha completo y con la opacidad aplicada. XP se reproduce una vez y termina en un noveno frame vacío para que desaparezca. El glow se repite continuamente.
- `preview/*.gif`: demostraciones sobre fondo verde. El GIF de XP y la vista conjunta lo repiten con una pausa para facilitar la revisión; la animación del juego se reproduce una sola vez.
- `assets/assets.json`: índice adicional con dos entradas nuevas. `assets/animations.json` contiene los clips.
- `examples/phaser-effects.js`: carga, reproducción, desvanecimiento y eliminación de XP; creación, movimiento y eliminación del marcador de próxima estación.
- `references/`: copias sin cambios de los dos PNG originales. `PROMPTS.md` contiene los prompts usados.

## Integración

1. Copia `assets/effects/` a `public/assets/effects/`.
2. Agrega las dos entradas de este `assets/assets.json` al índice principal. Las rutas son relativas al directorio de ese JSON. Conserva las entradas actuales.
3. Si quieres preparar la unión automáticamente, desde la carpeta de este paquete ejecuta:

```bash
node examples/merge-assets.mjs /ruta/proyecto/public/assets/assets.json assets/assets.json /ruta/proyecto/public/assets/assets-merged.json
```

El helper produce un archivo nuevo junto al índice actual. No modifica las entradas existentes y rechaza IDs que ya tengan otra ruta o contenido. Puedes usar ese resultado como tu índice actualizado.

4. Copia `examples/phaser-effects.js` al proyecto e importa sus funciones en tu escena:

```js
import {
  preloadStationEffects,
  registerStationEffectAnimations,
  showXpReward,
  addNextStationGlow,
} from './phaser-effects.js';

// Dentro de preload():
preloadStationEffects(this, '/assets/');

// Dentro de create():
registerStationEffectAnimations(this);
const nextMarker = addNextStationGlow(this, nextStation.x, nextStation.y, {
  depth: 5,
  scale: 0.5,
});

// Cuando se completa una estación:
showXpReward(this, completedStation.x, completedStation.y - 60, {
  depth: 50,
  scale: 0.5,
});

// Al elegir otra próxima estación:
nextMarker.moveTo(nextStation.x, nextStation.y);

// Cuando ya no quedan estaciones por explorar:
nextMarker.remove();
```

Las coordenadas son del mundo de Phaser. Ajusta `depth` según las capas del mapa: el aro debe verse por debajo del personaje y de la estación; XP, por encima. La escala 0,5 dibuja una celda de 256 × 320, incluyendo su espacio transparente.

## Anclas y opacidad

El centro de la estrella está en `(256,352)` de cada celda; su origen es `(0.5,0.55)`. El centro del aro está en `(256,416)`; su origen es `(0.5,0.65)`. La normalización mantiene esas anclas con un error máximo de medio píxel, sin remuestrear la ilustración.

Los PNG mantienen el alpha de generación. Para reproducir el desvanecimiento completo y el pulso moderado, aplica `animation.opacityByFrame` del índice. El adaptador de Phaser, la vista HTML y los APNG ya lo aplican. En otro motor, usa esa opacidad por frame y elimina XP al terminar.

Las partículas y destellos cambian de forma entre frames: son una secuencia ilustrada para un efecto breve. El ancla del aro permanece fija durante el bucle. Para otra velocidad, cambia `frameRate` en el clip; no cambies las dimensiones de las celdas.
