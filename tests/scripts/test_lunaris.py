"""Keep valid bilingual beta data and stable identities during Lunaris refreshes."""

import contextlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import beta_files  # noqa: E402
import lunaris  # noqa: E402
from ts_reader import extract_json_from_ts  # noqa: E402


class LunarisWeaponLocaleTests(unittest.TestCase):
    @staticmethod
    def raw_weapon(name, descriptions):
        return {
            "name": name,
            "qualityType": "QUALITY_PURPLE",
            "weaponType": "WEAPON_CLAYMORE",
            "weaponIcon": "UI_EquipIcon_Claymore_NatlanEventVennessa",
            "stats": {"90": {"atk": 510, "Energy Recharge%": 45.9}},
            "passive": {
                "refinements": {
                    str(rank): {"description": descriptions.get(str(rank), "")}
                    for rank in range(1, 6)
                }
            },
        }

    @staticmethod
    def chinese_descriptions():
        return {
            str(rank): (
                "装备者处于后台累计5秒后，获得「断剑重铸」效果。\\n"
                f"「断剑重铸」效果：攻击力提升{atk}%。战斗中装备者登场时将对附近敌人"
                f"造成{damage}%攻击力的范围伤害。登场伤害每14秒至多触发一次。"
                "装备者在场上累计10秒后，将失去「断剑重铸」效果。"
            )
            for rank, (atk, damage) in enumerate(
                [(20, 280), (25, 350), (30, 420), (35, 490), (40, 560)], start=1
            )
        }

    def test_missing_english_effect_uses_exact_chinese_refinements_and_keeps_identity(
        self,
    ):
        english = self.raw_weapon("Blazing Lionfang", {})
        chinese = self.raw_weapon("炎烈狮牙", self.chinese_descriptions())
        with patch.object(lunaris, "fetch_json", side_effect=[english, chinese]):
            weapon_id, en_out, zh_out, stats, icon = lunaris.scrape_weapon(
                "12438", "7.2.50"
            )
        self.assertEqual(weapon_id, "blazing_lionfang")
        self.assertEqual(en_out["id"], "12438")
        self.assertEqual(en_out["name"], "Blazing Lionfang")
        self.assertEqual(zh_out["name"], "炎烈狮牙")
        self.assertEqual(en_out["descHtmlTpl"], zh_out["descHtmlTpl"])
        self.assertEqual(en_out["refinements"], zh_out["refinements"])
        self.assertEqual(
            en_out["refinements"],
            [
                [f"{atk}%", f"{damage}%"]
                for atk, damage in [
                    (20, 280),
                    (25, 350),
                    (30, 420),
                    (35, 490),
                    (40, 560),
                ]
            ],
        )
        for rank, row in enumerate(en_out["refinements"], start=1):
            rendered = en_out["descHtmlTpl"]
            for column, value in enumerate(row):
                rendered = rendered.replace(f"{{{column}}}", value)
            self.assertEqual(
                rendered, lunaris._format_desc(self.chinese_descriptions()[str(rank)])
            )
        self.assertEqual(stats["rarity"], 4)
        self.assertEqual(stats["type"], "Claymore")
        self.assertEqual(stats["secondaryStat"], "er")
        self.assertEqual(
            stats["levels"]["90"], {"baseAtk": 510, "secondaryStatValue": "45.9%"}
        )
        self.assertEqual(icon, "UI_EquipIcon_Claymore_NatlanEventVennessa")

    def test_partial_missing_english_refinement_uses_one_complete_chinese_locale(self):
        english = self.raw_weapon(
            "Blazing Lionfang",
            {str(rank): f"Gain {10 * rank}% ATK." for rank in range(2, 6)},
        )
        chinese = self.raw_weapon("炎烈狮牙", self.chinese_descriptions())
        with patch.object(lunaris, "fetch_json", side_effect=[english, chinese]):
            _, en_out, zh_out, *_ = lunaris.scrape_weapon("12438", "7.2.50")
        self.assertEqual(en_out["descHtmlTpl"], zh_out["descHtmlTpl"])
        self.assertEqual(en_out["refinements"], zh_out["refinements"])
        self.assertEqual(en_out["refinements"][0], ["20%", "280%"])
        self.assertEqual(en_out["refinements"][-1], ["40%", "560%"])

    def test_complete_english_refinements_keep_their_existing_text(self):
        english = self.raw_weapon(
            "Blazing Lionfang",
            {str(rank): f"Gain {10 * rank}% ATK." for rank in range(1, 6)},
        )
        chinese = self.raw_weapon("炎烈狮牙", self.chinese_descriptions())
        with patch.object(lunaris, "fetch_json", side_effect=[english, chinese]):
            _, en_out, zh_out, *_ = lunaris.scrape_weapon("12438", "7.2.50")
        self.assertEqual(en_out["descHtmlTpl"], "Gain {0} ATK.")
        self.assertNotEqual(en_out["descHtmlTpl"], zh_out["descHtmlTpl"])

    def test_refresh_keeps_either_valid_locale_and_skips_only_both_empty(self):
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
            weapons = {
                "12438": (
                    self.raw_weapon("Blazing Lionfang", {}),
                    self.raw_weapon("炎烈狮牙", self.chinese_descriptions()),
                ),
                "12439": (
                    self.raw_weapon("English Effect", {"1": "ATK +20%."}),
                    self.raw_weapon("英文有效", {}),
                ),
                "12440": (
                    self.raw_weapon("Empty Placeholder", {"1": "  "}),
                    self.raw_weapon("空白测试", {}),
                ),
            }

            def fetch(url):
                if url.endswith("version.json"):
                    return {"version": "7.2.50"}
                if url.endswith(("charlist.json", "artifactlist.json")):
                    return {"ignored": {}}
                if url.endswith("weaponlist.json"):
                    return {
                        numeric_id: {
                            "enName": en["name"],
                            "qualityType": "QUALITY_PURPLE",
                        }
                        for numeric_id, (en, _) in weapons.items()
                    }
                numeric_id = Path(url).stem
                return weapons[numeric_id][0 if "/en/" in url else 1]

            with (
                patch.object(lunaris, "fetch_json", side_effect=fetch),
                patch.object(lunaris, "download_icon") as download,
            ):
                lunaris.main()
            en_data = beta_files.load_json(beta_files.BETA_WEAPON_EN_PATH)
            zh_data = beta_files.load_json(beta_files.BETA_WEAPON_ZH_PATH)
            stats = beta_files.load_json(beta_files.BETA_WEAPON_STATS_PATH)
            self.assertEqual(set(en_data), {"blazing_lionfang", "english_effect"})
            self.assertEqual(en_data["blazing_lionfang"]["name"], "Blazing Lionfang")
            self.assertEqual(
                en_data["blazing_lionfang"]["descHtmlTpl"],
                zh_data["blazing_lionfang"]["descHtmlTpl"],
            )
            self.assertEqual(stats["blazing_lionfang"]["levels"]["90"]["baseAtk"], 510)
            resources = beta_files.RESOURCES_BETA_PATH.read_text(encoding="utf-8")
            self.assertEqual(
                {
                    weapon["id"]
                    for weapon in extract_json_from_ts(resources, "betaWeapons")
                },
                {"blazing_lionfang", "english_effect"},
            )
            self.assertNotIn("empty_placeholder", resources)
            self.assertEqual(download.call_count, 2)


class LunarisRefreshFailureTests(unittest.TestCase):
    def test_existing_artwork_refreshes_and_failed_download_preserves_old_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            icon = root / "existing.webp"
            icon.write_bytes(b"old artwork")
            response = Mock(content=b"updated artwork")
            with (
                patch.object(lunaris, "PROJECT_ROOT", root),
                patch.object(lunaris.requests, "get", return_value=response),
            ):
                lunaris.download_icon("https://example.com/art.webp", icon)
                self.assertEqual(icon.read_bytes(), b"updated artwork")
                response.raise_for_status.side_effect = lunaris.requests.HTTPError(
                    "404"
                )
                with self.assertRaises(lunaris.requests.HTTPError):
                    lunaris.download_icon("https://example.com/art.webp", icon)
                self.assertEqual(icon.read_bytes(), b"updated artwork")

    def test_empty_or_invalid_catalog_does_not_publish_an_empty_refresh(self):
        for invalid in ({}, [], "unavailable"):
            with (
                self.subTest(invalid=invalid),
                patch.object(sys, "argv", ["lunaris.py", "--version", "test"]),
                patch.object(lunaris, "cleanup_beta_files"),
                patch.object(lunaris, "fetch_json", return_value=invalid),
                patch.object(lunaris, "save_json_minified") as save,
                patch.object(lunaris, "find_unreleased_characters") as find,
            ):
                with self.assertRaisesRegex(
                    ValueError, "Empty or invalid characters catalog"
                ):
                    lunaris.main()
                save.assert_not_called()
                find.assert_not_called()

    def test_failed_detail_keeps_existing_bilingual_data_and_visibility(self):
        for kind in ("character", "weapon", "artifact"):
            with (
                self.subTest(kind=kind),
                tempfile.TemporaryDirectory() as directory,
                contextlib.ExitStack() as stack,
            ):
                root = Path(directory)
                project_root = beta_files.PROJECT_ROOT
                for module in (beta_files, lunaris):
                    for name, value in list(vars(module).items()):
                        if isinstance(value, Path) and value.is_relative_to(
                            project_root
                        ):
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
                snapshots = {}
                for name, path in vars(beta_files).items():
                    if name.startswith("BETA_") and isinstance(path, Path):
                        beta_files.save_json_minified(
                            path, {"existing": {"name": "Valid data"}}
                        )
                        snapshots[path] = path.read_bytes()
                for path in (beta_files.RESOURCES_BETA_PATH, beta_files.I18N_BETA_PATH):
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(
                        "// existing visibility and localized names\n", encoding="utf-8"
                    )
                    snapshots[path] = path.read_bytes()

                stack.enter_context(
                    patch.object(sys, "argv", ["lunaris.py", "--version", "test"])
                )
                stack.enter_context(
                    patch.object(lunaris, "fetch_json", return_value={"ignored": {}})
                )
                for entity_kind, plural in (
                    ("character", "characters"),
                    ("weapon", "weapons"),
                    ("artifact", "artifacts"),
                ):
                    entries = [("123", "existing", {})] if entity_kind == kind else []
                    stack.enter_context(
                        patch.object(
                            lunaris, f"find_unreleased_{plural}", return_value=entries
                        )
                    )
                stack.enter_context(
                    patch.object(
                        lunaris,
                        f"scrape_{kind}",
                        side_effect=ValueError("invalid detail"),
                    )
                )
                with self.assertRaisesRegex(
                    RuntimeError, f"{kind} 123: invalid detail"
                ):
                    lunaris.main()
                for path, before in snapshots.items():
                    self.assertEqual(path.read_bytes(), before, str(path))


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
                        return {"ignored": {}}
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
