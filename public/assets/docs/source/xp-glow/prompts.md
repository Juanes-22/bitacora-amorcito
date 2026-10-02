# Prompts de generación

Herramienta integrada image_gen; ocho fases por efecto. Los PNG se extraen y colocan en celdas uniformes sin repintar ni remuestrear los píxeles; la opacidad de reproducción se declara en assets.json.

## Estrella XP

```text
Use case: stylized-concept.
Asset type: transparent pixel-art game VFX sprite sheet, XP reward completion effect for Bitácora Amorcito.
Input image 1 xp-star.png: exact reference for the golden FIVE-pointed star silhouette, stepped brown-orange outline, pale yellow upper-left highlight and amber facets.
Input image 2 map screenshot: style and context only. Do not include the scene, sign, text, person or dog.
Primary request: create ONE clean production sprite sheet with exactly EIGHT chronological animation frames for this same XP star materializing, sparkling once and fading away when a learning station is completed.
Canvas: landscape 1536 by 1024. EXACT regular 4-column by 2-row grid, eight equal 384-by-512 invisible cells. Read left to right across the top row then left to right across the bottom. No visible grid, labels, lettering, checkerboard, background, watermark or UI. Actual transparent alpha everywhere around each isolated effect.
Alignment: every cell has one star, centered horizontally at its own cell x=192. Keep the star's baseline center around local y=300, only a small deliberate upward drift over the sequence. Full effect including all sparkles remains inside local x=48..336 and y=128..410. Empty transparent gutters must fully separate all cells. No crossover, no clipping.
Eight phases: 1 small dim amber star appearing, no sparkles; 2 medium star growing with one tiny glint; 3 full-size star, reference-like warm gold, 2 tiny pixel sparkles; 4 brief oversized bright star with a pale gold core, 4 small pixel glints, the visual peak; 5 star settles to normal size, light gold glint crosses the upper-left face, sparkles drift outward; 6 normal star rising slightly, fewer fading glints; 7 smaller pale star fading; 8 tiny very faint star and 1 faint glint, almost fully transparent. End cleanly rather than leaving a static star.
Constraints: preserve the reference's chunky pixel-art aesthetic, warm amber gold palette, crisp stepped edges and FIVE points in every star. The star should look like the supplied existing game asset, not a smiling character, not a 3D render. All frames face front. Largest star silhouette no wider than 220 pixels in a 384-pixel cell. No circles or floor halos in this XP sheet. Modest transparent glow is okay, no giant blurry cloud. No text 'XP' or numbers. This is a sprite sheet, not a storyboard or contact sheet of scenes.
```

## Player glow

```text
Use case: stylized-concept.
Asset type: transparent pixel-art game VFX sprite sheet, seamless looping next-station ground marker for Bitácora Amorcito.
Input image 1 player-glow.png: the visual source to animate. Preserve its warm amber-orange low horizontal oval ring, pale-yellow angular inner ring, modest soft transparent aura and a few floating square or diamond gold lights.
Input image 2 map screenshot: context and pixel-game style only. Do not reproduce its scenery, sign, text, character or dog.
Primary request: ONE production sprite sheet of exactly EIGHT chronological phases of the same ground halo gently breathing and releasing small rising gold pixel particles. It marks the next learning station to explore, displayed beneath its location. No characters or items in this sheet.
Canvas: landscape 1536 by 1024, EXACT 4 columns by 2 rows, eight equal invisible 384-by-512 cells. Read left to right across the top row then left to right across the bottom. Actual transparent alpha outside each effect. NO painted background of any color, NO checkerboard, grid, borders, labels, words, numbers, watermarks.
CRITICAL alignment: the oval floor ring center is IDENTICAL at local x=192, y=352 in EVERY cell, including both rows. It remains in the same horizontal isometric orientation throughout. Its width varies subtly 230,238,248,260,270,260,248,238 pixels across the eight frames; its height stays about 54 pixels. Nothing rotates or shifts sideways. Halo including particles stays strictly within local x=32..352, y=160..420. Keep transparent empty gutters at all cell edges to avoid frames bleeding into each other.
Animation phases: 1 quiet medium glow, a few low sparks; 2 gently brighter with sparks a little higher; 3 stronger ring and rising sparks; 4 near peak warm glow with sparse staggered spark heights; 5 strongest glow without a white flash, one old spark dissolves and a new tiny spark appears near the ring; 6 glow easing with sparks rising; 7 glow nearly back to quiet, old sparks fading; 8 quiet intermediate phase approaching phase1 with a new low spark and no abrupt visual change. Seamless 8->1 loop, same floor-contact baseline throughout. Particles should not all move together; 3 to 5 small unevenly spaced pixel particles per frame.
Style: match the supplied chunky pixel effect, stepped orange oval edges and flat pale-yellow pixels. Maintain the orange/gold palette. Restrained soft transparent halo behind the crisp ring. Keep the oval middle mostly translucent so the path can show through. No star shapes, no vertical beam, no opaque ground shadow, no magical portal scene, no medallion, no floating symbols, no blue or purple.
```
