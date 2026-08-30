import path from "node:path";
import type { ArtifactRatingModelSnapshot } from "./artifactRatingModel";
import {
  ARTIFACT_RATING_DB_COMMIT,
  ARTIFACT_RATING_DB_KEQING_MODEL_SHA256,
  ARTIFACT_RATING_DB_KEQING_SOURCE_RECORD_ID,
} from "./artifactRatingModel";
import { sha256Text, stableJson } from "./io";
import type { KeqingIneffaTeamStatMarginalDiagnosticReport } from "./keqingIneffaTeamStatMarginalDiagnostic";
import {
  KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID,
  KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_ID,
} from "./keqingIneffaTeamStatMarginalDiagnostic";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "./paths";
import type {
  KnowledgeRecord,
  KnowledgeRepository,
  ManualObservationSnapshot,
} from "./schemas";
import type {
  TeamStatMarginalCrossEndpointStatObservation,
  TeamStatMarginalNonErStat,
} from "./teamStatMarginalDiagnostic";

export const KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_ID =
  "artifact-rating-db-kqm-keqing-four-endpoint-local-marginal-v1";
export const KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-artifact-rating-kqm-marginal-validation-slice.json";
export const KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_REPORT_PATH = path.join(
  REPOSITORY_ROOT,
  KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_REPORT_RELATIVE_PATH,
);

export const KEQING_ARTIFACT_RATING_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/artifact-rating-db-keqing.json";
export const KEQING_ARTIFACT_RATING_KNOWLEDGE_REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
export const KEQING_ARTIFACT_RATING_MARGINAL_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-team-stat-marginal-diagnostic.json";
export const KEQING_ARTIFACT_RATING_KQM_RAW_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json";
export const KEQING_ARTIFACT_RATING_KQM_EQUIPMENT_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json";

export const KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_INPUT_PATHS = [
  KEQING_ARTIFACT_RATING_SNAPSHOT_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_MARGINAL_REPORT_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_KQM_RAW_SNAPSHOT_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_KQM_EQUIPMENT_REPORT_RELATIVE_PATH,
] as const;

const EXPECTED_INPUT_FILE_SHA256 = {
  [KEQING_ARTIFACT_RATING_SNAPSHOT_RELATIVE_PATH]:
    "8453fcda562155d0f0398e8a0fcc7d9ee4544cb31e2be0a43959d7a7eb976d2e",
  [KEQING_ARTIFACT_RATING_KNOWLEDGE_REPOSITORY_RELATIVE_PATH]:
    "66179b2cfea81c74cc233a73ed25df6697984f6ebf04289df2cce67fbefd08c8",
  [KEQING_ARTIFACT_RATING_MARGINAL_REPORT_RELATIVE_PATH]:
    "812d80a183c3e43ac601bd6b0e4c7aab7fade43fab71dd4564182b82e3ddf2f5",
  [KEQING_ARTIFACT_RATING_KQM_RAW_SNAPSHOT_RELATIVE_PATH]:
    "da42e500bbd68a68dbbefc7ee77d69ab107956016226002c7df445f8b3056087",
  [KEQING_ARTIFACT_RATING_KQM_EQUIPMENT_REPORT_RELATIVE_PATH]:
    "9764c1e355e68ca92463ddd37f6ded55cf487b7eaf98b820944f0ff6a1594598",
} as const;

const EXPECTED_PARSED_PAYLOAD_SHA256 = {
  artifactRatingSnapshot:
    "45248c5799721ffab3dd2f419c4e97c9443478224632298d780cfc18590ae4c0",
  repository:
    "66179b2cfea81c74cc233a73ed25df6697984f6ebf04289df2cce67fbefd08c8",
  marginalReport:
    "812d80a183c3e43ac601bd6b0e4c7aab7fade43fab71dd4564182b82e3ddf2f5",
  kqmRawSnapshot:
    "00558796187d9c2d806c51fe100eef4cbe9918a209029243d2c57fcd1bc09480",
  kqmEquipmentReport:
    "9764c1e355e68ca92463ddd37f6ded55cf487b7eaf98b820944f0ff6a1594598",
} as const;

const EXPECTED_AUTHENTICATED_REPORT_SHA256 =
  "2c6abf38e016e8b67b5492c01cc44d6ea16c9abff6e6093d989ae2f4a2489837";

const KQM_GUIDE_ID =
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i";
const KQM_GUIDE_SOURCE_RECORD_ID =
  "keqing-lunar-charged-default-artifact-stats-luna-i";
const KQM_TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const KQM_LUNAR_CHARGED_CONDITION =
  "Keqing is used in a Lunar-Charged team.";
const KQM_CRIT_CAP_CONDITION =
  "Keqing does not overcap CRIT Rate after A4 and artifact-set bonuses.";
const EXPECTED_KQM_GUIDE_SHA256 =
  "d74cf45e5372fd3d634ebbcfc990d007e64f2c081334b3d3b0d45541d6841b2b";
const EXPECTED_KQM_RECOMMENDATION_SHA256 =
  "c099954041a609348ca055c43bc96490c763517ccdc259e412acb4386daf77ea";
const EXPECTED_KQM_TEAM_SHA256 =
  "c85223f2df43322a9794d0d3135abbc87948c136936ca423db31bf3790734f59";
const EXPECTED_KQM_RAW_RECORD_SHA256 =
  "f3e479a9fcc59d1d0bc09f03fd5cb9cd7894be2a259bb3edb331fe8555a5399b";
const EXPECTED_KQM_EQUIPMENT_SOURCE_RECORD_PROJECTION_SHA256 =
  "3878a832b1f831fecf6f80cd628111e0c6dbbaeb1133400403e267b33adf7b6d";
const EXPECTED_KQM_EQUIPMENT_TEAM_PROJECTION_SHA256 =
  "d2dca75e078cd4274cacd1185cf3813ccd446ae84fbb8b0b9d6448c27d290f52";
const EXPECTED_KQM_EQUIPMENT_MAIN_STAT_COVERAGE_SHA256 =
  "40ba4d8fac9abee7b47885b814134ba62f95f635c5ce3401fba51f4cb6f5ebc1";
const EXPECTED_KQM_EQUIPMENT_CLAIMS_PROJECTION_SHA256 =
  "8bc393483f229ed742c934b495f0a51af32fce936b0248a54cbc20048ee3e89e";

const EXPECTED_ARTIFACT_RECORD_SHA256 =
  "2b5bda43c8b408b739a5c272ff149830e0fbd1cc31eba7e039e03b20206281e1";
const EXPECTED_ARTIFACT_POLICY_SHA256 =
  "b8ae2abcca3c08320589b94659563cc0a946fd7bfa9d294943f454a798d2ebce";
const EXPECTED_ARTIFACT_CONTEXT_SHA256 =
  "cd03101cfa6f2ee74a22b8caf98cb6b6a54a07a3840297b1c0970ebc460e7790";
const EXPECTED_ARTIFACT_NORMALIZED_MODEL_SHA256 =
  "9671e817c731c3f27a3e0199f2fbec5f54362a52995ce031cf189bf82939cab9";

const EXPECTED_MARGINAL_TECHNICAL_OBJECTIVE_SHA256 =
  "74efe95a9e7fcc56e6c52baebb53e278f5f22d00feba6f6eb9a730184f345fd1";
const EXPECTED_MARGINAL_READINESS_SHA256 =
  "bfb9014767025fc07804d6beab6806adc4b318d84d3ac0602fd7fc9d4d08d311";
const EXPECTED_MARGINAL_CAPTURE_DOMAIN_SHA256 =
  "42af4cd3307b268e1224a62ec9237d138190bac5d47ed915cc978185976a2ca6";
const EXPECTED_KEQING_MARGINAL_STATS_SHA256 =
  "488eb599ef10f893c5aa740fc567bbb0b6a1478b6e7fca924c4764068cfb569b";
const EXPECTED_EMBEDDED_TECHNICAL_OBJECTIVE_SHA256 =
  "80feca2a09d7b3b5df8bcd21a674fa80eba664b7a5ae28b4e189d2b74df5667e";

const EXPECTED_SOURCE_POLICY = {
  status: "planned",
  permission: "mixed",
  integration: "isolated-pilot-only",
  consolidation: "blocked-pending-permission-review",
} as const;

const EXPECTED_SOURCE_CONTEXT = {
  team: "unknown",
  roleVariant: "unknown",
  weapon: "unknown",
  constellation: "unknown",
  scenario: "unknown",
} as const;

const EXPECTED_ENDPOINTS = [
  { carryCharacterId: "keqing", endpointId: "carry-keqing" },
  { carryCharacterId: "ineffa", endpointId: "carry-ineffa" },
  { carryCharacterId: "furina", endpointId: "carry-furina" },
  { carryCharacterId: "xilonen", endpointId: "carry-xilonen" },
] as const;

const EXPECTED_MARGINAL_STAT_DOMAIN: TeamStatMarginalNonErStat[] = [
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "em",
  "atk",
  "hp",
  "def",
];

const EXPECTED_BLOCKER_CODES = [
  "translation-unreviewed",
  "partial-token-mapping",
  "unresolved-formula-mapping",
  "unresolved-formula-mapping",
  "unresolved-formula-mapping",
  "unresolved-formula-mapping",
  "unresolved-formula-mapping",
  "unresolved-source-token",
] as const;

type KnowledgeCharacterGuide = Extract<
  KnowledgeRecord,
  { kind: "character_guide" }
>;
type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;
type ManualCharacterGuide = Extract<
  ManualObservationSnapshot["records"][number],
  { kind: "character_guide" }
>;
type GuideRecommendation = NonNullable<
  KnowledgeCharacterGuide["recommendations"]
>[number];

type ComparedStat = TeamStatMarginalNonErStat | "electro%";
type RowClassification =
  | "source-nonzero-and-local-all-positive"
  | "source-zero-and-local-all-zero"
  | "objective-coverage-mismatch"
  | "source-main-only-no-local-marginal";

type SourceCoefficientEvidence = {
  sourceLocation: string;
  rawStatKey: string;
  coefficient: number;
  coefficientClass: "positive" | "zero";
  handling: "heuristic-evidence";
};

export type KeqingArtifactRatingKqmMarginalValidationRow = {
  statId: ComparedStat;
  rowClassification: RowClassification;
  rowOrdering: "wrapper-authored-stable-enumeration-not-rank";
  artifactRatingDb: SourceCoefficientEvidence & {
    variableMainStatSlots: Array<"sands" | "goblet" | "circlet">;
  };
  kqmPresence: {
    mainStatSlots: Array<"sands" | "goblet" | "circlet">;
    listedAsSubstat: boolean;
  };
  localMarginal:
    | ({ status: "observed-in-nine-stat-domain" } & Pick<
        TeamStatMarginalCrossEndpointStatObservation,
        | "endpointCount"
        | "signClassification"
        | "zeroClassification"
        | "positiveEndpointIds"
        | "zeroEndpointIds"
        | "negativeEndpointIds"
      >)
    | {
        status: "not-in-nine-stat-marginal-domain";
        reason: "elemental-damage-main-stat-not-perturbed";
      };
  coefficientMagnitudeComparedToLocalMarginal: false;
  kqmPriorityOrderingComparedOrSorted: false;
  contextsClaimedComparable: false;
};

export type KeqingArtifactRatingKqmMarginalValidationIssue = {
  code: string;
  message: string;
};

export type HashedGuideFactoryInput = {
  path: string;
  sha256: string;
};

export type BuildKeqingArtifactRatingKqmMarginalValidationSliceInput = {
  artifactRatingSnapshot: ArtifactRatingModelSnapshot;
  repository: KnowledgeRepository;
  marginalReport: KeqingIneffaTeamStatMarginalDiagnosticReport;
  kqmRawSnapshot: ManualObservationSnapshot;
  kqmEquipmentReport: KeqingLunarEquipmentEvidenceValidationReport;
  inputFiles: HashedGuideFactoryInput[];
};

type DeferredEnergyOccurrence = {
  rawPath: string;
  normalizedPath: string;
  rawCoefficient: number;
  normalizedCoefficient: number | null;
  statId: string | null;
  handling: string | null;
};

export type KeqingArtifactRatingKqmMarginalValidationSliceReport = {
  schemaVersion: 1;
  classification: "keqing-artifact-rating-kqm-local-marginal-isolated-validation-slice";
  sliceId: typeof KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_ID;
  validationStatus: "authenticated-isolated-observation" | "not-authenticated";
  issues: KeqingArtifactRatingKqmMarginalValidationIssue[];
  supportsGuideClaims: false;
  supportsBuildRecommendations: false;
  supportsMainStatRecommendations: false;
  supportsSubstatRecommendations: false;
  supportsStatPriorityClaims: false;
  supportsScalarStatWeights: false;
  supportsIdealStatAllocation: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsContextApplicabilityClaims: false;
  supportsEnergyRequirements: false;
  promotionEligible: false;
  rankingProduced: false;
  guideProduced: false;
  statWeightsProduced: false;
  energyRequirementsProduced: false;
  energyRecoveryInputsUsed: false;
  candidateGenerationExecuted: false;
  optimizationExecuted: false;
  generatedFrom: HashedGuideFactoryInput[];
  inputBoundary: {
    expectedFileCount: 5;
    observedFileCount: number;
    exactPathSet: boolean;
    files: Array<{
      path: string;
      expectedSha256: string;
      observedSha256: string | null;
      occurrenceCount: number;
      matches: boolean;
    }>;
    parsedPayloadSha256: {
      artifactRatingSnapshot: string;
      repository: string;
      marginalReport: string;
      kqmRawSnapshot: string;
      kqmEquipmentReport: string;
    };
    expectedParsedPayloadSha256: typeof EXPECTED_PARSED_PAYLOAD_SHA256;
    parsedPayloadsMatch: boolean;
    authentication: "accepted" | "rejected";
  };
  artifactRatingDbBoundary: {
    authentication: "accepted" | "rejected";
    sourceId: string;
    sourceCommit: string;
    sourceRecordId: string | null;
    characterId: string | null;
    recordOccurrenceCount: number;
    recordSha256: string | null;
    expectedRecordSha256: typeof EXPECTED_ARTIFACT_RECORD_SHA256;
    rawModelSha256: string | null;
    recomputedRawModelSha256: string | null;
    expectedRawModelSha256: typeof ARTIFACT_RATING_DB_KEQING_MODEL_SHA256;
    normalizedModelSha256: string | null;
    expectedNormalizedModelSha256: typeof EXPECTED_ARTIFACT_NORMALIZED_MODEL_SHA256;
    sourcePolicy: ArtifactRatingModelSnapshot["sourcePolicy"];
    sourcePolicySha256: string;
    expectedSourcePolicySha256: typeof EXPECTED_ARTIFACT_POLICY_SHA256;
    sourcePolicyMatchesExactly: boolean;
    sourceContext: ArtifactRatingModelSnapshot["records"][number]["context"] | null;
    sourceContextSha256: string | null;
    expectedSourceContextSha256: typeof EXPECTED_ARTIFACT_CONTEXT_SHA256;
    sourceContextMatchesExactly: boolean;
    crossSourceContextComparability: "not-established";
    coefficientMeaning: "source-native-heuristic-only";
    deferredEnergyEvidence: {
      classification: "retained-source-evidence-no-er-computation";
      expectedOccurrenceCount: 2;
      observedOccurrenceCount: number;
      observedRawOccurrenceCount: number;
      observedNormalizedOccurrenceCount: number;
      occurrences: DeferredEnergyOccurrence[];
      exactOccurrenceClosure: boolean;
    };
  };
  kqmBoundary: {
    authentication: "accepted" | "rejected";
    rawSourceBoundary: {
      authentication: "accepted" | "rejected";
      sourceId: string;
      capturedAt: string;
      pageUrl: string;
      sourceVersion: string | null;
      snapshotRecordCount: number;
      defaultRecordOccurrenceCount: number;
      defaultRecordSha256: string | null;
      expectedDefaultRecordSha256: typeof EXPECTED_KQM_RAW_RECORD_SHA256;
      recommendationParityWithRepository: "exact" | "drifted";
    };
    equipmentEvidenceBoundary: {
      authentication: "accepted" | "rejected";
      validationStatus: string;
      sourceRecordProjectionSha256: string | null;
      expectedSourceRecordProjectionSha256: typeof EXPECTED_KQM_EQUIPMENT_SOURCE_RECORD_PROJECTION_SHA256;
      exactTeamProjectionSha256: string | null;
      expectedExactTeamProjectionSha256: typeof EXPECTED_KQM_EQUIPMENT_TEAM_PROJECTION_SHA256;
      mainStatCoverageSha256: string;
      expectedMainStatCoverageSha256: typeof EXPECTED_KQM_EQUIPMENT_MAIN_STAT_COVERAGE_SHA256;
      defaultClaimProjectionSha256: string;
      expectedDefaultClaimProjectionSha256: typeof EXPECTED_KQM_EQUIPMENT_CLAIMS_PROJECTION_SHA256;
      defaultClaimCount: number;
      exactTeamMatchedClaimCount: number;
      exactTeamUnresolvedClaimCount: number;
      capabilityBoundary: {
        supportsGuideClaims: false;
        supportsEquipmentRecommendations: false;
        supportsStatRecommendations: false;
        supportsRankClaims: false;
        supportsConditionApplicabilityClaims: false;
        supportsDamageClaims: false;
        supportsEnergyRecoveryClaims: false;
        candidateGenerationInput: false;
        candidateGenerationExecuted: false;
        damageOrRankingComputationExecuted: false;
        energyRecoveryInputsUsed: false;
      };
    };
    guideRecordId: typeof KQM_GUIDE_ID;
    sourceRecordId: typeof KQM_GUIDE_SOURCE_RECORD_ID;
    guideRecordOccurrenceCount: number;
    guideRecordSha256: string | null;
    expectedGuideRecordSha256: typeof EXPECTED_KQM_GUIDE_SHA256;
    recommendationSha256: string | null;
    expectedRecommendationSha256: typeof EXPECTED_KQM_RECOMMENDATION_SHA256;
    guideState: string | null;
    sourcePromotionEligible: false;
    teamRecordId: typeof KQM_TEAM_ID;
    teamRecordOccurrenceCount: number;
    teamRecordSha256: string | null;
    expectedTeamRecordSha256: typeof EXPECTED_KQM_TEAM_SHA256;
    exactRoster: string[];
    declaredReactions: string[];
    conditionResolution: {
      sourceCondition: typeof KQM_LUNAR_CHARGED_CONDITION;
      occurrenceCount: number;
      exactTeamFacts: {
        containsKeqing: boolean;
        declaresLunarCharged: boolean;
      };
      resolution:
        | "matched-by-exact-team-facts"
        | "not-matched-by-exact-team-facts";
      secondaryCondition: typeof KQM_CRIT_CAP_CONDITION;
      secondaryConditionOccurrenceCount: number;
      secondaryConditionResolution: "withheld-unresolved-source-condition";
    };
    crossRecordJoin: "wrapper-owned-validation-only";
    sourceAuthoredCrossRecordJoin: false;
    comparisonPolicy: {
      comparedAxes: ["main-stat-presence", "substat-presence"];
      coefficientMagnitudeToMarginal: "not-compared";
      priorityOrdering: "not-compared-or-sorted";
      contextComparability: "not-established";
    };
  };
  marginalBoundary: {
    authentication: "accepted" | "rejected";
    diagnosticId: typeof KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_ID;
    fixedCandidateId: typeof KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID;
    sourceTeamRecordId: typeof KQM_TEAM_ID;
    comparisonStatus: string;
    endpointCount: number;
    endpoints: Array<{ carryCharacterId: string; endpointId: string }>;
    exactFourEndpointDomain: boolean;
    statCountPerCharacter: number;
    marginalStatDomain: string[];
    exactNineStatDomain: boolean;
    plannedReplayCount: number;
    observedReplayCount: number;
    reactionFormulaLineCount: number | null;
    capturedReactionFormulaLineCounts: number[];
    reactionDomain: "reaction-free" | "drifted";
    formulaLineCount: number;
    formulaBuffOverrides: null | unknown;
    readiness: {
      readyForDamageReplay: false;
      blockerCount: number;
      blockerCodes: string[];
      sha256: string;
      expectedSha256: typeof EXPECTED_MARGINAL_READINESS_SHA256;
    };
    technicalObjectiveSha256: string;
    expectedTechnicalObjectiveSha256: typeof EXPECTED_MARGINAL_TECHNICAL_OBJECTIVE_SHA256;
    embeddedTechnicalObjectiveSha256: string | null;
    expectedEmbeddedTechnicalObjectiveSha256: typeof EXPECTED_EMBEDDED_TECHNICAL_OBJECTIVE_SHA256;
    captureDomainSha256: string;
    expectedCaptureDomainSha256: typeof EXPECTED_MARGINAL_CAPTURE_DOMAIN_SHA256;
    keqingStatsSha256: string | null;
    expectedKeqingStatsSha256: typeof EXPECTED_KEQING_MARGINAL_STATS_SHA256;
    objectiveCoverage: {
      elementalMasteryReactionContributionRepresented: false;
      elementalMasteryClassification: "objective-coverage-mismatch";
      reason: string;
    };
  };
  rows: KeqingArtifactRatingKqmMarginalValidationRow[];
  summary: {
    rowCount: number;
    sourceNonzeroLocalPositiveCount: number;
    sourceZeroLocalZeroCount: number;
    objectiveCoverageMismatchCount: number;
    sourceMainOnlyCount: number;
    deferredEnergyOccurrenceCount: number;
    promotedRowCount: 0;
    rankedRowCount: 0;
    producedGuideCount: 0;
    producedStatWeightCount: 0;
    producedEnergyRequirementCount: 0;
  };
  cautions: string[];
  prohibitedInterpretations: string[];
};

type IssueCollector = (
  condition: boolean,
  code: string,
  message: string,
) => void;

/**
 * Authenticate and juxtapose three already-existing evidence boundaries. This
 * slice performs no generator, optimizer, damage, ranking, or ER work.
 */
export function buildKeqingArtifactRatingKqmMarginalValidationSliceReport(
  input: BuildKeqingArtifactRatingKqmMarginalValidationSliceInput,
): KeqingArtifactRatingKqmMarginalValidationSliceReport {
  const issues: KeqingArtifactRatingKqmMarginalValidationIssue[] = [];
  const require: IssueCollector = (condition, code, message) => {
    if (!condition) issues.push({ code, message });
  };

  const inputBoundary = buildInputBoundary(input, require);
  const artifactRatingDbBoundary = buildArtifactRatingBoundary(
    input.artifactRatingSnapshot,
    require,
  );
  const kqmBoundary = buildKqmBoundary(
    input.repository,
    input.kqmRawSnapshot,
    input.kqmEquipmentReport,
    require,
  );
  const marginalBoundary = buildMarginalBoundary(input.marginalReport, require);

  const authenticated = issues.length === 0;
  const rows = authenticated
    ? buildRows(
        input.artifactRatingSnapshot,
        input.repository,
        input.marginalReport,
      )
    : [];
  const summary = summarizeRows(
    rows,
    artifactRatingDbBoundary.deferredEnergyEvidence.observedOccurrenceCount,
  );

  return {
    schemaVersion: 1,
    classification:
      "keqing-artifact-rating-kqm-local-marginal-isolated-validation-slice",
    sliceId: KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_ID,
    validationStatus: authenticated
      ? "authenticated-isolated-observation"
      : "not-authenticated",
    issues,
    supportsGuideClaims: false,
    supportsBuildRecommendations: false,
    supportsMainStatRecommendations: false,
    supportsSubstatRecommendations: false,
    supportsStatPriorityClaims: false,
    supportsScalarStatWeights: false,
    supportsIdealStatAllocation: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsContextApplicabilityClaims: false,
    supportsEnergyRequirements: false,
    promotionEligible: false,
    rankingProduced: false,
    guideProduced: false,
    statWeightsProduced: false,
    energyRequirementsProduced: false,
    energyRecoveryInputsUsed: false,
    candidateGenerationExecuted: false,
    optimizationExecuted: false,
    generatedFrom: inputBoundary.files.flatMap(
      ({ path: inputPath, observedSha256 }) =>
        observedSha256 == null
          ? []
          : [{ path: inputPath, sha256: observedSha256 }],
    ),
    inputBoundary,
    artifactRatingDbBoundary,
    kqmBoundary,
    marginalBoundary,
    rows,
    summary,
    cautions: [
      "ArtifactRatingDB coefficients are retained as source-native heuristic evidence. Their magnitudes are never compared with local marginal magnitudes.",
      "Rows copy only local sign and zero classifications plus endpoint identities; local marginal magnitudes remain behind the authenticated input digest and are not juxtaposed with source coefficients.",
      "KQM main-stat and substat membership is compared only as presence. Source priority numbers are neither sorted nor treated as validated ordering.",
      "ArtifactRatingDB has unknown team, role, weapon, constellation, and scenario context, so this slice does not claim that its context is comparable with either the KQM team or the generated marginal endpoints.",
      "The four local marginal endpoints use an unreviewed, reaction-free technical objective with eight readiness blockers. Positive and zero signs describe only that objective at those operating points.",
      "The all-zero Elemental Mastery marginal is retained as an objective-coverage mismatch because the technical objective contains no reaction lines; it is not a disagreement with either source.",
      "Two SPRatioBase occurrences are retained as deferred source evidence. This slice performs no Energy Recharge calculation or recommendation.",
    ],
    prohibitedInterpretations: [
      "guide",
      "build-recommendation",
      "main-stat-recommendation",
      "substat-priority",
      "scalar-stat-weight",
      "coefficient-to-marginal-scale-comparison",
      "context-applicability",
      "rank",
      "promotion",
      "damage-validation",
      "optimal-allocation",
      "energy-requirement",
    ],
  };
}

export function requireAuthenticatedKeqingArtifactRatingKqmMarginalValidationSliceReport(
  report: KeqingArtifactRatingKqmMarginalValidationSliceReport,
): void {
  // This slice is a pinned, isolated observation rather than a general report
  // schema. Authenticate the complete serialized value so a caller cannot
  // mutate an evidence field after the builder has closed the five inputs and
  // still pass the write boundary. The checks below retain useful local failure
  // semantics, while this digest closes every projected field.
  const completeReportSafety =
    sha256Text(stableJson(report)) === EXPECTED_AUTHENTICATED_REPORT_SHA256;
  const expectedRowSignatures = [
    ["atk%", "source-nonzero-and-local-all-positive"],
    ["atk", "source-nonzero-and-local-all-positive"],
    ["cr", "source-nonzero-and-local-all-positive"],
    ["cd", "source-nonzero-and-local-all-positive"],
    ["def%", "source-zero-and-local-all-zero"],
    ["def", "source-zero-and-local-all-zero"],
    ["hp%", "source-zero-and-local-all-zero"],
    ["hp", "source-zero-and-local-all-zero"],
    ["em", "objective-coverage-mismatch"],
    ["electro%", "source-main-only-no-local-marginal"],
  ];
  const rowSafety =
    stableJson(
      report.rows.map(({ statId, rowClassification }) => [
        statId,
        rowClassification,
      ]),
    ) === stableJson(expectedRowSignatures) &&
    report.rows.every(
      ({
        rowOrdering,
        coefficientMagnitudeComparedToLocalMarginal,
        kqmPriorityOrderingComparedOrSorted,
        contextsClaimedComparable,
      }) =>
        rowOrdering === "wrapper-authored-stable-enumeration-not-rank" &&
        coefficientMagnitudeComparedToLocalMarginal === false &&
        kqmPriorityOrderingComparedOrSorted === false &&
        contextsClaimedComparable === false,
    );
  const summarySafety =
    report.summary.rowCount === 10 &&
    report.summary.sourceNonzeroLocalPositiveCount === 4 &&
    report.summary.sourceZeroLocalZeroCount === 4 &&
    report.summary.objectiveCoverageMismatchCount === 1 &&
    report.summary.sourceMainOnlyCount === 1 &&
    report.summary.deferredEnergyOccurrenceCount === 2 &&
    report.summary.promotedRowCount === 0 &&
    report.summary.rankedRowCount === 0 &&
    report.summary.producedGuideCount === 0 &&
    report.summary.producedStatWeightCount === 0 &&
    report.summary.producedEnergyRequirementCount === 0;
  const expectedGeneratedFrom = Object.entries(
    EXPECTED_INPUT_FILE_SHA256,
  ).map(([inputPath, sha256]) => ({ path: inputPath, sha256 }));
  const provenanceSafety =
    report.inputBoundary.exactPathSet &&
    report.inputBoundary.parsedPayloadsMatch &&
    stableJson(report.generatedFrom) === stableJson(expectedGeneratedFrom);
  const equipmentCapabilities =
    report.kqmBoundary.equipmentEvidenceBoundary.capabilityBoundary;
  const kqmEvidenceSafety =
    report.kqmBoundary.rawSourceBoundary.defaultRecordSha256 ===
      EXPECTED_KQM_RAW_RECORD_SHA256 &&
    report.kqmBoundary.rawSourceBoundary.recommendationParityWithRepository ===
      "exact" &&
    report.kqmBoundary.equipmentEvidenceBoundary
      .sourceRecordProjectionSha256 ===
      EXPECTED_KQM_EQUIPMENT_SOURCE_RECORD_PROJECTION_SHA256 &&
    report.kqmBoundary.equipmentEvidenceBoundary.exactTeamProjectionSha256 ===
      EXPECTED_KQM_EQUIPMENT_TEAM_PROJECTION_SHA256 &&
    report.kqmBoundary.equipmentEvidenceBoundary.mainStatCoverageSha256 ===
      EXPECTED_KQM_EQUIPMENT_MAIN_STAT_COVERAGE_SHA256 &&
    report.kqmBoundary.equipmentEvidenceBoundary
      .defaultClaimProjectionSha256 ===
      EXPECTED_KQM_EQUIPMENT_CLAIMS_PROJECTION_SHA256 &&
    report.kqmBoundary.equipmentEvidenceBoundary.defaultClaimCount === 8 &&
    report.kqmBoundary.equipmentEvidenceBoundary.exactTeamMatchedClaimCount ===
      7 &&
    report.kqmBoundary.equipmentEvidenceBoundary
      .exactTeamUnresolvedClaimCount === 1 &&
    !equipmentCapabilities.supportsGuideClaims &&
    !equipmentCapabilities.supportsEquipmentRecommendations &&
    !equipmentCapabilities.supportsStatRecommendations &&
    !equipmentCapabilities.supportsRankClaims &&
    !equipmentCapabilities.supportsConditionApplicabilityClaims &&
    !equipmentCapabilities.supportsDamageClaims &&
    !equipmentCapabilities.supportsEnergyRecoveryClaims &&
    !equipmentCapabilities.candidateGenerationInput &&
    !equipmentCapabilities.candidateGenerationExecuted &&
    !equipmentCapabilities.damageOrRankingComputationExecuted &&
    !equipmentCapabilities.energyRecoveryInputsUsed;
  const safe =
    completeReportSafety &&
    report.validationStatus === "authenticated-isolated-observation" &&
    report.issues.length === 0 &&
    report.inputBoundary.authentication === "accepted" &&
    report.artifactRatingDbBoundary.authentication === "accepted" &&
    report.kqmBoundary.authentication === "accepted" &&
    report.kqmBoundary.rawSourceBoundary.authentication === "accepted" &&
    report.kqmBoundary.equipmentEvidenceBoundary.authentication ===
      "accepted" &&
    report.marginalBoundary.authentication === "accepted" &&
    report.rows.length === 10 &&
    rowSafety &&
    summarySafety &&
    provenanceSafety &&
    kqmEvidenceSafety &&
    !report.supportsGuideClaims &&
    !report.supportsBuildRecommendations &&
    !report.supportsMainStatRecommendations &&
    !report.supportsSubstatRecommendations &&
    !report.supportsStatPriorityClaims &&
    !report.supportsScalarStatWeights &&
    !report.supportsIdealStatAllocation &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsContextApplicabilityClaims &&
    !report.supportsEnergyRequirements &&
    !report.promotionEligible &&
    !report.rankingProduced &&
    !report.guideProduced &&
    !report.statWeightsProduced &&
    !report.energyRequirementsProduced &&
    !report.energyRecoveryInputsUsed &&
    !report.candidateGenerationExecuted &&
    !report.optimizationExecuted;
  if (safe) return;

  const details = report.issues
    .map(({ code, message }) => `${code}: ${message}`)
    .join("; ");
  throw new Error(
    `Refusing to write an unauthenticated or interpretively unsafe Keqing isolated validation slice${
      details.length > 0 ? `: ${details}` : "."
    }`,
  );
}

function buildInputBoundary(
  input: BuildKeqingArtifactRatingKqmMarginalValidationSliceInput,
  require: IssueCollector,
): KeqingArtifactRatingKqmMarginalValidationSliceReport["inputBoundary"] {
  const expectedPaths = Object.keys(EXPECTED_INPUT_FILE_SHA256);
  const files = expectedPaths.map((expectedPath) => {
    const occurrences = input.inputFiles.filter(
      ({ path: observedPath }) => observedPath === expectedPath,
    );
    const observedSha256 = occurrences[0]?.sha256 ?? null;
    const expectedSha256 =
      EXPECTED_INPUT_FILE_SHA256[
        expectedPath as keyof typeof EXPECTED_INPUT_FILE_SHA256
      ];
    return {
      path: expectedPath,
      expectedSha256,
      observedSha256,
      occurrenceCount: occurrences.length,
      matches:
        occurrences.length === 1 && observedSha256 === expectedSha256,
    };
  });
  const exactPathSet =
    input.inputFiles.length === expectedPaths.length &&
    files.every(({ matches }) => matches);
  require(
    exactPathSet,
    "input.file-boundary-drift",
    "The slice requires exactly the pinned ArtifactRatingDB snapshot, knowledge repository, and marginal report file hashes.",
  );

  const parsedPayloadSha256 = {
    artifactRatingSnapshot: sha256Text(stableJson(input.artifactRatingSnapshot)),
    repository: sha256Text(stableJson(input.repository)),
    marginalReport: sha256Text(stableJson(input.marginalReport)),
    kqmRawSnapshot: sha256Text(stableJson(input.kqmRawSnapshot)),
    kqmEquipmentReport: sha256Text(stableJson(input.kqmEquipmentReport)),
  };
  const parsedPayloadsMatch =
    stableJson(parsedPayloadSha256) ===
    stableJson(EXPECTED_PARSED_PAYLOAD_SHA256);
  require(
    parsedPayloadsMatch,
    "input.parsed-payload-drift",
    "At least one parsed input no longer matches its independently pinned payload digest.",
  );

  return {
    expectedFileCount: 5,
    observedFileCount: input.inputFiles.length,
    exactPathSet,
    files,
    parsedPayloadSha256,
    expectedParsedPayloadSha256: { ...EXPECTED_PARSED_PAYLOAD_SHA256 },
    parsedPayloadsMatch,
    authentication:
      exactPathSet && parsedPayloadsMatch ? "accepted" : "rejected",
  };
}

function buildArtifactRatingBoundary(
  snapshot: ArtifactRatingModelSnapshot,
  require: IssueCollector,
): KeqingArtifactRatingKqmMarginalValidationSliceReport["artifactRatingDbBoundary"] {
  const records = snapshot.records.filter(
    ({ sourceRecordId }) =>
      sourceRecordId === ARTIFACT_RATING_DB_KEQING_SOURCE_RECORD_ID,
  );
  const record = records.length === 1 ? records[0] : null;
  const recordSha256 = record ? sha256Text(stableJson(record)) : null;
  const recomputedRawModelSha256 = record
    ? sha256Text(stableJson(record.rawModel))
    : null;
  const normalizedModelSha256 = record
    ? sha256Text(stableJson(record.normalizedModel))
    : null;
  const sourcePolicySha256 = sha256Text(stableJson(snapshot.sourcePolicy));
  const sourceContextSha256 = record
    ? sha256Text(stableJson(record.context))
    : null;
  const sourcePolicyMatchesExactly =
    stableJson(snapshot.sourcePolicy) === stableJson(EXPECTED_SOURCE_POLICY) &&
    sourcePolicySha256 === EXPECTED_ARTIFACT_POLICY_SHA256;
  const sourceContextMatchesExactly =
    record != null &&
    stableJson(record.context) === stableJson(EXPECTED_SOURCE_CONTEXT) &&
    sourceContextSha256 === EXPECTED_ARTIFACT_CONTEXT_SHA256;
  const energyOccurrences = collectDeferredEnergyOccurrences(record);
  const normalizedEnergyPaths = collectNormalizedEnergyPaths(record);
  const expectedEnergyOccurrences: DeferredEnergyOccurrence[] = [
    {
      rawPath: "records[0].rawModel.main.3.SPRatioBase",
      normalizedPath:
        "records[0].normalizedModel.main.sands.SPRatioBase",
      rawCoefficient: 0,
      normalizedCoefficient: 0,
      statId: "er",
      handling: "ignored-deferred-energy",
    },
    {
      rawPath: "records[0].rawModel.weight.SPRatioBase",
      normalizedPath:
        "records[0].normalizedModel.coefficients.SPRatioBase",
      rawCoefficient: 0,
      normalizedCoefficient: 0,
      statId: "er",
      handling: "ignored-deferred-energy",
    },
  ];
  const exactOccurrenceClosure =
    stableJson(energyOccurrences) === stableJson(expectedEnergyOccurrences) &&
    stableJson(normalizedEnergyPaths) ===
      stableJson([
        "records[0].normalizedModel.main.sands.SPRatioBase",
        "records[0].normalizedModel.coefficients.SPRatioBase",
      ]);

  const identityMatches =
    snapshot.sourceId === "artifact-rating-db" &&
    snapshot.upstream.commit === ARTIFACT_RATING_DB_COMMIT &&
    records.length === 1 &&
    record?.nativeAvatarId === "10000042" &&
    record?.characterId === "keqing";
  const recordMatches =
    recordSha256 === EXPECTED_ARTIFACT_RECORD_SHA256 &&
    record?.rawModelSha256 === ARTIFACT_RATING_DB_KEQING_MODEL_SHA256 &&
    recomputedRawModelSha256 === ARTIFACT_RATING_DB_KEQING_MODEL_SHA256 &&
    normalizedModelSha256 === EXPECTED_ARTIFACT_NORMALIZED_MODEL_SHA256;

  require(
    identityMatches,
    "artifact-rating-db.identity-drift",
    "The isolated source boundary must contain exactly the pinned Keqing avatar record at the pinned commit.",
  );
  require(
    recordMatches,
    "artifact-rating-db.record-drift",
    "The Keqing raw or normalized ArtifactRatingDB record no longer matches the pinned model payload.",
  );
  require(
    sourcePolicyMatchesExactly,
    "artifact-rating-db.policy-drift",
    "ArtifactRatingDB must remain planned, mixed-permission, isolated-only, and blocked from consolidation.",
  );
  require(
    sourceContextMatchesExactly,
    "artifact-rating-db.context-drift",
    "ArtifactRatingDB context must remain explicitly unknown on all five captured axes.",
  );
  require(
    exactOccurrenceClosure,
    "artifact-rating-db.energy-drift",
    "Exactly two SPRatioBase occurrences must remain preserved with ignored/deferred handling.",
  );

  const authentication =
    identityMatches &&
    recordMatches &&
    sourcePolicyMatchesExactly &&
    sourceContextMatchesExactly &&
    exactOccurrenceClosure
      ? "accepted"
      : "rejected";

  return {
    authentication,
    sourceId: snapshot.sourceId,
    sourceCommit: snapshot.upstream.commit,
    sourceRecordId: record?.sourceRecordId ?? null,
    characterId: record?.characterId ?? null,
    recordOccurrenceCount: records.length,
    recordSha256,
    expectedRecordSha256: EXPECTED_ARTIFACT_RECORD_SHA256,
    rawModelSha256: record?.rawModelSha256 ?? null,
    recomputedRawModelSha256,
    expectedRawModelSha256: ARTIFACT_RATING_DB_KEQING_MODEL_SHA256,
    normalizedModelSha256,
    expectedNormalizedModelSha256:
      EXPECTED_ARTIFACT_NORMALIZED_MODEL_SHA256,
    sourcePolicy: { ...snapshot.sourcePolicy },
    sourcePolicySha256,
    expectedSourcePolicySha256: EXPECTED_ARTIFACT_POLICY_SHA256,
    sourcePolicyMatchesExactly,
    sourceContext: record ? { ...record.context } : null,
    sourceContextSha256,
    expectedSourceContextSha256: EXPECTED_ARTIFACT_CONTEXT_SHA256,
    sourceContextMatchesExactly,
    crossSourceContextComparability: "not-established",
    coefficientMeaning: "source-native-heuristic-only",
    deferredEnergyEvidence: {
      classification: "retained-source-evidence-no-er-computation",
      expectedOccurrenceCount: 2,
      observedOccurrenceCount: energyOccurrences.length,
      observedRawOccurrenceCount: energyOccurrences.length,
      observedNormalizedOccurrenceCount: normalizedEnergyPaths.length,
      occurrences: energyOccurrences,
      exactOccurrenceClosure,
    },
  };
}

function buildKqmBoundary(
  repository: KnowledgeRepository,
  rawSnapshot: ManualObservationSnapshot,
  equipmentReport: KeqingLunarEquipmentEvidenceValidationReport,
  require: IssueCollector,
): KeqingArtifactRatingKqmMarginalValidationSliceReport["kqmBoundary"] {
  const guides = repository.records.filter(
    (record): record is KnowledgeCharacterGuide =>
      record.kind === "character_guide" && record.id === KQM_GUIDE_ID,
  );
  const teams = repository.records.filter(
    (record): record is KnowledgeTeam =>
      record.kind === "team" && record.id === KQM_TEAM_ID,
  );
  const guide = guides.length === 1 ? guides[0] : null;
  const team = teams.length === 1 ? teams[0] : null;
  const recommendation =
    guide?.recommendations?.length === 1 ? guide.recommendations[0] : null;
  const rawRecords = rawSnapshot.records.filter(
    (record): record is ManualCharacterGuide =>
      record.kind === "character_guide" &&
      record.sourceRecordId === KQM_GUIDE_SOURCE_RECORD_ID,
  );
  const rawRecord = rawRecords.length === 1 ? rawRecords[0] : null;
  const rawRecordSha256 = rawRecord
    ? sha256Text(stableJson(rawRecord))
    : null;
  const recommendationParityWithRepository =
    rawRecord != null &&
    recommendation != null &&
    stableJson(rawRecord.recommendation) === stableJson(recommendation)
      ? "exact"
      : "drifted";
  const rawSourceMatches =
    rawSnapshot.sourceId === "kqm" &&
    rawSnapshot.capturedAt === "2026-08-29" &&
    rawSnapshot.page.url === "https://keqingmains.com/q/keqing-quickguide/" &&
    rawSnapshot.page.sourceVersion === "Luna I" &&
    rawSnapshot.records.length === 24 &&
    rawRecords.length === 1 &&
    rawRecordSha256 === EXPECTED_KQM_RAW_RECORD_SHA256 &&
    recommendationParityWithRepository === "exact";

  const equipmentSourceRecord = equipmentReport.sourceBoundary.records.find(
    ({ sourceRecordId }) => sourceRecordId === KQM_GUIDE_SOURCE_RECORD_ID,
  );
  const equipmentTeam = equipmentReport.publishedTeamBoundary.targets.find(
    ({ teamRecordId }) => teamRecordId === KQM_TEAM_ID,
  );
  const defaultEquipmentClaims = equipmentReport.claims.filter(
    ({ sourceRecordId }) => sourceRecordId === KQM_GUIDE_SOURCE_RECORD_ID,
  );
  const equipmentClaimsProjection = defaultEquipmentClaims.map((claim) => ({
    claimId: claim.claimId,
    sourceClaim: claim.sourceClaim,
    sourceConditions: claim.sourceConditions,
    allSourceConditionsMappedExactly: claim.allSourceConditionsMappedExactly,
    teamResolution: claim.teamResolutions.find(
      ({ teamRecordId }) => teamRecordId === KQM_TEAM_ID,
    ),
  }));
  const equipmentSourceRecordProjectionSha256 = equipmentSourceRecord
    ? sha256Text(stableJson(equipmentSourceRecord))
    : null;
  const equipmentTeamProjectionSha256 = equipmentTeam
    ? sha256Text(stableJson(equipmentTeam))
    : null;
  const equipmentMainStatCoverageSha256 = sha256Text(
    stableJson(equipmentReport.baselineComparison.defaultMainStatCoverage),
  );
  const equipmentClaimsProjectionSha256 = sha256Text(
    stableJson(equipmentClaimsProjection),
  );
  const exactTeamMatchedClaimCount = equipmentClaimsProjection.filter(
    ({ teamResolution }) =>
      teamResolution?.resolution === "matched-by-exact-team-facts",
  ).length;
  const exactTeamUnresolvedClaimCount = equipmentClaimsProjection.filter(
    ({ teamResolution }) =>
      teamResolution?.resolution === "withheld-unresolved-source-condition",
  ).length;
  const equipmentCapabilitiesMatch =
    equipmentReport.supportsGuideClaims === false &&
    equipmentReport.supportsEquipmentRecommendations === false &&
    equipmentReport.supportsStatRecommendations === false &&
    equipmentReport.supportsRankClaims === false &&
    equipmentReport.supportsConditionApplicabilityClaims === false &&
    equipmentReport.supportsDamageClaims === false &&
    equipmentReport.supportsEnergyRecoveryClaims === false &&
    equipmentReport.candidateGenerationInput === false &&
    equipmentReport.candidateGenerationExecuted === false &&
    equipmentReport.damageOrRankingComputationExecuted === false &&
    equipmentReport.energyRecoveryInputsUsed === false;
  const equipmentEvidenceMatches =
    equipmentReport.validationStatus === "comparable" &&
    equipmentSourceRecordProjectionSha256 ===
      EXPECTED_KQM_EQUIPMENT_SOURCE_RECORD_PROJECTION_SHA256 &&
    equipmentTeamProjectionSha256 ===
      EXPECTED_KQM_EQUIPMENT_TEAM_PROJECTION_SHA256 &&
    equipmentMainStatCoverageSha256 ===
      EXPECTED_KQM_EQUIPMENT_MAIN_STAT_COVERAGE_SHA256 &&
    equipmentClaimsProjectionSha256 ===
      EXPECTED_KQM_EQUIPMENT_CLAIMS_PROJECTION_SHA256 &&
    defaultEquipmentClaims.length === 8 &&
    exactTeamMatchedClaimCount === 7 &&
    exactTeamUnresolvedClaimCount === 1 &&
    equipmentCapabilitiesMatch;
  const guideRecordSha256 = guide ? sha256Text(stableJson(guide)) : null;
  const recommendationSha256 = recommendation
    ? sha256Text(stableJson(recommendation))
    : null;
  const teamRecordSha256 = team ? sha256Text(stableJson(team)) : null;
  const allConditions = recommendation
    ? collectKqmConditions(recommendation)
    : [];
  const lunarConditionCount = allConditions.filter(
    (condition) => condition === KQM_LUNAR_CHARGED_CONDITION,
  ).length;
  const critCapConditionCount = allConditions.filter(
    (condition) => condition === KQM_CRIT_CAP_CONDITION,
  ).length;
  const exactRoster = team?.members.map(({ characterId }) => characterId) ?? [];
  const declaredReactions = [...(team?.reactions ?? [])];
  const containsKeqing = exactRoster.includes("keqing");
  const declaresLunarCharged = declaredReactions.includes("lunarCharged");
  const guideMatches =
    guides.length === 1 &&
    guideRecordSha256 === EXPECTED_KQM_GUIDE_SHA256 &&
    recommendationSha256 === EXPECTED_KQM_RECOMMENDATION_SHA256 &&
    guide?.characterId === "keqing" &&
    guide.status === "candidate" &&
    guide.promotionEligible === false &&
    recommendation?.id === "lunar-charged-default-artifact-stats" &&
    lunarConditionCount === 8 &&
    critCapConditionCount === 1 &&
    allConditions.length === 9;
  const teamMatches =
    teams.length === 1 &&
    teamRecordSha256 === EXPECTED_KQM_TEAM_SHA256 &&
    stableJson(exactRoster) ===
      stableJson(["keqing", "ineffa", "furina", "xilonen"]) &&
    stableJson(declaredReactions) === stableJson(["lunarCharged"]) &&
    team?.status === "candidate" &&
    team.promotionEligible === false &&
    team.members.every(
      ({ investment, selectedArtifact, selectedWeapon }) =>
        investment.status === "unspecified" &&
        selectedArtifact == null &&
        selectedWeapon == null,
    );
  const conditionsMatch =
    guideMatches && teamMatches && containsKeqing && declaresLunarCharged;

  require(
    guideMatches,
    "kqm.guide-drift",
    "The exact KQM default Lunar-Charged artifact-stat record or its condition inventory has drifted.",
  );
  require(
    teamMatches,
    "kqm.team-drift",
    "The exact KQM Keqing/Ineffa/Furina/Xilonen team facts have drifted.",
  );
  require(
    conditionsMatch,
    "kqm.condition-resolution-drift",
    "The Lunar-Charged source condition must resolve only from exact Keqing roster and declared reaction facts.",
  );
  require(
    rawSourceMatches,
    "kqm.raw-source-drift",
    "The raw KQM Luna I snapshot, default artifact-stat record, or repository parity has drifted.",
  );
  require(
    equipmentEvidenceMatches,
    "kqm.equipment-evidence-drift",
    "The authenticated Keqing equipment-evidence report no longer retains its exact disabled-capability, default-stat, exact-team, and condition-resolution projection.",
  );

  return {
    authentication:
      guideMatches &&
      teamMatches &&
      conditionsMatch &&
      rawSourceMatches &&
      equipmentEvidenceMatches
        ? "accepted"
        : "rejected",
    rawSourceBoundary: {
      authentication: rawSourceMatches ? "accepted" : "rejected",
      sourceId: rawSnapshot.sourceId,
      capturedAt: rawSnapshot.capturedAt,
      pageUrl: rawSnapshot.page.url,
      sourceVersion: rawSnapshot.page.sourceVersion ?? null,
      snapshotRecordCount: rawSnapshot.records.length,
      defaultRecordOccurrenceCount: rawRecords.length,
      defaultRecordSha256: rawRecordSha256,
      expectedDefaultRecordSha256: EXPECTED_KQM_RAW_RECORD_SHA256,
      recommendationParityWithRepository,
    },
    equipmentEvidenceBoundary: {
      authentication: equipmentEvidenceMatches ? "accepted" : "rejected",
      validationStatus: equipmentReport.validationStatus,
      sourceRecordProjectionSha256:
        equipmentSourceRecordProjectionSha256,
      expectedSourceRecordProjectionSha256:
        EXPECTED_KQM_EQUIPMENT_SOURCE_RECORD_PROJECTION_SHA256,
      exactTeamProjectionSha256: equipmentTeamProjectionSha256,
      expectedExactTeamProjectionSha256:
        EXPECTED_KQM_EQUIPMENT_TEAM_PROJECTION_SHA256,
      mainStatCoverageSha256: equipmentMainStatCoverageSha256,
      expectedMainStatCoverageSha256:
        EXPECTED_KQM_EQUIPMENT_MAIN_STAT_COVERAGE_SHA256,
      defaultClaimProjectionSha256: equipmentClaimsProjectionSha256,
      expectedDefaultClaimProjectionSha256:
        EXPECTED_KQM_EQUIPMENT_CLAIMS_PROJECTION_SHA256,
      defaultClaimCount: defaultEquipmentClaims.length,
      exactTeamMatchedClaimCount,
      exactTeamUnresolvedClaimCount,
      capabilityBoundary: {
        supportsGuideClaims: equipmentReport.supportsGuideClaims,
        supportsEquipmentRecommendations:
          equipmentReport.supportsEquipmentRecommendations,
        supportsStatRecommendations:
          equipmentReport.supportsStatRecommendations,
        supportsRankClaims: equipmentReport.supportsRankClaims,
        supportsConditionApplicabilityClaims:
          equipmentReport.supportsConditionApplicabilityClaims,
        supportsDamageClaims: equipmentReport.supportsDamageClaims,
        supportsEnergyRecoveryClaims:
          equipmentReport.supportsEnergyRecoveryClaims,
        candidateGenerationInput: equipmentReport.candidateGenerationInput,
        candidateGenerationExecuted:
          equipmentReport.candidateGenerationExecuted,
        damageOrRankingComputationExecuted:
          equipmentReport.damageOrRankingComputationExecuted,
        energyRecoveryInputsUsed: equipmentReport.energyRecoveryInputsUsed,
      },
    },
    guideRecordId: KQM_GUIDE_ID,
    sourceRecordId: KQM_GUIDE_SOURCE_RECORD_ID,
    guideRecordOccurrenceCount: guides.length,
    guideRecordSha256,
    expectedGuideRecordSha256: EXPECTED_KQM_GUIDE_SHA256,
    recommendationSha256,
    expectedRecommendationSha256: EXPECTED_KQM_RECOMMENDATION_SHA256,
    guideState: guide?.status ?? null,
    sourcePromotionEligible: false,
    teamRecordId: KQM_TEAM_ID,
    teamRecordOccurrenceCount: teams.length,
    teamRecordSha256,
    expectedTeamRecordSha256: EXPECTED_KQM_TEAM_SHA256,
    exactRoster,
    declaredReactions,
    conditionResolution: {
      sourceCondition: KQM_LUNAR_CHARGED_CONDITION,
      occurrenceCount: lunarConditionCount,
      exactTeamFacts: { containsKeqing, declaresLunarCharged },
      resolution:
        containsKeqing && declaresLunarCharged
          ? "matched-by-exact-team-facts"
          : "not-matched-by-exact-team-facts",
      secondaryCondition: KQM_CRIT_CAP_CONDITION,
      secondaryConditionOccurrenceCount: critCapConditionCount,
      secondaryConditionResolution: "withheld-unresolved-source-condition",
    },
    crossRecordJoin: "wrapper-owned-validation-only",
    sourceAuthoredCrossRecordJoin: false,
    comparisonPolicy: {
      comparedAxes: ["main-stat-presence", "substat-presence"],
      coefficientMagnitudeToMarginal: "not-compared",
      priorityOrdering: "not-compared-or-sorted",
      contextComparability: "not-established",
    },
  };
}

function buildMarginalBoundary(
  report: KeqingIneffaTeamStatMarginalDiagnosticReport,
  require: IssueCollector,
): KeqingArtifactRatingKqmMarginalValidationSliceReport["marginalBoundary"] {
  const diagnostic = report.marginalDiagnostic;
  const endpoints = report.capture.runs.map((run) => ({
    carryCharacterId: run.carryCharacterId,
    endpointId: run.endpointId,
  }));
  const exactFourEndpointDomain =
    report.capture.runs.every(({ outcome }) => outcome === "captured") &&
    stableJson(endpoints) === stableJson(EXPECTED_ENDPOINTS) &&
    report.capture.domainValidation.exactUniqueCarrySetObserved &&
    report.capture.domainValidation.exactRunCountObserved &&
    report.capture.domainValidation.exactGeneratorInvocationCountObserved &&
    report.capture.domainValidation.sequentialConcurrencyObserved;
  const marginalStatDomain =
    diagnostic?.statDomain.stats.map(({ stat }) => stat) ?? [];
  const exactNineStatDomain =
    stableJson(marginalStatDomain) ===
      stableJson(EXPECTED_MARGINAL_STAT_DOMAIN) &&
    diagnostic?.execution.statCountPerCharacter === 9 &&
    diagnostic.statDomain.energyRecoveryExcluded === true;
  const capturedReactionFormulaLineCounts =
    report.capture.domainValidation.observedReactionFormulaLineCounts.map(
      ({ count }) => count,
    );
  const objectiveLines = diagnostic?.technicalObjective.combo.lines ?? [];
  const reactionFree =
    report.technicalObjectiveProvenance.reactionLineCount === 0 &&
    capturedReactionFormulaLineCounts.length === 4 &&
    capturedReactionFormulaLineCounts.every((count) => count === 0) &&
    objectiveLines.length === 11 &&
    objectiveLines.every(({ reaction }) => reaction == null) &&
    diagnostic?.technicalObjective.formulaBuffOverrides == null &&
    diagnostic?.technicalObjective.extraBuffs.length === 0;
  const readiness = report.technicalObjectiveProvenance.readiness;
  const readinessSha256 = sha256Text(stableJson(readiness));
  const readinessMatches =
    readiness.readyForDamageReplay === false &&
    readiness.blockerCount === 8 &&
    readiness.blockers.length === 8 &&
    stableJson(readiness.blockers.map(({ code }) => code)) ===
      stableJson(EXPECTED_BLOCKER_CODES) &&
    readinessSha256 === EXPECTED_MARGINAL_READINESS_SHA256;
  const technicalObjectiveSha256 = diagnostic
    ? sha256Text(stableJson(diagnostic.technicalObjective))
    : sha256Text(stableJson(null));
  const captureDomainSha256 = sha256Text(
    stableJson(report.capture.domainValidation),
  );
  const keqingStats = diagnostic?.crossEndpointSummary?.characters.find(
    ({ characterId }) => characterId === "keqing",
  )?.stats;
  const keqingStatsSha256 = keqingStats
    ? sha256Text(stableJson(keqingStats))
    : null;
  const statOutcomesMatch =
    keqingStats != null && expectedKeqingStatOutcomesMatch(keqingStats);
  const outerSafetyMatches =
    report.supportsGuideClaims === false &&
    report.supportsStatRecommendations === false &&
    report.supportsScalarStatWeights === false &&
    report.supportsIdealStatAllocation === false &&
    report.supportsOptimalityClaims === false &&
    report.supportsEnergyRequirements === false;
  const marginalCoreMatches =
    report.comparisonStatus === "comparable" &&
    diagnostic?.comparisonStatus === "comparable" &&
    diagnostic.diagnosticId ===
      KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_ID &&
    report.fixedCandidate.candidateId ===
      KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID &&
    report.technicalObjectiveProvenance.sourceTeamRecordId === KQM_TEAM_ID &&
    report.technicalObjectiveProvenance.formulaLineCount === 11 &&
    report.technicalObjectiveProvenance.reviewStatus === "unreviewed" &&
    report.technicalObjectiveProvenance.explicitFormulaBuffOverrides == null &&
    diagnostic.execution.endpointCount === 4 &&
    diagnostic.execution.characterCountPerEndpoint === 4 &&
    diagnostic.execution.plannedReplayCount === 148 &&
    diagnostic.execution.observedReplayCount === 148 &&
    diagnostic.execution.allPlannedReplaysObserved &&
    diagnostic.execution.energyRecoveryEvaluationsUsed === false &&
    exactFourEndpointDomain &&
    exactNineStatDomain &&
    reactionFree &&
    readinessMatches &&
    technicalObjectiveSha256 ===
      EXPECTED_MARGINAL_TECHNICAL_OBJECTIVE_SHA256 &&
    diagnostic.technicalObjective.sha256 ===
      EXPECTED_EMBEDDED_TECHNICAL_OBJECTIVE_SHA256 &&
    captureDomainSha256 === EXPECTED_MARGINAL_CAPTURE_DOMAIN_SHA256 &&
    keqingStatsSha256 === EXPECTED_KEQING_MARGINAL_STATS_SHA256 &&
    statOutcomesMatch &&
    outerSafetyMatches;

  require(
    exactFourEndpointDomain,
    "marginal.endpoint-drift",
    "The marginal boundary must retain the exact four sequential carry-derived endpoints.",
  );
  require(
    exactNineStatDomain,
    "marginal.stat-domain-drift",
    "The marginal boundary must retain exactly nine non-ER perturbed stats per character.",
  );
  require(
    reactionFree,
    "marginal.objective-drift",
    "The technical objective must remain the exact reaction-free eleven-line objective with no formula buff overrides.",
  );
  require(
    readinessMatches,
    "marginal.readiness-drift",
    "The technical objective must remain unready with the exact eight authenticated blockers.",
  );
  require(
    statOutcomesMatch,
    "marginal.keqing-stat-outcome-drift",
    "Keqing must retain four all-positive, four all-zero, and one EM objective-coverage-gap marginal outcomes.",
  );
  require(
    marginalCoreMatches,
    "marginal.report-drift",
    "The marginal diagnostic no longer matches the pinned reaction-free four-endpoint technical boundary.",
  );

  return {
    authentication: marginalCoreMatches ? "accepted" : "rejected",
    diagnosticId: KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_ID,
    fixedCandidateId: KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID,
    sourceTeamRecordId: KQM_TEAM_ID,
    comparisonStatus: report.comparisonStatus,
    endpointCount: endpoints.length,
    endpoints,
    exactFourEndpointDomain,
    statCountPerCharacter: diagnostic?.execution.statCountPerCharacter ?? 0,
    marginalStatDomain,
    exactNineStatDomain,
    plannedReplayCount: diagnostic?.execution.plannedReplayCount ?? 0,
    observedReplayCount: diagnostic?.execution.observedReplayCount ?? 0,
    reactionFormulaLineCount:
      report.technicalObjectiveProvenance.reactionLineCount,
    capturedReactionFormulaLineCounts,
    reactionDomain: reactionFree ? "reaction-free" : "drifted",
    formulaLineCount: report.technicalObjectiveProvenance.formulaLineCount,
    formulaBuffOverrides:
      diagnostic?.technicalObjective.formulaBuffOverrides ?? null,
    readiness: {
      readyForDamageReplay: false,
      blockerCount: readiness.blockerCount,
      blockerCodes: readiness.blockers.map(({ code }) => code),
      sha256: readinessSha256,
      expectedSha256: EXPECTED_MARGINAL_READINESS_SHA256,
    },
    technicalObjectiveSha256,
    expectedTechnicalObjectiveSha256:
      EXPECTED_MARGINAL_TECHNICAL_OBJECTIVE_SHA256,
    embeddedTechnicalObjectiveSha256:
      diagnostic?.technicalObjective.sha256 ?? null,
    expectedEmbeddedTechnicalObjectiveSha256:
      EXPECTED_EMBEDDED_TECHNICAL_OBJECTIVE_SHA256,
    captureDomainSha256,
    expectedCaptureDomainSha256: EXPECTED_MARGINAL_CAPTURE_DOMAIN_SHA256,
    keqingStatsSha256,
    expectedKeqingStatsSha256: EXPECTED_KEQING_MARGINAL_STATS_SHA256,
    objectiveCoverage: {
      elementalMasteryReactionContributionRepresented: false,
      elementalMasteryClassification: "objective-coverage-mismatch",
      reason:
        "ArtifactRatingDB assigns a positive heuristic coefficient to Elemental Mastery while the pinned reaction-free technical objective yields an all-zero local marginal at all four endpoints.",
    },
  };
}

function buildRows(
  snapshot: ArtifactRatingModelSnapshot,
  repository: KnowledgeRepository,
  marginalReport: KeqingIneffaTeamStatMarginalDiagnosticReport,
): KeqingArtifactRatingKqmMarginalValidationRow[] {
  const record = snapshot.records.find(
    ({ sourceRecordId }) =>
      sourceRecordId === ARTIFACT_RATING_DB_KEQING_SOURCE_RECORD_ID,
  );
  const guide = repository.records.find(
    (candidate): candidate is KnowledgeCharacterGuide =>
      candidate.kind === "character_guide" && candidate.id === KQM_GUIDE_ID,
  );
  const recommendation = guide?.recommendations?.[0];
  const keqingStats =
    marginalReport.marginalDiagnostic?.crossEndpointSummary?.characters.find(
      ({ characterId }) => characterId === "keqing",
    )?.stats ?? [];
  if (!record || !recommendation) return [];

  const specs: Array<{
    statId: ComparedStat;
    rawStatKey: string;
    coefficient: number;
    sourceLocation: string;
    classification: RowClassification;
  }> = [
    {
      statId: "atk%",
      rawStatKey: "AttackAddedRatio",
      coefficient: 0.65,
      sourceLocation: "rawModel.weight.AttackAddedRatio",
      classification: "source-nonzero-and-local-all-positive",
    },
    {
      statId: "atk",
      rawStatKey: "AttackDelta",
      coefficient: 0.45,
      sourceLocation: "rawModel.weight.AttackDelta",
      classification: "source-nonzero-and-local-all-positive",
    },
    {
      statId: "cr",
      rawStatKey: "CriticalChanceBase",
      coefficient: 1,
      sourceLocation: "rawModel.weight.CriticalChanceBase",
      classification: "source-nonzero-and-local-all-positive",
    },
    {
      statId: "cd",
      rawStatKey: "CriticalDamageBase",
      coefficient: 1,
      sourceLocation: "rawModel.weight.CriticalDamageBase",
      classification: "source-nonzero-and-local-all-positive",
    },
    {
      statId: "def%",
      rawStatKey: "DefenceAddedRatio",
      coefficient: 0,
      sourceLocation: "rawModel.weight.DefenceAddedRatio",
      classification: "source-zero-and-local-all-zero",
    },
    {
      statId: "def",
      rawStatKey: "DefenceDelta",
      coefficient: 0,
      sourceLocation: "rawModel.weight.DefenceDelta",
      classification: "source-zero-and-local-all-zero",
    },
    {
      statId: "hp%",
      rawStatKey: "HPAddedRatio",
      coefficient: 0,
      sourceLocation: "rawModel.weight.HPAddedRatio",
      classification: "source-zero-and-local-all-zero",
    },
    {
      statId: "hp",
      rawStatKey: "HPDelta",
      coefficient: 0,
      sourceLocation: "rawModel.weight.HPDelta",
      classification: "source-zero-and-local-all-zero",
    },
    {
      statId: "em",
      rawStatKey: "ElementalMastery",
      coefficient: 0.85,
      sourceLocation: "rawModel.weight.ElementalMastery",
      classification: "objective-coverage-mismatch",
    },
    {
      statId: "electro%",
      rawStatKey: "ThunderAddedRatio",
      coefficient: 1,
      sourceLocation: "rawModel.main.4.ThunderAddedRatio",
      classification: "source-main-only-no-local-marginal",
    },
  ];

  return specs.map((spec) => {
    const marginal = keqingStats.find(({ stat }) => stat === spec.statId);
    const sourceCoefficient =
      spec.statId === "electro%"
        ? record.rawModel.main["4"].ThunderAddedRatio
        : record.rawModel.weight[spec.rawStatKey];
    return {
      statId: spec.statId,
      rowClassification: spec.classification,
      rowOrdering: "wrapper-authored-stable-enumeration-not-rank",
      artifactRatingDb: {
        sourceLocation: spec.sourceLocation,
        rawStatKey: spec.rawStatKey,
        coefficient: sourceCoefficient ?? spec.coefficient,
        coefficientClass: spec.coefficient === 0 ? "zero" : "positive",
        handling: "heuristic-evidence",
        variableMainStatSlots: artifactVariableMainStatSlots(
          record,
          spec.statId,
        ),
      },
      kqmPresence: kqmPresence(recommendation, spec.statId),
      localMarginal: marginal
        ? {
            status: "observed-in-nine-stat-domain",
            endpointCount: marginal.endpointCount,
            signClassification: marginal.signClassification,
            zeroClassification: marginal.zeroClassification,
            positiveEndpointIds: [...marginal.positiveEndpointIds],
            zeroEndpointIds: [...marginal.zeroEndpointIds],
            negativeEndpointIds: [...marginal.negativeEndpointIds],
          }
        : {
            status: "not-in-nine-stat-marginal-domain",
            reason: "elemental-damage-main-stat-not-perturbed",
          },
      coefficientMagnitudeComparedToLocalMarginal: false,
      kqmPriorityOrderingComparedOrSorted: false,
      contextsClaimedComparable: false,
    };
  });
}

function summarizeRows(
  rows: KeqingArtifactRatingKqmMarginalValidationRow[],
  deferredEnergyOccurrenceCount: number,
): KeqingArtifactRatingKqmMarginalValidationSliceReport["summary"] {
  return {
    rowCount: rows.length,
    sourceNonzeroLocalPositiveCount: rows.filter(
      ({ rowClassification }) =>
        rowClassification === "source-nonzero-and-local-all-positive",
    ).length,
    sourceZeroLocalZeroCount: rows.filter(
      ({ rowClassification }) =>
        rowClassification === "source-zero-and-local-all-zero",
    ).length,
    objectiveCoverageMismatchCount: rows.filter(
      ({ rowClassification }) =>
        rowClassification === "objective-coverage-mismatch",
    ).length,
    sourceMainOnlyCount: rows.filter(
      ({ rowClassification }) =>
        rowClassification === "source-main-only-no-local-marginal",
    ).length,
    deferredEnergyOccurrenceCount,
    promotedRowCount: 0,
    rankedRowCount: 0,
    producedGuideCount: 0,
    producedStatWeightCount: 0,
    producedEnergyRequirementCount: 0,
  };
}

function collectDeferredEnergyOccurrences(
  record: ArtifactRatingModelSnapshot["records"][number] | null,
): DeferredEnergyOccurrence[] {
  if (!record) return [];
  const maps = [
    {
      rawPath: "records[0].rawModel.main.1",
      normalizedPath: "records[0].normalizedModel.main.flower",
      raw: record.rawModel.main["1"],
      normalized: record.normalizedModel.main.flower,
    },
    {
      rawPath: "records[0].rawModel.main.2",
      normalizedPath: "records[0].normalizedModel.main.plume",
      raw: record.rawModel.main["2"],
      normalized: record.normalizedModel.main.plume,
    },
    {
      rawPath: "records[0].rawModel.main.3",
      normalizedPath: "records[0].normalizedModel.main.sands",
      raw: record.rawModel.main["3"],
      normalized: record.normalizedModel.main.sands,
    },
    {
      rawPath: "records[0].rawModel.main.4",
      normalizedPath: "records[0].normalizedModel.main.goblet",
      raw: record.rawModel.main["4"],
      normalized: record.normalizedModel.main.goblet,
    },
    {
      rawPath: "records[0].rawModel.main.5",
      normalizedPath: "records[0].normalizedModel.main.circlet",
      raw: record.rawModel.main["5"],
      normalized: record.normalizedModel.main.circlet,
    },
    {
      rawPath: "records[0].rawModel.weight",
      normalizedPath: "records[0].normalizedModel.coefficients",
      raw: record.rawModel.weight,
      normalized: record.normalizedModel.coefficients,
    },
  ];
  return maps.flatMap(({ rawPath, normalizedPath, raw, normalized }) => {
    if (!("SPRatioBase" in raw)) return [];
    const normalizedOccurrence = normalized.SPRatioBase;
    return [
      {
        rawPath: `${rawPath}.SPRatioBase`,
        normalizedPath: `${normalizedPath}.SPRatioBase`,
        rawCoefficient: raw.SPRatioBase as number,
        normalizedCoefficient: normalizedOccurrence?.coefficient ?? null,
        statId: normalizedOccurrence?.statId ?? null,
        handling: normalizedOccurrence?.handling ?? null,
      },
    ];
  });
}

function collectNormalizedEnergyPaths(
  record: ArtifactRatingModelSnapshot["records"][number] | null,
): string[] {
  if (!record) return [];
  const maps = [
    [
      "records[0].normalizedModel.main.flower",
      record.normalizedModel.main.flower,
    ],
    [
      "records[0].normalizedModel.main.plume",
      record.normalizedModel.main.plume,
    ],
    [
      "records[0].normalizedModel.main.sands",
      record.normalizedModel.main.sands,
    ],
    [
      "records[0].normalizedModel.main.goblet",
      record.normalizedModel.main.goblet,
    ],
    [
      "records[0].normalizedModel.main.circlet",
      record.normalizedModel.main.circlet,
    ],
    [
      "records[0].normalizedModel.coefficients",
      record.normalizedModel.coefficients,
    ],
  ] as const;
  return maps.flatMap(([mapPath, entries]) =>
    Object.keys(entries)
      .filter((rawStatKey) => rawStatKey === "SPRatioBase")
      .map((rawStatKey) => `${mapPath}.${rawStatKey}`),
  );
}

function collectKqmConditions(recommendation: GuideRecommendation): string[] {
  const mainStats = recommendation.mainStats;
  const mainConditions = mainStats
    ? (["sands", "goblet", "circlet"] as const).flatMap((slot) =>
        (mainStats[slot] ?? []).flatMap(({ conditions }) => conditions),
      )
    : [];
  const substatConditions = (recommendation.substats ?? []).flatMap(
    ({ conditions }) => conditions,
  );
  return [...mainConditions, ...substatConditions];
}

function expectedKeqingStatOutcomesMatch(
  stats: TeamStatMarginalCrossEndpointStatObservation[],
): boolean {
  if (stats.length !== 9) return false;
  const expected = new Map<TeamStatMarginalNonErStat, [string, string]>([
    ["atk%", ["all-positive", "none-zero"]],
    ["atk", ["all-positive", "none-zero"]],
    ["cr", ["all-positive", "none-zero"]],
    ["cd", ["all-positive", "none-zero"]],
    ["def%", ["all-zero", "all-zero"]],
    ["def", ["all-zero", "all-zero"]],
    ["hp%", ["all-zero", "all-zero"]],
    ["hp", ["all-zero", "all-zero"]],
    ["em", ["all-zero", "all-zero"]],
  ]);
  return stats.every((observation) => {
    const outcome = expected.get(observation.stat);
    return (
      outcome != null &&
      observation.endpointCount === 4 &&
      observation.signClassification === outcome[0] &&
      observation.zeroClassification === outcome[1] &&
      (outcome[0] === "all-positive"
        ? observation.positiveEndpointIds.length === 4 &&
          observation.zeroEndpointIds.length === 0 &&
          observation.negativeEndpointIds.length === 0
        : observation.zeroEndpointIds.length === 4 &&
          observation.positiveEndpointIds.length === 0 &&
          observation.negativeEndpointIds.length === 0)
    );
  });
}

function kqmPresence(
  recommendation: GuideRecommendation,
  statId: ComparedStat,
): KeqingArtifactRatingKqmMarginalValidationRow["kqmPresence"] {
  const mainStatSlots = (["sands", "goblet", "circlet"] as const).filter(
    (slot) =>
      recommendation.mainStats?.[slot]?.some(({ statIds }) =>
        statIds.includes(statId),
      ) ?? false,
  );
  return {
    mainStatSlots,
    listedAsSubstat:
      recommendation.substats?.some(({ statIds }) =>
        statIds.includes(statId),
      ) ?? false,
  };
}

function artifactVariableMainStatSlots(
  record: ArtifactRatingModelSnapshot["records"][number],
  statId: ComparedStat,
): Array<"sands" | "goblet" | "circlet"> {
  return (["sands", "goblet", "circlet"] as const).filter((slot) =>
    Object.values(record.normalizedModel.main[slot]).some(
      (entry) => entry.statId === statId,
    ),
  );
}
