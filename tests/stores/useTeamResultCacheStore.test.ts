import { describe, expect, it } from "vitest";
import { migrateTeamResultCacheStore } from "@/stores/migration/teamResultCache";
import { useTeamResultCacheStore } from "@/stores/useTeamResultCacheStore";

describe("migrateTeamResultCacheStore", () => {
  it("clears pre-v3 results after formula entry units or branches change", () => {
    const result = migrateTeamResultCacheStore(
      {
        resultsByTeamId: {
          "team-1": {
            choiceResults: {
              weapon: { timestamp: 1, perCharacter: {}, mode: "weapon" },
              artifact: { timestamp: 2, perCharacter: {}, mode: "artifact" },
            },
          },
        },
      },
      0
    );

    expect(result.resultsByTeamId).toEqual({});
  });

  it("clears v2 results after the Skirk shared-branch migration", () => {
    const result = migrateTeamResultCacheStore(
      { resultsByTeamId: { "team-1": { investmentResult: {} } } },
      2
    );
    expect(result.resultsByTeamId).toEqual({});
  });

  it("clears v3 results computed with beta 7.1 weapons or pre-release Vesna formulas", () => {
    const result = migrateTeamResultCacheStore(
      { resultsByTeamId: { "team-1": { investmentResult: { timestamp: 1 } } } },
      3
    );
    expect(result.resultsByTeamId).toEqual({});
  });

  it("invalidates v4 Vesna results through persisted-store hydration", async () => {
    window.localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 4,
        state: {
          resultsByTeamId: {
            "vesna-flagship": {
              optimizationResult: { timestamp: 100, totalDamage: 123456 },
              investmentResult: {
                timestamp: 100,
                bestAtTier: [],
                nodesByJin: [],
              },
              weaponChoiceResult: { timestamp: 100, perCharacter: {} },
              artifactChoiceResult: { timestamp: 100, perCharacter: {} },
            },
          },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    expect(useTeamResultCacheStore.getState().resultsByTeamId).toEqual({});
    expect(
      JSON.parse(window.localStorage.getItem("team-result-cache")!).version
    ).toBe(10);
    window.localStorage.removeItem("team-result-cache");
  });

  it("clears v5 results computed under separate analysis inputs", () => {
    const resultsByTeamId = {
      "team-1": { investmentResult: { timestamp: 1 } },
    };
    const result = migrateTeamResultCacheStore({ resultsByTeamId }, 5);
    expect(result.resultsByTeamId).toEqual({});
  });

  it("invalidates v6 investment assumptions through public hydration", async () => {
    localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 6,
        state: {
          resultsByTeamId: {
            team: {
              investmentResult: {
                timestamp: 1,
                bestAtTier: [],
                nodesByJin: [],
              },
              investmentInputKey: "old-relative-counts",
            },
          },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    expect(useTeamResultCacheStore.getState().resultsByTeamId).toEqual({});
    expect(JSON.parse(localStorage.getItem("team-result-cache")!).version).toBe(
      10
    );
    localStorage.removeItem("team-result-cache");
  });

  it("invalidates v8 impossible reaction buffs and Petra rankings through hydration", async () => {
    localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 8,
        state: {
          resultsByTeamId: {
            "no-geo": {
              artifactChoiceResult: {
                mode: "artifact",
                timestamp: 1,
                perCharacter: {
                  durin: [
                    {
                      type: "artifact",
                      artifactSet: { type: "4pc", setId: "archaic_petra" },
                      artifactSetIds: ["archaic_petra"],
                      damage: 135000,
                      percentOfBest: 100,
                    },
                  ],
                },
              },
              artifactChoiceInputKey: "same-inputs",
              weaponChoiceResult: { timestamp: 1, perCharacter: {} },
              investmentResult: {
                timestamp: 1,
                bestAtTier: [],
                nodesByJin: [],
              },
            },
          },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    expect(useTeamResultCacheStore.getState().resultsByTeamId).toEqual({});
    expect(JSON.parse(localStorage.getItem("team-result-cache")!).version).toBe(
      10
    );
    localStorage.removeItem("team-result-cache");
  });

  it("preserves current v10 results", () => {
    const resultsByTeamId = {
      "team-1": {
        weaponChoiceResult: { mode: "weapon", timestamp: 1, perCharacter: {} },
        weaponChoiceInputKey: "inputs",
      },
    };
    expect(
      migrateTeamResultCacheStore({ resultsByTeamId }, 10).resultsByTeamId
    ).toBe(resultsByTeamId);
  });

  it("invalidates v7 paid-Traveler and additive DEF results through hydration", async () => {
    localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 7,
        state: {
          resultsByTeamId: {
            team: {
              investmentResult: {
                timestamp: 1,
                bestAtTier: [],
                nodesByJin: [],
              },
              optimizationResult: { timestamp: 1, totalDamage: 123456 },
            },
          },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    expect(useTeamResultCacheStore.getState().resultsByTeamId).toEqual({});
    expect(JSON.parse(localStorage.getItem("team-result-cache")!).version).toBe(
      10
    );
    localStorage.removeItem("team-result-cache");
  });

  it("hydrates independent comparison signatures and clears both with their results", async () => {
    localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 10,
        state: {
          resultsByTeamId: {
            team: {
              weaponChoiceResult: {
                mode: "weapon",
                timestamp: 1,
                perCharacter: {},
                excludedChoices: {
                  xingqiu: [
                    {
                      type: "weapon",
                      weaponId: "primordial_jade_cutter",
                      refinement: 1,
                      failReasons: {
                        xingqiu: { kind: "er-unmet", minEr: 6, bestEr: 1 },
                      },
                    },
                  ],
                },
              },
              weaponChoiceInputKey: "weapons:C2:R3",
              artifactChoiceResult: {
                mode: "artifact",
                timestamp: 2,
                perCharacter: {},
              },
              artifactChoiceInputKey: "artifacts:C2:R3",
            },
          },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    expect(useTeamResultCacheStore.getState().getForTeam("team")).toMatchObject(
      {
        weaponChoiceInputKey: "weapons:C2:R3",
        artifactChoiceInputKey: "artifacts:C2:R3",
        weaponChoiceResult: {
          excludedChoices: {
            xingqiu: [
              { failReasons: { xingqiu: { kind: "er-unmet", minEr: 6 } } },
            ],
          },
        },
      }
    );
    useTeamResultCacheStore.getState().clearChoiceResults("team");
    expect(
      useTeamResultCacheStore.getState().getForTeam("team")
    ).toBeUndefined();
  });
  it("invalidates v9 damage rankings that may contain builds below their ER requirement", async () => {
    localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 9,
        state: {
          resultsByTeamId: {
            "xingqiu-er": {
              weaponChoiceResult: {
                mode: "weapon",
                timestamp: 1,
                perCharacter: {
                  xingqiu: [
                    {
                      type: "weapon",
                      weaponId: "primordial_jade_cutter",
                      refinement: 1,
                      damage: 100000,
                      percentOfBest: 100,
                      mainStats: {
                        sands: "atk%",
                        goblet: "hydro%",
                        circlet: "cd",
                      },
                    },
                  ],
                },
              },
              weaponChoiceInputKey: "same-inputs-min-er-230",
              artifactChoiceResult: {
                mode: "artifact",
                timestamp: 1,
                perCharacter: {},
              },
              artifactChoiceInputKey: "same-inputs-min-er-230",
              investmentResult: {
                timestamp: 1,
                bestAtTier: [],
                nodesByJin: [],
              },
              investmentInputKey: "same-inputs-min-er-230",
            },
          },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    expect(useTeamResultCacheStore.getState().resultsByTeamId).toEqual({});
    expect(JSON.parse(localStorage.getItem("team-result-cache")!).version).toBe(
      10
    );
    localStorage.removeItem("team-result-cache");
  });
});
