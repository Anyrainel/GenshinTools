#!/usr/bin/env python3
"""
Preprocessing module for Genshin Impact artifact half sets computation.

IDs are stat-derived strings (e.g. "atk%-18", "heal%-15") so they are
self-documenting and deduplication-safe. The mapping from effect text to
canonical ID is defined in EFFECT_TO_ID. Unknown effects raise an error
so they get noticed and manually added to the map.
"""

import re

from models import HalfSet, I18nArtifactData

ARTIFACT_SKIP_LIST: list[str] = [
    "adventurer",
    "lucky_dog",
    "traveling_doctor",
    "tiny_miracle",
    # 1-piece prayer sets (no real 2pc effect)
    "prayers_for_destiny",
    "prayers_for_illumination",
    "prayers_for_wisdom",
    "prayers_to_springtime",
    "prayers_to_the_firmament",
]

# ── Canonical effect-to-ID mapping ──
# Keys are normalized English effect text. Values are the stat-derived string IDs.
# When a new artifact shares an existing 2pc effect text, it joins the same group.
# When a genuinely new effect appears, add an entry here.
EFFECT_TO_ID: dict[str, str] = {
    "ATK +18%": "atk%-18",
    "Elemental Mastery +80": "em-80",
    "Anemo DMG Bonus +15%": "anemo%-15",
    "Energy Recharge +20%": "er-20",
    "Healing Bonus +15%": "heal%-15",
    "Character Healing Effectiveness +15%": "heal%-15",  # same mechanical effect
    "Hydro DMG Bonus +15%": "hydro%-15",
    "Physical DMG +25%": "phys%-25",
    "HP +20%": "hp%-20",
    "Cryo DMG Bonus +15%": "cryo%-15",
    "Plunging Attack DMG +25%": "plunge-dmg%-25",
    "DEF +30%": "def%-30",
    "Electro DMG Bonus +15%": "electro%-15",
    "Electro RES +40%": "electro-res-40",
    "Gain a 15% Geo DMG Bonus": "geo%-15",
    "Elemental Burst DMG +20%": "burst-dmg%-20",
    "Pyro DMG Bonus +15%": "pyro%-15",
    "Pyro RES +40%": "pyro-res-40",
    "Dendro DMG Bonus +15%": "dendro%-15",
    "Normal and Charged Attack DMG +15%": "na-ca-dmg%-15",
    "Elemental Skill DMG +20%": "skill-dmg%-20",
    "Shield Strength +35%": "shield-35",
    "CRIT Rate +12%": "cr-12",
    # Nightsoul-era effects (Natlan)
    "When a nearby party member triggers a Nightsoul Burst,"
    " the equipping character regenerates 6 Energy": "nightsoul-energy-6",
    "While the equipping character is in Nightsoul's Blessing"
    " and is on the field, their DMG dealt +15%": "nightsoul-dmg%-15",
}


def normalize_effect_text(text: str, language: str) -> str:
    """Normalize effect text based on language"""
    normalized: str = text.strip()

    if language == "en":
        normalized = re.sub(r"\.$", "", normalized)
        # "Increases X by Y" → "X +Y" (prefix form from game JSON)
        normalized = re.sub(r"^Increases\s+(.+?)\s+by\s+", r"\1 +", normalized, flags=re.IGNORECASE)
        # "X increase(d) by Y" → "X +Y" (inline form)
        normalized = re.sub(r"increased? by ", "+", normalized, flags=re.IGNORECASE)
        # "X is +Y" → "X +Y" (copula before stat value)
        normalized = re.sub(r" is \+", " +", normalized)
        # "Elemental Energy" → "Energy" (alternate nightsoul wording in game JSON)
        normalized = normalized.replace("Elemental Energy", "Energy")
    elif language == "zh":
        normalized = re.sub(r"。$", "", normalized)

    return normalized


def derive_halfset_id(en_text: str) -> str:
    """Derive a canonical string ID from the normalized English effect text.

    All known effects must have an explicit entry in EFFECT_TO_ID.
    Unknown effects raise ValueError so they get added to the map.
    """
    if en_text in EFFECT_TO_ID:
        return EFFECT_TO_ID[en_text]

    raise ValueError(
        f"Unknown 2pc effect: {en_text!r}. Add an entry to EFFECT_TO_ID in halfset_finder.py."
    )


def extract_unique_2pc_effects(
    artifact_ids: list[str], artifact_data: dict[str, I18nArtifactData]
) -> tuple[list[HalfSet], dict[str, dict[str, str]]]:
    """
    Extract unique 2pc effects from i18n data.
    Processes artifacts in reverse order (oldest first) for stable grouping.
    IDs are stat-derived strings instead of auto-incremented numbers.
    """
    half_sets: list[HalfSet] = []
    half_sets_i18n: dict[str, dict[str, str]] = {}
    id_to_halfset: dict[str, HalfSet] = {}

    filtered_artifact_ids: list[str] = [a for a in artifact_ids if a not in ARTIFACT_SKIP_LIST]

    for artifact_id in reversed(filtered_artifact_ids):
        data: I18nArtifactData | None = artifact_data.get(artifact_id)

        if not data or not data.effects.en or not data.effects.zh:
            continue

        effects_en: list[str] = data.effects.en
        effects_zh: list[str] = data.effects.zh

        if len(effects_en) == 0 or len(effects_zh) == 0:
            continue

        normalized_en: str = normalize_effect_text(effects_en[0], "en")
        normalized_zh: str = normalize_effect_text(effects_zh[0], "zh")

        # Skip if either effect is a placeholder
        if "???" in normalized_en or "???" in normalized_zh:
            continue

        halfset_id = derive_halfset_id(normalized_en)

        if halfset_id in id_to_halfset:
            id_to_halfset[halfset_id].setIds.append(artifact_id)
            # Update shortest text (heuristic for "best" description)
            current_i18n = half_sets_i18n[halfset_id]
            if len(normalized_en) < len(current_i18n["en"]):
                current_i18n["en"] = normalized_en
            if len(normalized_zh) < len(current_i18n["zh"]):
                current_i18n["zh"] = normalized_zh
        else:
            new_half_set = HalfSet(
                id=halfset_id,
                setIds=[artifact_id],
            )

            half_sets.append(new_half_set)
            id_to_halfset[halfset_id] = new_half_set

            half_sets_i18n[halfset_id] = {
                "en": normalized_en,
                "zh": normalized_zh,
            }

    half_sets.sort(key=lambda hs: (-len(hs.setIds), hs.id))

    return half_sets, half_sets_i18n


def process_artifact_effects(
    artifact_ids: list[str],
    artifact_i18n_data: dict[str, I18nArtifactData],
) -> tuple[list[HalfSet], dict[str, dict[str, str]]]:
    """
    Process scraped data to compute half sets.
    This function is called by scrape_hoyolab.py after scraping is complete.
    """
    print(f"Computing half sets from {len(artifact_ids)} artifacts...")

    half_sets, half_sets_i18n = extract_unique_2pc_effects(artifact_ids, artifact_i18n_data)

    print(f"Generated {len(half_sets)} unique half sets:")
    for hs in half_sets:
        zh_text = half_sets_i18n[hs.id]["zh"]
        print(f"  {hs.id}: {len(hs.setIds)} sets - {zh_text}")

    return half_sets, half_sets_i18n
