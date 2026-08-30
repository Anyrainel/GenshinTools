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
  authenticateXiaoFfxxPartialArtifactCandidateContract,
  XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS,
  XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS,
  type BuildXiaoFfxxPartialArtifactCandidateContractInput,
  type XiaoFfxxPartialArtifactCandidateContractReport,
  type XiaoFfxxPartialArtifactPresentAxis,
} from "./xiaoFfxxPartialArtifactCandidateContract";
import {
  authenticateXiaoNonErEquipmentBranchSourceSliceReport,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS,
  type BuildXiaoNonErEquipmentBranchSourceSliceInput,
  type XiaoNonErEquipmentBranchSourceSliceReport,
  type XiaoNonErStatGroup,
  type XiaoNonErSubstatPriorityGroup,
  type XiaoNonErWeaponGroup,
} from "./xiaoNonErEquipmentBranchSourceSlice";

const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const XIAO_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const XIAO_SOURCE_LOCAL_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-source-local-condition-slice.json";
const XIAO_APPLICABLE_CLAIM_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-applicable-claim-projection-contract.json";
const PARTIAL_CANDIDATE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-partial-artifact-candidate-contract.json";
const BRANCH_SOURCE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-non-er-equipment-branch-source-slice.json";
const CORE_PATH =
  "scripts/guide-factory/src/xiaoFfxxNonErConditionFreeBranchCandidateContract.ts";
const CLI_PATH =
  "scripts/guide-factory/src/assemble-xiao-ffxx-non-er-condition-free-branch-candidate-contract.ts";

const CONTRACT_ID =
  "guide-factory-xiao-ffxx-non-er-condition-free-branch-candidates-version-5-5";
const TEAM_ID =
  "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5";
const CHARACTER_ID = "xiao";

const EXPECTED_CONDITION_FREE_OCCURRENCE_IDS = [
  "kqm:character_guide:xiao-five-star-weapon-tiers-version-5-5:recommendation.weaponRecommendations[0].conditions",
  "kqm:character_guide:xiao-five-star-weapon-tiers-version-5-5:recommendation.weaponRecommendations[1].conditions",
  "kqm:character_guide:xiao-unranked-four-star-weapons-version-5-5:recommendation.weaponRecommendations[1].conditions",
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.sands[0].conditions",
] as const;

const AXIS_VOCABULARY = [
  "weapon",
  "artifact-set",
  "main-stat:sands",
  "main-stat:goblet",
  "main-stat:circlet",
  "substats",
] as const;

const CAPABILITIES = {
  arbitraryEnglishParsingAllowed: false,
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsEquipmentRecommendations: false,
  supportsBuildRecommendations: false,
  supportsStatRecommendations: false,
  supportsDerivedRankClaims: false,
  supportsCrossRarityRankClaims: false,
  supportsCompatibilityClaims: false,
  supportsDamageClaims: false,
  supportsFormulaClaims: false,
  supportsRotationClaims: false,
  supportsEnergyRecoveryClaims: false,
  sourceConditionEvaluationExecuted: false,
  crossAxisCompositionExecuted: true,
  branchEnumerationExecuted: true,
  boundedCartesianEnumerationExecuted: true,
  partialCandidateGenerationExecuted: true,
  partialCandidateConstructionExecuted: true,
  choiceSelectionExecuted: false,
  payloadCompatibilityEvaluated: false,
  recommendationCompositionExecuted: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  formulaInputsUsed: false,
  damageComputationExecuted: false,
  rotationComputationExecuted: false,
  idealRollAllocationExecuted: false,
  energyRecoveryInputsUsed: false,
  energyRecoveryComputationExecuted: false,
} as const;

const CAUTIONS = [
  "These six objects are Guide Factory-authored partial technical candidates formed by adding authenticated source-condition-free weapon and Sands rows to inherited team-conditioned payloads. They are not source-published whole builds or player-facing recommendations.",
  "Five-star ordering applies only to the two admitted source rank groups. Members within each group remain tied, Deathmatch remains unranked, and no cross-rarity order or flat candidate rank is defined.",
  "Only the newly admitted weapon and Sands branch rows are source-condition-free, meaning their source condition arrays are empty. The inherited artifact-set and Goblet payloads remain team-conditioned, and neither status establishes passive uptime, universal compatibility, relative damage, or a winner.",
  "Circlet selection and the incomplete offensive substat tail remain guarded and missing. Every candidate is incomplete and cannot enter the runtime artifact generator.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not publish these partial candidates as a Xiao guide, complete build, weapon ranking, or stat recommendation.",
  "Do not rank Deathmatch against either five-star group or rank tied members inside a five-star group.",
  "Do not fill Circlet or substats from defaults, current presets, inventory, or nearby source rows.",
  "Do not infer formula counts, damage, DPS, gameplay feasibility, ideal rolls, rotation quality, or an Energy Recharge requirement.",
] as const;

type AxisId = (typeof AXIS_VOCABULARY)[number];
type CandidateRarityClass = "five-star" | "four-star";

export interface XiaoFfxxNonErBranchSourceFile {
  path: string;
  text: string;
}

export interface BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  xiaoSourceLocalDurableReportInput: unknown;
  applicableClaimDurableReportInput: unknown;
  partialCandidateDurableReportInput: unknown;
  branchSourceDurableReportInput: unknown;
  sourceFiles: readonly XiaoFfxxNonErBranchSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface XiaoFfxxNonErPresentWeaponAxis {
  axisId: "weapon";
  ordinal: 0;
  status: "present-authenticated-source-condition-free-option";
  weaponId: string;
  refinement: "unspecified";
  sourceOccurrenceId: string;
  sourceGroupSha256: string;
  rarityClass: CandidateRarityClass;
  sourceRankGroup: number | null;
  sourceMembersTied: boolean;
  sourceFourStarOrdering: "not-applicable" | "unranked";
}

export interface XiaoFfxxNonErPresentSingletonAxis {
  axisId: "artifact-set" | "main-stat:sands" | "main-stat:goblet";
  ordinal: 1 | 2 | 3;
  status: "present-authenticated-singleton";
  normalizedValues: Array<Record<string, string>>;
  sourceOccurrenceIds: string[];
  sourcePayloadSha256: string;
}

export interface XiaoFfxxNonErMissingAxis {
  axisId: "main-stat:circlet" | "substats";
  ordinal: 4 | 5;
  status:
    | "missing-guarded-choice-not-evaluated"
    | "missing-guarded-incomplete-offensive-tail";
  reason:
    | "candidate-stat-dependent-selection-not-executed"
    | "leading-er-term-deferred-offensive-tail-not-complete";
  sourceOccurrenceIds: string[];
  sourceGroupSha256s: string[];
  guardedValues: string[];
}

export type XiaoFfxxNonErCandidateAxis =
  | XiaoFfxxNonErPresentWeaponAxis
  | XiaoFfxxNonErPresentSingletonAxis
  | XiaoFfxxNonErMissingAxis;

export interface XiaoFfxxNonErBaseViewEvidence {
  bindingId: string;
  viewId: string;
  viewBindingSha256: string;
  requestFactCount: number;
  inheritedWithoutChangingTechnicalCandidate: true;
}

export interface XiaoFfxxNonErConditionFreeBranchCandidate {
  candidateId: string;
  technicalCombinationSha256: string;
  candidateIdentitySha256: string;
  candidateProvenanceSha256: string;
  authoredBy: "guide-factory";
  sourceAuthoredWholeCandidate: false;
  compositionKind: "authenticated-condition-free-branch-expansion";
  completionStatus: "partial";
  materializableAsGuideBuildRecommendation: false;
  runtimeArtifactGenerationCandidate: false;
  jointPayloadCompatibility: "not-evaluated";
  teamRecordId: typeof TEAM_ID;
  characterId: typeof CHARACTER_ID;
  basePartialCandidateId: string;
  basePartialCandidateIdentitySha256: string;
  weaponId: string;
  rarityClass: CandidateRarityClass;
  sourceRankGroup: number | null;
  tiedWithinSourceGroup: boolean;
  fourStarOrdering: "not-applicable" | "unranked";
  factoryRank: null;
  crossRarityRank: null;
  flatSerializationOrderIsRank: false;
  weaponSourceClassification: string;
  branchAdmissionConditionStatus: "weapon-and-sands-source-condition-free";
  inheritedBasePayloadConditionStatus: "team-conditioned-view-provenance-preserved";
  allPresentAxesSourceConditionFree: false;
  axisVocabulary: AxisId[];
  axes: XiaoFfxxNonErCandidateAxis[];
  presentAxisIds: [
    "weapon",
    "artifact-set",
    "main-stat:sands",
    "main-stat:goblet",
  ];
  missingAxisIds: ["main-stat:circlet", "substats"];
  completeness: {
    axisCount: 6;
    presentAxisCount: 4;
    missingAxisCount: 2;
    complete: false;
    energyRecoveryPolicy: "excluded-deferred-not-a-completeness-axis";
  };
  baseViewEvidence: XiaoFfxxNonErBaseViewEvidence[];
  weaponEvidence: {
    occurrenceId: string;
    sourceGroupSha256: string;
    conditionArrayLength: 0;
    sourceConditionFreeDoesNotEstablishUniversalApplicability: true;
  };
  sandsEvidence: {
    occurrenceId: string;
    sourceGroupSha256: string;
    conditionArrayLength: 0;
  };
}

export interface XiaoFfxxNonErConditionFreeBranchGroup {
  branchGroupId: string;
  rarityClass: CandidateRarityClass;
  sourceOccurrenceId: string;
  sourceGroupSha256: string;
  sourceClassification: string;
  sourceRankGroup: number | null;
  sourceOrdering: "ranked-groups" | "unranked";
  membersTied: boolean;
  crossRarityOrdering: "not-defined";
  weaponIds: string[];
  candidateIds: string[];
  branchGroupSha256: string;
}

export interface XiaoFfxxNonErConditionFreeBranchCandidateContractReport {
  schemaVersion: 1;
  reportType: "xiao-ffxx-non-er-condition-free-branch-candidate-contract";
  contractId: typeof CONTRACT_ID;
  classification: "authenticated-guide-factory-authored-partial-branch-candidate-domain";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-partial-candidate-domain";
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
  partialCandidateUpstreamBoundary: {
    status: "accepted" | "rejected";
    durableReportPath: typeof PARTIAL_CANDIDATE_REPORT_PATH;
    durableReportFileSha256: string | null;
    durableReportCanonicalObjectSha256: string | null;
    freshlyAuthenticated: boolean;
    upstreamInputCount: number;
    partialCandidateCount: number;
    basePresentAxisCount: number;
    baseMissingAxisCount: number;
    baseViewBindingCount: number;
  };
  branchSourceUpstreamBoundary: {
    status: "accepted" | "rejected";
    durableReportPath: typeof BRANCH_SOURCE_REPORT_PATH;
    durableReportFileSha256: string | null;
    durableReportCanonicalObjectSha256: string | null;
    freshlyAuthenticated: boolean;
    upstreamInputCount: number;
    sourceObservationCount: number;
    conditionFreeOccurrenceCount: number;
    guardedOccurrenceCount: number;
    conditionFreeWeaponGroupCount: number;
    conditionFreeWeaponLeafCount: number;
  };
  compositionBoundary: {
    authoredBy: "guide-factory";
    sourcePublishedWholeCandidateCount: 0;
    teamRecordId: typeof TEAM_ID;
    characterId: typeof CHARACTER_ID;
    newlyAdmittedBranchRowsSourceConditionFreeOnly: true;
    inheritedBasePayloadsSourceConditionFree: false;
    inheritedBasePayloadConditionStatus: "team-conditioned-view-provenance-preserved";
    selectedOccurrenceIds: string[];
    selectedEmptyConditionOccurrenceCount: number;
    guardedOccurrenceIds: string[];
    guardedOccurrenceCount: number;
    guardedRowsConsumedCount: 0;
    conditionTruthEvaluationCount: 0;
    emptyConditionArrayTreatedAsUniversalBest: false;
    sourceViewAndRequestViewPreservedAsEvidenceOnly: true;
    requestFactChangesDerivedCandidateIdentity: false;
    repeatedSandsEvidenceEstablishesCorroboration: false;
  };
  rankingBoundary: {
    fiveStarOrdering: "ranked-groups";
    fiveStarMembersWithinGroup: "tied";
    admittedFiveStarRankGroups: [1, 2];
    fourStarOrdering: "unranked";
    crossRarityOrdering: "not-defined";
    flatCandidateSerializationOrderIsRank: false;
    guideFactoryDerivedRankCount: 0;
  };
  singletonAxes: {
    artifactSet: XiaoFfxxNonErPresentSingletonAxis;
    sands: XiaoFfxxNonErPresentSingletonAxis;
    goblet: XiaoFfxxNonErPresentSingletonAxis;
  } | null;
  missingAxes: {
    circlet: XiaoFfxxNonErMissingAxis;
    substats: XiaoFfxxNonErMissingAxis;
  } | null;
  enumerationBoundary: {
    basePartialCandidateCount: number;
    admittedWeaponLeafCount: number;
    sandsSingletonCount: number;
    theoreticalCartesianCandidateCount: number;
    enumeratedCandidateCount: number;
    deduplicatedCandidateCount: number;
    exactCardinalityEquation: "1 x 6 x 1 = 6";
  };
  rankedFiveStarBranchGroups: XiaoFfxxNonErConditionFreeBranchGroup[];
  unrankedFourStarBranchGroups: XiaoFfxxNonErConditionFreeBranchGroup[];
  candidates: XiaoFfxxNonErConditionFreeBranchCandidate[];
  withheldGuardedDomain: {
    weaponGroupCount: number;
    weaponLeafCount: number;
    circletGroupCount: number;
    circletLeafCount: number;
    substatPriorityGroupCount: number;
    substatLeafCount: number;
    candidateCountFromGuardedRows: 0;
  };
  identityBoundary: {
    candidateIdentitySetSha256: string | null;
    candidateProvenanceSetSha256: string | null;
    branchGroupSetSha256: string | null;
    withheldGuardedDomainSha256: string | null;
    aggregateCompositionSha256: string | null;
    requestFactExcludedFromCandidateIdentity: true;
    sourceRankExcludedFromTechnicalIdentity: true;
  };
  summary: {
    branchGroupCount: number;
    rankedFiveStarBranchGroupCount: number;
    unrankedFourStarBranchGroupCount: number;
    partialCandidateCount: number;
    provenanceBindingCount: number;
    uniqueWeaponCount: number;
    completeCandidateCount: 0;
    assembledBuildCount: 0;
    guideFactoryRecommendationCount: 0;
    sourcePublishedWholeCandidateCount: 0;
    derivedRankCount: 0;
    presentAxisCountPerCandidate: 4;
    missingAxisCountPerCandidate: 2;
  };
  arbitraryEnglishParsingAllowed: false;
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsBuildRecommendations: false;
  supportsStatRecommendations: false;
  supportsDerivedRankClaims: false;
  supportsCrossRarityRankClaims: false;
  supportsCompatibilityClaims: false;
  supportsDamageClaims: false;
  supportsFormulaClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  sourceConditionEvaluationExecuted: false;
  crossAxisCompositionExecuted: boolean;
  branchEnumerationExecuted: boolean;
  boundedCartesianEnumerationExecuted: boolean;
  partialCandidateGenerationExecuted: boolean;
  partialCandidateConstructionExecuted: boolean;
  choiceSelectionExecuted: false;
  payloadCompatibilityEvaluated: false;
  recommendationCompositionExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  formulaInputsUsed: false;
  damageComputationExecuted: false;
  rotationComputationExecuted: false;
  idealRollAllocationExecuted: false;
  energyRecoveryInputsUsed: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
  issues: Array<{ code: string; path: string; message: string }>;
}

export type XiaoFfxxNonErConditionFreeBranchCandidateAuthentication =
  | {
      authenticated: true;
      canonicalReport: XiaoFfxxNonErConditionFreeBranchCandidateContractReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: Array<{ code: string; path: string; message: string }>;
    };

export const XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS = [
  ...new Set([
    ...XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS,
    ...XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS,
    PARTIAL_CANDIDATE_REPORT_PATH,
    BRANCH_SOURCE_REPORT_PATH,
    CORE_PATH,
    CLI_PATH,
  ]),
].sort(compareText);

export const XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_SOURCE_FILE_PATHS = [
  ...XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
];

export const XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "xiao-ffxx-non-er-condition-free-branch-candidate-contract.json",
  );

export function buildXiaoFfxxNonErConditionFreeBranchCandidateContractReport(
  input: BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput,
): XiaoFfxxNonErConditionFreeBranchCandidateContractReport {
  let generatedFrom: GeneratedFromEntry[] = [];
  let partialFileSha: string | null = null;
  let partialObjectSha: string | null = null;
  let branchFileSha: string | null = null;
  let branchObjectSha: string | null = null;
  try {
    const raw = authenticateRawInputs(input);
    generatedFrom = raw.generatedFrom;
    partialFileSha = sha256Text(
      requiredSourceText(raw.sourceTextByPath, PARTIAL_CANDIDATE_REPORT_PATH),
    );
    partialObjectSha = hashValue(raw.partialCandidateReport);
    branchFileSha = sha256Text(
      requiredSourceText(raw.sourceTextByPath, BRANCH_SOURCE_REPORT_PATH),
    );
    branchObjectSha = hashValue(raw.branchSourceReport);

    const partialAuthentication =
      authenticateXiaoFfxxPartialArtifactCandidateContract(
        raw.partialCandidateReport,
        partialUpstreamInput(raw),
      );
    if (!partialAuthentication.authenticated) {
      throw new Error(
        `Checkpoint-44 partial candidate failed fresh authentication (${partialAuthentication.reason}).`,
      );
    }
    const branchAuthentication =
      authenticateXiaoNonErEquipmentBranchSourceSliceReport(
        raw.branchSourceReport,
        branchSourceUpstreamInput(raw),
      );
    if (!branchAuthentication.authenticated) {
      throw new Error(
        `Checkpoint-45 branch source slice failed fresh authentication (${branchAuthentication.reason}).`,
      );
    }

    const partial = partialAuthentication.canonicalReport;
    const branch = branchAuthentication.canonicalReport;
    const baseCandidate = requirePartialCandidateBoundary(partial);
    const branchInputs = requireBranchSourceBoundary(branch);
    const singletonAxes = buildSingletonAxes(baseCandidate, branchInputs.sands);
    const missingAxes = buildMissingAxes(
      branchInputs.circlet,
      branchInputs.substats,
    );
    const baseViewEvidence = partial.viewBindings.map((binding) => ({
      bindingId: binding.bindingId,
      viewId: binding.viewId,
      viewBindingSha256: binding.viewBindingSha256,
      requestFactCount: binding.requestFactCount,
      inheritedWithoutChangingTechnicalCandidate: true as const,
    }));

    const sourceGroups = [
      ...branchInputs.rankedFiveStarGroups,
      ...branchInputs.unrankedFourStarGroups,
    ];
    const candidates = sourceGroups.flatMap((sourceGroup) =>
      sourceGroup.weaponIds.map((weaponId) =>
        buildCandidate({
          baseCandidate,
          baseViewEvidence,
          singletonAxes,
          missingAxes,
          sourceGroup,
          sands: branchInputs.sands,
          weaponId,
        }),
      ),
    );
    const candidateByWeapon = new Map(
      candidates.map((candidate) => [candidate.weaponId, candidate]),
    );
    const rankedFiveStarBranchGroups =
      branchInputs.rankedFiveStarGroups.map((sourceGroup) =>
        buildBranchGroup(sourceGroup, candidateByWeapon),
      );
    const unrankedFourStarBranchGroups =
      branchInputs.unrankedFourStarGroups.map((sourceGroup) =>
        buildBranchGroup(sourceGroup, candidateByWeapon),
      );
    authenticateCandidateClosure(
      candidates,
      rankedFiveStarBranchGroups,
      unrankedFourStarBranchGroups,
    );
    const withheldGuardedDomain = {
      weaponGroupCount: 6,
      weaponLeafCount: 8,
      circletGroupCount: 1,
      circletLeafCount: 2,
      substatPriorityGroupCount: 2,
      substatLeafCount: 3,
      candidateCountFromGuardedRows: 0 as const,
    };
    const candidateIdentitySetSha256 = hashValue(
      candidates.map(({ candidateId, candidateIdentitySha256 }) => ({
        candidateId,
        candidateIdentitySha256,
      })),
    );
    const candidateProvenanceSetSha256 = hashValue(
      candidates.map(({ candidateId, candidateProvenanceSha256 }) => ({
        candidateId,
        candidateProvenanceSha256,
      })),
    );
    const branchGroupSetSha256 = hashValue([
      ...rankedFiveStarBranchGroups,
      ...unrankedFourStarBranchGroups,
    ]);
    const withheldGuardedDomainSha256 = hashValue(withheldGuardedDomain);
    const aggregateCompositionSha256 = hashValue({
      candidateIdentitySetSha256,
      candidateProvenanceSetSha256,
      branchGroupSetSha256,
      withheldGuardedDomainSha256,
      exactCardinalityEquation: "1 x 6 x 1 = 6",
    });

    return {
      schemaVersion: 1,
      reportType:
        "xiao-ffxx-non-er-condition-free-branch-candidate-contract",
      contractId: CONTRACT_ID,
      classification:
        "authenticated-guide-factory-authored-partial-branch-candidate-domain",
      comparisonStatus: "comparable",
      publicationStatus: "withheld-unreviewed-partial-candidate-domain",
      generatedFrom,
      rawInputBoundary: {
        status: "accepted",
        exactSourceFilePathSet: true,
        exactGeneratedFromPathSet: true,
        allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
        jsonInputByteAndParsedObjectParity: true,
        sourceFileCount: raw.sourceTextByPath.size,
        generatedFromCount: generatedFrom.length,
        jsonInputCount: 8,
      },
      partialCandidateUpstreamBoundary: {
        status: "accepted",
        durableReportPath: PARTIAL_CANDIDATE_REPORT_PATH,
        durableReportFileSha256: partialFileSha,
        durableReportCanonicalObjectSha256: partialObjectSha,
        freshlyAuthenticated: true,
        upstreamInputCount:
          XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS.length,
        partialCandidateCount: 1,
        basePresentAxisCount: 2,
        baseMissingAxisCount: 4,
        baseViewBindingCount: 2,
      },
      branchSourceUpstreamBoundary: {
        status: "accepted",
        durableReportPath: BRANCH_SOURCE_REPORT_PATH,
        durableReportFileSha256: branchFileSha,
        durableReportCanonicalObjectSha256: branchObjectSha,
        freshlyAuthenticated: true,
        upstreamInputCount:
          XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS.length,
        sourceObservationCount: 13,
        conditionFreeOccurrenceCount: 4,
        guardedOccurrenceCount: 9,
        conditionFreeWeaponGroupCount: 3,
        conditionFreeWeaponLeafCount: 6,
      },
      compositionBoundary: {
        authoredBy: "guide-factory",
        sourcePublishedWholeCandidateCount: 0,
        teamRecordId: TEAM_ID,
        characterId: CHARACTER_ID,
        newlyAdmittedBranchRowsSourceConditionFreeOnly: true,
        inheritedBasePayloadsSourceConditionFree: false,
        inheritedBasePayloadConditionStatus:
          "team-conditioned-view-provenance-preserved",
        selectedOccurrenceIds: [...EXPECTED_CONDITION_FREE_OCCURRENCE_IDS],
        selectedEmptyConditionOccurrenceCount: 4,
        guardedOccurrenceIds: [...branch.conditionallyDeferredOccurrenceIds],
        guardedOccurrenceCount: 9,
        guardedRowsConsumedCount: 0,
        conditionTruthEvaluationCount: 0,
        emptyConditionArrayTreatedAsUniversalBest: false,
        sourceViewAndRequestViewPreservedAsEvidenceOnly: true,
        requestFactChangesDerivedCandidateIdentity: false,
        repeatedSandsEvidenceEstablishesCorroboration: false,
      },
      rankingBoundary: {
        fiveStarOrdering: "ranked-groups",
        fiveStarMembersWithinGroup: "tied",
        admittedFiveStarRankGroups: [1, 2],
        fourStarOrdering: "unranked",
        crossRarityOrdering: "not-defined",
        flatCandidateSerializationOrderIsRank: false,
        guideFactoryDerivedRankCount: 0,
      },
      singletonAxes,
      missingAxes,
      enumerationBoundary: {
        basePartialCandidateCount: 1,
        admittedWeaponLeafCount: 6,
        sandsSingletonCount: 1,
        theoreticalCartesianCandidateCount: 6,
        enumeratedCandidateCount: candidates.length,
        deduplicatedCandidateCount: 0,
        exactCardinalityEquation: "1 x 6 x 1 = 6",
      },
      rankedFiveStarBranchGroups,
      unrankedFourStarBranchGroups,
      candidates,
      withheldGuardedDomain,
      identityBoundary: {
        candidateIdentitySetSha256,
        candidateProvenanceSetSha256,
        branchGroupSetSha256,
        withheldGuardedDomainSha256,
        aggregateCompositionSha256,
        requestFactExcludedFromCandidateIdentity: true,
        sourceRankExcludedFromTechnicalIdentity: true,
      },
      summary: {
        branchGroupCount: 3,
        rankedFiveStarBranchGroupCount: 2,
        unrankedFourStarBranchGroupCount: 1,
        partialCandidateCount: candidates.length,
        provenanceBindingCount: candidates.length * baseViewEvidence.length,
        uniqueWeaponCount: new Set(candidates.map(({ weaponId }) => weaponId))
          .size,
        completeCandidateCount: 0,
        assembledBuildCount: 0,
        guideFactoryRecommendationCount: 0,
        sourcePublishedWholeCandidateCount: 0,
        derivedRankCount: 0,
        presentAxisCountPerCandidate: 4,
        missingAxisCountPerCandidate: 2,
      },
      ...CAPABILITIES,
      cautions: [...CAUTIONS],
      prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
      issues: [],
    };
  } catch (error) {
    return failedReport({
      generatedFrom,
      partialFileSha,
      partialObjectSha,
      branchFileSha,
      branchObjectSha,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function authenticateXiaoFfxxNonErConditionFreeBranchCandidateContract(
  serializedReport: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
  input: BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput,
): XiaoFfxxNonErConditionFreeBranchCandidateAuthentication {
  const canonicalReport =
    buildXiaoFfxxNonErConditionFreeBranchCandidateContractReport(input);
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
          code: "xiao-ffxx-non-er-branch.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Xiao FFXX non-ER branch candidate contract does not match a fresh canonical rebuild.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableXiaoFfxxNonErConditionFreeBranchCandidateContract(
  report: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
  input: BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput,
): void {
  const authentication =
    authenticateXiaoFfxxNonErConditionFreeBranchCandidateContract(
      report,
      input,
    );
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Xiao FFXX non-ER branch candidate contract (${authentication.reason}): ${authentication.issues
      .map(({ code, message }) => `${code}: ${message}`)
      .join("; ")}`,
  );
}

interface AuthenticatedRawInputs {
  repository: ReturnType<typeof KnowledgeRepositorySchema.parse>;
  manualSnapshot: ReturnType<typeof ManualObservationSnapshotSchema.parse>;
  manualIndex: ReturnType<typeof ManualSnapshotIndexSchema.parse>;
  sourceRegistry: ReturnType<typeof SourceRegistrySchema.parse>;
  xiaoSourceLocalReport: unknown;
  applicableClaimReport: unknown;
  partialCandidateReport: XiaoFfxxPartialArtifactCandidateContractReport;
  branchSourceReport: XiaoNonErEquipmentBranchSourceSliceReport;
  sourceTextByPath: Map<string, string>;
  generatedFrom: GeneratedFromEntry[];
}

function authenticateRawInputs(
  input: BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput,
): AuthenticatedRawInputs {
  const expectedPaths = [
    ...XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
  ];
  const sourceFiles = input.sourceFiles
    .map(({ path: sourcePath, text }) => ({
      path: normalizePath(sourcePath),
      text,
    }))
    .sort((left, right) => compareText(left.path, right.path));
  const generatedFrom = input.generatedFrom
    .map(({ path: generatedPath, sha256 }) => ({
      path: normalizePath(generatedPath),
      sha256,
    }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    new Set(sourceFiles.map(({ path: sourcePath }) => sourcePath)).size !==
      sourceFiles.length ||
    new Set(generatedFrom.map(({ path: generatedPath }) => generatedPath)).size !==
      generatedFrom.length ||
    stableJson(sourceFiles.map(({ path: sourcePath }) => sourcePath)) !==
      stableJson(expectedPaths) ||
    stableJson(generatedFrom.map(({ path: generatedPath }) => generatedPath)) !==
      stableJson(expectedPaths)
  ) {
    throw new Error("Xiao FFXX non-ER branch input path closure drifted.");
  }
  const generatedHashByPath = new Map(
    generatedFrom.map(({ path: generatedPath, sha256 }) => [generatedPath, sha256]),
  );
  const sourceTextByPath = new Map<string, string>();
  for (const sourceFile of sourceFiles) {
    if (
      typeof sourceFile.text !== "string" ||
      sha256Text(sourceFile.text) !== generatedHashByPath.get(sourceFile.path)
    ) {
      throw new Error(
        `Xiao FFXX non-ER branch source-file hash drifted for ${sourceFile.path}.`,
      );
    }
    sourceTextByPath.set(sourceFile.path, sourceFile.text);
  }

  const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
  const manualSnapshot = ManualObservationSnapshotSchema.parse(
    input.manualSnapshotInput,
  );
  const manualIndex = ManualSnapshotIndexSchema.parse(input.manualIndexInput);
  const sourceRegistry = SourceRegistrySchema.parse(input.sourceRegistryInput);
  const jsonInputs: Array<[string, unknown]> = [
    [REPOSITORY_PATH, repository],
    [XIAO_SNAPSHOT_PATH, manualSnapshot],
    [MANUAL_INDEX_PATH, manualIndex],
    [SOURCE_REGISTRY_PATH, sourceRegistry],
    [XIAO_SOURCE_LOCAL_REPORT_PATH, input.xiaoSourceLocalDurableReportInput],
    [XIAO_APPLICABLE_CLAIM_REPORT_PATH, input.applicableClaimDurableReportInput],
    [PARTIAL_CANDIDATE_REPORT_PATH, input.partialCandidateDurableReportInput],
    [BRANCH_SOURCE_REPORT_PATH, input.branchSourceDurableReportInput],
  ];
  for (const [jsonPath, parsedObject] of jsonInputs) {
    let parsedBytes: unknown;
    try {
      parsedBytes = JSON.parse(requiredSourceText(sourceTextByPath, jsonPath));
    } catch {
      throw new Error(`Invalid JSON bytes at ${jsonPath}.`);
    }
    if (stableJson(parsedBytes) !== stableJson(parsedObject)) {
      throw new Error(`JSON byte/object parity drifted at ${jsonPath}.`);
    }
  }

  return {
    repository,
    manualSnapshot,
    manualIndex,
    sourceRegistry,
    xiaoSourceLocalReport: input.xiaoSourceLocalDurableReportInput,
    applicableClaimReport: input.applicableClaimDurableReportInput,
    partialCandidateReport:
      input.partialCandidateDurableReportInput as XiaoFfxxPartialArtifactCandidateContractReport,
    branchSourceReport:
      input.branchSourceDurableReportInput as XiaoNonErEquipmentBranchSourceSliceReport,
    sourceTextByPath,
    generatedFrom,
  };
}

function partialUpstreamInput(
  raw: AuthenticatedRawInputs,
): BuildXiaoFfxxPartialArtifactCandidateContractInput {
  return {
    repositoryInput: raw.repository,
    manualSnapshotInput: raw.manualSnapshot,
    manualIndexInput: raw.manualIndex,
    sourceRegistryInput: raw.sourceRegistry,
    xiaoSourceLocalDurableReportInput: raw.xiaoSourceLocalReport,
    applicableClaimDurableReportInput: raw.applicableClaimReport,
    sourceFiles: XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS.map(
      (inputPath) => ({
        path: inputPath,
        text: requiredSourceText(raw.sourceTextByPath, inputPath),
      }),
    ),
    generatedFrom: XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS.map(
      (inputPath) => requiredGeneratedFrom(raw.generatedFrom, inputPath),
    ),
  };
}

function branchSourceUpstreamInput(
  raw: AuthenticatedRawInputs,
): BuildXiaoNonErEquipmentBranchSourceSliceInput {
  return {
    repositoryInput: raw.repository,
    manualSnapshotInput: raw.manualSnapshot,
    manualIndexInput: raw.manualIndex,
    sourceRegistryInput: raw.sourceRegistry,
    xiaoSourceLocalDurableReportInput: raw.xiaoSourceLocalReport,
    sourceFiles:
      XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS.map(
        (inputPath) => ({
          path: inputPath,
          text: requiredSourceText(raw.sourceTextByPath, inputPath),
        }),
      ),
    generatedFrom: XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS.map(
      (inputPath) => requiredGeneratedFrom(raw.generatedFrom, inputPath),
    ),
  };
}

function requirePartialCandidateBoundary(
  report: XiaoFfxxPartialArtifactCandidateContractReport,
): NonNullable<XiaoFfxxPartialArtifactCandidateContractReport["candidate"]> {
  const candidate = report.candidate;
  if (
    report.comparisonStatus !== "comparable" ||
    !candidate ||
    candidate.teamRecordId !== TEAM_ID ||
    candidate.characterId !== CHARACTER_ID ||
    candidate.presentAxisIds.join("|") !== "artifact-set|main-stat:goblet" ||
    candidate.missingAxisIds.join("|") !==
      "weapon|main-stat:sands|main-stat:circlet|substats" ||
    candidate.completeness.presentAxisCount !== 2 ||
    candidate.completeness.missingAxisCount !== 4 ||
    candidate.completeness.complete ||
    report.viewBindings.length !== 2 ||
    report.summary.uniquePartialTechnicalCandidateCount !== 1 ||
    report.summary.completeCandidateCount !== 0 ||
    report.summary.assembledBuildCount !== 0 ||
    report.supportsGuideClaims ||
    report.supportsRankClaims ||
    report.supportsEnergyRecoveryClaims
  ) {
    throw new Error("Checkpoint-44 partial candidate semantic boundary drifted.");
  }
  return candidate;
}

interface BranchSourceBoundary {
  rankedFiveStarGroups: XiaoNonErWeaponGroup[];
  unrankedFourStarGroups: XiaoNonErWeaponGroup[];
  sands: XiaoNonErStatGroup;
  circlet: XiaoNonErStatGroup;
  substats: XiaoNonErSubstatPriorityGroup[];
}

function requireBranchSourceBoundary(
  report: XiaoNonErEquipmentBranchSourceSliceReport,
): BranchSourceBoundary {
  const rankedFiveStarGroups = report.rankedFiveStarGroups.filter(
    ({ sourceConditionStatus }) =>
      sourceConditionStatus === "source-condition-free",
  );
  const unrankedFourStarGroups = report.unrankedFourStarOptions.filter(
    ({ sourceConditionStatus }) =>
      sourceConditionStatus === "source-condition-free",
  );
  const sands = report.mainStatChoiceGroups.find(({ slot }) => slot === "sands");
  const circlet = report.mainStatChoiceGroups.find(
    ({ slot }) => slot === "circlet",
  );
  const substats = report.guardedOffensiveTailPriorities;
  if (
    report.comparisonStatus !== "comparable" ||
    stableJson(report.conditionFreeOccurrenceIds) !==
      stableJson(EXPECTED_CONDITION_FREE_OCCURRENCE_IDS) ||
    report.conditionallyDeferredOccurrenceIds.length !== 9 ||
    rankedFiveStarGroups.length !== 2 ||
    rankedFiveStarGroups[0]?.sourceRankGroup !== 1 ||
    rankedFiveStarGroups[1]?.sourceRankGroup !== 2 ||
    rankedFiveStarGroups.some(
      ({ grouping, weaponOrdering, sourcePositionIsRank, conditions }) =>
        grouping !== "tied" ||
        weaponOrdering !== "ranked-groups" ||
        !sourcePositionIsRank ||
        conditions.length !== 0,
    ) ||
    unrankedFourStarGroups.length !== 1 ||
    unrankedFourStarGroups[0]?.weaponIds.join("|") !== "deathmatch" ||
    unrankedFourStarGroups[0]?.weaponOrdering !== "unranked" ||
    unrankedFourStarGroups[0]?.sourcePositionIsRank ||
    unrankedFourStarGroups[0]?.sourceRankGroup != null ||
    unrankedFourStarGroups[0]?.conditions.length !== 0 ||
    !sands ||
    sands.statIds.join("|") !== "atk%" ||
    sands.sourceConditionStatus !== "source-condition-free" ||
    !circlet ||
    circlet.statIds.join("|") !== "cr|cd" ||
    circlet.sourceConditionStatus !== "guarded-unresolved" ||
    substats.length !== 2 ||
    substats.map(({ priority }) => priority).join("|") !== "1|2" ||
    report.summary.conditionFreeWeaponGroupCount !== 3 ||
    report.summary.conditionFreeWeaponLeafCount !== 6 ||
    report.summary.guardedWeaponGroupCount !== 6 ||
    report.summary.guardedWeaponLeafCount !== 8 ||
    report.summary.candidateCount !== 0 ||
    report.summary.completeBuildCount !== 0 ||
    report.supportsGuideClaims ||
    report.supportsDerivedRankClaims ||
    report.supportsEnergyRecoveryClaims
  ) {
    throw new Error("Checkpoint-45 branch source semantic boundary drifted.");
  }
  return {
    rankedFiveStarGroups,
    unrankedFourStarGroups,
    sands,
    circlet,
    substats: substats.map((group) => structuredClone(group)),
  };
}

function buildSingletonAxes(
  baseCandidate: NonNullable<
    XiaoFfxxPartialArtifactCandidateContractReport["candidate"]
  >,
  sands: XiaoNonErStatGroup,
): NonNullable<
  XiaoFfxxNonErConditionFreeBranchCandidateContractReport["singletonAxes"]
> {
  const artifact = requiredPresentAxis(baseCandidate.axes, "artifact-set");
  const goblet = requiredPresentAxis(baseCandidate.axes, "main-stat:goblet");
  return {
    artifactSet: {
      axisId: "artifact-set",
      ordinal: 1,
      status: "present-authenticated-singleton",
      normalizedValues: cloneNormalizedValues(artifact.normalizedValues),
      sourceOccurrenceIds: [
        "kqm:character_guide:xiao-mh-artifact-branch-version-5-5:recommendation.artifactRecommendations[0].conditions",
      ],
      sourcePayloadSha256: artifact.sourcePayloadSha256,
    },
    sands: {
      axisId: "main-stat:sands",
      ordinal: 2,
      status: "present-authenticated-singleton",
      normalizedValues: sands.statIds.map((statId) => ({
        slot: "sands",
        statId,
      })),
      sourceOccurrenceIds: [sands.occurrenceId],
      sourcePayloadSha256: sands.sourceGroupSha256,
    },
    goblet: {
      axisId: "main-stat:goblet",
      ordinal: 3,
      status: "present-authenticated-singleton",
      normalizedValues: cloneNormalizedValues(goblet.normalizedValues),
      sourceOccurrenceIds: [
        "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[3].conditions",
        "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[4].conditions",
      ],
      sourcePayloadSha256: goblet.sourcePayloadSha256,
    },
  };
}

function buildMissingAxes(
  circlet: XiaoNonErStatGroup,
  substats: readonly XiaoNonErSubstatPriorityGroup[],
): NonNullable<
  XiaoFfxxNonErConditionFreeBranchCandidateContractReport["missingAxes"]
> {
  return {
    circlet: {
      axisId: "main-stat:circlet",
      ordinal: 4,
      status: "missing-guarded-choice-not-evaluated",
      reason: "candidate-stat-dependent-selection-not-executed",
      sourceOccurrenceIds: [circlet.occurrenceId],
      sourceGroupSha256s: [circlet.sourceGroupSha256],
      guardedValues: [...circlet.statIds],
    },
    substats: {
      axisId: "substats",
      ordinal: 5,
      status: "missing-guarded-incomplete-offensive-tail",
      reason: "leading-er-term-deferred-offensive-tail-not-complete",
      sourceOccurrenceIds: substats.map(({ occurrenceId }) => occurrenceId),
      sourceGroupSha256s: substats.map(
        ({ sourceGroupSha256 }) => sourceGroupSha256,
      ),
      guardedValues: substats.flatMap(({ statIds }) => statIds),
    },
  };
}

function buildCandidate(input: {
  baseCandidate: NonNullable<
    XiaoFfxxPartialArtifactCandidateContractReport["candidate"]
  >;
  baseViewEvidence: XiaoFfxxNonErBaseViewEvidence[];
  singletonAxes: NonNullable<
    XiaoFfxxNonErConditionFreeBranchCandidateContractReport["singletonAxes"]
  >;
  missingAxes: NonNullable<
    XiaoFfxxNonErConditionFreeBranchCandidateContractReport["missingAxes"]
  >;
  sourceGroup: XiaoNonErWeaponGroup;
  sands: XiaoNonErStatGroup;
  weaponId: string;
}): XiaoFfxxNonErConditionFreeBranchCandidate {
  const rarityClass = input.sourceGroup.rarityClass;
  const candidateId =
    `guide-factory:xiao-ffxx:partial-non-er:${input.weaponId}:mh-atk-anemo`;
  const weaponAxis: XiaoFfxxNonErPresentWeaponAxis = {
    axisId: "weapon",
    ordinal: 0,
    status: "present-authenticated-source-condition-free-option",
    weaponId: input.weaponId,
    refinement: "unspecified",
    sourceOccurrenceId: input.sourceGroup.occurrenceId,
    sourceGroupSha256: input.sourceGroup.sourceGroupSha256,
    rarityClass,
    sourceRankGroup: input.sourceGroup.sourceRankGroup,
    sourceMembersTied: rarityClass === "five-star",
    sourceFourStarOrdering:
      rarityClass === "four-star" ? "unranked" : "not-applicable",
  };
  const axes: XiaoFfxxNonErCandidateAxis[] = [
    weaponAxis,
    structuredClone(input.singletonAxes.artifactSet),
    structuredClone(input.singletonAxes.sands),
    structuredClone(input.singletonAxes.goblet),
    structuredClone(input.missingAxes.circlet),
    structuredClone(input.missingAxes.substats),
  ];
  const technicalCombinationSha256 = hashValue({
    teamRecordId: TEAM_ID,
    characterId: CHARACTER_ID,
    weapon: { weaponId: input.weaponId, refinement: "unspecified" },
    artifactSet: input.singletonAxes.artifactSet.normalizedValues,
    sands: input.singletonAxes.sands.normalizedValues,
    goblet: input.singletonAxes.goblet.normalizedValues,
  });
  const identityProjection = {
    contractId: CONTRACT_ID,
    candidateId,
    teamRecordId: TEAM_ID,
    characterId: CHARACTER_ID,
    basePartialCandidateIdentitySha256:
      input.baseCandidate.candidateIdentitySha256,
    technicalCombinationSha256,
    technicalAxes: {
      weapon: { weaponId: input.weaponId, refinement: "unspecified" },
      artifactSet: input.singletonAxes.artifactSet.normalizedValues,
      sands: input.singletonAxes.sands.normalizedValues,
      goblet: input.singletonAxes.goblet.normalizedValues,
    },
    missingAxisPolicy: {
      circlet: {
        status: input.missingAxes.circlet.status,
        reason: input.missingAxes.circlet.reason,
      },
      substats: {
        status: input.missingAxes.substats.status,
        reason: input.missingAxes.substats.reason,
      },
    },
    energyRecoveryPolicy: "excluded-deferred-not-a-completeness-axis",
  };
  const candidateIdentitySha256 = hashValue(identityProjection);
  const candidateProvenanceSha256 = hashValue({
    candidateId,
    candidateIdentitySha256,
    baseViewEvidence: input.baseViewEvidence,
    weaponSourceGroup: {
      occurrenceId: input.sourceGroup.occurrenceId,
      sourceGroupSha256: input.sourceGroup.sourceGroupSha256,
      rarityClass,
      sourceRankGroup: input.sourceGroup.sourceRankGroup,
      grouping: input.sourceGroup.grouping,
      sourceClassification: input.sourceGroup.classification,
    },
    sandsSourceGroup: {
      occurrenceId: input.sands.occurrenceId,
      sourceGroupSha256: input.sands.sourceGroupSha256,
    },
  });
  return {
    candidateId,
    technicalCombinationSha256,
    candidateIdentitySha256,
    candidateProvenanceSha256,
    authoredBy: "guide-factory",
    sourceAuthoredWholeCandidate: false,
    compositionKind: "authenticated-condition-free-branch-expansion",
    completionStatus: "partial",
    materializableAsGuideBuildRecommendation: false,
    runtimeArtifactGenerationCandidate: false,
    jointPayloadCompatibility: "not-evaluated",
    teamRecordId: TEAM_ID,
    characterId: CHARACTER_ID,
    basePartialCandidateId: input.baseCandidate.candidateId,
    basePartialCandidateIdentitySha256:
      input.baseCandidate.candidateIdentitySha256,
    weaponId: input.weaponId,
    rarityClass,
    sourceRankGroup: input.sourceGroup.sourceRankGroup,
    tiedWithinSourceGroup: rarityClass === "five-star",
    fourStarOrdering:
      rarityClass === "four-star" ? "unranked" : "not-applicable",
    factoryRank: null,
    crossRarityRank: null,
    flatSerializationOrderIsRank: false,
    weaponSourceClassification: input.sourceGroup.classification,
    branchAdmissionConditionStatus: "weapon-and-sands-source-condition-free",
    inheritedBasePayloadConditionStatus:
      "team-conditioned-view-provenance-preserved",
    allPresentAxesSourceConditionFree: false,
    axisVocabulary: [...AXIS_VOCABULARY],
    axes,
    presentAxisIds: [
      "weapon",
      "artifact-set",
      "main-stat:sands",
      "main-stat:goblet",
    ],
    missingAxisIds: ["main-stat:circlet", "substats"],
    completeness: {
      axisCount: 6,
      presentAxisCount: 4,
      missingAxisCount: 2,
      complete: false,
      energyRecoveryPolicy: "excluded-deferred-not-a-completeness-axis",
    },
    baseViewEvidence: input.baseViewEvidence.map((binding) => ({ ...binding })),
    weaponEvidence: {
      occurrenceId: input.sourceGroup.occurrenceId,
      sourceGroupSha256: input.sourceGroup.sourceGroupSha256,
      conditionArrayLength: 0,
      sourceConditionFreeDoesNotEstablishUniversalApplicability: true,
    },
    sandsEvidence: {
      occurrenceId: input.sands.occurrenceId,
      sourceGroupSha256: input.sands.sourceGroupSha256,
      conditionArrayLength: 0,
    },
  };
}

function buildBranchGroup(
  sourceGroup: XiaoNonErWeaponGroup,
  candidateByWeapon: ReadonlyMap<
    string,
    XiaoFfxxNonErConditionFreeBranchCandidate
  >,
): XiaoFfxxNonErConditionFreeBranchGroup {
  const candidates = sourceGroup.weaponIds.map((weaponId) => {
    const candidate = candidateByWeapon.get(weaponId);
    if (!candidate) throw new Error(`Missing branch candidate for ${weaponId}.`);
    return candidate;
  });
  const branchGroupId =
    sourceGroup.rarityClass === "five-star"
      ? `xiao-ffxx:five-star-source-rank-group-${sourceGroup.sourceRankGroup}`
      : "xiao-ffxx:four-star-unranked-deathmatch";
  const withoutHash = {
    branchGroupId,
    rarityClass: sourceGroup.rarityClass,
    sourceOccurrenceId: sourceGroup.occurrenceId,
    sourceGroupSha256: sourceGroup.sourceGroupSha256,
    sourceClassification: sourceGroup.classification,
    sourceRankGroup: sourceGroup.sourceRankGroup,
    sourceOrdering: sourceGroup.weaponOrdering,
    membersTied: sourceGroup.rarityClass === "five-star",
    crossRarityOrdering: "not-defined" as const,
    weaponIds: [...sourceGroup.weaponIds],
    candidateIds: candidates.map(({ candidateId }) => candidateId),
  };
  return { ...withoutHash, branchGroupSha256: hashValue(withoutHash) };
}

function authenticateCandidateClosure(
  candidates: readonly XiaoFfxxNonErConditionFreeBranchCandidate[],
  rankedGroups: readonly XiaoFfxxNonErConditionFreeBranchGroup[],
  unrankedGroups: readonly XiaoFfxxNonErConditionFreeBranchGroup[],
): void {
  const expectedWeapons = [
    "primordial_jade_wingedspear",
    "staff_of_homa",
    "lumidouce_elegy",
    "vortex_vanquisher",
    "calamity_queller",
    "deathmatch",
  ];
  if (
    candidates.length !== 6 ||
    new Set(candidates.map(({ candidateId }) => candidateId)).size !== 6 ||
    new Set(candidates.map(({ candidateIdentitySha256 }) =>
      candidateIdentitySha256,
    )).size !== 6 ||
    stableJson(candidates.map(({ weaponId }) => weaponId)) !==
      stableJson(expectedWeapons) ||
    candidates.some(
      (candidate) =>
        candidate.completeness.complete ||
        candidate.presentAxisIds.length !== 4 ||
        candidate.missingAxisIds.length !== 2 ||
        candidate.factoryRank != null ||
        candidate.crossRarityRank != null ||
        candidate.runtimeArtifactGenerationCandidate ||
        candidate.baseViewEvidence.length !== 2,
    ) ||
    rankedGroups.length !== 2 ||
    rankedGroups.map(({ sourceRankGroup }) => sourceRankGroup).join("|") !==
      "1|2" ||
    rankedGroups.map(({ weaponIds }) => weaponIds.length).join("|") !== "3|2" ||
    unrankedGroups.length !== 1 ||
    unrankedGroups[0]?.weaponIds.join("|") !== "deathmatch" ||
    unrankedGroups[0]?.sourceRankGroup != null
  ) {
    throw new Error("Xiao FFXX non-ER candidate enumeration closure drifted.");
  }
}

function requiredPresentAxis(
  axes: readonly unknown[],
  axisId: "artifact-set" | "main-stat:goblet",
): XiaoFfxxPartialArtifactPresentAxis {
  const axis = axes.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.axisId === axisId &&
      candidate.status === "present-authenticated-singleton",
  );
  if (!axis) throw new Error(`Missing base present axis ${axisId}.`);
  return axis as unknown as XiaoFfxxPartialArtifactPresentAxis;
}

function cloneNormalizedValues(
  values: XiaoFfxxPartialArtifactPresentAxis["normalizedValues"],
): Array<Record<string, string>> {
  return structuredClone(values) as unknown as Array<Record<string, string>>;
}

function failedReport(input: {
  generatedFrom: GeneratedFromEntry[];
  partialFileSha: string | null;
  partialObjectSha: string | null;
  branchFileSha: string | null;
  branchObjectSha: string | null;
  message: string;
}): XiaoFfxxNonErConditionFreeBranchCandidateContractReport {
  return {
    schemaVersion: 1,
    reportType: "xiao-ffxx-non-er-condition-free-branch-candidate-contract",
    contractId: CONTRACT_ID,
    classification:
      "authenticated-guide-factory-authored-partial-branch-candidate-domain",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-unreviewed-partial-candidate-domain",
    generatedFrom: input.generatedFrom,
    rawInputBoundary: {
      status: "rejected",
      exactSourceFilePathSet: false,
      exactGeneratedFromPathSet: false,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: false,
      jsonInputByteAndParsedObjectParity: false,
      sourceFileCount: 0,
      generatedFromCount: input.generatedFrom.length,
      jsonInputCount: 8,
    },
    partialCandidateUpstreamBoundary: {
      status: "rejected",
      durableReportPath: PARTIAL_CANDIDATE_REPORT_PATH,
      durableReportFileSha256: input.partialFileSha,
      durableReportCanonicalObjectSha256: input.partialObjectSha,
      freshlyAuthenticated: false,
      upstreamInputCount:
        XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS.length,
      partialCandidateCount: 0,
      basePresentAxisCount: 0,
      baseMissingAxisCount: 0,
      baseViewBindingCount: 0,
    },
    branchSourceUpstreamBoundary: {
      status: "rejected",
      durableReportPath: BRANCH_SOURCE_REPORT_PATH,
      durableReportFileSha256: input.branchFileSha,
      durableReportCanonicalObjectSha256: input.branchObjectSha,
      freshlyAuthenticated: false,
      upstreamInputCount:
        XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS.length,
      sourceObservationCount: 0,
      conditionFreeOccurrenceCount: 0,
      guardedOccurrenceCount: 0,
      conditionFreeWeaponGroupCount: 0,
      conditionFreeWeaponLeafCount: 0,
    },
    compositionBoundary: {
      authoredBy: "guide-factory",
      sourcePublishedWholeCandidateCount: 0,
      teamRecordId: TEAM_ID,
      characterId: CHARACTER_ID,
      newlyAdmittedBranchRowsSourceConditionFreeOnly: true,
      inheritedBasePayloadsSourceConditionFree: false,
      inheritedBasePayloadConditionStatus:
        "team-conditioned-view-provenance-preserved",
      selectedOccurrenceIds: [],
      selectedEmptyConditionOccurrenceCount: 0,
      guardedOccurrenceIds: [],
      guardedOccurrenceCount: 0,
      guardedRowsConsumedCount: 0,
      conditionTruthEvaluationCount: 0,
      emptyConditionArrayTreatedAsUniversalBest: false,
      sourceViewAndRequestViewPreservedAsEvidenceOnly: true,
      requestFactChangesDerivedCandidateIdentity: false,
      repeatedSandsEvidenceEstablishesCorroboration: false,
    },
    rankingBoundary: {
      fiveStarOrdering: "ranked-groups",
      fiveStarMembersWithinGroup: "tied",
      admittedFiveStarRankGroups: [1, 2],
      fourStarOrdering: "unranked",
      crossRarityOrdering: "not-defined",
      flatCandidateSerializationOrderIsRank: false,
      guideFactoryDerivedRankCount: 0,
    },
    singletonAxes: null,
    missingAxes: null,
    enumerationBoundary: {
      basePartialCandidateCount: 0,
      admittedWeaponLeafCount: 0,
      sandsSingletonCount: 0,
      theoreticalCartesianCandidateCount: 0,
      enumeratedCandidateCount: 0,
      deduplicatedCandidateCount: 0,
      exactCardinalityEquation: "1 x 6 x 1 = 6",
    },
    rankedFiveStarBranchGroups: [],
    unrankedFourStarBranchGroups: [],
    candidates: [],
    withheldGuardedDomain: {
      weaponGroupCount: 0,
      weaponLeafCount: 0,
      circletGroupCount: 0,
      circletLeafCount: 0,
      substatPriorityGroupCount: 0,
      substatLeafCount: 0,
      candidateCountFromGuardedRows: 0,
    },
    identityBoundary: {
      candidateIdentitySetSha256: null,
      candidateProvenanceSetSha256: null,
      branchGroupSetSha256: null,
      withheldGuardedDomainSha256: null,
      aggregateCompositionSha256: null,
      requestFactExcludedFromCandidateIdentity: true,
      sourceRankExcludedFromTechnicalIdentity: true,
    },
    summary: {
      branchGroupCount: 0,
      rankedFiveStarBranchGroupCount: 0,
      unrankedFourStarBranchGroupCount: 0,
      partialCandidateCount: 0,
      provenanceBindingCount: 0,
      uniqueWeaponCount: 0,
      completeCandidateCount: 0,
      assembledBuildCount: 0,
      guideFactoryRecommendationCount: 0,
      sourcePublishedWholeCandidateCount: 0,
      derivedRankCount: 0,
      presentAxisCountPerCandidate: 4,
      missingAxisCountPerCandidate: 2,
    },
    ...CAPABILITIES,
    crossAxisCompositionExecuted: false,
    branchEnumerationExecuted: false,
    boundedCartesianEnumerationExecuted: false,
    partialCandidateGenerationExecuted: false,
    partialCandidateConstructionExecuted: false,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    issues: [
      {
        code: "xiao-ffxx-non-er-branch.not-comparable",
        path: "inputs",
        message: input.message,
      },
    ],
  };
}

function requiredGeneratedFrom(
  generatedFrom: readonly GeneratedFromEntry[],
  inputPath: string,
): GeneratedFromEntry {
  const entry = generatedFrom.find(({ path: candidatePath }) =>
    candidatePath === inputPath,
  );
  if (!entry) throw new Error(`Missing generated-from entry ${inputPath}.`);
  return { ...entry };
}

function requiredSourceText(
  byPath: ReadonlyMap<string, string>,
  inputPath: string,
): string {
  const text = byPath.get(inputPath);
  if (text == null) throw new Error(`Missing source bytes ${inputPath}.`);
  return text;
}

function normalizePath(inputPath: string): string {
  return inputPath.replaceAll("\\", "/");
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}
