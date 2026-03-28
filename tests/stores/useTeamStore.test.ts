import {
  mergeTeamStore,
  migrateTeamStore,
  useTeamStore,
} from "@/stores/useTeamStore";
import type { Team } from "@/stores/useTeamStore";
import { beforeEach, describe, expect, it } from "vitest";

// Reset store before each test
beforeEach(() => {
  useTeamStore.getState().clearTeams();
});

describe("useTeamStore", () => {
  describe("initial state", () => {
    it("starts with empty teams array", () => {
      const state = useTeamStore.getState();
      expect(state.teams).toEqual([]);
    });
  });

  describe("addTeam", () => {
    it("creates a new team with default structure", () => {
      const id = useTeamStore.getState().addTeam();

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(1);
      expect(state.teams[0].id).toBe(id);
      expect(state.teams[0].name).toBe("");
      expect(state.teams[0].characters).toEqual([null, null, null, null]);
      expect(state.teams[0].weapons).toEqual([null, null, null, null]);
      expect(state.teams[0].artifacts).toEqual([null, null, null, null]);
    });

    it("returns the generated team ID", () => {
      const id = useTeamStore.getState().addTeam();

      expect(id).toMatch(/^team-\d+$/);
    });

    it("accepts initial data override", () => {
      const id = useTeamStore.getState().addTeam({
        name: "My Team",
        characters: ["hu_tao", null, null, null],
      });

      const team = useTeamStore.getState().teams.find((t) => t.id === id);
      expect(team?.name).toBe("My Team");
      expect(team?.characters).toEqual(["hu_tao", null, null, null]);
      // Default slots should remain
      expect(team?.weapons).toEqual([null, null, null, null]);
    });

    it("generates unique IDs for rapid creates", async () => {
      const id1 = useTeamStore.getState().addTeam();
      // Small delay to ensure unique timestamp-based IDs
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id2 = useTeamStore.getState().addTeam();

      expect(id1).not.toBe(id2);
      expect(useTeamStore.getState().teams.length).toBe(2);
    });
  });

  describe("updateTeam", () => {
    it("updates team name", () => {
      const id = useTeamStore.getState().addTeam();

      useTeamStore.getState().updateTeam(id, { name: "Updated Name" });

      const team = useTeamStore.getState().teams.find((t) => t.id === id);
      expect(team?.name).toBe("Updated Name");
    });

    it("updates team characters", () => {
      const id = useTeamStore.getState().addTeam();

      useTeamStore.getState().updateTeam(id, {
        characters: ["hu_tao", "xingqiu", "zhongli", "yelan"],
      });

      const team = useTeamStore.getState().teams.find((t) => t.id === id);
      expect(team?.characters).toEqual([
        "hu_tao",
        "xingqiu",
        "zhongli",
        "yelan",
      ]);
    });

    it("preserves other properties when partially updating", () => {
      const id = useTeamStore.getState().addTeam({
        name: "Original Name",
        characters: ["hu_tao", null, null, null],
      });

      useTeamStore.getState().updateTeam(id, { name: "New Name" });

      const team = useTeamStore.getState().teams.find((t) => t.id === id);
      expect(team?.characters).toEqual(["hu_tao", null, null, null]);
    });

    it("does nothing if team ID not found", () => {
      useTeamStore.getState().addTeam({ name: "Existing" });

      useTeamStore.getState().updateTeam("nonexistent-id", {
        name: "Should Not Appear",
      });

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(1);
      expect(state.teams[0].name).toBe("Existing");
    });
  });

  describe("deleteTeam", () => {
    it("removes team from store", () => {
      const id = useTeamStore.getState().addTeam();

      useTeamStore.getState().deleteTeam(id);

      expect(useTeamStore.getState().teams.length).toBe(0);
    });

    it("only removes the specified team", async () => {
      const id1 = useTeamStore.getState().addTeam({ name: "Team 1" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id2 = useTeamStore.getState().addTeam({ name: "Team 2" });

      useTeamStore.getState().deleteTeam(id1);

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(1);
      expect(state.teams[0].id).toBe(id2);
      expect(state.teams[0].name).toBe("Team 2");
    });

    it("does nothing if team ID not found", () => {
      useTeamStore.getState().addTeam();

      useTeamStore.getState().deleteTeam("nonexistent-id");

      expect(useTeamStore.getState().teams.length).toBe(1);
    });
  });

  describe("copyTeam", () => {
    it("creates a copy with new ID", async () => {
      const originalId = useTeamStore.getState().addTeam({
        name: "Original",
        characters: ["hu_tao", "xingqiu", null, null],
      });

      // Delay to ensure unique timestamp-based ID
      await new Promise((resolve) => setTimeout(resolve, 5));
      useTeamStore.getState().copyTeam(originalId);

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(2);

      const copy = state.teams.find((t) => t.id !== originalId);
      expect(copy).toBeDefined();
      expect(copy?.id).not.toBe(originalId);
      expect(copy?.name).toBe("Original");
      expect(copy?.characters).toEqual(["hu_tao", "xingqiu", null, null]);
    });

    it("inserts copy immediately after original", async () => {
      const id1 = useTeamStore.getState().addTeam({ name: "Team 1" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id2 = useTeamStore.getState().addTeam({ name: "Team 2" });
      await new Promise((resolve) => setTimeout(resolve, 5));

      useTeamStore.getState().copyTeam(id1);

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(3);
      expect(state.teams[0].id).toBe(id1);
      expect(state.teams[1].name).toBe("Team 1"); // Copy
      expect(state.teams[2].id).toBe(id2);
    });

    it("does nothing if team ID not found", () => {
      useTeamStore.getState().addTeam();

      useTeamStore.getState().copyTeam("nonexistent-id");

      expect(useTeamStore.getState().teams.length).toBe(1);
    });
  });

  describe("moveTeam", () => {
    it("moves team up", async () => {
      useTeamStore.getState().addTeam({ name: "A" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id2 = useTeamStore.getState().addTeam({ name: "B" });

      useTeamStore.getState().moveTeam(id2, "up");

      const state = useTeamStore.getState();
      expect(state.teams[0].name).toBe("B");
      expect(state.teams[1].name).toBe("A");
    });

    it("moves team down", async () => {
      const id1 = useTeamStore.getState().addTeam({ name: "A" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      useTeamStore.getState().addTeam({ name: "B" });

      useTeamStore.getState().moveTeam(id1, "down");

      const state = useTeamStore.getState();
      expect(state.teams[0].name).toBe("B");
      expect(state.teams[1].name).toBe("A");
    });

    it("does nothing when moving first team up", () => {
      const id1 = useTeamStore.getState().addTeam({ name: "A" });

      useTeamStore.getState().moveTeam(id1, "up");

      expect(useTeamStore.getState().teams[0].name).toBe("A");
    });

    it("does nothing when moving last team down", async () => {
      useTeamStore.getState().addTeam({ name: "A" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id2 = useTeamStore.getState().addTeam({ name: "B" });

      useTeamStore.getState().moveTeam(id2, "down");

      expect(useTeamStore.getState().teams[1].name).toBe("B");
    });
  });

  describe("clearTeams", () => {
    it("removes all teams", async () => {
      useTeamStore.getState().addTeam();
      await new Promise((resolve) => setTimeout(resolve, 5));
      useTeamStore.getState().addTeam();

      useTeamStore.getState().clearTeams();

      expect(useTeamStore.getState().teams).toEqual([]);
    });
  });
});

// ─── Migration & Merge Tests ───

/** Minimal v0 team shape — only the fields that existed in the original format. */
function makeV0Team(overrides?: Record<string, unknown>) {
  return {
    id: "team-1",
    name: "Test",
    characters: ["hu_tao", "xingqiu", "zhongli", "yelan"],
    weapons: ["staff_of_homa", null, null, null],
    artifacts: [null, null, null, null],
    opts: {},
    minEr: {},
    selectedFormula: null,
    optimizationResult: null,
    ...overrides,
  };
}

describe("migrateTeamStore", () => {
  it("migrates v0 → current: adds reactions", () => {
    const state = {
      teams: [makeV0Team()],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 0);

    expect(result.teams[0].reactions).toEqual([]);
  });

  it("migrates v1 → current: adds combos, selectedCombo", () => {
    const state = {
      teams: [makeV0Team({ reactions: ["vaporize"] })],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 1);
    const team = result.teams[0] as Team;

    expect(team.combos).toEqual([]);
    expect(team.selectedCombo).toBeNull();
    // reactions should be preserved
    expect(team.reactions).toEqual(["vaporize"]);
    // v9 migration sets formulaMode to "combo"
    expect(team.formulaMode).toBe("combo");
  });

  it("migrates v2 → current: adds formulaMode (now always combo)", () => {
    const state = {
      teams: [
        makeV0Team({
          reactions: [],
          combos: [],
          reactionOverrides: {},
          selectedCombo: null,
        }),
      ],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 2);
    const team = result.teams[0] as Team;

    // v9 migration converts to "combo"
    expect(team.formulaMode).toBe("combo");
  });

  it("migrates v3 → current: renames targetEr/targetCr to minEr/minCr", () => {
    const state = {
      teams: [
        makeV0Team({
          reactions: [],
          combos: [],
          reactionOverrides: {},
          selectedCombo: null,
          formulaMode: "single",
          targetEr: { hu_tao: 120 },
          targetCr: { hu_tao: 70 },
        }),
      ],
      activeTeamId: null,
      author: "",
      description: "",
    };
    // Remove the default minEr so the legacy fields are picked up
    // biome-ignore lint/performance/noDelete: test cleanup
    delete (state.teams[0] as Record<string, unknown>).minEr;
    const result = migrateTeamStore(state, 3);
    const team = result.teams[0] as Team;

    expect(team.minEr).toEqual({ hu_tao: 120 });
    expect(team.minCr).toEqual({ hu_tao: 70 });
    // Legacy fields should be removed
    expect(
      (team as unknown as Record<string, unknown>).targetEr
    ).toBeUndefined();
    expect(
      (team as unknown as Record<string, unknown>).targetCr
    ).toBeUndefined();
  });

  it("migrates v5 → v6: renames investmentConfigs → analyzerConfigs", () => {
    const configs = [
      {
        charId: "hu_tao",
        rarity: 5,
        startConstellation: 0,
        startRefinement: 0,
        maxConstellation: 6,
        maxRefinement: 5,
      },
    ];
    const state = {
      teams: [
        makeV0Team({
          reactions: [],
          combos: [],
          reactionOverrides: {},
          selectedCombo: null,
          formulaMode: "single",
          extraBuffs: [],
          investmentConfigs: configs,
        }),
      ],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 5);
    const team = result.teams[0] as Team;

    // v5→v6 renames, then v7→v8 converts to stored format (altWeapon only)
    expect(team.analyzerConfigs).toEqual([
      {
        charId: "hu_tao",
        altWeapon: undefined,
        startConstellation: 0,
        startRefinement: 0,
        maxConstellation: 6,
        maxRefinement: 5,
      },
    ]);
    expect(
      (team as unknown as Record<string, unknown>).investmentConfigs
    ).toBeUndefined();
  });

  it("migrates v7 → current: converts analyzerConfigs to stored format (altWeapon only)", () => {
    const state = {
      teams: [
        makeV0Team({
          reactions: [],
          combos: [],
          reactionOverrides: {},
          selectedCombo: null,
          formulaMode: "single",
          extraBuffs: [],
          analyzerConfigs: [
            {
              charId: "hu_tao",
              rarity: 5,
              weapon4Star: { id: "dragons_bane", refinement: 5 },
              weapon5Star: { id: "staff_of_homa" },
              startConstellation: 1,
              startRefinement: 1,
              maxConstellation: 6,
              maxRefinement: 5,
            },
          ],
        }),
      ],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 7);
    const team = result.teams[0] as Team;

    // Roster weapon is "staff_of_homa" (from team.weapons[0]), so 5★ is roster → alt is the 4★
    expect(team.analyzerConfigs).toEqual([
      {
        charId: "hu_tao",
        altWeapon: { id: "dragons_bane", refinement: 5 },
        startConstellation: 1,
        startRefinement: 1,
        maxConstellation: 6,
        maxRefinement: 5,
      },
    ]);
  });

  it("migrates v7 → current: no alt weapon when only roster weapon exists", () => {
    const state = {
      teams: [
        makeV0Team({
          reactions: [],
          combos: [],
          reactionOverrides: {},
          selectedCombo: null,
          formulaMode: "single",
          extraBuffs: [],
          analyzerConfigs: [
            {
              charId: "hu_tao",
              rarity: 5,
              weapon4Star: undefined,
              weapon5Star: { id: "staff_of_homa" },
              startConstellation: 0,
              startRefinement: 1,
              maxConstellation: 6,
              maxRefinement: 5,
            },
          ],
        }),
      ],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 7);
    const team = result.teams[0] as Team;

    // weapon5Star matches roster → no alt
    expect(team.analyzerConfigs).toEqual([
      {
        charId: "hu_tao",
        altWeapon: undefined,
        startConstellation: 0,
        startRefinement: 1,
        maxConstellation: 6,
        maxRefinement: 5,
      },
    ]);
  });

  it("migrates v6 → current: renames idealSubstatBudget → substatBudget + enemyElementAura → enemyAura", () => {
    const state = {
      teams: [
        makeV0Team({
          reactions: [],
          combos: [],
          reactionOverrides: {},
          selectedCombo: null,
          formulaMode: "single",
          extraBuffs: [],
          analyzerConfigs: [],
          calcContext: {
            enemyLevel: 110,
            enemyRes: 0.1,
            idealSubstatBudget: "9_7",
          },
          enemyElementAura: "Pyro",
        }),
      ],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 6);
    const team = result.teams[0] as Team;

    expect(team.calcContext?.substatBudget).toBe("9_7");
    expect(
      (team.calcContext as unknown as Record<string, unknown>)
        .idealSubstatBudget
    ).toBeUndefined();
    expect(team.enemyAura).toBe("Pyro");
    expect(
      (team as unknown as Record<string, unknown>).enemyElementAura
    ).toBeUndefined();
  });

  it("migrates v8 → current: merges reactionOverrides into combo lines", () => {
    const state = {
      teams: [
        makeV0Team({
          reactions: [],
          combos: [
            {
              id: "combo-1",
              label: { zh: "循环", en: "Rotation" },
              lines: [
                {
                  charId: "hu_tao",
                  formulaId: "charged",
                  count: 9,
                  reaction: { reaction: "vaporize" },
                },
                {
                  charId: "xingqiu",
                  formulaId: "burst",
                  count: 3,
                  reaction: undefined,
                },
              ],
            },
          ],
          reactionOverrides: {
            "hu_tao.charged": {
              reaction: "vaporize",
              partReactions: { 1: "none" },
              partHits: { 0: 7 },
            },
          },
          selectedCombo: "combo-1",
          formulaMode: "single",
          extraBuffs: [],
        }),
      ],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 8);
    const team = result.teams[0] as Team;

    // formulaMode forced to "combo"
    expect(team.formulaMode).toBe("combo");
    // reactionOverrides removed
    expect(
      (team as unknown as Record<string, unknown>).reactionOverrides
    ).toBeUndefined();
    // combo lines should have merged per-part config
    const line0 = team.combos[0].lines[0];
    expect(line0.reaction).toEqual({
      reaction: "vaporize",
      partReactions: { 1: "none" },
      partHits: { 0: 7 },
    });
    // xingqiu line should be unaffected (no override existed)
    const line1 = team.combos[0].lines[1];
    expect(line1.reaction).toBeUndefined();
  });

  it("full migration from v0 applies all steps", () => {
    const state = {
      teams: [
        {
          id: "old-team",
          name: "Legacy",
          characters: ["ganyu", null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          opts: {},
          selectedFormula: null,
          optimizationResult: null,
          targetEr: { ganyu: 130 },
          targetCr: {},
        },
      ],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 0);
    const team = result.teams[0] as Team;

    // v0→v1: reactions
    expect(team.reactions).toEqual([]);
    // v1→v2: combos
    expect(team.combos).toEqual([]);
    expect(team.selectedCombo).toBeNull();
    // v2→v3→v9: formulaMode always "combo"
    expect(team.formulaMode).toBe("combo");
    // v9: reactionOverrides removed
    expect(
      (team as unknown as Record<string, unknown>).reactionOverrides
    ).toBeUndefined();
    // v3→v4: targetEr → minEr
    expect(team.minEr).toEqual({ ganyu: 130 });
    expect(team.minCr).toEqual({});
  });
});

describe("mergeTeamStore", () => {
  /** Simulate the current store default state (as if the store just initialized). */
  const defaultState = useTeamStore.getState();

  it("defaults missing array/object fields on persisted teams", () => {
    // Simulate persisted data from before combos/reactionOverrides/formulaMode were added
    const persisted = {
      teams: [
        {
          id: "team-old",
          name: "OldTeam",
          characters: ["hu_tao", "xingqiu", null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          selectedFormula: null,
          optimizationResult: null,
          // Missing: reactions, reactionOverrides, combos, selectedCombo,
          //          formulaMode, minEr, minCr, opts
        },
      ],
      activeTeamId: "team-old",
      author: "",
      description: "",
    };

    const result = mergeTeamStore(persisted, defaultState);
    const team = result.teams[0];

    expect(team.reactions).toEqual([]);
    expect(team.combos).toEqual([]);
    expect(team.selectedCombo).toBeNull();
    expect(team.formulaMode).toBe("combo");
    expect(team.minEr).toEqual({});
    expect(team.minCr).toEqual({});
    expect(team.opts).toEqual({});

    // team.combos.map() should not throw
    expect(() => team.combos.map((c) => c.id)).not.toThrow();
  });

  it("preserves existing fields when they are already set", () => {
    const persisted = {
      teams: [
        {
          id: "team-full",
          name: "Full",
          characters: ["ganyu", null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          reactions: ["melt"] as string[],
          combos: [{ id: "c1", label: { zh: "测试", en: "test" }, lines: [] }],
          selectedCombo: "c1",
          formulaMode: "combo" as const,
          minEr: { ganyu: 100 },
          minCr: { ganyu: 60 },
          opts: { someOpt: true },
          selectedFormula: null,
          optimizationResult: null,
        },
      ],
      activeTeamId: "team-full",
      author: "tester",
      description: "desc",
    };

    const result = mergeTeamStore(persisted, defaultState);
    const team = result.teams[0];

    expect(team.reactions).toEqual(["melt"]);
    expect(team.combos).toHaveLength(1);
    expect(team.combos[0].id).toBe("c1");
    expect(team.selectedCombo).toBe("c1");
    expect(team.formulaMode).toBe("combo");
    expect(team.minEr).toEqual({ ganyu: 100 });
    expect(result.author).toBe("tester");
  });

  it("handles empty teams array", () => {
    const persisted = {
      teams: [],
      activeTeamId: null,
      author: "",
      description: "",
    };
    const result = mergeTeamStore(persisted, defaultState);
    expect(result.teams).toEqual([]);
  });

  it("handles multiple teams with mixed field presence", () => {
    const persisted = {
      teams: [
        // Team with all fields
        {
          id: "t1",
          name: "Complete",
          characters: [null, null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          reactions: [],
          combos: [],
          selectedCombo: null,
          formulaMode: "combo" as const,
          minEr: {},
          minCr: {},
          opts: {},
          selectedFormula: null,
          optimizationResult: null,
        },
        // Team missing most fields (pre-migration data)
        {
          id: "t2",
          name: "Incomplete",
          characters: ["diluc", null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          selectedFormula: null,
          optimizationResult: null,
        },
      ],
      activeTeamId: null,
      author: "",
      description: "",
    };

    const result = mergeTeamStore(persisted, defaultState);

    // First team: fields preserved
    expect(result.teams[0].combos).toEqual([]);
    // Second team: fields defaulted
    expect(result.teams[1].combos).toEqual([]);
    expect(result.teams[1].reactions).toEqual([]);
    expect(result.teams[1].formulaMode).toBe("combo");
    expect(result.teams[1].opts).toEqual({});

    // Both should be safe to call .map() on combos
    expect(() => result.teams[0].combos.map((c) => c)).not.toThrow();
    expect(() => result.teams[1].combos.map((c) => c)).not.toThrow();
  });
});
