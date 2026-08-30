import { sha256Text, stableJson } from "./io";
import type { KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport } from "./keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import {
  authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope,
  compactKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAudit,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS as EXPECTED_PRESET_ASSOCIATIONS,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_KQM_CLAIM_IDS as EXPECTED_KQM_CLAIM_IDS,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_KQM_STAT_RECORD_IDS as KQM_STAT_RECORD_IDS,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_PRESET_CHARACTER_IDS as EXACT_ROSTER,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION,
  requireKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope,
  type AuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope,
  type CompactKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAudit,
} from "./keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsScope";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import {
  type GenshinToolsPresetSnapshot,
  type KnowledgeRecord,
  type KnowledgeRepository,
} from "./schemas";

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SEMANTIC_INPUT_PATHS = [
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-candidate-lattice.json",
  "scripts/guide-factory/data/knowledge/repository.json",
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json",
  "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json",
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json",
] as const;

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_INPUT_PATHS = [
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets.ts",
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsScope.ts",
  "scripts/guide-factory/src/scopedSemanticDependency.ts",
] as const;

export const GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY = [
  "listed-condition-resolved",
  "listed-condition-withheld",
  "listed-baseline-context-unknown",
  "not-listed-nonexhaustive",
  "no-applicable-target",
] as const;

export type GeneratedSheetKnowledgeTargetComparison =
  (typeof GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY)[number];

const EXACT_TEAM_RECORD_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example" as const;
const PRESET_FILE =
  "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json" as const;
const FURINA_POST_ER_RECORD_ID =
  "kqm:character-guide:furina-post-er-substats-luna-ii" as const;

// This pins the exact source-specific projection. The self-digest also detects
// accidental corruption, but only this independent expectation authenticates
// the current target catalog content.
const EXPECTED_AUTHENTICATED_CONTENT_SHA256 =
  "3607aac1eceddbf22120a9cf838f21c6442647fa9fe54dbd0459aa1ca3199c48";

type Issue = { code: string; path: string; message: string };
type ArtifactChoice =
  | { type: "4pc"; setId: string }
  | { type: "2pc+2pc"; halfSetIds: [string, string] };
type CharacterGuide = Extract<KnowledgeRecord, { kind: "character_guide" }>;
type PresetBuild = GenshinToolsPresetSnapshot["characterGuides"][number]["builds"][number];

export type GeneratedSheetTargetApplicability =
  | "baseline-team-applicability-unknown"
  | "exact-team-resolved"
  | "condition-withheld";

export type SourceAlternativeGroup = {
  sourceEntryIndex: number;
  statIds: string[];
  rawSourceValue: number;
};

export type SourceSubstatBand = {
  sourceBandIndex: number;
  sourceEntryIndexes: number[];
  statIds: string[];
  rawSourceValue: number;
};

export type DeferredEnergyEntry = {
  field: "sands" | "goblet" | "circlet" | "substats";
  sourceEntryIndex: number;
  statId: "er";
  rawSourceValue: number;
  omission: "energy-recovery-deferred";
};

type TargetSource = {
  sourceId: "genshintools-presets" | "kqm";
  repositoryRecordId: string;
  repositoryRecordSha256: string;
  sourceRecordId: string;
  sourceReferenceSha256: string;
};

export type PresetBuildKnowledgeTarget = {
  kind: "preset-build";
  targetId: string;
  characterId: (typeof EXACT_ROSTER)[number];
  applicability: "baseline-team-applicability-unknown";
  source: TargetSource & { sourceId: "genshintools-presets" };
  sourceAuthority: {
    kind: "internal-baseline-adapter";
    repositoryStatus: "baseline";
    adapterRecordFormat: "genshintools-presets-v1";
  };
  buildId: string;
  buildPayloadSha256: string;
  activeArtifactOccurrenceId: string;
  associationKind: "artifact-identity-overlap-only";
  artifact: ArtifactChoice;
  visible: boolean;
  minConstellation: number | null;
  styles: string[];
  roles: string[];
  mainStats: {
    sands: SourceAlternativeGroup[];
    goblet: SourceAlternativeGroup[];
    circlet: SourceAlternativeGroup[];
  };
  substatBands: SourceSubstatBand[];
  deferredEnergyEntries: DeferredEnergyEntry[];
  sourceNumericValuesInterpretedAsScalarWeights: false;
  sourceOrderInterpretedAsRank: false;
  exactTeamApplicabilityClaimed: false;
};

export type KqmStatClaimKnowledgeTarget = {
  kind: "kqm-stat-claim";
  targetId: string;
  characterId: "keqing";
  applicability: "exact-team-resolved" | "condition-withheld";
  source: TargetSource & {
    sourceId: "kqm";
    recommendationId: string;
    claimId: string;
    evidenceClaimSha256: string;
  };
  sourceReviewState: {
    kind: "external-agent-assisted-unreviewed-extraction";
    extractionMethod: "agent-assisted";
    reviewStatus: "unreviewed";
    repositoryStatus: "candidate";
    promotionEligible: false;
  };
  claim: {
    kind: "main-stat" | "substat";
    slot: "sands" | "goblet" | "circlet" | null;
    sourceEntryIndex: number;
    statIds: string[];
    sourceAuthoredPriority: number | null;
    sourceAuthoredTarget: string | null;
  };
  sourceConditions: string[];
  conditionResolution: {
    teamRecordId: typeof EXACT_TEAM_RECORD_ID;
    evidenceResolution:
      | "matched-by-exact-team-facts"
      | "withheld-unresolved-source-condition";
    authority: "authenticated-wrapper-exact-team-facts-only";
    acknowledgements: Array<{
      conditionIndex: number;
      predicateId: string | null;
      resolution:
        | "matched-by-exact-team-facts"
        | "not-matched-by-exact-team-facts"
        | "withheld-unresolved-source-condition";
      reason: string;
    }>;
  };
  sourcePriorityConvertedToScalarWeight: false;
  sourcePriorityConvertedToRank: false;
  gameplayApplicabilityClaimed: false;
};

export type GeneratedSheetKnowledgeTarget =
  | PresetBuildKnowledgeTarget
  | KqmStatClaimKnowledgeTarget;

export type BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput = {
  equipmentLatticeReport: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport;
  repository: KnowledgeRepository;
  genshinToolsSnapshot: GenshinToolsPresetSnapshot;
  liveBuildPreset: unknown;
  evidenceReport: KeqingLunarEquipmentEvidenceValidationReport;
};

export type KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport = {
  schemaVersion: 1;
  classification: "keqing-ineffa-furina-xilonen-generated-sheet-knowledge-targets";
  validationStatus: "authenticated-projection-only" | "not-authenticated";
  contentSha256: string;
  issues: Issue[];
  generatedFrom: Array<{ path: string; sha256: string }>;
  semanticScope: {
    authentication: "accepted" | "rejected";
    expectedManifestSha256: string;
    expectedScopeProjectionSha256: string;
    acceptedAudit: CompactKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAudit | null;
  };
  exactTeam: {
    teamRecordId: typeof EXACT_TEAM_RECORD_ID;
    characterIds: string[];
  };
  sourceBoundary: {
    selectedRepositoryRecordCount: number;
    selectedPresetGuideCount: number;
    selectedPresetSnapshotEnvelopeCount: number;
    selectedLiveBuildCount: number;
    selectedLiveCharacterBuildArrayCount: number;
    selectedEvidenceClaimCount: number;
    selectedEvidenceSourceBoundaryRecordCount: number;
    selectedEvidenceCapabilityCount: number;
    selectedCp36ActiveArtifactCount: number;
    exactParityCount: number;
    exactPresetAssociationCount: number;
    exactKqmClaimAssociationCount: number;
    exactAuthorityAndAssociationClosure: boolean;
  };
  projectionBoundary: {
    artifactRatingDbConsumed: false;
    presetBuildsLabelledBaselineTeamApplicabilityUnknown: true;
    kqmConditionsResolvedFromExactTeamFactsOnly: true;
    furinaPostErInterpretationExcluded: true;
    rawSourceValuesRetained: true;
    rawEnergyEntriesRetainedForProvenance: true;
    energyRecoveryValuesUsedForComparisonOrInterpretation: false;
    energyRecoveryRequirementComputed: false;
    sourceNumericValuesConvertedToScalarWeights: false;
    sourcePrioritiesOrBandsConvertedToRanks: false;
  };
  comparisonBoundary: {
    vocabulary: GeneratedSheetKnowledgeTargetComparison[];
    comparisonExecuted: false;
    comparisons: [];
  };
  targetProjectionExecuted: boolean;
  guideProduced: false;
  recommendationProduced: false;
  rankProduced: false;
  damageComputationExecuted: false;
  gameplayEvaluationExecuted: false;
  optimalityClaimed: false;
  energyRecoveryInputsConsumedForDeferralProvenance: true;
  energyRecoveryCapability: false;
  supportsGuideClaims: false;
  supportsRecommendationClaims: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsGameplayClaims: false;
  supportsOptimalityClaims: false;
  supportsEnergyRecoveryClaims: false;
  targets: GeneratedSheetKnowledgeTarget[];
  exclusions: {
    furinaPostErSubstats: {
      repositoryRecordId: typeof FURINA_POST_ER_RECORD_ID;
      repositoryRecordSha256: string;
      sourceRecordId: "furina-post-er-substats-luna-ii";
      recommendationId: "post-er-substat-priority";
      excludedSourceEntryIndexes: [0, 1];
      excludedConditionSha256: string;
      reason: "rotation-specific-energy-requirement-deferred";
    } | null;
  };
  summary: {
    targetCount: number;
    presetBuildTargetCount: number;
    kqmClaimTargetCount: number;
    exactTeamResolvedTargetCount: number;
    conditionWithheldTargetCount: number;
    baselineContextUnknownTargetCount: number;
    presetNonErSubstatBandCount: number;
    omittedPresetEnergyEntryCount: number;
    excludedFurinaPostErClaimCount: number;
  };
};

export function buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
  input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
): KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport {
  const issues: Issue[] = [];
  const scopeAuthentication =
    authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
      input,
    );
  let scopedInput: AuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope | null =
    null;
  if (scopeAuthentication.status === "accepted") {
    scopedInput =
      requireKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(input);
    authenticateScopedCapability(scopedInput, issues);
  } else {
    for (const issue of scopeAuthentication.issues) {
      addIssue(
        issues,
        `semantic_scope.${issue.code}`,
        issue.path,
        issue.message,
      );
    }
  }

  const presetTargets = scopedInput && issues.length === 0
    ? buildPresetTargets(scopedInput, issues)
    : [];
  const kqmTargets = scopedInput && issues.length === 0
    ? buildKqmTargets(scopedInput, issues)
    : [];
  const furinaPostEr = scopedInput && issues.length === 0
    ? buildFurinaPostErExclusion(scopedInput.repositoryRecords, issues)
    : null;
  const authenticated =
    scopedInput !== null &&
    issues.length === 0 &&
    presetTargets.length === EXPECTED_PRESET_ASSOCIATIONS.length &&
    kqmTargets.length === EXPECTED_KQM_CLAIM_IDS.length &&
    furinaPostEr !== null;
  const targets = authenticated ? [...presetTargets, ...kqmTargets] : [];

  const reportWithoutDigest: Omit<
    KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
    "contentSha256"
  > = {
    schemaVersion: 1,
    classification:
      "keqing-ineffa-furina-xilonen-generated-sheet-knowledge-targets",
    validationStatus: authenticated
      ? "authenticated-projection-only"
      : "not-authenticated",
    issues,
    // The builder receives parsed semantic carriers but no independently
    // authenticated source-file hashes. Data provenance lives exclusively in
    // the selected semantic-scope audit instead of laundering whole carriers.
    generatedFrom: [],
    semanticScope: {
      authentication: scopedInput ? "accepted" : "rejected",
      expectedManifestSha256:
        KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.manifestSha256,
      expectedScopeProjectionSha256:
        KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.scopeProjectionSha256,
      acceptedAudit: scopedInput
        ? compactKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAudit(
            scopedInput.audit,
          )
        : null,
    },
    exactTeam: {
      teamRecordId: EXACT_TEAM_RECORD_ID,
      characterIds: [...EXACT_ROSTER],
    },
    sourceBoundary: {
      selectedRepositoryRecordCount: scopedInput?.repositoryRecords.length ?? 0,
      selectedPresetGuideCount: scopedInput?.presetGuides.length ?? 0,
      selectedPresetSnapshotEnvelopeCount: scopedInput ? 1 : 0,
      selectedLiveBuildCount: scopedInput?.liveBuilds.length ?? 0,
      selectedLiveCharacterBuildArrayCount:
        scopedInput?.liveCharacterBuilds.length ?? 0,
      selectedEvidenceClaimCount: scopedInput?.evidence.claims.length ?? 0,
      selectedEvidenceSourceBoundaryRecordCount:
        scopedInput?.evidence.sourceBoundaries.length ?? 0,
      selectedEvidenceCapabilityCount: scopedInput ? 1 : 0,
      selectedCp36ActiveArtifactCount:
        scopedInput?.cp36ActiveArtifacts.length ?? 0,
      exactParityCount:
        scopedInput?.audit.parities.filter(({ status }) => status === "exact")
          .length ?? 0,
      exactPresetAssociationCount: authenticated ? presetTargets.length : 0,
      exactKqmClaimAssociationCount: authenticated ? kqmTargets.length : 0,
      exactAuthorityAndAssociationClosure: authenticated,
    },
    projectionBoundary: {
      artifactRatingDbConsumed: false,
      presetBuildsLabelledBaselineTeamApplicabilityUnknown: true,
      kqmConditionsResolvedFromExactTeamFactsOnly: true,
      furinaPostErInterpretationExcluded: true,
      rawSourceValuesRetained: true,
      rawEnergyEntriesRetainedForProvenance: true,
      energyRecoveryValuesUsedForComparisonOrInterpretation: false,
      energyRecoveryRequirementComputed: false,
      sourceNumericValuesConvertedToScalarWeights: false,
      sourcePrioritiesOrBandsConvertedToRanks: false,
    },
    comparisonBoundary: {
      vocabulary: [...GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY],
      comparisonExecuted: false,
      comparisons: [],
    },
    targetProjectionExecuted: authenticated,
    guideProduced: false,
    recommendationProduced: false,
    rankProduced: false,
    damageComputationExecuted: false,
    gameplayEvaluationExecuted: false,
    optimalityClaimed: false,
    energyRecoveryInputsConsumedForDeferralProvenance: true,
    energyRecoveryCapability: false,
    supportsGuideClaims: false,
    supportsRecommendationClaims: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsGameplayClaims: false,
    supportsOptimalityClaims: false,
    supportsEnergyRecoveryClaims: false,
    targets,
    exclusions: { furinaPostErSubstats: authenticated ? furinaPostEr : null },
    summary: summarizeTargets(targets, authenticated ? furinaPostEr : null),
  };
  return {
    ...reportWithoutDigest,
    contentSha256: hashPayload(reportWithoutDigest),
  };
}

export function computeKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsContentSha256(
  report: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
): string {
  const { contentSha256: _contentSha256, ...content } = report;
  return hashPayload(content);
}

export function requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
  report: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
): void {
  const targetIds = report.targets.map(({ targetId }) => targetId);
  const presetTargets = report.targets.filter(
    (target): target is PresetBuildKnowledgeTarget =>
      target.kind === "preset-build",
  );
  const kqmTargets = report.targets.filter(
    (target): target is KqmStatClaimKnowledgeTarget =>
      target.kind === "kqm-stat-claim",
  );
  const statIds = report.targets.flatMap((target) =>
    target.kind === "preset-build"
      ? [
          ...target.mainStats.sands.flatMap(({ statIds }) => statIds),
          ...target.mainStats.goblet.flatMap(({ statIds }) => statIds),
          ...target.mainStats.circlet.flatMap(({ statIds }) => statIds),
          ...target.substatBands.flatMap(({ statIds }) => statIds),
        ]
      : target.claim.statIds,
  );
  const semanticClosure =
    report.validationStatus === "authenticated-projection-only" &&
    report.issues.length === 0 &&
    report.targetProjectionExecuted &&
    !report.guideProduced &&
    !report.recommendationProduced &&
    !report.rankProduced &&
    !report.damageComputationExecuted &&
    !report.gameplayEvaluationExecuted &&
    !report.optimalityClaimed &&
    report.energyRecoveryInputsConsumedForDeferralProvenance &&
    !report.energyRecoveryCapability &&
    !report.supportsGuideClaims &&
    !report.supportsRecommendationClaims &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsGameplayClaims &&
    !report.supportsOptimalityClaims &&
    !report.supportsEnergyRecoveryClaims &&
    report.generatedFrom.length === 0 &&
    report.semanticScope.authentication === "accepted" &&
    report.semanticScope.expectedManifestSha256 ===
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.manifestSha256 &&
    report.semanticScope.expectedScopeProjectionSha256 ===
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.scopeProjectionSha256 &&
    report.semanticScope.acceptedAudit?.scopeId ===
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.scopeId &&
    report.semanticScope.acceptedAudit.manifestSha256 ===
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.manifestSha256 &&
    report.semanticScope.acceptedAudit.scopeProjectionSha256 ===
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.scopeProjectionSha256 &&
    exactEqual(
      report.semanticScope.acceptedAudit.dependencies.map(
        ({ selectedEntryCount }) => selectedEntryCount,
      ),
      [7, 12, 4, 1, 5, 5, 4, 12, 2, 1, 5],
    ) &&
    report.semanticScope.acceptedAudit.paritySummary.parityCount === 26 &&
    report.semanticScope.acceptedAudit.paritySummary.exactParityCount === 26 &&
    exactEqual(report.exactTeam.characterIds, EXACT_ROSTER) &&
    report.exactTeam.teamRecordId === EXACT_TEAM_RECORD_ID &&
    report.sourceBoundary.exactAuthorityAndAssociationClosure &&
    report.sourceBoundary.selectedRepositoryRecordCount === 7 &&
    report.sourceBoundary.selectedPresetGuideCount === 4 &&
    report.sourceBoundary.selectedPresetSnapshotEnvelopeCount === 1 &&
    report.sourceBoundary.selectedLiveBuildCount === 5 &&
    report.sourceBoundary.selectedLiveCharacterBuildArrayCount === 4 &&
    report.sourceBoundary.selectedEvidenceClaimCount === 12 &&
    report.sourceBoundary.selectedEvidenceSourceBoundaryRecordCount === 2 &&
    report.sourceBoundary.selectedEvidenceCapabilityCount === 1 &&
    report.sourceBoundary.selectedCp36ActiveArtifactCount === 5 &&
    report.sourceBoundary.exactParityCount === 26 &&
    report.sourceBoundary.exactPresetAssociationCount === 5 &&
    report.sourceBoundary.exactKqmClaimAssociationCount === 12 &&
    !report.projectionBoundary.artifactRatingDbConsumed &&
    report.projectionBoundary.presetBuildsLabelledBaselineTeamApplicabilityUnknown &&
    report.projectionBoundary.kqmConditionsResolvedFromExactTeamFactsOnly &&
    report.projectionBoundary.furinaPostErInterpretationExcluded &&
    report.projectionBoundary.rawSourceValuesRetained &&
    report.projectionBoundary.rawEnergyEntriesRetainedForProvenance &&
    !report.projectionBoundary
      .energyRecoveryValuesUsedForComparisonOrInterpretation &&
    !report.projectionBoundary.energyRecoveryRequirementComputed &&
    !report.projectionBoundary.sourceNumericValuesConvertedToScalarWeights &&
    !report.projectionBoundary.sourcePrioritiesOrBandsConvertedToRanks &&
    exactEqual(
      report.comparisonBoundary.vocabulary,
      GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY,
    ) &&
    !report.comparisonBoundary.comparisonExecuted &&
    report.comparisonBoundary.comparisons.length === 0 &&
    targetIds.length === 17 &&
    new Set(targetIds).size === 17 &&
    presetTargets.length === 5 &&
    presetTargets.every(
      ({
        applicability,
        source,
        sourceAuthority,
        exactTeamApplicabilityClaimed,
      }) =>
        applicability === "baseline-team-applicability-unknown" &&
        source.sourceId === "genshintools-presets" &&
        sourceAuthority.kind === "internal-baseline-adapter" &&
        sourceAuthority.repositoryStatus === "baseline" &&
        sourceAuthority.adapterRecordFormat === "genshintools-presets-v1" &&
        !exactTeamApplicabilityClaimed,
    ) &&
    kqmTargets.length === 12 &&
    kqmTargets.every(
      ({ source, sourceReviewState, gameplayApplicabilityClaimed }) =>
        source.sourceId === "kqm" &&
        sourceReviewState.kind ===
          "external-agent-assisted-unreviewed-extraction" &&
        sourceReviewState.extractionMethod === "agent-assisted" &&
        sourceReviewState.reviewStatus === "unreviewed" &&
        sourceReviewState.repositoryStatus === "candidate" &&
        !sourceReviewState.promotionEligible &&
        !gameplayApplicabilityClaimed,
    ) &&
    statIds.every((statId) => statId !== "er") &&
    report.exclusions.furinaPostErSubstats?.excludedSourceEntryIndexes.length ===
      2 &&
    report.summary.targetCount === 17 &&
    report.summary.presetBuildTargetCount === 5 &&
    report.summary.kqmClaimTargetCount === 12 &&
    report.summary.exactTeamResolvedTargetCount === 9 &&
    report.summary.conditionWithheldTargetCount === 3 &&
    report.summary.baselineContextUnknownTargetCount === 5 &&
    report.summary.presetNonErSubstatBandCount === 9 &&
    report.summary.omittedPresetEnergyEntryCount === 5 &&
    report.summary.excludedFurinaPostErClaimCount === 2;
  const digestMatches =
    report.contentSha256 ===
      computeKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsContentSha256(
        report,
      ) && report.contentSha256 === EXPECTED_AUTHENTICATED_CONTENT_SHA256;
  if (!semanticClosure || !digestMatches) {
    throw new Error(
      "Refusing unauthenticated or mutated Keqing/Ineffa/Furina/Xilonen generated-sheet knowledge targets.",
    );
  }
}

function authenticateScopedCapability(
  input: AuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope,
  issues: Issue[],
): void {
  if (
    input.presetSnapshotEnvelope.schemaVersion !== 1 ||
    input.presetSnapshotEnvelope.sourceId !== "genshintools-presets"
  ) {
    addIssue(
      issues,
      "preset.snapshot_envelope_mismatch",
      "semanticScope.presetSnapshotEnvelope",
      "The selected preset guides are not bound to the expected GenshinTools snapshot schema and source identity.",
    );
  }
  const capability = input.evidence.capability;
  if (
    capability.validationStatus !== "comparable" ||
    capability.supportsGuideClaims ||
    capability.supportsEquipmentRecommendations ||
    capability.supportsStatRecommendations ||
    capability.supportsRankClaims ||
    capability.supportsConditionApplicabilityClaims ||
    capability.supportsDamageClaims ||
    capability.supportsEnergyRecoveryClaims ||
    capability.candidateGenerationInput ||
    capability.candidateGenerationExecuted ||
    capability.damageOrRankingComputationExecuted ||
    capability.energyRecoveryInputsUsed ||
    capability.sourceConditionSafety.mappingKind !==
      "wrapper-authored-exact-text-acknowledgement" ||
    !capability.sourceConditionSafety.rosterAndDeclaredReactionFactsOnly ||
    !capability.sourceConditionSafety.allSourceConditionsMappedExactly ||
    capability.sourceConditionSafety
      .unexpectedGameplayBuildOrRefinementResolutionCount !== 0
  ) {
    addIssue(
      issues,
      "evidence.capability_boundary_mismatch",
      "semanticScope.evidence.capability",
      "The selected evidence capability no longer remains comparable, non-generative, non-computational, and exact-condition-safe.",
    );
  }
}

function buildPresetTargets(
  input: AuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope,
  issues: Issue[],
): PresetBuildKnowledgeTarget[] {
  const targets: PresetBuildKnowledgeTarget[] = [];
  for (const association of EXPECTED_PRESET_ASSOCIATIONS) {
    const snapshotGuides = input.presetGuides.filter(
      ({ characterId }) => characterId === association.characterId,
    );
    const repositoryId = `genshintools-presets:character-guide:${association.characterId}`;
    const repositoryGuides = input.repositoryRecords.filter(
      ({ id }) => id === repositoryId,
    );
    const occurrence = input.cp36ActiveArtifacts.find(
      ({ occurrenceId }) => occurrenceId === association.occurrenceId,
    );
    const repositoryGuide = repositoryGuides[0];
    const selectedBuilds = input.presetBuilds.filter(
      ({ characterId, buildId }) =>
        characterId === association.characterId &&
        buildId === association.buildId,
    );
    const snapshotBuild = selectedBuilds[0]?.build;
    const liveBuilds = input.liveBuilds.filter(
      ({ characterId, buildId }) =>
        characterId === association.characterId &&
        buildId === association.buildId,
    );
    const liveCharacterBuildRows = input.liveCharacterBuilds.filter(
      ({ characterId }) => characterId === association.characterId,
    );
    const liveCharacterBuilds = liveCharacterBuildRows[0]?.buildIds;
    if (
      snapshotGuides.length !== 1 ||
      repositoryGuides.length !== 1 ||
      repositoryGuide?.kind !== "character_guide" ||
      selectedBuilds.length !== 1 ||
      !snapshotBuild ||
      liveBuilds.length !== 1 ||
      liveCharacterBuildRows.length !== 1 ||
      !liveCharacterBuilds ||
      liveCharacterBuilds.filter((id) => id === association.buildId).length !== 1 ||
      !occurrence
    ) {
      addIssue(
        issues,
        "preset.association_missing_or_duplicate",
        `presetTargets.${association.characterId}.${association.buildId}`,
        "The exact preset build, repository record, live build, or active artifact occurrence is missing or duplicated.",
      );
      continue;
    }
    const sourceRef = repositoryGuide.sourceRefs[0];
    if (
      repositoryGuide.status !== "baseline" ||
      repositoryGuide.characterId !== association.characterId ||
      sourceRef?.sourceId !== "genshintools-presets" ||
      sourceRef.sourceRecordId !== association.characterId ||
      !("file" in sourceRef.locator) ||
      sourceRef.locator.file !== PRESET_FILE ||
      sourceRef.locator.recordId !== association.characterId
    ) {
      addIssue(
        issues,
        "preset.source_authority_mismatch",
        `repository.records.${repositoryId}`,
        "The preset guide no longer has exact baseline GenshinTools source authority.",
      );
      continue;
    }
    targets.push(
      projectPresetTarget(
        association.characterId,
        association.buildId,
        association.occurrenceId,
        snapshotBuild,
        repositoryGuide,
      ),
    );
  }
  if (
    !exactEqual(
      targets.map(({ characterId, buildId, activeArtifactOccurrenceId }) => ({
        characterId,
        buildId,
        occurrenceId: activeArtifactOccurrenceId,
      })),
      EXPECTED_PRESET_ASSOCIATIONS,
    )
  ) {
    addIssue(
      issues,
      "preset.exact_association_closure_failed",
      "presetTargets",
      "The exact five preset build associations were not projected in source order.",
    );
  }
  return targets;
}

function projectPresetTarget(
  characterId: PresetBuildKnowledgeTarget["characterId"],
  buildId: string,
  occurrenceId: string,
  build: PresetBuild,
  repositoryGuide: CharacterGuide,
): PresetBuildKnowledgeTarget {
  const deferredEnergyEntries: DeferredEnergyEntry[] = [];
  const mainStats = {
    sands: projectAlternatives(build.sands, "sands", deferredEnergyEntries),
    goblet: projectAlternatives(build.goblet, "goblet", deferredEnergyEntries),
    circlet: projectAlternatives(
      build.circlet,
      "circlet",
      deferredEnergyEntries,
    ),
  };
  const substatBands = projectSubstatBands(
    build.substats,
    deferredEnergyEntries,
  );
  return {
    kind: "preset-build",
    targetId: `genshintools-presets:character-guide:${characterId}:build:${buildId}:generated-sheet-target`,
    characterId,
    applicability: "baseline-team-applicability-unknown",
    source: {
      sourceId: "genshintools-presets",
      repositoryRecordId: repositoryGuide.id,
      repositoryRecordSha256: hashPayload(repositoryGuide),
      sourceRecordId: characterId,
      sourceReferenceSha256: hashPayload(repositoryGuide.sourceRefs[0]),
    },
    sourceAuthority: {
      kind: "internal-baseline-adapter",
      repositoryStatus: "baseline",
      adapterRecordFormat: "genshintools-presets-v1",
    },
    buildId,
    buildPayloadSha256: hashPayload(build),
    activeArtifactOccurrenceId: occurrenceId,
    associationKind: "artifact-identity-overlap-only",
    artifact: structuredClone(build.artifact) as ArtifactChoice,
    visible: build.visible,
    minConstellation: build.minConstellation ?? null,
    styles: [...(build.styles ?? [])],
    roles: [...(build.roles ?? [])],
    mainStats,
    substatBands,
    deferredEnergyEntries,
    sourceNumericValuesInterpretedAsScalarWeights: false,
    sourceOrderInterpretedAsRank: false,
    exactTeamApplicabilityClaimed: false,
  };
}

function projectAlternatives(
  entries: Array<{ stat: string; weight: number }>,
  field: "sands" | "goblet" | "circlet",
  deferred: DeferredEnergyEntry[],
): SourceAlternativeGroup[] {
  return entries.flatMap(({ stat, weight }, sourceEntryIndex) => {
    if (stat === "er") {
      deferred.push({
        field,
        sourceEntryIndex,
        statId: "er",
        rawSourceValue: weight,
        omission: "energy-recovery-deferred",
      });
      return [];
    }
    return [{ sourceEntryIndex, statIds: [stat], rawSourceValue: weight }];
  });
}

function projectSubstatBands(
  entries: Array<{ stat: string; weight: number }>,
  deferred: DeferredEnergyEntry[],
): SourceSubstatBand[] {
  const bands: Array<{
    sourceValue: number;
    sourceEntryIndexes: number[];
    statIds: string[];
  }> = [];
  for (const [sourceEntryIndex, { stat, weight }] of entries.entries()) {
    if (stat === "er") {
      deferred.push({
        field: "substats",
        sourceEntryIndex,
        statId: "er",
        rawSourceValue: weight,
        omission: "energy-recovery-deferred",
      });
      continue;
    }
    const existing = bands.find(({ sourceValue }) => sourceValue === weight);
    if (existing) {
      existing.sourceEntryIndexes.push(sourceEntryIndex);
      existing.statIds.push(stat);
    } else {
      bands.push({
        sourceValue: weight,
        sourceEntryIndexes: [sourceEntryIndex],
        statIds: [stat],
      });
    }
  }
  return bands.map(
    ({ sourceValue, sourceEntryIndexes, statIds }, sourceBandIndex) => ({
      sourceBandIndex,
      sourceEntryIndexes,
      statIds,
      rawSourceValue: sourceValue,
    }),
  );
}

function buildKqmTargets(
  input: AuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope,
  issues: Issue[],
): KqmStatClaimKnowledgeTarget[] {
  const claims = input.evidence.claims.filter(
    ({ repositoryRecordId, sourceClaim }) =>
      KQM_STAT_RECORD_IDS.includes(repositoryRecordId as never) &&
      (sourceClaim.kind === "main-stat" || sourceClaim.kind === "substat"),
  );
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
  if (
    claims.length !== EXPECTED_KQM_CLAIM_IDS.length ||
    claimById.size !== EXPECTED_KQM_CLAIM_IDS.length ||
    !EXPECTED_KQM_CLAIM_IDS.every((claimId) => claimById.has(claimId))
  ) {
    addIssue(
      issues,
      "kqm.claim_identity_closure_failed",
      "evidenceReport.claims",
      "The exact twelve authenticated Keqing main-stat/substat claim identities are required.",
    );
    return [];
  }
  const targets: KqmStatClaimKnowledgeTarget[] = [];
  for (const claimId of EXPECTED_KQM_CLAIM_IDS) {
    const claim = claimById.get(claimId);
    if (!claim) continue;
    const repositoryRecords = input.repositoryRecords.filter(
      ({ id }) => id === claim.repositoryRecordId,
    );
    const repositoryRecord = repositoryRecords[0];
    const teamResolutions = claim.teamResolutions.filter(
      ({ teamRecordId }) => teamRecordId === EXACT_TEAM_RECORD_ID,
    );
    if (
      repositoryRecords.length !== 1 ||
      repositoryRecord?.kind !== "character_guide" ||
      teamResolutions.length !== 1
    ) {
      addIssue(
        issues,
        "kqm.claim_association_mismatch",
        `evidenceReport.claims.${claimId}`,
        "The KQM evidence claim does not exactly match one consolidated recommendation entry and one exact-team resolution.",
      );
      continue;
    }
    const sourceRef = repositoryRecord.sourceRefs[0];
    const sourceBoundaryRecords = input.evidence.sourceBoundaries.filter(
      (boundary) =>
        boundary.repositoryRecordId === repositoryRecord.id &&
        boundary.sourceRecordId === claim.sourceRecordId,
    );
    const sourceBoundaryRecord = sourceBoundaryRecords[0];
    if (
      repositoryRecord.status !== "candidate" ||
      repositoryRecord.promotionEligible !== false ||
      repositoryRecord.characterId !== "keqing" ||
      repositoryRecord.sourceRefs.length !== 1 ||
      sourceRef?.sourceId !== "kqm" ||
      sourceRef.sourceRecordId !== claim.sourceRecordId ||
      sourceBoundaryRecords.length !== 1 ||
      sourceBoundaryRecord?.extractionMethod !== "agent-assisted" ||
      sourceBoundaryRecord?.reviewStatus !== "unreviewed" ||
      !sourceBoundaryRecord?.manualPayloadMatchesExpectation ||
      !sourceBoundaryRecord?.repositoryPayloadMatchesExpectation ||
      !sourceBoundaryRecord?.repositoryRecommendationMatchesManual
    ) {
      addIssue(
        issues,
        "kqm.source_authority_mismatch",
        `repository.records.${repositoryRecord.id}`,
        "The Keqing claim does not retain candidate-only KQM source authority.",
      );
      continue;
    }
    const sourceClaim = claim.sourceClaim;
    if (sourceClaim.kind !== "main-stat" && sourceClaim.kind !== "substat") {
      continue;
    }
    const resolution = teamResolutions[0];
    if (
      resolution?.resolution !== "matched-by-exact-team-facts" &&
      resolution?.resolution !== "withheld-unresolved-source-condition"
    ) {
      addIssue(
        issues,
        "kqm.condition_resolution_not_projectable",
        `evidenceReport.claims.${claimId}.teamResolutions`,
        "Only exact-team resolved or condition-withheld stat claims are projectable.",
      );
      continue;
    }
    targets.push({
      kind: "kqm-stat-claim",
      targetId: `${claim.claimId}:generated-sheet-target`,
      characterId: "keqing",
      applicability:
        resolution.resolution === "matched-by-exact-team-facts"
          ? "exact-team-resolved"
          : "condition-withheld",
      source: {
        sourceId: "kqm",
        repositoryRecordId: repositoryRecord.id,
        repositoryRecordSha256: hashPayload(repositoryRecord),
        sourceRecordId: claim.sourceRecordId,
        sourceReferenceSha256: hashPayload(sourceRef),
        recommendationId: claim.recommendationId,
        claimId: claim.claimId,
        evidenceClaimSha256: hashPayload(claim),
      },
      sourceReviewState: {
        kind: "external-agent-assisted-unreviewed-extraction",
        extractionMethod: "agent-assisted",
        reviewStatus: "unreviewed",
        repositoryStatus: "candidate",
        promotionEligible: false,
      },
      claim: {
        kind: sourceClaim.kind,
        slot: sourceClaim.kind === "main-stat" ? sourceClaim.slot : null,
        sourceEntryIndex: sourceClaim.entryIndex,
        statIds: [...sourceClaim.statIds],
        sourceAuthoredPriority: sourceClaim.priority,
        sourceAuthoredTarget: sourceClaim.target,
      },
      sourceConditions: [...claim.sourceConditions],
      conditionResolution: {
        teamRecordId: EXACT_TEAM_RECORD_ID,
        evidenceResolution: resolution.resolution,
        authority: "authenticated-wrapper-exact-team-facts-only",
        acknowledgements: resolution.conditionAcknowledgements.map(
          ({ conditionIndex, predicateId, resolution, reason }) => ({
            conditionIndex,
            predicateId,
            resolution,
            reason,
          }),
        ),
      },
      sourcePriorityConvertedToScalarWeight: false,
      sourcePriorityConvertedToRank: false,
      gameplayApplicabilityClaimed: false,
    });
  }
  return targets;
}

function buildFurinaPostErExclusion(
  repositoryRecords: readonly KnowledgeRecord[],
  issues: Issue[],
): NonNullable<
  KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport["exclusions"]["furinaPostErSubstats"]
> | null {
  const records = repositoryRecords.filter(
    ({ id }) => id === FURINA_POST_ER_RECORD_ID,
  );
  const record = records[0];
  if (records.length !== 1 || record?.kind !== "character_guide") {
    addIssue(
      issues,
      "exclusion.furina_post_er_record_missing",
      `repository.records.${FURINA_POST_ER_RECORD_ID}`,
      "The exact Furina post-ER record must remain present once so its omission is explicit.",
    );
    return null;
  }
  const recommendations = record.recommendations?.filter(
    ({ id }) => id === "post-er-substat-priority",
  ) ?? [];
  const recommendation = recommendations[0];
  const conditions = recommendation?.substats?.map(({ conditions }) => conditions);
  const expectedConditions = [
    ["After meeting the rotation-specific ER requirement."],
    ["After meeting the rotation-specific ER requirement."],
  ];
  const sourceRef = record.sourceRefs[0];
  if (
    recommendations.length !== 1 ||
    recommendation?.substats?.length !== 2 ||
    !exactEqual(conditions, expectedConditions) ||
    record.status !== "candidate" ||
    record.promotionEligible !== false ||
    sourceRef?.sourceId !== "kqm" ||
    sourceRef.sourceRecordId !== "furina-post-er-substats-luna-ii"
  ) {
    addIssue(
      issues,
      "exclusion.furina_post_er_authority_mismatch",
      `repository.records.${FURINA_POST_ER_RECORD_ID}`,
      "The exact two post-ER substat entries or their KQM candidate authority drifted.",
    );
    return null;
  }
  return {
    repositoryRecordId: FURINA_POST_ER_RECORD_ID,
    repositoryRecordSha256: hashPayload(record),
    sourceRecordId: "furina-post-er-substats-luna-ii",
    recommendationId: "post-er-substat-priority",
    excludedSourceEntryIndexes: [0, 1],
    excludedConditionSha256: hashPayload(expectedConditions[0]),
    reason: "rotation-specific-energy-requirement-deferred",
  };
}

function summarizeTargets(
  targets: GeneratedSheetKnowledgeTarget[],
  exclusion: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport["exclusions"]["furinaPostErSubstats"],
): KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport["summary"] {
  const presetTargets = targets.filter(
    (target): target is PresetBuildKnowledgeTarget =>
      target.kind === "preset-build",
  );
  const kqmTargets = targets.filter(
    (target): target is KqmStatClaimKnowledgeTarget =>
      target.kind === "kqm-stat-claim",
  );
  return {
    targetCount: targets.length,
    presetBuildTargetCount: presetTargets.length,
    kqmClaimTargetCount: kqmTargets.length,
    exactTeamResolvedTargetCount: targets.filter(
      ({ applicability }) => applicability === "exact-team-resolved",
    ).length,
    conditionWithheldTargetCount: targets.filter(
      ({ applicability }) => applicability === "condition-withheld",
    ).length,
    baselineContextUnknownTargetCount: targets.filter(
      ({ applicability }) =>
        applicability === "baseline-team-applicability-unknown",
    ).length,
    presetNonErSubstatBandCount: presetTargets.reduce(
      (sum, { substatBands }) => sum + substatBands.length,
      0,
    ),
    omittedPresetEnergyEntryCount: presetTargets.reduce(
      (sum, { deferredEnergyEntries }) => sum + deferredEnergyEntries.length,
      0,
    ),
    excludedFurinaPostErClaimCount:
      exclusion?.excludedSourceEntryIndexes.length ?? 0,
  };
}

function hashPayload(value: unknown): string {
  return sha256Text(stableJson(value));
}

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function addIssue(
  issues: Issue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}
