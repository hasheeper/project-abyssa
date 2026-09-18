#!/usr/bin/env python3
"""Prepare the shop's quiet wood-grain sample from its existing background.

Requires Pillow + numpy; runs offline, never in the game. The original image
is read-only. Run with --check to verify the checked-in output without writes.
"""
from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/assets/backgrounds/shop.png"
OUTPUT = ROOT / "src/assets/ui/shop/wood-grain-v1.webp"
SIZE = (655, 58)


def soften_seam(values, axis, width):
    """Blend only tile margins; do not mirror the whole wood pattern."""
    result = np.moveaxis(values.copy(), axis, 0)
    for offset in range(width):
        weight = (1 - offset / width) ** 2
        average = (result[offset] + result[-1 - offset]) / 2
        result[offset] += (average - result[offset]) * weight
        result[-1 - offset] += (average - result[-1 - offset]) * weight
    return np.moveaxis(result, 0, axis)


def material():
    with Image.open(SOURCE) as source:
        # A joint-free section inside one original plank: no flooring seams,
        # corner vignette, or other UI imagery is included in this material.
        grain = source.convert("L").crop((30, 135, 88, 790))
    grain = grain.transpose(Image.Transpose.ROTATE_90)
    # Native pixels throughout: the earlier shrink/blur/enlarge path made the
    # grain look muddy. Subtract only broad illumination, never blur the output.
    original = np.asarray(grain, dtype=float)
    lighting = np.asarray(grain.filter(ImageFilter.GaussianBlur(8)), dtype=float)
    detail = original - lighting
    detail /= max(detail.std(), 1)
    value = 2.0 * detail
    value = soften_seam(soften_seam(value, 0, 6), 1, 24)
    value = np.clip(value, -6, 6)
    rgb = np.array([35, 26, 17]) + value[:, :, None] * np.array([1.0, .86, .66])
    return Image.fromarray(np.rint(np.clip(rgb, 0, 255)).astype(np.uint8))


def prepare(check=False):
    result = material()
    encoded = BytesIO()
    result.save(encoded, "WEBP", lossless=True, method=6)
    pixels = np.asarray(result)
    assert result.size == SIZE
    assert np.array_equal(pixels[0], pixels[-1]), "vertical tile seam"
    assert np.array_equal(pixels[:, 0], pixels[:, -1]), "horizontal tile seam"
    assert 1.0 < pixels[:, :, 0].std() < 2.5, "material contrast out of range"
    # Keep pixel-level grain, not broad blurred patches. Low contrast is not blur.
    assert np.abs(np.diff(pixels[:, :, 0].astype(float), axis=0)).mean() > .65, "grain lost its fine detail"
    if check:
        with Image.open(OUTPUT) as saved:
            assert np.array_equal(np.asarray(saved.convert("RGB")), pixels), "stale wood material"
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_bytes(encoded.getvalue())
    print(f'{"Checked" if check else "Prepared"} {OUTPUT.relative_to(ROOT)}: '
          f'{SIZE[0]}x{SIZE[1]}, {len(encoded.getvalue())} bytes')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    prepare(parser.parse_args().check)
