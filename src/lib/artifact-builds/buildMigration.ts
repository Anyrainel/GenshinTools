import type { Build, MainStat, SubStat, WeightedMainStat } from "@/data/types";
import { computeIdealScore } from "@/lib/artifact/scoring/utils";

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
 * Populate main stat weights and normalizer from existing build data.
 * Each accepted main stat gets weight 100 (no differentiation in legacy builds).
 * Normalizer is computed from the build's substat weights.
 * Idempotent — skips fields already present.
 */
function migrateWeightsAndNormalizer(build: Build): void {
  // Migrate legacy sands/goblet/circlet arrays → weighted main stats.
  // Use Array.isArray to guard against non-array values from old persisted data
  // (zustand persist only calls migrate on version change, so builds persisted
  // at the current version may lack these fields entirely).
  const legacy = build as Record<string, unknown>;
  if (!Array.isArray(build.sandsWeights) || build.sandsWeights.length === 0) {
    const old = Array.isArray(legacy.sands) ? (legacy.sands as MainStat[]) : [];
    build.sandsWeights = old.map(
      (stat): WeightedMainStat => ({ stat, weight: 100 })
    );
    // Only delete legacy field after successful migration
    legacy.sands = undefined;
  }
  if (!Array.isArray(build.gobletWeights) || build.gobletWeights.length === 0) {
    const old = Array.isArray(legacy.goblet)
      ? (legacy.goblet as MainStat[])
      : [];
    build.gobletWeights = old.map(
      (stat): WeightedMainStat => ({ stat, weight: 100 })
    );
    legacy.goblet = undefined;
  }
  if (
    !Array.isArray(build.circletWeights) ||
    build.circletWeights.length === 0
  ) {
    const old = Array.isArray(legacy.circlet)
      ? (legacy.circlet as MainStat[])
      : [];
    build.circletWeights = old.map(
      (stat): WeightedMainStat => ({ stat, weight: 100 })
    );
    legacy.circlet = undefined;
  }

  // Normalizer: compute from substat weights + best main stat weights.
  // Only recompute when truly missing (null/undefined), not when intentionally 0.
  if (build.normalizer == null) {
    const weights = {} as Record<SubStat, number>;
    for (const { stat, weight } of build.substats ?? []) {
      weights[stat] = weight;
    }
    const sandsW = build.sandsWeights[0]?.weight ?? 100;
    const gobletW = build.gobletWeights[0]?.weight ?? 100;
    const circletW = build.circletWeights[0]?.weight ?? 100;
    build.normalizer = computeIdealScore(
      weights,
      sandsW,
      gobletW,
      circletW
    ).normalizer;
  }
}

/**
 * Apply all build-level migrations in-place. Idempotent — safe to call on
 * every load, import, or preset subscription.
 *
 * Guarantees all required Build fields exist after execution, so consumers
 * never encounter undefined on typed fields. This is the single validation
 * gate for Build data deserialized from localStorage or external JSON.
 *
 * Currently handles:
 * - substats: ensure always a WeightedSubStat[] (not undefined/null/wrong type)
 * - visible / composition / name: ensure present with sensible defaults
 * - halfSet1/halfSet2: legacy numeric → stat-derived string IDs
 * - sandsWeights/gobletWeights/circletWeights: populate from sands/goblet/circlet arrays
 * - normalizer: compute from substat weights if missing
 */
export function migrateBuild(build: Build): void {
  // ── Required scalar fields ──
  if (typeof build.name !== "string") build.name = "";
  if (typeof build.visible !== "boolean") build.visible = true;
  if (build.composition !== "4pc" && build.composition !== "2pc+2pc")
    build.composition = "4pc";

  // ── substats: must be WeightedSubStat[] ──
  if (!Array.isArray(build.substats)) {
    build.substats = [];
  }

  // Cast: persisted data may still contain legacy numeric IDs even though
  // the Build type now declares halfSet1/halfSet2 as string-only.
  build.halfSet1 = normalizeHalfSetId(
    build.halfSet1 as number | string | undefined
  );
  build.halfSet2 = normalizeHalfSetId(
    build.halfSet2 as number | string | undefined
  );
  migrateWeightsAndNormalizer(build);
}
