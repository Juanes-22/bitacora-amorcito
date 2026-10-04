#!/usr/bin/env python3
"""Integra en public/assets SIN alterar ninguna entrada existente el kit «bitacora-panel-insignias»: los 60 recursos de interfaz
del panel de insignias (marcos de nueve zonas, botones, etiquetas sin texto, cápsula de progreso, recuadros, iconos,
decoraciones y efectos). Herramienta de integración, fuera del build.

Copia los PNG conservando sus bytes a `ui/badge-panel/<grupo>/` y añade 60 entradas `kind` «badge-panel-part» al final de
`assets.json`, con el ID `ui.badge-panel.<nombre>` (el del kit con el guion que exige el catálogo: los IDs van en minúsculas), su `group` (la carpeta), `nineSlice` (cortes en píxeles del archivo,
solo los de nueve zonas) y `recommendedDisplay`. Las siete insignias del kit no se copian: ya están en el catálogo (`ui.badge.*`)
con el mismo arte. Los atlas originales, los ejemplos, la vista previa y los scripts del kit no se copian. Archiva el README y
los prompts de generación en docs/source/badge-panel/. Es idempotente: si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-badge-panel.py CARPETA_DEL_KIT   (la que contiene assets.json y public/)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
LABELS = {
    "frames": "marco", "buttons": "botón", "labels": "etiqueta", "controls": "control", "icons": "icono", "decorations": "decoración", "effects": "efecto",
}


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    pack = {k: v for k, v in json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))["assets"].items() if k.startswith("ui.badgePanel.")}
    if len(pack) != 60:
        sys.exit(f"Se esperaban 60 recursos de interfaz y hay {len(pack)}")
    if any("ui.badge-panel." + i.removeprefix("ui.badgePanel.") in manifest["assets"] for i in pack):
        sys.exit("Los IDs del panel de insignias ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])

    for asset_id, a in pack.items():
        src = os.path.join(kit, a["path"])
        rel = a["path"].removeprefix("public/assets/")
        dst = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{rel}: la copia no es idéntica"
        group = rel.split("/")[2]
        name = asset_id.removeprefix("ui.badgePanel.")
        new_id = "ui.badge-panel." + name
        entry = {
            "path": rel, "type": "image", "format": "png", "category": "ui", "label": f"Panel de insignias · {LABELS[group]}: {name}", "kind": "badge-panel-part",
            "group": group, "width": a["width"], "height": a["height"], "hasAlphaChannel": True, "transparent": True,
            "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst), "originalPath": f"bitacora-panel-insignias/{a['path']}",
            "recommendedDisplay": a["recommendedDisplaySize"],
        }
        if "nineSlice" in a:
            entry["nineSlice"] = {side: a["nineSlice"][side] for side in ("top", "right", "bottom", "left")}
        manifest["assets"][new_id] = entry

    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in (("README.md", "docs/source/badge-panel/readme.md"), ("generation-prompts.json", "docs/source/badge-panel/generation-prompts.json")):
        dst = os.path.join(ROOT, dest)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(kit, name), dst)
        docs.append({"path": dest, "originalPath": f"bitacora-panel-insignias/{name}", "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadidos los 60 recursos de interfaz del panel de insignias (kit bitacora-panel-insignias): ver docs/source/badge-panel. Las siete insignias del kit no se copian porque ya están en el catálogo. Las entradas anteriores no se modificaron."
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
