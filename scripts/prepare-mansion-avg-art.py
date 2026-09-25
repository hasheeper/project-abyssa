#!/usr/bin/env python3
"""Prepare and verify mansion AVG WebP backgrounds without modifying masters.

Requires Pillow and cwebp. Pass the art workspace's abyssa-mansion-avg directory
with --source. --check verifies provenance, coverage and encoded files only.
"""

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/assets/backgrounds/mansion"
CONFIG = {"width": 2048, "quality": 94, "previewWidth": 640,
          "previewQuality": 88, "method": 6, "sharpYuv": True,
          "metadata": "icc-only", "resize": "Lanczos, full frame, no upscaling"}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def image_record(path):
    with Image.open(path) as image:
        image.load()
        if image.format != "WEBP" or image.is_animated:
            raise ValueError(f"Not a still WebP: {path}")
        if image.info.get("exif") or image.info.get("xmp"):
            raise ValueError(f"Unexpected private metadata: {path}")
        return {"file": str(path.relative_to(ROOT)), "width": image.width,
                "height": image.height, "bytes": path.stat().st_size,
                "sha256": digest(path)}


def encode(image, dest, width, quality, encoder):
    width = min(width, image.width)
    size = (width, round(image.height * width / image.width))
    resized = image.resize(size, Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    # The temporary output shares the destination filesystem for atomic replace.
    with tempfile.TemporaryDirectory(prefix=".encode-", dir=dest.parent) as temp:
        source, output = Path(temp) / "source.png", Path(temp) / "output.webp"
        resized.save(source, icc_profile=image.info.get("icc_profile"))
        subprocess.run([encoder, "-quiet", "-q", str(quality), "-m", "6",
                        "-sharp_yuv", "-metadata", "icc", str(source),
                        "-o", str(output)], check=True)
        with Image.open(output) as check:
            check.load()
            if check.size != size:
                raise ValueError(f"Wrong encoded size: {dest}")
        output.replace(dest)
    return image_record(dest)


def sources(source_root):
    batch = json.loads((ROOT / "docs/art/mansion-avg-batch-v1.json").read_text())
    jobs = [{"locationId": "hall", "label": "大厅",
             "assetId": "bg.interior.fireplace-lounge.base",
             "source": "samples/hall-v5.png", "review": "style-approved"}]
    for job in batch["jobs"]:
        location = job["locationId"]
        attempt = json.loads((source_root / f"batch-v1/{location}.attempt.json").read_text())
        path = source_root / f"batch-v1/{location}.png"
        if attempt.get("state") != "saved" or attempt.get("imageSha256") != digest(path):
            raise ValueError(f"Generation is not saved or source hash differs: {location}")
        jobs.append({"locationId": location, "label": job["label"],
                     "assetId": job["assetId"], "source": f"batch-v1/{location}.png",
                     "review": "integration-candidate"})
    jobs.append({"locationId": "tibby", "label": "缇比杂货铺",
                 "assetId": "bg.interior.shop-counter.base",
                 "source": "src/assets/backgrounds/shop-bg3.jpg", "review": "existing-asset",
                 "reuse": True})
    if len(jobs) != 31 or len({j["assetId"] for j in jobs}) != 31 or len({j["locationId"] for j in jobs}) != 31:
        raise ValueError("Expected 31 distinct locations and art IDs")
    for job in jobs:
        path = (ROOT if job.get("reuse") else source_root) / job["source"]
        with Image.open(path) as image:
            image.load()
            if not job.get("reuse") and (image.width < 2048 or abs(image.width / image.height - 16 / 9) > .03):
                raise ValueError(f"Master is not a native 2K landscape: {path}")
            if "A" in image.getbands() and image.getchannel("A").getextrema() != (255, 255):
                raise ValueError(f"Background has transparent pixels: {path}")
            job["sourceWidth"], job["sourceHeight"] = image.size
        job["sourceSha256"] = digest(path)
    if len({j["sourceSha256"] for j in jobs}) != len(jobs):
        raise ValueError("Duplicate source images; inspect before importing")
    return jobs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    source_root = args.source.resolve()
    # Validate the complete batch before writing anything. Unknown/unfinished
    # image requests must not become empty or guessed production assets.
    jobs = sources(source_root)
    manifest_path = DEST / "manifest.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    encoder = shutil.which("cwebp")
    if not encoder:
        raise SystemExit("cwebp is required")
    codec = subprocess.check_output([encoder, "-version"], text=True).strip()
    config = {**CONFIG, "cwebp": codec}
    entries = []
    for job in jobs:
        previous = next((e for e in old.get("locations", []) if e["locationId"] == job["locationId"]), {})
        full = DEST / f'{job["assetId"]}.webp'
        preview = DEST / "previews" / f'{job["assetId"]}.webp'
        matching = old.get("encoding") == config and all(previous.get(k) == v for k, v in job.items())
        valid = matching and preview.exists() and image_record(preview) == previous.get("preview")
        if not job.get("reuse"):
            valid = valid and full.exists() and image_record(full) == previous.get("image")
        if args.check and not valid:
            raise ValueError(f"Missing, stale or altered WebP: {job['locationId']}")
        if valid:
            entries.append(previous)
            continue
        path = (ROOT if job.get("reuse") else source_root) / job["source"]
        with Image.open(path) as original:
            image = original.convert("RGB")
            image.info = {"icc_profile": original.info.get("icc_profile")}
            entry = {**job, "preview": encode(image, preview, CONFIG["previewWidth"], CONFIG["previewQuality"], encoder)}
            if job.get("reuse"):
                entry["image"] = {"file": job["source"], "width": original.width,
                                  "height": original.height, "bytes": path.stat().st_size,
                                  "sha256": job["sourceSha256"]}
            else:
                entry["image"] = encode(image, full, CONFIG["width"], CONFIG["quality"], encoder)
        entries.append(entry)
        print(f'{job["locationId"]}: {entry["image"]["bytes"]:,} bytes, preview {entry["preview"]["bytes"]:,}', flush=True)
    for variant in ["image", "preview"]:
        if len({e[variant]["sha256"] for e in entries}) != len(entries):
            raise ValueError(f"Duplicate encoded {variant} images; inspect before importing")
    expected = {e["image"]["file"] for e in entries if not e.get("reuse")}
    expected.update(e["preview"]["file"] for e in entries)
    actual = {str(p.relative_to(ROOT)) for p in DEST.rglob("*.webp")}
    if actual != expected:
        raise ValueError(f"Unexpected or missing output files: {actual ^ expected}")
    if not args.check:
        manifest = {"version": 1, "scope": "31 mansion locations; one base-lighting pass; no night variants",
                    "encoding": config, "locations": entries}
        temporary = manifest_path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(manifest_path)
    generated = [e for e in entries if not e.get("reuse")]
    print(f'{"Verified" if args.check else "Prepared"}: {len(generated)} backgrounds, {len(entries)} previews; '
          f'{sum(e["image"]["bytes"] for e in generated):,} background bytes; '
          f'{sum(e["preview"]["bytes"] for e in entries):,} preview bytes')


if __name__ == "__main__":
    main()
