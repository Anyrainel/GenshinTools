"""Audit exports must read source text from the current generated layout."""

import contextlib
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import impl_audit  # noqa: E402


class ImplAuditCatalogTests(unittest.TestCase):
    def test_released_ids_read_catalog_without_beta_merge(self):
        released = impl_audit._released_ids()
        self.assertIn("diluc", released["C"])
        self.assertIn("wolfs_gravestone", released["W"])
        self.assertIn("noblesse_oblige", released["A"])

    def test_character_export_contains_talent_text_and_parameters(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            impl_audit.cmd_show("C", "diluc")
        text = output.getvalue()
        self.assertIn("Searing Onslaught", text)
        self.assertIn("param1", text)
        self.assertIn("逆焰之刃", text)
        self.assertIn("diluc", impl_audit.get_char_stats())

    def test_weapon_export_contains_bilingual_effects(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            impl_audit.cmd_show("W", "wolfs_gravestone")
        text = output.getvalue()
        self.assertIn("ATK", text)
        self.assertIn("攻击力", text)
        self.assertIn("wolfs_gravestone", impl_audit.get_weapon_stats())

    def test_artifact_export_contains_both_set_bonuses(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            impl_audit.cmd_show("A", "noblesse_oblige")
        text = output.getvalue()
        self.assertIn("[2pc]", text)
        self.assertIn("[4pc]", text)
        self.assertIn("元素爆发", text)


if __name__ == "__main__":
    unittest.main()
