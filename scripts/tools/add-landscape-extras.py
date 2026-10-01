#!/usr/bin/env python3
"""Integra el kit «bitacora-landscape-extras» en public/assets SIN alterar ninguna entrada existente.

Herramienta de integración (Pillow), fuera del build. Copia los PNG y atlas conservando sus bytes, los indexa al
final de `assets.json` con IDs del catálogo (no los del kit) y conserva la metadata del kit. Las sugerencias de
movimiento del kit (`motionSuggestion`) se traducen al `motion` que interpreta la lógica (sway, pulse, drift,
particle, swim); `recommendedBlendMode`/`recommendedOpacity` pasan a `blendMode`/`opacity`. Es idempotente: si los
IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-landscape-extras.py RUTA_DEL_KIT_EXTRAIDO
"""
import hashlib
import json
import os
import shutil
import sys

from PIL import Image
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
KIT_NAME = "bitacora-landscape-extras"

# clave del kit → (ID del catálogo, categoría, kind, destino relativo a public/assets)
MAPPING = {
    "tree-fairy-lights": ("animation.light.fairy-lights", "effects", "animation-sheet", "animations/lights/tree-fairy-lights.png"),
    "gold-sparkle": ("animation.light.gold-sparkle", "effects", "animation-sheet", "animations/lights/gold-sparkle.png"),
    "duckling-swim": ("animation.fauna.duckling-swim", "effects", "animation-sheet", "animations/fauna/duckling-swim.png"),
    "white-duck-swim": ("animation.fauna.white-duck-swim", "effects", "animation-sheet", "animations/fauna/white-duck-swim.png"),
    "hanging-lantern": ("decoration.light.hanging-lantern", "decorations", "light-prop", "decorations/lights/hanging-lantern.png"),
    "warm-light-glow": ("decoration.light.warm-glow", "effects", "light-glow", "decorations/lights/warm-glow.png"),
    "tree-light-rays": ("decoration.light.tree-rays", "effects", "light-glow", "decorations/lights/tree-rays.png"),
    "firefly-mote": ("particle.firefly-mote", "effects", "particle", "particles/firefly-mote.png"),
    "pollen-speck": ("particle.pollen", "effects", "particle", "particles/pollen.png"),
    "cloud-small": ("background.sky.cloud-small", "backgrounds", "sky-element", "backgrounds/sky/cloud-small.png"),
    "cloud-long": ("background.sky.cloud-long", "backgrounds", "sky-element", "backgrounds/sky/cloud-long.png"),
}
DOCS = {
    "README.md": "docs/source/extras/readme-original.md",
    "assets.json": "docs/source/extras/assets-original.json",
    "generation-prompts.json": "docs/source/extras/generation-prompts.json",
}
KEEP = ["recommendedContentHeightPx", "contentBounds", "filter", "origin", "recommendedScale"]
KEEP_ATLAS = ["frameCount", "layout", "sourceFrameSize", "alignment"]


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def motion_of(k):
    """Traduce motionSuggestion del kit al `motion` del manifiesto (SPEC 3.2)."""
    m = k.get("motionSuggestion") or {}
    t = m.get("type")
    if t == "sway":
        a = m["angleDegrees"]
        return {"type": "sway", "angleDegrees": {"from": -a, "to": a}, "durationMs": m["durationMs"], "yoyo": True, "repeat": -1, "ease": "Sine.easeInOut"}
    if t == "pulse":
        return {"type": "pulse", "alphaMin": m["alphaMin"], "alphaMax": m["alphaMax"], "durationMs": m["durationMs"]}
    if t == "drift":
        return {"type": "drift", "direction": "right", "speedPxPerSecond": m["speedPxPerSecond"], "wrapAtMapEdge": True}
    if t == "particle":
        lo, hi = m["lifespanMs"]
        v = m["speedPxPerSecond"][1]
        # El kit solo da una rapidez: flota en cualquier sentido, con menos recorrido vertical que horizontal.
        return {"type": "particle", "lifespanMs": lo, "lifespanMaxMs": hi, "speedX": {"min": -v, "max": v}, "speedY": {"min": -v / 2, "max": v / 2}}
    if t == "swim":
        return {"type": "swim", "speedPxPerSecond": round(m["distancePx"] / (m["durationMs"] / 1000), 2)}
    return None


def main(kit):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    kit_manifest = json.load(open(os.path.join(kit, "assets.json"), encoding="utf-8"))
    ids = [v[0] for v in MAPPING.values()]
    if any(i in manifest["assets"] for i in ids):
        sys.exit("Los IDs del kit ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])

    def copy(src_rel, dst_rel):
        src, dst = os.path.join(kit, src_rel), os.path.join(ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dst_rel}: la copia no es idéntica"
        return dst

    for key, (asset_id, category, kind, dest) in MAPPING.items():
        k = kit_manifest["assets"][key]
        dst = copy(os.path.join("assets", k["path"][len("assets/"):]) if k["path"].startswith("assets/") else k["path"], dest)
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
        entry["blendMode"] = k["recommendedBlendMode"]
        entry["opacity"] = k["recommendedOpacity"]
        motion = motion_of(k)
        if motion:
            entry["motion"] = motion
        if k["type"] == "atlas":
            atlas_dest = dest.replace(".png", ".atlas.json")
            copy(k["atlasPath"], atlas_dest)
            entry["atlasPath"] = atlas_dest
            for name in KEEP_ATLAS:
                entry[name] = k[name]
            a = k["animation"]
            # La clave de la animación se deriva del ID del catálogo en tiempo de ejecución.
            entry["animation"] = {"frameNames": a["frameNames"], "frameRate": a["frameRate"], "repeat": a["repeat"]}
            for name in ("facing", "flipForLeft"):
                if name in k:
                    entry[name] = k[name]
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
    manifest.setdefault("notes", []).append(
        "Añadido el kit de piezas adicionales del paisaje (11 imágenes, 4 atlas): ver docs/source/extras/. Las entradas anteriores no se modificaron."
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
