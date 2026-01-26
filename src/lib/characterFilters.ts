import { charactersById } from "@/data/constants";
import {
  type Character,
  type CharacterData,
  type CharacterFilters,
  type TierAssignment,
  tiers,
} from "@/data/types";

/**
 * Check if a character matches the given filters.
 */
function matchesFilters(
  character: Character,
  filters: CharacterFilters
): boolean {
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
}

/**
 * Create a sort comparator for characters based on filters and tier data.
 */
function createSortComparator(
  filters: CharacterFilters,
  tierAssignments?: TierAssignment
): (a: Character, b: Character) => number {
  return (a, b) => {
    // Tier sort (primary when enabled)
    if (filters.tierSort !== "off" && tierAssignments) {
      const tierA = tierAssignments[a.id];
      const tierB = tierAssignments[b.id];
      // Characters without tier go to the end
      const tierIndexA = tierA ? tiers.indexOf(tierA.tier) : tiers.length;
      const tierIndexB = tierB ? tiers.indexOf(tierB.tier) : tiers.length;
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
  };
}

/**
 * Apply character filters and sorting to a list of static Character data.
 * Used by ConfigureView which operates on the full character list.
 */
export function filterAndSortCharacters(
  characters: Character[],
  filters: CharacterFilters,
  tierAssignments?: TierAssignment
): Character[] {
  const filtered = characters.filter((c) => matchesFilters(c, filters));
  return [...filtered].sort(createSortComparator(filters, tierAssignments));
}

/**
 * Apply character filters and sorting to a list of CharacterData (account data).
 * Used by CharacterView which operates on imported account characters.
 * Filters and sorts based on static Character metadata without wasteful conversions.
 */
export function filterAndSortCharacterData(
  characterData: CharacterData[],
  filters: CharacterFilters,
  tierAssignments?: TierAssignment
): CharacterData[] {
  // Filter based on static character metadata
  const filtered = characterData.filter((cd) => {
    const character = charactersById[cd.key];
    return character && matchesFilters(character, filters);
  });

  // Sort using Character metadata for comparison
  const comparator = createSortComparator(filters, tierAssignments);
  return [...filtered].sort((a, b) => {
    const charA = charactersById[a.key];
    const charB = charactersById[b.key];
    if (!charA || !charB) return 0;
    return comparator(charA, charB);
  });
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

/**
 * Get default filters with tier sort enabled if tier data is available.
 */
export function getDefaultCharacterFilters(
  hasTierData: boolean
): CharacterFilters {
  return {
    ...defaultCharacterFilters,
    tierSort: hasTierData ? "desc" : "off",
  };
}
