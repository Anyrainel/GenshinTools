# /// script
# requires-python = ">=3.10"
# ///
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Literal, TypedDict

from ts_reader import load_ts_data

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DATA = SRC / "data"
IMPL_DIR = SRC / "lib/team-comp/impl"

EN_JSON = DATA / "character_en.json"
ZH_JSON = DATA / "character_zh.json"
OUTPUT_FILE = ROOT / "scripts/.impl_audit_output.txt"


Mode = Literal["C", "W", "A"]


class EntityMeta(TypedDict, total=False):
    id: str
    rarity: int
    element: str  # C
    weaponType: str  # C
    region: str  # C
    type: str  # W


class ImplInfo(TypedDict):
    filename: str
    start_line: int
    end_line: int
    code: str


class FileWriter:
    """Redirects stdout to a file only (no terminal output)."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.file = path.open("w", encoding="utf-8")
        self.stdout = sys.stdout

    def write(self, data: str) -> None:
        self.file.write(data)

    def flush(self) -> None:
        self.file.flush()

    def __enter__(self) -> "FileWriter":
        sys.stdout = self
        return self

    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        sys.stdout = self.stdout
        self.file.close()


def strip_html(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


_EXTRACTED_DATACache: dict[str, Any] | None = None


def get_extracted_data() -> dict[str, Any]:
    global _EXTRACTED_DATACache
    if _EXTRACTED_DATACache is None:
        _EXTRACTED_DATACache = load_ts_data(ROOT)
    return _EXTRACTED_DATACache


def load_resources(mode: Mode) -> dict[str, EntityMeta]:
    data = get_extracted_data()
    result: dict[str, EntityMeta] = {}

    if mode == "C":
        for c in data.get("characters", []):
            result[c["id"]] = c
    elif mode == "W":
        for w in data.get("weapons", []):
            result[w["id"]] = w
    elif mode == "A":
        for a in data.get("artifacts", []):
            result[a["id"]] = a
        for ah in data.get("artifactHalfSets", []):
            # Half sets use a numeric string ID
            h_id = str(ah["id"])
            result[h_id] = {"id": h_id, "rarity": 5}  # Dummy rarity
    return result


def load_i18n_names(mode: Mode) -> dict[str, Any]:
    data = get_extracted_data()
    i18n = data.get("i18nGameData", {})
    if mode == "C":
        return i18n.get("characters", {})
    elif mode == "W":
        return i18n.get("weapons", {})
    elif mode == "A":
        arts: dict[str, Any] = {}
        raw_arts = i18n.get("artifacts", {})
        for k, v in raw_arts.items():
            arts[k] = v
        raw_hs = i18n.get("artifactHalfSets", {})
        for k, v in raw_hs.items():
            arts[str(k)] = v
        return arts

    return {}


def load_char_kits(char_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    en_all = json.loads(EN_JSON.read_text("utf-8")) if EN_JSON.exists() else {}
    zh_all = json.loads(ZH_JSON.read_text("utf-8")) if ZH_JSON.exists() else {}
    return en_all.get(char_id, {}), zh_all.get(char_id, {})


def load_required_formulas() -> dict[str, str]:
    runbook_path = ROOT / "docs/DmgRunbook.md"
    if not runbook_path.exists():
        return {}
    formulas: dict[str, str] = {}
    content = runbook_path.read_text("utf-8")
    for line in content.splitlines():
        if line.startswith("- "):
            match = re.search(r"- .*?\((.*?)\):\s*(.*)", line)
            if match:
                formulas[match.group(1).strip()] = match.group(2).strip()
    return formulas


def expected_filename(meta: EntityMeta, mode: Mode) -> str:
    if mode == "C":
        rarity = meta.get("rarity", 0)
        region = meta.get("region", "None").replace("-", "")
        return f"character{rarity}{region}.ts"
    elif mode == "W":
        rarity = meta.get("rarity", 0)
        if rarity == 3:
            return "weapon3.ts"
        w_type = meta.get("type", "Unknown")
        return f"weapon{rarity}{w_type}.ts"
    elif mode == "A":
        eid = str(meta.get("id", ""))
        if eid.isdigit():
            return "artifact2pc.ts"
        else:
            return "artifact4pc.ts"
    return ""


def scan_impls(mode: Mode) -> dict[str, ImplInfo]:
    result: dict[str, ImplInfo] = {}

    if mode == "C":
        prefix = "character"
        pattern = re.compile(r'@RegisterCharacter\("([^"]+)"')
    elif mode == "W":
        prefix = "weapon"
        pattern = re.compile(r'@RegisterWeapon\("([^"]+)"')
    elif mode == "A":
        prefix = "artifact"
        pattern = re.compile(r'@RegisterArtifact(?:Half)?Set\("([^"]+)"')
    else:
        return result

    for ts_file in IMPL_DIR.glob(f"{prefix}*.ts"):
        lines = ts_file.read_text("utf-8").splitlines()
        for i, line in enumerate(lines):
            match = pattern.search(line)
            if not match:
                continue
            entity_id = match.group(1)

            start = i
            for k in range(i - 1, -1, -1):
                if lines[k].strip() == "":
                    break
                start = k

            depth = 0
            found_open = False
            end = i
            for j in range(i, len(lines)):
                for ch in lines[j]:
                    if ch == "{":
                        depth += 1
                        found_open = True
                    elif ch == "}":
                        depth -= 1
                if found_open and depth == 0:
                    end = j
                    break

            result[entity_id] = {
                "filename": ts_file.name,
                "start_line": start + 1,
                "end_line": end + 1,
                "code": "\n".join(lines[start : end + 1]),
            }

    return result


def print_char_kit(en_kit: dict[str, Any], zh_kit: dict[str, Any]) -> None:
    en_skills = en_kit.get("skills", [])
    zh_skills = zh_kit.get("skills", [])
    tags = ["A", "E", "Q"]
    for i in range(len(en_skills)):
        en_s = en_skills[i]
        zh_s = zh_skills[i] if i < len(zh_skills) else None
        tag = tags[i] if i < len(tags) else f"S{i}"

        name_en = en_s.get("name", "")
        name_zh = zh_s["name"] if zh_s else ""
        print(f"\n[{tag}] {name_en}  |  {name_zh}")
        print(f"  EN: {strip_html(en_s.get('descHtml', ''))}")
        if zh_s:
            print(f"  ZH: {strip_html(zh_s.get('descHtml', ''))}")

        en_details = en_s.get("details") or []
        zh_details = (zh_s.get("details") or []) if zh_s else []
        for j, row in enumerate(en_details):
            if not row:
                continue
            en_name = row[0]
            lv10 = row[2] if len(row) > 2 else "-"
            lv13 = row[3] if len(row) > 3 else "-"
            zh_name = zh_details[j][0] if j < len(zh_details) and zh_details[j] else ""
            print(f"  {en_name} ({zh_name}): {lv10} / {lv13}")

    en_passives = en_kit.get("passives", [])
    zh_passives = zh_kit.get("passives", [])
    for i in range(len(en_passives)):
        en_p = en_passives[i]
        zh_p = zh_passives[i] if i < len(zh_passives) else None
        print(f"\n[P{i + 1}] {en_p.get('name', '')}  |  {zh_p['name'] if zh_p else ''}")
        print(f"  EN: {strip_html(en_p.get('descHtml', ''))}")
        if zh_p:
            print(f"  ZH: {strip_html(zh_p.get('descHtml', ''))}")

    en_cons = en_kit.get("constellations", [])
    zh_cons = zh_kit.get("constellations", [])
    for i in range(len(en_cons)):
        en_c = en_cons[i]
        zh_c = zh_cons[i] if i < len(zh_cons) else None
        print(f"\n[C{i + 1}] {en_c.get('name', '')}  |  {zh_c['name'] if zh_c else ''}")
        print(f"  EN: {strip_html(en_c.get('descHtml', ''))}")
        if zh_c:
            print(f"  ZH: {strip_html(zh_c.get('descHtml', ''))}")

    en_glossary = en_kit.get("glossary", [])
    zh_glossary = zh_kit.get("glossary", [])
    if en_glossary:
        groups: dict[str, list[str]] = {}
        order: list[str] = []
        zh_by_desc: dict[str, Any] = {}
        for i, entry in enumerate(en_glossary):
            desc = entry.get("descHtml", "")
            if desc not in groups:
                groups[desc] = []
                order.append(desc)
                zh_by_desc[desc] = zh_glossary[i] if i < len(zh_glossary) else None
            groups[desc].append(entry.get("name", ""))

        for desc in order:
            names_en = " / ".join(groups[desc])
            zh_entry = zh_by_desc.get(desc)
            names_zh = zh_entry["name"] if zh_entry else ""
            print(f"\n[G] {names_en}  |  {names_zh}")
            print(f"  EN: {strip_html(desc)}")
            if zh_entry:
                print(f"  ZH: {strip_html(zh_entry.get('descHtml', ''))}")


def cmd_show(mode: Mode, entity_id: str) -> None:
    resources = load_resources(mode)
    i18n = load_i18n_names(mode)
    impls = scan_impls(mode)

    meta = resources.get(entity_id)
    if not meta:
        print(f"ID '{entity_id}' not found in resources.", file=sys.stderr)
        return

    i18n_data = i18n.get(entity_id, {})
    impl = impls.get(entity_id)

    print(f"{'═' * 80}")

    if mode == "C":
        name_en = i18n_data.get("en", entity_id)
        name_zh = i18n_data.get("zh", entity_id)
        print(f"  [CHAR] {entity_id}  |  {name_en}  |  {name_zh}")
        print(f"  {meta.get('rarity')}★ {meta.get('element')} - {meta.get('region')}")

        req_formulas = load_required_formulas()
        if entity_id in req_formulas:
            print("  [RUNBOOK] Required Formulas: (【...】express the precondition.)")
            print(f"    {req_formulas[entity_id]}")

        print("═" * 80)

        en_kit, zh_kit = load_char_kits(entity_id)
        print_char_kit(en_kit, zh_kit)

    elif mode == "W":
        name_en = i18n_data.get("name", {}).get("en", entity_id)
        name_zh = i18n_data.get("name", {}).get("zh", entity_id)
        print(f"  [WEAP] {entity_id}  |  {name_en}  |  {name_zh}")
        print(f"  {meta.get('rarity')}★ {meta.get('type')}")
        print("═" * 80)

        effect_en = i18n_data.get("effect", {}).get("en", "")
        effect_zh = i18n_data.get("effect", {}).get("zh", "")
        print("[Effect]")
        print(f"  EN: {strip_html(effect_en)}")
        print(f"  ZH: {strip_html(effect_zh)}")

    elif mode == "A":
        if entity_id.isdigit():
            print(f"  [ARTI] {entity_id}  |  HalfSet 2pc")
            print("═" * 80)
            print("[2pc]")
            print(f"  EN: {strip_html(i18n_data.get('en', ''))}")
            print(f"  ZH: {strip_html(i18n_data.get('zh', ''))}")
        else:
            name_en = i18n_data.get("name", {}).get("en", entity_id)
            name_zh = i18n_data.get("name", {}).get("zh", entity_id)
            print(f"  [ARTI] {entity_id}  |  {name_en}  |  {name_zh}")
            print(f"  {meta.get('rarity')}★")
            print("═" * 80)

            effs_en = i18n_data.get("effects", {}).get("en", [])
            effs_zh = i18n_data.get("effects", {}).get("zh", [])

            for i in range(len(effs_en)):
                print(f"[{((i + 1) * 2)}pc]")
                print(f"  EN: {strip_html(effs_en[i])}")
                if i < len(effs_zh):
                    print(f"  ZH: {strip_html(effs_zh[i])}")

    if impl:
        print(f"{'─' * 50}")
        print(f"  IMPL: {impl['filename']} L{impl['start_line']}–L{impl['end_line']}")
        print("─" * 50)
        print(impl["code"])
    else:
        print("  [No implementation found in TS]")


def cmd_list(mode: Mode) -> None:
    resources = load_resources(mode)

    if mode == "C":
        groups = defaultdict(list)
        for _, m in resources.items():
            groups[f"{m.get('rarity')}★ {m.get('region')}"].append(m["id"])

        for k in sorted(groups.keys()):
            print(f"== {k} ==")
            print(", ".join(sorted(groups[k])))

    elif mode == "W":
        groups = defaultdict(list)
        for _, m in resources.items():
            groups[f"{m.get('rarity')}★ {m.get('type')}"].append(m["id"])

        for k in sorted(groups.keys()):
            print(f"== {k} ==")
            print(", ".join(sorted(groups[k])))

    elif mode == "A":
        groups = defaultdict(list)
        for _, m in resources.items():
            if str(m["id"]).isdigit():
                groups["Half Sets (2pc only)"].append(m["id"])
            else:
                groups["Full Sets (4pc)"].append(m["id"])

        for k in sorted(groups.keys(), reverse=True):  # Full before Half
            print(f"== {k} ==")
            print(", ".join(sorted(groups[k])))


def fetch_check_results(mode: Mode) -> tuple[list[str], list[str]]:
    resources = load_resources(mode)
    impls = scan_impls(mode)

    misplaced: list[str] = []
    missing: list[str] = []

    for eid, meta in resources.items():
        if eid not in impls:
            missing.append(eid)
        else:
            actual = impls[eid]["filename"]
            expected = expected_filename(meta, mode)
            if actual != expected:
                misplaced.append(f"{eid}: found in {actual}, expected in {expected}")

    return misplaced, missing


def cmd_check(modes_to_test: list[Mode]) -> None:
    for mode in modes_to_test:
        print(f"=== [{mode}] Audit Check ===")
        misplaced, missing = fetch_check_results(mode)

        if misplaced:
            print(f"[!] Misplaced ({len(misplaced)}):")
            for m in sorted(misplaced):
                print(f"  - {m}")
        else:
            print("[OK] No misplaced implementations.")

        if missing:
            print(f"[!] Missing ({len(missing)}):")
            for m in sorted(missing):
                print(f"  - {m}")
        else:
            print("[OK] No missing implementations.")


USAGE = """\\
Unified Audit & Implementation Script
──────────────────────────────────────
Tools for auditing Characters (C), Weapons (W), and Artifacts (A).

Usage:
  uv run tools/impl_audit.py <command> <mode> [args]

Commands:
  show <C|W|A> <id>   Show full i18n description + TS implementation code.
                        Always dumps output to scripts/.impl_audit_output.txt
  list <C|W|A>        List all registered IDs grouped by categories.
  check [C|W|A]       Find missing and misplaced implementations.
                        If no mode is provided, checks all modes.
"""


def main() -> None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("command", nargs="?", choices=["show", "list", "check", "help"])
    parser.add_argument("args", nargs=argparse.REMAINDER)

    parsed = parser.parse_args()

    if not parsed.command or parsed.command == "help":
        print(USAGE)
        sys.exit(0)

    cmd = parsed.command
    args = parsed.args

    try:
        if cmd == "show":
            if len(args) < 2:
                print("Usage: impl_audit.py show <C|W|A> <id>")
                sys.exit(1)
            mode = args[0].upper()
            eid = args[1]
            if mode not in ["C", "W", "A"]:
                print("Invalid mode. Use C, W, or A.")
                sys.exit(1)

            with FileWriter(OUTPUT_FILE):
                cmd_show(mode, eid)
            print(f"Output saved to {OUTPUT_FILE}")

        elif cmd == "list":
            if not args:
                print("Usage: impl_audit.py list <C|W|A>")
                sys.exit(1)
            mode = args[0].upper()
            if mode not in ["C", "W", "A"]:
                sys.exit(1)
            cmd_list(mode)

        elif cmd == "check":
            modes: list[Mode] = ["C", "W", "A"]
            if args:
                m = args[0].upper()
                if m in modes:
                    modes = [m]
                else:
                    print("Invalid mode for check. Use C, W, A or leave empty.")
                    sys.exit(1)
            cmd_check(modes)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
