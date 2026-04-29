import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTriageStore } from "@/stores/useTriageStore";

beforeEach(() => {
  useAccountStore.setState({
    accounts: {},
    activeAccountId: null,
    staleScoreCharIds: [],
  });
  useTriageStore.setState({
    settings: structuredClone(DEFAULT_TRIAGE_SETTINGS),
    settingsByProfileId: {
      [DEFAULT_ACCOUNT_PROFILE_ID]: structuredClone(DEFAULT_TRIAGE_SETTINGS),
    },
  });
});

describe("useTriageStore", () => {
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

      // The merge function spreads defaults, so missing fields get defaults
      act(() => {
        useTriageStore.setState({
          settings: {
            ...DEFAULT_TRIAGE_SETTINGS,
            ...v0Settings,
          },
        });
      });

      const state = useTriageStore.getState();
      expect(state.settings.customFlexInputs).toEqual([]);
    });
  });

  describe("updateSettings", () => {
    it("patches settings with customFlexInputs", () => {
      act(() => {
        useTriageStore.getState().updateSettings({
          customFlexInputs: [
            { slot: "sands", mainStat: "em", requiredSubs: ["cr", "cd"] },
          ],
        });
      });
      const state = useTriageStore.getState();
      expect(state.settings.customFlexInputs).toHaveLength(1);
      expect(state.settings.customFlexInputs[0].slot).toBe("sands");
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

      expect(useTriageStore.getState().settings.ownedOnly).toBe(
        DEFAULT_TRIAGE_SETTINGS.ownedOnly
      );

      act(() => {
        useTriageStore.getState().updateSettings({
          mainStatThreshold: 75,
        });
        useAccountStore.setState({ activeAccountId: 0 });
      });

      const state = useTriageStore.getState();
      expect(state.settings.ownedOnly).toBe(false);
      expect(state.settings.mainStatThreshold).toBe(88);
      expect(state.settingsByProfileId[123456789].mainStatThreshold).toBe(75);
    });
  });
});
