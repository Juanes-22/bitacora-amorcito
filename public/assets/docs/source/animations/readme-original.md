# Assets de animación del paisaje

Incluye 10 PNG con transparencia, organizados en animations, decorations, background y particles. Agua, cascada y espuma contienen 8 cuadros cada uno, en orden de izquierda a derecha y de arriba abajo (4 columnas × 2 filas).

Los PNG conservan sus bytes originales. Los atlas JSON indican las regiones de los fotogramas y sus márgenes, para mantener una referencia de tamaño consistente sin modificar las imágenes.

## Integración en React + Vite + Phaser

Copia la carpeta assets a public/assets. Incorpora las entradas de assets.json a tu configuración; este índice cubre únicamente este kit.

En preload:

```ts
this.load.atlas(
  'landscape-waterfall',
  '/assets/animations/waterfall.png',
  '/assets/animations/waterfall.atlas.json'
);
```

En create:

```ts
this.anims.create({
  key: 'landscape-waterfall-loop',
  frames: this.anims.generateFrameNames('landscape-waterfall', {
    prefix: 'frame-', start: 0, end: 7, zeroPad: 2,
  }),
  frameRate: 10,
  repeat: -1,
});

const cascade = this.add.sprite(x, y, 'landscape-waterfall');
cascade.play('landscape-waterfall-loop');
```

Aplica origin y recommendedScale de cada entrada. Las escalas son puntos de partida; ajusta la posición y el tamaño a tu mapa. Los PNG incluyen margen transparente: recommendedContentHeightPx se refiere al dibujo visible. Activa pixelArt: true en Phaser.

Las plantas, la copa y la nube son PNG estáticos para mover con tweens; hojas, pétalos y gotas se usan como texturas de partículas. motion contiene sugerencias que tu lógica debe interpretar; no es una configuración completa para pasar directamente a Phaser.

Al integrar plantas o copas animadas, sustituye el elemento estático correspondiente o colócalas en un lugar libre. Los reflejos y la espuma deben permanecer dentro del agua; usa una máscara o sitúalos evitando rocas y puentes. La copa se coloca sobre un tronco independiente.

Estas piezas son reutilizables y requieren ajustar sus placements en cada mapa. No se ha modificado el proyecto ni los fondos anteriores.

Documentación: [Loader](https://docs.phaser.io/phaser/concepts/loader), [Animations](https://docs.phaser.io/phaser/concepts/animations) y [Tweens](https://docs.phaser.io/phaser/concepts/tweens).
