#!/usr/bin/env python3
"""Integra el kit «bitacora-landscape-animations» en public/assets SIN alterar ninguna entrada existente.

Herramienta de integración (Pillow), fuera del build. Copia los PNG y atlas conservando sus bytes, los
indexa al final de `assets.json` con IDs del catálogo (no los del kit) y conserva la metadata del kit
(`origin`, `recommendedScale`, `animation`, `motion`…). También archiva la documentación original del kit
en `docs/source/animations/` como el resto de documentos fuente. Es idempotente: si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-landscape-kit.py RUTA_DEL_KIT_EXTRAIDO
"""
import hashlib
import json
import os
import shutil
import sys

from PIL import Image
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
KIT_NAME = "bitacora-landscape-animations"

# clave del kit → (ID del catálogo, categoría, kind, destino relativo a public/assets)
MAPPING = {
    "water-ripples": ("animation.water.ripples", "effects", "animation-sheet", "animations/water-ripples.png"),
    "waterfall": ("animation.water.waterfall", "effects", "animation-sheet", "animations/waterfall.png"),
    "foam-splash": ("animation.water.foam-splash", "effects", "animation-sheet", "animations/foam-splash.png"),
    "flower-daisies": ("decoration.plant.daisies", "decorations", "foliage", "decorations/plants/flower-daisies.png"),
    "bush": ("decoration.plant.bush", "decorations", "foliage", "decorations/plants/bush.png"),
    "oak-canopy": ("decoration.tree.oak-canopy", "decorations", "foliage", "decorations/plants/oak-canopy.png"),
    "cloud": ("background.sky.cloud", "backgrounds", "sky-element", "backgrounds/sky/cloud.png"),
    "leaf": ("particle.leaf", "effects", "particle", "particles/leaf.png"),
    "petal": ("particle.petal", "effects", "particle", "particles/petal.png"),
    "water-droplet": ("particle.water-droplet", "effects", "particle", "particles/water-droplet.png"),
}
DOCS = {
    "README.md": "docs/source/animations/readme-original.md",
    "assets.json": "docs/source/animations/assets-original.json",
    "generation-prompts.json": "docs/source/animations/generation-prompts.json",
}
# metadata del kit que se conserva tal cual en cada entrada
KEEP = ["origin", "recommendedScale", "recommendedContentHeightPx", "contentBounds", "filter", "motion"]
KEEP_ATLAS = ["frameCount", "layout", "sourceFrameSize", "frameContentBounds"]


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    kit_manifest = json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))
    ids = [v[0] for v in MAPPING.values()]
    if any(i in manifest["assets"] for i in ids):
        sys.exit("Los IDs del kit ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)

    def copy(src_rel, dst_rel):
        src, dst = os.path.join(kit, src_rel), os.path.join(ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    for key, (asset_id, category, kind, dest) in MAPPING.items():
        k = kit_manifest["assets"][key]
        dst = copy(k["path"], dest)
        digest = sha256(dst)
        assert digest == k["sha256"], f"{key}: el sha256 no coincide con el que declara el kit"
        image = Image.open(dst)
        alpha = np.array(image.convert("RGBA"))[:, :, 3]
        assert image.size == (k["width"], k["height"])
        entry = {
            "path": dest, "type": "image", "format": "png", "category": category, "label": k["label"], "kind": kind,
            "width": image.width, "height": image.height, "hasAlphaChannel": True, "transparent": bool((alpha < 255).any()),
            "sizeBytes": os.path.getsize(dst), "sha256": digest, "originalPath": f"{KIT_NAME}/{k['path']}",
        }
        for name in KEEP:
            if name in k:
                entry[name] = k[name]
        if k["type"] == "atlas":
            atlas_dest = dest.replace(".png", ".atlas.json")
            copy(k["atlasPath"], atlas_dest)
            entry["atlasPath"] = atlas_dest
            for name in KEEP_ATLAS:
                entry[name] = k[name]
            a = k["animation"]
            # La clave de la animación se deriva del ID del catálogo en tiempo de ejecución.
            entry["animation"] = {"frameNames": a["frameNames"], "frameRate": a["frameRate"], "repeat": a["repeat"]}
        manifest["assets"][asset_id] = entry

    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in DOCS.items():
        dst = copy(name, dest)
        docs.append({"path": dest, "originalPath": f"{KIT_NAME}/{name}", "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    notes = manifest.setdefault("notes", [])
    notes.append("Añadido el kit de animaciones del paisaje (10 imágenes, 3 atlas): ver docs/source/animations/. Las entradas anteriores no se modificaron.")

    existing_after = json.dumps({k: manifest["assets"][k] for k in list(manifest["assets"])[:45]}, ensure_ascii=False)
    assert existing_after == before, "se alteró una entrada existente"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"assets.json: {manifest['assetCount']} entradas, categorías {manifest['categoryCounts']}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
