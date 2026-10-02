# Panel de avatar y XP

image_gen integrado; estilo del botón badges-button.png como referencia principal. Recorte técnico del margen transparente, sin modificar la ilustración.

```text
Use case: style-transfer.
Asset type: EMPTY pixel-art HUD status panel background for Bitácora Amorcito.
Input image 1 badges-button.png: PRIMARY STYLE REFERENCE. Match its very visible stair-step corner cuts, thick dark chocolate brown outline, ivory cream face, simple pale ivory highlight and tan inner rectangular border. This must belong to the SAME UI asset set.
Input image 2 screenshot: layout reference ONLY. Recreate the large horizontal panel enclosing the avatar, learning-progress, XP information and badges button at the upper left, as an empty background asset.
Primary request: ONE very wide low empty cream HUD panel, in clearly coarse RETRO PIXEL ART with crisp rectangular blocks and square staircase corners. Keep the entire interior open so actual components can be placed on it. It must look like the supplied button frame stretched into a horizontal status window, while keeping all corners and border blocks clean.
Composition: transparent landscape canvas around 1536 by 512. Center one horizontal cream panel approximately 1440 by 240, SIX TO ONE width-to-height, fully visible with small transparent gutters. Do not make a tall window.
PIXEL CONSTRUCTION: imagine a 240-by-40 logical-pixel panel scaled uniformly by 6 using nearest-neighbor. Use a clearly visible square pixel grid. All edges are horizontal/vertical runs, including corners made of about 4 to 5 clear block steps. Dark chocolate brown outer outline about 2 logical pixels thick; flat cream rim with a one-pixel pale highlight along top/left; one-pixel tan inner border along all sides. Corners look cut into square steps like the example button. Flat color blocks and a VERY limited cream/tan/brown palette. The main cream interior should be mostly one flat color, perhaps 3 or 4 large subtle flat cream pixel patches. Avoid tiny noisy mottling.
Constraints: ACTUAL transparent alpha everywhere outside this single panel. No medal, avatar, dog, XP bar, progress fill, icons, text, numbers, dividers, placeholders or nested content boxes. NO smooth curves, no antialiasing, no blurred glow, no airbrushed gradients, no realistic parchment texture, no glossy 3D bevel, no soft drop shadow, no scattered colored pixels along the outline, no checkerboard, no grid lines or watermark. Prioritize visible, consistent chunky pixel-art edges matching the button.
```
