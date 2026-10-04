#!/usr/bin/env python3
"""Integra en public/assets SIN alterar ninguna entrada existente el paquete «bitacora-chickens-animations»: cinco gallinas
adultas y un pollito (negro y gris), cada uno con tres animaciones de cuatro fotogramas (reposo, caminar y picotear).
Herramienta de integración, fuera del build.

Copia los PNG y los atlas conservando sus bytes y añade seis entradas al final de `assets.json` con las convenciones del
proyecto: `kind` «critter-sheet», `atlasPath`, `sourceFrameSize` (el lienzo virtual común de 448 × 448), `origin` (las patas),
`recommendedDisplay` (48 × 48 las gallinas, 24 × 24 el pollito) y `critterAnimations` (fotogramas y duración en ms de cada
estado). Archiva la documentación original en docs/source/chickens/. El reproductor Canvas, la utilidad de familia, la vista
previa y el ejemplo de colocación del paquete no se copian: el juego trae su propio comportamiento y las posiciones son de
cada mapa. Es idempotente: si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-chickens.py CARPETA_DEL_PAQUETE   (la que contiene assets.json y decorations/)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")

# id del paquete -> id del catálogo
IDS = {
    "hen-grey-fluffy": "fauna.hen.grey-fluffy",
    "hen-black-crested": "fauna.hen.black-crested",
    "hen-white": "fauna.hen.white",
    "hen-brown": "fauna.hen.brown",
    "hen-white-fluffy": "fauna.hen.white-fluffy",
    "chick-black": "fauna.chick.black",
}


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    pack = json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))["assets"]
    if any(i in manifest["assets"] for i in IDS.values()):
        sys.exit("Los IDs de las gallinas ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])

    def copy(src, dst_rel):
        dst = os.path.join(ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    for pid, new_id in IDS.items():
        a = pack[pid]
        dst = copy(os.path.join(kit, a["path"]), a["path"])
        assert sha256(dst) == a["sha256"], f"{pid}: el sha256 no coincide con el del paquete"
        copy(os.path.join(kit, a["atlasPath"]), a["atlasPath"])
        names = [f["name"] for f in a["frames"]]
        manifest["assets"][new_id] = {
            "path": a["path"], "type": "image", "format": "png", "category": "decorations", "label": a["name"], "kind": "critter-sheet",
            "width": a["width"], "height": a["height"], "hasAlphaChannel": True, "transparent": True,
            "sizeBytes": os.path.getsize(dst), "sha256": a["sha256"], "originalPath": f"bitacora-chickens-animations/{a['path']}",
            "filter": "nearest", "atlasPath": a["atlasPath"], "frameCount": len(names),
            "sourceFrameSize": {"width": a["logicalFrameSize"]["width"], "height": a["logicalFrameSize"]["height"]},
            "layout": {"columns": a["layout"]["columns"], "rows": a["layout"]["rows"], "order": "state"},
            "origin": a["origin"], "recommendedDisplay": a["displaySize"], "facing": "right", "flipForLeft": True,
            "critterAnimations": [
                {"key": x["key"], "state": x["state"], "frameNames": x["frameNames"], "durationsMs": x["durationsMs"], "repeat": x["repeat"]}
                for x in a["animations"]
            ],
        }

    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in (("README.md", "docs/source/chickens/readme.md"), ("generation-prompts.json", "docs/source/chickens/generation-prompts.json")):
        dd = copy(os.path.join(kit, name), dest)
        docs.append({"path": dest, "originalPath": f"bitacora-chickens-animations/{name}", "sizeBytes": os.path.getsize(dd), "sha256": sha256(dd)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadidas cinco gallinas y un pollito animados (hojas con atlas, `critterAnimations`): ver docs/source/chickens. Las entradas anteriores no se modificaron."
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
