import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME_DIR = ROOT / "src" / "data" / "game"
CHAR_ZH_PATHS = [
    GAME_DIR / "character_4_zh.json",
    GAME_DIR / "character_5_zh.json",
    GAME_DIR / "character_beta_zh.json",
]


def main():
    data = {}
    for path in CHAR_ZH_PATHS:
        if path.exists():
            with open(path, encoding="utf-8") as f:
                data.update(json.load(f))

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
                if "元素能量" in detail[0]:
                    try:
                        energy = int(re.sub(r"[^0-9]", "", str(detail[1])))
                    except ValueError:
                        pass

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

        faction = None
        if is_hexerei:
            faction = "Hexerei"
        elif is_moonsign:
            faction = "Moonsign"

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
