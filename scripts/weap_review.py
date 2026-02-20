import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CACHE_JSON = ROOT / "scripts/.weap_data_cache.json"
IMPL_FILES = sorted((ROOT / "src/lib/team-comp").glob("weapon*.ts"))
TRACKER = ROOT / "scripts/.weap_review_status.json"
OUTPUT_FILE = ROOT / "scripts/.weap_review_output.txt"

Status = str


class FileWriter:
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


def ensure_cache() -> None:
    if not CACHE_JSON.exists():
        print("Data cache missing. Running tsx to generate it...", file=sys.stderr)
        subprocess.run(
            ["npx", "tsx", str(ROOT / "scripts/dump_weapons.ts")], check=True, cwd=str(ROOT)
        )


def load_tracker() -> dict[str, Status]:
    if not TRACKER.exists():
        print("Tracker not found. Run `init` first.", file=sys.stderr)
        sys.exit(1)
    return json.loads(TRACKER.read_text("utf-8"))


def save_tracker(tracker: dict[str, Status]) -> None:
    TRACKER.write_text(json.dumps(tracker, indent=2) + "\n", "utf-8")


def strip_html(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


def find_impl(weap_id: str) -> tuple[str, int, int, str] | None:
    pattern = re.compile(rf'@RegisterWeapon\("{re.escape(weap_id)}"')
    for ts_file in IMPL_FILES:
        lines = ts_file.read_text("utf-8").splitlines()
        for i, line in enumerate(lines):
            if pattern.search(line):
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
                code = "\n".join(lines[start : end + 1])
                return (ts_file.name, start + 1, end + 1, code)
    return None


def get_rarity(fname: str) -> str:
    m = re.search(r"weapon(\d)", fname)
    return f"{m.group(1)}★" if m else "?"


def show_weap(weap_id: str) -> None:
    ensure_cache()
    data: dict[str, Any] = json.loads(CACHE_JSON.read_text("utf-8"))
    if weap_id not in data:
        print(f"ID '{weap_id}' not found in data.", file=sys.stderr)
        sys.exit(1)

    weap = data[weap_id]
    name_en = weap.get("name", {}).get("en", "")
    name_zh = weap.get("name", {}).get("zh", "")
    effect_en = weap.get("effect", {}).get("en", "")
    effect_zh = weap.get("effect", {}).get("zh", "")

    impl = find_impl(weap_id)
    rarity = get_rarity(impl[0]) if impl else "?"

    print(f"\n{'═' * 60}")
    print(f"  {weap_id}  |  {name_en}  |  {name_zh}  (Rarity: {rarity})")
    print("═" * 60)

    print("\n[Effect]")
    print(f"  EN: {strip_html(effect_en)}")
    print(f"  ZH: {strip_html(effect_zh)}")

    if impl:
        fname, start, end, code = impl
        print(f"\n{'─' * 50}")
        print(f"  IMPL: {fname} L{start}–L{end}")
        print("─" * 50)
        print(code)
    else:
        print("\n  [No implementation found in weapon*.ts]")


def cmd_init() -> None:
    ensure_cache()
    data = json.loads(CACHE_JSON.read_text("utf-8"))
    tracker: dict[str, Status] = dict.fromkeys(sorted(data), "PENDING")
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
            show_weap(cid)
            return
    for cid, status in tracker.items():
        if status == "REVIEW":
            print(f"No PENDING left. Next REVIEW: {cid}")
            show_weap(cid)
            return
    print("All weapons are DONE!")


def cmd_show(weap_id: str) -> None:
    show_weap(weap_id)


def cmd_mark(weap_id: str, new_status: str) -> None:
    new_status = new_status.upper()
    if new_status not in ("REVIEW", "DONE", "PENDING"):
        print(f"Invalid status '{new_status}'. Use PENDING, REVIEW, or DONE.", file=sys.stderr)
        sys.exit(1)
    tracker = load_tracker()
    if weap_id not in tracker:
        print(f"ID '{weap_id}' not in tracker.", file=sys.stderr)
        sys.exit(1)
    tracker[weap_id] = new_status
    save_tracker(tracker)
    print(f"{weap_id} → {new_status}")


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


USAGE = """\
Usage:
  uv run scripts/weap_review.py init
  uv run scripts/weap_review.py next
  uv run scripts/weap_review.py show <id>
  uv run scripts/weap_review.py mark <id> <S>
  uv run scripts/weap_review.py status
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
                sys.exit(1)
            with FileWriter(OUTPUT_FILE):
                cmd_show(args[1])
            print(f"Output saved to {OUTPUT_FILE}")
        case "mark":
            if len(args) < 3:
                sys.exit(1)
            cmd_mark(args[1], args[2])
        case "status":
            cmd_status()


if __name__ == "__main__":
    main()
