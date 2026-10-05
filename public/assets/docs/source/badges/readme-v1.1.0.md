# Bitácora Amorcito · Insignias

Paquete con seis insignias de aprendizaje y dos insignias de compañía: Jerry y Rocky, basado en los aprendizajes y reflexiones del documento incluido. Mantienen el medallón circular y las ramas de la insignia de escucha activa.

## Contenido

- `assets/ui/badges/`: los ocho PNG individuales, con sus nombres finales.
- `assets/assets.json`: índice de assets, rutas, dimensiones reales, significado, claves de textura y datos de transparencia.
- `assets/assets.schema.json`: esquema JSON del índice.
- `generation-prompts.json`: prompts completos de generación y sus referencias, en el orden usado para cada imagen.
- `preview.html`: vista previa sin conexión, con tamaños de 64, 96 y 128 px y distintos fondos para revisar la transparencia.
- `references/`: documento de aprendizajes e imágenes de referencia.
- `checksums.sha256`: hashes de los archivos del paquete, excepto este mismo listado.

## Insignias

| `badge-plantas-semillas` | Las plantas y las semillas | Curiosidad que florece | Girasoles |
| `badge-plastilina-casera` | La plastilina casera | Crear juntas | Manos modelando plastilina |
| `badge-museo-taxidermia` | El museo y la taxidermia | Mirar de cerca | Lupa con diente de tiburón |
| `badge-pinguinos-adaptacion` | Pingüinos: cómo se adaptan los seres vivos | Cuidar la vida | Pingüino protegiendo su huevo |
| `badge-tierra-movimientos` | La Tierra y sus movimientos | Imaginar para comprender | Telescopio, luna y estrellas |
| `badge-plantas-origen` | Plantas: su origen | Detenerse a descubrir | Hoja bajo una lupa |
| `badge-jerry` | Jerry · Compañero | Compañero de aventuras | Jerry con un corazón |
| `badge-rocky` | Rocky · Compañero | Siempre contigo | Rocky con aureola y camisa azul |

Los IDs de `learningId` son los identificadores propuestos en este paquete. Si tu configuración usa otros, cambia su correspondencia en tu JSON del juego. Jerry y Rocky tienen `learningId: null` y `role: "companion"`.

## Ubicación en el proyecto

Los PNG están organizados exactamente en **`assets/ui/badges/`**.

En un proyecto que sirve archivos estáticos desde `public/`, copia la carpeta `assets/` del paquete dentro de `public/`. Así quedan `public/assets/ui/badges/` y `public/assets/assets.json`, y las URLs del navegador empiezan en `/assets/`.

Si ya tienes un `assets.json` general, integra las ocho entradas del arreglo `assets` según su contrato actual. Este archivo documenta el contrato del paquete; conserva los demás assets y sus identificadores en tu índice existente.

`file` es relativo a la carpeta que contiene `assets.json`: por ejemplo, `ui/badges/badge-jerry.png`. `url` es la ruta pública correspondiente: `/assets/ui/badges/badge-jerry.png`.

Los documentos y referencias de la raíz son material de trabajo del paquete; para usar las imágenes en el juego basta la carpeta `assets/`. `generationPrompts` y `sourceDocument` son rutas de documentación del ZIP, no recursos necesarios para renderizar las insignias.

## Dimensiones, transparencia y estados

Los ocho PNG tienen **1254 × 1254 px**, modo **RGBA** y transparencia real fuera del medallón. Se conservan los bytes originales: no se recortaron ni reescalaron. La retícula aproximada de 64 × 64 descrita en los prompts es una intención visual, no el tamaño físico del archivo exportado.

Cada entrada incluye dimensiones, rectángulo ocupado (`alphaBounds`), tamaño en bytes y hash SHA-256. El tamaño de presentación sugerido es 64 × 64 px; se pueden mostrar también a 96 o 128 px.

Son imágenes estáticas: `frames: 1` y `animations: []`. Los textos se ponen encima o al lado desde la interfaz. Puedes animar escala, brillo o posición desde el juego usando el PNG completo.

Para mantener los bordes pixelados en HTML/CSS:

```css
.badge-image {
  width: 64px;
  height: 64px;
  object-fit: contain;
  image-rendering: pixelated;
}
```

## Ejemplo de carga desde el índice

```js
const assetsBase = '/assets/';
const manifest = await fetch(`${assetsBase}assets.json`).then(response => {
  if (!response.ok) throw new Error('No se pudo cargar el índice de assets');
  return response.json();
});

const badge = manifest.assets.find(asset => asset.id === 'badge-jerry');
const src = `${assetsBase}${badge.file}`;
// Usa src en un <img> o en el cargador de texturas del juego.
```

Si el sitio se sirve bajo una subruta, usa esa base en `assetsBase`, por ejemplo `/bitacora/assets/`. En ese caso construye la URL con `file` en vez de usar el campo `url` tal cual.

Para Phaser, usa `textureKey` como clave de la imagen y la ruta formada con `file` como origen. Las dimensiones sugeridas y `origin` son indicaciones de presentación; el índice no aplica cambios automáticamente al motor.

## Vista previa y procedencia

Abre `preview.html` después de extraer el ZIP. No requiere servidor ni recursos externos. Los controles cambian solo la presentación; no modifican los PNG.

En `generation-prompts.json` cada entrada enlaza con su asset mediante `assetId` y `promptId`. Los prompts están en inglés tal como se usaron y las rutas de referencia se normalizaron para apuntar a los archivos incluidos. El archivo de Jerry usa la imagen exacta seleccionada como fuente (`references/jerry-source.png`).

La insignia de escucha activa original está en `references/active-listening-badge.png` como referencia de estilo y no se cuenta entre las ocho insignias del índice. El documento y las referencias se conservan sin cambios.

## Rocky · Versión 1.1.0

Se añadió `assets/ui/badges/badge-rocky.png`, con pelaje café, camisa azul con cuadros blancos, aureola dorada y boquita abierta con una lengüita tierna como la de Jerry. Su clave de textura es `badge-rocky` y pertenece a `companionBadges`.

El PNG conserva el tamaño y la transparencia de la generación, sin recorte ni reescalado. Las referencias están en `references/rocky-source.png`, `references/rocky-spritesheet.png` y `references/rocky-badge-initial.png`. Los prompts completos de generación y edición, realizados con `image_gen.imagegen`, están en `generation-prompts.json`. El índice, la vista previa y los hashes están actualizados. La insignia inicial se conserva como referencia de procedencia; el asset activo es la versión final con la boquita abierta.

## Integridad

Desde la carpeta extraída puedes comprobar todos los archivos con:

```sh
sha256sum -c checksums.sha256
```

Los hashes de cada PNG también aparecen en `assets/assets.json`.
