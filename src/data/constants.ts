import type {
  Element,
  MainStat,
  Character,
  Weapon,
  ArtifactSet,
  ArtifactHalfSet,
  ElementResource,
  WeaponTypeResource,
} from "./types";
import {
  artifacts,
  weapons,
  artifactHalfSets,
  characters,
  elementResources as elementResources,
  weaponTypeResources as weaponResources,
} from "./resources";

// Function to get goblet pool with character's elemental damage bonus
export const getGobletPool = (element?: Element): readonly MainStat[] => {
  if (!element) {
    return statPools.goblet;
  }

  const elementStat = `${element.toLowerCase()}%` as MainStat;
  return ["atk%", "hp%", "def%", "em", elementStat, "phys%"] as const;
};

export const elementalMainStats: MainStat[] = [
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
];

export const statPools = {
  flower: ["hp"] as const,
  plume: ["atk"] as const,
  sands: ["atk%", "hp%", "def%", "em", "er"] as const,
  goblet: [
    "atk%",
    "hp%",
    "def%",
    "em",
    "pyro%",
    "hydro%",
    "anemo%",
    "electro%",
    "dendro%",
    "cryo%",
    "geo%",
    "phys%",
  ] as const,
  circlet: ["cr", "cd", "atk%", "hp%", "def%", "em", "heal%"] as const,
  substat: [
    "cr",
    "cd",
    "atk%",
    "hp%",
    "def%",
    "em",
    "er",
    "atk",
    "hp",
    "def",
  ] as const,
};

export const statPoolWithWeights = {
  flower: { hp: 1 },
  plume: { atk: 1 },
  sands: { "atk%": 26.66, "hp%": 26.66, "def%": 26.66, em: 10, er: 10 },
  goblet: {
    "atk%": 21.25,
    "hp%": 21.25,
    "def%": 20,
    em: 2.5,
    "pyro%": 5,
    "hydro%": 5,
    "anemo%": 5,
    "electro%": 5,
    "dendro%": 5,
    "cryo%": 5,
    "geo%": 5,
    "phys%": 5,
  },
  circlet: {
    cr: 10,
    cd: 10,
    "atk%": 22,
    "hp%": 22,
    "def%": 22,
    em: 4,
    "heal%": 10,
  },
  substat: {
    cr: 7.5,
    cd: 7.5,
    "atk%": 10,
    "hp%": 10,
    "def%": 10,
    em: 10,
    er: 10,
    atk: 15,
    hp: 15,
    def: 15,
  },
};

const createRecord = <Item, Key extends PropertyKey>(
  items: readonly Item[],
  getKey: (item: Item) => Key,
): Record<Key, Item> => {
  return items.reduce<Record<Key, Item>>(
    (acc, item) => {
      acc[getKey(item)] = item;
      return acc;
    },
    {} as Record<Key, Item>,
  );
};

const freezeRecord = <MapType extends Record<PropertyKey, unknown>>(
  record: MapType,
) => Object.freeze(record) as Readonly<MapType>;

export const charactersById = freezeRecord(
  createRecord<Character, Character["id"]>(
    characters,
    (character) => character.id,
  ),
);

export const artifactsById = freezeRecord(
  createRecord<ArtifactSet, ArtifactSet["id"]>(
    artifacts,
    (artifact) => artifact.id,
  ),
);

export const weaponsById = freezeRecord(
  createRecord<Weapon, Weapon["id"]>(weapons, (weapon) => weapon.id),
);

export const artifactHalfSetsById = freezeRecord(
  createRecord<ArtifactHalfSet, ArtifactHalfSet["id"]>(
    artifactHalfSets,
    (halfSet) => halfSet.id,
  ),
);

export const elementResourcesByName = freezeRecord(
  createRecord<ElementResource, ElementResource["name"]>(
    elementResources,
    (element) => element.name,
  ),
);

export const weaponResourcesByName = freezeRecord(
  createRecord<WeaponTypeResource, WeaponTypeResource["name"]>(
    weaponResources,
    (weapon) => weapon.name,
  ),
);

/**
 * Sorts items by rarity in descending order.
 * Since the original lists (resources.ts) are ordered by release date descending,
 * and Array.prototype.sort is stable in modern JS environments,
 * this results in Rarity Descending > Release Date Descending.
 */
function sortItemsByRarityDesc<T extends { rarity?: number }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0));
}

// Sorted lists (Rarity Descending -> Release Date Descending)
export const sortedCharacters = [...characters].sort((a, b) => {
  const getRarity = (c: Character) => {
    if (c.id.startsWith("traveler")) return 3;
    return c.rarity;
  };
  return getRarity(b) - getRarity(a);
});
export const sortedWeapons = sortItemsByRarityDesc(weapons);
export const sortedArtifacts = sortItemsByRarityDesc(artifacts);

export const sortedWeaponSecondaryStats = Array.from(
  new Set(weapons.map((w) => w.secondaryStat)),
).sort();
