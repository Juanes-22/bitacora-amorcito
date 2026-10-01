#!/usr/bin/env python3
"""Deriva obstáculos PROVISIONALES de las capas reales de public/assets y verifica alcanzabilidad.

No forma parte de la aplicación ni del build: es una herramienta puntual de edición que ayudó a
escribir `maps.*.obstacles` de public/config/bitacora.json. Requiere Pillow y numpy.

Criterio (revisable): se bloquea lo que no es suelo en la capa `terrain` (alpha), el agua y las rocas
(por color) y lo que dibujan `midground` y `foreground`. Después se abren corredores explícitos donde el
camino pasa bajo arbustos o barandas (`CARVES`), se conserva solo la región alcanzable desde el spawn
y se agrupa en rectángulos de celdas de CELL px.

Uso:  python3 scripts/tools/derive-obstacles.py [--out ruta.json] [--viz carpeta]
"""
import argparse
import json
import os
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
BG = os.path.join(ROOT, "public", "assets", "backgrounds")
CELL = 8          # px del mundo por celda
BODY_CELLS = 1    # radio del cuerpo de Vanessa en celdas (cuerpo de 13 px de ancho → radio 6.4 px ≤ 8 px)

ZONES = {
    "zona-a": {
        "terrain": "zone-01/terrain-meadow-river-bridges.png",
        "midground": "zone-01/midground-cherry-tree-v01.png",
        "foreground": "zone-01/foreground-oak-foliage-v03.png",
        "horizon": "zone-01/horizon-mountains-village.png",
        "spawn": (200, 1030),
        # El camino pasa bajo los arbustos del midground entre el lazo superior y la rama este.
        "carves": [{"points": [(500, 345), (560, 322), (620, 308), (700, 322), (800, 352), (870, 392)], "width": 60}],
        "points": {  # destinos aproximados; se ajustan al punto alcanzable con más holgura cercano
            "apr-a": (330, 985), "apr-b": (410, 640), "apr-c": (470, 345),
            "portal-a-b": (1405, 432), "desde-b": (1330, 455),
        },
    },
    "zona-b": {
        "terrain": "zone-02/terrain-meadow-river.png",
        "midground": "zone-02/midground-pavilion-v01.png",
        "foreground": "zone-02/foreground-oak-foliage.png",
        "horizon": "zone-02/horizon-mountains-village-v01.png",
        "spawn": (130, 470),
        # La pasarela de madera: las barandas del midground cierran el tablero que sí se cruza.
        "carves": [{"points": [(380, 640), (430, 662), (470, 690), (520, 725), (565, 765)], "width": 60}],
        "points": {
            "apr-d": (300, 600), "apr-e": (860, 580), "apr-f": (1180, 725),
            "portal-b-a": (45, 432), "desde-a": (130, 470),
        },
    },
}


def load(rel):
    return np.array(Image.open(os.path.join(BG, rel)).convert("RGBA")).astype(int)


def blocked_pixels(z):
    t, m, f = load(z["terrain"]), load(z["midground"]), load(z["foreground"])
    r, g, b, a = (t[:, :, i] for i in range(4))
    ground = a > 128
    water = ground & (b > r + 50) & (b > g - 10)
    mx, mn = t[:, :, :3].max(axis=2), t[:, :, :3].min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)
    rock = ground & (sat < 0.28) & (mx > 70) & (mx < 215)
    return (~ground) | water | rock | (m[:, :, 3] > 128) | (f[:, :, 3] > 128), t.shape[1], t.shape[0]


def to_cells(px):
    h, w = px.shape
    gh, gw = -(-h // CELL), -(-w // CELL)
    pad = np.ones((gh * CELL, gw * CELL), bool)
    pad[:h, :w] = px
    return pad.reshape(gh, CELL, gw, CELL).mean(axis=(1, 3)) >= 0.4


def carve(cells, carves):
    img = Image.new("L", (cells.shape[1] * CELL, cells.shape[0] * CELL), 0)
    d = ImageDraw.Draw(img)
    for c in carves:
        d.line(c["points"], fill=255, width=c["width"], joint="curve")
    mask = np.array(img).reshape(cells.shape[0], CELL, cells.shape[1], CELL).mean(axis=(1, 3)) > 127
    return cells & ~mask


def erode(walk, n):
    w = walk.copy()
    for _ in range(n):
        p = np.pad(w, 1, constant_values=False)
        w = w & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return w


def flood(walk, seed):
    gh, gw = walk.shape
    seen = np.zeros_like(walk)
    q = deque([seed])
    seen[seed] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < gh and 0 <= nx < gw and walk[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def clearance(walk):
    d = np.zeros(walk.shape, int)
    cur = walk.copy()
    while cur.any():
        d += cur
        cur = erode(cur, 1)
    return d


def cell_of(x, y):
    return (int(y) // CELL, int(x) // CELL)


def snap(target, centers, clear, min_clear):
    """Punto de centros alcanzables con holgura >= min_clear más cercano al destino."""
    ys, xs = np.where(centers & (clear >= min_clear))
    cx, cy = xs * CELL + CELL // 2, ys * CELL + CELL // 2
    i = int(np.argmin((cx - target[0]) ** 2 + (cy - target[1]) ** 2))
    return int(round(cx[i] / 5) * 5), int(round(cy[i] / 5) * 5)


def rects(blocked):
    gh, gw = blocked.shape
    out, open_ = [], {}
    for y in range(gh + 1):
        runs = []
        if y < gh:
            x = 0
            while x < gw:
                if blocked[y, x]:
                    s = x
                    while x < gw and blocked[y, x]:
                        x += 1
                    runs.append((s, x))
                else:
                    x += 1
        new = {}
        for r in runs:
            new[r] = open_.pop(r) if r in open_ else y
        for r, y0 in open_.items():
            out.append((r[0], y0, r[1], y))
        open_ = new
    return out


def process(zid, z):
    px, W, H = blocked_pixels(z)
    walk = ~carve(to_cells(px), z["carves"])
    centers = erode(walk, BODY_CELLS)
    start = cell_of(*z["spawn"])
    if not centers[start]:
        raise SystemExit(f"{zid}: el spawn {z['spawn']} no es un centro transitable")
    reach = flood(centers, start)
    p = np.pad(reach, 1, constant_values=False)
    grown = reach.copy()
    for _ in range(BODY_CELLS):  # devolver el margen del cuerpo para obtener el suelo usable
        p = np.pad(grown, 1, constant_values=False)
        grown = grown | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    usable = grown & walk
    clear = clearance(centers & reach)
    points = {}
    for name, target in z["points"].items():
        need = 1 if name.startswith(("portal", "desde")) else 3
        sx, sy = snap(target, centers & reach, clear, need)
        points[name] = (sx, sy)
    obstacles = [
        {"type": "rect", "x": x0 * CELL, "y": y0 * CELL, "width": (x1 - x0) * CELL, "height": (y1 - y0) * CELL}
        for x0, y0, x1, y1 in rects(~usable)
    ]
    return {"width": W, "height": H, "obstacles": obstacles, "points": points}, reach, usable


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    ap.add_argument("--viz")
    args = ap.parse_args()
    result = {}
    for zid, z in ZONES.items():
        data, reach, usable = process(zid, z)
        result[zid] = data
        print(f"{zid}: {len(data['obstacles'])} obstáculos, suelo usable {usable.mean():.1%}, puntos {data['points']}")
        if args.viz:
            os.makedirs(args.viz, exist_ok=True)
            base = Image.new("RGBA", (data["width"], data["height"]), (0, 0, 0, 255))
            for k in ("horizon", "terrain", "midground", "foreground"):
                base.alpha_composite(Image.open(os.path.join(BG, z[k])).convert("RGBA"), (0, 0))
            d = ImageDraw.Draw(base, "RGBA")
            for o in data["obstacles"]:
                d.rectangle([o["x"], o["y"], o["x"] + o["width"], o["y"] + o["height"]], fill=(255, 0, 0, 90), outline=(255, 255, 0, 160))
            for n, (x, y) in data["points"].items():
                d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(0, 255, 255, 255), outline=(0, 0, 0, 255))
                d.text((x + 10, y - 6), n, fill=(255, 255, 255, 255))
            d.ellipse([z["spawn"][0] - 6, z["spawn"][1] - 6, z["spawn"][0] + 6, z["spawn"][1] + 6], fill=(255, 0, 255, 255))
            base.convert("RGB").save(os.path.join(args.viz, f"{zid}.png"))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(result, fh, ensure_ascii=False)


if __name__ == "__main__":
    main()
