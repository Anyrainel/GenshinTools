import tempfile
import unittest
from pathlib import Path

from scripts.refresh_game_data import normalize_export_layout


class ReferenceLayoutTests(unittest.TestCase):
    def test_upstream_exports_keep_new_owners_and_canonical_types(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "src" / "data"
            data.mkdir(parents=True)
            for name in ("i18n-game.ts", "i18n-beta.ts"):
                (data / name).write_text("export const names = {};", encoding="utf-8")
            for name in ("resources.ts", "resources_beta.ts", "charInfo.ts"):
                (data / name).write_text(
                    'import type { Model } from "./types";\n', encoding="utf-8"
                )
            game = data / "game"
            game.mkdir()
            (game / "character_stats.json").write_text('{"a": 1}', encoding="utf-8")
            (data / "enkaIdMap.ts").write_text("export const statIdMap = {};", encoding="utf-8")
            normalize_export_layout(root)
            self.assertFalse(data.exists())
            catalog = root / "src" / "generated" / "catalog"
            self.assertEqual((catalog / "character_stats.json").read_text(), '{"a": 1}')
            self.assertTrue((catalog / "enkaIdMap.ts").is_file())
            for name in ("i18n-game.ts", "i18n-beta.ts"):
                self.assertFalse((data / name).exists())
                self.assertEqual(
                    (root / "src" / "generated" / "translations" / name).read_text(),
                    "export const names = {};",
                )
            for name in ("resources.ts", "resources_beta.ts", "characterInfo.ts"):
                self.assertIn('from "../../domain/models"', (catalog / name).read_text())
            before = (catalog / "resources.ts").stat().st_mtime_ns
            normalize_export_layout(root)
            self.assertEqual((catalog / "resources.ts").stat().st_mtime_ns, before)


if __name__ == "__main__":
    unittest.main()
