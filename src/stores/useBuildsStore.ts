import { create } from "zustand";
import {
  type BuildDelta,
  dedupeBuildDeltasAgainstPreset,
  deleteBuildDelta,
  deriveBuildRuntimeFromDeltas,
  getBuildDeltaDisplayIndex,
  removeCustomBuildDelta,
  setBuildDeltaOrderForCharacter,
  upsertCustomBuildDelta,
  upsertPresetBuildDelta,
} from "@/lib/artifact-builds/buildDeltas";
import {
  cacheBuildPreset,
  getCachedBuildPreset,
} from "@/lib/artifact-builds/buildPresetRegistry";
import {
  filterValidBuildGroups,
  getBuildValidationErrors,
} from "@/lib/artifact-builds/buildValidation";
import { PersistedBuildsStoreSchema } from "@/stores/schemas";
import { invalidateScores } from "@/stores/useAccountScoreCacheStore";

let _buildIdSeq = 0;
function nextBuildId(): string {
  return `b${Date.now()}${_buildIdSeq++}`;
}

import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { BuildSource } from "../data/enums";
import type {
  Build,
  BuildGroup,
  BuildPayload,
  BuildPayloadV5,
  ComputeOptions,
} from "../data/types";
import {
  executeImportBuilds,
  executeSubscribePreset,
} from "../lib/artifact-builds/buildImportExport";
import { migrateBuild } from "../lib/artifact-builds/buildMigration";
import {
  areBuildsEqual,
  BUILD_DATA_VERSION,
} from "../lib/artifact-builds/buildUtils";
import { DEFAULT_COMPUTE_OPTIONS } from "../lib/artifact-builds/computeFilters";
import { migrateBuildsStore } from "./migration/builds";

export type BuildsSourceState = {
  activePresetId: string | null;
  deltas: BuildDelta[];
  hiddenCharacters: Record<string, boolean>;
  characterWeapons: Record<string, string[]>;
  computeOptions: ComputeOptions;
  author: string;
  description: string;
};

export interface BuildsState {
  // State
  // Metadata about the current "Net Sum" state
  author: string;
  description: string;

  // Reference to the active preset ID (if any)
  activePresetId: string | null;

  // Hydrated runtime preset payload for the active preset. Not persisted.
  activePresetPayload: BuildPayloadV5 | null;

  // Canonical persisted build customizations and preset tombstones/order.
  deltas: BuildDelta[];

  // Derived runtime view: only modified presets + custom builds.
  builds: Record<string, Build>;

  // Derived runtime view: ordered build IDs by character.
  characterToBuildIds: Record<string, string[]>;

  // Derived runtime view: IDs of hidden preset builds.
  presetDeletedBuildIds: string[];

  // Derived runtime view: full preset/custom builds for UI consumers.
  resolvedBuildsByCharacterId: Record<string, Build[]>;
  resolvedBuildGroups: BuildGroup[];
  validResolvedBuildGroups: BuildGroup[];

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
  hasBuildData: () => boolean;
  hasCharacterCustomizations: (characterId: string) => boolean;

  // Actions
  newBuild: (characterId: string) => Build;
  copyBuild: (characterId: string, buildId: string, baseBuild?: Build) => Build;
  setBuild: (buildId: string, patch: Partial<Build>, baseBuild?: Build) => void;
  removeBuild: (characterId: string, buildId: string) => void;
  revertBuild: (characterId: string, buildId: string) => void; // Reverts local override
  restoreCharacter: (characterId: string) => void; // Restores preset state for a character
  subscribePreset: (presetId: string, payload: BuildPayloadV5) => void;
  hydratePreset: (presetId: string, payload: BuildPayloadV5) => void;
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
  replaceSourceState: (source: BuildsSourceState) => void;
  clearAll: () => void;

  // Compute options
  setComputeOptions: (options: Partial<ComputeOptions>) => void;
  setMetadata: (author: string, description: string) => void;
  setActivePreset: (presetId: string | null) => void;
  setHasPromptedForPreset: (prompted: boolean) => void;
}

// Empty array constant to avoid creating new arrays
const EMPTY_ARRAY: string[] = [];
const EMPTY_BUILDS: Build[] = [];

export function selectBuildsForCharacter(
  state: BuildsState,
  characterId: string
): Build[] {
  return state.resolvedBuildsByCharacterId[characterId] ?? EMPTY_BUILDS;
}

export function selectResolvedBuildGroups(state: BuildsState): BuildGroup[] {
  return state.resolvedBuildGroups;
}

export function selectValidResolvedBuildGroups(
  state: BuildsState
): BuildGroup[] {
  return state.validResolvedBuildGroups;
}

function getBuildScoreDependencySignature(state: BuildsState): string {
  return JSON.stringify(
    state.resolvedBuildGroups.map((group) => ({
      characterId: group.characterId,
      weapons: group.weapons,
      builds: group.builds.map((build) => {
        const { source: _source, ...scoredBuild } = build;
        return scoredBuild;
      }),
    }))
  );
}

function getActivePresetPayload(state: BuildsState): BuildPayloadV5 | null {
  return (
    state.activePresetPayload ?? getCachedBuildPreset(state.activePresetId)
  );
}

function deriveBuildSource(
  id: string,
  buildsMap: Record<string, Build>,
  preset: BuildPayloadV5 | null
): BuildSource {
  const inLocal = id in buildsMap;
  const inPreset = !!preset?.builds[id];
  if (inLocal && inPreset) return "modified";
  if (inPreset) return "preset";
  return "custom";
}

function withBuildSource(
  build: Build,
  source: BuildSource,
  previous: Build | undefined
): Build {
  if (build.source === source) return build;
  if (
    previous?.source === source &&
    previous.id === build.id &&
    areBuildsEqual(previous, build)
  ) {
    return previous;
  }
  return { ...build, source };
}

function reuseBuildArrayIfUnchanged(
  builds: Build[],
  previous: Build[] | undefined
): Build[] {
  if (!previous || previous.length !== builds.length) return builds;
  return builds.every((build, index) => build === previous[index])
    ? previous
    : builds;
}

function deriveResolvedBuildViews(
  state: BuildsState,
  preset: BuildPayloadV5 | null
): {
  resolvedBuildsByCharacterId: Record<string, Build[]>;
  resolvedBuildGroups: BuildGroup[];
  validResolvedBuildGroups: BuildGroup[];
} {
  const resolvedBuildsByCharacterId: Record<string, Build[]> = {};
  const resolvedBuildGroups: BuildGroup[] = [];
  const previousResolvedBuilds = state.resolvedBuildsByCharacterId;

  for (const [characterId, ids] of Object.entries(state.characterToBuildIds)) {
    const previousById = new Map(
      (previousResolvedBuilds[characterId] ?? []).map((build) => [
        build.id,
        build,
      ])
    );
    const previousBuilds = previousResolvedBuilds[characterId];
    const builds = ids
      .map((id): Build | null => {
        const localBuild = state.builds[id];
        const presetBuild = preset?.builds[id];
        const build = localBuild ?? presetBuild;
        if (!build) return null;
        return withBuildSource(
          build,
          deriveBuildSource(id, state.builds, preset),
          previousById.get(id)
        );
      })
      .filter((build): build is Build => build !== null);

    if (builds.length === 0) continue;
    const stableBuilds = reuseBuildArrayIfUnchanged(builds, previousBuilds);
    resolvedBuildsByCharacterId[characterId] = stableBuilds;

    if (state.hiddenCharacters[characterId]) continue;
    resolvedBuildGroups.push({
      characterId,
      builds: stableBuilds,
      hidden: false,
      weapons: state.characterWeapons[characterId] ?? [],
    });
  }

  return {
    resolvedBuildsByCharacterId,
    resolvedBuildGroups,
    validResolvedBuildGroups: filterValidBuildGroups(resolvedBuildGroups),
  };
}

function refreshDerivedBuildState(
  state: BuildsState,
  preset = getActivePresetPayload(state)
): void {
  const previousCharacterToBuildIds = state.characterToBuildIds;
  const runtime = deriveBuildRuntimeFromDeltas(state.deltas, preset);
  if (!preset) {
    const customBuildIds = new Set(Object.keys(runtime.builds));
    const visiblePresetIds = new Set(
      state.deltas
        .filter((delta) => delta.kind === "preset" && !delta.deleted)
        .map((delta) => delta.id)
    );
    for (const [characterId, previousIds] of Object.entries(
      previousCharacterToBuildIds
    )) {
      const preservedIds = previousIds.filter(
        (id) => customBuildIds.has(id) || visiblePresetIds.has(id)
      );
      preservedIds.sort((a, b) => {
        const aIndex =
          getBuildDeltaDisplayIndex(state.deltas, a) ?? previousIds.indexOf(a);
        const bIndex =
          getBuildDeltaDisplayIndex(state.deltas, b) ?? previousIds.indexOf(b);
        return aIndex - bIndex;
      });
      const runtimeIds = runtime.characterToBuildIds[characterId] ?? [];
      for (const id of runtimeIds) {
        if (!preservedIds.includes(id)) preservedIds.push(id);
      }
      if (preservedIds.length > 0) {
        runtime.characterToBuildIds[characterId] = preservedIds;
      }
    }
  }
  state.builds = runtime.builds;
  state.characterToBuildIds = runtime.characterToBuildIds;
  state.presetDeletedBuildIds = runtime.presetDeletedBuildIds;
  state.validationErrors = {};
  for (const build of Object.values(state.builds)) {
    state.validationErrors[build.id] = getBuildValidationErrors(build);
  }
  const resolved = deriveResolvedBuildViews(state, preset);
  state.resolvedBuildsByCharacterId = resolved.resolvedBuildsByCharacterId;
  state.resolvedBuildGroups = resolved.resolvedBuildGroups;
  state.validResolvedBuildGroups = resolved.validResolvedBuildGroups;
}

function getNextDisplayIndex(state: BuildsState, characterId: string): number {
  return state.characterToBuildIds[characterId]?.length ?? 0;
}

function ensurePresetOrderDeltasForCharacter(
  state: BuildsState,
  characterId: string
): void {
  const preset = getActivePresetPayload(state);
  const presetBuildIds = preset?.characterBuilds?.[characterId];
  if (!presetBuildIds?.length) return;

  const hasCharacterDelta = state.deltas.some((delta) => {
    if (delta.kind === "custom") {
      return delta.value.characterId === characterId;
    }
    return presetBuildIds.includes(delta.id);
  });
  if (hasCharacterDelta) return;

  presetBuildIds.forEach((id, displayIndex) => {
    state.deltas = upsertPresetBuildDelta(state.deltas, id, { displayIndex });
  });
}

export const useBuildsStore = create<BuildsState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      activePresetId: null,
      activePresetPayload: null,
      deltas: [],
      characterToBuildIds: {},
      builds: {},
      presetDeletedBuildIds: [],
      resolvedBuildsByCharacterId: {},
      resolvedBuildGroups: [],
      validResolvedBuildGroups: [],
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

      hasBuildData: () => {
        const state = get();
        return (
          state.deltas.length > 0 ||
          Object.keys(state.characterToBuildIds).length > 0
        );
      },

      hasCharacterCustomizations: (characterId: string) => {
        const state = get();
        if (
          state.deltas.some(
            (delta) =>
              delta.kind === "custom" && delta.value.characterId === characterId
          )
        ) {
          return true;
        }

        const preset = getActivePresetPayload(state);
        const presetBuildIds = preset?.characterBuilds?.[characterId];
        return state.deltas.some(
          (delta) =>
            delta.kind === "preset" &&
            delta.deleted &&
            presetBuildIds?.includes(delta.id)
        );
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
          ensurePresetOrderDeltasForCharacter(state, characterId);
          state.deltas = upsertCustomBuildDelta(
            state.deltas,
            newBuild,
            getNextDisplayIndex(state, characterId)
          );
          refreshDerivedBuildState(state);
        });

        invalidateScores([characterId]);
        return newBuild;
      },

      // Copy an existing build for a character
      copyBuild: (characterId: string, buildId: string, baseBuild?: Build) => {
        const originalBuild = get().builds[buildId] || baseBuild;

        if (!originalBuild) {
          console.error(`Build ${buildId} not found and no baseBuild provided`);
          // Missing source builds can occur while editing custom-only state.
          throw new Error(`Build ${buildId} not found`);
        }

        const newBuildId = nextBuildId();
        const copiedBuild: Build = {
          ...originalBuild,
          id: newBuildId,
          characterId,
        };

        set((state) => {
          ensurePresetOrderDeltasForCharacter(state, characterId);
          state.deltas = upsertCustomBuildDelta(
            state.deltas,
            copiedBuild,
            getNextDisplayIndex(state, characterId)
          );
          refreshDerivedBuildState(state);
        });

        invalidateScores([characterId]);
        return copiedBuild;
      },

      restoreCharacter: (characterId: string) => {
        set((state) => {
          const preset = getActivePresetPayload(state);
          const presetBuildIds = preset?.characterBuilds?.[characterId];

          state.deltas = state.deltas.filter((delta) => {
            if (delta.kind === "custom") {
              return delta.value.characterId !== characterId;
            }
            return !presetBuildIds?.includes(delta.id);
          });

          presetBuildIds?.forEach((id, displayIndex) => {
            state.deltas = upsertPresetBuildDelta(state.deltas, id, {
              displayIndex,
            });
          });

          // Restore weapons from preset (or clear if no preset)
          const presetWeapons = preset?.characterWeapons?.[characterId];
          if (presetWeapons?.length) {
            state.characterWeapons[characterId] = [...presetWeapons];
          } else {
            delete state.characterWeapons[characterId];
          }

          delete state.hiddenCharacters[characterId];
          refreshDerivedBuildState(state);
        });
        invalidateScores([characterId]);
      },

      // Update a build with partial changes
      setBuild: (buildId: string, patch: Partial<Build>, baseBuild?: Build) => {
        // Determine which character is affected (for targeted score invalidation)
        const affectedCharId =
          get().builds[buildId]?.characterId ?? baseBuild?.characterId;
        set((state) => {
          let targetBuild = state.builds[buildId]
            ? { ...state.builds[buildId] }
            : undefined;
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
          const preset = getActivePresetPayload(state);
          const presetBuild = preset?.builds[buildId];
          const displayIndex = getBuildDeltaDisplayIndex(state.deltas, buildId);
          if (presetBuild && areBuildsEqual(targetBuild, presetBuild)) {
            if (isNew) {
              // No actual change from preset — skip copy-on-write entirely
              return;
            }
            // User reverted all changes — auto-revert by removing local override
            state.deltas = removeCustomBuildDelta(state.deltas, buildId);
            state.deltas = upsertPresetBuildDelta(state.deltas, buildId, {
              ...(displayIndex != null ? { displayIndex } : {}),
            });
            refreshDerivedBuildState(state);
            return;
          }

          if (isNew)
            ensurePresetOrderDeltasForCharacter(state, targetBuild.characterId);
          state.deltas = upsertCustomBuildDelta(
            state.deltas,
            targetBuild,
            getBuildDeltaDisplayIndex(state.deltas, buildId) ??
              getNextDisplayIndex(state, targetBuild.characterId)
          );
          refreshDerivedBuildState(state);
        });
        if (affectedCharId) invalidateScores([affectedCharId]);
        else invalidateScores();
      },

      // Remove a build from a character
      removeBuild: (characterId: string, buildId: string) => {
        set((state) => {
          const preset = getActivePresetPayload(state);
          const displayIndex = getBuildDeltaDisplayIndex(state.deltas, buildId);
          const isPresetBuild =
            !!preset?.builds[buildId] ||
            state.deltas.some(
              (delta) => delta.kind === "preset" && delta.id === buildId
            );
          if (isPresetBuild) {
            state.deltas = deleteBuildDelta(
              state.deltas,
              buildId,
              displayIndex
            );
          } else {
            state.deltas = removeCustomBuildDelta(state.deltas, buildId);
          }

          const existingBuildIds = state.characterToBuildIds[characterId] || [];
          const newBuildIds = existingBuildIds.filter((id) => id !== buildId);
          state.deltas = setBuildDeltaOrderForCharacter(
            state.deltas,
            characterId,
            newBuildIds,
            preset
          );
          refreshDerivedBuildState(state);
        });
        invalidateScores([characterId]);
      },

      revertBuild: (characterId: string, buildId: string) => {
        set((state) => {
          const preset = getActivePresetPayload(state);
          const displayIndex = getBuildDeltaDisplayIndex(state.deltas, buildId);
          const isPresetBuild =
            !!preset?.builds[buildId] ||
            state.deltas.some(
              (delta) => delta.kind === "preset" && delta.id === buildId
            );
          state.deltas = removeCustomBuildDelta(state.deltas, buildId);
          state.deltas = state.deltas.filter(
            (delta) => !(delta.kind === "preset" && delta.id === buildId)
          );
          if (isPresetBuild) {
            state.deltas = upsertPresetBuildDelta(state.deltas, buildId, {
              ...(displayIndex != null ? { displayIndex } : {}),
            });
          }
          refreshDerivedBuildState(state);
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
          refreshDerivedBuildState(state);
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
          refreshDerivedBuildState(state);
        });
      },

      subscribePreset: (presetId: string, payload: BuildPayloadV5) => {
        cacheBuildPreset(presetId, payload);
        set((state) => {
          state.activePresetPayload = payload;
          executeSubscribePreset(state, presetId, payload);
          refreshDerivedBuildState(state, payload);
        });
        invalidateScores();
      },

      hydratePreset: (presetId: string, payload: BuildPayloadV5) => {
        cacheBuildPreset(presetId, payload);
        let scoreDependenciesChanged = false;
        set((state) => {
          if (state.activePresetId !== presetId) return;
          const previousSignature = getBuildScoreDependencySignature(state);
          state.activePresetPayload = payload;
          state.deltas = dedupeBuildDeltasAgainstPreset(state.deltas, payload);
          refreshDerivedBuildState(state, payload);
          scoreDependenciesChanged =
            previousSignature !== getBuildScoreDependencySignature(state);
        });
        if (scoreDependenciesChanged) invalidateScores();
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
          const preset = getActivePresetPayload(state);
          state.deltas = setBuildDeltaOrderForCharacter(
            state.deltas,
            characterId,
            ids,
            preset
          );
          refreshDerivedBuildState(state);
        });
        invalidateScores([characterId]);
      },

      setCharacterWeapons: (characterId: string, weaponIds: string[]) => {
        set((state) => {
          if (weaponIds.length === 0) {
            delete state.characterWeapons[characterId];
          } else {
            state.characterWeapons[characterId] = weaponIds.slice(0, 5);
          }
          refreshDerivedBuildState(state);
        });
      },

      // Import builds from exported data
      importBuilds: (payload: BuildPayload | BuildPayloadV5) => {
        set((state) => {
          executeImportBuilds(state, payload);
          state.activePresetPayload = null;
          refreshDerivedBuildState(state, null);
        });
        invalidateScores();
      },

      replaceSourceState: (source) => {
        set((state) => {
          state.activePresetId = source.activePresetId;
          state.activePresetPayload = getCachedBuildPreset(
            source.activePresetId
          );
          state.deltas = source.deltas;
          state.hiddenCharacters = source.hiddenCharacters;
          state.characterWeapons = source.characterWeapons;
          state.computeOptions = source.computeOptions;
          state.author = source.author;
          state.description = source.description;
          refreshDerivedBuildState(state);
        });
        invalidateScores();
      },

      // Clear all data (useful for testing)
      clearAll: () => {
        set((state) => {
          state.activePresetId = null;
          state.activePresetPayload = null;
          state.deltas = [];
          state.characterToBuildIds = {};
          state.builds = {};
          state.presetDeletedBuildIds = [];
          state.resolvedBuildsByCharacterId = {};
          state.resolvedBuildGroups = [];
          state.validResolvedBuildGroups = [];
          state.hiddenCharacters = {};
          state.validationErrors = {};
          state.characterWeapons = {};
          state.computeOptions = { ...DEFAULT_COMPUTE_OPTIONS };
          state.author = "";
          state.description = "";
        });
        invalidateScores();
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
          state.activePresetPayload = getCachedBuildPreset(presetId);
          state.deltas = state.deltas.map((delta) => {
            if (delta.kind !== "preset" || !delta.deleted) return delta;
            const { deleted: _deleted, ...rest } = delta;
            return rest;
          });
          const preset = getActivePresetPayload(state);
          state.deltas = dedupeBuildDeltasAgainstPreset(state.deltas, preset);
          refreshDerivedBuildState(state, preset);
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
      migrate: migrateBuildsStore,
      // migrate() only runs on version mismatch. merge() runs on EVERY
      // rehydration, ensuring idempotent build-level migrations
      // (sandsWeights, normalizer, etc.) are applied even when the stored
      // version already matches the configured version.
      partialize: (state) => ({
        activePresetId: state.activePresetId,
        deltas: state.deltas,
        hasPromptedForPreset: state.hasPromptedForPreset,
        hiddenCharacters: state.hiddenCharacters,
        characterWeapons: state.characterWeapons,
        computeOptions: state.computeOptions,
        author: state.author,
        description: state.description,
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedBuildsStoreSchema.safeParse(persistedState);
        const persisted = parsed.success ? parsed.data : {};
        const merged = { ...currentState, ...persisted };
        for (const delta of merged.deltas) {
          if (delta.kind === "custom") {
            migrateBuild(delta.value);
          }
        }
        merged.activePresetPayload = getCachedBuildPreset(
          merged.activePresetId
        );
        refreshDerivedBuildState(merged, merged.activePresetPayload);
        return merged;
      },
    }
  )
);

export function getResolvedBuildGroupsSnapshot(): BuildGroup[] {
  return useBuildsStore.getState().resolvedBuildGroups;
}

export function getValidResolvedBuildGroupsSnapshot(): BuildGroup[] {
  return useBuildsStore.getState().validResolvedBuildGroups;
}
