#!/usr/bin/env python3
"""Integra dos paquetes en public/assets SIN alterar ninguna entrada existente: «bitacora-animaciones-xp-glow» (la estrella de
XP al completar una estación y el aro de «próxima estación») y «bitacora-ui-panel-avatar-xp» (el panel de nueve zonas de la
cabecera con el avatar y el XP). Herramienta de integración, fuera del build.

Copia los PNG y los atlas conservando sus bytes (los 16 fotogramas sueltos y los APNG del paquete duplican las hojas y no se
copian), añade las entradas al final de `assets.json` con las convenciones del proyecto —las hojas como `animation-sheet` con
`atlasPath`, `animation`, `origin` y `recommendedScale`, más `opacityByFrame`; el panel como `panel` con `nineSlice`— y
archiva la documentación original en docs/source/. Es idempotente: si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-xp-glow-panel.py CARPETA_DEL_PAQUETE_XP CARPETA_DEL_PAQUETE_PANEL   (las que contienen assets/)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(xp_kit, panel_kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    xp = json.load(open(os.path.join(xp_kit, "assets", "assets.json"), encoding="utf-8"))
    panel = json.load(open(os.path.join(panel_kit, "assets", "assets.json"), encoding="utf-8"))
    ids = list(xp["assets"]) + list(panel["assets"])
    if any(i in manifest["assets"] for i in ids):
        sys.exit("Los IDs de los paquetes ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])

    def copy(src, dst_rel):
        dst = os.path.join(ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    for asset_id, k in xp["assets"].items():
        src = os.path.join(xp_kit, "assets", k["path"])
        dst = copy(src, k["path"].replace("effects/", "effects/", 1))
        assert sha256(dst) == k["sha256"], f"{asset_id}: el sha256 no coincide con el del paquete"
        copy(os.path.join(xp_kit, "assets", k["atlasPath"]), k["atlasPath"])
        a, fd = k["animation"], k["frameDefinition"]
        manifest["assets"][asset_id] = {
            "path": k["path"], "type": "image", "format": "png", "category": "effects", "label": k["label"], "kind": "animation-sheet",
            "width": k["width"], "height": k["height"], "hasAlphaChannel": True, "transparent": True,
            "sizeBytes": os.path.getsize(dst), "sha256": k["sha256"], "originalPath": f"bitacora-animaciones-xp-glow/{k['originalPath']}",
            "atlasPath": k["atlasPath"], "frameCount": fd["frameCount"], "sourceFrameSize": {"width": fd["width"], "height": fd["height"]},
            "layout": {"columns": fd["columns"], "rows": fd["rows"], "order": fd["order"]},
            "animation": {"frameNames": a["frames"], "frameRate": a["frameRate"], "repeat": a["repeat"]},
            "origin": a["origin"], "recommendedScale": 0.5, "recommendedDisplayWidth": k["recommendedDisplayWidth"],
            "opacityByFrame": a["opacityByFrame"], "hideOnComplete": a["hideOnComplete"],
        }

    for asset_id, k in panel["assets"].items():
        src = os.path.join(panel_kit, "assets", k["path"])
        dst = copy(src, k["path"])
        assert sha256(dst) == k["sha256"], f"{asset_id}: el sha256 no coincide con el del paquete"
        entry = {key: v for key, v in k.items() if key not in ("nineSlice", "path", "originalPath", "sourceCrop")}
        entry["path"] = k["path"]
        entry["originalPath"] = f"bitacora-ui-panel-avatar-xp/{k['originalPath']}"
        entry["nineSlice"] = {side: k["nineSlice"][side] for side in ("top", "right", "bottom", "left")}  # en píxeles de la imagen
        manifest["assets"][asset_id] = entry

    docs = manifest.setdefault("sourceDocuments", [])
    for kit, folder in ((xp_kit, "xp-glow"), (panel_kit, "panel-estado")):
        for name in ("README.md", "PROMPTS.md"):
            dest = f"docs/source/{folder}/{name.lower()}"
            dst = copy(os.path.join(kit, name), dest)
            docs.append({"path": dest, "originalPath": f"{os.path.basename(kit)}/{name}", "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadidas las animaciones de la estrella de XP y del aro de la próxima estación (hojas con atlas, `opacityByFrame`) y el panel de nueve zonas de la cabecera: ver docs/source/xp-glow y docs/source/panel-estado. Las entradas anteriores no se modificaron."
    )
    existing_after = json.dumps({k: manifest["assets"][k] for k in list(manifest["assets"])[:n_before]}, ensure_ascii=False)
    assert existing_after == before, "se alteró una entrada existente"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"assets.json: {manifest['assetCount']} entradas, categorías {manifest['categoryCounts']}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
