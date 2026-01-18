import type { Character, CharacterFilters, TierAssignment } from "@/data/types";

/**
 * Apply character filters and sorting to a list of characters.
 * Centralized logic used by both ConfigureView and CharacterView.
 */
export function filterAndSortCharacters(
  characters: Character[],
  filters: CharacterFilters,
  tierAssignments?: TierAssignment,
  tierOrder?: string[]
): Character[] {
  // Filter
  let result = characters.filter((character) => {
    if (
      filters.elements.length > 0 &&
      !filters.elements.includes(character.element)
    ) {
      return false;
    }
    if (
      filters.weaponTypes.length > 0 &&
      !filters.weaponTypes.includes(character.weaponType)
    ) {
      return false;
    }
    if (
      filters.regions.length > 0 &&
      !filters.regions.includes(character.region)
    ) {
      return false;
    }
    if (
      filters.rarities.length > 0 &&
      !filters.rarities.includes(character.rarity)
    ) {
      return false;
    }
    return true;
  });

  // Sort
  result = [...result].sort((a, b) => {
    // Tier sort (primary when enabled)
    if (filters.tierSort !== "off" && tierAssignments && tierOrder) {
      const tierA = tierAssignments[a.id];
      const tierB = tierAssignments[b.id];
      // Characters without tier go to the end
      const tierIndexA = tierA
        ? tierOrder.indexOf(tierA.tier)
        : tierOrder.length;
      const tierIndexB = tierB
        ? tierOrder.indexOf(tierB.tier)
        : tierOrder.length;
      if (tierIndexA !== tierIndexB) {
        return filters.tierSort === "asc"
          ? tierIndexB - tierIndexA // Pool -> S
          : tierIndexA - tierIndexB; // S -> Pool
      }
    }

    // Release date sort (secondary or standalone)
    if (filters.releaseSort !== "off") {
      const dateA = new Date(a.releaseDate).getTime();
      const dateB = new Date(b.releaseDate).getTime();
      return filters.releaseSort === "asc" ? dateA - dateB : dateB - dateA;
    }

    return 0;
  });

  return result;
}

/**
 * Check if any filters are active (elements, weapons, regions, or rarities).
 */
export function hasActiveFilters(filters: CharacterFilters): boolean {
  return (
    filters.elements.length > 0 ||
    filters.weaponTypes.length > 0 ||
    filters.regions.length > 0 ||
    filters.rarities.length > 0
  );
}

/**
 * Default filter state for initialization.
 */
export const defaultCharacterFilters: CharacterFilters = {
  elements: [],
  weaponTypes: [],
  regions: [],
  rarities: [],
  tierSort: "off",
  releaseSort: "desc",
};
