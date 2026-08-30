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
  authenticateXiaoFfxxApplicableClaimProjectionContract,
  XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS,
  XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_SOURCE_FILE_PATHS,
  type BuildXiaoFfxxApplicableClaimProjectionContractInput,
  type XiaoFfxxApplicableClaimProjectionContractReport,
  type XiaoFfxxApplicableClaimView,
  type XiaoFfxxApplicableOccurrenceEvidence,
  type XiaoFfxxPayloadIdentityGroup,
} from "./xiaoFfxxApplicableClaimProjectionContract";
import type { XiaoSourceLocalConditionSliceReport } from "./xiaoSourceLocalConditionSlice";

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
const XIAO_SOURCE_LOCAL_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-source-local-condition-slice.json";
const APPLICABLE_CLAIM_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-applicable-claim-projection-contract.json";

const CONTRACT_ID =
  "guide-factory-xiao-ffxx-partial-artifact-candidate-version-5-5";
const TEAM_ID =
  "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5";
const CHARACTER_ID = "xiao";
const CANDIDATE_ID =
  "guide-factory:xiao-ffxx:partial-artifact:marechaussee-hunter-anemo-goblet";
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
const MARECHAUSSEE_PAYLOAD_SHA256 =
  "3f1da28d319a9d68334c22cf1f7998b682159989bf09753aed8935ce3db85fdb";
const ANEMO_GOBLET_PAYLOAD_SHA256 =
  "091c19dded0fd5a8cbf9ccb686bf826261cb7859276580f7f81c8ef26d709ef1";

const AXIS_VOCABULARY = [
  "weapon",
  "artifact-set",
  "main-stat:sands",
  "main-stat:goblet",
  "main-stat:circlet",
  "substats",
] as const;

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
  choiceSelectionExecuted: false,
  cartesianChoiceEnumerationExecuted: false,
  payloadCompatibilityEvaluated: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  formulaInputsUsed: false,
  damageComputationExecuted: false,
  rotationComputationExecuted: false,
  energyRecoveryInputsUsed: false,
  energyRecoveryComputationExecuted: false,
} as const;

const CAUTIONS = [
  "This contract joins one authenticated artifact-set payload and one authenticated Goblet payload into a partial technical candidate. It does not establish a complete build or recommendation.",
  "The source-only and exact-request views bind different evidence to the same technical candidate. The C6 reason adds provenance, not a second payload or candidate.",
  "Weapon, Sands, Circlet, and substat axes are missing from this admitted projection. Missing means not admitted here, not absent from KQM or unsuitable for Xiao.",
  "The syntactic singleton-axis join does not evaluate joint gameplay compatibility, performance, damage, rotation, optimization, or Energy Recharge.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not publish this partial technical candidate as a Xiao build, guide, equipment recommendation, ranking, or source-authored whole composition.",
  "Do not fill missing axes from nearby source records, current presets, defaults, or player inventory.",
  "Do not count the request view as a second candidate or treat duplicate Anemo Goblet provenance as a vote, corroboration, confidence, or rank signal.",
  "Do not infer formula counts, damage, DPS, gameplay feasibility, optimality, ideal rolls, or an Energy Recharge requirement.",
] as const;

export type XiaoFfxxPartialArtifactAxisId =
  (typeof AXIS_VOCABULARY)[number];

export interface XiaoFfxxPartialArtifactSourceFile {
  path: string;
  text: string;
}

export interface BuildXiaoFfxxPartialArtifactCandidateContractInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  xiaoSourceLocalDurableReportInput: unknown;
  applicableClaimDurableReportInput: unknown;
  sourceFiles: readonly XiaoFfxxPartialArtifactSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface XiaoFfxxPartialArtifactPresentAxis {
  axisId: "artifact-set" | "main-stat:goblet";
  ordinal: number;
  status: "present-authenticated-singleton";
  sourcePayloadSha256: string;
  sourcePayload: XiaoFfxxPayloadIdentityGroup["payload"];
  normalizedValues:
    | [{ type: "4pc"; setId: "marechaussee_hunter" }]
    | [{ slot: "goblet"; statId: "anemo%" }];
  sourceRecordIds: string[];
}

export interface XiaoFfxxPartialArtifactMissingAxis {
  axisId: "weapon" | "main-stat:sands" | "main-stat:circlet" | "substats";
  ordinal: number;
  status: "missing-not-admitted-no-default";
  reason:
    | "not-present-in-authenticated-applicable-claim-projection"
    | "conditional-or-unselected-source-records-not-consumed";
}

export type XiaoFfxxPartialArtifactAxis =
  | XiaoFfxxPartialArtifactPresentAxis
  | XiaoFfxxPartialArtifactMissingAxis;

export interface XiaoFfxxPartialArtifactCandidate {
  candidateId: typeof CANDIDATE_ID;
  technicalCombinationSha256: string;
  candidateIdentitySha256: string;
  authoredBy: "guide-factory";
  sourceAuthored: false;
  sourcePublishedWholeCandidate: false;
  compositionKind: "syntactic-singleton-axis-join";
  completionStatus: "partial";
  materializableAsGuideBuildRecommendation: false;
  runtimeArtifactGenerationCandidate: false;
  jointPayloadCompatibility: "not-evaluated";
  teamRecordId: typeof TEAM_ID;
  characterId: typeof CHARACTER_ID;
  sourceConstellation: "unspecified";
  wrapperRequestFactExcludedFromCandidateIdentity: true;
  axisVocabulary: XiaoFfxxPartialArtifactAxisId[];
  axes: XiaoFfxxPartialArtifactAxis[];
  presentAxisIds: ["artifact-set", "main-stat:goblet"];
  missingAxisIds: [
    "weapon",
    "main-stat:sands",
    "main-stat:circlet",
    "substats",
  ];
  completeness: {
    axisCount: 6;
    presentAxisCount: 2;
    missingAxisCount: 4;
    complete: false;
    energyRecoveryPolicy: "excluded-deferred-not-a-completeness-axis";
  };
}

export interface XiaoFfxxPartialArtifactOccurrenceBinding {
  occurrenceId: string;
  occurrenceEvidenceSha256: string;
  selectedOccurrenceSha256: string;
  sourceClaimSha256: string;
  conditionControlSha256: string;
  sourceCellSha256: string;
  requestProjectionSha256: string;
  sourceResolution: string;
  contextApplicability: string;
  effectiveResolution: string;
  requestContextBindingCount: number;
}

export interface XiaoFfxxPartialArtifactAxisEvidenceBinding {
  axisId: "artifact-set" | "main-stat:goblet";
  sourcePayloadSha256: string;
  occurrenceIds: string[];
  occurrenceEvidence: XiaoFfxxPartialArtifactOccurrenceBinding[];
}

export interface XiaoFfxxPartialArtifactViewBinding {
  bindingId:
    | "xiao-ffxx-source-only-partial-candidate-binding"
    | "xiao-ffxx-plus-wrapper-c6-partial-candidate-binding";
  viewId: XiaoFfxxApplicableClaimView["viewId"];
  upstreamViewSha256: string;
  viewBindingSha256: string;
  candidateId: typeof CANDIDATE_ID;
  technicalCombinationSha256: string;
  candidateIdentitySha256: string;
  matchedOccurrenceIds: string[];
  unresolvedOccurrenceIds: string[];
  requestFactCount: number;
  requestFactAuthoredBy:
    | "none"
    | "guide-factory-explicit-fixture";
  requestFact: {
    teamRecordId: typeof TEAM_ID;
    characterId: typeof CHARACTER_ID;
    constellation: 6;
    provenance: "request";
  } | null;
  requestFactChangesTechnicalCandidateIdentity: false;
  repeatedGobletPayloadEstablishesCorroboration: false;
  repeatedGobletPayloadAffectsRank: false;
  axisEvidenceBindings: XiaoFfxxPartialArtifactAxisEvidenceBinding[];
}

export interface XiaoFfxxPartialArtifactCandidateContractReport {
  schemaVersion: 1;
  reportType: "xiao-ffxx-partial-artifact-candidate-contract";
  contractId: typeof CONTRACT_ID;
  classification: "authenticated-guide-factory-authored-partial-technical-candidate";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-partial-technical-candidate";
  crossAxisCompositionExecuted: boolean;
  partialCandidateConstructionExecuted: boolean;
  candidateGenerationExecuted: boolean;
  candidateGenerationKind:
    | "deterministic-singleton-axis-join"
    | "none-failed-input";
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
  choiceSelectionExecuted: false;
  cartesianChoiceEnumerationExecuted: false;
  payloadCompatibilityEvaluated: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  formulaInputsUsed: false;
  damageComputationExecuted: false;
  rotationComputationExecuted: false;
  energyRecoveryInputsUsed: false;
  energyRecoveryComputationExecuted: false;
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
    durableReportPath: typeof APPLICABLE_CLAIM_REPORT_PATH;
    durableReportFileSha256: string | null;
    durableReportCanonicalObjectSha256: string | null;
    freshlyAuthenticated: boolean;
    semanticScopeSha256: string | null;
    selectedOccurrenceCount: number;
    holdoutOccurrenceCount: number;
    emptyOccurrenceCount: number;
    sourceOnlyMatchedOccurrenceCount: number;
    requestViewMatchedOccurrenceCount: number;
    upstreamCandidateCount: number;
    upstreamAssembledBuildCount: number;
  };
  authorshipBoundary: {
    compositionAuthoredBy: "guide-factory";
    sourceAuthoredWholeCandidate: false;
    sourcePublishedWholeCandidateCount: 0;
    sourceConstellationSpecified: false;
    sourceAuthoredRequestFact: false;
    requestFactAuthoredBy: "guide-factory-explicit-fixture";
    requestFact: {
      teamRecordId: typeof TEAM_ID;
      characterId: typeof CHARACTER_ID;
      constellation: 6;
      provenance: "request";
    };
    wrapperRequestFactExcludedFromCandidateIdentity: true;
    requestFactChangesTechnicalCandidateIdentity: false;
  } | null;
  partitionBoundary: {
    selectedOccurrenceIds: string[];
    holdoutOccurrenceIds: string[];
    emptyOccurrenceIds: string[];
    selectedHoldoutEmptyDisjoint: true;
    selectedOccurrenceCount: 3;
    holdoutOccurrenceCount: 14;
    emptyOccurrenceCount: 4;
    holdoutConsumedCount: 0;
    emptyConsumedCount: 0;
  } | null;
  candidate: XiaoFfxxPartialArtifactCandidate | null;
  viewBindings: XiaoFfxxPartialArtifactViewBinding[];
  executionInputBoundary: {
    formulaPlan: "absent-not-consumed";
    rotation: "absent-not-consumed";
    damageObjective: "absent-not-consumed";
    generatorOptions: "absent-not-consumed";
    optimizerPolicy: "absent-not-consumed";
    playerInventory: "absent-not-consumed";
    energyRecovery: "excluded-deferred";
  };
  summary: {
    uniquePartialTechnicalCandidateCount: number;
    viewCandidateBindingCount: number;
    completeCandidateCount: 0;
    assembledBuildCount: 0;
    sourcePublishedWholeCandidateCount: 0;
    recommendationCount: 0;
    rankedCandidateCount: 0;
    presentAxisCount: number;
    missingAxisCount: number;
    requestFactAddedTechnicalCandidateCount: 0;
  };
  issues: Array<{ code: string; path: string; message: string }>;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type XiaoFfxxPartialArtifactCandidateContractAuthentication =
  | {
      authenticated: true;
      canonicalReport: XiaoFfxxPartialArtifactCandidateContractReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: XiaoFfxxPartialArtifactCandidateContractReport["issues"];
    };

export const XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS = [
  ...new Set([
    ...XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS,
    APPLICABLE_CLAIM_REPORT_PATH,
    "scripts/guide-factory/src/xiaoFfxxPartialArtifactCandidateContract.ts",
    "scripts/guide-factory/src/assemble-xiao-ffxx-partial-artifact-candidate-contract.ts",
  ]),
].sort(compareText);

export const XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS = [
  ...XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS,
];

export const XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "xiao-ffxx-partial-artifact-candidate-contract.json",
);

export function buildXiaoFfxxPartialArtifactCandidateContractReport(
  input: BuildXiaoFfxxPartialArtifactCandidateContractInput,
): XiaoFfxxPartialArtifactCandidateContractReport {
  let generatedFrom: GeneratedFromEntry[] = [];
  try {
    const raw = authenticateRawInputs(input);
    generatedFrom = raw.generatedFrom;
    const upstreamInput: BuildXiaoFfxxApplicableClaimProjectionContractInput = {
      repositoryInput: raw.repository,
      manualSnapshotInput: raw.manualSnapshot,
      manualIndexInput: raw.manualIndex,
      sourceRegistryInput: raw.sourceRegistry,
      xiaoDurableReportInput: raw.xiaoSourceLocalDurableReport,
      sourceFiles: XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_SOURCE_FILE_PATHS.map(
        (inputPath) => ({
          path: inputPath,
          text: requiredSourceText(raw.sourceTextByPath, inputPath),
        }),
      ),
      generatedFrom: XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS.map(
        (inputPath) => requiredGeneratedFrom(raw.generatedFrom, inputPath),
      ),
    };
    const authentication =
      authenticateXiaoFfxxApplicableClaimProjectionContract(
        raw.applicableClaimDurableReport,
        upstreamInput,
      );
    if (!authentication.authenticated) {
      throw new Error(
        `Xiao FFXX applicable-claim report failed fresh authentication (${authentication.reason}): ${authentication.issues
          .map(({ code, message }) => `${code}: ${message}`)
          .join("; ")}`,
      );
    }
    const upstream = authentication.canonicalReport;
    const upstreamScope = requireUpstreamBoundary(upstream);
    const candidate = buildCandidate(
      upstreamScope.artifactGroup,
      upstreamScope.gobletGroup,
      upstreamScope.evidenceById,
    );
    const sourceOnlyBinding = buildViewBinding(
      upstreamScope.sourceOnly,
      candidate,
      upstreamScope.evidenceById,
    );
    const requestBinding = buildViewBinding(
      upstreamScope.requestView,
      candidate,
      upstreamScope.evidenceById,
    );
    authenticateCandidateAndBindings(candidate, [
      sourceOnlyBinding,
      requestBinding,
    ]);

    const partition = upstream.partitionBoundary!;
    return {
      schemaVersion: 1,
      reportType: "xiao-ffxx-partial-artifact-candidate-contract",
      contractId: CONTRACT_ID,
      classification:
        "authenticated-guide-factory-authored-partial-technical-candidate",
      comparisonStatus: "comparable",
      publicationStatus: "withheld-unreviewed-partial-technical-candidate",
      crossAxisCompositionExecuted: true,
      partialCandidateConstructionExecuted: true,
      candidateGenerationExecuted: true,
      candidateGenerationKind: "deterministic-singleton-axis-join",
      ...CAPABILITY_BOUNDARY,
      generatedFrom,
      rawInputBoundary: {
        status: "accepted",
        exactSourceFilePathSet: true,
        exactGeneratedFromPathSet: true,
        allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
        jsonInputByteAndParsedObjectParity: true,
        sourceFileCount: XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS.length,
        generatedFromCount: XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS.length,
        jsonInputCount: 6,
      },
      upstreamBoundary: {
        status: "accepted",
        durableReportPath: APPLICABLE_CLAIM_REPORT_PATH,
        durableReportFileSha256: sha256Text(
          requiredSourceText(raw.sourceTextByPath, APPLICABLE_CLAIM_REPORT_PATH),
        ),
        durableReportCanonicalObjectSha256: hashValue(
          raw.applicableClaimDurableReport,
        ),
        freshlyAuthenticated: true,
        semanticScopeSha256: upstreamScope.semanticScopeSha256,
        selectedOccurrenceCount: partition.selectedOccurrenceCount,
        holdoutOccurrenceCount: partition.holdoutOccurrenceCount,
        emptyOccurrenceCount: partition.emptyOccurrenceCount,
        sourceOnlyMatchedOccurrenceCount:
          upstream.views.sourceOnly!.matchedOccurrenceCount,
        requestViewMatchedOccurrenceCount:
          upstream.views.exactFfxxPlusWrapperC6!.matchedOccurrenceCount,
        upstreamCandidateCount: upstream.candidateCount,
        upstreamAssembledBuildCount: upstream.assembledBuildCount,
      },
      authorshipBoundary: {
        compositionAuthoredBy: "guide-factory",
        sourceAuthoredWholeCandidate: false,
        sourcePublishedWholeCandidateCount: 0,
        sourceConstellationSpecified: false,
        sourceAuthoredRequestFact: false,
        requestFactAuthoredBy: "guide-factory-explicit-fixture",
        requestFact: {
          teamRecordId: TEAM_ID,
          characterId: CHARACTER_ID,
          constellation: 6,
          provenance: "request",
        },
        wrapperRequestFactExcludedFromCandidateIdentity: true,
        requestFactChangesTechnicalCandidateIdentity: false,
      },
      partitionBoundary: {
        selectedOccurrenceIds: [...partition.selectedOccurrenceIds],
        holdoutOccurrenceIds: [...partition.holdoutOccurrenceIds],
        emptyOccurrenceIds: [...partition.emptyOccurrenceIds],
        selectedHoldoutEmptyDisjoint: true,
        selectedOccurrenceCount: 3,
        holdoutOccurrenceCount: 14,
        emptyOccurrenceCount: 4,
        holdoutConsumedCount: 0,
        emptyConsumedCount: 0,
      },
      candidate,
      viewBindings: [sourceOnlyBinding, requestBinding],
      executionInputBoundary: {
        formulaPlan: "absent-not-consumed",
        rotation: "absent-not-consumed",
        damageObjective: "absent-not-consumed",
        generatorOptions: "absent-not-consumed",
        optimizerPolicy: "absent-not-consumed",
        playerInventory: "absent-not-consumed",
        energyRecovery: "excluded-deferred",
      },
      summary: {
        uniquePartialTechnicalCandidateCount: 1,
        viewCandidateBindingCount: 2,
        completeCandidateCount: 0,
        assembledBuildCount: 0,
        sourcePublishedWholeCandidateCount: 0,
        recommendationCount: 0,
        rankedCandidateCount: 0,
        presentAxisCount: 2,
        missingAxisCount: 4,
        requestFactAddedTechnicalCandidateCount: 0,
      },
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

export function authenticateXiaoFfxxPartialArtifactCandidateContract(
  serializedReport: XiaoFfxxPartialArtifactCandidateContractReport,
  input: BuildXiaoFfxxPartialArtifactCandidateContractInput,
): XiaoFfxxPartialArtifactCandidateContractAuthentication {
  const canonicalReport =
    buildXiaoFfxxPartialArtifactCandidateContractReport(input);
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
          code: "xiao-ffxx-partial-candidate.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Xiao FFXX partial artifact candidate contract does not match a fresh authenticated rebuild.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableXiaoFfxxPartialArtifactCandidateContract(
  report: XiaoFfxxPartialArtifactCandidateContractReport,
  input: BuildXiaoFfxxPartialArtifactCandidateContractInput,
): void {
  const authentication =
    authenticateXiaoFfxxPartialArtifactCandidateContract(report, input);
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Xiao FFXX partial artifact candidate contract (${authentication.reason}): ${authentication.issues
      .map(({ code, message }) => `${code}: ${message}`)
      .join("; ")}`,
  );
}

function authenticateRawInputs(
  input: BuildXiaoFfxxPartialArtifactCandidateContractInput,
): {
  generatedFrom: GeneratedFromEntry[];
  sourceTextByPath: Map<string, string>;
  repository: ReturnType<typeof KnowledgeRepositorySchema.parse>;
  manualSnapshot: ReturnType<typeof ManualObservationSnapshotSchema.parse>;
  manualIndex: ReturnType<typeof ManualSnapshotIndexSchema.parse>;
  sourceRegistry: ReturnType<typeof SourceRegistrySchema.parse>;
  xiaoSourceLocalDurableReport: XiaoSourceLocalConditionSliceReport;
  applicableClaimDurableReport: XiaoFfxxApplicableClaimProjectionContractReport;
} {
  const generatedFrom = canonicalGeneratedFrom(input.generatedFrom);
  if (
    stableJson(generatedFrom.map(({ path: inputPath }) => inputPath)) !==
    stableJson(XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS)
  ) {
    throw new Error("Xiao partial-candidate generatedFrom path closure drifted.");
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
      stableJson(XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS)
  ) {
    throw new Error("Xiao partial-candidate source-file path closure drifted.");
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
        `Xiao partial-candidate source-file hash drifted for ${sourceFile.path}.`,
      );
    }
    sourceTextByPath.set(sourceFile.path, sourceFile.text);
  }

  authenticateParsedJson(input.repositoryInput, sourceTextByPath, REPOSITORY_PATH);
  authenticateParsedJson(
    input.manualSnapshotInput,
    sourceTextByPath,
    XIAO_MANUAL_PATH,
  );
  authenticateParsedJson(input.manualIndexInput, sourceTextByPath, MANUAL_INDEX_PATH);
  authenticateParsedJson(
    input.sourceRegistryInput,
    sourceTextByPath,
    SOURCE_REGISTRY_PATH,
  );
  authenticateParsedJson(
    input.xiaoSourceLocalDurableReportInput,
    sourceTextByPath,
    XIAO_SOURCE_LOCAL_REPORT_PATH,
  );
  authenticateParsedJson(
    input.applicableClaimDurableReportInput,
    sourceTextByPath,
    APPLICABLE_CLAIM_REPORT_PATH,
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
    xiaoSourceLocalDurableReport:
      input.xiaoSourceLocalDurableReportInput as XiaoSourceLocalConditionSliceReport,
    applicableClaimDurableReport:
      input.applicableClaimDurableReportInput as XiaoFfxxApplicableClaimProjectionContractReport,
  };
}

function requireUpstreamBoundary(
  upstream: XiaoFfxxApplicableClaimProjectionContractReport,
): {
  sourceOnly: XiaoFfxxApplicableClaimView;
  requestView: XiaoFfxxApplicableClaimView;
  artifactGroup: XiaoFfxxPayloadIdentityGroup;
  gobletGroup: XiaoFfxxPayloadIdentityGroup;
  evidenceById: Map<string, XiaoFfxxApplicableOccurrenceEvidence>;
  semanticScopeSha256: string;
} {
  const sourceOnly = upstream.views.sourceOnly;
  const requestView = upstream.views.exactFfxxPlusWrapperC6;
  const partition = upstream.partitionBoundary;
  const authorship = upstream.authorshipBoundary;
  if (
    upstream.comparisonStatus !== "comparable" ||
    upstream.issues.length !== 0 ||
    !upstream.applicabilityProjectionExecuted ||
    !upstream.payloadIdentityDeduplicationExecuted ||
    upstream.candidateCount !== 0 ||
    upstream.assembledBuildCount !== 0 ||
    upstream.arbitraryEnglishParsingAllowed ||
    upstream.supportsSourceAuthorization ||
    upstream.supportsGuideClaims ||
    upstream.supportsTeamRecommendations ||
    upstream.supportsEquipmentRecommendations ||
    upstream.supportsBuildRecommendations ||
    upstream.supportsStatRecommendations ||
    upstream.supportsRankClaims ||
    upstream.supportsCompatibilityClaims ||
    upstream.supportsDamageClaims ||
    upstream.supportsFormulaClaims ||
    upstream.supportsRotationClaims ||
    upstream.supportsEnergyRecoveryClaims ||
    upstream.playerFacingRecommendations ||
    upstream.recommendationCompositionExecuted ||
    upstream.candidateGenerationExecuted ||
    upstream.choiceSelectionExecuted ||
    upstream.crossAxisCompositionExecuted ||
    upstream.payloadCompatibilityEvaluated ||
    upstream.generatorExecuted ||
    upstream.optimizerExecuted ||
    upstream.formulaInputsUsed ||
    upstream.damageComputationExecuted ||
    upstream.rotationComputationExecuted ||
    upstream.energyRecoveryInputsUsed ||
    upstream.energyRecoveryComputationExecuted ||
    upstream.rawInputBoundary.status !== "accepted" ||
    !upstream.rawInputBoundary.allDeclaredGeneratedFromHashesAuthenticatedFromBytes ||
    upstream.rawInputBoundary.sourceFileCount !== 17 ||
    upstream.rawInputBoundary.generatedFromCount !== 17 ||
    partition == null ||
    partition.selectedOccurrenceCount !== 3 ||
    partition.holdoutOccurrenceCount !== 14 ||
    partition.emptyOccurrenceCount !== 4 ||
    partition.holdoutConsumedCount !== 0 ||
    partition.emptyConsumedCount !== 0 ||
    !partition.selectedHoldoutEmptyDisjoint ||
    sourceOnly == null ||
    requestView == null ||
    sourceOnly.matchedOccurrenceCount !== 2 ||
    sourceOnly.unresolvedOccurrenceCount !== 1 ||
    sourceOnly.payloadGroupCount !== 2 ||
    sourceOnly.requestFactCount !== 0 ||
    requestView.matchedOccurrenceCount !== 3 ||
    requestView.unresolvedOccurrenceCount !== 0 ||
    requestView.payloadGroupCount !== 2 ||
    requestView.requestFactCount !== 1 ||
    authorship == null ||
    authorship.requestFact.teamRecordId !== TEAM_ID ||
    authorship.requestFact.characterId !== CHARACTER_ID ||
    authorship.requestFact.constellation !== 6 ||
    authorship.sourceAuthoredRequestFact ||
    stableJson(authorship.team.memberCharacterIds) !==
      stableJson(["xiao", "xianyun", "furina", "faruzan"])
  ) {
    throw new Error(
      "Authenticated Xiao applicable-claim report lost its exact zero-candidate, 3/14/4, two-view, or authorship boundary.",
    );
  }
  const selectedIds = [...partition.selectedOccurrenceIds].sort(compareText);
  const holdoutIds = [...partition.holdoutOccurrenceIds].sort(compareText);
  const emptyIds = [...partition.emptyOccurrenceIds].sort(compareText);
  if (
    stableJson(selectedIds) !==
      stableJson([...EXPECTED_OCCURRENCE_IDS].sort(compareText)) ||
    !arePairwiseDisjoint(selectedIds, holdoutIds, emptyIds)
  ) {
    throw new Error("Xiao partial-candidate partition identity drifted.");
  }
  const evidenceById = exactMap(
    upstream.occurrenceEvidence,
    ({ occurrenceId }) => occurrenceId,
    "occurrence evidence",
  );
  if (
    evidenceById.size !== 3 ||
    stableJson([...evidenceById.keys()].sort(compareText)) !==
      stableJson([...EXPECTED_OCCURRENCE_IDS].sort(compareText))
  ) {
    throw new Error("Xiao partial-candidate occurrence evidence drifted.");
  }
  const c6 = requiredMapValue(
    evidenceById,
    C6_GOBLET_OCCURRENCE_ID,
    "C6 occurrence evidence",
  );
  if (
    c6.applicabilityProvenance.sourceResolution !== "unresolved-context" ||
    c6.applicabilityProvenance.contextApplicability !==
      "applicable-under-supplied-context" ||
    c6.applicabilityProvenance.effectiveResolution !== "matched" ||
    c6.applicabilityProvenance.requestContextBindingCount !== 1
  ) {
    throw new Error(
      "Xiao C6 evidence lost its source-unresolved/request-resolved provenance.",
    );
  }
  const artifactGroup = requiredPayloadGroup(
    requestView,
    MARECHAUSSEE_PAYLOAD_SHA256,
  );
  const gobletGroup = requiredPayloadGroup(
    requestView,
    ANEMO_GOBLET_PAYLOAD_SHA256,
  );
  authenticatePayloadGroups(sourceOnly, requestView, artifactGroup, gobletGroup);

  const semanticScope = {
    contractId: upstream.contractId,
    classification: upstream.classification,
    publicationStatus: upstream.publicationStatus,
    rawInputBoundary: upstream.rawInputBoundary,
    upstreamBoundary: upstream.upstreamBoundary,
    partitionBoundary: partition,
    authorshipBoundary: authorship,
    occurrenceEvidence: upstream.occurrenceEvidence,
    views: upstream.views,
    payloadIdentityPolicy: upstream.payloadIdentityPolicy,
    summary: upstream.summary,
    capabilityBoundary: {
      arbitraryEnglishParsingAllowed: upstream.arbitraryEnglishParsingAllowed,
      supportsSourceAuthorization: upstream.supportsSourceAuthorization,
      supportsGuideClaims: upstream.supportsGuideClaims,
      supportsTeamRecommendations: upstream.supportsTeamRecommendations,
      supportsEquipmentRecommendations:
        upstream.supportsEquipmentRecommendations,
      supportsBuildRecommendations: upstream.supportsBuildRecommendations,
      supportsStatRecommendations: upstream.supportsStatRecommendations,
      supportsRankClaims: upstream.supportsRankClaims,
      supportsCompatibilityClaims: upstream.supportsCompatibilityClaims,
      supportsDamageClaims: upstream.supportsDamageClaims,
      supportsFormulaClaims: upstream.supportsFormulaClaims,
      supportsRotationClaims: upstream.supportsRotationClaims,
      supportsEnergyRecoveryClaims: upstream.supportsEnergyRecoveryClaims,
      playerFacingRecommendations: upstream.playerFacingRecommendations,
      recommendationCompositionExecuted:
        upstream.recommendationCompositionExecuted,
      candidateCount: upstream.candidateCount,
      assembledBuildCount: upstream.assembledBuildCount,
      crossAxisCompositionExecuted: upstream.crossAxisCompositionExecuted,
      candidateGenerationExecuted: upstream.candidateGenerationExecuted,
      choiceSelectionExecuted: upstream.choiceSelectionExecuted,
      payloadCompatibilityEvaluated: upstream.payloadCompatibilityEvaluated,
      generatorExecuted: upstream.generatorExecuted,
      optimizerExecuted: upstream.optimizerExecuted,
      formulaInputsUsed: upstream.formulaInputsUsed,
      damageComputationExecuted: upstream.damageComputationExecuted,
      rotationComputationExecuted: upstream.rotationComputationExecuted,
      energyRecoveryInputsUsed: upstream.energyRecoveryInputsUsed,
      energyRecoveryComputationExecuted:
        upstream.energyRecoveryComputationExecuted,
    },
  };
  return {
    sourceOnly,
    requestView,
    artifactGroup,
    gobletGroup,
    evidenceById,
    semanticScopeSha256: hashValue(semanticScope),
  };
}

function authenticatePayloadGroups(
  sourceOnly: XiaoFfxxApplicableClaimView,
  requestView: XiaoFfxxApplicableClaimView,
  artifactGroup: XiaoFfxxPayloadIdentityGroup,
  gobletGroup: XiaoFfxxPayloadIdentityGroup,
): void {
  const sourceArtifact = requiredPayloadGroup(
    sourceOnly,
    MARECHAUSSEE_PAYLOAD_SHA256,
  );
  const sourceGoblet = requiredPayloadGroup(
    sourceOnly,
    ANEMO_GOBLET_PAYLOAD_SHA256,
  );
  if (
    stableJson(artifactGroup.payload) !==
      stableJson({
        type: "artifact-group",
        artifacts: [{ type: "4pc", setId: "marechaussee_hunter" }],
      }) ||
    stableJson(gobletGroup.payload) !==
      stableJson({
        type: "main-stat",
        slot: "goblet",
        statIds: ["anemo%"],
        priority: null,
        target: null,
      }) ||
    artifactGroup.claimAxis !== "artifact-recommendation" ||
    artifactGroup.mainStatSlot !== null ||
    artifactGroup.occurrenceMultiplicity !== 1 ||
    stableJson(artifactGroup.contributingOccurrenceIds) !==
      stableJson([MARECHAUSSEE_OCCURRENCE_ID]) ||
    gobletGroup.claimAxis !== "main-stat" ||
    gobletGroup.mainStatSlot !== "goblet" ||
    gobletGroup.occurrenceMultiplicity !== 2 ||
    !gobletGroup.repeatedPayloadIdentity ||
    gobletGroup.establishesCorroboration ||
    gobletGroup.affectsRank ||
    stableJson(gobletGroup.contributingOccurrenceIds) !==
      stableJson(
        [XIANYUN_GOBLET_OCCURRENCE_ID, C6_GOBLET_OCCURRENCE_ID].sort(
          compareText,
        ),
      ) ||
    stableJson(sourceArtifact.payload) !== stableJson(artifactGroup.payload) ||
    stableJson(sourceGoblet.payload) !== stableJson(gobletGroup.payload) ||
    stableJson(sourceGoblet.contributingOccurrenceIds) !==
      stableJson([XIANYUN_GOBLET_OCCURRENCE_ID])
  ) {
    throw new Error(
      "Xiao partial-candidate expected exactly one Marechaussee Hunter singleton and one Anemo Goblet singleton in both views.",
    );
  }
}

function buildCandidate(
  artifactGroup: XiaoFfxxPayloadIdentityGroup,
  gobletGroup: XiaoFfxxPayloadIdentityGroup,
  evidenceById: ReadonlyMap<string, XiaoFfxxApplicableOccurrenceEvidence>,
): XiaoFfxxPartialArtifactCandidate {
  const artifactEvidence = requiredMapValue(
    evidenceById,
    MARECHAUSSEE_OCCURRENCE_ID,
    "artifact evidence",
  );
  const gobletEvidence = requiredMapValue(
    evidenceById,
    XIANYUN_GOBLET_OCCURRENCE_ID,
    "Goblet evidence",
  );
  const axes: XiaoFfxxPartialArtifactAxis[] = [
    missingAxis("weapon", 0),
    {
      axisId: "artifact-set",
      ordinal: 1,
      status: "present-authenticated-singleton",
      sourcePayloadSha256: artifactGroup.payloadSha256,
      sourcePayload: structuredClone(artifactGroup.payload),
      normalizedValues: [
        { type: "4pc", setId: "marechaussee_hunter" },
      ],
      sourceRecordIds: [artifactEvidence.selectedOccurrence.sourceRecordId],
    },
    missingAxis("main-stat:sands", 2),
    {
      axisId: "main-stat:goblet",
      ordinal: 3,
      status: "present-authenticated-singleton",
      sourcePayloadSha256: gobletGroup.payloadSha256,
      sourcePayload: structuredClone(gobletGroup.payload),
      normalizedValues: [{ slot: "goblet", statId: "anemo%" }],
      sourceRecordIds: [gobletEvidence.selectedOccurrence.sourceRecordId],
    },
    missingAxis("main-stat:circlet", 4),
    missingAxis("substats", 5),
  ];
  const technicalCombinationSha256 = computeTechnicalCombinationSha256(axes);
  const candidateIdentitySha256 = computeCandidateIdentitySha256(
    axes,
    technicalCombinationSha256,
  );
  return {
    candidateId: CANDIDATE_ID,
    technicalCombinationSha256,
    candidateIdentitySha256,
    authoredBy: "guide-factory",
    sourceAuthored: false,
    sourcePublishedWholeCandidate: false,
    compositionKind: "syntactic-singleton-axis-join",
    completionStatus: "partial",
    materializableAsGuideBuildRecommendation: false,
    runtimeArtifactGenerationCandidate: false,
    jointPayloadCompatibility: "not-evaluated",
    teamRecordId: TEAM_ID,
    characterId: CHARACTER_ID,
    sourceConstellation: "unspecified",
    wrapperRequestFactExcludedFromCandidateIdentity: true,
    axisVocabulary: [...AXIS_VOCABULARY],
    axes,
    presentAxisIds: ["artifact-set", "main-stat:goblet"],
    missingAxisIds: [
      "weapon",
      "main-stat:sands",
      "main-stat:circlet",
      "substats",
    ],
    completeness: {
      axisCount: 6,
      presentAxisCount: 2,
      missingAxisCount: 4,
      complete: false,
      energyRecoveryPolicy: "excluded-deferred-not-a-completeness-axis",
    },
  };
}

function missingAxis(
  axisId: XiaoFfxxPartialArtifactMissingAxis["axisId"],
  ordinal: number,
): XiaoFfxxPartialArtifactMissingAxis {
  return {
    axisId,
    ordinal,
    status: "missing-not-admitted-no-default",
    reason:
      axisId === "weapon" || axisId === "main-stat:sands"
        ? "not-present-in-authenticated-applicable-claim-projection"
        : "conditional-or-unselected-source-records-not-consumed",
  };
}

function computeTechnicalCombinationSha256(
  axes: readonly XiaoFfxxPartialArtifactAxis[],
): string {
  return hashValue(
    axes
      .filter(
        (axis): axis is XiaoFfxxPartialArtifactPresentAxis =>
          axis.status === "present-authenticated-singleton",
      )
      .map(({ axisId, sourcePayloadSha256, normalizedValues }) => ({
        axisId,
        sourcePayloadSha256,
        normalizedValues,
      })),
  );
}

function computeCandidateIdentitySha256(
  axes: readonly XiaoFfxxPartialArtifactAxis[],
  technicalCombinationSha256: string,
): string {
  return hashValue({
    contractId: CONTRACT_ID,
    teamRecordId: TEAM_ID,
    characterId: CHARACTER_ID,
    sourceConstellation: "unspecified",
    technicalCombinationSha256,
    axisPolicy: axes.map((axis) => ({
      axisId: axis.axisId,
      status: axis.status,
      sourcePayloadSha256:
        axis.status === "present-authenticated-singleton"
          ? axis.sourcePayloadSha256
          : null,
      missingReason:
        axis.status === "missing-not-admitted-no-default" ? axis.reason : null,
    })),
    wrapperRequestFactExcludedFromCandidateIdentity: true,
    energyRecoveryPolicy: "excluded-deferred-not-a-completeness-axis",
  });
}

function buildViewBinding(
  view: XiaoFfxxApplicableClaimView,
  candidate: XiaoFfxxPartialArtifactCandidate,
  evidenceById: ReadonlyMap<string, XiaoFfxxApplicableOccurrenceEvidence>,
): XiaoFfxxPartialArtifactViewBinding {
  const isRequestView = view.viewId === "exact-ffxx-plus-wrapper-c6";
  const gobletOccurrenceIds = isRequestView
    ? [XIANYUN_GOBLET_OCCURRENCE_ID, C6_GOBLET_OCCURRENCE_ID].sort(compareText)
    : [XIANYUN_GOBLET_OCCURRENCE_ID];
  const projection = {
    bindingId: isRequestView
      ? ("xiao-ffxx-plus-wrapper-c6-partial-candidate-binding" as const)
      : ("xiao-ffxx-source-only-partial-candidate-binding" as const),
    viewId: view.viewId,
    upstreamViewSha256: hashValue(view),
    candidateId: candidate.candidateId,
    technicalCombinationSha256: candidate.technicalCombinationSha256,
    candidateIdentitySha256: candidate.candidateIdentitySha256,
    matchedOccurrenceIds: [...view.matchedOccurrenceIds],
    unresolvedOccurrenceIds: [...view.unresolvedOccurrenceIds],
    requestFactCount: view.requestFactCount,
    requestFactAuthoredBy: isRequestView
      ? ("guide-factory-explicit-fixture" as const)
      : ("none" as const),
    requestFact: isRequestView
      ? ({
          teamRecordId: TEAM_ID,
          characterId: CHARACTER_ID,
          constellation: 6,
          provenance: "request",
        } as const)
      : null,
    requestFactChangesTechnicalCandidateIdentity: false as const,
    repeatedGobletPayloadEstablishesCorroboration: false as const,
    repeatedGobletPayloadAffectsRank: false as const,
    axisEvidenceBindings: [
      buildAxisEvidenceBinding(
        "artifact-set",
        MARECHAUSSEE_PAYLOAD_SHA256,
        [MARECHAUSSEE_OCCURRENCE_ID],
        evidenceById,
      ),
      buildAxisEvidenceBinding(
        "main-stat:goblet",
        ANEMO_GOBLET_PAYLOAD_SHA256,
        gobletOccurrenceIds,
        evidenceById,
      ),
    ],
  };
  return {
    ...projection,
    viewBindingSha256: hashValue(projection),
  };
}

function buildAxisEvidenceBinding(
  axisId: XiaoFfxxPartialArtifactAxisEvidenceBinding["axisId"],
  sourcePayloadSha256: string,
  occurrenceIds: readonly string[],
  evidenceById: ReadonlyMap<string, XiaoFfxxApplicableOccurrenceEvidence>,
): XiaoFfxxPartialArtifactAxisEvidenceBinding {
  return {
    axisId,
    sourcePayloadSha256,
    occurrenceIds: [...occurrenceIds],
    occurrenceEvidence: occurrenceIds.map((occurrenceId) => {
      const evidence = requiredMapValue(
        evidenceById,
        occurrenceId,
        "axis occurrence evidence",
      );
      return {
        occurrenceId,
        occurrenceEvidenceSha256: hashValue(evidence),
        selectedOccurrenceSha256: evidence.selectedOccurrenceSha256,
        sourceClaimSha256: evidence.sourceClaimSha256,
        conditionControlSha256: evidence.conditionControlSha256,
        sourceCellSha256: evidence.sourceCellSha256,
        requestProjectionSha256: evidence.requestProjectionSha256,
        sourceResolution: evidence.applicabilityProvenance.sourceResolution,
        contextApplicability:
          evidence.applicabilityProvenance.contextApplicability,
        effectiveResolution:
          evidence.applicabilityProvenance.effectiveResolution,
        requestContextBindingCount:
          evidence.applicabilityProvenance.requestContextBindingCount,
      };
    }),
  };
}

function authenticateCandidateAndBindings(
  candidate: XiaoFfxxPartialArtifactCandidate,
  bindings: readonly XiaoFfxxPartialArtifactViewBinding[],
): void {
  const artifactAxis = candidate.axes.find(
    ({ axisId }) => axisId === "artifact-set",
  );
  const gobletAxis = candidate.axes.find(
    ({ axisId }) => axisId === "main-stat:goblet",
  );
  const missingAxes = candidate.axes.filter(
    (axis): axis is XiaoFfxxPartialArtifactMissingAxis =>
      axis.status === "missing-not-admitted-no-default",
  );
  const technicalCombinationSha256 = computeTechnicalCombinationSha256(
    candidate.axes,
  );
  if (
    stableJson(candidate.axisVocabulary) !== stableJson(AXIS_VOCABULARY) ||
    candidate.axes.length !== 6 ||
    candidate.axes.some(({ ordinal }, index) => ordinal !== index) ||
    stableJson(candidate.axes.map(({ axisId }) => axisId)) !==
      stableJson(AXIS_VOCABULARY) ||
    stableJson(candidate.presentAxisIds) !==
      stableJson(["artifact-set", "main-stat:goblet"]) ||
    stableJson(candidate.missingAxisIds) !==
      stableJson([
        "weapon",
        "main-stat:sands",
        "main-stat:circlet",
        "substats",
      ]) ||
    candidate.completeness.presentAxisCount !== 2 ||
    candidate.completeness.missingAxisCount !== 4 ||
    candidate.completeness.complete ||
    technicalCombinationSha256 !== candidate.technicalCombinationSha256 ||
    computeCandidateIdentitySha256(
      candidate.axes,
      technicalCombinationSha256,
    ) !== candidate.candidateIdentitySha256 ||
    candidate.authoredBy !== "guide-factory" ||
    candidate.sourceAuthored ||
    candidate.sourcePublishedWholeCandidate ||
    candidate.sourceConstellation !== "unspecified" ||
    !candidate.wrapperRequestFactExcludedFromCandidateIdentity ||
    candidate.materializableAsGuideBuildRecommendation ||
    candidate.runtimeArtifactGenerationCandidate ||
    candidate.jointPayloadCompatibility !== "not-evaluated" ||
    artifactAxis?.status !== "present-authenticated-singleton" ||
    artifactAxis.sourcePayloadSha256 !== MARECHAUSSEE_PAYLOAD_SHA256 ||
    gobletAxis?.status !== "present-authenticated-singleton" ||
    gobletAxis.sourcePayloadSha256 !== ANEMO_GOBLET_PAYLOAD_SHA256 ||
    missingAxes.length !== 4 ||
    stableJson(
      missingAxes.map(({ axisId, reason }) => ({ axisId, reason })),
    ) !==
      stableJson([
        {
          axisId: "weapon",
          reason: "not-present-in-authenticated-applicable-claim-projection",
        },
        {
          axisId: "main-stat:sands",
          reason: "not-present-in-authenticated-applicable-claim-projection",
        },
        {
          axisId: "main-stat:circlet",
          reason: "conditional-or-unselected-source-records-not-consumed",
        },
        {
          axisId: "substats",
          reason: "conditional-or-unselected-source-records-not-consumed",
        },
      ]) ||
    bindings.length !== 2 ||
    bindings.some(
      ({ viewBindingSha256, ...bindingProjection }) =>
        viewBindingSha256 !== hashValue(bindingProjection) ||
        bindingProjection.candidateId !== candidate.candidateId ||
        bindingProjection.technicalCombinationSha256 !==
          candidate.technicalCombinationSha256 ||
        bindingProjection.candidateIdentitySha256 !==
          candidate.candidateIdentitySha256 ||
        bindingProjection.requestFactChangesTechnicalCandidateIdentity ||
        bindingProjection.repeatedGobletPayloadEstablishesCorroboration ||
        bindingProjection.repeatedGobletPayloadAffectsRank,
    )
  ) {
    throw new Error(
      "Xiao partial candidate lost its one-candidate, two-binding, two-present/four-missing boundary.",
    );
  }
  const [sourceBinding, requestBinding] = bindings;
  const requestGoblet = requestBinding?.axisEvidenceBindings.find(
    ({ axisId }) => axisId === "main-stat:goblet",
  );
  const c6 = requestGoblet?.occurrenceEvidence.find(
    ({ occurrenceId }) => occurrenceId === C6_GOBLET_OCCURRENCE_ID,
  );
  if (
    sourceBinding?.viewId !== "source-only-ffxx" ||
    sourceBinding.requestFactCount !== 0 ||
    sourceBinding.requestFactAuthoredBy !== "none" ||
    sourceBinding.requestFact !== null ||
    stableJson(sourceBinding.matchedOccurrenceIds) !==
      stableJson([MARECHAUSSEE_OCCURRENCE_ID, XIANYUN_GOBLET_OCCURRENCE_ID]) ||
    stableJson(sourceBinding.unresolvedOccurrenceIds) !==
      stableJson([C6_GOBLET_OCCURRENCE_ID]) ||
    requestBinding?.viewId !== "exact-ffxx-plus-wrapper-c6" ||
    requestBinding.requestFactCount !== 1 ||
    requestBinding.requestFactAuthoredBy !==
      "guide-factory-explicit-fixture" ||
    stableJson(requestBinding.requestFact) !==
      stableJson({
        teamRecordId: TEAM_ID,
        characterId: CHARACTER_ID,
        constellation: 6,
        provenance: "request",
      }) ||
    stableJson(requestBinding.matchedOccurrenceIds) !==
      stableJson([...EXPECTED_OCCURRENCE_IDS]) ||
    requestBinding.unresolvedOccurrenceIds.length !== 0 ||
    requestGoblet?.occurrenceEvidence.length !== 2 ||
    c6?.sourceResolution !== "unresolved-context" ||
    c6.contextApplicability !== "applicable-under-supplied-context" ||
    c6.effectiveResolution !== "matched" ||
    c6.requestContextBindingCount !== 1
  ) {
    throw new Error(
      "Xiao partial candidate lost its exact source-only/request-view provenance bindings.",
    );
  }
}

function requiredPayloadGroup(
  view: XiaoFfxxApplicableClaimView,
  payloadSha256: string,
): XiaoFfxxPayloadIdentityGroup {
  const matches = view.payloadGroups.filter(
    (group) => group.payloadSha256 === payloadSha256,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one Xiao payload group ${payloadSha256} in ${view.viewId}, found ${matches.length}.`,
    );
  }
  return matches[0]!;
}

function failedReport(
  generatedFrom: readonly GeneratedFromEntry[],
  message: string,
): XiaoFfxxPartialArtifactCandidateContractReport {
  return {
    schemaVersion: 1,
    reportType: "xiao-ffxx-partial-artifact-candidate-contract",
    contractId: CONTRACT_ID,
    classification:
      "authenticated-guide-factory-authored-partial-technical-candidate",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-unreviewed-partial-technical-candidate",
    crossAxisCompositionExecuted: false,
    partialCandidateConstructionExecuted: false,
    candidateGenerationExecuted: false,
    candidateGenerationKind: "none-failed-input",
    ...CAPABILITY_BOUNDARY,
    generatedFrom: generatedFrom.map((entry) => ({ ...entry })),
    rawInputBoundary: {
      status: "rejected",
      exactSourceFilePathSet: false,
      exactGeneratedFromPathSet: false,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: false,
      jsonInputByteAndParsedObjectParity: false,
      sourceFileCount: 0,
      generatedFromCount: generatedFrom.length,
      jsonInputCount: 0,
    },
    upstreamBoundary: {
      status: "rejected",
      durableReportPath: APPLICABLE_CLAIM_REPORT_PATH,
      durableReportFileSha256: null,
      durableReportCanonicalObjectSha256: null,
      freshlyAuthenticated: false,
      semanticScopeSha256: null,
      selectedOccurrenceCount: 0,
      holdoutOccurrenceCount: 0,
      emptyOccurrenceCount: 0,
      sourceOnlyMatchedOccurrenceCount: 0,
      requestViewMatchedOccurrenceCount: 0,
      upstreamCandidateCount: 0,
      upstreamAssembledBuildCount: 0,
    },
    authorshipBoundary: null,
    partitionBoundary: null,
    candidate: null,
    viewBindings: [],
    executionInputBoundary: {
      formulaPlan: "absent-not-consumed",
      rotation: "absent-not-consumed",
      damageObjective: "absent-not-consumed",
      generatorOptions: "absent-not-consumed",
      optimizerPolicy: "absent-not-consumed",
      playerInventory: "absent-not-consumed",
      energyRecovery: "excluded-deferred",
    },
    summary: {
      uniquePartialTechnicalCandidateCount: 0,
      viewCandidateBindingCount: 0,
      completeCandidateCount: 0,
      assembledBuildCount: 0,
      sourcePublishedWholeCandidateCount: 0,
      recommendationCount: 0,
      rankedCandidateCount: 0,
      presentAxisCount: 0,
      missingAxisCount: 0,
      requestFactAddedTechnicalCandidateCount: 0,
    },
    issues: [
      {
        code: "xiao-ffxx-partial-candidate.canonical-input",
        path: "input",
        message,
      },
    ],
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

function authenticateParsedJson(
  parsedInput: unknown,
  sourceTextByPath: ReadonlyMap<string, string>,
  sourcePath: string,
): void {
  const sourceText = sourceTextByPath.get(sourcePath);
  if (sourceText == null) {
    throw new Error(`Missing Xiao partial-candidate JSON file ${sourcePath}.`);
  }
  let parsedText: unknown;
  try {
    parsedText = JSON.parse(sourceText);
  } catch {
    throw new Error(`Xiao partial-candidate file ${sourcePath} is not JSON.`);
  }
  if (stableJson(parsedInput) !== stableJson(parsedText)) {
    throw new Error(
      `Xiao partial-candidate parsed input disagrees with source bytes for ${sourcePath}.`,
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
    throw new Error("Xiao partial-candidate generatedFrom entries are invalid.");
  }
  return canonical;
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

function requiredSourceText(
  sourceTextByPath: ReadonlyMap<string, string>,
  inputPath: string,
): string {
  const value = sourceTextByPath.get(normalizePath(inputPath));
  if (value == null) {
    throw new Error(`Missing Xiao partial-candidate source text ${inputPath}.`);
  }
  return value;
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
      throw new Error(`Duplicate Xiao partial-candidate ${label} ${rowId}.`);
    }
    result.set(rowId, row);
  }
  return result;
}

function requiredMapValue<T>(
  map: ReadonlyMap<string, T>,
  key: string,
  label: string,
): T {
  const value = map.get(key);
  if (!value) throw new Error(`Missing Xiao partial-candidate ${label} ${key}.`);
  return value;
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

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
