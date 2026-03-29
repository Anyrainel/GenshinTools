import type { ArtifactData, Slot } from "@/data/types";
import { migrateFreezeStore, useFreezeStore } from "@/stores/useFreezeStore";
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
  useFreezeStore.setState({ frozenTeams: {}, reuseMode: "sameChar" });
});

describe("useFreezeStore", () => {
  describe("initial state", () => {
    it("starts with no frozen teams", () => {
      const state = useFreezeStore.getState();
      expect(state.frozenTeams).toEqual({});
    });
  });

  describe("freezeCharacters", () => {
    it("freezes characters with per-char data", () => {
      const byChar = makeArtifactsByChar("hu_tao", ["a1", "a2", "a3"]);
      act(() => {
        useFreezeStore.getState().freezeCharacters("team1", ["hu_tao"], byChar);
      });
      const state = useFreezeStore.getState();
      expect(state.frozenTeams.team1).toBeDefined();
      expect(state.frozenTeams.team1.frozenCharIds).toEqual(["hu_tao"]);
      expect(state.frozenTeams.team1.artifactsByChar).toEqual(byChar);
    });

    it("merges with existing frozen chars", () => {
      const byChar1 = makeArtifactsByChar("hu_tao", ["a1", "a2"]);
      const byChar2 = makeArtifactsByChar("xingqiu", ["b1", "b2"]);
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters("team1", ["hu_tao"], byChar1);
      });
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters("team1", ["xingqiu"], byChar2);
      });
      const state = useFreezeStore.getState();
      expect(state.frozenTeams.team1.frozenCharIds).toEqual([
        "hu_tao",
        "xingqiu",
      ]);
      expect(state.frozenTeams.team1.artifactsByChar.hu_tao).toBeDefined();
      expect(state.frozenTeams.team1.artifactsByChar.xingqiu).toBeDefined();
    });

    it("can freeze multiple teams independently", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters(
            "t1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1"])
          );
        useFreezeStore
          .getState()
          .freezeCharacters(
            "t2",
            ["ganyu"],
            makeArtifactsByChar("ganyu", ["b1"])
          );
      });
      const state = useFreezeStore.getState();
      expect(Object.keys(state.frozenTeams)).toHaveLength(2);
    });
  });

  describe("unfreezeCharacters", () => {
    it("removes specific characters", () => {
      const byChar = {
        ...makeArtifactsByChar("hu_tao", ["a1"]),
        ...makeArtifactsByChar("xingqiu", ["b1"]),
      };
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters("team1", ["hu_tao", "xingqiu"], byChar);
      });
      act(() => {
        useFreezeStore.getState().unfreezeCharacters("team1", ["hu_tao"]);
      });
      const state = useFreezeStore.getState();
      expect(state.frozenTeams.team1.frozenCharIds).toEqual(["xingqiu"]);
    });

    it("removes team entry when no chars remain", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters(
            "team1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1"])
          );
      });
      act(() => {
        useFreezeStore.getState().unfreezeCharacters("team1", ["hu_tao"]);
      });
      expect(useFreezeStore.getState().frozenTeams.team1).toBeUndefined();
    });
  });

  describe("unfreezeTeam", () => {
    it("removes a frozen team", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters(
            "team1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1"])
          );
      });
      act(() => {
        useFreezeStore.getState().unfreezeTeam("team1");
      });
      expect(useFreezeStore.getState().frozenTeams.team1).toBeUndefined();
    });

    it("does not affect other frozen teams", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters(
            "t1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1"])
          );
        useFreezeStore
          .getState()
          .freezeCharacters(
            "t2",
            ["ganyu"],
            makeArtifactsByChar("ganyu", ["b1"])
          );
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
          .freezeCharacters(
            "t1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1"])
          );
        useFreezeStore
          .getState()
          .freezeCharacters(
            "t2",
            ["ganyu"],
            makeArtifactsByChar("ganyu", ["b1"])
          );
      });
      act(() => {
        useFreezeStore.getState().clearAll();
      });
      expect(useFreezeStore.getState().frozenTeams).toEqual({});
    });
  });

  describe("isFrozen / isCharFrozen", () => {
    it("returns true for a team with frozen chars", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters(
            "team1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1"])
          );
      });
      expect(useFreezeStore.getState().isFrozen("team1")).toBe(true);
      expect(useFreezeStore.getState().isCharFrozen("team1", "hu_tao")).toBe(
        true
      );
      expect(useFreezeStore.getState().isCharFrozen("team1", "ganyu")).toBe(
        false
      );
    });

    it("returns false for a non-frozen team", () => {
      expect(useFreezeStore.getState().isFrozen("team1")).toBe(false);
    });

    it("returns false after unfreezing all chars", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters(
            "team1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1"])
          );
      });
      act(() => {
        useFreezeStore.getState().unfreezeTeam("team1");
      });
      expect(useFreezeStore.getState().isFrozen("team1")).toBe(false);
    });
  });

  describe("getFrozenCharIds", () => {
    it("returns frozen character IDs", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters("team1", ["hu_tao", "xingqiu"], {
            ...makeArtifactsByChar("hu_tao", ["a1"]),
            ...makeArtifactsByChar("xingqiu", ["b1"]),
          });
      });
      expect(useFreezeStore.getState().getFrozenCharIds("team1")).toEqual([
        "hu_tao",
        "xingqiu",
      ]);
    });

    it("returns empty array for non-frozen team", () => {
      expect(useFreezeStore.getState().getFrozenCharIds("team1")).toEqual([]);
    });
  });

  describe("getFrozenTeam", () => {
    it("returns the frozen team data", () => {
      const byChar = makeArtifactsByChar("hu_tao", ["a1", "a2"]);
      act(() => {
        useFreezeStore.getState().freezeCharacters("team1", ["hu_tao"], byChar);
      });
      const frozen = useFreezeStore.getState().getFrozenTeam("team1");
      expect(frozen).toBeDefined();
      expect(frozen!.frozenCharIds).toEqual(["hu_tao"]);
      expect(frozen!.artifactsByChar).toEqual(byChar);
    });

    it("returns undefined for a non-frozen team", () => {
      expect(
        useFreezeStore.getState().getFrozenTeam("nonexistent")
      ).toBeUndefined();
    });
  });

  describe("getFrozenArtifactIds", () => {
    it("returns artifact IDs only from frozen characters", () => {
      act(() => {
        useFreezeStore
          .getState()
          .freezeCharacters(
            "t1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1", "a2"])
          );
        useFreezeStore
          .getState()
          .freezeCharacters(
            "t2",
            ["ganyu"],
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
          .freezeCharacters(
            "t1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1", "a2"])
          );
        useFreezeStore
          .getState()
          .freezeCharacters(
            "t2",
            ["ganyu"],
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
          .freezeCharacters(
            "t1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["a1"])
          );
      });
      const ids = useFreezeStore.getState().getFrozenArtifactIds("t1");
      expect(ids).toEqual(new Set());
    });
  });

  describe("reuseMode", () => {
    it("defaults to sameChar", () => {
      expect(useFreezeStore.getState().reuseMode).toBe("sameChar");
    });

    it("can be changed between modes", () => {
      act(() => {
        useFreezeStore.getState().setReuseMode("none");
      });
      expect(useFreezeStore.getState().reuseMode).toBe("none");

      act(() => {
        useFreezeStore.getState().setReuseMode("forceReuse");
      });
      expect(useFreezeStore.getState().reuseMode).toBe("forceReuse");

      act(() => {
        useFreezeStore.getState().setReuseMode("sameChar");
      });
      expect(useFreezeStore.getState().reuseMode).toBe("sameChar");
    });
  });

  describe("migration v2 → v3", () => {
    it("migrates allowSameCharReuse: true to reuseMode: sameChar", () => {
      // Simulate v2 persisted state by directly setting store state
      useFreezeStore.setState({
        frozenTeams: {},
        reuseMode: "sameChar",
      } as ReturnType<typeof useFreezeStore.getState>);
      expect(useFreezeStore.getState().reuseMode).toBe("sameChar");
    });

    it("migrates allowSameCharReuse: false to reuseMode: none", () => {
      useFreezeStore.setState({
        frozenTeams: {},
        reuseMode: "none",
      } as ReturnType<typeof useFreezeStore.getState>);
      expect(useFreezeStore.getState().reuseMode).toBe("none");
    });
  });
});

describe("migrateFreezeStore", () => {
  it("migrates v3 → v4: adds frozenArtifactIds", () => {
    const oldState = {
      frozenTeams: {},
      reuseMode: "none",
    };
    const result = migrateFreezeStore(oldState, 3);
    expect(result.frozenArtifactIds).toEqual([]);
  });

  it("migrates v3 → v4: preserves existing frozenArtifactIds", () => {
    const oldState = {
      frozenTeams: {},
      reuseMode: "sameChar",
      frozenArtifactIds: ["art-1", "art-2"],
    };
    const result = migrateFreezeStore(oldState, 3);
    expect(result.frozenArtifactIds).toEqual(["art-1", "art-2"]);
  });

  it("migrates v2 → v4: allowSameCharReuse + frozenArtifactIds", () => {
    const oldState = {
      frozenTeams: {},
      allowSameCharReuse: false,
    };
    const result = migrateFreezeStore(oldState, 2);
    expect(result.reuseMode).toBe("none");
    expect(result.frozenArtifactIds).toEqual([]);
  });

  it("full migration from v0 applies all steps", () => {
    const oldState = {
      frozenTeams: {
        "team-1": {
          artifactsByChar: {
            hu_tao: {
              flower: {
                id: "a1",
                setKey: "test",
                slotKey: "flower",
                level: 20,
                rarity: 5,
                mainStatKey: "hp",
                lock: false,
                substats: {},
              },
              plume: null,
              sands: null,
              goblet: null,
              circlet: null,
            },
          },
        },
      },
    };
    const result = migrateFreezeStore(oldState, 0);
    // v0→v1: frozenCharIds derived from artifactsByChar keys
    expect(result.frozenTeams["team-1"].frozenCharIds).toEqual(["hu_tao"]);
    // v1→v2→v3: reuseMode defaults to sameChar
    expect(result.reuseMode).toBe("sameChar");
    // v3→v4: frozenArtifactIds added
    expect(result.frozenArtifactIds).toEqual([]);
  });
});
