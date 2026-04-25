/**
 * Zod schemas for validating and healing persisted store data.
 *
 * These replace the imperative `repair*` functions in storeValidation.ts.
 * All schemas use `.catch()` so invalid data is healed to safe defaults
 * instead of throwing — the app never crashes on corrupted localStorage.
 */
import { z } from "zod";

import { ArtifactSetConfigSchema } from "@/lib/team-comp/schemas";

// ─── Shared lightweight persisted shapes ───

const TierAssignmentItemSchema = z
  .object({
    tier: z.string(),
    position: z.number().catch(0),
  })
  .passthrough();

const TierCustomizationItemSchema = z
  .object({
    displayName: z.string().catch(""),
    hidden: z.boolean().catch(false),
    luckExpectation: z.number().optional(),
  })
  .passthrough();

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
  .passthrough();

// ─── WeaponData ───

export const WeaponDataSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    level: z.number(),
    refinement: z.number(),
    lock: z.boolean().catch(false),
  })
  .passthrough();

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
  .passthrough();

// ─── AccountData (replaces repairAccountData) ───

export const AccountDataSchema = z
  .object({
    characters: z.array(CharacterDataSchema).catch([]),
    extraArtifacts: z.array(ArtifactDataSchema).catch([]),
    extraWeapons: z.array(WeaponDataSchema).catch([]),
  })
  .passthrough();

// ─── Account ───

const AccountSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    data: AccountDataSchema,
    scores: z.record(z.string(), z.unknown()).catch({}),
    lastUpdate: z.number().catch(0),
  })
  .passthrough();

export const PersistedAccountStoreSchema = z.object({
  accounts: z.record(z.string(), AccountSchema).catch({}),
  activeAccountId: z.string().nullable().catch(null),
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
  .passthrough();

const ComputeOptionsSchema = z
  .object({
    expandElementalGoblet: z.boolean().optional(),
    expandCritCirclet: z.boolean().optional(),
    mergeAlgorithm: z.string().optional(),
    normalizeFlatStats: z.boolean().optional(),
    substatWeightThreshold: z.number().optional(),
    mustPresentWeightThreshold: z.number().optional(),
  })
  .passthrough()
  .catch({});

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
  .passthrough();

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
  .passthrough();

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
  showCraft: z.boolean().catch(true),
  showReroll: z.boolean().catch(true),
  showLevelup: z.boolean().catch(true),
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
      triageMode: z.enum(["strict", "loose"]).catch("loose"),
      mainStatThreshold: z.number().catch(90),
      optionalSubThreshold: z.number().catch(50),
      fillerKeep: z.number().catch(5),
      qualityMargin: z.number().catch(5),
      setSlotKeep: z.number().catch(3),
      ownedOnly: z.boolean().catch(true),
      erHoardingEnabled: z.boolean().catch(true),
      erHoardingAllEnabled: z.boolean().catch(false),
      doubleCritLockEnabled: z.boolean().catch(true),
      levelProtection: z.number().catch(12),
      highLevelProtection: z.boolean().catch(true),
      equippedProtection: z.boolean().catch(true),
      disabledFlexPatterns: z.array(z.string()).catch([]),
      enabledFlexPatterns: z.array(z.string()).catch([]),
      customFlexInputs: z.array(CustomFlexInputSchema).catch([]),
    })
    .passthrough()
    .catch({
      triageMode: "loose" as const,
      mainStatThreshold: 90,
      optionalSubThreshold: 50,
      fillerKeep: 5,
      qualityMargin: 5,
      setSlotKeep: 3,
      ownedOnly: true,
      erHoardingEnabled: true,
      erHoardingAllEnabled: false,
      doubleCritLockEnabled: true,
      levelProtection: 12,
      highLevelProtection: true,
      equippedProtection: true,
      disabledFlexPatterns: [],
      enabledFlexPatterns: [],
      customFlexInputs: [],
    }),
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
  linkedAccountId: z.string().nullable().catch(null),
});

export const PersistedTierListStoreSchema = z.object({
  tierLists: z.record(z.string(), TierListInstanceSchema).catch({}),
  activeTierListId: z.number().catch(1),
  nextId: z.number().catch(2),
  showWeapons: z.boolean().catch(true),
  showTravelers: z.boolean().catch(false),
  showManekin: z.boolean().catch(false),
  recommendationPrefs: z
    .object({
      scoreDiffThreshold: z.number().catch(1),
      includeUpgrades: z.boolean().catch(true),
    })
    .catch({ scoreDiffThreshold: 1, includeUpgrades: true }),
});

// ─── Preferences ───

export const PersistedPreferencesStoreSchema = z.object({
  characterSort: z
    .object({
      tierSort: z.enum(["asc", "desc", "off"]).catch("desc"),
      releaseSort: z.enum(["asc", "desc", "off"]).catch("desc"),
      scoreSort: z.enum(["asc", "desc", "off"]).catch("off"),
    })
    .catch({ tierSort: "desc", releaseSort: "desc", scoreSort: "off" }),
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
          flatAtk: z.number().catch(30),
          flatHp: z.number().catch(30),
          flatDef: z.number().catch(30),
        })
        .catch({ flatAtk: 30, flatHp: 30, flatDef: 30 }),
    })
    .catch({ global: { flatAtk: 30, flatHp: 30, flatDef: 30 } }),
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
    activeTeamId: z.string().nullable().catch(null),
    ownedOnly: z.boolean().nullable().catch(null),
    teamSort: z.enum(["default", "tier", "release"]).catch("default"),
    erCalcExpanded: z.boolean().catch(false),
  })
  .catch({
    activeTeamId: null,
    ownedOnly: null,
    teamSort: "default" as const,
    erCalcExpanded: false,
  });

export const PersistedSessionNavStoreSchema = z.object({
  viewSettings: z
    .object({
      damage: ViewSettingsSchema,
      investment: ViewSettingsSchema,
      weaponChoice: ViewSettingsSchema,
    })
    .catch({
      damage: {
        activeTeamId: null,
        ownedOnly: null,
        teamSort: "default" as const,
        erCalcExpanded: false,
      },
      investment: {
        activeTeamId: null,
        ownedOnly: null,
        teamSort: "default" as const,
        erCalcExpanded: false,
      },
      weaponChoice: {
        activeTeamId: null,
        ownedOnly: null,
        teamSort: "default" as const,
        erCalcExpanded: false,
      },
    }),
});

// ─── Analyzer cache ───

export const PersistedAnalyzerCacheStoreSchema = z.object({
  lastByTeam: z.record(z.string(), z.unknown()).catch({}),
});
