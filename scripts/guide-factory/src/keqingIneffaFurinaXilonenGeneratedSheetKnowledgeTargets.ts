import { sha256Text, stableJson } from "./io";
import {
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  type KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
} from "./keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import {
  GenshinToolsPresetSnapshotSchema,
  KnowledgeRepositorySchema,
  type GenshinToolsPresetSnapshot,
  type KnowledgeRecord,
  type KnowledgeRepository,
} from "./schemas";

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_INPUT_PATHS = [
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-candidate-lattice.json",
  "scripts/guide-factory/data/knowledge/repository.json",
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json",
  "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json",
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json",
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
const EXACT_ROSTER = ["keqing", "ineffa", "furina", "xilonen"] as const;
const PRESET_FILE =
  "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json" as const;
const FURINA_POST_ER_RECORD_ID =
  "kqm:character-guide:furina-post-er-substats-luna-ii" as const;

const EXPECTED_PRESET_ASSOCIATIONS = [
  {
    characterId: "keqing",
    buildId: "1WswsAu",
    occurrenceId:
      "kqm:character-guide:keqing-lunar-charged-top-contributor-artifact-options-luna-i:artifact:0:0",
  },
  {
    characterId: "ineffa",
    buildId: "FeFiQU8",
    occurrenceId:
      "genshintools-presets:character-guide:ineffa:build:FeFiQU8",
  },
  {
    characterId: "furina",
    buildId: "BQAI0BO",
    occurrenceId:
      "genshintools-presets:character-guide:furina:build:BQAI0BO",
  },
  {
    characterId: "furina",
    buildId: "BQA4H1m",
    occurrenceId:
      "genshintools-presets:character-guide:furina:build:BQA4H1m",
  },
  {
    characterId: "xilonen",
    buildId: "Dbt0Wkm",
    occurrenceId:
      "genshintools-presets:character-guide:xilonen:build:Dbt0Wkm",
  },
] as const;

const KQM_STAT_RECORD_IDS = [
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
  "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i",
] as const;

const EXPECTED_KQM_CLAIM_IDS = [
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:sands:0",
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:goblet:0",
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:goblet:1",
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:circlet:0",
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:circlet:1",
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:substat:0",
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:substat:1",
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:substat:2",
  "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i:main-stat:sands:0",
  "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i:main-stat:goblet:0",
  "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i:main-stat:circlet:0",
  "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i:main-stat:circlet:1",
] as const;

// This pins the exact source-specific projection. The self-digest also detects
// accidental corruption, but only this independent expectation authenticates
// the current target catalog content.
const EXPECTED_AUTHENTICATED_CONTENT_SHA256 =
  "b35ba89aeec5f27033a49dc8487ec6911d45b8df9d0076af8e2af1183010fe99";

type Issue = { code: string; path: string; message: string };
type ArtifactChoice =
  | { type: "4pc"; setId: string }
  | { type: "2pc+2pc"; halfSetIds: [string, string] };
type CharacterGuide = Extract<KnowledgeRecord, { kind: "character_guide" }>;
type PresetBuild = GenshinToolsPresetSnapshot["characterGuides"][number]["builds"][number];
type EvidenceClaim = KeqingLunarEquipmentEvidenceValidationReport["claims"][number];

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
  exactTeam: {
    teamRecordId: typeof EXACT_TEAM_RECORD_ID;
    characterIds: string[];
    equipmentLatticeReportSha256: string;
  };
  sourceBoundary: {
    repositoryPayloadSha256: string;
    genshinToolsSnapshotPayloadSha256: string;
    liveBuildPresetPayloadSha256: string;
    evidenceReportPayloadSha256: string;
    upstreamPayloadHashesMatch: boolean;
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

type RawBuild = {
  id: string;
  name?: string;
  visible: boolean;
  minCons?: number;
  composition: "4pc" | "2pc+2pc";
  artifactSet?: string;
  halfSet1?: string;
  halfSet2?: string;
  styles?: string[];
  roles?: string[];
  sandsWeights: Array<{ stat: string; weight: number }>;
  gobletWeights: Array<{ stat: string; weight: number }>;
  circletWeights: Array<{ stat: string; weight: number }>;
  substats: Array<{ stat: string; weight: number }>;
};

type RawBuildPreset = {
  builds: Record<string, RawBuild>;
  characterBuilds: Record<string, string[]>;
  characterWeapons: Record<string, string[]>;
};

export function buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
  input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
): KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport {
  const issues: Issue[] = [];
  authenticateUpstream(input, issues);

  const presetTargets =
    issues.length === 0 ? buildPresetTargets(input, issues) : [];
  const kqmTargets = issues.length === 0 ? buildKqmTargets(input, issues) : [];
  const furinaPostEr =
    issues.length === 0 ? buildFurinaPostErExclusion(input.repository, issues) : null;
  const authenticated =
    issues.length === 0 &&
    presetTargets.length === EXPECTED_PRESET_ASSOCIATIONS.length &&
    kqmTargets.length === EXPECTED_KQM_CLAIM_IDS.length &&
    furinaPostEr !== null;
  const targets = authenticated ? [...presetTargets, ...kqmTargets] : [];
  const generatedFrom = authenticated
    ? [
        {
          path: KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_INPUT_PATHS[0],
          sha256: hashPayload(input.equipmentLatticeReport),
        },
        ...input.equipmentLatticeReport.generatedFrom.filter(({ path }) =>
          new Set<string>(
            KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_INPUT_PATHS.slice(
              1,
            ),
          ).has(path),
        ),
      ]
    : [];

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
    generatedFrom,
    exactTeam: {
      teamRecordId: EXACT_TEAM_RECORD_ID,
      characterIds: [...EXACT_ROSTER],
      equipmentLatticeReportSha256: hashPayload(input.equipmentLatticeReport),
    },
    sourceBoundary: {
      repositoryPayloadSha256: hashPayload(input.repository),
      genshinToolsSnapshotPayloadSha256: hashPayload(
        input.genshinToolsSnapshot,
      ),
      liveBuildPresetPayloadSha256: hashPayload(input.liveBuildPreset),
      evidenceReportPayloadSha256: hashPayload(input.evidenceReport),
      upstreamPayloadHashesMatch: authenticated,
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
    exactEqual(report.exactTeam.characterIds, EXACT_ROSTER) &&
    report.exactTeam.teamRecordId === EXACT_TEAM_RECORD_ID &&
    report.sourceBoundary.upstreamPayloadHashesMatch &&
    report.sourceBoundary.exactAuthorityAndAssociationClosure &&
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

function authenticateUpstream(
  input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
  issues: Issue[],
): void {
  try {
    requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
      input.equipmentLatticeReport,
    );
  } catch {
    addIssue(
      issues,
      "upstream.equipment_lattice_not_authenticated",
      "equipmentLatticeReport",
      "The CP36 equipment lattice failed its independent authentication guard.",
    );
  }
  const repositoryParsed = KnowledgeRepositorySchema.safeParse(input.repository);
  if (!repositoryParsed.success) {
    addIssue(
      issues,
      "upstream.repository_schema_invalid",
      "repository",
      "The consolidated knowledge repository does not match its schema.",
    );
  }
  const snapshotParsed = GenshinToolsPresetSnapshotSchema.safeParse(
    input.genshinToolsSnapshot,
  );
  if (!snapshotParsed.success) {
    addIssue(
      issues,
      "upstream.preset_snapshot_schema_invalid",
      "genshinToolsSnapshot",
      "The GenshinTools preset snapshot does not match its schema.",
    );
  }
  const expected = input.equipmentLatticeReport.inputBoundary.parsedPayloadSha256;
  for (const [key, value] of [
    ["repository", input.repository],
    ["genshinToolsSnapshot", input.genshinToolsSnapshot],
    ["liveBuildPreset", input.liveBuildPreset],
    ["evidenceReport", input.evidenceReport],
  ] as const) {
    if (hashPayload(value) !== expected[key]) {
      addIssue(
        issues,
        `upstream.${key}_payload_hash_mismatch`,
        key,
        `${key} does not match the payload authenticated by the CP36 lattice.`,
      );
    }
  }
  const exactRosterMatches = exactEqual(
    input.equipmentLatticeReport.requestBoundary.exactRoster,
    EXACT_ROSTER,
  );
  if (
    input.equipmentLatticeReport.requestBoundary.teamRecordId !==
      EXACT_TEAM_RECORD_ID ||
    !exactRosterMatches
  ) {
    addIssue(
      issues,
      "upstream.exact_team_mismatch",
      "equipmentLatticeReport.requestBoundary",
      "The authenticated source must retain the exact Keqing/Ineffa/Furina/Xilonen team.",
    );
  }
  authenticateDuplicateAndAuthorityBoundaries(input, issues);
}

function authenticateDuplicateAndAuthorityBoundaries(
  input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
  issues: Issue[],
): void {
  const requiredRecordIds = [
    ...EXACT_ROSTER.map(
      (characterId) => `genshintools-presets:character-guide:${characterId}`,
    ),
    ...KQM_STAT_RECORD_IDS,
    FURINA_POST_ER_RECORD_ID,
  ];
  for (const recordId of requiredRecordIds) {
    const occurrences = input.repository.records.filter(
      ({ id }) => id === recordId,
    );
    if (occurrences.length !== 1) {
      addIssue(
        issues,
        "repository.record_occurrence_count",
        `repository.records.${recordId}`,
        `Expected exactly one ${recordId} record; found ${occurrences.length}.`,
      );
      continue;
    }
    const record = occurrences[0];
    const expectedSourceId = recordId.startsWith("genshintools-presets:")
      ? "genshintools-presets"
      : "kqm";
    const expectedStatus = expectedSourceId === "genshintools-presets"
      ? "baseline"
      : "candidate";
    if (
      record?.kind !== "character_guide" ||
      record.status !== expectedStatus ||
      record.sourceRefs.length !== 1 ||
      record.sourceRefs[0]?.sourceId !== expectedSourceId ||
      (expectedSourceId === "kqm" && record.promotionEligible !== false)
    ) {
      addIssue(
        issues,
        "repository.record_authority_mismatch",
        `repository.records.${recordId}`,
        `${recordId} does not retain its expected source authority and review state.`,
      );
    }
  }
  for (const characterId of EXACT_ROSTER) {
    const guides = input.genshinToolsSnapshot.characterGuides.filter(
      (guide) => guide.characterId === characterId,
    );
    if (guides.length !== 1) {
      addIssue(
        issues,
        "preset_snapshot.guide_occurrence_count",
        `genshinToolsSnapshot.characterGuides.${characterId}`,
        `Expected exactly one ${characterId} preset guide; found ${guides.length}.`,
      );
    }
  }
  const claimIds = input.evidenceReport.claims.map(({ claimId }) => claimId);
  if (new Set(claimIds).size !== claimIds.length) {
    addIssue(
      issues,
      "evidence.duplicate_claim_id",
      "evidenceReport.claims",
      "The equipment evidence report contains duplicate claim identities.",
    );
  }
  for (const repositoryRecordId of KQM_STAT_RECORD_IDS) {
    const sourceRecordId = repositoryRecordId.replace(
      "kqm:character-guide:",
      "",
    );
    const boundaries = input.evidenceReport.sourceBoundary.records.filter(
      (boundary) =>
        boundary.repositoryRecordId === repositoryRecordId &&
        boundary.sourceRecordId === sourceRecordId,
    );
    const boundary = boundaries[0];
    if (
      boundaries.length !== 1 ||
      boundary?.extractionMethod !== "agent-assisted" ||
      boundary?.reviewStatus !== "unreviewed" ||
      !boundary?.manualPayloadMatchesExpectation ||
      !boundary?.repositoryPayloadMatchesExpectation ||
      !boundary?.repositoryRecommendationMatchesManual
    ) {
      addIssue(
        issues,
        "evidence.source_review_state_mismatch",
        `evidenceReport.sourceBoundary.records.${repositoryRecordId}`,
        "Each participating KQM record must retain its authenticated agent-assisted, unreviewed extraction state and source parity.",
      );
    }
  }
}

function buildPresetTargets(
  input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
  issues: Issue[],
): PresetBuildKnowledgeTarget[] {
  const livePreset = asRawBuildPreset(input.liveBuildPreset);
  if (!livePreset) {
    addIssue(
      issues,
      "live_preset.shape_invalid",
      "liveBuildPreset",
      "The live build preset does not expose builds, characterBuilds, and characterWeapons maps.",
    );
    return [];
  }
  const activeArtifacts = input.equipmentLatticeReport.inventoryBoundary.occurrences.filter(
    ({ status, equipmentKind }) =>
      status === "active-experiment-axis" && equipmentKind === "artifact",
  );
  const targets: PresetBuildKnowledgeTarget[] = [];
  for (const association of EXPECTED_PRESET_ASSOCIATIONS) {
    const snapshotGuides = input.genshinToolsSnapshot.characterGuides.filter(
      ({ characterId }) => characterId === association.characterId,
    );
    const repositoryId = `genshintools-presets:character-guide:${association.characterId}`;
    const repositoryGuides = input.repository.records.filter(
      ({ id }) => id === repositoryId,
    );
    const occurrence = activeArtifacts.find(
      ({ occurrenceId }) => occurrenceId === association.occurrenceId,
    );
    const snapshotGuide = snapshotGuides[0];
    const repositoryGuide = repositoryGuides[0];
    const snapshotBuilds = snapshotGuide?.builds.filter(
      ({ sourceRecordId }) => sourceRecordId === association.buildId,
    ) ?? [];
    const snapshotBuild = snapshotBuilds[0];
    const liveBuild = livePreset.builds[association.buildId];
    const liveCharacterBuilds = livePreset.characterBuilds[association.characterId];
    if (
      snapshotGuides.length !== 1 ||
      repositoryGuides.length !== 1 ||
      repositoryGuide?.kind !== "character_guide" ||
      snapshotBuilds.length !== 1 ||
      !snapshotBuild ||
      !liveBuild ||
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
    const normalizedLiveBuild = normalizeLiveBuild(liveBuild);
    if (
      !exactEqual(snapshotGuide.builds, repositoryGuide.builds) ||
      !exactEqual(snapshotBuild, normalizedLiveBuild) ||
      occurrence.characterId !== association.characterId ||
      occurrence.equipmentId !== artifactIdentity(snapshotBuild.artifact)
    ) {
      addIssue(
        issues,
        "preset.association_payload_mismatch",
        `presetTargets.${association.characterId}.${association.buildId}`,
        "Snapshot, repository, live preset, and CP36 artifact identity are not in exact parity.",
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
  input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
  issues: Issue[],
): KqmStatClaimKnowledgeTarget[] {
  const claims = input.evidenceReport.claims.filter(
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
    const repositoryRecords = input.repository.records.filter(
      ({ id }) => id === claim.repositoryRecordId,
    );
    const repositoryRecord = repositoryRecords[0];
    const teamResolutions = claim.teamResolutions.filter(
      ({ teamRecordId }) => teamRecordId === EXACT_TEAM_RECORD_ID,
    );
    if (
      repositoryRecords.length !== 1 ||
      repositoryRecord?.kind !== "character_guide" ||
      teamResolutions.length !== 1 ||
      !claimMatchesRepository(claim, repositoryRecord)
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
    const sourceBoundaryRecords = input.evidenceReport.sourceBoundary.records.filter(
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

function claimMatchesRepository(
  claim: EvidenceClaim,
  record: CharacterGuide,
): boolean {
  const recommendations = record.recommendations?.filter(
    ({ id }) => id === claim.recommendationId,
  ) ?? [];
  if (recommendations.length !== 1) return false;
  const recommendation = recommendations[0];
  const sourceClaim = claim.sourceClaim;
  if (!recommendation || sourceClaim.kind === "weapon" || sourceClaim.kind === "artifact") {
    return false;
  }
  const entry =
    sourceClaim.kind === "main-stat"
      ? recommendation.mainStats?.[sourceClaim.slot]?.[sourceClaim.entryIndex]
      : recommendation.substats?.[sourceClaim.entryIndex];
  if (!entry) return false;
  return exactEqual(
    {
      statIds: entry.statIds,
      priority: entry.priority ?? null,
      target: entry.target ?? null,
      conditions: entry.conditions,
    },
    {
      statIds: sourceClaim.statIds,
      priority: sourceClaim.priority,
      target: sourceClaim.target,
      conditions: claim.sourceConditions,
    },
  );
}

function buildFurinaPostErExclusion(
  repository: KnowledgeRepository,
  issues: Issue[],
): NonNullable<
  KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport["exclusions"]["furinaPostErSubstats"]
> | null {
  const records = repository.records.filter(
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

function normalizeLiveBuild(build: RawBuild): PresetBuild {
  return {
    sourceRecordId: build.id,
    visible: build.visible,
    ...(build.name ? { name: build.name } : {}),
    ...(build.minCons != null ? { minConstellation: build.minCons } : {}),
    artifact:
      build.composition === "4pc"
        ? { type: "4pc", setId: build.artifactSet ?? "" }
        : {
            type: "2pc+2pc",
            halfSetIds: [build.halfSet1 ?? "", build.halfSet2 ?? ""],
          },
    ...(build.styles?.length ? { styles: [...build.styles] } : {}),
    ...(build.roles?.length ? { roles: [...build.roles] } : {}),
    sands: structuredClone(build.sandsWeights),
    goblet: structuredClone(build.gobletWeights),
    circlet: structuredClone(build.circletWeights),
    substats: structuredClone(build.substats),
  };
}

function artifactIdentity(artifact: PresetBuild["artifact"]): string {
  return artifact.type === "4pc"
    ? `4pc:${artifact.setId}`
    : `2pc+2pc:${artifact.halfSetIds.join("+")}`;
}

function asRawBuildPreset(value: unknown): RawBuildPreset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Partial<RawBuildPreset>;
  if (
    !input.builds ||
    typeof input.builds !== "object" ||
    !input.characterBuilds ||
    typeof input.characterBuilds !== "object" ||
    !input.characterWeapons ||
    typeof input.characterWeapons !== "object"
  ) {
    return null;
  }
  return input as RawBuildPreset;
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
