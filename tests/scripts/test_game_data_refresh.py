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
from generate_website_data import generate, validate_outputs, validate_stat_outputs  # noqa: E402
from refresh_game_data import refresh  # noqa: E402
from ts_reader import load_ts_data  # noqa: E402


class GameDataRefreshTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / "website"
        self.producer = Path(self.directory.name) / "producer"
        cli = self.producer / "src/hoyodata/cli.py"
        cli.parent.mkdir(parents=True)
        cli.touch()

    def test_export_failure_stops_before_scraping_or_mappings(self):
        with patch("refresh_game_data.subprocess.run") as process:
            process.return_value = subprocess.CompletedProcess([], 7)
            self.assertEqual(refresh(self.root, self.producer), 7)
        self.assertEqual(process.call_count, 1)
        command = process.call_args.args[0]
        self.assertIn("--pull", command)
        self.assertEqual(command[:4], ["uv", "run", "hoyodata", "genshintools"])
        self.assertIn(str(self.root), command)
        self.assertEqual(process.call_args.kwargs["cwd"], self.producer)

    def test_old_no_flag_command_redirects_to_single_refresh_entry_point(self):
        with (
            patch.object(sys, "argv", ["codedump.py"]),
            patch("refresh_game_data.refresh", return_value=7) as full_refresh,
        ):
            with self.assertRaises(SystemExit) as error:
                codedump.main()
        self.assertEqual(error.exception.code, 2)
        full_refresh.assert_not_called()

    def test_website_stage_generates_mappings_after_catalogs_and_metadata(self):
        with (
            patch("generate_website_data.subprocess.run") as process,
            patch("generate_website_data.validate_outputs") as validate,
        ):
            process.return_value = subprocess.CompletedProcess([], 0)
            self.assertEqual(generate(self.root), 0)
        commands = [call.args[0] for call in process.call_args_list]
        self.assertIn("--character", commands[0])
        self.assertTrue(commands[1][1].endswith("gen_char_info.py"))
        self.assertIn("--good-keys", commands[2])
        self.assertIn("--enka", commands[2])
        validate.assert_called_once_with(self.root)

    def test_dry_run_does_not_run_or_validate(self):
        with (
            patch("generate_website_data.subprocess.run") as process,
            patch("generate_website_data.validate_outputs") as validate,
        ):
            self.assertEqual(generate(self.root, dry_run=True), 0)
        process.assert_not_called()
        validate.assert_not_called()

    def test_scraping_failure_without_flags_aborts_before_writing_partial_data(self):
        with (
            patch.object(sys, "argv", ["codedump.py", "--weapon", "--good-keys"]),
            patch("codedump.load_existing_data", return_value=({}, {})),
            patch("codedump.HoyolabScraper") as scraper,
            patch("codedump.write_data") as write,
            patch("codedump.generate_scanner_mappings") as mappings,
        ):
            scraper.return_value.__enter__.return_value.scrape_weapons.side_effect = (
                RuntimeError("wiki navigation failed")
            )
            with self.assertRaisesRegex(RuntimeError, "wiki navigation failed"):
                codedump.main()
        write.assert_not_called()
        mappings.assert_not_called()

    def test_scraping_failure_exits_unsuccessfully_for_pipeline_callers(self):
        program = """
import sys
from unittest.mock import patch
sys.path.insert(0, sys.argv[1])
import codedump
sys.argv = ["codedump.py", "--weapon"]
with (
    patch("codedump.load_existing_data", return_value=({}, {})),
    patch("codedump.HoyolabScraper") as scraper,
    patch("codedump.write_data", side_effect=AssertionError("partial write attempted")),
):
    scraper.return_value.__enter__.return_value.scrape_weapons.side_effect = RuntimeError(
        "injected catalog failure"
    )
    codedump.main()
"""
        completed = subprocess.run(
            [sys.executable, "-c", program, str(Path(codedump.__file__).parent)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(completed.returncode, 0)
        self.assertTrue(
            completed.stderr.rstrip().endswith("RuntimeError: injected catalog failure")
        )

    def test_cached_refresh_delegates_to_same_target_without_pull(self):
        with patch("refresh_game_data.subprocess.run") as process:
            process.return_value = subprocess.CompletedProcess([], 0)
            self.assertEqual(refresh(self.root, self.producer, cached_sources=True), 0)
        command = process.call_args.args[0]
        self.assertIn("genshintools", command)
        self.assertIn("--cached-sources", command)
        self.assertNotIn("--pull", command)
        self.assertEqual(process.call_count, 1)

    def test_website_failure_does_not_validate_or_generate_later_outputs(self):
        with (
            patch("generate_website_data.subprocess.run") as process,
            patch("generate_website_data.validate_outputs") as validate,
        ):
            process.return_value = subprocess.CompletedProcess([], 8)
            self.assertEqual(generate(self.root), 8)
        self.assertEqual(process.call_count, 1)
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
        (good / "genshin_scanner_data.json").write_text(
            json.dumps(
                {"mappings": {"characters": [{"id": "Furina", "n": {"zh": "芙宁娜"}}]}}
            ),
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
        (self.root / "public/good/genshin_scanner_data.json").write_text(
            json.dumps({"capture": cache}), encoding="utf-8"
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

    def test_zero_or_nonfinite_stat_exports_cannot_pass_refresh_validation(self):
        game = self.root / "src/data/game"
        game.mkdir(parents=True)
        valid = {
            "character_stats.json": {
                "furina": {
                    "levels": {
                        "90": {"baseHp": "15307", "baseAtk": "244", "baseDef": "696"}
                    }
                }
            },
            "weapon_stats.json": {"weapon": {"levels": {"90": {"baseAtk": 542}}}},
            "artifact_stat.json": {
                "mainStats": {"rarity4": {"hp": [645]}, "rarity5": {"hp": [717]}}
            },
        }
        for filename, value in valid.items():
            (game / filename).write_text(json.dumps(value), encoding="utf-8")
        validate_stat_outputs(self.root)
        for filename, changed in (
            (
                "character_stats.json",
                {
                    "furina": {
                        "levels": {
                            "90": {"baseHp": "0", "baseAtk": "244", "baseDef": "696"}
                        }
                    }
                },
            ),
            (
                "weapon_stats.json",
                {"weapon": {"levels": {"90": {"baseAtk": float("nan")}}}},
            ),
            (
                "artifact_stat.json",
                {"mainStats": {"rarity4": {"hp": [0]}, "rarity5": {"hp": [717]}}},
            ),
        ):
            with self.subTest(filename=filename):
                (game / filename).write_text(json.dumps(changed), encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "Invalid"):
                    validate_stat_outputs(self.root)
                (game / filename).write_text(
                    json.dumps(valid[filename]), encoding="utf-8"
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
