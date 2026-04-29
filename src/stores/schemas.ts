/**
 * Zod schemas for validating and healing persisted store data.
 *
 * These replace the imperative `repair*` functions in storeValidation.ts.
 * All schemas use `.catch()` so invalid data is healed to safe defaults
 * instead of throwing — the app never crashes on corrupted localStorage.
 */
import { z } from "zod";
import type { SortDirection } from "@/data/enums";
import type { GlobalStatWeights } from "@/data/types";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { DEFAULT_COMPUTE_OPTIONS } from "@/lib/artifact-builds/computeFilters";
import { ArtifactSetConfigSchema } from "@/lib/team-comp/schemas";

export const DEFAULT_GLOBAL_STAT_WEIGHTS: GlobalStatWeights = {
  flatAtk: 30,
  flatHp: 30,
  flatDef: 30,
};

export const DEFAULT_CHARACTER_SORT: {
  tierSort: SortDirection;
  releaseSort: SortDirection;
  scoreSort: SortDirection;
} = {
  tierSort: "desc",
  releaseSort: "desc",
  scoreSort: "off",
};

export const DEFAULT_VIEW_SETTINGS: {
  activeTeamId: string | null;
  ownedOnly: boolean | null;
  teamSort: "default" | "tier" | "release";
  erCalcExpanded: boolean;
} = {
  activeTeamId: null,
  ownedOnly: null,
  teamSort: "default",
  erCalcExpanded: false,
};

// ─── Shared lightweight persisted shapes ───

const TierAssignmentItemSchema = z
  .object({
    tier: z.string(),
    position: z.number().catch(0),
  })
  .loose();

const TierCustomizationItemSchema = z
  .object({
    displayName: z.string().catch(""),
    hidden: z.boolean().catch(false),
    luckExpectation: z.number().optional(),
  })
  .loose();

const TierAssignmentSchema = z
  .record(z.string(), TierAssignmentItemSchema)
  .catch({});

const TierCustomizationSchema = z
  .record(z.string(), TierCustomizationItemSchema)
  .catch({});

// ─── ArtifactData (replaces repairArtifact) ───

export const ArtifactDataSchema = z
  .object({
    id: z.string(),
    setKey: z.string(),
    slotKey: z.string(),
    mainStatKey: z.string(),
    level: z.number().catch(0),
    rarity: z.number().catch(5),
    lock: z.boolean().catch(false),
    substats: z.record(z.string(), z.number()).catch({}),
  })
  .loose();

// ─── WeaponData ───

export const WeaponDataSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    level: z.number(),
    refinement: z.number(),
    lock: z.boolean().catch(false),
  })
  .loose();

// ─── CharacterData (replaces repairCharacter) ───

export const CharacterDataSchema = z
  .object({
    key: z.string(),
    constellation: z.number(),
    level: z.number(),
    talent: z
      .object({
        auto: z.number(),
        skill: z.number(),
        burst: z.number(),
      })
      .catch({ auto: 1, skill: 1, burst: 1 }),
    weapon: WeaponDataSchema.optional(),
    artifacts: z
      .record(z.string(), ArtifactDataSchema.nullable().catch(null))
      .catch({}),
  })
  .loose();

// ─── AccountData (replaces repairAccountData) ───

export const AccountDataSchema = z
  .object({
    characters: z.array(CharacterDataSchema).catch([]),
    extraArtifacts: z.array(ArtifactDataSchema).catch([]),
    extraWeapons: z.array(WeaponDataSchema).catch([]),
  })
  .loose();

// ─── Account ───

const AccountSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    data: AccountDataSchema,
    scores: z.record(z.string(), z.unknown()).catch({}),
    lastUpdate: z.number().finite().catch(0),
  })
  .loose();

export const PersistedAccountStoreSchema = z.object({
  accounts: z.record(z.string(), AccountSchema).catch({}),
  activeAccountId: z.number().nullable().catch(null),
  staleScoreCharIds: z.union([z.literal(true), z.array(z.string())]).catch([]),
});

// ─── Build (replaces repairBuild) ───

export const BuildSchema = z
  .object({
    id: z.string(),
    characterId: z.string(),
    name: z.string().catch(""),
    visible: z.boolean().catch(true),
    composition: z.enum(["4pc", "2pc+2pc"]).catch("4pc"),
    substats: z.array(z.unknown()).catch([]),
    sandsWeights: z.array(z.unknown()).catch([]),
    gobletWeights: z.array(z.unknown()).catch([]),
    circletWeights: z.array(z.unknown()).catch([]),
    normalizer: z.number().catch(0),
  })
  .loose();

const ComputeOptionsSchema = z
  .object({
    expandElementalGoblet: z.boolean().optional(),
    expandCritCirclet: z.boolean().optional(),
    mergeAlgorithm: z.string().optional(),
    normalizeFlatStats: z.boolean().optional(),
    substatWeightThreshold: z.number().optional(),
    mustPresentWeightThreshold: z.number().optional(),
  })
  .loose()
  .catch(DEFAULT_COMPUTE_OPTIONS);

export const PersistedBuildsStoreSchema = z.object({
  builds: z.record(z.string(), BuildSchema).catch({}),
  characterToBuildIds: z.record(z.string(), z.array(z.string())).catch({}),
  presetDeletedBuildIds: z.array(z.string()).catch([]),
  validationErrors: z.record(z.string(), z.array(z.string())).catch({}),
  activePresetId: z.string().nullable().catch(null),
  hasPromptedForPreset: z.boolean().catch(false),
  hiddenCharacters: z.record(z.string(), z.boolean()).catch({}),
  characterWeapons: z.record(z.string(), z.array(z.string())).catch({}),
  computeOptions: ComputeOptionsSchema,
  author: z.string().catch(""),
  description: z.string().catch(""),
});

// ─── Team (replaces repairTeam) ───

export const TeamSchema = z
  .object({
    id: z.string(),
    name: z.string().catch(""),
    characters: z.array(z.string().nullable()).catch([null, null, null, null]),
    weapons: z.array(z.string().nullable()).catch([null, null, null, null]),
    artifacts: z
      .array(ArtifactSetConfigSchema.nullable().catch(null))
      .catch([null, null, null, null]),
    reactions: z.array(z.string()).catch([]),
    opts: z.record(z.string(), z.unknown()).catch({}),
    calcContext: z.record(z.string(), z.unknown()).catch({}),
    formulaMode: z.enum(["single", "combo"]).catch("single"),
    extraBuffs: z.array(z.unknown()).catch([]),
    charSettings: z.record(z.string(), z.unknown()).catch({}),
  })
  .loose();

export const PersistedTeamStoreSchema = z.object({
  teams: z.array(TeamSchema).catch([]),
  author: z.string().catch(""),
  description: z.string().catch(""),
});

// ─── Freeze ───

const FrozenSlotMapSchema = z
  .record(z.string(), ArtifactDataSchema.nullable().catch(null))
  .catch({});

const FrozenTeamSchema = z
  .object({
    frozenCharIds: z.array(z.string()).catch([]),
    artifactsByChar: z.record(z.string(), FrozenSlotMapSchema).catch({}),
  })
  .loose();

export const PersistedFreezeStoreSchema = z.object({
  frozenTeams: z.record(z.string(), FrozenTeamSchema).catch({}),
  reuseMode: z.enum(["none", "sameChar", "forceReuse"]).catch("sameChar"),
  frozenArtifactIds: z.array(z.string()).catch([]),
});

// ─── ResourceRec ───

const TierThresholdsSchema = z.record(z.string(), z.number()).catch({});
const ScoreDiffSchema = z.record(z.string(), z.number()).catch({});

export const PersistedResourceRecStoreSchema = z.object({
  thresholds: TierThresholdsSchema,
  minScoreDiff: z
    .object({
      craft: ScoreDiffSchema,
      reroll: ScoreDiffSchema,
      levelup: ScoreDiffSchema,
    })
    .catch({ craft: {}, reroll: {}, levelup: {} }),
  panelOpen: z.boolean().catch(false),
  showCraft: z.boolean().optional().catch(undefined),
  showReroll: z.boolean().optional().catch(undefined),
  showLevelup: z.boolean().optional().catch(undefined),
});

// ─── Triage ───

const CustomFlexInputSchema = z.object({
  slot: z.string(),
  mainStat: z.string(),
  requiredSubs: z.array(z.string()).catch([]),
});

export const PersistedTriageStoreSchema = z.object({
  settings: z
    .object({
      triageMode: z
        .enum(["strict", "loose"])
        .catch(DEFAULT_TRIAGE_SETTINGS.triageMode),
      mainStatThreshold: z
        .number()
        .catch(DEFAULT_TRIAGE_SETTINGS.mainStatThreshold),
      optionalSubThreshold: z
        .number()
        .catch(DEFAULT_TRIAGE_SETTINGS.optionalSubThreshold),
      fillerKeep: z.number().catch(DEFAULT_TRIAGE_SETTINGS.fillerKeep),
      qualityMargin: z.number().catch(DEFAULT_TRIAGE_SETTINGS.qualityMargin),
      alwaysLockSolidArtifacts: z
        .boolean()
        .catch(DEFAULT_TRIAGE_SETTINGS.alwaysLockSolidArtifacts),
      setSlotKeep: z.number().catch(DEFAULT_TRIAGE_SETTINGS.setSlotKeep),
      ownedOnly: z.boolean().catch(DEFAULT_TRIAGE_SETTINGS.ownedOnly),
      erHoardingEnabled: z
        .boolean()
        .catch(DEFAULT_TRIAGE_SETTINGS.erHoardingEnabled),
      erHoardingAllEnabled: z
        .boolean()
        .catch(DEFAULT_TRIAGE_SETTINGS.erHoardingAllEnabled),
      doubleCritLockEnabled: z
        .boolean()
        .catch(DEFAULT_TRIAGE_SETTINGS.doubleCritLockEnabled),
      levelProtection: z
        .number()
        .catch(DEFAULT_TRIAGE_SETTINGS.levelProtection),
      highLevelProtection: z
        .boolean()
        .catch(DEFAULT_TRIAGE_SETTINGS.highLevelProtection),
      equippedProtection: z
        .boolean()
        .catch(DEFAULT_TRIAGE_SETTINGS.equippedProtection),
      disabledFlexPatterns: z.array(z.string()).catch([]),
      enabledFlexPatterns: z.array(z.string()).catch([]),
      customFlexInputs: z.array(CustomFlexInputSchema).catch([]),
    })
    .loose()
    .catch(DEFAULT_TRIAGE_SETTINGS),
});

// ─── Tier list stores ───

export const PersistedBaseTierStoreSchema = z.object({
  tierAssignments: TierAssignmentSchema,
  tierCustomization: TierCustomizationSchema,
  customTitle: z.string().catch(""),
  author: z.string().catch(""),
  description: z.string().catch(""),
});

const TierListInstanceSchema = PersistedBaseTierStoreSchema.extend({
  id: z.number(),
  linkedAccountId: z.number().nullable().catch(null),
});

export const PersistedTierListStoreSchema = z.object({
  tierLists: z.record(z.string(), TierListInstanceSchema).catch({}),
  activeTierListId: z.number().catch(1),
  nextId: z.number().catch(2),
  showWeapons: z.boolean().catch(true),
  showTravelers: z.boolean().catch(false),
  showManekin: z.boolean().catch(false),
});

// ─── Preferences ───

export const PersistedPreferencesStoreSchema = z.object({
  characterSort: z
    .object({
      tierSort: z
        .enum(["asc", "desc", "off"])
        .catch(DEFAULT_CHARACTER_SORT.tierSort),
      releaseSort: z
        .enum(["asc", "desc", "off"])
        .catch(DEFAULT_CHARACTER_SORT.releaseSort),
      scoreSort: z
        .enum(["asc", "desc", "off"])
        .catch(DEFAULT_CHARACTER_SORT.scoreSort),
    })
    .catch(DEFAULT_CHARACTER_SORT),
});

// ─── Greeting ───

export const PersistedGreetingStoreSchema = z.object({
  onboardingCompleted: z.boolean().catch(false),
  lastSeenUpdate: z.string().nullable().catch(null),
});

// ─── Artifact score ───

export const PersistedArtifactScoreStoreSchema = z.object({
  config: z
    .object({
      global: z
        .object({
          flatAtk: z.number().catch(DEFAULT_GLOBAL_STAT_WEIGHTS.flatAtk),
          flatHp: z.number().catch(DEFAULT_GLOBAL_STAT_WEIGHTS.flatHp),
          flatDef: z.number().catch(DEFAULT_GLOBAL_STAT_WEIGHTS.flatDef),
        })
        .catch(DEFAULT_GLOBAL_STAT_WEIGHTS),
    })
    .catch({ global: DEFAULT_GLOBAL_STAT_WEIGHTS }),
});

// ─── Archive session ───

export const PersistedArchiveSessionStoreSchema = z.object({
  characterSearch: z.string().catch(""),
  weaponSearch: z.string().catch(""),
  artifactSearch: z.string().catch(""),
  bossSearch: z.string().catch(""),
  selectedCharacterId: z.string().nullable().catch(null),
  selectedBossId: z.number().nullable().catch(null),
});

// ─── Team comp session navigation ───

const ViewSettingsSchema = z
  .object({
    activeTeamId: z
      .string()
      .nullable()
      .catch(DEFAULT_VIEW_SETTINGS.activeTeamId),
    ownedOnly: z.boolean().nullable().catch(DEFAULT_VIEW_SETTINGS.ownedOnly),
    teamSort: z
      .enum(["default", "tier", "release"])
      .catch(DEFAULT_VIEW_SETTINGS.teamSort),
    erCalcExpanded: z.boolean().catch(DEFAULT_VIEW_SETTINGS.erCalcExpanded),
  })
  .catch(DEFAULT_VIEW_SETTINGS);

export const PersistedSessionNavStoreSchema = z.object({
  viewSettings: z
    .object({
      damage: ViewSettingsSchema,
      investment: ViewSettingsSchema,
      weaponChoice: ViewSettingsSchema,
    })
    .catch({
      damage: DEFAULT_VIEW_SETTINGS,
      investment: DEFAULT_VIEW_SETTINGS,
      weaponChoice: DEFAULT_VIEW_SETTINGS,
    }),
});

// ─── Analyzer cache ───

export const PersistedAnalyzerCacheStoreSchema = z.object({
  lastByTeam: z.record(z.string(), z.unknown()).catch({}),
});
