/**
 * Integration Tests: Tier Assignment to Character Sorting Flow
 *
 * Tests the complete pipeline:
 * 1. Tier assignments stored in useTierStore
 * 2. Character filtering via characterFilters
 * 3. Correct sorting applied based on tier assignments
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Character, CharacterFilters, TierAssignment } from "@/data/types";
import {
  defaultCharacterFilters,
  filterAndSortCharacters,
} from "@/lib/characterFilters";
import { useTierStore } from "@/stores/useTierStore";

// Create test characters (using Character type which has id, not key)
const testCharacters: Character[] = [
  {
    id: "hu_tao",
    element: "Pyro",
    rarity: 5,
    region: "Liyue",
    releaseDate: "2021-03-02",
    weaponType: "Polearm",
    imageUrl: "",
    imagePath: "",
  },
  {
    id: "xingqiu",
    element: "Hydro",
    rarity: 4,
    region: "Liyue",
    releaseDate: "2020-09-28",
    weaponType: "Sword",
    imageUrl: "",
    imagePath: "",
  },
  {
    id: "zhongli",
    element: "Geo",
    rarity: 5,
    region: "Liyue",
    releaseDate: "2020-12-01",
    weaponType: "Polearm",
    imageUrl: "",
    imagePath: "",
  },
  {
    id: "bennett",
    element: "Pyro",
    rarity: 4,
    region: "Mondstadt",
    releaseDate: "2020-09-28",
    weaponType: "Sword",
    imageUrl: "",
    imagePath: "",
  },
];

describe("Integration: Tier Assignment to Character Sorting Flow", () => {
  beforeEach(() => {
    useTierStore.getState().resetTierList();
  });

  it("sorts characters by tier assignment when tier sort is enabled", () => {
    // Setup tier assignments
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
      zhongli: { tier: "A", position: 0 },
      xingqiu: { tier: "S", position: 1 },
      // bennett has no tier assignment
    };

    act(() => {
      useTierStore.getState().setTierAssignments(tierAssignments);
    });

    const storedAssignments = useTierStore.getState().tierAssignments;

    const filters: CharacterFilters = {
      ...defaultCharacterFilters,
      tierSort: "desc", // S -> A -> Pool
    };

    const sorted = filterAndSortCharacters(
      testCharacters,
      filters,
      storedAssignments
    );

    // S tier characters should come first (hu_tao pos 0, xingqiu pos 1)
    // Then A tier (zhongli)
    // Then unassigned (bennett goes to Pool)
    expect(sorted[0].id).toBe("hu_tao");
    expect(sorted[1].id).toBe("xingqiu");
    expect(sorted[2].id).toBe("zhongli");
    expect(sorted[3].id).toBe("bennett");
  });

  it("sorts by release date when tier sort is off", () => {
    const filters: CharacterFilters = {
      ...defaultCharacterFilters,
      tierSort: "off",
      releaseSort: "desc", // Newest first
    };

    const sorted = filterAndSortCharacters(testCharacters, filters, {});

    // hu_tao is newest (2021-03-02)
    expect(sorted[0].id).toBe("hu_tao");
  });

  it("filters characters by element", () => {
    const filters: CharacterFilters = {
      ...defaultCharacterFilters,
      elements: ["Pyro"],
    };

    const sorted = filterAndSortCharacters(testCharacters, filters, {});

    // Only Pyro characters
    expect(sorted).toHaveLength(2);
    expect(sorted.every((c) => c.element === "Pyro")).toBe(true);
  });

  it("filters characters by weapon type", () => {
    const filters: CharacterFilters = {
      ...defaultCharacterFilters,
      weaponTypes: ["Sword"],
    };

    const sorted = filterAndSortCharacters(testCharacters, filters, {});

    // Only Sword users
    expect(sorted).toHaveLength(2);
    expect(sorted.every((c) => c.weaponType === "Sword")).toBe(true);
  });

  it("combines element filter with tier sort", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
      bennett: { tier: "A", position: 0 },
    };

    act(() => {
      useTierStore.getState().setTierAssignments(tierAssignments);
    });

    const filters: CharacterFilters = {
      ...defaultCharacterFilters,
      elements: ["Pyro"],
      tierSort: "desc",
    };

    const sorted = filterAndSortCharacters(
      testCharacters,
      filters,
      useTierStore.getState().tierAssignments
    );

    // Only Pyro, sorted by tier (hu_tao S, bennett A)
    expect(sorted).toHaveLength(2);
    expect(sorted[0].id).toBe("hu_tao");
    expect(sorted[1].id).toBe("bennett");
  });

  it("handles empty tier assignments gracefully", () => {
    const filters: CharacterFilters = {
      ...defaultCharacterFilters,
      tierSort: "desc",
    };

    // No tier assignments - falls back to release sort
    const sorted = filterAndSortCharacters(testCharacters, filters, {});

    // All characters should still be returned
    expect(sorted).toHaveLength(4);
  });

  it("persists tier assignments in store", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
    };

    act(() => {
      useTierStore.getState().setTierAssignments(tierAssignments);
    });

    expect(useTierStore.getState().tierAssignments.hu_tao).toBeDefined();
    expect(useTierStore.getState().tierAssignments.hu_tao.tier).toBe("S");

    // Reset clears assignments
    act(() => {
      useTierStore.getState().resetTierList();
    });

    expect(useTierStore.getState().tierAssignments).toEqual({});
  });
});
