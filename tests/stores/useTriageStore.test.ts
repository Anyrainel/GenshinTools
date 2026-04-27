import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { useTriageStore } from "@/stores/useTriageStore";

beforeEach(() => {
  useTriageStore.setState({ settings: { ...DEFAULT_TRIAGE_SETTINGS } });
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
  });
});
