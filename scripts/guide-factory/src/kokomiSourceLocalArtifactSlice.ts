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
const KOKOMI_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-kokomi-manual.json";
const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_INDEX_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const KOKOMI_PAGE_URL = "https://keqingmains.com/q/kokomi-quickguide/";
const KOKOMI_SOURCE_VERSION = "Luna V";
const KOKOMI_SLICE_ID = "kqm-kokomi-source-local-artifact-slice-luna-v";
const EXPECTED_KOKOMI_SNAPSHOT_SHA256 =
  "cf2acb8697a87480e388932032626be857b9ed5e8edfbe4b8cd8aa93bd03ab71";
const TEAM_DEFINITION = {
  repositoryRecordId:
    "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example",
  sourceRecordId: "kokomi-ineffa-columbina-sucrose-lunar-charged-example",
  memberCharacterIds: [
    "sangonomiya_kokomi",
    "ineffa",
    "columbina",
    "sucrose",
  ],
} as const;

const EXACT_TEAM_ROSTER_PREDICATE = {
  type: "all",
  predicates: TEAM_DEFINITION.memberCharacterIds.map((characterId) => ({
    type: "exact-team-roster-includes" as const,
    characterId,
  })),
} as const satisfies SourceConditionPredicateAst;

const EXPECTED_PREDICATE_SHA256 =
  "2c60322cf3d1b6691dbde84bd5484364752c87bb18634bd9303fd6ec2e03dcda";
const EXPECTED_PAYLOAD_SHA256 =
  "bfd412bb94e8e50e9deec6813ef5329eb71c656fdd1af64fc8b5a2243543e1a0";

type ExactSourceItem = Record<string, unknown>;

type KokomiConditionOccurrence = ManualConditionArrayOccurrence & {
  repositoryJsonPath: string;
};

type SelectedOccurrenceDefinition = {
  occurrenceId: string;
  characterId: "sangonomiya_kokomi";
  memberIndex: 0;
  conditionsSha256: string;
  exactSourceItem: ExactSourceItem;
  predicate: SourceConditionPredicateAst;
};

type HoldoutOccurrenceDefinition = {
  occurrenceId: string;
  conditionsSha256: string;
};

const SELECTED_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations[0].conditions",
    characterId: "sangonomiya_kokomi",
    memberIndex: 0,
    conditionsSha256:
      "a9c6d3b2681ecb2119368d210164542577464049656217eb1fcc296ff4fd2295",
    exactSourceItem: {
      artifacts: [{ type: "4pc", setId: "oceanhued_clam" }],
      grouping: "single",
      classification: "recommended",
      conditions: ["For Kokomi in this exact Lunar-Charged example team."],
    },
    predicate: EXACT_TEAM_ROSTER_PREDICATE,
  },
] as const satisfies readonly SelectedOccurrenceDefinition[];

const HOLDOUT_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:character_guide:kokomi-on-field-nod-krai-artifact-delegation-luna-v:recommendation.artifactRecommendations[0].conditions",
    conditionsSha256:
      "a2933a2e2f7adf74da82241024b08ef3cc933e97875a60ed24a995e23dff7300",
  },
  {
    occurrenceId:
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:artifactPlans[0].conditions",
    conditionsSha256:
      "2e7b7109ed56cdbdbe8106429ff4a37bf8a76c4af7a6a96c1f71f123fbc19320",
  },
  {
    occurrenceId:
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations[1].conditions",
    conditionsSha256:
      "345334cc6648346f0746fcee75a300703ef38cbbf2c290e80d9e0bb3ddbf12e9",
  },
  {
    occurrenceId:
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[2].artifactRecommendations[0].conditions",
    conditionsSha256:
      "2b615a74c769bcf02abb64b35d64bf8baf94eefb23f5f9a6e3044b540184d50f",
  },
] as const satisfies readonly HoldoutOccurrenceDefinition[];

const EXPECTED_RAW_RECORD_IDS = [
  "kokomi-ineffa-columbina-sucrose-lunar-charged-example",
  "kokomi-on-field-nod-krai-artifact-delegation-luna-v",
] as const;
const CAUTIONS = [
  "The selected occurrence remains an agent-assisted and unreviewed source observation.",
  "Matched means only that the exact source roster contains every character named by the pinned conjunction.",
  "The generic claim adapter's recommendationId and scope are structural locators for the exact team-member array, not source-authored recommendation labels.",
  "The four nonempty holdouts are descriptive inventory only; this slice consumes, binds, or classifies none of them.",
  "Not-energy-deferred is occurrence-scoped only to the selected artifact condition and does not provide an ER requirement or prove ER adequacy.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not interpret this slice as a Kokomi guide, artifact assignment, build, team recommendation, or ranking.",
  "Do not interpret the preserved 4pc Ocean-Hued Clam payload as an artifact assignment or a comparison against the four holdouts.",
  "Do not infer a typed predicate, request binding, or new energy classification for any of the four holdouts.",
  "Do not combine the selected payload with any holdout into a coherent or compatible team build.",
  "Do not use this report as a generator, optimizer, formula, rotation, damage, DPS, ideal-roll, or ER result.",
] as const;
export interface KokomiSourceLocalArtifactSliceSourceFile {
  path: string;
  text: string;
}

export interface BuildKokomiSourceLocalArtifactSliceInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  sourceFiles: readonly KokomiSourceLocalArtifactSliceSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface KokomiSourceLocalHoldoutOccurrence {
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

export interface KokomiSourceLocalSelectedOccurrence {
  occurrenceId: string;
  characterId: "sangonomiya_kokomi";
  memberIndex: 0;
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

export interface KokomiSourceLocalArtifactSliceReport {
  schemaVersion: 1;
  reportType: "kokomi-source-local-artifact-slice";
  sliceId: typeof KOKOMI_SLICE_ID;
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
    pageUrl: typeof KOKOMI_PAGE_URL;
    sourceVersion: typeof KOKOMI_SOURCE_VERSION;
    snapshotPath: typeof KOKOMI_SNAPSHOT_RELATIVE_PATH;
    rawRecordCount: number;
    rawRecordIds: string[];
    totalConditionArrayCount: number;
    nonemptyConditionArrayCount: number;
    emptyConditionArrayCount: number;
    selectedOccurrenceCount: number;
    holdoutOccurrenceCount: number;
    selectedAndHoldoutsCloseAllNonemptyKokomiConditions: boolean;
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
  selectedOccurrences: KokomiSourceLocalSelectedOccurrence[];
  holdoutOccurrences: KokomiSourceLocalHoldoutOccurrence[];
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
    assembledBuildCount: 0;
  };
  issues: SourceConditionedGuidePacketIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type KokomiSourceLocalArtifactSliceAuthentication =
  | {
      authenticated: true;
      canonicalReport: KokomiSourceLocalArtifactSliceReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: SourceConditionedGuidePacketIssue[];
    };

export const KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS = [
  REPOSITORY_RELATIVE_PATH,
  MANUAL_INDEX_RELATIVE_PATH,
  SOURCE_REGISTRY_RELATIVE_PATH,
  KOKOMI_SNAPSHOT_RELATIVE_PATH,
] as const;

export const KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS = [
  ...new Set([
    "scripts/guide-factory/src/kokomiSourceLocalArtifactSlice.ts",
    "scripts/guide-factory/src/assemble-kokomi-source-local-artifact-slice.ts",
    "scripts/guide-factory/src/sourceLocalConditionSlice.ts",
    "scripts/guide-factory/src/sourceConditionedGuidePacket.ts",
    "scripts/guide-factory/src/guideRequestContext.ts",
    "scripts/guide-factory/src/manualConditionArrayCoverage.ts",
    "scripts/guide-factory/src/schemas.ts",
    "scripts/guide-factory/src/io.ts",
    "scripts/guide-factory/src/paths.ts",
    ...KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS,
  ]),
].sort(compareText);

export const KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "kokomi-source-local-artifact-slice.json",
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

export function buildKokomiSourceLocalArtifactSliceReport(
  input: BuildKokomiSourceLocalArtifactSliceInput,
): KokomiSourceLocalArtifactSliceReport {
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
      ({ path: entryPath }) => entryPath === KOKOMI_SNAPSHOT_RELATIVE_PATH,
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
        snapshots: [{ sourceId: "kqm", path: KOKOMI_SNAPSHOT_RELATIVE_PATH }],
      },
      manualSnapshotInputs: [
        {
          path: KOKOMI_SNAPSHOT_RELATIVE_PATH,
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
      coverageCore.repositoryParity.rows.length !== 5 ||
      coverageCore.repositoryParity.rows.some(
        ({ status, repositoryJsonPath }) =>
          status !== "exact" || repositoryJsonPath == null,
      ) ||
      allOccurrences.length !== 5 ||
      nonemptyOccurrences.length !== 5 ||
      emptyOccurrences.length !== 0
    ) {
      throw new Error(
        "The exact Kokomi condition corpus is no longer five parity-exact nonempty arrays with no empty occurrences.",
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

    const selectedOccurrences: KokomiSourceLocalSelectedOccurrence[] = [];
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
      if (
        predicateSha256 !== EXPECTED_PREDICATE_SHA256 ||
        payloadSha256 !== EXPECTED_PAYLOAD_SHA256
      ) {
        throw new Error(
          `Exact Kokomi predicate or payload hash drifted for ${occurrence.occurrenceId}.`,
        );
      }
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
        requestBindings: [],
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
        `The canonical Kokomi artifact slice is not comparable: ${sourceLocalSlice.issues
          .map(({ code }) => code)
          .join(", ")}.`,
      );
    }
    authenticateExpectedSliceSemantics(sourceLocalSlice);

    return {
      schemaVersion: 1,
      reportType: "kokomi-source-local-artifact-slice",
      sliceId: KOKOMI_SLICE_ID,
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
          KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS.length,
        canonicalObjectSha256ByPath,
      },
      sourceBoundary: {
        status: "accepted",
        sourceId: "kqm",
        pageUrl: KOKOMI_PAGE_URL,
        sourceVersion: KOKOMI_SOURCE_VERSION,
        snapshotPath: KOKOMI_SNAPSHOT_RELATIVE_PATH,
        rawRecordCount: snapshot.records.length,
        rawRecordIds: snapshot.records
          .map(({ sourceRecordId }) => sourceRecordId)
          .sort(compareText),
        totalConditionArrayCount: allOccurrences.length,
        nonemptyConditionArrayCount: nonemptyOccurrences.length,
        emptyConditionArrayCount: emptyOccurrences.length,
        selectedOccurrenceCount: selectedOccurrences.length,
        holdoutOccurrenceCount: holdoutOccurrences.length,
        selectedAndHoldoutsCloseAllNonemptyKokomiConditions: true,
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

export function authenticateKokomiSourceLocalArtifactSliceReport(
  serializedReport: KokomiSourceLocalArtifactSliceReport,
  input: BuildKokomiSourceLocalArtifactSliceInput,
): KokomiSourceLocalArtifactSliceAuthentication {
  const canonicalReport = buildKokomiSourceLocalArtifactSliceReport(input);
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
          code: "kokomi-source-local.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Kokomi source-local report does not match a fresh canonical rebuild from current exact inputs.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableKokomiSourceLocalArtifactSliceReport(
  report: KokomiSourceLocalArtifactSliceReport,
  input: BuildKokomiSourceLocalArtifactSliceInput,
): void {
  const authentication = authenticateKokomiSourceLocalArtifactSliceReport(
    report,
    input,
  );
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Kokomi source-local report (${authentication.reason}): ${authentication.issues
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
    sliceId: KOKOMI_SLICE_ID,
    generatedFrom,
    sourceBoundary: {
      sourceId: "kqm",
      pageUrl: KOKOMI_PAGE_URL,
      sourceVersion: KOKOMI_SOURCE_VERSION,
      snapshotPath: KOKOMI_SNAPSHOT_RELATIVE_PATH,
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
    expectedCounts: {
      claimCount: 1,
      teamCount: 1,
      cellCount: 1,
      sourceResolution: { matched: 1, inapplicable: 0, unresolved: 0 },
      effectiveResolution: { matched: 1, inapplicable: 0, unresolved: 0 },
      contextApplicability: {
        sourceAlreadyMatched: 1,
        sourceDefinitelyInapplicable: 0,
        applicableUnderSuppliedContext: 0,
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
  occurrence: KokomiConditionOccurrence,
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
    member.artifactRecommendations?.length !== 2
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
    locatorUrl(manualRecord.locator) !== KOKOMI_PAGE_URL ||
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
      snapshotPath: KOKOMI_SNAPSHOT_RELATIVE_PATH,
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
      sourceId === "kqm" && snapshotPath === KOKOMI_SNAPSHOT_RELATIVE_PATH,
  );
  const matchingSources = registry.sources.filter(({ id }) => id === "kqm");
  const source = matchingSources[0];
  if (
    snapshot.sourceId !== "kqm" ||
    snapshot.page.url !== KOKOMI_PAGE_URL ||
    snapshot.page.sourceVersion !== KOKOMI_SOURCE_VERSION ||
    snapshot.page.title !== "Kokomi Quick Guide" ||
    stableJson(actualIds) !== stableJson(expectedIds) ||
    snapshot.records.some(
      ({ locator, extraction }) =>
        locatorUrl(locator) !== KOKOMI_PAGE_URL ||
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
    snapshotSha256 !== EXPECTED_KOKOMI_SNAPSHOT_SHA256 ||
    sourceRegistrySha256 == null ||
    repository.sourceRegistrySha256 !== sourceRegistrySha256
  ) {
    throw new Error(
      "Kokomi source-document, index, or registry boundary drifted.",
    );
  }
}

function authenticateSelectedDefinitionAndPayload(
  definition: SelectedOccurrenceDefinition,
  occurrence: KokomiConditionOccurrence,
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
    manualMember.artifactRecommendations.length !== 2 ||
    repositoryMember?.characterId !== definition.characterId ||
    repositoryMember.artifactOrdering !== "unranked" ||
    repositoryMember.artifactRecommendations?.length !== 2 ||
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
  occurrence: KokomiConditionOccurrence,
): void {
  if (
    occurrence.occurrenceId !== definition.occurrenceId ||
    occurrence.conditionsSha256 !== definition.conditionsSha256 ||
    occurrence.conditions.length === 0 ||
    occurrence.sourceId !== "kqm"
  ) {
    throw new Error(
      `Exact descriptive holdout boundary drifted for ${definition.occurrenceId}.`,
    );
  }
}

function authenticateExactOccurrencePartition(
  occurrenceById: ReadonlyMap<string, KokomiConditionOccurrence>,
  selectedIds: ReadonlySet<string>,
  holdoutIds: ReadonlySet<string>,
): void {
  if (selectedIds.size !== 1 || holdoutIds.size !== 4) {
    throw new Error("Kokomi selected/holdout occurrence counts drifted.");
  }
  if ([...selectedIds].some((occurrenceId) => holdoutIds.has(occurrenceId))) {
    throw new Error("Kokomi selected and holdout occurrence sets overlap.");
  }
  const union = [...selectedIds, ...holdoutIds].sort(compareText);
  const current = [...occurrenceById.keys()].sort(compareText);
  if (stableJson(union) !== stableJson(current)) {
    throw new Error(
      "Kokomi selected and holdout occurrence sets do not close the exact five-array nonempty condition corpus.",
    );
  }
}

function authenticateExpectedSliceSemantics(
  report: SourceLocalConditionSliceReport,
): void {
  const safe =
    report.summary.claimCount === 1 &&
    report.summary.teamCount === 1 &&
    report.summary.cellCount === 1 &&
    report.summary.sourceMatchedCount === 1 &&
    report.summary.sourceInapplicableCount === 0 &&
    report.summary.sourceUnresolvedCount === 0 &&
    report.summary.effectiveMatchedCount === 1 &&
    report.summary.effectiveInapplicableCount === 0 &&
    report.summary.effectiveUnresolvedCount === 0 &&
    report.summary.applicableUnderSuppliedContextCount === 0 &&
    report.summary.sourceAlreadyMatchedCount === 1 &&
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
      "Kokomi source-local artifact slice crossed its expected semantic boundary.",
    );
  }
}

function authenticateGeneratedFrom(
  input: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  const expectedPaths = [...KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS];
  const canonical = [...input]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    stableJson(canonical.map(({ path: entryPath }) => entryPath)) !==
    stableJson(expectedPaths)
  ) {
    throw new Error("Kokomi source-local generatedFrom path closure drifted.");
  }
  if (
    canonical.some(({ sha256 }) => !/^[a-f0-9]{64}$/.test(sha256)) ||
    new Set(canonical.map(({ path: entryPath }) => entryPath)).size !==
      canonical.length
  ) {
    throw new Error(
      "Kokomi source-local generatedFrom hashes or paths are invalid.",
    );
  }
  return canonical;
}

function authenticateRawInputs(
  input: BuildKokomiSourceLocalArtifactSliceInput,
  generatedFrom: readonly GeneratedFromEntry[],
): Record<string, string> {
  const files = [...input.sourceFiles].sort((left, right) =>
    compareText(left.path, right.path),
  );
  const expectedPaths = [
    ...KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS,
  ].sort(compareText);
  if (
    stableJson(files.map(({ path: filePath }) => filePath)) !==
    stableJson(expectedPaths)
  ) {
    throw new Error("Kokomi raw source-file path closure drifted.");
  }
  const valuesByPath = new Map<string, unknown>([
    [REPOSITORY_RELATIVE_PATH, input.repositoryInput],
    [KOKOMI_SNAPSHOT_RELATIVE_PATH, input.manualSnapshotInput],
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
    KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS,
  );
  return generatedFrom
    .filter(({ path: entryPath }) => sourcePaths.has(entryPath))
    .map((entry) => ({ ...entry }));
}

function payloadForOccurrence(
  root: KnowledgeRepository | ManualObservationSnapshot,
  occurrence: KokomiConditionOccurrence,
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
    `Unsupported Kokomi source-local claim axis ${occurrence.claimAxis}.`,
  );
}

function sourceItemForOccurrence(
  root: KnowledgeRepository | ManualObservationSnapshot,
  occurrence: KokomiConditionOccurrence,
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
  byId: ReadonlyMap<string, KokomiConditionOccurrence>,
  occurrenceId: string,
): KokomiConditionOccurrence {
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
    throw new Error(`Missing exact Kokomi team record ${recordId}.`);
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
  holdouts: readonly KokomiSourceLocalHoldoutOccurrence[],
): KokomiSourceLocalArtifactSliceReport["summary"] {
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
    assembledBuildCount: 0,
  };
}

function failedReport(
  generatedFrom: readonly GeneratedFromEntry[],
  message: string,
): KokomiSourceLocalArtifactSliceReport {
  return {
    schemaVersion: 1,
    reportType: "kokomi-source-local-artifact-slice",
    sliceId: KOKOMI_SLICE_ID,
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
      pageUrl: KOKOMI_PAGE_URL,
      sourceVersion: KOKOMI_SOURCE_VERSION,
      snapshotPath: KOKOMI_SNAPSHOT_RELATIVE_PATH,
      rawRecordCount: 0,
      rawRecordIds: [],
      totalConditionArrayCount: 0,
      nonemptyConditionArrayCount: 0,
      emptyConditionArrayCount: 0,
      selectedOccurrenceCount: 0,
      holdoutOccurrenceCount: 0,
      selectedAndHoldoutsCloseAllNonemptyKokomiConditions: false,
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
      holdoutConsumedCount: 0,
      holdoutBindingAuthoredCount: 0,
      holdoutEnergyClassificationAuthoredCount: 0,
      assembledBuildCount: 0,
    },
    issues: [
      {
        code: "kokomi-source-local.canonical-input-preparation-failed",
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
