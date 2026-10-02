#!/usr/bin/env python3
"""Integra en public/assets SIN alterar ninguna entrada existente el paquete «bitacora-ui-assets»: el letrero de estación
(con su círculo para el número y su placa para el título), la señal de cambio de mapa, la insignia «Completado», los cuatro
botones con etiqueta (Bitácora, Jerry, Sonido activado y silenciado) y el brillo animado de la próxima estación.
Herramienta de integración, fuera del build.

Copia los PNG conservando sus bytes y añade las entradas al final de `assets.json` con las convenciones del proyecto. Los textos
no vienen dibujados: el paquete da sus zonas (`labelZones`, en píxeles de la textura desde su esquina superior izquierda) y los
puntos de anclaje de lo que se pega al letrero (`attachments`, centro y tamaño); se conservan en la entrada. La hoja del brillo
es una cuadrícula de 4 × 2 fotogramas de 256 × 128: aquí se genera su atlas. Los fotogramas sueltos, el APNG, el GIF, los
originales de alta resolución, los ejemplos y la vista previa del paquete no se copian (duplican lo anterior). Es idempotente:
si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-ui-assets-v2.py CARPETA_DEL_PAQUETE   (la que contiene assets.json y map/, ui/, effects/)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")

# id del paquete -> (id nuevo del catálogo, destino, categoría, kind, etiqueta)
MAP = {
    "station-sign": ("station.sign.board", "stations/signs/station-board-sign.png", "stations", "station-sign", "Letrero de estación con círculo para el número y placa para el título"),
    "map-exit-right": ("map.sign.exit-right", "stations/signs/map-exit-right.png", "stations", "exit-sign", "Señal de cambio de mapa hacia la derecha"),
    "completed-badge": ("ui.badge.completed-pill", "ui/badges/completed-pill.png", "ui", "status-pill", "Insignia «Completado» con check y espacio para la etiqueta"),
    "button-bitacora": ("ui.button.journal.labeled", "ui/buttons/labeled/button-bitacora.png", "ui", "button", "Botón Bitácora con espacio para la etiqueta"),
    "button-jerry": ("ui.button.jerry.labeled", "ui/buttons/labeled/button-jerry.png", "ui", "button", "Botón Jerry con espacio para la etiqueta"),
    "button-sound-on": ("ui.button.sound-on.labeled", "ui/buttons/labeled/button-sound-on.png", "ui", "button", "Botón Sonido activado con espacio para la etiqueta"),
    "button-sound-off": ("ui.button.sound-off.labeled", "ui/buttons/labeled/button-sound-off.png", "ui", "button", "Botón Sonido silenciado con espacio para la etiqueta"),
}
GLOW_ID = "effect.station-glow.pulse"


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    pack = {a["id"]: a for a in json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))["assets"]}
    ids = [v[0] for v in MAP.values()] + [GLOW_ID]
    if any(i in manifest["assets"] for i in ids):
        sys.exit("Los IDs del paquete ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])

    def copy(src, dst_rel):
        dst = os.path.join(ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    def zones(a):
        out = {}
        for name, z in a.get("labelZones", {}).items():
            out[name] = {k: z[k] for k in ("x", "y", "width", "height", "align", "color", "fontSize", "fontWeight", "maxLines") if k in z}
        return out

    for pid, (new_id, rel, category, kind, label) in MAP.items():
        a = pack[pid]
        dst = copy(os.path.join(kit, a["path"]), rel)
        entry = {
            "path": rel, "type": "image", "format": "png", "category": category, "label": label, "kind": kind,
            "width": a["width"], "height": a["height"], "hasAlphaChannel": True, "transparent": True,
            "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst), "originalPath": f"bitacora-ui-assets/{a['path']}",
            "origin": a["origin"], "recommendedDisplay": a["recommendedDisplay"],
        }
        if a.get("labelZones"):
            entry["labelZones"] = zones(a)
        if a.get("attachments"):
            entry["attachments"] = a["attachments"]
        if a.get("hitArea"):
            entry["hitArea"] = a["hitArea"]
        if a.get("direction"):
            entry["direction"] = a["direction"]
        manifest["assets"][new_id] = entry

    g = pack["station-glow"]
    rel = "effects/station-glow/station-glow-sheet.png"
    dst = copy(os.path.join(kit, g["path"]), rel)
    fr = g["frame"]
    names = [f"glow-{i:02d}" for i in range(fr["count"])]
    atlas = {
        "frames": {
            n: {"frame": {"x": f["x"], "y": f["y"], "w": f["width"], "h": f["height"]}, "rotated": False, "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": f["width"], "h": f["height"]}, "sourceSize": {"w": f["width"], "h": f["height"]}}
            for n, f in zip(names, g["frames"])
        },
        "meta": {"image": os.path.basename(rel), "format": "RGBA8888", "size": {"w": g["width"], "h": g["height"]}, "scale": "1"},
    }
    atlas_rel = "effects/station-glow/station-glow-sheet.atlas.json"
    atlas_path = os.path.join(ROOT, atlas_rel)
    with open(atlas_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(atlas, indent=2) + "\n")
    anim = json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))["animations"][0]
    manifest["assets"][GLOW_ID] = {
        "path": rel, "type": "image", "format": "png", "category": "effects", "label": "Brillo animado de la próxima estación (8 fotogramas, sin partículas)", "kind": "animation-sheet",
        "width": g["width"], "height": g["height"], "hasAlphaChannel": True, "transparent": True,
        "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst), "originalPath": f"bitacora-ui-assets/{g['path']}",
        "atlasPath": atlas_rel, "frameCount": fr["count"], "sourceFrameSize": {"width": fr["width"], "height": fr["height"]},
        "layout": {"columns": fr["columns"], "rows": fr["rows"], "order": "row"},
        "animation": {"frameNames": names, "frameRate": anim["frameRate"], "repeat": anim["repeat"]},
        "origin": g["origin"], "recommendedScale": g["recommendedDisplay"]["width"] / fr["width"],
        "recommendedDisplayWidth": g["recommendedDisplay"]["width"],
        "opacityByFrame": [g["recommendedOpacity"]] * fr["count"],
    }

    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in (("README.md", "docs/source/ui-assets/readme.md"), ("generation-prompts.md", "docs/source/ui-assets/generation-prompts.md"), ("export-info.json", "docs/source/ui-assets/export-info.json")):
        dd = copy(os.path.join(kit, name), dest)
        docs.append({"path": dest, "originalPath": f"bitacora-ui-assets/{name}", "sizeBytes": os.path.getsize(dd), "sha256": sha256(dd)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadidos los assets del paquete bitacora-ui-assets (letrero de estación, señal de cambio de mapa, insignia «Completado», botones con etiqueta y brillo de la próxima estación): ver docs/source/ui-assets. Los textos no vienen en los PNG: `labelZones` y `attachments` dicen dónde ponerlos. Las entradas anteriores no se modificaron."
    )
    existing_after = json.dumps({k: manifest["assets"][k] for k in list(manifest["assets"])[:n_before]}, ensure_ascii=False)
    assert existing_after == before, "se alteró una entrada existente"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"assets.json: {manifest['assetCount']} entradas, categorías {manifest['categoryCounts']}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
