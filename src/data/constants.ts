import type { CharacterStatsMap, WeaponStatsMap } from "@/lib/gameStatsLoader";
import artifactStatData from "./game/artifact_stat.json";
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
    "atk%": 19.25,
    "hp%": 19.25,
    "def%": 19,
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

// ─── Artifact stat data (derived from official game data) ───

/** Stats where values are flat numbers (not percentages) */
const FLAT_STATS: ReadonlySet<string> = new Set(["hp", "atk", "def", "em"]);

/** Convert JSON decimal to display format. Pct stats ×100, flat stats unchanged. */
function toDisplay(stat: string, val: number): number {
  if (FLAT_STATS.has(stat)) return val;
  return Math.round(val * 1e6) / 1e4;
}

/** Whether a stat key is a flat (non-percentage) stat */
export function isFlatStat(stat: string): boolean {
  return FLAT_STATS.has(stat);
}

/** Whether a stat key represents a percentage value (needs ÷100 for internal format). */
export function isPctStat(key: string): boolean {
  return (
    key.endsWith("%") ||
    key === "cr" ||
    key === "cd" ||
    key === "er" ||
    key === "reactionCr" ||
    key === "reactionCd"
  );
}

// Valid stat keys (filter out FIGHT_PROP_FIRE_SUB_HURT etc from JSON)
const VALID_SUBSTATS = new Set<string>(statPools.substat);
const VALID_MAIN_STATS = new Set<string>([
  ...statPools.flower,
  ...statPools.plume,
  ...statPools.sands,
  ...statPools.goblet,
  ...statPools.circlet,
]);

function buildSubstatTiers(
  raw: Record<string, number[]>
): Record<SubStat, [number, number, number, number]> {
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([k]) => VALID_SUBSTATS.has(k))
      .map(([stat, tiers]) => [stat, tiers.map((v) => toDisplay(stat, v))])
  ) as Record<SubStat, [number, number, number, number]>;
}

function buildMainStatTable(
  raw: Record<string, number[]>
): Record<string, number[]> {
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([k]) => VALID_MAIN_STATS.has(k))
      .map(([stat, levels]) => [stat, levels.map((v) => toDisplay(stat, v))])
  );
}

// ─── Substat roll data ───

/** 4 possible roll values per substat, in display format (e.g. CR: [2.72, 3.11, 3.5, 3.89]) */
export const substatRollTiers = {
  5: buildSubstatTiers(artifactStatData.subStats.rarity5),
  4: buildSubstatTiers(artifactStatData.subStats.rarity4),
};

/** Max substat roll value per stat per rarity (display format: 3.89 for CR) */
export const maxSubstatRolls = {
  5: Object.fromEntries(
    Object.entries(substatRollTiers[5]).map(([k, t]) => [k, t[3]])
  ) as Record<SubStat, number>,
  4: Object.fromEntries(
    Object.entries(substatRollTiers[4]).map(([k, t]) => [k, t[3]])
  ) as Record<SubStat, number>,
};

/** Average of 4 roll tiers per stat per rarity (display format: 3.305 for CR) */
export const avgSubstatRolls = {
  5: Object.fromEntries(
    Object.entries(substatRollTiers[5]).map(([k, t]) => [
      k,
      (t[0] + t[1] + t[2] + t[3]) / 4,
    ])
  ) as Record<SubStat, number>,
  4: Object.fromEntries(
    Object.entries(substatRollTiers[4]).map(([k, t]) => [
      k,
      (t[0] + t[1] + t[2] + t[3]) / 4,
    ])
  ) as Record<SubStat, number>,
};

// ─── Main stat data ───

/**
 * Main stat values at every level, display format (46.6 for ATK%, 4780 for HP).
 * 5★: 21 entries [Lv.0..20], 4★: 17 entries [Lv.0..16].
 */
export const mainStatLevelValues = {
  5: buildMainStatTable(artifactStatData.mainStats.rarity5),
  4: buildMainStatTable(artifactStatData.mainStats.rarity4),
};

/** 5★ main stat values at Lv.20, display format (46.6 for ATK%, 4780 for HP) */
export const MAIN_STAT_VALUES_5STAR: Record<string, number> =
  Object.fromEntries(
    Object.entries(mainStatLevelValues[5]).map(([k, levels]) => [
      k,
      levels[levels.length - 1],
    ])
  );

/** 4★ main stat values at Lv.16, display format */
export const MAIN_STAT_VALUES_4STAR: Record<string, number> =
  Object.fromEntries(
    Object.entries(mainStatLevelValues[4]).map(([k, levels]) => [
      k,
      levels[levels.length - 1],
    ])
  );

/** Get the max-level main stat value in display format (46.6 for ATK%, 311 for flat ATK) */
export function getMainStatValue(stat: MainStat, rarity: number): number {
  const table = rarity === 4 ? MAIN_STAT_VALUES_4STAR : MAIN_STAT_VALUES_5STAR;
  return table[stat] ?? 0;
}

// ─── Derived scoring constants ───

/** Maps each substat to its CD-equivalent coefficient: maxRoll(cd) / maxRoll(stat) */
export const SUBSTAT_COEFFICIENTS: Record<string, number> = Object.fromEntries(
  Object.entries(maxSubstatRolls[5]).map(([stat, maxRoll]) => [
    stat,
    Math.round((maxSubstatRolls[5].cd / maxRoll) * 10000) / 10000,
  ])
);

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
