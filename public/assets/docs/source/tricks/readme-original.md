# Vanessa y Jerry — trucos y búsqueda del peluche

Dos PNG transparentes de 1086 × 1448 px, con doce fotogramas cronológicos por
hoja. Se leen de izquierda a derecha y luego hacia abajo. Las filas
continúan la secuencia; no representan direcciones distintas.

- vanessa-jerry-tricks: Jerry salta y aterriza, se sienta, da una pata a
  Vanessa y vuelve a ponerse de pie.
- vanessa-jerry-fetch-plush: Vanessa señala a la derecha; Jerry se acerca
  al peluche de foca marrón, lo recoge, regresa y lo deja junto a ella.
  El juguete conserva el cordón blanco y los detalles bordados de las fotos.

Ambas se reproducen una vez. Evitar un bucle de búsqueda: el juguete
volvería de forma inmediata a la posición inicial.

## Tamaño y anclaje

Los PNG no se reescalaron. Usar sus atlas JSON para conservar el recorte
completo y alinear los pies de Vanessa. El tamaño lógico de cada atlas
está en assets.json; la búsqueda necesita margen transparente adicional en
horizontal para albergar el recorrido de Jerry y el peluche. Ese margen
no cambia el tamaño dibujado de los personajes.

Conservar la escala del sprite existente y ajustar su origen con el índice.
Evitar load.spritesheet() con cuadrícula uniforme, porque los márgenes de
los dibujos varían entre filas y columnas.

## Trucos separados

| Clave | Fotogramas | Uso |
| --- | --- | --- |
| vanessa-jerry-tricks | 0–11 | Secuencia completa |
| jerry-jump | 0–4 | Salto y aterrizaje |
| jerry-sit | 4–6 | Sentarse; mantener el último fotograma |
| jerry-give-paw | 6–9 | Dar la pata desde la postura sentada |
| jerry-stand | 9–11 | Volver a ponerse de pie |
| vanessa-jerry-fetch-plush | 0–11 | Buscar y traer el peluche |

Los trucos parciales contienen a Vanessa y Jerry juntos. Para dar la pata,
usar primero la postura sentada. Al completar un gesto, volver al reposo;
al recibir movimiento, cancelarlo y volver a caminar.

## Integración

Copiar character/ en public/jerry-gestures/character/. Colocar assets.json y
phaser-idle.js en src/jerry-gestures/. El helper es el del pack anterior.

```js
import gestures from "./jerry-gestures/assets.json";
import {
  preloadVanessaIdle,
  registerVanessaIdle,
  playVanessaIdle
} from "./jerry-gestures/phaser-idle.js";

// En preload():
preloadVanessaIdle(this, gestures, "/jerry-gestures/");
// En create():
registerVanessaIdle(this, gestures);

// Trucos completos:
playVanessaIdle(
  playerSprite, gestures,
  "vanessa-jerry-tricks", "vanessa-jerry-tricks"
);

// Buscar el peluche:
playVanessaIdle(
  playerSprite, gestures,
  "vanessa-jerry-fetch-plush", "vanessa-jerry-fetch-plush"
);
```

Vanessa permanece fija en el mapa. El recorrido de Jerry y el peluche están
dibujados dentro del fotograma; no son entidades separadas. Para conservar
el peluche visible tras la búsqueda, mantener el último fotograma. Las
marcas amarillas de algunos fotogramas forman parte del dibujo.

## Validación

Verificados: dimensiones, canal alfa, 24 regiones no vacías, ausencia de
corte en los bordes exteriores, límites de atlas, hashes de PNG conservados
e integridad ZIP. No se han ejecutado las secuencias dentro del juego.
