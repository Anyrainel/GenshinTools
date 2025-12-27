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
from typing import (
    Any,
    Literal,
    TypedDict,
    cast,
)

import requests
from playwright.sync_api import sync_playwright

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import fandom
import hoyolab
from hoyolab import ResourceOutput, ScrapedArtifact, ScrapedCharacter, ScrapedWeapon
from preprocess import ARTIFACT_SKIP_LIST, I18nArtifactData, process_artifact_effects


class CharacterOutput(TypedDict):
    id: str
    element: str
    rarity: int
    weaponType: str
    region: str
    releaseDate: str
    imageUrl: str
    imagePath: str


class ArtifactOutput(TypedDict):
    id: str
    rarity: int
    imageUrl: str  # flower image url
    imagePaths: dict[str, str]


class WeaponOutput(TypedDict):
    id: str
    rarity: int
    type: str
    secondaryStat: str
    baseAtk: int
    secondaryStatValue: str
    imageUrl: str
    imagePath: str


class EnrichedCharacter(ScrapedCharacter):
    weapon: str
    region: str
    releaseDate: str


class MatchedItem[T: ScrapedCharacter | ScrapedArtifact | ScrapedWeapon](TypedDict):
    en: T
    zh: T


SKIP_EXISTING_IMAGES = True


def extract_json_from_ts(content: str, variable_name: str) -> Any:
    """Extract JSON data from a TypeScript export definition"""
    pattern = f"export const {variable_name}: .*? = (.*);"
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


def download_image(url: str, filepath: str) -> bool:
    """Download an image from URL to filepath"""
    if SKIP_EXISTING_IMAGES and os.path.exists(filepath):
        print(f"Skipping existing image: {os.path.basename(filepath)}")
        return True

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(response.content)
        print(f"Downloaded: {os.path.basename(filepath)}")
        return True
    except Exception as e:
        print(f"Failed to download image {url}: {e}")
        return False


def match_items[T: ScrapedCharacter | ScrapedArtifact | ScrapedWeapon](
    items_en: Sequence[T],
    items_zh: Sequence[T],
    item_type: Literal["character", "artifact", "weapon"] = "character",
) -> list[MatchedItem[T]]:
    """Match items across languages using entry ID and validate consistency"""
    matched_items: list[MatchedItem[T]] = []

    # Build lookup maps
    en_map_by_id = {item["entry_id"]: item for item in items_en if item.get("entry_id")}
    zh_map_by_id = {item["entry_id"]: item for item in items_zh if item.get("entry_id")}

    all_entry_ids = set(en_map_by_id.keys()) | set(zh_map_by_id.keys())

    for eid in sorted(all_entry_ids):
        item_en = en_map_by_id.get(eid)
        item_zh = zh_map_by_id.get(eid)

        if item_en and item_zh:
            if item_type == "character":
                # Check consistency
                char_en = cast(ScrapedCharacter, item_en)
                char_zh = cast(ScrapedCharacter, item_zh)
                if (
                    char_en["element"] != char_zh["element"]
                    or char_en["rarity"] != char_zh["rarity"]
                ):
                    print(
                        f"ERROR: {item_type} {eid} - element/rarity mismatch: "
                        f"EN={char_en['element']} {char_en['rarity']}*, "
                        f"ZH={char_zh['element']} {char_zh['rarity']}*"
                    )
            matched_items.append({"en": item_en, "zh": item_zh})
        elif item_en:
            print(
                f"LOG: {item_type.capitalize()} '{item_en['name']}' (ID: {eid}) "
                "only exists in EN. Using ??? for ZH."
            )
            dummy_zh = cast(T, item_en.copy())
            dummy_zh["name"] = "???"
            if "effects" in dummy_zh:
                dummy_zh["effects"] = ["???", "???"]
            if "effect" in dummy_zh:
                dummy_zh["effect"] = "???"
            matched_items.append({"en": item_en, "zh": dummy_zh})
        elif item_zh:
            print(
                f"LOG: {item_type.capitalize()} '{item_zh['name']}' (ID: {eid}) "
                "only exists in ZH. Using ??? for EN."
            )
            dummy_en = cast(T, item_zh.copy())
            dummy_en["name"] = "???"
            # Ensure we have a valid 'id' slug for the EN side
            if not dummy_en.get("id") or dummy_en["id"] == "":
                dummy_en["id"] = f"unknown_{eid}"

            if "effects" in dummy_en:
                dummy_en["effects"] = ["???", "???"]
            if "effect" in dummy_en:
                dummy_en["effect"] = "???"
            matched_items.append({"en": dummy_en, "zh": item_zh})

    return matched_items


def enrich_character_data_with_fandom(
    characters_en: list[ScrapedCharacter],
    fandom_data: dict[tuple[str, int, str], fandom.CharacterData],
) -> list[EnrichedCharacter]:
    """Enrich character data with weapon, region, and release date from Fandom data"""
    enriched_characters: list[EnrichedCharacter] = []

    matched_count = 0
    for char in characters_en:
        key = (char["element"], char["rarity"], char["name"])
        fandom_char = fandom_data.get(key)

        # Create a new dict with all original fields plus new ones
        # Use dict() constructor to ensure we get a mutable dict, not TypedDict
        enriched_char: dict[str, Any] = dict(char)

        if fandom_char:
            enriched_char["weapon"] = fandom_char["weaponType"]
            enriched_char["region"] = fandom_char["region"]
            enriched_char["releaseDate"] = fandom_char["releaseDate"]
            matched_count += 1
            if matched_count <= 5:  # Only print first few to avoid spam
                print(
                    f"Enriched {char['name']} from Fandom: "
                    f"weapon={fandom_char['weaponType']}, "
                    f"region={fandom_char['region']}, "
                    f"date={fandom_char['releaseDate']}"
                )
        else:
            # Try to find similar keys for debugging
            similar_keys = [
                k for k in fandom_data.keys() if k[0] == char["element"] and k[1] == char["rarity"]
            ]
            if similar_keys and len(enriched_characters) < 5:  # Only show first few
                print(f"DEBUG: {char['name']} not found, but found similar: {similar_keys[:3]}")

            # Default values for characters not in Fandom (like Traveler elements, or very new ones)
            enriched_char["weapon"] = "Sword"
            enriched_char["region"] = "None"
            enriched_char["releaseDate"] = "2020-09-28"

            if len(enriched_characters) - matched_count <= 5:  # Only print first few unmatched
                print(f"Using defaults for {char['name']} (Not found in Fandom) - key: {key}")

        enriched_characters.append(enriched_char)  # type: ignore

    print(
        f"Enrich complete: {matched_count}/{len(characters_en)} characters matched with Fandom data"
    )

    return enriched_characters


def process_characters(
    characters_en: list[ScrapedCharacter],
    characters_zh: list[ScrapedCharacter],
    fandom_data: dict[tuple[str, int, str], fandom.CharacterData],
) -> tuple[list[CharacterOutput], dict[str, dict[str, str]], list[MatchedItem[ScrapedCharacter]]]:
    enriched_characters_en = enrich_character_data_with_fandom(characters_en, fandom_data)
    matched_characters = match_items(enriched_characters_en, characters_zh, "character")

    character_data: list[CharacterOutput] = []
    i18n_chars: dict[str, dict[str, str]] = {}

    for match in matched_characters:
        char_en = match["en"]
        char_zh = match["zh"]

        # Verify enriched fields exist
        weapon = char_en.get("weapon", "Sword")
        region = char_en.get("region", "None")
        release_date = char_en.get("releaseDate", "2020-09-28")

        character_data.append(
            {
                "id": char_en["id"],
                "element": char_en["element"],
                "rarity": char_en["rarity"],
                "weaponType": weapon,
                "region": region,
                "releaseDate": release_date,
                "imageUrl": char_en["image_url"],
                "imagePath": f"/character/{char_en['id']}.png",
            }
        )
        i18n_chars[char_en["id"]] = {
            "en": char_en["name"],
            "zh": char_zh["name"],
        }

    return character_data, i18n_chars, matched_characters


def process_artifacts(
    artifacts_en: list[ScrapedArtifact],
    artifacts_zh: list[ScrapedArtifact],
) -> tuple[list[ArtifactOutput], dict[str, dict[str, Any]], list[MatchedItem[ScrapedArtifact]]]:
    matched_artifacts_all = match_items(artifacts_en, artifacts_zh, "artifact")

    # Filter out ignored artifacts
    matched_artifacts = [
        m for m in matched_artifacts_all if m["en"]["id"] not in ARTIFACT_SKIP_LIST
    ]

    artifact_data: list[ArtifactOutput] = []
    i18n_arts: dict[str, dict[str, Any]] = {}

    for match in matched_artifacts:
        art_en = match["en"]
        art_zh = match["zh"]

        rarity = 4 if art_en["id"] == "instructor" else 5

        image_urls = art_en.get("image_urls", {})
        flower_url = image_urls.get("flower", "")

        image_paths = {}
        suffixes = {"flower": "", "plume": "2", "sands": "3", "goblet": "4", "circlet": "5"}

        for slot, suffix in suffixes.items():
            image_paths[slot] = f"/artifact/{art_en['id']}{suffix}.png"

        artifact_data.append(
            {
                "id": art_en["id"],
                "rarity": rarity,
                "imageUrl": flower_url,
                "imagePaths": image_paths,
            }
        )
        i18n_arts[art_en["id"]] = {
            "name": {"en": art_en["name"], "zh": art_zh["name"]},
            "effects": {"en": art_en["effects"], "zh": art_zh["effects"]},
        }

    return artifact_data, i18n_arts, matched_artifacts


def process_weapons(
    weapons_en: list[ScrapedWeapon],
    weapons_zh: list[ScrapedWeapon],
) -> tuple[list[WeaponOutput], dict[str, dict[str, Any]], list[MatchedItem[ScrapedWeapon]]]:
    matched_weapons = match_items(weapons_en, weapons_zh, "weapon")

    weapon_data: list[WeaponOutput] = []
    i18n_weaps: dict[str, dict[str, Any]] = {}

    for match in matched_weapons:
        weap_en = match["en"]
        weap_zh = match["zh"]

        weapon_data.append(
            {
                "id": weap_en["id"],
                "rarity": weap_en["rarity"],
                "type": weap_en["type"],
                "secondaryStat": weap_en["secondary_stat"],
                "baseAtk": weap_en.get("base_atk", 0),
                "secondaryStatValue": weap_en.get("secondary_stat_value", ""),
                "imageUrl": weap_en["image_url"],
                "imagePath": f"/weapon/{weap_en['id']}.png",
            }
        )
        i18n_weaps[weap_en["id"]] = {
            "name": {"en": weap_en["name"], "zh": weap_zh["name"]},
            "effect": {"en": weap_en["effect"], "zh": weap_zh["effect"]},
        }

    return weapon_data, i18n_weaps, matched_weapons


def write_data(
    character_data: list[CharacterOutput],
    artifact_data: list[ArtifactOutput],
    weapon_data: list[WeaponOutput],
    half_sets: list[Any],
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
        f.write(json.dumps(character_data, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("export const elementResources: ElementResource[] = ")
        f.write(json.dumps(elements, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("export const weaponTypeResources: WeaponTypeResource[] = ")
        f.write(json.dumps(weapon_types, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("export const artifacts: ArtifactSet[] = ")
        f.write(json.dumps(artifact_data, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("export const artifactHalfSets: ArtifactHalfSet[] = ")
        f.write(json.dumps(half_sets, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("export const weapons: Weapon[] = ")
        f.write(json.dumps(weapon_data, indent=2, ensure_ascii=False))
        f.write(";\n")

    print(f"Written resources to {resources_path}")

    i18n_path = os.path.join(project_root, "src", "data", "i18n-game.ts")
    with open(i18n_path, "w", encoding="utf-8") as f:
        f.write("// This file is auto-generated by scripts/codedump.py\n")
        f.write("// Do not edit this file directly\n\n")
        f.write("export const i18nGameData = ")
        f.write(json.dumps(i18n_data, indent=2, ensure_ascii=False))
        f.write(";\n")
    print(f"Written i18n data to {i18n_path}")


def download_all_images(
    characters: list[MatchedItem[ScrapedCharacter]],
    artifacts: list[MatchedItem[ScrapedArtifact]],
    weapons: list[MatchedItem[ScrapedWeapon]],
    elements: list[ResourceOutput] | None = None,
    weapon_types: list[ResourceOutput] | None = None,
) -> None:
    """Download all character, artifact, element, and weapon images"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    print("Downloading character images...")
    for match in characters:
        char = match["en"]
        filename = os.path.join(project_root, "public", "character", f"{char['id']}.png")
        download_image(char["image_url"], filename)

    print("Downloading artifact images...")
    suffixes = {"flower": "", "plume": "2", "sands": "3", "goblet": "4", "circlet": "5"}
    for match in artifacts:
        art = match["en"]
        image_urls = art.get("image_urls", {})

        for slot, suffix in suffixes.items():
            url = image_urls.get(slot)
            if url:
                filename = os.path.join(
                    project_root, "public", "artifact", f"{art['id']}{suffix}.png"
                )
                download_image(url, filename)

    print("Downloading weapon images...")
    for match in weapons:
        weap = match["en"]
        filename = os.path.join(project_root, "public", "weapon", f"{weap['id']}.png")
        download_image(weap["image_url"], filename)

    if elements:
        print("Downloading element images...")
        for element in elements:
            filename = os.path.join(
                project_root, "public", "element", f"{element['name'].lower()}.png"
            )
            download_image(element["imageUrl"], filename)

    if weapon_types:
        print("Downloading weapon type images...")
        for weapon_type in weapon_types:
            filename = os.path.join(
                project_root,
                "public",
                "weapontype",
                f"{weapon_type['name'].lower()}.png",
            )
            download_image(weapon_type["imageUrl"], filename)


def main():
    parser = argparse.ArgumentParser(description="Genshin Impact Data Scraper")
    parser.add_argument("--character", action="store_true", help="Update character data")
    parser.add_argument("--weapon", action="store_true", help="Update weapon data")
    parser.add_argument("--artifact", action="store_true", help="Update artifact data")
    args = parser.parse_args()

    # Default to all if no flags provided
    if not (args.character or args.weapon or args.artifact):
        args.character = True
        args.weapon = True
        args.artifact = True

    print("=== Genshin Impact Data Scraper ===")
    print(f"Modes: Character={args.character}, Weapon={args.weapon}, Artifact={args.artifact}")

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

    # 2. Scrape Hoyolab
    if args.character or args.artifact or args.weapon:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
            )
            page = context.new_page()

            try:
                # Character Data
                if args.character:
                    chars_en = hoyolab.scrape_characters(page, "en")
                    new_elements, new_weapon_types = hoyolab.scrape_elements_and_weapons(page, "en")
                    chars_zh = hoyolab.scrape_characters(page, "zh")

                    c_data, c_i18n, matched_chars = process_characters(
                        chars_en, chars_zh, fandom_data
                    )
                    character_data = c_data
                    i18n_data["characters"] = c_i18n
                    elements = new_elements
                    weapon_types = new_weapon_types

                # Artifact Data
                if args.artifact:
                    arts_en = hoyolab.scrape_artifacts(page, "en")
                    arts_zh = hoyolab.scrape_artifacts(page, "zh")

                    a_data, a_i18n, matched_arts = process_artifacts(arts_en, arts_zh)
                    artifact_data = a_data
                    i18n_data["artifacts"] = a_i18n

                    # Recompute half sets
                    print("Computing artifact half sets...")
                    # We need IDs from the newly scraped data (which are in a_data)
                    # Use a_data because it filtered out skipped artifacts
                    artifact_ids = [a["id"] for a in a_data]
                    half_sets = process_artifact_effects(
                        artifact_ids,
                        cast(dict[str, I18nArtifactData], i18n_data["artifacts"]),
                    )

                # Weapon Data
                if args.weapon:
                    weaps_en = hoyolab.scrape_weapons(page, "en")
                    weaps_zh = hoyolab.scrape_weapons(page, "zh")

                    w_data, w_i18n, matched_weaps = process_weapons(weaps_en, weaps_zh)
                    weapon_data = w_data
                    i18n_data["weapons"] = w_i18n

            except Exception as e:
                print(f"Error in scraping: {e}")
                import traceback

                traceback.print_exc()
            finally:
                browser.close()

    # 3. Save Data
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
    download_all_images(matched_chars, matched_arts, matched_weaps, new_elements, new_weapon_types)


if __name__ == "__main__":
    main()
