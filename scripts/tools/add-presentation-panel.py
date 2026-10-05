#!/usr/bin/env python3
"""Integra en public/assets SIN alterar ninguna entrada existente el kit «bitacora-panel-presentacion» (v2.0.0): las 7 piezas nuevas de
la presentación (pergamino de nueve zonas, letrero de madera con flores, ilustración de Vanessa y Jerry, botón «Continuar», ramita,
brote y separador con semilla). Herramienta de integración, fuera del build.

Copia los PNG conservando sus bytes a `ui/presentation/` y añade 7 entradas `kind` «presentation-part» al final de `assets.json`, con
el ID `ui.presentation.<nombre>`, su `group`, `recommendedDisplay` y, el pergamino, su `nineSlice`. Las 4 piezas reutilizadas del
panel de insignias (cerrar y destellos) NO se copian: ya están en el proyecto con los mismos bytes. Archiva el README, el índice del
kit y los prompts de generación en docs/source/presentation/. Es idempotente: si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-presentation-panel.py CARPETA_DEL_KIT   (la que contiene README.md y public/)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
GROUPS = {
    "panel-parchment": ("frames", "pergamino"),
    "title-wood-flowers": ("titles", "letrero de madera"),
    "welcome-vanessa-jerry": ("illustrations", "ilustración"),
    "button-continue": ("buttons", "botón"),
    "leaf-sprig": ("decorations", "ramita"),
    "divider-seed": ("decorations", "separador"),
    "sprout-flat": ("icons", "brote"),
}


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    index = json.load(open(os.path.join(kit, "public", "assets", "ui", "presentation", "assets.json"), encoding="utf-8"))["assets"]
    pack = {k: v for k, v in index.items() if k.startswith("ui.presentation.")}
    if set(k.removeprefix("ui.presentation.") for k in pack) != set(GROUPS):
        sys.exit(f"Piezas inesperadas en el kit: {sorted(pack)}")
    if any(i in manifest["assets"] for i in pack):
        sys.exit("Los IDs de la presentación ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])

    for asset_id, a in pack.items():
        name = asset_id.removeprefix("ui.presentation.")
        src = os.path.join(kit, a["path"])
        rel = a["path"].removeprefix("public/assets/")
        dst = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{rel}: la copia no es idéntica"
        assert sha256(dst) == a["sha256"], f"{rel}: el sha256 no coincide con el del kit"
        group, what = GROUPS[name]
        entry = {
            "path": rel, "type": "image", "format": "png", "category": "ui", "label": f"Presentación · {what}: {name}", "kind": "presentation-part",
            "group": group, "width": a["width"], "height": a["height"], "hasAlphaChannel": True, "transparent": True,
            "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst), "originalPath": f"bitacora-panel-presentacion/{a['path']}",
            "recommendedDisplay": a["recommendedDisplaySize"],
        }
        if "nineSlice" in a:
            ns = a["nineSlice"]
            entry["nineSlice"] = {"top": ns["top"], "right": ns["right"], "bottom": ns["bottom"], "left": ns["left"]}
        manifest["assets"]["ui.presentation." + name] = entry

    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in (("README.md", "docs/source/presentation/readme.md"), ("assets.json", "docs/source/presentation/assets.json"), ("generation-prompts.json", "docs/source/presentation/generation-prompts.json")):
        dst = os.path.join(ROOT, dest)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(kit, name), dst)
        docs.append({"path": dest, "originalPath": f"bitacora-panel-presentacion/{name}", "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst)})

    counts = {}
    for x in manifest["assets"].values():
        counts[x["category"]] = counts.get(x["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadidas las 7 piezas de la presentación del kit bitacora-panel-presentacion (v2.0.0): ver docs/source/presentation. Las entradas anteriores no se modificaron."
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
