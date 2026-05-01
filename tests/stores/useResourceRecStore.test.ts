import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import {
  DEFAULT_MIN_SCORE_DIFF,
  DEFAULT_TIER_THRESHOLDS,
} from "@/lib/account-data/resourceTips";
import { migrateResourceRecStore } from "@/stores/migration/resource";
import { useAccountStore } from "@/stores/useAccountStore";
import {
  getActiveResourceRecSettings,
  useResourceRecStore,
} from "@/stores/useResourceRecStore";

beforeEach(() => {
  useAccountStore.setState({
    accounts: {},
    activeAccountId: null,
  });
  useResourceRecStore.setState({
    settingsByProfileId: {
      [DEFAULT_ACCOUNT_PROFILE_ID]: {
        thresholds: { ...DEFAULT_TIER_THRESHOLDS },
        minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
        panelOpen: false,
        showCraft: true,
        showReroll: true,
        showLevelup: true,
      },
    },
  });
});

describe("useResourceRecStore", () => {
  it("migrates v5 flat minimum score diffs and removes obsolete fields", () => {
    const result = migrateResourceRecStore(
      {
        thresholds: { S: 0.9, A: 0.8 },
        minScoreDiff: { S: 1, A: 2, B: 3, C: 4, D: 5, Pool: 6 },
        kindMinScore: { old: true },
        panelOpen: true,
        showCraft: true,
        showReroll: false,
        showLevelup: true,
      },
      5
    );

    expect(result.settingsByProfileId).toEqual({
      [DEFAULT_ACCOUNT_PROFILE_ID]: {
        thresholds: { S: 0.9, A: 0.8 },
        minScoreDiff: {
          craft: { S: 1, A: 2, B: 3, C: 4, D: 5, Pool: 6 },
          reroll: { S: 6, A: 7, B: 8, C: 9, D: 10, Pool: 11 },
          levelup: { S: 1, A: 2, B: 3, C: 4, D: 5, Pool: 6 },
        },
        panelOpen: true,
        showCraft: true,
        showReroll: false,
        showLevelup: true,
      },
    });
    expect(result).not.toHaveProperty("thresholds");
    expect(result).not.toHaveProperty("minScoreDiff");
    expect(result.kindMinScore).toBeUndefined();
  });

  it("migrates v7 persisted active fields into profile settings only", () => {
    const result = migrateResourceRecStore(
      {
        thresholds: { S: 0.9 },
        minScoreDiff: {
          craft: { S: 1 },
          reroll: { A: 2 },
          levelup: { B: 3 },
        },
        panelOpen: true,
        showCraft: false,
        showReroll: true,
        showLevelup: false,
      },
      7
    );

    expect(result.settingsByProfileId).toEqual({
      [DEFAULT_ACCOUNT_PROFILE_ID]: {
        thresholds: { S: 0.9 },
        minScoreDiff: {
          craft: { S: 1 },
          reroll: { A: 2 },
          levelup: { B: 3 },
        },
        panelOpen: true,
        showCraft: false,
        showReroll: true,
        showLevelup: false,
      },
    });
    expect(result).not.toHaveProperty("thresholds");
    expect(result).not.toHaveProperty("minScoreDiff");
  });

  it("preserves current profile settings without reintroducing active fields", () => {
    const currentState = {
      settingsByProfileId: {
        123456789: {
          thresholds: { S: 0.8 },
          minScoreDiff: {
            craft: { S: 1 },
            reroll: { S: 2 },
            levelup: { S: 3 },
          },
          panelOpen: false,
          showCraft: true,
          showReroll: true,
          showLevelup: false,
        },
      },
    };

    const result = migrateResourceRecStore(currentState, 8);

    expect(result).toBe(currentState);
    expect(result).not.toHaveProperty("thresholds");
    expect(result).not.toHaveProperty("minScoreDiff");
  });

  it("stores recommendation controls per active account profile", () => {
    act(() => {
      useAccountStore.setState({ activeAccountId: 0 });
      useResourceRecStore.getState().setThreshold("S", 0.95);
      useResourceRecStore.getState().setMinScoreDiff("reroll", "A", 12);
      useResourceRecStore.getState().setShowCraft(false);
      useAccountStore.setState({ activeAccountId: 123456789 });
    });

    expect(getActiveResourceRecSettings().thresholds.S).toBe(
      DEFAULT_TIER_THRESHOLDS.S
    );
    expect(getActiveResourceRecSettings().showCraft).toBe(true);

    act(() => {
      useResourceRecStore.getState().setThreshold("S", 0.8);
      useResourceRecStore.getState().setShowLevelup(false);
      useAccountStore.setState({ activeAccountId: 0 });
    });

    const state = useResourceRecStore.getState();
    const activeSettings = getActiveResourceRecSettings();
    expect(activeSettings.thresholds.S).toBe(0.95);
    expect(activeSettings.minScoreDiff.reroll.A).toBe(12);
    expect(activeSettings.showCraft).toBe(false);
    expect(state).not.toHaveProperty("thresholds");
    expect(state).not.toHaveProperty("minScoreDiff");
    expect(state).not.toHaveProperty("panelOpen");
    expect(state).not.toHaveProperty("showCraft");
    expect(state).not.toHaveProperty("showReroll");
    expect(state).not.toHaveProperty("showLevelup");
    expect(state.settingsByProfileId[123456789].thresholds.S).toBe(0.8);
    expect(state.settingsByProfileId[123456789].showLevelup).toBe(false);
  });
});
