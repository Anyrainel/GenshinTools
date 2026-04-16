"""Read JSON data embedded in TypeScript `export const` declarations.

Provides a single extraction primitive and a convenience loader for the
project's `resources.ts` / `i18n-game.ts` files.
"""

import json
import re
from pathlib import Path
from typing import Any

# Variable names exported from resources.ts
_RESOURCE_VARS = (
    "characters",
    "artifacts",
    "weapons",
    "enemies",
    "artifactHalfSets",
    "elementResources",
    "weaponTypeResources",
)


def _js_to_json(text: str) -> str:
    """Convert JS object literal syntax to JSON (quote unquoted keys, strip trailing commas)."""
    text = re.sub(r"(?<=[{,\n])\s*(\w+)\s*:", lambda m: f' "{m.group(1)}":', text)
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return text


def extract_json_from_ts(content: str, variable_name: str) -> Any:
    """Extract JSON data from a TypeScript `export const <name> = <json>;` declaration."""
    # Match optional type annotation, capture everything up to `;` followed by export or EOF
    pattern = f"export const {variable_name}(?::.*?)? = (.*?);\\s*(?:export|$)"
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return {}
    raw = match.group(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Retry with JS→JSON conversion (handles Biome-formatted unquoted keys)
    try:
        return json.loads(_js_to_json(raw))
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON for {variable_name}: {e}")
        return {}


def load_ts_data(project_root: str | Path) -> dict[str, Any]:
    """Load resources.ts + i18n-game.ts into a single dict.

    Returns the same shape that ext_audit_data.ts used to produce:
    {characters, artifacts, weapons, artifactHalfSets, i18nGameData, ...}
    """
    root = Path(project_root)
    data_dir = root / "src" / "data"
    result: dict[str, Any] = {}

    resources_path = data_dir / "resources.ts"
    if resources_path.exists():
        content = resources_path.read_text("utf-8")
        for var in _RESOURCE_VARS:
            result[var] = extract_json_from_ts(content, var)

    # Merge beta resources (appended to characters/weapons/artifacts lists)
    beta_path = data_dir / "resources_beta.ts"
    if beta_path.exists():
        beta_content = beta_path.read_text("utf-8")
        beta_chars = extract_json_from_ts(beta_content, "betaCharacters")
        beta_weapons = extract_json_from_ts(beta_content, "betaWeapons")
        beta_artifacts = extract_json_from_ts(beta_content, "betaArtifacts")
        if beta_chars:
            existing_ids = {c["id"] for c in result.get("characters", [])}
            result.setdefault("characters", []).extend(
                c for c in beta_chars if c["id"] not in existing_ids
            )
        if beta_weapons:
            existing_ids = {w["id"] for w in result.get("weapons", [])}
            result.setdefault("weapons", []).extend(
                w for w in beta_weapons if w["id"] not in existing_ids
            )
        if beta_artifacts:
            existing_ids = {a["id"] for a in result.get("artifacts", [])}
            result.setdefault("artifacts", []).extend(
                a for a in beta_artifacts if a["id"] not in existing_ids
            )

    i18n_path = data_dir / "i18n-game.ts"
    if i18n_path.exists():
        content = i18n_path.read_text("utf-8")
        result["i18nGameData"] = extract_json_from_ts(content, "i18nGameData")

    # Merge beta i18n names (official entries take priority)
    i18n_beta_path = data_dir / "i18n-beta.ts"
    if i18n_beta_path.exists():
        beta_content = i18n_beta_path.read_text("utf-8")
        beta_i18n = extract_json_from_ts(beta_content, "i18nBetaData")
        if beta_i18n:
            i18n = result.setdefault("i18nGameData", {})
            for section in ("characters", "weapons", "artifacts"):
                if section in beta_i18n:
                    existing = i18n.setdefault(section, {})
                    for k, v in beta_i18n[section].items():
                        existing.setdefault(k, v)

    return result
