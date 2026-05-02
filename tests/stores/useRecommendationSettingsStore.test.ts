import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import { DEFAULT_RECOMMENDATION_SETTINGS } from "@/lib/account-data/recommendationSettings";
import { useAccountStore } from "@/stores/useAccountStore";
import {
  getActiveRecommendationSettings,
  selectActiveRecommendationSettings,
  useRecommendationSettingsStore,
} from "@/stores/useRecommendationSettingsStore";

beforeEach(() => {
  useAccountStore.setState({
    accounts: {},
    activeAccountId: null,
  });
  useRecommendationSettingsStore.setState({
    settingsByProfileId: {
      [DEFAULT_ACCOUNT_PROFILE_ID]: structuredClone(
        DEFAULT_RECOMMENDATION_SETTINGS
      ),
    },
  });
});

describe("useRecommendationSettingsStore", () => {
  it("stores recommendation settings per active account profile", () => {
    act(() => {
      useAccountStore.setState({ activeAccountId: 0 });
      useRecommendationSettingsStore
        .getState()
        .setAllowPoolArtifactSteals(false);
      useRecommendationSettingsStore
        .getState()
        .setTierLuckExpectation("S", "hopeful");
      useAccountStore.setState({ activeAccountId: 123456789 });
    });

    expect(getActiveRecommendationSettings()).toEqual(
      DEFAULT_RECOMMENDATION_SETTINGS
    );

    act(() => {
      useRecommendationSettingsStore
        .getState()
        .setTierLuckExpectation("A", "cautious");
      useAccountStore.setState({ activeAccountId: 0 });
    });

    const state = useRecommendationSettingsStore.getState();
    expect(getActiveRecommendationSettings().allowPoolArtifactSteals).toBe(
      false
    );
    expect(getActiveRecommendationSettings().luckExpectationByTier.S).toBe(
      "hopeful"
    );
    expect(state.settingsByProfileId[123456789].allowPoolArtifactSteals).toBe(
      true
    );
    expect(state.settingsByProfileId[123456789].luckExpectationByTier.A).toBe(
      "cautious"
    );
  });

  it("returns a stable default snapshot for profiles without stored settings", () => {
    act(() => {
      useAccountStore.setState({ activeAccountId: 123456789 });
    });

    const state = useRecommendationSettingsStore.getState();
    expect(state.settingsByProfileId[123456789]).toBeUndefined();
    expect(selectActiveRecommendationSettings(state)).toBe(
      selectActiveRecommendationSettings(state)
    );
    expect(getActiveRecommendationSettings()).toEqual(
      DEFAULT_RECOMMENDATION_SETTINGS
    );
  });

  it("can subscribe to active defaults without a render loop", () => {
    act(() => {
      useAccountStore.setState({ activeAccountId: 123456789 });
    });

    const { result, rerender } = renderHook(() =>
      useRecommendationSettingsStore(selectActiveRecommendationSettings)
    );
    const firstSettings = result.current;

    rerender();

    expect(result.current).toBe(firstSettings);
    expect(result.current).toEqual(DEFAULT_RECOMMENDATION_SETTINGS);
  });

  it("renames non-default profile settings for UID promotion", () => {
    act(() => {
      useAccountStore.setState({ activeAccountId: 0 });
      useRecommendationSettingsStore
        .getState()
        .setAllowPoolArtifactSteals(false);
      useRecommendationSettingsStore
        .getState()
        .renameProfileSettings(0, 800000001);
      useAccountStore.setState({ activeAccountId: 800000001 });
    });

    const state = useRecommendationSettingsStore.getState();
    expect(state.settingsByProfileId[0]).toBeUndefined();
    expect(state.settingsByProfileId[800000001].allowPoolArtifactSteals).toBe(
      false
    );
    expect(getActiveRecommendationSettings().allowPoolArtifactSteals).toBe(
      false
    );
  });
});
