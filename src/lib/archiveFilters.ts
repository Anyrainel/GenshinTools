function normalizeArchiveSearch(searchQuery: string): string {
  return searchQuery.trim();
}

function getArchiveFilterPredicate<T>(
  searchQuery: string,
  matchesSearch: (item: T, normalizedSearch: string) => boolean,
  matchesChipFilters: (item: T) => boolean
): (item: T) => boolean {
  const normalizedSearch = normalizeArchiveSearch(searchQuery);
  return normalizedSearch.length > 0
    ? (item) => matchesSearch(item, normalizedSearch)
    : matchesChipFilters;
}

export function isArchiveSearchActive(searchQuery: string): boolean {
  return normalizeArchiveSearch(searchQuery).length > 0;
}

export function itemMatchesArchiveFilterScope<T>(
  item: T,
  searchQuery: string,
  matchesSearch: (item: T, normalizedSearch: string) => boolean,
  matchesChipFilters: (item: T) => boolean
): boolean {
  return getArchiveFilterPredicate(
    searchQuery,
    matchesSearch,
    matchesChipFilters
  )(item);
}

export function filterArchiveItems<T>(
  items: readonly T[],
  searchQuery: string,
  matchesSearch: (item: T, normalizedSearch: string) => boolean,
  matchesChipFilters: (item: T) => boolean
): T[] {
  return items.filter(
    getArchiveFilterPredicate(searchQuery, matchesSearch, matchesChipFilters)
  );
}
