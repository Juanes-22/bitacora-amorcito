# SPEC.md — Bitácora interactiva de Vanessa Estrada

**Documento:** especificación funcional y técnica; fuente de verdad de los requisitos.  
**Stack:** React + Vite + TypeScript + Phaser.  
**Revisión documental:** 9. La revisión 9 añade (a) las piezas adicionales del paisaje (`bitacora-landscape-extras`: luces del árbol, patos, nubes y partículas luminosas; §3.2) y (b) la música de fondo con rotación de pistas y control de encendido/apagado (§6.4, §14), con los criterios AC-47 a AC-54. La revisión 8 (a) añade el kit de animaciones del paisaje (§3.2), el encuadre y la escala visual (§6.3, §14) y los criterios AC-37 a AC-46; y (b) alinea el contrato de §12.4 y el puente de §11.5 con lo ya implementado en las fases 1 a 4. El contrato de assets se adapta al `assets.json` real entregado por el usuario. Ese manifiesto existente es autoritativo: conserva sus IDs, `pathConvention`, `path`, categorías, `kind`, dimensiones, transparencia, procedencia y metadatos específicos; no se reemplaza por un esquema inventado.  
**Estado:** requisitos definidos para implementar; este documento no acredita funcionalidades construidas ni pruebas ejecutadas.

<a id="spec-0"></a>

## 0. Propósito y autoridad de los documentos

Este archivo define **qué debe hacer la bitácora, cómo debe comportarse, sus límites y los contratos que debe respetar**. La arquitectura, los modelos de datos y los criterios de aceptación se definen aquí una sola vez.

| Archivo | Responsabilidad |
|---|---|
| `.claude/SPEC.md` | Requisitos, comportamiento, arquitectura, contrato JSON, progreso, restricciones y resultados de aceptación. |
| [`.claude/PLAN.md`](PLAN.md) | Orden de implementación, tareas, dependencias, estrategia de pruebas y registro de avance/evidencias. |
| `public/config/bitacora.json` | Datos y parámetros de la experiencia: contenido, recorrido, mapas, diálogos, insignias y referencias por `assetId`. |
| `public/assets/assets.json` | Manifiesto gráfico existente y autoritativo. Indexa archivos con IDs estables, rutas relativas al propio manifiesto y metadatos técnicos/visuales disponibles. No define contenido, recorrido ni progreso. |
| `bitacora.example.json` | Ejemplo de configuración de demostración, no sustituto de los requisitos ni evidencia de un juego implementado. |
| `README.md` | Documentación operativa del código implementado: instalación, ejecución, edición y despliegue. Se redacta durante la implementación. |

Ante una discrepancia documental, `SPEC.md` prevalece sobre `PLAN.md` y los ejemplos. Un cambio solicitado por el usuario debe actualizar primero la especificación y después las tareas afectadas; no cambiar un requisito solo para dar una tarea por terminada. El ejemplo no fija coordenadas, distribución o cantidades como restricciones del motor.

Los nombres de estos archivos son convenciones del proyecto: no ejecutan instrucciones ni garantizan que otra IA los lea automáticamente. La instrucción de trabajo debe pedir leer primero `.claude/SPEC.md` y después `.claude/PLAN.md`. Mantener ambos dentro de `.claude/` en la raíz del repositorio.

No registrar casillas de avance en esta especificación. Mantener en `PLAN.md` la ejecución y sus pruebas, sin copiar allí los contratos ni las tablas de resultados esperados.

<a id="spec-0-1"></a>

### 0.1. Decisiones confirmadas

| Aspecto | Decisión |
|---|---|
| Experiencia | Bitácora universitaria recorrida como un minijuego de exploración pixel art. |
| Organización | Aprendizajes o temas, nunca clases. Seis estaciones iniciales en dos zonas; cantidad, distribución y orden configurables. |
| Configuración | `bitacora.json` define la experiencia; el `assets.json` existente indexa los recursos gráficos. `bitacora.json` referencia sus IDs reales sin duplicar rutas o metadatos. |
| Terreno | Imágenes de fondo y objetos independientes. No exigir tileset ni Tiled. |
| Recorrido | El arreglo `route` define las estaciones activas y su orden; `placements` define sus ubicaciones. |
| Paso entre zonas | Tránsito libre por portales explícitos de ida y regreso; el bloqueo secuencial se aplica a la lectura. |
| Juego | Phaser: escenario, personajes, entrada, colisiones, cámara y animaciones. |
| Lectura e interfaz | React y HTML/CSS: portada, ventanas, pestañas, evidencias, controles accesibles y progreso. |
| Reglas | Un único módulo de dominio TypeScript para lectura, desbloqueos y recompensas. |
| Arte | Reutilizar los assets existentes de Vanessa, Jerry, mapa, interfaz y decoraciones. |
| Alcance inicial | Sin backend, cuentas, multijugador, editor visual de contenidos ni migración a Godot. |
| Escala visual | Encuadre «cover» con zoom acotado y centrado de respaldo; personaje y letreros más grandes; interfaz proporcional a la ventana (§6.3, §14). |
| Animación ambiental | Kit del usuario indexado en `assets.json` y colocado por `maps[].ambient` (§3.2). |
| Publicación | Preparar una compilación web; el destino y la visibilidad se decidirán aparte. No publicar sin autorización. |

<a id="spec-1"></a>

## 1. Encargo y objetivo

Implementa una página web que presente la bitácora de **Vanessa Estrada**, estudiante de **Licenciatura en Educación Infantil en la Universidad de Antioquia**, para la asignatura **Desarrollo de la actitud científica en la infancia**, correspondiente al semestre **2026 - 2**. La experiencia debe funcionar como un pequeño videojuego de exploración en pixel art: el visitante controla el personaje de la estudiante, acompañado por su perrito Jerry, recorre un mapa, entra a estaciones de aprendizaje, lee sus contenidos, obtiene insignias y desbloquea el siguiente aprendizaje.

**La organización es por aprendizajes o temas, nunca por clases.** Una estación puede reunir experiencias de diferentes momentos de la asignatura. No uses «Clase 1», «Clase 2» ni una estructura cronológica obligatoria, tampoco en los modelos de datos.

No construyas únicamente una imagen interactiva ni una página de tarjetas con decoración de videojuego. Debe existir movimiento real del personaje, detección de proximidad, interacción, estados de progreso y persistencia. Aun así, la lectura y la reflexión académica son lo principal: el juego es la forma de recorrerlas.

El contenido definitivo está pendiente. Construye una estructura editable y una demostración claramente identificada, sin inventar experiencias personales, fechas, citas o requisitos de la universidad.

### Datos académicos confirmados

| Campo | Valor |
|---|---|
| Estudiante | **Vanessa Estrada** |
| Universidad | **Universidad de Antioquia** |
| Programa | **Licenciatura en Educación Infantil** |
| Semestre | **2026 - 2** |
| Asignatura | **Desarrollo de la actitud científica en la infancia** |
| Docente | No informado |

Precarga estos datos en `project` dentro de `public/config/bitacora.json` y mantenlos editables desde un único lugar. No conserves otra copia de esos valores en `project.ts` o en componentes. El nombre confirmado de la asignatura es «Desarrollo de la actitud científica en la infancia»: utiliza esa denominación exacta. El nombre de la docente sigue sin informarse; no lo inventes. Los contenidos de los aprendizajes aún están por definir y no deben deducirse como un programa oficial a partir del nombre de la asignatura ni del ejemplo sobre plantas y semillas. Estos pendientes no deben impedir desarrollar ni probar el recorrido.

En la portada, presenta el título de la bitácora y el nombre de la asignatura, «Desarrollo de la actitud científica en la infancia», junto con Vanessa Estrada, el programa, la Universidad de Antioquia y el semestre 2026 - 2. Muestra la asignatura tanto en demostración como en la versión final; permite que su nombre ocupe varias líneas en pantallas pequeñas sin recortarlo. Omite el campo de docente mientras siga vacío. No muestres `null`, `undefined` ni espacios vacíos reservados para ese campo.

Configuración académica inicial: este es solo el bloque `project` del JSON completo.

```json
{
  "title": "Mi bitácora — Un recorrido de aprendizajes",
  "studentName": "Vanessa Estrada",
  "university": "Universidad de Antioquia",
  "program": "Licenciatura en Educación Infantil",
  "semester": "2026 - 2",
  "courseName": "Desarrollo de la actitud científica en la infancia",
  "teacherName": null,
  "welcomeText": "Cada experiencia deja una semilla. Acompáñame a recorrer los aprendizajes, las preguntas y las reflexiones que han ido dando forma a mi camino como futura maestra.",
  "finalReflection": []
}
```

El texto de bienvenida es provisional. `finalReflection` recibe bloques de contenido cuando Vanessa aporte su cierre; una lista vacía no autoriza a inventarlo.

El título de la pestaña del navegador puede ser «Mi bitácora | Vanessa Estrada». La identidad del personaje y del retrato corresponde a Vanessa; el visitante la acompaña en su recorrido, no necesita registrarse ni introducir otro nombre.

<a id="spec-2"></a>

## 2. Temática y tono

Título de trabajo: **Mi bitácora — Un recorrido de aprendizajes**.

La temática es el crecimiento de una futura maestra a través de la exploración, la experiencia, las preguntas y la reflexión. El mapa representa un recorrido formativo; las estaciones, aprendizajes significativos; las insignias, los temas recorridos.

El entorno visual debe sentirse como un jardín o bosque acogedor de un pequeño RPG: senderos, plantas, árboles, letreros de madera, libros, semillas y objetos vinculados a los temas. No hay enemigos, combate, vidas, penalizaciones, cronómetros ni competencia.

La naturaleza funciona como ambientación y metáfora del crecimiento. **No asumir que toda la asignatura es de botánica o plantas:** el texto sobre semillas es una muestra de contenido, no el programa completo.

El tono debe ser personal, cálido y reflexivo, apropiado para una entrega universitaria. No infantilizar la voz de la autora por estudiar Educación Infantil. El visitante recorre los aprendizajes de la estudiante; no está rindiendo un examen ni obteniendo una certificación profesional.

Texto provisional de bienvenida:

> Cada experiencia deja una semilla. Acompáñame a recorrer los aprendizajes, las preguntas y las reflexiones que han ido dando forma a mi camino como futura maestra.

<a id="spec-3"></a>

## 3. Identidad visual y assets existentes

Ya existen assets de la interfaz, del personaje y de elementos decorativos. Deben ser la fuente principal del diseño. Antes de implementar, inspecciona los archivos disponibles, identifica sus dimensiones y documenta qué contiene cada uno. Los nombres sugeridos en esta guía son identificadores lógicos, no archivos cuya existencia esté confirmada.

Conserva las ventanas crema con bordes redondeados, botones verdes, letreros de madera y decoraciones vegetales. Utiliza los assets existentes de estrella, insignia, libro abierto, barra de XP y resplandor amarillo/naranja donde correspondan.

El personaje representa a **Vanessa Estrada** y está acompañado por **Jerry, un chihuahua blanco**. Respeta el aspecto de los assets: cabello base `#795042`, iluminaciones `#c68864`, aretes y piercing side labret derecho sutil, cuando esos detalles sean visibles en la resolución del sprite. No redibujes el personaje ni cambies su identidad para adaptarlo al código.

Distingue los assets del personaje movible y el retrato del panel de progreso. Si un sprite ya incluye a Jerry, no añadas un segundo perro. Si ambos están separados, Jerry puede seguir posiciones anteriores del recorrido del personaje, manteniendo una distancia corta y sin bloquear al jugador.

No asumas que una imagen es un spritesheet regular. Comprueba márgenes, separaciones, tamaño de celdas, orden de fotogramas, fondo y transparencia. Una referencia «48 × 48» no garantiza que el archivo entregado tenga esas dimensiones exactas.

Usa el `assets.json` existente como manifiesto gráfico autoritativo. No lo rediseñes para adaptarlo a una interfaz teórica. Sus recursos se identifican por las claves reales de `assets`, y sus archivos se resuelven mediante `path` respetando `basePath` y `pathConvention`. `bitacora.json` solo referencia esos IDs mediante `assetId`; no repite rutas físicas, dimensiones, hashes ni metadata visual. Cuando un recurso declara `requiresFrameDefinition: true`, trátalo como una hoja de poses pendiente de definición de frames: `visualLayout`, `poseCount` y `rowDirections` describen la composición observada, pero no autorizan a inventar `frameWidth`, `frameHeight` ni una cuadrícula Phaser. Si faltan definiciones de animación, usa una pose estática disponible como respaldo documentado o añade una definición derivada de una inspección real del archivo.

No reflejes automáticamente sprites asimétricos si eso cambia detalles importantes de la identidad. Los estados previstos son reposo, caminar y celebrar; usa salto u otras poses únicamente si están disponibles.

Para las imágenes pixel art, utiliza `image-rendering: pixelated`, conserva proporciones y prioriza escalas enteras cuando el espacio lo permita. Verifica el resultado en diferentes tamaños y niveles de zoom: esa propiedad no sustituye la revisión visual. [T3]

Los párrafos deben ser texto HTML seleccionable y accesible, nunca texto incrustado en imágenes. Usa una fuente legible para lecturas extensas; reserva la estética pixel para títulos, etiquetas y controles. No estires una ventana ilustrada para contener textos largos: compón sus bordes, usa segmentos o una superficie CSS compatible con el asset.

En Phaser, registra como texturas las imágenes resueltas desde `assets.json`. Crea animaciones solo cuando exista una definición de frames validada a partir del archivo real; el manifiesto actual no debe interpretarse como si ya contuviera spritesheets Phaser. Mantén las claves de textura ligadas a los IDs del catálogo y no registres de nuevo animaciones globales al reiniciar una zona. Configura el renderizado pixel art del motor, además del CSS de la interfaz; las opciones concretas deben coincidir con la versión instalada. [T10] [T13]

La configuración prevista es `pixelArt: true`, con redondeo de píxeles en cámara cuando proceda. No reduzcas la precisión de las posiciones físicas para lograr ese aspecto. Comprueba escala, parpadeo y nitidez con los archivos reales.

### 3.1. Catálogo `assets.json` real

`public/assets/assets.json` es un artefacto **existente** del proyecto y la fuente de verdad del inventario gráfico. La implementación debe adaptarse a su contrato actual; no generar otro manifiesto paralelo ni migrarlo de oficio a campos como `src`, `frameWidth` o `animations` que hoy no existen.

La cabecera actual incluye `version`, `project`, `basePath`, `pathConvention`, `assetCount`, `categoryCounts` y `notes`. La aplicación no necesita renderizar esos datos, pero debe respetar especialmente `pathConvention`: los valores `path` son relativos al directorio que contiene `assets.json`. `originalPath`, `sizeBytes` y `sha256` son metadata de trazabilidad/inventario; pueden ignorarse en runtime, pero deben conservarse en el archivo.

Cada entrada de `assets` usa su clave como **asset ID estable**. Ejemplos reales del catálogo incluyen `background.zone-01.terrain`, `character.vanessa-jerry.idle`, `station.sign.wooden`, `effect.player.glow`, `ui.panel.cream.nine-slice` y `ui.progress.xp.frame`. `bitacora.json` debe usar esos IDs reales en lugar de inventar alias diferentes.

Campos comunes observados en el manifiesto: `path`, `type`, `format`, `category`, `label`, `kind`, `width`, `height`, `hasAlphaChannel`, `transparent`, `sizeBytes`, `sha256` y `originalPath`. Algunos tipos añaden metadata especializada, por ejemplo `zone`, `layer`, `variant`, `state`, `nineSlice`, `placement`, `text`, `exampleFraction`, `poseCount`, `visualLayout`, `rowDirections` o `requiresFrameDefinition`. El `AssetRegistry` debe preservar esa metadata y exponer helpers tipados sin exigir que todas las entradas tengan los mismos campos opcionales.

React y Phaser consumen el mismo `AssetRegistry`. React lo usa para UI, retratos, insignias y evidencias; Phaser para capas de mapa, personaje, estaciones, efectos y decoraciones. No crear un segundo mapa de rutas en TypeScript, CSS o componentes. Las URLs de los assets locales se resuelven centralmente combinando la URL del manifiesto, su `basePath` y el `path` de la entrada según `pathConvention`.

El catálogo actual diferencia explícitamente inventario de lógica: no define estaciones activas, orden de aprendizajes, contenido académico, coordenadas ni progreso. Esos datos pertenecen a `bitacora.json` o al guardado local.

#### Hojas de poses y animaciones

Los assets de Vanessa y Jerry marcados con `kind: "pose-sheet"` y `requiresFrameDefinition: true` **no son todavía spritesheets Phaser validados**. `visualLayout` representa su disposición visual observada; `rowDirections`, cuando existe, indica la intención de las filas. Antes de crear una animación hay que inspeccionar la imagen real y definir recortes válidos (por ejemplo mediante atlas/frames explícitos o un spritesheet solo si la cuadrícula regular queda comprobada). No calcular automáticamente el tamaño de frame dividiendo `width/columns` y `height/rows` si existen márgenes, padding o composiciones irregulares.

Las definiciones de recorte/animación derivadas de esa inspección pueden vivir en una configuración técnica separada y versionada, por ejemplo `src/assets/frameDefinitions.ts` o un JSON complementario generado/validado, pero **no deben sobrescribir ni falsificar campos del `assets.json` original**. Cada definición debe referenciar el asset ID real del manifiesto.

#### Capas del mapa

El catálogo ya contiene capas diferenciadas para `zone-01` y `zone-02` mediante `zone` y `layer`, incluyendo `horizon`, `terrain`, `midground` y `foreground`, con variantes en algunos casos. `bitacora.json` debe elegir explícitamente qué IDs se usan en cada zona y su orden de profundidad; no deducir una variante por nombre de archivo ni renderizar simultáneamente todas las variantes. `background.complete.garden` puede conservarse como referencia/alternativa, pero no sustituye automáticamente la composición por capas.

#### Metadata especializada reutilizable

Cuando exista metadata útil en el catálogo, consúmela en lugar de duplicarla. Ejemplos actuales: `ui.panel.cream.nine-slice.nineSlice` define los cuatro márgenes de nueve secciones; `ui.progress.xp.fill.placement` describe su posición relativa al marco; los botones verdes distinguen `state`; los recursos de mapa declaran `zone`/`layer`; las hojas de poses declaran `poseCount` y composición visual. Si el runtime necesita información adicional que el manifiesto no contiene (por ejemplo `origin`, escala en mundo, hitbox o frames exactos), esa información pertenece a `bitacora.json` o a una definición técnica complementaria, no debe inferirse como si ya estuviera en `assets.json`.

<a id="spec-3-2"></a>

### 3.2. Animaciones del paisaje

El usuario aportó un kit de piezas ambientales (`bitacora-landscape-animations`): tres hojas animadas con atlas (ondas y reflejos de agua, cascada, espuma), tres plantas (margaritas, arbusto, copa de roble), una nube y tres partículas (hoja, pétalo, gota). **No son capas alineadas con los mapas**: son piezas reutilizables que cada zona coloca donde corresponda.

Reglas de integración:

- Los archivos se copian bajo `public/assets/` conservando sus bytes y se indexan **añadiendo** entradas a `assets.json`; las entradas existentes no se modifican y `assetCount`/`categoryCounts` se actualizan. Cada entrada nueva sigue el contrato común (`path`, `type`, `format`, `category`, `label`, `kind`, dimensiones, `sizeBytes`, `sha256`) y conserva la metadata del kit: `origin` y `recommendedScale` (punto de partida que el código consume; no se duplica en `bitacora.json`), `recommendedContentHeightPx`, `contentBounds`, `animation` (`frameNames`, `frameRate`, `repeat`) y `motion` (sugerencias de vaivén, deriva y partículas que la lógica interpreta; no son configuración de Phaser). Las claves de textura son los IDs del catálogo y las claves de animación se derivan del ID.
- Las hojas animadas se cargan con su atlas JSON (`atlasPath`, relativo al manifiesto). Su definición de frames **es** el atlas: regiones explícitas, no una cuadrícula supuesta. Se validan contra la imagen real (dentro de la imagen, sin solaparse, con contenido y coherentes con `frameCount`).
- La ubicación, la profundidad y el multiplicador de escala de cada pieza pertenecen a `maps[zona].ambient` en `bitacora.json` (§12.4). El tipo de efecto (`animation`, `sway`, `drift`, `particles`) debe ser coherente con la metadata del asset.
- Las ondas, los reflejos y la espuma se sitúan dentro del agua, sin cubrir rocas ni puentes. Las plantas van en lugares libres que no sean un camino transitable, sin cambiar colisiones ni la alcanzabilidad. La copa de roble requiere un tronco independiente: no se usa para sustituir un árbol dibujado en el fondo, por lo que puede quedar indexada sin uso.
- Todo movimiento respeta `prefers-reduced-motion`: sin bucles, vaivenes, deriva ni partículas; las hojas animadas muestran un fotograma fijo. Es movimiento ambiental: nunca altera la lógica, los controles ni la lectura.
- El coste se acota: pocas piezas por zona, partículas con frecuencia y vida limitadas, y todo se destruye al reiniciar o cambiar de zona.

#### Piezas adicionales (`bitacora-landscape-extras`)

El usuario aportó un segundo kit con once piezas: guirnalda dorada y destello dorado (hojas animadas con atlas), farol, halo de luz y rayos de luz entre las hojas, mota luminosa y polen (partículas), dos nubes (pequeña y alargada) y dos patos nadando (hojas animadas con atlas, miran a la derecha). Se integran con las mismas reglas que el primer kit (copia con sus bytes, entradas **añadidas** a `assets.json`, atlas validados contra su imagen) y con esta metadata adicional que el código consume del manifiesto: `blendMode` (`NORMAL` o `ADD`) y `opacity` (opacidad base), y `motion` ampliado con `pulse` (`alphaMin`, `alphaMax`, `durationMs`) y `swim` (`speedPxPerSecond`). Las sugerencias de movimiento del kit son datos orientativos, no configuración de Phaser.

- Tipos de efecto nuevos en `maps[zona].ambient`: `glow` (imagen de luz con pulso de opacidad, mezcla aditiva) y `swim` (hoja animada que recorre una trayectoria de puntos de ida y vuelta, volteándose según el sentido).
- `sway` admite también piezas de `kind` `light-prop` (el farol); `drift` admite las nubes nuevas; `particles` admite la mota luminosa y el polen.
- Las luces se colocan sobre árboles que ya existen en el fondo (guirnalda y farol entre el tronco y el follaje, halo y rayos con mezcla aditiva y opacidad baja). Son sprites de luz: no recalculan la iluminación ni las sombras del terreno.
- Los patos solo recorren puntos de agua navegable sin cruzar puentes, rocas ni orillas, y su trayectoria no se superpone a celdas transitables. No tienen física, rutas de juego ni colisiones.
- Con `prefers-reduced-motion`, los patos se quedan quietos en su primer punto y fotograma, las luces con pulso muestran su opacidad base y no hay destellos ni partículas.

<a id="spec-4"></a>

## 4. Mapa, estaciones y modularidad

<a id="spec-4-1"></a>

### 4.1. Cantidad variable y orden independiente de la posición

La configuración actual tiene **seis estaciones de aprendizaje repartidas en dos partes del mapa**. No está confirmada una distribución exacta por parte. El ejemplo adjunto usa tres y tres únicamente para probar el sistema; no impongas esa distribución al arte final.

La aplicación debe admitir agregar, retirar o reordenar estaciones mediante configuración. Seis no es un límite ni una constante de negocio; no hay que crear nuevos componentes o escenas para pasar a cinco o siete. Dos es la cantidad inicial de zonas, no una razón para dispersar condicionales por todo el juego.

Cada aprendizaje tiene un ID estable que no depende de su nombre, número visible ni zona. El arreglo `route` contiene sus IDs activos en el orden del recorrido; no debe existir además un campo `order`, `nextLearningId`, `totalStations` o `enabled` que duplique esa información.

`placements[learningId]` define zona, coordenadas, radio y desplazamiento del punto de interacción y assets específicos de la estación. Una reordenación de `route` cambia la secuencia y la numeración, no mueve físicamente las estaciones. Cambiar `placements` mueve las estaciones sin alterar el orden.

Un aprendizaje que existe en `learnings` pero no en `route` está archivado: no aparece en el mapa, no bloquea nada y no cuenta para progreso, XP ni finalización. Su contenido y su ubicación pueden conservarse para reactivarlo después. Archivar no oculta datos de los archivos públicos del sitio.

<a id="spec-4-2"></a>

### 4.2. Fondo reutilizable y estaciones independientes

**No hacer tileset como requisito de esta versión.** Usa las imágenes de paisaje existentes como fondo; Phaser permite representar fondos y elementos estáticos mediante objetos de imagen. [T21]

El fondo no debe contener números, títulos, estaciones, insignias ni objetos temáticos que deban cambiar. Los letreros sin texto, sus etiquetas y los objetos de cada estación se colocan por separado. Si están pintados dentro de la imagen original, registra que hace falta una versión limpia: cambiar JSON no borra píxeles del fondo.

Distingue tres capas de responsabilidades:
- Paisaje y decoraciones permanentes: `maps`.
- Estaciones activas y su colocación: `route` + `placements`.
- Lecturas, diálogos e insignias: `learnings` + `dialogues` + `badges`.

Reserva espacios transitables para futuras paradas cuando el arte lo permita. Agregar una estación no redibuja caminos ni amplía el terreno automáticamente; si no hay espacio, habrá que ajustar el fondo, la decoración o la distribución. Un tileset sería una mejora futura para editar terreno, no una condición para modularizar contenidos.

`maps` también puede listar decoraciones independientes, capas con profundidad fija y obstáculos. No intentes hacer que Vanessa pase detrás de un árbol inseparable del fondo. No mezcles la profundidad del paisaje con los modales HTML.

<a id="spec-4-3"></a>

### 4.3. Estados y movimiento entre partes

| Estado | Presentación y comportamiento |
|---|---|
| Bloqueada | Letrero visible, requisito de lectura previo; no abre contenido futuro. |
| Disponible | Puede abrirse; todas las anteriores de `route` tienen avance válido. |
| En recorrido | Hay secciones marcadas; puede continuar si cumple acceso. |
| Completada | Conserva su insignia y permite relectura sin una nueva recompensa. |

La admisibilidad editorial es otra dimensión: `demo`, `draft` o `ready`. Una estación activa no aprobada se identifica como pendiente en modo final, no se elimina silenciosamente de la secuencia.

**Los portales entre las dos zonas estarán disponibles desde el inicio**, con interacción explícita y regreso. Esto permite reordenar aprendizajes entre zonas sin bloquear físicamente la ruta. Viajar no permite saltarse lecturas ni obtener insignias. No uses una condición especial asociada al aprendizaje 3, 5 o 6, ni una restricción fija a la mitad de la lista.

Cada portal define destino y punto seguro en `maps`; no tiene prerrequisitos de aprendizaje en esta versión. Una solicitud al portal sí debe validar zona de origen, ID del portal y destino, y no dejar al personaje atrapado en un bucle de teletransporte.

Si más adelante se piden portales bloqueados, será una ampliación expresa del contrato con pruebas de accesibilidad del recorrido. No construir ahora un sistema de condiciones arbitrarias.

<a id="spec-4-4"></a>

### 4.4. Coordenadas y colisiones

Mapa, sprites, decoraciones, obstáculos y puntos de interacción utilizan coordenadas del mundo. La cámara adapta la vista, no modifica esas coordenadas. Las dimensiones de cada zona se ajustan al arte real; las del ejemplo son solo de demostración.

Usa una escena Phaser reutilizable, configurada por `zoneId`. Una zona no es una pestaña ni un aprendizaje. Las estaciones se construyen iterando `route` y consultando `placements`, no recorriendo indiscriminadamente todos los contenidos archivados.

Los obstáculos iniciales serán rectángulos o círculos estáticos. Define el punto de interacción de una estación mediante su posición más un desplazamiento local: al moverla, ese punto también se mueve. No pongas colisiones dentro del JSON de la lectura ni bloquees toda la copa de un árbol por defecto.

Habilita una vista de depuración en desarrollo para revisar cuerpos, coordenadas y radios. Los tests de límites no demuestran por sí solos que exista un camino transitable: comprueba visualmente y recorriendo el mapa que todos los aprendizajes y portales activos sean alcanzables. Un importador de Tiled o un editor para arrastrar posiciones son opcionales posteriores, no requisitos.

<a id="spec-5"></a>

## 5. Experiencia de principio a fin

La portada presenta el título, los datos académicos configurados, una introducción breve y las acciones «Comenzar recorrido» o «Continuar recorrido», según exista progreso guardado.

Al entrar, aparece el personaje con Jerry en un punto transitable próximo al primer aprendizaje disponible. La interfaz enseña cómo moverse e interactuar sin interrumpir con un tutorial largo.

El flujo central es:

```text
Moverse por el mapa
→ acercarse a una estación disponible
→ pulsar Enter o el botón «Explorar»
→ leer y marcar las secciones
→ recoger la insignia
→ ver una celebración breve
→ continuar al siguiente aprendizaje
```

Al acercarse a una estación, se muestra su título y una indicación contextual. No abras contenido automáticamente: el visitante debe iniciar la interacción.

Al cerrar la lectura, vuelve al mapa con la misma posición y el foco restaurado. Después de una recompensa, señala cuál es el siguiente aprendizaje sin mover al personaje por la fuerza.

Al completar el recorrido, presenta las insignias obtenidas y un espacio para la reflexión final de la autora, también editable. No generes una conclusión autobiográfica como si ya hubiera sido escrita por ella.

Permite volver a las estaciones completadas y revisar sus contenidos en cualquier momento.

<a id="spec-6"></a>

## 6. Movimiento, controles y animación en Phaser

<a id="spec-6-1"></a>

### 6.1. Controles y foco

En escritorio, las flechas mueven a Vanessa y `Enter` interactúa. `Escape` cierra la lectura desde React. En móvil, construye una cruceta HTML de cuatro direcciones y un botón «Explorar» con el estilo de los assets. Sus pulsaciones deben llegar al mismo controlador de entrada de Phaser que usa el teclado, no a un segundo sistema de movimiento.

Habilita las flechas del juego solo cuando el área del mapa tiene el foco o hay un control táctil activo, no hay una ventana modal y la aplicación está visible. Desactiva también la captura preventiva de esas teclas fuera de ese contexto: deshabilitar solo la lógica de movimiento no basta si se sigue impidiendo el comportamiento normal del navegador. `Tab` debe permitir entrar y salir del mapa. [T9]

Al perder el foco, ocultarse la pestaña, abrirse un diálogo o terminar una pulsación, limpia las teclas, punteros y velocidades. Atiende `pointerup`, `pointercancel`, pérdida de captura y liberación fuera del botón. Admite mantener una dirección y pulsar explorar con otro dedo sin dejar entradas atascadas. Aplica `touch-action` restrictivo solo a los controles que lo necesitan, no a los párrafos.

<a id="spec-6-2"></a>

### 6.2. Movimiento y colisiones

**Utiliza el ciclo de Phaser; no crees `useGameLoop`, un segundo `requestAnimationFrame` ni un temporizador de React para mover los sprites.** La escena puede delegar desde `update(time, delta)` a controladores locales. React solo recibe cambios discretos, no cada coordenada de cada fotograma. El ciclo y la actualización de escenas pertenecen al motor. [T2]

Para esta versión utiliza **Arcade Physics**, sin gravedad, con un cuerpo pequeño cerca de los pies de Vanessa y obstáculos estáticos. Limita el mundo a las dimensiones reales del mapa y usa las colisiones del motor. No mantengas a la vez un solucionador propio que también desplace ese cuerpo. Arcade utiliza cuerpos rectangulares o circulares; no le asignes polígonos arbitrarios como si fueran compatibles. [T8]

Normaliza el vector de movimiento para que la diagonal no sea más rápida. Expresa la velocidad en unidades del mundo por segundo. Cuando asignes velocidad a un cuerpo Arcade, no la multipliques de nuevo por `delta`: la integración física ya gestiona el tiempo. Usa `delta` convertido de milisegundos a segundos solo en desplazamientos manuales de elementos sin cuerpo físico. [T8]

No combines `setVelocity` con cambios manuales de `x/y` para caminar; reserva la colocación directa para aparición, restauración o cambio de zona, sincronizando el cuerpo. Verifica esquinas y obstáculos estrechos a la velocidad elegida, además del regreso desde una pestaña inactiva.

<a id="spec-6-3"></a>

### 6.3. Proximidad, cámara y Jerry

Calcula la proximidad desde los pies del personaje hasta el punto de interacción de la estación. Si hay varias cercanas, elige una de forma determinista, por distancia y luego por orden. Muestra el aviso contextual solo al cambiar el objetivo; no emitas el mismo evento a React cada fotograma.

La proximidad no abre ni completa un aprendizaje. Interactuar requiere una pulsación nueva de `Enter` o del botón, no una tecla mantenida. Bloquea nuevas solicitudes mientras se resuelve una apertura o un cambio de zona.

Usa una cámara con seguimiento y límites del mapa; conserva un tamaño legible de sprites y letreros. La cámara transforma el escenario, no las ventanas HTML. Cuando corresponda, configura el redondeo de píxeles también al iniciar el seguimiento. [T11]

**Encuadre y escala del mundo.** La cámara debe cubrir siempre todo el canvas: el mapa nunca queda anclado a una esquina ni rodeado de franjas vacías. Con `gameplay.camera.fit = "cover"`, el zoom efectivo es el mayor entre `cameraZoom` (zoom base) y el necesario para que el mundo cubra el canvas, acotado por `maxZoom`; si aun así la vista fuera mayor que el mundo, este se centra. Así el personaje y los letreros crecen en pantallas grandes en lugar de quedarse diminutos. Tamaños de referencia: el personaje debe medir al menos el 12 % de la altura del canvas en cualquier tamaño de ventana, y los letreros de estación deben ser más altos que él para leerse a distancia. Ambos se ajustan por configuración (`gameplay.player.scale`, `gameplay.signScale`) y los textos del mundo (números, etiquetas) escalan con ellos. El cuerpo de colisión conserva su tamaño físico en el mundo: agrandar el dibujo no ensancha el cuerpo ni cambia la alcanzabilidad.

Si Jerry está separado, haz que recorra un historial corto de posiciones válidas de Vanessa, muestreado por distancia, con una separación ajustable. No le asignes una colisión sólida que bloquee a la jugadora. Evita interpolaciones que corten esquinas atravesando obstáculos y reinicia su historial al cambiar de zona. Si el sprite ya contiene a Jerry, no añadas otro.

Usa reposo, caminar y celebrar según los recursos disponibles. Un salto de celebración, cuando exista, será un efecto visual y no una nueva mecánica para saltarse colisiones. Para objetos de primer plano separados, ordena la profundidad por la altura de los pies. No simules pasar detrás de un árbol inseparable del fondo si el arte no lo permite.

<a id="spec-6-4"></a>

### 6.4. Música de fondo

El usuario aportó tres pistas para ambientar el recorrido: «Beyond The Clouds (Theme for Modern Broadcast)» y «Enchanted Festival», de Matthew Pablo, y «little town - orchestral». Suenan de fondo y **rotan** entre ellas: al terminar una empieza la siguiente y, tras la última, vuelve la primera.

- Los archivos se copian bajo `public/assets/audio/music/` conservando sus bytes (con nombres sin espacios) y se indexan **añadiendo** entradas a `assets.json` (`category: "audio"`, `kind: "music"`) con `sizeBytes`, `sha256`, `durationSeconds` y `credit` (título, autor, licencia, enlace de origen, texto de atribución y si la atribución está verificada). La lista de reproducción, el orden, el volumen y el fundido pertenecen a `bitacora.json › audio.music` (§12.4); las rutas nunca aparecen allí.
- **Inicio solo por acción del visitante.** La música no suena al cargar la página: empieza cuando el visitante pulsa «Comenzar» o «Continuar» en la portada (gesto del usuario, que además exige el navegador). Si el navegador bloquea la reproducción, la bitácora sigue funcionando sin música y sin errores.
- **Control visible.** Hay un botón dentro del juego, siempre disponible desde la cabecera, que apaga y vuelve a encender la música. Es un botón real con etiqueta textual comprensible («Silenciar música» / «Activar música»), foco visible, objetivo táctil de al menos 44 × 44 px y operable con teclado. La preferencia se guarda en el navegador de forma **independiente del progreso**: reiniciar el recorrido no la borra, y si el visitante la apagó no vuelve a sonar sola en la siguiente visita.
- La música es de fondo: volumen bajo por defecto (editable en JSON), fundido de entrada y salida entre pistas y al encender o apagar, y pausa automática cuando la pestaña queda oculta, reanudándose al volver si estaba encendida. No se reproducen varias pistas a la vez fuera del fundido entre dos.
- Se transmite por flujo (no se decodifica entera en memoria) y solo se pide la pista que suena y la siguiente, para no cargar los ~16 MB de audio al abrir la página. No depende de Phaser ni de la escena: no se corta ni se reinicia al cambiar de zona, abrir una lectura o redimensionar.
- **Créditos.** La portada **no** muestra créditos de la música (decisión del usuario). La atribución de cada pista (título, autor, licencia, enlace de origen) se conserva en su entrada de `assets.json` (`credit`). Dos de las pistas son CC BY 3.0, licencia que exige atribuir al autor: hasta que el usuario decida dónde mostrarla (p. ej. una pantalla de créditos o el pie del sitio publicado), queda como pendiente de entrega. Una pista cuya atribución o licencia no esté verificada impide presentar el sitio como entrega final (§10); no se inventa ni se supone una licencia.
- Si una pista falla al cargar o `audio.music` está vacío o desactivado (`active: false`), la bitácora funciona igual: la que falla se omite con un aviso localizado (ID y ruta) y no se muestra el botón cuando no hay música que controlar.

<a id="spec-7"></a>

## 7. Interfaz de lectura

Mantén una cabecera compacta con título, retrato, progreso, barra de XP y acceso a las insignias. El objetivo actual debe ser comprensible, por ejemplo: «Continúa en Aprendizaje 3».

Al abrir una estación, pausa el movimiento y muestra una ventana crema. En escritorio puede ser un diálogo amplio sobre el mapa; en móvil, una vista casi completa con desplazamiento interno. No achiques los párrafos para mantener visible el mapa.

Conserva exactamente estas pestañas:

| Pestaña | Función |
|---|---|
| Lo vivido | Relatar la experiencia, actividad o situación significativa, desde la voz de la estudiante. |
| Aprendizajes | Explicar qué descubrió, comprendió o conectó con su formación. |
| Reflexión | Expresar emociones, preguntas, tensiones y relaciones con otros saberes. |
| En el aula | Proponer cómo llevar ese aprendizaje a la práctica pedagógica, sin afirmar que ya se implementó. |

Las pestañas son dimensiones del mismo aprendizaje, no estaciones distintas. Se pueden consultar en cualquier orden.

Admite párrafos, subtítulos, imágenes con texto alternativo y pie, citas y referencias aportadas por la autora. Las evidencias deben poder añadirse sin modificar el componente de lectura.

Muestra el estado de cada sección con texto, no solo color. Conserva las secciones marcadas y, si es viable, la pestaña activa al cerrar y volver a abrir.

El diálogo debe tener título accesible, cierre visible, foco inicial coherente, navegación de foco contenida mientras está abierto y restauración del foco al cerrarse. Las pestañas deben implementar sus roles, asociaciones y navegación por teclado, sin que sus flechas muevan al personaje. [T4] [T5]

Toda esta ventana pertenece a React, fuera del canvas. No uses textos de Phaser ni HTML incrustado en su escena para los párrafos académicos. Los letreros breves del mundo sí pueden renderizarse en Phaser, conservando un equivalente textual en la interfaz o lista accesible.

<a id="spec-8"></a>

## 8. Qué significa completar un aprendizaje

**Abrir una estación o visitar una pestaña no equivale a haber leído.** Tampoco se puede comprobar la comprensión mediante scroll o tiempo de permanencia.

Utiliza una confirmación explícita y sencilla: cada sección requerida ofrece «Marcar sección como leída». El botón debe estar disponible en la sección y no depender de alcanzar un porcentaje de scroll. Después de marcar las cuatro secciones, se habilita «Recoger insignia y continuar».

No impongas un tiempo mínimo de lectura, un cuestionario ni una respuesta escrita que no han sido solicitados. La confirmación registra una acción del visitante, no certifica aprendizaje.

Cuando se recoge una insignia, una única transición de estado marca la estación como completada, registra la fecha, habilita el siguiente aprendizaje y dispara una celebración breve. La operación debe ser idempotente: un doble clic, una tecla mantenida o volver a abrir el contenido no pueden duplicar recompensas.

La celebración puede mostrar el asset de la insignia, el resplandor, una pose del personaje con Jerry y el texto «¡Aprendizaje recorrido!». Respeta la preferencia de movimiento reducido. [T7]

Propuesta de XP, configurable: 100 puntos por estación completada. Calcula el total desde las estaciones completadas; no guardes un contador independiente que pueda desincronizarse. Muestra también el progreso directo, por ejemplo «3 de 6 aprendizajes» y «300 / 600 XP» para la configuración inicial. Deriva el denominador de `route` y la XP máxima de sus insignias configuradas; nunca incrustes esos totales en la interfaz.

Para conservar la idea de subir de nivel sin crear otra mecánica, el nivel de recorrido puede coincidir con las insignias obtenidas: inicia en 0 y aumenta una vez por estación. Es un indicador del recorrido, no una evaluación académica.

Al releer, muestra «Insignia obtenida» y no vuelvas a otorgar XP.

La concesión de la insignia se decide en el dominio compartido, nunca en un collider ni en la escena. Comunica la celebración como un efecto de una transición nueva y aceptada. Una sincronización de progreso al cargar no debe volver a celebrar todas las insignias históricas.

<a id="spec-9"></a>

## 9. Contenido de ejemplo: plantas y semillas

**Todo este apartado es un borrador propuesto a partir del relato suministrado; requiere revisión de la autora.** No lo publiques como contenido final aprobado.

Título provisional: **Aprender con los sentidos: plantas, semillas y saberes**.

Insignia provisional: **Semilla de descubrimiento**. Representación: una semilla germinando o un objeto compatible que ya exista entre los assets. No inventes la ruta de un archivo para representarla.

### Lo vivido

> Durante una exploración guiada por la maestra, conocimos distintas plantas y semillas. Uno de los momentos más significativos para mí fue cuando compartió semillas de diferentes frutos y me detuve a olerlas una por una. Fue una experiencia muy bonita, porque no había tenido muchos acercamientos de ese tipo con la naturaleza.
>
> También recibimos materiales sobre los usos atribuidos a algunas plantas. La actividad despertó mi curiosidad por las experiencias y los conocimientos que las personas construyen alrededor de ellas.

### Aprendizajes

> Esta experiencia me llevó a reconocer el lugar que pueden tener los sentidos en mi manera de aprender. Detenerme a oler, observar y prestar atención hizo que algo que antes me resultaba distante se volviera significativo.
>
> También me surgió el interés por conocer cómo se comparten los saberes sobre las plantas y cómo podría dialogar con ellos desde mi formación como maestra.

### Reflexión

> La actividad me hizo pensar en la relación entre los conocimientos sobre las plantas, las mujeres que los han transmitido y su asociación con la brujería. Me pregunté por la forma en que ciertos saberes han sido valorados o desvalorizados, y por las relaciones de poder que intervienen en esa valoración.
>
> Quiero profundizar en esas conexiones y contrastarlas con fuentes, sin dar por sentado que todas esas historias pueden explicarse de la misma manera. Como futura maestra, me interesa aprender a escuchar otros conocimientos y a formular preguntas sobre ellos.

### En el aula

> Como propuesta para una futura experiencia pedagógica, imagino una mesa de exploración con elementos naturales previamente seleccionados para el grupo. Podría invitar a observar, describir y comparar, dando espacio a lo que cada niña o niño quiera expresar.
>
> También me gustaría incorporar relatos de las familias sobre su relación con las plantas. Esta sería una actividad de exploración y escucha, no una práctica de consumo de plantas ni de aplicación de remedios.

### Criterio editorial

Conserva la voz personal y diferencia experiencia, interpretación, propuesta pedagógica y afirmación verificable. No conviertas los usos medicinales mencionados en recomendaciones de tratamiento. No presentes como demostrada una conexión histórica entre brujería, burguesía, conquista y saberes de plantas sin fuentes aportadas y revisadas.

No añadas bibliografía ficticia, diagnósticos, detalles de la actividad que no se hayan mencionado ni generalizaciones científicas sin comprobar. La implementación debe permitir añadir las fuentes más adelante.

Para los otros cinco aprendizajes iniciales utiliza «Tema por definir» y textos explícitos de demostración. El prefijo visible «Aprendizaje 2», por ejemplo, se deriva de `route`; no lo incrustes en el título almacenado. No inventes experiencias autobiográficas para completar los espacios.

<a id="spec-10"></a>

## 10. Separación entre demostración y entrega final

La demostración debe permitir probar todo el recorrido activo, inicialmente seis aprendizajes, y también variantes de cinco y siete sin modificar el código. Los contenidos de ejemplo pueden participar en esa prueba, pero deben estar identificados como «Contenido de demostración».

Añade un modo global `demo` o `final` y un estado editorial por estación, por ejemplo `demo`, `draft` o `ready`. En modo final, una estación no aprobada no debe presentarse como terminada ni otorgar una insignia como si tuviera contenido académico definitivo. Muestra que está pendiente y documenta el bloqueo de publicación.

Separa el progreso de demostración del progreso final. Completar los placeholders mientras se desarrolla no debe provocar que un visitante reciba todas las insignias al publicar el contenido definitivo.

No bloquear el desarrollo a la espera de los textos. La estructura, navegación, movimiento y pruebas deben funcionar antes de recibirlos.

En modo final, si hay estaciones obligatorias sin aprobar, presenta el recorrido como incompleto o en preparación, no como entrega terminada. En demo, todos los aprendizajes activos deben poder probarse de principio a fin, con sus cuatro secciones de ejemplo claramente identificadas.

<a id="spec-11"></a>

## 11. Arquitectura React + Phaser

<a id="spec-11-1"></a>

### 11.1. Responsabilidades

| Capa | Responsabilidad | Lo que no debe hacer |
|---|---|---|
| React | Portada, datos académicos, ventanas, pestañas, evidencias, controles táctiles, mensajes y lista accesible. | Mover sprites o renderizar todo el árbol por cada fotograma. |
| Phaser | Fondos, sprites, animaciones, colisiones, cámara, proximidad y representación visual de estaciones. | Otorgar insignias, duplicar progreso o escribir directamente en almacenamiento. |
| Dominio TypeScript | Validar lecturas, desbloqueos, revisiones e idempotencia; derivar estados y XP. | Importar React o Phaser, renderizar, emitir eventos o acceder a `localStorage`. |
| Controlador de aplicación | Ejecutar transiciones, mantener el estado autorizado, coordinar ventanas, snapshots y efectos. | Usar un EventBus como si fuera almacenamiento persistente. |
| Adaptador de almacenamiento | Validar, cargar y guardar el progreso. | Confiar sin validación en JSON previo o borrar datos ajenos. |

Mantén **una sola fuente de verdad del progreso** en la capa de aplicación. Phaser recibirá una instantánea derivada para pintar las estaciones; esa copia visual no puede modificar los desbloqueos.

Como implementación inicial, usa `useReducer` y Context con funciones puras de dominio. Un store pequeño ya presente en el repositorio es aceptable si conserva estas responsabilidades. No añadas otro gestor de estado solo para mover al personaje. Ni reducers ni inicializadores deben guardar en disco o emitir recompensas; ejecuta efectos fuera de ellos y protege los efectos repetibles. [T1]

<a id="spec-11-2"></a>

### 11.2. Base del proyecto y versiones

Para un proyecto nuevo, usa como referencia la plantilla oficial `phaserjs/template-react-ts`, que integra React, TypeScript, Vite y un puente de eventos. Inspecciona su estructura antes de adaptarla; no copies sin revisar el ejemplo completo como si ya implementara esta bitácora. [T0]

Si ya hay un repositorio React + Vite, integra Phaser en él sin regenerar ni sobrescribir su contenido. Revisa `package.json`, versión de Node requerida y dependencias compatibles; conserva el lockfile y documenta versiones efectivamente instaladas. No mezcles APIs de versiones mayores distintas ni deduzcas la versión por el título de una plantilla. Comprueba sus dependencias reales al implementar. [T16]

Inspecciona los scripts heredados de cualquier plantilla. No añadas telemetría ni peticiones ajenas a los recursos necesarios; elimina registros externos si existen y deja scripts locales de desarrollo y compilación. Esta decisión no requiere un servicio adicional.

Define scripts reproducibles para desarrollo, comprobación de tipos, pruebas, compilación y vista previa. Las rutas de assets deben respetar la base de Vite; centraliza imports o la construcción de rutas con `import.meta.env.BASE_URL` según su ubicación. No escribas rutas absolutas dispersas que fallen al servir bajo un subdirectorio. [T14]

### 11.2.1. Apoyo técnico con `phaser4-gamedev`

Para el trabajo con Claude Code se recomienda usar el plugin `phaser4-gamedev` del repositorio `https://github.com/Yakoub-ai/phaser4-gamedev`. Antes de instalarlo, la IA debe leer su README actual y seguir el método documentado para Claude Code con **scope de proyecto**, verificando después que comandos, skills y agentes estén disponibles.

El plugin es una herramienta de apoyo para Phaser, assets, debugging y playtesting. **No es una fuente de requisitos del producto** y no puede sustituir ni reescribir esta SPEC. No usar `/phaser-new` para regenerar el proyecto ni `/phaser-gdd` para reemplazar la especificación existente. Cuando sus patrones entren en conflicto con esta arquitectura, prevalece `.claude/SPEC.md`.

El uso más valioso esperado incluye implementación Phaser, análisis de assets, debugging y `/phaser-playtest`. Después de cambios que afecten escenas, carga de assets, input, física, animaciones o renderizado, la verificación de runtime debe complementar el type-check y el build.

<a id="spec-11-3"></a>

### 11.3. Estructura propuesta

Los siguientes nombres son una organización prevista, no archivos ya implementados. La configuración editable se divide en **dos JSON con responsabilidades distintas**: `bitacora.json` para la experiencia y `assets.json` para los recursos. Evita repartir la misma información entre JSON, constantes TS y componentes.

```text
.claude/
  SPEC.md
  PLAN.md
README.md
public/
  config/
    bitacora.json               # Contenido, recorrido y parámetros de la experiencia
    bitacora.schema.json        # Contrato de validación de la bitácora
  assets/
    assets.json                 # Índice único de recursos y animaciones
    assets.schema.json          # Contrato de validación del catálogo
    backgrounds/                # Archivos reales organizados por categoría
    characters/
    animations/                # Hojas animadas con su atlas JSON (§3.2)
    particles/
    decorations/
    badges/
    stations/
    ui/
scripts/
  validate-config.ts           # Misma validación que en el navegador
src/
  app/
    App.tsx
    BitacoraProvider.tsx
    useProgressController.ts
  config/
    loadConfig.ts              # Carga bitacora.json una vez
    loadAssets.ts              # Carga assets.json una vez
    validateConfig.ts          # Forma + integridad de referencias cruzadas
    normalizeConfig.ts         # Defaults e índices derivados, no contenido copiado
    assetRegistry.ts           # Resuelve assetId/animationId y URLs de despliegue
    types.ts                   # Generados/contrastados con ambos esquemas
  components/
    game/PhaserGame.tsx
    reading/
      LearningDialog.tsx
      LearningTabs.tsx
      ContentRenderer.tsx
    ui/
      Cover.tsx
      DialoguePanel.tsx
      WindowPanel.tsx
      PixelButton.tsx
      ProgressHUD.tsx
      BadgeCollection.tsx
    navigation/
      TouchControls.tsx
      AccessibleLearningIndex.tsx
  game/
    createGame.ts
    config.ts                  # Configuración del motor, no copia de bitacora.json
    bridge/
      GameBridge.ts
      events.ts
    scenes/
      PreloadScene.ts
      ExplorationScene.ts
    entities/
      Player.ts
      Companion.ts
      Station.ts
      ZonePortal.ts
    systems/
      InputController.ts
      InteractionSystem.ts
      WorldBuilder.ts
      CameraController.ts
      AmbientBuilder.ts          # Animaciones del paisaje desde maps[].ambient (§3.2)
  domain/
    progression.ts
    reconcileProgress.ts
    types.ts
  storage/progressStorage.ts
  styles/
    tokens.css
    game.css
    reading.css
  tests/
    config.test.ts
    progression.test.ts
    reconcileProgress.test.ts
    bridge.test.ts
    fixtures/                  # Variantes de 5, 6 y 7 aprendizajes
```

`ExplorationScene` recibe configuración normalizada y un `zoneId`. Usa una sola entidad `Station` y un mismo `LearningDialog` para todas las estaciones, no clases o componentes numerados.

Si `bitacora.json` crece mucho, se podrá dividir posteriormente por contenido mediante un cargador que produzca el mismo contrato en memoria; `assets.json` seguirá siendo el catálogo gráfico independiente. No introducir esa complejidad inicialmente ni usar imports escritos como cadenas esperando que se ejecuten solos. La modularidad está en la separación de responsabilidades, no en el número de archivos.

<a id="spec-11-4"></a>

### 11.4. Ciclo de vida del juego

Carga y valida primero `bitacora.json` y `assets.json`, comprueba sus referencias cruzadas y después reconcilia el progreso con esa configuración. Crea el juego cuando el contenedor exista y ambos pasos hayan terminado correctamente. No inicies una configuración parcialmente validada. Debe existir un solo canvas y una sola instancia activa de `Phaser.Game` para este host. Guarda la instancia en una referencia estable, no en estado serializable.

No recrees el juego cuando cambie una pestaña, se marque una sección o se gane una insignia. Esos cambios se comunican mediante el puente. No uses el progreso como dependencia que reinicializa todo el canvas.

Al desmontar, destruye la instancia, retira suscripciones concretas, desconecta observadores y limpia controles. La destrucción de `Phaser.Game` se solicita para un paso posterior del motor: verifica su finalización antes de sustituir una instancia todavía activa, y prueba el remontaje. No desactives Strict Mode para ocultar duplicaciones; React comprueba en desarrollo ciclos adicionales de preparación y limpieza de efectos. [T10] [T1]

En cada reinicio o salida de escena, libera sus listeners externos y referencias a sus objetos; en la destrucción del host, libera además los del puente. No uses una eliminación global de listeners que borre suscripciones pertenecientes a otro componente. Prueba tanto el desmontaje como el cambio de zona y la recarga en desarrollo.

<a id="spec-11-5"></a>

### 11.5. Puente de comunicación y sincronización

Implementa un `GameBridge` pequeño con eventos tipados. Es un módulo de esta aplicación; sus nombres no son APIs nativas de Phaser. La plantilla ofrece un EventBus como punto de partida. Instancia o acota el puente al ciclo del host, mantén sus referencias estables y registra receptores antes de arrancar la escena. [T0]

Contrato conceptual mínimo:

| Mensaje | Dirección | Contenido y efecto |
|---|---|---|
| `game:ready` | Phaser a aplicación | `zoneId`, token de la instancia de escena y posición de los pies; solicita sincronización inicial. |
| `game:nearby-changed` | Phaser a React | Objetivo cercano (`{kind: learning\|portal, id}`) o `null`; solo al cambiar el objetivo. |
| `game:learning-open-request` | Phaser a aplicación | ID, token y solicitud única; el dominio comprueba acceso antes de abrir. |
| `game:portal-request` | Phaser a aplicación | ID del portal y token; la aplicación valida origen y destino configurados, sin bloqueo por aprendizaje. |
| `game:checkpoint` | Phaser a aplicación | Zona y posición de pies, al detenerse o salir; no por fotograma. |
| `game:asset-failures` | Phaser a aplicación | IDs y URLs resueltas de los gráficos que no cargaron (AC-20). |
| `app:sync` | Aplicación a Phaser | Versión del estado, estados de estaciones y aprendizajes activos sin aprobar (`pending`). |
| `app:request-resolved` | Aplicación a Phaser | ID de solicitud, aceptada o denegada y su razón; libera el bloqueo temporal. |
| `app:controls` | Aplicación a Phaser | Motivos de bloqueo vigentes (lectura, ventana, transición); con alguno, la exploración se detiene. |
| `app:zone-change` | Aplicación a Phaser | Zona y punto de aparición ya validados. |
| `app:celebrate` | Aplicación a Phaser | ID único del efecto e ID del aprendizaje; nunca concede la recompensa. |
| `ui:direction` / `ui:interact` | React a controlador de entrada | Pulsaciones y liberaciones de los controles táctiles. |

Cada solicitud se resuelve una vez; una denegación también debe quitar el bloqueo temporal y mostrar una razón. Descarta mensajes de una escena que ya fue sustituida. No confíes en el ID de destino enviado por el juego: compruébalo contra los datos del portal y del progreso.

Al recibir `game:ready`, envía siempre el snapshot actual completo. Un evento emitido antes de existir un receptor no basta para inicializar la escena. Mantén disponible la última instantánea y aplícala al arrancar, reiniciar o reanudar; los eventos son avisos, no la fuente de verdad.

No cierres callbacks sobre una versión vieja del progreso. Usa el estado actual del controlador y callbacks estables. La aplicación emite efectos solo después de aceptar una transición nueva; no emitas recompensas desde el renderizado ni desde el reducer. Identifica y consume cada celebración una sola vez, también durante comprobaciones de desarrollo.

La lista accesible abre mediante el mismo controlador, sin requerir proximidad física. Esa excepción es solo de navegación: conserva todos los prerrequisitos y requisitos de lectura.

<a id="spec-11-6"></a>

### 11.6. Lectura, pausa y reanudación

Flujo obligatorio:

```text
Proximidad + interacción explícita en Phaser
-> solicitud de apertura y detención inmediata del personaje
-> validación en la aplicación
-> diálogo React + pausa de la exploración
-> confirmación de secciones en el dominio
-> recogida de insignia y guardado de la transición
-> cierre de lectura, sincronización y reanudación
-> celebración breve y siguiente aprendizaje disponible
```

En esta especificación, pausa la escena de exploración al abrir una ventana modal; conserva el escenario visible. Una escena pausada sigue dibujándose pero no ejecuta su actualización. React permanece independiente. [T2]

Controla la reanudación desde el puente o desde el administrador de escenas, no esperando que `update()` de la escena pausada lea una orden. Mantén la capacidad de recibir y retener el nuevo snapshot durante la pausa. Antes de reanudar, aplícalo y limpia velocidades y entradas.

Distingue las razones de bloqueo: lectura, colección de insignias modal, transición, pestaña oculta y falta de foco. Cerrar un diálogo no debe reactivar los controles si sigue existiendo otra razón. Verifica también el redimensionamiento del canvas mientras se lee.

Al recoger la insignia, cierras la lectura y muestras la celebración en el mapa cuando la escena esté lista; evita que una animación se reproduzca detrás de una ventana que la oculta. La confirmación textual del logro no depende del motor ni de la animación. Releer sigue disponible.

<a id="spec-11-7"></a>

### 11.7. Cambio entre zonas

Obtén el portal y su destino desde `maps`. En esta versión, ambos sentidos están abiertos desde el inicio: valida la transición sin asociarla al orden de los aprendizajes. Guarda el último punto seguro, bloquea interacciones y solicita la zona de destino. Tras cargarla, posiciona Vanessa y Jerry en un punto transitable y sincroniza el progreso antes de habilitar controles.

No conserves referencias a sprites o cámaras de una escena reiniciada. Restablece el objetivo cercano, el historial de Jerry y las entradas. Al regresar a una zona, usa el punto guardado si sigue siendo válido; de lo contrario, el punto seguro del portal.

El cambio de zona no modifica ni concede insignias. Si la carga falla, muestra una opción de reintentar y conserva el progreso; no marques la transición como un aprendizaje completado.

<a id="spec-12"></a>

## 12. Contrato JSON y edición sin tocar componentes

<a id="spec-12-1"></a>

### 12.1. Qué se parametriza y qué sigue siendo código

**Sí: la bitácora estará parametrizada por JSON.** La experiencia se define en `bitacora.json` y los recursos se indexan por separado en `assets.json`. React y Phaser interpretarán contratos conocidos. JSON describe datos; no implementa por sí mismo movimiento, lectura, colisiones, validación o guardado.

| Bloque | Contiene | No contiene |
|---|---|---|
| `project` | Datos académicos, título, bienvenida y reflexión final. | Copias de estos textos en componentes. |
| `route` | IDs activos en su orden de lectura. | Coordenadas, totales ni prerrequisitos duplicados. |
| `placements` | Ubicación y aspecto local de cada estación por ID. | Sus párrafos, número visible ni progreso. |
| `maps` | Fondos, dimensiones, objetos, obstáculos, puntos seguros y portales. | Textos académicos o una estación incrustada en la imagen. |
| `learnings` | Título, tema, revisión, estado editorial, secciones, insignia y diálogos asociados. | Código JSX, funciones ni orden de recorrido. |
| `badges` | Nombre, descripción, asset y XP de cada insignia. | Indicadores `earned` o contadores guardados. |
| `dialogues` | Líneas, interlocutor y variables de mensajes. | Scripts o condiciones evaluables. |
| `ui` | Pestañas, etiquetas, diálogos por defecto y referencias a assets de la interfaz. | Un constructor libre de HTML/CSS. |
| `gameplay` | Parámetros admitidos, como velocidad, zoom, personaje y acompañante referenciados por IDs. | Nombres arbitrarios de clases o nuevos modos de juego. |

`assets.json` tiene una responsabilidad distinta: resolver IDs lógicos a archivos y metadatos técnicos. Ningún componente debe conocer rutas físicas si puede resolverlas mediante el registro de assets.

Cambiar un texto, insignia, diálogo, orden o ubicación no requiere modificar componentes. Añadir un tipo de bloque no soportado, una mecánica nueva o un diseño de interfaz completamente distinto sí requiere código y actualizar el esquema. No prometas un motor universal «sin código».

<a id="spec-12-2"></a>

### 12.2. Fuente única, carga y despliegue

Ubicaciones iniciales: `public/config/bitacora.json` y `public/assets/assets.json`. En Vite, los archivos de `public` se sirven como recursos estáticos y se copian sin transformar al resultado de compilación. [T18]

Carga ambos documentos mediante adaptadores centrales, no desde cada componente ni otra vez desde la escena. Secuencia:

```text
Obtener bitacora.json + assets.json
→ validar sintaxis y esquemas
→ comprobar referencias cruzadas, rangos y coherencia del recorrido
→ construir AssetRegistry e índices normalizados
→ reconciliar progreso local
→ entregar configuración y registro de assets a React y Phaser
```

Resuelve primero la URL de `assets.json` con la base de despliegue (`import.meta.env.BASE_URL`) y, a partir de esa URL, resuelve cada `assets[assetId].path` según `basePath` y `pathConvention`. El manifiesto actual declara que los paths son relativos al directorio que contiene `assets.json`; no los reinterpretes como rutas relativas al código fuente ni antepongas dos veces `assets/`. Sirve el proyecto por HTTP(S), no abriendo un archivo local directamente. Las cadenas dentro del JSON no dependen de una reescritura automática de Vite. [T14] [T18]

En desarrollo basta editar el JSON, validar y recargar. En producción hay que entregar al servidor la nueva configuración y los assets necesarios: editar la copia local no cambia el sitio publicado. Con carga externa no hace falta cambiar la lógica JS por un párrafo nuevo, pero un hosting de despliegues inmutables puede requerir otro despliegue.

No prometer actualización en vivo de una sesión abierta. Carga una versión coherente al iniciar; aplica cambios en la siguiente recarga. Usa un identificador `configRevision` para diagnóstico, y configura revalidación HTTP del JSON. Actualiza archivo y assets de manera compatible/atómica, y prueba cachés y subdirectorios. Evita añadir service workers o polling para esto.

`schemaVersion` del JSON describe su estructura; `configRevision` identifica una edición; `contentRevision` de un aprendizaje determina si una lectura anterior sigue vigente; `contentSetId` identifica esta bitácora. No cambies todos estos valores por cada corrección ni uses una revisión global para borrar todo el progreso.

<a id="spec-12-3"></a>

### 12.3. Validación de configuración y del manifiesto existente

Implementa `bitacora.schema.json` con un dialecto explícito de JSON Schema y un validador compatible con la versión elegida. Para `assets.json`, **no diseñes primero un esquema ideal y luego fuerces el archivo a cumplirlo**. Parte del manifiesto real y, si se crea `assets.schema.json`, debe describir fielmente su estructura actual y admitir la metadata específica observada por `kind`. El esquema es una ayuda de validación, no una migración del catálogo. [T17]

Genera los tipos TypeScript desde los esquemas o comprueba ambos mediante tests; no mantengas contratos contradictorios. `as BitacoraConfig` o `as AssetCatalog` no valida datos externos. [T19]

Además de la forma, valida con funciones propias:

- `route` sin IDs repetidos; cada ID existe en `learnings` y tiene una ubicación válida.
- Cada ubicación activa apunta a una zona real. Cada referencia `assetId` usada por `bitacora.json` debe existir como clave exacta en `assets.json.assets`.
- El orden lo define únicamente `route`. No depende del orden de las claves de objetos ni del nombre del ID.
- Las zonas tienen dimensiones positivas; coordenadas finitas, puntos seguros dentro del mundo y radios positivos. Los obstáculos y puntos de interacción no hacen inaccesible el recorrido.
- Los portales tienen destinos y puntos de aparición reales; permiten llegar y regresar entre las zonas utilizadas.
- Las cuatro secciones configuradas existen sin duplicados; en esta versión los IDs son `lived`, `learning`, `reflection`, `classroom`.
- Las variables de diálogo están en una lista permitida. Los enlaces de referencias usan protocolos permitidos; nunca evaluar HTML, JavaScript, `eval` o nombres de componentes traídos del JSON.
- En `assets.json`, `assetCount` debe coincidir con el número real de claves de `assets` y `categoryCounts`, cuando se valide como inventario, debe ser coherente con las categorías observadas.
- Cada entrada utilizada en runtime debe tener un `path` no vacío, y el archivo resuelto debe existir en desarrollo/build. `originalPath` no se usa para cargar el recurso.
- Los campos `width` y `height`, cuando existan, deben ser positivos. `transparent` y `hasAlphaChannel` se consideran metadata del archivo, no reglas de colisión.
- Si `kind` es `pose-sheet` y `requiresFrameDefinition` es `true`, el juego puede precargar la imagen, pero no debe construir una animación hasta disponer de frames validados.
- `visualLayout` no equivale a un frame grid. `rowDirections` y `poseCount` pueden usarse para comprobar una definición de frames creada después, no para inventarla.
- `nineSlice`, `placement`, `zone`, `layer`, `variant` y otros metadatos especializados deben validarse solo cuando estén presentes y ser consumidos por el código que corresponda.
- En `maps[zona].ambient`, cada `assetId` existe y su metadata es coherente con el tipo: `animation` exige `atlasPath`, `animation` y `frameCount`; `sway` y `drift` exigen `motion` del mismo tipo; `particles` exige `motion.type = "particle"`. Las posiciones y áreas caen dentro de la zona y las escalas son positivas.
- Los tipos `glow` y `swim` también exigen coherencia con la metadata: `glow` pide un asset de `kind` `light-glow` con `motion.type = "pulse"`; `swim` pide una hoja animada con `motion.type = "swim"` y una trayectoria de al menos dos puntos dentro de la zona; `animation` rechaza una hoja con `motion.type = "swim"` (debe usarse `swim`). `blendMode` solo admite `NORMAL` o `ADD` y `opacity` está entre 0 y 1.
- En `audio.music`, cada ID de `tracks` existe en `assets.json` con `kind` `music`, sin repetirse; `volume` está entre 0 y 1; `crossfadeMs` no es negativo y es menor que la mitad de la pista más corta; `rotation` es `sequential` o `shuffle`. Cada archivo de audio existe; su `sizeBytes` y `sha256` se contrastan y avisan si difieren. Los créditos con licencia sin verificar se informan como bloqueo de entrega final (§10).
- Cada `atlasPath` existe, su `meta.image` coincide con el archivo del asset y sus regiones están dentro de la imagen, sin solaparse, con contenido y en número igual a `frameCount`. Los efectos ambientales no cambian colisiones ni alcanzabilidad.
- `assets.json` no contiene progreso, textos académicos, orden de estaciones ni coordenadas de gameplay; `bitacora.json` no contiene rutas físicas, hashes, tamaños de archivo ni procedencia original.

Las referencias cruzadas y la accesibilidad real del mapa no se resuelven solo por JSON Schema. Devuelve errores concretos, por ejemplo `placements.apr-c.decorationAssetId: asset ID no encontrado`; no una pantalla negra. No corrijas silenciosamente un ID mal escrito ni elimines una estación inválida de `route`.

En caso de `bitacora.json` inválido, no sobrescribas progreso ni construyas parcialmente el mundo. Si el manifiesto es válido pero un archivo gráfico falla, conserva la lectura accesible y reporta el asset ID y la ruta resuelta. Son fallos diferentes.

<a id="spec-12-4"></a>

### 12.4. Contrato orientativo

Los tipos siguientes muestran la separación prevista. Implementa el esquema equivalente antes de consumir el JSON; esta especificación no es una biblioteca ya instalada. Las claves de los registros son los IDs: no dupliques un `id` editable dentro de cada valor.

```ts
type AppMode = "demo" | "final";
type SectionId = "lived" | "learning" | "reflection" | "classroom";
type Point = { x: number; y: number };

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "image"; assetId: string; alt: string; caption?: string }
  | { type: "quote"; text: string; source?: string }
  | { type: "reference"; label: string; url?: string };

interface ProjectConfig {
  title: string;
  studentName: string;
  university: string;
  program: string;
  semester: string;
  courseName: string;
  teacherName: string | null;
  welcomeText: string;
  finalReflection: ContentBlock[];
}

type DialogueEvent = "open" | "locked" | "completed" | "reward";

interface Learning {
  title: string;
  topic: string;
  editorialStatus: "demo" | "draft" | "ready";
  contentRevision: number;
  badgeId: string;
  sections: Record<SectionId, ContentBlock[]>;
  dialogueOverrides?: Partial<Record<DialogueEvent, string>>;
}

interface Badge {
  title: string;
  description: string;
  assetId: string;
  xp: number;
}

interface Dialogue {
  lines: Array<{
    speaker: "vanessa" | "narrator";
    text: string;
    portraitAssetId?: string;
  }>;
}

interface Placement {
  zoneId: string;
  position: Point;                   // Base del letrero, coordenadas del mundo
  interactionOffset: Point;          // Centro de interacción = posición + offset
  interactionRadius: number;
  signAssetId?: string;              // Respaldo: ui.assets.stationSign
  decorationAssetId?: string;
  decorationOffset?: Point;
}

type Obstacle =
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "circle"; x: number; y: number; radius: number };

interface Decoration {
  assetId: string;
  position: Point;
  origin: Point;                     // Valores entre 0 y 1
  scale: number;
  depth: { mode: "fixed"; value: number } | { mode: "y"; offset: number };
}

/** Capa de fondo elegida explícitamente (§3.1): una variante por capa, dibujada por `depth` creciente. */
interface MapLayer { assetId: string; depth: number }

type Rect = { x: number; y: number; width: number; height: number };
type AmbientDepth = { mode: "fixed"; value: number } | { mode: "y"; offset: number };

/**
 * Animación ambiental (§3.2). `scale` es un multiplicador de la `recommendedScale` del asset (por defecto 1);
 * origen, fotogramas y movimiento salen de la metadata del manifiesto, no se repiten aquí.
 */
type AmbientEffect =
  | { type: "animation"; assetId: string; position: Point; scale?: number; flipX?: boolean; alpha?: number; depth: AmbientDepth }
  | { type: "sway"; assetId: string; position: Point; scale?: number; depth: AmbientDepth }
  | { type: "drift"; assetId: string; position: Point; scale?: number; depth: AmbientDepth }
  | { type: "particles"; assetId: string; area: Rect; frequencyMs: number; scale?: number; depth: AmbientDepth }
  | { type: "glow"; assetId: string; position: Point; scale?: number; alpha?: number; depth: AmbientDepth }
  | { type: "swim"; assetId: string; path: Point[]; scale?: number; speedFactor?: number; depth: AmbientDepth };

interface MapZone {
  label: string;
  width: number;
  height: number;
  layers: MapLayer[];                // sustituye al fondo único: horizon, terrain, midground, foreground
  initialSpawnId: string;
  spawns: Record<string, Point>;
  obstacles: Obstacle[];
  decorations: Decoration[];
  ambient: AmbientEffect[];          // puede estar vacío
  portals: Record<string, {
    label: string;
    interaction: Point & { radius: number };
    targetZoneId: string;
    targetSpawnId: string;
  }>;
}

interface ActorSpec {
  assetId: string;
  origin: Point;
  scale: number;
  animations: Partial<Record<
    "idle" | "walkUp" | "walkDown" | "walkLeft" | "walkRight" | "celebrate",
    string
  >>;
}

interface UiConfig {
  tabs: Array<{ id: SectionId; label: string; required: boolean }>;
  labels: {
    explore: string; markRead: string; claimBadge: string; close: string;
    index: string; reset: string; continueRoute: string; startRoute: string;
    pending: string; demo: string; previous: string; next: string;
    progressTemplate: string; stationTitleTemplate: string;
    semester: string; teacher: string; sectionRead: string; sectionUnread: string; badgeEarned: string;
    remainingTemplate: string; rewardTitle: string; xpTemplate: string; levelTemplate: string;
    objectiveTemplate: string; finishedLabel: string; emptyRouteLabel: string; mapLabel: string;
    badges: string; notEarned: string; earnedOnTemplate: string; badgeCountTemplate: string;
    completionTitle: string; finalReflectionTitle: string; finalReflectionPending: string;
    resetConfirmTitle: string; resetConfirmText: string; resetConfirm: string; cancel: string;
    preparationTemplate: string;
    musicMute: string; musicUnmute: string;     // etiqueta del botón de música según su estado
  };                                 // las plantillas solo admiten las variables permitidas de cada una (§12.7)
  assets: {
    window: string; button: string; stationSign: string; titleSign: string; portrait: string;
    xpBar: string; glow: string;
    buttonHover?: string; xpStar?: string; openBook?: string; lockIcon?: string;
  };
  defaultDialogueIds: Record<DialogueEvent, string>;
}

interface GameplayConfig {
  progressionMode: "sequential";
  zoneTravel: "free";
  start: { zoneId: string; spawnId: string };
  playerSpeed: number;
  cameraZoom: number;                // zoom base (mínimo)
  camera: { fit: "cover" | "fixed"; maxZoom: number };
  signScale: number;                 // escala en el mundo de las señales de estación (§6.3)
  player: ActorSpec & {
    // Píxeles de textura × scale, medidos desde el punto de apoyo (los pies): offset (0,0) son los pies.
    body: { width: number; height: number; offset: Point };
  };
  companion: {
    mode: "separate" | "included";
    actor?: ActorSpec;               // Requerido cuando mode = separate
    followDistance: number;
  };
}

interface AudioConfig {
  music: {
    active: boolean;
    tracks: string[];                // IDs de assets.json con kind "music", en el orden de la lista
    rotation: "sequential" | "shuffle"; // rotación: en orden o al azar sin repetir la pista que acaba de sonar
    volume: number;                  // 0..1
    crossfadeMs: number;             // fundido entre pistas y al encender o apagar
  };
}

interface BitacoraConfig {
  schemaVersion: 1;                  // Versión del contrato de CONFIGURACIÓN
  contentSetId: string;
  configRevision: string;
  mode: AppMode;
  editorNotes?: string;              // No se representa como contenido académico
  project: ProjectConfig;
  route: string[];
  placements: Record<string, Placement>;
  maps: Record<string, MapZone>;
  learnings: Record<string, Learning>;
  badges: Record<string, Badge>;
  dialogues: Record<string, Dialogue>;
  ui: UiConfig;
  gameplay: GameplayConfig;
  audio: AudioConfig;
}
```



El catálogo de recursos **no se redefine aquí**: el contrato base es el `assets.json` real. Los tipos TypeScript deben reflejarlo aproximadamente así, manteniendo un índice abierto para metadata especializada:

```ts
interface AssetManifest {
  version: number;
  project: string;
  basePath: string;
  pathConvention: string;
  assetCount: number;
  categoryCounts: Record<string, number>;
  notes?: string[];
  assets: Record<string, AssetEntry>;
  sourceDocuments?: SourceDocument[];
}

interface AssetEntry {
  path: string;
  type: string;                     // actualmente, principalmente "image"
  format?: string;
  category: string;
  label: string;
  kind: string;
  width?: number;
  height?: number;
  hasAlphaChannel?: boolean;
  transparent?: boolean;
  sizeBytes?: number;
  sha256?: string;
  originalPath?: string;

  // Metadata especializada observada en el manifiesto real:
  zone?: string;
  layer?: string;
  variant?: string;
  state?: string;
  text?: string;
  exampleFraction?: number;
  nineSlice?: { top: number; right: number; bottom: number; left: number };
  placement?: { relativeTo: string; x: number; y: number };
  poseCount?: number;
  visualLayout?: { columns: number; rows: number };
  rowDirections?: string[];
  requiresFrameDefinition?: boolean;

  // Permite preservar metadata futura sin que el loader la destruya.
  [key: string]: unknown;
}
```

No añadas un bloque `animations` al manifiesto solo porque el motor lo necesite. Si se crean definiciones de frames/animaciones, deben referenciar los IDs existentes y vivir en una capa técnica complementaria hasta que el usuario decida incorporarlas formalmente al catálogo.

Los IDs son la API estable entre ambos documentos. Cambiar `path` de `ui.badge.active-listening`, conservando su ID y el archivo correcto, no exige modificar `bitacora.json`; cambiar el `assetId` usado por una insignia sí es un cambio de configuración de la bitácora. No deduzcas IDs a partir de nombres de archivo.

Para rectángulos, `x/y` es la esquina superior izquierda; para círculos, el centro. Para el personaje, los checkpoints son la posición de sus pies en el mundo. Los offsets del cuerpo se definen en el espacio local del sprite y deben verificarse al aplicar escala. No confundir `origin` normalizado de un asset con coordenadas del mapa.

El archivo `bitacora.example.json` existente desarrolla este mismo contrato con seis aprendizajes, dos zonas y recursos pendientes. Sus dimensiones, posiciones y parámetros de movimiento son ilustrativos: deben ajustarse a los assets reales. No es el juego ejecutable ni certifica la implementación del cargador.

<a id="spec-12-5"></a>

### 12.5. Recorrido y ubicaciones: ejemplo mínimo

Este fragmento ilustra solo dos bloques del documento. No es por sí mismo una configuración completa:

```json
{
  "route": ["apr-a", "apr-b", "apr-c", "apr-d", "apr-e", "apr-f"],
  "placements": {
    "apr-a": {
      "zoneId": "zona-a",
      "position": { "x": 300, "y": 420 },
      "interactionOffset": { "x": 0, "y": 45 },
      "interactionRadius": 65
    },
    "apr-b": {
      "zoneId": "zona-a",
      "position": { "x": 700, "y": 280 },
      "interactionOffset": { "x": 0, "y": 45 },
      "interactionRadius": 65
    }
  }
}
```

Los IDs ilustrativos `apr-a` y `apr-b` no cambian de nombre al reordenarlos. La numeración se genera desde su índice en `route`. En React, usa esos IDs estables como claves, no el índice; esto importa al insertar y reordenar componentes. [T20]

<a id="spec-12-6"></a>

### 12.6. Operaciones editoriales esperadas

| Operación | Edición de datos | Resultado sin modificar componentes |
|---|---|---|
| Añadir aprendizaje | Crear `learnings[id]`, `badges[badgeId]`, `placements[id]` e insertar el ID en `route`. Reutilizar diálogos/assets cuando sea válido. | Nueva estación, numeración y total actualizados; inicialmente pendiente. |
| Retirar temporalmente | Quitar su ID de `route`. | Desaparece del recorrido, no bloquea ni cuenta; el material queda archivado. |
| Reordenar | Cambiar únicamente el orden de `route`. | Nueva secuencia de lecturas; posiciones y progreso por ID permanecen. |
| Mover de zona/lugar | Editar `placements[id]`; ajustar el entorno solo si hace falta. | Estación en otra posición, sin cambiar contenido ni orden. |
| Cambiar lectura | Editar `learnings[id].sections`; aumentar `contentRevision` solo si cambia sustancialmente el aprendizaje. | Mismos componentes, contenido actualizado. |
| Cambiar diálogo | Editar `dialogues[id]` o asociar un override en el aprendizaje. | Texto/interlocutor nuevo usando el panel existente. |
| Cambiar insignia | Editar `badges[id]` o su referencia de asset. | Presentación/XP derivados de la definición vigente. |
| Cambiar terreno | Sustituir el fondo y ajustar `maps`, colisiones y posiciones si cambian sus dimensiones. | Requiere revisión del arte; no se genera terreno automáticamente. |

Agregar no debe obligar a editar seis lugares con «el total de estaciones». **`route` es la única fuente de membresía y orden.** Reordena o archiva por ID, no renumerando entidades.

Una insignia diferente por aprendizaje activo, aunque varias puedan reutilizar la misma imagen provisional. Reemplazar su nombre o diseño no concede una segunda recompensa. La XP se deriva de su definición actual; cambiarla actualiza el total sin reproducir celebraciones antiguas.

<a id="spec-12-7"></a>

### 12.7. Diálogos y renderizado parametrizados

`ui.defaultDialogueIds` asigna mensajes comunes a `open`, `locked`, `completed` y `reward`; `learnings[id].dialogueOverrides` reemplaza solo los necesarios. Nunca dupliques el mismo diálogo completo en todas las estaciones para cambiar una palabra.

Permite únicamente estas variables inicialmente: `{studentName}`, `{learningTitle}`, `{previousLearningTitle}`, `{badgeTitle}`, `{completedCount}`, `{totalCount}`. Para `ui.labels.progressTemplate` usa los contadores y para `stationTitleTemplate`, `{number}` y `{title}`. El controlador calcula los valores; las cadenas no ejecutan expresiones.

Al abrir un aprendizaje disponible, muestra su diálogo de apertura en el mismo contenedor HTML de lectura, con acción para continuar. Para uno completado utiliza el mensaje de relectura. Un intento bloqueado muestra un mensaje y nunca abre sus contenidos. Al ganar una insignia usa el diálogo de recompensa asociado a la transición aceptada. No vuelvas a anunciar una recompensa en cada sincronización.

No inventes diálogos autobiográficos. Los mensajes de navegación pueden usar narrador; el ejemplo personal basado en semillas sigue siendo un borrador. Todos los diálogos deben admitir teclado, cierre visible y lectura sin efecto de máquina de escribir obligatorio. Las mismas reglas de pausa y foco se aplican a sus ventanas.

Los bloques académicos se representan con un registro explícito de renderizadores (`paragraph`, `heading`, `image`, `quote`, `reference`). No uses `dangerouslySetInnerHTML`, evalúes funciones ni aceptes componentes arbitrarios desde JSON. Un tipo de bloque desconocido produce un error editorial, no ejecución dinámica.

<a id="spec-12-8"></a>

### 12.8. Reglas de progreso derivadas

Calcula desde `route`, las definiciones vigentes y el progreso reconciliado:

- El total es el número de IDs activos; la XP máxima es la suma de sus insignias.
- Una estación completada con la revisión actual permite relectura aunque el orden haya cambiado.
- Para una estación pendiente, abrir o marcar exige que **todas las anteriores del recorrido activo** estén completadas y que el contenido sea admisible en el modo actual.
- `nextLearningId` es el primer ID activo sin completar; se calcula, no se guarda en JSON ni en progreso.
- Una ruta vacía muestra «Contenido por definir»: no celebra una finalización vacía.
- La ruta termina cuando no está vacía y todos sus aprendizajes tienen avance válido para el modo actual.
- Completar requiere todas las secciones marcadas como requeridas en `ui.tabs`; la operación es idempotente.
- Los IDs archivados nunca bloquean ni aumentan totales. La admisibilidad editorial no se usa para saltarse en silencio un borrador que sigue activo.

No diseñes un grafo de misiones o reglas arbitrarias para reemplazar este recorrido lineal. La configuración selecciona parámetros ya soportados; la lógica reside en funciones TypeScript puras.

<a id="spec-13"></a>

## 13. Persistencia y cambios de configuración

<a id="spec-13-1"></a>

### 13.1. Configuración y progreso son documentos diferentes

`bitacora.json` define la experiencia para todos los visitantes; **no debe modificarse para guardar lo que cada visitante leyó**. La aplicación conserva su avance en `localStorage`, que pertenece al navegador y al origen y puede no estar disponible o borrarse. No equivale a una cuenta ni a sincronización entre dispositivos. [T6]

Contrato previsto para el guardado:

```ts
interface LearningProgress {
  contentRevision: number;
  readSectionIds: SectionId[];
  lastSectionId?: SectionId;
  completedAt?: string;
}

interface SavedProgress {
  schemaVersion: 3;              // Versión del GUARDADO, no del JSON editorial
  contentSetId: string;
  mode: AppMode;
  currentZoneId: string;
  player: Point;                  // Pies en coordenadas del mundo
  checkpoints: Record<string, Point>;
  entries: Record<string, LearningProgress>;
}
```

La versión 3 distingue esta política de reconciliación de la propuesta anterior; no implica que exista ya un programa con versiones 1 o 2. Usa una clave que incluya `contentSetId`, modo y versión del guardado. Si existen guardados anteriores reales, escribe y prueba una migración o un reinicio informado. No cambies la clave de guardado por cada `configRevision`.

No guardes `currentStationIndex`, `nextLearningId`, posiciones dentro de `route`, totales, XP ni listas separadas de insignias. Derívalos desde las entradas activas. Usa los IDs estables como claves.

<a id="spec-13-2"></a>

### 13.2. Reconciliación después de editar el JSON

Antes de empezar, ejecuta una función pura `reconcileProgress(config, saved)`:

| Cambio de configuración | Tratamiento del avance |
|---|---|
| Mover una estación, corregir estilo o reordenar `route` | Conservar secciones e insignia por ID y revisión; no reiniciar el recorrido. |
| Añadir una estación | Crear avance vacío solo para el nuevo ID. Se vuelve pendiente en su lugar del recorrido. |
| Insertar una nueva antes de estaciones ya completadas | Mantener lo completado; el nuevo pendiente pasa a ser requisito para pendientes posteriores. Relecturas completadas siguen disponibles. |
| Retirar un ID de `route` | Excluirlo de requisitos, numeración y totales. Conservar su entrada archivada para una posible reactivación. |
| Reactivar el mismo ID y revisión | Recuperar su progreso válido archivado. |
| Cambiar sustancialmente `contentRevision` de un aprendizaje | Invalidar solo sus secciones y su finalización actual; no borrar las de todos los posteriores. |
| Cambiar una insignia, su imagen, nombre o XP | Recalcular presentación y totales, sin otorgar ni celebrar otra recompensa. |
| Eliminar o modificar una zona | Validar posición y checkpoints; reubicar en un punto seguro existente sin borrar lecturas. |
| Cambiar entre demo/final | Usar almacenes diferentes. No heredar finalizaciones demo. |
| Cambiar `configRevision` sin cambios de contenido | Revalidar, no reiniciar. |

Un cambio sustancial de contenido requiere que la autora o el editor aumenten explícitamente `contentRevision`; no lo hagas automáticamente al cambiar una coordenada, título o tilde. Una revisión obsoleta no cuenta para la finalización actual, aunque otras estaciones posteriores conserven sus insignias.

No asumas que el progreso completado debe formar siempre un prefijo contiguo de la lista: reordenar o insertar aprendizajes puede dejar pendientes entre estaciones completadas. Esa situación es válida bajo esta política. Solo los nuevos accesos a pendientes exigen haber completado todas sus anteriores.

Conserva entradas archivadas sanitizadas dentro de esta bitácora sin mostrarlas en los totales activos. No reutilices un ID eliminado para un tema totalmente diferente: asigna otro. Si faltan todos los contenidos activos, muestra el estado vacío sin celebrar.

<a id="spec-13-3"></a>

### 13.3. Guardado y recuperación

Guarda al marcar una sección, conceder una insignia y cambiar de zona. Recibe checkpoints de Phaser al detenerse o de forma espaciada; no escribas en cada fotograma. El adaptador pertenece a la aplicación: Phaser no escribe `localStorage`.

Valida JSON guardado, versiones, IDs, fechas, revisiones, secciones y coordenadas. Usa `try/catch` para lectura y escritura. Ante un fallo de almacenamiento, continúa en memoria y comunica discretamente que el avance puede perderse; no destruyas datos válidos por una configuración que falló al cargar.

Mantén solo datos serializables: no incluyas escenas, sprites, DOM, funciones, teclas ni referencias del puente. Comprueba que una posición restaurada sea transitable; si el punto es inválido, utiliza un spawn seguro de la zona o el inicio configurado.

«Reiniciar recorrido» requiere confirmación y borra solo la clave correspondiente a esta bitácora y modo. Reinicia además escena, checkpoints, controles y celebraciones pendientes. No borres todo el almacenamiento del origen ni el progreso del otro modo por accidente.

<a id="spec-13-4"></a>

### 13.4. Límites y publicación

El progreso local y los bloqueos son navegación, no seguridad ni acreditación. Quien acceda a los archivos estáticos puede inspeccionar el JSON, incluso sus aprendizajes archivados: no usar ese archivo para secretos ni evidencias cuya exposición no esté autorizada.

La edición del JSON es una tarea del propietario/desarrollador y forma parte del despliegue. No añadir cuentas, permisos editoriales ni un panel administrativo para cumplir esta primera versión. Si el JSON deja de estar disponible al recargar, conserva el guardado y ofrece reintento; no simules una bitácora vacía y la guardes encima.

<a id="spec-14"></a>

## 14. Responsive y accesibilidad

En escritorio, prioriza un mapa amplio con cabecera compacta. En móvil, conserva un tamaño útil del personaje y usa una cámara o zona visible del mundo; no reduzcas el mapa entero hasta que los letreros sean ilegibles.

Todos los elementos del mundo deben transformarse con la misma cámara. Los controles, la cabecera y los diálogos pertenecen a la interfaz y no se desplazan con el personaje.

Define como objetivo de diseño botones táctiles de al menos 44 × 44 píxeles CSS. La cruceta no debe tapar estaciones ni el botón de interacción. Al cambiar tamaño u orientación, conserva la posición lógica del personaje y reajusta la cámara.

Incluye una opción «Ver aprendizajes en lista». Permite abrir los aprendizajes disponibles o completados sin precisar el desplazamiento del personaje. Usa exactamente las mismas reglas de secuencia, lectura y recompensa: es una alternativa accesible de navegación, no un atajo para otorgar insignias.

Añade foco visible, etiquetas comprensibles y textos alternativos para evidencias. Los adornos deben ignorarse desde tecnologías de asistencia. No dependas únicamente del color para comunicar bloqueos o logros.

Respeta `prefers-reduced-motion`: elimina saltos repetidos, destellos y transiciones innecesarias, conservando una confirmación textual del logro. No reproduzcas sonido automáticamente al cargar: la única música es la de §6.4, que empieza solo tras una acción del visitante en la portada y se puede apagar en cualquier momento con un control accesible. [T7]

Mantén la tipografía del contenido a un tamaño cómodo y el ancho de lectura acotado. El zoom del navegador no debe ocultar botones esenciales ni provocar desbordamiento horizontal en los párrafos.

**Escala de la interfaz.** La interfaz HTML escala con la ventana: tamaños en unidades relativas (`rem`/`em`) sobre una raíz fluida y acotada (≈16 px en móvil y a 1280 px, hasta ≈24 px en pantallas muy grandes), de modo que cabecera, botones, pestañas, diálogos y texto de lectura se vean proporcionados en pantallas grandes y no queden diminutos. Los objetivos táctiles miden al menos 44 × 44 px CSS en cualquier escala. El tamaño de la interfaz y el del mundo son independientes: la cámara transforma el escenario y el CSS escala las ventanas.

Para esta implementación, plantea un canvas ajustado al contenedor mediante el Scale Manager y una cámara que muestra la porción necesaria del mapa; no uses las dimensiones del mundo como dimensiones obligatorias de pantalla. Selecciona y documenta una política de escala compatible con la versión de Phaser, inicialmente `RESIZE` con límites y zoom de cámara. No combines un redimensionamiento arbitrario por CSS con coordenadas de entrada que no reflejen ese cambio. [T12]

El contenedor debe tener dimensiones explícitas y actualizarse al cambiar orientación, cabecera o barras del navegador móvil. No fuerces orientación horizontal. Mantén los modales en una capa HTML superior con bloqueo de punteros al escenario, sin bloquear el scroll de lectura.

El canvas no es la única vía de acceso. La lista de aprendizajes, los mensajes y el contenido deben seguir funcionando aunque falle el renderizado del motor. Ofrece reintentar la carga del mapa y conservar el progreso; no sustituyas silenciosamente todo el minijuego por una lista cuando el motor sí funciona.

Comunica `prefers-reduced-motion` también a Phaser para desactivar sacudidas, destellos, seguimiento con transiciones innecesarias y celebraciones repetitivas. El CSS por sí solo no controla las animaciones dentro del canvas.

<a id="spec-15"></a>

## 15. Criterios de aceptación y entregables

<a id="spec-15-1"></a>

### 15.1. Resultados exigidos

Estos criterios describen el resultado requerido, no pruebas ya superadas. Los IDs `AC-01` a `AC-54` permiten relacionarlos con las tareas y evidencias de [PLAN.md](PLAN.md). No renumerarlos al actualizar el estado de implementación.

| ID | Prueba | Resultado esperado |
|---|---|---|
| <a id="ac-01"></a>AC-01 | Identidad académica | La portada muestra Vanessa Estrada, Universidad de Antioquia, Licenciatura en Educación Infantil, la asignatura «Desarrollo de la actitud científica en la infancia» y el semestre 2026 - 2; no se inventa el nombre de la docente. |
| <a id="ac-02"></a>AC-02 | Primera visita | Progreso vacío; primer ID de `route` disponible en demo; restantes bloqueados. |
| <a id="ac-03"></a>AC-03 | Movimiento | Flechas y cruceta funcionan; sin mayor velocidad diagonal ni salida del terreno permitido. |
| <a id="ac-04"></a>AC-04 | Interacción | El contenido se abre por acción explícita cerca de una estación o desde la navegación accesible. |
| <a id="ac-05"></a>AC-05 | Lectura | Abrir o cambiar de pestaña no concede la insignia; cerrar conserva las secciones marcadas. |
| <a id="ac-06"></a>AC-06 | Recompensa | Marcar las cuatro secciones y confirmar otorga una sola insignia y desbloquea la siguiente. |
| <a id="ac-07"></a>AC-07 | Repetición | Doble clic, Enter mantenido o relectura no duplican XP ni recompensas. |
| <a id="ac-08"></a>AC-08 | Zonas | Portales explícitos de ida y regreso desde el inicio; viajar no desbloquea lecturas. |
| <a id="ac-09"></a>AC-09 | Persistencia | Recargar recupera avance; datos inválidos o almacenamiento bloqueado no rompen la aplicación. |
| <a id="ac-10"></a>AC-10 | Teclado | Las flechas del diálogo no mueven al personaje; Escape cierra; el foco se restaura. |
| <a id="ac-11"></a>AC-11 | Dispositivos | El recorrido se puede completar en móvil y escritorio, también mediante la lista accesible. |
| <a id="ac-12"></a>AC-12 | Contenido | Editar `bitacora.json` cambia títulos, bloques, diálogos e insignias sin tocar React/Phaser; cambiar el `path` de un ID estable en `assets.json` reemplaza el recurso sin editar la bitácora; no se inventan relatos. |
| <a id="ac-13"></a>AC-13 | Modo de entrega | El progreso demo no contamina el final; los borradores no se presentan como aprobados. |
| <a id="ac-14"></a>AC-14 | Separación de capas | Movimiento y sprites en Phaser; párrafos, pestañas y controles de lectura en React. |
| <a id="ac-15"></a>AC-15 | Ciclo de vida | Un canvas y una instancia activa; abrir lecturas o ganar insignias no reinicia el motor. |
| <a id="ac-16"></a>AC-16 | Inicialización | Recargar con progreso previo pinta las estaciones correctas desde la primera sincronización. |
| <a id="ac-17"></a>AC-17 | Pausa | La exploración se detiene al leer y se reanuda sin depender de un `update()` pausado. |
| <a id="ac-18"></a>AC-18 | Eventos | Cambiar repetidamente de zona no multiplica listeners, recompensas ni solicitudes. |
| <a id="ac-19"></a>AC-19 | Efectos | Cargar progreso o repetir una acción no vuelve a celebrar insignias históricas. |
| <a id="ac-20"></a>AC-20 | Error de motor o asset | Un `assetId` faltante, `path` que no resuelve, archivo ausente o metadata incompatible produce diagnóstico con el ID afectado; el progreso no se elimina y la lista accesible sigue disponible cuando proceda. |
| <a id="ac-21"></a>AC-21 | Escala | Redimensionar no cambia coordenadas lógicas ni desajusta los puntos de interacción. |
| <a id="ac-22"></a>AC-22 | Producción | Tipos, pruebas, validación de `bitacora.json`, validación fiel del manifiesto existente y build ejecutados; `assets.json` resuelve sus `path` según `pathConvention` desde la base de despliegue. |
| <a id="ac-23"></a>AC-23 | Cantidad variable | Las configuraciones de cinco, seis y siete estaciones funcionan con el mismo código. |
| <a id="ac-24"></a>AC-24 | Distribución | Mover una estación de zona solo cambia `placements`; el orden no se altera. |
| <a id="ac-25"></a>AC-25 | Reordenación | Cambiar `route` renumera y redefine pendientes sin mover sprites ni perder insignias por ID. |
| <a id="ac-26"></a>AC-26 | Archivo | Quitar un ID de `route` lo retira de requisitos y totales; puede reactivarse con avance vigente. |
| <a id="ac-27"></a>AC-27 | Inserción | Insertar un pendiente antes de completados conserva los completados y recalcula los siguientes accesos. |
| <a id="ac-28"></a>AC-28 | Revisión | Un cambio sustancial invalida solo ese aprendizaje; cambiar coordenadas no reinicia nada. |
| <a id="ac-29"></a>AC-29 | Configuración inválida | ID desconocido, `assetId` inexistente, referencia cruzada inválida, manifiesto incoherente o definición de frames no validada generan error localizado, no un mundo parcial. |
| <a id="ac-30"></a>AC-30 | Ruta vacía | Se muestra preparación, no una celebración por cero aprendizajes. |
| <a id="ac-31"></a>AC-31 | JSON/guardado | El JSON compartido nunca contiene ni se modifica con el avance individual. |
| <a id="ac-32"></a>AC-32 | Arte modular | Quitar una estación no deja un título o insignia pintados dentro del fondo. |
| <a id="ac-33"></a>AC-33 | Manifiesto real | La implementación consume las claves y campos existentes de `assets.json` (`path`, `kind`, categorías y metadata especializada) sin migrarlo silenciosamente a otro contrato. |
| <a id="ac-34"></a>AC-34 | Resolución de rutas | Los assets se cargan resolviendo cada `path` respecto al directorio del manifiesto y su `basePath/pathConvention`; no se antepone `assets/` dos veces ni se usan `originalPath` en runtime. |
| <a id="ac-35"></a>AC-35 | Hojas de poses | Un recurso con `requiresFrameDefinition: true` no se corta automáticamente usando `visualLayout`; cualquier animación usa frames inspeccionados y validados contra la imagen real. |
| <a id="ac-36"></a>AC-36 | Metadata especializada | `nineSlice`, `placement`, `zone/layer/variant`, estados de botón y demás metadata existente se reutilizan cuando aplica y no se duplican con valores contradictorios en componentes. |
| <a id="ac-37"></a>AC-37 | Encuadre | En móvil, 1280×720, 1920×1080, 2560×1440, 4K y ultraancho el mapa cubre todo el canvas, sin franjas vacías ni anclaje a una esquina; si la vista fuera mayor que el mundo, se centra. |
| <a id="ac-38"></a>AC-38 | Escala del mundo | El personaje mide al menos el 12 % de la altura del canvas en cada tamaño probado y los letreros son más altos que él; sus textos y marcas escalan con ellos. |
| <a id="ac-39"></a>AC-39 | Interfaz proporcional | Cabecera, botones, pestañas, diálogos y lectura crecen con la ventana (a 1920 px el tamaño base es ≥ 1,2 × el de 1280 px), sin desbordes y con objetivos táctiles ≥ 44 px. |
| <a id="ac-40"></a>AC-40 | Kit integrado | Las piezas del kit se añaden a `assets.json` sin alterar las entradas existentes; sus archivos y atlas existen, `sizeBytes`/`sha256` coinciden y las regiones de cada atlas son válidas contra su imagen. |
| <a id="ac-41"></a>AC-41 | Paisaje vivo | Cada zona muestra agua, cascadas, espuma, nubes, plantas y partículas animadas colocadas solo con `maps[].ambient`; los fotogramas realmente cambian. |
| <a id="ac-42"></a>AC-42 | Movimiento reducido | Con `prefers-reduced-motion` no hay bucles, vaivenes, deriva ni partículas; las hojas animadas muestran un fotograma fijo. |
| <a id="ac-43"></a>AC-43 | Rendimiento y ciclo de vida | Con todo el ambiente activo la mediana es ≥ 50 fps; cambiar de zona repetidamente no deja objetos, emisores ni tweens residuales. |
| <a id="ac-44"></a>AC-44 | Contrato `ambient` | Un `assetId` inexistente, un tipo incoherente con la metadata, una posición fuera de la zona o un atlas inválido producen un error localizado y no un mundo parcial. |
| <a id="ac-45"></a>AC-45 | Colocación coherente | Ondas y espuma quedan dentro del agua, las plantas fuera de los caminos transitables, y los efectos no cambian colisiones ni la alcanzabilidad. |
| <a id="ac-46"></a>AC-46 | Edición por JSON | Mover, quitar o añadir un efecto ambiental solo cambia `maps[].ambient`; no requiere tocar código ni el manifiesto. |
| <a id="ac-47"></a>AC-47 | Piezas adicionales integradas | Las once piezas del segundo kit se añaden a `assets.json` sin alterar las entradas existentes; archivos, atlas, hashes y regiones son válidos y el manifiesto conserva `blendMode`, `opacity` y el movimiento `pulse`/`swim`. |
| <a id="ac-48"></a>AC-48 | Luces del árbol | La guirnalda, el farol, el halo, los rayos y los destellos se ven animados sobre árboles del fondo; el halo y los rayos usan mezcla aditiva con opacidad baja; ninguna pieza con cuerpo cae sobre suelo transitable. |
| <a id="ac-49"></a>AC-49 | Patos | Los patos nadan de ida y vuelta por agua navegable, se voltean según el sentido y su trayectoria no cruza puentes, rocas ni orillas ni suelo transitable; con movimiento reducido quedan quietos. |
| <a id="ac-50"></a>AC-50 | Música de fondo | Tras pulsar «Comenzar» suena una pista; al terminar empieza la siguiente y tras la última vuelve la primera (rotación `sequential`); no suena nada antes de la acción del visitante. |
| <a id="ac-51"></a>AC-51 | Control de música | Un botón accesible (etiqueta textual, foco, ≥ 44 px, teclado) apaga y enciende la música; la preferencia se conserva entre visitas, sobrevive al reinicio del recorrido y respeta que apagada no suena sola. |
| <a id="ac-52"></a>AC-52 | Continuidad y recursos del audio | La música no se corta ni reinicia al cambiar de zona, abrir una lectura o redimensionar; se pausa con la pestaña oculta; al abrir la página no se descargan las tres pistas; un fallo de carga o de reproducción no rompe el juego. |
| <a id="ac-53"></a>AC-53 | Contrato de audio | Un ID de pista inexistente, repetido o de otro `kind`, un volumen fuera de rango o un fundido imposible producen un error localizado; el archivo de audio debe existir (error) y su tamaño y hash se contrastan (aviso), como el resto de assets. |
| <a id="ac-54"></a>AC-54 | Créditos de música | La atribución de cada pista vive en el manifiesto y no se muestra en la portada; una atribución sin verificar bloquea la entrega final y nunca se inventa. |

<a id="spec-15-2"></a>

### 15.2. Entregables exigidos

La entrega de implementación debe incluir código funcional, `bitacora.json`, el `assets.json` existente preservado, el esquema/validador de configuración y, si se crea, un esquema fiel del manifiesto real; además del ejemplo de demostración, archivos de assets organizados, README operativo, pendientes documentados y resultados reales de las pruebas. El plan de trabajo y el detalle de ejecución de esas pruebas pertenecen a `PLAN.md`.

El README debe explicar versiones reales, instalación y scripts; ubicación, carga y esquema del JSON; cómo agregar, retirar, reordenar y mover estaciones; cómo editar lecturas, diálogos, insignias, colisiones y animaciones; validación; modos demo/final; diferencias entre revisiones de configuración, contenido y guardado; conservación de progreso; pruebas y pendientes; compilación, publicación de nuevos JSON y caché. No copiar en el README toda esta especificación ni el plan.

Vite permite generar una compilación estática; el directorio de salida y los comandos documentados deben coincidir con el proyecto real. Una vista previa local no demuestra que el sitio esté publicado. Las verificaciones deben diferenciar dispositivo real, emulación y ventana redimensionada. [T15]

**Prioridad final: una bitácora universitaria legible, personal y reflexiva, recorrida como un pequeño videojuego pixel art. El mapa y las recompensas acompañan el contenido; no lo reemplazan.**

<a id="spec-16"></a>

## 16. Límites de alcance y datos pendientes

Los contenidos académicos definitivos, la reflexión final, las evidencias, la distribución precisa, el inventario de assets y el destino de publicación continúan sujetos a los datos reales y a las aprobaciones correspondientes. No dar por resueltos esos puntos al separar la documentación. Su seguimiento operativo se mantiene en [PLAN.md, sección 5](PLAN.md#plan-5).

No añadir por iniciativa propia cuentas, clasificación de visitantes, notas, cuestionarios, combate, cronómetros, editor administrativo o analítica externa. Las insignias expresan recorrido confirmado por el visitante; no prueban dominio académico ni sirven para evaluar a Vanessa.

No obtener ni inventar un escudo institucional para completar la portada. Los datos académicos pueden presentarse tipográficamente. No publicar archivos de evidencias con datos de otras personas sin que el usuario haya revisado su inclusión.

No se requiere `AGENTS.md`. Si el entorno ya utiliza uno, debe remitir a `.claude/SPEC.md` para requisitos y a `.claude/PLAN.md` para ejecución, sin crear otra especificación competidora.

## Referencias técnicas

Las decisiones de producto, la estructura de código, los nombres del puente y los textos de ejemplo son propuestas para este proyecto. Estas fuentes respaldan APIs y patrones técnicos; no son bibliografía académica de la asignatura. Consulta documentación compatible con las versiones efectivamente instaladas. Las referencias se conservan de la revisión anterior; esta separación documental no constituye una nueva verificación de versiones o APIs.

- [T0] Plantilla oficial Phaser + React + TypeScript + Vite y puente de eventos: `https://github.com/phaserjs/template-react-ts`
- [T1] React, efectos, dependencias y limpieza: `https://react.dev/reference/react/useEffect`
- [T2] Phaser, escenas, ciclo, pausa y reanudación: `https://docs.phaser.io/phaser/concepts/scenes`
- [T3] MDN, renderizado de pixel art: `https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look`
- [T4] W3C APG, diálogos modales: `https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/`
- [T5] W3C APG, pestañas: `https://www.w3.org/WAI/ARIA/apg/patterns/tabs/`
- [T6] MDN, localStorage: `https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage`
- [T7] MDN, movimiento reducido: `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion`
- [T8] Phaser, Arcade Physics: `https://docs.phaser.io/phaser/concepts/physics/arcade`
- [T9] Phaser, sistema de entrada: `https://docs.phaser.io/phaser/concepts/input`
- [T10] Phaser, configuración y ciclo de vida de Game: `https://docs.phaser.io/phaser/concepts/game` y `https://docs.phaser.io/api-documentation/class/game`
- [T11] Phaser, cámaras: `https://docs.phaser.io/phaser/concepts/cameras`
- [T12] Phaser, Scale Manager: `https://docs.phaser.io/phaser/concepts/scale-manager`
- [T13] Phaser, animaciones: `https://docs.phaser.io/phaser/concepts/animations`
- [T14] Vite, build y base pública de assets: `https://vite.dev/guide/build`
- [T15] Vite, compilación y despliegue estático: `https://vite.dev/guide/static-deploy`
- [T16] Dependencias y scripts de la plantilla oficial consultada: `https://github.com/phaserjs/template-react-ts/blob/main/package.json`

- [T17] JSON Schema, contrato y propiedades de objetos: `https://json-schema.org/understanding-json-schema/reference` y `https://json-schema.org/understanding-json-schema/reference/object`
- [T18] Vite, recursos estáticos y directorio public: `https://vite.dev/guide/assets`
- [T19] TypeScript, aserciones de tipos y ausencia de validación de ejecución: `https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions`
- [T20] React, listas y claves estables: `https://react.dev/learn/rendering-lists`
- [T21] Phaser, imágenes de fondo y objetos estáticos: `https://docs.phaser.io/phaser/concepts/gameobjects/image`
