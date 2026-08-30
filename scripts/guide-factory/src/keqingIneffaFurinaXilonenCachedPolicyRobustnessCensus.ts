import path from "node:path";
import {
  buildCachedPolicyRobustnessCensus,
  type BuildCachedPolicyRobustnessCensusInput,
  type CachedPolicyRobustnessCensus,
} from "./boundedLatticePolicyCensus";
import type {
  BoundedLatticeNodeTable,
  CachedDeclaredDimensionCandidateOrder,
  TechnicalObjectiveTolerance,
} from "./boundedLatticePolicy";
import { sha256Text, stableJson } from "./io";
import {
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_RELATIVE_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  type KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
} from "./keqingIneffaFurinaXilonenCachedPolicyAudit";
import { REPOSITORY_ROOT } from "./paths";

const SHA256 = /^[a-f0-9]{64}$/;
const EXACT_TEAM_RECORD_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const EXACT_CHARACTER_IDS = ["keqing", "ineffa", "furina", "xilonen"];
const CENSUS_SOURCE_PATH =
  "scripts/guide-factory/src/boundedLatticePolicyCensus.ts";
const POLICY_SOURCE_PATH = "scripts/guide-factory/src/boundedLatticePolicy.ts";
const EXPECTED_CP40_SHA256 =
  "a2ce1d99443deb81a9559bb0aed9c4d378aefa5d564d2f16074a82fadd987a46";
const EXPECTED_CENSUS_SOURCE_SHA256 =
  "1770b7a9c061523742d39bc065e7194e1909087f99b48642eb931cd8c4fb754b";
const EXPECTED_POLICY_SOURCE_SHA256 =
  "73a9ee8f253686ec63fb841287953fe3fb342b491316b7915bb4299144266bbc";
const EXPECTED_CP40_COMPACT_NODE_TABLE_SHA256 =
  "95dbf16cb035227488f77fa12673120505b058a7e81a2914adf848a293d37106";
const EXPECTED_CP40_REVIEW_PROJECTION_SHA256 =
  "ea108239bcadd49bfcdbde1057b5caf476eeb2c168271f9c97f87ac8bc855d73";
const EXPECTED_CP40_POLICY_AUDIT_SHA256 =
  "159828178c5a42affc6d7d97c5092842fa8fab41b0fbb58ee8e55f626ec8b5a2";
const EXPECTED_CENSUS_INPUT_PROJECTION_SHA256 =
  "86fb2b9c41881840b348adc66dffa5d4f4a198a67ec6609363095af22793d294";
const EXPECTED_CENSUS_PAYLOAD_SHA256 =
  "a98fd6d0c708be4f7b6974df0c2ae0021f693faa7577b9ee9ee517dccda5e986";
const EXPECTED_DEFAULT_REPORT_CONTENT_SHA256 =
  "148493d115ac799579ce36a4a6f8b7947ef3d3bd7882b4110b2463091178955c";
const EXPECTED_DEFAULT_FULL_REPORT_SHA256 =
  "c446dec2027cc2b77d20d46ea8d521d3ae4f43f798f34715a4c4ddb771ac2b73";
const EXPECTED_INJECTED_REPORT_CONTENT_SHA256 =
  "c9aee97b2b61035a4448984181ca2bfcc340690abf5301db75c259de18812278";
const EXPECTED_INJECTED_FULL_REPORT_SHA256 =
  "3cc3363f3010a88bfbdac343c4ca4226ad6bfdd7a8100647c5096dc18bc814da";
const EXPECTED_CANONICAL_ORDER_SHA256 =
  "fa99c1788c07abacdd603d1ce72132056c32e49729d5bb2a9fd44476b7b467ae";
const EXPECTED_ONE_SHOT_TRACE_SHA256 =
  "cd97374ac860914010331e6790ec893bf97c728af9ff836a801aa8feeadcccd3";
const EXPECTED_BEST_TRACE_SHA256 =
  "0338fd4bf29b1122cf2ccee95f8c87aa8f4d1f576e96fd14a464f4399d33173c";
const EXPECTED_ORDER_FAMILY_SHA256 =
  "1aa53446b8ea6217a0e146fcd56cd873c4a251ed15292a28e85cd387b25d09bc";
const EXPECTED_DECLARED_TRACE_SHA256 =
  "45a21703b88d5c2b71f314c01f5754a87e4b3dbde8e7b44ba7e7a9bc88875418";
const EXPECTED_PATH_FAMILIES_SHA256 =
  "83a1a9267c7adb0b2a9c2f98293a857179784a55c11b930d30dda0b9a780c1c7";
const EXPECTED_REFERENCE_BASIN_SHA256 =
  "19685077e06bb2698ee12ccce7108ac8e05532f17003f85905edb6316de8525f";
const EXPECTED_OTHER_BASIN_SHA256 =
  "488a598f75389ec83c714fd2aeecddd0453d9706a44c0215044e773298d37aaa";
const EXPECTED_DIMENSIONS = [
  "member:keqing:weapon",
  "member:keqing:artifact",
  "member:furina:weapon",
  "member:furina:artifact",
];
const EXPECTED_TOLERANCE = {
  absolute: 1e-9,
  relative: 1e-12,
} as const satisfies TechnicalObjectiveTolerance;
const EXPECTED_INPUT_SHA256: Readonly<Record<string, string>> = {
  [KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_RELATIVE_PATH]:
    EXPECTED_CP40_SHA256,
  [CENSUS_SOURCE_PATH]: EXPECTED_CENSUS_SOURCE_SHA256,
  [POLICY_SOURCE_PATH]: EXPECTED_POLICY_SOURCE_SHA256,
};

export const KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_ID =
  "keqing-ineffa-furina-xilonen-cached-policy-robustness-census-v1";
export const KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-cached-policy-robustness-census.json";
export const KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_PATH =
  path.join(
    REPOSITORY_ROOT,
    KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_RELATIVE_PATH,
  );
export const KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_INPUT_PATHS =
  Object.keys(EXPECTED_INPUT_SHA256).sort(compareStrings);

export type CachedPolicyRobustnessCensusHashedInput = {
  path: string;
  sha256: string;
};

export type BuildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusInput = {
  cp40Report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport;
  inputFiles: CachedPolicyRobustnessCensusHashedInput[];
};

export type KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusEnvironment = {
  buildCensus: typeof buildCachedPolicyRobustnessCensus;
};

const DEFAULT_ENVIRONMENT: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusEnvironment =
  { buildCensus: buildCachedPolicyRobustnessCensus };

export type CachedPolicyRobustnessCensusIssue = {
  code: string;
  stage: "input" | "projection" | "census" | "authentication";
  path: string;
  message: string;
};

type SourceAuthentication = {
  dependencySetClassification: "authenticated-declared-non-self-selected-checkpoint-inputs";
  dependencySetExhaustive: false;
  transitiveModuleGraphClaimed: false;
  selectedInputsAuthenticatedBeforeCensusExecution: boolean;
  expectedFileCount: 3;
  observedFileCount: number;
  exactPathSet: boolean;
  allByteHashesWellFormed: boolean;
  allDeclaredFileHashesMatch: boolean;
  cp40ByteSha256: string | null;
  cp40PayloadSha256: string;
  cp40PayloadHashMatches: boolean;
  cp40FullGuardPassed: boolean;
  cp40CompactNodeTableSha256: string | null;
  cp40ReviewProjectionSha256: string | null;
  cp40PolicyAuditSha256: string | null;
  censusSourceByteSha256: string | null;
  censusSourceHashMatches: boolean;
  policySourceByteSha256: string | null;
  policySourceHashMatches: boolean;
  authentication: "accepted" | "rejected";
};

type CensusInputBoundary = {
  evaluationSource: "authenticated-cached-cp40-node-table-only";
  nodeCount: number;
  startCount: number;
  exactNodeSequence: boolean;
  exactCartesianClosure: boolean;
  dimensions: string[];
  declaredFirstImprovementOrder: Array<{
    dimension: string;
    candidateValues: string[];
  }>;
  direction: "maximize";
  technicalObjectiveTolerance: TechnicalObjectiveTolerance;
  censusInputProjectionSha256: string | null;
  reviewOccurrenceCount: number;
  reviewComparisonRowCount: number;
  reviewUsedForObjective: false;
  reviewUsedAsPolicyFilter: false;
  reviewDiagnosticsProjectedIntoCensusInput: false;
  cp40PolicyAuditProjectedIntoCensusInput: false;
  energyRecoveryProvenanceReadForAuthentication: boolean;
  energyRecoveryValuesProjectedIntoCensusInput: false;
};

type ExecutionBoundary = {
  scheduling: "sequential";
  censusProductionEnvironment:
    | "default-cached-policy-robustness-census"
    | "injected-uncharacterized-census-builder";
  censusBuilderCalls: number;
  censusReportedPolicyCalls: number | null;
  censusReportedEvaluatorCalls: 0 | null;
  outerGuardInvocationCountAttested: false;
  actualTotalPolicyCallsAttested: false;
  forbiddenSeamCallCountsAttestation:
    | "verified-zero-default-environment"
    | "uncharacterized-injected-environment";
  generatorCalls: 0 | null;
  damageReplayCalls: 0 | null;
  downstreamOptimizerCalls: 0 | null;
  recommendationCalls: 0 | null;
  rankCalls: 0 | null;
  energyRecoveryCalls: 0 | null;
  energyRecoveryValuesInfluencedCensus: false | null;
};

export type KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport = {
  schemaVersion: 1;
  classification: "keqing-ineffa-furina-xilonen-cached-policy-robustness-census";
  censusId: typeof KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_ID;
  validationStatus:
    | "authenticated-completed-cached-policy-robustness-census-source-not-ready"
    | "not-authenticated";
  generatedFrom: CachedPolicyRobustnessCensusHashedInput[];
  issues: CachedPolicyRobustnessCensusIssue[];
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
  censusInputBoundary: CensusInputBoundary;
  executionBoundary: ExecutionBoundary;
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
  census: CachedPolicyRobustnessCensus | null;
  authentication: {
    censusInputProjectionSha256: string | null;
    censusPayloadSha256: string | null;
    reportContentSha256: string;
  };
  cautions: string[];
  prohibitedInterpretations: string[];
};

export function buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
  input: BuildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusInput,
  environment: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusEnvironment =
    DEFAULT_ENVIRONMENT,
): KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport {
  const generatedFrom = input.inputFiles
    .map((entry) => ({ ...entry }))
    .sort((left, right) => compareStrings(left.path, right.path));
  const issues: CachedPolicyRobustnessCensusIssue[] = [];
  const productionEnvironment =
    environment === DEFAULT_ENVIRONMENT
      ? "default-cached-policy-robustness-census"
      : "injected-uncharacterized-census-builder";
  const sourceAuthentication = authenticateInputs(input, generatedFrom, issues);
  if (sourceAuthentication.authentication !== "accepted") {
    return finalizeReport(
      emptyReport(
        generatedFrom,
        issues,
        sourceAuthentication,
        emptyCensusInputBoundary(),
        executionBoundary(0, null, productionEnvironment),
      ),
    );
  }

  let projected: ProjectedCensusInput | null = null;
  try {
    projected = projectCensusInput(input.cp40Report);
  } catch (error) {
    addIssue(
      issues,
      "projection.cached_table_failed",
      "projection",
      "cp40Report.nodes",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!projected) {
    return finalizeReport(
      emptyReport(
        generatedFrom,
        issues,
        sourceAuthentication,
        emptyCensusInputBoundary(),
        executionBoundary(0, null, productionEnvironment),
      ),
    );
  }
  if (
    !isBootstrap(EXPECTED_CENSUS_INPUT_PROJECTION_SHA256) &&
    projected.projectionSha256 !== EXPECTED_CENSUS_INPUT_PROJECTION_SHA256
  ) {
    addIssue(
      issues,
      "projection.input_projection_mismatch",
      "projection",
      "censusInputBoundary.censusInputProjectionSha256",
      "The authenticated CP40 census input projection differs from the fixed source-specific boundary.",
    );
    return finalizeReport(
      emptyReport(
        generatedFrom,
        issues,
        sourceAuthentication,
        projected.boundary,
        executionBoundary(0, null, productionEnvironment),
        projected.projectionSha256,
      ),
    );
  }

  let census: CachedPolicyRobustnessCensus | null = null;
  try {
    census = environment.buildCensus(projected.coreInput);
  } catch (error) {
    addIssue(
      issues,
      "census.execution_failed",
      "census",
      "census",
      error instanceof Error ? error.message : String(error),
    );
  }
  const execution = executionBoundary(
    1,
    census?.execution.totalPolicyCalls ?? null,
    productionEnvironment,
  );
  if (!census || !expectedCensusFactsHold(census)) {
    if (issues.length === 0) {
      addIssue(
        issues,
        "census.expected_empirical_facts_mismatch",
        "census",
        "census",
        "The cached-policy robustness census did not reproduce the authenticated CP40 empirical oracle.",
      );
    }
    return finalizeReport(
      emptyReport(
        generatedFrom,
        issues,
        sourceAuthentication,
        projected.boundary,
        execution,
        projected.projectionSha256,
      ),
    );
  }

  return finalizeReport(
    completeReport(
      generatedFrom,
      sourceAuthentication,
      projected.boundary,
      execution,
      census,
      projected.projectionSha256,
    ),
  );
}

export function requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
  report: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
): void {
  if (
    !SHA256.test(report.authentication.reportContentSha256) ||
    report.authentication.reportContentSha256 !== reportContentSha256(report) ||
    !completeReportSemanticsHold(report)
  ) {
    throw new Error(
      "Refusing unauthenticated or mutated Keqing/Ineffa/Furina/Xilonen " +
        `cached-policy robustness census report (content ${report.authentication.reportContentSha256}, ` +
        `full ${hashPayload(report)}).`,
    );
  }
}

type ProjectedCensusInput = {
  coreInput: BuildCachedPolicyRobustnessCensusInput;
  boundary: CensusInputBoundary;
  projectionSha256: string;
};

function projectCensusInput(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
): ProjectedCensusInput {
  const nodes = [...report.nodes].sort(
    (left, right) => left.sequence - right.sequence,
  );
  if (
    nodes.length !== 36 ||
    nodes.some(({ sequence }, index) => sequence !== index) ||
    report.latticeBoundary.nodeCount !== 36 ||
    report.latticeBoundary.exactCartesianCoordinateCount !== 36 ||
    !report.latticeBoundary.exactCartesianClosure
  ) {
    throw new Error(
      "The authenticated CP40 report does not expose the exact ordered 36-node Cartesian closure.",
    );
  }
  const table: BoundedLatticeNodeTable = {
    dimensions: [...report.latticeBoundary.dimensions],
    nodes: nodes.map(({ nodeId, coordinates, technicalReference }) => ({
      nodeId,
      coordinates: { ...coordinates },
      cachedResult: {
        status: "comparable",
        technicalObjective: technicalReference.unreviewedTechnicalObjective,
      },
    })),
  };
  const declaredOrder: CachedDeclaredDimensionCandidateOrder[] =
    report.latticeBoundary.declaredFirstImprovementOrder.map(
      ({ dimension, candidateValues }) => ({
        dimension,
        candidateValues: [...candidateValues],
      }),
    );
  const projection = {
    sourceAuditId: report.auditId,
    sourceBoundary: {
      exactTeamRecordId: report.sourceBoundary.exactTeamRecordId,
      exactCharacterIds: report.sourceBoundary.exactCharacterIds,
      objectiveReviewStatus: report.sourceBoundary.objectiveReviewStatus,
      sourceReadinessBlockerCount:
        report.sourceBoundary.sourceReadinessBlockerCount,
      sourceReadyForGuideClaims:
        report.sourceBoundary.sourceReadyForGuideClaims,
      sourceReadyForGameplayClaims:
        report.sourceBoundary.sourceReadyForGameplayClaims,
      sourcePublishedWholeCandidateCount:
        report.sourceBoundary.sourcePublishedWholeCandidateCount,
    },
    latticeBoundary: {
      dimensions: table.dimensions,
      declaredFirstImprovementOrder: declaredOrder,
      technicalObjectiveTolerance:
        report.latticeBoundary.technicalObjectiveTolerance,
      nodeCount: report.latticeBoundary.nodeCount,
      exactCartesianCoordinateCount:
        report.latticeBoundary.exactCartesianCoordinateCount,
      exactCartesianClosure: report.latticeBoundary.exactCartesianClosure,
    },
    nodes: nodes.map(({ sequence, nodeId, coordinates, technicalReference }) => ({
      sequence,
      nodeId,
      coordinates,
      unreviewedTechnicalObjective:
        technicalReference.unreviewedTechnicalObjective,
    })),
    reviewBoundary: {
      occurrenceCount: report.reviewBoundary.occurrenceCount,
      comparisonRowCount: report.reviewBoundary.comparisonRowCount,
      usedForObjective: report.reviewBoundary.usedForObjective,
      usedAsPolicyFilter: report.reviewBoundary.usedAsPolicyFilter,
      energyRecoveryProvenanceReadForAuthentication:
        report.reviewBoundary.energyRecoveryProvenanceReadForAuthentication,
      energyRecoveryValuesProjectedIntoPolicyInput:
        report.reviewBoundary.energyRecoveryValuesProjectedIntoPolicyInput,
    },
  };
  const projectionSha256 = hashPayload(projection);
  return {
    coreInput: {
      table,
      startNodeIds: nodes.map(({ nodeId }) => nodeId),
      declaredOrderSeed: declaredOrder,
      direction: "maximize",
      tolerance: { ...report.latticeBoundary.technicalObjectiveTolerance },
    },
    boundary: completeCensusInputBoundary(report, projectionSha256),
    projectionSha256,
  };
}

function authenticateInputs(
  input: BuildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusInput,
  generatedFrom: CachedPolicyRobustnessCensusHashedInput[],
  issues: CachedPolicyRobustnessCensusIssue[],
): SourceAuthentication {
  const expectedPaths = [
    ...KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_INPUT_PATHS,
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
  const cp40ByteSha256 = inputHash(
    generatedFrom,
    KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_RELATIVE_PATH,
  );
  const censusSourceByteSha256 = inputHash(
    generatedFrom,
    CENSUS_SOURCE_PATH,
  );
  const policySourceByteSha256 = inputHash(
    generatedFrom,
    POLICY_SOURCE_PATH,
  );
  const cp40PayloadSha256 = hashPayload(input.cp40Report);
  const cp40PayloadHashMatches = cp40PayloadSha256 === EXPECTED_CP40_SHA256;
  let cp40FullGuardPassed = false;
  try {
    requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
      input.cp40Report,
    );
    cp40FullGuardPassed = true;
  } catch {
    addIssue(
      issues,
      "input.cp40_guard_failed",
      "input",
      "cp40Report",
      "The committed CP40 cached-policy audit failed its full guard.",
    );
  }
  if (!exactPathSet) {
    addIssue(
      issues,
      "input.path_set_mismatch",
      "input",
      "inputFiles",
      "The exact CP40 report, census core, and cached-policy source path set changed.",
    );
  }
  if (!allByteHashesWellFormed || !allDeclaredFileHashesMatch) {
    addIssue(
      issues,
      "input.byte_hash_mismatch",
      "input",
      "inputFiles",
      "At least one selected census input byte hash is malformed or unexpected.",
    );
  }
  if (!cp40PayloadHashMatches) {
    addIssue(
      issues,
      "input.cp40_payload_mismatch",
      "input",
      "cp40Report",
      "The parsed CP40 payload differs from the authenticated committed report.",
    );
  }
  const censusSourceHashMatches =
    censusSourceByteSha256 === EXPECTED_CENSUS_SOURCE_SHA256;
  const policySourceHashMatches =
    policySourceByteSha256 === EXPECTED_POLICY_SOURCE_SHA256;
  const accepted =
    exactPathSet &&
    allByteHashesWellFormed &&
    allDeclaredFileHashesMatch &&
    cp40PayloadHashMatches &&
    cp40FullGuardPassed &&
    censusSourceHashMatches &&
    policySourceHashMatches;
  return {
    dependencySetClassification:
      "authenticated-declared-non-self-selected-checkpoint-inputs",
    dependencySetExhaustive: false,
    transitiveModuleGraphClaimed: false,
    selectedInputsAuthenticatedBeforeCensusExecution: accepted,
    expectedFileCount: 3,
    observedFileCount: generatedFrom.length,
    exactPathSet,
    allByteHashesWellFormed,
    allDeclaredFileHashesMatch,
    cp40ByteSha256,
    cp40PayloadSha256,
    cp40PayloadHashMatches,
    cp40FullGuardPassed,
    cp40CompactNodeTableSha256:
      input.cp40Report.authentication.compactNodeTableSha256,
    cp40ReviewProjectionSha256:
      input.cp40Report.authentication.reviewProjectionSha256,
    cp40PolicyAuditSha256: input.cp40Report.authentication.policyAuditSha256,
    censusSourceByteSha256,
    censusSourceHashMatches,
    policySourceByteSha256,
    policySourceHashMatches,
    authentication: accepted ? "accepted" : "rejected",
  };
}

function completeReport(
  generatedFrom: CachedPolicyRobustnessCensusHashedInput[],
  sourceAuthentication: SourceAuthentication,
  censusInputBoundary: CensusInputBoundary,
  execution: ExecutionBoundary,
  census: CachedPolicyRobustnessCensus,
  projectionSha256: string,
): KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport {
  return {
    ...reportShell(
      generatedFrom,
      [],
      sourceAuthentication,
      censusInputBoundary,
      execution,
    ),
    validationStatus:
      "authenticated-completed-cached-policy-robustness-census-source-not-ready",
    census,
    authentication: {
      censusInputProjectionSha256: projectionSha256,
      censusPayloadSha256: census.censusPayloadSha256,
      reportContentSha256: "",
    },
  };
}

function emptyReport(
  generatedFrom: CachedPolicyRobustnessCensusHashedInput[],
  issues: CachedPolicyRobustnessCensusIssue[],
  sourceAuthentication: SourceAuthentication,
  censusInputBoundary: CensusInputBoundary,
  execution: ExecutionBoundary,
  projectionSha256: string | null = null,
): KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport {
  return {
    ...reportShell(
      generatedFrom,
      issues,
      sourceAuthentication,
      censusInputBoundary,
      execution,
    ),
    validationStatus: "not-authenticated",
    census: null,
    authentication: {
      censusInputProjectionSha256: projectionSha256,
      censusPayloadSha256: null,
      reportContentSha256: "",
    },
  };
}

function reportShell(
  generatedFrom: CachedPolicyRobustnessCensusHashedInput[],
  issues: CachedPolicyRobustnessCensusIssue[],
  sourceAuthentication: SourceAuthentication,
  censusInputBoundary: CensusInputBoundary,
  executionBoundaryValue: ExecutionBoundary,
): Omit<
  KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
  "validationStatus" | "census" | "authentication"
> {
  return {
    schemaVersion: 1,
    classification:
      "keqing-ineffa-furina-xilonen-cached-policy-robustness-census",
    censusId:
      KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_ID,
    generatedFrom,
    issues,
    sourceAuthentication,
    sourceBoundary: fixedSourceBoundary(),
    censusInputBoundary,
    executionBoundary: executionBoundaryValue,
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

function fixedSourceBoundary(): KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport["sourceBoundary"] {
  return {
    exactTeamRecordId: EXACT_TEAM_RECORD_ID,
    exactCharacterIds: [...EXACT_CHARACTER_IDS],
    objectiveReviewStatus: "unreviewed",
    sourceReadinessBlockerCount: 8,
    sourceReadyForGuideClaims: false,
    sourceReadyForGameplayClaims: false,
    sourcePublishedWholeCandidateCount: 0,
  };
}

function completeCensusInputBoundary(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  projectionSha256: string,
): CensusInputBoundary {
  return {
    evaluationSource: "authenticated-cached-cp40-node-table-only",
    nodeCount: report.nodes.length,
    startCount: report.nodes.length,
    exactNodeSequence: true,
    exactCartesianClosure: report.latticeBoundary.exactCartesianClosure,
    dimensions: [...report.latticeBoundary.dimensions],
    declaredFirstImprovementOrder:
      report.latticeBoundary.declaredFirstImprovementOrder.map(
        ({ dimension, candidateValues }) => ({
          dimension,
          candidateValues: [...candidateValues],
        }),
      ),
    direction: "maximize",
    technicalObjectiveTolerance: {
      ...report.latticeBoundary.technicalObjectiveTolerance,
    },
    censusInputProjectionSha256: projectionSha256,
    reviewOccurrenceCount: report.reviewBoundary.occurrenceCount,
    reviewComparisonRowCount: report.reviewBoundary.comparisonRowCount,
    reviewUsedForObjective: false,
    reviewUsedAsPolicyFilter: false,
    reviewDiagnosticsProjectedIntoCensusInput: false,
    cp40PolicyAuditProjectedIntoCensusInput: false,
    energyRecoveryProvenanceReadForAuthentication:
      report.reviewBoundary.energyRecoveryProvenanceReadForAuthentication,
    energyRecoveryValuesProjectedIntoCensusInput: false,
  };
}

function emptyCensusInputBoundary(): CensusInputBoundary {
  return {
    evaluationSource: "authenticated-cached-cp40-node-table-only",
    nodeCount: 0,
    startCount: 0,
    exactNodeSequence: false,
    exactCartesianClosure: false,
    dimensions: [],
    declaredFirstImprovementOrder: [],
    direction: "maximize",
    technicalObjectiveTolerance: { ...EXPECTED_TOLERANCE },
    censusInputProjectionSha256: null,
    reviewOccurrenceCount: 0,
    reviewComparisonRowCount: 0,
    reviewUsedForObjective: false,
    reviewUsedAsPolicyFilter: false,
    reviewDiagnosticsProjectedIntoCensusInput: false,
    cp40PolicyAuditProjectedIntoCensusInput: false,
    energyRecoveryProvenanceReadForAuthentication: false,
    energyRecoveryValuesProjectedIntoCensusInput: false,
  };
}

function executionBoundary(
  censusBuilderCalls: number,
  reportedPolicyCalls: number | null,
  productionEnvironment: ExecutionBoundary["censusProductionEnvironment"],
): ExecutionBoundary {
  const defaultEnvironment =
    productionEnvironment === "default-cached-policy-robustness-census";
  const forbiddenCallCount = defaultEnvironment ? 0 : null;
  return {
    scheduling: "sequential",
    censusProductionEnvironment: productionEnvironment,
    censusBuilderCalls,
    censusReportedPolicyCalls: reportedPolicyCalls,
    censusReportedEvaluatorCalls: defaultEnvironment ? 0 : null,
    outerGuardInvocationCountAttested: false,
    actualTotalPolicyCallsAttested: false,
    forbiddenSeamCallCountsAttestation: defaultEnvironment
      ? "verified-zero-default-environment"
      : "uncharacterized-injected-environment",
    generatorCalls: forbiddenCallCount,
    damageReplayCalls: forbiddenCallCount,
    downstreamOptimizerCalls: forbiddenCallCount,
    recommendationCalls: forbiddenCallCount,
    rankCalls: forbiddenCallCount,
    energyRecoveryCalls: forbiddenCallCount,
    energyRecoveryValuesInfluencedCensus: defaultEnvironment ? false : null,
  };
}

function expectedCensusFactsHold(
  census: CachedPolicyRobustnessCensus,
): boolean {
  return (
    census.schemaVersion === 1 &&
    census.classification === "cached-lattice-policy-robustness-census" &&
    census.interpretation === "technical-policy-audit-only" &&
    census.evaluationSource === "cached-node-table-only" &&
    census.direction === "maximize" &&
    exactEqual(census.tolerance, EXPECTED_TOLERANCE) &&
    census.nodeCount === 36 &&
    census.startCount === 36 &&
    census.evaluatorCalls === 0 &&
    census.tableReference.technicalObjective === 926093.666196721 &&
    census.oneShotAllStarts.traceCount === 36 &&
    census.oneShotAllStarts.movedTraceCount === 34 &&
    census.oneShotAllStarts.unchangedTraceCount === 2 &&
    census.oneShotAllStarts.resultAtLocalTerminalCount === 12 &&
    census.oneShotAllStarts.resultOutsideLocalTerminalsCount === 24 &&
    exactEqual(census.oneShotAllStarts.moveCountHistogram, [
      { moveCount: 0, traceCount: 2 },
      { moveCount: 1, traceCount: 34 },
    ]) &&
    census.oneShotAllStarts.traceSignaturesSha256 ===
      EXPECTED_ONE_SHOT_TRACE_SHA256 &&
    census.bestImprovementAllStarts.traceCount === 36 &&
    census.bestImprovementAllStarts.referenceTerminalStartCount === 24 &&
    census.bestImprovementAllStarts.otherTerminalStartCount === 12 &&
    census.bestImprovementAllStarts.terminalBasins.length === 2 &&
    census.bestImprovementAllStarts.terminalBasins[0]
      ?.startNodeIdsSha256 === EXPECTED_REFERENCE_BASIN_SHA256 &&
    census.bestImprovementAllStarts.terminalBasins[1]?.startNodeIdsSha256 ===
      EXPECTED_OTHER_BASIN_SHA256 &&
    census.bestImprovementAllStarts.traceSignaturesSha256 ===
      EXPECTED_BEST_TRACE_SHA256 &&
    census.declaredOrderFamily.syntacticDimensionOrderPermutationCount === 24 &&
    census.declaredOrderFamily.structurallyEffectiveDimensionOrderPermutationCount ===
      24 &&
    census.declaredOrderFamily.syntacticCandidateValuePermutationProduct === 144 &&
    census.declaredOrderFamily.structurallyEffectiveCandidateOrderProduct === 36 &&
    census.declaredOrderFamily.syntacticOrderCount === 3456 &&
    census.declaredOrderFamily.effectiveOrderCount === 864 &&
    census.declaredOrderFamily.traceCount === 31_104 &&
    census.declaredOrderFamily.referenceTerminalTraceCount === 18_576 &&
    census.declaredOrderFamily.otherTerminalTraceCount === 12_528 &&
    census.declaredOrderFamily.distinctReferenceTerminalBasinSizeCount === 10 &&
    census.declaredOrderFamily.distinctStartPartitionCount === 13 &&
    census.declaredOrderFamily.distinctAllStartPathFamilyCount === 96 &&
    census.declaredOrderFamily.longestMoveCount === 7 &&
    census.declaredOrderFamily.orderFamilySha256 ===
      EXPECTED_ORDER_FAMILY_SHA256 &&
    census.declaredOrderFamily.traceSignaturesSha256 ===
      EXPECTED_DECLARED_TRACE_SHA256 &&
    census.declaredOrderFamily.allStartPathFamiliesSha256 ===
      EXPECTED_PATH_FAMILIES_SHA256 &&
    census.declaredOrderFamily.witnesses[0]?.orderSha256 ===
      EXPECTED_CANONICAL_ORDER_SHA256 &&
    exactEqual(census.execution, {
      oneShotPolicyCalls: 36,
      bestImprovementPolicyCalls: 36,
      declaredFirstImprovementPolicyCalls: 31_104,
      tableReferenceCalls: 1,
      totalPolicyCalls: 31_177,
      generatorCalls: 0,
      damageReplayCalls: 0,
      downstreamOptimizerCalls: 0,
      recommendationCalls: 0,
      rankCalls: 0,
      energyRecoveryCalls: 0,
    }) &&
    census.censusPayloadSha256 === EXPECTED_CENSUS_PAYLOAD_SHA256 &&
    census.censusPayloadSha256 === censusPayloadSha256(census)
  );
}

function completeReportSemanticsHold(
  report: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
): boolean {
  const injected =
    report.executionBoundary.censusProductionEnvironment ===
    "injected-uncharacterized-census-builder";
  const expectedContentSha256 = injected
    ? EXPECTED_INJECTED_REPORT_CONTENT_SHA256
    : EXPECTED_DEFAULT_REPORT_CONTENT_SHA256;
  const expectedFullSha256 = injected
    ? EXPECTED_INJECTED_FULL_REPORT_SHA256
    : EXPECTED_DEFAULT_FULL_REPORT_SHA256;
  if (
    report.validationStatus !==
      "authenticated-completed-cached-policy-robustness-census-source-not-ready" ||
    report.issues.length !== 0 ||
    report.sourceAuthentication.authentication !== "accepted" ||
    !report.sourceAuthentication
      .selectedInputsAuthenticatedBeforeCensusExecution ||
    report.sourceAuthentication.expectedFileCount !== 3 ||
    report.sourceAuthentication.observedFileCount !== 3 ||
    !report.sourceAuthentication.exactPathSet ||
    !report.sourceAuthentication.allByteHashesWellFormed ||
    !report.sourceAuthentication.allDeclaredFileHashesMatch ||
    report.sourceAuthentication.cp40ByteSha256 !== EXPECTED_CP40_SHA256 ||
    report.sourceAuthentication.cp40PayloadSha256 !== EXPECTED_CP40_SHA256 ||
    !report.sourceAuthentication.cp40PayloadHashMatches ||
    !report.sourceAuthentication.cp40FullGuardPassed ||
    report.sourceAuthentication.cp40CompactNodeTableSha256 !==
      EXPECTED_CP40_COMPACT_NODE_TABLE_SHA256 ||
    report.sourceAuthentication.cp40ReviewProjectionSha256 !==
      EXPECTED_CP40_REVIEW_PROJECTION_SHA256 ||
    report.sourceAuthentication.cp40PolicyAuditSha256 !==
      EXPECTED_CP40_POLICY_AUDIT_SHA256 ||
    report.sourceAuthentication.censusSourceByteSha256 !==
      EXPECTED_CENSUS_SOURCE_SHA256 ||
    !report.sourceAuthentication.censusSourceHashMatches ||
    report.sourceAuthentication.policySourceByteSha256 !==
      EXPECTED_POLICY_SOURCE_SHA256 ||
    !report.sourceAuthentication.policySourceHashMatches ||
    !exactEqual(report.generatedFrom, expectedGeneratedFrom()) ||
    !exactEqual(report.sourceBoundary, fixedSourceBoundary()) ||
    !completeInputBoundarySemanticsHold(report.censusInputBoundary) ||
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
    !report.census ||
    !expectedCensusFactsHold(report.census) ||
    (!isBootstrap(EXPECTED_CENSUS_INPUT_PROJECTION_SHA256) &&
      report.authentication.censusInputProjectionSha256 !==
        EXPECTED_CENSUS_INPUT_PROJECTION_SHA256) ||
    report.authentication.censusInputProjectionSha256 !==
      report.censusInputBoundary.censusInputProjectionSha256 ||
    report.authentication.censusPayloadSha256 !==
      EXPECTED_CENSUS_PAYLOAD_SHA256 ||
    report.authentication.censusPayloadSha256 !==
      report.census.censusPayloadSha256 ||
    !exactEqual(report.cautions, fixedCautions()) ||
    !exactEqual(
      report.prohibitedInterpretations,
      fixedProhibitedInterpretations(),
    )
  ) {
    return false;
  }
  return (
    (isBootstrap(expectedContentSha256) ||
      report.authentication.reportContentSha256 === expectedContentSha256) &&
    (isBootstrap(expectedFullSha256) ||
      hashPayload(report) === expectedFullSha256)
  );
}

function completeInputBoundarySemanticsHold(
  boundary: CensusInputBoundary,
): boolean {
  return (
    boundary.evaluationSource ===
      "authenticated-cached-cp40-node-table-only" &&
    boundary.nodeCount === 36 &&
    boundary.startCount === 36 &&
    boundary.exactNodeSequence &&
    boundary.exactCartesianClosure &&
    exactEqual(boundary.dimensions, EXPECTED_DIMENSIONS) &&
    hashPayload(boundary.declaredFirstImprovementOrder) ===
      EXPECTED_CANONICAL_ORDER_SHA256 &&
    boundary.direction === "maximize" &&
    exactEqual(boundary.technicalObjectiveTolerance, EXPECTED_TOLERANCE) &&
    (isBootstrap(EXPECTED_CENSUS_INPUT_PROJECTION_SHA256) ||
      boundary.censusInputProjectionSha256 ===
        EXPECTED_CENSUS_INPUT_PROJECTION_SHA256) &&
    boundary.reviewOccurrenceCount === 576 &&
    boundary.reviewComparisonRowCount === 4608 &&
    !boundary.reviewUsedForObjective &&
    !boundary.reviewUsedAsPolicyFilter &&
    !boundary.reviewDiagnosticsProjectedIntoCensusInput &&
    !boundary.cp40PolicyAuditProjectedIntoCensusInput &&
    boundary.energyRecoveryProvenanceReadForAuthentication &&
    !boundary.energyRecoveryValuesProjectedIntoCensusInput
  );
}

function executionBoundarySemanticsHold(boundary: ExecutionBoundary): boolean {
  if (
    boundary.censusProductionEnvironment !==
      "default-cached-policy-robustness-census" &&
    boundary.censusProductionEnvironment !==
      "injected-uncharacterized-census-builder"
  ) {
    return false;
  }
  return exactEqual(
    boundary,
    executionBoundary(
      1,
      31_177,
      boundary.censusProductionEnvironment,
    ),
  );
}

function fixedCapabilities(): KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport["capabilities"] {
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
    "This is an exhaustive cached-policy robustness census over the exact authenticated CP40 36-node bounded technical table: all 36 starts for one-shot and best-improvement policies and all 864 structurally effective declared orders across all 36 starts. It does not generate or evaluate new equipment.",
    "The technical objective remains unreviewed and source-not-ready with eight retained blockers. The census establishes deterministic behavior only inside this finite cached table, not rotation validity, gameplay applicability, damage, DPS, equipment advice, or global optimality.",
    "The default environment reports 31,177 cached policy calls and verifies zero generator, damage-replay, downstream-optimizer, recommendation, rank, and ER calls. Injected census builders are uninstrumented for those side effects and therefore retain null call attestations.",
    "CP40 occurrence diagnostics and its prior four policy traces are authenticated provenance but are not projected into the census input. Review rows remain excluded from the objective and every policy filter.",
    "CP40 ER-deferral provenance is authenticated. No ER value is projected into the census input, no ER value influences the default census, and no ER calculation is performed.",
    "The declared input paths are a selected non-self checkpoint boundary, not an exhaustive dependency closure or transitive module-graph claim.",
  ];
}

function fixedProhibitedInterpretations(): string[] {
  return [
    "guide",
    "recommendation",
    "rank",
    "scalar-weight",
    "optimizer-result",
    "damage-claim",
    "dps-claim",
    "gameplay-claim",
    "global-optimum",
    "equipment-optimum",
    "energy-requirement",
    "er-calculation",
    "cp40-review-objective",
  ];
}

function finalizeReport(
  report: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
): KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport {
  const finalized = structuredClone(report);
  finalized.authentication.reportContentSha256 = reportContentSha256(finalized);
  if (
    finalized.validationStatus ===
    "authenticated-completed-cached-policy-robustness-census-source-not-ready"
  ) {
    requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
      finalized,
    );
  }
  return finalized;
}

function reportContentSha256(
  report: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
): string {
  return hashPayload({
    ...report,
    authentication: {
      ...report.authentication,
      reportContentSha256: "",
    },
  });
}

function censusPayloadSha256(census: CachedPolicyRobustnessCensus): string {
  const { censusPayloadSha256: _digest, ...withoutDigest } = census;
  return hashPayload(withoutDigest);
}

function expectedGeneratedFrom(): CachedPolicyRobustnessCensusHashedInput[] {
  return KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_INPUT_PATHS.map(
    (inputPath) => ({ path: inputPath, sha256: EXPECTED_INPUT_SHA256[inputPath] }),
  );
}

function inputHash(
  generatedFrom: CachedPolicyRobustnessCensusHashedInput[],
  expectedPath: string,
): string | null {
  return (
    generatedFrom.find(({ path: inputPath }) => inputPath === expectedPath)
      ?.sha256 ?? null
  );
}

function addIssue(
  issues: CachedPolicyRobustnessCensusIssue[],
  code: string,
  stage: CachedPolicyRobustnessCensusIssue["stage"],
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

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isBootstrap(value: string): boolean {
  return value === "BOOTSTRAP";
}
