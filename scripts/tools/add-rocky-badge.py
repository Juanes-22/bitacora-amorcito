#!/usr/bin/env python3
"""Integra en public/assets SIN alterar ninguna entrada existente la insignia de Rocky de los paquetes «bitacora-insignias» y
«bitacora-panel-insignias» (versión 1.1.0): un PNG de 1254 × 1254 con transparencia. Herramienta de integración, fuera del build.

El PNG sale del paquete de insignias (el del panel lleva el mismo dibujo con otros bytes en los píxeles transparentes). Se añade
una entrada `kind` «badge» al final de `assets.json` y se archivan, junto a las anteriores, el README y los prompts de generación
de la versión 1.1.0 y el README del panel. Es idempotente: si el ID ya existe, aborta.

Uso:  python3 scripts/tools/add-rocky-badge.py CARPETA_INSIGNIAS CARPETA_PANEL
      (la carpeta de cada paquete es la que contiene su README.md)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
ASSET_ID = "ui.badge.rocky"


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit, panel):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    if ASSET_ID in manifest["assets"]:
        sys.exit(f"«{ASSET_ID}» ya está en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])
    a = next(x for x in json.load(open(os.path.join(kit, "assets", "assets.json"), encoding="utf-8"))["assets"] if x["id"] == "badge-rocky")

    def copy(src, dst_rel):
        dst = os.path.join(ROOT, dst_rel)
        assert not os.path.exists(dst), f"{dst_rel} ya existe: no se sobrescribe"
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    dst = copy(os.path.join(kit, "assets", a["file"]), a["file"])
    assert sha256(dst) == a["sha256"], "el sha256 de Rocky no coincide con el del paquete"
    b = a["alphaBounds"]
    manifest["assets"][ASSET_ID] = {
        "path": a["file"], "type": "image", "format": "png", "category": "ui", "label": f"Insignia «{a['name']}»: {a['symbol']}", "kind": "badge",
        "width": a["dimensions"]["width"], "height": a["dimensions"]["height"], "hasAlphaChannel": True, "transparent": True,
        "sizeBytes": os.path.getsize(dst), "sha256": a["sha256"], "originalPath": f"bitacora-insignias/assets/{a['file']}",
        "contentBounds": {"x": b["x"], "y": b["y"], "width": b["width"], "height": b["height"]},
        "meaning": a["meaning"], "recommendedDisplay": {"width": 64, "height": 64},
    }

    docs = manifest.setdefault("sourceDocuments", [])
    for src, dest, original in (
        (os.path.join(kit, "README.md"), "docs/source/badges/readme-v1.1.0.md", "bitacora-insignias/README.md"),
        (os.path.join(kit, "generation-prompts.json"), "docs/source/badges/generation-prompts-v1.1.0.json", "bitacora-insignias/generation-prompts.json"),
        (os.path.join(panel, "README.md"), "docs/source/badge-panel/readme-v1.1.0.md", "bitacora-panel-insignias/README.md"),
    ):
        dd = copy(src, dest)
        docs.append({"path": dest, "originalPath": original, "sizeBytes": os.path.getsize(dd), "sha256": sha256(dd)})

    counts = {}
    for x in manifest["assets"].values():
        counts[x["category"]] = counts.get(x["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadida la insignia de Rocky (paquetes bitacora-insignias y bitacora-panel-insignias, versión 1.1.0): ver docs/source/badges y docs/source/badge-panel. Las entradas anteriores no se modificaron."
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
