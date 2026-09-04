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

  it("preserves current-version cache state", () => {
    const current = {
      scoresByProfileId: { "0": { odette: null } },
      staleScoreCharIdsByProfileId: { "0": ["odette"] },
    };

    expect(migrateAccountScoreCacheStore(current, 2)).toBe(current);
  });
});
