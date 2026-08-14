#!/usr/bin/env python3
"""
Step 1 of selfEnergy.json generation: identify candidate characters.

This script scans game data for characters with energy recovery effects
in their passives, constellations, or skill detail tables. It outputs
a list of candidates with the raw source text for agent review.

Step 2: An agent reads each candidate's full kit via impl_audit.py
and determines the correct action association, amount, and nuances.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beta_files import read_beta_json  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GAME_DIR = ROOT / "src" / "data" / "game"

CHAR_ZH_PATHS = [
    GAME_DIR / "character_4_zh.json",
    GAME_DIR / "character_5_zh.json",
    GAME_DIR / "character_beta_zh.json.gz",
]


def load_zh_data() -> dict:
    data = {}
    for path in CHAR_ZH_PATHS:
        if not path.exists():
            continue
        if path.suffix == ".gz":
            data.update(read_beta_json(path))
        else:
            with open(path, encoding="utf-8") as f:
                data.update(json.load(f))
    return data


def has_energy_recovery(text: str) -> bool:
    """Check if text mentions energy recovery."""
    if "能量" not in text:
        return False
    return any(kw in text for kw in ("恢复", "回复", "获得", "返还", "产生"))


def main():
    zh_data = load_zh_data()
    candidates = {}

    for char_id, char_data in sorted(zh_data.items()):
        if char_id.startswith("manekin"):
            continue

        sources = []

        # Check skill detail tables
        skills = char_data.get("skills", [])
        for skill in skills:
            name = skill.get("name", "")
            for detail in skill.get("details", []):
                label = detail["label"]
                if label == "元素能量":  # Skip burst cost
                    continue
                if has_energy_recovery(label):
                    skill_key = "A"
                    if name.startswith("E.") or (len(skills) > 1 and skill is skills[1]):
                        skill_key = "E"
                    elif name.startswith("Q.") or (len(skills) > 2 and skill is skills[2]):
                        skill_key = "Q"
                    sources.append(f"[{skill_key}] detail: {label} = {detail['template']}")

        # Check passives
        for i, p in enumerate(char_data.get("passives", [])):
            plain = re.sub(r"<[^>]+>", "", p.get("descHtml", ""))
            if has_energy_recovery(plain):
                sources.append(f"[P{i + 1}] {p.get('name', '')}: {plain[:150]}")

        # Check constellations
        for i, c in enumerate(char_data.get("constellations", [])):
            plain = re.sub(r"<[^>]+>", "", c.get("descHtml", ""))
            if has_energy_recovery(plain):
                sources.append(f"[C{i + 1}] {c.get('name', '')}: {plain[:150]}")

        if sources:
            candidates[char_id] = sources

    # Output as simple text for agent consumption
    print(f"Found {len(candidates)} candidates with energy recovery effects:\n")
    for char_id, sources in candidates.items():
        print(f"### {char_id}")
        for s in sources:
            print(f"  {s}")
        print()


if __name__ == "__main__":
    main()
