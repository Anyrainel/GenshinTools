import { describe, expect, it } from "vitest";
import { migrateTeamResultCacheStore } from "@/stores/migration/teamResultCache";

describe("migrateTeamResultCacheStore", () => {
  it("clears pre-v2 results after formula entry units change", () => {
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

  it("preserves v2 results", () => {
    const resultsByTeamId = {
      "team-1": { investmentResult: { timestamp: 1 } },
    };
    const result = migrateTeamResultCacheStore({ resultsByTeamId }, 2);
    expect(result.resultsByTeamId).toBe(resultsByTeamId);
  });
});
