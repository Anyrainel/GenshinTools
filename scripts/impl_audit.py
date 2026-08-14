# /// script
# requires-python = ">=3.10"
# ///
import argparse
import difflib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Literal, TypedDict, cast

from beta_files import read_beta_json
from ts_reader import load_ts_data

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DATA = SRC / "data"
IMPL_DIR = SRC / "lib/dmgcalc/impl"

GAME_DIR = DATA / "game"
CHAR_EN_PATHS = [
    GAME_DIR / "character_4_en.json",
    GAME_DIR / "character_5_en.json",
    GAME_DIR / "character_beta_en.json.gz",
]
CHAR_ZH_PATHS = [
    GAME_DIR / "character_4_zh.json",
    GAME_DIR / "character_5_zh.json",
    GAME_DIR / "character_beta_zh.json.gz",
]
WEAPON_ZH_PATHS = [
    GAME_DIR / "weapon_zh.json",
    GAME_DIR / "weapon_beta_zh.json.gz",
]
ARTIFACT_ZH_PATHS = [
    GAME_DIR / "artifact_zh.json",
    GAME_DIR / "artifact_beta_zh.json.gz",
]
DATA_DIR = ROOT / "scripts" / "data"


def _load_game_json(path: Path) -> dict:
    """Read a JSON game-data file, transparently handling gzipped beta files."""
    if path.suffix == ".gz":
        return read_beta_json(path)
    return json.loads(path.read_text("utf-8"))


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
CHAR_BETA_STATS_PATH = DATA / "game" / "character_beta_stats.json.gz"
WEAPON_STATS_PATH = DATA / "game" / "weapon_stats.json"
WEAPON_BETA_STATS_PATH = DATA / "game" / "weapon_beta_stats.json.gz"


def get_extracted_data() -> dict[str, Any]:
    global _EXTRACTED_DATACache
    if _EXTRACTED_DATACache is None:
        _EXTRACTED_DATACache = load_ts_data(ROOT)
    return _EXTRACTED_DATACache


def get_char_stats() -> dict[str, Any]:
    global _CHAR_STATS_CACHE
    if _CHAR_STATS_CACHE is None:
        cache: dict[str, Any] = {}
        if CHAR_STATS_PATH.exists():
            cache = _load_game_json(CHAR_STATS_PATH)
        if CHAR_BETA_STATS_PATH.exists():
            for k, v in _load_game_json(CHAR_BETA_STATS_PATH).items():
                cache.setdefault(k, v)
        _CHAR_STATS_CACHE = cache
    return _CHAR_STATS_CACHE


def get_weapon_stats() -> dict[str, Any]:
    global _WEAPON_STATS_CACHE
    if _WEAPON_STATS_CACHE is None:
        cache: dict[str, Any] = {}
        if WEAPON_STATS_PATH.exists():
            cache = _load_game_json(WEAPON_STATS_PATH)
        if WEAPON_BETA_STATS_PATH.exists():
            for k, v in _load_game_json(WEAPON_BETA_STATS_PATH).items():
                cache.setdefault(k, v)
        _WEAPON_STATS_CACHE = cache
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
            # Official files come first; beta files come last — use setdefault
            # so official entries are never overwritten by beta duplicates
            for k, v in _load_game_json(p).items():
                en_all.setdefault(k, v)
    for p in CHAR_ZH_PATHS:
        if p.exists():
            for k, v in _load_game_json(p).items():
                zh_all.setdefault(k, v)
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


# Data-quality guards
#
# Beta data arrives before the game ships it, and it arrives incomplete or
# mis-parsed often enough that "the entry exists" is not the same as "the entry
# is implementable". These checks turn the two failure modes we have actually
# been bitten by into deterministic signals instead of tribal knowledge.

_WEAPON_TEXT_CACHE: dict[str, dict[str, Any]] = {}

# A refinement cell is supposed to hold a bare value like "16%", "3" or "4.5".
# A trailing period is tolerated: the scraper's number pattern swallows the one
# that ends the sentence, which is cosmetic rather than a misalignment.
_PLAIN_VALUE_RE = re.compile(r"(\d+(?:\.\d+)?)%?\.?")

# What the scraper writes into a column for a refinement whose text lacks the
# clause that column came from. No real weapon ships a zero refinement value, so
# a zero next to non-zero rows always means "this row was padded".
_PADDED_CELLS = frozenset({"0", "0%"})


def get_weapon_texts(lang: str) -> dict[str, Any]:
    """Merged weapon text entries for one language (released first, beta as fallback)."""
    cached = _WEAPON_TEXT_CACHE.get(lang)
    if cached is not None:
        return cached

    merged: dict[str, Any] = {}
    released = GAME_DIR / f"weapon_{lang}.json"
    if released.exists():
        for k, v in json.loads(released.read_text("utf-8")).items():
            merged.setdefault(k, v)
    beta = GAME_DIR / f"weapon_beta_{lang}.json.gz"
    if beta.exists():
        for k, v in _load_game_json(beta).items():
            merged.setdefault(k, v)

    _WEAPON_TEXT_CACHE[lang] = merged
    return merged


def char_talent_warnings(char_id: str) -> list[str]:
    """Report talent tables that carry levels but no parameters.

    A talent whose every level row is empty means the scrape landed the level
    grid without the values behind it. Any formula wired to those indices reads
    nothing and silently resolves to 0 damage, so the entity is not
    implementable yet no matter how complete its skill text looks.
    """
    talent = get_char_stats().get(char_id, {}).get("talent") or {}
    if not talent:
        return []
    empty = [
        key
        for key, levels in sorted(talent.items())
        if not levels or all(not row for row in levels)
    ]
    if not empty:
        return []
    return [f"NO TALENT DATA ({', '.join(empty)})"]


_PARAM_REF_RE = re.compile(r"\{param(\d+):")
_TALENT_SLOT_LABELS = ("A", "E", "Q")


def detail_row_label(row: Any) -> str:
    """Label of a detail row, in either the dict or legacy [label, tpl] shape."""
    if isinstance(row, dict):
        return row.get("label", "")
    return row[0] if row and len(row) >= 1 else ""


def detail_row_template(row: Any) -> str:
    """Template of a detail row, in either the dict or legacy [label, tpl] shape."""
    if isinstance(row, dict):
        return row.get("template", "")
    return row[1] if row and len(row) >= 2 else ""


def aligned_detail_template(en_row: Any, zh_row: Any) -> str:
    """The detail template that can actually address the talent array.

    Params are numbered per language and the array is scraped from ZH, so an EN
    row whose placeholders were dropped (see `char_detail_warnings`) carries
    only literal level-1 text and can never render the real values. Fall back
    to the ZH row in that case — it is the one the numbers came from.

    Retires per row as soon as EN ships the placeholders again: an EN template
    that addresses any param is always returned unchanged.
    """
    en_tpl = detail_row_template(en_row)
    zh_tpl = detail_row_template(zh_row) if zh_row else ""
    # No EN row at all (the two languages ship a different number of rows —
    # see `align_bilingual`); nothing to prefer it over.
    if not en_tpl:
        return zh_tpl
    if _PARAM_REF_RE.search(en_tpl) or not _PARAM_REF_RE.search(zh_tpl):
        return en_tpl
    return zh_tpl


_NUM_TOKEN_RE = re.compile(r"\d+(?:\.\d+)?")
_PARAM_SLOT_RE = re.compile(r"\{param\d+:[^}]*\}")


def _row_fingerprint(row: Any) -> tuple[str, ...]:
    """The numbers a kit row carries — the only part of it that survives translation.

    Param slots collapse to a sentinel because their index is numbered per
    language, and markup is stripped so the digits inside a colour span are not
    mistaken for values.
    """
    if row is None:
        return ()
    if isinstance(row, dict) and "descHtml" in row:
        text = strip_html(row["descHtml"])
    else:
        text = _PARAM_SLOT_RE.sub("\x00#", detail_row_template(row))
    return tuple(_NUM_TOKEN_RE.findall(text))


def align_bilingual(en_rows: list[Any], zh_rows: list[Any]) -> list[tuple[Any, Any]]:
    """Pair EN rows with their ZH counterparts, tolerating a row one side lacks.

    Pairing by index is right whenever both languages ship the same number of
    rows, which is every character but the few where one language carries an
    extra entry the other never got — raiden_shogun's ZH-only "暂缺" passive,
    vesna's ZH-only glossary term. One extra entry shifts every row after it,
    so index pairing would print EN text under an unrelated ZH name and drop
    the tail of the longer list entirely. When the counts disagree, align on
    the numbers each row carries instead and leave the surplus rows unpaired.

    Retires per character as soon as both languages ship the same rows: equal
    counts take the plain-zip path and never reach the alignment.
    """
    if len(en_rows) == len(zh_rows):
        return list(zip(en_rows, zh_rows, strict=True))

    en_keys = [_row_fingerprint(r) for r in en_rows]
    zh_keys = [_row_fingerprint(r) for r in zh_rows]
    pairs: list[tuple[Any, Any]] = []
    matcher = difflib.SequenceMatcher(a=en_keys, b=zh_keys, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ("equal", "replace"):
            # A `replace` block is rows that sit between the same anchors but
            # whose numbers differ; pair them positionally and let the surplus
            # fall through unpaired.
            span = min(i2 - i1, j2 - j1)
            pairs.extend(zip(en_rows[i1 : i1 + span], zh_rows[j1 : j1 + span], strict=True))
            pairs.extend((row, None) for row in en_rows[i1 + span : i2])
            pairs.extend((None, row) for row in zh_rows[j1 + span : j2])
        elif tag == "delete":
            pairs.extend((row, None) for row in en_rows[i1:i2])
        else:  # insert
            pairs.extend((None, row) for row in zh_rows[j1:j2])
    return pairs


def _detail_params(skill: dict[str, Any]) -> set[int]:
    """The 1-based param indices a skill's detail templates address."""
    indices: set[int] = set()
    for row in skill.get("details") or []:
        indices.update(int(m) for m in _PARAM_REF_RE.findall(detail_row_template(row)))
    return indices


def char_detail_warnings(char_id: str) -> list[str]:
    """Report skills whose EN and ZH detail rows address different params.

    Talent numbers are scraped from ZH, which is the source of truth during
    beta (translator rule U0b). The {paramN} indices inside a detail template
    are numbered from the values that vary across levels in that language's
    own strings, so a details list only lines up with a talent array derived
    from the same language. When beta EN disagrees on how many values vary —
    usually because it still ships a placeholder where ZH already has the real
    ramp — the scraper drops EN's placeholders and leaves literal level-1 text
    rather than let them address the wrong slots. That row then stops tracking
    talent level, so read the value from the ZH row.
    """
    en_kit, zh_kit = load_char_kits(char_id)
    en_skills = en_kit.get("skills") or []
    zh_skills = zh_kit.get("skills") or []
    if not en_skills or not zh_skills:
        return []

    warnings: list[str] = []
    for i, slot in enumerate(_TALENT_SLOT_LABELS):
        if i >= len(en_skills) or i >= len(zh_skills):
            break
        en_params = _detail_params(en_skills[i])
        zh_params = _detail_params(zh_skills[i])
        if en_params == zh_params:
            continue
        lang, params = ("EN", zh_params) if not en_params else ("ZH", en_params)
        if not en_params or not zh_params:
            warnings.append(
                f"{slot} detail rows carry no params in {lang} but "
                f"{len(params)} in the other language — the {lang} rows render "
                "literal level-1 text and do not track talent level"
            )
        else:
            warnings.append(
                f"{slot} detail rows address different params in EN "
                f"({sorted(en_params)}) and ZH ({sorted(zh_params)})"
            )
    return warnings


def _refinement_columns(entry: dict[str, Any]) -> int:
    """How many per-refinement values a weapon entry carries."""
    refinements: list[list[str]] = entry.get("refinements") or []
    return len(refinements[0]) if refinements and refinements[0] else 0


def _numeric_column(column: list[str]) -> list[float] | None:
    values: list[float] = []
    for cell in column:
        m = _PLAIN_VALUE_RE.fullmatch(cell)
        if not m:
            return None
        values.append(float(m.group(1)))
    return values


def weapon_refinement_warnings(weapon_id: str) -> list[str]:
    """Report weapon effect text that the refinement templatizer mangled.

    The templatizer turns R1-R5 into one template plus a value per refinement.
    When the five source strings differ in clause structure — not just in
    values — the values can be lined up against the wrong slots, and the damage
    shows up in the output data rather than in an error:

    * a template that is nothing but ``{0}`` means no shared skeleton was found
      and each refinement swallowed the whole sentence;
    * a refinement cell holding prose instead of a bare value means the same;
    * a zero cell beside non-zero ones means the refinement rows disagreed on
      how many parameters they carry, and the scraper padded the clause that
      row's text does not have. The zero is the scraper's reading of "this
      refinement grants nothing here", which is usually right and occasionally
      hides a parse failure — either way the game text is what settles it;
    * a column that reverses direction is impossible in real data — a genuine
      refinement stat ramps one way (a buff up, a cooldown down), it never
      climbs and then falls;
    * a column that is flat across R2-R5 with R1 alone out of line is the
      fingerprint of an R1 string with one clause fewer than the rest, parsed
      without that padding: R1's value gets read from a different slot than
      everyone else's. Real ramps never freeze for four refinements after a
      single jump.

    A cross-language check covers the failure the per-language ones cannot see:
    an effect text whose five refinement strings are *identical* parses to a
    template with the numbers baked in and no refinement columns at all, which
    looks locally healthy. It is only wrong next to the other language, where
    the same effect does vary.
    """
    warnings: list[str] = []
    entries = {lang: get_weapon_texts(lang).get(weapon_id) for lang in ("en", "zh")}

    # Both languages describe one effect, so they must resolve to the same
    # number of per-refinement values. Retires as soon as they agree — which
    # they already do for every weapon but exaiphanes_blade.
    if entries["en"] and entries["zh"]:
        cols = {lang: _refinement_columns(entry) for lang, entry in entries.items() if entry}
        if cols["en"] != cols["zh"]:
            thin = "en" if cols["en"] < cols["zh"] else "zh"
            warnings.append(
                f"EN and ZH disagree on refinement value count "
                f"(EN {cols['en']}, ZH {cols['zh']}) — [{thin}] lost at least one value "
                f"into its template and no longer varies by refinement; "
                f"take the numbers from the other language"
            )

    for lang in ("en", "zh"):
        entry = entries[lang]
        if not entry:
            continue
        tpl = str(entry.get("descHtmlTpl", ""))
        refinements: list[list[str]] = entry.get("refinements") or []
        if not refinements or not refinements[0]:
            continue

        if tpl.strip() == "{0}":
            warnings.append(f"[{lang}] effect template collapsed to a lone {{0}}")

        for col_idx in range(len(refinements[0])):
            column = [row[col_idx] if col_idx < len(row) else "" for row in refinements]
            shown = "/".join(column)
            if any(not _PLAIN_VALUE_RE.fullmatch(cell) for cell in column):
                warnings.append(f"[{lang}] column {col_idx} holds text, not values: {shown[:60]}…")
                continue

            padded = [i for i, cell in enumerate(column) if cell in _PADDED_CELLS]
            if padded and len(padded) < len(column):
                short = "/".join(f"R{i + 1}" for i in padded)
                warnings.append(
                    f"[{lang}] {short} carries one clause fewer than the other refinements;"
                    f" column {col_idx} padded with {column[padded[0]]}"
                    f" — read the effect text, do not take these numbers on trust: {shown}"
                )
                continue

            values = _numeric_column(column)
            if values is None or len(values) < 3:
                continue
            steps = [b - a for a, b in zip(values, values[1:], strict=False)]
            if any(s > 0 for s in steps) and any(s < 0 for s in steps):
                warnings.append(f"[{lang}] column {col_idx} reverses direction: {shown}")
            elif len(set(values[1:])) == 1 and values[0] != values[1]:
                warnings.append(
                    f"[{lang}] column {col_idx} is flat after R1 (misaligned R1?): {shown}"
                )
    return warnings


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

    # The skill slot is positional (0=A, 1=E, 2=Q), so each language is indexed
    # on its own; a language that is missing the slot simply contributes nothing.
    en_s = en_skills[skill_idx] if skill_idx < len(en_skills) else None
    zh_s = zh_skills[skill_idx] if skill_idx < len(zh_skills) else None
    if en_s is None and zh_s is None:
        print(f"Skill '{skill_code}' not found for '{char_id}'.", file=sys.stderr)
        sys.exit(1)

    name_en = en_s.get("name", "") if en_s else ""
    name_zh = zh_s["name"] if zh_s else ""
    print(f"[{skill_code}] {name_en}  |  {name_zh}  —  Lv{level}")

    en_details = (en_s.get("details") or []) if en_s else []
    zh_details = (zh_s.get("details") or []) if zh_s else []

    # Load talent params for rendering
    char_stats = get_char_stats()
    talent_data = char_stats.get(char_id, {}).get("talent", {}).get(skill_code, [])
    level_params = talent_data[level - 1] if level - 1 < len(talent_data) else []

    for row, zh_row in align_bilingual(en_details, zh_details):
        if not row and not zh_row:
            continue
        en_name = detail_row_label(row) if row else ""
        zh_name = detail_row_label(zh_row) if zh_row else ""
        rendered = render_template(aligned_detail_template(row, zh_row), level_params)
        print(f"  {en_name} ({zh_name}): {rendered}")


# Stands in for the name of a row the other language never shipped, so an
# unpaired row reads as a known gap instead of a blank field.
_NO_EN = "(no EN)"
_NO_ZH = "(no ZH)"


def print_char_kit(
    en_kit: dict[str, Any], zh_kit: dict[str, Any], *, zh_only: bool = False
) -> None:
    en_skills = en_kit.get("skills", [])
    zh_skills = zh_kit.get("skills", [])
    tags = ["A", "E", "Q"]

    # Skill slots are positional (A/E/Q), so they pair by index; the max() only
    # keeps a slot one language is missing from dropping the other's text.
    for i in range(max(len(en_skills), len(zh_skills))):
        en_s = en_skills[i] if i < len(en_skills) else None
        zh_s = zh_skills[i] if i < len(zh_skills) else None
        tag = tags[i] if i < len(tags) else f"S{i}"

        name_en = en_s.get("name", "") if en_s else _NO_EN
        name_zh = zh_s["name"] if zh_s else _NO_ZH
        if zh_only:
            print(f"\n[{tag}] {name_zh if zh_s else name_en}")
        else:
            print(f"\n[{tag}] {name_en}  |  {name_zh}")
        if not zh_only and en_s:
            print(f"  EN: {strip_html(en_s.get('descHtml', ''))}")
        if zh_s:
            print(f"  ZH: {strip_html(zh_s.get('descHtml', ''))}")
        elif zh_only and en_s:
            # Nothing in ZH to print — EN text beats an empty entry.
            print(f"  EN: {strip_html(en_s.get('descHtml', ''))}")

        en_details = (en_s.get("details") or []) if en_s else []
        zh_details = (zh_s.get("details") or []) if zh_s else []

        for row, zh_row in align_bilingual(en_details, zh_details):
            if not row and not zh_row:
                continue
            zh_name = detail_row_label(zh_row) if zh_row else ""
            if zh_only:
                label = zh_name or detail_row_label(row)
                template = detail_row_template(zh_row) if zh_row else detail_row_template(row)
                print(f"  {label}: {template}")
            else:
                en_name = detail_row_label(row) if row else ""
                template = aligned_detail_template(row, zh_row)
                print(f"  {en_name} ({zh_name}): {template}")

    # Passives carry no positional meaning, and one language shipping a
    # placeholder entry the other lacks (raiden_shogun's ZH "暂缺") shifts every
    # row after it — hence the alignment rather than a bare index pairing.
    en_passives = en_kit.get("passives", [])
    zh_passives = zh_kit.get("passives", [])
    for i, (en_p, zh_p) in enumerate(align_bilingual(en_passives, zh_passives)):
        zh_desc = strip_html(zh_p.get("descHtml", "")) if zh_p else ""
        en_desc = strip_html(en_p.get("descHtml", "")) if en_p else ""
        if any(kw in zh_desc for kw in _SKIP_PASSIVE_KEYWORDS):
            print(f"\n[P{i + 1}] (non-combat)")
            continue
        if zh_only:
            print(f"\n[P{i + 1}] {zh_p['name'] if zh_p else en_p.get('name', '')}")
        else:
            en_name = en_p.get("name", "") if en_p else _NO_EN
            print(f"\n[P{i + 1}] {en_name}  |  {zh_p['name'] if zh_p else _NO_ZH}")
            if en_p:
                print(f"  EN: {en_desc}")
        if zh_p:
            print(f"  ZH: {zh_desc}")
        elif zh_only and en_p:
            print(f"  EN: {en_desc}")

    # Constellations are positional (C1..C6), so they pair by index.
    en_cons = en_kit.get("constellations", [])
    zh_cons = zh_kit.get("constellations", [])
    for i in range(max(len(en_cons), len(zh_cons))):
        en_c = en_cons[i] if i < len(en_cons) else None
        zh_c = zh_cons[i] if i < len(zh_cons) else None
        en_desc = strip_html(en_c.get("descHtml", "")) if en_c else ""
        if zh_only:
            fallback_name = en_c.get("name", "") if en_c else ""
            print(f"\n[C{i + 1}] {zh_c['name'] if zh_c else fallback_name}")
        else:
            en_name = en_c.get("name", "") if en_c else _NO_EN
            print(f"\n[C{i + 1}] {en_name}  |  {zh_c['name'] if zh_c else _NO_ZH}")
            if en_c:
                print(f"  EN: {en_desc}")
        if zh_c:
            print(f"  ZH: {strip_html(zh_c.get('descHtml', ''))}")
        elif zh_only and en_c:
            print(f"  EN: {en_desc}")

    # Glossary terms are unordered, and a term can exist in one language only
    # (vesna's ZH-only 灵剑武装), so they align rather than pair by index.
    en_glossary = en_kit.get("glossary", []) or []
    zh_glossary = zh_kit.get("glossary", []) or []
    if en_glossary or zh_glossary:
        # Several EN terms can share one description; they collapse to a single
        # entry listing every name.
        groups: dict[str, list[str]] = {}
        order: list[str] = []
        zh_by_key: dict[str, Any] = {}
        for en_entry, zh_entry in align_bilingual(en_glossary, zh_glossary):
            # ZH-only terms get a key of their own so they keep their own row.
            key = en_entry.get("descHtml", "") if en_entry else f"\x00zh{len(order)}"
            if key not in groups:
                groups[key] = []
                order.append(key)
                zh_by_key[key] = zh_entry
            if en_entry:
                groups[key].append(en_entry.get("name", ""))

        for key in order:
            zh_entry = zh_by_key.get(key)
            names_en = " / ".join(groups[key]) if groups[key] else _NO_EN
            names_zh = zh_entry["name"] if zh_entry else _NO_ZH
            if zh_only:
                print(f"\n[G] {names_zh if zh_entry else names_en}")
            else:
                print(f"\n[G] {names_en}  |  {names_zh}")
                if groups[key]:
                    print(f"  EN: {strip_html(key)}")
            if zh_entry:
                print(f"  ZH: {strip_html(zh_entry.get('descHtml', ''))}")
            elif zh_only and groups[key]:
                print(f"  EN: {strip_html(key)}")


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

        for warning in char_talent_warnings(entity_id):
            print(f"  [!] NOT READY — {warning}")
            print("      Talent levels exist but carry no parameters, so any formula")
            print("      wired to them resolves to 0. Wait for the data before implementing.")

        for warning in char_detail_warnings(entity_id):
            print(f"  [!] SUSPECT DATA — {warning}")

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
        effect_texts: dict[str, str] = {}
        for lang in ("en", "zh"):
            if zh_only and lang == "en":
                continue
            entry = get_weapon_texts(lang).get(entity_id, {})
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

        refinement_warnings = weapon_refinement_warnings(entity_id)
        if refinement_warnings:
            print("[!] SUSPECT REFINEMENT DATA — verify values against the game before use:")
            for warning in refinement_warnings:
                print(f"  - {warning}")

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
                # Official entries take precedence; beta is fallback.
                game_artifacts: dict[str, Any] = {}
                ap = game_dir / f"artifact_{lang}.json"
                if ap.exists():
                    for k, v in json.loads(ap.read_text("utf-8")).items():
                        game_artifacts.setdefault(k, v)
                bp = game_dir / f"artifact_beta_{lang}.json.gz"
                if bp.exists():
                    for k, v in _load_game_json(bp).items():
                        game_artifacts.setdefault(k, v)
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
        impl_path = f"src/lib/dmgcalc/impl/{impl['filename']}"
        print(f"{'─' * 50}")
        print(
            f"  IMPL found ({n_lines} lines): {impl_path} L{impl['start_line']}–L{impl['end_line']}"
        )
        print(f"  → Read this file at offset {impl['start_line']} limit {n_lines} to view the code")
    else:
        print("  [No implementation found in TS]")


def cmd_list(mode: Mode) -> None:
    resources = load_resources(mode)
    beta_ids = _load_beta_ids(mode)

    def _tag(eid: str) -> str:
        """Suffix beta-only ids with '*' so reviewers can spot them at a glance."""
        return f"{eid}*" if eid in beta_ids else eid

    if beta_ids:
        print("(* = unreleased / not in resources.ts)")
        print()

    if mode == "C":
        groups = defaultdict(list)
        for _, m in resources.items():
            groups[f"{m.get('rarity')}★ {m.get('region')}"].append(m.get("id", ""))

        for k in sorted(groups.keys()):
            print(f"== {k} ==")
            print(", ".join(_tag(eid) for eid in sorted(groups[k])))

    elif mode == "W":
        groups = defaultdict(list)
        for _, m in resources.items():
            rarity = m.get("rarity", 0)
            if rarity <= 3:
                groups[f"{rarity}★"].append(m.get("id", ""))
            else:
                groups[f"{rarity}★ {m.get('type')}"].append(m.get("id", ""))

        for k in sorted(groups.keys()):
            print(f"== {k} ==")
            print(", ".join(_tag(eid) for eid in sorted(groups[k])))

    elif mode == "A":
        groups = defaultdict(list)
        for _, m in resources.items():
            if m.get("isHalfSet"):
                groups["Half Sets (2pc only)"].append(m.get("id", ""))
            else:
                groups["Full Sets (4pc)"].append(m.get("id", ""))

        for k in sorted(groups.keys(), reverse=True):  # Full before Half
            print(f"== {k} ==")
            print(", ".join(_tag(eid) for eid in sorted(groups[k])))


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


def _data_quality_report(mode: Mode, resources: dict[str, EntityMeta]) -> list[str]:
    """Data-quality findings for every entity of a mode, released and beta alike."""
    if mode not in ("C", "W"):
        return []

    eids = sorted(set(resources) | _load_beta_ids(mode))
    lines: list[str] = []
    for eid in eids:
        if mode == "C":
            for warning in char_talent_warnings(eid):
                lines.append(f"{eid}: NOT READY — {warning}")
            for warning in char_detail_warnings(eid):
                lines.append(f"{eid}: SUSPECT DATA — {warning}")
        else:
            for warning in weapon_refinement_warnings(eid):
                lines.append(f"{eid}: SUSPECT DATA — {warning}")
    return lines


def cmd_check(modes_to_test: list[Mode]) -> None:
    for mode in modes_to_test:
        mode_name = {"C": "Character", "W": "Weapon", "A": "Artifact"}[mode]
        print(f"=== [{mode}] {mode_name} Check ===")
        misplaced, missing, resources = fetch_check_results(mode)
        i18n = load_i18n_names(mode)
        data_issues = _data_quality_report(mode, resources)

        if data_issues:
            print(f"[!] Data quality ({len(data_issues)}):")
            for line in data_issues:
                print(f"  - {line}")

        if not misplaced and not missing:
            print("[OK]" if not data_issues else "[OK] implementations")
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


_RELEASED_IDS_CACHE: dict[Mode, set[str]] | None = None


def _released_ids() -> dict[Mode, set[str]]:
    """Return the released-and-obtainable id sets parsed from resources.ts.

    Reads resources.ts directly (not through load_ts_data) because that
    helper merges beta entries into the lists, which would defeat the
    "is this beta-only" check below.
    """
    global _RELEASED_IDS_CACHE
    if _RELEASED_IDS_CACHE is None:
        from ts_reader import extract_json_from_ts

        content = (DATA / "resources.ts").read_text(encoding="utf-8")
        _RELEASED_IDS_CACHE = {
            "C": {c["id"] for c in extract_json_from_ts(content, "characters")},
            "W": {w["id"] for w in extract_json_from_ts(content, "weapons")},
            "A": {a["id"] for a in extract_json_from_ts(content, "artifacts")},
        }
    return _RELEASED_IDS_CACHE


def _load_beta_ids(mode: Mode) -> set[str]:
    """Return the set of entity IDs that need beta-style implementation work.

    Unions every game-data JSON for the mode (released + beta) and excludes
    IDs present in resources.ts. The status check is purely "is it in
    resources?" — anything else is treated as unreleased and surfaces here
    for implementation review, regardless of which JSON source carries its
    data (truly-new beta entries scraped by lunaris, or older entries like
    Glacier and Snowfield that already live in the offline-pipeline JSON).
    """
    paths = {"C": CHAR_ZH_PATHS, "W": WEAPON_ZH_PATHS, "A": ARTIFACT_ZH_PATHS}[mode]
    all_ids: set[str] = set()
    for p in paths:
        if p.exists():
            all_ids.update(_load_game_json(p).keys())
    released = _released_ids()[mode]
    return all_ids - released


def cmd_beta(mode_filter: Mode | None = None) -> None:
    """List characters, weapons, and artifacts that exist only in beta data files.

    Shows ID, name, rarity, element/type, region, and implementation status.
    Useful for finding entities that need implementation work.
    """
    modes: list[Mode] = ["C", "W", "A"] if mode_filter is None else [mode_filter]

    any_found = False
    any_blocked = False
    any_suspect = False
    for mode in modes:
        beta_ids = _load_beta_ids(mode)
        if not beta_ids:
            continue
        any_found = True

        label = {"C": "Characters", "W": "Weapons", "A": "Artifacts"}[mode]
        print(f"=== Beta {label} ({len(beta_ids)}) ===")

        resources = load_resources(mode)
        i18n = load_i18n_names(mode)
        impls = scan_impls(mode)

        for eid in sorted(beta_ids):
            meta = resources.get(eid, cast(EntityMeta, {"id": eid}))
            zh_entry = i18n.get(eid, {})
            # i18n layout: flat {en, zh} for both characters and weapons
            if isinstance(zh_entry, dict):
                if isinstance(zh_entry.get("name"), dict):
                    inner = zh_entry["name"]
                else:
                    inner = zh_entry
                name_en = inner.get("en", eid)
                name_zh = inner.get("zh", "")
            else:
                name_en = eid
                name_zh = ""

            rarity = meta.get("rarity", "?")
            if mode == "C":
                element = meta.get("element", "?")
                region = meta.get("region", "?")
                wtype = meta.get("weaponType", "?")
                spec = f"{rarity}★ {element} {wtype} ({region})"
            elif mode == "W":
                wtype = meta.get("type", "?")
                spec = f"{rarity}★ {wtype}"
            else:  # A
                spec = f"{rarity}★"

            impl = impls.get(eid)
            if impl:
                impl_status = f"IMPL @ {impl['filename']} L{impl['start_line']}-L{impl['end_line']}"
            else:
                impl_status = "NO IMPL"

            blockers = char_talent_warnings(eid) if mode == "C" else []
            if mode == "C":
                suspect = char_detail_warnings(eid)
            elif mode == "W":
                suspect = weapon_refinement_warnings(eid)
            else:
                suspect = []
            any_blocked = any_blocked or bool(blockers)
            any_suspect = any_suspect or bool(suspect)

            status = impl_status
            if blockers:
                status = f"{impl_status} | NOT READY: {'; '.join(blockers)}"
            elif suspect:
                status = f"{impl_status} | SUSPECT DATA"

            print(f"  {eid:<35s} | {name_en:<20s} | {name_zh:<10s} | {spec:<30s} | {status}")
            for warning in suspect:
                print(f"{'':<35s}   └─ {warning}")
        print()

    if not any_found:
        print("No beta-unique entities found.")
        return

    if any_blocked:
        print("NOT READY = game data is incomplete; do not implement yet.")
    if any_suspect:
        print("SUSPECT DATA = values look mis-parsed; verify against the game before use.")


def cmd_view(path_arg: str) -> None:
    """Pretty-print the contents of a gzipped beta JSON file to stdout.

    Accepts either an absolute path or a path relative to the project root
    (e.g. ``src/data/game/character_beta_en.json.gz``).
    """
    candidate = Path(path_arg)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    if not candidate.exists():
        print(f"File not found: {candidate}", file=sys.stderr)
        sys.exit(1)
    if candidate.suffix != ".gz":
        print(
            f"Expected a .json.gz file; got {candidate.name}. Use a regular editor for plain JSON.",
            file=sys.stderr,
        )
        sys.exit(1)
    data = read_beta_json(candidate)
    print(json.dumps(data, ensure_ascii=False, indent=2))


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
  check [C|W|A]       Find missing and misplaced implementations, plus any
                        data-quality findings (see markers below).
                        If no mode is provided, checks all modes.
  beta [C|W|A]        List characters/weapons/artifacts that are unreleased
                        (not in resources.ts) with metadata and implementation
                        status. Covers both truly-new entries from lunaris and
                        any older entries like Glacier and Snowfield that
                        already carry data in the offline-pipeline JSON.
                        If no mode is provided, lists all three.
  view <path>         Pretty-print a gzipped beta JSON file (e.g.
                        ``src/data/game/character_beta_en.json.gz``) to stdout.
  excel C <id>        Print Excel VBA damage logic for a character (to stdout).
  excel C --list      List all Excel characters with matched project IDs.

Data-quality markers (emitted by check, beta, and show):
  NOT READY           The game data itself is incomplete — e.g. a talent table
                        with levels but no parameters. Formulas wired to it
                        resolve to 0. Do not implement until the data lands.
  SUSPECT DATA        The values parsed out of an effect text look mis-aligned —
                        e.g. a refinement column that reverses direction or
                        freezes after R1 — or the refinement rows disagreed on
                        how many parameters they carry and a zero was padded in.
                        For characters, EN and ZH talent detail rows disagreed
                        on how many values vary across levels; the numbers come
                        from ZH, so the EN rows fall back to literal level-1
                        text and stop tracking talent level.
                        Verify against the game before use.
"""


def main() -> None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument(
        "command",
        nargs="?",
        choices=["show", "showzh", "list", "check", "beta", "view", "excel", "help"],
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

        elif cmd == "beta":
            mode_filter: Mode | None = None
            if args:
                m = args[0].upper()
                if m in ("C", "W", "A"):
                    mode_filter = cast(Mode, m)
                else:
                    print("Invalid mode for beta. Use C, W, A, or leave empty.")
                    sys.exit(1)
            cmd_beta(mode_filter)

        elif cmd == "view":
            if not args:
                print("Usage: impl_audit.py view <path-to-*.json.gz>")
                sys.exit(1)
            cmd_view(args[0])

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
