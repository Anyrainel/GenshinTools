import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildManualConditionArrayCoverageCore,
  type ManualConditionArrayOccurrence,
} from "./manualConditionArrayCoverage";
import { sha256Text, stableJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  SOURCE_REGISTRY_PATH,
} from "./paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
} from "./schemas";
import {
  buildSourceLocalConditionSliceReport,
  type SourceLocalConditionClaimInput,
  type SourceLocalConditionRequestPredicateAst,
  type SourceLocalConditionSliceInput,
  type SourceLocalConditionSliceReport,
  type SourceLocalExactTeamInput,
} from "./sourceLocalConditionSlice";
import type {
  GeneratedFromEntry,
  SourceConditionedAtomicClaim,
  SourceConditionedClaimPayload,
  SourceConditionedGuidePacketIssue,
  SourceConditionPredicateAst,
} from "./sourceConditionedGuidePacket";

const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const NOELLE_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json";
const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_INDEX_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const NOELLE_PAGE_URL = "https://keqingmains.com/q/noelle-quickguide/";
const NOELLE_SOURCE_VERSION = "Luna VIII";
const NOELLE_SLICE_ID =
  "kqm-noelle-source-local-high-investment-slice-luna-viii";
const EXPECTED_NOELLE_SNAPSHOT_SHA256 =
  "d6927fed20fc0f77e8f721e18b7c9f8db37009258ba5c582b7184fb16be558e0";
const GUIDE_DEFINITION = {
  repositoryRecordId:
    "kqm:character-guide:noelle-c6-or-talent-10-artifact-stats-luna-viii",
  sourceRecordId: "noelle-c6-or-talent-10-artifact-stats-luna-viii",
  recommendationId: "c6-or-talent-10-artifact-stats",
} as const;
const TEAM_DEFINITION = {
  repositoryRecordId:
    "kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii",
  sourceRecordId:
    "noelle-durin-nicole-xilonen-hexerei-example-luna-viii",
  memberCharacterIds: ["noelle", "durin", "nicole", "xilonen"],
} as const;

const INVESTMENT_THRESHOLD_REASON =
  "Noelle's constellation and Burst Talent level are not facts authored by the exact source team roster and must be supplied independently by the request context.";
const INVESTMENT_THRESHOLD_PREDICATE = {
  type: "unresolved-context",
  category: "investment-threshold",
  reason: INVESTMENT_THRESHOLD_REASON,
} as const satisfies SourceConditionPredicateAst;
const NUMERIC_REQUEST_PREDICATE = {
  type: "any",
  predicates: [
    {
      type: "constellation-at-least",
      characterId: "noelle",
      threshold: 6,
    },
    {
      type: "talent-level-at-least",
      characterId: "noelle",
      talent: "burst",
      threshold: 10,
    },
  ],
} as const satisfies SourceLocalConditionRequestPredicateAst;
const EXPECTED_SOURCE_PREDICATE_SHA256 =
  "a700f51166e436253a9943351cc4255141d6ebaf083273fc0bacf8fda0b85a8a";
const EXPECTED_SOURCE_PREDICATE_LEAF_SHA256 =
  "a700f51166e436253a9943351cc4255141d6ebaf083273fc0bacf8fda0b85a8a";
const EXPECTED_REQUEST_PREDICATE_SHA256 =
  "b93bfd12ebefae9aaae8434d4d316315a78fe6081698a73dd0ee047bcbbbc596";

type ExactSourceItem = Record<string, unknown>;

type NoelleConditionOccurrence = ManualConditionArrayOccurrence & {
  repositoryJsonPath: string;
};

type SelectedOccurrenceDefinition = {
  occurrenceId: string;
  characterId: "noelle";
  mainStatSlot: "sands" | "goblet" | "circlet";
  conditionsSha256: string;
  payloadSha256: string;
  exactSourceItem: ExactSourceItem;
  predicate: SourceConditionPredicateAst;
};

type HoldoutOccurrenceDefinition = {
  occurrenceId: string;
  conditionsSha256: string;
};

type EmptyOccurrenceDefinition = HoldoutOccurrenceDefinition;

const SELECTED_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.sands[0].conditions",
    characterId: "noelle",
    mainStatSlot: "sands",
    conditionsSha256:
      "92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4",
    payloadSha256:
      "804a06075305e59b97c800d1a8ba0fdfff51f9f5cbe37862d3f574721b38d53e",
    exactSourceItem: {
      statIds: ["def%"],
      conditions: [
        "Noelle is C6 or her Burst Talent is Level 10 or higher.",
      ],
    },
    predicate: INVESTMENT_THRESHOLD_PREDICATE,
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.goblet[0].conditions",
    characterId: "noelle",
    mainStatSlot: "goblet",
    conditionsSha256:
      "92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4",
    payloadSha256:
      "27b0565556c4d4cb4abe6c800046b0e1269484e769b15ce91ec7581ec6e9026a",
    exactSourceItem: {
      statIds: ["geo%"],
      conditions: [
        "Noelle is C6 or her Burst Talent is Level 10 or higher.",
      ],
    },
    predicate: INVESTMENT_THRESHOLD_PREDICATE,
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.circlet[0].conditions",
    characterId: "noelle",
    mainStatSlot: "circlet",
    conditionsSha256:
      "92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4",
    payloadSha256:
      "d227c8c1fb0defbc9cfba9365cea3a70d5ae13927f0f1438188c48dd5e437603",
    exactSourceItem: {
      statIds: ["cr", "cd"],
      conditions: [
        "Noelle is C6 or her Burst Talent is Level 10 or higher.",
      ],
    },
    predicate: INVESTMENT_THRESHOLD_PREDICATE,
  },
] as const satisfies readonly SelectedOccurrenceDefinition[];

const HOLDOUT_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.circlet[0].conditions",
    conditionsSha256:
      "6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.goblet[0].conditions",
    conditionsSha256:
      "6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.sands[0].conditions",
    conditionsSha256:
      "6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[0].conditions",
    conditionsSha256:
      "25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[1].conditions",
    conditionsSha256:
      "25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[2].conditions",
    conditionsSha256:
      "25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.circlet[1].conditions",
    conditionsSha256:
      "7444217b95d562ae6cffb22b51e7c6ef6da6891851967415925d6713c254e2c6",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.goblet[1].conditions",
    conditionsSha256:
      "778b1c674223e02b4b58c3903c6ac809f5bab52e2c216e93003320fd1657f748",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[0].conditions",
    conditionsSha256:
      "2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[1].conditions",
    conditionsSha256:
      "2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[2].conditions",
    conditionsSha256:
      "2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-hexerei-gest-luna-viii:recommendation.weaponRecommendations[0].conditions",
    conditionsSha256:
      "f27375a8ce8833cc0326a17c94f52c71ed4f44a72868e15d087390b864e490cf",
  },
] as const satisfies readonly HoldoutOccurrenceDefinition[];

const EMPTY_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:character_guide:noelle-general-husk-luna-viii:recommendation.artifactRecommendations[0].conditions",
    conditionsSha256:
      "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570",
  },
] as const satisfies readonly EmptyOccurrenceDefinition[];

const EXPECTED_RAW_RECORD_IDS = [
  "noelle-c0-c5-talent-9-artifact-stats-luna-viii",
  "noelle-c6-or-talent-10-artifact-stats-luna-viii",
  "noelle-durin-nicole-xilonen-hexerei-example-luna-viii",
  "noelle-general-husk-luna-viii",
  "noelle-hexerei-gest-luna-viii",
] as const;
const CAUTIONS = [
  "The selected occurrence remains an agent-assisted and unreviewed source observation.",
  "The source predicate remains unresolved; only the request overlay evaluates explicit Noelle constellation or Burst Talent facts.",
  "The selected high-investment main-stat cells are preserved independently and are not assembled into a build.",
  "The twelve nonempty holdouts and one empty array are authenticated inventory only and remain unconsumed.",
  "No constellation-derived Talent behavior is inferred; supplied constellation and Talent levels are independent facts.",
  "Not-energy-deferred is occurrence-scoped only and does not provide an ER requirement or prove ER adequacy.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not interpret this slice as a Noelle guide, artifact assignment, build, team recommendation, candidate set, or ranking.",
  "Do not combine the three independently preserved main-stat payloads into a build or optimize among them.",
  "Do not infer a typed predicate, request binding, or energy classification for any holdout or empty occurrence.",
  "Do not derive Talent levels from constellation or treat source recommendation metadata as numeric evidence.",
  "Do not use this report as a generator, optimizer, formula, rotation, damage, DPS, ideal-roll, or ER result.",
] as const;
export interface NoelleSourceLocalHighInvestmentSliceSourceFile {
  path: string;
  text: string;
}

export interface BuildNoelleSourceLocalHighInvestmentSliceInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  sourceFiles: readonly NoelleSourceLocalHighInvestmentSliceSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface NoelleSourceLocalHoldoutOccurrence {
  occurrenceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  manualClaimPath: string;
  repositoryPath: string;
  claimAxis: ManualConditionArrayOccurrence["claimAxis"];
  mainStatSlot?: "sands" | "goblet" | "circlet";
  conditions: string[];
  conditionsSha256: string;
  structuralEnergyDimension: "structural-er" | "not-structural-er";
  repositoryParity: "exact";
  sliceDisposition: "holdout";
  consumedBySlice: false;
  bindingAuthoredBySlice: false;
  energyClassificationAuthoredBySlice: false;
}

export interface NoelleSourceLocalSelectedOccurrence {
  occurrenceId: string;
  characterId: "noelle";
  sourceRecordId: string;
  repositoryRecordId: string;
  manualClaimPath: string;
  repositoryPath: string;
  claimAxis: ManualConditionArrayOccurrence["claimAxis"];
  mainStatSlot?: "sands" | "goblet" | "circlet";
  conditions: string[];
  conditionsSha256: string;
  payload: SourceConditionedClaimPayload;
  payloadSha256: string;
  predicate: SourceConditionPredicateAst;
  predicateSha256: string;
  sourcePredicateLeafSha256: string;
  requestPredicate: SourceLocalConditionRequestPredicateAst;
  requestPredicateSha256: string;
  repositoryParity: "exact";
  sliceDisposition: "selected";
  bindingAuthoredBySlice: true;
  sliceBindingClassification: "typed-bound";
  energyClassificationAuthoredBySlice: true;
  sliceEnergyClassification: "not-energy-deferred";
}

export interface NoelleSourceLocalEmptyOccurrence {
  occurrenceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  manualClaimPath: string;
  repositoryPath: string;
  claimAxis: ManualConditionArrayOccurrence["claimAxis"];
  conditions: [];
  conditionsSha256: string;
  repositoryParity: "exact";
  sliceDisposition: "empty-unconditional";
  consumedBySlice: false;
  bindingAuthoredBySlice: false;
  energyClassificationAuthoredBySlice: false;
}

export interface NoelleSourceLocalHighInvestmentSliceReport {
  schemaVersion: 1;
  reportType: "noelle-source-local-high-investment-slice";
  sliceId: typeof NOELLE_SLICE_ID;
  classification: "authenticated-source-local-condition-binding-slice";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-source-slice";
  arbitraryEnglishParsingAllowed: false;
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsBuildRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  conditionTruthEstablishedFromRecommendationMetadata: false;
  recommendationCompositionExecuted: false;
  candidateGenerationExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  artifactAssignmentExecuted: false;
  equipmentAssignmentExecuted: false;
  teamCompositionExecuted: false;
  buildCompositionExecuted: false;
  damageComputationExecuted: false;
  rotationComputationExecuted: false;
  energyRecoveryComputationExecuted: false;
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted" | "rejected";
    exactPathSet: boolean;
    byteAndParsedObjectClosure: boolean;
    sourceFileCount: number;
    canonicalObjectSha256ByPath: Record<string, string>;
  };
  sourceBoundary: {
    status: "accepted" | "rejected";
    sourceId: "kqm";
    pageUrl: typeof NOELLE_PAGE_URL;
    sourceVersion: typeof NOELLE_SOURCE_VERSION;
    snapshotPath: typeof NOELLE_SNAPSHOT_RELATIVE_PATH;
    rawRecordCount: number;
    rawRecordIds: string[];
    totalConditionArrayCount: number;
    nonemptyConditionArrayCount: number;
    emptyConditionArrayCount: number;
    selectedOccurrenceCount: number;
    holdoutOccurrenceCount: number;
    selectedAndHoldoutsCloseAllNonemptyNoelleConditions: boolean;
    emptyOccurrenceClosureExact: boolean;
    repositoryParity: "exact" | "mismatch" | "not-evaluated";
    samePageLineage: boolean;
    guideAndTeamShareExactSourceDocument: boolean;
    crossRecordJoinOwnedByWrapper: true;
    sourceAuthoredCrossRecordJoin: false;
    extractionMethod: "agent-assisted";
    reviewStatus: "unreviewed";
    sourceRegistryStatus: "active";
    sourceRegistryIngestionMode: "manual-observation";
    sourceRegistryPermission: "unknown";
    promotionEligible: false;
  };
  selectedOccurrences: NoelleSourceLocalSelectedOccurrence[];
  holdoutOccurrences: NoelleSourceLocalHoldoutOccurrence[];
  emptyOccurrences: NoelleSourceLocalEmptyOccurrence[];
  numericEvaluationBoundary: {
    sourcePredicateAstPreserved: true;
    sourceTalentLevelsEvaluated: false;
    requestOverlayOwnsNumericEvaluation: true;
    constellationDerivedTalentBehavior: false;
    requestPredicateSha256: string;
  };
  sourceLocalSlice: SourceLocalConditionSliceReport | null;
  summary: {
    totalConditionArrayCount: number;
    nonemptyConditionArrayCount: number;
    emptyConditionArrayCount: number;
    selectedOccurrenceCount: number;
    selectedUniqueConditionArrayCount: number;
    holdoutOccurrenceCount: number;
    sourceTeamCount: number;
    sourceCellCount: number;
    sourceMatchedCount: number;
    sourceInapplicableCount: number;
    sourceUnresolvedCount: number;
    contextApplicableCount: number;
    sourceAlreadyMatchedCount: number;
    sourceDefinitelyInapplicableCount: number;
    effectiveMatchedCount: number;
    effectiveInapplicableCount: number;
    effectiveUnresolvedCount: number;
    selectedNotEnergyDeferredCount: number;
    holdoutConsumedCount: 0;
    holdoutBindingAuthoredCount: 0;
    holdoutEnergyClassificationAuthoredCount: 0;
    emptyConsumedCount: 0;
    candidateCount: 0;
    equipmentAssignmentCount: 0;
    optimizationCount: 0;
    assembledBuildCount: 0;
  };
  issues: SourceConditionedGuidePacketIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type NoelleSourceLocalHighInvestmentSliceAuthentication =
  | {
      authenticated: true;
      canonicalReport: NoelleSourceLocalHighInvestmentSliceReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: SourceConditionedGuidePacketIssue[];
    };

export const NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS = [
  REPOSITORY_RELATIVE_PATH,
  MANUAL_INDEX_RELATIVE_PATH,
  SOURCE_REGISTRY_RELATIVE_PATH,
  NOELLE_SNAPSHOT_RELATIVE_PATH,
] as const;

export const NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS = [
  ...new Set([
    "scripts/guide-factory/src/noelleSourceLocalHighInvestmentSlice.ts",
    "scripts/guide-factory/src/assemble-noelle-source-local-high-investment-slice.ts",
    "scripts/guide-factory/src/sourceLocalConditionSlice.ts",
    "scripts/guide-factory/src/sourceConditionedGuidePacket.ts",
    "scripts/guide-factory/src/guideRequestContext.ts",
    "scripts/guide-factory/src/manualConditionArrayCoverage.ts",
    "scripts/guide-factory/src/schemas.ts",
    "scripts/guide-factory/src/io.ts",
    "scripts/guide-factory/src/paths.ts",
    ...NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  ]),
].sort(compareText);

export const NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "noelle-source-local-high-investment-slice.json",
);

const CAPABILITY_BOUNDARY = {
  arbitraryEnglishParsingAllowed: false,
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsBuildRecommendations: false,
  supportsEquipmentRecommendations: false,
  supportsStatRecommendations: false,
  supportsRankClaims: false,
  supportsDamageClaims: false,
  supportsRotationClaims: false,
  supportsEnergyRecoveryClaims: false,
  conditionTruthEstablishedFromRecommendationMetadata: false,
  recommendationCompositionExecuted: false,
  candidateGenerationExecuted: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  artifactAssignmentExecuted: false,
  equipmentAssignmentExecuted: false,
  teamCompositionExecuted: false,
  buildCompositionExecuted: false,
  damageComputationExecuted: false,
  rotationComputationExecuted: false,
  energyRecoveryComputationExecuted: false,
} as const;

export function buildNoelleSourceLocalHighInvestmentSliceReport(
  input: BuildNoelleSourceLocalHighInvestmentSliceInput,
): NoelleSourceLocalHighInvestmentSliceReport {
  let generatedFrom: GeneratedFromEntry[] = [];
  try {
    generatedFrom = authenticateGeneratedFrom(input.generatedFrom);
    const canonicalObjectSha256ByPath = authenticateRawInputs(
      input,
      generatedFrom,
    );
    const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
    const snapshot = ManualObservationSnapshotSchema.parse(
      input.manualSnapshotInput,
    );
    const index = ManualSnapshotIndexSchema.parse(input.manualIndexInput);
    const registry = SourceRegistrySchema.parse(input.sourceRegistryInput);
    const sourceRegistrySha256 = generatedFrom.find(
      ({ path: entryPath }) => entryPath === SOURCE_REGISTRY_RELATIVE_PATH,
    )?.sha256;
    const snapshotSha256 = generatedFrom.find(
      ({ path: entryPath }) => entryPath === NOELLE_SNAPSHOT_RELATIVE_PATH,
    )?.sha256;
    authenticateSourceDocument(
      snapshot,
      index,
      registry,
      repository,
      sourceRegistrySha256,
      snapshotSha256,
    );

    const coverageCore = buildManualConditionArrayCoverageCore({
      manualIndexInput: {
        schemaVersion: 1,
        snapshots: [{ sourceId: "kqm", path: NOELLE_SNAPSHOT_RELATIVE_PATH }],
      },
      manualSnapshotInputs: [
        {
          path: NOELLE_SNAPSHOT_RELATIVE_PATH,
          snapshotInput: input.manualSnapshotInput,
        },
      ],
      repositoryInput: repository,
    });
    const allOccurrences = coverageCore.extraction.occurrences;
    const nonemptyOccurrences = allOccurrences.filter(
      ({ conditions }) => conditions.length > 0,
    );
    const emptyOccurrences = allOccurrences.filter(
      ({ conditions }) => conditions.length === 0,
    );
    if (
      coverageCore.repositoryParity.status !== "exact" ||
      coverageCore.repositoryParity.rows.length !== 16 ||
      coverageCore.repositoryParity.rows.some(
        ({ status, repositoryJsonPath }) =>
          status !== "exact" || repositoryJsonPath == null,
      ) ||
      allOccurrences.length !== 16 ||
      nonemptyOccurrences.length !== 15 ||
      emptyOccurrences.length !== 1
    ) {
      throw new Error(
        "The exact Noelle condition corpus is no longer sixteen parity-exact arrays: fifteen nonempty and one empty.",
      );
    }

    const parityByOccurrenceId = new Map(
      coverageCore.repositoryParity.rows.map((row) => [row.occurrenceId, row]),
    );
    const allOccurrencesById = new Map(
      allOccurrences.map((occurrence) => {
        const parity = parityByOccurrenceId.get(occurrence.occurrenceId);
        if (parity?.status !== "exact" || parity.repositoryJsonPath == null) {
          throw new Error(
            `Missing exact repository parity path for ${occurrence.occurrenceId}.`,
          );
        }
        return [
          occurrence.occurrenceId,
          { ...occurrence, repositoryJsonPath: parity.repositoryJsonPath },
        ];
      }),
    );
    const occurrenceById = new Map(
      [...allOccurrencesById].filter(
        ([, occurrence]) => occurrence.conditions.length > 0,
      ),
    );
    const emptyOccurrenceById = new Map(
      [...allOccurrencesById].filter(
        ([, occurrence]) => occurrence.conditions.length === 0,
      ),
    );
    const selectedIds = new Set(
      SELECTED_OCCURRENCES.map(({ occurrenceId }) => occurrenceId),
    );
    const holdoutIds = new Set(
      HOLDOUT_OCCURRENCES.map(({ occurrenceId }) => occurrenceId),
    );
    authenticateExactOccurrencePartition(
      occurrenceById,
      selectedIds,
      holdoutIds,
    );
    authenticateExactEmptyPartition(emptyOccurrenceById);

    const selectedOccurrences: NoelleSourceLocalSelectedOccurrence[] = [];
    const claims: SourceLocalConditionClaimInput[] = [];
    SELECTED_OCCURRENCES.forEach((definition, catalogIndex) => {
      const occurrence = requiredOccurrence(
        occurrenceById,
        definition.occurrenceId,
      );
      authenticateSelectedDefinitionAndPayload(
        definition,
        occurrence,
        snapshot,
        repository,
      );
      const payload = payloadForOccurrence(
        repository,
        occurrence,
        "repository",
      );
      const predicateSha256 = hashValue(definition.predicate);
      const payloadSha256 = hashValue(payload);
      const sourcePredicateLeafSha256 = hashValue(
        INVESTMENT_THRESHOLD_PREDICATE,
      );
      const requestPredicateSha256 = hashValue(NUMERIC_REQUEST_PREDICATE);
      if (
        predicateSha256 !== EXPECTED_SOURCE_PREDICATE_SHA256 ||
        sourcePredicateLeafSha256 !==
          EXPECTED_SOURCE_PREDICATE_LEAF_SHA256 ||
        requestPredicateSha256 !== EXPECTED_REQUEST_PREDICATE_SHA256 ||
        payloadSha256 !== definition.payloadSha256
      ) {
        throw new Error(
          `Exact Noelle predicate or payload hash drifted for ${occurrence.occurrenceId}.`,
        );
      }
      selectedOccurrences.push({
        occurrenceId: occurrence.occurrenceId,
        characterId: definition.characterId,
        sourceRecordId: occurrence.sourceRecordId,
        repositoryRecordId: occurrence.repositoryRecordId,
        manualClaimPath: occurrence.manualClaimPath,
        repositoryPath: occurrence.repositoryPath,
        claimAxis: occurrence.claimAxis,
        mainStatSlot: definition.mainStatSlot,
        conditions: [...occurrence.conditions],
        conditionsSha256: occurrence.conditionsSha256,
        payload,
        payloadSha256,
        predicate: structuredClone(definition.predicate),
        predicateSha256,
        sourcePredicateLeafSha256,
        requestPredicate: structuredClone(NUMERIC_REQUEST_PREDICATE),
        requestPredicateSha256,
        repositoryParity: "exact",
        sliceDisposition: "selected",
        bindingAuthoredBySlice: true,
        sliceBindingClassification: "typed-bound",
        energyClassificationAuthoredBySlice: true,
        sliceEnergyClassification: "not-energy-deferred",
      });
      const claim = buildAtomicClaim(
        repository,
        occurrence,
        definition,
        payload,
        catalogIndex,
      );
      claims.push({
        claim,
        occurrenceControl: {
          occurrenceId: occurrence.occurrenceId,
          snapshotPath: occurrence.snapshotPath,
          sourceId: occurrence.sourceId,
          sourceRecordId: occurrence.sourceRecordId,
          repositoryRecordId: occurrence.repositoryRecordId,
          manualPath: occurrence.manualPath,
          manualClaimPath: occurrence.manualClaimPath,
          repositoryJsonPath: occurrence.repositoryJsonPath,
          claimAxis: "main-stat",
          mainStatSlot: definition.mainStatSlot,
          repositoryParity: "exact",
          sliceDisposition: "selected",
          energyClassification: "not-energy-deferred",
          sourceConditionsSha256: occurrence.conditionsSha256,
          sourcePredicateSha256: predicateSha256,
          payloadSha256,
        },
        requestBindings: [
          {
            sourcePredicatePath: "predicate",
            sourcePredicateLeafSha256,
            requestPredicate: structuredClone(NUMERIC_REQUEST_PREDICATE),
          },
        ],
      });
    });

    const holdoutOccurrences = HOLDOUT_OCCURRENCES.map((definition) => {
      const occurrence = requiredOccurrence(
        occurrenceById,
        definition.occurrenceId,
      );
      authenticateHoldoutDefinition(definition, occurrence);
      return {
        occurrenceId: occurrence.occurrenceId,
        sourceRecordId: occurrence.sourceRecordId,
        repositoryRecordId: occurrence.repositoryRecordId,
        manualClaimPath: occurrence.manualClaimPath,
        repositoryPath: occurrence.repositoryPath,
        claimAxis: occurrence.claimAxis,
        ...(occurrence.mainStatSlot
          ? { mainStatSlot: occurrence.mainStatSlot }
          : {}),
        conditions: [...occurrence.conditions],
        conditionsSha256: occurrence.conditionsSha256,
        structuralEnergyDimension: occurrence.structuralEnergyDimension,
        repositoryParity: "exact" as const,
        sliceDisposition: "holdout" as const,
        consumedBySlice: false as const,
        bindingAuthoredBySlice: false as const,
        energyClassificationAuthoredBySlice: false as const,
      };
    });
    const authenticatedEmptyOccurrences: NoelleSourceLocalEmptyOccurrence[] =
      EMPTY_OCCURRENCES.map((definition) => {
        const occurrence = requiredOccurrence(
          emptyOccurrenceById,
          definition.occurrenceId,
        );
        authenticateEmptyDefinition(definition, occurrence);
        return {
          occurrenceId: occurrence.occurrenceId,
          sourceRecordId: occurrence.sourceRecordId,
          repositoryRecordId: occurrence.repositoryRecordId,
          manualClaimPath: occurrence.manualClaimPath,
          repositoryPath: occurrence.repositoryPath,
          claimAxis: occurrence.claimAxis,
          conditions: [] as [],
          conditionsSha256: occurrence.conditionsSha256,
          repositoryParity: "exact" as const,
          sliceDisposition: "empty-unconditional" as const,
          consumedBySlice: false as const,
          bindingAuthoredBySlice: false as const,
          energyClassificationAuthoredBySlice: false as const,
        };
      });

    const exactTeams = buildExactTeams(repository, snapshot);
    const sourceLocalInput = buildSourceLocalInput(
      generatedFrom,
      claims,
      exactTeams,
      canonicalSourceHashes(generatedFrom),
    );
    const sourceLocalSlice =
      buildSourceLocalConditionSliceReport(sourceLocalInput);
    if (sourceLocalSlice.comparisonStatus !== "comparable") {
      throw new Error(
        `The canonical Noelle high-investment slice is not comparable: ${sourceLocalSlice.issues
          .map(({ code }) => code)
          .join(", ")}.`,
      );
    }
    authenticateExpectedSliceSemantics(sourceLocalSlice);

    return {
      schemaVersion: 1,
      reportType: "noelle-source-local-high-investment-slice",
      sliceId: NOELLE_SLICE_ID,
      classification: "authenticated-source-local-condition-binding-slice",
      comparisonStatus: "comparable",
      publicationStatus: "withheld-unreviewed-source-slice",
      ...CAPABILITY_BOUNDARY,
      generatedFrom,
      rawInputBoundary: {
        status: "accepted",
        exactPathSet: true,
        byteAndParsedObjectClosure: true,
        sourceFileCount:
          NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS.length,
        canonicalObjectSha256ByPath,
      },
      sourceBoundary: {
        status: "accepted",
        sourceId: "kqm",
        pageUrl: NOELLE_PAGE_URL,
        sourceVersion: NOELLE_SOURCE_VERSION,
        snapshotPath: NOELLE_SNAPSHOT_RELATIVE_PATH,
        rawRecordCount: snapshot.records.length,
        rawRecordIds: snapshot.records
          .map(({ sourceRecordId }) => sourceRecordId)
          .sort(compareText),
        totalConditionArrayCount: allOccurrences.length,
        nonemptyConditionArrayCount: nonemptyOccurrences.length,
        emptyConditionArrayCount: emptyOccurrences.length,
        selectedOccurrenceCount: selectedOccurrences.length,
        holdoutOccurrenceCount: holdoutOccurrences.length,
        selectedAndHoldoutsCloseAllNonemptyNoelleConditions: true,
        emptyOccurrenceClosureExact: true,
        repositoryParity: coverageCore.repositoryParity.status,
        samePageLineage: true,
        guideAndTeamShareExactSourceDocument: true,
        crossRecordJoinOwnedByWrapper: true,
        sourceAuthoredCrossRecordJoin: false,
        extractionMethod: "agent-assisted",
        reviewStatus: "unreviewed",
        sourceRegistryStatus: "active",
        sourceRegistryIngestionMode: "manual-observation",
        sourceRegistryPermission: "unknown",
        promotionEligible: false,
      },
      selectedOccurrences,
      holdoutOccurrences,
      emptyOccurrences: authenticatedEmptyOccurrences,
      numericEvaluationBoundary: {
        sourcePredicateAstPreserved: true,
        sourceTalentLevelsEvaluated: false,
        requestOverlayOwnsNumericEvaluation: true,
        constellationDerivedTalentBehavior: false,
        requestPredicateSha256: hashValue(NUMERIC_REQUEST_PREDICATE),
      },
      sourceLocalSlice,
      summary: summaryFromSlice(
        sourceLocalSlice,
        allOccurrences.length,
        emptyOccurrences.length,
        holdoutOccurrences,
      ),
      issues: [],
      cautions: [...CAUTIONS],
      prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    };
  } catch (error) {
    return failedReport(
      generatedFrom,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function authenticateNoelleSourceLocalHighInvestmentSliceReport(
  serializedReport: NoelleSourceLocalHighInvestmentSliceReport,
  input: BuildNoelleSourceLocalHighInvestmentSliceInput,
): NoelleSourceLocalHighInvestmentSliceAuthentication {
  const canonicalReport = buildNoelleSourceLocalHighInvestmentSliceReport(input);
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
          code: "noelle-source-local.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Noelle source-local report does not match a fresh canonical rebuild from current exact inputs.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableNoelleSourceLocalHighInvestmentSliceReport(
  report: NoelleSourceLocalHighInvestmentSliceReport,
  input: BuildNoelleSourceLocalHighInvestmentSliceInput,
): void {
  const authentication = authenticateNoelleSourceLocalHighInvestmentSliceReport(
    report,
    input,
  );
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Noelle source-local report (${authentication.reason}): ${authentication.issues
      .map(({ code, message }) => `${code}: ${message}`)
      .join("; ")}`,
  );
}

function buildSourceLocalInput(
  generatedFrom: readonly GeneratedFromEntry[],
  claims: readonly SourceLocalConditionClaimInput[],
  exactTeams: readonly SourceLocalExactTeamInput[],
  sourceHashes: readonly GeneratedFromEntry[],
): SourceLocalConditionSliceInput {
  return {
    sliceId: NOELLE_SLICE_ID,
    generatedFrom,
    sourceBoundary: {
      sourceId: "kqm",
      pageUrl: NOELLE_PAGE_URL,
      sourceVersion: NOELLE_SOURCE_VERSION,
      snapshotPath: NOELLE_SNAPSHOT_RELATIVE_PATH,
      rawManualSourceRecordIds: [
        GUIDE_DEFINITION.sourceRecordId,
        TEAM_DEFINITION.sourceRecordId,
      ],
      consolidatedGuideRecordIds: [
        GUIDE_DEFINITION.repositoryRecordId,
        TEAM_DEFINITION.repositoryRecordId,
      ],
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryPermission: "unknown",
      repositoryRecordStatus: "candidate",
      sourceHashes,
    },
    claims,
    exactTeams,
    requestContext: {
      requestFactsByTeamRecordId: {
        [TEAM_DEFINITION.repositoryRecordId]: {
          characterFactsById: {
            noelle: { constellation: 6 },
          },
        },
      },
    },
    expectedCounts: {
      claimCount: 3,
      teamCount: 1,
      cellCount: 3,
      sourceResolution: { matched: 0, inapplicable: 0, unresolved: 3 },
      effectiveResolution: { matched: 3, inapplicable: 0, unresolved: 0 },
      contextApplicability: {
        sourceAlreadyMatched: 0,
        sourceDefinitelyInapplicable: 0,
        applicableUnderSuppliedContext: 3,
        notApplicableUnderSuppliedContext: 0,
        stillUnresolved: 0,
      },
    },
    cautions: CAUTIONS,
    prohibitedInterpretations: PROHIBITED_INTERPRETATIONS,
  };
}

function buildAtomicClaim(
  repository: KnowledgeRepository,
  occurrence: NoelleConditionOccurrence,
  definition: SelectedOccurrenceDefinition,
  payload: SourceConditionedClaimPayload,
  catalogIndex: number,
): SourceConditionedAtomicClaim {
  const record = requiredRepositoryCharacterGuide(
    repository,
    GUIDE_DEFINITION.repositoryRecordId,
  );
  const recommendations = record.recommendations ?? [];
  const recommendation = recommendations[0];
  if (
    record.characterId !== definition.characterId ||
    !recommendation ||
    recommendation.id !== GUIDE_DEFINITION.recommendationId ||
    recommendation.scope !== "artifact-stats" ||
    stableJson(recommendation.roles) !== stableJson(["dps"]) ||
    recommendations.length !== 1 ||
    record.builds.length !== 0
  ) {
    throw new Error(
      `Exact selected character-guide recommendation lineage drifted for ${occurrence.occurrenceId}.`,
    );
  }
  return {
    claimId: occurrence.occurrenceId,
    catalogIndex,
    repositoryRecordId: occurrence.repositoryRecordId,
    sourceId: occurrence.sourceId,
    sourceRecordId: occurrence.sourceRecordId,
    characterId: definition.characterId,
    recommendation: {
      recommendationId: recommendation.id,
      label: recommendation.label ?? null,
      scope: recommendation.scope,
      roles: [...recommendation.roles],
      ordering: null,
      classification: null,
      grouping: null,
      sourceIndex: sourceItemIndex(occurrence.repositoryPath),
    },
    payload,
    sourceConditions: [...occurrence.conditions],
    sourceConditionsSha256: occurrence.conditionsSha256,
    predicate: structuredClone(definition.predicate),
  };
}

function buildExactTeams(
  repository: KnowledgeRepository,
  snapshot: ManualObservationSnapshot,
): SourceLocalExactTeamInput[] {
  const definition = TEAM_DEFINITION;
  const repositoryRecord = requiredRepositoryTeam(
    repository,
    definition.repositoryRecordId,
  );
  const manualRecord = snapshot.records.find(
    (record) =>
      record.kind === "team" &&
      record.sourceRecordId === definition.sourceRecordId,
  );
  if (!manualRecord || manualRecord.kind !== "team") {
    throw new Error(`Missing exact manual team ${definition.sourceRecordId}.`);
  }
  const repositoryRoster = repositoryRecord.members.map(
    ({ characterId }) => characterId,
  );
  const manualRoster = manualRecord.members.map(
    ({ characterId }) => characterId,
  );
  const manualTeamSemantics = {
    label: manualRecord.label ?? null,
    intent: manualRecord.intent,
    exhaustiveness: manualRecord.exhaustiveness,
    rankingClaim: manualRecord.rankingClaim,
  };
  const repositoryTeamSemantics = {
    label: repositoryRecord.label ?? null,
    intent: repositoryRecord.intent ?? null,
    exhaustiveness: repositoryRecord.exhaustiveness ?? null,
    rankingClaim: repositoryRecord.rankingClaim ?? null,
  };
  const expectedSourceRefs = [
    manualRecord.locator,
    ...manualRecord.supportingLocators,
  ].map((locator) => ({
    sourceId: "kqm" as const,
    sourceRecordId: definition.sourceRecordId,
    locator,
  }));
  const exactSourceInvestment =
    manualRecord.members.every(
      (member) =>
        member.constellation == null &&
        member.minConstellation == null &&
        member.maxConstellation == null,
    );
  const exactRepositoryInvestment =
    repositoryRecord.members.every(
      ({ investment }) =>
        stableJson(investment) === stableJson({ status: "unspecified" }),
    );
  if (
    stableJson(repositoryRoster) !==
      stableJson(definition.memberCharacterIds) ||
    stableJson(manualRoster) !== stableJson(definition.memberCharacterIds) ||
    stableJson(repositoryTeamSemantics) !== stableJson(manualTeamSemantics) ||
    manualTeamSemantics.intent !== "example" ||
    manualTeamSemantics.exhaustiveness !== "non-exhaustive" ||
    manualTeamSemantics.rankingClaim !== "none" ||
    stableJson(repositoryRecord.sourceRefs) !==
      stableJson(expectedSourceRefs) ||
    stableJson(repositoryRecord.reactions) !==
      stableJson(manualRecord.reactions) ||
    stableJson(repositoryRecord.rotations) !==
      stableJson(manualRecord.rotations) ||
    stableJson(repositoryRecord.artifactPlans) !==
      stableJson(manualRecord.artifactPlans) ||
    locatorUrl(manualRecord.locator) !== NOELLE_PAGE_URL ||
    repositoryRecord.status !== "candidate" ||
    repositoryRecord.promotionEligible !== false ||
    !exactSourceInvestment ||
    !exactRepositoryInvestment ||
    repositoryRecord.members.some(
      ({ selectedArtifact, selectedWeapon }) =>
        selectedArtifact !== null || selectedWeapon !== null,
    )
  ) {
    throw new Error(
      `Exact team lineage drifted for ${definition.repositoryRecordId}.`,
    );
  }
  return [
    {
      packetIndex: 0,
      teamRecordId: repositoryRecord.id,
      snapshotPath: NOELLE_SNAPSHOT_RELATIVE_PATH,
      sourceId: "kqm",
      sourceRecordId: definition.sourceRecordId,
      label: repositoryRecord.label ?? null,
      intent: "example",
      exhaustiveness: "non-exhaustive",
      rankingClaim: "none",
      memberCharacterIds: [...definition.memberCharacterIds],
    },
  ];
}

function authenticateSourceDocument(
  snapshot: ManualObservationSnapshot,
  index: ReturnType<typeof ManualSnapshotIndexSchema.parse>,
  registry: ReturnType<typeof SourceRegistrySchema.parse>,
  repository: KnowledgeRepository,
  sourceRegistrySha256: string | undefined,
  snapshotSha256: string | undefined,
): void {
  const expectedIds = [...EXPECTED_RAW_RECORD_IDS].sort(compareText);
  const actualIds = snapshot.records
    .map(({ sourceRecordId }) => sourceRecordId)
    .sort(compareText);
  const indexMatches = index.snapshots.filter(
    ({ sourceId, path: snapshotPath }) =>
      sourceId === "kqm" && snapshotPath === NOELLE_SNAPSHOT_RELATIVE_PATH,
  );
  const matchingSources = registry.sources.filter(({ id }) => id === "kqm");
  const source = matchingSources[0];
  if (
    snapshot.sourceId !== "kqm" ||
    snapshot.page.url !== NOELLE_PAGE_URL ||
    snapshot.page.sourceVersion !== NOELLE_SOURCE_VERSION ||
    snapshot.page.title !== "Noelle Quick Guide" ||
    stableJson(actualIds) !== stableJson(expectedIds) ||
    snapshot.records.some(
      ({ locator, extraction }) =>
        locatorUrl(locator) !== NOELLE_PAGE_URL ||
        extraction.method !== "agent-assisted" ||
        extraction.reviewStatus !== "unreviewed",
    ) ||
    indexMatches.length !== 1 ||
    matchingSources.length !== 1 ||
    !source ||
    source.status !== "active" ||
    source.ingestionMode !== "manual-observation" ||
    source.permission !== "unknown" ||
    source.recordFormat !== "manual-observation-v1" ||
    snapshotSha256 !== EXPECTED_NOELLE_SNAPSHOT_SHA256 ||
    sourceRegistrySha256 == null ||
    repository.sourceRegistrySha256 !== sourceRegistrySha256
  ) {
    throw new Error(
      "Noelle source-document, index, or registry boundary drifted.",
    );
  }
}

function authenticateSelectedDefinitionAndPayload(
  definition: SelectedOccurrenceDefinition,
  occurrence: NoelleConditionOccurrence,
  snapshot: ManualObservationSnapshot,
  repository: KnowledgeRepository,
): void {
  const occurrencePrefix = `kqm:character_guide:${GUIDE_DEFINITION.sourceRecordId}:`;
  const expectedManualClaimPath = definition.occurrenceId.startsWith(
    occurrencePrefix,
  )
    ? definition.occurrenceId.slice(occurrencePrefix.length)
    : "";
  const expectedPath = `recommendation.mainStats.${definition.mainStatSlot}[0].conditions`;
  const expectedRepositoryPath = `recommendations[0].mainStats.${definition.mainStatSlot}[0].conditions`;
  if (
    expectedManualClaimPath !== expectedPath ||
    occurrence.conditionsSha256 !== definition.conditionsSha256 ||
    occurrence.manualClaimPath !== expectedPath ||
    occurrence.repositoryPath !== expectedRepositoryPath ||
    occurrence.sourceId !== "kqm" ||
    occurrence.sourceRecordId !== GUIDE_DEFINITION.sourceRecordId ||
    occurrence.repositoryRecordId !== GUIDE_DEFINITION.repositoryRecordId ||
    occurrence.subject !== definition.characterId ||
    occurrence.claimAxis !== "main-stat" ||
    occurrence.mainStatSlot !== definition.mainStatSlot ||
    occurrence.structuralEnergyDimension !== "not-structural-er"
  ) {
    throw new Error(
      `Exact occurrence boundary drifted for ${occurrence.occurrenceId}.`,
    );
  }
  const manualItem = sourceItemForOccurrence(snapshot, occurrence, "manual");
  const repositoryItem = sourceItemForOccurrence(
    repository,
    occurrence,
    "repository",
  );
  if (
    stableJson(manualItem) !== stableJson(definition.exactSourceItem) ||
    stableJson(repositoryItem) !== stableJson(definition.exactSourceItem)
  ) {
    throw new Error(
      `Exact source payload drifted for ${occurrence.occurrenceId}.`,
    );
  }
  const manualRecord = snapshot.records.find(
    (record) =>
      record.kind === "character_guide" &&
      record.sourceRecordId === GUIDE_DEFINITION.sourceRecordId,
  );
  const repositoryRecord = requiredRepositoryCharacterGuide(
    repository,
    GUIDE_DEFINITION.repositoryRecordId,
  );
  const manualRecommendation =
    manualRecord?.kind === "character_guide"
      ? manualRecord.recommendation
      : undefined;
  const repositoryRecommendations = repositoryRecord.recommendations ?? [];
  const repositoryRecommendation = repositoryRecommendations[0];
  const expectedSourceRefs =
    manualRecord?.kind === "character_guide"
      ? [manualRecord.locator, ...manualRecord.supportingLocators].map(
          (locator) => ({
            sourceId: "kqm" as const,
            sourceRecordId: GUIDE_DEFINITION.sourceRecordId,
            locator,
          }),
        )
      : [];
  if (
    !manualRecord ||
    manualRecord.kind !== "character_guide" ||
    manualRecord.characterId !== definition.characterId ||
    manualRecommendation?.id !== GUIDE_DEFINITION.recommendationId ||
    manualRecommendation.scope !== "artifact-stats" ||
    stableJson(manualRecommendation.roles) !== stableJson(["dps"]) ||
    repositoryRecord.characterId !== definition.characterId ||
    repositoryRecommendations.length !== 1 ||
    repositoryRecommendation?.id !== GUIDE_DEFINITION.recommendationId ||
    repositoryRecommendation.scope !== "artifact-stats" ||
    stableJson(repositoryRecommendation.roles) !== stableJson(["dps"]) ||
    repositoryRecord.builds.length !== 0 ||
    repositoryRecord.status !== "candidate" ||
    repositoryRecord.promotionEligible !== false ||
    stableJson(repositoryRecord.sourceRefs) !== stableJson(expectedSourceRefs)
  ) {
    throw new Error(
      `Exact selected character-guide recommendation lineage drifted for ${occurrence.occurrenceId}.`,
    );
  }
}

function authenticateHoldoutDefinition(
  definition: HoldoutOccurrenceDefinition,
  occurrence: NoelleConditionOccurrence,
): void {
  if (
    occurrence.occurrenceId !== definition.occurrenceId ||
    occurrence.conditionsSha256 !== definition.conditionsSha256 ||
    hashValue(occurrence.conditions) !== definition.conditionsSha256 ||
    occurrence.conditions.length === 0 ||
    occurrence.sourceId !== "kqm" ||
    occurrence.structuralEnergyDimension !== "not-structural-er"
  ) {
    throw new Error(
      `Exact descriptive holdout boundary drifted for ${definition.occurrenceId}.`,
    );
  }
}

function authenticateEmptyDefinition(
  definition: EmptyOccurrenceDefinition,
  occurrence: NoelleConditionOccurrence,
): void {
  if (
    occurrence.occurrenceId !== definition.occurrenceId ||
    occurrence.conditionsSha256 !== definition.conditionsSha256 ||
    hashValue(occurrence.conditions) !== definition.conditionsSha256 ||
    occurrence.conditions.length !== 0 ||
    occurrence.sourceId !== "kqm" ||
    occurrence.structuralEnergyDimension !== "not-structural-er"
  ) {
    throw new Error(
      `Exact empty occurrence boundary drifted for ${definition.occurrenceId}.`,
    );
  }
}

function authenticateExactOccurrencePartition(
  occurrenceById: ReadonlyMap<string, NoelleConditionOccurrence>,
  selectedIds: ReadonlySet<string>,
  holdoutIds: ReadonlySet<string>,
): void {
  if (selectedIds.size !== 3 || holdoutIds.size !== 12) {
    throw new Error("Noelle selected/holdout occurrence counts drifted.");
  }
  if ([...selectedIds].some((occurrenceId) => holdoutIds.has(occurrenceId))) {
    throw new Error("Noelle selected and holdout occurrence sets overlap.");
  }
  const union = [...selectedIds, ...holdoutIds].sort(compareText);
  const current = [...occurrenceById.keys()].sort(compareText);
  if (stableJson(union) !== stableJson(current)) {
    throw new Error(
      "Noelle selected and holdout occurrence sets do not close the exact fifteen-array nonempty condition corpus.",
    );
  }
}

function authenticateExactEmptyPartition(
  occurrenceById: ReadonlyMap<string, NoelleConditionOccurrence>,
): void {
  const expected = EMPTY_OCCURRENCES.map(({ occurrenceId }) =>
    occurrenceId,
  ).sort(compareText);
  const current = [...occurrenceById.keys()].sort(compareText);
  if (
    EMPTY_OCCURRENCES.length !== 1 ||
    stableJson(expected) !== stableJson(current)
  ) {
    throw new Error(
      "Noelle empty occurrence set does not close the exact one-array empty corpus.",
    );
  }
}

function authenticateExpectedSliceSemantics(
  report: SourceLocalConditionSliceReport,
): void {
  const safe =
    report.summary.claimCount === 3 &&
    report.summary.teamCount === 1 &&
    report.summary.cellCount === 3 &&
    report.summary.sourceMatchedCount === 0 &&
    report.summary.sourceInapplicableCount === 0 &&
    report.summary.sourceUnresolvedCount === 3 &&
    report.summary.effectiveMatchedCount === 3 &&
    report.summary.effectiveInapplicableCount === 0 &&
    report.summary.effectiveUnresolvedCount === 0 &&
    report.summary.applicableUnderSuppliedContextCount === 3 &&
    report.summary.sourceAlreadyMatchedCount === 0 &&
    report.summary.sourceDefinitelyInapplicableCount === 0 &&
    report.summary.deferredEnergyCount === 0 &&
    report.summary.assembledBuildCount === 0 &&
    report.sourceClaimCatalog.every(
      ({ predicate }) =>
        stableJson(predicate) === stableJson(INVESTMENT_THRESHOLD_PREDICATE),
    ) &&
    report.requestContextReport?.context.requestFactsByTeamRecordId?.[
      TEAM_DEFINITION.repositoryRecordId
    ]?.characterFactsById?.noelle?.constellation === 6 &&
    report.requestContextReport?.context.requestFactsByTeamRecordId?.[
      TEAM_DEFINITION.repositoryRecordId
    ]?.characterFactsById?.noelle?.talentLevels == null &&
    report.requestContextReport?.teamProjections.every(({ claimProjections }) =>
      claimProjections.every(({ requestContextBindings }) => {
        const binding = requestContextBindings[0];
        const constellationRow = binding?.predicateRows.find(
          ({ predicateType }) => predicateType === "constellation-at-least",
        );
        const talentRow = binding?.predicateRows.find(
          ({ predicateType }) => predicateType === "talent-level-at-least",
        );
        return (
          requestContextBindings.length === 1 &&
          binding?.result === "true" &&
          constellationRow?.result === "true" &&
          talentRow?.result === "unknown" &&
          stableJson(constellationRow.factScope) ===
            stableJson({
              teamRecordId: TEAM_DEFINITION.repositoryRecordId,
              characterId: "noelle",
              accountSnapshotId: null,
            }) &&
          stableJson(talentRow.factScope) ===
            stableJson({
              teamRecordId: TEAM_DEFINITION.repositoryRecordId,
              characterId: "noelle",
              accountSnapshotId: null,
            })
        );
      }),
    ) === true &&
    !report.supportsGuideClaims &&
    !report.supportsTeamRecommendations &&
    !report.supportsBuildRecommendations &&
    !report.supportsStatRecommendations &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsEnergyRecoveryClaims &&
    !report.recommendationCompositionExecuted &&
    !report.generatorExecuted &&
    !report.optimizerExecuted &&
    !report.damageComputationExecuted &&
    !report.energyRecoveryComputationExecuted;
  if (!safe) {
    throw new Error(
      "Noelle source-local high-investment slice crossed its expected semantic boundary.",
    );
  }
}

function authenticateGeneratedFrom(
  input: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  const expectedPaths = [...NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS];
  const canonical = [...input]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    stableJson(canonical.map(({ path: entryPath }) => entryPath)) !==
    stableJson(expectedPaths)
  ) {
    throw new Error("Noelle source-local generatedFrom path closure drifted.");
  }
  if (
    canonical.some(({ sha256 }) => !/^[a-f0-9]{64}$/.test(sha256)) ||
    new Set(canonical.map(({ path: entryPath }) => entryPath)).size !==
      canonical.length
  ) {
    throw new Error(
      "Noelle source-local generatedFrom hashes or paths are invalid.",
    );
  }
  return canonical;
}

function authenticateRawInputs(
  input: BuildNoelleSourceLocalHighInvestmentSliceInput,
  generatedFrom: readonly GeneratedFromEntry[],
): Record<string, string> {
  const files = [...input.sourceFiles].sort((left, right) =>
    compareText(left.path, right.path),
  );
  const expectedPaths = [
    ...NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  ].sort(compareText);
  if (
    stableJson(files.map(({ path: filePath }) => filePath)) !==
    stableJson(expectedPaths)
  ) {
    throw new Error("Noelle raw source-file path closure drifted.");
  }
  const valuesByPath = new Map<string, unknown>([
    [REPOSITORY_RELATIVE_PATH, input.repositoryInput],
    [NOELLE_SNAPSHOT_RELATIVE_PATH, input.manualSnapshotInput],
    [MANUAL_INDEX_RELATIVE_PATH, input.manualIndexInput],
    [SOURCE_REGISTRY_RELATIVE_PATH, input.sourceRegistryInput],
  ]);
  return Object.fromEntries(
    files.map((file) => {
      const generatedMatches = generatedFrom.filter(
        ({ path: entryPath }) => entryPath === file.path,
      );
      if (
        generatedMatches.length !== 1 ||
        generatedMatches[0]?.sha256 !== sha256Text(file.text)
      ) {
        throw new Error(`Raw byte hash mismatch for ${file.path}.`);
      }
      const parsed = JSON.parse(file.text) as unknown;
      if (stableJson(parsed) !== stableJson(valuesByPath.get(file.path))) {
        throw new Error(
          `Parsed input does not match raw bytes for ${file.path}.`,
        );
      }
      return [file.path, hashValue(parsed)];
    }),
  );
}

function canonicalSourceHashes(
  generatedFrom: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  const sourcePaths = new Set<string>(
    NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  );
  return generatedFrom
    .filter(({ path: entryPath }) => sourcePaths.has(entryPath))
    .map((entry) => ({ ...entry }));
}

function payloadForOccurrence(
  root: KnowledgeRepository | ManualObservationSnapshot,
  occurrence: NoelleConditionOccurrence,
  kind: "manual" | "repository",
): SourceConditionedClaimPayload {
  const item = sourceItemForOccurrence(root, occurrence, kind);
  if (occurrence.claimAxis === "main-stat" && occurrence.mainStatSlot) {
    const statIds = item.statIds;
    if (!Array.isArray(statIds) || statIds.some((statId) => typeof statId !== "string")) {
      throw new Error(
        `Missing main-stat payload for ${occurrence.occurrenceId}.`,
      );
    }
    return {
      type: "main-stat",
      slot: occurrence.mainStatSlot,
      statIds: [...statIds] as string[],
      priority: null,
      target: null,
    };
  }
  throw new Error(
    `Unsupported Noelle source-local claim axis ${occurrence.claimAxis}.`,
  );
}

function sourceItemForOccurrence(
  root: KnowledgeRepository | ManualObservationSnapshot,
  occurrence: NoelleConditionOccurrence,
  kind: "manual" | "repository",
): Record<string, unknown> {
  const conditionPath =
    kind === "manual" ? occurrence.manualPath : occurrence.repositoryJsonPath;
  const itemPath = conditionPath.replace(/\.conditions$/, "");
  const value = readJsonPath(root, itemPath);
  if (!isRecord(value)) {
    throw new Error(`Condition parent ${itemPath} is not an object.`);
  }
  return structuredClone(value);
}

function readJsonPath(root: unknown, jsonPath: string): unknown {
  const tokens = [...jsonPath.matchAll(/([^.\[\]]+)|\[(\d+)\]/g)].map(
    (match) => (match[2] == null ? match[1]! : Number(match[2])),
  );
  let value = root;
  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(value) || token >= value.length) {
        throw new Error(`Invalid array token [${token}] in ${jsonPath}.`);
      }
      value = value[token];
    } else {
      if (!isRecord(value) || !(token in value)) {
        throw new Error(`Invalid object token ${token} in ${jsonPath}.`);
      }
      value = value[token];
    }
  }
  return value;
}

function requiredOccurrence(
  byId: ReadonlyMap<string, NoelleConditionOccurrence>,
  occurrenceId: string,
): NoelleConditionOccurrence {
  const occurrence = byId.get(occurrenceId);
  if (!occurrence) throw new Error(`Missing exact occurrence ${occurrenceId}.`);
  return occurrence;
}

function requiredRepositoryTeam(
  repository: KnowledgeRepository,
  recordId: string,
): Extract<KnowledgeRepository["records"][number], { kind: "team" }> {
  const record = repository.records.find(({ id }) => id === recordId);
  if (!record || record.kind !== "team") {
    throw new Error(`Missing exact Noelle team record ${recordId}.`);
  }
  return record;
}

function requiredRepositoryCharacterGuide(
  repository: KnowledgeRepository,
  recordId: string,
): Extract<
  KnowledgeRepository["records"][number],
  { kind: "character_guide" }
> {
  const record = repository.records.find(({ id }) => id === recordId);
  if (!record || record.kind !== "character_guide") {
    throw new Error(`Missing exact Noelle character-guide record ${recordId}.`);
  }
  return record;
}

function sourceItemIndex(repositoryPath: string): number {
  const matches = [...repositoryPath.matchAll(/\[(\d+)\]/g)];
  const last = matches.at(-1)?.[1];
  if (last == null)
    throw new Error(`Missing source index in ${repositoryPath}.`);
  return Number(last);
}

function locatorUrl(locator: unknown): string | null {
  return isRecord(locator) && typeof locator.url === "string"
    ? locator.url
    : null;
}

function summaryFromSlice(
  sourceLocalSlice: SourceLocalConditionSliceReport,
  totalConditionArrayCount: number,
  emptyConditionArrayCount: number,
  holdouts: readonly NoelleSourceLocalHoldoutOccurrence[],
): NoelleSourceLocalHighInvestmentSliceReport["summary"] {
  return {
    totalConditionArrayCount,
    nonemptyConditionArrayCount:
      totalConditionArrayCount - emptyConditionArrayCount,
    emptyConditionArrayCount,
    selectedOccurrenceCount: sourceLocalSlice.summary.claimCount,
    selectedUniqueConditionArrayCount: new Set(
      sourceLocalSlice.conditionControls.map(
        ({ occurrenceControl }) => occurrenceControl.sourceConditionsSha256,
      ),
    ).size,
    holdoutOccurrenceCount: holdouts.length,
    sourceTeamCount: sourceLocalSlice.summary.teamCount,
    sourceCellCount: sourceLocalSlice.summary.cellCount,
    sourceMatchedCount: sourceLocalSlice.summary.sourceMatchedCount,
    sourceInapplicableCount: sourceLocalSlice.summary.sourceInapplicableCount,
    sourceUnresolvedCount: sourceLocalSlice.summary.sourceUnresolvedCount,
    contextApplicableCount:
      sourceLocalSlice.summary.applicableUnderSuppliedContextCount,
    sourceAlreadyMatchedCount:
      sourceLocalSlice.summary.sourceAlreadyMatchedCount,
    sourceDefinitelyInapplicableCount:
      sourceLocalSlice.summary.sourceDefinitelyInapplicableCount,
    effectiveMatchedCount: sourceLocalSlice.summary.effectiveMatchedCount,
    effectiveInapplicableCount:
      sourceLocalSlice.summary.effectiveInapplicableCount,
    effectiveUnresolvedCount: sourceLocalSlice.summary.effectiveUnresolvedCount,
    selectedNotEnergyDeferredCount: sourceLocalSlice.summary.claimCount,
    holdoutConsumedCount: 0,
    holdoutBindingAuthoredCount: 0,
    holdoutEnergyClassificationAuthoredCount: 0,
    emptyConsumedCount: 0,
    candidateCount: 0,
    equipmentAssignmentCount: 0,
    optimizationCount: 0,
    assembledBuildCount: 0,
  };
}

function failedReport(
  generatedFrom: readonly GeneratedFromEntry[],
  message: string,
): NoelleSourceLocalHighInvestmentSliceReport {
  return {
    schemaVersion: 1,
    reportType: "noelle-source-local-high-investment-slice",
    sliceId: NOELLE_SLICE_ID,
    classification: "authenticated-source-local-condition-binding-slice",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-unreviewed-source-slice",
    ...CAPABILITY_BOUNDARY,
    generatedFrom: [...generatedFrom]
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    rawInputBoundary: {
      status: "rejected",
      exactPathSet: false,
      byteAndParsedObjectClosure: false,
      sourceFileCount: 0,
      canonicalObjectSha256ByPath: {},
    },
    sourceBoundary: {
      status: "rejected",
      sourceId: "kqm",
      pageUrl: NOELLE_PAGE_URL,
      sourceVersion: NOELLE_SOURCE_VERSION,
      snapshotPath: NOELLE_SNAPSHOT_RELATIVE_PATH,
      rawRecordCount: 0,
      rawRecordIds: [],
      totalConditionArrayCount: 0,
      nonemptyConditionArrayCount: 0,
      emptyConditionArrayCount: 0,
      selectedOccurrenceCount: 0,
      holdoutOccurrenceCount: 0,
      selectedAndHoldoutsCloseAllNonemptyNoelleConditions: false,
      emptyOccurrenceClosureExact: false,
      repositoryParity: "not-evaluated",
      samePageLineage: false,
      guideAndTeamShareExactSourceDocument: false,
      crossRecordJoinOwnedByWrapper: true,
      sourceAuthoredCrossRecordJoin: false,
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryIngestionMode: "manual-observation",
      sourceRegistryPermission: "unknown",
      promotionEligible: false,
    },
    selectedOccurrences: [],
    holdoutOccurrences: [],
    emptyOccurrences: [],
    numericEvaluationBoundary: {
      sourcePredicateAstPreserved: true,
      sourceTalentLevelsEvaluated: false,
      requestOverlayOwnsNumericEvaluation: true,
      constellationDerivedTalentBehavior: false,
      requestPredicateSha256: EXPECTED_REQUEST_PREDICATE_SHA256,
    },
    sourceLocalSlice: null,
    summary: {
      totalConditionArrayCount: 0,
      nonemptyConditionArrayCount: 0,
      emptyConditionArrayCount: 0,
      selectedOccurrenceCount: 0,
      selectedUniqueConditionArrayCount: 0,
      holdoutOccurrenceCount: 0,
      sourceTeamCount: 0,
      sourceCellCount: 0,
      sourceMatchedCount: 0,
      sourceInapplicableCount: 0,
      sourceUnresolvedCount: 0,
      contextApplicableCount: 0,
      sourceAlreadyMatchedCount: 0,
      sourceDefinitelyInapplicableCount: 0,
      effectiveMatchedCount: 0,
      effectiveInapplicableCount: 0,
      effectiveUnresolvedCount: 0,
      selectedNotEnergyDeferredCount: 0,
      holdoutConsumedCount: 0,
      holdoutBindingAuthoredCount: 0,
      holdoutEnergyClassificationAuthoredCount: 0,
      emptyConsumedCount: 0,
      candidateCount: 0,
      equipmentAssignmentCount: 0,
      optimizationCount: 0,
      assembledBuildCount: 0,
    },
    issues: [
      {
        code: "noelle-source-local.canonical-input-preparation-failed",
        path: "input",
        message,
      },
    ],
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

// Keep the absolute paths imported above exercised and guarded by TypeScript;
// the CLI owns I/O while this module publishes repository-relative identities.
void KNOWLEDGE_REPOSITORY_PATH;
void MANUAL_SNAPSHOT_INDEX_PATH;
void SOURCE_REGISTRY_PATH;
