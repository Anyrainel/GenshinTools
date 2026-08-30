import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Text, stableJson } from "./io";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
} from "./schemas";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";
import {
  authenticateXiaoSourceLocalConditionSliceReport,
  XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
  type BuildXiaoSourceLocalConditionSliceInput,
  type XiaoSourceLocalConditionSliceReport,
  type XiaoSourceLocalSelectedOccurrence,
} from "./xiaoSourceLocalConditionSlice";

const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const XIAO_MANUAL_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const XIAO_DURABLE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-source-local-condition-slice.json";

const CONTRACT_ID =
  "kqm-xiao-ffxx-applicable-claim-projection-version-5-5";
const XIAO_SLICE_ID =
  "kqm-xiao-ffxx-roster-and-c6-source-local-condition-slice-version-5-5";
const FFXX_TEAM_ID =
  "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5";
const MARECHAUSSEE_OCCURRENCE_ID =
  "kqm:character_guide:xiao-mh-artifact-branch-version-5-5:recommendation.artifactRecommendations[0].conditions";
const XIANYUN_GOBLET_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[3].conditions";
const C6_GOBLET_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[4].conditions";
const EXPECTED_OCCURRENCE_IDS = [
  MARECHAUSSEE_OCCURRENCE_ID,
  XIANYUN_GOBLET_OCCURRENCE_ID,
  C6_GOBLET_OCCURRENCE_ID,
] as const;
const C6_REQUEST_PREDICATE = {
  type: "constellation-at-least",
  characterId: "xiao",
  threshold: 6,
} as const;

const CAPABILITY_BOUNDARY = {
  arbitraryEnglishParsingAllowed: false,
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsEquipmentRecommendations: false,
  supportsBuildRecommendations: false,
  supportsStatRecommendations: false,
  supportsRankClaims: false,
  supportsCompatibilityClaims: false,
  supportsDamageClaims: false,
  supportsFormulaClaims: false,
  supportsRotationClaims: false,
  supportsEnergyRecoveryClaims: false,
  playerFacingRecommendations: false,
  recommendationCompositionExecuted: false,
  crossAxisCompositionExecuted: false,
  payloadCompatibilityEvaluated: false,
  choiceSelectionExecuted: false,
  candidateGenerationExecuted: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  formulaInputsUsed: false,
  damageComputationExecuted: false,
  rotationComputationExecuted: false,
  energyRecoveryInputsUsed: false,
  energyRecoveryComputationExecuted: false,
  assembledBuildCount: 0,
  candidateCount: 0,
} as const;

const CAUTIONS = [
  "This contract projects which of three authenticated source occurrences are applicable in two exact evidence views; it does not recommend or select either payload.",
  "Grouping identical payloads is canonical identity deduplication only. Two conditions yielding the same Anemo Goblet payload are not two votes and do not increase rank or confidence.",
  "The source-only view keeps Xiao C6 unresolved. The second view resolves it only through one exact Guide Factory-owned FFXX-and-Xiao request fact that is not attributed to KQM.",
  "Marechaussee Hunter and an Anemo DMG Bonus Goblet are separate projected axes. Their compatibility, completeness, performance, and joint use are not evaluated.",
  "Fourteen nonempty holdouts and four empty arrays remain unconsumed.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not interpret either view or payload group as a build, candidate, recommendation, rank, guide, or source-authored cross-record composition.",
  "Do not treat repeated payload identity as corroboration, ordering, preference, or stronger evidence.",
  "Do not infer that Xiao is C6 from the source team or apply the wrapper-owned C6 fact outside the exact FFXX-and-Xiao request scope.",
  "Do not infer weapon, substat, ideal-roll, formula-count, damage, rotation, DPS, optimization, or Energy Recharge results.",
] as const;

type SourceLocalSlice = NonNullable<
  XiaoSourceLocalConditionSliceReport["sourceLocalSlice"]
>;
type ExactTeamControl = SourceLocalSlice["exactTeamControls"][number];
type SourceClaim = SourceLocalSlice["sourceClaimCatalog"][number];
type ConditionControl = SourceLocalSlice["conditionControls"][number];
type SourceClaimCell =
  SourceLocalSlice["sourceClaimCells"][number]["claimCells"][number];
type RequestContextReport = NonNullable<
  SourceLocalSlice["requestContextReport"]
>;
type RequestProjection =
  RequestContextReport["teamProjections"][number]["claimProjections"][number];

export interface XiaoFfxxProjectionSourceFile {
  path: string;
  text: string;
}

export interface BuildXiaoFfxxApplicableClaimProjectionContractInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  xiaoDurableReportInput: unknown;
  sourceFiles: readonly XiaoFfxxProjectionSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface XiaoFfxxApplicableOccurrenceEvidence {
  occurrenceId: string;
  selectedOccurrenceSha256: string;
  sourceClaimSha256: string;
  conditionControlSha256: string;
  sourceCellSha256: string;
  requestProjectionSha256: string;
  selectedOccurrence: XiaoSourceLocalSelectedOccurrence;
  sourceClaim: SourceClaim;
  conditionControl: ConditionControl;
  sourceCell: SourceClaimCell;
  requestProjection: RequestProjection;
  applicabilityProvenance: {
    sourceResolution: SourceClaimCell["resolution"];
    contextApplicability: RequestProjection["contextApplicability"];
    effectiveResolution: RequestProjection["resolution"];
    requestContextBindingCount: number;
    sourceControlPreserved: true;
  };
}

export interface XiaoFfxxPayloadIdentityGroup {
  payloadIdentityKey: string;
  claimAxis: XiaoSourceLocalSelectedOccurrence["claimAxis"];
  mainStatSlot: "sands" | "goblet" | "circlet" | null;
  payloadSha256: string;
  payload: XiaoSourceLocalSelectedOccurrence["payload"];
  contributingOccurrenceIds: string[];
  occurrenceMultiplicity: number;
  repeatedPayloadIdentity: boolean;
  establishesCorroboration: false;
  affectsRank: false;
}

export interface XiaoFfxxApplicableClaimView {
  viewId: "source-only-ffxx" | "exact-ffxx-plus-wrapper-c6";
  requestContextUsed: boolean;
  matchedOccurrenceIds: string[];
  unresolvedOccurrenceIds: string[];
  sourceAlreadyMatchedOccurrenceIds: string[];
  requestResolvedOccurrenceIds: string[];
  matchedOccurrenceCount: number;
  unresolvedOccurrenceCount: number;
  requestFactCount: number;
  payloadGroups: XiaoFfxxPayloadIdentityGroup[];
  payloadGroupCount: number;
}

export interface XiaoFfxxApplicableClaimProjectionContractReport {
  schemaVersion: 1;
  reportType: "xiao-ffxx-applicable-claim-projection-contract";
  contractId: typeof CONTRACT_ID;
  classification: "authenticated-descriptive-applicable-claim-projection";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-factory-projection";
  applicabilityProjectionExecuted: boolean;
  payloadIdentityDeduplicationExecuted: boolean;
  arbitraryEnglishParsingAllowed: false;
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsBuildRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsCompatibilityClaims: false;
  supportsDamageClaims: false;
  supportsFormulaClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  playerFacingRecommendations: false;
  recommendationCompositionExecuted: false;
  crossAxisCompositionExecuted: false;
  payloadCompatibilityEvaluated: false;
  choiceSelectionExecuted: false;
  candidateGenerationExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  formulaInputsUsed: false;
  damageComputationExecuted: false;
  rotationComputationExecuted: false;
  energyRecoveryInputsUsed: false;
  energyRecoveryComputationExecuted: false;
  assembledBuildCount: 0;
  candidateCount: 0;
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted" | "rejected";
    exactSourceFilePathSet: boolean;
    sourceFileByteClosureAndJsonObjectParity: boolean;
    exactGeneratedFromPathSet: boolean;
    allDeclaredGeneratedFromHashesAuthenticatedFromBytes: boolean;
    sourceFileCount: number;
    generatedFromCount: number;
  };
  upstreamBoundary: {
    status: "accepted" | "rejected";
    durableReportPath: typeof XIAO_DURABLE_REPORT_PATH;
    durableReportFileSha256: string | null;
    durableReportCanonicalObjectSha256: string | null;
    freshlyAuthenticated: boolean;
    sliceId: string | null;
    selectedOccurrenceCount: number;
    holdoutOccurrenceCount: number;
    emptyOccurrenceCount: number;
    sourceMatchedCount: number;
    sourceUnresolvedCount: number;
    effectiveMatchedCount: number;
  };
  partitionBoundary: {
    selectedOccurrenceIds: string[];
    selectedOccurrencesSha256: string;
    holdoutOccurrenceIds: string[];
    holdoutOccurrencesSha256: string;
    emptyOccurrenceIds: string[];
    emptyOccurrencesSha256: string;
    selectedHoldoutEmptyDisjoint: true;
    selectedOccurrenceCount: 3;
    holdoutOccurrenceCount: 14;
    emptyOccurrenceCount: 4;
    holdoutConsumedCount: 0;
    emptyConsumedCount: 0;
  } | null;
  authorshipBoundary: {
    team: ExactTeamControl;
    teamSha256: string;
    sourceCellsPreservedVerbatim: true;
    requestProjectionsPreservedVerbatim: true;
    sourceAuthoredRequestFact: false;
    requestFactAuthoredBy: "guide-factory-explicit-fixture";
    requestFact: {
      teamRecordId: typeof FFXX_TEAM_ID;
      characterId: "xiao";
      constellation: 6;
      provenance: "request";
    };
  } | null;
  occurrenceEvidence: XiaoFfxxApplicableOccurrenceEvidence[];
  views: {
    sourceOnly: XiaoFfxxApplicableClaimView | null;
    exactFfxxPlusWrapperC6: XiaoFfxxApplicableClaimView | null;
  };
  payloadIdentityPolicy: {
    keyFields: ["claimAxis", "mainStatSlot", "payloadSha256"];
    deduplicationPurpose: "canonical-payload-representation-only";
    occurrenceProvenancePreserved: true;
    repeatedPayloadEstablishesCorroboration: false;
    repeatedPayloadAffectsRank: false;
    payloadGroupOrder: "canonical-technical-only";
  };
  summary: {
    evidenceOccurrenceCount: number;
    sourceOnlyMatchedOccurrenceCount: number;
    sourceOnlyUnresolvedOccurrenceCount: number;
    sourceOnlyPayloadGroupCount: number;
    requestViewMatchedOccurrenceCount: number;
    requestResolvedOccurrenceCount: number;
    requestViewPayloadGroupCount: number;
    duplicatedPayloadOccurrenceCount: number;
    holdoutConsumedCount: 0;
    emptyConsumedCount: 0;
    assembledBuildCount: 0;
    candidateCount: 0;
  };
  issues: Array<{ code: string; path: string; message: string }>;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type XiaoFfxxApplicableClaimProjectionContractAuthentication =
  | {
      authenticated: true;
      canonicalReport: XiaoFfxxApplicableClaimProjectionContractReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: XiaoFfxxApplicableClaimProjectionContractReport["issues"];
    };

export const XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS = [
  ...new Set([
    ...XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
    "scripts/guide-factory/src/xiaoFfxxApplicableClaimProjectionContract.ts",
    "scripts/guide-factory/src/assemble-xiao-ffxx-applicable-claim-projection-contract.ts",
    REPOSITORY_PATH,
    MANUAL_INDEX_PATH,
    SOURCE_REGISTRY_PATH,
    XIAO_DURABLE_REPORT_PATH,
  ]),
].sort(compareText);

export const XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_SOURCE_FILE_PATHS = [
  ...XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS,
];

export const XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "xiao-ffxx-applicable-claim-projection-contract.json",
);

export function buildXiaoFfxxApplicableClaimProjectionContractReport(
  input: BuildXiaoFfxxApplicableClaimProjectionContractInput,
): XiaoFfxxApplicableClaimProjectionContractReport {
  let generatedFrom: GeneratedFromEntry[] = [];
  try {
    const raw = authenticateRawInputs(input);
    generatedFrom = raw.generatedFrom;
    const upstreamGeneratedFrom = XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS.map(
      (inputPath) => requiredGeneratedFrom(raw.generatedFrom, inputPath),
    );
    const upstreamInput: BuildXiaoSourceLocalConditionSliceInput = {
      repositoryInput: raw.repository,
      manualSnapshotInput: raw.manualSnapshot,
      manualSnapshotText: raw.sourceTextByPath.get(XIAO_MANUAL_PATH)!,
      manualIndexInput: raw.manualIndex,
      sourceRegistryInput: raw.sourceRegistry,
      generatedFrom: upstreamGeneratedFrom,
    };
    const upstreamAuthentication =
      authenticateXiaoSourceLocalConditionSliceReport(
        raw.durableReport,
        upstreamInput,
      );
    if (!upstreamAuthentication.authenticated) {
      throw new Error(
        `Xiao source-local report failed fresh authentication (${upstreamAuthentication.reason}): ${upstreamAuthentication.issues
          .map(({ code, message }) => `${code}: ${message}`)
          .join("; ")}`,
      );
    }
    const upstream = upstreamAuthentication.canonicalReport;
    const sourceLocal = requireUpstreamBoundary(upstream);
    const evidence = buildOccurrenceEvidence(upstream, sourceLocal);
    const sourceOnly = buildView({
      viewId: "source-only-ffxx",
      evidence,
      matchedOccurrenceIds: [
        MARECHAUSSEE_OCCURRENCE_ID,
        XIANYUN_GOBLET_OCCURRENCE_ID,
      ],
      unresolvedOccurrenceIds: [C6_GOBLET_OCCURRENCE_ID],
      sourceAlreadyMatchedOccurrenceIds: [
        MARECHAUSSEE_OCCURRENCE_ID,
        XIANYUN_GOBLET_OCCURRENCE_ID,
      ],
      requestResolvedOccurrenceIds: [],
      requestContextUsed: false,
    });
    const exactFfxxPlusWrapperC6 = buildView({
      viewId: "exact-ffxx-plus-wrapper-c6",
      evidence,
      matchedOccurrenceIds: [...EXPECTED_OCCURRENCE_IDS],
      unresolvedOccurrenceIds: [],
      sourceAlreadyMatchedOccurrenceIds: [
        MARECHAUSSEE_OCCURRENCE_ID,
        XIANYUN_GOBLET_OCCURRENCE_ID,
      ],
      requestResolvedOccurrenceIds: [C6_GOBLET_OCCURRENCE_ID],
      requestContextUsed: true,
    });
    authenticateViewBoundary(sourceOnly, exactFfxxPlusWrapperC6);

    const selectedIds = upstream.selectedOccurrences
      .map(({ occurrenceId }) => occurrenceId)
      .sort(compareText);
    const holdoutIds = upstream.holdoutOccurrences
      .map(({ occurrenceId }) => occurrenceId)
      .sort(compareText);
    const emptyIds = upstream.emptyOccurrences
      .map(({ occurrenceId }) => occurrenceId)
      .sort(compareText);
    if (!arePairwiseDisjoint(selectedIds, holdoutIds, emptyIds)) {
      throw new Error(
        "Authenticated Xiao selected, holdout, and empty occurrence partitions overlap.",
      );
    }
    const team = sourceLocal.exactTeamControls[0]!;
    const summary: XiaoFfxxApplicableClaimProjectionContractReport["summary"] = {
      evidenceOccurrenceCount: 3,
      sourceOnlyMatchedOccurrenceCount: 2,
      sourceOnlyUnresolvedOccurrenceCount: 1,
      sourceOnlyPayloadGroupCount: 2,
      requestViewMatchedOccurrenceCount: 3,
      requestResolvedOccurrenceCount: 1,
      requestViewPayloadGroupCount: 2,
      duplicatedPayloadOccurrenceCount: 2,
      holdoutConsumedCount: 0,
      emptyConsumedCount: 0,
      assembledBuildCount: 0,
      candidateCount: 0,
    };

    return {
      schemaVersion: 1,
      reportType: "xiao-ffxx-applicable-claim-projection-contract",
      contractId: CONTRACT_ID,
      classification: "authenticated-descriptive-applicable-claim-projection",
      comparisonStatus: "comparable",
      publicationStatus: "withheld-unreviewed-factory-projection",
      applicabilityProjectionExecuted: true,
      payloadIdentityDeduplicationExecuted: true,
      ...CAPABILITY_BOUNDARY,
      generatedFrom,
      rawInputBoundary: {
        status: "accepted",
        exactSourceFilePathSet: true,
        sourceFileByteClosureAndJsonObjectParity: true,
        exactGeneratedFromPathSet: true,
        allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
        sourceFileCount:
          XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_SOURCE_FILE_PATHS.length,
        generatedFromCount:
          XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS.length,
      },
      upstreamBoundary: {
        status: "accepted",
        durableReportPath: XIAO_DURABLE_REPORT_PATH,
        durableReportFileSha256: sha256Text(
          raw.sourceTextByPath.get(XIAO_DURABLE_REPORT_PATH)!,
        ),
        durableReportCanonicalObjectSha256: hashValue(raw.durableReport),
        freshlyAuthenticated: true,
        sliceId: upstream.sliceId,
        selectedOccurrenceCount: upstream.selectedOccurrences.length,
        holdoutOccurrenceCount: upstream.holdoutOccurrences.length,
        emptyOccurrenceCount: upstream.emptyOccurrences.length,
        sourceMatchedCount: upstream.summary.sourceMatchedCount,
        sourceUnresolvedCount: upstream.summary.sourceUnresolvedCount,
        effectiveMatchedCount: upstream.summary.effectiveMatchedCount,
      },
      partitionBoundary: {
        selectedOccurrenceIds: selectedIds,
        selectedOccurrencesSha256: hashValue(upstream.selectedOccurrences),
        holdoutOccurrenceIds: holdoutIds,
        holdoutOccurrencesSha256: hashValue(upstream.holdoutOccurrences),
        emptyOccurrenceIds: emptyIds,
        emptyOccurrencesSha256: hashValue(upstream.emptyOccurrences),
        selectedHoldoutEmptyDisjoint: true,
        selectedOccurrenceCount: 3,
        holdoutOccurrenceCount: 14,
        emptyOccurrenceCount: 4,
        holdoutConsumedCount: 0,
        emptyConsumedCount: 0,
      },
      authorshipBoundary: {
        team: structuredClone(team),
        teamSha256: hashValue(team),
        sourceCellsPreservedVerbatim: true,
        requestProjectionsPreservedVerbatim: true,
        sourceAuthoredRequestFact: false,
        requestFactAuthoredBy: "guide-factory-explicit-fixture",
        requestFact: {
          teamRecordId: FFXX_TEAM_ID,
          characterId: "xiao",
          constellation: 6,
          provenance: "request",
        },
      },
      occurrenceEvidence: evidence,
      views: { sourceOnly, exactFfxxPlusWrapperC6 },
      payloadIdentityPolicy: {
        keyFields: ["claimAxis", "mainStatSlot", "payloadSha256"],
        deduplicationPurpose: "canonical-payload-representation-only",
        occurrenceProvenancePreserved: true,
        repeatedPayloadEstablishesCorroboration: false,
        repeatedPayloadAffectsRank: false,
        payloadGroupOrder: "canonical-technical-only",
      },
      summary,
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

export function authenticateXiaoFfxxApplicableClaimProjectionContract(
  serializedReport: XiaoFfxxApplicableClaimProjectionContractReport,
  input: BuildXiaoFfxxApplicableClaimProjectionContractInput,
): XiaoFfxxApplicableClaimProjectionContractAuthentication {
  const canonicalReport =
    buildXiaoFfxxApplicableClaimProjectionContractReport(input);
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
          code: "xiao-ffxx-projection.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Xiao FFXX applicable-claim projection does not match a fresh authenticated rebuild.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableXiaoFfxxApplicableClaimProjectionContract(
  report: XiaoFfxxApplicableClaimProjectionContractReport,
  input: BuildXiaoFfxxApplicableClaimProjectionContractInput,
): void {
  const authentication =
    authenticateXiaoFfxxApplicableClaimProjectionContract(report, input);
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Xiao FFXX applicable-claim projection (${authentication.reason}): ${authentication.issues
      .map(({ code, message }) => `${code}: ${message}`)
      .join("; ")}`,
  );
}

function authenticateRawInputs(
  input: BuildXiaoFfxxApplicableClaimProjectionContractInput,
): {
  generatedFrom: GeneratedFromEntry[];
  sourceTextByPath: Map<string, string>;
  repository: ReturnType<typeof KnowledgeRepositorySchema.parse>;
  manualSnapshot: ReturnType<typeof ManualObservationSnapshotSchema.parse>;
  manualIndex: ReturnType<typeof ManualSnapshotIndexSchema.parse>;
  sourceRegistry: ReturnType<typeof SourceRegistrySchema.parse>;
  durableReport: XiaoSourceLocalConditionSliceReport;
} {
  const generatedFrom = canonicalGeneratedFrom(input.generatedFrom);
  const expectedGeneratedPaths =
    XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS;
  if (
    stableJson(generatedFrom.map(({ path: inputPath }) => inputPath)) !==
    stableJson(expectedGeneratedPaths)
  ) {
    throw new Error("Xiao FFXX projection generatedFrom path closure drifted.");
  }
  const sourceFiles = [...input.sourceFiles]
    .map(({ path: sourcePath, text }) => ({
      path: normalizePath(sourcePath),
      text,
    }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    new Set(sourceFiles.map(({ path: sourcePath }) => sourcePath)).size !==
      sourceFiles.length ||
    stableJson(sourceFiles.map(({ path: sourcePath }) => sourcePath)) !==
      stableJson(XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_SOURCE_FILE_PATHS)
  ) {
    throw new Error("Xiao FFXX projection source-file path closure drifted.");
  }
  const generatedHashByPath = new Map(
    generatedFrom.map(({ path: inputPath, sha256 }) => [inputPath, sha256]),
  );
  const sourceTextByPath = new Map<string, string>();
  for (const sourceFile of sourceFiles) {
    if (typeof sourceFile.text !== "string") {
      throw new Error(`Source file ${sourceFile.path} has no text.`);
    }
    if (sha256Text(sourceFile.text) !== generatedHashByPath.get(sourceFile.path)) {
      throw new Error(
        `Xiao FFXX projection source-file hash drifted for ${sourceFile.path}.`,
      );
    }
    sourceTextByPath.set(sourceFile.path, sourceFile.text);
  }

  authenticateParsedJson(
    input.repositoryInput,
    sourceTextByPath.get(REPOSITORY_PATH),
    REPOSITORY_PATH,
  );
  authenticateParsedJson(
    input.manualSnapshotInput,
    sourceTextByPath.get(XIAO_MANUAL_PATH),
    XIAO_MANUAL_PATH,
  );
  authenticateParsedJson(
    input.manualIndexInput,
    sourceTextByPath.get(MANUAL_INDEX_PATH),
    MANUAL_INDEX_PATH,
  );
  authenticateParsedJson(
    input.sourceRegistryInput,
    sourceTextByPath.get(SOURCE_REGISTRY_PATH),
    SOURCE_REGISTRY_PATH,
  );
  authenticateParsedJson(
    input.xiaoDurableReportInput,
    sourceTextByPath.get(XIAO_DURABLE_REPORT_PATH),
    XIAO_DURABLE_REPORT_PATH,
  );

  return {
    generatedFrom,
    sourceTextByPath,
    repository: KnowledgeRepositorySchema.parse(input.repositoryInput),
    manualSnapshot: ManualObservationSnapshotSchema.parse(
      input.manualSnapshotInput,
    ),
    manualIndex: ManualSnapshotIndexSchema.parse(input.manualIndexInput),
    sourceRegistry: SourceRegistrySchema.parse(input.sourceRegistryInput),
    durableReport:
      input.xiaoDurableReportInput as XiaoSourceLocalConditionSliceReport,
  };
}

function requireUpstreamBoundary(
  upstream: XiaoSourceLocalConditionSliceReport,
): SourceLocalSlice {
  const sourceLocal = upstream.sourceLocalSlice;
  if (
    upstream.comparisonStatus !== "comparable" ||
    upstream.sliceId !== XIAO_SLICE_ID ||
    sourceLocal == null ||
    sourceLocal.comparisonStatus !== "comparable" ||
    upstream.selectedOccurrences.length !== 3 ||
    upstream.holdoutOccurrences.length !== 14 ||
    upstream.emptyOccurrences.length !== 4 ||
    upstream.summary.sourceMatchedCount !== 2 ||
    upstream.summary.sourceUnresolvedCount !== 1 ||
    upstream.summary.effectiveMatchedCount !== 3 ||
    upstream.summary.effectiveUnresolvedCount !== 0 ||
    upstream.summary.holdoutConsumedCount !== 0 ||
    upstream.summary.emptyConsumedCount !== 0 ||
    sourceLocal.summary.sourceMatchedCount !== 2 ||
    sourceLocal.summary.sourceUnresolvedCount !== 1 ||
    sourceLocal.summary.effectiveMatchedCount !== 3 ||
    sourceLocal.summary.effectiveUnresolvedCount !== 0 ||
    sourceLocal.exactTeamControls.length !== 1 ||
    sourceLocal.sourceClaimCatalog.length !== 3 ||
    sourceLocal.conditionControls.length !== 3 ||
    sourceLocal.sourceClaimCells.length !== 1 ||
    sourceLocal.sourceClaimCells[0]?.claimCells.length !== 3 ||
    sourceLocal.requestContextReport?.teamProjections.length !== 1 ||
    sourceLocal.requestContextReport.teamProjections[0]?.claimProjections
      .length !== 3 ||
    stableJson(
      upstream.selectedOccurrences
        .map(({ occurrenceId }) => occurrenceId)
        .sort(compareText),
    ) !== stableJson([...EXPECTED_OCCURRENCE_IDS].sort(compareText))
  ) {
    throw new Error(
      "Authenticated Xiao source-local report lost its exact 3/14/4 partition or 2-source-plus-1-request applicability boundary.",
    );
  }
  const team = sourceLocal.exactTeamControls[0]!;
  if (
    team.teamRecordId !== FFXX_TEAM_ID ||
    stableJson(team.memberCharacterIds) !==
      stableJson(["xiao", "xianyun", "furina", "faruzan"])
  ) {
    throw new Error("Authenticated Xiao projection lost the exact FFXX team.");
  }
  const requestFact = sourceLocal.requestContextReport.context
    .requestFactsByTeamRecordId?.[FFXX_TEAM_ID]?.characterFactsById?.xiao;
  if (
    requestFact?.constellation !== 6 ||
    stableJson(sourceLocal.requestContextReport.context) !==
      stableJson({
        requestFactsByTeamRecordId: {
          [FFXX_TEAM_ID]: {
            characterFactsById: { xiao: { constellation: 6 } },
          },
        },
      })
  ) {
    throw new Error(
      "Authenticated Xiao projection lost its exact wrapper-owned C6 request fact.",
    );
  }
  return sourceLocal;
}

function buildOccurrenceEvidence(
  upstream: XiaoSourceLocalConditionSliceReport,
  sourceLocal: SourceLocalSlice,
): XiaoFfxxApplicableOccurrenceEvidence[] {
  const selectedById = exactMap(
    upstream.selectedOccurrences,
    ({ occurrenceId }) => occurrenceId,
    "selected occurrence",
  );
  const claimById = exactMap(
    sourceLocal.sourceClaimCatalog,
    ({ claimId }) => claimId,
    "source claim",
  );
  const controlById = exactMap(
    sourceLocal.conditionControls,
    ({ claimId }) => claimId,
    "condition control",
  );
  const sourceCellById = exactMap(
    sourceLocal.sourceClaimCells[0]!.claimCells,
    ({ claimId }) => claimId,
    "source cell",
  );
  const projectionById = exactMap(
    sourceLocal.requestContextReport!.teamProjections[0]!.claimProjections,
    ({ claimId }) => claimId,
    "request projection",
  );

  return [...EXPECTED_OCCURRENCE_IDS]
    .sort(compareText)
    .map((occurrenceId) => {
      const selected = requiredMapValue(
        selectedById,
        occurrenceId,
        "selected occurrence",
      );
      const sourceClaim = requiredMapValue(
        claimById,
        occurrenceId,
        "source claim",
      );
      const conditionControl = requiredMapValue(
        controlById,
        occurrenceId,
        "condition control",
      );
      const sourceCell = requiredMapValue(
        sourceCellById,
        occurrenceId,
        "source cell",
      );
      const requestProjection = requiredMapValue(
        projectionById,
        occurrenceId,
        "request projection",
      );
      authenticateOccurrenceLineage(
        selected,
        sourceClaim,
        conditionControl,
        sourceCell,
        requestProjection,
      );
      return {
        occurrenceId,
        selectedOccurrenceSha256: hashValue(selected),
        sourceClaimSha256: hashValue(sourceClaim),
        conditionControlSha256: hashValue(conditionControl),
        sourceCellSha256: hashValue(sourceCell),
        requestProjectionSha256: hashValue(requestProjection),
        selectedOccurrence: structuredClone(selected),
        sourceClaim: structuredClone(sourceClaim),
        conditionControl: structuredClone(conditionControl),
        sourceCell: structuredClone(sourceCell),
        requestProjection: structuredClone(requestProjection),
        applicabilityProvenance: {
          sourceResolution: sourceCell.resolution,
          contextApplicability: requestProjection.contextApplicability,
          effectiveResolution: requestProjection.resolution,
          requestContextBindingCount:
            requestProjection.requestContextBindings.length,
          sourceControlPreserved: true,
        },
      };
    });
}

function authenticateOccurrenceLineage(
  selected: XiaoSourceLocalSelectedOccurrence,
  sourceClaim: SourceClaim,
  conditionControl: ConditionControl,
  sourceCell: SourceClaimCell,
  requestProjection: RequestProjection,
): void {
  const occurrenceId = selected.occurrenceId;
  if (
    sourceClaim.claimId !== occurrenceId ||
    conditionControl.claimId !== occurrenceId ||
    sourceCell.claimId !== occurrenceId ||
    requestProjection.claimId !== occurrenceId ||
    sourceClaim.sourceConditionsSha256 !== selected.conditionsSha256 ||
    conditionControl.occurrenceControl.sourceConditionsSha256 !==
      selected.conditionsSha256 ||
    sourceCell.sourceConditionsSha256 !== selected.conditionsSha256 ||
    requestProjection.sourceControl.sourceConditionsSha256 !==
      selected.conditionsSha256 ||
    stableJson(sourceClaim.payload) !== stableJson(selected.payload) ||
    conditionControl.occurrenceControl.payloadSha256 !== selected.payloadSha256
  ) {
    throw new Error(`Xiao projection lineage drifted for ${occurrenceId}.`);
  }
  const isC6 = occurrenceId === C6_GOBLET_OCCURRENCE_ID;
  if (!isC6) {
    if (
      sourceCell.resolution !== "matched" ||
      requestProjection.sourceControl.resolution !== "matched" ||
      requestProjection.contextApplicability !== "source-already-matched" ||
      requestProjection.resolution !== "matched" ||
      conditionControl.requestBindings.length !== 0 ||
      requestProjection.requestContextBindings.length !== 0 ||
      selected.requestPredicate !== null ||
      selected.requestPredicateSha256 !== null
    ) {
      throw new Error(
        `Xiao source-matched occurrence ${occurrenceId} crossed its no-request boundary.`,
      );
    }
    return;
  }

  const inputBinding = conditionControl.requestBindings[0];
  const outputBinding = requestProjection.requestContextBindings[0];
  const factRow = outputBinding?.predicateRows[0];
  if (
    sourceCell.resolution !== "unresolved-context" ||
    requestProjection.sourceControl.resolution !== "unresolved-context" ||
    requestProjection.contextApplicability !==
      "applicable-under-supplied-context" ||
    requestProjection.resolution !== "matched" ||
    conditionControl.requestBindings.length !== 1 ||
    requestProjection.requestContextBindings.length !== 1 ||
    inputBinding?.sourcePredicatePath !== "predicate" ||
    inputBinding.sourcePredicateLeafSha256 !== selected.predicateSha256 ||
    stableJson(inputBinding.requestPredicate) !==
      stableJson(C6_REQUEST_PREDICATE) ||
    stableJson(selected.requestPredicate) !==
      stableJson(C6_REQUEST_PREDICATE) ||
    outputBinding?.sourcePredicatePath !== "predicate" ||
    outputBinding.result !== "true" ||
    stableJson(outputBinding.requestPredicate) !==
      stableJson(C6_REQUEST_PREDICATE) ||
    outputBinding.predicateRows.length !== 1 ||
    factRow?.factProvenance !== "request" ||
    factRow.factScope.teamRecordId !== FFXX_TEAM_ID ||
    factRow.factScope.characterId !== "xiao" ||
    factRow.factScope.accountSnapshotId !== null
  ) {
    throw new Error(
      "Xiao C6 occurrence lost its exact source-unresolved and FFXX/Xiao request-resolved boundary.",
    );
  }
}

function buildView(input: {
  viewId: XiaoFfxxApplicableClaimView["viewId"];
  evidence: readonly XiaoFfxxApplicableOccurrenceEvidence[];
  matchedOccurrenceIds: readonly string[];
  unresolvedOccurrenceIds: readonly string[];
  sourceAlreadyMatchedOccurrenceIds: readonly string[];
  requestResolvedOccurrenceIds: readonly string[];
  requestContextUsed: boolean;
}): XiaoFfxxApplicableClaimView {
  const evidenceById = new Map(
    input.evidence.map((row) => [row.occurrenceId, row]),
  );
  const matchedRows = input.matchedOccurrenceIds.map((occurrenceId) =>
    requiredMapValue(evidenceById, occurrenceId, "view evidence"),
  );
  const payloadGroups = groupPayloadIdentity(matchedRows);
  return {
    viewId: input.viewId,
    requestContextUsed: input.requestContextUsed,
    matchedOccurrenceIds: [...input.matchedOccurrenceIds].sort(compareText),
    unresolvedOccurrenceIds: [...input.unresolvedOccurrenceIds].sort(
      compareText,
    ),
    sourceAlreadyMatchedOccurrenceIds: [
      ...input.sourceAlreadyMatchedOccurrenceIds,
    ].sort(compareText),
    requestResolvedOccurrenceIds: [...input.requestResolvedOccurrenceIds].sort(
      compareText,
    ),
    matchedOccurrenceCount: input.matchedOccurrenceIds.length,
    unresolvedOccurrenceCount: input.unresolvedOccurrenceIds.length,
    requestFactCount: input.requestContextUsed ? 1 : 0,
    payloadGroups,
    payloadGroupCount: payloadGroups.length,
  };
}

function groupPayloadIdentity(
  rows: readonly XiaoFfxxApplicableOccurrenceEvidence[],
): XiaoFfxxPayloadIdentityGroup[] {
  const groups = new Map<string, XiaoFfxxPayloadIdentityGroup>();
  for (const row of rows) {
    const selected = row.selectedOccurrence;
    const mainStatSlot = selected.mainStatSlot ?? null;
    const payloadIdentityKey = stableJson({
      claimAxis: selected.claimAxis,
      mainStatSlot,
      payloadSha256: selected.payloadSha256,
    });
    const existing = groups.get(payloadIdentityKey);
    if (existing) {
      if (stableJson(existing.payload) !== stableJson(selected.payload)) {
        throw new Error(
          `Payload hash collision in Xiao projection group ${payloadIdentityKey}.`,
        );
      }
      existing.contributingOccurrenceIds.push(row.occurrenceId);
      existing.contributingOccurrenceIds.sort(compareText);
      existing.occurrenceMultiplicity = existing.contributingOccurrenceIds.length;
      existing.repeatedPayloadIdentity = existing.occurrenceMultiplicity > 1;
      continue;
    }
    groups.set(payloadIdentityKey, {
      payloadIdentityKey,
      claimAxis: selected.claimAxis,
      mainStatSlot,
      payloadSha256: selected.payloadSha256,
      payload: structuredClone(selected.payload),
      contributingOccurrenceIds: [row.occurrenceId],
      occurrenceMultiplicity: 1,
      repeatedPayloadIdentity: false,
      establishesCorroboration: false,
      affectsRank: false,
    });
  }
  return [...groups.values()].sort((left, right) =>
    compareText(left.payloadIdentityKey, right.payloadIdentityKey),
  );
}

function authenticateViewBoundary(
  sourceOnly: XiaoFfxxApplicableClaimView,
  requestView: XiaoFfxxApplicableClaimView,
): void {
  const repeated = requestView.payloadGroups.find(
    ({ payloadSha256 }) =>
      payloadSha256 ===
      "091c19dded0fd5a8cbf9ccb686bf826261cb7859276580f7f81c8ef26d709ef1",
  );
  if (
    sourceOnly.viewId !== "source-only-ffxx" ||
    sourceOnly.requestContextUsed !== false ||
    stableJson(sourceOnly.matchedOccurrenceIds) !==
      stableJson(
        [MARECHAUSSEE_OCCURRENCE_ID, XIANYUN_GOBLET_OCCURRENCE_ID].sort(
          compareText,
        ),
      ) ||
    stableJson(sourceOnly.unresolvedOccurrenceIds) !==
      stableJson([C6_GOBLET_OCCURRENCE_ID]) ||
    stableJson(sourceOnly.sourceAlreadyMatchedOccurrenceIds) !==
      stableJson(
        [MARECHAUSSEE_OCCURRENCE_ID, XIANYUN_GOBLET_OCCURRENCE_ID].sort(
          compareText,
        ),
      ) ||
    sourceOnly.requestResolvedOccurrenceIds.length !== 0 ||
    requestView.viewId !== "exact-ffxx-plus-wrapper-c6" ||
    requestView.requestContextUsed !== true ||
    stableJson(requestView.matchedOccurrenceIds) !==
      stableJson([...EXPECTED_OCCURRENCE_IDS].sort(compareText)) ||
    requestView.unresolvedOccurrenceIds.length !== 0 ||
    stableJson(requestView.sourceAlreadyMatchedOccurrenceIds) !==
      stableJson(
        [MARECHAUSSEE_OCCURRENCE_ID, XIANYUN_GOBLET_OCCURRENCE_ID].sort(
          compareText,
        ),
      ) ||
    sourceOnly.matchedOccurrenceCount !== 2 ||
    sourceOnly.unresolvedOccurrenceCount !== 1 ||
    sourceOnly.payloadGroupCount !== 2 ||
    sourceOnly.requestFactCount !== 0 ||
    requestView.matchedOccurrenceCount !== 3 ||
    requestView.unresolvedOccurrenceCount !== 0 ||
    requestView.payloadGroupCount !== 2 ||
    requestView.requestFactCount !== 1 ||
    requestView.requestResolvedOccurrenceIds.length !== 1 ||
    requestView.requestResolvedOccurrenceIds[0] !== C6_GOBLET_OCCURRENCE_ID ||
    repeated?.occurrenceMultiplicity !== 2 ||
    stableJson(repeated.contributingOccurrenceIds) !==
      stableJson(
        [XIANYUN_GOBLET_OCCURRENCE_ID, C6_GOBLET_OCCURRENCE_ID].sort(
          compareText,
        ),
      ) ||
    repeated.establishesCorroboration ||
    repeated.affectsRank
  ) {
    throw new Error(
      "Xiao FFXX projection lost its exact 2-versus-3 applicability or two-payload-group boundary.",
    );
  }
}

function canonicalGeneratedFrom(
  entries: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  const canonical = entries
    .map(({ path: inputPath, sha256 }) => ({
      path: normalizePath(inputPath),
      sha256,
    }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    new Set(canonical.map(({ path: inputPath }) => inputPath)).size !==
      canonical.length ||
    canonical.some(({ sha256 }) => !/^[a-f0-9]{64}$/.test(sha256))
  ) {
    throw new Error("Xiao FFXX projection generatedFrom entries are invalid.");
  }
  return canonical;
}

function authenticateParsedJson(
  parsedInput: unknown,
  sourceText: string | undefined,
  sourcePath: string,
): void {
  if (sourceText == null) {
    throw new Error(`Missing Xiao FFXX projection source file ${sourcePath}.`);
  }
  let parsedText: unknown;
  try {
    parsedText = JSON.parse(sourceText);
  } catch {
    throw new Error(`Xiao FFXX projection source file ${sourcePath} is not JSON.`);
  }
  if (stableJson(parsedInput) !== stableJson(parsedText)) {
    throw new Error(
      `Xiao FFXX projection parsed input disagrees with source bytes for ${sourcePath}.`,
    );
  }
}

function requiredGeneratedFrom(
  entries: readonly GeneratedFromEntry[],
  inputPath: string,
): GeneratedFromEntry {
  const normalized = normalizePath(inputPath);
  const matches = entries.filter(({ path: entryPath }) => entryPath === normalized);
  if (matches.length !== 1) {
    throw new Error(
      `Expected one generatedFrom entry for ${normalized}, found ${matches.length}.`,
    );
  }
  return { ...matches[0]! };
}

function exactMap<T>(
  rows: readonly T[],
  id: (row: T) => string,
  label: string,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const rowId = id(row);
    if (result.has(rowId)) {
      throw new Error(`Duplicate Xiao projection ${label} ${rowId}.`);
    }
    result.set(rowId, row);
  }
  return result;
}

function arePairwiseDisjoint(...groups: readonly string[][]): boolean {
  const seen = new Set<string>();
  for (const group of groups) {
    for (const value of group) {
      if (seen.has(value)) return false;
      seen.add(value);
    }
  }
  return true;
}

function requiredMapValue<T>(
  map: ReadonlyMap<string, T>,
  key: string,
  label: string,
): T {
  const value = map.get(key);
  if (!value) throw new Error(`Missing Xiao projection ${label} ${key}.`);
  return value;
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function failedReport(
  generatedFrom: readonly GeneratedFromEntry[],
  message: string,
): XiaoFfxxApplicableClaimProjectionContractReport {
  return {
    schemaVersion: 1,
    reportType: "xiao-ffxx-applicable-claim-projection-contract",
    contractId: CONTRACT_ID,
    classification: "authenticated-descriptive-applicable-claim-projection",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-unreviewed-factory-projection",
    applicabilityProjectionExecuted: false,
    payloadIdentityDeduplicationExecuted: false,
    ...CAPABILITY_BOUNDARY,
    generatedFrom: generatedFrom.map((entry) => ({ ...entry })),
    rawInputBoundary: {
      status: "rejected",
      exactSourceFilePathSet: false,
      sourceFileByteClosureAndJsonObjectParity: false,
      exactGeneratedFromPathSet: false,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: false,
      sourceFileCount: 0,
      generatedFromCount: generatedFrom.length,
    },
    upstreamBoundary: {
      status: "rejected",
      durableReportPath: XIAO_DURABLE_REPORT_PATH,
      durableReportFileSha256: null,
      durableReportCanonicalObjectSha256: null,
      freshlyAuthenticated: false,
      sliceId: null,
      selectedOccurrenceCount: 0,
      holdoutOccurrenceCount: 0,
      emptyOccurrenceCount: 0,
      sourceMatchedCount: 0,
      sourceUnresolvedCount: 0,
      effectiveMatchedCount: 0,
    },
    partitionBoundary: null,
    authorshipBoundary: null,
    occurrenceEvidence: [],
    views: { sourceOnly: null, exactFfxxPlusWrapperC6: null },
    payloadIdentityPolicy: {
      keyFields: ["claimAxis", "mainStatSlot", "payloadSha256"],
      deduplicationPurpose: "canonical-payload-representation-only",
      occurrenceProvenancePreserved: true,
      repeatedPayloadEstablishesCorroboration: false,
      repeatedPayloadAffectsRank: false,
      payloadGroupOrder: "canonical-technical-only",
    },
    summary: {
      evidenceOccurrenceCount: 0,
      sourceOnlyMatchedOccurrenceCount: 0,
      sourceOnlyUnresolvedOccurrenceCount: 0,
      sourceOnlyPayloadGroupCount: 0,
      requestViewMatchedOccurrenceCount: 0,
      requestResolvedOccurrenceCount: 0,
      requestViewPayloadGroupCount: 0,
      duplicatedPayloadOccurrenceCount: 0,
      holdoutConsumedCount: 0,
      emptyConsumedCount: 0,
      assembledBuildCount: 0,
      candidateCount: 0,
    },
    issues: [
      {
        code: "xiao-ffxx-projection.canonical-input",
        path: "input",
        message,
      },
    ],
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
