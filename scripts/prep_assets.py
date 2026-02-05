"""
Prep flower assets for the bouquet site.

What it does:
- Converts PNG (or other raster formats) to WebP with alpha preserved.
- Downscales to a configurable max dimension while keeping aspect ratio.
- Writes optimized assets into /public/flowers/<palette>/<bucket>/.
- Generates /public/flowers/manifest.json from the output tree.
- Auto-detects vase width and uses 50% of it as default max-size.

Folder expectations (manual, simple):
- You place source files under: <source>/<palette>/<bucket>/filename.png
- Palettes are a fixed, manual list (e.g., blush, blue, sunset, white_green, tropical).
- Buckets are: focal, secondary, greenery.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

from PIL import Image

PALLETES = ["blush", "blue", "sunset", "white_green", "tropical"]
BUCKETS = ["focal", "secondary", "greenery"]
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def get_vase_max_width(vase_dir: Path) -> int:
    """Get the maximum width of all vase images, return 50% of that."""
    max_vase_width = 0
    
    for vase_path in vase_dir.glob("*.webp"):
        try:
            with Image.open(vase_path) as img:
                width, _ = img.size
                max_vase_width = max(max_vase_width, width)
        except Exception as e:
            print(f"Warning: Could not read vase {vase_path}: {e}")
    
    if max_vase_width == 0:
        print("Warning: No vase images found, using default 250px (50% of 500px vase)")
        return 250
    
    max_flower_width = int(max_vase_width * 0.5)
    print(f"Auto-detected vase max width: {max_vase_width}px")
    print(f"Using max flower width (50% of vase): {max_flower_width}px")
    return max_flower_width


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare flower assets for the bouquet site.")
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("./raw_flowers"),
        help="Source directory containing palette/bucket subfolders with PNGs.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("./public/flowers"),
        help="Output directory for optimized WebP assets.",
    )
    parser.add_argument(
        "--max-size",
        type=int,
        default=None,
        help="Maximum width/height for resized assets (pixels). Default: auto-detect 50% of vase width.",
    )
    parser.add_argument(
        "--vase-dir",
        type=Path,
        default=Path("./public/vases"),
        help="Directory containing vase WebP assets.",
    )
    parser.add_argument(
        "--background-dir",
        type=Path,
        default=Path("./public/backgrounds"),
        help="Directory containing background assets.",
    )
    return parser.parse_args()


def resize_and_save(src: Path, dest: Path, max_size: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGBA")
        im.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        dest = dest.with_suffix(".webp")
        im.save(dest, "WEBP", quality=90, method=6)


def collect_output_manifest(out_dir: Path) -> Dict[str, Dict[str, List[str]]]:
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
                if p.is_file() and p.suffix.lower() == ".webp"
            ]
            buckets[bucket] = sorted(paths)
        palettes[palette_name] = buckets
    return palettes


def write_manifest(out_dir: Path, vase_dir: Path, background_dir: Path) -> None:
    manifest_path = out_dir / "manifest.json"
    palettes = collect_output_manifest(out_dir)
    vases = [
        f"/vases/{p.name}"
        for p in vase_dir.glob("*.webp")
        if p.is_file()
    ]
    backgrounds = [
        f"/backgrounds/{p.name}"
        for p in background_dir.glob("*.webp")
        if p.is_file()
    ]
    manifest = {"palettes": palettes, "vases": sorted(vases), "backgrounds": sorted(backgrounds)}
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"Wrote manifest with {len(palettes)} palettes -> {manifest_path}")


def process_sources(source: Path, output: Path, max_size: int) -> None:
    if not source.exists():
        print(f"Source directory not found: {source}")
        return
    for palette_dir in source.iterdir():
        if not palette_dir.is_dir():
            continue
        palette_name = palette_dir.name
        for bucket in BUCKETS:
            bucket_dir = palette_dir / bucket
            if not bucket_dir.exists():
                continue
            for img_path in bucket_dir.iterdir():
                if img_path.suffix.lower() not in IMAGE_EXTS:
                    continue
                dest = output / palette_name / bucket / img_path.name
                resize_and_save(img_path, dest, max_size)
                print(f"-> {dest.relative_to(output)}")


def main() -> None:
    args = parse_args()
    
    # Auto-detect max-size from vase width if not specified
    max_size = args.max_size
    if max_size is None:
        max_size = get_vase_max_width(args.vase_dir)
    
    args.output.mkdir(parents=True, exist_ok=True)
    process_sources(args.source, args.output, max_size)
    write_manifest(args.output, args.vase_dir, args.background_dir)


if __name__ == "__main__":
    main()
