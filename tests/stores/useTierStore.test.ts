import type { TierAssignment } from "@/data/types";
import { useTierStore } from "@/stores/useTierStore";
import { beforeEach, describe, expect, it } from "vitest";

// Reset store before each test
beforeEach(() => {
  useTierStore.getState().resetTierList();
});

describe("useTierStore", () => {
  describe("initial state", () => {
    it("starts with empty tier assignments", () => {
      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual({});
    });

    it("starts with empty tier customization", () => {
      const state = useTierStore.getState();
      expect(state.tierCustomization).toEqual({});
    });

    it("has default visibility settings", () => {
      const state = useTierStore.getState();
      expect(state.showWeapons).toBe(true);
      expect(state.showTravelers).toBe(false);
    });

    it("has empty metadata", () => {
      const state = useTierStore.getState();
      expect(state.author).toBe("");
      expect(state.description).toBe("");
      expect(state.customTitle).toBe("");
    });
  });

  describe("setTierAssignments", () => {
    it("sets tier assignments directly", () => {
      const assignments = {
        kaedehara_kazuha: { tier: "S", position: 0 },
        venti: { tier: "A", position: 0 },
      };

      useTierStore.getState().setTierAssignments(assignments);

      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual(assignments);
    });

    it("supports function updater", () => {
      // Set initial state
      useTierStore.getState().setTierAssignments({
        venti: { tier: "S", position: 0 },
      });

      // Use function updater
      useTierStore.getState().setTierAssignments((prev: TierAssignment) => ({
        ...prev,
        kaedehara_kazuha: { tier: "S", position: 1 },
      }));

      const state = useTierStore.getState();
      expect(state.tierAssignments.venti).toEqual({ tier: "S", position: 0 });
      expect(state.tierAssignments.kaedehara_kazuha).toEqual({
        tier: "S",
        position: 1,
      });
    });
  });

  describe("setTierCustomization", () => {
    it("sets tier customization", () => {
      const customization = {
        S: { displayName: "God Tier", hidden: false },
        D: { displayName: "Skip", hidden: true },
      };

      useTierStore.getState().setTierCustomization(customization);

      const state = useTierStore.getState();
      expect(state.tierCustomization).toEqual(customization);
    });
  });

  describe("setCustomTitle", () => {
    it("sets custom title", () => {
      useTierStore.getState().setCustomTitle("My Tier List");

      const state = useTierStore.getState();
      expect(state.customTitle).toBe("My Tier List");
    });
  });

  describe("visibility toggles", () => {
    it("sets showWeapons", () => {
      useTierStore.getState().setShowWeapons(false);
      expect(useTierStore.getState().showWeapons).toBe(false);

      useTierStore.getState().setShowWeapons(true);
      expect(useTierStore.getState().showWeapons).toBe(true);
    });

    it("sets showTravelers", () => {
      useTierStore.getState().setShowTravelers(true);
      expect(useTierStore.getState().showTravelers).toBe(true);

      useTierStore.getState().setShowTravelers(false);
      expect(useTierStore.getState().showTravelers).toBe(false);
    });
  });

  describe("resetTierList", () => {
    it("clears tier assignments and metadata", () => {
      // Set up state
      useTierStore.getState().setTierAssignments({
        venti: { tier: "S", position: 0 },
      });
      useTierStore.getState().setCustomTitle("Test Title");
      useTierStore.getState().setMetadata("Author", "Description");

      // Reset
      useTierStore.getState().resetTierList();

      const state = useTierStore.getState();
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
        tierAssignments: { venti: { tier: "S", position: 0 } },
        tierCustomization: { S: { displayName: "Best", hidden: false } },
        customTitle: "Imported List",
        author: "Test Author",
        description: "Test Description",
      };

      useTierStore.getState().loadTierListData(data);

      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual(data.tierAssignments);
      expect(state.tierCustomization).toEqual(data.tierCustomization);
      expect(state.customTitle).toBe("Imported List");
      expect(state.author).toBe("Test Author");
      expect(state.description).toBe("Test Description");
    });

    it("handles missing optional fields", () => {
      const data = {
        tierAssignments: { venti: { tier: "S", position: 0 } },
        tierCustomization: {},
        // No customTitle, author, description
      };

      useTierStore.getState().loadTierListData(data);

      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual(data.tierAssignments);
      expect(state.customTitle).toBe("");
      expect(state.author).toBe("");
      expect(state.description).toBe("");
    });
  });

  describe("setMetadata", () => {
    it("sets author and description", () => {
      useTierStore.getState().setMetadata("Test Author", "Test Description");

      const state = useTierStore.getState();
      expect(state.author).toBe("Test Author");
      expect(state.description).toBe("Test Description");
    });
  });
});
