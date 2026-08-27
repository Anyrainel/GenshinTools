import type {
  Element,
  MainStat,
  MainStatPlus,
  ReactionType,
  SubStat,
} from "./enums";
import artifactStatData from "./game/artifact_stat.json";

/**
 * Explicit role assignments for every released artifact set.
 *
 * Keep these exhaustive: the pre-push role check fails when game data adds a
 * set without a deliberate DPS, support, or other assignment.
 */
export const DPS_ARTIFACT_SET_IDS = [
  "scarlet_proof",
  "disenchantment_in_deep_shadow",
  "a_day_carved_from_rising_winds",
  "aubade_of_morningstar_and_moon",
  "night_of_the_skys_unveiling",
  "finale_of_the_deep_galleries",
  "long_nights_oath",
  "obsidian_codex",
  "unfinished_reverie",
  "fragment_of_harmonic_whimsy",
  "nighttime_whispers_in_the_echoing_woods",
  "golden_troupe",
  "marechaussee_hunter",
  "vourukashas_glow",
  "nymphs_dream",
  "desert_pavilion_chronicle",
  "flower_of_paradise_lost",
  "gilded_dreams",
  "shimenawas_reminiscence",
  "vermillion_hereafter",
  "gladiators_finale",
  "pale_flame",
  "emblem_of_severed_fate",
  "crimson_witch_of_flames",
  "wanderers_troupe",
  "heart_of_depth",
  "bloodstained_chivalry",
  "echoes_of_an_offering",
  "thundering_fury",
  "husk_of_opulent_dreams",
  "blizzard_strayer",
] as const;

/** Five-star support sets eligible for triage's universal ER hoarding rule. */
export const TRIAGE_SUPPORT_ARTIFACT_SET_IDS = [
  "heart_of_the_furnace",
  "celestial_gift",
  "silken_moons_serenade",
  "scroll_of_the_hero_of_cinder_city",
  "song_of_days_past",
  "deepwood_memories",
  "maiden_beloved",
  "viridescent_venerer",
  "oceanhued_clam",
  "noblesse_oblige",
  "archaic_petra",
  "tenacity_of_the_millelith",
] as const;

export const TRIAGE_SUPPORT_ARTIFACT_SETS: ReadonlySet<string> = new Set(
  TRIAGE_SUPPORT_ARTIFACT_SET_IDS
);

/** 4-star sets grouped as support sets in the artifact tier list only. */
export const TIER_LIST_4STAR_SUPPORT_ARTIFACT_SET_IDS = [
  "the_exile",
  "instructor",
  "scholar",
] as const;

/** Released four-star sets that are neither current support nor DPS targets. */
export const TIER_LIST_4STAR_OTHER_ARTIFACT_SET_IDS = [
  "gambler",
  "resolution_of_sojourner",
  "martial_artist",
  "berserker",
  "defenders_will",
  "brave_heart",
] as const;

export const TIER_LIST_SUPPORT_ARTIFACT_SET_IDS = [
  ...TRIAGE_SUPPORT_ARTIFACT_SET_IDS,
  ...TIER_LIST_4STAR_SUPPORT_ARTIFACT_SET_IDS,
] as const;

export const TIER_LIST_SUPPORT_ARTIFACT_SETS: ReadonlySet<string> = new Set(
  TIER_LIST_SUPPORT_ARTIFACT_SET_IDS
);

/** Sets grouped as Other in the artifact tier list even when they are 5-star. */
export const TIER_LIST_OTHER_ARTIFACT_SET_IDS = [
  "retracing_bolide",
  "lavawalker",
  "thundersoother",
  ...TIER_LIST_4STAR_OTHER_ARTIFACT_SET_IDS,
] as const;

export const TIER_LIST_OTHER_ARTIFACT_SETS: ReadonlySet<string> = new Set(
  TIER_LIST_OTHER_ARTIFACT_SET_IDS
);

export const ARTIFACT_SET_ROLE_IDS = {
  dps: DPS_ARTIFACT_SET_IDS,
  support: TIER_LIST_SUPPORT_ARTIFACT_SET_IDS,
  other: TIER_LIST_OTHER_ARTIFACT_SET_IDS,
} as const;

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
  sands: { "atk%": 26.68, "hp%": 26.66, "def%": 26.66, em: 10, er: 10 },
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
export const FLAT_STATS: ReadonlySet<string> = new Set([
  "hp",
  "atk",
  "def",
  "em",
]);

/** Convert JSON decimal to display format. Pct stats ×100, flat stats unchanged. */
function toDisplay(stat: string, val: number): number {
  if (FLAT_STATS.has(stat)) return val;
  return Math.round(val * 1e6) / 1e4;
}

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

/** Maps each substat to its CD-equivalent coefficient: maxRoll(cd) / maxRoll(stat) */
export const SUBSTAT_COEFFICIENTS: Record<string, number> = Object.fromEntries(
  Object.entries(maxSubstatRolls[5]).map(([stat, maxRoll]) => [
    stat,
    Math.round((maxSubstatRolls[5].cd / maxRoll) * 10000) / 10000,
  ])
);

export const mainStatsPlus: MainStatPlus[] = [
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "em",
  "er",
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
  "atk",
  "hp",
  "elemental%",
  "cr/cd",
] as const;

/** Subset of reactions useful as team composition tags (excludes "none" and intermediate reactions). */
export const TEAM_REACTION_OPTIONS: ReactionType[] = [
  "melt",
  "vaporize",
  "spread",
  "aggravate",
  "overloaded",
  "electroCharged",
  "superconduct",
  "swirl",
  "frozen",
  "bloom",
  "hyperbloom",
  "burgeon",
  "burning",
  "lunarCharged",
  "lunarBloom",
  "lunarCrystallize",
  "stellarConduct",
  "stellarSwirl",
];
