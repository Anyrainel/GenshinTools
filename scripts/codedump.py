#!/usr/bin/env python3
"""
Orchestrator script for Genshin Impact data scraping and code generation.
Combines data from Fandom and Hoyolab wikis.
"""

import argparse
import json
import os
import re
import sys
from collections.abc import Sequence
from typing import Any, cast

from pydantic import BaseModel
from tqdm import tqdm

import enka
import fandom
from ts_reader import load_ts_data

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from halfset_finder import process_artifact_effects
from hoyolab import HoyolabAssetManager, HoyolabScraper
from models import (
    ArtifactOutput,
    ArtifactSource,
    CharacterOutput,
    CharacterSource,
    EffectData,
    HalfSet,
    I18nArtifactData,
    MatchedItem,
    ResourceOutput,
    WeaponOutput,
    WeaponSource,
)
from processing import (
    SHARED_IMAGE_PREFIXES,
    process_artifacts,
    process_characters,
    process_weapons,
)

SKIP_EXISTING_IMAGES = True


def load_existing_data(project_root: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Load existing data from resources.ts and i18n-game.ts"""
    combined = load_ts_data(project_root)
    i18n = combined.pop("i18nGameData", {})
    return combined, i18n


def compact_json(data: object) -> str:
    """JSON with indent=2 but leaf arrays collapsed to single lines.

    A 'leaf array' is one whose elements are all strings (no nested
    objects or arrays).  This keeps detail rows like
    ["1-Hit DMG", "129.4%", "156.8%"] on one line instead of 5.
    """
    raw = json.dumps(data, indent=2, ensure_ascii=False)
    return re.sub(
        r'\[\s*\n\s+"(?:[^"\\]|\\.)*"'
        r'(?:\s*,\s*\n\s+"(?:[^"\\]|\\.)*")*\s*\n\s*\]',
        lambda m: (
            "[" + ", ".join(s.strip() for s in re.findall(r'"(?:[^"\\]|\\.)*"', m.group(0))) + "]"
        ),
        raw,
    )


def compact_i18n_json(data: object) -> str:
    """JSON with indent=2 but {"en": ..., "zh": ...} leaf dicts on one line.

    Collapses i18n translation objects so that:
        "varka": {
          "en": "Varka",
          "zh": "法尔伽"
        }
    becomes:
        "varka": { "en": "Varka", "zh": "法尔伽" }
    """
    raw = json.dumps(data, indent=2, ensure_ascii=False)
    return re.sub(
        r'\{\s*\n\s+"en":\s*"(?:[^"\\]|\\.)*",\s*\n\s+"zh":\s*"(?:[^"\\]|\\.)*"\s*\n\s*\}',
        lambda m: re.sub(r"\s*\n\s*", " ", m.group(0)),
        raw,
    )


def write_data(
    character_data: list[CharacterOutput],
    artifact_data: list[ArtifactOutput],
    weapon_data: list[WeaponOutput],
    half_sets: list[HalfSet],
    elements: list[ResourceOutput],
    weapon_types: list[ResourceOutput],
    i18n_data: dict[str, dict[str, Any]],
    updated_types: set[str] | None = None,
    details: bool = True,
) -> None:
    """Write processed data to TypeScript files and per-language game JSON.

    Args:
        updated_types: entity types that were freshly scraped (e.g. {"weapon", "artifact"}).
            Only these types will have their game JSON files regenerated.
            If None, all types are written (backwards-compatible full run).
        details: when False, only lean fields (id, rarity, imagePath) are written
            to resources.ts.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    data_dir = os.path.join(project_root, "src", "data")
    game_dir = os.path.join(data_dir, "game")
    os.makedirs(game_dir, exist_ok=True)

    _write_resources_ts(
        data_dir,
        character_data,
        artifact_data,
        weapon_data,
        half_sets,
        elements,
        weapon_types,
        details=details,
    )
    # NOTE: All game JSON files (weapon_*.json, artifact_*.json, character_*.json)
    # are now manually maintained. Uncomment to re-enable generation.
    # _write_game_json(i18n_data, game_dir, updated_types)
    _write_i18n_game_ts(data_dir, i18n_data)


def _serialize(items: Sequence[Any]) -> str:
    """Serialize a list of Pydantic models or dicts to indented JSON."""
    return json.dumps(
        [i.model_dump(by_alias=True) if isinstance(i, BaseModel) else i for i in items],
        indent=2,
        ensure_ascii=False,
    )


_LEAN_ENTITY_KEYS = {"id", "rarity", "imagePath", "imagePaths"}


def _serialize_lean(items: Sequence[Any]) -> str:
    """Serialize only the lean resource fields (id, rarity, imagePath/imagePaths)."""
    dumped = []
    for i in items:
        d = i.model_dump(by_alias=True) if isinstance(i, BaseModel) else dict(i)
        dumped.append({k: v for k, v in d.items() if k in _LEAN_ENTITY_KEYS})
    return json.dumps(dumped, indent=2, ensure_ascii=False)


def _write_resources_ts(
    data_dir: str,
    character_data: Sequence[CharacterOutput],
    artifact_data: Sequence[ArtifactOutput],
    weapon_data: Sequence[WeaponOutput],
    half_sets: Sequence[HalfSet],
    elements: Sequence[ResourceOutput],
    weapon_types: Sequence[ResourceOutput],
    details: bool = True,
) -> None:
    """Write src/data/resources.ts with all entity arrays.

    When details=False, only lean fields (id, rarity, imagePath/imagePaths) are
    written for character/artifact/weapon entries.
    """
    ser = _serialize if details else _serialize_lean

    # (var_name, ts_type, data, use_lean_when_no_details)
    exports: list[tuple[str, str, Sequence[Any], bool]] = [
        ("characters", "CharacterResource[]", character_data, True),
        ("elementResources", "ElementResource[]", elements, False),
        ("weaponTypeResources", "WeaponTypeResource[]", weapon_types, False),
        ("artifacts", "ArtifactSetResource[]", artifact_data, True),
        ("artifactHalfSets", "ArtifactHalfSet[]", half_sets, False),
        ("weapons", "WeaponResource[]", weapon_data, True),
    ]

    path = os.path.join(data_dir, "resources.ts")
    with open(path, "w", encoding="utf-8") as f:
        f.write("// This file is auto-generated by scripts/codedump.py\n")
        f.write("// Do not edit this file directly\n\n")
        f.write(
            "import { ArtifactHalfSet, ArtifactSetResource, CharacterResource, ElementResource, "
            "WeaponResource, WeaponTypeResource } from './types';\n\n"
        )
        for var_name, ts_type, data, is_entity in exports:
            f.write(f"export const {var_name}: {ts_type} = ")
            f.write(ser(data) if is_entity else _serialize(data))
            f.write(";\n\n")

    print(f"Written resources to {path}")


def _write_i18n_game_ts(data_dir: str, i18n_data: dict[str, dict[str, Any]]) -> None:
    """Write src/data/i18n-game.ts with names-only for weapons/artifacts."""
    path = os.path.join(data_dir, "i18n-game.ts")
    with open(path, "w", encoding="utf-8") as f:
        f.write("// This file is auto-generated by scripts/codedump.py\n")
        f.write("// Do not edit this file directly\n\n")
        f.write("export const i18nGameData = ")

        flat_i18n = _flatten_i18n_for_ts(i18n_data)
        f.write(compact_i18n_json(flat_i18n))
        f.write(";\n")
    print(f"Written i18n data to {path}")


def _flatten_i18n_for_ts(i18n_data: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Build the i18n-game.ts payload: names only for weapons/artifacts."""
    result: dict[str, Any] = {}
    for key, value in i18n_data.items():
        if key in ("weapons", "artifacts"):
            result[key] = {eid: _extract_name(edata) for eid, edata in value.items()}
        elif isinstance(value, BaseModel):
            result[key] = value.model_dump(by_alias=True)
        elif isinstance(value, dict):
            new_dict: dict[str, Any] = {}
            for k, v in value.items():
                new_dict[k] = v.model_dump(by_alias=True) if isinstance(v, BaseModel) else v
            result[key] = new_dict
        else:
            result[key] = value
    return result


def _extract_name(data: Any) -> dict[str, str]:
    """Extract the name dict from a weapon/artifact entry (model or dict).

    Handles both full format ({name: {en, zh}, ...}) and already-flat ({en, zh}).
    """
    if isinstance(data, BaseModel):
        return data.model_dump(by_alias=True).get("name", {})
    if isinstance(data, dict):
        # Already flat: {en: "...", zh: "..."}
        if "en" in data or "zh" in data:
            return {k: v for k, v in data.items() if k in ("en", "zh")}
        # Full format: {name: {en: "...", zh: "..."}, ...}
        return data.get("name", {})
    return {}


def _load_artifact_i18n_models(
    i18n_artifacts: dict[str, Any],
) -> dict[str, I18nArtifactData]:
    """Build I18nArtifactData models from freshly-scraped i18n data.

    Used when artifacts were scraped with --details, so i18n_artifacts contains
    Pydantic models or full dicts with name+effects.
    """
    result: dict[str, I18nArtifactData] = {}
    for aid, data in i18n_artifacts.items():
        if isinstance(data, I18nArtifactData):
            result[aid] = data
        elif isinstance(data, dict):
            result[aid] = I18nArtifactData(**data)
    return result


def _load_artifact_data_from_json(
    game_dir: str,
) -> tuple[list[str], dict[str, I18nArtifactData]]:
    """Load artifact IDs and i18n effect data directly from game JSON files.

    Used when --details is not set, reading from the manually-maintained
    artifact_en.json and artifact_zh.json files.
    """
    game_data: dict[str, dict[str, Any]] = {}
    for lang in ("en", "zh"):
        path = os.path.join(game_dir, f"artifact_{lang}.json")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                game_data[lang] = json.load(f)

    en_data = game_data.get("en", {})
    zh_data = game_data.get("zh", {})

    # Use English JSON as the source of truth for artifact IDs
    artifact_ids = list(en_data.keys())

    result: dict[str, I18nArtifactData] = {}
    for aid in artifact_ids:
        en_entry = en_data.get(aid, {})
        zh_entry = zh_data.get(aid, {})
        result[aid] = I18nArtifactData(
            name={"en": en_entry.get("name", ""), "zh": zh_entry.get("name", "")},
            effects=EffectData(
                en=[en_entry.get("effect2", ""), en_entry.get("effect4", "")],
                zh=[zh_entry.get("effect2", ""), zh_entry.get("effect4", "")],
            ),
        )

    if result:
        print(f"Loaded {len(result)} artifacts from game JSON files")
    return artifact_ids, result


def _write_game_json(
    i18n_data: dict[str, dict[str, Any]],
    game_dir: str,
    updated_types: set[str] | None = None,
) -> None:
    """Write weapon_*.json and artifact_*.json per language to game_dir.

    Only writes JSON files for entity types listed in updated_types.
    Character name injection always runs (only needs names from i18n).
    """
    write_all = updated_types is None
    weapons_raw = i18n_data.get("weapons", {})
    artifacts_raw = i18n_data.get("artifacts", {})

    for lang in ("en", "zh"):
        # ── Weapons ─────────────────────────────────────────────────────
        if write_all or (updated_types is not None and "weapon" in updated_types):
            weapon_out: dict[str, dict[str, str]] = {}
            for wid, wdata in weapons_raw.items():
                if isinstance(wdata, BaseModel):
                    d = wdata.model_dump(by_alias=True)
                else:
                    d = wdata
                weapon_out[wid] = {
                    "name": d.get("name", {}).get(lang, ""),
                    "effect": d.get("effect", {}).get(lang, ""),
                }
            wp = os.path.join(game_dir, f"weapon_{lang}.json")
            with open(wp, "w", encoding="utf-8") as f:
                json.dump(weapon_out, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"Written {len(weapon_out)} weapons to {wp}")

        # ── Artifacts ───────────────────────────────────────────────────
        if write_all or (updated_types is not None and "artifact" in updated_types):
            artifact_out: dict[str, dict[str, str]] = {}
            for aid, adata in artifacts_raw.items():
                if isinstance(adata, BaseModel):
                    d = adata.model_dump(by_alias=True)
                else:
                    d = adata
                effects = d.get("effects", {})
                if isinstance(effects, dict):
                    lang_effects = effects.get(lang, [])
                else:
                    lang_effects = []
                artifact_out[aid] = {
                    "name": d.get("name", {}).get(lang, ""),
                    "effect2": lang_effects[0] if len(lang_effects) > 0 else "",
                    "effect4": lang_effects[1] if len(lang_effects) > 1 else "",
                }
            ap = os.path.join(game_dir, f"artifact_{lang}.json")
            with open(ap, "w", encoding="utf-8") as f:
                json.dump(artifact_out, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"Written {len(artifact_out)} artifacts to {ap}")


def download_all_images(
    characters: list[MatchedItem[CharacterSource]],
    artifacts: list[MatchedItem[ArtifactSource]],
    weapons: list[MatchedItem[WeaponSource]],
    elements: list[ResourceOutput] | None = None,
    weapon_types: list[ResourceOutput] | None = None,
) -> None:
    """Download all character, artifact, element, and weapon images"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    downloaded_shared: set[str] = set()
    with tqdm(characters, desc="Downloading Characters", unit="img") as pbar:
        for match in pbar:
            char = match["en"]
            # Characters whose element variants share a single portrait
            shared_base = next(
                (p.lower() for p in SHARED_IMAGE_PREFIXES if char.name.startswith(p)),
                None,
            )
            if shared_base:
                if shared_base in downloaded_shared:
                    continue
                downloaded_shared.add(shared_base)
                HoyolabAssetManager.download_character_assets(
                    char, project_root, override_id=shared_base
                )
            else:
                HoyolabAssetManager.download_character_assets(char, project_root)

    print("Downloading artifact images...")

    with tqdm(
        artifacts,
        desc="Downloading Artifacts",
        unit="set",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ) as pbar:
        for match in pbar:
            art = match["en"]
            HoyolabAssetManager.download_artifact_assets(art, project_root)

    with tqdm(
        weapons,
        desc="Downloading Weapons",
        unit="img",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ) as pbar:
        for match in pbar:
            weap = match["en"]
            HoyolabAssetManager.download_weapon_assets(weap, project_root)

    if elements:
        print("Downloading element images...")
        for element in elements:
            HoyolabAssetManager.download_element_asset(element, project_root)

    if weapon_types:
        print("Downloading weapon type images...")
        for weapon_type in weapon_types:
            HoyolabAssetManager.download_weapon_type_asset(weapon_type, project_root)


def main():
    parser = argparse.ArgumentParser(description="Genshin Impact Data Scraper")
    parser.add_argument("--character", action="store_true", help="Update character data")
    parser.add_argument("--weapon", action="store_true", help="Update weapon data")
    parser.add_argument("--artifact", action="store_true", help="Update artifact data")
    parser.add_argument("--half-set", action="store_true", help="Recompute half sets only")
    parser.add_argument("--enka", action="store_true", help="Generate Enka ID maps")
    parser.add_argument(
        "--details",
        action="store_true",
        default=False,
        help=(
            "Scrape detail pages for full data (weapon stats, effects, character regions, etc.). "
            "When omitted (default), individual entry pages are skipped and only lean fields "
            "(id, rarity, imagePath) are written to resources.ts."
        ),
    )
    args = parser.parse_args()

    # Default to all if no flags provided
    if not (args.character or args.weapon or args.artifact or args.half_set or args.enka):
        args.character = True
        args.weapon = True
        args.artifact = True
        args.enka = False

    print("=== Genshin Impact Data Scraper ===")
    print(
        f"Modes: Character={args.character}, Weapon={args.weapon}, "
        f"Artifact={args.artifact}, Enka={args.enka}, Details={args.details}"
    )
    if not args.details:
        print("  (lean mode: individual entry pages will NOT be visited)")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    # Load existing data
    existing_resources, existing_i18n = load_existing_data(project_root)

    # Initialize data containers with existing data or defaults
    character_data = existing_resources.get("characters", [])
    artifact_data = existing_resources.get("artifacts", [])
    weapon_data = existing_resources.get("weapons", [])
    half_sets = existing_resources.get("artifactHalfSets", [])
    elements = existing_resources.get("elementResources", [])
    weapon_types = existing_resources.get("weaponTypeResources", [])

    # Build ID-keyed lookups for fallback during processing
    existing_char_map: dict[str, dict[str, Any]] = {
        c["id"]: c for c in character_data if isinstance(c, dict) and "id" in c
    }
    existing_weapon_map: dict[str, dict[str, Any]] = {
        w["id"]: w for w in weapon_data if isinstance(w, dict) and "id" in w
    }

    i18n_data: dict[str, dict[str, Any]] = (
        cast(dict[str, dict[str, Any]], existing_i18n)
        if existing_i18n
        else {
            "characters": {},
            "artifacts": {},
            "weapons": {},
        }
    )

    # Tracking for downloads
    matched_chars = []
    matched_arts = []
    matched_weaps = []
    new_elements = None
    new_weapon_types = None

    # 1. Scrape Fandom (only when --details is set, needed for weapon type / region / release date)
    fandom_data: dict = {}
    if args.character and args.details:
        print("=== [1/5] Fandom Wiki Data ===")
        fandom_data = fandom.get_character_data()
    elif args.character:
        print("=== [1/5] Fandom Wiki Data (skipped — --details not set) ===")

    if args.character or args.artifact or args.weapon:
        print("=== [2/5] Hoyolab Data ===")
        with HoyolabScraper() as scraper:
            try:
                if args.character:
                    print("--- Character ---")
                    chars_en = scraper.scrape_characters("en")
                    new_elements, new_weapon_types = scraper.scrape_elements_and_weapons("en")
                    chars_zh = scraper.scrape_characters("zh")
                    c_data, c_i18n, matched_chars = process_characters(
                        chars_en,
                        chars_zh,
                        fandom_data,
                        existing_char_map,
                        scraper,
                        details=args.details,
                    )
                    character_data = c_data
                    i18n_data["characters"] = c_i18n
                    elements = new_elements
                    weapon_types = new_weapon_types

                if args.artifact:
                    print("--- Artifact ---")
                    arts_en = scraper.scrape_artifacts("en")
                    arts_zh = scraper.scrape_artifacts("zh")
                    a_data, a_i18n, matched_arts = process_artifacts(arts_en, arts_zh, scraper)
                    artifact_data = a_data
                    i18n_data["artifacts"] = a_i18n

                if args.weapon:
                    print("--- Weapon ---")
                    weaps_en = scraper.scrape_weapons("en", fetch_details=args.details)
                    weaps_zh = scraper.scrape_weapons("zh", fetch_details=args.details)

                    w_data, w_i18n, matched_weaps = process_weapons(
                        weaps_en, weaps_zh, existing_weapon_map, scraper
                    )
                    weapon_data = w_data
                    i18n_data["weapons"] = w_i18n

            except Exception as e:
                print(f"Error during scraping: {e}")
                import traceback

                traceback.print_exc()

    # 2.5 Recompute Half Sets (if requested or if artifacts were updated)
    if args.half_set or args.artifact:
        print("=== [3/5] Computing Half Sets ===")
        game_dir = os.path.join(project_root, "src", "data", "game")

        if args.artifact and args.details:
            # Artifacts freshly scraped with full details — use scraped i18n data
            artifact_ids = []
            if artifact_data:
                if isinstance(artifact_data[0], BaseModel):
                    artifact_ids = [a.id for a in artifact_data]
                else:
                    artifact_ids = [a["id"] for a in artifact_data]  # type: ignore
            model_i18n_artifacts = _load_artifact_i18n_models(
                i18n_data.get("artifacts", {}),
            )
        else:
            # Default: read artifact effect text from game JSON files
            # Use existing resources list order for artifact IDs (not JSON key order)
            _, model_i18n_artifacts = _load_artifact_data_from_json(game_dir)
            if artifact_data:
                if isinstance(artifact_data[0], BaseModel):
                    artifact_ids = [a.id for a in artifact_data]
                else:
                    artifact_ids = [a["id"] for a in artifact_data]  # type: ignore
            else:
                artifact_ids = list(model_i18n_artifacts.keys())

        if artifact_ids and model_i18n_artifacts:
            half_sets, half_sets_i18n = process_artifact_effects(
                artifact_ids,
                model_i18n_artifacts,
            )
            i18n_data["artifactHalfSets"] = half_sets_i18n
        else:
            print("Warning: Skipping half set computation due to missing artifact data")

    # 3. Save Data
    updated_types: set[str] = set()
    if args.character:
        updated_types.add("character")
    if args.weapon:
        updated_types.add("weapon")
    if args.artifact:
        updated_types.add("artifact")

    if updated_types or args.half_set:
        write_data(
            character_data,
            artifact_data,
            weapon_data,
            half_sets,
            elements,
            weapon_types,
            i18n_data,
            updated_types or None,
            details=args.details,
        )

        # 4. Download Images (only for updated items)
        print("=== [4/5] Assets ===")
        download_all_images(
            matched_chars, matched_arts, matched_weaps, new_elements, new_weapon_types
        )

    # 5. Enka Map Generation
    if args.enka:
        print("=== [5/5] Enka Map Generation ===")
        enka.run()


if __name__ == "__main__":
    main()
