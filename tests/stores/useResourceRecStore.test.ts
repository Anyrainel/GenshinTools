import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import {
  DEFAULT_MIN_SCORE_DIFF,
  DEFAULT_TIER_THRESHOLDS,
} from "@/lib/account-data/resourceTips";
import { useAccountStore } from "@/stores/useAccountStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";

beforeEach(() => {
  useAccountStore.setState({
    accounts: {},
    activeAccountId: null,
    staleScoreCharIds: [],
  });
  useResourceRecStore.setState({
    thresholds: { ...DEFAULT_TIER_THRESHOLDS },
    minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
    panelOpen: false,
    showCraft: true,
    showReroll: true,
    showLevelup: true,
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
  it("stores recommendation controls per active account profile", () => {
    act(() => {
      useAccountStore.setState({ activeAccountId: 0 });
      useResourceRecStore.getState().setThreshold("S", 0.95);
      useResourceRecStore.getState().setMinScoreDiff("reroll", "A", 12);
      useResourceRecStore.getState().setShowCraft(false);
      useAccountStore.setState({ activeAccountId: 123456789 });
    });

    expect(useResourceRecStore.getState().thresholds.S).toBe(
      DEFAULT_TIER_THRESHOLDS.S
    );
    expect(useResourceRecStore.getState().showCraft).toBe(true);

    act(() => {
      useResourceRecStore.getState().setThreshold("S", 0.8);
      useResourceRecStore.getState().setShowLevelup(false);
      useAccountStore.setState({ activeAccountId: 0 });
    });

    const state = useResourceRecStore.getState();
    expect(state.thresholds.S).toBe(0.95);
    expect(state.minScoreDiff.reroll.A).toBe(12);
    expect(state.showCraft).toBe(false);
    expect(state.settingsByProfileId[123456789].thresholds.S).toBe(0.8);
    expect(state.settingsByProfileId[123456789].showLevelup).toBe(false);
  });
});
