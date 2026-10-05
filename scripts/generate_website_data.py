"""Generate GenshinTools website outputs after HoyoData exports source data.

Internal pipeline stage; use npm run data:refresh for the complete export.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from mappings import _to_good_key
from ts_reader import extract_json_from_ts

ROOT = Path(__file__).resolve().parent.parent


def validate_outputs(root: Path) -> None:
    game = root / "src" / "data" / "game"
    mappings = json.loads((root / "public" / "good" / "mappings.json").read_text("utf-8"))
    sources = {
        "characters": ["character_4_en.json", "character_5_en.json"],
        "weapons": ["weapon_en.json"],
        "artifactSets": ["artifact_en.json"],
    }
    weapon_stats = json.loads((game / "weapon_stats.json").read_text("utf-8"))
    for section, files in sources.items():
        entries = mappings[section]
        actual = {entry["id"]: entry for entry in entries}
        if len(actual) != len(entries) or not actual:
            raise ValueError(f"{section}: empty mappings or duplicate GOOD keys")
        expected = set()
        for filename in files:
            source = json.loads((game / filename).read_text("utf-8"))
            for key, entry in source.items():
                if section == "weapons" and (
                    key not in weapon_stats or weapon_stats[key]["rarity"] < 3
                ):
                    continue
                if section == "artifactSets" and (entry.get("rarity") or 0) < 4:
                    continue
                expected.add(_to_good_key(entry["name"]))
        if missing := expected - actual.keys():
            raise ValueError(f"{section}: missing GOOD mappings: {sorted(missing)}")
        for key, entry in actual.items():
            if not entry["n"].get("zh"):
                raise ValueError(f"{section}: missing Chinese name for {key}")
        print(f"Validated {section}: {len(actual)} GOOD mappings", flush=True)

    resource_source = (root / "src" / "data" / "resources.ts").read_text("utf-8")
    roster = {entry["id"] for entry in extract_json_from_ts(resource_source, "characters")}
    for filename in sources["characters"]:
        required = json.loads((game / filename).read_text("utf-8"))
        if missing := required.keys() - roster:
            raise ValueError(f"Website character catalog is missing: {sorted(missing)}")
    for section in (
        "characters",
        "weapons",
        "artifacts",
        "elementResources",
        "weaponTypeResources",
    ):
        resources = extract_json_from_ts(resource_source, section)
        if not resources:
            raise ValueError(f"Website catalog is empty: {section}")
        for entry in resources:
            paths = [entry["imagePath"]] if "imagePath" in entry else entry["imagePaths"].values()
            for path in paths:
                asset = root / "public" / path.lstrip("/")
                if not asset.is_file() or not asset.stat().st_size:
                    raise ValueError(f"Missing website asset: {asset}")


def generate(
    root: Path,
    *,
    cached_sources: bool = False,
    dry_run: bool = False,
) -> int:
    commands: list[tuple[str, list[str], Path]] = []
    if not cached_sources:
        commands.append(
            (
                "Refresh website catalogs, artifact half sets, and artwork",
                [
                    sys.executable,
                    str(root / "scripts" / "codedump.py"),
                    "--character",
                    "--weapon",
                    "--artifact",
                ],
                root,
            )
        )
    else:
        commands.append(
            (
                "Rebuild artifact half sets from existing game JSON",
                [sys.executable, str(root / "scripts" / "codedump.py"), "--half-set"],
                root,
            )
        )
    commands.extend(
        [
            (
                "Regenerate character metadata",
                [sys.executable, str(root / "scripts" / "gen_char_info.py")],
                root,
            ),
            (
                "Regenerate Enka stat IDs and GOODScanner mappings",
                [sys.executable, str(root / "scripts" / "codedump.py"), "--enka", "--good-keys"],
                root,
            ),
            (
                "Check scheduled boss artwork",
                ["node", str(root / "scripts" / "dev" / "check-leyline-boss-icons.js")],
                root,
            ),
        ]
    )
    for label, command, cwd in commands:
        print(f"\n=== {label} ===", flush=True)
        if dry_run:
            print(f"cwd={cwd}\n{subprocess.list2cmdline(command)}", flush=True)
            continue
        env = dict(os.environ)
        if command[0] == "uv":
            env.pop("VIRTUAL_ENV", None)
        completed = subprocess.run(command, cwd=cwd, env=env, check=False)
        if completed.returncode:
            print(f"Refresh stopped: {label} (exit {completed.returncode})", file=sys.stderr)
            return completed.returncode
    if not dry_run:
        validate_outputs(root)
        print(
            "Website generation and coverage checks complete. "
            "Review the generated diff before publishing."
        )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cached-sources",
        action="store_true",
        help="Rebuild derived outputs from existing game JSON and catalogs without network access",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print steps without writing files")
    args = parser.parse_args(argv)
    try:
        return generate(
            ROOT,
            cached_sources=args.cached_sources,
            dry_run=args.dry_run,
        )
    except (OSError, ValueError, KeyError) as error:
        print(f"Refresh failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
