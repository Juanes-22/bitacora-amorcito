#!/usr/bin/env python3
"""Mide las poses de la hoja de caminar real y propone recortes explícitos con pivote en los pies.

Herramienta puntual (Pillow + numpy), fuera del build. Su salida se copió a
src/assets/frameDefinitions.ts; ese archivo es el que manda y está validado por pruebas contra la
imagen real. La hoja NO es una cuadrícula regular (SPEC 3.1): hay poses cuyo contenido cruza los
límites nominales de 362 px, así que cada frame se define por la caja real de su pose.

Uso:  python3 scripts/tools/derive-frames.py [--viz ruta.png] [--ts]
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageDraw

POSES = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets", "characters", "vanessa-jerry", "pose-sheets")
SHEET = os.path.join(POSES, "vanessa-jerry-walk-poses-v4.png")
CELEBRATE = os.path.join(POSES, "vanessa-jerry-celebrate-jump-poses.png")
ALPHA = 16          # un píxel cuenta como contenido si alpha > ALPHA
MARGIN = 4          # holgura transparente alrededor de la caja de cada pose
FEET_BAND = 28      # franja inferior (px) de la que sale la posición de los pies
DIRECTIONS = ["down", "left", "right", "up"]  # rowDirections del manifiesto
# Cortes entre filas y columnas elegidos en los huecos transparentes que se midieron entre poses.
ROW_CUTS = [0, 360, 715, 1069, 1448]
COL_CUTS = [0, 397, 757, 1086]


def runs(flags):
    """Tramos consecutivos de True: separan las poses por los huecos transparentes reales."""
    out, start = [], None
    for i, on in enumerate(flags):
        if on and start is None:
            start = i
        if not on and start is not None:
            out.append((start, i - 1))
            start = None
    if start is not None:
        out.append((start, len(flags) - 1))
    return out


def merge_close(spans, gap=24):
    """Une tramos separados por menos de `gap` px: una chispa o un destello pertenece a su pose."""
    merged = []
    for a, b in spans:
        if merged and a - merged[-1][1] <= gap:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    return merged


def celebrate_frames():
    """Hoja de celebración (3×2): las poses se separan por proyección, sin asumir una cuadrícula."""
    im = Image.open(CELEBRATE).convert("RGBA")
    a = np.array(im)[:, :, 3]
    h, w = a.shape
    mask = a > ALPHA
    frames = []
    for r, (ry0, ry1) in enumerate(merge_close(runs(mask.any(axis=1)))):
        for c, (rx0, rx1) in enumerate(merge_close(runs(mask[ry0 : ry1 + 1].any(axis=0)))):
            cell = mask[ry0 : ry1 + 1, rx0 : rx1 + 1]
            ys, xs = np.nonzero(cell)
            bx0, bx1, by0, by1 = xs.min() + rx0, xs.max() + rx0, ys.min() + ry0, ys.max() + ry0
            left_limit = bx0 + int(0.6 * (bx1 - bx0 + 1))
            foot = mask[by1 - FEET_BAND + 1 : by1 + 1, bx0 : left_limit + 1]
            fx = int(np.nonzero(foot.any(axis=0))[0].mean()) + bx0
            x0, y0 = max(0, bx0 - MARGIN), max(0, by0 - MARGIN)
            x1, y1 = min(w, bx1 + 1 + MARGIN), min(h, by1 + 1 + MARGIN)
            frames.append(dict(name=f"celebrate-{r * 3 + c}", x=x0, y=y0, width=x1 - x0, height=y1 - y0, feetX=fx - x0, feetY=by1 + 1 - y0))
    return im, frames


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--viz")
    ap.add_argument("--ts", action="store_true")
    ap.add_argument("--sheet", choices=["walk", "celebrate"], default="walk")
    args = ap.parse_args()

    if args.sheet == "celebrate":
        im, frames = celebrate_frames()
        for f in frames:
            print(f)
        if args.viz:
            bg = Image.new("RGBA", im.size, (60, 60, 90, 255))
            bg.alpha_composite(im)
            d = ImageDraw.Draw(bg, "RGBA")
            for f in frames:
                d.rectangle([f["x"], f["y"], f["x"] + f["width"] - 1, f["y"] + f["height"] - 1], outline=(255, 255, 0, 255))
                px, py = f["x"] + f["feetX"], f["y"] + f["feetY"]
                d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(255, 0, 0, 255))
                d.text((f["x"] + 4, f["y"] + 4), f["name"], fill=(255, 255, 255, 255))
            bg.convert("RGB").save(args.viz)
        if args.ts:
            for f in frames:
                print(f'  {{ name: "{f["name"]}", x: {f["x"]}, y: {f["y"]}, width: {f["width"]}, height: {f["height"]}, feetX: {f["feetX"]}, feetY: {f["feetY"]} }},')
        return

    im = Image.open(SHEET).convert("RGBA")
    a = np.array(im)[:, :, 3]
    h, w = a.shape
    frames = []
    for r, direction in enumerate(DIRECTIONS):
        for c in range(3):
            y0, y1, x0, x1 = ROW_CUTS[r], ROW_CUTS[r + 1], COL_CUTS[c], COL_CUTS[c + 1]
            band = a[y0:y1, x0:x1] > ALPHA
            ys, xs = np.nonzero(band)
            bx0, bx1, by0, by1 = xs.min() + x0, xs.max() + x0, ys.min() + y0, ys.max() + y0
            # Vanessa ocupa la parte izquierda de la pose (Jerry va a la derecha): los pies salen de ahí.
            left_limit = bx0 + int(0.6 * (bx1 - bx0 + 1))
            foot = a[by1 - FEET_BAND + 1 : by1 + 1, bx0 : left_limit + 1] > ALPHA
            fx = int(np.nonzero(foot.any(axis=0))[0].mean()) + bx0
            rx0, ry0 = max(0, bx0 - MARGIN), max(0, by0 - MARGIN)
            rx1, ry1 = min(w, bx1 + 1 + MARGIN), min(h, by1 + 1 + MARGIN)
            frames.append(dict(name=f"{direction}-{c}", x=rx0, y=ry0, width=rx1 - rx0, height=ry1 - ry0,
                               feetX=fx - rx0, feetY=by1 + 1 - ry0))
    for f in frames:
        print(f)
    if args.viz:
        d = ImageDraw.Draw(im, "RGBA")
        bg = Image.new("RGBA", im.size, (60, 60, 90, 255))
        bg.alpha_composite(im)
        d = ImageDraw.Draw(bg, "RGBA")
        for f in frames:
            d.rectangle([f["x"], f["y"], f["x"] + f["width"] - 1, f["y"] + f["height"] - 1], outline=(255, 255, 0, 255))
            px, py = f["x"] + f["feetX"], f["y"] + f["feetY"]
            d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(255, 0, 0, 255))
            d.text((f["x"] + 4, f["y"] + 4), f["name"], fill=(255, 255, 255, 255))
        bg.convert("RGB").save(args.viz)
    if args.ts:
        for f in frames:
            print(f'  {{ name: "{f["name"]}", x: {f["x"]}, y: {f["y"]}, width: {f["width"]}, height: {f["height"]}, feetX: {f["feetX"]}, feetY: {f["feetY"]} }},')


if __name__ == "__main__":
    main()
