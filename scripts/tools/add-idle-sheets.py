#!/usr/bin/env python3
"""Integra un kit de hojas de Vanessa y Jerry en public/assets SIN alterar ninguna entrada existente.

Kits: «idle» (vanessa-jerry-idle-spritesheets: reposo, mirada y juego), «tricks» (vanessa-jerry-tricks-fetch: los
trucos de Jerry y la búsqueda del peluche) y «tricks-v2» (la hoja de trucos regenerada con la altura de Vanessa corregida:
REEMPLAZA la entrada de trucos y añade `frameAdjust`, el origen y el factor de escala de cada fotograma).

Herramienta de integración (Pillow), fuera del build. Copia los PNG y atlas conservando sus bytes (el atlas
referencia el PNG por su nombre), los indexa al final de `assets.json` con IDs del catálogo
(`character.vanessa-jerry.idle-anim.*`, `kind: "idle-sheet"`) y conserva la metadata del kit: `origin` (los pies de
Vanessa en el lienzo lógico de 362 × 362), `animations` (una por dirección) y el diseño. Los tiempos del kit
(`idleConfig`) NO van al manifiesto: pertenecen a `gameplay.player.idle` de bitacora.json. Idempotente.

Uso:  python3 scripts/tools/add-idle-sheets.py {idle|tricks|tricks-v2} RUTA_DEL_KIT_EXTRAIDO
"""
import hashlib
import json
import os
import shutil
import sys

from PIL import Image
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
KITS = {
    "idle": {
        "name": "vanessa-jerry-idle-spritesheets",
        # clave del kit → ID del catálogo
        "mapping": {
            "vanessa-jerry-idle": "character.vanessa-jerry.idle-anim.rest",
            "vanessa-jerry-idle-look": "character.vanessa-jerry.idle-anim.look",
            "vanessa-jerry-idle-play": "character.vanessa-jerry.idle-anim.play",
        },
        "docs": "idle",
        "note": "Añadidas tres hojas de reposo de Vanessa y Jerry (kind «idle-sheet», con atlas): ver docs/source/idle/. Las entradas anteriores no se modificaron.",
    },
    "tricks-v2": {
        "name": "vanessa-jerry-tricks-fetch-v2",
        "mapping": {"vanessa-jerry-tricks": "character.vanessa-jerry.idle-anim.tricks"},
        "docs": "tricks-v2",
        "replace": True,  # la hoja ya existe: se sustituye (el archivo cambió) y el resto del manifiesto queda igual
        "note": "Sustituida la hoja de trucos de Jerry por la v2 (altura de Vanessa corregida con escala y origen por fotograma, `frameAdjust`): ver docs/source/tricks-v2/. La hoja de buscar el peluche no cambió.",
    },
    "tricks": {
        "name": "vanessa-jerry-tricks-fetch",
        "mapping": {
            "vanessa-jerry-tricks": "character.vanessa-jerry.idle-anim.tricks",
            "vanessa-jerry-fetch-plush": "character.vanessa-jerry.idle-anim.fetch",
        },
        "docs": "tricks",
        "note": "Añadidas las hojas de trucos de Jerry y de búsqueda del peluche (kind «idle-sheet», con atlas): ver docs/source/tricks/. Las entradas anteriores no se modificaron.",
    },
}
DEST_DIR = "characters/vanessa-jerry/idle"


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit_id, kit):
    cfg = KITS[kit_id]
    KIT_NAME, MAPPING = cfg["name"], cfg["mapping"]
    DOCS = {n: f"docs/source/{cfg['docs']}/{o}" for n, o in (("README.md", "readme-original.md"), ("assets.json", "assets-original.json"), ("generation-prompts.json", "generation-prompts.json"))}
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    kit_manifest = json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))
    replace = cfg.get("replace", False)
    if replace and not all(i in manifest["assets"] for i in MAPPING.values()):
        sys.exit("Para reemplazar, la entrada debe existir: integra primero el kit anterior.")
    if not replace and any(i in manifest["assets"] for i in MAPPING.values()):
        sys.exit("Los IDs del kit ya están en assets.json: nada que hacer.")
    if replace and manifest["assets"][next(iter(MAPPING.values()))].get("frameAdjust"):
        sys.exit("La hoja ya está en su versión corregida: nada que hacer.")
    before = json.dumps({k: v for k, v in manifest["assets"].items() if k not in MAPPING.values()}, ensure_ascii=False)
    n_before = len(manifest["assets"])

    def copy(src_rel, dst_rel):
        src, dst = os.path.join(kit, src_rel), os.path.join(ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    for key, asset_id in MAPPING.items():
        k = kit_manifest["assets"][key]
        dest = f"{DEST_DIR}/{os.path.basename(k['path'])}"
        dst = copy(k["path"], dest)
        digest = sha256(dst)
        assert digest == k["sha256"], f"{key}: el sha256 no coincide con el que declara el kit"
        image = Image.open(dst)
        alpha = np.array(image.convert("RGBA"))[:, :, 3]
        assert image.size == (k["width"], k["height"])
        atlas_dest = f"{DEST_DIR}/{os.path.basename(k['atlasPath'])}"
        copy(k["atlasPath"], atlas_dest)
        manifest["assets"][asset_id] = {
            "path": dest, "type": "image", "format": "png", "category": "characters", "label": f"Vanessa y Jerry: {k['label'].lower()}", "kind": "idle-sheet",
            "width": image.width, "height": image.height, "hasAlphaChannel": True, "transparent": bool((alpha < 255).any()),
            "sizeBytes": os.path.getsize(dst), "sha256": digest, "originalPath": f"{KIT_NAME}/{k['path']}",
            "atlasPath": atlas_dest, "frameCount": k["frameCount"],
            # Con lienzo lógico común (v1) se declara su tamaño; la v2 usa recortes sin relleno y un origen por fotograma.
            **({"sourceFrameSize": k["logicalFrameSize"]} if k.get("logicalFrameSize") else {}),
            "layout": {"columns": k["layout"]["columns"], "rows": k["layout"]["rows"], "order": k["layout"]["rowMeaning"]},
            "origin": k["origin"], "anchor": k["anchor"],
            "animations": [
                {"key": a["key"], **({"direction": a["direction"]} if "direction" in a else {}), "frameNames": a["frameNames"], "frameRate": a["frameRate"], "repeat": a["repeat"], "repeatDelay": a.get("repeatDelay", 0)}
                for a in k["animations"]
            ],
            # Corrección de escala por fotograma (v2): Vanessa se dibuja a la misma altura en todas las poses.
            **(
                {
                    "referenceHeightPx": k["referenceHeightPx"],
                    "frameAdjust": [{"name": f["name"], "scaleMultiplier": round(f["scaleMultiplier"], 6), "origin": {"x": round(f["origin"]["x"], 6), "y": round(f["origin"]["y"], 6)}} for f in k["frames"]],
                }
                if k.get("scaleCorrection")
                else {}
            ),
        }

    if replace:
        DOCS["scale-correction.json"] = f"docs/source/{cfg['docs']}/scale-correction.json"
    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in DOCS.items():
        dst = copy(name, dest)
        docs.append({"path": dest, "originalPath": f"{KIT_NAME}/{name}", "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(cfg["note"])
    existing_after = json.dumps({k: manifest["assets"][k] for k in list(manifest["assets"])[:n_before] if k not in MAPPING.values()}, ensure_ascii=False)
    assert existing_after == before, "se alteró una entrada existente"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"assets.json: {manifest['assetCount']} entradas, categorías {manifest['categoryCounts']}")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in KITS:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
