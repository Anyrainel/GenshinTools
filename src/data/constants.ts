import type { CharacterStatsMap, WeaponStatsMap } from "@/lib/gameStatsLoader";
import {
  artifactHalfSets,
  artifacts,
  characters,
  elementResources,
  weaponTypeResources as weaponResources,
  weapons,
} from "./resources";
import type {
  ArtifactHalfSet,
  ArtifactSetResource,
  CharacterResource,
  Element,
  ElementResource,
  MainStat,
  SubStat,
  TierAssignment,
  WeaponResource,
  WeaponTypeResource,
} from "./types";
import { tiers } from "./types";

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

// Max substat roll values per rarity (from ArtifactScore.md documentation)
export const maxSubstatRolls = {
  5: {
    hp: 298.75,
    atk: 19.45,
    def: 23.15,
    "hp%": 5.83,
    "atk%": 5.83,
    "def%": 7.29,
    em: 23.31,
    er: 6.48,
    cr: 3.89,
    cd: 7.77,
  },
  4: {
    hp: 239.0,
    atk: 15.56,
    def: 18.52,
    "hp%": 4.66,
    "atk%": 4.66,
    "def%": 5.83,
    em: 18.65,
    er: 5.18,
    cr: 3.11,
    cd: 6.22,
  },
} as const;

/** Multiplier for average substat roll vs max roll (~0.85). Use for roll count: value / (AVERAGE_ROLL_MULTIPLIER * maxRoll). */
export const AVERAGE_ROLL_MULTIPLIER = 0.85;

/**
 * Average 5★ substat roll values in StatSheet-internal format (pct stats ÷ 100).
 * Derived from maxSubstatRolls[5] × AVERAGE_ROLL_MULTIPLIER.
 * Used for marginal-gain analysis (one roll ≈ this delta).
 */
const FLAT_SUBSTATS: ReadonlySet<string> = new Set(["hp", "atk", "def", "em"]);
export const AVG_SUBSTAT_ROLL: Record<SubStat, number> = Object.fromEntries(
  Object.entries(maxSubstatRolls[5]).map(([stat, maxVal]) => {
    const avg = maxVal * AVERAGE_ROLL_MULTIPLIER;
    return [stat, FLAT_SUBSTATS.has(stat) ? avg : avg / 100];
  })
) as Record<SubStat, number>;

// ─── Main stat values at max level ───

/**
 * 5★ artifact main stat values at Lv.20.
 * Percentage stats in decimal form (0.466 = 46.6%) to match StatSheet internals.
 */
export const MAIN_STAT_VALUES_5STAR: Record<string, number> = {
  hp: 4780,
  atk: 311,
  "hp%": 0.466,
  "atk%": 0.466,
  "def%": 0.583,
  em: 186.5,
  er: 0.518,
  cr: 0.311,
  cd: 0.622,
  "pyro%": 0.466,
  "hydro%": 0.466,
  "cryo%": 0.466,
  "electro%": 0.466,
  "anemo%": 0.466,
  "geo%": 0.466,
  "dendro%": 0.466,
  "phys%": 0.583,
  "heal%": 0.359,
};

/** 4★ artifact main stat values at Lv.16. Percentage stats in decimal form. */
export const MAIN_STAT_VALUES_4STAR: Record<string, number> = {
  hp: 3571,
  atk: 232,
  "hp%": 0.348,
  "atk%": 0.348,
  "def%": 0.435,
  em: 139.3,
  er: 0.387,
  cr: 0.232,
  cd: 0.464,
  "pyro%": 0.348,
  "hydro%": 0.348,
  "cryo%": 0.348,
  "electro%": 0.348,
  "anemo%": 0.348,
  "geo%": 0.348,
  "dendro%": 0.348,
  "phys%": 0.435,
  "heal%": 0.268,
};

/**
 * Get the max-level main stat value in display form (46.6 for ATK%, 311 for flat ATK).
 * Use for scoring and display; for StatSheet construction use the decimal tables directly.
 */
export function getMainStatValue(stat: MainStat, rarity: number): number {
  const table = rarity === 4 ? MAIN_STAT_VALUES_4STAR : MAIN_STAT_VALUES_5STAR;
  const val = table[stat] ?? 0;
  if (stat === "hp" || stat === "atk" || stat === "em") return val;
  return val * 100;
}

// ─── Substat scoring constants ───

/** Maps each substat to its CD-equivalent coefficient: 7.77 / maxRollValue */
export const SUBSTAT_COEFFICIENTS: Record<string, number> = {
  cd: 1.0,
  cr: 1.9974,
  "atk%": 1.3328,
  "hp%": 1.3328,
  "def%": 1.0658,
  em: 0.3333,
  er: 1.1991,
  atk: 0.3995,
  hp: 0.026,
  def: 0.3356,
};

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
    characters,
    (character) => character.id
  )
);

export const artifactsById = freezeRecord(
  createRecord<ArtifactSetResource, ArtifactSetResource["id"]>(
    artifacts,
    (artifact) => artifact.id
  )
);

export const weaponsById = freezeRecord(
  createRecord<WeaponResource, WeaponResource["id"]>(
    weapons,
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
  const list = [...characters];
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

export const sortedWeapons = sortItemsByRarityDesc(weapons);
export const sortedArtifacts = sortItemsByRarityDesc(artifacts);

/** Unique weapon secondary stats from weapon_stats (L90), sorted. */
export function getSortedWeaponSecondaryStats(
  weaponStats: WeaponStatsMap | null
): MainStat[] {
  if (!weaponStats) return [];
  const set = new Set<MainStat>();
  for (const entry of Object.values(weaponStats)) {
    if (entry.secondaryStat) set.add(entry.secondaryStat);
  }
  return Array.from(set).sort();
}
