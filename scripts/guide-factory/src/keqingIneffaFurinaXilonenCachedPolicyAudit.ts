import path from "node:path";
import {
  runCachedBestImprovementCoordinateDescent,
  runCachedDeclaredOrderFirstImprovementCoordinateDescent,
  runCachedOneShotBestNeighborPass,
  selectCachedTableBestComparableReference,
  type BoundedLatticeNodeTable,
  type CachedCoordinateDescentTrace,
  type CachedDeclaredDimensionCandidateOrder,
  type CachedDeclaredOrderFirstImprovementTrace,
  type CachedOneShotBestNeighborPassTrace,
  type CachedTableBestReference,
  type TechnicalObjectiveTolerance,
} from "./boundedLatticePolicy";
import { sha256Text, stableJson } from "./io";
import {
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
} from "./keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import {
  requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
  type KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
} from "./keqingIneffaFurinaXilonenGeneratedSheetEvidence";
import { REPOSITORY_ROOT } from "./paths";

const SHA256 = /^[a-f0-9]{64}$/;
const EXACT_CHARACTER_IDS = ["keqing", "ineffa", "furina", "xilonen"] as const;
const EXACT_TEAM_RECORD_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const CP38_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-technical-computation.json";
const CP39_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-generated-sheet-evidence.json";
const POLICY_SOURCE_PATH = "scripts/guide-factory/src/boundedLatticePolicy.ts";
const EXPECTED_CP38_SHA256 =
  "955db5d62d01a72ca0ebf78cc84792d354e0bfc554097f7a0411fba08f230f01";
const EXPECTED_CP39_SHA256 =
  "9f472a7b46b5318e0073dca4b385df95300c173fca28fcd471a08526e79af568";
const EXPECTED_POLICY_SOURCE_SHA256 =
  "73a9ee8f253686ec63fb841287953fe3fb342b491316b7915bb4299144266bbc";
const EXPECTED_COMPACT_NODE_TABLE_SHA256 =
  "95dbf16cb035227488f77fa12673120505b058a7e81a2914adf848a293d37106";
const EXPECTED_REVIEW_PROJECTION_SHA256 =
  "ea108239bcadd49bfcdbde1057b5caf476eeb2c168271f9c97f87ac8bc855d73";
const EXPECTED_POLICY_AUDIT_SHA256 =
  "159828178c5a42affc6d7d97c5092842fa8fab41b0fbb58ee8e55f626ec8b5a2";
const EXPECTED_REPORT_CONTENT_SHA256 =
  "5d6f5e912d8b85633a27828634e12af4cc18bb36f33b9f31f1a0890153ddc3d0";
const EXPECTED_AUTHENTICATED_FULL_REPORT_SHA256 =
  "b940336c4259e199e67f8aa3902ecd042744b68868d4711e318d6d4354857935";
const EXPECTED_INJECTED_REPORT_CONTENT_SHA256 =
  "b428f9d16793cc8d714bcc3510fb87f7132c6b01e1b5a5a4e0c95b233acae00f";
const EXPECTED_INJECTED_AUTHENTICATED_FULL_REPORT_SHA256 =
  "7d221ca06dfc2366851330f87bd76ed72fffeedc2bceff67a011ff319f335b2a";

const DIMENSIONS = [
  "member:keqing:weapon",
  "member:keqing:artifact",
  "member:furina:weapon",
  "member:furina:artifact",
] as const;
const DECLARED_FIRST_IMPROVEMENT_ORDER = [
  {
    dimension: "member:keqing:weapon",
    candidateValues: [
      "kqm:character-guide:keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i:weapon:0:0",
      "kqm:character-guide:keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i:weapon:0:1",
      "kqm:character-guide:keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i:weapon:1:0",
    ],
  },
  {
    dimension: "member:keqing:artifact",
    candidateValues: [
      "kqm:character-guide:keqing-lunar-charged-top-contributor-artifact-options-luna-i:artifact:0:0",
      "kqm:character-guide:keqing-lunar-charged-top-contributor-artifact-options-luna-i:artifact:0:1",
    ],
  },
  {
    dimension: "member:furina:weapon",
    candidateValues: [
      "genshintools-presets:character-guide:furina:weapon-order:0",
      "genshintools-presets:character-guide:furina:weapon-order:1",
      "genshintools-presets:character-guide:furina:weapon-order:2",
    ],
  },
  {
    dimension: "member:furina:artifact",
    candidateValues: [
      "genshintools-presets:character-guide:furina:build:BQAI0BO",
      "genshintools-presets:character-guide:furina:build:BQA4H1m",
    ],
  },
] as const satisfies readonly CachedDeclaredDimensionCandidateOrder[];
const TECHNICAL_OBJECTIVE_TOLERANCE = {
  absolute: 1e-9,
  relative: 1e-12,
} as const satisfies TechnicalObjectiveTolerance;
const EXPECTED_GLOBAL_STATE_COUNTS: ReviewStateCounts = {
  "listed-condition-resolved": 816,
  "listed-condition-withheld": 48,
  "listed-baseline-context-unknown": 2202,
  "not-listed-nonexhaustive": 1542,
  "no-applicable-target": 0,
};
const EXPECTED_NODE_STATE_COUNTS: Readonly<Record<number, ReviewStateCounts>> =
  {
    0: stateCounts(21, 3, 62, 42, 0),
    1: stateCounts(21, 3, 58, 46, 0),
    7: stateCounts(21, 3, 58, 46, 0),
    13: stateCounts(23, 1, 58, 46, 0),
  };
const EXPECTED_NODE_ATTACHMENT_COUNTS: Readonly<
  Record<
    number,
    CompactCachedPolicyNode["reviewDiagnostics"]["applicableLayerAttachmentCounts"]
  >
> = {
  0: { presetOnly: 96, kqmOnly: 0, kqmAndPreset: 32, none: 0 },
  1: { presetOnly: 96, kqmOnly: 0, kqmAndPreset: 32, none: 0 },
  7: { presetOnly: 96, kqmOnly: 32, kqmAndPreset: 0, none: 0 },
  13: { presetOnly: 96, kqmOnly: 0, kqmAndPreset: 32, none: 0 },
};
const EXPECTED_INPUT_SHA256: Readonly<Record<string, string>> = {
  [CP38_REPORT_PATH]: EXPECTED_CP38_SHA256,
  [CP39_REPORT_PATH]: EXPECTED_CP39_SHA256,
  [POLICY_SOURCE_PATH]: EXPECTED_POLICY_SOURCE_SHA256,
};

export const KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_ID =
  "keqing-ineffa-furina-xilonen-cached-policy-audit-v1";
export const KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-cached-policy-audit.json";
export const KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH =
  path.join(
    REPOSITORY_ROOT,
    KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_RELATIVE_PATH,
  );
export const KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_INPUT_PATHS =
  Object.keys(EXPECTED_INPUT_SHA256).sort(compareStrings);

export type CachedPolicyAuditHashedInput = {
  path: string;
  sha256: string;
};

export type BuildKeqingIneffaFurinaXilonenCachedPolicyAuditInput = {
  cp38Report: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport;
  cp39Report: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport;
  inputFiles: CachedPolicyAuditHashedInput[];
};

export type KeqingIneffaFurinaXilonenCachedPolicyAuditEnvironment = {
  runOneShotBestNeighbor: typeof runCachedOneShotBestNeighborPass;
  runBestImprovement: typeof runCachedBestImprovementCoordinateDescent;
  runDeclaredFirstImprovement: typeof runCachedDeclaredOrderFirstImprovementCoordinateDescent;
  selectTableReference: typeof selectCachedTableBestComparableReference;
};

const DEFAULT_ENVIRONMENT: KeqingIneffaFurinaXilonenCachedPolicyAuditEnvironment =
  {
    runOneShotBestNeighbor: runCachedOneShotBestNeighborPass,
    runBestImprovement: runCachedBestImprovementCoordinateDescent,
    runDeclaredFirstImprovement:
      runCachedDeclaredOrderFirstImprovementCoordinateDescent,
    selectTableReference: selectCachedTableBestComparableReference,
  };

export type CachedPolicyAuditIssue = {
  code: string;
  stage: "input" | "projection" | "policy" | "authentication";
  path: string;
  message: string;
};

export type ReviewComparisonStatus =
  | "listed-condition-resolved"
  | "listed-condition-withheld"
  | "listed-baseline-context-unknown"
  | "not-listed-nonexhaustive"
  | "no-applicable-target";

export type ReviewStateCounts = Record<ReviewComparisonStatus, number>;

export type CompactOccurrenceReviewDiagnostic = {
  sourceOccurrenceSequence: number;
  occurrenceId: string;
  nodeId: string;
  carryCharacterId: string;
  characterId: string;
  artifactOccurrenceId: string;
  allocationId: string;
  attachmentScope: "node-carry-character-occurrence";
  comparisonRowCount: number;
  stateCounts: ReviewStateCounts;
  comparisonRows: Array<{
    relationship: string;
    observedStatId: string;
    comparisonStatus: ReviewComparisonStatus;
  }>;
  matchingTargetIds: string[];
  matchingTargetApplicabilityCount: number;
  matchingTargetApplicabilitiesSha256: string;
  sourceObservableComparisonsSha256: string;
  usedForObjective: false;
  usedAsPolicyFilter: false;
  rankProduced: false;
};

export type CompactCachedPolicyNode = {
  sequence: number;
  nodeId: string;
  coordinates: Record<(typeof DIMENSIONS)[number], string>;
  materializedConfigsSha256: string;
  technicalReference: {
    compositionId: string;
    unreviewedTechnicalObjective: number;
    provenance: "intact-generator-endpoint" | "cross-endpoint-recombination";
    equivalentCompositionIds: string[];
  };
  reviewDiagnostics: {
    attachmentScope: "node-carry-character-occurrence-only";
    occurrenceCount: number;
    comparisonRowCount: number;
    stateCounts: ReviewStateCounts;
    applicableLayerAttachmentCounts: {
      presetOnly: number;
      kqmOnly: number;
      kqmAndPreset: number;
      none: number;
    };
    occurrenceDiagnosticsSha256: string;
    occurrences: CompactOccurrenceReviewDiagnostic[];
    usedForObjective: false;
    usedAsPolicyFilter: false;
    rankProduced: false;
  };
};

export type CachedPolicyTechnicalGap = {
  terminalNodeId: string;
  terminalSequence: number;
  terminalTechnicalObjective: number;
  referenceNodeId: string;
  referenceSequence: number;
  referenceTechnicalObjective: number;
  referenceMinusTerminalAbsolute: number;
  referenceMinusTerminalPercentOfReference: number;
  terminalOverReferenceRatio: number;
};

export type CachedPolicyAuditResult = {
  startNodeId: string;
  startSequence: 0;
  oneShotBestNeighbor: CachedOneShotBestNeighborPassTrace;
  iterativeBestImprovement: CachedCoordinateDescentTrace;
  declaredFirstImprovement: CachedDeclaredOrderFirstImprovementTrace;
  fullBoundedTableReference: CachedTableBestReference;
  technicalGaps: {
    oneShotBestNeighbor: CachedPolicyTechnicalGap;
    iterativeBestImprovement: CachedPolicyTechnicalGap;
    declaredFirstImprovement: CachedPolicyTechnicalGap;
  };
};

type SourceAuthentication = {
  dependencySetClassification: "authenticated-declared-non-self-selected-checkpoint-inputs";
  dependencySetExhaustive: false;
  transitiveModuleGraphClaimed: false;
  selectedInputsAuthenticatedBeforePolicyExecution: boolean;
  expectedFileCount: 3;
  observedFileCount: number;
  exactPathSet: boolean;
  allByteHashesWellFormed: boolean;
  allDeclaredFileHashesMatch: boolean;
  cp38ByteSha256: string | null;
  cp38PayloadSha256: string;
  cp38PayloadHashMatches: boolean;
  cp38FullGuardPassed: boolean;
  cp39ByteSha256: string | null;
  cp39PayloadSha256: string;
  cp39PayloadHashMatches: boolean;
  cp39FullGuardPassed: boolean;
  cp39NestedCp38PayloadHashMatches: boolean;
  policySourceByteSha256: string | null;
  policySourceHashMatches: boolean;
  authentication: "accepted" | "rejected";
};

type PolicyCallCounts = {
  oneShotBestNeighbor: number;
  iterativeBestImprovement: number;
  declaredFirstImprovement: number;
  fullBoundedTableReference: number;
};

export type KeqingIneffaFurinaXilonenCachedPolicyAuditReport = {
  schemaVersion: 1;
  classification: "keqing-ineffa-furina-xilonen-cached-policy-audit";
  auditId: typeof KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_ID;
  validationStatus:
    | "authenticated-completed-cached-policy-audit-source-not-ready"
    | "not-authenticated";
  generatedFrom: CachedPolicyAuditHashedInput[];
  issues: CachedPolicyAuditIssue[];
  sourceAuthentication: SourceAuthentication;
  sourceBoundary: {
    exactTeamRecordId: typeof EXACT_TEAM_RECORD_ID;
    exactCharacterIds: string[];
    objectiveReviewStatus: "unreviewed";
    sourceReadinessBlockerCount: 8;
    sourceReadyForGuideClaims: false;
    sourceReadyForGameplayClaims: false;
    sourcePublishedWholeCandidateCount: 0;
  };
  latticeBoundary: {
    dimensions: string[];
    declaredFirstImprovementOrder: Array<{
      dimension: string;
      candidateValues: string[];
    }>;
    technicalObjectiveTolerance: TechnicalObjectiveTolerance;
    nodeCount: number;
    exactCartesianCoordinateCount: number;
    exactCartesianClosure: boolean;
    startNodeSequence: 0;
    startNodeId: string | null;
    fixedEquipment: {
      ineffa: {
        weapon: "fractured_halo@r1";
        artifact: "aubade_of_morningstar_and_moon:4pc";
      };
      xilonen: {
        weapon: "peak_patrol_song@r1";
        artifact: "scroll_of_the_hero_of_cinder_city:4pc";
      };
    };
  };
  reviewBoundary: {
    source: "authenticated-cp39-occurrence-comparisons";
    attachmentScope: "node-carry-character-occurrence-only";
    globalSheetIdAttachmentCount: 0;
    nodeCount: number;
    occurrenceCount: number;
    comparisonRowCount: number;
    globalStateCounts: ReviewStateCounts;
    usedForObjective: false;
    usedAsPolicyFilter: false;
    correctnessJudgmentProduced: false;
    scalarWeightProduced: false;
    rankProduced: false;
    recommendationProduced: false;
    energyRecoveryProvenanceReadForAuthentication: true;
    energyRecoveryValuesProjectedIntoPolicyInput: false;
  };
  executionBoundary: {
    evaluationSource: "authenticated-cached-cp38-node-table-only";
    scheduling: "sequential";
    traceProductionEnvironment:
      | "default-cached-policy-functions"
      | "injected-uncharacterized-policy-functions";
    traceProductionPolicyCallCounts: PolicyCallCounts;
    traceProductionTotalPolicyCalls: number;
    authenticationUsesDefaultPolicyRecomputation: true;
    authenticationPolicyRecomputationCallsPerGuard: 4;
    outerGuardInvocationCountAttested: false;
    actualTotalPolicyCallsAttested: false;
    forbiddenSeamCallCountsAttestation:
      | "verified-zero-default-environment"
      | "uncharacterized-injected-environment";
    evaluatorCalls: 0 | null;
    generatorCalls: 0 | null;
    damageReplayCalls: 0 | null;
    optimizerCalls: 0 | null;
    rankCalls: 0 | null;
    recommendationCalls: 0 | null;
    energyRecoveryCalls: 0 | null;
    energyRecoveryValuesInfluencedPolicy: false | null;
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
  nodes: CompactCachedPolicyNode[];
  policyAudit: CachedPolicyAuditResult | null;
  authentication: {
    compactNodeTableSha256: string | null;
    reviewProjectionSha256: string | null;
    policyAuditSha256: string | null;
    reportContentSha256: string;
  };
  cautions: string[];
  prohibitedInterpretations: string[];
};

export function buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
  input: BuildKeqingIneffaFurinaXilonenCachedPolicyAuditInput,
  environment: KeqingIneffaFurinaXilonenCachedPolicyAuditEnvironment = DEFAULT_ENVIRONMENT,
): KeqingIneffaFurinaXilonenCachedPolicyAuditReport {
  const generatedFrom = input.inputFiles
    .map((entry) => ({ ...entry }))
    .sort((left, right) => compareStrings(left.path, right.path));
  const issues: CachedPolicyAuditIssue[] = [];
  const traceProductionEnvironment =
    environment === DEFAULT_ENVIRONMENT
      ? "default-cached-policy-functions"
      : "injected-uncharacterized-policy-functions";
  const sourceAuthentication = authenticateInputs(input, generatedFrom, issues);
  const callCounts = emptyPolicyCallCounts();
  if (sourceAuthentication.authentication !== "accepted") {
    return finalizeReport(
      emptyReport(
        generatedFrom,
        issues,
        sourceAuthentication,
        callCounts,
        traceProductionEnvironment,
      ),
    );
  }

  let nodes: CompactCachedPolicyNode[] = [];
  try {
    nodes = buildCompactNodes(input.cp38Report, input.cp39Report);
  } catch (error) {
    addIssue(
      issues,
      "projection.compact_table_failed",
      "projection",
      "nodes",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (issues.length > 0) {
    return finalizeReport(
      emptyReport(
        generatedFrom,
        issues,
        sourceAuthentication,
        callCounts,
        traceProductionEnvironment,
      ),
    );
  }

  const table = boundedTable(nodes);
  const startNode = nodes.find(({ sequence }) => sequence === 0);
  if (!startNode) {
    addIssue(
      issues,
      "projection.start_node_missing",
      "projection",
      "nodes",
      "The authenticated compact table does not contain source sequence 0.",
    );
    return finalizeReport(
      emptyReport(
        generatedFrom,
        issues,
        sourceAuthentication,
        callCounts,
        traceProductionEnvironment,
      ),
    );
  }

  let policyAudit: CachedPolicyAuditResult | null = null;
  try {
    callCounts.oneShotBestNeighbor += 1;
    const oneShotBestNeighbor = environment.runOneShotBestNeighbor({
      table,
      startNodeId: startNode.nodeId,
      direction: "maximize",
      tolerance: TECHNICAL_OBJECTIVE_TOLERANCE,
    });
    callCounts.iterativeBestImprovement += 1;
    const iterativeBestImprovement = environment.runBestImprovement({
      table,
      startNodeId: startNode.nodeId,
      direction: "maximize",
      tolerance: TECHNICAL_OBJECTIVE_TOLERANCE,
    });
    callCounts.declaredFirstImprovement += 1;
    const declaredFirstImprovement = environment.runDeclaredFirstImprovement({
      table,
      startNodeId: startNode.nodeId,
      direction: "maximize",
      tolerance: TECHNICAL_OBJECTIVE_TOLERANCE,
      declaredOrder: DECLARED_FIRST_IMPROVEMENT_ORDER,
    });
    callCounts.fullBoundedTableReference += 1;
    const fullBoundedTableReference = environment.selectTableReference(
      table,
      "maximize",
      TECHNICAL_OBJECTIVE_TOLERANCE,
    );
    policyAudit = assemblePolicyAudit(
      nodes,
      startNode,
      oneShotBestNeighbor,
      iterativeBestImprovement,
      declaredFirstImprovement,
      fullBoundedTableReference,
    );
  } catch (error) {
    addIssue(
      issues,
      "policy.cached_policy_execution_failed",
      "policy",
      "policyAudit",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!policyAudit || !expectedPolicyFactsHold(nodes, policyAudit)) {
    if (issues.length === 0) {
      addIssue(
        issues,
        "policy.expected_empirical_facts_mismatch",
        "policy",
        "policyAudit",
        "The cached policies did not reproduce the authenticated CP38/CP39 empirical oracle.",
      );
    }
    return finalizeReport(
      emptyReport(
        generatedFrom,
        issues,
        sourceAuthentication,
        callCounts,
        traceProductionEnvironment,
      ),
    );
  }

  return finalizeReport(
    completeReport(
      generatedFrom,
      sourceAuthentication,
      callCounts,
      traceProductionEnvironment,
      nodes,
      policyAudit,
    ),
  );
}

export function requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
): void {
  if (
    !SHA256.test(report.authentication.reportContentSha256) ||
    report.authentication.reportContentSha256 !== reportContentSha256(report) ||
    !completeReportSemanticsHold(report)
  ) {
    throw new Error(
      "Refusing unauthenticated or mutated Keqing/Ineffa/Furina/Xilonen cached-policy audit report.",
    );
  }
}

function authenticateInputs(
  input: BuildKeqingIneffaFurinaXilonenCachedPolicyAuditInput,
  generatedFrom: CachedPolicyAuditHashedInput[],
  issues: CachedPolicyAuditIssue[],
): SourceAuthentication {
  const expectedPaths = [
    ...KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_INPUT_PATHS,
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
        EXPECTED_INPUT_SHA256[inputPath] === sha256,
    );
  const cp38ByteSha256 =
    generatedFrom.find(({ path: inputPath }) => inputPath === CP38_REPORT_PATH)
      ?.sha256 ?? null;
  const cp39ByteSha256 =
    generatedFrom.find(({ path: inputPath }) => inputPath === CP39_REPORT_PATH)
      ?.sha256 ?? null;
  const policySourceByteSha256 =
    generatedFrom.find(
      ({ path: inputPath }) => inputPath === POLICY_SOURCE_PATH,
    )?.sha256 ?? null;
  const cp38PayloadSha256 = hashPayload(input.cp38Report);
  const cp39PayloadSha256 = hashPayload(input.cp39Report);
  const cp38PayloadHashMatches = cp38PayloadSha256 === EXPECTED_CP38_SHA256;
  const cp39PayloadHashMatches = cp39PayloadSha256 === EXPECTED_CP39_SHA256;
  let cp38FullGuardPassed = false;
  let cp39FullGuardPassed = false;
  try {
    requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
      input.cp38Report,
    );
    cp38FullGuardPassed = true;
  } catch {
    addIssue(
      issues,
      "input.cp38_guard_failed",
      "input",
      "cp38Report",
      "The committed CP38 source-specific report failed its full guard.",
    );
  }
  try {
    requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
      input.cp39Report,
    );
    cp39FullGuardPassed = true;
  } catch {
    addIssue(
      issues,
      "input.cp39_guard_failed",
      "input",
      "cp39Report",
      "The committed CP39 source-specific report failed its full guard.",
    );
  }
  const cp39NestedCp38PayloadHashMatches =
    input.cp39Report.sourceTechnicalReport !== null &&
    hashPayload(input.cp39Report.sourceTechnicalReport) ===
      EXPECTED_CP38_SHA256;
  const policySourceHashMatches =
    policySourceByteSha256 === EXPECTED_POLICY_SOURCE_SHA256;
  if (!exactPathSet) {
    addIssue(
      issues,
      "input.path_set_mismatch",
      "input",
      "inputFiles",
      "The exact CP38, CP39, and cached-policy source input path set changed.",
    );
  }
  if (!allByteHashesWellFormed || !allDeclaredFileHashesMatch) {
    addIssue(
      issues,
      "input.byte_hash_mismatch",
      "input",
      "inputFiles",
      "At least one selected input byte hash is malformed or unexpected.",
    );
  }
  if (!cp38PayloadHashMatches) {
    addIssue(
      issues,
      "input.cp38_payload_mismatch",
      "input",
      "cp38Report",
      "The parsed CP38 payload differs from the authenticated committed report.",
    );
  }
  if (!cp39PayloadHashMatches) {
    addIssue(
      issues,
      "input.cp39_payload_mismatch",
      "input",
      "cp39Report",
      "The parsed CP39 payload differs from the authenticated committed report.",
    );
  }
  if (!cp39NestedCp38PayloadHashMatches) {
    addIssue(
      issues,
      "input.cp39_nested_cp38_mismatch",
      "input",
      "cp39Report.sourceTechnicalReport",
      "CP39 is not attached to the exact authenticated CP38 payload.",
    );
  }
  if (!policySourceHashMatches) {
    addIssue(
      issues,
      "input.policy_source_mismatch",
      "input",
      POLICY_SOURCE_PATH,
      "The cached-policy implementation byte hash differs from the declared CP40 policy source.",
    );
  }
  const accepted =
    issues.length === 0 &&
    exactPathSet &&
    allByteHashesWellFormed &&
    allDeclaredFileHashesMatch &&
    cp38PayloadHashMatches &&
    cp38FullGuardPassed &&
    cp39PayloadHashMatches &&
    cp39FullGuardPassed &&
    cp39NestedCp38PayloadHashMatches &&
    policySourceHashMatches;
  return {
    dependencySetClassification:
      "authenticated-declared-non-self-selected-checkpoint-inputs",
    dependencySetExhaustive: false,
    transitiveModuleGraphClaimed: false,
    selectedInputsAuthenticatedBeforePolicyExecution: accepted,
    expectedFileCount: 3,
    observedFileCount: generatedFrom.length,
    exactPathSet,
    allByteHashesWellFormed,
    allDeclaredFileHashesMatch,
    cp38ByteSha256,
    cp38PayloadSha256,
    cp38PayloadHashMatches,
    cp38FullGuardPassed,
    cp39ByteSha256,
    cp39PayloadSha256,
    cp39PayloadHashMatches,
    cp39FullGuardPassed,
    cp39NestedCp38PayloadHashMatches,
    policySourceByteSha256,
    policySourceHashMatches,
    authentication: accepted ? "accepted" : "rejected",
  };
}

function buildCompactNodes(
  cp38Report: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  cp39Report: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
): CompactCachedPolicyNode[] {
  const technical = cp38Report.technicalComputation;
  const runtimePreflight = cp38Report.sourcePreflight?.runtimePreflight;
  if (!technical || !runtimePreflight) {
    throw new Error("Authenticated CP38 nested reports are absent.");
  }
  const preflightByNodeId = new Map(
    runtimePreflight.nodes.map((node) => [node.nodeId, node] as const),
  );
  const occurrencesByNodeId = new Map<
    string,
    KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["occurrenceComparisons"]
  >();
  for (const occurrence of cp39Report.occurrenceComparisons) {
    const group = occurrencesByNodeId.get(occurrence.nodeId) ?? [];
    group.push(occurrence);
    occurrencesByNodeId.set(occurrence.nodeId, group);
  }
  if (
    technical.nodes.length !== 36 ||
    preflightByNodeId.size !== 36 ||
    occurrencesByNodeId.size !== 36
  ) {
    throw new Error("CP38/CP39 does not expose the exact 36-node domain.");
  }

  const nodes = [...technical.nodes]
    .sort((left, right) => left.sequence - right.sequence)
    .map((technicalNode, expectedSequence): CompactCachedPolicyNode => {
      if (
        technicalNode.sequence !== expectedSequence ||
        technicalNode.comparisonStatus !== "comparable" ||
        !technicalNode.boundedTechnicalReference
      ) {
        throw new Error(
          `Technical node sequence ${expectedSequence} is not exactly comparable.`,
        );
      }
      const preflightNode = preflightByNodeId.get(technicalNode.nodeId);
      if (
        !preflightNode ||
        preflightNode.materializationStatus !== "materialized" ||
        !preflightNode.materializedConfigs
      ) {
        throw new Error(`Preflight node ${technicalNode.nodeId} is absent.`);
      }
      const materializedConfigs = preflightNode.materializedConfigs;
      const configs = new Map(
        materializedConfigs.map((config) => [config.charId, config]),
      );
      if (
        configs.size !== 4 ||
        !EXACT_CHARACTER_IDS.every((characterId) => configs.has(characterId))
      ) {
        throw new Error(
          `Preflight node ${technicalNode.nodeId} has the wrong character domain.`,
        );
      }
      const keqing = configs.get("keqing");
      const ineffa = configs.get("ineffa");
      const furina = configs.get("furina");
      const xilonen = configs.get("xilonen");
      if (!keqing || !ineffa || !furina || !xilonen) {
        throw new Error("Expected materialized character configs are missing.");
      }
      if (
        equipmentValue(ineffa) !== "fractured_halo@r1" ||
        artifactValue(ineffa) !== "aubade_of_morningstar_and_moon:4pc" ||
        equipmentValue(xilonen) !== "peak_patrol_song@r1" ||
        artifactValue(xilonen) !== "scroll_of_the_hero_of_cinder_city:4pc"
      ) {
        throw new Error("The CP40 fixed-equipment axes changed.");
      }
      const selections = new Map(
        preflightNode.selections.map((selection) => [
          selection.axisId,
          selection,
        ]),
      );
      const coordinate = (axisId: (typeof DIMENSIONS)[number]) => {
        const selection = selections.get(axisId);
        if (!selection) {
          throw new Error(
            `Preflight node ${technicalNode.nodeId} lacks axis ${axisId}.`,
          );
        }
        return selection.occurrenceId;
      };
      const sourceOccurrences = [
        ...(occurrencesByNodeId.get(technicalNode.nodeId) ?? []),
      ].sort((left, right) => left.sequence - right.sequence);
      const occurrences = sourceOccurrences.map(compactOccurrenceDiagnostic);
      validateOccurrenceDomain(technicalNode.nodeId, occurrences);
      const reviewStateCounts = sumStateCounts(
        occurrences.map(({ stateCounts: counts }) => counts),
      );
      return {
        sequence: technicalNode.sequence,
        nodeId: technicalNode.nodeId,
        coordinates: {
          "member:keqing:weapon": coordinate("member:keqing:weapon"),
          "member:keqing:artifact": coordinate("member:keqing:artifact"),
          "member:furina:weapon": coordinate("member:furina:weapon"),
          "member:furina:artifact": coordinate("member:furina:artifact"),
        },
        materializedConfigsSha256: technicalNode.materializedConfigsSha256,
        technicalReference: {
          compositionId: technicalNode.boundedTechnicalReference.compositionId,
          unreviewedTechnicalObjective:
            technicalNode.boundedTechnicalReference
              .unreviewedTechnicalObjective,
          provenance: technicalNode.boundedTechnicalReference.provenance,
          equivalentCompositionIds: [
            ...technicalNode.boundedTechnicalReference.equivalentCompositionIds,
          ],
        },
        reviewDiagnostics: {
          attachmentScope: "node-carry-character-occurrence-only",
          occurrenceCount: occurrences.length,
          comparisonRowCount: occurrences.reduce(
            (sum, occurrence) => sum + occurrence.comparisonRowCount,
            0,
          ),
          stateCounts: reviewStateCounts,
          applicableLayerAttachmentCounts:
            applicableLayerAttachmentCounts(sourceOccurrences),
          occurrenceDiagnosticsSha256: hashPayload(occurrences),
          occurrences,
          usedForObjective: false,
          usedAsPolicyFilter: false,
          rankProduced: false,
        },
      };
    });
  if (!exactDeclaredCoordinateClosure(nodes)) {
    throw new Error("The CP38 node projection lacks exact 3x2x3x2 closure.");
  }
  return nodes;
}

function compactOccurrenceDiagnostic(
  occurrence: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["occurrenceComparisons"][number],
): CompactOccurrenceReviewDiagnostic {
  if (
    occurrence.attachmentScope !== "node-carry-character-occurrence" ||
    !EXACT_CHARACTER_IDS.includes(
      occurrence.carryCharacterId as (typeof EXACT_CHARACTER_IDS)[number],
    ) ||
    !EXACT_CHARACTER_IDS.includes(
      occurrence.characterId as (typeof EXACT_CHARACTER_IDS)[number],
    )
  ) {
    throw new Error(
      `Occurrence ${occurrence.occurrenceId} has invalid context.`,
    );
  }
  const counts = emptyStateCounts();
  for (const comparison of occurrence.observableComparisons) {
    if (!(comparison.comparisonStatus in counts)) {
      throw new Error(
        `Occurrence ${occurrence.occurrenceId} has an unknown review status.`,
      );
    }
    counts[comparison.comparisonStatus] += 1;
  }
  const applicabilityByTargetId = new Map<string, unknown>();
  for (const comparison of occurrence.observableComparisons) {
    for (const attachment of comparison.matchingTargetApplicabilities) {
      const prior = applicabilityByTargetId.get(attachment.targetId);
      if (prior && !exactEqual(prior, attachment)) {
        throw new Error(
          `Occurrence ${occurrence.occurrenceId} has conflicting target applicability.`,
        );
      }
      applicabilityByTargetId.set(
        attachment.targetId,
        structuredClone(attachment),
      );
    }
  }
  return {
    sourceOccurrenceSequence: occurrence.sequence,
    occurrenceId: occurrence.occurrenceId,
    nodeId: occurrence.nodeId,
    carryCharacterId: occurrence.carryCharacterId,
    characterId: occurrence.characterId,
    artifactOccurrenceId: occurrence.artifactOccurrenceId,
    allocationId: occurrence.allocationId,
    attachmentScope: "node-carry-character-occurrence",
    comparisonRowCount: occurrence.observableComparisons.length,
    stateCounts: counts,
    comparisonRows: occurrence.observableComparisons.map((comparison) => ({
      relationship: comparison.relationship,
      observedStatId: comparison.observedStatId,
      comparisonStatus: comparison.comparisonStatus,
    })),
    matchingTargetIds: [...applicabilityByTargetId.keys()].sort(compareStrings),
    matchingTargetApplicabilityCount: applicabilityByTargetId.size,
    matchingTargetApplicabilitiesSha256: hashPayload(
      [...applicabilityByTargetId.entries()]
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([, applicability]) => applicability),
    ),
    sourceObservableComparisonsSha256: hashPayload(
      occurrence.observableComparisons,
    ),
    usedForObjective: false,
    usedAsPolicyFilter: false,
    rankProduced: false,
  };
}

function applicableLayerAttachmentCounts(
  occurrences: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport["occurrenceComparisons"],
): CompactCachedPolicyNode["reviewDiagnostics"]["applicableLayerAttachmentCounts"] {
  const counts = { presetOnly: 0, kqmOnly: 0, kqmAndPreset: 0, none: 0 };
  for (const occurrence of occurrences) {
    for (const comparison of occurrence.observableComparisons) {
      const preset = comparison.applicableTargetLayers.includes(
        "genshintools-preset-baseline",
      );
      const kqm = comparison.applicableTargetLayers.includes(
        "kqm-keqing-stat-claims",
      );
      if (preset && kqm) counts.kqmAndPreset += 1;
      else if (preset) counts.presetOnly += 1;
      else if (kqm) counts.kqmOnly += 1;
      else counts.none += 1;
    }
  }
  return counts;
}

function validateOccurrenceDomain(
  nodeId: string,
  occurrences: CompactOccurrenceReviewDiagnostic[],
): void {
  const contextKeys = new Set<string>();
  for (const occurrence of occurrences) {
    if (
      occurrence.nodeId !== nodeId ||
      occurrence.comparisonRowCount !== 8 ||
      occurrence.attachmentScope !== "node-carry-character-occurrence"
    ) {
      throw new Error(`Node ${nodeId} has a misattached review occurrence.`);
    }
    contextKeys.add(
      `${occurrence.carryCharacterId}\u0000${occurrence.characterId}`,
    );
  }
  if (occurrences.length !== 16 || contextKeys.size !== 16) {
    throw new Error(`Node ${nodeId} lacks the exact 4x4 occurrence domain.`);
  }
}

function assemblePolicyAudit(
  nodes: CompactCachedPolicyNode[],
  startNode: CompactCachedPolicyNode,
  oneShotBestNeighbor: CachedOneShotBestNeighborPassTrace,
  iterativeBestImprovement: CachedCoordinateDescentTrace,
  declaredFirstImprovement: CachedDeclaredOrderFirstImprovementTrace,
  fullBoundedTableReference: CachedTableBestReference,
): CachedPolicyAuditResult {
  if (fullBoundedTableReference.status !== "selected") {
    throw new Error("The complete cached table reference was withheld.");
  }
  const oneShotTerminal = terminalFromOneShot(oneShotBestNeighbor);
  const iterativeTerminal = terminalFromBestImprovement(
    iterativeBestImprovement,
  );
  const declaredTerminal = terminalFromDeclaredFirstImprovement(
    declaredFirstImprovement,
  );
  return {
    startNodeId: startNode.nodeId,
    startSequence: 0,
    oneShotBestNeighbor,
    iterativeBestImprovement,
    declaredFirstImprovement,
    fullBoundedTableReference,
    technicalGaps: {
      oneShotBestNeighbor: technicalGap(
        nodes,
        oneShotTerminal,
        fullBoundedTableReference,
      ),
      iterativeBestImprovement: technicalGap(
        nodes,
        iterativeTerminal,
        fullBoundedTableReference,
      ),
      declaredFirstImprovement: technicalGap(
        nodes,
        declaredTerminal,
        fullBoundedTableReference,
      ),
    },
  };
}

function terminalFromOneShot(trace: CachedOneShotBestNeighborPassTrace): {
  nodeId: string;
  technicalObjective: number;
} {
  if (trace.outcome.status === "moved") {
    return {
      nodeId: trace.outcome.toNodeId,
      technicalObjective: trace.outcome.toTechnicalObjective,
    };
  }
  if (trace.outcome.status === "unchanged") {
    return {
      nodeId: trace.outcome.nodeId,
      technicalObjective: trace.outcome.technicalObjective,
    };
  }
  throw new Error("The one-shot cached policy was withheld.");
}

function terminalFromBestImprovement(trace: CachedCoordinateDescentTrace): {
  nodeId: string;
  technicalObjective: number;
} {
  if (trace.terminal.reason !== "no-strictly-improving-comparable-neighbor") {
    throw new Error("The iterative cached policy was withheld.");
  }
  return {
    nodeId: trace.terminal.nodeId,
    technicalObjective: trace.terminal.technicalObjective,
  };
}

function terminalFromDeclaredFirstImprovement(
  trace: CachedDeclaredOrderFirstImprovementTrace,
): { nodeId: string; technicalObjective: number } {
  if (trace.terminal.status !== "complete") {
    throw new Error("The declared-order cached policy was withheld.");
  }
  return {
    nodeId: trace.terminal.nodeId,
    technicalObjective: trace.terminal.technicalObjective,
  };
}

function technicalGap(
  nodes: CompactCachedPolicyNode[],
  terminal: { nodeId: string; technicalObjective: number },
  reference: Extract<CachedTableBestReference, { status: "selected" }>,
): CachedPolicyTechnicalGap {
  const terminalNode = requireCompactNode(nodes, terminal.nodeId);
  const referenceNode = requireCompactNode(nodes, reference.nodeId);
  const absolute = reference.technicalObjective - terminal.technicalObjective;
  return {
    terminalNodeId: terminal.nodeId,
    terminalSequence: terminalNode.sequence,
    terminalTechnicalObjective: terminal.technicalObjective,
    referenceNodeId: reference.nodeId,
    referenceSequence: referenceNode.sequence,
    referenceTechnicalObjective: reference.technicalObjective,
    referenceMinusTerminalAbsolute: absolute,
    referenceMinusTerminalPercentOfReference:
      (absolute / reference.technicalObjective) * 100,
    terminalOverReferenceRatio:
      terminal.technicalObjective / reference.technicalObjective,
  };
}

function expectedPolicyFactsHold(
  nodes: CompactCachedPolicyNode[],
  audit: CachedPolicyAuditResult,
): boolean {
  const nodeId = (sequence: number) =>
    nodes.find((node) => node.sequence === sequence)?.nodeId;
  const nodeObjective = (sequence: number) =>
    nodes.find((node) => node.sequence === sequence)?.technicalReference
      .unreviewedTechnicalObjective;
  return (
    nodes.length === 36 &&
    audit.startNodeId === nodeId(0) &&
    exactEqual(audit.oneShotBestNeighbor.pathNodeIds, [nodeId(0), nodeId(1)]) &&
    exactEqual(audit.iterativeBestImprovement.pathNodeIds, [
      nodeId(0),
      nodeId(1),
      nodeId(7),
    ]) &&
    exactEqual(audit.declaredFirstImprovement.pathNodeIds, [
      nodeId(0),
      nodeId(1),
      nodeId(13),
    ]) &&
    audit.fullBoundedTableReference.status === "selected" &&
    audit.fullBoundedTableReference.nodeId === nodeId(7) &&
    audit.fullBoundedTableReference.technicalObjective ===
      926_093.666_196_721 &&
    nodeObjective(0) === 874_101.224_341_111 &&
    nodeObjective(1) === 918_817.268_930_661 &&
    nodeObjective(7) === 926_093.666_196_721 &&
    nodeObjective(13) === 921_173.659_557_781 &&
    audit.technicalGaps.oneShotBestNeighbor.terminalSequence === 1 &&
    nearlyEqual(
      audit.technicalGaps.oneShotBestNeighbor
        .referenceMinusTerminalPercentOfReference,
      0.785_708_566_169_412,
      1e-12,
    ) &&
    audit.technicalGaps.iterativeBestImprovement.terminalSequence === 7 &&
    audit.technicalGaps.iterativeBestImprovement
      .referenceMinusTerminalAbsolute === 0 &&
    audit.technicalGaps.declaredFirstImprovement.terminalSequence === 13 &&
    nearlyEqual(
      audit.technicalGaps.declaredFirstImprovement
        .referenceMinusTerminalPercentOfReference,
      0.531_264_473_403_165,
      1e-12,
    ) &&
    [0, 1, 7, 13].every((sequence) => {
      const node = nodes.find((candidate) => candidate.sequence === sequence);
      return (
        node !== undefined &&
        exactEqual(
          node.reviewDiagnostics.stateCounts,
          EXPECTED_NODE_STATE_COUNTS[sequence],
        ) &&
        exactEqual(
          node.reviewDiagnostics.applicableLayerAttachmentCounts,
          EXPECTED_NODE_ATTACHMENT_COUNTS[sequence],
        )
      );
    }) &&
    audit.oneShotBestNeighbor.evaluatorCalls === 0 &&
    audit.iterativeBestImprovement.evaluatorCalls === 0 &&
    audit.declaredFirstImprovement.evaluatorCalls === 0 &&
    audit.fullBoundedTableReference.evaluatorCalls === 0
  );
}

function completeReport(
  generatedFrom: CachedPolicyAuditHashedInput[],
  sourceAuthentication: SourceAuthentication,
  callCounts: PolicyCallCounts,
  traceProductionEnvironment: KeqingIneffaFurinaXilonenCachedPolicyAuditReport["executionBoundary"]["traceProductionEnvironment"],
  nodes: CompactCachedPolicyNode[],
  policyAudit: CachedPolicyAuditResult,
): KeqingIneffaFurinaXilonenCachedPolicyAuditReport {
  const globalStateCounts = sumStateCounts(
    nodes.map(({ reviewDiagnostics }) => reviewDiagnostics.stateCounts),
  );
  return {
    ...reportHeader(generatedFrom, sourceAuthentication),
    validationStatus:
      "authenticated-completed-cached-policy-audit-source-not-ready",
    issues: [],
    latticeBoundary: latticeBoundary(nodes[0]?.nodeId ?? null, 36, true),
    reviewBoundary: {
      source: "authenticated-cp39-occurrence-comparisons",
      attachmentScope: "node-carry-character-occurrence-only",
      globalSheetIdAttachmentCount: 0,
      nodeCount: nodes.length,
      occurrenceCount: nodes.reduce(
        (sum, node) => sum + node.reviewDiagnostics.occurrenceCount,
        0,
      ),
      comparisonRowCount: nodes.reduce(
        (sum, node) => sum + node.reviewDiagnostics.comparisonRowCount,
        0,
      ),
      globalStateCounts,
      usedForObjective: false,
      usedAsPolicyFilter: false,
      correctnessJudgmentProduced: false,
      scalarWeightProduced: false,
      rankProduced: false,
      recommendationProduced: false,
      energyRecoveryProvenanceReadForAuthentication: true,
      energyRecoveryValuesProjectedIntoPolicyInput: false,
    },
    executionBoundary: executionBoundary(
      callCounts,
      traceProductionEnvironment,
    ),
    nodes,
    policyAudit,
    authentication: emptyOutputAuthentication(),
  };
}

function emptyReport(
  generatedFrom: CachedPolicyAuditHashedInput[],
  issues: CachedPolicyAuditIssue[],
  sourceAuthentication: SourceAuthentication,
  callCounts: PolicyCallCounts,
  traceProductionEnvironment: KeqingIneffaFurinaXilonenCachedPolicyAuditReport["executionBoundary"]["traceProductionEnvironment"],
): KeqingIneffaFurinaXilonenCachedPolicyAuditReport {
  return {
    ...reportHeader(generatedFrom, sourceAuthentication),
    validationStatus: "not-authenticated",
    issues,
    latticeBoundary: latticeBoundary(null, 0, false),
    reviewBoundary: {
      source: "authenticated-cp39-occurrence-comparisons",
      attachmentScope: "node-carry-character-occurrence-only",
      globalSheetIdAttachmentCount: 0,
      nodeCount: 0,
      occurrenceCount: 0,
      comparisonRowCount: 0,
      globalStateCounts: emptyStateCounts(),
      usedForObjective: false,
      usedAsPolicyFilter: false,
      correctnessJudgmentProduced: false,
      scalarWeightProduced: false,
      rankProduced: false,
      recommendationProduced: false,
      energyRecoveryProvenanceReadForAuthentication: true,
      energyRecoveryValuesProjectedIntoPolicyInput: false,
    },
    executionBoundary: executionBoundary(
      callCounts,
      traceProductionEnvironment,
    ),
    nodes: [],
    policyAudit: null,
    authentication: emptyOutputAuthentication(),
  };
}

function reportHeader(
  generatedFrom: CachedPolicyAuditHashedInput[],
  sourceAuthentication: SourceAuthentication,
): Pick<
  KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  | "schemaVersion"
  | "classification"
  | "auditId"
  | "generatedFrom"
  | "sourceAuthentication"
  | "sourceBoundary"
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
    classification: "keqing-ineffa-furina-xilonen-cached-policy-audit",
    auditId: KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_ID,
    generatedFrom,
    sourceAuthentication,
    sourceBoundary: {
      exactTeamRecordId: EXACT_TEAM_RECORD_ID,
      exactCharacterIds: [...EXACT_CHARACTER_IDS],
      objectiveReviewStatus: "unreviewed",
      sourceReadinessBlockerCount: 8,
      sourceReadyForGuideClaims: false,
      sourceReadyForGameplayClaims: false,
      sourcePublishedWholeCandidateCount: 0,
    },
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

function latticeBoundary(
  startNodeId: string | null,
  nodeCount: number,
  exactCartesianClosure: boolean,
): KeqingIneffaFurinaXilonenCachedPolicyAuditReport["latticeBoundary"] {
  return {
    dimensions: [...DIMENSIONS],
    declaredFirstImprovementOrder: DECLARED_FIRST_IMPROVEMENT_ORDER.map(
      ({ dimension, candidateValues }) => ({
        dimension,
        candidateValues: [...candidateValues],
      }),
    ),
    technicalObjectiveTolerance: { ...TECHNICAL_OBJECTIVE_TOLERANCE },
    nodeCount,
    exactCartesianCoordinateCount: 36,
    exactCartesianClosure,
    startNodeSequence: 0,
    startNodeId,
    fixedEquipment: {
      ineffa: {
        weapon: "fractured_halo@r1",
        artifact: "aubade_of_morningstar_and_moon:4pc",
      },
      xilonen: {
        weapon: "peak_patrol_song@r1",
        artifact: "scroll_of_the_hero_of_cinder_city:4pc",
      },
    },
  };
}

function executionBoundary(
  callCounts: PolicyCallCounts,
  traceProductionEnvironment: KeqingIneffaFurinaXilonenCachedPolicyAuditReport["executionBoundary"]["traceProductionEnvironment"],
): KeqingIneffaFurinaXilonenCachedPolicyAuditReport["executionBoundary"] {
  const defaultEnvironment =
    traceProductionEnvironment === "default-cached-policy-functions";
  const forbiddenSeamCallCount = defaultEnvironment ? 0 : null;
  return {
    evaluationSource: "authenticated-cached-cp38-node-table-only",
    scheduling: "sequential",
    traceProductionEnvironment,
    traceProductionPolicyCallCounts: { ...callCounts },
    traceProductionTotalPolicyCalls: Object.values(callCounts).reduce(
      (sum, count) => sum + count,
      0,
    ),
    authenticationUsesDefaultPolicyRecomputation: true,
    authenticationPolicyRecomputationCallsPerGuard: 4,
    outerGuardInvocationCountAttested: false,
    actualTotalPolicyCallsAttested: false,
    forbiddenSeamCallCountsAttestation: defaultEnvironment
      ? "verified-zero-default-environment"
      : "uncharacterized-injected-environment",
    evaluatorCalls: forbiddenSeamCallCount,
    generatorCalls: forbiddenSeamCallCount,
    damageReplayCalls: forbiddenSeamCallCount,
    optimizerCalls: forbiddenSeamCallCount,
    rankCalls: forbiddenSeamCallCount,
    recommendationCalls: forbiddenSeamCallCount,
    energyRecoveryCalls: forbiddenSeamCallCount,
    energyRecoveryValuesInfluencedPolicy: defaultEnvironment ? false : null,
  };
}

function executionBoundarySemanticsHold(
  boundary: KeqingIneffaFurinaXilonenCachedPolicyAuditReport["executionBoundary"],
): boolean {
  if (
    boundary.traceProductionEnvironment !== "default-cached-policy-functions" &&
    boundary.traceProductionEnvironment !==
      "injected-uncharacterized-policy-functions"
  ) {
    return false;
  }
  return exactEqual(
    boundary,
    executionBoundary(
      {
        oneShotBestNeighbor: 1,
        iterativeBestImprovement: 1,
        declaredFirstImprovement: 1,
        fullBoundedTableReference: 1,
      },
      boundary.traceProductionEnvironment,
    ),
  );
}

function fixedCapabilities(): KeqingIneffaFurinaXilonenCachedPolicyAuditReport["capabilities"] {
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
    "This is a cached-policy audit over the exact authenticated CP38 36-node bounded technical table. The default cached-policy environment has verified zero evaluator, generator, damage-replay, optimizer, rank, recommendation, and ER calls. Injected policy callbacks are not instrumented for those side effects, so their seven call counts and any ER-value influence are uncharacterized and reported as null.",
    "The technical objective is unreviewed and source-not-ready with eight retained blockers. Numerical policy behavior does not establish rotation validity, gameplay applicability, damage, DPS, equipment advice, or optimality outside this finite table.",
    "One-shot, best-improvement, and declared-order first-improvement are deterministic policy traces, not ranks, recommendations, or optimizers.",
    "CP39 review diagnostics are attached only through exact node/carry/character occurrences. They are excluded from the objective and from every policy decision or filter.",
    "The compact report retains hashes and occurrence-scoped projections instead of embedding the approximately 2 MB CP38 and 17 MB CP39 source reports.",
    "CP39 ER-deferral provenance is read and asserted during source authentication. The CP40 review projection does not project ER values into policy input; no ER value influences the default cached policies, and the default environment performs no ER calculation.",
    "The report self-digest establishes internal consistency only; the CLI authenticates the exact selected input bytes and full CP38/CP39 guards before policy execution.",
  ];
}

function fixedProhibitedInterpretations(): string[] {
  return [
    "guide",
    "recommendation",
    "rank",
    "optimizer-result",
    "damage-claim",
    "dps-claim",
    "gameplay-claim",
    "global-optimum",
    "equipment-optimum",
    "energy-requirement",
    "cp39-diagnostic-objective",
    "global-sheet-id-attachment",
  ];
}

function completeReportSemanticsHold(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
): boolean {
  if (
    report.validationStatus !==
      "authenticated-completed-cached-policy-audit-source-not-ready" ||
    report.issues.length !== 0 ||
    report.sourceAuthentication.authentication !== "accepted" ||
    !report.sourceAuthentication
      .selectedInputsAuthenticatedBeforePolicyExecution ||
    report.sourceAuthentication.expectedFileCount !== 3 ||
    report.sourceAuthentication.observedFileCount !== 3 ||
    !report.sourceAuthentication.exactPathSet ||
    !report.sourceAuthentication.allByteHashesWellFormed ||
    !report.sourceAuthentication.allDeclaredFileHashesMatch ||
    !report.sourceAuthentication.cp38PayloadHashMatches ||
    !report.sourceAuthentication.cp38FullGuardPassed ||
    !report.sourceAuthentication.cp39PayloadHashMatches ||
    !report.sourceAuthentication.cp39FullGuardPassed ||
    !report.sourceAuthentication.cp39NestedCp38PayloadHashMatches ||
    !report.sourceAuthentication.policySourceHashMatches ||
    report.sourceAuthentication.cp38ByteSha256 !== EXPECTED_CP38_SHA256 ||
    report.sourceAuthentication.cp38PayloadSha256 !== EXPECTED_CP38_SHA256 ||
    report.sourceAuthentication.cp39ByteSha256 !== EXPECTED_CP39_SHA256 ||
    report.sourceAuthentication.cp39PayloadSha256 !== EXPECTED_CP39_SHA256 ||
    report.sourceAuthentication.policySourceByteSha256 !==
      EXPECTED_POLICY_SOURCE_SHA256 ||
    !exactEqual(report.generatedFrom, expectedGeneratedFrom()) ||
    report.sourceBoundary.exactTeamRecordId !== EXACT_TEAM_RECORD_ID ||
    !exactEqual(report.sourceBoundary.exactCharacterIds, EXACT_CHARACTER_IDS) ||
    report.sourceBoundary.objectiveReviewStatus !== "unreviewed" ||
    report.sourceBoundary.sourceReadinessBlockerCount !== 8 ||
    report.sourceBoundary.sourceReadyForGuideClaims ||
    report.sourceBoundary.sourceReadyForGameplayClaims ||
    report.sourceBoundary.sourcePublishedWholeCandidateCount !== 0 ||
    !exactEqual(
      report.latticeBoundary,
      latticeBoundary(report.nodes[0]?.nodeId ?? null, 36, true),
    ) ||
    report.reviewBoundary.source !==
      "authenticated-cp39-occurrence-comparisons" ||
    report.reviewBoundary.attachmentScope !==
      "node-carry-character-occurrence-only" ||
    report.reviewBoundary.globalSheetIdAttachmentCount !== 0 ||
    report.reviewBoundary.nodeCount !== 36 ||
    report.reviewBoundary.occurrenceCount !== 576 ||
    report.reviewBoundary.comparisonRowCount !== 4608 ||
    !exactEqual(
      report.reviewBoundary.globalStateCounts,
      EXPECTED_GLOBAL_STATE_COUNTS,
    ) ||
    report.reviewBoundary.usedForObjective ||
    report.reviewBoundary.usedAsPolicyFilter ||
    report.reviewBoundary.correctnessJudgmentProduced ||
    report.reviewBoundary.scalarWeightProduced ||
    report.reviewBoundary.rankProduced ||
    report.reviewBoundary.recommendationProduced ||
    !report.reviewBoundary.energyRecoveryProvenanceReadForAuthentication ||
    report.reviewBoundary.energyRecoveryValuesProjectedIntoPolicyInput ||
    !executionBoundarySemanticsHold(report.executionBoundary) ||
    !exactEqual(report.capabilities, fixedCapabilities()) ||
    report.guideProduced ||
    report.recommendationProduced ||
    report.rankProduced ||
    report.scalarWeightProduced ||
    report.supportsGuideClaims ||
    report.supportsRecommendationClaims ||
    report.supportsRankClaims ||
    report.supportsDamageClaims ||
    report.supportsGameplayClaims ||
    report.supportsOptimalityClaims ||
    report.supportsEnergyRecoveryClaims ||
    report.promotionEligible ||
    report.nodes.length !== 36 ||
    !report.policyAudit ||
    !exactEqual(report.cautions, fixedCautions()) ||
    !exactEqual(
      report.prohibitedInterpretations,
      fixedProhibitedInterpretations(),
    )
  ) {
    return false;
  }
  if (!compactNodesSemanticsHold(report.nodes)) return false;
  const table = boundedTable(report.nodes);
  const expectedAudit = defaultPolicyAudit(report.nodes, table);
  const expectedReportContentSha256 =
    report.executionBoundary.traceProductionEnvironment ===
    "default-cached-policy-functions"
      ? EXPECTED_REPORT_CONTENT_SHA256
      : EXPECTED_INJECTED_REPORT_CONTENT_SHA256;
  const expectedFullReportSha256 =
    report.executionBoundary.traceProductionEnvironment ===
    "default-cached-policy-functions"
      ? EXPECTED_AUTHENTICATED_FULL_REPORT_SHA256
      : EXPECTED_INJECTED_AUTHENTICATED_FULL_REPORT_SHA256;
  return (
    exactEqual(report.policyAudit, expectedAudit) &&
    expectedPolicyFactsHold(report.nodes, report.policyAudit) &&
    report.authentication.compactNodeTableSha256 ===
      EXPECTED_COMPACT_NODE_TABLE_SHA256 &&
    report.authentication.compactNodeTableSha256 ===
      hashPayload(report.nodes.map(compactTechnicalNodeProjection)) &&
    report.authentication.reviewProjectionSha256 ===
      EXPECTED_REVIEW_PROJECTION_SHA256 &&
    report.authentication.reviewProjectionSha256 ===
      hashPayload(
        report.nodes.map(({ sequence, nodeId, reviewDiagnostics }) => ({
          sequence,
          nodeId,
          reviewDiagnostics,
        })),
      ) &&
    report.authentication.policyAuditSha256 === EXPECTED_POLICY_AUDIT_SHA256 &&
    report.authentication.policyAuditSha256 ===
      hashPayload(report.policyAudit) &&
    report.authentication.reportContentSha256 === expectedReportContentSha256 &&
    hashPayload(report) === expectedFullReportSha256
  );
}

function compactNodesSemanticsHold(nodes: CompactCachedPolicyNode[]): boolean {
  const nodeIds = new Set<string>();
  const coordinateKeys = new Set<string>();
  const globalOccurrenceIds = new Set<string>();
  for (const [sequence, node] of nodes.entries()) {
    if (
      node.sequence !== sequence ||
      node.nodeId.length === 0 ||
      nodeIds.has(node.nodeId) ||
      !Number.isFinite(node.technicalReference.unreviewedTechnicalObjective) ||
      !SHA256.test(node.materializedConfigsSha256) ||
      node.reviewDiagnostics.attachmentScope !==
        "node-carry-character-occurrence-only" ||
      node.reviewDiagnostics.occurrenceCount !== 16 ||
      node.reviewDiagnostics.comparisonRowCount !== 128 ||
      node.reviewDiagnostics.usedForObjective ||
      node.reviewDiagnostics.usedAsPolicyFilter ||
      node.reviewDiagnostics.rankProduced ||
      Object.values(
        node.reviewDiagnostics.applicableLayerAttachmentCounts,
      ).reduce((sum, count) => sum + count, 0) !== 128 ||
      node.reviewDiagnostics.occurrenceDiagnosticsSha256 !==
        hashPayload(node.reviewDiagnostics.occurrences)
    ) {
      return false;
    }
    nodeIds.add(node.nodeId);
    const coordinateKey = DIMENSIONS.map(
      (dimension) => node.coordinates[dimension],
    ).join("\u0000");
    if (coordinateKeys.has(coordinateKey)) return false;
    coordinateKeys.add(coordinateKey);
    const occurrenceContexts = new Set<string>();
    const occurrenceCounts: ReviewStateCounts[] = [];
    for (const occurrence of node.reviewDiagnostics.occurrences) {
      const contextKey = `${occurrence.carryCharacterId}\u0000${occurrence.characterId}`;
      const rowCounts = emptyStateCounts();
      for (const row of occurrence.comparisonRows) {
        if (!(row.comparisonStatus in rowCounts)) {
          return false;
        }
        rowCounts[row.comparisonStatus] += 1;
      }
      if (
        occurrence.nodeId !== node.nodeId ||
        occurrence.attachmentScope !== "node-carry-character-occurrence" ||
        occurrence.comparisonRowCount !== 8 ||
        occurrence.usedForObjective ||
        occurrence.usedAsPolicyFilter ||
        occurrence.rankProduced ||
        occurrenceContexts.has(contextKey) ||
        globalOccurrenceIds.has(occurrence.occurrenceId) ||
        !SHA256.test(occurrence.sourceObservableComparisonsSha256) ||
        !SHA256.test(occurrence.matchingTargetApplicabilitiesSha256) ||
        occurrence.comparisonRows.length !== 8 ||
        occurrence.matchingTargetApplicabilityCount !==
          occurrence.matchingTargetIds.length ||
        new Set(occurrence.matchingTargetIds).size !==
          occurrence.matchingTargetIds.length ||
        stateCountTotal(occurrence.stateCounts) !== 8 ||
        !exactEqual(occurrence.stateCounts, rowCounts)
      ) {
        return false;
      }
      occurrenceContexts.add(contextKey);
      globalOccurrenceIds.add(occurrence.occurrenceId);
      occurrenceCounts.push(occurrence.stateCounts);
    }
    if (
      occurrenceContexts.size !== 16 ||
      !exactEqual(
        node.reviewDiagnostics.stateCounts,
        sumStateCounts(occurrenceCounts),
      )
    ) {
      return false;
    }
  }
  return nodeIds.size === 36 && coordinateKeys.size === 36;
}

function defaultPolicyAudit(
  nodes: CompactCachedPolicyNode[],
  table: BoundedLatticeNodeTable,
): CachedPolicyAuditResult {
  const startNode = requireCompactNodeBySequence(nodes, 0);
  return assemblePolicyAudit(
    nodes,
    startNode,
    runCachedOneShotBestNeighborPass({
      table,
      startNodeId: startNode.nodeId,
      direction: "maximize",
      tolerance: TECHNICAL_OBJECTIVE_TOLERANCE,
    }),
    runCachedBestImprovementCoordinateDescent({
      table,
      startNodeId: startNode.nodeId,
      direction: "maximize",
      tolerance: TECHNICAL_OBJECTIVE_TOLERANCE,
    }),
    runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: startNode.nodeId,
      direction: "maximize",
      tolerance: TECHNICAL_OBJECTIVE_TOLERANCE,
      declaredOrder: DECLARED_FIRST_IMPROVEMENT_ORDER,
    }),
    selectCachedTableBestComparableReference(
      table,
      "maximize",
      TECHNICAL_OBJECTIVE_TOLERANCE,
    ),
  );
}

function finalizeReport(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
): KeqingIneffaFurinaXilonenCachedPolicyAuditReport {
  const finalized = structuredClone(report);
  if (
    finalized.validationStatus ===
      "authenticated-completed-cached-policy-audit-source-not-ready" &&
    finalized.policyAudit
  ) {
    finalized.authentication.compactNodeTableSha256 = hashPayload(
      finalized.nodes.map(compactTechnicalNodeProjection),
    );
    finalized.authentication.reviewProjectionSha256 = hashPayload(
      finalized.nodes.map(({ sequence, nodeId, reviewDiagnostics }) => ({
        sequence,
        nodeId,
        reviewDiagnostics,
      })),
    );
    finalized.authentication.policyAuditSha256 = hashPayload(
      finalized.policyAudit,
    );
  }
  finalized.authentication.reportContentSha256 = reportContentSha256(finalized);
  if (
    finalized.validationStatus ===
    "authenticated-completed-cached-policy-audit-source-not-ready"
  ) {
    requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
      finalized,
    );
  }
  return finalized;
}

function reportContentSha256(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
): string {
  return hashPayload({
    ...report,
    authentication: {
      ...report.authentication,
      reportContentSha256: "",
    },
  });
}

function compactTechnicalNodeProjection(
  node: CompactCachedPolicyNode,
): unknown {
  return {
    sequence: node.sequence,
    nodeId: node.nodeId,
    coordinates: node.coordinates,
    materializedConfigsSha256: node.materializedConfigsSha256,
    technicalReference: node.technicalReference,
  };
}

function boundedTable(
  nodes: CompactCachedPolicyNode[],
): BoundedLatticeNodeTable {
  return {
    dimensions: [...DIMENSIONS],
    nodes: nodes.map((node) => ({
      nodeId: node.nodeId,
      coordinates: { ...node.coordinates },
      cachedResult: {
        status: "comparable",
        technicalObjective:
          node.technicalReference.unreviewedTechnicalObjective,
      },
    })),
  };
}

function exactDeclaredCoordinateClosure(
  nodes: CompactCachedPolicyNode[],
): boolean {
  if (nodes.length !== 36) return false;
  const coordinateKeys = new Set<string>();
  for (const node of nodes) {
    coordinateKeys.add(
      DIMENSIONS.map((dimension) => node.coordinates[dimension]).join("\u0000"),
    );
  }
  if (coordinateKeys.size !== 36) return false;
  return DECLARED_FIRST_IMPROVEMENT_ORDER.every(
    ({ dimension, candidateValues }) => {
      const observed = [
        ...new Set(nodes.map((node) => node.coordinates[dimension])),
      ];
      return exactEqual(
        observed.sort(compareStrings),
        [...candidateValues].sort(compareStrings),
      );
    },
  );
}

function equipmentValue(config: {
  weaponId: string;
  refinement: number;
}): string {
  return `${config.weaponId}@r${config.refinement}`;
}

function artifactValue(config: { artifactSet: unknown }): string {
  if (
    !isRecord(config.artifactSet) ||
    typeof config.artifactSet.setId !== "string" ||
    typeof config.artifactSet.type !== "string"
  ) {
    throw new Error("Materialized config lacks an artifact set.");
  }
  return `${config.artifactSet.setId}:${config.artifactSet.type}`;
}

function requireCompactNode(
  nodes: CompactCachedPolicyNode[],
  nodeId: string,
): CompactCachedPolicyNode {
  const node = nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node) throw new Error(`Unknown compact cached node: ${nodeId}`);
  return node;
}

function requireCompactNodeBySequence(
  nodes: CompactCachedPolicyNode[],
  sequence: number,
): CompactCachedPolicyNode {
  const node = nodes.find((candidate) => candidate.sequence === sequence);
  if (!node)
    throw new Error(`Unknown compact cached node sequence: ${sequence}`);
  return node;
}

function expectedGeneratedFrom(): CachedPolicyAuditHashedInput[] {
  return KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_INPUT_PATHS.map(
    (inputPath) => ({
      path: inputPath,
      sha256: EXPECTED_INPUT_SHA256[inputPath],
    }),
  );
}

function emptyOutputAuthentication(): KeqingIneffaFurinaXilonenCachedPolicyAuditReport["authentication"] {
  return {
    compactNodeTableSha256: null,
    reviewProjectionSha256: null,
    policyAuditSha256: null,
    reportContentSha256: "",
  };
}

function emptyPolicyCallCounts(): PolicyCallCounts {
  return {
    oneShotBestNeighbor: 0,
    iterativeBestImprovement: 0,
    declaredFirstImprovement: 0,
    fullBoundedTableReference: 0,
  };
}

function emptyStateCounts(): ReviewStateCounts {
  return stateCounts(0, 0, 0, 0, 0);
}

function stateCounts(
  resolved: number,
  withheld: number,
  baseline: number,
  unlisted: number,
  noTarget: number,
): ReviewStateCounts {
  return {
    "listed-condition-resolved": resolved,
    "listed-condition-withheld": withheld,
    "listed-baseline-context-unknown": baseline,
    "not-listed-nonexhaustive": unlisted,
    "no-applicable-target": noTarget,
  };
}

function sumStateCounts(rows: readonly ReviewStateCounts[]): ReviewStateCounts {
  const result = emptyStateCounts();
  for (const row of rows) {
    for (const status of Object.keys(result) as ReviewComparisonStatus[]) {
      result[status] += row[status];
    }
  }
  return result;
}

function stateCountTotal(counts: ReviewStateCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function nearlyEqual(left: number, right: number, tolerance: number): boolean {
  return Math.abs(left - right) <= tolerance;
}

function fixedCapabilitiesFalse(value: unknown): boolean {
  return (
    isRecord(value) && Object.values(value).every((entry) => entry === false)
  );
}

function addIssue(
  issues: CachedPolicyAuditIssue[],
  code: string,
  stage: CachedPolicyAuditIssue["stage"],
  issuePath: string,
  message: string,
): void {
  issues.push({ code, stage, path: issuePath, message });
}

function hashPayload(value: unknown): string {
  return sha256Text(stableJson(value));
}

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
