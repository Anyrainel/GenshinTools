export type CachedLatticeFailure = {
  code: string;
  message: string;
};

export type CachedLatticeResult =
  | {
      status: "comparable";
      technicalObjective: number;
    }
  | {
      status: "failure";
      failure: CachedLatticeFailure;
    };

export type BoundedLatticeNode = {
  nodeId: string;
  coordinates: Readonly<Record<string, string>>;
  cachedResult: CachedLatticeResult;
};

export type BoundedLatticeNodeTable = {
  dimensions: readonly string[];
  nodes: readonly BoundedLatticeNode[];
};

export type TechnicalObjectiveDirection = "maximize" | "minimize";

export type TechnicalObjectiveTolerance = {
  absolute: number;
  relative: number;
};

export type CachedCoordinateDescentInput = {
  table: BoundedLatticeNodeTable;
  startNodeId: string;
  direction: TechnicalObjectiveDirection;
  tolerance: TechnicalObjectiveTolerance;
};

export type CachedCoordinateDescentStep = {
  iteration: number;
  currentNodeId: string;
  currentTechnicalObjective: number;
  neighborNodeIds: string[];
  comparableNeighborNodeIds: string[];
  failureNeighborNodeIds: string[];
  improvingNeighborNodeIds: string[];
  selectedNextNodeId: string | null;
  selectedEquivalentNextNodeIds: string[];
  selectedRepresentativeTiePolicy:
    "lowest-node-id-among-tolerance-equivalent-best-values" | null;
};

export type CachedCoordinateDescentTrace = {
  schemaVersion: 1;
  classification: "cached-lattice-coordinate-descent-trace";
  policy: "deterministic-best-improvement";
  evaluationSource: "cached-node-table-only";
  evaluatorCalls: 0;
  direction: TechnicalObjectiveDirection;
  tolerance: TechnicalObjectiveTolerance;
  startNodeId: string;
  pathNodeIds: string[];
  visitedNodeIds: string[];
  steps: CachedCoordinateDescentStep[];
  encounteredFailures: Array<{
    nodeId: string;
    failure: CachedLatticeFailure;
  }>;
  terminal:
    | {
        reason: "no-strictly-improving-comparable-neighbor";
        nodeId: string;
        technicalObjective: number;
        equivalentNeighborNodeIds: string[];
        plateauObserved: boolean;
      }
    | {
        reason: "neighborhood-incomparable";
        nodeId: string;
        technicalObjective: number;
        equivalentNeighborNodeIds: string[];
        plateauObserved: boolean;
        failureNeighborNodeIds: string[];
      }
    | {
        reason: "start-node-failure";
        nodeId: string;
        failure: CachedLatticeFailure;
      };
};

export type CachedOneShotBestNeighborPassInput = CachedCoordinateDescentInput;

export type CachedOneShotBestNeighborPassTrace = {
  schemaVersion: 1;
  classification: "cached-lattice-one-shot-best-neighbor-pass-trace";
  interpretation: "technical-policy-audit-only";
  policy: "deterministic-one-shot-best-neighbor";
  evaluationSource: "cached-node-table-only";
  evaluatorCalls: 0;
  maximumNeighborhoodPasses: 1;
  completedNeighborhoodPasses: 0 | 1;
  direction: TechnicalObjectiveDirection;
  tolerance: TechnicalObjectiveTolerance;
  startNodeId: string;
  pathNodeIds: string[];
  examinedNodeIds: string[];
  neighborNodeIds: string[];
  comparableNeighborNodeIds: string[];
  failureNeighborNodeIds: string[];
  improvingNeighborNodeIds: string[];
  equivalentToStartNeighborNodeIds: string[];
  selectedNextNodeId: string | null;
  selectedEquivalentNextNodeIds: string[];
  selectedRepresentativeTiePolicy:
    "lowest-node-id-among-tolerance-equivalent-best-values" | null;
  encounteredFailures: Array<{
    nodeId: string;
    failure: CachedLatticeFailure;
  }>;
  outcome:
    | {
        status: "moved";
        reason: "strictly-improving-best-neighbor-selected";
        fromNodeId: string;
        fromTechnicalObjective: number;
        toNodeId: string;
        toTechnicalObjective: number;
        bestObservedImprovingTechnicalObjective: number;
      }
    | {
        status: "unchanged";
        reason: "no-strictly-improving-comparable-neighbor";
        nodeId: string;
        technicalObjective: number;
      }
    | {
        status: "withheld";
        reason: "start-node-failure";
        nodeId: string;
        failure: CachedLatticeFailure;
      }
    | {
        status: "withheld";
        reason: "neighborhood-incomparable";
        nodeId: string;
        technicalObjective: number;
        failureNeighborNodeIds: string[];
      };
};

export type CachedDeclaredDimensionCandidateOrder = {
  dimension: string;
  candidateValues: readonly string[];
};

export type CachedDeclaredOrderFirstImprovementInput =
  CachedCoordinateDescentInput & {
    declaredOrder: readonly CachedDeclaredDimensionCandidateOrder[];
  };

export type CachedDeclaredOrderCandidate = {
  orderIndex: number;
  dimension: string;
  candidateValue: string;
  nodeId: string;
};

export type CachedDeclaredOrderCandidateCheck =
  | (CachedDeclaredOrderCandidate & {
      cachedStatus: "comparable";
      technicalObjective: number;
      toleranceEquivalentToCurrent: boolean;
      strictlyImprovesCurrent: boolean;
    })
  | (CachedDeclaredOrderCandidate & {
      cachedStatus: "failure";
      technicalObjective: null;
      toleranceEquivalentToCurrent: null;
      strictlyImprovesCurrent: null;
      failure: CachedLatticeFailure;
    });

export type CachedDeclaredOrderFirstImprovementStep = {
  iteration: number;
  currentNodeId: string;
  currentTechnicalObjective: number;
  orderedCandidates: CachedDeclaredOrderCandidate[];
  checkedCandidates: CachedDeclaredOrderCandidateCheck[];
  equivalentCheckedNodeIds: string[];
  selectedNextNodeId: string | null;
  selectedDimension: string | null;
  selectedCandidateValue: string | null;
  relevantFailureNodeId: string | null;
};

export type CachedDeclaredOrderFirstImprovementTrace = {
  schemaVersion: 1;
  classification: "cached-lattice-declared-order-first-improvement-trace";
  interpretation: "technical-policy-audit-only";
  policy: "deterministic-declared-order-first-improvement";
  evaluationSource: "cached-node-table-only";
  evaluatorCalls: 0;
  candidateSelectionPolicy: "first-strict-improvement-in-declared-order";
  toleranceTiePolicy: "declared-order-first";
  direction: TechnicalObjectiveDirection;
  tolerance: TechnicalObjectiveTolerance;
  startNodeId: string;
  declaredOrder: Array<{
    dimension: string;
    candidateValues: string[];
  }>;
  pathNodeIds: string[];
  examinedNodeIds: string[];
  steps: CachedDeclaredOrderFirstImprovementStep[];
  encounteredFailures: Array<{
    nodeId: string;
    failure: CachedLatticeFailure;
  }>;
  terminal:
    | {
        status: "complete";
        reason: "no-strictly-improving-declared-candidate";
        nodeId: string;
        technicalObjective: number;
        equivalentCheckedNodeIds: string[];
      }
    | {
        status: "withheld";
        reason: "start-node-failure";
        nodeId: string;
        failure: CachedLatticeFailure;
      }
    | {
        status: "withheld";
        reason: "relevant-cached-candidate-failure";
        nodeId: string;
        technicalObjective: number;
        failedCandidate: CachedDeclaredOrderCandidate;
        failure: CachedLatticeFailure;
      };
};

export type CachedTableBestReference =
  | {
      classification: "cached-table-best-comparable-reference";
      status: "selected";
      scope: "declared-node-table-only";
      evaluatorCalls: 0;
      direction: TechnicalObjectiveDirection;
      tolerance: TechnicalObjectiveTolerance;
      deterministicTiePolicy: "lowest-node-id-among-tolerance-equivalent-best-values";
      failureNodeIds: [];
      bestObservedTechnicalObjective: number;
      nodeId: string;
      technicalObjective: number;
      representative: {
        nodeId: string;
        technicalObjective: number;
      };
      equivalentNodeIds: string[];
    }
  | {
      classification: "cached-table-best-comparable-reference";
      status: "withheld";
      reason: "declared-node-failure";
      scope: "declared-node-table-only";
      evaluatorCalls: 0;
      direction: TechnicalObjectiveDirection;
      tolerance: TechnicalObjectiveTolerance;
      failureNodeIds: string[];
      bestObservedTechnicalObjective: null;
      nodeId: null;
      technicalObjective: null;
      representative: null;
      equivalentNodeIds: [];
    };

export type CachedBeamCoverageInput = {
  table: BoundedLatticeNodeTable;
  startNodeId: string;
  direction: TechnicalObjectiveDirection;
  tolerance: TechnicalObjectiveTolerance;
  width: number;
  maxDepth: number;
};

export type CachedBeamCoverageLevel = {
  depth: number;
  parentFrontierNodeIds: string[];
  visitedNodeIds: string[];
  comparableNodeIds: string[];
  failureNodeIds: string[];
  retainedNodeIds: string[];
  prunedComparableNodeIds: string[];
};

export type CachedBeamCoverageTrace = {
  schemaVersion: 1;
  classification: "cached-lattice-beam-coverage-trace";
  interpretation: "coverage-only";
  calibration: "not-calibrated";
  exhaustive: false;
  evaluationSource: "cached-node-table-only";
  evaluatorCalls: 0;
  direction: TechnicalObjectiveDirection;
  tolerance: TechnicalObjectiveTolerance;
  startNodeId: string;
  width: number;
  maxDepth: number;
  visitedNodeIds: string[];
  frontierByDepth: Array<{ depth: number; nodeIds: string[] }>;
  levels: CachedBeamCoverageLevel[];
  encounteredFailures: Array<{
    nodeId: string;
    failure: CachedLatticeFailure;
  }>;
};

type PreparedTable = {
  dimensions: string[];
  nodes: BoundedLatticeNode[];
  nodeById: Map<string, BoundedLatticeNode>;
  nodeByCoordinateKey: Map<string, BoundedLatticeNode>;
  candidateValuesByDimension: Map<string, string[]>;
};

/**
 * Inspect exactly one complete coordinate neighborhood and select its best
 * strict improvement. The selected node is never used as the start of another
 * pass.
 */
export function runCachedOneShotBestNeighborPass(
  input: CachedOneShotBestNeighborPassInput,
): CachedOneShotBestNeighborPassTrace {
  const table = prepareTable(input.table);
  validateCartesianClosure(table);
  validateDirection(input.direction);
  validateTolerance(input.tolerance);
  const start = requireNode(table, input.startNodeId);

  if (start.cachedResult.status === "failure") {
    return {
      schemaVersion: 1,
      classification: "cached-lattice-one-shot-best-neighbor-pass-trace",
      interpretation: "technical-policy-audit-only",
      policy: "deterministic-one-shot-best-neighbor",
      evaluationSource: "cached-node-table-only",
      evaluatorCalls: 0,
      maximumNeighborhoodPasses: 1,
      completedNeighborhoodPasses: 0,
      direction: input.direction,
      tolerance: { ...input.tolerance },
      startNodeId: start.nodeId,
      pathNodeIds: [start.nodeId],
      examinedNodeIds: [start.nodeId],
      neighborNodeIds: [],
      comparableNeighborNodeIds: [],
      failureNeighborNodeIds: [],
      improvingNeighborNodeIds: [],
      equivalentToStartNeighborNodeIds: [],
      selectedNextNodeId: null,
      selectedEquivalentNextNodeIds: [],
      selectedRepresentativeTiePolicy: null,
      encounteredFailures: [
        { nodeId: start.nodeId, failure: start.cachedResult.failure },
      ],
      outcome: {
        status: "withheld",
        reason: "start-node-failure",
        nodeId: start.nodeId,
        failure: start.cachedResult.failure,
      },
    };
  }

  const startTechnicalObjective = start.cachedResult.technicalObjective;
  const neighbors = completeCoordinateNeighbors(table, start);
  const comparableNeighbors = neighbors.filter(
    (
      neighbor,
    ): neighbor is BoundedLatticeNode & {
      cachedResult: Extract<CachedLatticeResult, { status: "comparable" }>;
    } => neighbor.cachedResult.status === "comparable",
  );
  const failureNeighbors = neighbors.filter(
    (
      neighbor,
    ): neighbor is BoundedLatticeNode & {
      cachedResult: Extract<CachedLatticeResult, { status: "failure" }>;
    } => neighbor.cachedResult.status === "failure",
  );
  const improvingNeighbors = comparableNeighbors.filter((neighbor) =>
    isStrictImprovement(
      neighbor.cachedResult.technicalObjective,
      startTechnicalObjective,
      input.direction,
      input.tolerance,
    ),
  );
  const equivalentToStartNeighborNodeIds = comparableNeighbors
    .filter((neighbor) =>
      areToleranceEquivalent(
        neighbor.cachedResult.technicalObjective,
        startTechnicalObjective,
        input.tolerance,
      ),
    )
    .map(nodeIdOf);
  const selectedGroup = selectBestComparableGroup(
    improvingNeighbors,
    input.direction,
    input.tolerance,
  );
  const selected =
    failureNeighbors.length === 0
      ? (selectedGroup?.representative ?? null)
      : null;
  const encounteredFailures = new Map<string, CachedLatticeFailure>();
  for (const neighbor of failureNeighbors) {
    encounteredFailures.set(neighbor.nodeId, neighbor.cachedResult.failure);
  }

  const common = {
    schemaVersion: 1 as const,
    classification: "cached-lattice-one-shot-best-neighbor-pass-trace" as const,
    interpretation: "technical-policy-audit-only" as const,
    policy: "deterministic-one-shot-best-neighbor" as const,
    evaluationSource: "cached-node-table-only" as const,
    evaluatorCalls: 0 as const,
    maximumNeighborhoodPasses: 1 as const,
    completedNeighborhoodPasses: 1 as const,
    direction: input.direction,
    tolerance: { ...input.tolerance },
    startNodeId: start.nodeId,
    pathNodeIds: selected ? [start.nodeId, selected.nodeId] : [start.nodeId],
    examinedNodeIds: [start.nodeId, ...neighbors.map(nodeIdOf)],
    neighborNodeIds: neighbors.map(nodeIdOf),
    comparableNeighborNodeIds: comparableNeighbors.map(nodeIdOf),
    failureNeighborNodeIds: failureNeighbors.map(nodeIdOf),
    improvingNeighborNodeIds: improvingNeighbors.map(nodeIdOf),
    equivalentToStartNeighborNodeIds,
    selectedNextNodeId: selected?.nodeId ?? null,
    selectedEquivalentNextNodeIds: selected
      ? (selectedGroup?.equivalentNodeIds ?? [])
      : [],
    selectedRepresentativeTiePolicy: selected
      ? ("lowest-node-id-among-tolerance-equivalent-best-values" as const)
      : null,
    encounteredFailures: failureEntries(encounteredFailures),
  };

  if (failureNeighbors.length > 0) {
    return {
      ...common,
      outcome: {
        status: "withheld",
        reason: "neighborhood-incomparable",
        nodeId: start.nodeId,
        technicalObjective: startTechnicalObjective,
        failureNeighborNodeIds: failureNeighbors.map(nodeIdOf),
      },
    };
  }
  if (!selected || !selectedGroup) {
    return {
      ...common,
      outcome: {
        status: "unchanged",
        reason: "no-strictly-improving-comparable-neighbor",
        nodeId: start.nodeId,
        technicalObjective: startTechnicalObjective,
      },
    };
  }
  return {
    ...common,
    outcome: {
      status: "moved",
      reason: "strictly-improving-best-neighbor-selected",
      fromNodeId: start.nodeId,
      fromTechnicalObjective: startTechnicalObjective,
      toNodeId: selected.nodeId,
      toTechnicalObjective: selected.cachedResult.technicalObjective,
      bestObservedImprovingTechnicalObjective:
        selectedGroup.bestObservedTechnicalObjective,
    },
  };
}

/**
 * Repeatedly select the first strict improvement encountered in the declared
 * dimension and candidate-value order. Each new node restarts that order.
 */
export function runCachedDeclaredOrderFirstImprovementCoordinateDescent(
  input: CachedDeclaredOrderFirstImprovementInput,
): CachedDeclaredOrderFirstImprovementTrace {
  const table = prepareTable(input.table);
  validateCartesianClosure(table);
  validateDirection(input.direction);
  validateTolerance(input.tolerance);
  const declaredOrder = prepareDeclaredOrder(table, input.declaredOrder);
  const start = requireNode(table, input.startNodeId);
  const examinedNodeIds = [start.nodeId];
  const examined = new Set(examinedNodeIds);
  const encounteredFailures = new Map<string, CachedLatticeFailure>();
  const common = {
    schemaVersion: 1 as const,
    classification:
      "cached-lattice-declared-order-first-improvement-trace" as const,
    interpretation: "technical-policy-audit-only" as const,
    policy: "deterministic-declared-order-first-improvement" as const,
    evaluationSource: "cached-node-table-only" as const,
    evaluatorCalls: 0 as const,
    candidateSelectionPolicy:
      "first-strict-improvement-in-declared-order" as const,
    toleranceTiePolicy: "declared-order-first" as const,
    direction: input.direction,
    tolerance: { ...input.tolerance },
    startNodeId: start.nodeId,
    declaredOrder: declaredOrder.map(({ dimension, candidateValues }) => ({
      dimension,
      candidateValues: [...candidateValues],
    })),
  };

  if (start.cachedResult.status === "failure") {
    encounteredFailures.set(start.nodeId, start.cachedResult.failure);
    return {
      ...common,
      pathNodeIds: [start.nodeId],
      examinedNodeIds,
      steps: [],
      encounteredFailures: failureEntries(encounteredFailures),
      terminal: {
        status: "withheld",
        reason: "start-node-failure",
        nodeId: start.nodeId,
        failure: start.cachedResult.failure,
      },
    };
  }

  const pathNodeIds = [start.nodeId];
  const steps: CachedDeclaredOrderFirstImprovementStep[] = [];
  let current = start;

  while (current.cachedResult.status === "comparable") {
    const currentTechnicalObjective = current.cachedResult.technicalObjective;
    const orderedCandidates = orderedCoordinateCandidates(
      table,
      current,
      declaredOrder,
    );
    const checkedCandidates: CachedDeclaredOrderCandidateCheck[] = [];
    let selected: {
      descriptor: CachedDeclaredOrderCandidate;
      node: BoundedLatticeNode & {
        cachedResult: Extract<CachedLatticeResult, { status: "comparable" }>;
      };
    } | null = null;

    for (const descriptor of orderedCandidates) {
      const candidate = table.nodeById.get(descriptor.nodeId);
      if (!candidate) {
        throw new Error(
          `Declared candidate ${descriptor.nodeId} disappeared from the prepared table.`,
        );
      }
      if (!examined.has(candidate.nodeId)) {
        examined.add(candidate.nodeId);
        examinedNodeIds.push(candidate.nodeId);
      }
      if (candidate.cachedResult.status === "failure") {
        encounteredFailures.set(
          candidate.nodeId,
          candidate.cachedResult.failure,
        );
        checkedCandidates.push({
          ...descriptor,
          cachedStatus: "failure",
          technicalObjective: null,
          toleranceEquivalentToCurrent: null,
          strictlyImprovesCurrent: null,
          failure: candidate.cachedResult.failure,
        });
        steps.push({
          iteration: steps.length,
          currentNodeId: current.nodeId,
          currentTechnicalObjective,
          orderedCandidates,
          checkedCandidates,
          equivalentCheckedNodeIds: checkedCandidates
            .filter(
              (check) =>
                check.cachedStatus === "comparable" &&
                check.toleranceEquivalentToCurrent,
            )
            .map(({ nodeId }) => nodeId),
          selectedNextNodeId: null,
          selectedDimension: null,
          selectedCandidateValue: null,
          relevantFailureNodeId: candidate.nodeId,
        });
        return {
          ...common,
          pathNodeIds,
          examinedNodeIds,
          steps,
          encounteredFailures: failureEntries(encounteredFailures),
          terminal: {
            status: "withheld",
            reason: "relevant-cached-candidate-failure",
            nodeId: current.nodeId,
            technicalObjective: currentTechnicalObjective,
            failedCandidate: descriptor,
            failure: candidate.cachedResult.failure,
          },
        };
      }

      const comparableCandidate = candidate as BoundedLatticeNode & {
        cachedResult: Extract<CachedLatticeResult, { status: "comparable" }>;
      };
      const toleranceEquivalentToCurrent = areToleranceEquivalent(
        comparableCandidate.cachedResult.technicalObjective,
        currentTechnicalObjective,
        input.tolerance,
      );
      const strictlyImprovesCurrent = isStrictImprovement(
        comparableCandidate.cachedResult.technicalObjective,
        currentTechnicalObjective,
        input.direction,
        input.tolerance,
      );
      checkedCandidates.push({
        ...descriptor,
        cachedStatus: "comparable",
        technicalObjective: comparableCandidate.cachedResult.technicalObjective,
        toleranceEquivalentToCurrent,
        strictlyImprovesCurrent,
      });
      if (strictlyImprovesCurrent) {
        selected = { descriptor, node: comparableCandidate };
        break;
      }
    }

    const equivalentCheckedNodeIds = checkedCandidates
      .filter(
        (check) =>
          check.cachedStatus === "comparable" &&
          check.toleranceEquivalentToCurrent,
      )
      .map(({ nodeId }) => nodeId);
    steps.push({
      iteration: steps.length,
      currentNodeId: current.nodeId,
      currentTechnicalObjective,
      orderedCandidates,
      checkedCandidates,
      equivalentCheckedNodeIds,
      selectedNextNodeId: selected?.node.nodeId ?? null,
      selectedDimension: selected?.descriptor.dimension ?? null,
      selectedCandidateValue: selected?.descriptor.candidateValue ?? null,
      relevantFailureNodeId: null,
    });

    if (!selected) {
      return {
        ...common,
        pathNodeIds,
        examinedNodeIds,
        steps,
        encounteredFailures: failureEntries(encounteredFailures),
        terminal: {
          status: "complete",
          reason: "no-strictly-improving-declared-candidate",
          nodeId: current.nodeId,
          technicalObjective: currentTechnicalObjective,
          equivalentCheckedNodeIds,
        },
      };
    }

    current = selected.node;
    pathNodeIds.push(current.nodeId);
  }

  throw new Error(
    "Declared-order first improvement selected an incomparable cached result.",
  );
}

/**
 * Run best-improvement coordinate descent using only values already present in
 * the finite table. Two nodes are coordinate neighbors when they differ in
 * exactly one declared dimension.
 */
export function runCachedBestImprovementCoordinateDescent(
  input: CachedCoordinateDescentInput,
): CachedCoordinateDescentTrace {
  const table = prepareTable(input.table);
  validateDirection(input.direction);
  validateTolerance(input.tolerance);
  const start = requireNode(table, input.startNodeId);
  const visitedNodeIds: string[] = [start.nodeId];
  const visited = new Set(visitedNodeIds);
  const encounteredFailures = new Map<string, CachedLatticeFailure>();

  if (start.cachedResult.status === "failure") {
    encounteredFailures.set(start.nodeId, start.cachedResult.failure);
    return {
      schemaVersion: 1,
      classification: "cached-lattice-coordinate-descent-trace",
      policy: "deterministic-best-improvement",
      evaluationSource: "cached-node-table-only",
      evaluatorCalls: 0,
      direction: input.direction,
      tolerance: { ...input.tolerance },
      startNodeId: start.nodeId,
      pathNodeIds: [start.nodeId],
      visitedNodeIds,
      steps: [],
      encounteredFailures: failureEntries(encounteredFailures),
      terminal: {
        reason: "start-node-failure",
        nodeId: start.nodeId,
        failure: start.cachedResult.failure,
      },
    };
  }

  const pathNodeIds = [start.nodeId];
  const steps: CachedCoordinateDescentStep[] = [];
  let current = start;

  while (current.cachedResult.status === "comparable") {
    const currentTechnicalObjective = current.cachedResult.technicalObjective;
    const neighbors = coordinateNeighbors(table, current);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.nodeId)) {
        visited.add(neighbor.nodeId);
        visitedNodeIds.push(neighbor.nodeId);
      }
      if (neighbor.cachedResult.status === "failure") {
        encounteredFailures.set(neighbor.nodeId, neighbor.cachedResult.failure);
      }
    }

    const comparableNeighbors = neighbors.filter(
      (
        neighbor,
      ): neighbor is BoundedLatticeNode & {
        cachedResult: Extract<CachedLatticeResult, { status: "comparable" }>;
      } => neighbor.cachedResult.status === "comparable",
    );
    const improvingNeighbors = comparableNeighbors.filter((neighbor) =>
      isStrictImprovement(
        neighbor.cachedResult.technicalObjective,
        currentTechnicalObjective,
        input.direction,
        input.tolerance,
      ),
    );
    const selectedGroup = selectBestComparableGroup(
      improvingNeighbors,
      input.direction,
      input.tolerance,
    );
    const equivalentNeighborNodeIds = comparableNeighbors
      .filter(
        (neighbor) =>
          Math.abs(
            neighbor.cachedResult.technicalObjective -
              currentTechnicalObjective,
          ) <=
          comparisonTolerance(
            neighbor.cachedResult.technicalObjective,
            currentTechnicalObjective,
            input.tolerance,
          ),
      )
      .map(nodeIdOf);
    const failureNeighborNodeIds = neighbors
      .filter(({ cachedResult }) => cachedResult.status === "failure")
      .map(nodeIdOf);
    // Best improvement is unknowable when any coordinate neighbor failed.
    // Preserve the comparable observations, but do not move along a
    // survivor-only ordering.
    const selected =
      failureNeighborNodeIds.length === 0
        ? (selectedGroup?.representative ?? null)
        : null;
    const selectedEquivalentNextNodeIds = selected
      ? (selectedGroup?.equivalentNodeIds ?? [])
      : [];

    steps.push({
      iteration: steps.length,
      currentNodeId: current.nodeId,
      currentTechnicalObjective,
      neighborNodeIds: neighbors.map(({ nodeId }) => nodeId),
      comparableNeighborNodeIds: comparableNeighbors.map(
        ({ nodeId }) => nodeId,
      ),
      failureNeighborNodeIds,
      improvingNeighborNodeIds: improvingNeighbors.map(({ nodeId }) => nodeId),
      selectedNextNodeId: selected?.nodeId ?? null,
      selectedEquivalentNextNodeIds,
      selectedRepresentativeTiePolicy: selected
        ? "lowest-node-id-among-tolerance-equivalent-best-values"
        : null,
    });

    if (!selected) {
      const terminal =
        failureNeighborNodeIds.length > 0
          ? {
              reason: "neighborhood-incomparable" as const,
              nodeId: current.nodeId,
              technicalObjective: currentTechnicalObjective,
              equivalentNeighborNodeIds,
              plateauObserved: equivalentNeighborNodeIds.length > 0,
              failureNeighborNodeIds,
            }
          : {
              reason: "no-strictly-improving-comparable-neighbor" as const,
              nodeId: current.nodeId,
              technicalObjective: currentTechnicalObjective,
              equivalentNeighborNodeIds,
              plateauObserved: equivalentNeighborNodeIds.length > 0,
            };
      return {
        schemaVersion: 1,
        classification: "cached-lattice-coordinate-descent-trace",
        policy: "deterministic-best-improvement",
        evaluationSource: "cached-node-table-only",
        evaluatorCalls: 0,
        direction: input.direction,
        tolerance: { ...input.tolerance },
        startNodeId: start.nodeId,
        pathNodeIds,
        visitedNodeIds,
        steps,
        encounteredFailures: failureEntries(encounteredFailures),
        terminal,
      };
    }

    current = selected;
    pathNodeIds.push(current.nodeId);
  }

  throw new Error("Coordinate descent selected an incomparable cached result.");
}

/** Return the best comparable node in the declared cached table. */
export function selectCachedTableBestComparableReference(
  tableInput: BoundedLatticeNodeTable,
  direction: TechnicalObjectiveDirection,
  tolerance: TechnicalObjectiveTolerance,
): CachedTableBestReference {
  const table = prepareTable(tableInput);
  validateDirection(direction);
  validateTolerance(tolerance);
  const failureNodeIds = table.nodes
    .filter(({ cachedResult }) => cachedResult.status === "failure")
    .map(nodeIdOf);
  if (failureNodeIds.length > 0) {
    return {
      classification: "cached-table-best-comparable-reference",
      status: "withheld",
      reason: "declared-node-failure",
      scope: "declared-node-table-only",
      evaluatorCalls: 0,
      direction,
      tolerance: { ...tolerance },
      failureNodeIds,
      bestObservedTechnicalObjective: null,
      nodeId: null,
      technicalObjective: null,
      representative: null,
      equivalentNodeIds: [],
    };
  }
  const selected = selectBestComparableGroup(
    table.nodes.filter(
      (
        node,
      ): node is BoundedLatticeNode & {
        cachedResult: Extract<CachedLatticeResult, { status: "comparable" }>;
      } => node.cachedResult.status === "comparable",
    ),
    direction,
    tolerance,
  );
  if (!selected) {
    throw new Error("A failure-free cached table has no comparable node.");
  }
  return {
    classification: "cached-table-best-comparable-reference",
    status: "selected",
    scope: "declared-node-table-only",
    evaluatorCalls: 0,
    direction,
    tolerance: { ...tolerance },
    deterministicTiePolicy:
      "lowest-node-id-among-tolerance-equivalent-best-values",
    failureNodeIds: [],
    bestObservedTechnicalObjective: selected.bestObservedTechnicalObjective,
    nodeId: selected.representative.nodeId,
    technicalObjective: selected.representative.cachedResult.technicalObjective,
    representative: {
      nodeId: selected.representative.nodeId,
      technicalObjective:
        selected.representative.cachedResult.technicalObjective,
    },
    equivalentNodeIds: selected.equivalentNodeIds,
  };
}

/**
 * Trace cached-node coverage under a bounded beam. This is deliberately a
 * coverage diagnostic: it is not calibrated and makes no exhaustive claim.
 */
export function traceCachedBeamCoverage(
  input: CachedBeamCoverageInput,
): CachedBeamCoverageTrace {
  const table = prepareTable(input.table);
  validateDirection(input.direction);
  validateTolerance(input.tolerance);
  if (!Number.isInteger(input.width) || input.width < 1) {
    throw new Error("Beam width must be a positive integer.");
  }
  if (!Number.isInteger(input.maxDepth) || input.maxDepth < 0) {
    throw new Error("Beam maxDepth must be a non-negative integer.");
  }

  const start = requireNode(table, input.startNodeId);
  const visited = new Set<string>([start.nodeId]);
  const visitedNodeIds = [start.nodeId];
  const encounteredFailures = new Map<string, CachedLatticeFailure>();
  if (start.cachedResult.status === "failure") {
    encounteredFailures.set(start.nodeId, start.cachedResult.failure);
  }
  let frontier = start.cachedResult.status === "comparable" ? [start] : [];
  const frontierByDepth = [{ depth: 0, nodeIds: frontier.map(nodeIdOf) }];
  const levels: CachedBeamCoverageLevel[] = [];

  for (
    let depth = 1;
    depth <= input.maxDepth && frontier.length > 0;
    depth += 1
  ) {
    const discoveredById = new Map<string, BoundedLatticeNode>();
    for (const parent of frontier) {
      for (const neighbor of coordinateNeighbors(table, parent)) {
        if (!visited.has(neighbor.nodeId)) {
          discoveredById.set(neighbor.nodeId, neighbor);
        }
      }
    }
    const discovered = [...discoveredById.values()].sort(compareNodeIds);
    for (const node of discovered) {
      visited.add(node.nodeId);
      visitedNodeIds.push(node.nodeId);
      if (node.cachedResult.status === "failure") {
        encounteredFailures.set(node.nodeId, node.cachedResult.failure);
      }
    }
    const comparable = discovered.filter(
      (
        node,
      ): node is BoundedLatticeNode & {
        cachedResult: Extract<CachedLatticeResult, { status: "comparable" }>;
      } => node.cachedResult.status === "comparable",
    );
    const ranked = rankComparableNodes(
      comparable,
      input.direction,
      input.tolerance,
    );
    const retained = ranked.slice(0, input.width);
    const pruned = ranked.slice(input.width);

    levels.push({
      depth,
      parentFrontierNodeIds: frontier.map(nodeIdOf),
      visitedNodeIds: discovered.map(nodeIdOf),
      comparableNodeIds: comparable.map(nodeIdOf),
      failureNodeIds: discovered
        .filter(({ cachedResult }) => cachedResult.status === "failure")
        .map(nodeIdOf),
      retainedNodeIds: retained.map(nodeIdOf),
      prunedComparableNodeIds: pruned.map(nodeIdOf),
    });
    frontier = retained;
    frontierByDepth.push({ depth, nodeIds: frontier.map(nodeIdOf) });
  }

  return {
    schemaVersion: 1,
    classification: "cached-lattice-beam-coverage-trace",
    interpretation: "coverage-only",
    calibration: "not-calibrated",
    exhaustive: false,
    evaluationSource: "cached-node-table-only",
    evaluatorCalls: 0,
    direction: input.direction,
    tolerance: { ...input.tolerance },
    startNodeId: start.nodeId,
    width: input.width,
    maxDepth: input.maxDepth,
    visitedNodeIds,
    frontierByDepth,
    levels,
    encounteredFailures: failureEntries(encounteredFailures),
  };
}

function prepareTable(input: BoundedLatticeNodeTable): PreparedTable {
  if (input.dimensions.length === 0) {
    throw new Error("A bounded lattice must declare at least one dimension.");
  }
  const dimensions = [...input.dimensions];
  if (new Set(dimensions).size !== dimensions.length) {
    throw new Error("Bounded lattice dimensions must be unique.");
  }
  if (dimensions.some((dimension) => dimension.length === 0)) {
    throw new Error("Bounded lattice dimension names must be non-empty.");
  }
  if (input.nodes.length === 0) {
    throw new Error("A bounded lattice node table must not be empty.");
  }

  const nodes = [...input.nodes];
  const nodeById = new Map<string, BoundedLatticeNode>();
  const nodeByCoordinateKey = new Map<string, BoundedLatticeNode>();
  const candidateValueSetsByDimension = new Map<string, Set<string>>(
    dimensions.map((dimension) => [dimension, new Set<string>()]),
  );
  const sortedDimensions = [...dimensions].sort(compareStrings);
  for (const node of nodes) {
    if (node.nodeId.length === 0 || nodeById.has(node.nodeId)) {
      throw new Error(
        `Bounded lattice nodeId must be non-empty and unique: ${node.nodeId}`,
      );
    }
    const coordinateKeys = Object.keys(node.coordinates).sort(compareStrings);
    if (
      coordinateKeys.length !== sortedDimensions.length ||
      coordinateKeys.some((key, index) => key !== sortedDimensions[index])
    ) {
      throw new Error(
        `Node ${node.nodeId} coordinates must match the declared dimensions.`,
      );
    }
    for (const dimension of dimensions) {
      const candidateValue = node.coordinates[dimension];
      if (typeof candidateValue !== "string" || candidateValue.length === 0) {
        throw new Error(
          `Node ${node.nodeId} coordinate ${dimension} must be a non-empty string.`,
        );
      }
      candidateValueSetsByDimension.get(dimension)?.add(candidateValue);
    }
    const cachedResult: unknown = node.cachedResult;
    if (!isRecord(cachedResult)) {
      throw new Error(`Node ${node.nodeId} has an invalid cached result.`);
    }
    if (cachedResult.status === "comparable") {
      if (
        typeof cachedResult.technicalObjective !== "number" ||
        !Number.isFinite(cachedResult.technicalObjective)
      ) {
        throw new Error(
          `Node ${node.nodeId} has a non-finite technical objective.`,
        );
      }
    } else if (cachedResult.status === "failure") {
      if (
        !isRecord(cachedResult.failure) ||
        typeof cachedResult.failure.code !== "string" ||
        cachedResult.failure.code.length === 0 ||
        typeof cachedResult.failure.message !== "string" ||
        cachedResult.failure.message.length === 0
      ) {
        throw new Error(`Node ${node.nodeId} has an invalid cached failure.`);
      }
    } else {
      throw new Error(
        `Node ${node.nodeId} has an invalid cached result status.`,
      );
    }
    const coordinateKey = coordinateKeyOf(dimensions, node.coordinates);
    const owner = nodeByCoordinateKey.get(coordinateKey);
    if (owner) {
      throw new Error(
        `Nodes ${owner.nodeId} and ${node.nodeId} have duplicate coordinates.`,
      );
    }
    nodeByCoordinateKey.set(coordinateKey, node);
    nodeById.set(node.nodeId, node);
  }
  nodes.sort(compareNodeIds);
  const candidateValuesByDimension = new Map<string, string[]>();
  for (const dimension of dimensions) {
    candidateValuesByDimension.set(
      dimension,
      [...(candidateValueSetsByDimension.get(dimension) ?? [])].sort(
        compareStrings,
      ),
    );
  }
  return {
    dimensions,
    nodes,
    nodeById,
    nodeByCoordinateKey,
    candidateValuesByDimension,
  };
}

function validateCartesianClosure(table: PreparedTable): void {
  let expectedNodeCount = 1;
  for (const dimension of table.dimensions) {
    const candidateValueCount =
      table.candidateValuesByDimension.get(dimension)?.length ?? 0;
    if (
      candidateValueCount === 0 ||
      expectedNodeCount > Number.MAX_SAFE_INTEGER / candidateValueCount
    ) {
      throw new Error(
        "Bounded lattice Cartesian node count must be a safe positive integer.",
      );
    }
    expectedNodeCount *= candidateValueCount;
  }
  if (table.nodes.length !== expectedNodeCount) {
    throw new Error(
      `Bounded lattice is missing Cartesian coordinates: expected ${expectedNodeCount}, received ${table.nodes.length}.`,
    );
  }
}

function requireNode(table: PreparedTable, nodeId: string): BoundedLatticeNode {
  const node = table.nodeById.get(nodeId);
  if (!node) {
    throw new Error(`Unknown bounded lattice start node: ${nodeId}`);
  }
  return node;
}

function coordinateNeighbors(
  table: PreparedTable,
  target: BoundedLatticeNode,
): BoundedLatticeNode[] {
  return table.nodes.filter((candidate) => {
    if (candidate.nodeId === target.nodeId) {
      return false;
    }
    let differences = 0;
    for (const dimension of table.dimensions) {
      if (candidate.coordinates[dimension] !== target.coordinates[dimension]) {
        differences += 1;
      }
      if (differences > 1) {
        return false;
      }
    }
    return differences === 1;
  });
}

function completeCoordinateNeighbors(
  table: PreparedTable,
  target: BoundedLatticeNode,
): BoundedLatticeNode[] {
  const neighbors = new Map<string, BoundedLatticeNode>();
  for (const dimension of table.dimensions) {
    const candidateValues = table.candidateValuesByDimension.get(dimension);
    if (!candidateValues) {
      throw new Error(`Missing candidate-value domain for ${dimension}.`);
    }
    for (const candidateValue of candidateValues) {
      if (candidateValue === target.coordinates[dimension]) {
        continue;
      }
      const coordinates = {
        ...target.coordinates,
        [dimension]: candidateValue,
      };
      const neighbor = table.nodeByCoordinateKey.get(
        coordinateKeyOf(table.dimensions, coordinates),
      );
      if (!neighbor) {
        throw new Error(
          `Missing bounded lattice coordinate from node ${target.nodeId}: ${dimension}=${JSON.stringify(candidateValue)}.`,
        );
      }
      neighbors.set(neighbor.nodeId, neighbor);
    }
  }
  return [...neighbors.values()].sort(compareNodeIds);
}

function prepareDeclaredOrder(
  table: PreparedTable,
  input: readonly CachedDeclaredDimensionCandidateOrder[],
): Array<{ dimension: string; candidateValues: string[] }> {
  if (!Array.isArray(input) || input.length !== table.dimensions.length) {
    throw new Error(
      "Declared order must contain each bounded lattice dimension exactly once.",
    );
  }
  const seenDimensions = new Set<string>();
  const declaredOrder: Array<{
    dimension: string;
    candidateValues: string[];
  }> = [];
  for (const entry of input) {
    if (
      !entry ||
      typeof entry.dimension !== "string" ||
      !table.dimensions.includes(entry.dimension) ||
      seenDimensions.has(entry.dimension)
    ) {
      throw new Error(
        "Declared order must contain each bounded lattice dimension exactly once.",
      );
    }
    if (!Array.isArray(entry.candidateValues)) {
      throw new Error(
        `Declared candidate order for ${entry.dimension} must be an array.`,
      );
    }
    const candidateValues = [...entry.candidateValues];
    if (
      candidateValues.some(
        (candidateValue) =>
          typeof candidateValue !== "string" || candidateValue.length === 0,
      ) ||
      new Set(candidateValues).size !== candidateValues.length
    ) {
      throw new Error(
        `Declared candidate order for ${entry.dimension} must contain unique non-empty strings.`,
      );
    }
    const actualValues =
      table.candidateValuesByDimension.get(entry.dimension) ?? [];
    if (
      candidateValues.length !== actualValues.length ||
      actualValues.some(
        (candidateValue) => !candidateValues.includes(candidateValue),
      )
    ) {
      throw new Error(
        `Declared candidate order for ${entry.dimension} must contain its exact table domain.`,
      );
    }
    seenDimensions.add(entry.dimension);
    declaredOrder.push({
      dimension: entry.dimension,
      candidateValues,
    });
  }
  return declaredOrder;
}

function orderedCoordinateCandidates(
  table: PreparedTable,
  current: BoundedLatticeNode,
  declaredOrder: readonly {
    dimension: string;
    candidateValues: readonly string[];
  }[],
): CachedDeclaredOrderCandidate[] {
  const candidates: CachedDeclaredOrderCandidate[] = [];
  for (const { dimension, candidateValues } of declaredOrder) {
    for (const candidateValue of candidateValues) {
      if (candidateValue === current.coordinates[dimension]) {
        continue;
      }
      const coordinates = {
        ...current.coordinates,
        [dimension]: candidateValue,
      };
      const candidate = table.nodeByCoordinateKey.get(
        coordinateKeyOf(table.dimensions, coordinates),
      );
      if (!candidate) {
        throw new Error(
          `Missing bounded lattice coordinate from node ${current.nodeId}: ${dimension}=${JSON.stringify(candidateValue)}.`,
        );
      }
      candidates.push({
        orderIndex: candidates.length,
        dimension,
        candidateValue,
        nodeId: candidate.nodeId,
      });
    }
  }
  return candidates;
}

function isStrictImprovement(
  candidate: number,
  incumbent: number,
  direction: TechnicalObjectiveDirection,
  tolerance: TechnicalObjectiveTolerance,
): boolean {
  const directedDifference =
    direction === "maximize" ? candidate - incumbent : incumbent - candidate;
  return (
    directedDifference > comparisonTolerance(candidate, incumbent, tolerance)
  );
}

function areToleranceEquivalent(
  left: number,
  right: number,
  tolerance: TechnicalObjectiveTolerance,
): boolean {
  return Math.abs(left - right) <= comparisonTolerance(left, right, tolerance);
}

function selectBestComparableGroup<
  T extends BoundedLatticeNode & {
    cachedResult: Extract<CachedLatticeResult, { status: "comparable" }>;
  },
>(
  nodes: readonly T[],
  direction: TechnicalObjectiveDirection,
  tolerance: TechnicalObjectiveTolerance,
): {
  representative: T;
  bestObservedTechnicalObjective: number;
  equivalentNodeIds: string[];
} | null {
  if (nodes.length === 0) {
    return null;
  }
  const exactBestValue = nodes.reduce((best, node) => {
    const value = node.cachedResult.technicalObjective;
    return direction === "maximize"
      ? Math.max(best, value)
      : Math.min(best, value);
  }, nodes[0].cachedResult.technicalObjective);
  const equivalentNodes = nodes
    .filter(
      (node) =>
        Math.abs(node.cachedResult.technicalObjective - exactBestValue) <=
        comparisonTolerance(
          node.cachedResult.technicalObjective,
          exactBestValue,
          tolerance,
        ),
    )
    .sort(compareNodeIds);
  const representative = equivalentNodes[0];
  if (!representative) {
    return null;
  }
  return {
    representative,
    bestObservedTechnicalObjective: exactBestValue,
    equivalentNodeIds: equivalentNodes.map(nodeIdOf),
  };
}

function rankComparableNodes<
  T extends BoundedLatticeNode & {
    cachedResult: Extract<CachedLatticeResult, { status: "comparable" }>;
  },
>(
  nodes: readonly T[],
  direction: TechnicalObjectiveDirection,
  tolerance: TechnicalObjectiveTolerance,
): T[] {
  const remaining = [...nodes];
  const ranked: T[] = [];
  while (remaining.length > 0) {
    const nextGroup = selectBestComparableGroup(
      remaining,
      direction,
      tolerance,
    );
    if (!nextGroup) {
      break;
    }
    const next = nextGroup.representative;
    ranked.push(next);
    remaining.splice(
      remaining.findIndex(({ nodeId }) => nodeId === next.nodeId),
      1,
    );
  }
  return ranked;
}

function comparisonTolerance(
  left: number,
  right: number,
  tolerance: TechnicalObjectiveTolerance,
): number {
  return Math.max(
    tolerance.absolute,
    tolerance.relative * Math.max(Math.abs(left), Math.abs(right)),
  );
}

function validateTolerance(tolerance: TechnicalObjectiveTolerance): void {
  if (
    !Number.isFinite(tolerance.absolute) ||
    tolerance.absolute < 0 ||
    !Number.isFinite(tolerance.relative) ||
    tolerance.relative < 0
  ) {
    throw new Error("Objective tolerances must be finite and non-negative.");
  }
}

function validateDirection(direction: TechnicalObjectiveDirection): void {
  if (direction !== "maximize" && direction !== "minimize") {
    throw new Error(
      "Technical objective direction must be maximize or minimize.",
    );
  }
}

function coordinateKeyOf(
  dimensions: readonly string[],
  coordinates: Readonly<Record<string, string>>,
): string {
  return dimensions
    .map((dimension) => JSON.stringify(coordinates[dimension]))
    .join("\u0000");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failureEntries(
  failures: ReadonlyMap<string, CachedLatticeFailure>,
): Array<{ nodeId: string; failure: CachedLatticeFailure }> {
  return [...failures.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([nodeId, failure]) => ({ nodeId, failure }));
}

function compareNodeIds(
  left: Pick<BoundedLatticeNode, "nodeId">,
  right: Pick<BoundedLatticeNode, "nodeId">,
): number {
  return compareStrings(left.nodeId, right.nodeId);
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function nodeIdOf(node: Pick<BoundedLatticeNode, "nodeId">): string {
  return node.nodeId;
}
