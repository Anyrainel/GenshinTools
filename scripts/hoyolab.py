import os
import re
import time
from typing import Self

import requests
from playwright.sync_api import Browser, BrowserContext, Locator, Page, sync_playwright
from tqdm import tqdm

from models import (
    ArtifactSource,
    CharacterSource,
    ResourceOutput,
    WeaponSource,
)

SKIP_EXISTING_IMAGES = True
VALID_ELEMENTS: set[str] = {
    "Pyro",
    "Hydro",
    "Electro",
    "Cryo",
    "Anemo",
    "Geo",
    "Dendro",
}
VALID_WEAPONS: set[str] = {"Sword", "Claymore", "Polearm", "Catalyst", "Bow"}
WEAPON_TYPE_MAP = {
    "Sword": "Sword",
    "Claymore": "Claymore",
    "Polearm": "Polearm",
    "Catalyst": "Catalyst",
    "Bow": "Bow",
    "单手剑": "Sword",
    "双手剑": "Claymore",
    "长柄武器": "Polearm",
    "法器": "Catalyst",
    "弓": "Bow",
}
STAT_MAP = {
    "CRIT DMG": "cd",
    "CRIT Rate": "cr",
    "Elemental Mastery": "em",
    "Energy Recharge": "er",
    "ATK Percentage": "atk%",
    "HP Percentage": "hp%",
    "DEF Percentage": "def%",
    "Physical DMG Bonus": "phys%",
    "暴击伤害": "cd",
    "暴击率": "cr",
    "元素精通": "em",
    "元素充能效率": "er",
    "攻击力": "atk%",
    "生命值": "hp%",
    "防御力": "def%",
    "物理伤害加成": "phys%",
}
ARTIFACT_SUFFIX: dict[str, str] = {
    "flower": "",
    "plume": "2",
    "sands": "3",
    "goblet": "4",
    "circlet": "5",
}

IGNORE_KEYS = {
    "Name",
    "Region",
    "Source",
    "Type",
    "Secondary Attributes",
    "Version Released",
    "名称",
    "来源",
    "类型",
    "副属性",
    "版本发布",
}
PLACEHOLDER_PATTERNS: list[str] = [
    "avatar.7663739.png",
    "_nuxt/img/avatar",
    "placeholder",
    "default-avatar",
]
CHARACTER_BLOCKLIST: set[str] = {"Manekina", "Manekin", "Traveler", "旅行者"}


def generate_id(name: str) -> str:
    """Generate a consistent ID from character name"""
    return re.sub(r"[^a-z0-9_]", "", name.lower().replace(" ", "_"))


def download_image(url: str, filepath: str, skip_existing: bool = SKIP_EXISTING_IMAGES) -> bool:
    """Download an image from URL to filepath"""
    if skip_existing and os.path.exists(filepath):
        return True

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(response.content)
        return True
    except Exception as e:
        tqdm.write(f"Failed to download image {url}: {e}")
        return False


class HoyolabAssetManager:
    """Helper class to manage asset downloading logic"""

    @staticmethod
    def download_character_assets(character: CharacterSource, project_root: str) -> bool:
        """Download character image"""
        id = generate_id(character.name)
        filename = os.path.join(project_root, "public", "character", f"{id}.png")
        return download_image(character.image_url, filename)

    @staticmethod
    def download_artifact_assets(artifact: ArtifactSource, project_root: str) -> None:
        """Download all artifact slot images"""
        id = generate_id(artifact.name)
        for slot, suffix in ARTIFACT_SUFFIX.items():
            url = artifact.image_urls.get(slot)
            if url:
                filename = os.path.join(project_root, "public", "artifact", f"{id}{suffix}.png")
                download_image(url, filename)

    @staticmethod
    def download_weapon_assets(weapon: WeaponSource, project_root: str) -> bool:
        """Download weapon image"""
        id = generate_id(weapon.name)
        filename = os.path.join(project_root, "public", "weapon", f"{id}.png")
        return download_image(weapon.image_url, filename)

    @staticmethod
    def download_element_asset(element: ResourceOutput, project_root: str) -> bool:
        """Download element image"""
        id = generate_id(element.name)
        filename = os.path.join(project_root, "public", "element", f"{id}.png")
        return download_image(element.imageUrl, filename)

    @staticmethod
    def download_weapon_type_asset(weapon_type: ResourceOutput, project_root: str) -> bool:
        """Download weapon type image"""
        id = generate_id(weapon_type.name)
        filename = os.path.join(project_root, "public", "weapontype", f"{id}.png")
        return download_image(weapon_type.imageUrl, filename)


def extract_id_from_url(url: str) -> str:
    """Extract entry ID from Hoyolab URL"""
    match = re.search(r"entry/(\d+)", url)
    if match:
        return match.group(1)
    return ""


def clean_image_url(url: str) -> str:
    """Clean image URL by removing query parameters and handling relative paths"""
    if not url:
        return url

    # Handle relative URLs (e.g., /_ipx/...)
    if url.startswith("/"):
        url = f"https://wiki.hoyolab.com{url}"

    if "?" in url:
        return url.split("?")[0]
    return url


def is_placeholder_image(url: str) -> bool:
    return any(pattern in url for pattern in PLACEHOLDER_PATTERNS)


def extract_element_from_src(src: str) -> str | None:
    src_lower = src.lower()
    for element in VALID_ELEMENTS:
        if element.lower() in src_lower:
            return element
    return None


def extract_rarity_from_class(class_str: str) -> int | None:
    if "d-img-level-5" in class_str:
        return 5
    elif "d-img-level-4" in class_str:
        return 4
    elif "d-img-level-3" in class_str:
        return 3
    elif "d-img-level-2" in class_str:
        return 2
    elif "d-img-level-1" in class_str:
        return 1
    elif "d-img-level-0" in class_str:
        return 0
    return None


def extract_rarity_from_star_class(class_str: str) -> int | None:
    if "drop-icon-with-star-5" in class_str:
        return 5
    elif "drop-icon-with-star-4" in class_str:
        return 4
    elif "drop-icon-with-star-3" in class_str:
        return 3
    elif "drop-icon-with-star-2" in class_str:
        return 2
    elif "drop-icon-with-star-1" in class_str:
        return 1
    return None


class HoyolabScraper:
    def __init__(self, headless: bool = True):
        self._headless = headless
        self._playwright = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self.page: Page | None = None

    def __enter__(self) -> Self:
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=self._headless)
        self._context = self._browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
        )
        self.page = self._context.new_page()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._context:
            self._context.close()
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()

    def _ensure_page(self) -> Page:
        if not self.page:
            raise RuntimeError("Scraper not initialized. Use 'with HoyolabScraper() as scraper:'")
        return self.page

    def _navigate_with_language(self, base_url: str, language: str = "en") -> bool:
        page = self._ensure_page()
        try:
            clean_url = base_url.split("?")[0]
            url_with_lang = f"{clean_url}?lang={language}"
            # print(f"Navigating to: {url_with_lang}")
            page.goto(url_with_lang)
            time.sleep(3)  # Wait for initial load
            return True
        except Exception as e:
            tqdm.write(f"Could not navigate to {base_url} with language {language}: {e}")
            return False

    def _scroll_until_all_loaded(self, card_selector: str, max_scrolls: int = 20) -> int:
        page = self._ensure_page()

        previous_count = 0
        stable_count = 0
        scroll_count = 0

        with tqdm(
            desc="Scrolling",
            unit="cards",
            leave=False,
            bar_format="{l_bar}{bar}| {n_fmt} [{elapsed}]",
        ) as pbar:
            while scroll_count < max_scrolls:
                current_count = page.locator(card_selector).count()
                pbar.n = current_count
                pbar.refresh()
                # print(f"Scroll {scroll_count + 1}: Found {current_count} cards")

                if current_count > previous_count:
                    previous_count = current_count
                    stable_count = 0
                elif current_count == previous_count:
                    stable_count += 1
                    if stable_count >= 2:  # Wait for 2 stable counts to be sure
                        # print(f"Card count stable at {current_count}, stopping...")
                        break

                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(2)
                scroll_count += 1

        time.sleep(2)  # Wait for final images/cards to settle
        final_count = page.locator(card_selector).count()
        # print(f"Final card count: {final_count}")
        return final_count

    def _wait_for_images_to_load(self, selector: str, max_wait: int = 30) -> bool:
        page = self._ensure_page()
        # print("Waiting for images to load...")
        start_time = time.time()

        with tqdm(
            total=max_wait,
            desc="Loading Images",
            unit="s",
            leave=False,
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]",
        ) as pbar:
            while time.time() - start_time < max_wait:
                images = page.locator(selector).all()
                placeholder_found = False
                placeholder_count = 0

                for img in images:
                    src = img.get_attribute("src")
                    if src and is_placeholder_image(src):
                        placeholder_found = True
                        placeholder_count += 1
                        # Scroll element into view to trigger load
                        img.scroll_into_view_if_needed()

                if not placeholder_found:
                    # print("All images loaded successfully!")
                    return True

                pbar.set_description(f"Loading Images (Approx {placeholder_count} pending)")
                pbar.update(2)  # Approximate update

                page.evaluate("window.scrollBy(0, 500)")
                time.sleep(1)
                page.evaluate("window.scrollBy(0, -200)")
                time.sleep(1)

        tqdm.write(f"Warning: Some images may not have loaded after {max_wait} seconds")
        return False

    def _extract_character_from_card(self, card: Locator, index: int) -> CharacterSource | None:
        try:
            name_el = card.locator("div.character-card-name span").first
            if not name_el.count():
                tqdm.write(f"SKIP (Char {index}): No name element found")
                return None
            name_text = name_el.text_content()
            if not name_text:
                tqdm.write(f"SKIP (Char {index}): Name text is empty")
                return None
            name = name_text.strip()
            if name in CHARACTER_BLOCKLIST:
                return None
        except Exception as e:
            tqdm.write(f"SKIP (Char {index}): Exception extracting name: {e}")
            return None

        try:
            element_img = card.locator("img.character-card-element").first
            element_src = element_img.get_attribute("src")
            if not element_src:
                tqdm.write(f"SKIP ({name}): No element image src")
                return None
            element = extract_element_from_src(element_src)
            if element is None:
                tqdm.write(f"SKIP ({name}): Could not find element from src: {element_src}")
                return None
        except Exception as e:
            tqdm.write(f"SKIP ({name}): Exception extracting element: {e}")
            return None

        try:
            icon_div = card.locator("div.character-card-icon").first
            rarity_classes = icon_div.get_attribute("class")
            if not rarity_classes:
                tqdm.write(f"SKIP ({name}): No rarity classes found")
                return None
            rarity = extract_rarity_from_class(rarity_classes)
            if rarity is None:
                tqdm.write(f"SKIP ({name}): Could not find rarity from classes: {rarity_classes}")
                return None
        except Exception as e:
            tqdm.write(f"SKIP ({name}): Exception extracting rarity: {e}")
            return None

        try:
            char_img = card.locator("img.d-img-show").first
            original_image_url = char_img.get_attribute("src")
            if not original_image_url or is_placeholder_image(original_image_url):
                tqdm.write(
                    f"SKIP ({name}): Placeholder image found: "
                    f"{original_image_url if original_image_url else 'None'}"
                )
                return None
            cleaned_image_url = clean_image_url(original_image_url)
        except Exception as e:
            tqdm.write(f"SKIP ({name}): Exception extracting image: {e}")
            return None

        return CharacterSource(
            entry_id="",
            name=name,
            element=element,
            rarity=rarity,
            image_url=cleaned_image_url,
        )

    def scrape_characters(self, language: str = "en") -> list[CharacterSource]:
        page = self._ensure_page()
        print(f"--- Character ({language.upper()}) ---")  # Keep distinct header
        character_url = "https://wiki.hoyolab.com/pc/genshin/aggregate/2"

        if not self._navigate_with_language(character_url, language):
            return []

        self._scroll_until_all_loaded("article.character-card")
        self._wait_for_images_to_load("article.character-card img.d-img-show")

        character_cards = page.locator("article.character-card").all()
        # print(f"Found {len(character_cards)} character cards")

        characters: list[CharacterSource] = []
        for i, card in tqdm(
            enumerate(character_cards),
            total=len(character_cards),
            desc=f"Extracting {language.upper()}",
            unit="item",
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]",
        ):
            char_data = self._extract_character_from_card(card, i)
            if char_data:
                try:
                    with page.context.expect_page() as new_page_info:
                        card.click()
                    new_page = new_page_info.value
                    char_data.entry_id = extract_id_from_url(new_page.url)
                    new_page.close()
                except Exception as e:
                    tqdm.write(f"Error getting ID for {char_data.name}: {e}")

                characters.append(char_data)
                # Removed detailed print

        return characters

    def _extract_artifact_from_card(self, card: Locator, index: int) -> ArtifactSource | None:
        name: str = ""
        try:
            name_el = card.locator("div.artifact-card-name").first
            name_text = name_el.text_content()
            if not name_text:
                tqdm.write(f"SKIP (Art {index}): Name text is empty")
                return None
            name = name_text.strip()
        except Exception as e:
            tqdm.write(f"SKIP (Art {index}): Exception extracting name: {e}")
            return None

        try:
            image_urls: dict[str, str] = {}

            # Try to get suit images first
            suit_div = card.locator("div.artifact-card-suit").first
            if suit_div.count():
                suit_items = suit_div.locator("div.artifact-card-suit-item").all()
                if len(suit_items) >= 5:
                    # Order: circlet, flower, goblet, plume, sands
                    slots = ["circlet", "flower", "goblet", "plume", "sands"]
                    for i, item in enumerate(suit_items[:5]):
                        img = item.locator("img.d-img-show").first
                        src = img.get_attribute("src")
                        if src:
                            image_urls[slots[i]] = clean_image_url(src)

            # Fallback/Primary check for flower (main image)
            if "flower" not in image_urls:
                artifact_img = card.locator("div.artifact-card-main img.d-img-show").first
                original_image_url = artifact_img.get_attribute("src")
                if original_image_url and not is_placeholder_image(original_image_url):
                    image_urls["flower"] = clean_image_url(original_image_url)

            if "flower" not in image_urls:
                tqdm.write(f"SKIP ({name}): No flower image found")
                return None

        except Exception as e:
            tqdm.write(f"SKIP ({name}): Exception extracting images: {e}")
            return None

        try:
            desc_items = card.locator("div.artifact-card-desc-item").all()
            if len(desc_items) < 2:
                tqdm.write(f"SKIP ({name}): Less than 2 desc items found")
                return None

            effects: list[str] = []
            for item in desc_items[:2]:
                detail_el = item.locator("div.artifact-card-desc-detail").first
                effect_text = detail_el.text_content()
                if effect_text:
                    effects.append(effect_text.strip())
                else:
                    effects.append("")

            return ArtifactSource(
                entry_id="",
                name=name,
                image_urls=image_urls,
                effects=effects,
            )
        except Exception as e:
            tqdm.write(f"SKIP ({name}): Exception extracting details: {e}")
            return None

    def scrape_artifacts(self, language: str = "en") -> list[ArtifactSource]:
        page = self._ensure_page()
        print(f"--- Artifact ({language.upper()}) ---")
        artifact_url = "https://wiki.hoyolab.com/pc/genshin/aggregate/5"

        if not self._navigate_with_language(artifact_url, language):
            return []

        self._scroll_until_all_loaded("div.artifact-card")
        self._wait_for_images_to_load("div.artifact-card img.d-img-show")

        artifact_cards = page.locator("div.artifact-card").all()
        # print(f"Found {len(artifact_cards)} artifact cards")

        artifacts: list[ArtifactSource] = []
        for i, card in tqdm(
            enumerate(artifact_cards),
            total=len(artifact_cards),
            desc=f"Extracting {language.upper()}",
            unit="item",
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]",
        ):
            art_data = self._extract_artifact_from_card(card, i)
            if art_data:
                try:
                    with page.context.expect_page() as new_page_info:
                        card.click()
                    new_page = new_page_info.value
                    art_data.entry_id = extract_id_from_url(new_page.url)
                    new_page.close()
                except Exception as e:
                    tqdm.write(f"Error getting ID for {art_data.name}: {e}")

                artifacts.append(art_data)
                # Removed detailed print

        return artifacts

    def _extract_weapon_from_card(self, card: Locator, index: int) -> WeaponSource | None:
        name: str = ""
        try:
            name_el = card.locator("div.weapon-card-name span").first
            name_text = name_el.text_content()
            if not name_text:
                tqdm.write(f"SKIP (Wep {index}): Name text is empty")
                return None
            name = name_text.strip()
        except Exception as e:
            tqdm.write(f"SKIP (Wep {index}): Exception extracting name: {e}")
            return None

        try:
            # Rarity check
            icon_div = card.locator("div.weapon-card-icon .drop-icon-with-star").first
            icon_classes = icon_div.get_attribute("class")

            rarity = None
            if icon_classes:
                rarity = extract_rarity_from_star_class(icon_classes)

            if rarity is None:  # Fallback
                img_div = card.locator("div.d-img").first
                img_classes = img_div.get_attribute("class") or ""
                rarity = extract_rarity_from_class(img_classes) or 0

            if rarity is None or rarity in (1, 2):
                return None

        except Exception as e:
            tqdm.write(f"SKIP ({name}): Exception extracting rarity: {e}")
            return None

        try:
            weapon_img = card.locator("img.d-img-show").first
            original_image_url = weapon_img.get_attribute("src")
            if not original_image_url or is_placeholder_image(original_image_url):
                tqdm.write(f"SKIP ({name}): Placeholder image found")
                return None
            cleaned_image_url = clean_image_url(original_image_url)
        except Exception as e:
            tqdm.write(f"SKIP ({name}): Exception extracting image: {e}")
            return None

        return WeaponSource(
            entry_id="",
            name=name,
            rarity=rarity,
            image_url=cleaned_image_url,
            type="",
            secondary_stat="",
            effect="",
            base_atk=0,
            secondary_stat_value="",
        )

    def _scrape_weapon_detail_page(self, detail_page: Page) -> dict[str, str | int]:
        try:
            detail_page.wait_for_selector("div.base-info-content", timeout=5000)
        except Exception as e:
            print(f"Warning: Could not find base-info-content on weapon detail page: {str(e)}")
            return {}

        items = detail_page.locator("div.base-info-item").all()
        data: dict[str, str | int] = {
            "type": "",
            "secondary_stat": "",
            "effect": "",
            "base_atk": 0,
            "secondary_stat_value": "",
        }

        for item in items:
            try:
                key_el = item.locator("div.base-info-item-key").first
                val_el = item.locator("div.base-info-item-value").first

                if not key_el.count() or not val_el.count():
                    continue

                key = (key_el.text_content() or "").strip()
                value = (val_el.text_content() or "").strip()

                if key in ["Type", "类型"]:
                    data["type"] = WEAPON_TYPE_MAP.get(value, "Sword")
                elif key in ["Secondary Attributes", "副属性"]:
                    data["secondary_stat"] = STAT_MAP.get(value, value)
                elif key not in IGNORE_KEYS and not data["effect"]:
                    data["effect"] = value

            except Exception:
                continue

        try:
            ascension_info = detail_page.locator(
                "article.hoyowiki-slider.pc.d-ascension-info.noMap"
            ).first
            if ascension_info.count():
                items_list = ascension_info.locator("div.d-ascension-item").all()
                if items_list:
                    last_item = items_list[-1]
                    rows = last_item.locator("table tbody tr").all()
                    if len(rows) >= 2:
                        val_row = rows[1]
                        cols = val_row.locator("td").all()
                        if len(cols) >= 3:
                            atk_text = cols[0].text_content()
                            sec_text = cols[2].text_content()

                            if atk_text:
                                try:
                                    data["base_atk"] = int(atk_text.strip())
                                except ValueError:
                                    print(f"Warning: Could not parse ATK value: {atk_text}")

                            if sec_text:
                                data["secondary_stat_value"] = sec_text.strip()
        except Exception as e:
            print(f"Error scraping stats: {e}")

        return data

    def scrape_weapons(self, language: str = "en") -> list[WeaponSource]:
        page = self._ensure_page()
        print(f"--- Weapon ({language.upper()}) ---")
        weapon_url = "https://wiki.hoyolab.com/pc/genshin/aggregate/4"

        if not self._navigate_with_language(weapon_url, language):
            return []

        self._scroll_until_all_loaded(".genshin-show-weapon-item")
        self._wait_for_images_to_load(".genshin-show-weapon-item img.d-img-show")

        weapon_cards = page.locator(".genshin-show-weapon-item").all()
        # print(f"Found {len(weapon_cards)} weapon cards")

        weapons: list[WeaponSource] = []
        for i, card in tqdm(
            enumerate(weapon_cards),
            total=len(weapon_cards),
            desc=f"Extracting {language.upper()}",
            unit="item",
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]",
        ):
            weapon_data = self._extract_weapon_from_card(card, i)
            if not weapon_data:
                continue

            # print(f"Scraping details for Weapon {i + 1}: {weapon_data.name}")

            try:
                # Click to open detail in new tab
                with page.context.expect_page() as new_page_info:
                    card.click()

                detail_page = new_page_info.value
                detail_page.wait_for_load_state()

                weapon_data.entry_id = extract_id_from_url(detail_page.url)

                detail_data = self._scrape_weapon_detail_page(detail_page)

                if detail_data:
                    for k, v in detail_data.items():
                        setattr(weapon_data, k, v)

                detail_page.close()

            except Exception as e:
                tqdm.write(f"Error scraping details for {weapon_data.name}: {e}")

            weapons.append(weapon_data)

        return weapons

    def scrape_elements_and_weapons(
        self, language: str = "en"
    ) -> tuple[list[ResourceOutput], list[ResourceOutput]]:
        page = self._ensure_page()
        # print(f"Scraping elements and weapons in {language}...")
        character_url = "https://wiki.hoyolab.com/pc/genshin/aggregate/2"

        if not self._navigate_with_language(character_url, language):
            return [], []

        elements: list[ResourceOutput] = []
        weapon_types: list[ResourceOutput] = []

        try:
            # Looking for filter icons
            # print("Looking for element/weapon images...")
            imgs = page.locator("div.tw-flex.tw-gap-3 img").all()
            # print(f"Found {len(imgs)} potential images")

            for img in imgs:
                alt_text = img.get_attribute("alt")
                src_url = img.get_attribute("src")

                if alt_text and src_url:
                    if alt_text in VALID_ELEMENTS:
                        elements.append(
                            ResourceOutput(
                                name=alt_text,
                                imageUrl=clean_image_url(src_url),
                                imagePath=f"/element/{alt_text.lower()}.png",
                            )
                        )
                    elif alt_text in VALID_WEAPONS:
                        weapon_types.append(
                            ResourceOutput(
                                name=alt_text,
                                imageUrl=clean_image_url(src_url),
                                imagePath=f"/weapontype/{alt_text.lower()}.png",
                            )
                        )
        except Exception as e:
            print(f"Error scraping elements/weapons: {e}")

        return elements, weapon_types

    def fetch_entry_name(self, entry_id: str, language: str) -> str | None:
        """Fetch the name of an entry from its detail page in a specific language"""
        page = self._ensure_page()
        url = f"https://wiki.hoyolab.com/pc/genshin/entry/{entry_id}?lang={language}"
        # print(f"Fetching name from {url}...")

        try:
            page.goto(url)
            page.wait_for_load_state("networkidle")

            name_locator = page.locator(".detail-header-common-name.genshin span")
            if name_locator.count() > 0:
                return name_locator.first.text_content()

        except Exception as e:
            print(f"Error fetching name for entry {entry_id} in {language}: {e}")

        return None
