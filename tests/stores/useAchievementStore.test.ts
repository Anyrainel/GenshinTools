import { beforeEach, describe, expect, it } from "vitest";
import { useAchievementStore } from "@/stores/useAchievementStore";

describe("useAchievementStore", () => {
  beforeEach(() => {
    useAchievementStore.getState().clearAll();
  });

  it("replaces and normalizes an account profile's earned IDs", () => {
    useAchievementStore
      .getState()
      .replaceEarnedIds(600000001, [30, 10, 30, -1, 20.5]);

    expect(
      useAchievementStore.getState().earnedIdsByProfileId[600000001]
    ).toEqual([10, 30]);
  });

  it("finishing a series step finishes its prefix", () => {
    useAchievementStore
      .getState()
      .setSeriesAchievementStatus(0, [101, 102, 103], 103, true);

    expect(useAchievementStore.getState().earnedIdsByProfileId[0]).toEqual([
      101, 102, 103,
    ]);
  });

  it("unfinishing a series step unfinishes its suffix", () => {
    useAchievementStore.getState().replaceEarnedIds(0, [99, 101, 102, 103]);

    useAchievementStore
      .getState()
      .setSeriesAchievementStatus(0, [101, 102, 103], 102, false);

    expect(useAchievementStore.getState().earnedIdsByProfileId[0]).toEqual([
      99, 101,
    ]);
  });

  it("moves local completion status when an account profile is promoted", () => {
    useAchievementStore.getState().replaceEarnedIds(0, [101]);
    useAchievementStore.getState().renameProfile(0, 600000001);

    expect(useAchievementStore.getState().earnedIdsByProfileId).toEqual({
      600000001: [101],
    });
  });
});
