import { describe, expect, it } from "vitest";
import { migrateTeamResultCacheStore } from "@/stores/migration/teamResultCache";

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

  it("preserves v3 results", () => {
    const resultsByTeamId = {
      "team-1": { investmentResult: { timestamp: 1 } },
    };
    const result = migrateTeamResultCacheStore({ resultsByTeamId }, 3);
    expect(result.resultsByTeamId).toBe(resultsByTeamId);
  });
});
