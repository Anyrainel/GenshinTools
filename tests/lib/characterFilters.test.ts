import type { Character, CharacterFilters, TierAssignment } from "@/data/types";
import {
  defaultCharacterFilters,
  filterAndSortCharacters,
  getDefaultCharacterFilters,
  hasActiveFilters,
} from "@/lib/characterFilters";
import { describe, expect, it } from "vitest";

// ── Test Fixtures ───────────────────────────────────────────────────────

const mockCharacters: Character[] = [
  {
    id: "hu_tao",
    element: "Pyro",
    rarity: 5,
    weaponType: "Polearm",
    region: "Liyue",
    releaseDate: "2021-03-02",
    imageUrl: "",
    imagePath: "",
  },
  {
    id: "xingqiu",
    element: "Hydro",
    rarity: 4,
    weaponType: "Sword",
    region: "Liyue",
    releaseDate: "2020-09-28",
    imageUrl: "",
    imagePath: "",
  },
  {
    id: "nahida",
    element: "Dendro",
    rarity: 5,
    weaponType: "Catalyst",
    region: "Sumeru",
    releaseDate: "2022-11-02",
    imageUrl: "",
    imagePath: "",
  },
  {
    id: "bennett",
    element: "Pyro",
    rarity: 4,
    weaponType: "Sword",
    region: "Mondstadt",
    releaseDate: "2020-09-28",
    imageUrl: "",
    imagePath: "",
  },
  {
    id: "unreleased",
    element: "Pyro",
    rarity: 5,
    weaponType: "Claymore",
    region: "Natlan",
    releaseDate: null,
    imageUrl: "",
    imagePath: "",
  },
];

const tierAssignments: TierAssignment = {
  hu_tao: { tier: "S", position: 0 },
  nahida: { tier: "S", position: 1 },
  xingqiu: { tier: "A", position: 0 },
  bennett: { tier: "Pool", position: 0 },
};

// ── Tests ───────────────────────────────────────────────────────────────

describe("filterAndSortCharacters", () => {
  it("returns all characters when no filters active", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      defaultCharacterFilters
    );
    expect(result).toHaveLength(mockCharacters.length);
  });

  it("does not mutate the input array", () => {
    const copy = [...mockCharacters];
    filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      releaseSort: "asc",
    });
    expect(mockCharacters).toEqual(copy);
  });

  // ── Filtering ──

  it("filters by element", () => {
    const result = filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      elements: ["Pyro"],
    });
    expect(result.every((c) => c.element === "Pyro")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by weapon type", () => {
    const result = filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      weaponTypes: ["Sword"],
    });
    expect(result.every((c) => c.weaponType === "Sword")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by region", () => {
    const result = filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      regions: ["Liyue"],
    });
    expect(result.every((c) => c.region === "Liyue")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by rarity", () => {
    const result = filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      rarities: [5],
    });
    expect(result.every((c) => c.rarity === 5)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("combines multiple filters with AND logic", () => {
    const result = filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      elements: ["Pyro"],
      rarities: [5],
    });
    expect(result).toHaveLength(2); // hu_tao + unreleased
    expect(result.every((c) => c.element === "Pyro" && c.rarity === 5)).toBe(
      true
    );
  });

  it("returns empty when filters exclude everything", () => {
    const result = filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      elements: ["Geo"],
    });
    expect(result).toHaveLength(0);
  });

  // ── ownedOnly filter ──

  it("excludes unreleased characters when ownedOnly is true", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, ownedOnly: true },
      undefined,
      () => true // all released chars are owned
    );
    expect(result.find((c) => c.id === "unreleased")).toBeUndefined();
  });

  it("excludes unowned characters when ownedOnly is true", () => {
    const ownedSet = new Set(["hu_tao", "nahida"]);
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, ownedOnly: true },
      undefined,
      (id) => ownedSet.has(id)
    );
    expect(result.every((c) => ownedSet.has(c.id))).toBe(true);
    expect(result.length).toBe(2);
  });

  // ── Sorting ──

  it("sorts by release date ascending (oldest first)", () => {
    const result = filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      releaseSort: "asc",
    });
    // First should be oldest date; null (unreleased) goes last
    const dates = result.map((c) => c.releaseDate);
    for (let i = 1; i < dates.length; i++) {
      if (dates[i - 1] && dates[i]) {
        expect(dates[i - 1]! <= dates[i]!).toBe(true);
      }
    }
  });

  it("sorts by release date descending (newest first)", () => {
    const result = filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      releaseSort: "desc",
    });
    // First should be null (unreleased) or newest
    const released = result.filter((c) => c.releaseDate);
    for (let i = 1; i < released.length; i++) {
      expect(released[i - 1].releaseDate! >= released[i].releaseDate!).toBe(
        true
      );
    }
  });

  it("preserves input order when releaseSort is off", () => {
    const result = filterAndSortCharacters(mockCharacters, {
      ...defaultCharacterFilters,
      releaseSort: "off",
    });
    expect(result.map((c) => c.id)).toEqual(mockCharacters.map((c) => c.id));
  });

  it("sorts by tier descending (best tier first)", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, tierSort: "desc", releaseSort: "off" },
      tierAssignments
    );
    // S tier characters should come before A, which comes before Pool
    const sIdx = result.findIndex((c) => c.id === "hu_tao");
    const aIdx = result.findIndex((c) => c.id === "xingqiu");
    const poolIdx = result.findIndex((c) => c.id === "bennett");
    expect(sIdx).toBeLessThan(aIdx);
    expect(aIdx).toBeLessThan(poolIdx);
  });

  it("sorts by tier ascending (worst tier first)", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, tierSort: "asc", releaseSort: "off" },
      tierAssignments
    );
    // Pool > A > S when ascending
    const poolIdx = result.findIndex((c) => c.id === "bennett");
    const aIdx = result.findIndex((c) => c.id === "xingqiu");
    const sIdx = result.findIndex((c) => c.id === "hu_tao");
    expect(poolIdx).toBeLessThan(aIdx);
    expect(aIdx).toBeLessThan(sIdx);
  });

  it("places untiered characters after tiered ones (desc)", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, tierSort: "desc", releaseSort: "off" },
      tierAssignments
    );
    // unreleased + nahida-less tier assignments → unreleased has no tier
    const untiedIdx = result.findIndex((c) => c.id === "unreleased");
    const poolIdx = result.findIndex((c) => c.id === "bennett");
    expect(untiedIdx).toBeGreaterThan(poolIdx);
  });
});

describe("hasActiveFilters", () => {
  it("returns false when no filters active", () => {
    expect(hasActiveFilters(defaultCharacterFilters)).toBe(false);
  });

  it("returns true when any filter dimension has entries", () => {
    expect(
      hasActiveFilters({ ...defaultCharacterFilters, elements: ["Pyro"] })
    ).toBe(true);
    expect(
      hasActiveFilters({ ...defaultCharacterFilters, weaponTypes: ["Sword"] })
    ).toBe(true);
    expect(
      hasActiveFilters({ ...defaultCharacterFilters, regions: ["Liyue"] })
    ).toBe(true);
    expect(
      hasActiveFilters({ ...defaultCharacterFilters, rarities: [5] })
    ).toBe(true);
  });

  it("ignores sort settings (sorts are not filters)", () => {
    expect(
      hasActiveFilters({
        ...defaultCharacterFilters,
        tierSort: "desc",
        releaseSort: "asc",
      })
    ).toBe(false);
  });
});

describe("defaultCharacterFilters", () => {
  it("has no active filters by default", () => {
    expect(hasActiveFilters(defaultCharacterFilters)).toBe(false);
  });

  it("returns all characters unfiltered", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      defaultCharacterFilters
    );
    expect(result).toHaveLength(mockCharacters.length);
  });
});

describe("getDefaultCharacterFilters", () => {
  it("enables tier sort when tier data is available", () => {
    const filters = getDefaultCharacterFilters(true);
    expect(filters.tierSort).not.toBe("off");
  });

  it("disables tier sort when no tier data", () => {
    const filters = getDefaultCharacterFilters(false);
    expect(filters.tierSort).toBe("off");
  });

  it("returns no active dimension filters regardless of tier data", () => {
    expect(hasActiveFilters(getDefaultCharacterFilters(true))).toBe(false);
    expect(hasActiveFilters(getDefaultCharacterFilters(false))).toBe(false);
  });
});
