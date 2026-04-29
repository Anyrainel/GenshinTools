import type { Draft } from "immer";
import type { Build, BuildPayload, BuildPayloadV5 } from "@/data/types";
import {
  type BuildDelta,
  setBuildDeltaOrderForCharacter,
  upsertCustomBuildDelta,
  upsertPresetBuildDelta,
} from "@/lib/artifact-builds/buildDeltas";
import type { BuildsState } from "@/stores/useBuildsStore";
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
  if (payload.author) state.author = payload.author;
  if (payload.description) state.description = payload.description;

  let nextDeltas: BuildDelta[] = state.deltas.filter(
    (delta) => delta.kind === "custom"
  ) as BuildDelta[];

  for (const presetBuildIds of Object.values(payload.characterBuilds)) {
    presetBuildIds.forEach((id, displayIndex) => {
      nextDeltas = upsertPresetBuildDelta(nextDeltas, id, { displayIndex });
    });
  }

  for (const [charId, presetBuildIds] of Object.entries(
    payload.characterBuilds
  )) {
    const existingIds = state.characterToBuildIds[charId] || [];
    const presetIdSet = new Set(presetBuildIds);
    let customIndex = presetBuildIds.length;

    for (const id of existingIds) {
      const localBuild = state.builds[id];
      if (!localBuild) continue;

      const isDuplicate = presetBuildIds.some((presetBuildId) => {
        const presetBuild = payload.builds[presetBuildId];
        return presetBuild && areBuildsEqual(localBuild, presetBuild);
      });

      if (isDuplicate) {
        nextDeltas = nextDeltas.filter(
          (delta) => !(delta.kind === "custom" && delta.id === id)
        );
        continue;
      }

      if (presetIdSet.has(id)) {
        nextDeltas = upsertCustomBuildDelta(
          nextDeltas,
          localBuild,
          presetBuildIds.indexOf(id)
        );
      } else {
        nextDeltas = upsertCustomBuildDelta(
          nextDeltas,
          localBuild,
          customIndex
        );
        customIndex += 1;
      }
    }
  }

  for (const delta of state.deltas) {
    if (delta.kind !== "custom") continue;
    const charId = delta.value.characterId;
    if (payload.characterBuilds[charId]) continue;
    nextDeltas = upsertCustomBuildDelta(
      nextDeltas,
      delta.value,
      delta.displayIndex
    );
  }

  state.deltas = nextDeltas;

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
  state.deltas = state.deltas.filter((delta) => delta.kind === "custom");

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
      state.deltas = upsertCustomBuildDelta(state.deltas, build);
      state.validationErrors[id] = getBuildValidationErrors(build);
    }

    // Merge Character Mappings (using deduplication optionally, but import means replacing references usually)
    for (const [charId, ids] of Object.entries(v5.characterBuilds)) {
      state.characterToBuildIds[charId] = ids;
      state.deltas = setBuildDeltaOrderForCharacter(
        state.deltas,
        charId,
        ids,
        null
      );
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
        state.deltas = upsertCustomBuildDelta(
          state.deltas,
          buildWithCharacterId,
          buildIds.length
        );
        state.validationErrors[build.id] =
          getBuildValidationErrors(buildWithCharacterId);
        buildIds.push(build.id);
      }

      if (buildIds.length > 0) {
        state.characterToBuildIds[characterId] = buildIds;
        state.deltas = setBuildDeltaOrderForCharacter(
          state.deltas,
          characterId,
          buildIds,
          null
        );
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
