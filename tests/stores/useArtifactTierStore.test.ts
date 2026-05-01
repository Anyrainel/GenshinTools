import { beforeEach, describe, expect, it } from "vitest";
import type { Tier } from "@/data/enums";
import type { TierAssignment } from "@/data/types";
import {
  selectActiveTierAssignments,
  selectActiveTierAuthor,
  selectActiveTierCustomization,
  selectActiveTierDescription,
  selectActiveTierTitle,
} from "@/stores/createTierStore";
import { migrateGenericTierStore } from "@/stores/migration/tier";
import { useArtifactTierStore } from "@/stores/useArtifactTierStore";

beforeEach(() => {
  useArtifactTierStore.setState({
    tierLists: {
      1: {
        id: 1,
        tierAssignments: {},
        tierCustomization: {},
        customTitle: "",
        author: "",
        description: "",
      },
    },
    activeTierListId: 1,
    nextId: 2,
  });
});

describe("useArtifactTierStore", () => {
  it("starts with empty tier list state", () => {
    const state = useArtifactTierStore.getState();

    expect(selectActiveTierAssignments(state)).toEqual({});
    expect(selectActiveTierCustomization(state)).toEqual({});
    expect(selectActiveTierTitle(state)).toBe("");
    expect(selectActiveTierAuthor(state)).toBe("");
    expect(selectActiveTierDescription(state)).toBe("");
  });

  it("stores artifact set assignments", () => {
    const assignments: TierAssignment = {
      noblesse_oblige: { tier: "S", position: 0 },
      emblem_of_severed_fate: { tier: "A", position: 0 },
    };

    useArtifactTierStore.getState().setTierAssignments(assignments);

    expect(
      selectActiveTierAssignments(useArtifactTierStore.getState())
    ).toEqual(assignments);
  });

  it("loads imported tier list data", () => {
    useArtifactTierStore.getState().loadTierListData({
      tierAssignments: {
        deepwood_memories: { tier: "S" as Tier, position: 0 },
      },
      tierCustomization: {
        S: { displayName: "Universal Support", hidden: false },
      },
      customTitle: "Artifact Sets",
      author: "Test Author",
      description: "Test Description",
    });

    const state = useArtifactTierStore.getState();

    expect(selectActiveTierAssignments(state).deepwood_memories).toEqual({
      tier: "S",
      position: 0,
    });
    expect(selectActiveTierCustomization(state).S?.displayName).toBe(
      "Universal Support"
    );
    expect(selectActiveTierTitle(state)).toBe("Artifact Sets");
    expect(selectActiveTierAuthor(state)).toBe("Test Author");
    expect(selectActiveTierDescription(state)).toBe("Test Description");
  });

  it("keeps multiple artifact tier lists isolated", () => {
    useArtifactTierStore.getState().setTierAssignments({
      noblesse_oblige: { tier: "S", position: 0 },
    });
    useArtifactTierStore.getState().setCustomTitle("Support Sets");

    const secondId = useArtifactTierStore.getState().createTierList("DPS Sets");
    useArtifactTierStore.getState().setTierAssignments({
      marechaussee_hunter: { tier: "S", position: 0 },
    });

    expect(
      useArtifactTierStore.getState().tierLists[secondId].customTitle
    ).toBe("DPS Sets");

    useArtifactTierStore.getState().setActiveTierList(1);
    const state = useArtifactTierStore.getState();
    expect(selectActiveTierTitle(state)).toBe("Support Sets");
    expect(selectActiveTierAssignments(state)).toEqual({
      noblesse_oblige: { tier: "S", position: 0 },
    });
  });

  describe("migration v0 -> v1", () => {
    it("wraps old flat artifact tier data in the shared multi-list shape", () => {
      const oldState = {
        tierAssignments: {
          deepwood_memories: { tier: "S", position: 0 },
        },
        tierCustomization: {
          S: { displayName: "Universal", hidden: false },
        },
        customTitle: "Legacy Artifacts",
        author: "Author",
        description: "Description",
      };

      const result = migrateGenericTierStore(oldState, 0);

      expect(result).toEqual({
        tierLists: {
          1: {
            id: 1,
            tierAssignments: oldState.tierAssignments,
            tierCustomization: oldState.tierCustomization,
            customTitle: "Legacy Artifacts",
            author: "Author",
            description: "Description",
          },
        },
        activeTierListId: 1,
        nextId: 2,
      });
    });

    it("leaves current-version generic tier data untouched", () => {
      const currentState = {
        tierLists: {
          2: {
            id: 2,
            tierAssignments: {},
            tierCustomization: {},
            customTitle: "Current",
            author: "",
            description: "",
          },
        },
        activeTierListId: 2,
        nextId: 3,
      };

      expect(migrateGenericTierStore(currentState, 1)).toBe(currentState);
    });
  });
});
