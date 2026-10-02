# Generation prompts — assets de Bitácora Amorcito

Generados con la herramienta integrada imagegen, usando fondo transparente.

## Reglas obligatorias para cualquier regeneración

- **Sin texto incrustado:** los botones de Bitácora, Jerry y Sonido, y el indicador de Completado NO deben contener palabras, letras, números ni texto de ejemplo. Conservar únicamente sus íconos. Dejar la zona de la etiqueta vacía, con fondo crema.
- Los letreros tampoco incluyen título, número de estación ni nombre de destino. El círculo del número queda vacío. El letrero de navegación conserva únicamente la flecha.
- Los textos se dibujan encima con React o Phaser. `assets.json` contiene `labelZones` en píxeles de la textura final y `defaultLabels` solo como ejemplos de configuración.
- Ambos letreros tienen pasto corto, discreto y pegado al pie del poste. No usar matas grandes, flores ni montículos.
- El extremo izquierdo del letrero de cambio de mapa es un corte angular de madera; evitar dos lóbulos redondeados o semicirculares.
- El glow es una elipse dorada de suelo, con ocho fotogramas de pulso. **Sin partículas, estrellas, destellos sueltos ni símbolos**: se agregan por separado en el juego.
- Mantener el pixel art y la paleta crema, madera, verde y dorado de la referencia. Fondo realmente transparente, sin tablero de ajedrez dibujado.

## Referencias y exportación

La referencia exacta del juego está en `sources/reference/game-screen-reference.png`.
Los últimos ajustes de pasto usaron esa referencia y la primera versión del letrero, incluida en `sources/initial/`.
La corrección final del extremo izquierdo del letrero de cambio de mapa usó la imagen seleccionada por el usuario, incluida como `sources/reference/map-exit-before-wood-edge.png`.
Los originales finales están en `sources/`. Los PNG de uso directo están recortados y escalados con nearest-neighbor; sus medidas reales están en `assets.json`.
El prompt del glow pidió una cuadrícula 4×2; la imagen generada midió 1774×887. Los ocho fotogramas se extrajeron, centraron y exportaron con la misma escala a 256×128. El spritesheet final mide 1024×256. Usar esas medidas finales en el juego.

## Prompts enviados para las versiones finales

### Letrero de estación — pasto corto

Referencias: `sources/reference/game-screen-reference.png` y `sources/initial/station-sign-initial.png`.

```text
Use case: precise-object-edit.
Asset type: final transparent station-sign sprite for the existing pixel-art game.
Input image 1: EXACT selected game screenshot, authoritative palette and style reference.
Input image 2: previously generated blank station-sign asset to refine.
Preserve image 2's blank cream title board, blank wooden number medallion, border, post, wood palette, pixel grid, relative proportions and front-facing composition. Change ONLY the grass at the base: replace the large tall bush with just a few tiny short understated grass blades hugging the very bottom of the post. Reduce grass height by at least 75% and its width by at least 55%. At most 3-5 short blades on each side, no taller than 15% of the visible wooden post height. Keep almost the whole post visible. Use restrained green matching the map, avoid neon yellow-green, no flowers, bushes, vines, ground oval or glow. Grass must be a very subtle base detail, not a decorative cluster.
CRITICAL: NO TEXT, NO LETTERS, NO NUMBERS, NO PLACEHOLDERS anywhere. Both the title panel and number medallion remain fully blank for code overlays. No completed badge and no star.
Crisp clean pixel art with stepped edges, true transparent alpha outside the sign and tiny blades. No backdrop, landscape, shadows or bloom spilling outside the prop. One complete sign, centered, fully visible, production asset.
```

### Completado — cápsula sin texto

Referencias: `sources/reference/game-screen-reference.png`.

```text
Use case: precise-object-edit.
Asset type: ONE production transparent PNG blank-label completed-status badge for the EXACT input pixel-art game screenshot.
Input image 1 is the exact selected edit source. Faithfully reconstruct ONLY the completed badge attached to station 1 at lower left: short horizontal ivory cream capsule, clean stepped rounded ends, thin layered dark brown and warm tan outline; a green round pixel medallion with a clear white checkmark overlaps the LEFT end. Preserve the reference proportions, green palette, cozy pixel-art borders and restrained depth.
CRITICAL TEXT POLICY: absolutely NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO PLACEHOLDER GLYPHS. DO NOT write "Completado". The entire cream area to the RIGHT of the green check medallion must be blank, uninterrupted cream and wide enough for an externally rendered label "Completado". The code will overlay that label later.
ONE badge, centered, width about 4 times its height, fully visible with narrow transparent margin. Crisp square pixels and stepped silhouette. No sign board, wood post, numeral, star, grass, scene or other UI. No glow or shadow outside the shape, no gradient backdrop, no checkerboard painted in. Truly transparent alpha outside the badge. The green medallion and WHITE CHECK are essential; only the label is omitted.
```

### Glow de estaciones — animación sin partículas

Referencias: `sources/reference/game-screen-reference.png`.

```text
Use case: precise-object-edit. Asset type: a production animation spritesheet for the station ground glow from the EXACT input pixel-art game screenshot. Reconstruct only the golden flat elliptical ground halo beneath station 2. The user adds particles separately: ABSOLUTELY NO particles, stars, sparkles, plus symbols, floating specks, text, numbers, labels, grid lines, scene or sign. True transparent alpha everywhere except the glows.

Create EXACTLY EIGHT animation frames on a perfectly regular 4-column by 2-row grid. Canvas landscape 1536 x 768; each frame occupies exactly 384 x 384 pixels. No gutters or border. Every halo's center is at the exact center of its cell: row1 centers (192,192), (576,192), (960,192), (1344,192); row2 centers (192,576), (576,576), (960,576), (1344,576). Each halo must stay entirely inside its own cell. Only one small elliptical glow per cell. The halo shape is wide and shallow, about 240px wide by 75px tall, a pair of thin nested stepped pixel ellipses in warm pale gold/cream with translucent golden fill and a small soft alpha falloff. The shape stays centered and flat on the ground, exactly like the station marker in the input, subtle rather than blazing orange fire.

Animation order reading left-to-right top row then left-to-right bottom row is ONE smooth breathing loop: frame0 smallest and dimmest, frame1 slightly brighter and wider, frame2 medium, frame3 brightest and widest, frame4 same peak beginning to diminish, frame5 medium like frame2, frame6 smaller like frame1, frame7 dim like frame0. Modulate overall width gently, at most 12%, and brightness. Keep vertical perspective, ring count, colors, pixel scale and center consistent in every frame; do not morph into circles, flames, funnels, or spirals. Pixel art stepped ring edges, tidy square pixels. No separate bright dots outside the ring. No black matte or rectangular background, no checkerboard baked in. This is a spritesheet for direct frame extraction, not an explanatory image. EXACTLY 8 clean isolated ellipses, 4 columns 2 rows, strict identical cells.
```

### Bitácora — botón sin texto

Referencias: `sources/reference/game-screen-reference.png`.

```text
Use case: precise-object-edit.
Asset type: ONE production transparent PNG blank-label Bitácora UI button for the EXACT input game screenshot.
Input image 1 is the exact selected edit source. Faithfully reconstruct only the top-right cream book button.
Match the original UI: square ivory cream face, stepped pixel-art corners, thin double dark brown and warm tan border, restrained bevel. Center a small closed brown book icon with cream page edge and three small horizontal cover lines in the UPPER 50% of the face.
CRITICAL TEXT POLICY: render absolutely NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO PLACEHOLDER GLYPHS anywhere. In particular DO NOT write "Bitácora". The LOWER 30% of the inner cream face must be completely empty and uninterrupted cream, providing a generous reserved label area. The game's code will overlay the label later. Keep the icon high enough that an external text label fits below it.
Front-facing square button, one button ONLY, centered, fully visible, small transparent margins. Crisp pixel art with a consistent square grid, clean stepped edges, limited warm cream and brown palette. Genuinely transparent alpha outside the hard button outline. No shadows outside the outline, no glow, no landscape, no post, no surrounding UI, no annotations, no checkerboard baked in. Preserve the input's cozy cream wood-bordered RPG visual identity.
```

### Jerry — botón sin texto

Referencias: `sources/reference/game-screen-reference.png`.

```text
Use case: precise-object-edit.
Asset type: ONE production transparent PNG blank-label Jerry UI button for the EXACT input game screenshot.
Input image 1 is the exact selected edit source. Faithfully reconstruct only the top-right cream paw button.
Match the original UI: square ivory cream face, stepped pixel-art corners, thin double dark brown and warm tan border, restrained bevel. Center a small dog's brown paw-print icon (one main pad and four toe pads) in the UPPER 50% of the face. Use the same size and wood brown colors as the adjacent book button in the screenshot.
CRITICAL TEXT POLICY: render absolutely NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO PLACEHOLDER GLYPHS anywhere. In particular DO NOT write "Jerry". The LOWER 30% of the inner cream face must be completely empty and uninterrupted cream, providing a generous reserved label area. The game's code will overlay the label later. Keep the icon high enough that an external text label fits below it.
Front-facing square button, one button ONLY, centered, fully visible, small transparent margins. Crisp pixel art with a consistent square grid, clean stepped edges, limited warm cream and brown palette. Genuinely transparent alpha outside the hard button outline. No shadows outside the outline, no glow, no landscape, no post, no surrounding UI, no annotations, no checkerboard baked in. Preserve the input's cozy cream wood-bordered RPG visual identity.
```

### Sonido activado — botón sin texto

Referencias: `sources/reference/game-screen-reference.png`.

```text
Use case: precise-object-edit.
Asset type: ONE production transparent PNG blank-label Sonido UI button, sound ON state, for the EXACT input game screenshot.
Input image 1 is the exact selected edit source. Faithfully reconstruct only the top-right cream speaker button.
Match the original UI: square ivory cream face, stepped pixel-art corners, thin double dark brown and warm tan border, restrained bevel. Center a small dark brown and muted gray speaker icon facing right with two stepped curved brown sound-wave strokes in the UPPER 50% of the face. SOUND ON: waves visible, no slash or cross.
CRITICAL TEXT POLICY: render absolutely NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO PLACEHOLDER GLYPHS anywhere. In particular DO NOT write "Sonido". The LOWER 30% of the inner cream face must be completely empty and uninterrupted cream, providing a generous reserved label area. The game's code will overlay the label later. Keep the icon high enough that an external text label fits below it.
Front-facing square button, one button ONLY, centered, fully visible, small transparent margins. Crisp pixel art with a consistent square grid, clean stepped edges, limited warm cream and brown palette. Genuinely transparent alpha outside the hard button outline. No shadows outside the outline, no glow, no landscape, no post, no surrounding UI, no annotations, no checkerboard baked in. Preserve the input's cozy cream wood-bordered RPG visual identity.
```

### Sonido silenciado — botón sin texto

Referencias: `sources/reference/game-screen-reference.png`.

```text
Use case: precise-object-edit.
Asset type: ONE production transparent PNG blank-label Sonido UI button, sound OFF state, for the EXACT input game screenshot.
Input image 1 is the exact selected edit source. Reconstruct only the top-right cream speaker button, with the muted variation.
Match the original UI and the sound ON variant: square ivory cream face, stepped pixel-art corners, thin double dark brown and warm tan border, restrained bevel. Center a small dark brown and muted gray speaker facing right in the UPPER 50% of the face. SOUND OFF: a single dark brown diagonal mute slash crosses the speaker, no sound waves. Keep the icon compact and inside the button.
CRITICAL TEXT POLICY: render absolutely NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO PLACEHOLDER GLYPHS anywhere. In particular DO NOT write "Sonido". The LOWER 30% of the inner cream face must be completely empty and uninterrupted cream, providing a generous reserved label area. The game's code will overlay the label later. Keep the icon high enough that an external text label fits below it.
Front-facing square button, one button ONLY, centered, fully visible, small transparent margins. Crisp pixel art with a consistent square grid, clean stepped edges, limited warm cream and brown palette. Genuinely transparent alpha outside the hard button outline. No shadows outside the outline, no glow, no landscape, no post, no surrounding UI, no annotations, no checkerboard baked in. Preserve the input's cozy cream wood-bordered RPG visual identity.
```

### Cambio de mapa — pasto corto y sin texto

Referencias: `sources/reference/map-exit-before-wood-edge.png`.

```text
Use case: precise-object-edit.
Asset type: final transparent pixel-art map-exit direction sign.
Input image 1 is the EXACT image the user selected for this edit. Use this image as the edit source, not another screenshot or another sign.
Change ONLY the LEFT END of the wooden board, approximately the leftmost 10% of the plank. The existing left end has two rounded lobes and a central inward notch, creating an unfortunate double-semicircle shape. REMOVE BOTH ROUND LOBES and the large central notch. Replace them with a single simple almost-vertical squared-off sawn wooden edge, with small angular stepped pixel chips and subtle wood end-grain marks. It should unmistakably look like the rough cut end of a flat wooden plank: straight overall, subtly irregular, angular, no paired bulges, no semicircles, no scallops, no hourglass indentation. Keep the cream center flat and the warm layered dark brown wooden frame. Add only a few small horizontal wood grain strokes close to the new cut edge.
Keep EVERYTHING ELSE unchanged: board length and height, RIGHT-pointing silhouette and dark arrow icon, blank destination-label area, pixel grid, colors, short wooden support post, very short subtle grass at its base, transparent background and composition.
CRITICAL TEXT POLICY: NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS or placeholder glyphs. The destination label will be overlaid by the game's code; the panel remains blank. Preserve truly transparent alpha outside the sign. Crisp pixel art, no smooth rounded decoration, no background, glow, extra props or watermark. One complete production sprite.
```

