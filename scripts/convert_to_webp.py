#!/usr/bin/env python3
"""One-off script to convert all PNG images in public/ to WebP."""

import os

from PIL import Image
from tqdm import tqdm

# Directories with small UI icons get lossless compression
LOSSLESS_DIRS = {"element", "weapontype"}


def convert_directory(base_dir: str, subdir: str) -> tuple[int, int, int]:
    """Convert all PNGs in base_dir/subdir to WebP. Returns (count, bytes_before, bytes_after)."""
    directory = os.path.join(base_dir, subdir)
    if not os.path.isdir(directory):
        return 0, 0, 0

    lossless = subdir in LOSSLESS_DIRS
    pngs = [f for f in os.listdir(directory) if f.lower().endswith(".png")]
    count = 0
    bytes_before = 0
    bytes_after = 0

    for filename in tqdm(pngs, desc=f"  {subdir}", unit="img"):
        png_path = os.path.join(directory, filename)
        webp_path = os.path.join(directory, os.path.splitext(filename)[0] + ".webp")

        png_size = os.path.getsize(png_path)
        bytes_before += png_size

        try:
            img = Image.open(png_path)
            img.save(webp_path, "WEBP", quality=90, lossless=lossless)
            webp_size = os.path.getsize(webp_path)
            bytes_after += webp_size
            os.remove(png_path)
            count += 1
        except Exception as e:
            print(f"  Failed to convert {filename}: {e}")

    return count, bytes_before, bytes_after


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    public_dir = os.path.join(project_root, "public")

    dirs = ["character", "artifact", "weapon", "enemy", "element", "weapontype", "food"]

    total_count = 0
    total_before = 0
    total_after = 0

    print("Converting PNG → WebP...")
    for subdir in dirs:
        count, before, after = convert_directory(public_dir, subdir)
        if count:
            savings = (1 - after / before) * 100 if before else 0
            print(
                f"  {subdir}: {count} images, "
                f"{before // 1024}KB → {after // 1024}KB ({savings:.1f}% smaller)"
            )
        total_count += count
        total_before += before
        total_after += after

    if total_count:
        savings = (1 - total_after / total_before) * 100 if total_before else 0
        print(f"\nTotal: {total_count} images converted")
        print(f"  Before: {total_before // 1024 // 1024}MB")
        print(f"  After:  {total_after // 1024 // 1024}MB")
        print(f"  Saved:  {(total_before - total_after) // 1024 // 1024}MB ({savings:.1f}%)")
    else:
        print("No PNG files found to convert.")


if __name__ == "__main__":
    main()
