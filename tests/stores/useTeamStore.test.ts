import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamCompData } from "@/lib/team-comp/types";
import {
  mergeTeamStore,
  migrateTeamStore,
  stripTeamStoreResultCaches,
} from "@/stores/migration/team";
import type { LegacyPersistedTeam } from "@/stores/migration/teamLegacy";
import { useTeamResultCacheStore } from "@/stores/useTeamResultCacheStore";
import { useTeamStore } from "@/stores/useTeamStore";

beforeEach(() => {
  useTeamStore.getState().clearTeams();
  useTeamResultCacheStore.getState().clearAll();
});

function makeLegacyTeam(
  overrides: Partial<LegacyPersistedTeam> = {}
): LegacyPersistedTeam {
  return {
    id: "team-1",
    name: "Legacy",
    characters: ["hu_tao", "xingqiu", null, null],
    weapons: ["staff_of_homa", "sacrificial_sword", null, null],
    artifacts: [null, null, null, null],
    reactions: [],
    opts: {},
    calcContext: {},
    selectedFormula: null,
    formulaMode: "single",
    combo: null,
    ...overrides,
  };
}

describe("useTeamStore", () => {
  it("starts with split comp/config state only", () => {
    const state = useTeamStore.getState();
    expect(state.teamComps).toEqual([]);
    expect(state.compDeltas).toEqual([]);
    expect(state.configsByTeamId).toEqual({});
    expect(state.activePresetId).toBeNull();
    expect(state).not.toHaveProperty("teams");
    expect(state).not.toHaveProperty("updateTeam");
  });

  it("creates a custom team comp with default setup config", () => {
    const id = useTeamStore.getState().addTeam();
    const state = useTeamStore.getState();

    expect(state.teamComps).toEqual([
      { id, name: "", slots: [], reactions: [] },
    ]);
    expect(state.configsByTeamId[id]).toEqual({ combatOptions: {} });
    expect(state.compDeltas).toEqual([
      {
        kind: "custom",
        id,
        value: { id, name: "", slots: [], reactions: [] },
        displayIndex: 0,
      },
    ]);
  });

  it("accepts initial comp data and keeps setup config separate", () => {
    const id = useTeamStore.getState().addTeam({
      name: "Hu Tao Vape",
      characters: ["hu_tao", "xingqiu", null, null],
      weapons: ["staff_of_homa", "sacrificial_sword", null, null],
      setupConfig: {
        combatOptions: { hu_tao: "charged" },
        charConfigs: { hu_tao: { minEr: 1.2 } },
      },
    });

    const state = useTeamStore.getState();
    expect(state.teamComps[0]).toMatchObject({
      id,
      name: "Hu Tao Vape",
      slots: [
        { charId: "hu_tao", weaponId: "staff_of_homa" },
        { charId: "xingqiu", weaponId: "sacrificial_sword" },
      ],
    });
    expect(state.configsByTeamId[id]).toMatchObject({
      combatOptions: { hu_tao: "charged" },
      charConfigs: { hu_tao: { minEr: 1.2 } },
    });
  });

  it("updates comp and setup config through separate actions", () => {
    const id = useTeamStore.getState().addTeam({
      characters: ["hu_tao", null, null, null],
    });

    useTeamStore.getState().updateTeamComp(id, (comp) => ({
      ...comp,
      name: "Updated",
      slots: [
        {
          charId: "hu_tao",
          weaponId: "staff_of_homa",
          artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
        },
      ],
    }));
    useTeamStore.getState().updateTeamSetupConfig(id, {
      combatOptions: { hu_tao: "charged" },
      charConfigs: { hu_tao: { minEr: 1.4, minCr: 0.7 } },
    });

    const state = useTeamStore.getState();
    expect(state.teamComps[0].name).toBe("Updated");
    expect(state.teamComps[0].slots[0]).toMatchObject({
      charId: "hu_tao",
      weaponId: "staff_of_homa",
      artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
    });
    expect(state.configsByTeamId[id].charConfigs?.hu_tao).toEqual({
      minEr: 1.4,
      minCr: 0.7,
    });
  });

  it("copies, deletes, and reorders by comp id", async () => {
    const firstId = useTeamStore.getState().addTeam({ name: "A" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondId = useTeamStore.getState().addTeam({ name: "B" });

    useTeamStore.getState().moveTeam(secondId, "up");
    expect(useTeamStore.getState().teamComps.map((team) => team.name)).toEqual([
      "B",
      "A",
    ]);

    useTeamStore.getState().copyTeam(firstId);
    const copied = useTeamStore
      .getState()
      .teamComps.find((team) => team.id !== firstId && team.id !== secondId);
    expect(copied?.name).toBe("A");

    useTeamStore.getState().deleteTeam(secondId);
    expect(
      useTeamStore.getState().teamComps.map((team) => team.id)
    ).not.toContain(secondId);
  });

  it("subscribes and hydrates presets with semantic comp dedupe", () => {
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

    useTeamStore.getState().subscribePreset("preset-a", presetPayload);
    expect(useTeamStore.getState().teamComps[0].id).toBe("preset-team");
    expect(
      useTeamStore.getState().configsByTeamId["preset-team"]
    ).toMatchObject({ charConfigs: { hu_tao: { minEr: 1.3 } } });

    useTeamStore.getState().updateTeamComp("preset-team", { name: "Local" });
    expect(useTeamStore.getState().compDeltas[0]).toMatchObject({
      kind: "custom",
      id: "preset-team",
    });

    useTeamStore.getState().clearTeams();
    const duplicateId = useTeamStore.getState().addTeam({
      id: "custom-duplicate",
      name: "Preset Team",
      characters: ["hu_tao", null, null, null],
      weapons: ["staff_of_homa", null, null, null],
      setupConfig: {
        combatOptions: {},
        charConfigs: { hu_tao: { minEr: 1.5 } },
      },
    });
    useTeamStore.setState({ activePresetId: "preset-a" });
    useTeamStore.getState().hydratePreset("preset-a", presetPayload);

    const state = useTeamStore.getState();
    expect(state.teamComps.map((team) => team.id)).toEqual(["preset-team"]);
    expect(state.compDeltas).toEqual([]);
    expect(state.configsByTeamId["preset-team"].charConfigs).toEqual({
      hu_tao: { minEr: 1.5 },
    });
    expect(state.configsByTeamId[duplicateId]).toBeUndefined();
  });

  it("stores preset comp order only after the user reorders teams", () => {
    const presetPayload: TeamCompData = {
      teams: [
        {
          id: "preset-a",
          name: "A",
          characters: ["hu_tao", null, null, null],
          weapons: ["staff_of_homa", null, null, null],
          artifacts: [null, null, null, null],
        },
        {
          id: "preset-b",
          name: "B",
          characters: ["xingqiu", null, null, null],
          weapons: ["sacrificial_sword", null, null, null],
          artifacts: [null, null, null, null],
        },
      ],
    };
    useTeamStore.getState().subscribePreset("preset-a", presetPayload);

    expect(useTeamStore.getState().compDeltas).toEqual([]);

    useTeamStore.getState().moveTeam("preset-b", "up");

    expect(useTeamStore.getState().teamComps.map((team) => team.id)).toEqual([
      "preset-b",
      "preset-a",
    ]);
    expect(useTeamStore.getState().compDeltas).toEqual(
      expect.arrayContaining([
        { kind: "preset", id: "preset-b", displayIndex: 0 },
        { kind: "preset", id: "preset-a", displayIndex: 1 },
      ])
    );
  });

  it("exports the resolved comp view without setup config duplication", () => {
    useTeamStore.getState().addTeam({
      name: "Exported",
      characters: ["hu_tao", null, null, null],
      weapons: ["staff_of_homa", null, null, null],
    });

    const exported = useTeamStore.getState().exportTeams("me", "desc");
    expect(exported.author).toBe("me");
    expect(exported.description).toBe("desc");
    expect(exported.teams[0]).toMatchObject({
      name: "Exported",
      characters: ["hu_tao", null, null, null],
      weapons: ["staff_of_homa", null, null, null],
    });
    expect(exported.teams[0]).not.toHaveProperty("combatOptions");
  });
});

describe("team store migration", () => {
  it("migrates legacy flat teams into comp deltas and setup configs", () => {
    const result = migrateTeamStore(
      {
        teams: [
          makeLegacyTeam({
            id: "old-team",
            targetEr: { hu_tao: 1.3 },
            targetCr: { hu_tao: 0.7 },
            opts: {
              "hu_tao.overrideConstellation": "2",
              hu_tao: "charged",
            },
          } as unknown as Partial<LegacyPersistedTeam>),
        ],
        author: "",
        description: "",
      },
      0
    );

    expect(result).not.toHaveProperty("teams");
    expect(result.teamComps?.[0]).toMatchObject({
      id: "old-team",
      name: "Legacy",
      slots: [
        { charId: "hu_tao", weaponId: "staff_of_homa" },
        { charId: "xingqiu", weaponId: "sacrificial_sword" },
      ],
    });
    expect(result.configsByTeamId?.["old-team"]).toMatchObject({
      combatOptions: { hu_tao: "charged" },
      charConfigs: {
        hu_tao: {
          constellation: 2,
          minEr: 1.3,
          minCr: 0.7,
        },
      },
    });
  });

  it("fills missing data update time during migration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(234_567);
    try {
      const result = migrateTeamStore(
        {
          activePresetId: null,
          compDeltas: [],
          configsByTeamId: {},
        },
        17
      );

      expect(result.updatedAt).toBe(234_567);
    } finally {
      vi.useRealTimers();
    }
  });

  it("merge hydrates latest persisted data into the current runtime state", () => {
    const currentState = useTeamStore.getState();
    const result = mergeTeamStore(
      {
        compDeltas: [
          {
            kind: "custom",
            id: "team-1",
            value: {
              id: "team-1",
              name: "Current",
              slots: [{ charId: "hu_tao", weaponId: null, artifactSet: null }],
              reactions: [],
            },
          },
        ],
        configsByTeamId: {
          "team-1": { combatOptions: { hu_tao: "charged" } },
        },
        author: "tester",
        description: "desc",
      },
      currentState
    );

    expect(result).not.toHaveProperty("teams");
    expect(result.teamComps[0].id).toBe("team-1");
    expect(result.teamCompById["team-1"]).toBe(result.teamComps[0]);
    expect(result.configsByTeamId["team-1"]).toMatchObject({
      combatOptions: { hu_tao: "charged" },
    });
    expect(result.author).toBe("tester");
    expect(result.description).toBe("desc");
  });

  it("strips legacy result cache fields during migration preprocessing", () => {
    const team = makeLegacyTeam({
      choiceResults: {
        weapon: { timestamp: 1, perCharacter: {}, mode: "weapon" },
      },
      weaponChoiceResult: { timestamp: 1, perCharacter: {} },
      charSettings: { hu_tao: { minEr: 1.3 } },
    } as unknown as Partial<LegacyPersistedTeam>);

    const result = stripTeamStoreResultCaches({ teams: [team] });
    const stripped = result.teams?.[0] as unknown as Record<string, unknown>;

    expect(stripped.optimizationResult).toBeUndefined();
    expect(stripped.choiceResults).toBeUndefined();
    expect(stripped.weaponChoiceResult).toBeUndefined();
    expect(stripped.charSettings).toEqual({ hu_tao: { minEr: 1.3 } });
  });
});
