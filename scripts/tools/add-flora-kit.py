#!/usr/bin/env python3
"""Integra el kit «bitacora-flowers-bushes-animations» en public/assets SIN alterar ninguna entrada existente.

Herramienta de integración (Pillow), fuera del build. Copia los PNG y atlas conservando sus bytes, los indexa al
final de `assets.json` con IDs del catálogo (`animation.flora.*`, `kind: "animation-sheet"`) y conserva la metadata del
kit (`origin` = raíz de la planta, `recommendedScale`, `animation`, `sourceFrameSize`…). Es idempotente: si los IDs ya
existen, aborta.

Uso:  python3 scripts/tools/add-flora-kit.py RUTA_DEL_KIT_EXTRAIDO
"""
import hashlib
import json
import os
import shutil
import sys

from PIL import Image
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
KIT_NAME = "bitacora-flowers-bushes-animations"

# clave del kit → (ID del catálogo, destino relativo a public/assets)
MAPPING = {
    "daisies-sway": ("animation.flora.daisies", "animations/flora/daisies-sway.png"),
    "pink-flowers-sway": ("animation.flora.pink-flowers", "animations/flora/pink-flowers-sway.png"),
    "sunflowers-sway": ("animation.flora.sunflowers", "animations/flora/sunflowers-sway.png"),
    "purple-spikes-sway": ("animation.flora.purple-spikes", "animations/flora/purple-spikes-sway.png"),
    "round-bush-sway": ("animation.flora.round-bush", "animations/flora/round-bush-sway.png"),
    "flowering-bush-sway": ("animation.flora.flowering-bush", "animations/flora/flowering-bush-sway.png"),
}
DOCS = {
    "README.md": "docs/source/flora/readme-original.md",
    "assets.json": "docs/source/flora/assets-original.json",
    "generation-prompts.json": "docs/source/flora/generation-prompts.json",
}


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    kit_manifest = json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))
    if any(v[0] in manifest["assets"] for v in MAPPING.values()):
        sys.exit("Los IDs del kit ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])

    def copy(src_rel, dst_rel):
        src, dst = os.path.join(kit, src_rel), os.path.join(ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    for key, (asset_id, dest) in MAPPING.items():
        k = kit_manifest["assets"][key]
        dst = copy(k["path"], dest)
        digest = sha256(dst)
        image = Image.open(dst)
        alpha = np.array(image.convert("RGBA"))[:, :, 3]
        assert image.size == (k["width"], k["height"])
        atlas_dest = dest.replace(".png", ".atlas.json")
        copy(k["atlasPath"], atlas_dest)
        a = k["animation"]
        manifest["assets"][asset_id] = {
            "path": dest, "type": "image", "format": "png", "category": "decorations", "label": k["label"], "kind": "animation-sheet",
            "width": image.width, "height": image.height, "hasAlphaChannel": True, "transparent": bool((alpha < 255).any()),
            "sizeBytes": os.path.getsize(dst), "sha256": digest, "originalPath": f"{KIT_NAME}/{k['path']}",
            "recommendedContentHeightPx": k["recommendedContentHeightPx"], "filter": k["filter"],
            "origin": k["origin"], "recommendedScale": k["recommendedScale"], "blendMode": k["recommendedBlendMode"], "opacity": k["recommendedOpacity"],
            "atlasPath": atlas_dest, "frameCount": k["frameCount"], "layout": {n: k["layout"][n] for n in ("columns", "rows", "order")},
            "sourceFrameSize": k["sourceFrameSize"],
            # La clave de la animación se deriva del ID del catálogo en tiempo de ejecución.
            "animation": {"frameNames": a["frameNames"], "frameRate": a["frameRate"], "repeat": a["repeat"]},
        }

    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in DOCS.items():
        dst = copy(name, dest)
        docs.append({"path": dest, "originalPath": f"{KIT_NAME}/{name}", "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadido el kit de flores y arbustos animados (6 imágenes, 6 atlas): ver docs/source/flora/. Las entradas anteriores no se modificaron."
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
