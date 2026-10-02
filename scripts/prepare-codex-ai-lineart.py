#!/usr/bin/env python3
"""Package an inspected AI white-background line drawing, without extracting edges."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
LINE_RGB = (190, 190, 175)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def balance_strokes(mask):
    """Match fine-line contrast without thinning the original AI strokes."""
    ink = np.asarray(mask, dtype=np.float64) / 255
    distance = ndimage.distance_transform_edt(ink > .18)
    ridges = (distance > 0) & (distance == ndimage.maximum_filter(distance, size=3))
    reference = max(2.5, float(np.percentile(distance[ridges] * 2, 85)))
    width = ndimage.maximum_filter(distance, size=5) * 2
    weight = np.clip((width - 2) / (reference - 2), 0, 1)
    weight = weight * weight * (3 - 2 * weight)
    peak = ndimage.maximum_filter(ink, size=3)
    # Match thin-line contrast even when one model drew it black and another gray.
    coverage = np.divide(ink, peak, out=np.zeros_like(ink), where=peak > .01)
    visibility = np.clip((ink - .025) / .075, 0, 1)
    matched = coverage * (.82 + .18 * weight) * visibility
    balanced = .6 * ink + .4 * matched
    return Image.fromarray(np.round(np.clip(balanced, 0, 1) * 255).astype(np.uint8))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    raw = args.input.resolve()
    source = args.source.resolve()
    image = Image.open(raw).convert("RGBA")
    pixels = np.asarray(image, dtype=np.float32) / 255
    # Coverage of dark ink on white. Keep all original antialiasing and stroke weights.
    # This step does not infer structure or add contours, hatching, wash, or glow.
    luminance = pixels[..., :3] @ np.array([.2126, .7152, .0722])
    # Ignore the near-white background variation from image generation.
    white = 250 / 255
    coverage = np.clip((white - luminance) / white, 0, 1) * pixels[..., 3]
    alpha = np.round(coverage * 255).astype(np.uint8)
    if int(alpha.max()) < 32:
        raise ValueError("No usable dark linework found; inspect the AI output")
    rgba = np.empty((*alpha.shape, 4), dtype=np.uint8)
    rgba[..., :3] = LINE_RGB
    rgba[..., 3] = alpha
    master = Image.fromarray(rgba)
    folder = ROOT / "src/assets/codex/ai-observations"
    folder.mkdir(parents=True, exist_ok=True)
    outputs = []
    ys, xs = np.nonzero(alpha > 8)
    crop = [max(0, int(xs.min()) - 2), max(0, int(ys.min()) - 2),
            min(image.width, int(xs.max()) + 3), min(image.height, int(ys.max()) + 3)]
    for suffix, max_size in [("", (1100, 800)), (".thumb", (164, 124))]:
        # Resize only coverage; a constant RGB avoids dark fringes at transparent edges.
        # Fit visible linework rather than the AI canvas's blank margins.
        # Keep antialiasing around the complete drawing, including attached props.
        mask = Image.fromarray(alpha).crop(crop)
        padding = 2 if suffix else 6
        mask.thumbnail(tuple(edge - 2 * padding for edge in max_size), Image.Resampling.LANCZOS)
        if args.asset_id.startswith("enemy.outlaw."):
            mask = balance_strokes(mask)
        if padding:
            padded = Image.new("L", (mask.width + 2 * padding, mask.height + 2 * padding))
            padded.paste(mask, (padding, padding))
            mask = padded
        result = Image.new("RGBA", mask.size, (*LINE_RGB, 0))
        result.putalpha(mask)
        if not suffix:
            main_alpha = np.asarray(mask)
        path = folder / f"{args.asset_id}{suffix}.webp"
        result.save(path, "WEBP", lossless=True, exact=True)
        outputs.append({"file": path.name, "size": list(result.size), "sha256": digest(path)})
    master_path = raw.with_name(raw.stem + ".transparent.png")
    master.save(master_path)
    main_coverage = main_alpha.astype(np.float64) / 255
    main_height, main_width = main_alpha.shape
    main_ys = np.nonzero(main_alpha > 8)[0]
    total = main_coverage.sum()
    center = [float((main_coverage * np.arange(main_width)[None, :]).sum() / total / main_width),
              float((main_coverage * np.arange(main_height)[:, None]).sum() / total / main_height)]
    record = {
        "assetId": args.asset_id, "status": "ai-sample-awaiting-user-review",
        "source": str(source.relative_to(ROOT)), "sourceSha256": digest(source),
        "aiOriginal": str(raw.relative_to(ROOT)), "aiOriginalSha256": digest(raw),
        "generationRecord": str(raw.with_suffix(".attempt.json").relative_to(ROOT)),
        "process": "white-to-alpha-v4-contrast-balance" if args.asset_id.startswith("enemy.outlaw.") else "white-to-alpha-v2-tight-crop", "lineRgb": LINE_RGB,
        "exportCropBounds": crop,
        "sourceSize": list(image.size), "alphaBounds": [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
        "visualCenter": center, "groundAnchor": float((main_ys.max() + 1) / main_height),
        "exportPaddingPixels": {"main": 6, "thumbnail": 2},
        "outputs": outputs,
    }
    if args.asset_id.startswith("enemy.outlaw."):
        record["strokeBalance"] = {"source": "existing AI ink only", "width": "original AI width preserved",
                                  "contrastMatchBlend": .4, "detailPeakTarget": .82, "primaryPeakTarget": 1.0}
    manifest = folder / "sources.json"
    data = json.loads(manifest.read_text()) if manifest.exists() else {"assets": []}
    data["assets"] = [x for x in data["assets"] if x["assetId"] != args.asset_id] + [record]
    manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(record, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
