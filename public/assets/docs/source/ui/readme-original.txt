ASSETS DE UI · MI BITÁCORA

PNG con transparencia, en estilo pixel art. Usa image-rendering: pixelated para evitar que el navegador suavice los píxeles.

VENTANAS
- ventana-crema-grande.png y ventana-crema-pequena.png: fondos listos para una composición con dimensiones fijas.
- ventana-crema-9slice.png: alternativa para paneles de tamaño flexible. CSS: border: 32px solid transparent; border-image: url(assets/ventana-crema-9slice.png) 32 fill / 32px / 0 stretch;
  Pon el contenido por encima del fondo y deja espacio interno mediante un elemento hijo con padding.

BOTONES Y XP
- boton-verde.png y boton-verde-hover.png: botones sin texto; coloca un label HTML encima.
- xp-marco.png: pista vacía de 880 × 80 px.
- xp-relleno.png: relleno de 848 × 40 px. Se ubica a 16 px desde la izquierda y 20 px desde arriba del marco.
  Para el progreso, recorta su ancho visible según XP actual / XP máximo; no escales el sprite horizontalmente.
- xp-barra-ejemplo.png: vista estática al 64 %.

ILUSTRACIONES
- ramas-hojas.png: esquina vegetal; puedes reflejarla con transform: scaleX(-1).
- estrella-xp.png: estrella dorada.
- insignia-escucha-activa.png: medalla de escucha activa.
- libro-abierto.png: icono de clase.
- letrero-estacion.png: cartel reutilizable, sin número ni nombre para superponer texto HTML.
- resplandor-jugador.png: efecto con transparencia para colocar detrás y debajo del personaje.
- letrero-titulo-vacio.png: cartel superior sin texto.
- letrero-titulo-mi-bitacora.png: versión lista con el título en español.

PALETA SUGERIDA
Crema #FFF7E9 · tinta #593023 · verde #45846C · melocotón #D6A07E · dorado #F7B728.
