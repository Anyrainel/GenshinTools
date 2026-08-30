import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sha256Text, stableJson } from "./io";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";
import {
  authenticateXiaoFfxxUnitExpandedExecutionGate,
  XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS,
  type BuildXiaoFfxxUnitExpandedExecutionGateInput,
  type XiaoFfxxUnitExpandedExecutionGateReport,
  type XiaoFfxxUnitExpandedTechnicalObservation,
} from "./xiaoFfxxUnitExpandedExecutionGate";

const FACTORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-unit-expanded-execution-gate.json";
const CORE_PATH =
  "scripts/guide-factory/src/xiaoFfxxFiveStarSourceGroupValidationDiagnostic.ts";
const CLI_PATH =
  "scripts/guide-factory/src/assemble-xiao-ffxx-five-star-source-group-validation-diagnostic.ts";
const DIAGNOSTIC_ID =
  "guide-factory-xiao-ffxx-five-star-source-group-validation-diagnostic-version-5-5";
const EXPECTED_INPUT_PATH_COUNT = 124;
const EXPECTED_JSON_INPUT_COUNT = 14;
const RANK_ONE_GROUP_ID = "xiao-ffxx:five-star-source-rank-group-1";
const RANK_TWO_GROUP_ID = "xiao-ffxx:five-star-source-rank-group-2";
const DEATHMATCH_GROUP_ID = "xiao-ffxx:four-star-unranked-deathmatch";
const EXPECTED_RANK_ONE_CANDIDATE_IDS = [
  "guide-factory:xiao-ffxx:partial-non-er:lumidouce_elegy:mh-atk-anemo",
  "guide-factory:xiao-ffxx:partial-non-er:primordial_jade_wingedspear:mh-atk-anemo",
  "guide-factory:xiao-ffxx:partial-non-er:staff_of_homa:mh-atk-anemo",
] as const;
const EXPECTED_RANK_TWO_CANDIDATE_IDS = [
  "guide-factory:xiao-ffxx:partial-non-er:calamity_queller:mh-atk-anemo",
  "guide-factory:xiao-ffxx:partial-non-er:vortex_vanquisher:mh-atk-anemo",
] as const;
const EXPECTED_DEATHMATCH_CANDIDATE_ID =
  "guide-factory:xiao-ffxx:partial-non-er:deathmatch:mh-atk-anemo";

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
  branchCandidateDurableReportInput:
    "scripts/guide-factory/reports/xiao-ffxx-non-er-condition-free-branch-candidate-contract.json",
  formulaCountDurableReportInput:
    "scripts/guide-factory/reports/xiao-formula-count-parity.json",
  groupedReplayDurableReportInput:
    "scripts/guide-factory/reports/xiao-ffxx-grouped-replay-representation-preflight.json",
  unitExpandedDurableReportInput: UPSTREAM_REPORT_RELATIVE_PATH,
} as const;

const CAUTIONS = [
  "This diagnostic compares source-group validation targets for one authenticated Xiao FFXX fixture only.",
  "The pair outcomes test whether checkpoint 48 technical totals reproduce a source-authored between-group ordering; they do not rank weapons or establish player-facing damage claims.",
  "Source membersTied means co-membership in one source tier only. Envelope extrema are computed, but no member-to-member equality, ordering, or rank is produced.",
  "Deathmatch remains authenticated as a four-star observation but is excluded from every five-star pair and all cross-rarity comparison.",
  "The group envelopes overlap, so this fixture cannot reproduce the source grouping as a strict numeric partition.",
  "Circlet, substats, gameplay timing, and Energy Recharge remain absent and deferred.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not turn aligned or counterexample pairs into weapon ranks, winners, recommendations, or a complete guide.",
  "Do not infer equality, ordering, or interchangeability among members of the same source group.",
  "Do not compare Deathmatch with the five-star candidates from this report.",
  "Do not publish these technical totals as rotation damage, DPS, gameplay truth, or Energy Recharge advice.",
] as const;

export const XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_ABSOLUTE_TOLERANCE = 1e-9;
export const XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_RELATIVE_TOLERANCE = 1e-12;

export interface XiaoFfxxFiveStarSourceGroupValidationDiagnosticSourceFile {
  path: string;
  bytesBase64: string;
}

export interface BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput {
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
  unitExpandedDurableReportInput: unknown;
  sourceFiles: readonly XiaoFfxxFiveStarSourceGroupValidationDiagnosticSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export type XiaoFfxxFiveStarSourceGroupComparisonOutcome =
  | "source-order-aligned"
  | "source-order-counterexample"
  | "within-tolerance-tie";

export interface XiaoFfxxFiveStarSourceGroupComparisonResult {
  rankOneMinusRankTwo: number;
  absoluteDifference: number;
  allowedDifference: number;
  outcome: XiaoFfxxFiveStarSourceGroupComparisonOutcome;
}

export interface XiaoFfxxFiveStarTechnicalEvidence {
  candidateId: string;
  candidateIdentitySha256: string;
  weaponId: string;
  refinement: 1 | 5;
  unitExpandedDirectTotalDamage: number;
  upstreamObservationSha256: string;
  technicalObservationEligible: true;
  comparisonEligible: false;
  technicalEvidenceSha256: string;
}

export interface XiaoFfxxFiveStarSourceTargetGroup {
  branchGroupId: string;
  sourceOccurrenceId: string;
  sourceGroupSha256: string;
  sourceRankGroup: 1 | 2;
  sourceOrdering: "ranked-groups";
  membersTied: true;
  membersTiedMeansSourceCoMembershipOnly: true;
  withinGroupNumericEqualityAsserted: false;
  withinGroupRankingProduced: false;
  candidateIds: string[];
}

export interface XiaoFfxxFiveStarSourceGroupPairComparison {
  comparisonId: string;
  rankOneCandidateId: string;
  rankTwoCandidateId: string;
  rankOneTechnicalEvidenceSha256: string;
  rankTwoTechnicalEvidenceSha256: string;
  rankOneUpstreamObservationSha256: string;
  rankTwoUpstreamObservationSha256: string;
  rankOneSourceGroupId: typeof RANK_ONE_GROUP_ID;
  rankTwoSourceGroupId: typeof RANK_TWO_GROUP_ID;
  rankOneSourceRankGroup: 1;
  rankTwoSourceRankGroup: 2;
  rankOneUnitExpandedDirectTotalDamage: number;
  rankTwoUnitExpandedDirectTotalDamage: number;
  rankOneMinusRankTwo: number;
  absoluteDifference: number;
  allowedDifference: number;
  outcome: XiaoFfxxFiveStarSourceGroupComparisonOutcome;
  sourceOrderAligned: boolean;
  sourceOrderCounterexample: boolean;
  withinToleranceTie: boolean;
  validationTargetOnly: true;
  factoryRank: null;
  winner: false;
  recommendation: false;
  sourceErrorClaimed: false;
  calculatorCorrectnessClaimed: false;
  computedCorrectionClaimed: false;
  recommendationClaimed: false;
  comparisonSha256: string;
}

export interface XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport {
  schemaVersion: 1;
  reportType: "xiao-ffxx-five-star-source-group-validation-diagnostic";
  diagnosticId: typeof DIAGNOSTIC_ID;
  classification: "authenticated-bounded-source-group-validation-target-diagnostic";
  validationStatus: "accepted-as-validation-target-only";
  diagnosticStatus: "counterexamples-observed-validation-target-only";
  comparisonExecutionStatus: "performed-validation-target-only";
  publicationStatus: "withheld-not-a-guide-or-ranking";
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true;
    combinedJsonInputByteAndParsedObjectParity: true;
    sourceFileCount: 124;
    generatedFromCount: 124;
    authenticatedJsonInputParityCount: 14;
  };
  upstreamBoundary: {
    durableReportPath: typeof UPSTREAM_REPORT_RELATIVE_PATH;
    durableReportFileSha256: string;
    durableReportCanonicalObjectSha256: string;
    freshlyAuthenticated: true;
    upstreamInputCount: 121;
    authenticatedTechnicalObservationCount: 6;
    checkpoint49AdditionalReplayCount: 0;
    checkpoint49ReplayExecuted: false;
    upstreamComparisonExecuted: false;
    upstreamRankedCandidateCount: 0;
    upstreamWinnerCount: 0;
    upstreamRecommendationCount: 0;
  };
  technicalEvidenceBoundary: {
    evidenceOrigin: "fresh-authenticated-checkpoint-48-unit-expanded-direct-total";
    technicalEvidenceIndependentOfSourceMembership: true;
    sourceRanksExcludedFromTechnicalEvidenceIdentity: true;
    candidateCount: 6;
    fiveStarCandidateCount: 5;
    authenticatedExcludedFourStarCandidateCount: 1;
    observations: XiaoFfxxFiveStarTechnicalEvidence[];
    technicalEvidenceSha256: string;
    comparedFiveStarTechnicalEvidenceSha256: string;
  };
  sourceTargetBoundary: {
    targetKind: "source-authored-five-star-rank-group-ordering";
    validationTargetOnly: true;
    expectedRelation: "every-rank-one-member-above-every-rank-two-member";
    sourceTargetIndependentOfTechnicalTotals: true;
    numericTotalsExcludedFromSourceTargetIdentity: true;
    sourceGroupCount: 2;
    sourceMembershipEdgeCount: 5;
    expectedCrossGroupPairCount: 6;
    withinGroupPairwiseRelationCount: 0;
    withinGroupPairwiseRelationExecuted: false;
    withinGroupEnvelopeExtremaComputed: true;
    membersTiedMeansSourceCoMembershipOnly: true;
    withinGroupNumericEqualityAsserted: false;
    withinGroupRankingProduced: false;
    groups: XiaoFfxxFiveStarSourceTargetGroup[];
    deathmatchExclusion: {
      candidateId: typeof EXPECTED_DEATHMATCH_CANDIDATE_ID;
      branchGroupId: typeof DEATHMATCH_GROUP_ID;
      authenticatedTechnicalObservation: true;
      sourceOrdering: "unranked";
      sourceRankGroup: null;
      excludedFromFiveStarGroups: true;
      excludedFromAllPairs: true;
      crossRarityComparisonExecuted: false;
      relativePosition: null;
      factoryRank: null;
    };
    sourceTargetSha256: string;
  };
  comparisonPolicy: {
    policyId: "finite-absolute-relative-tolerance-v1";
    metric: "unit-expanded-direct-total-damage";
    direction: "rank-one-minus-rank-two";
    pairEnumeration: "technical-id-ordered-exhaustive-cartesian-3x2";
    expectedPairCount: 6;
    absoluteTolerance: typeof XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_ABSOLUTE_TOLERANCE;
    relativeTolerance: typeof XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_RELATIVE_TOLERANCE;
    allowedDifferenceFormula: "max(absoluteTolerance, relativeTolerance * max(1, abs(rankOne), abs(rankTwo)))";
    finiteInputsRequired: true;
    gameplaySignificanceThresholdApplied: false;
    strictAboveToleranceMeansAligned: true;
    strictBelowNegativeToleranceMeansCounterexample: true;
    withinInclusiveToleranceMeansTie: true;
  };
  comparisons: XiaoFfxxFiveStarSourceGroupPairComparison[];
  envelopeDiagnostic: {
    metric: "unit-expanded-direct-total-damage";
    rankOneMinimum: number;
    rankOneMaximum: number;
    rankTwoMinimum: number;
    rankTwoMaximum: number;
    overlapLowerBound: number;
    overlapUpperBound: number;
    overlapWidth: number;
    envelopesOverlap: true;
    classification: "overlapping-source-group-envelopes";
    validationTargetOnly: true;
    strictNumericPartitionReproduced: false;
    envelopeDiagnosticSha256: string;
  };
  identityBoundary: {
    upstreamCanonicalObjectSha256: string;
    technicalEvidenceSha256: string;
    comparedFiveStarTechnicalEvidenceSha256: string;
    sourceTargetSha256: string;
    diagnosticResultSha256: string;
    aggregateDiagnosticSha256: string;
    technicalEvidenceIdentityExcludesSourceGroups: true;
    sourceTargetIdentityExcludesTechnicalTotals: true;
    diagnosticResultBindsTechnicalEvidenceAndSourceTarget: true;
    sourceRankIncludedInSourceTargetIdentity: true;
    sourceRankIncludedInDiagnosticJoinIdentity: true;
    sourceRankCannotAlterTechnicalEvidenceValues: true;
    deathmatchExcludedFromCrossGroupPairs: true;
  };
  summary: {
    authenticatedCandidateCount: 6;
    fiveStarCandidateCount: 5;
    deathmatchAuthenticatedExcludedCount: 1;
    sourceGroupCount: 2;
    sourceMembershipEdgeCount: 5;
    exhaustiveCrossGroupPairCount: 6;
    sourceOrderAlignedPairCount: 2;
    sourceOrderCounterexamplePairCount: 4;
    withinToleranceTiePairCount: 0;
    overlappingEnvelopeCount: 1;
    withinGroupPairwiseRelationCount: 0;
    crossRarityComparisonCount: 0;
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
  supportsRecommendationClaims: false;
  supportsDamageClaims: false;
  supportsDamageComparisonClaims: false;
  supportsGameplayClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  sourceErrorClaimed: false;
  calculatorCorrectnessClaimed: false;
  computedCorrectionClaimed: false;
  recommendationClaimed: false;
  sourceGroupValidationTargetProduced: true;
  diagnosticComparisonExecuted: true;
  withinGroupPairwiseRelationExecuted: false;
  withinGroupEnvelopeExtremaComputed: true;
  crossRarityComparisonExecuted: false;
  rankingExecuted: false;
  winnerSelectionExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  autoTuneExecuted: false;
  recommendationCompositionExecuted: false;
  idealRollAllocationExecuted: false;
  groupAverageComputed: false;
  groupScoreComputed: false;
  circletSelectionExecuted: false;
  substatSelectionExecuted: false;
  energyRecoveryInputsUsed: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
  issues: [];
}

export type XiaoFfxxFiveStarSourceGroupValidationDiagnosticAuthentication =
  | {
      authenticated: true;
      canonicalReport: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      issues: Array<{ code: string; path: string; message: string }>;
    };

export const XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS = [
  ...new Set([
    ...XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS,
    UPSTREAM_REPORT_RELATIVE_PATH,
    CORE_PATH,
    CLI_PATH,
  ]),
].sort(compareText);

export const XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_SOURCE_FILE_PATHS = [
  ...XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
];

export const XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "xiao-ffxx-five-star-source-group-validation-diagnostic.json",
  );

export function compareXiaoFfxxFiveStarSourceGroupTotals(
  rankOneTotalDamage: number,
  rankTwoTotalDamage: number,
): XiaoFfxxFiveStarSourceGroupComparisonResult {
  if (!Number.isFinite(rankOneTotalDamage) || !Number.isFinite(rankTwoTotalDamage)) {
    throw new Error("Xiao five-star source-group comparison requires finite totals.");
  }
  const allowedDifference = Math.max(
    XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_ABSOLUTE_TOLERANCE,
    XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_RELATIVE_TOLERANCE *
      Math.max(
        1,
        Math.abs(rankOneTotalDamage),
        Math.abs(rankTwoTotalDamage),
      ),
  );
  if (!Number.isFinite(allowedDifference) || allowedDifference < 0) {
    throw new Error("Xiao five-star source-group comparison produced an invalid tolerance.");
  }
  const difference = rankOneTotalDamage - rankTwoTotalDamage;
  if (!Number.isFinite(difference)) {
    throw new Error("Xiao five-star source-group comparison produced a non-finite difference.");
  }
  const outcome: XiaoFfxxFiveStarSourceGroupComparisonOutcome =
    Math.abs(difference) <= allowedDifference
      ? "within-tolerance-tie"
      : difference > 0
        ? "source-order-aligned"
        : "source-order-counterexample";
  return {
    rankOneMinusRankTwo: normalizeNumber(difference),
    absoluteDifference: normalizeNumber(Math.abs(difference)),
    allowedDifference: normalizeNumber(allowedDifference),
    outcome,
  };
}

export async function buildXiaoFfxxFiveStarSourceGroupValidationDiagnosticReport(
  input: BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
): Promise<XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport> {
  const raw = authenticateRawInputs(input);
  const upstreamAuthentication = await authenticateXiaoFfxxUnitExpandedExecutionGate(
    raw.upstreamReport,
    toUpstreamInput(input, raw),
  );
  if (!upstreamAuthentication.authenticated) {
    throw new Error(
      `Checkpoint-48 unit-expanded gate failed fresh authentication (${upstreamAuthentication.reason}).`,
    );
  }
  const upstream = upstreamAuthentication.canonicalReport;
  requireUpstreamBoundary(upstream);

  const technicalEvidence = projectTechnicalEvidence(upstream.observations);
  const sourceTarget = projectSourceTarget(upstream, technicalEvidence);
  const comparisons = buildComparisons(technicalEvidence, sourceTarget.groups);
  requireComparisonBoundary(comparisons);
  const envelopeDiagnostic = buildEnvelopeDiagnostic(
    technicalEvidence,
    sourceTarget.groups,
  );

  const technicalEvidenceSha256 = hashValue(
    technicalEvidence.map(({ technicalEvidenceSha256 }) => technicalEvidenceSha256),
  );
  const comparedFiveStarTechnicalEvidenceSha256 = hashValue(
    technicalEvidence
      .filter(
        ({ candidateId }) => candidateId !== EXPECTED_DEATHMATCH_CANDIDATE_ID,
      )
      .map(({ technicalEvidenceSha256 }) => technicalEvidenceSha256),
  );
  const deathmatchExclusion = buildDeathmatchExclusion();
  const sourceTargetIdentity = {
    targetKind: "source-authored-five-star-rank-group-ordering",
    expectedRelation: "every-rank-one-member-above-every-rank-two-member",
    groups: sourceTarget.groups,
    deathmatchExclusion,
  };
  const sourceTargetSha256 = hashValue(sourceTargetIdentity);
  const diagnosticResultIdentity = {
    comparedFiveStarTechnicalEvidenceSha256,
    sourceTargetSha256,
    comparisonPolicy: comparisonPolicy(),
    comparisonHashes: comparisons.map(({ comparisonSha256 }) => comparisonSha256),
    envelopeDiagnosticSha256: envelopeDiagnostic.envelopeDiagnosticSha256,
  };
  const diagnosticResultSha256 = hashValue(diagnosticResultIdentity);
  const upstreamCanonicalObjectSha256 = hashValue(upstream);
  const aggregateDiagnosticSha256 = hashValue({
    upstreamCanonicalObjectSha256,
    diagnosticResultSha256,
  });

  return {
    schemaVersion: 1,
    reportType: "xiao-ffxx-five-star-source-group-validation-diagnostic",
    diagnosticId: DIAGNOSTIC_ID,
    classification: "authenticated-bounded-source-group-validation-target-diagnostic",
    validationStatus: "accepted-as-validation-target-only",
    diagnosticStatus: "counterexamples-observed-validation-target-only",
    comparisonExecutionStatus: "performed-validation-target-only",
    publicationStatus: "withheld-not-a-guide-or-ranking",
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      combinedJsonInputByteAndParsedObjectParity: true,
      sourceFileCount: 124,
      generatedFromCount: 124,
      authenticatedJsonInputParityCount: 14,
    },
    upstreamBoundary: {
      durableReportPath: UPSTREAM_REPORT_RELATIVE_PATH,
      durableReportFileSha256: sha256Bytes(
        raw.sourceBytesByPath.get(UPSTREAM_REPORT_RELATIVE_PATH)!,
      ),
      durableReportCanonicalObjectSha256: upstreamCanonicalObjectSha256,
      freshlyAuthenticated: true,
      upstreamInputCount: 121,
      authenticatedTechnicalObservationCount: 6,
      checkpoint49AdditionalReplayCount: 0,
      checkpoint49ReplayExecuted: false,
      upstreamComparisonExecuted: false,
      upstreamRankedCandidateCount: 0,
      upstreamWinnerCount: 0,
      upstreamRecommendationCount: 0,
    },
    technicalEvidenceBoundary: {
      evidenceOrigin:
        "fresh-authenticated-checkpoint-48-unit-expanded-direct-total",
      technicalEvidenceIndependentOfSourceMembership: true,
      sourceRanksExcludedFromTechnicalEvidenceIdentity: true,
      candidateCount: 6,
      fiveStarCandidateCount: 5,
      authenticatedExcludedFourStarCandidateCount: 1,
      observations: technicalEvidence,
      technicalEvidenceSha256,
      comparedFiveStarTechnicalEvidenceSha256,
    },
    sourceTargetBoundary: {
      targetKind: "source-authored-five-star-rank-group-ordering",
      validationTargetOnly: true,
      expectedRelation: "every-rank-one-member-above-every-rank-two-member",
      sourceTargetIndependentOfTechnicalTotals: true,
      numericTotalsExcludedFromSourceTargetIdentity: true,
      sourceGroupCount: 2,
      sourceMembershipEdgeCount: 5,
      expectedCrossGroupPairCount: 6,
      withinGroupPairwiseRelationCount: 0,
      withinGroupPairwiseRelationExecuted: false,
      withinGroupEnvelopeExtremaComputed: true,
      membersTiedMeansSourceCoMembershipOnly: true,
      withinGroupNumericEqualityAsserted: false,
      withinGroupRankingProduced: false,
      groups: sourceTarget.groups,
      deathmatchExclusion,
      sourceTargetSha256,
    },
    comparisonPolicy: comparisonPolicy(),
    comparisons,
    envelopeDiagnostic,
    identityBoundary: {
      upstreamCanonicalObjectSha256,
      technicalEvidenceSha256,
      comparedFiveStarTechnicalEvidenceSha256,
      sourceTargetSha256,
      diagnosticResultSha256,
      aggregateDiagnosticSha256,
      technicalEvidenceIdentityExcludesSourceGroups: true,
      sourceTargetIdentityExcludesTechnicalTotals: true,
      diagnosticResultBindsTechnicalEvidenceAndSourceTarget: true,
      sourceRankIncludedInSourceTargetIdentity: true,
      sourceRankIncludedInDiagnosticJoinIdentity: true,
      sourceRankCannotAlterTechnicalEvidenceValues: true,
      deathmatchExcludedFromCrossGroupPairs: true,
    },
    summary: {
      authenticatedCandidateCount: 6,
      fiveStarCandidateCount: 5,
      deathmatchAuthenticatedExcludedCount: 1,
      sourceGroupCount: 2,
      sourceMembershipEdgeCount: 5,
      exhaustiveCrossGroupPairCount: 6,
      sourceOrderAlignedPairCount: 2,
      sourceOrderCounterexamplePairCount: 4,
      withinToleranceTiePairCount: 0,
      overlappingEnvelopeCount: 1,
      withinGroupPairwiseRelationCount: 0,
      crossRarityComparisonCount: 0,
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
    supportsRecommendationClaims: false,
    supportsDamageClaims: false,
    supportsDamageComparisonClaims: false,
    supportsGameplayClaims: false,
    supportsRotationClaims: false,
    supportsEnergyRecoveryClaims: false,
    sourceErrorClaimed: false,
    calculatorCorrectnessClaimed: false,
    computedCorrectionClaimed: false,
    recommendationClaimed: false,
    sourceGroupValidationTargetProduced: true,
    diagnosticComparisonExecuted: true,
    withinGroupPairwiseRelationExecuted: false,
    withinGroupEnvelopeExtremaComputed: true,
    crossRarityComparisonExecuted: false,
    rankingExecuted: false,
    winnerSelectionExecuted: false,
    generatorExecuted: false,
    optimizerExecuted: false,
    autoTuneExecuted: false,
    recommendationCompositionExecuted: false,
    idealRollAllocationExecuted: false,
    groupAverageComputed: false,
    groupScoreComputed: false,
    circletSelectionExecuted: false,
    substatSelectionExecuted: false,
    energyRecoveryInputsUsed: false,
    energyRecoveryComputationExecuted: false,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    issues: [],
  };
}

export async function authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic(
  serializedReport: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
  input: BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
): Promise<XiaoFfxxFiveStarSourceGroupValidationDiagnosticAuthentication> {
  let canonicalReport: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport;
  try {
    canonicalReport =
      await buildXiaoFfxxFiveStarSourceGroupValidationDiagnosticReport(input);
  } catch (error) {
    return {
      authenticated: false,
      reason: "canonical-inputs-rejected",
      issues: [
        {
          code: "xiao-ffxx-five-star-source-group-diagnostic.canonical-input",
          path: "reports.xiao-ffxx-five-star-source-group-validation-diagnostic",
          message: errorMessage(error),
        },
      ],
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      issues: [
        {
          code: "xiao-ffxx-five-star-source-group-diagnostic.serialized-report-mismatch",
          path: "reports.xiao-ffxx-five-star-source-group-validation-diagnostic",
          message:
            "Serialized source-group diagnostic does not match a fresh authenticated rebuild.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export async function requireAuthenticatedXiaoFfxxFiveStarSourceGroupValidationDiagnostic(
  report: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
  input: BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
): Promise<void> {
  const authentication =
    await authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic(
      report,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `Refusing an unauthenticated Xiao FFXX source-group diagnostic (${authentication.reason}): ${authentication.issues.map(({ message }) => message).join("; ")}`,
    );
  }
}

interface AuthenticatedRawInput {
  generatedFrom: GeneratedFromEntry[];
  sourceBytesByPath: Map<string, Buffer>;
  parsedByKey: Record<keyof typeof JSON_INPUT_PATHS, unknown>;
  upstreamReport: XiaoFfxxUnitExpandedExecutionGateReport;
}

function authenticateRawInputs(
  input: BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
): AuthenticatedRawInput {
  const expectedPaths = [
    ...XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
  ];
  if (
    expectedPaths.length !== EXPECTED_INPUT_PATH_COUNT ||
    Object.keys(JSON_INPUT_PATHS).length !== EXPECTED_JSON_INPUT_COUNT
  ) {
    throw new Error(
      "Xiao five-star source-group diagnostic declared input cardinality drifted.",
    );
  }
  const sourcePaths = input.sourceFiles.map(({ path: sourcePath }) => sourcePath);
  const generatedPaths = input.generatedFrom.map(({ path: sourcePath }) => sourcePath);
  if (
    stableJson([...sourcePaths].sort(compareText)) !== stableJson(expectedPaths) ||
    new Set(sourcePaths).size !== expectedPaths.length
  ) {
    throw new Error(
      "Xiao five-star source-group diagnostic source-file path closure drifted.",
    );
  }
  if (
    stableJson([...generatedPaths].sort(compareText)) !== stableJson(expectedPaths) ||
    new Set(generatedPaths).size !== expectedPaths.length
  ) {
    throw new Error(
      "Xiao five-star source-group diagnostic generatedFrom path closure drifted.",
    );
  }
  const sourceBytesByPath = new Map<string, Buffer>();
  for (const entry of input.sourceFiles) {
    sourceBytesByPath.set(entry.path, decodeBase64(entry.bytesBase64, entry.path));
  }
  const generatedByPath = new Map(
    input.generatedFrom.map((entry) => [entry.path, entry]),
  );
  for (const sourcePath of expectedPaths) {
    const bytes = sourceBytesByPath.get(sourcePath);
    const generated = generatedByPath.get(sourcePath);
    if (
      !bytes ||
      !generated ||
      !/^[a-f0-9]{64}$/.test(generated.sha256) ||
      sha256Bytes(bytes) !== generated.sha256
    ) {
      throw new Error(
        `Xiao five-star source-group diagnostic raw hash drifted for ${sourcePath}.`,
      );
    }
  }
  const parsedByKey = {} as Record<keyof typeof JSON_INPUT_PATHS, unknown>;
  for (const [key, sourcePath] of Object.entries(JSON_INPUT_PATHS) as Array<
    [keyof typeof JSON_INPUT_PATHS, string]
  >) {
    const parsedInput = input[key];
    const bytes = sourceBytesByPath.get(sourcePath);
    if (!bytes) {
      throw new Error(`Missing Xiao source-group diagnostic source ${sourcePath}.`);
    }
    let parsedFromBytes: unknown;
    try {
      parsedFromBytes = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      throw new Error(
        `Xiao source-group diagnostic input ${sourcePath} is not JSON: ${errorMessage(error)}`,
      );
    }
    if (stableJson(parsedFromBytes) !== stableJson(parsedInput)) {
      throw new Error(
        `Xiao source-group diagnostic parsed input disagrees with bytes for ${sourcePath}.`,
      );
    }
    parsedByKey[key] = parsedFromBytes;
  }
  return {
    generatedFrom: expectedPaths.map((sourcePath) => ({
      ...generatedByPath.get(sourcePath)!,
    })),
    sourceBytesByPath,
    parsedByKey,
    upstreamReport:
      parsedByKey.unitExpandedDurableReportInput as XiaoFfxxUnitExpandedExecutionGateReport,
  };
}

function toUpstreamInput(
  input: BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
  raw: AuthenticatedRawInput,
): BuildXiaoFfxxUnitExpandedExecutionGateInput {
  const upstreamPathSet = new Set(
    XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS,
  );
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
    groupedReplayDurableReportInput: parsed.groupedReplayDurableReportInput,
    sourceFiles: input.sourceFiles.filter(({ path: sourcePath }) =>
      upstreamPathSet.has(sourcePath),
    ),
    generatedFrom: input.generatedFrom.filter(({ path: sourcePath }) =>
      upstreamPathSet.has(sourcePath),
    ),
  };
}

function requireUpstreamBoundary(
  report: XiaoFfxxUnitExpandedExecutionGateReport,
): void {
  if (
    report.validationStatus !== "accepted" ||
    report.comparisonExecutionStatus !== "not-performed" ||
    report.summary.candidateCount !== 6 ||
    report.summary.technicalObservationEligibleCount !== 6 ||
    report.summary.comparisonCount !== 0 ||
    report.summary.rankedCandidateCount !== 0 ||
    report.summary.winnerCount !== 0 ||
    report.summary.recommendationCount !== 0 ||
    report.summary.completeBuildCount !== 0 ||
    report.summary.energyRecoveryComputationCount !== 0 ||
    report.rawInputBoundary.sourceFileCount !== 121 ||
    report.rawInputBoundary.authenticatedJsonInputParityCount !== 13 ||
    report.upstreamBoundary.checkpoint48AdditionalReplayCount !== 0 ||
    report.normalizationBoundary.normalizedLineCount !== 13 ||
    report.provenanceOnly.sourceGroupCount !== 3 ||
    report.provenanceOnly.candidateEdgeCount !== 6 ||
    report.observations.length !== 6 ||
    !report.normalizationExecuted ||
    !report.technicalObservationProjectionExecuted ||
    report.comparisonExecuted ||
    report.generatorExecuted ||
    report.optimizerExecuted ||
    report.autoTuneExecuted ||
    report.recommendationCompositionExecuted ||
    report.idealRollAllocationExecuted ||
    report.energyRecoveryInputsUsed ||
    report.energyRecoveryComputationExecuted ||
    report.supportsGuideClaims ||
    report.supportsTeamRecommendations ||
    report.supportsEquipmentRecommendations ||
    report.supportsBuildRecommendations ||
    report.supportsStatRecommendations ||
    report.supportsRankClaims ||
    report.supportsWinnerClaims ||
    report.supportsDamageClaims ||
    report.supportsDamageComparisonClaims ||
    report.supportsRotationClaims ||
    report.supportsEnergyRecoveryClaims
  ) {
    throw new Error(
      "Checkpoint 48 no longer exposes the exact bounded technical evidence required by checkpoint 49.",
    );
  }
}

function projectTechnicalEvidence(
  observations: readonly XiaoFfxxUnitExpandedTechnicalObservation[],
): XiaoFfxxFiveStarTechnicalEvidence[] {
  const projected = observations.map((observation) => {
    const total = observation.normalizedExecution.unitExpandedDirectTotalDamage;
    if (
      !Number.isFinite(total) ||
      !observation.technicalObservationEligible ||
      observation.comparisonEligible ||
      observation.factoryRank != null ||
      observation.winner ||
      observation.recommendation ||
      observation.executedViewId !== "source-only-ffxx"
    ) {
      throw new Error(
        `Checkpoint 48 observation ${observation.candidateId} is not bounded technical evidence.`,
      );
    }
    const withoutHash = {
      candidateId: observation.candidateId,
      candidateIdentitySha256: observation.candidateIdentitySha256,
      weaponId: observation.weaponId,
      refinement: observation.refinement,
      unitExpandedDirectTotalDamage: total,
      upstreamObservationSha256: observation.observationSha256,
      technicalObservationEligible: true as const,
      comparisonEligible: false as const,
    };
    return {
      ...withoutHash,
      technicalEvidenceSha256: hashValue(withoutHash),
    };
  });
  projected.sort((left, right) => compareText(left.candidateId, right.candidateId));
  if (
    projected.length !== 6 ||
    new Set(projected.map(({ candidateId }) => candidateId)).size !== 6 ||
    stableJson(projected.map(({ candidateId }) => candidateId)) !==
      stableJson(
        projected.map(({ candidateId }) => candidateId).sort(compareText),
      )
  ) {
    throw new Error(
      "Checkpoint 48 lost its six technical-ID-ordered finite observations.",
    );
  }
  return projected;
}

function projectSourceTarget(
  upstream: XiaoFfxxUnitExpandedExecutionGateReport,
  technicalEvidence: readonly XiaoFfxxFiveStarTechnicalEvidence[],
): {
  groups: XiaoFfxxFiveStarSourceTargetGroup[];
} {
  const byGroupId = new Map(
    upstream.provenanceOnly.groups.map((group) => [group.branchGroupId, group]),
  );
  const rankOne = byGroupId.get(RANK_ONE_GROUP_ID);
  const rankTwo = byGroupId.get(RANK_TWO_GROUP_ID);
  const deathmatch = byGroupId.get(DEATHMATCH_GROUP_ID);
  const evidenceIds = technicalEvidence
    .map(({ candidateId }) => candidateId)
    .sort(compareText);
  const expectedAllIds = [
    ...EXPECTED_RANK_ONE_CANDIDATE_IDS,
    ...EXPECTED_RANK_TWO_CANDIDATE_IDS,
    EXPECTED_DEATHMATCH_CANDIDATE_ID,
  ].sort(compareText);
  if (
    upstream.provenanceOnly.groups.length !== 3 ||
    !rankOne ||
    !rankTwo ||
    !deathmatch ||
    rankOne.sourceRankGroup !== 1 ||
    rankTwo.sourceRankGroup !== 2 ||
    deathmatch.sourceRankGroup !== null ||
    rankOne.sourceOrdering !== "ranked-groups" ||
    rankTwo.sourceOrdering !== "ranked-groups" ||
    deathmatch.sourceOrdering !== "unranked" ||
    !rankOne.membersTied ||
    !rankTwo.membersTied ||
    deathmatch.membersTied ||
    stableJson([...rankOne.candidateIds].sort(compareText)) !==
      stableJson([...EXPECTED_RANK_ONE_CANDIDATE_IDS]) ||
    stableJson([...rankTwo.candidateIds].sort(compareText)) !==
      stableJson([...EXPECTED_RANK_TWO_CANDIDATE_IDS]) ||
    stableJson(deathmatch.candidateIds) !==
      stableJson([EXPECTED_DEATHMATCH_CANDIDATE_ID]) ||
    stableJson(evidenceIds) !== stableJson(expectedAllIds)
  ) {
    throw new Error(
      "Checkpoint 48 source groups no longer match the exact two five-star groups plus excluded Deathmatch witness.",
    );
  }
  const groups = [rankOne, rankTwo].map((group) => ({
    branchGroupId: group.branchGroupId,
    sourceOccurrenceId: group.sourceOccurrenceId,
    sourceGroupSha256: group.sourceGroupSha256,
    sourceRankGroup: group.sourceRankGroup as 1 | 2,
    sourceOrdering: "ranked-groups" as const,
    membersTied: true as const,
    membersTiedMeansSourceCoMembershipOnly: true as const,
    withinGroupNumericEqualityAsserted: false as const,
    withinGroupRankingProduced: false as const,
    candidateIds: [...group.candidateIds].sort(compareText),
  }));
  const edges = groups.flatMap(({ candidateIds }) => candidateIds);
  if (
    groups.length !== 2 ||
    edges.length !== 5 ||
    new Set(edges).size !== 5 ||
    edges.includes(EXPECTED_DEATHMATCH_CANDIDATE_ID)
  ) {
    throw new Error("Xiao five-star source target cardinality drifted.");
  }
  return { groups };
}

function buildComparisons(
  technicalEvidence: readonly XiaoFfxxFiveStarTechnicalEvidence[],
  groups: readonly XiaoFfxxFiveStarSourceTargetGroup[],
): XiaoFfxxFiveStarSourceGroupPairComparison[] {
  const byCandidateId = new Map(
    technicalEvidence.map((observation) => [observation.candidateId, observation]),
  );
  const rankOneIds = groups.find(({ sourceRankGroup }) => sourceRankGroup === 1)
    ?.candidateIds;
  const rankTwoIds = groups.find(({ sourceRankGroup }) => sourceRankGroup === 2)
    ?.candidateIds;
  if (!rankOneIds || !rankTwoIds) {
    throw new Error("Xiao five-star source target lacks rank-one or rank-two membership.");
  }
  const comparisons: XiaoFfxxFiveStarSourceGroupPairComparison[] = [];
  for (const rankOneCandidateId of [...rankOneIds].sort(compareText)) {
    for (const rankTwoCandidateId of [...rankTwoIds].sort(compareText)) {
      const rankOne = byCandidateId.get(rankOneCandidateId);
      const rankTwo = byCandidateId.get(rankTwoCandidateId);
      if (!rankOne || !rankTwo) {
        throw new Error("Xiao five-star source target references missing technical evidence.");
      }
      const result = compareXiaoFfxxFiveStarSourceGroupTotals(
        rankOne.unitExpandedDirectTotalDamage,
        rankTwo.unitExpandedDirectTotalDamage,
      );
      const withoutHash = {
        comparisonId: `${rankOneCandidateId}::source-rank-1-v-2::${rankTwoCandidateId}`,
        rankOneCandidateId,
        rankTwoCandidateId,
        rankOneTechnicalEvidenceSha256: rankOne.technicalEvidenceSha256,
        rankTwoTechnicalEvidenceSha256: rankTwo.technicalEvidenceSha256,
        rankOneUpstreamObservationSha256: rankOne.upstreamObservationSha256,
        rankTwoUpstreamObservationSha256: rankTwo.upstreamObservationSha256,
        rankOneSourceGroupId: RANK_ONE_GROUP_ID as typeof RANK_ONE_GROUP_ID,
        rankTwoSourceGroupId: RANK_TWO_GROUP_ID as typeof RANK_TWO_GROUP_ID,
        rankOneSourceRankGroup: 1 as const,
        rankTwoSourceRankGroup: 2 as const,
        rankOneUnitExpandedDirectTotalDamage:
          rankOne.unitExpandedDirectTotalDamage,
        rankTwoUnitExpandedDirectTotalDamage:
          rankTwo.unitExpandedDirectTotalDamage,
        ...result,
        sourceOrderAligned: result.outcome === "source-order-aligned",
        sourceOrderCounterexample:
          result.outcome === "source-order-counterexample",
        withinToleranceTie: result.outcome === "within-tolerance-tie",
        validationTargetOnly: true as const,
        factoryRank: null,
        winner: false as const,
        recommendation: false as const,
        sourceErrorClaimed: false as const,
        calculatorCorrectnessClaimed: false as const,
        computedCorrectionClaimed: false as const,
        recommendationClaimed: false as const,
      };
      comparisons.push({
        ...withoutHash,
        comparisonSha256: hashValue(withoutHash),
      });
    }
  }
  return comparisons;
}

function requireComparisonBoundary(
  comparisons: readonly XiaoFfxxFiveStarSourceGroupPairComparison[],
): void {
  const expectedPairIds = EXPECTED_RANK_ONE_CANDIDATE_IDS.flatMap((rankOneId) =>
    EXPECTED_RANK_TWO_CANDIDATE_IDS.map(
      (rankTwoId) => `${rankOneId}::source-rank-1-v-2::${rankTwoId}`,
    ),
  );
  if (
    comparisons.length !== 6 ||
    new Set(comparisons.map(({ comparisonId }) => comparisonId)).size !== 6 ||
    stableJson(comparisons.map(({ comparisonId }) => comparisonId)) !==
      stableJson(expectedPairIds) ||
    comparisons.filter(({ sourceOrderAligned }) => sourceOrderAligned).length !== 2 ||
    comparisons.filter(({ sourceOrderCounterexample }) =>
      sourceOrderCounterexample,
    ).length !== 4 ||
    comparisons.filter(({ withinToleranceTie }) => withinToleranceTie).length !== 0 ||
    comparisons.some(
      (comparison) =>
        comparison.rankOneCandidateId === EXPECTED_DEATHMATCH_CANDIDATE_ID ||
        comparison.rankTwoCandidateId === EXPECTED_DEATHMATCH_CANDIDATE_ID ||
        !Number.isFinite(comparison.rankOneUnitExpandedDirectTotalDamage) ||
        !Number.isFinite(comparison.rankTwoUnitExpandedDirectTotalDamage) ||
        !Number.isFinite(comparison.rankOneMinusRankTwo) ||
        !Number.isFinite(comparison.absoluteDifference) ||
        !Number.isFinite(comparison.allowedDifference) ||
        comparison.factoryRank != null ||
        comparison.winner ||
        comparison.recommendation
    )
  ) {
    throw new Error(
      "Xiao five-star source-group diagnostic no longer has the exact six-pair 2/4/0 validation witness.",
    );
  }
}

function buildEnvelopeDiagnostic(
  technicalEvidence: readonly XiaoFfxxFiveStarTechnicalEvidence[],
  groups: readonly XiaoFfxxFiveStarSourceTargetGroup[],
): XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport["envelopeDiagnostic"] {
  const byCandidateId = new Map(
    technicalEvidence.map(({ candidateId, unitExpandedDirectTotalDamage }) => [
      candidateId,
      unitExpandedDirectTotalDamage,
    ]),
  );
  const totalsForRank = (sourceRankGroup: 1 | 2): number[] => {
    const group = groups.find((candidateGroup) =>
      candidateGroup.sourceRankGroup === sourceRankGroup,
    );
    if (!group) throw new Error(`Missing Xiao source rank group ${sourceRankGroup}.`);
    return group.candidateIds.map((candidateId) => {
      const total = byCandidateId.get(candidateId);
      if (total == null || !Number.isFinite(total)) {
        throw new Error(`Missing finite Xiao technical total for ${candidateId}.`);
      }
      return total;
    });
  };
  const rankOneTotals = totalsForRank(1);
  const rankTwoTotals = totalsForRank(2);
  const rankOneMinimum = Math.min(...rankOneTotals);
  const rankOneMaximum = Math.max(...rankOneTotals);
  const rankTwoMinimum = Math.min(...rankTwoTotals);
  const rankTwoMaximum = Math.max(...rankTwoTotals);
  const overlapLowerBound = Math.max(rankOneMinimum, rankTwoMinimum);
  const overlapUpperBound = Math.min(rankOneMaximum, rankTwoMaximum);
  const overlapWidth = overlapUpperBound - overlapLowerBound;
  if (
    [
      rankOneMinimum,
      rankOneMaximum,
      rankTwoMinimum,
      rankTwoMaximum,
      overlapLowerBound,
      overlapUpperBound,
      overlapWidth,
    ].some((value) => !Number.isFinite(value)) ||
    overlapWidth <= 0
  ) {
    throw new Error(
      "Xiao five-star source-group envelopes no longer expose the expected strict overlap.",
    );
  }
  const withoutHash = {
    metric: "unit-expanded-direct-total-damage" as const,
    rankOneMinimum,
    rankOneMaximum,
    rankTwoMinimum,
    rankTwoMaximum,
    overlapLowerBound,
    overlapUpperBound,
    overlapWidth: normalizeNumber(overlapWidth),
    envelopesOverlap: true as const,
    classification: "overlapping-source-group-envelopes" as const,
    validationTargetOnly: true as const,
    strictNumericPartitionReproduced: false as const,
  };
  return {
    ...withoutHash,
    envelopeDiagnosticSha256: hashValue(withoutHash),
  };
}

function comparisonPolicy(): XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport["comparisonPolicy"] {
  return {
    policyId: "finite-absolute-relative-tolerance-v1",
    metric: "unit-expanded-direct-total-damage",
    direction: "rank-one-minus-rank-two",
    pairEnumeration: "technical-id-ordered-exhaustive-cartesian-3x2",
    expectedPairCount: 6,
    absoluteTolerance: XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_ABSOLUTE_TOLERANCE,
    relativeTolerance: XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_RELATIVE_TOLERANCE,
    allowedDifferenceFormula:
      "max(absoluteTolerance, relativeTolerance * max(1, abs(rankOne), abs(rankTwo)))",
    finiteInputsRequired: true,
    gameplaySignificanceThresholdApplied: false,
    strictAboveToleranceMeansAligned: true,
    strictBelowNegativeToleranceMeansCounterexample: true,
    withinInclusiveToleranceMeansTie: true,
  };
}

function buildDeathmatchExclusion(): XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport["sourceTargetBoundary"]["deathmatchExclusion"] {
  return {
    candidateId: EXPECTED_DEATHMATCH_CANDIDATE_ID,
    branchGroupId: DEATHMATCH_GROUP_ID,
    authenticatedTechnicalObservation: true,
    sourceOrdering: "unranked",
    sourceRankGroup: null,
    excludedFromFiveStarGroups: true,
    excludedFromAllPairs: true,
    crossRarityComparisonExecuted: false,
    relativePosition: null,
    factoryRank: null,
  };
}

function decodeBase64(value: string, sourcePath: string): Buffer {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Xiao source-group diagnostic source ${sourcePath} has no bytes.`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new Error(
      `Xiao source-group diagnostic source ${sourcePath} has non-canonical base64.`,
    );
  }
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
    throw new Error(`Cannot normalize non-finite Xiao diagnostic value ${value}.`);
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
