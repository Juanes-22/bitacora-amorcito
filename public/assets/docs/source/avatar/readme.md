# Avatar de Vanessa y Jerry

Incluye el avatar estático con el largo anterior del cabello y una hoja con ocho fotogramas: cuatro de reposo y cuatro felices. La chaqueta toma el negro y las sombras de la referencia de cuerpo completo. La sonrisa feliz es abierta y lleva el destello de tres rayos amarillos de la referencia. Jerry mueve la cabeza y las orejas, guiña, levanta una pata y se acerca a Vanessa. assets.json y el atlas son archivos separados de los PNG.

Abre preview.html para comprobar las dos animaciones; funciona sin servidor y sin instalar nada.

Los fotogramas tienen un tamaño lógico común de 386 x 386. Usa el atlas, no dividas el PNG a ciegas: su ancho es 1774 px y las dos filas necesitan distintos offsets para alinearse. El atlas aplica esos márgenes transparentes virtuales sin remuestrear el PNG. Los recortes varían entre 327 y 328 px de alto; se mantiene la misma escala y una línea inferior común al cambiar de estado. El origen horizontal se mide en el busto para que las orejas de Jerry o los rayos amarillos no desplacen el retrato. Los tiempos están en durationsMs, en milisegundos, en assets.json. Reposo incluye un parpadeo breve tras una pausa; feliz incluye sonrisa abierta, movimiento de Jerry y destello pulsante.

Para un avatar de React puedes usar el canvas con el helper incluido:

```js
import { createAvatarAnimator } from './avatar-animation.js';
const manifest = await fetch('/assets/avatars/assets.json').then(r => r.json());
const animation = await createAvatarAnimator(canvas, manifest, '/assets/avatars/');
animation.play('idle');
// Cuando termine un aprendizaje:
animation.play('happy');
// Al desmontar el componente:
animation.destroy();
```

En Phaser puedes cargar el PNG y el atlas con scene.load.atlas. Usa los nombres idle-00 a idle-03 y happy-00 a happy-03; los márgenes de TexturePacker se aplican al mismo sourceSize. Para conservar el pixel art, desactiva el suavizado en el renderer.

La paleta del JSON registra los colores solicitados: #795042 y #c68864. Los PNG generados contienen variantes de tono en bordes y sombreado; no se ha aplicado una reducción a paleta exacta. Todas las ilustraciones se generaron con la herramienta de imágenes integrada; generation-prompts.json conserva las instrucciones de generación.

La hoja de animación conserva el pixel art del avatar original. La nariz de Vanessa sigue la referencia del avatar: un bloque claro arriba a la izquierda y una sombra coral escalonada abajo a la derecha, en los ocho fotogramas.
