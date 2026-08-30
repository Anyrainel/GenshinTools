import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ReplayComboLine } from "./computationReplay";
import { sha256Text, stableJson } from "./io";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";
import type { XiaoFfxxNonErConditionFreeBranchCandidateContractReport } from "./xiaoFfxxNonErConditionFreeBranchCandidateContract";
import {
  authenticateXiaoFfxxGroupedReplayRepresentationPreflight,
  XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
  type BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
  type XiaoFfxxGroupedReplayCandidateObservation,
  type XiaoFfxxGroupedReplayRepresentationPreflightReport,
} from "./xiaoFfxxGroupedReplayRepresentationPreflight";

const FACTORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-grouped-replay-representation-preflight.json";
const BRANCH_CANDIDATE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-non-er-condition-free-branch-candidate-contract.json";
const CORE_PATH =
  "scripts/guide-factory/src/xiaoFfxxUnitExpandedExecutionGate.ts";
const CLI_PATH =
  "scripts/guide-factory/src/assemble-xiao-ffxx-unit-expanded-execution-gate.ts";
const GATE_ID =
  "guide-factory-xiao-ffxx-unit-expanded-execution-gate-version-5-5";
const EXPECTED_INPUT_PATH_COUNT = 121;
const EXPECTED_JSON_INPUT_COUNT = 13;
const NORMALIZATION_TOLERANCE = 1e-9;
const EXPECTED_INPUT_LINE_MAPPINGS = [
  {
    inputLineIndex: 0,
    inputCount: 2,
    normalizedStartIndex: 0,
    normalizedEndIndexExclusive: 2,
  },
  {
    inputLineIndex: 1,
    inputCount: 11,
    normalizedStartIndex: 2,
    normalizedEndIndexExclusive: 13,
  },
] as const;

const JSON_INPUT_PATHS = {
  repositoryInput: "scripts/guide-factory/data/knowledge/repository.json",
  xiaoManualSnapshotInput:
    "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json",
  xiaoRotationFixtureSnapshotInput:
    "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json",
  genshinToolsSnapshotInput:
    "scripts/guide-factory/data/source-snapshots/genshintools-presets.json",
  manualIndexInput:
    "scripts/guide-factory/data/source-snapshots/manual-index.json",
  sourceRegistryInput: "scripts/guide-factory/sources/registry.json",
  xiaoSourceLocalDurableReportInput:
    "scripts/guide-factory/reports/xiao-source-local-condition-slice.json",
  applicableClaimDurableReportInput:
    "scripts/guide-factory/reports/xiao-ffxx-applicable-claim-projection-contract.json",
  partialCandidateDurableReportInput:
    "scripts/guide-factory/reports/xiao-ffxx-partial-artifact-candidate-contract.json",
  branchSourceDurableReportInput:
    "scripts/guide-factory/reports/xiao-non-er-equipment-branch-source-slice.json",
  branchCandidateDurableReportInput: BRANCH_CANDIDATE_REPORT_RELATIVE_PATH,
  formulaCountDurableReportInput:
    "scripts/guide-factory/reports/xiao-formula-count-parity.json",
  groupedReplayDurableReportInput: UPSTREAM_REPORT_RELATIVE_PATH,
} as const;

const CAUTIONS = [
  "This gate validates one Xiao FFXX wrapper fixture only; it is not a generic count-normalization result.",
  "Contiguous unit expansion preserves the wrapper-authored line order but does not validate gameplay order, timing, buff duration, rotation feasibility, or DPS.",
  "The six numeric rows are technical execution observations. They are not sorted by damage and authorize no weapon, build, stat, or guide claim.",
  "Circlet, substats, and Energy Recharge remain absent and deferred.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not rank, select, recommend, or name a winning weapon from this report.",
  "Do not treat technical eligibility as comparison eligibility or as a player-facing damage claim.",
  "Do not generalize this Xiao-only policy to reactions, formula overrides, other stack-limited buffs, or other counted plans.",
  "Do not infer a complete build, ideal rolls, rotation quality, DPS, or Energy Recharge requirement.",
] as const;

export const XIAO_FFXX_UNIT_EXPANSION_MAX_LINES = 13;

export interface XiaoFfxxUnitExpandedExecutionGateSourceFile {
  path: string;
  bytesBase64: string;
}

export interface BuildXiaoFfxxUnitExpandedExecutionGateInput {
  repositoryInput: unknown;
  xiaoManualSnapshotInput: unknown;
  xiaoRotationFixtureSnapshotInput: unknown;
  genshinToolsSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  xiaoSourceLocalDurableReportInput: unknown;
  applicableClaimDurableReportInput: unknown;
  partialCandidateDurableReportInput: unknown;
  branchSourceDurableReportInput: unknown;
  branchCandidateDurableReportInput: unknown;
  formulaCountDurableReportInput: unknown;
  groupedReplayDurableReportInput: unknown;
  sourceFiles: readonly XiaoFfxxUnitExpandedExecutionGateSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface XiaoFfxxUnitExpansionMapping {
  inputLineIndex: number;
  inputCount: number;
  normalizedStartIndex: number;
  normalizedEndIndexExclusive: number;
}

export interface XiaoFfxxUnitExpansionResult {
  lines: ReplayComboLine[];
  inputLineMappings: XiaoFfxxUnitExpansionMapping[];
  inputLineCount: number;
  inputOccurrenceCount: number;
  normalizedLineCount: number;
}

export interface XiaoFfxxUnitExpandedTechnicalObservation {
  candidateId: string;
  candidateIdentitySha256: string;
  weaponId: string;
  refinement: 1 | 5;
  executedViewId: "source-only-ffxx";
  normalizedExecution: {
    evidenceOrigin: "fresh-authenticated-checkpoint-47-canonical-rebuild";
    checkpoint48AdditionalReplayExecuted: false;
    groupedInterpretedReferenceTotalDamage: number;
    unitExpandedDirectTotalDamage: number;
    unitExpandedCompiledTotalDamage: number;
    absoluteDifference: number;
    allowedDifference: number;
    dualPathAgreement: true;
    groupedDirectUnitExpandedDirectAgreement: true;
    groupedDirectMinusUnitExpandedDirect: number;
  };
  activationEvidence: {
    buffKey: string;
    perPlungeOccurrence: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0];
    totalActivation: 8;
    exactExpectedSequence: true;
  };
  technicalObservationEligible: true;
  comparisonEligible: false;
  factoryRank: null;
  winner: false;
  recommendation: false;
  observationSha256: string;
}

export interface XiaoFfxxUnitExpandedExecutionGateReport {
  schemaVersion: 1;
  reportType: "xiao-ffxx-unit-expanded-execution-gate";
  gateId: typeof GATE_ID;
  classification: "authenticated-bounded-xiao-unit-expanded-execution-gate";
  validationStatus: "accepted";
  comparisonExecutionStatus: "not-performed";
  publicationStatus: "withheld-unreviewed-fixture-and-order";
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true;
    combinedJsonInputByteAndParsedObjectParity: true;
    sourceFileCount: 121;
    generatedFromCount: 121;
    authenticatedJsonInputParityCount: 13;
  };
  upstreamBoundary: {
    durableReportPath: typeof UPSTREAM_REPORT_RELATIVE_PATH;
    durableReportFileSha256: string;
    durableReportCanonicalObjectSha256: string;
    freshlyAuthenticated: true;
    upstreamInputCount: 118;
    groupedReplayAttemptCount: 6;
    groupedRawDualPathCaptureCount: 6;
    unitExpandedAcceptedReplayCount: 6;
    rejectedArtifactSheetProbeCount: 1;
    checkpoint48AdditionalReplayCount: 0;
  };
  normalizationBoundary: {
    policyId: "xiao-contiguous-unit-expansion-v1";
    policyScope: "xiao-ffxx-checkpoint-47-counted-plan-only";
    genericNormalizationSafetyClaim: false;
    normalizationAuthoredBy: "guide-factory-checkpoint-48-wrapper";
    formulaIdAndCountOwnership: "guide-factory-checkpoint-42-calculator-default";
    lineOrderAndExecutionFlagOwnership: "guide-factory-checkpoint-47-wrapper";
    positiveSafeIntegerCountsRequired: true;
    maximumExpandedLineCount: 13;
    contiguousInputLineOrderPreserved: true;
    reactionAndForceOnFieldPreserved: true;
    exactStableEqualityToUpstreamUnitPlan: true;
    formulaBuffOverridesRequiredNull: true;
    inputLineCount: 2;
    inputOccurrenceCount: 13;
    normalizedLineCount: 13;
    inputLineMappings: XiaoFfxxUnitExpansionMapping[];
    groupedPlan: ReplayComboLine[];
    normalizedPlan: ReplayComboLine[];
    gameplayOrderValidated: false;
    buffTimingValidated: false;
  };
  provenanceOnly: {
    sourceGroupCount: 3;
    candidateEdgeCount: 6;
    sourceRanksExcludedFromExecutionIdentity: true;
    sourceGroupsExcludedFromTechnicalObservationIdentity: true;
    groups: Array<{
      branchGroupId: string;
      sourceOccurrenceId: string;
      sourceGroupSha256: string;
      sourceRankGroup: number | null;
      sourceOrdering: "ranked-groups" | "unranked";
      membersTied: boolean;
      candidateIds: string[];
    }>;
    candidateEdges: Array<{
      candidateId: string;
      branchGroupId: string;
      provenanceOnly: true;
    }>;
    provenanceProjectionSha256: string;
  };
  observations: XiaoFfxxUnitExpandedTechnicalObservation[];
  identityBoundary: {
    upstreamCanonicalObjectSha256: string;
    groupedPlanSha256: string;
    normalizedPlanSha256: string;
    normalizationPolicySha256: string;
    technicalObservationSetSha256: string;
    executionGateSha256: string;
    provenanceOnlySha256: string;
    aggregateGateSha256: string;
    sourceRankExcludedFromExecutionIdentity: true;
    excludedRequestViewFactsExcludedFromExecutionIdentity: true;
  };
  summary: {
    candidateCount: 6;
    technicalObservationEligibleCount: 6;
    comparisonCount: 0;
    rankedCandidateCount: 0;
    winnerCount: 0;
    recommendationCount: 0;
    completeBuildCount: 0;
    energyRecoveryComputationCount: 0;
  };
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsBuildRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsWinnerClaims: false;
  supportsDamageClaims: false;
  supportsDamageComparisonClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  normalizationExecuted: true;
  technicalObservationProjectionExecuted: true;
  comparisonExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  autoTuneExecuted: false;
  recommendationCompositionExecuted: false;
  idealRollAllocationExecuted: false;
  energyRecoveryInputsUsed: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
  issues: [];
}

export type XiaoFfxxUnitExpandedExecutionGateAuthentication =
  | { authenticated: true; canonicalReport: XiaoFfxxUnitExpandedExecutionGateReport }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      issues: Array<{ code: string; path: string; message: string }>;
    };

export const XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS = [
  ...new Set([
    ...XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
    UPSTREAM_REPORT_RELATIVE_PATH,
    CORE_PATH,
    CLI_PATH,
  ]),
].sort(compareText);

export const XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_SOURCE_FILE_PATHS = [
  ...XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS,
];

export const XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "xiao-ffxx-unit-expanded-execution-gate.json",
);

export function expandXiaoFfxxCountedPlan(
  lines: readonly ReplayComboLine[],
): XiaoFfxxUnitExpansionResult {
  if (lines.length === 0) throw new Error("Xiao counted plan cannot be empty.");
  const normalizedLines: ReplayComboLine[] = [];
  const inputLineMappings: XiaoFfxxUnitExpansionMapping[] = [];
  for (let inputLineIndex = 0; inputLineIndex < lines.length; inputLineIndex++) {
    const line = lines[inputLineIndex];
    if (!line.charId || !line.formulaId) {
      throw new Error(`Xiao counted plan line ${inputLineIndex} requires character and formula IDs.`);
    }
    if (typeof line.forceOnField !== "boolean") {
      throw new Error(`Xiao counted plan line ${inputLineIndex} requires an explicit forceOnField boolean.`);
    }
    if (!Number.isSafeInteger(line.count) || line.count <= 0) {
      throw new Error(`Xiao counted plan line ${inputLineIndex} count must be a positive safe integer.`);
    }
    const normalizedStartIndex = normalizedLines.length;
    if (normalizedStartIndex + line.count > XIAO_FFXX_UNIT_EXPANSION_MAX_LINES) {
      throw new Error(`Xiao counted plan exceeds the ${XIAO_FFXX_UNIT_EXPANSION_MAX_LINES}-line expansion cap.`);
    }
    for (let occurrence = 0; occurrence < line.count; occurrence++) {
      normalizedLines.push({
        charId: line.charId,
        formulaId: line.formulaId,
        count: 1,
        reaction: cloneReaction(line.reaction),
        forceOnField: line.forceOnField,
      });
    }
    inputLineMappings.push({
      inputLineIndex,
      inputCount: line.count,
      normalizedStartIndex,
      normalizedEndIndexExclusive: normalizedLines.length,
    });
  }
  return {
    lines: normalizedLines,
    inputLineMappings,
    inputLineCount: lines.length,
    inputOccurrenceCount: normalizedLines.length,
    normalizedLineCount: normalizedLines.length,
  };
}

export async function buildXiaoFfxxUnitExpandedExecutionGateReport(
  input: BuildXiaoFfxxUnitExpandedExecutionGateInput,
): Promise<XiaoFfxxUnitExpandedExecutionGateReport> {
  const raw = authenticateRawInputs(input);
  const upstreamInput = toUpstreamInput(input, raw);
  const upstreamAuthentication =
    await authenticateXiaoFfxxGroupedReplayRepresentationPreflight(
      raw.upstreamReport,
      upstreamInput,
    );
  if (!upstreamAuthentication.authenticated) {
    throw new Error(`Checkpoint-47 grouped replay preflight failed fresh authentication (${upstreamAuthentication.reason}).`);
  }
  const upstream = upstreamAuthentication.canonicalReport;
  requireUpstreamBoundary(upstream);

  const expansion = expandXiaoFfxxCountedPlan(upstream.formulaPlanBoundary.groupedPlan);
  requireNormalizationBoundary(expansion);
  if (stableJson(expansion.lines) !== stableJson(upstream.formulaPlanBoundary.unitExpandedPlan)) {
    throw new Error("Independent Xiao count expansion does not exactly equal checkpoint 47's authenticated unit plan.");
  }

  const observations = upstream.observations
    .map(projectObservation)
    .sort((left, right) => compareText(left.candidateId, right.candidateId));
  requireObservationBoundary(observations);
  const provenanceOnly = buildProvenanceOnly(raw.branchCandidateReport, observations);

  const upstreamCanonicalObjectSha256 = hashValue(upstream);
  const groupedPlanSha256 = hashValue(upstream.formulaPlanBoundary.groupedPlan);
  const normalizedPlanSha256 = hashValue(expansion.lines);
  const normalizationPolicy = {
    policyId: "xiao-contiguous-unit-expansion-v1",
    policyScope: "xiao-ffxx-checkpoint-47-counted-plan-only",
    genericNormalizationSafetyClaim: false,
    normalizationAuthoredBy: "guide-factory-checkpoint-48-wrapper",
    formulaIdAndCountOwnership: "guide-factory-checkpoint-42-calculator-default",
    lineOrderAndExecutionFlagOwnership: "guide-factory-checkpoint-47-wrapper",
    positiveSafeIntegerCountsRequired: true,
    maximumExpandedLineCount: XIAO_FFXX_UNIT_EXPANSION_MAX_LINES,
    contiguousInputLineOrderPreserved: true,
    reactionAndForceOnFieldPreserved: true,
    exactStableEqualityToUpstreamUnitPlan: true,
    formulaBuffOverridesRequiredNull: true,
    inputLineCount: expansion.inputLineCount,
    inputOccurrenceCount: expansion.inputOccurrenceCount,
    normalizedLineCount: expansion.normalizedLineCount,
    inputLineMappings: expansion.inputLineMappings,
  };
  const normalizationPolicySha256 = hashValue(normalizationPolicy);
  const technicalObservationSetSha256 = hashValue(
    observations.map(({ observationSha256 }) => observationSha256),
  );
  const executionGateSha256 = hashValue({
    upstreamFixtureSha256: upstream.identityBoundary.fixtureSha256,
    groupedPlanSha256,
    normalizedPlanSha256,
    normalizationPolicySha256,
    technicalObservationSetSha256,
  });
  const provenanceOnlySha256 = provenanceOnly.provenanceProjectionSha256;
  const aggregateGateSha256 = hashValue({ executionGateSha256, provenanceOnlySha256 });

  return {
    schemaVersion: 1,
    reportType: "xiao-ffxx-unit-expanded-execution-gate",
    gateId: GATE_ID,
    classification: "authenticated-bounded-xiao-unit-expanded-execution-gate",
    validationStatus: "accepted",
    comparisonExecutionStatus: "not-performed",
    publicationStatus: "withheld-unreviewed-fixture-and-order",
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      combinedJsonInputByteAndParsedObjectParity: true,
      sourceFileCount: 121,
      generatedFromCount: 121,
      authenticatedJsonInputParityCount: 13,
    },
    upstreamBoundary: {
      durableReportPath: UPSTREAM_REPORT_RELATIVE_PATH,
      durableReportFileSha256: sha256Bytes(raw.sourceBytesByPath.get(UPSTREAM_REPORT_RELATIVE_PATH)!),
      durableReportCanonicalObjectSha256: upstreamCanonicalObjectSha256,
      freshlyAuthenticated: true,
      upstreamInputCount: 118,
      groupedReplayAttemptCount: 6,
      groupedRawDualPathCaptureCount: 6,
      unitExpandedAcceptedReplayCount: 6,
      rejectedArtifactSheetProbeCount: 1,
      checkpoint48AdditionalReplayCount: 0,
    },
    normalizationBoundary: {
      policyId: "xiao-contiguous-unit-expansion-v1",
      policyScope: "xiao-ffxx-checkpoint-47-counted-plan-only",
      genericNormalizationSafetyClaim: false,
      normalizationAuthoredBy: "guide-factory-checkpoint-48-wrapper",
      formulaIdAndCountOwnership: "guide-factory-checkpoint-42-calculator-default",
      lineOrderAndExecutionFlagOwnership: "guide-factory-checkpoint-47-wrapper",
      positiveSafeIntegerCountsRequired: true,
      maximumExpandedLineCount: 13,
      contiguousInputLineOrderPreserved: true,
      reactionAndForceOnFieldPreserved: true,
      exactStableEqualityToUpstreamUnitPlan: true,
      formulaBuffOverridesRequiredNull: true,
      inputLineCount: 2,
      inputOccurrenceCount: 13,
      normalizedLineCount: 13,
      inputLineMappings: expansion.inputLineMappings,
      groupedPlan: cloneLines(upstream.formulaPlanBoundary.groupedPlan),
      normalizedPlan: cloneLines(expansion.lines),
      gameplayOrderValidated: false,
      buffTimingValidated: false,
    },
    provenanceOnly,
    observations,
    identityBoundary: {
      upstreamCanonicalObjectSha256,
      groupedPlanSha256,
      normalizedPlanSha256,
      normalizationPolicySha256,
      technicalObservationSetSha256,
      executionGateSha256,
      provenanceOnlySha256,
      aggregateGateSha256,
      sourceRankExcludedFromExecutionIdentity: true,
      excludedRequestViewFactsExcludedFromExecutionIdentity: true,
    },
    summary: {
      candidateCount: 6,
      technicalObservationEligibleCount: 6,
      comparisonCount: 0,
      rankedCandidateCount: 0,
      winnerCount: 0,
      recommendationCount: 0,
      completeBuildCount: 0,
      energyRecoveryComputationCount: 0,
    },
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsBuildRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsWinnerClaims: false,
    supportsDamageClaims: false,
    supportsDamageComparisonClaims: false,
    supportsRotationClaims: false,
    supportsEnergyRecoveryClaims: false,
    normalizationExecuted: true,
    technicalObservationProjectionExecuted: true,
    comparisonExecuted: false,
    generatorExecuted: false,
    optimizerExecuted: false,
    autoTuneExecuted: false,
    recommendationCompositionExecuted: false,
    idealRollAllocationExecuted: false,
    energyRecoveryInputsUsed: false,
    energyRecoveryComputationExecuted: false,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    issues: [],
  };
}

export async function authenticateXiaoFfxxUnitExpandedExecutionGate(
  serializedReport: XiaoFfxxUnitExpandedExecutionGateReport,
  input: BuildXiaoFfxxUnitExpandedExecutionGateInput,
): Promise<XiaoFfxxUnitExpandedExecutionGateAuthentication> {
  let canonicalReport: XiaoFfxxUnitExpandedExecutionGateReport;
  try {
    canonicalReport = await buildXiaoFfxxUnitExpandedExecutionGateReport(input);
  } catch (error) {
    return {
      authenticated: false,
      reason: "canonical-inputs-rejected",
      issues: [{
        code: "xiao-ffxx-unit-expanded-gate.canonical-input",
        path: "reports.xiao-ffxx-unit-expanded-execution-gate",
        message: errorMessage(error),
      }],
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      issues: [{
        code: "xiao-ffxx-unit-expanded-gate.serialized-report-mismatch",
        path: "reports.xiao-ffxx-unit-expanded-execution-gate",
        message: "Serialized unit-expanded execution gate does not match a fresh authenticated rebuild.",
      }],
    };
  }
  return { authenticated: true, canonicalReport };
}

export async function requireAuthenticatedXiaoFfxxUnitExpandedExecutionGate(
  report: XiaoFfxxUnitExpandedExecutionGateReport,
  input: BuildXiaoFfxxUnitExpandedExecutionGateInput,
): Promise<void> {
  const authentication = await authenticateXiaoFfxxUnitExpandedExecutionGate(report, input);
  if (!authentication.authenticated) {
    throw new Error(`Refusing an unauthenticated Xiao FFXX unit-expanded execution gate (${authentication.reason}): ${authentication.issues.map(({ message }) => message).join("; ")}`);
  }
}

interface AuthenticatedRawInput {
  generatedFrom: GeneratedFromEntry[];
  sourceBytesByPath: Map<string, Buffer>;
  parsedByKey: Record<keyof typeof JSON_INPUT_PATHS, unknown>;
  upstreamReport: XiaoFfxxGroupedReplayRepresentationPreflightReport;
  branchCandidateReport: XiaoFfxxNonErConditionFreeBranchCandidateContractReport;
}

function authenticateRawInputs(
  input: BuildXiaoFfxxUnitExpandedExecutionGateInput,
): AuthenticatedRawInput {
  const expectedPaths = [...XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS];
  if (expectedPaths.length !== EXPECTED_INPUT_PATH_COUNT || Object.keys(JSON_INPUT_PATHS).length !== EXPECTED_JSON_INPUT_COUNT) {
    throw new Error("Xiao unit-expanded execution-gate declared input cardinality drifted.");
  }
  const sourcePaths = input.sourceFiles.map(({ path: sourcePath }) => sourcePath);
  const generatedPaths = input.generatedFrom.map(({ path: sourcePath }) => sourcePath);
  if (stableJson([...sourcePaths].sort(compareText)) !== stableJson(expectedPaths) || new Set(sourcePaths).size !== expectedPaths.length) {
    throw new Error("Xiao unit-expanded execution-gate source-file path closure drifted.");
  }
  if (stableJson([...generatedPaths].sort(compareText)) !== stableJson(expectedPaths) || new Set(generatedPaths).size !== expectedPaths.length) {
    throw new Error("Xiao unit-expanded execution-gate generatedFrom path closure drifted.");
  }
  const sourceBytesByPath = new Map<string, Buffer>();
  for (const entry of input.sourceFiles) sourceBytesByPath.set(entry.path, decodeBase64(entry.bytesBase64, entry.path));
  const generatedByPath = new Map(input.generatedFrom.map((entry) => [entry.path, entry]));
  for (const sourcePath of expectedPaths) {
    const bytes = sourceBytesByPath.get(sourcePath);
    const generated = generatedByPath.get(sourcePath);
    if (!bytes || !generated || !/^[a-f0-9]{64}$/.test(generated.sha256) || sha256Bytes(bytes) !== generated.sha256) {
      throw new Error(`Xiao unit-expanded execution-gate raw hash drifted for ${sourcePath}.`);
    }
  }
  const parsedByKey = {} as Record<keyof typeof JSON_INPUT_PATHS, unknown>;
  for (const [key, sourcePath] of Object.entries(JSON_INPUT_PATHS) as Array<[keyof typeof JSON_INPUT_PATHS, string]>) {
    const parsedInput = input[key];
    const bytes = sourceBytesByPath.get(sourcePath);
    if (!bytes) throw new Error(`Missing Xiao unit-expanded execution-gate source ${sourcePath}.`);
    let parsedFromBytes: unknown;
    try { parsedFromBytes = JSON.parse(bytes.toString("utf8")); } catch (error) {
      throw new Error(`Xiao unit-expanded execution-gate input ${sourcePath} is not JSON: ${errorMessage(error)}`);
    }
    if (stableJson(parsedFromBytes) !== stableJson(parsedInput)) {
      throw new Error(`Xiao unit-expanded execution-gate parsed input disagrees with bytes for ${sourcePath}.`);
    }
    parsedByKey[key] = parsedFromBytes;
  }
  const generatedFrom = expectedPaths.map((sourcePath) => ({ ...generatedByPath.get(sourcePath)! }));
  return {
    generatedFrom,
    sourceBytesByPath,
    parsedByKey,
    upstreamReport: parsedByKey.groupedReplayDurableReportInput as XiaoFfxxGroupedReplayRepresentationPreflightReport,
    branchCandidateReport: parsedByKey.branchCandidateDurableReportInput as XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
  };
}

function toUpstreamInput(
  input: BuildXiaoFfxxUnitExpandedExecutionGateInput,
  raw: AuthenticatedRawInput,
): BuildXiaoFfxxGroupedReplayRepresentationPreflightInput {
  const upstreamPathSet = new Set(XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS);
  const parsed = raw.parsedByKey;
  return {
    repositoryInput: parsed.repositoryInput,
    xiaoManualSnapshotInput: parsed.xiaoManualSnapshotInput,
    xiaoRotationFixtureSnapshotInput: parsed.xiaoRotationFixtureSnapshotInput,
    genshinToolsSnapshotInput: parsed.genshinToolsSnapshotInput,
    manualIndexInput: parsed.manualIndexInput,
    sourceRegistryInput: parsed.sourceRegistryInput,
    xiaoSourceLocalDurableReportInput: parsed.xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput: parsed.applicableClaimDurableReportInput,
    partialCandidateDurableReportInput: parsed.partialCandidateDurableReportInput,
    branchSourceDurableReportInput: parsed.branchSourceDurableReportInput,
    branchCandidateDurableReportInput: parsed.branchCandidateDurableReportInput,
    formulaCountDurableReportInput: parsed.formulaCountDurableReportInput,
    sourceFiles: input.sourceFiles.filter(({ path: sourcePath }) => upstreamPathSet.has(sourcePath)),
    generatedFrom: input.generatedFrom.filter(({ path: sourcePath }) => upstreamPathSet.has(sourcePath)),
  };
}

function requireUpstreamBoundary(report: XiaoFfxxGroupedReplayRepresentationPreflightReport): void {
  if (
    report.comparisonStatus !== "not-comparable" ||
    report.summary.candidateCount !== 6 ||
    report.summary.comparableCandidateCount !== 0 ||
    report.summary.rankedCandidateCount !== 0 ||
    report.summary.winnerCount !== 0 ||
    report.summary.recommendationCount !== 0 ||
    report.summary.completeBuildCount !== 0 ||
    report.summary.energyRecoveryComputationCount !== 0 ||
    report.representationBoundary.groupedReplayCount !== 6 ||
    report.representationBoundary.groupedRawDualPathCaptureCount !== 6 ||
    report.representationBoundary.unitExpandedAgreementCount !== 6 ||
    !report.representationBoundary.unitExpandedReplayAccepted ||
    report.fixtureBoundary.formulaBuffOverrideCount !== 0 ||
    !report.fixtureBoundary.rejectedArtifactSheetVariant.variantReplayExecuted ||
    report.fixtureBoundary.rejectedArtifactSheetVariant
      .fullCandidateDomainEvaluationExecuted ||
    report.executionScope.executedViewId !== "source-only-ffxx" ||
    stableJson(report.executionScope.excludedViewIds) !==
      stableJson(["exact-ffxx-plus-wrapper-c6"]) ||
    report.executionScope.excludedC6ViewAffectedConfiguration ||
    report.executionScope.excludedC6ViewAffectedCandidateIdentity ||
    report.executionScope.excludedC6ViewExecuted ||
    report.executionScope.completeBuildCount !== 0 ||
    !report.identityBoundary.sourceRankExcludedFromExecutionIdentity ||
    !report.identityBoundary.excludedRequestViewFactsExcludedFromExecutionIdentity ||
    report.formulaPlanBoundary.formulaIdAndCountOwnership !==
      "guide-factory-checkpoint-42-calculator-default" ||
    report.formulaPlanBoundary.lineOrderAndExecutionFlagOwnership !==
      "guide-factory-checkpoint-47-wrapper" ||
    report.formulaPlanBoundary.unitExpandedLineCount !== 13 ||
    report.formulaPlanBoundary.sourceTwelvePlungePlanExecuted
  ) {
    throw new Error("Checkpoint 47 no longer exposes the exact bounded grouped/unit-expanded witness required by checkpoint 48.");
  }
}

function requireNormalizationBoundary(expansion: XiaoFfxxUnitExpansionResult): void {
  if (
    expansion.inputLineCount !== 2 ||
    expansion.inputOccurrenceCount !== XIAO_FFXX_UNIT_EXPANSION_MAX_LINES ||
    expansion.normalizedLineCount !== XIAO_FFXX_UNIT_EXPANSION_MAX_LINES ||
    stableJson(expansion.inputLineMappings) !==
      stableJson(EXPECTED_INPUT_LINE_MAPPINGS)
  ) {
    throw new Error(
      "Checkpoint 47 no longer exposes the exact two-line to thirteen-unit Xiao normalization mapping.",
    );
  }
}

function projectObservation(
  observation: XiaoFfxxGroupedReplayCandidateObservation,
): XiaoFfxxUnitExpandedTechnicalObservation {
  const groupedDirectTotal = observation.groupedReplay.directTotalDamage;
  const unitDirectTotal = observation.unitExpandedReplay.directTotalDamage;
  const unitCompiledTotal = observation.unitExpandedReplay.compiledTotalDamage;
  const allowedDifference = observation.unitExpandedReplay.allowedDifference;
  if (
    !Number.isFinite(groupedDirectTotal) ||
    !Number.isFinite(unitDirectTotal) ||
    !Number.isFinite(unitCompiledTotal) ||
    !Number.isFinite(allowedDifference) ||
    allowedDifference < 0
  ) {
    throw new Error(
      `Checkpoint 47 observation ${observation.candidateId} contains a non-finite total or invalid tolerance.`,
    );
  }
  const absoluteDifference = normalizeNumber(
    Math.abs(unitDirectTotal - unitCompiledTotal),
  );
  const groupedDirectMinusUnitExpandedDirect = normalizeNumber(
    groupedDirectTotal - unitDirectTotal,
  );
  if (
    observation.sourceOnlyViewId !== "source-only-ffxx" ||
    stableJson(observation.excludedViewIds) !==
      stableJson(["exact-ffxx-plus-wrapper-c6"]) ||
    !observation.unitExpandedReplay.replayTeamDamageAccepted ||
    !observation.unitExpandedReplay.calculatorAgreement ||
    !observation.crossRepresentation.groupedDirectEqualsExpandedDirect ||
    observation.comparisonEligible ||
    observation.factoryRank != null ||
    observation.winner ||
    observation.recommendation ||
    observation.unitExpandedReplay.xianyunTotalActivation !== 8 ||
    stableJson(observation.unitExpandedReplay.xianyunPerCastActivationSequence) !== stableJson([1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]) ||
    absoluteDifference > allowedDifference ||
    Math.abs(groupedDirectMinusUnitExpandedDirect) > NORMALIZATION_TOLERANCE
  ) {
    throw new Error(`Checkpoint 47 observation ${observation.candidateId} is not eligible for the bounded unit-expanded gate.`);
  }
  const withoutHash = {
    candidateId: observation.candidateId,
    candidateIdentitySha256: observation.candidateIdentitySha256,
    weaponId: observation.weaponId,
    refinement: observation.refinement,
    executedViewId: "source-only-ffxx" as const,
    normalizedExecution: {
      evidenceOrigin: "fresh-authenticated-checkpoint-47-canonical-rebuild" as const,
      checkpoint48AdditionalReplayExecuted: false as const,
      groupedInterpretedReferenceTotalDamage: groupedDirectTotal,
      unitExpandedDirectTotalDamage: unitDirectTotal,
      unitExpandedCompiledTotalDamage: unitCompiledTotal,
      absoluteDifference,
      allowedDifference,
      dualPathAgreement: true as const,
      groupedDirectUnitExpandedDirectAgreement: true as const,
      groupedDirectMinusUnitExpandedDirect,
    },
    activationEvidence: {
      buffKey: observation.unitExpandedReplay.xianyunStackLimitedBuffKey,
      perPlungeOccurrence: [...observation.unitExpandedReplay.xianyunPerCastActivationSequence] as [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
      totalActivation: 8 as const,
      exactExpectedSequence: true as const,
    },
    technicalObservationEligible: true as const,
    comparisonEligible: false as const,
    factoryRank: null,
    winner: false as const,
    recommendation: false as const,
  };
  return { ...withoutHash, observationSha256: hashValue(withoutHash) };
}

function requireObservationBoundary(observations: readonly XiaoFfxxUnitExpandedTechnicalObservation[]): void {
  if (
    observations.length !== 6 ||
    new Set(observations.map(({ candidateId }) => candidateId)).size !== 6 ||
    stableJson(observations.map(({ candidateId }) => candidateId)) !== stableJson(observations.map(({ candidateId }) => candidateId).sort(compareText)) ||
    observations.some(({ technicalObservationEligible }) => !technicalObservationEligible)
  ) {
    throw new Error("Xiao unit-expanded gate lost its six technical-ID-sorted eligible observations.");
  }
}

function buildProvenanceOnly(
  branchReport: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
  observations: readonly XiaoFfxxUnitExpandedTechnicalObservation[],
): XiaoFfxxUnitExpandedExecutionGateReport["provenanceOnly"] {
  const sourceGroups = [...branchReport.rankedFiveStarBranchGroups, ...branchReport.unrankedFourStarBranchGroups];
  const groups = sourceGroups.map((group) => ({
    branchGroupId: group.branchGroupId,
    sourceOccurrenceId: group.sourceOccurrenceId,
    sourceGroupSha256: group.sourceGroupSha256,
    sourceRankGroup: group.sourceRankGroup,
    sourceOrdering: group.sourceOrdering,
    membersTied: group.membersTied,
    candidateIds: [...group.candidateIds].sort(compareText),
  }));
  const candidateEdges = groups.flatMap((group) =>
    group.candidateIds.map((candidateId) => ({ candidateId, branchGroupId: group.branchGroupId, provenanceOnly: true as const })),
  ).sort((left, right) => compareText(left.candidateId, right.candidateId));
  const expectedIds = observations.map(({ candidateId }) => candidateId).sort(compareText);
  const candidateById = new Map(
    branchReport.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  if (
    branchReport.comparisonStatus !== "comparable" ||
    branchReport.summary.branchGroupCount !== 3 ||
    branchReport.summary.partialCandidateCount !== 6 ||
    groups.length !== 3 ||
    new Set(groups.map(({ branchGroupId }) => branchGroupId)).size !== 3 ||
    candidateEdges.length !== 6 ||
    new Set(candidateEdges.map(({ candidateId }) => candidateId)).size !== 6 ||
    stableJson(candidateEdges.map(({ candidateId }) => candidateId).sort(compareText)) !== stableJson(expectedIds) ||
    observations.some((observation) => {
      const candidate = candidateById.get(observation.candidateId);
      return (
        !candidate ||
        candidate.candidateIdentitySha256 !== observation.candidateIdentitySha256 ||
        candidate.weaponId !== observation.weaponId
      );
    })
  ) {
    throw new Error("Checkpoint 46 no longer exposes three provenance-only source groups and six candidate edges.");
  }
  const projection = { groups, candidateEdges };
  return {
    sourceGroupCount: 3,
    candidateEdgeCount: 6,
    sourceRanksExcludedFromExecutionIdentity: true,
    sourceGroupsExcludedFromTechnicalObservationIdentity: true,
    groups,
    candidateEdges,
    provenanceProjectionSha256: hashValue(projection),
  };
}

function cloneLines(lines: readonly ReplayComboLine[]): ReplayComboLine[] {
  return lines.map((line) => ({ ...line, reaction: cloneReaction(line.reaction) }));
}

function cloneReaction(reaction: ReplayComboLine["reaction"]): ReplayComboLine["reaction"] {
  if (!reaction) return null;
  return {
    ...reaction,
    ...(reaction.rxnParts ? { rxnParts: { ...reaction.rxnParts } } : {}),
    ...(reaction.rxnPartHits ? { rxnPartHits: { ...reaction.rxnPartHits } } : {}),
  };
}

function decodeBase64(value: string, sourcePath: string): Buffer {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Xiao unit-expanded execution-gate source ${sourcePath} has no bytes.`);
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error(`Xiao unit-expanded execution-gate source ${sourcePath} has non-canonical base64.`);
  return bytes;
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot normalize non-finite unit-expanded gate value ${value}.`);
  }
  if (Object.is(value, -0)) return 0;
  return Number(value.toPrecision(15));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
