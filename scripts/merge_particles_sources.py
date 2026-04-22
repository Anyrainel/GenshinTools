#!/usr/bin/env python3
"""
Merge per-source particle files into src/data/ercalc/particles.json (production).

Priority (highest first):
  1. particles.gcsim.json   — source: "gcsim"   (authoritative when available)
  2. particles.fandom.json  — source: "fandom" | "lunaris"  (Fandom scrape + datamine fallback)

For each character id seen in any source:
  - Use the gcsim entry if present.
  - Otherwise, use the fandom entry.
  - The `source` field on the merged entry reflects which source won.

particles.lunaris.json is NOT consumed here — it's a raw-event reference for
manual cross-validation only.

Design philosophy: each data source writes to its own file. This script is the
one place where the merge decision lives, so reviewers can see exactly what's
being promoted and where.

Usage:
  uv run --project scripts/pyproject.toml scripts/merge_particles_sources.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ERCALC = ROOT / "src" / "data" / "ercalc"
FANDOM_PATH = ERCALC / "particles.fandom.json"
GCSIM_PATH = ERCALC / "particles.gcsim.json"
OUT_PATH = ERCALC / "particles.json"


def load(path: Path) -> dict:
    if not path.exists():
        print(f"WARN: {path.name} not found, treating as empty", file=sys.stderr)
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"ERROR: {path.name}: {e}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    fandom = load(FANDOM_PATH)
    gcsim = load(GCSIM_PATH)

    all_ids = sorted(set(fandom) | set(gcsim))
    merged: dict[str, dict] = {}

    n_gcsim = 0
    n_fandom = 0
    n_lunaris_fallback = 0
    gcsim_only: list[str] = []
    fandom_only: list[str] = []

    for cid in all_ids:
        if cid in gcsim:
            merged[cid] = gcsim[cid]
            n_gcsim += 1
            if cid not in fandom:
                gcsim_only.append(cid)
        else:
            entry = fandom[cid]
            merged[cid] = entry
            fandom_only.append(cid)
            if entry.get("source") == "lunaris":
                n_lunaris_fallback += 1
            else:
                n_fandom += 1

    OUT_PATH.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Merged → {OUT_PATH.relative_to(ROOT)}")
    print(f"  Total characters: {len(merged)}")
    print(f"  From gcsim:          {n_gcsim}")
    print(f"  From fandom:         {n_fandom}")
    print(f"  From lunaris (fallback, via fandom file): {n_lunaris_fallback}")
    if gcsim_only:
        print(f"\n  In gcsim but not fandom ({len(gcsim_only)}): {', '.join(gcsim_only)}")
    if fandom_only:
        print(f"\n  Chars relying on fandom fallback ({len(fandom_only)}):")
        for cid in fandom_only:
            src = fandom[cid].get("source", "?")
            print(f"    {cid} [{src}]")


if __name__ == "__main__":
    main()
