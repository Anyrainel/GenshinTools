"""Keep released characters visible when upstream region metadata lags."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from models import CharacterSource  # noqa: E402
from processing import enrich_character_data_with_fandom  # noqa: E402


class CharacterRegionTests(unittest.TestCase):
    def setUp(self):
        self.character = CharacterSource(
            entry_id="1", name="Vesna", element="Anemo", rarity=5, image_url=""
        )
        self.source = {
            "name": "Vesna",
            "element": "Anemo",
            "imageUrl": "",
            "rarity": 5,
            "weaponType": "Sword",
            "region": "None",
            "releaseDate": "2026-09-22",
        }

    def test_matched_character_with_missing_region_uses_release_override(self):
        enriched = enrich_character_data_with_fandom(
            [self.character], {("Anemo", 5, "Vesna"): self.source}, {}
        )[0]
        self.assertEqual(enriched.region, "Snezhnaya")
        self.assertEqual(enriched.release_date, "2026-09-22")

    def test_fallback_repairs_previously_scraped_unknown_region(self):
        enriched = enrich_character_data_with_fandom(
            [self.character], {}, {"vesna": self.source}
        )[0]
        self.assertEqual(enriched.region, "Snezhnaya")

    def test_concrete_upstream_region_is_preserved(self):
        enriched = enrich_character_data_with_fandom(
            [self.character],
            {("Anemo", 5, "Vesna"): {**self.source, "region": "Mondstadt"}},
            {},
        )[0]
        self.assertEqual(enriched.region, "Mondstadt")


if __name__ == "__main__":
    unittest.main()
