import { beforeEach, describe, expect, it } from "vitest";
import {
  applyCloudRestorePlan,
  buildCloudRestorePlan,
} from "@/cloud/storeAdapters";
import type {
  CloudConflictPolicy,
  CloudExportPartition,
  CloudNamespace,
  CloudPartitionKey,
} from "@/cloud/types";
import type { Build } from "@/data/types";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";

describe("cloud store adapters", () => {
  beforeEach(() => {
    useBuildsStore.getState().clearAll();
    useTeamStore.getState().clearTeams();
    useArtifactScoreStore.getState().resetConfig();
    useTierStore.setState({
      tierLists: {
        1: {
          id: 1,
          tierAssignments: {},
          tierCustomization: {},
          customTitle: "",
          author: "",
          description: "",
          linkedAccountId: null,
        },
      },
      activeTierListId: 1,
      nextId: 2,
    });
  });

  it("only includes restore sections for downloaded namespaces", () => {
    const plan = buildCloudRestorePlan([
      partition("builds", "all", {
        activePresetId: null,
        deltas: [],
        characterMetadata: { amber: { hidden: true } },
        artifactScore: { global: { cr: 1 } },
      }),
    ]);

    expect(plan).toMatchObject({
      builds: {
        activePresetId: null,
        deltas: [],
        hiddenCharacters: { amber: true },
      },
      artifactScore: { global: { cr: 1 } },
    });
    expect(plan.accounts).toBeUndefined();
    expect(plan.teams).toBeUndefined();
    expect(plan.characterTierLists).toBeUndefined();
  });

  it("applies restore sections through store APIs and refreshes derived state", () => {
    const build = customBuild();
    const result = applyCloudRestorePlan({
      builds: {
        activePresetId: null,
        deltas: [{ kind: "custom", id: build.id, value: build }],
        hiddenCharacters: {},
        characterWeapons: { amber: ["black_tassel"] },
        computeOptions: {},
        artifactScore: { global: { flatAtk: 2, flatHp: 30, flatDef: 30 } },
        author: "build author",
        description: "build description",
      },
      artifactScore: { global: { flatAtk: 2, flatHp: 30, flatDef: 30 } },
      teams: {
        activePresetId: null,
        compDeltas: [
          {
            kind: "custom",
            id: "team-1",
            value: {
              id: "team-1",
              name: "Cloud Team",
              slots: [{ charId: "amber" }],
            },
          },
        ],
        configsByTeamId: {},
        author: "team author",
        description: "team description",
      },
      characterTierLists: {
        activeTierListId: 3,
        nextId: 4,
        tierLists: {
          3: {
            id: 3,
            tierAssignments: { amber: { tier: "A", position: 0 } },
            tierCustomization: {},
            customTitle: "Cloud tiers",
            author: "",
            description: "",
            linkedAccountId: null,
          },
        },
      },
    });

    expect(result.appliedSections).toEqual([
      "builds",
      "artifactScore",
      "teams",
      "characterTierLists",
    ]);
    expect(useBuildsStore.getState().resolvedBuildGroups).toMatchObject([
      { characterId: "amber", weapons: ["black_tassel"] },
    ]);
    expect(useArtifactScoreStore.getState().config.global.flatAtk).toBe(2);
    expect(useTeamStore.getState().teamComps[0]).toMatchObject({
      id: "team-1",
      name: "Cloud Team",
    });
    expect(useTierStore.getState().tierLists[3].customTitle).toBe(
      "Cloud tiers"
    );
  });
});

function partition(
  namespace: CloudNamespace,
  partitionKey: CloudPartitionKey,
  payload: unknown,
  conflictPolicy: CloudConflictPolicy = "explicit-choice"
): CloudExportPartition {
  return {
    namespace,
    partitionKey,
    schemaVersion: 1,
    conflictPolicy,
    payload,
  };
}

function customBuild(): Build {
  return {
    id: "cloud-build",
    characterId: "amber",
    visible: true,
    name: "Cloud Build",
    composition: "4pc",
    artifactSet: "gladiators_finale",
    substats: [],
    sandsWeights: [],
    gobletWeights: [],
    circletWeights: [],
    normalizer: 0,
  };
}
