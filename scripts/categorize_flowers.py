"""
Auto-categorize flower images into palette and bucket folders.

What it does:
1. Analyzes dominant color of each WebP/PNG in the source folder
2. Maps colors to palettes: blush, blue, sunset, white_green, tropical
3. Assigns bucket (focal, secondary, greenery) based on filename keywords
4. Copies files to public/flowers/{palette}/{bucket}/
5. Regenerates manifest.json

Usage:
  python scripts/categorize_flowers.py --source ./Flowers --output ./public/flowers
"""

from __future__ import annotations

import argparse
import colorsys
import json
import shutil
from collections import Counter
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image

# Palette definitions with HSV ranges
# H: 0-360, S: 0-100, V: 0-100
PALETTES = {
    "blush": {
        "h_ranges": [(330, 360), (0, 30)],  # pink, peach, coral
        "s_range": (15, 80),
        "v_range": (50, 100),
    },
    "blue": {
        "h_ranges": [(180, 280)],  # blue, purple, lavender
        "s_range": (15, 100),
        "v_range": (30, 100),
    },
    "sunset": {
        "h_ranges": [(0, 50)],  # orange, red, warm yellow
        "s_range": (50, 100),
        "v_range": (50, 100),
    },
    "white_green": {
        "h_ranges": [(60, 180)],  # green, plus low-saturation whites
        "s_range": (0, 60),
        "v_range": (60, 100),
    },
    "tropical": {
        "h_ranges": [(40, 70), (280, 330)],  # bright yellow, hot pink
        "s_range": (60, 100),
        "v_range": (70, 100),
    },
}

FOCAL_KEYWORDS = [
    "rose", "peony", "dahlia", "ranunculus", "tulip", "lily", "hibiscus",
    "sunflower", "camellia", "poppy", "orchid", "hydrangea", "carnation",
    "gerbera", "cosmos", "anemone", "magnolia",
]

GREENERY_KEYWORDS = [
    "fern", "eucalyptus", "ivy", "leaf", "foliage", "greenery", "vine",
    "lily of the valley", "bell-shaped", "grass", "branch", "stem",
]

IMAGE_EXTS = {".webp", ".png", ".jpg", ".jpeg"}
BUCKETS = ["focal", "secondary", "greenery"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Auto-categorize flower images.")
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("./Flowers"),
        help="Source directory with flower images.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("./public/flowers"),
        help="Output directory for categorized images.",
    )
    parser.add_argument(
        "--vase-dir",
        type=Path,
        default=Path("./public/vases"),
        help="Directory containing vase assets.",
    )
    parser.add_argument(
        "--background-dir",
        type=Path,
        default=Path("./public/backgrounds"),
        help="Directory containing background assets.",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=5000,
        help="Number of pixels to sample for color analysis.",
    )
    return parser.parse_args()


def get_dominant_color(img_path: Path, sample_size: int = 5000) -> Tuple[int, int, int] | None:
    """Extract dominant non-transparent color from image as RGB."""
    try:
        with Image.open(img_path) as img:
            img = img.convert("RGBA")
            # Downsample for speed
            img.thumbnail((200, 200), Image.Resampling.LANCZOS)
            pixels = list(img.getdata())
            # Filter out transparent/near-transparent pixels
            opaque = [(r, g, b) for r, g, b, a in pixels if a > 128]
            if not opaque:
                return (128, 128, 128)  # fallback gray
            # Simple mode: most common color
            counter = Counter(opaque)
            # Weight by frequency, take top colors
            top_colors = counter.most_common(min(50, len(counter)))
            # Average top colors weighted by count
            total = sum(c for _, c in top_colors)
            r = sum(col[0] * c for col, c in top_colors) // total
            g = sum(col[1] * c for col, c in top_colors) // total
            b = sum(col[2] * c for col, c in top_colors) // total
            return (r, g, b)
    except Exception as e:
        print(f"Warning: Could not process {img_path.name}: {e}")
        return None


def rgb_to_hsv_360(r: int, g: int, b: int) -> Tuple[float, float, float]:
    """Convert RGB (0-255) to HSV (H: 0-360, S: 0-100, V: 0-100)."""
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return (h * 360, s * 100, v * 100)


def classify_palette(rgb: Tuple[int, int, int]) -> str:
    """Determine which palette a color belongs to."""
    h, s, v = rgb_to_hsv_360(*rgb)

    # Check each palette
    scores = {}
    for name, rules in PALETTES.items():
        h_match = any(lo <= h <= hi for lo, hi in rules["h_ranges"])
        s_lo, s_hi = rules["s_range"]
        v_lo, v_hi = rules["v_range"]
        s_match = s_lo <= s <= s_hi
        v_match = v_lo <= v <= v_hi

        if h_match and s_match and v_match:
            # Score based on how centered the values are
            scores[name] = 3
        elif h_match and (s_match or v_match):
            scores[name] = 2
        elif h_match:
            scores[name] = 1

    if scores:
        return max(scores, key=scores.get)

    # Fallback: low saturation = white_green, else blush
    if s < 25:
        return "white_green"
    return "blush"


def classify_bucket(filename: str) -> str:
    """Determine bucket based on filename keywords."""
    lower = filename.lower()
    for kw in FOCAL_KEYWORDS:
        if kw in lower:
            return "focal"
    for kw in GREENERY_KEYWORDS:
        if kw in lower:
            return "greenery"
    return "secondary"


def collect_manifest(out_dir: Path) -> Dict[str, Dict[str, List[str]]]:
    """Scan output directory and build palette structure."""
    palettes: Dict[str, Dict[str, List[str]]] = {}
    for palette_dir in out_dir.iterdir():
        if not palette_dir.is_dir():
            continue
        palette_name = palette_dir.name
        buckets: Dict[str, List[str]] = {}
        for bucket in BUCKETS:
            bucket_dir = palette_dir / bucket
            if not bucket_dir.is_dir():
                buckets[bucket] = []
                continue
            paths = [
                f"/flowers/{palette_name}/{bucket}/{p.name}"
                for p in bucket_dir.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_EXTS
            ]
            buckets[bucket] = sorted(paths)
        palettes[palette_name] = buckets
    return palettes


def write_manifest(out_dir: Path, vase_dir: Path, bg_dir: Path) -> None:
    """Generate manifest.json from categorized assets."""
    palettes = collect_manifest(out_dir)
    vases = sorted(
        f"/vases/{p.name}" for p in vase_dir.glob("*.webp") if p.is_file()
    )
    backgrounds = sorted(
        f"/backgrounds/{p.name}" for p in bg_dir.glob("*.webp") if p.is_file()
    )
    manifest = {"palettes": palettes, "vases": vases, "backgrounds": backgrounds}
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"Wrote manifest: {manifest_path}")
    for name, buckets in palettes.items():
        total = sum(len(v) for v in buckets.values())
        print(f"  {name}: {total} flowers")


def categorize_images(source: Path, output: Path, sample_size: int) -> None:
    """Process all images in source and categorize them."""
    if not source.exists():
        print(f"Source not found: {source}")
        return

    images = [p for p in source.iterdir() if p.suffix.lower() in IMAGE_EXTS]
    print(f"Found {len(images)} images to categorize")

    stats = {p: {b: 0 for b in BUCKETS} for p in PALETTES}

    for i, img_path in enumerate(images):
        if i % 50 == 0:
            print(f"Processing {i}/{len(images)}...")

        rgb = get_dominant_color(img_path, sample_size)
        if rgb is None:
            continue  # skip unreadable images
        palette = classify_palette(rgb)
        bucket = classify_bucket(img_path.name)

        dest_dir = output / palette / bucket
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / img_path.name
        shutil.copy2(img_path, dest)
        stats[palette][bucket] += 1

    print("\nCategorization complete:")
    for palette, buckets in stats.items():
        total = sum(buckets.values())
        if total > 0:
            print(f"  {palette}: {buckets}")


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    # Clear existing palette folders (keep manifest)
    for palette in PALETTES:
        palette_dir = args.output / palette
        if palette_dir.exists():
            shutil.rmtree(palette_dir)

    categorize_images(args.source, args.output, args.sample_size)
    write_manifest(args.output, args.vase_dir, args.background_dir)


if __name__ == "__main__":
    main()
