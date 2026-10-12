import { beforeEach, describe, expect, it } from "vitest";
import { migrateSessionNavStorageValue } from "@/stores/migration/sessionNav";
import { DEFAULT_VIEW_SETTINGS } from "@/stores/schemas";
import { useSessionNavStore } from "@/stores/useSessionNavStore";

describe("migrateSessionNavStorageValue", () => {
  it("consolidates old flat selections without losing teams' calculation modes", () => {
    const result = migrateSessionNavStorageValue({
      state: {
        activeTeamId: "damage-team",
        activeInvestmentTeamId: "investment-team",
        activeWeaponChoiceTeamId: "weapon-team",
      },
    });

    expect(result.state?.viewSettings).toMatchObject({
      analysis: { activeTeamId: "damage-team" },
    });
    expect(result.state?.analysisModes).toEqual({
      "damage-team": "artifacts",
      "investment-team": "investment",
      "weapon-team": "builds",
    });
    expect(result.version).toBe(1);
    expect(result.state).not.toHaveProperty("activeTeamId");
    expect(result.state).not.toHaveProperty("activeInvestmentTeamId");
    expect(result.state).not.toHaveProperty("activeWeaponChoiceTeamId");
  });
});

describe("canonical analysis public session hydration", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useSessionNavStore.setState({
      viewSettings: { analysis: { ...DEFAULT_VIEW_SETTINGS } },
      analysisModes: {},
    });
  });
  it("hydrates former independently configured grids with deterministic damage precedence", async () => {
    sessionStorage.setItem(
      "session-nav-storage",
      JSON.stringify({
        version: 0,
        state: {
          viewSettings: {
            damage: {
              activeTeamId: "preset-raiden",
              ownedOnly: false,
              teamSort: "tier",
              erCalcExpanded: true,
            },
            investment: {
              activeTeamId: "custom-vape",
              ownedOnly: true,
              teamSort: "release",
            },
            weaponChoice: { activeTeamId: "preset-raiden", ownedOnly: true },
          },
        },
      })
    );
    await useSessionNavStore.persist.rehydrate();
    const state = useSessionNavStore.getState();
    expect(state.viewSettings).toEqual({
      analysis: {
        activeTeamId: "preset-raiden",
        ownedOnly: false,
        teamSort: "tier",
        erCalcExpanded: true,
      },
    });
    expect(state.analysisModes).toEqual({
      "preset-raiden": "artifacts",
      "custom-vape": "investment",
    });
  });
  it("heals missing optional fields and unknown modes without losing safe choices", async () => {
    sessionStorage.setItem(
      "session-nav-storage",
      JSON.stringify({
        version: 1,
        state: {
          viewSettings: {
            analysis: { activeTeamId: "custom-team", teamSort: "future-sort" },
          },
          analysisModes: {
            "custom-team": "characters",
            "another-team": "unknown-future-mode",
          },
        },
      })
    );
    await useSessionNavStore.persist.rehydrate();
    expect(useSessionNavStore.getState().viewSettings.analysis).toEqual({
      ...DEFAULT_VIEW_SETTINGS,
      activeTeamId: "custom-team",
    });
    expect(useSessionNavStore.getState().analysisModes).toEqual({
      "custom-team": "characters",
      "another-team": "artifacts",
    });
    useSessionNavStore.getState().setAnalysisMode("custom-team", "energy");
    const stored = JSON.parse(sessionStorage.getItem("session-nav-storage")!);
    expect(stored.version).toBe(1);
    expect(stored.state.analysisModes["custom-team"]).toBe("energy");
  });
});
