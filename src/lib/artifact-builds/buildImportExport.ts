import type { Build, BuildPayload, BuildPayloadV5 } from "@/data/types";
import type { BuildsState } from "@/stores/useBuildsStore";
import type { Draft } from "immer";
import { migrateBuild } from "./buildMigration";
import { areBuildsEqual } from "./buildUtils";
import { getBuildValidationErrors } from "./buildValidation";
import { DEFAULT_COMPUTE_OPTIONS } from "./computeFilters";

export function executeSubscribePreset(
  state: Draft<BuildsState>,
  presetId: string,
  payload: BuildPayloadV5
) {
  state.activePresetId = presetId;
  state.presetDeletedBuildIds = [];
  if (payload.author) state.author = payload.author;
  if (payload.description) state.description = payload.description;

  // Populate characterToBuildIds from preset, preserving custom builds
  for (const [charId, presetBuildIds] of Object.entries(
    payload.characterBuilds
  )) {
    const existingIds = state.characterToBuildIds[charId] || [];
    const presetIdSet = new Set(presetBuildIds);

    // Deduplication: Remove local custom builds that perfectly mirror a preset build
    const customIds = existingIds.filter((id) => {
      if (presetIdSet.has(id)) return false;

      const localBuild = state.builds[id];
      if (!localBuild) return true;

      const isDuplicate = presetBuildIds.some((presetBuildId) => {
        const presetBuild = payload.builds[presetBuildId];
        return presetBuild && areBuildsEqual(localBuild, presetBuild);
      });

      if (isDuplicate) {
        delete state.builds[id];
        delete state.validationErrors[id];
        return false;
      }

      return true;
    });

    state.characterToBuildIds[charId] = [...presetBuildIds, ...customIds];
  }

  // Copy weapons only for characters without existing customizations
  for (const [charId, weapons] of Object.entries(payload.characterWeapons)) {
    if (!state.characterWeapons[charId]?.length) {
      state.characterWeapons[charId] = [...weapons];
    }
  }
}

export function executeImportBuilds(
  state: Draft<BuildsState>,
  payload: BuildPayload | BuildPayloadV5
) {
  // Reset to "Custom Mode" (No Preset)
  state.activePresetId = null;
  state.presetDeletedBuildIds = [];

  // Set metadata if available
  if (payload.author) state.author = payload.author;
  if (payload.description) state.description = payload.description;

  if (payload.version === 5) {
    const v5 = payload as BuildPayloadV5;

    // Merge Configs
    state.computeOptions = {
      ...DEFAULT_COMPUTE_OPTIONS,
      ...(v5.computeOptions ?? {}),
    };

    // Merge Builds
    for (const [id, build] of Object.entries(v5.builds)) {
      migrateBuild(build);
      state.builds[id] = build;
      state.validationErrors[id] = getBuildValidationErrors(build);
    }

    // Merge Character Mappings (using deduplication optionally, but import means replacing references usually)
    for (const [charId, ids] of Object.entries(v5.characterBuilds)) {
      state.characterToBuildIds[charId] = ids;
    }

    // Merge Weapons
    for (const [charId, weapons] of Object.entries(v5.characterWeapons)) {
      state.characterWeapons[charId] = weapons;
    }
  } else {
    // Legacy V4 Import
    const v4 = payload as BuildPayload;

    for (const { characterId, builds } of v4.data) {
      const buildIds: string[] = [];
      for (const build of builds) {
        const buildWithCharacterId: Build = {
          ...build,
          characterId,
        };
        migrateBuild(buildWithCharacterId);

        state.builds[build.id] = buildWithCharacterId;
        state.validationErrors[build.id] =
          getBuildValidationErrors(buildWithCharacterId);
        buildIds.push(build.id);
      }

      if (buildIds.length > 0) {
        state.characterToBuildIds[characterId] = buildIds;
      }
    }

    // Handle character weapons if present in payload
    for (const { characterId, weapons } of v4.data) {
      if (weapons && weapons.length > 0) {
        state.characterWeapons[characterId] = weapons.slice(0, 5);
      } else {
        delete state.characterWeapons[characterId];
      }
    }

    // Apply character hidden flags (Legacy only)
    for (const { characterId, hidden } of v4.data) {
      if (hidden) {
        state.hiddenCharacters[characterId] = true;
      } else {
        delete state.hiddenCharacters[characterId];
      }
    }

    state.computeOptions = {
      ...DEFAULT_COMPUTE_OPTIONS,
      ...(v4.computeOptions ?? {}),
    };
  }
}
