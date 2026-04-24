import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beta_files import read_beta_json  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GAME_DIR = ROOT / "src" / "data" / "game"
CHAR_ZH_PATHS = [
    GAME_DIR / "character_4_zh.json",
    GAME_DIR / "character_5_zh.json",
    GAME_DIR / "character_beta_zh.json.gz",
]
CHAR_STATS_PATHS = [
    GAME_DIR / "character_stats.json",
    GAME_DIR / "character_beta_stats.json.gz",
]


def _load_game_json(path: Path) -> dict:
    """Read a JSON game-data file, transparently handling gzipped beta files."""
    if path.suffix == ".gz":
        return read_beta_json(path)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_talent_data() -> dict:
    """Load talent parameter data from character_stats.json files."""
    talent_data = {}
    for path in CHAR_STATS_PATHS:
        if path.exists():
            stats = _load_game_json(path)
            for char_id, entry in stats.items():
                if char_id not in talent_data:
                    talent = entry.get("talent", {})
                    q_data = talent.get("Q")
                    if q_data:
                        talent_data[char_id] = q_data
    return talent_data


def resolve_burst_cost(raw_value: str, char_id: str, talent_data: dict) -> int:
    """Resolve burst cost from a raw detail value.

    raw_value can be:
    - A template like '{param7:I}' → extract param index, look up in talent data
    - A plain number like '60' → use directly
    """
    raw_value = str(raw_value).strip()

    # Check for template pattern: {paramN:...}
    m = re.match(r"\{param(\d+):[^}]+\}", raw_value)
    if m:
        param_index = int(m.group(1))  # 1-based
        q_levels = talent_data.get(char_id)
        if not q_levels:
            print(
                f"WARNING: {char_id}: no Q talent data to resolve {{param{param_index}}}",
                file=sys.stderr,
            )
            return 0

        # Resolve from first level, assert consistent across all levels
        zero_idx = param_index - 1
        if zero_idx < 0 or zero_idx >= len(q_levels[0]):
            print(
                f"WARNING: {char_id}: param{param_index} out of bounds "
                f"(Q has {len(q_levels[0])} params)",
                file=sys.stderr,
            )
            return 0

        burst_cost = int(q_levels[0][zero_idx])

        # Assert all levels have the same burst cost
        for level_idx, level_row in enumerate(q_levels):
            if zero_idx < len(level_row) and int(level_row[zero_idx]) != burst_cost:
                print(
                    f"WARNING: {char_id}: burst cost differs at level {level_idx}: "
                    f"{int(level_row[zero_idx])} vs {burst_cost}",
                    file=sys.stderr,
                )

        return burst_cost

    # Plain number (e.g., beta characters with resolved values)
    try:
        return int(re.sub(r"[^0-9]", "", raw_value))
    except ValueError:
        return 0


# ─── Healer / Shielder auto-detection ─────────────────────────────────────
#
# Strategy
#   1. Skill details table (E/Q entries) is the primary signal:
#        - healer  := any detail row whose key contains "治疗"
#        - shielder := any detail row whose key contains "护盾" AND "吸收量"
#          (the "吸收量" filter rejects razor-style "吸收能量" FP matches)
#      Skill-based matches are always C0.
#   2. Passives and constellations are a secondary signal. We require stricter
#      verbs ("恢复/回复/治疗量/复苏" for heal, "生成/赋予/产生/唤出...护盾 | 伤害吸收量"
#      for shield) AND a team-target marker ("队伍", "附近角色", "当前场上角色",
#      "当前角色", "为该角色", "为其恢复", ...). This filters out self-sustain
#      passives (Dehya A1, Kaeya A1, Arlecchino A1, etc.) that we don't want
#      to classify as team healers/shielders.
#   3. supStat: for each matched row/description we scan for scaling keywords
#      生命值/最大生命值/生命上限 → hp%, 攻击力 → atk%, 防御力 → def%,
#      元素精通 → em. Results are unioned — Sayu gets ["atk%", "em"] from her
#      Q skill (ATK) plus her A1 passive (EM).
#   4. Hard-coded overrides below cover the small set of characters whose data
#      evades detection or where auto-detection flags an undesired self-only
#      effect.

# Role-detection heal-key pattern is intentionally narrow: "治疗" is used
# consistently for team-heal skill-detail keys (e.g. "施放治疗量", "持续治疗量").
# Looser forms like "回复生命值" also appear as self-heal mechanics
# (Lyney E, Neuvillette CA) — those stay out.
# Characters whose team heal uses a "回复生命值" key (e.g. Mizuki's Q food
# pickup) are handled via HEALER_ADD, which triggers a supStat scan that
# uses the broader HEAL_ANY_KEY_PAT below.
HEAL_KEY_PAT = re.compile(r"治疗")
HEAL_ANY_KEY_PAT = re.compile(r"治疗|回复生命值|恢复生命值")
SHIELD_KEY_PAT = re.compile(r"护盾.*吸收量|吸收量.*护盾")

HEAL_PASSIVE_PAT = re.compile(
    r"恢复[^，。\n]{0,10}生命值"
    r"|回复[^，。\n]{0,10}生命值"
    r"|治疗量(?!加成|提升)"
    r"|复苏[^，。\n]{0,10}角色"
)
SHIELD_PASSIVE_PAT = re.compile(
    r"(?:生成|赋予|产生|唤出)[^，。\n]{0,15}护盾"
    r"|伤害吸收量"
)
# Team-target markers matched against a single sentence/clause containing
# the heal/shield verb. Sentence-level scope avoids FPs where an unrelated
# team marker appears elsewhere in the passive (e.g. Traveler (Hydro) A4
# has "队伍中附近角色的当前生命值提升或降低5%时" in one clause but then a
# self-heal "为旅行者恢复一次生命值" in a later clause).
#
# Notes:
# - "附近" alone matches spatial references like "旅行者附近产生源水之滴"; we
#   require "附近" followed by "角色" within a short window.
# - "当前场上" is often combined with "自己的角色".
TEAM_MARKER_PAT = re.compile(
    r"队伍"
    r"|附近.{0,5}角色"
    r"|当前场上.{0,5}角色"
    r"|当前角色"
    r"|为该角色"
    r"|为其(?:恢复|赋予|生成)"
    r"|所有自己的角色"
    r"|其他场上角色"
    r"|所有角色"
)
# Clause splitter — Chinese punctuation and the bullet separator used in
# talent text. Also split on newlines.
CLAUSE_SPLIT_PAT = re.compile(r"[。；;·\n]+")

# Scaling-keyword patterns. Note: bare "生命值" is too permissive — it also
# matches the *target* of healing (as in "恢复生命值"). We require the explicit
# stat forms "生命值上限" / "最大生命值" to flag hp% scaling.
SUPSTAT_PATTERNS = [
    (re.compile(r"生命值上限|最大生命值"), "hp%"),
    (re.compile(r"攻击力"), "atk%"),
    (re.compile(r"防御力"), "def%"),
    (re.compile(r"元素精通"), "em"),
]

# Auto-detection misses these characters; force-include them.
# Maps char_id → min constellation.
HEALER_ADD: dict[str, int] = {
    # Q heal uses "拾取点心回复生命值" as its detail key — team-scoped (food
    # pickup) but the narrow HEAL_KEY_PAT won't match "回复生命值".
    "yumemizuki_mizuki": 0,
}
SHIELDER_ADD: dict[str, int] = {
    # C4 self-shield; clause lacks team marker.
    "yanfei": 4,
    # C2 self-shield; clause lacks team marker.
    "sigewinne": 2,
    # C1 team-shield but the team-receiver is mentioned in an earlier clause
    # ("月感电反应：为队伍中..." etc.) so the per-clause match misses it.
    "columbina": 1,
}

# Known self-sustain characters that should NOT count as team healers/shielders.
# Some of these are already filtered by the clause-level team-marker check, but
# we list them here defensively — if the regexes are loosened in the future,
# this set still prevents false positives.
HEALER_EXCLUDE: set[str] = {
    "hu_tao",  # Q self-heals only
    "gaming",  # Q self-heals only
    "clorinde",  # E bond-of-life self-heal
    "lynette",  # E on-hit self-heal
    "wriothesley",  # C4 self-heal only
    "dahlia",  # C6 niche revive-on-downed
    "fischl",  # C4 self-heal
    "kaeya",  # A4 on-hit self-heal
    "kaveh",  # A4 self-heal via EM on bloom hits
    "arlecchino",  # passive self-heal only (via Bond of Life)
    "dehya",  # A4/C4 low-HP self-heal
    "lyney",  # E self-heal per Prop Surplus stack
    "neuvillette",  # E source-droplet self-heal
    "traveler_anemo",  # A4 on-kill self-heal
}
SHIELDER_EXCLUDE: set[str] = {
    "albedo",  # C6 only buffs when shielded; doesn't generate shield
    "candace",  # E shield only lasts during skill cast, not a sustained team shield
}

# Manual supStat additions / replacements (key: char_id, value: supStat list).
# `None` for value disables auto-detection and leaves supStat unset.
SUPSTAT_OVERRIDE: dict[str, list[str] | None] = {
    # Q heals on ATK; A1 passive adds EM-scaling team heal, but the EM clause
    # lacks a team marker (it sits in a separate clause from the team-heal verb).
    "sayu": ["atk%", "em"],
}

# Characters for whom healerC/shielderC should be bumped above auto-detected
# minC (e.g., their base skill shield is too conditional to count at C0).
HEALER_MIN_C: dict[str, int] = {}
SHIELDER_MIN_C: dict[str, int] = {
    "beidou": 1,  # E shield requires timed hold/parry; real shield comes at C1.
}

# Primary heal action per character. Used by the ER calculator to anchor
# heal-triggered weapons (Dialogues, Rightful Reward) to the correct skill
# node. Only set for healers whose main healing source is the skill (E);
# omission means the engine defaults to Q, which fits most Q-field healers.
HEAL_ACTION: dict[str, str] = {
    "baizhu": "E",
    "barbara": "E",
    "diona": "E",
    "kuki_shinobu": "E",
    "noelle": "E",
    "qiqi": "E",
    "sangonomiya_kokomi": "E",
    "sayu": "E",
    "sigewinne": "E",
}


def strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s)


def extract_supstats(text: str) -> list[str]:
    """Return supStat keys (in canonical order) present in `text`."""
    found = []
    for pat, key in SUPSTAT_PATTERNS:
        if pat.search(text):
            found.append(key)
    return found


def detect_heal_shield(char_data: dict) -> tuple[int | None, int | None, list[str]]:
    """Detect healer/shielder minC plus supStat list for one character.

    Returns (healerC, shielderC, supStat).
    """
    healer_c: int | None = None
    shielder_c: int | None = None
    supstats: list[str] = []

    # Pass 1 — skill details (reliable, always C0 if matched)
    for skill in char_data.get("skills", []):
        for det in skill.get("details", []):
            if len(det) < 2:
                continue
            key = str(det[0])
            val = str(det[1])
            if HEAL_KEY_PAT.search(key):
                healer_c = 0
                for s in extract_supstats(val):
                    if s not in supstats:
                        supstats.append(s)
            if SHIELD_KEY_PAT.search(key):
                shielder_c = 0
                for s in extract_supstats(val):
                    if s not in supstats:
                        supstats.append(s)

    # Pass 2 — passives (C0) and constellations (C1..C6)
    groups = [(0, char_data.get("passives", []))]
    for i, con in enumerate(char_data.get("constellations", [])):
        groups.append((i + 1, [con]))

    for level, entries in groups:
        for entry in entries:
            desc = strip_html(entry.get("descHtml", ""))
            # Check each clause for heal/shield co-occurring with a team
            # marker in the same clause. This prevents Traveler-(Hydro)-A4
            # style FPs where an unrelated team marker appears nearby.
            for clause in CLAUSE_SPLIT_PAT.split(desc):
                if not TEAM_MARKER_PAT.search(clause):
                    continue
                if HEAL_PASSIVE_PAT.search(clause):
                    healer_c = level if healer_c is None else min(healer_c, level)
                    for s in extract_supstats(clause):
                        if s not in supstats:
                            supstats.append(s)
                if SHIELD_PASSIVE_PAT.search(clause):
                    shielder_c = level if shielder_c is None else min(shielder_c, level)
                    for s in extract_supstats(clause):
                        if s not in supstats:
                            supstats.append(s)

    return healer_c, shielder_c, supstats


def scan_supstats_unrestricted(char_data: dict, scan_heal: bool, scan_shield: bool) -> list[str]:
    """Extract supStat keys from any clause containing a heal/shield verb,
    ignoring the team-marker filter. Used to populate supStat for
    force-added (HEALER_ADD/SHIELDER_ADD) entries whose qualifying text
    never passed the clause filter in detect_heal_shield."""
    found: list[str] = []

    def add_all(text: str) -> None:
        for s in extract_supstats(text):
            if s not in found:
                found.append(s)

    for skill in char_data.get("skills", []):
        for det in skill.get("details", []):
            if len(det) < 2:
                continue
            key, val = str(det[0]), str(det[1])
            if scan_heal and HEAL_ANY_KEY_PAT.search(key):
                add_all(val)
            if scan_shield and SHIELD_KEY_PAT.search(key):
                add_all(val)

    entries = list(char_data.get("passives", [])) + list(char_data.get("constellations", []))
    for entry in entries:
        desc = strip_html(entry.get("descHtml", ""))
        for clause in CLAUSE_SPLIT_PAT.split(desc):
            if scan_heal and HEAL_PASSIVE_PAT.search(clause):
                add_all(clause)
            if scan_shield and SHIELD_PASSIVE_PAT.search(clause):
                add_all(clause)
    return found


def resolve_heal_shield(char_id: str, char_data: dict) -> tuple[int | None, int | None, list[str]]:
    """Apply auto-detection plus manual overrides."""
    healer_c, shielder_c, supstats = detect_heal_shield(char_data)
    healer_auto = healer_c is not None
    shielder_auto = shielder_c is not None

    # Exclusions
    if char_id in HEALER_EXCLUDE:
        healer_c = None
    if char_id in SHIELDER_EXCLUDE:
        shielder_c = None

    # Additions
    if char_id in HEALER_ADD:
        v = HEALER_ADD[char_id]
        healer_c = v if healer_c is None else min(healer_c, v)
    if char_id in SHIELDER_ADD:
        v = SHIELDER_ADD[char_id]
        shielder_c = v if shielder_c is None else min(shielder_c, v)

    # Min-C bumps (conditional skills)
    if healer_c is not None and char_id in HEALER_MIN_C:
        healer_c = max(healer_c, HEALER_MIN_C[char_id])
    if shielder_c is not None and char_id in SHIELDER_MIN_C:
        shielder_c = max(shielder_c, SHIELDER_MIN_C[char_id])

    # For force-added roles whose text didn't pass the team-marker filter,
    # supplement supStat via an unrestricted scan over heal/shield clauses.
    need_heal_scan = healer_c is not None and not healer_auto
    need_shield_scan = shielder_c is not None and not shielder_auto
    if need_heal_scan or need_shield_scan:
        extra = scan_supstats_unrestricted(
            char_data, scan_heal=need_heal_scan, scan_shield=need_shield_scan
        )
        for s in extra:
            if s not in supstats:
                supstats.append(s)

    # supStat override — only meaningful when we actually flagged a role
    is_support = healer_c is not None or shielder_c is not None
    if char_id in SUPSTAT_OVERRIDE:
        override = SUPSTAT_OVERRIDE[char_id]
        supstats = [] if override is None else list(override)
    elif not is_support:
        supstats = []

    return healer_c, shielder_c, supstats


def main():
    data = {}
    for path in CHAR_ZH_PATHS:
        if path.exists():
            data.update(_load_game_json(path))

    talent_data = load_talent_data()

    output = []

    for char_id, char_data in data.items():
        energy = 0
        skills = char_data.get("skills", [])
        for skill in skills:
            for detail in skill.get("details", []):
                if detail[0] == "元素能量":
                    energy = resolve_burst_cost(detail[1], char_id, talent_data)

        constellations = char_data.get("constellations", [])
        c3_talent = "Q"
        c5_talent = "E"
        if len(constellations) >= 6 and char_id != "aloy":
            c3_desc = constellations[2].get("descHtml", "")
            c5_desc = constellations[4].get("descHtml", "")

            def get_talent(desc, skills):
                if "普通攻击" in desc and "的技能等级提高" in desc:
                    return "A"

                plain_desc = re.sub(r"<[^>]+>", "", desc)
                match = re.search(r"([^，。]+)的技能等级提高", plain_desc)
                target_name = None
                if match:
                    target_name = match.group(1).split("·")[-1]
                else:
                    match2 = re.search(
                        r"(普通攻击·[^，。]+|元素战技·?[^，。]+|元素爆发·?[^，。]+)的?技能等级提高",
                        plain_desc,
                    )
                    if match2:
                        target_name = match2.group(1).split("·")[-1]

                if target_name:
                    for i, skill in enumerate(skills):
                        skill_name_plain = re.sub(
                            r"^E\.\s*|^Q\.\s*", "", skill.get("name", "")
                        ).split("·")[-1]
                        if target_name == skill_name_plain or target_name in skill.get("name", ""):
                            if i == 0:
                                return "A"
                            if i == 1:
                                return "E"
                            if i == 2:
                                return "Q"
                            if "E." in skill.get("name", ""):
                                return "E"
                            if "Q." in skill.get("name", ""):
                                return "Q"

                if "战技" in plain_desc or "E." in desc:
                    return "E"
                if "爆发" in plain_desc or "Q." in desc:
                    return "Q"
                if "普通攻击" in plain_desc:
                    return "A"
                return "E"

            c3_talent = get_talent(c3_desc, skills)
            c5_talent = get_talent(c5_desc, skills)

        if char_id == "aloy":
            c3_talent = "E"
            c5_talent = "Q"

        if char_id == "hu_tao":
            c5_talent = "Q"

        healer_c, shielder_c, supstats = resolve_heal_shield(char_id, char_data)

        plain_all_texts = re.sub(r"<[^>]+>", "", json.dumps(char_data, ensure_ascii=False))
        is_hexerei = "将成为魔导角色" in plain_all_texts
        is_moonsign = "月兆将会上升一级" in plain_all_texts
        is_nightsoul = "夜魂" in plain_all_texts

        faction = None
        if is_hexerei:
            faction = "Hexerei"
        elif is_moonsign:
            faction = "Moonsign"
        elif is_nightsoul:
            faction = "Nightsoul"

        heal_action = HEAL_ACTION.get(char_id) if healer_c is not None else None

        output.append(
            {
                "id": char_id,
                "energy": energy,
                "healerC": healer_c,
                "shielderC": shielder_c,
                "supStat": supstats,
                "c3Talent": c3_talent,
                "c5Talent": c5_talent,
                "faction": faction,
                "healAction": heal_action,
            }
        )

    lines = [
        "// This file is auto-generated by scripts/gen_char_info.py.",
        "// DO NOT EDIT THIS FILE DIRECTLY.",
        'import type { CharacterInfo } from "./types";',
        "",
        "export const charInfo: Record<string, CharacterInfo> = {",
    ]
    for c in output:
        k = c["id"]
        e = c["energy"]
        h_str = f" healerC: {c['healerC']}," if c["healerC"] is not None else ""
        s_str = f" shielderC: {c['shielderC']}," if c["shielderC"] is not None else ""
        ha_str = f' healAction: "{c["healAction"]}",' if c.get("healAction") else ""
        sup_str = ""
        if c["supStat"]:
            sup_items = ", ".join(f'"{k}"' for k in c["supStat"])
            sup_str = f" supStat: [{sup_items}],"
        f_str = f', faction: "{c["faction"]}"' if c["faction"] is not None else ""
        lines.append(
            f'  {k}: {{ energy: {e},{h_str}{s_str}{ha_str}{sup_str} c3Talent: "{c["c3Talent"]}", c5Talent: "{c["c5Talent"]}"{f_str} }},'  # noqa: E501
        )
    lines.append("};")
    lines.append("")

    out_path = ROOT / "src" / "data" / "charInfo.ts"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()
