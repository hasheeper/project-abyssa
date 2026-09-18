#!/usr/bin/env python3
"""Non-destructive material pass over the original mansion PNG layers.

Needs Pillow and numpy. Originals and the PSD are never overwritten. This is
an offline asset operation, not a live canvas/filter stage in the game.

    python3 scripts/prepare-mansion-materials.py
    python3 scripts/prepare-mansion-materials.py --check

Coordinates in mansion-materials.json are native layer pixels. The masks only
remove the baked daylight from glazing; they are intersected with colour and
luminance keys so dark ink, mullions, curtains and plant silhouettes survive.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public/mansion-map"
RULES_PATH = Path(__file__).with_name("mansion-materials.json")
SUFFIX = "-materials-v1"


def polygon_mask(size, polygons, feather=0):
    # Supersample only the mask; original image pixels are never resampled.
    scale = 3
    image = Image.new("L", (size[0] * scale, size[1] * scale))
    draw = ImageDraw.Draw(image)
    for polygon in polygons:
        draw.polygon([(round(x*scale), round(y*scale)) for x, y in polygon], fill=255)
    image = image.resize(size, Image.Resampling.LANCZOS)
    if feather:
        image = image.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(image, dtype=np.float32) / 255


def ramp(value, start, end):
    value = np.clip((value-start)/(end-start), 0, 1)
    return value*value*(3-2*value)


def daylight_key(rgb):
    r, g, b = np.moveaxis(rgb, -1, 0)
    # The painted blue-white sky is the target, not cream walls or brown wood.
    return ramp(np.minimum(g, b)-r, 3, 17) * ramp(rgb.mean(axis=2), 116, 177)


def process_layer(layer_id, source, rules):
    rgba = np.array(source, dtype=np.float32)
    rgb, alpha = rgba[:, :, :3], rgba[:, :, 3]
    # Glazing also contains near-neutral white reflections (salon sides and
    # the annex herb window). Include these only within hand-traced windows.
    key = np.maximum(daylight_key(rgb), ramp(rgb.min(axis=2), 156, 191))
    mask = polygon_mask(source.size, rules["glass"].get(layer_id, []))
    mask *= 1-polygon_mask(source.size, rules["glass_protect"].get(layer_id, []))
    # Keep a visible, lightly milky pane, not an open hole. Around 40% of the
    # painted glass remains at its clearest point, with stronger edge texture.
    alpha *= 1 - .60 * mask * key

    greenhouse = rules["greenhouse"]
    if layer_id == greenhouse["layer"]:
        panes = polygon_mask(source.size, greenhouse["panes"])
        protect = polygon_mask(source.size, greenhouse["protect"])
        # A little more reflection than room glazing; all two luminous herbs
        # and their pots are explicit exclusions, even when cyan or yellow.
        alpha *= 1 - .50 * panes * (1-protect) * daylight_key(rgb)

    wall = rules["rear_wall"]
    if layer_id == wall["layer"]:
        r, g, b = np.moveaxis(rgb, -1, 0)
        stone = (ramp(np.minimum(g, b)-r, 1, 9)
                 * (1-ramp(np.abs(g-b), 9, 22))
                 * ramp(rgb.mean(axis=2), 100, 150))
        strength = polygon_mask(source.size, wall["regions"], 6) * stone * (1-protect)
        # The wall remains opaque: lower its baked white illumination instead
        # of letting stars/clouds show through masonry or behind the bench.
        rgb *= (1-.19*strength[:, :, None])

    foliage = rules["rear_foliage"]
    if layer_id == foliage["layer"]:
        r, g, b = np.moveaxis(rgb, -1, 0)
        leaf = ramp(g-r, 2, 13) * ramp(g-b, 7, 24) * ramp(rgb.mean(axis=2), 73, 132)
        strength = polygon_mask(source.size, foliage["regions"], 9) * leaf * (1-protect)
        rgb *= (1-.13*strength[:, :, None])
        # Only distant pale leaf masses admit a small amount of ambient sky.
        # Trunks, near plants and dark silhouette detail retain full opacity.
        alpha *= 1-.06*strength

    return Image.fromarray(np.rint(np.clip(rgba, 0, 255)).astype(np.uint8))


def prepare(check=False):
    rules = json.loads(RULES_PATH.read_text())
    manifest = json.loads((ASSETS / "manifest.json").read_text())
    targets = set(rules["glass"]) | {rules[key]["layer"] for key in ["greenhouse", "rear_wall", "rear_foliage"]}
    composite = Image.new("RGBA", (manifest["width"], manifest["height"]))
    errors = []
    counts = {}
    for layer in sorted(manifest["layers"], key=lambda layer: layer["order"]):
        # Always read the untouched PSD export, including on repeat runs.
        original = ASSETS / "layers" / f'{layer["id"]}.png'
        source = Image.open(original).convert("RGBA")
        if layer["id"] in targets:
            result = process_layer(layer["id"], source, rules)
            dest = original.with_stem(original.stem+SUFFIX)
            layer["src"] = dest.relative_to(ASSETS).as_posix()
            before, after = np.asarray(source), np.asarray(result)
            changed = np.any(before != after, axis=2)
            counts[layer["id"]] = int(np.count_nonzero(changed))
            # Pixels outside visible art remain byte-identical, including
            # straight-alpha white RGB in fully transparent exported pixels.
            if np.any(changed & (before[:, :, 3] == 0)):
                errors.append(f'{layer["id"]}: changed transparent source pixels')
            if check:
                if not dest.exists() or not np.array_equal(np.asarray(Image.open(dest).convert("RGBA")), after):
                    errors.append(f"stale asset: {dest.relative_to(ROOT)}")
            else:
                result.save(dest, optimize=True)
        else:
            result = source
        if layer["visible"]:
            if layer["opacity"] != 1:
                result = result.copy()
                result.putalpha(result.getchannel("A").point(lambda a: round(a * layer["opacity"])))
            composite.alpha_composite(result, (layer["x"], layer["y"]))
    dest = ASSETS / "composite-materials-v1.png"
    if check:
        if not dest.exists() or not np.array_equal(np.asarray(Image.open(dest).convert("RGBA")), np.asarray(composite)):
            errors.append("stale material composite")
    else:
        composite.save(dest, optimize=True)
    manifest_path = ASSETS / "manifest-materials-v1.json"
    if check:
        if not manifest_path.exists() or json.loads(manifest_path.read_text()) != manifest:
            errors.append("stale material manifest")
    else:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"changed_pixels": counts, "rules_sha256": hashlib.sha256(RULES_PATH.read_bytes()).hexdigest(), "errors": errors}, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    prepare(parser.parse_args().check)
