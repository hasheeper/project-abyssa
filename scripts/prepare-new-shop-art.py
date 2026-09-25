"""Remove a connected matte without punching out the object's enclosed details.

Usage: python prepare-new-shop-art.py source.png output.png [--matte black] [--keep-largest]
Requires Pillow, NumPy and SciPy. The source image is never modified.
"""
import argparse
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("destination", type=Path)
parser.add_argument("--matte", choices=("white", "black"), default="white")
parser.add_argument("--keep-largest", action="store_true", help="Keep the main object, dropping detached lettering and background specks.")
args = parser.parse_args()
source, destination = args.source, args.destination
image = Image.open(source).convert("RGB")
rgb = np.asarray(image, dtype=np.float32)
low, high = rgb.min(axis=2), rgb.max(axis=2)


def outside(mask):
    seed = np.zeros(mask.shape, dtype=bool)
    seed[0] = mask[0]
    seed[-1] = mask[-1]
    seed[:, 0] |= mask[:, 0]
    seed[:, -1] |= mask[:, -1]
    return ndimage.binary_propagation(seed, mask=mask)


# Only border-connected matte is removed; enclosed highlights and ink remain.
if args.matte == "black":
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]))
    matte = np.median(border, axis=0)
    background = outside((high < 16) & (high - low < 6))
    soft_outside = outside((high < 30) & (high - low < 12))
else:
    matte = np.full(3, 255, dtype=np.float32)
    background = outside((low > 250) & (high - low < 6))
    soft_outside = outside((low > 125) & (high - low < 55))
core = ~ndimage.binary_dilation(soft_outside, iterations=2)
unknown = ~core & ~background
_, nearest = ndimage.distance_transform_edt(~core, return_indices=True)
reference = rgb[nearest[0], nearest[1]]
direction = reference - matte
opacity = np.clip(np.sum((rgb - matte) * direction, axis=2)
                  / np.maximum(np.sum(direction * direction, axis=2), 1), 0, 1)
alpha = np.ones(low.shape, dtype=np.float32)
alpha[background] = 0
alpha[unknown] = opacity[unknown]
if args.matte == "black":
    # Dark wood and metal may connect to the backdrop through narrow shadow gaps.
    # Seal those gaps before filling the object's interior, preserving its ink.
    silhouette = ndimage.binary_fill_holes(ndimage.binary_closing(alpha >= .01, iterations=8))
    alpha[ndimage.binary_erosion(silhouette, iterations=2)] = 1
# Unmix the edge fringe, including the source's soft fade along the desk edge.
colour = rgb.copy()
colour[unknown] = np.clip((rgb[unknown] - (1 - alpha[unknown, None]) * matte)
                          / np.maximum(alpha[unknown, None], .01), 0, 255)
if args.keep_largest:
    labels, count = ndimage.label(alpha >= .01, structure=np.ones((3, 3)))
    if count:
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        alpha[labels != sizes.argmax()] = 0
colour[alpha < .01] = 0
alpha[alpha < .01] = 0
rgba = np.dstack((colour, alpha * 255)).round().astype(np.uint8)
destination.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(rgba).save(destination, optimize=True)
print(f"Saved {destination}: {image.width} × {image.height}, transparent pixels {np.mean(alpha == 0):.1%}")
