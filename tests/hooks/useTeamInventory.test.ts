import type { ArtifactData, Slot } from "@/data/types";
import { useTeamInventory } from "@/hooks/useTeamInventory";
import { useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
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
  useFreezeStore.setState({ frozenTeams: {} });
  // Set up a basic account with some artifacts
  useAccountStore.setState((prev) => ({
    ...prev,
    accounts: {
      test: {
        id: "test",
        name: "Test",
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
});

describe("useTeamInventory", () => {
  it("returns all artifacts when nothing is frozen", () => {
    const { result } = renderHook(() => useTeamInventory("team1"));
    expect(result.current.allArtifacts).toHaveLength(5); // 2 equipped + 3 inventory
    expect(result.current.availableArtifacts).toHaveLength(5);
    expect(result.current.frozenArtifactIds.size).toBe(0);
  });

  it("excludes frozen artifacts from availableArtifacts", () => {
    act(() => {
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
});
