import type {
  BuildConstellation,
  BuildRole,
  BuildSource,
  BuildStyle,
  CharacterUtility,
  Element,
  ElementalOrPhysical,
  EnemyType,
  EnvBuffCategory,
  Faction,
  Language,
  LuckExpectation,
  MainStat,
  MainStatPlus,
  MergeAlgorithm,
  Rarity,
  Region,
  Slot,
  SortDirection,
  StatKey,
  SubStat,
  Tier,
  WeaponType,
} from "./enums";

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

export type EnemyResource = {
  id: string;
  type: EnemyType;
  imagePath: string; // Local serving path
};

export type CharacterInfo = {
  energy: number;
  /** Energy cost for an alternate/special Elemental Burst, when the kit has one. */
  specialBurstCost?: number;
  healerC?: number; // min constellation starting from 0, omitted if none
  shielderC?: number; // min constellation starting from 0, omitted if none
  /** Which action primarily heals the party. Used by the ER calculator to
   *  anchor heal-triggered weapons (Dialogues, Rightful Reward, etc.) to the
   *  correct skill node. Default "Q" when omitted. Only meaningful when
   *  `healerC` is set. */
  healAction?: "E" | "Q";
  /** Stat keys that scale this character's heal or shield output. */
  supStat?: ("hp%" | "atk%" | "def%" | "em")[];
  c3Talent: "A" | "E" | "Q";
  c5Talent: "A" | "E" | "Q";
  faction?: Faction;
};

// Character kit types (lazy-loaded per-language data from character_*.json)
/** One row of the skill details table: label + template string for runtime rendering. */
export type CharacterSkillDetail = {
  label: string;
  template: string;
};

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

export type WeightedMainStat = {
  stat: MainStat;
  weight: number; // 0-100
  /** CD-equivalent override (default = 62.1 for 5★). Populated by auto-tune for elemental DMG% goblets. */
  cdEquiv?: number;
};

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
  halfSet1?: string; // for 2pc+2pc - ID
  halfSet2?: string; // for 2pc+2pc - ID
  substats: WeightedSubStat[];

  /** Per-main-stat weights (populated by auto-tune or migration). */
  sandsWeights: WeightedMainStat[];
  gobletWeights: WeightedMainStat[];
  circletWeights: WeightedMainStat[];

  /** 300 / idealScore — used to normalize raw scores to 0-300 scale. */
  normalizer: number;
};

export type WeightedSubStat = {
  stat: SubStat;
  weight: number; // 0 to 100
};

export type BuildGroup = {
  characterId: string;
  builds: Build[];
  hidden?: boolean;
  weapons?: string[]; // character weapon choices
};

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
  builds: Record<string, Build>; // Flat Maps
  characterBuilds: Record<string, string[]>; // Character mapping
  characterWeapons: Record<string, string[]>; // Weapon defaults
  computeOptions?: ComputeOptions; // Compute Options
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
export type BuildConfig = {
  flowerPlume: SlotConfig;
  sands: SlotConfig;
  goblet: SlotConfig;
  circlet: SlotConfig;
  servedCharacters: CharacterMergeInfo[];
};
export type ArtifactBuildConfigs = {
  setId: string;
  configurations: BuildConfig[];
};

export type ArtifactSetConfig =
  | { type: "4pc"; setId: string }
  | { type: "2pc+2pc"; halfSetIds: [string, string] };

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
    luckExpectation?: LuckExpectation;
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

export interface CharacterFilters {
  elements: Element[];
  weaponTypes: WeaponType[];
  regions: Region[];
  factions: Faction[];
  utilities: CharacterUtility[];
  rarities: Rarity[];
  tierSort: SortDirection;
  releaseSort: SortDirection;
  scoreSort: SortDirection;
  searchQuery: string;
  ownedOnly: boolean;
  showManekin: boolean;
}

export type GlobalStatWeights = {
  flatAtk: number;
  flatHp: number;
  flatDef: number;
};

export type StatEntry = {
  key: StatKey;
  value: number;
};

// ─── Game Data: weapon / artifact per-language bundles ───
export type WeaponGameEntry = {
  name: string;
  descHtmlTpl: string;
  refinements: string[][];
};
export type WeaponGameData = Record<string, WeaponGameEntry>;
export type ArtifactGameEntry = {
  name: string;
  effect2: string;
  effect4: string;
};
export type ArtifactGameData = Record<string, ArtifactGameEntry>;

export interface BossTierStats {
  id: number;
  level: number;
  hp?: number;
  atk?: number;
  def?: number;
}

export interface BossState {
  state: string;
  ability: string;
  res_delta?: Partial<Record<ElementalOrPhysical, number>>;
  value_delta?: { atk_ratio: number };
}

export interface BossInfo {
  id: number;
  tiers: Record<string, BossTierStats>;
  monster_id?: number;
  describe_id?: number;
  res?: Record<ElementalOrPhysical, number>;
  states?: BossState[];
  params?: Record<string, Record<string, number>>;
}

export interface BossVariant {
  tiers: number[];
  id: number;
  name: string;
}

export interface BossBullet {
  tiers: number[];
  title?: string;
  short?: string;
  detail?: string;
}

export interface BossDescribeName {
  id: number;
  name: string;
}

export interface BossDescription {
  id: number;
  variants: BossVariant[];
  advantage?: { tiers: number[]; text: string }[];
  disadvantage?: { tiers: number[]; text: string }[];
  bullets: BossBullet[];
  describe_names?: BossDescribeName[];
}

export interface BossSchedule {
  id: number;
  open: string;
  close: string;
  boss_ids: number[];
}

/**
 * All boss data keyed for quick lookup, plus accessor methods that close
 * over the loaded data. Obtain via ``leylineBossResource`` from
 * ``gameDataLoader.ts``.
 */
export interface LeylineBossData {
  schedules: BossSchedule[];
  allBossIds: number[];
  getBossInfo(id: number): BossInfo | undefined;
  getBossDesc(id: number, lang: Language): BossDescription | undefined;
  getScheduleName(scheduleId: number, lang: Language): string;
  getBossVariantName(id: number, tier: number, lang: Language): string;
  getBossDisplayName(id: number, lang: Language): string;
  getBulletsForTier(id: number, tier: number, lang: Language): BossBullet[];
  getAdvantageForTier(
    id: number,
    tier: number,
    lang: Language
  ): { advantage: string[]; disadvantage: string[] };
  getCurrentSchedule(): BossSchedule | undefined;
  getBossImagePath(bossId: number): string | null;
  bossMatchesSearch(bossId: number, query: string): boolean;
} /**
 * A buff entry (food, enemy, or status) with stat bonuses.
 * Values use engine format: flat for hp/atk/def/em, fractional for %.
 * i18n names live in i18n-app.ts under the `envBuffs` key.
 */

export type EnvBuff = {
  id: string;
  category: EnvBuffCategory;
  stats: { key: StatKey; value: number }[];
  /** Optional image path for display (relative to public/). */
  imagePath?: string;
  /** Food slot: only one food per slot can be active. */
  foodSlot?: number;
};
export interface Resource<T> {
  preload(): Promise<T>;
  use(): T | null;
  peek(): T | null;
}

export interface LangResource<T> {
  preload(lang: Language): Promise<T>;
  use(lang: Language): T | null;
  peek(lang: Language): T | null;
}

/** Localized metadata for one in-game achievement category. */
export interface AchievementCategory {
  id: number;
  name: string;
  /** In-game category order from the datamine. */
  order: number;
}

/** Localized metadata for one in-game achievement. */
export interface Achievement {
  id: number;
  name: string;
  description: string;
  categoryId: number;
  /** In-game achievement order from the datamine. */
  order: number;
  /** First game version containing the achievement, when verifiable. */
  version?: string;
  /** Primogems awarded for completing the achievement. */
  reward: number;
  /** Immediately preceding achievement in a multi-step series. */
  previousId?: number;
}

/** Compact on-disk achievement shape before localized templates are expanded. */
export interface AchievementReference extends Omit<Achievement, "description"> {
  /** Plain text, or [template index, ...positional values]. */
  description: string | [number, ...number[]];
}

export interface AchievementReferenceData {
  categories: AchievementCategory[];
  achievements: AchievementReference[];
  descriptionTemplates: string[];
}

export interface AchievementData {
  categories: AchievementCategory[];
  achievements: Achievement[];
}
