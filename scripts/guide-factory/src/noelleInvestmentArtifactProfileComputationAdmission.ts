import path from "node:path";
import { sha256Text, stableJson } from "./io";
import {
  authenticateNoelleSourceLocalHighInvestmentSliceReport,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalHighInvestmentSliceInput,
  type NoelleSourceLocalHighInvestmentSliceReport,
} from "./noelleSourceLocalHighInvestmentSlice";
import {
  authenticateNoelleSourceLocalLowerInvestmentSliceReport,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalLowerInvestmentSliceInput,
  type NoelleSourceLocalLowerInvestmentSliceReport,
} from "./noelleSourceLocalLowerInvestmentSlice";
import { FACTORY_ROOT } from "./paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
} from "./schemas";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";

export const NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_ID =
  "noelle-investment-artifact-profile-computation-representation-admission-v1";
export const NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "noelle-investment-artifact-profile-computation-admission.json",
  );

export const NOELLE_HIGH_INVESTMENT_SLICE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-source-local-high-investment-slice.json";
export const NOELLE_LOWER_INVESTMENT_SLICE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-source-local-lower-investment-slice.json";
export const NOELLE_IMPLEMENTATION_RELATIVE_PATH =
  "src/lib/dmgcalc/impl/character4Mondstadt.ts";
export const NOELLE_DIRECT_DAMAGE_RELATIVE_PATH =
  "src/lib/dmgcalc/core/teamBuild.ts";
export const NOELLE_COMPILED_DAMAGE_RELATIVE_PATH =
  "src/lib/dmgcalc/core/formulaCompiler.ts";
export const NOELLE_REPLAY_ADAPTER_RELATIVE_PATH =
  "scripts/guide-factory/src/computationReplay.ts";
export const NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/noelleInvestmentArtifactProfileComputationAdmission.ts";
export const NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_CLI_RELATIVE_PATH =
  "scripts/guide-factory/src/assemble-noelle-investment-artifact-profile-computation-admission.ts";

export const NOELLE_MANUAL_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json";
const KNOWLEDGE_REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_INDEX_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const HIGH_SOURCE_RECORD_ID =
  "noelle-c6-or-talent-10-artifact-stats-luna-viii";
const LOWER_SOURCE_RECORD_ID =
  "noelle-c0-c5-talent-9-artifact-stats-luna-viii";
const HUSK_SOURCE_RECORD_ID = "noelle-general-husk-luna-viii";
const TEAM_SOURCE_RECORD_ID =
  "noelle-durin-nicole-xilonen-hexerei-example-luna-viii";

const JSON_INPUT_PATHS = {
  repositoryInput: KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
  manualSnapshotInput: NOELLE_MANUAL_SNAPSHOT_RELATIVE_PATH,
  manualIndexInput: MANUAL_INDEX_RELATIVE_PATH,
  sourceRegistryInput: SOURCE_REGISTRY_RELATIVE_PATH,
  highSliceReport: NOELLE_HIGH_INVESTMENT_SLICE_REPORT_RELATIVE_PATH,
  lowerSliceReport: NOELLE_LOWER_INVESTMENT_SLICE_REPORT_RELATIVE_PATH,
} as const;

const EXPECTED_INPUT_SHA256 = {
  highSliceReport:
    "dfa95115e98de29b1e09c363a23c7c2934ce8dce64e4ce49fe01694ec9a35fc5",
  lowerSliceReport:
    "4e9ce6dfa605f12af3660a63e842b9f79ce700870d985abfae0604d0c3540919",
  implementation:
    "62421a3ee438bdf7ec9958f9c0802accd91acd2a77f6317fbab56fb4a0b94ff9",
  directDamage:
    "0ad001a80494e76d4a0e1aa4af422145d534b6787191f8ec776d7d42c36a0e29",
  compiledDamage:
    "0bfca4750fdceda75df8080df977e1c2f6e942b46e14c037bb4928525233beb3",
  replayAdapter:
    "228a1eb55b329acbf46241583b38e2edd957050d705dc37f30c058360e4672ff",
  huskRecord:
    "84c6cabba79b2e1a5a8f25d741828ed7a4e9ab5bcf6256f8d1c24a79252cdb69",
  lowerRecord:
    "f4fc723a8ec91b332f0fc34a6563116b2db5f09227dbbe80c95595da257edadc",
  highRecord:
    "1726f0e51e50e502b2ae07038b8aec145e3b5b2cd20e989cf3b83618a7aa4ab0",
  teamRecord:
    "35c67b57276cafba29250e7416e8ab7efb3b49540b0609621e5a056e146ce9c7",
} as const;

export const NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS = [
  ...new Set([
    ...NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
    ...NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
    NOELLE_HIGH_INVESTMENT_SLICE_REPORT_RELATIVE_PATH,
    NOELLE_LOWER_INVESTMENT_SLICE_REPORT_RELATIVE_PATH,
    NOELLE_IMPLEMENTATION_RELATIVE_PATH,
    NOELLE_DIRECT_DAMAGE_RELATIVE_PATH,
    NOELLE_COMPILED_DAMAGE_RELATIVE_PATH,
    NOELLE_REPLAY_ADAPTER_RELATIVE_PATH,
    NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_CORE_RELATIVE_PATH,
    NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_CLI_RELATIVE_PATH,
  ]),
].sort(compareText);

export const NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS = [
  ...NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
];

export interface NoelleInvestmentArtifactProfileComputationAdmissionSourceFile {
  path: string;
  text: string;
}

export interface NoelleInvestmentArtifactProfileComputationAdmissionInput {
  highSliceReport: NoelleSourceLocalHighInvestmentSliceReport;
  highSliceInput: BuildNoelleSourceLocalHighInvestmentSliceInput;
  lowerSliceReport: NoelleSourceLocalLowerInvestmentSliceReport;
  lowerSliceInput: BuildNoelleSourceLocalLowerInvestmentSliceInput;
  implementationFile: {
    path: typeof NOELLE_IMPLEMENTATION_RELATIVE_PATH;
    text: string;
    sha256: string;
  };
  directDamageFile: {
    path: typeof NOELLE_DIRECT_DAMAGE_RELATIVE_PATH;
    text: string;
    sha256: string;
  };
  compiledDamageFile: {
    path: typeof NOELLE_COMPILED_DAMAGE_RELATIVE_PATH;
    text: string;
    sha256: string;
  };
  replayAdapterFile: {
    path: typeof NOELLE_REPLAY_ADAPTER_RELATIVE_PATH;
    text: string;
    sha256: string;
  };
  sourceFiles: readonly NoelleInvestmentArtifactProfileComputationAdmissionSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

type MainStatOption = {
  statIds: string[];
  sourceConditions: string[];
  conditionStatus:
    | "branch-condition-authenticated"
    | "additional-source-guard-unresolved";
};

type MainStatSlotProfile = {
  options: MainStatOption[];
  selectedOptionIndex: null;
};

export interface NoelleSourceBackedArtifactProfile {
  profileId: string;
  characterId: "noelle";
  status: "partial-source-backed-validation-target-not-build";
  sourceRecordId: string;
  sourceRecordSha256: string;
  sourceReviewStatus: "unreviewed";
  branch: {
    sourceCondition: string;
    requestPredicate: Record<string, unknown>;
    applicability: "typed-request-context-branch-authenticated";
    exhaustiveAcrossAllInvestmentStates: false;
  };
  artifactSet: {
    sourceRecordId: typeof HUSK_SOURCE_RECORD_ID;
    sourceRecordSha256: string;
    occurrenceId: string;
    conditionsSha256: string;
    set: { type: "4pc"; setId: "husk_of_opulent_dreams" };
    sourceConditions: [];
    sourceConditionSemantics: "source-condition-free-not-universal-applicability";
    sourceClassification: "default";
    upstreamSliceDisposition: "empty-unconditional";
    upstreamBindingAuthored: false;
    cp51CompositionStatus: "new-source-specific-profile-component";
    assignedToRuntimeBuild: false;
  };
  mainStats: {
    sands: MainStatSlotProfile;
    goblet: MainStatSlotProfile;
    circlet: MainStatSlotProfile;
  };
  substatPriority: {
    semantics: "source-partial-order-groups-not-scalar-weights";
    scope: "offensive-stats-only";
    groups: Array<{
      priority: number;
      statIds: string[];
      sourceConditions: string[];
      sourceOccurrence: {
        occurrenceId: string;
        conditionsSha256: string;
        upstreamSliceDisposition: "holdout";
        upstreamBindingAuthored: false;
        upstreamEnergyClassificationAuthored: false;
        cp51BindingStatus: "new-exact-source-specific-binding";
        bindingMethod: "cp51-exact-source-condition-allowlist";
      };
    }>;
    selectedAllocation: null;
    scalarWeights: null;
  };
  missingBoundaries: {
    weapon: "missing-not-zero";
    exactTeamNoelleWeaponRecommendationCount: 0;
    energyRecharge: "deferred-missing-not-zero";
    exactTeamNoelleErTargetCount: 0;
    formulaCounts: "missing-not-zero";
    sourceRecordsExplicitlyListFormulaCountsAsUnknown: true;
    enemyScenario: "missing-not-zero";
    completeArtifactAssignment: false;
    completeBuild: false;
  };
}

export interface NoelleInvestmentArtifactProfileComputationAdmissionReport {
  schemaVersion: 1;
  admissionId: typeof NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_ID;
  classification: "source-backed-artifact-profile-computation-representation-admission";
  validationStatus: "authenticated-representation-blocked";
  sourceProfilesComparedWithPinnedComputationRepresentation: true;
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsBuildRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  supportsIdealStatAllocation: false;
  artifactProfileCompositionExecuted: true;
  recommendationCompositionExecuted: false;
  candidateGenerationExecuted: false;
  generatorExecuted: false;
  autoTuneExecuted: false;
  teamCompositionExecuted: false;
  buildCompositionExecuted: false;
  artifactAssignmentExecuted: false;
  weaponAssignmentExecuted: false;
  optimizerExecuted: false;
  damageComputationExecuted: false;
  rotationReplayExecuted: false;
  energyRecoveryComputationExecuted: false;
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    highSliceReportPath: typeof NOELLE_HIGH_INVESTMENT_SLICE_REPORT_RELATIVE_PATH;
    lowerSliceReportPath: typeof NOELLE_LOWER_INVESTMENT_SLICE_REPORT_RELATIVE_PATH;
    manualSnapshotPath: typeof NOELLE_MANUAL_SNAPSHOT_RELATIVE_PATH;
    highSliceFreshAuthentication: "accepted";
    lowerSliceFreshAuthentication: "accepted";
    sliceAuthenticationRebuiltFromExactRawInputs: true;
    sharedManualSnapshotExact: true;
    sourceFileCount: number;
    generatedFromCount: number;
    authenticatedJsonInputParityCount: 6;
    exactPathClosureAuthenticated: true;
    everySourceFileHashBoundToGeneratedFrom: true;
    upstreamInputsBoundToOuterRawClosure: true;
    canonicalReportObjectSha256: {
      high: string;
      lower: string;
    };
    sourceRecordSha256: {
      husk: string;
      lower: string;
      high: string;
      team: string;
    };
    implementation: {
      path: typeof NOELLE_IMPLEMENTATION_RELATIVE_PATH;
      sha256: string;
      importedAtRuntime: false;
      inspectedAsPinnedTextOnly: true;
    };
    evaluationSemantics: {
      directDamagePath: typeof NOELLE_DIRECT_DAMAGE_RELATIVE_PATH;
      directDamageSha256: string;
      compiledDamagePath: typeof NOELLE_COMPILED_DAMAGE_RELATIVE_PATH;
      compiledDamageSha256: string;
      replayAdapterPath: typeof NOELLE_REPLAY_ADAPTER_RELATIVE_PATH;
      replayAdapterSha256: string;
      importedAtRuntime: false;
      inspectedAsPinnedTextOnly: true;
    };
    consolidatedRepositoryParity: {
      status: "exact";
      recordCount: 4;
      records: Array<{
        sourceRecordId: string;
        repositoryRecordId: string;
        kind: "character_guide" | "team";
        manualPayloadSha256: string;
        repositoryPayloadSha256: string;
        payloadParity: "exact";
        sourceRefParity: "exact";
        status: "candidate";
        promotionEligible: false;
      }>;
    };
  };
  profiles: NoelleSourceBackedArtifactProfile[];
  computationRepresentationAdmission: {
    sourceRotation: {
      sourceRecordId: typeof TEAM_SOURCE_RECORD_ID;
      rotationId: "sample-rotation-xilonen";
      notation: string;
      unresolvedSegments: [];
      noelleSegments: Array<{
        notation: "N3D" | "N2";
        sourceTokenOccurrenceCount: number;
        cancelToken: "D" | null;
        cancelTokenPreserved: boolean;
        requiredHitVectorPerOccurrence: {
          n1: number;
          n2: number;
          n3: number;
          n4: number;
        };
        formulaCountInferred: false;
      }>;
      requiredTotalHitVector: {
        n1: 5;
        n2: 5;
        n3: 3;
        n4: 0;
      };
    };
    calculatorObservation: {
      characterRegistration: "noelle";
      formulaId: "noelle-na";
      label: "Q Normal (4-hit)";
      representation: "inseparable-four-hit-aggregate";
      aggregateHitVectorPerCount: { n1: 1; n2: 1; n3: 1; n4: 1 };
      normalFormulaPartCount: 4;
      normalFormulaTalentParamIndexes: [1, 2, 3, 4];
      defaultComboDescriptor: [{ formulaId: "noelle-charge"; count: 3 }];
      replayLineSupportsPartSelection: false;
      directPathMultipliesWholeEntryByLineCount: true;
      compiledPathMultipliesWholeEntryByLineCount: true;
    };
    exactSegmentMapping: {
      n3d: "not-representable";
      n2: "not-representable";
      total: "not-representable";
      nonnegativeIntegerAggregateCountExists: false;
      proof: string;
    };
    admissionStatus: "rejected-exact-formula-representation-missing";
    numericReplayAdmitted: false;
    numericResult: null;
  };
  summary: {
    profileCount: 2;
    sourceArtifactSetCount: 1;
    sourceMainStatOptionCount: number;
    sourceSubstatPriorityGroupCount: 6;
    admittedReplayCount: 0;
    rejectedReplayCount: 1;
    numericResultCount: 0;
    candidateCount: 0;
    generatedTeamCount: 0;
    assembledBuildCount: 0;
    artifactAssignmentCount: 0;
    optimizerRunCount: 0;
  };
  cautions: string[];
  prohibitedInterpretations: string[];
}

export function buildNoelleInvestmentArtifactProfileComputationAdmissionReport(
  input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
): NoelleInvestmentArtifactProfileComputationAdmissionReport {
  const raw = authenticateOuterRawInputs(input);
  const highSliceReport =
    raw.parsedByKey.highSliceReport as NoelleSourceLocalHighInvestmentSliceReport;
  const lowerSliceReport =
    raw.parsedByKey.lowerSliceReport as NoelleSourceLocalLowerInvestmentSliceReport;
  const highSliceInput = buildBoundHighSliceInput(raw);
  const lowerSliceInput = buildBoundLowerSliceInput(raw);
  authenticateSuppliedInputBindings(input, {
    highSliceReport,
    highSliceInput,
    lowerSliceReport,
    lowerSliceInput,
  });
  const highAuthentication =
    authenticateNoelleSourceLocalHighInvestmentSliceReport(
      highSliceReport,
      highSliceInput,
    );
  if (!highAuthentication.authenticated) {
    throw new Error(
      `CP51 high-investment slice authentication failed: ${highAuthentication.reason}.`,
    );
  }
  const lowerAuthentication =
    authenticateNoelleSourceLocalLowerInvestmentSliceReport(
      lowerSliceReport,
      lowerSliceInput,
    );
  if (!lowerAuthentication.authenticated) {
    throw new Error(
      `CP51 lower-investment slice authentication failed: ${lowerAuthentication.reason}.`,
    );
  }

  authenticateExpectedHash(
    "high slice report",
    sha256Text(stableJson(highSliceReport)),
    EXPECTED_INPUT_SHA256.highSliceReport,
  );
  authenticateExpectedHash(
    "lower slice report",
    sha256Text(stableJson(lowerSliceReport)),
    EXPECTED_INPUT_SHA256.lowerSliceReport,
  );
  if (
    stableJson(highSliceInput.manualSnapshotInput) !==
    stableJson(lowerSliceInput.manualSnapshotInput)
  ) {
    throw new Error("CP51 Noelle slice inputs do not share one exact manual snapshot.");
  }

  authenticateRepresentationFiles(input);
  const snapshot = ManualObservationSnapshotSchema.parse(
    raw.parsedByKey.manualSnapshotInput,
  );
  const repository = KnowledgeRepositorySchema.parse(
    raw.parsedByKey.repositoryInput,
  );
  const huskRecord = requireSourceRecord(snapshot.records, HUSK_SOURCE_RECORD_ID);
  const lowerRecord = requireSourceRecord(snapshot.records, LOWER_SOURCE_RECORD_ID);
  const highRecord = requireSourceRecord(snapshot.records, HIGH_SOURCE_RECORD_ID);
  const teamRecord = requireSourceRecord(snapshot.records, TEAM_SOURCE_RECORD_ID);
  authenticateExpectedHash(
    "Husk source record",
    sha256Text(stableJson(huskRecord)),
    EXPECTED_INPUT_SHA256.huskRecord,
  );
  authenticateExpectedHash(
    "lower-investment source record",
    sha256Text(stableJson(lowerRecord)),
    EXPECTED_INPUT_SHA256.lowerRecord,
  );
  authenticateExpectedHash(
    "high-investment source record",
    sha256Text(stableJson(highRecord)),
    EXPECTED_INPUT_SHA256.highRecord,
  );
  authenticateExpectedHash(
    "team source record",
    sha256Text(stableJson(teamRecord)),
    EXPECTED_INPUT_SHA256.teamRecord,
  );
  const consolidatedRepositoryParity = authenticateConsolidatedRepositoryParity({
    repository,
    manualRecords: [huskRecord, lowerRecord, highRecord, teamRecord],
  });

  const profiles = buildProfiles({
    huskRecord,
    lowerRecord,
    highRecord,
    highSliceReport: highAuthentication.canonicalReport,
    lowerSliceReport: lowerAuthentication.canonicalReport,
  });
  const sourceRotation = authenticateSourceRotation(teamRecord);
  const sourceMainStatOptionCount = profiles.reduce(
    (sum, profile) =>
      sum +
      profile.mainStats.sands.options.length +
      profile.mainStats.goblet.options.length +
      profile.mainStats.circlet.options.length,
    0,
  );

  return {
    schemaVersion: 1,
    admissionId:
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_ID,
    classification:
      "source-backed-artifact-profile-computation-representation-admission",
    validationStatus: "authenticated-representation-blocked",
    sourceProfilesComparedWithPinnedComputationRepresentation: true,
    supportsSourceAuthorization: false,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsBuildRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsRotationClaims: false,
    supportsEnergyRecoveryClaims: false,
    supportsIdealStatAllocation: false,
    artifactProfileCompositionExecuted: true,
    recommendationCompositionExecuted: false,
    candidateGenerationExecuted: false,
    generatorExecuted: false,
    autoTuneExecuted: false,
    teamCompositionExecuted: false,
    buildCompositionExecuted: false,
    artifactAssignmentExecuted: false,
    weaponAssignmentExecuted: false,
    optimizerExecuted: false,
    damageComputationExecuted: false,
    rotationReplayExecuted: false,
    energyRecoveryComputationExecuted: false,
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      highSliceReportPath: NOELLE_HIGH_INVESTMENT_SLICE_REPORT_RELATIVE_PATH,
      lowerSliceReportPath: NOELLE_LOWER_INVESTMENT_SLICE_REPORT_RELATIVE_PATH,
      manualSnapshotPath: NOELLE_MANUAL_SNAPSHOT_RELATIVE_PATH,
      highSliceFreshAuthentication: "accepted",
      lowerSliceFreshAuthentication: "accepted",
      sliceAuthenticationRebuiltFromExactRawInputs: true,
      sharedManualSnapshotExact: true,
      sourceFileCount:
        NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS.length,
      generatedFromCount:
        NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS.length,
      authenticatedJsonInputParityCount: 6,
      exactPathClosureAuthenticated: true,
      everySourceFileHashBoundToGeneratedFrom: true,
      upstreamInputsBoundToOuterRawClosure: true,
      canonicalReportObjectSha256: {
        high: EXPECTED_INPUT_SHA256.highSliceReport,
        lower: EXPECTED_INPUT_SHA256.lowerSliceReport,
      },
      sourceRecordSha256: {
        husk: EXPECTED_INPUT_SHA256.huskRecord,
        lower: EXPECTED_INPUT_SHA256.lowerRecord,
        high: EXPECTED_INPUT_SHA256.highRecord,
        team: EXPECTED_INPUT_SHA256.teamRecord,
      },
      implementation: {
        path: NOELLE_IMPLEMENTATION_RELATIVE_PATH,
        sha256: EXPECTED_INPUT_SHA256.implementation,
        importedAtRuntime: false,
        inspectedAsPinnedTextOnly: true,
      },
      evaluationSemantics: {
        directDamagePath: NOELLE_DIRECT_DAMAGE_RELATIVE_PATH,
        directDamageSha256: EXPECTED_INPUT_SHA256.directDamage,
        compiledDamagePath: NOELLE_COMPILED_DAMAGE_RELATIVE_PATH,
        compiledDamageSha256: EXPECTED_INPUT_SHA256.compiledDamage,
        replayAdapterPath: NOELLE_REPLAY_ADAPTER_RELATIVE_PATH,
        replayAdapterSha256: EXPECTED_INPUT_SHA256.replayAdapter,
        importedAtRuntime: false,
        inspectedAsPinnedTextOnly: true,
      },
      consolidatedRepositoryParity,
    },
    profiles,
    computationRepresentationAdmission: {
      sourceRotation,
      calculatorObservation: {
        characterRegistration: "noelle",
        formulaId: "noelle-na",
        label: "Q Normal (4-hit)",
        representation: "inseparable-four-hit-aggregate",
        aggregateHitVectorPerCount: { n1: 1, n2: 1, n3: 1, n4: 1 },
        normalFormulaPartCount: 4,
        normalFormulaTalentParamIndexes: [1, 2, 3, 4],
        defaultComboDescriptor: [{ formulaId: "noelle-charge", count: 3 }],
        replayLineSupportsPartSelection: false,
        directPathMultipliesWholeEntryByLineCount: true,
        compiledPathMultipliesWholeEntryByLineCount: true,
      },
      exactSegmentMapping: {
        n3d: "not-representable",
        n2: "not-representable",
        total: "not-representable",
        nonnegativeIntegerAggregateCountExists: false,
        proof:
          "Each noelle-na count necessarily contributes one N4. The source target has zero N4 but nonzero N1/N2/N3, so no nonnegative integer aggregate count can reproduce either prefix segment or the total hit vector.",
      },
      admissionStatus: "rejected-exact-formula-representation-missing",
      numericReplayAdmitted: false,
      numericResult: null,
    },
    summary: {
      profileCount: 2,
      sourceArtifactSetCount: 1,
      sourceMainStatOptionCount,
      sourceSubstatPriorityGroupCount: 6,
      admittedReplayCount: 0,
      rejectedReplayCount: 1,
      numericResultCount: 0,
      candidateCount: 0,
      generatedTeamCount: 0,
      assembledBuildCount: 0,
      artifactAssignmentCount: 0,
      optimizerRunCount: 0,
    },
    cautions: [
      "Both source artifact-stat records and the source team record are agent-assisted and unreviewed; this checkpoint preserves them as validation targets only.",
      "The two investment predicates do not establish exhaustive coverage of every constellation and Burst Talent combination.",
      "Grouped CRIT main stats and substats are source option/priority groups, not a selected stat, scalar weight, or allocation.",
      "Conditional high-investment DEF% Goblet and Circlet options retain unresolved source guards and are never selected.",
      "The formula audit inspects pinned calculator source text without importing or executing the app damage runtime.",
    ],
    prohibitedInterpretations: [
      "Do not treat either partial profile as a complete build or player-facing recommendation.",
      "Do not infer a weapon, ER requirement, formula count, enemy scenario, artifact assignment, or ideal stat allocation.",
      "Do not treat source priority groups as numeric weights or as validated computed ordering.",
      "Do not approximate N3D or N2 with the four-hit aggregate and do not emit damage from the rejected replay.",
      "Do not infer team optimality, ranking, rotation correctness, or publication readiness.",
    ],
  };
}

export function authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport(
  serializedReport: NoelleInvestmentArtifactProfileComputationAdmissionReport,
  input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
): NoelleInvestmentArtifactProfileComputationAdmissionReport {
  const canonical =
    buildNoelleInvestmentArtifactProfileComputationAdmissionReport(input);
  if (stableJson(serializedReport) !== stableJson(canonical)) {
    throw new Error(
      "CP51 serialized report does not match a fresh canonical rebuild from authenticated inputs.",
    );
  }
  return canonical;
}

interface AuthenticatedOuterRawInput {
  generatedFrom: GeneratedFromEntry[];
  sourceTextByPath: Map<string, string>;
  parsedByKey: Record<keyof typeof JSON_INPUT_PATHS, unknown>;
}

function authenticateOuterRawInputs(
  input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
): AuthenticatedOuterRawInput {
  const expectedPaths = [
    ...NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
  ];
  const sourceFiles = [...input.sourceFiles].sort((left, right) =>
    compareText(left.path, right.path),
  );
  const generatedFrom = [...input.generatedFrom]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    stableJson(sourceFiles.map(({ path: sourcePath }) => sourcePath)) !==
      stableJson(expectedPaths) ||
    new Set(sourceFiles.map(({ path: sourcePath }) => sourcePath)).size !==
      expectedPaths.length
  ) {
    throw new Error("CP51 outer source-file path closure drifted.");
  }
  if (
    stableJson(generatedFrom.map(({ path: sourcePath }) => sourcePath)) !==
      stableJson(expectedPaths) ||
    new Set(generatedFrom.map(({ path: sourcePath }) => sourcePath)).size !==
      expectedPaths.length
  ) {
    throw new Error("CP51 outer generatedFrom path closure drifted.");
  }

  const generatedByPath = new Map(
    generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  const sourceTextByPath = new Map<string, string>();
  for (const sourceFile of sourceFiles) {
    if (typeof sourceFile.text !== "string") {
      throw new Error(`CP51 source ${sourceFile.path} is not UTF-8 text.`);
    }
    const generated = generatedByPath.get(sourceFile.path);
    if (
      !generated ||
      !/^[a-f0-9]{64}$/.test(generated.sha256) ||
      sha256Text(sourceFile.text) !== generated.sha256
    ) {
      throw new Error(`CP51 raw byte hash mismatch for ${sourceFile.path}.`);
    }
    sourceTextByPath.set(sourceFile.path, sourceFile.text);
  }

  const parsedByKey = {} as Record<keyof typeof JSON_INPUT_PATHS, unknown>;
  for (const [key, sourcePath] of Object.entries(JSON_INPUT_PATHS) as Array<
    [keyof typeof JSON_INPUT_PATHS, string]
  >) {
    const text = requiredSourceText(sourceTextByPath, sourcePath);
    try {
      parsedByKey[key] = JSON.parse(text) as unknown;
    } catch (error) {
      throw new Error(
        `CP51 JSON input ${sourcePath} could not be parsed: ${errorMessage(error)}.`,
      );
    }
  }
  return { generatedFrom, sourceTextByPath, parsedByKey };
}

function buildBoundHighSliceInput(
  raw: AuthenticatedOuterRawInput,
): BuildNoelleSourceLocalHighInvestmentSliceInput {
  return {
    repositoryInput: raw.parsedByKey.repositoryInput,
    manualSnapshotInput: raw.parsedByKey.manualSnapshotInput,
    manualIndexInput: raw.parsedByKey.manualIndexInput,
    sourceRegistryInput: raw.parsedByKey.sourceRegistryInput,
    sourceFiles: NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS.map(
      (sourcePath) => ({
        path: sourcePath,
        text: requiredSourceText(raw.sourceTextByPath, sourcePath),
      }),
    ),
    generatedFrom: subsetGeneratedFrom(
      raw.generatedFrom,
      NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
    ),
  };
}

function buildBoundLowerSliceInput(
  raw: AuthenticatedOuterRawInput,
): BuildNoelleSourceLocalLowerInvestmentSliceInput {
  return {
    repositoryInput: raw.parsedByKey.repositoryInput,
    manualSnapshotInput: raw.parsedByKey.manualSnapshotInput,
    manualIndexInput: raw.parsedByKey.manualIndexInput,
    sourceRegistryInput: raw.parsedByKey.sourceRegistryInput,
    sourceFiles: NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS.map(
      (sourcePath) => ({
        path: sourcePath,
        text: requiredSourceText(raw.sourceTextByPath, sourcePath),
      }),
    ),
    generatedFrom: subsetGeneratedFrom(
      raw.generatedFrom,
      NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
    ),
  };
}

function authenticateSuppliedInputBindings(
  input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
  canonical: {
    highSliceReport: NoelleSourceLocalHighInvestmentSliceReport;
    highSliceInput: BuildNoelleSourceLocalHighInvestmentSliceInput;
    lowerSliceReport: NoelleSourceLocalLowerInvestmentSliceReport;
    lowerSliceInput: BuildNoelleSourceLocalLowerInvestmentSliceInput;
  },
): void {
  if (
    stableJson(input.highSliceReport) !== stableJson(canonical.highSliceReport) ||
    stableJson(input.lowerSliceReport) !== stableJson(canonical.lowerSliceReport)
  ) {
    throw new Error("CP51 supplied slice report disagrees with outer raw bytes.");
  }
  authenticateSuppliedSliceInput(
    "high-investment",
    input.highSliceInput,
    canonical.highSliceInput,
  );
  authenticateSuppliedSliceInput(
    "lower-investment",
    input.lowerSliceInput,
    canonical.lowerSliceInput,
  );
  const rawTextByPath = new Map(
    input.sourceFiles.map((entry) => [entry.path, entry.text] as const),
  );
  const generatedByPath = new Map(
    input.generatedFrom.map((entry) => [entry.path, entry.sha256] as const),
  );
  for (const evidence of [
    input.implementationFile,
    input.directDamageFile,
    input.compiledDamageFile,
    input.replayAdapterFile,
  ]) {
    if (
      evidence.text !== rawTextByPath.get(evidence.path) ||
      evidence.sha256 !== generatedByPath.get(evidence.path)
    ) {
      throw new Error(
        `CP51 supplied representation evidence disagrees with outer raw closure for ${evidence.path}.`,
      );
    }
  }
}

function authenticateSuppliedSliceInput(
  label: string,
  supplied:
    | BuildNoelleSourceLocalHighInvestmentSliceInput
    | BuildNoelleSourceLocalLowerInvestmentSliceInput,
  canonical:
    | BuildNoelleSourceLocalHighInvestmentSliceInput
    | BuildNoelleSourceLocalLowerInvestmentSliceInput,
): void {
  for (const key of [
    "repositoryInput",
    "manualSnapshotInput",
    "manualIndexInput",
    "sourceRegistryInput",
  ] as const) {
    if (stableJson(supplied[key]) !== stableJson(canonical[key])) {
      throw new Error(`CP51 ${label} ${key} disagrees with outer raw bytes.`);
    }
  }
  const canonicalizeFiles = (
    files: readonly { path: string; text: string }[],
  ) =>
    [...files]
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path));
  const canonicalizeGenerated = (entries: readonly GeneratedFromEntry[]) =>
    [...entries]
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path));
  if (
    stableJson(canonicalizeFiles(supplied.sourceFiles)) !==
      stableJson(canonicalizeFiles(canonical.sourceFiles)) ||
    stableJson(canonicalizeGenerated(supplied.generatedFrom)) !==
      stableJson(canonicalizeGenerated(canonical.generatedFrom))
  ) {
    throw new Error(`CP51 ${label} raw closure disagrees with outer raw bytes.`);
  }
}

function subsetGeneratedFrom(
  generatedFrom: readonly GeneratedFromEntry[],
  paths: readonly string[],
): GeneratedFromEntry[] {
  const byPath = new Map(
    generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  return paths.map((sourcePath) => {
    const entry = byPath.get(sourcePath);
    if (!entry) throw new Error(`CP51 missing generatedFrom entry ${sourcePath}.`);
    return { ...entry };
  });
}

function requiredSourceText(
  sourceTextByPath: ReadonlyMap<string, string>,
  sourcePath: string,
): string {
  const text = sourceTextByPath.get(sourcePath);
  if (text == null) throw new Error(`CP51 missing source text ${sourcePath}.`);
  return text;
}

function authenticateConsolidatedRepositoryParity(input: {
  repository: { records: readonly unknown[] };
  manualRecords: readonly { sourceRecordId: string }[];
}): NoelleInvestmentArtifactProfileComputationAdmissionReport["rawInputBoundary"]["consolidatedRepositoryParity"] {
  const records = input.manualRecords.map((manualRecord) => {
    const manual = requireObject(manualRecord, manualRecord.sourceRecordId);
    const kind = requireString(manual.kind, `${manualRecord.sourceRecordId}.kind`);
    if (kind !== "character_guide" && kind !== "team") {
      throw new Error(
        `CP51 unsupported consolidated parity kind ${kind} for ${manualRecord.sourceRecordId}.`,
      );
    }
    const repositoryRecordId =
      kind === "team"
        ? `kqm:team:${manualRecord.sourceRecordId}`
        : `kqm:character-guide:${manualRecord.sourceRecordId}`;
    const matches = input.repository.records
      .map((record) => requireObject(record, "repository record"))
      .filter(({ id }) => id === repositoryRecordId);
    if (matches.length !== 1) {
      throw new Error(
        `CP51 expected one consolidated ${repositoryRecordId}, found ${matches.length}.`,
      );
    }
    const repository = matches[0]!;
    if (
      repository.kind !== kind ||
      repository.status !== "candidate" ||
      repository.promotionEligible !== false
    ) {
      throw new Error(
        `CP51 consolidated candidate boundary drifted for ${repositoryRecordId}.`,
      );
    }
    const supportingLocators = requireArray(
      manual.supportingLocators,
      `${manualRecord.sourceRecordId}.supportingLocators`,
    ).map((locator, index) =>
      requireObject(
        locator,
        `${manualRecord.sourceRecordId}.supportingLocators[${index}]`,
      ),
    );
    const expectedSourceRefs = [
      requireObject(manual.locator, `${manualRecord.sourceRecordId}.locator`),
      ...supportingLocators,
    ].map((locator) => ({
        sourceId: "kqm",
        sourceRecordId: manualRecord.sourceRecordId,
        locator,
      }));
    if (stableJson(repository.sourceRefs) !== stableJson(expectedSourceRefs)) {
      throw new Error(
        `CP51 consolidated source lineage drifted for ${repositoryRecordId}.`,
      );
    }
    const expectedUnknowns = [
      ...requireStringArray(
        manual.unknowns,
        `${manualRecord.sourceRecordId}.unknowns`,
      ),
      "agent-assisted extraction has not been human-reviewed",
    ];
    if (stableJson(repository.unknowns) !== stableJson(expectedUnknowns)) {
      throw new Error(
        `CP51 consolidated unknown boundary drifted for ${repositoryRecordId}.`,
      );
    }

    const { manualPayload, repositoryPayload } =
      kind === "character_guide"
        ? characterGuideParityPayloads(manual, repository, repositoryRecordId)
        : teamParityPayloads(manual, repository, repositoryRecordId);
    if (stableJson(manualPayload) !== stableJson(repositoryPayload)) {
      throw new Error(
        `CP51 consolidated payload disagrees with manual source for ${repositoryRecordId}.`,
      );
    }
    return {
      sourceRecordId: manualRecord.sourceRecordId,
      repositoryRecordId,
      kind: kind as "character_guide" | "team",
      manualPayloadSha256: sha256Text(stableJson(manualPayload)),
      repositoryPayloadSha256: sha256Text(stableJson(repositoryPayload)),
      payloadParity: "exact" as const,
      sourceRefParity: "exact" as const,
      status: "candidate" as const,
      promotionEligible: false as const,
    };
  });
  return {
    status: "exact",
    recordCount: 4,
    records,
  };
}

function characterGuideParityPayloads(
  manual: Record<string, unknown>,
  repository: Record<string, unknown>,
  repositoryRecordId: string,
): { manualPayload: unknown; repositoryPayload: unknown } {
  if (
    repository.characterId !== "noelle" ||
    stableJson(repository.builds) !== stableJson([])
  ) {
    throw new Error(
      `CP51 consolidated character-guide boundary drifted for ${repositoryRecordId}.`,
    );
  }
  const recommendations = requireArray(
    repository.recommendations,
    `${repositoryRecordId}.recommendations`,
  );
  if (recommendations.length !== 1) {
    throw new Error(
      `CP51 expected one consolidated recommendation for ${repositoryRecordId}.`,
    );
  }
  return {
    manualPayload: requireObject(manual.recommendation, "manual recommendation"),
    repositoryPayload: recommendations[0],
  };
}

function teamParityPayloads(
  manual: Record<string, unknown>,
  repository: Record<string, unknown>,
  repositoryRecordId: string,
): { manualPayload: unknown; repositoryPayload: unknown } {
  const manualMembers = requireArray(manual.members, "manual team members").map(
    (member, index) => {
      const item = requireObject(member, `manual team member ${index}`);
      for (const key of [
        "weaponRecommendations",
        "artifactRecommendations",
        "erTargets",
      ] as const) {
        if (stableJson(item[key]) !== stableJson([])) {
          throw new Error(
            `CP51 manual team ${key} is no longer explicitly empty for member ${index}.`,
          );
        }
      }
      return {
        characterId: requireString(item.characterId, `member ${index}.characterId`),
        investment: { status: "unspecified" },
        selectedArtifact: null,
        selectedWeapon: null,
      };
    },
  );
  const manualPayload = {
    label: manual.label,
    intent: manual.intent,
    exhaustiveness: manual.exhaustiveness,
    rankingClaim: manual.rankingClaim,
    members: manualMembers,
    rotations: manual.rotations,
    damagePlans: [],
  };
  const repositoryPayload = {
    label: repository.label,
    intent: repository.intent,
    exhaustiveness: repository.exhaustiveness,
    rankingClaim: repository.rankingClaim,
    members: repository.members,
    rotations: repository.rotations,
    damagePlans: repository.damagePlans,
  };
  if (
    stableJson(manualMembers.map(({ characterId }) => characterId)) !==
      stableJson(["noelle", "durin", "nicole", "xilonen"]) ||
    stableJson(repository.damagePlans) !== stableJson([])
  ) {
    throw new Error(`CP51 exact team boundary drifted for ${repositoryRecordId}.`);
  }
  return { manualPayload, repositoryPayload };
}

function authenticateExpectedHash(
  label: string,
  actual: string,
  expected: string,
): void {
  if (actual !== expected) {
    throw new Error(`CP51 ${label} hash drifted: expected ${expected}, got ${actual}.`);
  }
}

function authenticateRepresentationFiles(
  input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
): void {
  const file = input.implementationFile;
  if (file.path !== NOELLE_IMPLEMENTATION_RELATIVE_PATH) {
    throw new Error(`CP51 unexpected implementation path ${file.path}.`);
  }
  const actualSha256 = sha256Text(file.text);
  authenticateExpectedHash(
    "Noelle implementation bytes",
    actualSha256,
    EXPECTED_INPUT_SHA256.implementation,
  );
  authenticateExpectedHash(
    "declared Noelle implementation",
    file.sha256,
    EXPECTED_INPUT_SHA256.implementation,
  );
  const requiredFragments = [
    '@RegisterCharacter("noelle")',
    '"noelle-na": {',
    'en: "Q Normal (4-hit)"',
    'this.param("A", 1)',
    'this.param("A", 2)',
    'this.param("A", 3)',
    'this.param("A", 4)',
    'return [{ id: "noelle-charge", count: 3 }];',
  ];
  for (const fragment of requiredFragments) {
    if (!file.text.includes(fragment)) {
      throw new Error(`CP51 Noelle implementation omitted ${fragment}.`);
    }
  }
  if (countOccurrences(file.text, '"noelle-na": {') !== 1) {
    throw new Error("CP51 expected exactly one noelle-na formula definition.");
  }

  authenticatePinnedTextFile(
    input.directDamageFile,
    NOELLE_DIRECT_DAMAGE_RELATIVE_PATH,
    EXPECTED_INPUT_SHA256.directDamage,
    [
      "let total = result.totalDamage * line.count;",
      "total -= part.damage * part.hits * line.count;",
    ],
  );
  authenticatePinnedTextFile(
    input.compiledDamageFile,
    NOELLE_COMPILED_DAMAGE_RELATIVE_PATH,
    EXPECTED_INPUT_SHA256.compiledDamage,
    [
      "entry.parts,",
      "line.count,",
      "E.mul(E.add(...partExprs), E.const(line.count))",
    ],
  );
  authenticatePinnedTextFile(
    input.replayAdapterFile,
    NOELLE_REPLAY_ADAPTER_RELATIVE_PATH,
    EXPECTED_INPUT_SHA256.replayAdapter,
    [
      "formulaId: line.formulaId,",
      "count: line.count,",
      "forceOnField: line.forceOnField,",
    ],
  );
}

function authenticatePinnedTextFile(
  file: { path: string; text: string; sha256: string },
  expectedPath: string,
  expectedSha256: string,
  requiredFragments: readonly string[],
): void {
  if (file.path !== expectedPath) {
    throw new Error(`CP51 unexpected representation evidence path ${file.path}.`);
  }
  authenticateExpectedHash(
    `${expectedPath} bytes`,
    sha256Text(file.text),
    expectedSha256,
  );
  authenticateExpectedHash(
    `${expectedPath} declared hash`,
    file.sha256,
    expectedSha256,
  );
  for (const fragment of requiredFragments) {
    if (!file.text.includes(fragment)) {
      throw new Error(`CP51 ${expectedPath} omitted ${fragment}.`);
    }
  }
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function requireSourceRecord(
  records: readonly { sourceRecordId: string }[],
  sourceRecordId: string,
): (typeof records)[number] {
  const matches = records.filter((record) => record.sourceRecordId === sourceRecordId);
  if (matches.length !== 1) {
    throw new Error(
      `CP51 expected one ${sourceRecordId} source record, found ${matches.length}.`,
    );
  }
  return matches[0]!;
}

function buildProfiles(input: {
  huskRecord: { sourceRecordId: string };
  lowerRecord: { sourceRecordId: string };
  highRecord: { sourceRecordId: string };
  highSliceReport: NoelleSourceLocalHighInvestmentSliceReport;
  lowerSliceReport: NoelleSourceLocalLowerInvestmentSliceReport;
}): NoelleSourceBackedArtifactProfile[] {
  const huskRecommendation = readCharacterGuideRecommendation(input.huskRecord);
  const lowerRecommendation = readCharacterGuideRecommendation(input.lowerRecord);
  const highRecommendation = readCharacterGuideRecommendation(input.highRecord);
  authenticateHuskRecommendation(huskRecommendation);
  const huskOccurrence = input.highSliceReport.emptyOccurrences.find(
    ({ occurrenceId }) =>
      occurrenceId ===
      "kqm:character_guide:noelle-general-husk-luna-viii:recommendation.artifactRecommendations[0].conditions",
  );
  if (
    !huskOccurrence ||
    huskOccurrence.conditionsSha256 !==
      "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570" ||
    huskOccurrence.sliceDisposition !== "empty-unconditional" ||
    huskOccurrence.bindingAuthoredBySlice ||
    huskOccurrence.energyClassificationAuthoredBySlice
  ) {
    throw new Error("CP51 source-condition-free Husk occurrence boundary drifted.");
  }

  return [
    buildProfile(
      "noelle-lower-investment-artifact-profile-v1",
      input.lowerRecord.sourceRecordId,
      EXPECTED_INPUT_SHA256.lowerRecord,
      lowerRecommendation,
      input.lowerSliceReport,
      "Noelle is C0–C5 and her Burst Talent is Level 9.",
      {
        type: "all",
        predicates: [
          { type: "constellation-at-most", characterId: "noelle", threshold: 5 },
          {
            type: "talent-level-is",
            characterId: "noelle",
            talent: "burst",
            threshold: 9,
          },
        ],
      },
    ),
    buildProfile(
      "noelle-high-investment-artifact-profile-v1",
      input.highRecord.sourceRecordId,
      EXPECTED_INPUT_SHA256.highRecord,
      highRecommendation,
      input.highSliceReport,
      "Noelle is C6 or her Burst Talent is Level 10 or higher.",
      {
        type: "any",
        predicates: [
          { type: "constellation-at-least", characterId: "noelle", threshold: 6 },
          {
            type: "talent-level-at-least",
            characterId: "noelle",
            talent: "burst",
            threshold: 10,
          },
        ],
      },
    ),
  ].map((profile) => ({
    ...profile,
    artifactSet: {
      sourceRecordId: HUSK_SOURCE_RECORD_ID,
      sourceRecordSha256: EXPECTED_INPUT_SHA256.huskRecord,
      occurrenceId: huskOccurrence.occurrenceId,
      conditionsSha256: huskOccurrence.conditionsSha256,
      set: { type: "4pc", setId: "husk_of_opulent_dreams" },
      sourceConditions: [],
      sourceConditionSemantics:
        "source-condition-free-not-universal-applicability",
      sourceClassification: "default",
      upstreamSliceDisposition: "empty-unconditional",
      upstreamBindingAuthored: false,
      cp51CompositionStatus: "new-source-specific-profile-component",
      assignedToRuntimeBuild: false,
    },
  }));
}

function buildProfile(
  profileId: string,
  sourceRecordId: string,
  sourceRecordSha256: string,
  recommendation: Record<string, unknown>,
  sliceReport:
    | NoelleSourceLocalHighInvestmentSliceReport
    | NoelleSourceLocalLowerInvestmentSliceReport,
  branchCondition: string,
  requestPredicate: Record<string, unknown>,
): Omit<NoelleSourceBackedArtifactProfile, "artifactSet"> & {
  artifactSet?: never;
} {
  const mainStats = requireObject(recommendation.mainStats, "mainStats");
  const expectedConditionSha256 =
    sourceRecordId === LOWER_SOURCE_RECORD_ID
      ? "25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675"
      : "2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d";
  const expectedSubstatCondition =
    sourceRecordId === LOWER_SOURCE_RECORD_ID
      ? "Noelle is C0–C5 and her Burst Talent is Level 9; this priority covers offensive stats only."
      : "Noelle is C6 or her Burst Talent is Level 10 or higher; this priority covers offensive stats only.";
  const expectedSubstatGroups =
    sourceRecordId === LOWER_SOURCE_RECORD_ID
      ? [
          { priority: 1, statIds: ["cr", "cd"] },
          { priority: 2, statIds: ["atk%"] },
          { priority: 3, statIds: ["def%"] },
        ]
      : [
          { priority: 1, statIds: ["cr", "cd"] },
          { priority: 2, statIds: ["def%"] },
          { priority: 3, statIds: ["atk%"] },
        ];
  const substats = requireArray(recommendation.substats, "substats").map(
    (entry, index) => {
      const item = requireObject(entry, `substats[${index}]`);
      const conditions = requireStringArray(
        item.conditions,
        `substats[${index}].conditions`,
      );
      if (
        conditions.length !== 1 ||
        conditions[0] !== expectedSubstatCondition
      ) {
        throw new Error(`CP51 substat condition drifted for ${sourceRecordId}.`);
      }
      const occurrenceId =
        `kqm:character_guide:${sourceRecordId}:recommendation.substats[${index}].conditions`;
      const occurrence = sliceReport.holdoutOccurrences.find(
        (candidate) => candidate.occurrenceId === occurrenceId,
      );
      if (
        !occurrence ||
        occurrence.conditionsSha256 !== expectedConditionSha256 ||
        occurrence.sliceDisposition !== "holdout" ||
        occurrence.bindingAuthoredBySlice ||
        occurrence.energyClassificationAuthoredBySlice ||
        occurrence.structuralEnergyDimension !== "not-structural-er"
      ) {
        throw new Error(
          `CP51 prior unbound substat occurrence drifted for ${occurrenceId}.`,
        );
      }
      return {
        priority: requireNumber(item.priority, `substats[${index}].priority`),
        statIds: requireStringArray(item.statIds, `substats[${index}].statIds`),
        sourceConditions: conditions,
        sourceOccurrence: {
          occurrenceId,
          conditionsSha256: expectedConditionSha256,
          upstreamSliceDisposition: "holdout" as const,
          upstreamBindingAuthored: false as const,
          upstreamEnergyClassificationAuthored: false as const,
          cp51BindingStatus: "new-exact-source-specific-binding" as const,
          bindingMethod: "cp51-exact-source-condition-allowlist" as const,
        },
      };
    },
  );
  if (
    stableJson(substats.map(({ priority, statIds }) => ({ priority, statIds }))) !==
    stableJson(expectedSubstatGroups)
  ) {
    throw new Error(
      `CP51 exact substat priority allowlist drifted for ${sourceRecordId}.`,
    );
  }

  return {
    profileId,
    characterId: "noelle",
    status: "partial-source-backed-validation-target-not-build",
    sourceRecordId,
    sourceRecordSha256,
    sourceReviewStatus: "unreviewed",
    branch: {
      sourceCondition: branchCondition,
      requestPredicate,
      applicability: "typed-request-context-branch-authenticated",
      exhaustiveAcrossAllInvestmentStates: false,
    },
    mainStats: {
      sands: buildMainStatSlot(mainStats.sands, branchCondition, "sands"),
      goblet: buildMainStatSlot(mainStats.goblet, branchCondition, "goblet"),
      circlet: buildMainStatSlot(mainStats.circlet, branchCondition, "circlet"),
    },
    substatPriority: {
      semantics: "source-partial-order-groups-not-scalar-weights",
      scope: "offensive-stats-only",
      groups: substats,
      selectedAllocation: null,
      scalarWeights: null,
    },
    missingBoundaries: {
      weapon: "missing-not-zero",
      exactTeamNoelleWeaponRecommendationCount: 0,
      energyRecharge: "deferred-missing-not-zero",
      exactTeamNoelleErTargetCount: 0,
      formulaCounts: "missing-not-zero",
      sourceRecordsExplicitlyListFormulaCountsAsUnknown: true,
      enemyScenario: "missing-not-zero",
      completeArtifactAssignment: false,
      completeBuild: false,
    },
  };
}

function buildMainStatSlot(
  value: unknown,
  branchCondition: string,
  label: string,
): MainStatSlotProfile {
  const options = requireArray(value, `mainStats.${label}`).map((entry, index) => {
    const item = requireObject(entry, `mainStats.${label}[${index}]`);
    const sourceConditions = requireStringArray(
      item.conditions,
      `mainStats.${label}[${index}].conditions`,
    );
    if (sourceConditions[0] !== branchCondition) {
      throw new Error(`CP51 ${label} branch condition drifted.`);
    }
    return {
      statIds: requireStringArray(
        item.statIds,
        `mainStats.${label}[${index}].statIds`,
      ),
      sourceConditions,
      conditionStatus:
        sourceConditions.length === 1
          ? ("branch-condition-authenticated" as const)
          : ("additional-source-guard-unresolved" as const),
    };
  });
  return { options, selectedOptionIndex: null };
}

function authenticateHuskRecommendation(recommendation: Record<string, unknown>): void {
  const options = requireArray(
    recommendation.artifactRecommendations,
    "artifactRecommendations",
  );
  const expected = [
    {
      artifacts: [{ type: "4pc", setId: "husk_of_opulent_dreams" }],
      grouping: "single",
      classification: "default",
      conditions: [],
    },
  ];
  if (stableJson(options) !== stableJson(expected)) {
    throw new Error("CP51 unconditional Husk source recommendation drifted.");
  }
}

function authenticateSourceRotation(record: { sourceRecordId: string }): NoelleInvestmentArtifactProfileComputationAdmissionReport["computationRepresentationAdmission"]["sourceRotation"] {
  const object = requireObject(record, "teamRecord");
  const members = requireArray(object.members, "teamRecord.members").map(
    (member, index) => requireObject(member, `teamRecord.members[${index}]`),
  );
  const noelleMembers = members.filter(
    ({ characterId }) => characterId === "noelle",
  );
  if (
    noelleMembers.length !== 1 ||
    stableJson(noelleMembers[0]!.weaponRecommendations) !== stableJson([]) ||
    stableJson(noelleMembers[0]!.erTargets) !== stableJson([])
  ) {
    throw new Error(
      "CP51 exact team must retain missing-not-zero Noelle weapon and ER fields.",
    );
  }
  const unknowns = requireStringArray(object.unknowns, "teamRecord.unknowns");
  if (!unknowns.includes("formula counts") || !unknowns.includes("enemy scenario")) {
    throw new Error("CP51 exact team missing-boundary inventory drifted.");
  }
  const rotations = requireArray(object.rotations, "teamRecord.rotations");
  if (rotations.length !== 1) {
    throw new Error(`CP51 expected one Noelle source rotation, found ${rotations.length}.`);
  }
  const rotation = requireObject(rotations[0], "teamRecord.rotations[0]");
  const notation = requireString(rotation.notation, "rotation.notation");
  const expectedNotation =
    "Nicole (Q)¹E > Durin EEQ > Xilonen EN2 > Noelle EQ 2[N3D] N2 > Xilonen EN2 > Noelle N3D N2";
  if (
    rotation.id !== "sample-rotation-xilonen" ||
    notation !== expectedNotation ||
    stableJson(rotation.unresolvedSegments) !== stableJson([])
  ) {
    throw new Error("CP51 exact Noelle source rotation drifted.");
  }
  return {
    sourceRecordId: TEAM_SOURCE_RECORD_ID,
    rotationId: "sample-rotation-xilonen",
    notation,
    unresolvedSegments: [],
    noelleSegments: [
      {
        notation: "N3D",
        sourceTokenOccurrenceCount: 3,
        cancelToken: "D",
        cancelTokenPreserved: true,
        requiredHitVectorPerOccurrence: { n1: 1, n2: 1, n3: 1, n4: 0 },
        formulaCountInferred: false,
      },
      {
        notation: "N2",
        sourceTokenOccurrenceCount: 2,
        cancelToken: null,
        cancelTokenPreserved: true,
        requiredHitVectorPerOccurrence: { n1: 1, n2: 1, n3: 0, n4: 0 },
        formulaCountInferred: false,
      },
    ],
    requiredTotalHitVector: { n1: 5, n2: 5, n3: 3, n4: 0 },
  };
}

function readCharacterGuideRecommendation(record: {
  sourceRecordId: string;
}): Record<string, unknown> {
  const object = requireObject(record, record.sourceRecordId);
  if (object.kind !== "character_guide" || object.characterId !== "noelle") {
    throw new Error(`CP51 expected a Noelle character guide ${record.sourceRecordId}.`);
  }
  const extraction = requireObject(object.extraction, "extraction");
  if (extraction.method !== "agent-assisted" || extraction.reviewStatus !== "unreviewed") {
    throw new Error(`CP51 source review boundary drifted for ${record.sourceRecordId}.`);
  }
  const unknowns = requireStringArray(object.unknowns, "unknowns");
  if (!unknowns.includes("formula counts")) {
    throw new Error(`CP51 formula-count unknown drifted for ${record.sourceRecordId}.`);
  }
  return requireObject(object.recommendation, "recommendation");
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`CP51 ${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`CP51 ${label} must be an array.`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`CP51 ${label} must be text.`);
  return value;
}

function requireStringArray(value: unknown, label: string): string[] {
  const items = requireArray(value, label);
  if (items.some((item) => typeof item !== "string")) {
    throw new Error(`CP51 ${label} must contain only text.`);
  }
  return items as string[];
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`CP51 ${label} must be a finite number.`);
  }
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
