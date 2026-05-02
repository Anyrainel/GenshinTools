/**
 * Zod schemas for validating and healing persisted store data.
 *
 * These heal persisted store payloads at the storage boundary.
 * All schemas use `.catch()` so invalid data is healed to safe defaults
 * instead of throwing — the app never crashes on corrupted localStorage.
 */
import { z } from "zod";
import type { SortDirection } from "@/data/enums";
import type { GlobalStatWeights } from "@/data/types";
import {
  DEFAULT_MIN_SCORE_DIFF,
  DEFAULT_TIER_THRESHOLDS,
} from "@/lib/account-data/resourceTips";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { inferTriageBackupAmountMode } from "@/lib/account-data/triage/settings";
import { DEFAULT_COMPUTE_OPTIONS } from "@/lib/artifact-builds/computeFilters";
import { isCustomDelta, isPresetDelta } from "@/lib/presetDelta";
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

// ─── ArtifactData ───

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

// ─── CharacterData ───

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

// ─── AccountData ───

export const AccountDataSchema = z
  .object({
    characters: z.array(CharacterDataSchema).catch([]),
    extraArtifacts: z.array(ArtifactDataSchema).catch([]),
    extraWeapons: z.array(WeaponDataSchema).catch([]),
  })
  .loose();

// ─── Account ───

const AccountSchema = z.object({
  id: z.number(),
  name: z.string(),
  data: AccountDataSchema,
  lastUpdate: z.number().finite().catch(0),
});

export const PersistedAccountStoreSchema = z.object({
  accounts: z.record(z.string(), AccountSchema).catch({}),
  activeAccountId: z.number().nullable().catch(null),
});

export const PersistedAccountScoreCacheStoreSchema = z.object({
  scoresByProfileId: z
    .record(z.string(), z.record(z.string(), z.unknown().nullable()))
    .catch({}),
  staleScoreCharIdsByProfileId: z
    .record(z.string(), z.union([z.literal(true), z.array(z.string())]))
    .catch({}),
});

// ─── Build ───

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

const RawBuildDeltaSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("preset"),
      id: z.string(),
      displayIndex: z.number().optional(),
      deleted: z.literal(true).optional(),
    })
    .loose(),
  z
    .object({
      kind: z.literal("custom"),
      id: z.string(),
      value: BuildSchema,
      displayIndex: z.number().optional(),
    })
    .loose(),
]);

const BuildDeltasSchema = z
  .array(z.unknown())
  .catch([])
  .transform((items) =>
    items.flatMap((item) => {
      const parsed = RawBuildDeltaSchema.safeParse(item);
      if (!parsed.success) return [];
      const delta = parsed.data;
      if (isCustomDelta(delta) || isPresetDelta(delta)) return [delta];
      return [];
    })
  );

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
  deltas: BuildDeltasSchema,
  activePresetId: z.string().nullable().catch(null),
  hasPromptedForPreset: z.boolean().catch(false),
  hiddenCharacters: z.record(z.string(), z.boolean()).catch({}),
  characterWeapons: z.record(z.string(), z.array(z.string())).catch({}),
  computeOptions: ComputeOptionsSchema,
  author: z.string().catch(""),
  description: z.string().catch(""),
});

// ─── Team Store ───

const TeamCompSlotSchema = z.object({
  charId: z.string().nullable().catch(null),
  weaponId: z.string().nullable().catch(null),
  artifactSet: ArtifactSetConfigSchema.nullable().catch(null),
});

export const TeamCompSchema = z
  .object({
    id: z.string(),
    name: z.string().catch(""),
    slots: z.array(TeamCompSlotSchema).catch([]),
    reactions: z.array(z.string()).catch([]),
  })
  .loose();

const TeamCharConfigSchema = z
  .object({
    level: z.number().optional(),
    constellation: z.number().optional(),
    refinement: z.number().optional(),
    talentLevels: z
      .object({
        auto: z.number().optional(),
        skill: z.number().optional(),
        burst: z.number().optional(),
      })
      .optional(),
    minEr: z.number().optional(),
    minCr: z.number().optional(),
    crMode: z.enum(["min", "target"]).optional(),
    tierAwarePool: z.boolean().optional(),
    fullSetOptional: z.boolean().optional(),
  })
  .loose();

const TeamDamageConfigSchema = z
  .object({
    calcContext: z.record(z.string(), z.unknown()).optional(),
    enemyAura: z.string().optional(),
    extraBuffs: z.array(z.unknown()).optional(),
    selectedFormula: z
      .object({
        charId: z.string(),
        formulaId: z.string(),
      })
      .nullable()
      .optional(),
    singleReaction: z.unknown().optional(),
    singleForceOnField: z.boolean().optional(),
    formulaMode: z.enum(["single", "combo"]).optional(),
    combo: z.unknown().nullable().optional(),
  })
  .loose();

const TeamSetupConfigSchema = z
  .object({
    combatOptions: z.record(z.string(), z.string()).catch({}),
    charConfigs: z.record(z.string(), TeamCharConfigSchema).optional(),
    damage: TeamDamageConfigSchema.optional(),
    energy: z
      .object({
        timelines: z.array(z.unknown()).optional(),
      })
      .loose()
      .optional(),
    investment: z.unknown().optional(),
  })
  .loose()
  .catch({ combatOptions: {} });

const RawTeamCompDeltaSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("preset"),
      id: z.string(),
      displayIndex: z.number().optional(),
      deleted: z.literal(true).optional(),
    })
    .loose(),
  z
    .object({
      kind: z.literal("custom"),
      id: z.string(),
      value: TeamCompSchema,
      displayIndex: z.number().optional(),
    })
    .loose(),
]);

const TeamCompDeltasSchema = z
  .array(z.unknown())
  .catch([])
  .transform((items) =>
    items.flatMap((item) => {
      const parsed = RawTeamCompDeltaSchema.safeParse(item);
      if (!parsed.success) return [];
      const delta = parsed.data;
      if (isCustomDelta(delta) || isPresetDelta(delta)) return [delta];
      return [];
    })
  );

export const PersistedTeamStoreSchema = z.object({
  activePresetId: z.string().nullable().catch(null),
  compDeltas: TeamCompDeltasSchema,
  configsByTeamId: z.record(z.string(), TeamSetupConfigSchema).catch({}),
  author: z.string().catch(""),
  description: z.string().catch(""),
});

// ─── Freeze ───

const FrozenArtifactIdSlotMapSchema = z
  .record(z.string(), z.string())
  .catch({});

const FrozenTeamLoadoutSchema = z
  .object({
    frozenCharIds: z.array(z.string()).catch([]),
    artifactIdsByChar: z
      .record(z.string(), FrozenArtifactIdSlotMapSchema)
      .catch({}),
  })
  .loose();

const FreezeProfileSchema = z.object({
  frozenTeamLoadouts: z.record(z.string(), FrozenTeamLoadoutSchema).catch({}),
  reuseMode: z.enum(["none", "sameChar", "forceReuse"]).catch("sameChar"),
  frozenArtifactIds: z.array(z.string()).catch([]),
});

export const PersistedFreezeStoreSchema = z.object({
  freezesByProfileId: z.record(z.string(), FreezeProfileSchema).catch({}),
});

// ─── ResourceRec ───

const TierThresholdsSchema = z.record(z.string(), z.number()).catch({});
const ScoreDiffSchema = z.record(z.string(), z.number()).catch({});
const MinScoreDiffSchema = z
  .object({
    craft: ScoreDiffSchema,
    reroll: ScoreDiffSchema,
    levelup: ScoreDiffSchema,
  })
  .catch({ craft: {}, reroll: {}, levelup: {} });

const ResourceRecSettingsSchema = z.object({
  thresholds: TierThresholdsSchema.catch(DEFAULT_TIER_THRESHOLDS),
  minScoreDiff: MinScoreDiffSchema.catch(DEFAULT_MIN_SCORE_DIFF),
  panelOpen: z.boolean().catch(false),
  showCraft: z.boolean().catch(true),
  showReroll: z.boolean().catch(true),
  showLevelup: z.boolean().catch(true),
});

export const PersistedResourceRecStoreSchema = z.object({
  settingsByProfileId: z
    .record(z.string(), ResourceRecSettingsSchema)
    .catch({}),
});

// ─── Triage ───

const CustomFlexInputSchema = z.object({
  slot: z.string(),
  mainStat: z.string(),
  requiredSubs: z.array(z.string()).catch([]),
});

const TriageSettingsSchema = z
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
    backupAmountMode: z
      .enum(["normal", "extra", "custom"])
      .optional()
      .catch(DEFAULT_TRIAGE_SETTINGS.backupAmountMode),
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
    levelProtection: z.number().catch(DEFAULT_TRIAGE_SETTINGS.levelProtection),
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
  .transform((settings) => ({
    ...settings,
    backupAmountMode:
      settings.backupAmountMode ?? inferTriageBackupAmountMode(settings),
  }))
  .catch(DEFAULT_TRIAGE_SETTINGS);

export const PersistedTriageStoreSchema = z.object({
  settingsByProfileId: z.record(z.string(), TriageSettingsSchema).catch({}),
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

const GenericTierListInstanceSchema = PersistedBaseTierStoreSchema.extend({
  id: z.number(),
});

export const PersistedTierListStoreSchema = z.object({
  tierLists: z.record(z.string(), TierListInstanceSchema).catch({}),
  activeTierListId: z.number().catch(1),
  nextId: z.number().catch(2),
  showWeapons: z.boolean().catch(true),
  showTravelers: z.boolean().catch(false),
  showManekin: z.boolean().catch(false),
});

export const PersistedGenericTierListStoreSchema = z.object({
  tierLists: z.record(z.string(), GenericTierListInstanceSchema).catch({}),
  activeTierListId: z.number().catch(1),
  nextId: z.number().catch(2),
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

// ─── Cloud sync metadata ───

const CloudSyncPartitionMetaSchema = z
  .object({
    namespace: z.string(),
    partitionKey: z.string(),
    lastSeenRev: z.string().optional(),
    lastAppliedHash: z.string().optional(),
    lastUploadedHash: z.string().optional(),
    lastSyncedAt: z.number().optional(),
    dirty: z.boolean().optional().catch(undefined),
    updatedAt: z.number().catch(0),
  })
  .loose();

const CloudSyncConflictMetaSchema = z
  .object({
    id: z.string(),
    namespace: z.string(),
    partitionKey: z.string(),
    groupKey: z.string(),
    conflictPolicy: z.string(),
    reason: z.string(),
    detectedAt: z.number().catch(0),
    localHash: z.string().optional(),
    remoteHash: z.string().optional(),
    localUpdatedAt: z.number().optional(),
    remoteUpdatedAt: z.number().optional(),
    remoteRev: z.string().optional(),
  })
  .loose();

export const PersistedCloudSyncMetadataStoreSchema = z.object({
  deviceId: z.string().catch(""),
  partitionsById: z.record(z.string(), CloudSyncPartitionMetaSchema).catch({}),
  conflictsById: z.record(z.string(), CloudSyncConflictMetaSchema).catch({}),
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

const TeamResultCacheEntrySchema = z.object({
  optimizationResult: z.unknown().nullable().optional(),
  investmentResult: z.unknown().nullable().optional(),
  weaponChoiceResult: z.unknown().nullable().optional(),
  artifactChoiceResult: z.unknown().nullable().optional(),
});

export const PersistedTeamResultCacheStoreSchema = z.object({
  resultsByTeamId: z.record(z.string(), TeamResultCacheEntrySchema).catch({}),
});
