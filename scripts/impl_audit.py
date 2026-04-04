# /// script
# requires-python = ">=3.10"
# ///
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Literal, TypedDict, cast

from ts_reader import load_ts_data

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DATA = SRC / "data"
IMPL_DIR = SRC / "lib/team-comp/impl"

GAME_DIR = DATA / "game"
CHAR_EN_PATHS = [GAME_DIR / "character_4_en.json", GAME_DIR / "character_5_en.json"]
CHAR_ZH_PATHS = [GAME_DIR / "character_4_zh.json", GAME_DIR / "character_5_zh.json"]
DATA_DIR = ROOT / "scripts" / "data"


Mode = Literal["C", "W", "A"]


class EntityMeta(TypedDict, total=False):
    id: str
    rarity: int
    element: str  # C
    weaponType: str  # C
    region: str  # C
    type: str  # W
    isHalfSet: bool  # A


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


_TEMPLATE_RE = re.compile(r"\{param(\d+):(F1P|F2P|F1|F2|P|I)\}")


def _trim_decimal(s: str) -> str:
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"


def _format_value(value: float, fmt: str) -> str:
    if fmt == "I":
        return str(round(value))
    if fmt == "F1":
        return _trim_decimal(f"{value:.1f}")
    if fmt == "F2":
        return _trim_decimal(f"{value:.2f}")
    if fmt == "P":
        return _trim_decimal(f"{value * 100:.0f}") + "%"
    if fmt == "F1P":
        return _trim_decimal(f"{value * 100:.1f}") + "%"
    if fmt == "F2P":
        return _trim_decimal(f"{value * 100:.2f}") + "%"
    return _trim_decimal(f"{value:.2f}")


def render_template(template: str, params: list[float]) -> str:
    def _repl(m: re.Match[str]) -> str:
        idx = int(m.group(1)) - 1
        if idx < 0 or idx >= len(params):
            return "0"
        return _format_value(params[idx], m.group(2))

    return _TEMPLATE_RE.sub(_repl, template)


_EXTRACTED_DATACache: dict[str, Any] | None = None
_CHAR_STATS_CACHE: dict[str, Any] | None = None
_WEAPON_STATS_CACHE: dict[str, Any] | None = None

CHAR_STATS_PATH = DATA / "game" / "character_stats.json"
WEAPON_STATS_PATH = DATA / "game" / "weapon_stats.json"


def get_extracted_data() -> dict[str, Any]:
    global _EXTRACTED_DATACache
    if _EXTRACTED_DATACache is None:
        _EXTRACTED_DATACache = load_ts_data(ROOT)
    return _EXTRACTED_DATACache


def get_char_stats() -> dict[str, Any]:
    global _CHAR_STATS_CACHE
    if _CHAR_STATS_CACHE is None:
        if CHAR_STATS_PATH.exists():
            _CHAR_STATS_CACHE = json.loads(CHAR_STATS_PATH.read_text("utf-8"))
        else:
            _CHAR_STATS_CACHE = {}
    return _CHAR_STATS_CACHE


def get_weapon_stats() -> dict[str, Any]:
    global _WEAPON_STATS_CACHE
    if _WEAPON_STATS_CACHE is None:
        if WEAPON_STATS_PATH.exists():
            _WEAPON_STATS_CACHE = json.loads(WEAPON_STATS_PATH.read_text("utf-8"))
        else:
            _WEAPON_STATS_CACHE = {}
    return _WEAPON_STATS_CACHE


def load_resources(mode: Mode) -> dict[str, EntityMeta]:
    data = get_extracted_data()
    result: dict[str, EntityMeta] = {}

    if mode == "C":
        char_stats = get_char_stats()
        for c in data.get("characters", []):
            meta: EntityMeta = cast(EntityMeta, dict(c))
            cid = c["id"]
            stats = char_stats.get(cid, {})
            if "element" in stats:
                meta["element"] = stats["element"]
            if "region" in stats:
                meta["region"] = stats["region"]
            if "weaponType" in stats:
                meta["weaponType"] = stats["weaponType"]
            result[cid] = meta
    elif mode == "W":
        weapon_stats = get_weapon_stats()
        for w in data.get("weapons", []):
            meta = cast(EntityMeta, dict(w))
            wid = w["id"]
            stats = weapon_stats.get(wid, {})
            if "type" in stats:
                meta["type"] = stats["type"]
            if "rarity" in stats:
                meta["rarity"] = stats["rarity"]
            result[wid] = meta
    elif mode == "A":
        for a in data.get("artifacts", []):
            result[a["id"]] = a
        for ah in data.get("artifactHalfSets", []):
            h_id = str(ah["id"])
            result[h_id] = cast(EntityMeta, {"id": h_id, "rarity": 5, "isHalfSet": True})
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


def _load_merged_char_kits() -> tuple[dict[str, Any], dict[str, Any]]:
    en_all: dict[str, Any] = {}
    zh_all: dict[str, Any] = {}
    for p in CHAR_EN_PATHS:
        if p.exists():
            en_all.update(json.loads(p.read_text("utf-8")))
    for p in CHAR_ZH_PATHS:
        if p.exists():
            zh_all.update(json.loads(p.read_text("utf-8")))
    return en_all, zh_all


def load_char_kits(char_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    en_all, zh_all = _load_merged_char_kits()
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
        if meta.get("isHalfSet"):
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

            # Also include the option const definition if the decorator references one.
            # Pattern: @RegisterXxx("id", optionVarName)
            opt_var_match = re.search(r'@Register\w+\("[^"]+",\s*(\w+)\)', lines[i])
            if opt_var_match:
                opt_var = opt_var_match.group(1)
                const_pat = re.compile(rf"\bconst\s+{re.escape(opt_var)}\b")
                for k in range(i - 1, -1, -1):
                    if const_pat.search(lines[k]):
                        start = k
                        break

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

            info: ImplInfo = {
                "filename": ts_file.name,
                "start_line": start + 1,
                "end_line": end + 1,
                "code": "\n".join(lines[start : end + 1]),
            }
            result[entity_id] = info

    return result


_SKIP_PASSIVE_KEYWORDS = [
    "小地图上显示",
    "深境螺旋中无效",
    "返还15%消耗的矿石",
    "无法与效果完全相同的固有天赋叠加",
    "探索派遣任务",
    "完美烹饪",
    "概率获得2倍产出",
    "返还部分合成材料",
    "夜魂传递",
    "不会惊动它们",
    "返还部分材料",
]

SKILL_SLOT = {"A": 0, "E": 1, "Q": 2}


def cmd_detail(char_id: str, detail_spec: str) -> None:
    """Print a single skill's detail table at a specific level to stdout."""
    m = re.fullmatch(r"([AEQ])(\d+)", detail_spec.upper())
    if not m:
        print(
            f"Invalid --detail format '{detail_spec}'. Expected e.g. E14, A11, Q13.",
            file=sys.stderr,
        )
        sys.exit(1)

    skill_code, level = m.group(1), int(m.group(2))
    if level < 1 or level > 15:
        print(f"Level {level} out of range (1–15).", file=sys.stderr)
        sys.exit(1)

    skill_idx = SKILL_SLOT[skill_code]
    en_kit, zh_kit = load_char_kits(char_id)
    en_skills = en_kit.get("skills", [])
    zh_skills = zh_kit.get("skills", [])

    if skill_idx >= len(en_skills):
        print(f"Skill '{skill_code}' not found for '{char_id}'.", file=sys.stderr)
        sys.exit(1)

    en_s = en_skills[skill_idx]
    zh_s = zh_skills[skill_idx] if skill_idx < len(zh_skills) else None
    name_en = en_s.get("name", "")
    name_zh = zh_s["name"] if zh_s else ""
    print(f"[{skill_code}] {name_en}  |  {name_zh}  —  Lv{level}")

    # New template format: [label, template]
    en_details = en_s.get("details") or []
    zh_details = (zh_s.get("details") or []) if zh_s else []

    # Load talent params for rendering
    char_stats = get_char_stats()
    talent_data = char_stats.get(char_id, {}).get("talent", {}).get(skill_code, [])
    level_params = talent_data[level - 1] if level - 1 < len(talent_data) else []

    for j, row in enumerate(en_details):
        if not row or len(row) < 2:
            continue
        en_name = row[0]
        template = row[1]
        zh_name = zh_details[j][0] if j < len(zh_details) and zh_details[j] else ""
        rendered = render_template(template, level_params)
        print(f"  {en_name} ({zh_name}): {rendered}")


def print_char_kit(
    en_kit: dict[str, Any], zh_kit: dict[str, Any], *, zh_only: bool = False
) -> None:
    en_skills = en_kit.get("skills", [])
    zh_skills = zh_kit.get("skills", [])
    tags = ["A", "E", "Q"]

    for i in range(len(en_skills)):
        en_s = en_skills[i]
        zh_s = zh_skills[i] if i < len(zh_skills) else None
        tag = tags[i] if i < len(tags) else f"S{i}"

        name_en = en_s.get("name", "")
        name_zh = zh_s["name"] if zh_s else ""
        if zh_only:
            print(f"\n[{tag}] {name_zh}")
        else:
            print(f"\n[{tag}] {name_en}  |  {name_zh}")
        if not zh_only:
            print(f"  EN: {strip_html(en_s.get('descHtml', ''))}")
        if zh_s:
            print(f"  ZH: {strip_html(zh_s.get('descHtml', ''))}")

        en_details = en_s.get("details") or []
        zh_details = (zh_s.get("details") or []) if zh_s else []
        for j, row in enumerate(en_details):
            if not row or len(row) < 2:
                continue
            template = row[1]
            zh_name = zh_details[j][0] if j < len(zh_details) and zh_details[j] else ""
            if zh_only:
                print(f"  {zh_name}: {template}")
            else:
                en_name = row[0]
                print(f"  {en_name} ({zh_name}): {template}")

    en_passives = en_kit.get("passives", [])
    zh_passives = zh_kit.get("passives", [])
    for i in range(len(en_passives)):
        en_p = en_passives[i]
        zh_p = zh_passives[i] if i < len(zh_passives) else None
        zh_desc = strip_html(zh_p.get("descHtml", "")) if zh_p else ""
        if any(kw in zh_desc for kw in _SKIP_PASSIVE_KEYWORDS):
            print(f"\n[P{i + 1}] (non-combat)")
            continue
        if zh_only:
            print(f"\n[P{i + 1}] {zh_p['name'] if zh_p else ''}")
        else:
            print(f"\n[P{i + 1}] {en_p.get('name', '')}  |  {zh_p['name'] if zh_p else ''}")
            print(f"  EN: {strip_html(en_p.get('descHtml', ''))}")
        if zh_p:
            print(f"  ZH: {zh_desc}")

    en_cons = en_kit.get("constellations", [])
    zh_cons = zh_kit.get("constellations", [])
    for i in range(len(en_cons)):
        en_c = en_cons[i]
        zh_c = zh_cons[i] if i < len(zh_cons) else None
        if zh_only:
            print(f"\n[C{i + 1}] {zh_c['name'] if zh_c else ''}")
        else:
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
            zh_entry = zh_by_desc.get(desc)
            if zh_only:
                names_zh = zh_entry["name"] if zh_entry else ""
                print(f"\n[G] {names_zh}")
            else:
                names_en = " / ".join(groups[desc])
                names_zh = zh_entry["name"] if zh_entry else ""
                print(f"\n[G] {names_en}  |  {names_zh}")
                print(f"  EN: {strip_html(desc)}")
            if zh_entry:
                print(f"  ZH: {strip_html(zh_entry.get('descHtml', ''))}")


def cmd_show(mode: Mode, entity_id: str, *, zh_only: bool = False) -> None:
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
        name_zh = i18n_data.get("zh", entity_id)
        if zh_only:
            print(f"  [CHAR] {entity_id}  |  {name_zh}")
        else:
            name_en = i18n_data.get("en", entity_id)
            print(f"  [CHAR] {entity_id}  |  {name_en}  |  {name_zh}")
        print(f"  {meta.get('rarity')}★ {meta.get('element')} - {meta.get('region')}")

        req_formulas = load_required_formulas()
        if entity_id in req_formulas:
            print("  [RUNBOOK] Required Formulas: (【...】express the precondition.)")
            print(f"    {req_formulas[entity_id]}")

        print("═" * 80)

        en_kit, zh_kit = load_char_kits(entity_id)
        print_char_kit(en_kit, zh_kit, zh_only=zh_only)

    elif mode == "W":
        name_zh = i18n_data.get("name", {}).get("zh", entity_id)
        if zh_only:
            print(f"  [WEAP] {entity_id}  |  {name_zh}")
        else:
            name_en = i18n_data.get("name", {}).get("en", entity_id)
            print(f"  [WEAP] {entity_id}  |  {name_en}  |  {name_zh}")
        print(f"  {meta.get('rarity')}★ {meta.get('type')}")
        print("═" * 80)

        # Read weapon effect from per-language game JSONs (new format: descHtmlTpl + refinements)
        game_dir = DATA / "game"
        effect_texts: dict[str, str] = {}
        for lang in ("en", "zh"):
            if zh_only and lang == "en":
                continue
            wp = game_dir / f"weapon_{lang}.json"
            if not wp.exists():
                effect_texts[lang] = ""
                continue
            game_weapons = json.loads(wp.read_text("utf-8"))
            entry = game_weapons.get(entity_id, {})
            tpl = entry.get("descHtmlTpl", "")
            refinements: list[list[str]] = entry.get("refinements", [])
            if tpl and refinements:
                param_count = len(refinements[0]) if refinements else 0

                def replace_ph(
                    m: re.Match[str], _refs: list[list[str]] = refinements, _pc: int = param_count
                ) -> str:
                    idx = int(m.group(1))
                    if idx >= _pc:
                        return m.group(0)
                    return "/".join(r[idx] for r in _refs)

                effect_texts[lang] = re.sub(r"\{(\d+)\}", replace_ph, tpl)
            else:
                effect_texts[lang] = tpl

        print("[Effect]")
        if not zh_only:
            print(f"  EN: {strip_html(effect_texts.get('en', ''))}")
        print(f"  ZH: {strip_html(effect_texts.get('zh', ''))}")

    elif mode == "A":
        if meta.get("isHalfSet"):
            print(f"  [ARTI] {entity_id}  |  HalfSet 2pc")
            print("═" * 80)
            print("[2pc]")
            if not zh_only:
                print(f"  EN: {strip_html(i18n_data.get('en', ''))}")
            print(f"  ZH: {strip_html(i18n_data.get('zh', ''))}")
        else:
            name_zh = i18n_data.get("zh", entity_id)
            if zh_only:
                print(f"  [ARTI] {entity_id}  |  {name_zh}")
            else:
                name_en = i18n_data.get("en", entity_id)
                print(f"  [ARTI] {entity_id}  |  {name_en}  |  {name_zh}")
            print(f"  {meta.get('rarity')}★")
            print("═" * 80)

            game_dir = DATA / "game"
            art_effects: dict[str, dict[str, str]] = {"en": {}, "zh": {}}
            for lang in ("en", "zh"):
                if zh_only and lang == "en":
                    continue
                ap = game_dir / f"artifact_{lang}.json"
                if ap.exists():
                    game_artifacts = json.loads(ap.read_text("utf-8"))
                    entry = game_artifacts.get(entity_id, {})
                    art_effects[lang] = {
                        "effect2": entry.get("effect2", ""),
                        "effect4": entry.get("effect4", ""),
                    }

            for pc, key in [(2, "effect2"), (4, "effect4")]:
                en_eff = art_effects["en"].get(key, "")
                zh_eff = art_effects["zh"].get(key, "")
                if en_eff or zh_eff:
                    print(f"[{pc}pc]")
                    if en_eff and not zh_only:
                        print(f"  EN: {strip_html(en_eff)}")
                    if zh_eff:
                        print(f"  ZH: {strip_html(zh_eff)}")

    if impl:
        n_lines = impl["end_line"] - impl["start_line"] + 1
        impl_path = f"src/lib/team-comp/impl/{impl['filename']}"
        print(f"{'─' * 50}")
        print(
            f"  IMPL found ({n_lines} lines): {impl_path} L{impl['start_line']}–L{impl['end_line']}"
        )
        print(f"  → Read this file at offset {impl['start_line']} limit {n_lines} to view the code")
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
            rarity = m.get("rarity", 0)
            if rarity <= 3:
                groups[f"{rarity}★"].append(m["id"])
            else:
                groups[f"{rarity}★ {m.get('type')}"].append(m["id"])

        for k in sorted(groups.keys()):
            print(f"== {k} ==")
            print(", ".join(sorted(groups[k])))

    elif mode == "A":
        groups = defaultdict(list)
        for _, m in resources.items():
            if m.get("isHalfSet"):
                groups["Half Sets (2pc only)"].append(m["id"])
            else:
                groups["Full Sets (4pc)"].append(m["id"])

        for k in sorted(groups.keys(), reverse=True):  # Full before Half
            print(f"== {k} ==")
            print(", ".join(sorted(groups[k])))


def fetch_check_results(
    mode: Mode,
) -> tuple[list[str], list[str], dict[str, EntityMeta]]:
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

    return misplaced, missing, resources


def _resolve_name(mode: Mode, eid: str, i18n: dict[str, Any]) -> str:
    entry = i18n.get(eid, {})
    if mode == "C":
        return entry.get("en", eid)
    elif mode == "W":
        return entry.get("name", {}).get("en", eid)
    elif mode == "A":
        if isinstance(entry, dict):
            return entry.get("en", eid)
        return str(entry) if entry else eid
    return eid


def _format_missing(mode: Mode, eid: str, meta: EntityMeta, i18n: dict[str, Any]) -> str:
    name = _resolve_name(mode, eid, i18n)
    rarity = meta.get("rarity", "?")
    if mode == "C":
        region = meta.get("region", "?")
        return f"{eid} ({name}) — {rarity}★ {region}"
    elif mode == "W":
        w_type = meta.get("type", "?")
        return f"{eid} ({name}) — {rarity}★ {w_type}"
    elif mode == "A":
        piece_type = "2pc" if meta.get("isHalfSet") else "4pc"
        return f"{eid} ({name}) — {piece_type}"
    return eid


def cmd_check(modes_to_test: list[Mode]) -> None:
    for mode in modes_to_test:
        mode_name = {"C": "Character", "W": "Weapon", "A": "Artifact"}[mode]
        print(f"=== [{mode}] {mode_name} Check ===")
        misplaced, missing, resources = fetch_check_results(mode)
        i18n = load_i18n_names(mode)

        if not misplaced and not missing:
            print("[OK]")
            continue

        if misplaced:
            print(f"[!] Misplaced ({len(misplaced)}):")
            for m in sorted(misplaced):
                print(f"  - {m}")

        if missing:
            print(f"[!] Missing ({len(missing)}):")

            if mode == "A":
                # Sort 2pc first, then 4pc; alphabetical within each group
                def _sort_key(eid: str, _res: dict[str, EntityMeta] = resources) -> tuple[int, str]:
                    meta = _res.get(eid, cast(EntityMeta, {"id": eid}))
                    return (0 if meta.get("isHalfSet") else 1, eid)

                for eid in sorted(missing, key=_sort_key):
                    meta = resources.get(eid, cast(EntityMeta, {"id": eid}))
                    print(f"    - {_format_missing(mode, eid, meta, i18n)}")
            else:
                # Group by rarity
                by_rarity: dict[int, list[str]] = defaultdict(list)
                for eid in missing:
                    meta = resources.get(eid, cast(EntityMeta, {"id": eid}))
                    rarity = meta.get("rarity", 0)
                    by_rarity[rarity].append(_format_missing(mode, eid, meta, i18n))
                for rarity in sorted(by_rarity.keys(), reverse=True):
                    items = by_rarity[rarity]
                    print(f"  [{rarity}★] ({len(items)})")
                    for item in sorted(items):
                        print(f"    - {item}")


EXCEL_EXTRACTED_DIR = ROOT / "docs" / "formulas" / "extracted"

# Element Chinese → file name mapping
_ELEMENT_FILE_MAP = {
    "pyro": "角色-火元素.md",
    "hydro": "角色-水元素.md",
    "anemo": "角色-风元素.md",
    "electro": "角色-雷元素.md",
    "dendro": "角色-草元素.md",
    "cryo": "角色-冰元素.md",
    "geo": "角色-岩元素.md",
}


def _parse_excel_char_from_md(zh_name: str) -> str | None:
    """Find a character's Excel extraction block from the pre-generated .md files.

    Searches all element .md files for a `### {zh_name}` header and returns
    everything from that header to the next `### ` header (or end of file).
    Returns None if not found.
    """
    for filename in _ELEMENT_FILE_MAP.values():
        filepath = EXCEL_EXTRACTED_DIR / filename
        if not filepath.exists():
            continue
        content = filepath.read_text(encoding="utf-8")
        # Find the header for this character
        marker = f"### {zh_name}\n"
        idx = content.find(marker)
        if idx == -1:
            continue
        # Find the next ### header (next character) or end of file
        next_header = content.find("\n### ", idx + len(marker))
        if next_header == -1:
            block = content[idx:]
        else:
            block = content[idx:next_header]
        return block.strip()
    return None


def _list_all_excel_chars() -> list[str]:
    """List all Chinese character names found in the extracted .md files."""
    names: list[str] = []
    for filename in _ELEMENT_FILE_MAP.values():
        filepath = EXCEL_EXTRACTED_DIR / filename
        if not filepath.exists():
            continue
        content = filepath.read_text(encoding="utf-8")
        for m in re.finditer(r"^### (.+)$", content, re.MULTILINE):
            names.append(m.group(1))
    return names


def _build_zh_to_id_map() -> dict[str, str]:
    """Build Chinese name → project ID mapping from i18n data."""
    i18n = load_i18n_names("C")
    zh_to_id: dict[str, str] = {}
    for eid, entry in i18n.items():
        zh = entry.get("zh", "")
        if zh:
            zh_to_id[zh] = eid
    return zh_to_id


def cmd_excel(entity_id: str) -> None:
    """Print the Excel VBA damage logic extraction for a character."""
    i18n = load_i18n_names("C")
    i18n_entry = i18n.get(entity_id, {})
    zh_name = i18n_entry.get("zh")

    if not zh_name:
        print(f"No Chinese name found for '{entity_id}'.", file=sys.stderr)
        all_names = _list_all_excel_chars()
        if entity_id in all_names:
            print(f"Hint: '{entity_id}' exists as a Chinese name in Excel.", file=sys.stderr)
            print("Use --list to find the project ID.", file=sys.stderr)
        return

    block = _parse_excel_char_from_md(zh_name)

    if not block:
        en_name = i18n_entry.get("en", entity_id)
        print(
            f"'{zh_name}' ({en_name} / {entity_id}) not found in Excel extractions.",
            file=sys.stderr,
        )
        all_names = _list_all_excel_chars()
        partial = [n for n in all_names if zh_name[0] in n or n[0] in zh_name]
        if partial:
            print(f"Similar: {', '.join(partial[:5])}", file=sys.stderr)
        return

    print(block)


def cmd_excel_list() -> None:
    """List all Excel characters with matched project IDs."""
    all_names = _list_all_excel_chars()
    zh_to_id = _build_zh_to_id_map()

    matched = []
    unmatched_excel = []

    for zh_name in sorted(all_names):
        pid = zh_to_id.get(zh_name)
        if pid:
            matched.append((zh_name, pid))
        else:
            unmatched_excel.append(zh_name)

    print(f"=== Matched ({len(matched)}) ===")
    for zh, pid in matched:
        print(f"  {pid:<30s} ← {zh}")

    if unmatched_excel:
        print(f"\n=== In Excel but not in project ({len(unmatched_excel)}) ===")
        for zh in unmatched_excel:
            print(f"  {zh}")

    i18n = load_i18n_names("C")
    all_project_ids = set(i18n.keys())
    matched_ids = {pid for _, pid in matched}
    missing_from_excel = all_project_ids - matched_ids
    if missing_from_excel:
        print(f"\n=== In project but not in Excel ({len(missing_from_excel)}) ===")
        for pid in sorted(missing_from_excel):
            zh = i18n[pid].get("zh", "")
            print(f"  {pid:<30s}   {zh}")


USAGE = """\\
Unified Audit & Implementation Script
──────────────────────────────────────
Tools for auditing Characters (C), Weapons (W), and Artifacts (A).

Usage:
  uv run tools/impl_audit.py <command> <mode> [args]

Commands:
  show <C|W|A> <id>   Show full i18n description + TS implementation code.
                        Dumps output to scripts/data/<id>.txt
    --detail=<XN>       Instead of dumping, print skill X at level N to stdout.
                        X = A/E/Q, N = 6–15. Example: --detail=E14, --detail=A11
  showzh <C|W|A> <id>  Like show, but Chinese-only (no English text). Saves tokens.
                        Dumps output to scripts/data/<id>.txt
  list <C|W|A>        List all registered IDs grouped by categories.
  check [C|W|A]       Find missing and misplaced implementations.
                        If no mode is provided, checks all modes.
  excel C <id>        Print Excel VBA damage logic for a character (to stdout).
  excel C --list      List all Excel characters with matched project IDs.
"""


def main() -> None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument(
        "command", nargs="?", choices=["show", "showzh", "list", "check", "excel", "help"]
    )
    parser.add_argument("args", nargs=argparse.REMAINDER)

    parsed = parser.parse_args()

    if not parsed.command or parsed.command == "help":
        print(USAGE)
        sys.exit(0)

    cmd = parsed.command
    args = parsed.args

    try:
        if cmd == "show":
            detail_spec: str | None = None
            filtered: list[str] = []
            for a in args:
                if a.startswith("--detail="):
                    detail_spec = a[len("--detail=") :]
                else:
                    filtered.append(a)
            args = filtered

            if len(args) < 2:
                print("Usage: impl_audit.py show <C|W|A> <id> [--detail=<skill><level>]")
                sys.exit(1)
            mode_str = args[0].upper()
            eid = args[1]
            if mode_str not in ("C", "W", "A"):
                print("Invalid mode. Use C, W, or A.")
                sys.exit(1)
            mode = cast(Mode, mode_str)

            if detail_spec:
                if mode != "C":
                    print("--detail is only supported for mode C.", file=sys.stderr)
                    sys.exit(1)
                cmd_detail(eid, detail_spec)
            else:
                DATA_DIR.mkdir(parents=True, exist_ok=True)
                output_file = DATA_DIR / f"{eid}.txt"
                with FileWriter(output_file):
                    cmd_show(mode, eid)
                print(f"Output saved to {output_file}")

        elif cmd == "showzh":
            if len(args) < 2:
                print("Usage: impl_audit.py showzh <C|W|A> <id>")
                sys.exit(1)
            mode_str = args[0].upper()
            eid = args[1]
            if mode_str not in ("C", "W", "A"):
                print("Invalid mode. Use C, W, or A.")
                sys.exit(1)
            mode = cast(Mode, mode_str)
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            output_file = DATA_DIR / f"{eid}.txt"
            with FileWriter(output_file):
                cmd_show(mode, eid, zh_only=True)
            print(f"Output saved to {output_file}")

        elif cmd == "list":
            if not args:
                print("Usage: impl_audit.py list <C|W|A>")
                sys.exit(1)
            mode = args[0].upper()
            if mode not in ["C", "W", "A"]:
                sys.exit(1)
            cmd_list(mode)

        elif cmd == "excel":
            if not args or args[0].upper() != "C":
                print("Usage: impl_audit.py excel C <id>")
                print("       impl_audit.py excel C --list")
                sys.exit(1)
            if len(args) < 2:
                print("Usage: impl_audit.py excel C <id>")
                sys.exit(1)
            if args[1] == "--list":
                cmd_excel_list()
            else:
                cmd_excel(args[1])

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
