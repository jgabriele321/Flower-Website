"""
Find and optionally delete oversized flower images.
Flowers should be no wider than 50% of the vase width.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

IMAGE_EXTS = {".webp", ".png", ".jpg", ".jpeg"}


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
    print(f"Vase max width: {max_vase_width}px")
    print(f"Max flower width (50% of vase): {max_flower_width}px")
    return max_flower_width


def find_oversized_flowers(source_dir: Path, max_width: int, delete: bool = False) -> None:
    """Find flowers that exceed max_width in width."""
    oversized = []
    
    for img_path in source_dir.rglob("*"):
        if img_path.suffix.lower() not in IMAGE_EXTS:
            continue
        
        try:
            with Image.open(img_path) as img:
                width, height = img.size
                
                if width > max_width:
                    rel_path = img_path.relative_to(source_dir)
                    oversized.append((img_path, width, height, rel_path))
        except Exception as e:
            print(f"Error reading {img_path}: {e}")
    
    if not oversized:
        print(f"\n✓ No flowers found wider than {max_width}px (50% of vase width)")
        return
    
    print(f"\nFound {len(oversized)} oversized flowers (width > {max_width}px):")
    print("-" * 80)
    
    deleted_count = 0
    for img_path, width, height, rel_path in sorted(oversized, key=lambda x: x[1], reverse=True):
        print(f"{rel_path}")
        print(f"  Dimensions: {width}x{height}px (width exceeds {max_width}px by {width - max_width}px)")
        
        if delete:
            try:
                img_path.unlink()
                print(f"  ✓ Deleted")
                deleted_count += 1
            except Exception as e:
                print(f"  ✗ Error deleting: {e}")
        print()
    
    if delete:
        print(f"\n{'='*80}")
        print(f"SUMMARY: Deleted {deleted_count} oversized flowers")
        print(f"{'='*80}")
        print("\n⚠️  Don't forget to regenerate manifest.json:")
        print("   python3 scripts/prep_assets.py --output ./public/flowers")


def main() -> None:
    parser = argparse.ArgumentParser(description="Find oversized flower images (no wider than 50% of vase).")
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("./public/flowers"),
        help="Source directory with flower images.",
    )
    parser.add_argument(
        "--vase-dir",
        type=Path,
        default=Path("./public/vases"),
        help="Directory containing vase images.",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Delete oversized flowers (default: just list them).",
    )
    args = parser.parse_args()
    
    if not args.source.exists():
        print(f"Error: Source directory not found: {args.source}")
        return
    
    if not args.vase_dir.exists():
        print(f"Error: Vase directory not found: {args.vase_dir}")
        return
    
    # Get max flower width (50% of vase width)
    max_flower_width = get_vase_max_width(args.vase_dir)
    
    find_oversized_flowers(args.source, max_flower_width, args.delete)


if __name__ == "__main__":
    main()
