"""Wiki failures must reach the export pipeline instead of producing partial data."""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import fandom  # noqa: E402
from hoyolab import HoyolabScraper, download_image  # noqa: E402
from models import CharacterSource  # noqa: E402
from processing import match_items  # noqa: E402


class WikiFailureTests(unittest.TestCase):
    def test_navigation_failure_cannot_become_an_empty_catalog(self):
        scraper = HoyolabScraper()
        scraper.page = MagicMock()
        scraper.page.goto.side_effect = RuntimeError("connection failed")
        with self.assertRaisesRegex(RuntimeError, "Could not navigate") as caught:
            scraper.scrape_weapons()
        self.assertEqual(str(caught.exception.__cause__), "connection failed")

    def test_card_parse_failure_cannot_silently_drop_an_entity(self):
        scraper = HoyolabScraper()
        card = MagicMock()
        card.locator.side_effect = RuntimeError("page detached")
        with self.assertRaisesRegex(RuntimeError, "could not extract name"):
            scraper._extract_character_from_card(card, 3)

    def test_download_failure_does_not_return_success_or_false(self):
        with tempfile.TemporaryDirectory() as directory:
            asset = Path(directory) / "weapon.webp"
            with patch(
                "hoyolab.requests.get", side_effect=RuntimeError("HTTP failure")
            ):
                with self.assertRaisesRegex(RuntimeError, "Failed to download image"):
                    download_image("https://example.invalid/image.png", str(asset))
            self.assertFalse(asset.exists())

    def test_requested_details_cannot_become_empty_data_after_timeout(self):
        scraper = HoyolabScraper()
        page = MagicMock()
        page.wait_for_selector.side_effect = RuntimeError("timeout")
        with self.assertRaisesRegex(RuntimeError, "base-info-content"):
            scraper._scrape_weapon_detail_page(page)

    def test_entry_id_link_fallback_can_recover(self):
        scraper = HoyolabScraper()
        scraper.page = MagicMock()
        card = MagicMock()
        card.evaluate.side_effect = RuntimeError("no DOM href")
        popup = (
            scraper.page.context.expect_page.return_value.__enter__.return_value.value
        )
        popup.url = "https://wiki.hoyolab.com/pc/genshin/entry/123"
        self.assertEqual(scraper._get_entry_id_from_card(card), "123")
        popup.close.assert_called_once()

    def test_entry_id_fallback_failure_cannot_become_an_empty_id(self):
        scraper = HoyolabScraper()
        scraper.page = MagicMock()
        card = MagicMock()
        card.evaluate.return_value = None
        card.click.side_effect = RuntimeError("click failed")
        with self.assertRaisesRegex(RuntimeError, "Could not open wiki entry"):
            scraper._get_entry_id_from_card(card)

    def test_fandom_navigation_failure_is_reported_and_browser_closed(self):
        with patch("fandom.sync_playwright") as playwright:
            browser = playwright.return_value.__enter__.return_value.chromium.launch.return_value
            page = browser.new_context.return_value.new_page.return_value
            page.goto.side_effect = RuntimeError("site unavailable")
            with self.assertRaisesRegex(RuntimeError, "Error scraping Fandom"):
                fandom.get_character_data()
            browser.close.assert_called_once()

    def test_language_disagreement_cannot_write_contradictory_metadata(self):
        character = CharacterSource(
            entry_id="123",
            name="Furina",
            element="Hydro",
            rarity=5,
            image_url="image.png",
        )
        inconsistent = character.model_copy(update={"element": "Pyro"})
        with self.assertRaisesRegex(ValueError, "element/rarity mismatch"):
            match_items([character], [inconsistent])


if __name__ == "__main__":
    unittest.main()
