#!/usr/bin/env /usr/bin/python3
"""Export one traceable visual reference for each mansion AVG location."""

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / "public/mansion-map"
LAYER_BY_LOCATION = {
    "hall": "layer-06", "kitchen": "layer-08", "dining": "layer-03",
    "salon": "layer-04", "foyer": "layer-05", "bath": "layer-16",
    "lounge": "layer-12", "abyssa": "layer-19", "terrace": "layer-20",
    "attic": "layer-24", "armory": "layer-25", "workshop": "layer-17",
    "storage": "layer-18", "laundry": "layer-10", "maid": "layer-11",
    "cellar": "layer-09", "library": "layer-13", "array": "layer-14",
    "seal": "layer-15", "tibby": "layer-22",
}
# Original composite coordinates: x, y, width, height. These are visual
# reference crops, not replacement hitboxes or assertions about unseen rooms.
CROP_BY_LOCATION = {
    "dock": (0, 1450, 470, 300),
    "towerTop": (1071, 0, 333, 366),
    "towerHall": (1137, 365, 241, 969),
    "kaelHut": (3636, 1047, 290, 174),
    "plaza": (4018, 1095, 237, 149),
    "eustice": (4280, 879, 200, 166),
    "norma": (4493, 879, 201, 166),
    "elora": (4278, 1060, 201, 165),
    "kororo": (4494, 1060, 212, 165),
    "gate": (4737, 604, 425, 741),
    "greenhouse": (3183, 989, 267, 254),
}


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    target = args.output.resolve()
    refs_dir = target / "references"
    refs_dir.mkdir(parents=True, exist_ok=True)

    region_text = (ROOT / "src/content/mansion/defaultRegions.ts").read_text()
    region_ids = set(re.findall(r'(?:rectangle|polygon)\("([^\"]+)"', region_text))
    mappings = {**LAYER_BY_LOCATION, **CROP_BY_LOCATION}
    if len(region_ids) != 31 or region_ids != set(mappings):
        raise SystemExit(f"Location mapping mismatch: missing={region_ids-set(mappings)}, extra={set(mappings)-region_ids}")

    source_manifest = json.loads((MAP / "manifest.json").read_text())
    layers = {item["id"]: item for item in source_manifest["layers"]}
    composite_path = MAP / "composite-reference.png"
    composite = Image.open(composite_path)
    records = []
    for location_id in sorted(region_ids):
        dest = refs_dir / f"{location_id}.png"
        if location_id in LAYER_BY_LOCATION:
            layer = layers[LAYER_BY_LOCATION[location_id]]
            if not layer["visible"]:
                raise SystemExit(f"Hidden layer selected: {location_id}")
            source = MAP / layer["src"]
            if dest.exists() and sha256(dest) != sha256(source):
                raise SystemExit(f"Existing reference differs; inspect before replacing: {dest}")
            if not dest.exists():
                shutil.copyfile(source, dest)
            provenance = {"type": "original-layer", "path": str(source.relative_to(ROOT)),
                          "layer": layer["id"], "mapPosition": [layer["x"], layer["y"]]}
        else:
            x, y, width, height = CROP_BY_LOCATION[location_id]
            if x < 0 or y < 0 or x + width > composite.width or y + height > composite.height:
                raise SystemExit(f"Crop outside composite: {location_id}")
            crop = composite.crop((x, y, x + width, y + height))
            if dest.exists():
                with Image.open(dest) as existing:
                    if existing.size != crop.size or existing.tobytes() != crop.tobytes():
                        raise SystemExit(f"Existing reference differs; inspect before replacing: {dest}")
            else:
                crop.save(dest, optimize=True)
            provenance = {"type": "composite-crop", "path": str(composite_path.relative_to(ROOT)),
                          "crop": [x, y, width, height]}
        with Image.open(dest) as exported:
            width, height = exported.size
        records.append({"locationId": location_id,
                        "label": "娱乐室（棋牌室）" if location_id == "lounge" else location_id,
                        "reference": f"references/{location_id}.png",
                        "source": provenance, "width": width, "height": height,
                        "sha256": sha256(dest)})

    payload = {"version": 1, "purpose": "Mansion AVG background reference only",
               "sourceMap": str(composite_path.relative_to(ROOT)),
               "sourceMapSha256": sha256(composite_path), "locations": records}
    manifest_path = target / "reference-manifest.json"
    manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    # The second prompt version edits this empty landscape canvas while the
    # original room is passed separately as a design reference. This avoids
    # making the small frontal PSD crop the image-edit target.
    canvas_path = target / "blank-16x9-canvas.png"
    if not canvas_path.exists():
        Image.new("RGB", (1280, 720), "#ffffff").save(canvas_path, optimize=True)
    print(f"Prepared {len(records)} references: {manifest_path}")
    print("Samples:", ", ".join(f"{record['locationId']}={record['width']}x{record['height']}"
                                 for record in records if record["locationId"] in {"hall", "elora", "library", "lounge"}))


if __name__ == "__main__":
    main()
