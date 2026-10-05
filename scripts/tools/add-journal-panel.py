#!/usr/bin/env python3
"""Integra en public/assets SIN alterar ninguna entrada existente el kit «bitacora-panel-aprendizajes»: las 11 piezas nuevas del
índice y el lector de la Bitácora de aprendizajes (seis ilustraciones, libro con brote, cerezo, flores blancas, burbuja de
reflexión y cinta «Siguiente» en blanco). Herramienta de integración, fuera del build.

Copia los PNG conservando sus bytes a `ui/journal-panel/<grupo>/` y añade 11 entradas `kind` «journal-panel-part» al final de
`assets.json`, con el ID `ui.journal-panel.<nombre>` (el del kit con guion: el catálogo exige minúsculas), su `group` (la carpeta)
y `recommendedDisplay`. Las 47 piezas compartidas del panel de insignias y las seis insignias del kit NO se copian: ya están en el
proyecto (las compartidas, con los mismos bytes; las insignias, con su propio arte). Archiva el README, la guía de integración y los
prompts de generación en docs/source/journal-panel/. Es idempotente: si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-journal-panel.py CARPETA_DEL_KIT   (la que contiene assets.json y public/)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
LABELS = {"illustrations": "ilustración", "icons": "icono", "labels": "etiqueta"}


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    pack = {k: v for k, v in json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))["assets"].items() if k.startswith("ui.journalPanel.")}
    if len(pack) != 11:
        sys.exit(f"Se esperaban 11 recursos nuevos y hay {len(pack)}")
    if any("ui.journal-panel." + i.removeprefix("ui.journalPanel.") in manifest["assets"] for i in pack):
        sys.exit("Los IDs del panel de aprendizajes ya están en assets.json: nada que hacer.")
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
        name = asset_id.removeprefix("ui.journalPanel.")
        manifest["assets"]["ui.journal-panel." + name] = {
            "path": rel, "type": "image", "format": "png", "category": "ui", "label": f"Panel de aprendizajes · {LABELS[group]}: {name}", "kind": "journal-panel-part",
            "group": group, "width": a["width"], "height": a["height"], "hasAlphaChannel": True, "transparent": True,
            "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst), "originalPath": f"bitacora-panel-aprendizajes/{a['path']}",
            "recommendedDisplay": a["recommendedDisplaySize"],
        }

    docs = manifest.setdefault("sourceDocuments", [])
    for name, dest in (("README.md", "docs/source/journal-panel/readme.md"), ("docs/INTEGRACION.md", "docs/source/journal-panel/integracion.md"), ("generation-prompts.json", "docs/source/journal-panel/generation-prompts.json")):
        dst = os.path.join(ROOT, dest)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(kit, name), dst)
        docs.append({"path": dest, "originalPath": f"bitacora-panel-aprendizajes/{name}", "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst)})

    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append(
        "Añadidas las 11 piezas nuevas del panel de aprendizajes (kit bitacora-panel-aprendizajes): ver docs/source/journal-panel. Las piezas compartidas con el panel de insignias y las insignias del kit no se copian porque ya están en el proyecto. Las entradas anteriores no se modificaron."
    )
    existing_after = json.dumps({k: manifest["assets"][k] for k in list(manifest["assets"])[:n_before]}, ensure_ascii=False)
    assert existing_after == before, "se alteró una entrada existente"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"assets.json: {manifest['assetCount']} entradas, categorías {manifest['categoryCounts']}")


if __name__ == "__main__":
    main(sys.argv[1])
