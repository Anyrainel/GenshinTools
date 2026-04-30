import { describe, expect, it } from "vitest";
import { migrateTeamResultCacheStore } from "@/stores/migration/teamResultCache";

describe("migrateTeamResultCacheStore", () => {
  it("moves old choice result buckets into current per-mode cache fields", () => {
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

    expect(result.resultsByTeamId).toEqual({
      "team-1": {
        weaponChoiceResult: {
          timestamp: 1,
          perCharacter: {},
          mode: "weapon",
        },
        artifactChoiceResult: {
          timestamp: 2,
          perCharacter: {},
          mode: "artifact",
        },
      },
    });
  });
});
