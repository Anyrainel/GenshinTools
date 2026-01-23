/**
 * Integration Tests: Artifact Filter Configure View Flow
 *
 * Tests the complete flow of ConfigureView:
 * 1. Character filtering and sorting
 * 2. Target character navigation (from ComputeView)
 * 3. Tier-based sorting integration
 */

import { beforeEach, describe, expect, it } from "vitest";

import { charactersById } from "@/data/constants";
import { characters } from "@/data/resources";
import type { CharacterFilters, Tier } from "@/data/types";
import {
  defaultCharacterFilters,
  filterAndSortCharacters,
  hasActiveFilters,
} from "@/lib/characterFilters";
import { useTierStore } from "@/stores/useTierStore";

describe("Integration: Configure View Filter Flow", () => {
  beforeEach(() => {
    useTierStore.getState().resetTierList();
  });

  describe("character filtering", () => {
    it("filters characters by single element", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: ["Pyro"],
      };

      const result = filterAndSortCharacters(characters, filters, {});

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.element === "Pyro")).toBe(true);
    });

    it("filters characters by multiple elements", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: ["Pyro", "Hydro"],
      };

      const result = filterAndSortCharacters(characters, filters, {});

      expect(result.length).toBeGreaterThan(0);
      expect(
        result.every((c) => c.element === "Pyro" || c.element === "Hydro")
      ).toBe(true);
    });

    it("filters characters by weapon type", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        weaponTypes: ["Polearm"],
      };

      const result = filterAndSortCharacters(characters, filters, {});

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.weaponType === "Polearm")).toBe(true);
    });

    it("filters characters by rarity", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        rarities: [5],
      };

      const result = filterAndSortCharacters(characters, filters, {});

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.rarity === 5)).toBe(true);
    });

    it("filters characters by region", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        regions: ["Liyue"],
      };

      const result = filterAndSortCharacters(characters, filters, {});

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.region === "Liyue")).toBe(true);
    });

    it("combines multiple filter types (AND logic)", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: ["Pyro"],
        weaponTypes: ["Polearm"],
        rarities: [5],
      };

      const result = filterAndSortCharacters(characters, filters, {});

      // Should match characters like Hu Tao (Pyro, Polearm, 5-star)
      expect(result.length).toBeGreaterThan(0);
      expect(
        result.every(
          (c) =>
            c.element === "Pyro" && c.weaponType === "Polearm" && c.rarity === 5
        )
      ).toBe(true);
    });

    it("returns empty when filter combination is impossible", () => {
      // Looking for a very specific combination that doesn't exist
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: ["Dendro"],
        regions: ["Mondstadt"],
        weaponTypes: ["Catalyst"],
        rarities: [5],
      };

      const result = filterAndSortCharacters(characters, filters, {});

      // No 5-star Dendro Catalyst from Mondstadt exists
      expect(result).toHaveLength(0);
    });
  });

  describe("target character navigation", () => {
    it("creates filters that match target character properties", () => {
      const targetId = "hu_tao";
      const character = charactersById[targetId];

      expect(character).toBeDefined();

      // Simulate what ConfigureView does when targetCharacterId is set
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: [character.element],
        weaponTypes: [character.weaponType],
        rarities: [character.rarity],
        regions: [character.region],
      };

      const result = filterAndSortCharacters(characters, filters, {});

      // Hu Tao should be in results
      expect(result.some((c) => c.id === "hu_tao")).toBe(true);
    });

    it("creates unique filter for characters with unique traits", () => {
      const targetId = "hu_tao";
      const character = charactersById[targetId];

      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: [character.element],
        weaponTypes: [character.weaponType],
        rarities: [character.rarity],
        regions: [character.region],
      };

      const result = filterAndSortCharacters(characters, filters, {});

      // For Hu Tao: Pyro + Polearm + 5-star + Liyue - should be 1 or very few
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("handles unknown character ID gracefully", () => {
      const targetId = "unknown_character";
      const character = charactersById[targetId];

      // Should be undefined for unknown character
      expect(character).toBeUndefined();
    });
  });

  describe("tier-based sorting", () => {
    it("sorts characters by tier when assignments exist", () => {
      const tierAssignments = {
        hu_tao: { tier: "S" as Tier, position: 0 },
        xingqiu: { tier: "A" as Tier, position: 0 },
        bennett: { tier: "S" as Tier, position: 1 },
      };

      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        tierSort: "desc", // S -> Pool order
      };

      const result = filterAndSortCharacters(
        characters,
        filters,
        tierAssignments
      );

      // Find positions of characters with tier assignments
      const huTaoIndex = result.findIndex((c) => c.id === "hu_tao");
      const bennettIndex = result.findIndex((c) => c.id === "bennett");
      const xingqiuIndex = result.findIndex((c) => c.id === "xingqiu");

      // S tier should come before A tier
      if (huTaoIndex >= 0 && xingqiuIndex >= 0) {
        expect(huTaoIndex).toBeLessThan(xingqiuIndex);
      }
      if (bennettIndex >= 0 && xingqiuIndex >= 0) {
        expect(bennettIndex).toBeLessThan(xingqiuIndex);
      }
    });

    it("uses release date sort when tier sort is off", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        tierSort: "off",
        releaseSort: "desc", // newest first
      };

      // Empty tier assignments
      const result = filterAndSortCharacters(characters, filters, {});

      // Should still return all characters, sorted by release date
      expect(result.length).toBe(characters.length);
    });
  });

  describe("hasActiveFilters utility", () => {
    it("returns false for default filters", () => {
      expect(hasActiveFilters(defaultCharacterFilters)).toBe(false);
    });

    it("returns true when elements filter is set", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: ["Pyro"],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns true when weapon types filter is set", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        weaponTypes: ["Sword"],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns true when rarities filter is set", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        rarities: [5],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns true when regions filter is set", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        regions: ["Liyue"],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });
  });
});
