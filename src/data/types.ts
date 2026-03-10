export type Language = "en" | "zh";

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

export type Faction = "Hexerei" | "Moonsign" | "None";

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

// Base stat keys from character stat tables.
// Every character has baseHp/baseAtk/baseDef/em plus exactly one ascension stat.
export type BaseStat = "baseHp" | "baseAtk" | "baseDef" | MainStat;

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

export type CharacterResource = {
  id: string;
  rarity: Rarity;
  imageUrl?: string; // Original image URL from wiki
  imagePath: string; // Local serving path
};

export type WeaponResource = {
  id: string;
  rarity: Rarity;
  imageUrl?: string; // Original image URL from wiki
  imagePath: string; // Local serving path
};

export type ArtifactSetResource = {
  id: string;
  rarity: Rarity;
  imageUrl?: string; // Original image URL from wiki (flower)
  imagePaths: Record<Slot, string>; // Local serving paths for all slots
};

export type ArtifactHalfSet = {
  id: string;
  setIds: string[]; // All artifact set IDs that have this 2pc effect
};

export type ElementResource = {
  name: Element;
  imageUrl?: string; // Original image URL from wiki
  imagePath: string; // Local serving path
};

export type WeaponTypeResource = {
  name: WeaponType;
  imageUrl?: string; // Original image URL from wiki
  imagePath: string; // Local serving path
};

export type EnemyType =
  | "human"
  | "automaton"
  | "fatui"
  | "boss"
  | "hilichurl"
  | "elemental"
  | "abyss"
  | "beast"
  | "legend";

export type EnemyResource = {
  id: string;
  type: EnemyType;
  imagePath: string; // Local serving path
};

export type BuildStyle = "on-field" | "off-field";
export const buildStyles: BuildStyle[] = ["on-field", "off-field"];

export type BuildRole = "dps" | "support" | "sustain";
export const buildRoles: BuildRole[] = ["dps", "support", "sustain"];

export type BuildConstellation = 0 | 1 | 2 | 4 | 6;
export const buildConstellations: BuildConstellation[] = [0, 1, 2, 4, 6];

export type LunarReactionType =
  | "lunarCharged"
  | "lunarBloom"
  | "lunarCrystallize";

export type ReactionType =
  | "none"
  // Amplifying
  | "melt"
  | "vaporize"
  // Additive (Catalyze)
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
];

export type CharacterInfo = {
  energy: number;
  healerC?: number; // min constellation starting from 0, omitted if none
  shielderC?: number; // min constellation starting from 0, omitted if none
  c3Talent: "A" | "E" | "Q";
  c5Talent: "A" | "E" | "Q";
  faction?: Faction;
};

// Character kit types (lazy-loaded per-language data from character_*.json)
/** Skill table levels (Lv6–Lv15). Keys used in CharacterSkillDetail without "lv" prefix. */
export const SKILL_LEVELS = [
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

/** One row of the skill details table: label + optional value per level. */
export type CharacterSkillDetail = { label: string } & Partial<
  Record<SkillLevel, string>
>;

export type CharacterEffect = {
  name: string;
  descHtml: string;
};

export type CharacterSkill = CharacterEffect & {
  details: CharacterSkillDetail[];
};

export type CharacterKit = {
  skills: CharacterSkill[];
  passives: CharacterEffect[];
  constellations: CharacterEffect[];
  glossary: CharacterEffect[] | null;
};

export type BuildSource = "preset" | "modified" | "custom";

export type Build = {
  id: string;
  source?: BuildSource; // Derived field
  characterId: string; // Back link to character
  visible: boolean;
  styles?: BuildStyle[];
  roles?: BuildRole[];
  minCons?: BuildConstellation; // minimum constellation for this build, default 0
  name: string;
  composition: "4pc" | "2pc+2pc";
  artifactSet?: string; // for 4pc
  halfSet1?: number | string; // for 2pc+2pc - ID (legacy number or new string)
  halfSet2?: number | string; // for 2pc+2pc - ID (legacy number or new string)
  sands: MainStat[];
  goblet: MainStat[];
  circlet: MainStat[];
  substats: WeightedSubStat[];
};

export type WeightedSubStat = {
  stat: SubStat;
  weight: number; // 0 to 100
};

export type ArtifactPattern = {
  mainStat: MainStatPlus;
  substats: SubStat[];
  set: string;
  slot: Slot;
  characters4pc?: string[];
  characters2pc?: string[];
};

export type BuildGroup = {
  characterId: string;
  builds: Build[];
  hidden?: boolean;
  weapons?: string[]; // character weapon choices
};

export type MergeAlgorithm = "greedyMerge" | "bruteForce" | "smartMerge";

export type ComputeOptions = {
  // Simplify certain main stats
  expandElementalGoblet?: boolean; // default: true
  expandCritCirclet?: boolean; // default: true
  // Merge algorithm selection
  mergeAlgorithm?: MergeAlgorithm; // default: "bruteForce"
  // Strip flat stats (HP, ATK, DEF) before merging, restore afterward
  normalizeFlatStats?: boolean; // default: true
  // Minimum weight for a substat to be included in the pool (default: 70)
  substatWeightThreshold?: number;
  // Minimum weight for a substat to be marked must-present (default: 100)
  mustPresentWeightThreshold?: number;
};

export type BuildPayload = {
  author: string;
  description: string;
  version: number;
  data: BuildGroup[];
  computeOptions?: ComputeOptions;
};

export type BuildPayloadV5 = {
  version: 5;
  id?: string; // Preset ID (e.g. "anyrainel-2025-02-12")
  author: string;
  description: string;
  lastModified?: number; // Timestamp

  // Flat Maps
  builds: Record<string, Build>;

  // Character mapping
  characterBuilds: Record<string, string[]>;

  // Weapon defaults
  characterWeapons: Record<string, string[]>;

  // Compute Options
  computeOptions?: ComputeOptions;
};

export type CharacterBuilds = {
  characterId: string;
  buildIds: string[]; // Ordered list of build IDs for this character
};

export type CharacterMergeInfo = {
  characterId: string;
  hasPerfectMerge: boolean; // false if the character's build was always imperfectly merged (coverage)
  has4pcBuild: boolean; // false if this character only has 2pc+2pc build with this set
};

export type SlotConfig = {
  mainStats: MainStatPlus[];
  substats: SubStat[];
  mustPresent: SubStat[];
  minStatCount: number;
};

export type SetConfig = {
  flowerPlume: SlotConfig;
  sands: SlotConfig;
  goblet: SlotConfig;
  circlet: SlotConfig;
  servedCharacters: CharacterMergeInfo[];
};

export type ArtifactSetConfigs = {
  setId: string;
  configurations: SetConfig[];
};

export type Tier = "S" | "A" | "B" | "C" | "D" | "Pool";
export const tiers: Tier[] = ["S", "A", "B", "C", "D", "Pool"];

// Luck expectation for artifact upgrade projections
// - cautious: 0.80x (pessimistic, expect lower rolls)
// - balanced: 0.85x (realistic average)
// - hopeful: 0.90x (optimistic, expect higher rolls)
export type LuckExpectation = "cautious" | "balanced" | "hopeful";

export const LUCK_MULTIPLIERS: Record<LuckExpectation, number> = {
  cautious: 0.8,
  balanced: 0.85,
  hopeful: 0.9,
};

export type TierAssignment = {
  [characterId: string]: {
    tier: Tier;
    position: number;
  };
};

export type TierCustomization = {
  [tier: string]: {
    displayName: string;
    hidden: boolean;
    luckExpectation?: LuckExpectation; // Per-tier luck expectation for insights
  };
};

export type TierListData = {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle?: string;
  author?: string; // Added for export metadata
  description?: string; // Added for export metadata
};

export type PresetOption = {
  path: string;
  label: string;
  author?: string;
  description?: string;
};

export type ArtifactData = {
  id: string;
  setKey: string;
  slotKey: Slot;
  level: number;
  rarity: Rarity;
  mainStatKey: MainStat;
  lock: boolean;
  substats: Partial<Record<SubStat, number>>;
  // GOOD v3 fields
  totalRolls?: number;
  astralMark?: boolean;
  elixirCrafted?: boolean;
  unactivatedSubstats?: Partial<Record<SubStat, number>>;
  initialValues?: Partial<Record<SubStat, number>>; // Initial roll values per substat
};

export type WeaponData = {
  id: string;
  key: string;
  level: number;
  refinement: number;
  lock: boolean;
};

export type CharacterData = {
  key: string;
  constellation: number;
  level: number;
  talent: {
    auto: number;
    skill: number;
    burst: number;
  };
  weapon?: WeaponData;
  artifacts: Partial<Record<Slot, ArtifactData>>;
};

export type AccountData = {
  characters: CharacterData[];
  extraArtifacts: ArtifactData[];
  extraWeapons: WeaponData[];
};

export type SortDirection = "asc" | "desc" | "off";

export interface CharacterFilters {
  elements: Element[];
  weaponTypes: WeaponType[];
  regions: Region[];
  rarities: Rarity[];
  tierSort: SortDirection;
  releaseSort: SortDirection;
  ownedOnly: boolean;
  showManekin: boolean;
}

export type GlobalStatWeights = {
  flatAtk: number;
  flatHp: number;
  flatDef: number;
};
