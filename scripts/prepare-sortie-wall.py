import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/assets/backgrounds/sortie-preparation-wall.webp"
SOURCE = ROOT / "src/assets/backgrounds/sortie-preparation-wall-source.webp"


def prop_masks(size):
    keys = Image.new("L", (420, 840))
    draw = ImageDraw.Draw(keys)
    draw.ellipse((80, 201, 268, 391), fill=255)
    draw.ellipse((101, 226, 245, 368), fill=0)
    draw.polygon([(175, 80), (201, 74), (215, 93), (214, 113), (206, 139),
                  (205, 217), (188, 239), (164, 237), (146, 221), (140, 169),
                  (144, 155), (159, 153), (172, 178), (177, 204), (180, 168),
                  (175, 132), (165, 111), (161, 95)], fill=255)
    draw.polygon([(100, 357), (121, 344), (196, 347), (225, 342), (253, 349),
                  (276, 369), (284, 395), (278, 418), (251, 441), (238, 447),
                  (270, 605), (319, 601), (329, 626), (312, 633), (320, 663),
                  (339, 674), (335, 690), (291, 693), (281, 712), (262, 718),
                  (248, 707), (229, 603), (218, 603), (220, 650), (203, 655),
                  (186, 661), (177, 650), (173, 501), (161, 495), (147, 517),
                  (129, 665), (179, 683), (177, 704), (166, 705), (163, 726),
                  (177, 732), (173, 752), (142, 747), (136, 738), (124, 751),
                  (111, 744), (106, 762), (81, 758), (113, 523), (110, 508),
                  (117, 494), (111, 479), (134, 464), (139, 449), (108, 449),
                  (86, 437), (72, 413), (73, 383)], fill=255)
    draw.ellipse((208, 384, 250, 417), fill=0)
    keys_full = Image.new("L", size)
    keys_full.paste(keys.resize((210, 420), Image.Resampling.LANCZOS), (180, 350))

    tube = Image.new("L", size)
    draw = ImageDraw.Draw(tube)
    outline = [(60, 283), (94, 267), (99, 268), (103, 259), (138, 258),
               (157, 264), (173, 349), (182, 349), (188, 366), (181, 385),
               (239, 677), (242, 883), (230, 892), (209, 891), (198, 886),
               (108, 450), (84, 400), (82, 372)]
    draw.polygon([(2510 + horizontal, 240 + vertical) for horizontal, vertical in outline], fill=255)
    draw.line([(2724, 299), (2680, 589)], fill=255, width=7)
    draw.line([(2730, 300), (2746, 843)], fill=255, width=6)
    draw.ellipse((2723, 277, 2742, 296), fill=255)
    return [mask.filter(ImageFilter.GaussianBlur(1.2)) for mask in (keys_full, tube)]


def enhance(source):
    if source.size != (2752, 1536):
        raise ValueError("Expected the approved 2752 × 1536 wall composition")
    pixels = np.asarray(source, dtype=np.float32)
    fine = np.asarray(source.filter(ImageFilter.GaussianBlur(1.3)), dtype=np.float32)
    broad = np.asarray(source.filter(ImageFilter.GaussianBlur(9)), dtype=np.float32)
    result = pixels.copy()
    masks = prop_masks(source.size)
    for mask, contrast, midpoint, lift in zip(masks, (1.18, 1.12), (65, 80), (12, 9)):
        weight = np.asarray(mask, dtype=np.float32)[:, :, None] / 255
        detail = (pixels - fine) * 0.32 + (fine - broad) * 0.22
        enhanced = (pixels - midpoint) * contrast + midpoint + lift + detail
        result += (enhanced - pixels) * weight
        shadow = Image.new("L", source.size)
        shadow.paste(mask, (-5, 6))
        shadow = shadow.filter(ImageFilter.GaussianBlur(4))
        shade = np.asarray(shadow, dtype=np.float32)[:, :, None] / 255
        result *= 1 - shade * (1 - weight) * 0.12
    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?", type=Path, default=SOURCE)
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()
    source = Image.open(args.source).convert("RGB")
    result = enhance(source)
    result.save(OUTPUT, "WEBP", quality=92, method=6)
    if args.preview:
        args.preview.mkdir(parents=True, exist_ok=True)
        comparison = Image.new("RGB", (904, 840))
        for image, horizontal in ((source, 0), (result, 452)):
            comparison.paste(image.crop((180, 350, 390, 770)).resize((210, 420)), (horizontal, 0))
            comparison.paste(image.crop((2510, 240, 2752, 1180)).resize((216, 840)), (horizontal + 218, 0))
        comparison.save(args.preview / "props-before-after.jpg", quality=92)
    print(f"Saved {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size // 1024} KiB)")


if __name__ == "__main__":
    main()
