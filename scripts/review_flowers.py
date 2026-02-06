"""
Review flower images and flag suspicious ones (oversized blooms, flat faces).

What it does:
1. Analyzes each image for "problem" characteristics
2. Scores images based on multiple metrics
3. Moves suspicious images to a review/ folder
4. Generates a report of flagged images with reasons

Metrics used:
- Bounding box fill ratio (high = dense/flat bloom)
- Aspect ratio of opaque region (square = face-on flower)
- Transparency ratio (low = solid/dense)
- Vertical distribution (bottom-heavy = stem, top-heavy = bloom)

Usage:
  python scripts/review_flowers.py --source ./public/flowers --review ./review
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

from PIL import Image

IMAGE_EXTS = {".webp", ".png", ".jpg", ".jpeg"}


@dataclass
class ImageScore:
    path: Path
    bbox_fill: float  # % of bounding box filled with opaque pixels (high = dense)
    aspect_ratio: float  # width/height of opaque region (1.0 = square)
    transparency: float  # % of image that is transparent (low = dense)
    vertical_center: float  # 0-1, where 0.5 is centered, <0.5 is top-heavy
    total_score: float  # combined suspicion score
    reasons: List[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Review and flag suspicious flower images.")
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("./public/flowers"),
        help="Source directory with categorized flower images.",
    )
    parser.add_argument(
        "--review",
        type=Path,
        default=Path("./review"),
        help="Directory to move suspicious images to.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=2.0,
        help="Score threshold to flag as suspicious (lower = more strict).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't move files, just generate report.",
    )
    return parser.parse_args()


def analyze_image(img_path: Path) -> ImageScore | None:
    """Analyze an image and return scoring metrics."""
    try:
        with Image.open(img_path) as img:
            img = img.convert("RGBA")
            width, height = img.size
            pixels = list(img.getdata())
            
            # Find opaque pixels and their positions
            opaque_positions = []
            opaque_count = 0
            for i, (r, g, b, a) in enumerate(pixels):
                if a > 128:
                    opaque_count += 1
                    x = i % width
                    y = i // width
                    opaque_positions.append((x, y))
            
            total_pixels = width * height
            if opaque_count == 0:
                return None
            
            # Transparency ratio (higher = more airy/good)
            transparency = 1 - (opaque_count / total_pixels)
            
            # Find bounding box of opaque region
            if opaque_positions:
                xs = [p[0] for p in opaque_positions]
                ys = [p[1] for p in opaque_positions]
                bbox_left, bbox_right = min(xs), max(xs)
                bbox_top, bbox_bottom = min(ys), max(ys)
                bbox_width = bbox_right - bbox_left + 1
                bbox_height = bbox_bottom - bbox_top + 1
                bbox_area = bbox_width * bbox_height
                
                # Bounding box fill ratio (high = dense flat bloom)
                bbox_fill = opaque_count / bbox_area if bbox_area > 0 else 0
                
                # Aspect ratio of opaque region (1.0 = square, >1 = wide, <1 = tall)
                aspect_ratio = bbox_width / bbox_height if bbox_height > 0 else 1
                
                # Vertical center of mass (0 = top, 1 = bottom)
                avg_y = sum(ys) / len(ys)
                vertical_center = avg_y / height
            else:
                bbox_fill = 0
                aspect_ratio = 1
                vertical_center = 0.5
            
            # Calculate suspicion score and reasons
            reasons = []
            score = 0
            
            # Dense/flat bloom detection
            if bbox_fill > 0.65:
                score += 2.0
                reasons.append(f"Very dense bloom ({bbox_fill:.0%} bbox fill)")
            elif bbox_fill > 0.50:
                score += 1.0
                reasons.append(f"Dense bloom ({bbox_fill:.0%} bbox fill)")
            
            # Square/circular (face-on) detection
            if 0.8 < aspect_ratio < 1.25:
                score += 1.5
                reasons.append(f"Square shape (aspect {aspect_ratio:.2f})")
            
            # Low transparency (solid mass)
            if transparency < 0.30:
                score += 1.5
                reasons.append(f"Low transparency ({transparency:.0%})")
            elif transparency < 0.45:
                score += 0.5
                reasons.append(f"Medium transparency ({transparency:.0%})")
            
            # Top-heavy (bloom without stem)
            if vertical_center < 0.42:
                score += 0.5
                reasons.append(f"Top-heavy (center at {vertical_center:.0%})")
            
            # Bonus: very tall/narrow is GOOD (stem-heavy), reduce score
            if aspect_ratio < 0.5:
                score -= 1.0
                reasons.append(f"Tall/narrow shape (good)")
            
            # Bonus: high transparency is GOOD
            if transparency > 0.65:
                score -= 0.5
                reasons.append(f"High transparency (good)")
            
            return ImageScore(
                path=img_path,
                bbox_fill=bbox_fill,
                aspect_ratio=aspect_ratio,
                transparency=transparency,
                vertical_center=vertical_center,
                total_score=max(0, score),
                reasons=reasons,
            )
    except Exception as e:
        print(f"Warning: Could not analyze {img_path.name}: {e}")
        return None


def collect_images(source: Path) -> List[Path]:
    """Recursively collect all flower images."""
    images = []
    for ext in IMAGE_EXTS:
        images.extend(source.rglob(f"*{ext}"))
    # Filter out manifest.json and non-flower directories
    images = [p for p in images if "vases" not in str(p) and "backgrounds" not in str(p)]
    return images


def main() -> None:
    args = parse_args()
    
    images = collect_images(args.source)
    print(f"Found {len(images)} flower images to analyze")
    
    scores: List[ImageScore] = []
    for i, img_path in enumerate(images):
        if i % 50 == 0:
            print(f"Analyzing {i}/{len(images)}...")
        score = analyze_image(img_path)
        if score:
            scores.append(score)
    
    # Sort by score (highest = most suspicious)
    scores.sort(key=lambda s: s.total_score, reverse=True)
    
    # Flag suspicious ones
    suspicious = [s for s in scores if s.total_score >= args.threshold]
    good = [s for s in scores if s.total_score < args.threshold]
    
    print(f"\n{'='*60}")
    print(f"Analysis complete!")
    print(f"  Total images: {len(scores)}")
    print(f"  Suspicious (score >= {args.threshold}): {len(suspicious)}")
    print(f"  Good (score < {args.threshold}): {len(good)}")
    print(f"{'='*60}\n")
    
    # Show top suspicious
    print("Top 20 most suspicious images:")
    for s in suspicious[:20]:
        print(f"  [{s.total_score:.1f}] {s.path.name}")
        for r in s.reasons:
            print(f"        - {r}")
    
    if suspicious and not args.dry_run:
        # Create review folder structure
        args.review.mkdir(parents=True, exist_ok=True)
        
        # Move suspicious files, preserving palette/bucket structure
        moved = 0
        for s in suspicious:
            # Extract relative path from source
            try:
                rel_path = s.path.relative_to(args.source)
            except ValueError:
                rel_path = Path(s.path.name)
            
            dest = args.review / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(s.path), str(dest))
            moved += 1
        
        print(f"\nMoved {moved} suspicious images to {args.review}/")
        print("Review them and delete the bad ones, then move good ones back.")
    
    # Generate CSV report
    report_path = args.review / "review_report.csv" if not args.dry_run else Path("review_report.csv")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "score", "bbox_fill", "aspect_ratio", "transparency", "vertical_center", "reasons"])
        for s in scores:
            writer.writerow([
                s.path.name,
                f"{s.total_score:.2f}",
                f"{s.bbox_fill:.2f}",
                f"{s.aspect_ratio:.2f}",
                f"{s.transparency:.2f}",
                f"{s.vertical_center:.2f}",
                "; ".join(s.reasons),
            ])
    
    print(f"Full report saved to {report_path}")
    
    if args.dry_run:
        print("\n(Dry run - no files were moved)")


if __name__ == "__main__":
    main()
