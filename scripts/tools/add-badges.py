#!/usr/bin/env python3
"""Integra en public/assets SIN alterar ninguna entrada existente el paquete «bitacora-insignias»: seis insignias de aprendizaje
y la insignia de Jerry (compañero), siete PNG de 1254 × 1254 con transparencia. Herramienta de integración, fuera del build.

Copia los PNG conservando sus bytes y añade siete entradas `kind` «badge» al final de `assets.json` (categoría `ui`, con el
rectángulo ocupado como `contentBounds`, el nombre de la insignia como etiqueta y su significado en `meaning`). Archiva el README
y los prompts de generación en docs/source/badges/. Es idempotente: si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-badges.py CARPETA_DEL_PAQUETE   (la que contiene assets/ y README.md)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    pack = json.load(open(os.path.join(kit, "assets", "assets.json"), encoding="utf-8"))["assets"]
    new_ids = {a["id"]: "ui.badge." + a["id"].removeprefix("badge-") for a in pack}
    if any(i in manifest["assets"] for i in new_ids.values()):
        sys.exit("Los IDs de las insignias ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])

    def copy(src, dst_rel):
        dst = os.path.join(ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    for a in pack:
        dst = copy(os.path.join(kit, "assets", a["file"]), a["file"])
        assert sha256(dst) == a["sha256"], f"{a['id']}: el sha256 no coincide con el del paquete"
        b = a["alphaBounds"]
        manifest["assets"][new_ids[a["id"]]] = {
            "path": a["file"], "type": "image", "format": "png", "category": "ui", "label": f"Insignia «{a['name']}»: {a['symbol']}", "kind": "badge",
            "width": a["dimensions"]["width"], "height": a["dimensions"]["height"], "hasAlphaChannel": True, "transparent": True,
            "sizeBytes": os.path.getsize(dst), "sha256": a["sha256"], "originalPath": f"bitacora-insignias/assets/{a['file']}",
            "contentBounds": {"x": b["x"], "y": b["y"], "width": b["width"], "height": b["height"]},
            "meaning": a["meaning"], "recommendedDisplay": {"width": 64, "height": 64},
        }

    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in (("README.md", "docs/source/badges/readme.md"), ("generation-prompts.json", "docs/source/badges/generation-prompts.json")):
        dd = copy(os.path.join(kit, name), dest)
        docs.append({"path": dest, "originalPath": f"bitacora-insignias/{name}", "sizeBytes": os.path.getsize(dd), "sha256": sha256(dd)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadidas las siete insignias del paquete bitacora-insignias (seis de aprendizaje y la de Jerry): ver docs/source/badges. Las entradas anteriores no se modificaron."
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
