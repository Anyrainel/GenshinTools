# /// script
# requires-python = ">=3.10"
# ///
"""Character kit review: correlates EN/ZH data with TS implementation. Run with --help for usage."""

import json
import re
import sys
from pathlib import Path
from typing import Any

# ── Paths ──────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
EN_JSON = ROOT / "src/data/character_en.json"
ZH_JSON = ROOT / "src/data/character_zh.json"
RESOURCES_TS = ROOT / "src/data/resources.ts"
IMPL_FILES = sorted((ROOT / "src/lib/team-comp").glob("character*.ts"))
TRACKER = ROOT / "scripts/.char_review_status.json"
OUTPUT_FILE = ROOT / "scripts/.char_review_output.txt"

Status = str  # "PENDING" | "REVIEW" | "DONE"


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


# ── Tracker I/O ────────────────────────────────────────────────────


def load_tracker() -> dict[str, Status]:
    if not TRACKER.exists():
        print("Tracker not found. Run `init` first.", file=sys.stderr)
        sys.exit(1)
    return json.loads(TRACKER.read_text("utf-8"))


def save_tracker(tracker: dict[str, Status]) -> None:
    TRACKER.write_text(json.dumps(tracker, indent=2) + "\n", "utf-8")


# ── HTML strip ─────────────────────────────────────────────────────


def strip_html(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


def load_rarity_map() -> dict[str, int]:
    """Extract character id → rarity from resources.ts."""
    text = RESOURCES_TS.read_text("utf-8")
    return dict(re.findall(r'"id":\s*"([^"]+)"[^}]*?"rarity":\s*(\d)', text))


# ── TS implementation extraction ───────────────────────────────────


def find_impl(char_id: str) -> tuple[str, int, int, str] | None:
    """Return (filename, start_line, end_line, code_block) or None.

    Scans upward from the @RegisterCharacter decorator to include any
    preceding OptionDef const block (stops at a blank line).
    """
    pattern = re.compile(rf'@RegisterCharacter\("{re.escape(char_id)}"')
    for ts_file in IMPL_FILES:
        lines = ts_file.read_text("utf-8").splitlines()
        for i, line in enumerate(lines):
            if pattern.search(line):
                # Scan upward to capture a preceding const block
                start = i
                for k in range(i - 1, -1, -1):
                    if lines[k].strip() == "":
                        break
                    start = k

                # Scan downward to find class closing brace
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
                code = "\n".join(lines[start : end + 1])
                return (ts_file.name, start + 1, end + 1, code)
    return None


# ── Print helpers ──────────────────────────────────────────────────


def print_skills(en_skills: list[Any], zh_skills: list[Any]) -> None:
    """Print skill descriptions and details tables."""
    tags = ["A", "E", "Q"]
    for i in range(len(en_skills)):
        en_s = en_skills[i]
        zh_s = zh_skills[i] if i < len(zh_skills) else None
        tag = tags[i] if i < len(tags) else f"S{i}"

        name_en = en_s["name"]
        name_zh = zh_s["name"] if zh_s else ""
        print(f"\n[{tag}] {name_en}  |  {name_zh}")
        print(f"  EN: {strip_html(en_s['descHtml'])}")
        if zh_s:
            print(f"  ZH: {strip_html(zh_s['descHtml'])}")

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


def print_passives(en_passives: list[Any], zh_passives: list[Any]) -> None:
    """Print all passives with proper tags."""
    for i in range(len(en_passives)):
        en_p = en_passives[i]
        zh_p = zh_passives[i] if i < len(zh_passives) else None
        print(f"\n[P{i + 1}] {en_p['name']}  |  {zh_p['name'] if zh_p else ''}")
        print(f"  EN: {strip_html(en_p['descHtml'])}")
        if zh_p:
            print(f"  ZH: {strip_html(zh_p['descHtml'])}")


def print_glossary(en_glossary: list[Any], zh_glossary: list[Any]) -> None:
    """Print glossary entries, deduplicating entries with identical descriptions."""
    if not en_glossary:
        return
    print("\n--- Glossary ---")
    # Group by EN descHtml to dedup
    groups: dict[str, list[str]] = {}
    order: list[str] = []  # preserve first-seen order of each unique desc
    zh_by_desc: dict[str, Any] = {}
    for i, entry in enumerate(en_glossary):
        desc = entry["descHtml"]
        if desc not in groups:
            groups[desc] = []
            order.append(desc)
            zh_by_desc[desc] = zh_glossary[i] if i < len(zh_glossary) else None
        groups[desc].append(entry["name"])

    for desc in order:
        names_en = " / ".join(groups[desc])
        zh_entry = zh_by_desc.get(desc)
        names_zh = zh_entry["name"] if zh_entry else ""
        print(f"\n[G] {names_en}  |  {names_zh}")
        print(f"  EN: {strip_html(desc)}")
        if zh_entry:
            print(f"  ZH: {strip_html(zh_entry['descHtml'])}")


def print_constellations(en_cons: list[Any], zh_cons: list[Any]) -> None:
    """Print constellations with EN+ZH descriptions."""
    for i in range(len(en_cons)):
        en_c = en_cons[i]
        zh_c = zh_cons[i] if i < len(zh_cons) else None
        print(f"\n[C{i + 1}] {en_c['name']}  |  {zh_c['name'] if zh_c else ''}")
        print(f"  EN: {strip_html(en_c['descHtml'])}")
        if zh_c:
            print(f"  ZH: {strip_html(zh_c['descHtml'])}")


def show_char(char_id: str) -> None:
    en_all: dict[str, Any] = json.loads(EN_JSON.read_text("utf-8"))
    zh_all: dict[str, Any] = json.loads(ZH_JSON.read_text("utf-8"))

    if char_id not in en_all:
        print(f"ID '{char_id}' not found in EN JSON.", file=sys.stderr)
        sys.exit(1)

    en = en_all[char_id]
    zh = zh_all.get(char_id, {})

    rarity_map = load_rarity_map()
    rarity = rarity_map.get(char_id, "?")

    print(f"\n{'═' * 60}")
    print(f"  {char_id}  (Rarity: {rarity})")
    print("═" * 60)

    print_skills(en.get("skills", []), zh.get("skills", []))
    print_passives(en.get("passives", []), zh.get("passives", []))
    print_constellations(en.get("constellations", []), zh.get("constellations", []))
    print_glossary(en.get("glossary", []), zh.get("glossary", []))

    impl = find_impl(char_id)
    if impl:
        fname, start, end, code = impl
        print(f"\n{'─' * 50}")
        print(f"  IMPL: {fname} L{start}–L{end}")
        print("─" * 50)
        print(code)
    else:
        print("\n  [No implementation found in character*.ts]")


# ── Commands ───────────────────────────────────────────────────────


def cmd_init() -> None:
    en_data: dict[str, Any] = json.loads(EN_JSON.read_text("utf-8"))
    tracker: dict[str, Status] = dict.fromkeys(sorted(en_data), "PENDING")
    if TRACKER.exists():
        old: dict[str, str] = json.loads(TRACKER.read_text("utf-8"))
        for cid, status in old.items():
            if cid in tracker and status != "PENDING":
                tracker[cid] = status
    save_tracker(tracker)
    total = len(tracker)
    done = sum(1 for v in tracker.values() if v == "DONE")
    review = sum(1 for v in tracker.values() if v == "REVIEW")
    pending = total - done - review
    print(f"Tracker: {total} total ({pending} pending, {review} review, {done} done)")


def cmd_next() -> None:
    tracker = load_tracker()
    for cid, status in tracker.items():
        if status == "PENDING":
            show_char(cid)
            return
    for cid, status in tracker.items():
        if status == "REVIEW":
            print(f"No PENDING left. Next REVIEW: {cid}")
            show_char(cid)
            return
    print("All characters are DONE!")


def cmd_show(char_id: str) -> None:
    show_char(char_id)


def cmd_mark(char_id: str, new_status: str) -> None:
    new_status = new_status.upper()
    if new_status not in ("REVIEW", "DONE", "PENDING"):
        print(f"Invalid status '{new_status}'. Use PENDING, REVIEW, or DONE.", file=sys.stderr)
        sys.exit(1)
    tracker = load_tracker()
    if char_id not in tracker:
        print(f"ID '{char_id}' not in tracker.", file=sys.stderr)
        sys.exit(1)
    tracker[char_id] = new_status
    save_tracker(tracker)
    print(f"{char_id} → {new_status}")


def cmd_status() -> None:
    tracker = load_tracker()
    counts: dict[str, int] = {"PENDING": 0, "REVIEW": 0, "DONE": 0}
    for s in tracker.values():
        counts[s] = counts.get(s, 0) + 1
    total = len(tracker)
    print(
        f"Total: {total}  |  PENDING: {counts['PENDING']}"
        f"  |  REVIEW: {counts['REVIEW']}  |  DONE: {counts['DONE']}"
    )
    review_ids = [cid for cid, s in tracker.items() if s == "REVIEW"]
    if review_ids:
        print(f"In review: {', '.join(review_ids)}")


# ── Main ───────────────────────────────────────────────────────────

USAGE = """\
Character Kit Review Tool
─────────────────────────
Correlates EN/ZH character kit data with TypeScript implementation code,
and tracks review status per character ID.

NOTE: Output for 'show' and 'next' is always saved to:
      scripts/.char_review_output.txt

Usage:
  uv run scripts/char_review.py <command> [args]

Commands:
  init              Initialize tracker from character_en.json.
                    Preserves existing statuses on re-run.
  next              Show the next PENDING character (recommended workflow).
                    Falls back to next REVIEW entry if none are pending.
  show <id>         Show EN/ZH kit + TS implementation for a specific character.
  mark <id> <S>     Update status: PENDING | REVIEW | DONE.
  status            Print summary counts and list any REVIEW entries.

Recommended Workflow:
  1. Run `init` once to create the tracker.
  2. Run `next` to get the next character to work on.
  3. After completing the work, run `mark <id> DONE`.
  4. Run `next` again for the next character.
  Use `mark <id> REVIEW` for entries that need a second pass.
  Use `status` to check overall progress at any time.

Output Sections:
  [A]   Normal Attack    [E] Elemental Skill    [Q] Elemental Burst
  [P1]  1st Passive      [P2] 2nd Passive       [P3+] Extra Passives
  [C1]-[C6] Constellations
  [G]   Glossary entries (duplicates merged by description)
  IMPL  TypeScript class code with file name and line range
"""


def main() -> None:
    args = sys.argv[1:]
    if not args or args[0] in ("--help", "-h"):
        print(USAGE)
        sys.exit(0 if args else 1)

    cmd = args[0]
    match cmd:
        case "init":
            cmd_init()
        case "next":
            with FileWriter(OUTPUT_FILE):
                cmd_next()
            print(f"Output saved to {OUTPUT_FILE}")
        case "show":
            if len(args) < 2:
                print("Usage: char_review.py show <id>", file=sys.stderr)
                sys.exit(1)
            with FileWriter(OUTPUT_FILE):
                cmd_show(args[1])
            print(f"Output saved to {OUTPUT_FILE}")
        case "mark":
            if len(args) < 3:
                print("Usage: char_review.py mark <id> <REVIEW|DONE>", file=sys.stderr)
                sys.exit(1)
            cmd_mark(args[1], args[2])
        case "status":
            cmd_status()
        case _:
            print(f"Unknown command: {cmd}", file=sys.stderr)
            print(USAGE)
            sys.exit(1)


if __name__ == "__main__":
    main()
