"""Generate public/good/mappings.json with GOOD-format keys.

Extracted from codedump.py — all mappings.json data processing lives here.
"""

import json
import os
import re
from typing import Any

_DEDUPE_PREFIXES = ("traveler_", "manekin_", "manekina_")

# Short element codes for the mappings output
_ELEMENT_SHORT: dict[str, str] = {
    "Anemo": "anemo",
    "Geo": "geo",
    "Electro": "electro",
    "Dendro": "dendro",
    "Hydro": "hydro",
    "Pyro": "pyro",
    "Cryo": "cryo",
}

# Short weapon type codes for the mappings output
_WEAPON_TYPE_SHORT: dict[str, str] = {
    "Sword": "sword",
    "Claymore": "claymore",
    "Polearm": "polearm",
    "Bow": "bow",
    "Catalyst": "catalyst",
}


def _to_good_key(english_name: str) -> str:
    """Convert an English display name to a GOOD key (PascalCase, no punctuation).

    Examples:
        Gladiator's Finale  -> GladiatorsFinale
        Spirit Locket of Boreas -> SpiritLocketOfBoreas
        "The Catch" -> TheCatch
    """
    name = english_name.replace('"', "").replace("'", "")
    words = re.split(r"[^A-Za-z0-9]+", name)
    return "".join(w.capitalize() for w in words if w)


def _parse_char_info(path: str) -> dict[str, dict[str, str]]:
    """Parse charInfo.ts to extract c3Talent/c5Talent per character key."""
    result: dict[str, dict[str, str]] = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = re.match(r"\s+(\w+):\s*\{(.+)\}", line)
            if not m:
                continue
            key = m.group(1)
            body = m.group(2)
            info: dict[str, str] = {}
            for field in ("c3Talent", "c5Talent"):
                fm = re.search(rf'{field}:\s*"([AEQ])"', body)
                if fm:
                    info[field] = fm.group(1)
            if info:
                result[key] = info
    return result


def generate_mappings_json(project_root: str) -> None:
    """Generate public/good/mappings.json with GOOD-format keys and Chinese names."""
    game_dir = os.path.join(project_root, "src", "data", "game")
    out_path = os.path.join(project_root, "public", "good", "mappings.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    # --- Read charInfo.ts for c3/c5 talent data ---
    char_info = _parse_char_info(os.path.join(project_root, "src", "data", "charInfo.ts"))

    # --- Read character_stats.json for element data ---
    with open(os.path.join(game_dir, "character_stats.json"), encoding="utf-8") as f:
        char_stats: dict[str, Any] = json.load(f)

    # --- Characters ---
    chars = []
    seen_base: set[str] = set()
    for rarity in (5, 4):
        with open(os.path.join(game_dir, f"character_{rarity}_en.json"), encoding="utf-8") as f:
            en = json.load(f)
        with open(os.path.join(game_dir, f"character_{rarity}_zh.json"), encoding="utf-8") as f:
            zh = json.load(f)
        for key in en:
            is_variant = any(key.startswith(p) and key != p.rstrip("_") for p in _DEDUPE_PREFIXES)
            base = key.rsplit("_", 1)[0] if is_variant else key
            if base in seen_base:
                continue
            seen_base.add(base)
            entry: dict[str, Any] = {
                "id": _to_good_key(en[key]["name"]),
                "r": rarity,
                "n": {"zh": zh[key]["name"] if key in zh else en[key]["name"]},
            }
            # Add element from character_stats.json
            stats = char_stats.get(base) or char_stats.get(key)
            if stats and "element" in stats:
                short = _ELEMENT_SHORT.get(stats["element"])
                if short:
                    entry["e"] = short
            if base in char_info:
                if "c3Talent" in char_info[base]:
                    entry["c3"] = char_info[base]["c3Talent"]
                if "c5Talent" in char_info[base]:
                    entry["c5"] = char_info[base]["c5Talent"]
            chars.append(entry)
    chars.sort(key=lambda c: c["id"])

    # --- Weapons ---
    with open(os.path.join(game_dir, "weapon_en.json"), encoding="utf-8") as f:
        w_en = json.load(f)
    with open(os.path.join(game_dir, "weapon_zh.json"), encoding="utf-8") as f:
        w_zh = json.load(f)
    with open(os.path.join(game_dir, "weapon_stats.json"), encoding="utf-8") as f:
        w_stats = json.load(f)

    weapons = []
    for key in w_en:
        if key not in w_stats or w_stats[key]["rarity"] < 3:
            continue
        wt_raw = w_stats[key]["type"]
        weapons.append(
            {
                "id": _to_good_key(w_en[key]["name"]),
                "r": w_stats[key]["rarity"],
                "wt": _WEAPON_TYPE_SHORT.get(wt_raw, wt_raw.lower()),
                "n": {"zh": w_zh[key]["name"] if key in w_zh else w_en[key]["name"]},
            }
        )
    weapons.sort(key=lambda w: w["id"])

    # --- Artifact Sets ---
    with open(os.path.join(game_dir, "artifact_en.json"), encoding="utf-8") as f:
        a_en = json.load(f)
    with open(os.path.join(game_dir, "artifact_zh.json"), encoding="utf-8") as f:
        a_zh = json.load(f)

    artifact_sets = []
    for key in a_en:
        rarity = a_en[key].get("rarity")
        if rarity is None or rarity < 4:
            continue
        artifact_sets.append(
            {
                "id": _to_good_key(a_en[key]["name"]),
                "r": rarity,
                "n": {"zh": a_zh[key]["name"] if key in a_zh else a_en[key]["name"]},
            }
        )
    artifact_sets.sort(key=lambda s: s["id"])

    # --- Write ---
    result = {"characters": chars, "weapons": weapons, "artifactSets": artifact_sets}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Written {out_path}")
    print(f"  {len(chars)} characters, {len(weapons)} weapons, {len(artifact_sets)} artifact sets")
