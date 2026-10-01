# Vanessa y Jerry — animaciones de inactividad

Tres sprite sheets PNG con transparencia real. Todos miden exactamente
1086 × 1448 píxeles, igual que vanessa-jerry-walk-poses-v4.png. Cada atlas
define doce fotogramas lógicos de 362 × 362 píxeles. Los PNG no se reescalaron.

## Hojas

| Archivo | Secuencia |
| --- | --- |
| vanessa-jerry-idle.png | Reposo, respiración sutil, parpadeo y movimiento de cola. |
| vanessa-jerry-idle-look.png | Vanessa mira a Jerry y él la mira de vuelta. |
| vanessa-jerry-idle-play.png | Vanessa se agacha, lo acaricia, juega con él y vuelve a levantarse. |

Las dos primeras hojas tienen tres columnas por dirección: filas de frente,
izquierda, derecha y espalda. La hoja de juego usa sus doce fotogramas en
orden cronológico, de izquierda a derecha y luego hacia abajo. Toda esa
secuencia conserva una vista frontal; sus filas no representan direcciones.

## Tamaño y anclaje

Cargar usando los .atlas.json, que contienen los recortes reales de los
dibujos y alinean los pies de Vanessa en un lienzo de 362 × 362. Evitar
load.spritesheet() con división uniforme: los márgenes de los dibujos
generados varían ligeramente entre filas y columnas.

Conservar la escala que ya usa el personaje al caminar. Los atlas compensan
la colocación de los pies sin cambiar la escala de los píxeles. En la
interacción, la menor altura de la silueta corresponde a la postura agachada.

El origen de cada hoja está en assets.json. Ajustar el origen al cambiar
de textura y conservar también el punto de apoyo del sprite de caminar.
Las poses dibujadas pueden tener pequeñas variaciones entre fotogramas.

## Uso en Phaser

Colocar character/ en public/vanessa-idle/character/. Copiar assets.json y
phaser-idle.js a src/vanessa-idle/. Importarlos en la Scene; ajustar las
rutas de importación a la ubicación de esa Scene.

```js
import idle from "./vanessa-idle/assets.json";
import {
  preloadVanessaIdle,
  registerVanessaIdle,
  playVanessaIdle
} from "./vanessa-idle/phaser-idle.js";

// En preload():
preloadVanessaIdle(this, idle, "/vanessa-idle/");

// En create():
registerVanessaIdle(this, idle);

// Al detener el movimiento:
playVanessaIdle(
  playerSprite, idle,
  "vanessa-jerry-idle",
  idle.idleConfig.restByDirection[lastDirection]
);

// Gesto breve después de unos segundos quieta:
playVanessaIdle(
  playerSprite, idle,
  "vanessa-jerry-idle-look",
  idle.idleConfig.glanceByDirection[lastDirection]
);

// Juego con Jerry, cuando el personaje está mirando al frente:
playVanessaIdle(
  playerSprite, idle,
  "vanessa-jerry-idle-play",
  idle.idleConfig.playAnimation
);
```

## Comportamiento sugerido

- Reposo inmediatamente al soltar el movimiento. Su pausa entre ciclos evita
  parpadear continuamente.
- Mirada a Jerry después de 4.5 segundos sin entrada; reproducir una vez y
  volver al reposo en la misma dirección.
- Juego después de 10 segundos, cuando mira al frente; reproducir una vez y
  volver al reposo. Desde otras direcciones conservar reposo o mirada.
- Al recibir movimiento, cancelar el gesto y reproducir caminar de inmediato.
- Reiniciar el temporizador de inactividad al recibir entrada y después de
  completar un gesto. Aplicar un intervalo de 8 segundos entre gestos.
- No reproducir varias animaciones de estas hojas al mismo tiempo en el
  mismo sprite. El helper registra las secuencias; la lógica de movimiento,
  temporizadores y eventos debe integrarse en el controlador del proyecto.

## Verificación

Comprobados: dimensiones exactas de los tres PNG, canal alfa, 36 regiones
de fotogramas no vacías, anclajes y límites de atlas, integridad ZIP y hashes
de PNG conservados. El helper JavaScript pasa la revisión de sintaxis.
Las animaciones no se han ejecutado dentro del proyecto.

Los archivos originales adjuntos permanecen sin cambios.
