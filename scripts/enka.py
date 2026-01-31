import json
import os
from typing import Any

import requests

# Stat Key Mapping (Internal/GOOD keys)
PROP_TYPE_MAP = {
    "FIGHT_PROP_HP": "hp",
    "FIGHT_PROP_HP_PERCENT": "hp_",
    "FIGHT_PROP_ATTACK": "atk",
    "FIGHT_PROP_ATTACK_PERCENT": "atk_",
    "FIGHT_PROP_DEFENSE": "def",
    "FIGHT_PROP_DEFENSE_PERCENT": "def_",
    "FIGHT_PROP_CRITICAL": "critRate_",
    "FIGHT_PROP_CRITICAL_HURT": "critDMG_",
    "FIGHT_PROP_CHARGE_EFFICIENCY": "enerRech_",
    "FIGHT_PROP_HEAL_ADD": "heal_",
    "FIGHT_PROP_ELEMENT_MASTERY": "eleMas",
    "FIGHT_PROP_PHYSICAL_ADD_HURT": "physical_dmg_",
    "FIGHT_PROP_FIRE_ADD_HURT": "pyro_dmg_",
    "FIGHT_PROP_ELEC_ADD_HURT": "electro_dmg_",
    "FIGHT_PROP_WATER_ADD_HURT": "hydro_dmg_",
    "FIGHT_PROP_WIND_ADD_HURT": "anemo_dmg_",
    "FIGHT_PROP_ICE_ADD_HURT": "cryo_dmg_",
    "FIGHT_PROP_ROCK_ADD_HURT": "geo_dmg_",
    "FIGHT_PROP_GRASS_ADD_HURT": "dendro_dmg_",
}


def fetch_json(url: str) -> Any:
    print(f"Fetching {url}...")
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.json()


def run() -> None:
    # Base URLs for Dimbreath's game data
    base_dim = "https://gitlab.com/Dimbreath/AnimeGameData/-/raw/master"
    excel_base = f"{base_dim}/ExcelBinOutput"

    # 1. Fetch Localization - Primary: Enka, Fallback: Dimbreath
    loc_data = fetch_json(
        "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/loc.json"
    )
    en_loc = loc_data.get("en", {})

    # Fetch Dimbreath's TextMap as fallback for new character names
    try:
        textmap_en = fetch_json(f"{base_dim}/TextMap/TextMapEN.json")
        # Merge into en_loc (Enka takes precedence)
        for k, v in textmap_en.items():
            if k not in en_loc:
                en_loc[k] = v
    except Exception as e:
        print(f"Warning: Failed to fetch Dimbreath TextMap: {e}")

    # 2. Characters - Primary source: Enka Network
    chars_data = fetch_json(
        "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json"
    )
    char_map: dict[str, str] = {}
    for avatar_id, data in chars_data.items():
        name_hash = str(data.get("NameTextMapHash"))
        if name_hash in en_loc:
            char_map[avatar_id] = en_loc[name_hash]

    # 2b. Characters - Secondary source: Dimbreath's game data
    # Enka's GitHub repo can lag behind new character releases, so we also check
    # the raw game data to ensure new characters are included.
    try:
        avatar_data = fetch_json(f"{excel_base}/AvatarExcelConfigData.json")
        for entry in avatar_data:
            avatar_id = str(entry.get("id", ""))
            # Skip if already in map (Enka data takes precedence)
            if avatar_id in char_map:
                continue
            # Only include playable characters (IDs starting with 1000)
            if not avatar_id.startswith("1000"):
                continue
            name_hash = str(entry.get("nameTextMapHash"))
            if name_hash in en_loc:
                char_map[avatar_id] = en_loc[name_hash]
    except Exception as e:
        print(f"Warning: Failed to fetch Dimbreath avatar data: {e}")

    # 3. Stats (Affix & MainProp) - Using Dimbreath data

    # Try fetching, if fail, we might need another source or manual map
    sub_affix_data: Any = []
    main_prop_data: Any = []
    try:
        sub_affix_data = fetch_json(f"{excel_base}/ReliquaryAffixExcelConfigData.json")
        main_prop_data = fetch_json(f"{excel_base}/ReliquaryMainPropExcelConfigData.json")
    except Exception as e:
        print(f"Failed to fetch stats data: {e}")

    stat_map: dict[str | int, str] = {}  # Maps ID (int) -> StatKey (string)

    # Add Prop Types directly (for Enka flat stats)
    for k, v in PROP_TYPE_MAP.items():
        stat_map[k] = v

    # Substats
    for entry in sub_affix_data:
        prop_type = entry.get("propType")
        id_ = entry.get("id")
        if prop_type in PROP_TYPE_MAP:
            stat_map[id_] = PROP_TYPE_MAP[prop_type]

    # Mainstats
    for entry in main_prop_data:
        prop_type = entry.get("propType")
        id_ = entry.get("id")
        if prop_type in PROP_TYPE_MAP:
            stat_map[id_] = PROP_TYPE_MAP[prop_type]

    # 4. Artifact Sets
    # ReliquarySet -> equipAffixId -> EquipAffix -> NameHash -> Name
    set_data = fetch_json(f"{excel_base}/ReliquarySetExcelConfigData.json")
    equip_affix_data = fetch_json(f"{excel_base}/EquipAffixExcelConfigData.json")

    # Build affix map: ID -> NameHash
    affix_name_map: dict[int, str] = {}
    for entry in equip_affix_data:
        affix_name_map[entry.get("id")] = str(entry.get("nameTextMapHash"))

    artifact_map: dict[str, str] = {}  # SetID -> Name
    for entry in set_data:
        set_id = str(entry.get("setId"))
        # equipAffixId is typically an ID like 215001.
        affix_id = entry.get("equipAffixId")
        if affix_id:
            # Look up hash
            if affix_id in affix_name_map:
                name_hash = affix_name_map[affix_id]
                if name_hash in en_loc:
                    artifact_map[set_id] = en_loc[name_hash]

    # 5. Weapons
    weapon_data = fetch_json(f"{excel_base}/WeaponExcelConfigData.json")
    weapon_map: dict[str, str] = {}
    for entry in weapon_data:
        id_ = str(entry.get("id"))
        name_hash = str(entry.get("nameTextMapHash"))
        if name_hash in en_loc:
            weapon_map[id_] = en_loc[name_hash]

    # Write Output
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    output_path = os.path.join(project_root, "src", "data", "enkaIdMap.ts")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by scripts/codedump.py\n")
        f.write("// Mappings: ID -> English Name (or GOOD Key for Stats)\n")

        def write_map(name: str, data: dict[Any, str], is_string_key: bool = True) -> None:
            f.write(f"export const {name}: Record<string, string> = {{\n")
            for k, v in sorted(data.items(), key=lambda x: str(x[0])):
                f.write(f'  "{k}": {json.dumps(v)},' + "\n")
            f.write("};\n\n")

        write_map("characterIdMap", char_map)
        write_map("artifactIdMap", artifact_map)
        write_map("weaponIdMap", weapon_map)
        write_map("statIdMap", stat_map)

    print(f"Generated {output_path}")
