import path from "node:path";
import {
  isCompleteBoundedFullTeamEquipmentTechnicalComputationReport,
  requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport,
} from "./boundedFullTeamEquipmentTechnicalComputation";
import {
  isCompleteBoundedFullTeamGeneratedSheetEvidenceReport,
  requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport,
  runBoundedFullTeamGeneratedSheetEvidence,
  type BoundedFullTeamGeneratedSheetEvidenceEnvironment,
  type BoundedFullTeamGeneratedSheetEvidenceReport,
  type StableArtifactAllocationSlot,
} from "./boundedFullTeamGeneratedSheetEvidence";
import { sha256Text, stableJson } from "./io";
import {
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_RELATIVE_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
} from "./keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import {
  buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets,
  GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_INPUT_PATHS,
  requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets,
  type BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
  type GeneratedSheetKnowledgeTargetComparison,
  type GeneratedSheetTargetApplicability,
  type KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
  type KqmStatClaimKnowledgeTarget,
  type PresetBuildKnowledgeTarget,
} from "./keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets";
import { REPOSITORY_ROOT } from "./paths";
import { requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport } from "./sourceBackedEquipmentRuntimePreflight";

const SHA256 = /^[a-f0-9]{64}$/;
const EXACT_CHARACTER_IDS = ["keqing", "ineffa", "furina", "xilonen"] as const;
const EXACT_TEAM_RECORD_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example" as const;

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_ID =
  "keqing-ineffa-furina-xilonen-generated-sheet-evidence-v1";
export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-generated-sheet-evidence.json";
export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_PATH =
  path.join(
    REPOSITORY_ROOT,
    KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_RELATIVE_PATH,
  );

const SELECTED_WRAPPER_DEPENDENCY_PATHS = [
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_RELATIVE_PATH,
  "scripts/guide-factory/src/boundedFullTeamGeneratedSheetEvidence.ts",
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets.ts",
] as const;

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS = [
  ...new Set([
    ...SELECTED_WRAPPER_DEPENDENCY_PATHS,
    ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_INPUT_PATHS,
  ]),
].sort((left, right) => left.localeCompare(right));

const EXPECTED_INPUT_FILE_SHA256: Readonly<Record<string, string>> = {
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-technical-computation.json":
    "c1e62f94d50be01cb5a8b24f2b419a9e52ecafad6829320e2341322691111063",
  "scripts/guide-factory/src/boundedFullTeamGeneratedSheetEvidence.ts":
    "1413d257e0f2f1ab97dd3c2b154a2c6b8bc83f883826ff757f0a60f7f2adcbb4",
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets.ts":
    "e9243df1bceaf504dde7d844559d40b0a34ade5225e31a7ce7f9508dc6e214b5",
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsScope.ts":
    "2971bfdef09888c6e5406e24d618a07ff94024ab896da06fe3717c9b6933bf17",
  "scripts/guide-factory/src/scopedSemanticDependency.ts":
    "57e746459c94a3cbd44f462c9a7b9db420ef8a4b7ff34e24a4f02abc9f2a9619",
};

const DELIBERATELY_EXCLUDED_PRODUCER_PATHS = [
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenGeneratedSheetEvidence.ts",
  "scripts/guide-factory/src/compute-keqing-ineffa-furina-xilonen-generated-sheet-evidence.ts",
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_RELATIVE_PATH,
] as const;

const EXPECTED_SOURCE_TECHNICAL_REPORT_SHA256 =
  "c1e62f94d50be01cb5a8b24f2b419a9e52ecafad6829320e2341322691111063";
const EXPECTED_KNOWLEDGE_TARGET_CONTENT_SHA256 =
  "3607aac1eceddbf22120a9cf838f21c6442647fa9fe54dbd0459aa1ca3199c48";
const EXPECTED_GENERIC_RESULT_FINGERPRINT_SHA256 =
  "6a958c472fe28f1d4b8c6edaf0a52495309377742f46175541acbf6566233386";
const EXPECTED_GENERIC_REPORT_CONTENT_SHA256 =
  "dfb21991f2f0d8f83aa9d0896a8752c288bcf5286f2f0e767f742bbca57d5b76";
const EXPECTED_GENERIC_STABLE_FULL_REPORT_SHA256 =
  "15a6cb0a4a7abcd22fd79e525472dfb2b995d950d77101c0a6cca458a1aff5d4";
const EXPECTED_AUTHENTICATED_FULL_REPORT_SHA256 =
  "d6b8f196891ee122a9ce8267f7da7efae3e7e39076b5babf28c3d352b56e6b4a";
const EXPECTED_STATE_COUNTS: ComparisonStateCounts = {
  "listed-condition-resolved": 816,
  "listed-condition-withheld": 48,
  "listed-baseline-context-unknown": 2202,
  "not-listed-nonexhaustive": 1542,
  "no-applicable-target": 0,
};
const EXPECTED_ZERO_MATCH_TARGET_IDS = [
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:substat:2:generated-sheet-target",
] as const;

export type GeneratedSheetEvidenceHashedInput = {
  path: string;
  sha256: string;
};

export type BuildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceInput = {
  sourceTechnicalReport: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport;
  knowledgeTargetInput: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput;
  inputFiles: GeneratedSheetEvidenceHashedInput[];
};

export type KeqingIneffaFurinaXilonenGeneratedSheetEvidenceEnvironment = {
  sheetEvidenceEnvironment?: BoundedFullTeamGeneratedSheetEvidenceEnvironment;
  runGeneratedSheetEvidence: typeof runBoundedFullTeamGeneratedSheetEvidence;
};

const DEFAULT_ENVIRONMENT: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceEnvironment = {
  runGeneratedSheetEvidence: runBoundedFullTeamGeneratedSheetEvidence,
};

export type GeneratedSheetEvidenceWrapperIssue = {
  code: string;
  stage: "input" | "generation" | "comparison";
  path: string;
  message: string;
};

type ComparisonAuthority =
  | "genshintools-internal-baseline-adapter"
  | "kqm-agent-assisted-unreviewed";

type ObservableDomain = "main-stat-membership" | "positive-substat-membership";
type MainStatSlot = "sands" | "goblet" | "circlet";
type TargetLayer =
  | "genshintools-preset-baseline"
  | "kqm-keqing-stat-claims";

export type GeneratedSheetMatchingTargetComponent = {
  targetId: string;
  targetKind: "preset-build" | "kqm-stat-claim";
  targetComponentId: string;
  applicability: GeneratedSheetTargetApplicability;
  authority: ComparisonAuthority;
};

export type GeneratedSheetObservableComparison = {
  comparisonId: string;
  rowKind: "generated-observable-membership";
  relationship: `main-stat:${MainStatSlot}` | "positive-substat";
  observableDomain: ObservableDomain;
  slot: MainStatSlot | null;
  observedStatId: string;
  comparisonStatus: GeneratedSheetKnowledgeTargetComparison;
  applicableTargetLayers: TargetLayer[];
  applicableTargetIds: string[];
  applicableTargetApplicabilities: Array<{
    targetId: string;
    targetKind: "preset-build" | "kqm-stat-claim";
    applicability: GeneratedSheetTargetApplicability;
  }>;
  matchingTargetIds: string[];
  matchingTargetApplicabilities: Array<{
    targetId: string;
    targetKind: "preset-build" | "kqm-stat-claim";
    applicability: GeneratedSheetTargetApplicability;
  }>;
  matchingTargetComponents: GeneratedSheetMatchingTargetComponent[];
  winningStatusPrecedence:
    "resolved-over-withheld-over-baseline-over-unlisted-over-no-target";
  correctnessJudgmentProduced: false;
  scalarWeightProduced: false;
  rankProduced: false;
};

export type GeneratedSheetSourcePartialOrderObservation = {
  relationId: string;
  observableDomain: ObservableDomain;
  slot: MainStatSlot | null;
  targetIds: string[];
  targetApplicabilities: Array<{
    targetId: string;
    applicability: GeneratedSheetTargetApplicability;
  }>;
  authority: ComparisonAuthority;
  relation:
    | {
        kind: "preset-raw-source-band-value";
        higherRawSourceValue: number;
        lowerRawSourceValue: number;
      }
    | {
        kind: "kqm-source-authored-priority";
        higherSourceAuthoredPriority: number;
        lowerSourceAuthoredPriority: number;
      };
  higherStatIds: string[];
  lowerStatIds: string[];
  observedHigherMemberStatIds: string[];
  observedLowerMemberStatIds: string[];
  sourceOrderInterpretedAsGeneratedRank: false;
  correctnessJudgmentProduced: false;
  scalarWeightProduced: false;
  rankProduced: false;
};

export type GeneratedSheetTargetCoverageSummary = {
  targetId: string;
  targetKind: "preset-build" | "kqm-stat-claim";
  characterId: string;
  applicability: GeneratedSheetTargetApplicability;
  authority: ComparisonAuthority;
  applicableOccurrenceCount: number;
  applicableObservableCount: number;
  matchingObservableCount: number;
  matchingOccurrenceCount: number;
  matchingStatIds: string[];
  zeroGeneratedMatches: boolean;
  sourceExhaustivenessClaimed: false;
  correctnessJudgmentProduced: false;
  scalarWeightProduced: false;
  rankProduced: false;
};

export type GeneratedSheetOccurrenceComparison = {
  sequence: number;
  occurrenceId: string;
  nodeId: string;
  carryCharacterId: string;
  characterId: string;
  artifactOccurrenceId: string;
  allocationId: string;
  attachmentScope: "node-carry-character-occurrence";
  deferredEnergyEvidence: {
    sourceEntries: Array<{
      targetId: string;
      field: "sands" | "goblet" | "circlet" | "substats";
      sourceEntryIndex: number;
      statId: "er";
      rawSourceValue: number;
    }>;
    generatedMainStatSlots: Array<{
      slot: string;
      statId: "er";
    }>;
    generatedDisplayedSubstats: Array<{
      slot: string;
      statId: "er";
      value: number;
    }>;
    consumedForDeferralProvenance: true;
    usedForComparison: false;
    usedForOptimization: false;
    requirementComputed: false;
  };
  observableComparisons: GeneratedSheetObservableComparison[];
  sourcePartialOrderObservations: GeneratedSheetSourcePartialOrderObservation[];
};

type ComparisonStateCounts = Record<GeneratedSheetKnowledgeTargetComparison, number>;

export type KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport = {
  schemaVersion: 1;
  classification: "keqing-ineffa-furina-xilonen-generated-sheet-evidence";
  evidenceId: typeof KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_ID;
  validationStatus:
    | "authenticated-completed-occurrence-evidence-source-not-ready"
    | "not-authenticated";
  generatedFrom: GeneratedSheetEvidenceHashedInput[];
  issues: GeneratedSheetEvidenceWrapperIssue[];
  sourceAuthentication: {
    dependencySetClassification:
      "authenticated-declared-non-self-selected-checkpoint-inputs";
    dependencySetExhaustive: false;
    transitiveModuleGraphClaimed: false;
    transitiveRuntimeDependenciesAuthenticatedBeforeExecution: false;
    selectedInputsAuthenticatedBeforeExecution: boolean;
    postExecutionGenericOutputAuthenticationRequired: true;
    deliberatelyExcludedProducerPaths: string[];
    expectedFileCount: number;
    observedFileCount: number;
    exactPathSet: boolean;
    allByteHashesWellFormed: boolean;
    allDeclaredFileHashesMatch: boolean;
    sourceTechnicalReportPayloadSha256: string;
    sourceTechnicalReportPayloadHashMatches: boolean;
    sourceSpecificTechnicalReportAuthenticated: boolean;
    nestedGenericTechnicalReportAuthenticated: boolean;
    nestedGenericTechnicalReportComplete: boolean;
    nestedGenericPreflightAuthenticated: boolean;
    knowledgeTargetsAuthenticated: boolean;
    authentication: "accepted" | "rejected";
  };
  sourceBoundary: {
    exactTeamRecordId: typeof EXACT_TEAM_RECORD_ID;
    exactCharacterIds: string[];
    sourceReadyForGuideClaims: false;
    sourceReadyForGameplayClaims: false;
    sourceReadinessBlockerCount: 8;
    presetAuthority: "internal-baseline-adapter";
    presetTeamApplicability: "unknown";
    kqmAuthority: "agent-assisted-unreviewed-extraction";
    kqmReviewStatus: "unreviewed";
    kqmPromotionEligible: false;
    artifactRatingDbConsumed: false;
    furinaPostErInterpretationExcluded: true;
    sourcePublishedWholeCandidateCount: 0;
  };
  executionBoundary: {
    nodeCount: number;
    carryCount: number;
    characterCount: number;
    plannedGeneratorInvocationCount: number;
    observedGeneratorInvocationCount: number;
    freshRuntimeIdentityCount: number;
    generatedOccurrenceCount: number;
    genericEvidenceReportsGeneratorExecuted: boolean;
    genericEvidenceReportsGeneratorOptimizationExecuted: boolean;
    genericEvidenceReportsGeneratorDamageObjectiveEvaluated: boolean;
    deterministicEvidenceReplayable: boolean;
    wrapperExecutionAttestationClaimed: false;
    defaultCliConfiguredToExecuteDefaultRuntime: true;
    damageReplayExecuted: false;
    damageReplayCalls: 0;
    downstreamOptimizerExecuted: false;
    downstreamOptimizerCalls: 0;
    comparisonRankingExecuted: false;
    comparisonScalarWeightComputationExecuted: false;
    energyRecoveryInputsConsumedForDeferralProvenance: boolean;
    energyRecoveryValuesUsedForComparison: false;
    energyRecoveryValuesUsedForOptimization: false;
    energyRecoveryRequirementComputed: false;
  };
  comparisonBoundary: {
    vocabulary: GeneratedSheetKnowledgeTargetComparison[];
    attachmentScope: "node-carry-character-occurrence-only";
    globalSheetIdAttachmentCount: 0;
    observableDomains: [
      "main-stat-membership",
      "positive-substat-membership",
      "source-partial-order-observation",
    ];
    correctnessJudgmentProduced: false;
    scalarWeightProduced: false;
    rankProduced: false;
    recommendationProduced: false;
    occurrenceCount: number;
    comparisonRowCount: number;
    stateCounts: ComparisonStateCounts;
    relationshipCounts: Record<string, ComparisonStateCounts>;
    characterCounts: Record<string, ComparisonStateCounts>;
    attachmentCounts: {
      presetOnly: number;
      kqmOnly: number;
      kqmAndPreset: number;
      none: number;
    };
    matchingLayerStatusCounts: Record<string, number>;
    nodeStateVectorSha256: string;
    everyNodeComparisonRowCount: number;
    targetCoverageCount: number;
    zeroMatchTargetIds: string[];
    targetMatchEdgeCount: number;
    kqmResolvedTargetMatchEdgeCount: number;
    kqmWithheldTargetMatchEdgeCount: number;
    presetTargetMatchEdgeCount: number;
    sourcePartialOrderObservationCount: number;
  };
  capabilities: {
    guideClaims: false;
    recommendationClaims: false;
    rankClaims: false;
    scalarWeightClaims: false;
    damageClaims: false;
    gameplayClaims: false;
    optimalityClaims: false;
    energyRecoveryClaims: false;
  };
  guideProduced: false;
  recommendationProduced: false;
  rankProduced: false;
  scalarWeightProduced: false;
  supportsGuideClaims: false;
  supportsRecommendationClaims: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsGameplayClaims: false;
  supportsOptimalityClaims: false;
  supportsEnergyRecoveryClaims: false;
  promotionEligible: false;
  sourceTechnicalReport: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport | null;
  knowledgeTargets: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport | null;
  generatedSheetEvidence: BoundedFullTeamGeneratedSheetEvidenceReport | null;
  occurrenceComparisons: GeneratedSheetOccurrenceComparison[];
  targetCoverage: GeneratedSheetTargetCoverageSummary[];
  cautions: string[];
  prohibitedInterpretations: string[];
};

export async function buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
  rawInput: BuildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceInput,
  environment: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceEnvironment =
    DEFAULT_ENVIRONMENT,
): Promise<KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport> {
  const input = structuredClone(rawInput);
  const generatedFrom = input.inputFiles
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const issues: GeneratedSheetEvidenceWrapperIssue[] = [];
  const knowledgeTargets =
    buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
      input.knowledgeTargetInput,
    );
  const authentication = authenticateInputs(
    input.sourceTechnicalReport,
    knowledgeTargets,
    generatedFrom,
    issues,
  );

  // This gate stays before bootstrap or any generator construction.
  if (authentication.authentication !== "accepted") {
    return emptyReport(generatedFrom, issues, authentication);
  }

  const nestedTechnical = input.sourceTechnicalReport.technicalComputation;
  const nestedPreflight =
    input.sourceTechnicalReport.sourcePreflight?.runtimePreflight;
  if (!nestedTechnical || !nestedPreflight) {
    throw new Error("Authenticated CP38 report unexpectedly lacks nested reports.");
  }
  const generatedSheetEvidence = await environment.runGeneratedSheetEvidence(
    {
      technicalReport: nestedTechnical,
      preflight: nestedPreflight,
      generatedFrom,
    },
    environment.sheetEvidenceEnvironment,
  );
  if (!authenticateExpectedGeneratedSheetEvidence(generatedSheetEvidence)) {
    addIssue(
      issues,
      "generation.unexpected_generic_evidence",
      "generation",
      "generatedSheetEvidence",
      "The generated-sheet core did not close over the exact authenticated 36x4 capture domain.",
    );
  }
  if (issues.length > 0) {
    return emptyReport(
      generatedFrom,
      issues,
      authentication,
      generatedSheetEvidence,
    );
  }

  let occurrenceComparisons: GeneratedSheetOccurrenceComparison[] = [];
  try {
    occurrenceComparisons = buildOccurrenceComparisons(
      input.sourceTechnicalReport,
      generatedSheetEvidence,
      knowledgeTargets,
    );
  } catch (error) {
    addIssue(
      issues,
      "comparison.occurrence_projection_failed",
      "comparison",
      "occurrenceComparisons",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (issues.length > 0) {
    return emptyReport(
      generatedFrom,
      issues,
      authentication,
      generatedSheetEvidence,
    );
  }
  const targetCoverage = buildTargetCoverage(
    knowledgeTargets.targets,
    occurrenceComparisons,
  );
  return completeReport(
    generatedFrom,
    authentication,
    input.sourceTechnicalReport,
    knowledgeTargets,
    generatedSheetEvidence,
    occurrenceComparisons,
    targetCoverage,
  );
}

export function requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
  report: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
): void {
  let nestedGuardsPass = false;
  try {
    if (
      !report.sourceTechnicalReport?.technicalComputation ||
      !report.sourceTechnicalReport.sourcePreflight?.runtimePreflight ||
      !report.knowledgeTargets ||
      !report.generatedSheetEvidence
    ) {
      throw new Error("Nested reports are absent.");
    }
    requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
      report.sourceTechnicalReport,
    );
    requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
      report.sourceTechnicalReport.technicalComputation,
    );
    requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
      report.sourceTechnicalReport.sourcePreflight.runtimePreflight,
    );
    requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
      report.knowledgeTargets,
    );
    requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(
      report.generatedSheetEvidence,
    );
    nestedGuardsPass = true;
  } catch {
    nestedGuardsPass = false;
  }
  const exactComparisons = comparisonSemanticsHold(report);
  const semanticClosure =
    report.validationStatus ===
      "authenticated-completed-occurrence-evidence-source-not-ready" &&
    report.issues.length === 0 &&
    report.sourceAuthentication.authentication === "accepted" &&
    report.sourceAuthentication.dependencySetClassification ===
      "authenticated-declared-non-self-selected-checkpoint-inputs" &&
    !report.sourceAuthentication.dependencySetExhaustive &&
    !report.sourceAuthentication.transitiveModuleGraphClaimed &&
    !report.sourceAuthentication
      .transitiveRuntimeDependenciesAuthenticatedBeforeExecution &&
    report.sourceAuthentication.selectedInputsAuthenticatedBeforeExecution &&
    report.sourceAuthentication.postExecutionGenericOutputAuthenticationRequired &&
    exactEqual(
      report.sourceAuthentication.deliberatelyExcludedProducerPaths,
      DELIBERATELY_EXCLUDED_PRODUCER_PATHS,
    ) &&
    report.sourceAuthentication.expectedFileCount ===
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS.length &&
    report.sourceAuthentication.observedFileCount ===
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS.length &&
    report.sourceAuthentication.exactPathSet &&
    report.sourceAuthentication.allByteHashesWellFormed &&
    report.sourceAuthentication.allDeclaredFileHashesMatch &&
    report.sourceAuthentication.sourceTechnicalReportPayloadHashMatches &&
    report.sourceAuthentication.sourceSpecificTechnicalReportAuthenticated &&
    report.sourceAuthentication.nestedGenericTechnicalReportAuthenticated &&
    report.sourceAuthentication.nestedGenericTechnicalReportComplete &&
    report.sourceAuthentication.nestedGenericPreflightAuthenticated &&
    report.sourceAuthentication.knowledgeTargetsAuthenticated &&
    report.sourceBoundary.exactTeamRecordId === EXACT_TEAM_RECORD_ID &&
    exactEqual(report.sourceBoundary.exactCharacterIds, EXACT_CHARACTER_IDS) &&
    !report.sourceBoundary.sourceReadyForGuideClaims &&
    !report.sourceBoundary.sourceReadyForGameplayClaims &&
    report.sourceBoundary.sourceReadinessBlockerCount === 8 &&
    report.sourceBoundary.presetAuthority === "internal-baseline-adapter" &&
    report.sourceBoundary.presetTeamApplicability === "unknown" &&
    report.sourceBoundary.kqmAuthority ===
      "agent-assisted-unreviewed-extraction" &&
    report.sourceBoundary.kqmReviewStatus === "unreviewed" &&
    !report.sourceBoundary.kqmPromotionEligible &&
    !report.sourceBoundary.artifactRatingDbConsumed &&
    report.sourceBoundary.furinaPostErInterpretationExcluded &&
    report.sourceBoundary.sourcePublishedWholeCandidateCount === 0 &&
    report.executionBoundary.nodeCount === 36 &&
    report.executionBoundary.carryCount === 4 &&
    report.executionBoundary.characterCount === 4 &&
    report.executionBoundary.plannedGeneratorInvocationCount === 144 &&
    report.executionBoundary.observedGeneratorInvocationCount === 144 &&
    report.executionBoundary.freshRuntimeIdentityCount === 144 &&
    report.executionBoundary.generatedOccurrenceCount === 576 &&
    report.executionBoundary.genericEvidenceReportsGeneratorExecuted &&
    report.executionBoundary
      .genericEvidenceReportsGeneratorOptimizationExecuted &&
    report.executionBoundary
      .genericEvidenceReportsGeneratorDamageObjectiveEvaluated &&
    report.executionBoundary.deterministicEvidenceReplayable &&
    !report.executionBoundary.wrapperExecutionAttestationClaimed &&
    report.executionBoundary.defaultCliConfiguredToExecuteDefaultRuntime &&
    !report.executionBoundary.damageReplayExecuted &&
    report.executionBoundary.damageReplayCalls === 0 &&
    !report.executionBoundary.downstreamOptimizerExecuted &&
    report.executionBoundary.downstreamOptimizerCalls === 0 &&
    !report.executionBoundary.comparisonRankingExecuted &&
    !report.executionBoundary.comparisonScalarWeightComputationExecuted &&
    report.executionBoundary.energyRecoveryInputsConsumedForDeferralProvenance &&
    !report.executionBoundary.energyRecoveryValuesUsedForComparison &&
    !report.executionBoundary.energyRecoveryValuesUsedForOptimization &&
    !report.executionBoundary.energyRecoveryRequirementComputed &&
    exactEqual(
      report.comparisonBoundary.vocabulary,
      GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY,
    ) &&
    report.comparisonBoundary.attachmentScope ===
      "node-carry-character-occurrence-only" &&
    report.comparisonBoundary.globalSheetIdAttachmentCount === 0 &&
    !report.comparisonBoundary.correctnessJudgmentProduced &&
    !report.comparisonBoundary.scalarWeightProduced &&
    !report.comparisonBoundary.rankProduced &&
    !report.comparisonBoundary.recommendationProduced &&
    exactEqual(report.capabilities, fixedCapabilities()) &&
    !report.guideProduced &&
    !report.recommendationProduced &&
    !report.rankProduced &&
    !report.scalarWeightProduced &&
    !report.supportsGuideClaims &&
    !report.supportsRecommendationClaims &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsGameplayClaims &&
    !report.supportsOptimalityClaims &&
    !report.supportsEnergyRecoveryClaims &&
    !report.promotionEligible &&
    nestedGuardsPass &&
    exactComparisons &&
    authenticateExpectedGeneratedSheetEvidence(report.generatedSheetEvidence!);
  if (
    !semanticClosure ||
    sha256Text(stableJson(report)) !== EXPECTED_AUTHENTICATED_FULL_REPORT_SHA256
  ) {
    throw new Error(
      "Refusing unauthenticated or mutated Keqing/Ineffa/Furina/Xilonen generated-sheet evidence report.",
    );
  }
}

function authenticateInputs(
  sourceTechnicalReport: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  knowledgeTargets: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
  generatedFrom: GeneratedSheetEvidenceHashedInput[],
  issues: GeneratedSheetEvidenceWrapperIssue[],
): KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["sourceAuthentication"] {
  const expectedPaths = [
    ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS,
  ];
  const observedPaths = generatedFrom.map(({ path: inputPath }) => inputPath);
  const exactPathSet = exactEqual(observedPaths, expectedPaths);
  const allByteHashesWellFormed = generatedFrom.every(({ sha256 }) =>
    SHA256.test(sha256),
  );
  const allDeclaredFileHashesMatch =
    exactPathSet &&
    generatedFrom.every(
      ({ path: inputPath, sha256 }) =>
        EXPECTED_INPUT_FILE_SHA256[inputPath] === sha256,
    );
  const sourceTechnicalReportPayloadSha256 = hashPayload(sourceTechnicalReport);
  const sourceTechnicalReportPayloadHashMatches =
    sourceTechnicalReportPayloadSha256 === EXPECTED_SOURCE_TECHNICAL_REPORT_SHA256;
  let sourceSpecificTechnicalReportAuthenticated = false;
  let nestedGenericTechnicalReportAuthenticated = false;
  let nestedGenericTechnicalReportComplete = false;
  let nestedGenericPreflightAuthenticated = false;
  let knowledgeTargetsAuthenticated = false;
  try {
    requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
      sourceTechnicalReport,
    );
    sourceSpecificTechnicalReportAuthenticated = true;
  } catch {
    addIssue(
      issues,
      "input.source_technical_report_unauthenticated",
      "input",
      "sourceTechnicalReport",
      "The committed CP38 source-specific report failed its full guard.",
    );
  }
  try {
    if (!sourceTechnicalReport.technicalComputation) {
      throw new Error("Nested technical report missing.");
    }
    requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
      sourceTechnicalReport.technicalComputation,
    );
    nestedGenericTechnicalReportAuthenticated = true;
    nestedGenericTechnicalReportComplete =
      isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(
        sourceTechnicalReport.technicalComputation,
      );
  } catch {
    addIssue(
      issues,
      "input.nested_technical_report_unauthenticated",
      "input",
      "sourceTechnicalReport.technicalComputation",
      "The nested generic CP38 report failed authentication.",
    );
  }
  try {
    const preflight = sourceTechnicalReport.sourcePreflight?.runtimePreflight;
    if (!preflight) throw new Error("Nested preflight missing.");
    requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(preflight);
    nestedGenericPreflightAuthenticated = true;
  } catch {
    addIssue(
      issues,
      "input.nested_preflight_unauthenticated",
      "input",
      "sourceTechnicalReport.sourcePreflight.runtimePreflight",
      "The nested generic materialization preflight failed authentication.",
    );
  }
  try {
    requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
      knowledgeTargets,
    );
    knowledgeTargetsAuthenticated =
      knowledgeTargets.contentSha256 ===
      EXPECTED_KNOWLEDGE_TARGET_CONTENT_SHA256;
  } catch {
    addIssue(
      issues,
      "input.knowledge_targets_unauthenticated",
      "input",
      "knowledgeTargets",
      "The exact source target projection failed authentication.",
    );
  }
  if (!exactPathSet) {
    addIssue(
      issues,
      "input.path_set_mismatch",
      "input",
      "inputFiles",
      "The declared non-self checkpoint input path set changed.",
    );
  }
  if (!allByteHashesWellFormed || !allDeclaredFileHashesMatch) {
    addIssue(
      issues,
      "input.byte_hash_mismatch",
      "input",
      "inputFiles",
      "At least one declared checkpoint input byte hash is malformed or unexpected.",
    );
  }
  if (!sourceTechnicalReportPayloadHashMatches) {
    addIssue(
      issues,
      "input.source_technical_report_payload_mismatch",
      "input",
      "sourceTechnicalReport",
      "The supplied parsed CP38 report payload differs from the committed report; the selected file byte hash is authenticated separately.",
    );
  }
  if (!knowledgeTargetsAuthenticated) {
    addIssue(
      issues,
      "input.knowledge_target_digest_mismatch",
      "input",
      "knowledgeTargets.contentSha256",
      "The source target content digest differs from the expected committed projection.",
    );
  }
  const accepted =
    issues.length === 0 &&
    exactPathSet &&
    allByteHashesWellFormed &&
    allDeclaredFileHashesMatch &&
    sourceTechnicalReportPayloadHashMatches &&
    sourceSpecificTechnicalReportAuthenticated &&
    nestedGenericTechnicalReportAuthenticated &&
    nestedGenericTechnicalReportComplete &&
    nestedGenericPreflightAuthenticated &&
    knowledgeTargetsAuthenticated;
  return {
    dependencySetClassification:
      "authenticated-declared-non-self-selected-checkpoint-inputs",
    dependencySetExhaustive: false,
    transitiveModuleGraphClaimed: false,
    transitiveRuntimeDependenciesAuthenticatedBeforeExecution: false,
    selectedInputsAuthenticatedBeforeExecution: accepted,
    postExecutionGenericOutputAuthenticationRequired: true,
    deliberatelyExcludedProducerPaths: [...DELIBERATELY_EXCLUDED_PRODUCER_PATHS],
    expectedFileCount: expectedPaths.length,
    observedFileCount: generatedFrom.length,
    exactPathSet,
    allByteHashesWellFormed,
    allDeclaredFileHashesMatch,
    sourceTechnicalReportPayloadSha256,
    sourceTechnicalReportPayloadHashMatches,
    sourceSpecificTechnicalReportAuthenticated,
    nestedGenericTechnicalReportAuthenticated,
    nestedGenericTechnicalReportComplete,
    nestedGenericPreflightAuthenticated,
    knowledgeTargetsAuthenticated,
    authentication: accepted ? "accepted" : "rejected",
  };
}

function authenticateExpectedGeneratedSheetEvidence(
  report: BoundedFullTeamGeneratedSheetEvidenceReport,
): boolean {
  try {
    requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report);
  } catch {
    return false;
  }
  return (
    isCompleteBoundedFullTeamGeneratedSheetEvidenceReport(report) &&
    report.validationStatus === "completed-generated-sheet-evidence" &&
    report.comparisonStatus === "comparable" &&
    report.inputBoundary.nodeCount === 36 &&
    report.inputBoundary.plannedGeneratorInvocations === "144" &&
    exactEqual(report.inputBoundary.teamCharacterIds, EXACT_CHARACTER_IDS) &&
    exactEqual(report.inputBoundary.carryCharacterIds, EXACT_CHARACTER_IDS) &&
    report.execution.observedGeneratorInvocations === 144 &&
    report.execution.generatorOptimizationMode ===
      "damage-objective-driven-artifact-generator" &&
    report.execution.freshRuntimeIdentityCount === 144 &&
    report.execution.capturedGeneratorResultCount === 144 &&
    report.execution.observedCharacterSheetAllocationCount === 576 &&
    report.generatorExecuted &&
    report.generatorOptimizationExecuted === true &&
    report.generatorDamageObjectiveEvaluated === true &&
    !report.damageReplayExecuted &&
    report.damageReplayCalls === 0 &&
    !report.downstreamOptimizerExecuted &&
    report.downstreamOptimizerCalls === 0 &&
    !report.energyRecoveryInterpreted &&
    report.energyRecoveryCalls === 0 &&
    report.relationshipSummary.sheetCount === 21 &&
    report.relationshipSummary.allocationCount === 23 &&
    report.relationshipSummary.occurrenceCount === 576 &&
    report.relationshipSummary.sheetIdsWithMultipleAllocations === 2 &&
    report.relationshipSummary.maximumAllocationsPerSheet === 2 &&
    report.authentication.resultFingerprintSha256 ===
      EXPECTED_GENERIC_RESULT_FINGERPRINT_SHA256 &&
    report.authentication.reportContentSha256 ===
      EXPECTED_GENERIC_REPORT_CONTENT_SHA256 &&
    hashPayload(report) === EXPECTED_GENERIC_STABLE_FULL_REPORT_SHA256
  );
}

function buildOccurrenceComparisons(
  sourceTechnicalReport: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  sheetEvidence: BoundedFullTeamGeneratedSheetEvidenceReport,
  targetsReport: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
): GeneratedSheetOccurrenceComparison[] {
  const preflight = sourceTechnicalReport.sourcePreflight?.runtimePreflight;
  if (!preflight) throw new Error("Nested preflight is absent.");
  const allocationById = new Map(
    sheetEvidence.artifactAllocationCatalog.map((allocation) => [
      allocation.allocationId,
      allocation,
    ]),
  );
  const occurrences: GeneratedSheetOccurrenceComparison[] = [];
  let sequence = 0;
  for (const [nodeIndex, node] of sheetEvidence.nodes.entries()) {
    const preflightNode = preflight.nodes[nodeIndex];
    if (!preflightNode || preflightNode.nodeId !== node.nodeId) {
      throw new Error(`Preflight node parity failed at sequence ${nodeIndex}.`);
    }
    const resolvedEquipmentEntries = preflightNode.resolvedEquipment;
    if (!resolvedEquipmentEntries) {
      throw new Error(`Preflight node ${node.nodeId} has no resolved equipment.`);
    }
    for (const run of node.generatorRuns) {
      if (run.outcome !== "captured") {
        throw new Error(`${node.nodeId}/${run.carryCharacterId} was not captured.`);
      }
      for (const characterId of EXACT_CHARACTER_IDS) {
        const observation = run.sheetsByCharacter[characterId];
        const allocation = observation
          ? allocationById.get(observation.allocationId)
          : undefined;
        const resolvedEquipment = resolvedEquipmentEntries.find(
          (entry) => entry.characterId === characterId,
        );
        if (!observation || !allocation || !resolvedEquipment) {
          throw new Error(
            `Occurrence evidence is incomplete for ${node.nodeId}/${run.carryCharacterId}/${characterId}.`,
          );
        }
        const occurrenceIdentity = {
          nodeId: node.nodeId,
          carryCharacterId: run.carryCharacterId,
          characterId,
        };
        const occurrenceId = hashPayload(occurrenceIdentity);
        const applicablePresetTargets = targetsReport.targets.filter(
          (target): target is PresetBuildKnowledgeTarget =>
            target.kind === "preset-build" &&
            target.characterId === characterId &&
            target.activeArtifactOccurrenceId ===
              resolvedEquipment.artifact.occurrenceId,
        );
        const applicableKqmTargets = targetsReport.targets.filter(
          (target): target is KqmStatClaimKnowledgeTarget =>
            target.kind === "kqm-stat-claim" &&
            target.characterId === characterId,
        );
        const comparisonEvidence = buildComparisonRows(
          occurrenceId,
          allocation.artifacts,
          applicablePresetTargets,
          applicableKqmTargets,
        );
        occurrences.push({
          sequence,
          occurrenceId,
          ...occurrenceIdentity,
          artifactOccurrenceId: resolvedEquipment.artifact.occurrenceId,
          allocationId: allocation.allocationId,
          attachmentScope: "node-carry-character-occurrence",
          deferredEnergyEvidence: buildDeferredEnergyEvidence(
            allocation.artifacts,
            applicablePresetTargets,
          ),
          observableComparisons: comparisonEvidence.observableComparisons,
          sourcePartialOrderObservations:
            comparisonEvidence.sourcePartialOrderObservations,
        });
        sequence += 1;
      }
    }
  }
  if (
    occurrences.length !== 576 ||
    new Set(occurrences.map(({ occurrenceId }) => occurrenceId)).size !== 576
  ) {
    throw new Error(
      `Expected 576 unique node/carry/character occurrences; found ${occurrences.length}.`,
    );
  }
  return occurrences;
}

function buildComparisonRows(
  occurrenceId: string,
  artifacts: StableArtifactAllocationSlot[],
  presetTargets: PresetBuildKnowledgeTarget[],
  kqmTargets: KqmStatClaimKnowledgeTarget[],
): {
  observableComparisons: GeneratedSheetObservableComparison[];
  sourcePartialOrderObservations: GeneratedSheetSourcePartialOrderObservation[];
} {
  const mainStatBySlot = new Map(
    artifacts.map(({ slot, mainStatKey }) => [slot, mainStatKey]),
  );
  const positiveSubstatIds = uniqueSorted(
    artifacts.flatMap(({ displayedSubstats }) =>
      displayedSubstats
        .filter(({ key }) => key !== "er")
        .map(({ key }) => key),
    ),
  );
  if (
    positiveSubstatIds.length !== 5 ||
    [...mainStatBySlot.values()].some((statId) => statId === "er")
  ) {
    throw new Error(
      "The authenticated comparison oracle requires three non-ER main stats and five unique non-ER displayed substat IDs per occurrence.",
    );
  }
  const applicableTargets = [...presetTargets, ...kqmTargets];
  const observables = [
    ...(["sands", "goblet", "circlet"] as const).map((slot) => ({
      relationship: `main-stat:${slot}` as const,
      observableDomain: "main-stat-membership" as const,
      slot,
      observedStatId: requireString(mainStatBySlot.get(slot), slot),
    })),
    ...positiveSubstatIds.map((observedStatId) => ({
      relationship: "positive-substat" as const,
      observableDomain: "positive-substat-membership" as const,
      slot: null,
      observedStatId,
    })),
  ];
  const observableComparisons = observables.map((observable) => {
    const relevantTargets = applicableTargets
      .filter((target) => targetIsRelevantToObservable(target, observable))
      .sort((left, right) => left.targetId.localeCompare(right.targetId));
    const matchingTargetComponents = relevantTargets
      .flatMap((target) => matchingComponents(target, observable))
      .sort((left, right) =>
        left.targetId.localeCompare(right.targetId) ||
        left.targetComponentId.localeCompare(right.targetComponentId),
      );
    const applicableTargetApplicabilities = relevantTargets.map((target) => ({
      targetId: target.targetId,
      targetKind: target.kind,
      applicability: target.applicability,
    }));
    const matchingTargetApplicabilities = uniqueTargetApplicabilities(
      matchingTargetComponents,
    );
    const rowWithoutId: Omit<GeneratedSheetObservableComparison, "comparisonId"> = {
      rowKind: "generated-observable-membership",
      ...observable,
      comparisonStatus: winningComparisonStatus(
        matchingTargetApplicabilities,
        relevantTargets.length,
      ),
      applicableTargetLayers: [
        ...(presetTargets.length > 0
          ? (["genshintools-preset-baseline"] as const)
          : []),
        ...(kqmTargets.length > 0
          ? (["kqm-keqing-stat-claims"] as const)
          : []),
      ],
      applicableTargetIds: applicableTargetApplicabilities.map(
        ({ targetId }) => targetId,
      ),
      applicableTargetApplicabilities,
      matchingTargetIds: matchingTargetApplicabilities.map(
        ({ targetId }) => targetId,
      ),
      matchingTargetApplicabilities,
      matchingTargetComponents,
      winningStatusPrecedence:
        "resolved-over-withheld-over-baseline-over-unlisted-over-no-target",
      correctnessJudgmentProduced: false,
      scalarWeightProduced: false,
      rankProduced: false,
    };
    return {
      ...rowWithoutId,
      comparisonId: hashPayload({ occurrenceId, row: rowWithoutId }),
    };
  });
  const partialOrders = [
    ...buildPresetPartialOrderRows(positiveSubstatIds, presetTargets),
    ...buildKqmPartialOrderRows(mainStatBySlot, positiveSubstatIds, kqmTargets),
  ];
  return {
    observableComparisons,
    sourcePartialOrderObservations: partialOrders.map((row) => ({
      ...row,
      relationId: hashPayload({ occurrenceId, relation: row }),
    })),
  };
}

function buildPresetPartialOrderRows(
  positiveSubstatIds: string[],
  targets: PresetBuildKnowledgeTarget[],
): Array<Omit<GeneratedSheetSourcePartialOrderObservation, "relationId">> {
  const rows: Array<
    Omit<GeneratedSheetSourcePartialOrderObservation, "relationId">
  > = [];
  for (const target of targets) {
    for (let index = 0; index + 1 < target.substatBands.length; index += 1) {
      const higher = target.substatBands[index];
      const lower = target.substatBands[index + 1];
      if (!higher || !lower || higher.rawSourceValue <= lower.rawSourceValue) {
        continue;
      }
      rows.push({
        observableDomain: "positive-substat-membership",
        slot: null,
        targetIds: [target.targetId],
        targetApplicabilities: [
          { targetId: target.targetId, applicability: target.applicability },
        ],
        authority: "genshintools-internal-baseline-adapter",
        relation: {
          kind: "preset-raw-source-band-value",
          higherRawSourceValue: higher.rawSourceValue,
          lowerRawSourceValue: lower.rawSourceValue,
        },
        higherStatIds: [...higher.statIds],
        lowerStatIds: [...lower.statIds],
        observedHigherMemberStatIds: intersection(
          positiveSubstatIds,
          higher.statIds,
        ),
        observedLowerMemberStatIds: intersection(
          positiveSubstatIds,
          lower.statIds,
        ),
        sourceOrderInterpretedAsGeneratedRank: false,
        correctnessJudgmentProduced: false,
        scalarWeightProduced: false,
        rankProduced: false,
      });
    }
  }
  return rows;
}

function buildKqmPartialOrderRows(
  mainStatBySlot: Map<string, string>,
  positiveSubstatIds: string[],
  targets: KqmStatClaimKnowledgeTarget[],
): Array<Omit<GeneratedSheetSourcePartialOrderObservation, "relationId">> {
  const domains = new Map<string, KqmStatClaimKnowledgeTarget[]>();
  for (const target of targets) {
    if (target.claim.sourceAuthoredPriority === null) continue;
    const domainKey = [
      target.source.recommendationId,
      target.claim.kind,
      target.claim.slot ?? "none",
    ].join("|");
    const domain = domains.get(domainKey) ?? [];
    domain.push(target);
    domains.set(domainKey, domain);
  }
  const rows: Array<
    Omit<GeneratedSheetSourcePartialOrderObservation, "relationId">
  > = [];
  for (const domain of domains.values()) {
    const priorities = uniqueSortedNumbers(
      domain.flatMap(({ claim }) =>
        claim.sourceAuthoredPriority === null
          ? []
          : [claim.sourceAuthoredPriority],
      ),
    );
    for (let index = 0; index + 1 < priorities.length; index += 1) {
      const higherPriority = priorities[index];
      const lowerPriority = priorities[index + 1];
      if (higherPriority === undefined || lowerPriority === undefined) continue;
      const higherTargets = domain.filter(
        ({ claim }) => claim.sourceAuthoredPriority === higherPriority,
      );
      const lowerTargets = domain.filter(
        ({ claim }) => claim.sourceAuthoredPriority === lowerPriority,
      );
      const higherStatIds = uniqueSorted(
        higherTargets.flatMap(({ claim }) => claim.statIds),
      );
      const lowerStatIds = uniqueSorted(
        lowerTargets.flatMap(({ claim }) => claim.statIds),
      );
      const sample = higherTargets[0] ?? lowerTargets[0];
      if (!sample) continue;
      const observedStatIds =
        sample.claim.kind === "main-stat" && sample.claim.slot
          ? nonErMainStat(mainStatBySlot.get(sample.claim.slot))
          : positiveSubstatIds;
      rows.push({
        authority: "kqm-agent-assisted-unreviewed",
        observableDomain:
          sample.claim.kind === "main-stat"
            ? "main-stat-membership"
            : "positive-substat-membership",
        slot: sample.claim.slot,
        targetIds: [...higherTargets, ...lowerTargets].map(
          ({ targetId }) => targetId,
        ),
        targetApplicabilities: [...higherTargets, ...lowerTargets].map(
          ({ targetId, applicability }) => ({ targetId, applicability }),
        ),
        relation: {
          kind: "kqm-source-authored-priority",
          higherSourceAuthoredPriority: higherPriority,
          lowerSourceAuthoredPriority: lowerPriority,
        },
        higherStatIds,
        lowerStatIds,
        observedHigherMemberStatIds: intersection(
          observedStatIds,
          higherStatIds,
        ),
        observedLowerMemberStatIds: intersection(
          observedStatIds,
          lowerStatIds,
        ),
        sourceOrderInterpretedAsGeneratedRank: false,
        correctnessJudgmentProduced: false,
        scalarWeightProduced: false,
        rankProduced: false,
      });
    }
  }
  return rows;
}

type ObservableSeed = Pick<
  GeneratedSheetObservableComparison,
  "observableDomain" | "slot" | "observedStatId" | "relationship"
>;

function matchingComponents(
  target: PresetBuildKnowledgeTarget | KqmStatClaimKnowledgeTarget,
  observable: ObservableSeed,
): GeneratedSheetMatchingTargetComponent[] {
  if (target.kind === "preset-build") {
    if (observable.observableDomain === "main-stat-membership" && observable.slot) {
      return target.mainStats[observable.slot].flatMap((group) =>
        group.statIds.includes(observable.observedStatId)
          ? [
              {
                targetId: target.targetId,
                targetKind: target.kind,
                targetComponentId: `main-stat:${observable.slot}:source-entry:${group.sourceEntryIndex}`,
                applicability: target.applicability,
                authority: "genshintools-internal-baseline-adapter" as const,
              },
            ]
          : [],
      );
    }
    if (observable.observableDomain === "positive-substat-membership") {
      return target.substatBands.flatMap((band) =>
        band.statIds.includes(observable.observedStatId)
          ? [
              {
                targetId: target.targetId,
                targetKind: target.kind,
                targetComponentId: `substat-band:${band.sourceBandIndex}`,
                applicability: target.applicability,
                authority: "genshintools-internal-baseline-adapter" as const,
              },
            ]
          : [],
      );
    }
    return [];
  }
  const claim = target.claim;
  const domainMatches =
    (claim.kind === "main-stat" &&
      observable.observableDomain === "main-stat-membership" &&
      claim.slot === observable.slot) ||
    (claim.kind === "substat" &&
      observable.observableDomain === "positive-substat-membership");
  return domainMatches && claim.statIds.includes(observable.observedStatId)
    ? [
        {
          targetId: target.targetId,
          targetKind: target.kind,
          targetComponentId: `source-entry:${claim.sourceEntryIndex}`,
          applicability: target.applicability,
          authority: "kqm-agent-assisted-unreviewed",
        },
      ]
    : [];
}

function targetIsRelevantToObservable(
  target: PresetBuildKnowledgeTarget | KqmStatClaimKnowledgeTarget,
  observable: ObservableSeed,
): boolean {
  if (target.kind === "preset-build") return true;
  return target.claim.kind === "main-stat"
    ? observable.observableDomain === "main-stat-membership" &&
        target.claim.slot === observable.slot
    : observable.observableDomain === "positive-substat-membership";
}

function uniqueTargetApplicabilities(
  components: GeneratedSheetMatchingTargetComponent[],
): Array<{
  targetId: string;
  targetKind: "preset-build" | "kqm-stat-claim";
  applicability: GeneratedSheetTargetApplicability;
}> {
  const byTargetId = new Map<
    string,
    {
      targetId: string;
      targetKind: "preset-build" | "kqm-stat-claim";
      applicability: GeneratedSheetTargetApplicability;
    }
  >();
  for (const { targetId, targetKind, applicability } of components) {
    byTargetId.set(targetId, { targetId, targetKind, applicability });
  }
  return [...byTargetId.values()].sort((left, right) =>
    left.targetId.localeCompare(right.targetId),
  );
}

function winningComparisonStatus(
  matchingTargets: Array<{
    targetId: string;
    targetKind: "preset-build" | "kqm-stat-claim";
    applicability: GeneratedSheetTargetApplicability;
  }>,
  applicableTargetCount: number,
): GeneratedSheetKnowledgeTargetComparison {
  if (
    matchingTargets.some(
      ({ applicability }) => applicability === "exact-team-resolved",
    )
  ) {
    return "listed-condition-resolved";
  }
  if (
    matchingTargets.some(
      ({ applicability }) => applicability === "condition-withheld",
    )
  ) {
    return "listed-condition-withheld";
  }
  if (
    matchingTargets.some(
      ({ applicability }) =>
        applicability === "baseline-team-applicability-unknown",
    )
  ) {
    return "listed-baseline-context-unknown";
  }
  return applicableTargetCount > 0
    ? "not-listed-nonexhaustive"
    : "no-applicable-target";
}

function buildTargetCoverage(
  targets: Array<PresetBuildKnowledgeTarget | KqmStatClaimKnowledgeTarget>,
  occurrences: GeneratedSheetOccurrenceComparison[],
): GeneratedSheetTargetCoverageSummary[] {
  return [...targets]
    .sort((left, right) => left.targetId.localeCompare(right.targetId))
    .map((target) => {
      const applicableOccurrences = occurrences.filter((occurrence) =>
        occurrence.observableComparisons.some((row) =>
          row.applicableTargetIds.includes(target.targetId),
        ),
      );
      const applicableRows = applicableOccurrences.flatMap((occurrence) =>
        occurrence.observableComparisons.filter((row) =>
          row.applicableTargetIds.includes(target.targetId),
        ),
      );
      const matchingRows = applicableRows.filter((row) =>
        row.matchingTargetIds.includes(target.targetId),
      );
      const matchingOccurrenceCount = applicableOccurrences.filter(
        (occurrence) =>
          occurrence.observableComparisons.some((row) =>
            row.matchingTargetIds.includes(target.targetId),
          ),
      ).length;
      return {
        targetId: target.targetId,
        targetKind: target.kind,
        characterId: target.characterId,
        applicability: target.applicability,
        authority:
          target.kind === "preset-build"
            ? "genshintools-internal-baseline-adapter"
            : "kqm-agent-assisted-unreviewed",
        applicableOccurrenceCount: applicableOccurrences.length,
        applicableObservableCount: applicableRows.length,
        matchingObservableCount: matchingRows.length,
        matchingOccurrenceCount,
        matchingStatIds: uniqueSorted(
          matchingRows.map(({ observedStatId }) => observedStatId),
        ),
        zeroGeneratedMatches: matchingRows.length === 0,
        sourceExhaustivenessClaimed: false,
        correctnessJudgmentProduced: false,
        scalarWeightProduced: false,
        rankProduced: false,
      };
    });
}

function buildDeferredEnergyEvidence(
  artifacts: StableArtifactAllocationSlot[],
  presetTargets: PresetBuildKnowledgeTarget[],
): GeneratedSheetOccurrenceComparison["deferredEnergyEvidence"] {
  return {
    sourceEntries: presetTargets.flatMap((target) =>
      target.deferredEnergyEntries.map((entry) => ({
        targetId: target.targetId,
        ...entry,
      })),
    ),
    generatedMainStatSlots: artifacts.flatMap(({ slot, mainStatKey }) =>
      mainStatKey === "er" ? [{ slot, statId: "er" as const }] : [],
    ),
    generatedDisplayedSubstats: artifacts.flatMap(({ slot, displayedSubstats }) =>
      displayedSubstats.flatMap(({ key, value }) =>
        key === "er" ? [{ slot, statId: "er" as const, value }] : [],
      ),
    ),
    consumedForDeferralProvenance: true,
    usedForComparison: false,
    usedForOptimization: false,
    requirementComputed: false,
  };
}

function completeReport(
  generatedFrom: GeneratedSheetEvidenceHashedInput[],
  sourceAuthentication: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["sourceAuthentication"],
  sourceTechnicalReport: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  knowledgeTargets: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
  generatedSheetEvidence: BoundedFullTeamGeneratedSheetEvidenceReport,
  occurrenceComparisons: GeneratedSheetOccurrenceComparison[],
  targetCoverage: GeneratedSheetTargetCoverageSummary[],
): KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport {
  const comparisonBoundary = summarizeComparisons(
    occurrenceComparisons,
    targetCoverage,
  );
  return {
    ...reportHeader(generatedFrom, sourceAuthentication),
    validationStatus:
      "authenticated-completed-occurrence-evidence-source-not-ready",
    issues: [],
    sourceBoundary: deriveSourceBoundary(
      sourceTechnicalReport,
      knowledgeTargets,
    ),
    executionBoundary: {
      nodeCount: 36,
      carryCount: 4,
      characterCount: 4,
      plannedGeneratorInvocationCount: 144,
      observedGeneratorInvocationCount:
        generatedSheetEvidence.execution.observedGeneratorInvocations,
      freshRuntimeIdentityCount:
        generatedSheetEvidence.execution.freshRuntimeIdentityCount,
      generatedOccurrenceCount: occurrenceComparisons.length,
      genericEvidenceReportsGeneratorExecuted:
        generatedSheetEvidence.generatorExecuted,
      genericEvidenceReportsGeneratorOptimizationExecuted:
        generatedSheetEvidence.generatorOptimizationExecuted === true,
      genericEvidenceReportsGeneratorDamageObjectiveEvaluated:
        generatedSheetEvidence.generatorDamageObjectiveEvaluated === true,
      deterministicEvidenceReplayable: true,
      wrapperExecutionAttestationClaimed: false,
      defaultCliConfiguredToExecuteDefaultRuntime: true,
      damageReplayExecuted: false,
      damageReplayCalls: 0,
      downstreamOptimizerExecuted: false,
      downstreamOptimizerCalls: 0,
      comparisonRankingExecuted: false,
      comparisonScalarWeightComputationExecuted: false,
      energyRecoveryInputsConsumedForDeferralProvenance: true,
      energyRecoveryValuesUsedForComparison: false,
      energyRecoveryValuesUsedForOptimization: false,
      energyRecoveryRequirementComputed: false,
    },
    comparisonBoundary,
    sourceTechnicalReport,
    knowledgeTargets,
    generatedSheetEvidence,
    occurrenceComparisons,
    targetCoverage,
  };
}

function emptyReport(
  generatedFrom: GeneratedSheetEvidenceHashedInput[],
  issues: GeneratedSheetEvidenceWrapperIssue[],
  sourceAuthentication: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["sourceAuthentication"],
  generatedSheetEvidence: BoundedFullTeamGeneratedSheetEvidenceReport | null = null,
): KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport {
  return {
    ...reportHeader(generatedFrom, sourceAuthentication),
    validationStatus: "not-authenticated",
    issues,
    sourceBoundary: fixedSourceBoundary(),
    executionBoundary: {
      nodeCount: 0,
      carryCount: 0,
      characterCount: 0,
      plannedGeneratorInvocationCount: 0,
      observedGeneratorInvocationCount:
        generatedSheetEvidence?.execution.observedGeneratorInvocations ?? 0,
      freshRuntimeIdentityCount:
        generatedSheetEvidence?.execution.freshRuntimeIdentityCount ?? 0,
      generatedOccurrenceCount: 0,
      genericEvidenceReportsGeneratorExecuted:
        generatedSheetEvidence?.generatorExecuted ?? false,
      genericEvidenceReportsGeneratorOptimizationExecuted:
        generatedSheetEvidence?.generatorOptimizationExecuted === true,
      genericEvidenceReportsGeneratorDamageObjectiveEvaluated:
        generatedSheetEvidence?.generatorDamageObjectiveEvaluated === true,
      deterministicEvidenceReplayable: false,
      wrapperExecutionAttestationClaimed: false,
      defaultCliConfiguredToExecuteDefaultRuntime: true,
      damageReplayExecuted: false,
      damageReplayCalls: 0,
      downstreamOptimizerExecuted: false,
      downstreamOptimizerCalls: 0,
      comparisonRankingExecuted: false,
      comparisonScalarWeightComputationExecuted: false,
      energyRecoveryInputsConsumedForDeferralProvenance: false,
      energyRecoveryValuesUsedForComparison: false,
      energyRecoveryValuesUsedForOptimization: false,
      energyRecoveryRequirementComputed: false,
    },
    comparisonBoundary: summarizeComparisons([], []),
    sourceTechnicalReport: null,
    knowledgeTargets: null,
    generatedSheetEvidence,
    occurrenceComparisons: [],
    targetCoverage: [],
  };
}

function reportHeader(
  generatedFrom: GeneratedSheetEvidenceHashedInput[],
  sourceAuthentication: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["sourceAuthentication"],
): Pick<
  KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
  | "schemaVersion"
  | "classification"
  | "evidenceId"
  | "generatedFrom"
  | "sourceAuthentication"
  | "capabilities"
  | "guideProduced"
  | "recommendationProduced"
  | "rankProduced"
  | "scalarWeightProduced"
  | "supportsGuideClaims"
  | "supportsRecommendationClaims"
  | "supportsRankClaims"
  | "supportsDamageClaims"
  | "supportsGameplayClaims"
  | "supportsOptimalityClaims"
  | "supportsEnergyRecoveryClaims"
  | "promotionEligible"
  | "cautions"
  | "prohibitedInterpretations"
> {
  return {
    schemaVersion: 1,
    classification:
      "keqing-ineffa-furina-xilonen-generated-sheet-evidence",
    evidenceId: KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_ID,
    generatedFrom,
    sourceAuthentication,
    capabilities: fixedCapabilities(),
    guideProduced: false,
    recommendationProduced: false,
    rankProduced: false,
    scalarWeightProduced: false,
    supportsGuideClaims: false,
    supportsRecommendationClaims: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsGameplayClaims: false,
    supportsOptimalityClaims: false,
    supportsEnergyRecoveryClaims: false,
    promotionEligible: false,
    cautions: fixedCautions(),
    prohibitedInterpretations: fixedProhibitedInterpretations(),
  };
}

function fixedSourceBoundary(): KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["sourceBoundary"] {
  return {
    exactTeamRecordId: EXACT_TEAM_RECORD_ID,
    exactCharacterIds: [...EXACT_CHARACTER_IDS],
    sourceReadyForGuideClaims: false,
    sourceReadyForGameplayClaims: false,
    sourceReadinessBlockerCount: 8,
    presetAuthority: "internal-baseline-adapter",
    presetTeamApplicability: "unknown",
    kqmAuthority: "agent-assisted-unreviewed-extraction",
    kqmReviewStatus: "unreviewed",
    kqmPromotionEligible: false,
    artifactRatingDbConsumed: false,
    furinaPostErInterpretationExcluded: true,
    sourcePublishedWholeCandidateCount: 0,
  };
}

function deriveSourceBoundary(
  sourceTechnicalReport: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  knowledgeTargets: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
): KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["sourceBoundary"] {
  const presetTargets = knowledgeTargets.targets.filter(
    (target) => target.kind === "preset-build",
  );
  const kqmTargets = knowledgeTargets.targets.filter(
    (target) => target.kind === "kqm-stat-claim",
  );
  const exactPresetAuthority = presetTargets.every(
    ({ sourceAuthority, applicability }) =>
      sourceAuthority.kind === "internal-baseline-adapter" &&
      applicability === "baseline-team-applicability-unknown",
  );
  const exactKqmAuthority = kqmTargets.every(
    ({ sourceReviewState }) =>
      sourceReviewState.kind ===
        "external-agent-assisted-unreviewed-extraction" &&
      sourceReviewState.extractionMethod === "agent-assisted" &&
      sourceReviewState.reviewStatus === "unreviewed" &&
      !sourceReviewState.promotionEligible,
  );
  if (
    !exactPresetAuthority ||
    !exactKqmAuthority ||
    knowledgeTargets.exclusions.furinaPostErSubstats === null
  ) {
    throw new Error(
      "Authenticated knowledge targets unexpectedly lost their exact source boundary.",
    );
  }
  return {
    exactTeamRecordId: knowledgeTargets.exactTeam.teamRecordId,
    exactCharacterIds: [...knowledgeTargets.exactTeam.characterIds],
    sourceReadyForGuideClaims: knowledgeTargets.supportsGuideClaims,
    sourceReadyForGameplayClaims: knowledgeTargets.supportsGameplayClaims,
    sourceReadinessBlockerCount:
      sourceTechnicalReport.sourceBoundary.sourceReadinessBlockerCount,
    presetAuthority: "internal-baseline-adapter",
    presetTeamApplicability: "unknown",
    kqmAuthority: "agent-assisted-unreviewed-extraction",
    kqmReviewStatus: "unreviewed",
    kqmPromotionEligible: false,
    artifactRatingDbConsumed:
      knowledgeTargets.projectionBoundary.artifactRatingDbConsumed,
    furinaPostErInterpretationExcluded:
      knowledgeTargets.projectionBoundary.furinaPostErInterpretationExcluded,
    sourcePublishedWholeCandidateCount:
      sourceTechnicalReport.sourceBoundary.sourcePublishedWholeCandidateCount,
  };
}

function fixedCapabilities(): KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["capabilities"] {
  return {
    guideClaims: false,
    recommendationClaims: false,
    rankClaims: false,
    scalarWeightClaims: false,
    damageClaims: false,
    gameplayClaims: false,
    optimalityClaims: false,
    energyRecoveryClaims: false,
  };
}

function fixedCautions(): string[] {
  return [
    "The nested generic evidence reports generator captures using the existing damage-objective-driven artifact optimization. The default CLI reruns that runtime, but the deterministic report is replayable evidence and is not a non-replayable execution attestation.",
    "Five selected checkpoint inputs are authenticated before execution: the bounded CP38 report plus four implementation files. The growing knowledge carriers are authenticated through CP39's selected semantic scope instead of whole-file hashes. This is not an exhaustive transitive generator, StatSheet, or runtime dependency closure; exact generic result and full-output digests authenticate the observed evidence after execution.",
    "This wrapper performs no separate damage replay or downstream optimizer call.",
    "Every target observation is attached to one node/carry/character occurrence. No comparison is attached to a global generated sheet identity.",
    "Membership and source partial-order rows are observations only. Presence or absence is not a correctness judgment, score, weight, rank, recommendation, or guide claim.",
    "GenshinTools preset targets retain unknown exact-team applicability. KQM targets retain agent-assisted, unreviewed candidate authority and their exact resolved or withheld conditions.",
    "Not-listed is explicitly non-exhaustive and is not disagreement. No-applicable-target records a missing comparison target, not a negative gameplay claim.",
    "ER source and generated values are retained only for deferral provenance. They are excluded from comparison, optimization interpretation, and requirement computation.",
    "The source objective remains unreviewed with eight readiness blockers. Generated evidence does not make the team, equipment, formula translation, or rotation gameplay-valid.",
  ];
}

function fixedProhibitedInterpretations(): string[] {
  return [
    "guide",
    "recommendation",
    "correctness-pass-fail",
    "rank",
    "scalar-weight",
    "damage-claim",
    "gameplay-claim",
    "optimality",
    "energy-requirement",
    "global-sheet-target-comparison",
    "non-replayable-execution-attestation",
    "exhaustive-runtime-dependency-authentication",
  ];
}

function summarizeComparisons(
  occurrences: GeneratedSheetOccurrenceComparison[],
  targetCoverage: GeneratedSheetTargetCoverageSummary[],
): KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["comparisonBoundary"] {
  const rows = occurrences.flatMap(
    ({ observableComparisons }) => observableComparisons,
  );
  const stateCounts = countStates(rows);
  const relationshipCounts = Object.fromEntries(
    [
      "main-stat:sands",
      "main-stat:goblet",
      "main-stat:circlet",
      "positive-substat",
    ].map((relationship) => [
      relationship,
      countStates(rows.filter((row) => row.relationship === relationship)),
    ]),
  );
  const characterCounts = Object.fromEntries(
    EXACT_CHARACTER_IDS.map((characterId) => [
      characterId,
      countStates(
        occurrences
          .filter((occurrence) => occurrence.characterId === characterId)
          .flatMap(({ observableComparisons }) => observableComparisons),
      ),
    ]),
  );
  const attachmentCounts = {
    presetOnly: rows.filter(
      ({ applicableTargetLayers }) =>
        exactEqual(applicableTargetLayers, ["genshintools-preset-baseline"]),
    ).length,
    kqmOnly: rows.filter(
      ({ applicableTargetLayers }) =>
        exactEqual(applicableTargetLayers, ["kqm-keqing-stat-claims"]),
    ).length,
    kqmAndPreset: rows.filter(
      ({ applicableTargetLayers }) => applicableTargetLayers.length === 2,
    ).length,
    none: rows.filter(
      ({ applicableTargetLayers }) => applicableTargetLayers.length === 0,
    ).length,
  };
  const matchingLayerStatusCounts: Record<string, number> = {};
  for (const row of rows) {
    const matchingKinds = new Set(
      row.matchingTargetApplicabilities.map(({ targetKind }) => targetKind),
    );
    const bucket =
      matchingKinds.has("kqm-stat-claim") &&
      matchingKinds.has("preset-build")
        ? "kqmAndPreset"
        : matchingKinds.has("kqm-stat-claim")
          ? "kqmOnly"
          : matchingKinds.has("preset-build")
            ? "presetOnly"
            : "none";
    const key = `${bucket}|${row.comparisonStatus}`;
    matchingLayerStatusCounts[key] =
      (matchingLayerStatusCounts[key] ?? 0) + 1;
  }
  const nodeVectors = uniqueSorted(occurrences.map(({ nodeId }) => nodeId)).map(
    (nodeId) => {
      const nodeRows = occurrences
        .filter((occurrence) => occurrence.nodeId === nodeId)
        .flatMap(({ observableComparisons }) => observableComparisons);
      return { nodeId, stateCounts: countStates(nodeRows) };
    },
  );
  return {
    vocabulary: [...GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY],
    attachmentScope: "node-carry-character-occurrence-only",
    globalSheetIdAttachmentCount: 0,
    observableDomains: [
      "main-stat-membership",
      "positive-substat-membership",
      "source-partial-order-observation",
    ],
    correctnessJudgmentProduced: false,
    scalarWeightProduced: false,
    rankProduced: false,
    recommendationProduced: false,
    occurrenceCount: occurrences.length,
    comparisonRowCount: rows.length,
    stateCounts,
    relationshipCounts,
    characterCounts,
    attachmentCounts,
    matchingLayerStatusCounts,
    nodeStateVectorSha256: hashPayload(nodeVectors),
    everyNodeComparisonRowCount:
      occurrences.length > 0 &&
      nodeVectors.every(({ nodeId }) =>
        occurrences
          .filter((occurrence) => occurrence.nodeId === nodeId)
          .reduce(
            (count, occurrence) =>
              count + occurrence.observableComparisons.length,
            0,
          ) === 128,
      )
        ? 128
        : 0,
    targetCoverageCount: targetCoverage.length,
    zeroMatchTargetIds: targetCoverage
      .filter(({ zeroGeneratedMatches }) => zeroGeneratedMatches)
      .map(({ targetId }) => targetId),
    targetMatchEdgeCount: targetCoverage.reduce(
      (count, target) => count + target.matchingObservableCount,
      0,
    ),
    kqmResolvedTargetMatchEdgeCount: targetCoverage
      .filter(
        ({ targetKind, applicability }) =>
          targetKind === "kqm-stat-claim" &&
          applicability === "exact-team-resolved",
      )
      .reduce((count, target) => count + target.matchingObservableCount, 0),
    kqmWithheldTargetMatchEdgeCount: targetCoverage
      .filter(
        ({ targetKind, applicability }) =>
          targetKind === "kqm-stat-claim" &&
          applicability === "condition-withheld",
      )
      .reduce((count, target) => count + target.matchingObservableCount, 0),
    presetTargetMatchEdgeCount: targetCoverage
      .filter(({ targetKind }) => targetKind === "preset-build")
      .reduce((count, target) => count + target.matchingObservableCount, 0),
    sourcePartialOrderObservationCount: occurrences.reduce(
      (count, occurrence) =>
        count + occurrence.sourcePartialOrderObservations.length,
      0,
    ),
  };
}

function countStates(
  rows: GeneratedSheetObservableComparison[],
): ComparisonStateCounts {
  return Object.fromEntries(
    GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY.map((status) => [
      status,
      rows.filter(({ comparisonStatus }) => comparisonStatus === status).length,
    ]),
  ) as ComparisonStateCounts;
}

function comparisonSemanticsHold(
  report: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
): boolean {
  if (
    report.occurrenceComparisons.length !== 576 ||
    new Set(
      report.occurrenceComparisons.map(({ occurrenceId }) => occurrenceId),
    ).size !== 576 ||
    report.occurrenceComparisons.some(
      (occurrence, sequence) =>
        occurrence.sequence !== sequence ||
        occurrence.attachmentScope !== "node-carry-character-occurrence" ||
        "sheetId" in occurrence ||
        !SHA256.test(occurrence.occurrenceId) ||
        !SHA256.test(occurrence.allocationId) ||
        !occurrence.deferredEnergyEvidence.consumedForDeferralProvenance ||
        occurrence.deferredEnergyEvidence.usedForComparison ||
        occurrence.deferredEnergyEvidence.usedForOptimization ||
        occurrence.deferredEnergyEvidence.requirementComputed
    )
  ) {
    return false;
  }
  const rows = report.occurrenceComparisons.flatMap(
    ({ observableComparisons }) => observableComparisons,
  );
  const comparisonIds = rows.map(({ comparisonId }) => comparisonId);
  const relations = report.occurrenceComparisons.flatMap(
    ({ sourcePartialOrderObservations }) => sourcePartialOrderObservations,
  );
  const exactCoverage =
    report.knowledgeTargets !== null &&
    exactEqual(
      report.targetCoverage,
      buildTargetCoverage(
        report.knowledgeTargets.targets,
        report.occurrenceComparisons,
      ),
    );
  if (
    rows.length !== 4608 ||
    new Set(comparisonIds).size !== 4608 ||
    report.occurrenceComparisons.some(
      (occurrence) =>
        occurrence.observableComparisons.length !== 8 ||
        occurrence.observableComparisons.filter(
          ({ observableDomain }) => observableDomain === "main-stat-membership",
        ).length !== 3 ||
        occurrence.observableComparisons.filter(
          ({ observableDomain }) =>
            observableDomain === "positive-substat-membership",
        ).length !== 5
    ) ||
    rows.some(
      (row) =>
        !GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY.includes(
          row.comparisonStatus,
        ) ||
        !SHA256.test(row.comparisonId) ||
        row.correctnessJudgmentProduced ||
        row.scalarWeightProduced ||
        row.rankProduced ||
        row.rowKind !== "generated-observable-membership" ||
        row.winningStatusPrecedence !==
          "resolved-over-withheld-over-baseline-over-unlisted-over-no-target" ||
        row.matchingTargetIds.length !==
          row.matchingTargetApplicabilities.length ||
        row.matchingTargetIds.some(
          (targetId, index) =>
            row.matchingTargetApplicabilities[index]?.targetId !== targetId,
        ) ||
        row.applicableTargetIds.length !==
          row.applicableTargetApplicabilities.length ||
        row.applicableTargetIds.some(
          (targetId, index) =>
            row.applicableTargetApplicabilities[index]?.targetId !== targetId,
        ) ||
        !exactEqual(row.matchingTargetIds, uniqueSorted(row.matchingTargetIds)) ||
        !exactEqual(row.applicableTargetIds, uniqueSorted(row.applicableTargetIds)) ||
        row.matchingTargetIds.some(
          (targetId) => !row.applicableTargetIds.includes(targetId),
        ) ||
        row.comparisonStatus !==
          winningComparisonStatus(
            row.matchingTargetApplicabilities,
            row.applicableTargetIds.length,
          ) ||
        row.observedStatId === "er" ||
        "sheetId" in row
    ) ||
    relations.some(
      (relation) =>
        !SHA256.test(relation.relationId) ||
        relation.sourceOrderInterpretedAsGeneratedRank ||
        relation.correctnessJudgmentProduced ||
        relation.scalarWeightProduced ||
        relation.rankProduced ||
        "sheetId" in relation
    ) ||
    !exactCoverage ||
    report.targetCoverage.length !== 17 ||
    new Set(report.targetCoverage.map(({ targetId }) => targetId)).size !== 17 ||
    report.targetCoverage.some(
      (target) =>
        target.sourceExhaustivenessClaimed ||
        target.correctnessJudgmentProduced ||
        target.scalarWeightProduced ||
        target.rankProduced ||
        (target.matchingObservableCount === 0) !== target.zeroGeneratedMatches
    ) ||
    stableJson({
      occurrenceComparisons: report.occurrenceComparisons,
      targetCoverage: report.targetCoverage,
    }).includes('"sheetId"') ||
    !exactEqual(report.comparisonBoundary.stateCounts, EXPECTED_STATE_COUNTS) ||
    !exactEqual(report.comparisonBoundary.relationshipCounts, {
      "main-stat:sands": {
        "listed-condition-resolved": 144,
        "listed-condition-withheld": 0,
        "listed-baseline-context-unknown": 360,
        "not-listed-nonexhaustive": 72,
        "no-applicable-target": 0,
      },
      "main-stat:goblet": {
        "listed-condition-resolved": 144,
        "listed-condition-withheld": 0,
        "listed-baseline-context-unknown": 222,
        "not-listed-nonexhaustive": 210,
        "no-applicable-target": 0,
      },
      "main-stat:circlet": {
        "listed-condition-resolved": 96,
        "listed-condition-withheld": 48,
        "listed-baseline-context-unknown": 324,
        "not-listed-nonexhaustive": 108,
        "no-applicable-target": 0,
      },
      "positive-substat": {
        "listed-condition-resolved": 432,
        "listed-condition-withheld": 0,
        "listed-baseline-context-unknown": 1296,
        "not-listed-nonexhaustive": 1152,
        "no-applicable-target": 0,
      },
    }) ||
    !exactEqual(report.comparisonBoundary.characterCounts, {
      keqing: {
        "listed-condition-resolved": 816,
        "listed-condition-withheld": 48,
        "listed-baseline-context-unknown": 0,
        "not-listed-nonexhaustive": 288,
        "no-applicable-target": 0,
      },
      ineffa: {
        "listed-condition-resolved": 0,
        "listed-condition-withheld": 0,
        "listed-baseline-context-unknown": 822,
        "not-listed-nonexhaustive": 330,
        "no-applicable-target": 0,
      },
      furina: {
        "listed-condition-resolved": 0,
        "listed-condition-withheld": 0,
        "listed-baseline-context-unknown": 696,
        "not-listed-nonexhaustive": 456,
        "no-applicable-target": 0,
      },
      xilonen: {
        "listed-condition-resolved": 0,
        "listed-condition-withheld": 0,
        "listed-baseline-context-unknown": 684,
        "not-listed-nonexhaustive": 468,
        "no-applicable-target": 0,
      },
    }) ||
    !exactEqual(report.comparisonBoundary.attachmentCounts, {
      presetOnly: 3456,
      kqmOnly: 576,
      kqmAndPreset: 576,
      none: 0,
    }) ||
    !exactEqual(report.comparisonBoundary.matchingLayerStatusCounts, {
      "kqmAndPreset|listed-condition-resolved": 336,
      "kqmAndPreset|listed-condition-withheld": 24,
      "kqmOnly|listed-condition-resolved": 480,
      "kqmOnly|listed-condition-withheld": 24,
      "none|not-listed-nonexhaustive": 1542,
      "presetOnly|listed-baseline-context-unknown": 2202,
    }) ||
    !exactEqual(report.comparisonBoundary.zeroMatchTargetIds, [
      ...EXPECTED_ZERO_MATCH_TARGET_IDS,
    ]) ||
    report.comparisonBoundary.comparisonRowCount !== 4608 ||
    report.comparisonBoundary.everyNodeComparisonRowCount !== 128 ||
    report.comparisonBoundary.nodeStateVectorSha256 !==
      "de3f7f737ba8a9b5618e129fb84a98bf61856de49217235fafdc2a3d9d611b87" ||
    report.comparisonBoundary.targetCoverageCount !== 17 ||
    report.comparisonBoundary.targetMatchEdgeCount !== 3858 ||
    report.comparisonBoundary.kqmResolvedTargetMatchEdgeCount !== 1056 ||
    report.comparisonBoundary.kqmWithheldTargetMatchEdgeCount !== 240 ||
    report.comparisonBoundary.presetTargetMatchEdgeCount !== 2562 ||
    !exactEqual(
      report.comparisonBoundary,
      summarizeComparisons(report.occurrenceComparisons, report.targetCoverage),
    )
  ) {
    return false;
  }
  return true;
}

function comparisonStatusForTarget(
  target: KqmStatClaimKnowledgeTarget,
): "listed-condition-resolved" | "listed-condition-withheld" {
  return target.applicability === "exact-team-resolved"
    ? "listed-condition-resolved"
    : "listed-condition-withheld";
}

function nonErMainStat(statId: string | undefined): string[] {
  return statId && statId !== "er" ? [statId] : [];
}

function requireString(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing generated observable for ${label}.`);
  return value;
}

function intersection(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return uniqueSorted(left.filter((value) => rightSet.has(value)));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueSortedNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function hashPayload(value: unknown): string {
  return sha256Text(stableJson(value));
}

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function addIssue(
  issues: GeneratedSheetEvidenceWrapperIssue[],
  code: string,
  stage: GeneratedSheetEvidenceWrapperIssue["stage"],
  issuePath: string,
  message: string,
): void {
  issues.push({ code, stage, path: issuePath, message });
}
