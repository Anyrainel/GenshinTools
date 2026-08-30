import type {
  SourceConditionCellResolution,
  SourceConditionedClaimCell,
  SourceConditionedGuidePacketIssue,
  SourceConditionedGuidePacketReport,
  SourceConditionPredicateAst,
  SourceConditionPredicateRow,
} from "./sourceConditionedGuidePacket";
import { sha256Text, stableJson } from "./io";

export type GuideRequestContext = {
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
              constellation?: number;
              talentLevels?: {
                auto?: number;
                skill?: number;
                burst?: number;
              };
            }
          >
        >;
        acquisitionPreference?: string;
        passiveExecutionAssumptions?: Readonly<Record<string, boolean>>;
      }
    >
  >;
  accountFacts?: {
    snapshotId: string;
    weaponInventory?: {
      domain: "complete" | "incomplete";
      weaponIds: readonly string[];
    };
  };
};

export type GuideRequestContextPredicateAst =
  | {
      type: "all";
      predicates: GuideRequestContextPredicateAst[];
    }
  | {
      type: "any";
      predicates: GuideRequestContextPredicateAst[];
    }
  | { type: "intended-role-is"; characterId: string; roleId: string }
  | { type: "optimization-goal-is"; characterId: string; goalId: string }
  | {
      type: "constellation-at-least";
      characterId: string;
      threshold: number;
    }
  | {
      type: "constellation-at-most";
      characterId: string;
      threshold: number;
    }
  | {
      type: "talent-level-at-least";
      characterId: string;
      talent: "auto" | "skill" | "burst";
      threshold: number;
    }
  | {
      type: "talent-level-is";
      characterId: string;
      talent: "auto" | "skill" | "burst";
      threshold: number;
    }
  | { type: "acquisition-preference-is"; preferenceId: string }
  | { type: "weapon-inventory-includes"; weaponId: string }
  | {
      type: "passive-execution-is";
      assumptionId: string;
      expected: boolean;
    };

export type GuideRequestClaimRule = {
  claimId: string;
  sourceConditionsSha256: string;
  sourcePredicateSha256: string;
  bindings: Array<{
    /** Must name an `unresolved-context` leaf in the source predicate tree. */
    sourcePredicatePath: string;
    sourcePredicateLeafSha256: string;
    requestPredicate: GuideRequestContextPredicateAst;
  }>;
};

export type GuideRequestContextPredicateRow = {
  predicatePath: string;
  predicateType: Exclude<GuideRequestContextPredicateAst["type"], "all" | "any">;
  factProvenance: "request" | "request-assumption" | "account";
  factScope: {
    teamRecordId: string | null;
    characterId: string | null;
    accountSnapshotId: string | null;
  };
  result: "true" | "false" | "unknown";
  reason: string;
};

export type GuideRequestContextBindingEvaluation = {
  sourcePredicatePath: string;
  sourceContextCategory: Extract<
    SourceConditionPredicateAst,
    { type: "unresolved-context" }
  >["category"];
  requestPredicate: GuideRequestContextPredicateAst;
  predicateRows: GuideRequestContextPredicateRow[];
  result: "true" | "false" | "unknown";
  reason: string;
};

export type GuideRequestContextClaimProjection = {
  claimId: string;
  sourceControl: {
    resolution: SourceConditionCellResolution;
    sourceConditionsSha256: string;
    predicateRowsSha256: string;
    predicateRows: SourceConditionPredicateRow[];
    reason: string;
  };
  requestContextBindings: GuideRequestContextBindingEvaluation[];
  resolution: SourceConditionCellResolution;
  contextApplicability:
    | "source-already-matched"
    | "source-definitely-inapplicable"
    | "applicable-under-supplied-context"
    | "not-applicable-under-supplied-context"
    | "still-unresolved"
    | "deferred-energy-unchanged";
  reason: string;
};

export type GuideRequestContextApplicabilityReport = {
  schemaVersion: 1;
  reportType: "guide-request-context-applicability";
  projectionId: string;
  classification: "request-account-context-refinement-overlay";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-experimental-context";
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsAccountAdvice: false;
  playerFacingRecommendations: false;
  ranking: false;
  buildComposition: false;
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
  contextProjectionExecuted: true;
  sourceCellsMutated: false;
  policyBoundary: {
    sourceControlPreserved: true;
    requestContextMayResolveOnlyMappedUnresolvedContext: true;
    requestContextMaySatisfyExactSourceTeamFacts: false;
    omittedFacts: "unknown";
    missingWeaponInCompleteInventory: "false";
    missingWeaponInIncompleteInventory: "unknown";
  };
  factProvenance: {
    intendedRole: "request";
    optimizationGoal: "request";
    constellation: "request";
    talentLevels: "request";
    acquisitionPreference: "request";
    passiveExecutionAssumptions: "request-assumption";
    weaponInventory: "account";
  };
  sourceControl: {
    reportType: "source-conditioned-guide-packet-report";
    experimentId: string;
    comparisonStatus: "comparable" | "not-comparable";
    packetCount: number;
    sourceClaimCount: number;
    claimCellCount: number;
  };
  context: GuideRequestContext;
  claimRules: GuideRequestClaimRule[];
  teamProjections: Array<{
    packetIndex: number;
    teamRecordId: string;
    claimProjections: GuideRequestContextClaimProjection[];
  }>;
  summary: {
    packetCount: number;
    sourceClaimCount: number;
    claimCellCount: number;
    matchedCellCount: number;
    inapplicableCellCount: number;
    withheldCellCount: number;
    unresolvedCellCount: number;
    deferredEnergyCellCount: number;
    assembledBuildCount: 0;
  };
  issues: SourceConditionedGuidePacketIssue[];
};

export type GuideRequestContextApplicabilityInput = {
  projectionId: string;
  sourceReport: SourceConditionedGuidePacketReport;
  context: GuideRequestContext;
  claimRules: readonly GuideRequestClaimRule[];
};

type RequestPredicateEvaluation = {
  result: "true" | "false" | "unknown";
  rows: GuideRequestContextPredicateRow[];
  reason: string;
};

type EffectiveRow = {
  result: "true" | "false" | "unknown" | "deferred";
  reason: string;
};

const CAPABILITY_BOUNDARY = {
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsAccountAdvice: false,
  playerFacingRecommendations: false,
  ranking: false,
  buildComposition: false,
  damage: false,
  optimality: false,
  formulas: false,
  rotations: false,
  ER: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  damageComputationExecuted: false,
  energyRecoveryInputsUsed: false,
  baselineEquipmentUsed: false,
  axesMultipliedIntoBuilds: false,
  contextProjectionExecuted: true,
  sourceCellsMutated: false,
} as const;

const POLICY_BOUNDARY = {
  sourceControlPreserved: true,
  requestContextMayResolveOnlyMappedUnresolvedContext: true,
  requestContextMaySatisfyExactSourceTeamFacts: false,
  omittedFacts: "unknown",
  missingWeaponInCompleteInventory: "false",
  missingWeaponInIncompleteInventory: "unknown",
} as const;

const FACT_PROVENANCE = {
  intendedRole: "request",
  optimizationGoal: "request",
  constellation: "request",
  talentLevels: "request",
  acquisitionPreference: "request",
  passiveExecutionAssumptions: "request-assumption",
  weaponInventory: "account",
} as const;

/**
 * Refine source-only applicability with explicit request/account facts.
 *
 * Source rows are retained verbatim. A rule may replace only a named
 * `unresolved-context` leaf for the combined resolution; exact-team and
 * deferred-energy rows always remain source-owned.
 */
export function buildGuideRequestContextApplicabilityReport(
  input: GuideRequestContextApplicabilityInput,
): GuideRequestContextApplicabilityReport {
  const context = canonicalContext(input.context);
  const claimRules = canonicalRules(input.claimRules);
  const issues = validateInput(input, context, claimRules);
  const sourceControl = {
    reportType: "source-conditioned-guide-packet-report" as const,
    experimentId: input.sourceReport.experimentId,
    comparisonStatus: input.sourceReport.comparisonStatus,
    packetCount: input.sourceReport.summary.packetCount,
    sourceClaimCount: input.sourceReport.summary.sourceClaimCount,
    claimCellCount: input.sourceReport.summary.claimCellCount,
  };
  const base = {
    schemaVersion: 1 as const,
    reportType: "guide-request-context-applicability" as const,
    projectionId: input.projectionId,
    classification: "request-account-context-refinement-overlay" as const,
    publicationStatus: "withheld-experimental-context" as const,
    ...CAPABILITY_BOUNDARY,
    policyBoundary: POLICY_BOUNDARY,
    factProvenance: FACT_PROVENANCE,
    sourceControl,
    context,
    claimRules,
  };

  if (issues.length > 0) {
    return {
      ...base,
      comparisonStatus: "not-comparable",
      teamProjections: [],
      summary: emptySummary(),
      issues,
    };
  }

  const rulesByClaimId = new Map(
    claimRules.map((rule) => [rule.claimId, rule]),
  );
  const claimsById = new Map(
    input.sourceReport.sourceClaimCatalog.map((claim) => [claim.claimId, claim]),
  );
  const teamProjections = input.sourceReport.teamPackets.map((packet) => ({
    packetIndex: packet.packetIndex,
    teamRecordId: packet.teamRecordId,
    claimProjections: packet.claimCells.map((sourceCell) => {
      const claim = claimsById.get(sourceCell.claimId);
      if (!claim) {
        throw new Error(`Comparable source report lost claim ${sourceCell.claimId}.`);
      }
      return projectClaim(
        sourceCell,
        claim.predicate,
        rulesByClaimId.get(sourceCell.claimId),
        context,
        packet.teamRecordId,
      );
    }),
  }));
  const cells = teamProjections.flatMap(({ claimProjections }) => claimProjections);
  return {
    ...base,
    comparisonStatus: "comparable",
    teamProjections,
    summary: summarize(teamProjections.length, claimsById.size, cells),
    issues: [],
  };
}

function projectClaim(
  sourceCell: SourceConditionedClaimCell,
  sourcePredicate: SourceConditionPredicateAst,
  rule: GuideRequestClaimRule | undefined,
  context: GuideRequestContext,
  teamRecordId: string,
): GuideRequestContextClaimProjection {
  const sourceNodes = sourcePredicateNodes(sourcePredicate);
  const evaluations = (rule?.bindings ?? []).map((binding) => {
    const sourceNode = sourceNodes.get(binding.sourcePredicatePath);
    if (!sourceNode || sourceNode.type !== "unresolved-context") {
      throw new Error(
        `Validated binding target ${binding.sourcePredicatePath} is unavailable.`,
      );
    }
    const evaluation = evaluateRequestPredicate(
      binding.requestPredicate,
      context,
      "requestPredicate",
      teamRecordId,
    );
    return {
      sourcePredicatePath: binding.sourcePredicatePath,
      sourceContextCategory: sourceNode.category,
      requestPredicate: structuredClone(binding.requestPredicate),
      predicateRows: evaluation.rows,
      result: evaluation.result,
      reason: evaluation.reason,
    };
  });
  const evaluationsByPath = new Map(
    evaluations.map((evaluation) => [evaluation.sourcePredicatePath, evaluation]),
  );
  const effectiveRows: EffectiveRow[] = sourceCell.predicateRows.map((sourceRow) => {
    const replacement = evaluationsByPath.get(sourceRow.predicatePath);
    if (!replacement) {
      return { result: sourceRow.result, reason: sourceRow.reason };
    }
    return { result: replacement.result, reason: replacement.reason };
  });
  const resolution = aggregateEffectiveRows(effectiveRows);
  return {
    claimId: sourceCell.claimId,
    sourceControl: {
      resolution: sourceCell.resolution,
      sourceConditionsSha256: sourceCell.sourceConditionsSha256,
      predicateRowsSha256: hashValue(sourceCell.predicateRows),
      predicateRows: structuredClone(sourceCell.predicateRows),
      reason: sourceCell.reason,
    },
    requestContextBindings: evaluations,
    resolution,
    contextApplicability: contextApplicability(sourceCell.resolution, resolution),
    reason: effectiveReason(resolution, effectiveRows),
  };
}

function evaluateRequestPredicate(
  predicate: GuideRequestContextPredicateAst,
  context: GuideRequestContext,
  path: string,
  teamRecordId: string,
): RequestPredicateEvaluation {
  if (predicate.type === "all" || predicate.type === "any") {
    const children = predicate.predicates.map((child, index) =>
      evaluateRequestPredicate(
        child,
        context,
        `${path}.predicates[${index}]`,
        teamRecordId,
      ),
    );
    const result =
      predicate.type === "all"
        ? aggregateAll(children.map(({ result }) => result))
        : aggregateAny(children.map(({ result }) => result));
    return {
      result,
      rows: children.flatMap(({ rows }) => rows),
      reason: compositeReason(predicate.type, result, children),
    };
  }

  const atom = evaluateRequestAtom(predicate, context, teamRecordId);
  return {
    result: atom.result,
    rows: [
      {
        predicatePath: path,
        predicateType: predicate.type,
        factProvenance: atom.factProvenance,
        factScope: atom.factScope,
        result: atom.result,
        reason: atom.reason,
      },
    ],
    reason: atom.reason,
  };
}

function evaluateRequestAtom(
  predicate: Exclude<GuideRequestContextPredicateAst, { type: "all" | "any" }>,
  context: GuideRequestContext,
  teamRecordId: string,
): {
  result: "true" | "false" | "unknown";
  factProvenance: GuideRequestContextPredicateRow["factProvenance"];
  factScope: GuideRequestContextPredicateRow["factScope"];
  reason: string;
} {
  const teamFacts = context.requestFactsByTeamRecordId?.[teamRecordId];
  if (predicate.type === "intended-role-is") {
    return compareOptionalRequestFact(
      teamFacts?.characterFactsById?.[predicate.characterId]?.intendedRole,
      predicate.roleId,
      "intended role",
      teamRecordId,
      predicate.characterId,
    );
  }
  if (predicate.type === "optimization-goal-is") {
    return compareOptionalRequestFact(
      teamFacts?.characterFactsById?.[predicate.characterId]?.optimizationGoal,
      predicate.goalId,
      "optimization goal",
      teamRecordId,
      predicate.characterId,
    );
  }
  if (predicate.type === "constellation-at-least") {
    return compareOptionalNumericRequestFact(
      teamFacts?.characterFactsById?.[predicate.characterId]?.constellation,
      predicate.threshold,
      "constellation",
      teamRecordId,
      predicate.characterId,
    );
  }
  if (predicate.type === "constellation-at-most") {
    return compareOptionalNumericRequestFact(
      teamFacts?.characterFactsById?.[predicate.characterId]?.constellation,
      predicate.threshold,
      "constellation",
      teamRecordId,
      predicate.characterId,
      "at-most",
    );
  }
  if (predicate.type === "talent-level-at-least") {
    return compareOptionalNumericRequestFact(
      teamFacts?.characterFactsById?.[predicate.characterId]?.talentLevels?.[
        predicate.talent
      ],
      predicate.threshold,
      `${predicate.talent} talent level`,
      teamRecordId,
      predicate.characterId,
    );
  }
  if (predicate.type === "talent-level-is") {
    return compareOptionalNumericRequestFact(
      teamFacts?.characterFactsById?.[predicate.characterId]?.talentLevels?.[
        predicate.talent
      ],
      predicate.threshold,
      `${predicate.talent} talent level`,
      teamRecordId,
      predicate.characterId,
      "is",
    );
  }
  if (predicate.type === "acquisition-preference-is") {
    return compareOptionalRequestFact(
      teamFacts?.acquisitionPreference,
      predicate.preferenceId,
      "acquisition preference",
      teamRecordId,
      null,
    );
  }
  if (predicate.type === "passive-execution-is") {
    const assumptions = teamFacts?.passiveExecutionAssumptions;
    if (
      !assumptions ||
      !Object.prototype.hasOwnProperty.call(assumptions, predicate.assumptionId)
    ) {
      return {
        result: "unknown",
        factProvenance: "request-assumption",
        factScope: {
          teamRecordId,
          characterId: null,
          accountSnapshotId: null,
        },
        reason: `Passive execution assumption ${predicate.assumptionId} was omitted.`,
      };
    }
    const actual = assumptions[predicate.assumptionId];
    return {
      result: actual === predicate.expected ? "true" : "false",
      factProvenance: "request-assumption",
      factScope: { teamRecordId, characterId: null, accountSnapshotId: null },
      reason:
        actual === predicate.expected
          ? `Passive execution assumption ${predicate.assumptionId} matches ${predicate.expected}.`
          : `Passive execution assumption ${predicate.assumptionId} is ${actual}, not ${predicate.expected}.`,
    };
  }

  const inventory = context.accountFacts?.weaponInventory;
  if (!inventory) {
    return {
      result: "unknown",
      factProvenance: "account",
      factScope: {
        teamRecordId: null,
        characterId: null,
        accountSnapshotId: context.accountFacts?.snapshotId ?? null,
      },
      reason: "Weapon inventory was omitted.",
    };
  }
  if (inventory.weaponIds.includes(predicate.weaponId)) {
    return {
      result: "true",
      factProvenance: "account",
      factScope: {
        teamRecordId: null,
        characterId: null,
        accountSnapshotId: context.accountFacts?.snapshotId ?? null,
      },
      reason: `Weapon inventory includes ${predicate.weaponId}.`,
    };
  }
  if (inventory.domain === "complete") {
    return {
      result: "false",
      factProvenance: "account",
      factScope: {
        teamRecordId: null,
        characterId: null,
        accountSnapshotId: context.accountFacts?.snapshotId ?? null,
      },
      reason: `Complete weapon inventory does not include ${predicate.weaponId}.`,
    };
  }
  return {
    result: "unknown",
    factProvenance: "account",
    factScope: {
      teamRecordId: null,
      characterId: null,
      accountSnapshotId: context.accountFacts?.snapshotId ?? null,
    },
    reason: `Incomplete weapon inventory does not establish absence of ${predicate.weaponId}.`,
  };
}

function compareOptionalRequestFact(
  actual: string | undefined,
  expected: string,
  label: string,
  teamRecordId: string,
  characterId: string | null,
): {
  result: "true" | "false" | "unknown";
  factProvenance: "request";
  factScope: GuideRequestContextPredicateRow["factScope"];
  reason: string;
} {
  if (actual == null) {
    return {
      result: "unknown",
      factProvenance: "request",
      factScope: { teamRecordId, characterId, accountSnapshotId: null },
      reason: `Request ${label} was omitted.`,
    };
  }
  return {
    result: actual === expected ? "true" : "false",
    factProvenance: "request",
    factScope: { teamRecordId, characterId, accountSnapshotId: null },
    reason:
      actual === expected
        ? `Request ${label} matches ${expected}.`
        : `Request ${label} is ${actual}, not ${expected}.`,
  };
}

function compareOptionalNumericRequestFact(
  actual: number | undefined,
  threshold: number,
  label: string,
  teamRecordId: string,
  characterId: string,
  comparison: "at-least" | "at-most" | "is" = "at-least",
): {
  result: "true" | "false" | "unknown";
  factProvenance: "request";
  factScope: GuideRequestContextPredicateRow["factScope"];
  reason: string;
} {
  if (actual == null) {
    return {
      result: "unknown",
      factProvenance: "request",
      factScope: { teamRecordId, characterId, accountSnapshotId: null },
      reason: `Request ${label} was omitted.`,
    };
  }
  const matches =
    comparison === "at-most"
      ? actual <= threshold
      : comparison === "is"
        ? actual === threshold
        : actual >= threshold;
  const reason =
    comparison === "at-most"
      ? matches
        ? `Request ${label} ${actual} is at or below threshold ${threshold}.`
        : `Request ${label} ${actual} is above threshold ${threshold}.`
      : comparison === "is"
        ? matches
          ? `Request ${label} ${actual} equals ${threshold}.`
          : `Request ${label} ${actual} does not equal ${threshold}.`
        : matches
          ? `Request ${label} ${actual} meets threshold ${threshold}.`
          : `Request ${label} ${actual} is below threshold ${threshold}.`;
  return {
    result: matches ? "true" : "false",
    factProvenance: "request",
    factScope: { teamRecordId, characterId, accountSnapshotId: null },
    reason,
  };
}

function aggregateAll(
  results: readonly ("true" | "false" | "unknown")[],
): "true" | "false" | "unknown" {
  if (results.some((result) => result === "false")) return "false";
  if (results.some((result) => result === "unknown")) return "unknown";
  return "true";
}

function aggregateAny(
  results: readonly ("true" | "false" | "unknown")[],
): "true" | "false" | "unknown" {
  if (results.some((result) => result === "true")) return "true";
  if (results.some((result) => result === "unknown")) return "unknown";
  return "false";
}

function compositeReason(
  type: "all" | "any",
  result: "true" | "false" | "unknown",
  children: readonly RequestPredicateEvaluation[],
): string {
  const selected =
    type === "all"
      ? result === "true"
        ? children
        : children.filter((child) => child.result === result)
      : children.filter((child) => child.result === result);
  return selected.map(({ reason }) => reason).join(" ");
}

function aggregateEffectiveRows(
  rows: readonly EffectiveRow[],
): SourceConditionCellResolution {
  if (rows.some(({ result }) => result === "false")) return "inapplicable";
  if (rows.some(({ result }) => result === "deferred")) {
    return "deferred-omitted-energy-prerequisite";
  }
  if (rows.some(({ result }) => result === "unknown")) {
    return "unresolved-context";
  }
  return "matched";
}

function contextApplicability(
  sourceResolution: SourceConditionCellResolution,
  resolution: SourceConditionCellResolution,
): GuideRequestContextClaimProjection["contextApplicability"] {
  if (sourceResolution === "matched") return "source-already-matched";
  if (sourceResolution === "inapplicable") {
    return "source-definitely-inapplicable";
  }
  if (resolution === "matched") return "applicable-under-supplied-context";
  if (resolution === "inapplicable") {
    return "not-applicable-under-supplied-context";
  }
  if (resolution === "deferred-omitted-energy-prerequisite") {
    return "deferred-energy-unchanged";
  }
  return "still-unresolved";
}

function effectiveReason(
  resolution: SourceConditionCellResolution,
  rows: readonly EffectiveRow[],
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

function validateInput(
  input: GuideRequestContextApplicabilityInput,
  context: GuideRequestContext,
  rules: readonly GuideRequestClaimRule[],
): SourceConditionedGuidePacketIssue[] {
  const issues: SourceConditionedGuidePacketIssue[] = [];
  const issue = (code: string, path: string, message: string): void => {
    issues.push({ code, path, message });
  };
  if (input.projectionId.length === 0) {
    issue(
      "request-context.empty-projection-id",
      "projectionId",
      "Projection ID must be non-empty.",
    );
  }
  if (input.sourceReport.comparisonStatus !== "comparable") {
    issue(
      "request-context.source-report-not-comparable",
      "sourceReport.comparisonStatus",
      "Request context cannot refine a non-comparable source report.",
    );
  }
  validateContext(context, input.sourceReport, issues);

  const claimsById = new Map(
    input.sourceReport.sourceClaimCatalog.map((claim) => [claim.claimId, claim]),
  );
  const seenClaimIds = new Set<string>();
  rules.forEach((rule, ruleIndex) => {
    const path = `claimRules[${ruleIndex}]`;
    if (rule.claimId.length === 0 || seenClaimIds.has(rule.claimId)) {
      issue(
        "request-context.duplicate-or-empty-claim-rule",
        `${path}.claimId`,
        "Claim rules require unique non-empty claim IDs.",
      );
    }
    seenClaimIds.add(rule.claimId);
    const claim = claimsById.get(rule.claimId);
    if (!claim) {
      issue(
        "request-context.unknown-claim",
        `${path}.claimId`,
        `No source claim exists for ${rule.claimId}.`,
      );
      return;
    }
    if (rule.sourceConditionsSha256 !== claim.sourceConditionsSha256) {
      issue(
        "request-context.source-conditions-hash-mismatch",
        `${path}.sourceConditionsSha256`,
        "Claim rule source-condition hash does not match the source control.",
      );
    }
    if (rule.sourcePredicateSha256 !== hashValue(claim.predicate)) {
      issue(
        "request-context.source-predicate-hash-mismatch",
        `${path}.sourcePredicateSha256`,
        "Claim rule source-predicate hash does not match the source control.",
      );
    }
    if (rule.bindings.length === 0) {
      issue(
        "request-context.empty-bindings",
        `${path}.bindings`,
        "A claim rule must bind at least one unresolved source predicate.",
      );
    }
    const nodes = sourcePredicateNodes(claim.predicate);
    const seenPaths = new Set<string>();
    rule.bindings.forEach((binding, bindingIndex) => {
      const bindingPath = `${path}.bindings[${bindingIndex}]`;
      if (
        binding.sourcePredicatePath.length === 0 ||
        seenPaths.has(binding.sourcePredicatePath)
      ) {
        issue(
          "request-context.duplicate-or-empty-source-predicate-path",
          `${bindingPath}.sourcePredicatePath`,
          "Binding source predicate paths must be unique and non-empty.",
        );
      }
      seenPaths.add(binding.sourcePredicatePath);
      const target = nodes.get(binding.sourcePredicatePath);
      if (
        !target ||
        binding.sourcePredicateLeafSha256 !== hashValue(target)
      ) {
        issue(
          "request-context.source-predicate-leaf-hash-mismatch",
          `${bindingPath}.sourcePredicateLeafSha256`,
          "Binding leaf hash does not match the exact source predicate leaf at the pinned path.",
        );
      }
      if (!target || target.type !== "unresolved-context") {
        issue(
          "request-context.binding-target-not-unresolved-context",
          `${bindingPath}.sourcePredicatePath`,
          "Request context may bind only an unresolved-context source leaf; exact-team and deferred-energy facts remain source-owned.",
        );
      }
      validateRequestPredicate(
        binding.requestPredicate,
        `${bindingPath}.requestPredicate`,
        issues,
      );
    });
  });
  return issues.sort((left, right) =>
    `${left.path}\0${left.code}`.localeCompare(`${right.path}\0${right.code}`),
  );
}

function validateContext(
  context: GuideRequestContext,
  sourceReport: SourceConditionedGuidePacketReport,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const sourceMembersByTeamId = new Map(
    sourceReport.teamPackets.map((packet) => [
      packet.teamRecordId,
      new Set(packet.members.map(({ characterId }) => characterId)),
    ]),
  );
  for (const [teamRecordId, teamFacts] of Object.entries(
    context.requestFactsByTeamRecordId ?? {},
  )) {
    const path = `context.requestFactsByTeamRecordId.${teamRecordId}`;
    const sourceMembers = sourceMembersByTeamId.get(teamRecordId);
    if (teamRecordId.length === 0 || !sourceMembers) {
      issues.push({
        code: "request-context.unknown-or-empty-team-scope",
        path,
        message: "Request facts must be scoped to one exact source team record.",
      });
    }
    if (
      teamFacts.acquisitionPreference != null &&
      teamFacts.acquisitionPreference.length === 0
    ) {
      issues.push({
        code: "request-context.empty-request-fact",
        path: `${path}.acquisitionPreference`,
        message: "Provided request facts must be non-empty strings.",
      });
    }
    for (const [characterId, characterFacts] of Object.entries(
      teamFacts.characterFactsById ?? {},
    )) {
      const characterPath = `${path}.characterFactsById.${characterId}`;
      if (characterId.length === 0 || !sourceMembers?.has(characterId)) {
        issues.push({
          code: "request-context.character-outside-team-scope",
          path: characterPath,
          message:
            "Role and optimization-goal facts must name a character in their exact source team.",
        });
      }
      for (const [key, value] of [
        ["intendedRole", characterFacts.intendedRole],
        ["optimizationGoal", characterFacts.optimizationGoal],
      ] as const) {
        if (value != null && value.length === 0) {
          issues.push({
            code: "request-context.empty-request-fact",
            path: `${characterPath}.${key}`,
            message: "Provided request facts must be non-empty strings.",
          });
        }
      }
      if (
        characterFacts.constellation != null &&
        (!Number.isSafeInteger(characterFacts.constellation) ||
          characterFacts.constellation < 0 ||
          characterFacts.constellation > 6)
      ) {
        issues.push({
          code: "request-context.invalid-constellation-fact",
          path: `${characterPath}.constellation`,
          message: "Constellation facts must be safe integers from 0 through 6.",
        });
      }
      if (
        characterFacts.talentLevels != null &&
        !isRecord(characterFacts.talentLevels)
      ) {
        issues.push({
          code: "request-context.invalid-talent-levels-fact",
          path: `${characterPath}.talentLevels`,
          message: "Talent-level facts must be an object keyed by auto, skill, or burst.",
        });
      } else if (isRecord(characterFacts.talentLevels)) {
        for (const [talent, level] of Object.entries(
          characterFacts.talentLevels,
        )) {
          if (
            (talent !== "auto" && talent !== "skill" && talent !== "burst") ||
            !Number.isSafeInteger(level) ||
            (level as number) <= 0
          ) {
            issues.push({
              code: "request-context.invalid-talent-level-fact",
              path: `${characterPath}.talentLevels.${talent}`,
              message:
                "Talent levels require only auto, skill, or burst keys with positive safe-integer values.",
            });
          }
        }
      }
    }
    for (const [assumptionId, value] of Object.entries(
      teamFacts.passiveExecutionAssumptions ?? {},
    )) {
      if (assumptionId.length === 0 || typeof value !== "boolean") {
        issues.push({
          code: "request-context.invalid-passive-assumption",
          path: `${path}.passiveExecutionAssumptions.${assumptionId}`,
          message: "Passive assumptions require non-empty IDs and boolean values.",
        });
      }
    }
  }
  if (
    context.accountFacts &&
    context.accountFacts.snapshotId.length === 0
  ) {
    issues.push({
      code: "request-context.empty-account-snapshot-id",
      path: "context.accountFacts.snapshotId",
      message: "Account facts require a non-empty snapshot identity.",
    });
  }
  const inventory = context.accountFacts?.weaponInventory;
  if (!inventory) return;
  if (inventory.domain !== "complete" && inventory.domain !== "incomplete") {
    issues.push({
      code: "request-context.invalid-inventory-domain",
      path: "context.accountFacts.weaponInventory.domain",
      message: "Weapon inventory domain must be complete or incomplete.",
    });
  }
  const seen = new Set<string>();
  inventory.weaponIds.forEach((weaponId, index) => {
    if (weaponId.length === 0 || seen.has(weaponId)) {
      issues.push({
        code: "request-context.duplicate-or-empty-weapon-id",
        path: `context.accountFacts.weaponInventory.weaponIds[${index}]`,
        message: "Weapon inventory IDs must be unique and non-empty.",
      });
    }
    seen.add(weaponId);
  });
}

function validateRequestPredicate(
  predicate: unknown,
  path: string,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  if (!isRecord(predicate) || typeof predicate.type !== "string") {
    issues.push({
      code: "request-context.invalid-predicate",
      path,
      message: "Request applicability requires a supported typed predicate.",
    });
    return;
  }
  if (predicate.type === "all" || predicate.type === "any") {
    if (!Array.isArray(predicate.predicates) || predicate.predicates.length === 0) {
      issues.push({
        code: "request-context.empty-composite-predicate",
        path: `${path}.predicates`,
        message: "All/any request predicates must contain at least one child.",
      });
      return;
    }
    predicate.predicates.forEach((child, index) =>
      validateRequestPredicate(child, `${path}.predicates[${index}]`, issues),
    );
    return;
  }
  if (
    predicate.type === "constellation-at-least" ||
    predicate.type === "constellation-at-most" ||
    predicate.type === "talent-level-at-least" ||
    predicate.type === "talent-level-is"
  ) {
    if (
      typeof predicate.characterId !== "string" ||
      predicate.characterId.length === 0
    ) {
      issues.push({
        code: "request-context.invalid-predicate-character",
        path: `${path}.characterId`,
        message: "Numeric character predicates require a character ID.",
      });
    }
    const validThreshold =
      typeof predicate.threshold === "number" &&
      Number.isSafeInteger(predicate.threshold) &&
      (predicate.type === "constellation-at-least" ||
        predicate.type === "constellation-at-most"
        ? predicate.threshold >= 0 && predicate.threshold <= 6
        : predicate.threshold > 0);
    if (!validThreshold) {
      issues.push({
        code: "request-context.invalid-numeric-predicate-threshold",
        path: `${path}.threshold`,
        message:
          predicate.type === "constellation-at-least" ||
          predicate.type === "constellation-at-most"
            ? "Constellation thresholds must be safe integers from 0 through 6."
            : "Talent-level thresholds must be positive safe integers.",
      });
    }
    if (
      (predicate.type === "talent-level-at-least" ||
        predicate.type === "talent-level-is") &&
      predicate.talent !== "auto" &&
      predicate.talent !== "skill" &&
      predicate.talent !== "burst"
    ) {
      issues.push({
        code: "request-context.invalid-talent-predicate-kind",
        path: `${path}.talent`,
        message: "Talent-level predicates must name auto, skill, or burst.",
      });
    }
    return;
  }
  const fields: Readonly<Record<string, string>> = {
    "intended-role-is": "roleId",
    "optimization-goal-is": "goalId",
    "acquisition-preference-is": "preferenceId",
    "weapon-inventory-includes": "weaponId",
    "passive-execution-is": "assumptionId",
  };
  const field = fields[predicate.type];
  if (!field) {
    issues.push({
      code: "request-context.unsupported-predicate",
      path: `${path}.type`,
      message: `Unsupported request predicate type ${predicate.type}.`,
    });
    return;
  }
  if (typeof predicate[field] !== "string" || predicate[field].length === 0) {
    issues.push({
      code: "request-context.invalid-predicate-operand",
      path: `${path}.${field}`,
      message: "Request predicate operands must be non-empty strings.",
    });
  }
  if (
    (predicate.type === "intended-role-is" ||
      predicate.type === "optimization-goal-is") &&
    (typeof predicate.characterId !== "string" ||
      predicate.characterId.length === 0)
  ) {
    issues.push({
      code: "request-context.invalid-predicate-character",
      path: `${path}.characterId`,
      message: "Role and optimization-goal predicates require a character ID.",
    });
  }
  if (
    predicate.type === "passive-execution-is" &&
    typeof predicate.expected !== "boolean"
  ) {
    issues.push({
      code: "request-context.invalid-passive-expectation",
      path: `${path}.expected`,
      message: "Passive execution predicates require an explicit boolean expectation.",
    });
  }
}

function sourcePredicateNodes(
  predicate: SourceConditionPredicateAst,
): Map<string, SourceConditionPredicateAst> {
  const nodes = new Map<string, SourceConditionPredicateAst>();
  visit(predicate, "predicate");
  return nodes;

  function visit(node: SourceConditionPredicateAst, path: string): void {
    nodes.set(path, node);
    if (node.type !== "all") return;
    node.predicates.forEach((child, index) =>
      visit(child, `${path}.predicates[${index}]`),
    );
  }
}

function canonicalContext(context: GuideRequestContext): GuideRequestContext {
  const inventory = context.accountFacts?.weaponInventory;
  return {
    ...(context.requestFactsByTeamRecordId
      ? {
          requestFactsByTeamRecordId: Object.fromEntries(
            Object.entries(context.requestFactsByTeamRecordId)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([teamRecordId, teamFacts]) => [
                teamRecordId,
                {
                  ...(teamFacts.characterFactsById
                    ? {
                        characterFactsById: Object.fromEntries(
                          Object.entries(teamFacts.characterFactsById)
                            .sort(([left], [right]) => left.localeCompare(right))
                            .map(([characterId, characterFacts]) => [
                              characterId,
                              canonicalCharacterFacts(characterFacts),
                            ]),
                        ),
                      }
                    : {}),
                  ...(teamFacts.acquisitionPreference == null
                    ? {}
                    : {
                        acquisitionPreference:
                          teamFacts.acquisitionPreference,
                      }),
                  ...(teamFacts.passiveExecutionAssumptions
                    ? {
                        passiveExecutionAssumptions: Object.fromEntries(
                          Object.entries(
                            teamFacts.passiveExecutionAssumptions,
                          ).sort(([left], [right]) => left.localeCompare(right)),
                        ),
                      }
                    : {}),
                },
              ]),
          ),
        }
      : {}),
    ...(context.accountFacts
      ? {
          accountFacts: {
            snapshotId: context.accountFacts.snapshotId,
            ...(inventory
              ? {
                  weaponInventory: {
                    domain: inventory.domain,
                    weaponIds: [...inventory.weaponIds].sort((left, right) =>
                      left.localeCompare(right),
                    ),
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}

function canonicalCharacterFacts(
  facts: NonNullable<
    NonNullable<
      GuideRequestContext["requestFactsByTeamRecordId"]
    >[string]["characterFactsById"]
  >[string],
): typeof facts {
  const talentLevels: unknown = facts.talentLevels;
  return {
    ...(facts.intendedRole == null
      ? {}
      : { intendedRole: facts.intendedRole }),
    ...(facts.optimizationGoal == null
      ? {}
      : { optimizationGoal: facts.optimizationGoal }),
    ...(facts.constellation == null
      ? {}
      : { constellation: facts.constellation }),
    ...(talentLevels == null
      ? {}
      : {
          talentLevels: isRecord(talentLevels)
            ? Object.fromEntries(
                Object.entries(talentLevels).sort(([left], [right]) =>
                  left.localeCompare(right),
                ),
              )
            : (structuredClone(talentLevels) as NonNullable<
                typeof facts.talentLevels
              >),
        }),
  };
}

function canonicalRules(
  rules: readonly GuideRequestClaimRule[],
): GuideRequestClaimRule[] {
  return rules
    .map((rule) => ({
      claimId: rule.claimId,
      sourceConditionsSha256: rule.sourceConditionsSha256,
      sourcePredicateSha256: rule.sourcePredicateSha256,
      bindings: rule.bindings
        .map((binding) => ({
          sourcePredicatePath: binding.sourcePredicatePath,
          sourcePredicateLeafSha256: binding.sourcePredicateLeafSha256,
          requestPredicate: structuredClone(binding.requestPredicate),
        }))
        .sort((left, right) =>
          left.sourcePredicatePath.localeCompare(right.sourcePredicatePath),
        ),
    }))
    .sort((left, right) => left.claimId.localeCompare(right.claimId));
}

function summarize(
  packetCount: number,
  sourceClaimCount: number,
  cells: readonly GuideRequestContextClaimProjection[],
): GuideRequestContextApplicabilityReport["summary"] {
  const unresolvedCellCount = count(cells, "unresolved-context");
  const deferredEnergyCellCount = count(
    cells,
    "deferred-omitted-energy-prerequisite",
  );
  return {
    packetCount,
    sourceClaimCount,
    claimCellCount: cells.length,
    matchedCellCount: count(cells, "matched"),
    inapplicableCellCount: count(cells, "inapplicable"),
    withheldCellCount: unresolvedCellCount + deferredEnergyCellCount,
    unresolvedCellCount,
    deferredEnergyCellCount,
    assembledBuildCount: 0,
  };
}

function emptySummary(): GuideRequestContextApplicabilityReport["summary"] {
  return {
    packetCount: 0,
    sourceClaimCount: 0,
    claimCellCount: 0,
    matchedCellCount: 0,
    inapplicableCellCount: 0,
    withheldCellCount: 0,
    unresolvedCellCount: 0,
    deferredEnergyCellCount: 0,
    assembledBuildCount: 0,
  };
}

function count(
  cells: readonly GuideRequestContextClaimProjection[],
  resolution: SourceConditionCellResolution,
): number {
  return cells.filter((cell) => cell.resolution === resolution).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}
