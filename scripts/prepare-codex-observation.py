#!/usr/bin/env python3
"""Deterministic observation drawings from the complete enemy artwork catalog.

Install scripts/requirements-codex-observation.txt. Analysis operates at twice
the intended display size. Original straight-alpha RGBA files stay unchanged.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/assets/codex/observations"
REPORT = ROOT / "dist/reports/codex-observation"
CATALOG = OUT / "catalog.json"
PARAMS = {"version": 5, "displayBox": [550, 380], "supersampling": 2,
          "padding": 12, "ink": [198, 191, 172], "contourPixels": .9,
          "inkThresholds": [.12, .32], "structureLevels": 5,
          "densityCellPixels": 6, "localLineCoverage": .145,
          "primaryLinePixels": 1.0, "secondaryLinePixels": .7,
          "maxDarkMarks": 12}


def smoothstep(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def linear(rgb):
    return np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)


def srgb(rgb):
    rgb = np.clip(rgb, 0, 1)
    return np.where(rgb <= .0031308, rgb * 12.92, 1.055 * rgb ** (1 / 2.4) - .055)


def resize_plane(values, size):
    return np.asarray(Image.fromarray(values.astype(np.float32)).resize(size, Image.Resampling.LANCZOS))


def resize_rgba(rgb, alpha, size):
    """Filter premultiplied linear colour; discard RGB outside alpha support."""
    a = np.clip(resize_plane(alpha, size), 0, 1)
    premul = linear(rgb) * alpha[..., None]
    channels = np.stack([resize_plane(premul[..., c], size) for c in range(3)], axis=-1)
    colour = srgb(channels / np.maximum(a[..., None], 1e-6))
    colour[a < 1 / 255] = 0
    return colour, a


def image_rgba(rgb, alpha):
    return Image.fromarray(np.uint8(np.clip(np.rint(np.dstack([rgb, alpha]) * 255), 0, 255)))


def save_mask(values, path):
    Image.fromarray(np.uint8(np.clip(values * 255, 0, 255))).save(path)


def normalize_source(source, display_box, supersampling=2, padding=None):
    bounds = source.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Artwork has no visible pixels")
    crop = source.crop(bounds)
    values = np.asarray(crop, dtype=np.float32) / 255
    pad = (PARAMS["padding"] if padding is None else padding) * supersampling
    scale = min((display_box[0] * supersampling - 2 * pad) / crop.width,
                (display_box[1] * supersampling - 2 * pad) / crop.height)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    rgb, alpha = resize_rgba(values[..., :3], values[..., 3], size)
    return (np.pad(rgb, ((pad, pad), (pad, pad), (0, 0))),
            np.pad(alpha, pad), bounds, scale)


def stroke_width(lum, support, dpr):
    """Measure thin dark ridges, rejecting cores of broad dark painted areas."""
    cutoff = min(.30, float(np.quantile(lum[support], .12)))
    seeds = (lum < cutoff) & support
    distance = ndi.distance_transform_edt(seeds)
    ridges = (distance >= ndi.maximum_filter(distance, size=3)) & seeds
    widths = distance[ridges] * 2
    widths = widths[(widths >= 2.5) & (widths <= 4 * dpr)]
    return float(np.clip(np.median(widths) if widths.size else 1.4 * dpr, .8 * dpr, 3 * dpr))


def direction_coherence(lum, width):
    """Directional strokes dominate; isotropic paint grain remains in the wash."""
    gy, gx = np.gradient(ndi.gaussian_filter(lum, .7))
    xx = ndi.gaussian_filter(gx * gx, width)
    yy = ndi.gaussian_filter(gy * gy, width)
    xy = ndi.gaussian_filter(gx * gy, width)
    return np.clip(((xx - yy) ** 2 + 4 * xy ** 2) / ((xx + yy) ** 2 + 1e-10), 0, 1)


def guided(values, radius, epsilon=.018):
    """Self-guided smoothing preserves large tonal boundaries."""
    mean = ndi.uniform_filter(values, size=2*radius+1)
    variance = np.maximum(ndi.uniform_filter(values*values, size=2*radius+1) - mean*mean, 0)
    a = variance / (variance + epsilon)
    b = mean * (1-a)
    return ndi.uniform_filter(a, size=2*radius+1) * values + ndi.uniform_filter(b, size=2*radius+1)


def structural_regions(lum, support, width):
    simplified = guided(guided(lum, round(4*width)), round(4*width))
    levels = PARAMS["structureLevels"]
    bands = np.digitize(simplified, np.quantile(simplified[support], np.arange(1, levels) / levels))
    stable = np.zeros_like(support)
    for value in range(levels):
        labels, _ = ndi.label((bands == value) & support)
        counts = np.bincount(labels.ravel())
        keep = counts >= (5*width)**2
        keep[0] = False
        stable |= keep[labels]
    if stable.any():
        near = ndi.distance_transform_edt(~stable, return_distances=False, return_indices=True)
        bands = bands[tuple(near)]
    edge = ((ndi.maximum_filter(bands, size=3) != ndi.minimum_filter(bands, size=3)) & support)
    distance = ndi.distance_transform_edt(~edge)
    return bands, 1-smoothstep(width, 3*width, distance)


def ranked_strokes(candidate, alignment, support, dpr):
    """Rank junction-separated paths; local occupancy prevents bright tangles."""
    low, high = PARAMS["inkThresholds"]
    connected = ndi.binary_propagation(candidate > high, mask=candidate > low)
    skeleton = thin(connected)
    around=[np.roll(np.roll(skeleton,y,axis=0),x,axis=1) for y,x in [(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]]
    transitions=sum((~around[i] & around[(i+1)%8]).astype(np.uint8) for i in range(8))
    joints=skeleton & (transitions >= 3)
    segments=skeleton & ~ndi.binary_dilation(joints)
    labels,_=ndi.label(segments,structure=np.ones((3,3)))
    counts=np.bincount(labels.ravel()).astype(float)
    c=np.bincount(labels.ravel(),weights=candidate.ravel())/np.maximum(counts,1)
    a=np.bincount(labels.ravel(),weights=alignment.ravel())/np.maximum(counts,1)
    scores=smoothstep(3*dpr,22*dpr,counts)*c*(.35+.65*a)
    scores[0]=0
    pitch=PARAMS["densityCellPixels"]*dpr;gh=int(np.ceil(support.shape[0]/pitch));gw=int(np.ceil(support.shape[1]/pitch))
    used=np.zeros((gh,gw));accepted=np.zeros_like(candidate)
    regions=ndi.find_objects(labels)
    selected_lengths=[]
    rejected=0
    for label in np.argsort(scores)[::-1]:
        if label==0 or counts[label]<4*dpr or scores[label]<.055: continue
        region=regions[label-1]
        yy,xx=np.where(labels[region]==label);yy+=region[0].start;xx+=region[1].start
        gy,gx=yy//pitch,xx//pitch
        proposal=np.bincount(gy*gw+gx,minlength=gh*gw).reshape(gh,gw)*dpr/(pitch*pitch)
        projected=ndi.uniform_filter(used+proposal,size=3)
        if np.quantile(projected[gy,gx],.9) > PARAMS["localLineCoverage"]:
            rejected += 1
            continue
        used+=proposal
        strength=(.50+.33*smoothstep(.10,.45,scores[label])) if a[label]>.3 else (.36+.20*smoothstep(.08,.35,scores[label]))
        accepted[yy,xx]=strength
        selected_lengths.append(float(counts[label]/dpr))
    stats = {"acceptedSegments": len(selected_lengths), "densityRejectedSegments": rejected,
             "meanSegmentPixels": round(float(np.mean(selected_lengths)), 3) if selected_lengths else 0}
    if not accepted.any(): return accepted, skeleton, stats
    accepted=np.maximum(accepted, ndi.maximum_filter(accepted,size=5)*joints)
    dist,near=ndi.distance_transform_edt(accepted==0,return_indices=True)
    strength=accepted[tuple(near)]
    endpoint=(ndi.convolve((accepted>0).astype(np.uint8),np.ones((3,3),dtype=np.uint8))==2)&(accepted>0)
    end_distance=ndi.distance_transform_edt(~endpoint)
    taper=.45+.55*smoothstep(0,3*dpr,end_distance)
    radius=np.where(strength>.5, PARAMS["primaryLinePixels"], PARAMS["secondaryLinePixels"])*dpr*.5*taper
    ink=(1-smoothstep(np.maximum(0,radius-.55),radius+.55,dist))*strength
    return ink, skeleton, stats


def thin(mask):
    """Zhang–Suen thinning; zero padding in normalized artwork prevents wraparound."""
    image = mask.copy()
    while True:
        changed = False
        for phase in range(2):
            p = [np.roll(np.roll(image,y,axis=0),x,axis=1) for y,x in [(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]]
            count = sum(a.astype(np.uint8) for a in p)
            transition = sum((~p[i] & p[(i+1)%8]).astype(np.uint8) for i in range(8))
            if phase == 0:
                keep = ~(p[0] & p[2] & p[4]) & ~(p[2] & p[4] & p[6])
            else:
                keep = ~(p[0] & p[2] & p[6]) & ~(p[0] & p[4] & p[6])
            remove = image & (count >= 2) & (count <= 6) & (transition == 1) & keep
            if remove.any():
                image[remove] = False
                changed = True
        if not changed: break
    return image

def compact_dark_marks(lum, support, dpr):
    surround = ndi.gaussian_filter(lum, 3*dpr)
    deficit = surround - lum
    labels, _ = ndi.label((deficit > .10) & (surround > .48) & support)
    regions = ndi.find_objects(labels)
    candidates = []
    for label, region in enumerate(regions, 1):
        area = np.count_nonzero(labels[region] == label)
        h,w = (sl.stop-sl.start for sl in region)
        if not (dpr <= area <= (5*dpr)**2 and max(h,w) <= 8*dpr and min(h,w)/max(h,w) >= .25): continue
        local = labels[region] == label
        if area/(h*w) < .25: continue
        score = float(deficit[region][local].mean()) * min(area, 9*dpr*dpr)**.5
        candidates.append((score,label))
    selected = [label for _,label in sorted(candidates,reverse=True)[:PARAMS["maxDarkMarks"]]]
    marks = np.isin(labels,selected).astype(float)
    return np.clip(ndi.gaussian_filter(marks, .3*dpr), 0, 1)


def render_drawing(source, display_box=(550, 380), thumbnail=False):
    dpr = PARAMS["supersampling"]
    rgb, alpha, bounds, scale = normalize_source(source, display_box, dpr, padding=4 if thumbnail else None)
    support = alpha > .5
    inside = ndi.distance_transform_edt(support)
    outside = ndi.distance_transform_edt(~support)
    # Extend actual edge colours, never a white canvas, into transparent pixels.
    nearest = ndi.distance_transform_edt(~support, return_distances=False, return_indices=True)
    extended = rgb[tuple(nearest)]
    lum = extended @ np.array([.2126, .7152, .0722], dtype=np.float32)
    width = stroke_width(lum, support, dpr)
    analysis = ndi.gaussian_filter(lum, .35 * dpr)

    sizes = [int(np.ceil(width * factor)) // 2 * 2 + 1 for factor in (1.5, 3.5)]
    backgrounds = [ndi.grey_closing(analysis, size=(size, size)) for size in sizes]
    background = backgrounds[1]
    fine = np.maximum(backgrounds[0] - analysis, 0)
    coarse = np.maximum(background - analysis, 0)
    contrast = np.maximum(fine, .3 * coarse) / (.10 + background * .8)
    coherence = direction_coherence(analysis, width * 1.5)
    bands, alignment = structural_regions(lum, support, width)
    candidate = smoothstep(.055, .32, contrast) * smoothstep(.10, .60, coherence)
    candidate *= smoothstep(1.0*dpr, 2.5*dpr, inside) * support
    ink, skeleton, stroke_stats = ranked_strokes(candidate, alignment, support, dpr)

    dark_marks = compact_dark_marks(analysis, support & (inside > 3*dpr), dpr)
    ink *= 1 - ndi.maximum_filter(dark_marks, size=3)

    # Inward alpha contour; source pigment and direction vary line width/value.
    signed = ndi.gaussian_filter(inside - outside, .8 * dpr)
    gy, gx = np.gradient(signed)
    length = np.maximum(np.hypot(gx, gy), 1e-5)
    light = np.clip(.5 + .5 * ((gx * .45 + gy * .85) / length), 0, 1)
    pigment = 1 - smoothstep(.15, .55, lum)
    contour_width = PARAMS["contourPixels"] * dpr * (1.2 - .3 * light)
    contour = (1 - smoothstep(.25, contour_width + .8, inside)) * support
    contour *= .48 + .52 * pigment
    contour_colour = np.array([190, 184, 167]) * (.80 + .20 * light[..., None])

    # Normalized convolution removes ink without invisible edge RGB pollution.
    erase = ndi.maximum_filter(smoothstep(.12, .5, ink), size=3)
    paint_weight = alpha * (1 - erase) * smoothstep(dpr, 2.5 * dpr, inside)
    sigma = max(2, width * 1.6)
    weights = ndi.gaussian_filter(paint_weight, sigma)
    inpainted = ndi.gaussian_filter(lum * paint_weight, sigma) / np.maximum(weights, 1e-6)
    inpainted = np.where(weights > .01, inpainted, background)
    # Repair selected ink, then limit residual texture without flattening the
    # large tonal boundaries. Compact facial marks are restored separately.
    paint = analysis * (1 - erase) + inpainted * erase
    low = guided(paint, round(3 * width), epsilon=.012)
    detail_residual = paint - low
    paint = low + .06 * np.tanh(detail_residual / .12)
    p2, p98 = np.quantile(paint[support], [.02, .98])
    tone = np.clip((paint - p2) / max(float(p98 - p2), .15), 0, 1)
    tone = np.where(tone < .35, .35 - .50 * (.35 - tone), tone)
    body = np.array([32, 36, 32]) + tone[..., None] * np.array([50, 46, 38])
    chroma = np.clip(extended - lum[..., None], -.15, .15)
    body = body + chroma * 22 - (2 * np.exp(-inside / (8 * dpr)))[..., None]
    if thumbnail:
        body += 12
    body *= 1 - .6 * dark_marks[...,None]
    colour = body * (1 - contour[..., None]) + contour_colour * contour[..., None]
    ink_colour = np.array(PARAMS["ink"])
    colour = colour * (1 - ink[..., None] * .86) + ink_colour * ink[..., None] * .86
    colour = np.clip(colour / 255, 0, 1)
    colour[alpha == 0] = 0
    output = image_rgba(colour, alpha)
    y, x = np.indices(alpha.shape)
    mass = alpha.sum()
    density = ndi.uniform_filter((ink > .25).astype(float), size=20*dpr+1)
    metrics = {**stroke_stats, "localInkDensityP95": round(float(np.quantile(density[support], .95)), 4),
               "sourceSize": list(source.size), "alphaBounds": list(bounds),
               "workScale": round(scale, 6), "strokeWidthPixels": round(width / dpr, 3),
               "visualCenter": [float((alpha * x).sum() / mass / output.width), float((alpha * y).sum() / mass / output.height)],
               "groundAnchor": float(np.max(np.where(alpha > .5)[0]) / output.height),
               "inkCoverage": round(float((ink > .25).sum() / support.sum()), 4),
               "contourCoverage": round(float((contour > .25).sum() / support.sum()), 4)}
    return output, metrics, {"contour": contour, "candidate": candidate, "ink": ink, "wash": np.clip(body / 255, 0, 1), "coherence": coherence, "structure": np.repeat((bands/(PARAMS["structureLevels"]-1))[...,None],3,axis=-1), "skeleton": skeleton.astype(float), "density": density, "dark-marks": dark_marks}


def registered_sources():
    battle = ROOT / "src/assets/battle"
    return {str(path.relative_to(ROOT)) for pattern in ("tide-reef/*.png", "old-manor/*.png") for path in battle.glob(pattern)}


def render_contact(entries, originals=False):
    font_path = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    font = ImageFont.truetype(str(font_path), 18) if font_path.exists() else ImageFont.load_default()
    for offset in range(0, len(entries), 6):
        page = entries[offset:offset + 6]
        board = Image.new("RGB", (1500, 820), "#0b1414")
        draw = ImageDraw.Draw(board)
        for index, entry in enumerate(page):
            x, y = (index % 3) * 500, (index // 3) * 410
            art = Image.open(ROOT / entry["source"] if originals else OUT / f'{entry["id"]}.webp').convert("RGBA")
            art = art.crop(art.getchannel("A").getbbox())
            art.thumbnail((470, 350), Image.Resampling.LANCZOS)
            board.paste(art, (x + (500 - art.width) // 2, y + 350 - art.height), art)
            draw.text((x + 16, y + 367), entry["id"], fill="#abbcac", font=font)
        prefix = "all-sources" if originals else "all-creatures"
        board.save(REPORT / f"{prefix}-{offset // 6 + 1}.jpg", quality=94)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", action="append", help="Process selected catalog IDs; default processes every asset")
    args = parser.parse_args()
    entries = json.loads(CATALOG.read_text())
    sources = {entry["source"] for entry in entries}
    if sources != registered_sources():
        raise ValueError(f"Catalog/source mismatch: missing={registered_sources() - sources}; extra={sources - registered_sources()}")
    if len(sources) != len(entries):
        raise ValueError("Duplicate artwork in observation catalog")
    selected = [e for e in entries if not args.asset or e["id"] in args.asset]
    if args.asset and set(args.asset) != {entry["id"] for entry in selected}:
        raise ValueError("Unknown requested asset")
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "sources.json"
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    records = {record["assetId"]: record for record in previous.get("assets", [])}
    for entry in selected:
        path = ROOT / entry["source"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        source = Image.open(path).convert("RGBA")
        art, metrics, layers = render_drawing(source)
        thumb, _, _ = render_drawing(source, (82, 62), thumbnail=True)
        outputs = []
        for suffix, rendered in [("", art), (".thumb", thumb)]:
            output = OUT / f'{entry["id"]}{suffix}.webp'
            rendered.save(output, "WEBP", lossless=True, method=6)
            outputs.append({"file": output.name, "size": list(rendered.size), "sha256": hashlib.sha256(output.read_bytes()).hexdigest()})
        for name, values in layers.items():
            target = REPORT / f'{entry["id"]}.{name}.png'
            if values.ndim == 3:
                image_rgba(values, np.asarray(art)[..., 3] / 255).save(target)
            else:
                save_mask(values, target)
        assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
        records[entry["id"]] = {"assetId": entry["id"], "source": entry["source"], "sourceSha256": digest, **metrics, "outputs": outputs}
        print(f'{entry["id"]}: {art.width}x{art.height}, line={metrics["strokeWidthPixels"]}px, ink={metrics["inkCoverage"]}', flush=True)
    metadata = {"parameters": PARAMS, "assets": [records[e["id"]] for e in entries if e["id"] in records]}
    manifest_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    render_contact([entry for entry in entries if entry["id"] in records])
    render_contact([entry for entry in entries if entry["id"] in records], originals=True)


if __name__ == "__main__":
    main()
