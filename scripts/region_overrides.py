"""Manual region fallbacks when upstream sources omit character regions.

Edit this dict to assign the correct region to a beta/unreleased character
BEFORE they get their first full scrape, so their `character_beta_stats`
entry carries the right region and their implementation is written into
the correct `character{rarity}{Region}.ts` file from the start.
The release pipeline also uses these pins when Fandom reports "None", so a
new release cannot overwrite the known region with incomplete metadata.

Region values must match the `Region` union in `src/data/types.ts`:
  Mondstadt | Liyue | Inazuma | Sumeru | Fontaine | Natlan
  | Snezhnaya | Nod-Krai | None
"""

from __future__ import annotations

# character id → region
REGION_OVERRIDES: dict[str, str] = {
    "alyosha": "Snezhnaya",
    "linnea": "Snezhnaya",
    "lohen": "Mondstadt",
    "odette": "Snezhnaya",
    "prune": "Mondstadt",
    "sandrone": "Snezhnaya",
    "vesna": "Snezhnaya",
    "vodyanitsa": "Snezhnaya",
}
