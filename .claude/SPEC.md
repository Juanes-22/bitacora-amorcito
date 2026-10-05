# SPEC.md — Bitácora interactiva de Vanessa Estrada

**Documento:** especificación funcional y técnica; fuente de verdad de los requisitos.  
**Stack:** React + Vite + TypeScript + Phaser.  
**Revisión documental:** 31. La revisión 31 incorpora los **efectos de sonido** y su herramienta de autoría: (a) un catálogo de efectos (`kind` «sfx», bajo `public/assets/audio/sfx/`) separado de la música; (b) sonidos colocados en el mapa —puntos y áreas con alcance, en bucle, por intervalo o al entrar— que Tiled administra en `maps.json` (§12.9), y efectos de interfaz y recompensa (`audio.sfx`, en `bitacora.json`); (c) el motor de efectos, único por juego, con atenuación por distancia, límite de voces y silencio de lectura; (d) el botón público «Sonido», que silencia música y efectos juntos; y (e) el **laboratorio de sonidos**, solo de desarrollo, para escuchar, ajustar y guardar en el proyecto (§6.5, AC-88 a AC-95). Los sonidos incluidos son tonos de prueba generados, no sonidos finales. Además (f) incluye **tipografías propias** —Nunito y Gelasio, servidas desde el sitio— para que el móvil no dependa de las fuentes del sistema (§14, AC-96), y (g) corrige la composición en móviles reales: cápsulas de avance sin pisar su borde, índice de la Bitácora desplazable entero con el pie a la vista y la presentación en una sola sans-serif (§14, AC-97). La revisión 30 (a) incorpora el kit `bitacora-panel-aprendizajes`: la lista de aprendizajes y la lectura pasan a ser la «Bitácora de aprendizajes» (índice con tarjetas y lector con ilustración, palabras clave y la insignia al lado), y un aprendizaje se abre directo en su lectura, sin la ventana de apertura (§7, §14, AC-83); (b) hace que un aprendizaje sin completar solo se explore y se complete desde su estación —ya completado se relee desde cualquier sitio y «Ver aprendizaje» lleva a él— (§8, AC-84); (c) incorpora la versión 1.1.0 de los kits de insignias, que añade la de Rocky: una insignia secreta de recuerdo que solo aparece en la colección al terminar todos los aprendizajes (§9, AC-85); (d) separa `maps` y `placements` de `bitacora.json` en `maps.json`, que administra Tiled (§12, AC-86); (e) incorpora el kit `bitacora-panel-presentacion`: la portada pasa a ser la «presentación», con el letrero de madera, la asignatura, la ilustración de Vanessa y Jerry y el botón de continuar sobre un pergamino (§5, AC-87); y (f) ajusta la Bitácora de aprendizajes: la X cambia al pasar el cursor, el lector abre sin anillo de foco sobre «Resumen», el lateral conserva el tamaño natural de la ilustración y la insignia (se desplaza si no cabe), y la ficha de Rocky usa la etiqueta «Obtenida» como las demás mientras la de Jerry dice «Jerry» y, debajo, «Compañero de aventuras» (§7, §9, AC-83, AC-85). La revisión 29 pasa la configuración a modo final con los seis aprendizajes aprobados por Vanessa, quita el aviso de «Contenido de demostración» (opcional) y hace que la «Reflexión final» solo aparezca si la autora la escribe (§5, §9, §10, AC-13). La revisión 28 carga cada zona por etapas, con barra de carga, para que el mapa aparezca pronto en el móvil (§11.4, AC-82). La revisión 27 adopta Tiled como editor externo de los datos espaciales de las zonas, con importación validada hacia `bitacora.json` (§12.9, AC-81). La revisión 26 incorpora el kit `bitacora-panel-insignias`: la colección de insignias pasa a ser un panel con tarjetas, cápsula de progreso, tarjeta de Jerry y una vista de detalle por insignia (§7, §14, AC-80). La revisión 25 incorpora las siete insignias del paquete `bitacora-insignias`: una por aprendizaje, con su nombre y significado, y la de Jerry, que se concede al terminar el recorrido (§5, §9, AC-79). La revisión 24. La revisión 24 añade las gallinas y los pollitos animados que andan por las zonas (§3.3, AC-78) y retira algunas flores animadas que les estorbaban. La revisión 23. La revisión 23 carga los seis aprendizajes reales de Vanessa en lugar del borrador de plantas y los cinco textos de demostración (§9). La revisión 22. La revisión 22 amplía la zona sensible del cartel del portal para tocarlo o hacer clic (§4.3, AC-77). La revisión 21. La revisión 21 deja tres ventanas por aprendizaje —Resumen, Reflexión y Lo vivido—: se retira «En el aula» y «Aprendizajes» pasa a llamarse «Resumen» (§7, §10, AC-06). La revisión 20. La revisión 20 permite caminar con el ratón en escritorio, con clics sobre el mapa como en los juegos de ratón (§6.1, AC-76). La revisión 19. La revisión 19 incorpora el paquete `bitacora-ui-assets` y rediseña lo que lo usa: el letrero de estación lleva su número en un círculo, el título corto en la placa y el estado debajo («Siguiente», «Completado» o el candado); la señal de cambio de mapa, los botones con etiqueta (Bitácora, Jerry, Sonido), el brillo de la próxima estación con destellos; las estaciones se colocan sobre pasto junto al camino (§4.3, AC-72, AC-75); la cabecera es más compacta, sin el rótulo «Mi bitácora» ni el aviso de lo que sigue, y en el móvil el mapa llena la pantalla con la interfaz encima (§14, AC-74); y Vanessa y Jerry llevan una sombra (§6.2, AC-73). La revisión 18 quita la cruceta y su botón de cambio de modo (en móvil solo se camina tocando; AC-03, AC-60) y sustituye el retrato de la cabecera por el avatar animado de Vanessa y Jerry: reposo y alegría al completar una estación (§14, `kind` «avatar-sheet», AC-71). La revisión 17 añade las animaciones de la estrella de XP y del aro de la próxima estación y el panel de nueve zonas de la cabecera (§4.3, §14, AC-68 a AC-70). La revisión 16 La revisión 16 deja un solo «Cerrar» por ventana, sin recuadro en el foco de los botones verdes, y centra las herramientas con la cabecera (§14). La revisión 15 La revisión 15 sustituye los botones de la cabecera por los iconos del paquete `bitacora-assets-senalados-v2` (§14, AC-67). La revisión 14 La revisión 14 sustituye la hoja de trucos por su versión corregida (Vanessa a la misma altura que al caminar, §6.2). La revisión 13 La revisión 13 añade los trucos de Jerry y la búsqueda del peluche, que el visitante pide con la tecla P o con un botón y se turnan (§6.2, AC-65 y AC-66). La revisión 12 La revisión 12 añade las animaciones de reposo de Vanessa y Jerry (§6.2, `kind` «idle-sheet», AC-62 a AC-64). La revisión 11 sustituye la cruceta por defecto en móvil por «tocar para caminar» (la cruceta pasa a ser un ajuste), con los criterios AC-58 a AC-61 (§6.1). Antes, la 11. La revisión 11 sustituye la cruceta por defecto en móvil por «tocar para caminar» (la cruceta pasa a ser un ajuste), con los criterios AC-58 a AC-61 (§6.1). La revisión 10 añade (c) las flores y arbustos animados fotograma a fotograma (`bitacora-flowers-bushes-animations`; §3.2) y el límite de efectos por zona, con los criterios AC-55 a AC-57. La revisión 9 añade (a) las piezas adicionales del paisaje (`bitacora-landscape-extras`: luces del árbol, patos, nubes y partículas luminosas; §3.2) y (b) la música de fondo con rotación de pistas y control de encendido/apagado (§6.4, §14), con los criterios AC-47 a AC-54. La revisión 8 (a) añade el kit de animaciones del paisaje (§3.2), el encuadre y la escala visual (§6.3, §14) y los criterios AC-37 a AC-46; y (b) alinea el contrato de §12.4 y el puente de §11.5 con lo ya implementado en las fases 1 a 4. El contrato de assets se adapta al `assets.json` real entregado por el usuario. Ese manifiesto existente es autoritativo: conserva sus IDs, `pathConvention`, `path`, categorías, `kind`, dimensiones, transparencia, procedencia y metadatos específicos; no se reemplaza por un esquema inventado.  
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
| Terreno | Imágenes de fondo y objetos independientes. El juego no usa tilesets; Tiled es solo una herramienta de autoría opcional (§12.9) y ni el juego ni el build necesitan la aplicación. |
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

El texto de bienvenida es provisional. `finalReflection` recibe bloques de contenido cuando Vanessa aporte su cierre; una lista vacía no autoriza a inventarlo y **no muestra nada** (ni título ni aviso): la sección «Reflexión final» del cierre solo aparece si hay texto, y su ausencia no bloquea la publicación.

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

#### Flores y arbustos animados (`bitacora-flowers-bushes-animations`)

Tercer kit del paisaje: seis plantas con ocho fotogramas cada una (margaritas, flores rosadas, girasoles, espigas moradas, arbusto redondo y arbusto con flores). A diferencia de las plantas del primer kit (una imagen que se mece por rotación), estas **se animan fotograma a fotograma** con su atlas, que compensa la posición de la raíz en un lienzo lógico común. Se integran con las mismas reglas (copia con sus bytes, entradas **añadidas** a `assets.json` con `kind` `animation-sheet`, atlas validados contra su imagen) y se colocan con el efecto `animation`.

- El anclaje (`origin`) es la raíz de la planta: la posición del efecto es el punto del suelo donde nace.
- Cada instancia puede variar `startFrame` (aleatorio, ya implícito) y la velocidad con `speedFactor` (multiplicador de la velocidad del manifiesto, > 0) para que no se balanceen todas a la vez.
- Son piezas independientes, no sustituyen a las pintadas: se colocan en espacios libres sobre suelo no transitable. Superponerlas directamente sobre una planta pintada produce un doble contorno durante el balanceo, por lo que se evita, y la raíz va sobre césped o el borde del sendero sin tapar los puntos interactivos.
- Presupuesto: cada zona admite como máximo 60 efectos en `ambient` (error de validación); el coste real se comprueba con la mediana de fotogramas por segundo (AC-43).

<a id="spec-3-3"></a>

### 3.3. Gallinas y pollitos

El paquete `bitacora-chickens-animations` aporta cinco gallinas (gris esponjosa, negra con copete, blanca, café y blanca esponjosa) y un pollito negro y gris, cada uno con tres animaciones de cuatro fotogramas —reposo, caminar y picotear— y la duración en ms de cada fotograma. Entran en `assets.json` como entradas nuevas de `kind` «critter-sheet» (`fauna.hen.*` y `fauna.chick.black`) con `atlasPath`, `sourceFrameSize` (448 × 448), `origin` (las patas), `recommendedDisplay` (48 × 48 las gallinas, 24 × 24 el pollito) y `critterAnimations`; los PNG conservan sus bytes y los dibujos miran a la derecha (se voltean para mirar a la izquierda). `scripts/tools/add-chickens.py` hace la integración sin alterar lo anterior.

`maps[zona].critters` (opcional) las coloca: `wander` (una gallina: `assetId`, `position` —las patas—, `radius` del círculo por el que merodea, `scale`, `flipX`) o `family` (una gallina con `chicks` pollitos, de 0 a 8, que reutilizan una misma hoja). Cada gallina reposa de 2 a 5 s, picotea (el 40 % de las veces, de una a tres repeticiones) o pasea a un punto de su círculo a unos 18 px/s, con velocidad y arranque algo distintos para no ir sincronizadas; nunca sale de su círculo. Los pollitos van a los puntos del recorrido que dejó su madre, cada uno a su distancia (≈ 17 px), y cuando ella se detiene reposan o picotean. Cada animalito lleva una sombra suave y se ordena por profundidad con su altura, como Vanessa. Con movimiento reducido se quedan quietos en su primer fotograma. Si la hoja de una raza no carga, las demás siguen y se informa de su archivo. No chocan con nada ni se les detecta el terreno: **la configuración debe ponerlas sobre pasto despejado**, lejos de agua, de los letreros de las estaciones y de las plantas que se superpondrían. Presupuesto: como máximo 30 animalitos por zona, contando los pollitos. La zona del pabellón lleva la familia de la gallina blanca esponjosa con cuatro pollitos sobre el pasto verde claro al pie del gran árbol (bajo el letrero 6), donde mejor contrasta; para darles sitio se quitaron las flores animadas del paisaje que caían sobre ellas.

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

**Identidad del letrero.** El letrero de cada estación (`station.sign.board`, del paquete `bitacora-ui-assets`) cuenta qué se va a descubrir y en qué punto está el recorrido. La imagen no trae texto: su entrada de `assets.json` da las zonas donde ponerlo (`labelZones`, en píxeles de la textura desde su esquina superior izquierda) y el ancla de lo que se pega debajo (`attachments`, centro y tamaño). El **número** va en el círculo de arriba (`number`); el **título corto** del aprendizaje (`signTitle`, de 1 a 40 caracteres; sin él, `title`) en la placa (`title`), con la letra más grande que quepa en sus líneas máximas y, si ni a la mínima cabe, acortado con «…». Debajo de la placa, en el ancla `completed`, va el estado: una estación **completada** muestra la insignia «Completado» (`ui.assets.completedBadge`, con su texto en su propia zona); la **próxima** (la única disponible), una píldora verde «Siguiente»; una **bloqueada**, el candado, con el número y el título atenuados. Con un letrero propio de la estación (`placements.*.signAssetId`) que no declare `labelZones` solo se dibuja el número centrado, como antes. La próxima estación lleva además el brillo animado (`effect.station-glow.pulse`, 8 fotogramas a 8 fps con la opacidad del manifiesto) bajo la señal y destellos dorados (`ui.assets.stationSparkle`: cinco por estación que aparecen en puntos al azar alrededor, centellean una vez y reaparecen; sin ellos con movimiento reducido), y la estrella de XP se posiciona sobre el círculo del número. **Colocación:** cada letrero debe apoyar en pasto junto al camino, no sobre el camino, flores, vallas ni escalones, con su punto de interacción (`interactionOffset`) en terreno transitable al alcance del recorrido por toque. La señal de cambio de mapa (`ui.assets.exitSign`, `kind` «exit-sign») sustituye al anillo del portal: un cartel con una flecha y el nombre del destino (`portal.label`), volteado hacia el borde del mapa por el que se sale; el anillo sigue siendo el área sensible, sin dibujarse. Los iconos por aprendizaje que se probaron en la primera versión del letrero se retiraron con el nuevo diseño.

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

**Presentación (kit `bitacora-panel-presentacion` v2.0.0).** Con `ui.presentation`, la portada es la presentación del kit (`Presentation.tsx`): siete piezas `ui.presentation.*` (`kind` «presentation-part»: el pergamino de nueve zonas con corte 160, el letrero de madera con flores, la ilustración de Vanessa y Jerry, el botón «Continuar» vacío, la ramita —que se refleja para el lado derecho—, el brote y el separador con semilla; los PNG conservan sus bytes y el kit se archiva en `docs/source/presentation/`; las piezas reutilizadas del kit —cerrar y destellos— no se copian). Sobre el pergamino: en el letrero, el título («Mi bitácora») y el subtítulo; a la izquierda, el rótulo «ASIGNATURA», la asignatura, el separador, la estudiante, el programa, la universidad y «Semestre 2026 - 2» (y el docente si se informa), y la frase destacada con el texto de bienvenida; a la derecha, la ilustración; y abajo el botón con sus ramitas. Sin botón de cerrar: solo se continúa. Los textos salen de `project` (`title`, `subtitle`, `courseName`, `studentName`, `program`, `university`, `semester`, `teacherName`, `welcomeTitle`, `welcomeText`) y de `ui.labels`; solo el rótulo «ASIGNATURA» y el texto alternativo de la ilustración están en `ui.presentation.labels`. `subtitle` y `welcomeTitle` son opcionales; con subtítulo, el título completo de la pestaña del navegador y de la cabecera es «título — subtítulo» (`fullTitle`). En escritorio y tableta (más de 800 px) el panel conserva la proporción de la maqueta (1040 × 716) y se reduce entero para caber en la pantalla, a lo ancho y a lo alto, con todas las medidas en unidades del propio panel (`cqw`); en móvil pasa a una columna con desplazamiento y medidas en `rem`. El foco inicial va al botón sin anillo y sin desplazar la portada; el anillo aparece al usar el teclado. Sin `ui.presentation` se usa la portada sencilla.

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

Al completar el recorrido, presenta las insignias obtenidas y, solo si la autora escribió su reflexión final (`project.finalReflection`, editable), esa reflexión con su título; sin texto no se muestra ningún espacio ni aviso. No generes una conclusión autobiográfica como si ya hubiera sido escrita por ella.

Permite volver a las estaciones completadas y revisar sus contenidos en cualquier momento.

<a id="spec-6"></a>

## 6. Movimiento, controles y animación en Phaser

<a id="spec-6-1"></a>

### 6.1. Controles y foco

En escritorio, las flechas mueven a Vanessa y `Enter` interactúa. `Escape` cierra la lectura desde React.

**Controles táctiles y de ratón.** Con el dedo, y en escritorio con el ratón, se camina y se explora tocando o haciendo clic en el mapa (con el ratón valen el botón izquierdo y el derecho —sin el menú del navegador sobre el mapa— y mantener el botón pulsado y arrastrar reorienta el destino; el botón central no hace nada); no hay cruceta ni botón para cambiar de modo (la revisión 18 la retiró: `gameplay.touchControls`, sus textos y `ui.assets.controlsButton` ya no existen).

- **Tocar para caminar.** Un toque en el mapa lleva a Vanessa hasta ese punto por el camino que el mapa permite: la ruta se calcula sobre la misma rejilla de obstáculos que valida la alcanzabilidad (§4.4), de modo que rodea arbustos, vallas y rocas en lugar de chocar con ellos; si se toca una zona no transitable, camina hasta su orilla alcanzable más cercana. Donde se tocó aparece un círculo animado (una onda que se expande y un anillo que late en el destino hasta que llega); con `prefers-reduced-motion` el anillo aparece quieto y sin onda. Arrastrar el dedo reorienta el destino. Cualquier flecha del teclado, una ventana abierta, una solicitud de apertura, un cambio de zona o un nuevo toque cancelan o sustituyen el recorrido. El recorrido entrega un vector al mismo ciclo de movimiento que usan las flechas (§6.2); no hay un segundo sistema de movimiento.
- **Explorar tocando la estación.** Estando Vanessa junto a una estación o un portal (dentro de su radio de interacción), tocar su señal o su anillo equivale a «Explorar» y sigue exactamente las mismas reglas de secuencia que `Enter` (§8): una estación bloqueada o pendiente solo muestra su mensaje. Si aún no está junto a ella, tocarla lleva a Vanessa a su punto de interacción sin abrirla; un segundo toque la abre. El aviso de proximidad dice «Toca la estación para explorar» (o «Toca el portal para viajar») en lugar de «Enter».
- En escritorio el teclado sigue funcionando igual (flechas y Enter, y el aviso de proximidad habla de Enter); además, un clic en el mapa funciona exactamente como un toque: mismo cálculo de ruta, mismo círculo de destino, mismas reglas al hacer clic sobre una estación o un portal. Una ventana abierta bloquea los clics igual que los toques, y cualquier flecha cancela el recorrido.

Habilita las flechas del juego solo cuando el área del mapa tiene el foco o hay un control táctil activo, no hay una ventana modal y la aplicación está visible. Desactiva también la captura preventiva de esas teclas fuera de ese contexto: deshabilitar solo la lógica de movimiento no basta si se sigue impidiendo el comportamiento normal del navegador. `Tab` debe permitir entrar y salir del mapa. [T9]

Al perder el foco, ocultarse la pestaña, abrirse un diálogo o terminar una pulsación, limpia las teclas, punteros y velocidades. Atiende `pointerup`, `pointercancel`, pérdida de captura y liberación fuera del botón. Admite mantener una dirección y pulsar explorar con otro dedo sin dejar entradas atascadas. Aplica `touch-action` restrictivo solo a los controles que lo necesitan, no a los párrafos.

<a id="spec-6-2"></a>

### 6.2. Movimiento y colisiones

**Sombras.** Para que Vanessa y Jerry se sientan apoyados en el camino, cada uno lleva una sombra suave (`gameplay.player.shadow`: opacidad, ancho respecto del pie y proporción). No hay tabla de posiciones: se miden los píxeles de la franja baja del fotograma visible, un tramo por cada «pie» (Vanessa, Jerry), y se recolocan con cada fotograma, así que siguen el paso, el reposo, los trucos y la búsqueda del peluche. Quedan justo debajo del sprite en el orden de profundidad y, cuando Vanessa salta al celebrar, se quedan en el suelo.

**Utiliza el ciclo de Phaser; no crees `useGameLoop`, un segundo `requestAnimationFrame` ni un temporizador de React para mover los sprites.** La escena puede delegar desde `update(time, delta)` a controladores locales. React solo recibe cambios discretos, no cada coordenada de cada fotograma. El ciclo y la actualización de escenas pertenecen al motor. [T2]

**Reposo animado.** El usuario aportó tres hojas de reposo de Vanessa con Jerry (`vanessa-jerry-idle-spritesheets`): *reposo* (respiración sutil, parpadeo y cola; una animación por dirección), *mirada* (Vanessa mira a Jerry y él a ella; una por dirección) y *juego* (se agacha, lo acaricia y se levanta; solo de frente). Son atlas de 1086 × 1448 px con doce fotogramas lógicos de 362 × 362 px cuyos pies están alineados: se cargan con su atlas JSON (no como cuadrícula), se indexan en `assets.json` con `kind: "idle-sheet"` (conservando `origin` —los pies— y la lista `animations` con su dirección, velocidad y `repeatDelay`) y se usan **a la escala del caminar**, sin reescalar píxeles. Los tiempos van en `gameplay.player.idle` (§12.4), no en el manifiesto.

- Al soltar el movimiento se pasa al reposo en la dirección en que miraba Vanessa, de inmediato. Tras `glanceAfterMs` (4,5 s) sin entrada se reproduce una vez la mirada y se vuelve al reposo en la misma dirección. Tras `playAfterMs` (10 s) desde el gesto anterior, y solo de frente, se reproduce una vez el juego; de lado o de espaldas se repite la mirada. Entre gestos pasan al menos `gestureCooldownMs` (8 s), y el temporizador se reinicia con cualquier entrada y al terminar cada gesto.
- Al recibir movimiento (o al celebrar) se cancela el gesto y se camina al instante. Nunca suenan dos de estas animaciones a la vez en el mismo sprite. Una lectura o cualquier pausa detiene el reposo con el resto del mapa y lo reanuda al volver.
- Con `prefers-reduced-motion` no hay bucle ni gestos: se muestra el primer fotograma del reposo en la dirección en que mira. Si una hoja de reposo no carga, se conserva la pose quieta de la hoja de caminar y el juego sigue.
- El reposo es solo aspecto: no cambia el cuerpo de colisión, la proximidad ni la alcanzabilidad.

**Jugar con Jerry (trucos y peluche).** Un segundo kit (`vanessa-jerry-tricks-fetch`) aporta dos hojas más del mismo tipo `idle-sheet`: *trucos* (Jerry salta y aterriza, se sienta, da la pata y se levanta; además de la secuencia completa, el kit trae sus partes: salto, sentarse, dar la pata, levantarse) y *buscar el peluche* (Vanessa señala a la derecha, Jerry trae el peluche de foca marrón y lo deja junto a ella; el lienzo lógico es más ancho, 405 × 362 px, para el recorrido de Jerry). Ninguna de las dos sale sola: **las pide el visitante**, con la tecla `gameplay.player.idle.actionKey` (por defecto **P**) o con el botón «Jugar con Jerry (P)» de la cabecera, que es el camino táctil y también un recordatorio de la tecla. Cada petición lanza la siguiente acción: primero buscar el peluche y, la vez siguiente, los trucos con dar la pata, y así alternando.

- **Altura de Vanessa en los trucos.** La primera versión de la hoja de trucos dibujaba a Vanessa entre un 3 % y un 5 % más grande que al caminar. La hoja corregida (v2) no tiene lienzo lógico común: sus fotogramas son recortes sin relleno cuyo `frameAdjust` (en `assets.json`) da, por fotograma, el **factor de escala** y el **origen** (los pies, respecto del recorte) que dejan a Vanessa a la altura de referencia (`referenceHeightPx`, 316 px por la escala del juego) y a Jerry en proporción. Se aplican al cambiar de fotograma, solo como efecto visual (no tocan el cuerpo de colisión), y al terminar se restituye la escala del caminar. O hay ajuste para todos los fotogramas de una hoja o para ninguno.
- Cada acción se reproduce **una sola vez** (un bucle devolvería el peluche al instante a su sitio). Al terminar la búsqueda se mantiene el último fotograma, con el peluche, `fetch.holdMs` y se vuelve al reposo; los trucos vuelven al reposo directamente. Una acción en curso no se reinicia ni se cambia por la otra.
- La petición detiene a Vanessa (también si caminaba por toque) y se hace con ella parada en el sitio; cualquier movimiento cancela la acción y camina al instante. No se activa con una ventana abierta (el botón se desactiva) ni durante la celebración.
- Con `prefers-reduced-motion` no hay animación, pero lo pedido tiene efecto: se muestra un único fotograma —el del peluche, o Jerry dando la pata— durante la espera y se vuelve a la pose fija del reposo.
- Si solo hay una de las dos hojas, la tecla siempre lanza esa; si ninguna carga o no están configuradas, no hay botón y la tecla no hace nada. La tecla actúa con el mapa enfocado, como las flechas.

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
- **Control visible.** Hay un botón dentro del juego, siempre disponible desde la cabecera, que apaga y vuelve a encender la música (con efectos de sonido, §6.5, es el botón «Sonido»: silencia música y efectos juntos). Es un botón real con etiqueta textual comprensible («Silenciar música» / «Activar música»), foco visible, objetivo táctil de al menos 44 × 44 px y operable con teclado. La preferencia se guarda en el navegador de forma **independiente del progreso**: reiniciar el recorrido no la borra, y si el visitante la apagó no vuelve a sonar sola en la siguiente visita.
- La música es de fondo: volumen bajo por defecto (editable en JSON), fundido de entrada y salida entre pistas y al encender o apagar, y pausa automática cuando la pestaña queda oculta, reanudándose al volver si estaba encendida. No se reproducen varias pistas a la vez fuera del fundido entre dos.
- Se transmite por flujo (no se decodifica entera en memoria) y solo se pide la pista que suena y la siguiente, para no cargar los ~16 MB de audio al abrir la página. No depende de Phaser ni de la escena: no se corta ni se reinicia al cambiar de zona, abrir una lectura o redimensionar.
- **Créditos.** La portada **no** muestra créditos de la música (decisión del usuario). La atribución de cada pista (título, autor, licencia, enlace de origen) se conserva en su entrada de `assets.json` (`credit`). Dos de las pistas son CC BY 3.0, licencia que exige atribuir al autor: hasta que el usuario decida dónde mostrarla (p. ej. una pantalla de créditos o el pie del sitio publicado), queda como pendiente de entrega. Una pista cuya atribución o licencia no esté verificada impide presentar el sitio como entrega final (§10); no se inventa ni se supone una licencia.
- Si una pista falla al cargar o `audio.music` está vacío o desactivado (`active: false`), la bitácora funciona igual: la que falla se omite con un aviso localizado (ID y ruta) y no se muestra el botón cuando no hay música ni efectos que controlar.

### 6.5. Efectos de sonido y laboratorio de sonidos

Además de la música (§6.4), la bitácora puede reproducir **efectos de sonido**: sonidos colocados en el mapa (un río, el viento, pájaros) que se oyen más o menos según dónde esté Vanessa, y sonidos breves de interfaz y de recompensa. La música y los efectos son sistemas **independientes** —`MusicPlayer` sigue siendo de la música y no pasa por Phaser; los efectos los reproduce un `SfxService` propio, uno por `Phaser.Game`— y comparten solo el botón «Sonido» (más abajo). Sin `audio.sfx` el juego es exactamente el de antes.

**Catálogo.** Los efectos son entradas de `assets.json` con `type: "audio"`, `category: "audio"`, `kind: "sfx"`, bajo `public/assets/audio/sfx/`, con `path`, `format`, `label`, `sizeBytes`, `sha256` y `durationSeconds`; solo se **añaden** entradas, nunca se altera una existente. Un recurso de otro `kind` (música, imágenes) no puede usarse como efecto y viceversa. Los siete sonidos incluidos (`audio.sfx.test-*`: río, viento, pájaros, abrir, confirmar, insignia y portal) son **tonos de prueba generados** por `scripts/tools/generate-test-sfx.ts` —WAV pequeños y reproducibles, sin licencia que atribuir— para poder demostrar y probar la función. **No son los sonidos finales**: se reemplazan por los reales añadiendo archivos al catálogo y apuntando los emisores y los efectos a ellos.

**Contrato.** `bitacora.json › audio.sfx` (opcional) guarda `active`, `volume` (0..1, volumen general), `maxVoices` (1..64) y `events`: el efecto de cada acción del juego (`ui.open`, `ui.confirm`, `badge.earned`, `portal.travel`), con `assetId`, `volume` y `rate`. `maps.json › maps[zona].sounds[soundId]` (opcional) guarda los sonidos colocados en el mapa; **es espacial, así que lo administra Tiled** (§12.9) y la importación nunca escribe `bitacora.json`. Un sonido tiene `label`, `assetId`, `enabled`, `volume` (0..1), `rate` (0,5..2; 1 es la velocidad original), `fadeInMs`, `fadeOutMs`, `playback` y una de dos formas: `point` (`position`, `innerRadius`, `radius`) o `rect` (`area`, `edgeFadePx`). `sounds` omitido y `sounds: {}` son cosas distintas y se conservan al importar. Las rutas físicas nunca aparecen en los JSON.

**Cómo suena un sonido del mapa.**
- **Atenuación por distancia**, en píxeles del mundo (no depende de la cámara ni del tamaño de pantalla), medida desde los **pies** de Vanessa. Un punto suena a volumen completo hasta `innerRadius`, calla desde `radius` y, entre ambos, cae de forma cuadrática: `(1 − t)²` con `t = (d − innerRadius) / (radius − innerRadius)`. Un área suena completa dentro y fuera cae igual hasta `0` a `edgeFadePx` del borde (con `0`, fuera es silencio). Es la misma fórmula en el juego y en el laboratorio.
- **Modos.** `loop`: una sola voz continua mientras esté al alcance, con fundido de entrada y de salida. `interval`: un disparo y una espera aleatoria entre `minMs` y `maxMs` (los disparos nunca se solapan y la espera solo corre dentro del alcance). `enter`: un disparo al pasar de fuera a dentro, con `cooldownMs` de enfriamiento y una pequeña histéresis (16 px) para que no se repita al vibrar en el borde. Si el visitante ya está dentro cuando se activa la zona, la entrada inicial se evalúa una sola vez al desbloquear el audio; si en ese momento no pudo sonar (silencio, lectura abierta), no se acumula para después.
- **Voces.** Hay como mucho `maxVoices` voces a la vez. Al llegar al límite, un efecto de interfaz o una prueba desplaza a la voz de ambiente de menor volumen efectivo; el ambiente nunca desplaza a un efecto. El volumen efectivo de una voz es `volumen del emisor × distancia × fundido × volumen general × mezcla del laboratorio`.
- **Recursos.** Se cargan cuando se necesitan, una sola vez (los efectos de interfaz tras el gesto del visitante; los de una zona al activarla), sin retrasar el mapa; un recurso que no carga se anota con su ID y el resto sigue. El audio decodificado tiene un tope de memoria (48 MB) y se descarta lo menos usado que ninguna zona, efecto de interfaz o voz retiene. Al cambiar de zona, al cerrar la escena o al destruir el juego se detienen y liberan los sonidos de esa escena; una limpieza tardía de una escena ya sustituida (se identifica por su `token`) no toca a la actual.

**Autorización, silencio y pausas.**
- **Nada suena antes del gesto** del visitante en «Comenzar» o «Continuar» (el navegador además lo exige). Los sonidos de la zona activa pueden precargarse detrás de la portada para estar listos; los efectos de interfaz se cargan con el gesto. Si el navegador bloquea el audio, el botón «Sonido» ofrece «Activar audio» y pulsarlo lo reintenta.
- **Botón público «Sonido».** El botón de la cabecera silencia y reactiva **la música y los efectos juntos**, con una sola preferencia independiente del progreso (`soundMuted`). Una preferencia antigua `musicMuted` se lee como `soundMuted` (quien silenció la música sigue sin oír nada) y al guardar se escriben ambas con el mismo valor. Sigue siendo un botón real con etiqueta textual (con efectos habla de «sonido»; solo con música, de «música»; `ui.labels.soundMute/soundUnmute/soundActivate`), foco visible, ≥ 44 × 44 px y teclado. **Existe aunque haya efectos y no música**; sin ninguno de los dos no se muestra.
- **Silencio de lectura.** Mientras hay una lectura abierta el ambiente del mapa se suspende (los efectos de interfaz, no); al cerrarla los bucles vuelven. Con la pestaña oculta o el sonido silenciado no suena ninguna voz y no se acumula una cola de sonidos antiguos al volver.

**Efectos de interfaz y de recompensa** (`audio.sfx.events`). `ui.open` suena en una apertura **real** de una lectura o de un panel de la Bitácora (no en un mensaje de «bloqueado», «pendiente» o «lejos» ni cuando ya hay una ventana abierta); `ui.confirm`, al marcar de verdad una sección nueva y al confirmar el reinicio; `badge.earned`, **una sola vez por transacción de recompensa**, al concederse la insignia (con la última, que además concede a Jerry y a Rocky, suena una vez y no tres) y con deduplicación por el identificador del efecto; `portal.travel`, al aceptarse un viaje por un portal. Repetir una acción (doble clic, releer una completada) no repite el sonido. Una acción que se resuelve antes de que su sonido cargue no lo reproduce tarde: pasados unos instantes se descarta.

**Laboratorio de sonidos (solo desarrollo).** Con `npm run dev` y `?audioLab=1` aparece el botón «Sonidos» y, con él, un panel para escuchar, ajustar y guardar sin recrear el juego. **No existe en la publicación**: se carga con `import()` bajo `import.meta.env.DEV`, el compilador lo elimina del build y las rutas de guardado solo las monta el servidor de desarrollo.
- **Pestañas.** *Mapa*: la zona con los obstáculos, los portales, el alcance de cada emisor (círculos interior y exterior, o área con su caída) y el oyente; se elige un emisor en el mapa o en la lista, se arrastra su centro y se crean emisores nuevos. *Presets*: el volumen general, el límite de voces y el efecto de cada acción, con «Probar» (las pruebas **nunca** conceden ni revelan insignias). *Archivo de prueba*: elegir o soltar un WAV, MP3, OGG o M4A.
- **Controles.** Probar, Detener, Repetir, Solo (calla la música y los demás emisores mientras dura), Detener todo (calla también el ambiente hasta «Reanudar el ambiente»), «Con distancia» (aplica o no la atenuación), volumen, velocidad (0,5–2×), modo, intervalo o enfriamiento, fundidos y alcance (radios o caída del área, posición); y un diagnóstico en vivo (estado del audio, voces con su volumen base, espacial, de fundido y efectivo, emisores con su distancia y ganancia, memoria, errores y por qué una prueba no suena). Los cambios se oyen **en vivo**, también en una prueba que está sonando.
- **Dos modos de escucha.** *Mapa*: Vanessa queda quieta (el laboratorio añade el motivo de pausa `audio-lab` en el coordinador compartido de los motivos de pausa del mapa, sin pisar el de la lectura) y se escucha desde un oyente virtual que se mueve con el ratón, el dedo o las flechas; *Recorrido*: se quita la pausa y se camina con las flechas (hay un botón para llevar el foco al mapa). Al cerrar el panel no queda pausa, oyente virtual, solo ni pruebas sonando.
- **Archivos de prueba.** Viven en la memoria de la pestaña: máximo 8 MB y 60 s por archivo, 8 archivos y 64 MB decodificados en total; si no caben se descartan los que ningún ajuste usa. Si se elige otro mientras uno anterior aún se decodifica, **gana el último**. Un archivo solo entra al proyecto si se guarda un ajuste que lo usa.
- **Borradores.** Cada cambio es un borrador (marcado «sin guardar», con contador en el botón) que no toca el disco. «Restablecer» vuelve a lo guardado; «Aplicar a esta sesión» lo aplica al juego en marcha (también los emisores nuevos) sin guardarlo; «Comprobar» lo valida en el servidor sin escribir; «Guardar en el proyecto» lo guarda; «Exportar ajustes» baja un paquete.
- **Accesibilidad.** Etiquetas visibles, pestañas con flechas, objetivos de al menos 44 px, estados anunciados en una región `aria-live`, foco visible y el mapa operable con el teclado.

**Guardar en el proyecto.** El servidor de desarrollo ofrece `GET /__audio-lab/state` y `POST /__audio-lab/save` (con `?dryRun=1` solo valida), solo para peticiones de esta misma máquina, del mismo origen y con la cabecera propia del laboratorio, con tope de tamaño; nunca acepta rutas de archivo del cliente, solo datos. Un guardado es **una transacción serializada**: (1) lee los archivos y comprueba que no cambiaron desde que los vio el panel (huellas por archivo; un cambio en un archivo que ese guardado no escribe no es conflicto); (2) incorpora los archivos nuevos al catálogo (comprueba extensión, firma del contenido, tamaño y duración —los WAV se miden en el servidor—, nunca sustituye un recurso existente, reutiliza uno idéntico por su `sha256` y da un ID y un nombre libres); (3) parcha **solo el objeto de Tiled** seleccionado (convirtiendo del mundo a las coordenadas locales de su capa y grupos, conservando su `id`, sus propiedades ajenas y los demás objetos; si el mapa no tiene la capa `sonidos`, la añade) o, para presets y ajustes generales, **solo la región `audio.sfx`** de `bitacora.json`; (4) construye el resultado completo en memoria y lo valida con las mismas validaciones del proyecto (`validateProject` con el `maps.json` candidato); (5) solo entonces escribe, con copia previa de cada archivo (`tools/tiled/backups/`) y, si algo falla, recupera todo lo escrito; y (6) comprueba lo escrito con la verificación de `tiled:check`. Guardar un emisor deja `bitacora.json` y `assets.json` (si no hay archivo nuevo) byte a byte iguales. Mientras guarda hay un cerrojo (`tools/tiled/.audio-lab.lock`) que los observadores de Tiled (el plugin de Vite y `npm run tiled:watch`) respetan, y la página se recarga **una sola vez** al terminar; el panel se reabre con la selección y los borradores que no usan archivos locales. Tiled, si tiene abierto ese mapa, avisará de que cambió y habrá que recargarlo.

**Exportar e importar ajustes.** «Exportar ajustes» descarga un JSON versionado (`format: "bitacora-audio-lab"`, `version: 1`) con las huellas de origen, los cambios y los archivos nuevos incrustados en base64. `npm run audio-lab:import -- ajustes.json` (con `--dry-run` para solo validar) lo aplica a **este** proyecto con la misma transacción, sin servidor ni navegador.

**Límites y honestidad.** Los sonidos incluidos son tonos de prueba. Las pruebas automáticas comprueban voces, volúmenes, peticiones, archivos y estados, no **cómo suenan**: oír el resultado (tono, mezcla, si un fundido es agradable) sigue siendo una revisión manual que no se ha dado por hecha. Cuando no hay Web Audio se usa un reproductor con elementos de audio normales, que no ofrece el mismo control fino de volumen y velocidad. En los formatos distintos de WAV la duración la mide el navegador al decodificar y el servidor la acepta.

<a id="spec-7"></a>

## 7. Interfaz de lectura

Mantén una cabecera compacta con título, retrato, progreso, barra de XP y acceso a las insignias. El objetivo actual debe ser comprensible, por ejemplo: «Continúa en Aprendizaje 3».

Al abrir una estación, pausa el movimiento y muestra una ventana crema. En escritorio puede ser un diálogo amplio sobre el mapa; en móvil, una vista casi completa con desplazamiento interno. No achiques los párrafos para mantener visible el mapa.

Conserva exactamente estas pestañas:

| Pestaña | Función |
|---|---|
| Resumen (`learning`) | Explicar qué descubrió, comprendió o conectó con su formación. Es la primera ventana. |
| Reflexión (`reflection`) | Expresar emociones, preguntas, tensiones y relaciones con otros saberes. |
| Lo vivido (`lived`) | Relatar la experiencia, actividad o situación significativa, desde la voz de la estudiante. |

Son **tres** ventanas, en este orden (el de `ui.tabs`). La revisión 21 retiró «En el aula» (`classroom`) y renombró «Aprendizajes» como «Resumen»; un avance guardado con una sección retirada la ignora sin perder lo demás.

Las pestañas son dimensiones del mismo aprendizaje, no estaciones distintas. Se pueden consultar en cualquier orden.

Admite párrafos, subtítulos, imágenes con texto alternativo y pie, citas y referencias aportadas por la autora. Las evidencias deben poder añadirse sin modificar el componente de lectura.

Muestra el estado de cada sección con texto, no solo color. Conserva las secciones marcadas y, si es viable, la pestaña activa al cerrar y volver a abrir.

El diálogo debe tener título accesible, cierre visible, foco inicial coherente, navegación de foco contenida mientras está abierto y restauración del foco al cerrarse. Las pestañas deben implementar sus roles, asociaciones y navegación por teclado, sin que sus flechas muevan al personaje. [T4] [T5]

Toda esta ventana pertenece a React, fuera del canvas. No uses textos de Phaser ni HTML incrustado en su escena para los párrafos académicos. Los letreros breves del mundo sí pueden renderizarse en Phaser, conservando un equivalente textual en la interfaz o lista accesible.

**Bitácora de aprendizajes (kit `bitacora-panel-aprendizajes`).** Con `ui.journalPanel`, la lista y la lectura se hacen con el kit: 11 piezas propias `ui.journal-panel.*` (`kind` «journal-panel-part»: las seis ilustraciones de los aprendizajes, el libro con brote, los iconos de zona y el de reflexión, y la cinta) más las del panel de insignias que comparte (marcos, botones, iconos y ramitas; por eso exige `ui.badgePanel`). El **índice** (`JournalIndex.tsx`) es una ventana con título, progreso «n de m completados» y una tarjeta por aprendizaje agrupada por zona —número, título, ilustración, estado «Completado», «Disponible» o «Por descubrir» y el botón «Explorar» o «Volver a leer»—. El **lector** (`JournalReader.tsx`) lleva el título, el estado («En curso» o «Completado»), «Aprendizaje n · zona», las tres pestañas con su marca de leída y «n de 3 secciones leídas», el texto de la sección y, al lado, dos tarjetas: «En este aprendizaje» (la ilustración `learnings[id].illustrationAssetId` y las palabras clave `learnings[id].keywords`, que se derivan de los textos de la autora y se pueden editar) y la insignia (por obtener u obtenida, con su nombre, cómo conseguirla y «Ver insignia»). El pie dice qué se está leyendo y ofrece una sola acción: «Marcar como leído y continuar» (marca la sección y pasa a la siguiente por leer), «Recoger insignia» cuando están las tres, y, en un aprendizaje completado, «Ver {sección}» y al final «Volver a la bitácora». Abrir una pestaña **no** marca nada (§8). Un aprendizaje se abre **directo en su lectura**, retomando la última sección: con el kit no hay ventana de apertura («Ya recorriste este aprendizaje…»); los mensajes (bloqueado, pendiente, lejos de la estación) y la recompensa conservan su ventana de siempre. «Volver a la bitácora», «Ver insignia» y `Escape` regresan a donde se estaba (índice, detalle de la insignia o mapa). Todos los textos están en `ui.journalPanel.labels` (con plantillas que solo admiten sus variables) y los nombres de las secciones salen de `ui.tabs`. Sin `ui.journalPanel` se usan la lista y la lectura anteriores.

**El lateral del lector.** La ilustración, las palabras clave y la insignia conservan su tamaño natural (no se encogen para caber); si la altura no alcanza, el lateral se desplaza dentro de sí mismo, sin que nada se salga de su recuadro ni tape el botón del pie. Nunca se omiten las palabras clave ni la insignia, y todo se mide en `rem`, así que sigue el tamaño de letra elegido (AC-39). En móvil el lector se apila y se desplaza entero. La X de cierre cambia de aspecto al pasar el cursor, como la de «Mis insignias», y al abrir un aprendizaje el foco queda en el propio diálogo, sin anillo sobre ningún botón.

<a id="spec-8"></a>

## 8. Qué significa completar un aprendizaje

**Abrir una estación o visitar una pestaña no equivale a haber leído.** Tampoco se puede comprobar la comprensión mediante scroll o tiempo de permanencia.

Utiliza una confirmación explícita y sencilla: cada sección requerida ofrece «Marcar sección como leída». El botón debe estar disponible en la sección y no depender de alcanzar un porcentaje de scroll. Después de marcar las cuatro secciones, se habilita «Recoger insignia y continuar».

No impongas un tiempo mínimo de lectura, un cuestionario ni una respuesta escrita que no han sido solicitados. La confirmación registra una acción del visitante, no certifica aprendizaje.

Cuando se recoge una insignia, una única transición de estado marca la estación como completada, registra la fecha, habilita el siguiente aprendizaje y dispara una celebración breve. La operación debe ser idempotente: un doble clic, una tecla mantenida o volver a abrir el contenido no pueden duplicar recompensas.

La celebración puede mostrar el asset de la insignia, el resplandor, una pose del personaje con Jerry y el texto «¡Aprendizaje recorrido!». Respeta la preferencia de movimiento reducido. [T7]

**Se explora y se completa en la estación.** Un aprendizaje **sin completar** solo se explora (se leen sus secciones, se marcan y se recoge la insignia) estando Vanessa junto a su estación, dentro del radio de interacción: abrirlo desde la Bitácora o la colección estando lejos muestra el mensaje `ui.labels.awayFromStationTemplate` («Para explorar «{title}» ve a su estación en {zone}…») y no abre la lectura ni cambia nada. Ya **completado**, se relee sin problema desde cualquier sitio. «Ver aprendizaje» en el detalle de una insignia lleva a la lectura de ese aprendizaje con las mismas reglas, y al cerrarla se vuelve a donde se estaba.

Propuesta de XP, configurable: 100 puntos por estación completada. Calcula el total desde las estaciones completadas; no guardes un contador independiente que pueda desincronizarse. Muestra también el progreso directo, por ejemplo «3 de 6 aprendizajes» y «300 / 600 XP» para la configuración inicial. Deriva el denominador de `route` y la XP máxima de sus insignias configuradas; nunca incrustes esos totales en la interfaz.

Para conservar la idea de subir de nivel sin crear otra mecánica, el nivel de recorrido puede coincidir con las insignias obtenidas: inicia en 0 y aumenta una vez por estación. Es un indicador del recorrido, no una evaluación académica.

Al releer, muestra «Insignia obtenida» y no vuelvas a otorgar XP.

La concesión de la insignia se decide en el dominio compartido, nunca en un collider ni en la escena. Comunica la celebración como un efecto de una transición nueva y aceptada. Una sincronización de progreso al cargar no debe volver a celebrar todas las insignias históricas.

<a id="spec-9"></a>

## 9. Contenido: los seis aprendizajes

**Los seis aprendizajes son los textos de Vanessa** (archivo `bitacora-aprendizajes.md`), cargados en `bitacora.json` con las tres ventanas de cada uno (Resumen, Reflexión y Lo vivido) como párrafos de texto plano (sin negritas), tal como los escribió, y con `editorialStatus: "ready"`: **Vanessa los revisó y aprobó**, y la configuración está en `mode: "final"` (la `configRevision` es `2026-10-05-contenido-aprobado`). El progreso guardado en modo demostración no pasa al final (AC-13): cada modo guarda bajo su propia clave. En orden de `route`: «Las plantas y las semillas», «La plastilina casera», «El museo y la taxidermia», «Pingüinos: cómo se adaptan los seres vivos», «La Tierra y sus movimientos» y «Plantas: su origen»; cada uno lleva además un título corto para el letrero (`signTitle`). Cada aprendizaje tiene su insignia (véase abajo).

Lo que sigue en este apartado es el borrador original del primer aprendizaje, conservado como referencia del criterio editorial; ya no es el contenido cargado.

Título provisional: **Aprender con los sentidos: plantas, semillas y saberes**.

**Insignias.** Cada aprendizaje tiene la suya, del paquete `bitacora-insignias` (`ui.badge.*`, `kind` «badge», PNG de 1254 × 1254 con transparencia, mostrados a 64 px o más): «Curiosidad que florece» (Las plantas y las semillas, girasoles), «Crear juntas» (La plastilina casera), «Mirar de cerca» (El museo y la taxidermia), «Cuidar la vida» (Pingüinos), «Imaginar para comprender» (La Tierra y sus movimientos) y «Detenerse a descubrir» (Plantas: su origen). La descripción de cada una es el significado que trae el paquete, y valen 100 XP como antes. Una séptima, **«Jerry» (subtítulo «Compañero de aventuras»; Jerry con un corazón)**, no pertenece a ningún aprendizaje: `badges[id].awardedFor = "route-complete"` y `xp` 0; aparece al final de la colección (como pista, «Insignia especial: al completar el recorrido»), se obtiene al terminar todos los aprendizajes con la fecha del último, y no suma XP ni cuenta en «n de m insignias». Una insignia de recorrido no puede ser la de un aprendizaje.

**Rocky (versión 1.1.0 de los kits).** Una octava, **«Rocky»** (`ui.badge.rocky`, del paquete `bitacora-insignias` 1.1.0, con el mismo dibujo en `bitacora-panel-insignias`), es de recuerdo: `badges[id].specialType = "memorial"`, `awardedFor = "route-complete"`, `xp` 0 y **`secret: true`**. Una insignia secreta no aparece en la colección —ni se nombra ni deja pista— hasta que se concede: al terminar todos los aprendizajes surge junto a la de Jerry, sin contar en «n de m» ni sumar XP. Su tarjeta lleva el subtítulo «Siempre en nuestro corazón» y la etiqueta «Obtenida» como cualquier otra (la de Jerry lleva «Jerry» y, debajo, «Compañero de aventuras»); su detalle («Un recuerdo lleno de amor») dice qué representa, «Un lugar para recordarlo» y, en «Con mucho cariño», la dedicatoria (`badges[id].takeaway`), sin fecha, XP ni «Ver aprendizaje». Los textos son los de la actualización 1.1.0 del kit (no los escribió Vanessa: conviene que ella los revise) y los del panel salen de `ui.badgePanel.labels.memorial`. La de Jerry (`specialType: "friendship"`) no es secreta: se ve «Por descubrir» con su condición («Se desbloquea al finalizar la bitácora»).

**Panel de insignias.** La colección se muestra con el kit `bitacora-panel-insignias` (60 piezas `ui.badge-panel.*`, `kind` «badge-panel-part», con `group` y, las 18 de nueve zonas, `nineSlice`; los PNG conservan sus bytes y el kit se archiva en `docs/source/badge-panel/`). Es una ventana de dos vistas dentro de `BadgePanel.tsx`: la **colección** (título «Mis insignias», cápsula «n de m obtenidas», una tarjeta por aprendizaje con su número, su medalla y «Obtenida» o «Por descubrir», la tarjeta especial de Jerry, la reflexión final al terminar solo si la autora la escribió, y el pie con «Volver al mapa») y el **detalle** de una insignia (tarjeta con número, medalla grande, estado y XP; «Qué representa»; «Cómo la conseguí» o «Cómo conseguirla» con el aprendizaje que la concede; «Lo que me llevo» solo si `badges[id].takeaway` está escrito; «Volver a la colección» y, en las de aprendizaje, «Ver aprendizaje»). Los textos están en `ui.badgePanel.labels` y los archivos se resuelven con `ui.badgePanel.assetPrefix`; `badges[id].tone` (`jade`, `lavender` o `gold`) elige el color de la tarjeta. Los marcos y botones se dibujan con `border-image` y los cortes salen del manifiesto (`--bpk-<pieza>`). Sin `ui.badgePanel` se usa la colección anterior (`BadgeCollection`). Nada de esto cambia el progreso: es solo presentación.

### Lo vivido

> Durante una exploración guiada por la maestra, conocimos distintas plantas y semillas. Uno de los momentos más significativos para mí fue cuando compartió semillas de diferentes frutos y me detuve a olerlas una por una. Fue una experiencia muy bonita, porque no había tenido muchos acercamientos de ese tipo con la naturaleza.
>
> También recibimos materiales sobre los usos atribuidos a algunas plantas. La actividad despertó mi curiosidad por las experiencias y los conocimientos que las personas construyen alrededor de ellas.

### Resumen (antes «Aprendizajes»)

> Esta experiencia me llevó a reconocer el lugar que pueden tener los sentidos en mi manera de aprender. Detenerme a oler, observar y prestar atención hizo que algo que antes me resultaba distante se volviera significativo.
>
> También me surgió el interés por conocer cómo se comparten los saberes sobre las plantas y cómo podría dialogar con ellos desde mi formación como maestra.

### Reflexión

> La actividad me hizo pensar en la relación entre los conocimientos sobre las plantas, las mujeres que los han transmitido y su asociación con la brujería. Me pregunté por la forma en que ciertos saberes han sido valorados o desvalorizados, y por las relaciones de poder que intervienen en esa valoración.
>
> Quiero profundizar en esas conexiones y contrastarlas con fuentes, sin dar por sentado que todas esas historias pueden explicarse de la misma manera. Como futura maestra, me interesa aprender a escuchar otros conocimientos y a formular preguntas sobre ellos.

### Criterio editorial

Conserva la voz personal y diferencia experiencia, interpretación, propuesta pedagógica y afirmación verificable. No conviertas los usos medicinales mencionados en recomendaciones de tratamiento. No presentes como demostrada una conexión histórica entre brujería, burguesía, conquista y saberes de plantas sin fuentes aportadas y revisadas.

No añadas bibliografía ficticia, diagnósticos, detalles de la actividad que no se hayan mencionado ni generalizaciones científicas sin comprobar. La implementación debe permitir añadir las fuentes más adelante.

El prefijo visible «Aprendizaje 2», por ejemplo, se deriva de `route`; no lo incrustes en el título almacenado. No inventes experiencias autobiográficas para completar los espacios: si se añade un aprendizaje sin texto, usa «Tema por definir» y textos explícitos de demostración.

<a id="spec-10"></a>

## 10. Separación entre demostración y entrega final

La demostración debe permitir probar todo el recorrido activo, inicialmente seis aprendizajes, y también variantes de cinco y siete sin modificar el código. Los contenidos de ejemplo pueden participar en esa prueba, pero deben estar identificados como «Contenido de demostración» (`ui.labels.demo`, opcional: solo se muestra en modo `demo` y si la etiqueta existe; la configuración real con los textos de Vanessa no la lleva, aunque siga en modo `demo` mientras sus textos son borradores).

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
  generate-tiled.ts            # Catálogo y mapas de Tiled a partir de bitacora.json (§12.9)
  import-tiled.ts              # Importa y valida las ediciones de Tiled (tiled:import / tiled:check)
  watch-tiled.ts               # Importa al guardar durante el desarrollo
  lib/tiled/                   # Conversión, lectura, previews y validación de los mapas
tools/
  tiled/                       # Proyecto, mapas .tmj, catálogo .tsj, previews y README de Tiled
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
      BadgeCollection.tsx          # colección anterior, de respaldo si falta ui.badgePanel
      BadgePanel.tsx               # panel de insignias con el kit (colección y detalle)
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

**Carga por etapas.** Una zona descarga decenas de megabytes (hojas animadas de 1448 × 1086 px: unos 44 MB y unos 290 MB de texturas en la primera zona), así que no se pide todo antes de mostrar el mapa. `zoneAssetPlan` reparte los assets en cuatro grupos: **esenciales** (capas, decoraciones, letreros e iconos de estado, efectos de las estaciones y la hoja con la que camina Vanessa; unos 10 MB), **paisaje** (efectos ambientales y animales, que se crean en cuanto llegan), **extras** (reposo animado de Vanessa y Jerry y pose de celebración) y **bajo demanda** (las insignias, que solo se cargan al celebrar; la colección las muestra desde el HTML). La escena arranca cuando llegan los esenciales y pide el resto sin bloquear; los fallos de cada etapa se avisan con su ID al terminarla. Mientras llegan los esenciales se muestra «Cargando el mapa…» con una barra de progreso (`ui.labels.loadingMap`, opcional) que desaparece con `game:ready`. Phaser descarga como mucho 6 archivos a la vez y las imágenes como `<img>` (`loader.imageLoadType`), de modo que las imágenes de la interfaz compiten en igualdad con las del mapa en una conexión lenta. `ExplorationScene.fullyLoaded` indica que terminaron todas las etapas (lo esperan las pruebas).

**Peso publicado.** Los PNG de `public/assets` ya vienen bien comprimidos (recomprimirlos sin pérdida ahorra apenas un 3 %), así que `npm run build` los reduce **solo en `dist/assets`** con `scripts/tools/optimize-dist.ts`: paleta de 256 colores con difuminado (`sharp`), unos −55 % (95 MB → 42 MB; la primera zona pasa de 44 a 20 MB y lo esencial de 9,8 a 4 MB) sin diferencia apreciable a simple vista. Cada archivo se acepta si su relación señal/ruido no baja de 24 dB; si no, o si `sharp` no está instalado, se publica el original. Los archivos de `public/assets` y los hashes de `assets.json` no cambian; `npm run build:full` publica todo sin recomprimir.

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
| `placements` (en `maps.json`) | Ubicación y aspecto local de cada estación por ID. | Sus párrafos, número visible ni progreso. |
| `maps` (en `maps.json`) | Fondos, dimensiones, objetos, obstáculos, puntos seguros y portales. | Textos académicos o una estación incrustada en la imagen. |
| `learnings` | Título, tema, revisión, estado editorial, secciones, insignia y diálogos asociados. | Código JSX, funciones ni orden de recorrido. |
| `badges` | Nombre, descripción, asset y XP de cada insignia. | Indicadores `earned` o contadores guardados. |
| `dialogues` | Líneas, interlocutor y variables de mensajes. | Scripts o condiciones evaluables. |
| `ui` | Pestañas, etiquetas, diálogos por defecto y referencias a assets de la interfaz. | Un constructor libre de HTML/CSS. |
| `gameplay` | Parámetros admitidos, como velocidad, zoom, personaje y acompañante referenciados por IDs. | Nombres arbitrarios de clases o nuevos modos de juego. |

`assets.json` tiene una responsabilidad distinta: resolver IDs lógicos a archivos y metadatos técnicos. Ningún componente debe conocer rutas físicas si puede resolverlas mediante el registro de assets.

Cambiar un texto, insignia, diálogo, orden o ubicación no requiere modificar componentes. Añadir un tipo de bloque no soportado, una mecánica nueva o un diseño de interfaz completamente distinto sí requiere código y actualizar el esquema. No prometas un motor universal «sin código».

<a id="spec-12-2"></a>

### 12.2. Fuente única, carga y despliegue

Ubicaciones iniciales: `public/config/bitacora.json` (el contenido: textos, `route`, insignias, diálogos, interfaz y ajustes), `public/config/maps.json` (la geometría: `maps` y `placements`, que administra Tiled; §12.9) y `public/assets/assets.json`. Cada archivo tiene su esquema (`bitacora.schema.json` y `maps.schema.json`, que repite sin cambios las definiciones compartidas `id`, `assetId`, `point` y `normalizedPoint`). En memoria, y para el juego, los scripts y las pruebas, la configuración es un solo objeto `BitacoraConfig` con `maps` y `placements` en el primer nivel (`mergeConfig` y `splitConfig`); un error de validación indica en qué archivo está. En Vite, los archivos de `public` se sirven como recursos estáticos y se copian sin transformar al resultado de compilación. [T18]

Carga los documentos mediante adaptadores centrales, no desde cada componente ni otra vez desde la escena. Secuencia:

```text
Obtener bitacora.json + maps.json + assets.json
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
- Las tres secciones configuradas existen sin duplicados; en esta versión los IDs son `learning`, `reflection`, `lived`.
- Las variables de diálogo están en una lista permitida. Los enlaces de referencias usan protocolos permitidos; nunca evaluar HTML, JavaScript, `eval` o nombres de componentes traídos del JSON.
- En `assets.json`, `assetCount` debe coincidir con el número real de claves de `assets` y `categoryCounts`, cuando se valide como inventario, debe ser coherente con las categorías observadas.
- Cada entrada utilizada en runtime debe tener un `path` no vacío, y el archivo resuelto debe existir en desarrollo/build. `originalPath` no se usa para cargar el recurso.
- Los campos `width` y `height`, cuando existan, deben ser positivos. `transparent` y `hasAlphaChannel` se consideran metadata del archivo, no reglas de colisión.
- Si `kind` es `pose-sheet` y `requiresFrameDefinition` es `true`, el juego puede precargar la imagen, pero no debe construir una animación hasta disponer de frames validados.
- `visualLayout` no equivale a un frame grid. `rowDirections` y `poseCount` pueden usarse para comprobar una definición de frames creada después, no para inventarla.
- `nineSlice`, `placement`, `zone`, `layer`, `variant` y otros metadatos especializados deben validarse solo cuando estén presentes y ser consumidos por el código que corresponda.
- En `maps[zona].ambient`, cada `assetId` existe y su metadata es coherente con el tipo: `animation` exige `atlasPath`, `animation` y `frameCount`; `sway` y `drift` exigen `motion` del mismo tipo; `particles` exige `motion.type = "particle"`. Las posiciones y áreas caen dentro de la zona y las escalas son positivas.
- `ambient` no tiene más de 60 efectos por zona; `speedFactor`, cuando existe, es mayor que 0.
- En `gameplay.player.idle`, `tricks` y `fetch` (opcionales) apuntan a hojas `idle-sheet` con una animación que cubre todos sus fotogramas, `holdMs` no es negativo y `actionKey` es una sola letra mayúscula, obligatoria si hay alguna de las dos. `rest`, `glance` y `play` existen con `kind` `idle-sheet`; `rest` y `glance` tienen una animación para cada dirección (`front`, `left`, `right`, `back`) y `play` una de frente; `glanceAfterMs` y `playAfterMs` son positivos, `playAfterMs` no es menor que `glanceAfterMs` y `gestureCooldownMs` no es negativo. Una hoja de reposo declara `atlasPath`, `animations`, `origin` y, o bien el lienzo lógico común en `sourceFrameSize`, o bien un `frameAdjust` completo (factor de escala y origen por fotograma, sin repetidos ni ajenos), y sus animaciones usan todas las regiones de su atlas.
- Los tipos `glow` y `swim` también exigen coherencia con la metadata: `glow` pide un asset de `kind` `light-glow` con `motion.type = "pulse"`; `swim` pide una hoja animada con `motion.type = "swim"` y una trayectoria de al menos dos puntos dentro de la zona; `animation` rechaza una hoja con `motion.type = "swim"` (debe usarse `swim`). `blendMode` solo admite `NORMAL` o `ADD` y `opacity` está entre 0 y 1.
- En `audio.music`, cada ID de `tracks` existe en `assets.json` con `kind` `music`, sin repetirse; `volume` está entre 0 y 1; `crossfadeMs` no es negativo y es menor que la mitad de la pista más corta; `rotation` es `sequential` o `shuffle`. Cada archivo de audio existe; su `sizeBytes` y `sha256` se contrastan y avisan si difieren. Los créditos con licencia sin verificar se informan como bloqueo de entrega final (§10).
- En `audio.sfx`, cada `assetId` de `events` existe en `assets.json` con `kind` `sfx`; los eventos son `ui.open`, `ui.confirm`, `badge.earned` o `portal.travel`; `volume` está entre 0 y 1 y `maxVoices` entre 1 y 64. En `maps[zona].sounds[soundId]`, el `soundId` usa minúsculas, números y guiones; el `assetId` es un recurso de `kind` `sfx` (nunca música ni imágenes); `volume` entre 0 y 1, `rate` entre 0,5 y 2, los fundidos no son negativos, `playback` es `loop`, `interval` (con `minMs` ≤ `maxMs`) o `enter`, un punto exige `innerRadius` menor que `radius` y estar dentro de la zona, y un área debe caber en ella. Cada recurso `sfx` del catálogo trae `durationSeconds`, `sizeBytes` y `sha256` y vive bajo `audio/sfx/`.
- Cada `atlasPath` existe, su `meta.image` coincide con el archivo del asset y sus regiones están dentro de la imagen, sin solaparse, con contenido y en número igual a `frameCount`. Los efectos ambientales no cambian colisiones ni alcanzabilidad.
- `assets.json` no contiene progreso, textos académicos, orden de estaciones ni coordenadas de gameplay; `bitacora.json` no contiene rutas físicas, hashes, tamaños de archivo ni procedencia original.

Las referencias cruzadas y la accesibilidad real del mapa no se resuelven solo por JSON Schema. Devuelve errores concretos, por ejemplo `placements.apr-c.decorationAssetId: asset ID no encontrado`; no una pantalla negra. No corrijas silenciosamente un ID mal escrito ni elimines una estación inválida de `route`.

En caso de `bitacora.json` inválido, no sobrescribas progreso ni construyas parcialmente el mundo. Si el manifiesto es válido pero un archivo gráfico falla, conserva la lectura accesible y reporta el asset ID y la ruta resuelta. Esto incluye el archivo que «carga» pero no se puede decodificar (por ejemplo, un servidor que devuelve la página de inicio en lugar de un 404): se detecta porque la textura no existe tras la carga. Son fallos diferentes.

<a id="spec-12-4"></a>

### 12.4. Contrato orientativo

Los tipos siguientes muestran la separación prevista. Implementa el esquema equivalente antes de consumir el JSON; esta especificación no es una biblioteca ya instalada. Las claves de los registros son los IDs: no dupliques un `id` editable dentro de cada valor.

```ts
type AppMode = "demo" | "final";
type SectionId = "learning" | "reflection" | "lived";
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
  subtitle?: string;                 // bajo el título en el letrero de la presentación; con él, el título completo es «título — subtítulo»
  welcomeTitle?: string;             // frase destacada sobre el texto de bienvenida
  finalReflection: ContentBlock[];
}

type DialogueEvent = "open" | "locked" | "completed" | "reward";

interface Learning {
  title: string;
  topic: string;
  signTitle?: string;                // título corto del letrero (1 a 40 caracteres); sin él se usa title
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
  awardedFor?: "route-complete";     // insignia que no es de ningún aprendizaje: se concede al terminar todo el recorrido (la de Jerry); xp 0
  tone?: "jade" | "lavender" | "gold";   // color de su tarjeta en el panel de insignias
  takeaway?: string;                 // «Lo que me llevo»: se muestra en el detalle solo si la autora lo escribe; no se inventa (en una de recuerdo, «Con mucho cariño»)
  specialType?: "friendship" | "memorial"; // solo con awardedFor: amistad (Jerry) o recuerdo (Rocky)
  subtitle?: string;                 // solo con awardedFor: línea bajo el nombre («Siempre en nuestro corazón»)
  unlockCondition?: string;          // solo con awardedFor: cómo se desbloquea, mientras está por descubrir
  secret?: boolean;                  // solo con awardedFor: no aparece en la colección hasta que se concede (Rocky)
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
  | { type: "animation"; assetId: string; position: Point; scale?: number; flipX?: boolean; alpha?: number; speedFactor?: number; depth: AmbientDepth }
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
  critters?: Critter[];              // gallinas y familias que merodean (§3.3); opcional
  sounds?: Record<string, MapSound>; // sonidos del mapa (§6.5), por soundId; opcional (omitido ≠ {}); los administra Tiled
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
    pending: string; previous: string; next: string;
    demo?: string;   // aviso de «Contenido de demostración» (opcional)
    progressTemplate: string; stationTitleTemplate: string;
    semester: string; teacher: string; sectionRead: string; sectionUnread: string; badgeEarned: string;
    remainingTemplate: string; rewardTitle: string; xpTemplate: string; levelTemplate: string;
    emptyRouteLabel: string; mapLabel: string;
    badges: string; notEarned: string; earnedOnTemplate: string; badgeCountTemplate: string;
    completionTitle: string; finalReflectionTitle: string; finalReflectionPending?: string;   // el aviso ya no se muestra
    resetConfirmTitle: string; resetConfirmText: string; resetConfirm: string; cancel: string;
    preparationTemplate: string;
    musicMute: string; musicUnmute: string;     // etiqueta del botón de música según su estado
    soundMute?: string; soundUnmute?: string; soundActivate?: string;   // lo mismo cuando hay efectos de sonido (§6.5): «Silenciar sonido», «Activar sonido» y «Activar audio» (el navegador bloqueó el audio)
    stateLocked: string; stateAvailable: string; stateCompleted: string;   // estado de cada aprendizaje en la lista accesible
    tapExplore: string; tapTravel: string;   // aviso de proximidad al tocar
    jerryAction: string;             // botón «Jugar con Jerry» (la tecla se muestra junto a la etiqueta)
    playerName: string; nextBadge: string;                  // «Vanessa» en el panel y «Siguiente» en el letrero de la próxima estación
    captionJournal: string; captionJerry: string; captionSound: string;   // textos de los botones con etiqueta
  };                                 // las plantillas solo admiten las variables permitidas de cada una (§12.7)
  assets: {
    window: string; button: string; stationSign: string; titleSign: string; portrait: string;
    xpBar: string; glow: string;
    badgesButton: string; listButton: string; musicButton: string; jerryButton: string;   // botones de la cabecera (§7)
    avatarAnimations?: string;   // hoja del avatar animado de la cabecera (`avatar-sheet`); sin ella se ve `portrait`, estático
    musicMutedButton?: string; completedBadge?: string; exitSign?: string; stationSparkle?: string;   // sonido silenciado, insignia «Completado», señal de cambio de mapa y destellos de la próxima estación (opcionales)
    xpStarEffect?: string; nextStationGlow?: string; statusPanel?: string;   // estrella de XP animada, aro de la próxima estación y panel de la cabecera (opcionales)
    buttonHover?: string; xpStar?: string; openBook?: string; lockIcon?: string;
  };
  defaultDialogueIds: Record<DialogueEvent, string>;
  badgePanel?: BadgePanelConfig;     // panel de insignias del kit (opcional; sin él, colección anterior)
}

interface BadgePanelConfig {
  assetPrefix: string;               // p. ej. "ui.badge-panel."; cada pieza usada debe existir con kind «badge-panel-part»
  labels: Record<"title" | "subtitle" | "obtainedTemplate" | "obtained" | "pending" | "special" | "viewBadge" | "hint" | "backToMap" | "backToCollection" | "myCollection" | "closePanel" | "eyebrowLearning" | "eyebrowSpecial" | "stillPending" | "represents" | "howEarned" | "howToEarn" | "completingTemplate" | "completeTemplate" | "completeRoute" | "routeEarned" | "takeaway" | "viewLearning" | "xpTemplate", string>;
}

interface IdleConfig {
  rest: string;                      // assetId de la hoja de reposo (kind «idle-sheet»), una animación por dirección
  glance: string;                    // hoja de la mirada a Jerry, una animación por dirección
  play: string;                      // hoja del juego con Jerry (una animación de frente)
  glanceAfterMs: number;             // quieta este tiempo sin entrada: mirada
  playAfterMs: number;               // y este tiempo desde el gesto anterior, de frente: juego
  gestureCooldownMs: number;         // pausa mínima entre gestos
  tricks?: { sheet: string };        // trucos de Jerry (kind «idle-sheet»): una acción que pide el visitante
  fetch?: { sheet: string; holdMs: number };   // buscar el peluche: la otra acción; el último fotograma se mantiene holdMs
  actionKey?: string;                // letra mayúscula con la que se piden (obligatoria si hay alguna acción)
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
    idle?: IdleConfig;               // reposo animado (§6.2); sin él se queda la pose quieta de la hoja de caminar
    // Píxeles de textura × scale, medidos desde el punto de apoyo (los pies): offset (0,0) son los pies.
    body: { width: number; height: number; offset: Point };
    shadow?: { alpha: number; widthFactor: number; aspect: number };   // sombra suave bajo cada «pie» de la hoja (§6.2); sin ella no hay sombras
  };
  companion: {
    mode: "separate" | "included";
    actor?: ActorSpec;               // Requerido cuando mode = separate
    followDistance: number;
  };
}

type SoundPlayback = { mode: "loop" } | { mode: "interval"; minMs: number; maxMs: number } | { mode: "enter"; cooldownMs: number };
type MapSound = {                    // §6.5; viven en maps.json › maps[zona].sounds
  label: string; assetId: string;    // assetId: recurso con kind "sfx"
  enabled: boolean;                  // apagarlo sin borrarlo (en el recorrido nunca suena)
  volume: number; rate: number;      // 0..1 y 0.5..2
  fadeInMs: number; fadeOutMs: number; playback: SoundPlayback;
} & (
  | { shape: "point"; position: Point; innerRadius: number; radius: number }
  | { shape: "rect"; area: Rect; edgeFadePx: number }
);

interface OneShotPreset { assetId: string; volume: number; rate: number }

interface AudioConfig {
  sfx?: {                            // §6.5; opcional: sin él no hay efectos
    active: boolean;
    volume: number;                  // 0..1, volumen general de los efectos
    maxVoices: number;               // 1..64
    events?: Partial<Record<"ui.open" | "ui.confirm" | "badge.earned" | "portal.travel", OneShotPreset>>;
  };
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
  placements: Record<string, Placement>;   // en maps.json
  maps: Record<string, MapZone>;           // en maps.json
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

<a id="spec-12-9"></a>

### 12.9. Edición de mapas con Tiled

Tiled es el **editor externo de los datos espaciales** de las zonas: colocar, mover, duplicar, eliminar y ajustar plantas animadas, gallinas, estaciones, puntos de aparición, portales y colisiones. Es solo una herramienta de autoría: React sigue administrando la interfaz y las lecturas, Phaser el mundo, las animaciones, la física y la navegación, y **ni el juego, ni el build, ni el importador necesitan la aplicación de escritorio**.

| Información | Autoridad |
| --- | --- |
| Inventario, archivos, atlas y metadata visual de assets | `assets.json` y sus atlas. |
| Ubicaciones y geometría | Los mapas `.tmj` de `tools/tiled/maps/` (un mapa por zona). |
| Contenido, `route`, XP, insignias, diálogos e interfaz | `bitacora.json`, que la importación **no toca nunca**. |
| Datos espaciales que consume el juego | `maps.json` (`maps` y `placements`), **generado por el importador** a partir de los mapas. |
| Progreso del visitante | La persistencia de siempre; mover objetos no reinicia ni concede nada (`configRevision` no se toca). |

**Flujo:** editar en Tiled → `npm run tiled:import` (con `npm run dev` abierto se hace solo al guardar, mediante un plugin de Vite que además muestra los errores sobre la página y los quita al corregirlos; `tiled:watch` hace lo mismo sin servidor) → el candidato se construye entero en memoria, se valida con `validateProject` (esquemas, referencias cruzadas, alcanzabilidad y colocación ambiental) → solo si todo pasa se reemplazan `maps` y `placements` en `maps.json` mediante archivo temporal y renombrado atómico, con copia del anterior (`tools/tiled/backups/<fecha>-maps.json`) → recargar la página (en desarrollo Vite la recarga solo; la escena no se actualiza en caliente). `npm run tiled:check` hace lo mismo sin escribir y falla si los mapas y `maps.json` no coinciden; el build lo ejecuta antes de la validación habitual. Con cualquier error la configuración previa queda intacta y el mensaje señala archivo, capa, objeto (id y nombre) y propiedad.

**Qué administra y qué conserva.** El importador reemplaza, en las zonas que tienen mapa, la dimensión, `label`, `layers`, `initialSpawnId`, `spawns`, `obstacles`, `decorations`, `ambient`, `critters`, `portals` y `sounds`, y en `placements` los de los aprendizajes activos cuya estación está en esos mapas. Conserva todo lo demás: zonas sin mapa, `placements` de aprendizajes archivados, textos, `route`, insignias, diálogos, interfaz, audio y ajustes. Escribe solo las regiones `placements` y `maps` de `maps.json` con el estilo del archivo (lo demás, como `$schema`, queda byte a byte igual) y no abre `bitacora.json` para escribir. Un guardado sin cambios no escribe nada, y un opcional omitido sigue omitido (lo que el tamaño o el reflejo de un objeto no pueden decir —`scale: 1` explícito, `flipX: false`— se anota en su propiedad `explicit`).

**Correspondencia** (clases del proyecto `bitacora.tiled-project`; las de objeto-tile heredan del tile del catálogo):

| Elemento de Tiled | Destino en `maps.json` |
| --- | --- |
| Capa de imagen (clase `BackgroundLayer`, propiedades `assetId` y `depth`) | `maps[zona].layers` |
| Objeto-tile `Station` (`learningId`, `interactionOffsetX/Y`, `interactionRadius`; opcionales `signAssetId`, `decorationAssetId`, `decorationOffsetX/Y`) | `placements[learningId]` |
| Objeto-tile `Decoration` (`originX/Y`, `depthMode`, `depth`) | `maps[zona].decorations` |
| Objeto-tile `Ambient` (`ambientType`, `depthMode`, `depth`; opcionales `alpha`, `speedFactor`) | `ambient` de tipo `animation`, `sway`, `drift` o `glow` |
| Rectángulo `Particles` (`assetId`, `frequencyMs`, profundidad; opcional `scale`) | `ambient` de tipo `particles` |
| Polilínea `Swim` (`assetId`, profundidad; opcionales `scale`, `speedFactor`) | `ambient` de tipo `swim`; puntos absolutos, en orden |
| Objeto-tile `Critter` (`critterType` `wander` o `family`, `radius`; familias: `chickAssetId`, `chicks`, opcional `chickScale`) | `critters` (los pollitos los genera el juego) |
| Rectángulo o elipse circular `Collision` | `obstacles` (`rect` con la esquina superior izquierda; `circle` con centro y radio) |
| Punto `Spawn` (`spawnId`) y propiedad de mapa `initialSpawnId` | `spawns` e `initialSpawnId` |
| Círculo `Portal` (`portalId`, `label`, `targetZoneId`, `targetSpawnId`) centrado en su punto de interacción | `portals` |
| Punto `SoundEmitter` o rectángulo `SoundArea` en la capa `sonidos` (propiedades comunes `soundId`, `label`, `assetId`, `enabled`, `volume`, `rate`, `playback`, `fadeInMs`, `fadeOutMs`, `intervalMinMs`, `intervalMaxMs`, `cooldownMs`; el emisor añade `innerRadius` y `radius`, el área `edgeFadePx`) | `sounds` (§6.5) |
| Propiedades del mapa `zoneId` y `label`; `width × tilewidth` y `height × tileheight` | id, `label` y dimensiones de la zona |

Una gallina usa `CritterBuilder` y una planta animada `AmbientBuilder`; la categoría «decorations» del manifiesto no obliga a importar a `decorations`. Las colisiones se editan solo en su capa: añadir una planta o una gallina no crea una colisión.

**Coordenadas, tamaños y orígenes.** Todo está en píxeles del mundo; la cuadrícula de 2 px del mapa es una ayuda del editor. Para un objeto-tile sin rotación ni escala distinta por eje, de tamaño visual `w × h` y origen `ox, oy`: `x = esquinaX + ox·w`, `y = esquinaY + oy·h` (los catálogos usan `objectalignment: topleft`; el importador acepta cualquier alineación y suma los desplazamientos de capas y grupos). El tamaño base con multiplicador 1 es el del juego: ambient, `lienzo × recommendedScale`; animales, `recommendedDisplay` (y su proporción); letreros, la imagen × `gameplay.signScale` (global: no se redimensionan uno a uno); decoraciones, la imagen entera (su `scale` es un dato de cada una). La escala sale del tamaño del objeto y debe ser uniforme (tolerancia 1e-6 px); una diferencia de hasta un 5 % entre la escala horizontal y la vertical (un arrastre de esquina sin Mayús) se importa con un aviso y la escala media, y una mayor es un estiramiento y se rechaza; los animales no pasan de 4× su tamaño recomendado (≈ 192 px una gallina), 120 px de radio, 8 pollitos ni 4× de `chickScale`, y el importador lo dice con su objeto; un objeto recién insertado del catálogo, que trae el tamaño nativo del preview, equivale a escala 1. El reflejo horizontal del tile equivale a `flipX` solo en animaciones y gallinas solitarias, y no mueve el anclaje. Los previews (`tools/tiled/previews/`, fuera de `public/assets`) son el fotograma lógico (`sourceSize`, `spriteSourceSize`; los rotados se rechazan) reducido al tamaño base.

**Sonidos.** La capa `sonidos` contiene un **punto** `SoundEmitter` (`innerRadius`, `radius`) o un **rectángulo** `SoundArea` (`edgeFadePx`) por sonido; `assetId` es un selector (`SoundAsset`) que solo ofrece efectos —nunca música— y `playback` otro (`SoundPlayback`: `loop`, `interval`, `enter`); los valores por defecto de las clases son los de `SOUND_DEFAULTS`. Un emisor sin objeto en el mapa no existe: borrarlo lo quita (y una zona que tenía sonidos y se queda sin ellos conserva `sounds: {}`). `enabled: false` apaga un sonido; ocultar la capa en el editor no. Los `soundId` no se repiten en una zona y los errores nombran archivo, capa, objeto y propiedad. Los mapas ya existentes **se parchean**, no se regeneran: `npm run tiled:sounds` añade la capa `sonidos` (vacía) a los que no la tienen, con copia previa y sin tocar los demás objetos, y el laboratorio de sonidos (§6.5) la añade sola al guardar el primer emisor. El flujo manual y el del laboratorio de sonidos (§6.5) son equivalentes: lo que guarda el laboratorio es un objeto de Tiled que se importa sin diferencias.

**Rechazos explícitos:** rotación libre, escala no uniforme, reflejo vertical o diagonal, `flipX` en tipos sin ese campo, parallax, tintes, opacidad o desplazamientos en las capas del paisaje, plantillas de objetos, teselas, `assetId` desconocidos o de otro `kind` (un sonido con música o con una imagen), sonidos con rotación, polígonos o elipses, `soundId` repetidos, valores fuera de rango, estaciones duplicadas, faltantes, archivadas o de aprendizajes inexistentes, y colisiones que no sean rectángulos sin rotación o círculos. Retirar una estación activa no se hace borrándola sin más: primero se archiva el aprendizaje quitándolo de `route` (conserva textos, insignia y su ubicación) y entonces se borra su estación. Las guías marcadas `EditorOnly` se ignoran; ocultar o bloquear una capa no elimina sus objetos del juego.

**Catálogo.** `tools/tiled/tilesets/catalogo.tsj` es una colección de imágenes generada del manifiesto con la misma tabla de `kind` y `motion` de `validateConfig`; no incluye la interfaz (salvo lo que un mapa ya usa) ni la música. Los IDs de tile son estables: añadir un asset no cambia los GID usados, y uno que deja de ser colocable se conserva marcado `obsolete` y se rechaza al importar. Las propiedades se resuelven como Tiled: valores por defecto de la clase del proyecto < tile < objeto, con `class` o `type`. `npm run tiled:catalog` actualiza catálogo, previews y proyecto sin tocar los mapas; `tiled:generate` crea los mapas que faltan, y regenerar uno existente exige `--force` y deja una copia en `tools/tiled/backups/`.

**Limitaciones conocidas:** `decorationAssetId` y `decorationOffset` de una ubicación se conservan y se validan, pero el juego todavía no los dibuja; las gallinas, las partículas, las luces y los patos se ven en el editor como una imagen fija o un rectángulo (el juego es la referencia de su movimiento); la señal del portal se coloca en el juego con un desplazamiento y ajuste a los bordes, así que el círculo de Tiled es su punto de interacción, no su imagen.

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

**Tipografías propias.** La bitácora no depende de las fuentes que traiga el dispositivo (Android no trae Trebuchet MS ni Georgia): sirve desde el propio sitio **Nunito** (interfaz, botones y letreros del mapa) y **Gelasio** (lecturas, compatible en medidas con Georgia), dos fuentes variables con licencia SIL OFL 1.1 de los paquetes `@fontsource-variable`, solo con el subconjunto latino (`src/styles/fonts.css`, un archivo `.woff2` por estilo, unos 115 KB en total). `--font-ui` y `--font-reading` (`tokens.css`) las listan primero y conservan las del sistema como reserva; el texto que Phaser dibuja sobre el canvas lee la misma `--font-ui` (`src/game/fonts.ts`). Como Phaser pinta su texto una sola vez, la aplicación espera a que lleguen las fuentes antes de crear el mapa, con un tope de 4 s (`fontsReady`): con una red lenta o sin los archivos la bitácora abre igual, con la letra de reserva. AC-96.

**Composición en móviles.** Se comprueba en un iPhone con la barra del navegador (393 × 664 px), en un Android pequeño (360 × 640) y a 320 × 568: (a) las cápsulas de avance («n de 6 completados» y «n de 6 obtenidas») contienen su texto y sus cuadritos dentro del borde decorativo —si no caben en una fila, pasan a dos, centrados— y no los pisan; (b) el índice de la Bitácora se desplaza **entero** (cabecera, avance y tarjetas) y solo su pie con «Volver al mapa» queda siempre a la vista, de modo que la lista tiene toda la pantalla y no una ventanita entre la cabecera y el pie, y el foco inicial no la desplaza; (c) en la colección el botón de cerrar queda arriba a la derecha, junto al título; y (d) la frase y el texto de bienvenida de la presentación usan la misma sans-serif que el resto del panel, como en el kit. Ninguna ventana se sale por los lados. AC-97.

Todos los elementos del mundo deben transformarse con la misma cámara. Los controles, la cabecera y los diálogos pertenecen a la interfaz y no se desplazan con el personaje.

Define como objetivo de diseño botones táctiles de al menos 44 × 44 píxeles CSS. Al cambiar tamaño u orientación, conserva la posición lógica del personaje y reajusta la cámara.

Incluye una opción «Bitácora de aprendizajes»: un botón siempre visible junto a la cabecera (a su derecha o justo debajo si no cabe) que abre un diálogo con una lista ordenada de los aprendizajes activos, cada uno con su número, título, estado dicho con texto (bloqueado, disponible o completado) y zona. Al cerrar una lectura abierta desde la lista se vuelve a ella. Permite abrir los aprendizajes disponibles o completados sin precisar el desplazamiento del personaje. Usa exactamente las mismas reglas de secuencia, lectura y recompensa: es una alternativa accesible de navegación, no un atajo para otorgar insignias.

Añade foco visible, etiquetas comprensibles y textos alternativos para evidencias. Los adornos deben ignorarse desde tecnologías de asistencia. No dependas únicamente del color para comunicar bloqueos o logros.

Respeta `prefers-reduced-motion`: elimina saltos repetidos, destellos y transiciones innecesarias, conservando una confirmación textual del logro. No reproduzcas sonido automáticamente al cargar: la única música es la de §6.4, que empieza solo tras una acción del visitante en la portada y se puede apagar en cualquier momento con un control accesible. [T7]

Mantén la tipografía del contenido a un tamaño cómodo y el ancho de lectura acotado. El zoom del navegador no debe ocultar botones esenciales ni provocar desbordamiento horizontal en los párrafos.

**Botones de la cabecera.** La insignia de la colección (`ui.assets.badgesButton`, dentro del panel) y las tres herramientas —Bitácora (la lista de aprendizajes), Jerry y Sonido (`listButton`, `jerryButton`, `musicButton` y, silenciado, `musicMutedButton`)— son **botones hechos con el arte del catálogo** (`kind` `button`). Las herramientas son los botones con etiqueta del paquete `bitacora-ui-assets`: la imagen no trae texto y la etiqueta visible («Bitácora», «Jerry», «Sonido», de `ui.labels.caption*`) se pone en la zona `label` de su entrada, debajo del icono. La caja del botón es la de la imagen (objetivo táctil ≥ 44 × 44 px); la imagen es decorativa (`alt` vacío) y el nombre accesible sale de `ui.labels` (aria-label y texto de ayuda). Tienen estados de pasar el ratón (más brillo), pulsado, foco visible y desactivado; el sonido silenciado cambia a la imagen del altavoz tachado (si no hay `musicMutedButton`, el icono se apaga y lo cruza una barra).

**Cabecera y disposición.** La cabecera es solo el **panel** del avatar: arriba a la izquierda, compacto (como máximo ≈ 28 rem de ancho) y con tres líneas —«Vanessa  Nivel 1», la barra de XP con su valor al lado y «1 de 6 aprendizajes»— más la insignia de la colección; no lleva rótulo «Mi bitácora» ni dice qué estación sigue (lo dice el letrero «Siguiente»); solo el aviso «recorrido en preparación» (modo final con aprendizajes sin aprobar) sigue apareciendo bajo el panel. Las tres herramientas van arriba a la derecha. **En el móvil (≤ 700 px)** el mapa llena la pantalla de esquina a esquina y la interfaz queda encima conservando su posición: el panel arriba, a todo lo ancho, y las tres herramientas abajo, centradas; el aviso de proximidad queda justo encima de ellas, y se respetan las áreas seguras del dispositivo. Los toques sobre la interfaz no llegan al mapa, los demás sí.

**Panel de la cabecera.** El recuadro del avatar, el progreso, el XP y el botón de insignias es el PNG `ui.panel.player-status.default` (`ui.assets.statusPanel`), usado como **imagen de nueve zonas** (`border-image` con los cortes de `nineSlice`, 112 px en la imagen): las esquinas escalonadas no se estiran y el centro se adapta al contenido; el fondo y el borde sencillos solo se usan si no está configurado. El borde del panel se reduce en pantallas estrechas para que el texto no pise el botón de insignias, y a 320 px el avatar, las fuentes y el botón de insignias se reducen para que el texto quepa.

**Ventanas y foco.** Cada ventana tiene **un solo botón «Cerrar»**: el verde del pie en la lista de aprendizajes, los mensajes (estación bloqueada o pendiente) y la recompensa, que además recibe el foco inicial; en la apertura y la lectura de un aprendizaje, cuyo pie ocupa la acción principal («Siguiente», «Marcar», «Recoger insignia»), el «Cerrar» queda en la cabecera para poder salir también con el dedo. `Escape` cierra siempre. **El panel de insignias** sigue el diseño del kit: la «X» de la cabecera (`closePanel`) y «Volver al mapa» en el pie; en el detalle, «Volver a la colección» y «Mi colección» vuelven a la colección, `Escape` también, y desde la colección cierra el panel. El foco queda atrapado dentro y pasa al primer botón al cambiar de vista; en móvil las tarjetas se apilan en dos columnas y los botones miden al menos 44 px. Los botones verdes no dibujan un recuadro alrededor al recibir el foco (la portada enfoca «Comenzar» al abrirse): el foco se muestra con el estado resaltado del botón y un halo claro que sigue su forma. Las herramientas junto a la cabecera (lista, Jerry, controles y música) se centran en vertical con ella, como el botón de insignias; en pantallas estrechas cuelgan debajo.

**Escala de la interfaz.** La interfaz HTML escala con la ventana: tamaños en unidades relativas (`rem`/`em`) sobre una raíz fluida y acotada (≈16 px en móvil y a 1280 px, hasta ≈24 px en pantallas muy grandes), de modo que cabecera, botones, pestañas, diálogos y texto de lectura se vean proporcionados en pantallas grandes y no queden diminutos. Los objetivos táctiles miden al menos 44 × 44 px CSS en cualquier escala. El tamaño de la interfaz y el del mundo son independientes: la cámara transforma el escenario y el CSS escala las ventanas.

Para esta implementación, plantea un canvas ajustado al contenedor mediante el Scale Manager y una cámara que muestra la porción necesaria del mapa; no uses las dimensiones del mundo como dimensiones obligatorias de pantalla. Selecciona y documenta una política de escala compatible con la versión de Phaser, inicialmente `RESIZE` con límites y zoom de cámara. No combines un redimensionamiento arbitrario por CSS con coordenadas de entrada que no reflejen ese cambio. [T12]

El contenedor debe tener dimensiones explícitas y actualizarse al cambiar orientación, cabecera o barras del navegador móvil. No fuerces orientación horizontal. Mantén los modales en una capa HTML superior con bloqueo de punteros al escenario, sin bloquear el scroll de lectura.

El canvas no es la única vía de acceso. La lista de aprendizajes, los mensajes y el contenido deben seguir funcionando aunque falle el renderizado del motor. Ofrece reintentar la carga del mapa y conservar el progreso; no sustituyas silenciosamente todo el minijuego por una lista cuando el motor sí funciona.

Comunica `prefers-reduced-motion` también a Phaser para desactivar sacudidas, destellos, seguimiento con transiciones innecesarias y celebraciones repetitivas. El CSS por sí solo no controla las animaciones dentro del canvas.

<a id="spec-15"></a>

## 15. Criterios de aceptación y entregables

<a id="spec-15-1"></a>

### 15.1. Resultados exigidos

Estos criterios describen el resultado requerido, no pruebas ya superadas. Los IDs `AC-01` a `AC-97` permiten relacionarlos con las tareas y evidencias de [PLAN.md](PLAN.md). No renumerarlos al actualizar el estado de implementación.

| ID | Prueba | Resultado esperado |
|---|---|---|
| <a id="ac-01"></a>AC-01 | Identidad académica | La portada muestra Vanessa Estrada, Universidad de Antioquia, Licenciatura en Educación Infantil, la asignatura «Desarrollo de la actitud científica en la infancia» y el semestre 2026 - 2; no se inventa el nombre de la docente. |
| <a id="ac-02"></a>AC-02 | Primera visita | Progreso vacío; primer ID de `route` disponible en demo; restantes bloqueados. |
| <a id="ac-03"></a>AC-03 | Movimiento | Las flechas del teclado funcionan; sin mayor velocidad diagonal ni salida del terreno permitido. |
| <a id="ac-04"></a>AC-04 | Interacción | El contenido se abre por acción explícita cerca de una estación o desde la navegación accesible. |
| <a id="ac-05"></a>AC-05 | Lectura | Abrir o cambiar de pestaña no concede la insignia; cerrar conserva las secciones marcadas. |
| <a id="ac-06"></a>AC-06 | Recompensa | Marcar las tres secciones y confirmar otorga una sola insignia y desbloquea la siguiente. |
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

| <a id="ac-55"></a>AC-55 | Flora animada integrada | Las seis plantas del tercer kit se añaden a `assets.json` sin alterar las entradas existentes; archivos, atlas, hashes y regiones son válidos y cada una declara `origin` (raíz) y `recommendedScale`. |
| <a id="ac-56"></a>AC-56 | Flora viva y bien colocada | Cada zona muestra flores y arbustos que cambian de fotograma con velocidades y fases distintas; su raíz está sobre suelo no transitable y no se superpone a plantas pintadas ni a puntos de interacción; con movimiento reducido quedan en un fotograma fijo. |
| <a id="ac-57"></a>AC-57 | Presupuesto de efectos | Una zona con más de 60 efectos produce un error localizado, y con todo el ambiente de ambas zonas activo la mediana sigue siendo ≥ 50 fps sin objetos residuales al cambiar de zona. |

| <a id="ac-58"></a>AC-58 | Tocar para caminar | En un móvil, por defecto, tocar el mapa lleva a Vanessa al punto tocado rodeando los obstáculos (sin atascarse ni atravesarlos), con un círculo animado en el destino que desaparece al llegar; tocar una zona no transitable lleva a su orilla; arrastrar reorienta; una flecha, una ventana o un cambio de zona cancelan. |
| <a id="ac-59"></a>AC-59 | Explorar tocando | Junto a una estación o portal, tocarlos equivale a «Explorar» con las mismas reglas de secuencia; lejos de ellos, tocarlos lleva a su punto de interacción sin abrirlos y un segundo toque los abre; el aviso dice qué tocar. |
| <a id="ac-60"></a>AC-60 | Sin cruceta | En móvil no hay cruceta, botón «Explorar» ni botón para cambiar de modo de control: solo se camina y se explora tocando, y ya no se guarda ninguna preferencia de controles (una antigua se ignora). |
| <a id="ac-61"></a>AC-61 | Movimiento reducido y escritorio | Con `prefers-reduced-motion` el círculo del destino aparece quieto y sin onda y el toque camina igual; en escritorio no se muestran controles táctiles. |

| <a id="ac-62"></a>AC-62 | Reposo animado | Al detenerse se usa la hoja de reposo en la dirección en que miraba (respiración y parpadeo en bucle), a la escala del caminar y con los pies sobre el punto de apoyo, sin saltos entre la pose de caminar y la de reposo; las tres hojas se añaden a `assets.json` sin alterar las existentes y sus atlas validan contra la imagen. |
| <a id="ac-63"></a>AC-63 | Gestos de reposo | Tras 4,5 s sin entrada Vanessa y Jerry se miran una vez; tras 10 s, de frente, juegan una vez; de lado o de espaldas solo hay mirada; hay una pausa mínima entre gestos, nunca dos animaciones a la vez, y cualquier movimiento los cancela de inmediato y reinicia la espera. |
| <a id="ac-64"></a>AC-64 | Reposo y accesibilidad | Con `prefers-reduced-motion` queda un fotograma fijo del reposo sin gestos; si una hoja no carga se conserva la pose quieta del caminar y el juego sigue; abrir y cerrar una lectura o cambiar de zona no deja el reposo detenido ni duplicado. |

| <a id="ac-65"></a>AC-65 | Trucos y peluche | (Con la hoja de trucos corregida: Vanessa conserva la altura del caminar en cada fotograma gracias a su escala y origen por fotograma.) Las dos hojas del kit se añaden a `assets.json` sin alterar lo anterior y validan contra su imagen; la tecla P lanza buscar el peluche y, la siguiente vez, los trucos con dar la pata, alternando; cada uno se reproduce una vez, el peluche se mantiene en el último fotograma y luego se vuelve al reposo; no se reinician, el movimiento los cancela y no actúan con una ventana abierta. |
| <a id="ac-66"></a>AC-66 | Botón de Jerry | Un botón accesible «Jugar con Jerry (P)» (≥ 44 px, con la tecla en su etiqueta, desactivado con una ventana abierta) hace lo mismo que la tecla, detiene un recorrido por toque y devuelve el foco al mapa tras pulsarlo con ratón o toque; con movimiento reducido muestra un fotograma fijo del resultado; sin acciones configuradas no existe. |

| <a id="ac-67"></a>AC-67 | Botones de icono | Los cinco botones de la cabecera usan los assets del catálogo referenciados por `ui.assets`, con el marco llenando su caja (≥ 44 px), imagen decorativa y nombre accesible en `aria-label`; el de música apagada muestra una barra que lo cruza; los siete assets del paquete se añaden a `assets.json` sin alterar lo anterior y sus archivos, hashes y tamaños son válidos. |

| <a id="ac-68"></a>AC-68 | Aro de la próxima estación | La estación que es la próxima del recorrido muestra un aro animado en bucle por debajo de su señal, con el pulso de opacidad del manifiesto; solo hay uno visible, pasa a la siguiente al completarla y desaparece cuando no queda ninguna; si su hoja no carga se conserva el brillo estático. |
| <a id="ac-69"></a>AC-69 | Estrella de XP | Al cerrar la recompensa de un aprendizaje sale una estrella de XP sobre su estación: entra creciendo (fotogramas 0 a 3) y a partir de ahí titila en bucle (fotogramas 3, 4, 5, 4 a 5 fps, con la opacidad de `opacityByFrame`) mientras la estación siga completada; al cargar con estaciones ya completadas la estrella está ya titilando, sin entrada; sustituye a la estrella estática (que queda como respaldo si la hoja no carga); con movimiento reducido el aro es un fotograma fijo y la estrella queda quieta (fotograma 3) y permanente. `hideOnComplete` del manifiesto no se aplica a esta hoja. |
| <a id="ac-70"></a>AC-70 | Panel de la cabecera | La cabecera usa el panel del catálogo como imagen de nueve zonas; con él, desde 320 hasta 1280 px de ancho (y apaisado) la cabecera y sus herramientas caben sin scroll y el texto no pisa el botón de insignias; las dos hojas de efectos y el panel se añaden a `assets.json` sin alterar lo anterior, con archivos, hashes y atlas válidos. |
| <a id="ac-71"></a>AC-71 | Avatar de la cabecera | El retrato de la cabecera es el avatar de Vanessa con Jerry: en reposo respira y parpadea (fotogramas y duraciones en ms de `avatarAnimations`, kind `avatar-sheet`); al completar un aprendizaje (`app:celebrate`, al cerrar la recompensa) hace la animación feliz durante seis vueltas (7,2 s) y vuelve al reposo; con movimiento reducido no se anima: fotograma de reposo fijo y, al completar, el de la sonrisa abierta unos segundos; si la hoja o su atlas no cargan se ve el avatar estático (`ui.assets.portrait`) y el juego sigue; en pantallas de 480 px o menos el retrato se oculta, como antes; el avatar y la hoja se añaden a `assets.json` sin alterar lo anterior, con archivos, hashes y atlas válidos. |
| <a id="ac-72"></a>AC-72 | Identidad de las estaciones | Cada letrero muestra su número centrado en el círculo, el título corto dentro de la placa (aunque sea de 40 caracteres) y debajo el estado: «Completado» (insignia con su texto), «Siguiente» (píldora verde en la próxima) o el candado con el título atenuado (bloqueada), todo según `labelZones` y `attachments` de la entrada del letrero; un letrero sin `labelZones` lleva solo el número; las entradas nuevas de `assets.json` (letrero, señal de cambio de mapa, insignia, cuatro botones y brillo) traen sus zonas dentro de la imagen, con archivos, hashes y atlas válidos y lo anterior intacto; la señal de cambio de mapa lleva el destino. |
| <a id="ac-73"></a>AC-73 | Sombras | Vanessa y Jerry tienen cada uno una sombra suave bajo los pies (elipses calculadas de los píxeles del fotograma visible) que los acompaña al caminar, en reposo y en los gestos, queda justo debajo del sprite en profundidad, se queda en el suelo cuando Vanessa salta al celebrar y no existe sin `gameplay.player.shadow`. |
| <a id="ac-74"></a>AC-74 | Cabecera compacta y móvil | La cabecera es el panel (≤ 28 rem), con «Vanessa · Nivel», XP con su valor y «n de m aprendizajes», sin rótulo «Mi bitácora» ni aviso de la siguiente estación; las herramientas con etiqueta van arriba a la derecha; con 700 px o menos el mapa llena la pantalla (canvas a todo el ancho y alto) con el panel arriba a todo lo ancho y las herramientas abajo centradas por encima del mapa, el aviso de proximidad sobre ellas, sin scroll horizontal desde 320 px; el avatar se ve en todos los tamaños. |
| <a id="ac-75"></a>AC-75 | Estaciones sobre pasto y destellos | Las seis estaciones apoyan en pasto junto al camino y son alcanzables sin ajustar el destino; la próxima estación tiene el brillo animado (opacidad 0,72) y cinco destellos pequeños que centellean alrededor, que no existen con movimiento reducido ni se ven en las demás estaciones. |
| <a id="ac-76"></a>AC-76 | Clics de ratón | En escritorio, un clic izquierdo o derecho en el mapa pone el círculo del destino y Vanessa camina hasta allí rodeando los obstáculos, llegando a menos de 6 px; el clic derecho no abre el menú del navegador; mantener el botón y arrastrar reorienta el destino; el botón central no mueve; una flecha cancela el recorrido; un clic en la estación estando junto a ella la abre; con una ventana abierta los clics no mueven a Vanessa. |
| <a id="ac-77"></a>AC-77 | Zona sensible del portal | Para viajar con un toque o un clic basta tocar el cartel del portal entero (también su esquina más alejada del punto de interacción) o hasta 36 px a su alrededor, estando Vanessa junto a él; más lejos, el toque solo camina. |
| <a id="ac-78"></a>AC-78 | Gallinas y pollitos | Cada zona muestra exactamente los animalitos de su configuración, con las razas indicadas, su sombra y su orden por profundidad; reposan, picotean y pasean, y nunca salen de su círculo; los pollitos siguen a su madre sin separarse más de 90 px; con movimiento reducido quedan quietos en el primer fotograma; si falta la hoja de una raza las demás siguen; una zona sin `critters` no tiene ninguno; más de 30 por zona, un asset que no es `critter-sheet` o un área fuera de la zona dan error de validación; las seis entradas nuevas de `assets.json` traen archivos, hashes y atlas válidos con lo anterior intacto. |
| <a id="ac-79"></a>AC-79 | Insignias | Cada aprendizaje muestra su insignia del paquete (recompensa, colección y celebración) con su nombre y significado; las siete entradas nuevas de `assets.json` traen archivos, hashes y recortes válidos con lo anterior intacto; la colección añade la insignia de Jerry, «Por obtener» con su pista hasta terminar el recorrido y «Insignia obtenida» con la fecha del último aprendizaje después, sin sumar XP ni contar en «n de m»; una insignia de recorrido con XP distinto de 0 o usada por un aprendizaje da error de validación. |
| <a id="ac-80"></a>AC-80 | Panel de insignias | Con `ui.badgePanel`, la colección es el panel del kit: título «Mis insignias», cápsula «n de m obtenidas» (sin contar la de Jerry), una tarjeta por aprendizaje activo en el orden del recorrido, «Obtenida» o «Por descubrir» en su texto y su nombre accesible, y la tarjeta de Jerry; al terminar el recorrido muestra además la reflexión final, solo si la autora la escribió (sin texto no hay título ni aviso). Una tarjeta abre el detalle (qué representa, cómo se consiguió o se consigue, fecha, XP; «Lo que me llevo» solo si hay `takeaway`; «Ver aprendizaje» solo en las de aprendizaje), y «Volver a la colección», «Mi colección», la flecha y `Escape` regresan a la colección. Las 60 piezas `ui.badge-panel.*` traen archivos, hashes, `group` y cortes `nineSlice` válidos con lo anterior intacto, y una pieza usada que falte o tenga otro `kind` da error de validación. El foco queda dentro del panel y no hay violaciones de axe. |
| <a id="ac-81"></a>AC-81 | Edición de mapas con Tiled | Generar los mapas desde `maps.json` e importarlos sin editar devuelve la configuración entera sin cambios (posiciones, tamaños, opcionales omitidos o explícitos, colisiones con su geometría exacta, spawns, portales, familias y trayectorias; tolerancia 1e-6 px). Mover una estación, duplicar una gallina, escalar o eliminar una planta, cambiar una familia, un emisor, un pato, un obstáculo, un spawn o un portal en los mapas e importar cambia el juego como se espera en las dos zonas, sin tocar textos, `route`, insignias ni progreso. Los errores (asset desconocido, estación duplicada o faltante, JSON o tileset ausente, banderas o escalas no admitidas, geometría no soportada) bloquean la escritura, dejan `maps.json` intacto y señalan archivo, capa, objeto y propiedad. Los GID del catálogo no cambian al añadir assets, y `tiled:check` bloquea el build si los mapas y `maps.json` difieren (`bitacora.json` no se modifica nunca). El importador, el check y el build funcionan sin Tiled instalado. |
| <a id="ac-82"></a>AC-82 | Carga por etapas | El mapa se muestra y se recorre cuando llegan los assets esenciales de la zona (menos de 20 MB y menos de la mitad de lo que pesa la zona entera), con la barra «Cargando el mapa…» mientras tanto; las imágenes de la interfaz no quedan sin cargar mientras el mapa descarga. El paisaje vivo, el reposo animado y la celebración llegan después sin bloquear y se crean solos; las insignias no se cargan hasta celebrar; un archivo que falta en cualquier etapa se avisa con su ID y el resto sigue; el cambio de zona repite el proceso sin duplicar objetos. |
| <a id="ac-83"></a>AC-83 | Bitácora de aprendizajes | Con `ui.journalPanel` (y `ui.badgePanel`), «Bitácora» abre el índice del kit —«n de m completados» y una tarjeta por aprendizaje con su estado y «Explorar» o «Volver a leer»— y cada aprendizaje se abre directo en su lector, sin la ventana de apertura: título, estado, «Aprendizaje n · zona», tres pestañas, «n de 3 secciones leídas», el texto, «En este aprendizaje» (ilustración y palabras clave) y la insignia con «Ver insignia». Abrir una pestaña no marca; «Marcar como leído y continuar» marca y avanza; con las tres leídas el pie ofrece «Recoger insignia» (la única forma de completar y de conceder, una sola vez); en uno completado el pie recorre las secciones y termina en «Volver a la bitácora». Las 11 piezas `ui.journal-panel.*` traen archivos, hashes y `kind` válidos con lo anterior intacto, y una pieza usada que falte o tenga otro `kind` da error de validación. En escritorio y portátil el lateral conserva el tamaño natural de la ilustración y la insignia y, si no cabe, se desplaza dentro de sí mismo (nunca se omiten las palabras clave ni se tapa el botón del pie) con cualquier tamaño de letra; la X cambia al pasar el cursor y al abrir un aprendizaje el foco queda en el diálogo sin anillo sobre «Resumen»; en móvil el lector se apila; los botones miden al menos 40 px; no hay violaciones de axe. Sin `ui.journalPanel` se usan la lista y la lectura anteriores. |
| <a id="ac-84"></a>AC-84 | Estación y relectura | Un aprendizaje sin completar solo se abre desde la Bitácora o la colección estando Vanessa junto a su estación; estando lejos se muestra el mensaje de `ui.labels.awayFromStationTemplate` (con el título y la zona) y no se abre la lectura ni cambia nada. Uno completado se relee desde cualquier sitio. «Ver aprendizaje» en el detalle de una insignia abre la lectura de ese aprendizaje con esas reglas y, al cerrarla, vuelve al detalle. |
| <a id="ac-85"></a>AC-85 | Insignia de Rocky | La octava insignia, «Rocky» (`ui.badge.rocky`), es de recuerdo y secreta: mientras falte algún aprendizaje no aparece en la colección ni se nombra; al terminar surge junto a la de Jerry, sin contar en «n de m» ni sumar XP, con el subtítulo «Siempre en nuestro corazón», la etiqueta «Obtenida» y un detalle con «Un recuerdo lleno de amor», «Un lugar para recordarlo» y «Con mucho cariño» (sin fecha, XP ni «Ver aprendizaje»). Los campos `specialType`, `subtitle`, `unlockCondition` y `secret` solo valen con `awardedFor`, y una insignia de recuerdo exige `ui.badgePanel.labels.memorial`; la entrada nueva de `assets.json` trae archivo, hash y recorte válidos con lo anterior intacto. |
| <a id="ac-86"></a>AC-86 | Configuración en dos archivos | La configuración se carga de `bitacora.json` (contenido) y `maps.json` (`maps` y `placements`), cada uno validado con su esquema y juntos contra el manifiesto; un fallo de red, de JSON o de validación de cualquiera de los dos impide cargar y dice en qué archivo está; `validate:config` valida los dos (y señala la clave de más que se perdería al unirlos); la importación de Tiled solo reescribe `maps.json` y deja `bitacora.json` byte a byte igual; el servidor de desarrollo recarga la página al cambiar cualquiera de los dos y el build publica ambos. |
| <a id="ac-87"></a>AC-87 | Presentación | Con `ui.presentation`, la portada es la presentación del kit: letrero con el título y el subtítulo, «ASIGNATURA» con la asignatura, la estudiante, el programa, la universidad y el semestre, la frase y el texto de bienvenida, la ilustración de Vanessa y Jerry y un único botón «Comenzar recorrido» o «Continuar recorrido» (sin botón de cerrar), todo tomado de `project`, `ui.labels` y `ui.presentation.labels`. En escritorio, portátil y tableta el panel entero cabe en la pantalla sin desplazarse y conserva la proporción 1040 × 716, sin que el texto pase sobre la ilustración; en móvil pasa a una columna con desplazamiento y sin desplazamiento horizontal; con letra al 125 % sigue entera. Todas las imágenes cargan, el botón mide al menos 40 px, el foco inicial está en él sin anillo (el anillo sale con el teclado) y no hay violaciones de axe. Las 7 piezas `ui.presentation.*` traen archivos, hashes, `kind`, `group` y el corte del pergamino válidos con lo anterior intacto, y una pieza usada que falte o tenga otro `kind` da error de validación. Sin `ui.presentation` se usa la portada sencilla. |
| <a id="ac-88"></a>AC-88 | Sonidos del mapa | Un sonido de punto suena a volumen completo hasta `innerRadius`, calla desde `radius` y cae de forma cuadrática entre ambos; un área suena completa dentro y cae hasta `0` a `edgeFadePx` fuera (con `0`, fuera es silencio); la distancia se mide en píxeles del mundo desde los pies de Vanessa. En `loop` hay una sola voz por emisor con fundido de entrada y de salida; en `interval` los disparos no se solapan y la espera solo corre dentro del alcance; en `enter` se dispara al entrar, con enfriamiento e histéresis, y la entrada inicial se evalúa una vez al desbloquear el audio sin acumular lo que no pudo sonar. No hay más voces que `maxVoices` (el ambiente cede ante un efecto de interfaz, no al revés), los recursos se cargan una vez con un tope de memoria, y cambiar de zona, cerrar la escena o destruir el juego detiene y libera los sonidos, sin que una limpieza tardía de otra escena toque a la actual. Un `enabled: false` nunca suena en el recorrido. |
| <a id="ac-89"></a>AC-89 | Catálogo y contrato de efectos | Los efectos son entradas de `assets.json` con `kind` «sfx», `audio/sfx/`, `durationSeconds`, `sizeBytes` y `sha256` válidos y lo anterior intacto; un sonido o un efecto de interfaz que apunte a música, a una imagen o a un ID inexistente da un error con su ruta. `audio.sfx` (`bitacora.json`) y `sounds` (`maps.json`) se validan con sus esquemas y reglas (volumen 0..1, velocidad 0,5..2, fundidos, intervalo mínimo ≤ máximo, radio interior < exterior, dentro de la zona); `sounds` omitido y `{}` se distinguen y se conservan al unir y separar los archivos; sin `audio.sfx` la configuración sigue siendo válida. Los siete tonos de prueba son reproducibles con `scripts/tools/generate-test-sfx.ts`. |
| <a id="ac-90"></a>AC-90 | Autorización y botón «Sonido» | Antes de «Comenzar»/«Continuar» no hay voces, no se piden los efectos de interfaz y el audio no está autorizado; después queda listo. Si el navegador bloquea el audio, el botón ofrece «Activar audio» y pulsarlo lo reintenta. El botón «Sonido» silencia y reactiva la música y los efectos juntos con una sola preferencia (`soundMuted`; la antigua `musicMuted` se lee y se escribe con el mismo valor), existe aunque haya efectos y no música, habla de «sonido» con efectos y de «música» sin ellos, mide ≥ 44 px, y con teclado conserva el foco mientras que con ratón lo devuelve al mapa. Con la pestaña oculta, en silencio o con una lectura abierta (solo el ambiente) no suena nada, y al volver no hay cola de sonidos antiguos. |
| <a id="ac-91"></a>AC-91 | Efectos de interfaz y recompensa | `ui.open` suena en una apertura real de una lectura o un panel (no en mensajes de bloqueado, pendiente o lejos, ni con otra ventana abierta); `ui.confirm` al marcar de verdad una sección nueva y al confirmar el reinicio; `badge.earned` una sola vez por transacción de recompensa con su identificador (también con la última lectura, que concede a Jerry y a Rocky), sin repetirse por doble clic ni al releer; `portal.travel` solo al aceptarse un viaje. Un mensaje de una escena antigua no suena. Sin servicio de efectos el controlador funciona igual. |
| <a id="ac-92"></a>AC-92 | Sonidos en Tiled | El proyecto de Tiled define `SoundEmitter` (punto) y `SoundArea` (rectángulo), el selector `SoundAsset` (solo efectos) y `SoundPlayback`; generar los mapas desde `maps.json` e importarlos sin editar devuelve los sonidos sin cambios, y mover un emisor, cambiar su volumen o su modo, duplicarlo o borrarlo se importa; `enabled: false` se conserva y ocultar la capa no apaga el sonido; las guías `EditorOnly` se ignoran; `sounds` omitido y `{}` se conservan. Un asset desconocido o de música, un `soundId` repetido o inválido, la rotación, un polígono o una geometría que no es punto/rectángulo, una propiedad de la forma contraria o un valor fuera de rango bloquean la escritura, dejan `maps.json` intacto y señalan archivo, capa, objeto y propiedad. Los mapas existentes se parchean sin regenerarlos y `tiled:check` los ve en paz con `maps.json`. |
| <a id="ac-93"></a>AC-93 | Laboratorio de sonidos | Solo con `npm run dev` y `?audioLab=1` aparece el botón «Sonidos» (sin la bandera no hay botón, panel ni código descargado). El panel tiene las pestañas Mapa, Presets y Archivo de prueba; en el modo mapa congela la escena con el motivo `audio-lab` sin pisar el de la lectura y se escucha desde un oyente virtual que se mueve con clic, arrastre o flechas; en el modo recorrido se quita la pausa y Vanessa camina. Probar usa los valores del borrador, la distancia al oyente y los cambios en vivo; Detener apaga con el fundido; Solo calla la música y los demás emisores; Detener todo calla también el ambiente hasta Reanudar; probar un preset no concede ni revela insignias. Un archivo local (WAV, MP3, OGG o M4A, ≤ 8 MB y ≤ 60 s) se prueba y se asigna sin tocar el proyecto; gana la última selección, la memoria tiene tope y no se descarta un archivo que un ajuste usa. Restablecer, Aplicar a esta sesión y Comprobar no escriben; cerrar el panel no deja pausa, solo, oyente virtual ni pruebas. El panel tiene etiquetas visibles, objetivos de al menos 44 px, pestañas con flechas y mensajes `aria-live`. |
| <a id="ac-94"></a>AC-94 | Guardar, exportar e importar | «Guardar en el proyecto» parcha solo el objeto de Tiled seleccionado y `maps.json` (un emisor deja `bitacora.json` y `assets.json` byte a byte iguales; un preset o un ajuste general cambia solo la región `audio.sfx`), incorpora un archivo nuevo al catálogo con su copia, `sha256`, tamaño y duración medidos en el servidor sin sustituir ni duplicar recursos, valida el resultado entero en memoria antes de escribir y, si algo falla, recupera todo lo escrito. Un archivo que cambió en el disco desde que lo vio el panel es un conflicto que no escribe nada y conserva el borrador; un valor inválido, una forma que cambia o una zona sin mapa se rechazan; dos guardados se serializan y el cerrojo impide un segundo; los observadores de Tiled no importan una transacción a medias; la página se recarga una sola vez; y `tiled:check` queda en paz. El paquete exportado (versionado, con los archivos incrustados) se importa con `npm run audio-lab:import` con la misma transacción. |
| <a id="ac-95"></a>AC-95 | Solo en desarrollo | El build de producción (`npm run build`) no contiene el laboratorio ni sus rutas: `dist` no incluye código del panel y la vista previa de producción no responde en `/__audio-lab/*`. Las rutas de desarrollo rechazan peticiones que no vienen de esta máquina, de otro origen, sin la cabecera del laboratorio, con un tipo de contenido que no es JSON o con un cuerpo mayor del límite. |
| <a id="ac-96"></a>AC-96 | Tipografías propias | Nunito (interfaz, botones y letreros del mapa) y Gelasio (lecturas) se sirven desde el propio sitio —tres archivos `.woff2` del mismo origen, también en la compilación de producción, sin servidores externos— y están cargadas antes de crear el mapa; el texto HTML de la portada, la cabecera, la Bitácora, las lecturas y las insignias, y el que dibuja Phaser, usa una de las dos (ningún texto depende de la fuente del sistema). Con los archivos bloqueados o una red lenta (tope de 4 s) la bitácora abre y se recorre con las fuentes de reserva. |
| <a id="ac-97"></a>AC-97 | Composición en móviles | A 393 × 664, 360 × 640 y 320 × 568: el texto y los cuadritos de las cápsulas de avance del índice y de la colección caben dentro de su borde (en dos filas si hace falta) sin pisarlo; el índice de la Bitácora se desplaza entero con «Volver al mapa» siempre a la vista (≥ 44 px) y hay sitio para una tarjeta entera entre el borde y el pie; en la colección el botón de cerrar está en la fila del título; la frase y el texto de bienvenida de la presentación usan Nunito; y ni la portada, ni el índice ni la colección tienen desplazamiento horizontal. |

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
