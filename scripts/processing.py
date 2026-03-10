"""Data matching and transformation for scraped Genshin Impact entities.

Converts raw scraper output (EN/ZH pairs) into typed output models and i18n dicts.
"""

from collections.abc import Sequence
from typing import Any, Literal, cast

from tqdm import tqdm

import fandom
from halfset_finder import ARTIFACT_SKIP_LIST
from hoyolab import HoyolabScraper, generate_id
from models import (
    ArtifactOutput,
    ArtifactSource,
    BaseItemSource,
    CharacterOutput,
    CharacterSource,
    EffectData,
    EnemyOutput,
    EnemySource,
    EnrichedCharacterSource,
    I18nArtifactData,
    MatchedItem,
    WeaponOutput,
    WeaponSource,
)

RARITY_4_ARTIFACTS = [
    "Instructor",
    "Adventurer",
    "Brave Heart",
    "Lucky Dog",
    "Traveling Doctor",
    "Resolution of Sojourner",
    "Tiny Miracle",
    "Berserker",
    "The Exile",
    "Defender's Will",
    "Martial Artist",
    "Gambler",
    "Scholar",
]

ALL_ELEMENTS = ["Pyro", "Hydro", "Electro", "Cryo", "Anemo", "Dendro", "Geo"]

# Characters where 1 wiki entry expands to 7 element variant entries in resources.ts.
MULTI_ELEMENT_CHARACTERS: set[str] = {"Manekin", "Manekina"}

ELEMENT_ZH: dict[str, str] = {
    "Pyro": "火",
    "Hydro": "水",
    "Electro": "雷",
    "Cryo": "冰",
    "Anemo": "风",
    "Dendro": "草",
    "Geo": "岩",
}

# Characters whose element variants share a single portrait image.
# All variants use imagePath="/character/{base_id}.png".
# Sorted longest-first so "Manekina" matches before "Manekin".
SHARED_IMAGE_PREFIXES: tuple[str, ...] = ("Manekina", "Manekin", "Traveler")


def match_items[T: BaseItemSource](
    items_en: Sequence[T],
    items_zh: Sequence[T],
    item_type: Literal["character", "artifact", "weapon", "enemy"] = "character",
    scraper: HoyolabScraper | None = None,
) -> list[MatchedItem[T]]:
    """Match items across languages using entry ID and validate consistency."""
    matched_items: list[MatchedItem[T]] = []

    # Build lookup maps
    en_map_by_id = {item.entry_id: item for item in items_en if item.entry_id}
    zh_map_by_id = {item.entry_id: item for item in items_zh if item.entry_id}

    all_entry_ids = set(en_map_by_id.keys()) | set(zh_map_by_id.keys())

    # Sort IDs numerically (Newest -> Oldest) to ensure stable processing order
    # preprocess.py uses reversed() (Oldest -> Newest) to assign sequential IDs
    def get_sort_key(eid: str) -> int:
        return int(eid) if eid.isdigit() else 999999999

    ordered_ids = sorted(all_entry_ids, key=get_sort_key, reverse=True)

    # Wrap the iterator with tqdm for progress
    for eid in tqdm(
        ordered_ids,
        desc=f"Matching {item_type}s",
        unit="item",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ):
        item_en = en_map_by_id.get(eid)
        item_zh = zh_map_by_id.get(eid)

        if item_en and item_zh:
            if item_type == "character":
                # Check consistency
                char_en = cast(CharacterSource, item_en)
                char_zh = cast(CharacterSource, item_zh)
                if char_en.element != char_zh.element or char_en.rarity != char_zh.rarity:
                    print(
                        f"ERROR: {item_type} {eid} - element/rarity mismatch: "
                        f"EN={char_en.element} {char_en.rarity}*, "
                        f"ZH={char_zh.element} {char_zh.rarity}*"
                    )
            # Match found
            matched_items.append(MatchedItem(en=item_en, zh=item_zh))
        elif item_en:
            tqdm.write(
                f"{item_type.capitalize()} '{item_en.name}' (ID: {eid}) "
                "only exists in EN. Attempting to fetch ZH name..."
            )
            dummy_zh = item_en.model_copy(deep=True)

            zh_name = None
            if scraper:
                zh_name = scraper.fetch_entry_name(item_en.entry_id, "zh-cn")

            dummy_zh.name = zh_name if zh_name else "???"

            if hasattr(dummy_zh, "effects"):
                dummy_zh.effects = ["???", "???"]  # type: ignore
            if hasattr(dummy_zh, "effect"):
                dummy_zh.effect = "???"  # type: ignore
            matched_items.append(MatchedItem(en=item_en, zh=dummy_zh))
        elif item_zh:
            tqdm.write(
                f"{item_type.capitalize()} '{item_zh.name}' (ID: {eid}) "
                "only exists in ZH. Attempting to fetch EN name..."
            )
            dummy_en = item_zh.model_copy(deep=True)

            en_name = None
            if scraper:
                en_name = scraper.fetch_entry_name(item_zh.entry_id, "en-us")

            dummy_en.name = en_name if en_name else "???"

            if hasattr(dummy_en, "effects"):
                dummy_en.effects = ["???", "???"]  # type: ignore
            if hasattr(dummy_en, "effect"):
                dummy_en.effect = "???"  # type: ignore
            matched_items.append(MatchedItem(en=dummy_en, zh=item_zh))

    return matched_items


def enrich_character_data_with_fandom(
    characters_en: list[CharacterSource],
    fandom_data: dict[tuple[str, int, str], fandom.CharacterData],
    existing_characters: dict[str, dict[str, Any]],
) -> list[EnrichedCharacterSource]:
    """Enrich character data with weapon, region, and release date from Fandom data"""
    enriched_characters: list[EnrichedCharacterSource] = []

    matched_count = 0
    for char in tqdm(
        characters_en,
        desc="Enriching (Fandom)",
        unit="char",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ):
        key = (char.element, char.rarity, char.name)
        if char.name.startswith("Traveler"):
            key = ("None", 5, "Traveler")
        elif char.name in MULTI_ELEMENT_CHARACTERS:
            key = ("None", char.rarity, char.name)
        fandom_char = fandom_data.get(key)

        # Default fallback values
        weapon = "Sword"
        region = "None"
        release_date: str | None = None

        if char.name.startswith("Traveler"):
            release_date = "2020-09-28"
        elif fandom_char:
            weapon = fandom_char["weaponType"]
            region = fandom_char["region"]
            release_date = fandom_char["releaseDate"]
            matched_count += 1
        else:
            # Reuse values from existing data, prompt only as last resort
            char_id = generate_id(char.name)
            existing = existing_characters.get(char_id, {})
            weapon = existing.get("weaponType", "")
            region = existing.get("region", "None")
            release_date = existing.get("releaseDate")

            if not weapon:
                tqdm.write(f"Character {char.name} not in Fandom or existing data.")
                valid = ["Sword", "Claymore", "Polearm", "Bow", "Catalyst"]
                while True:
                    val = input(f"Enter weapon type for {char.name} ({'/'.join(valid)}): ").strip()
                    matched_w = next(
                        (w for w in valid if w.lower() == val.lower()),
                        None,
                    )
                    if matched_w:
                        weapon = matched_w
                        break
                    print(f"Invalid. Choose from: {', '.join(valid)}")
            else:
                tqdm.write(
                    f"Character {char.name} not in Fandom. "
                    f"Reusing: weapon={weapon}, region={region}, "
                    f"date={release_date}"
                )

        # Construct enriched object
        enriched_char = EnrichedCharacterSource(
            **char.model_dump(),
            weapon=weapon,
            region=region,
            releaseDate=release_date,
        )
        enriched_characters.append(enriched_char)

    tqdm.write(
        f"Enrich complete: {matched_count}/{len(characters_en)} characters matched with Fandom data"
    )

    return enriched_characters


def process_characters(
    characters_en: list[CharacterSource],
    characters_zh: list[CharacterSource],
    fandom_data: dict[tuple[str, int, str], fandom.CharacterData],
    existing_characters: dict[str, dict[str, Any]],
    scraper: HoyolabScraper | None = None,
    details: bool = True,
) -> tuple[list[CharacterOutput], dict[str, dict[str, str]], list[MatchedItem[CharacterSource]]]:
    if details:
        enriched_characters_en = enrich_character_data_with_fandom(
            characters_en, fandom_data, existing_characters
        )
        matched_characters = match_items(
            enriched_characters_en, characters_zh, "character", scraper
        )
    else:
        matched_characters = match_items(characters_en, characters_zh, "character", scraper)

    final_characters: list[CharacterOutput] = []
    i18n_chars: dict[str, dict[str, str]] = {}

    for m in tqdm(
        matched_characters,
        desc="Processing Characters",
        unit="item",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ):
        en = m["en"]
        zh = m["zh"]

        # Rarity fallback: check existing data before prompting
        if en.rarity == 0:
            char_id = generate_id(en.name)
            existing_rarity = existing_characters.get(char_id, {}).get("rarity", 0)
            if existing_rarity in (4, 5):
                en.rarity = existing_rarity
                zh.rarity = existing_rarity
                tqdm.write(f"Rarity 0 for {en.name}: reusing existing rarity={existing_rarity}")
            else:
                print(f"\nWARNING: Rarity 0 detected for Character: {en.name} / {zh.name}")
                print("No existing rarity found. Please enter manually.")
                while True:
                    try:
                        val = input(f"Please enter actual rarity (4/5) for {en.name}: ").strip()
                        rarity_int = int(val)
                        if rarity_int in [4, 5]:
                            en.rarity = rarity_int
                            zh.rarity = rarity_int
                            break
                        else:
                            print("Invalid rarity. Please enter 4 or 5.")
                    except ValueError:
                        print("Invalid number.")

        weapon = getattr(en, "weapon", "Sword")
        region = getattr(en, "region", "None")
        release_date = getattr(en, "release_date", None)

        base_id = generate_id(en.name)

        # Determine shared image path for characters whose variants share one portrait
        shared_base = next(
            (p.lower() for p in SHARED_IMAGE_PREFIXES if en.name.startswith(p)),
            None,
        )
        image_path = f"/character/{shared_base}.png" if shared_base else f"/character/{base_id}.png"

        if en.name in MULTI_ELEMENT_CHARACTERS:
            # Expand 1 wiki entry into 7 element variant entries
            for element in ALL_ELEMENTS:
                variant_id = f"{base_id}_{element.lower()}"
                output = CharacterOutput(
                    id=variant_id,
                    element=element,
                    rarity=en.rarity,
                    weaponType=weapon,
                    region=region,
                    releaseDate=release_date,
                    imageUrl=en.image_url,
                    imagePath=image_path,
                )
                final_characters.append(output)
                i18n_chars[variant_id] = {
                    "en": f"{en.name} ({element})",
                    "zh": f"{zh.name}（{ELEMENT_ZH[element]}）",
                }
        else:
            output = CharacterOutput(
                id=base_id,
                element=en.element,
                rarity=en.rarity,
                weaponType=weapon,
                region=region,
                releaseDate=release_date,
                imageUrl=en.image_url,
                imagePath=image_path,
            )
            final_characters.append(output)
            i18n_chars[base_id] = {
                "en": en.name,
                "zh": zh.name,
            }

    return final_characters, i18n_chars, matched_characters


def process_artifacts(
    artifacts_en: list[ArtifactSource],
    artifacts_zh: list[ArtifactSource],
    scraper: HoyolabScraper | None = None,
) -> tuple[list[ArtifactOutput], dict[str, I18nArtifactData], list[MatchedItem[ArtifactSource]]]:
    matched_artifacts = match_items(artifacts_en, artifacts_zh, "artifact", scraper)

    final_artifacts: list[ArtifactOutput] = []
    i18n_artifacts: dict[str, I18nArtifactData] = {}

    for m in tqdm(
        matched_artifacts,
        desc="Processing Artifacts",
        unit="item",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ):
        en = m["en"]
        zh = m["zh"]
        artifact_id = generate_id(en.name)
        if artifact_id in ARTIFACT_SKIP_LIST:
            continue
        # Instructor is 4-star, others are 5-star for now
        rarity = 4 if en.name in RARITY_4_ARTIFACTS else 5

        image_paths = {}
        suffixes = {"flower": "", "plume": "2", "sands": "3", "goblet": "4", "circlet": "5"}

        for slot, suffix in suffixes.items():
            image_paths[slot] = f"/artifact/{artifact_id}{suffix}.png"

        output = ArtifactOutput(
            id=artifact_id,
            rarity=rarity,
            imageUrl=en.image_urls.get("flower", ""),
            imagePaths=image_paths,
        )
        final_artifacts.append(output)

        i18n_artifacts[artifact_id] = I18nArtifactData(
            name={"en": en.name, "zh": zh.name},
            effects=EffectData(en=en.effects, zh=zh.effects),
        )

    return final_artifacts, i18n_artifacts, matched_artifacts


def process_weapons(
    weapons_en: list[WeaponSource],
    weapons_zh: list[WeaponSource],
    existing_weapons: dict[str, dict[str, Any]],
    scraper: HoyolabScraper | None = None,
) -> tuple[list[WeaponOutput], dict[str, dict[str, Any]], list[MatchedItem[WeaponSource]]]:
    matched_weapons = match_items(weapons_en, weapons_zh, "weapon", scraper)

    final_weapons: list[WeaponOutput] = []
    i18n_weapons: dict[str, dict[str, Any]] = {}

    for m in tqdm(
        matched_weapons,
        desc="Processing Weapons",
        unit="item",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ):
        en = m["en"]
        zh = m["zh"]
        weapon_id = generate_id(en.name)
        existing = existing_weapons.get(weapon_id, {})

        # Rarity fallback: check existing data before prompting
        if en.rarity == 0:
            existing_rarity = existing.get("rarity", 0)
            if 1 <= existing_rarity <= 5:
                en.rarity = existing_rarity
                zh.rarity = existing_rarity
                tqdm.write(f"Rarity 0 for {en.name}: reusing existing rarity={existing_rarity}")
            else:
                print(f"\nWARNING: Rarity 0 for Weapon: {en.name} / {zh.name}")
                print("No existing rarity found. Please enter manually.")
                while True:
                    try:
                        val = input(f"Please enter actual rarity (1-5) for {en.name}: ").strip()
                        rarity_int = int(val)
                        if 1 <= rarity_int <= 5:
                            en.rarity = rarity_int
                            zh.rarity = rarity_int
                            break
                        else:
                            print("Invalid rarity. Please enter 1-5.")
                    except ValueError:
                        print("Invalid number.")

        # Weapon type fallback: reuse from existing data if scraping missed it
        weapon_type = en.type
        if not weapon_type:
            weapon_type = existing.get("type", "")
            if weapon_type:
                tqdm.write(
                    f"Weapon type missing for {en.name}: reusing existing type={weapon_type}"
                )

        output = WeaponOutput(
            id=weapon_id,
            rarity=en.rarity,
            type=weapon_type,
            secondaryStat=en.secondary_stat,
            baseAtk=en.base_atk,
            secondaryStatValue=en.secondary_stat_value,
            imageUrl=en.image_url,
            imagePath=f"/weapon/{weapon_id}.png",
        )
        final_weapons.append(output)

        i18n_weapons[weapon_id] = {
            "name": {"en": en.name, "zh": zh.name},
            "effect": {"en": en.effect, "zh": zh.effect},
        }

    return final_weapons, i18n_weapons, matched_weapons


def process_enemies(
    enemies_en: list[EnemySource],
    enemies_zh: list[EnemySource],
    scraper: HoyolabScraper | None = None,
) -> tuple[list[EnemyOutput], dict[str, dict[str, str]], list[MatchedItem[EnemySource]]]:
    matched_enemies = match_items(enemies_en, enemies_zh, "enemy", scraper)

    final_enemies: list[EnemyOutput] = []
    i18n_enemies: dict[str, dict[str, str]] = {}

    for m in tqdm(
        matched_enemies,
        desc="Processing Enemies",
        unit="item",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ):
        en = m["en"]
        zh = m["zh"]
        enemy_id = en.entry_id  # use wiki entry ID as the stable identifier

        output = EnemyOutput(
            id=enemy_id,
            type=en.enemy_type,
            imagePath=f"/enemy/{enemy_id}.png",
        )
        final_enemies.append(output)

        i18n_enemies[enemy_id] = {
            "en": en.name,
            "zh": zh.name,
        }

    return final_enemies, i18n_enemies, matched_enemies
