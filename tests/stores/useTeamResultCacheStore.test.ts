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
    ).toBe(5);
    window.localStorage.removeItem("team-result-cache");
  });

  it("preserves v5 results", () => {
    const resultsByTeamId = {
      "team-1": { investmentResult: { timestamp: 1 } },
    };
    const result = migrateTeamResultCacheStore({ resultsByTeamId }, 5);
    expect(result.resultsByTeamId).toBe(resultsByTeamId);
  });
});
