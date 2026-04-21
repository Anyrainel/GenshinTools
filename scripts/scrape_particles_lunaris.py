#!/usr/bin/env python3
"""
Scrape per-character particle energy data from the lunaris.moe API.

Lunaris is the datamine source. Its `energy` field contains the full
probabilistic per-event particle distribution (source, particles, chance, cd)
— which maps cleanly onto the ER calculator's v2 Particles schema
`[[count, chance], ...]`.

Writes: src/data/ercalc/particles.lunaris.json

This file is a side-by-side reference only — not consumed in production.
The production particle data is produced by scripts/scrape_particles.py
from Fandom wiki and tagged `source: "fandom"`. This Lunaris file exists for
manual drift review and for sourcing unreleased characters.

Output schema per character:
  {
    "element": "<Element>",
    "rarity": 4 | 5,
    "events": [
      {
        "source": "Ball1",     // game-internal tag (Ball1/Ball2 often = press/hold variants)
        "particles": 2,
        "chance": 1.0,
        "cd": "0.3s"           // as reported by Lunaris ("Instant", "0.3s", "1.5s", ...)
      },
      ...
    ]
  }

Interpretation is left to manual review. Events sharing the same `source` + `cd`
are sometimes independent rolls on one cast (e.g. Bennett Ball1 = 2@100% + 1@25%)
and sometimes mutually-exclusive skill variants (e.g. Cyno's 3 entries cover
normal vs burst-state E). The schema is deliberately raw to preserve this
ambiguity for review.

Data source: https://api.lunaris.moe/data/{version}/en/char/{numeric_id}.json
"""

import json
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lunaris import API_BASE, RARITY_MAP, derive_id  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "src" / "data" / "ercalc" / "particles.lunaris.json"

TRAVELER_ELEMENT_MAP = {
    "Anemo": "traveler_anemo",
    "Dendro": "traveler_dendro",
    "Electro": "traveler_electro",
    "Geo": "traveler_geo",
    "Hydro": "traveler_hydro",
    "Pyro": "traveler_pyro",
}


def normalize_id(en_name: str, element: str | None) -> str | None:
    """Map Lunaris character name → our character ID."""
    m = re.match(r"Traveler\s*\((\w+)\)", en_name)
    if m:
        return TRAVELER_ELEMENT_MAP.get(m.group(1))
    base = derive_id(en_name)
    if base == "traveler":
        # Fallback: map by element if name is just "Traveler"
        return TRAVELER_ELEMENT_MAP.get(element or "") if element else None
    return base


def parse_chance(s: str) -> float | None:
    """'80%' → 0.8, '100%' → 1.0"""
    s = (s or "").strip().rstrip("%")
    try:
        return round(float(s) / 100, 4)
    except ValueError:
        return None


def parse_int(s) -> int | None:
    try:
        return int(str(s).strip())
    except (ValueError, TypeError):
        return None


def normalize_events(energy: list[dict]) -> list[dict]:
    """Normalize raw energy entries: parse int particles, "80%" → 0.8.
    Order is preserved (matches Lunaris response order).
    """
    out: list[dict] = []
    for e in energy:
        particles = parse_int(e.get("particles"))
        chance = parse_chance(e.get("chance", ""))
        if particles is None or chance is None:
            continue
        out.append(
            {
                "source": str(e.get("source", "")).strip(),
                "particles": particles,
                "chance": chance,
                "cd": str(e.get("cd", "")).strip(),
            }
        )
    return out


def fetch(url: str) -> dict:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.json()


def main() -> None:
    print("Fetching latest Lunaris data version...")
    version = fetch("https://api.lunaris.moe/data/version.json")["version"]
    print(f"  version: {version}")

    charlist = fetch(f"{API_BASE}/{version}/charlist.json")
    print(f"  charlist: {len(charlist)} entries")

    output: dict[str, dict] = {}
    skipped_no_element = 0
    skipped_low_rarity = 0
    errors: list[tuple[str, str]] = []

    for num_id, meta in charlist.items():
        en_name = (meta.get("enName") or "").strip()
        if not en_name:
            continue
        element = meta.get("element")
        if not element or element == "Unknown":
            skipped_no_element += 1
            continue
        rarity = RARITY_MAP.get(meta.get("qualityType", ""), 0)
        if rarity < 4:
            skipped_low_rarity += 1
            continue

        cid = normalize_id(en_name, element)
        if not cid:
            continue
        if cid in output:
            continue  # dedupe traveler variants

        try:
            data = fetch(f"{API_BASE}/{version}/en/char/{num_id}.json")
        except requests.HTTPError as e:
            errors.append((cid, str(e)))
            continue
        except Exception as e:
            errors.append((cid, repr(e)))
            continue

        energy = data.get("energy") or []
        entry: dict = {
            "element": element,
            "rarity": rarity,
            "events": normalize_events(energy),
        }
        output[cid] = entry
        time.sleep(0.05)  # courtesy delay

    print(
        f"\nScraped {len(output)} characters"
        f" (skipped {skipped_no_element} no-element, {skipped_low_rarity} low-rarity,"
        f" {len(errors)} errors)"
    )
    for cid, err in errors[:10]:
        print(f"  err {cid}: {err}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {len(output)} characters to {OUT_PATH}")


if __name__ == "__main__":
    main()
