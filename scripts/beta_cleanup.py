"""
Clean up beta entries that have been promoted to released data.

Compares ids in beta JSON files against the released character_stats.json /
weapon_stats.json. Any id present in both is considered stale — the entry is
removed from all beta JSON files, resources_beta.ts, and i18n-beta.ts.

Image files are not managed: lunaris.py now writes images directly into
public/character/ and public/weapon/ (shared with released assets), so there
is nothing to clean up on the image side.

Usage:
  uv run --project scripts/pyproject.toml scripts/beta_cleanup.py
  uv run --project scripts/pyproject.toml scripts/beta_cleanup.py --dry-run
"""

import argparse
import json
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "src" / "data"
GAME_DIR = DATA_DIR / "game"
RESOURCES_BETA_PATH = DATA_DIR / "resources_beta.ts"
I18N_BETA_PATH = DATA_DIR / "i18n-beta.ts"

CHARACTER_STATS_PATH = GAME_DIR / "character_stats.json"
WEAPON_STATS_PATH = GAME_DIR / "weapon_stats.json"

BETA_CHAR_FILES = [
    GAME_DIR / "character_beta_stats.json",
    GAME_DIR / "character_beta_en.json",
    GAME_DIR / "character_beta_zh.json",
]
BETA_WEAPON_FILES = [
    GAME_DIR / "weapon_beta_stats.json",
    GAME_DIR / "weapon_beta_en.json",
    GAME_DIR / "weapon_beta_zh.json",
]


def load_json(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_json_minified(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def prune_json_file(path: Path, stale_ids: set[str], dry_run: bool) -> list[str]:
    data = load_json(path)
    removed = [k for k in data if k in stale_ids]
    if not removed:
        return []
    if not dry_run:
        for k in removed:
            data.pop(k, None)
        save_json_minified(path, data)
    return removed


# ---------------------------------------------------------------------------
# resources_beta.ts rewrite
# ---------------------------------------------------------------------------
def rewrite_resources_beta(stale_chars: set[str], stale_weapons: set[str], dry_run: bool) -> None:
    """Parse resources_beta.ts, drop stale entries, write it back.

    Keeps file format identical to what lunaris.py generates so diffs stay clean.
    """
    if not RESOURCES_BETA_PATH.exists():
        return
    text = RESOURCES_BETA_PATH.read_text(encoding="utf-8")

    # Entry lines look like: `  {"id":"linnea","rarity":5,"imagePath":"..."},`
    entry_re = re.compile(r"^\s*(\{.*\}),?\s*$")

    def split_section(section_start: str) -> tuple[list[dict], int, int]:
        m = re.search(rf"{re.escape(section_start)}\s*\[\s*\n", text)
        if not m:
            return [], -1, -1
        start = m.end()
        end_m = re.search(r"^\];", text[start:], re.MULTILINE)
        if not end_m:
            return [], -1, -1
        body = text[start : start + end_m.start()]
        entries = []
        for line in body.splitlines():
            em = entry_re.match(line)
            if em:
                entries.append(json.loads(em.group(1)))
        return entries, start, start + end_m.start()

    chars, _, _ = split_section("export const betaCharacters: CharacterResource[] =")
    weapons, weapons_s, weapons_e = split_section("export const betaWeapons: WeaponResource[] =")

    new_chars = [c for c in chars if c["id"] not in stale_chars]
    new_weapons = [w for w in weapons if w["id"] not in stale_weapons]

    if len(new_chars) == len(chars) and len(new_weapons) == len(weapons):
        return

    def render_entries(entries: list[dict]) -> str:
        return "".join(
            f"  {json.dumps(e, ensure_ascii=False, separators=(',', ':'))},\n" for e in entries
        )

    # Rewrite weapons first (higher offset) so the earlier chars offsets stay valid.
    updated = text
    if weapons_s != -1:
        updated = updated[:weapons_s] + render_entries(new_weapons) + updated[weapons_e:]
    # Recompute chars offsets against the updated text.
    m = re.search(r"export const betaCharacters: CharacterResource\[\] =\s*\[\s*\n", updated)
    if m:
        start = m.end()
        end_m = re.search(r"^\];", updated[start:], re.MULTILINE)
        if end_m:
            updated = updated[:start] + render_entries(new_chars) + updated[start + end_m.start() :]

    if not dry_run:
        RESOURCES_BETA_PATH.write_text(updated, encoding="utf-8")


# ---------------------------------------------------------------------------
# i18n-beta.ts rewrite
# ---------------------------------------------------------------------------
def rewrite_i18n_beta(stale_chars: set[str], stale_weapons: set[str], dry_run: bool) -> None:
    if not I18N_BETA_PATH.exists():
        return
    text = I18N_BETA_PATH.read_text(encoding="utf-8")

    # Entry lines: `    "linnea": { en: "Linnea", zh: "..." },`
    entry_re = re.compile(r'^\s*"([^"]+)":')

    def prune_section(src: str, section_marker: str, stale: set[str]) -> str:
        m = re.search(rf"{re.escape(section_marker)}\s*\{{\s*\n", src)
        if not m:
            return src
        start = m.end()
        end_m = re.search(r"^  \},", src[start:], re.MULTILINE)
        if not end_m:
            return src
        body = src[start : start + end_m.start()]
        kept_lines = [
            line
            for line in body.splitlines(keepends=True)
            if not ((em := entry_re.match(line)) and em.group(1) in stale)
        ]
        return src[:start] + "".join(kept_lines) + src[start + end_m.start() :]

    updated = text
    if stale_weapons:
        updated = prune_section(updated, "weapons:", stale_weapons)
    if stale_chars:
        updated = prune_section(updated, "characters:", stale_chars)

    if updated != text and not dry_run:
        I18N_BETA_PATH.write_text(updated, encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Remove released entries from beta files")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without writing")
    args = parser.parse_args()

    released_chars = set(load_json(CHARACTER_STATS_PATH).keys())
    released_weapons = set(load_json(WEAPON_STATS_PATH).keys())

    beta_char_ids = set(load_json(BETA_CHAR_FILES[0]).keys())
    beta_weapon_ids = set(load_json(BETA_WEAPON_FILES[0]).keys())

    stale_chars = beta_char_ids & released_chars
    stale_weapons = beta_weapon_ids & released_weapons

    print(f"Released: {len(released_chars)} chars, {len(released_weapons)} weapons")
    print(f"Beta:     {len(beta_char_ids)} chars, {len(beta_weapon_ids)} weapons")

    if not stale_chars and not stale_weapons:
        print("\nNo stale entries to remove.")
        print("\nDone." + (" (dry-run — no files modified)" if args.dry_run else ""))
        return

    print(f"\nStale characters ({len(stale_chars)}): {sorted(stale_chars)}")
    print(f"Stale weapons    ({len(stale_weapons)}): {sorted(stale_weapons)}")

    action = "Would remove" if args.dry_run else "Removing"
    print(f"\n--- {action} from beta JSON files ---")
    for f in BETA_CHAR_FILES:
        removed = prune_json_file(f, stale_chars, args.dry_run)
        if removed:
            print(f"  {f.relative_to(PROJECT_ROOT)}: -{removed}")
    for f in BETA_WEAPON_FILES:
        removed = prune_json_file(f, stale_weapons, args.dry_run)
        if removed:
            print(f"  {f.relative_to(PROJECT_ROOT)}: -{removed}")

    print(f"\n--- {action} from resources_beta.ts / i18n-beta.ts ---")
    rewrite_resources_beta(stale_chars, stale_weapons, args.dry_run)
    rewrite_i18n_beta(stale_chars, stale_weapons, args.dry_run)
    if not args.dry_run:
        print(f"  updated {RESOURCES_BETA_PATH.relative_to(PROJECT_ROOT)}")
        print(f"  updated {I18N_BETA_PATH.relative_to(PROJECT_ROOT)}")

    print("\nDone." + (" (dry-run — no files modified)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
