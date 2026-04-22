import { getCachedPreset } from "@/lib/artifact-builds/buildPresetRegistry";
import { getBuildValidationErrors } from "@/lib/artifact-builds/buildValidation";
import { PersistedBuildsStoreSchema } from "@/stores/schemas";
import { invalidateScores } from "@/stores/useAccountStore";
import { create } from "zustand";

let _buildIdSeq = 0;
function nextBuildId(): string {
  return `b${Date.now()}${_buildIdSeq++}`;
}
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Build,
  BuildPayload,
  BuildPayloadV5,
  ComputeOptions,
  SubStat,
  WeightedSubStat,
} from "../data/types";
import {
  executeImportBuilds,
  executeSubscribePreset,
} from "../lib/artifact-builds/buildImportExport";
import { migrateBuild } from "../lib/artifact-builds/buildMigration";
import {
  BUILD_DATA_VERSION,
  areBuildsEqual,
} from "../lib/artifact-builds/buildUtils";
import { DEFAULT_COMPUTE_OPTIONS } from "../lib/artifact-builds/computeFilters";

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

export interface BuildsState {
  // State
  // Metadata about the current "Net Sum" state
  author: string;
  description: string;

  // Reference to the active preset ID (if any)
  activePresetId: string | null;

  // Build storage (Delta + User Created)
  // Maps BuildID -> Build object (only modified presets + custom builds)
  builds: Record<string, Build>;

  // Character mapping (Canonical Ordering)
  // Maps CharacterID -> ordered list of ALL BuildIDs (preset + modified + custom)
  // This is the single source of truth for build ordering.
  characterToBuildIds: Record<string, string[]>;

  // Preset Deletions
  // IDs of builds from the active preset that the user has deleted
  presetDeletedBuildIds: string[];

  // Global UI State
  hasPromptedForPreset: boolean;

  // UI State (Local only)
  hiddenCharacters: Record<string, boolean>;

  // Validation cache
  validationErrors: Record<string, string[]>;

  // Weapon defaults (User overrides)
  characterWeapons: Record<string, string[]>;

  // Global compute options
  computeOptions: ComputeOptions;

  // Getters
  getBuildIds: (characterId: string) => string[];
  getBuild: (buildId: string) => Build | undefined;
  getCharacterWeapons: (characterId: string) => string[];

  // Actions
  newBuild: (characterId: string) => Build;
  copyBuild: (characterId: string, buildId: string, baseBuild?: Build) => Build;
  setBuild: (buildId: string, patch: Partial<Build>, baseBuild?: Build) => void;
  removeBuild: (characterId: string, buildId: string) => void; // Legacy/Smart delete
  deleteBuild: (characterId: string, buildId: string) => void; // Complete delete (hides preset)
  revertBuild: (characterId: string, buildId: string) => void; // Reverts local override
  restoreCharacter: (characterId: string) => void; // Restores preset state for a character
  subscribePreset: (presetId: string, payload: BuildPayloadV5) => void;
  moveBuild: (
    characterId: string,
    resolvedIds: string[],
    buildId: string,
    direction: "up" | "down"
  ) => void;

  // Character visibility
  setCharacterHidden: (characterId: string, hidden: boolean) => void;
  toggleCharacterHidden: (characterId: string) => void;

  // Character weapons
  setCharacterWeapons: (characterId: string, weaponIds: string[]) => void;

  // Utility for import
  // Handles both V4 (Legacy) and V5 (Flat) payloads
  importBuilds: (payload: BuildPayload | BuildPayloadV5) => void;
  clearAll: () => void;

  // Compute options
  setComputeOptions: (options: Partial<ComputeOptions>) => void;
  setMetadata: (author: string, description: string) => void;
  setActivePreset: (presetId: string | null) => void;
  setHasPromptedForPreset: (prompted: boolean) => void;
}

// Empty array constant to avoid creating new arrays
const EMPTY_ARRAY: string[] = [];

export const useBuildsStore = create<BuildsState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      activePresetId: null,
      characterToBuildIds: {},
      builds: {},
      presetDeletedBuildIds: [],
      hasPromptedForPreset: false,
      hiddenCharacters: {},
      validationErrors: {},
      characterWeapons: {},
      computeOptions: { ...DEFAULT_COMPUTE_OPTIONS },
      author: "",
      description: "",

      // Getters
      getBuildIds: (characterId: string) => {
        return get().characterToBuildIds[characterId] ?? EMPTY_ARRAY;
      },

      getBuild: (buildId: string) => {
        return get().builds[buildId];
      },

      getCharacterWeapons: (characterId: string) => {
        return get().characterWeapons[characterId] ?? EMPTY_ARRAY;
      },

      // Create a new build for a character
      newBuild: (characterId: string) => {
        const buildId = nextBuildId();
        const newBuild: Build = {
          id: buildId,
          characterId,
          name: "",
          visible: true,
          composition: "4pc",
          substats: [],
          sandsWeights: [],
          gobletWeights: [],
          circletWeights: [],
          normalizer: 0,
        };

        set((state) => {
          state.builds[buildId] = newBuild;
          state.validationErrors[buildId] = getBuildValidationErrors(newBuild);
          if (!state.characterToBuildIds[characterId]) {
            state.characterToBuildIds[characterId] = [];
          }
          state.characterToBuildIds[characterId].push(buildId);
        });

        return newBuild;
      },

      // Copy an existing build for a character
      copyBuild: (characterId: string, buildId: string, baseBuild?: Build) => {
        const originalBuild = get().builds[buildId] || baseBuild;

        if (!originalBuild) {
          console.error(`Build ${buildId} not found and no baseBuild provided`);
          // Fallback or throw? Let's create a blank one to avoid crash, or throw.
          throw new Error(`Build ${buildId} not found`);
        }

        const newBuildId = nextBuildId();
        const copiedBuild: Build = {
          ...originalBuild,
          id: newBuildId,
          characterId,
        };

        set((state) => {
          state.builds[newBuildId] = copiedBuild;
          state.validationErrors[newBuildId] =
            getBuildValidationErrors(copiedBuild);
          if (!state.characterToBuildIds[characterId]) {
            state.characterToBuildIds[characterId] = [];
          }
          state.characterToBuildIds[characterId].push(newBuildId);
        });

        return copiedBuild;
      },

      restoreCharacter: (characterId: string) => {
        set((state) => {
          // 1. Delete local builds for this character
          const idsToRemove: string[] = [];
          for (const [bid, build] of Object.entries(state.builds)) {
            if (build.characterId === characterId) {
              idsToRemove.push(bid);
            }
          }
          for (const bid of idsToRemove) {
            delete state.builds[bid];
            delete state.validationErrors[bid];
          }

          // 2. Reset ordering to preset defaults (or clear if no preset)
          const preset = getCachedPreset(state.activePresetId);
          const presetBuildIds = preset?.characterBuilds?.[characterId];
          if (presetBuildIds?.length) {
            state.characterToBuildIds[characterId] = [...presetBuildIds];
          } else {
            delete state.characterToBuildIds[characterId];
          }

          // 3. Restore weapons from preset (or clear if no preset)
          const presetWeapons = preset?.characterWeapons?.[characterId];
          if (presetWeapons?.length) {
            state.characterWeapons[characterId] = [...presetWeapons];
          } else {
            delete state.characterWeapons[characterId];
          }

          // 4. Clear hidden status
          delete state.hiddenCharacters[characterId];

          // 5. Un-delete preset builds for this character
          if (presetBuildIds?.length) {
            const presetIdSet = new Set(presetBuildIds);
            state.presetDeletedBuildIds = state.presetDeletedBuildIds.filter(
              (id) => !presetIdSet.has(id)
            );
          }
        });
        invalidateScores([characterId]);
      },

      // Update a build with partial changes
      setBuild: (buildId: string, patch: Partial<Build>, baseBuild?: Build) => {
        // Determine which character is affected (for targeted score invalidation)
        const affectedCharId =
          get().builds[buildId]?.characterId ?? baseBuild?.characterId;
        set((state) => {
          let targetBuild = state.builds[buildId];
          let isNew = false;

          if (!targetBuild) {
            if (baseBuild) {
              // Copy-on-Write: Initialize with baseBuild + patch
              targetBuild = { ...baseBuild, ...patch };
              isNew = true;
            } else {
              console.warn(
                `Build ${buildId} not found and no baseBuild provided`
              );
              return;
            }
          } else {
            // Apply patch to existing local build
            Object.assign(targetBuild, patch);
          }

          // Bug fix: Clean up mutually exclusive fields when composition changes
          if (patch.composition) {
            if (patch.composition === "4pc") {
              targetBuild.halfSet1 = undefined;
              targetBuild.halfSet2 = undefined;
            } else if (patch.composition === "2pc+2pc") {
              targetBuild.artifactSet = undefined;
            }
          }

          // Ensure id and characterId cannot be changed
          targetBuild.id = buildId; // Enforce ID consistency

          // Check if the result still matches the preset version (no-op guard).
          // This prevents marking a build as "modified" when no actual data changed
          // (e.g. clicking the name input without typing, or editing back to original).
          const preset = getCachedPreset(state.activePresetId);
          const presetBuild = preset?.builds[buildId];
          if (presetBuild && areBuildsEqual(targetBuild, presetBuild)) {
            if (isNew) {
              // No actual change from preset — skip copy-on-write entirely
              return;
            }
            // User reverted all changes — auto-revert by removing local override
            delete state.builds[buildId];
            delete state.validationErrors[buildId];
            return;
          }

          if (isNew) {
            // Ensure it's tracked in the character list (Union survival)
            const charId = targetBuild.characterId;
            if (!state.characterToBuildIds[charId]) {
              // Initialize from preset ordering so other builds aren't lost
              const presetIds = preset?.characterBuilds?.[charId];
              state.characterToBuildIds[charId] = presetIds
                ? [...presetIds]
                : [];
            }
            if (!state.characterToBuildIds[charId].includes(buildId)) {
              state.characterToBuildIds[charId].push(buildId);
            }

            // Register the new local override
            state.builds[buildId] = targetBuild;
          }

          // Re-validate
          state.validationErrors[buildId] =
            getBuildValidationErrors(targetBuild);
        });
        if (affectedCharId) invalidateScores([affectedCharId]);
        else invalidateScores();
      },

      // Remove a build from a character
      removeBuild: (characterId: string, buildId: string) => {
        set((state) => {
          // Remove local override if it exists
          if (state.builds[buildId]) {
            delete state.builds[buildId];
            delete state.validationErrors[buildId];
          }

          // Remove from ordering
          const existingBuildIds = state.characterToBuildIds[characterId] || [];
          const newBuildIds = existingBuildIds.filter((id) => id !== buildId);
          if (newBuildIds.length === 0) {
            delete state.characterToBuildIds[characterId];
          } else {
            state.characterToBuildIds[characterId] = newBuildIds;
          }

          // Track deletion for preset builds
          const preset = getCachedPreset(state.activePresetId);
          if (preset?.builds[buildId]) {
            if (!state.presetDeletedBuildIds.includes(buildId)) {
              state.presetDeletedBuildIds.push(buildId);
            }
          }
        });
        invalidateScores([characterId]);
      },

      deleteBuild: (characterId: string, buildId: string) => {
        set((state) => {
          // Remove local override
          if (state.builds[buildId]) {
            delete state.builds[buildId];
            delete state.validationErrors[buildId];
          }

          // Remove from character mapping
          const existingBuildIds = state.characterToBuildIds[characterId] || [];
          const newBuildIds = existingBuildIds.filter((id) => id !== buildId);

          if (newBuildIds.length === 0) {
            delete state.characterToBuildIds[characterId];
          } else {
            state.characterToBuildIds[characterId] = newBuildIds;
          }

          // Mark as deleted in preset (always try to add, safe if no preset active as list is ignored then)
          if (!state.presetDeletedBuildIds.includes(buildId)) {
            state.presetDeletedBuildIds.push(buildId);
          }
        });
        invalidateScores([characterId]);
      },

      revertBuild: (characterId: string, buildId: string) => {
        set((state) => {
          // Remove local override (reverts to preset version)
          if (state.builds[buildId]) {
            delete state.builds[buildId];
            delete state.validationErrors[buildId];
          }

          // Keep in characterToBuildIds to preserve ordering

          // Un-mark deletion (in case build was deleted then reverted)
          const deletedIndex = state.presetDeletedBuildIds.indexOf(buildId);
          if (deletedIndex !== -1) {
            state.presetDeletedBuildIds.splice(deletedIndex, 1);
          }
        });
        invalidateScores([characterId]);
      },

      // Character visibility
      setCharacterHidden: (characterId: string, hidden: boolean) => {
        set((state) => {
          if (hidden) {
            state.hiddenCharacters[characterId] = true;
          } else {
            delete state.hiddenCharacters[characterId];
          }
        });
      },

      toggleCharacterHidden: (characterId: string) => {
        set((state) => {
          const current = !!state.hiddenCharacters[characterId];
          if (current) {
            delete state.hiddenCharacters[characterId];
          } else {
            state.hiddenCharacters[characterId] = true;
          }
        });
      },

      subscribePreset: (presetId: string, payload: BuildPayloadV5) => {
        set((state) => executeSubscribePreset(state, presetId, payload));
        invalidateScores();
      },

      moveBuild: (
        characterId: string,
        resolvedIds: string[],
        buildId: string,
        direction: "up" | "down"
      ) => {
        set((state) => {
          const ids = [...resolvedIds];
          const idx = ids.indexOf(buildId);
          if (idx === -1) return;

          const swapIdx = direction === "up" ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= ids.length) return;

          [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
          state.characterToBuildIds[characterId] = ids;
        });
      },

      setCharacterWeapons: (characterId: string, weaponIds: string[]) => {
        set((state) => {
          if (weaponIds.length === 0) {
            delete state.characterWeapons[characterId];
          } else {
            state.characterWeapons[characterId] = weaponIds.slice(0, 5);
          }
        });
      },

      // Import builds from exported data
      // Import builds from exported data
      importBuilds: (payload: BuildPayload | BuildPayloadV5) => {
        set((state) => executeImportBuilds(state, payload));
        invalidateScores();
      },

      // Clear all data (useful for testing)
      clearAll: () => {
        set((state) => {
          state.activePresetId = null;
          state.characterToBuildIds = {};
          state.builds = {};
          state.presetDeletedBuildIds = [];
          state.hiddenCharacters = {};
          state.validationErrors = {};
          state.characterWeapons = {};
          state.computeOptions = { ...DEFAULT_COMPUTE_OPTIONS };
          state.author = "";
          state.description = "";
        });
      },

      setComputeOptions: (options: Partial<ComputeOptions>) => {
        set((state) => {
          state.computeOptions = {
            ...state.computeOptions,
            ...options,
          };
        });
      },

      setMetadata: (author: string, description: string) => {
        set((state) => {
          state.author = author;
          state.description = description;
        });
      },

      setActivePreset: (presetId: string | null) => {
        set((state) => {
          state.activePresetId = presetId;
          state.presetDeletedBuildIds = [];
        });
        invalidateScores();
      },

      setHasPromptedForPreset: (prompted: boolean) => {
        set((state) => {
          state.hasPromptedForPreset = prompted;
        });
      },
    })),
    {
      name: "artifact-filter-builds",
      version: BUILD_DATA_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        /** Shape of builds store data during migration. Version-dependent fields may be missing. */
        interface LegacyBuildsState {
          builds?: Record<string, Build>;
          characterToBuildIds?: Record<string, string[]>;
          presetDeletedBuildIds?: string[];
          validationErrors?: Record<string, string[]>;
        }

        const state = persistedState as LegacyBuildsState;

        // Guard against missing builds map (corrupted or very old data)
        if (!state.builds || typeof state.builds !== "object") {
          state.builds = {};
        }

        // Ensure required state-level fields exist
        if (!state.validationErrors) {
          state.validationErrors = {};
        }

        if (version < 5) {
          /** Shape of a Build before v5 migration (string[] substats, optional kOverride). */
          interface LegacyBuildV4 {
            substats: string[] | WeightedSubStat[];
            characterId: string;
            kOverride?: unknown;
          }

          // Migration from version < 5 (SubStat[] -> WeightedSubStat[])
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
            // Remove legacy kOverride field
            if ("kOverride" in legacy) {
              // biome-ignore lint/performance/noDelete: Migration cleanup of legacy field
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

        return state as BuildsState;
      },
      // migrate() only runs on version mismatch. merge() runs on EVERY
      // rehydration, ensuring idempotent build-level migrations
      // (sandsWeights, normalizer, etc.) are applied even when the stored
      // version already matches the configured version.
      merge: (persistedState, currentState) => {
        const parsed = PersistedBuildsStoreSchema.safeParse(persistedState);
        const persisted = parsed.success ? parsed.data : {};
        const merged = { ...currentState, ...persisted };
        for (const build of Object.values(merged.builds)) {
          migrateBuild(build);
        }
        return merged;
      },
    }
  )
);
