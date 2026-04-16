"""Manual region overrides for characters when the lunaris.moe API doesn't
provide an accurate associationType.

Edit this dict to assign the correct region to a beta/unreleased character
BEFORE they get their first full scrape, so their `character_beta_stats`
entry carries the right region and their implementation is written into
the correct `character{rarity}{Region}.ts` file from the start.

Region values must match the `Region` union in `src/data/types.ts`:
  Mondstadt | Liyue | Inazuma | Sumeru | Fontaine | Natlan
  | Snezhnaya | Nod-Krai | None
"""

from __future__ import annotations

# character id → region
REGION_OVERRIDES: dict[str, str] = {
    "linnea": "Snezhnaya",
    "lohen": "Mondstadt",
    "nicole": "Nod-Krai",
    "prune": "Nod-Krai",
}
