import { charactersById } from "@/data/constants";
import {
  type CharacterData,
  type CharacterFilters,
  type CharacterResource,
  type TierAssignment,
  tiers,
} from "@/data/types";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import type { CharacterStatsMap } from "@/lib/gameStatsLoader";

type OwnershipCheck = (id: string) => boolean;

/**
 * Check if a character matches the given filters.
 * Uses character_stats when characterStatsMap is provided (element, weaponType, region, releaseDate, rarity).
 */
function matchesFilters(
  character: CharacterResource,
  filters: CharacterFilters,
  options?: { isOwned?: OwnershipCheck; characterStatsMap?: CharacterStatsMap }
): boolean {
  const stats = options?.characterStatsMap?.[character.id];
  const meta = getCharacterDisplayMeta(character, stats);

  if (!filters.showManekin && character.id.startsWith("manekin")) {
    return false;
  }
  if (filters.ownedOnly) {
    if (!meta.releaseDate) return false;
    if (options?.isOwned && !options.isOwned(character.id)) return false;
  }
  if (
    filters.elements.length > 0 &&
    (meta.element == null || !filters.elements.includes(meta.element))
  ) {
    return false;
  }
  if (
    filters.weaponTypes.length > 0 &&
    (meta.weaponType == null || !filters.weaponTypes.includes(meta.weaponType))
  ) {
    return false;
  }
  if (
    filters.regions.length > 0 &&
    (meta.region == null || !filters.regions.includes(meta.region))
  ) {
    return false;
  }
  if (filters.rarities.length > 0 && !filters.rarities.includes(meta.rarity)) {
    return false;
  }
  return true;
}

/**
 * Create a sort comparator for characters based on filters and tier data.
 * Uses character_stats for release date when characterStatsMap is provided.
 */
function createSortComparator(
  filters: CharacterFilters,
  tierAssignments?: TierAssignment,
  characterStatsMap?: CharacterStatsMap
): (a: CharacterResource, b: CharacterResource) => number {
  return (a, b) => {
    if (filters.tierSort !== "off" && tierAssignments) {
      const tierA = tierAssignments[a.id];
      const tierB = tierAssignments[b.id];
      const tierIndexA = tierA ? tiers.indexOf(tierA.tier) : tiers.length;
      const tierIndexB = tierB ? tiers.indexOf(tierB.tier) : tiers.length;
      if (tierIndexA !== tierIndexB) {
        return filters.tierSort === "asc"
          ? tierIndexB - tierIndexA
          : tierIndexA - tierIndexB;
      }
    }

    if (filters.releaseSort !== "off") {
      const dateA = characterStatsMap?.[a.id]?.releaseDate;
      const dateB = characterStatsMap?.[b.id]?.releaseDate;
      const timeA = dateA
        ? new Date(dateA).getTime()
        : Number.POSITIVE_INFINITY;
      const timeB = dateB
        ? new Date(dateB).getTime()
        : Number.POSITIVE_INFINITY;
      return filters.releaseSort === "asc" ? timeA - timeB : timeB - timeA;
    }

    return 0;
  };
}

export type FilterAndSortCharactersOptions = {
  tierAssignments?: TierAssignment;
  isOwned?: OwnershipCheck;
  characterStatsMap?: CharacterStatsMap;
};

/**
 * Apply character filters and sorting to a list of static Character data.
 * Pass characterStatsMap when available so element/weaponType/region/releaseDate/rarity come from stats.
 */
export function filterAndSortCharacters(
  characters: CharacterResource[],
  filters: CharacterFilters,
  options?: FilterAndSortCharactersOptions
): CharacterResource[] {
  const filtered = characters.filter((c) =>
    matchesFilters(c, filters, {
      isOwned: options?.isOwned,
      characterStatsMap: options?.characterStatsMap,
    })
  );
  return [...filtered].sort(
    createSortComparator(
      filters,
      options?.tierAssignments,
      options?.characterStatsMap
    )
  );
}

/**
 * Apply character filters and sorting to a list of CharacterData (account data).
 * Pass characterStatsMap when available for filter/sort by stats metadata.
 */
export function filterAndSortCharacterData(
  characterData: CharacterData[],
  filters: CharacterFilters,
  options?: FilterAndSortCharactersOptions
): CharacterData[] {
  const filtered = characterData.filter((cd) => {
    const character = charactersById[cd.key];
    return (
      character &&
      matchesFilters(character, filters, {
        isOwned: options?.isOwned,
        characterStatsMap: options?.characterStatsMap,
      })
    );
  });

  const comparator = createSortComparator(
    filters,
    options?.tierAssignments,
    options?.characterStatsMap
  );
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
  ownedOnly: false,
  showManekin: false,
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
