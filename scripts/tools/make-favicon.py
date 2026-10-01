#!/usr/bin/env python3
"""Genera los iconos del sitio (public/) a partir del dibujo del libro abierto. Herramienta de integración, fuera del build.

La imagen original tiene las esquinas blancas: se hacen transparentes por relleno desde los bordes (solo el blanco
conectado con el exterior; el crema del interior queda). Escribe favicon.ico (16/32/48), favicon-32.png, icon-192.png,
icon-512.png y apple-touch-icon.png (180 px, opaco: iOS rellena de negro lo transparente).

Uso:  python3 scripts/tools/make-favicon.py RUTA_DE_LA_IMAGEN
"""
import os
import sys

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public")


def main(path):
    src = Image.open(path).convert("RGBA")
    w, h = src.size
    work = src.copy()
    # Blanco del exterior → transparente (relleno desde las cuatro esquinas, con tolerancia para el suavizado).
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(work, corner, (255, 255, 255, 0), thresh=24)
    box = work.getchannel("A").getbbox()
    icon = work.crop(box)
    side = max(icon.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(icon, ((side - icon.width) // 2, (side - icon.height) // 2))

    def at(size):
        return square.resize((size, size), Image.LANCZOS)

    at(32).save(os.path.join(OUT, "favicon-32.png"))
    at(192).save(os.path.join(OUT, "icon-192.png"))
    at(512).save(os.path.join(OUT, "icon-512.png"))
    at(48).save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    apple = Image.new("RGBA", (180, 180), (251, 236, 205, 255))  # crema del dibujo
    inner = at(160)
    apple.alpha_composite(inner, (10, 10))
    apple.convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))
    print("iconos escritos en public/")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
