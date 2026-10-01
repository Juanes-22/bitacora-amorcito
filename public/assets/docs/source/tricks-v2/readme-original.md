# Vanessa y Jerry: trucos y peluche, v2

La hoja de trucos se rehizo usando la referencia de reposo para acercar las proporciones. El PNG mantiene 1086 x 1448 y fondo transparente. La altura dibujada no es identica en todas las poses: assets.json incluye las mediciones y un factor uniforme por fotograma para que Vanessa se muestre a 316 px de alto multiplicados por la escala del juego. Jerry recibe el mismo factor, conservando su proporcion. No se han remuestreado los pixeles del PNG.

Usa los atlas; las regiones tienen margenes variables. El helper incluido aplica el origen de los pies y la escala en cada cambio de fotograma. Importa preloadVanessaIdle, registerVanessaIdle, playVanessaIdle y restoreVanessaScale de phaser-idle.js.

```js
// Despues de cargar los atlas y registrar las animaciones:
playVanessaIdle(sprite, manifest, 'vanessa-jerry-tricks', 'jerry-give-paw', escalaOriginal);
// Antes de volver a caminar/reposo desde otro paquete:
restoreVanessaScale(sprite);
// A continuacion, usa el origen y animacion habituales del juego.
```

escalaOriginal es la escala uniforme que ya usa Vanessa en el reposo adjunto; por ejemplo, 0.5 si la muestra a 158 px. No uses la escala temporal del truco como escalaOriginal. La normalizacion es visual: no cambia el cuerpo de colisiones.

Las animaciones disponibles siguen siendo vanessa-jerry-tricks, jerry-jump, jerry-sit, jerry-give-paw y jerry-stand. La hoja y el atlas de buscar el peluche se conservan sin cambios.

API de eventos de Phaser: https://docs.phaser.io/api-documentation/3.88.2/namespace/animations-events
