import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tier } from "@/data/enums";
import type { TierAssignment } from "@/data/types";
import {
  selectActiveTierAssignments,
  selectActiveTierAuthor,
  selectActiveTierCustomization,
  selectActiveTierDescription,
  selectActiveTierTitle,
} from "@/stores/createTierStore";
import { migrateGenericTierStore } from "@/stores/migration/tier";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";

// Reset store before each test
beforeEach(() => {
  useWeaponTierStore.setState({
    tierLists: {
      1: {
        id: 1,
        tierAssignments: {},
        tierCustomization: {},
        customTitle: "",
        author: "",
        description: "",
      },
    },
    activeTierListId: 1,
    nextId: 2,
  });
});

describe("useWeaponTierStore", () => {
  describe("initial state", () => {
    it("starts with empty tier assignments", () => {
      const state = useWeaponTierStore.getState();
      expect(selectActiveTierAssignments(state)).toEqual({});
    });

    it("starts with empty tier customization", () => {
      const state = useWeaponTierStore.getState();
      expect(selectActiveTierCustomization(state)).toEqual({});
    });

    it("has empty metadata", () => {
      const state = useWeaponTierStore.getState();
      expect(selectActiveTierAuthor(state)).toBe("");
      expect(selectActiveTierDescription(state)).toBe("");
      expect(selectActiveTierTitle(state)).toBe("");
    });
  });

  describe("setTierAssignments", () => {
    it("sets tier assignments directly", () => {
      const assignments: TierAssignment = {
        staff_of_homa: { tier: "S", position: 0 },
        primordial_jade_winged_spear: { tier: "A", position: 0 },
      };

      useWeaponTierStore.getState().setTierAssignments(assignments);

      const state = useWeaponTierStore.getState();
      expect(selectActiveTierAssignments(state)).toEqual(assignments);
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
      expect(selectActiveTierAssignments(state).staff_of_homa).toEqual({
        tier: "S",
        position: 0,
      });
      expect(selectActiveTierAssignments(state).mistsplitter_reforged).toEqual({
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
      expect(selectActiveTierAssignments(state).staff_of_homa).toBeUndefined();
      expect(
        selectActiveTierAssignments(state).mistsplitter_reforged
      ).toBeDefined();
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
      expect(selectActiveTierCustomization(state)).toEqual(customization);
    });
  });

  describe("setCustomTitle", () => {
    it("sets custom title", () => {
      useWeaponTierStore.getState().setCustomTitle("Weapon Tier List 5.0");

      const state = useWeaponTierStore.getState();
      expect(selectActiveTierTitle(state)).toBe("Weapon Tier List 5.0");
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
      expect(selectActiveTierAssignments(state)).toEqual({});
      expect(selectActiveTierCustomization(state)).toEqual({});
      expect(selectActiveTierTitle(state)).toBe("");
      expect(selectActiveTierAuthor(state)).toBe("");
      expect(selectActiveTierDescription(state)).toBe("");
    });
  });

  describe("loadTierListData", () => {
    it("loads complete tier list data", () => {
      const data = {
        tierAssignments: { staff_of_homa: { tier: "S" as Tier, position: 0 } },
        tierCustomization: { S: { displayName: "Best", hidden: false } },
        customTitle: "Imported Weapon List",
        author: "Test Author",
        description: "Test Description",
      };

      useWeaponTierStore.getState().loadTierListData(data);

      const state = useWeaponTierStore.getState();
      expect(selectActiveTierAssignments(state)).toEqual(data.tierAssignments);
      expect(selectActiveTierCustomization(state)).toEqual(
        data.tierCustomization
      );
      expect(selectActiveTierTitle(state)).toBe("Imported Weapon List");
      expect(selectActiveTierAuthor(state)).toBe("Test Author");
      expect(selectActiveTierDescription(state)).toBe("Test Description");
    });

    it("handles missing optional fields", () => {
      const data = {
        tierAssignments: { staff_of_homa: { tier: "S" as Tier, position: 0 } },
        tierCustomization: {},
        // No customTitle, author, description
      };

      useWeaponTierStore.getState().loadTierListData(data);

      const state = useWeaponTierStore.getState();
      expect(selectActiveTierAssignments(state)).toEqual(data.tierAssignments);
      expect(selectActiveTierTitle(state)).toBe("");
      expect(selectActiveTierAuthor(state)).toBe("");
      expect(selectActiveTierDescription(state)).toBe("");
    });
  });

  describe("setMetadata", () => {
    it("sets author and description", () => {
      useWeaponTierStore.getState().setMetadata("Weapon Expert", "5.0 Review");

      const state = useWeaponTierStore.getState();
      expect(selectActiveTierAuthor(state)).toBe("Weapon Expert");
      expect(selectActiveTierDescription(state)).toBe("5.0 Review");
    });
  });

  describe("multi-list management", () => {
    it("creates and switches isolated weapon tier lists", () => {
      useWeaponTierStore.getState().setTierAssignments({
        staff_of_homa: { tier: "S", position: 0 },
      });
      useWeaponTierStore.getState().setCustomTitle("Polearms");

      const secondId = useWeaponTierStore.getState().createTierList("Swords");
      useWeaponTierStore.getState().setTierAssignments({
        mistsplitter_reforged: { tier: "S", position: 0 },
      });

      let state = useWeaponTierStore.getState();
      expect(secondId).toBe(2);
      expect(state.activeTierListId).toBe(2);
      expect(selectActiveTierAssignments(state)).toEqual({
        mistsplitter_reforged: { tier: "S", position: 0 },
      });

      useWeaponTierStore.getState().setActiveTierList(1);
      state = useWeaponTierStore.getState();
      expect(selectActiveTierTitle(state)).toBe("Polearms");
      expect(selectActiveTierAssignments(state)).toEqual({
        staff_of_homa: { tier: "S", position: 0 },
      });
      expect(state.tierLists[2].customTitle).toBe("Swords");
    });

    it("renames and deletes lists without deleting the last list", () => {
      const secondId = useWeaponTierStore.getState().createTierList("Second");
      useWeaponTierStore.getState().renameTierList(secondId, "Renamed");
      expect(selectActiveTierTitle(useWeaponTierStore.getState())).toBe(
        "Renamed"
      );

      useWeaponTierStore.getState().deleteTierList(secondId);
      let state = useWeaponTierStore.getState();
      expect(state.activeTierListId).toBe(1);
      expect(state.tierLists[secondId]).toBeUndefined();

      useWeaponTierStore.getState().deleteTierList(1);
      state = useWeaponTierStore.getState();
      expect(state.tierLists[1]).toBeDefined();
      expect(Object.keys(state.tierLists)).toHaveLength(1);
    });
  });

  describe("migration v0 → v1", () => {
    it("wraps the old flat tier list in a default list instance", () => {
      const oldState = {
        tierAssignments: {
          staff_of_homa: { tier: "S", position: 0 },
        },
        tierCustomization: {
          S: { displayName: "Best", hidden: false },
        },
        customTitle: "Legacy Weapons",
        author: "Author",
        description: "Description",
      };

      vi.useFakeTimers();
      vi.setSystemTime(678_901);
      let result: Record<string, unknown>;
      try {
        result = migrateGenericTierStore(oldState, 0);
      } finally {
        vi.useRealTimers();
      }
      expect(result.activeTierListId).toBe(1);
      expect(result.nextId).toBe(2);
      expect(result.updatedAt).toBe(678_901);
      expect(result.tierLists).toEqual({
        1: {
          id: 1,
          tierAssignments: oldState.tierAssignments,
          tierCustomization: oldState.tierCustomization,
          customTitle: "Legacy Weapons",
          author: "Author",
          description: "Description",
        },
      });
    });
  });
});
