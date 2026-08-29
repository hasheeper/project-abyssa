#!/usr/bin/env python3
"""Unpack a flat-layer PSD into cropped PNGs and an HTML-friendly manifest.

Install the one-off dependency with:
    python3 -m pip install psd-tools

Usage:
    python3 scripts/unpack-mansion-map.py /path/to/map.psd public/mansion-map
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from psd_tools import PSDImage
except ModuleNotFoundError as exc:
    raise SystemExit(
        "Missing dependency: install it with `python3 -m pip install psd-tools`."
    ) from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Source PSD file")
    parser.add_argument("output", type=Path, help="Output directory")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    psd = PSDImage.open(args.source)
    layers_dir = args.output / "layers"
    layers_dir.mkdir(parents=True, exist_ok=True)

    manifest_layers: list[dict[str, object]] = []
    for index, layer in enumerate(psd):
        image = layer.composite()
        if image is None:
            continue

        filename = f"layer-{index:02d}.png"
        image.save(layers_dir / filename, optimize=True)
        left, top, right, bottom = tuple(layer.bbox)
        manifest_layers.append(
            {
                "id": f"layer-{index:02d}",
                "name": layer.name,
                "src": f"layers/{filename}",
                "x": left,
                "y": top,
                "width": right - left,
                "height": bottom - top,
                "visible": layer.is_visible(),
                "opacity": round(layer.opacity / 255, 6),
                # psd-tools iterates these layers in the same back-to-front order
                # needed by ordinary HTML stacking for this source PSD.
                "order": index,
            }
        )

    manifest = {
        "version": 1,
        "source": args.source.name,
        "width": psd.width,
        "height": psd.height,
        "layers": manifest_layers,
    }
    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    psd.composite().save(args.output / "composite-reference.png", optimize=True)
    print(
        f"Exported {len(manifest_layers)} layers from {args.source.name} "
        f"({psd.width}x{psd.height}) to {args.output}"
    )


if __name__ == "__main__":
    main()
