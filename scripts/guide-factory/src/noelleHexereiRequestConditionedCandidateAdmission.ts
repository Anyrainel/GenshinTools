import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { stableJson } from "./io";
import {
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS,
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_REPORT_PATH,
  requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport,
  type NoelleHexereiPartialEquipmentCompositionInput,
  type NoelleHexereiPartialEquipmentCompositionReport,
  type NoelleHexereiPartialEquipmentValidationCandidate,
} from "./noelleHexereiPartialEquipmentComposition";
import {
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REPORT_PATH,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS,
  requireAuthenticatedNoelleHexereiLocalStatPriorityDiagnosticReport,
  type NoelleHexereiDiagnosticCircletStat,
  type NoelleHexereiDiagnosticHuskStacks,
  type NoelleHexereiDiagnosticNicoleMode,
  type NoelleHexereiDiagnosticProbeStat,
  type NoelleHexereiDiagnosticProfileId,
  type NoelleHexereiDiagnosticRefinement,
  type NoelleHexereiDiagnosticWitnessId,
  type NoelleHexereiContextRobustnessRow,
  type NoelleHexereiLocalStatPriorityDiagnosticInput,
  type NoelleHexereiLocalStatPriorityDiagnosticReport,
  type NoelleHexereiOrdinalOutcome,
  type NoelleHexereiSourceOrderDiagnostic,
} from "./noelleHexereiLocalStatPriorityDiagnostic";
import { FACTORY_ROOT, REPOSITORY_ROOT } from "./paths";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";

export const NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_ID =
  "noelle-hexerei-request-conditioned-candidate-admission-v1";
export const NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "noelle-hexerei-request-conditioned-candidate-admission.json",
  );

export const NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH = path.relative(
  REPOSITORY_ROOT,
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_REPORT_PATH,
).replaceAll("\\", "/");
export const NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH = path.relative(
  REPOSITORY_ROOT,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REPORT_PATH,
).replaceAll("\\", "/");
export const NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/noelleHexereiRequestConditionedCandidateAdmission.ts";
export const NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CLI_RELATIVE_PATH =
  "scripts/guide-factory/src/assemble-noelle-hexerei-request-conditioned-candidate-admission.ts";

export const NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS =
  [
    ...new Set([
      ...NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS,
      NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH,
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CORE_RELATIVE_PATH,
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CLI_RELATIVE_PATH,
    ]),
  ].sort(compareText);

export const NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_SOURCE_FILE_PATHS =
  [
    ...NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
  ];

export const NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS =
  [...NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS] as const;

const EXPECTED_INPUT_PATH_COUNT = 119;
const EXPECTED_RUNTIME_INPUT_PATH_COUNT = 80;
const EXPECTED_JSON_INPUT_COUNT = 15;
const EXPECTED_BINARY_RUNTIME_INPUT_COUNT = 2;

const REQUESTS = [
  {
    sequence: 0,
    requestId: "c0-q9",
    witnessId: "c0-q9",
    characterId: "noelle",
    constellation: 0,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
  },
  {
    sequence: 1,
    requestId: "c5-q9",
    witnessId: "c5-q9",
    characterId: "noelle",
    constellation: 5,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
  },
  {
    sequence: 2,
    requestId: "c0-q10",
    witnessId: "c0-q10",
    characterId: "noelle",
    constellation: 0,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
  },
  {
    sequence: 3,
    requestId: "c5-q10",
    witnessId: "c5-q10",
    characterId: "noelle",
    constellation: 5,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
  },
  {
    sequence: 4,
    requestId: "c6-q9",
    witnessId: "c6-q9",
    characterId: "noelle",
    constellation: 6,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
  },
  {
    sequence: 5,
    requestId: "c6-q10",
    witnessId: "c6-q10",
    characterId: "noelle",
    constellation: 6,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
  },
] as const;

export type NoelleHexereiEnteredRequest = (typeof REQUESTS)[number];

type NoelleHexereiSourcePredicateClause =
  | {
      type: "constellation-at-most" | "constellation-at-least";
      characterId: "noelle";
      threshold: number;
    }
  | {
      type: "talent-level-is" | "talent-level-at-least";
      characterId: "noelle";
      talent: "burst";
      threshold: number;
    };

interface NoelleHexereiSourceRequestPredicate {
  type: "all" | "any";
  predicates: NoelleHexereiSourcePredicateClause[];
}

const LOWER_SOURCE_REQUEST_PREDICATE = {
  type: "all",
  predicates: [
    {
      type: "constellation-at-most",
      characterId: "noelle",
      threshold: 5,
    },
    {
      type: "talent-level-is",
      characterId: "noelle",
      talent: "burst",
      threshold: 9,
    },
  ],
} as const;

const HIGH_SOURCE_REQUEST_PREDICATE = {
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
} as const;

export const NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST = {
  requestId: "noelle-hexerei-six-request-partial-candidate-admission-v1",
  authorship: "guide-factory-technical-request",
  sourceAuthoredRequestCoverage: false,
  exactTeamContext: ["noelle", "durin", "nicole", "xilonen"],
  enteredRequests: REQUESTS,
  candidateMatchPolicy: "evaluate-authenticated-source-predicates-against-entered-facts-only",
  relationAdmissionPolicy:
    "admit-only-when-all-16-tested-contexts-align-no-majority-vote",
  evidenceContextAxes: {
    circlet: ["cr", "cd"],
    gestRefinement: [1, 5],
    nicoleMode: ["all-theosis", "hexerei-theosis"],
    huskStacks: [4, 0],
  },
  expectedCardinality: {
    enteredRequestCount: 6,
    uniqueMatchedCandidateCount: 2,
    relationAdmissionCount: 18,
    evidencePerRelationCount: 16,
    robustnessRowsPerRelationCount: 4,
    consumedDiagnosticCount: 288,
    consumedRobustnessRowCount: 72,
    admittedRelationCount: 12,
    withheldCounterexampleRelationCount: 6,
    withheldInconclusiveRelationCount: 0,
  },
  selectionOutputs: {
    weapon: null,
    artifactSet: null,
    sands: null,
    goblet: null,
    circlet: null,
    substatAllocation: null,
    statWeights: null,
  },
  optimizerRequested: false,
  damageComputationRequested: false,
  rotationReplayRequested: false,
  energyRecoveryRequested: false,
} as const;

type TechnicalRequest =
  typeof NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST;

export interface NoelleHexereiRequestConditionedCandidateAdmissionSourceFile {
  path: string;
  bytesBase64: string;
}

export interface NoelleHexereiRequestConditionedCandidateAdmissionInput {
  cp53ReportInput: NoelleHexereiPartialEquipmentCompositionReport;
  cp53Input: NoelleHexereiPartialEquipmentCompositionInput;
  cp56ReportInput: NoelleHexereiLocalStatPriorityDiagnosticReport;
  cp56Input: NoelleHexereiLocalStatPriorityDiagnosticInput;
  technicalRequest: TechnicalRequest;
  sourceFiles: readonly NoelleHexereiRequestConditionedCandidateAdmissionSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export type NoelleHexereiLocalRelationAdmissionStatus =
  | "admitted-unanimous-across-all-16-tested-contexts"
  | "withheld-counterexample"
  | "withheld-inconclusive";

export interface NoelleHexereiRelationDiagnosticReference {
  diagnosticId: string;
  diagnosticSha256: string;
  witnessId: NoelleHexereiDiagnosticWitnessId;
  profileId: NoelleHexereiDiagnosticProfileId;
  sourceRelationId: string;
  circlet: NoelleHexereiDiagnosticCircletStat;
  refinement: NoelleHexereiDiagnosticRefinement;
  nicoleMode: NoelleHexereiDiagnosticNicoleMode;
  huskStacks: NoelleHexereiDiagnosticHuskStacks;
  higherPriorityStat: NoelleHexereiDiagnosticProbeStat;
  lowerPriorityStat: NoelleHexereiDiagnosticProbeStat;
  higherPriorityMarginalId: string;
  lowerPriorityMarginalId: string;
  signedHigherMinusLowerDelta: number;
  allowedDifference: number;
  outcome: NoelleHexereiOrdinalOutcome;
  evidenceReferenceSha256: string;
}

export interface NoelleHexereiRelationRobustnessReference {
  robustnessId: string;
  robustnessSha256: string;
  witnessId: NoelleHexereiDiagnosticWitnessId;
  profileId: NoelleHexereiDiagnosticProfileId;
  sourceRelationId: string;
  circlet: NoelleHexereiDiagnosticCircletStat;
  refinement: NoelleHexereiDiagnosticRefinement;
  diagnosticIds: string[];
  sourceOrderAlignedCount: number;
  sourceOrderCounterexampleCount: number;
  withinToleranceInconclusiveCount: number;
  classification: NoelleHexereiContextRobustnessRow["classification"];
  robustnessReferenceSha256: string;
}

export interface NoelleHexereiLocalRelationAdmission {
  admissionId: string;
  requestId: string;
  witnessId: NoelleHexereiDiagnosticWitnessId;
  candidateId: string;
  candidateSha256: string;
  profileId: NoelleHexereiDiagnosticProfileId;
  sourceRelationId: string;
  higherPriorityStat: NoelleHexereiDiagnosticProbeStat;
  lowerPriorityStat: NoelleHexereiDiagnosticProbeStat;
  testedContextDomain: {
    circlets: NoelleHexereiDiagnosticCircletStat[];
    refinements: NoelleHexereiDiagnosticRefinement[];
    nicoleModes: NoelleHexereiDiagnosticNicoleMode[];
    huskStackStates: NoelleHexereiDiagnosticHuskStacks[];
    CartesianContextCount: 16;
  };
  evidence: NoelleHexereiRelationDiagnosticReference[];
  evidenceCount: 16;
  robustnessEvidence: NoelleHexereiRelationRobustnessReference[];
  robustnessEvidenceCount: 4;
  robustnessRowsExactlyPartitionRawEvidence: true;
  sourceOrderAlignedCount: number;
  sourceOrderCounterexampleCount: number;
  withinToleranceInconclusiveCount: number;
  admissionStatus: NoelleHexereiLocalRelationAdmissionStatus;
  blockingDiagnosticIds: string[];
  blockingReason:
    | null
    | "one-or-more-local-counterexamples"
    | "one-or-more-local-tolerance-inconclusive-outcomes";
  unanimousAlignmentRequired: true;
  majorityVoteAllowed: false;
  adjacentSourceGroupsOnly: true;
  sourcePriorityValidated: false;
  supportsUniversalPriorityClaim: false;
  supportsTotalOrderClaim: false;
  admissionSha256: string;
}

export interface NoelleHexereiRequestConditionedCandidateEnvelope {
  envelopeId: string;
  request: NoelleHexereiEnteredRequest;
  requestCanonicalObjectSha256: string;
  requestAuthorship: "guide-factory-technical-request";
  sourceAuthoredRequestCoverage: false;
  candidateMatch: {
    candidateId: string;
    candidateSha256: string;
    profileId: NoelleHexereiDiagnosticProfileId;
    sourcePredicate: NoelleHexereiPartialEquipmentValidationCandidate["artifactProfile"]["branch"]["requestPredicate"];
    predicateEvaluatedAgainstEnteredFactsOnly: true;
    runtimeEffectiveTalentsUsedForMatching: false;
    exactMatchedCandidateCount: 1;
  };
  enteredAndRuntimeTalentBoundary: {
    constellation: 0 | 5 | 6;
    enteredTalentLevels: { auto: 10; skill: 1; burst: 9 | 10 };
    runtimeEffectiveTalentLevels: {
      auto: 10;
      skill: 1 | 4;
      burst: 9 | 10 | 12 | 13;
    };
    runtimeEffectiveTalentEvidenceOrigin: "authenticated-cp56-cells";
    enteredFactsRemainDistinctFromRuntimeEffectiveTalents: true;
  };
  partialCandidate: NoelleHexereiPartialEquipmentValidationCandidate;
  preservedSourceObservations: {
    exactTeam: NoelleHexereiPartialEquipmentValidationCandidate["team"];
    artifactSet: NoelleHexereiPartialEquipmentValidationCandidate["artifactProfile"]["artifactSet"];
    mainStats: {
      sands: NoelleHexereiPartialEquipmentValidationCandidate["artifactProfile"]["mainStats"]["sands"];
      goblet: NoelleHexereiPartialEquipmentValidationCandidate["artifactProfile"]["mainStats"]["goblet"];
      circlet: NoelleHexereiPartialEquipmentValidationCandidate["artifactProfile"]["mainStats"]["circlet"];
      sourceAlignedSandsObservation: "atk%" | "def%";
      unorderedCritCircletDomain: ["cr", "cd"];
      guardedAlternativesPreservedUnresolved: true;
      mainStatSelectionExecuted: false;
    };
    weaponOption: NoelleHexereiPartialEquipmentValidationCandidate["weaponOption"];
    substatPriorityOriginal: NoelleHexereiPartialEquipmentValidationCandidate["artifactProfile"]["substatPriority"];
  };
  relationAdmissions: NoelleHexereiLocalRelationAdmission[];
  relationAdmissionSummary: {
    sourceAdjacentRelationCount: 3;
    admittedRelationCount: number;
    withheldCounterexampleRelationCount: number;
    withheldInconclusiveRelationCount: number;
    aggregateStatus:
      | "all-three-local-relations-admitted"
      | "partial-local-relation-admission-counterexamples-preserved"
      | "partial-local-relation-admission-inconclusive-preserved";
    originalSourcePriorityGroupsPreservedUnchanged: true;
    totalOrderSynthesized: false;
    scalarWeightsSynthesized: false;
  };
  unresolvedBoundaries: {
    sourceReviewStatus: "unreviewed";
    weaponRefinement: "missing-not-zero";
    weaponQuantitativePerformance: "missing-not-zero";
    completeArtifactAssignment: false;
    completeBuild: false;
    rotationTimingAndBuffCoverage: "missing-not-zero";
    teamTotalDamage: "not-computed";
    energyRecharge: "deferred-missing-not-zero";
  };
  promotionReady: false;
  publicationStatus: "withheld-unreviewed-partial-candidate";
  envelopeSha256: string;
}

export interface NoelleHexereiRequestConditionedCandidateAdmissionReport {
  schemaVersion: 1;
  reportType: "noelle-hexerei-request-conditioned-candidate-admission";
  admissionId: typeof NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_ID;
  classification: "authenticated-request-conditioned-partial-candidate-admission";
  validationStatus: "completed-six-request-fail-closed-relation-admission";
  publicationStatus: "withheld-unreviewed-partial-candidates";
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allGeneratedFromHashesAuthenticatedFromBytes: true;
    allSourceBytesMatchWorkspaceFiles: true;
    cp53ReportByteAndParsedObjectParity: true;
    cp56ReportByteAndParsedObjectParity: true;
    exactCp53InputProjection: true;
    exactCp56InputProjection: true;
    exactTechnicalRequest: true;
    sourceFileCount: 119;
    generatedFromCount: 119;
    runtimeInputPathCount: 80;
    jsonInputCount: 15;
    binaryRuntimeInputCount: 2;
  };
  upstreamBoundary: {
    cp53: {
      reportPath: typeof NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH;
      reportFileSha256: string;
      canonicalObjectSha256: string;
      freshlyAuthenticated: true;
      partialCandidateCount: 2;
      selectionCount: 0;
      energyRecoveryComputationCount: 0;
    };
    cp56: {
      reportPath: typeof NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH;
      reportFileSha256: string;
      canonicalObjectSha256: string;
      freshlyAuthenticated: true;
      sourceOrderDiagnosticCount: 288;
      contextRobustnessRowCount: 72;
      sourcePriorityValidated: false;
      selectedStatCount: 0;
      energyRecoveryComputationCount: 0;
    };
  };
  requestBoundary: {
    request: TechnicalRequest;
    requestCanonicalObjectSha256: string;
    enteredRequestCount: 6;
    exactTeamContext: ["noelle", "durin", "nicole", "xilonen"];
    sourceAuthoredRequestCoverage: false;
    enteredFactsOnlyCandidateMatching: true;
    runtimeEffectiveTalentsUsedForMatching: false;
    energyRecoveryDeferred: true;
  };
  admissionPolicy: {
    policy: "all-16-contexts-must-align-no-majority-vote";
    evidencePerRelationCount: 16;
    robustnessRowsPerRelationCount: 4;
    exactCartesianAxes: {
      circlets: ["cr", "cd"];
      refinements: [1, 5];
      nicoleModes: ["all-theosis", "hexerei-theosis"];
      huskStackStates: [4, 0];
    };
    anyCounterexampleWithholds: true;
    anyInconclusiveWithoutCounterexampleWithholds: true;
    fifteenOfSixteenIsInsufficient: true;
    averagingAllowed: false;
    majorityVoteAllowed: false;
    sourcePriorityValidatedByLocalAdmission: false;
  };
  candidateCatalog: NoelleHexereiPartialEquipmentValidationCandidate[];
  requestConditionedCandidateEnvelopes: NoelleHexereiRequestConditionedCandidateEnvelope[];
  evidenceConsumptionLedger: {
    upstreamDiagnosticCount: 288;
    consumedDiagnosticReferenceCount: 288;
    uniqueConsumedDiagnosticCount: 288;
    unconsumedDiagnosticCount: 0;
    multiplyConsumedDiagnosticCount: 0;
    everyUpstreamDiagnosticConsumedExactlyOnce: true;
    upstreamDiagnosticIdsSha256: string;
    consumedDiagnosticIdsSha256: string;
    evidenceReferencesSha256: string;
    upstreamRobustnessRowCount: 72;
    consumedRobustnessReferenceCount: 72;
    uniqueConsumedRobustnessRowCount: 72;
    unconsumedRobustnessRowCount: 0;
    multiplyConsumedRobustnessRowCount: 0;
    everyUpstreamRobustnessRowConsumedExactlyOnce: true;
    upstreamRobustnessIdsSha256: string;
    consumedRobustnessIdsSha256: string;
    robustnessReferencesSha256: string;
  };
  identityBoundary: {
    candidateCatalogSha256: string;
    enteredRequestsSha256: string;
    relationAdmissionsSha256: string;
    requestConditionedCandidateEnvelopesSha256: string;
    aggregateAdmissionSha256: string;
    candidateSha256ValuesPreservedExactly: true;
    cp53CandidateObjectsPreservedExactly: true;
    cp56DiagnosticHashesPreservedExactly: true;
    serializationOrderIsNotRank: true;
  };
  summary: {
    enteredRequestCount: 6;
    requestConditionedEnvelopeCount: 6;
    uniqueMatchedCandidateCount: 2;
    lowerProfileRequestCount: 2;
    highProfileRequestCount: 4;
    allRelationsAdmittedRequestCount: 2;
    oneOrMoreRelationsWithheldRequestCount: 4;
    relationAdmissionCount: 18;
    admittedRelationCount: 12;
    withheldCounterexampleRelationCount: 6;
    withheldInconclusiveRelationCount: 0;
    admittedRelationEvidenceCount: 192;
    withheldRelationEvidenceCount: 96;
    sourceOrderAlignedEvidenceCount: 242;
    sourceOrderCounterexampleEvidenceCount: 46;
    withinToleranceInconclusiveEvidenceCount: 0;
    sourceSelectionCount: 0;
    rankingCount: 0;
    scalarWeightCount: 0;
    idealStatAllocationCount: 0;
    optimizerRunCount: 0;
    autoTuneRunCount: 0;
    damageComputationCount: 0;
    rotationReplayCount: 0;
    teamTotalDamageComputationCount: 0;
    energyRecoveryComputationCount: 0;
  };
  operationSummary: {
    countingScope: "cp57-request-conditioning-only-excludes-upstream-authentication-work";
    upstreamAuthenticationOperationsExcluded: true;
    upstreamCp56TechnicalCellsFreshlyRecomputedDuringAuthentication: 480;
    upstreamCp56TeamBuildsFreshlyMaterializedDuringAuthentication: 960;
    upstreamCp56ObjectiveTeamBuildsFreshlyMaterializedDuringAuthentication: 480;
    upstreamCp56HuskControlTeamBuildsFreshlyMaterializedDuringAuthentication: 480;
    localDamageEvaluationCount: 0;
    enteredRequestResolutionCount: 6;
    sourcePredicateEvaluationCount: 12;
    exactCandidateMatchCount: 6;
    candidateCatalogCloneCount: 2;
    envelopeCandidateCopyCount: 6;
    relationAdmissionDecisionCount: 18;
    diagnosticReferenceConsumptionCount: 288;
    robustnessReferenceConsumptionCount: 72;
    selectionCount: 0;
    rankingCount: 0;
    optimizerRunCount: 0;
    autoTuneRunCount: 0;
    idealStatAllocationCount: 0;
    rotationReplayCount: 0;
    teamTotalDamageComputationCount: 0;
    energyRecoveryComputationCount: 0;
  };
  supportsSourceAuthorization: false;
  supportsRequestConditionedPartialValidationAdmission: true;
  supportsLocalOrdinalRelationAdmission: true;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsBuildRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsWinnerClaims: false;
  supportsScalarWeights: false;
  supportsTotalStatOrder: false;
  supportsPlayerDamageClaims: false;
  supportsSourceRotationReplay: false;
  supportsTeamTotalDamageComputation: false;
  supportsDpsClaims: false;
  supportsBuffTimingClaims: false;
  supportsEnergyRecoveryClaims: false;
  supportsIdealStatAllocation: false;
  requestConditioningExecuted: true;
  candidateApplicabilityResolutionExecuted: true;
  competitiveCandidateSelectionExecuted: false;
  localRelationAdmissionExecuted: true;
  sourceCandidateSelectionExecuted: false;
  sourceStatSelectionExecuted: false;
  sourceSubstatPriorityValidated: false;
  optimizerExecuted: false;
  autoTuneExecuted: false;
  damageComputationExecuted: false;
  rotationReplayExecuted: false;
  teamTotalDamageComputationExecuted: false;
  idealStatAllocationExecuted: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type NoelleHexereiRequestConditionedCandidateAdmissionAuthentication =
  | {
      authenticated: true;
      canonicalReport: NoelleHexereiRequestConditionedCandidateAdmissionReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      message: string;
    };

interface AuthenticatedOuterInputs {
  sourceBytesByPath: Map<string, Buffer>;
  generatedFrom: GeneratedFromEntry[];
  cp53Report: NoelleHexereiPartialEquipmentCompositionReport;
  cp56Report: NoelleHexereiLocalStatPriorityDiagnosticReport;
}

const CAUTIONS = [
  "These are request-conditioned wrappers around authenticated CP53 partial validation candidates, not builds, recommendations, or source-authored request coverage.",
  "Candidate applicability is resolved from entered constellation and talent facts only. Runtime-effective talents are retained as separate evidence and never feed source-predicate matching.",
  "A relation is locally admitted only when all sixteen CP56 contexts align. Withheld relations preserve every aligned and counterexample row; no majority vote or averaging is used.",
  "Local relation admission does not validate the source priority globally, synthesize a total stat order, or rewrite the original source priority groups.",
  "Weapon refinement and performance, guarded main-stat alternatives, legal artifact allocation, source review, rotation timing, team damage, and Energy Recharge remain unresolved.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not publish an envelope or its preserved CP53 candidate as a Noelle guide, complete build, team recommendation, equipment recommendation, or stat recommendation.",
  "Do not treat admitted local relations as universal priorities, scalar weights, a total order, or proof that a source is correct.",
  "Do not treat withheld relations as proof that the source is wrong; they are counterexamples to unanimity in this exact technical grid.",
  "Do not infer a selected weapon, refinement, artifact set, main stat, substat allocation, winner, rank, or inventory result.",
  "Do not emit player damage, DPS, rotation, buff-coverage, team-total, or Energy Recharge claims from this admission report.",
] as const;

export async function buildNoelleHexereiRequestConditionedCandidateAdmissionReport(
  input: NoelleHexereiRequestConditionedCandidateAdmissionInput,
): Promise<NoelleHexereiRequestConditionedCandidateAdmissionReport> {
  const raw = authenticateOuterInputs(input);
  assertExactTechnicalRequest(input.technicalRequest);
  assertExactNestedInputProjection(raw, input);

  const cp53Report =
    requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport(
      raw.cp53Report,
      input.cp53Input,
    );
  const cp56Report =
    await requireAuthenticatedNoelleHexereiLocalStatPriorityDiagnosticReport(
      raw.cp56Report,
      input.cp56Input,
    );
  assertUpstreamSemanticBoundaries(cp53Report, cp56Report);

  const candidateCatalog = cp53Report.candidates.map((candidate) => {
    assertCandidateIdentity(candidate);
    return structuredClone(candidate);
  });
  const requestConditionedCandidateEnvelopes = REQUESTS.map((request) =>
    buildRequestConditionedEnvelope(
      request,
      candidateCatalog,
      cp56Report,
    ),
  );
  assertEnvelopeCardinality(
    requestConditionedCandidateEnvelopes,
    candidateCatalog,
  );

  const allRelations = requestConditionedCandidateEnvelopes.flatMap(
    ({ relationAdmissions }) => relationAdmissions,
  );
  const allEvidence = allRelations.flatMap(({ evidence }) => evidence);
  const allRobustnessEvidence = allRelations.flatMap(
    ({ robustnessEvidence }) => robustnessEvidence,
  );
  const evidenceConsumptionLedger = buildEvidenceConsumptionLedger(
    allEvidence,
    cp56Report.sourceOrderDiagnostics,
    allRobustnessEvidence,
    cp56Report.contextRobustnessRows,
  );
  const summary = buildSummary(
    requestConditionedCandidateEnvelopes,
    allRelations,
    allEvidence,
  );

  const candidateCatalogSha256 = hashValue(candidateCatalog);
  const enteredRequestsSha256 = hashValue(REQUESTS);
  const technicalRequestSha256 = hashValue(
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
  );
  const cp53CanonicalObjectSha256 = hashValue(cp53Report);
  const cp56CanonicalObjectSha256 = hashValue(cp56Report);
  const relationAdmissionsSha256 = hashValue(
    allRelations.map(({ admissionSha256 }) => admissionSha256),
  );
  const requestConditionedCandidateEnvelopesSha256 = hashValue(
    requestConditionedCandidateEnvelopes.map(
      ({ envelopeSha256 }) => envelopeSha256,
    ),
  );
  const aggregateAdmissionSha256 = hashValue({
    cp53CanonicalObjectSha256,
    cp56CanonicalObjectSha256,
    technicalRequestSha256,
    candidateCatalogSha256,
    enteredRequestsSha256,
    relationAdmissionsSha256,
    requestConditionedCandidateEnvelopesSha256,
    evidenceReferencesSha256:
      evidenceConsumptionLedger.evidenceReferencesSha256,
    robustnessReferencesSha256:
      evidenceConsumptionLedger.robustnessReferencesSha256,
  });

  return {
    schemaVersion: 1,
    reportType: "noelle-hexerei-request-conditioned-candidate-admission",
    admissionId:
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_ID,
    classification:
      "authenticated-request-conditioned-partial-candidate-admission",
    validationStatus: "completed-six-request-fail-closed-relation-admission",
    publicationStatus: "withheld-unreviewed-partial-candidates",
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromBytes: true,
      allSourceBytesMatchWorkspaceFiles: true,
      cp53ReportByteAndParsedObjectParity: true,
      cp56ReportByteAndParsedObjectParity: true,
      exactCp53InputProjection: true,
      exactCp56InputProjection: true,
      exactTechnicalRequest: true,
      sourceFileCount: 119,
      generatedFromCount: 119,
      runtimeInputPathCount: 80,
      jsonInputCount: 15,
      binaryRuntimeInputCount: 2,
    },
    upstreamBoundary: {
      cp53: {
        reportPath: NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH,
        reportFileSha256: sha256Bytes(
          requiredSourceBytes(
            raw.sourceBytesByPath,
            NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH,
          ),
        ),
        canonicalObjectSha256: cp53CanonicalObjectSha256,
        freshlyAuthenticated: true,
        partialCandidateCount: 2,
        selectionCount: 0,
        energyRecoveryComputationCount: 0,
      },
      cp56: {
        reportPath: NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH,
        reportFileSha256: sha256Bytes(
          requiredSourceBytes(
            raw.sourceBytesByPath,
            NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH,
          ),
        ),
        canonicalObjectSha256: cp56CanonicalObjectSha256,
        freshlyAuthenticated: true,
        sourceOrderDiagnosticCount: 288,
        contextRobustnessRowCount: 72,
        sourcePriorityValidated: false,
        selectedStatCount: 0,
        energyRecoveryComputationCount: 0,
      },
    },
    requestBoundary: {
      request: structuredClone(
        NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
      ),
      requestCanonicalObjectSha256: technicalRequestSha256,
      enteredRequestCount: 6,
      exactTeamContext: ["noelle", "durin", "nicole", "xilonen"],
      sourceAuthoredRequestCoverage: false,
      enteredFactsOnlyCandidateMatching: true,
      runtimeEffectiveTalentsUsedForMatching: false,
      energyRecoveryDeferred: true,
    },
    admissionPolicy: {
      policy: "all-16-contexts-must-align-no-majority-vote",
      evidencePerRelationCount: 16,
      robustnessRowsPerRelationCount: 4,
      exactCartesianAxes: {
        circlets: ["cr", "cd"],
        refinements: [1, 5],
        nicoleModes: ["all-theosis", "hexerei-theosis"],
        huskStackStates: [4, 0],
      },
      anyCounterexampleWithholds: true,
      anyInconclusiveWithoutCounterexampleWithholds: true,
      fifteenOfSixteenIsInsufficient: true,
      averagingAllowed: false,
      majorityVoteAllowed: false,
      sourcePriorityValidatedByLocalAdmission: false,
    },
    candidateCatalog,
    requestConditionedCandidateEnvelopes,
    evidenceConsumptionLedger,
    identityBoundary: {
      candidateCatalogSha256,
      enteredRequestsSha256,
      relationAdmissionsSha256,
      requestConditionedCandidateEnvelopesSha256,
      aggregateAdmissionSha256,
      candidateSha256ValuesPreservedExactly: true,
      cp53CandidateObjectsPreservedExactly: true,
      cp56DiagnosticHashesPreservedExactly: true,
      serializationOrderIsNotRank: true,
    },
    summary,
    operationSummary: {
      countingScope:
        "cp57-request-conditioning-only-excludes-upstream-authentication-work",
      upstreamAuthenticationOperationsExcluded: true,
      upstreamCp56TechnicalCellsFreshlyRecomputedDuringAuthentication: 480,
      upstreamCp56TeamBuildsFreshlyMaterializedDuringAuthentication: 960,
      upstreamCp56ObjectiveTeamBuildsFreshlyMaterializedDuringAuthentication: 480,
      upstreamCp56HuskControlTeamBuildsFreshlyMaterializedDuringAuthentication: 480,
      localDamageEvaluationCount: 0,
      enteredRequestResolutionCount: 6,
      sourcePredicateEvaluationCount: 12,
      exactCandidateMatchCount: 6,
      candidateCatalogCloneCount: 2,
      envelopeCandidateCopyCount: 6,
      relationAdmissionDecisionCount: 18,
      diagnosticReferenceConsumptionCount: 288,
      robustnessReferenceConsumptionCount: 72,
      selectionCount: 0,
      rankingCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      idealStatAllocationCount: 0,
      rotationReplayCount: 0,
      teamTotalDamageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    },
    supportsSourceAuthorization: false,
    supportsRequestConditionedPartialValidationAdmission: true,
    supportsLocalOrdinalRelationAdmission: true,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsBuildRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsWinnerClaims: false,
    supportsScalarWeights: false,
    supportsTotalStatOrder: false,
    supportsPlayerDamageClaims: false,
    supportsSourceRotationReplay: false,
    supportsTeamTotalDamageComputation: false,
    supportsDpsClaims: false,
    supportsBuffTimingClaims: false,
    supportsEnergyRecoveryClaims: false,
    supportsIdealStatAllocation: false,
    requestConditioningExecuted: true,
    candidateApplicabilityResolutionExecuted: true,
    competitiveCandidateSelectionExecuted: false,
    localRelationAdmissionExecuted: true,
    sourceCandidateSelectionExecuted: false,
    sourceStatSelectionExecuted: false,
    sourceSubstatPriorityValidated: false,
    optimizerExecuted: false,
    autoTuneExecuted: false,
    damageComputationExecuted: false,
    rotationReplayExecuted: false,
    teamTotalDamageComputationExecuted: false,
    idealStatAllocationExecuted: false,
    energyRecoveryComputationExecuted: false,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

export async function authenticateNoelleHexereiRequestConditionedCandidateAdmissionReport(
  serializedReport: NoelleHexereiRequestConditionedCandidateAdmissionReport,
  input: NoelleHexereiRequestConditionedCandidateAdmissionInput,
): Promise<NoelleHexereiRequestConditionedCandidateAdmissionAuthentication> {
  let canonicalReport: NoelleHexereiRequestConditionedCandidateAdmissionReport;
  try {
    canonicalReport =
      await buildNoelleHexereiRequestConditionedCandidateAdmissionReport(input);
  } catch (error) {
    return {
      authenticated: false,
      reason: "canonical-inputs-rejected",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      message:
        "The serialized CP57 report does not match a fresh reconstruction from authenticated CP53/CP56 evidence.",
    };
  }
  return { authenticated: true, canonicalReport };
}

export async function requireAuthenticatedNoelleHexereiRequestConditionedCandidateAdmissionReport(
  serializedReport: NoelleHexereiRequestConditionedCandidateAdmissionReport,
  input: NoelleHexereiRequestConditionedCandidateAdmissionInput,
): Promise<NoelleHexereiRequestConditionedCandidateAdmissionReport> {
  const authentication =
    await authenticateNoelleHexereiRequestConditionedCandidateAdmissionReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP57 authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export function resolveNoelleHexereiCandidateForEnteredRequest(
  request: NoelleHexereiEnteredRequest,
  candidates: readonly NoelleHexereiPartialEquipmentValidationCandidate[],
): NoelleHexereiPartialEquipmentValidationCandidate {
  assertSupportedEnteredRequest(request);
  const matches = candidates.filter((candidate) =>
    evaluateSourceRequestPredicate(
      requireExactSourceRequestPredicate(candidate),
      request,
    ),
  );
  if (matches.length !== 1) {
    throw new Error(
      `CP57 expected exactly one CP53 candidate for ${request.requestId}; observed ${matches.length}.`,
    );
  }
  return matches[0];
}

function buildRequestConditionedEnvelope(
  request: NoelleHexereiEnteredRequest,
  candidates: readonly NoelleHexereiPartialEquipmentValidationCandidate[],
  cp56Report: NoelleHexereiLocalStatPriorityDiagnosticReport,
): NoelleHexereiRequestConditionedCandidateEnvelope {
  const candidate = resolveNoelleHexereiCandidateForEnteredRequest(
    request,
    candidates,
  );
  const profileId = requireProfileId(candidate);
  const witnessCells = cp56Report.cells.filter(
    ({ witnessId }) => witnessId === request.witnessId,
  );
  if (witnessCells.length !== 80) {
    throw new Error(
      `CP57 expected 80 CP56 cells for ${request.witnessId}; observed ${witnessCells.length}.`,
    );
  }
  const witnessEvidence = witnessCells[0].evaluation.witness;
  if (
    witnessEvidence.profileId !== profileId ||
    witnessEvidence.constellation !== request.constellation ||
    stableJson(witnessEvidence.enteredTalentLevels) !==
      stableJson(request.enteredTalentLevels) ||
    witnessCells.some(
      ({ profileId: cellProfileId, evaluation }) =>
        cellProfileId !== profileId ||
        stableJson(evaluation.witness) !== stableJson(witnessEvidence),
    )
  ) {
    throw new Error(
      `CP57 entered/runtime witness evidence drifted for ${request.requestId}.`,
    );
  }

  const target = cp56Report.sourcePriorityTargets.find(
    (candidateTarget) => candidateTarget.profileId === profileId,
  );
  if (!target || target.adjacentRelations.length !== 3) {
    throw new Error(`CP57 expected three adjacent relations for ${profileId}.`);
  }
  if (
    stableJson(target.sourcePriorityGroups) !==
    stableJson(
      candidate.artifactProfile.substatPriority.groups.map(({ statIds }) =>
        [...statIds],
      ),
    )
  ) {
    throw new Error(
      `CP57 CP53/CP56 source priority groups disagree for ${profileId}.`,
    );
  }
  const relationAdmissions = target.adjacentRelations.map((relation) =>
    buildRelationAdmission(
      request,
      candidate,
      relation,
      cp56Report.sourceOrderDiagnostics,
      cp56Report.contextRobustnessRows,
    ),
  );
  const admittedRelationCount = relationAdmissions.filter(
    ({ admissionStatus }) =>
      admissionStatus ===
      "admitted-unanimous-across-all-16-tested-contexts",
  ).length;
  const withheldCounterexampleRelationCount = relationAdmissions.filter(
    ({ admissionStatus }) => admissionStatus === "withheld-counterexample",
  ).length;
  const withheldInconclusiveRelationCount = relationAdmissions.filter(
    ({ admissionStatus }) => admissionStatus === "withheld-inconclusive",
  ).length;
  const aggregateStatus =
    admittedRelationCount === 3
      ? ("all-three-local-relations-admitted" as const)
      : withheldCounterexampleRelationCount > 0
        ? ("partial-local-relation-admission-counterexamples-preserved" as const)
        : ("partial-local-relation-admission-inconclusive-preserved" as const);
  const sourceAlignedSandsObservationValue =
    candidate.artifactProfile.mainStats.sands.options[0]?.statIds[0];
  if (
    sourceAlignedSandsObservationValue !== "atk%" &&
    sourceAlignedSandsObservationValue !== "def%"
  ) {
    throw new Error(
      `CP57 source-aligned Sands observation drifted for ${profileId}.`,
    );
  }
  const sourceAlignedSandsObservation = sourceAlignedSandsObservationValue as
    | "atk%"
    | "def%";
  if (
    stableJson(
      candidate.artifactProfile.mainStats.circlet.options[0]?.statIds,
    ) !== stableJson(["cr", "cd"])
  ) {
    throw new Error(`CP57 unordered CR/CD Circlet domain drifted for ${profileId}.`);
  }

  const withoutHash = {
    envelopeId: `${request.requestId}:${candidate.candidateId}:conditioned-envelope`,
    request: structuredClone(request),
    requestCanonicalObjectSha256: hashValue(request),
    requestAuthorship: "guide-factory-technical-request" as const,
    sourceAuthoredRequestCoverage: false as const,
    candidateMatch: {
      candidateId: candidate.candidateId,
      candidateSha256: candidate.candidateSha256,
      profileId,
      sourcePredicate: structuredClone(
        candidate.artifactProfile.branch.requestPredicate,
      ),
      predicateEvaluatedAgainstEnteredFactsOnly: true as const,
      runtimeEffectiveTalentsUsedForMatching: false as const,
      exactMatchedCandidateCount: 1 as const,
    },
    enteredAndRuntimeTalentBoundary: {
      constellation: request.constellation,
      enteredTalentLevels: structuredClone(request.enteredTalentLevels),
      runtimeEffectiveTalentLevels: structuredClone(
        witnessEvidence.runtimeEffectiveTalentLevels,
      ),
      runtimeEffectiveTalentEvidenceOrigin:
        "authenticated-cp56-cells" as const,
      enteredFactsRemainDistinctFromRuntimeEffectiveTalents: true as const,
    },
    partialCandidate: structuredClone(candidate),
    preservedSourceObservations: {
      exactTeam: structuredClone(candidate.team),
      artifactSet: structuredClone(candidate.artifactProfile.artifactSet),
      mainStats: {
        sands: structuredClone(candidate.artifactProfile.mainStats.sands),
        goblet: structuredClone(candidate.artifactProfile.mainStats.goblet),
        circlet: structuredClone(candidate.artifactProfile.mainStats.circlet),
        sourceAlignedSandsObservation,
        unorderedCritCircletDomain: ["cr", "cd"] as ["cr", "cd"],
        guardedAlternativesPreservedUnresolved: true as const,
        mainStatSelectionExecuted: false as const,
      },
      weaponOption: structuredClone(candidate.weaponOption),
      substatPriorityOriginal: structuredClone(
        candidate.artifactProfile.substatPriority,
      ),
    },
    relationAdmissions,
    relationAdmissionSummary: {
      sourceAdjacentRelationCount: 3 as const,
      admittedRelationCount,
      withheldCounterexampleRelationCount,
      withheldInconclusiveRelationCount,
      aggregateStatus,
      originalSourcePriorityGroupsPreservedUnchanged: true as const,
      totalOrderSynthesized: false as const,
      scalarWeightsSynthesized: false as const,
    },
    unresolvedBoundaries: {
      sourceReviewStatus: "unreviewed" as const,
      weaponRefinement: "missing-not-zero" as const,
      weaponQuantitativePerformance: "missing-not-zero" as const,
      completeArtifactAssignment: false as const,
      completeBuild: false as const,
      rotationTimingAndBuffCoverage: "missing-not-zero" as const,
      teamTotalDamage: "not-computed" as const,
      energyRecharge: "deferred-missing-not-zero" as const,
    },
    promotionReady: false as const,
    publicationStatus: "withheld-unreviewed-partial-candidate" as const,
  };
  return { ...withoutHash, envelopeSha256: hashValue(withoutHash) };
}

function buildRelationAdmission(
  request: NoelleHexereiEnteredRequest,
  candidate: NoelleHexereiPartialEquipmentValidationCandidate,
  relation: {
    relationId: string;
    higherStat: NoelleHexereiDiagnosticProbeStat;
    lowerStat: NoelleHexereiDiagnosticProbeStat;
  },
  diagnostics: readonly NoelleHexereiSourceOrderDiagnostic[],
  robustnessRows: readonly NoelleHexereiContextRobustnessRow[],
): NoelleHexereiLocalRelationAdmission {
  const profileId = requireProfileId(candidate);
  const matching = diagnostics
    .filter(
      (diagnostic) =>
        diagnostic.witnessId === request.witnessId &&
        diagnostic.profileId === profileId &&
        diagnostic.sourceRelationId === relation.relationId,
    )
    .sort(compareDiagnosticContext);
  assertExactSixteenContextGrid(matching, request, relation);
  const evidence = matching.map(buildEvidenceReference);
  const matchingRobustness = robustnessRows
    .filter(
      (row) =>
        row.witnessId === request.witnessId &&
        row.profileId === profileId &&
        row.sourceRelationId === relation.relationId,
    )
    .sort(compareRobustnessContext);
  const robustnessEvidence = matchingRobustness.map(buildRobustnessReference);
  assertExactFourRobustnessRows(
    matchingRobustness,
    evidence,
    request,
    relation,
  );
  const sourceOrderAlignedCount = evidence.filter(
    ({ outcome }) => outcome === "source-order-aligned",
  ).length;
  const sourceOrderCounterexampleCount = evidence.filter(
    ({ outcome }) => outcome === "source-order-counterexample",
  ).length;
  const withinToleranceInconclusiveCount = evidence.filter(
    ({ outcome }) => outcome === "within-tolerance-inconclusive",
  ).length;
  const admissionStatus =
    sourceOrderCounterexampleCount > 0
      ? ("withheld-counterexample" as const)
      : withinToleranceInconclusiveCount > 0
        ? ("withheld-inconclusive" as const)
        : sourceOrderAlignedCount === 16
          ? ("admitted-unanimous-across-all-16-tested-contexts" as const)
          : null;
  if (admissionStatus == null) {
    throw new Error(
      `CP57 could not apply the fail-closed relation policy to ${request.requestId}/${relation.relationId}.`,
    );
  }
  const blockingDiagnosticIds = evidence
    .filter(({ outcome }) => outcome !== "source-order-aligned")
    .map(({ diagnosticId }) => diagnosticId)
    .sort(compareText);
  const blockingReason =
    sourceOrderCounterexampleCount > 0
      ? ("one-or-more-local-counterexamples" as const)
      : withinToleranceInconclusiveCount > 0
        ? ("one-or-more-local-tolerance-inconclusive-outcomes" as const)
        : null;
  const withoutHash = {
    admissionId: `${request.requestId}:${relation.relationId}:local-relation-admission`,
    requestId: request.requestId,
    witnessId: request.witnessId,
    candidateId: candidate.candidateId,
    candidateSha256: candidate.candidateSha256,
    profileId,
    sourceRelationId: relation.relationId,
    higherPriorityStat: relation.higherStat,
    lowerPriorityStat: relation.lowerStat,
    testedContextDomain: {
      circlets: ["cr", "cd"] as NoelleHexereiDiagnosticCircletStat[],
      refinements: [1, 5] as NoelleHexereiDiagnosticRefinement[],
      nicoleModes: [
        "all-theosis",
        "hexerei-theosis",
      ] as NoelleHexereiDiagnosticNicoleMode[],
      huskStackStates: [4, 0] as NoelleHexereiDiagnosticHuskStacks[],
      CartesianContextCount: 16 as const,
    },
    evidence,
    evidenceCount: 16 as const,
    robustnessEvidence,
    robustnessEvidenceCount: 4 as const,
    robustnessRowsExactlyPartitionRawEvidence: true as const,
    sourceOrderAlignedCount,
    sourceOrderCounterexampleCount,
    withinToleranceInconclusiveCount,
    admissionStatus,
    blockingDiagnosticIds,
    blockingReason,
    unanimousAlignmentRequired: true as const,
    majorityVoteAllowed: false as const,
    adjacentSourceGroupsOnly: true as const,
    sourcePriorityValidated: false as const,
    supportsUniversalPriorityClaim: false as const,
    supportsTotalOrderClaim: false as const,
  };
  return { ...withoutHash, admissionSha256: hashValue(withoutHash) };
}

function buildEvidenceReference(
  diagnostic: NoelleHexereiSourceOrderDiagnostic,
): NoelleHexereiRelationDiagnosticReference {
  const withoutHash = {
    diagnosticId: diagnostic.diagnosticId,
    diagnosticSha256: diagnostic.diagnosticSha256,
    witnessId: diagnostic.witnessId,
    profileId: diagnostic.profileId,
    sourceRelationId: diagnostic.sourceRelationId,
    circlet: diagnostic.circlet,
    refinement: diagnostic.refinement,
    nicoleMode: diagnostic.nicoleMode,
    huskStacks: diagnostic.huskStacks,
    higherPriorityStat: diagnostic.higherPriorityStat,
    lowerPriorityStat: diagnostic.lowerPriorityStat,
    higherPriorityMarginalId: diagnostic.higherPriorityMarginalId,
    lowerPriorityMarginalId: diagnostic.lowerPriorityMarginalId,
    signedHigherMinusLowerDelta: diagnostic.signedHigherMinusLowerDelta,
    allowedDifference: diagnostic.allowedDifference,
    outcome: diagnostic.outcome,
  };
  return {
    ...withoutHash,
    evidenceReferenceSha256: hashValue(withoutHash),
  };
}

function buildRobustnessReference(
  row: NoelleHexereiContextRobustnessRow,
): NoelleHexereiRelationRobustnessReference {
  const withoutHash = {
    robustnessId: row.robustnessId,
    robustnessSha256: row.robustnessSha256,
    witnessId: row.witnessId,
    profileId: row.profileId,
    sourceRelationId: row.sourceRelationId,
    circlet: row.circlet,
    refinement: row.refinement,
    diagnosticIds: [...row.diagnosticIds].sort(compareText),
    sourceOrderAlignedCount: row.sourceOrderAlignedCount,
    sourceOrderCounterexampleCount: row.sourceOrderCounterexampleCount,
    withinToleranceInconclusiveCount: row.withinToleranceInconclusiveCount,
    classification: row.classification,
  };
  return {
    ...withoutHash,
    robustnessReferenceSha256: hashValue(withoutHash),
  };
}

function assertExactFourRobustnessRows(
  rows: readonly NoelleHexereiContextRobustnessRow[],
  evidence: readonly NoelleHexereiRelationDiagnosticReference[],
  request: NoelleHexereiEnteredRequest,
  relation: {
    relationId: string;
    higherStat: NoelleHexereiDiagnosticProbeStat;
    lowerStat: NoelleHexereiDiagnosticProbeStat;
  },
): void {
  const expectedContexts = ["cd:r1", "cd:r5", "cr:r1", "cr:r5"];
  const observedContexts = rows
    .map(({ circlet, refinement }) => `${circlet}:r${refinement}`)
    .sort(compareText);
  const evidenceIds = evidence.map(({ diagnosticId }) => diagnosticId).sort(compareText);
  const robustnessDiagnosticIds = rows
    .flatMap(({ diagnosticIds }) => diagnosticIds)
    .sort(compareText);
  const evidenceById = new Map(
    evidence.map((reference) => [reference.diagnosticId, reference] as const),
  );
  if (
    rows.length !== 4 ||
    new Set(rows.map(({ robustnessId }) => robustnessId)).size !== 4 ||
    stableJson(observedContexts) !== stableJson(expectedContexts) ||
    stableJson(robustnessDiagnosticIds) !== stableJson(evidenceIds) ||
    new Set(robustnessDiagnosticIds).size !== 16 ||
    rows.some((row) => {
      const rawRows = row.diagnosticIds.map((diagnosticId) =>
        evidenceById.get(diagnosticId),
      );
      const aligned = rawRows.filter(
        (reference) => reference?.outcome === "source-order-aligned",
      ).length;
      const counterexample = rawRows.filter(
        (reference) => reference?.outcome === "source-order-counterexample",
      ).length;
      const inconclusive = rawRows.filter(
        (reference) =>
          reference?.outcome === "within-tolerance-inconclusive",
      ).length;
      const sensitivityContexts = rawRows
        .map((reference) =>
          reference == null
            ? "missing"
            : `${reference.nicoleMode}:husk-${reference.huskStacks}`,
        )
        .sort(compareText);
      const expectedClassification =
        aligned === 4
          ? "aligned-across-tested-sensitivity-grid"
          : counterexample === 4
            ? "counterexample-across-tested-sensitivity-grid"
            : "context-dependent-or-inconclusive";
      const observedOutcomeSet = [
        ...new Set(
          rawRows
            .map((reference) => reference?.outcome)
            .filter((outcome): outcome is NoelleHexereiOrdinalOutcome =>
              outcome != null,
            ),
        ),
      ].sort(compareText);
      return (
        row.diagnosticIds.length !== 4 ||
        new Set(row.diagnosticIds).size !== 4 ||
        rawRows.some((reference) => reference == null) ||
        rawRows.some(
          (reference) =>
            reference?.witnessId !== row.witnessId ||
            reference.profileId !== row.profileId ||
            reference.sourceRelationId !== row.sourceRelationId ||
            reference.circlet !== row.circlet ||
            reference.refinement !== row.refinement,
        ) ||
        stableJson(sensitivityContexts) !==
          stableJson([
            "all-theosis:husk-0",
            "all-theosis:husk-4",
            "hexerei-theosis:husk-0",
            "hexerei-theosis:husk-4",
          ]) ||
        row.higherPriorityStat !== relation.higherStat ||
        row.lowerPriorityStat !== relation.lowerStat ||
        row.sourceOrderAlignedCount !== aligned ||
        row.sourceOrderCounterexampleCount !== counterexample ||
        row.withinToleranceInconclusiveCount !== inconclusive ||
        row.classification !== expectedClassification ||
        stableJson([...row.observedOutcomeSet].sort(compareText)) !==
          stableJson(observedOutcomeSet) ||
        row.sensitivityContextCount !== 4 ||
        row.branchAverageComputed !== false ||
        row.scalarWeightComputed !== false ||
        row.supportsUniversalPriorityClaim !== false ||
        row.robustnessSha256 !==
          hashValue(omitKey(row, "robustnessSha256"))
      );
    })
  ) {
    throw new Error(
      `CP57 expected four exact CP56 robustness rows to partition ${request.requestId}/${relation.relationId}.`,
    );
  }
}

function assertExactSixteenContextGrid(
  diagnostics: readonly NoelleHexereiSourceOrderDiagnostic[],
  request: NoelleHexereiEnteredRequest,
  relation: {
    relationId: string;
    higherStat: NoelleHexereiDiagnosticProbeStat;
    lowerStat: NoelleHexereiDiagnosticProbeStat;
  },
): void {
  const expectedContexts = buildExpectedContextKeys();
  const observedContexts = diagnostics
    .map(contextKey)
    .sort(compareText);
  if (
    diagnostics.length !== 16 ||
    new Set(diagnostics.map(({ diagnosticId }) => diagnosticId)).size !== 16 ||
    stableJson(observedContexts) !== stableJson(expectedContexts) ||
    diagnostics.some(
      (diagnostic) =>
        diagnostic.higherPriorityStat !== relation.higherStat ||
        diagnostic.lowerPriorityStat !== relation.lowerStat ||
        diagnostic.sourcePriorityValidated !== false ||
        diagnostic.adjacentSourceGroupsOnly !== true ||
        hashDiagnostic(diagnostic) !== diagnostic.diagnosticSha256,
    )
  ) {
    throw new Error(
      `CP57 expected the exact 16-context diagnostic grid for ${request.requestId}/${relation.relationId}.`,
    );
  }
}

function buildEvidenceConsumptionLedger(
  references: readonly NoelleHexereiRelationDiagnosticReference[],
  upstream: readonly NoelleHexereiSourceOrderDiagnostic[],
  robustnessReferences: readonly NoelleHexereiRelationRobustnessReference[],
  upstreamRobustness: readonly NoelleHexereiContextRobustnessRow[],
): NoelleHexereiRequestConditionedCandidateAdmissionReport["evidenceConsumptionLedger"] {
  const upstreamIds = upstream.map(({ diagnosticId }) => diagnosticId).sort(compareText);
  const consumedIds = references.map(({ diagnosticId }) => diagnosticId).sort(compareText);
  const counts = new Map<string, number>();
  for (const diagnosticId of consumedIds) {
    counts.set(diagnosticId, (counts.get(diagnosticId) ?? 0) + 1);
  }
  const upstreamById = new Map(
    upstream.map((diagnostic) => [diagnostic.diagnosticId, diagnostic] as const),
  );
  if (
    upstream.length !== 288 ||
    references.length !== 288 ||
    new Set(upstreamIds).size !== 288 ||
    new Set(consumedIds).size !== 288 ||
    stableJson(upstreamIds) !== stableJson(consumedIds) ||
    [...counts.values()].some((count) => count !== 1) ||
    references.some((reference) => {
      const diagnostic = upstreamById.get(reference.diagnosticId);
      return (
        diagnostic == null ||
        reference.diagnosticSha256 !== diagnostic.diagnosticSha256 ||
        reference.evidenceReferenceSha256 !==
          hashValue(omitKey(reference, "evidenceReferenceSha256"))
      );
    })
  ) {
    throw new Error(
      "CP57 must consume every authenticated CP56 source-order diagnostic exactly once.",
    );
  }
  const upstreamRobustnessIds = upstreamRobustness
    .map(({ robustnessId }) => robustnessId)
    .sort(compareText);
  const consumedRobustnessIds = robustnessReferences
    .map(({ robustnessId }) => robustnessId)
    .sort(compareText);
  const robustnessCounts = new Map<string, number>();
  for (const robustnessId of consumedRobustnessIds) {
    robustnessCounts.set(
      robustnessId,
      (robustnessCounts.get(robustnessId) ?? 0) + 1,
    );
  }
  const upstreamRobustnessById = new Map(
    upstreamRobustness.map((row) => [row.robustnessId, row] as const),
  );
  if (
    upstreamRobustness.length !== 72 ||
    robustnessReferences.length !== 72 ||
    new Set(upstreamRobustnessIds).size !== 72 ||
    new Set(consumedRobustnessIds).size !== 72 ||
    stableJson(upstreamRobustnessIds) !== stableJson(consumedRobustnessIds) ||
    [...robustnessCounts.values()].some((count) => count !== 1) ||
    robustnessReferences.some((reference) => {
      const row = upstreamRobustnessById.get(reference.robustnessId);
      return (
        row == null ||
        reference.robustnessSha256 !== row.robustnessSha256 ||
        reference.robustnessReferenceSha256 !==
          hashValue(omitKey(reference, "robustnessReferenceSha256"))
      );
    })
  ) {
    throw new Error(
      "CP57 must consume every authenticated CP56 context-robustness row exactly once.",
    );
  }
  return {
    upstreamDiagnosticCount: 288,
    consumedDiagnosticReferenceCount: 288,
    uniqueConsumedDiagnosticCount: 288,
    unconsumedDiagnosticCount: 0,
    multiplyConsumedDiagnosticCount: 0,
    everyUpstreamDiagnosticConsumedExactlyOnce: true,
    upstreamDiagnosticIdsSha256: hashValue(upstreamIds),
    consumedDiagnosticIdsSha256: hashValue(consumedIds),
    evidenceReferencesSha256: hashValue(
      references.map(({ evidenceReferenceSha256 }) => evidenceReferenceSha256),
    ),
    upstreamRobustnessRowCount: 72,
    consumedRobustnessReferenceCount: 72,
    uniqueConsumedRobustnessRowCount: 72,
    unconsumedRobustnessRowCount: 0,
    multiplyConsumedRobustnessRowCount: 0,
    everyUpstreamRobustnessRowConsumedExactlyOnce: true,
    upstreamRobustnessIdsSha256: hashValue(upstreamRobustnessIds),
    consumedRobustnessIdsSha256: hashValue(consumedRobustnessIds),
    robustnessReferencesSha256: hashValue(
      robustnessReferences.map(
        ({ robustnessReferenceSha256 }) => robustnessReferenceSha256,
      ),
    ),
  };
}

function buildSummary(
  envelopes: readonly NoelleHexereiRequestConditionedCandidateEnvelope[],
  relations: readonly NoelleHexereiLocalRelationAdmission[],
  evidence: readonly NoelleHexereiRelationDiagnosticReference[],
): NoelleHexereiRequestConditionedCandidateAdmissionReport["summary"] {
  const admitted = relations.filter(
    ({ admissionStatus }) =>
      admissionStatus ===
      "admitted-unanimous-across-all-16-tested-contexts",
  );
  const withheldCounterexample = relations.filter(
    ({ admissionStatus }) => admissionStatus === "withheld-counterexample",
  );
  const withheldInconclusive = relations.filter(
    ({ admissionStatus }) => admissionStatus === "withheld-inconclusive",
  );
  const lowerProfileRequestCount = envelopes.filter(
    ({ candidateMatch }) =>
      candidateMatch.profileId ===
      "noelle-lower-investment-artifact-profile-v1",
  ).length;
  const highProfileRequestCount = envelopes.length - lowerProfileRequestCount;
  const allRelationsAdmittedRequestCount = envelopes.filter(
    ({ relationAdmissionSummary }) =>
      relationAdmissionSummary.aggregateStatus ===
      "all-three-local-relations-admitted",
  ).length;
  const oneOrMoreRelationsWithheldRequestCount =
    envelopes.length - allRelationsAdmittedRequestCount;
  const sourceOrderAlignedEvidenceCount = evidence.filter(
    ({ outcome }) => outcome === "source-order-aligned",
  ).length;
  const sourceOrderCounterexampleEvidenceCount = evidence.filter(
    ({ outcome }) => outcome === "source-order-counterexample",
  ).length;
  const withinToleranceInconclusiveEvidenceCount =
    evidence.length -
    sourceOrderAlignedEvidenceCount -
    sourceOrderCounterexampleEvidenceCount;
  if (
    envelopes.length !== 6 ||
    new Set(envelopes.map(({ candidateMatch }) => candidateMatch.candidateId))
      .size !== 2 ||
    lowerProfileRequestCount !== 2 ||
    highProfileRequestCount !== 4 ||
    allRelationsAdmittedRequestCount !== 2 ||
    oneOrMoreRelationsWithheldRequestCount !== 4 ||
    relations.length !== 18 ||
    admitted.length !== 12 ||
    withheldCounterexample.length !== 6 ||
    withheldInconclusive.length !== 0 ||
    admitted.flatMap(({ evidence: rows }) => rows).length !== 192 ||
    withheldCounterexample.flatMap(({ evidence: rows }) => rows).length !== 96 ||
    sourceOrderAlignedEvidenceCount !== 242 ||
    sourceOrderCounterexampleEvidenceCount !== 46 ||
    withinToleranceInconclusiveEvidenceCount !== 0
  ) {
    throw new Error("CP57 request-conditioned admission census drifted.");
  }
  return {
    enteredRequestCount: 6,
    requestConditionedEnvelopeCount: 6,
    uniqueMatchedCandidateCount: 2,
    lowerProfileRequestCount: 2,
    highProfileRequestCount: 4,
    allRelationsAdmittedRequestCount: 2,
    oneOrMoreRelationsWithheldRequestCount: 4,
    relationAdmissionCount: 18,
    admittedRelationCount: 12,
    withheldCounterexampleRelationCount: 6,
    withheldInconclusiveRelationCount: 0,
    admittedRelationEvidenceCount: 192,
    withheldRelationEvidenceCount: 96,
    sourceOrderAlignedEvidenceCount: 242,
    sourceOrderCounterexampleEvidenceCount: 46,
    withinToleranceInconclusiveEvidenceCount: 0,
    sourceSelectionCount: 0,
    rankingCount: 0,
    scalarWeightCount: 0,
    idealStatAllocationCount: 0,
    optimizerRunCount: 0,
    autoTuneRunCount: 0,
    damageComputationCount: 0,
    rotationReplayCount: 0,
    teamTotalDamageComputationCount: 0,
    energyRecoveryComputationCount: 0,
  };
}

function assertEnvelopeCardinality(
  envelopes: readonly NoelleHexereiRequestConditionedCandidateEnvelope[],
  candidateCatalog: readonly NoelleHexereiPartialEquipmentValidationCandidate[],
): void {
  if (
    envelopes.length !== 6 ||
    new Set(envelopes.map(({ envelopeId }) => envelopeId)).size !== 6 ||
    new Set(envelopes.map(({ envelopeSha256 }) => envelopeSha256)).size !== 6 ||
    envelopes.some((envelope) => {
      const catalogMatches = candidateCatalog.filter(
        (candidate) =>
          candidate.candidateId === envelope.candidateMatch.candidateId &&
          candidate.candidateSha256 === envelope.candidateMatch.candidateSha256,
      );
      return (
        envelope.envelopeSha256 !==
          hashValue(omitKey(envelope, "envelopeSha256")) ||
        catalogMatches.length !== 1 ||
        stableJson(envelope.partialCandidate) !== stableJson(catalogMatches[0]) ||
        envelope.partialCandidate.artifactProfile.profileId !==
          envelope.candidateMatch.profileId
      );
    })
  ) {
    throw new Error("CP57 request-conditioned envelope identity drifted.");
  }
}

function assertUpstreamSemanticBoundaries(
  cp53Report: NoelleHexereiPartialEquipmentCompositionReport,
  cp56Report: NoelleHexereiLocalStatPriorityDiagnosticReport,
): void {
  const cp53CandidateIds = cp53Report.candidates
    .map(({ candidateId }) => candidateId)
    .sort(compareText);
  if (
    cp53Report.reportType !==
      "noelle-hexerei-partial-equipment-composition" ||
    cp53Report.summary.candidateCount !== 2 ||
    cp53Report.summary.selectionCount !== 0 ||
    cp53Report.summary.completeBuildCount !== 0 ||
    cp53Report.summary.energyRecoveryComputationCount !== 0 ||
    stableJson(cp53CandidateIds) !==
      stableJson([
        "noelle-high-investment-artifact-profile-v1:gest-exact-hexerei-team",
        "noelle-lower-investment-artifact-profile-v1:gest-exact-hexerei-team",
      ]) ||
    cp53Report.candidates.some(
      (candidate) =>
        candidate.artifactProfile.sourceReviewStatus !== "unreviewed" ||
        candidate.selections.selectedWeapon !== null ||
        candidate.selections.selectedArtifactSet !== null ||
        candidate.selections.selectedMainStats.sands !== null ||
        candidate.selections.selectedMainStats.goblet !== null ||
        candidate.selections.selectedMainStats.circlet !== null ||
        candidate.selections.selectedSubstatAllocation !== null,
    )
  ) {
    throw new Error("CP57 CP53 partial-candidate semantic boundary drifted.");
  }
  if (
    cp56Report.reportType !==
      "noelle-hexerei-local-stat-priority-diagnostic" ||
    cp56Report.sourceOrderDiagnostics.length !== 288 ||
    cp56Report.contextRobustnessRows.length !== 72 ||
    cp56Report.operationSummary.sourceOrderDiagnosticCount !== 288 ||
    cp56Report.operationSummary.contextRobustnessRowCount !== 72 ||
    cp56Report.operationSummary.selectedStatCount !== 0 ||
    cp56Report.operationSummary.optimizerRunCount !== 0 ||
    cp56Report.operationSummary.energyRecoveryComputationCount !== 0 ||
    cp56Report.sourceSubstatPriorityValidated !== false ||
    cp56Report.sourceOrderDiagnostics.some(
      (diagnostic) => diagnostic.sourcePriorityValidated !== false,
    )
  ) {
    throw new Error("CP57 CP56 local-diagnostic semantic boundary drifted.");
  }
}

function assertCandidateIdentity(
  candidate: NoelleHexereiPartialEquipmentValidationCandidate,
): void {
  if (
    hashValue(omitKey(candidate, "candidateSha256")) !==
      candidate.candidateSha256 ||
    candidate.status !== "request-parameterized-partial-validation-candidate" ||
    candidate.completeness.completeBuild !== false ||
    candidate.weaponOption.refinementStatus !== "missing-not-zero" ||
    candidate.weaponOption.quantitativePerformanceStatus !== "missing-not-zero"
  ) {
    throw new Error(`CP57 CP53 candidate identity drifted at ${candidate.candidateId}.`);
  }
}

function evaluateSourceRequestPredicate(
  predicate: NoelleHexereiSourceRequestPredicate,
  request: NoelleHexereiEnteredRequest,
): boolean {
  const results = predicate.predicates.map((clause) => {
    switch (clause.type) {
      case "constellation-at-most":
        return request.constellation <= clause.threshold;
      case "constellation-at-least":
        return request.constellation >= clause.threshold;
      case "talent-level-is":
        return request.enteredTalentLevels.burst === clause.threshold;
      case "talent-level-at-least":
        return request.enteredTalentLevels.burst >= clause.threshold;
      default:
        return assertNever(clause);
    }
  });
  return predicate.type === "all"
    ? results.every(Boolean)
    : results.some(Boolean);
}

function requireExactSourceRequestPredicate(
  candidate: NoelleHexereiPartialEquipmentValidationCandidate,
): NoelleHexereiSourceRequestPredicate {
  const raw = candidate.artifactProfile.branch.requestPredicate;
  const expected =
    candidate.artifactProfile.profileId ===
    "noelle-lower-investment-artifact-profile-v1"
      ? LOWER_SOURCE_REQUEST_PREDICATE
      : candidate.artifactProfile.profileId ===
          "noelle-high-investment-artifact-profile-v1"
        ? HIGH_SOURCE_REQUEST_PREDICATE
        : null;
  if (expected == null || stableJson(raw) !== stableJson(expected)) {
    throw new Error(
      `CP57 source request-predicate AST drifted for ${candidate.candidateId}.`,
    );
  }
  return structuredClone(raw) as unknown as NoelleHexereiSourceRequestPredicate;
}

function requireProfileId(
  candidate: NoelleHexereiPartialEquipmentValidationCandidate,
): NoelleHexereiDiagnosticProfileId {
  const profileId = candidate.artifactProfile.profileId;
  if (
    profileId !== "noelle-lower-investment-artifact-profile-v1" &&
    profileId !== "noelle-high-investment-artifact-profile-v1"
  ) {
    throw new Error(`CP57 candidate profile drifted at ${candidate.candidateId}.`);
  }
  return profileId;
}

function assertSupportedEnteredRequest(
  request: NoelleHexereiEnteredRequest,
): void {
  const matches = REQUESTS.filter(
    (supported) => stableJson(supported) === stableJson(request),
  );
  if (matches.length !== 1) {
    throw new Error("CP57 entered request is outside the exact six-request domain.");
  }
}

function assertExactTechnicalRequest(request: TechnicalRequest): void {
  if (
    stableJson(request) !==
    stableJson(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
    )
  ) {
    throw new Error("CP57 technical request drifted from its exact declared domain.");
  }
}

function authenticateOuterInputs(
  input: NoelleHexereiRequestConditionedCandidateAdmissionInput,
): AuthenticatedOuterInputs {
  if (
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS.length !==
      EXPECTED_INPUT_PATH_COUNT ||
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS.length !==
      EXPECTED_RUNTIME_INPUT_PATH_COUNT ||
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS.some(
      (runtimePath) =>
        !NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS.includes(
          runtimePath,
        ),
    ) ||
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS.filter(
      (sourcePath) => sourcePath.endsWith(".json"),
    ).length !== EXPECTED_JSON_INPUT_COUNT ||
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS.filter(
      (runtimePath) => runtimePath.endsWith(".json.gz"),
    ).length !== EXPECTED_BINARY_RUNTIME_INPUT_COUNT
  ) {
    throw new Error("CP57 declared closure cardinality drifted.");
  }
  const expectedPaths = [
    ...NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
  ];
  const sourcePaths = input.sourceFiles
    .map(({ path: sourcePath }) => sourcePath)
    .sort(compareText);
  const generatedPaths = input.generatedFrom
    .map(({ path: sourcePath }) => sourcePath)
    .sort(compareText);
  if (
    input.sourceFiles.length !== expectedPaths.length ||
    input.generatedFrom.length !== expectedPaths.length ||
    new Set(sourcePaths).size !== sourcePaths.length ||
    new Set(generatedPaths).size !== generatedPaths.length ||
    stableJson(sourcePaths) !== stableJson(expectedPaths) ||
    stableJson(generatedPaths) !== stableJson(expectedPaths)
  ) {
    throw new Error("CP57 exact outer source/generatedFrom path closure drifted.");
  }
  const sourceBytesByPath = new Map<string, Buffer>();
  for (const { path: sourcePath, bytesBase64 } of input.sourceFiles) {
    if (!bytesBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(bytesBase64)) {
      throw new Error(`CP57 source bytes are not canonical base64 at ${sourcePath}.`);
    }
    const bytes = Buffer.from(bytesBase64, "base64");
    if (bytes.length === 0 || bytes.toString("base64") !== bytesBase64) {
      throw new Error(`CP57 source bytes failed base64 round-trip at ${sourcePath}.`);
    }
    let workspaceBytes: Buffer;
    try {
      workspaceBytes = readFileSync(path.join(REPOSITORY_ROOT, sourcePath));
    } catch {
      throw new Error(`CP57 workspace source file is unreadable at ${sourcePath}.`);
    }
    if (!bytes.equals(workspaceBytes)) {
      throw new Error(
        `CP57 supplied source bytes do not match the workspace file at ${sourcePath}.`,
      );
    }
    sourceBytesByPath.set(sourcePath, bytes);
  }
  const generatedByPath = new Map(
    input.generatedFrom.map((entry) => [entry.path, entry.sha256] as const),
  );
  for (const sourcePath of expectedPaths) {
    const declaredSha256 = generatedByPath.get(sourcePath);
    if (
      declaredSha256 == null ||
      !/^[a-f0-9]{64}$/.test(declaredSha256) ||
      declaredSha256 !==
        sha256Bytes(requiredSourceBytes(sourceBytesByPath, sourcePath))
    ) {
      throw new Error(`CP57 source/hash authentication drifted at ${sourcePath}.`);
    }
  }
  const cp53Report = parseJsonReport<NoelleHexereiPartialEquipmentCompositionReport>(
    sourceBytesByPath,
    NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH,
    "CP53",
  );
  const cp56Report = parseJsonReport<NoelleHexereiLocalStatPriorityDiagnosticReport>(
    sourceBytesByPath,
    NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH,
    "CP56",
  );
  if (stableJson(cp53Report) !== stableJson(input.cp53ReportInput)) {
    throw new Error(
      "CP57 CP53 durable report bytes disagree with the supplied parsed object.",
    );
  }
  if (stableJson(cp56Report) !== stableJson(input.cp56ReportInput)) {
    throw new Error(
      "CP57 CP56 durable report bytes disagree with the supplied parsed object.",
    );
  }
  return {
    sourceBytesByPath,
    generatedFrom: input.generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    cp53Report,
    cp56Report,
  };
}

function assertExactNestedInputProjection(
  raw: AuthenticatedOuterInputs,
  input: NoelleHexereiRequestConditionedCandidateAdmissionInput,
): void {
  const generatedByPath = new Map(
    raw.generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  const expectedCp53Sources = NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS.map(
    (sourcePath) => ({
      path: sourcePath,
      text: requiredSourceBytes(raw.sourceBytesByPath, sourcePath).toString(
        "utf8",
      ),
    }),
  );
  const expectedCp53Generated =
    NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS.map(
      (sourcePath) => requiredGeneratedFrom(generatedByPath, sourcePath),
    );
  if (
    stableJson(input.cp53Input.sourceFiles) !== stableJson(expectedCp53Sources) ||
    stableJson(input.cp53Input.generatedFrom) !==
      stableJson(expectedCp53Generated)
  ) {
    throw new Error(
      "CP57 CP53 input is not the exact projection of the outer authenticated byte closure.",
    );
  }
  const expectedCp56Sources =
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS.map(
      (sourcePath) => ({
        path: sourcePath,
        bytesBase64: requiredSourceBytes(
          raw.sourceBytesByPath,
          sourcePath,
        ).toString("base64"),
      }),
    );
  const expectedCp56Generated =
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS.map(
      (sourcePath) => requiredGeneratedFrom(generatedByPath, sourcePath),
    );
  if (
    stableJson(input.cp56Input.sourceFiles) !== stableJson(expectedCp56Sources) ||
    stableJson(input.cp56Input.generatedFrom) !==
      stableJson(expectedCp56Generated)
  ) {
    throw new Error(
      "CP57 CP56 input is not the exact projection of the outer authenticated byte closure.",
    );
  }
}

function parseJsonReport<T>(
  sourceBytesByPath: ReadonlyMap<string, Buffer>,
  sourcePath: string,
  label: string,
): T {
  try {
    return JSON.parse(
      requiredSourceBytes(sourceBytesByPath, sourcePath).toString("utf8"),
    ) as T;
  } catch {
    throw new Error(`CP57 ${label} durable report bytes are not valid JSON.`);
  }
}

function requiredGeneratedFrom(
  generatedByPath: ReadonlyMap<string, GeneratedFromEntry>,
  sourcePath: string,
): GeneratedFromEntry {
  const entry = generatedByPath.get(sourcePath);
  if (!entry) throw new Error(`CP57 missing generatedFrom entry ${sourcePath}.`);
  return { ...entry };
}

function buildExpectedContextKeys(): string[] {
  const keys: string[] = [];
  for (const circlet of ["cr", "cd"] as const) {
    for (const refinement of [1, 5] as const) {
      for (const nicoleMode of [
        "all-theosis",
        "hexerei-theosis",
      ] as const) {
        for (const huskStacks of [4, 0] as const) {
          keys.push(`${circlet}:r${refinement}:${nicoleMode}:husk-${huskStacks}`);
        }
      }
    }
  }
  return keys.sort(compareText);
}

function contextKey(diagnostic: NoelleHexereiSourceOrderDiagnostic): string {
  return `${diagnostic.circlet}:r${diagnostic.refinement}:${diagnostic.nicoleMode}:husk-${diagnostic.huskStacks}`;
}

function compareDiagnosticContext(
  left: NoelleHexereiSourceOrderDiagnostic,
  right: NoelleHexereiSourceOrderDiagnostic,
): number {
  return compareText(contextKey(left), contextKey(right));
}

function compareRobustnessContext(
  left: NoelleHexereiContextRobustnessRow,
  right: NoelleHexereiContextRobustnessRow,
): number {
  return compareText(
    `${left.circlet}:r${left.refinement}`,
    `${right.circlet}:r${right.refinement}`,
  );
}

function hashDiagnostic(
  diagnostic: NoelleHexereiSourceOrderDiagnostic,
): string {
  return hashValue(omitKey(diagnostic, "diagnosticSha256"));
}

function requiredSourceBytes(
  sourceBytesByPath: ReadonlyMap<string, Buffer>,
  sourcePath: string,
): Buffer {
  const bytes = sourceBytesByPath.get(sourcePath);
  if (!bytes) throw new Error(`CP57 missing source bytes ${sourcePath}.`);
  return bytes;
}

function omitKey<T extends object, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function sha256Bytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertNever(value: never): never {
  throw new Error(`CP57 encountered an unsupported predicate ${stableJson(value)}`);
}
