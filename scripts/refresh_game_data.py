"""Delegate the full released-data refresh to HoyoData's GenshinTools target."""

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def refresh(
    root: Path,
    hoyodata_root: Path,
    *,
    pull: bool = True,
    cached_sources: bool = False,
    dry_run: bool = False,
) -> int:
    if not (hoyodata_root / "src/hoyodata/cli.py").is_file():
        raise ValueError(f"HoyoData checkout not found: {hoyodata_root}; use --hoyodata-root")
    command = ["uv", "run", "hoyodata", "genshintools", "--website-root", str(root)]
    if pull and not cached_sources:
        command.append("--pull")
    if cached_sources:
        command.append("--cached-sources")
    if dry_run:
        command.append("--dry-run")
    env = dict(os.environ)
    env.pop("VIRTUAL_ENV", None)
    return subprocess.run(command, cwd=hoyodata_root, env=env, check=False).returncode


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hoyodata-root", type=Path, default=ROOT.parent / "HoyoData")
    parser.add_argument("--skip-pull", action="store_true", help="Export the existing raw checkout")
    parser.add_argument("--cached-sources", action="store_true", help="Use cached website sources")
    parser.add_argument("--dry-run", action="store_true", help="Print export steps without writes")
    args = parser.parse_args(argv)
    try:
        return refresh(
            ROOT,
            args.hoyodata_root.resolve(),
            pull=not args.skip_pull,
            cached_sources=args.cached_sources,
            dry_run=args.dry_run,
        )
    except (OSError, ValueError) as error:
        print(f"Refresh failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
