#!/usr/bin/env python3
"""
Orchestrator script for Genshin Impact data scraping and code generation.
Combines data from Fandom and Hoyolab wikis.
"""

import json
import os
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
from preprocess import process_artifact_effects


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
    imageUrl: str
    imagePath: str


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


def match_items_by_image_url[T: ScrapedCharacter | ScrapedArtifact | ScrapedWeapon](
    items_en: Sequence[T],
    items_zh: Sequence[T],
    item_type: Literal["character", "artifact", "weapon"] = "character",
) -> list[MatchedItem[T]]:
    """Match items across languages using image URLs and validate consistency"""
    matched_items: list[MatchedItem[T]] = []

    for i, item_en in enumerate(items_en):
        matched_zh: T | None = None
        for item_zh in items_zh:
            if item_en["image_url"] == item_zh["image_url"]:
                matched_zh = item_zh
                break

        if not matched_zh and i < len(items_zh):
            matched_zh = items_zh[i]
            print(
                f"WARNING: {item_type} {i + 1} matched by index instead of URL\n"
                f"EN: {item_en['image_url']}\nZH: {matched_zh['image_url']}"
            )

        if matched_zh:
            if item_type == "character":
                # Loose check to avoid 'Item has no attribute element' error if it was an artifact
                if "element" in item_en and "element" in matched_zh:
                    char_en = cast(ScrapedCharacter, item_en)
                    char_zh = cast(ScrapedCharacter, matched_zh)

                    if (
                        char_en["element"] != char_zh["element"]
                        or char_en["rarity"] != char_zh["rarity"]
                    ):
                        print(
                            f"ERROR: {item_type} {item_en['name']} - element/rarity "
                            "mismatch between languages"
                        )
                        print(f"  EN: {char_en['element']} {char_en['rarity']}*")
                        print(f"  ZH: {char_zh['element']} {char_zh['rarity']}*")
                        continue

            matched_items.append({"en": item_en, "zh": matched_zh})
        else:
            print(f"WARNING: No Chinese match found for {item_type} {item_en['name']}")

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


def save_typescript_data(
    characters_en: list[ScrapedCharacter],
    characters_zh: list[ScrapedCharacter],
    artifacts_en: list[ScrapedArtifact],
    artifacts_zh: list[ScrapedArtifact],
    weapons_en: list[ScrapedWeapon],
    weapons_zh: list[ScrapedWeapon],
    fandom_data: dict[tuple[str, int, str], fandom.CharacterData],
    elements: list[ResourceOutput],
    weapon_types: list[ResourceOutput],
) -> None:
    """Save scraped data in TypeScript format"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    enriched_characters_en = enrich_character_data_with_fandom(characters_en, fandom_data)

    matched_characters = match_items_by_image_url(
        enriched_characters_en, characters_zh, "character"
    )

    character_data: list[CharacterOutput] = []
    for match in matched_characters:
        char_en = match["en"]

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

    matched_artifacts = match_items_by_image_url(
        artifacts_en,
        artifacts_zh,
        "artifact",
    )

    artifact_data: list[ArtifactOutput] = []
    for match in matched_artifacts:
        art_en = match["en"]

        rarity = 4 if art_en["id"] == "instructor" else 5

        artifact_data.append(
            {
                "id": art_en["id"],
                "rarity": rarity,
                "imageUrl": art_en["image_url"],
                "imagePath": f"/artifact/{art_en['id']}.png",
            }
        )

    matched_weapons = match_items_by_image_url(
        weapons_en,
        weapons_zh,
        "weapon",
    )

    weapon_data: list[WeaponOutput] = []
    for match in matched_weapons:
        weap_en = match["en"]

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

    i18n_data: dict[str, dict[str, Any]] = {
        "characters": {},
        "artifacts": {},
        "weapons": {},
    }

    for match in matched_characters:
        char_en = match["en"]
        char_zh = match["zh"]

        i18n_data["characters"][char_en["id"]] = {
            "en": char_en["name"],
            "zh": char_zh["name"],
        }

    for match in matched_artifacts:
        art_en = match["en"]
        art_zh = match["zh"]

        i18n_data["artifacts"][art_en["id"]] = {
            "name": {"en": art_en["name"], "zh": art_zh["name"]},
            "effects": {"en": art_en["effects"], "zh": art_zh["effects"]},
        }

    for match in matched_weapons:
        weap_en = match["en"]
        weap_zh = match["zh"]

        i18n_data["weapons"][weap_en["id"]] = {
            "name": {"en": weap_en["name"], "zh": weap_zh["name"]},
            "effect": {"en": weap_en["effect"], "zh": weap_zh["effect"]},
        }

    print("Computing artifact half sets...")

    artifact_ids: list[str] = [a["id"] for a in artifacts_en]
    half_sets = process_artifact_effects(artifact_ids, i18n_data["artifacts"])

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

        f.write("export const artifacts: ArtifactSet[] = ")
        f.write(json.dumps(artifact_data, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("export const weapons: Weapon[] = ")
        f.write(json.dumps(weapon_data, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("export const artifactHalfSets: ArtifactHalfSet[] = ")
        f.write(json.dumps(half_sets, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("export const elementResources: ElementResource[] = ")
        f.write(json.dumps(elements, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("export const weaponTypeResources: WeaponTypeResource[] = ")
        f.write(json.dumps(weapon_types, indent=2, ensure_ascii=False))
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
    characters: list[ScrapedCharacter],
    artifacts: list[ScrapedArtifact],
    weapons: list[ScrapedWeapon],
    elements: list[ResourceOutput] | None = None,
    weapon_types: list[ResourceOutput] | None = None,
) -> None:
    """Download all character, artifact, element, and weapon images"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    print("Downloading character images...")
    for char in characters:
        filename = os.path.join(project_root, "public", "character", f"{char['id']}.png")
        download_image(char["image_url"], filename)

    print("Downloading artifact images...")
    for art in artifacts:
        filename = os.path.join(project_root, "public", "artifact", f"{art['id']}.png")
        download_image(art["image_url"], filename)

    print("Downloading weapon images...")
    for weap in weapons:
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
    print("=== Genshin Impact Data Scraper ===")

    # 1. Scrape Fandom
    fandom_data = fandom.get_character_data()

    # 2. Scrape Hoyolab
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a single context for sharing cache/cookies if needed
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
            # EN Data
            characters_en = hoyolab.scrape_characters(page, "en")
            artifacts_en = hoyolab.scrape_artifacts(page, "en")
            weapons_en = hoyolab.scrape_weapons(page, "en")
            elements, weapon_types = hoyolab.scrape_elements_and_weapons(page, "en")

            # ZH Data
            characters_zh = hoyolab.scrape_characters(page, "zh")
            artifacts_zh = hoyolab.scrape_artifacts(page, "zh")
            weapons_zh = hoyolab.scrape_weapons(page, "zh")

            # 3. Process and Save
            save_typescript_data(
                characters_en,
                characters_zh,
                artifacts_en,
                artifacts_zh,
                weapons_en,
                weapons_zh,
                fandom_data,
                elements,
                weapon_types,
            )

            # 4. Download Images
            download_all_images(characters_en, artifacts_en, weapons_en, elements, weapon_types)

        except Exception as e:
            print(f"Error in main orchestration: {e}")
            import traceback

            traceback.print_exc()
        finally:
            browser.close()


if __name__ == "__main__":
    main()
