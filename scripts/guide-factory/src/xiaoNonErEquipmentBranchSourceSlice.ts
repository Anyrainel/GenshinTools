import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Text, stableJson } from "./io";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
} from "./schemas";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";
import {
  authenticateXiaoSourceLocalConditionSliceReport,
  XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
  type XiaoSourceLocalConditionSliceReport,
} from "./xiaoSourceLocalConditionSlice";

const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const XIAO_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const XIAO_SOURCE_LOCAL_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-source-local-condition-slice.json";
const CORE_PATH =
  "scripts/guide-factory/src/xiaoNonErEquipmentBranchSourceSlice.ts";
const CLI_PATH =
  "scripts/guide-factory/src/assemble-xiao-non-er-equipment-branch-source-slice.ts";
const PATHS_PATH = "scripts/guide-factory/src/paths.ts";

const SLICE_ID =
  "kqm-xiao-non-er-equipment-branch-source-slice-version-5-5";

const FIVE_STAR_SOURCE_RECORD_ID =
  "xiao-five-star-weapon-tiers-version-5-5";
const FOUR_STAR_SOURCE_RECORD_ID =
  "xiao-unranked-four-star-weapons-version-5-5";
const STATS_SOURCE_RECORD_ID =
  "xiao-offensive-artifact-stats-version-5-5";

const RECORD_BOUNDARIES = [
  {
    sourceRecordId: FIVE_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-five-star-weapon-tiers-version-5-5",
    recommendationId: "five-star-weapon-tiers",
    scope: "weapons",
    weaponOrdering: "ranked-groups",
  },
  {
    sourceRecordId: FOUR_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-unranked-four-star-weapons-version-5-5",
    recommendationId: "unranked-four-star-weapons",
    scope: "weapons",
    weaponOrdering: "unranked",
  },
  {
    sourceRecordId: STATS_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-offensive-artifact-stats-version-5-5",
    recommendationId: "offensive-artifact-stats-with-energy-deferred",
    scope: "artifact-stats",
    weaponOrdering: null,
  },
] as const;

type SourceAxis =
  | "weapon"
  | "main-stat:sands"
  | "main-stat:circlet"
  | "substats";
type UpstreamDisposition = "holdout" | "empty-unconditional";
type ConditionRole =
  | "none"
  | "owned-best-available-pull-policy"
  | "team-composition-and-refinement"
  | "healing-and-rotation-timing"
  | "enemy-defeat-and-scenario"
  | "refinement-floor-energy-effect-deferred"
  | "swirl-and-rotation-uptime"
  | "candidate-stat-dependent-circlet-selection"
  | "incomplete-offensive-tail-after-deferred-er";

interface ExpectedOccurrence {
  occurrenceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  manualItemPath: string;
  repositoryItemPath: string;
  axis: SourceAxis;
  upstreamDisposition: UpstreamDisposition;
  conditionRole: ConditionRole;
  expectedItem: Record<string, unknown>;
  sourcePosition: number;
  sourceRankGroup: number | null;
}

const EXPECTED_OCCURRENCES = [
  weaponOccurrence({
    sourceRecordId: FIVE_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-five-star-weapon-tiers-version-5-5",
    index: 0,
    sourceRankGroup: 1,
    classification: "default",
    conditions: [],
    weaponIds: [
      "primordial_jade_wingedspear",
      "staff_of_homa",
      "lumidouce_elegy",
    ],
    conditionRole: "none",
  }),
  weaponOccurrence({
    sourceRecordId: FIVE_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-five-star-weapon-tiers-version-5-5",
    index: 1,
    sourceRankGroup: 2,
    classification: "alternative",
    conditions: [],
    weaponIds: ["vortex_vanquisher", "calamity_queller"],
    conditionRole: "none",
  }),
  weaponOccurrence({
    sourceRecordId: FIVE_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-five-star-weapon-tiers-version-5-5",
    index: 2,
    sourceRankGroup: 3,
    classification: "available-only",
    conditions: [
      "Use these source Tier 3 options when already owned and they are the best available option; the source does not recommend pulling them specifically for Xiao.",
    ],
    weaponIds: [
      "staff_of_the_scarlet_sands",
      "engulfing_lightning",
      "skyward_spine",
    ],
    conditionRole: "owned-best-available-pull-policy",
  }),
  weaponOccurrence({
    sourceRecordId: FOUR_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-unranked-four-star-weapons-version-5-5",
    index: 0,
    sourceRankGroup: null,
    classification: "conditional",
    conditions: [
      "The team contains enough Liyue characters and the weapon has sufficient Refinement for its team-dependent passive.",
    ],
    weaponIds: ["lithic_spear"],
    conditionRole: "team-composition-and-refinement",
  }),
  weaponOccurrence({
    sourceRecordId: FOUR_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-unranked-four-star-weapons-version-5-5",
    index: 1,
    sourceRankGroup: null,
    classification: "alternative",
    conditions: [],
    weaponIds: ["deathmatch"],
    conditionRole: "none",
  }),
  weaponOccurrence({
    sourceRecordId: FOUR_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-unranked-four-star-weapons-version-5-5",
    index: 2,
    sourceRankGroup: null,
    classification: "conditional",
    conditions: [
      "Xiao can receive healing to build the passive, and the rotation can accommodate its second-rotation and Skill-or-Burst timing constraints.",
    ],
    weaponIds: ["prospectors_drill"],
    conditionRole: "healing-and-rotation-timing",
  }),
  weaponOccurrence({
    sourceRecordId: FOUR_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-unranked-four-star-weapons-version-5-5",
    index: 3,
    sourceRankGroup: null,
    classification: "conditional",
    conditions: [
      "Xiao can defeat opponents to activate the passive; the source notes that it is often inactive against a single opponent or high-HP opponents.",
    ],
    weaponIds: ["blackcliff_pole"],
    conditionRole: "enemy-defeat-and-scenario",
  }),
  weaponOccurrence({
    sourceRecordId: FOUR_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-unranked-four-star-weapons-version-5-5",
    index: 4,
    sourceRankGroup: null,
    classification: "conditional",
    conditions: [
      "Favonius Lance is at least Refinement 3; this observation does not infer an Energy Recharge target.",
    ],
    weaponIds: ["favonius_lance"],
    conditionRole: "refinement-floor-energy-effect-deferred",
  }),
  weaponOccurrence({
    sourceRecordId: FOUR_STAR_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-unranked-four-star-weapons-version-5-5",
    index: 5,
    sourceRankGroup: null,
    classification: "conditional",
    conditions: [
      "The team lets Xiao trigger Swirl consistently enough to maintain the weapon passive.",
    ],
    weaponIds: ["missive_windspear"],
    conditionRole: "swirl-and-rotation-uptime",
  }),
  statOccurrence({
    itemPath: "mainStats.sands[0]",
    axis: "main-stat:sands",
    sourcePosition: 0,
    expectedItem: { conditions: [], statIds: ["atk%"] },
    conditionRole: "none",
  }),
  statOccurrence({
    itemPath: "mainStats.circlet[0]",
    axis: "main-stat:circlet",
    sourcePosition: 0,
    expectedItem: {
      conditions: [
        "Choose between CRIT Rate and CRIT DMG according to the weapon and artifact substats while maintaining at least 70% CRIT Rate.",
      ],
      statIds: ["cr", "cd"],
    },
    conditionRole: "candidate-stat-dependent-circlet-selection",
  }),
  statOccurrence({
    itemPath: "substats[0]",
    axis: "substats",
    sourcePosition: 0,
    expectedItem: {
      conditions: [
        "This priority covers only the offensive tail after the source's deliberately omitted Energy Recharge need.",
      ],
      priority: 1,
      statIds: ["cr", "cd"],
      target:
        "At least 70% CRIT Rate, then further CRIT Rate and CRIT DMG balanced near a 1:2 ratio.",
    },
    conditionRole: "incomplete-offensive-tail-after-deferred-er",
  }),
  statOccurrence({
    itemPath: "substats[1]",
    axis: "substats",
    sourcePosition: 1,
    expectedItem: {
      conditions: [
        "This priority covers only the offensive tail after the source's deliberately omitted Energy Recharge need.",
      ],
      priority: 2,
      statIds: ["atk%"],
    },
    conditionRole: "incomplete-offensive-tail-after-deferred-er",
  }),
] as const satisfies readonly ExpectedOccurrence[];

const CAPABILITIES = {
  arbitraryEnglishParsingAllowed: false,
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsEquipmentRecommendations: false,
  supportsBuildRecommendations: false,
  supportsStatRecommendations: false,
  supportsDerivedRankClaims: false,
  supportsCrossRarityRankClaims: false,
  supportsDamageClaims: false,
  supportsFormulaClaims: false,
  supportsRotationClaims: false,
  supportsEnergyRecoveryClaims: false,
  applicabilityEvaluationExecuted: false,
  crossRecordCompositionExecuted: false,
  candidateGenerationExecuted: false,
  choiceSelectionExecuted: false,
  compatibilityEvaluationExecuted: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  damageComputationExecuted: false,
  rotationComputationExecuted: false,
  idealRollAllocationExecuted: false,
  energyRecoveryComputationExecuted: false,
} as const;

const CAUTIONS = [
  "These thirteen rows are agent-assisted, unreviewed source observations, not a Xiao guide or a recommendation produced by the Guide Factory.",
  "Five-star rank applies only to the three source groups; members inside each group remain tied, all four-star options remain unranked, and no cross-rarity order is defined.",
  "Source-condition-free means the source row has an empty condition array. It does not mean universally best, compatible with every build, or selected for FFXX.",
  "The Circlet choice requires candidate stats, and the two substat rows are only an offensive tail after an omitted Energy Recharge need. They do not form a complete stat plan.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not publish this source slice as a Xiao guide, equipment ranking, complete build, or stat-weight recommendation.",
  "Do not turn four-star source positions into ranks or place a four-star option before, after, or inside the five-star ranked groups.",
  "Do not treat a guarded row as applicable, select CRIT Rate versus CRIT DMG, or infer weapon passive uptime without authenticated evaluation inputs.",
  "Do not infer formula counts, damage, DPS, gameplay feasibility, ideal rolls, or an Energy Recharge requirement from this report.",
] as const;

export interface XiaoNonErEquipmentBranchSourceFile {
  path: string;
  text: string;
}

export interface BuildXiaoNonErEquipmentBranchSourceSliceInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  xiaoSourceLocalDurableReportInput: unknown;
  sourceFiles: readonly XiaoNonErEquipmentBranchSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface XiaoNonErEquipmentBranchOccurrence {
  occurrenceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  manualClaimPath: string;
  repositoryPath: string;
  axis: SourceAxis;
  sourcePosition: number;
  sourcePositionIsRank: boolean;
  sourceRankGroup: number | null;
  upstreamCheckpoint42Disposition: UpstreamDisposition;
  upstreamCheckpoint42BindingAuthored: false;
  projectedAsSourceObservationOnly: true;
  sourceItem: Record<string, unknown>;
  sourceItemSha256: string;
  conditions: string[];
  conditionsSha256: string;
  sourceConditionStatus: "source-condition-free" | "guarded-unresolved";
  conditionRole: ConditionRole;
  conditionRoleAuthoredBy: "guide-factory-exact-source-adapter";
  conditionTruthEvaluated: false;
  conditionBindingAuthoredByThisSlice: false;
  energyRecoveryValueProjected: false;
  occurrenceSha256: string;
}

export interface XiaoNonErWeaponGroup {
  occurrenceId: string;
  sourceRecordId: string;
  rarityClass: "five-star" | "four-star";
  weaponOrdering: "ranked-groups" | "unranked";
  sourcePosition: number;
  sourcePositionIsRank: boolean;
  sourceRankGroup: number | null;
  grouping: "tied" | "single";
  classification: string;
  weaponIds: string[];
  conditions: string[];
  sourceConditionStatus: "source-condition-free" | "guarded-unresolved";
  conditionRole: ConditionRole;
  normalizedGuard:
    | {
        type: "refinement-at-least";
        weaponId: "favonius_lance";
        refinement: 3;
        satisfaction: "not-evaluated";
        energyEffect: "deferred";
      }
    | null;
  sourceGroupSha256: string;
}

export interface XiaoNonErStatGroup {
  occurrenceId: string;
  slot: "sands" | "circlet";
  statIds: string[];
  sourcePosition: number;
  sourceConditionStatus: "source-condition-free" | "guarded-unresolved";
  conditionRole: ConditionRole;
  selectionExecuted: false;
  sourceGroupSha256: string;
}

export interface XiaoNonErSubstatPriorityGroup {
  occurrenceId: string;
  priority: number;
  statIds: string[];
  target: string | null;
  conditionsSha256: string;
  sharesGuardWithOccurrenceIds: string[];
  sourceConditionStatus: "guarded-unresolved";
  conditionRole: "incomplete-offensive-tail-after-deferred-er";
  completePriorityPlan: false;
  sourceGroupSha256: string;
}

export interface XiaoNonErEquipmentBranchSourceSliceReport {
  schemaVersion: 1;
  reportType: "xiao-non-er-equipment-branch-source-slice";
  sliceId: typeof SLICE_ID;
  classification: "authenticated-source-only-non-er-equipment-branch-domain";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-source-slice";
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted" | "rejected";
    exactSourceFilePathSet: boolean;
    exactGeneratedFromPathSet: boolean;
    allDeclaredGeneratedFromHashesAuthenticatedFromBytes: boolean;
    jsonInputByteAndParsedObjectParity: boolean;
    sourceFileCount: number;
    generatedFromCount: number;
    jsonInputCount: number;
  };
  upstreamBoundary: {
    status: "accepted" | "rejected";
    durableReportPath: typeof XIAO_SOURCE_LOCAL_REPORT_PATH;
    durableReportFileSha256: string | null;
    durableReportCanonicalObjectSha256: string | null;
    freshlyAuthenticated: boolean;
    upstreamInputCount: number;
    selectedOccurrenceCount: number;
    holdoutOccurrenceCount: number;
    emptyOccurrenceCount: number;
    projectedHoldoutOccurrenceCount: number;
    projectedEmptyOccurrenceCount: number;
    conditionBindingsAddedToCheckpoint42: 0;
  };
  sourceBoundary: {
    status: "accepted" | "rejected";
    sourceId: "kqm";
    characterId: "xiao";
    sourceVersion: "Version 5.5";
    sourceRecordIds: string[];
    repositoryRecordIds: string[];
    sourceRecordCount: number;
    occurrenceCount: number;
    manualRepositoryItemParity: "exact" | "not-evaluated";
    extractionMethod: "agent-assisted";
    reviewStatus: "unreviewed";
    promotionEligible: false;
  };
  rankingBoundary: {
    fiveStarOrdering: "ranked-groups";
    fiveStarMembersWithinGroup: "tied";
    fourStarOrdering: "unranked";
    fourStarSourcePositionsAreRanks: false;
    crossRarityOrdering: "not-defined";
    sourceRankedFiveStarGroupCount: number;
    guideFactoryDerivedRankCount: 0;
  };
  completenessBoundary: {
    axisVocabulary: [
      "weapon",
      "artifact-set",
      "main-stat:sands",
      "main-stat:goblet",
      "main-stat:circlet",
      "substats",
    ];
    representedAxes: ["weapon", "main-stat:sands", "main-stat:circlet", "substats"];
    missingAxes: ["artifact-set", "main-stat:goblet"];
    missingAxisPolicy: "outside-this-source-slice-no-default";
    circletSelection: "guarded-not-executed";
    substatPlan: "guarded-incomplete-offensive-tail";
    energyRecovery: "excluded-deferred";
  };
  occurrences: XiaoNonErEquipmentBranchOccurrence[];
  rankedFiveStarGroups: XiaoNonErWeaponGroup[];
  unrankedFourStarOptions: XiaoNonErWeaponGroup[];
  mainStatChoiceGroups: XiaoNonErStatGroup[];
  guardedOffensiveTailPriorities: XiaoNonErSubstatPriorityGroup[];
  conditionFreeOccurrenceIds: string[];
  conditionallyDeferredOccurrenceIds: string[];
  summary: {
    sourceRecordCount: number;
    occurrenceCount: number;
    conditionFreeOccurrenceCount: number;
    conditionallyDeferredOccurrenceCount: number;
    uniqueNonemptyConditionArrayCount: number;
    weaponGroupCount: number;
    uniqueWeaponCount: number;
    rankedFiveStarGroupCount: number;
    rankedFiveStarWeaponCount: number;
    unrankedFourStarOptionCount: number;
    unrankedFourStarWeaponCount: number;
    conditionFreeWeaponGroupCount: number;
    conditionFreeWeaponLeafCount: number;
    guardedWeaponGroupCount: number;
    guardedWeaponLeafCount: number;
    mainStatChoiceGroupCount: number;
    mainStatLeafCount: number;
    substatPriorityGroupCount: number;
    substatLeafCount: number;
    sourceRecommendationObservationCount: number;
    candidateCount: 0;
    completeBuildCount: 0;
    guideFactoryRecommendationCount: 0;
    derivedRankCount: 0;
  };
  arbitraryEnglishParsingAllowed: false;
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsBuildRecommendations: false;
  supportsStatRecommendations: false;
  supportsDerivedRankClaims: false;
  supportsCrossRarityRankClaims: false;
  supportsDamageClaims: false;
  supportsFormulaClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  applicabilityEvaluationExecuted: false;
  crossRecordCompositionExecuted: false;
  candidateGenerationExecuted: false;
  choiceSelectionExecuted: false;
  compatibilityEvaluationExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  damageComputationExecuted: false;
  rotationComputationExecuted: false;
  idealRollAllocationExecuted: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
  issues: Array<{ code: string; path: string; message: string }>;
}

export type XiaoNonErEquipmentBranchSourceSliceAuthentication =
  | {
      authenticated: true;
      canonicalReport: XiaoNonErEquipmentBranchSourceSliceReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: Array<{ code: string; path: string; message: string }>;
    };

export const XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS = [
  ...new Set([
    ...XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
    REPOSITORY_PATH,
    MANUAL_INDEX_PATH,
    SOURCE_REGISTRY_PATH,
    XIAO_SOURCE_LOCAL_REPORT_PATH,
    CORE_PATH,
    CLI_PATH,
    PATHS_PATH,
  ]),
].sort(compareText);

export const XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS =
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS;

export const XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "xiao-non-er-equipment-branch-source-slice.json",
);

export function buildXiaoNonErEquipmentBranchSourceSliceReport(
  input: BuildXiaoNonErEquipmentBranchSourceSliceInput,
): XiaoNonErEquipmentBranchSourceSliceReport {
  let generatedFrom: GeneratedFromEntry[] = [];
  let upstreamFileSha256: string | null = null;
  let upstreamObjectSha256: string | null = null;
  try {
    const authenticatedFiles = authenticateInputFiles(input);
    generatedFrom = authenticatedFiles.generatedFrom;
    const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
    const snapshot = ManualObservationSnapshotSchema.parse(
      input.manualSnapshotInput,
    );
    const manualIndex = ManualSnapshotIndexSchema.parse(input.manualIndexInput);
    const sourceRegistry = SourceRegistrySchema.parse(input.sourceRegistryInput);
    const upstream = input.xiaoSourceLocalDurableReportInput as
      XiaoSourceLocalConditionSliceReport;

    authenticateJsonParity(authenticatedFiles.byPath, {
      [REPOSITORY_PATH]: repository,
      [XIAO_SNAPSHOT_PATH]: snapshot,
      [MANUAL_INDEX_PATH]: manualIndex,
      [SOURCE_REGISTRY_PATH]: sourceRegistry,
      [XIAO_SOURCE_LOCAL_REPORT_PATH]: upstream,
    });

    upstreamFileSha256 = sha256Text(
      requiredSourceText(authenticatedFiles.byPath, XIAO_SOURCE_LOCAL_REPORT_PATH),
    );
    upstreamObjectSha256 = hashValue(upstream);
    authenticateUpstream(
      upstream,
      repository,
      snapshot,
      manualIndex,
      sourceRegistry,
      authenticatedFiles.byPath,
    );
    authenticateSourceDocument(repository, snapshot);

    const occurrences = EXPECTED_OCCURRENCES.map((definition) =>
      buildOccurrence(definition, repository, snapshot, upstream),
    );
    authenticateOccurrenceClosure(occurrences);

    const rankedFiveStarGroups = occurrences
      .filter(({ sourceRecordId }) => sourceRecordId === FIVE_STAR_SOURCE_RECORD_ID)
      .map((occurrence) => weaponGroupFromOccurrence(occurrence, "five-star"));
    const unrankedFourStarOptions = occurrences
      .filter(({ sourceRecordId }) => sourceRecordId === FOUR_STAR_SOURCE_RECORD_ID)
      .map((occurrence) => weaponGroupFromOccurrence(occurrence, "four-star"));
    const mainStatChoiceGroups = occurrences
      .filter(
        ({ axis }) => axis === "main-stat:sands" || axis === "main-stat:circlet",
      )
      .map(statGroupFromOccurrence);
    const guardedOffensiveTailPriorities = occurrences
      .filter(({ axis }) => axis === "substats")
      .map((occurrence, _index, rows) =>
        substatGroupFromOccurrence(occurrence, rows),
      );
    const conditionFreeOccurrenceIds = occurrences
      .filter(({ sourceConditionStatus }) =>
        sourceConditionStatus === "source-condition-free",
      )
      .map(({ occurrenceId }) => occurrenceId);
    const conditionallyDeferredOccurrenceIds = occurrences
      .filter(({ sourceConditionStatus }) =>
        sourceConditionStatus === "guarded-unresolved",
      )
      .map(({ occurrenceId }) => occurrenceId);

    const allWeaponGroups = [
      ...rankedFiveStarGroups,
      ...unrankedFourStarOptions,
    ];
    const conditionFreeWeaponGroups = allWeaponGroups.filter(
      ({ sourceConditionStatus }) =>
        sourceConditionStatus === "source-condition-free",
    );
    const guardedWeaponGroups = allWeaponGroups.filter(
      ({ sourceConditionStatus }) =>
        sourceConditionStatus === "guarded-unresolved",
    );

    return {
      schemaVersion: 1,
      reportType: "xiao-non-er-equipment-branch-source-slice",
      sliceId: SLICE_ID,
      classification: "authenticated-source-only-non-er-equipment-branch-domain",
      comparisonStatus: "comparable",
      publicationStatus: "withheld-unreviewed-source-slice",
      generatedFrom,
      rawInputBoundary: {
        status: "accepted",
        exactSourceFilePathSet: true,
        exactGeneratedFromPathSet: true,
        allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
        jsonInputByteAndParsedObjectParity: true,
        sourceFileCount: authenticatedFiles.byPath.size,
        generatedFromCount: generatedFrom.length,
        jsonInputCount: 5,
      },
      upstreamBoundary: {
        status: "accepted",
        durableReportPath: XIAO_SOURCE_LOCAL_REPORT_PATH,
        durableReportFileSha256: upstreamFileSha256,
        durableReportCanonicalObjectSha256: upstreamObjectSha256,
        freshlyAuthenticated: true,
        upstreamInputCount: XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS.length,
        selectedOccurrenceCount: 3,
        holdoutOccurrenceCount: 14,
        emptyOccurrenceCount: 4,
        projectedHoldoutOccurrenceCount: 9,
        projectedEmptyOccurrenceCount: 4,
        conditionBindingsAddedToCheckpoint42: 0,
      },
      sourceBoundary: {
        status: "accepted",
        sourceId: "kqm",
        characterId: "xiao",
        sourceVersion: "Version 5.5",
        sourceRecordIds: RECORD_BOUNDARIES.map(({ sourceRecordId }) => sourceRecordId),
        repositoryRecordIds: RECORD_BOUNDARIES.map(
          ({ repositoryRecordId }) => repositoryRecordId,
        ),
        sourceRecordCount: 3,
        occurrenceCount: occurrences.length,
        manualRepositoryItemParity: "exact",
        extractionMethod: "agent-assisted",
        reviewStatus: "unreviewed",
        promotionEligible: false,
      },
      rankingBoundary: {
        fiveStarOrdering: "ranked-groups",
        fiveStarMembersWithinGroup: "tied",
        fourStarOrdering: "unranked",
        fourStarSourcePositionsAreRanks: false,
        crossRarityOrdering: "not-defined",
        sourceRankedFiveStarGroupCount: rankedFiveStarGroups.length,
        guideFactoryDerivedRankCount: 0,
      },
      completenessBoundary: {
        axisVocabulary: [
          "weapon",
          "artifact-set",
          "main-stat:sands",
          "main-stat:goblet",
          "main-stat:circlet",
          "substats",
        ],
        representedAxes: [
          "weapon",
          "main-stat:sands",
          "main-stat:circlet",
          "substats",
        ],
        missingAxes: ["artifact-set", "main-stat:goblet"],
        missingAxisPolicy: "outside-this-source-slice-no-default",
        circletSelection: "guarded-not-executed",
        substatPlan: "guarded-incomplete-offensive-tail",
        energyRecovery: "excluded-deferred",
      },
      occurrences,
      rankedFiveStarGroups,
      unrankedFourStarOptions,
      mainStatChoiceGroups,
      guardedOffensiveTailPriorities,
      conditionFreeOccurrenceIds,
      conditionallyDeferredOccurrenceIds,
      summary: {
        sourceRecordCount: 3,
        occurrenceCount: occurrences.length,
        conditionFreeOccurrenceCount: conditionFreeOccurrenceIds.length,
        conditionallyDeferredOccurrenceCount:
          conditionallyDeferredOccurrenceIds.length,
        uniqueNonemptyConditionArrayCount: new Set(
          occurrences
            .filter(({ conditions }) => conditions.length > 0)
            .map(({ conditionsSha256 }) => conditionsSha256),
        ).size,
        weaponGroupCount: allWeaponGroups.length,
        uniqueWeaponCount: new Set(
          allWeaponGroups.flatMap(({ weaponIds }) => weaponIds),
        ).size,
        rankedFiveStarGroupCount: rankedFiveStarGroups.length,
        rankedFiveStarWeaponCount: rankedFiveStarGroups.reduce(
          (sum, { weaponIds }) => sum + weaponIds.length,
          0,
        ),
        unrankedFourStarOptionCount: unrankedFourStarOptions.length,
        unrankedFourStarWeaponCount: unrankedFourStarOptions.reduce(
          (sum, { weaponIds }) => sum + weaponIds.length,
          0,
        ),
        conditionFreeWeaponGroupCount: conditionFreeWeaponGroups.length,
        conditionFreeWeaponLeafCount: conditionFreeWeaponGroups.reduce(
          (sum, { weaponIds }) => sum + weaponIds.length,
          0,
        ),
        guardedWeaponGroupCount: guardedWeaponGroups.length,
        guardedWeaponLeafCount: guardedWeaponGroups.reduce(
          (sum, { weaponIds }) => sum + weaponIds.length,
          0,
        ),
        mainStatChoiceGroupCount: mainStatChoiceGroups.length,
        mainStatLeafCount: mainStatChoiceGroups.reduce(
          (sum, { statIds }) => sum + statIds.length,
          0,
        ),
        substatPriorityGroupCount: guardedOffensiveTailPriorities.length,
        substatLeafCount: guardedOffensiveTailPriorities.reduce(
          (sum, { statIds }) => sum + statIds.length,
          0,
        ),
        sourceRecommendationObservationCount: occurrences.length,
        candidateCount: 0,
        completeBuildCount: 0,
        guideFactoryRecommendationCount: 0,
        derivedRankCount: 0,
      },
      ...CAPABILITIES,
      cautions: [...CAUTIONS],
      prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
      issues: [],
    };
  } catch (error) {
    return failedReport(
      generatedFrom,
      upstreamFileSha256,
      upstreamObjectSha256,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function authenticateXiaoNonErEquipmentBranchSourceSliceReport(
  serializedReport: XiaoNonErEquipmentBranchSourceSliceReport,
  input: BuildXiaoNonErEquipmentBranchSourceSliceInput,
): XiaoNonErEquipmentBranchSourceSliceAuthentication {
  const canonicalReport = buildXiaoNonErEquipmentBranchSourceSliceReport(input);
  if (canonicalReport.comparisonStatus !== "comparable") {
    return {
      authenticated: false,
      reason: "canonical-inputs-not-comparable",
      issues: canonicalReport.issues.map((issue) => ({ ...issue })),
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      issues: [
        {
          code: "xiao-non-er-source-slice.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Xiao non-ER equipment branch source slice does not match a fresh canonical rebuild.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableXiaoNonErEquipmentBranchSourceSliceReport(
  report: XiaoNonErEquipmentBranchSourceSliceReport,
  input: BuildXiaoNonErEquipmentBranchSourceSliceInput,
): void {
  const authentication =
    authenticateXiaoNonErEquipmentBranchSourceSliceReport(report, input);
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Xiao non-ER source slice (${authentication.reason}): ${authentication.issues
      .map(({ code, message }) => `${code}: ${message}`)
      .join("; ")}`,
  );
}

function weaponOccurrence(input: {
  sourceRecordId: string;
  repositoryRecordId: string;
  index: number;
  sourceRankGroup: number | null;
  classification: string;
  conditions: string[];
  weaponIds: string[];
  conditionRole: ConditionRole;
}): ExpectedOccurrence {
  const manualItemPath = `recommendation.weaponRecommendations[${input.index}]`;
  return {
    occurrenceId: `kqm:character_guide:${input.sourceRecordId}:${manualItemPath}.conditions`,
    sourceRecordId: input.sourceRecordId,
    repositoryRecordId: input.repositoryRecordId,
    manualItemPath,
    repositoryItemPath: `recommendations[0].weaponRecommendations[${input.index}]`,
    axis: "weapon",
    upstreamDisposition:
      input.conditions.length === 0 ? "empty-unconditional" : "holdout",
    conditionRole: input.conditionRole,
    expectedItem: {
      classification: input.classification,
      conditions: input.conditions,
      grouping: input.sourceRankGroup == null ? "single" : "tied",
      weaponIds: input.weaponIds,
    },
    sourcePosition: input.index,
    sourceRankGroup: input.sourceRankGroup,
  };
}

function statOccurrence(input: {
  itemPath: string;
  axis: Exclude<SourceAxis, "weapon">;
  sourcePosition: number;
  expectedItem: Record<string, unknown>;
  conditionRole: ConditionRole;
}): ExpectedOccurrence {
  const conditions = readStringArray(input.expectedItem, "conditions");
  return {
    occurrenceId: `kqm:character_guide:${STATS_SOURCE_RECORD_ID}:recommendation.${input.itemPath}.conditions`,
    sourceRecordId: STATS_SOURCE_RECORD_ID,
    repositoryRecordId:
      "kqm:character-guide:xiao-offensive-artifact-stats-version-5-5",
    manualItemPath: `recommendation.${input.itemPath}`,
    repositoryItemPath: `recommendations[0].${input.itemPath}`,
    axis: input.axis,
    upstreamDisposition:
      conditions.length === 0 ? "empty-unconditional" : "holdout",
    conditionRole: input.conditionRole,
    expectedItem: input.expectedItem,
    sourcePosition: input.sourcePosition,
    sourceRankGroup: null,
  };
}

function authenticateInputFiles(
  input: BuildXiaoNonErEquipmentBranchSourceSliceInput,
): {
  byPath: Map<string, string>;
  generatedFrom: GeneratedFromEntry[];
} {
  const expected = [
    ...XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS,
  ].sort(compareText);
  const actualSourcePaths = input.sourceFiles
    .map(({ path: sourcePath }) => sourcePath)
    .sort(compareText);
  const actualGeneratedPaths = input.generatedFrom
    .map(({ path: generatedPath }) => generatedPath)
    .sort(compareText);
  const byPath = new Map(input.sourceFiles.map(({ path: p, text }) => [p, text]));
  const generatedByPath = new Map(
    input.generatedFrom.map(({ path: p, sha256 }) => [p, sha256]),
  );
  if (
    new Set(actualSourcePaths).size !== actualSourcePaths.length ||
    new Set(actualGeneratedPaths).size !== actualGeneratedPaths.length ||
    stableJson(actualSourcePaths) !== stableJson(expected) ||
    stableJson(actualGeneratedPaths) !== stableJson(expected) ||
    expected.some((p) => generatedByPath.get(p) !== sha256Text(requiredSourceText(byPath, p))) ||
    input.generatedFrom.some(({ sha256 }) => !/^[a-f0-9]{64}$/.test(sha256))
  ) {
    throw new Error("Xiao non-ER source-slice byte/hash boundary drifted.");
  }
  return {
    byPath,
    generatedFrom: input.generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
  };
}

function authenticateJsonParity(
  byPath: ReadonlyMap<string, string>,
  expectedObjects: Readonly<Record<string, unknown>>,
): void {
  for (const [jsonPath, expectedObject] of Object.entries(expectedObjects)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(requiredSourceText(byPath, jsonPath));
    } catch {
      throw new Error(`JSON input is invalid at ${jsonPath}.`);
    }
    if (stableJson(parsed) !== stableJson(expectedObject)) {
      throw new Error(`JSON byte/parsed-object parity drifted at ${jsonPath}.`);
    }
  }
}

function authenticateUpstream(
  upstream: XiaoSourceLocalConditionSliceReport,
  repository: KnowledgeRepository,
  snapshot: ManualObservationSnapshot,
  manualIndex: unknown,
  sourceRegistry: unknown,
  byPath: ReadonlyMap<string, string>,
): void {
  const upstreamGeneratedFrom = XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS.map(
    (inputPath) => ({
      path: inputPath,
      sha256: sha256Text(requiredSourceText(byPath, inputPath)),
    }),
  );
  const authentication = authenticateXiaoSourceLocalConditionSliceReport(
    upstream,
    {
      repositoryInput: repository,
      manualSnapshotInput: snapshot,
      manualSnapshotText: requiredSourceText(byPath, XIAO_SNAPSHOT_PATH),
      manualIndexInput: manualIndex,
      sourceRegistryInput: sourceRegistry,
      generatedFrom: upstreamGeneratedFrom,
    },
  );
  if (!authentication.authenticated) {
    throw new Error(
      `Checkpoint-42 Xiao source-local report failed fresh authentication (${authentication.reason}).`,
    );
  }
  const canonical = authentication.canonicalReport;
  if (
    canonical.comparisonStatus !== "comparable" ||
    canonical.summary.selectedOccurrenceCount !== 3 ||
    canonical.summary.holdoutOccurrenceCount !== 14 ||
    canonical.summary.emptyConditionArrayCount !== 4 ||
    canonical.summary.candidateCount !== 0 ||
    canonical.summary.assembledBuildCount !== 0 ||
    canonical.holdoutOccurrences.some(({ consumedBySlice }) => consumedBySlice) ||
    canonical.emptyOccurrences.some(({ consumedBySlice }) => consumedBySlice) ||
    canonical.supportsGuideClaims ||
    canonical.supportsBuildRecommendations ||
    canonical.supportsEquipmentRecommendations ||
    canonical.supportsStatRecommendations ||
    canonical.supportsRankClaims ||
    canonical.supportsEnergyRecoveryClaims
  ) {
    throw new Error("Checkpoint-42 Xiao source-local semantic boundary drifted.");
  }
}

function authenticateSourceDocument(
  repository: KnowledgeRepository,
  snapshot: ManualObservationSnapshot,
): void {
  for (const boundary of RECORD_BOUNDARIES) {
    const manual = requiredManualRecord(snapshot, boundary.sourceRecordId);
    const consolidated = requiredRepositoryRecord(
      repository,
      boundary.repositoryRecordId,
    );
    const manualRecommendation = requiredRecord(
      readJsonPath(manual, "recommendation"),
      `manual recommendation ${boundary.sourceRecordId}`,
    );
    const repositoryRecommendation = requiredRecord(
      readJsonPath(consolidated, "recommendations[0]"),
      `repository recommendation ${boundary.repositoryRecordId}`,
    );
    if (
      manualRecommendation.id !== boundary.recommendationId ||
      repositoryRecommendation.id !== boundary.recommendationId ||
      manualRecommendation.scope !== boundary.scope ||
      repositoryRecommendation.scope !== boundary.scope ||
      (boundary.weaponOrdering == null
        ? manualRecommendation.weaponOrdering != null ||
          repositoryRecommendation.weaponOrdering != null
        : manualRecommendation.weaponOrdering !== boundary.weaponOrdering ||
          repositoryRecommendation.weaponOrdering !== boundary.weaponOrdering) ||
      consolidated.kind !== "character_guide" ||
      consolidated.characterId !== "xiao" ||
      consolidated.status !== "candidate" ||
      consolidated.promotionEligible !== false ||
      !Array.isArray(consolidated.sourceRefs) ||
      consolidated.sourceRefs.length !== 1 ||
      consolidated.sourceRefs[0]?.sourceId !== "kqm" ||
      consolidated.sourceRefs[0]?.sourceRecordId !== boundary.sourceRecordId
    ) {
      throw new Error(`Xiao source record boundary drifted for ${boundary.sourceRecordId}.`);
    }
  }
}

function buildOccurrence(
  definition: ExpectedOccurrence,
  repository: KnowledgeRepository,
  snapshot: ManualObservationSnapshot,
  upstream: XiaoSourceLocalConditionSliceReport,
): XiaoNonErEquipmentBranchOccurrence {
  const manualRecord = requiredManualRecord(snapshot, definition.sourceRecordId);
  const repositoryRecord = requiredRepositoryRecord(
    repository,
    definition.repositoryRecordId,
  );
  const manualItem = requiredRecord(
    readJsonPath(manualRecord, definition.manualItemPath),
    `manual item ${definition.occurrenceId}`,
  );
  const repositoryItem = requiredRecord(
    readJsonPath(repositoryRecord, definition.repositoryItemPath),
    `repository item ${definition.occurrenceId}`,
  );
  if (
    stableJson(manualItem) !== stableJson(definition.expectedItem) ||
    stableJson(repositoryItem) !== stableJson(definition.expectedItem)
  ) {
    throw new Error(`Exact Xiao source item drifted for ${definition.occurrenceId}.`);
  }
  const upstreamRows =
    definition.upstreamDisposition === "holdout"
      ? upstream.holdoutOccurrences
      : upstream.emptyOccurrences;
  const upstreamRow = upstreamRows.find(
    ({ occurrenceId }) => occurrenceId === definition.occurrenceId,
  );
  const conditions = readStringArray(manualItem, "conditions");
  const conditionsSha256 = hashValue(conditions);
  if (
    !upstreamRow ||
    upstreamRow.sourceRecordId !== definition.sourceRecordId ||
    upstreamRow.repositoryRecordId !== definition.repositoryRecordId ||
    upstreamRow.manualClaimPath !== `${definition.manualItemPath}.conditions` ||
    upstreamRow.repositoryPath !== `${definition.repositoryItemPath}.conditions` ||
    upstreamRow.conditionsSha256 !== conditionsSha256 ||
    stableJson(upstreamRow.conditions) !== stableJson(conditions) ||
    upstreamRow.consumedBySlice !== false ||
    upstreamRow.bindingAuthoredBySlice !== false ||
    upstreamRow.energyClassificationAuthoredBySlice !== false
  ) {
    throw new Error(`Checkpoint-42 occurrence lineage drifted for ${definition.occurrenceId}.`);
  }
  const sourceItem = structuredClone(definition.expectedItem);
  const occurrenceWithoutHash = {
    occurrenceId: definition.occurrenceId,
    sourceRecordId: definition.sourceRecordId,
    repositoryRecordId: definition.repositoryRecordId,
    manualClaimPath: `${definition.manualItemPath}.conditions`,
    repositoryPath: `${definition.repositoryItemPath}.conditions`,
    axis: definition.axis,
    sourcePosition: definition.sourcePosition,
    sourcePositionIsRank: definition.sourceRankGroup != null,
    sourceRankGroup: definition.sourceRankGroup,
    upstreamCheckpoint42Disposition: definition.upstreamDisposition,
    upstreamCheckpoint42BindingAuthored: false as const,
    projectedAsSourceObservationOnly: true as const,
    sourceItem,
    sourceItemSha256: hashValue(sourceItem),
    conditions,
    conditionsSha256,
    sourceConditionStatus:
      conditions.length === 0
        ? ("source-condition-free" as const)
        : ("guarded-unresolved" as const),
    conditionRole: definition.conditionRole,
    conditionRoleAuthoredBy:
      "guide-factory-exact-source-adapter" as const,
    conditionTruthEvaluated: false as const,
    conditionBindingAuthoredByThisSlice: false as const,
    energyRecoveryValueProjected: false as const,
  };
  return {
    ...occurrenceWithoutHash,
    occurrenceSha256: hashValue(occurrenceWithoutHash),
  };
}

function authenticateOccurrenceClosure(
  occurrences: readonly XiaoNonErEquipmentBranchOccurrence[],
): void {
  const ids = occurrences.map(({ occurrenceId }) => occurrenceId);
  if (
    occurrences.length !== 13 ||
    new Set(ids).size !== 13 ||
    stableJson(ids) !==
      stableJson(EXPECTED_OCCURRENCES.map(({ occurrenceId }) => occurrenceId)) ||
    occurrences.filter(({ sourceConditionStatus }) =>
      sourceConditionStatus === "source-condition-free",
    ).length !== 4 ||
    occurrences.filter(({ sourceConditionStatus }) =>
      sourceConditionStatus === "guarded-unresolved",
    ).length !== 9
  ) {
    throw new Error("Xiao non-ER source occurrence closure drifted.");
  }
}

function weaponGroupFromOccurrence(
  occurrence: XiaoNonErEquipmentBranchOccurrence,
  rarityClass: "five-star" | "four-star",
): XiaoNonErWeaponGroup {
  const weaponIds = readStringArray(occurrence.sourceItem, "weaponIds");
  const grouping = readString(occurrence.sourceItem, "grouping");
  if (
    (rarityClass === "five-star" && grouping !== "tied") ||
    (rarityClass === "four-star" && grouping !== "single")
  ) {
    throw new Error(`Weapon grouping drifted for ${occurrence.occurrenceId}.`);
  }
  const withoutHash = {
    occurrenceId: occurrence.occurrenceId,
    sourceRecordId: occurrence.sourceRecordId,
    rarityClass,
    weaponOrdering:
      rarityClass === "five-star"
        ? ("ranked-groups" as const)
        : ("unranked" as const),
    sourcePosition: occurrence.sourcePosition,
    sourcePositionIsRank: rarityClass === "five-star",
    sourceRankGroup:
      rarityClass === "five-star" ? occurrence.sourceRankGroup : null,
    grouping: grouping as "tied" | "single",
    classification: readString(occurrence.sourceItem, "classification"),
    weaponIds,
    conditions: [...occurrence.conditions],
    sourceConditionStatus: occurrence.sourceConditionStatus,
    conditionRole: occurrence.conditionRole,
    normalizedGuard:
      occurrence.conditionRole === "refinement-floor-energy-effect-deferred"
        ? ({
            type: "refinement-at-least",
            weaponId: "favonius_lance",
            refinement: 3,
            satisfaction: "not-evaluated",
            energyEffect: "deferred",
          } as const)
        : null,
  };
  return { ...withoutHash, sourceGroupSha256: hashValue(withoutHash) };
}

function statGroupFromOccurrence(
  occurrence: XiaoNonErEquipmentBranchOccurrence,
): XiaoNonErStatGroup {
  if (
    occurrence.axis !== "main-stat:sands" &&
    occurrence.axis !== "main-stat:circlet"
  ) {
    throw new Error(`Not a main-stat occurrence: ${occurrence.occurrenceId}.`);
  }
  const withoutHash = {
    occurrenceId: occurrence.occurrenceId,
    slot: occurrence.axis === "main-stat:sands" ? ("sands" as const) : ("circlet" as const),
    statIds: readStringArray(occurrence.sourceItem, "statIds"),
    sourcePosition: occurrence.sourcePosition,
    sourceConditionStatus: occurrence.sourceConditionStatus,
    conditionRole: occurrence.conditionRole,
    selectionExecuted: false as const,
  };
  return { ...withoutHash, sourceGroupSha256: hashValue(withoutHash) };
}

function substatGroupFromOccurrence(
  occurrence: XiaoNonErEquipmentBranchOccurrence,
  siblingRows: readonly XiaoNonErEquipmentBranchOccurrence[],
): XiaoNonErSubstatPriorityGroup {
  const withoutHash = {
    occurrenceId: occurrence.occurrenceId,
    priority: readNumber(occurrence.sourceItem, "priority"),
    statIds: readStringArray(occurrence.sourceItem, "statIds"),
    target: readOptionalString(occurrence.sourceItem, "target"),
    conditionsSha256: occurrence.conditionsSha256,
    sharesGuardWithOccurrenceIds: siblingRows
      .filter(
        (row) =>
          row.occurrenceId !== occurrence.occurrenceId &&
          row.conditionsSha256 === occurrence.conditionsSha256,
      )
      .map(({ occurrenceId }) => occurrenceId),
    sourceConditionStatus: "guarded-unresolved" as const,
    conditionRole: "incomplete-offensive-tail-after-deferred-er" as const,
    completePriorityPlan: false as const,
  };
  return { ...withoutHash, sourceGroupSha256: hashValue(withoutHash) };
}

function failedReport(
  generatedFrom: GeneratedFromEntry[],
  upstreamFileSha256: string | null,
  upstreamObjectSha256: string | null,
  message: string,
): XiaoNonErEquipmentBranchSourceSliceReport {
  return {
    schemaVersion: 1,
    reportType: "xiao-non-er-equipment-branch-source-slice",
    sliceId: SLICE_ID,
    classification: "authenticated-source-only-non-er-equipment-branch-domain",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-unreviewed-source-slice",
    generatedFrom,
    rawInputBoundary: {
      status: "rejected",
      exactSourceFilePathSet: false,
      exactGeneratedFromPathSet: false,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: false,
      jsonInputByteAndParsedObjectParity: false,
      sourceFileCount: 0,
      generatedFromCount: generatedFrom.length,
      jsonInputCount: 5,
    },
    upstreamBoundary: {
      status: "rejected",
      durableReportPath: XIAO_SOURCE_LOCAL_REPORT_PATH,
      durableReportFileSha256: upstreamFileSha256,
      durableReportCanonicalObjectSha256: upstreamObjectSha256,
      freshlyAuthenticated: false,
      upstreamInputCount: XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS.length,
      selectedOccurrenceCount: 0,
      holdoutOccurrenceCount: 0,
      emptyOccurrenceCount: 0,
      projectedHoldoutOccurrenceCount: 0,
      projectedEmptyOccurrenceCount: 0,
      conditionBindingsAddedToCheckpoint42: 0,
    },
    sourceBoundary: {
      status: "rejected",
      sourceId: "kqm",
      characterId: "xiao",
      sourceVersion: "Version 5.5",
      sourceRecordIds: [],
      repositoryRecordIds: [],
      sourceRecordCount: 0,
      occurrenceCount: 0,
      manualRepositoryItemParity: "not-evaluated",
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      promotionEligible: false,
    },
    rankingBoundary: {
      fiveStarOrdering: "ranked-groups",
      fiveStarMembersWithinGroup: "tied",
      fourStarOrdering: "unranked",
      fourStarSourcePositionsAreRanks: false,
      crossRarityOrdering: "not-defined",
      sourceRankedFiveStarGroupCount: 0,
      guideFactoryDerivedRankCount: 0,
    },
    completenessBoundary: {
      axisVocabulary: [
        "weapon",
        "artifact-set",
        "main-stat:sands",
        "main-stat:goblet",
        "main-stat:circlet",
        "substats",
      ],
      representedAxes: [
        "weapon",
        "main-stat:sands",
        "main-stat:circlet",
        "substats",
      ],
      missingAxes: ["artifact-set", "main-stat:goblet"],
      missingAxisPolicy: "outside-this-source-slice-no-default",
      circletSelection: "guarded-not-executed",
      substatPlan: "guarded-incomplete-offensive-tail",
      energyRecovery: "excluded-deferred",
    },
    occurrences: [],
    rankedFiveStarGroups: [],
    unrankedFourStarOptions: [],
    mainStatChoiceGroups: [],
    guardedOffensiveTailPriorities: [],
    conditionFreeOccurrenceIds: [],
    conditionallyDeferredOccurrenceIds: [],
    summary: {
      sourceRecordCount: 0,
      occurrenceCount: 0,
      conditionFreeOccurrenceCount: 0,
      conditionallyDeferredOccurrenceCount: 0,
      uniqueNonemptyConditionArrayCount: 0,
      weaponGroupCount: 0,
      uniqueWeaponCount: 0,
      rankedFiveStarGroupCount: 0,
      rankedFiveStarWeaponCount: 0,
      unrankedFourStarOptionCount: 0,
      unrankedFourStarWeaponCount: 0,
      conditionFreeWeaponGroupCount: 0,
      conditionFreeWeaponLeafCount: 0,
      guardedWeaponGroupCount: 0,
      guardedWeaponLeafCount: 0,
      mainStatChoiceGroupCount: 0,
      mainStatLeafCount: 0,
      substatPriorityGroupCount: 0,
      substatLeafCount: 0,
      sourceRecommendationObservationCount: 0,
      candidateCount: 0,
      completeBuildCount: 0,
      guideFactoryRecommendationCount: 0,
      derivedRankCount: 0,
    },
    ...CAPABILITIES,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    issues: [
      {
        code: "xiao-non-er-source-slice.not-comparable",
        path: "inputs",
        message,
      },
    ],
  };
}

function requiredManualRecord(
  snapshot: ManualObservationSnapshot,
  sourceRecordId: string,
): Record<string, unknown> {
  const record = snapshot.records.find(
    (candidate) => candidate.sourceRecordId === sourceRecordId,
  );
  return requiredRecord(record, `manual record ${sourceRecordId}`);
}

function requiredRepositoryRecord(
  repository: KnowledgeRepository,
  repositoryRecordId: string,
): Record<string, unknown> {
  const record = repository.records.find(
    (candidate) => candidate.id === repositoryRecordId,
  );
  return requiredRecord(record, `repository record ${repositoryRecordId}`);
}

function readJsonPath(root: unknown, jsonPath: string): unknown {
  const tokens = [...jsonPath.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(
    (match) => (match[2] == null ? match[1] : Number(match[2])),
  );
  let current: unknown = root;
  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[token];
    } else {
      if (!isRecord(current) || token == null) return undefined;
      current = current[token];
    }
  }
  return current;
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Missing ${label}.`);
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function readStringArray(
  source: Readonly<Record<string, unknown>>,
  key: string,
): string[] {
  const value = source[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Expected string array at ${key}.`);
  }
  return [...value] as string[];
}

function readString(
  source: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = source[key];
  if (typeof value !== "string") throw new Error(`Expected string at ${key}.`);
  return value;
}

function readOptionalString(
  source: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = source[key];
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(`Expected optional string at ${key}.`);
  return value;
}

function readNumber(
  source: Readonly<Record<string, unknown>>,
  key: string,
): number {
  const value = source[key];
  if (typeof value !== "number") throw new Error(`Expected number at ${key}.`);
  return value;
}

function requiredSourceText(
  byPath: ReadonlyMap<string, string>,
  sourcePath: string,
): string {
  const text = byPath.get(sourcePath);
  if (text == null) throw new Error(`Missing source bytes for ${sourcePath}.`);
  return text;
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}
