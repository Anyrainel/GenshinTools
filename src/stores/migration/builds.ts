import type { SubStat } from "@/data/enums";
import type { Build, WeightedSubStat } from "@/data/types";
import {
  type BuildDelta,
  createBuildDeltasFromLegacyState,
  disableBuildsForCharacters,
} from "@/lib/artifact-builds/buildDeltas";
import { migrateBuild } from "@/lib/artifact-builds/buildMigration";
import { getBuildValidationErrors } from "@/lib/artifact-builds/buildValidation";

// Migrates old SubStat[] to WeightedSubStat[]. Uses default weight 100 when no
// build-based weights are available (e.g. during store migration).
const migrateSubstats = (
  oldSubstats: string[],
  _characterId: string
): WeightedSubStat[] => {
  const flatStats = ["hp", "atk", "def"];
  const weighted = oldSubstats
    .filter((stat) => !flatStats.includes(stat))
    .map((stat) => ({
      stat: stat as SubStat,
      weight: 100,
    }));
  return weighted.sort((a, b) => b.weight - a.weight);
};

/** Shape of builds store data during migration. Version-dependent fields may be missing. */
interface LegacyBuildsState {
  deltas?: BuildDelta[];
  builds?: Record<string, Build>;
  characterToBuildIds?: Record<string, string[]>;
  presetDeletedBuildIds?: string[];
  validationErrors?: Record<string, string[]>;
  activePresetId?: string | null;
  hiddenCharacters?: Record<string, boolean>;
}

/** Shape of a Build before v5 migration (string[] substats, optional kOverride). */
interface LegacyBuildV4 {
  substats: string[] | WeightedSubStat[];
  characterId: string;
  kOverride?: unknown;
}

export function migrateBuildsStore(
  persistedState: unknown,
  version: number
): Record<string, unknown> {
  const state = persistedState as LegacyBuildsState;

  // Before v6, the store persisted build deltas in three separate fields:
  // - builds: custom builds and modified preset builds keyed by build ID
  // - characterToBuildIds: ordered build IDs per character
  // - presetDeletedBuildIds: preset IDs hidden by the user
  // v6 stores that information as a single PresetDelta<Build>[] list.

  // Guard against missing builds map (corrupted or very old data).
  if (!state.builds || typeof state.builds !== "object") {
    state.builds = {};
  }

  // Ensure required state-level fields exist.
  if (!state.validationErrors) {
    state.validationErrors = {};
  }

  if (version < 5) {
    // Migration from version < 5 (SubStat[] -> WeightedSubStat[]).
    for (const build of Object.values(state.builds)) {
      const legacy = build as unknown as LegacyBuildV4;
      if (
        Array.isArray(legacy.substats) &&
        typeof legacy.substats[0] === "string"
      ) {
        build.substats = migrateSubstats(
          legacy.substats as string[],
          legacy.characterId
        );
      }
      // Remove legacy kOverride field.
      if ("kOverride" in legacy) {
        delete legacy.kOverride;
      }
    }
  }

  // Run idempotent build-level migrations (halfSet IDs, weights, normalizer)
  // on every version so persisted data always has required fields.
  for (const build of Object.values(state.builds)) {
    migrateBuild(build);
    state.validationErrors[build.id] = getBuildValidationErrors(build);
  }

  if (version < 6 || !Array.isArray(state.deltas)) {
    state.deltas = createBuildDeltasFromLegacyState({
      builds: state.builds,
      characterToBuildIds: state.characterToBuildIds,
      presetDeletedBuildIds: state.presetDeletedBuildIds,
    });
  }

  for (const delta of state.deltas) {
    if (delta.kind === "custom") {
      migrateBuild(delta.value);
    }
  }

  if (version < 7 && state.hiddenCharacters) {
    const hiddenCharacterIds = Object.entries(state.hiddenCharacters).flatMap(
      ([characterId, hidden]) => (hidden ? [characterId] : [])
    );
    state.deltas = disableBuildsForCharacters(
      state.deltas,
      hiddenCharacterIds,
      null
    );
    delete state.hiddenCharacters;
  }

  return state as Record<string, unknown>;
}
