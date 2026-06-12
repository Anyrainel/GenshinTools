import { describe, expect, it } from "vitest";
import type { CharacterStatsMap } from "@/data/gameStatsLoader";
import { getCharacterDisplayMeta } from "@/data/gameStatsLoader";
import type { CharacterResource, TierAssignment } from "@/data/types";
import {
  defaultCharacterFilters,
  filterAndSortCharacters,
  getDefaultCharacterFilters,
  hasActiveFilters,
} from "@/lib/characterFilters";

const mockCharacters: CharacterResource[] = [
  { id: "hu_tao", rarity: 5, imagePath: "" },
  { id: "xingqiu", rarity: 4, imagePath: "" },
  { id: "nahida", rarity: 5, imagePath: "" },
  { id: "bennett", rarity: 4, imagePath: "" },
  { id: "unreleased", rarity: 5, imagePath: "" },
  { id: "manekin_pyro", rarity: 5, imagePath: "" },
  { id: "manekina_hydro", rarity: 5, imagePath: "" },
];

const mockCharacterStats: CharacterStatsMap = {
  hu_tao: {
    rarity: 5,
    element: "Pyro",
    weaponType: "Polearm",
    region: "Liyue",
    releaseDate: "2021-03-02",
    levels: {},
  },
  xingqiu: {
    rarity: 4,
    element: "Hydro",
    weaponType: "Sword",
    region: "Liyue",
    releaseDate: "2020-09-28",
    levels: {},
  },
  nahida: {
    rarity: 5,
    element: "Dendro",
    weaponType: "Catalyst",
    region: "Sumeru",
    releaseDate: "2022-11-02",
    levels: {},
  },
  bennett: {
    rarity: 4,
    element: "Pyro",
    weaponType: "Sword",
    region: "Mondstadt",
    releaseDate: "2020-09-28",
    levels: {},
  },
  unreleased: {
    rarity: 5,
    element: "Pyro",
    weaponType: "Claymore",
    region: "Natlan",
    releaseDate: "",
    levels: {},
  },
  manekin_pyro: {
    rarity: 5,
    element: "Pyro",
    weaponType: "Sword",
    region: "None",
    releaseDate: "2026-01-01",
    levels: {},
  },
  manekina_hydro: {
    rarity: 5,
    element: "Hydro",
    weaponType: "Sword",
    region: "None",
    releaseDate: "2026-01-01",
    levels: {},
  },
};

const tierAssignments: TierAssignment = {
  hu_tao: { tier: "S", position: 0 },
  nahida: { tier: "S", position: 1 },
  xingqiu: { tier: "A", position: 0 },
  bennett: { tier: "Pool", position: 0 },
};

const options = { characterStatsMap: mockCharacterStats };

// Non-manekin characters count (default filters hide manekin)
const nonManekinCount = mockCharacters.filter(
  (c) => !c.id.startsWith("manekin")
).length;

describe("filterAndSortCharacters", () => {
  it("returns all non-manekin characters with default filters", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      defaultCharacterFilters,
      options
    );
    expect(result).toHaveLength(nonManekinCount);
  });

  it("does not mutate the input array", () => {
    const copy = [...mockCharacters];
    filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, releaseSort: "asc" },
      options
    );
    expect(mockCharacters).toEqual(copy);
  });

  // ── Filtering ──

  it("filters by element", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, elements: ["Pyro"] },
      options
    );
    expect(
      result.every(
        (c) =>
          getCharacterDisplayMeta(c, mockCharacterStats[c.id]).element ===
          "Pyro"
      )
    ).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by weapon type", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, weaponTypes: ["Sword"] },
      options
    );
    expect(
      result.every(
        (c) =>
          getCharacterDisplayMeta(c, mockCharacterStats[c.id]).weaponType ===
          "Sword"
      )
    ).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by region", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, regions: ["Liyue"] },
      options
    );
    expect(
      result.every(
        (c) =>
          getCharacterDisplayMeta(c, mockCharacterStats[c.id]).region ===
          "Liyue"
      )
    ).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by rarity", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, rarities: [5] },
      options
    );
    expect(result.every((c) => c.rarity === 5)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by faction", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, factions: ["None"] },
      options
    );
    expect(result).toHaveLength(nonManekinCount);
  });

  it("filters by healer utility", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, utilities: ["healer"] },
      options
    );
    expect(result.map((c) => c.id)).toEqual(["xingqiu", "bennett"]);
  });

  it("filters by shielder utility", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, utilities: ["shielder"] },
      options
    );
    expect(result).toHaveLength(0);
  });

  it("filters by other utility", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, utilities: ["other"] },
      options
    );
    expect(result.find((c) => c.id === "bennett")).toBeUndefined();
    expect(result).toHaveLength(nonManekinCount - 2);
  });

  it("combines multiple filters with AND logic", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, elements: ["Pyro"], rarities: [5] },
      options
    );
    expect(result).toHaveLength(2); // hu_tao + unreleased
    expect(
      result.every(
        (c) =>
          getCharacterDisplayMeta(c, mockCharacterStats[c.id]).element ===
            "Pyro" && c.rarity === 5
      )
    ).toBe(true);
  });

  it("returns empty when filters exclude everything", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, elements: ["Geo"] },
      options
    );
    expect(result).toHaveLength(0);
  });

  // ── ownedOnly filter ──

  it("includes unreleased characters when ownedOnly is true and they are owned", () => {
    // Ownership is the source of truth — if the user owns an unreleased
    // character (e.g. just released from beta), they should still show up.
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, ownedOnly: true },
      { ...options, isOwned: () => true }
    );
    expect(result.find((c) => c.id === "unreleased")).toBeDefined();
  });

  it("excludes unowned characters when ownedOnly is true", () => {
    const ownedSet = new Set(["hu_tao", "nahida"]);
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, ownedOnly: true },
      { ...options, isOwned: (id: string) => ownedSet.has(id) }
    );
    expect(result.every((c) => ownedSet.has(c.id))).toBe(true);
    expect(result.length).toBe(2);
  });

  // ── showManekin filter ──

  it("hides manekin characters by default (showManekin: false)", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      defaultCharacterFilters,
      options
    );
    expect(result.find((c) => c.id === "manekin_pyro")).toBeUndefined();
    expect(result.find((c) => c.id === "manekina_hydro")).toBeUndefined();
    expect(result).toHaveLength(nonManekinCount);
  });

  it("includes manekin characters when showManekin is true", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, showManekin: true },
      options
    );
    expect(result.find((c) => c.id === "manekin_pyro")).toBeDefined();
    expect(result.find((c) => c.id === "manekina_hydro")).toBeDefined();
    expect(result).toHaveLength(mockCharacters.length);
  });

  it("applies element filter together with showManekin", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, showManekin: true, elements: ["Pyro"] },
      options
    );
    expect(result.find((c) => c.id === "manekin_pyro")).toBeDefined();
    expect(result.find((c) => c.id === "manekina_hydro")).toBeUndefined();
  });

  it("showManekin false takes priority over element filter", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, showManekin: false, elements: ["Pyro"] },
      options
    );
    expect(result.find((c) => c.id === "manekin_pyro")).toBeUndefined();
    expect(result.find((c) => c.id === "hu_tao")).toBeDefined();
  });

  // ── Sorting ──

  it("sorts by release date ascending (oldest first)", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, releaseSort: "asc" },
      options
    );
    const dates = result.map(
      (c) => getCharacterDisplayMeta(c, mockCharacterStats[c.id]).releaseDate
    );
    for (let i = 1; i < dates.length; i++) {
      if (dates[i - 1] && dates[i]) {
        expect(dates[i - 1]! <= dates[i]!).toBe(true);
      }
    }
  });

  it("sorts by release date descending (newest first)", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, releaseSort: "desc" },
      options
    );
    const released = result.filter(
      (c) => getCharacterDisplayMeta(c, mockCharacterStats[c.id]).releaseDate
    );
    for (let i = 1; i < released.length; i++) {
      const prev = getCharacterDisplayMeta(
        released[i - 1],
        mockCharacterStats[released[i - 1].id]
      ).releaseDate;
      const curr = getCharacterDisplayMeta(
        released[i],
        mockCharacterStats[released[i].id]
      ).releaseDate;
      expect(prev! >= curr!).toBe(true);
    }
  });

  it("preserves input order when releaseSort is off", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, releaseSort: "off" },
      options
    );
    const expectedIds = mockCharacters
      .filter((c) => !c.id.startsWith("manekin"))
      .map((c) => c.id);
    expect(result.map((c) => c.id)).toEqual(expectedIds);
  });

  it("sorts by tier descending (best tier first)", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      { ...defaultCharacterFilters, tierSort: "desc", releaseSort: "off" },
      { ...options, tierAssignments }
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
      { ...options, tierAssignments }
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
      { ...options, tierAssignments }
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
      hasActiveFilters({ ...defaultCharacterFilters, factions: ["None"] })
    ).toBe(true);
    expect(
      hasActiveFilters({ ...defaultCharacterFilters, utilities: ["healer"] })
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

  it("defaults showManekin to false", () => {
    expect(defaultCharacterFilters.showManekin).toBe(false);
  });

  it("returns all non-manekin characters with defaults", () => {
    const result = filterAndSortCharacters(
      mockCharacters,
      defaultCharacterFilters,
      { characterStatsMap: mockCharacterStats }
    );
    expect(result).toHaveLength(nonManekinCount);
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

describe("archive manekin visibility (search-gated)", () => {
  // Mirrors the archive page logic: manekin characters are hidden when
  // search is empty, but shown when the user is actively searching.
  function archiveFilter(
    characters: CharacterResource[],
    searchQuery: string
  ): CharacterResource[] {
    const hasSearch = searchQuery.trim().length > 0;
    return characters.filter((c) => {
      if (!hasSearch && c.id.startsWith("manekin")) return false;
      return true;
    });
  }

  it("hides manekin characters when search is empty", () => {
    const result = archiveFilter(mockCharacters, "");
    expect(result.find((c) => c.id === "manekin_pyro")).toBeUndefined();
    expect(result.find((c) => c.id === "manekina_hydro")).toBeUndefined();
    expect(result).toHaveLength(nonManekinCount);
  });

  it("hides manekin characters when search is only whitespace", () => {
    const result = archiveFilter(mockCharacters, "   ");
    expect(result.find((c) => c.id === "manekin_pyro")).toBeUndefined();
    expect(result.find((c) => c.id === "manekina_hydro")).toBeUndefined();
  });

  it("shows manekin characters when search is non-empty", () => {
    const result = archiveFilter(mockCharacters, "manekin");
    expect(result.find((c) => c.id === "manekin_pyro")).toBeDefined();
    expect(result.find((c) => c.id === "manekina_hydro")).toBeDefined();
  });

  it("does not hide non-manekin characters regardless of search", () => {
    const noSearch = archiveFilter(mockCharacters, "");
    const withSearch = archiveFilter(mockCharacters, "hu");
    expect(noSearch.find((c) => c.id === "hu_tao")).toBeDefined();
    expect(withSearch.find((c) => c.id === "hu_tao")).toBeDefined();
  });
});
