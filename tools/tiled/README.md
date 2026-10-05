# Editar los mapas con Tiled

Tiled (<https://www.mapeditor.org/>, versión 1.12 o posterior) es el editor visual de los **datos espaciales** de las zonas: dónde
están las plantas animadas, las gallinas, las estaciones, los puntos de aparición, los portales y las colisiones. Es solo una
herramienta de autoría: el juego, el build y el importador **no necesitan Tiled instalado**.

```text
editar en Tiled  →  npm run tiled:import  →  public/config/maps.json (maps y placements)  →  recargar la página
```

El contenido (textos, `route`, insignias, diálogos, interfaz) sigue en `public/config/bitacora.json` —que la importación no toca nunca— y los recursos en
`public/assets/assets.json`; Tiled no los toca. Las decisiones de diseño están en `.claude/SPEC.md` §12.9.

## 1. Abrir el proyecto y elegir la zona

1. En Tiled: **File › Open File or Project…** y elige `tools/tiled/bitacora.tiled-project`.
2. Abre el mapa de la zona desde el panel *Project*: `maps/zona-a.tmj` o `maps/zona-b.tmj` (uno por zona).
3. Para colocar objetos nuevos usa el tileset `tilesets/catalogo.tsj` (se abre solo con los mapas).

El proyecto define las clases de objeto (`Station`, `Ambient`, `Critter`, …) y sus propiedades. Las rutas del proyecto son relativas:
nada depende de una carpeta personal.

## 2. Qué se edita en Tiled y qué no

| Capa | Qué contiene | Se edita |
| --- | --- | --- |
| `horizonte`, `terreno`, `medio`, `primer-plano` | Capas de imagen del paisaje (propiedades `assetId` y `depth`) | Bloqueadas. Cambiar de imagen se hace con `assetId` en `maps.json`. No las muevas ni les cambies la opacidad: se rechaza. |
| `ambiente` | Plantas y luces animadas, nubes, patos (`Swim`) y áreas de partículas (`Particles`) | Sí |
| `animales` | Gallinas y familias | Sí |
| `decoraciones` | Imágenes estáticas (`maps[zona].decorations`; hoy vacía) | Sí |
| `estaciones` | Una estación por aprendizaje activo | Mover y ajustar interacción; no se borran |
| `puntos` | Puntos de aparición (`Spawn`) y portales (`Portal`) | Sí |
| `colisiones` | Rectángulos y círculos (`Collision`) | Sí |

**La clase del objeto decide su destino, no la capa** (los nombres de capa son solo orden). Un rectángulo sin clase en `colisiones`
se toma como `Collision`. El orden de cada colección es el de los objetos en su capa; los nuevos se añaden al final.

Se configura **fuera** de Tiled: el contenido de cada aprendizaje, el orden del recorrido (`route`), la escala de los letreros
(`gameplay.signScale`), los assets del manifiesto y los textos de la interfaz. Los letreros, títulos, números, brillos y estados
de las estaciones los dibuja el juego; en Tiled solo se ve el letrero y el nombre.

## 3. Colocar, mover, duplicar, eliminar y escalar

- **Colocar:** elige un tile del catálogo y usa la herramienta *Insert Tile* (**T**) sobre la capa. El objeto hereda la clase y el
  asset del tile y su tamaño es el del juego (escala 1). Los patos, las partículas, los puntos, los portales y las colisiones se
  dibujan con las herramientas de polilínea, rectángulo, punto y elipse, y se les asigna su **clase** (*Class*) en el panel de propiedades.
- **Mover:** arrastra con *Select Objects* (**S**). El punto de anclaje de cada objeto (los pies de una planta, el poste de un
  letrero) lo calcula el importador a partir del origen del manifiesto: no hay que hacer nada.
- **Duplicar:** copiar y pegar (**Ctrl/Cmd+C, V**) o *Duplicate Objects*. La copia conserva clase, propiedades y tamaño.
- **Eliminar:** *Delete*. Quitar un efecto o una gallina quita la instancia, no el asset del catálogo.
- **Escalar:** redimensiona el objeto-tile manteniendo la proporción (mantén **Mayús**); la escala se deduce del tamaño. Si el ancho y el
  alto difieren menos de un 5 % se importa la media con un aviso; más que eso es un estiramiento y se rechaza. Las gallinas (y sus pollitos)
  no pasan de 4× su tamaño recomendado (≈ 192 px), con un radio de hasta 120 px y hasta 8 pollitos. Los letreros **no** se redimensionan uno a uno (escala global `gameplay.signScale`). No uses rotación ni
  reflejo vertical; el reflejo horizontal solo vale en animaciones y gallinas sueltas (equivale a `flipX`).
- **Estaciones:** mover una estación mueve también su punto de interacción (`position` + desplazamiento). Si quieres retirar un
  aprendizaje del recorrido, **primero archívalo**: quítalo de `route` en `bitacora.json` (sus textos e insignia se conservan) y después borra su
  estación en Tiled (su ubicación sigue guardada en `placements`). Borrar la estación de un aprendizaje que sigue en `route` se rechaza, y una
  estación de un aprendizaje archivado también. Una estación activa tiene que estar exactamente una vez entre los mapas.
- **Guías:** si necesitas objetos auxiliares solo para ti, ponles la clase `EditorOnly` (o pon la propiedad `editorOnly` a una capa):
  el importador los ignora. Ocultar o bloquear una capa para trabajar **no** quita sus objetos del juego.

## 4. Propiedades de cada clase

Los valores por defecto vienen de la clase del proyecto; el tile y el propio objeto pueden cambiarlos (el objeto manda). Las propiedades
**opcionales** se añaden con **+** solo cuando se necesitan.

| Clase | Propiedades | Opcionales |
| --- | --- | --- |
| `Station` (tile de letrero) | `learningId`, `interactionOffsetX/Y`, `interactionRadius` | `signAssetId`, `decorationAssetId`, `decorationOffsetX/Y` ¹ |
| `Ambient` (tile) | `ambientType` (animation, sway, drift, glow; lo fija el asset), `depthMode` (`y` o `fixed`), `depth` (desplazamiento o valor fijo) | `alpha`, `speedFactor` (solo animaciones) |
| `Particles` (rectángulo) | `assetId`, `frequencyMs`, `depthMode`, `depth` | `scale` |
| `Swim` (polilínea, al menos 2 puntos, en orden) | `assetId`, `depthMode`, `depth` | `scale`, `speedFactor` |
| `Critter` (tile) | `critterType` (`wander` o `family`), `radius`; familia: `chickAssetId`, `chicks` | `chickScale` |
| `Decoration` (tile) | `originX`, `originY`, `depthMode`, `depth` | — |
| `Collision` (rectángulo o elipse con ancho = alto) | — | — |
| `Spawn` (punto) | `spawnId` (el mapa lleva `initialSpawnId`) | — |
| `Portal` (elipse circular centrada en el punto de interacción; su diámetro es 2 × el radio) | `portalId`, `label`, `targetZoneId`, `targetSpawnId` | — |

Propiedades del mapa: `zoneId`, `label`, `initialSpawnId`. ¹ El juego conserva y valida `decorationAssetId`/`decorationOffset`,
pero hoy no los dibuja.

`explicit` (texto, p. ej. `scale,flipX`): la escala y el reflejo salen del tamaño y del tile, así que un `scale: 1` o un `flipX: false`
*explícitos* en `maps.json` se anotan aquí para no perderse. No hace falta tocarla.

## 5. Guardar, importar, resolver errores y probar en la web

```bash
npm run dev               # importa SOLO al guardar en Tiled y recarga la página; los errores salen sobre la página
npm run tiled:import      # lee los mapas, valida y reescribe maps.json (maps y placements)
npm run tiled:check       # lo mismo sin escribir; falla si los mapas y maps.json difieren (el build lo ejecuta antes)
npm run tiled:watch       # el mismo importador automático, sin servidor de desarrollo (en otra terminal)
```

**Con `npm run dev` abierto no hace falta ejecutar nada**: al guardar en Tiled se importa y la página se recarga sola, igual que la
«exportación automática al guardar» de un flujo normal de Phaser y Tiled. Si hay un error, aparece como aviso sobre la página (y en la
terminal) y desaparece al corregirlo; `maps.json` no se toca mientras tanto. Al arrancar el servidor también se importa lo que hayas
guardado con él apagado. Se desactiva con `TILED_WATCH=0`.

1. Guarda en Tiled (**Ctrl/Cmd+S**). Con `npm run dev` abierto se importa solo; sin él, ejecuta `npm run tiled:import` (o deja `tiled:watch`).
2. La página **se recarga sola** cuando cambia `maps.json` (o `bitacora.json`). La escena no se actualiza en caliente.
3. Si algo no se puede representar, no se escribe nada y el mensaje dice dónde está:
   `zona-a.tmj › capa «animales» › objeto #57 «white» › propiedad «radius»: debe ser un número (es string)`.
   Corrígelo en Tiled y vuelve a importar. Los errores de validación del proyecto (portal que apunta a un spawn inexistente, objeto fuera de la
   zona, colocación sobre suelo transitable…) llevan además la ruta de `maps.json`.
4. **Si no ves el cambio en el juego**, la importación probablemente falló: con `npm run dev` el error aparece sobre la página; si no, ejecuta
   `npm run tiled:import` y lee el mensaje (guardar en Tiled no actualiza `maps.json` si no corre `npm run dev`, `tiled:watch` o `tiled:import`). Las causas más comunes: un tamaño
   por encima del máximo (una gallina no pasa de 4×) o un reflejo accidental al mover un objeto (la tecla **X** en Tiled lo voltea horizontalmente): una familia de gallinas, una planta
   que se balancea o un letrero no admiten reflejo; se deshace con *Objects › Flip Horizontally* (**X** otra vez). Mientras haya un error, nada se
   escribe en `maps.json`.
5. Cada importación que escribe deja una copia del `maps.json` anterior en `tools/tiled/backups/` (`<fecha>-maps.json`) (se conservan las últimas 20).

Un guardado sin cambios no escribe nada. Importar solo toca `maps` y `placements` y deja el resto del archivo igual, byte a byte.

### Ejemplo reproducible con un objeto real

Mover la estación `apr-a` (Plantas y semillas) hacia la derecha:

1. Abre `maps/zona-a.tmj`, capa `estaciones`, y selecciona el letrero «apr-a · Plantas y semillas».
2. Arrástralo ~60 px a la derecha y guarda.
3. `npm run tiled:import` → imprime `✔ placements.apr-a: cambió position`.
4. Recarga la página: el letrero y su punto de interacción están 60 px más a la derecha; `route`, textos y progreso siguen igual.

Sin abrir Tiled, `npx tsx scripts/tools/tiled-example.ts` hace sobre una copia temporal esta edición (y duplicar una gallina, agrandar un
girasol y añadir una colisión), importa y escribe el `maps.json` resultante; `node scripts/e2e/tiled.mjs` lo comprueba en el navegador.

## 6. Actualizar el catálogo al añadir assets

Al añadir assets al manifiesto (siempre añadiendo entradas, nunca cambiando las existentes):

```bash
npm run tiled:catalog     # catálogo, previews y clases del proyecto; no toca los mapas
```

Solo entran los assets colocables según las mismas reglas que valida el juego (`kind` y `motion`); la interfaz y la música no. Los
IDs de tile son estables: añadir un asset no cambia los objetos ya colocados. Si un asset deja de ser colocable, su tile se conserva
marcado `obsolete` (Tiled sigue dibujándolo) y el importador pide sustituirlo. Los enums de assets del proyecto (partículas, patos,
animales) también se actualizan; los tipos propios que añadas al proyecto se respetan.

## 7. Recuperar la migración inicial y evitar sobrescribir ediciones

- `npm run tiled:generate` **solo crea** los mapas que no existen. Para regenerar uno desde `maps.json` hay que pedirlo
  (`npm run tiled:generate -- --force --zone zona-a`), y antes se guarda una copia en `tools/tiled/backups/<fecha>-mapas/`.
- Mientras `maps.json` y los mapas estén sincronizados, `--force` reproduce lo mismo. Si editaste en Tiled **sin importar**, lo que
  no se importó se pierde al regenerar (queda la copia).
- La migración inicial vive en el historial de Git: `git log -- tools/tiled/maps` y
  `git checkout <commit> -- tools/tiled/maps public/config/maps.json`.
- `tools/tiled/legacy/` guarda el trabajo manual anterior a la integración (TMX de `zona-a` y un catálogo de prueba cuyo único tile tenía
  un `assetId` mal escrito, `decoration.plant.busht`). No se importa.
- `*.tiled-session` es estado personal del editor y está en `.gitignore`.

## 8. Qué se ve distinto en Tiled y en el juego

- Plantas, luces y gallinas se muestran como su primer fotograma (el juego las anima; las gallinas merodean, no están fijas en su punto).
- Las partículas son un rectángulo y los patos una línea; las nubes no se desplazan; las luces no pulsan; no hay sombras.
- Los letreros no llevan título, número, brillo ni estado (los dibuja el juego según el progreso).
- El portal es su círculo de interacción: el juego dibuja el cartel desplazado y pegado al borde del mapa.
- Los previews están reducidos al tamaño visual del juego con un promedio de área; el juego usa filtrado `nearest`.
- Las capas se ordenan en Tiled por su posición en la lista; el juego usa `depth` (fijo o por `y`).
- La cuadrícula de 2 px es una ayuda del editor; la navegación del juego usa su propia rejilla y las colisiones exactas.

## Comprobar que Tiled abre los archivos (opcional)

```bash
npm run tiled:cli-check   # usa la CLI de Tiled si está instalada
```

La CLI se busca en la variable `TILED_BIN`, en el `PATH` (`tiled`) y en las rutas habituales (macOS: `/Applications/Tiled.app/Contents/MacOS/tiled`;
Windows: `C:\Program Files\Tiled\tiled.exe`). Si no está, el comando lo dice y termina sin error. Con ella también se puede renderizar un mapa:
`tmxrasterizer --ignore-visibility tools/tiled/maps/zona-a.tmj /tmp/zona-a.png`.

## Limitaciones

- No se admiten rotaciones, escalas no uniformes, reflejos verticales, polígonos ni rectángulos rotados como colisión, capas de teselas,
  plantillas de objetos ni parallax (se rechazan al importar con su ubicación).
- Los letreros comparten una escala global; redimensionar uno exigiría un campo nuevo en `placements` y en `Station`.
- Los mapas son `.tmj` y el catálogo `.tsj` (JSON). Un `.tmx` en `maps/` se ignora con un aviso.
- Este flujo se probó con Tiled 1.12.2 mediante su CLI (abre, vuelve a guardar y renderiza ambos mapas); el manejo con la interfaz
  gráfica (sellos, atajos) no se ha verificado a mano.
