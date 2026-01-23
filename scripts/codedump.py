#!/usr/bin/env python3
"""
Orchestrator script for Genshin Impact data scraping and code generation.
Combines data from Fandom and Hoyolab wikis.
"""

import argparse
import json
import os
import re
import sys
from collections.abc import Sequence
from datetime import datetime
from typing import Any, Literal, cast

from pydantic import BaseModel
from tqdm import tqdm

import enka
import fandom

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from hoyolab import HoyolabAssetManager, HoyolabScraper, generate_id
from models import (
    ArtifactOutput,
    ArtifactSource,
    BaseItemSource,
    CharacterOutput,
    CharacterSource,
    EffectData,
    EnrichedCharacterSource,
    HalfSet,
    I18nArtifactData,
    MatchedItem,
    ResourceOutput,
    WeaponOutput,
    WeaponSource,
)
from preprocess import ARTIFACT_SKIP_LIST, process_artifact_effects

SKIP_EXISTING_IMAGES = True
RARITY_4_ARTIFACTS = ["Instructor"]


def extract_json_from_ts(content: str, variable_name: str) -> Any:
    """Extract JSON data from a TypeScript export definition"""
    # Look for content ending with a semicolon that is followed by 'export' or end of string
    # Also handle optional type annotations
    pattern = f"export const {variable_name}(?::.*?)? = (.*?);\\s*(?:export|$)"
    match = re.search(pattern, content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON for {variable_name}: {e}")
            return [] if "[]" in pattern else {}
    return [] if "[]" in pattern else {}


def load_existing_data(project_root: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Load existing data from resources.ts and i18n-game.ts"""
    resources_path = os.path.join(project_root, "src", "data", "resources.ts")
    i18n_path = os.path.join(project_root, "src", "data", "i18n-game.ts")

    resources: dict[str, Any] = {}
    i18n: dict[str, Any] = {}

    if os.path.exists(resources_path):
        with open(resources_path, encoding="utf-8") as f:
            content = f.read()
            resources["characters"] = extract_json_from_ts(content, "characters")
            resources["artifacts"] = extract_json_from_ts(content, "artifacts")
            resources["weapons"] = extract_json_from_ts(content, "weapons")
            resources["artifactHalfSets"] = extract_json_from_ts(content, "artifactHalfSets")
            resources["elementResources"] = extract_json_from_ts(content, "elementResources")
            resources["weaponTypeResources"] = extract_json_from_ts(content, "weaponTypeResources")

    if os.path.exists(i18n_path):
        with open(i18n_path, encoding="utf-8") as f:
            content = f.read()
            i18n = extract_json_from_ts(content, "i18nGameData")

    return resources, i18n


def match_items[T: BaseItemSource](
    items_en: Sequence[T],
    items_zh: Sequence[T],
    item_type: Literal["character", "artifact", "weapon"] = "character",
    scraper: HoyolabScraper | None = None,
) -> list[MatchedItem[T]]:
    """Match items across languages using entry ID and validate consistency"""
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
        fandom_char = fandom_data.get(key)

        # Create new EnrichedCharacterSource
        # Default fallback values
        weapon = "Sword"
        region = "None"
        release_date = datetime.now().strftime("%Y-%m-%d")

        if char.name.startswith("Traveler"):
            release_date = "2020-09-28"
        if fandom_char:
            weapon = fandom_char["weaponType"]
            region = fandom_char["region"]
            release_date = fandom_char["releaseDate"]
            matched_count += 1
        else:
            tqdm.write(f"Character {char.name} not found in Fandom data.")

            valid_weapons = ["Sword", "Claymore", "Polearm", "Bow", "Catalyst"]
            while True:
                val = input(
                    f"Please enter weapon type for {char.name} ({'/'.join(valid_weapons)}): "
                ).strip()
                # Case-insensitive matching
                matched_weapon = next((w for w in valid_weapons if w.lower() == val.lower()), None)
                if matched_weapon:
                    weapon = matched_weapon
                    break
                print(f"Invalid weapon type. Please choose from: {', '.join(valid_weapons)}")

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
    scraper: HoyolabScraper | None = None,
) -> tuple[list[CharacterOutput], dict[str, dict[str, str]], list[MatchedItem[CharacterSource]]]:
    enriched_characters_en = enrich_character_data_with_fandom(characters_en, fandom_data)

    matched_characters = match_items(enriched_characters_en, characters_zh, "character", scraper)

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

        # Interactive Rarity Check
        if en.rarity == 0:
            print(f"\nWARNING: Rarity 0 detected for Character: {en.name} / {zh.name}")
            while True:
                try:
                    val = input(f"Please enter actual rarity (4/5) for {en.name}: ").strip()
                    rarity_int = int(val)
                    if rarity_int in [4, 5]:
                        en.rarity = rarity_int
                        # Also update matched zh item if it was 0 or incorrect (keep in sync)
                        zh.rarity = rarity_int
                        break
                    else:
                        print("Invalid rarity. Please enter 4 or 5.")
                except ValueError:
                    print("Invalid number.")

        # Check if 'en' is EnrichedCharacterSource to access extra fields
        # If it came from match_items(enriched...), it should be.
        # However, match_items might have inserted dummy entries (CharacterSource) if missing.

        weapon = getattr(en, "weapon", "Sword")
        region = getattr(en, "region", "None")
        release_date = getattr(en, "release_date", "2020-09-28")

        character_id = generate_id(en.name)
        output = CharacterOutput(
            id=character_id,
            element=en.element,
            rarity=en.rarity,
            weaponType=weapon,
            region=region,
            releaseDate=release_date,
            imageUrl=en.image_url,
            imagePath=f"/character/{character_id}.png",
        )
        final_characters.append(output)

        i18n_chars[character_id] = {
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

        # Interactive Rarity Check
        if en.rarity == 0:
            print(f"\nWARNING: Rarity 0 detected for Weapon: {en.name} / {zh.name}")
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

        weapon_id = generate_id(en.name)
        output = WeaponOutput(
            id=weapon_id,
            rarity=en.rarity,
            type=en.type,
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


def write_data(
    character_data: list[CharacterOutput],
    artifact_data: list[ArtifactOutput],
    weapon_data: list[WeaponOutput],
    half_sets: list[HalfSet],
    elements: list[ResourceOutput],
    weapon_types: list[ResourceOutput],
    i18n_data: dict[str, dict[str, Any]],
) -> None:
    """Write processed data to TypeScript files"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    resources_path = os.path.join(project_root, "src", "data", "resources.ts")
    with open(resources_path, "w", encoding="utf-8") as f:
        f.write("// This file is auto-generated by scripts/codedump.py\n")
        f.write("// Do not edit this file directly\n\n")
        f.write(
            "import { ArtifactHalfSet, ArtifactSet, Character, ElementResource, "
            "Weapon, WeaponTypeResource } from './types';\n\n"
        )

        f.write("export const characters: Character[] = ")
        f.write(
            json.dumps(
                [
                    c.model_dump(by_alias=True) if isinstance(c, BaseModel) else c
                    for c in character_data
                ],
                indent=2,
                ensure_ascii=False,
            )
        )
        f.write(";\n\n")

        f.write("export const elementResources: ElementResource[] = ")
        f.write(
            json.dumps(
                [e.model_dump(by_alias=True) if isinstance(e, BaseModel) else e for e in elements],
                indent=2,
                ensure_ascii=False,
            )
        )
        f.write(";\n\n")

        f.write("export const weaponTypeResources: WeaponTypeResource[] = ")
        f.write(
            json.dumps(
                [
                    wt.model_dump(by_alias=True) if isinstance(wt, BaseModel) else wt
                    for wt in weapon_types
                ],
                indent=2,
                ensure_ascii=False,
            )
        )
        f.write(";\n\n")

        f.write("export const artifacts: ArtifactSet[] = ")
        f.write(
            json.dumps(
                [
                    a.model_dump(by_alias=True) if isinstance(a, BaseModel) else a
                    for a in artifact_data
                ],
                indent=2,
                ensure_ascii=False,
            )
        )
        f.write(";\n\n")

        f.write("export const artifactHalfSets: ArtifactHalfSet[] = ")
        f.write(
            json.dumps(
                [
                    hs.model_dump(by_alias=True) if isinstance(hs, BaseModel) else hs
                    for hs in half_sets
                ],
                indent=2,
                ensure_ascii=False,
            )
        )

        f.write(";\n\n")

        f.write("export const weapons: Weapon[] = ")
        f.write(
            json.dumps(
                [
                    w.model_dump(by_alias=True) if isinstance(w, BaseModel) else w
                    for w in weapon_data
                ],
                indent=2,
                ensure_ascii=False,
            )
        )
        f.write(";\n")

    print(f"Written resources to {resources_path}")

    i18n_path = os.path.join(project_root, "src", "data", "i18n-game.ts")
    with open(i18n_path, "w", encoding="utf-8") as f:
        f.write("// This file is auto-generated by scripts/codedump.py\n")
        f.write("// Do not edit this file directly\n\n")
        f.write("export const i18nGameData = ")
        serializable_i18n_data = {}
        for key, value in i18n_data.items():
            if isinstance(value, BaseModel):
                serializable_i18n_data[key] = value.model_dump(by_alias=True)
            elif isinstance(value, dict):
                # Handle dictionaries that might contain Pydantic models (like artifacts)
                new_dict = {}
                for k, v in value.items():
                    if isinstance(v, BaseModel):
                        new_dict[k] = v.model_dump(by_alias=True)
                    else:
                        new_dict[k] = v
                serializable_i18n_data[key] = new_dict
            else:
                serializable_i18n_data[key] = value

        f.write(json.dumps(serializable_i18n_data, indent=2, ensure_ascii=False))
        f.write(";\n")
    print(f"Written i18n data to {i18n_path}")


def download_all_images(
    characters: list[MatchedItem[CharacterSource]],
    artifacts: list[MatchedItem[ArtifactSource]],
    weapons: list[MatchedItem[WeaponSource]],
    elements: list[ResourceOutput] | None = None,
    weapon_types: list[ResourceOutput] | None = None,
) -> None:
    """Download all character, artifact, element, and weapon images"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    print("=== [4/4] Assets ===")

    with tqdm(characters, desc="Downloading Characters", unit="img") as pbar:
        for match in pbar:
            char = match["en"]
            HoyolabAssetManager.download_character_assets(char, project_root)

    print("Downloading artifact images...")

    with tqdm(
        artifacts,
        desc="Downloading Artifacts",
        unit="set",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ) as pbar:
        for match in pbar:
            art = match["en"]
            HoyolabAssetManager.download_artifact_assets(art, project_root)

    with tqdm(
        weapons,
        desc="Downloading Weapons",
        unit="img",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ) as pbar:
        for match in pbar:
            weap = match["en"]
            HoyolabAssetManager.download_weapon_assets(weap, project_root)

    if elements:
        print("Downloading element images...")
        for element in elements:
            HoyolabAssetManager.download_element_asset(element, project_root)

    if weapon_types:
        print("Downloading weapon type images...")
        for weapon_type in weapon_types:
            HoyolabAssetManager.download_weapon_type_asset(weapon_type, project_root)


def main():
    parser = argparse.ArgumentParser(description="Genshin Impact Data Scraper")
    parser.add_argument("--character", action="store_true", help="Update character data")
    parser.add_argument("--weapon", action="store_true", help="Update weapon data")
    parser.add_argument("--artifact", action="store_true", help="Update artifact data")
    parser.add_argument("--half-set", action="store_true", help="Recompute half sets only")
    parser.add_argument("--enka", action="store_true", help="Generate Enka ID maps")
    args = parser.parse_args()

    # Default to all if no flags provided
    if not (args.character or args.weapon or args.artifact or args.half_set or args.enka):
        args.character = True
        args.weapon = True
        args.artifact = True
        args.enka = True

    print("=== Genshin Impact Data Scraper ===")
    print(
        f"Modes: Character={args.character}, Weapon={args.weapon}, Artifact={args.artifact}, "
        f"Enka={args.enka}"
    )

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    # Load existing data
    existing_resources, existing_i18n = load_existing_data(project_root)

    # Initialize data containers with existing data or defaults
    character_data = existing_resources.get("characters", [])
    artifact_data = existing_resources.get("artifacts", [])
    weapon_data = existing_resources.get("weapons", [])
    half_sets = existing_resources.get("artifactHalfSets", [])
    elements = existing_resources.get("elementResources", [])
    weapon_types = existing_resources.get("weaponTypeResources", [])

    i18n_data: dict[str, dict[str, Any]] = (
        cast(dict[str, dict[str, Any]], existing_i18n)
        if existing_i18n
        else {
            "characters": {},
            "artifacts": {},
            "weapons": {},
        }
    )

    # Tracking for downloads
    matched_chars = []
    matched_arts = []
    matched_weaps = []
    new_elements = None
    new_weapon_types = None

    # 1. Scrape Fandom (only if needed)
    fandom_data = {}
    if args.character:
        fandom_data = fandom.get_character_data()

    print("=== [2/4] Hoyolab Data ===")
    if args.character or args.artifact or args.weapon:
        with HoyolabScraper() as scraper:
            try:
                if args.character:
                    chars_en = scraper.scrape_characters("en")
                    new_elements, new_weapon_types = scraper.scrape_elements_and_weapons("en")
                    chars_zh = scraper.scrape_characters("zh")

                    print("=== [3/4] Processing & Matching (Characters) ===")
                    c_data, c_i18n, matched_chars = process_characters(
                        chars_en, chars_zh, fandom_data, scraper
                    )
                    character_data = c_data
                    i18n_data["characters"] = c_i18n
                    elements = new_elements
                    weapon_types = new_weapon_types

                if args.artifact:
                    arts_en = scraper.scrape_artifacts("en")
                    arts_zh = scraper.scrape_artifacts("zh")

                    a_data, a_i18n, matched_arts = process_artifacts(arts_en, arts_zh, scraper)
                    artifact_data = a_data
                    i18n_data["artifacts"] = a_i18n

                if args.weapon:
                    weaps_en = scraper.scrape_weapons("en")
                    weaps_zh = scraper.scrape_weapons("zh")

                    w_data, w_i18n, matched_weaps = process_weapons(weaps_en, weaps_zh, scraper)
                    weapon_data = w_data
                    i18n_data["weapons"] = w_i18n

            except Exception as e:
                print(f"Error during scraping: {e}")
                import traceback

                traceback.print_exc()

    # 2.5 Recompute Half Sets (if requested or if artifacts were updated)
    if args.half_set or args.artifact:
        print("=== Computing Half Sets ===")

        # Prepare artifact_ids
        # If args.artifact was True, artifact_data contains Pydantic models
        # If from file, it contains dicts
        artifact_ids = []
        if artifact_data:
            if isinstance(artifact_data[0], BaseModel):
                artifact_ids = [a.id for a in artifact_data]
            else:
                artifact_ids = [a["id"] for a in artifact_data]  # type: ignore

        # Prepare i18n data (needs to be Pydantic models for preprocess.py)
        current_i18n_artifacts = i18n_data.get("artifacts", {})
        model_i18n_artifacts: dict[str, I18nArtifactData] = {}

        for aid, data in current_i18n_artifacts.items():
            if isinstance(data, I18nArtifactData):
                model_i18n_artifacts[aid] = data
            elif isinstance(data, dict):
                # Hydrate from dict
                model_i18n_artifacts[aid] = I18nArtifactData(**data)

        if artifact_ids and model_i18n_artifacts:
            half_sets, half_sets_i18n = process_artifact_effects(
                artifact_ids,
                model_i18n_artifacts,
            )
            i18n_data["artifactHalfSets"] = half_sets_i18n
        else:
            print("Warning: Skipping half set computation due to missing artifact data")

    # 3. Save Data
    if args.character or args.weapon or args.artifact or args.half_set:
        write_data(
            character_data,
            artifact_data,
            weapon_data,
            half_sets,
            elements,
            weapon_types,
            i18n_data,
        )

        # 4. Download Images (only for updated items)
        download_all_images(
            matched_chars, matched_arts, matched_weaps, new_elements, new_weapon_types
        )

    # 5. Enka Map Generation
    if args.enka:
        print("=== [5/5] Enka Map Generation ===")
        enka.run()


if __name__ == "__main__":
    main()
