"""
Beta file management: paths, I/O, cleanup, TypeScript generation.

This module owns everything related to the beta data surface:

  Beta JSON (gzipped, GitHub-search-hidden):
    src/data/game/{character,weapon,artifact}_beta_*.json[.gz]

  Beta TypeScript (visibility + i18n):
    src/data/resources_beta.ts   — flagged-on entities visible in beta UI
    src/data/i18n-beta.ts        — display names for beta entities

The "beta" surface contains every unreleased entity (i.e. anything not in
``resources.ts``), regardless of where its data lives:
  1. Truly-new entries scraped from lunaris.moe (data lives in beta JSON).
  2. Older unobtainable entries (e.g. "Glacier and Snowfield",
     "Tiny Miracle") whose data already lives in the offline-pipeline JSON
     (artifact_en.json) but whose visibility is gated through resources_beta.

Cleanup rules differ by file because the safety implications differ:
  - Beta JSON: only remove an entry if the corresponding official JSON
    has the data. Otherwise we'd delete the only data source.
  - resources_beta.ts: remove if entry is in resources.ts. No data loss.
  - i18n-beta.ts: only remove if i18n-game.ts has the name. Otherwise
    the UI would lose the display name.
"""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "src" / "data"
GAME_DIR = DATA_DIR / "game"

RESOURCES_PATH = DATA_DIR / "resources.ts"
RESOURCES_BETA_PATH = DATA_DIR / "resources_beta.ts"
I18N_GAME_PATH = DATA_DIR / "i18n-game.ts"
I18N_BETA_PATH = DATA_DIR / "i18n-beta.ts"

# Official (released) game-data JSON, used as the safety oracle for cleanup.
CHARACTER_4_EN_PATH = GAME_DIR / "character_4_en.json"
CHARACTER_5_EN_PATH = GAME_DIR / "character_5_en.json"
WEAPON_EN_PATH = GAME_DIR / "weapon_en.json"
WEAPON_ZH_PATH = GAME_DIR / "weapon_zh.json"
ARTIFACT_EN_PATH = GAME_DIR / "artifact_en.json"
ARTIFACT_ZH_PATH = GAME_DIR / "artifact_zh.json"

# Beta JSON (gzipped). Beta data is gzipped so GitHub code search doesn't
# index in-development character/weapon/artifact text.
BETA_CHARACTER_EN_PATH = GAME_DIR / "character_beta_en.json.gz"
BETA_CHARACTER_ZH_PATH = GAME_DIR / "character_beta_zh.json.gz"
BETA_CHARACTER_STATS_PATH = GAME_DIR / "character_beta_stats.json.gz"

BETA_WEAPON_EN_PATH = GAME_DIR / "weapon_beta_en.json.gz"
BETA_WEAPON_ZH_PATH = GAME_DIR / "weapon_beta_zh.json.gz"
BETA_WEAPON_STATS_PATH = GAME_DIR / "weapon_beta_stats.json.gz"

BETA_ARTIFACT_EN_PATH = GAME_DIR / "artifact_beta_en.json.gz"
BETA_ARTIFACT_ZH_PATH = GAME_DIR / "artifact_beta_zh.json.gz"

# Slot suffix mapping. API _4 → flower (no suffix), _2 → plume (2),
# _5 → sands (3), _1 → goblet (4), _3 → circlet (5).
ARTIFACT_SLOT_LOCAL_SUFFIX: dict[str, str] = {
    "flower": "",
    "plume": "2",
    "sands": "3",
    "goblet": "4",
    "circlet": "5",
}


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------
def read_beta_json(path: Path) -> dict:
    """Load a gzipped JSON file. Returns an empty dict if the file is missing."""
    if not path.exists():
        return {}
    return json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))


def write_beta_json(path: Path, data: dict) -> None:
    """Write JSON to a gzipped file, minified. Creates parent dirs as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # mtime=0 for reproducible output (no timestamp in the gzip header).
    path.write_bytes(gzip.compress(raw, mtime=0))


def load_json(path: Path) -> dict:
    """Load a JSON file, transparently handling gzipped beta files."""
    if not path.exists():
        return {}
    if path.suffix == ".gz":
        return read_beta_json(path)
    return json.loads(path.read_text(encoding="utf-8"))


def save_json_minified(path: Path, data: dict) -> None:
    """Write minified JSON, transparently handling gzipped beta files."""
    if path.suffix == ".gz":
        write_beta_json(path, data)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# TypeScript file generation
# ---------------------------------------------------------------------------
def generate_resources_beta_ts(
    characters: list[tuple[str, int]],
    weapons: list[tuple[str, int]],
    artifacts: list[tuple[str, int]],
) -> str:
    """Render resources_beta.ts content from (id, rarity) tuples.

    Image paths for all 5 artifact slots are derived from the id.
    """
    lines = [
        "// This file is auto-generated by scripts/lunaris.py",
        "// Do not edit this file directly",
        "import type {",
        "  ArtifactSetResource,",
        "  CharacterResource,",
        "  WeaponResource,",
        '} from "./types";',
        "",
    ]

    def _entry(d: dict) -> str:
        return json.dumps(d, ensure_ascii=False, separators=(",", ":"))

    lines.append("export const betaCharacters: CharacterResource[] = [")
    for cid, rarity in characters:
        lines.append(
            "  "
            + _entry({"id": cid, "rarity": rarity, "imagePath": f"/character/{cid}.webp"})
            + ","
        )
    lines.append("];")

    lines.append("export const betaWeapons: WeaponResource[] = [")
    for wid, rarity in weapons:
        lines.append(
            "  " + _entry({"id": wid, "rarity": rarity, "imagePath": f"/weapon/{wid}.webp"}) + ","
        )
    lines.append("];")

    lines.append("export const betaArtifacts: ArtifactSetResource[] = [")
    for aid, rarity in artifacts:
        image_paths = {
            slot: f"/artifact/{aid}{suffix}.webp"
            for slot, suffix in ARTIFACT_SLOT_LOCAL_SUFFIX.items()
        }
        lines.append("  " + _entry({"id": aid, "rarity": rarity, "imagePaths": image_paths}) + ",")
    lines.append("];")

    return "\n".join(lines) + "\n"


def generate_i18n_beta_ts(
    char_names_en: dict[str, str],
    char_names_zh: dict[str, str],
    weapon_names_en: dict[str, str],
    weapon_names_zh: dict[str, str],
    artifact_names_en: dict[str, str],
    artifact_names_zh: dict[str, str],
) -> str:
    """Render i18n-beta.ts with display names for beta entities."""
    lines = [
        "// This file is auto-generated by scripts/lunaris.py",
        "// Do not edit this file directly",
        "",
        "export const i18nBetaData = {",
        "  characters: {",
    ]

    def _dump(s: str) -> str:
        return json.dumps(s, ensure_ascii=False)

    def _emit_section(names_en: dict[str, str], names_zh: dict[str, str]) -> None:
        for eid in sorted(names_en.keys()):
            en_name = names_en[eid]
            zh_name = names_zh.get(eid, en_name)
            lines.append(f"    {_dump(eid)}: {{ en: {_dump(en_name)}, zh: {_dump(zh_name)} }},")

    _emit_section(char_names_en, char_names_zh)
    lines.append("  },")
    lines.append("  weapons: {")
    _emit_section(weapon_names_en, weapon_names_zh)
    lines.append("  },")
    lines.append("  artifacts: {")
    _emit_section(artifact_names_en, artifact_names_zh)
    lines.append("  },")
    lines.append("};")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
def _load_i18n_game_ids() -> dict[str, set[str]]:
    """Parse i18n-game.ts and return id sets per section.

    Returns {"characters": {id, ...}, "weapons": {...}, "artifacts": {...}}.
    """
    if not I18N_GAME_PATH.exists():
        return {"characters": set(), "weapons": set(), "artifacts": set()}

    text = I18N_GAME_PATH.read_text(encoding="utf-8")
    result: dict[str, set[str]] = {"characters": set(), "weapons": set(), "artifacts": set()}

    # Sections look like:  "characters": { "<id>": { ... }, ... },
    # We capture the body text between the section header and the matching
    # closing brace, then extract quoted ids.
    for section in result:
        m = re.search(rf'"{section}"\s*:\s*\{{', text)
        if not m:
            continue
        # Find matching closing brace by counting depth.
        depth = 1
        i = m.end()
        while i < len(text) and depth > 0:
            ch = text[i]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            i += 1
        body = text[m.end() : i - 1]
        for id_match in re.finditer(r'"([^"]+)"\s*:\s*\{', body):
            result[section].add(id_match.group(1))

    return result


def _clean_dict_with_official(
    beta: dict, obtainable: set[str], official_keys: set[str]
) -> list[str]:
    """Remove keys from beta dict that are obtainable AND present in official.

    Returns the list of removed keys. Skips entries that are obtainable but
    not yet in official JSON (carry-over case: data hasn't synced yet).
    """
    stale = [k for k in beta if k in obtainable and k in official_keys]
    for k in stale:
        beta.pop(k)
    return stale


def _rewrite_resources_beta(
    stale_chars: set[str], stale_weapons: set[str], stale_artifacts: set[str]
) -> bool:
    """Strip stale entries from resources_beta.ts in-place. Returns True if changed."""
    if not RESOURCES_BETA_PATH.exists():
        return False
    text = RESOURCES_BETA_PATH.read_text(encoding="utf-8")
    entry_re = re.compile(r"^\s*(\{.*\}),?\s*$")

    def parse_section(section_start: str, src: str) -> tuple[list[dict], int, int]:
        m = re.search(rf"{re.escape(section_start)}\s*\[\s*\n", src)
        if not m:
            return [], -1, -1
        start = m.end()
        end_m = re.search(r"^\];", src[start:], re.MULTILINE)
        if not end_m:
            return [], -1, -1
        body = src[start : start + end_m.start()]
        entries = []
        for line in body.splitlines():
            em = entry_re.match(line)
            if em:
                entries.append(json.loads(em.group(1)))
        return entries, start, start + end_m.start()

    def render_entries(entries: list[dict]) -> str:
        return "".join(
            f"  {json.dumps(e, ensure_ascii=False, separators=(',', ':'))},\n" for e in entries
        )

    # Process sections from last to first so earlier offsets stay valid.
    sections = [
        ("export const betaArtifacts: ArtifactSetResource[] =", stale_artifacts),
        ("export const betaWeapons: WeaponResource[] =", stale_weapons),
        ("export const betaCharacters: CharacterResource[] =", stale_chars),
    ]
    updated = text
    for marker, stale in sections:
        if not stale:
            continue
        entries, s, e = parse_section(marker, updated)
        if s == -1:
            continue
        new_entries = [x for x in entries if x["id"] not in stale]
        if len(new_entries) == len(entries):
            continue
        updated = updated[:s] + render_entries(new_entries) + updated[e:]

    if updated != text:
        RESOURCES_BETA_PATH.write_text(updated, encoding="utf-8")
        return True
    return False


def _rewrite_i18n_beta(
    stale_chars: set[str], stale_weapons: set[str], stale_artifacts: set[str]
) -> bool:
    """Strip stale entries from i18n-beta.ts in-place. Returns True if changed."""
    if not I18N_BETA_PATH.exists():
        return False
    text = I18N_BETA_PATH.read_text(encoding="utf-8")
    entry_re = re.compile(r'^\s*"([^"]+)":')

    def prune_section(src: str, marker: str, stale: set[str]) -> str:
        m = re.search(rf"{re.escape(marker)}\s*\{{\s*\n", src)
        if not m:
            return src
        start = m.end()
        end_m = re.search(r"^  \},", src[start:], re.MULTILINE)
        if not end_m:
            return src
        body = src[start : start + end_m.start()]
        kept = [
            line
            for line in body.splitlines(keepends=True)
            if not ((em := entry_re.match(line)) and em.group(1) in stale)
        ]
        return src[:start] + "".join(kept) + src[start + end_m.start() :]

    updated = text
    if stale_artifacts:
        updated = prune_section(updated, "artifacts:", stale_artifacts)
    if stale_weapons:
        updated = prune_section(updated, "weapons:", stale_weapons)
    if stale_chars:
        updated = prune_section(updated, "characters:", stale_chars)

    if updated != text:
        I18N_BETA_PATH.write_text(updated, encoding="utf-8")
        return True
    return False


def cleanup_beta_files(
    obtainable_chars: set[str],
    obtainable_weapons: set[str],
    obtainable_artifacts: set[str],
    skip_artifacts: set[str] | None = None,
) -> None:
    """Remove from beta files any entries that have been promoted to released.

    Cleanup rules differ by file (see module docstring for rationale):

      * Beta JSON files: only remove if the entry is in resources.ts AND
        present in the corresponding official JSON. Carry-over entries
        (in resources.ts but not yet in official JSON) are kept so the
        only data source isn't yanked.

      * resources_beta.ts: remove if entry is in resources.ts.

      * i18n-beta.ts: only remove if the name is in i18n-game.ts. Otherwise
        the UI would lose the display name.

    `skip_artifacts` is the union of artifact IDs that should never appear in
    any beta surface (e.g. tiny_miracle, prayer sets). They're removed
    unconditionally from beta JSON, resources_beta.ts, and i18n-beta.ts —
    no carry-over safety, since they're explicitly excluded from the catalog.
    """
    print("--- Cleanup phase ---")
    skip_artifacts = skip_artifacts or set()

    # Load official JSON to determine what's safe to remove from beta JSON.
    official_char_keys = (
        load_json(CHARACTER_4_EN_PATH).keys() | load_json(CHARACTER_5_EN_PATH).keys()
    )
    official_weapon_keys = load_json(WEAPON_EN_PATH).keys()
    official_artifact_keys = load_json(ARTIFACT_EN_PATH).keys()

    # Group beta JSON files by entity kind so we can apply matching rules.
    beta_groups: list[tuple[str, list[Path], set[str], set[str]]] = [
        (
            "char",
            [BETA_CHARACTER_EN_PATH, BETA_CHARACTER_ZH_PATH, BETA_CHARACTER_STATS_PATH],
            obtainable_chars,
            set(official_char_keys),
        ),
        (
            "weapon",
            [BETA_WEAPON_EN_PATH, BETA_WEAPON_ZH_PATH, BETA_WEAPON_STATS_PATH],
            obtainable_weapons,
            set(official_weapon_keys),
        ),
        (
            "artifact",
            [BETA_ARTIFACT_EN_PATH, BETA_ARTIFACT_ZH_PATH],
            obtainable_artifacts,
            set(official_artifact_keys),
        ),
    ]

    for kind, paths, obtainable, official_keys in beta_groups:
        for path in paths:
            data = load_json(path)
            removed = _clean_dict_with_official(data, obtainable, official_keys)
            # Unconditionally drop skip-listed artifacts — they should never
            # appear in beta surfaces regardless of carry-over status.
            extra_skip: list[str] = []
            if kind == "artifact":
                extra_skip = [k for k in list(data) if k in skip_artifacts]
                for k in extra_skip:
                    data.pop(k)
            if removed or extra_skip:
                save_json_minified(path, data)
                if removed:
                    print(
                        f"  {path.relative_to(PROJECT_ROOT)}: removed {len(removed)} promoted "
                        f"{kind} entries ({sorted(removed)})"
                    )
                if extra_skip:
                    print(
                        f"  {path.relative_to(PROJECT_ROOT)}: removed {len(extra_skip)} "
                        f"skip-listed {kind} entries ({sorted(extra_skip)})"
                    )
            # Carry-over warning: in obtainable but NOT in official → kept.
            kept_carryover = sorted(k for k in data if k in obtainable and k not in official_keys)
            if kept_carryover:
                print(
                    f"  {path.relative_to(PROJECT_ROOT)}: kept {len(kept_carryover)} "
                    f"carry-over {kind} entries (in resources.ts but not in official JSON): "
                    f"{kept_carryover}"
                )

    # resources_beta.ts cleanup: remove if entry is in resources.ts OR skipped.
    if _rewrite_resources_beta(
        obtainable_chars, obtainable_weapons, obtainable_artifacts | skip_artifacts
    ):
        print(f"  {RESOURCES_BETA_PATH.relative_to(PROJECT_ROOT)}: pruned promoted entries")

    # i18n-beta.ts cleanup: remove if name is in i18n-game.ts (carry-over safety),
    # OR if the artifact is on the skip list (should never have a UI name).
    i18n_game = _load_i18n_game_ids()
    stale_i18n_chars = obtainable_chars & i18n_game["characters"]
    stale_i18n_weapons = obtainable_weapons & i18n_game["weapons"]
    stale_i18n_artifacts = (obtainable_artifacts & i18n_game["artifacts"]) | skip_artifacts
    if _rewrite_i18n_beta(stale_i18n_chars, stale_i18n_weapons, stale_i18n_artifacts):
        print(f"  {I18N_BETA_PATH.relative_to(PROJECT_ROOT)}: pruned promoted entries")
