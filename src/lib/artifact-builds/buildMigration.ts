import type { Build } from "@/data/types";

/**
 * Migration map from legacy numeric halfSet IDs to new string-based IDs.
 *
 * New IDs are derived from the mechanical stat effect (e.g. "atk%-18" for ATK +18%).
 * Since old IDs are numbers and new IDs are strings, the sets are non-overlapping,
 * making the translation idempotent and safe to run on every rehydration.
 *
 * IDs 12 and 17 were duplicate effects (Healing Bonus +15%) — both map to "heal%-15".
 */
const LEGACY_HALFSET_MAP: Record<number, string> = {
  1: "cryo%-15",
  2: "hp%-20",
  3: "def%-30",
  4: "electro%-15",
  5: "electro-res-40",
  6: "geo%-15",
  7: "em-80",
  8: "burst-dmg%-20",
  9: "atk%-18",
  10: "phys%-25",
  11: "hydro%-15",
  12: "heal%-15",
  13: "pyro-res-40",
  14: "pyro%-15",
  15: "er-20",
  16: "anemo%-15",
  17: "heal%-15", // duplicate of 12
  18: "shield-35",
  19: "dendro%-15",
  20: "na-ca-dmg%-15",
  21: "skill-dmg%-20",
  22: "nightsoul-energy-6",
  23: "nightsoul-dmg%-15",
  24: "plunge-dmg%-25",
};

/** All valid new-format halfSet IDs (deduplicated). */
const VALID_HALFSET_IDS = [...new Set(Object.values(LEGACY_HALFSET_MAP))];

/**
 * Normalize a halfSet ID from any format (legacy number or new string) to the
 * canonical string format. Returns undefined if the input is not a recognized ID.
 *
 * This is idempotent: calling it on an already-migrated string ID is a no-op.
 */
function normalizeHalfSetId(
  id: number | string | undefined
): string | undefined {
  if (id == null) return undefined;
  if (typeof id === "number") return LEGACY_HALFSET_MAP[id];
  // Already a string — validate it's a known ID
  if (VALID_HALFSET_IDS.includes(id)) return id;
  // Unknown string — try parsing as a number (handles JSON edge case "17" → number)
  const num = Number(id);
  if (!Number.isNaN(num) && LEGACY_HALFSET_MAP[num])
    return LEGACY_HALFSET_MAP[num];
  return undefined;
}

/**
 * Apply all build-level migrations in-place. Idempotent — safe to call on
 * every load, import, or preset subscription.
 *
 * Currently handles:
 * - halfSet1/halfSet2: legacy numeric → stat-derived string IDs
 */
export function migrateBuild(build: Build): void {
  build.halfSet1 = normalizeHalfSetId(build.halfSet1);
  build.halfSet2 = normalizeHalfSetId(build.halfSet2);
}
