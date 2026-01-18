import type { Character, CharacterFilters, TierAssignment } from "@/data/types";
import {
  defaultCharacterFilters,
  filterAndSortCharacters,
  hasActiveFilters,
} from "@/lib/characterFilters";

// Mock character data
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
];

describe("characterFilters", () => {
  describe("filterAndSortCharacters", () => {
    it("returns all characters when no filters active", () => {
      const result = filterAndSortCharacters(
        mockCharacters,
        defaultCharacterFilters
      );
      expect(result.length).toBe(4);
    });

    it("filters by element", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: ["Pyro"],
      };
      const result = filterAndSortCharacters(mockCharacters, filters);
      expect(result.length).toBe(2);
      expect(result.every((c) => c.element === "Pyro")).toBe(true);
    });

    it("filters by weapon type", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        weaponTypes: ["Sword"],
      };
      const result = filterAndSortCharacters(mockCharacters, filters);
      expect(result.length).toBe(2);
      expect(result.every((c) => c.weaponType === "Sword")).toBe(true);
    });

    it("filters by region", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        regions: ["Liyue"],
      };
      const result = filterAndSortCharacters(mockCharacters, filters);
      expect(result.length).toBe(2);
      expect(result.every((c) => c.region === "Liyue")).toBe(true);
    });

    it("filters by rarity", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        rarities: [5],
      };
      const result = filterAndSortCharacters(mockCharacters, filters);
      expect(result.length).toBe(2);
      expect(result.every((c) => c.rarity === 5)).toBe(true);
    });

    it("combines multiple filters", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: ["Pyro"],
        rarities: [5],
      };
      const result = filterAndSortCharacters(mockCharacters, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("hu_tao");
    });

    it("sorts by release date ascending", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        releaseSort: "asc",
      };
      const result = filterAndSortCharacters(mockCharacters, filters);
      // Oldest first (2020-09-28 characters first)
      expect(result[0].releaseDate).toBe("2020-09-28");
    });

    it("sorts by release date descending", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        releaseSort: "desc",
      };
      const result = filterAndSortCharacters(mockCharacters, filters);
      // Newest first (Nahida 2022-11-02)
      expect(result[0].id).toBe("nahida");
    });

    it("does not sort when releaseSort is off", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        releaseSort: "off",
      };
      const result = filterAndSortCharacters(mockCharacters, filters);
      // Order should be preserved (original order)
      expect(result[0].id).toBe("hu_tao");
    });

    it("sorts by tier when tier data provided", () => {
      const tierAssignments: TierAssignment = {
        hu_tao: { tier: "S", position: 0 },
        nahida: { tier: "S", position: 1 },
        xingqiu: { tier: "A", position: 0 },
        bennett: { tier: "Pool", position: 0 },
      };
      const tierOrder = ["S", "A", "B", "C", "D", "Pool"];
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        tierSort: "desc",
        releaseSort: "off",
      };

      const result = filterAndSortCharacters(
        mockCharacters,
        filters,
        tierAssignments,
        tierOrder
      );

      // S tier first when desc
      expect(result[0].id).toBe("hu_tao");
    });
  });

  describe("hasActiveFilters", () => {
    it("returns false when no filters active", () => {
      expect(hasActiveFilters(defaultCharacterFilters)).toBe(false);
    });

    it("returns true when elements filter active", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        elements: ["Pyro"],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns true when weaponTypes filter active", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        weaponTypes: ["Sword"],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns true when regions filter active", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        regions: ["Liyue"],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns true when rarities filter active", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        rarities: [5],
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("ignores sort settings", () => {
      const filters: CharacterFilters = {
        ...defaultCharacterFilters,
        tierSort: "desc",
        releaseSort: "asc",
      };
      // Sorts don't count as "active filters"
      expect(hasActiveFilters(filters)).toBe(false);
    });
  });

  describe("defaultCharacterFilters", () => {
    it("has empty filter arrays", () => {
      expect(defaultCharacterFilters.elements).toEqual([]);
      expect(defaultCharacterFilters.weaponTypes).toEqual([]);
      expect(defaultCharacterFilters.regions).toEqual([]);
      expect(defaultCharacterFilters.rarities).toEqual([]);
    });

    it("has tierSort off by default", () => {
      expect(defaultCharacterFilters.tierSort).toBe("off");
    });

    it("has releaseSort desc by default", () => {
      expect(defaultCharacterFilters.releaseSort).toBe("desc");
    });
  });
});
