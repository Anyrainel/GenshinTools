#!/usr/bin/env python3
"""
Final scraper for Genshin Impact wiki data.
Scrapes character and artifact data in both English and Simplified Chinese.
Downloads images and saves data in proper TypeScript format.

NOTE: If you modify this script and it doesn't seem to work properly,
run: python scripts/clean_cache.py
This will clear Python's bytecode cache and force recompilation.
"""

import json
import os
import re
import time
from typing import Any, TypedDict

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from webdriver_manager.chrome import ChromeDriverManager

from preprocess import ARTIFACT_SKIP_LIST, process_scraped_data
from scrape_fandom import CharacterData, get_character_data


class ScrapedCharacter(TypedDict):
    id: str
    name: str
    element: str
    rarity: int
    image_url: str


class ScrapedArtifact(TypedDict):
    id: str
    name: str
    image_url: str
    effects: list[str]


class CharacterOutput(TypedDict):
    id: str
    element: str
    rarity: int
    weapon: str
    region: str
    releaseDate: str
    imageUrl: str
    imagePath: str


class ArtifactOutput(TypedDict):
    id: str
    imageUrl: str
    imagePath: str


class ResourceOutput(TypedDict):
    name: str
    imageUrl: str
    imagePath: str


class I18nCharacterData(TypedDict):
    en: str
    zh: str


class I18nArtifactName(TypedDict):
    en: str
    zh: str


class I18nArtifactEffects(TypedDict):
    en: list[str]
    zh: list[str]


class I18nArtifactEntry(TypedDict):
    name: I18nArtifactName
    effects: I18nArtifactEffects


class MatchedItem(TypedDict):
    en: ScrapedCharacter | ScrapedArtifact
    zh: ScrapedCharacter | ScrapedArtifact


SKIP_EXISTING_IMAGES: bool = True

VALID_ELEMENTS: set[str] = {"Pyro", "Hydro", "Electro", "Cryo", "Anemo", "Geo", "Dendro"}
VALID_WEAPONS: set[str] = {"Sword", "Claymore", "Polearm", "Catalyst", "Bow"}

PLACEHOLDER_PATTERNS: list[str] = [
    "avatar.7663739.png",
    "_nuxt/img/avatar",
    "placeholder",
    "default-avatar",
]


def setup_driver() -> webdriver.Chrome:
    """Setup Chrome driver with proper options for scraping"""
    chrome_options: Options = Options()

    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-background-networking")
    chrome_options.add_argument("--disable-default-apps")
    chrome_options.add_argument("--disable-sync")
    chrome_options.add_argument("--disable-translate")
    chrome_options.add_argument("--log-level=3")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-logging"])  # type: ignore
    chrome_options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    )
    chrome_options.page_load_strategy = "normal"

    service: Service = Service(ChromeDriverManager().install())
    driver: webdriver.Chrome = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def navigate_with_language(driver: webdriver.Chrome, base_url: str, language: str = "en") -> bool:
    """Navigate to a URL with explicit language parameter to avoid cache issues"""
    try:
        clean_url: str = base_url.split("?")[0]
        url_with_lang: str = clean_url + f"?lang={language}"
        print(f"Navigating to: {url_with_lang}")
        driver.get(url_with_lang)
        time.sleep(3)
        return True
    except Exception as e:
        print(f"Could not navigate to {base_url} with language {language}: {e}")
        return False


def extract_element_from_src(src: str) -> str:
    """Extract element type from image src URL"""
    src_lower: str = src.lower()

    for element in VALID_ELEMENTS:
        if element.lower() in src_lower:
            return element

    return "Pyro"


def extract_rarity_from_class(class_str: str) -> int | None:
    """Extract rarity from CSS class"""
    if "d-img-level-5" in class_str:
        return 5
    elif "d-img-level-4" in class_str:
        return 4
    else:
        return None


def download_image(url: str, filepath: str) -> bool:
    """Download an image from URL to filepath"""
    if SKIP_EXISTING_IMAGES and os.path.exists(filepath):
        print(f"Skipping existing image: {os.path.basename(filepath)}")
        return True

    try:
        response: requests.Response = requests.get(url, timeout=30)
        response.raise_for_status()

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(response.content)
        print(f"Downloaded: {os.path.basename(filepath)}")
        return True
    except Exception as e:
        print(f"Failed to download image {url}: {e}")
        return False


def generate_id(name: str) -> str:
    """Generate a consistent ID from character name"""
    return re.sub(r"[^a-z0-9_]", "", name.lower().replace(" ", "_"))


def clean_image_url(url: str) -> str:
    """Clean image URL by removing query parameters and ensuring .png extension"""
    if not url:
        return url

    if "?" in url:
        url = url.split("?")[0]

    return url


def is_placeholder_image(url: str) -> bool:
    """Check if URL is a placeholder image"""
    return any(pattern in url for pattern in PLACEHOLDER_PATTERNS)


def wait_for_images_to_load(driver: webdriver.Chrome, selector: str, max_wait: int = 30) -> bool:
    """Wait for all images to load and replace placeholder URLs"""
    print("Waiting for images to load...")

    start_time: float = time.time()

    while time.time() - start_time < max_wait:
        images: list[WebElement] = driver.find_elements(By.CSS_SELECTOR, selector)

        placeholder_found: bool = False
        placeholder_count: int = 0

        for img in images:
            assert isinstance(img, WebElement)
            src: str | None = img.get_attribute("src")
            if src and is_placeholder_image(src):
                placeholder_found = True
                placeholder_count += 1

        if not placeholder_found:
            print("All images loaded successfully!")
            return True

        print(f"Found {placeholder_count} placeholder images, waiting...")

        driver.execute_script("window.scrollBy(0, 500);")
        time.sleep(2)

        driver.execute_script("window.scrollBy(0, -200);")
        time.sleep(1)

    print(f"Warning: Some images may not have loaded after {max_wait} seconds")
    return False


def scroll_until_all_loaded(driver: webdriver.Chrome, card_selector: str, max_scrolls: int = 20) -> int:
    """Scroll until no new cards are loaded"""
    print("Scrolling to load all cards...")

    previous_count: int = 0
    stable_count: int = 0
    scroll_count: int = 0
    current_count: int = 0

    while scroll_count < max_scrolls:
        current_cards: list[WebElement] = driver.find_elements(By.CSS_SELECTOR, card_selector)
        current_count: int = len(current_cards)

        print(f"Scroll {scroll_count + 1}: Found {current_count} cards")

        if current_count > previous_count:
            previous_count = current_count
            stable_count = 0
        elif current_count == previous_count:
            stable_count += 1
            if stable_count >= 1:
                print(f"Card count stable at {current_count} for 1 scroll, stopping...")
                break

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        scroll_count += 1

    if scroll_count >= max_scrolls:
        print(f"Reached maximum scroll limit ({max_scrolls}), proceeding with {current_count} cards")

    print("Scrolling back to top to ensure all content is loaded...")
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(2)

    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(2)

    final_cards: list[WebElement] = driver.find_elements(By.CSS_SELECTOR, card_selector)
    final_count: int = len(final_cards)
    print(f"Final card count: {final_count}")

    return final_count


def extract_character_from_card(card: WebElement, index: int) -> ScrapedCharacter | None:
    """Extract character data from a character card element"""
    try:
        name_element: WebElement = card.find_element(By.CSS_SELECTOR, "div.character-card-name span")
        assert isinstance(name_element, WebElement)
        name: str = name_element.text.strip()
    except Exception:
        print(f"Skipping character {index + 1}: name not found")
        return None

    try:
        element_img: WebElement = card.find_element(By.CSS_SELECTOR, "img.character-card-element")
        assert isinstance(element_img, WebElement)
        element_src: str | None = element_img.get_attribute("src")
        assert element_src is not None
        element: str = extract_element_from_src(element_src)
    except Exception:
        print(f"Skipping {name}: element not found")
        return None

    try:
        icon_div: WebElement = card.find_element(By.CSS_SELECTOR, "div.character-card-icon")
        assert isinstance(icon_div, WebElement)
        rarity_classes: str | None = icon_div.get_attribute("class")
        assert rarity_classes is not None
        rarity: int | None = extract_rarity_from_class(rarity_classes)
        if rarity is None:
            print(f"Skipping {name}: rarity not found")
            return None
    except Exception:
        print(f"Skipping {name}: rarity not found")
        return None

    try:
        char_img: WebElement = card.find_element(By.CSS_SELECTOR, "img.d-img-show")
        assert isinstance(char_img, WebElement)
        time.sleep(0.1)
        original_image_url: str | None = char_img.get_attribute("src")
        assert original_image_url is not None

        if is_placeholder_image(original_image_url):
            print(f"ERROR: {name} has placeholder image: {original_image_url}")
            return None

        cleaned_image_url: str = clean_image_url(original_image_url)
    except Exception as e:
        print(f"ERROR: {name} - image element not found: {e}")
        return None

    character_id: str = generate_id(name)

    character_data: ScrapedCharacter = {
        "id": character_id,
        "name": name,
        "element": element,
        "rarity": rarity,
        "image_url": cleaned_image_url,
    }

    return character_data


def scrape_characters(driver: webdriver.Chrome, language: str = "en") -> list[ScrapedCharacter]:
    """Scrape character data from the wiki"""
    print(f"Scraping characters in {language}...")

    character_url: str = "https://wiki.hoyolab.com/pc/genshin/aggregate/2"

    if not navigate_with_language(driver, character_url, language):
        return []

    time.sleep(2)

    scroll_until_all_loaded(driver, "article.character-card")
    wait_for_images_to_load(driver, "article.character-card img.d-img-show")

    character_cards: list[WebElement] = driver.find_elements(By.CSS_SELECTOR, "article.character-card")
    print(f"Found {len(character_cards)} character cards")

    characters: list[ScrapedCharacter] = []
    for i, card in enumerate(character_cards):
        assert isinstance(card, WebElement)
        try:
            character_data: ScrapedCharacter | None = extract_character_from_card(card, i)

            if character_data:
                characters.append(character_data)
                print(
                    f"Character {i + 1}: {character_data['name']} "
                    f"({character_data['element']}, {character_data['rarity']}*)"
                )

        except Exception as e:
            print(f"Error processing character {i + 1}: {e}")
            continue

    return characters


def extract_artifact_from_card(card: WebElement, index: int) -> ScrapedArtifact | None:
    """Extract artifact data from an artifact card element"""
    try:
        name_element: WebElement = card.find_element(By.CSS_SELECTOR, "div.artifact-card-name")
        assert isinstance(name_element, WebElement)
        name: str = name_element.text.strip()
    except Exception:
        print(f"Skipping artifact {index + 1}: name not found")
        return None

    try:
        artifact_img: WebElement = card.find_element(By.CSS_SELECTOR, "div.artifact-card-main img.d-img-show")
        assert isinstance(artifact_img, WebElement)
        time.sleep(0.1)
        original_image_url: str | None = artifact_img.get_attribute("src")
        assert original_image_url is not None

        if is_placeholder_image(original_image_url):
            print(f"ERROR: {name} has placeholder image: {original_image_url}")
            return None

        cleaned_image_url: str = clean_image_url(original_image_url)
    except Exception as e:
        print(f"ERROR: {name} - image element not found: {e}")
        return None

    try:
        desc_items: list[WebElement] = card.find_elements(By.CSS_SELECTOR, "div.artifact-card-desc-item")

        if len(desc_items) < 2:
            print(f"Skipping artifact {index + 1} ({name}): Only {len(desc_items)} effects found")
            return None

        effects: list[str] = []
        for desc_item in desc_items[:2]:
            assert isinstance(desc_item, WebElement)
            detail_element: WebElement = desc_item.find_element(
                By.CSS_SELECTOR, "div.artifact-card-desc-detail"
            )
            assert isinstance(detail_element, WebElement)
            effect_text: str = detail_element.text.strip()
            effects.append(effect_text)

        artifact_id: str = generate_id(name)

        if artifact_id in ARTIFACT_SKIP_LIST:
            print(f"Skipping artifact {index + 1} ({name}): in ARTIFACT_SKIP_LIST")
            return None

        artifact_data: ScrapedArtifact = {
            "id": artifact_id,
            "name": name,
            "image_url": cleaned_image_url,
            "effects": effects,
        }

        return artifact_data
    except Exception:
        print(f"Skipping {name}: effects not found")
        return None


def scrape_artifacts(driver: webdriver.Chrome, language: str = "en") -> list[ScrapedArtifact]:
    """Scrape artifact data from the wiki"""
    print(f"Scraping artifacts in {language}...")

    artifact_url: str = "https://wiki.hoyolab.com/pc/genshin/aggregate/5"

    if not navigate_with_language(driver, artifact_url, language):
        return []

    time.sleep(2)

    scroll_until_all_loaded(driver, "div.artifact-card")
    wait_for_images_to_load(driver, "div.artifact-card img.d-img-show")

    artifact_cards: list[WebElement] = driver.find_elements(By.CSS_SELECTOR, "div.artifact-card")
    print(f"Found {len(artifact_cards)} artifact cards")

    artifacts: list[ScrapedArtifact] = []
    for i, card in enumerate(artifact_cards):
        assert isinstance(card, WebElement)
        try:
            artifact_data: ScrapedArtifact | None = extract_artifact_from_card(card, i)

            if artifact_data:
                artifacts.append(artifact_data)
                print(f"Artifact {i + 1}: {artifact_data['name']}")

        except Exception as e:
            print(f"Error processing artifact {i + 1}: {e}")
            continue

    return artifacts


def match_items_by_image_url(
    items_en: list[ScrapedCharacter] | list[ScrapedArtifact],
    items_zh: list[ScrapedCharacter] | list[ScrapedArtifact],
    item_type: str = "character",
) -> list[MatchedItem]:
    """Match items across languages using image URLs and validate consistency"""
    matched_items: list[MatchedItem] = []

    for i, item_en in enumerate(items_en):
        matched_zh: ScrapedCharacter | ScrapedArtifact | None = None
        for _, item_zh in enumerate(items_zh):
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
                char_en: ScrapedCharacter = item_en  # type: ignore
                char_zh: ScrapedCharacter = matched_zh  # type: ignore
                if char_en["element"] != char_zh["element"] or char_en["rarity"] != char_zh["rarity"]:
                    print(
                        f"ERROR: {item_type} {item_en['name']} - element/rarity mismatch between languages"
                    )
                    print(f"  EN: {char_en['element']} {char_en['rarity']}*")
                    print(f"  ZH: {char_zh['element']} {char_zh['rarity']}*")
                    continue

            matched_items.append({"en": item_en, "zh": matched_zh})
        else:
            print(f"WARNING: No Chinese match found for {item_type} {item_en['name']}")

    return matched_items


def enrich_character_data_with_fandom(
    characters_en: list[ScrapedCharacter], fandom_data: dict[tuple[str, int, str], CharacterData]
) -> list[ScrapedCharacter]:
    """Enrich character data with weapon, region, and release date from Fandom data"""
    enriched_characters: list[ScrapedCharacter] = []

    for char in characters_en:
        key: tuple[str, int, str] = (char["element"], char["rarity"], char["name"])
        fandom_char: CharacterData | None = fandom_data.get(key)

        enriched_char: ScrapedCharacter = char.copy()

        if fandom_char:
            enriched_char["weapon"] = fandom_char["weapon"]  # type: ignore
            enriched_char["region"] = fandom_char["region"]  # type: ignore
            enriched_char["releaseDate"] = fandom_char["releaseDate"]  # type: ignore
            enriched_characters.append(enriched_char)
            print(
                f"Enriched {char['name']}: {fandom_char['weapon']}, "
                f"{fandom_char['region']}, {fandom_char['releaseDate']}"
            )
        else:
            enriched_char["weapon"] = "Sword"  # type: ignore
            enriched_char["region"] = "None"  # type: ignore
            enriched_char["releaseDate"] = "2020-09-28"  # type: ignore
            enriched_characters.append(enriched_char)
            print(
                f"Using defaults for {char['name']}: {enriched_char['weapon']}, "  # type: ignore
                f"{enriched_char['region']}, {enriched_char['releaseDate']}"  # type: ignore
            )

    return enriched_characters


def save_typescript_data(
    characters_en: list[ScrapedCharacter],
    characters_zh: list[ScrapedCharacter],
    artifacts_en: list[ScrapedArtifact],
    artifacts_zh: list[ScrapedArtifact],
    fandom_data: dict[tuple[str, int, str], CharacterData],
    elements: list[ResourceOutput],
    weapons: list[ResourceOutput],
) -> None:
    """Save scraped data in TypeScript format"""
    script_dir: str = os.path.dirname(os.path.abspath(__file__))
    project_root: str = os.path.abspath(os.path.join(script_dir, ".."))

    enriched_characters_en: list[ScrapedCharacter] = enrich_character_data_with_fandom(
        characters_en, fandom_data
    )

    matched_characters: list[MatchedItem] = match_items_by_image_url(
        enriched_characters_en, characters_zh, "character"
    )

    character_data: list[CharacterOutput] = []
    for match in matched_characters:
        char_en: ScrapedCharacter = match["en"]  # type: ignore
        char_zh: ScrapedCharacter = match["zh"]  # type: ignore

        character_data.append(
            {
                "id": char_en["id"],
                "element": char_en["element"],
                "rarity": char_en["rarity"],
                "weapon": char_en["weapon"],  # type: ignore
                "region": char_en["region"],  # type: ignore
                "releaseDate": char_en["releaseDate"],  # type: ignore
                "imageUrl": char_en["image_url"],
                "imagePath": f"/character/{char_en['id']}.png",
            }
        )

    matched_artifacts: list[MatchedItem] = match_items_by_image_url(artifacts_en, artifacts_zh, "artifact")

    artifact_data: list[ArtifactOutput] = []
    for match in matched_artifacts:
        art_en: ScrapedArtifact = match["en"]  # type: ignore
        art_zh: ScrapedArtifact = match["zh"]  # type: ignore

        artifact_data.append(
            {
                "id": art_en["id"],
                "imageUrl": art_en["image_url"],
                "imagePath": f"/artifact/{art_en['id']}.png",
            }
        )

    i18n_data: dict[str, dict[str, Any]] = {"characters": {}, "artifacts": {}}

    for match in matched_characters:
        char_en: ScrapedCharacter = match["en"]  # type: ignore
        char_zh: ScrapedCharacter = match["zh"]  # type: ignore

        i18n_data["characters"][char_en["id"]] = {
            "en": char_en["name"],
            "zh": char_zh["name"],
        }

    for match in matched_artifacts:
        art_en: ScrapedArtifact = match["en"]  # type: ignore
        art_zh: ScrapedArtifact = match["zh"]  # type: ignore

        i18n_data["artifacts"][art_en["id"]] = {
            "name": {"en": art_en["name"], "zh": art_zh["name"]},
            "effects": {"en": art_en["effects"], "zh": art_zh["effects"]},
        }

    print("Computing artifact half sets...")
    half_sets: list[dict[str, Any]] = process_scraped_data(character_data, artifact_data, i18n_data)  # type: ignore

    resources_path: str = os.path.join(project_root, "src", "data", "resources.ts")
    with open(resources_path, "w", encoding="utf-8") as f:
        f.write(
            "import { Character, ArtifactSet, ElementResource, WeaponResource, ArtifactHalfSet } from './types';\n\n"
        )

        f.write("// Characters data\n")
        f.write("export const characters: Character[] = ")
        f.write(json.dumps(character_data, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("// Artifacts data\n")
        f.write("export const artifacts: ArtifactSet[] = ")
        f.write(json.dumps(artifact_data, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("// Artifact half sets data\n")
        f.write("export const artifactHalfSets: ArtifactHalfSet[] = ")
        f.write(json.dumps(half_sets, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("// Elements data\n")
        f.write("export const elements: ElementResource[] = ")
        f.write(json.dumps(elements, indent=2, ensure_ascii=False))
        f.write(";\n\n")

        f.write("// Weapons data\n")
        f.write("export const weapons: WeaponResource[] = ")
        f.write(json.dumps(weapons, indent=2, ensure_ascii=False))
        f.write(";\n")

    i18n_path: str = os.path.join(project_root, "src", "data", "i18n-game.ts")
    with open(i18n_path, "w", encoding="utf-8") as f:
        f.write("export const i18nGameData = ")
        f.write(json.dumps(i18n_data, indent=2, ensure_ascii=False))
        f.write(";\n")


def scrape_elements_and_weapons(driver: webdriver.Chrome, language: str = "en") -> tuple[list[ResourceOutput], list[ResourceOutput]]:
    """Scrape element and weapon images from the character page filters"""
    print(f"Scraping elements and weapons in {language}...")

    character_url: str = "https://wiki.hoyolab.com/pc/genshin/aggregate/2"

    if not navigate_with_language(driver, character_url, language):
        return [], []

    time.sleep(2)

    elements: list[ResourceOutput] = []
    weapons: list[ResourceOutput] = []

    try:
        print("Looking for element images...")
        element_imgs: list[WebElement] = driver.find_elements(By.CSS_SELECTOR, "div.tw-flex.tw-gap-3 img")
        print(f"Found {len(element_imgs)} potential element/weapon images")

        for img in element_imgs:
            assert isinstance(img, WebElement)
            try:
                alt_text: str | None = img.get_attribute("alt")
                src_url: str | None = img.get_attribute("src")

                if alt_text and src_url:
                    if alt_text in VALID_ELEMENTS:
                        element_name: str = alt_text
                        cleaned_url: str = clean_image_url(src_url)

                        elements.append(
                            {
                                "name": element_name,
                                "imageUrl": cleaned_url,
                                "imagePath": f"/element/{element_name.lower()}.png",
                            }
                        )
                        print(f"Found element: {element_name}")

                    elif alt_text in VALID_WEAPONS:
                        weapon_name: str = alt_text
                        cleaned_url: str = clean_image_url(src_url)

                        weapons.append(
                            {
                                "name": weapon_name,
                                "imageUrl": cleaned_url,
                                "imagePath": f"/weapon/{weapon_name.lower()}.png",
                            }
                        )
                        print(f"Found weapon: {weapon_name}")

            except Exception as e:
                print(f"Error processing image: {e}")
                continue

        print(f"Found {len(elements)} elements and {len(weapons)} weapons")

    except Exception as e:
        print(f"Error scraping elements and weapons: {e}")

    return elements, weapons


def download_all_images(
    characters: list[ScrapedCharacter],
    artifacts: list[ScrapedArtifact],
    elements: list[ResourceOutput] | None = None,
    weapons: list[ResourceOutput] | None = None,
) -> None:
    """Download all character, artifact, element, and weapon images"""
    script_dir: str = os.path.dirname(os.path.abspath(__file__))
    project_root: str = os.path.abspath(os.path.join(script_dir, ".."))

    print("Downloading character images...")
    for char in characters:
        filename: str = os.path.join(project_root, "public", "character", f"{char['id']}.png")
        download_image(char["image_url"], filename)

    print("Downloading artifact images...")
    for art in artifacts:
        filename: str = os.path.join(project_root, "public", "artifact", f"{art['id']}.png")
        download_image(art["image_url"], filename)

    if elements:
        print("Downloading element images...")
        for element in elements:
            filename: str = os.path.join(
                project_root, "public", "element", f"{element['name'].lower()}.png"
            )
            download_image(element["imageUrl"], filename)

    if weapons:
        print("Downloading weapon images...")
        for weapon in weapons:
            filename: str = os.path.join(
                project_root, "public", "weapon", f"{weapon['name'].lower()}.png"
            )
            download_image(weapon["imageUrl"], filename)


def main() -> None:
    """Main function to orchestrate the scraping process"""
    print("=== Genshin Impact Wiki Scraper ===")
    print(f"Skip existing images: {SKIP_EXISTING_IMAGES}")
    print("=" * 40)

    print("\nFetching character data from Fandom wiki...")
    fandom_data: dict[tuple[str, int, str], CharacterData] = get_character_data()
    print(f"Found {len(fandom_data)} characters in Fandom data")

    driver: webdriver.Chrome = setup_driver()

    try:
        characters_en: list[ScrapedCharacter] = scrape_characters(driver, "en")
        artifacts_en: list[ScrapedArtifact] = scrape_artifacts(driver, "en")

        characters_zh: list[ScrapedCharacter] = scrape_characters(driver, "zh")
        artifacts_zh: list[ScrapedArtifact] = scrape_artifacts(driver, "zh")

        print("\n=== Scraping Elements and Weapons ===")
        elements: list[ResourceOutput]
        weapons: list[ResourceOutput]
        elements, weapons = scrape_elements_and_weapons(driver, "en")
        print(f"Elements scraped: {len(elements)}")
        print(f"Weapons scraped: {len(weapons)}")

        save_typescript_data(
            characters_en, characters_zh, artifacts_en, artifacts_zh, fandom_data, elements, weapons
        )

        download_all_images(characters_en, artifacts_en, elements, weapons)

        print("Scraping completed successfully!")

    except Exception as e:
        print(f"Error during scraping: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
