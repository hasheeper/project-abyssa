#!/usr/bin/env python3
"""Prepare the map's paper goods: the dossier's paper, sepia prints and stamp
grain, and the grounds of the roster cards.

The paper is cut from the map's own parchment (one shade lighter), so the
dossier and the map read as the same sheet stock. Prints are inked for
mix-blend-mode: multiply: near-white highlights let the paper show through.
A shared alpha mask dissolves every print into the sheet at a ragged edge, so
it reads as printed into the paper rather than a framed picture pasted on it.
The mask stays separate from the prints: the page stretches it over whatever
height the print gets, so a print cropped shorter still has no hard edge.

Roster cards are the same sheet again, dyed per faction: the card's paper
(dye, edge wear and the rule of its niche) is one image per faction, and each
character adds a colour field printed into the niche the way that sheet takes
ink. The game stacks the two under the portrait; nothing is filtered live.
The map's party figures are die-cut from card stock into standees: the same
standee stands on the map and, when that character joins the party, pops up
above the roster card slotted into a turned-wood base.

Requires Pillow + numpy; runs offline, never in the game. Sources are
read-only. Run with --check to verify the checked-in outputs without writes.
"""
from __future__ import annotations

import argparse
import colorsys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

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

ROSTER_OUT = ROOT / "src/assets/map/roster"
PORTRAITS = ROOT / "src/assets/characters/portraits"
FIGURES = ROOT / "src/assets/map/party-figures"
# A standee keeps its figure's 512 canvas, so the shared foot calibration
# (partyFigureCalibration.ts) places it exactly where it placed the figure.
STANDEE_SIZE = (512, 512)
# Bare card stock round the print, and the darker edge a cutting die leaves.
STANDEE_STOCK = np.array([248, 234, 206]) / 255
STANDEE_CUT = np.array([52, 34, 20]) / 255
# The base a roster card's standee is slotted into: a turned walnut disc with a
# stepped foot, a brass band and a brass inlay ring, seen a little from above.
# Design px (the roster CSS places it by the slot), baked at 2.5x. The slot runs
# across the top face at (x0, yt); the foot's lowest point is yt + side + ryb.
STANDEE_BASE = FIGURES / "standee-base.webp"
BASE_SCALE = 2.5
BASE = dict(w=150, h=58, x0=75, yt=15, rx=60, ry=13.5, side=13, step=.62, rxb=62.5, ryb=14)
# Brass as on the map frame (map.css), walnut as the frame's rails.
WALNUT = np.array([118, 78, 45]) / 255
WALNUT_GRAIN = np.array([64, 38, 20]) / 255
BRASS = np.array([194, 155, 88]) / 255
BRASS_LIGHT = np.array([246, 222, 158]) / 255
BRASS_SHADE = np.array([108, 74, 34]) / 255
# Roster cards are 158 x 270 design px, baked at 2x. The colour field fills the
# niche (design 9, 9, 140 x 184) and fades out above the name.
CARD_SIZE = (316, 540)
NICHE_BOX = (18, 18, 280, 368)
# Where the head sits on every card: the backlight and its rays start here.
HALO = (158, 92)
# One sheet, three dyes. A faction keeps the parchment's stains and folds and
# changes only the dye, the niche its colour prints into and the ink of the rule:
#   the hero party's commissions: plain parchment, round arch, brown ink;
#   the demon cadre's contracts: blue paper, pointed arch, chalk;
#   the demon lord's decrees: purple vellum, trefoil arch, gold.
# dye is a Lab (L, a, b) target; crop is the card's corner on the sheet;
# light is the backlight inside the niche.
FACTIONS = {
    "hero-party": dict(dye=None, crop=(60, 120), niche="round", ink=(58, 38, 21), ink_alpha=.55, light=(252, 242, 220)),
    "demon-cadre": dict(dye=(32, -3, -10), crop=(470, 330), niche="pointed", ink=(223, 231, 230), ink_alpha=.5, light=(214, 230, 230)),
    "demon-lord": dict(dye=(23, 23, 1), crop=(300, 690), niche="trefoil", ink=(217, 180, 106), ink_alpha=.7, light=(242, 204, 133)),
}
# Whose card goes on which sheet. Mirrors the archive's affiliation tones
# (src/content/characters/identities.ts); src/assets/map/roster/catalog.test.ts
# holds the two together.
CARDS = {
    "eustice": "hero-party", "elora": "hero-party", "kororo": "hero-party", "norma": "hero-party",
    "marietta": "demon-cadre", "alvitr": "demon-cadre", "lenore": "demon-cadre", "vivienne": "demon-cadre",
    "abyssa": "demon-lord",
}
# Each card is printed in one spot colour, the portrait's strongest hue. These
# two wear their signature colour on a small accent, so it is named here.
SPOT = {
    "elora": "#c99a3e",
    "marietta": "#9c3f48",
}


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


def smoothstep(edge0, edge1, value):
    t = np.clip((value - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def rgb_to_hsv(rgb):
    top, low = rgb.max(axis=-1), rgb.min(axis=-1)
    spread = top - low
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    safe = np.maximum(spread, 1e-6)
    hue = np.where(top == r, ((g - b) / safe) % 6, np.where(top == g, (b - r) / safe + 2, (r - g) / safe + 4))
    hue = np.where(spread > 1e-6, hue / 6, 0)
    return np.stack([hue, np.where(top > 0, spread / np.maximum(top, 1e-6), 0), top], axis=-1)


def niche_outline(shape):
    """The niche's rule as an open line from the left foot over the top to the
    right foot, in niche-local design px (140 x 184)."""
    if shape == "round":
        top = [(70 + 70 * np.cos(t), 70 - 70 * np.sin(t)) for t in np.linspace(np.pi, 0, 90)]
    elif shape == "pointed":
        # Two arcs of radius 100 struck from the far springing points.
        r = 100.0
        rise = np.sqrt(r * r - (r - 70) ** 2)
        apex = np.arctan2(-rise, 70 - r) + 2 * np.pi
        left = [(r + r * np.cos(t), rise + r * np.sin(t)) for t in np.linspace(np.pi, apex, 70)]
        top = left + [(140 - x, y) for x, y in reversed(left[:-1])]
    else:
        # Trefoil: two side lobes and a raised centre lobe, cusps pointing in.
        lobes = [(31, 66, 31), (70, 40, 40), (109, 66, 31)]
        top = []
        for index, (cx, cy, r) in enumerate(lobes):
            for t in np.linspace(np.pi, 2 * np.pi, 240):
                x, y = cx + r * np.cos(t), cy + r * np.sin(t)
                inside = any((x - ox) ** 2 + (y - oy) ** 2 < (orad - .01) ** 2
                             for other, (ox, oy, orad) in enumerate(lobes) if other != index)
                if not inside:
                    top.append((x, y))
        top.sort(key=lambda point: point[0])
    return [(0, 184)] + top + [(140, 184)]


def rasterize(points, width=None):
    """Anti-aliased card-sized coverage of the niche, or of its rule when a
    line width (card px) is given."""
    scale = 4
    image = Image.new("L", (CARD_SIZE[0] * scale, CARD_SIZE[1] * scale), 0)
    draw = ImageDraw.Draw(image)
    left, top = NICHE_BOX[:2]
    path = [((left + x * 2) * scale, (top + y * 2) * scale) for x, y in points]
    if width is None:
        draw.polygon(path, fill=255)
    else:
        draw.line(path, fill=255, width=round(width * scale), joint="curve")
    return np.asarray(image.resize(CARD_SIZE, Image.Resampling.LANCZOS), dtype=float) / 255


def spot_colour(card):
    """A card's spot colour, 0..1 RGB: named, or the portrait's strongest hue
    brought into the range a field can carry."""
    if card in SPOT:
        return np.array([int(SPOT[card][i:i + 2], 16) for i in (1, 3, 5)], dtype=float) / 255
    with Image.open(PORTRAITS / f"{card}.png") as image:
        rgba = np.asarray(image.convert("RGBA").resize((176, 368)), dtype=float) / 255
    hsv = rgb_to_hsv(rgba[..., :3][rgba[..., 3] > .8])
    hsv = hsv[(hsv[:, 1] > .32) & (hsv[:, 2] > .22) & (hsv[:, 2] < .97)]
    weight = np.histogram(hsv[:, 0], bins=24, range=(0, 1), weights=hsv[:, 1] * hsv[:, 2])[0]
    weight = weight + (np.roll(weight, 1) + np.roll(weight, -1)) * .5
    h, s, v = np.median(hsv[np.floor(hsv[:, 0] * 24) % 24 == np.argmax(weight)], axis=0)
    return np.array(colorsys.hsv_to_rgb(h, np.clip(s, .45, .85), np.clip(v, .42, .72)))


def card_sheet(sheet, faction):
    """The dossier's parchment cut to a card, dyed for the faction and worn at
    the edges. 0..1 RGB, before the niche rule is drawn."""
    spec = FACTIONS[faction]
    x, y = spec["crop"]
    rgb = sheet[y:y + CARD_SIZE[1], x:x + CARD_SIZE[0]]
    if spec["dye"] is not None:
        lab = srgb_to_lab(rgb * 255)
        mean = lab.reshape(-1, 3).mean(axis=0)
        # The dye takes the tone; stains and folds keep most of their depth.
        for channel, (target, keep) in enumerate(zip(spec["dye"], (.6, .4, .4))):
            lab[..., channel] = target + (lab[..., channel] - mean[channel]) * keep
        rgb = lab_to_srgb(lab) / 255
    w, h = CARD_SIZE
    y_, x_ = np.mgrid[0:h, 0:w] + .5
    edge = np.minimum.reduce([x_, y_, w - x_, h - y_]) / 2
    wear = np.clip(np.exp(-edge / 8) * (.85 + .25 * periodic_noise(CARD_SIZE, 10, 60)), 0, 1)[..., None]
    tint = np.array([.70, .52, .36]) if spec["dye"] is None else np.full(3, .55)
    return rgb * (1 - wear * .38 * (1 - tint))


def card_paper(sheet, faction):
    spec = FACTIONS[faction]
    rule = rasterize(niche_outline(spec["niche"]), width=2.2)[..., None] * spec["ink_alpha"]
    rgb = card_sheet(sheet, faction) * (1 - rule) + np.array(spec["ink"]) / 255 * rule
    return Image.fromarray(np.uint8(np.clip(np.rint(rgb * 255), 0, 255)))


def card_field(sheet, faction, card):
    """A character's colour field in their spot colour, printed the way the
    faction's sheet takes colour: ink under multiply on parchment, opaque paint on the dyed sheets.
    RGBA, niche-sized; it fades out above the name and stops inside the rule."""
    spec = FACTIONS[faction]
    paper = card_sheet(sheet, faction)
    top = spot_colour(card)
    # The foot of the field is the same ink laid deeper.
    h, s, v = colorsys.rgb_to_hsv(*top)
    foot = np.array(colorsys.hsv_to_rgb(h, min(s * 1.05, 1), v * .6))
    w, h = CARD_SIZE
    y, x = np.mgrid[0:h, 0:w] + .5
    depth = (y - NICHE_BOX[1]) / NICHE_BOX[3]
    mid = top * .72 + foot * .28
    colour = np.where(depth[..., None] < .52,
                      top + (mid - top) * np.clip(depth / .52, 0, 1)[..., None],
                      mid + (foot - mid) * np.clip((depth - .52) / .48, 0, 1)[..., None])
    # Distances in design px from the head: a soft backlight and 24 rays.
    dist = np.hypot(x - HALO[0], y - HALO[1]) / 2
    angle = np.arctan2(y - HALO[1], x - HALO[0])
    rays = ((np.cos(angle * 24) > .35) * smoothstep(150, 30, dist) * smoothstep(18, 40, dist))[..., None]
    halo = smoothstep(70, 20, dist)[..., None]
    dots = (np.hypot((x / 2) % 5 - 2.5, (y / 2) % 5 - 2.5) < 1.05)[..., None]
    light = np.array(spec["light"]) / 255
    if spec["dye"] is None:
        ink = colour + (light - colour) * halo
        ink = ink + (light - ink) * rays * .16
        field = paper * ink * (1 - .14 * dots)
    else:
        lum = paper @ np.array([.299, .587, .114])
        grain = np.clip(.9 + .14 * (lum - lum.mean()) / max(lum.std(), 1e-6), .7, 1.15)[..., None]
        field = paper + ((colour * .8 + paper * .2) * grain - paper) * .86
        field = field + (light * (.96 + (grain - .9) * .3) - field) * halo * .8
        field = field + (light - field) * rays * .13
        field = field * (1 - .12 * dots)
    inside = Image.fromarray(np.uint8(rasterize(niche_outline(spec["niche"])) * 255)).filter(ImageFilter.MinFilter(5))
    alpha = smoothstep(.98, .7, depth) * np.asarray(inside, dtype=float) / 255
    rgba = np.dstack([np.clip(field, 0, 1), alpha])
    left, top_ = NICHE_BOX[:2]
    rgba = rgba[top_:top_ + NICHE_BOX[3], left:left + NICHE_BOX[2]]
    return Image.fromarray(np.uint8(np.rint(rgba * 255)))


def gaussian(values, sigma):
    """Gaussian blur of a 2-D array, zero-padded so nothing wraps round."""
    pad = int(np.ceil(sigma * 4))
    field = np.pad(values, pad)
    fy = np.fft.fftfreq(field.shape[0])[:, None]
    fx = np.fft.fftfreq(field.shape[1])[None, :]
    kernel = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(field) * kernel))[pad:-pad, pad:-pad]


def standee(figure_id):
    """A party figure die-cut from card stock. RGBA on the figure's own canvas.

    The cut is the silhouette blurred and thresholded: about 6 px out along a
    straight edge, rounded at the tips and bridged across the small gaps
    between hair, hands and props, the way a cutting die runs."""
    with Image.open(FIGURES / f"{figure_id}.png") as image:
        figure = np.asarray(image.convert("RGBA"), dtype=float) / 255
    ink = figure[..., 3]
    body = (ink > .06).astype(float)
    cut = np.clip((gaussian(body, 5.5) - .12) / .03, 0, 1)
    # A blade or a loose star thinner than the blur still gets its margin.
    cut = np.maximum(cut, np.clip(gaussian(body, 1.2) * 3, 0, 1))
    rim = np.clip(cut - np.clip(gaussian(cut, 1.1) * 1.6 - .6, 0, 1), 0, 1)[..., None] * .85
    stock = STANDEE_STOCK * (1 - rim) + STANDEE_CUT * rim
    rgb = stock * (1 - ink[..., None]) + figure[..., :3] * ink[..., None]
    return Image.fromarray(np.uint8(np.rint(np.dstack([rgb, cut]) * 255)))


def standee_base():
    """The turned-wood base, RGBA. Lit from the upper left like the map's key
    light, rendered 4x over and box-filtered down so the curves stay smooth.

    The side is a short cylinder whose foot steps out a little; a brass band
    runs under the rim. The top face shows the turning rings, a varnish sheen,
    a brass inlay ring and the slot: a dark groove whose near lip catches the
    light. A soft contact shadow sits under the foot."""
    over = 4
    k = BASE_SCALE * over
    b = BASE
    y, x = (np.mgrid[0:int(b["h"] * BASE_SCALE) * over, 0:int(b["w"] * BASE_SCALE) * over] + .5) / k
    x0, yt, rx, ry, side, rxb, ryb = (b[name] for name in ("x0", "yt", "rx", "ry", "side", "rxb", "ryb"))
    light = np.array([-.62, .55, .56]) / np.linalg.norm([-.62, .55, .56])

    def arc(radius_x, radius_y, centre):
        return centre + radius_y * np.sqrt(np.clip(1 - ((x - x0) / radius_x) ** 2, 0, 1))

    # Side: the body down to the step, then the wider foot.
    rim, step_y = arc(rx, ry, yt), yt + side * b["step"]
    body = (np.abs(x - x0) <= rx) & (y >= rim - .5) & (y <= arc(rx, ry, step_y))
    step_top = arc(rxb, ryb, step_y) - 1.6
    foot = (np.abs(x - x0) <= rxb) & (y >= step_top) & (y <= arc(rxb, ryb, yt + side))
    depth = np.clip((y - yt) / side, 0, 1)
    u = np.clip((x - x0) / np.where(foot & ~body, rxb, rx), -1, 1)
    facing = np.clip(u * light[0] + np.sqrt(1 - u ** 2) * light[2], 0, 1)
    fibres = periodic_noise((256, 64), 1.6, 7)[((y * 2.2) % 64).astype(int), ((x * .9) % 256).astype(int)]
    grain = (.5 + .5 * np.sin(y * 1.9 + fibres * 1.3))[..., None] * .28
    sides = (WALNUT * (1 - grain) + WALNUT_GRAIN * grain) * ((.32 + .78 * facing) * (1 - .38 * smoothstep(.45, 1, depth)))[..., None]
    sides = np.clip(sides + .2 * (np.exp(-((u + .42) / .16) ** 2) * (1 - .6 * depth))[..., None], 0, 1)
    band = body & (y - rim >= .6) & (y - rim <= 3)
    brass = BRASS_SHADE + (BRASS - BRASS_SHADE) * (.35 + .65 * facing)[..., None] + (BRASS_LIGHT - BRASS) * (facing ** 6)[..., None]
    sides = np.where(band[..., None], brass, sides)
    ledge = foot & ~body
    sides = np.where((ledge & (y - step_top <= 1.4))[..., None], np.clip(sides * 1.5 + .05, 0, 1), sides)
    sides = np.where((ledge & (y - step_top > 1.4) & (y - step_top <= 2.6))[..., None], sides * .7, sides)
    sides = np.where((arc(rxb, ryb, yt + side) - y <= 1.4)[..., None], sides * .6, sides)

    # Top face, in units of its own radii.
    fu, fv = (x - x0) / rx, (y - yt) / ry
    r = np.hypot(fu, fv)
    top = r <= 1
    turning = periodic_noise((128, 128), 3, 8)[((fv * 30) % 128).astype(int), ((fu * 30) % 128).astype(int)]
    rings = (.5 + .5 * np.sin(2 * np.pi * (r * 7.5 + .18 * turning)))[..., None] * .22
    face = (WALNUT * (1 - rings) + WALNUT_GRAIN * rings) * .93 + .16 * np.exp(-((fu + .38) / .55) ** 2 - ((fv + .45) / .7) ** 2)[..., None]
    toward = np.clip(-fu * .7 - fv * .7, -1, 1)
    inlay = BRASS_SHADE + (BRASS - BRASS_SHADE) * (.55 + .45 * toward)[..., None] + (BRASS_LIGHT - BRASS) * (np.clip(toward, 0, 1) ** 4)[..., None]
    face = np.where(((r >= .8) & (r <= .87))[..., None], inlay, face)
    face = face * (1 + smoothstep(.93, .985, r) * .45 * np.clip(-fu * .6 - fv * .8, -1, 1))[..., None]
    across = np.abs(fu) <= .56
    face = np.where((across & (np.abs(fv * ry) <= .75))[..., None], face * .28, face)
    face = np.where((across & (fv * ry > .75) & (fv * ry <= 1.5))[..., None], np.clip(face * 1.25, 0, 1), face)

    rgb = np.where(top[..., None], face, sides)
    alpha = (top | body | foot).astype(float)

    def down(values):
        return values.reshape(values.shape[0] // over, over, values.shape[1] // over, over, *values.shape[2:]).mean(axis=(1, 3))

    rgb, alpha = down(rgb * alpha[..., None]), down(alpha)
    rgb = rgb / np.maximum(alpha[..., None], 1e-6)
    cut = np.clip(alpha - np.clip(gaussian(alpha, .9) * 1.7 - .7, 0, 1), 0, 1)[..., None] * .8
    rgb = rgb * (1 - cut) + STANDEE_CUT * .4 * cut
    sy, sx = (np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]] + .5) / BASE_SCALE
    shadow = ((((sx - x0) / (rxb + 2)) ** 2 + ((sy - (yt + side + ryb - 1.5)) / 7.5) ** 2) <= 1).astype(float)
    shadow = np.clip(gaussian(shadow, 2.4 * BASE_SCALE), 0, 1) * .62 * (1 - alpha)
    out = alpha + shadow
    rgb = (rgb * alpha[..., None] + np.array([8, 5, 2]) / 255 * shadow[..., None]) / np.maximum(out[..., None], 1e-6)
    return Image.fromarray(np.uint8(np.rint(np.dstack([rgb, out]).clip(0, 1) * 255)))


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
    sheet = np.asarray(paper_sheet(), dtype=float) / 255
    for faction in FACTIONS:
        yield ROSTER_OUT / f"paper-{faction}.webp", encode(card_paper(sheet, faction), quality=86)
    for card, faction in CARDS.items():
        yield ROSTER_OUT / f"field-{card}.webp", encode(card_field(sheet, faction, card), quality=86)
    for figure in sorted(FIGURES.glob("*.png")):
        yield FIGURES / f"standee-{figure.stem}.webp", encode(standee(figure.stem))
    yield STANDEE_BASE, encode(standee_base(), quality=90)


def verify_standee(path, size, pixels, alpha):
    assert size == STANDEE_SIZE
    with Image.open(FIGURES / f"{path.stem.removeprefix('standee-')}.png") as image:
        ink = np.asarray(image.convert("RGBA"), dtype=float)[:, :, 3]
    assert alpha[ink > 16].min() > 250, "every stroke of the figure must sit on the card"
    assert (alpha > 128).sum() > (ink > 128).sum() * 1.12, "standee lost its margin of card"
    assert max(alpha[:8].max(), alpha[-8:].max(), alpha[:, :8].max(), alpha[:, -8:].max()) == 0, \
        "the cut must stay clear of the canvas edge"
    stock = pixels[(alpha == 255) & (ink == 0)]
    assert abs(stock.mean(axis=0) / 255 - STANDEE_STOCK).max() < .08, "margin must be bare card stock"


def verify_standee_base(size, pixels, alpha):
    assert size == (round(BASE["w"] * BASE_SCALE), round(BASE["h"] * BASE_SCALE))
    assert max(alpha[:3].max(), alpha[-3:].max(), alpha[:, :3].max(), alpha[:, -3:].max()) < 8, \
        "base and shadow must stay clear of the canvas edge"
    slot = pixels[round(BASE["yt"] * BASE_SCALE), round((BASE["x0"] - 20) * BASE_SCALE)]
    assert slot.mean() < 45, "the slot must read as a dark groove"
    wood = pixels[(alpha > 250)]
    r, g, b = wood.mean(axis=0)
    assert r > g > b and 50 < wood.mean() < 140, "base must be warm walnut"
    assert ((pixels[..., 0] > 200) & (pixels[..., 1] > 160) & (alpha > 250)).sum() > 200, "base lost its brass"


def verify_card(path, size, pixels, alpha):
    if path.name.startswith("paper-"):
        assert size == CARD_SIZE
        faction = path.stem.removeprefix("paper-")
        r, g, b = pixels.reshape(-1, 3).mean(axis=0)
        tone = (r + g + b) / 3
        if faction == "hero-party":
            assert tone > 170 and r > g > b, "hero cards stay on plain parchment"
        elif faction == "demon-cadre":
            assert 40 < tone < 110 and b > r, "cadre cards are dyed blue"
        else:
            assert 25 < tone < 90 and r > g and b > g, "the lord's card is dyed purple"
        assert pixels.mean(axis=2).std() > 3, "card sheet lost its stains and folds"
    else:
        assert size == NICHE_BOX[2:]
        h, w = alpha.shape
        assert alpha[-2:].max() < 8, "field must fade out above the name"
        assert max(alpha[0, 0], alpha[0, -1]) < 8, "field must stay inside the arch"
        assert alpha[h // 4, w // 2] > 240, "field must hold its colour behind the head"


def verify(path, data):
    with Image.open(BytesIO(data)) as image:
        size = image.size
        alpha = np.asarray(image.convert("RGBA"), dtype=float)[:, :, 3]
        pixels = np.asarray(image.convert("RGB"), dtype=float)
    if path == STANDEE_BASE:
        verify_standee_base(size, pixels, alpha)
    elif path.parent == FIGURES:
        verify_standee(path, size, pixels, alpha)
    elif path.parent == ROSTER_OUT:
        verify_card(path, size, pixels, alpha)
    elif path.name.startswith("paper"):
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
    ROSTER_OUT.mkdir(parents=True, exist_ok=True)
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
