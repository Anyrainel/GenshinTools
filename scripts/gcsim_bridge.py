"""
gcsim Bridge — Generate gcsim configs from our team presets, run simulations,
and extract energy statistics for comparison with our ER calculator.

Usage:
    uv run --project scripts/pyproject.toml scripts/gcsim_bridge.py \
        generate <preset_id>
    uv run --project scripts/pyproject.toml scripts/gcsim_bridge.py \
        run <config_path> [--gcsim <gcsim_exe>] [--iterations N]
    uv run --project scripts/pyproject.toml scripts/gcsim_bridge.py \
        compare <preset_id> [--gcsim <gcsim_exe>]
    uv run --project scripts/pyproject.toml scripts/gcsim_bridge.py \
        download

Requires: gcsim CLI binary (Windows amd64 available from GitHub releases).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
GCSIM_REPO = PROJECT_ROOT.parent / "gcsim"
GCSIM_RELEASE_TAG = "v2.41.1"
GCSIM_RELEASE_URL = (
    f"https://github.com/genshinsim/gcsim/releases/download/{GCSIM_RELEASE_TAG}"
    "/gcsim_windows_amd64.exe"
)
GCSIM_BIN_DIR = SCRIPT_DIR / "bin"
GCSIM_DEFAULT_EXE = GCSIM_BIN_DIR / "gcsim.exe"

PARTICLES_JSON = PROJECT_ROOT / "src" / "data" / "ercalc" / "particles.json"
PRESETS_TS = PROJECT_ROOT / "src" / "data" / "ercalc" / "presetRotations.ts"

# Our character IDs use underscored names (e.g. raiden_shogun, hu_tao).
# gcsim uses short lowercase keys (e.g. raiden, hutao).
# This mapping covers cases where they differ.
OUR_ID_TO_GCSIM: dict[str, str] = {
    "raiden_shogun": "raiden",
    "hu_tao": "hutao",
    "kamisato_ayaka": "ayaka",
    "kamisato_ayato": "ayato",
    "kaedehara_kazuha": "kazuha",
    "sangonomiya_kokomi": "kokomi",
    "kuki_shinobu": "kuki",
    "shikanoin_heizou": "heizou",
    "arataki_itto": "itto",
    "yae_miko": "yaemiko",
    "yumemizuki_mizuki": "mizuki",
    "traveler_pyro": "travelerelectro",  # placeholder — travelers need special handling
}

# Burst energy costs by character (subset; gcsim normally gets this from char data)
BURST_COSTS: dict[str, int] = {
    "bennett": 60,
    "xiangling": 80,
    "xingqiu": 80,
    "sucrose": 80,
    "raiden": 90,
    "fischl": 60,
    "yelan": 70,
    "furina": 60,
    "kazuha": 60,
    "zhongli": 40,
    "nahida": 50,
    "albedo": 40,
    "kokomi": 70,
    "hutao": 60,
    "ayaka": 80,
    "ayato": 80,
    "ganyu": 60,
    "venti": 60,
    "mona": 60,
    "jean": 80,
}

ELEMENT_MAP: dict[str, str] = {
    "Pyro": "pyro",
    "Hydro": "hydro",
    "Electro": "electro",
    "Cryo": "cryo",
    "Anemo": "anemo",
    "Geo": "geo",
    "Dendro": "dendro",
}

# Our weapon IDs → gcsim weapon keys (only for weapons that exist in presets)
OUR_WEAPON_TO_GCSIM: dict[str, str] = {
    "favonius_sword": "favoniussword",
    "favonius_lance": "favoniuslance",
    "favonius_warbow": "favoniuswarbow",
    "favonius_greatsword": "favoniusgreatsword",
    "favonius_codex": "favoniuscodex",
    "prototype_amber": "prototypeamber",
    "amenoma_kageuchi": "amenomakageuchi",
    "kitain_cross_spear": "kitaincrossspear",
    "katsuragikiri_nagamasa": "katsuragikirinagamasa",
    "sacrificial_sword": "sacrificialsword",
    "sacrificial_fragments": "sacrificialfragments",
    "sacrificial_bow": "sacrificialbow",
    "sacrificial_greatsword": "sacrificialgreatsword",
    "the_catch": "thecatch",
    "engulfing_lightning": "engulfinglightning",
}


def to_gcsim_name(our_id: str) -> str:
    """Convert our character ID to gcsim's character key."""
    if our_id in OUR_ID_TO_GCSIM:
        return OUR_ID_TO_GCSIM[our_id]
    # Most IDs match directly after removing underscores
    return our_id.replace("_", "")


def load_particles() -> dict[str, Any]:
    """Load our particles.json data."""
    with open(PARTICLES_JSON, encoding="utf-8") as f:
        return json.load(f)


def parse_presets_quick() -> list[dict[str, Any]]:
    """
    Quick-and-dirty extraction of preset data from the TypeScript source.
    Returns a list of preset dicts with id, team, and timeline.

    This is intentionally simple — it reads the JSON-like structures
    embedded in the TS file rather than trying to parse full TypeScript.
    """
    text = PRESETS_TS.read_text(encoding="utf-8")

    presets = []
    # Find each preset block by looking for id: "..."
    import re

    # Extract preset blocks between { id: ... } at the top level of the array
    blocks = re.split(r"\n  \{\n    id:", text)
    for block in blocks[1:]:  # skip preamble
        preset: dict[str, Any] = {}

        # Extract id
        id_match = re.search(r'^["\s]*"([^"]+)"', block)
        if not id_match:
            continue
        preset["id"] = id_match.group(1)

        # Extract team members (each member is a { ... } block in the team array)
        team = []
        team_section = re.search(r"team:\s*\[(.*?)\]", block, re.DOTALL)
        if team_section:
            # Split on individual member objects
            member_blocks = re.findall(
                r"\{[^}]+\}",
                team_section.group(1),
            )
            for mb in member_blocks:
                id_m = re.search(r'id:\s*"([^"]+)"', mb)
                elem_m = re.search(r'element:\s*"([^"]+)"', mb)
                cost_m = re.search(r"burstCost:\s*(\d+)", mb)
                if not id_m or not elem_m or not cost_m:
                    continue
                member: dict[str, Any] = {
                    "id": id_m.group(1),
                    "element": elem_m.group(1),
                    "burstCost": int(cost_m.group(1)),
                }
                # Optional fields
                weapon_m = re.search(r'weaponId:\s*"([^"]+)"', mb)
                if weapon_m:
                    member["weaponId"] = weapon_m.group(1)
                refine_m = re.search(r"refinement:\s*(\d+)", mb)
                if refine_m:
                    member["refinement"] = int(refine_m.group(1))
                cons_m = re.search(r"constellation:\s*(\d+)", mb)
                if cons_m:
                    member["constellation"] = int(cons_m.group(1))
                team.append(member)
        preset["team"] = team

        # Extract timeline
        timeline = []
        tl_section = re.search(r"timeline:\s*\[(.*?)\]", block, re.DOTALL)
        if tl_section:
            actions = re.findall(
                r'\{\s*char:\s*"([^"]+)".*?action:\s*"([^"]+)"',
                tl_section.group(1),
                re.DOTALL,
            )
            for char, action in actions:
                timeline.append({"char": char, "action": action})
        preset["timeline"] = timeline

        presets.append(preset)

    return presets


def generate_gcsim_config(preset: dict[str, Any], iterations: int = 1000) -> str:
    """
    Generate a gcsim config string from one of our team presets.

    This creates a minimal config with:
    - Default stats (90/90, talent 1,9,9)
    - No specific weapons/artifacts (uses baseline)
    - The rotation translated from our timeline format
    - ER set high enough to always burst (for ER requirement analysis,
      use the substat optimizer or ignore_burst_energy mode)
    """
    lines: list[str] = []

    # Options
    lines.append(f"options iteration={iterations} duration=90 swap_delay=4;")
    lines.append("target lvl=100 resist=0.1 particle_threshold=250000 particle_drop_count=1;")
    lines.append("")

    # Characters
    team = preset["team"]
    seen_chars: set[str] = set()
    for member in team:
        gcsim_name = to_gcsim_name(member["id"])
        if gcsim_name in seen_chars:
            continue
        seen_chars.add(gcsim_name)

        cons = member.get("constellation", 0)
        lines.append(f"{gcsim_name} char lvl=90/90 cons={cons} talent=1,9,9;")

        # Use weapon from preset if available, otherwise dullblade
        weapon_id = member.get("weaponId")
        refine = member.get("refinement", 0) + 1  # our 0-indexed → gcsim 1-indexed
        if weapon_id and weapon_id in OUR_WEAPON_TO_GCSIM:
            weapon_key = OUR_WEAPON_TO_GCSIM[weapon_id]
        else:
            weapon_key = "dullblade"
            refine = 1
        lines.append(f'{gcsim_name} add weapon="{weapon_key}" refine={refine} lvl=90/90;')
        # Give enough ER to burst reliably in baseline mode + crit for Favonius
        lines.append(f"{gcsim_name} add stats hp=4780 atk=311 er=0.8 cr=0.5 cd=1.0;")
        lines.append("")

    # Active character
    first_char = to_gcsim_name(team[0]["id"])
    lines.append(f"active {first_char};")
    lines.append("")

    # Rotation
    rotation_lines = translate_timeline_to_gcsim(preset["timeline"], preset["team"])
    lines.append("while 1 {")
    for rl in rotation_lines:
        lines.append(f"  {rl}")
    lines.append("}")

    return "\n".join(lines)


def translate_timeline_to_gcsim(
    timeline: list[dict[str, str]], team: list[dict[str, Any]]
) -> list[str]:
    """
    Translate our timeline format to gcsim action lines.

    Our format:
    - { char: "bennett", action: "E" }       -> bennett skill;
    - { char: "bennett", action: "Q" }       -> bennett burst;
    - { char: "xiangling", action: "periodicE" } -> (skipped — gcsim handles this internally)

    gcsim handles periodic generators (Guoba, Oz, etc.) automatically
    through its character implementations, so periodicE actions are
    comments only (for documentation).
    """
    action_map = {
        "E": "skill",
        "holdE": "skill[hold=1]",
        "Q": "burst",
        "specialQ": "burst",
        "NA": "attack",
        "CA": "charge",
        "PA": "high_plunge",
        "dash": "dash",
        "jump": "jump",
    }

    # Actions to skip (no gcsim equivalent)
    skip_actions = {"wait", "periodicE"}

    lines: list[str] = []

    for step in timeline:
        char_id = step["char"]
        action = step["action"]
        gcsim_name = to_gcsim_name(char_id)

        if action in skip_actions:
            lines.append(f"// {gcsim_name} {action}")
            continue

        gcsim_action = action_map.get(action)
        if gcsim_action is None:
            lines.append(f"// {gcsim_name} {action} (unmapped)")
            continue
        lines.append(f"{gcsim_name} {gcsim_action};")

    return lines


def generate_er_analysis_config(preset: dict[str, Any], iterations: int = 350) -> str:
    """
    Generate a gcsim config specifically for ER requirement analysis.

    Uses ignore_burst_energy=true so characters can always burst,
    allowing the substat optimizer to determine actual ER needs.
    """
    lines: list[str] = []

    lines.append(
        f"options iteration={iterations} duration=90 swap_delay=4 ignore_burst_energy=true;"
    )
    lines.append("target lvl=100 resist=0.1 particle_threshold=250000 particle_drop_count=1;")
    lines.append("")

    team = preset["team"]
    seen_chars: set[str] = set()
    for member in team:
        gcsim_name = to_gcsim_name(member["id"])
        if gcsim_name in seen_chars:
            continue
        seen_chars.add(gcsim_name)

        cons = member.get("constellation", 0)
        lines.append(f"{gcsim_name} char lvl=90/90 cons={cons} talent=1,9,9;")

        weapon_id = member.get("weaponId")
        refine = member.get("refinement", 0) + 1
        if weapon_id and weapon_id in OUR_WEAPON_TO_GCSIM:
            weapon_key = OUR_WEAPON_TO_GCSIM[weapon_id]
        else:
            weapon_key = "dullblade"
            refine = 1
        lines.append(f'{gcsim_name} add weapon="{weapon_key}" refine={refine} lvl=90/90;')
        # Minimal ER — the point is to measure what ER is actually needed
        lines.append(f"{gcsim_name} add stats hp=4780 atk=311 cr=0.5 cd=1.0;")
        lines.append("")

    first_char = to_gcsim_name(team[0]["id"])
    lines.append(f"active {first_char};")
    lines.append("")

    rotation_lines = translate_timeline_to_gcsim(preset["timeline"], team)
    lines.append("while 1 {")
    for rl in rotation_lines:
        lines.append(f"  {rl}")
    lines.append("}")

    return "\n".join(lines)


def find_gcsim_exe(explicit_path: str | None = None) -> Path:
    """Find the gcsim executable."""
    if explicit_path:
        p = Path(explicit_path)
        if p.exists():
            return p
        raise FileNotFoundError(f"gcsim executable not found at: {explicit_path}")

    # Check default download location
    if GCSIM_DEFAULT_EXE.exists():
        return GCSIM_DEFAULT_EXE

    # Check PATH
    import shutil

    found = shutil.which("gcsim")
    if found:
        return Path(found)

    raise FileNotFoundError(
        "gcsim executable not found. Either:\n"
        f"  1. Run: python {__file__} download\n"
        f"  2. Place gcsim.exe at {GCSIM_DEFAULT_EXE}\n"
        "  3. Add gcsim to your PATH\n"
        "  4. Pass --gcsim <path>"
    )


def run_gcsim(
    config_path: Path,
    gcsim_exe: Path,
    output_path: Path | None = None,
) -> dict[str, Any]:
    """
    Run gcsim with the given config and return parsed JSON results.

    Args:
        config_path: Path to the .txt config file
        gcsim_exe: Path to the gcsim executable
        output_path: If set, save the JSON result to this path

    Returns:
        Parsed JSON result dict from gcsim
    """
    if output_path is None:
        output_path = config_path.with_suffix(".json")

    cmd = [
        str(gcsim_exe),
        "-c",
        str(config_path),
        "-out",
        str(output_path),
    ]

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    if result.returncode != 0:
        print(f"STDOUT:\n{result.stdout}")
        print(f"STDERR:\n{result.stderr}")
        raise RuntimeError(f"gcsim exited with code {result.returncode}")

    print(result.stdout)

    # gcsim saves as .json or .json.gz depending on flags
    json_path = output_path
    gz_path = Path(str(output_path) + ".gz")

    if gz_path.exists():
        # Decompress zlib-compressed JSON
        with open(gz_path, "rb") as f:
            raw = zlib.decompress(f.read())
        return json.loads(raw)
    elif json_path.exists():
        with open(json_path, encoding="utf-8") as f:
            return json.load(f)
    else:
        raise FileNotFoundError(f"gcsim output not found at {json_path} or {gz_path}")


def extract_energy_stats(result: dict[str, Any]) -> dict[str, Any]:
    """
    Extract energy-related statistics from gcsim JSON results.

    Returns a dict with per-character energy information:
    - ending_energy: average energy at simulation end
    - energy_sources: breakdown of energy by source
    - insufficient_energy_warnings: whether bursts failed due to energy
    """
    stats = result.get("statistics", {})
    char_names = [
        c.get("name", f"char_{i}") for i, c in enumerate(result.get("character_details", []))
    ]

    energy_info: dict[str, Any] = {"characters": {}}

    # End stats (ending energy per character)
    end_stats = stats.get("end_stats", [])
    for i, es in enumerate(end_stats):
        name = char_names[i] if i < len(char_names) else f"char_{i}"
        ending = es.get("ending_energy", {})
        energy_info["characters"][name] = {
            "ending_energy_mean": ending.get("mean", 0),
            "ending_energy_min": ending.get("min", 0),
            "ending_energy_max": ending.get("max", 0),
        }

    # Total source energy per character
    source_energy = stats.get("total_source_energy", [])
    for i, se in enumerate(source_energy):
        name = char_names[i] if i < len(char_names) else f"char_{i}"
        if name not in energy_info["characters"]:
            energy_info["characters"][name] = {}
        sources = se.get("sources", {})
        energy_info["characters"][name]["energy_sources"] = {
            src: {
                "mean": data.get("mean", 0),
                "min": data.get("min", 0),
                "max": data.get("max", 0),
                "sd": data.get("sd", 0),
            }
            for src, data in sources.items()
        }

    # Failed actions (insufficient energy)
    failed = stats.get("failed_actions", [])
    for i, fa in enumerate(failed):
        name = char_names[i] if i < len(char_names) else f"char_{i}"
        if name not in energy_info["characters"]:
            energy_info["characters"][name] = {}
        ie = fa.get("insufficient_energy", {})
        energy_info["characters"][name]["insufficient_energy_rate"] = ie.get("mean", 0)

    # Warnings
    warnings = stats.get("warnings", {})
    energy_info["has_energy_warning"] = warnings.get("insufficient_energy", False)

    return energy_info


def compare_with_our_calc(
    preset: dict[str, Any],
    gcsim_energy: dict[str, Any],
) -> None:
    """
    Print a comparison of gcsim's energy results with our team preset data.

    This is a qualitative comparison since our ER calculator uses a deterministic
    timeline model while gcsim uses Monte Carlo simulation.
    """
    print("\n" + "=" * 70)
    print(f"COMPARISON: Preset '{preset['id']}'")
    print("=" * 70)

    print("\n--- Our Team Preset ---")
    for member in preset["team"]:
        print(
            f"  {member['id']:20s}  element={member['element']:8s}  burstCost={member['burstCost']}"
        )

    print("\n--- gcsim Energy Results ---")
    chars = gcsim_energy.get("characters", {})
    for name, data in chars.items():
        print(f"\n  {name}:")
        if "ending_energy_mean" in data:
            print(
                f"    Ending energy:  mean={data['ending_energy_mean']:.1f}"
                f"  min={data['ending_energy_min']:.1f}"
                f"  max={data['ending_energy_max']:.1f}"
            )
        if "insufficient_energy_rate" in data:
            rate = data["insufficient_energy_rate"]
            if rate > 0:
                print(f"    Burst failures: {rate:.1f} per sim (insufficient energy)")
        if "energy_sources" in data:
            print("    Energy sources:")
            for src, sdata in sorted(data["energy_sources"].items()):
                if sdata["mean"] > 0.5:  # skip negligible sources
                    print(f"      {src:30s}  mean={sdata['mean']:6.1f}  sd={sdata['sd']:.1f}")

    if gcsim_energy.get("has_energy_warning"):
        print("\n  WARNING: gcsim detected insufficient energy in this team!")

    print("\n--- Key Differences ---")
    print("  Our ER calculator:")
    print("    - Deterministic timeline model (no RNG)")
    print("    - Explicit particle timing from timeline actions")
    print("    - Off-field multiplier based on party size")
    print("    - NA energy: flat (no ER scaling), weapon-type-dependent")
    print("  gcsim:")
    print("    - Monte Carlo simulation (RNG for particles, crits, etc.)")
    print("    - Frame-accurate character implementations")
    print("    - Models normal attack energy, weapon passives, hitlag")
    print("    - Enemy particle drops based on damage thresholds")
    print("=" * 70)


def download_gcsim() -> None:
    """Download the gcsim Windows binary from GitHub releases."""
    import urllib.request

    GCSIM_BIN_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Downloading gcsim {GCSIM_RELEASE_TAG} for Windows...")
    print(f"  URL:  {GCSIM_RELEASE_URL}")
    print(f"  Dest: {GCSIM_DEFAULT_EXE}")

    try:
        urllib.request.urlretrieve(GCSIM_RELEASE_URL, GCSIM_DEFAULT_EXE)
        print(f"Downloaded successfully ({GCSIM_DEFAULT_EXE.stat().st_size / 1024 / 1024:.1f} MB)")
    except Exception as e:
        print(f"Download failed: {e}")
        print("You can manually download from:")
        print(f"  https://github.com/genshinsim/gcsim/releases/tag/{GCSIM_RELEASE_TAG}")
        sys.exit(1)


def cmd_generate(args: argparse.Namespace) -> None:
    """Generate a gcsim config from a preset."""
    presets = parse_presets_quick()
    preset = next((p for p in presets if p["id"] == args.preset_id), None)
    if preset is None:
        available = [p["id"] for p in presets]
        print(f"Preset '{args.preset_id}' not found. Available: {available}")
        sys.exit(1)

    if args.er_mode:
        config = generate_er_analysis_config(preset, iterations=args.iterations)
    else:
        config = generate_gcsim_config(preset, iterations=args.iterations)

    output = args.output or f"gcsim_{args.preset_id}.txt"
    output_path = Path(output)
    output_path.write_text(config, encoding="utf-8")
    print(f"Generated gcsim config: {output_path}")
    print(f"\nConfig preview:\n{config}")


def cmd_run(args: argparse.Namespace) -> None:
    """Run gcsim with a config file."""
    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Config file not found: {config_path}")
        sys.exit(1)

    gcsim_exe = find_gcsim_exe(args.gcsim)
    result = run_gcsim(config_path, gcsim_exe)

    energy = extract_energy_stats(result)
    print("\n--- Energy Statistics ---")
    print(json.dumps(energy, indent=2))


def cmd_compare(args: argparse.Namespace) -> None:
    """Generate config, run gcsim, and compare with our ER calculator."""
    presets = parse_presets_quick()
    preset = next((p for p in presets if p["id"] == args.preset_id), None)
    if preset is None:
        available = [p["id"] for p in presets]
        print(f"Preset '{args.preset_id}' not found. Available: {available}")
        sys.exit(1)

    gcsim_exe = find_gcsim_exe(args.gcsim)

    with tempfile.TemporaryDirectory() as tmpdir:
        config = generate_gcsim_config(preset, iterations=args.iterations)
        config_path = Path(tmpdir) / "config.txt"
        config_path.write_text(config, encoding="utf-8")
        output_path = Path(tmpdir) / "result.json"

        print(f"Config:\n{config}\n")
        result = run_gcsim(config_path, gcsim_exe, output_path)
        energy = extract_energy_stats(result)
        compare_with_our_calc(preset, energy)


def generate_variation_configs(
    preset: dict[str, Any],
) -> list[tuple[str, dict[str, Any]]]:
    """
    Generate rotation variations from a preset for fuzzy comparison.

    Returns a list of (label, modified_preset) tuples.
    """
    import copy

    team = preset["team"]
    timeline = preset["timeline"]
    variations: list[tuple[str, dict[str, Any]]] = []

    # 1. Baseline
    variations.append(("baseline", preset))

    # 2. Add 1 NA after each E
    tl1 = []
    for act in timeline:
        tl1.append(act)
        if act["action"] in ("E", "holdE"):
            tl1.append({"char": act["char"], "action": "NA"})
    p1 = copy.deepcopy(preset)
    p1["timeline"] = tl1
    variations.append(("+1 NA after E", p1))

    # 3. Add 2 NAs after each E
    tl2 = []
    for act in timeline:
        tl2.append(act)
        if act["action"] in ("E", "holdE"):
            tl2.append({"char": act["char"], "action": "NA"})
            tl2.append({"char": act["char"], "action": "NA"})
    p2 = copy.deepcopy(preset)
    p2["timeline"] = tl2
    variations.append(("+2 NAs after E", p2))

    # 4. Double E casts
    tl3 = []
    for act in timeline:
        tl3.append(act)
        if act["action"] == "E":
            tl3.append(dict(act))
    p3 = copy.deepcopy(preset)
    p3["timeline"] = tl3
    variations.append(("double E casts", p3))

    # 5. Remove periodicE
    tl4 = [a for a in timeline if a["action"] != "periodicE"]
    if len(tl4) < len(timeline):
        p4 = copy.deepcopy(preset)
        p4["timeline"] = tl4
        variations.append(("no periodicE", p4))

    # 6. Add 3 NAs for first char at end
    carry = team[0]
    tl5 = list(timeline) + [{"char": carry["id"], "action": "NA"} for _ in range(3)]
    p5 = copy.deepcopy(preset)
    p5["timeline"] = tl5
    variations.append((f"+3 NAs for {carry['id']}", p5))

    return variations


def cmd_fuzz(args: argparse.Namespace) -> None:
    """Generate rotation variations and compare our calc vs gcsim."""
    presets = parse_presets_quick()
    preset = next((p for p in presets if p["id"] == args.preset_id), None)
    if preset is None:
        available = [p["id"] for p in presets]
        print(f"Preset '{args.preset_id}' not found. Available: {available}")
        sys.exit(1)

    gcsim_exe = find_gcsim_exe(args.gcsim)
    variations = generate_variation_configs(preset)

    print(f"\n{'=' * 70}")
    print(f"FUZZ COMPARISON: {args.preset_id} ({len(variations)} variations)")
    print(f"{'=' * 70}")

    for label, variant in variations:
        print(f"\n--- {label} ({len(variant['timeline'])} actions) ---")

        # Run gcsim
        with tempfile.TemporaryDirectory() as tmpdir:
            config = generate_gcsim_config(variant, iterations=args.iterations)
            config_path = Path(tmpdir) / "config.txt"
            config_path.write_text(config, encoding="utf-8")
            output_path = Path(tmpdir) / "result.json"

            try:
                result = run_gcsim(config_path, gcsim_exe, output_path)
                energy = extract_energy_stats(result)
                chars = energy.get("characters", {})
                for name, data in chars.items():
                    ending = data.get("ending_energy_mean", 0)
                    failures = data.get("insufficient_energy_rate", 0)
                    sources = data.get("energy_sources", {})
                    total = sum(s.get("mean", 0) for s in sources.values())
                    na_energy = sources.get("na-ca-on-hit", {}).get("mean", 0)
                    print(
                        f"  {name:20s}  total={total:6.1f}  ending={ending:5.1f}"
                        f"  failures={failures:4.1f}  na_energy={na_energy:.1f}"
                    )
            except Exception as e:
                print(f"  gcsim error: {e}")

    # Also run our calc via the TS CLI for direct comparison
    print(f"\n{'=' * 70}")
    print("Running our ER calc for same variations...")
    print(f"{'=' * 70}")
    try:
        import shutil

        npx_path = shutil.which("npx") or "npx"
        result = subprocess.run(
            [
                npx_path,
                "tsx",
                "--tsconfig",
                "tsconfig.app.json",
                "scripts/er_calc_cli.ts",
                "fuzz",
                args.preset_id,
                "--variations",
                str(len(variations)),
                "--json",
            ],
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT),
            timeout=60,
        )
        if result.returncode == 0:
            our_data = json.loads(result.stdout)
            for v in our_data.get("variations", []):
                print(f"\n--- {v['label']} ---")
                for r in v["results"]:
                    er = "∞" if r["erNeeded"] == float("inf") else f"{r['erNeeded']:.0f}%"
                    flat = r.get("flatEnergy") or 0
                    particle = r.get("particleEnergy") or 0
                    print(
                        f"  {r['charId']:20s}  ER={er:>8s}"
                        f"  particle={particle:5.1f}  flat={flat:5.1f}"
                    )
        else:
            print(f"Our calc error: {result.stderr}")
    except Exception as e:
        print(f"Failed to run our calc: {e}")


def cmd_download(args: argparse.Namespace) -> None:
    """Download gcsim binary."""
    download_gcsim()


def cmd_list(args: argparse.Namespace) -> None:
    """List available presets."""
    presets = parse_presets_quick()
    print(f"Found {len(presets)} presets:\n")
    for p in presets:
        team_str = ", ".join(m["id"] for m in p["team"])
        print(f"  {p['id']:25s}  [{team_str}]")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="gcsim Bridge — generate configs, run sims, compare ER results"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # generate
    gen_p = subparsers.add_parser("generate", help="Generate a gcsim config from a preset")
    gen_p.add_argument("preset_id", help="Preset ID from presetRotations.ts")
    gen_p.add_argument("-o", "--output", help="Output file path")
    gen_p.add_argument("-n", "--iterations", type=int, default=1000)
    gen_p.add_argument(
        "--er-mode",
        action="store_true",
        help="Generate config for ER analysis (ignore_burst_energy=true)",
    )
    gen_p.set_defaults(func=cmd_generate)

    # run
    run_p = subparsers.add_parser("run", help="Run gcsim with a config file")
    run_p.add_argument("config", help="Path to gcsim config file")
    run_p.add_argument("--gcsim", help="Path to gcsim executable")
    run_p.set_defaults(func=cmd_run)

    # compare
    cmp_p = subparsers.add_parser("compare", help="Generate, run, and compare with our ER calc")
    cmp_p.add_argument("preset_id", help="Preset ID from presetRotations.ts")
    cmp_p.add_argument("--gcsim", help="Path to gcsim executable")
    cmp_p.add_argument("-n", "--iterations", type=int, default=1000)
    cmp_p.set_defaults(func=cmd_compare)

    # fuzz
    fuzz_p = subparsers.add_parser(
        "fuzz", help="Generate rotation variations and compare our calc vs gcsim"
    )
    fuzz_p.add_argument("preset_id", help="Preset ID from presetRotations.ts")
    fuzz_p.add_argument("--gcsim", help="Path to gcsim executable")
    fuzz_p.add_argument("-n", "--iterations", type=int, default=500)
    fuzz_p.set_defaults(func=cmd_fuzz)

    # download
    dl_p = subparsers.add_parser("download", help="Download gcsim Windows binary")
    dl_p.set_defaults(func=cmd_download)

    # list
    list_p = subparsers.add_parser("list", help="List available presets")
    list_p.set_defaults(func=cmd_list)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
