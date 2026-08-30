import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildGuideDraftFieldPolicy,
  finalizeGuideDraftBlocker,
  finalizeGuideDraftField,
  finalizeGuideDraftPacket,
  GUIDE_DRAFT_PACKET_SCHEMA_VERSION,
  hashGuideDraftValue,
  resolveGuideDraftJsonPointer,
  validateGuideDraftPacket,
  type GuideDraftBlocker,
  type GuideDraftBlockerCode,
  type GuideDraftField,
  type GuideDraftPacket,
  type GuideDraftUpstreamProvenance,
} from "./guideDraftPacket";
import { stableJson } from "./io";
import {
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REPORT_PATH,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS,
  requireAuthenticatedNoelleHexereiRequestConditionedCandidateAdmissionReport,
  type NoelleHexereiRequestConditionedCandidateAdmissionInput,
  type NoelleHexereiRequestConditionedCandidateAdmissionReport,
  type NoelleHexereiRequestConditionedCandidateEnvelope,
} from "./noelleHexereiRequestConditionedCandidateAdmission";
import { FACTORY_ROOT, REPOSITORY_ROOT } from "./paths";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";

export const NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_ID =
  "noelle-hexerei-guide-draft-projection-v1";
export const NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "noelle-hexerei-guide-draft-projection.json",
);
export const NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH = path
  .relative(
    REPOSITORY_ROOT,
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REPORT_PATH,
  )
  .replaceAll("\\", "/");
export const GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/guideDraftPacket.ts";
export const NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/noelleHexereiGuideDraftProjection.ts";
export const NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CLI_RELATIVE_PATH =
  "scripts/guide-factory/src/assemble-noelle-hexerei-guide-draft-projection.ts";

export const NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS = [
  ...new Set([
    ...NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
    NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
    GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH,
    NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CORE_RELATIVE_PATH,
    NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CLI_RELATIVE_PATH,
  ]),
].sort(compareText);

export const NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_RUNTIME_INPUT_PATHS = [
  ...NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS,
].sort(compareText);

const EXPECTED_INPUT_PATH_COUNT = 123;
const EXPECTED_RUNTIME_INPUT_PATH_COUNT = 80;
const EXPECTED_JSON_INPUT_COUNT = 16;
const EXPECTED_BINARY_RUNTIME_INPUT_COUNT = 2;
const EXPECTED_PACKET_COUNT = 6;
const EXPECTED_FIELD_COUNT = 200;
const EXPECTED_BLOCKER_COUNT = 128;

export const NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST = {
  requestId: "noelle-hexerei-six-request-guide-draft-projection-v1",
  authorship: "guide-factory-technical-request",
  upstreamAdmissionId:
    "noelle-hexerei-request-conditioned-candidate-admission-v1",
  exactPacketOrder: [
    "c0-q9",
    "c5-q9",
    "c0-q10",
    "c5-q10",
    "c6-q9",
    "c6-q10",
  ],
  projectionPolicy:
    "preserve-authenticated-observations-and-request-local-relation-states-with-field-level-blockers",
  selectionRequested: false,
  rankingRequested: false,
  optimizerRequested: false,
  autoTuneRequested: false,
  damageComputationRequested: false,
  rotationReplayRequested: false,
  energyRecoveryRequested: false,
  energyRecoveryPolicy: "deferred-until-sequence-input-exists",
  publicationRequested: false,
} as const;

export interface NoelleHexereiGuideDraftSourceFile {
  path: string;
  bytesBase64: string;
}

export interface NoelleHexereiGuideDraftProjectionInput {
  cp57ReportInput: NoelleHexereiRequestConditionedCandidateAdmissionReport;
  cp57Input: NoelleHexereiRequestConditionedCandidateAdmissionInput;
  technicalRequest: typeof NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST;
  sourceFiles: readonly NoelleHexereiGuideDraftSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface NoelleHexereiGuideDraftFields
  extends Record<string, unknown> {
  request: {
    entered: GuideDraftField;
    runtimeEffectiveTalents: GuideDraftField;
  };
  team: {
    exactContext: GuideDraftField;
    noelleInvestment: GuideDraftField;
  };
  authority: {
    sourceReview: GuideDraftField;
    sourceAuthoredRequestCoverage: GuideDraftField;
    compositionAuthorship: GuideDraftField;
    completeArtifactAssignment: GuideDraftField;
    completeBuild: GuideDraftField;
  };
  weapon: {
    observedOptions: GuideDraftField[];
    selected: GuideDraftField;
    refinement: GuideDraftField;
    quantitativePerformance: GuideDraftField;
  };
  artifacts: {
    setOptions: GuideDraftField[];
    selectedSet: GuideDraftField;
    mainStats: Record<
      "sands" | "goblet" | "circlet",
      {
        observedOptions: GuideDraftField[];
        guardedAlternatives: GuideDraftField[];
        selected: GuideDraftField;
      }
    >;
  };
  substats: {
    sourceGroups: GuideDraftField;
    localRelationOverlays: GuideDraftField[];
    selectedAllocation: GuideDraftField;
    scalarWeights: GuideDraftField;
  };
  computation: {
    enemyScenario: GuideDraftField;
    formulaCounts: GuideDraftField;
    rotationTimingAndBuffCoverage: GuideDraftField;
    teamTotalDamage: GuideDraftField;
    energyRecharge: GuideDraftField;
  };
}

export type NoelleHexereiGuideDraftPacket =
  GuideDraftPacket<NoelleHexereiGuideDraftFields>;

export interface NoelleHexereiGuideDraftProjectionReport {
  schemaVersion: 1;
  reportType: "noelle-hexerei-guide-draft-projection";
  projectionId: typeof NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_ID;
  classification: "authenticated-offline-blocker-aware-guide-draft-projection";
  validationStatus: "completed-six-request-exact-field-state-projection";
  publicationStatus: "withheld-incomplete-evidence-drafts";
  promotionEligible: false;
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allGeneratedFromHashesAuthenticatedFromBytes: true;
    allSourceBytesMatchWorkspaceFiles: true;
    cp57ReportByteAndParsedObjectParity: true;
    exactCp57InputProjection: true;
    exactTechnicalRequest: true;
    sourceFileCount: 123;
    generatedFromCount: 123;
    runtimeInputPathCount: 80;
    jsonInputCount: 16;
    binaryRuntimeInputCount: 2;
  };
  upstreamBoundary: {
    cp57: {
      reportPath: typeof NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH;
      reportFileSha256: string;
      canonicalObjectSha256: string;
      aggregateAdmissionSha256: string;
      technicalRequestSha256: string;
      freshlyAuthenticated: true;
      technicalCellRecomputationCountDuringAuthentication: 480;
      teamBuildMaterializationCountDuringAuthentication: 960;
    };
  };
  requestBoundary: {
    request: typeof NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST;
    requestCanonicalObjectSha256: string;
    projectionOnly: true;
    serializationOrderIsNotRank: true;
    energyRecoveryDeferred: true;
  };
  packetFormatBoundary: {
    schemaVersion: typeof GUIDE_DRAFT_PACKET_SCHEMA_VERSION;
    closedFieldStateMachine: true;
    exactFieldLevelUpstreamPointers: true;
    exactFieldAndBlockerHashes: true;
    projectorSuppliedExactFieldPolicy: true;
    unauthenticatedFieldProseSerialized: false;
    blockersReconstructableFromFieldStates: true;
    missingNeverSerializedAsZero: true;
    nullNeverSerializedAsDefaultSelection: true;
  };
  packets: NoelleHexereiGuideDraftPacket[];
  identityBoundary: {
    generatedFromSetSha256: string;
    fieldIdentitySetSha256: string;
    blockerIdentitySetSha256: string;
    relationOverlayIdentitySetSha256: string;
    packetIdentitySetSha256: string;
    aggregateProjectionSha256: string;
    serializationOrderIsNotRank: true;
  };
  summary: {
    packetCount: 6;
    completeObservationProjectionCount: 6;
    allRelationsAdmittedPacketCount: 2;
    partialRelationPacketCount: 4;
    publicationReadyPacketCount: 0;
    fieldCount: 200;
    provenanceReferenceCount: number;
    preservedEvidenceFieldCount: 60;
    preservedBlockingEvidenceFieldCount: 30;
    locallyAdmittedRelationFieldCount: 12;
    withheldCounterexampleFieldCount: 6;
    withheldInconclusiveFieldCount: 0;
    guardedUnresolvedAlternativeFieldCount: 8;
    unselectedFieldCount: 36;
    missingNotZeroFieldCount: 36;
    notComputedFieldCount: 6;
    deferredMissingNotZeroFieldCount: 6;
    blockerCount: 128;
    baseBlockerCountPerPacket: 19;
    guardedAlternativeBlockerCount: 8;
    withheldRelationBlockerCount: 6;
    nullSelectionCount: 36;
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
    countingScope: "cp58-projection-only-excludes-upstream-authentication-work";
    upstreamAuthenticationOperationsExcluded: true;
    upstreamCp57TechnicalCellsFreshlyRecomputedDuringAuthentication: 480;
    upstreamCp57TeamBuildsFreshlyMaterializedDuringAuthentication: 960;
    packetProjectionCount: 6;
    fieldProjectionCount: 200;
    blockerConstructionCount: 128;
    relationOverlayProjectionCount: 18;
    guardedAlternativeProjectionCount: 8;
    nullSelectionProjectionCount: 36;
    selectionExecutionCount: 0;
    rankingCount: 0;
    optimizerRunCount: 0;
    autoTuneRunCount: 0;
    damageComputationCount: 0;
    rotationReplayCount: 0;
    teamTotalDamageComputationCount: 0;
    energyRecoveryComputationCount: 0;
  };
  supportsDraftPacketSerialization: true;
  supportsPreservedObservationProjection: true;
  supportsRequestLocalRelationStateProjection: true;
  supportsGuideClaims: false;
  supportsPublication: false;
  supportsTeamRecommendationClaims: false;
  supportsEquipmentRecommendationClaims: false;
  supportsStatRecommendationClaims: false;
  supportsRankClaims: false;
  supportsWinnerClaims: false;
  supportsScalarWeights: false;
  supportsTotalStatOrder: false;
  supportsIdealStatAllocation: false;
  supportsOptimizerClaims: false;
  supportsAutoTuneClaims: false;
  supportsDamageClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRechargeClaims: false;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type NoelleHexereiGuideDraftProjectionAuthentication =
  | {
      authenticated: true;
      canonicalReport: NoelleHexereiGuideDraftProjectionReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      message: string;
    };

interface AuthenticatedOuterInputs {
  sourceBytesByPath: Map<string, Buffer>;
  generatedFrom: GeneratedFromEntry[];
  cp57Report: NoelleHexereiRequestConditionedCandidateAdmissionReport;
}

const CAUTIONS = [
  "These packets are authenticated offline draft serializations, not character guides or recommendations.",
  "An all-locally-admitted relation status does not resolve equipment selections, guarded alternatives, formula counts, rotation timing, team damage, or Energy Recharge.",
  "Entered talent levels remain distinct from runtime-effective talent levels; runtime constellation bonuses never change request matching.",
  "Every missing value remains null or an explicit missing/deferred state; no zero, R1, R5, sole option, or other default is invented.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not publish a packet as a guide, build, team, equipment, stat, or investment recommendation.",
  "Do not treat Gest, 4pc Husk, any main-stat option, or any substat group as selected, best, ranked, or globally validated.",
  "Do not synthesize a CR-versus-CD order, scalar weights, total stat order, legal roll allocation, winner, or optimizer result.",
  "Do not emit damage, DPS, rotation feasibility, buff-coverage, team-total, or Energy Recharge claims.",
] as const;

export async function buildNoelleHexereiGuideDraftProjectionReport(
  input: NoelleHexereiGuideDraftProjectionInput,
): Promise<NoelleHexereiGuideDraftProjectionReport> {
  const raw = authenticateOuterInputs(input);
  assertExactTechnicalRequest(input.technicalRequest);
  assertExactCp57InputProjection(raw, input.cp57Input);
  const cp57Report =
    await requireAuthenticatedNoelleHexereiRequestConditionedCandidateAdmissionReport(
      raw.cp57Report,
      input.cp57Input,
    );
  assertCp57Boundary(cp57Report);

  const cp57CanonicalObjectSha256 = hashGuideDraftValue(cp57Report);
  const packets = cp57Report.requestConditionedCandidateEnvelopes.map(
    (envelope, index) =>
      buildNoelleHexereiGuideDraftPacket(
        cp57Report,
        envelope,
        index,
        cp57CanonicalObjectSha256,
      ),
  );
  assertPacketOrderAndCardinality(packets);

  const fields = packets.flatMap(({ fields: fieldTree }) =>
    collectFields(fieldTree),
  );
  const blockers = packets.flatMap(({ blockers: packetBlockers }) =>
    packetBlockers,
  );
  const relationOverlays = packets.flatMap(
    ({ fields: fieldTree }) => fieldTree.substats.localRelationOverlays,
  );
  const fieldStateCounts = countFieldStates(fields);
  const provenanceReferenceCount = fields.reduce(
    (sum, field) => sum + field.provenance.length,
    0,
  );
  const allRelationsAdmittedPacketCount = packets.filter(
    ({ readiness }) =>
      readiness.localRelationProjection === "all-locally-admitted",
  ).length;
  const guardedAlternativeBlockerCount = fields.filter(
    ({ state }) => state === "guarded-unresolved-alternative",
  ).length;
  const withheldRelationBlockerCount = fields.filter(
    ({ state }) => state === "withheld-counterexample",
  ).length;
  assertExactProjectionCensus(
    packets,
    fields,
    blockers,
    fieldStateCounts,
    allRelationsAdmittedPacketCount,
  );

  const generatedFromSetSha256 = hashGuideDraftValue(raw.generatedFrom);
  const technicalRequestSha256 = hashGuideDraftValue(
    NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
  );
  const fieldIdentitySetSha256 = hashGuideDraftValue(
    packets.flatMap((packet) =>
      collectFields(packet.fields).map(({ fieldId, fieldSha256 }) => ({
        packetId: packet.packetId,
        fieldId,
        fieldSha256,
      })),
    ),
  );
  const blockerIdentitySetSha256 = hashGuideDraftValue(
    blockers.map(({ blockerId, blockerSha256 }) => ({
      blockerId,
      blockerSha256,
    })),
  );
  const relationOverlayIdentitySetSha256 = hashGuideDraftValue(
    packets.flatMap((packet) =>
      packet.fields.substats.localRelationOverlays.map(
        ({ fieldId, fieldSha256 }) => ({
          packetId: packet.packetId,
          fieldId,
          fieldSha256,
        }),
      ),
    ),
  );
  const packetIdentitySetSha256 = hashGuideDraftValue(
    packets.map(({ packetId, packetSha256 }) => ({ packetId, packetSha256 })),
  );
  const aggregateProjectionSha256 = hashGuideDraftValue({
    generatedFromSetSha256,
    cp57CanonicalObjectSha256,
    cp57AggregateAdmissionSha256:
      cp57Report.identityBoundary.aggregateAdmissionSha256,
    cp57TechnicalRequestSha256:
      cp57Report.requestBoundary.requestCanonicalObjectSha256,
    technicalRequestSha256,
    fieldIdentitySetSha256,
    blockerIdentitySetSha256,
    relationOverlayIdentitySetSha256,
    packetIdentitySetSha256,
  });

  return {
    schemaVersion: 1,
    reportType: "noelle-hexerei-guide-draft-projection",
    projectionId: NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_ID,
    classification:
      "authenticated-offline-blocker-aware-guide-draft-projection",
    validationStatus: "completed-six-request-exact-field-state-projection",
    publicationStatus: "withheld-incomplete-evidence-drafts",
    promotionEligible: false,
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromBytes: true,
      allSourceBytesMatchWorkspaceFiles: true,
      cp57ReportByteAndParsedObjectParity: true,
      exactCp57InputProjection: true,
      exactTechnicalRequest: true,
      sourceFileCount: 123,
      generatedFromCount: 123,
      runtimeInputPathCount: 80,
      jsonInputCount: 16,
      binaryRuntimeInputCount: 2,
    },
    upstreamBoundary: {
      cp57: {
        reportPath: NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
        reportFileSha256: hashBytes(
          requiredSourceBytes(
            raw.sourceBytesByPath,
            NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
          ),
        ),
        canonicalObjectSha256: cp57CanonicalObjectSha256,
        aggregateAdmissionSha256:
          cp57Report.identityBoundary.aggregateAdmissionSha256,
        technicalRequestSha256:
          cp57Report.requestBoundary.requestCanonicalObjectSha256,
        freshlyAuthenticated: true,
        technicalCellRecomputationCountDuringAuthentication: 480,
        teamBuildMaterializationCountDuringAuthentication: 960,
      },
    },
    requestBoundary: {
      request: structuredClone(
        NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
      ),
      requestCanonicalObjectSha256: technicalRequestSha256,
      projectionOnly: true,
      serializationOrderIsNotRank: true,
      energyRecoveryDeferred: true,
    },
    packetFormatBoundary: {
      schemaVersion: GUIDE_DRAFT_PACKET_SCHEMA_VERSION,
      closedFieldStateMachine: true,
      exactFieldLevelUpstreamPointers: true,
      exactFieldAndBlockerHashes: true,
      projectorSuppliedExactFieldPolicy: true,
      unauthenticatedFieldProseSerialized: false,
      blockersReconstructableFromFieldStates: true,
      missingNeverSerializedAsZero: true,
      nullNeverSerializedAsDefaultSelection: true,
    },
    packets,
    identityBoundary: {
      generatedFromSetSha256,
      fieldIdentitySetSha256,
      blockerIdentitySetSha256,
      relationOverlayIdentitySetSha256,
      packetIdentitySetSha256,
      aggregateProjectionSha256,
      serializationOrderIsNotRank: true,
    },
    summary: {
      packetCount: 6,
      completeObservationProjectionCount: 6,
      allRelationsAdmittedPacketCount: 2,
      partialRelationPacketCount: 4,
      publicationReadyPacketCount: 0,
      fieldCount: 200,
      provenanceReferenceCount,
      preservedEvidenceFieldCount: 60,
      preservedBlockingEvidenceFieldCount: 30,
      locallyAdmittedRelationFieldCount: 12,
      withheldCounterexampleFieldCount: 6,
      withheldInconclusiveFieldCount: 0,
      guardedUnresolvedAlternativeFieldCount: 8,
      unselectedFieldCount: 36,
      missingNotZeroFieldCount: 36,
      notComputedFieldCount: 6,
      deferredMissingNotZeroFieldCount: 6,
      blockerCount: 128,
      baseBlockerCountPerPacket: 19,
      guardedAlternativeBlockerCount: 8,
      withheldRelationBlockerCount: 6,
      nullSelectionCount: 36,
      rankingCount: 0,
      scalarWeightCount: 0,
      idealStatAllocationCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      damageComputationCount: 0,
      rotationReplayCount: 0,
      teamTotalDamageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    },
    operationSummary: {
      countingScope:
        "cp58-projection-only-excludes-upstream-authentication-work",
      upstreamAuthenticationOperationsExcluded: true,
      upstreamCp57TechnicalCellsFreshlyRecomputedDuringAuthentication: 480,
      upstreamCp57TeamBuildsFreshlyMaterializedDuringAuthentication: 960,
      packetProjectionCount: 6,
      fieldProjectionCount: 200,
      blockerConstructionCount: 128,
      relationOverlayProjectionCount: 18,
      guardedAlternativeProjectionCount: 8,
      nullSelectionProjectionCount: 36,
      selectionExecutionCount: 0,
      rankingCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      damageComputationCount: 0,
      rotationReplayCount: 0,
      teamTotalDamageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    },
    supportsDraftPacketSerialization: true,
    supportsPreservedObservationProjection: true,
    supportsRequestLocalRelationStateProjection: true,
    supportsGuideClaims: false,
    supportsPublication: false,
    supportsTeamRecommendationClaims: false,
    supportsEquipmentRecommendationClaims: false,
    supportsStatRecommendationClaims: false,
    supportsRankClaims: false,
    supportsWinnerClaims: false,
    supportsScalarWeights: false,
    supportsTotalStatOrder: false,
    supportsIdealStatAllocation: false,
    supportsOptimizerClaims: false,
    supportsAutoTuneClaims: false,
    supportsDamageClaims: false,
    supportsRotationClaims: false,
    supportsEnergyRechargeClaims: false,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

export async function authenticateNoelleHexereiGuideDraftProjectionReport(
  serializedReport: NoelleHexereiGuideDraftProjectionReport,
  input: NoelleHexereiGuideDraftProjectionInput,
): Promise<NoelleHexereiGuideDraftProjectionAuthentication> {
  let canonicalReport: NoelleHexereiGuideDraftProjectionReport;
  try {
    canonicalReport = await buildNoelleHexereiGuideDraftProjectionReport(input);
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
        "The serialized CP58 report does not match a fresh reconstruction from authenticated CP57 evidence.",
    };
  }
  return { authenticated: true, canonicalReport };
}

export async function requireAuthenticatedNoelleHexereiGuideDraftProjectionReport(
  serializedReport: NoelleHexereiGuideDraftProjectionReport,
  input: NoelleHexereiGuideDraftProjectionInput,
): Promise<NoelleHexereiGuideDraftProjectionReport> {
  const authentication =
    await authenticateNoelleHexereiGuideDraftProjectionReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP58 authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

function buildNoelleHexereiGuideDraftPacket(
  cp57Report: NoelleHexereiRequestConditionedCandidateAdmissionReport,
  envelope: NoelleHexereiRequestConditionedCandidateEnvelope,
  envelopeIndex: number,
  cp57CanonicalObjectSha256: string,
): NoelleHexereiGuideDraftPacket {
  const packetId = `${envelope.request.requestId}:noelle:guide-draft-v1`;
  const envelopePointer = `/requestConditionedCandidateEnvelopes/${envelopeIndex}`;
  const candidatePointer = `${envelopePointer}/partialCandidate`;
  const blockers: GuideDraftBlocker[] = [];
  const preserved = (
    fieldId: string,
    fieldPath: string,
    _semantics: string,
    sourceObjectId: string,
    sourceObjectPointer: string,
    sourceValuePointer: string,
  ) =>
    finalizeGuideDraftField({
      fieldId,
      fieldPath,
      state: "preserved-evidence",
      value: structuredClone(
        resolveGuideDraftJsonPointer(cp57Report, sourceValuePointer),
      ),
      provenance: [
        buildProvenance(
          cp57Report,
          sourceObjectId,
          sourceObjectPointer,
          sourceValuePointer,
        ),
      ],
      blockerIds: [],
    });
  const blockingPreserved = (
    fieldId: string,
    fieldPath: string,
    _semantics: string,
    sourceObjectId: string,
    sourceObjectPointer: string,
    sourceValuePointer: string,
    code: GuideDraftBlockerCode,
    _reason: string,
  ) => {
    const blockerId = buildBlockerId(packetId, fieldId, code);
    const field = finalizeGuideDraftField({
      fieldId,
      fieldPath,
      state: "preserved-blocking-evidence",
      value: structuredClone(
        resolveGuideDraftJsonPointer(cp57Report, sourceValuePointer),
      ),
      provenance: [
        buildProvenance(
          cp57Report,
          sourceObjectId,
          sourceObjectPointer,
          sourceValuePointer,
        ),
      ],
      blockerIds: [blockerId],
    });
    blockers.push(buildBlocker(field, blockerId, code));
    return field;
  };
  const unselected = (
    fieldId: string,
    fieldPath: string,
    _semantics: string,
    sourceValuePointer: string,
    optionFieldIds: string[],
    code: GuideDraftBlockerCode,
    _reason: string,
  ) => {
    const blockerId = buildBlockerId(packetId, fieldId, code);
    const field = finalizeGuideDraftField({
      fieldId,
      fieldPath,
      state: "unselected",
      value: null,
      optionFieldIds,
      provenance: [
        buildProvenance(
          cp57Report,
          envelope.envelopeId,
          envelopePointer,
          sourceValuePointer,
        ),
      ],
      blockerIds: [blockerId],
    });
    blockers.push(buildBlocker(field, blockerId, code));
    return field;
  };
  const missing = (
    fieldId: string,
    fieldPath: string,
    _semantics: string,
    sourceValuePointer: string,
    code: GuideDraftBlockerCode,
    _reason: string,
    extraPointers: string[] = [],
  ) => {
    const blockerId = buildBlockerId(packetId, fieldId, code);
    const field = finalizeGuideDraftField({
      fieldId,
      fieldPath,
      state: "missing-not-zero",
      value: null,
      upstreamMarker: structuredClone(
        resolveGuideDraftJsonPointer(cp57Report, sourceValuePointer),
      ),
      provenance: [sourceValuePointer, ...extraPointers].map((pointer) =>
        buildProvenance(
          cp57Report,
          envelope.envelopeId,
          envelopePointer,
          pointer,
        ),
      ),
      blockerIds: [blockerId],
    });
    blockers.push(buildBlocker(field, blockerId, code));
    return field;
  };
  const notComputed = (
    fieldId: string,
    fieldPath: string,
    _semantics: string,
    sourceValuePointer: string,
    code: GuideDraftBlockerCode,
    _reason: string,
  ) => {
    const blockerId = buildBlockerId(packetId, fieldId, code);
    const field = finalizeGuideDraftField({
      fieldId,
      fieldPath,
      state: "not-computed",
      value: null,
      upstreamMarker: structuredClone(
        resolveGuideDraftJsonPointer(cp57Report, sourceValuePointer),
      ),
      provenance: [
        buildProvenance(
          cp57Report,
          envelope.envelopeId,
          envelopePointer,
          sourceValuePointer,
        ),
      ],
      blockerIds: [blockerId],
    });
    blockers.push(buildBlocker(field, blockerId, code));
    return field;
  };
  const deferred = (
    fieldId: string,
    fieldPath: string,
    _semantics: string,
    sourceValuePointer: string,
    code: GuideDraftBlockerCode,
    _reason: string,
  ) => {
    const blockerId = buildBlockerId(packetId, fieldId, code);
    const field = finalizeGuideDraftField({
      fieldId,
      fieldPath,
      state: "deferred-missing-not-zero",
      value: null,
      upstreamMarker: structuredClone(
        resolveGuideDraftJsonPointer(cp57Report, sourceValuePointer),
      ),
      provenance: [
        buildProvenance(
          cp57Report,
          envelope.envelopeId,
          envelopePointer,
          sourceValuePointer,
        ),
      ],
      blockerIds: [blockerId],
    });
    blockers.push(buildBlocker(field, blockerId, code));
    return field;
  };

  const weaponOptionFieldId = "weapon.observed-option.gest";
  const weaponObservedOptions = [
    preserved(
      weaponOptionFieldId,
      "/fields/weapon/observedOptions/0",
      "Exact CP57 source-conditioned, unranked Gest observation; this packet makes no new applicability, selection, or recommendation claim.",
      envelope.candidateMatch.candidateId,
      candidatePointer,
      `${candidatePointer}/weaponOption`,
    ),
  ];

  const setOptionFieldId = "artifacts.set-option.husk-4pc";
  const setOptions = [
    preserved(
      setOptionFieldId,
      "/fields/artifacts/setOptions/0",
      "Exact 4pc Husk source observation with assignedToRuntimeBuild false; this is not a selected set.",
      envelope.candidateMatch.candidateId,
      candidatePointer,
      `${candidatePointer}/artifactProfile/artifactSet`,
    ),
  ];

  const mainStats = {} as NoelleHexereiGuideDraftFields["artifacts"]["mainStats"];
  for (const slot of ["sands", "goblet", "circlet"] as const) {
    const sourceOptions =
      envelope.partialCandidate.artifactProfile.mainStats[slot].options;
    const observedOptions: GuideDraftField[] = [];
    const guardedAlternatives: GuideDraftField[] = [];
    for (const [optionIndex, option] of sourceOptions.entries()) {
      const sourceOptionPointer = `${candidatePointer}/artifactProfile/mainStats/${slot}/options/${optionIndex}`;
      if (option.conditionStatus === "additional-source-guard-unresolved") {
        const fieldId = `artifacts.main-stat.${slot}.guarded-option.${optionIndex}`;
        const fieldPath = `/fields/artifacts/mainStats/${slot}/guardedAlternatives/${guardedAlternatives.length}`;
        const blockerId = buildBlockerId(
          packetId,
          fieldId,
          "guarded-alternative-unresolved",
        );
        const field = finalizeGuideDraftField({
          fieldId,
          fieldPath,
          state: "guarded-unresolved-alternative",
          value: null,
          preservedObservation: structuredClone(option),
          provenance: [
            buildProvenance(
              cp57Report,
              `${envelope.candidateMatch.candidateId}:${slot}:option:${optionIndex}`,
              sourceOptionPointer,
              sourceOptionPointer,
            ),
          ],
          blockerIds: [blockerId],
        });
        blockers.push(
          buildBlocker(
            field,
            blockerId,
            "guarded-alternative-unresolved",
          ),
        );
        guardedAlternatives.push(field);
      } else {
        const fieldId = `artifacts.main-stat.${slot}.observed-option.${optionIndex}`;
        observedOptions.push(
          preserved(
            fieldId,
            `/fields/artifacts/mainStats/${slot}/observedOptions/${observedOptions.length}`,
            "Exact branch-conditioned main-stat option; its presence is not a selection or rank.",
            `${envelope.candidateMatch.candidateId}:${slot}:option:${optionIndex}`,
            sourceOptionPointer,
            sourceOptionPointer,
          ),
        );
      }
    }
    const optionFieldIds = [...observedOptions, ...guardedAlternatives].map(
      ({ fieldId }) => fieldId,
    );
    mainStats[slot] = {
      observedOptions,
      guardedAlternatives,
      selected: unselected(
        `artifacts.main-stat.${slot}.selected`,
        `/fields/artifacts/mainStats/${slot}/selected`,
        `No ${slot} main stat has been selected; null is not the first or sole option.`,
        `${candidatePointer}/selections/selectedMainStats/${slot}`,
        optionFieldIds,
        `selected-${slot}-missing`,
        `The ${slot} selection is null and must be resolved before this draft can become a build.`,
      ),
    };
  }

  const localRelationOverlays = envelope.relationAdmissions.map(
    (relation, relationIndex) => {
      const fieldId = `substats.local-relation.${relation.sourceRelationId}`;
      const fieldPath = `/fields/substats/localRelationOverlays/${relationIndex}`;
      const relationPointer = `${envelopePointer}/relationAdmissions/${relationIndex}`;
      const provenance = [
        buildProvenance(
          cp57Report,
          relation.admissionId,
          relationPointer,
          relationPointer,
        ),
      ];
      if (
        relation.admissionStatus ===
        "admitted-unanimous-across-all-16-tested-contexts"
      ) {
        return finalizeGuideDraftField({
          fieldId,
          fieldPath,
          state: "locally-admitted-relation",
          value: structuredClone(relation),
          provenance,
          blockerIds: [],
        });
      }
      const inconclusive =
        relation.admissionStatus === "withheld-inconclusive";
      const blockerCode = inconclusive
        ? "local-relation-inconclusive"
        : "local-relation-counterexample";
      const blockerId = buildBlockerId(packetId, fieldId, blockerCode);
      const field = finalizeGuideDraftField({
        fieldId,
        fieldPath,
        state: inconclusive
          ? "withheld-inconclusive"
          : "withheld-counterexample",
        value: null,
        preservedObservation: structuredClone(relation),
        provenance,
        blockerIds: [blockerId],
      });
      blockers.push(
        buildBlocker(
          field,
          blockerId,
          blockerCode,
        ),
      );
      return field;
    },
  );

  const fields: NoelleHexereiGuideDraftFields = {
    request: {
      entered: preserved(
        "request.entered",
        "/fields/request/entered",
        "Exact entered request facts used for CP57 candidate matching.",
        envelope.envelopeId,
        envelopePointer,
        `${envelopePointer}/request`,
      ),
      runtimeEffectiveTalents: preserved(
        "request.runtime-effective-talents",
        "/fields/request/runtimeEffectiveTalents",
        "Runtime-effective talents are evidence only and remain distinct from entered request facts.",
        envelope.envelopeId,
        envelopePointer,
        `${envelopePointer}/enteredAndRuntimeTalentBoundary/runtimeEffectiveTalentLevels`,
      ),
    },
    team: {
      exactContext: preserved(
        "team.exact-context",
        "/fields/team/exactContext",
        "Exact source team context; its serialization does not make it a recommendation.",
        envelope.candidateMatch.candidateId,
        candidatePointer,
        `${candidatePointer}/team`,
      ),
      noelleInvestment: blockingPreserved(
        "team.noelle-investment",
        "/fields/team/noelleInvestment",
        "The source team leaves Noelle investment unspecified; request facts do not rewrite this source field.",
        envelope.candidateMatch.candidateId,
        candidatePointer,
        `${candidatePointer}/team/noelleInvestment`,
        "source-team-investment-unspecified",
        "The source team does not author an investment branch for Noelle.",
      ),
    },
    authority: {
      sourceReview: blockingPreserved(
        "authority.source-review",
        "/fields/authority/sourceReview",
        "The exact source-backed candidate remains unreviewed.",
        envelope.envelopeId,
        envelopePointer,
        `${envelopePointer}/unresolvedBoundaries/sourceReviewStatus`,
        "source-review-unreviewed",
        "The source-backed candidate has not passed the repository review boundary.",
      ),
      sourceAuthoredRequestCoverage: blockingPreserved(
        "authority.source-authored-request-coverage",
        "/fields/authority/sourceAuthoredRequestCoverage",
        "The six-request evaluation domain is Guide Factory-authored rather than source-authored.",
        envelope.envelopeId,
        envelopePointer,
        `${envelopePointer}/sourceAuthoredRequestCoverage`,
        "source-request-coverage-absent",
        "The source does not authorize this Guide Factory-authored request envelope as a guide claim.",
      ),
      compositionAuthorship: preserved(
        "authority.composition-authorship",
        "/fields/authority/compositionAuthorship",
        "Exact candidate authorship boundary; preservation is not source authorization.",
        envelope.candidateMatch.candidateId,
        candidatePointer,
        `${candidatePointer}/authorship`,
      ),
      completeArtifactAssignment: blockingPreserved(
        "authority.complete-artifact-assignment",
        "/fields/authority/completeArtifactAssignment",
        "The upstream candidate explicitly lacks a complete artifact assignment.",
        envelope.envelopeId,
        envelopePointer,
        `${envelopePointer}/unresolvedBoundaries/completeArtifactAssignment`,
        "artifact-assignment-incomplete",
        "A complete artifact assignment has not been produced.",
      ),
      completeBuild: blockingPreserved(
        "authority.complete-build",
        "/fields/authority/completeBuild",
        "The upstream candidate explicitly remains an incomplete build.",
        envelope.envelopeId,
        envelopePointer,
        `${envelopePointer}/unresolvedBoundaries/completeBuild`,
        "build-incomplete",
        "The candidate is not a complete build.",
      ),
    },
    weapon: {
      observedOptions: weaponObservedOptions,
      selected: unselected(
        "weapon.selected",
        "/fields/weapon/selected",
        "No weapon has been selected; the one observed option is not selected by default.",
        `${candidatePointer}/selections/selectedWeapon`,
        [weaponOptionFieldId],
        "weapon-selection-missing",
        "Weapon selection remains null and cannot be inferred from one applicable observation.",
      ),
      refinement: missing(
        "weapon.refinement",
        "/fields/weapon/refinement",
        "Weapon refinement is missing, not zero and not an inferred R1 or R5.",
        `${candidatePointer}/weaponOption/refinement`,
        "weapon-refinement-missing",
        "The source does not provide a refinement for the observed weapon.",
        [`${candidatePointer}/weaponOption/refinementStatus`],
      ),
      quantitativePerformance: missing(
        "weapon.quantitative-performance",
        "/fields/weapon/quantitativePerformance",
        "No quantitative weapon performance was supplied; applicability is not performance.",
        `${candidatePointer}/weaponOption/quantitativePerformanceStatus`,
        "weapon-performance-missing",
        "The observed weapon has no authenticated quantitative performance result.",
      ),
    },
    artifacts: {
      setOptions,
      selectedSet: unselected(
        "artifacts.selected-set",
        "/fields/artifacts/selectedSet",
        "No artifact set has been selected; the preserved Husk observation is not a default assignment.",
        `${candidatePointer}/selections/selectedArtifactSet`,
        [setOptionFieldId],
        "artifact-set-selection-missing",
        "Artifact set selection remains null.",
      ),
      mainStats,
    },
    substats: {
      sourceGroups: preserved(
        "substats.source-groups",
        "/fields/substats/sourceGroups",
        "Original source partial-order groups are preserved unchanged; CR and CD remain unordered within one group.",
        envelope.candidateMatch.candidateId,
        candidatePointer,
        `${candidatePointer}/artifactProfile/substatPriority/groups`,
      ),
      localRelationOverlays,
      selectedAllocation: unselected(
        "substats.selected-allocation",
        "/fields/substats/selectedAllocation",
        "No legal substat roll allocation has been selected or computed.",
        `${candidatePointer}/selections/selectedSubstatAllocation`,
        [],
        "substat-allocation-missing",
        "The candidate does not contain a legal selected substat allocation.",
      ),
      scalarWeights: missing(
        "substats.scalar-weights",
        "/fields/substats/scalarWeights",
        "Scalar weights are absent; request-local ordinal overlays are not weights.",
        `${candidatePointer}/artifactProfile/substatPriority/scalarWeights`,
        "scalar-weights-missing",
        "No scalar stat-weight model has been authenticated for this packet.",
      ),
    },
    computation: {
      enemyScenario: missing(
        "computation.enemy-scenario",
        "/fields/computation/enemyScenario",
        "Enemy scenario is missing, so the packet cannot support a computed guide result.",
        `${candidatePointer}/artifactProfile/missingBoundaries/enemyScenario`,
        "enemy-scenario-missing",
        "No enemy scenario has been provided.",
      ),
      formulaCounts: missing(
        "computation.formula-counts",
        "/fields/computation/formulaCounts",
        "Per-character formula counts are missing rather than treated as zero.",
        `${candidatePointer}/artifactProfile/missingBoundaries/formulaCounts`,
        "formula-counts-missing",
        "The source records do not provide the formula-count input needed for rotation-total computation.",
      ),
      rotationTimingAndBuffCoverage: missing(
        "computation.rotation-timing-and-buff-coverage",
        "/fields/computation/rotationTimingAndBuffCoverage",
        "Rotation timing and buff coverage are missing; the packet does not infer an optimal sequence.",
        `${envelopePointer}/unresolvedBoundaries/rotationTimingAndBuffCoverage`,
        "rotation-and-buff-coverage-missing",
        "No authenticated sequence, timing, or buff-coverage model exists for this packet.",
      ),
      teamTotalDamage: notComputed(
        "computation.team-total-damage",
        "/fields/computation/teamTotalDamage",
        "Team total damage has not been computed.",
        `${envelopePointer}/unresolvedBoundaries/teamTotalDamage`,
        "team-total-not-computed",
        "No team-total damage computation has run for this packet.",
      ),
      energyRecharge: deferred(
        "computation.energy-recharge",
        "/fields/computation/energyRecharge",
        "Energy Recharge remains explicitly deferred until the user supplies a sequence.",
        `${envelopePointer}/unresolvedBoundaries/energyRecharge`,
        "energy-recharge-deferred",
        "Energy Recharge is intentionally deferred and must not be inferred from this packet.",
      ),
    },
  };

  const localRelationProjection =
    envelope.relationAdmissionSummary.aggregateStatus ===
    "all-three-local-relations-admitted"
      ? "all-locally-admitted"
      : envelope.relationAdmissionSummary.withheldCounterexampleRelationCount > 0
        ? "partial-counterexamples-preserved"
        : "partial-inconclusive-preserved";
  const fieldPolicy = buildGuideDraftFieldPolicy(fields, blockers);

  const packet = finalizeGuideDraftPacket({
    schemaVersion: GUIDE_DRAFT_PACKET_SCHEMA_VERSION,
    packetType: "character-guide-draft-packet",
    packetId,
    subject: {
      characterId: envelope.request.characterId,
      requestId: envelope.request.requestId,
    },
    upstream: {
      reportPath: NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
      reportCanonicalSha256: cp57CanonicalObjectSha256,
      envelopeId: envelope.envelopeId,
      envelopeJsonPointer: envelopePointer,
      envelopeCanonicalObjectSha256: hashGuideDraftValue(envelope),
      envelopeSha256: envelope.envelopeSha256,
      candidateId: envelope.candidateMatch.candidateId,
      candidateJsonPointer: candidatePointer,
      candidateCanonicalObjectSha256: hashGuideDraftValue(
        envelope.partialCandidate,
      ),
      candidateSha256: envelope.candidateMatch.candidateSha256,
      profileId: envelope.candidateMatch.profileId,
    },
    fields,
    blockers,
    readiness: {
      observationProjection: "complete",
      localRelationProjection,
      guideReadiness: "incomplete",
      publicationStatus: "withheld",
      blockerCount: blockers.length,
    },
    capabilityBoundary: {
      supportsDraftSerialization: true,
      supportsPreservedObservationProjection: true,
      supportsRequestLocalRelationStateProjection: true,
      supportsGuideClaims: false,
      supportsPublication: false,
      supportsTeamRecommendationClaims: false,
      supportsEquipmentRecommendationClaims: false,
      supportsStatRecommendationClaims: false,
      supportsRankClaims: false,
      supportsWinnerClaims: false,
      supportsScalarWeights: false,
      supportsTotalStatOrder: false,
      supportsIdealStatAllocation: false,
      supportsOptimizerClaims: false,
      supportsAutoTuneClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRechargeClaims: false,
    },
  });
  return validateGuideDraftPacket(
    packet,
    cp57Report,
    NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
    fieldPolicy,
  );
}

function buildProvenance(
  cp57Report: NoelleHexereiRequestConditionedCandidateAdmissionReport,
  sourceObjectId: string,
  sourceObjectJsonPointer: string,
  sourceValueJsonPointer: string,
): GuideDraftUpstreamProvenance {
  return {
    sourceObjectId,
    sourceObjectJsonPointer,
    sourceObjectCanonicalSha256: hashGuideDraftValue(
      resolveGuideDraftJsonPointer(cp57Report, sourceObjectJsonPointer),
    ),
    sourceValueJsonPointer,
    sourceValueCanonicalSha256: hashGuideDraftValue(
      resolveGuideDraftJsonPointer(cp57Report, sourceValueJsonPointer),
    ),
  };
}

function buildBlockerId(
  packetId: string,
  fieldId: string,
  code: GuideDraftBlockerCode,
): string {
  return `${packetId}:${fieldId}:${code}`;
}

function buildBlocker(
  field: GuideDraftField,
  blockerId: string,
  code: GuideDraftBlockerCode,
): GuideDraftBlocker {
  return finalizeGuideDraftBlocker({
    blockerId,
    fieldId: field.fieldId,
    fieldPath: field.fieldPath,
    code,
    blocksPublication: true,
    sourceFieldSha256: field.fieldSha256,
  });
}

function authenticateOuterInputs(
  input: NoelleHexereiGuideDraftProjectionInput,
): AuthenticatedOuterInputs {
  if (
    NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS.length !==
      EXPECTED_INPUT_PATH_COUNT ||
    NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_RUNTIME_INPUT_PATHS.length !==
      EXPECTED_RUNTIME_INPUT_PATH_COUNT ||
    NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS.filter((sourcePath) =>
      sourcePath.endsWith(".json"),
    ).length !== EXPECTED_JSON_INPUT_COUNT ||
    NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_RUNTIME_INPUT_PATHS.filter(
      (sourcePath) => sourcePath.endsWith(".json.gz"),
    ).length !== EXPECTED_BINARY_RUNTIME_INPUT_COUNT ||
    NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_RUNTIME_INPUT_PATHS.some(
      (runtimePath) =>
        !NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS.includes(
          runtimePath,
        ),
    )
  ) {
    throw new Error("CP58 declared closure cardinality drifted.");
  }
  const expectedPaths = [...NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS];
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
    throw new Error("CP58 exact outer source/generatedFrom path closure drifted.");
  }
  const sourceBytesByPath = new Map<string, Buffer>();
  for (const { path: sourcePath, bytesBase64 } of input.sourceFiles) {
    if (!bytesBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(bytesBase64)) {
      throw new Error(`CP58 source bytes are not canonical base64 at ${sourcePath}.`);
    }
    const bytes = Buffer.from(bytesBase64, "base64");
    if (bytes.length === 0 || bytes.toString("base64") !== bytesBase64) {
      throw new Error(`CP58 source bytes failed base64 round-trip at ${sourcePath}.`);
    }
    let workspaceBytes: Buffer;
    try {
      workspaceBytes = readFileSync(path.join(REPOSITORY_ROOT, sourcePath));
    } catch {
      throw new Error(`CP58 workspace source file is unreadable at ${sourcePath}.`);
    }
    if (!bytes.equals(workspaceBytes)) {
      throw new Error(
        `CP58 supplied source bytes do not match the workspace file at ${sourcePath}.`,
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
        hashBytes(requiredSourceBytes(sourceBytesByPath, sourcePath))
    ) {
      throw new Error(`CP58 source/hash authentication drifted at ${sourcePath}.`);
    }
  }
  const cp57Report = parseJsonReport(
    sourceBytesByPath,
    NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
  );
  if (stableJson(cp57Report) !== stableJson(input.cp57ReportInput)) {
    throw new Error(
      "CP58 CP57 durable report bytes disagree with the supplied parsed object.",
    );
  }
  return {
    sourceBytesByPath,
    generatedFrom: input.generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    cp57Report,
  };
}

function assertExactCp57InputProjection(
  raw: AuthenticatedOuterInputs,
  cp57Input: NoelleHexereiRequestConditionedCandidateAdmissionInput,
): void {
  const expectedSourceFiles =
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS.map(
      (sourcePath) => ({
        path: sourcePath,
        bytesBase64: requiredSourceBytes(
          raw.sourceBytesByPath,
          sourcePath,
        ).toString("base64"),
      }),
    );
  const generatedByPath = new Map(
    raw.generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  const expectedGeneratedFrom =
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS.map(
      (sourcePath) => {
        const entry = generatedByPath.get(sourcePath);
        if (!entry) throw new Error(`CP58 missing CP57 input hash ${sourcePath}.`);
        return { ...entry };
      },
    );
  if (
    stableJson(cp57Input.sourceFiles) !== stableJson(expectedSourceFiles) ||
    stableJson(cp57Input.generatedFrom) !== stableJson(expectedGeneratedFrom)
  ) {
    throw new Error(
      "CP58 CP57 input is not the exact projection of the outer authenticated byte closure.",
    );
  }
}

function assertExactTechnicalRequest(
  request: typeof NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
): void {
  if (
    stableJson(request) !==
    stableJson(NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST)
  ) {
    throw new Error("CP58 technical request drifted from its exact declared domain.");
  }
}

function assertCp57Boundary(
  report: NoelleHexereiRequestConditionedCandidateAdmissionReport,
): void {
  if (
    report.summary.requestConditionedEnvelopeCount !== 6 ||
    report.summary.relationAdmissionCount !== 18 ||
    report.summary.admittedRelationCount !== 12 ||
    report.summary.withheldCounterexampleRelationCount !== 6 ||
    report.summary.withheldInconclusiveRelationCount !== 0 ||
    report.summary.allRelationsAdmittedRequestCount !== 2 ||
    report.summary.oneOrMoreRelationsWithheldRequestCount !== 4 ||
    report.summary.sourceSelectionCount !== 0 ||
    report.summary.rankingCount !== 0 ||
    report.summary.scalarWeightCount !== 0 ||
    report.summary.damageComputationCount !== 0 ||
    report.summary.rotationReplayCount !== 0 ||
    report.summary.teamTotalDamageComputationCount !== 0 ||
    report.summary.energyRecoveryComputationCount !== 0 ||
    report.supportsGuideClaims ||
    report.supportsTeamRecommendations ||
    report.supportsBuildRecommendations ||
    report.supportsEquipmentRecommendations ||
    report.supportsStatRecommendations ||
    report.supportsRankClaims ||
    report.supportsWinnerClaims ||
    report.supportsScalarWeights ||
    report.supportsTotalStatOrder ||
    report.supportsIdealStatAllocation ||
    report.supportsPlayerDamageClaims ||
    report.supportsSourceRotationReplay ||
    report.supportsTeamTotalDamageComputation ||
    report.supportsEnergyRecoveryClaims
  ) {
    throw new Error("CP58 rejected a drifted CP57 authority/capability boundary.");
  }
}

function assertPacketOrderAndCardinality(
  packets: readonly NoelleHexereiGuideDraftPacket[],
): void {
  const requestIds = packets.map(({ subject }) => subject.requestId);
  if (
    packets.length !== EXPECTED_PACKET_COUNT ||
    stableJson(requestIds) !==
      stableJson(
        NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST.exactPacketOrder,
      )
  ) {
    throw new Error("CP58 packet order/cardinality drifted.");
  }
  const expectedBlockersByRequest = new Map([
    ["c0-q9", 19],
    ["c5-q9", 20],
    ["c0-q10", 22],
    ["c5-q10", 21],
    ["c6-q9", 23],
    ["c6-q10", 23],
  ]);
  for (const packet of packets) {
    if (
      packet.blockers.length !== expectedBlockersByRequest.get(packet.subject.requestId)
    ) {
      throw new Error(
        `CP58 blocker decomposition drifted for ${packet.subject.requestId}.`,
      );
    }
  }
}

function assertExactProjectionCensus(
  packets: readonly NoelleHexereiGuideDraftPacket[],
  fields: readonly GuideDraftField[],
  blockers: readonly GuideDraftBlocker[],
  stateCounts: ReadonlyMap<GuideDraftField["state"], number>,
  allRelationsAdmittedPacketCount: number,
): void {
  const expectedCounts = new Map<GuideDraftField["state"], number>([
    ["preserved-evidence", 60],
    ["preserved-blocking-evidence", 30],
    ["locally-admitted-relation", 12],
    ["withheld-counterexample", 6],
    ["withheld-inconclusive", 0],
    ["guarded-unresolved-alternative", 8],
    ["unselected", 36],
    ["missing-not-zero", 36],
    ["not-computed", 6],
    ["deferred-missing-not-zero", 6],
  ]);
  if (
    packets.length !== EXPECTED_PACKET_COUNT ||
    fields.length !== EXPECTED_FIELD_COUNT ||
    blockers.length !== EXPECTED_BLOCKER_COUNT ||
    new Set(blockers.map(({ blockerId }) => blockerId)).size !==
      blockers.length ||
    allRelationsAdmittedPacketCount !== 2
  ) {
    throw new Error("CP58 exact projection census drifted.");
  }
  for (const [state, expectedCount] of expectedCounts) {
    if ((stateCounts.get(state) ?? 0) !== expectedCount) {
      throw new Error(`CP58 ${state} field census drifted.`);
    }
  }
  const linkedBlockerIds = fields.flatMap(({ blockerIds }) => blockerIds);
  if (
    linkedBlockerIds.length !== blockers.length ||
    new Set(linkedBlockerIds).size !== blockers.length ||
    stableJson([...linkedBlockerIds].sort(compareText)) !==
      stableJson(blockers.map(({ blockerId }) => blockerId).sort(compareText))
  ) {
    throw new Error("CP58 blocker reconstruction from field states drifted.");
  }
}

function countFieldStates(
  fields: readonly GuideDraftField[],
): Map<GuideDraftField["state"], number> {
  const counts = new Map<GuideDraftField["state"], number>();
  for (const { state } of fields) counts.set(state, (counts.get(state) ?? 0) + 1);
  return counts;
}

function collectFields(value: unknown): GuideDraftField[] {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "fieldId" in value &&
    "fieldPath" in value &&
    "fieldSha256" in value &&
    "state" in value
  ) {
    return [value as GuideDraftField];
  }
  if (Array.isArray(value)) return value.flatMap(collectFields);
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap(collectFields);
}

function parseJsonReport(
  sourceBytesByPath: ReadonlyMap<string, Buffer>,
  sourcePath: string,
): NoelleHexereiRequestConditionedCandidateAdmissionReport {
  try {
    return JSON.parse(
      requiredSourceBytes(sourceBytesByPath, sourcePath).toString("utf8"),
    ) as NoelleHexereiRequestConditionedCandidateAdmissionReport;
  } catch {
    throw new Error("CP58 CP57 durable report bytes are not valid JSON.");
  }
}

function requiredSourceBytes(
  sourceBytesByPath: ReadonlyMap<string, Buffer>,
  sourcePath: string,
): Buffer {
  const bytes = sourceBytesByPath.get(sourcePath);
  if (!bytes) throw new Error(`CP58 missing source bytes ${sourcePath}.`);
  return bytes;
}

function hashBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
