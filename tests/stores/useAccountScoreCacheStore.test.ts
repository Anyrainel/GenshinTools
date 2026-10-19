import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAccountScoreCacheStore } from "@/stores/useAccountScoreCacheStore";
import { createArtifactScoreResult } from "../fixtures";

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

  it.each([3, 4])(
    "discards v%s scores with old scoring semantics for every profile",
    async (version) => {
      const oldScore = createArtifactScoreResult({
        normalized: { normalizedScore: 195 },
      });
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version,
          state: {
            scoresByProfileId: {
              "0": { hu_tao: oldScore, barbara: null },
              "800000001": { xiangling: oldScore },
            },
            staleScoreCharIdsByProfileId: {
              "0": [],
              "800000001": ["xiangling"],
            },
          },
        })
      );
      await useAccountScoreCacheStore.persist.rehydrate();
      expect(useAccountScoreCacheStore.getState().getScores(0)).toEqual({});
      expect(useAccountScoreCacheStore.getState().getScores(800000001)).toEqual(
        {}
      );
      expect(
        JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).version
      ).toBe(5);
    }
  );
});
