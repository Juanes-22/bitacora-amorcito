#!/usr/bin/env python3
"""Indexa las pistas de música de fondo en public/assets SIN alterar ninguna entrada existente.

Herramienta de integración, fuera del build. Copia cada archivo conservando sus bytes (con un nombre sin espacios),
lo añade a `assets.json` (`category: "audio"`, `kind: "music"`) con `durationSeconds` (ffprobe) y `credit`, y
actualiza `assetCount`/`categoryCounts`. Los créditos con `verified: false` impiden la entrega final (SPEC 6.4).
Es idempotente: si los IDs ya existen, aborta.

Uso:  python3 scripts/tools/add-background-music.py CARPETA_CON_LAS_PISTAS
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")

# archivo de origen → (ID del catálogo, nombre de destino, etiqueta, crédito)
TRACKS = [
    (
        "Beyond The Clouds (Theme for Modern Broadcast).mp3", "audio.music.beyond-the-clouds", "beyond-the-clouds.mp3",
        "Música: Beyond The Clouds",
        {
            "title": "Beyond The Clouds (Theme for Modern Broadcast)", "artist": "Matthew Pablo", "license": "CC BY 3.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/3.0/", "sourceUrl": "https://opengameart.org/content/beyond-the-clouds-orchestral-theme",
            "attribution": "Música: «Beyond The Clouds» de Matthew Pablo (matthewpablo.com), licencia CC BY 3.0.", "verified": True,
        },
    ),
    (
        "Enchanted Festival.mp3", "audio.music.enchanted-festival", "enchanted-festival.mp3",
        "Música: Enchanted Festival",
        {
            "title": "Enchanted Festival", "artist": "Matthew Pablo", "license": "CC BY 3.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/3.0/", "sourceUrl": "https://opengameart.org/content/enchanted-festival",
            "attribution": "Música: «Enchanted Festival» de Matthew Pablo (matthewpablo.com), licencia CC BY 3.0.", "verified": True,
        },
    ),
    (
        "little town - orchestral.ogg", "audio.music.little-town-orchestral", "little-town-orchestral.ogg",
        "Música: Little Town (orquestal)",
        {
            # Sin etiquetas en el archivo; la página «Little Town» de bart (GPL 2.0/3.0, CC-BY-SA 3.0) no lista una versión
            # orquestal, así que autoría y licencia de ESTE archivo no están confirmadas.
            "title": "Little Town (orchestral)", "artist": "bart", "license": "Por confirmar",
            "sourceUrl": "https://opengameart.org/content/little-town", "attribution": "", "verified": False,
        },
    ),
]


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path])
    return round(float(out.strip()), 2)


def main(folder):
    manifest_path = os.path.join(ROOT, "assets.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    if any(t[1] in manifest["assets"] for t in TRACKS):
        sys.exit("Las pistas ya están en assets.json: nada que hacer.")
    before = json.dumps(manifest["assets"], ensure_ascii=False)
    n_before = len(manifest["assets"])
    for source, asset_id, dest_name, label, credit in TRACKS:
        src = os.path.join(folder, source)
        dest = f"audio/music/{dest_name}"
        dst = os.path.join(ROOT, dest)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        assert sha256(src) == sha256(dst), f"{dest}: la copia no es idéntica"
        ext = dest_name.rsplit(".", 1)[1]
        manifest["assets"][asset_id] = {
            "path": dest, "type": "audio", "format": ext, "category": "audio", "label": label, "kind": "music",
            "sizeBytes": os.path.getsize(dst), "sha256": sha256(dst), "originalPath": f"bitacora-music/{source}",
            "durationSeconds": duration(dst), "credit": credit,
        }
    counts = {}
    for a in manifest["assets"].values():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    manifest["assetCount"] = len(manifest["assets"])
    manifest["categoryCounts"] = dict(sorted(counts.items()))
    manifest.setdefault("notes", []).append("Añadidas tres pistas de música de fondo (category «audio»): ver `credit` de cada entrada y SPEC 6.4.")
    existing_after = json.dumps({k: manifest["assets"][k] for k in list(manifest["assets"])[:n_before]}, ensure_ascii=False)
    assert existing_after == before, "se alteró una entrada existente"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"assets.json: {manifest['assetCount']} entradas, categorías {manifest['categoryCounts']}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
