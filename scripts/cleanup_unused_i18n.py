#!/usr/bin/env python3
"""
Script to find and remove unused i18n entries from i18n-app.ts

Usage:
  python scripts/cleanup_unused_i18n.py           # Remove unused entries
  python scripts/cleanup_unused_i18n.py --dry-run # Only show unused entries
"""

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any


def find_ts_tsx_files(directory: Path) -> list[str]:
    """Recursively find all .ts and .tsx files."""
    exclude_dirs: set[str] = {"node_modules", ".git", "dist", "build", "scripts"}
    files: list[str] = []

    for root, dirs, filenames in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]

        for filename in filenames:
            if filename.endswith((".ts", ".tsx")):
                files.append(os.path.join(root, filename))

    return files


def extract_i18n_data(file_path: Path) -> tuple[str, dict[str, Any]]:
    """Extract the i18n data object from the TypeScript file."""
    with open(file_path, "r", encoding="utf-8") as f:
        content: str = f.read()

    match: re.Match[str] | None = re.search(r"export const i18nAppData = ({[\s\S]+});", content)
    if not match:
        raise ValueError("Could not find i18nAppData export in file")

    json_str: str = match.group(1)
    json_str = re.sub(r",(\s*[}\]])", r"\1", json_str)

    data: dict[str, Any] = json.loads(json_str)

    return content, data


def flatten_keys(obj: dict[str, Any], prefix: str = "") -> list[str]:
    """Recursively flatten nested object keys into dot notation."""
    keys: list[str] = []

    for key, value in obj.items():
        full_key: str = f"{prefix}.{key}" if prefix else key

        if isinstance(value, dict) and "en" in value and "zh" in value:
            keys.append(full_key)
        elif isinstance(value, dict):
            keys.extend(flatten_keys(value, full_key))

    return keys


def check_key_usage(key: str, files: list[str], i18n_file_path: Path) -> bool:
    """Check if a key is used in any file (excluding i18n file itself)."""
    search_key: str = key.replace("ui.", "", 1) if key.startswith("ui.") else key

    for file_path in files:
        if os.path.samefile(file_path, i18n_file_path):
            continue

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content: str = f.read()
                if search_key in content:
                    return True
        except Exception:
            continue

    return False


def remove_unused_keys(data: dict[str, Any], unused_keys: list[str]) -> dict[str, Any]:
    """Remove unused keys from the data structure."""
    for key in unused_keys:
        parts: list[str] = key.split(".")

        current: Any = data
        for part in parts[:-1]:
            if part not in current:
                break
            current = current[part]
        else:
            if parts[-1] in current:
                del current[parts[-1]]

    return data


def write_i18n_file(file_path: Path, original_content: str, data: dict[str, Any]) -> None:
    """Write the updated i18n data back to the file."""
    json_str: str = json.dumps(data, ensure_ascii=False, indent=2)

    new_content: str = re.sub(
        r"export const i18nAppData = {[\s\S]+};",
        f"export const i18nAppData = {json_str};",
        original_content,
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)


def main() -> None:
    parser: argparse.ArgumentParser = argparse.ArgumentParser(
        description="Find and remove unused i18n entries from i18n-app.ts"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only show unused entries without modifying the file",
    )

    args: argparse.Namespace = parser.parse_args()

    script_dir: Path = Path(__file__).parent
    project_root: Path = script_dir.parent
    i18n_file: Path = project_root / "src" / "data" / "i18n-app.ts"
    src_dir: Path = project_root / "src"

    print(f"Reading i18n file: {i18n_file}")

    original_content: str
    data: dict[str, Any]
    original_content, data = extract_i18n_data(i18n_file)

    all_keys: list[str] = []
    if "ui" in data:
        all_keys = flatten_keys(data["ui"], "ui")

    print(f"Found {len(all_keys)} i18n keys")

    print(f"Scanning for TypeScript files in: {src_dir}")
    files: list[str] = find_ts_tsx_files(src_dir)
    print(f"Found {len(files)} TypeScript/TSX files")

    print("\nChecking key usage...")
    unused_keys: list[str] = []
    used_keys: list[str] = []

    for key in all_keys:
        if check_key_usage(key, files, i18n_file):
            used_keys.append(key)
        else:
            unused_keys.append(key)

    print("\n" + "=" * 60)
    print("UNUSED i18n KEYS")
    print("=" * 60)
    print(f"Total unused: {len(unused_keys)}\n")

    for key in unused_keys:
        print(f"  {key}")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total keys: {len(all_keys)}")
    print(f"Used: {len(used_keys)}")
    print(f"Unused: {len(unused_keys)}")

    if not args.dry_run and unused_keys:
        print("\n" + "=" * 60)
        print("REMOVING UNUSED KEYS")
        print("=" * 60)

        updated_data: dict[str, Any] = remove_unused_keys(data, unused_keys)
        write_i18n_file(i18n_file, original_content, updated_data)

        print(f"✓ Removed {len(unused_keys)} unused entries from {i18n_file}")
    elif args.dry_run and unused_keys:
        print("\n(Dry run mode - no changes made)")
    elif not unused_keys:
        print("\nNo unused keys found!")


if __name__ == "__main__":
    main()
