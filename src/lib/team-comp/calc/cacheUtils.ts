export type CacheKey = string;

export function makeCacheKey(
  onFieldCharId: string,
  excludeKeys?: Set<string>
): CacheKey {
  if (!excludeKeys || excludeKeys.size === 0) return onFieldCharId;
  const sorted = [...excludeKeys].sort();
  return `${onFieldCharId}\0${sorted.join("\0")}`;
}
