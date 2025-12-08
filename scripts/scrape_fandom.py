#!/usr/bin/env python3
"""
Genshin Impact Character Data Scraper - Fandom Wiki Version
Scrapes character data from genshin-impact.fandom.com and generates characters.ts file
"""

import re
from typing import TypedDict

import requests
from bs4 import BeautifulSoup, Tag


class CharacterData(TypedDict):
    name: str
    element: str
    imageUrl: str
    rarity: int
    weapon: str
    region: str
    releaseDate: str


OUTPUT_FILE: str = "src/data/characters.ts"
BASE_URL: str = "https://genshin-impact.fandom.com"
CHARACTERS_URL: str = f"{BASE_URL}/wiki/Character/List"
REQUEST_TIMEOUT: int = 30

HEADERS: dict[str, str] = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

MIN_NAME_LENGTH: int = 2
MAX_NAME_LENGTH: int = 30
VALID_RARITIES: list[int] = [4, 5]
SKIP_TRAVELER: bool = False


def clean_release_date(date_string: str) -> str:
    """Clean release date to YYYY-MM-DD format"""
    return re.sub(r"\s+\d{2}:\d{2}:\d{2}.*$", "", date_string)


def clean_image_url(image_url: str) -> str:
    """Clean image URL by removing scaling parameters"""
    return re.sub(r"\.(png|jpg|jpeg).*$", r".\1", image_url)


def extract_character_name(name_cell: Tag) -> str | None:
    """Extract character name from name cell"""
    name_link: Tag | None = name_cell.find("a")
    if not name_link:
        return None
    assert isinstance(name_link, Tag)

    name: str = name_link.get_text(strip=True)
    if not name or len(name) < MIN_NAME_LENGTH or len(name) > MAX_NAME_LENGTH:
        return None

    if SKIP_TRAVELER and name.startswith("Traveler"):
        return None

    return name


def extract_rarity(quality_cell: Tag) -> int | None:
    """Extract rarity from quality cell"""
    rarity_img: Tag | None = quality_cell.find("img")
    if not rarity_img:
        return None
    assert isinstance(rarity_img, Tag)

    alt_text: str | None = rarity_img.get("alt")
    if not alt_text:
        return None

    if "4 Stars" in alt_text:
        rarity: int = 4
    elif "5 Stars" in alt_text:
        rarity: int = 5
    else:
        return None

    if rarity not in VALID_RARITIES:
        return None

    return rarity


def extract_text_from_last_link(cell: Tag) -> str | None:
    """Extract text from the last link in a cell"""
    links: list[Tag] = cell.find_all("a")
    if not links:
        return None

    last_link: Tag = links[-1]
    assert isinstance(last_link, Tag)
    return last_link.get_text(strip=True)


def extract_region(region_cell: Tag) -> str:
    """Extract region from region cell"""
    region_links: list[Tag] = region_cell.find_all("a")
    if region_links:
        region_link: Tag = region_links[-1]
        assert isinstance(region_link, Tag)
        return region_link.get_text(strip=True)
    else:
        return region_cell.get_text(strip=True)


def extract_character_image(icon_cell: Tag) -> str | None:
    """Extract character image URL from icon cell"""
    icon_img: Tag | None = icon_cell.find("img")
    if not icon_img:
        return None
    assert isinstance(icon_img, Tag)

    image_url: str | None = icon_img.get("data-src") or icon_img.get("src")
    if not image_url or image_url.startswith("data:image/gif"):
        return None

    return clean_image_url(image_url)


def process_character_row(cells: list[Tag]) -> CharacterData | None:
    """Process a single character row and extract character data"""
    if len(cells) < 9:
        return None

    name: str | None = extract_character_name(cells[1])
    if not name:
        return None

    rarity: int | None = extract_rarity(cells[2])
    if rarity is None:
        return None

    element: str | None = extract_text_from_last_link(cells[3])
    if not element:
        return None

    weapon: str | None = extract_text_from_last_link(cells[4])
    if not weapon:
        return None

    region: str = extract_region(cells[5])

    release_date_attr: str | None = cells[7].get("data-release")
    if not release_date_attr:
        return None

    release_date: str = clean_release_date(release_date_attr)

    image_url: str | None = extract_character_image(cells[0])
    if not image_url:
        return None

    character: CharacterData = {
        "name": name,
        "element": element,
        "imageUrl": image_url,
        "rarity": rarity,
        "weapon": weapon,
        "region": region,
        "releaseDate": release_date,
    }

    return character


def scrape_character_data() -> list[CharacterData]:
    """Scrape character data from genshin-impact.fandom.com"""
    print("Fetching character data from genshin-impact.fandom.com...")

    try:
        response: requests.Response = requests.get(
            CHARACTERS_URL, headers=HEADERS, timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Error fetching characters page: {e}")
        return []

    soup: BeautifulSoup = BeautifulSoup(response.text, "html.parser")
    assert isinstance(soup, BeautifulSoup)

    tables: list[Tag] = soup.find_all("table")
    target_table: Tag | None = None

    for table in tables:
        assert isinstance(table, Tag)
        data_release_elements: list[Tag] = table.find_all(attrs={"data-release": True})
        if data_release_elements:
            target_table = table
            break

    if not target_table:
        print("Could not find the Playable Characters table")
        return []

    assert isinstance(target_table, Tag)
    data_release_elements: list[Tag] = target_table.find_all(attrs={"data-release": True})
    print(f"Found Playable Characters table with {len(data_release_elements)} characters")

    rows: list[Tag] = target_table.find_all("tr")[1:]
    print(f"Processing {len(rows)} rows...")

    characters: list[CharacterData] = []
    for row in rows:
        assert isinstance(row, Tag)
        try:
            cells: list[Tag] = row.find_all(["td", "th"])
            character: CharacterData | None = process_character_row(cells)

            if character:
                characters.append(character)
                print(
                    f"Scraped: {character['name']} ({character['element']}, {character['weapon']}, "
                    f"{character['region']}, {character['rarity']}★, {character['releaseDate']})"
                )

        except Exception as e:
            print(f"Error processing character row: {e}")
            continue

    return characters


def get_character_data() -> dict[tuple[str, int, str], CharacterData]:
    """Get character data from Fandom wiki and return it as a dictionary keyed by (element, rarity, name)"""
    print("Fetching character data from genshin-impact.fandom.com...")

    characters: list[CharacterData] = scrape_character_data()

    if not characters:
        print("No characters found. The website structure may have changed.")
        return {}

    print(f"Successfully scraped {len(characters)} characters from Fandom")

    character_lookup: dict[tuple[str, int, str], CharacterData] = {}
    for char in characters:
        key: tuple[str, int, str] = (char["element"], char["rarity"], char["name"])
        character_lookup[key] = char

    return character_lookup
