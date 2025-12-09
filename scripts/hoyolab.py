import re
import time
from typing import TypedDict, List, Optional, Tuple, Set, Dict
from playwright.sync_api import Page, Locator

from preprocess import ARTIFACT_SKIP_LIST


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
    effects: List[str]


class ScrapedWeapon(TypedDict):
    id: str
    name: str
    rarity: int
    image_url: str
    type: str
    secondary_stat: str
    effect: str


class ResourceOutput(TypedDict):
    name: str
    imageUrl: str
    imagePath: str


VALID_ELEMENTS: Set[str] = {
    "Pyro",
    "Hydro",
    "Electro",
    "Cryo",
    "Anemo",
    "Geo",
    "Dendro",
}
VALID_WEAPONS: Set[str] = {"Sword", "Claymore", "Polearm", "Catalyst", "Bow"}
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
PLACEHOLDER_PATTERNS: List[str] = [
    "avatar.7663739.png",
    "_nuxt/img/avatar",
    "placeholder",
    "default-avatar",
]


def generate_id(name: str) -> str:
    """Generate a consistent ID from character name"""
    return re.sub(r"[^a-z0-9_]", "", name.lower().replace(" ", "_"))


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


def extract_element_from_src(src: str) -> str:
    src_lower = src.lower()
    for element in VALID_ELEMENTS:
        if element.lower() in src_lower:
            return element
    return "Pyro"


def extract_rarity_from_class(class_str: str) -> Optional[int]:
    if "d-img-level-5" in class_str:
        return 5
    elif "d-img-level-4" in class_str:
        return 4
    return None


def navigate_with_language(page: Page, base_url: str, language: str = "en") -> bool:
    try:
        clean_url = base_url.split("?")[0]
        url_with_lang = f"{clean_url}?lang={language}"
        print(f"Navigating to: {url_with_lang}")
        page.goto(url_with_lang)
        time.sleep(3)  # Wait for initial load
        return True
    except Exception as e:
        print(f"Could not navigate to {base_url} with language {language}: {e}")
        return False


def scroll_until_all_loaded(
    page: Page, card_selector: str, max_scrolls: int = 20
) -> int:
    print("Scrolling to load all cards...")

    previous_count = 0
    stable_count = 0
    scroll_count = 0

    while scroll_count < max_scrolls:
        current_cards = page.locator(card_selector).all()
        current_count = len(current_cards)

        print(f"Scroll {scroll_count + 1}: Found {current_count} cards")

        if current_count > previous_count:
            previous_count = current_count
            stable_count = 0
        elif current_count == previous_count:
            stable_count += 1
            if stable_count >= 2:  # Wait for 2 stable counts to be sure
                print(f"Card count stable at {current_count}, stopping...")
                break

        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)
        scroll_count += 1

    # print("Scrolling back to top...")
    # page.evaluate("window.scrollTo(0, 0)")
    # time.sleep(2)

    # Scroll to bottom again to trigger any final lazy loads
    # page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    # time.sleep(2)

    final_count = page.locator(card_selector).count()
    print(f"Final card count: {final_count}")
    return final_count


def wait_for_images_to_load(page: Page, selector: str, max_wait: int = 30) -> bool:
    print("Waiting for images to load...")
    start_time = time.time()

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
            print("All images loaded successfully!")
            return True

        print(f"Found {placeholder_count} placeholder images, waiting...")
        page.evaluate("window.scrollBy(0, 500)")
        time.sleep(1)
        page.evaluate("window.scrollBy(0, -200)")
        time.sleep(1)

    print(f"Warning: Some images may not have loaded after {max_wait} seconds")
    return False


def extract_character_from_card(
    card: Locator, index: int
) -> Optional[ScrapedCharacter]:
    try:
        name_el = card.locator("div.character-card-name span").first
        if not name_el.count():
            # Try alternate selector if any
            return None
        name_text = name_el.text_content()
        if not name_text:
            return None
        name = name_text.strip()
    except Exception:
        return None

    try:
        element_img = card.locator("img.character-card-element").first
        element_src = element_img.get_attribute("src")
        if not element_src:
            return None
        element = extract_element_from_src(element_src)
    except Exception:
        return None

    try:
        icon_div = card.locator("div.character-card-icon").first
        rarity_classes = icon_div.get_attribute("class")
        if not rarity_classes:
            return None
        rarity = extract_rarity_from_class(rarity_classes)
        if rarity is None:
            return None
    except Exception:
        return None

    try:
        char_img = card.locator("img.d-img-show").first
        original_image_url = char_img.get_attribute("src")
        if not original_image_url or is_placeholder_image(original_image_url):
            print(
                f"ERROR: {name} has placeholder image: {original_image_url if original_image_url else 'None'}"
            )
            return None
        cleaned_image_url = clean_image_url(original_image_url)
    except Exception:
        return None

    return {
        "id": generate_id(name),
        "name": name,
        "element": element,
        "rarity": rarity,
        "image_url": cleaned_image_url,
    }


def scrape_characters(page: Page, language: str = "en") -> List[ScrapedCharacter]:
    print(f"Scraping characters in {language}...")
    character_url = "https://wiki.hoyolab.com/pc/genshin/aggregate/2"

    if not navigate_with_language(page, character_url, language):
        return []

    scroll_until_all_loaded(page, "article.character-card")
    wait_for_images_to_load(page, "article.character-card img.d-img-show")

    character_cards = page.locator("article.character-card").all()
    print(f"Found {len(character_cards)} character cards")

    characters: List[ScrapedCharacter] = []
    for i, card in enumerate(character_cards):
        char_data = extract_character_from_card(card, i)
        if char_data:
            characters.append(char_data)
            print(
                f"Character {i + 1}: {char_data['name']} ({char_data['element']}, {char_data['rarity']}*)"
            )

    return characters


def extract_artifact_from_card(card: Locator, index: int) -> Optional[ScrapedArtifact]:
    name: str = ""
    try:
        name_el = card.locator("div.artifact-card-name").first
        name_text = name_el.text_content()
        if not name_text:
            return None
        name = name_text.strip()
    except Exception:
        return None

    try:
        artifact_img = card.locator("div.artifact-card-main img.d-img-show").first
        original_image_url = artifact_img.get_attribute("src")
        if not original_image_url or is_placeholder_image(original_image_url):
            print(f"ERROR: {name} has placeholder image")
            return None
        cleaned_image_url = clean_image_url(original_image_url)
    except Exception:
        return None

    try:
        desc_items = card.locator("div.artifact-card-desc-item").all()
        if len(desc_items) < 2:
            return None

        effects: List[str] = []
        for item in desc_items[:2]:
            detail_el = item.locator("div.artifact-card-desc-detail").first
            effect_text = detail_el.text_content()
            if effect_text:
                effects.append(effect_text.strip())
            else:
                effects.append("")

        artifact_id = generate_id(name)
        if artifact_id in ARTIFACT_SKIP_LIST:
            return None

        return {
            "id": artifact_id,
            "name": name,
            "image_url": cleaned_image_url,
            "effects": effects,
        }
    except Exception:
        return None


def scrape_artifacts(page: Page, language: str = "en") -> List[ScrapedArtifact]:
    print(f"Scraping artifacts in {language}...")
    artifact_url = "https://wiki.hoyolab.com/pc/genshin/aggregate/5"

    if not navigate_with_language(page, artifact_url, language):
        return []

    scroll_until_all_loaded(page, "div.artifact-card")
    wait_for_images_to_load(page, "div.artifact-card img.d-img-show")

    artifact_cards = page.locator("div.artifact-card").all()
    print(f"Found {len(artifact_cards)} artifact cards")

    artifacts: List[ScrapedArtifact] = []
    for i, card in enumerate(artifact_cards):
        art_data = extract_artifact_from_card(card, i)
        if art_data:
            artifacts.append(art_data)
            print(f"Artifact {i + 1}: {art_data['name']}")

    return artifacts


def extract_weapon_from_card(card: Locator, index: int) -> Optional[ScrapedWeapon]:
    name: str = ""
    try:
        name_el = card.locator("div.weapon-card-name span").first
        name_text = name_el.text_content()
        if not name_text:
            return None
        name = name_text.strip()
    except Exception:
        return None

    try:
        # Rarity is in the icon wrapper class, e.g. drop-icon-with-star-5
        icon_div = card.locator("div.weapon-card-icon .drop-icon-with-star").first
        rarity_classes = icon_div.get_attribute("class")
        if not rarity_classes:
            return None

        rarity = 0
        if "drop-icon-with-star-5" in rarity_classes:
            rarity = 5
        elif "drop-icon-with-star-4" in rarity_classes:
            rarity = 4
        elif "drop-icon-with-star-3" in rarity_classes:
            rarity = 3
        elif "drop-icon-with-star-2" in rarity_classes:
            rarity = 2
        elif "drop-icon-with-star-1" in rarity_classes:
            rarity = 1

        if rarity == 0:
            # Fallback to checking d-img-level-X inside
            img_div = card.locator("div.d-img").first
            img_classes = img_div.get_attribute("class") or ""
            rarity = extract_rarity_from_class(img_classes) or 0

        if rarity == 0:
            return None

        if rarity < 3:
            return None

    except Exception:
        return None

    try:
        weapon_img = card.locator("img.d-img-show").first
        original_image_url = weapon_img.get_attribute("src")
        if not original_image_url or is_placeholder_image(original_image_url):
            print(f"ERROR: {name} has placeholder image")
            return None
        cleaned_image_url = clean_image_url(original_image_url)
    except Exception:
        return None

    return {
        "id": generate_id(name),
        "name": name,
        "rarity": rarity,
        "image_url": cleaned_image_url,
        "type": "",
        "secondary_stat": "",
        "effect": "",
    }


def scrape_weapon_detail_page(page: Page) -> Dict[str, str]:
    try:
        page.wait_for_selector("div.base-info-content", timeout=5000)
    except Exception as e:
        print(
            f"Warning: Could not find base-info-content on weapon detail page: {str(e)}"
        )
        return {}

    items = page.locator("div.base-info-item").all()
    data = {"type": "", "secondary_stat": "", "effect": ""}

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

    return data


def scrape_weapons(page: Page, language: str = "en") -> List[ScrapedWeapon]:
    print(f"Scraping weapons in {language}...")
    weapon_url = "https://wiki.hoyolab.com/pc/genshin/aggregate/4"

    if not navigate_with_language(page, weapon_url, language):
        return []

    scroll_until_all_loaded(page, ".genshin-show-weapon-item")
    wait_for_images_to_load(page, ".genshin-show-weapon-item img.d-img-show")

    weapon_cards = page.locator(".genshin-show-weapon-item").all()
    print(f"Found {len(weapon_cards)} weapon cards")

    weapons: List[ScrapedWeapon] = []
    for i, card in enumerate(weapon_cards):
        weapon_data = extract_weapon_from_card(card, i)
        if not weapon_data:
            continue

        print(f"Scraping details for Weapon {i + 1}: {weapon_data['name']}")

        try:
            # Click to open detail in new tab
            with page.context.expect_page() as new_page_info:
                card.click()

            detail_page = new_page_info.value
            detail_page.wait_for_load_state()

            # Check/fix language if needed (sometimes it defaults to EN)
            # The URL usually inherits query params but let's be safe.
            if f"lang={language}" not in detail_page.url and "?" in detail_page.url:
                # It might have language in local storage or cookie, but let's verify
                pass
            elif f"lang={language}" not in detail_page.url and language != "en":
                # Reload with correct language if missing
                # But we don't want to double load every page.
                # Let's just try scraping. If keys are missing, we might be in wrong lang.
                pass

            detail_data = scrape_weapon_detail_page(detail_page)

            if detail_data:
                # Type ignore because TypedDict update is sometimes finicky with variable dicts
                weapon_data.update(detail_data)  # type: ignore

            detail_page.close()

        except Exception as e:
            print(f"Error scraping details for {weapon_data['name']}: {e}")

        weapons.append(weapon_data)

    return weapons


def scrape_elements_and_weapons(
    page: Page, language: str = "en"
) -> Tuple[List[ResourceOutput], List[ResourceOutput]]:
    print(f"Scraping elements and weapons in {language}...")
    character_url = "https://wiki.hoyolab.com/pc/genshin/aggregate/2"

    if not navigate_with_language(page, character_url, language):
        return [], []

    elements: List[ResourceOutput] = []
    weapon_types: List[ResourceOutput] = []

    try:
        # Looking for filter icons
        print("Looking for element/weapon images...")
        imgs = page.locator("div.tw-flex.tw-gap-3 img").all()
        print(f"Found {len(imgs)} potential images")

        for img in imgs:
            alt_text = img.get_attribute("alt")
            src_url = img.get_attribute("src")

            if alt_text and src_url:
                if alt_text in VALID_ELEMENTS:
                    elements.append(
                        {
                            "name": alt_text,
                            "imageUrl": clean_image_url(src_url),
                            "imagePath": f"/element/{alt_text.lower()}.png",
                        }
                    )
                elif alt_text in VALID_WEAPONS:
                    weapon_types.append(
                        {
                            "name": alt_text,
                            "imageUrl": clean_image_url(src_url),
                            "imagePath": f"/weapontype/{alt_text.lower()}.png",
                        }
                    )
    except Exception as e:
        print(f"Error scraping elements/weapons: {e}")

    return elements, weapon_types
