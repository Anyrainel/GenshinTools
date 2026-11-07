"""Keep beta artifact identities stable as upstream translations become available."""

import contextlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import beta_files  # noqa: E402
import lunaris  # noqa: E402
from ts_reader import extract_json_from_ts  # noqa: E402


class LunarisArtifactIdentityTests(unittest.TestCase):
    def test_refresh_keeps_numeric_identity_when_english_name_arrives(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            contextlib.ExitStack() as stack,
        ):
            root = Path(directory)
            project_root = beta_files.PROJECT_ROOT
            for module in (beta_files, lunaris):
                for name, value in list(vars(module).items()):
                    if isinstance(value, Path) and value.is_relative_to(project_root):
                        stack.enter_context(
                            patch.object(
                                module, name, root / value.relative_to(project_root)
                            )
                        )
            beta_files.RESOURCES_PATH.parent.mkdir(parents=True)
            beta_files.RESOURCES_PATH.write_text(
                "export const characters = [];\n"
                "export const weapons = [];\n"
                "export const artifacts = [];\n",
                encoding="utf-8",
            )
            beta_files.I18N_BETA_PATH.parent.mkdir(parents=True)
            stack.enter_context(patch.object(sys, "argv", ["lunaris.py"]))

            def run_refresh(english_name):
                def fetch(url):
                    if url.endswith("version.json"):
                        return {"version": "7.2.50"}
                    if url.endswith(("charlist.json", "weaponlist.json")):
                        return {}
                    if url.endswith("artifactlist.json"):
                        return {
                            "15049": {
                                "enName": english_name,
                                "qualityType": "QUALITY_ORANGE",
                            }
                        }
                    return {
                        "info": {
                            "setName": english_name,
                            "qualityType": "QUALITY_ORANGE",
                            "setBonuses": {"2pc": "ATK +18%.", "4pc": "Another effect"},
                        }
                    }

                with patch.object(lunaris, "fetch_json", side_effect=fetch):
                    lunaris.main()
                return beta_files.load_json(beta_files.BETA_ARTIFACT_EN_PATH)

            first = run_refresh("肇史之遗")
            self.assertEqual(set(first), {"artifact_15049"})
            self.assertEqual(first["artifact_15049"]["id"], "15049")
            second = run_refresh("Legacy of History")
            self.assertEqual(set(second), {"artifact_15049"})
            self.assertEqual(second["artifact_15049"]["name"], "Legacy of History")
            resources = beta_files.RESOURCES_BETA_PATH.read_text(encoding="utf-8")
            self.assertIn('"id":"artifact_15049"', resources)
            self.assertNotIn("legacy_of_history", resources)
            self.assertEqual(
                extract_json_from_ts(resources, "betaArtifactHalfSets"),
                [{"id": "atk%-18", "setIds": ["artifact_15049"]}],
            )

    def test_existing_artifact_slug_survives_display_name_changes(self):
        payload = {
            "info": {
                "setName": "Updated English Name",
                "setBonuses": {"2pc": "Effect"},
            }
        }
        with patch.object(lunaris, "fetch_json", return_value=payload):
            artifact_id, *_ = lunaris.scrape_artifact(
                "15004", "7.2.50", "glacier_and_snowfield"
            )
        self.assertEqual(artifact_id, "glacier_and_snowfield")

    def test_missing_english_details_use_numeric_id_and_available_chinese_name(self):
        english = {"info": {"setName": "", "setBonuses": {"2pc": "Effect"}}}
        chinese = {"info": {"setName": "肇史之遗", "setBonuses": {"2pc": "效果"}}}
        with patch.object(lunaris, "fetch_json", side_effect=[english, chinese]):
            artifact_id, en_out, *_ = lunaris.scrape_artifact("15049", "7.2.50")
        self.assertEqual(artifact_id, "artifact_15049")
        self.assertEqual(en_out["name"], "肇史之遗")

    def test_missing_english_list_name_can_use_chinese_without_including_placeholders(
        self,
    ):
        entries = {
            "15049": {
                "enName": "",
                "chsName": "肇史之遗",
                "qualityType": "QUALITY_ORANGE",
            },
            "15050": {
                "enName": "???",
                "chsName": "???",
                "qualityType": "QUALITY_ORANGE",
            },
            "15051": {"enName": "", "chsName": "", "qualityType": "QUALITY_ORANGE"},
        }
        unreleased = lunaris.find_unreleased_artifacts(entries, set())
        self.assertEqual([numeric_id for numeric_id, *_ in unreleased], ["15049"])


class BetaArtifactHalfSetTests(unittest.TestCase):
    def setUp(self):
        self.released = [
            {"id": "atk%-18", "setIds": ["released_atk"]},
            {"id": "er-20", "setIds": ["released_er"]},
            {"id": "cryo%-15", "setIds": ["released_cryo"]},
        ]
        self.en = {
            "released_atk": {"effect2": "ATK +18%."},
            "released_er": {"effect2": "Energy Recharge +20%"},
            "released_cryo": {"effect2": "Cryo DMG Bonus +15%"},
        }
        self.zh = {
            "released_atk": {"effect2": "攻击力提高18%。"},
            "released_er": {"effect2": "元素充能效率提高20%。"},
            "released_cryo": {"effect2": "获得15%冰元素伤害加成。"},
        }

    def test_chinese_english_fields_and_existing_old_data_reuse_canonical_ids(self):
        en = self.en | {
            "future_atk": {"effect2": "攻击力提高18%。"},
            "other_atk": {"effect2": "ATK increased by 18%."},
            "future_er": {"effect2": "元素充能效率提高20%。"},
            "old_unobtainable": {"effect2": "Cryo DMG Bonus +15%"},
        }
        zh = self.zh | {
            "future_atk": {"effect2": "攻击力提高18%。"},
            "future_er": {"effect2": "元素充能效率提高20%。"},
        }
        groups = beta_files.derive_beta_artifact_half_sets(
            ["old_unobtainable", "future_atk", "other_atk", "future_er", "future_atk"],
            en,
            zh,
            self.released,
        )
        expected = [
            {"id": "cryo%-15", "setIds": ["old_unobtainable"]},
            {"id": "atk%-18", "setIds": ["future_atk", "other_atk"]},
            {"id": "er-20", "setIds": ["future_er"]},
        ]
        self.assertEqual([group.model_dump() for group in groups], expected)
        rendered = beta_files.generate_resources_beta_ts([], [], [], groups)
        self.assertEqual(
            extract_json_from_ts(rendered, "betaArtifactHalfSets"), expected
        )

    def test_chinese_source_wins_when_locales_disagree(self):
        groups = beta_files.derive_beta_artifact_half_sets(
            ["future"],
            self.en | {"future": {"effect2": "ATK +18%."}},
            self.zh | {"future": {"effect2": "元素充能效率提高20%。"}},
            self.released,
        )
        self.assertEqual(groups[0].id, "er-20")

    def test_unknown_or_missing_two_piece_effect_fails_loudly(self):
        for effect in ("CRIT DMG +99%", "", "ATK +18%."):
            with self.subTest(effect=effect):
                with self.assertRaisesRegex(
                    ValueError, "Unknown beta 2pc effect for future"
                ):
                    beta_files.derive_beta_artifact_half_sets(
                        ["future"],
                        self.en | {"future": {"effect2": effect}},
                        self.zh | {"future": {"effect2": "未知效果"}},
                        self.released,
                    )

    def test_cleanup_prunes_promoted_set_ids_without_leaving_empty_groups(self):
        groups = beta_files.derive_beta_artifact_half_sets(
            ["released_atk", "released_er", "released_cryo"],
            self.en,
            self.zh,
            self.released,
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "resources_beta.ts"
            path.write_text(
                beta_files.generate_resources_beta_ts(
                    [], [], [("released_atk", 5), ("released_er", 5)], groups
                ),
                encoding="utf-8",
            )
            with patch.object(beta_files, "RESOURCES_BETA_PATH", path):
                self.assertTrue(
                    beta_files._rewrite_resources_beta(set(), set(), {"released_atk"})
                )
            text = path.read_text(encoding="utf-8")
        self.assertEqual(
            extract_json_from_ts(text, "betaArtifactHalfSets"),
            [
                {"id": "er-20", "setIds": ["released_er"]},
                {"id": "cryo%-15", "setIds": ["released_cryo"]},
            ],
        )
        self.assertNotIn('"id":"released_atk"', text)


if __name__ == "__main__":
    unittest.main()
