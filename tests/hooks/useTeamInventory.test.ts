import type { Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { useTeamInventory } from "@/hooks/useTeamInventory";
import { useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

const SLOTS: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];

function makeArt(id: string, slot: Slot = "flower"): ArtifactData {
  return {
    id,
    setKey: "test_set",
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: {},
  };
}

function makeArtifactsByChar(
  charId: string,
  ids: string[]
): Record<string, Record<Slot, ArtifactData | null>> {
  const slotMap = Object.fromEntries(
    SLOTS.map((s, i) => [s, ids[i] ? makeArt(ids[i], s) : null])
  ) as Record<Slot, ArtifactData | null>;
  return { [charId]: slotMap };
}

beforeEach(() => {
  useFreezeStore.setState({ frozenTeams: {}, reuseMode: "sameChar" });
  // Set up a basic account with some artifacts
  useAccountStore.setState((prev) => ({
    ...prev,
    accounts: {
      test: {
        id: "test",
        name: "Test",
        scores: {},
        lastUpdate: 0,
        data: {
          characters: [
            {
              key: "hu_tao",
              constellation: 0,
              level: 90,
              talent: { auto: 10, skill: 10, burst: 10 },
              artifacts: {
                flower: makeArt("eq1", "flower"),
                plume: makeArt("eq2", "plume"),
              },
            },
          ],
          extraArtifacts: [
            makeArt("inv1", "flower"),
            makeArt("inv2", "plume"),
            makeArt("inv3", "sands"),
          ],
          extraWeapons: [],
        },
      },
    },
    activeAccountId: "test",
  }));

  // Create teams in team store so the hook can look up character lists
  act(() => {
    const store = useTeamStore.getState();
    store.clearTeams();
  });
});

describe("useTeamInventory", () => {
  it("returns all artifacts when nothing is frozen", () => {
    act(() => {
      useTeamStore.getState().addTeam({ id: "team1" });
    });
    const { result } = renderHook(() => useTeamInventory("team1"));
    expect(result.current.allArtifacts).toHaveLength(5); // 2 equipped + 3 inventory
    expect(result.current.availableArtifacts).toHaveLength(5);
    expect(result.current.frozenArtifactIds.size).toBe(0);
  });

  it("excludes frozen artifacts from availableArtifacts", () => {
    act(() => {
      useTeamStore
        .getState()
        .addTeam({ id: "team1", characters: ["hu_tao", null, null, null] });
      useFreezeStore
        .getState()
        .freezeCharacters(
          "team1",
          ["hu_tao"],
          makeArtifactsByChar("hu_tao", ["eq1", "eq2"])
        );
    });
    const { result } = renderHook(() => useTeamInventory("team1"));
    // All artifacts still in allArtifacts
    expect(result.current.allArtifacts).toHaveLength(5);
    // eq1, eq2 are frozen — excluded from available
    expect(result.current.availableArtifacts).toHaveLength(3);
    expect(result.current.frozenArtifactIds).toEqual(new Set(["eq1", "eq2"]));
  });

  it("excludes frozen artifacts from OTHER teams too", () => {
    act(() => {
      useTeamStore.getState().addTeam({ id: "team1" });
      useFreezeStore
        .getState()
        .freezeCharacters(
          "otherTeam",
          ["ganyu"],
          makeArtifactsByChar("ganyu", ["inv1", "inv2"])
        );
    });
    const { result } = renderHook(() => useTeamInventory("team1"));
    // inv1, inv2 frozen in otherTeam — excluded from available
    expect(result.current.availableArtifacts).toHaveLength(3);
    expect(result.current.frozenArtifactIds).toEqual(new Set(["inv1", "inv2"]));
  });

  it("combines frozen artifacts from multiple teams", () => {
    act(() => {
      useTeamStore
        .getState()
        .addTeam({ id: "team1", characters: ["hu_tao", null, null, null] });
      useTeamStore.getState().addTeam({ id: "team2" });
      useFreezeStore
        .getState()
        .freezeCharacters(
          "team1",
          ["hu_tao"],
          makeArtifactsByChar("hu_tao", ["eq1"])
        );
      useFreezeStore
        .getState()
        .freezeCharacters(
          "team2",
          ["ganyu"],
          makeArtifactsByChar("ganyu", ["inv1"])
        );
    });
    const { result } = renderHook(() => useTeamInventory("team1"));
    // Both eq1 (team1) and inv1 (team2) are frozen
    expect(result.current.frozenArtifactIds).toEqual(new Set(["eq1", "inv1"]));
    expect(result.current.availableArtifacts).toHaveLength(3);
  });

  it("updates when freeze state changes", () => {
    act(() => {
      useTeamStore
        .getState()
        .addTeam({ id: "team1", characters: ["hu_tao", null, null, null] });
    });
    const { result } = renderHook(() => useTeamInventory("team1"));
    expect(result.current.availableArtifacts).toHaveLength(5);

    act(() => {
      useFreezeStore
        .getState()
        .freezeCharacters(
          "team1",
          ["hu_tao"],
          makeArtifactsByChar("hu_tao", ["eq1", "eq2"])
        );
    });
    expect(result.current.availableArtifacts).toHaveLength(3);

    act(() => {
      useFreezeStore.getState().unfreezeTeam("team1");
    });
    expect(result.current.availableArtifacts).toHaveLength(5);
    expect(result.current.frozenArtifactIds.size).toBe(0);
  });

  it("ignores unfrozen characters' stale artifact data", () => {
    // Freeze two chars, then unfreeze one — stale artifactsByChar entry should be ignored
    act(() => {
      useTeamStore.getState().addTeam({
        id: "team1",
        characters: ["hu_tao", "xingqiu", null, null],
      });
      useFreezeStore
        .getState()
        .freezeCharacters("team1", ["hu_tao", "xingqiu"], {
          ...makeArtifactsByChar("hu_tao", ["eq1"]),
          ...makeArtifactsByChar("xingqiu", ["inv1"]),
        });
    });
    act(() => {
      useFreezeStore.getState().unfreezeCharacters("team1", ["xingqiu"]);
    });
    const { result } = renderHook(() => useTeamInventory("team1"));
    // Only hu_tao's artifacts should be frozen; xingqiu's should be available
    expect(result.current.frozenArtifactIds).toEqual(new Set(["eq1"]));
    expect(result.current.availableArtifacts).toHaveLength(4);
  });

  it("returns empty arrays when no account data", () => {
    useAccountStore.setState((prev) => ({
      ...prev,
      activeAccountId: null,
    }));
    const { result } = renderHook(() => useTeamInventory("team1"));
    expect(result.current.allArtifacts).toEqual([]);
    expect(result.current.availableArtifacts).toEqual([]);
    expect(result.current.frozenArtifactIds.size).toBe(0);
  });

  describe("reuseMode", () => {
    it("returns per-char extras when same character is in current team", () => {
      // hu_tao frozen in otherTeam, hu_tao also in team1
      act(() => {
        useTeamStore
          .getState()
          .addTeam({ id: "team1", characters: ["hu_tao", null, null, null] });
        useFreezeStore
          .getState()
          .freezeCharacters(
            "otherTeam",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["eq1", "eq2"])
          );
      });
      const { result } = renderHook(() => useTeamInventory("team1"));
      // Frozen artifacts stay excluded from the shared pool
      expect(result.current.frozenArtifactIds).toEqual(new Set(["eq1", "eq2"]));
      expect(result.current.availableArtifacts).toHaveLength(3);
      // But they're available as per-character extras for hu_tao only
      expect(result.current.perCharExtraArtifacts.hu_tao).toHaveLength(2);
      expect(
        result.current.perCharExtraArtifacts.hu_tao.map((a) => a.id).sort()
      ).toEqual(["eq1", "eq2"]);
    });

    it("excludes frozen artifacts when reuseMode is none", () => {
      act(() => {
        useTeamStore
          .getState()
          .addTeam({ id: "team1", characters: ["hu_tao", null, null, null] });
        useFreezeStore.getState().setReuseMode("none");
        useFreezeStore
          .getState()
          .freezeCharacters(
            "otherTeam",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["eq1", "eq2"])
          );
      });
      const { result } = renderHook(() => useTeamInventory("team1"));
      // With reuseMode "none", hu_tao's frozen artifacts are excluded
      expect(result.current.frozenArtifactIds).toEqual(new Set(["eq1", "eq2"]));
      expect(result.current.availableArtifacts).toHaveLength(3);
    });

    it("does not affect same-team frozen artifacts", () => {
      // hu_tao frozen in team1 itself — always excluded regardless of setting
      act(() => {
        useTeamStore
          .getState()
          .addTeam({ id: "team1", characters: ["hu_tao", null, null, null] });
        useFreezeStore
          .getState()
          .freezeCharacters(
            "team1",
            ["hu_tao"],
            makeArtifactsByChar("hu_tao", ["eq1", "eq2"])
          );
      });
      const { result } = renderHook(() => useTeamInventory("team1"));
      // Same-team frozen artifacts are always excluded (they're locked for this team)
      expect(result.current.frozenArtifactIds).toEqual(new Set(["eq1", "eq2"]));
      expect(result.current.availableArtifacts).toHaveLength(3);
    });

    it("only provides extras for characters actually in the team", () => {
      // hu_tao and ganyu frozen in otherTeam, only hu_tao in team1
      act(() => {
        useTeamStore
          .getState()
          .addTeam({ id: "team1", characters: ["hu_tao", null, null, null] });
        useFreezeStore
          .getState()
          .freezeCharacters("otherTeam", ["hu_tao", "ganyu"], {
            ...makeArtifactsByChar("hu_tao", ["eq1"]),
            ...makeArtifactsByChar("ganyu", ["inv1"]),
          });
      });
      const { result } = renderHook(() => useTeamInventory("team1"));
      // Both are frozen in the shared pool
      expect(result.current.frozenArtifactIds).toEqual(
        new Set(["eq1", "inv1"])
      );
      expect(result.current.availableArtifacts).toHaveLength(3);
      // Only hu_tao gets extras (ganyu not in this team)
      expect(result.current.perCharExtraArtifacts.hu_tao).toHaveLength(1);
      expect(result.current.perCharExtraArtifacts.hu_tao[0].id).toBe("eq1");
      expect(result.current.perCharExtraArtifacts.ganyu).toBeUndefined();
    });
  });

  describe("forceReuse mode", () => {
    function makeArtSet(
      charId: string,
      idPrefix: string,
      setKey: string
    ): Record<string, Record<Slot, ArtifactData | null>> {
      const slotMap = Object.fromEntries(
        SLOTS.map((s) => [
          s,
          {
            id: `${idPrefix}_${s}`,
            setKey,
            slotKey: s,
            level: 20,
            rarity: 5,
            mainStatKey: "hp",
            lock: false,
            substats: {},
          } satisfies ArtifactData,
        ])
      ) as Record<Slot, ArtifactData | null>;
      return { [charId]: slotMap };
    }

    it("populates forceReuseChars when frozen char has matching 4pc config", () => {
      act(() => {
        useTeamStore.getState().addTeam({
          id: "team1",
          characters: ["hu_tao", null, null, null],
          artifacts: [{ type: "4pc", setId: "crimson_witch_of_flames" }],
        });
        useFreezeStore.getState().setReuseMode("forceReuse");
        useFreezeStore
          .getState()
          .freezeCharacters(
            "otherTeam",
            ["hu_tao"],
            makeArtSet("hu_tao", "fr", "crimson_witch_of_flames")
          );
      });
      const { result } = renderHook(() => useTeamInventory("team1"));
      expect(result.current.forceReuseChars.hu_tao).toBeDefined();
      expect(Object.keys(result.current.forceReuseChars)).toHaveLength(1);
    });

    it("does NOT force reuse when sets mismatch", () => {
      act(() => {
        useTeamStore.getState().addTeam({
          id: "team1",
          characters: ["hu_tao", null, null, null],
          artifacts: [{ type: "4pc", setId: "crimson_witch_of_flames" }],
        });
        useFreezeStore.getState().setReuseMode("forceReuse");
        useFreezeStore
          .getState()
          .freezeCharacters(
            "otherTeam",
            ["hu_tao"],
            makeArtSet("hu_tao", "fr", "gladiators_finale")
          );
      });
      const { result } = renderHook(() => useTeamInventory("team1"));
      expect(result.current.forceReuseChars.hu_tao).toBeUndefined();
      // But still has perCharExtraArtifacts
      expect(result.current.perCharExtraArtifacts.hu_tao).toBeDefined();
    });

    it("does NOT force reuse when goalConfig is null", () => {
      act(() => {
        useTeamStore.getState().addTeam({
          id: "team1",
          characters: ["hu_tao", null, null, null],
          artifacts: [null],
        });
        useFreezeStore.getState().setReuseMode("forceReuse");
        useFreezeStore
          .getState()
          .freezeCharacters(
            "otherTeam",
            ["hu_tao"],
            makeArtSet("hu_tao", "fr", "crimson_witch_of_flames")
          );
      });
      const { result } = renderHook(() => useTeamInventory("team1"));
      expect(result.current.forceReuseChars.hu_tao).toBeUndefined();
    });

    it("does NOT force reuse for same-team frozen chars", () => {
      act(() => {
        useTeamStore.getState().addTeam({
          id: "team1",
          characters: ["hu_tao", null, null, null],
          artifacts: [{ type: "4pc", setId: "crimson_witch_of_flames" }],
        });
        useFreezeStore.getState().setReuseMode("forceReuse");
        // Frozen in same team (team1)
        useFreezeStore
          .getState()
          .freezeCharacters(
            "team1",
            ["hu_tao"],
            makeArtSet("hu_tao", "fr", "crimson_witch_of_flames")
          );
      });
      const { result } = renderHook(() => useTeamInventory("team1"));
      // Same-team frozen chars stay fully locked, not force-reused
      expect(result.current.forceReuseChars.hu_tao).toBeUndefined();
    });

    it("returns empty forceReuseChars in sameChar mode", () => {
      act(() => {
        useTeamStore.getState().addTeam({
          id: "team1",
          characters: ["hu_tao", null, null, null],
          artifacts: [{ type: "4pc", setId: "crimson_witch_of_flames" }],
        });
        useFreezeStore.getState().setReuseMode("sameChar");
        useFreezeStore
          .getState()
          .freezeCharacters(
            "otherTeam",
            ["hu_tao"],
            makeArtSet("hu_tao", "fr", "crimson_witch_of_flames")
          );
      });
      const { result } = renderHook(() => useTeamInventory("team1"));
      expect(Object.keys(result.current.forceReuseChars)).toHaveLength(0);
    });
  });
});
