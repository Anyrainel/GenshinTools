export type Language = "en" | "zh";
export type ThemeId =
  | "abyss"
  | "mondstadt"
  | "liyue"
  | "inazuma"
  | "sumeru"
  | "fontaine"
  | "natlan"
  | "snezhnaya"
  | "nodkrai";

export type Rarity = 1 | 2 | 3 | 4 | 5;

export type Element =
  | "Pyro"
  | "Hydro"
  | "Electro"
  | "Cryo"
  | "Anemo"
  | "Geo"
  | "Dendro";
export const elements: Element[] = [
  "Pyro",
  "Hydro",
  "Electro",
  "Cryo",
  "Anemo",
  "Geo",
  "Dendro",
];

export type ElementalOrPhysical = Element | "Physical";
export const ELEMENT_KEYS: ElementalOrPhysical[] = [
  "Physical",
  "Pyro",
  "Hydro",
  "Electro",
  "Cryo",
  "Anemo",
  "Geo",
  "Dendro",
];

export type WeaponType = "Sword" | "Claymore" | "Polearm" | "Catalyst" | "Bow";
export const weaponTypes: WeaponType[] = [
  "Sword",
  "Claymore",
  "Polearm",
  "Catalyst",
  "Bow",
];

export type Region =
  | "Mondstadt"
  | "Liyue"
  | "Inazuma"
  | "Sumeru"
  | "Fontaine"
  | "Natlan"
  | "Snezhnaya"
  | "Nod-Krai"
  | "None";
export const regions: Region[] = [
  "Mondstadt",
  "Liyue",
  "Inazuma",
  "Sumeru",
  "Fontaine",
  "Natlan",
  "Snezhnaya",
  "Nod-Krai",
  "None",
];

export type Faction = "Hexerei" | "Moonsign" | "Nightsoul" | "None";
export const factions: Faction[] = ["Hexerei", "Moonsign", "Nightsoul", "None"];

export type MainStat =
  | "cr"
  | "cd"
  | "atk%"
  | "hp%"
  | "def%"
  | "em"
  | "er"
  | "pyro%"
  | "hydro%"
  | "anemo%"
  | "electro%"
  | "dendro%"
  | "cryo%"
  | "geo%"
  | "phys%"
  | "heal%"
  | "atk"
  | "hp";
export type SubStat =
  | "cr"
  | "cd"
  | "atk%"
  | "hp%"
  | "def%"
  | "er"
  | "em"
  | "atk"
  | "hp"
  | "def";
export type MainStatPlus = MainStat | "elemental%" | "cr/cd";
export type BaseStat = "baseHp" | "baseAtk" | "baseDef" | MainStat;

export type StatKey =
  | BaseStat
  | MainStat
  | SubStat
  | "dmg%" // generic + ability + element DMG bonus
  | "baseDmg" // flat base DMG add (replaces ${AbilityType}Base: Yun Jin, Zhongli A4, Shenhe)
  | "baseDmg%" // 倍率乘区: "deal X% original DMG" multiplier (Yoimiya E, Neuvillette A1, Veil of Falsehood, etc.)
  | "reactionBaseDmg%" // 反应基础提升: lunar reaction base DMG bonus (Nod-Krai P3 passives)
  | "elevated%" // elevation multiplier §4 (replaces ${LunarReactionType}Elevated%)
  | "reactionDmg%" // reaction DMG bonus §8.4 (replaces ${ReactionType}%, separate zone from dmg%)
  | "reactionCr" // reaction CRIT rate §8.8 (replaces ${ReactionType}Cr, separate from cr)
  | "reactionCd" // reaction CRIT DMG §8.8 (replaces ${ReactionType}Cd, separate from cd)
  | "atkSpd%" // Attack Speed Bonus
  // Enemy debuff / modifier stats
  | "defReduction%"
  | "defIgnore%"
  | "resReduction%";

export type MainStatSlot = "sands" | "goblet" | "circlet";
export const mainStatSlots: MainStatSlot[] = ["sands", "goblet", "circlet"];

export type Slot = MainStatSlot | "flower" | "plume";
export const allSlots: Slot[] = [
  "flower",
  "plume",
  "sands",
  "goblet",
  "circlet",
];

export const SKILL_LEVELS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export type LunarReactionType =
  | "lunarCharged"
  | "lunarBloom"
  | "lunarCrystallize";
export type ReactionType =
  | "none"
  // Amplifying
  | "melt"
  | "vaporize"
  // Catalyze
  | "quicken"
  | "spread"
  | "aggravate"
  // Transformative
  | "overloaded"
  | "electroCharged"
  | "superconduct"
  | "swirl"
  | "frozen"
  | "shatter"
  | "bloom"
  | "hyperbloom"
  | "burgeon"
  | "burning"
  | "crystallize"
  // Lunar
  | LunarReactionType;

export type EnemyType =
  | "human"
  | "automaton"
  | "fatui"
  | "boss"
  | "hilichurl"
  | "elemental"
  | "abyss"
  | "beast"
  | "legend"
  | ""; // uncategorized

export type Tier = "S" | "A" | "B" | "C" | "D" | "Pool";
export const tiers: Tier[] = ["S", "A", "B", "C", "D", "Pool"];

export type SortDirection = "asc" | "desc" | "off";

export type MergeAlgorithm = "greedyMerge" | "bruteForce" | "smartMerge";

export type BuildSource = "preset" | "modified" | "custom";

export type BuildStyle = "on-field" | "off-field";
export const buildStyles: BuildStyle[] = ["on-field", "off-field"];

export type BuildRole = "dps" | "support" | "sustain";
export const buildRoles: BuildRole[] = ["dps", "support", "sustain"];

export type BuildConstellation = 0 | 1 | 2 | 4 | 6;
export const buildConstellations: BuildConstellation[] = [0, 1, 2, 4, 6];

export type LuckExpectation = "cautious" | "balanced" | "hopeful";
export const LUCK_MULTIPLIERS: Record<LuckExpectation, number> = {
  cautious: 0.8,
  balanced: 0.85,
  hopeful: 0.9,
};

export type EnvBuffCategory = "food" | "enemy" | "status";
