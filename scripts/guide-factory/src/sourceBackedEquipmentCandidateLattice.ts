import { sha256Text, stableJson } from "./io";

export type SourceBackedEquipmentKind = "weapon" | "artifact";

export type SourceBackedEquipmentGroupOrdering =
  | "ranked-groups"
  | "unranked"
  | null;

export type SourceBackedEquipmentGrouping =
  | "single"
  | "alternatives"
  | "tied";

export type SourceBackedEquipmentClassification =
  | "default"
  | "recommended"
  | "alternative"
  | "conditional"
  | "available-only"
  | null;

export type SourceBackedEquipmentEnergyDerivation =
  | "not-er-derived"
  | "deferred-er"
  | "er-derived";

export type SourceBackedEquipmentJsonValue =
  | null
  | boolean
  | number
  | string
  | SourceBackedEquipmentJsonValue[]
  | { [key: string]: SourceBackedEquipmentJsonValue };

export type SourceBackedEquipmentProvenance = {
  sourceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  recommendationId: string;
};

export type SourceBackedEquipmentOccurrence<
  TPayload extends SourceBackedEquipmentJsonValue = SourceBackedEquipmentJsonValue,
> = {
  occurrenceId: string;
  claimId: string;
  /** Exact zero-based position in the authored group. It is not a global rank. */
  listIndex: number;
  /** Source-authored alternative marker, when one exists. */
  alternativeIndex: number | null;
  /** Source-authored tie marker, when one exists. */
  tieIndex: number | null;
  /** How this projected axis occurrence was derived, not whether its source mentions ER. */
  energyDerivation: SourceBackedEquipmentEnergyDerivation;
  payload: TPayload;
};

export type SourceBackedEquipmentGroup<
  TPayload extends SourceBackedEquipmentJsonValue = SourceBackedEquipmentJsonValue,
> = {
  groupId: string;
  teamMemberId: string;
  characterId: string;
  equipmentKind: SourceBackedEquipmentKind;
  provenance: SourceBackedEquipmentProvenance;
  recommendationOrdering: SourceBackedEquipmentGroupOrdering;
  groupIndex: number;
  grouping: SourceBackedEquipmentGrouping;
  classification: SourceBackedEquipmentClassification;
  /** Optional source-authored local rank. It is never derived from group order. */
  sourceLocalRank: number | null;
  /** Exact zero-based group position in the source recommendation. */
  sourceListIndex: number;
  sourceConditions: string[];
  sourceConditionsSha256: string;
  occurrences: Array<SourceBackedEquipmentOccurrence<TPayload>>;
};

export type SourceBackedEquipmentAxis<
  TPayload extends SourceBackedEquipmentJsonValue = SourceBackedEquipmentJsonValue,
> = {
  axisId: string;
  teamMemberId: string;
  characterId: string;
  equipmentKind: SourceBackedEquipmentKind;
  groups: Array<SourceBackedEquipmentGroup<TPayload>>;
};

export type SourceBackedEquipmentCandidateLatticeInput<
  TPayload extends SourceBackedEquipmentJsonValue = SourceBackedEquipmentJsonValue,
> = {
  request: {
    requestId: string;
    assumptions: SourceBackedEquipmentJsonValue;
  };
  evaluation: {
    evaluationId: string;
    assumptions: SourceBackedEquipmentJsonValue;
  };
  teamMembers: Array<{
    teamMemberId: string;
    characterId: string;
  }>;
  axes: Array<SourceBackedEquipmentAxis<TPayload>>;
  bounds: {
    /** Canonical base-10 integer string supplied by the source-specific wrapper. */
    expectedCombinationCount: string;
    /** Canonical base-10 integer string; enumeration is withheld above this cap. */
    maximumCombinationCount: string;
  };
};

export type SourceBackedEquipmentCandidateLatticeIssue = {
  code: string;
  path: string;
  message: string;
};

export type SourceBackedEquipmentCandidateReference = {
  axisId: string;
  teamMemberId: string;
  characterId: string;
  equipmentKind: SourceBackedEquipmentKind;
  groupId: string;
  occurrenceId: string;
};

export type SourceBackedEquipmentCandidateNode = {
  nodeId: string;
  /** Ordered exactly by the authenticated input axis order. */
  selections: SourceBackedEquipmentCandidateReference[];
};

export type SourceBackedEquipmentCandidateLatticeReport<
  TPayload extends SourceBackedEquipmentJsonValue = SourceBackedEquipmentJsonValue,
> = {
  schemaVersion: 1;
  classification: "source-backed-equipment-candidate-lattice";
  comparisonStatus: "comparable" | "not-comparable";
  capabilities: {
    sourceClaims: false;
    equipmentRecommendationClaims: false;
    rankClaims: false;
    guideClaims: false;
    evaluation: false;
    damage: false;
    energyRecovery: false;
    enumeration: boolean;
  };
  inputBoundary: {
    sourceAuthenticationOwner: "source-specific-wrapper";
    sourceAuthenticationPerformedByCore: false;
    memberCount: number;
    axisCount: number;
    activeAxisCount: number;
    occurrenceCount: number;
    requestAssumptionsSha256: string;
    evaluationAssumptionsSha256: string;
  };
  preflight: {
    countArithmetic: "bigint-decimal";
    expectedCombinationCount: string;
    maximumCombinationCount: string;
    calculatedCombinationCount: string | null;
    countMatchesExpected: boolean;
    withinMaximum: boolean;
  };
  lattice: {
    memberCount: 4;
    axisCount: 8;
    activeAxisCount: 8;
    axisOrder: string[];
    combinationCount: string;
    domains: Array<{
      axisId: string;
      teamMemberId: string;
      characterId: string;
      equipmentKind: SourceBackedEquipmentKind;
      groupIds: string[];
      occurrenceIds: string[];
      occurrenceCount: number;
    }>;
    groups: Array<SourceBackedEquipmentGroup<TPayload>>;
    nodes: SourceBackedEquipmentCandidateNode[];
    nodeIdBinding:
      "ordered-occurrence-ids-plus-request-and-evaluation-assumptions";
    orderingPolicy:
      "authenticated-axis-and-source-list-order-only-no-derived-global-order";
    compositionPolicy:
      "wrapper-authored-cartesian-product-of-source-backed-axis-occurrences";
    sourcePublishedWholeCandidateCount: 0;
  } | null;
  issues: SourceBackedEquipmentCandidateLatticeIssue[];
};

export type CompleteSourceBackedEquipmentCandidateLatticeReport<
  TPayload extends SourceBackedEquipmentJsonValue = SourceBackedEquipmentJsonValue,
> = Omit<
  SourceBackedEquipmentCandidateLatticeReport<TPayload>,
  "comparisonStatus" | "capabilities" | "lattice" | "issues"
> & {
  comparisonStatus: "comparable";
  capabilities: Omit<
    SourceBackedEquipmentCandidateLatticeReport<TPayload>["capabilities"],
    "enumeration"
  > & { enumeration: true };
  lattice: NonNullable<
    SourceBackedEquipmentCandidateLatticeReport<TPayload>["lattice"]
  >;
  issues: [];
};

export type SourceBackedEquipmentEnumerationOverride = (
  axes: ReadonlyArray<{
    axisId: string;
    occurrenceIds: readonly string[];
  }>,
) => ReadonlyArray<ReadonlyArray<string>>;

type PreparedOccurrence<
  TPayload extends SourceBackedEquipmentJsonValue,
> = {
  reference: SourceBackedEquipmentCandidateReference;
  group: SourceBackedEquipmentGroup<TPayload>;
};

type PreparedAxis<TPayload extends SourceBackedEquipmentJsonValue> = {
  axis: SourceBackedEquipmentAxis<TPayload>;
  occurrences: PreparedOccurrence<TPayload>[];
};

const EXACT_MEMBER_COUNT = 4;
const EXACT_AXIS_COUNT = 8;
const DECIMAL_INTEGER = /^(0|[1-9][0-9]*)$/;
const SHA256 = /^[a-f0-9]{64}$/;

/**
 * Enumerate an exact, bounded equipment product. The caller owns all
 * source-specific authentication and semantic interpretation. This core only
 * validates identities and shape, preserves source-local metadata, and emits a
 * complete finite set of selection references.
 */
export function buildSourceBackedEquipmentCandidateLattice<
  TPayload extends SourceBackedEquipmentJsonValue,
>(
  input: SourceBackedEquipmentCandidateLatticeInput<TPayload>,
  enumerationOverride?: SourceBackedEquipmentEnumerationOverride,
): SourceBackedEquipmentCandidateLatticeReport<TPayload> {
  const issues: SourceBackedEquipmentCandidateLatticeIssue[] = [];
  validateJsonValue(input.request.assumptions, "request.assumptions", issues);
  validateJsonValue(
    input.evaluation.assumptions,
    "evaluation.assumptions",
    issues,
  );
  if (!nonEmpty(input.request.requestId)) {
    addIssue(
      issues,
      "request.invalid_id",
      "request.requestId",
      "Request id must be non-blank.",
    );
  }
  if (!nonEmpty(input.evaluation.evaluationId)) {
    addIssue(
      issues,
      "evaluation.invalid_id",
      "evaluation.evaluationId",
      "Evaluation id must be non-blank.",
    );
  }

  const requestAssumptionsSha256 = sha256Text(
    stableJson({
      requestId: input.request.requestId,
      assumptions: input.request.assumptions,
    }),
  );
  const evaluationAssumptionsSha256 = sha256Text(
    stableJson({
      evaluationId: input.evaluation.evaluationId,
      assumptions: input.evaluation.assumptions,
    }),
  );

  const memberById = validateMembers(input, issues);
  const preparedAxes = validateAndPrepareAxes(input, memberById, issues);
  const occurrenceCount = preparedAxes.reduce(
    (sum, axis) => sum + axis.occurrences.length,
    0,
  );
  const activeAxisCount = preparedAxes.filter(
    ({ occurrences }) => occurrences.length > 0,
  ).length;

  const expectedCount = parseBound(
    input.bounds.expectedCombinationCount,
    "bounds.expectedCombinationCount",
    issues,
  );
  const maximumCount = parseBound(
    input.bounds.maximumCombinationCount,
    "bounds.maximumCombinationCount",
    issues,
  );
  const calculatedCount =
    preparedAxes.length === EXACT_AXIS_COUNT && activeAxisCount === EXACT_AXIS_COUNT
      ? preparedAxes.reduce(
          (product, axis) => product * BigInt(axis.occurrences.length),
          1n,
        )
      : null;
  const countMatchesExpected =
    calculatedCount !== null &&
    expectedCount !== null &&
    calculatedCount === expectedCount;
  const withinMaximum =
    calculatedCount !== null &&
    maximumCount !== null &&
    calculatedCount <= maximumCount;

  if (
    calculatedCount !== null &&
    expectedCount !== null &&
    calculatedCount !== expectedCount
  ) {
    addIssue(
      issues,
      "bounds.expected_count_mismatch",
      "bounds.expectedCombinationCount",
      `Calculated ${calculatedCount.toString()} combinations, but the wrapper declared ${expectedCount.toString()}.`,
    );
  }
  if (
    calculatedCount !== null &&
    maximumCount !== null &&
    calculatedCount > maximumCount
  ) {
    addIssue(
      issues,
      "bounds.maximum_exceeded",
      "bounds.maximumCombinationCount",
      `Calculated ${calculatedCount.toString()} combinations, above the ${maximumCount.toString()} cap.`,
    );
  }
  if (
    calculatedCount !== null &&
    calculatedCount > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    addIssue(
      issues,
      "bounds.enumeration_count_not_safe",
      "bounds.expectedCombinationCount",
      "The declared finite product cannot be represented as a complete JavaScript array.",
    );
  }

  const common = {
    schemaVersion: 1 as const,
    classification: "source-backed-equipment-candidate-lattice" as const,
    inputBoundary: {
      sourceAuthenticationOwner: "source-specific-wrapper" as const,
      sourceAuthenticationPerformedByCore: false as const,
      memberCount: input.teamMembers.length,
      axisCount: input.axes.length,
      activeAxisCount,
      occurrenceCount,
      requestAssumptionsSha256,
      evaluationAssumptionsSha256,
    },
    preflight: {
      countArithmetic: "bigint-decimal" as const,
      expectedCombinationCount: input.bounds.expectedCombinationCount,
      maximumCombinationCount: input.bounds.maximumCombinationCount,
      calculatedCombinationCount: calculatedCount?.toString() ?? null,
      countMatchesExpected,
      withinMaximum,
    },
  };

  if (issues.length > 0 || calculatedCount === null) {
    return withheldReport(common, issues);
  }

  const selectionRows = enumerationOverride
    ? safelyRunEnumerationOverride(enumerationOverride, preparedAxes, issues)
    : enumerateCompleteProduct(preparedAxes);
  const nodes = validateAndBuildNodes(
    selectionRows,
    preparedAxes,
    calculatedCount,
    requestAssumptionsSha256,
    evaluationAssumptionsSha256,
    issues,
  );

  if (issues.length > 0 || nodes === null) {
    return withheldReport(common, issues);
  }

  const report: SourceBackedEquipmentCandidateLatticeReport<TPayload> = {
    ...common,
    comparisonStatus: "comparable",
    capabilities: capabilityFlags(true),
    lattice: {
      memberCount: EXACT_MEMBER_COUNT,
      axisCount: EXACT_AXIS_COUNT,
      activeAxisCount: EXACT_AXIS_COUNT,
      axisOrder: preparedAxes.map(({ axis }) => axis.axisId),
      combinationCount: calculatedCount.toString(),
      domains: preparedAxes.map(({ axis, occurrences }) => ({
        axisId: axis.axisId,
        teamMemberId: axis.teamMemberId,
        characterId: axis.characterId,
        equipmentKind: axis.equipmentKind,
        groupIds: axis.groups.map(({ groupId }) => groupId),
        occurrenceIds: occurrences.map(
          ({ reference }) => reference.occurrenceId,
        ),
        occurrenceCount: occurrences.length,
      })),
      groups: preparedAxes.flatMap(({ axis }) =>
        axis.groups.map((group) => structuredClone(group)),
      ),
      nodes,
      nodeIdBinding:
        "ordered-occurrence-ids-plus-request-and-evaluation-assumptions",
      orderingPolicy:
        "authenticated-axis-and-source-list-order-only-no-derived-global-order",
      compositionPolicy:
        "wrapper-authored-cartesian-product-of-source-backed-axis-occurrences",
      sourcePublishedWholeCandidateCount: 0,
    },
    issues: [],
  };
  if (!isCompleteSourceBackedEquipmentCandidateLattice(report)) {
    return withheldReport(common, [
      {
        code: "lattice.postcondition_failed",
        path: "lattice",
        message:
          "The completed lattice failed its exact shape and identity postcondition.",
      },
    ]);
  }
  return report;
}

/** Fail-closed predicate for a source-specific wrapper before it consumes nodes. */
export function isCompleteSourceBackedEquipmentCandidateLattice<
  TPayload extends SourceBackedEquipmentJsonValue,
>(
  report: SourceBackedEquipmentCandidateLatticeReport<TPayload>,
): report is CompleteSourceBackedEquipmentCandidateLatticeReport<TPayload> {
  try {
  const { capabilities, inputBoundary, lattice, preflight } = report;
  if (
    report.schemaVersion !== 1 ||
    report.classification !== "source-backed-equipment-candidate-lattice" ||
    report.comparisonStatus !== "comparable" ||
    report.issues.length !== 0 ||
    lattice === null ||
    capabilities.sourceClaims !== false ||
    capabilities.equipmentRecommendationClaims !== false ||
    capabilities.rankClaims !== false ||
    capabilities.guideClaims !== false ||
    capabilities.evaluation !== false ||
    capabilities.damage !== false ||
    capabilities.energyRecovery !== false ||
    capabilities.enumeration !== true ||
    inputBoundary.sourceAuthenticationOwner !== "source-specific-wrapper" ||
    inputBoundary.sourceAuthenticationPerformedByCore !== false ||
    inputBoundary.memberCount !== EXACT_MEMBER_COUNT ||
    inputBoundary.axisCount !== EXACT_AXIS_COUNT ||
    inputBoundary.activeAxisCount !== EXACT_AXIS_COUNT ||
    lattice.memberCount !== EXACT_MEMBER_COUNT ||
    lattice.axisCount !== EXACT_AXIS_COUNT ||
    lattice.activeAxisCount !== EXACT_AXIS_COUNT ||
    lattice.domains.length !== EXACT_AXIS_COUNT ||
    lattice.axisOrder.length !== EXACT_AXIS_COUNT ||
    lattice.sourcePublishedWholeCandidateCount !== 0 ||
    lattice.compositionPolicy !==
      "wrapper-authored-cartesian-product-of-source-backed-axis-occurrences" ||
    lattice.orderingPolicy !==
      "authenticated-axis-and-source-list-order-only-no-derived-global-order" ||
    lattice.nodeIdBinding !==
      "ordered-occurrence-ids-plus-request-and-evaluation-assumptions" ||
    !SHA256.test(inputBoundary.requestAssumptionsSha256) ||
    !SHA256.test(inputBoundary.evaluationAssumptionsSha256) ||
    !DECIMAL_INTEGER.test(lattice.combinationCount) ||
    lattice.combinationCount === "0" ||
    preflight.countArithmetic !== "bigint-decimal" ||
    !DECIMAL_INTEGER.test(preflight.expectedCombinationCount) ||
    !DECIMAL_INTEGER.test(preflight.maximumCombinationCount) ||
    preflight.calculatedCombinationCount !== lattice.combinationCount ||
    preflight.expectedCombinationCount !== lattice.combinationCount ||
    preflight.countMatchesExpected !== true ||
    preflight.withinMaximum !== true
  ) {
    return false;
  }

  const combinationCount = BigInt(lattice.combinationCount);
  if (
    BigInt(lattice.nodes.length) !== combinationCount ||
    BigInt(preflight.maximumCombinationCount) < combinationCount
  ) {
    return false;
  }

  const axisIds = new Set<string>();
  const domainMemberIds = new Set<string>();
  const domainCharacterIds = new Set<string>();
  const groupIds = new Set<string>();
  const occurrenceIds = new Set<string>();
  let occurrenceCount = 0;
  for (const [axisIndex, domain] of lattice.domains.entries()) {
    const precedingDomain = lattice.domains[axisIndex - 1];
    if (
      lattice.axisOrder[axisIndex] !== domain.axisId ||
      !nonEmpty(domain.axisId) ||
      axisIds.has(domain.axisId) ||
      domain.occurrenceCount <= 0 ||
      domain.occurrenceCount !== domain.occurrenceIds.length ||
      domain.groupIds.length === 0 ||
      new Set(domain.groupIds).size !== domain.groupIds.length ||
      new Set(domain.occurrenceIds).size !== domain.occurrenceIds.length ||
      (domain.equipmentKind !== "weapon" &&
        domain.equipmentKind !== "artifact") ||
      domain.equipmentKind !== (axisIndex % 2 === 0 ? "weapon" : "artifact") ||
      (axisIndex % 2 === 1 &&
        (domain.teamMemberId !== precedingDomain?.teamMemberId ||
          domain.characterId !== precedingDomain.characterId))
    ) {
      return false;
    }
    axisIds.add(domain.axisId);
    if (axisIndex % 2 === 0) {
      if (
        domainMemberIds.has(domain.teamMemberId) ||
        domainCharacterIds.has(domain.characterId)
      ) {
        return false;
      }
      domainMemberIds.add(domain.teamMemberId);
      domainCharacterIds.add(domain.characterId);
    }
    occurrenceCount += domain.occurrenceCount;
    for (const groupId of domain.groupIds) {
      if (!nonEmpty(groupId) || groupIds.has(groupId)) return false;
      groupIds.add(groupId);
    }
    for (const occurrenceId of domain.occurrenceIds) {
      if (!nonEmpty(occurrenceId) || occurrenceIds.has(occurrenceId)) {
        return false;
      }
      occurrenceIds.add(occurrenceId);
    }
  }
  if (
    occurrenceCount !== inputBoundary.occurrenceCount ||
    domainMemberIds.size !== EXACT_MEMBER_COUNT ||
    domainCharacterIds.size !== EXACT_MEMBER_COUNT
  ) {
    return false;
  }

  const storedGroupIds = lattice.groups.map(({ groupId }) => groupId);
  if (
    storedGroupIds.length !== groupIds.size ||
    new Set(storedGroupIds).size !== storedGroupIds.length ||
    storedGroupIds.some((groupId) => !groupIds.has(groupId))
  ) {
    return false;
  }
  const occurrenceToGroupId = new Map<string, string>();
  const metadataIssues: SourceBackedEquipmentCandidateLatticeIssue[] = [];
  for (const group of lattice.groups) {
    const domain = lattice.domains.find(({ groupIds: ids }) =>
      ids.includes(group.groupId),
    );
    if (
      !domain ||
      group.teamMemberId !== domain.teamMemberId ||
      group.characterId !== domain.characterId ||
      group.equipmentKind !== domain.equipmentKind
    ) {
      return false;
    }
    validateGroupMetadata(group, `lattice.groups.${group.groupId}`, metadataIssues);
    for (const [occurrenceIndex, occurrence] of group.occurrences.entries()) {
      validateOccurrence(
        occurrence,
        group,
        occurrenceIndex,
        `lattice.groups.${group.groupId}.occurrences[${occurrenceIndex}]`,
        metadataIssues,
      );
      if (
        occurrenceToGroupId.has(occurrence.occurrenceId) ||
        !domain.occurrenceIds.includes(occurrence.occurrenceId)
      ) {
        return false;
      }
      occurrenceToGroupId.set(occurrence.occurrenceId, group.groupId);
    }
  }
  if (
    metadataIssues.length > 0 ||
    occurrenceToGroupId.size !== occurrenceIds.size
  ) {
    return false;
  }

  const nodeIds = new Set<string>();
  const selectionTuples = new Set<string>();
  for (const node of lattice.nodes) {
    if (
      node.selections.length !== EXACT_AXIS_COUNT ||
      nodeIds.has(node.nodeId)
    ) {
      return false;
    }
    const selectedOccurrenceIds: string[] = [];
    for (const [axisIndex, selection] of node.selections.entries()) {
      const domain = lattice.domains[axisIndex];
      if (
        selection.axisId !== domain.axisId ||
        selection.teamMemberId !== domain.teamMemberId ||
        selection.characterId !== domain.characterId ||
        selection.equipmentKind !== domain.equipmentKind ||
        !domain.groupIds.includes(selection.groupId) ||
        !domain.occurrenceIds.includes(selection.occurrenceId) ||
        occurrenceToGroupId.get(selection.occurrenceId) !== selection.groupId
      ) {
        return false;
      }
      selectedOccurrenceIds.push(selection.occurrenceId);
    }
    const tuple = stableJson(selectedOccurrenceIds);
    if (selectionTuples.has(tuple)) return false;
    selectionTuples.add(tuple);
    const expectedNodeId = `source-backed-equipment-node:${sha256Text(
      stableJson({
        axisOrder: lattice.axisOrder,
        occurrenceIds: selectedOccurrenceIds,
        requestAssumptionsSha256: inputBoundary.requestAssumptionsSha256,
        evaluationAssumptionsSha256:
          inputBoundary.evaluationAssumptionsSha256,
      }),
    )}`;
    if (node.nodeId !== expectedNodeId) return false;
    nodeIds.add(node.nodeId);
  }
  return BigInt(selectionTuples.size) === combinationCount;
  } catch {
    return false;
  }
}

function validateMembers<TPayload extends SourceBackedEquipmentJsonValue>(
  input: SourceBackedEquipmentCandidateLatticeInput<TPayload>,
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): Map<string, string> {
  if (input.teamMembers.length !== EXACT_MEMBER_COUNT) {
    addIssue(
      issues,
      "team.member_count_mismatch",
      "teamMembers",
      `Expected exactly ${EXACT_MEMBER_COUNT} members, received ${input.teamMembers.length}.`,
    );
  }
  const memberById = new Map<string, string>();
  const characterIds = new Set<string>();
  for (const [index, member] of input.teamMembers.entries()) {
    const path = `teamMembers[${index}]`;
    if (!nonEmpty(member.teamMemberId)) {
      addIssue(issues, "team.invalid_member_id", `${path}.teamMemberId`, "Member id must be non-empty.");
      continue;
    }
    if (!nonEmpty(member.characterId)) {
      addIssue(issues, "team.invalid_character_id", `${path}.characterId`, "Character id must be non-empty.");
    }
    if (memberById.has(member.teamMemberId)) {
      addIssue(issues, "team.duplicate_member_id", `${path}.teamMemberId`, `Duplicate member id ${member.teamMemberId}.`);
    } else {
      memberById.set(member.teamMemberId, member.characterId);
    }
    if (characterIds.has(member.characterId)) {
      addIssue(issues, "team.duplicate_character_id", `${path}.characterId`, `Duplicate character id ${member.characterId}.`);
    }
    characterIds.add(member.characterId);
  }
  return memberById;
}

function validateAndPrepareAxes<TPayload extends SourceBackedEquipmentJsonValue>(
  input: SourceBackedEquipmentCandidateLatticeInput<TPayload>,
  memberById: ReadonlyMap<string, string>,
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): PreparedAxis<TPayload>[] {
  if (input.axes.length !== EXACT_AXIS_COUNT) {
    addIssue(issues, "axis.count_mismatch", "axes", `Expected exactly ${EXACT_AXIS_COUNT} axes, received ${input.axes.length}.`);
  }
  const axisIds = new Set<string>();
  const memberKindKeys = new Set<string>();
  const groupIds = new Set<string>();
  const occurrenceIds = new Set<string>();
  const prepared: PreparedAxis<TPayload>[] = [];

  for (const [axisIndex, axis] of input.axes.entries()) {
    const axisPath = `axes[${axisIndex}]`;
    const expectedMember = input.teamMembers[Math.floor(axisIndex / 2)];
    const expectedKind: SourceBackedEquipmentKind =
      axisIndex % 2 === 0 ? "weapon" : "artifact";
    if (
      expectedMember &&
      (axis.teamMemberId !== expectedMember.teamMemberId ||
        axis.characterId !== expectedMember.characterId ||
        axis.equipmentKind !== expectedKind)
    ) {
      addIssue(
        issues,
        "axis.order_drift",
        axisPath,
        "Axes must follow exact team-member order with weapon before artifact for each member.",
      );
    }
    if (!nonEmpty(axis.axisId)) {
      addIssue(issues, "axis.invalid_id", `${axisPath}.axisId`, "Axis id must be non-empty.");
    } else if (axisIds.has(axis.axisId)) {
      addIssue(issues, "axis.duplicate_id", `${axisPath}.axisId`, `Duplicate axis id ${axis.axisId}.`);
    }
    axisIds.add(axis.axisId);

    const expectedCharacterId = memberById.get(axis.teamMemberId);
    if (expectedCharacterId === undefined) {
      addIssue(issues, "axis.foreign_member", `${axisPath}.teamMemberId`, `Axis refers to foreign member ${axis.teamMemberId}.`);
    } else if (axis.characterId !== expectedCharacterId) {
      addIssue(issues, "axis.character_drift", `${axisPath}.characterId`, `Axis character ${axis.characterId} does not match member ${axis.teamMemberId}.`);
    }
    if (axis.equipmentKind !== "weapon" && axis.equipmentKind !== "artifact") {
      addIssue(issues, "axis.invalid_kind", `${axisPath}.equipmentKind`, `Unsupported equipment kind ${String(axis.equipmentKind)}.`);
    }
    const memberKindKey = `${axis.teamMemberId}\u0000${axis.equipmentKind}`;
    if (memberKindKeys.has(memberKindKey)) {
      addIssue(issues, "axis.duplicate_member_kind", axisPath, `Duplicate ${axis.equipmentKind} axis for ${axis.teamMemberId}.`);
    }
    memberKindKeys.add(memberKindKey);

    const flattened: PreparedOccurrence<TPayload>[] = [];
    if (axis.groups.length === 0) {
      addIssue(issues, "axis.empty", `${axisPath}.groups`, "Every axis must contain at least one source-backed group.");
    }
    for (const [groupPosition, group] of axis.groups.entries()) {
      const groupPath = `${axisPath}.groups[${groupPosition}]`;
      validateGroupBinding(group, axis, groupPath, issues);
      validateGroupMetadata(group, groupPath, issues);
      if (groupIds.has(group.groupId)) {
        addIssue(issues, "group.duplicate_id", `${groupPath}.groupId`, `Duplicate group id ${group.groupId}.`);
      }
      groupIds.add(group.groupId);
      if (group.occurrences.length === 0) {
        addIssue(issues, "group.empty", `${groupPath}.occurrences`, "A source-backed group cannot be empty.");
      }
      for (const [occurrencePosition, occurrence] of group.occurrences.entries()) {
        const occurrencePath = `${groupPath}.occurrences[${occurrencePosition}]`;
        validateOccurrence(occurrence, group, occurrencePosition, occurrencePath, issues);
        if (occurrenceIds.has(occurrence.occurrenceId)) {
          addIssue(issues, "occurrence.duplicate_id", `${occurrencePath}.occurrenceId`, `Duplicate occurrence id ${occurrence.occurrenceId}.`);
        }
        occurrenceIds.add(occurrence.occurrenceId);
        flattened.push({
          reference: {
            axisId: axis.axisId,
            teamMemberId: axis.teamMemberId,
            characterId: axis.characterId,
            equipmentKind: axis.equipmentKind,
            groupId: group.groupId,
            occurrenceId: occurrence.occurrenceId,
          },
          group,
        });
      }
    }
    if (flattened.length === 0) {
      addIssue(issues, "axis.no_active_occurrences", axisPath, "Every axis must have at least one non-ER occurrence.");
    }
    prepared.push({ axis, occurrences: flattened });
  }

  for (const member of input.teamMembers) {
    for (const kind of ["weapon", "artifact"] as const) {
      if (!memberKindKeys.has(`${member.teamMemberId}\u0000${kind}`)) {
        addIssue(issues, "axis.missing_member_kind", "axes", `Missing ${kind} axis for ${member.teamMemberId}.`);
      }
    }
  }
  return prepared;
}

function validateGroupBinding<TPayload extends SourceBackedEquipmentJsonValue>(
  group: SourceBackedEquipmentGroup<TPayload>,
  axis: SourceBackedEquipmentAxis<TPayload>,
  path: string,
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): void {
  if (group.teamMemberId !== axis.teamMemberId) {
    addIssue(issues, "group.member_drift", `${path}.teamMemberId`, "Group member does not match its axis.");
  }
  if (group.characterId !== axis.characterId) {
    addIssue(issues, "group.character_drift", `${path}.characterId`, "Group character does not match its axis.");
  }
  if (group.equipmentKind !== axis.equipmentKind) {
    addIssue(issues, "group.kind_drift", `${path}.equipmentKind`, "Group kind does not match its axis.");
  }
}

function validateGroupMetadata<TPayload extends SourceBackedEquipmentJsonValue>(
  group: SourceBackedEquipmentGroup<TPayload>,
  path: string,
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): void {
  if (
    group.equipmentKind !== "weapon" &&
    group.equipmentKind !== "artifact"
  ) {
    addIssue(
      issues,
      "group.invalid_kind",
      `${path}.equipmentKind`,
      "Group equipment kind must be weapon or artifact.",
    );
  }
  if (
    group.recommendationOrdering !== "ranked-groups" &&
    group.recommendationOrdering !== "unranked" &&
    group.recommendationOrdering !== null
  ) {
    addIssue(
      issues,
      "group.invalid_ordering",
      `${path}.recommendationOrdering`,
      "Unsupported recommendation ordering metadata.",
    );
  }
  if (
    group.grouping !== "single" &&
    group.grouping !== "alternatives" &&
    group.grouping !== "tied"
  ) {
    addIssue(
      issues,
      "group.invalid_grouping",
      `${path}.grouping`,
      "Unsupported source grouping metadata.",
    );
  }
  if (
    group.classification !== "default" &&
    group.classification !== "recommended" &&
    group.classification !== "alternative" &&
    group.classification !== "conditional" &&
    group.classification !== "available-only" &&
    group.classification !== null
  ) {
    addIssue(
      issues,
      "group.invalid_classification",
      `${path}.classification`,
      "Unsupported source classification metadata.",
    );
  }
  for (const [key, value] of Object.entries(group.provenance)) {
    if (!nonEmpty(value)) {
      addIssue(issues, "group.invalid_provenance", `${path}.provenance.${key}`, "Provenance fields must be non-empty.");
    }
  }
  if (!nonEmpty(group.groupId)) {
    addIssue(issues, "group.invalid_id", `${path}.groupId`, "Group id must be non-empty.");
  }
  if (!nonNegativeInteger(group.groupIndex) || !nonNegativeInteger(group.sourceListIndex)) {
    addIssue(issues, "group.invalid_list_index", path, "Group indices must be non-negative integers.");
  }
  if (
    group.sourceLocalRank !== null &&
    !nonNegativeInteger(group.sourceLocalRank)
  ) {
    addIssue(
      issues,
      "group.invalid_source_local_rank",
      `${path}.sourceLocalRank`,
      "Source-local rank must be null or a non-negative integer.",
    );
  }
  if (!SHA256.test(group.sourceConditionsSha256)) {
    addIssue(issues, "group.invalid_condition_hash", `${path}.sourceConditionsSha256`, "Condition hash must be a lowercase SHA-256 digest.");
  } else if (sha256Text(stableJson(group.sourceConditions)) !== group.sourceConditionsSha256) {
    addIssue(issues, "group.condition_hash_drift", `${path}.sourceConditionsSha256`, "Condition text no longer matches its authenticated hash.");
  }
  if (new Set(group.sourceConditions).size !== group.sourceConditions.length) {
    addIssue(issues, "group.duplicate_condition", `${path}.sourceConditions`, "Source conditions must be unique and preserve their source order.");
  }
  if (group.sourceConditions.some((condition) => !nonEmpty(condition))) {
    addIssue(
      issues,
      "group.invalid_condition",
      `${path}.sourceConditions`,
      "Source conditions must contain only non-blank strings.",
    );
  }
}

function validateOccurrence<TPayload extends SourceBackedEquipmentJsonValue>(
  occurrence: SourceBackedEquipmentOccurrence<TPayload>,
  group: SourceBackedEquipmentGroup<TPayload>,
  occurrencePosition: number,
  path: string,
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): void {
  if (!nonEmpty(occurrence.occurrenceId) || !nonEmpty(occurrence.claimId)) {
    addIssue(issues, "occurrence.invalid_identity", path, "Occurrence and claim ids must be non-empty.");
  }
  if (!nonNegativeInteger(occurrence.listIndex)) {
    addIssue(issues, "occurrence.invalid_list_index", `${path}.listIndex`, "Occurrence list index must be a non-negative integer.");
  } else if (occurrence.listIndex !== occurrencePosition) {
    addIssue(issues, "occurrence.list_index_drift", `${path}.listIndex`, "Occurrence position no longer matches its authenticated list index.");
  }
  for (const [key, value] of [
    ["alternativeIndex", occurrence.alternativeIndex],
    ["tieIndex", occurrence.tieIndex],
  ] as const) {
    if (value !== null && !nonNegativeInteger(value)) {
      addIssue(issues, "occurrence.invalid_group_index", `${path}.${key}`, `${key} must be null or a non-negative integer.`);
    }
  }
  if (group.grouping === "single" && (occurrence.alternativeIndex !== null || occurrence.tieIndex !== null)) {
    addIssue(issues, "occurrence.inconsistent_single_metadata", path, "Single groups cannot carry alternative or tie indices.");
  }
  if (group.grouping === "alternatives" && (occurrence.alternativeIndex === null || occurrence.tieIndex !== null)) {
    addIssue(issues, "occurrence.inconsistent_alternative_metadata", path, "Alternative groups require only an alternative index.");
  }
  if (group.grouping === "tied" && (occurrence.tieIndex === null || occurrence.alternativeIndex !== null)) {
    addIssue(issues, "occurrence.inconsistent_tie_metadata", path, "Tied groups require only a tie index.");
  }
  if (group.grouping === "single" && group.occurrences.length !== 1) {
    addIssue(issues, "group.single_cardinality_mismatch", path, "Single groups must contain exactly one occurrence.");
  }
  if (group.grouping !== "single" && group.occurrences.length < 2) {
    addIssue(issues, "group.multi_cardinality_mismatch", path, "Alternative and tied groups must contain at least two occurrences.");
  }
  if (
    occurrence.energyDerivation === "er-derived" ||
    occurrence.energyDerivation === "deferred-er"
  ) {
    addIssue(
      issues,
      "occurrence.energy_related_rejected",
      `${path}.energyDerivation`,
      "ER-active and ER-deferred occurrences are outside this non-ER lattice.",
    );
  } else if (occurrence.energyDerivation !== "not-er-derived") {
    addIssue(issues, "occurrence.invalid_energy_status", `${path}.energyDerivation`, `Unsupported energy derivation ${String(occurrence.energyDerivation)}.`);
  }
  validateJsonValue(occurrence.payload, `${path}.payload`, issues);
}

function parseBound(
  value: string,
  path: string,
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): bigint | null {
  if (!DECIMAL_INTEGER.test(value)) {
    addIssue(issues, "bounds.invalid_decimal", path, "Bounds must be canonical non-negative base-10 integer strings.");
    return null;
  }
  const parsed = BigInt(value);
  if (parsed === 0n) {
    addIssue(issues, "bounds.zero", path, "A complete nonempty lattice requires a positive bound.");
    return null;
  }
  return parsed;
}

function enumerateCompleteProduct<TPayload extends SourceBackedEquipmentJsonValue>(
  axes: readonly PreparedAxis<TPayload>[],
): string[][] {
  let rows: string[][] = [[]];
  for (const axis of axes) {
    const next: string[][] = [];
    for (const row of rows) {
      for (const occurrence of axis.occurrences) {
        next.push([...row, occurrence.reference.occurrenceId]);
      }
    }
    rows = next;
  }
  return rows;
}

function safelyRunEnumerationOverride<TPayload extends SourceBackedEquipmentJsonValue>(
  override: SourceBackedEquipmentEnumerationOverride,
  axes: readonly PreparedAxis<TPayload>[],
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): ReadonlyArray<ReadonlyArray<string>> {
  try {
    return override(
      axes.map(({ axis, occurrences }) => ({
        axisId: axis.axisId,
        occurrenceIds: occurrences.map(({ reference }) => reference.occurrenceId),
      })),
    );
  } catch (error) {
    addIssue(issues, "enumeration.failed", "enumeration", error instanceof Error ? error.message : String(error));
    return [];
  }
}

function validateAndBuildNodes<TPayload extends SourceBackedEquipmentJsonValue>(
  rows: ReadonlyArray<ReadonlyArray<string>>,
  axes: readonly PreparedAxis<TPayload>[],
  expectedCount: bigint,
  requestAssumptionsSha256: string,
  evaluationAssumptionsSha256: string,
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): SourceBackedEquipmentCandidateNode[] | null {
  if (BigInt(rows.length) !== expectedCount) {
    addIssue(issues, "enumeration.incomplete_count", "enumeration", `Enumeration emitted ${rows.length} rows, expected exactly ${expectedCount.toString()}.`);
  }
  const validOccurrenceByAxis = axes.map(
    ({ occurrences }) => new Map(occurrences.map((entry) => [entry.reference.occurrenceId, entry])),
  );
  const selectionKeys = new Set<string>();
  const nodeIds = new Set<string>();
  const nodes: SourceBackedEquipmentCandidateNode[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    const path = `enumeration[${rowIndex}]`;
    if (row.length !== axes.length) {
      addIssue(issues, "enumeration.partial_row", path, `Row has ${row.length} selections for ${axes.length} axes.`);
      continue;
    }
    const selections: SourceBackedEquipmentCandidateReference[] = [];
    let rowValid = true;
    for (const [axisIndex, occurrenceId] of row.entries()) {
      const prepared = validOccurrenceByAxis[axisIndex]?.get(occurrenceId);
      if (!prepared) {
        addIssue(issues, "enumeration.foreign_occurrence", `${path}[${axisIndex}]`, `Occurrence ${occurrenceId} does not belong to axis ${axes[axisIndex]?.axis.axisId ?? axisIndex}.`);
        rowValid = false;
        continue;
      }
      selections.push({ ...prepared.reference });
    }
    if (!rowValid) continue;
    const occurrenceIds = selections.map(({ occurrenceId }) => occurrenceId);
    const selectionKey = stableJson(occurrenceIds);
    if (selectionKeys.has(selectionKey)) {
      addIssue(issues, "enumeration.duplicate_selection", path, "Enumeration contains a duplicate Cartesian selection.");
      continue;
    }
    selectionKeys.add(selectionKey);
    const digest = sha256Text(
      stableJson({
        axisOrder: axes.map(({ axis }) => axis.axisId),
        occurrenceIds,
        requestAssumptionsSha256,
        evaluationAssumptionsSha256,
      }),
    );
    const nodeId = `source-backed-equipment-node:${digest}`;
    if (nodeIds.has(nodeId)) {
      addIssue(issues, "enumeration.duplicate_node_id", path, `Duplicate node id ${nodeId}.`);
      continue;
    }
    nodeIds.add(nodeId);
    nodes.push({ nodeId, selections });
  }

  if (BigInt(selectionKeys.size) !== expectedCount || BigInt(nodes.length) !== expectedCount) {
    addIssue(issues, "enumeration.incomplete_product", "enumeration", "The emitted rows do not cover the complete bounded Cartesian product exactly once.");
  }
  return issues.length === 0 ? nodes : null;
}

function validateJsonValue(
  value: unknown,
  path: string,
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      addIssue(issues, "input.non_json_number", path, "Assumptions and payloads require finite JSON numbers.");
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateJsonValue(entry, `${path}[${index}]`, issues));
    return;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      addIssue(issues, "input.non_plain_object", path, "Assumptions and payloads require plain JSON objects.");
      return;
    }
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) {
        addIssue(issues, "input.undefined", `${path}.${key}`, "Undefined values are not stable JSON inputs.");
      } else {
        validateJsonValue(entry, `${path}.${key}`, issues);
      }
    }
    return;
  }
  addIssue(issues, "input.non_json_value", path, `Unsupported JSON value type ${typeof value}.`);
}

function withheldReport<TPayload extends SourceBackedEquipmentJsonValue>(
  common: Pick<
    SourceBackedEquipmentCandidateLatticeReport<TPayload>,
    "schemaVersion" | "classification" | "inputBoundary" | "preflight"
  >,
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
): SourceBackedEquipmentCandidateLatticeReport<TPayload> {
  return {
    ...common,
    comparisonStatus: "not-comparable",
    capabilities: capabilityFlags(false),
    lattice: null,
    issues,
  };
}

function capabilityFlags(enumeration: boolean) {
  return {
    sourceClaims: false as const,
    equipmentRecommendationClaims: false as const,
    rankClaims: false as const,
    guideClaims: false as const,
    evaluation: false as const,
    damage: false as const,
    energyRecovery: false as const,
    enumeration,
  };
}

function addIssue(
  issues: SourceBackedEquipmentCandidateLatticeIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function nonEmpty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
