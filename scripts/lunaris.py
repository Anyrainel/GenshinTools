"""
Scrape unreleased character, weapon, and artifact data from lunaris.moe API.

Auto-detects unreleased entities by comparing lunaris charlist/weaponlist/
artifactlist against existing released JSON files.

Usage:
  uv run --project scripts/pyproject.toml scripts/lunaris.py
  uv run --project scripts/pyproject.toml scripts/lunaris.py --force

Pipeline (always cleanup first, then scrape):
  1. Cleanup: remove from beta files entries that have been promoted to
     released. Beta JSON entries are only removed if the corresponding
     official JSON has the data (carry-over safety).
  2. Scrape: fetch missing beta entities from lunaris API and write data.

Output files (under src/data/game/):
  character_beta_stats.json.gz, character_beta_en.json.gz, character_beta_zh.json.gz
  weapon_beta_stats.json.gz, weapon_beta_en.json.gz, weapon_beta_zh.json.gz
  artifact_beta_en.json.gz, artifact_beta_zh.json.gz
  src/data/resources_beta.ts
  public/character/{id}.webp, public/weapon/{id}.webp, public/artifact/{id}{N}.webp
"""

import argparse
import re
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beta_files import (  # noqa: E402
    ARTIFACT_EN_PATH,
    ARTIFACT_SLOT_LOCAL_SUFFIX,
    ARTIFACT_ZH_PATH,
    BETA_ARTIFACT_EN_PATH,
    BETA_ARTIFACT_ZH_PATH,
    BETA_CHARACTER_EN_PATH,
    BETA_CHARACTER_STATS_PATH,
    BETA_CHARACTER_ZH_PATH,
    BETA_WEAPON_EN_PATH,
    BETA_WEAPON_STATS_PATH,
    BETA_WEAPON_ZH_PATH,
    I18N_BETA_PATH,
    PROJECT_ROOT,
    RESOURCES_BETA_PATH,
    RESOURCES_PATH,
    cleanup_beta_files,
    generate_i18n_beta_ts,
    generate_resources_beta_ts,
    load_json,
    save_json_minified,
)
from halfset_finder import ARTIFACT_SKIP_LIST  # noqa: E402
from region_overrides import REGION_OVERRIDES  # noqa: E402
from ts_reader import extract_json_from_ts  # noqa: E402

ICON_DIR_CHAR = PROJECT_ROOT / "public" / "character"
ICON_DIR_WEAPON = PROJECT_ROOT / "public" / "weapon"
ICON_DIR_ARTIFACT = PROJECT_ROOT / "public" / "artifact"

API_BASE = "https://api.lunaris.moe/data"
ASSETS_BASE = "https://api.lunaris.moe/data/assets"


# Mappings

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

# REGION_OVERRIDES lives in scripts/region_overrides.py — edit that file to
# assign regions to beta characters whose associationType isn't set yet.

# Fallback region used when associationType is missing or unrecognized. Must
# be a valid Region value (src/data/types.ts). "Nod-Krai" mirrors where most
# current-version beta characters land; edit REGION_OVERRIDES to correct
# exceptions like Mondstadt-affiliated beta characters.
# TODO: update to "Snezhnaya" after the 7.0 game version (main storyline
# moves on and new beta characters will default to that region instead).
DEFAULT_UNKNOWN_REGION = "Nod-Krai"

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


# Utilities


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
    # Lunaris responses mix two newline encodings: literal "\n" (backslash + n,
    # 2 chars) and real LF chars. Normalize both to <br/> so downstream HTML
    # rendering is consistent.
    result = result.replace("\\n", "<br/>")
    result = result.replace("\n", "<br/>")
    return result


def _format_desc(raw: str) -> str:
    return _clean_desc_html(color_tags_to_spans(raw))


# API


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


# Auto-detection


def _rarity_from_quality(quality_type: str) -> int:
    """Convert qualityType string to numeric rarity."""
    return RARITY_MAP.get(quality_type, 0)


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
        # Only 4★+ characters
        if _rarity_from_quality(meta.get("qualityType", "")) < 4:
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
        # Only 4★+ weapons
        if _rarity_from_quality(meta.get("qualityType", "")) < 4:
            continue
        derived = derive_id(en_name)
        # Deduplicate by derived ID
        if derived in seen_ids:
            continue
        seen_ids.add(derived)
        if derived not in existing_ids:
            unreleased.append((num_id, derived, meta))
    return unreleased


def find_unreleased_artifacts(
    artifactlist: dict, existing_ids: set[str]
) -> list[tuple[str, str, dict]]:
    """Returns list of (set_id_num, derived_id, meta) for unreleased artifact sets."""
    unreleased = []
    seen_ids: set[str] = set()
    for num_id, meta in artifactlist.items():
        en_name = meta.get("enName", "")
        # Skip placeholder names (e.g. "???" for not-yet-named beta sets).
        if not en_name or en_name.strip("?") == "":
            continue
        # Only 4★+ artifact sets (skip low-rarity test sets / domain rewards)
        if _rarity_from_quality(meta.get("qualityType", "")) < 4:
            continue
        derived = derive_id(en_name)
        if not derived or derived in seen_ids:
            continue
        # Respect the shared skip list (e.g. tiny_miracle, prayer sets): these
        # are intentionally excluded from resources.ts AND beta surfaces.
        if derived in ARTIFACT_SKIP_LIST:
            continue
        seen_ids.add(derived)
        if derived not in existing_ids:
            unreleased.append((num_id, derived, meta))
    return unreleased


def detect_region(meta: dict) -> str:
    """Try to detect region from charlist metadata.

    Always returns a valid Region value (see src/data/types.ts). When the
    metadata has no association/region info, falls back to
    DEFAULT_UNKNOWN_REGION so downstream consumers never see an illegal
    placeholder like "Unknown". Add the character to REGION_OVERRIDES in
    scripts/region_overrides.py to pin a different region.
    """
    # Try associationType field
    assoc = meta.get("associationType", "")
    if assoc and assoc in ASSOCIATION_REGION_MAP:
        return ASSOCIATION_REGION_MAP[assoc]
    # Fallback: check if there's a region-like field
    region = meta.get("region", "")
    if region:
        return region
    return DEFAULT_UNKNOWN_REGION


# Character parsing


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


def _detect_format(num_str: str, is_pct: bool) -> str:
    """Detect the param format code from a rendered number string.

    Format codes match impl_audit.py's _format_value():
      I    — integer
      F1   — 1 decimal float
      F2   — 2 decimal float
      P    — percentage, 0 decimals
      F1P  — percentage, 1 decimal
      F2P  — percentage, 2 decimal
    """
    if is_pct:
        if "." not in num_str:
            return "P"
        decimals = len(num_str.split(".")[1])
        return "F2P" if decimals >= 2 else "F1P"
    if "." not in num_str:
        return "I"
    decimals = len(num_str.split(".")[1])
    return "F2" if decimals >= 2 else "F1"


def _parse_number(num_str: str, is_pct: bool) -> float:
    """Parse a number string to float, converting percentage to decimal."""
    val = float(num_str)
    if is_pct:
        val = round(val / 100, 6)
    return val


_NUMBER_RE = re.compile(r"(\d+(?:\.\d+)?)(%?)")


def _extract_numbers(value_str: str) -> list[tuple[float, str]]:
    """Extract all numeric values and their format codes from a rendered string.

    Returns list of (float_value, format_code) tuples.
    """
    results = []
    for m in _NUMBER_RE.finditer(value_str):
        num_str, pct = m.group(1), m.group(2)
        is_pct = pct == "%"
        fmt = _detect_format(num_str, is_pct)
        val = _parse_number(num_str, is_pct)
        results.append((val, fmt))
    return results


def _build_template(value_str: str, param_start: int) -> tuple[str, int]:
    """Replace numeric values in a string with {paramN:FORMAT} templates.

    Returns (template_string, next_param_index).
    """
    idx = param_start
    parts = []
    last_end = 0
    for m in _NUMBER_RE.finditer(value_str):
        parts.append(value_str[last_end : m.start()])
        num_str, pct = m.group(1), m.group(2)
        is_pct = pct == "%"
        fmt = _detect_format(num_str, is_pct)
        parts.append(f"{{param{idx}:{fmt}}}")
        idx += 1
        last_end = m.end()
    parts.append(value_str[last_end:])
    return "".join(parts), idx


def _is_constant_across_levels(multipliers_values: list[str], num_index: int) -> bool:
    """Check if the Nth numeric value in a detail row is constant across all levels."""
    values: set[str] = set()
    for val_str in multipliers_values:
        nums = list(_NUMBER_RE.finditer(val_str))
        if num_index < len(nums):
            values.add(nums[num_index].group(0))
    return len(values) <= 1


def _multipliers_to_talent_and_details(
    multipliers: dict[str, list[str]],
) -> tuple[list[list[float]], list[list[str]]]:
    """Convert lunaris multipliers to both talent array and templated details.

    Only values that vary across talent levels become params. Constant values
    (like CD, duration, energy cost, or hit counts) are kept as literals.

    Returns:
      talent: [[param1_lv1, param2_lv1, ...], ...] (15 levels)
      details: [[label, template_str], ...] matching official format
    """
    if not multipliers:
        return [], []

    labels = list(multipliers.keys())
    n_levels = max(len(vals) for vals in multipliers.values()) if multipliers else 0

    # First pass: determine which numbers vary across levels and assign params
    details: list[list[str]] = []
    # Track which (label_idx, num_idx) positions become params
    param_positions: list[tuple[int, int]] = []  # (label_idx, num_index_in_row)
    param_idx = 1  # 1-based

    for label_idx, label in enumerate(labels):
        vals = multipliers[label]
        if not vals:
            details.append([label, ""])
            continue

        # Find all numbers in the first level's string
        nums = list(_NUMBER_RE.finditer(vals[0]))
        template_parts = []
        last_end = 0

        for num_i, m in enumerate(nums):
            template_parts.append(vals[0][last_end : m.start()])
            num_str, pct = m.group(1), m.group(2)
            is_pct = pct == "%"

            if _is_constant_across_levels(vals, num_i):
                # Keep literal — don't create a param
                template_parts.append(m.group(0))
            else:
                # Create a param
                fmt = _detect_format(num_str, is_pct)
                template_parts.append(f"{{param{param_idx}:{fmt}}}")
                param_positions.append((label_idx, num_i))
                param_idx += 1

            last_end = m.end()

        template_parts.append(vals[0][last_end:])
        details.append([label, "".join(template_parts)])

    total_params = param_idx - 1

    # Second pass: extract numeric values for all levels (only for param positions)
    talent: list[list[float]] = []
    for lv_idx in range(n_levels):
        row: list[float] = [0.0] * total_params
        for p_i, (label_idx, num_i) in enumerate(param_positions):
            label = labels[label_idx]
            vals = multipliers[label]
            if lv_idx < len(vals):
                extracted = _extract_numbers(vals[lv_idx])
                if num_i < len(extracted):
                    row[p_i] = round(extracted[num_i][0], 6)
        talent.append(row)

    return talent, details


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
    skill_prefixes = ["A. ", "E. ", "Q. "]
    talent_keys = ["A", "E", "Q"]

    # Build skills and talent arrays together (templates + param extraction)
    talent_data: dict[str, list[list[float]]] = {}
    en_skills: list[dict] = []
    zh_skills: list[dict] = []

    for key, prefix, tk in zip(skill_keys, skill_prefixes, talent_keys, strict=False):
        # Build talent array and EN templates from EN multipliers
        en_s = en_skills_raw.get(key)
        if en_s:
            en_mult = en_s.get("multipliers", {})
            talent_arr, en_details = _multipliers_to_talent_and_details(en_mult)
            if talent_arr:
                talent_data[tk] = talent_arr
            en_skills.append(
                {
                    "name": f"{prefix}{en_s.get('name', '')}",
                    "descHtml": _format_desc(en_s.get("description", "")),
                    "details": en_details,
                }
            )
        # Build ZH templates from ZH multipliers
        zh_s = zh_skills_raw.get(key)
        if zh_s:
            zh_mult = zh_s.get("multipliers", {})
            _, zh_details = _multipliers_to_talent_and_details(zh_mult)
            zh_skills.append(
                {
                    "name": f"{prefix}{zh_s.get('name', '')}",
                    "descHtml": _format_desc(zh_s.get("description", "")),
                    "details": zh_details,
                }
            )

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


# Weapon parsing


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


# Artifact parsing


def scrape_artifact(
    set_id_num: str,
    version: str,
) -> tuple[str, dict, dict, int, dict[str, str]]:
    """
    Fetch artifact set data from lunaris API.
    Returns (artifact_id, en_data, zh_data, rarity, slot_to_icon).

    en_data / zh_data match the artifact_*.json shape:
      { id: <numeric>, name: <set name>, rarity: <int>, effect2: <str>, effect4: <str> }
    slot_to_icon maps slot name (flower/plume/sands/goblet/circlet) to API icon name.
    """
    en_data_raw = fetch_json(f"{API_BASE}/{version}/en/artifact/{set_id_num}.json")
    zh_data_raw = fetch_json(f"{API_BASE}/{version}/chs/artifact/{set_id_num}.json")

    en_info = en_data_raw["info"]
    zh_info = zh_data_raw.get("info", {})

    en_name = en_info.get("setName", "")
    zh_name = zh_info.get("setName", en_name)
    artifact_id = derive_id(en_name)

    rarity = RARITY_MAP.get(en_info.get("qualityType", ""), 5)

    en_bonuses = en_info.get("setBonuses", {}) or {}
    zh_bonuses = zh_info.get("setBonuses", {}) or {}

    print(f"    {en_name}: {rarity}* (set {set_id_num})")

    en_out = {
        "id": str(set_id_num),
        "name": en_name,
        "rarity": rarity,
        "effect2": _format_desc(en_bonuses.get("2pc", "")),
        "effect4": _format_desc(en_bonuses.get("4pc", "")),
    }
    zh_out = {
        "id": str(set_id_num),
        "name": zh_name,
        "rarity": rarity,
        "effect2": _format_desc(zh_bonuses.get("2pc", "")),
        "effect4": _format_desc(zh_bonuses.get("4pc", "")),
    }

    # Map slot → icon name (e.g. "flower" → "UI_RelicIcon_15044_4")
    pieces = en_info.get("pieces", {}) or {}
    slot_to_icon: dict[str, str] = {}
    for slot in ARTIFACT_SLOT_LOCAL_SUFFIX:
        piece = pieces.get(slot, {})
        icon = piece.get("icon", "") if isinstance(piece, dict) else ""
        if icon:
            slot_to_icon[slot] = icon

    return artifact_id, en_out, zh_out, rarity, slot_to_icon


# Main


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

    # Load released IDs from resources.ts. Anything in lunaris but not here is
    # considered unreleased/beta — including entries that already have JSON
    # data in the offline-pipeline files (e.g. "Glacier and Snowfield") but
    # never made it into the visible resources catalog.
    resources_content = RESOURCES_PATH.read_text(encoding="utf-8")
    obtainable_chars = {c["id"] for c in extract_json_from_ts(resources_content, "characters")}
    obtainable_weapons = {w["id"] for w in extract_json_from_ts(resources_content, "weapons")}
    obtainable_artifacts = {a["id"] for a in extract_json_from_ts(resources_content, "artifacts")}
    print(
        f"Released: {len(obtainable_chars)} characters, "
        f"{len(obtainable_weapons)} weapons, {len(obtainable_artifacts)} artifacts"
    )

    # Cleanup phase: drop entries that have been promoted to released. Beta
    # JSON entries are only removed if the corresponding official JSON has
    # the data, so an entity that's in resources.ts but not yet in the
    # offline-pipeline JSON keeps its beta data as fallback.
    print()
    cleanup_beta_files(
        obtainable_chars,
        obtainable_weapons,
        obtainable_artifacts,
        skip_artifacts=set(ARTIFACT_SKIP_LIST),
    )
    print()

    # Load existing artifact data (offline-pipeline JSON) so that unreleased
    # entries which already have entries there (e.g. Glacier and Snowfield)
    # can source their names from the canonical JSON instead of being
    # duplicated into the beta JSON files. Beta JSON files should only carry
    # entries with no other data source.
    released_artifact_en_data = load_json(ARTIFACT_EN_PATH)
    released_artifact_zh_data = load_json(ARTIFACT_ZH_PATH)
    artifacts_with_existing_data = (
        set(released_artifact_en_data.keys()) - obtainable_artifacts - set(ARTIFACT_SKIP_LIST)
    )
    if artifacts_with_existing_data:
        print(
            f"Unreleased artifacts with existing JSON data: "
            f"{len(artifacts_with_existing_data)} "
            "(names sourced from old JSON, no beta JSON entry written)"
        )

    # Fetch lists
    print("\nFetching character list...")
    charlist = fetch_json(f"{API_BASE}/{version}/charlist.json")
    print(f"  Lunaris has {len(charlist)} characters")

    print("Fetching weapon list...")
    weaponlist = fetch_json(f"{API_BASE}/{version}/weaponlist.json")
    print(f"  Lunaris has {len(weaponlist)} weapons")

    print("Fetching artifact list...")
    artifactlist = fetch_json(f"{API_BASE}/{version}/artifactlist.json")
    print(f"  Lunaris has {len(artifactlist)} artifact sets")

    # Find unreleased entries (anything in lunaris but not in resources.ts).
    unreleased_chars = find_unreleased_characters(charlist, obtainable_chars)
    unreleased_weapons = find_unreleased_weapons(weaponlist, obtainable_weapons)
    unreleased_artifacts = find_unreleased_artifacts(artifactlist, obtainable_artifacts)

    print(f"\nFound {len(unreleased_chars)} unreleased characters:")
    for num_id, derived_id, meta in unreleased_chars:
        print(f"  {meta.get('enName', '?')} ({num_id} -> {derived_id})")

    print(f"Found {len(unreleased_weapons)} unreleased weapons:")
    for num_id, derived_id, meta in unreleased_weapons:
        print(f"  {meta.get('enName', '?')} ({num_id} -> {derived_id})")

    print(f"Found {len(unreleased_artifacts)} unreleased artifact sets:")
    for num_id, derived_id, meta in unreleased_artifacts:
        print(f"  {meta.get('enName', '?')} ({num_id} -> {derived_id})")

    # Check if we should skip (unless --force)
    if not args.force:
        beta_chars_existing = load_json(BETA_CHARACTER_STATS_PATH)
        beta_weapons_existing = load_json(BETA_WEAPON_STATS_PATH)
        beta_artifacts_existing = load_json(BETA_ARTIFACT_EN_PATH)
        if beta_chars_existing or beta_weapons_existing or beta_artifacts_existing:
            print("\nBeta files already have data. Use --force to re-scrape.")
            nc = len(beta_chars_existing)
            nw = len(beta_weapons_existing)
            na = len(beta_artifacts_existing)
            print(f"  Existing beta: {nc} chars, {nw} weapons, {na} artifact sets")
            return

    # Scrape characters
    char_en_data: dict = {}
    char_zh_data: dict = {}
    char_stats_data: dict = {}
    char_resources: list[tuple[str, int]] = []
    char_names_en: dict[str, str] = {}
    char_names_zh: dict[str, str] = {}

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
                char_names_en[char_id] = en_out["name"]
                char_names_zh[char_id] = zh_out["name"]

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
    weapon_names_en: dict[str, str] = {}
    weapon_names_zh: dict[str, str] = {}

    if unreleased_weapons:
        print("\n--- Scraping unreleased weapons ---")
        for num_id, _derived_id, _meta in unreleased_weapons:
            try:
                weapon_id, en_out, zh_out, stats_out, icon_name = scrape_weapon(num_id, version)

                # Skip weapons without effect text (test/placeholder weapons)
                if not en_out["descHtmlTpl"]:
                    print(f"    Skipping {weapon_id}: no weapon effect text")
                    continue

                weapon_en_data[weapon_id] = en_out
                weapon_zh_data[weapon_id] = zh_out
                weapon_stats_data[weapon_id] = stats_out
                weapon_resources.append((weapon_id, stats_out["rarity"]))
                weapon_names_en[weapon_id] = en_out["name"]
                weapon_names_zh[weapon_id] = zh_out["name"]

                # Download icon
                if icon_name:
                    icon_url = f"{ASSETS_BASE}/weaponicon/{icon_name}.webp"
                    icon_dest = ICON_DIR_WEAPON / f"{weapon_id}.webp"
                    download_icon(icon_url, icon_dest)

            except requests.HTTPError as e:
                print(f"    ERROR fetching {num_id}: {e}")
            except Exception as e:
                print(f"    ERROR processing {num_id}: {e}")

    # Scrape artifact sets. Two cases share the loop:
    #   - sets with no existing data: written to artifact_beta_en/zh JSON files
    #   - sets that already have entries in artifact_en.json (carry-over from a
    #       previous release cycle): names sourced from old JSON, NOT written
    #       to beta JSON (avoids duplicating effect text that already lives in
    #       the offline-pipeline JSON files).
    # Both cases appear in resources_beta + i18n-beta so betaEnabled UI
    # surfaces them.
    artifact_en_data: dict = {}
    artifact_zh_data: dict = {}
    artifact_resources: list[tuple[str, int]] = []
    artifact_names_en: dict[str, str] = {}
    artifact_names_zh: dict[str, str] = {}

    if unreleased_artifacts:
        print("\n--- Scraping unreleased artifact sets ---")
        for num_id, _derived_id, _meta in unreleased_artifacts:
            try:
                aid, en_out, zh_out, rarity, slot_to_icon = scrape_artifact(num_id, version)

                # Skip sets without effect text (test/placeholder)
                if not en_out["effect2"] and not en_out["effect4"]:
                    print(f"    Skipping {aid}: no set bonus text")
                    continue

                has_existing_data = aid in artifacts_with_existing_data
                if has_existing_data:
                    # Pull display names from old JSON (canonical source) and
                    # skip writing effect text into beta JSON files.
                    old_en = released_artifact_en_data.get(aid, {})
                    old_zh = released_artifact_zh_data.get(aid, {})
                    artifact_names_en[aid] = old_en.get("name") or en_out["name"]
                    artifact_names_zh[aid] = old_zh.get("name") or zh_out["name"]
                    print(f"    {aid}: name from old JSON, no beta JSON entry")
                else:
                    artifact_en_data[aid] = en_out
                    artifact_zh_data[aid] = zh_out
                    artifact_names_en[aid] = en_out["name"]
                    artifact_names_zh[aid] = zh_out["name"]

                artifact_resources.append((aid, rarity))

                # Download all 5 slot icons. Slot → API icon → local file naming:
                #   _4=flower→<slug>.webp, _2=plume→<slug>2.webp, _5=sands→<slug>3.webp,
                #   _1=goblet→<slug>4.webp, _3=circlet→<slug>5.webp.
                # Lunaris's CDN sometimes only has a subset of slot icons for
                # older unobtainable sets (e.g. Glacier and Snowfield).
                # Tolerate per-slot 404s so one missing icon doesn't abort the
                # rest, and keep the entry regardless of icon availability.
                for slot, icon_name in slot_to_icon.items():
                    suffix = ARTIFACT_SLOT_LOCAL_SUFFIX[slot]
                    icon_url = f"{ASSETS_BASE}/artifacts/{icon_name}.webp"
                    icon_dest = ICON_DIR_ARTIFACT / f"{aid}{suffix}.webp"
                    try:
                        download_icon(icon_url, icon_dest)
                    except requests.HTTPError as e:
                        print(f"    WARN icon missing for {aid} {slot}: {e}")

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

    save_json_minified(BETA_ARTIFACT_EN_PATH, artifact_en_data)
    p = BETA_ARTIFACT_EN_PATH.relative_to(PROJECT_ROOT)
    print(f"  {p}: {len(artifact_en_data)} entries")

    save_json_minified(BETA_ARTIFACT_ZH_PATH, artifact_zh_data)
    p = BETA_ARTIFACT_ZH_PATH.relative_to(PROJECT_ROOT)
    print(f"  {p}: {len(artifact_zh_data)} entries")

    # Generate resources_beta.ts
    ts_content = generate_resources_beta_ts(char_resources, weapon_resources, artifact_resources)
    RESOURCES_BETA_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESOURCES_BETA_PATH.write_text(ts_content, encoding="utf-8")
    p = RESOURCES_BETA_PATH.relative_to(PROJECT_ROOT)
    print(
        f"  {p}: {len(char_resources)} chars, "
        f"{len(weapon_resources)} weapons, {len(artifact_resources)} artifacts"
    )

    # Generate i18n-beta.ts
    i18n_content = generate_i18n_beta_ts(
        char_names_en,
        char_names_zh,
        weapon_names_en,
        weapon_names_zh,
        artifact_names_en,
        artifact_names_zh,
    )
    I18N_BETA_PATH.write_text(i18n_content, encoding="utf-8")
    p = I18N_BETA_PATH.relative_to(PROJECT_ROOT)
    n = len(char_names_en) + len(weapon_names_en) + len(artifact_names_en)
    print(f"  {p}: {n} entries")

    print("\nDone!")


if __name__ == "__main__":
    main()
