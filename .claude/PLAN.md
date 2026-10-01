# PLAN.md — Plan de implementación de la bitácora

**Proyecto:** Bitácora interactiva de Vanessa Estrada.  
**Documento:** plan de ejecución y seguimiento, subordinado a [SPEC.md](SPEC.md).  
**Revisión documental:** 8 (añade la **Fase 4B**, entre la 4 y la 5, y aplaza la Fase 5; ver §3.4B y SPEC §3.2, §6.3, §14, AC-37 a AC-46). Adapta la implementación al `assets.json` real entregado por el usuario: se preservan su contrato, IDs, `pathConvention`, `path`, metadata especializada y hojas de poses pendientes de frame definition.  
**Estado de partida:** 37 tareas de implementación pendientes en seis fases. No hay evidencia de código ejecutado en estos documentos.

<a id="plan-0"></a>

## 0. Cómo utilizar este plan

Leer primero [`.claude/SPEC.md`](SPEC.md) y después este archivo. La especificación define el comportamiento y sus contratos; este plan define **en qué orden construirlo y cómo verificar y registrar el trabajo**.

No copiar aquí el contrato JSON, la arquitectura detallada, los textos académicos ni la tabla completa de resultados esperados. Las referencias a secciones de `SPEC.md` y a criterios `AC-XX` evitan mantener dos versiones de un mismo requisito. Si el usuario cambia un requisito, actualizar primero la especificación y después las tareas afectadas.

Inspeccionar el repositorio y los assets antes de modificar archivos. No sobrescribir trabajo existente, inventar recursos o aprobar contenidos por cuenta propia. El esquema, el cargador y el juego siguen siendo trabajo de implementación: disponer de un JSON de ejemplo no los crea.

<a id="plan-1"></a>

## 1. Estado, insumos y dependencias iniciales

| Insumo | Situación de partida / uso |
|---|---|
| `.claude/SPEC.md` | Especificación documental preparada; leer completa antes de implementar. |
| `.claude/PLAN.md` | Este plan. Sus casillas reflejan tareas, no requisitos opcionales. |
| `bitacora.example.json` | Ejemplo existente compatible con el contrato de `SPEC.md`, sección 12. Ajustar a los recursos reales antes de usarlo como configuración del sitio. |
| `assets.json` | Manifiesto real ya entregado. Tratarlo como entrada autoritativa: no regenerarlo ni migrarlo a un esquema inventado; conservar IDs, paths, hashes, procedencia y metadata especializada. |
| Repositorio | Inspección pendiente por la IA implementadora. No se infiere su estado a partir de estos archivos. |
| Assets y mapas | Consumir `public/assets/assets.json` como fuente de rutas e inventario. `visualLayout` no es un frame grid y `requiresFrameDefinition` exige inspección antes de crear animaciones. No duplicar rutas o metadata existente. |
| Contenido final y publicación | Mantener separados de las pruebas técnicas; consultar la sección 5 de este plan. |

La revisión documental 4 **no incrementa** `schemaVersion`, `contentRevision` ni el formato de guardado. `bitacora.example.json` no se modifica con esta separación; su nota sobre la revisión 3 identifica su origen histórico, no otra especificación vigente.

<a id="plan-2"></a>

## 2. Reglas de ejecución y seguimiento

Trabajar por fases con un flujo funcional completo antes de ampliar el recorrido. Registrar versiones, comandos y resultados observados; conservar el lockfile. Las decisiones técnicas están en [SPEC.md, sección 11](SPEC.md#spec-11), no se redefinen durante una tarea.

Marcar `[x]` solo cuando la tarea esté implementada y comprobada. Si existe código sin verificar o un bloqueo, dejar `[ ]` y registrar estado, causa y evidencia en la sección 6. No marcar un hito porque una herramienta propuso código o porque un archivo tiene sintaxis válida.

Los textos o assets faltantes no paralizan toda la implementación: usar únicamente alternativas demo explícitas admitidas por `SPEC.md`. Un pendiente que bloquea la entrega final debe seguir visible. No publicar el sitio como resultado automático de completar una fase.

Las pruebas se escriben durante cada fase; la fase 6 ejecuta y consolida la regresión completa. Un incumplimiento detectado en una fase posterior reabre la tarea afectada y queda registrado.

<a id="plan-3"></a>

## 3. Fases y tareas

Las tareas siguientes conservan el alcance del plan anterior. Los IDs `P1-01` a `P6-06` sirven para enlazar commits, pruebas y bloqueos; no deben reutilizarse para trabajos distintos.

<a id="plan-3-1"></a>

### 3.1. Fase 1. Inventario, contrato y carga

**Dependencia:** Inspección inicial del repositorio, lectura de `.claude/SPEC.md` y `.claude/PLAN.md`, y disponibilidad de las herramientas de desarrollo necesarias.  
**Especificación:** secciones [3](SPEC.md#spec-3), [11](SPEC.md#spec-11), [12](SPEC.md#spec-12).  
**Criterios relacionados:** [AC-01](SPEC.md#ac-01), [AC-14](SPEC.md#ac-14), [AC-29](SPEC.md#ac-29), [AC-31](SPEC.md#ac-31).

- [x] **P1-00** Si `phaser4-gamedev` no está instalado en Claude Code, leer `https://github.com/Yakoub-ai/phaser4-gamedev`, instalarlo con scope de proyecto según su documentación y verificar que sus comandos/skills/agentes estén disponibles. No usar `/phaser-new` ni `/phaser-gdd` para sustituir la arquitectura o la SPEC.
- [x] **P1-01** Integrar el `assets.json` real y sus archivos: verificar `assetCount/categoryCounts`, `basePath/pathConvention`, existencia de cada `path` y conservar sin migraciones sus IDs y metadata de inventario.
- [x] **P1-02** Configurar React + Vite + TypeScript + Phaser con versiones compatibles y scripts sin telemetría.
- [x] **P1-03** Crear/ajustar `bitacora.schema.json`; si se mantiene `assets.schema.json`, derivarlo del manifiesto real y cubrir sus campos comunes/metadatos especializados sin forzar una migración. Crear tipos y validadores de referencias cruzadas.
- [x] **P1-04** Incorporar la configuración inicial de seis aprendizajes y dos zonas, con geometría provisional identificada.
- [x] **P1-05** Implementar carga central de ambos JSON y un `AssetRegistry` que resuelva `assets[assetId].path` respecto al propio manifiesto, preserve metadata y produzca errores localizados. Añadir `validate:config` que valide referencias y archivos reales.
- [x] **P1-06** Mostrar portada desde `project` y un único canvas a escala coherente, sin copias de los datos.

**Salida:** `bitacora.json` validado, `assets.json` real consumido sin transformación destructiva, registro de assets resolviendo IDs/paths según su convención y una base ejecutable; faltantes y hojas de poses pendientes están explícitos.

<a id="plan-3-2"></a>

### 3.2. Fase 2. Exploración basada en datos

**Dependencia:** Salida verificable de la fase 1.  
**Especificación:** secciones [4](SPEC.md#spec-4), [6](SPEC.md#spec-6), [11](SPEC.md#spec-11).  
**Criterios relacionados:** [AC-03](SPEC.md#ac-03), [AC-04](SPEC.md#ac-04), [AC-08](SPEC.md#ac-08), [AC-21](SPEC.md#ac-21), [AC-24](SPEC.md#ac-24), [AC-32](SPEC.md#ac-32).

- [x] **P2-01** Construir la escena reutilizable a partir de `maps`, `route` y `placements`, resolviendo todos los recursos a través del `AssetRegistry`.
- [x] **P2-02** Implementar flechas, velocidad normalizada, cuerpos de pies y obstáculos.
- [x] **P2-03** Incorporar cámara y sprites desde IDs reales del manifiesto. Para `pose-sheet` con `requiresFrameDefinition: true`, inspeccionar la imagen y crear/validar frames explícitos antes de cualquier animación; no dividir por `visualLayout` automáticamente.
- [x] **P2-04** Crear estaciones independientes, numeración derivada y puntos de interacción ligados a sus posiciones.
- [x] **P2-05** Conectar proximidad y diálogo por interacción explícita, sin recompensas automáticas.
- [x] **P2-06** Implementar portales libres de ida/regreso y validar sus puntos seguros.
- [x] **P2-07** Componer `zone-01` y `zone-02` seleccionando explícitamente capas reales (`horizon`, `terrain`, `midground`, `foreground`) y una sola variante cuando corresponda; validar profundidad y evitar cargar todas las variantes a la vez.

**Salida:** ambas zonas son recorribles; una estación se puede mover por JSON sin tocar Phaser.


El enlace con la apertura en esta fase puede usar una respuesta provisional del controlador; la ventana completa y sus diálogos se cierran en la fase 3. No crear un segundo sistema provisional de progreso.

<a id="plan-3-3"></a>

### 3.3. Fase 3. Lectura, diálogos e insignia de un aprendizaje

**Dependencia:** Salida verificable de la fase 2.  
**Especificación:** secciones [7](SPEC.md#spec-7), [8](SPEC.md#spec-8), [11](SPEC.md#spec-11), [12](SPEC.md#spec-12), [13](SPEC.md#spec-13).  
**Criterios relacionados:** [AC-05](SPEC.md#ac-05), [AC-06](SPEC.md#ac-06), [AC-07](SPEC.md#ac-07), [AC-09](SPEC.md#ac-09), [AC-10](SPEC.md#ac-10), [AC-12](SPEC.md#ac-12), [AC-15](SPEC.md#ac-15), [AC-16](SPEC.md#ac-16), [AC-17](SPEC.md#ac-17), [AC-18](SPEC.md#ac-18), [AC-19](SPEC.md#ac-19).

- [x] **P3-01** Construir la ventana, las pestañas y el renderizador desde `ui` y `learnings`.
- [x] **P3-02** Implementar diálogos comunes/overrides, variables permitidas y presentación HTML accesible.
- [x] **P3-03** Integrar el puente con sincronización inicial, pausa, foco y reanudación.
- [x] **P3-04** Implementar marcado de secciones y finalización idempotente en el dominio.
- [x] **P3-05** Derivar una insignia y XP desde `badgeId`, y celebrar solo la nueva transición.
- [x] **P3-06** Guardar y restaurar el avance de la primera estación sin duplicar efectos.

**Salida:** flujo completo funcional, con todos sus textos y mensajes editables.

<a id="plan-3-4"></a>

### 3.4. Fase 4. Recorrido dinámico y reconciliación

**Dependencia:** Salida verificable de la fase 3.  
**Especificación:** secciones [4](SPEC.md#spec-4), [10](SPEC.md#spec-10), [12](SPEC.md#spec-12), [13](SPEC.md#spec-13).  
**Criterios relacionados:** [AC-02](SPEC.md#ac-02), [AC-13](SPEC.md#ac-13), [AC-23](SPEC.md#ac-23), [AC-25](SPEC.md#ac-25), [AC-26](SPEC.md#ac-26), [AC-27](SPEC.md#ac-27), [AC-28](SPEC.md#ac-28), [AC-30](SPEC.md#ac-30).

- [x] **P4-01** Completar el recorrido de seis aprendizajes de demo sin inventar contenidos finales.
- [x] **P4-02** Derivar totales, numeración, siguiente pendiente y finalización exclusivamente de `route`.
- [x] **P4-03** Implementar archivo/reactivación, reordenación y revisión individual de contenido.
- [x] **P4-04** Separar demo/final, detectar activos no aprobados y conservar el progreso por ID.
- [x] **P4-05** Probar variantes de cinco y siete estaciones modificando solo JSON, también entre zonas.
- [x] **P4-06** Construir colección de insignias, cierre editable y reinicio con confirmación.

**Salida:** agregar, retirar, reordenar y editar no requiere modificar componentes o reglas.

<a id="plan-3-4b"></a>

### 3.4B. Fase 4B. Escala visual, encuadre y paisaje animado

**Origen:** petición del usuario tras la fase 4: elementos de interfaz, personaje y letreros más grandes; mapa centrado y ocupando la pantalla en monitores grandes (hoy queda anclado arriba a la izquierda); y animaciones a partir del kit `bitacora-landscape-animations.zip`.  
**Diagnóstico medido (2177×1385):** el zoom de cámara es fijo (1) y el mundo mide 1448×1086; al ser la vista mayor que el mundo la cámara no puede moverse y lo ancla en la esquina (el mundo ocupa el 67 % del ancho y el 78 % del alto), y el personaje mide siempre 79 px (≈ 6 % de la altura). **Recomendación adoptada:** zoom «cover» con tope (el mapa llena siempre la ventana y todo crece en pantallas grandes), con centrado de respaldo si la vista excediera el mundo; en lugar de dejar barras vacías o fijar el tamaño.  
**Dependencia:** Salida verificable de la fase 4. **La Fase 5 queda aplazada** hasta cerrar esta fase.  
**Especificación:** secciones [3.2](SPEC.md#spec-3-2), [6.3](SPEC.md#spec-6-3), [12.3](SPEC.md#spec-12-3), [12.4](SPEC.md#spec-12-4), [14](SPEC.md#spec-14).  
**Criterios relacionados:** [AC-37](SPEC.md#ac-37), [AC-38](SPEC.md#ac-38), [AC-39](SPEC.md#ac-39), [AC-40](SPEC.md#ac-40), [AC-41](SPEC.md#ac-41), [AC-42](SPEC.md#ac-42), [AC-43](SPEC.md#ac-43), [AC-44](SPEC.md#ac-44), [AC-45](SPEC.md#ac-45), [AC-46](SPEC.md#ac-46).

- [x] **P4B-01** Encuadre del mundo: zoom «cover» acotado por `gameplay.camera` y centrado cuando la vista excede el mundo; sin anclaje a la esquina ni franjas vacías; recalcular al redimensionar.
- [x] **P4B-02** Escala de personaje y letreros: subir `gameplay.player.scale` y añadir `gameplay.signScale`; números, etiquetas e iconos del mundo proporcionales; cuerpo de colisión con el mismo tamaño físico y alcanzabilidad revalidada.
- [x] **P4B-03** Interfaz proporcional: unidades relativas con raíz fluida; cabecera, botones, pestañas, diálogos y lectura más grandes; verificación de 390 a 3840 px de ancho.
- [x] **P4B-04** Integrar el kit: copiar los archivos, **añadir** sus entradas a `assets.json` (sin alterar las existentes), exponer el atlas en el `AssetRegistry` y validar archivos, hashes y regiones de atlas contra las imágenes.
- [x] **P4B-05** Contrato y motor de `maps[].ambient`: esquema, tipos y validadores; `AmbientBuilder` con atlas animados, vaivén, deriva de nubes y partículas; movimiento reducido; limpieza al cambiar de zona.
- [x] **P4B-06** Colocación por zona (provisional, revisada visualmente): ondas, espuma y cascadas en el agua, nubes, plantas en lugares libres y partículas, sin cambiar colisiones ni alcanzabilidad.
- [x] **P4B-07** Verificación visual y de rendimiento: capturas de 390 a 3840 px, fps, fugas al cambiar de zona, movimiento reducido, E2E y playtest del plugin.

**Salida:** el mapa llena y centra la ventana en cualquier tamaño, el personaje, los letreros y la interfaz se leen bien, y cada zona tiene paisaje animado editable solo por JSON.

<a id="plan-3-4c"></a>

### 3.4C. Fase 4C. Piezas adicionales del paisaje y música de fondo

**Origen:** petición del usuario tras la fase 4B: añadir las animaciones de `bitacora-landscape-extras.zip` (luces del árbol, patos, nubes y partículas luminosas) y tres pistas de música de fondo (`Beyond The Clouds`, `Enchanted Festival`, `little town - orchestral`) que rotan entre sí, con un control para apagar y encender la música dentro del juego.  
**Decisión que cambia la SPEC:** §14 decía «no reproduzcas sonido automáticamente». Se mantiene la intención (nada suena al cargar) y se amplía: la música empieza solo tras pulsar «Comenzar»/«Continuar» y se puede apagar siempre (SPEC §6.4, §14).  
**Licencias (verificadas en OpenGameArt, no suposiciones):** las dos pistas de Matthew Pablo son CC BY 3.0 (exigen atribución). La procedencia y licencia de `little town - orchestral` **no se pudo verificar** (la página «Little Town» de bart ofrece GPL 2.0/3.0 y CC-BY-SA 3.0, pero no lista un archivo «orchestral»): se registra como no verificada y bloquea la entrega final hasta que se confirme (sección 5).  
**Dependencia:** Salida verificable de la fase 4B. **La Fase 5 sigue aplazada.**  
**Especificación:** secciones [3.2](SPEC.md#spec-3-2), [6.4](SPEC.md#spec-6-4), [12.3](SPEC.md#spec-12-3), [12.4](SPEC.md#spec-12-4), [14](SPEC.md#spec-14).  
**Criterios relacionados:** [AC-47](SPEC.md#ac-47), [AC-48](SPEC.md#ac-48), [AC-49](SPEC.md#ac-49), [AC-50](SPEC.md#ac-50), [AC-51](SPEC.md#ac-51), [AC-52](SPEC.md#ac-52), [AC-53](SPEC.md#ac-53), [AC-54](SPEC.md#ac-54).

- [ ] **P4C-01** Integrar las piezas adicionales: copiar archivos, **añadir** sus 11 entradas a `assets.json` (sin alterar las existentes) con `blendMode`, `opacity` y movimiento `pulse`/`swim`, y validar archivos, hashes y atlas.
- [ ] **P4C-02** Ampliar el contrato y el motor de `maps[].ambient`: efectos `glow` y `swim`, `sway` para el farol, mezcla y opacidad desde el manifiesto, movimiento reducido y ciclo de vida limpio.
- [ ] **P4C-03** Colocación por zona (revisada visualmente): guirnalda, farol, halo, rayos y destellos en los árboles; nubes nuevas; patos por tramos de agua navegable; luciérnagas y polen.
- [ ] **P4C-04** Indexar la música en `assets.json` (`category: "audio"`, `kind: "music"`, duración y crédito) y definir `audio.music` en `bitacora.json` con esquema, tipos y validadores.
- [ ] **P4C-05** Reproductor de música: rotación de pistas con fundido, inicio tras el gesto de «Comenzar», carga por flujo y bajo demanda, pausa con la pestaña oculta y tolerancia a fallos; independiente de Phaser y de las zonas.
- [ ] **P4C-06** Control en el juego para apagar y encender la música (botón accesible en la cabecera), preferencia guardada aparte del progreso sin créditos en la portada (decisión del usuario; la atribución queda en el manifiesto); aviso de entrega final si falta verificar una atribución.
- [ ] **P4C-07** Verificación: pruebas unitarias y E2E (rotación, apagado/encendido, persistencia, continuidad entre zonas, carga bajo demanda, movimiento reducido), capturas, rendimiento y playtest del plugin.

**Salida:** cada zona tiene luces, patos, nubes y partículas luminosas animadas editables por JSON, y suena música de fondo rotativa que el visitante puede apagar y encender.

<a id="plan-3-5"></a>

### 3.5. Fase 5. Móvil, accesibilidad y robustez *(aplazada: se ejecuta después de la Fase 4B)*

**Dependencia:** Salida verificable de la fase 4B (antes, de la fase 4).  
**Especificación:** secciones [6](SPEC.md#spec-6), [11](SPEC.md#spec-11), [13](SPEC.md#spec-13), [14](SPEC.md#spec-14).  
**Criterios relacionados:** [AC-03](SPEC.md#ac-03), [AC-04](SPEC.md#ac-04), [AC-09](SPEC.md#ac-09), [AC-10](SPEC.md#ac-10), [AC-11](SPEC.md#ac-11), [AC-15](SPEC.md#ac-15), [AC-17](SPEC.md#ac-17), [AC-18](SPEC.md#ac-18), [AC-20](SPEC.md#ac-20), [AC-21](SPEC.md#ac-21), [AC-29](SPEC.md#ac-29).

- [ ] **P5-01** Implementar controles táctiles con cancelación y pulsación simultánea.
- [ ] **P5-02** Habilitar la lista accesible usando las mismas reglas de acceso y avance.
- [ ] **P5-03** Ajustar textos largos, nombres, pestañas, zoom, orientación y lectura móvil.
- [ ] **P5-04** Propagar movimiento reducido y verificar todos los motivos de pausa.
- [ ] **P5-05** Probar cambios repetidos de zona y desmontajes sin listeners o canvas duplicados.
- [ ] **P5-06** Probar `assetId` inexistente, `path` roto, `assetCount/categoryCounts` incoherentes, metadata inválida, hoja de poses sin frames y almacenamiento no disponible, sin perder avance.

**Salida:** experiencia usable en escritorio, móvil y por teclado/lista, con errores recuperables.

<a id="plan-3-6"></a>

### 3.6. Fase 6. Pruebas, edición y entrega

**Dependencia:** Salida verificable de la fase 5.  
**Especificación:** secciones [12](SPEC.md#spec-12), [15](SPEC.md#spec-15), [16](SPEC.md#spec-16).  
**Criterios relacionados:** [AC-01 a AC-46](SPEC.md#spec-15-1).

- [ ] **P6-01** Ejecutar tests de configuración, progresión, reconciliación, almacenamiento y puente.
- [ ] **P6-02** Probar de extremo a extremo las operaciones editoriales de [SPEC.md, sección 12.6](SPEC.md#spec-12-6).
- [ ] **P6-03** Ejecutar validación de `bitacora.json`, consistencia del manifiesto real, referencias/archivos, tipos, tests y build de producción.
- [ ] **P6-04** Verificar en la base de despliegue que `AssetRegistry` resuelve los `path` desde la ubicación real del manifiesto sin duplicar prefijos, y que cambiar un `path` conservando el ID sustituye el recurso sin tocar `bitacora.json`.
- [ ] **P6-05** Revisar visualmente el mapa y la lectura en escritorio/móvil, sin presentar emulación como dispositivo real.
- [ ] **P6-06** Entregar README con el contrato de `bitacora.json` y documentación del `assets.json` existente, incluyendo `requiresFrameDefinition`, resolución de paths, capas/variantes y metadata especializada; registrar pendientes y resultados verdaderos.

**Salida:** código compilable, datos editables y pruebas documentadas. La aprobación del contenido y la autorización de publicación siguen siendo aparte.

<a id="plan-4"></a>

## 4. Estrategia de pruebas y cierre

<a id="plan-4-1"></a>

### 4.1. Cobertura

El resultado exigido para cada prueba está en [SPEC.md, sección 15](SPEC.md#spec-15). Los siguientes grupos organizan su ejecución, no agregan otra definición del comportamiento:

En las pruebas unitarias, cubre: intento de marcar un pendiente bloqueado; secciones duplicadas; finalización incompleta; doble confirmación; XP derivados; retiro/reactivación; inserción entre completados; reordenación; revisión individual; ruta vacía; separación demo/final; IDs y referencias inválidos. No uses solo fixtures de seis elementos.

En las pruebas de integración, cubre: `game:ready` antes/después de cargar progreso; mensajes de una escena antigua; denegación que libera controles; cerrar lectura con otra razón de bloqueo activa; transición de zona y desmontaje/remontaje sin duplicaciones. Verifica el canvas mediante estado observable de la aplicación y comprobaciones visuales; no supongas que los sprites son elementos DOM seleccionables.

Prueba especialmente el cambio de tamaño con el personaje desplazado, la pérdida de foco con una flecha pulsada, abrir un diálogo mientras se camina y mantener pulsado un control táctil al sacar el dedo de su zona.

Incluye pruebas automatizadas de las funciones de progreso y, cuando el entorno lo permita, una prueba de extremo a extremo del recorrido. Como mínimo, documenta la verificación manual de los casos anteriores.

Para las operaciones editoriales, partir de una configuración válida y modificar solo JSON. Comparar antes y después sin tocar componentes: activar cinco, seis y siete aprendizajes; mover entre zonas; reordenar; archivar/reactivar; insertar antes de completados; editar diálogo/insignia y aumentar una revisión individual. Contrastar con [SPEC.md, sección 12.6](SPEC.md#spec-12-6) y [sección 13.2](SPEC.md#spec-13-2).

<a id="plan-4-2"></a>

### 4.2. Ejecución reproducible

Configurar y documentar scripts para validar `bitacora.json`, la consistencia del `assets.json` real, referencias cruzadas y archivos, comprobar tipos, ejecutar tests, compilar y previsualizar, conforme a `SPEC.md`. Usar el gestor de paquetes real del repositorio. Los nombres siguientes son una propuesta para implementar; no se afirma que ya existan:

```bash
npm run validate:config
npm run typecheck
npm test
npm run build
npm run preview
```

Registrar comando exacto, entorno, resultado, criterio cubierto y evidencia. No dar por pasado un comando no ejecutado, ni confundir revisión de Markdown/JSON con una prueba funcional del minijuego. La vista previa requiere comprobar el comportamiento, no solo que aparezca una URL.

<a id="plan-4-3"></a>

### 4.3. Condición de cierre

Una fase se cierra cuando sus tareas y su salida tienen evidencia y sus criterios relacionados no presentan fallos conocidos. La implementación técnica completa exige cobertura de `AC-01` a `AC-46`, tipos/configuración/tests/build sin fallos y los entregables de [SPEC.md, sección 15.2](SPEC.md#spec-15-2).

Distinguir en la entrega **implementación técnica**, **contenido académico aprobado** y **autorización de publicación**. Los recursos provisionales permiten probar demo, pero no dar por terminada una entrega final que los requiere resueltos.

<a id="plan-5"></a>

## 5. Pendientes y bloqueos de entrada

Actualizar el estado de estos insumos con evidencia. Las restricciones y tratamientos admitidos pertenecen a [SPEC.md](SPEC.md); esta tabla organiza qué falta recibir, inspeccionar o resolver.

| Pendiente | Acción prevista |
|---|---|
| Contenido definitivo de los seis aprendizajes iniciales y posibles cambios | Mantener JSON editable y ejemplos etiquetados; Vanessa debe revisar y aprobar. |
| Nombre de la docente | Omitir en la interfaz hasta recibirlo. |
| Hojas de poses del `assets.json` real | El manifiesto ya las identifica y marca `requiresFrameDefinition`; inspeccionar imágenes y definir frames válidos sin modificar/falsificar `visualLayout`. |
| Distribución y colisiones exactas | Ajustar `maps` y `placements` a imágenes reales; tres y tres es solo una demo. |
| Fondo sin estaciones incrustadas | Verificar imagen limpia o registrar la edición gráfica pendiente; no exigir tileset. |
| Fotogramas direccionales o poses ausentes | Usar una pose existente y registrar la limitación; no inventar nuevos recursos. |
| Reflexión final y evidencias académicas | Crear espacios configurables sin atribuir texto inventado a la estudiante. |
| Mostrar la atribución de la música | Las dos pistas de Matthew Pablo son CC BY 3.0 y exigen atribuir al autor. El usuario pidió quitar los créditos de la portada: decidir dónde mostrarlos (pantalla de créditos, pie del sitio publicado o la descripción del repositorio) antes de publicar. |
| Licencia de `little town - orchestral` | Confirmar autoría y licencia de ese archivo concreto (la página «Little Town» de bart en OpenGameArt es GPL 2.0/3.0 y CC-BY-SA 3.0; no lista una versión orquestal). Hasta entonces la atribución queda sin verificar y bloquea la entrega final (P4C-06). |
| Destino de hosting y visibilidad | Preparar build y documentar; esperar autorización para publicar. |

Registrar un bloqueo concreto contra el ID de tarea afectado, no una declaración genérica de que todo el proyecto está bloqueado. Mantener la revisión y aprobación de Vanessa separadas de la generación de texto de demostración.

<a id="plan-6"></a>

## 6. Registro de ejecución

Sin ejecuciones de implementación registradas en la separación documental. La IA que implemente debe completar esta tabla con resultados reales y enlazar evidencias del repositorio; no rellenarla con resultados supuestos.

| Tarea / criterio | Estado | Cambio o comando ejecutado | Resultado y evidencia | Bloqueo / siguiente acción |
|---|---|---|---|---|
| P1-00 | Verificado | Leído el README de `Yakoub-ai/phaser4-gamedev`. Con el CLI recién instalado (`~/.local/bin/claude` 2.1.286): `claude plugin marketplace add Yakoub-ai/phaser4-gamedev --scope project` y `claude plugin install phaser4-gamedev@phaser4-gamedev --scope project`. Antes se había escrito `.claude/settings.json` a mano (método 2 del README); el CLI lo dejó equivalente. | `claude plugin list`: v0.7.0, scope project, enabled. `claude plugin validate`: pasa. Copia instalada con 10 comandos, 5 agentes, 26 skills y 2 hooks (revisados: sin red, `eval` ni borrados). Los `plugin.json` dicen 21 skills / 7 comandos: están desactualizados respecto al README. | La sesión de Claude Code que ya estaba abierta no carga el plugin hasta reiniciarse; en una sesión nueva en este directorio comprobar `/phaser-run`, `/phaser-playtest` y el agente `phaser-coder`. `/phaser-new` y `/phaser-gdd` no se usan (SPEC 11.2.1). |
| P1-01 | Verificado | `assets/` estaba en la raíz del repo y `public/` vacío; se movió con `mv assets public/assets` (sin copiar ni tocar archivos). Comprobación con script ad hoc (Python) sobre `public/assets/assets.json`. | 45 entradas = `assetCount`; `categoryCounts` coherente (backgrounds 14, characters 7, decorations 1, effects 1, references 2, stations 7, ui 13); `basePath` = `.`; los 45 `path` existen; `sizeBytes`, `sha256` y `width/height` (cabecera PNG) coinciden; 4 `sourceDocuments` con hash correcto; sin archivos huérfanos. `assets.json` no se modificó. Cubre parcialmente AC-33. | `assets/README.md` menciona `asset-renames.csv`, que no existe en la entrega; no es un asset del manifiesto, queda como nota. La comprobación formal y repetible será `validate:config` (P1-05). |
| P1-02 | Verificado | Sin plantilla ni `/phaser-new`: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts` (`base: './'`, `assetsDir: 'bundle'` para no mezclar con `dist/assets/`), `index.html`, `.gitignore` y esqueleto mínimo en `src/` (`main.tsx`, `App.tsx`, `PhaserGame.tsx`, `createGame.ts`, escena provisional). `npm install`, `npm run typecheck`, `npm run build`, `vite` (dev) y `vite preview` + sonda Playwright. | Versiones instaladas (`npm ls`): phaser 4.2.1, react/react-dom 19.3.0, vite 8.3.1, @vitejs/plugin-react 6.1.1, typescript 7.0.2, @types/node 24.19.0, playwright 1.63.0; Node v24.20.0, npm 11.19.0; 0 vulnerabilidades. `typecheck` y `build` sin errores. Dev y preview: 1 canvas, 0 peticiones a otros orígenes, 0 errores de consola; en dev `__PHASER_GAME__` presente y escena activa; Strict Mode no duplica el canvas (la instancia de prueba se destruye). `/assets/assets.json` y PNG se sirven (200) y `dist/assets/assets.json` es idéntico al original. Sin telemetría en `index.html` ni `src/`. | El script `test` y vitest se añaden con las primeras pruebas reales (P1-03), para no tener un `test` que pase en vacío. `validate:config` llega en P1-05. Se regeneró `package-lock.json` (solo contenía playwright 1.63.0, misma versión). La escena y el componente son provisionales: P1-06 (portada, canvas a escala coherente) y P2-01 siguen pendientes. |
| P1-03 | Verificado | Creados `public/config/bitacora.schema.json` y `public/assets/assets.schema.json` (JSON Schema 2020-12, derivado de las 45 entradas reales: 13 campos comunes y 12 de metadata especializada; entradas abiertas para conservar metadata futura). Tipos en `src/config/types.ts`. Validadores en `src/config/`: `schemaValidation.ts` (Ajv estricto + mensajes en español con ruta), `validateAssets.ts` (`assetCount`, `categoryCounts`, paths relativos, `poseCount` × `visualLayout`, `rowDirections`, `placement.relativeTo`) y `validateConfig.ts` (referencias cruzadas). Añadidos `ajv` 8.20.0 y `vitest` 5.0.3 y el script `npm test`. | `npm test`: 41/41 pasan (`src/tests/config.test.ts`), con el `assets.json` real y un fixture parametrizable de 5/6/7 aprendizajes (`src/tests/fixtures/makeConfig.ts`). Cubren: forma, `assetId` inexistente con ruta exacta (`placements.apr-c.decorationAssetId`), `kind` incompatible, insignia repetida, variables de diálogo y protocolos de URL, spawns/portales/interacción fuera del mundo o dentro de obstáculos, alcanzabilidad de zonas con ida y regreso, capas (una variante por capa, una sola zona del catálogo, orden de profundidad), hoja de poses sin frames, companion `included`/`separate`. `npm run typecheck` y `npm run build` sin errores. Cubre parcialmente AC-29 y AC-33. | **Decisiones a confirmar (SPEC 12.4 es «orientativo»):** (1) `maps.*.layers[] = {assetId, depth}` sustituye a `backgroundAssetId`, porque SPEC 3.1 exige elegir capas, orden y variante explícitos; (2) `ui.assets` admite además `buttonHover`, `xpStar`, `openBook` (opcionales) para usar el estado hover y los iconos existentes sin hardcodear IDs; (3) los tipos están escritos a mano y contrastados con el esquema por test, no generados. Pendiente fuera de P1-03: accesibilidad real del mapa (flood-fill de obstáculos) llega con P2-02/P2-06; la existencia de archivos y `validate:config` son P1-05 (ese script debe ignorar `assets.schema.json` y `README.md` al buscar archivos sin listar). |
| P1-04 | Verificado | Creado `public/config/bitacora.json` (seis aprendizajes `apr-a`…`apr-f`, dos zonas `zona-a`/`zona-b`, tres estaciones por zona, portales de ida y regreso, `mode: demo`). Inspección visual de las capas reales (composiciones con cuadrícula) y herramienta `scripts/tools/derive-obstacles.py` (Pillow + numpy, fuera del build) que deriva obstáculos provisionales de los píxeles (terreno sin suelo, agua, rocas, `midground`, `foreground`), abre corredores donde el camino pasa bajo arbustos o la pasarela, y comprueba alcanzabilidad. Nuevo `src/config/reachability.ts` (`checkWorldReachability`, en TS, independiente del script) y `src/tests/bitacoraJson.test.ts`. | `npm test`: 54/54 (13 nuevas). El `bitacora.json` real valida contra el esquema y el `assets.json` real; AC-01 (datos académicos exactos, docente `null`); route de 6 con 600 XP; sin `order`/`nextLearningId`/`totalStations`/`enabled`; sin rutas ni metadata de assets; una variante por capa; sprite estático (`character.vanessa-jerry.idle`) sin hojas de poses; todas las estaciones, portales y spawns alcanzables con el cuerpo real (radio 6.4 px), con pruebas negativas que detectan estación encerrada, muro y pasillo más estrecho que el cuerpo. Vista previa renderizada desde el JSON final: señales, portales y spawns sobre camino transitable. Las capas de las dos zonas no traen estaciones, números ni títulos pintados (AC-32, parcial). `typecheck` y `build` sin errores. | **Provisional (identificado en `editorNotes`):** zonas de 1448×1086 (tamaño nativo de las capas), spawns, portales, posiciones, radios (70/60), obstáculos (342 + 245 rectángulos de 8 px), escala del sprite 0.08, cuerpo 160×100 px de textura, velocidad 150, zoom 1. **Decisiones a confirmar:** (1) el primer aprendizaje es `draft` con el texto de SPEC 9 y una insignia «Semilla de descubrimiento» que reutiliza `station.item.sunflowers` (no existe una semilla propia); las otras cinco reutilizan `ui.badge.active-listening`; (2) `titleSign` usa `ui.title.blank` para que el título salga de `project.title` y no del texto pintado; (3) `Placement` no tiene escala de señal: P2-04 la fijará como constante (en la vista previa se usó 0.16); (4) los corredores abiertos hacen que Vanessa camine sobre arbustos pintados en `midground` (queda debajo del personaje): revisar en P2-07/P5. La alcanzabilidad aún no está conectada a `validate:config` (P1-05). |
| P1-05 | Verificado | Nuevos en `src/config/`: `assetRegistry.ts` (`createAssetRegistry`, `resolveAssetBase`, `AssetError`), `fetchJson.ts` (GET con `cache: 'no-cache'`, fallos por etapa), `loadAssets.ts`, `loadConfig.ts`, `loadApp.ts` (`loadApp`, `createLoader`, `documentUrls`, `describeFailure`). Script `scripts/validate-config.ts` + `scripts/lib/validateProject.ts` (`npm run validate:config`, con `tsx` 4.23.15); `npm run build` ahora ejecuta `validate:config` antes de `typecheck` y `vite build`. Pruebas: `src/tests/assetRegistry.test.ts`, `src/tests/loadApp.test.ts`, `scripts/validate-config.test.ts` (vitest incluye `scripts/**/*.test.ts`). | `npm test`: 84/84. `npm run validate:config`: OK sobre el proyecto real (45 entradas, todos los `path` existen y coinciden en hash/tamaño/dimensiones, 0 avisos, bitácora válida, alcanzabilidad OK). Con entradas rotas sale con código 1 y mensajes localizados (p. ej. `bitacora.json › placements.apr-c.decorationAssetId: asset ID no encontrado: «station.item.no-existe»`, `assets.json › assetCount: declara 44 pero assets tiene 45 entradas`). `npm run build` completo OK. Navegador real (dev, Playwright): `loadApp()` con `BASE_URL`/`document.baseURI` por defecto carga ambos JSON; las 45 URLs del registro responden 200 con `content-type` de imagen; 0 errores de consola. Resolución probada con tres despliegues (raíz, subdirectorio, manifiesto en otro origen) y `basePath` distinto de `.`; `originalPath` nunca se usa; cambiar el `path` de un ID cambia la URL sin tocar `bitacora.json`. Etapas de fallo diferenciadas: network, parse, assets, bitacora (sin mundo parcial); `createLoader` carga una vez y un fallo no se guarda. Cubre AC-20 (parcial: falta el diagnóstico de fallo de imagen en Phaser), AC-22 (parcial), AC-29, AC-33, AC-34. | Hash, tamaño y dimensiones del manifiesto son **avisos**, no errores (sustituir un archivo conservando el ID es válido, AC-12). La resolución en el build de producción bajo un subdirectorio se prueba en P6-04. `normalizeConfig.ts` (índices derivados de `route`) no se creó todavía: llega con P4-02. `loadApp` aún no está conectado a React (P1-06). |
| P1-06 | Verificado | Portada y canvas: `src/app/App.tsx` (estados cargando / error con «Reintentar» / listo), `BitacoraProvider.tsx`, `components/ui/{Cover,WindowPanel,PixelButton}.tsx`, `components/game/PhaserGame.tsx`, estilos `src/styles/{tokens,game,ui}.css`. Phaser: `createGame.ts` (Scale.RESIZE, `pixelArt`, un `Phaser.Game`), `PreloadScene` (texturas con clave = assetId, URL del registro, fallos con ID+URL) y `ExplorationScene` provisional (capas de la zona inicial, `cameraZoom` de `gameplay`, `roundPixels`, centrada en el spawn). El mapa se monta una vez al terminar la carga; la portada es una capa encima y el mapa va `inert` hasta pulsar «Comenzar». `index.html` ya no contiene datos de la estudiante: el título de la pestaña sale de `project`. Dependencias de prueba: jsdom 30.1.1, @testing-library/react 16.3.3. | `npm test`: 98/98 (14 nuevas: `Cover.test.tsx`, `App.test.tsx`). `npm run build` completo OK. Navegador real (Playwright, dev y `vite preview` de la build): 1 canvas en todos los casos; canvas = contenedor en 1280×720 (DPR 1 y 2), 390×844 y 320×568; sin scroll horizontal ni errores de consola; sin peticiones a otros orígenes; botón de 52 px de alto (≥44); portada con asignatura exacta y sin `null`/`undefined`/docente (AC-01); «Comenzar» cierra la portada, habilita el mapa y le da el foco sin recrear el canvas; en alturas de 320–568 px todo el contenido es alcanzable con scroll (incluido apaisado 568×320). Error de red en `assets.json`: mensaje con la URL, sin canvas, y «Reintentar» recupera. Una capa que falla (404): aviso `role=alert` con `background.zone-01.terrain` y su URL, y el mapa sigue con las demás capas (AC-20, parcial). La build no expone `__PHASER_GAME__`. Capturas revisadas a mano (desktop, móvil 390 y 320 px, mapa a 1:1 nítido). Cubre AC-01 y avanza AC-14, AC-15 (un canvas, sin reinicio por la portada), AC-21 y AC-34. | **Decisiones / pendientes:** (1) no hay fuente pixel entre los assets y la SPEC prohíbe peticiones externas: se usa fuente del sistema (`--font-ui`, `--font-reading`) hasta que se decida una; (2) «Semestre» y «Docente» son rótulos fijos de `Cover.tsx` porque `ui.labels` no tiene claves para ellos: si se quieren editables hay que ampliar el contrato; (3) el panel de nueve secciones se usa **sin** `fill` (el centro del arte trae líneas de brillo que al estirarse forman bandas) con crema plano `#fff7e9`; (4) la escena y el cargador de texturas son provisionales: P2-01 los reemplaza por la escena reutilizable por zona; (5) en DPR 2 el canvas se escala por CSS (nearest), no se renderiza a doble resolución: revisar en P5-03; (6) `hasProgress` es siempre `false` hasta que exista el guardado (P3-06). |
| P4B-01 | Verificado | `src/game/systems/framing.ts` (`effectiveZoom`, `cameraBounds`) y `CameraController.ts`: zoom «cover» = máx(base, cover, suelo por altura de personaje) acotado por `gameplay.camera` (`fit`, `maxZoom`, `minPlayerHeight`); límites ensanchados para centrar si la vista excede el mundo; recálculo en `Scale.Events.RESIZE`. Contrato en `bitacora.schema.json`/`types.ts`. | `src/tests/framing.test.ts` y `scripts/e2e/scale.mjs`: en 11 tamaños (320×568 a 5120×1440, incluida la captura 2177×1385) el mapa cubre todo el canvas sin anclarse a una esquina; redimensionar 1280→2560→390 recalcula el zoom sin mover a Vanessa. | Decisión: `maxZoom` 3 y `minPlayerHeight` 0.12 (valores editables en JSON). |
| P4B-02 | Verificado | `worldScale.ts` (factores respecto a referencias 0.24 y 0.16), `gameplay.player.scale` 0.34 y `gameplay.signScale` 0.26; `Station`, `ZonePortal`, `Celebration`, `Player` proporcionales; cuerpo de colisión conserva ~14×9 px de mundo. | Personaje 12.2–23 % de la altura en 11 tamaños y siempre menor que la señal; `validate:config` y `checkWorldReachability` siguen en verde (estaciones, portales y spawns alcanzables). | — |
| P4B-03 | Verificado | `src/styles/*.css` en rem con raíz fluida `clamp(1.0625rem, 0.6vw + 0.6rem, 1.75rem)`; HUD ampliado y regla ≤480 px. | `scale.mjs`: raíz 17–28 px, a 1920 px ≥ 1,2 × la de 1280 px, controles ≥ 44 px, cabecera dentro de la ventana y sin scroll horizontal; el texto de lectura crece ≥ 1,3 × entre 1280 y 2560 px. | — |
| P4B-04 | Verificado | `scripts/tools/add-landscape-kit.py` (idempotente): 10 piezas del kit y 3 atlas añadidos al final de `assets.json` (55 entradas) sin alterar las 45 originales; `AssetRegistry.atlasUrl/isAtlas`; `scripts/lib/validateAtlas.ts`. | `scripts/atlas.test.ts` (hashes iguales a los del kit, regiones de atlas dentro de la imagen, coherencia del kit) y `validate:config` («3 hoja(s) animada(s) validadas contra su imagen»). Cubre AC-40. | `decoration.tree.oak-canopy` se indexa pero no se usa (su tronco debe ser independiente, SPEC 3.2). |
| P4B-05 | Verificado | Esquema (`ambientEffect`), `types.ts`, `validateConfig.ts` (asset, `kind`, `motion`, posición/área), `reachability.ts` (`checkAmbientPlacement`) y `AmbientBuilder.ts` (hojas con atlas, vaivén, deriva con envoltura, partículas con tope de 24, movimiento reducido, `destroy()`). | `src/tests/config.test.ts` (7 pruebas de contrato, AC-44), `src/tests/bitacoraJson.test.ts` (4 de colocación, AC-45) y `scripts/e2e/ambient.mjs` en navegador real. | — |
| P4B-06 | Verificado | `public/config/bitacora.json`: en cada zona 5 hojas animadas (cascada + espuma + 3 ondas), 2 nubes, 4 margaritas y 3 arbustos con vaivén, y 2 emisores (pétalos u hojas + gotas). Posiciones calculadas con una máscara de agua y revisadas sobre composiciones y capturas reales. | `scripts/ambient-water.test.ts` (13): ondas ≥ 75 % sobre agua, cascadas y espuma a ≤ 16 px del agua; `checkAmbientPlacement` limpio (nada animado sobre suelo transitable); colisiones y alcanzabilidad intactas. Provisional, editable solo por `maps[].ambient` (AC-46, probado quitando efectos por página). | Posiciones revisables por la autora; las cascadas se superponen a las pintadas. |
| P4B-07 | Verificado | `scripts/tools/screenshots.mjs` (capturas de ambas zonas a 390×844, 1280×720, 2177×1385 y 3840×2160, revisadas a mano), `scripts/e2e/ambient.mjs` (añadido a `test:e2e`) y playtest del plugin (`phaser-playtester`) en dev y en la build de producción. | `npm test` 380/380 (24 archivos); `typecheck` sin errores; build «✓ built»; `test:e2e` 32+54+39+49+16 comprobaciones correctas. AC-41: los fotogramas cambian, las nubes derivan, hay partículas (≤ 24 por emisor). AC-42: con movimiento reducido 0 hojas reproduciéndose, 0 tweens de vaivén, 0 emisores y 0 px de diferencia entre capturas. AC-43: 59,9 fps de mediana (p10 59,9) y ocho cambios de zona dejan idénticos objetos, tweens, emisores y oyentes. AC-46: con `ambient` vacío la zona funciona. Playtest: 0 errores de consola, 0 peticiones fallidas (11 assets del kit con 200), ~60 fps con y sin paisaje en dev (SwiftShader). | El fps de un navegador sin GPU solo detecta regresiones; falta medirlo en un dispositivo real (P5-03/P6). `validate:release` sigue fallando solo por contenido editorial de demostración (esperado en modo demo). En dev, React StrictMode pide los assets dos veces; en producción una. |

Estados admitidos para el seguimiento: pendiente, en curso, bloqueado, verificado. La casilla de la tarea se marca solo en el último caso. Mantener el registro resumido; los logs extensos, capturas y reportes deben referenciarse desde su ubicación, no copiarse completos aquí.

<a id="plan-7"></a>

## 7. Entrega documental e instrucción para la IA

Mantener `.claude/SPEC.md` y `.claude/PLAN.md` juntos dentro de `.claude/` en la raíz del repositorio. La estructura de código prevista está en [SPEC.md, sección 11.3](SPEC.md#spec-11-3). Al entregar, actualizar el README operativo según [SPEC.md, sección 15.2](SPEC.md#spec-15-2), los pendientes y la evidencia de pruebas; no sustituir este plan por una copia del README.

Mensaje para iniciar el trabajo:

> Lee primero `.claude/SPEC.md` y después `.claude/PLAN.md`. Inspecciona `public/assets/assets.json`, `public/assets/`, `package.json` y el código existente. Si `phaser4-gamedev` no está instalado, lee `https://github.com/Yakoub-ai/phaser4-gamedev`, instálalo con scope de proyecto según su README y verifica que esté disponible. Usa la SPEC como fuente de verdad y el PLAN como orden de implementación. No regeneres el proyecto con `/phaser-new`, no sustituyas la SPEC con `/phaser-gdd`, no regeneres `assets.json` y no inventes IDs o rutas. Después de la inspección, comienza la primera tarea pendiente y actualiza `.claude/PLAN.md` solo con trabajo realmente verificado.
