"""
Scrape unreleased character and weapon data from lunaris.moe API.

Auto-detects unreleased entities by comparing lunaris charlist/weaponlist
against existing character_stats.json and weapon_stats.json.

Usage:
  uv run --project scripts/pyproject.toml scripts/lunaris.py
  uv run --project scripts/pyproject.toml scripts/lunaris.py --force

Output files (under src/data/game/):
  character_beta_stats.json, character_beta_en.json, character_beta_zh.json
  weapon_beta_stats.json, weapon_beta_en.json, weapon_beta_zh.json
  src/data/resources_beta.ts
  public/beta/character/{id}.webp, public/beta/weapon/{id}.webp
"""

import argparse
import json
import re
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "src" / "data" / "game"
RESOURCES_BETA_PATH = PROJECT_ROOT / "src" / "data" / "resources_beta.ts"
ICON_DIR_CHAR = PROJECT_ROOT / "public" / "beta" / "character"
ICON_DIR_WEAPON = PROJECT_ROOT / "public" / "beta" / "weapon"

CHARACTER_STATS_PATH = DATA_DIR / "character_stats.json"
WEAPON_STATS_PATH = DATA_DIR / "weapon_stats.json"

BETA_CHARACTER_EN_PATH = DATA_DIR / "character_beta_en.json"
BETA_CHARACTER_ZH_PATH = DATA_DIR / "character_beta_zh.json"
BETA_CHARACTER_STATS_PATH = DATA_DIR / "character_beta_stats.json"

BETA_WEAPON_EN_PATH = DATA_DIR / "weapon_beta_en.json"
BETA_WEAPON_ZH_PATH = DATA_DIR / "weapon_beta_zh.json"
BETA_WEAPON_STATS_PATH = DATA_DIR / "weapon_beta_stats.json"

API_BASE = "https://api.lunaris.moe/data"
ASSETS_BASE = "https://api.lunaris.moe/data/assets"

# ---------------------------------------------------------------------------
# Mappings
# ---------------------------------------------------------------------------
ASCENSION_STAT_MAP: dict[str, str] = {
    "crit rate%": "cr",
    "crit dmg%": "cd",
    "atk%": "atk%",
    "hp%": "hp%",
    "def%": "def%",
    "energy recharge%": "er",
    "elemental mastery": "em",
    "physical dmg bonus%": "phys%",
    "pyro dmg bonus%": "pyro%",
    "hydro dmg bonus%": "hydro%",
    "electro dmg bonus%": "electro%",
    "cryo dmg bonus%": "cryo%",
    "anemo dmg bonus%": "anemo%",
    "geo dmg bonus%": "geo%",
    "dendro dmg bonus%": "dendro%",
    "healing bonus%": "heal%",
}

WEAPON_SUBSTAT_MAP: dict[str, str] = {
    "crit dmg%": "cd",
    "crit rate%": "cr",
    "atk%": "atk%",
    "hp%": "hp%",
    "def%": "def%",
    "energy recharge%": "er",
    "elemental mastery": "em",
    "physical dmg bonus%": "phys%",
}

RARITY_MAP: dict[str, int] = {
    "QUALITY_ORANGE": 5,
    "QUALITY_ORANGE_SP": 5,
    "QUALITY_PURPLE": 4,
    "QUALITY_BLUE": 3,
    "QUALITY_GREEN": 2,
    "QUALITY_GRAY": 1,
}

WEAPON_TYPE_MAP: dict[str, str] = {
    "WEAPON_BOW": "Bow",
    "WEAPON_SWORD_ONE_HAND": "Sword",
    "WEAPON_CLAYMORE": "Claymore",
    "WEAPON_POLE": "Polearm",
    "WEAPON_CATALYST": "Catalyst",
}

# Region mapping: lunaris API may provide associationType or similar hints.
# Map known association IDs to region names. The lunaris charlist entries
# sometimes include an "associationType" field with values like
# ASSOC_TYPE_MONDSTADT, etc.
# Ascension stats that are percentages (need "%" suffix in output).
# Only "em" (Elemental Mastery) is a flat stat.
PERCENT_ASCENSION_STATS: set[str] = {
    "cr",
    "cd",
    "atk%",
    "hp%",
    "def%",
    "er",
    "heal%",
    "phys%",
    "pyro%",
    "hydro%",
    "electro%",
    "cryo%",
    "anemo%",
    "geo%",
    "dendro%",
}

# IDs to skip in unreleased detection (not beta content)
SKIP_DERIVED_IDS: set[str] = {"traveler"}

# Manual overrides for data the API doesn't provide or gets wrong
REGION_OVERRIDES: dict[str, str] = {
    "linnea": "Snezhnaya",
}

ASSOCIATION_REGION_MAP: dict[str, str] = {
    "ASSOC_TYPE_MONDSTADT": "Mondstadt",
    "ASSOC_TYPE_LIYUE": "Liyue",
    "ASSOC_TYPE_INAZUMA": "Inazuma",
    "ASSOC_TYPE_SUMERU": "Sumeru",
    "ASSOC_TYPE_FONTAINE": "Fontaine",
    "ASSOC_TYPE_NATLAN": "Natlan",
    "ASSOC_TYPE_SNEZHNAYA": "Snezhnaya",
    "ASSOC_TYPE_NOD_KRAI": "Nod-Krai",
    "ASSOC_TYPE_FATUI": "Snezhnaya",
    "ASSOC_TYPE_MAINACTOR": "None",
    "ASSOC_TYPE_RANGER": "None",
}


def _normalize_stat_key(raw: str, mapping: dict[str, str]) -> str:
    key = raw.lower().strip()
    if key in mapping:
        return mapping[key]
    stripped = re.sub(r"[\s_%]+", "", key)
    return stripped


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
def load_json(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_json_minified(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def derive_id(name: str) -> str:
    """e.g. 'Hu Tao' -> 'hu_tao', 'Linnea' -> 'linnea'"""
    cleaned = re.sub(r"[^\w\s]", "", name.lower())
    return re.sub(r"\s+", "_", cleaned.strip())


def color_tags_to_spans(html: str) -> str:
    result = re.sub(r"</color(?:=[^>]*)?>", "</span>", html)

    def replace_open(m: re.Match) -> str:
        hex_val = m.group(1)
        if len(hex_val) == 8:
            hex_val = hex_val[:6]
        return f'<span style="color: #{hex_val.upper()};">'

    result = re.sub(r"<color=#([0-9a-fA-F]+)>", replace_open, result)
    return result


def _clean_desc_html(html: str) -> str:
    result = re.sub(r"\{LINK#[^}]*\}", "", html)
    result = re.sub(r"\{/LINK\}", "", result)
    result = re.sub(r"<a\b[^>]*>", "", result)
    result = result.replace("</a>", "")
    result = result.replace("\\n", "<br/>")
    return result


def _format_desc(raw: str) -> str:
    return _clean_desc_html(color_tags_to_spans(raw))


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def fetch_json(url: str) -> dict:
    print(f"  Fetching {url}")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


def download_icon(url: str, dest: Path) -> None:
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Downloading icon -> {dest.relative_to(PROJECT_ROOT)}")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    dest.write_bytes(resp.content)


def get_latest_version() -> str:
    data = fetch_json(f"{API_BASE}/version.json")
    return data["version"]


# ---------------------------------------------------------------------------
# Auto-detection
# ---------------------------------------------------------------------------
def find_unreleased_characters(
    charlist: dict, existing_ids: set[str]
) -> list[tuple[str, str, dict]]:
    """Returns list of (numeric_id, derived_id, meta) for unreleased characters."""
    unreleased = []
    seen_ids: set[str] = set()
    for num_id, meta in charlist.items():
        en_name = meta.get("enName", "")
        if not en_name:
            continue
        # Skip characters with no/unknown element (dummy/incomplete entries like Manekin)
        element = meta.get("element")
        if not element or element == "Unknown":
            continue
        derived = derive_id(en_name)
        # Skip known non-beta IDs (e.g. traveler variants)
        if derived in SKIP_DERIVED_IDS:
            continue
        # Deduplicate by derived ID (e.g. multiple traveler variants)
        if derived in seen_ids:
            continue
        seen_ids.add(derived)
        if derived not in existing_ids:
            unreleased.append((num_id, derived, meta))
    return unreleased


def find_unreleased_weapons(
    weaponlist: dict, existing_ids: set[str]
) -> list[tuple[str, str, dict]]:
    """Returns list of (numeric_id, derived_id, meta) for unreleased weapons."""
    unreleased = []
    seen_ids: set[str] = set()
    for num_id, meta in weaponlist.items():
        en_name = meta.get("enName", "")
        if not en_name:
            continue
        derived = derive_id(en_name)
        # Deduplicate by derived ID
        if derived in seen_ids:
            continue
        seen_ids.add(derived)
        if derived not in existing_ids:
            unreleased.append((num_id, derived, meta))
    return unreleased


def detect_region(meta: dict) -> str:
    """Try to detect region from charlist metadata."""
    # Try associationType field
    assoc = meta.get("associationType", "")
    if assoc and assoc in ASSOCIATION_REGION_MAP:
        return ASSOCIATION_REGION_MAP[assoc]
    # Fallback: check if there's a region-like field
    region = meta.get("region", "")
    if region:
        return region
    return "Unknown"


# ---------------------------------------------------------------------------
# Character parsing
# ---------------------------------------------------------------------------
def _parse_char_stats(
    attributes: list[dict],
) -> tuple[dict[str, dict[str, str]], str]:
    base_keys = {"level", "ascension", "hp", "atk", "def"}
    asc_stat_raw = ""
    for attr in attributes:
        for k in attr:
            if k not in base_keys:
                asc_stat_raw = k
                break
        if asc_stat_raw:
            break

    asc_stat = _normalize_stat_key(asc_stat_raw, ASCENSION_STAT_MAP) if asc_stat_raw else ""

    by_level: dict[int, dict] = {}
    for attr in attributes:
        lv = attr["level"]
        asc = attr["ascension"]
        if lv not in by_level or asc > by_level[lv]["ascension"]:
            by_level[lv] = attr

    levels_data: dict[str, dict[str, str]] = {}
    for target in [70, 80, 90, 95, 100]:
        if target not in by_level:
            continue
        attr = by_level[target]
        stats: dict[str, str] = {
            "baseHp": str(attr["hp"]),
            "baseAtk": str(attr["atk"]),
            "baseDef": str(attr["def"]),
        }
        if asc_stat_raw in attr and asc_stat:
            val = attr[asc_stat_raw]
            is_pct = asc_stat in PERCENT_ASCENSION_STATS
            # Value may be numeric or string; normalize to string
            val_str = f"{val:g}" if isinstance(val, (int, float)) else str(val).rstrip("%")
            stats[asc_stat] = f"{val_str}%" if is_pct else val_str
        if "em" not in stats:
            stats["em"] = "0"
        levels_data[str(target)] = stats

    return levels_data, asc_stat


def _parse_multiplier_value(val: str) -> float:
    """Parse a multiplier string like '66.5%' to float 0.665, or '40' to 40.0."""
    val = val.strip()
    if val.endswith("%"):
        try:
            return round(float(val[:-1]) / 100, 6)
        except ValueError:
            return 0.0
    try:
        return float(val)
    except ValueError:
        return 0.0


def _multipliers_to_talent_array(multipliers: dict[str, list[str]]) -> list[list[float]]:
    """
    Convert lunaris multipliers to talent array format.
    Input: {label: [lv1_str, lv2_str, ...lv15_str]}
    Output: [[param1_lv1, param2_lv1, ...], [param1_lv2, param2_lv2, ...], ...]
    """
    if not multipliers:
        return []

    labels = list(multipliers.keys())
    n_levels = max(len(vals) for vals in multipliers.values()) if multipliers else 0

    talent: list[list[float]] = []
    for lv_idx in range(n_levels):
        row: list[float] = []
        for label in labels:
            vals = multipliers[label]
            if lv_idx < len(vals):
                row.append(_parse_multiplier_value(vals[lv_idx]))
            else:
                row.append(0.0)
        talent.append(row)

    return talent


def _multipliers_to_details(multipliers: dict[str, list[str]]) -> list[list[str]]:
    """Convert lunaris multipliers dict to our details format: [[label, lv1, lv2, ...], ...]."""
    details: list[list[str]] = []
    for label, values in multipliers.items():
        details.append([label] + values)
    return details


def _build_glossary(hyperlinks: list[dict]) -> list[dict] | None:
    if not hyperlinks:
        return None

    glossary: list[dict] = []
    for hyp in hyperlinks:
        name = hyp.get("name", "")
        desc = hyp.get("description", "")
        if not name or not desc:
            continue
        params = hyp.get("params", [])
        formatted_desc = desc
        for i, param in enumerate(params):
            if param:
                formatted_desc = formatted_desc.replace(f"{{{i}}}", param)
        glossary.append(
            {
                "name": name,
                "descHtml": _format_desc(formatted_desc),
            }
        )

    return glossary if glossary else None


def scrape_character(
    char_id_num: str,
    version: str,
    region: str,
) -> tuple[str, dict, dict, dict, str]:
    """
    Fetch character data from lunaris API.
    Returns (char_id, en_data, zh_data, stats_data, icon_name).
    """
    en_data_raw = fetch_json(f"{API_BASE}/{version}/en/char/{char_id_num}.json")
    zh_data_raw = fetch_json(f"{API_BASE}/{version}/chs/char/{char_id_num}.json")

    en_info = en_data_raw["info"]
    en_name = en_info["name"]
    char_id = derive_id(en_name)
    numeric_id = (
        char_id_num.replace("10000", "") if char_id_num.startswith("10000") else char_id_num
    )

    rarity = RARITY_MAP.get(en_info.get("rarity", ""), 5)
    element = en_info.get("element", "")
    weapon_type = WEAPON_TYPE_MAP.get(en_info.get("weapon", ""), "")

    print(f"    {en_name}: {rarity}* {element} {weapon_type} ({region})")

    # Stats
    levels_data, _asc_stat = _parse_char_stats(en_info.get("attributes", []))

    # Skills
    en_skills_raw = en_data_raw.get("skills", {})
    zh_skills_raw = zh_data_raw.get("skills", {})

    skill_keys = ["normalattack", "elementalskill", "elementalburst"]
    skill_prefixes = ["Normal Attack: ", "E. ", "Q. "]
    talent_keys = ["A", "E", "Q"]

    def _build_skills(skills_raw: dict) -> list[dict]:
        skills = []
        for key, prefix in zip(skill_keys, skill_prefixes, strict=False):
            if key not in skills_raw:
                continue
            s = skills_raw[key]
            name = s.get("name", "")
            skills.append(
                {
                    "name": f"{prefix}{name}",
                    "descHtml": _format_desc(s.get("description", "")),
                    "details": _multipliers_to_details(s.get("multipliers", {})),
                }
            )
        return skills

    en_skills = _build_skills(en_skills_raw)
    zh_skills = _build_skills(zh_skills_raw)

    # Talent multiplier arrays for stats
    talent_data: dict[str, list[list[float]]] = {}
    for key, tk in zip(skill_keys, talent_keys, strict=False):
        if key in en_skills_raw:
            multipliers = en_skills_raw[key].get("multipliers", {})
            arr = _multipliers_to_talent_array(multipliers)
            if arr:
                talent_data[tk] = arr

    # Passives
    def _build_passives(data_raw: dict) -> list[dict]:
        passives_raw = data_raw.get("passives", {})
        passives = []
        for key in sorted(passives_raw.keys()):
            if key == "leveling":
                continue
            p = passives_raw[key]
            if isinstance(p, dict):
                passives.append(
                    {
                        "name": p.get("name", ""),
                        "descHtml": _format_desc(p.get("description", "")),
                    }
                )
        return passives

    en_passives = _build_passives(en_data_raw)
    zh_passives = _build_passives(zh_data_raw)

    # Constellations
    def _build_constellations(data_raw: dict) -> list[dict]:
        consts_raw = data_raw.get("constellations", {})
        consts = []
        for key in sorted(consts_raw.keys()):
            c = consts_raw[key]
            if isinstance(c, dict):
                consts.append(
                    {
                        "name": c.get("name", ""),
                        "descHtml": _format_desc(c.get("description", "")),
                    }
                )
        return consts

    en_consts = _build_constellations(en_data_raw)
    zh_consts = _build_constellations(zh_data_raw)

    # Glossary
    en_glossary = _build_glossary(en_data_raw.get("hyperlinks", []))
    zh_glossary = _build_glossary(zh_data_raw.get("hyperlinks", []))

    zh_info = zh_data_raw["info"]

    en_out = {
        "id": numeric_id,
        "name": en_name,
        "skills": en_skills,
        "passives": en_passives,
        "constellations": en_consts,
        "glossary": en_glossary,
    }
    zh_out = {
        "id": numeric_id,
        "name": zh_info.get("name", ""),
        "skills": zh_skills,
        "passives": zh_passives,
        "constellations": zh_consts,
        "glossary": zh_glossary,
    }
    stats_out: dict = {
        "rarity": rarity,
        "element": element,
        "weaponType": weapon_type,
        "region": region,
        "releaseDate": "",
        "levels": levels_data,
    }
    if talent_data:
        stats_out["talent"] = talent_data

    icon_name = en_data_raw.get("icons", {}).get("forward", "")
    return char_id, en_out, zh_out, stats_out, icon_name


# ---------------------------------------------------------------------------
# Weapon parsing
# ---------------------------------------------------------------------------
def _templatize_weapon_desc(all_descs: dict[str, str]) -> tuple[str, list[list[str]]]:
    if not all_descs or len(all_descs) < 2:
        r1 = next(iter(all_descs.values()), "")
        return r1, []

    descs = [all_descs[str(i)] for i in range(1, 6) if str(i) in all_descs]
    if len(descs) < 2:
        return descs[0] if descs else "", []

    num_pattern = re.compile(r"\d+\.?\d*%?")
    r_nums = [num_pattern.findall(d) for d in descs]

    if not r_nums[0]:
        return descs[0], []

    min_len = min(len(nums) for nums in r_nums)
    changing_indices: list[int] = []
    for i in range(min_len):
        values = {nums[i] for nums in r_nums if i < len(nums)}
        if len(values) > 1:
            changing_indices.append(i)

    if not changing_indices:
        return descs[0], []

    refinements: list[list[str]] = []
    for nums in r_nums:
        row = [nums[i] if i < len(nums) else "" for i in changing_indices]
        refinements.append(row)

    template = descs[0]
    r1_nums = r_nums[0]
    placeholder_idx = 0
    for idx in changing_indices:
        if idx < len(r1_nums):
            value = r1_nums[idx]
            escaped = re.escape(value)
            new_template = re.sub(escaped, f"{{{placeholder_idx}}}", template, count=1)
            if new_template != template:
                template = new_template
                placeholder_idx += 1

    return template, refinements


def scrape_weapon(
    weapon_id_num: str,
    version: str,
) -> tuple[str, dict, dict, dict, str]:
    """
    Fetch weapon data from lunaris API.
    Returns (weapon_id, en_data, zh_data, stats_data, icon_name).
    """
    en_data_raw = fetch_json(f"{API_BASE}/{version}/en/weapon/{weapon_id_num}.json")
    zh_data_raw = fetch_json(f"{API_BASE}/{version}/chs/weapon/{weapon_id_num}.json")

    en_name = en_data_raw.get("name", "")
    zh_name = zh_data_raw.get("name", "")
    weapon_id = derive_id(en_name)

    rarity = RARITY_MAP.get(en_data_raw.get("qualityType", ""), 5)
    weapon_type = WEAPON_TYPE_MAP.get(en_data_raw.get("weaponType", ""), "")

    print(f"    {en_name}: {rarity}* {weapon_type}")

    # Stats at L90
    stats = en_data_raw.get("stats", {})
    l90_stats = stats.get("90", {})
    base_atk = l90_stats.get("atk", 0)

    secondary_stat = ""
    secondary_stat_value = ""
    for k, v in l90_stats.items():
        if k != "atk":
            secondary_stat = _normalize_stat_key(k, WEAPON_SUBSTAT_MAP)
            if isinstance(v, (int, float)):
                is_pct = "%" in k.lower() or secondary_stat.endswith("%")
                secondary_stat_value = f"{v:g}%" if is_pct else f"{v:g}"
            else:
                secondary_stat_value = str(v)
            break

    # Passive / refinements
    en_passive = en_data_raw.get("passive", {})
    zh_passive = zh_data_raw.get("passive", {})

    en_refinements = en_passive.get("refinements", {})
    zh_refinements = zh_passive.get("refinements", {})

    en_formatted = {k: _format_desc(v) for k, v in en_refinements.items()}
    zh_formatted = {k: _format_desc(v) for k, v in zh_refinements.items()}

    en_desc_tpl, en_refs = _templatize_weapon_desc(en_formatted)
    zh_desc_tpl, zh_refs = _templatize_weapon_desc(zh_formatted)

    en_out = {
        "id": weapon_id_num,
        "name": en_name,
        "descHtmlTpl": en_desc_tpl,
        "refinements": en_refs,
    }
    zh_out = {
        "id": weapon_id_num,
        "name": zh_name,
        "descHtmlTpl": zh_desc_tpl,
        "refinements": zh_refs,
    }
    stats_out = {
        "rarity": rarity,
        "type": weapon_type,
        "secondaryStat": secondary_stat,
        "levels": {
            "90": {
                "baseAtk": int(base_atk) if isinstance(base_atk, (int, float)) else base_atk,
                "secondaryStatValue": secondary_stat_value,
            }
        },
    }

    icon_name = en_data_raw.get("weaponIcon", "")
    return weapon_id, en_out, zh_out, stats_out, icon_name


# ---------------------------------------------------------------------------
# Resources TS generation
# ---------------------------------------------------------------------------
def generate_resources_beta_ts(
    characters: list[tuple[str, int]],
    weapons: list[tuple[str, int]],
) -> str:
    """Generate resources_beta.ts content.
    characters/weapons: list of (id, rarity)
    """
    lines = [
        "// This file is auto-generated by scripts/lunaris.py",
        "// Do not edit this file directly",
        'import type { CharacterResource, WeaponResource } from "./types";',
        "",
    ]

    # Characters
    char_entries = []
    for cid, rarity in characters:
        char_entries.append(
            json.dumps(
                {"id": cid, "rarity": rarity, "imagePath": f"/beta/character/{cid}.webp"},
                ensure_ascii=False,
                separators=(",", ":"),
            )
        )

    lines.append("export const betaCharacters: CharacterResource[] = [")
    for entry in char_entries:
        lines.append(f"  {entry},")
    lines.append("];")

    # Weapons
    weapon_entries = []
    for wid, rarity in weapons:
        weapon_entries.append(
            json.dumps(
                {"id": wid, "rarity": rarity, "imagePath": f"/beta/weapon/{wid}.webp"},
                ensure_ascii=False,
                separators=(",", ":"),
            )
        )

    lines.append("export const betaWeapons: WeaponResource[] = [")
    for entry in weapon_entries:
        lines.append(f"  {entry},")
    lines.append("];")

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape unreleased character/weapon data from lunaris.moe API"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-scrape even if beta files already have data",
    )
    parser.add_argument(
        "--version",
        default="",
        help="Data version (auto-detected if omitted)",
    )
    args = parser.parse_args()

    # Get version
    print("Fetching latest data version...")
    if args.version:
        version = args.version
    else:
        version = get_latest_version()
    print(f"Using version: {version}")

    # Load existing released data
    existing_chars = set(load_json(CHARACTER_STATS_PATH).keys())
    existing_weapons = set(load_json(WEAPON_STATS_PATH).keys())
    print(f"Existing: {len(existing_chars)} characters, {len(existing_weapons)} weapons")

    # Fetch lists
    print("\nFetching character list...")
    charlist = fetch_json(f"{API_BASE}/{version}/charlist.json")
    print(f"  Lunaris has {len(charlist)} characters")

    print("Fetching weapon list...")
    weaponlist = fetch_json(f"{API_BASE}/{version}/weaponlist.json")
    print(f"  Lunaris has {len(weaponlist)} weapons")

    # Find unreleased
    unreleased_chars = find_unreleased_characters(charlist, existing_chars)
    unreleased_weapons = find_unreleased_weapons(weaponlist, existing_weapons)

    print(f"\nFound {len(unreleased_chars)} unreleased characters:")
    for num_id, derived_id, meta in unreleased_chars:
        print(f"  {meta.get('enName', '?')} ({num_id} -> {derived_id})")

    print(f"Found {len(unreleased_weapons)} unreleased weapons:")
    for num_id, derived_id, meta in unreleased_weapons:
        print(f"  {meta.get('enName', '?')} ({num_id} -> {derived_id})")

    # Check if we should skip (unless --force)
    if not args.force:
        beta_chars_existing = load_json(BETA_CHARACTER_STATS_PATH)
        beta_weapons_existing = load_json(BETA_WEAPON_STATS_PATH)
        if beta_chars_existing or beta_weapons_existing:
            print("\nBeta files already have data. Use --force to re-scrape.")
            nc = len(beta_chars_existing)
            nw = len(beta_weapons_existing)
            print(f"  Existing beta: {nc} chars, {nw} weapons")
            return

    # Scrape characters
    char_en_data: dict = {}
    char_zh_data: dict = {}
    char_stats_data: dict = {}
    char_resources: list[tuple[str, int]] = []

    if unreleased_chars:
        print("\n--- Scraping unreleased characters ---")
        for num_id, _derived_id, meta in unreleased_chars:
            region = REGION_OVERRIDES.get(_derived_id, detect_region(meta))
            try:
                char_id, en_out, zh_out, stats_out, icon_name = scrape_character(
                    num_id, version, region
                )
                char_en_data[char_id] = en_out
                char_zh_data[char_id] = zh_out
                char_stats_data[char_id] = stats_out
                char_resources.append((char_id, stats_out["rarity"]))

                # Download icon
                if icon_name:
                    icon_url = f"{ASSETS_BASE}/avataricon/{icon_name}.webp"
                    icon_dest = ICON_DIR_CHAR / f"{char_id}.webp"
                    download_icon(icon_url, icon_dest)

            except requests.HTTPError as e:
                print(f"    ERROR fetching {num_id}: {e}")
            except Exception as e:
                print(f"    ERROR processing {num_id}: {e}")

    # Scrape weapons
    weapon_en_data: dict = {}
    weapon_zh_data: dict = {}
    weapon_stats_data: dict = {}
    weapon_resources: list[tuple[str, int]] = []

    if unreleased_weapons:
        print("\n--- Scraping unreleased weapons ---")
        for num_id, _derived_id, _meta in unreleased_weapons:
            try:
                weapon_id, en_out, zh_out, stats_out, icon_name = scrape_weapon(num_id, version)
                weapon_en_data[weapon_id] = en_out
                weapon_zh_data[weapon_id] = zh_out
                weapon_stats_data[weapon_id] = stats_out
                weapon_resources.append((weapon_id, stats_out["rarity"]))

                # Download icon
                if icon_name:
                    icon_url = f"{ASSETS_BASE}/weaponicon/{icon_name}.webp"
                    icon_dest = ICON_DIR_WEAPON / f"{weapon_id}.webp"
                    download_icon(icon_url, icon_dest)

            except requests.HTTPError as e:
                print(f"    ERROR fetching {num_id}: {e}")
            except Exception as e:
                print(f"    ERROR processing {num_id}: {e}")

    # Write output files
    print("\n--- Writing output files ---")

    save_json_minified(BETA_CHARACTER_STATS_PATH, char_stats_data)
    p = BETA_CHARACTER_STATS_PATH.relative_to(PROJECT_ROOT)
    print(f"  {p}: {len(char_stats_data)} characters")

    save_json_minified(BETA_CHARACTER_EN_PATH, char_en_data)
    print(f"  {BETA_CHARACTER_EN_PATH.relative_to(PROJECT_ROOT)}: {len(char_en_data)} entries")

    save_json_minified(BETA_CHARACTER_ZH_PATH, char_zh_data)
    print(f"  {BETA_CHARACTER_ZH_PATH.relative_to(PROJECT_ROOT)}: {len(char_zh_data)} entries")

    save_json_minified(BETA_WEAPON_STATS_PATH, weapon_stats_data)
    print(f"  {BETA_WEAPON_STATS_PATH.relative_to(PROJECT_ROOT)}: {len(weapon_stats_data)} weapons")

    save_json_minified(BETA_WEAPON_EN_PATH, weapon_en_data)
    print(f"  {BETA_WEAPON_EN_PATH.relative_to(PROJECT_ROOT)}: {len(weapon_en_data)} entries")

    save_json_minified(BETA_WEAPON_ZH_PATH, weapon_zh_data)
    print(f"  {BETA_WEAPON_ZH_PATH.relative_to(PROJECT_ROOT)}: {len(weapon_zh_data)} entries")

    # Generate resources_beta.ts
    ts_content = generate_resources_beta_ts(char_resources, weapon_resources)
    RESOURCES_BETA_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESOURCES_BETA_PATH.write_text(ts_content, encoding="utf-8")
    p = RESOURCES_BETA_PATH.relative_to(PROJECT_ROOT)
    print(f"  {p}: {len(char_resources)} chars, {len(weapon_resources)} weapons")

    print("\nDone!")


if __name__ == "__main__":
    main()
