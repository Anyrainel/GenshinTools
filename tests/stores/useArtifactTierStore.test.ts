import { beforeEach, describe, expect, it } from "vitest";
import type { Tier } from "@/data/enums";
import type { TierAssignment } from "@/data/types";
import { useArtifactTierStore } from "@/stores/useArtifactTierStore";

beforeEach(() => {
  useArtifactTierStore.getState().resetTierList();
});

describe("useArtifactTierStore", () => {
  it("starts with empty tier list state", () => {
    const state = useArtifactTierStore.getState();

    expect(state.tierAssignments).toEqual({});
    expect(state.tierCustomization).toEqual({});
    expect(state.customTitle).toBe("");
    expect(state.author).toBe("");
    expect(state.description).toBe("");
  });

  it("stores artifact set assignments", () => {
    const assignments: TierAssignment = {
      noblesse_oblige: { tier: "S", position: 0 },
      emblem_of_severed_fate: { tier: "A", position: 0 },
    };

    useArtifactTierStore.getState().setTierAssignments(assignments);

    expect(useArtifactTierStore.getState().tierAssignments).toEqual(
      assignments
    );
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

    expect(state.tierAssignments.deepwood_memories).toEqual({
      tier: "S",
      position: 0,
    });
    expect(state.tierCustomization.S?.displayName).toBe("Universal Support");
    expect(state.customTitle).toBe("Artifact Sets");
    expect(state.author).toBe("Test Author");
    expect(state.description).toBe("Test Description");
  });
});
