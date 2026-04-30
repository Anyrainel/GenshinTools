import { beforeEach, describe, expect, it } from "vitest";
import type { Team, TeamCompData } from "@/lib/team-comp/types";
import {
  mergeTeamStore,
  migrateTeamStore,
  stripTeamStoreResultCaches,
} from "@/stores/migration/team";
import { useTeamStore } from "@/stores/useTeamStore";

// Reset store before each test
beforeEach(() => {
  useTeamStore.getState().clearTeams();
});

describe("useTeamStore", () => {
  describe("initial state", () => {
    it("starts with empty teams array", () => {
      const state = useTeamStore.getState();
      expect(state.teams).toEqual([]);
      expect(state.compDeltas).toEqual([]);
      expect(state.configsByTeamId).toEqual({});
      expect(state.activePresetId).toBeNull();
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
      expect(state.compDeltas).toEqual([
        {
          kind: "custom",
          id,
          value: { id, name: "", slots: [], reactions: [] },
          displayIndex: 0,
        },
      ]);
      expect(state.configsByTeamId[id]).toEqual({ combatOptions: {} });
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
      const delta = useTeamStore.getState().compDeltas[0];
      expect(delta.kind).toBe("custom");
      if (delta.kind === "custom") {
        expect(delta.value.slots[0]).toMatchObject({
          charId: "hu_tao",
          weaponId: null,
          artifactSet: null,
        });
      }
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

    it("stores authored overrides in team config instead of comp", () => {
      const id = useTeamStore.getState().addTeam({
        characters: ["hu_tao", null, null, null],
      });

      useTeamStore.getState().updateTeam(id, {
        opts: {
          "hu_tao.overrideLevel": "80",
          "hu_tao.overrideConstellation": "2",
          "hu_tao.overrideTalentBurst": "9",
          hu_tao: "charged",
        },
        charSettings: {
          hu_tao: {
            minEr: 1.4,
            minCr: 0.7,
            fullSetOptional: true,
          },
        },
      });

      const state = useTeamStore.getState();
      expect(state.configsByTeamId[id]).toMatchObject({
        combatOptions: { hu_tao: "charged" },
        charConfigs: {
          hu_tao: {
            level: 80,
            constellation: 2,
            talentLevels: { burst: 9 },
            minEr: 1.4,
            minCr: 0.7,
            fullSetOptional: true,
          },
        },
      });
      const delta = state.compDeltas[0];
      expect(delta.kind).toBe("custom");
      if (delta.kind === "custom") {
        expect(delta.value).not.toHaveProperty("charConfigs");
      }
    });
  });

  describe("subscribePreset", () => {
    const presetPayload: TeamCompData = {
      teams: [
        {
          id: "preset-team",
          name: "Preset Team",
          characters: ["hu_tao", null, null, null],
          weapons: ["staff_of_homa", null, null, null],
          artifacts: [null, null, null, null],
          minEr: { hu_tao: 1.3 },
        },
      ],
      author: "preset",
      description: "test",
    };

    it("resolves preset teams without duplicating comp values in deltas", () => {
      useTeamStore.getState().subscribePreset("preset-a", presetPayload);

      const state = useTeamStore.getState();
      expect(state.activePresetId).toBe("preset-a");
      expect(state.compDeltas).toEqual([]);
      expect(state.teams[0].characters[0]).toBe("hu_tao");
      expect(state.configsByTeamId["preset-team"].charConfigs).toEqual({
        hu_tao: { minEr: 1.3 },
      });

      useTeamStore.getState().updateTeam("preset-team", { name: "Local Name" });
      const delta = useTeamStore.getState().compDeltas[0];
      expect(delta).toMatchObject({
        kind: "custom",
        id: "preset-team",
      });
      if (delta.kind === "custom") {
        expect(delta.value.name).toBe("Local Name");
      }
    });

    it("deduplicates matching custom comps on hydration and preserves config", () => {
      const firstId = useTeamStore.getState().addTeam({
        id: "custom-first",
        name: "Custom Team",
        characters: ["xingqiu", null, null, null],
      });
      const duplicateId = useTeamStore.getState().addTeam({
        id: "custom-duplicate",
        name: "Preset Team",
        characters: ["hu_tao", null, null, null],
        weapons: ["staff_of_homa", null, null, null],
      });
      useTeamStore.getState().updateTeam(duplicateId, {
        charSettings: { hu_tao: { minEr: 1.5 } },
      });

      useTeamStore.setState({ activePresetId: "preset-a" });
      useTeamStore.getState().hydratePreset("preset-a", presetPayload);

      const state = useTeamStore.getState();
      expect(state.teams.map((team) => team.id)).toEqual([
        firstId,
        "preset-team",
      ]);
      expect(state.compDeltas).toContainEqual({
        kind: "preset",
        id: "preset-team",
        displayIndex: 1,
      });
      expect(state.configsByTeamId["preset-team"].charConfigs).toEqual({
        hu_tao: { minEr: 1.5 },
      });
      expect(state.configsByTeamId[duplicateId]).toBeUndefined();
    });

    it("ignores preset hydration when there is no active preset", () => {
      const id = useTeamStore.getState().addTeam({
        id: "custom-team",
        name: "Custom Team",
      });

      useTeamStore.getState().hydratePreset("preset-a", presetPayload);

      const state = useTeamStore.getState();
      expect(state.activePresetId).toBeNull();
      expect(state.teams.map((team) => team.id)).toEqual([id]);
      expect(state.compDeltas[0]).toMatchObject({
        kind: "custom",
        id,
      });
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

    it("does not copy cached analysis results", async () => {
      const originalId = useTeamStore.getState().addTeam({
        name: "Cached",
        choiceResults: {
          weapon: { timestamp: 1, perCharacter: {}, mode: "weapon" },
        },
        weaponChoiceResult: { timestamp: 1, perCharacter: {} },
      });

      await new Promise((resolve) => setTimeout(resolve, 5));
      useTeamStore.getState().copyTeam(originalId);

      const copy = useTeamStore
        .getState()
        .teams.find((team) => team.id !== originalId);

      expect(copy?.optimizationResult).toBeNull();
      expect(copy?.choiceResults).toEqual({});
      expect(copy?.weaponChoiceResult).toBeNull();
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

  describe("moveTeamRelative", () => {
    it("moves team after an anchor", async () => {
      const idA = useTeamStore.getState().addTeam({ name: "A" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      useTeamStore.getState().addTeam({ name: "B" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const idC = useTeamStore.getState().addTeam({ name: "C" });

      // Move C after A → [A, C, B]
      useTeamStore.getState().moveTeamRelative(idC, idA, "after");

      const names = useTeamStore.getState().teams.map((t) => t.name);
      expect(names).toEqual(["A", "C", "B"]);
    });

    it("moves team before an anchor", async () => {
      useTeamStore.getState().addTeam({ name: "A" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const idB = useTeamStore.getState().addTeam({ name: "B" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const idC = useTeamStore.getState().addTeam({ name: "C" });

      // Move C before B → [A, C, B]
      useTeamStore.getState().moveTeamRelative(idC, idB, "before");

      const names = useTeamStore.getState().teams.map((t) => t.name);
      expect(names).toEqual(["A", "C", "B"]);
    });

    it("moves team before the first item", async () => {
      const idA = useTeamStore.getState().addTeam({ name: "A" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      useTeamStore.getState().addTeam({ name: "B" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const idC = useTeamStore.getState().addTeam({ name: "C" });

      // Move C before A → [C, A, B]
      useTeamStore.getState().moveTeamRelative(idC, idA, "before");

      const names = useTeamStore.getState().teams.map((t) => t.name);
      expect(names).toEqual(["C", "A", "B"]);
    });

    it("does nothing when id equals anchorId", () => {
      const idA = useTeamStore.getState().addTeam({ name: "A" });

      useTeamStore.getState().moveTeamRelative(idA, idA, "after");

      expect(useTeamStore.getState().teams.length).toBe(1);
      expect(useTeamStore.getState().teams[0].name).toBe("A");
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

    expect(team.combo).toBeNull();
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
    delete (state.teams[0] as Record<string, unknown>).minEr;
    const result = migrateTeamStore(state, 3);
    const team = result.teams[0] as Team;

    expect(team.charSettings).toEqual({ hu_tao: { minEr: 120, minCr: 70 } });
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

    // v5→v6 renames, then v7→v8 converts to stored format (altWeapon only), then v13 groups under analyzer
    expect(team.analyzer?.configs).toEqual([
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
    expect(team.analyzer?.configs).toEqual([
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
    expect(team.analyzer?.configs).toEqual([
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
    const line0 = team.combo!.lines[0];
    expect(line0.reaction).toEqual({
      reaction: "vaporize",
      rxnParts: { 1: "none" },
      rxnPartHits: { 0: 7 },
    });
    // xingqiu line should be unaffected (no override existed)
    const line1 = team.combo!.lines[1];
    expect(line1.reaction).toBeUndefined();
  });

  it("migrates v10 → v11: drops activeTeamId", () => {
    const state = {
      teams: [
        makeV0Team({
          reactions: [],
          combos: [],
          selectedCombo: null,
          formulaMode: "combo",
        }),
      ],
      activeTeamId: "team-123",
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 10);
    // activeTeamId is set to undefined (removed from persisted state)
    expect(
      (result as unknown as Record<string, unknown>).activeTeamId
    ).toBeUndefined();
    // Verify teams are untouched
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].id).toBe("team-1");
  });

  it("migrates v10 → v11: handles missing activeTeamId gracefully", () => {
    const state = {
      teams: [],
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 10);
    expect(
      (result as unknown as Record<string, unknown>).activeTeamId
    ).toBeUndefined();
  });

  it("migrates v11 → v12: analyzer env fields default to undefined (no-op)", () => {
    const state = {
      teams: [
        makeV0Team({
          reactions: [],
          combos: [],
          selectedCombo: null,
          formulaMode: "combo",
        }),
      ],
      author: "",
      description: "",
    };
    const result = migrateTeamStore(state, 11);
    const team = result.teams[0] as Team;

    // New optional analyzer sub-object defaults to undefined when no analyzer fields present
    expect(team.analyzer).toBeUndefined();
    // Existing data preserved
    expect(team.id).toBe("team-1");
  });

  describe("v13: combo flatten + charSettings merge + analyzer grouping", () => {
    it("flattens combos[] + selectedCombo → combo (selected)", () => {
      const combo1 = {
        id: "c1",
        label: { zh: "循环A", en: "Rotation A" },
        lines: [{ charId: "hu_tao", formulaId: "charged", count: 9 }],
      };
      const combo2 = {
        id: "c2",
        label: { zh: "循环B", en: "Rotation B" },
        lines: [],
      };
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [combo1, combo2],
            selectedCombo: "c2",
            formulaMode: "combo",
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      expect(team.combo).toEqual(combo2);
      expect(
        (team as unknown as Record<string, unknown>).combos
      ).toBeUndefined();
      expect(
        (team as unknown as Record<string, unknown>).selectedCombo
      ).toBeUndefined();
    });

    it("flattens combos[] + selectedCombo → combo (fallback to first)", () => {
      const combo1 = {
        id: "c1",
        label: { zh: "循环", en: "Rotation" },
        lines: [],
      };
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [combo1],
            selectedCombo: null,
            formulaMode: "combo",
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      expect(team.combo).toEqual(combo1);
    });

    it("flattens empty combos[] → combo: null", () => {
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [],
            selectedCombo: null,
            formulaMode: "combo",
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      expect(team.combo).toBeNull();
    });

    it("merges 5 parallel Records into charSettings", () => {
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [],
            selectedCombo: null,
            formulaMode: "combo",
            minEr: { hu_tao: 1.2, xingqiu: 2.0 },
            minCr: { hu_tao: 0.7 },
            crMode: { hu_tao: "target" },
            tierAwarePool: { xingqiu: true },
            ignoreArtifactSets: { hu_tao: true, xingqiu: false },
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      expect(team.charSettings).toEqual({
        hu_tao: {
          minEr: 1.2,
          minCr: 0.7,
          crMode: "target",
          fullSetOptional: true,
        },
        xingqiu: {
          minEr: 2.0,
          tierAwarePool: true,
          fullSetOptional: false,
        },
      });
      // Old fields removed
      expect(
        (team as unknown as Record<string, unknown>).minEr
      ).toBeUndefined();
      expect(
        (team as unknown as Record<string, unknown>).minCr
      ).toBeUndefined();
      expect(
        (team as unknown as Record<string, unknown>).crMode
      ).toBeUndefined();
      expect(
        (team as unknown as Record<string, unknown>).tierAwarePool
      ).toBeUndefined();
      expect(
        (team as unknown as Record<string, unknown>).ignoreArtifactSets
      ).toBeUndefined();
    });

    it("charSettings is undefined when all parallel Records are empty", () => {
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [],
            selectedCombo: null,
            formulaMode: "combo",
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      expect(team.charSettings).toBeUndefined();
    });

    it("groups analyzer* fields into analyzer sub-object", () => {
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [],
            selectedCombo: null,
            formulaMode: "combo",
            analyzerConfigs: [{ charId: "hu_tao", altWeapon: undefined }],
            analyzerComboOverrides: { "hu_tao|0|charged": 5 },
            analyzerMinErOverrides: { "hu_tao|0": 1.5 },
            analyzerReactionOverrides: {
              "hu_tao.charged": { reaction: "vaporize" },
            },
            analyzerEnemyAura: "Pyro",
            analyzerExtraBuffs: [{ id: "b1", target: "team", stats: [] }],
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      expect(team.analyzer).toEqual({
        configs: [{ charId: "hu_tao", altWeapon: undefined }],
        comboOverrides: { "hu_tao|0|charged": 5 },
        minErOverrides: { "hu_tao|0": 1.5 },
        reactionOverrides: { "hu_tao.charged": { reaction: "vaporize" } },
        enemyAura: "Pyro",
        extraBuffs: [{ id: "b1", target: "team", stats: [] }],
      });
      // Old flat fields removed
      expect(
        (team as unknown as Record<string, unknown>).analyzerConfigs
      ).toBeUndefined();
      expect(
        (team as unknown as Record<string, unknown>).analyzerEnemyAura
      ).toBeUndefined();
    });

    it("analyzer is undefined when no analyzer* fields present", () => {
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [],
            selectedCombo: null,
            formulaMode: "combo",
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      expect(team.analyzer).toBeUndefined();
    });

    it("CalcContext: fills rollMultiplier/substatBudget defaults, drops critRateTarget", () => {
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [],
            selectedCombo: null,
            formulaMode: "combo",
            calcContext: {
              enemyLevel: 90,
              enemyRes: 0.1,
              critRateTarget: 75,
            },
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      // CalcContext is now sparse — only user-customized fields are stored.
      // Migration strips critRateTarget but preserves other fields as-is.
      expect(team.calcContext).toEqual({
        enemyLevel: 90,
        enemyRes: 0.1,
      });
      expect(
        (team.calcContext as unknown as Record<string, unknown>).critRateTarget
      ).toBeUndefined();
    });

    it("CalcContext: preserves perCharCrTarget", () => {
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [],
            selectedCombo: null,
            formulaMode: "combo",
            calcContext: {
              enemyLevel: 110,
              enemyRes: 0.1,
              rollMultiplier: 0.9,
              substatBudget: "9_7",
              perCharCrTarget: { hu_tao: 70 },
            },
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      expect(team.calcContext.rollMultiplier).toBe(0.9);
      expect(team.calcContext.substatBudget).toBe("9_7");
      expect(team.calcContext.perCharCrTarget).toEqual({ hu_tao: 70 });
    });

    it("handles missing calcContext gracefully", () => {
      const state = {
        teams: [
          makeV0Team({
            reactions: [],
            combos: [],
            selectedCombo: null,
            formulaMode: "combo",
            calcContext: undefined,
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 12);
      const team = result.teams[0] as Team;

      // Missing calcContext → empty sparse object (defaults resolved at UI boundary)
      expect(team.calcContext).toEqual({});
    });
  });

  describe("v14: energyGrants widened to {flat, percent}", () => {
    it("converts legacy number grants → { flat: N }", () => {
      const state = {
        teams: [
          makeV0Team({
            erTimelines: [
              {
                actions: [
                  {
                    char: "raiden",
                    action: "grantEnergy",
                    energyGrants: { raiden: 20, xingqiu: 5 },
                  },
                  { char: "raiden", action: "Q" },
                ],
              },
            ],
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 13);
      const team = result.teams[0] as unknown as {
        erTimelines: Array<{
          actions: Array<{
            action: string;
            energyGrants?: Record<string, { flat?: number; percent?: number }>;
          }>;
        }>;
      };
      expect(team.erTimelines[0].actions[0].energyGrants).toEqual({
        raiden: { flat: 20 },
        xingqiu: { flat: 5 },
      });
    });

    it("strips legacy .orb field from intermediate dev shape", () => {
      const state = {
        teams: [
          makeV0Team({
            erTimelines: [
              {
                actions: [
                  {
                    char: "raiden",
                    action: "grantEnergy",
                    energyGrants: {
                      raiden: { flat: 10, percent: 50, orb: 3 },
                    },
                  },
                ],
              },
            ],
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 13);
      const team = result.teams[0] as unknown as {
        erTimelines: Array<{
          actions: Array<{
            energyGrants?: Record<string, Record<string, number>>;
          }>;
        }>;
      };
      const grant = team.erTimelines[0].actions[0].energyGrants?.raiden;
      expect(grant).toEqual({ flat: 10, percent: 50 });
      expect(grant && "orb" in grant).toBe(false);
    });

    it("drops zero-only grants entirely", () => {
      const state = {
        teams: [
          makeV0Team({
            erTimelines: [
              {
                actions: [
                  {
                    char: "raiden",
                    action: "grantEnergy",
                    energyGrants: { raiden: 0 },
                  },
                ],
              },
            ],
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 13);
      const team = result.teams[0] as unknown as {
        erTimelines: Array<{
          actions: Array<{ energyGrants?: Record<string, unknown> }>;
        }>;
      };
      expect(team.erTimelines[0].actions[0].energyGrants).toEqual({});
    });

    it("leaves non-grantEnergy actions untouched", () => {
      const state = {
        teams: [
          makeV0Team({
            erTimelines: [
              {
                actions: [
                  { char: "raiden", action: "E" },
                  { char: "raiden", action: "Q" },
                ],
              },
            ],
          }),
        ],
        author: "",
        description: "",
      };
      const result = migrateTeamStore(state, 13);
      const team = result.teams[0] as unknown as {
        erTimelines: Array<{ actions: Array<{ action: string }> }>;
      };
      expect(team.erTimelines[0].actions).toEqual([
        { char: "raiden", action: "E" },
        { char: "raiden", action: "Q" },
      ]);
    });
  });

  it("drops v14 result caches from persisted team source data", () => {
    const weaponChoiceResult = {
      timestamp: 123,
      perCharacter: {
        hu_tao: [
          {
            type: "weapon" as const,
            weaponId: "staff_of_homa",
            refinement: 1,
            damage: 100,
            percentOfBest: 100,
          },
        ],
      },
    };
    const state = {
      teams: [makeV0Team({ weaponChoiceResult })],
      author: "",
      description: "",
    };

    const result = migrateTeamStore(state, 14);

    expect(
      (result.teams[0] as unknown as Record<string, unknown>).choiceResults
    ).toBeUndefined();
    expect(
      (result.teams[0] as unknown as Record<string, unknown>).weaponChoiceResult
    ).toBeNull();
  });

  it("drops v15 result caches from persisted team source data", () => {
    const state = {
      teams: [
        makeV0Team({
          optimizationResult: { artifacts: {}, damage: {}, erTargets: {} },
          choiceResults: {
            weapon: { timestamp: 1, perCharacter: {}, mode: "weapon" },
          },
          weaponChoiceResult: { timestamp: 1, perCharacter: {} },
        }),
      ],
      author: "",
      description: "",
    };

    const result = migrateTeamStore(state, 15);
    const team = result.teams[0] as unknown as Record<string, unknown>;

    expect(team.optimizationResult).toBeNull();
    expect(team.choiceResults).toBeUndefined();
    expect(team.weaponChoiceResult).toBeNull();
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
    // v1→v2→v13: combo flattened
    expect(team.combo).toBeNull();
    // v2→v3→v9: formulaMode always "combo"
    expect(team.formulaMode).toBe("combo");
    // v9: reactionOverrides removed
    expect(
      (team as unknown as Record<string, unknown>).reactionOverrides
    ).toBeUndefined();
    // v3→v4→v13: targetEr → minEr → charSettings
    expect(team.charSettings).toEqual({ ganyu: { minEr: 130 } });
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
    expect(team.combo).toBeNull();
    expect(team.formulaMode).toBe("single");
    expect(team.opts).toEqual({});
    expect(team.optimizationResult).toBeNull();
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
          combo: { id: "c1", label: { zh: "测试", en: "test" }, lines: [] },
          formulaMode: "combo" as const,
          charSettings: { ganyu: { minEr: 100, minCr: 60 } },
          opts: { someOpt: true },
          selectedFormula: null,
          optimizationResult: null,
          calcContext: {
            enemyLevel: 110,
            enemyRes: 0.1,
            rollMultiplier: 0.85,
            substatBudget: "8_6" as const,
          },
        },
      ],
      activeTeamId: "team-full",
      author: "tester",
      description: "desc",
    };

    const result = mergeTeamStore(persisted, defaultState);
    const team = result.teams[0];

    expect(team.reactions).toEqual(["melt"]);
    expect(team.combo).not.toBeNull();
    expect(team.combo!.id).toBe("c1");
    expect(team.formulaMode).toBe("combo");
    expect(team.charSettings).toEqual({ ganyu: { minEr: 100, minCr: 60 } });
    expect(result.author).toBe("tester");
  });

  it("drops persisted result caches while restoring runtime defaults", () => {
    const persisted = {
      teams: [
        {
          id: "team-cached",
          name: "Cached",
          characters: ["ganyu", null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          selectedFormula: null,
          optimizationResult: { stale: true },
          choiceResults: { weapon: { stale: true } },
          weaponChoiceResult: { stale: true },
        },
      ],
      author: "",
      description: "",
    };

    const result = mergeTeamStore(persisted, defaultState);
    const team = result.teams[0] as unknown as Record<string, unknown>;

    expect(team.optimizationResult).toBeNull();
    expect(team.choiceResults).toBeUndefined();
    expect(team.weaponChoiceResult).toBeNull();
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
          combo: null,
          formulaMode: "combo" as const,
          opts: {},
          selectedFormula: null,
          optimizationResult: null,
          calcContext: {
            enemyLevel: 110,
            enemyRes: 0.1,
            rollMultiplier: 0.85,
            substatBudget: "8_6" as const,
          },
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
    expect(result.teams[0].combo).toBeNull();
    // Second team: fields defaulted
    expect(result.teams[1].combo).toBeNull();
    expect(result.teams[1].reactions).toEqual([]);
    expect(result.teams[1].formulaMode).toBe("single");
    expect(result.teams[1].opts).toEqual({});
  });
});

describe("stripTeamStoreResultCaches", () => {
  it("removes cache fields without touching authored team fields", () => {
    const team = makeV0Team({
      choiceResults: {
        weapon: { timestamp: 1, perCharacter: {}, mode: "weapon" },
      },
      weaponChoiceResult: { timestamp: 1, perCharacter: {} },
      charSettings: { hu_tao: { minEr: 130 } },
    }) as unknown as Team;

    const result = stripTeamStoreResultCaches({ teams: [team] });
    const stripped = result.teams[0] as unknown as Record<string, unknown>;

    expect(stripped.optimizationResult).toBeUndefined();
    expect(stripped.choiceResults).toBeUndefined();
    expect(stripped.weaponChoiceResult).toBeUndefined();
    expect(stripped.charSettings).toEqual({ hu_tao: { minEr: 130 } });
  });
});
