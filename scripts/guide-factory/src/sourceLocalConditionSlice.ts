import {
  buildGuideRequestContextApplicabilityReport,
  type GuideRequestClaimRule,
  type GuideRequestContext,
  type GuideRequestContextApplicabilityReport,
  type GuideRequestContextPredicateAst,
} from "./guideRequestContext";
import { sha256Text, stableJson } from "./io";
import {
  buildSourceConditionedGuidePacketReport,
  type GeneratedFromEntry,
  type SourceConditionedAtomicClaim,
  type SourceConditionedClaimCell,
  type SourceConditionedGuidePacketInput,
  type SourceConditionedGuidePacketIssue,
  type SourceConditionedGuidePacketReport,
  type SourceConditionPredicateAst,
  type SourceTeamPacketInput,
} from "./sourceConditionedGuidePacket";

export type SourceLocalConditionRequestContext = {
  requestFactsByTeamRecordId?: Readonly<
    Record<
      string,
      {
        characterFactsById?: Readonly<
          Record<
            string,
            {
              intendedRole?: string;
              optimizationGoal?: string;
            }
          >
        >;
      }
    >
  >;
};

export type SourceLocalConditionRequestPredicateAst =
  | {
      type: "all";
      predicates: SourceLocalConditionRequestPredicateAst[];
    }
  | {
      type: "any";
      predicates: SourceLocalConditionRequestPredicateAst[];
    }
  | { type: "intended-role-is"; characterId: string; roleId: string }
  | {
      type: "optimization-goal-is";
      characterId: string;
      goalId: string;
    };

export type SourceLocalConditionRequestBinding = {
  /** Must name an exact `unresolved-context` leaf in the source predicate. */
  sourcePredicatePath: string;
  sourcePredicateLeafSha256: string;
  requestPredicate: SourceLocalConditionRequestPredicateAst;
};

export type SourceLocalConditionOccurrenceControl = {
  occurrenceId: string;
  snapshotPath: string;
  sourceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  manualPath: string;
  manualClaimPath: string;
  repositoryJsonPath: string;
  claimAxis:
    | "weapon-recommendation"
    | "artifact-recommendation"
    | "main-stat"
    | "substat";
  mainStatSlot?: "sands" | "goblet" | "circlet";
  repositoryParity: "exact";
  sliceDisposition: "selected";
  energyClassification: "not-energy-deferred";
  sourceConditionsSha256: string;
  sourcePredicateSha256: string;
  payloadSha256: string;
};

export type SourceLocalConditionClaimInput = {
  claim: SourceConditionedAtomicClaim;
  occurrenceControl: SourceLocalConditionOccurrenceControl;
  requestBindings: readonly SourceLocalConditionRequestBinding[];
};

export type SourceLocalExactTeamInput = {
  packetIndex: number;
  teamRecordId: string;
  snapshotPath: string;
  sourceId: string;
  sourceRecordId: string;
  label: string | null;
  intent: "example" | "prescriptive";
  exhaustiveness: "non-exhaustive" | "exhaustive" | "unspecified";
  rankingClaim: "none" | "ordered" | "unordered";
  memberCharacterIds: readonly [string, string, string, string];
};

export type SourceLocalConditionSliceExpectedCounts = {
  claimCount: number;
  teamCount: number;
  cellCount: number;
  sourceResolution: {
    matched: number;
    inapplicable: number;
    unresolved: number;
  };
  effectiveResolution: {
    matched: number;
    inapplicable: number;
    unresolved: number;
  };
  contextApplicability: {
    sourceAlreadyMatched: number;
    sourceDefinitelyInapplicable: number;
    applicableUnderSuppliedContext: number;
    notApplicableUnderSuppliedContext: number;
    stillUnresolved: number;
  };
};

export type SourceLocalConditionSliceInput = {
  sliceId: string;
  generatedFrom: readonly GeneratedFromEntry[];
  sourceBoundary: {
    sourceId: string;
    pageUrl: string;
    sourceVersion: string;
    snapshotPath: string;
    rawManualSourceRecordIds: readonly string[];
    consolidatedGuideRecordIds: readonly string[];
    extractionMethod: string;
    reviewStatus: string;
    sourceRegistryStatus: string;
    sourceRegistryPermission: string;
    repositoryRecordStatus: string;
    sourceHashes: readonly GeneratedFromEntry[];
  };
  claims: readonly SourceLocalConditionClaimInput[];
  exactTeams: readonly SourceLocalExactTeamInput[];
  requestContext?: SourceLocalConditionRequestContext;
  expectedCounts: SourceLocalConditionSliceExpectedCounts;
  cautions: readonly string[];
  prohibitedInterpretations: readonly string[];
};

export type SourceLocalConditionSliceReport = {
  schemaVersion: 1;
  reportType: "source-local-condition-slice-report";
  sliceId: string;
  classification: "descriptive-source-local-condition-applicability-slice";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-experimental-source-slice";
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsBuildRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  playerFacingRecommendations: false;
  ranking: false;
  buildComposition: false;
  damage: false;
  formulas: false;
  rotations: false;
  ER: false;
  recommendationCompositionExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  damageComputationExecuted: false;
  energyRecoveryComputationExecuted: false;
  assembledBuildCount: 0;
  generatedFrom: GeneratedFromEntry[];
  sourceDocumentBoundary: {
    status: "accepted" | "rejected";
    sourceId: string;
    pageUrl: string;
    sourceVersion: string;
    snapshotPath: string;
    exactOccurrenceIds: string[];
    exactTeamRecordIds: string[];
    allClaimsAndTeamsShareExactSourceDocument: boolean;
  };
  compositionPolicy: {
    sourcePredicateEvaluationOwner: "source-conditioned-guide-packet-core";
    requestContextEvaluationOwner: "guide-request-context-core";
    sourceCellsPreservedVerbatim: true;
    requestProjectionsPreservedVerbatim: true;
    verboseSourcePacketAdapterMetadataExposed: false;
    arbitraryEnglishParsingAllowed: false;
    conditionTruthEstablishedFromRecommendationMetadata: false;
    requestContextMayReplaceExactRosterFacts: false;
    requestFactsMustBeExactTeamAndCharacterScoped: true;
    omittedRequestFacts: "unknown";
    energyPrerequisitesAcceptedInSlice: false;
    teamTemplateEvaluation: "not-evaluated";
    presetOverlapEvaluation: "not-evaluated";
  };
  conditionControls: Array<{
    claimId: string;
    catalogIndex: number;
    occurrenceControl: SourceLocalConditionOccurrenceControl;
    requestBindings: SourceLocalConditionRequestBinding[];
  }>;
  exactTeamControls: SourceLocalExactTeamInput[];
  sourceClaimCatalog: SourceConditionedAtomicClaim[];
  sourceClaimCells: Array<{
    packetIndex: number;
    teamRecordId: string;
    claimCells: SourceConditionedClaimCell[];
  }>;
  requestContextReport: GuideRequestContextApplicabilityReport | null;
  summary: {
    claimCount: number;
    teamCount: number;
    cellCount: number;
    sourceMatchedCount: number;
    sourceInapplicableCount: number;
    sourceUnresolvedCount: number;
    effectiveMatchedCount: number;
    effectiveInapplicableCount: number;
    effectiveUnresolvedCount: number;
    sourceAlreadyMatchedCount: number;
    sourceDefinitelyInapplicableCount: number;
    applicableUnderSuppliedContextCount: number;
    notApplicableUnderSuppliedContextCount: number;
    stillUnresolvedCount: number;
    deferredEnergyCount: 0;
    assembledBuildCount: 0;
  };
  issues: SourceConditionedGuidePacketIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
};

export type SourceLocalConditionSliceAuthentication =
  | {
      authenticated: true;
      canonicalReport: SourceLocalConditionSliceReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: SourceConditionedGuidePacketIssue[];
    };

const NEUTRAL_TEMPLATE_ID =
  "not-evaluated:source-local-condition-slice" as const;

const CAPABILITY_BOUNDARY = {
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsBuildRecommendations: false,
  supportsStatRecommendations: false,
  supportsRankClaims: false,
  supportsDamageClaims: false,
  supportsRotationClaims: false,
  supportsEnergyRecoveryClaims: false,
  playerFacingRecommendations: false,
  ranking: false,
  buildComposition: false,
  damage: false,
  formulas: false,
  rotations: false,
  ER: false,
  recommendationCompositionExecuted: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  damageComputationExecuted: false,
  energyRecoveryComputationExecuted: false,
  assembledBuildCount: 0,
} as const;

const COMPOSITION_POLICY = {
  sourcePredicateEvaluationOwner: "source-conditioned-guide-packet-core",
  requestContextEvaluationOwner: "guide-request-context-core",
  sourceCellsPreservedVerbatim: true,
  requestProjectionsPreservedVerbatim: true,
  verboseSourcePacketAdapterMetadataExposed: false,
  arbitraryEnglishParsingAllowed: false,
  conditionTruthEstablishedFromRecommendationMetadata: false,
  requestContextMayReplaceExactRosterFacts: false,
  requestFactsMustBeExactTeamAndCharacterScoped: true,
  omittedRequestFacts: "unknown",
  energyPrerequisitesAcceptedInSlice: false,
  teamTemplateEvaluation: "not-evaluated",
  presetOverlapEvaluation: "not-evaluated",
} as const;

/**
 * Compose the existing source-condition and request-context evaluators over a
 * deliberately small, exact source-document slice. This adapter authenticates
 * occurrence/payload/predicate controls, but does not interpret source prose.
 */
export function buildSourceLocalConditionSliceReport(
  input: SourceLocalConditionSliceInput,
): SourceLocalConditionSliceReport {
  const prevalidationIssues = validateInput(input);
  const generatedFrom = canonicalGeneratedFrom(input.generatedFrom);
  const claims = canonicalClaims(input.claims);
  const exactTeams = canonicalTeams(input.exactTeams);
  const sourceInput: SourceConditionedGuidePacketInput = {
    experimentId: input.sliceId,
    generatedFrom,
    sourceBoundary: {
      sourceId: input.sourceBoundary.sourceId,
      pageUrl: input.sourceBoundary.pageUrl,
      sourceVersion: input.sourceBoundary.sourceVersion,
      rawManualSourceRecordIds: [
        ...input.sourceBoundary.rawManualSourceRecordIds,
      ].sort(),
      consolidatedGuideRecordIds: [
        ...input.sourceBoundary.consolidatedGuideRecordIds,
      ].sort(),
      templateRecordId: NEUTRAL_TEMPLATE_ID,
      exactTeamRecordIds: exactTeams.map(({ teamRecordId }) => teamRecordId),
      extractionMethod: input.sourceBoundary.extractionMethod,
      reviewStatus: input.sourceBoundary.reviewStatus,
      sourceRegistryStatus: input.sourceBoundary.sourceRegistryStatus,
      sourceRegistryPermission: input.sourceBoundary.sourceRegistryPermission,
      repositoryRecordStatus: input.sourceBoundary.repositoryRecordStatus,
      promotionEligible: false as const,
      sourceHashes: canonicalGeneratedFrom(input.sourceBoundary.sourceHashes),
    },
    policyBoundary: {
      crossRecordJoinOwner: "guide-factory-wrapper" as const,
      sourceAuthoredCrossRecordJoin: false as const,
      conditionResolutionPolicy:
        "pinned-exact-condition-array-hash-to-typed-predicate-map" as const,
      arbitraryEnglishParsingAllowed: false as const,
      conditionMap: Object.fromEntries(
        claims.map(({ claim }) => [
          claim.claimId,
          {
            sourceConditionsSha256: claim.sourceConditionsSha256,
            predicate: structuredClone(claim.predicate),
          },
        ]),
      ),
      allowedStructuredFacts: [
        "exact-source-team-roster",
        "exact-catalog-identity",
        "source-and-baseline-constellation-scope",
      ],
      disallowedStructuredFacts: [
        "gameplay-sequence",
        "account-inventory",
        "player-preference",
      ],
      investmentComparisonScope: "constellation-only" as const,
      talentLevelsEvaluated: false as const,
    },
    sourceClaimCatalog: claims.map(({ claim }) => structuredClone(claim)),
    teamPackets: exactTeams.map(neutralSourceTeamPacket),
    expectedCounts: {
      packetCount: input.expectedCounts.teamCount,
      sourceClaimCount: input.expectedCounts.claimCount,
      claimCellCount: input.expectedCounts.cellCount,
    },
    prevalidationIssues,
    cautions: [...input.cautions],
    prohibitedInterpretations: [...input.prohibitedInterpretations],
  };
  const sourceControlReport = buildSourceConditionedGuidePacketReport(sourceInput);

  const requestContextReport =
    sourceControlReport.comparisonStatus === "comparable"
      ? buildGuideRequestContextApplicabilityReport({
          projectionId: `${input.sliceId}:request-context`,
          sourceReport: sourceControlReport,
          context: canonicalRequestContext(input.requestContext),
          claimRules: requestRules(claims),
        })
      : null;

  const issues = dedupeIssues([
    ...sourceControlReport.issues,
    ...(requestContextReport?.issues ?? []),
  ]);
  const summary = summarize(sourceControlReport, requestContextReport);
  if (
    sourceControlReport.comparisonStatus === "comparable" &&
    requestContextReport?.comparisonStatus === "comparable"
  ) {
    validateExpectedCounts(summary, input.expectedCounts, issues);
  }
  if (sourceControlReport.summary.deferredEnergyCellCount !== 0) {
    issues.push({
      code: "source-local-slice.deferred-energy-cell",
      path: "sourceControlReport.summary.deferredEnergyCellCount",
      message:
        "A source-local non-energy condition slice cannot contain deferred energy cells.",
    });
  }
  if ((requestContextReport?.summary.deferredEnergyCellCount ?? 0) !== 0) {
    issues.push({
      code: "source-local-slice.deferred-energy-projection",
      path: "requestContextReport.summary.deferredEnergyCellCount",
      message:
        "A source-local non-energy condition slice cannot project deferred energy prerequisites.",
    });
  }

  const comparable = issues.length === 0;
  return {
    schemaVersion: 1,
    reportType: "source-local-condition-slice-report",
    sliceId: input.sliceId,
    classification: "descriptive-source-local-condition-applicability-slice",
    comparisonStatus: comparable ? "comparable" : "not-comparable",
    publicationStatus: "withheld-experimental-source-slice",
    ...CAPABILITY_BOUNDARY,
    generatedFrom,
    sourceDocumentBoundary: {
      status: comparable ? "accepted" : "rejected",
      sourceId: input.sourceBoundary.sourceId,
      pageUrl: input.sourceBoundary.pageUrl,
      sourceVersion: input.sourceBoundary.sourceVersion,
      snapshotPath: input.sourceBoundary.snapshotPath,
      exactOccurrenceIds: claims.map(
        ({ occurrenceControl }) => occurrenceControl.occurrenceId,
      ),
      exactTeamRecordIds: exactTeams.map(({ teamRecordId }) => teamRecordId),
      allClaimsAndTeamsShareExactSourceDocument:
        !issues.some(({ code }) =>
          code.startsWith("source-local-slice.source-document"),
        ),
    },
    compositionPolicy: COMPOSITION_POLICY,
    conditionControls: claims.map(
      ({ claim, occurrenceControl, requestBindings }) => ({
        claimId: claim.claimId,
        catalogIndex: claim.catalogIndex,
        occurrenceControl: structuredClone(occurrenceControl),
        requestBindings: requestBindings.map((binding) =>
          structuredClone(binding),
        ),
      }),
    ),
    exactTeamControls: exactTeams.map((team) => structuredClone(team)),
    sourceClaimCatalog: sourceControlReport.sourceClaimCatalog.map((claim) =>
      structuredClone(claim),
    ),
    sourceClaimCells: sourceControlReport.teamPackets.map(
      ({ packetIndex, teamRecordId, claimCells }) => ({
        packetIndex,
        teamRecordId,
        claimCells: claimCells.map((cell) => structuredClone(cell)),
      }),
    ),
    requestContextReport,
    summary,
    issues: dedupeIssues(issues),
    cautions: [...input.cautions],
    prohibitedInterpretations: [...input.prohibitedInterpretations],
  };
}

/** Rebuild before trusting a serialized source-local slice report. */
export function authenticateSourceLocalConditionSliceReport(
  serializedReport: SourceLocalConditionSliceReport,
  input: SourceLocalConditionSliceInput,
): SourceLocalConditionSliceAuthentication {
  const canonicalReport = buildSourceLocalConditionSliceReport(input);
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
          code: "source-local-slice.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized source-local condition slice does not match the canonical report rebuilt from current inputs.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

function neutralSourceTeamPacket(
  team: SourceLocalExactTeamInput,
): SourceTeamPacketInput {
  return {
    packetIndex: team.packetIndex,
    teamRecordId: team.teamRecordId,
    sourceId: team.sourceId,
    sourceRecordId: team.sourceRecordId,
    label: team.label,
    intent: team.intent,
    exhaustiveness: team.exhaustiveness,
    rankingClaim: team.rankingClaim,
    members: team.memberCharacterIds.map((characterId) => ({
      characterId,
      rawSourceInvestment: {},
      investment: { status: "unspecified" as const },
    })),
    unknowns: [
      "Gameplay template membership and preset overlap were not evaluated for this source-local condition slice.",
    ],
    templateStructuralResult: {
      templateId: NEUTRAL_TEMPLATE_ID,
      representation: "structural-runtime-representation-not-gameplay-proof",
      declaredReactions: [],
      reactionGate: "TeamMeta.hasReaction",
      actualOutcome: "template-withheld",
      structuralMembership: null,
      acceptedMembership: null,
      structuralAssignmentMultiplicity: null,
      reactionById: null,
      runtimeGateExecutedForStructuralCandidates: false,
      supportsGameplayProof: false,
    },
    presetOverlap: {
      rosterStatus: "uncovered",
      presetTeamId: null,
      rosterComparison: "exact-unordered-character-ids",
      investmentStatus: "not-evaluated-roster-uncovered",
      memberInvestmentComparisons: [],
    },
  };
}

function requestRules(
  claims: readonly SourceLocalConditionClaimInput[],
): GuideRequestClaimRule[] {
  return claims
    .filter(({ requestBindings }) => requestBindings.length > 0)
    .map(({ claim, occurrenceControl, requestBindings }) => ({
      claimId: claim.claimId,
      sourceConditionsSha256: occurrenceControl.sourceConditionsSha256,
      sourcePredicateSha256: occurrenceControl.sourcePredicateSha256,
      bindings: requestBindings.map((binding) => ({
        sourcePredicatePath: binding.sourcePredicatePath,
        sourcePredicateLeafSha256: binding.sourcePredicateLeafSha256,
        requestPredicate: structuredClone(
          binding.requestPredicate,
        ) as GuideRequestContextPredicateAst,
      })),
    }));
}

function validateInput(
  input: SourceLocalConditionSliceInput,
): SourceConditionedGuidePacketIssue[] {
  const issues: SourceConditionedGuidePacketIssue[] = [];
  const issue = (code: string, path: string, message: string): void => {
    issues.push({ code, path, message });
  };
  if (input.sliceId.length === 0) {
    issue(
      "source-local-slice.empty-slice-id",
      "sliceId",
      "Source-local slice ID must be non-empty.",
    );
  }
  for (const [field, value] of Object.entries({
    sourceId: input.sourceBoundary.sourceId,
    pageUrl: input.sourceBoundary.pageUrl,
    sourceVersion: input.sourceBoundary.sourceVersion,
    snapshotPath: input.sourceBoundary.snapshotPath,
  })) {
    if (value.length === 0) {
      issue(
        "source-local-slice.empty-source-boundary-field",
        `sourceBoundary.${field}`,
        "Source-document boundary fields must be non-empty.",
      );
    }
  }
  validateExactStringSet(
    input.sourceBoundary.rawManualSourceRecordIds,
    "sourceBoundary.rawManualSourceRecordIds",
    issues,
  );
  validateExactStringSet(
    input.sourceBoundary.consolidatedGuideRecordIds,
    "sourceBoundary.consolidatedGuideRecordIds",
    issues,
  );
  if (input.claims.length === 0) {
    issue(
      "source-local-slice.empty-claims",
      "claims",
      "A source-local condition slice requires at least one exact claim.",
    );
  }
  if (input.exactTeams.length === 0) {
    issue(
      "source-local-slice.empty-teams",
      "exactTeams",
      "A source-local condition slice requires at least one exact team.",
    );
  }

  const occurrenceIds = new Set<string>();
  const claimCharacters = new Set<string>();
  input.claims.forEach((entry, index) => {
    const path = `claims[${index}]`;
    const { claim, occurrenceControl: control } = entry;
    claimCharacters.add(claim.characterId);
    if (
      control.occurrenceId.length === 0 ||
      occurrenceIds.has(control.occurrenceId)
    ) {
      issue(
        "source-local-slice.duplicate-or-empty-occurrence",
        `${path}.occurrenceControl.occurrenceId`,
        "Exact occurrence IDs must be unique and non-empty.",
      );
    }
    occurrenceIds.add(control.occurrenceId);
    validateSourceDocumentIdentity(
      control.sourceId,
      control.snapshotPath,
      input,
      `${path}.occurrenceControl`,
      issues,
    );
    for (const [field, value] of Object.entries({
      sourceRecordId: control.sourceRecordId,
      repositoryRecordId: control.repositoryRecordId,
      manualPath: control.manualPath,
      manualClaimPath: control.manualClaimPath,
      repositoryJsonPath: control.repositoryJsonPath,
    })) {
      if (value.length === 0) {
        issue(
          "source-local-slice.empty-occurrence-field",
          `${path}.occurrenceControl.${field}`,
          "Exact occurrence identity and paths must be non-empty.",
        );
      }
    }
    if (
      claim.sourceId !== control.sourceId ||
      claim.sourceRecordId !== control.sourceRecordId ||
      claim.repositoryRecordId !== control.repositoryRecordId
    ) {
      issue(
        "source-local-slice.claim-occurrence-identity-mismatch",
        path,
        "Claim source/repository identity must exactly match its occurrence control.",
      );
    }
    if (
      !input.sourceBoundary.rawManualSourceRecordIds.includes(
        claim.sourceRecordId,
      ) ||
      !input.sourceBoundary.consolidatedGuideRecordIds.includes(
        claim.repositoryRecordId,
      )
    ) {
      issue(
        "source-local-slice.claim-outside-source-boundary",
        path,
        "Claim source and repository record IDs must be declared by the exact source boundary.",
      );
    }
    if (claim.sourceConditions.length === 0) {
      issue(
        "source-local-slice.unconditional-claim",
        `${path}.claim.sourceConditions`,
        "A condition slice may select only nonempty exact condition arrays.",
      );
    }
    validatePinnedHash(
      control.sourceConditionsSha256,
      claim.sourceConditions,
      `${path}.occurrenceControl.sourceConditionsSha256`,
      "source condition array",
      issues,
    );
    if (claim.sourceConditionsSha256 !== control.sourceConditionsSha256) {
      issue(
        "source-local-slice.claim-condition-control-mismatch",
        `${path}.claim.sourceConditionsSha256`,
        "Claim condition hash must equal the exact occurrence control hash.",
      );
    }
    validatePinnedHash(
      control.sourcePredicateSha256,
      claim.predicate,
      `${path}.occurrenceControl.sourcePredicateSha256`,
      "typed source predicate",
      issues,
    );
    validatePinnedHash(
      control.payloadSha256,
      claim.payload,
      `${path}.occurrenceControl.payloadSha256`,
      "exact claim payload",
      issues,
    );
    if (
      control.repositoryParity !== "exact" ||
      control.sliceDisposition !== "selected" ||
      control.energyClassification !== "not-energy-deferred"
    ) {
      issue(
        "source-local-slice.invalid-occurrence-classification",
        `${path}.occurrenceControl`,
        "Slice-selected occurrences must have exact repository parity and an explicitly authored not-energy-deferred classification.",
      );
    }
    validatePayloadAxis(entry, path, issues);
    if (containsDeferredEnergy(claim.predicate)) {
      issue(
        "source-local-slice.energy-predicate-forbidden",
        `${path}.claim.predicate`,
        "Deferred energy prerequisites are outside this source-local condition slice.",
      );
    }
    validateRequestBindings(entry, path, issues);
  });

  const teamIds = new Set<string>();
  input.exactTeams.forEach((team, index) => {
    const path = `exactTeams[${index}]`;
    if (team.teamRecordId.length === 0 || teamIds.has(team.teamRecordId)) {
      issue(
        "source-local-slice.duplicate-or-empty-team",
        `${path}.teamRecordId`,
        "Exact team record IDs must be unique and non-empty.",
      );
    }
    teamIds.add(team.teamRecordId);
    validateSourceDocumentIdentity(
      team.sourceId,
      team.snapshotPath,
      input,
      path,
      issues,
    );
    if (
      !input.sourceBoundary.rawManualSourceRecordIds.includes(
        team.sourceRecordId,
      )
    ) {
      issue(
        "source-local-slice.team-outside-source-boundary",
        `${path}.sourceRecordId`,
        "Exact team source record must be declared by the source boundary.",
      );
    }
    const memberIds = [...team.memberCharacterIds];
    if (
      memberIds.length !== 4 ||
      new Set(memberIds).size !== 4 ||
      memberIds.some((memberId) => memberId.length === 0)
    ) {
      issue(
        "source-local-slice.invalid-exact-team",
        `${path}.memberCharacterIds`,
        "Each exact source team must contain four distinct non-empty character IDs.",
      );
    }
    for (const characterId of claimCharacters) {
      if (!memberIds.includes(characterId)) {
        issue(
          "source-local-slice.claim-character-outside-team",
          `${path}.memberCharacterIds`,
          `Exact team does not contain selected claim character ${characterId}.`,
        );
      }
    }
  });
  validateContiguousIndexes(
    input.claims.map(({ claim }) => claim.catalogIndex),
    "claims",
    issues,
  );
  validateContiguousIndexes(
    input.exactTeams.map(({ packetIndex }) => packetIndex),
    "exactTeams",
    issues,
  );
  validateRequestContext(input.requestContext, input.exactTeams, issues);
  validateExpectedCountShape(input.expectedCounts, issues);
  return dedupeIssues(issues);
}

function validateSourceDocumentIdentity(
  sourceId: string,
  snapshotPath: string,
  input: SourceLocalConditionSliceInput,
  path: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  if (
    sourceId !== input.sourceBoundary.sourceId ||
    snapshotPath !== input.sourceBoundary.snapshotPath
  ) {
    issues.push({
      code: "source-local-slice.source-document-mismatch",
      path,
      message:
        "Every selected claim and team must come from the exact same source ID and manual snapshot document.",
    });
  }
}

function validatePayloadAxis(
  entry: SourceLocalConditionClaimInput,
  path: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const { claim, occurrenceControl } = entry;
  const expectedPayloadType = {
    "weapon-recommendation": "weapon-group",
    "artifact-recommendation": "artifact-group",
    "main-stat": "main-stat",
    substat: "substat",
  }[occurrenceControl.claimAxis];
  if (claim.payload.type !== expectedPayloadType) {
    issues.push({
      code: "source-local-slice.payload-axis-mismatch",
      path: `${path}.claim.payload.type`,
      message: "Exact payload type must match the occurrence claim axis.",
    });
  }
  if (
    occurrenceControl.claimAxis === "main-stat" &&
    (claim.payload.type !== "main-stat" ||
      claim.payload.slot !== occurrenceControl.mainStatSlot)
  ) {
    issues.push({
      code: "source-local-slice.main-stat-slot-mismatch",
      path: `${path}.occurrenceControl.mainStatSlot`,
      message: "Main-stat payload slot must match its exact occurrence slot.",
    });
  }
  if (
    occurrenceControl.claimAxis !== "main-stat" &&
    occurrenceControl.mainStatSlot != null
  ) {
    issues.push({
      code: "source-local-slice.unexpected-main-stat-slot",
      path: `${path}.occurrenceControl.mainStatSlot`,
      message: "Only main-stat occurrences may declare a main-stat slot.",
    });
  }
}

function validateRequestBindings(
  entry: SourceLocalConditionClaimInput,
  path: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const seenPaths = new Set<string>();
  entry.requestBindings.forEach((binding, index) => {
    const bindingPath = `${path}.requestBindings[${index}]`;
    if (
      binding.sourcePredicatePath.length === 0 ||
      seenPaths.has(binding.sourcePredicatePath)
    ) {
      issues.push({
        code: "source-local-slice.duplicate-or-empty-binding-path",
        path: `${bindingPath}.sourcePredicatePath`,
        message: "Request bindings require unique non-empty source leaf paths.",
      });
    }
    seenPaths.add(binding.sourcePredicatePath);
    const node = predicateNodeAtPath(
      entry.claim.predicate,
      binding.sourcePredicatePath,
    );
    validatePinnedHash(
      binding.sourcePredicateLeafSha256,
      node,
      `${bindingPath}.sourcePredicateLeafSha256`,
      "exact source predicate leaf",
      issues,
    );
    if (!node || node.type !== "unresolved-context") {
      issues.push({
        code: "source-local-slice.binding-target-not-unresolved",
        path: `${bindingPath}.sourcePredicatePath`,
        message:
          "Request context may bind only an exact unresolved-context leaf; roster and energy facts remain source-owned.",
      });
    }
    validateLocalRequestPredicate(
      binding.requestPredicate,
      entry.claim.characterId,
      `${bindingPath}.requestPredicate`,
      issues,
    );
  });
}

function validateLocalRequestPredicate(
  predicate: SourceLocalConditionRequestPredicateAst,
  claimCharacterId: string,
  path: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  if (predicate.type === "all" || predicate.type === "any") {
    if (predicate.predicates.length === 0) {
      issues.push({
        code: "source-local-slice.empty-request-predicate",
        path: `${path}.predicates`,
        message: "Composite request predicates require at least one child.",
      });
    }
    predicate.predicates.forEach((child, index) =>
      validateLocalRequestPredicate(
        child,
        claimCharacterId,
        `${path}.predicates[${index}]`,
        issues,
      ),
    );
    return;
  }
  const operand =
    predicate.type === "intended-role-is"
      ? predicate.roleId
      : predicate.goalId;
  if (
    predicate.characterId.length === 0 ||
    operand.length === 0 ||
    predicate.characterId !== claimCharacterId
  ) {
    issues.push({
      code: "source-local-slice.invalid-character-request-predicate",
      path,
      message:
        "Role/goal bindings require non-empty operands and must be scoped to the selected claim character.",
    });
  }
}

function validateRequestContext(
  context: SourceLocalConditionRequestContext | undefined,
  teams: readonly SourceLocalExactTeamInput[],
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const teamMembers = new Map(
    teams.map((team) => [team.teamRecordId, new Set(team.memberCharacterIds)]),
  );
  for (const [teamRecordId, teamFacts] of Object.entries(
    context?.requestFactsByTeamRecordId ?? {},
  )) {
    const members = teamMembers.get(teamRecordId);
    if (!members) {
      issues.push({
        code: "source-local-slice.request-facts-unknown-team",
        path: `requestContext.requestFactsByTeamRecordId.${teamRecordId}`,
        message: "Request facts must name an exact selected source team.",
      });
      continue;
    }
    for (const [characterId, facts] of Object.entries(
      teamFacts.characterFactsById ?? {},
    )) {
      const path = `requestContext.requestFactsByTeamRecordId.${teamRecordId}.characterFactsById.${characterId}`;
      if (!members.has(characterId)) {
        issues.push({
          code: "source-local-slice.request-facts-character-outside-team",
          path,
          message:
            "Character request facts must be scoped independently to a member of the exact selected team.",
        });
      }
      if (
        (facts.intendedRole != null && facts.intendedRole.length === 0) ||
        (facts.optimizationGoal != null &&
          facts.optimizationGoal.length === 0)
      ) {
        issues.push({
          code: "source-local-slice.empty-request-fact",
          path,
          message: "Supplied role and goal facts must be non-empty strings.",
        });
      }
    }
  }
}

function validateExpectedCountShape(
  expected: SourceLocalConditionSliceExpectedCounts,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const entries = flattenCountEntries(expected);
  for (const [path, count] of entries) {
    if (!Number.isSafeInteger(count) || count < 0) {
      issues.push({
        code: "source-local-slice.invalid-expected-count",
        path: `expectedCounts.${path}`,
        message: "Expected counts must be non-negative safe integers.",
      });
    }
  }
  if (expected.claimCount * expected.teamCount !== expected.cellCount) {
    issues.push({
      code: "source-local-slice.invalid-expected-cell-product",
      path: "expectedCounts.cellCount",
      message: "Expected cell count must equal claim count times team count.",
    });
  }
  for (const [path, counts] of [
    ["sourceResolution", expected.sourceResolution],
    ["effectiveResolution", expected.effectiveResolution],
    ["contextApplicability", expected.contextApplicability],
  ] as const) {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (total !== expected.cellCount) {
      issues.push({
        code: "source-local-slice.invalid-expected-partition",
        path: `expectedCounts.${path}`,
        message: "Each expected result partition must sum to the exact cell count.",
      });
    }
  }
}

function validateExpectedCounts(
  summary: SourceLocalConditionSliceReport["summary"],
  expected: SourceLocalConditionSliceExpectedCounts,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const comparisons: Array<[string, number, number]> = [
    ["claimCount", summary.claimCount, expected.claimCount],
    ["teamCount", summary.teamCount, expected.teamCount],
    ["cellCount", summary.cellCount, expected.cellCount],
    ["sourceResolution.matched", summary.sourceMatchedCount, expected.sourceResolution.matched],
    ["sourceResolution.inapplicable", summary.sourceInapplicableCount, expected.sourceResolution.inapplicable],
    ["sourceResolution.unresolved", summary.sourceUnresolvedCount, expected.sourceResolution.unresolved],
    ["effectiveResolution.matched", summary.effectiveMatchedCount, expected.effectiveResolution.matched],
    ["effectiveResolution.inapplicable", summary.effectiveInapplicableCount, expected.effectiveResolution.inapplicable],
    ["effectiveResolution.unresolved", summary.effectiveUnresolvedCount, expected.effectiveResolution.unresolved],
    ["contextApplicability.sourceAlreadyMatched", summary.sourceAlreadyMatchedCount, expected.contextApplicability.sourceAlreadyMatched],
    ["contextApplicability.sourceDefinitelyInapplicable", summary.sourceDefinitelyInapplicableCount, expected.contextApplicability.sourceDefinitelyInapplicable],
    ["contextApplicability.applicableUnderSuppliedContext", summary.applicableUnderSuppliedContextCount, expected.contextApplicability.applicableUnderSuppliedContext],
    ["contextApplicability.notApplicableUnderSuppliedContext", summary.notApplicableUnderSuppliedContextCount, expected.contextApplicability.notApplicableUnderSuppliedContext],
    ["contextApplicability.stillUnresolved", summary.stillUnresolvedCount, expected.contextApplicability.stillUnresolved],
  ];
  for (const [path, actual, wanted] of comparisons) {
    if (actual !== wanted) {
      issues.push({
        code: "source-local-slice.expected-count-mismatch",
        path: `expectedCounts.${path}`,
        message: `Expected ${wanted}, observed ${actual}.`,
      });
    }
  }
}

function summarize(
  sourceReport: SourceConditionedGuidePacketReport,
  requestReport: GuideRequestContextApplicabilityReport | null,
): SourceLocalConditionSliceReport["summary"] {
  const projections =
    requestReport?.teamProjections.flatMap(
      ({ claimProjections }) => claimProjections,
    ) ?? [];
  const countApplicability = (
    value:
      | "source-already-matched"
      | "source-definitely-inapplicable"
      | "applicable-under-supplied-context"
      | "not-applicable-under-supplied-context"
      | "still-unresolved",
  ): number =>
    projections.filter(({ contextApplicability }) => contextApplicability === value)
      .length;
  return {
    claimCount: sourceReport.summary.sourceClaimCount,
    teamCount: sourceReport.summary.packetCount,
    cellCount: sourceReport.summary.claimCellCount,
    sourceMatchedCount: sourceReport.summary.matchedCellCount,
    sourceInapplicableCount: sourceReport.summary.inapplicableCellCount,
    sourceUnresolvedCount: sourceReport.summary.unresolvedCellCount,
    effectiveMatchedCount: requestReport?.summary.matchedCellCount ?? 0,
    effectiveInapplicableCount: requestReport?.summary.inapplicableCellCount ?? 0,
    effectiveUnresolvedCount: requestReport?.summary.unresolvedCellCount ?? 0,
    sourceAlreadyMatchedCount: countApplicability("source-already-matched"),
    sourceDefinitelyInapplicableCount: countApplicability(
      "source-definitely-inapplicable",
    ),
    applicableUnderSuppliedContextCount: countApplicability(
      "applicable-under-supplied-context",
    ),
    notApplicableUnderSuppliedContextCount: countApplicability(
      "not-applicable-under-supplied-context",
    ),
    stillUnresolvedCount: countApplicability("still-unresolved"),
    deferredEnergyCount: 0,
    assembledBuildCount: 0,
  };
}

function validatePinnedHash(
  pinnedHash: string,
  value: unknown,
  path: string,
  label: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  if (!/^[a-f0-9]{64}$/.test(pinnedHash)) {
    issues.push({
      code: "source-local-slice.invalid-pinned-hash",
      path,
      message: `Pinned ${label} hash must be a lowercase SHA-256 value.`,
    });
    return;
  }
  if (value == null || sha256Text(stableJson(value)) !== pinnedHash) {
    issues.push({
      code: "source-local-slice.pinned-hash-mismatch",
      path,
      message: `Pinned ${label} hash does not match the current exact value.`,
    });
  }
}

function containsDeferredEnergy(predicate: SourceConditionPredicateAst): boolean {
  if (predicate.type === "deferred-energy-prerequisite") return true;
  return (
    predicate.type === "all" &&
    predicate.predicates.some(containsDeferredEnergy)
  );
}

function predicateNodeAtPath(
  predicate: SourceConditionPredicateAst,
  targetPath: string,
): SourceConditionPredicateAst | undefined {
  let found: SourceConditionPredicateAst | undefined;
  visit(predicate, "predicate");
  return found;

  function visit(node: SourceConditionPredicateAst, path: string): void {
    if (path === targetPath) found = node;
    if (node.type !== "all") return;
    node.predicates.forEach((child, index) =>
      visit(child, `${path}.predicates[${index}]`),
    );
  }
}

function validateExactStringSet(
  values: readonly string[],
  path: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (value.length === 0 || seen.has(value)) {
      issues.push({
        code: "source-local-slice.duplicate-or-empty-boundary-id",
        path: `${path}[${index}]`,
        message: "Source-boundary record IDs must be unique and non-empty.",
      });
    }
    seen.add(value);
  });
}

function validateContiguousIndexes(
  indexes: readonly number[],
  path: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const sorted = [...indexes].sort((left, right) => left - right);
  if (
    sorted.some(
      (value, index) => !Number.isSafeInteger(value) || value !== index,
    )
  ) {
    issues.push({
      code: "source-local-slice.non-contiguous-indexes",
      path,
      message: "Slice indexes must form the exact contiguous range 0..N-1.",
    });
  }
}

function canonicalClaims(
  claims: readonly SourceLocalConditionClaimInput[],
): SourceLocalConditionClaimInput[] {
  return [...claims]
    .sort((left, right) => left.claim.catalogIndex - right.claim.catalogIndex)
    .map((entry) => ({
      claim: structuredClone(entry.claim),
      occurrenceControl: structuredClone(entry.occurrenceControl),
      requestBindings: [...entry.requestBindings]
        .sort((left, right) =>
          left.sourcePredicatePath.localeCompare(right.sourcePredicatePath),
        )
        .map((binding) => structuredClone(binding)),
    }));
}

function canonicalTeams(
  teams: readonly SourceLocalExactTeamInput[],
): SourceLocalExactTeamInput[] {
  return [...teams]
    .sort((left, right) => left.packetIndex - right.packetIndex)
    .map((team) => structuredClone(team));
}

function canonicalGeneratedFrom(
  entries: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  return [...entries]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function canonicalRequestContext(
  context: SourceLocalConditionRequestContext | undefined,
): GuideRequestContext {
  const requestFactsByTeamRecordId = context?.requestFactsByTeamRecordId;
  if (!requestFactsByTeamRecordId) return {};
  return {
    requestFactsByTeamRecordId: Object.fromEntries(
      Object.entries(requestFactsByTeamRecordId)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([teamRecordId, teamFacts]) => [
          teamRecordId,
          {
            ...(teamFacts.characterFactsById
              ? {
                  characterFactsById: Object.fromEntries(
                    Object.entries(teamFacts.characterFactsById).sort(
                      ([left], [right]) => left.localeCompare(right),
                    ),
                  ),
                }
              : {}),
          },
        ]),
    ),
  };
}

function flattenCountEntries(
  expected: SourceLocalConditionSliceExpectedCounts,
): Array<[string, number]> {
  return [
    ["claimCount", expected.claimCount],
    ["teamCount", expected.teamCount],
    ["cellCount", expected.cellCount],
    ...Object.entries(expected.sourceResolution).map(
      ([key, value]) => [`sourceResolution.${key}`, value] as [string, number],
    ),
    ...Object.entries(expected.effectiveResolution).map(
      ([key, value]) => [
        `effectiveResolution.${key}`,
        value,
      ] as [string, number],
    ),
    ...Object.entries(expected.contextApplicability).map(
      ([key, value]) => [
        `contextApplicability.${key}`,
        value,
      ] as [string, number],
    ),
  ];
}

function dedupeIssues(
  issues: readonly SourceConditionedGuidePacketIssue[],
): SourceConditionedGuidePacketIssue[] {
  return [
    ...new Map(
      issues.map((issue) => [
        `${issue.code}\0${issue.path}\0${issue.message}`,
        { ...issue },
      ]),
    ).values(),
  ].sort((left, right) =>
    `${left.path}\0${left.code}`.localeCompare(`${right.path}\0${right.code}`),
  );
}
