#!/usr/bin/env python3
"""Prepare the map dossier's paper, sepia prints and stamp grain.

The paper is cut from the map's own parchment (one shade lighter), so the
dossier and the map read as the same sheet stock. Prints are inked for
mix-blend-mode: multiply: near-white highlights let the paper show through.
A shared alpha mask dissolves every print into the sheet at a ragged edge, so
it reads as printed into the paper rather than a framed picture pasted on it.
The mask stays separate from the prints: the page stretches it over whatever
height the print gets, so a print cropped shorter still has no hard edge.

Requires Pillow + numpy; runs offline, never in the game. Sources are
read-only. Run with --check to verify the checked-in outputs without writes.
"""
from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/assets/map/dossier"
# name: (source, vertical focus of the crop, cinnabar spot ink)
PRINTS = {
    "weathered-sanctum": (ROOT / "src/assets/map/quest-backgrounds/weathered-sanctum.jpg", .3, False),
    "abandoned-watchtower": (ROOT / "src/assets/map/quest-backgrounds/abandoned-watchtower.jpg", .36, False),
    "tidecall-grotto": (ROOT / "src/assets/map/quest-backgrounds/tidecall-grotto.jpg", .5, False),
    # The manor's red threads are its story motif; they survive as a cinnabar spot ink.
    "old-manor-hall": (ROOT / "src/assets/backgrounds/old-manor/welcoming-hall.jpg", .18, True),
}
GROUND = ROOT / "src/assets/map/terrain/watchers-cliff-ground.png"
# The ground's clean top-left parchment (rows, cols), clear of the coastline.
GROUND_CLEAN = (slice(6, 446), slice(8, 648))
PRINT_SIZE = (960, 400)
MASK_SIZE = (480, 200)
# How far in from each side (left, top, right, bottom) the print takes to
# dissolve, as a fraction of that side. The foot runs longest so the text
# below can rise out of it.
FADE = (.13, .17, .13, .27)
PAPER_SIZE = (880, 1280)
GRAIN_SIZE = (256, 256)
# Ink → wash → bare paper. Under multiply the white end is the dossier paper
# itself, so a print reads as printed on the sheet, not pasted over it.
RAMP = np.array([[40, 26, 14], [112, 80, 50], [190, 158, 118], [255, 251, 242]], dtype=float)
RAMP_AT = np.array([0, .36, .68, 1])
CINNABAR = np.array([168, 52, 34], dtype=float)


def ramp(value):
    """Gradient-map a 0..1 luminance through the sepia ink ramp."""
    channels = [np.interp(value, RAMP_AT, RAMP[:, i]) for i in range(3)]
    return np.stack(channels, axis=-1)


def periodic_noise(size, sigma, seed):
    """Gaussian-blurred noise on a torus, so the tile repeats without seams."""
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(size[::-1])
    fy = np.fft.fftfreq(size[1])[:, None]
    fx = np.fft.fftfreq(size[0])[None, :]
    kernel = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    field = np.real(np.fft.ifft2(np.fft.fft2(noise) * kernel))
    return field / max(field.std(), 1e-6)


def print_crop(image, focus):
    """Crop a painting to the print's aspect, keeping the given vertical focus."""
    w, h = image.size
    crop_h = round(w * PRINT_SIZE[1] / PRINT_SIZE[0])
    top = round((h - crop_h) * focus)
    return image.crop((0, top, w, top + crop_h))


def print_mask():
    """Where the ink holds: solid in the middle, thinning out towards a ragged
    edge in broad lobes, with a dry-brush tooth along the way. Alpha only."""
    w, h = MASK_SIZE
    y, x = np.mgrid[0:h, 0:w] + .5
    reach = np.stack([x / (w * FADE[0]), y / (h * FADE[1]), (w - x) / (w * FADE[2]), (h - y) / (h * FADE[3])])
    # Soft minimum: the corners round off instead of meeting at a mitre.
    depth = -np.log(np.exp(-reach * 4).sum(axis=0)) / 4
    # The lobes scale with depth, so the outermost rim always stays bare paper.
    depth = depth * (1 + periodic_noise(MASK_SIZE, 23, 50) * .2) + periodic_noise(MASK_SIZE, 1.1, 51) * .028 - .04
    t = np.clip(depth, 0, 1)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 3] = np.uint8(np.rint(t * t * (3 - 2 * t) * 255))
    return Image.fromarray(rgba)


def red_spot(source, focus, size):
    """Thin red strokes, measured at full size before they blur into the paint."""
    with Image.open(source) as image:
        rgb = np.asarray(print_crop(image.convert("RGB"), focus), dtype=float) / 255
    mask = np.clip((rgb[:, :, 0] - rgb[:, :, 1:].max(axis=2) - .045) / .09, 0, 1)
    mask = Image.fromarray(np.uint8(mask * 255)).resize(size, Image.Resampling.BOX).filter(ImageFilter.GaussianBlur(.6))
    return np.clip(np.asarray(mask, dtype=float) / 255 * 2.2, 0, 1)[:, :, None]


def sepia_print(source, focus, spot):
    size = PRINT_SIZE
    with Image.open(source) as image:
        image = print_crop(image.convert("RGB"), focus).resize(size, Image.Resampling.LANCZOS)
    rgb = np.asarray(image, dtype=float) / 255
    lum = rgb @ np.array([.299, .587, .114])
    # The paintings are night scenes; stretch their own range before the ramp
    # so stone, water and light keep separate tones on paper.
    low, high = np.percentile(lum, [1, 99.6])
    lum = np.clip((lum - low) / max(high - low, 1e-6), 0, 1) ** .78
    # Local contrast in the manner of an etched plate: lift edges, not noise.
    blur = np.asarray(Image.fromarray(np.uint8(lum * 255)).filter(ImageFilter.GaussianBlur(14)), dtype=float) / 255
    lum = np.clip(lum + (lum - blur) * .55, 0, 1)
    grain = periodic_noise(size, .9, 7) * .018
    lum = np.clip(lum + grain, 0, 1)
    out = ramp(lum)
    if spot:
        weight = red_spot(source, focus, size) * .85
        shade = out.mean(axis=2, keepdims=True) / 255
        out = out * (1 - weight) + CINNABAR * (.55 + .6 * shade) * weight
    return Image.fromarray(np.uint8(np.clip(np.rint(out), 0, 255)))


def srgb_to_lab(rgb):
    c = rgb / 255
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[.4124, .2126, .0193], [.3576, .7152, .1192], [.1805, .0722, .9505]])
    xyz /= np.array([.95047, 1, 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def lab_to_srgb(lab):
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], axis=-1)
    xyz = np.where(f > .2069, f ** 3, (f - 16 / 116) / 7.787) * np.array([.95047, 1, 1.08883])
    c = xyz @ np.array([[3.2406, -.9689, .0557], [-1.5372, 1.8758, -.2040], [-.4986, .0415, 1.0570]])
    c = np.where(c > .0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - .055, 12.92 * c)
    return np.clip(c, 0, 1) * 255


def paper_sheet():
    """The map's own parchment, stood upright and lifted one shade.

    Stains, folds and fibres all come from the map; only the tone moves, so
    the dossier is visibly the same stock as the sheet it lies on."""
    with Image.open(GROUND) as image:
        ground = np.asarray(image.convert("RGB"), dtype=float)[GROUND_CLEAN]
    lab = srgb_to_lab(ground)
    mean = lab.reshape(-1, 3).mean(axis=0)
    # Lighter and calmer: stains keep ~70% of their depth, the hue stays warm.
    lab[..., 0] = 85.5 + (lab[..., 0] - mean[0]) * .7
    lab[..., 1] = 2.4 + (lab[..., 1] - mean[1]) * .62
    lab[..., 2] = 21 + (lab[..., 2] - mean[2]) * .62
    sheet = Image.fromarray(np.uint8(np.rint(lab_to_srgb(lab)))).rotate(90, expand=True)
    sheet = sheet.resize(PAPER_SIZE, Image.Resampling.LANCZOS)
    # The map is 1x; at 2x add the fine tooth a closer look would show.
    tooth = periodic_noise(PAPER_SIZE, .55, 31) * 1.6 + periodic_noise(PAPER_SIZE, 1.6, 32) * 1.1
    rgb = np.asarray(sheet, dtype=float) + tooth[:, :, None] * np.array([1.0, .94, .82])
    return Image.fromarray(np.uint8(np.clip(np.rint(rgb), 0, 255)))


def stamp_grain():
    """Alpha tile for rubber-stamp ink: mostly solid, with pits and starved
    patches where the paper's tooth refused the ink."""
    pits = periodic_noise(GRAIN_SIZE, .8, 41)
    starve = periodic_noise(GRAIN_SIZE, 9, 42)
    alpha = np.clip(1.15 - np.clip(pits - .9, 0, None) * .9 - np.clip(starve - .55, 0, None) * .55, 0, 1)
    rgba = np.zeros((*GRAIN_SIZE[::-1], 4), dtype=np.uint8)
    rgba[..., 3] = np.uint8(np.rint(alpha * 255))
    return Image.fromarray(rgba)


def encode(image, lossless=False, quality=84):
    data = BytesIO()
    image.save(data, "WEBP", lossless=lossless, quality=quality, method=6)
    return data.getvalue()


def outputs():
    yield OUT / "paper-v2.webp", encode(paper_sheet(), quality=80)
    yield OUT / "stamp-grain-v1.webp", encode(stamp_grain(), lossless=True)
    yield OUT / "print-mask-v1.webp", encode(print_mask(), lossless=True)
    for name, (source, focus, spot) in PRINTS.items():
        yield OUT / f"print-{name}.webp", encode(sepia_print(source, focus, spot))


def verify(path, data):
    with Image.open(BytesIO(data)) as image:
        size = image.size
        alpha = np.asarray(image.convert("RGBA"), dtype=float)[:, :, 3]
        pixels = np.asarray(image.convert("RGB"), dtype=float)
    if path.name.startswith("paper"):
        assert size == PAPER_SIZE
        r, g, b = (pixels[:, :, i].mean() for i in range(3))
        assert r > g > b, "paper must stay warm"
        assert 195 < pixels.mean(axis=2).mean() < 225, "paper must be one shade lighter than the map"
        assert 4 < pixels.mean(axis=2).std() < 16, "paper lost its stains and folds"
    elif path.name.startswith("stamp-grain"):
        assert size == GRAIN_SIZE
        assert .8 < alpha.mean() / 255 < .97, "stamp grain should be mostly solid ink"
    elif path.name.startswith("print-mask"):
        assert size == MASK_SIZE
        rim = np.concatenate([alpha[:2].ravel(), alpha[-2:].ravel(), alpha[:, :2].ravel(), alpha[:, -2:].ravel()])
        assert rim.max() < 24, "mask rim must be bare paper"
        h, w = alpha.shape
        assert alpha[h // 3:h // 2, w // 3:w * 2 // 3].min() > 250, "mask centre must hold the ink"
    else:
        assert size == PRINT_SIZE
        r, g, b = (pixels[:, :, i].mean() for i in range(3))
        assert r > g > b, "print must stay sepia"
        assert pixels.mean(axis=2).std() > 28, "print lost its tonal range"
        assert pixels.max() > 240, "print highlights must reach near white to let the paper through"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for path, data in outputs():
        verify(path, data)
        if args.check:
            assert path.exists(), f"missing {path.relative_to(ROOT)}"
            verify(path, path.read_bytes())
        else:
            path.write_bytes(data)
        print(("ok " if args.check else "wrote ") + str(path.relative_to(ROOT)), len(data))


if __name__ == "__main__":
    main()
