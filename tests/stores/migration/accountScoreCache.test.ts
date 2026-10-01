import { describe, expect, it } from "vitest";
import { migrateAccountScoreCacheStore } from "@/stores/migration/accountScoreCache";

describe("migrateAccountScoreCacheStore", () => {
  it("discards v1 scores computed with the old CR-budget semantics", () => {
    expect(
      migrateAccountScoreCacheStore(
        {
          scoresByProfileId: {
            "0": { odette: { normalized: { normalizedScore: 123 } } },
          },
          staleScoreCharIdsByProfileId: { "0": [] },
        },
        1
      )
    ).toEqual({
      scoresByProfileId: {},
      staleScoreCharIdsByProfileId: {},
    });
  });

  it("discards v2 scores carrying retired 7.1 beta weapon identities", () => {
    expect(
      migrateAccountScoreCacheStore(
        {
          scoresByProfileId: {
            "0": { qiqi: { normalized: { normalizedScore: 123 } } },
          },
          staleScoreCharIdsByProfileId: { "0": [] },
        },
        2
      )
    ).toEqual({ scoresByProfileId: {}, staleScoreCharIdsByProfileId: {} });
  });

  it("preserves current-version cache state", () => {
    const current = {
      scoresByProfileId: { "0": { odette: null } },
      staleScoreCharIdsByProfileId: { "0": ["odette"] },
    };

    expect(migrateAccountScoreCacheStore(current, 3)).toBe(current);
  });
});
