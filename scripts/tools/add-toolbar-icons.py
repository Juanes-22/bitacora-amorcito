#!/usr/bin/env python3
"""Integra el paquete «bitacora-assets-senalados-v2» (botones de la cabecera y dos assets sueltos) en public/assets SIN
alterar ninguna entrada existente. Herramienta de integración, fuera del build. Copia los PNG conservando sus bytes
(en la misma ruta relativa que declara el índice del paquete), añade sus siete entradas al final de `assets.json` con su
metadata (`contentBounds`, `recommendedDisplayWidth`, `ariaLabel`…) y actualiza `assetCount`/`categoryCounts`. Es
idempotente: si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-toolbar-icons.py RUTA_DEL_PAQUETE_EXTRAIDO   (la carpeta que contiene assets/ y README.md)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
KIT_NAME = "bitacora-assets-senalados-v2"


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    kit_manifest = json.load(open(os.path.join(kit, "assets", "assets.json"), encoding="utf-8"))
    if any(i in manifest["assets"] for i in kit_manifest["assets"]):
        sys.exit("Los IDs del paquete ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])
    for asset_id, entry in kit_manifest["assets"].items():
        src = os.path.join(kit, "assets", entry["path"])
        dst = os.path.join(ROOT, entry["path"])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst) == entry["sha256"], f"{asset_id}: el archivo no coincide con su hash"
        assert os.path.getsize(dst) == entry["sizeBytes"]
        manifest["assets"][asset_id] = {**entry, "originalPath": f"{KIT_NAME}/{entry['originalPath']}"}
    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append("Añadidos los botones de la cabecera (bitácora, ajustes, audio, patita, insignias) y dos assets sueltos (libro abierto, rincón de aprendizaje): ver README del paquete bitacora-assets-senalados-v2. Las entradas anteriores no se modificaron.")
    existing_after = json.dumps({k: manifest["assets"][k] for k in list(manifest["assets"])[:n_before]}, ensure_ascii=False)
    assert existing_after == before, "se alteró una entrada existente"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"assets.json: {manifest['assetCount']} entradas, categorías {manifest['categoryCounts']}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
