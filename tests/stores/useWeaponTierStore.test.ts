import type { TierAssignment } from "@/data/types";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";
import { beforeEach, describe, expect, it } from "vitest";

// Reset store before each test
beforeEach(() => {
  useWeaponTierStore.getState().resetTierList();
});

describe("useWeaponTierStore", () => {
  describe("initial state", () => {
    it("starts with empty tier assignments", () => {
      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments).toEqual({});
    });

    it("starts with empty tier customization", () => {
      const state = useWeaponTierStore.getState();
      expect(state.tierCustomization).toEqual({});
    });

    it("has empty metadata", () => {
      const state = useWeaponTierStore.getState();
      expect(state.author).toBe("");
      expect(state.description).toBe("");
      expect(state.customTitle).toBe("");
    });
  });

  describe("setTierAssignments", () => {
    it("sets tier assignments directly", () => {
      const assignments = {
        staff_of_homa: { tier: "S", position: 0 },
        primordial_jade_winged_spear: { tier: "A", position: 0 },
      };

      useWeaponTierStore.getState().setTierAssignments(assignments);

      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments).toEqual(assignments);
    });

    it("supports function updater pattern", () => {
      // Set initial state
      useWeaponTierStore.getState().setTierAssignments({
        staff_of_homa: { tier: "S", position: 0 },
      });

      // Use function updater
      useWeaponTierStore
        .getState()
        .setTierAssignments((prev: TierAssignment) => ({
          ...prev,
          mistsplitter_reforged: { tier: "S", position: 1 },
        }));

      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments.staff_of_homa).toEqual({
        tier: "S",
        position: 0,
      });
      expect(state.tierAssignments.mistsplitter_reforged).toEqual({
        tier: "S",
        position: 1,
      });
    });

    it("overwrites previous assignments when using direct value", () => {
      useWeaponTierStore.getState().setTierAssignments({
        staff_of_homa: { tier: "S", position: 0 },
      });

      useWeaponTierStore.getState().setTierAssignments({
        mistsplitter_reforged: { tier: "A", position: 0 },
      });

      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments.staff_of_homa).toBeUndefined();
      expect(state.tierAssignments.mistsplitter_reforged).toBeDefined();
    });
  });

  describe("setTierCustomization", () => {
    it("sets tier customization", () => {
      const customization = {
        S: { displayName: "Must Pull", hidden: false },
        D: { displayName: "Skip", hidden: true },
      };

      useWeaponTierStore.getState().setTierCustomization(customization);

      const state = useWeaponTierStore.getState();
      expect(state.tierCustomization).toEqual(customization);
    });
  });

  describe("setCustomTitle", () => {
    it("sets custom title", () => {
      useWeaponTierStore.getState().setCustomTitle("Weapon Tier List 5.0");

      const state = useWeaponTierStore.getState();
      expect(state.customTitle).toBe("Weapon Tier List 5.0");
    });
  });

  describe("resetTierList", () => {
    it("clears tier assignments and metadata", () => {
      // Set up state
      useWeaponTierStore.getState().setTierAssignments({
        staff_of_homa: { tier: "S", position: 0 },
      });
      useWeaponTierStore.getState().setTierCustomization({
        S: { displayName: "Best", hidden: false },
      });
      useWeaponTierStore.getState().setCustomTitle("Test Title");
      useWeaponTierStore.getState().setMetadata("Author", "Description");

      // Reset
      useWeaponTierStore.getState().resetTierList();

      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments).toEqual({});
      expect(state.tierCustomization).toEqual({});
      expect(state.customTitle).toBe("");
      expect(state.author).toBe("");
      expect(state.description).toBe("");
    });
  });

  describe("loadTierListData", () => {
    it("loads complete tier list data", () => {
      const data = {
        tierAssignments: { staff_of_homa: { tier: "S", position: 0 } },
        tierCustomization: { S: { displayName: "Best", hidden: false } },
        customTitle: "Imported Weapon List",
        author: "Test Author",
        description: "Test Description",
      };

      useWeaponTierStore.getState().loadTierListData(data);

      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments).toEqual(data.tierAssignments);
      expect(state.tierCustomization).toEqual(data.tierCustomization);
      expect(state.customTitle).toBe("Imported Weapon List");
      expect(state.author).toBe("Test Author");
      expect(state.description).toBe("Test Description");
    });

    it("handles missing optional fields", () => {
      const data = {
        tierAssignments: { staff_of_homa: { tier: "S", position: 0 } },
        tierCustomization: {},
        // No customTitle, author, description
      };

      useWeaponTierStore.getState().loadTierListData(data);

      const state = useWeaponTierStore.getState();
      expect(state.tierAssignments).toEqual(data.tierAssignments);
      expect(state.customTitle).toBe("");
      expect(state.author).toBe("");
      expect(state.description).toBe("");
    });
  });

  describe("setMetadata", () => {
    it("sets author and description", () => {
      useWeaponTierStore.getState().setMetadata("Weapon Expert", "5.0 Review");

      const state = useWeaponTierStore.getState();
      expect(state.author).toBe("Weapon Expert");
      expect(state.description).toBe("5.0 Review");
    });
  });
});
