#!/usr/bin/env python3
"""
Preprocessing module for Genshin Impact artifact half sets computation.
Replicates the TypeScript preprocessing logic from src/data/preprocess.ts
"""

import re
from typing import TypedDict


class EffectData(TypedDict):
    en: list[str]
    zh: list[str]


class I18nArtifactData(TypedDict):
    effects: EffectData


class HalfSet(TypedDict):
    id: int
    setIds: list[str]
    normalizedEffectTextEn: str
    normalizedEffectTextZh: str


ARTIFACT_SKIP_LIST: list[str] = [
    "adventurer",
    "brave_heart",
    "lucky_dog",
    "traveling_doctor",
    "resolution_of_sojourner",
    "tiny_miracle",
    "berserker",
    "the_exile",
    "defenders_will",
    "martial_artist",
    "gambler",
    "scholar",
]


def normalize_effect_text(text: str, language: str) -> str:
    """Normalize effect text based on language"""
    normalized: str = text.strip()

    if language == "en":
        normalized = re.sub(r"\.$", "", normalized)
        normalized = re.sub(r"increase by ", "+", normalized, flags=re.IGNORECASE)
    elif language == "zh":
        normalized = re.sub(r"。$", "", normalized)

    return normalized


def extract_unique_2pc_effects(
    artifact_ids: list[str], artifact_data: dict[str, I18nArtifactData]
) -> list[HalfSet]:
    """
    Extract unique 2pc effects from i18n data.
    Replicates the TypeScript extractUnique2pcEffects function.
    Processes artifacts in reverse order (oldest first) for stable ID assignment.
    """
    half_sets: list[HalfSet] = []
    effect_text_map: dict[str, int] = {}
    next_id: int = 1

    filtered_artifact_ids: list[str] = [a for a in artifact_ids if a not in ARTIFACT_SKIP_LIST]

    for artifact_id in reversed(filtered_artifact_ids):
        data: I18nArtifactData | None = artifact_data.get(artifact_id)

        if (
            not data
            or not data.get("effects", {}).get("en")
            or not data.get("effects", {}).get("zh")
        ):
            continue

        effects_en: list[str] = data["effects"]["en"]
        effects_zh: list[str] = data["effects"]["zh"]

        if len(effects_en) == 0 or len(effects_zh) == 0:
            continue

        normalized_en: str = normalize_effect_text(effects_en[0], "en")
        normalized_zh: str = normalize_effect_text(effects_zh[0], "zh")

        existing_id: int | None = effect_text_map.get(normalized_en) or effect_text_map.get(
            normalized_zh
        )

        if existing_id is not None:
            existing_half_set: HalfSet | None = next(
                (hs for hs in half_sets if hs["id"] == existing_id), None
            )
            if existing_half_set:
                existing_half_set["setIds"].append(artifact_id)

                if len(normalized_en) < len(existing_half_set["normalizedEffectTextEn"]):
                    existing_half_set["normalizedEffectTextEn"] = normalized_en
                if len(normalized_zh) < len(existing_half_set["normalizedEffectTextZh"]):
                    existing_half_set["normalizedEffectTextZh"] = normalized_zh
        else:
            new_half_set: HalfSet = {
                "id": next_id,
                "setIds": [artifact_id],
                "normalizedEffectTextEn": normalized_en,
                "normalizedEffectTextZh": normalized_zh,
            }

            half_sets.append(new_half_set)
            effect_text_map[normalized_en] = new_half_set["id"]
            effect_text_map[normalized_zh] = new_half_set["id"]
            next_id += 1

    half_sets.sort(key=lambda hs: (-len(hs["setIds"]), -hs["id"]))

    return half_sets


def process_artifact_effects(
    artifact_ids: list[str],
    artifact_i18n_data: dict[str, I18nArtifactData],
) -> list[HalfSet]:
    """
    Process scraped data to compute half sets.
    This function is called by scrape_hoyolab.py after scraping is complete.
    """
    print(f"Computing half sets from {len(artifact_ids)} artifacts...")

    half_sets: list[HalfSet] = extract_unique_2pc_effects(artifact_ids, artifact_i18n_data)

    print(f"Generated {len(half_sets)} unique half sets:")
    for hs in half_sets:
        print(f"  ID {hs['id']}: {len(hs['setIds'])} sets - {hs['normalizedEffectTextEn'][:50]}...")

    return half_sets
