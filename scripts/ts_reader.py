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


def extract_json_from_ts(content: str, variable_name: str) -> Any:
    """Extract JSON data from a TypeScript `export const <name> = <json>;` declaration."""
    # Match optional type annotation, capture everything up to `;` followed by export or EOF
    pattern = f"export const {variable_name}(?::.*?)? = (.*?);\\s*(?:export|$)"
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(1))
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

    i18n_path = data_dir / "i18n-game.ts"
    if i18n_path.exists():
        content = i18n_path.read_text("utf-8")
        result["i18nGameData"] = extract_json_from_ts(content, "i18nGameData")

    return result
