import { sha256Text, stableJson } from "./io";
import type { ArtifactChoice } from "./schemas";
import type { SourceBaselineConstellationScopeComparison } from "./sourceBaselineInvestmentComparison";
import type { TeamMemberInvestment } from "./teamMemberInvestment";

export type GeneratedFromEntry = { path: string; sha256: string };

export type SourceConditionPredicateAst =
  | {
      type: "all";
      predicates: SourceConditionPredicateAst[];
    }
  | {
      type: "exact-team-roster-includes";
      characterId: string;
    }
  | {
      type: "unresolved-context";
      category:
        | "gameplay-role"
        | "gameplay-sequence"
        | "buff-coverage"
        | "investment-threshold"
        | "owned-inventory"
        | "player-preference"
        | "passive-execution"
        | "comparative-performance";
      reason: string;
    }
  | {
      type: "deferred-energy-prerequisite";
      reason: string;
    };

export type SourceConditionMapEntry = {
  sourceConditionsSha256: string;
  predicate: SourceConditionPredicateAst;
};

export type SourceConditionMap = Readonly<
  Record<string, SourceConditionMapEntry>
>;

export type SourceConditionedClaimPayload =
  | {
      type: "weapon-group";
      weaponIds: string[];
    }
  | {
      type: "artifact-group";
      artifacts: ArtifactChoice[];
    }
  | {
      type: "main-stat";
      slot: "sands" | "goblet" | "circlet";
      statIds: string[];
      priority: number | null;
      target: string | null;
    }
  | {
      type: "substat";
      statIds: string[];
      priority: number | null;
      target: string | null;
    };

export type SourceConditionedAtomicClaim = {
  claimId: string;
  catalogIndex: number;
  repositoryRecordId: string;
  sourceId: string;
  sourceRecordId: string;
  characterId: string;
  recommendation: {
    recommendationId: string;
    label: string | null;
    scope: string;
    roles: string[];
    ordering: "unranked" | "ranked-groups" | null;
    classification:
      | "default"
      | "recommended"
      | "alternative"
      | "conditional"
      | "available-only"
      | null;
    grouping: "single" | "alternatives" | "tied" | null;
    sourceIndex: number;
  };
  payload: SourceConditionedClaimPayload;
  sourceConditions: string[];
  sourceConditionsSha256: string;
  predicate: SourceConditionPredicateAst;
};

export type SourceConditionedGuidePacketSourceBoundary = {
  sourceId: string;
  pageUrl: string;
  sourceVersion: string;
  rawManualSourceRecordIds: string[];
  consolidatedGuideRecordIds: string[];
  templateRecordId: string;
  exactTeamRecordIds: string[];
  extractionMethod: string;
  reviewStatus: string;
  sourceRegistryStatus: string;
  sourceRegistryPermission: string;
  repositoryRecordStatus: string;
  promotionEligible: false;
  sourceHashes: GeneratedFromEntry[];
};

export type SourceConditionedGuidePacketPolicyBoundary = {
  crossRecordJoinOwner: "guide-factory-wrapper";
  sourceAuthoredCrossRecordJoin: false;
  conditionResolutionPolicy:
    | "pinned-exact-condition-array-hash-to-typed-predicate-map";
  arbitraryEnglishParsingAllowed: false;
  conditionMap: Record<string, SourceConditionMapEntry>;
  conditionMapSha256: string;
  allowedStructuredFacts: [
    "exact-source-team-roster",
    "exact-catalog-identity",
    "source-and-baseline-constellation-scope",
  ];
  disallowedStructuredFacts: [
    "gameplay-sequence",
    "account-inventory",
    "player-preference",
  ];
  investmentComparisonScope: "constellation-only";
  talentLevelsEvaluated: false;
};

export type SourceTeamPacketInput = {
  packetIndex: number;
  teamRecordId: string;
  sourceId: string;
  sourceRecordId: string;
  label: string | null;
  intent: "example" | "prescriptive";
  exhaustiveness: "non-exhaustive" | "exhaustive" | "unspecified";
  rankingClaim: "none" | "ordered" | "unordered";
  members: Array<{
    characterId: string;
    /** Exact investment fields present in the manual source record. */
    rawSourceInvestment: {
      constellation?: number;
      minConstellation?: number;
      maxConstellation?: number;
    };
    /** Schema-normalized repository representation of those source fields. */
    investment: TeamMemberInvestment;
  }>;
  unknowns: string[];
  templateStructuralResult: {
    templateId: string;
    representation:
      | "structural-runtime-representation-not-gameplay-proof";
    declaredReactions: string[];
    reactionGate: "TeamMeta.hasReaction";
    actualOutcome:
      | "accepted"
      | "reaction-rejected"
      | "structural-rejected"
      | "template-withheld"
      | "template-not-comparable"
      | "invalid-target";
    structuralMembership: boolean | null;
    acceptedMembership: boolean | null;
    structuralAssignmentMultiplicity: number | null;
    reactionById: Record<string, boolean> | null;
    runtimeGateExecutedForStructuralCandidates: boolean;
    supportsGameplayProof: false;
  };
  presetOverlap:
    | {
        rosterStatus: "uncovered";
        presetTeamId: null;
        rosterComparison: "exact-unordered-character-ids";
        investmentStatus: "not-evaluated-roster-uncovered";
        memberInvestmentComparisons: [];
      }
    | {
        rosterStatus: "present";
        presetTeamId: string;
        rosterComparison: "exact-unordered-character-ids";
        investmentStatus:
          | "guaranteed"
          | "unresolved"
          | "conflict";
        memberInvestmentComparisons: Array<{
          characterId: string;
          comparison: SourceBaselineConstellationScopeComparison;
        }>;
      };
};

export type SourceConditionPredicateRow = {
  predicatePath: string;
  predicateType: Exclude<SourceConditionPredicateAst["type"], "all">;
  structuredFact:
    | "exact-source-team-roster"
    | "none-unresolved-context"
    | "none-deferred-energy";
  result: "true" | "false" | "unknown" | "deferred";
  reason: string;
};

export type SourceConditionCellResolution =
  | "matched"
  | "inapplicable"
  | "unresolved-context"
  | "deferred-omitted-energy-prerequisite";

export type SourceConditionedClaimCell = {
  claimId: string;
  sourceConditionsSha256: string;
  predicateRows: SourceConditionPredicateRow[];
  resolution: SourceConditionCellResolution;
  reason: string;
};

export type SourceConditionedTeamPacket = Omit<
  SourceTeamPacketInput,
  "packetIndex"
> & {
  packetIndex: number;
  claimCells: SourceConditionedClaimCell[];
  partitions: {
    matchedClaimIds: string[];
    unresolvedClaimIds: string[];
    deferredEnergyClaimIds: string[];
    inapplicableClaimIds: string[];
  };
};

export type SourceConditionedGuidePacketIssue = {
  code: string;
  path: string;
  message: string;
};

export type SourceConditionedGuidePacketReport = {
  schemaVersion: 1;
  reportType: "source-conditioned-guide-packet-report";
  experimentId: string;
  classification: "descriptive-cross-record-source-claim-projection";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-source";
  supportsGuideClaims: false;
  playerFacingRecommendations: false;
  ranking: false;
  damage: false;
  optimality: false;
  formulas: false;
  rotations: false;
  ER: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  damageComputationExecuted: false;
  energyRecoveryInputsUsed: false;
  baselineEquipmentUsed: false;
  axesMultipliedIntoBuilds: false;
  generatedFrom: GeneratedFromEntry[];
  sourceBoundary: SourceConditionedGuidePacketSourceBoundary;
  policyBoundary: SourceConditionedGuidePacketPolicyBoundary;
  sourceClaimCatalog: SourceConditionedAtomicClaim[];
  teamPackets: SourceConditionedTeamPacket[];
  summary: {
    packetCount: number;
    sourceClaimCount: number;
    claimCellCount: number;
    matchedCellCount: number;
    inapplicableCellCount: number;
    withheldCellCount: number;
    unresolvedCellCount: number;
    deferredEnergyCellCount: number;
    templateAcceptedPacketCount: number;
    templateRejectedPacketCount: number;
    presetRosterPresentPacketCount: number;
    presetRosterUncoveredPacketCount: number;
    investmentGuaranteedPacketCount: number;
    investmentUnresolvedPacketCount: number;
    investmentConflictPacketCount: number;
    assembledBuildCount: 0;
  };
  issues: SourceConditionedGuidePacketIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
};

export interface SourceConditionedGuidePacketInput {
  experimentId: string;
  generatedFrom: readonly GeneratedFromEntry[];
  sourceBoundary: SourceConditionedGuidePacketSourceBoundary;
  policyBoundary: Omit<
    SourceConditionedGuidePacketPolicyBoundary,
    "conditionMap" | "conditionMapSha256"
  > & {
    conditionMap: SourceConditionMap;
  };
  sourceClaimCatalog: readonly SourceConditionedAtomicClaim[];
  teamPackets: readonly SourceTeamPacketInput[];
  expectedCounts?: {
    packetCount: number;
    sourceClaimCount: number;
    claimCellCount: number;
  };
  prevalidationIssues?: readonly SourceConditionedGuidePacketIssue[];
  cautions: readonly string[];
  prohibitedInterpretations: readonly string[];
}

export type SourceConditionedGuidePacketAuthentication =
  | {
      authenticated: true;
      canonicalReport: SourceConditionedGuidePacketReport;
    }
  | {
      authenticated: false;
      reason:
        | "canonical-inputs-not-comparable"
        | "serialized-report-mismatch";
      issues: SourceConditionedGuidePacketIssue[];
    };

/**
 * Project pinned source conditions over exact source-team facts. This generic
 * core intentionally has no source-text parser and no gameplay evaluator.
 */
export function buildSourceConditionedGuidePacketReport(
  input: SourceConditionedGuidePacketInput,
): SourceConditionedGuidePacketReport {
  const issues = validateInput(input);
  const conditionMap = canonicalConditionMap(input.policyBoundary.conditionMap);
  const generatedFrom = canonicalGeneratedFrom(input.generatedFrom);
  const policyBoundary: SourceConditionedGuidePacketPolicyBoundary = {
    ...input.policyBoundary,
    conditionMap,
    conditionMapSha256: sha256Text(stableJson(conditionMap)),
  };
  const base = {
    schemaVersion: 1 as const,
    reportType: "source-conditioned-guide-packet-report" as const,
    experimentId: input.experimentId,
    classification:
      "descriptive-cross-record-source-claim-projection" as const,
    publicationStatus: "withheld-unreviewed-source" as const,
    supportsGuideClaims: false as const,
    playerFacingRecommendations: false as const,
    ranking: false as const,
    damage: false as const,
    optimality: false as const,
    formulas: false as const,
    rotations: false as const,
    ER: false as const,
    generatorExecuted: false as const,
    optimizerExecuted: false as const,
    damageComputationExecuted: false as const,
    energyRecoveryInputsUsed: false as const,
    baselineEquipmentUsed: false as const,
    axesMultipliedIntoBuilds: false as const,
    generatedFrom,
    sourceBoundary: structuredClone(input.sourceBoundary),
    policyBoundary,
    cautions: [...input.cautions],
    prohibitedInterpretations: [...input.prohibitedInterpretations],
  };

  if (issues.length > 0) {
    return {
      ...base,
      comparisonStatus: "not-comparable",
      sourceClaimCatalog: [],
      teamPackets: [],
      summary: emptySummary(),
      issues,
    };
  }

  const claims = [...input.sourceClaimCatalog]
    .sort((left, right) => left.catalogIndex - right.catalogIndex)
    .map((claim) => structuredClone(claim));
  const packets = [...input.teamPackets]
    .sort((left, right) => left.packetIndex - right.packetIndex)
    .map((packet) => buildPacket(packet, claims));
  return {
    ...base,
    comparisonStatus: "comparable",
    sourceClaimCatalog: claims,
    teamPackets: packets,
    summary: summarize(packets, claims.length),
    issues: [],
  };
}

/** Rebuild from typed inputs before trusting a durable serialized report. */
export function authenticateSourceConditionedGuidePacketReport(
  serializedReport: SourceConditionedGuidePacketReport,
  input: SourceConditionedGuidePacketInput,
): SourceConditionedGuidePacketAuthentication {
  const canonicalReport = buildSourceConditionedGuidePacketReport(input);
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
          code: "authentication.serialized_report_mismatch",
          path: "serializedReport",
          message:
            "The serialized packet report does not exactly match the canonical report rebuilt from current typed inputs and hashes.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

function buildPacket(
  input: SourceTeamPacketInput,
  claims: readonly SourceConditionedAtomicClaim[],
): SourceConditionedTeamPacket {
  const roster = new Set(input.members.map(({ characterId }) => characterId));
  const claimCells = claims.map((claim) => {
    const predicateRows: SourceConditionPredicateRow[] = [];
    evaluatePredicate(claim.predicate, roster, "predicate", predicateRows);
    const resolution = aggregateRows(predicateRows);
    return {
      claimId: claim.claimId,
      sourceConditionsSha256: claim.sourceConditionsSha256,
      predicateRows,
      resolution,
      reason: aggregateReason(resolution, predicateRows),
    };
  });
  return {
    ...structuredClone(input),
    claimCells,
    partitions: {
      matchedClaimIds: partition(claimCells, "matched"),
      unresolvedClaimIds: partition(claimCells, "unresolved-context"),
      deferredEnergyClaimIds: partition(
        claimCells,
        "deferred-omitted-energy-prerequisite",
      ),
      inapplicableClaimIds: partition(claimCells, "inapplicable"),
    },
  };
}

function evaluatePredicate(
  predicate: SourceConditionPredicateAst,
  roster: ReadonlySet<string>,
  path: string,
  rows: SourceConditionPredicateRow[],
): void {
  if (predicate.type === "all") {
    predicate.predicates.forEach((nested, index) =>
      evaluatePredicate(nested, roster, `${path}.predicates[${index}]`, rows),
    );
    return;
  }
  if (predicate.type === "exact-team-roster-includes") {
    const included = roster.has(predicate.characterId);
    rows.push({
      predicatePath: path,
      predicateType: predicate.type,
      structuredFact: "exact-source-team-roster",
      result: included ? "true" : "false",
      reason: included
        ? `Exact source-team roster includes ${predicate.characterId}.`
        : `Exact source-team roster does not include ${predicate.characterId}.`,
    });
    return;
  }
  if (predicate.type === "deferred-energy-prerequisite") {
    rows.push({
      predicatePath: path,
      predicateType: predicate.type,
      structuredFact: "none-deferred-energy",
      result: "deferred",
      reason: predicate.reason,
    });
    return;
  }
  rows.push({
    predicatePath: path,
    predicateType: predicate.type,
    structuredFact: "none-unresolved-context",
    result: "unknown",
    reason: predicate.reason,
  });
}

function aggregateRows(
  rows: readonly SourceConditionPredicateRow[],
): SourceConditionCellResolution {
  // Deliberate conjunction precedence: false > deferred > unknown > true.
  if (rows.some(({ result }) => result === "false")) return "inapplicable";
  if (rows.some(({ result }) => result === "deferred")) {
    return "deferred-omitted-energy-prerequisite";
  }
  if (rows.some(({ result }) => result === "unknown")) {
    return "unresolved-context";
  }
  return "matched";
}

function aggregateReason(
  resolution: SourceConditionCellResolution,
  rows: readonly SourceConditionPredicateRow[],
): string {
  const selectedResult =
    resolution === "inapplicable"
      ? "false"
      : resolution === "deferred-omitted-energy-prerequisite"
        ? "deferred"
        : resolution === "unresolved-context"
          ? "unknown"
          : "true";
  return rows
    .filter(({ result }) => result === selectedResult)
    .map(({ reason }) => reason)
    .join(" ");
}

function partition(
  cells: readonly SourceConditionedClaimCell[],
  resolution: SourceConditionCellResolution,
): string[] {
  return cells
    .filter((cell) => cell.resolution === resolution)
    .map(({ claimId }) => claimId);
}

function summarize(
  packets: readonly SourceConditionedTeamPacket[],
  sourceClaimCount: number,
): SourceConditionedGuidePacketReport["summary"] {
  const cells = packets.flatMap(({ claimCells }) => claimCells);
  return {
    packetCount: packets.length,
    sourceClaimCount,
    claimCellCount: cells.length,
    matchedCellCount: countCells(cells, "matched"),
    inapplicableCellCount: countCells(cells, "inapplicable"),
    withheldCellCount:
      countCells(cells, "unresolved-context") +
      countCells(cells, "deferred-omitted-energy-prerequisite"),
    unresolvedCellCount: countCells(cells, "unresolved-context"),
    deferredEnergyCellCount: countCells(
      cells,
      "deferred-omitted-energy-prerequisite",
    ),
    templateAcceptedPacketCount: packets.filter(
      ({ templateStructuralResult }) =>
        templateStructuralResult.actualOutcome === "accepted",
    ).length,
    templateRejectedPacketCount: packets.filter(
      ({ templateStructuralResult }) =>
        templateStructuralResult.actualOutcome !== "accepted",
    ).length,
    presetRosterPresentPacketCount: packets.filter(
      ({ presetOverlap }) => presetOverlap.rosterStatus === "present",
    ).length,
    presetRosterUncoveredPacketCount: packets.filter(
      ({ presetOverlap }) => presetOverlap.rosterStatus === "uncovered",
    ).length,
    investmentGuaranteedPacketCount: packets.filter(
      ({ presetOverlap }) =>
        presetOverlap.rosterStatus === "present" &&
        presetOverlap.investmentStatus === "guaranteed",
    ).length,
    investmentUnresolvedPacketCount: packets.filter(
      ({ presetOverlap }) =>
        presetOverlap.rosterStatus === "present" &&
        presetOverlap.investmentStatus === "unresolved",
    ).length,
    investmentConflictPacketCount: packets.filter(
      ({ presetOverlap }) =>
        presetOverlap.rosterStatus === "present" &&
        presetOverlap.investmentStatus === "conflict",
    ).length,
    assembledBuildCount: 0,
  };
}

function emptySummary(): SourceConditionedGuidePacketReport["summary"] {
  return {
    packetCount: 0,
    sourceClaimCount: 0,
    claimCellCount: 0,
    matchedCellCount: 0,
    inapplicableCellCount: 0,
    withheldCellCount: 0,
    unresolvedCellCount: 0,
    deferredEnergyCellCount: 0,
    templateAcceptedPacketCount: 0,
    templateRejectedPacketCount: 0,
    presetRosterPresentPacketCount: 0,
    presetRosterUncoveredPacketCount: 0,
    investmentGuaranteedPacketCount: 0,
    investmentUnresolvedPacketCount: 0,
    investmentConflictPacketCount: 0,
    assembledBuildCount: 0,
  };
}

function countCells(
  cells: readonly SourceConditionedClaimCell[],
  resolution: SourceConditionCellResolution,
): number {
  return cells.filter((cell) => cell.resolution === resolution).length;
}

function validateInput(
  input: SourceConditionedGuidePacketInput,
): SourceConditionedGuidePacketIssue[] {
  const issues: SourceConditionedGuidePacketIssue[] =
    input.prevalidationIssues?.map((issue) => ({ ...issue })) ?? [];
  if (input.experimentId.length === 0) {
    issue("input.invalid_experiment_id", "experimentId", "Experiment ID is empty.");
  }
  validateGeneratedFrom(input.generatedFrom, issues);
  validateSourceBoundaryHashes(
    input.sourceBoundary.sourceHashes,
    input.generatedFrom,
    issues,
  );
  validateClaimsAndMap(
    input.sourceClaimCatalog,
    input.policyBoundary.conditionMap,
    issues,
  );
  validatePackets(input.teamPackets, issues);
  if (input.expectedCounts) {
    const actualCellCount =
      input.sourceClaimCatalog.length * input.teamPackets.length;
    if (input.teamPackets.length !== input.expectedCounts.packetCount) {
      issue(
        "input.packet_count_mismatch",
        "teamPackets",
        `Expected ${input.expectedCounts.packetCount} packets, found ${input.teamPackets.length}.`,
      );
    }
    if (
      input.sourceClaimCatalog.length !== input.expectedCounts.sourceClaimCount
    ) {
      issue(
        "input.claim_count_mismatch",
        "sourceClaimCatalog",
        `Expected ${input.expectedCounts.sourceClaimCount} claims, found ${input.sourceClaimCatalog.length}.`,
      );
    }
    if (actualCellCount !== input.expectedCounts.claimCellCount) {
      issue(
        "input.cell_count_mismatch",
        "teamPackets",
        `Expected ${input.expectedCounts.claimCellCount} claim cells, projected ${actualCellCount}.`,
      );
    }
  }
  return issues.sort((left, right) =>
    `${left.path}\0${left.code}`.localeCompare(`${right.path}\0${right.code}`),
  );

  function issue(code: string, path: string, message: string): void {
    issues.push({ code, path, message });
  }
}

function validateGeneratedFrom(
  entries: readonly GeneratedFromEntry[],
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const paths = new Set<string>();
  entries.forEach((entry, index) => {
    if (entry.path.length === 0 || paths.has(entry.path)) {
      issues.push({
        code: "input.invalid_generated_from_path",
        path: `generatedFrom[${index}].path`,
        message: "generatedFrom paths must be non-empty and unique.",
      });
    }
    paths.add(entry.path);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) {
      issues.push({
        code: "input.invalid_generated_from_hash",
        path: `generatedFrom[${index}].sha256`,
        message: "generatedFrom hashes must be lowercase SHA-256 values.",
      });
    }
  });
}

function validateSourceBoundaryHashes(
  sourceHashes: readonly GeneratedFromEntry[],
  generatedFrom: readonly GeneratedFromEntry[],
  issues: SourceConditionedGuidePacketIssue[],
): void {
  if (sourceHashes.length === 0) {
    issues.push({
      code: "input.missing_source_boundary_hashes",
      path: "sourceBoundary.sourceHashes",
      message: "Source boundary must authenticate at least one source input.",
    });
    return;
  }
  const seenPaths = new Set<string>();
  sourceHashes.forEach((sourceHash, index) => {
    const path = `sourceBoundary.sourceHashes[${index}]`;
    if (seenPaths.has(sourceHash.path)) {
      issues.push({
        code: "input.duplicate_source_boundary_hash_path",
        path: `${path}.path`,
        message: `Source boundary path ${sourceHash.path} occurs more than once.`,
      });
    }
    seenPaths.add(sourceHash.path);
    const generatedMatches = generatedFrom.filter(
      (entry) => entry.path === sourceHash.path,
    );
    if (generatedMatches.length !== 1 || !generatedMatches[0]) {
      issues.push({
        code: "input.source_boundary_path_not_authenticated",
        path: `${path}.path`,
        message:
          "Every source-boundary path must occur exactly once in generatedFrom.",
      });
      return;
    }
    if (generatedMatches[0].sha256 !== sourceHash.sha256) {
      issues.push({
        code: "input.source_boundary_hash_mismatch",
        path: `${path}.sha256`,
        message:
          "Source-boundary hash does not match the authenticated generatedFrom entry.",
      });
    }
  });
}

function validateClaimsAndMap(
  claims: readonly SourceConditionedAtomicClaim[],
  conditionMap: SourceConditionMap,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const claimIds = new Set<string>();
  const indexes = new Set<number>();
  claims.forEach((claim, index) => {
    const path = `sourceClaimCatalog[${index}]`;
    if (claimIds.has(claim.claimId) || claim.claimId.length === 0) {
      issues.push({
        code: "input.duplicate_or_empty_claim_id",
        path: `${path}.claimId`,
        message: "Claim IDs must be non-empty and unique.",
      });
    }
    claimIds.add(claim.claimId);
    if (
      !Number.isSafeInteger(claim.catalogIndex) ||
      claim.catalogIndex < 0 ||
      indexes.has(claim.catalogIndex)
    ) {
      issues.push({
        code: "input.invalid_claim_index",
        path: `${path}.catalogIndex`,
        message: "Claim catalog indexes must be unique non-negative integers.",
      });
    }
    indexes.add(claim.catalogIndex);
    const computedHash = sha256Text(stableJson(claim.sourceConditions));
    if (claim.sourceConditionsSha256 !== computedHash) {
      issues.push({
        code: "input.claim_condition_hash_mismatch",
        path: `${path}.sourceConditionsSha256`,
        message: "Claim condition hash does not match its exact condition array.",
      });
    }
    const mapped = conditionMap[claim.claimId];
    if (!mapped) {
      issues.push({
        code: "input.missing_condition_map_entry",
        path: `policyBoundary.conditionMap.${claim.claimId}`,
        message: "Every atomic claim requires one pinned condition-map entry.",
      });
      return;
    }
    if (mapped.sourceConditionsSha256 !== computedHash) {
      issues.push({
        code: "input.condition_map_hash_mismatch",
        path: `policyBoundary.conditionMap.${claim.claimId}.sourceConditionsSha256`,
        message:
          "Pinned condition-map hash does not match the claim's exact condition array.",
      });
    }
    if (stableJson(mapped.predicate) !== stableJson(claim.predicate)) {
      issues.push({
        code: "input.condition_map_predicate_mismatch",
        path: `policyBoundary.conditionMap.${claim.claimId}.predicate`,
        message: "Claim predicate differs from its pinned condition-map predicate.",
      });
    }
    validatePredicate(mapped.predicate, `${path}.predicate`, issues);
  });
  for (const claimId of Object.keys(conditionMap)) {
    if (!claimIds.has(claimId)) {
      issues.push({
        code: "input.extra_condition_map_entry",
        path: `policyBoundary.conditionMap.${claimId}`,
        message: "Condition map contains an entry for no atomic source claim.",
      });
    }
  }
  if (
    indexes.size === claims.length &&
    [...indexes].some((value) => value >= claims.length)
  ) {
    issues.push({
      code: "input.non_contiguous_claim_indexes",
      path: "sourceClaimCatalog",
      message: "Claim catalog indexes must form the contiguous range 0..N-1.",
    });
  }
}

function validatePredicate(
  predicate: unknown,
  path: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  if (!isRecord(predicate) || typeof predicate.type !== "string") {
    issues.push({
      code: "input.invalid_condition_predicate",
      path,
      message: "Condition predicate must be a supported typed predicate.",
    });
    return;
  }
  if (predicate.type === "all") {
    if (
      !Array.isArray(predicate.predicates) ||
      predicate.predicates.length === 0
    ) {
      issues.push({
        code: "input.empty_condition_conjunction",
        path: `${path}.predicates`,
        message: "Condition conjunctions must contain at least one predicate.",
      });
      return;
    }
    predicate.predicates.forEach((nested, index) =>
      validatePredicate(nested, `${path}.predicates[${index}]`, issues),
    );
    return;
  }
  if (predicate.type === "exact-team-roster-includes") {
    if (
      typeof predicate.characterId !== "string" ||
      predicate.characterId.length === 0
    ) {
      issues.push({
        code: "input.invalid_roster_predicate",
        path: `${path}.characterId`,
        message: "Roster predicates require a character ID.",
      });
    }
    return;
  }
  if (predicate.type === "unresolved-context") {
    const categories = new Set([
      "gameplay-role",
      "gameplay-sequence",
      "buff-coverage",
      "investment-threshold",
      "owned-inventory",
      "player-preference",
      "passive-execution",
      "comparative-performance",
    ]);
    if (
      typeof predicate.category !== "string" ||
      !categories.has(predicate.category)
    ) {
      issues.push({
        code: "input.invalid_unresolved_category",
        path: `${path}.category`,
        message: "Unresolved predicates require a supported context category.",
      });
    }
    validatePredicateReason(predicate.reason, path, issues);
    return;
  }
  if (predicate.type === "deferred-energy-prerequisite") {
    validatePredicateReason(predicate.reason, path, issues);
    return;
  }
  issues.push({
    code: "input.unsupported_condition_predicate",
    path: `${path}.type`,
    message: `Unsupported condition predicate type ${predicate.type}.`,
  });
}

function validatePredicateReason(
  reason: unknown,
  path: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  if (typeof reason !== "string" || reason.length === 0) {
    issues.push({
      code: "input.invalid_predicate_reason",
      path: `${path}.reason`,
      message: "Unresolved and deferred predicates require an explicit reason.",
    });
  }
}

function validatePackets(
  packets: readonly SourceTeamPacketInput[],
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const teamIds = new Set<string>();
  const indexes = new Set<number>();
  packets.forEach((packet, index) => {
    const path = `teamPackets[${index}]`;
    if (teamIds.has(packet.teamRecordId) || packet.teamRecordId.length === 0) {
      issues.push({
        code: "input.duplicate_or_empty_team_id",
        path: `${path}.teamRecordId`,
        message: "Team record IDs must be non-empty and unique.",
      });
    }
    teamIds.add(packet.teamRecordId);
    if (
      !Number.isSafeInteger(packet.packetIndex) ||
      packet.packetIndex < 0 ||
      indexes.has(packet.packetIndex)
    ) {
      issues.push({
        code: "input.invalid_packet_index",
        path: `${path}.packetIndex`,
        message: "Packet indexes must be unique non-negative integers.",
      });
    }
    indexes.add(packet.packetIndex);
    const members = packet.members.map(({ characterId }) => characterId);
    if (members.length !== 4 || new Set(members).size !== 4) {
      issues.push({
        code: "input.invalid_exact_team_roster",
        path: `${path}.members`,
        message: "Each source packet must contain four distinct characters.",
      });
    }
  });
  if (
    indexes.size === packets.length &&
    [...indexes].some((value) => value >= packets.length)
  ) {
    issues.push({
      code: "input.non_contiguous_packet_indexes",
      path: "teamPackets",
      message: "Packet indexes must form the contiguous range 0..N-1.",
    });
  }
}

function canonicalConditionMap(
  input: SourceConditionMap,
): Record<string, SourceConditionMapEntry> {
  return Object.fromEntries(
    Object.entries(input)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([claimId, entry]) => [claimId, structuredClone(entry)]),
  );
}

function canonicalGeneratedFrom(
  entries: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  return [...entries]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
