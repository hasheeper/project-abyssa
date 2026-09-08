#!/usr/bin/env python3
"""Rebuild display derivatives from untouched PNGs. Requires Pillow.

This is deterministic resampling and mild sharpening, not AI reconstruction.
Keep the original ratio: shot-specific 16:9 framing is authored in script.ts.
"""

import hashlib
import json
import random
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1] / "src/assets/cg/prologue"
MANIFEST = ROOT / "manifest.json"


def main():
    entries = json.loads(MANIFEST.read_text())
    for entry in entries:
        original = ROOT / "sources" / Path(entry["file"]).with_suffix(".png")
        digest = hashlib.sha256(original.read_bytes()).hexdigest()
        if digest != entry["sourceSha256"]:
            raise ValueError(f"Original changed: {original.name}")
        with Image.open(original) as source:
            source = source.convert("RGB")
            width, height = source.size
            display = source.resize((width * 2, height * 2), Image.Resampling.LANCZOS)
        # Sharpen luminance only, with a threshold that leaves flat paint/noise alone.
        y, cb, cr = display.convert("YCbCr").split()
        y = y.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=3))
        display = Image.merge("YCbCr", (y, cb, cr)).convert("RGB")
        destination = ROOT / entry["file"]
        display.save(destination, "WEBP", quality=96, method=6)
        entry.update({
            "sourceWidth": width,
            "sourceHeight": height,
            "width": display.width,
            "height": display.height,
            "processing": "lanczos-2x-luma-usm-r1.2-p55-t3-webp-q96-v1",
            "runtimeBytes": destination.stat().st_size,
            "runtimeSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        })
        print(f"{destination.name}: {display.width}x{display.height}, {entry['runtimeBytes']:,} bytes")
    MANIFEST.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")
    print(f"Total: {sum(e['runtimeBytes'] for e in entries) / 1024**2:.2f} MiB")
    # A fixed neutral grain plate shared by all shots, not per-frame noise.
    rng = random.Random(8192)
    grain = Image.new("L", (512, 512))
    grain.putdata([max(0, min(255, round(rng.gauss(128, 31)))) for _ in range(512**2)])
    grain = Image.blend(grain, grain.filter(ImageFilter.GaussianBlur(4)), .16)
    (ROOT / "finish").mkdir(exist_ok=True)
    grain.save(ROOT / "finish/record-grain.webp", "WEBP", lossless=True, method=6)


if __name__ == "__main__":
    main()
