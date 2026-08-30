import { sha256Text, stableJson } from "./io";
import type { DionaSourceLocalSupportSliceReport } from "./dionaSourceLocalSupportSlice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import {
  KEQING_ROLE_PAIR_TARGET_TEAM_IDS,
  KEQING_ROLE_PAIR_VV_CONDITION,
  KEQING_SHRED_ROLE_RECORD_ID,
  type KeqingSourceScopedRolePairSampleReport,
} from "./keqingSourceScopedRolePairSample";
import type { KleeSourceLocalConditionSliceReport } from "./kleeSourceLocalConditionSlice";
import type {
  SourceConditionedGuidePacketAuthentication,
  SourceConditionedGuidePacketReport,
  SourceConditionPredicateAst,
} from "./sourceConditionedGuidePacket";

export type CurrentConditionBindingClassification =
  | "typed-bound"
  | "exact-text-acknowledged"
  | "unbound"
  | "invalid";

export type CurrentConditionEnergyClassification =
  | "energy-unclassified"
  | "not-energy-deferred"
  | "structural-er"
  | "deferred-energy-prerequisite"
  | "exact-authored-energy-related-deferral";

export interface CurrentConditionArrayOccurrenceIdentity {
  sourceId: string;
  recordKind: "character_guide" | "character_role" | "team";
  sourceRecordId: string;
  manualClaimPath: string;
  conditionsSha256: string;
}

export type CurrentConditionBindingEvidence =
  | {
      kind: "itto-typed-predicate-ast";
      claimIds: string[];
      conditionMapKeys: string[];
      predicateAst: SourceConditionPredicateAst;
      predicateAstSha256: string;
    }
  | {
      kind: "keqing-equipment-typed-predicate-ids";
      atomicClaimIds: string[];
      predicateIds: string[];
      exactTeamResolutionEvidenceSha256: string;
    }
  | {
      kind: "keqing-role-exact-text-acknowledgement";
      characterId: string;
      roleRecordId: string;
      targetTeamIds: string[];
      targetIds: string[];
      acknowledgementCount: number;
    }
  | {
      kind: "source-local-typed-predicate-ast";
      sliceId: string;
      selectedOccurrenceId: string;
      selectedOccurrenceSha256: string;
      predicateAst: SourceConditionPredicateAst;
      predicateAstSha256: string;
      payloadSha256: string;
      occurrenceControlSha256: string;
    };

export type CurrentConditionEnergyEvidence =
  | {
      kind: "not-energy-deferred";
      structuralErEvidencePresent: false;
      energyRelatedWorkDeferred: false;
    }
  | {
      kind: "structural-er";
      structuralErEvidencePresent: true;
      energyRelatedWorkDeferred: true;
      evidenceIds: string[];
    }
  | {
      kind: "deferred-energy-prerequisite";
      structuralErEvidencePresent: false;
      energyRelatedWorkDeferred: true;
      reasons: string[];
    }
  | {
      kind: "exact-authored-energy-related-deferral";
      structuralErEvidencePresent: false;
      energyRelatedWorkDeferred: true;
      category: string;
      reason: string;
      occurrenceKey: string;
    }
  | {
      kind: "source-local-not-energy-deferred";
      structuralErEvidencePresent: false;
      energyRelatedWorkDeferred: false;
      sliceId: string;
      selectedOccurrenceId: string;
      selectedOccurrenceSha256: string;
    };

export interface CurrentConditionBindingCatalogEntry
  extends CurrentConditionArrayOccurrenceIdentity {
  occurrenceId: string;
  occurrenceKey: string;
  /** Expected manual extractor subject; closes same-hash role-member reorder leaks. */
  subject: string;
  orderedConditions: string[];
  bindingClassification: CurrentConditionBindingClassification;
  energyClassification: CurrentConditionEnergyClassification;
  typedBinding: boolean;
  bindingEvidence: CurrentConditionBindingEvidence;
  energyEvidence: CurrentConditionEnergyEvidence | null;
}

export interface AuthenticatedCurrentReportPair<T> {
  durableReport: unknown;
  currentReport: T;
}

export interface BuildCurrentConditionBindingCatalogInput {
  ittoAuthentication: SourceConditionedGuidePacketAuthentication;
  keqingEquipment: AuthenticatedCurrentReportPair<KeqingLunarEquipmentEvidenceValidationReport>;
  keqingRolePair: AuthenticatedCurrentReportPair<KeqingSourceScopedRolePairSampleReport>;
  kleeSourceLocal: AuthenticatedCurrentReportPair<KleeSourceLocalConditionSliceReport>;
  dionaSourceLocal: AuthenticatedCurrentReportPair<DionaSourceLocalSupportSliceReport>;
}

export interface CurrentConditionBindingCatalogIssue {
  code: string;
  path: string;
  message: string;
}

export interface CurrentConditionBindingCatalogReport {
  schemaVersion: 1;
  reportType: "authenticated-current-condition-binding-catalog";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "internal-validation-only";
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsEnergyRecoveryClaims: false;
  energyRecoveryComputationExecuted: false;
  authenticationBoundary: {
    ittoAuthenticated: boolean;
    keqingEquipmentDurableMatchesCurrent: boolean;
    keqingRolePairDurableMatchesCurrent: boolean;
    kleeSourceLocalDurableMatchesCurrent: boolean;
    dionaSourceLocalDurableMatchesCurrent: boolean;
  };
  entries: CurrentConditionBindingCatalogEntry[];
  summary: {
    occurrenceCount: number;
    bindingClassificationCounts: Record<
      CurrentConditionBindingClassification,
      number
    >;
    energyClassificationCounts: Record<
      CurrentConditionEnergyClassification,
      number
    >;
    typedBindingCount: number;
    ittoOccurrenceCount: number;
    ittoTypedBindingCount: number;
    ittoDeferredEnergyPrerequisiteCount: number;
    keqingEquipmentOccurrenceCount: number;
    keqingEquipmentAtomicClaimCount: number;
    keqingVvAcknowledgedOccurrenceCount: number;
    keqingVvExactTextAcknowledgementCount: number;
    keqingVvUnacknowledgedSourceMemberIds: string[];
    kleeSourceLocalOccurrenceCount: number;
    kleeSourceLocalTypedBindingCount: number;
    kleeSourceLocalNotEnergyDeferredCount: number;
    dionaSourceLocalOccurrenceCount: number;
    dionaSourceLocalTypedBindingCount: number;
    dionaSourceLocalNotEnergyDeferredCount: number;
  };
  issues: CurrentConditionBindingCatalogIssue[];
}

const ITTO_EXPERIMENT_ID = "itto-source-conditioned-guide-packets-v1";
const ITTO_EXPECTED_OCCURRENCE_COUNT = 15;
const ITTO_EXPECTED_DEFERRED_COUNT = 3;
const KEQING_EQUIPMENT_EXPECTED_ATOMIC_CLAIM_COUNT = 42;
const KEQING_EQUIPMENT_EXPECTED_OCCURRENCE_COUNT = 31;
const KEQING_VV_EXPECTED_ACKNOWLEDGED_CHARACTERS = [
  "jean",
  "kaedehara_kazuha",
  "sucrose",
] as const;
const KEQING_VV_UNACKNOWLEDGED_SOURCE_MEMBERS = ["sayu", "xianyun"] as const;
const KEQING_SHRED_ROLE_SOURCE_RECORD_ID =
  "keqing-lunar-charged-resistance-shred-options";
const KLEE_SOURCE_LOCAL_SLICE_ID =
  "kqm-klee-source-local-condition-slice-luna-iv";
const KLEE_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCE_IDS = [
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.circlet[0].conditions",
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.goblet[0].conditions",
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.sands[0].conditions",
  "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[2].conditions",
] as const;
const DIONA_SOURCE_LOCAL_SLICE_ID =
  "kqm-diona-source-local-support-slice-luna-viii";
const DIONA_SOURCE_LOCAL_SOURCE_RECORD_ID =
  "c6-diona-mavuika-citlali-bennett-forward-melt";
const DIONA_SOURCE_LOCAL_REPOSITORY_RECORD_ID =
  "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt";
const DIONA_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[0].artifactRecommendations[0].conditions",
    characterId: "diona",
    memberIndex: 0,
  },
  {
    occurrenceId:
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[2].artifactRecommendations[0].conditions",
    characterId: "citlali",
    memberIndex: 2,
  },
  {
    occurrenceId:
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[3].artifactRecommendations[0].conditions",
    characterId: "bennett",
    memberIndex: 3,
  },
] as const;

const KEQING_SHRED_SOURCE_MEMBER_INDEX: Readonly<Record<string, number>> = {
  kaedehara_kazuha: 0,
  sucrose: 1,
  jean: 2,
  xianyun: 3,
  sayu: 4,
  xilonen: 5,
};

/**
 * Construct the canonical key shared by condition-array extraction and binding
 * evidence. The ordered-array hash is deliberately part of the identity, so a
 * prose edit creates a new occurrence instead of silently inheriting a binding.
 */
export function buildCurrentConditionArrayOccurrenceKey(
  identity: CurrentConditionArrayOccurrenceIdentity,
): string {
  for (const [field, value] of [
    ["sourceId", identity.sourceId],
    ["recordKind", identity.recordKind],
    ["sourceRecordId", identity.sourceRecordId],
    ["manualClaimPath", identity.manualClaimPath],
  ] as const) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Condition occurrence ${field} must be a non-empty string.`);
    }
  }
  if (!/^[0-9a-f]{64}$/.test(identity.conditionsSha256)) {
    throw new Error(
      "Condition occurrence conditionsSha256 must be a lowercase SHA-256 digest.",
    );
  }
  return `${buildCurrentConditionArrayOccurrenceId(identity)}:${identity.conditionsSha256}`;
}

/** Match key emitted by the generic manual-snapshot condition extractor. */
export function buildCurrentConditionArrayOccurrenceId(
  identity: Pick<
    CurrentConditionArrayOccurrenceIdentity,
    "sourceId" | "recordKind" | "sourceRecordId" | "manualClaimPath"
  >,
): string {
  for (const [field, value] of [
    ["sourceId", identity.sourceId],
    ["recordKind", identity.recordKind],
    ["sourceRecordId", identity.sourceRecordId],
    ["manualClaimPath", identity.manualClaimPath],
  ] as const) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Condition occurrence ${field} must be a non-empty string.`);
    }
  }
  return `${identity.sourceId}:${identity.recordKind}:${identity.sourceRecordId}:${identity.manualClaimPath}`;
}

export function buildCurrentConditionBindingCatalog(
  input: BuildCurrentConditionBindingCatalogInput,
): CurrentConditionBindingCatalogReport {
  const issues: CurrentConditionBindingCatalogIssue[] = [];
  const ittoAuthenticated = input.ittoAuthentication.authenticated === true;
  const keqingEquipmentDurableMatchesCurrent = exactCurrentReportMatches(
    input.keqingEquipment,
  );
  const keqingRolePairDurableMatchesCurrent = exactCurrentReportMatches(
    input.keqingRolePair,
  );
  const kleeSourceLocalDurableMatchesCurrent = exactCurrentReportMatches(
    input.kleeSourceLocal,
  );
  const dionaSourceLocalDurableMatchesCurrent = exactCurrentReportMatches(
    input.dionaSourceLocal,
  );
  const authenticationBoundary = {
    ittoAuthenticated,
    keqingEquipmentDurableMatchesCurrent,
    keqingRolePairDurableMatchesCurrent,
    kleeSourceLocalDurableMatchesCurrent,
    dionaSourceLocalDurableMatchesCurrent,
  };

  if (!ittoAuthenticated) {
    addIssue(
      issues,
      "authentication.itto-not-authenticated",
      "ittoAuthentication",
      "The Itto report was not authenticated against current typed inputs.",
    );
  }
  if (!keqingEquipmentDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.keqing-equipment-stale",
      "keqingEquipment",
      "The durable Keqing equipment report differs from the current rebuilt report.",
    );
  }
  if (!keqingRolePairDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.keqing-role-pair-stale",
      "keqingRolePair",
      "The durable Keqing role-pair report differs from the current rebuilt report.",
    );
  }
  if (!kleeSourceLocalDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.klee-source-local-stale",
      "kleeSourceLocal",
      "The durable Klee source-local report differs from the current rebuilt report.",
    );
  }
  if (!dionaSourceLocalDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.diona-source-local-stale",
      "dionaSourceLocal",
      "The durable Diona source-local report differs from the current rebuilt report.",
    );
  }
  if (issues.length > 0) {
    return failedReport(authenticationBoundary, issues);
  }

  try {
    const ittoReport = authenticatedIttoReport(input.ittoAuthentication);
    const entries = [
      ...extractIttoEntries(ittoReport, issues),
      ...extractKeqingEquipmentEntries(
        input.keqingEquipment.currentReport,
        issues,
      ),
      ...extractKeqingVvEntries(input.keqingRolePair.currentReport, issues),
      ...extractKleeSourceLocalEntries(
        input.kleeSourceLocal.currentReport,
        issues,
      ),
      ...extractDionaSourceLocalEntries(
        input.dionaSourceLocal.currentReport,
        issues,
      ),
    ];
    validateCombinedEntries(entries, issues);
    if (issues.length > 0) {
      return failedReport(authenticationBoundary, issues);
    }
    const canonicalEntries = entries.sort((left, right) =>
      left.occurrenceKey.localeCompare(right.occurrenceKey),
    );
    return {
      ...baseReport(authenticationBoundary),
      comparisonStatus: "comparable",
      entries: canonicalEntries,
      summary: summarize(canonicalEntries),
      issues: [],
    };
  } catch (error) {
    addIssue(
      issues,
      "catalog.unexpected-input-shape",
      "input",
      error instanceof Error ? error.message : String(error),
    );
    return failedReport(authenticationBoundary, issues);
  }
}

export function requireComparableCurrentConditionBindingCatalog(
  report: CurrentConditionBindingCatalogReport,
): CurrentConditionBindingCatalogReport & { comparisonStatus: "comparable" } {
  if (report.comparisonStatus !== "comparable") {
    const details = report.issues
      .map(({ code, path }) => `${code} at ${path}`)
      .join("; ");
    throw new Error(
      `Current condition-binding catalog is not comparable${details ? `: ${details}` : "."}`,
    );
  }
  return report as CurrentConditionBindingCatalogReport & {
    comparisonStatus: "comparable";
  };
}

function exactCurrentReportMatches<T>(
  pair: AuthenticatedCurrentReportPair<T>,
): boolean {
  return stableJson(pair.durableReport) === stableJson(pair.currentReport);
}

function authenticatedIttoReport(
  authentication: SourceConditionedGuidePacketAuthentication,
): SourceConditionedGuidePacketReport {
  if (!authentication.authenticated) {
    throw new Error("Itto authentication unexpectedly failed after preflight.");
  }
  return authentication.canonicalReport;
}

function extractIttoEntries(
  report: SourceConditionedGuidePacketReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  if (
    report.comparisonStatus !== "comparable" ||
    report.reportType !== "source-conditioned-guide-packet-report" ||
    report.experimentId !== ITTO_EXPERIMENT_ID ||
    report.issues.length !== 0
  ) {
    addIssue(
      issues,
      "itto.non-comparable",
      "ittoAuthentication.canonicalReport",
      "The authenticated Itto report does not expose the expected comparable checkpoint.",
    );
    return [];
  }
  if (
    report.supportsGuideClaims !== false ||
    report.ER !== false ||
    report.energyRecoveryInputsUsed !== false
  ) {
    addIssue(
      issues,
      "itto.policy-boundary-drift",
      "ittoAuthentication.canonicalReport",
      "The Itto checkpoint crossed a prohibited guide or energy-computation boundary.",
    );
  }
  if (
    report.sourceClaimCatalog.length !== ITTO_EXPECTED_OCCURRENCE_COUNT ||
    report.summary.sourceClaimCount !== ITTO_EXPECTED_OCCURRENCE_COUNT
  ) {
    addIssue(
      issues,
      "itto.partial-claim-catalog",
      "ittoAuthentication.canonicalReport.sourceClaimCatalog",
      `Expected ${ITTO_EXPECTED_OCCURRENCE_COUNT} Itto condition occurrences.`,
    );
    return [];
  }

  const claimsById = new Map<string, number>();
  for (const claim of report.sourceClaimCatalog) {
    claimsById.set(claim.claimId, (claimsById.get(claim.claimId) ?? 0) + 1);
  }
  for (const [claimId, count] of claimsById) {
    if (count !== 1) {
      addIssue(
        issues,
        "itto.duplicate-claim-id",
        `ittoAuthentication.canonicalReport.sourceClaimCatalog.${claimId}`,
        `Expected one Itto atomic claim, found ${count}.`,
      );
    }
  }

  const mapKeys = Object.keys(report.policyBoundary.conditionMap).sort();
  const claimIds = report.sourceClaimCatalog
    .map(({ claimId }) => claimId)
    .sort();
  if (stableJson(mapKeys) !== stableJson(claimIds)) {
    addIssue(
      issues,
      "itto.partial-condition-map",
      "ittoAuthentication.canonicalReport.policyBoundary.conditionMap",
      "The exact Itto condition map does not contain exactly one entry per atomic claim.",
    );
  }

  const entries: CurrentConditionBindingCatalogEntry[] = [];
  for (const claim of report.sourceClaimCatalog) {
    const path = ittoManualClaimPath(claim);
    const conditionsSha256 = sha256Text(
      stableJson(claim.sourceConditions),
    );
    const mapEntry = report.policyBoundary.conditionMap[claim.claimId];
    if (
      claim.sourceConditionsSha256 !== conditionsSha256 ||
      mapEntry?.sourceConditionsSha256 !== conditionsSha256 ||
      stableJson(mapEntry?.predicate) !== stableJson(claim.predicate)
    ) {
      addIssue(
        issues,
        "itto.conflicting-condition-evidence",
        `ittoAuthentication.canonicalReport.sourceClaimCatalog.${claim.claimId}`,
        "The claim, ordered condition hash, and typed condition-map evidence do not agree exactly.",
      );
      continue;
    }
    const deferredReasons = deferredEnergyReasons(claim.predicate);
    const energyClassification =
      deferredReasons.length > 0
        ? "deferred-energy-prerequisite"
        : "not-energy-deferred";
    entries.push(
      makeEntry({
        sourceId: claim.sourceId,
        recordKind: "character_guide",
        sourceRecordId: claim.sourceRecordId,
        manualClaimPath: path,
        subject: claim.characterId,
        orderedConditions: claim.sourceConditions,
        bindingClassification: "typed-bound",
        energyClassification,
        bindingEvidence: {
          kind: "itto-typed-predicate-ast",
          claimIds: [claim.claimId],
          conditionMapKeys: [claim.claimId],
          predicateAst: structuredClone(claim.predicate),
          predicateAstSha256: sha256Text(stableJson(claim.predicate)),
        },
        energyEvidence:
          energyClassification === "deferred-energy-prerequisite"
            ? {
                kind: "deferred-energy-prerequisite",
                structuralErEvidencePresent: false,
                energyRelatedWorkDeferred: true,
                reasons: deferredReasons,
              }
            : notEnergyDeferredEvidence(),
      }),
    );
  }
  const deferredCount = entries.filter(
    ({ energyClassification }) =>
      energyClassification === "deferred-energy-prerequisite",
  ).length;
  if (deferredCount !== ITTO_EXPECTED_DEFERRED_COUNT) {
    addIssue(
      issues,
      "itto.deferred-energy-count-drift",
      "ittoAuthentication.canonicalReport.sourceClaimCatalog",
      `Expected ${ITTO_EXPECTED_DEFERRED_COUNT} ER-deferred Itto occurrences, found ${deferredCount}.`,
    );
  }
  return entries;
}

function ittoManualClaimPath(
  claim: SourceConditionedGuidePacketReport["sourceClaimCatalog"][number],
): string {
  const prefix = "recommendation";
  const index = claim.recommendation.sourceIndex;
  switch (claim.payload.type) {
    case "main-stat":
      return `${prefix}.mainStats.${claim.payload.slot}[${index}].conditions`;
    case "substat":
      return `${prefix}.substats[${index}].conditions`;
    case "artifact-group":
      return `${prefix}.artifactRecommendations[${index}].conditions`;
    case "weapon-group":
      return `${prefix}.weaponRecommendations[${index}].conditions`;
  }
}

function extractKeqingEquipmentEntries(
  report: KeqingLunarEquipmentEvidenceValidationReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  if (
    report.validationStatus !== "comparable" ||
    report.classification !==
      "keqing-lunar-equipment-evidence-structural-validation" ||
    report.sourceBoundary.sourceId !== "kqm"
  ) {
    addIssue(
      issues,
      "keqing-equipment.non-comparable",
      "keqingEquipment.currentReport",
      "The Keqing equipment evidence report is not the expected comparable checkpoint.",
    );
    return [];
  }
  if (
    report.supportsGuideClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.energyRecoveryInputsUsed !== false ||
    report.sourceConditionBoundary.allSourceConditionsMappedExactly !== true
  ) {
    addIssue(
      issues,
      "keqing-equipment.policy-boundary-drift",
      "keqingEquipment.currentReport",
      "The Keqing equipment checkpoint crossed a prohibited guide/energy boundary or lost exact condition mappings.",
    );
  }
  if (
    report.claims.length !== KEQING_EQUIPMENT_EXPECTED_ATOMIC_CLAIM_COUNT ||
    report.sourceBoundary.expectedParticipatingRecordCount !== 17 ||
    report.sourceBoundary.records.length !== 17 ||
    !report.sourceBoundary.allRecordsPresentExactlyOnce ||
    !report.sourceBoundary.allManualPayloadsMatch ||
    !report.sourceBoundary.allRepositoryPayloadsMatch ||
    !report.sourceBoundary.allRepositoryRecommendationsMatchManual
  ) {
    addIssue(
      issues,
      "keqing-equipment.partial-evidence",
      "keqingEquipment.currentReport.claims",
      `Expected a closed 17-record, ${KEQING_EQUIPMENT_EXPECTED_ATOMIC_CLAIM_COUNT}-claim Keqing evidence checkpoint.`,
    );
    return [];
  }

  const claimIdCounts = new Map<string, number>();
  const groups = new Map<
    string,
    {
      sourceId: string;
      recordKind: "character_guide";
      sourceRecordId: string;
      manualClaimPath: string;
      orderedConditions: string[];
      atomicClaimIds: string[];
      predicateIds: string[];
      teamResolutionEvidence: unknown;
      locatorKey: string;
    }
  >();
  const locatorHashes = new Map<string, Set<string>>();

  for (const claim of report.claims) {
    claimIdCounts.set(
      claim.claimId,
      (claimIdCounts.get(claim.claimId) ?? 0) + 1,
    );
    if (!claim.allSourceConditionsMappedExactly) {
      addIssue(
        issues,
        "keqing-equipment.unbound-condition-array",
        `keqingEquipment.currentReport.claims.${claim.claimId}`,
        "Every current Keqing equipment condition must retain an exact typed mapping.",
      );
      continue;
    }
    const manualClaimPath = keqingEquipmentManualClaimPath(claim);
    const orderedConditions = [...claim.sourceConditions];
    const conditionsSha256 = sha256Text(stableJson(orderedConditions));
    const locatorKey = stableJson({
      sourceId: report.sourceBoundary.sourceId,
      recordKind: "character_guide",
      sourceRecordId: claim.sourceRecordId,
      manualClaimPath,
    });
    const hashes = locatorHashes.get(locatorKey) ?? new Set<string>();
    hashes.add(conditionsSha256);
    locatorHashes.set(locatorKey, hashes);

    const predicateIds = exactKeqingPredicateIds(claim, issues);
    const teamResolutionEvidence = claim.teamResolutions;
    const occurrenceKey = buildCurrentConditionArrayOccurrenceKey({
      sourceId: report.sourceBoundary.sourceId,
      recordKind: "character_guide",
      sourceRecordId: claim.sourceRecordId,
      manualClaimPath,
      conditionsSha256,
    });
    const existing = groups.get(occurrenceKey);
    if (existing) {
      if (
        stableJson(existing.orderedConditions) !== stableJson(orderedConditions) ||
        stableJson(existing.predicateIds) !== stableJson(predicateIds) ||
        stableJson(existing.teamResolutionEvidence) !==
          stableJson(teamResolutionEvidence)
      ) {
        addIssue(
          issues,
          "keqing-equipment.conflicting-atomic-evidence",
          `keqingEquipment.currentReport.claims.${claim.claimId}`,
          "Atomic claims sharing one source condition array expose conflicting binding evidence.",
        );
      }
      existing.atomicClaimIds.push(claim.claimId);
    } else {
      groups.set(occurrenceKey, {
        sourceId: report.sourceBoundary.sourceId,
        recordKind: "character_guide",
        sourceRecordId: claim.sourceRecordId,
        manualClaimPath,
        orderedConditions,
        atomicClaimIds: [claim.claimId],
        predicateIds,
        teamResolutionEvidence,
        locatorKey,
      });
    }
  }

  for (const [claimId, count] of claimIdCounts) {
    if (count !== 1) {
      addIssue(
        issues,
        "keqing-equipment.duplicate-atomic-claim-id",
        `keqingEquipment.currentReport.claims.${claimId}`,
        `Expected one atomic claim ID, found ${count}.`,
      );
    }
  }
  for (const [locatorKey, hashes] of locatorHashes) {
    if (hashes.size !== 1) {
      addIssue(
        issues,
        "keqing-equipment.conflicting-condition-array-hash",
        `keqingEquipment.currentReport.locator.${sha256Text(locatorKey)}`,
        "One exact source schema path produced multiple ordered condition-array hashes.",
      );
    }
  }
  if (groups.size !== KEQING_EQUIPMENT_EXPECTED_OCCURRENCE_COUNT) {
    addIssue(
      issues,
      "keqing-equipment.occurrence-count-drift",
      "keqingEquipment.currentReport.claims",
      `Expected ${KEQING_EQUIPMENT_EXPECTED_OCCURRENCE_COUNT} unique source condition arrays backed by 42 atomic claims, found ${groups.size}.`,
    );
  }

  return [...groups.values()].map((group) =>
    makeEntry({
      sourceId: group.sourceId,
      recordKind: group.recordKind,
      sourceRecordId: group.sourceRecordId,
      manualClaimPath: group.manualClaimPath,
      subject: "keqing",
      orderedConditions: group.orderedConditions,
      bindingClassification: "typed-bound",
      energyClassification: "not-energy-deferred",
      bindingEvidence: {
        kind: "keqing-equipment-typed-predicate-ids",
        atomicClaimIds: group.atomicClaimIds.sort(),
        predicateIds: group.predicateIds,
        exactTeamResolutionEvidenceSha256: sha256Text(
          stableJson(group.teamResolutionEvidence),
        ),
      },
      energyEvidence: notEnergyDeferredEvidence(),
    }),
  );
}

function keqingEquipmentManualClaimPath(
  claim: KeqingLunarEquipmentEvidenceValidationReport["claims"][number],
): string {
  const prefix = "recommendation";
  switch (claim.sourceClaim.kind) {
    case "weapon":
      return `${prefix}.weaponRecommendations[${claim.sourceClaim.groupIndex}].conditions`;
    case "artifact":
      return `${prefix}.artifactRecommendations[${claim.sourceClaim.groupIndex}].conditions`;
    case "main-stat":
      return `${prefix}.mainStats.${claim.sourceClaim.slot}[${claim.sourceClaim.entryIndex}].conditions`;
    case "substat":
      return `${prefix}.substats[${claim.sourceClaim.entryIndex}].conditions`;
  }
}

function exactKeqingPredicateIds(
  claim: KeqingLunarEquipmentEvidenceValidationReport["claims"][number],
  issues: CurrentConditionBindingCatalogIssue[],
): string[] {
  if (claim.teamResolutions.length !== KEQING_ROLE_PAIR_TARGET_TEAM_IDS.length) {
    addIssue(
      issues,
      "keqing-equipment.partial-team-resolution-evidence",
      `keqingEquipment.currentReport.claims.${claim.claimId}.teamResolutions`,
      "Each condition array must carry evidence for all four exact published teams.",
    );
    return [];
  }
  const expectedTeamIds = [...KEQING_ROLE_PAIR_TARGET_TEAM_IDS].sort();
  const actualTeamIds = claim.teamResolutions
    .map(({ teamRecordId }) => teamRecordId)
    .sort();
  if (stableJson(expectedTeamIds) !== stableJson(actualTeamIds)) {
    addIssue(
      issues,
      "keqing-equipment.conflicting-team-resolution-targets",
      `keqingEquipment.currentReport.claims.${claim.claimId}.teamResolutions`,
      "The condition acknowledgement targets differ from the four published source teams.",
    );
  }
  const predicateIds: string[] = [];
  for (const conditionIndex of claim.sourceConditions.keys()) {
    const ids = new Set<string>();
    for (const resolution of claim.teamResolutions) {
      const acknowledgements = resolution.conditionAcknowledgements.filter(
        (acknowledgement) => acknowledgement.conditionIndex === conditionIndex,
      );
      if (acknowledgements.length !== 1 || !acknowledgements[0]?.predicateId) {
        addIssue(
          issues,
          "keqing-equipment.partial-predicate-evidence",
          `keqingEquipment.currentReport.claims.${claim.claimId}.sourceConditions.${conditionIndex}`,
          "Every exact condition must have one stable typed predicate ID in every team resolution.",
        );
        continue;
      }
      ids.add(acknowledgements[0].predicateId);
    }
    if (ids.size !== 1) {
      addIssue(
        issues,
        "keqing-equipment.conflicting-predicate-evidence",
        `keqingEquipment.currentReport.claims.${claim.claimId}.sourceConditions.${conditionIndex}`,
        "The same ordered source condition maps to conflicting typed predicate IDs.",
      );
      continue;
    }
    predicateIds.push([...ids][0]!);
  }
  return predicateIds;
}

function extractKeqingVvEntries(
  report: KeqingSourceScopedRolePairSampleReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  if (
    report.comparisonStatus !== "comparable" ||
    report.classification !== "keqing-source-scoped-role-pair-sample" ||
    report.sourceExtractionBoundary.sourceId !== "kqm" ||
    report.rolePairSample.comparisonStatus !== "comparable"
  ) {
    addIssue(
      issues,
      "keqing-role-pair.non-comparable",
      "keqingRolePair.currentReport",
      "The Keqing role-pair evidence report is not the expected comparable checkpoint.",
    );
    return [];
  }
  if (
    report.supportsGuideClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.energyRecoveryInputsUsed !== false ||
    report.sourceExtractionBoundary.expectedParticipatingRecordCount !== 7 ||
    !report.sourceExtractionBoundary.configuredRecordsPresentExactlyOnce ||
    !report.sourceExtractionBoundary.allExtractionStatesMatch ||
    report.rolePairSample.targets.length !== 4 ||
    !report.publishedTargetBoundary.configuredTargetsMatchExpectation ||
    !report.publishedTargetBoundary.evaluatedTargetsMatchConfiguration
  ) {
    addIssue(
      issues,
      "keqing-role-pair.partial-evidence",
      "keqingRolePair.currentReport",
      "The Keqing role-pair checkpoint does not expose the complete four-target authenticated boundary.",
    );
    return [];
  }

  const shredRole = report.roleInventoryBoundary.roleRecords.find(
    ({ roleRecordId }) => roleRecordId === KEQING_SHRED_ROLE_RECORD_ID,
  );
  if (!shredRole) {
    addIssue(
      issues,
      "keqing-role-pair.missing-shred-role",
      "keqingRolePair.currentReport.roleInventoryBoundary",
      "The resistance-shred source role is missing.",
    );
    return [];
  }
  const roleConditionsByCharacter = new Map(
    shredRole.members.map(({ characterId, conditions }) => [
      characterId,
      [...conditions],
    ]),
  );
  for (const characterId of [
    ...KEQING_VV_EXPECTED_ACKNOWLEDGED_CHARACTERS,
    ...KEQING_VV_UNACKNOWLEDGED_SOURCE_MEMBERS,
  ]) {
    if (
      stableJson(roleConditionsByCharacter.get(characterId)) !==
      stableJson([KEQING_ROLE_PAIR_VV_CONDITION])
    ) {
      addIssue(
        issues,
        "keqing-role-pair.source-member-condition-drift",
        `keqingRolePair.currentReport.roleInventoryBoundary.${characterId}`,
        "The source role member no longer carries the exact VV condition array.",
      );
    }
  }
  if (stableJson(roleConditionsByCharacter.get("xilonen")) !== stableJson([])) {
    addIssue(
      issues,
      "keqing-role-pair.xilonen-condition-drift",
      "keqingRolePair.currentReport.roleInventoryBoundary.xilonen",
      "Xilonen must remain the unconditioned resistance-shred member.",
    );
  }

  type VvAcknowledgement = {
    characterId: string;
    targetTeamId: string;
    targetId: string;
  };
  const acknowledgements: VvAcknowledgement[] = [];
  for (const target of report.rolePairSample.targets) {
    if (target.comparisonStatus !== "comparable" || target.issues.length !== 0) {
      addIssue(
        issues,
        "keqing-role-pair.target-not-comparable",
        `keqingRolePair.currentReport.rolePairSample.targets.${target.targetId}`,
        "Every published role-pair target must remain individually comparable.",
      );
      continue;
    }
    const shredBindings = target.roleMemberBindings.filter(
      ({ roleRecordId }) => roleRecordId === KEQING_SHRED_ROLE_RECORD_ID,
    );
    if (shredBindings.length !== 1) {
      addIssue(
        issues,
        "keqing-role-pair.ambiguous-shred-binding",
        `keqingRolePair.currentReport.rolePairSample.targets.${target.targetId}`,
        `Expected one resistance-shred binding, found ${shredBindings.length}.`,
      );
      continue;
    }
    const binding = shredBindings[0]!;
    const sourceConditions = roleConditionsByCharacter.get(binding.characterId);
    if (
      !sourceConditions ||
      stableJson(binding.requiredConditions) !== stableJson(sourceConditions) ||
      stableJson(binding.acknowledgedConditions) !==
        stableJson(sourceConditions) ||
      !binding.conditionsMatch
    ) {
      addIssue(
        issues,
        "keqing-role-pair.conflicting-acknowledgement",
        `keqingRolePair.currentReport.rolePairSample.targets.${target.targetId}.${binding.characterId}`,
        "The published target acknowledgement conflicts with the exact source member condition array.",
      );
      continue;
    }
    const configured = report.configuredPublishedTargets.find(
      ({ targetId }) => targetId === target.targetId,
    );
    if (
      !configured ||
      stableJson(
        configured.acknowledgedConditionsByRoleRecordId[
          KEQING_SHRED_ROLE_RECORD_ID
        ] ?? [],
      ) !== stableJson(sourceConditions)
    ) {
      addIssue(
        issues,
        "keqing-role-pair.configured-acknowledgement-conflict",
        `keqingRolePair.currentReport.configuredPublishedTargets.${target.targetId}`,
        "Configured and evaluated exact-text acknowledgements do not agree.",
      );
      continue;
    }
    if (sourceConditions.length > 0) {
      acknowledgements.push({
        characterId: binding.characterId,
        targetTeamId: target.targetTeamId,
        targetId: target.targetId,
      });
    }
  }

  const acknowledgedCharacters = acknowledgements
    .map(({ characterId }) => characterId)
    .sort();
  if (
    stableJson(acknowledgedCharacters) !==
    stableJson([...KEQING_VV_EXPECTED_ACKNOWLEDGED_CHARACTERS].sort())
  ) {
    addIssue(
      issues,
      "keqing-role-pair.vv-acknowledgement-scope-drift",
      "keqingRolePair.currentReport.rolePairSample.targets",
      "VV acknowledgements must remain limited to Jean, Kaedehara Kazuha, and Sucrose; Sayu and Xianyun are unexercised source members.",
    );
  }

  const groups = new Map<string, VvAcknowledgement[]>();
  for (const acknowledgement of acknowledgements) {
    const existing = groups.get(acknowledgement.characterId) ?? [];
    existing.push(acknowledgement);
    groups.set(acknowledgement.characterId, existing);
  }
  return [...groups.entries()].map(([characterId, evidence]) => {
    const sourceIndex = KEQING_SHRED_SOURCE_MEMBER_INDEX[characterId];
    if (sourceIndex == null) {
      throw new Error(`Missing pinned source member index for ${characterId}.`);
    }
    return makeEntry({
      sourceId: report.sourceExtractionBoundary.sourceId,
      recordKind: "character_role",
      sourceRecordId: KEQING_SHRED_ROLE_SOURCE_RECORD_ID,
      manualClaimPath: `members[${sourceIndex}].conditions`,
      subject: characterId,
      orderedConditions: [KEQING_ROLE_PAIR_VV_CONDITION],
      bindingClassification: "exact-text-acknowledged",
      energyClassification: "energy-unclassified",
      bindingEvidence: {
        kind: "keqing-role-exact-text-acknowledgement",
        characterId,
        roleRecordId: KEQING_SHRED_ROLE_RECORD_ID,
        targetTeamIds: evidence.map(({ targetTeamId }) => targetTeamId).sort(),
        targetIds: evidence.map(({ targetId }) => targetId).sort(),
        acknowledgementCount: evidence.length,
      },
      energyEvidence: null,
    });
  });
}

function extractKleeSourceLocalEntries(
  report: KleeSourceLocalConditionSliceReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  const sourceLocalSlice = report.sourceLocalSlice;
  if (
    report.comparisonStatus !== "comparable" ||
    report.reportType !== "klee-source-local-condition-slice" ||
    report.classification !==
      "authenticated-source-local-condition-binding-slice" ||
    report.sliceId !== KLEE_SOURCE_LOCAL_SLICE_ID ||
    report.issues.length !== 0 ||
    sourceLocalSlice == null ||
    sourceLocalSlice.comparisonStatus !== "comparable"
  ) {
    addIssue(
      issues,
      "klee-source-local.non-comparable",
      "kleeSourceLocal.currentReport",
      "The Klee source-local report is not the expected comparable authenticated slice.",
    );
    return [];
  }
  if (
    report.supportsGuideClaims !== false ||
    report.supportsTeamRecommendations !== false ||
    report.supportsEquipmentRecommendations !== false ||
    report.supportsStatRecommendations !== false ||
    report.supportsRankClaims !== false ||
    report.supportsDamageClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.recommendationCompositionExecuted !== false ||
    report.generatorExecuted !== false ||
    report.optimizerExecuted !== false ||
    report.damageComputationExecuted !== false ||
    report.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.supportsSourceAuthorization !== false ||
    sourceLocalSlice.supportsGuideClaims !== false ||
    sourceLocalSlice.supportsTeamRecommendations !== false ||
    sourceLocalSlice.supportsBuildRecommendations !== false ||
    sourceLocalSlice.supportsStatRecommendations !== false ||
    sourceLocalSlice.supportsRankClaims !== false ||
    sourceLocalSlice.supportsDamageClaims !== false ||
    sourceLocalSlice.supportsRotationClaims !== false ||
    sourceLocalSlice.supportsEnergyRecoveryClaims !== false ||
    sourceLocalSlice.playerFacingRecommendations !== false ||
    sourceLocalSlice.ranking !== false ||
    sourceLocalSlice.buildComposition !== false ||
    sourceLocalSlice.damage !== false ||
    sourceLocalSlice.formulas !== false ||
    sourceLocalSlice.rotations !== false ||
    sourceLocalSlice.ER !== false ||
    sourceLocalSlice.recommendationCompositionExecuted !== false ||
    sourceLocalSlice.generatorExecuted !== false ||
    sourceLocalSlice.optimizerExecuted !== false ||
    sourceLocalSlice.damageComputationExecuted !== false ||
    sourceLocalSlice.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.assembledBuildCount !== 0 ||
    sourceLocalSlice.issues.length !== 0 ||
    sourceLocalSlice.sliceId !== report.sliceId ||
    sourceLocalSlice.sourceDocumentBoundary.status !== "accepted" ||
    sourceLocalSlice.sourceDocumentBoundary.sourceId !== "kqm" ||
    sourceLocalSlice.sourceDocumentBoundary.exactOccurrenceIds.length !== 4 ||
    !sourceLocalSlice.sourceDocumentBoundary
      .allClaimsAndTeamsShareExactSourceDocument ||
    report.sourceBoundary.status !== "accepted" ||
    report.sourceBoundary.sourceId !== "kqm" ||
    report.sourceBoundary.repositoryParity !== "exact" ||
    !report.sourceBoundary.selectedAndHoldoutsCloseAllKleeConditions ||
    report.sourceBoundary.selectedOccurrenceCount !== 4 ||
    report.sourceBoundary.holdoutOccurrenceCount !== 11 ||
    report.selectedOccurrences.length !== 4 ||
    report.holdoutOccurrences.length !== 11 ||
    report.summary.selectedOccurrenceCount !== 4 ||
    report.summary.selectedNotEnergyDeferredCount !== 4 ||
    report.summary.holdoutOccurrenceCount !== 11 ||
    report.summary.holdoutWithoutAuthoredEnergyClassificationCount !== 11 ||
    report.summary.assembledBuildCount !== 0 ||
    sourceLocalSlice.sourceClaimCatalog.length !== 4 ||
    sourceLocalSlice.conditionControls.length !== 4
  ) {
    addIssue(
      issues,
      "klee-source-local.partial-or-capability-crossing-evidence",
      "kleeSourceLocal.currentReport",
      "The Klee checkpoint lost its exact four-selected/eleven-holdout boundary or crossed a prohibited computation boundary.",
    );
    return [];
  }

  const actualSelectedIds = report.selectedOccurrences
    .map(({ occurrenceId }) => occurrenceId)
    .sort();
  if (
    stableJson(actualSelectedIds) !==
    stableJson([...KLEE_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCE_IDS].sort())
  ) {
    addIssue(
      issues,
      "klee-source-local.selected-occurrence-scope-drift",
      "kleeSourceLocal.currentReport.selectedOccurrences",
      "The Klee typed slice must remain limited to the four exact authenticated occurrences.",
    );
    return [];
  }
  const holdoutIds = report.holdoutOccurrences.map(
    ({ occurrenceId }) => occurrenceId,
  );
  if (
    new Set(holdoutIds).size !== 11 ||
    holdoutIds.some((occurrenceId) => actualSelectedIds.includes(occurrenceId)) ||
    report.holdoutOccurrences.some(
      (holdout) =>
        holdout.repositoryParity !== "exact" ||
        holdout.sliceDisposition !== "holdout" ||
        holdout.bindingAuthoredBySlice ||
        holdout.energyClassificationAuthoredBySlice,
    )
  ) {
    addIssue(
      issues,
      "klee-source-local.selected-holdout-partition-drift",
      "kleeSourceLocal.currentReport.holdoutOccurrences",
      "The exact selected and holdout occurrence sets must remain unique, disjoint, and limited to slice-authored dispositions.",
    );
    return [];
  }

  const claimById = exactSingleRowsById(
    sourceLocalSlice.sourceClaimCatalog,
    ({ claimId }) => claimId,
    "klee-source-local.duplicate-source-claim",
    "kleeSourceLocal.currentReport.sourceLocalSlice.sourceClaimCatalog",
    issues,
  );
  const controlById = exactSingleRowsById(
    sourceLocalSlice.conditionControls,
    ({ claimId }) => claimId,
    "klee-source-local.duplicate-condition-control",
    "kleeSourceLocal.currentReport.sourceLocalSlice.conditionControls",
    issues,
  );
  if (issues.length > 0) return [];

  const entries: CurrentConditionBindingCatalogEntry[] = [];
  for (const selected of report.selectedOccurrences) {
    const claim = claimById.get(selected.occurrenceId);
    const control = controlById.get(selected.occurrenceId);
    const conditionsSha256 = sha256Text(stableJson(selected.conditions));
    const predicateAstSha256 = sha256Text(stableJson(selected.predicate));
    const payloadSha256 = sha256Text(stableJson(selected.payload));
    const expectedOccurrenceId = buildCurrentConditionArrayOccurrenceId({
      sourceId: "kqm",
      recordKind: "character_guide",
      sourceRecordId: selected.sourceRecordId,
      manualClaimPath: selected.manualClaimPath,
    });
    if (
      selected.occurrenceId !== expectedOccurrenceId ||
      selected.conditions.length === 0 ||
      selected.conditionsSha256 !== conditionsSha256 ||
      selected.predicateSha256 !== predicateAstSha256 ||
      selected.payloadSha256 !== payloadSha256 ||
      selected.repositoryParity !== "exact" ||
      selected.sliceDisposition !== "selected" ||
      !selected.bindingAuthoredBySlice ||
      selected.sliceBindingClassification !== "typed-bound" ||
      !selected.energyClassificationAuthoredBySlice ||
      selected.sliceEnergyClassification !== "not-energy-deferred" ||
      claim == null ||
      claim.sourceId !== "kqm" ||
      claim.sourceRecordId !== selected.sourceRecordId ||
      claim.sourceConditionsSha256 !== selected.conditionsSha256 ||
      stableJson(claim.sourceConditions) !== stableJson(selected.conditions) ||
      stableJson(claim.predicate) !== stableJson(selected.predicate) ||
      control == null ||
      control.occurrenceControl.occurrenceId !== selected.occurrenceId ||
      control.occurrenceControl.sourceId !== "kqm" ||
      control.occurrenceControl.sourceRecordId !== selected.sourceRecordId ||
      control.occurrenceControl.manualClaimPath !== selected.manualClaimPath ||
      control.occurrenceControl.sourceConditionsSha256 !==
        selected.conditionsSha256 ||
      control.occurrenceControl.sourcePredicateSha256 !==
        selected.predicateSha256 ||
      control.occurrenceControl.payloadSha256 !== selected.payloadSha256 ||
      control.occurrenceControl.repositoryParity !== "exact" ||
      control.occurrenceControl.sliceDisposition !== "selected" ||
      control.occurrenceControl.energyClassification !== "not-energy-deferred"
    ) {
      addIssue(
        issues,
        "klee-source-local.conflicting-occurrence-evidence",
        `kleeSourceLocal.currentReport.selectedOccurrences.${selected.occurrenceId}`,
        "The selected occurrence, source claim, condition control, predicate, payload, and exact source identity do not agree.",
      );
      continue;
    }

    const selectedOccurrenceSha256 = sha256Text(stableJson(selected));
    entries.push(
      makeEntry({
        sourceId: "kqm",
        recordKind: "character_guide",
        sourceRecordId: selected.sourceRecordId,
        manualClaimPath: selected.manualClaimPath,
        subject: "klee",
        orderedConditions: selected.conditions,
        bindingClassification: "typed-bound",
        energyClassification: "not-energy-deferred",
        bindingEvidence: {
          kind: "source-local-typed-predicate-ast",
          sliceId: report.sliceId,
          selectedOccurrenceId: selected.occurrenceId,
          selectedOccurrenceSha256,
          predicateAst: structuredClone(selected.predicate),
          predicateAstSha256,
          payloadSha256,
          occurrenceControlSha256: sha256Text(stableJson(control)),
        },
        energyEvidence: {
          kind: "source-local-not-energy-deferred",
          structuralErEvidencePresent: false,
          energyRelatedWorkDeferred: false,
          sliceId: report.sliceId,
          selectedOccurrenceId: selected.occurrenceId,
          selectedOccurrenceSha256,
        },
      }),
    );
  }
  return entries;
}

function extractDionaSourceLocalEntries(
  report: DionaSourceLocalSupportSliceReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  const sourceLocalSlice = report.sourceLocalSlice;
  if (
    report.comparisonStatus !== "comparable" ||
    report.reportType !== "diona-source-local-support-slice" ||
    report.classification !==
      "authenticated-source-local-condition-binding-slice" ||
    report.sliceId !== DIONA_SOURCE_LOCAL_SLICE_ID ||
    report.issues.length !== 0 ||
    sourceLocalSlice == null ||
    sourceLocalSlice.comparisonStatus !== "comparable"
  ) {
    addIssue(
      issues,
      "diona-source-local.non-comparable",
      "dionaSourceLocal.currentReport",
      "The Diona source-local report is not the expected comparable authenticated slice.",
    );
    return [];
  }
  if (
    report.arbitraryEnglishParsingAllowed !== false ||
    report.supportsSourceAuthorization !== false ||
    report.supportsGuideClaims !== false ||
    report.supportsTeamRecommendations !== false ||
    report.supportsBuildRecommendations !== false ||
    report.supportsEquipmentRecommendations !== false ||
    report.supportsStatRecommendations !== false ||
    report.supportsRankClaims !== false ||
    report.supportsDamageClaims !== false ||
    report.supportsRotationClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.conditionTruthEstablishedFromRecommendationMetadata !== false ||
    report.recommendationCompositionExecuted !== false ||
    report.generatorExecuted !== false ||
    report.optimizerExecuted !== false ||
    report.artifactAssignmentExecuted !== false ||
    report.teamCompositionExecuted !== false ||
    report.buildCompositionExecuted !== false ||
    report.damageComputationExecuted !== false ||
    report.rotationComputationExecuted !== false ||
    report.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.supportsSourceAuthorization !== false ||
    sourceLocalSlice.supportsGuideClaims !== false ||
    sourceLocalSlice.supportsTeamRecommendations !== false ||
    sourceLocalSlice.supportsBuildRecommendations !== false ||
    sourceLocalSlice.supportsStatRecommendations !== false ||
    sourceLocalSlice.supportsRankClaims !== false ||
    sourceLocalSlice.supportsDamageClaims !== false ||
    sourceLocalSlice.supportsRotationClaims !== false ||
    sourceLocalSlice.supportsEnergyRecoveryClaims !== false ||
    sourceLocalSlice.playerFacingRecommendations !== false ||
    sourceLocalSlice.ranking !== false ||
    sourceLocalSlice.buildComposition !== false ||
    sourceLocalSlice.damage !== false ||
    sourceLocalSlice.formulas !== false ||
    sourceLocalSlice.rotations !== false ||
    sourceLocalSlice.ER !== false ||
    sourceLocalSlice.recommendationCompositionExecuted !== false ||
    sourceLocalSlice.generatorExecuted !== false ||
    sourceLocalSlice.optimizerExecuted !== false ||
    sourceLocalSlice.damageComputationExecuted !== false ||
    sourceLocalSlice.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.assembledBuildCount !== 0 ||
    sourceLocalSlice.issues.length !== 0 ||
    sourceLocalSlice.sliceId !== report.sliceId ||
    report.rawInputBoundary.status !== "accepted" ||
    !report.rawInputBoundary.exactPathSet ||
    !report.rawInputBoundary.byteAndParsedObjectClosure ||
    report.rawInputBoundary.sourceFileCount !== 4 ||
    sourceLocalSlice.sourceDocumentBoundary.status !== "accepted" ||
    sourceLocalSlice.sourceDocumentBoundary.sourceId !== "kqm" ||
    sourceLocalSlice.sourceDocumentBoundary.exactOccurrenceIds.length !== 3 ||
    sourceLocalSlice.sourceDocumentBoundary.exactTeamRecordIds.length !== 1 ||
    sourceLocalSlice.sourceDocumentBoundary.exactTeamRecordIds[0] !==
      DIONA_SOURCE_LOCAL_REPOSITORY_RECORD_ID ||
    !sourceLocalSlice.sourceDocumentBoundary
      .allClaimsAndTeamsShareExactSourceDocument ||
    report.sourceBoundary.status !== "accepted" ||
    report.sourceBoundary.sourceId !== "kqm" ||
    report.sourceBoundary.repositoryParity !== "exact" ||
    !report.sourceBoundary.selectedAndHoldoutsCloseAllNonemptyDionaConditions ||
    !report.sourceBoundary.samePageLineage ||
    !report.sourceBoundary.selectedClaimsAndTeamShareExactSourceRecord ||
    report.sourceBoundary.rawRecordCount !== 5 ||
    report.sourceBoundary.totalConditionArrayCount !== 26 ||
    report.sourceBoundary.nonemptyConditionArrayCount !== 18 ||
    report.sourceBoundary.emptyConditionArrayCount !== 8 ||
    report.sourceBoundary.selectedOccurrenceCount !== 3 ||
    report.sourceBoundary.holdoutOccurrenceCount !== 15 ||
    report.sourceBoundary.ordinaryHoldoutInventoryCount !== 10 ||
    report.sourceBoundary.erDeferredHoldoutInventoryCount !== 5 ||
    report.selectedOccurrences.length !== 3 ||
    report.holdoutOccurrences.length !== 15 ||
    report.summary.totalConditionArrayCount !== 26 ||
    report.summary.nonemptyConditionArrayCount !== 18 ||
    report.summary.emptyConditionArrayCount !== 8 ||
    report.summary.selectedOccurrenceCount !== 3 ||
    report.summary.selectedUniqueConditionArrayCount !== 3 ||
    report.summary.selectedNotEnergyDeferredCount !== 3 ||
    report.summary.holdoutOccurrenceCount !== 15 ||
    report.summary.ordinaryHoldoutInventoryCount !== 10 ||
    report.summary.erDeferredHoldoutInventoryCount !== 5 ||
    report.summary.holdoutConsumedCount !== 0 ||
    report.summary.holdoutBindingAuthoredCount !== 0 ||
    report.summary.holdoutEnergyClassificationAuthoredCount !== 0 ||
    report.summary.sourceTeamCount !== 1 ||
    report.summary.sourceCellCount !== 3 ||
    report.summary.sourceMatchedCount !== 0 ||
    report.summary.sourceInapplicableCount !== 0 ||
    report.summary.sourceUnresolvedCount !== 3 ||
    report.summary.contextApplicableCount !== 3 ||
    report.summary.sourceAlreadyMatchedCount !== 0 ||
    report.summary.sourceDefinitelyInapplicableCount !== 0 ||
    report.summary.effectiveMatchedCount !== 3 ||
    report.summary.effectiveInapplicableCount !== 0 ||
    report.summary.effectiveUnresolvedCount !== 0 ||
    report.summary.assembledBuildCount !== 0 ||
    sourceLocalSlice.summary.claimCount !== 3 ||
    sourceLocalSlice.summary.teamCount !== 1 ||
    sourceLocalSlice.summary.cellCount !== 3 ||
    sourceLocalSlice.summary.sourceMatchedCount !== 0 ||
    sourceLocalSlice.summary.sourceInapplicableCount !== 0 ||
    sourceLocalSlice.summary.sourceUnresolvedCount !== 3 ||
    sourceLocalSlice.summary.effectiveMatchedCount !== 3 ||
    sourceLocalSlice.summary.effectiveInapplicableCount !== 0 ||
    sourceLocalSlice.summary.effectiveUnresolvedCount !== 0 ||
    sourceLocalSlice.summary.deferredEnergyCount !== 0 ||
    sourceLocalSlice.sourceClaimCatalog.length !== 3 ||
    sourceLocalSlice.conditionControls.length !== 3
  ) {
    addIssue(
      issues,
      "diona-source-local.partial-or-capability-crossing-evidence",
      "dionaSourceLocal.currentReport",
      "The Diona checkpoint lost its exact three-selected/fifteen-holdout boundary or crossed a prohibited computation boundary.",
    );
    return [];
  }

  const actualSelectedIds = report.selectedOccurrences
    .map(({ occurrenceId }) => occurrenceId)
    .sort();
  const expectedSelectedIds = DIONA_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCES.map(
    ({ occurrenceId }) => occurrenceId,
  ).sort();
  if (
    stableJson(actualSelectedIds) !== stableJson(expectedSelectedIds) ||
    stableJson(
      [...sourceLocalSlice.sourceDocumentBoundary.exactOccurrenceIds].sort(),
    ) !== stableJson(expectedSelectedIds)
  ) {
    addIssue(
      issues,
      "diona-source-local.selected-occurrence-scope-drift",
      "dionaSourceLocal.currentReport.selectedOccurrences",
      "The Diona typed slice must remain limited to the three exact same-record team-member occurrences.",
    );
    return [];
  }
  const holdoutIds = report.holdoutOccurrences.map(
    ({ occurrenceId }) => occurrenceId,
  );
  if (
    new Set(holdoutIds).size !== 15 ||
    holdoutIds.some((occurrenceId) => actualSelectedIds.includes(occurrenceId)) ||
    report.holdoutOccurrences.filter(
      ({ descriptiveInventory }) => descriptiveInventory === "ordinary-holdout",
    ).length !== 10 ||
    report.holdoutOccurrences.filter(
      ({ descriptiveInventory }) => descriptiveInventory === "er-deferred-holdout",
    ).length !== 5 ||
    report.holdoutOccurrences.some(
      (holdout) =>
        holdout.conditions.length === 0 ||
        holdout.conditionsSha256 !== sha256Text(stableJson(holdout.conditions)) ||
        holdout.repositoryParity !== "exact" ||
        holdout.sliceDisposition !== "holdout" ||
        holdout.consumedBySlice ||
        holdout.bindingAuthoredBySlice ||
        holdout.energyClassificationAuthoredBySlice,
    )
  ) {
    addIssue(
      issues,
      "diona-source-local.selected-holdout-partition-drift",
      "dionaSourceLocal.currentReport.holdoutOccurrences",
      "The exact selected and holdout occurrence sets must remain unique, disjoint, and limited to slice-authored dispositions.",
    );
    return [];
  }

  const claimById = exactSingleRowsById(
    sourceLocalSlice.sourceClaimCatalog,
    ({ claimId }) => claimId,
    "diona-source-local.duplicate-source-claim",
    "dionaSourceLocal.currentReport.sourceLocalSlice.sourceClaimCatalog",
    issues,
  );
  const controlById = exactSingleRowsById(
    sourceLocalSlice.conditionControls,
    ({ claimId }) => claimId,
    "diona-source-local.duplicate-condition-control",
    "dionaSourceLocal.currentReport.sourceLocalSlice.conditionControls",
    issues,
  );
  if (issues.length > 0) return [];

  const entries: CurrentConditionBindingCatalogEntry[] = [];
  for (const selected of report.selectedOccurrences) {
    const expected = DIONA_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCES.find(
      ({ occurrenceId }) => occurrenceId === selected.occurrenceId,
    );
    const claim = claimById.get(selected.occurrenceId);
    const control = controlById.get(selected.occurrenceId);
    const conditionsSha256 = sha256Text(stableJson(selected.conditions));
    const predicateAstSha256 = sha256Text(stableJson(selected.predicate));
    const payloadSha256 = sha256Text(stableJson(selected.payload));
    const expectedOccurrenceId = buildCurrentConditionArrayOccurrenceId({
      sourceId: "kqm",
      recordKind: "team",
      sourceRecordId: selected.sourceRecordId,
      manualClaimPath: selected.manualClaimPath,
    });
    if (
      expected == null ||
      selected.occurrenceId !== expectedOccurrenceId ||
      selected.characterId !== expected.characterId ||
      selected.memberIndex !== expected.memberIndex ||
      selected.sourceRecordId !== DIONA_SOURCE_LOCAL_SOURCE_RECORD_ID ||
      selected.repositoryRecordId !== DIONA_SOURCE_LOCAL_REPOSITORY_RECORD_ID ||
      selected.manualClaimPath !==
        `members[${expected.memberIndex}].artifactRecommendations[0].conditions` ||
      selected.repositoryPath !== selected.manualClaimPath ||
      selected.claimAxis !== "artifact-recommendation" ||
      selected.conditions.length === 0 ||
      selected.conditionsSha256 !== conditionsSha256 ||
      selected.predicateSha256 !== predicateAstSha256 ||
      selected.payloadSha256 !== payloadSha256 ||
      selected.repositoryParity !== "exact" ||
      selected.sliceDisposition !== "selected" ||
      !selected.bindingAuthoredBySlice ||
      selected.sliceBindingClassification !== "typed-bound" ||
      !selected.energyClassificationAuthoredBySlice ||
      selected.sliceEnergyClassification !== "not-energy-deferred" ||
      claim == null ||
      claim.claimId !== selected.occurrenceId ||
      claim.sourceId !== "kqm" ||
      claim.sourceRecordId !== selected.sourceRecordId ||
      claim.repositoryRecordId !== selected.repositoryRecordId ||
      claim.characterId !== selected.characterId ||
      claim.sourceConditionsSha256 !== selected.conditionsSha256 ||
      stableJson(claim.sourceConditions) !== stableJson(selected.conditions) ||
      stableJson(claim.predicate) !== stableJson(selected.predicate) ||
      stableJson(claim.payload) !== stableJson(selected.payload) ||
      control == null ||
      control.claimId !== selected.occurrenceId ||
      control.occurrenceControl.occurrenceId !== selected.occurrenceId ||
      control.occurrenceControl.sourceId !== "kqm" ||
      control.occurrenceControl.sourceRecordId !== selected.sourceRecordId ||
      control.occurrenceControl.repositoryRecordId !==
        selected.repositoryRecordId ||
      control.occurrenceControl.manualClaimPath !== selected.manualClaimPath ||
      control.occurrenceControl.sourceConditionsSha256 !==
        selected.conditionsSha256 ||
      control.occurrenceControl.sourcePredicateSha256 !==
        selected.predicateSha256 ||
      control.occurrenceControl.payloadSha256 !== selected.payloadSha256 ||
      control.occurrenceControl.repositoryParity !== "exact" ||
      control.occurrenceControl.sliceDisposition !== "selected" ||
      control.occurrenceControl.energyClassification !== "not-energy-deferred"
    ) {
      addIssue(
        issues,
        "diona-source-local.conflicting-occurrence-evidence",
        `dionaSourceLocal.currentReport.selectedOccurrences.${selected.occurrenceId}`,
        "The selected occurrence, character/member identity, source claim, condition control, predicate, payload, and exact source identity do not agree.",
      );
      continue;
    }

    const selectedOccurrenceSha256 = sha256Text(stableJson(selected));
    entries.push(
      makeEntry({
        sourceId: "kqm",
        recordKind: "team",
        sourceRecordId: selected.sourceRecordId,
        manualClaimPath: selected.manualClaimPath,
        subject: selected.characterId,
        orderedConditions: selected.conditions,
        bindingClassification: "typed-bound",
        energyClassification: "not-energy-deferred",
        bindingEvidence: {
          kind: "source-local-typed-predicate-ast",
          sliceId: report.sliceId,
          selectedOccurrenceId: selected.occurrenceId,
          selectedOccurrenceSha256,
          predicateAst: structuredClone(selected.predicate),
          predicateAstSha256,
          payloadSha256,
          occurrenceControlSha256: sha256Text(stableJson(control)),
        },
        energyEvidence: {
          kind: "source-local-not-energy-deferred",
          structuralErEvidencePresent: false,
          energyRelatedWorkDeferred: false,
          sliceId: report.sliceId,
          selectedOccurrenceId: selected.occurrenceId,
          selectedOccurrenceSha256,
        },
      }),
    );
  }
  return entries;
}

function exactSingleRowsById<T>(
  rows: readonly T[],
  id: (row: T) => string,
  duplicateCode: string,
  path: string,
  issues: CurrentConditionBindingCatalogIssue[],
): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const rowId = id(row);
    if (result.has(rowId)) {
      addIssue(
        issues,
        duplicateCode,
        `${path}.${rowId}`,
        `Expected one authenticated row for ${rowId}.`,
      );
    } else {
      result.set(rowId, row);
    }
  }
  return result;
}

function makeEntry(input: {
  sourceId: string;
  recordKind: "character_guide" | "character_role" | "team";
  sourceRecordId: string;
  manualClaimPath: string;
  subject: string;
  orderedConditions: readonly string[];
  bindingClassification: CurrentConditionBindingClassification;
  energyClassification: CurrentConditionEnergyClassification;
  bindingEvidence: CurrentConditionBindingEvidence;
  energyEvidence: CurrentConditionEnergyEvidence | null;
}): CurrentConditionBindingCatalogEntry {
  if (input.subject.length === 0) {
    throw new Error("Condition binding subject must be a non-empty string.");
  }
  const orderedConditions = [...input.orderedConditions];
  const conditionsSha256 = sha256Text(stableJson(orderedConditions));
  const identity = {
    sourceId: input.sourceId,
    recordKind: input.recordKind,
    sourceRecordId: input.sourceRecordId,
    manualClaimPath: input.manualClaimPath,
    conditionsSha256,
  };
  return {
    ...identity,
    occurrenceId: buildCurrentConditionArrayOccurrenceId(identity),
    occurrenceKey: buildCurrentConditionArrayOccurrenceKey(identity),
    subject: input.subject,
    orderedConditions,
    bindingClassification: input.bindingClassification,
    energyClassification: input.energyClassification,
    typedBinding: input.bindingClassification === "typed-bound",
    bindingEvidence: input.bindingEvidence,
    energyEvidence: input.energyEvidence,
  };
}

function notEnergyDeferredEvidence(): CurrentConditionEnergyEvidence {
  return {
    kind: "not-energy-deferred",
    structuralErEvidencePresent: false,
    energyRelatedWorkDeferred: false,
  };
}

function deferredEnergyReasons(
  predicate: SourceConditionPredicateAst,
): string[] {
  if (predicate.type === "deferred-energy-prerequisite") {
    return [predicate.reason];
  }
  if (predicate.type !== "all") return [];
  return predicate.predicates.flatMap(deferredEnergyReasons);
}

function validateCombinedEntries(
  entries: readonly CurrentConditionBindingCatalogEntry[],
  issues: CurrentConditionBindingCatalogIssue[],
): void {
  const keyCounts = new Map<string, number>();
  const locatorHashes = new Map<string, Set<string>>();
  for (const entry of entries) {
    keyCounts.set(
      entry.occurrenceKey,
      (keyCounts.get(entry.occurrenceKey) ?? 0) + 1,
    );
    const expectedKey = buildCurrentConditionArrayOccurrenceKey(entry);
    if (entry.occurrenceKey !== expectedKey) {
      addIssue(
        issues,
        "catalog.occurrence-key-mismatch",
        entry.occurrenceKey,
        "The stored occurrence key differs from the canonical composite key.",
      );
    }
    const locatorKey = stableJson({
      sourceId: entry.sourceId,
      recordKind: entry.recordKind,
      sourceRecordId: entry.sourceRecordId,
      manualClaimPath: entry.manualClaimPath,
    });
    const hashes = locatorHashes.get(locatorKey) ?? new Set<string>();
    hashes.add(entry.conditionsSha256);
    locatorHashes.set(locatorKey, hashes);
  }
  for (const [key, count] of keyCounts) {
    if (count !== 1) {
      addIssue(
        issues,
        "catalog.duplicate-occurrence-key",
        key,
        `Expected one binding per exact occurrence key, found ${count}.`,
      );
    }
  }
  for (const [locatorKey, hashes] of locatorHashes) {
    if (hashes.size !== 1) {
      addIssue(
        issues,
        "catalog.conflicting-locator-hashes",
        sha256Text(locatorKey),
        "One source/schema locator maps to conflicting ordered condition arrays.",
      );
    }
  }
  if (entries.length !== 56) {
    addIssue(
      issues,
      "catalog.occurrence-count-drift",
      "entries",
      `Expected 56 authenticated current bindings, found ${entries.length}.`,
    );
  }
}

function summarize(
  entries: readonly CurrentConditionBindingCatalogEntry[],
): CurrentConditionBindingCatalogReport["summary"] {
  const ittoEntries = entries.filter(
    ({ bindingEvidence }) => bindingEvidence.kind === "itto-typed-predicate-ast",
  );
  const keqingEquipmentEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "keqing-equipment-typed-predicate-ids",
  );
  const vvEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "keqing-role-exact-text-acknowledgement",
  );
  const kleeEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "source-local-typed-predicate-ast" &&
      bindingEvidence.sliceId === KLEE_SOURCE_LOCAL_SLICE_ID,
  );
  const dionaEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "source-local-typed-predicate-ast" &&
      bindingEvidence.sliceId === DIONA_SOURCE_LOCAL_SLICE_ID,
  );
  return {
    occurrenceCount: entries.length,
    bindingClassificationCounts: countBy(
      entries,
      "bindingClassification",
      ["typed-bound", "exact-text-acknowledged", "unbound", "invalid"],
    ),
    energyClassificationCounts: countBy(entries, "energyClassification", [
      "energy-unclassified",
      "not-energy-deferred",
      "structural-er",
      "deferred-energy-prerequisite",
      "exact-authored-energy-related-deferral",
    ]),
    typedBindingCount: entries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    ittoOccurrenceCount: ittoEntries.length,
    ittoTypedBindingCount: ittoEntries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    ittoDeferredEnergyPrerequisiteCount: ittoEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "deferred-energy-prerequisite",
    ).length,
    keqingEquipmentOccurrenceCount: keqingEquipmentEntries.length,
    keqingEquipmentAtomicClaimCount: keqingEquipmentEntries.reduce(
      (count, { bindingEvidence }) =>
        count +
        (bindingEvidence.kind === "keqing-equipment-typed-predicate-ids"
          ? bindingEvidence.atomicClaimIds.length
          : 0),
      0,
    ),
    keqingVvAcknowledgedOccurrenceCount: vvEntries.length,
    keqingVvExactTextAcknowledgementCount: vvEntries.reduce(
      (count, { bindingEvidence }) =>
        count +
        (bindingEvidence.kind === "keqing-role-exact-text-acknowledgement"
          ? bindingEvidence.acknowledgementCount
          : 0),
      0,
    ),
    keqingVvUnacknowledgedSourceMemberIds: [
      ...KEQING_VV_UNACKNOWLEDGED_SOURCE_MEMBERS,
    ],
    kleeSourceLocalOccurrenceCount: kleeEntries.length,
    kleeSourceLocalTypedBindingCount: kleeEntries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    kleeSourceLocalNotEnergyDeferredCount: kleeEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "not-energy-deferred",
    ).length,
    dionaSourceLocalOccurrenceCount: dionaEntries.length,
    dionaSourceLocalTypedBindingCount: dionaEntries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    dionaSourceLocalNotEnergyDeferredCount: dionaEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "not-energy-deferred",
    ).length,
  };
}

function countBy<
  T extends CurrentConditionBindingCatalogEntry,
  K extends
    | "bindingClassification"
    | "energyClassification",
>(
  entries: readonly T[],
  property: K,
  values: readonly T[K][],
): Record<T[K] & string, number> {
  return Object.fromEntries(
    values.map((value) => [
      value,
      entries.filter((entry) => entry[property] === value).length,
    ]),
  ) as Record<T[K] & string, number>;
}

function baseReport(
  authenticationBoundary: CurrentConditionBindingCatalogReport["authenticationBoundary"],
): Omit<
  CurrentConditionBindingCatalogReport,
  "comparisonStatus" | "entries" | "summary" | "issues"
> {
  return {
    schemaVersion: 1,
    reportType: "authenticated-current-condition-binding-catalog",
    publicationStatus: "internal-validation-only",
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsEnergyRecoveryClaims: false,
    energyRecoveryComputationExecuted: false,
    authenticationBoundary,
  };
}

function failedReport(
  authenticationBoundary: CurrentConditionBindingCatalogReport["authenticationBoundary"],
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogReport {
  return {
    ...baseReport(authenticationBoundary),
    comparisonStatus: "not-comparable",
    entries: [],
    summary: summarize([]),
    issues: issues
      .map((issue) => ({ ...issue }))
      .sort(
        (left, right) =>
          left.path.localeCompare(right.path) ||
          left.code.localeCompare(right.code),
      ),
  };
}

function addIssue(
  issues: CurrentConditionBindingCatalogIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}
