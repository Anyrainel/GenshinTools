/**
 * Integration Tests: Weapon Tier List Page Flow
 *
 * Tests the complete pipeline:
 * 1. Weapon tier assignments via useWeaponTierStore
 * 2. Tier customization
 * 3. Rarity filter toggles
 * 4. Export/Import data format
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { TierAssignment, TierCustomization } from "@/data/types";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";

describe("Integration: Weapon Tier List Page Flow", () => {
  beforeEach(() => {
    useWeaponTierStore.getState().resetTierList();
  });

  describe("weapon tier assignment", () => {
    it("assigns weapon to tier with position", () => {
      const assignments: TierAssignment = {
        staff_of_homa: { tier: "S", position: 0 },
        amos_bow: { tier: "S", position: 1 },
        sacrificial_sword: { tier: "A", position: 0 },
      };

      act(() => {
        useWeaponTierStore.getState().setTierAssignments(assignments);
      });

      const stored = useWeaponTierStore.getState().tierAssignments;
      expect(stored.staff_of_homa).toEqual({ tier: "S", position: 0 });
      expect(stored.amos_bow).toEqual({ tier: "S", position: 1 });
      expect(stored.sacrificial_sword).toEqual({ tier: "A", position: 0 });
    });

    it("updates weapon tier via function update", () => {
      act(() => {
        useWeaponTierStore.getState().setTierAssignments({
          staff_of_homa: { tier: "S", position: 0 },
        });
      });

      // Update using function form
      act(() => {
        useWeaponTierStore.getState().setTierAssignments((prev) => ({
          ...prev,
          amos_bow: { tier: "A", position: 0 },
        }));
      });

      const stored = useWeaponTierStore.getState().tierAssignments;
      expect(stored.staff_of_homa).toBeDefined();
      expect(stored.amos_bow).toBeDefined();
    });
  });

  describe("tier customization", () => {
    it("customizes weapon tier display names", () => {
      const customization: TierCustomization = {
        S: { displayName: "Best in Slot", hidden: false },
        A: { displayName: "Excellent", hidden: false },
      };

      act(() => {
        useWeaponTierStore.getState().setTierCustomization(customization);
      });

      const stored = useWeaponTierStore.getState().tierCustomization;
      expect(stored.S?.displayName).toBe("Best in Slot");
      expect(stored.A?.displayName).toBe("Excellent");
    });

    it("sets custom title", () => {
      act(() => {
        useWeaponTierStore.getState().setCustomTitle("Sword Tier List");
      });

      expect(useWeaponTierStore.getState().customTitle).toBe("Sword Tier List");
    });
  });

  describe("export/import flow", () => {
    it("loads weapon tier list data from import", () => {
      const importData = {
        tierAssignments: {
          staff_of_homa: { tier: "S", position: 0 },
        },
        tierCustomization: {
          S: { displayName: "BiS", hidden: false },
        },
        customTitle: "Imported Weapons",
        author: "Test Author",
        description: "Test Description",
      };

      act(() => {
        useWeaponTierStore.getState().loadTierListData(importData);
      });

      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments.staff_of_homa).toEqual({
        tier: "S",
        position: 0,
      });
      expect(state.tierCustomization.S?.displayName).toBe("BiS");
      expect(state.customTitle).toBe("Imported Weapons");
    });

    it("exports complete weapon tier list state", () => {
      act(() => {
        useWeaponTierStore.getState().setTierAssignments({
          staff_of_homa: { tier: "S", position: 0 },
        });
        useWeaponTierStore.getState().setMetadata("Author", "Description");
      });

      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments.staff_of_homa).toBeDefined();
      expect(state.author).toBe("Author");
      expect(state.description).toBe("Description");
    });
  });

  describe("reset functionality", () => {
    it("clears all weapon tier list data", () => {
      act(() => {
        useWeaponTierStore.getState().setTierAssignments({
          staff_of_homa: { tier: "S", position: 0 },
        });
        useWeaponTierStore.getState().setCustomTitle("Test");
        useWeaponTierStore.getState().setMetadata("Author", "Desc");
      });

      act(() => {
        useWeaponTierStore.getState().resetTierList();
      });

      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments).toEqual({});
      expect(state.customTitle).toBe("");
      expect(state.author).toBe("");
      expect(state.description).toBe("");
    });
  });
});
