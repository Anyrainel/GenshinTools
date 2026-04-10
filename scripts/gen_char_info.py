import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME_DIR = ROOT / "src" / "data" / "game"
CHAR_ZH_PATHS = [
    GAME_DIR / "character_4_zh.json",
    GAME_DIR / "character_5_zh.json",
    GAME_DIR / "character_beta_zh.json",
]
CHAR_STATS_PATHS = [
    GAME_DIR / "character_stats.json",
    GAME_DIR / "character_beta_stats.json",
]


def load_talent_data() -> dict:
    """Load talent parameter data from character_stats.json files."""
    talent_data = {}
    for path in CHAR_STATS_PATHS:
        if path.exists():
            with open(path, encoding="utf-8") as f:
                stats = json.load(f)
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


def main():
    data = {}
    for path in CHAR_ZH_PATHS:
        if path.exists():
            with open(path, encoding="utf-8") as f:
                data.update(json.load(f))

    talent_data = load_talent_data()

    # Dictionary mapping char_id to the minimum constellation required to become a healer
    explicit_healers = {
        "baizhu": 0,
        "barbara": 0,
        "bennett": 0,
        "charlotte": 0,
        "chevreuse": 0,
        "columbina": 0,
        "diona": 0,
        "dori": 0,
        "escoffier": 0,
        "furina": 0,
        "gorou": 4,
        "iansan": 0,
        "ifa": 0,
        "jahoda": 0,
        "jean": 0,
        "kuki_shinobu": 0,
        "lauma": 1,
        "mika": 0,
        "noelle": 0,
        "qiqi": 0,
        "sangonomiya_kokomi": 0,
        "sayu": 0,
        "sigewinne": 0,
        "xianyun": 0,
        "xilonen": 0,
        "xingqiu": 0,
        "yaoyao": 0,
        "yumemizuki_mizuki": 0,
        "zhongli": 6,
    }

    # Dictionary mapping char_id to the minimum constellation required to become a shielder
    explicit_shielders = {
        "baizhu": 0,
        "beidou": 1,
        "citlali": 0,
        "dahlia": 0,
        "diona": 0,
        "ineffa": 0,
        "kirara": 0,
        "lan_yan": 0,
        "layla": 0,
        "noelle": 0,
        "sigewinne": 2,
        "thoma": 0,
        "xinyan": 0,
        "yanfei": 4,
        "zhongli": 0,
    }

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

        healer_c = explicit_healers.get(char_id)
        shielder_c = explicit_shielders.get(char_id)

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

        output.append(
            {
                "id": char_id,
                "energy": energy,
                "healerC": healer_c,
                "shielderC": shielder_c,
                "c3Talent": c3_talent,
                "c5Talent": c5_talent,
                "faction": faction,
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
        f_str = f', faction: "{c["faction"]}"' if c["faction"] is not None else ""
        lines.append(
            f'  {k}: {{ energy: {e},{h_str}{s_str} c3Talent: "{c["c3Talent"]}", c5Talent: "{c["c5Talent"]}"{f_str} }},'  # noqa: E501
        )
    lines.append("};")
    lines.append("")

    out_path = ROOT / "src" / "data" / "charInfo.ts"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()
