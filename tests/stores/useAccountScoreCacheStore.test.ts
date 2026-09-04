import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAccountScoreCacheStore } from "@/stores/useAccountScoreCacheStore";

const STORAGE_KEY = "account-score-cache-storage";

describe("useAccountScoreCacheStore persistence", () => {
  beforeEach(() => {
    useAccountScoreCacheStore.setState({
      scoresByProfileId: {},
      staleScoreCharIdsByProfileId: {},
    });
    window.localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("invalidates realistic v1 derived scores during hydration", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          scoresByProfileId: {
            "0": {
              odette: {
                normalized: { normalizedScore: 123 },
                buildMatch: { build: { id: "old-cr-budget-build" } },
              },
            },
          },
          staleScoreCharIdsByProfileId: { "0": [] },
        },
      })
    );

    await useAccountScoreCacheStore.persist.rehydrate();

    expect(useAccountScoreCacheStore.getState().scoresByProfileId).toEqual({});
    expect(
      useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId
    ).toEqual({});
  });
});
