import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { migrateTriageStore } from "@/stores/migration/triage";
import { useAccountStore } from "@/stores/useAccountStore";
import {
  getActiveTriageSettings,
  selectActiveTriageSettings,
  useTriageStore,
} from "@/stores/useTriageStore";

beforeEach(() => {
  useAccountStore.setState({
    accounts: {},
    activeAccountId: null,
  });
  useTriageStore.setState({
    settingsByProfileId: {
      [DEFAULT_ACCOUNT_PROFILE_ID]: structuredClone(DEFAULT_TRIAGE_SETTINGS),
    },
  });
});

describe("useTriageStore", () => {
  it("migrates v3 strategic evaluation into high level protection", () => {
    const result = migrateTriageStore(
      {
        settings: {
          ...DEFAULT_TRIAGE_SETTINGS,
          strategicHighLevelEvaluation: true,
        },
      },
      3
    );

    expect(result.settingsByProfileId).toEqual({
      [DEFAULT_ACCOUNT_PROFILE_ID]: {
        ...DEFAULT_TRIAGE_SETTINGS,
        highLevelProtection: false,
        strategicHighLevelEvaluation: undefined,
      },
    });
    expect(result).not.toHaveProperty("settings");
  });

  it("migrates v5 persisted active settings into profile settings only", () => {
    const result = migrateTriageStore(
      {
        settings: {
          ...DEFAULT_TRIAGE_SETTINGS,
          mainStatThreshold: 82,
        },
      },
      5
    );

    expect(result.settingsByProfileId).toEqual({
      [DEFAULT_ACCOUNT_PROFILE_ID]: {
        ...DEFAULT_TRIAGE_SETTINGS,
        mainStatThreshold: 82,
      },
    });
    expect(result).not.toHaveProperty("settings");
  });

  it("preserves current profile settings without active settings mirror", () => {
    const currentState = {
      settingsByProfileId: {
        123456789: {
          ...DEFAULT_TRIAGE_SETTINGS,
          mainStatThreshold: 77,
        },
      },
    };

    const result = migrateTriageStore(currentState, 6);

    expect(result).toBe(currentState);
    expect(result).not.toHaveProperty("settings");
  });

  describe("migration v0 → v1", () => {
    it("adds customFlexInputs: [] when missing", () => {
      // Simulate v0 persisted state (no customFlexInputs)
      const v0Settings = {
        mainStatThreshold: 90,
        optionalSubThreshold: 50,
        fillerKeep: 2,
        qualityMargin: 2,
        setSlotKeep: 2,
        ownedOnly: true,
        erHoardingEnabled: true,
        erHoardingAllEnabled: false,
        doubleCritLockEnabled: true,
        levelProtection: 12,
        equippedProtection: true,
        disabledFlexPatterns: [],
        enabledFlexPatterns: [],
        // no customFlexInputs
      };

      // Active settings fall back through the profile map and default healing.
      act(() => {
        useTriageStore.setState({
          settingsByProfileId: {
            [DEFAULT_ACCOUNT_PROFILE_ID]: {
              ...DEFAULT_TRIAGE_SETTINGS,
              ...v0Settings,
            },
          },
        });
      });

      expect(getActiveTriageSettings().customFlexInputs).toEqual([]);
    });
  });

  describe("updateSettings", () => {
    it("returns a stable default snapshot for profiles without stored settings", () => {
      act(() => {
        useAccountStore.setState({ activeAccountId: 123456789 });
      });

      const state = useTriageStore.getState();
      expect(state.settingsByProfileId[123456789]).toBeUndefined();
      expect(selectActiveTriageSettings(state)).toBe(
        selectActiveTriageSettings(state)
      );
      expect(getActiveTriageSettings()).toEqual(DEFAULT_TRIAGE_SETTINGS);
    });

    it("can subscribe to active defaults without a render loop", () => {
      act(() => {
        useAccountStore.setState({ activeAccountId: 123456789 });
      });

      const { result, rerender } = renderHook(() =>
        useTriageStore(selectActiveTriageSettings)
      );
      const firstSettings = result.current;

      rerender();

      expect(result.current).toBe(firstSettings);
      expect(result.current).toEqual(DEFAULT_TRIAGE_SETTINGS);
    });

    it("patches settings with customFlexInputs", () => {
      act(() => {
        useTriageStore.getState().updateSettings({
          customFlexInputs: [
            { slot: "sands", mainStat: "em", requiredSubs: ["cr", "cd"] },
          ],
        });
      });
      const settings = getActiveTriageSettings();
      expect(settings.customFlexInputs).toHaveLength(1);
      expect(settings.customFlexInputs[0].slot).toBe("sands");
    });

    it("stores settings per active account profile", () => {
      act(() => {
        useAccountStore.setState({ activeAccountId: 0 });
        useTriageStore.getState().updateSettings({
          ownedOnly: false,
          mainStatThreshold: 88,
        });
        useAccountStore.setState({ activeAccountId: 123456789 });
      });

      expect(getActiveTriageSettings().ownedOnly).toBe(
        DEFAULT_TRIAGE_SETTINGS.ownedOnly
      );

      act(() => {
        useTriageStore.getState().updateSettings({
          mainStatThreshold: 75,
        });
        useAccountStore.setState({ activeAccountId: 0 });
      });

      const state = useTriageStore.getState();
      const settings = getActiveTriageSettings();
      expect(settings.ownedOnly).toBe(false);
      expect(settings.mainStatThreshold).toBe(88);
      expect(state.settingsByProfileId[123456789].mainStatThreshold).toBe(75);
    });
  });
});
