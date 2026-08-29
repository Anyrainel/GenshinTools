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
    | "lowest-node-id-among-tolerance-equivalent-best-values"
    | null;
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
};

/**
 * Run best-improvement coordinate descent using only values already present in
 * the finite table. Two nodes are coordinate neighbors when they differ in
 * exactly one declared dimension.
 */
export function runCachedBestImprovementCoordinateDescent(
  input: CachedCoordinateDescentInput,
): CachedCoordinateDescentTrace {
  const table = prepareTable(input.table);
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
    const currentTechnicalObjective =
      current.cachedResult.technicalObjective;
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
      (neighbor): neighbor is BoundedLatticeNode & {
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
      comparableNeighborNodeIds: comparableNeighbors.map(({ nodeId }) => nodeId),
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
              reason:
                "no-strictly-improving-comparable-neighbor" as const,
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
      (node): node is BoundedLatticeNode & {
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
    technicalObjective:
      selected.representative.cachedResult.technicalObjective,
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

  for (let depth = 1; depth <= input.maxDepth && frontier.length > 0; depth += 1) {
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
      (node): node is BoundedLatticeNode & {
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
  const coordinateOwners = new Map<string, string>();
  const sortedDimensions = [...dimensions].sort(compareStrings);
  for (const node of nodes) {
    if (node.nodeId.length === 0 || nodeById.has(node.nodeId)) {
      throw new Error(`Bounded lattice nodeId must be non-empty and unique: ${node.nodeId}`);
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
    if (
      node.cachedResult.status === "comparable" &&
      !Number.isFinite(node.cachedResult.technicalObjective)
    ) {
      throw new Error(`Node ${node.nodeId} has a non-finite technical objective.`);
    }
    if (
      node.cachedResult.status === "failure" &&
      (node.cachedResult.failure.code.length === 0 ||
        node.cachedResult.failure.message.length === 0)
    ) {
      throw new Error(`Node ${node.nodeId} has an invalid cached failure.`);
    }
    const coordinateKey = dimensions
      .map((dimension) => JSON.stringify(node.coordinates[dimension]))
      .join("\u0000");
    const owner = coordinateOwners.get(coordinateKey);
    if (owner) {
      throw new Error(
        `Nodes ${owner} and ${node.nodeId} have duplicate coordinates.`,
      );
    }
    coordinateOwners.set(coordinateKey, node.nodeId);
    nodeById.set(node.nodeId, node);
  }
  nodes.sort(compareNodeIds);
  return { dimensions, nodes, nodeById };
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

function isStrictImprovement(
  candidate: number,
  incumbent: number,
  direction: TechnicalObjectiveDirection,
  tolerance: TechnicalObjectiveTolerance,
): boolean {
  const directedDifference =
    direction === "maximize" ? candidate - incumbent : incumbent - candidate;
  return directedDifference > comparisonTolerance(candidate, incumbent, tolerance);
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
    return direction === "maximize" ? Math.max(best, value) : Math.min(best, value);
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
