#!/usr/bin/env python3
"""
Scan gcsim character source files for particle generation logic.

Writes scripts/out/particle-locations.json — per-character index of files,
functions, and line ranges containing QueueParticle calls and related
machinery (probability gates, particle ICDs, count constants).

Agents invoking the gcsim-particle-extract skill use this index to read
only the relevant portions of each character's code, instead of every
.go file in full.

Expected gcsim clone: F:/Codes/genshin/gcsim
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

GCSIM_ROOT = Path("F:/Codes/genshin/gcsim")
CHAR_ROOT = GCSIM_ROOT / "internal" / "characters"
OUT_PATH = Path(__file__).resolve().parent / "out" / "particle-locations.json"

# Anchors that signal particle logic. The `kind` label is informational for
# agents — it hints at what to extract from the surrounding function.
ANCHORS: list[tuple[str, re.Pattern]] = [
    ("queue", re.compile(r"\bQueueParticle\s*\(")),
    ("rand", re.compile(r"\bRand\.Float64\s*\(")),
    ("cb", re.compile(r"\b(?:make)?[Pp]articleCB\b|\b\w*ParticleCB\b")),
    ("icd", re.compile(r"[Pp]articleICD")),
    ("const", re.compile(r"\b\w*[Pp]articleCount\b")),
]

FUNC_START_RE = re.compile(r"^func\s+(?:\(([^)]*)\)\s+)?(\w+)")
FUNC_END_RE = re.compile(r"^\}")

# Skip Go codegen and unrelated mechanical files.
SKIP_FILES = {
    "data_gen.textproto",
    "config.yml",
}


def find_function_ranges(lines: list[str]) -> list[tuple[int, int, str]]:
    """Return [(start_idx, end_idx, name), ...] for top-level funcs.

    Go top-level funcs start with `func ` at column 0 and end with `}` at
    column 0. Assumes standard gofmt-formatted files (gcsim is).
    """
    ranges: list[tuple[int, int, str]] = []
    i = 0
    n = len(lines)
    while i < n:
        m = FUNC_START_RE.match(lines[i])
        if m:
            start = i
            name = m.group(2)
            j = i + 1
            while j < n and not FUNC_END_RE.match(lines[j]):
                j += 1
            ranges.append((start, j, name))
            i = j + 1
        else:
            i += 1
    return ranges


def scan_file(path: Path) -> tuple[list[dict], list[dict]]:
    """Return (function_hits, top_level_hits).

    function_hits: [{function, lines: [start, end], kinds: [...]}, ...]
    top_level_hits: [{line, text}, ...] for constant declarations at file scope
    """
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except Exception:
        return [], []

    funcs = find_function_ranges(lines)

    # func_key -> set of anchor kinds found inside
    func_hits: dict[tuple[int, int, str], set[str]] = defaultdict(set)
    top_level: list[dict] = []

    def in_which_func(line_idx: int) -> tuple[int, int, str] | None:
        for start, end, name in funcs:
            if start <= line_idx <= end:
                return (start, end, name)
        return None

    for i, line in enumerate(lines):
        for kind, pat in ANCHORS:
            if not pat.search(line):
                continue
            f = in_which_func(i)
            if f is not None:
                func_hits[f].add(kind)
            else:
                # Top-level: only capture const-like declarations
                if kind == "const" or re.search(r"^\s*\w*[Pp]article\w*\s*=", line):
                    top_level.append({"line": i + 1, "text": line.strip()})
            break  # one anchor per line is enough

    hits_out: list[dict] = []
    for (start, end, name), kinds in sorted(func_hits.items()):
        hits_out.append(
            {
                "function": name,
                "lines": [start + 1, end + 1],
                "kinds": sorted(kinds),
            }
        )

    return hits_out, top_level


def main() -> None:
    if not CHAR_ROOT.exists():
        print(f"ERROR: {CHAR_ROOT} not found. Clone gcsim first.", file=sys.stderr)
        sys.exit(1)

    result: dict[str, dict] = {}
    total_funcs = 0

    for char_dir in sorted(CHAR_ROOT.iterdir()):
        if not char_dir.is_dir():
            continue
        char_id = char_dir.name

        files_out: dict[str, dict] = {}
        for go_file in sorted(char_dir.glob("*.go")):
            if go_file.name.endswith("_gen.go"):
                continue
            if go_file.name in SKIP_FILES:
                continue
            func_hits, top_level = scan_file(go_file)
            if not func_hits and not top_level:
                continue
            entry: dict = {}
            if top_level:
                entry["constants"] = top_level
            if func_hits:
                entry["functions"] = func_hits
                total_funcs += len(func_hits)
            files_out[go_file.name] = entry

        if files_out:
            result[char_id] = {"files": files_out}

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    # Summary
    chars_with_hits = len(result)
    all_chars = sum(1 for p in CHAR_ROOT.iterdir() if p.is_dir())
    print(f"Scanned {all_chars} characters; {chars_with_hits} have particle logic")
    print(f"Total flagged functions: {total_funcs}")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
