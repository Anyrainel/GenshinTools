/**
 * Integration Tests: Tier List Page Flow
 *
 * Tests the complete pipeline:
 * 1. Character tier assignments via useTierStore
 * 2. Tier customization (names, hidden status)
 * 3. Export/Import data format
 * 4. Filtering and display logic
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type {
  TierAssignment,
  TierCustomization,
  TierListData,
} from "@/data/types";
import { tiers } from "@/data/types";
import { useTierStore } from "@/stores/useTierStore";

describe("Integration: Tier List Page Flow", () => {
  beforeEach(() => {
    useTierStore.getState().resetTierList();
  });

  describe("tier assignment management", () => {
    it("assigns character to tier with position", () => {
      const assignments: TierAssignment = {
        hu_tao: { tier: "S", position: 0 },
        xingqiu: { tier: "S", position: 1 },
        zhongli: { tier: "A", position: 0 },
      };

      act(() => {
        useTierStore.getState().setTierAssignments(assignments);
      });

      const stored = useTierStore.getState().tierAssignments;
      expect(stored.hu_tao).toEqual({ tier: "S", position: 0 });
      expect(stored.xingqiu).toEqual({ tier: "S", position: 1 });
      expect(stored.zhongli).toEqual({ tier: "A", position: 0 });
    });

    it("removes character from tier via assignment update", () => {
      act(() => {
        useTierStore.getState().setTierAssignments({
          hu_tao: { tier: "S", position: 0 },
          xingqiu: { tier: "A", position: 0 },
        });
      });

      // Remove hu_tao by updating with new assignments
      act(() => {
        useTierStore.getState().setTierAssignments({
          xingqiu: { tier: "A", position: 0 },
        });
      });

      const stored = useTierStore.getState().tierAssignments;
      expect(stored.hu_tao).toBeUndefined();
      expect(stored.xingqiu).toBeDefined();
    });

    it("moves character between tiers", () => {
      act(() => {
        useTierStore.getState().setTierAssignments({
          hu_tao: { tier: "S", position: 0 },
        });
      });

      // Move hu_tao from S to A tier
      act(() => {
        useTierStore.getState().setTierAssignments({
          hu_tao: { tier: "A", position: 0 },
        });
      });

      expect(useTierStore.getState().tierAssignments.hu_tao.tier).toBe("A");
    });
  });

  describe("tier customization", () => {
    it("customizes tier display names", () => {
      const customization: TierCustomization = {
        S: { displayName: "Meta Defining", hidden: false },
        A: { displayName: "Great", hidden: false },
        B: { displayName: "Good", hidden: false },
      };

      act(() => {
        useTierStore.getState().setTierCustomization(customization);
      });

      const stored = useTierStore.getState().tierCustomization;
      expect(stored.S?.displayName).toBe("Meta Defining");
      expect(stored.A?.displayName).toBe("Great");
    });

    it("hides tiers via customization", () => {
      const customization: TierCustomization = {
        C: { displayName: "C", hidden: true },
        D: { displayName: "D", hidden: true },
      };

      act(() => {
        useTierStore.getState().setTierCustomization(customization);
      });

      const stored = useTierStore.getState().tierCustomization;
      expect(stored.C?.hidden).toBe(true);
      expect(stored.D?.hidden).toBe(true);
    });

    it("sets custom title for tier list", () => {
      act(() => {
        useTierStore.getState().setCustomTitle("Spiral Abyss 4.5 Tier List");
      });

      expect(useTierStore.getState().customTitle).toBe(
        "Spiral Abyss 4.5 Tier List"
      );
    });
  });

  describe("export/import flow", () => {
    it("loads tier list data from import", () => {
      const importData: TierListData = {
        tierAssignments: {
          hu_tao: { tier: "S", position: 0 },
          xingqiu: { tier: "A", position: 0 },
        },
        tierCustomization: {
          S: { displayName: "Best", hidden: false },
        },
        customTitle: "Imported Tier List",
        language: "en",
        author: "Test Author",
        description: "Test Description",
      };

      act(() => {
        useTierStore.getState().loadTierListData(importData);
      });

      const state = useTierStore.getState();
      expect(state.tierAssignments.hu_tao).toEqual({ tier: "S", position: 0 });
      expect(state.tierCustomization.S?.displayName).toBe("Best");
      expect(state.customTitle).toBe("Imported Tier List");
      expect(state.author).toBe("Test Author");
      expect(state.description).toBe("Test Description");
    });

    it("exports complete tier list state", () => {
      act(() => {
        useTierStore.getState().setTierAssignments({
          hu_tao: { tier: "S", position: 0 },
        });
        useTierStore.getState().setTierCustomization({
          S: { displayName: "Meta", hidden: false },
        });
        useTierStore.getState().setCustomTitle("My Tier List");
        useTierStore.getState().setMetadata("Author", "Description");
      });

      const state = useTierStore.getState();

      // Validate export structure
      const exportData: TierListData = {
        tierAssignments: state.tierAssignments,
        tierCustomization: state.tierCustomization,
        customTitle: state.customTitle,
        language: "en",
        author: state.author,
        description: state.description,
      };

      expect(exportData.tierAssignments.hu_tao).toBeDefined();
      expect(exportData.customTitle).toBe("My Tier List");
      expect(exportData.author).toBe("Author");
    });
  });

  describe("display settings", () => {
    it("toggles weapon display", () => {
      expect(useTierStore.getState().showWeapons).toBe(true); // Default

      act(() => {
        useTierStore.getState().setShowWeapons(false);
      });

      expect(useTierStore.getState().showWeapons).toBe(false);
    });

    it("toggles traveler display", () => {
      expect(useTierStore.getState().showTravelers).toBe(false); // Default

      act(() => {
        useTierStore.getState().setShowTravelers(true);
      });

      expect(useTierStore.getState().showTravelers).toBe(true);
    });
  });

  describe("tier ordering", () => {
    it("uses correct tier order for sorting", () => {
      // tiers array defines the order: S, A, B, C, D, Pool
      expect(tiers).toContain("S");
      expect(tiers).toContain("Pool");
      expect(tiers.indexOf("S")).toBeLessThan(tiers.indexOf("A"));
      expect(tiers.indexOf("A")).toBeLessThan(tiers.indexOf("B"));
      expect(tiers.indexOf("D")).toBeLessThan(tiers.indexOf("Pool"));
    });
  });
});
