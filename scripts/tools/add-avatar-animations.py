#!/usr/bin/env python3
"""Integra en public/assets SIN alterar ninguna entrada existente el paquete «vanessa-jerry-avatar-idle-happy»: el avatar estático
de Vanessa con Jerry y una hoja de ocho fotogramas (cuatro de reposo y cuatro felices) para el retrato de la cabecera.
Herramienta de integración, fuera del build.

Copia los PNG y el atlas conservando sus bytes, añade dos entradas al final de `assets.json` con las convenciones del proyecto
—el avatar como `portrait` y la hoja como `avatar-sheet` con `atlasPath`, `sourceFrameSize` y `avatarAnimations` (fotogramas y
duraciones en ms de cada estado)— y archiva la documentación original en docs/source/avatar/. Es idempotente: si los IDs ya
existen, aborta. El helper de canvas y el HTML de vista previa del paquete no se copian: el juego trae su propio animador.

Uso:  python3 scripts/tools/add-avatar-animations.py CARPETA_DEL_PAQUETE   (la que contiene assets.json y character/)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
STATIC_ID = "character.vanessa-jerry.avatar"
SHEET_ID = "character.vanessa-jerry.avatar.animations"


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    pack = json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))
    if STATIC_ID in manifest["assets"] or SHEET_ID in manifest["assets"]:
        sys.exit("Los IDs del avatar ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])

    def copy(src, dst_rel):
        dst = os.path.join(ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    still, sheet = pack["assets"]["avatar"], pack["assets"]["avatar-animations"]

    still_rel = "characters/avatar/" + os.path.basename(still["path"])
    dst = copy(os.path.join(kit, still["path"]), still_rel)
    assert sha256(dst) == still["sha256"], "avatar: el sha256 no coincide con el del paquete"
    b = still["contentBounds"]
    manifest["assets"][STATIC_ID] = {
        "path": still_rel, "type": "image", "format": "png", "category": "characters", "label": "Avatar de Vanessa con Jerry para la barra de XP",
        "kind": "portrait", "width": still["width"], "height": still["height"], "hasAlphaChannel": True, "transparent": True,
        "sizeBytes": os.path.getsize(dst), "sha256": still["sha256"], "originalPath": f"vanessa-jerry-avatar-idle-happy/{still['path']}",
        "contentBounds": {"x": b["x"], "y": b["y"], "width": b["w"], "height": b["h"]},
    }

    sheet_rel = "characters/avatar/" + os.path.basename(sheet["path"])
    atlas_rel = "characters/avatar/" + os.path.basename(sheet["atlasPath"])
    dst = copy(os.path.join(kit, sheet["path"]), sheet_rel)
    assert sha256(dst) == sheet["sha256"], "hoja: el sha256 no coincide con el del paquete"
    copy(os.path.join(kit, sheet["atlasPath"]), atlas_rel)
    manifest["assets"][SHEET_ID] = {
        "path": sheet_rel, "type": "image", "format": "png", "category": "characters",
        "label": "Avatar de Vanessa y Jerry: reposo y alegría (ocho fotogramas)", "kind": "avatar-sheet",
        "width": sheet["width"], "height": sheet["height"], "hasAlphaChannel": True, "transparent": True,
        "sizeBytes": os.path.getsize(dst), "sha256": sheet["sha256"], "originalPath": f"vanessa-jerry-avatar-idle-happy/{sheet['path']}",
        "atlasPath": atlas_rel, "frameCount": len(sheet["frames"]),
        "sourceFrameSize": {"width": sheet["logicalFrameSize"]["width"], "height": sheet["logicalFrameSize"]["height"]},
        "layout": {"columns": sheet["layout"]["columns"], "rows": sheet["layout"]["rows"], "order": "state"},
        "origin": sheet["origin"], "anchor": "bust-bottom",
        "avatarAnimations": [
            {"key": a["key"], "state": a["state"], "frameNames": a["frameNames"], "durationsMs": a["durationsMs"], "repeat": a["repeat"]}
            for a in sheet["animations"]
        ],
    }

    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in (("README.md", "docs/source/avatar/readme.md"), ("generation-prompts.json", "docs/source/avatar/generation-prompts.json")):
        dst = copy(os.path.join(kit, name), dest)
        docs.append({"path": dest, "originalPath": f"vanessa-jerry-avatar-idle-happy/{name}", "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadido el avatar de Vanessa con Jerry (estático y hoja de reposo y alegría, `avatar-sheet`) para el retrato de la cabecera: ver docs/source/avatar. Las entradas anteriores no se modificaron."
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
