"""Scrape character data from gi.hakush.in (hakushin).

Extracts:
- Base stats at Lv 90 and Lv 100 (non-i18n)
- Skills (name, description HTML, detail tables at Lv 6, 10 & 13) (per language)
- Passives (name, description HTML) (per language)
- Constellations (name, description HTML) (per language)
- Glossary entries from hover-card <a> tags (per language)

Usage:
    uv run --project scripts/pyproject.toml scripts/hakushin.py
    uv run --project scripts/pyproject.toml scripts/hakushin.py --character varka
    uv run --project scripts/pyproject.toml scripts/hakushin.py --list-only
"""

import argparse
import json
import re
import time
from html import unescape
from pathlib import Path
from typing import Self

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from hoyolab import generate_id

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CANONICAL_URL = "https://gi.hakush.in"
DATA_DIR = Path(__file__).parent.parent / "src" / "data"
GAME_DATA_DIR = DATA_DIR / "game"
LANGUAGES = ("en", "zh")

# Characters to skip by English name (Traveler/Manekin have per-element variants)
BLOCKLIST_NAMES: set[str] = {"Traveler", "Manekin", "Manekina"}

# Stat key normalization (EN labels -> canonical keys)
# Ascension stat values use MainStat literals from src/data/types.ts
STAT_KEY_MAP: dict[str, str] = {
    "Base HP": "baseHp",
    "Base ATK": "baseAtk",
    "Base DEF": "baseDef",
    "Elemental Mastery": "em",
    "CRIT Rate": "cr",
    "CRIT DMG": "cd",
    "Energy Recharge": "er",
    "Healing Bonus": "heal%",
    "Pyro DMG Bonus": "pyro%",
    "Hydro DMG Bonus": "hydro%",
    "Electro DMG Bonus": "electro%",
    "Cryo DMG Bonus": "cryo%",
    "Anemo DMG Bonus": "anemo%",
    "Geo DMG Bonus": "geo%",
    "Dendro DMG Bonus": "dendro%",
    "Physical DMG Bonus": "phys%",
    "HP%": "hp%",
    "ATK%": "atk%",
    "DEF%": "def%",
    # Shorthand labels (site sometimes omits the '%' suffix)
    "HP": "hp%",
    "ATK": "atk%",
    "DEF": "def%",
}

# Metadata keys in the stat table that we intentionally skip.
# Any key not in STAT_KEY_MAP or IGNORED_STAT_KEYS triggers a warning.
IGNORED_STAT_KEYS: set[str] = {
    "Element",
    "Weapon",
    "Rarity",
    "Birth",
    "Constellation",
    "Native",
}

# Stats we want from base stats (union of all STAT_KEY_MAP labels)
BASE_STAT_KEYS = set(STAT_KEY_MAP.keys())


# ---------------------------------------------------------------------------
# JS snippets — all extraction logic runs in the browser
# ---------------------------------------------------------------------------

JS_GET_CHARACTER_LIST = """
() => {
    const links = Array.from(document.querySelectorAll('a[href*="/character/"]'));
    return links
        .filter(a => a.href.match(/\\/character\\/\\d+$/))
        .map(a => ({
            name: a.textContent.trim(),
            id: a.href.match(/\\/character\\/(\\d+)/)?.[1]
        }))
        .filter(c => c.id && c.name);
}
"""

JS_SET_LEVEL_SLIDER = """
(level) => {
    // The level slider is inside the stats section (first kit child)
    // It has max="100" (vs skill sliders which have max="15")
    const slider = document.querySelector('#character-kit input[type="range"][max="100"]');
    if (!slider) return false;
    const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(slider, level);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}
"""

JS_GET_BASE_STATS = """
() => {
    const kit = document.querySelector('#character-kit');
    if (!kit) return {};
    // Base stats are in the first child of #character-kit
    const statsContainer = kit.children[0];
    if (!statsContainer) return {};

    const grids = statsContainer.querySelectorAll('.grid.grid-cols-2');
    const stats = {};
    for (const grid of grids) {
        const children = Array.from(grid.children).map(c => c.textContent.trim());
        if (children.length >= 2 && children[0] && children[1]) {
            stats[children[0]] = children[1];
        }
    }
    return stats;
}
"""

JS_FIND_SECTION_IDS = """
() => {
    const kit = document.querySelector('#character-kit');
    if (!kit) return null;

    const result = { skills: [], passives: [], constellations: [] };

    for (const child of kit.children) {
        const text = (child.textContent || '').substring(0, 30);

        if (text.startsWith('Skills') || text.includes('SKILLS')) {
            result.skills = Array.from(child.querySelectorAll('[id^="S"]'))
                .filter(el => el.id.match(/^S\\d+$/))
                .map(el => el.id);
        } else if (text.startsWith('Passives') || text.includes('PASSIVES')
                   || text.startsWith('固有天赋')) {
            result.passives = Array.from(child.querySelectorAll('[id^="P"]'))
                .filter(el => el.id.match(/^P\\d+$/))
                .map(el => el.id);
        } else if (text.startsWith('Constellations') || text.includes('CONSTELLATIONS')
                   || text.startsWith('命之座')) {
            result.constellations = Array.from(child.querySelectorAll('[id^="T"]'))
                .filter(el => el.id.match(/^T\\d+$/))
                .map(el => el.id);
        }
    }
    return result;
}
"""

JS_GET_SECTION_DATA = """
(sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return null;

    // Name: the .text-lg div contains the name as TEXT NODEs,
    // followed by icon <div> and tooltip <div> children.
    // Concatenate all text nodes that appear before the first element child.
    let name = '';
    const nameDiv = section.querySelector('.text-lg');
    if (nameDiv) {
        const parts = [];
        for (const node of nameDiv.childNodes) {
            if (node.nodeType === 3) {  // TEXT_NODE
                parts.push(node.textContent);
            } else {
                break;  // Stop at first element (icon or tooltip div)
            }
        }
        name = parts.join('').trim();
    }

    // Description: in div.text-sm.font-normal (rich HTML with <br>, <strong>, <span>)
    const descEl = section.querySelector('.text-sm.font-normal');
    const descHtml = descEl ? descEl.innerHTML : '';

    return { name, descHtml };
}
"""

JS_SET_SKILL_LEVEL = """
(args) => {
    const [skillId, level] = args;
    const section = document.getElementById(skillId);
    if (!section) return false;
    const slider = section.querySelector('input[type="range"]');
    if (!slider) return false;
    const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(slider, level);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}
"""

JS_GET_SKILL_TABLE = """
(skillId) => {
    const section = document.getElementById(skillId);
    if (!section) return [];
    // Table is inside: div.grid.grid-cols-1 > div.grid.grid-cols-2
    const container = section.querySelector('.grid.grid-cols-1');
    if (!container) return [];
    const rows = container.querySelectorAll('.grid.grid-cols-2');
    return Array.from(rows).map(row => {
        const cells = Array.from(row.children).map(c => c.textContent.trim());
        return [cells[0] || '', cells[1] || ''];
    });
}
"""

# Detect current language from sidebar: the active language is ABSENT
# from the clickable options. Returns 'en', 'zh', or null.
JS_DETECT_LANGUAGE = """
() => {
    const sidebar = document.querySelector('sidebar');
    if (!sidebar) return null;
    const labels = new Set(
        Array.from(sidebar.querySelectorAll('div, span, a, button'))
            .map(el => el.textContent.trim())
    );
    if (!labels.has('English')) return 'en';
    if (!labels.has('中文(简体)')) return 'zh';
    return null;
}
"""

# Click a language option in the sidebar. Returns true if clicked.
JS_CLICK_LANGUAGE = """
(label) => {
    const sidebar = document.querySelector('sidebar');
    if (!sidebar) return false;
    const items = Array.from(sidebar.querySelectorAll('div, span, a, button'));
    const target = items.find(el => el.textContent.trim() === label);
    if (!target) return false;
    target.click();
    return true;
}
"""


# ---------------------------------------------------------------------------
# HTML post-processing
# ---------------------------------------------------------------------------


def _extract_tooltip_content(raw_tooltip: str) -> str:
    """Extract the description content from a tooltip HTML block.

    Tooltip structure:
      <div class="...font-bold">Title</div>
      <div class="...font-normal">Content</div>
    Returns only the inner HTML of the content div, stripped of whitespace.
    """
    content_match = re.search(
        r"<div\s[^>]*?font-normal[^>]*?>(.*?)</div>\s*$",
        raw_tooltip,
        re.DOTALL,
    )
    if content_match:
        return content_match.group(1).strip()
    # Fallback: return the whole thing stripped
    return raw_tooltip.strip()


def process_description_html(html: str) -> tuple[str, dict[str, str]]:
    """Process description HTML: extract glossary entries and strip special <a> tags.

    Returns (cleaned_html, glossary) where glossary maps keyword -> tooltip content.
    """
    glossary: dict[str, str] = {}

    # Pattern 1: Hover-card <a> with data-tooltip and cursor-help class
    hover_pattern = re.compile(
        r'<a\s[^>]*?class="[^"]*?cursor-help[^"]*?"[^>]*?data-tooltip="([^"]*?)"[^>]*?>'
        r"(.*?)</a>",
        re.DOTALL,
    )

    for match in hover_pattern.finditer(html):
        tooltip_escaped = match.group(1)
        keyword = re.sub(r"<[^>]+>", "", match.group(2)).strip()  # Strip inner HTML tags
        tooltip_content = _extract_tooltip_content(unescape(tooltip_escaped))

        if keyword in glossary:
            if glossary[keyword] != tooltip_content:
                raise ValueError(
                    f"Inconsistent glossary for '{keyword}':\n"
                    f"  Existing: {glossary[keyword][:100]}...\n"
                    f"  New:      {tooltip_content[:100]}..."
                )
        else:
            glossary[keyword] = tooltip_content

    # Remove hover-card <a> wrapping (keep inner text/HTML)
    html = hover_pattern.sub(r"\2", html)

    # Pattern 2: Simple internal links - <a href="#S..." class="underline">Name</a>
    simple_link = re.compile(
        r'<a\s+href="#[^"]*?"\s+class="underline"[^>]*?>(.*?)</a>',
        re.DOTALL,
    )
    html = simple_link.sub(r"\1", html)

    # Collapse consecutive whitespace (safe: <br> handles line breaks in HTML)
    html = re.sub(r"\s+", " ", html).strip()

    # Replace <strong> with <b> for lighter visual weight.
    # Warn if any <strong> tag carries attributes (unexpected from source).
    strong_with_attrs = re.findall(r"<strong\s+[^>]+>", html)
    if strong_with_attrs:
        print(f"  WARNING: <strong> tags with attributes found (not replaced): {strong_with_attrs}")
    html = html.replace("<strong>", "<b>").replace("</strong>", "</b>")

    return html, glossary


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------


class HakushinScraper:
    def __init__(self, headless: bool = True):
        self._headless = headless
        self._playwright = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self.page: Page | None = None
        self.base_url: str = ""

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
        self._block_ads()
        self._resolve_base_url()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._context:
            self._context.close()
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()

    def _resolve_base_url(self) -> None:
        """Navigate to the canonical URL and capture the redirect destination."""
        page = self._page()
        page.goto(CANONICAL_URL, wait_until="domcontentloaded", timeout=60000)
        # Extract origin from the final URL (e.g. "https://gi20.hakush.in")
        final_url = page.url
        match = re.match(r"(https?://[^/]+)", final_url)
        if not match:
            raise RuntimeError(f"Failed to resolve base URL from {final_url}")
        self.base_url = match.group(1)
        print(f"Resolved base URL: {self.base_url}")

    def _page(self) -> Page:
        if not self.page:
            raise RuntimeError("Scraper not initialized")
        return self.page

    _AD_DOMAIN_PATTERNS = [
        "**/*.doubleclick.net/**",
        "**/*.googlesyndication.com/**",
        "**/*.googleadservices.com/**",
        "**/*.google-analytics.com/**",
        "**/*.adnxs.com/**",
        "**/*.adsrvr.org/**",
        "**/*.amazon-adsystem.com/**",
        "**/fundingchoicesmessages.google.com/**",
        "**/googletagmanager.com/**",
    ]

    def _block_ads(self) -> None:
        """Block ad/tracking requests."""
        for pattern in self._AD_DOMAIN_PATTERNS:
            self._page().route(pattern, lambda route: route.abort())

    def _navigate(self, url: str) -> None:
        self._page().goto(url, wait_until="domcontentloaded", timeout=30000)
        self._page().set_default_timeout(15000)
        # Wait for Svelte hydration to populate the character kit
        try:
            self._page().wait_for_selector(
                "#character-kit",
                timeout=10000,
            )
        except Exception:
            # Non-character pages (e.g. list page) won't have this element
            time.sleep(5)

    def _switch_language(self, lang: str) -> None:
        """Switch the page language with detection and verification.

        1. Poll sidebar to detect the current language.
        2. If already correct, return immediately.
        3. Click the target language button.
        4. Verify the switch by polling until the sidebar reflects it.
        """
        label = "English" if lang == "en" else "中文(简体)"

        # Step 1: Detect current language (sidebar may load async)
        current: str | None = None
        for _ in range(5):
            current = self._page().evaluate(JS_DETECT_LANGUAGE)
            if current is not None:
                break
            time.sleep(2)
        else:
            raise RuntimeError(
                "Could not detect language from sidebar after 5 attempts. Check: <sidebar> element."
            )

        # Step 2: Already in the target language
        if current == lang:
            return

        # Step 3: Click to switch
        clicked: bool = self._page().evaluate(JS_CLICK_LANGUAGE, label)
        if not clicked:
            raise RuntimeError(
                f"Could not find '{label}' button in sidebar. Detected language: {current}"
            )

        # Step 4: Verify the switch by polling the sidebar
        for _ in range(5):
            time.sleep(2)
            detected = self._page().evaluate(JS_DETECT_LANGUAGE)
            if detected == lang:
                time.sleep(1)  # Extra settle time for content re-render
                return

        raise RuntimeError(
            f"Language switch verification failed: expected '{lang}', "
            f"sidebar still shows '{detected}'"
        )

    # -----------------------------------------------------------------------
    # Character listing
    # -----------------------------------------------------------------------

    def get_character_list(self) -> list[dict[str, str]]:
        """Return list of {"name": english_name, "id": internal_id}.

        The page must be in English (default) so names can be used
        for generate_id().
        """
        self._navigate(f"{self.base_url}/character")
        raw: list[dict[str, str]] = self._page().evaluate(JS_GET_CHARACTER_LIST)
        if not raw:
            raise RuntimeError("No characters found. Check selector: a[href*='/character/']")
        seen: set[str] = set()
        result: list[dict[str, str]] = []
        for c in raw:
            cid = c["id"]
            if cid not in seen and c["name"] not in BLOCKLIST_NAMES:
                seen.add(cid)
                result.append(c)
        if len(result) < 50:
            raise RuntimeError(
                f"Only {len(result)} characters found (expected >= 50). "
                f"Character list page structure may have changed."
            )
        return result

    def build_id_map(self) -> dict[str, str]:
        """Build mapping from english_id -> internal_id.

        english_id is the flattened English name (via generate_id).
        internal_id is the numeric game-engine ID used in URLs.
        """
        char_list = self.get_character_list()
        id_map: dict[str, str] = {}
        for c in char_list:
            eng_id = generate_id(c["name"])
            if eng_id in id_map:
                raise RuntimeError(
                    f"Duplicate english_id '{eng_id}' from names "
                    f"'{c['name']}' and a previous entry."
                )
            id_map[eng_id] = c["id"]
        print(f"Built ID map: {len(id_map)} characters")
        return id_map

    # -----------------------------------------------------------------------
    # Base stats (non-i18n)
    # -----------------------------------------------------------------------

    def get_base_stats(self, character_id: str) -> dict[str, dict[str, str]]:
        """Returns {"Lv90": {normalized_stats}, "Lv100": {normalized_stats}}."""
        page = self._page()

        # Switch to English for consistent stat keys
        self._switch_language("en")
        time.sleep(1)

        required_base = {"baseHp", "baseAtk", "baseDef"}

        def read_stats(level: int) -> dict[str, str]:
            slider_ok = page.evaluate(JS_SET_LEVEL_SLIDER, level)
            if not slider_ok:
                raise RuntimeError(
                    f"Level slider not found for Lv{level}. "
                    f"Check: #character-kit input[type='range'][max='100']"
                )
            time.sleep(0.5)
            raw: dict[str, str] = page.evaluate(JS_GET_BASE_STATS)
            if not raw:
                raise RuntimeError(
                    f"No stats found at Lv{level}. "
                    f"Check: #character-kit > children[0] .grid.grid-cols-2"
                )
            # Last row is always lore/mechanic (Vision, Moon Wheel, etc.)
            raw.popitem()
            result: dict[str, str] = {}
            for key, value in raw.items():
                if key in STAT_KEY_MAP:
                    result[STAT_KEY_MAP[key]] = value
                elif key not in IGNORED_STAT_KEYS:
                    print(
                        f"  WARNING: Unknown stat key '{key}' at Lv{level}. "
                        f"Add to STAT_KEY_MAP or IGNORED_STAT_KEYS."
                    )
            # Verify required base stats are present
            missing = required_base - result.keys()
            if missing:
                raise RuntimeError(
                    f"Missing base stats at Lv{level}: {missing}. Raw keys: {list(raw.keys())}"
                )
            return result

        return {"Lv90": read_stats(90), "Lv100": read_stats(100)}

    # -----------------------------------------------------------------------
    # Kit data (per language)
    # -----------------------------------------------------------------------

    def get_kit_section_ids(self) -> dict[str, list[str]]:
        result: dict[str, list[str]] | None = self._page().evaluate(
            JS_FIND_SECTION_IDS,
        )
        if not result:
            raise RuntimeError("#character-kit not found. Page structure may have changed.")
        # Validate expected counts
        skill_count = len(result["skills"])
        if skill_count not in (3, 4):
            raise RuntimeError(
                f"Expected 3-4 skills, got {skill_count}: "
                f"{result['skills']}. Check: S{{digits}} ID pattern."
            )
        if len(result["passives"]) < 3:
            raise RuntimeError(
                f"Expected >= 3 passives, got {len(result['passives'])}: "
                f"{result['passives']}. Check: P{{digits}} ID pattern."
            )
        if len(result["constellations"]) != 6:
            raise RuntimeError(
                f"Expected 6 constellations, got "
                f"{len(result['constellations'])}: "
                f"{result['constellations']}. Check: T{{digits}} ID pattern."
            )
        return result

    def _extract_section(
        self,
        section_id: str,
    ) -> dict[str, str] | None:
        """Extract name + descHtml from a kit section.

        Returns None if the section has an empty name (e.g. Raiden
        Shogun's placeholder 'cannot cook' passive).
        """
        data: dict[str, str] | None = self._page().evaluate(
            JS_GET_SECTION_DATA,
            section_id,
        )
        if not data:
            raise RuntimeError(
                f"Section {section_id} not found in DOM. "
                f"Check: document.getElementById('{section_id}')"
            )
        if not data.get("name"):
            return None
        if not data.get("descHtml"):
            raise RuntimeError(
                f"Empty description for section {section_id}. Check: .text-sm.font-normal selector."
            )
        return data

    def _extract_skill_table(
        self,
        skill_id: str,
        level: int,
    ) -> list[list[str]]:
        slider_ok = self._page().evaluate(
            JS_SET_SKILL_LEVEL,
            [skill_id, level],
        )
        if not slider_ok:
            raise RuntimeError(
                f"Skill slider not found for {skill_id}. "
                f"Check: input[type='range'] within #{skill_id}"
            )
        time.sleep(0.3)
        table: list[list[str]] = self._page().evaluate(
            JS_GET_SKILL_TABLE,
            skill_id,
        )
        if not table:
            raise RuntimeError(
                f"Empty skill table for {skill_id} at Lv{level}. "
                f"Check: .grid.grid-cols-1 > .grid.grid-cols-2 "
                f"within #{skill_id}"
            )
        return table

    def scrape_character_kit(self, character_id: str, lang: str) -> dict:
        """Scrape skills/passives/constellations for one character in one language."""
        page = self._page()

        # Navigate and switch language
        current_url = page.url
        if character_id not in current_url:
            self._navigate(f"{self.base_url}/character/{character_id}")
        self._switch_language(lang)
        time.sleep(1)

        sections = self.get_kit_section_ids()
        merged_dict: dict[str, str] = {}

        def process_section(section_id: str) -> dict | None:
            raw = self._extract_section(section_id)
            if raw is None:
                return None
            desc_html, glossary = process_description_html(raw["descHtml"])
            # Merge glossary entries
            for kw, tooltip in glossary.items():
                if kw in merged_dict and merged_dict[kw] != tooltip:
                    raise ValueError(f"Inconsistent glossary for '{kw}' in {character_id}/{lang}")
                merged_dict[kw] = tooltip
            return {"name": raw["name"], "descHtml": desc_html}

        # Skills (with tables merged into 4-column rows)
        # For characters with 4 skills (Ayaka, Mona), detect the
        # alternate sprint by checking for level-invariant detail values.
        skills = []
        alt_sprint_entry: dict | None = None
        for sid in sections["skills"]:
            entry = process_section(sid)
            assert entry is not None, f"Skill {sid} has empty name"
            table_6 = self._extract_skill_table(sid, 6)
            table_10 = self._extract_skill_table(sid, 10)
            table_13 = self._extract_skill_table(sid, 13)
            if not (len(table_6) == len(table_10) == len(table_13)):
                raise RuntimeError(
                    f"Lv6/10/13 row count mismatch for {sid}: "
                    f"{len(table_6)}/{len(table_10)}/{len(table_13)}"
                )
            # Check if all values are identical across levels
            is_level_invariant = all(
                r6[1] == r10[1] == r13[1]
                for r6, r10, r13 in zip(table_6, table_10, table_13, strict=True)
            )
            if is_level_invariant and len(sections["skills"]) == 4:
                # Alternate sprint: treat as passive, skip details
                alt_sprint_entry = entry
            else:
                # Merge: [label, lv6Value, lv10Value, lv13Value]
                entry["details"] = [
                    [r6[0], r6[1], r10[1], r13[1]]
                    for r6, r10, r13 in zip(table_6, table_10, table_13, strict=True)
                ]
                skills.append(entry)

        # Alt sprint (if any) goes first among passives
        passives: list[dict] = []
        if alt_sprint_entry:
            passives.append(alt_sprint_entry)

        # Regular passives
        # Raiden Shogun (10000052) has one placeholder passive with
        # an empty name ("cannot cook"). Allow skipping exactly 1.
        empty_passive_allowance = 1 if character_id == "10000052" else 0
        for pid in sections["passives"]:
            entry = process_section(pid)
            if entry is None:
                if empty_passive_allowance <= 0:
                    raise RuntimeError(
                        f"Empty name for passive {pid} of {character_id}. "
                        f"Check: .text-lg text node extraction."
                    )
                empty_passive_allowance -= 1
                continue
            passives.append(entry)

        # Constellations
        constellations = [process_section(cid) for cid in sections["constellations"]]

        # Convert glossary to list format matching other sections
        glossary_entries = (
            [{"name": kw, "descHtml": desc} for kw, desc in merged_dict.items()]
            if merged_dict
            else None
        )

        return {
            "skills": skills,
            "passives": passives,
            "constellations": constellations,
            "glossary": glossary_entries,
        }


def compact_json(data: object) -> str:
    """JSON with indent=2 but leaf arrays collapsed to single lines.

    A 'leaf array' is one whose elements are all strings (no nested
    objects or arrays).  This keeps detail rows like
    ["1-Hit DMG", "129.4%", "156.8%"] on one line instead of 5.
    """
    raw = json.dumps(data, indent=2, ensure_ascii=False)
    return re.sub(
        # Match arrays containing only quoted strings across multiple lines
        r'\[\s*\n\s+"(?:[^"\\]|\\.)*"'
        r'(?:\s*,\s*\n\s+"(?:[^"\\]|\\.)*")*\s*\n\s*\]',
        lambda m: (
            "[" + ", ".join(s.strip() for s in re.findall(r'"(?:[^"\\]|\\.)*"', m.group(0))) + "]"
        ),
        raw,
    )


def load_existing_kits() -> dict[str, dict[str, dict]]:
    """Load existing bundled kit files into {lang: {char_id: kit_data}}."""
    result: dict[str, dict[str, dict]] = {}
    for lang in LANGUAGES:
        kit_path = GAME_DATA_DIR / f"character_{lang}.json"
        if kit_path.exists():
            result[lang] = json.loads(kit_path.read_text(encoding="utf-8"))
        else:
            result[lang] = {}
    return result


def load_existing_stat_keys() -> set[str]:
    """Return set of character IDs already present in charStats.ts."""
    ts_path = DATA_DIR / "charStats.ts"
    if not ts_path.exists():
        return set()
    content = ts_path.read_text(encoding="utf-8")
    match = re.search(r"= (\{.*\});", content, re.DOTALL)
    if not match:
        return set()
    return set(json.loads(match.group(1)).keys())


def _load_character_names() -> dict[str, dict[str, str]]:
    """Load character names from i18n-game.ts: {char_id: {en: str, zh: str}}."""
    i18n_path = DATA_DIR / "i18n-game.ts"
    if not i18n_path.exists():
        return {}
    content = i18n_path.read_text(encoding="utf-8")
    match = re.search(
        r"export const i18nGameData(?::.*?)? = (.*?);\s*(?:export|$)",
        content,
        re.DOTALL,
    )
    if not match:
        return {}
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return {}
    return data.get("characters", {})


def save_character_kits(
    all_kits: dict[str, dict[str, dict]],
) -> None:
    """Write bundled kit files, upserting into existing data.

    Augments each kit with a 'name' field from i18n-game.ts so the
    character JSON files are self-contained.
    """
    existing = load_existing_kits()
    char_names = _load_character_names()

    for lang in LANGUAGES:
        existing[lang].update(all_kits.get(lang, {}))

        # Inject name as first field for each character
        for cid, kit in existing[lang].items():
            name = char_names.get(cid, {}).get(lang, "")
            if name:
                kit["name"] = name

        sorted_kits = dict(sorted(existing[lang].items()))
        # Ensure 'name' key comes first in each entry
        final: dict[str, dict] = {}
        for cid, kit in sorted_kits.items():
            if "name" in kit:
                final[cid] = {"name": kit.pop("name"), **kit}
            else:
                final[cid] = kit

        out_path = GAME_DATA_DIR / f"character_{lang}.json"
        out_path.write_text(compact_json(final), encoding="utf-8")


def save_char_stats_ts(
    all_stats: dict[str, dict[str, dict[str, str]]],
) -> None:
    """Write/upsert character base stats into src/data/charStats.ts."""
    ts_path = DATA_DIR / "charStats.ts"
    existing: dict[str, dict[str, dict[str, str]]] = {}
    if ts_path.exists():
        content = ts_path.read_text(encoding="utf-8")
        match = re.search(r"= (\{.*\});", content, re.DOTALL)
        if match:
            existing = json.loads(match.group(1))
    existing.update(all_stats)
    sorted_stats = dict(sorted(existing.items()))
    with open(ts_path, "w", encoding="utf-8") as f:
        f.write("// This file is auto-generated by scripts/hakushin.py\n")
        f.write("// Do not edit this file directly\n\n")
        f.write("import type { CharacterStats } from './types';\n\n")
        f.write("export const charStats: Record<string, CharacterStats> = ")
        f.write(json.dumps(sorted_stats, indent=2, ensure_ascii=False))
        f.write(";\n")


# ---------------------------------------------------------------------------
# High-level API (used by codedump.py)
# ---------------------------------------------------------------------------


def scrape_all_characters(
    scraper: HakushinScraper,
    *,
    incremental: bool = True,
    single_character: str | None = None,
) -> dict[str, dict[str, dict[str, str]]]:
    """Scrape all characters in two passes: EN (stats + kit) then ZH (kit).

    Two-pass design avoids mid-character language switching, which caused
    stats to be read with Chinese labels after a ZH kit scrape.

    Returns:
        Dict mapping english_id -> {"Lv90": {...}, "Lv100": {...}}
    """
    id_map = scraper.build_id_map()
    all_stats: dict[str, dict[str, dict[str, str]]] = {}

    if single_character:
        if single_character not in id_map:
            raise ValueError(
                f"Character '{single_character}' not found in ID map. "
                f"Available: {', '.join(sorted(id_map)[:10])}..."
            )
        targets = {single_character: id_map[single_character]}
    else:
        targets = id_map

    # For incremental mode, check what we already have
    existing_kits = load_existing_kits() if incremental else {}
    existing_stats = load_existing_stat_keys() if incremental else set()

    def _has_kit(eng_id: str, lang: str) -> bool:
        return eng_id in existing_kits.get(lang, {})

    def _log_kit(data: dict) -> None:
        dict_count = len(data["glossary"]) if data["glossary"] else 0
        print(
            f"    skills={len(data['skills'])} "
            f"passives={len(data['passives'])} "
            f"constellations={len(data['constellations'])} "
            f"dict={dict_count}"
        )

    total = len(targets)

    # --- Pass 1: EN stats + EN kit (site defaults to EN, no switch) ---
    print("\n=== Pass 1/2: EN (stats + kit) ===")
    for i, (eng_id, internal_id) in enumerate(targets.items()):
        has_stats = incremental and eng_id in existing_stats
        has_en_kit = incremental and _has_kit(eng_id, "en")
        if has_stats and has_en_kit:
            continue

        print(f"\n[{i + 1}/{total}] {eng_id} ({internal_id})")
        try:
            scraper._navigate(
                f"{scraper.base_url}/character/{internal_id}",
            )

            if not has_stats:
                stats = scraper.get_base_stats(internal_id)
                all_stats[eng_id] = stats
                print(f"  Stats: {stats['Lv90']}")
                save_char_stats_ts(all_stats)

            if not has_en_kit:
                print("  Kit (en)...")
                data = scraper.scrape_character_kit(internal_id, "en")
                save_character_kits({"en": {eng_id: data}})
                _log_kit(data)

        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback

            traceback.print_exc()

    # --- Pass 2: ZH kit only ---
    print("\n=== Pass 2/2: ZH (kit only) ===")
    for i, (eng_id, internal_id) in enumerate(targets.items()):
        if incremental and _has_kit(eng_id, "zh"):
            continue

        print(f"\n[{i + 1}/{total}] {eng_id} ({internal_id})")
        try:
            scraper._navigate(
                f"{scraper.base_url}/character/{internal_id}",
            )
            print("  Kit (zh)...")
            data = scraper.scrape_character_kit(internal_id, "zh")
            save_character_kits({"zh": {eng_id: data}})
            _log_kit(data)

        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback

            traceback.print_exc()

    return all_stats


# ---------------------------------------------------------------------------
# Standalone CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape character data from hakush.in",
    )
    parser.add_argument(
        "--character",
        type=str,
        help="Single english_id to scrape (e.g. varka)",
    )
    parser.add_argument("--headless", action="store_true", default=True)
    parser.add_argument("--no-headless", action="store_false", dest="headless")
    parser.add_argument("--list-only", action="store_true", help="Only list characters")
    parser.add_argument(
        "--no-incremental",
        action="store_true",
        help="Re-scrape all characters even if output files exist",
    )
    args = parser.parse_args()

    with HakushinScraper(headless=args.headless) as scraper:
        if args.list_only:
            id_map = scraper.build_id_map()
            for eng_id, internal_id in id_map.items():
                print(f"  {eng_id}: {internal_id}")
            return

        all_stats = scrape_all_characters(
            scraper,
            # --character implies non-incremental (always re-scrape target)
            incremental=not args.no_incremental and not args.character,
            single_character=args.character,
        )
        save_char_stats_ts(all_stats)

    print("\nDone!")


if __name__ == "__main__":
    main()
