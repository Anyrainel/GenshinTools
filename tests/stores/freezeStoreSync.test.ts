import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
/**
 * Tests for freeze store ID remapping and validation — the safety net
 * that prevents frozen artifact references from becoming orphaned
 * after imports, merges, or scanner snapshots reassign artifact IDs.
 */
import type { AccountData, ArtifactData } from "@/data/types";
import {
  mergeAccountData,
  mergePartialAccountData,
} from "@/lib/account-data/import/mergeAccountData";
import { rebuildAccountFromSnapshot } from "@/lib/account-data/manager/storeSync";
import { useAccountStore } from "@/stores/useAccountStore";
import {
  collectAllArtifactIds,
  remapFreezeStoreForImport,
  useFreezeStore,
} from "@/stores/useFreezeStore";

function makeArt(
  id: string,
  slot: Slot = "flower",
  setKey = "GladiatorsFinale"
): ArtifactData {
  return {
    id,
    setKey,
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: {},
  };
}

function makeSlotMap(
  arts: Partial<Record<Slot, ArtifactData | null>>
): Record<Slot, ArtifactData | null> {
  const result = {} as Record<Slot, ArtifactData | null>;
  for (const slot of allSlots) {
    result[slot] = arts[slot] ?? null;
  }
  return result;
}

type FrozenTeamFixture = {
  frozenCharIds: string[];
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
};

function toArtifactIdsByChar(
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>
): Record<string, Partial<Record<Slot, string>>> {
  const idsByChar: Record<string, Partial<Record<Slot, string>>> = {};
  for (const [charId, artifacts] of Object.entries(artifactsByChar)) {
    const slotIds: Partial<Record<Slot, string>> = {};
    for (const slot of allSlots) {
      const artifact = artifacts[slot];
      if (artifact?.id) slotIds[slot] = artifact.id;
    }
    idsByChar[charId] = slotIds;
  }
  return idsByChar;
}

function setFrozenTeamsForTest(
  frozenTeams: Record<string, FrozenTeamFixture>,
  extraState: Partial<ReturnType<typeof useFreezeStore.getState>> = {}
) {
  useFreezeStore.setState({
    ...extraState,
    frozenTeamLoadouts: Object.fromEntries(
      Object.entries(frozenTeams).map(([teamId, team]) => [
        teamId,
        {
          frozenCharIds: team.frozenCharIds,
          artifactIdsByChar: toArtifactIdsByChar(team.artifactsByChar),
        },
      ])
    ),
    frozenTeams,
  });
}

function resetFreezeStore() {
  useFreezeStore.setState({
    frozenTeamLoadouts: {},
    frozenTeams: {},
    frozenArtifactIds: [],
    reuseMode: "sameChar",
    freezesByProfileId: {
      0: {
        frozenTeamLoadouts: {},
        frozenArtifactIds: [],
        reuseMode: "sameChar",
      },
    },
  });
}

describe("remapArtifactIds", () => {
  beforeEach(resetFreezeStore);
  afterEach(resetFreezeStore);

  it("remaps standalone frozen artifact IDs", () => {
    useFreezeStore.setState({
      frozenArtifactIds: ["artifact-0", "artifact-1", "artifact-2"],
    });

    const mapping = new Map([
      ["artifact-0", "artifact-10"],
      ["artifact-2", "artifact-12"],
    ]);
    useFreezeStore.getState().remapArtifactIds(mapping);

    expect(useFreezeStore.getState().frozenArtifactIds).toEqual([
      "artifact-10",
      "artifact-1",
      "artifact-12",
    ]);
  });

  it("removes standalone frozen IDs mapped to empty string (orphaned)", () => {
    useFreezeStore.setState({
      frozenArtifactIds: ["artifact-0", "artifact-1"],
    });

    const mapping = new Map([
      ["artifact-0", ""],
      ["artifact-1", "artifact-5"],
    ]);
    useFreezeStore.getState().remapArtifactIds(mapping);

    expect(useFreezeStore.getState().frozenArtifactIds).toEqual(["artifact-5"]);
  });

  it("remaps team frozen artifact IDs inside loadouts", () => {
    setFrozenTeamsForTest({
      team1: {
        frozenCharIds: ["charA"],
        artifactsByChar: {
          charA: makeSlotMap({
            flower: makeArt("artifact-0", "flower"),
            plume: makeArt("artifact-1", "plume"),
          }),
        },
      },
    });

    const mapping = new Map([
      ["artifact-0", "artifact-100"],
      ["artifact-1", "artifact-101"],
    ]);
    useFreezeStore.getState().remapArtifactIds(mapping);

    const team = useFreezeStore.getState().frozenTeamLoadouts.team1;
    expect(team.artifactIdsByChar.charA.flower).toBe("artifact-100");
    expect(team.artifactIdsByChar.charA.plume).toBe("artifact-101");
  });

  it("removes team artifacts mapped to empty string and cleans up empty chars", () => {
    setFrozenTeamsForTest({
      team1: {
        frozenCharIds: ["charA", "charB"],
        artifactsByChar: {
          charA: makeSlotMap({
            flower: makeArt("artifact-0", "flower"),
          }),
          charB: makeSlotMap({
            flower: makeArt("artifact-1", "flower"),
            plume: makeArt("artifact-2", "plume"),
          }),
        },
      },
    });

    // Orphan all of charA's artifacts, keep charB's
    const mapping = new Map([
      ["artifact-0", ""],
      ["artifact-1", "artifact-50"],
    ]);
    useFreezeStore.getState().remapArtifactIds(mapping);

    const team = useFreezeStore.getState().frozenTeamLoadouts.team1;
    // charA removed from frozenCharIds (all artifacts orphaned)
    expect(team.frozenCharIds).toEqual(["charB"]);
    // charB preserved
    expect(team.artifactIdsByChar.charB.flower).toBe("artifact-50");
    expect(team.artifactIdsByChar.charB.plume).toBe("artifact-2");
  });

  it("removes entire team entry when all characters lose all artifacts", () => {
    setFrozenTeamsForTest({
      team1: {
        frozenCharIds: ["charA"],
        artifactsByChar: {
          charA: makeSlotMap({
            flower: makeArt("artifact-0", "flower"),
          }),
        },
      },
    });

    const mapping = new Map([["artifact-0", ""]]);
    useFreezeStore.getState().remapArtifactIds(mapping);

    expect(useFreezeStore.getState().frozenTeamLoadouts).toEqual({});
  });

  it("no-ops when mapping is empty", () => {
    const initial = {
      frozenArtifactIds: ["artifact-0"],
      frozenTeamLoadouts: {
        team1: {
          frozenCharIds: ["charA"],
          artifactIdsByChar: { charA: { flower: "artifact-0" } },
        },
      },
    };
    useFreezeStore.setState(initial);

    const before = useFreezeStore.getState();
    useFreezeStore.getState().remapArtifactIds(new Map());
    const after = useFreezeStore.getState();

    // State reference unchanged (zustand optimization)
    expect(before).toBe(after);
  });

  it("preserves artifacts not in the mapping", () => {
    setFrozenTeamsForTest({
      team1: {
        frozenCharIds: ["charA"],
        artifactsByChar: {
          charA: makeSlotMap({
            flower: makeArt("artifact-0", "flower"),
            plume: makeArt("artifact-5", "plume"),
          }),
        },
      },
    });

    // Only remap artifact-0, artifact-5 not in mapping → preserved as-is
    const mapping = new Map([["artifact-0", "artifact-99"]]);
    useFreezeStore.getState().remapArtifactIds(mapping);

    const ids =
      useFreezeStore.getState().frozenTeamLoadouts.team1.artifactIdsByChar
        .charA;
    expect(ids.flower).toBe("artifact-99");
    expect(ids.plume).toBe("artifact-5");
  });
});

describe("validateFrozenArtifacts", () => {
  beforeEach(resetFreezeStore);
  afterEach(resetFreezeStore);

  it("removes standalone frozen IDs not in the valid set", () => {
    useFreezeStore.setState({
      frozenArtifactIds: ["artifact-0", "artifact-1", "artifact-2"],
    });

    const validIds = new Set(["artifact-0", "artifact-2"]);
    useFreezeStore.getState().validateFrozenArtifacts(validIds);

    expect(useFreezeStore.getState().frozenArtifactIds).toEqual([
      "artifact-0",
      "artifact-2",
    ]);
  });

  it("removes team artifacts with IDs not in the valid set", () => {
    setFrozenTeamsForTest({
      team1: {
        frozenCharIds: ["charA"],
        artifactsByChar: {
          charA: makeSlotMap({
            flower: makeArt("artifact-0", "flower"),
            plume: makeArt("artifact-1", "plume"),
            sands: makeArt("artifact-2", "sands"),
          }),
        },
      },
    });

    // Only artifact-0 and artifact-2 exist in account
    const validIds = new Set(["artifact-0", "artifact-2"]);
    useFreezeStore.getState().validateFrozenArtifacts(validIds);

    const ids =
      useFreezeStore.getState().frozenTeamLoadouts.team1.artifactIdsByChar
        .charA;
    expect(ids.flower).toBe("artifact-0");
    expect(ids.plume).toBeUndefined();
    expect(ids.sands).toBe("artifact-2");
  });

  it("removes characters with no remaining artifacts from frozenCharIds", () => {
    setFrozenTeamsForTest({
      team1: {
        frozenCharIds: ["charA", "charB"],
        artifactsByChar: {
          charA: makeSlotMap({
            flower: makeArt("artifact-0", "flower"),
          }),
          charB: makeSlotMap({
            flower: makeArt("artifact-1", "flower"),
          }),
        },
      },
    });

    // Only artifact-0 exists
    const validIds = new Set(["artifact-0"]);
    useFreezeStore.getState().validateFrozenArtifacts(validIds);

    const team = useFreezeStore.getState().frozenTeamLoadouts.team1;
    expect(team.frozenCharIds).toEqual(["charA"]);
  });

  it("removes entire team when all characters lose all artifacts", () => {
    setFrozenTeamsForTest({
      team1: {
        frozenCharIds: ["charA"],
        artifactsByChar: {
          charA: makeSlotMap({
            flower: makeArt("artifact-0", "flower"),
          }),
        },
      },
    });

    // No valid IDs
    useFreezeStore.getState().validateFrozenArtifacts(new Set());

    expect(useFreezeStore.getState().frozenTeamLoadouts).toEqual({});
  });

  it("no-ops when all IDs are valid", () => {
    setFrozenTeamsForTest(
      {
        team1: {
          frozenCharIds: ["charA"],
          artifactsByChar: {
            charA: makeSlotMap({
              flower: makeArt("artifact-0", "flower"),
            }),
          },
        },
      },
      { frozenArtifactIds: ["artifact-0"] }
    );

    useFreezeStore.getState().validateFrozenArtifacts(new Set(["artifact-0"]));
    const after = useFreezeStore.getState().frozenTeamLoadouts;

    expect(after).toEqual({
      team1: {
        frozenCharIds: ["charA"],
        artifactIdsByChar: { charA: { flower: "artifact-0" } },
      },
    });
  });
});

describe("collectAllArtifactIds", () => {
  it("collects IDs from characters and extra artifacts", () => {
    const data: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {
            flower: makeArt("artifact-0", "flower"),
            plume: makeArt("artifact-1", "plume"),
          },
        },
      ],
      extraArtifacts: [makeArt("artifact-2", "sands")],
      extraWeapons: [],
    };

    const ids = collectAllArtifactIds(data);
    expect(ids).toEqual(new Set(["artifact-0", "artifact-1", "artifact-2"]));
  });
});

describe("remapFreezeStoreForImport + auto-validation subscriber", () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: {},
      activeAccountId: 1,
    });
    resetFreezeStore();
  });
  afterEach(() => {
    resetFreezeStore();
    useAccountStore.setState({
      accounts: {},
      activeAccountId: null,
    });
  });

  it("remap before save + subscriber validate = correct end state", () => {
    // Setup: frozen artifact-0 and artifact-1
    useFreezeStore.setState({
      frozenArtifactIds: ["artifact-0", "artifact-1"],
    });

    // After import, artifact-0 became artifact-10, artifact-1 no longer exists
    const mapping = new Map([
      ["artifact-0", "artifact-10"],
      ["artifact-1", "artifact-99"], // mapped but doesn't exist in new data
    ]);

    const newAccountData: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: { flower: makeArt("artifact-10", "flower") },
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };

    // Step 1: remap BEFORE save (so remapped IDs match new data)
    remapFreezeStoreForImport(mapping);
    // Step 2: save triggers subscriber which validates
    useAccountStore.getState().addOrUpdateAccount(1, { data: newAccountData });
    useAccountStore.setState({ activeAccountId: 1 });
    // Trigger subscriber by re-saving (subscriber checks active account)
    useAccountStore.getState().addOrUpdateAccount(1, { data: newAccountData });

    // artifact-0 → artifact-10 (preserved, exists in account)
    // artifact-1 → artifact-99 (mapped but doesn't exist → removed by validate)
    expect(useFreezeStore.getState().frozenArtifactIds).toEqual([
      "artifact-10",
    ]);
  });

  it("subscriber auto-validates when artifact is deleted (no explicit sync)", () => {
    const data: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: { flower: makeArt("artifact-0", "flower") },
        },
      ],
      extraArtifacts: [makeArt("artifact-1", "sands")],
      extraWeapons: [],
    };

    // Set up account and freeze store
    useAccountStore.getState().addOrUpdateAccount(1, { data });
    useAccountStore.setState({ activeAccountId: 1 });
    useFreezeStore.setState({
      frozenArtifactIds: ["artifact-1"],
    });

    // Delete artifact-1 (simulates inventory delete — no explicit freeze sync)
    const updatedData: AccountData = {
      ...data,
      extraArtifacts: [], // artifact-1 removed
    };
    useAccountStore.getState().addOrUpdateAccount(1, { data: updatedData });

    // Subscriber should have auto-validated and removed the orphaned frozen ID
    expect(useFreezeStore.getState().frozenArtifactIds).toEqual([]);
  });

  it("subscriber auto-validates when character editor deletes equipped artifact", () => {
    const data: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {
            flower: makeArt("artifact-0", "flower"),
            plume: makeArt("artifact-1", "plume"),
          },
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };

    useAccountStore.getState().addOrUpdateAccount(1, { data });
    useAccountStore.setState({ activeAccountId: 1 });
    setFrozenTeamsForTest({
      team1: {
        frozenCharIds: ["Amber"],
        artifactsByChar: {
          Amber: makeSlotMap({
            flower: makeArt("artifact-0", "flower"),
            plume: makeArt("artifact-1", "plume"),
          }),
        },
      },
    });

    // Character editor deletes the plume (no explicit freeze sync)
    const editedData: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: { flower: makeArt("artifact-0", "flower") },
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };
    useAccountStore.getState().addOrUpdateAccount(1, { data: editedData });

    // Subscriber should have removed artifact-1 from frozen team
    const team = useFreezeStore.getState().frozenTeams.team1;
    expect(team).toBeDefined();
    expect(team.artifactsByChar.Amber.flower?.id).toBe("artifact-0");
    expect(team.artifactsByChar.Amber.plume).toBeNull();
  });
});

// ─── End-to-end: Import → ID reassignment → Freeze store update ─────────────

describe("end-to-end: import pipeline preserves freeze state", () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: {},
      activeAccountId: 1,
    });
    resetFreezeStore();
  });
  afterEach(() => {
    resetFreezeStore();
    useAccountStore.setState({
      accounts: {},
      activeAccountId: null,
    });
  });

  it("mergeAccountData + remap preserves frozen artifacts", () => {
    // Existing account data with artifacts
    const existing: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {
            flower: makeArt("artifact-0", "flower"),
            plume: makeArt("artifact-1", "plume"),
          },
        },
      ],
      extraArtifacts: [makeArt("artifact-2", "sands")],
      extraWeapons: [],
    };

    // Freeze artifact-0 (standalone) and artifact-1 (team)
    setFrozenTeamsForTest(
      {
        team1: {
          frozenCharIds: ["Amber"],
          artifactsByChar: {
            Amber: makeSlotMap({
              flower: makeArt("artifact-0", "flower"),
              plume: makeArt("artifact-1", "plume"),
            }),
          },
        },
      },
      { frozenArtifactIds: ["artifact-2"] }
    );

    // New import data (Enka-style: only characters on showcase)
    const incoming: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 2, // constellation changed
          talent: { auto: 10, skill: 10, burst: 10 },
          artifacts: {
            flower: makeArt("artifact-0", "flower"),
            plume: makeArt("artifact-1", "plume"),
          },
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };

    // Merge (like Enka import with existing data)
    const { data: merged, artifactIdMap } = mergeAccountData(
      { ...existing },
      incoming
    );

    // Remap before save, subscriber validates during save
    remapFreezeStoreForImport(artifactIdMap);
    useAccountStore.getState().addOrUpdateAccount(1, { data: merged });
    useAccountStore.setState({ activeAccountId: 1 });
    // Re-save to trigger subscriber with active account
    useAccountStore.getState().addOrUpdateAccount(1, { data: merged });

    // Verify frozen artifacts still exist (with potentially new IDs)
    const allIds = collectAllArtifactIds(merged);
    const frozenState = useFreezeStore.getState();

    // Standalone frozen should still reference a valid ID
    for (const id of frozenState.frozenArtifactIds) {
      expect(allIds.has(id)).toBe(true);
    }

    // Team frozen should still reference valid IDs
    const team = frozenState.frozenTeams.team1;
    expect(team).toBeDefined();
    expect(team.frozenCharIds).toContain("Amber");
    const amberArts = team.artifactsByChar.Amber;
    const teamArtIds = allSlots
      .map((s) => amberArts[s]?.id)
      .filter((id): id is string => id != null);
    for (const id of teamArtIds) {
      expect(allIds.has(id)).toBe(true);
    }
  });

  it("mergePartialAccountData + remap preserves frozen artifacts", () => {
    const existing: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {
            flower: makeArt("artifact-0", "flower"),
          },
        },
      ],
      extraArtifacts: [makeArt("artifact-1", "sands")],
      extraWeapons: [],
    };

    setFrozenTeamsForTest(
      {
        team1: {
          frozenCharIds: ["Amber"],
          artifactsByChar: {
            Amber: makeSlotMap({
              flower: makeArt("artifact-0", "flower"),
            }),
          },
        },
      },
      { frozenArtifactIds: ["artifact-1"] }
    );

    // Characters-only partial import
    const incoming: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 6,
          talent: { auto: 10, skill: 10, burst: 10 },
          artifacts: {},
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };

    const { data: merged, artifactIdMap } = mergePartialAccountData(
      existing,
      incoming,
      { characters: true, weapons: false, artifacts: false }
    );

    remapFreezeStoreForImport(artifactIdMap);
    useAccountStore.getState().addOrUpdateAccount(1, { data: merged });
    useAccountStore.setState({ activeAccountId: 1 });
    useAccountStore.getState().addOrUpdateAccount(1, { data: merged });

    const allIds = collectAllArtifactIds(merged);
    const frozenState = useFreezeStore.getState();

    // All frozen IDs should still be valid
    for (const id of frozenState.frozenArtifactIds) {
      expect(allIds.has(id)).toBe(true);
    }
    const team = frozenState.frozenTeams.team1;
    expect(team).toBeDefined();
  });

  it("rebuildAccountFromSnapshot clears all frozen state (full replacement)", () => {
    const existing: AccountData = {
      characters: [
        {
          key: "Amber",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {
            flower: makeArt("artifact-0", "flower"),
          },
        },
      ],
      extraArtifacts: [makeArt("artifact-1", "sands")],
      extraWeapons: [],
    };

    // Freeze some artifacts
    setFrozenTeamsForTest(
      {
        team1: {
          frozenCharIds: ["Amber"],
          artifactsByChar: {
            Amber: makeSlotMap({
              flower: makeArt("artifact-0", "flower"),
            }),
          },
        },
      },
      { frozenArtifactIds: ["artifact-1"] }
    );

    // Scanner snapshot replaces everything
    const { data: updated, artifactIdMap } = rebuildAccountFromSnapshot(
      existing,
      [
        {
          setKey: "GladiatorsFinale",
          slotKey: "flower",
          level: 20,
          rarity: 5,
          mainStatKey: "hp",
          lock: false,
          substats: [],
          location: "Amber",
        },
      ]
    );

    remapFreezeStoreForImport(artifactIdMap);
    useAccountStore.getState().addOrUpdateAccount(1, { data: updated });
    useAccountStore.setState({ activeAccountId: 1 });
    useAccountStore.getState().addOrUpdateAccount(1, { data: updated });

    const frozenState = useFreezeStore.getState();
    // All old frozen IDs should be gone (snapshot creates completely new IDs)
    expect(frozenState.frozenArtifactIds).toEqual([]);
    expect(frozenState.frozenTeams).toEqual({});
  });

  it("multiple teams: only affected team's artifacts get orphaned", () => {
    setFrozenTeamsForTest({
      team1: {
        frozenCharIds: ["charA"],
        artifactsByChar: {
          charA: makeSlotMap({
            flower: makeArt("artifact-0", "flower"),
          }),
        },
      },
      team2: {
        frozenCharIds: ["charB"],
        artifactsByChar: {
          charB: makeSlotMap({
            flower: makeArt("artifact-1", "flower"),
          }),
        },
      },
    });

    // After import, artifact-0 got reassigned but artifact-1 stayed
    const mapping = new Map([["artifact-0", "artifact-10"]]);

    const newData: AccountData = {
      characters: [
        {
          key: "charA",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: { flower: makeArt("artifact-10", "flower") },
        },
        {
          key: "charB",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: { flower: makeArt("artifact-1", "flower") },
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };

    remapFreezeStoreForImport(mapping);
    useAccountStore.getState().addOrUpdateAccount(1, { data: newData });
    useAccountStore.setState({ activeAccountId: 1 });
    useAccountStore.getState().addOrUpdateAccount(1, { data: newData });

    const frozenState = useFreezeStore.getState();
    // team1's artifact-0 was remapped to artifact-10
    expect(frozenState.frozenTeams.team1.artifactsByChar.charA.flower?.id).toBe(
      "artifact-10"
    );
    // team2's artifact-1 was untouched
    expect(frozenState.frozenTeams.team2.artifactsByChar.charB.flower?.id).toBe(
      "artifact-1"
    );
  });

  it("handles edge case: frozen ID coincidentally matches new ID from different artifact", () => {
    // Old freeze has artifact-0
    setFrozenTeamsForTest(
      {
        team1: {
          frozenCharIds: ["charA"],
          artifactsByChar: {
            charA: makeSlotMap({
              flower: makeArt("artifact-0", "flower", "CrimsonWitchOfFlames"),
            }),
          },
        },
      },
      { frozenArtifactIds: ["artifact-0"] }
    );

    // Full snapshot replacement: old artifact-0 mapped to "" (orphaned)
    // New data happens to also have artifact-0 but it's a DIFFERENT artifact
    const mapping = new Map([["artifact-0", ""]]);

    const newData: AccountData = {
      characters: [
        {
          key: "charA",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {
            flower: makeArt("artifact-0", "flower", "GladiatorsFinale"),
          },
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };

    remapFreezeStoreForImport(mapping);
    useAccountStore.getState().addOrUpdateAccount(1, { data: newData });
    useAccountStore.setState({ activeAccountId: 1 });
    useAccountStore.getState().addOrUpdateAccount(1, { data: newData });

    // Even though new data has artifact-0, the freeze should be cleared
    // because the mapping explicitly orphaned it
    const frozenState = useFreezeStore.getState();
    expect(frozenState.frozenArtifactIds).toEqual([]);
    expect(frozenState.frozenTeams).toEqual({});
  });
});
