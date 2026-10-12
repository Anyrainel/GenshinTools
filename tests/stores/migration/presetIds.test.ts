import { beforeEach, describe, expect, it } from "vitest";
import {
  BUILTIN_BUILD_PRESET_ID,
  BUILTIN_TEAM_PRESET_ID,
} from "@/config/presets/ids";
import { getDefaultBuildPresetId } from "@/domain/build/buildPresetRegistry";
import { DEFAULT_COMPUTE_OPTIONS } from "@/domain/build/computeFilters";
import { loadTeamPreset } from "@/domain/team/teamPresetRegistry";
import { buildsFromCloud } from "@/services/backup/adapters/buildsAdapter";
import { teamFromCloud } from "@/services/backup/adapters/teamAdapter";
import { loadBuildPreset } from "@/services/builds/loadBuildPreset";
import { migrateBundledPresetId } from "@/stores/migration/presetIds";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useTeamStore } from "@/stores/useTeamStore";

const oldBuildId =
  "/src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";
const oldTeamId =
  "/src/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json";

beforeEach(() => localStorage.clear());

describe("persisted bundled preset identities", () => {
  it("hydrates the published v9 builds selection and retains hidden builds and user metadata", async () => {
    const deltas = [{ kind: "preset", id: "FeFiQU8", deleted: true }];
    localStorage.setItem(
      "artifact-filter-builds",
      JSON.stringify({
        version: 9,
        state: {
          activePresetId: oldBuildId,
          deltas,
          hasPromptedForPreset: true,
          characterWeapons: {},
          computeOptions: DEFAULT_COMPUTE_OPTIONS,
          author: "Saved author",
          description: "Saved description",
          updatedAt: 1234,
        },
      })
    );
    await useBuildsStore.persist.rehydrate();
    expect(useBuildsStore.getState()).toMatchObject({
      activePresetId: BUILTIN_BUILD_PRESET_ID,
      deltas,
      author: "Saved author",
      updatedAt: 1234,
    });
    expect(getDefaultBuildPresetId()).toBe(BUILTIN_BUILD_PRESET_ID);
    const payload = await loadBuildPreset(BUILTIN_BUILD_PRESET_ID);
    expect(payload.builds.FeFiQU8).toBeDefined();
    expect(
      JSON.parse(localStorage.getItem("artifact-filter-builds")!).version
    ).toBe(10);
  });

  it.each([
    22, 23,
  ])("hydrates a v%s team selection through the public store boundary", async (version) => {
    localStorage.setItem(
      "team-builder-storage",
      JSON.stringify({
        version,
        state: {
          activePresetId: oldTeamId,
          compDeltas: [],
          configsByTeamId: {},
          author: "Saved team author",
          description: "Saved team description",
          updatedAt: 2345,
        },
      })
    );
    await useTeamStore.persist.rehydrate();
    expect(useTeamStore.getState()).toMatchObject({
      activePresetId: BUILTIN_TEAM_PRESET_ID,
      author: "Saved team author",
      updatedAt: 2345,
    });
    const preset = await loadTeamPreset(BUILTIN_TEAM_PRESET_ID);
    useTeamStore.getState().hydratePreset(BUILTIN_TEAM_PRESET_ID, preset);
    expect(useTeamStore.getState().teamComps.length).toBeGreaterThan(0);
  });

  it.each([
    1, 2, 3,
  ])("restores build cloud schema v%s with the same selection", (schemaVersion) => {
    expect(
      buildsFromCloud([
        {
          namespace: "builds",
          partitionKey: "all",
          schemaVersion,
          conflictPolicy: "explicit-choice",
          payload: { activePresetId: oldBuildId, deltas: [] },
        },
      ]).activePresetId
    ).toBe(BUILTIN_BUILD_PRESET_ID);
  });

  it.each([
    1, 2, 3, 4, 5,
  ])("restores team cloud schema v%s with the same selection", (schemaVersion) => {
    expect(
      teamFromCloud([
        {
          namespace: "teams",
          partitionKey: "all",
          schemaVersion,
          conflictPolicy: "explicit-choice",
          payload: {
            activePresetId: oldTeamId,
            compDeltas: [],
            configsByTeamId: {},
          },
        },
      ]).activePresetId
    ).toBe(BUILTIN_TEAM_PRESET_ID);
  });

  it.each([
    null,
    "user-import-123",
    BUILTIN_BUILD_PRESET_ID,
    BUILTIN_TEAM_PRESET_ID,
    "constructor",
    "__proto__",
  ])("preserves explicit/custom choice %s", (id) => {
    expect(migrateBundledPresetId(id)).toBe(id);
  });
});
