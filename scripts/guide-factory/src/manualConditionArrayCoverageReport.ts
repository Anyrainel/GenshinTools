import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GameCatalogs } from "./catalogs";
import {
  buildCurrentConditionBindingCatalog,
  type CurrentConditionBindingCatalogEntry,
  type CurrentConditionBindingCatalogReport,
  type CurrentConditionBindingClassification,
  type CurrentConditionBindingEvidence,
  type CurrentConditionEnergyClassification,
  type CurrentConditionEnergyEvidence,
} from "./currentConditionBindingCatalog";
import {
  authenticateDionaSourceLocalSupportSliceReport,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS,
  type DionaSourceLocalSupportSliceReport,
} from "./dionaSourceLocalSupportSlice";
import {
  buildExactAuthoredEnergyDeferralCatalog,
  requireExactAuthoredEnergyDeferralMatches,
  type ExactAuthoredEnergyDeferralEntry,
} from "./exactAuthoredEnergyDeferralCatalog";
import { sha256Text, stableJson } from "./io";
import {
  authenticateIttoSourceConditionedGuidePacketReport,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
} from "./ittoSourceConditionedGuidePacket";
import {
  buildKeqingLunarEquipmentEvidenceValidationReport,
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS,
  type KeqingLunarEquipmentEvidenceValidationReport,
} from "./keqingLunarEquipmentEvidenceValidation";
import {
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS,
  runKeqingSourceScopedRolePairSample,
  type KeqingSourceScopedRolePairSampleReport,
} from "./keqingSourceScopedRolePairSample";
import {
  authenticateKleeSourceLocalConditionSliceReport,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
  type KleeSourceLocalConditionSliceReport,
} from "./kleeSourceLocalConditionSlice";
import {
  buildManualConditionArrayCoverageCore,
  type ManualConditionArrayOccurrence,
  type ManualConditionClaimAxis,
} from "./manualConditionArrayCoverage";
import {
  requiredManualSnapshotInputContaining,
  type ManualSnapshotInput,
} from "./manualSnapshots";
import {
  KnowledgeRepositorySchema,
  type KnowledgeRepository,
} from "./schemas";
import type {
  GeneratedFromEntry,
  SourceConditionedGuidePacketReport,
} from "./sourceConditionedGuidePacket";

export type ManualConditionCoverageDisplayStatus =
  | "invalid"
  | "unconditional"
  | "er-deferred"
  | "typed-bound"
  | "exact-text-acknowledged"
  | "known-but-unbound";

export interface ManualConditionCoverageSourceFile {
  path: string;
  text: string;
}

export interface BuildManualConditionArrayCoverageReportInput {
  repositoryInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  manualInputs: readonly ManualSnapshotInput[];
  catalogs: GameCatalogs;
  checkedInRosterDomainReportInput: unknown;
  ittoDurableReportInput: unknown;
  keqingEquipmentDurableReportInput: unknown;
  keqingRolePairDurableReportInput: unknown;
  sourceFiles: readonly ManualConditionCoverageSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface ManualConditionCoverageIssue {
  code: string;
  path: string;
  message: string;
}

export interface ManualConditionCoverageOccurrence
  extends ManualConditionArrayOccurrence {
  repositoryJsonPath: string;
  repositoryParity: "exact";
  bindingClassification: CurrentConditionBindingClassification;
  energyClassification: CurrentConditionEnergyClassification;
  displayStatus: ManualConditionCoverageDisplayStatus;
  bindingCoverageEligible: boolean;
  nonStructuralBindingCoverageEligible: boolean;
  bindingOccurrenceKey: string | null;
  bindingEvidence: CurrentConditionBindingEvidence | null;
  energyEvidence: CurrentConditionEnergyEvidence | null;
  issues: [];
}

interface ArrayStatistics {
  occurrenceCount: number;
  emptyCount: number;
  nonemptyCount: number;
  uniqueExactArrayCount: number;
  stringOccurrenceCount: number;
  uniqueStringCount: number;
}

interface CoverageGroupSummary extends ArrayStatistics {
  groupId: string;
  bindingCoverageConditionCount: number;
  nonStructuralBindingCoverageConditionCount: number;
  typedBoundCount: number;
  exactTextAcknowledgedCount: number;
  knownButUnboundCount: number;
  erDeferredCount: number;
  unconditionalCount: number;
}

interface BindingCoverageStatistics extends ArrayStatistics {
  typedBoundOccurrenceCount: number;
  exactTextAcknowledgedOccurrenceCount: number;
  unboundOccurrenceCount: number;
  invalidOccurrenceCount: number;
  typedBoundStringOccurrenceCount: number;
  exactTextAcknowledgedStringOccurrenceCount: number;
  unboundStringOccurrenceCount: number;
  invalidStringOccurrenceCount: number;
}

interface EnergyCoverageSummary {
  structuralEr: ArrayStatistics;
  deferredEnergyPrerequisite: ArrayStatistics;
  exactAuthoredEnergyRelatedDeferral: ArrayStatistics;
  notEnergyDeferred: ArrayStatistics;
  energyUnclassified: ArrayStatistics;
  unconditional: ArrayStatistics;
  deferredDisplay: ArrayStatistics;
}

interface ManualConditionCoverageSummary {
  total: ArrayStatistics;
  bindingCoverage: BindingCoverageStatistics;
  nonStructuralBindingCoverage: BindingCoverageStatistics;
  energyCoverage: EnergyCoverageSummary;
  displayStatusCounts: Record<ManualConditionCoverageDisplayStatus, number>;
  nonStructuralUniqueBindingArrayCoverage: {
    uniqueExactArrayCount: number;
    typedOnlyCount: number;
    unboundOnlyCount: number;
    mixedAcknowledgedAndUnboundCount: number;
    otherMixedCount: number;
  };
  bySource: CoverageGroupSummary[];
  byRecordKind: CoverageGroupSummary[];
  bySubject: CoverageGroupSummary[];
}

export interface ManualConditionArrayCoverageReport {
  schemaVersion: 1;
  reportType: "manual-condition-array-coverage-report";
  classification: "descriptive-exact-condition-binding-coverage";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-source-coverage";
  arbitraryEnglishParsingAllowed: false;
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsEnergyRecoveryClaims: false;
  conditionTruthEstablished: false;
  recommendationCompositionExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  damageComputationExecuted: false;
  energyRecoveryComputationExecuted: false;
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted" | "rejected";
    exactPathSet: boolean;
    rawJsonObjectClosure: boolean;
    sourceFileCount: number;
  };
  corpusBoundary: {
    authoritativeSource: "indexed-manual-observation-snapshots";
    consolidatedRepositoryCountedAsSecondCorpus: false;
    snapshotCount: number;
    manualRecordCount: number;
    occurrenceCount: number;
    repositoryParityStatus: "exact" | "mismatch" | "not-evaluated";
    repositoryExactMatchCount: number;
    repositoryMismatchCount: number;
    extractionMethodCounts: Record<string, number>;
    reviewStatusCounts: Record<string, number>;
    allCurrentRecordsAgentAssistedUnreviewed: boolean;
  };
  bindingBoundary: {
    status: "authenticated" | "rejected";
    catalogReportSha256: string | null;
    occurrenceCount: number;
    ittoAuthenticated: boolean;
    keqingEquipmentDurableMatchesCurrent: boolean;
    keqingRolePairDurableMatchesCurrent: boolean;
    kleeSourceLocalDurableMatchesCurrent: boolean;
    dionaSourceLocalDurableMatchesCurrent: boolean;
    keqingEquipmentAtomicClaimCount: number;
    kleeSourceLocalOccurrenceCount: number;
    dionaSourceLocalOccurrenceCount: number;
    exactTextAcknowledgementOccurrenceCount: number;
    typedBindingMeansConditionTruth: false;
  };
  occurrences: ManualConditionCoverageOccurrence[];
  nonStructuralUniqueBindingStatusSets: Array<{
    conditionsSha256: string;
    conditions: string[];
    occurrenceCount: number;
    bindingClassifications: CurrentConditionBindingClassification[];
    occurrenceIds: string[];
  }>;
  summary: ManualConditionCoverageSummary;
  issues: ManualConditionCoverageIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
}

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const ROSTER_REPORT_PATH =
  "scripts/guide-factory/reports/team-roster-candidate-domain-experiment.json";
const ITTO_REPORT_PATH =
  "scripts/guide-factory/reports/itto-source-conditioned-guide-packets.json";
const KEQING_EQUIPMENT_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json";
const KEQING_ROLE_PAIR_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-source-scoped-role-pair-sample.json";
const KLEE_SOURCE_LOCAL_REPORT_PATH =
  "scripts/guide-factory/reports/klee-source-local-condition-slice.json";
const DIONA_SOURCE_LOCAL_REPORT_PATH =
  "scripts/guide-factory/reports/diona-source-local-support-slice.json";

export const MANUAL_CONDITION_COVERAGE_SNAPSHOT_PATHS = [
  "scripts/guide-factory/data/source-snapshots/kqm-diona-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-furina-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-itto-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-klee-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-kokomi-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json",
] as const;

export const MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS = [
  REPOSITORY_PATH,
  MANUAL_INDEX_PATH,
  SOURCE_REGISTRY_PATH,
  ...MANUAL_CONDITION_COVERAGE_SNAPSHOT_PATHS,
  ROSTER_REPORT_PATH,
  ITTO_REPORT_PATH,
  KEQING_EQUIPMENT_REPORT_PATH,
  KEQING_ROLE_PAIR_REPORT_PATH,
  KLEE_SOURCE_LOCAL_REPORT_PATH,
  DIONA_SOURCE_LOCAL_REPORT_PATH,
] as const;

export const MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS = [
  ...new Set([
    "scripts/guide-factory/src/manualConditionArrayCoverage.ts",
    "scripts/guide-factory/src/currentConditionBindingCatalog.ts",
    "scripts/guide-factory/src/exactAuthoredEnergyDeferralCatalog.ts",
    "scripts/guide-factory/src/manualConditionArrayCoverageReport.ts",
    "scripts/guide-factory/src/inventory-manual-condition-array-coverage.ts",
    "scripts/guide-factory/src/manualSnapshots.ts",
    "scripts/guide-factory/src/schemas.ts",
    "scripts/guide-factory/src/io.ts",
    "scripts/guide-factory/src/paths.ts",
    ...MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS,
    ...ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
    ...KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS,
    ...KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS,
    ...KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
    ...DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS,
  ]),
].sort(compareText);

export const MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "reports",
  "manual-condition-array-coverage.json",
);

const CAPABILITY_BOUNDARY = {
  arbitraryEnglishParsingAllowed: false,
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsEquipmentRecommendations: false,
  supportsStatRecommendations: false,
  supportsRankClaims: false,
  supportsDamageClaims: false,
  supportsEnergyRecoveryClaims: false,
  conditionTruthEstablished: false,
  recommendationCompositionExecuted: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  damageComputationExecuted: false,
  energyRecoveryComputationExecuted: false,
} as const;

const CAUTIONS = [
  "Typed-bound means exact source prose is mapped to a machine-readable predicate; it does not mean the predicate is true for a team or account.",
  "Exact-text acknowledgement records a configured source binding without validating aura setup, timing, or gameplay execution.",
  "All current manual records remain agent-assisted and unreviewed; coverage is not source authority or guide credibility.",
  "Binding coverage and energy classification are independent; structural ER rows are shown separately from the non-structural binding boundary.",
  "Exact authored energy deferrals are pinned to occurrence identity and ordered-condition hash; no arbitrary source prose is classified.",
  "Energy-unclassified means no authenticated energy classification is available; it does not mean a condition is unrelated to energy.",
];

const PROHIBITED_INTERPRETATIONS = [
  "Do not interpret condition-binding coverage as recommendation accuracy, source quality, popularity, or confidence.",
  "Do not infer a team, weapon, artifact, main stat, substat priority, rank, or winner from this report.",
  "Do not treat an unbound condition as false or an acknowledged condition as satisfied.",
  "Do not treat energy-unclassified as non-ER or as safe input to a non-ER computation.",
  "Do not use this report as an ER requirement, rotation, damage, generator, optimizer, or guide output.",
];

const EXPECTED_CURRENT_OCCURRENCES_SHA256 =
  "c70b0f0b0927cd98fc380820702c387d14e19113820a001f4f7f0354e2cd236c";
const EXPECTED_CURRENT_BINDING_CATALOG_SHA256 =
  "6ec04c872d8433940da97135a3e69eef2f66af046ef38ff577c634da4a3da544";

export async function buildManualConditionArrayCoverageReport(
  input: BuildManualConditionArrayCoverageReportInput,
): Promise<ManualConditionArrayCoverageReport> {
  let generatedFrom: GeneratedFromEntry[] = [];
  try {
    generatedFrom = validateGeneratedFrom(input.generatedFrom);
    authenticateRawInputs(input, generatedFrom);
    const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
    const core = buildManualConditionArrayCoverageCore({
      manualIndexInput: input.manualIndexInput,
      manualSnapshotInputs: input.manualInputs.map((manualInput) => ({
        path: manualInput.snapshotFile.path,
        snapshotInput: manualInput.snapshot,
      })),
      repositoryInput: repository,
    });
    if (core.repositoryParity.status !== "exact") {
      throw new Error(
        `Manual/repository condition parity has ${core.repositoryParity.mismatchCount} mismatch(es).`,
      );
    }

    const bindingCatalog = await buildAuthenticatedBindingCatalog(
      input,
      repository,
      generatedFrom,
    );
    if (bindingCatalog.comparisonStatus !== "comparable") {
      throw new Error(
        `Current condition-binding catalog is not comparable: ${bindingCatalog.issues
          .map(({ code }) => code)
          .join(", ")}.`,
      );
    }
    const occurrences = mergeOccurrences(
      core.extraction.occurrences,
      core.repositoryParity.rows,
      bindingCatalog.entries,
      buildExactAuthoredEnergyDeferralCatalog(),
    );
    validateExpectedCurrentCoverageBoundary(occurrences);
    validateExpectedCurrentBindingCatalogBoundary(bindingCatalog);
    const nonStructuralUniqueBindingStatusSets =
      buildNonStructuralUniqueBindingStatusSets(occurrences);
    const extractionMethodCounts = countValues(
      occurrences.map(({ extraction }) => extraction.method),
    );
    const reviewStatusCounts = countValues(
      occurrences.map(({ extraction }) => extraction.reviewStatus),
    );
    return {
      schemaVersion: 1,
      reportType: "manual-condition-array-coverage-report",
      classification: "descriptive-exact-condition-binding-coverage",
      comparisonStatus: "comparable",
      publicationStatus: "withheld-unreviewed-source-coverage",
      ...CAPABILITY_BOUNDARY,
      generatedFrom,
      rawInputBoundary: {
        status: "accepted",
        exactPathSet: true,
        rawJsonObjectClosure: true,
        sourceFileCount: input.sourceFiles.length,
      },
      corpusBoundary: {
        authoritativeSource: "indexed-manual-observation-snapshots",
        consolidatedRepositoryCountedAsSecondCorpus: false,
        snapshotCount: core.extraction.summary.snapshotCount,
        manualRecordCount: core.extraction.summary.manualRecordCount,
        occurrenceCount: occurrences.length,
        repositoryParityStatus: core.repositoryParity.status,
        repositoryExactMatchCount: core.repositoryParity.exactMatchCount,
        repositoryMismatchCount: core.repositoryParity.mismatchCount,
        extractionMethodCounts,
        reviewStatusCounts,
        allCurrentRecordsAgentAssistedUnreviewed:
          Object.keys(extractionMethodCounts).length === 1 &&
          extractionMethodCounts["agent-assisted"] === occurrences.length &&
          Object.keys(reviewStatusCounts).length === 1 &&
          reviewStatusCounts.unreviewed === occurrences.length,
      },
      bindingBoundary: bindingBoundary(bindingCatalog),
      occurrences,
      nonStructuralUniqueBindingStatusSets,
      summary: summarizeCoverage(
        occurrences,
        nonStructuralUniqueBindingStatusSets,
      ),
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

export function requireComparableManualConditionArrayCoverageReport(
  report: ManualConditionArrayCoverageReport,
  expectedGeneratedFrom: readonly GeneratedFromEntry[],
): void {
  let boundaryFailure: string | null = null;
  try {
    authenticateComparableCurrentReportBoundary(
      report,
      expectedGeneratedFrom,
    );
  } catch (error) {
    boundaryFailure = error instanceof Error ? error.message : String(error);
  }
  const safe =
    boundaryFailure == null &&
    report.comparisonStatus === "comparable" &&
    report.issues.length === 0 &&
    report.rawInputBoundary.status === "accepted" &&
    report.corpusBoundary.repositoryParityStatus === "exact" &&
    report.bindingBoundary.status === "authenticated" &&
    report.summary.nonStructuralBindingCoverage.occurrenceCount === 123 &&
    report.summary.nonStructuralBindingCoverage.typedBoundOccurrenceCount ===
      53 &&
    report.summary.nonStructuralBindingCoverage
      .exactTextAcknowledgedOccurrenceCount === 3 &&
    report.summary.nonStructuralBindingCoverage.unboundOccurrenceCount === 67 &&
    !report.arbitraryEnglishParsingAllowed &&
    !report.supportsSourceAuthorization &&
    !report.supportsGuideClaims &&
    !report.supportsTeamRecommendations &&
    !report.supportsEquipmentRecommendations &&
    !report.supportsStatRecommendations &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsEnergyRecoveryClaims &&
    !report.conditionTruthEstablished &&
    !report.recommendationCompositionExecuted &&
    !report.generatorExecuted &&
    !report.optimizerExecuted &&
    !report.damageComputationExecuted &&
    !report.energyRecoveryComputationExecuted;
  if (safe) return;
  throw new Error(
    `Refusing to write a non-comparable or capability-crossing manual condition coverage report${
      report.issues.length > 0
        ? `: ${report.issues.map(({ code, message }) => `${code}: ${message}`).join("; ")}`
        : boundaryFailure == null
          ? "."
          : `: ${boundaryFailure}`
    }`,
  );
}

function authenticateComparableCurrentReportBoundary(
  report: ManualConditionArrayCoverageReport,
  expectedGeneratedFrom: readonly GeneratedFromEntry[],
): void {
  const generatedFrom = validateGeneratedFrom(report.generatedFrom);
  const expected = validateGeneratedFrom(expectedGeneratedFrom);
  if (stableJson(generatedFrom) !== stableJson(report.generatedFrom)) {
    throw new Error("generatedFrom is not in canonical exact-path order.");
  }
  if (stableJson(generatedFrom) !== stableJson(expected)) {
    throw new Error(
      "generatedFrom does not match the independently computed current path/hash boundary.",
    );
  }
  if (
    report.schemaVersion !== 1 ||
    report.reportType !== "manual-condition-array-coverage-report" ||
    report.classification !==
      "descriptive-exact-condition-binding-coverage" ||
    report.publicationStatus !== "withheld-unreviewed-source-coverage"
  ) {
    throw new Error("Report identity or publication boundary drifted.");
  }

  const expectedRawBoundary: ManualConditionArrayCoverageReport["rawInputBoundary"] =
    {
      status: "accepted",
      exactPathSet: true,
      rawJsonObjectClosure: true,
      sourceFileCount:
        MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS.length,
    };
  if (
    stableJson(report.rawInputBoundary) !== stableJson(expectedRawBoundary)
  ) {
    throw new Error("Raw exact-path/object authentication boundary drifted.");
  }

  const expectedCorpusBoundary: ManualConditionArrayCoverageReport["corpusBoundary"] =
    {
      authoritativeSource: "indexed-manual-observation-snapshots",
      consolidatedRepositoryCountedAsSecondCorpus: false,
      snapshotCount: 7,
      manualRecordCount: 64,
      occurrenceCount: 142,
      repositoryParityStatus: "exact",
      repositoryExactMatchCount: 142,
      repositoryMismatchCount: 0,
      extractionMethodCounts: { "agent-assisted": 142 },
      reviewStatusCounts: { unreviewed: 142 },
      allCurrentRecordsAgentAssistedUnreviewed: true,
    };
  if (
    stableJson(report.corpusBoundary) !== stableJson(expectedCorpusBoundary)
  ) {
    throw new Error("Pinned manual corpus/parity boundary drifted.");
  }

  const expectedBindingBoundary: ManualConditionArrayCoverageReport["bindingBoundary"] =
    {
      status: "authenticated",
      catalogReportSha256: EXPECTED_CURRENT_BINDING_CATALOG_SHA256,
      occurrenceCount: 56,
      ittoAuthenticated: true,
      keqingEquipmentDurableMatchesCurrent: true,
      keqingRolePairDurableMatchesCurrent: true,
      kleeSourceLocalDurableMatchesCurrent: true,
      dionaSourceLocalDurableMatchesCurrent: true,
      keqingEquipmentAtomicClaimCount: 42,
      kleeSourceLocalOccurrenceCount: 4,
      dionaSourceLocalOccurrenceCount: 3,
      exactTextAcknowledgementOccurrenceCount: 3,
      typedBindingMeansConditionTruth: false,
    };
  if (
    stableJson(report.bindingBoundary) !== stableJson(expectedBindingBoundary)
  ) {
    throw new Error("Pinned authenticated binding boundary drifted.");
  }

  validateComparableOccurrenceRows(report.occurrences);
  validateExpectedCurrentCoverageBoundary(report.occurrences);
  if (
    sha256Text(stableJson(report.occurrences)) !==
    EXPECTED_CURRENT_OCCURRENCES_SHA256
  ) {
    throw new Error("Pinned current condition occurrence rows drifted.");
  }

  const recomputedStatusSets = buildNonStructuralUniqueBindingStatusSets(
    report.occurrences,
  );
  if (
    stableJson(report.nonStructuralUniqueBindingStatusSets) !==
    stableJson(recomputedStatusSets)
  ) {
    throw new Error(
      "Non-structural unique binding status sets do not recompute from occurrence rows.",
    );
  }
  const recomputedSummary = summarizeCoverage(
    report.occurrences,
    recomputedStatusSets,
  );
  if (stableJson(report.summary) !== stableJson(recomputedSummary)) {
    throw new Error("Coverage summary does not recompute from occurrence rows.");
  }
  if (
    stableJson(report.cautions) !== stableJson(CAUTIONS) ||
    stableJson(report.prohibitedInterpretations) !==
      stableJson(PROHIBITED_INTERPRETATIONS)
  ) {
    throw new Error("Caution or prohibited-interpretation boundary drifted.");
  }
}

function validateComparableOccurrenceRows(
  occurrences: readonly ManualConditionCoverageOccurrence[],
): void {
  const seen = new Set<string>();
  let previousOccurrenceId: string | null = null;
  for (const occurrence of occurrences) {
    if (
      seen.has(occurrence.occurrenceId) ||
      (previousOccurrenceId != null &&
        compareText(previousOccurrenceId, occurrence.occurrenceId) >= 0)
    ) {
      throw new Error("Condition occurrence rows are duplicated or unsorted.");
    }
    seen.add(occurrence.occurrenceId);
    previousOccurrenceId = occurrence.occurrenceId;

    if (
      occurrence.occurrenceId !==
      `${occurrence.sourceId}:${occurrence.recordKind}:${occurrence.sourceRecordId}:${occurrence.manualClaimPath}` ||
      occurrence.conditionsSha256 !==
        sha256Text(stableJson(occurrence.conditions)) ||
      occurrence.repositoryParity !== "exact" ||
      occurrence.issues.length !== 0 ||
      occurrence.extraction.method !== "agent-assisted" ||
      occurrence.extraction.reviewStatus !== "unreviewed"
    ) {
      throw new Error(
        `Condition occurrence identity or provenance drifted for ${occurrence.occurrenceId}.`,
      );
    }
    const expectedEnergyDimension =
      occurrence.claimAxis === "er-target"
        ? "structural-er"
        : "not-structural-er";
    const expectedDisplayStatus = displayStatusFor(
      occurrence.conditions,
      occurrence.bindingClassification,
      occurrence.energyClassification,
    );
    const expectedBindingEligibility = occurrence.conditions.length > 0;
    const expectedNonStructuralBindingEligibility =
      expectedBindingEligibility &&
      occurrence.structuralEnergyDimension !== "structural-er";
    if (
      occurrence.structuralEnergyDimension !== expectedEnergyDimension ||
      (occurrence.structuralEnergyDimension === "structural-er") !==
        (occurrence.energyClassification === "structural-er") ||
      occurrence.displayStatus !== expectedDisplayStatus ||
      occurrence.bindingCoverageEligible !== expectedBindingEligibility ||
      occurrence.nonStructuralBindingCoverageEligible !==
        expectedNonStructuralBindingEligibility
    ) {
      throw new Error(
        `Condition occurrence derived classifications drifted for ${occurrence.occurrenceId}.`,
      );
    }
    const expectedBindingKey = `${occurrence.occurrenceId}:${occurrence.conditionsSha256}`;
    if (
      occurrence.bindingClassification === "unbound"
        ? occurrence.bindingOccurrenceKey != null ||
          occurrence.bindingEvidence != null
        : occurrence.bindingOccurrenceKey !== expectedBindingKey ||
          occurrence.bindingEvidence == null
    ) {
      throw new Error(
        `Condition occurrence binding evidence drifted for ${occurrence.occurrenceId}.`,
      );
    }
    if (!energyEvidenceMatchesClassification(occurrence)) {
      throw new Error(
        `Condition occurrence energy evidence drifted for ${occurrence.occurrenceId}.`,
      );
    }
  }
}

function energyEvidenceMatchesClassification(
  occurrence: ManualConditionCoverageOccurrence,
): boolean {
  const evidence = occurrence.energyEvidence;
  switch (occurrence.energyClassification) {
    case "energy-unclassified":
      return evidence == null;
    case "not-energy-deferred":
      return (
        (evidence?.kind === "not-energy-deferred" &&
          !evidence.energyRelatedWorkDeferred) ||
        (evidence?.kind === "source-local-not-energy-deferred" &&
          !evidence.energyRelatedWorkDeferred &&
          !evidence.structuralErEvidencePresent &&
          evidence.selectedOccurrenceId === occurrence.occurrenceId &&
          occurrence.bindingEvidence?.kind ===
            "source-local-typed-predicate-ast" &&
          evidence.sliceId === occurrence.bindingEvidence.sliceId &&
          evidence.selectedOccurrenceSha256 ===
            occurrence.bindingEvidence.selectedOccurrenceSha256)
      );
    case "structural-er":
      return (
        evidence?.kind === "structural-er" &&
        evidence.energyRelatedWorkDeferred
      );
    case "deferred-energy-prerequisite":
      return (
        evidence?.kind === "deferred-energy-prerequisite" &&
        evidence.energyRelatedWorkDeferred
      );
    case "exact-authored-energy-related-deferral":
      return (
        evidence?.kind === "exact-authored-energy-related-deferral" &&
        evidence.energyRelatedWorkDeferred &&
        evidence.occurrenceKey ===
          `${occurrence.occurrenceId}:${occurrence.conditionsSha256}`
      );
  }
}

async function buildAuthenticatedBindingCatalog(
  input: BuildManualConditionArrayCoverageReportInput,
  repository: KnowledgeRepository,
  generatedFrom: readonly GeneratedFromEntry[],
): Promise<CurrentConditionBindingCatalogReport> {
  const ittoManual = requiredManualSnapshotInputContaining(
    input.manualInputs,
    "kqm",
    "itto-on-field-artifact-stats-version-5-6",
  );
  const ittoAuthentication =
    await authenticateIttoSourceConditionedGuidePacketReport(
      input.ittoDurableReportInput as SourceConditionedGuidePacketReport,
      {
        repositoryInput: input.repositoryInput,
        manualSnapshotInput: ittoManual.snapshot,
        manualIndexInput: input.manualIndexInput,
        sourceRegistryInput: input.sourceRegistryInput,
        catalogs: input.catalogs,
        generatedFrom: selectGeneratedFrom(
          generatedFrom,
          ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
        ),
      },
    );
  const currentKeqingEquipment =
    buildKeqingLunarEquipmentEvidenceValidationReport(
      repository,
      input.manualInputs,
      selectGeneratedFrom(
        generatedFrom,
        KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS,
      ),
    );
  const currentKeqingRolePair = await runKeqingSourceScopedRolePairSample(
    repository,
    input.manualInputs,
    input.checkedInRosterDomainReportInput,
    selectGeneratedFrom(
      generatedFrom,
      KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS,
    ),
  );
  const kleeManual = requiredManualSnapshotInputContaining(
    input.manualInputs,
    "kqm",
    "klee-on-field-artifact-stats-luna-iv",
  );
  const kleeDurableReport = requiredJsonSourceObject(
    input.sourceFiles,
    KLEE_SOURCE_LOCAL_REPORT_PATH,
  ) as KleeSourceLocalConditionSliceReport;
  const kleeAuthentication =
    authenticateKleeSourceLocalConditionSliceReport(kleeDurableReport, {
      repositoryInput: input.repositoryInput,
      manualSnapshotInput: kleeManual.snapshot,
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
      `The checked-in Klee source-local report failed a fresh current rebuild: ${kleeAuthentication.reason}${
        kleeAuthentication.issues.length > 0
          ? ` (${kleeAuthentication.issues
              .map(({ code, path: issuePath }) => `${code} at ${issuePath}`)
              .join("; ")})`
          : ""
      }.`,
    );
  }
  const dionaManual = requiredManualSnapshotInputContaining(
    input.manualInputs,
    "kqm",
    "c6-diona-mavuika-citlali-bennett-forward-melt",
  );
  const dionaDurableReport = requiredJsonSourceObject(
    input.sourceFiles,
    DIONA_SOURCE_LOCAL_REPORT_PATH,
  ) as DionaSourceLocalSupportSliceReport;
  const dionaAuthentication =
    authenticateDionaSourceLocalSupportSliceReport(dionaDurableReport, {
      repositoryInput: input.repositoryInput,
      manualSnapshotInput: dionaManual.snapshot,
      manualIndexInput: input.manualIndexInput,
      sourceRegistryInput: input.sourceRegistryInput,
      sourceFiles: selectSourceFiles(
        input.sourceFiles,
        DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS,
      ),
      generatedFrom: selectGeneratedFrom(
        generatedFrom,
        DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS,
      ),
    });
  if (!dionaAuthentication.authenticated) {
    throw new Error(
      `The checked-in Diona source-local report failed a fresh current rebuild: ${dionaAuthentication.reason}${
        dionaAuthentication.issues.length > 0
          ? ` (${dionaAuthentication.issues
              .map(({ code, path: issuePath }) => `${code} at ${issuePath}`)
              .join("; ")})`
          : ""
      }.`,
    );
  }
  return buildCurrentConditionBindingCatalog({
    ittoAuthentication,
    keqingEquipment: {
      durableReport: input.keqingEquipmentDurableReportInput,
      currentReport: currentKeqingEquipment,
    },
    keqingRolePair: {
      durableReport: input.keqingRolePairDurableReportInput,
      currentReport: currentKeqingRolePair,
    },
    kleeSourceLocal: {
      durableReport: kleeDurableReport,
      currentReport: kleeAuthentication.canonicalReport,
    },
    dionaSourceLocal: {
      durableReport: dionaDurableReport,
      currentReport: dionaAuthentication.canonicalReport,
    },
  });
}

function requiredJsonSourceObject(
  sourceFiles: readonly ManualConditionCoverageSourceFile[],
  relativePath: string,
): unknown {
  const matches = sourceFiles.filter(({ path: sourcePath }) =>
    sourcePath === relativePath,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one byte-authenticated JSON source for ${relativePath}; found ${matches.length}.`,
    );
  }
  return JSON.parse(matches[0]?.text ?? "");
}

function selectSourceFiles(
  sourceFiles: readonly ManualConditionCoverageSourceFile[],
  paths: readonly string[],
): ManualConditionCoverageSourceFile[] {
  return paths.map((relativePath) => {
    const matches = sourceFiles.filter(({ path: sourcePath }) =>
      sourcePath === relativePath,
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected one current source file for ${relativePath}; found ${matches.length}.`,
      );
    }
    return { ...matches[0]! };
  });
}

function authenticateRawInputs(
  input: BuildManualConditionArrayCoverageReportInput,
  generatedFrom: readonly GeneratedFromEntry[],
): void {
  assertExactSet(
    input.sourceFiles.map(({ path: sourcePath }) => sourcePath),
    MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS,
    "raw JSON source files",
  );
  const sourceFiles = new Map<string, string>();
  for (const sourceFile of input.sourceFiles) {
    if (sourceFiles.has(sourceFile.path)) {
      throw new Error(`Duplicate raw JSON source file ${sourceFile.path}.`);
    }
    const declared = requiredGeneratedHash(generatedFrom, sourceFile.path);
    if (sha256Text(sourceFile.text) !== declared) {
      throw new Error(
        `Raw JSON bytes do not match generatedFrom for ${sourceFile.path}.`,
      );
    }
    try {
      JSON.parse(sourceFile.text);
    } catch {
      throw new Error(`Raw source file ${sourceFile.path} is not JSON.`);
    }
    sourceFiles.set(sourceFile.path, sourceFile.text);
  }
  authenticateJsonObject(input.repositoryInput, REPOSITORY_PATH, sourceFiles);
  authenticateJsonObject(input.manualIndexInput, MANUAL_INDEX_PATH, sourceFiles);
  authenticateJsonObject(
    input.sourceRegistryInput,
    SOURCE_REGISTRY_PATH,
    sourceFiles,
  );
  authenticateJsonObject(
    input.checkedInRosterDomainReportInput,
    ROSTER_REPORT_PATH,
    sourceFiles,
  );
  authenticateJsonObject(
    input.ittoDurableReportInput,
    ITTO_REPORT_PATH,
    sourceFiles,
  );
  authenticateJsonObject(
    input.keqingEquipmentDurableReportInput,
    KEQING_EQUIPMENT_REPORT_PATH,
    sourceFiles,
  );
  authenticateJsonObject(
    input.keqingRolePairDurableReportInput,
    KEQING_ROLE_PAIR_REPORT_PATH,
    sourceFiles,
  );
  assertExactSet(
    input.manualInputs.map(({ snapshotFile }) => snapshotFile.path),
    MANUAL_CONDITION_COVERAGE_SNAPSHOT_PATHS,
    "manual snapshot inputs",
  );
  for (const manualInput of input.manualInputs) {
    const snapshotPath = manualInput.snapshotFile.path;
    const rawText = sourceFiles.get(snapshotPath);
    if (rawText == null) {
      throw new Error(`Missing raw manual snapshot ${snapshotPath}.`);
    }
    if (manualInput.snapshotFile.sha256 !== sha256Text(rawText)) {
      throw new Error(
        `Manual snapshot byte hash is detached from ${snapshotPath}.`,
      );
    }
    authenticateJsonObject(manualInput.snapshot, snapshotPath, sourceFiles);
  }
}

function authenticateJsonObject(
  value: unknown,
  relativePath: string,
  sourceFiles: ReadonlyMap<string, string>,
): void {
  const rawText = sourceFiles.get(relativePath);
  if (rawText == null) throw new Error(`Missing raw JSON source ${relativePath}.`);
  if (stableJson(value) !== stableJson(JSON.parse(rawText))) {
    throw new Error(`Input object is detached from raw JSON at ${relativePath}.`);
  }
}

function validateGeneratedFrom(
  input: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  const rows = input.map(({ path: inputPath, sha256 }, index) => {
    if (typeof inputPath !== "string" || inputPath.length === 0) {
      throw new Error(`generatedFrom[${index}].path is invalid.`);
    }
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      throw new Error(`generatedFrom[${index}].sha256 is invalid.`);
    }
    return { path: inputPath, sha256 };
  });
  assertExactSet(
    rows.map(({ path: inputPath }) => inputPath),
    MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS,
    "generatedFrom paths",
  );
  return rows.sort((left, right) => compareText(left.path, right.path));
}

function selectGeneratedFrom(
  generatedFrom: readonly GeneratedFromEntry[],
  paths: readonly string[],
): GeneratedFromEntry[] {
  return paths.map((inputPath) => ({
    path: inputPath,
    sha256: requiredGeneratedHash(generatedFrom, inputPath),
  }));
}

function requiredGeneratedHash(
  generatedFrom: readonly GeneratedFromEntry[],
  relativePath: string,
): string {
  const matches = generatedFrom.filter(({ path: inputPath }) =>
    inputPath === relativePath,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one generatedFrom hash for ${relativePath}; found ${matches.length}.`,
    );
  }
  return matches[0]?.sha256 ?? "";
}

function mergeOccurrences(
  sourceOccurrences: readonly ManualConditionArrayOccurrence[],
  parityRows: readonly {
    occurrenceId: string;
    status: string;
    repositoryJsonPath: string | null;
  }[],
  bindingEntries: readonly CurrentConditionBindingCatalogEntry[],
  authoredEnergyDeferrals: readonly ExactAuthoredEnergyDeferralEntry[],
): ManualConditionCoverageOccurrence[] {
  const bindingByKey = new Map<string, CurrentConditionBindingCatalogEntry>();
  for (const entry of bindingEntries) {
    if (bindingByKey.has(entry.occurrenceKey)) {
      throw new Error(`Duplicate condition binding ${entry.occurrenceKey}.`);
    }
    bindingByKey.set(entry.occurrenceKey, entry);
  }
  const deferralByKey = requireExactAuthoredEnergyDeferralMatches(
    sourceOccurrences,
    authoredEnergyDeferrals,
  );
  const parityByOccurrenceId = new Map(
    parityRows.map((row) => [row.occurrenceId, row] as const),
  );
  const consumedBindings = new Set<string>();
  const merged = sourceOccurrences.map((occurrence) => {
    const occurrenceKey = `${occurrence.occurrenceId}:${occurrence.conditionsSha256}`;
    const binding = bindingByKey.get(occurrenceKey) ?? null;
    const authoredDeferral = deferralByKey.get(occurrenceKey) ?? null;
    const parity = parityByOccurrenceId.get(occurrence.occurrenceId);
    if (parity?.status !== "exact" || parity.repositoryJsonPath == null) {
      throw new Error(
        `Condition occurrence ${occurrence.occurrenceId} lacks exact repository parity.`,
      );
    }
    if (binding) {
      consumedBindings.add(binding.occurrenceKey);
      if (
        binding.occurrenceId !== occurrence.occurrenceId ||
        binding.subject !== occurrence.subject ||
        stableJson(binding.orderedConditions) !== stableJson(occurrence.conditions)
      ) {
        throw new Error(
          `Condition binding payload drifted for ${occurrence.occurrenceId}.`,
        );
      }
    }
    if (authoredDeferral) {
      if (
        authoredDeferral.occurrenceId !== occurrence.occurrenceId ||
        authoredDeferral.subject !== occurrence.subject ||
        stableJson(authoredDeferral.orderedConditions) !==
          stableJson(occurrence.conditions)
      ) {
        throw new Error(
          `Authored energy deferral payload drifted for ${occurrence.occurrenceId}.`,
        );
      }
      if (
        binding != null ||
        occurrence.structuralEnergyDimension === "structural-er"
      ) {
        throw new Error(
          `Authored energy deferral must target an otherwise-unbound non-structural occurrence: ${occurrence.occurrenceId}.`,
        );
      }
    }
    const energyClassification: CurrentConditionEnergyClassification =
      occurrence.structuralEnergyDimension === "structural-er"
        ? "structural-er"
        : binding != null
          ? binding.energyClassification
          : authoredDeferral != null
            ? "exact-authored-energy-related-deferral"
            : "energy-unclassified";
    if (
      occurrence.structuralEnergyDimension === "structural-er" &&
      binding?.energyClassification !== undefined
    ) {
      throw new Error(
        `Structural ER occurrence ${occurrence.occurrenceId} unexpectedly has wrapper binding evidence.`,
      );
    }
    const bindingClassification =
      binding?.bindingClassification ?? "unbound";
    const displayStatus = displayStatusFor(
      occurrence.conditions,
      bindingClassification,
      energyClassification,
    );
    return {
      ...occurrence,
      repositoryJsonPath: parity.repositoryJsonPath,
      repositoryParity: "exact" as const,
      bindingClassification,
      energyClassification,
      displayStatus,
      bindingCoverageEligible: occurrence.conditions.length > 0,
      nonStructuralBindingCoverageEligible:
        occurrence.conditions.length > 0 &&
        occurrence.structuralEnergyDimension !== "structural-er",
      bindingOccurrenceKey: binding?.occurrenceKey ?? null,
      bindingEvidence: binding?.bindingEvidence ?? null,
      energyEvidence:
        (energyClassification === "structural-er"
          ? {
              kind: "structural-er" as const,
              structuralErEvidencePresent: true as const,
              energyRelatedWorkDeferred: true as const,
              evidenceIds: [occurrence.occurrenceId],
            }
          : binding != null
            ? binding.energyEvidence
            : authoredDeferral != null
              ? {
                  kind: "exact-authored-energy-related-deferral" as const,
                  structuralErEvidencePresent: false as const,
                  energyRelatedWorkDeferred: true as const,
                  category: authoredDeferral.category,
                  reason: authoredDeferral.reason,
                  occurrenceKey: authoredDeferral.occurrenceKey,
                }
              : null),
      issues: [] as [],
    };
  });
  const orphanBindings = bindingEntries.filter(
    ({ occurrenceKey }) => !consumedBindings.has(occurrenceKey),
  );
  if (orphanBindings.length > 0) {
    throw new Error(
      `Authenticated bindings do not match manual occurrences: ${orphanBindings
        .map(({ occurrenceId }) => occurrenceId)
        .join(", ")}.`,
    );
  }
  return merged.sort((left, right) => compareText(left.occurrenceId, right.occurrenceId));
}

function displayStatusFor(
  conditions: readonly string[],
  binding: CurrentConditionBindingClassification,
  energy: CurrentConditionEnergyClassification,
): ManualConditionCoverageDisplayStatus {
  if (binding === "invalid") return "invalid";
  if (conditions.length === 0) return "unconditional";
  if (
    energy === "structural-er" ||
    energy === "deferred-energy-prerequisite" ||
    energy === "exact-authored-energy-related-deferral"
  ) {
    return "er-deferred";
  }
  if (binding === "typed-bound") return "typed-bound";
  if (binding === "exact-text-acknowledged") {
    return "exact-text-acknowledged";
  }
  return "known-but-unbound";
}

function validateExpectedCurrentCoverageBoundary(
  occurrences: readonly ManualConditionCoverageOccurrence[],
): void {
  const summary = summarizeCoverage(
    occurrences,
    buildNonStructuralUniqueBindingStatusSets(occurrences),
  );
  const expected = {
    total: {
      occurrenceCount: 142,
      emptyCount: 16,
      nonemptyCount: 126,
      uniqueExactArrayCount: 89,
      stringOccurrenceCount: 159,
      uniqueStringCount: 97,
    },
    bindingCoverage: {
      occurrenceCount: 126,
      emptyCount: 0,
      nonemptyCount: 126,
      uniqueExactArrayCount: 89,
      stringOccurrenceCount: 159,
      uniqueStringCount: 97,
      typedBoundOccurrenceCount: 53,
      exactTextAcknowledgedOccurrenceCount: 3,
      unboundOccurrenceCount: 70,
      invalidOccurrenceCount: 0,
      typedBoundStringOccurrenceCount: 75,
      exactTextAcknowledgedStringOccurrenceCount: 3,
      unboundStringOccurrenceCount: 81,
      invalidStringOccurrenceCount: 0,
    },
    nonStructuralBindingCoverage: {
      occurrenceCount: 123,
      emptyCount: 0,
      nonemptyCount: 123,
      uniqueExactArrayCount: 86,
      stringOccurrenceCount: 156,
      uniqueStringCount: 94,
      typedBoundOccurrenceCount: 53,
      exactTextAcknowledgedOccurrenceCount: 3,
      unboundOccurrenceCount: 67,
      invalidOccurrenceCount: 0,
      typedBoundStringOccurrenceCount: 75,
      exactTextAcknowledgedStringOccurrenceCount: 3,
      unboundStringOccurrenceCount: 78,
      invalidStringOccurrenceCount: 0,
    },
    energyCoverage: {
      structuralEr: expectedArrayStatistics(3, 0, 3, 3, 3, 3),
      deferredEnergyPrerequisite: expectedArrayStatistics(3, 0, 3, 1, 3, 1),
      exactAuthoredEnergyRelatedDeferral: expectedArrayStatistics(
        9,
        0,
        9,
        8,
        12,
        11,
      ),
      notEnergyDeferred: expectedArrayStatistics(50, 0, 50, 30, 72, 31),
      energyUnclassified: expectedArrayStatistics(61, 0, 61, 47, 69, 52),
      unconditional: expectedArrayStatistics(16, 16, 0, 0, 0, 0),
      deferredDisplay: expectedArrayStatistics(15, 0, 15, 12, 18, 15),
    },
    displayStatusCounts: {
      invalid: 0,
      unconditional: 16,
      "er-deferred": 15,
      "typed-bound": 50,
      "exact-text-acknowledged": 3,
      "known-but-unbound": 58,
    },
    nonStructuralUniqueBindingArrayCoverage: {
      uniqueExactArrayCount: 86,
      typedOnlyCount: 31,
      unboundOnlyCount: 54,
      mixedAcknowledgedAndUnboundCount: 1,
      otherMixedCount: 0,
    },
  };
  const observed = {
    total: summary.total,
    bindingCoverage: summary.bindingCoverage,
    nonStructuralBindingCoverage: summary.nonStructuralBindingCoverage,
    energyCoverage: summary.energyCoverage,
    displayStatusCounts: summary.displayStatusCounts,
    nonStructuralUniqueBindingArrayCoverage:
      summary.nonStructuralUniqueBindingArrayCoverage,
  };
  if (stableJson(observed) !== stableJson(expected)) {
    throw new Error(
      `Current manual condition coverage boundary drifted: ${stableJson(observed).trim()}.`,
    );
  }
}

function validateExpectedCurrentBindingCatalogBoundary(
  catalog: CurrentConditionBindingCatalogReport,
): void {
  if (
    catalog.summary.occurrenceCount !== 56 ||
    catalog.summary.typedBindingCount !== 53 ||
    catalog.summary.ittoTypedBindingCount !== 15 ||
    catalog.summary.ittoDeferredEnergyPrerequisiteCount !== 3 ||
    catalog.summary.keqingEquipmentOccurrenceCount !== 31 ||
    catalog.summary.keqingEquipmentAtomicClaimCount !== 42 ||
    catalog.summary.keqingVvAcknowledgedOccurrenceCount !== 3 ||
    catalog.summary.kleeSourceLocalOccurrenceCount !== 4 ||
    catalog.summary.kleeSourceLocalTypedBindingCount !== 4 ||
    catalog.summary.kleeSourceLocalNotEnergyDeferredCount !== 4 ||
    catalog.summary.dionaSourceLocalOccurrenceCount !== 3 ||
    catalog.summary.dionaSourceLocalTypedBindingCount !== 3 ||
    catalog.summary.dionaSourceLocalNotEnergyDeferredCount !== 3
  ) {
    throw new Error("Authenticated condition-binding catalog totals drifted.");
  }
}

function expectedArrayStatistics(
  occurrenceCount: number,
  emptyCount: number,
  nonemptyCount: number,
  uniqueExactArrayCount: number,
  stringOccurrenceCount: number,
  uniqueStringCount: number,
): ArrayStatistics {
  return {
    occurrenceCount,
    emptyCount,
    nonemptyCount,
    uniqueExactArrayCount,
    stringOccurrenceCount,
    uniqueStringCount,
  };
}

function buildNonStructuralUniqueBindingStatusSets(
  occurrences: readonly ManualConditionCoverageOccurrence[],
): ManualConditionArrayCoverageReport["nonStructuralUniqueBindingStatusSets"] {
  const groups = new Map<
    string,
    {
      conditions: string[];
      occurrenceIds: string[];
      bindingClassifications: Set<CurrentConditionBindingClassification>;
    }
  >();
  for (const occurrence of occurrences.filter(
    ({ nonStructuralBindingCoverageEligible }) =>
      nonStructuralBindingCoverageEligible,
  )) {
    const existing = groups.get(occurrence.conditionsSha256);
    if (existing) {
      if (stableJson(existing.conditions) !== stableJson(occurrence.conditions)) {
        throw new Error(
          `Condition-array hash collision at ${occurrence.conditionsSha256}.`,
        );
      }
      existing.occurrenceIds.push(occurrence.occurrenceId);
      existing.bindingClassifications.add(occurrence.bindingClassification);
    } else {
      groups.set(occurrence.conditionsSha256, {
        conditions: [...occurrence.conditions],
        occurrenceIds: [occurrence.occurrenceId],
        bindingClassifications: new Set([
          occurrence.bindingClassification,
        ]),
      });
    }
  }
  return [...groups.entries()]
    .map(([conditionsSha256, group]) => ({
      conditionsSha256,
      conditions: group.conditions,
      occurrenceCount: group.occurrenceIds.length,
      bindingClassifications: [...group.bindingClassifications].sort(
        compareText,
      ),
      occurrenceIds: group.occurrenceIds.sort(compareText),
    }))
    .sort((left, right) => compareText(left.conditionsSha256, right.conditionsSha256));
}

function summarizeCoverage(
  occurrences: readonly ManualConditionCoverageOccurrence[],
  nonStructuralUniqueBindingArrays: ManualConditionArrayCoverageReport["nonStructuralUniqueBindingStatusSets"],
): ManualConditionCoverageSummary {
  const bindingCoverage = occurrences.filter(
    ({ bindingCoverageEligible }) => bindingCoverageEligible,
  );
  const nonStructuralBindingCoverage = occurrences.filter(
    ({ nonStructuralBindingCoverageEligible }) =>
      nonStructuralBindingCoverageEligible,
  );
  const byDisplay = countDisplayStatuses(occurrences);
  const erDeferred = occurrences.filter(({ displayStatus }) =>
    displayStatus === "er-deferred",
  );
  const structuralEr = occurrences.filter(
    ({ energyClassification }) => energyClassification === "structural-er",
  );
  const deferredPrerequisite = occurrences.filter(
    ({ energyClassification }) =>
      energyClassification === "deferred-energy-prerequisite",
  );
  const authoredDeferral = occurrences.filter(
    ({ energyClassification }) =>
      energyClassification === "exact-authored-energy-related-deferral",
  );
  const notEnergyDeferred = occurrences.filter(
    ({ energyClassification }) =>
      energyClassification === "not-energy-deferred",
  );
  const energyUnclassified = occurrences.filter(
    ({ conditions, energyClassification }) =>
      conditions.length > 0 && energyClassification === "energy-unclassified",
  );
  const unconditional = occurrences.filter(
    ({ conditions }) => conditions.length === 0,
  );
  const kindOrder = [
    "character_guide",
    "team",
    "character_role",
    "energy_guidance",
    "team_template",
  ];
  return {
    total: arrayStatistics(occurrences),
    bindingCoverage: bindingCoverageStatistics(bindingCoverage),
    nonStructuralBindingCoverage: bindingCoverageStatistics(
      nonStructuralBindingCoverage,
    ),
    energyCoverage: {
      structuralEr: arrayStatistics(structuralEr),
      deferredEnergyPrerequisite: arrayStatistics(deferredPrerequisite),
      exactAuthoredEnergyRelatedDeferral: arrayStatistics(authoredDeferral),
      notEnergyDeferred: arrayStatistics(notEnergyDeferred),
      energyUnclassified: arrayStatistics(energyUnclassified),
      unconditional: arrayStatistics(unconditional),
      deferredDisplay: arrayStatistics(erDeferred),
    },
    displayStatusCounts: byDisplay,
    nonStructuralUniqueBindingArrayCoverage: {
      uniqueExactArrayCount: nonStructuralUniqueBindingArrays.length,
      typedOnlyCount: nonStructuralUniqueBindingArrays.filter(
        ({ bindingClassifications }) =>
          stableJson(bindingClassifications) === stableJson(["typed-bound"]),
      ).length,
      unboundOnlyCount: nonStructuralUniqueBindingArrays.filter(
        ({ bindingClassifications }) =>
          stableJson(bindingClassifications) === stableJson(["unbound"]),
      ).length,
      mixedAcknowledgedAndUnboundCount:
        nonStructuralUniqueBindingArrays.filter(
          ({ bindingClassifications }) =>
            stableJson(bindingClassifications) ===
          stableJson(
              ["exact-text-acknowledged", "unbound"].sort(compareText),
            ),
        ).length,
      otherMixedCount: nonStructuralUniqueBindingArrays.filter(
        ({ bindingClassifications }) => bindingClassifications.length > 1,
      ).length -
        nonStructuralUniqueBindingArrays.filter(
          ({ bindingClassifications }) =>
            stableJson(bindingClassifications) ===
            stableJson(
              ["exact-text-acknowledged", "unbound"].sort(compareText),
            ),
        ).length,
    },
    bySource: groupSummaries(occurrences, ({ sourceId }) => sourceId),
    byRecordKind: kindOrder.map((recordKind) =>
      groupSummary(
        recordKind,
        occurrences.filter((occurrence) =>
          occurrence.recordKind === recordKind,
        ),
      ),
    ),
    bySubject: groupSummaries(occurrences, ({ subject }) => subject),
  };
}

function bindingCoverageStatistics(
  occurrences: readonly ManualConditionCoverageOccurrence[],
): BindingCoverageStatistics {
  const typed = occurrences.filter(
    ({ bindingClassification }) => bindingClassification === "typed-bound",
  );
  const acknowledged = occurrences.filter(
    ({ bindingClassification }) =>
      bindingClassification === "exact-text-acknowledged",
  );
  const unbound = occurrences.filter(
    ({ bindingClassification }) => bindingClassification === "unbound",
  );
  const invalid = occurrences.filter(
    ({ bindingClassification }) => bindingClassification === "invalid",
  );
  return {
    ...arrayStatistics(occurrences),
    typedBoundOccurrenceCount: typed.length,
    exactTextAcknowledgedOccurrenceCount: acknowledged.length,
    unboundOccurrenceCount: unbound.length,
    invalidOccurrenceCount: invalid.length,
    typedBoundStringOccurrenceCount: stringCount(typed),
    exactTextAcknowledgedStringOccurrenceCount: stringCount(acknowledged),
    unboundStringOccurrenceCount: stringCount(unbound),
    invalidStringOccurrenceCount: stringCount(invalid),
  };
}

function groupSummaries(
  occurrences: readonly ManualConditionCoverageOccurrence[],
  key: (occurrence: ManualConditionCoverageOccurrence) => string,
): CoverageGroupSummary[] {
  return [...new Set(occurrences.map(key))]
    .sort(compareText)
    .map((groupId) =>
      groupSummary(
        groupId,
        occurrences.filter((occurrence) => key(occurrence) === groupId),
      ),
    );
}

function groupSummary(
  groupId: string,
  occurrences: readonly ManualConditionCoverageOccurrence[],
): CoverageGroupSummary {
  const statuses = countDisplayStatuses(occurrences);
  return {
    groupId,
    ...arrayStatistics(occurrences),
    bindingCoverageConditionCount: occurrences.filter(
      ({ bindingCoverageEligible }) => bindingCoverageEligible,
    ).length,
    nonStructuralBindingCoverageConditionCount: occurrences.filter(
      ({ nonStructuralBindingCoverageEligible }) =>
        nonStructuralBindingCoverageEligible,
    ).length,
    typedBoundCount: occurrences.filter(
      ({ bindingClassification, bindingCoverageEligible }) =>
        bindingCoverageEligible && bindingClassification === "typed-bound",
    ).length,
    exactTextAcknowledgedCount: occurrences.filter(
      ({ bindingClassification, bindingCoverageEligible }) =>
        bindingCoverageEligible &&
        bindingClassification === "exact-text-acknowledged",
    ).length,
    knownButUnboundCount: occurrences.filter(
      ({ bindingClassification, bindingCoverageEligible }) =>
        bindingCoverageEligible && bindingClassification === "unbound",
    ).length,
    erDeferredCount: statuses["er-deferred"],
    unconditionalCount: statuses.unconditional,
  };
}

function arrayStatistics(
  occurrences: readonly Pick<
    ManualConditionCoverageOccurrence,
    "conditions" | "conditionsSha256"
  >[],
): ArrayStatistics {
  const nonempty = occurrences.filter(({ conditions }) => conditions.length > 0);
  const strings = occurrences.flatMap(({ conditions }) => conditions);
  return {
    occurrenceCount: occurrences.length,
    emptyCount: occurrences.length - nonempty.length,
    nonemptyCount: nonempty.length,
    uniqueExactArrayCount: new Set(
      nonempty.map(({ conditionsSha256 }) => conditionsSha256),
    ).size,
    stringOccurrenceCount: strings.length,
    uniqueStringCount: new Set(strings).size,
  };
}

function countDisplayStatuses(
  occurrences: readonly ManualConditionCoverageOccurrence[],
): Record<ManualConditionCoverageDisplayStatus, number> {
  const statuses: ManualConditionCoverageDisplayStatus[] = [
    "invalid",
    "unconditional",
    "er-deferred",
    "typed-bound",
    "exact-text-acknowledged",
    "known-but-unbound",
  ];
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      occurrences.filter(({ displayStatus }) => displayStatus === status).length,
    ]),
  ) as Record<ManualConditionCoverageDisplayStatus, number>;
}

function stringCount(
  occurrences: readonly ManualConditionCoverageOccurrence[],
): number {
  return occurrences.reduce(
    (count, { conditions }) => count + conditions.length,
    0,
  );
}

function bindingBoundary(
  catalog: CurrentConditionBindingCatalogReport,
): ManualConditionArrayCoverageReport["bindingBoundary"] {
  return {
    status: "authenticated",
    catalogReportSha256: sha256Text(stableJson(catalog)),
    occurrenceCount: catalog.summary.occurrenceCount,
    ittoAuthenticated: catalog.authenticationBoundary.ittoAuthenticated,
    keqingEquipmentDurableMatchesCurrent:
      catalog.authenticationBoundary.keqingEquipmentDurableMatchesCurrent,
    keqingRolePairDurableMatchesCurrent:
      catalog.authenticationBoundary.keqingRolePairDurableMatchesCurrent,
    kleeSourceLocalDurableMatchesCurrent:
      catalog.authenticationBoundary.kleeSourceLocalDurableMatchesCurrent,
    dionaSourceLocalDurableMatchesCurrent:
      catalog.authenticationBoundary.dionaSourceLocalDurableMatchesCurrent,
    keqingEquipmentAtomicClaimCount:
      catalog.summary.keqingEquipmentAtomicClaimCount,
    kleeSourceLocalOccurrenceCount:
      catalog.summary.kleeSourceLocalOccurrenceCount,
    dionaSourceLocalOccurrenceCount:
      catalog.summary.dionaSourceLocalOccurrenceCount,
    exactTextAcknowledgementOccurrenceCount:
      catalog.summary.keqingVvAcknowledgedOccurrenceCount,
    typedBindingMeansConditionTruth: false,
  };
}

function failedReport(
  generatedFrom: GeneratedFromEntry[],
  message: string,
): ManualConditionArrayCoverageReport {
  return {
    schemaVersion: 1,
    reportType: "manual-condition-array-coverage-report",
    classification: "descriptive-exact-condition-binding-coverage",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-unreviewed-source-coverage",
    ...CAPABILITY_BOUNDARY,
    generatedFrom,
    rawInputBoundary: {
      status: "rejected",
      exactPathSet: false,
      rawJsonObjectClosure: false,
      sourceFileCount: 0,
    },
    corpusBoundary: {
      authoritativeSource: "indexed-manual-observation-snapshots",
      consolidatedRepositoryCountedAsSecondCorpus: false,
      snapshotCount: 0,
      manualRecordCount: 0,
      occurrenceCount: 0,
      repositoryParityStatus: "not-evaluated",
      repositoryExactMatchCount: 0,
      repositoryMismatchCount: 0,
      extractionMethodCounts: {},
      reviewStatusCounts: {},
      allCurrentRecordsAgentAssistedUnreviewed: false,
    },
    bindingBoundary: {
      status: "rejected",
      catalogReportSha256: null,
      occurrenceCount: 0,
      ittoAuthenticated: false,
      keqingEquipmentDurableMatchesCurrent: false,
      keqingRolePairDurableMatchesCurrent: false,
      kleeSourceLocalDurableMatchesCurrent: false,
      dionaSourceLocalDurableMatchesCurrent: false,
      keqingEquipmentAtomicClaimCount: 0,
      kleeSourceLocalOccurrenceCount: 0,
      dionaSourceLocalOccurrenceCount: 0,
      exactTextAcknowledgementOccurrenceCount: 0,
      typedBindingMeansConditionTruth: false,
    },
    occurrences: [],
    nonStructuralUniqueBindingStatusSets: [],
    summary: emptySummary(),
    issues: [
      {
        code: "manual-condition-coverage.authentication-failed",
        path: "input",
        message,
      },
    ],
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

function emptySummary(): ManualConditionCoverageSummary {
  const empty = arrayStatistics([]);
  return {
    total: empty,
    bindingCoverage: bindingCoverageStatistics([]),
    nonStructuralBindingCoverage: bindingCoverageStatistics([]),
    energyCoverage: {
      structuralEr: empty,
      deferredEnergyPrerequisite: empty,
      exactAuthoredEnergyRelatedDeferral: empty,
      notEnergyDeferred: empty,
      energyUnclassified: empty,
      unconditional: empty,
      deferredDisplay: empty,
    },
    displayStatusCounts: countDisplayStatuses([]),
    nonStructuralUniqueBindingArrayCoverage: {
      uniqueExactArrayCount: 0,
      typedOnlyCount: 0,
      unboundOnlyCount: 0,
      mixedAcknowledgedAndUnboundCount: 0,
      otherMixedCount: 0,
    },
    bySource: [],
    byRecordKind: [],
    bySubject: [],
  };
}

function countValues(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => compareText(left, right)),
  );
}

function assertExactSet(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  if (new Set(actual).size !== actual.length) {
    throw new Error(`${label} contains duplicate paths.`);
  }
  if (
    stableJson([...actual].sort(compareText)) !==
    stableJson([...expected].sort(compareText))
  ) {
    throw new Error(`${label} does not match the complete expected path set.`);
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
