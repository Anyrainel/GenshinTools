"""Exercise refresh ordering, stale-map rejection, and offline Enka generation."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import codedump  # noqa: E402
from enka import generate_stat_map, run  # noqa: E402
from refresh_game_data import refresh, validate_outputs  # noqa: E402
from ts_reader import load_ts_data  # noqa: E402


class GameDataRefreshTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / "website"
        self.producer = Path(self.directory.name) / "producer"
        cli = self.producer / "src/anime_game_data/cli.py"
        cli.parent.mkdir(parents=True)
        cli.touch()

    def test_export_failure_stops_before_scraping_or_mappings(self):
        with patch("refresh_game_data.subprocess.run") as process:
            process.return_value = subprocess.CompletedProcess([], 7)
            self.assertEqual(refresh(self.root, self.producer), 7)
        self.assertEqual(process.call_count, 1)
        command = process.call_args.args[0]
        self.assertIn("--pull", command)
        self.assertEqual(command[-2:], ["--website-root", str(self.root)])
        self.assertEqual(process.call_args.kwargs["cwd"], self.producer)

    def test_old_no_flag_command_calls_full_refresh(self):
        with (
            patch.object(sys, "argv", ["codedump.py"]),
            patch("refresh_game_data.refresh", return_value=7) as full_refresh,
        ):
            self.assertEqual(codedump.main(), 7)
        website = Path(codedump.__file__).resolve().parent.parent
        full_refresh.assert_called_once_with(website, website.parent / "HoyoData")

    def test_full_refresh_generates_mappings_after_source_and_metadata(self):
        with (
            patch("refresh_game_data.subprocess.run") as process,
            patch("refresh_game_data.validate_outputs") as validate,
        ):
            process.return_value = subprocess.CompletedProcess([], 0)
            self.assertEqual(refresh(self.root, self.producer, pull=False), 0)
        commands = [call.args[0] for call in process.call_args_list]
        self.assertNotIn("--pull", commands[0])
        self.assertIn("--strict", commands[1])
        self.assertTrue(commands[2][1].endswith("gen_char_info.py"))
        self.assertIn("--good-keys", commands[3])
        self.assertIn("--enka", commands[3])
        validate.assert_called_once_with(self.root)

    def test_dry_run_does_not_run_or_validate(self):
        with (
            patch("refresh_game_data.subprocess.run") as process,
            patch("refresh_game_data.validate_outputs") as validate,
        ):
            self.assertEqual(refresh(self.root, self.producer, dry_run=True), 0)
        process.assert_not_called()
        validate.assert_not_called()

    def test_missing_new_character_mapping_is_rejected(self):
        game = self.root / "src/data/game"
        good = self.root / "public/good"
        game.mkdir(parents=True)
        good.mkdir(parents=True)
        (game / "character_4_en.json").write_text("{}", encoding="utf-8")
        (game / "character_5_en.json").write_text(
            json.dumps({"furina": {"name": "Furina"}, "vesna": {"name": "Vesna"}}),
            encoding="utf-8",
        )
        (game / "weapon_stats.json").write_text("{}", encoding="utf-8")
        (good / "mappings.json").write_text(
            json.dumps({"characters": [{"id": "Furina", "n": {"zh": "芙宁娜"}}]}),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "missing GOOD mappings.*Vesna"):
            validate_outputs(self.root)

    def test_enka_uses_capture_stat_ids_and_writes_only_current_export(self):
        cache = {
            "property_map": {"10007": "EnergyRecharge", "10008": "ElementalMastery"},
            "affix_map": {"101221": {"property": "CritRate", "value": 0.0272}},
        }
        result = generate_stat_map(cache)
        self.assertEqual(result["10007"], "enerRech_")
        self.assertEqual(result["101221"], "critRate_")
        self.assertEqual(result["FIGHT_PROP_WIND_ADD_HURT"], "anemo_dmg_")
        (self.root / "public/good").mkdir(parents=True)
        (self.root / "src/data").mkdir(parents=True)
        (self.root / "public/good/data_cache.json").write_text(
            json.dumps(cache), encoding="utf-8"
        )
        run(self.root)
        output = (self.root / "src/data/enkaIdMap.ts").read_text("utf-8")
        self.assertIn("export const statIdMap", output)
        self.assertNotIn("characterIdMap", output)

    def test_incomplete_enka_cache_is_rejected(self):
        with self.assertRaises(ValueError):
            generate_stat_map({"property_map": {}, "affix_map": {}})
        with self.assertRaises(KeyError):
            generate_stat_map(
                {
                    "property_map": {"1": "UnknownStat"},
                    "affix_map": {"2": {"property": "Hp"}},
                }
            )

    def test_released_catalog_regeneration_does_not_promote_beta_entries(self):
        data = self.root / "src/data"
        data.mkdir(parents=True)
        (data / "resources.ts").write_text(
            'export const characters = [{"id":"furina"}];\n',
            encoding="utf-8",
        )
        (data / "resources_beta.ts").write_text(
            'export const betaCharacters = [{"id":"beta_character"}];\n',
            encoding="utf-8",
        )
        self.assertEqual(len(load_ts_data(self.root)["characters"]), 2)
        self.assertEqual(
            load_ts_data(self.root, include_beta=False)["characters"],
            [{"id": "furina"}],
        )


if __name__ == "__main__":
    unittest.main()
