# Panel de avatar, XP e insignias

Fondo crema con borde marrón oscuro, línea interior beige y esquinas escalonadas en pixel art, basado en el marco del botón de insignias adjunto. El exterior es transparente. El interior queda libre para tus componentes de avatar, progreso, textos y botón de insignias.

## Archivos

- `assets/ui/panels/player-status-panel.png`: PNG RGBA de **2124 × 390 px**, con el margen transparente sobrante recortado.
- `assets/assets.json`: entrada adicional `ui.panel.player-status.default`, con dimensiones, transparencia, hash y márgenes para escalar por nueve zonas.
- `examples/player-status-panel.css`: fondo escalable y distribución opcional de los componentes.
- `preview.html`: vista sin conexión en distintos tamaños y fondos. Activa las guías para revisar dónde colocar el avatar, el progreso y las insignias.
- `PROMPTS.md`: prompt de generación y tratamiento del archivo.

## Uso

1. Copia `assets/ui/panels/player-status-panel.png` a `public/assets/ui/panels/`.
2. Agrega la entrada de este `assets/assets.json` a tu índice actual. Las rutas se resuelven desde el directorio que contiene el índice.
3. Importa el CSS y usa la clase `player-status-panel` para el contenedor. Si mueves el CSS a otra carpeta, establece la ruta al PNG:

```css
.player-status-panel {
  --player-status-panel-image: url('/assets/ui/panels/player-status-panel.png');
}
```

```html
<section class="player-status-panel" aria-label="Progreso de aprendizaje">
  <div class="player-status-panel__layout">
    <!-- Tu avatar actual -->
    <!-- Tu información y barra de XP -->
    <!-- Tu botón de insignias actual -->
  </div>
</section>
```

La referencia de escritorio es **1160 × 196 px**. El alto puede crecer si el texto ocupa más líneas. El CSS conserva las esquinas mediante `border-image`, con cortes de **112 px** en la imagen original y un borde de **32 px** en pantalla; usa 24 px en móvil. Estos cortes incluyen el pequeño margen transparente del PNG.

Para unir los índices automáticamente, ejecuta desde este paquete:

```bash
node examples/merge-assets.mjs /ruta/proyecto/public/assets/assets.json assets/assets.json /ruta/proyecto/public/assets/assets-merged.json
```

El helper crea un índice nuevo junto al original y conserva las entradas existentes. El recorte del PNG conserva exactamente los colores y el alpha de la ilustración generada dentro del área exportada.
