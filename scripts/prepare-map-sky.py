from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/assets/map/dossier/paper-v2.webp"
OUTPUT = ROOT / "src/assets/map/terrain/parchment-sky.webp"


def main():
    source = Image.open(SOURCE).convert("L")
    tile = ImageOps.fit(source, (1024, 1024), method=Image.Resampling.LANCZOS)
    detail = np.asarray(tile, dtype=float)
    broad = np.asarray(tile.filter(ImageFilter.GaussianBlur(24)), dtype=float)
    grain = np.clip((detail - broad) * 0.95 + (broad - broad.mean()) * 0.55, -24, 24)
    phase = np.linspace(0, np.pi, 1024)
    blend = ((1 - np.cos(phase)) / 2)[None, :]
    shifted = np.roll(grain, 512, axis=1)
    seamless = grain * (1 - blend) + shifted * blend
    panorama = np.concatenate((seamless, seamless[:, ::-1]), axis=1)
    latitude = np.linspace(0, 1, 1024)[:, None]
    pole_fade = np.minimum(1, np.minimum(latitude, 1 - latitude) * 12)
    base = np.array([94, 74, 54], dtype=float)
    pixels = np.clip(base + panorama[:, :, None] * pole_fade[:, :, None], 0, 255).astype(np.uint8)
    pixels[:, -1] = pixels[:, 0]
    Image.fromarray(pixels).save(OUTPUT, "WEBP", lossless=True, method=6)
    print(f"Saved {OUTPUT.relative_to(ROOT)} (2048 × 1024)")


if __name__ == "__main__":
    main()
