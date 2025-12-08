from typing import TypedDict, List
import re
from playwright.sync_api import sync_playwright, Route

class CharacterData(TypedDict):
    name: str
    element: str
    imageUrl: str
    rarity: int
    weapon: str
    region: str
    releaseDate: str

BASE_URL = "https://genshin-impact.fandom.com"
CHARACTERS_URL = f"{BASE_URL}/wiki/Character/List"

MIN_NAME_LENGTH = 2
MAX_NAME_LENGTH = 30
VALID_RARITIES = [4, 5]
SKIP_TRAVELER = False

def clean_release_date(date_string: str) -> str:
    """Clean release date to YYYY-MM-DD format"""
    return re.sub(r"\s+\d{2}:\d{2}:\d{2}.*$", "", date_string)

def clean_image_url(image_url: str) -> str:
    """Clean image URL by removing scaling parameters"""
    return re.sub(r"\.(png|jpg|jpeg).*$", r".\1", image_url)

def get_character_data() -> dict[tuple[str, int, str], CharacterData]:
    """Get character data from Fandom wiki and return it as a dictionary keyed by (element, rarity, name)"""
    print("Fetching character data from genshin-impact.fandom.com...")
    
    characters: List[CharacterData] = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # Disable JavaScript for speed (Fandom tables are server-rendered) and set User-Agent
        # This mimics the behavior of 'requests' which the user noted was fast.
        context = browser.new_context(
            java_script_enabled=False,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        # Optimize loading by blocking unnecessary resources
        def route_handler(route: Route):
            if route.request.resource_type in ["image", "stylesheet", "font", "media", "websocket", "other"]:
                route.abort()
            else:
                route.continue_()
                
        page.route("**/*", route_handler)
        
        try:
            print(f"Navigating to {CHARACTERS_URL}...")
            # With JS disabled, this should be extremely fast
            page.goto(CHARACTERS_URL, timeout=30000, wait_until="domcontentloaded")
            
            # Locate all tables
            tables = page.locator("table").all()
            target_table = None
            
            for table in tables:
                if table.locator("[data-release]").count() > 0:
                    target_table = table
                    break
            
            if not target_table:
                print("Could not find the Playable Characters table")
                return {}
            
            rows = target_table.locator("tr").all()
            if len(rows) > 0:
                rows = rows[1:] # Skip header
                
            print(f"Processing {len(rows)} rows...")
            
            for row in rows:
                try:
                    cells = row.locator("td, th").all()
                    if len(cells) < 9:
                        continue
                        
                    # 1. Name (Cell 1)
                    name_link = cells[1].locator("a").first
                    if not name_link.count():
                        continue
                    name_text: str | None = name_link.text_content()
                    if not name_text:
                        continue
                    name = name_text.strip()
                    
                    if not name or len(name) < MIN_NAME_LENGTH or len(name) > MAX_NAME_LENGTH:
                        continue
                    if SKIP_TRAVELER and name.startswith("Traveler"):
                        continue
                        
                    # 2. Rarity (Cell 2)
                    rarity_img = cells[2].locator("img").first
                    if not rarity_img.count():
                        continue
                    alt_text = rarity_img.get_attribute("alt") or ""
                    
                    rarity = 0
                    if "4 Stars" in alt_text:
                        rarity = 4
                    elif "5 Stars" in alt_text:
                        rarity = 5
                    else:
                        continue
                    
                    if rarity not in VALID_RARITIES:
                        continue
                        
                    # 3. Element (Cell 3) - Last link
                    element_links = cells[3].locator("a").all()
                    if not element_links:
                        continue
                    element_text: str | None = element_links[-1].text_content()
                    if not element_text:
                        continue
                    element = element_text.strip()
                    
                    # 4. Weapon (Cell 4) - Last link
                    weapon_links = cells[4].locator("a").all()
                    if not weapon_links:
                        continue
                    weapon_text: str | None = weapon_links[-1].text_content()
                    if not weapon_text:
                        continue
                    weapon = weapon_text.strip()
                    
                    # 5. Region (Cell 5)
                    region_links = cells[5].locator("a").all()
                    region: str
                    if region_links:
                        region_text = region_links[-1].text_content()
                        region = region_text.strip() if region_text else ""
                    else:
                        region_text = cells[5].text_content()
                        region = region_text.strip() if region_text else ""
                        
                    # 6. Release Date (Cell 7)
                    release_date_attr = cells[7].get_attribute("data-release")
                    if not release_date_attr:
                        continue
                    releaseDate = clean_release_date(release_date_attr)
                    
                    # 7. Image (Cell 0)
                    icon_img = cells[0].locator("img").first
                    if not icon_img.count():
                        continue
                    
                    image_url = icon_img.get_attribute("data-src") or icon_img.get_attribute("src")
                    if not image_url or image_url.startswith("data:image/gif"):
                        pass
                        
                    if not image_url:
                        continue
                        
                    image_url = clean_image_url(image_url)
                    
                    char_data: CharacterData = {
                        "name": name,
                        "element": element,
                        "imageUrl": image_url,
                        "rarity": rarity,
                        "weapon": weapon,
                        "region": region,
                        "releaseDate": releaseDate
                    }
                    
                    characters.append(char_data)
                    print(f"Scraped: {name} ({element}, {weapon}, {region}, {rarity}★, {releaseDate})")
                    
                except Exception as e:
                    print(f"Error processing row: {e}")
                    continue
                    
        except Exception as e:
            print(f"Error scraping Fandom: {e}")
            return {}
        finally:
            browser.close()
            
    print(f"Successfully scraped {len(characters)} characters from Fandom")
    
    character_lookup: dict[tuple[str, int, str], CharacterData] = {}
    for char in characters:
        key = (char["element"], char["rarity"], char["name"])
        character_lookup[key] = char
        
    return character_lookup

if __name__ == "__main__":
    data = get_character_data()
    print(f"Found {len(data)} characters.")