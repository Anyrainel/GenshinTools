#!/usr/bin/env python3
"""
Scrape elemental skill particle data from the Genshin Impact Fandom Wiki and
write the ER calculator's v2 particle schema.

Output: src/data/ercalc/particles.fandom.json  (per-source; v2 schema; source="fandom")

Source files and the merge pipeline:
  - particles.fandom.json  — this script's output
  - particles.gcsim.json   — from gcsim-particle-extract agents
  - particles.lunaris.json — from scrape_particles_lunaris.py (raw-event reference)
  - particles.json         — production, built by merge_particles_sources.py

The merge script picks gcsim > fandom per-character after human review.

v2 schema per character (see docs/er-calc-particle.md):
  {
    "element": "<Element>",
    "source": "fandom" | "lunaris" | "gcsim" | "manual",
    "spawnPoint"?: "Character" | "Enemy" | "Construct",
    "E"?:        { "particles": Particles, "notes"?: str },
    "holdE"?:    { "particles": Particles, "notes"?: str },
    "NA"?:       { "pattern":   Particles[], "notes"?: str },  // Phase 2
    "periodic"?: { "E"?: { "procs": int, "particles": Particles, "notes"?: str },
                   "Q"?: { ... } }
  }

Particles = number | Array<[count, chance]>

Classification (simple E / periodic / multi-hit) mirrors v1's
src/lib/ercalc/particleConfig.ts. Keep the PERIODIC_GENERATORS /
EXPECTED_PERIODIC_PROCS / MULTI_HIT_E_TOTAL dicts below in sync with that
file until v1 is removed.

Data source: https://genshin-impact.fandom.com/wiki/Energy/Data
"""

import json
import math
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beta_files import read_beta_json  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "src" / "data" / "ercalc" / "particles.fandom.json"

WIKI_API = (
    "https://genshin-impact.fandom.com/api.php"
    "?action=parse&page=Energy/Data&format=json&prop=wikitext"
)

# ── Classification (mirrors src/lib/ercalc/particleConfig.ts) ───────────────
# Characters whose E deploys a periodic particle generator. For these, the
# Fandom avgParticles is per-proc, not per-cast. Emit under periodic.E.
PERIODIC_GENERATORS: set[str] = {
    # Deployable skill generators
    "fischl",
    "xiangling",
    "albedo",
    "sangonomiya_kokomi",
    "furina",
    "kuki_shinobu",
    "yae_miko",
    "yaoyao",
    "chiori",
    "layla",
    "emilie",
    "nahida",
    "yumemizuki_mizuki",
    # Construct / periodic generators
    "raiden_shogun",
    "zhongli",
    "kachina",
    "ningguang",
    # Infusion / converted attack generators (reclassified to NA.pattern in Phase 2)
    "hu_tao",
    "kamisato_ayato",
    "wanderer",
    "wriothesley",
    "clorinde",
    "yoimiya",
    "tartaglia",
    # Other periodic
    "gaming",
    "faruzan",
    "alhaitham",
    "traveler_pyro",
    "lauma",
    "zibai",
}

# Default proc count per deployment (UI auto-placement hint). ~15-20s rotation.
EXPECTED_PERIODIC_PROCS: dict[str, int] = {
    "fischl": 7,
    "xiangling": 4,
    "albedo": 5,
    "sangonomiya_kokomi": 5,
    "furina": 5,
    "kuki_shinobu": 6,
    "yae_miko": 3,
    "yaoyao": 3,
    "chiori": 3,
    "layla": 3,
    "emilie": 4,
    "nahida": 1,
    "raiden_shogun": 5,
    "zhongli": 4,
    "hu_tao": 1,
    "kamisato_ayato": 3,
    "wanderer": 4,
    "wriothesley": 4,
    "clorinde": 4,
    "yoimiya": 4,
    "tartaglia": 3,
    "yumemizuki_mizuki": 4,
    "kachina": 5,
    "ningguang": 1,
    "gaming": 1,
    "faruzan": 1,
    "alhaitham": 3,
    "traveler_pyro": 3,
    "lauma": 3,
    "zibai": 4,
}

# Total particles per E use for multi-hit instant characters. Overrides the
# Fandom per-hit value which would otherwise undercount.
MULTI_HIT_E_TOTAL: dict[str, float] = {
    "diona": 4,
    "diluc": 1.33,
    "sigewinne": 4,
    "skirk": 4,
    "xianyun": 5,
    "chasca": 5,
    "chevreuse": 4,
}

# Map wiki character names to our character IDs.
# Fallback: lowercase + space→underscore + remove apostrophes.
NAME_TO_ID = {
    "Aether": "traveler",
    "Lumine": "traveler",
    "Hu Tao": "hu_tao",
    "Raiden Shogun": "raiden_shogun",
    "Arataki Itto": "arataki_itto",
    "Kamisato Ayaka": "kamisato_ayaka",
    "Kamisato Ayato": "kamisato_ayato",
    "Kaedehara Kazuha": "kaedehara_kazuha",
    "Kuki Shinobu": "kuki_shinobu",
    "Shikanoin Heizou": "shikanoin_heizou",
    "Sangonomiya Kokomi": "sangonomiya_kokomi",
    "Yun Jin": "yun_jin",
    "Kujou Sara": "kujou_sara",
    "Yae Miko": "yae_miko",
    "Yumemizuki Mizuki": "yumemizuki_mizuki",
    "Lan Yan": "lan_yan",
}

# Traveler variants use separate IDs.
TRAVELER_ELEMENT_MAP = {
    "Anemo": "traveler_anemo",
    "Dendro": "traveler_dendro",
    "Electro": "traveler_electro",
    "Geo": "traveler_geo",
    "Hydro": "traveler_hydro",
    "Pyro": "traveler_pyro",
}


def normalize_id(name: str) -> str:
    """Convert wiki character name to our character ID format."""
    name = name.strip()
    # Handle Traveler variants: "Traveler (Anemo)" etc.
    traveler_match = re.match(r"Traveler\s*\((\w+)\)", name)
    if traveler_match:
        element = traveler_match.group(1)
        return TRAVELER_ELEMENT_MAP.get(element, f"traveler_{element.lower()}")
    if name in NAME_TO_ID:
        return NAME_TO_ID[name]
    return name.lower().replace(" ", "_").replace("'", "")


def strip_refs(text: str) -> str:
    """Remove <ref> tags and their content."""
    return re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.DOTALL)


def extract_notes(text: str) -> str | None:
    """Extract text from <small>(...)</small> tags."""
    m = re.search(r"<small>\(?(.*?)\)?</small>", text)
    return m.group(1).strip() if m else None


def parse_particle_value(text: str) -> float | None:
    """Parse a particle count from a cell value.

    Handles: '2.25', '0', '3.33', '2×2' (=4), '3.67/4.67' (take first).
    Returns None for empty/mdash cells.
    """
    text = strip_refs(text)
    # Remove <small> tags but keep outer text
    text = re.sub(r"<small>.*?</small>", "", text, flags=re.DOTALL).strip()
    # Remove any remaining HTML
    text = re.sub(r"<[^>]+>", "", text).strip()

    if not text or text in ("&mdash;", "—", "-", "–"):
        return None

    # Handle multiplication: "2×2" → 4
    mult_match = re.match(r"([\d.]+)\s*[×x]\s*([\d.]+)", text)
    if mult_match:
        return float(mult_match.group(1)) * float(mult_match.group(2))

    # Handle slash notation: "3.67/4.67" → take first value
    slash_match = re.match(r"([\d.]+)\s*/\s*([\d.]+)", text)
    if slash_match:
        return float(slash_match.group(1))

    # Plain number
    try:
        return float(text)
    except ValueError:
        return None


def parse_element(text: str) -> str | None:
    """Extract element from {{Element}} template."""
    m = re.search(r"\{\{(\w+)\}\}", text)
    return m.group(1) if m else None


def parse_table(wikitext: str) -> dict:
    """Parse the Elemental Skills table from wikitext."""
    characters = {}

    # Find the first table (Elemental Skills)
    table_match = re.search(
        r'\{[|]\s*class="fandom-table sortable"(.*?)\|\}',
        wikitext,
        re.DOTALL,
    )
    if not table_match:
        print("ERROR: Could not find Elemental Skills table", file=sys.stderr)
        return {}

    table_text = table_match.group(1)

    # Split into rows by |-
    rows = re.split(r"\n\|-\s*\n", table_text)

    # Track current character for rowspan
    current_char_id = None
    remaining_rowspan = 0

    for row in rows:
        row = row.strip()
        if not row or row.startswith("!"):
            continue

        # Split into cells
        lines = row.split("\n")
        cells = []
        for line in lines:
            line = line.strip()
            if not line.startswith("|"):
                continue
            # Split by || for multi-cell lines
            parts = line.lstrip("|").split("||")
            cells.extend([p.strip() for p in parts])

        if not cells:
            continue

        # Check if first cell has a character template
        char_match = re.search(r"\{\{Character\|([^|}]+)", cells[0])

        if char_match:
            # New character row
            char_name = char_match.group(1).strip()
            char_id = normalize_id(char_name)

            # Check for rowspan on character cell
            rowspan_match = re.search(r'rowspan="(\d+)"', cells[0])
            remaining_rowspan = int(rowspan_match.group(1)) - 1 if rowspan_match else 0
            current_char_id = char_id

            # Parse remaining cells
            # Determine if colspan="2" is used (press+hold merged)
            cell_idx = 1  # Start after character cell
            press_val = None
            hold_val = None
            press_notes = None
            hold_notes = None
            element = None
            spawn_point = None

            if cell_idx < len(cells):
                cell = cells[cell_idx]
                colspan_match = re.search(r'colspan="2"', cell)
                if colspan_match:
                    # Same value for press and hold
                    val_text = re.sub(r'colspan="2"\s*\|?\s*', "", cell)
                    press_val = parse_particle_value(val_text)
                    hold_val = press_val
                    press_notes = extract_notes(cell)
                    hold_notes = press_notes
                    cell_idx += 1
                else:
                    # Separate press value (skip rowspan markers)
                    clean = re.sub(r'rowspan="\d+"\s*\|?\s*', "", cell)
                    press_val = parse_particle_value(clean)
                    press_notes = extract_notes(cell)
                    cell_idx += 1

                    # Hold value
                    if cell_idx < len(cells):
                        hold_cell = cells[cell_idx]
                        # Skip rowspan markers on hold cell
                        if 'rowspan="' in hold_cell:
                            clean = re.sub(r'rowspan="\d+"\s*\|?\s*', "", hold_cell)
                        else:
                            clean = hold_cell
                        hold_val = parse_particle_value(clean)
                        hold_notes = extract_notes(hold_cell)
                        cell_idx += 1

            # Element
            if cell_idx < len(cells):
                el_cell = cells[cell_idx]
                # Skip rowspan markers
                clean = re.sub(r'rowspan="\d+"\s*\|?\s*', "", el_cell)
                element = parse_element(clean)
                cell_idx += 1

            # Spawn point
            if cell_idx < len(cells):
                sp_cell = cells[cell_idx]
                clean = re.sub(r'rowspan="\d+"\s*\|?\s*', "", sp_cell)
                clean = clean.strip()
                if clean and clean not in ("&mdash;", "—"):
                    spawn_point = clean
                cell_idx += 1

            # Build entry
            entry = {"element": element, "spawnPoint": spawn_point, "variants": []}

            variant = {}
            if press_val is not None:
                variant["press"] = press_val
                if press_notes:
                    variant["pressNotes"] = press_notes
            if hold_val is not None and hold_val != press_val:
                variant["hold"] = hold_val
                if hold_notes and hold_notes != press_notes:
                    variant["holdNotes"] = hold_notes
            elif hold_val is not None and hold_val == press_val:
                # colspan case: store once, no separate hold
                pass

            if variant:
                entry["variants"].append(variant)

            # Store or merge (some chars appear twice like Dori with 元素能量恢復)
            if char_id in characters:
                characters[char_id]["variants"].extend(entry["variants"])
            else:
                characters[char_id] = entry

        elif remaining_rowspan > 0:
            # Continuation row for multi-row character
            remaining_rowspan -= 1
            if current_char_id and current_char_id in characters:
                # Parse the additional press/hold values
                variant = {}
                if cells:
                    # First cell is press value
                    press_val = parse_particle_value(cells[0])
                    press_notes = extract_notes(cells[0])
                    if press_val is not None:
                        variant["press"] = press_val
                        if press_notes:
                            variant["pressNotes"] = press_notes

                    # Second cell might be hold value (if present and not element/spawn)
                    if len(cells) > 1:
                        maybe_hold = cells[1]
                        # Check if it's an element template or hold value
                        if not re.search(r"\{\{\w+\}\}", maybe_hold):
                            hold_val = parse_particle_value(maybe_hold)
                            hold_notes = extract_notes(maybe_hold)
                            if hold_val is not None:
                                variant["hold"] = hold_val
                                if hold_notes:
                                    variant["holdNotes"] = hold_notes

                if variant:
                    characters[current_char_id]["variants"].append(variant)

    return characters


def to_particles(avg: float | int | None):
    """Extrapolate a Fandom avg value into the v2 Particles form.

    - None or 0       → None (omit the field entirely)
    - integer N       → N (shorthand)
    - float N.f       → [[floor(N.f), 1.0], [1, round(frac, 4)]]

    Examples:
      2.25 → [[2, 1.0], [1, 0.25]]
      3.0  → 3
      0.67 → [[1, 0.67]]         (floor=0 collapses to a single 1-count roll)
      4.0  → 4
    """
    if avg is None:
        return None
    if avg == 0:
        return None
    # Integer-valued (treat 3.0 as 3)
    if float(avg).is_integer():
        return int(avg)
    floor = int(math.floor(avg))
    frac = round(avg - floor, 4)
    if floor == 0:
        # Pure probabilistic: "X% chance of 1 particle"
        return [[1, frac]]
    return [[floor, 1.0], [1, frac]]


def _action_entry(particles, notes: str | None) -> dict | None:
    if particles is None:
        return None
    entry: dict = {"particles": particles}
    if notes:
        entry["notes"] = notes
    return entry


def build_output(characters: dict) -> dict:
    """Convert parsed Fandom data to the v2 ER-calc particle schema.

    Classification rules (mirrors v1 particleConfig.ts):
      - charId in MULTI_HIT_E_TOTAL  → E.particles = integer total (overrides Fandom)
      - charId in PERIODIC_GENERATORS → periodic.E = { procs, particles }
      - otherwise                     → E.particles (+ holdE if distinct)

    Characters listed as periodic AND matching an infusion note (hu_tao,
    yoimiya, etc.) stay under periodic.E for Phase 1. The migration to
    NA.pattern happens in Phase 2 with gcsim-sourced hit patterns.
    """
    output: dict = {}
    for char_id, data in sorted(characters.items()):
        variants = data.get("variants", [])
        primary = variants[0] if variants else {}
        press_avg = primary.get("press")
        press_notes = primary.get("pressNotes")
        hold_avg = primary.get("hold")
        hold_notes = primary.get("holdNotes")

        entry: dict = {
            "element": data.get("element"),
            "source": "fandom",
        }
        spawn = data.get("spawnPoint")
        if spawn:
            entry["spawnPoint"] = spawn

        # Dispatch by classification
        if char_id in MULTI_HIT_E_TOTAL:
            total = MULTI_HIT_E_TOTAL[char_id]
            note = press_notes or "multi-hit instant; total per cast"
            e = _action_entry(to_particles(total), note)
            if e:
                entry["E"] = e
            # Preserve hold if it's a distinct, non-multi-hit value
            if hold_avg is not None and hold_avg != press_avg:
                h = _action_entry(to_particles(hold_avg), hold_notes)
                if h:
                    entry["holdE"] = h

        elif char_id in PERIODIC_GENERATORS:
            # Fandom avg for periodic chars is per-proc
            per_proc = press_avg if press_avg is not None else hold_avg
            procs = EXPECTED_PERIODIC_PROCS.get(char_id, 3)
            note = press_notes or hold_notes
            particles = to_particles(per_proc)
            if particles is not None:
                periodic_e: dict = {"procs": procs, "particles": particles}
                if note:
                    periodic_e["notes"] = note
                entry["periodic"] = {"E": periodic_e}

        else:
            e = _action_entry(to_particles(press_avg), press_notes)
            if e:
                entry["E"] = e
            # holdE: only emit if distinct from press
            if hold_avg is not None and hold_avg != press_avg:
                h = _action_entry(to_particles(hold_avg), hold_notes)
                if h:
                    entry["holdE"] = h

        # Additional variants → attach as a top-level list of action entries
        # for later manual review. Phase 2 gcsim pass will decide whether any
        # become specialE / specialQ / etc.
        if len(variants) > 1:
            extras = []
            for v in variants[1:]:
                p = v.get("press") if v.get("press") is not None else v.get("hold")
                n = v.get("pressNotes") or v.get("holdNotes")
                part = to_particles(p)
                if part is not None:
                    ex: dict = {"particles": part}
                    if n:
                        ex["notes"] = n
                    extras.append(ex)
            if extras:
                entry["_variants"] = extras

        output[char_id] = entry

    return output


def main():
    print("Fetching Fandom Wiki Energy/Data page...")
    req = Request(WIKI_API, headers={"User-Agent": "GenshinTools-ParticleScraper/1.0"})
    with urlopen(req, timeout=30) as resp:
        api_data = json.loads(resp.read().decode())

    wikitext = api_data["parse"]["wikitext"]["*"]

    print("Parsing Elemental Skills table...")
    characters = parse_table(wikitext)
    print(f"  Parsed {len(characters)} characters from wiki")

    if len(characters) < 50:
        print(
            f"WARNING: Only {len(characters)} characters parsed — expected 100+.",
            file=sys.stderr,
        )

    output = build_output(characters)

    # Fallback: supplement missing characters from character_stats.json
    char_stats_path = ROOT / "src" / "data" / "game" / "character_stats.json"
    beta_stats_path = ROOT / "src" / "data" / "game" / "character_beta_stats.json.gz"
    all_stats = {}
    for sp in [char_stats_path, beta_stats_path]:
        if not sp.exists():
            continue
        if sp.suffix == ".gz":
            all_stats.update(read_beta_json(sp))
        else:
            with open(sp, encoding="utf-8") as f:
                all_stats.update(json.load(f))

    # Validate against charInfo
    char_info_path = ROOT / "src" / "data" / "charInfo.ts"
    # NPC template IDs to exclude from missing check
    npc_ids = {
        *[f"manekin_{e}" for e in ("anemo", "cryo", "dendro", "electro", "geo", "hydro", "pyro")],
        *[f"manekina_{e}" for e in ("anemo", "cryo", "dendro", "electro", "geo", "hydro", "pyro")],
    }
    if char_info_path.exists():
        with open(char_info_path, encoding="utf-8") as f:
            content = f.read()
        known_ids = set(re.findall(r"^\s+(\w+):", content, re.MULTILINE))
        scraped_ids = set(output.keys())
        missing = known_ids - scraped_ids - npc_ids
        if missing:
            print(f"  Characters in charInfo but not in scraped data: {sorted(missing)}")
            # Fill from character_stats.json energy data (lunaris-derived,
            # integer-only since character_stats drops the chance field).
            # Run scripts/scrape_particles_lunaris.py for the full probabilistic
            # reference at src/data/ercalc/particles.lunaris.json.
            for cid in sorted(missing):
                stats_entry = all_stats.get(cid, {})
                energy_data = stats_entry.get("energy")
                element = stats_entry.get("element")
                entry: dict = {"element": element, "source": "lunaris"}
                if energy_data:
                    total = sum(int(e.get("particles", 0)) for e in energy_data)
                    if cid in PERIODIC_GENERATORS:
                        procs = EXPECTED_PERIODIC_PROCS.get(cid, 3)
                        per_proc = max(1, round(total / procs)) if total > 0 else 0
                        if per_proc > 0:
                            entry["periodic"] = {
                                "E": {
                                    "procs": procs,
                                    "particles": per_proc,
                                    "notes": "from character_stats.json (integer, split by procs)",
                                }
                            }
                    elif total > 0:
                        entry["E"] = {
                            "particles": total,
                            "notes": "from character_stats.json (integer)",
                        }
                    print(f"    → {cid}: filled from character_stats.json (total={total})")
                else:
                    print(f"    → {cid}: no particle data, defaulting to empty")
                output[cid] = entry

        extra = scraped_ids - known_ids
        if extra:
            print(f"  Characters in scraped data but not in charInfo: {sorted(extra)}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(output)} characters to {OUT_PATH}")


if __name__ == "__main__":
    main()
