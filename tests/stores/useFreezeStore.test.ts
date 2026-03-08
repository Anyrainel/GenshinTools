import type { ArtifactData, Slot } from "@/data/types";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

const SLOTS: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];

function makeArtifactsByChar(
  charId: string,
  ids: string[]
): Record<string, Record<Slot, ArtifactData | null>> {
  const slotMap = Object.fromEntries(
    SLOTS.map((s, i) =>
      ids[i]
        ? [
            s,
            {
              id: ids[i],
              setKey: "test_set",
              slotKey: s,
              level: 20,
              rarity: 5,
              mainStatKey: "hp",
              lock: false,
              substats: {},
            } satisfies ArtifactData,
          ]
        : [s, null]
    )
  ) as Record<Slot, ArtifactData | null>;
  return { [charId]: slotMap };
}

beforeEach(() => {
  useFreezeStore.setState({ frozenTeams: {} });
});

describe("useFreezeStore", () => {
  describe("initial state", () => {
    it("starts with no frozen teams", () => {
      const state = useFreezeStore.getState();
      expect(state.frozenTeams).toEqual({});
    });
  });

  describe("freezeTeam", () => {
    it("freezes a team with artifact IDs and per-char data", () => {
      const ids = ["a1", "a2", "a3"];
      const byChar = makeArtifactsByChar("hu_tao", ids);
      act(() => {
        useFreezeStore.getState().freezeTeam("team1", ids, byChar);
      });
      const state = useFreezeStore.getState();
      expect(state.frozenTeams.team1).toBeDefined();
      expect(state.frozenTeams.team1.artifactIds).toEqual(ids);
      expect(state.frozenTeams.team1.artifactsByChar).toEqual(byChar);
    });

    it("overwrites a previously frozen team", () => {
      const ids1 = ["a1", "a2"];
      const ids2 = ["b1", "b2", "b3"];
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam("team1", ids1, makeArtifactsByChar("hu_tao", ids1));
      });
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam("team1", ids2, makeArtifactsByChar("hu_tao", ids2));
      });
      const state = useFreezeStore.getState();
      expect(state.frozenTeams.team1.artifactIds).toEqual(ids2);
    });

    it("can freeze multiple teams independently", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam("t1", ["a1"], makeArtifactsByChar("hu_tao", ["a1"]));
        useFreezeStore
          .getState()
          .freezeTeam("t2", ["b1"], makeArtifactsByChar("ganyu", ["b1"]));
      });
      const state = useFreezeStore.getState();
      expect(Object.keys(state.frozenTeams)).toHaveLength(2);
      expect(state.frozenTeams.t1.artifactIds).toEqual(["a1"]);
      expect(state.frozenTeams.t2.artifactIds).toEqual(["b1"]);
    });
  });

  describe("unfreezeTeam", () => {
    it("removes a frozen team", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam("team1", ["a1"], makeArtifactsByChar("hu_tao", ["a1"]));
      });
      act(() => {
        useFreezeStore.getState().unfreezeTeam("team1");
      });
      const state = useFreezeStore.getState();
      expect(state.frozenTeams.team1).toBeUndefined();
    });

    it("does not affect other frozen teams", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam("t1", ["a1"], makeArtifactsByChar("hu_tao", ["a1"]));
        useFreezeStore
          .getState()
          .freezeTeam("t2", ["b1"], makeArtifactsByChar("ganyu", ["b1"]));
      });
      act(() => {
        useFreezeStore.getState().unfreezeTeam("t1");
      });
      const state = useFreezeStore.getState();
      expect(state.frozenTeams.t1).toBeUndefined();
      expect(state.frozenTeams.t2).toBeDefined();
    });

    it("is a no-op for a non-existent team", () => {
      act(() => {
        useFreezeStore.getState().unfreezeTeam("nonexistent");
      });
      expect(useFreezeStore.getState().frozenTeams).toEqual({});
    });
  });

  describe("clearAll", () => {
    it("removes all frozen teams", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam("t1", ["a1"], makeArtifactsByChar("hu_tao", ["a1"]));
        useFreezeStore
          .getState()
          .freezeTeam("t2", ["b1"], makeArtifactsByChar("ganyu", ["b1"]));
      });
      act(() => {
        useFreezeStore.getState().clearAll();
      });
      expect(useFreezeStore.getState().frozenTeams).toEqual({});
    });
  });

  describe("isFrozen", () => {
    it("returns true for a frozen team", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam("team1", ["a1"], makeArtifactsByChar("hu_tao", ["a1"]));
      });
      expect(useFreezeStore.getState().isFrozen("team1")).toBe(true);
    });

    it("returns false for a non-frozen team", () => {
      expect(useFreezeStore.getState().isFrozen("team1")).toBe(false);
    });

    it("returns false after unfreezing", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam("team1", ["a1"], makeArtifactsByChar("hu_tao", ["a1"]));
      });
      act(() => {
        useFreezeStore.getState().unfreezeTeam("team1");
      });
      expect(useFreezeStore.getState().isFrozen("team1")).toBe(false);
    });
  });

  describe("getFrozenTeam", () => {
    it("returns the frozen team data", () => {
      const ids = ["a1", "a2"];
      const byChar = makeArtifactsByChar("hu_tao", ids);
      act(() => {
        useFreezeStore.getState().freezeTeam("team1", ids, byChar);
      });
      const frozen = useFreezeStore.getState().getFrozenTeam("team1");
      expect(frozen).toBeDefined();
      expect(frozen!.artifactIds).toEqual(ids);
      expect(frozen!.artifactsByChar).toEqual(byChar);
    });

    it("returns undefined for a non-frozen team", () => {
      expect(
        useFreezeStore.getState().getFrozenTeam("nonexistent")
      ).toBeUndefined();
    });
  });

  describe("getFrozenArtifactIds", () => {
    it("returns all artifact IDs across frozen teams", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam(
            "t1",
            ["a1", "a2"],
            makeArtifactsByChar("hu_tao", ["a1", "a2"])
          );
        useFreezeStore
          .getState()
          .freezeTeam(
            "t2",
            ["b1", "b2"],
            makeArtifactsByChar("ganyu", ["b1", "b2"])
          );
      });
      const ids = useFreezeStore.getState().getFrozenArtifactIds();
      expect(ids).toEqual(new Set(["a1", "a2", "b1", "b2"]));
    });

    it("excludes a specified team", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam(
            "t1",
            ["a1", "a2"],
            makeArtifactsByChar("hu_tao", ["a1", "a2"])
          );
        useFreezeStore
          .getState()
          .freezeTeam(
            "t2",
            ["b1", "b2"],
            makeArtifactsByChar("ganyu", ["b1", "b2"])
          );
      });
      const ids = useFreezeStore.getState().getFrozenArtifactIds("t1");
      expect(ids).toEqual(new Set(["b1", "b2"]));
    });

    it("returns empty set when no teams are frozen", () => {
      const ids = useFreezeStore.getState().getFrozenArtifactIds();
      expect(ids).toEqual(new Set());
    });

    it("returns empty set when all teams are excluded", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeTeam("t1", ["a1"], makeArtifactsByChar("hu_tao", ["a1"]));
      });
      const ids = useFreezeStore.getState().getFrozenArtifactIds("t1");
      expect(ids).toEqual(new Set());
    });
  });
});
