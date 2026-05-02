import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import { DEFAULT_SCORE_UP_SETTINGS } from "@/lib/account-data/scoreUpSettings";
import { useAccountStore } from "@/stores/useAccountStore";
import {
  getActiveScoreUpSettings,
  selectActiveScoreUpSettings,
  useScoreUpSettingsStore,
} from "@/stores/useScoreUpSettingsStore";

beforeEach(() => {
  useAccountStore.setState({
    accounts: {},
    activeAccountId: null,
  });
  useScoreUpSettingsStore.setState({
    settingsByProfileId: {
      [DEFAULT_ACCOUNT_PROFILE_ID]: structuredClone(DEFAULT_SCORE_UP_SETTINGS),
    },
  });
});

describe("useScoreUpSettingsStore", () => {
  it("stores score-up settings per active account profile", () => {
    act(() => {
      useAccountStore.setState({ activeAccountId: 0 });
      useScoreUpSettingsStore.getState().setAllowPoolArtifactSteals(false);
      useScoreUpSettingsStore.getState().setTierLuckExpectation("S", "hopeful");
      useAccountStore.setState({ activeAccountId: 123456789 });
    });

    expect(getActiveScoreUpSettings()).toEqual(DEFAULT_SCORE_UP_SETTINGS);

    act(() => {
      useScoreUpSettingsStore
        .getState()
        .setTierLuckExpectation("A", "cautious");
      useAccountStore.setState({ activeAccountId: 0 });
    });

    const state = useScoreUpSettingsStore.getState();
    expect(getActiveScoreUpSettings().allowPoolArtifactSteals).toBe(false);
    expect(getActiveScoreUpSettings().luckExpectationByTier.S).toBe("hopeful");
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

    const state = useScoreUpSettingsStore.getState();
    expect(state.settingsByProfileId[123456789]).toBeUndefined();
    expect(selectActiveScoreUpSettings(state)).toBe(
      selectActiveScoreUpSettings(state)
    );
    expect(getActiveScoreUpSettings()).toEqual(DEFAULT_SCORE_UP_SETTINGS);
  });

  it("can subscribe to active defaults without a render loop", () => {
    act(() => {
      useAccountStore.setState({ activeAccountId: 123456789 });
    });

    const { result, rerender } = renderHook(() =>
      useScoreUpSettingsStore(selectActiveScoreUpSettings)
    );
    const firstSettings = result.current;

    rerender();

    expect(result.current).toBe(firstSettings);
    expect(result.current).toEqual(DEFAULT_SCORE_UP_SETTINGS);
  });

  it("renames non-default profile settings for UID promotion", () => {
    act(() => {
      useAccountStore.setState({ activeAccountId: 0 });
      useScoreUpSettingsStore.getState().setAllowPoolArtifactSteals(false);
      useScoreUpSettingsStore.getState().renameProfileSettings(0, 800000001);
      useAccountStore.setState({ activeAccountId: 800000001 });
    });

    const state = useScoreUpSettingsStore.getState();
    expect(state.settingsByProfileId[0]).toBeUndefined();
    expect(state.settingsByProfileId[800000001].allowPoolArtifactSteals).toBe(
      false
    );
    expect(getActiveScoreUpSettings().allowPoolArtifactSteals).toBe(false);
  });
});
