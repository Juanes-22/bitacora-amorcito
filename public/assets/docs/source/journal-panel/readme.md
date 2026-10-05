# Bitácora de aprendizajes

Paquete de assets para reproducir el índice y la lectura, en sus estados **En curso** y **Completado**, siguiendo las tres imágenes de referencia.

**64 PNG:** 11 nuevos, 47 elementos de UI reutilizados y 6 insignias de aprendizajes. Los archivos reutilizados conservan exactamente los bytes y las rutas de **bitacora-panel-insignias.zip**.

## Empieza aquí

1. Abre **preview/asset-catalog.png** para ubicar todas las piezas.
2. Abre **examples/index.html** en tu navegador para recorrer el índice, las pestañas, la lectura pendiente y la completada. Funciona sin instalar dependencias ni levantar un servidor.
3. Copia **public/assets/** a **public/assets/** de tu juego.
4. Consulta **docs/INTEGRACION.md** para usar los marcos, las etiquetas y el ejemplo de React.

## Contenido

| Carpeta o archivo | Uso |
|---|---|
| public/assets/ui/journal-panel/ | Seis ilustraciones, libro con brote, cerezo, flores, icono de reflexión y cinta vacía «Siguiente». |
| public/assets/ui/badge-panel/ | Marcos, botones y sus hover, labels, candado, calendario, ramitas, separadores y progreso compartidos. |
| public/assets/ui/badges/ | Las seis insignias originales de los aprendizajes. |
| styles/ | Aspecto, distribución, estados y escalado de bordes. |
| examples/ | Demo local, componente React de referencia y datos editables. |
| assets.json | Rutas, tamaños, identificadores, roles y cortes de los marcos. |
| reuse-map.json | Lista y huellas SHA-256 de los archivos reutilizados. |
| preview/ | Tres montajes hechos con los PNG reales y un catálogo. |
| references/ | Las tres imágenes que proporcionaste. |
| source/, generation-prompts.json | Originales de la nueva generación y prompts. |
| docs/PROMPT-INTEGRACION.md | Instrucción preparada para integrar el panel en el proyecto. |

Los textos se dibujan desde HTML/React; las piezas no tienen títulos ni palabras horneadas. Las X y flechas de los botones compartidos sí están dibujadas en sus PNG.

La bitácora obtiene la insignia al marcar las tres secciones como leídas. Abrir una tarjeta o cambiar de pestaña mantiene el progreso. La insignia pendiente utiliza el mismo PNG con un filtro de gris.

El resumen del primer aprendizaje reproduce el texto de la referencia. El resto del contenido de lectura y algunos nombres de insignias son muestras editables, no datos del juego.

Los montajes de **preview/** son composiciones de los assets, no capturas de un navegador. Las verificaciones están en **qa-report.json**. El ejemplo React requiere la compilación normal de tu proyecto.
