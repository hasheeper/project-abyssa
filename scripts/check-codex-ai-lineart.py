#!/usr/bin/env python3
"""Check source provenance, alpha and monochrome assets; render visual review sheets."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src/assets/codex/ai-observations"
REVIEW = ROOT / "docs/design/codex-concept-2026-10-02/ai-lineart-batch-2026-10-02"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--partial", action="store_true", help="Review completed images while the serial queue runs")
    args = parser.parse_args()
    catalog = json.loads((ROOT / "src/assets/codex/observations/catalog.json").read_text())
    records = json.loads((ASSETS / "sources.json").read_text())["assets"]
    expected = {entry["id"] for entry in catalog}
    prepared = {record["assetId"] for record in records}
    assert not prepared - expected, f"Retired/unknown AI assets: {prepared - expected}"
    assert len(records) == len(prepared), "Duplicate AI asset records"
    if not args.partial:
        assert prepared == expected, f"Missing AI assets: {expected - prepared}"
    by_id = {record["assetId"]: record for record in records}
    metrics = []
    for entry in catalog:
        if entry["id"] not in by_id:
            continue
        record = by_id[entry["id"]]
        assert record["source"] == entry["source"]
        assert digest(ROOT / record["source"]) == record["sourceSha256"]
        assert digest(ROOT / record["aiOriginal"]) == record["aiOriginalSha256"]
        generation = json.loads((ROOT / record["generationRecord"]).read_text())
        assert generation["state"] == "saved"
        assert generation["model"] in {"gpt-image-2.5-sunburst@local", "gpt-image-2.5-flare@local"}
        assert generation["options"]["quality"] == "high"
        assert len(record["outputs"]) == 2
        for output in record["outputs"]:
            path = ASSETS / output["file"]
            assert digest(path) == output["sha256"]
            image = Image.open(path).convert("RGBA")
            assert list(image.size) == output["size"]
            a = np.asarray(image)
            alpha = a[..., 3]
            assert alpha.min() == 0 and alpha.max() > 128
            assert np.count_nonzero(alpha[0]) + np.count_nonzero(alpha[-1]) + np.count_nonzero(alpha[:, 0]) + np.count_nonzero(alpha[:, -1]) == 0, output["file"] + ": edge contamination/crop"
            assert np.all(a[..., :3][alpha > 0] == record["lineRgb"]), output["file"] + ": mixed RGB"
        main_image = np.asarray(Image.open(ASSETS / record["outputs"][0]["file"]).convert("RGBA"))
        alpha = main_image[..., 3]
        # Diagnostics help identify large filled shapes; visual review decides whether they are legitimate.
        width = ndimage.distance_transform_edt(alpha > 128) * 2
        metrics.append({"assetId": entry["id"], "inkCoverage": round(float((alpha > 24).mean()), 4),
                        "maximumOpaqueWidth": round(float(width.max()), 2),
                        "mainSize": record["outputs"][0]["size"], "sourceHashUnchanged": True})
    font_path = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    font = ImageFont.truetype(str(font_path), 17) if font_path.exists() else ImageFont.load_default()
    active = [entry for entry in catalog if entry["id"] in prepared]
    REVIEW.mkdir(parents=True, exist_ok=True)
    sheets = []
    for offset in range(0, len(active), 6):
        board = Image.new("RGBA", (1500, 850), "#121e1c")
        draw = ImageDraw.Draw(board)
        for index, entry in enumerate(active[offset:offset + 6]):
            x, y = index % 3 * 500, index // 3 * 425
            art = Image.open(ASSETS / by_id[entry["id"]]["outputs"][0]["file"]).convert("RGBA")
            art = art.crop(art.getchannel("A").getbbox())
            art.thumbnail((460, 355), Image.Resampling.LANCZOS)
            board.alpha_composite(art, (x + (500 - art.width) // 2, y + 355 - art.height))
            draw.text((x + 14, y + 382), entry["id"], fill="#b4b5a5", font=font)
        filename = f"review-{offset // 6 + 1:02}.jpg"
        board.convert("RGB").save(REVIEW / filename, quality=95)
        sheets.append(filename)
    report = {"catalogueCount": len(catalog), "preparedCount": len(prepared),
              "missing": sorted(expected - prepared), "checks": "source/raw/output hashes, high model params, full coverage, single RGB, transparent borders",
              "visualReviewSheets": sheets, "metrics": metrics}
    (REVIEW / "review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"prepared": len(prepared), "catalogue": len(catalog), "sheets": sheets}, ensure_ascii=False))


if __name__ == "__main__":
    main()
