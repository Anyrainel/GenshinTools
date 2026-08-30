import {
  ArtifactRatingModelSnapshotSchema,
  type ArtifactRatingModelSnapshot,
} from "./artifactRatingModel";
import type { KeqingIneffaTeamStatMarginalDiagnosticReport } from "./keqingIneffaTeamStatMarginalDiagnostic";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import {
  KnowledgeRecordSchema,
  ManualObservationRecordSchema,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
} from "./schemas";
import {
  authenticateScopedSemanticDependencies,
  defineScopedSemanticDependencyInput,
  deriveScopedSemanticDependencyCandidate,
  type ScopedSemanticDependencyAcceptedAudit,
  type ScopedSemanticDependencyAuthenticationInput,
  type ScopedSemanticDependencyAuthenticationResult,
  type ScopedSemanticDependencyCandidateDerivationResult,
  type ScopedSemanticDependencyManifest,
  type ScopedSemanticJsonValue,
} from "./scopedSemanticDependency";

const ARTIFACT_RATING_PATH =
  "scripts/guide-factory/data/source-snapshots/artifact-rating-db-keqing.json";
const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const RAW_KQM_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json";
const MARGINAL_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-team-stat-marginal-diagnostic.json";
const EQUIPMENT_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json";

const ARTIFACT_ENVELOPE_DEPENDENCY_ID = "artifact-rating-envelope";
const ARTIFACT_RECORD_DEPENDENCY_ID = "artifact-rating-avatar";
const REPOSITORY_DEPENDENCY_ID = "kqm-repository-records";
const RAW_KQM_DEPENDENCY_ID = "kqm-raw-default-stat-guide";
const MARGINAL_DEPENDENCY_ID = "keqing-marginal-selected-evidence";
const EQUIPMENT_CAPABILITY_DEPENDENCY_ID =
  "keqing-equipment-capability-boundary";
const EQUIPMENT_SOURCE_RECORD_DEPENDENCY_ID =
  "keqing-equipment-default-source-record";
const EQUIPMENT_TEAM_DEPENDENCY_ID = "keqing-equipment-exact-team";
const EQUIPMENT_MAIN_STAT_DEPENDENCY_ID =
  "keqing-equipment-default-main-stat-coverage";
const EQUIPMENT_CLAIM_DEPENDENCY_ID = "keqing-equipment-default-claims";

const ARTIFACT_ENVELOPE_KEY = "artifact-rating-db-keqing-envelope";
const ARTIFACT_AVATAR_ID = "10000042";
const MARGINAL_KEY = "keqing-four-endpoint-marginal";
const EQUIPMENT_CAPABILITY_KEY = "keqing-equipment-capabilities";

export const KEQING_ARTIFACT_RATING_KQM_SCOPE_GUIDE_ID =
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i";
export const KEQING_ARTIFACT_RATING_KQM_SCOPE_SOURCE_RECORD_ID =
  "keqing-lunar-charged-default-artifact-stats-luna-i";
export const KEQING_ARTIFACT_RATING_KQM_SCOPE_TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";

const DEFAULT_CLAIM_SUFFIXES = [
  "main-stat:sands:0",
  "main-stat:goblet:0",
  "main-stat:goblet:1",
  "main-stat:circlet:0",
  "main-stat:circlet:1",
  "substat:0",
  "substat:1",
  "substat:2",
] as const;

export const KEQING_ARTIFACT_RATING_KQM_SCOPE_CLAIM_IDS = Object.freeze(
  DEFAULT_CLAIM_SUFFIXES.map(
    (suffix) => `${KEQING_ARTIFACT_RATING_KQM_SCOPE_GUIDE_ID}:${suffix}`,
  ),
);

export const KEQING_ARTIFACT_RATING_KQM_SCOPE_EXPECTATION = Object.freeze({
  scopeId: "keqing-artifact-rating-kqm-marginal-validation-v1",
  manifestSha256:
    "d6e18e6301ad570896bb98e2459f05a5f14b51dbbe70527656540b74ed703791",
  scopeProjectionSha256:
    "cb7fbdee52519e41a450f031b956529b2f69ecf0cd6afd96baaf5e24d1a66e57",
} as const);

type ArtifactEnvelope = Omit<ArtifactRatingModelSnapshot, "records">;
type ScopedArtifactEnvelope = ArtifactEnvelope & {
  key: typeof ARTIFACT_ENVELOPE_KEY;
};
type ArtifactRecord = ArtifactRatingModelSnapshot["records"][number];
type KnowledgeGuide = Extract<KnowledgeRecord, { kind: "character_guide" }>;
type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;
type RawGuide = Extract<
  ManualObservationSnapshot["records"][number],
  { kind: "character_guide" }
>;

export type KeqingArtifactRatingKqmMarginalScopeInput = {
  artifactRatingSnapshot: ArtifactRatingModelSnapshot;
  repository: KnowledgeRepository;
  marginalReport: KeqingIneffaTeamStatMarginalDiagnosticReport;
  kqmRawSnapshot: ManualObservationSnapshot;
  kqmEquipmentReport: KeqingLunarEquipmentEvidenceValidationReport;
};

export type KeqingArtifactRatingKqmMarginalProjection = ReturnType<
  typeof projectMarginalReport
>;
export type KeqingArtifactRatingKqmEquipmentCapabilityProjection = ReturnType<
  typeof projectEquipmentCapabilityBoundary
>;
export type KeqingArtifactRatingKqmEquipmentClaimProjection = ReturnType<
  typeof projectEquipmentClaim
>;

export type AuthenticatedKeqingArtifactRatingKqmMarginalScope = {
  audit: ScopedSemanticDependencyAcceptedAudit;
  artifactRating: {
    envelope: ArtifactEnvelope;
    record: ArtifactRecord;
  };
  kqm: {
    guide: KnowledgeGuide;
    team: KnowledgeTeam;
    rawGuide: RawGuide;
  };
  marginal: KeqingArtifactRatingKqmMarginalProjection;
  equipment: {
    capabilityBoundary: KeqingArtifactRatingKqmEquipmentCapabilityProjection;
    sourceRecord: KeqingLunarEquipmentEvidenceValidationReport["sourceBoundary"]["records"][number];
    exactTeam: KeqingLunarEquipmentEvidenceValidationReport["publishedTeamBoundary"]["targets"][number];
    defaultMainStatCoverage: KeqingLunarEquipmentEvidenceValidationReport["baselineComparison"]["defaultMainStatCoverage"];
    claims: KeqingArtifactRatingKqmEquipmentClaimProjection[];
  };
};

export function deriveKeqingArtifactRatingKqmMarginalScopeCandidate(
  input: KeqingArtifactRatingKqmMarginalScopeInput,
): ScopedSemanticDependencyCandidateDerivationResult {
  const authenticationInput =
    buildKeqingArtifactRatingKqmMarginalScopeAuthenticationInput(input);
  return deriveScopedSemanticDependencyCandidate({
    manifest: authenticationInput.manifest,
    dependencies: authenticationInput.dependencies,
    parityAdapters: authenticationInput.parityAdapters,
  });
}

export function authenticateKeqingArtifactRatingKqmMarginalScope(
  input: KeqingArtifactRatingKqmMarginalScopeInput,
): ScopedSemanticDependencyAuthenticationResult {
  return authenticateScopedSemanticDependencies(
    buildKeqingArtifactRatingKqmMarginalScopeAuthenticationInput(input),
  );
}

export function requireKeqingArtifactRatingKqmMarginalScope(
  input: KeqingArtifactRatingKqmMarginalScopeInput,
): AuthenticatedKeqingArtifactRatingKqmMarginalScope {
  const result = authenticateKeqingArtifactRatingKqmMarginalScope(input);
  if (result.status !== "accepted") {
    throw new Error(
      `Keqing ArtifactRating/KQM marginal semantic scope authentication failed: ${result.issues
        .map(({ code, path }) => `${code} at ${path}`)
        .join("; ")}.`,
    );
  }

  const artifactEnvelopePayload = selectedPayload(
    result.selection,
    ARTIFACT_ENVELOPE_DEPENDENCY_ID,
    ARTIFACT_ENVELOPE_KEY,
  );
  const artifactRecordPayload = selectedPayload(
    result.selection,
    ARTIFACT_RECORD_DEPENDENCY_ID,
    ARTIFACT_AVATAR_ID,
  );
  const materializedEnvelope = structuredClone(
    artifactEnvelopePayload,
  ) as ScopedArtifactEnvelope;
  const { key: _scopeKey, ...envelope } = materializedEnvelope;
  const parsedArtifactSnapshot = ArtifactRatingModelSnapshotSchema.parse({
    ...envelope,
    records: [artifactRecordPayload],
  });

  const guide = KnowledgeRecordSchema.parse(
    selectedPayload(
      result.selection,
      REPOSITORY_DEPENDENCY_ID,
      KEQING_ARTIFACT_RATING_KQM_SCOPE_GUIDE_ID,
    ),
  );
  if (guide.kind !== "character_guide") {
    throw new Error("Authenticated CP35 guide payload changed kind.");
  }
  const team = KnowledgeRecordSchema.parse(
    selectedPayload(
      result.selection,
      REPOSITORY_DEPENDENCY_ID,
      KEQING_ARTIFACT_RATING_KQM_SCOPE_TEAM_ID,
    ),
  );
  if (team.kind !== "team") {
    throw new Error("Authenticated CP35 team payload changed kind.");
  }
  const rawGuide = ManualObservationRecordSchema.parse(
    selectedPayload(
      result.selection,
      RAW_KQM_DEPENDENCY_ID,
      KEQING_ARTIFACT_RATING_KQM_SCOPE_SOURCE_RECORD_ID,
    ),
  );
  if (rawGuide.kind !== "character_guide") {
    throw new Error("Authenticated CP35 raw guide payload changed kind.");
  }

  return {
    audit: result.audit,
    artifactRating: {
      envelope,
      record: parsedArtifactSnapshot.records[0],
    },
    kqm: { guide, team, rawGuide },
    marginal: structuredClone(
      selectedPayload(result.selection, MARGINAL_DEPENDENCY_ID, MARGINAL_KEY),
    ) as KeqingArtifactRatingKqmMarginalProjection,
    equipment: {
      capabilityBoundary: structuredClone(
        selectedPayload(
          result.selection,
          EQUIPMENT_CAPABILITY_DEPENDENCY_ID,
          EQUIPMENT_CAPABILITY_KEY,
        ),
      ) as KeqingArtifactRatingKqmEquipmentCapabilityProjection,
      sourceRecord: structuredClone(
        selectedPayload(
          result.selection,
          EQUIPMENT_SOURCE_RECORD_DEPENDENCY_ID,
          KEQING_ARTIFACT_RATING_KQM_SCOPE_SOURCE_RECORD_ID,
        ),
      ) as AuthenticatedKeqingArtifactRatingKqmMarginalScope["equipment"]["sourceRecord"],
      exactTeam: structuredClone(
        selectedPayload(
          result.selection,
          EQUIPMENT_TEAM_DEPENDENCY_ID,
          KEQING_ARTIFACT_RATING_KQM_SCOPE_TEAM_ID,
        ),
      ) as AuthenticatedKeqingArtifactRatingKqmMarginalScope["equipment"]["exactTeam"],
      defaultMainStatCoverage: structuredClone(
        selectedPayload(
          result.selection,
          EQUIPMENT_MAIN_STAT_DEPENDENCY_ID,
          KEQING_ARTIFACT_RATING_KQM_SCOPE_SOURCE_RECORD_ID,
        ),
      ) as unknown as AuthenticatedKeqingArtifactRatingKqmMarginalScope["equipment"]["defaultMainStatCoverage"],
      claims: KEQING_ARTIFACT_RATING_KQM_SCOPE_CLAIM_IDS.map(
        (claimId) =>
          structuredClone(
            selectedPayload(
              result.selection,
              EQUIPMENT_CLAIM_DEPENDENCY_ID,
              claimId,
            ),
          ) as KeqingArtifactRatingKqmEquipmentClaimProjection,
      ),
    },
  };
}

/** Exposed so adversarial tests can prove selector identity is pin-bound. */
export function buildKeqingArtifactRatingKqmMarginalScopeAuthenticationInput(
  input: KeqingArtifactRatingKqmMarginalScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  const artifactEnvelope: ScopedArtifactEnvelope = {
    key: ARTIFACT_ENVELOPE_KEY,
    schemaVersion: input.artifactRatingSnapshot.schemaVersion,
    format: input.artifactRatingSnapshot.format,
    sourceId: input.artifactRatingSnapshot.sourceId,
    capturedOn: input.artifactRatingSnapshot.capturedOn,
    sourcePolicy: input.artifactRatingSnapshot.sourcePolicy,
    upstream: input.artifactRatingSnapshot.upstream,
    lineage: input.artifactRatingSnapshot.lineage,
    semantics: input.artifactRatingSnapshot.semantics,
  };

  return {
    manifest: buildManifest(),
    dependencies: [
      defineScopedSemanticDependencyInput({
        dependencyId: ARTIFACT_ENVELOPE_DEPENDENCY_ID,
        containerPath: ARTIFACT_RATING_PATH,
        collectionPath: "/",
        keySchemaId: "cp35-artifact-envelope-key-v1",
        records: [artifactEnvelope],
        adapter: {
          projectionAdapterId: "cp35-artifact-envelope-v1",
          keyOf: ({ key }) => key,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: ARTIFACT_RECORD_DEPENDENCY_ID,
        containerPath: ARTIFACT_RATING_PATH,
        collectionPath: "/records",
        keySchemaId: "artifact-native-avatar-id-v1",
        records: input.artifactRatingSnapshot.records,
        adapter: {
          projectionAdapterId: "cp35-artifact-avatar-record-v1",
          keyOf: ({ nativeAvatarId }) => nativeAvatarId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: REPOSITORY_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: input.repository.records,
        adapter: {
          projectionAdapterId: "cp35-kqm-repository-record-v1",
          keyOf: ({ id }) => id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: RAW_KQM_DEPENDENCY_ID,
        containerPath: RAW_KQM_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        records: input.kqmRawSnapshot.records,
        adapter: {
          projectionAdapterId: "cp35-kqm-raw-default-guide-v1",
          keyOf: manualSourceRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: MARGINAL_DEPENDENCY_ID,
        containerPath: MARGINAL_REPORT_PATH,
        collectionPath: "/",
        keySchemaId: "cp35-marginal-boundary-key-v1",
        records: [input.marginalReport],
        adapter: {
          projectionAdapterId: "cp35-marginal-selected-evidence-v1",
          keyOf: () => MARGINAL_KEY,
          project: projectMarginalReport,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EQUIPMENT_CAPABILITY_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/",
        keySchemaId: "cp35-equipment-capability-key-v1",
        records: [input.kqmEquipmentReport],
        adapter: {
          projectionAdapterId: "cp35-equipment-capability-boundary-v1",
          keyOf: () => EQUIPMENT_CAPABILITY_KEY,
          project: projectEquipmentCapabilityBoundary,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EQUIPMENT_SOURCE_RECORD_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/sourceBoundary/records",
        keySchemaId: "equipment-source-record-id-v1",
        records: input.kqmEquipmentReport.sourceBoundary.records,
        adapter: {
          projectionAdapterId: "cp35-equipment-source-record-v1",
          keyOf: ({ sourceRecordId }) => sourceRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EQUIPMENT_TEAM_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/publishedTeamBoundary/targets",
        keySchemaId: "equipment-team-record-id-v1",
        records: input.kqmEquipmentReport.publishedTeamBoundary.targets,
        adapter: {
          projectionAdapterId: "cp35-equipment-exact-team-v1",
          keyOf: ({ teamRecordId }) => teamRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EQUIPMENT_MAIN_STAT_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/baselineComparison/defaultMainStatCoverage",
        keySchemaId: "equipment-main-stat-source-record-id-v1",
        records: [
          input.kqmEquipmentReport.baselineComparison.defaultMainStatCoverage,
        ],
        adapter: {
          projectionAdapterId: "cp35-equipment-main-stat-coverage-v1",
          keyOf: ({ sourceRecordId }) => sourceRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EQUIPMENT_CLAIM_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/claims",
        keySchemaId: "equipment-claim-id-v1",
        records: input.kqmEquipmentReport.claims,
        adapter: {
          projectionAdapterId: "cp35-equipment-default-claim-v1",
          keyOf: ({ claimId }) => claimId,
          project: projectEquipmentClaim,
        },
      }),
    ],
    parityAdapters: [
      {
        parityAdapterId: "cp35-raw-repository-recommendation-parity-v1",
        normalize: ({ dependencyId, payload }) =>
          recommendationParityValue(dependencyId, payload),
      },
    ],
    expectation: { ...KEQING_ARTIFACT_RATING_KQM_SCOPE_EXPECTATION },
  };
}

function buildManifest(): ScopedSemanticDependencyManifest {
  return {
    schemaVersion: 1,
    scopeId: KEQING_ARTIFACT_RATING_KQM_SCOPE_EXPECTATION.scopeId,
    selectorMode: "exact-key-manifest",
    dependencyOrderPolicy: "declared",
    requiredKeyOrderPolicy: "declared",
    parityOrderPolicy: "declared",
    dependencies: [
      {
        dependencyId: ARTIFACT_ENVELOPE_DEPENDENCY_ID,
        containerPath: ARTIFACT_RATING_PATH,
        collectionPath: "/",
        keySchemaId: "cp35-artifact-envelope-key-v1",
        projectionAdapterId: "cp35-artifact-envelope-v1",
        requiredKeys: [ARTIFACT_ENVELOPE_KEY],
      },
      {
        dependencyId: ARTIFACT_RECORD_DEPENDENCY_ID,
        containerPath: ARTIFACT_RATING_PATH,
        collectionPath: "/records",
        keySchemaId: "artifact-native-avatar-id-v1",
        projectionAdapterId: "cp35-artifact-avatar-record-v1",
        requiredKeys: [ARTIFACT_AVATAR_ID],
      },
      {
        dependencyId: REPOSITORY_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "cp35-kqm-repository-record-v1",
        requiredKeys: [
          KEQING_ARTIFACT_RATING_KQM_SCOPE_GUIDE_ID,
          KEQING_ARTIFACT_RATING_KQM_SCOPE_TEAM_ID,
        ],
      },
      {
        dependencyId: RAW_KQM_DEPENDENCY_ID,
        containerPath: RAW_KQM_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        projectionAdapterId: "cp35-kqm-raw-default-guide-v1",
        requiredKeys: [KEQING_ARTIFACT_RATING_KQM_SCOPE_SOURCE_RECORD_ID],
      },
      {
        dependencyId: MARGINAL_DEPENDENCY_ID,
        containerPath: MARGINAL_REPORT_PATH,
        collectionPath: "/",
        keySchemaId: "cp35-marginal-boundary-key-v1",
        projectionAdapterId: "cp35-marginal-selected-evidence-v1",
        requiredKeys: [MARGINAL_KEY],
      },
      {
        dependencyId: EQUIPMENT_CAPABILITY_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/",
        keySchemaId: "cp35-equipment-capability-key-v1",
        projectionAdapterId: "cp35-equipment-capability-boundary-v1",
        requiredKeys: [EQUIPMENT_CAPABILITY_KEY],
      },
      {
        dependencyId: EQUIPMENT_SOURCE_RECORD_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/sourceBoundary/records",
        keySchemaId: "equipment-source-record-id-v1",
        projectionAdapterId: "cp35-equipment-source-record-v1",
        requiredKeys: [KEQING_ARTIFACT_RATING_KQM_SCOPE_SOURCE_RECORD_ID],
      },
      {
        dependencyId: EQUIPMENT_TEAM_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/publishedTeamBoundary/targets",
        keySchemaId: "equipment-team-record-id-v1",
        projectionAdapterId: "cp35-equipment-exact-team-v1",
        requiredKeys: [KEQING_ARTIFACT_RATING_KQM_SCOPE_TEAM_ID],
      },
      {
        dependencyId: EQUIPMENT_MAIN_STAT_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/baselineComparison/defaultMainStatCoverage",
        keySchemaId: "equipment-main-stat-source-record-id-v1",
        projectionAdapterId: "cp35-equipment-main-stat-coverage-v1",
        requiredKeys: [KEQING_ARTIFACT_RATING_KQM_SCOPE_SOURCE_RECORD_ID],
      },
      {
        dependencyId: EQUIPMENT_CLAIM_DEPENDENCY_ID,
        containerPath: EQUIPMENT_REPORT_PATH,
        collectionPath: "/claims",
        keySchemaId: "equipment-claim-id-v1",
        projectionAdapterId: "cp35-equipment-default-claim-v1",
        requiredKeys: [...KEQING_ARTIFACT_RATING_KQM_SCOPE_CLAIM_IDS],
      },
    ],
    parities: [
      {
        parityId: "kqm-default-stat-recommendation:raw-repository",
        parityAdapterId: "cp35-raw-repository-recommendation-parity-v1",
        left: {
          dependencyId: RAW_KQM_DEPENDENCY_ID,
          key: KEQING_ARTIFACT_RATING_KQM_SCOPE_SOURCE_RECORD_ID,
        },
        right: {
          dependencyId: REPOSITORY_DEPENDENCY_ID,
          key: KEQING_ARTIFACT_RATING_KQM_SCOPE_GUIDE_ID,
        },
      },
    ],
  };
}

function projectMarginalReport(
  report: KeqingIneffaTeamStatMarginalDiagnosticReport,
) {
  const diagnostic = report.marginalDiagnostic;
  if (!diagnostic) {
    throw new Error("CP35 marginal report has no comparable diagnostic.");
  }
  if (!diagnostic.crossEndpointSummary) {
    throw new Error("CP35 marginal report has no cross-endpoint summary.");
  }
  const keqing = diagnostic.crossEndpointSummary.characters.filter(
    ({ characterId }) => characterId === "keqing",
  );
  if (keqing.length !== 1) {
    throw new Error(
      `CP35 marginal report expected one Keqing cross-endpoint result, found ${keqing.length}.`,
    );
  }
  return {
    capabilities: {
      supportsGuideClaims: report.supportsGuideClaims,
      supportsStatRecommendations: report.supportsStatRecommendations,
      supportsScalarStatWeights: report.supportsScalarStatWeights,
      supportsIdealStatAllocation: report.supportsIdealStatAllocation,
      supportsOptimalityClaims: report.supportsOptimalityClaims,
      supportsEnergyRequirements: report.supportsEnergyRequirements,
    },
    comparisonStatus: report.comparisonStatus,
    fixedCandidateId: report.fixedCandidate.candidateId,
    endpoints: report.capture.runs.map(
      ({ carryCharacterId, endpointId, outcome }) => ({
        carryCharacterId,
        endpointId,
        outcome,
      }),
    ),
    domainValidation: report.capture.domainValidation,
    objectiveProvenance: {
      sourceTeamRecordId:
        report.technicalObjectiveProvenance.sourceTeamRecordId,
      formulaLineCount: report.technicalObjectiveProvenance.formulaLineCount,
      reviewStatus: report.technicalObjectiveProvenance.reviewStatus,
      reactionLineCount:
        report.technicalObjectiveProvenance.reactionLineCount,
      explicitFormulaBuffOverrides:
        report.technicalObjectiveProvenance.explicitFormulaBuffOverrides,
      readiness: report.technicalObjectiveProvenance.readiness,
    },
    diagnostic: {
      comparisonStatus: diagnostic.comparisonStatus,
      diagnosticId: diagnostic.diagnosticId,
      execution: {
        endpointCount: diagnostic.execution.endpointCount,
        characterCountPerEndpoint:
          diagnostic.execution.characterCountPerEndpoint,
        statCountPerCharacter: diagnostic.execution.statCountPerCharacter,
        plannedReplayCount: diagnostic.execution.plannedReplayCount,
        observedReplayCount: diagnostic.execution.observedReplayCount,
        allPlannedReplaysObserved:
          diagnostic.execution.allPlannedReplaysObserved,
        energyRecoveryEvaluationsUsed:
          diagnostic.execution.energyRecoveryEvaluationsUsed,
      },
      statDomain: diagnostic.statDomain,
      technicalObjective: diagnostic.technicalObjective,
      keqingStats: keqing[0].stats,
    },
  };
}

function projectEquipmentCapabilityBoundary(
  report: KeqingLunarEquipmentEvidenceValidationReport,
) {
  return {
    validationStatus: report.validationStatus,
    supportsGuideClaims: report.supportsGuideClaims,
    supportsEquipmentRecommendations: report.supportsEquipmentRecommendations,
    supportsStatRecommendations: report.supportsStatRecommendations,
    supportsRankClaims: report.supportsRankClaims,
    supportsConditionApplicabilityClaims:
      report.supportsConditionApplicabilityClaims,
    supportsDamageClaims: report.supportsDamageClaims,
    supportsEnergyRecoveryClaims: report.supportsEnergyRecoveryClaims,
    candidateGenerationInput: report.candidateGenerationInput,
    candidateGenerationExecuted: report.candidateGenerationExecuted,
    damageOrRankingComputationExecuted:
      report.damageOrRankingComputationExecuted,
    energyRecoveryInputsUsed: report.energyRecoveryInputsUsed,
  };
}

function projectEquipmentClaim(
  claim: KeqingLunarEquipmentEvidenceValidationReport["claims"][number],
) {
  const teamResolutions = claim.teamResolutions.filter(
    ({ teamRecordId }) =>
      teamRecordId === KEQING_ARTIFACT_RATING_KQM_SCOPE_TEAM_ID,
  );
  if (teamResolutions.length !== 1) {
    throw new Error(
      `CP35 equipment claim ${claim.claimId} expected one exact-team resolution, found ${teamResolutions.length}.`,
    );
  }
  return {
    claimId: claim.claimId,
    sourceRecordId: claim.sourceRecordId,
    sourceClaim: claim.sourceClaim,
    sourceConditions: claim.sourceConditions,
    allSourceConditionsMappedExactly: claim.allSourceConditionsMappedExactly,
    teamResolution: teamResolutions[0],
  };
}

function recommendationParityValue(
  dependencyId: string,
  payload: ScopedSemanticJsonValue,
): unknown {
  if (!isJsonObject(payload)) {
    throw new Error("CP35 parity payload is not an object.");
  }
  if (dependencyId === RAW_KQM_DEPENDENCY_ID) {
    if (!("recommendation" in payload)) {
      throw new Error("CP35 raw KQM guide has no recommendation.");
    }
    return payload.recommendation;
  }
  if (dependencyId === REPOSITORY_DEPENDENCY_ID) {
    const recommendations = payload.recommendations;
    if (!Array.isArray(recommendations) || recommendations.length !== 1) {
      throw new Error(
        "CP35 repository KQM guide must contain exactly one recommendation.",
      );
    }
    return recommendations[0];
  }
  throw new Error(`Unexpected CP35 parity dependency ${dependencyId}.`);
}

function manualSourceRecordId(record: unknown): string {
  if (record == null || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("CP35 manual record is not an object.");
  }
  const sourceRecordId = (record as { sourceRecordId?: unknown })
    .sourceRecordId;
  if (typeof sourceRecordId !== "string" || sourceRecordId.length === 0) {
    throw new Error("CP35 manual record has no exact sourceRecordId.");
  }
  return sourceRecordId;
}

function selectedPayload(
  selection: {
    readonly dependencies: readonly {
      readonly dependencyId: string;
      readonly entries: readonly {
        readonly key: string;
        readonly payload: ScopedSemanticJsonValue;
      }[];
    }[];
  },
  dependencyId: string,
  key: string,
): ScopedSemanticJsonValue {
  const dependencies = selection.dependencies.filter(
    (candidate) => candidate.dependencyId === dependencyId,
  );
  if (dependencies.length !== 1) {
    throw new Error(
      `Authenticated CP35 scope expected one ${dependencyId} dependency, found ${dependencies.length}.`,
    );
  }
  const entries = dependencies[0].entries.filter(
    (candidate) => candidate.key === key,
  );
  if (entries.length !== 1) {
    throw new Error(
      `Authenticated CP35 scope expected one ${dependencyId}:${key} entry, found ${entries.length}.`,
    );
  }
  return entries[0].payload;
}

function isJsonObject(
  value: ScopedSemanticJsonValue,
): value is { readonly [key: string]: ScopedSemanticJsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
