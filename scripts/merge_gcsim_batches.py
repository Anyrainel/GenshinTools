#!/usr/bin/env python3
"""
Merge per-agent batch files into src/data/ercalc/particles.gcsim.json.

Inputs:  scripts/out/particles.gcsim.batch_*.json
Output:  src/data/ercalc/particles.gcsim.json

Validates each entry against the v2 schema (loose — just shape, not every
value). Reports:
  - Total entries merged
  - Entries with _unmodeled notes (for human review)
  - Duplicate keys across batches (should be zero)
  - Schema validation warnings

Does NOT touch particles.json (production) or particles.lunaris.json
(reference). Promotion to production is a manual step after review.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH_DIR = ROOT / "scripts" / "out"
BATCH_GLOB = "particles.gcsim.batch_*.json"
OUT_PATH = ROOT / "src" / "data" / "ercalc" / "particles.gcsim.json"

VALID_ELEMENTS = {"Pyro", "Hydro", "Electro", "Cryo", "Anemo", "Geo", "Dendro"}
VALID_ACTION_KEYS = {"E", "holdE", "specialE", "Q", "specialQ", "NA", "CA", "PA"}
VALID_PERIODIC_KEYS = {"E", "Q"}


def validate_particles(p, path: str) -> list[str]:
    """Return a list of warning strings. Empty list = clean."""
    warns: list[str] = []
    if isinstance(p, (int, float)):
        if p < 0:
            warns.append(f"{path}: negative particle count {p}")
        return warns
    if not isinstance(p, list):
        warns.append(f"{path}: particles must be int or array, got {type(p).__name__}")
        return warns
    for i, roll in enumerate(p):
        if not isinstance(roll, list) or len(roll) != 2:
            warns.append(f"{path}[{i}]: expected [count, chance], got {roll!r}")
            continue
        count, chance = roll
        if not isinstance(count, (int, float)) or count < 0:
            warns.append(f"{path}[{i}]: invalid count {count!r}")
        if not isinstance(chance, (int, float)) or not (0 <= chance <= 1):
            warns.append(f"{path}[{i}]: chance must be in [0, 1], got {chance!r}")
    return warns


def validate_entry(cid: str, entry: dict) -> list[str]:
    warns: list[str] = []
    if not isinstance(entry, dict):
        return [f"{cid}: entry must be an object"]
    elem = entry.get("element")
    if elem is None:
        warns.append(f"{cid}: missing element")
    elif elem not in VALID_ELEMENTS:
        warns.append(f"{cid}: unknown element {elem!r}")
    if entry.get("source") != "gcsim":
        warns.append(f"{cid}: source must be 'gcsim', got {entry.get('source')!r}")
    for key in VALID_ACTION_KEYS:
        if key in entry:
            cfg = entry[key]
            if not isinstance(cfg, dict):
                warns.append(f"{cid}.{key}: must be an object")
                continue
            if "pattern" in cfg:
                if not isinstance(cfg["pattern"], list):
                    warns.append(f"{cid}.{key}.pattern: must be a list")
            elif "particles" in cfg:
                warns += validate_particles(cfg["particles"], f"{cid}.{key}.particles")
            else:
                warns.append(f"{cid}.{key}: missing particles/pattern")
    if "periodic" in entry:
        for pkey, pcfg in entry["periodic"].items():
            if pkey not in VALID_PERIODIC_KEYS:
                warns.append(f"{cid}.periodic.{pkey}: unknown trigger")
            if not isinstance(pcfg, dict):
                warns.append(f"{cid}.periodic.{pkey}: must be an object")
                continue
            if "procs" not in pcfg or not isinstance(pcfg["procs"], int):
                warns.append(f"{cid}.periodic.{pkey}: missing/invalid procs")
            if "particles" not in pcfg:
                warns.append(f"{cid}.periodic.{pkey}: missing particles")
            else:
                warns += validate_particles(pcfg["particles"], f"{cid}.periodic.{pkey}.particles")
    # Unknown top-level fields
    allowed_top = {"element", "source", "spawnPoint", "periodic", "_unmodeled"} | VALID_ACTION_KEYS
    extra = set(entry.keys()) - allowed_top
    if extra:
        warns.append(f"{cid}: unknown fields {sorted(extra)}")
    return warns


def main() -> None:
    batches = sorted(BATCH_DIR.glob(BATCH_GLOB))
    if not batches:
        print(f"No batch files found matching {BATCH_DIR}/{BATCH_GLOB}", file=sys.stderr)
        sys.exit(1)

    merged: dict[str, dict] = {}
    source_of: dict[str, str] = {}  # cid -> batch file
    duplicates: list[tuple[str, str, str]] = []  # (cid, batch_a, batch_b)
    all_warnings: list[str] = []

    for batch_path in batches:
        try:
            batch = json.loads(batch_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"ERROR: {batch_path.name}: {e}", file=sys.stderr)
            sys.exit(1)
        if not isinstance(batch, dict):
            print(f"ERROR: {batch_path.name}: root must be an object", file=sys.stderr)
            sys.exit(1)

        for cid, entry in batch.items():
            if cid in merged:
                duplicates.append((cid, source_of[cid], batch_path.name))
                continue
            warnings = validate_entry(cid, entry)
            if warnings:
                all_warnings.extend(f"[{batch_path.name}] {w}" for w in warnings)
            merged[cid] = entry
            source_of[cid] = batch_path.name

    # Write merged output (sorted by char_id)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ordered = dict(sorted(merged.items()))
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(ordered, f, indent=2, ensure_ascii=False)

    # Report
    print(f"Merged {len(batches)} batches → {OUT_PATH}")
    print(f"  Total characters: {len(merged)}")
    unmodeled = [c for c, e in merged.items() if e.get("_unmodeled")]
    print(f"  Entries with _unmodeled notes: {len(unmodeled)}")
    if unmodeled:
        print(f"    {', '.join(unmodeled)}")
    if duplicates:
        print("\n  DUPLICATE KEYS (should be zero — agents wrote overlapping chars):")
        for cid, a, b in duplicates:
            print(f"    {cid}: first in {a}, also in {b}")
    if all_warnings:
        print(f"\n  Schema warnings ({len(all_warnings)}):")
        for w in all_warnings:
            print(f"    {w}")


if __name__ == "__main__":
    main()
