import { betaEnabled } from "./betaState";
import { tiers } from "./enums";
import type { CharacterStatsMap } from "./gameStatsLoader";
import {
  artifactHalfSets,
  artifacts,
  characters,
  elementResources,
  weaponTypeResources as weaponResources,
  weapons,
} from "./resources";
import { betaArtifacts, betaCharacters, betaWeapons } from "./resources_beta";
import type {
  ArtifactHalfSet,
  ArtifactSetResource,
  CharacterResource,
  ElementResource,
  TierAssignment,
  WeaponResource,
  WeaponTypeResource,
} from "./types";

// Beta-only entries are spliced in FIRST so stable rarity sorts rank them
// above released same-rarity peers. Released wins on ID collision.
export const allCharacters = betaEnabled()
  ? [
      ...betaCharacters.filter((b) => !characters.some((c) => c.id === b.id)),
      ...characters,
    ]
  : characters;
export const allWeapons = betaEnabled()
  ? [
      ...betaWeapons.filter((b) => !weapons.some((w) => w.id === b.id)),
      ...weapons,
    ]
  : weapons;

// Beta artifact IDs that should render LAST within their rarity bucket, after
// official sets — used for scrapped/never-released sets (e.g. Glacier and
// Snowfield) so they don't push genuine upcoming sets down in the archive.
const RENDER_LAST_BETA_ARTIFACT_IDS = new Set<string>([
  "glacier_and_snowfield",
]);
export const allArtifacts = betaEnabled()
  ? [
      ...betaArtifacts.filter(
        (b) =>
          !RENDER_LAST_BETA_ARTIFACT_IDS.has(b.id) &&
          !artifacts.some((a) => a.id === b.id)
      ),
      ...artifacts,
      ...betaArtifacts.filter(
        (b) =>
          RENDER_LAST_BETA_ARTIFACT_IDS.has(b.id) &&
          !artifacts.some((a) => a.id === b.id)
      ),
    ]
  : artifacts;

/** Hand-picked half-set IDs shown first, then remaining IDs sorted alphabetically. */
const pinnedHalfSetIds: string[] = [
  "atk%-18",
  "hp%-20",
  "def%-30",
  "em-80",
  "er-20",
  "cr-12",
  "pyro%-15",
  "hydro%-15",
  "electro%-15",
  "cryo%-15",
  "anemo%-15",
  "dendro%-15",
  "geo%-15",
  "phys%-25",
  "na-ca-dmg%-15",
  "plunge-dmg%-25",
  "skill-dmg%-20",
  "burst-dmg%-20",
  "nightsoul-dmg%-15",
  "nightsoul-energy-6",
];
export const allHalfSetIds: readonly string[] = Object.freeze([
  ...pinnedHalfSetIds,
  ...artifactHalfSets
    .map((hs) => hs.id)
    .filter((id) => !pinnedHalfSetIds.includes(id))
    .sort(),
]);

/**
 * Half sets in the raw source order (resources.ts). Use this when encoding
 * stability matters — new half sets are prepended, so existing indices into
 * this list don't shift (mirrors `allCharacters` / `allArtifacts` / `allWeapons`).
 */
export const allHalfSets: readonly ArtifactHalfSet[] = artifactHalfSets;

const createRecord = <Item, Key extends PropertyKey>(
  items: readonly Item[],
  getKey: (item: Item) => Key
): Record<Key, Item> => {
  return items.reduce<Record<Key, Item>>(
    (acc, item) => {
      acc[getKey(item)] = item;
      return acc;
    },
    {} as Record<Key, Item>
  );
};
const freezeRecord = <MapType extends Record<PropertyKey, unknown>>(
  record: MapType
) => Object.freeze(record) as Readonly<MapType>;

export const charactersById = freezeRecord(
  createRecord<CharacterResource, CharacterResource["id"]>(
    allCharacters,
    (character) => character.id
  )
);

export const artifactsById = freezeRecord(
  createRecord<ArtifactSetResource, ArtifactSetResource["id"]>(
    allArtifacts,
    (artifact) => artifact.id
  )
);

export const weaponsById = freezeRecord(
  createRecord<WeaponResource, WeaponResource["id"]>(
    allWeapons,
    (weapon) => weapon.id
  )
);

export const artifactHalfSetsById = freezeRecord(
  createRecord<ArtifactHalfSet, ArtifactHalfSet["id"]>(
    artifactHalfSets,
    (halfSet) => halfSet.id
  )
);

export const artifactIdToHalfSetId = freezeRecord(
  artifactHalfSets.reduce<Record<string, string>>((acc, halfSet) => {
    for (const setId of halfSet.setIds) {
      acc[setId] = halfSet.id;
    }
    return acc;
  }, {})
);

export const elementResourcesByName = freezeRecord(
  createRecord<ElementResource, ElementResource["name"]>(
    elementResources,
    (element) => element.name
  )
);

export const weaponResourcesByName = freezeRecord(
  createRecord<WeaponTypeResource, WeaponTypeResource["name"]>(
    weaponResources,
    (weapon) => weapon.name
  )
);

/**
 * Sorts items by rarity in descending order.
 * Since the original lists (resources.ts) are ordered by release date descending,
 * and Array.prototype.sort is stable in modern JS environments,
 * this results in Rarity Descending > Release Date Descending.
 */
function sortItemsByRarityDesc<T extends { rarity?: number }>(
  items: readonly T[]
): T[] {
  return [...items].sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0));
}

/**
 * Character class rank for sorting: regular 5★ > regular 4★ > traveler > manekin/manekina.
 * Lower value = higher priority.
 */
function getCharacterClassRank(id: string, rarity: number): number {
  if (id.startsWith("manekin")) return 3;
  if (id.startsWith("traveler")) return 2;
  return rarity >= 5 ? 0 : 1;
}

/** Characters sorted by optional tier, then character class rank, then release date descending. */
export function getSortedCharacters(
  characterStats: CharacterStatsMap | null,
  tierAssignments?: TierAssignment | null
): CharacterResource[] {
  const list = [...allCharacters];
  if (!characterStats) return list;
  return list.sort((a, b) => {
    // 1. Tier rank (S=0, A=1, …, Pool=5, unassigned=last)
    if (tierAssignments) {
      const tierA = tierAssignments[a.id]?.tier;
      const tierB = tierAssignments[b.id]?.tier;
      const rankA = tierA ? tiers.indexOf(tierA) : tiers.length;
      const rankB = tierB ? tiers.indexOf(tierB) : tiers.length;
      if (rankA !== rankB) return rankA - rankB;
    }
    // 2. Character class: 5★ > 4★ > traveler > manekin/manekina
    const rarityA = characterStats[a.id]?.rarity ?? a.rarity;
    const rarityB = characterStats[b.id]?.rarity ?? b.rarity;
    const classA = getCharacterClassRank(a.id, rarityA);
    const classB = getCharacterClassRank(b.id, rarityB);
    if (classA !== classB) return classA - classB;
    // 3. Within same class, sort by release date descending
    const dateA = characterStats[a.id]?.releaseDate ?? "";
    const dateB = characterStats[b.id]?.releaseDate ?? "";
    if (!dateA && !dateB) return 0;
    if (!dateA) return -1;
    if (!dateB) return 1;
    return dateB.localeCompare(dateA);
  });
}

export const sortedWeapons = sortItemsByRarityDesc(allWeapons);
export const sortedArtifacts = sortItemsByRarityDesc(allArtifacts);
export const sortedHalfSets: readonly ArtifactHalfSet[] = allHalfSetIds.map(
  (id) => artifactHalfSetsById[id]
);
