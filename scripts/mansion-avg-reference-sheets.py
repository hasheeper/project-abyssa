#!/usr/bin/env /usr/bin/python3
"""Make local contact sheets for auditing the 31 mansion location references."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Prepared reference-manifest.json")
    args = parser.parse_args()
    manifest_path = args.source.resolve()
    data = json.loads(manifest_path.read_text())
    records = data["locations"]
    if len(records) != 31 or len({row["locationId"] for row in records}) != 31:
        raise SystemExit("Expected 31 unique mansion locations")
    target = manifest_path.parent / "contact-sheets"
    target.mkdir(parents=True, exist_ok=True)
    cell_w, cell_h, image_h = 420, 330, 285
    for offset in range(0, len(records), 8):
        sheet = Image.new("RGB", (cell_w * 4, cell_h * 2), "#d8d3cb")
        draw = ImageDraw.Draw(sheet)
        for index, record in enumerate(records[offset:offset + 8]):
            x, y = (index % 4) * cell_w, (index // 4) * cell_h
            path = manifest_path.parent / record["reference"]
            with Image.open(path) as source:
                ref = ImageOps.contain(source.convert("RGBA"), (cell_w - 16, image_h - 12))
            inner = Image.new("RGBA", ref.size, "#f2eee6")
            inner.alpha_composite(ref)
            sheet.paste(inner.convert("RGB"), (x + (cell_w - ref.width) // 2, y + (image_h - ref.height) // 2))
            draw.text((x + 10, y + image_h + 3), f"{record['locationId']}  {record['width']}x{record['height']}", fill="#29231e")
        page = offset // 8 + 1
        sheet.save(target / f"references-{page:02d}.jpg", quality=88, optimize=True)
    print(f"Prepared {(len(records) + 7) // 8} sheets in {target}")


if __name__ == "__main__":
    main()
