import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Text, stableJson } from "./io";
import {
  authenticateKleeSourceLocalConditionSliceReport,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
  type BuildKleeSourceLocalConditionSliceInput,
  type KleeSourceLocalConditionSliceReport,
  type KleeSourceLocalSelectedOccurrence,
} from "./kleeSourceLocalConditionSlice";
import {
  MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS,
  requireComparableManualConditionArrayCoverageReport,
  type ManualConditionArrayCoverageReport,
  type ManualConditionCoverageOccurrence,
} from "./manualConditionArrayCoverageReport";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";

const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const KLEE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/klee-source-local-condition-slice.json";
const MANUAL_COVERAGE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/manual-condition-array-coverage.json";
const WITNESS_ID =
  "kqm-klee-furina-team-scoped-condition-resolved-claim-join-luna-iv";
const KLEE_SLICE_ID = "kqm-klee-source-local-condition-slice-luna-iv";
const FURINA_TEAM_ID =
  "kqm:team:klee-furina-albedo-xilonen-example-luna-iv";
const OVERLOAD_TEAM_ID =
  "kqm:team:klee-chevreuse-durin-fischl-overload-example-luna-iv";

const CIRCLET_CLAIM_ID =
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.circlet[0].conditions";
const GOBLET_CLAIM_ID =
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.goblet[0].conditions";
const SANDS_CLAIM_ID =
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.sands[0].conditions";
const MARECHAUSSEE_CLAIM_ID =
  "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[2].conditions";

const EXPECTED_CLAIMS = [
  {
    claimId: CIRCLET_CLAIM_ID,
    sourceRecordId: "klee-on-field-artifact-stats-luna-iv",
    claimAxis: "main-stat",
    mainStatSlot: "circlet",
    payload: {
      type: "main-stat",
      slot: "circlet",
      statIds: ["cr", "cd"],
      priority: null,
      target: null,
    },
    recommendation: {
      recommendationId: "on-field-artifact-stats",
      label: "General on-field artifact stats, excluding ER",
      scope: "artifact-stats",
      roles: ["dps"],
      ordering: null,
      classification: null,
      grouping: null,
      sourceIndex: 0,
    },
    sourceResolution: "unresolved-context",
    positiveContextApplicability: "applicable-under-supplied-context",
    negativeContextApplicability: "applicable-under-supplied-context",
  },
  {
    claimId: GOBLET_CLAIM_ID,
    sourceRecordId: "klee-on-field-artifact-stats-luna-iv",
    claimAxis: "main-stat",
    mainStatSlot: "goblet",
    payload: {
      type: "main-stat",
      slot: "goblet",
      statIds: ["pyro%"],
      priority: null,
      target: null,
    },
    recommendation: {
      recommendationId: "on-field-artifact-stats",
      label: "General on-field artifact stats, excluding ER",
      scope: "artifact-stats",
      roles: ["dps"],
      ordering: null,
      classification: null,
      grouping: null,
      sourceIndex: 0,
    },
    sourceResolution: "unresolved-context",
    positiveContextApplicability: "applicable-under-supplied-context",
    negativeContextApplicability: "applicable-under-supplied-context",
  },
  {
    claimId: SANDS_CLAIM_ID,
    sourceRecordId: "klee-on-field-artifact-stats-luna-iv",
    claimAxis: "main-stat",
    mainStatSlot: "sands",
    payload: {
      type: "main-stat",
      slot: "sands",
      statIds: ["atk%"],
      priority: null,
      target: null,
    },
    recommendation: {
      recommendationId: "on-field-artifact-stats",
      label: "General on-field artifact stats, excluding ER",
      scope: "artifact-stats",
      roles: ["dps"],
      ordering: null,
      classification: null,
      grouping: null,
      sourceIndex: 0,
    },
    sourceResolution: "unresolved-context",
    positiveContextApplicability: "applicable-under-supplied-context",
    negativeContextApplicability: "applicable-under-supplied-context",
  },
  {
    claimId: MARECHAUSSEE_CLAIM_ID,
    sourceRecordId: "klee-on-field-contextual-artifact-sets-luna-iv",
    claimAxis: "artifact-recommendation",
    payload: {
      type: "artifact-group",
      artifacts: [{ type: "4pc", setId: "marechaussee_hunter" }],
    },
    recommendation: {
      recommendationId: "on-field-contextual-artifact-sets",
      label: "General and contextual on-field 4pc artifact sets",
      scope: "artifact-sets",
      roles: ["dps"],
      ordering: "unranked",
      classification: "conditional",
      grouping: "single",
      sourceIndex: 2,
    },
    sourceResolution: "matched",
    positiveContextApplicability: "source-already-matched",
    negativeContextApplicability: "source-definitely-inapplicable",
  },
] as const;

const EXPECTED_TEAMS = [
  {
    packetIndex: 0,
    teamRecordId: OVERLOAD_TEAM_ID,
    snapshotPath:
      "scripts/guide-factory/data/source-snapshots/kqm-klee-manual.json",
    sourceId: "kqm",
    sourceRecordId:
      "klee-chevreuse-durin-fischl-overload-example-luna-iv",
    label: "Klee — Chevreuse — Durin — Fischl",
    intent: "example",
    exhaustiveness: "non-exhaustive",
    rankingClaim: "unordered",
    memberCharacterIds: ["klee", "chevreuse", "durin", "fischl"],
  },
  {
    packetIndex: 1,
    teamRecordId: FURINA_TEAM_ID,
    snapshotPath:
      "scripts/guide-factory/data/source-snapshots/kqm-klee-manual.json",
    sourceId: "kqm",
    sourceRecordId: "klee-furina-albedo-xilonen-example-luna-iv",
    label: "Klee — Furina — Albedo — Xilonen",
    intent: "example",
    exhaustiveness: "non-exhaustive",
    rankingClaim: "unordered",
    memberCharacterIds: ["klee", "furina", "albedo", "xilonen"],
  },
] as const;

const CAPABILITY_BOUNDARY = {
  arbitraryEnglishParsingAllowed: false,
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsEquipmentRecommendations: false,
  supportsBuildRecommendations: false,
  supportsStatRecommendations: false,
  supportsRankClaims: false,
  supportsCompatibilityClaims: false,
  supportsDamageClaims: false,
  supportsRotationClaims: false,
  supportsEnergyRecoveryClaims: false,
  playerFacingRecommendations: false,
  conditionTruthEstablishedFromRecommendationMetadata: false,
  typedBindingTreatedAsApplicabilityTruth: false,
  payloadCompatibilityEvaluated: false,
  jointOptimalityEvaluated: false,
  recommendationCompositionExecuted: false,
  crossProductExecuted: false,
  payloadAxisExpansionExecuted: false,
  choiceSelectionExecuted: false,
  rankingExecuted: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  damageComputationExecuted: false,
  rotationComputationExecuted: false,
  energyRecoveryInputsUsed: false,
  energyRecoveryComputationExecuted: false,
  assembledBuildCount: 0,
  candidateCount: 0,
} as const;

const CAUTIONS = [
  "This witness retains four independently applicable source claims under one exact team fixture; it does not establish that their payloads form a compatible, complete, effective, or optimal build.",
  "The Klee role facts are explicit Guide Factory request fixtures scoped to one exact team and Klee; recommendation role metadata is not condition truth.",
  "The source records remain agent-assisted and unreviewed, and the cross-record evidence join is authored by Guide Factory rather than by KQM.",
  "CR and CD remain one unchosen source payload group. No alternative was selected and no payload axis was expanded.",
  "Eleven other Klee condition occurrences remain holdouts and provide no input to this witness.",
];

const PROHIBITED_INTERPRETATIONS = [
  "Do not interpret the flat positive witness as a build, ranking, recommendation, compatibility claim, guide, or source-authored cross-record statement.",
  "Do not use typed-bound coverage as proof that a condition is true; source cells and exact request-context projections remain the applicability evidence.",
  "Do not use request context to replace exact source-team roster facts or to change the Overload Marechaussee claim from source-definitely-inapplicable.",
  "Do not infer weapon, substat, ER, rotation, damage, generator, optimizer, or player-facing advice from this report.",
];

type SourceLocalSlice = NonNullable<
  KleeSourceLocalConditionSliceReport["sourceLocalSlice"]
>;
type ExactTeamControl = SourceLocalSlice["exactTeamControls"][number];
type SourceClaim = SourceLocalSlice["sourceClaimCatalog"][number];
type ConditionControl = SourceLocalSlice["conditionControls"][number];
type SourceClaimCell = SourceLocalSlice["sourceClaimCells"][number]["claimCells"][number];
type RequestContextReport = NonNullable<
  SourceLocalSlice["requestContextReport"]
>;
type RequestProjection =
  RequestContextReport["teamProjections"][number]["claimProjections"][number];

export interface KleeTeamScopedClaimJoinWitnessSourceFile {
  path: string;
  text: string;
}

export interface BuildKleeTeamScopedClaimJoinWitnessInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  kleeDurableReportInput: unknown;
  manualCoverageDurableReportInput: unknown;
  sourceFiles: readonly KleeTeamScopedClaimJoinWitnessSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface KleeTeamScopedClaimEvidenceRow {
  claimId: string;
  factoryDisposition:
    | "positive-independent-applicability-witness-member"
    | "negative-control-applicable-only"
    | "negative-control-source-definitely-inapplicable";
  selectedOccurrenceSha256: string;
  coverageOccurrenceSha256: string;
  sourceClaimSha256: string;
  conditionControlSha256: string;
  sourceCellSha256: string;
  requestProjectionSha256: string;
  selectedOccurrence: KleeSourceLocalSelectedOccurrence;
  coverageOccurrence: ManualConditionCoverageOccurrence;
  sourceClaim: SourceClaim;
  conditionControl: ConditionControl;
  sourceCell: SourceClaimCell;
  requestProjection: RequestProjection;
  applicabilityProvenance: {
    sourceResolution: SourceClaimCell["resolution"];
    contextApplicability: RequestProjection["contextApplicability"];
    effectiveResolution: RequestProjection["resolution"];
    requestContextBindingCount: number;
    sourceControlPreserved: true;
  };
}

export interface KleeTeamScopedClaimJoinWitnessReport {
  schemaVersion: 1;
  reportType: "klee-team-scoped-condition-resolved-claim-join-witness";
  witnessId: typeof WITNESS_ID;
  classification: "authenticated-descriptive-independent-applicability-witness";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-factory-evidence-join";
  sameTeamIndependentApplicabilityJoinExecuted: boolean;
  arbitraryEnglishParsingAllowed: false;
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsBuildRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsCompatibilityClaims: false;
  supportsDamageClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  playerFacingRecommendations: false;
  conditionTruthEstablishedFromRecommendationMetadata: false;
  typedBindingTreatedAsApplicabilityTruth: false;
  payloadCompatibilityEvaluated: false;
  jointOptimalityEvaluated: false;
  recommendationCompositionExecuted: false;
  crossProductExecuted: false;
  payloadAxisExpansionExecuted: false;
  choiceSelectionExecuted: false;
  rankingExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  damageComputationExecuted: false;
  rotationComputationExecuted: false;
  energyRecoveryInputsUsed: false;
  energyRecoveryComputationExecuted: false;
  assembledBuildCount: 0;
  candidateCount: 0;
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted" | "rejected";
    exactPathSet: boolean;
    byteAndParsedObjectClosure: boolean;
    sourceFileCount: number;
  };
  upstreamBoundary: {
    status: "accepted" | "rejected";
    dag: [
      "raw-klee-records",
      "authenticated-klee-source-local-slice",
      "current-condition-binding-catalog",
      "authenticated-manual-condition-coverage",
      "klee-team-scoped-claim-join-witness",
    ];
    klee: {
      durableReportPath: typeof KLEE_REPORT_RELATIVE_PATH;
      durableReportFileSha256: string | null;
      durableReportCanonicalObjectSha256: string | null;
      freshlyAuthenticated: boolean;
      sliceId: string | null;
      selectedOccurrenceCount: number;
      holdoutOccurrenceCount: number;
      sourceTeamCount: number;
    };
    manualCoverage: {
      durableReportPath: typeof MANUAL_COVERAGE_REPORT_RELATIVE_PATH;
      durableReportFileSha256: string | null;
      durableReportCanonicalObjectSha256: string | null;
      currentBoundaryAuthenticated: boolean;
      corpusOccurrenceCount: number;
      bindingOccurrenceCount: number;
      kleeSourceLocalOccurrenceCount: number;
      typedBindingMeansConditionTruth: false;
    };
    exactCrossLinkedOccurrenceCount: number;
    exactCrossLinkedOccurrenceIds: string[];
  };
  authorshipBoundary: {
    sourceTeamAndClaimEvidencePreservedFromAuthenticatedSlice: true;
    sourceCellsPreservedVerbatim: true;
    requestProjectionsPreservedVerbatim: true;
    crossRecordJoinAuthoredBy: "guide-factory";
    sourceAuthoredCrossRecordJoin: false;
    sourceAuthoredBuild: false;
    sourceAuthoredCrossRecordOrdering: false;
    requestRoleFactsAuthoredBy: "guide-factory-explicit-fixture";
    recommendationMetadataUsedAsConditionTruth: false;
  };
  selectedAndHoldoutBoundary: {
    selectedOccurrenceIds: string[];
    selectedOccurrencesSha256: string;
    holdoutOccurrenceIds: string[];
    holdoutOccurrencesSha256: string;
    selectedAndHoldoutsCloseAllKleeConditions: true;
    holdoutOccurrenceCount: 11;
    holdoutsConsumedByWitness: 0;
  } | null;
  positiveWitness: {
    witnessKind: "flat-same-team-independent-applicability-evidence-set";
    team: ExactTeamControl;
    teamSha256: string;
    sourceRecordIds: string[];
    claimIds: string[];
    claims: KleeTeamScopedClaimEvidenceRow[];
    independentlyApplicableClaimCount: 4;
    sourceAlreadyMatchedClaimCount: 1;
    requestContextResolvedClaimCount: 3;
    crCdPreservedAsOneUnchosenPayloadGroup: true;
    jointPayloadCompatibilityEstablished: false;
    completenessEstablished: false;
    optimalityEstablished: false;
  } | null;
  negativeControl: {
    controlKind: "exact-overload-team-roster-separation-control";
    team: ExactTeamControl;
    teamSha256: string;
    claimIds: string[];
    claimControls: KleeTeamScopedClaimEvidenceRow[];
    applicableUnderSuppliedContextClaimIds: string[];
    sourceDefinitelyInapplicableClaimIds: [typeof MARECHAUSSEE_CLAIM_ID];
    positiveWitnessConstructed: false;
    rosterConditionedClaimExcludedFromWitness: true;
  } | null;
  summary: {
    positiveWitnessCount: number;
    positiveClaimCount: number;
    positiveSourceRecordCount: number;
    negativeControlTeamCount: number;
    negativeControlApplicableClaimCount: number;
    negativeControlInapplicableClaimCount: number;
    crossLinkedCoverageOccurrenceCount: number;
    assembledBuildCount: 0;
    candidateCount: 0;
  };
  issues: Array<{ code: string; path: string; message: string }>;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type KleeTeamScopedClaimJoinWitnessAuthentication =
  | {
      authenticated: true;
      canonicalReport: KleeTeamScopedClaimJoinWitnessReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: KleeTeamScopedClaimJoinWitnessReport["issues"];
    };

export const KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_SOURCE_FILE_PATHS = [
  ...new Set([
    ...KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
    KLEE_REPORT_RELATIVE_PATH,
    MANUAL_COVERAGE_REPORT_RELATIVE_PATH,
  ]),
].sort(compareText);

export const KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_INPUT_PATHS = [
  ...new Set([
    "scripts/guide-factory/src/kleeTeamScopedClaimJoinWitness.ts",
    "scripts/guide-factory/src/assemble-klee-team-scoped-claim-join-witness.ts",
    "scripts/guide-factory/src/io.ts",
    ...KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
    ...MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS,
    KLEE_REPORT_RELATIVE_PATH,
    MANUAL_COVERAGE_REPORT_RELATIVE_PATH,
  ]),
].sort(compareText);

export const KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "klee-team-scoped-claim-join-witness.json",
);

export function buildKleeTeamScopedClaimJoinWitnessReport(
  input: BuildKleeTeamScopedClaimJoinWitnessInput,
): KleeTeamScopedClaimJoinWitnessReport {
  let generatedFrom: GeneratedFromEntry[] = [];
  try {
    generatedFrom = authenticateRawInputBoundary(input);
    const kleeDurableReport =
      input.kleeDurableReportInput as KleeSourceLocalConditionSliceReport;
    const manualCoverageDurableReport =
      input.manualCoverageDurableReportInput as ManualConditionArrayCoverageReport;
    const kleeAuthentication =
      authenticateKleeSourceLocalConditionSliceReport(kleeDurableReport, {
        repositoryInput: input.repositoryInput,
        manualSnapshotInput: input.manualSnapshotInput,
        manualIndexInput: input.manualIndexInput,
        sourceRegistryInput: input.sourceRegistryInput,
        sourceFiles: selectSourceFiles(
          input.sourceFiles,
          KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
        ),
        generatedFrom: selectGeneratedFrom(
          generatedFrom,
          KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
        ),
      });
    if (!kleeAuthentication.authenticated) {
      throw new Error(
        `Fresh Klee source-local authentication failed: ${kleeAuthentication.reason}.`,
      );
    }
    requireComparableManualConditionArrayCoverageReport(
      manualCoverageDurableReport,
      selectGeneratedFrom(
        generatedFrom,
        MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS,
      ),
    );

    const klee = kleeAuthentication.canonicalReport;
    const slice = requireComparableExactKleeSlice(klee);
    validateExactClaimsAndTeams(klee, slice);
    const coverageByOccurrenceId = crossLinkCoverage(
      klee,
      slice,
      manualCoverageDurableReport,
    );
    const furinaTeam = requiredExactTeam(slice, FURINA_TEAM_ID);
    const overloadTeam = requiredExactTeam(slice, OVERLOAD_TEAM_ID);
    const positiveClaims = buildEvidenceRows(
      klee,
      slice,
      coverageByOccurrenceId,
      FURINA_TEAM_ID,
      "positive",
    );
    const negativeClaims = buildEvidenceRows(
      klee,
      slice,
      coverageByOccurrenceId,
      OVERLOAD_TEAM_ID,
      "negative-control",
    );
    validatePositiveAndNegativeSemantics(positiveClaims, negativeClaims);

    const selectedOccurrenceIds = klee.selectedOccurrences.map(
      ({ occurrenceId }) => occurrenceId,
    );
    const holdoutOccurrenceIds = klee.holdoutOccurrences.map(
      ({ occurrenceId }) => occurrenceId,
    );
    const sourceRecordIds = [
      ...new Set(positiveClaims.map(({ sourceClaim }) => sourceClaim.sourceRecordId)),
    ].sort(compareText);

    return {
      schemaVersion: 1,
      reportType: "klee-team-scoped-condition-resolved-claim-join-witness",
      witnessId: WITNESS_ID,
      classification:
        "authenticated-descriptive-independent-applicability-witness",
      comparisonStatus: "comparable",
      publicationStatus: "withheld-unreviewed-factory-evidence-join",
      sameTeamIndependentApplicabilityJoinExecuted: true,
      ...CAPABILITY_BOUNDARY,
      generatedFrom,
      rawInputBoundary: {
        status: "accepted",
        exactPathSet: true,
        byteAndParsedObjectClosure: true,
        sourceFileCount:
          KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_SOURCE_FILE_PATHS.length,
      },
      upstreamBoundary: {
        status: "accepted",
        dag: [
          "raw-klee-records",
          "authenticated-klee-source-local-slice",
          "current-condition-binding-catalog",
          "authenticated-manual-condition-coverage",
          "klee-team-scoped-claim-join-witness",
        ],
        klee: {
          durableReportPath: KLEE_REPORT_RELATIVE_PATH,
          durableReportFileSha256: requiredGeneratedHash(
            generatedFrom,
            KLEE_REPORT_RELATIVE_PATH,
          ),
          durableReportCanonicalObjectSha256: hashValue(kleeDurableReport),
          freshlyAuthenticated: true,
          sliceId: klee.sliceId,
          selectedOccurrenceCount: klee.selectedOccurrences.length,
          holdoutOccurrenceCount: klee.holdoutOccurrences.length,
          sourceTeamCount: slice.exactTeamControls.length,
        },
        manualCoverage: {
          durableReportPath: MANUAL_COVERAGE_REPORT_RELATIVE_PATH,
          durableReportFileSha256: requiredGeneratedHash(
            generatedFrom,
            MANUAL_COVERAGE_REPORT_RELATIVE_PATH,
          ),
          durableReportCanonicalObjectSha256: hashValue(
            manualCoverageDurableReport,
          ),
          currentBoundaryAuthenticated: true,
          corpusOccurrenceCount:
            manualCoverageDurableReport.corpusBoundary.occurrenceCount,
          bindingOccurrenceCount:
            manualCoverageDurableReport.bindingBoundary.occurrenceCount,
          kleeSourceLocalOccurrenceCount:
            manualCoverageDurableReport.bindingBoundary
              .kleeSourceLocalOccurrenceCount,
          typedBindingMeansConditionTruth: false,
        },
        exactCrossLinkedOccurrenceCount: coverageByOccurrenceId.size,
        exactCrossLinkedOccurrenceIds: [...coverageByOccurrenceId.keys()].sort(
          compareText,
        ),
      },
      authorshipBoundary: {
        sourceTeamAndClaimEvidencePreservedFromAuthenticatedSlice: true,
        sourceCellsPreservedVerbatim: true,
        requestProjectionsPreservedVerbatim: true,
        crossRecordJoinAuthoredBy: "guide-factory",
        sourceAuthoredCrossRecordJoin: false,
        sourceAuthoredBuild: false,
        sourceAuthoredCrossRecordOrdering: false,
        requestRoleFactsAuthoredBy: "guide-factory-explicit-fixture",
        recommendationMetadataUsedAsConditionTruth: false,
      },
      selectedAndHoldoutBoundary: {
        selectedOccurrenceIds,
        selectedOccurrencesSha256: hashValue(klee.selectedOccurrences),
        holdoutOccurrenceIds,
        holdoutOccurrencesSha256: hashValue(klee.holdoutOccurrences),
        selectedAndHoldoutsCloseAllKleeConditions: true,
        holdoutOccurrenceCount: 11,
        holdoutsConsumedByWitness: 0,
      },
      positiveWitness: {
        witnessKind: "flat-same-team-independent-applicability-evidence-set",
        team: structuredClone(furinaTeam),
        teamSha256: hashValue(furinaTeam),
        sourceRecordIds,
        claimIds: positiveClaims.map(({ claimId }) => claimId),
        claims: positiveClaims,
        independentlyApplicableClaimCount: 4,
        sourceAlreadyMatchedClaimCount: 1,
        requestContextResolvedClaimCount: 3,
        crCdPreservedAsOneUnchosenPayloadGroup: true,
        jointPayloadCompatibilityEstablished: false,
        completenessEstablished: false,
        optimalityEstablished: false,
      },
      negativeControl: {
        controlKind: "exact-overload-team-roster-separation-control",
        team: structuredClone(overloadTeam),
        teamSha256: hashValue(overloadTeam),
        claimIds: negativeClaims.map(({ claimId }) => claimId),
        claimControls: negativeClaims,
        applicableUnderSuppliedContextClaimIds: negativeClaims
          .filter(
            ({ requestProjection }) =>
              requestProjection.contextApplicability ===
              "applicable-under-supplied-context",
          )
          .map(({ claimId }) => claimId),
        sourceDefinitelyInapplicableClaimIds: [MARECHAUSSEE_CLAIM_ID],
        positiveWitnessConstructed: false,
        rosterConditionedClaimExcludedFromWitness: true,
      },
      summary: {
        positiveWitnessCount: 1,
        positiveClaimCount: positiveClaims.length,
        positiveSourceRecordCount: sourceRecordIds.length,
        negativeControlTeamCount: 1,
        negativeControlApplicableClaimCount: 3,
        negativeControlInapplicableClaimCount: 1,
        crossLinkedCoverageOccurrenceCount: coverageByOccurrenceId.size,
        assembledBuildCount: 0,
        candidateCount: 0,
      },
      issues: [],
      cautions: [...CAUTIONS],
      prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    };
  } catch (error) {
    return failedReport(
      generatedFrom,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function authenticateKleeTeamScopedClaimJoinWitnessReport(
  serializedReport: KleeTeamScopedClaimJoinWitnessReport,
  input: BuildKleeTeamScopedClaimJoinWitnessInput,
): KleeTeamScopedClaimJoinWitnessAuthentication {
  const canonicalReport = buildKleeTeamScopedClaimJoinWitnessReport(input);
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
          code: "klee-team-claim-join.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Klee team-scoped claim-join witness does not match a fresh canonical rebuild from current authenticated upstream evidence.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableKleeTeamScopedClaimJoinWitnessReport(
  report: KleeTeamScopedClaimJoinWitnessReport,
  input: BuildKleeTeamScopedClaimJoinWitnessInput,
): void {
  const authentication = authenticateKleeTeamScopedClaimJoinWitnessReport(
    report,
    input,
  );
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Klee team-scoped claim-join witness (${authentication.reason}): ${authentication.issues
      .map(({ code, message }) => `${code}: ${message}`)
      .join("; ")}`,
  );
}

function authenticateRawInputBoundary(
  input: BuildKleeTeamScopedClaimJoinWitnessInput,
): GeneratedFromEntry[] {
  const generatedFrom = [...input.generatedFrom].map((entry) => ({ ...entry }));
  const expectedPaths = KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_INPUT_PATHS;
  if (
    generatedFrom.length !== expectedPaths.length ||
    generatedFrom.some(
      (entry, index) =>
        entry.path !== expectedPaths[index] ||
        !/^[0-9a-f]{64}$/.test(entry.sha256),
    )
  ) {
    throw new Error(
      "CP27 generatedFrom path/hash closure drifted from the exact current input boundary.",
    );
  }
  const expectedSourcePaths =
    KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_SOURCE_FILE_PATHS;
  if (
    input.sourceFiles.length !== expectedSourcePaths.length ||
    input.sourceFiles.some(
      (sourceFile, index) => sourceFile.path !== expectedSourcePaths[index],
    )
  ) {
    throw new Error("CP27 source-file exact path closure drifted.");
  }
  for (const sourceFile of input.sourceFiles) {
    if (
      requiredGeneratedHash(generatedFrom, sourceFile.path) !==
      sha256Text(sourceFile.text)
    ) {
      throw new Error(`CP27 source-file byte hash drifted for ${sourceFile.path}.`);
    }
  }
  const objectClosures: Array<[string, unknown]> = [
    [
      "scripts/guide-factory/data/knowledge/repository.json",
      input.repositoryInput,
    ],
    [
      "scripts/guide-factory/data/source-snapshots/manual-index.json",
      input.manualIndexInput,
    ],
    ["scripts/guide-factory/sources/registry.json", input.sourceRegistryInput],
    [
      "scripts/guide-factory/data/source-snapshots/kqm-klee-manual.json",
      input.manualSnapshotInput,
    ],
    [KLEE_REPORT_RELATIVE_PATH, input.kleeDurableReportInput],
    [
      MANUAL_COVERAGE_REPORT_RELATIVE_PATH,
      input.manualCoverageDurableReportInput,
    ],
  ];
  for (const [objectPath, parsedInput] of objectClosures) {
    const sourceFile = input.sourceFiles.find(({ path: sourcePath }) =>
      sourcePath === objectPath,
    );
    if (!sourceFile) {
      throw new Error(`Missing CP27 source object ${objectPath}.`);
    }
    let parsedFile: unknown;
    try {
      parsedFile = JSON.parse(sourceFile.text);
    } catch {
      throw new Error(`CP27 source object is not valid JSON: ${objectPath}.`);
    }
    if (stableJson(parsedFile) !== stableJson(parsedInput)) {
      throw new Error(
        `CP27 source-file bytes and parsed input disagree for ${objectPath}.`,
      );
    }
  }
  return generatedFrom;
}

function requireComparableExactKleeSlice(
  report: KleeSourceLocalConditionSliceReport,
): SourceLocalSlice {
  const slice = report.sourceLocalSlice;
  if (
    report.comparisonStatus !== "comparable" ||
    report.sliceId !== KLEE_SLICE_ID ||
    report.issues.length !== 0 ||
    report.rawInputBoundary.status !== "accepted" ||
    !report.rawInputBoundary.exactPathSet ||
    !report.rawInputBoundary.byteAndParsedObjectClosure ||
    report.sourceBoundary.status !== "accepted" ||
    report.sourceBoundary.repositoryParity !== "exact" ||
    !report.sourceBoundary.selectedAndHoldoutsCloseAllKleeConditions ||
    report.selectedOccurrences.length !== 4 ||
    report.holdoutOccurrences.length !== 11 ||
    slice == null ||
    slice.comparisonStatus !== "comparable" ||
    slice.issues.length !== 0 ||
    slice.sourceDocumentBoundary.status !== "accepted" ||
    !slice.sourceDocumentBoundary.allClaimsAndTeamsShareExactSourceDocument ||
    slice.sourceClaimCatalog.length !== 4 ||
    slice.conditionControls.length !== 4 ||
    slice.exactTeamControls.length !== 2 ||
    slice.summary.cellCount !== 8 ||
    slice.summary.sourceUnresolvedCount !== 6 ||
    slice.summary.sourceMatchedCount !== 1 ||
    slice.summary.sourceInapplicableCount !== 1 ||
    slice.summary.effectiveMatchedCount !== 7 ||
    slice.summary.effectiveInapplicableCount !== 1 ||
    slice.summary.assembledBuildCount !== 0
  ) {
    throw new Error("The freshly authenticated Klee slice lost its exact CP26 boundary.");
  }
  const capabilities = {
    supportsSourceAuthorization: report.supportsSourceAuthorization,
    supportsGuideClaims: report.supportsGuideClaims,
    supportsTeamRecommendations: report.supportsTeamRecommendations,
    supportsEquipmentRecommendations: report.supportsEquipmentRecommendations,
    supportsStatRecommendations: report.supportsStatRecommendations,
    supportsRankClaims: report.supportsRankClaims,
    supportsDamageClaims: report.supportsDamageClaims,
    supportsEnergyRecoveryClaims: report.supportsEnergyRecoveryClaims,
    recommendationCompositionExecuted: report.recommendationCompositionExecuted,
    generatorExecuted: report.generatorExecuted,
    optimizerExecuted: report.optimizerExecuted,
    damageComputationExecuted: report.damageComputationExecuted,
    energyRecoveryComputationExecuted: report.energyRecoveryComputationExecuted,
    nestedBuildComposition: slice.buildComposition,
    nestedRanking: slice.ranking,
    nestedDamage: slice.damage,
    nestedFormulas: slice.formulas,
    nestedRotations: slice.rotations,
    nestedER: slice.ER,
    nestedAssembledBuildCount: slice.assembledBuildCount,
  };
  if (Object.values(capabilities).some((value) => value !== false && value !== 0)) {
    throw new Error("The Klee source-local capability boundary was crossed.");
  }
  if (
    !slice.compositionPolicy.sourceCellsPreservedVerbatim ||
    !slice.compositionPolicy.requestProjectionsPreservedVerbatim ||
    slice.compositionPolicy.conditionTruthEstablishedFromRecommendationMetadata ||
    slice.compositionPolicy.requestContextMayReplaceExactRosterFacts ||
    !slice.compositionPolicy.requestFactsMustBeExactTeamAndCharacterScoped
  ) {
    throw new Error("The Klee source/request provenance policy boundary drifted.");
  }
  return slice;
}

function validateExactClaimsAndTeams(
  report: KleeSourceLocalConditionSliceReport,
  slice: SourceLocalSlice,
): void {
  if (
    stableJson(slice.exactTeamControls) !== stableJson(EXPECTED_TEAMS) ||
    stableJson(
      report.selectedOccurrences.map(({ occurrenceId }) => occurrenceId),
    ) !== stableJson(EXPECTED_CLAIMS.map(({ claimId }) => claimId))
  ) {
    throw new Error("The exact CP27 team or selected-claim boundary drifted.");
  }
  if (
    new Set(report.holdoutOccurrences.map(({ occurrenceId }) => occurrenceId))
      .size !== 11 ||
    report.holdoutOccurrences.some(({ occurrenceId }) =>
      EXPECTED_CLAIMS.some(({ claimId }) => claimId === occurrenceId),
    )
  ) {
    throw new Error("The exact selected/holdout partition drifted.");
  }
  for (const expected of EXPECTED_CLAIMS) {
    const selected = requiredUnique(
      report.selectedOccurrences,
      ({ occurrenceId }) => occurrenceId === expected.claimId,
      `selected occurrence ${expected.claimId}`,
    );
    const claim = requiredUnique(
      slice.sourceClaimCatalog,
      ({ claimId }) => claimId === expected.claimId,
      `source claim ${expected.claimId}`,
    );
    const control = requiredUnique(
      slice.conditionControls,
      ({ claimId }) => claimId === expected.claimId,
      `condition control ${expected.claimId}`,
    );
    if (
      selected.sourceRecordId !== expected.sourceRecordId ||
      selected.claimAxis !== expected.claimAxis ||
      ("mainStatSlot" in expected
        ? selected.mainStatSlot !== expected.mainStatSlot
        : selected.mainStatSlot != null) ||
      stableJson(selected.payload) !== stableJson(expected.payload) ||
      claim.sourceRecordId !== expected.sourceRecordId ||
      stableJson(claim.payload) !== stableJson(expected.payload) ||
      stableJson(claim.recommendation) !== stableJson(expected.recommendation) ||
      control.occurrenceControl.occurrenceId !== selected.occurrenceId ||
      control.occurrenceControl.sourceConditionsSha256 !==
        selected.conditionsSha256 ||
      control.occurrenceControl.sourcePredicateSha256 !==
        selected.predicateSha256 ||
      control.occurrenceControl.payloadSha256 !== selected.payloadSha256
    ) {
      throw new Error(`Exact CP27 claim lineage drifted for ${expected.claimId}.`);
    }
  }
  const circlet = requiredUnique(
    report.selectedOccurrences,
    ({ occurrenceId }) => occurrenceId === CIRCLET_CLAIM_ID,
    "circlet selected occurrence",
  );
  if (
    circlet.payload.type !== "main-stat" ||
    stableJson(circlet.payload.statIds) !== stableJson(["cr", "cd"])
  ) {
    throw new Error("CR/CD must remain one ordered, unchosen source payload group.");
  }
}

function crossLinkCoverage(
  report: KleeSourceLocalConditionSliceReport,
  slice: SourceLocalSlice,
  coverage: ManualConditionArrayCoverageReport,
): Map<string, ManualConditionCoverageOccurrence> {
  if (
    coverage.comparisonStatus !== "comparable" ||
    coverage.bindingBoundary.status !== "authenticated" ||
    !coverage.bindingBoundary.kleeSourceLocalDurableMatchesCurrent ||
    coverage.bindingBoundary.kleeSourceLocalOccurrenceCount !== 4 ||
    coverage.bindingBoundary.typedBindingMeansConditionTruth ||
    coverage.issues.length !== 0
  ) {
    throw new Error("The authenticated manual coverage Klee boundary drifted.");
  }
  const result = new Map<string, ManualConditionCoverageOccurrence>();
  for (const selected of report.selectedOccurrences) {
    const rows = coverage.occurrences.filter(
      ({ occurrenceId }) => occurrenceId === selected.occurrenceId,
    );
    if (rows.length !== 1) {
      throw new Error(
        `Expected one coverage row for ${selected.occurrenceId}, found ${rows.length}.`,
      );
    }
    const row = rows[0]!;
    const control = requiredUnique(
      slice.conditionControls,
      ({ claimId }) => claimId === selected.occurrenceId,
      `condition control ${selected.occurrenceId}`,
    );
    const bindingEvidence = row.bindingEvidence;
    const energyEvidence = row.energyEvidence;
    if (
      row.subject !== "klee" ||
      row.sourceId !== "kqm" ||
      row.recordKind !== "character_guide" ||
      row.sourceRecordId !== selected.sourceRecordId ||
      row.repositoryRecordId !== selected.repositoryRecordId ||
      row.manualClaimPath !== selected.manualClaimPath ||
      row.repositoryPath !== selected.repositoryPath ||
      row.conditionsSha256 !== selected.conditionsSha256 ||
      stableJson(row.conditions) !== stableJson(selected.conditions) ||
      row.repositoryParity !== "exact" ||
      row.bindingClassification !== "typed-bound" ||
      row.displayStatus !== "typed-bound" ||
      !row.nonStructuralBindingCoverageEligible ||
      row.energyClassification !== "not-energy-deferred" ||
      bindingEvidence?.kind !== "source-local-typed-predicate-ast" ||
      bindingEvidence.sliceId !== report.sliceId ||
      bindingEvidence.selectedOccurrenceId !== selected.occurrenceId ||
      bindingEvidence.selectedOccurrenceSha256 !== hashValue(selected) ||
      stableJson(bindingEvidence.predicateAst) !== stableJson(selected.predicate) ||
      bindingEvidence.predicateAstSha256 !== selected.predicateSha256 ||
      bindingEvidence.payloadSha256 !== selected.payloadSha256 ||
      bindingEvidence.occurrenceControlSha256 !== hashValue(control) ||
      energyEvidence?.kind !== "source-local-not-energy-deferred" ||
      energyEvidence.structuralErEvidencePresent ||
      energyEvidence.energyRelatedWorkDeferred ||
      energyEvidence.sliceId !== report.sliceId ||
      energyEvidence.selectedOccurrenceId !== selected.occurrenceId ||
      energyEvidence.selectedOccurrenceSha256 !== hashValue(selected)
    ) {
      throw new Error(
        `Coverage-to-source occurrence evidence drifted for ${selected.occurrenceId}.`,
      );
    }
    result.set(selected.occurrenceId, structuredClone(row));
  }
  if (result.size !== 4) {
    throw new Error("The exact Klee coverage cross-link must contain four rows.");
  }
  return result;
}

function buildEvidenceRows(
  report: KleeSourceLocalConditionSliceReport,
  slice: SourceLocalSlice,
  coverageByOccurrenceId: ReadonlyMap<
    string,
    ManualConditionCoverageOccurrence
  >,
  teamRecordId: string,
  mode: "positive" | "negative-control",
): KleeTeamScopedClaimEvidenceRow[] {
  return EXPECTED_CLAIMS.map((expected) => {
    const selectedOccurrence = requiredUnique(
      report.selectedOccurrences,
      ({ occurrenceId }) => occurrenceId === expected.claimId,
      `selected occurrence ${expected.claimId}`,
    );
    const coverageOccurrence = coverageByOccurrenceId.get(expected.claimId);
    if (!coverageOccurrence) {
      throw new Error(`Missing coverage link for ${expected.claimId}.`);
    }
    const sourceClaim = requiredUnique(
      slice.sourceClaimCatalog,
      ({ claimId }) => claimId === expected.claimId,
      `source claim ${expected.claimId}`,
    );
    const conditionControl = requiredUnique(
      slice.conditionControls,
      ({ claimId }) => claimId === expected.claimId,
      `condition control ${expected.claimId}`,
    );
    const sourceCell = requiredSourceCell(slice, teamRecordId, expected.claimId);
    const requestProjection = requiredRequestProjection(
      slice,
      teamRecordId,
      expected.claimId,
    );
    if (
      stableJson(requestProjection.sourceControl.predicateRows) !==
        stableJson(sourceCell.predicateRows) ||
      requestProjection.sourceControl.predicateRowsSha256 !==
        hashValue(sourceCell.predicateRows) ||
      requestProjection.sourceControl.reason !== sourceCell.reason ||
      requestProjection.sourceControl.resolution !== sourceCell.resolution ||
      requestProjection.sourceControl.sourceConditionsSha256 !==
        sourceCell.sourceConditionsSha256
    ) {
      throw new Error(
        `Request projection did not preserve source control for ${teamRecordId}:${expected.claimId}.`,
      );
    }
    const factoryDisposition =
      mode === "positive"
        ? "positive-independent-applicability-witness-member"
        : requestProjection.contextApplicability ===
            "source-definitely-inapplicable"
          ? "negative-control-source-definitely-inapplicable"
          : "negative-control-applicable-only";
    return {
      claimId: expected.claimId,
      factoryDisposition,
      selectedOccurrenceSha256: hashValue(selectedOccurrence),
      coverageOccurrenceSha256: hashValue(coverageOccurrence),
      sourceClaimSha256: hashValue(sourceClaim),
      conditionControlSha256: hashValue(conditionControl),
      sourceCellSha256: hashValue(sourceCell),
      requestProjectionSha256: hashValue(requestProjection),
      selectedOccurrence: structuredClone(selectedOccurrence),
      coverageOccurrence: structuredClone(coverageOccurrence),
      sourceClaim: structuredClone(sourceClaim),
      conditionControl: structuredClone(conditionControl),
      sourceCell: structuredClone(sourceCell),
      requestProjection: structuredClone(requestProjection),
      applicabilityProvenance: {
        sourceResolution: sourceCell.resolution,
        contextApplicability: requestProjection.contextApplicability,
        effectiveResolution: requestProjection.resolution,
        requestContextBindingCount:
          requestProjection.requestContextBindings.length,
        sourceControlPreserved: true,
      },
    };
  });
}

function validatePositiveAndNegativeSemantics(
  positive: readonly KleeTeamScopedClaimEvidenceRow[],
  negative: readonly KleeTeamScopedClaimEvidenceRow[],
): void {
  if (
    positive.length !== 4 ||
    negative.length !== 4 ||
    stableJson(positive.map(({ claimId }) => claimId)) !==
      stableJson(EXPECTED_CLAIMS.map(({ claimId }) => claimId)) ||
    stableJson(negative.map(({ claimId }) => claimId)) !==
      stableJson(EXPECTED_CLAIMS.map(({ claimId }) => claimId))
  ) {
    throw new Error("The positive or negative CP27 claim set is not exact.");
  }
  for (const [index, expected] of EXPECTED_CLAIMS.entries()) {
    const positiveRow = positive[index]!;
    const negativeRow = negative[index]!;
    validateExpectedProjection(
      positiveRow,
      expected.sourceResolution,
      expected.positiveContextApplicability,
      FURINA_TEAM_ID,
      expected.claimId !== MARECHAUSSEE_CLAIM_ID,
    );
    validateExpectedProjection(
      negativeRow,
      expected.claimId === MARECHAUSSEE_CLAIM_ID
        ? "inapplicable"
        : expected.sourceResolution,
      expected.negativeContextApplicability,
      OVERLOAD_TEAM_ID,
      expected.claimId !== MARECHAUSSEE_CLAIM_ID,
    );
  }
  const positiveCirclet = positive[0]!.sourceClaim.payload;
  if (
    positiveCirclet.type !== "main-stat" ||
    stableJson(positiveCirclet.statIds) !== stableJson(["cr", "cd"])
  ) {
    throw new Error("The positive witness collapsed or reordered CR/CD.");
  }
}

function validateExpectedProjection(
  row: KleeTeamScopedClaimEvidenceRow,
  sourceResolution: SourceClaimCell["resolution"],
  contextApplicability: RequestProjection["contextApplicability"],
  teamRecordId: string,
  expectsRoleRequestBinding: boolean,
): void {
  if (
    row.sourceCell.resolution !== sourceResolution ||
    row.requestProjection.contextApplicability !== contextApplicability ||
    row.requestProjection.resolution !==
      (contextApplicability === "source-definitely-inapplicable"
        ? "inapplicable"
        : "matched")
  ) {
    throw new Error(
      `Unexpected source/effective applicability for ${teamRecordId}:${row.claimId}.`,
    );
  }
  const bindings = row.requestProjection.requestContextBindings;
  if (!expectsRoleRequestBinding) {
    if (bindings.length !== 0) {
      throw new Error(
        `Roster truth must not use request bindings for ${teamRecordId}:${row.claimId}.`,
      );
    }
    return;
  }
  if (
    bindings.length !== 1 ||
    bindings[0]!.requestPredicate.type !== "intended-role-is" ||
    bindings[0]!.requestPredicate.characterId !== "klee" ||
    bindings[0]!.requestPredicate.roleId !== "on-field-dps" ||
    bindings[0]!.result !== "true" ||
    bindings[0]!.predicateRows.length !== 1
  ) {
    throw new Error(
      `Role applicability must have one exact request binding for ${teamRecordId}:${row.claimId}.`,
    );
  }
  const fact = bindings[0]!.predicateRows[0]!;
  if (
    fact.factProvenance !== "request" ||
    fact.factScope.teamRecordId !== teamRecordId ||
    fact.factScope.characterId !== "klee" ||
    fact.factScope.accountSnapshotId !== null ||
    fact.result !== "true"
  ) {
    throw new Error(
      `Role request fact scope drifted for ${teamRecordId}:${row.claimId}.`,
    );
  }
}

function requiredExactTeam(
  slice: SourceLocalSlice,
  teamRecordId: string,
): ExactTeamControl {
  return requiredUnique(
    slice.exactTeamControls,
    (team) => team.teamRecordId === teamRecordId,
    `exact team ${teamRecordId}`,
  );
}

function requiredSourceCell(
  slice: SourceLocalSlice,
  teamRecordId: string,
  claimId: string,
): SourceClaimCell {
  const teamCells = requiredUnique(
    slice.sourceClaimCells,
    (team) => team.teamRecordId === teamRecordId,
    `source-cell team ${teamRecordId}`,
  );
  return requiredUnique(
    teamCells.claimCells,
    (cell) => cell.claimId === claimId,
    `source cell ${teamRecordId}:${claimId}`,
  );
}

function requiredRequestProjection(
  slice: SourceLocalSlice,
  teamRecordId: string,
  claimId: string,
): RequestProjection {
  const requestContextReport = slice.requestContextReport;
  if (
    requestContextReport == null ||
    requestContextReport.comparisonStatus !== "comparable" ||
    requestContextReport.issues.length !== 0 ||
    requestContextReport.sourceCellsMutated ||
    requestContextReport.energyRecoveryInputsUsed ||
    requestContextReport.summary.assembledBuildCount !== 0
  ) {
    throw new Error("The Klee request-context report is not safely comparable.");
  }
  const teamProjection = requiredUnique(
    requestContextReport.teamProjections,
    (team) => team.teamRecordId === teamRecordId,
    `request-projection team ${teamRecordId}`,
  );
  return requiredUnique(
    teamProjection.claimProjections,
    (projection) => projection.claimId === claimId,
    `request projection ${teamRecordId}:${claimId}`,
  );
}

function selectSourceFiles(
  sourceFiles: readonly KleeTeamScopedClaimJoinWitnessSourceFile[],
  exactPaths: readonly string[],
): KleeTeamScopedClaimJoinWitnessSourceFile[] {
  return exactPaths.map((exactPath) => {
    const sourceFile = sourceFiles.find(({ path: sourcePath }) =>
      sourcePath === exactPath,
    );
    if (!sourceFile) throw new Error(`Missing source file ${exactPath}.`);
    return { ...sourceFile };
  });
}

function selectGeneratedFrom(
  generatedFrom: readonly GeneratedFromEntry[],
  exactPaths: readonly string[],
): GeneratedFromEntry[] {
  return [...exactPaths]
    .sort(compareText)
    .map((exactPath) => ({
      path: exactPath,
      sha256: requiredGeneratedHash(generatedFrom, exactPath),
    }));
}

function requiredGeneratedHash(
  generatedFrom: readonly GeneratedFromEntry[],
  exactPath: string,
): string {
  const matches = generatedFrom.filter(({ path: entryPath }) =>
    entryPath === exactPath,
  );
  if (matches.length !== 1 || !matches[0]) {
    throw new Error(`Expected one generatedFrom entry for ${exactPath}.`);
  }
  return matches[0].sha256;
}

function requiredUnique<T>(
  rows: readonly T[],
  predicate: (row: T) => boolean,
  label: string,
): T {
  const matches = rows.filter(predicate);
  if (matches.length !== 1 || !matches[0]) {
    throw new Error(`Expected exactly one ${label}, found ${matches.length}.`);
  }
  return matches[0];
}

function failedReport(
  generatedFrom: GeneratedFromEntry[],
  message: string,
): KleeTeamScopedClaimJoinWitnessReport {
  return {
    schemaVersion: 1,
    reportType: "klee-team-scoped-condition-resolved-claim-join-witness",
    witnessId: WITNESS_ID,
    classification: "authenticated-descriptive-independent-applicability-witness",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-unreviewed-factory-evidence-join",
    sameTeamIndependentApplicabilityJoinExecuted: false,
    ...CAPABILITY_BOUNDARY,
    generatedFrom,
    rawInputBoundary: {
      status: "rejected",
      exactPathSet: false,
      byteAndParsedObjectClosure: false,
      sourceFileCount: 0,
    },
    upstreamBoundary: {
      status: "rejected",
      dag: [
        "raw-klee-records",
        "authenticated-klee-source-local-slice",
        "current-condition-binding-catalog",
        "authenticated-manual-condition-coverage",
        "klee-team-scoped-claim-join-witness",
      ],
      klee: {
        durableReportPath: KLEE_REPORT_RELATIVE_PATH,
        durableReportFileSha256: null,
        durableReportCanonicalObjectSha256: null,
        freshlyAuthenticated: false,
        sliceId: null,
        selectedOccurrenceCount: 0,
        holdoutOccurrenceCount: 0,
        sourceTeamCount: 0,
      },
      manualCoverage: {
        durableReportPath: MANUAL_COVERAGE_REPORT_RELATIVE_PATH,
        durableReportFileSha256: null,
        durableReportCanonicalObjectSha256: null,
        currentBoundaryAuthenticated: false,
        corpusOccurrenceCount: 0,
        bindingOccurrenceCount: 0,
        kleeSourceLocalOccurrenceCount: 0,
        typedBindingMeansConditionTruth: false,
      },
      exactCrossLinkedOccurrenceCount: 0,
      exactCrossLinkedOccurrenceIds: [],
    },
    authorshipBoundary: {
      sourceTeamAndClaimEvidencePreservedFromAuthenticatedSlice: true,
      sourceCellsPreservedVerbatim: true,
      requestProjectionsPreservedVerbatim: true,
      crossRecordJoinAuthoredBy: "guide-factory",
      sourceAuthoredCrossRecordJoin: false,
      sourceAuthoredBuild: false,
      sourceAuthoredCrossRecordOrdering: false,
      requestRoleFactsAuthoredBy: "guide-factory-explicit-fixture",
      recommendationMetadataUsedAsConditionTruth: false,
    },
    selectedAndHoldoutBoundary: null,
    positiveWitness: null,
    negativeControl: null,
    summary: {
      positiveWitnessCount: 0,
      positiveClaimCount: 0,
      positiveSourceRecordCount: 0,
      negativeControlTeamCount: 0,
      negativeControlApplicableClaimCount: 0,
      negativeControlInapplicableClaimCount: 0,
      crossLinkedCoverageOccurrenceCount: 0,
      assembledBuildCount: 0,
      candidateCount: 0,
    },
    issues: [
      {
        code: "klee-team-claim-join.not-comparable",
        path: "input",
        message,
      },
    ],
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}
