# Assets · Bitácora Amorcito

Paquete con las **45 imágenes originales**, renombradas y organizadas por función.
Se conservaron también los cuatro documentos de los paquetes anteriores.
No se recortó, redimensionó, recoloreó ni volvió a guardar ninguna imagen.
Las dimensiones, el formato, la transparencia y los bytes son los originales.
Todas las variantes se mantienen; no hay archivos de imagen eliminados.

## Estructura

```text
assets/
├── assets.json
├── asset-renames.csv
├── README.md
├── backgrounds/
│   ├── complete/
│   ├── zone-01/
│   └── zone-02/
├── characters/
│   ├── vanessa-jerry/
│   │   └── pose-sheets/
│   └── portraits/
├── stations/
│   ├── items/
│   └── signs/
├── ui/
│   ├── badges/
│   ├── buttons/
│   ├── icons/
│   ├── panels/
│   ├── progress/
│   └── titles/
├── decorations/foliage/
├── effects/glow/
├── references/ui/
└── docs/source/
    ├── ui/
    └── v4/
```

| Carpeta | Imágenes |
| --- | ---: |
| `backgrounds/` | 14 |
| `characters/` | 7 |
| `decorations/` | 1 |
| `effects/` | 1 |
| `references/` | 2 |
| `stations/` | 7 |
| `ui/` | 13 |

No se crearon categorías vacías: no se recibieron imágenes independientes de Vanessa,
Jerry, pestañas, partículas ni otras decoraciones.

## Índice y rutas

`assets.json` contiene un objeto `assets` indexado por **IDs estables**.
Cada entrada registra la ruta, categoría, tipo de recurso, dimensiones reales,
presencia de canal alfa, transparencia efectiva, tamaño, SHA-256 y ruta original.
`type` es `image`; `kind` distingue capas, hojas de poses, iconos, paneles y otros usos.

Las rutas son relativas a esta carpeta `assets/`, no al directorio del proyecto.
Los nombres de archivo están en inglés, en minúsculas, con guiones y sin espacios ni tildes.
Los textos dentro de las imágenes permanecen en su idioma original.

Ejemplo de una entrada:

```json
{
  "effect.player.glow": {
    "path": "effects/glow/player-glow.png",
    "type": "image",
    "kind": "glow",
    "width": 480,
    "height": 288,
    "transparent": true
  }
}
```

Puedes copiar esta carpeta a `public/assets/` en tu proyecto React + Vite.
Entonces se consulta `/assets/assets.json` y se usa `/assets/` como prefijo de la ruta:

```js
const catalog = await fetch('/assets/assets.json').then(response => response.json());
const glow = catalog.assets['effect.player.glow'];
const glowUrl = `/assets/${glow.path}`;
```

El índice sirve para buscar recursos por ID. La ruta de aprendizajes, los contenidos,
las posiciones de estaciones y el progreso siguen en la configuración de la aplicación.
Los objetos se nombraron por su contenido, sin vincularlos a números fijos de estación.

## Fondos y variantes

`backgrounds/complete/garden-landscape.png` es el paisaje completo original.
Las otras 13 imágenes son capas y alternativas de fondos.

| Grupo | Criterio visual |
| --- | --- |
| `zone-01` | Pradera con puentes, jardín con cerezo, pueblo a la derecha y follaje superior izquierdo. |
| `zone-02` | Pradera del mapa 2, jardín con pabellón, pueblo a la izquierda y follaje superior derecho. |

La agrupación de zonas se infirió de los nombres y el contenido visual.
Los sufijos `v01`, `v02` y `v03` distinguen archivos, sin elegir una variante como definitiva.
Los campos `layer` indican horizonte, terreno, capa intermedia o primer plano.
No se ha validado que todas las capas encajen exactamente al superponerlas.
Dos variantes de follaje miden 1447 × 1087; las demás capas miden 1448 × 1086.
Se conservaron esos tamaños, sin ajustar las imágenes.

## Personajes y hojas de poses

El personaje estático y el retrato permanecen como imágenes individuales.
Las cinco hojas de poses se agrupan en `characters/vanessa-jerry/pose-sheets/`.
Incluyen tres variantes de movimiento, una de celebración/salto y una de espera/expresiones.

`visualLayout` y `poseCount` describen la disposición observada de los dibujos.
**No son un atlas de animación validado**: no se inventaron dimensiones de frame,
márgenes, velocidades ni coordenadas de recorte.
`requiresFrameDefinition: true` indica que hay que definir los frames antes de cargarlos
como animaciones en Phaser. Se pueden cargar como imágenes de referencia inmediatamente.

## UI

Los botones verde normal y hover tienen IDs separados.
El panel `ui.panel.cream.nine-slice` conserva el margen de 32 px indicado en el LEEME original.
El relleno de XP se ubica a x = 16, y = 20 respecto al marco, según ese mismo documento.
La barra de ejemplo es una composición estática al 64 %.
Para representar progreso real, usa el marco y recorta el ancho visible del relleno.

`references/ui/` contiene el mockup del layout y la vista previa originales; se indexan
como referencias, sin tratarlos como elementos individuales de la interfaz.

