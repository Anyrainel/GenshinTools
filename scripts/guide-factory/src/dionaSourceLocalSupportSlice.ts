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
  type ArtifactChoice,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
} from "./schemas";
import {
  buildSourceLocalConditionSliceReport,
  type SourceLocalConditionClaimInput,
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
const DIONA_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-diona-manual.json";
const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_INDEX_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const DIONA_PAGE_URL = "https://keqingmains.com/q/diona-quickguide/";
const DIONA_SOURCE_VERSION = "Luna VIII";
const DIONA_SLICE_ID = "kqm-diona-source-local-support-slice-luna-viii";
const TEAM_DEFINITION = {
  repositoryRecordId: "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt",
  sourceRecordId: "c6-diona-mavuika-citlali-bennett-forward-melt",
  memberCharacterIds: ["diona", "mavuika", "citlali", "bennett"],
} as const;

type ExactSourceItem = Record<string, unknown>;

type DionaConditionOccurrence = ManualConditionArrayOccurrence & {
  repositoryJsonPath: string;
};

type SelectedOccurrenceDefinition = {
  occurrenceId: string;
  characterId: "diona" | "citlali" | "bennett";
  memberIndex: 0 | 2 | 3;
  conditionsSha256: string;
  exactSourceItem: ExactSourceItem;
  predicate: SourceConditionPredicateAst;
};

type HoldoutOccurrenceDefinition = {
  occurrenceId: string;
  conditionsSha256: string;
  expectedSubject: "diona";
  expectedStructuralEnergyDimension: "structural-er" | "not-structural-er";
  descriptiveInventory: "ordinary-holdout" | "er-deferred-holdout";
};

const SELECTED_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[0].artifactRecommendations[0].conditions",
    characterId: "diona",
    memberIndex: 0,
    conditionsSha256:
      "08f670b7ac533e6bc210b941362676ca19e7e9d3cf8b33e1d4398fb92161c2fe",
    exactSourceItem: {
      artifacts: [
        { type: "4pc", setId: "song_of_days_past" },
        { type: "4pc", setId: "noblesse_oblige" },
      ],
      grouping: "alternatives",
      classification: "recommended",
      conditions: ["Diona uses a support build in this team."],
    },
    predicate: supportRolePredicate("diona", "Diona"),
  },
  {
    occurrenceId:
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[2].artifactRecommendations[0].conditions",
    characterId: "citlali",
    memberIndex: 2,
    conditionsSha256:
      "026768a7de22a1a5ec52ba1f5cc420fe147cc120dc19c94996ff8ad3c1cfa1d9",
    exactSourceItem: {
      artifacts: [
        {
          type: "4pc",
          setId: "scroll_of_the_hero_of_cinder_city",
        },
      ],
      grouping: "single",
      classification: "recommended",
      conditions: ["Citlali uses a support build in this team."],
    },
    predicate: supportRolePredicate("citlali", "Citlali"),
  },
  {
    occurrenceId:
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[3].artifactRecommendations[0].conditions",
    characterId: "bennett",
    memberIndex: 3,
    conditionsSha256:
      "8dd1603ab20802ef0f0f91ce3e1d46d0a15baa87eb7d3c4e57fb5bf6e932405e",
    exactSourceItem: {
      artifacts: [
        { type: "4pc", setId: "noblesse_oblige" },
        { type: "4pc", setId: "instructor" },
      ],
      grouping: "alternatives",
      classification: "recommended",
      conditions: ["Bennett uses a support build in this team."],
    },
    predicate: supportRolePredicate("bennett", "Bennett"),
  },
] as const satisfies readonly SelectedOccurrenceDefinition[];

const HOLDOUT_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:character_guide:diona-support-artifact-sets-luna-viii:recommendation.artifactRecommendations[0].conditions",
    conditionsSha256:
      "2f83efd20834b38bfc4c894df2a74627b0f773bfc3d23eedab6c42bf7921f64f",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-artifact-sets-luna-viii:recommendation.artifactRecommendations[1].conditions",
    conditionsSha256:
      "787152fb4e5726e500967551b7eb8632f98233cd2791fef9d8549725eecc5bb7",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-artifact-sets-luna-viii:recommendation.artifactRecommendations[2].conditions",
    conditionsSha256:
      "cca1e4b66fb6f0cb610d29d639d6d45af6db635d44dadefc2285448c6c97eecf",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-artifact-sets-luna-viii:recommendation.artifactRecommendations[3].conditions",
    conditionsSha256:
      "8d2569659c9fe82e6684264b76b29f4ac69ddf3a747999f5dd0806bb9c325d59",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-artifact-sets-luna-viii:recommendation.artifactRecommendations[4].conditions",
    conditionsSha256:
      "8ed696a94c34b5678ca16d6c642bddcb951a1789b8c759648bdc9680f9818636",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-artifact-sets-luna-viii:recommendation.artifactRecommendations[5].conditions",
    conditionsSha256:
      "fb711f92ff0c03b081221db05fc071ca9cd4c9d82641d736810fbb11abe841e8",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-artifact-stats-luna-viii:recommendation.mainStats.circlet[2].conditions",
    conditionsSha256:
      "2e8a9bfa79fe8d6e465b7db567ca29a8e64935267a4f49b7f734f48a551b439f",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-artifact-stats-luna-viii:recommendation.substats[2].conditions",
    conditionsSha256:
      "2e8a9bfa79fe8d6e465b7db567ca29a8e64935267a4f49b7f734f48a551b439f",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-weapons-luna-viii:recommendation.weaponRecommendations[2].conditions",
    conditionsSha256:
      "818dcf6666e628b29f98999c873ccbb76048fd20bd29b011537573255aaa0242",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-weapons-luna-viii:recommendation.weaponRecommendations[3].conditions",
    conditionsSha256:
      "25373ca2161b55d6e4778b68167bb9af98686fd4ff33474a5f0a6e6390fb9fdc",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "ordinary-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-weapons-luna-viii:recommendation.weaponRecommendations[1].conditions",
    conditionsSha256:
      "0e9c01546ec5f030715c0e238dfbf3bba904f943d70c0b828c77f0ae25edfb29",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "er-deferred-holdout",
  },
  {
    occurrenceId:
      "kqm:character_guide:diona-support-weapons-luna-viii:recommendation.weaponRecommendations[4].conditions",
    conditionsSha256:
      "08103e8077a944df71baaea7bac53b4e74a63fec31bfa156f87118121efc2e8a",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "not-structural-er",
    descriptiveInventory: "er-deferred-holdout",
  },
  {
    occurrenceId:
      "kqm:energy_guidance:c6-diona-mavuika-citlali-bennett-er:targets[0].conditions",
    conditionsSha256:
      "542cf31d64a4d9867e7ea95d528b685e8a9988c08d0ae8849c2313d6f32afe0d",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "structural-er",
    descriptiveInventory: "er-deferred-holdout",
  },
  {
    occurrenceId:
      "kqm:energy_guidance:c6-diona-mavuika-citlali-bennett-er:targets[1].conditions",
    conditionsSha256:
      "2c075917377f23944bf13dfc483e93284a7c8982a9df884948df1ec79aa11691",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "structural-er",
    descriptiveInventory: "er-deferred-holdout",
  },
  {
    occurrenceId:
      "kqm:energy_guidance:c6-diona-mavuika-citlali-bennett-er:targets[2].conditions",
    conditionsSha256:
      "ac190a482d19a46c151dad35df4184c61ab89c28df35240a6c30b2cc525a2e9e",
    expectedSubject: "diona",
    expectedStructuralEnergyDimension: "structural-er",
    descriptiveInventory: "er-deferred-holdout",
  },
] as const satisfies readonly HoldoutOccurrenceDefinition[];

const EXPECTED_RAW_RECORD_IDS = [
  "c6-diona-mavuika-citlali-bennett-er",
  "c6-diona-mavuika-citlali-bennett-forward-melt",
  "diona-support-artifact-sets-luna-viii",
  "diona-support-artifact-stats-luna-viii",
  "diona-support-weapons-luna-viii",
] as const;

const CAUTIONS = [
  "The three selected occurrences remain agent-assisted and unreviewed source observations.",
  "Applicable-under-supplied-context means only that an explicit exact-team, exact-character request fact satisfies one pinned gameplay-role predicate.",
  "Each support-role fact is supplied independently for Diona, Citlali, and Bennett; the source condition text and recommendation metadata do not establish that runtime fact.",
  "The generic claim adapter's recommendationId and scope are structural locators for the exact team-member arrays, not source-authored recommendation labels.",
  "The fifteen nonempty holdouts are descriptive inventory only: ten ordinary and five ER-deferred; this slice consumes or classifies none of them.",
  "Not-energy-deferred is occurrence-scoped only to the three selected support-role conditions and does not provide an ER requirement or prove ER adequacy.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not interpret this slice as a Diona guide, artifact assignment, build, team recommendation, or ranking.",
  "Do not choose among Song of Days Past, Noblesse Oblige, Instructor, or Scroll from these applicability cells.",
  "Do not infer a typed predicate, request binding, or new energy classification for any of the fifteen holdouts or eight empty condition arrays.",
  "Do not combine the three independently applicable payloads into a coherent or compatible team build.",
  "Do not use this report as a generator, optimizer, formula, rotation, damage, DPS, ideal-roll, or ER result.",
] as const;

function supportRolePredicate(
  characterId: "diona" | "citlali" | "bennett",
  displayName: "Diona" | "Citlali" | "Bennett",
): SourceConditionPredicateAst {
  return {
    type: "unresolved-context",
    category: "gameplay-role",
    reason: `${displayName}'s intended support role must be supplied explicitly for exact team ${TEAM_DEFINITION.repositoryRecordId}; source condition text is not runtime role evidence.`,
  };
}
export interface DionaSourceLocalSupportSliceSourceFile {
  path: string;
  text: string;
}

export interface BuildDionaSourceLocalSupportSliceInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  sourceFiles: readonly DionaSourceLocalSupportSliceSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface DionaSourceLocalHoldoutOccurrence {
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
  descriptiveInventory: "ordinary-holdout" | "er-deferred-holdout";
  repositoryParity: "exact";
  sliceDisposition: "holdout";
  consumedBySlice: false;
  bindingAuthoredBySlice: false;
  energyClassificationAuthoredBySlice: false;
}

export interface DionaSourceLocalSelectedOccurrence {
  occurrenceId: string;
  characterId: "diona" | "citlali" | "bennett";
  memberIndex: 0 | 2 | 3;
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
  repositoryParity: "exact";
  sliceDisposition: "selected";
  bindingAuthoredBySlice: true;
  sliceBindingClassification: "typed-bound";
  energyClassificationAuthoredBySlice: true;
  sliceEnergyClassification: "not-energy-deferred";
}

export interface DionaSourceLocalSupportSliceReport {
  schemaVersion: 1;
  reportType: "diona-source-local-support-slice";
  sliceId: typeof DIONA_SLICE_ID;
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
  generatorExecuted: false;
  optimizerExecuted: false;
  artifactAssignmentExecuted: false;
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
    pageUrl: typeof DIONA_PAGE_URL;
    sourceVersion: typeof DIONA_SOURCE_VERSION;
    snapshotPath: typeof DIONA_SNAPSHOT_RELATIVE_PATH;
    rawRecordCount: number;
    rawRecordIds: string[];
    totalConditionArrayCount: number;
    nonemptyConditionArrayCount: number;
    emptyConditionArrayCount: number;
    selectedOccurrenceCount: number;
    holdoutOccurrenceCount: number;
    ordinaryHoldoutInventoryCount: number;
    erDeferredHoldoutInventoryCount: number;
    selectedAndHoldoutsCloseAllNonemptyDionaConditions: boolean;
    repositoryParity: "exact" | "mismatch" | "not-evaluated";
    samePageLineage: boolean;
    selectedClaimsAndTeamShareExactSourceRecord: boolean;
    extractionMethod: "agent-assisted";
    reviewStatus: "unreviewed";
    sourceRegistryStatus: "active";
    sourceRegistryIngestionMode: "manual-observation";
    sourceRegistryPermission: "unknown";
    promotionEligible: false;
  };
  selectedOccurrences: DionaSourceLocalSelectedOccurrence[];
  holdoutOccurrences: DionaSourceLocalHoldoutOccurrence[];
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
    ordinaryHoldoutInventoryCount: number;
    erDeferredHoldoutInventoryCount: number;
    holdoutConsumedCount: 0;
    holdoutBindingAuthoredCount: 0;
    holdoutEnergyClassificationAuthoredCount: 0;
    assembledBuildCount: 0;
  };
  issues: SourceConditionedGuidePacketIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type DionaSourceLocalSupportSliceAuthentication =
  | {
      authenticated: true;
      canonicalReport: DionaSourceLocalSupportSliceReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: SourceConditionedGuidePacketIssue[];
    };

export const DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS = [
  REPOSITORY_RELATIVE_PATH,
  MANUAL_INDEX_RELATIVE_PATH,
  SOURCE_REGISTRY_RELATIVE_PATH,
  DIONA_SNAPSHOT_RELATIVE_PATH,
] as const;

export const DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS = [
  ...new Set([
    "scripts/guide-factory/src/dionaSourceLocalSupportSlice.ts",
    "scripts/guide-factory/src/assemble-diona-source-local-support-slice.ts",
    "scripts/guide-factory/src/sourceLocalConditionSlice.ts",
    "scripts/guide-factory/src/sourceConditionedGuidePacket.ts",
    "scripts/guide-factory/src/guideRequestContext.ts",
    "scripts/guide-factory/src/manualConditionArrayCoverage.ts",
    "scripts/guide-factory/src/schemas.ts",
    "scripts/guide-factory/src/io.ts",
    "scripts/guide-factory/src/paths.ts",
    ...DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS,
  ]),
].sort(compareText);

export const DIONA_SOURCE_LOCAL_SUPPORT_SLICE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "diona-source-local-support-slice.json",
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
  generatorExecuted: false,
  optimizerExecuted: false,
  artifactAssignmentExecuted: false,
  teamCompositionExecuted: false,
  buildCompositionExecuted: false,
  damageComputationExecuted: false,
  rotationComputationExecuted: false,
  energyRecoveryComputationExecuted: false,
} as const;

export function buildDionaSourceLocalSupportSliceReport(
  input: BuildDionaSourceLocalSupportSliceInput,
): DionaSourceLocalSupportSliceReport {
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
    authenticateSourceDocument(
      snapshot,
      index,
      registry,
      repository,
      sourceRegistrySha256,
    );

    const coverageCore = buildManualConditionArrayCoverageCore({
      manualIndexInput: {
        schemaVersion: 1,
        snapshots: [{ sourceId: "kqm", path: DIONA_SNAPSHOT_RELATIVE_PATH }],
      },
      manualSnapshotInputs: [
        {
          path: DIONA_SNAPSHOT_RELATIVE_PATH,
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
      coverageCore.repositoryParity.rows.length !== 26 ||
      coverageCore.repositoryParity.rows.some(
        ({ status, repositoryJsonPath }) =>
          status !== "exact" || repositoryJsonPath == null,
      ) ||
      allOccurrences.length !== 26 ||
      nonemptyOccurrences.length !== 18 ||
      emptyOccurrences.length !== 8
    ) {
      throw new Error(
        "The exact Diona condition corpus is no longer 26 parity-exact arrays split into 18 nonempty and eight empty occurrences.",
      );
    }

    const parityByOccurrenceId = new Map(
      coverageCore.repositoryParity.rows.map((row) => [row.occurrenceId, row]),
    );
    const occurrenceById = new Map(
      nonemptyOccurrences.map((occurrence) => {
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

    const selectedOccurrences: DionaSourceLocalSelectedOccurrence[] = [];
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
      selectedOccurrences.push({
        occurrenceId: occurrence.occurrenceId,
        characterId: definition.characterId,
        memberIndex: definition.memberIndex,
        sourceRecordId: occurrence.sourceRecordId,
        repositoryRecordId: occurrence.repositoryRecordId,
        manualClaimPath: occurrence.manualClaimPath,
        repositoryPath: occurrence.repositoryPath,
        claimAxis: occurrence.claimAxis,
        conditions: [...occurrence.conditions],
        conditionsSha256: occurrence.conditionsSha256,
        payload,
        payloadSha256,
        predicate: structuredClone(definition.predicate),
        predicateSha256,
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
          claimAxis: "artifact-recommendation",
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
            sourcePredicateLeafSha256: predicateSha256,
            requestPredicate: {
              type: "intended-role-is",
              characterId: definition.characterId,
              roleId: "support",
            },
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
        descriptiveInventory: definition.descriptiveInventory,
        repositoryParity: "exact" as const,
        sliceDisposition: "holdout" as const,
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
        `The canonical Diona support slice is not comparable: ${sourceLocalSlice.issues
          .map(({ code }) => code)
          .join(", ")}.`,
      );
    }
    authenticateExpectedSliceSemantics(sourceLocalSlice);

    const ordinaryHoldoutInventoryCount = holdoutOccurrences.filter(
      ({ descriptiveInventory }) => descriptiveInventory === "ordinary-holdout",
    ).length;
    const erDeferredHoldoutInventoryCount = holdoutOccurrences.filter(
      ({ descriptiveInventory }) =>
        descriptiveInventory === "er-deferred-holdout",
    ).length;
    if (
      ordinaryHoldoutInventoryCount !== 10 ||
      erDeferredHoldoutInventoryCount !== 5
    ) {
      throw new Error("Diona descriptive holdout inventory counts drifted.");
    }

    return {
      schemaVersion: 1,
      reportType: "diona-source-local-support-slice",
      sliceId: DIONA_SLICE_ID,
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
          DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS.length,
        canonicalObjectSha256ByPath,
      },
      sourceBoundary: {
        status: "accepted",
        sourceId: "kqm",
        pageUrl: DIONA_PAGE_URL,
        sourceVersion: DIONA_SOURCE_VERSION,
        snapshotPath: DIONA_SNAPSHOT_RELATIVE_PATH,
        rawRecordCount: snapshot.records.length,
        rawRecordIds: snapshot.records
          .map(({ sourceRecordId }) => sourceRecordId)
          .sort(compareText),
        totalConditionArrayCount: allOccurrences.length,
        nonemptyConditionArrayCount: nonemptyOccurrences.length,
        emptyConditionArrayCount: emptyOccurrences.length,
        selectedOccurrenceCount: selectedOccurrences.length,
        holdoutOccurrenceCount: holdoutOccurrences.length,
        ordinaryHoldoutInventoryCount,
        erDeferredHoldoutInventoryCount,
        selectedAndHoldoutsCloseAllNonemptyDionaConditions: true,
        repositoryParity: coverageCore.repositoryParity.status,
        samePageLineage: true,
        selectedClaimsAndTeamShareExactSourceRecord: true,
        extractionMethod: "agent-assisted",
        reviewStatus: "unreviewed",
        sourceRegistryStatus: "active",
        sourceRegistryIngestionMode: "manual-observation",
        sourceRegistryPermission: "unknown",
        promotionEligible: false,
      },
      selectedOccurrences,
      holdoutOccurrences,
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

export function authenticateDionaSourceLocalSupportSliceReport(
  serializedReport: DionaSourceLocalSupportSliceReport,
  input: BuildDionaSourceLocalSupportSliceInput,
): DionaSourceLocalSupportSliceAuthentication {
  const canonicalReport = buildDionaSourceLocalSupportSliceReport(input);
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
          code: "diona-source-local.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Diona source-local report does not match a fresh canonical rebuild from current exact inputs.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableDionaSourceLocalSupportSliceReport(
  report: DionaSourceLocalSupportSliceReport,
  input: BuildDionaSourceLocalSupportSliceInput,
): void {
  const authentication = authenticateDionaSourceLocalSupportSliceReport(
    report,
    input,
  );
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Diona source-local report (${authentication.reason}): ${authentication.issues
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
    sliceId: DIONA_SLICE_ID,
    generatedFrom,
    sourceBoundary: {
      sourceId: "kqm",
      pageUrl: DIONA_PAGE_URL,
      sourceVersion: DIONA_SOURCE_VERSION,
      snapshotPath: DIONA_SNAPSHOT_RELATIVE_PATH,
      rawManualSourceRecordIds: [TEAM_DEFINITION.sourceRecordId],
      consolidatedGuideRecordIds: [TEAM_DEFINITION.repositoryRecordId],
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
            diona: { intendedRole: "support" },
            citlali: { intendedRole: "support" },
            bennett: { intendedRole: "support" },
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
  occurrence: DionaConditionOccurrence,
  definition: SelectedOccurrenceDefinition,
  payload: SourceConditionedClaimPayload,
  catalogIndex: number,
): SourceConditionedAtomicClaim {
  const record = requiredRepositoryTeam(
    repository,
    TEAM_DEFINITION.repositoryRecordId,
  );
  const member = record.members[definition.memberIndex];
  const sourceItem = sourceItemForOccurrence(
    repository,
    occurrence,
    "repository",
  );
  if (
    !member ||
    member.characterId !== definition.characterId ||
    member.artifactOrdering !== "unranked" ||
    member.artifactRecommendations?.length !== 1
  ) {
    throw new Error(
      `Exact selected team-member recommendation lineage drifted for ${occurrence.occurrenceId}.`,
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
      recommendationId: `${record.id}:members[${definition.memberIndex}].artifactRecommendations`,
      label: null,
      scope: "team-member-artifact-sets",
      roles: [],
      ordering: member.artifactOrdering,
      classification: readRecommendationClassification(sourceItem),
      grouping: readNullableString(sourceItem, "grouping") as
        "single" | "alternatives" | "tied" | null,
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
    manualRecord.members[0]?.characterId === "diona" &&
    manualRecord.members[0].constellation === 6 &&
    manualRecord.members
      .slice(1)
      .every(
        (member) =>
          member.constellation == null &&
          member.minConstellation == null &&
          member.maxConstellation == null,
      );
  const exactRepositoryInvestment =
    stableJson(repositoryRecord.members[0]?.investment) ===
      stableJson({ constellation: 6, status: "partial" }) &&
    repositoryRecord.members
      .slice(1)
      .every(
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
    locatorUrl(manualRecord.locator) !== DIONA_PAGE_URL ||
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
      snapshotPath: DIONA_SNAPSHOT_RELATIVE_PATH,
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
): void {
  const expectedIds = [...EXPECTED_RAW_RECORD_IDS].sort(compareText);
  const actualIds = snapshot.records
    .map(({ sourceRecordId }) => sourceRecordId)
    .sort(compareText);
  const indexMatches = index.snapshots.filter(
    ({ sourceId, path: snapshotPath }) =>
      sourceId === "kqm" && snapshotPath === DIONA_SNAPSHOT_RELATIVE_PATH,
  );
  const matchingSources = registry.sources.filter(({ id }) => id === "kqm");
  const source = matchingSources[0];
  if (
    snapshot.sourceId !== "kqm" ||
    snapshot.page.url !== DIONA_PAGE_URL ||
    snapshot.page.sourceVersion !== DIONA_SOURCE_VERSION ||
    snapshot.page.title !== "Diona Quick Guide" ||
    stableJson(actualIds) !== stableJson(expectedIds) ||
    snapshot.records.some(
      ({ locator, extraction }) =>
        locatorUrl(locator) !== DIONA_PAGE_URL ||
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
    sourceRegistrySha256 == null ||
    repository.sourceRegistrySha256 !== sourceRegistrySha256
  ) {
    throw new Error(
      "Diona source-document, index, or registry boundary drifted.",
    );
  }
}

function authenticateSelectedDefinitionAndPayload(
  definition: SelectedOccurrenceDefinition,
  occurrence: DionaConditionOccurrence,
  snapshot: ManualObservationSnapshot,
  repository: KnowledgeRepository,
): void {
  const occurrencePrefix = `kqm:team:${TEAM_DEFINITION.sourceRecordId}:`;
  const expectedManualClaimPath = definition.occurrenceId.startsWith(
    occurrencePrefix,
  )
    ? definition.occurrenceId.slice(occurrencePrefix.length)
    : "";
  const expectedPath = `members[${definition.memberIndex}].artifactRecommendations[0].conditions`;
  if (
    expectedManualClaimPath !== expectedPath ||
    occurrence.conditionsSha256 !== definition.conditionsSha256 ||
    occurrence.manualClaimPath !== expectedPath ||
    occurrence.repositoryPath !== expectedPath ||
    occurrence.sourceId !== "kqm" ||
    occurrence.sourceRecordId !== TEAM_DEFINITION.sourceRecordId ||
    occurrence.repositoryRecordId !== TEAM_DEFINITION.repositoryRecordId ||
    occurrence.subject !== definition.characterId ||
    occurrence.claimAxis !== "artifact-recommendation" ||
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
      record.kind === "team" &&
      record.sourceRecordId === TEAM_DEFINITION.sourceRecordId,
  );
  const repositoryRecord = requiredRepositoryTeam(
    repository,
    TEAM_DEFINITION.repositoryRecordId,
  );
  const manualMember =
    manualRecord?.kind === "team"
      ? manualRecord.members[definition.memberIndex]
      : undefined;
  const repositoryMember = repositoryRecord.members[definition.memberIndex];
  if (
    !manualRecord ||
    manualRecord.kind !== "team" ||
    manualMember?.characterId !== definition.characterId ||
    manualMember.artifactOrdering !== "unranked" ||
    manualMember.artifactRecommendations.length !== 1 ||
    repositoryMember?.characterId !== definition.characterId ||
    repositoryMember.artifactOrdering !== "unranked" ||
    repositoryMember.artifactRecommendations?.length !== 1 ||
    stableJson(manualMember.artifactRecommendations[0]) !==
      stableJson(definition.exactSourceItem) ||
    stableJson(repositoryMember.artifactRecommendations[0]) !==
      stableJson(definition.exactSourceItem)
  ) {
    throw new Error(
      `Exact selected team-member recommendation lineage drifted for ${occurrence.occurrenceId}.`,
    );
  }
}

function authenticateHoldoutDefinition(
  definition: HoldoutOccurrenceDefinition,
  occurrence: DionaConditionOccurrence,
): void {
  if (
    occurrence.occurrenceId !== definition.occurrenceId ||
    occurrence.conditionsSha256 !== definition.conditionsSha256 ||
    occurrence.conditions.length === 0 ||
    occurrence.sourceId !== "kqm" ||
    occurrence.subject !== definition.expectedSubject ||
    occurrence.structuralEnergyDimension !==
      definition.expectedStructuralEnergyDimension
  ) {
    throw new Error(
      `Exact descriptive holdout boundary drifted for ${definition.occurrenceId}.`,
    );
  }
}

function authenticateExactOccurrencePartition(
  occurrenceById: ReadonlyMap<string, DionaConditionOccurrence>,
  selectedIds: ReadonlySet<string>,
  holdoutIds: ReadonlySet<string>,
): void {
  if (selectedIds.size !== 3 || holdoutIds.size !== 15) {
    throw new Error("Diona selected/holdout occurrence counts drifted.");
  }
  if ([...selectedIds].some((occurrenceId) => holdoutIds.has(occurrenceId))) {
    throw new Error("Diona selected and holdout occurrence sets overlap.");
  }
  const union = [...selectedIds, ...holdoutIds].sort(compareText);
  const current = [...occurrenceById.keys()].sort(compareText);
  if (stableJson(union) !== stableJson(current)) {
    throw new Error(
      "Diona selected and holdout occurrence sets do not close the exact 18-array nonempty condition corpus.",
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
      "Diona source-local support slice crossed its expected semantic boundary.",
    );
  }
}

function authenticateGeneratedFrom(
  input: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  const expectedPaths = [...DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS];
  const canonical = [...input]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    stableJson(canonical.map(({ path: entryPath }) => entryPath)) !==
    stableJson(expectedPaths)
  ) {
    throw new Error("Diona source-local generatedFrom path closure drifted.");
  }
  if (
    canonical.some(({ sha256 }) => !/^[a-f0-9]{64}$/.test(sha256)) ||
    new Set(canonical.map(({ path: entryPath }) => entryPath)).size !==
      canonical.length
  ) {
    throw new Error(
      "Diona source-local generatedFrom hashes or paths are invalid.",
    );
  }
  return canonical;
}

function authenticateRawInputs(
  input: BuildDionaSourceLocalSupportSliceInput,
  generatedFrom: readonly GeneratedFromEntry[],
): Record<string, string> {
  const files = [...input.sourceFiles].sort((left, right) =>
    compareText(left.path, right.path),
  );
  const expectedPaths = [
    ...DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS,
  ].sort(compareText);
  if (
    stableJson(files.map(({ path: filePath }) => filePath)) !==
    stableJson(expectedPaths)
  ) {
    throw new Error("Diona raw source-file path closure drifted.");
  }
  const valuesByPath = new Map<string, unknown>([
    [REPOSITORY_RELATIVE_PATH, input.repositoryInput],
    [DIONA_SNAPSHOT_RELATIVE_PATH, input.manualSnapshotInput],
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
    DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS,
  );
  return generatedFrom
    .filter(({ path: entryPath }) => sourcePaths.has(entryPath))
    .map((entry) => ({ ...entry }));
}

function payloadForOccurrence(
  root: KnowledgeRepository | ManualObservationSnapshot,
  occurrence: DionaConditionOccurrence,
  kind: "manual" | "repository",
): SourceConditionedClaimPayload {
  const item = sourceItemForOccurrence(root, occurrence, kind);
  if (occurrence.claimAxis === "artifact-recommendation") {
    const artifacts = item.artifacts;
    if (!Array.isArray(artifacts)) {
      throw new Error(
        `Missing artifact payload for ${occurrence.occurrenceId}.`,
      );
    }
    return {
      type: "artifact-group",
      artifacts: structuredClone(artifacts) as ArtifactChoice[],
    };
  }
  throw new Error(
    `Unsupported Diona source-local claim axis ${occurrence.claimAxis}.`,
  );
}

function sourceItemForOccurrence(
  root: KnowledgeRepository | ManualObservationSnapshot,
  occurrence: DionaConditionOccurrence,
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
  byId: ReadonlyMap<string, DionaConditionOccurrence>,
  occurrenceId: string,
): DionaConditionOccurrence {
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
    throw new Error(`Missing exact Diona team record ${recordId}.`);
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

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(`Expected string ${key}.`);
  return value;
}

function readRecommendationClassification(
  record: Record<string, unknown>,
):
  | "default"
  | "recommended"
  | "alternative"
  | "conditional"
  | "available-only"
  | null {
  const value = readNullableString(record, "classification");
  if (
    value == null ||
    value === "default" ||
    value === "recommended" ||
    value === "alternative" ||
    value === "conditional" ||
    value === "available-only"
  ) {
    return value;
  }
  throw new Error(`Unsupported recommendation classification ${value}.`);
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
  holdouts: readonly DionaSourceLocalHoldoutOccurrence[],
): DionaSourceLocalSupportSliceReport["summary"] {
  const ordinaryHoldoutInventoryCount = holdouts.filter(
    ({ descriptiveInventory }) => descriptiveInventory === "ordinary-holdout",
  ).length;
  const erDeferredHoldoutInventoryCount = holdouts.filter(
    ({ descriptiveInventory }) =>
      descriptiveInventory === "er-deferred-holdout",
  ).length;
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
    ordinaryHoldoutInventoryCount,
    erDeferredHoldoutInventoryCount,
    holdoutConsumedCount: 0,
    holdoutBindingAuthoredCount: 0,
    holdoutEnergyClassificationAuthoredCount: 0,
    assembledBuildCount: 0,
  };
}

function failedReport(
  generatedFrom: readonly GeneratedFromEntry[],
  message: string,
): DionaSourceLocalSupportSliceReport {
  return {
    schemaVersion: 1,
    reportType: "diona-source-local-support-slice",
    sliceId: DIONA_SLICE_ID,
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
      pageUrl: DIONA_PAGE_URL,
      sourceVersion: DIONA_SOURCE_VERSION,
      snapshotPath: DIONA_SNAPSHOT_RELATIVE_PATH,
      rawRecordCount: 0,
      rawRecordIds: [],
      totalConditionArrayCount: 0,
      nonemptyConditionArrayCount: 0,
      emptyConditionArrayCount: 0,
      selectedOccurrenceCount: 0,
      holdoutOccurrenceCount: 0,
      ordinaryHoldoutInventoryCount: 0,
      erDeferredHoldoutInventoryCount: 0,
      selectedAndHoldoutsCloseAllNonemptyDionaConditions: false,
      repositoryParity: "not-evaluated",
      samePageLineage: false,
      selectedClaimsAndTeamShareExactSourceRecord: false,
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryIngestionMode: "manual-observation",
      sourceRegistryPermission: "unknown",
      promotionEligible: false,
    },
    selectedOccurrences: [],
    holdoutOccurrences: [],
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
      ordinaryHoldoutInventoryCount: 0,
      erDeferredHoldoutInventoryCount: 0,
      holdoutConsumedCount: 0,
      holdoutBindingAuthoredCount: 0,
      holdoutEnergyClassificationAuthoredCount: 0,
      assembledBuildCount: 0,
    },
    issues: [
      {
        code: "diona-source-local.canonical-input-preparation-failed",
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
