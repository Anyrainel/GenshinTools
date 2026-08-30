import { createHash } from "node:crypto";
import {
  runCachedBestImprovementCoordinateDescent,
  runCachedDeclaredOrderFirstImprovementCoordinateDescent,
  runCachedOneShotBestNeighborPass,
  selectCachedTableBestComparableReference,
  type BoundedLatticeNodeTable,
  type CachedCoordinateDescentTrace,
  type CachedDeclaredDimensionCandidateOrder,
  type CachedDeclaredOrderFirstImprovementTrace,
  type CachedOneShotBestNeighborPassTrace,
  type TechnicalObjectiveDirection,
  type TechnicalObjectiveTolerance,
} from "./boundedLatticePolicy";
import { sha256Text, stableJson } from "./io";

export type BuildCachedPolicyRobustnessCensusInput = {
  table: BoundedLatticeNodeTable;
  /**
   * Exact complete node order used for stable ordinals and compact witnesses.
   * This is deliberately caller-supplied rather than inferred from node IDs.
   */
  startNodeIds: readonly string[];
  declaredOrderSeed: readonly CachedDeclaredDimensionCandidateOrder[];
  direction: TechnicalObjectiveDirection;
  tolerance: TechnicalObjectiveTolerance;
};

export type CachedPolicyTerminalBasin = {
  terminalNodeId: string;
  terminalTechnicalObjective: number;
  startNodeIds: string[];
  startCount: number;
  startNodeIdsSha256: string;
};

export type CachedPolicyMoveCountHistogramRow = {
  moveCount: number;
  traceCount: number;
};

export type CachedDeclaredOrderWitness = {
  classification:
    | "canonical-order"
    | "reverse-order"
    | "longest-path"
    | "minimum-reference-basin"
    | "maximum-reference-basin";
  orderOrdinal: number;
  orderSha256: string;
  declaredOrder: Array<{
    dimension: string;
    candidateValues: string[];
  }>;
  startNodeId: string;
  pathNodeIds: string[];
  moveCount: number;
  terminalNodeId: string;
  terminalTechnicalObjective: number;
  referenceTerminalBasinStartCount: number;
  otherTerminalBasinStartCount: number;
};

export type CachedDeclaredStartPartition = {
  partitionSha256: string;
  referenceTerminalStartNodeIds: string[];
  referenceTerminalStartCount: number;
  otherTerminalStartCount: number;
  orderCount: number;
  firstOrderOrdinal: number;
  orderOrdinalsSha256: string;
};

export type CachedPolicyRobustnessCensus = {
  schemaVersion: 1;
  classification: "cached-lattice-policy-robustness-census";
  interpretation: "technical-policy-audit-only";
  evaluationSource: "cached-node-table-only";
  direction: TechnicalObjectiveDirection;
  tolerance: TechnicalObjectiveTolerance;
  nodeCount: number;
  startCount: number;
  evaluatorCalls: 0;
  tableReference: {
    terminalNodeId: string;
    technicalObjective: number;
  };
  oneShotAllStarts: {
    traceCount: number;
    movedTraceCount: number;
    unchangedTraceCount: number;
    resultAtLocalTerminalCount: number;
    resultOutsideLocalTerminalsCount: number;
    moveCountHistogram: CachedPolicyMoveCountHistogramRow[];
    traceSignaturesSha256: string;
  };
  bestImprovementAllStarts: {
    traceCount: number;
    terminalBasins: CachedPolicyTerminalBasin[];
    referenceTerminalStartCount: number;
    otherTerminalStartCount: number;
    moveCountHistogram: CachedPolicyMoveCountHistogramRow[];
    longestMoveCount: number;
    traceSignaturesSha256: string;
  };
  declaredOrderFamily: {
    syntacticDimensionOrderPermutationCount: number;
    structurallyEffectiveDimensionOrderPermutationCount: number;
    syntacticCandidateValuePermutationProduct: number;
    structurallyEffectiveCandidateOrderProduct: number;
    syntacticOrderCount: number;
    effectiveOrderCount: number;
    traceCount: number;
    terminalOccurrenceCounts: Array<{
      terminalNodeId: string;
      technicalObjective: number;
      traceCount: number;
    }>;
    referenceTerminalTraceCount: number;
    otherTerminalTraceCount: number;
    meanTerminalTechnicalObjective: number;
    meanReferenceMinusTerminalTechnicalObjective: number;
    referenceTerminalBasinSizeHistogram: Array<{
      referenceTerminalStartCount: number;
      orderCount: number;
    }>;
    distinctReferenceTerminalBasinSizeCount: number;
    partitions: CachedDeclaredStartPartition[];
    distinctStartPartitionCount: number;
    distinctAllStartPathFamilyCount: number;
    allStartPathFamilyOrderCountHistogram: Array<{
      orderCount: number;
      pathFamilyCount: number;
    }>;
    allStartPathFamiliesSha256: string;
    pathMoveCountHistogram: CachedPolicyMoveCountHistogramRow[];
    longestMoveCount: number;
    orderFamilySha256: string;
    traceSignaturesSha256: string;
    witnesses: CachedDeclaredOrderWitness[];
  };
  execution: {
    oneShotPolicyCalls: number;
    bestImprovementPolicyCalls: number;
    declaredFirstImprovementPolicyCalls: number;
    tableReferenceCalls: 1;
    totalPolicyCalls: number;
    generatorCalls: 0;
    damageReplayCalls: 0;
    downstreamOptimizerCalls: 0;
    recommendationCalls: 0;
    rankCalls: 0;
    energyRecoveryCalls: 0;
  };
  censusPayloadSha256: string;
};

type CompleteBestTrace = CachedCoordinateDescentTrace & {
  terminal: Extract<
    CachedCoordinateDescentTrace["terminal"],
    { reason: "no-strictly-improving-comparable-neighbor" }
  >;
};

type CompleteDeclaredTrace = CachedDeclaredOrderFirstImprovementTrace & {
  terminal: Extract<
    CachedDeclaredOrderFirstImprovementTrace["terminal"],
    { status: "complete" }
  >;
};

type OrderRunSummary = {
  ordinal: number;
  order: Array<{ dimension: string; candidateValues: string[] }>;
  orderSha256: string;
  referenceStartNodeIds: string[];
  otherStartNodeIds: string[];
  firstTrace: CompleteDeclaredTrace;
};

/**
 * Exhaust a finite cached table across every start and every effective
 * dimension/candidate order. The result is a compact policy census, not a
 * search over new equipment and not a gameplay or guide claim.
 */
export function buildCachedPolicyRobustnessCensus(
  input: BuildCachedPolicyRobustnessCensusInput,
): CachedPolicyRobustnessCensus {
  const startNodeIds = validateStartNodeIds(input.table, input.startNodeIds);
  const declaredOrderSeed = cloneAndValidateDeclaredOrderSeed(
    input.table,
    input.declaredOrderSeed,
  );
  const tableReference = selectCachedTableBestComparableReference(
    input.table,
    input.direction,
    input.tolerance,
  );
  if (tableReference.status !== "selected") {
    throw new Error(
      `Cached policy census requires a fully comparable table; reference was ${tableReference.status}.`,
    );
  }

  const bestTraces = startNodeIds.map((startNodeId) =>
    requireCompleteBestTrace(
      runCachedBestImprovementCoordinateDescent({
        table: input.table,
        startNodeId,
        direction: input.direction,
        tolerance: input.tolerance,
      }),
    ),
  );
  const bestBasins = buildTerminalBasins(
    bestTraces,
    input.table,
    startNodeIds,
  );
  if (bestBasins.length < 1) {
    throw new Error("Cached policy census produced no best-improvement basin.");
  }
  const localTerminalIds = new Set(
    bestBasins.map(({ terminalNodeId }) => terminalNodeId),
  );
  const oneShotTraces = startNodeIds.map((startNodeId) =>
    requireCompleteOneShotTrace(
      runCachedOneShotBestNeighborPass({
        table: input.table,
        startNodeId,
        direction: input.direction,
        tolerance: input.tolerance,
      }),
    ),
  );

  const orders = enumerateEffectiveDeclaredOrders(declaredOrderSeed);
  const orderSummaries: OrderRunSummary[] = [];
  const declaredMoveHistogram = new Map<number, number>();
  const terminalOccurrenceCounts = new Map<string, number>();
  const partitionAccumulators = new Map<
    string,
    {
      referenceStartNodeIds: string[];
      orderOrdinals: number[];
    }
  >();
  const referenceBasinHistogram = new Map<number, number>();
  const allStartPathFamilyCounts = new Map<string, number>();
  const traceSignatureHasher = createHash("sha256");
  let longestMoveCount = -1;
  let longestWitness: CachedDeclaredOrderWitness | null = null;
  let minimumReferenceBasin: CachedDeclaredOrderWitness | null = null;
  let maximumReferenceBasin: CachedDeclaredOrderWitness | null = null;

  for (const [ordinal, order] of orders.entries()) {
    const traces = startNodeIds.map((startNodeId) =>
      requireCompleteDeclaredTrace(
        runCachedDeclaredOrderFirstImprovementCoordinateDescent({
          table: input.table,
          startNodeId,
          direction: input.direction,
          tolerance: input.tolerance,
          declaredOrder: order,
        }),
      ),
    );
    const referenceStartNodeIds = traces
      .filter(({ terminal }) => terminal.nodeId === tableReference.nodeId)
      .map(({ startNodeId }) => startNodeId);
    const otherStartNodeIds = traces
      .filter(({ terminal }) => terminal.nodeId !== tableReference.nodeId)
      .map(({ startNodeId }) => startNodeId);
    const orderSha256 = sha256Text(stableJson(order));
    const summary: OrderRunSummary = {
      ordinal,
      order,
      orderSha256,
      referenceStartNodeIds,
      otherStartNodeIds,
      firstTrace: traces[0],
    };
    orderSummaries.push(summary);

    const allStartPathFamilySha256 = sha256Text(
      stableJson(
        traces.map(({ startNodeId, pathNodeIds, terminal }) => ({
          startNodeId,
          pathNodeIds,
          terminalNodeId: terminal.nodeId,
          terminalTechnicalObjective: terminal.technicalObjective,
        })),
      ),
    );
    allStartPathFamilyCounts.set(
      allStartPathFamilySha256,
      (allStartPathFamilyCounts.get(allStartPathFamilySha256) ?? 0) + 1,
    );

    increment(referenceBasinHistogram, referenceStartNodeIds.length);
    const partitionKey = stableJson(referenceStartNodeIds);
    const partition = partitionAccumulators.get(partitionKey) ?? {
      referenceStartNodeIds: [...referenceStartNodeIds],
      orderOrdinals: [],
    };
    partition.orderOrdinals.push(ordinal);
    partitionAccumulators.set(partitionKey, partition);

    for (const trace of traces) {
      const moveCount = trace.pathNodeIds.length - 1;
      increment(declaredMoveHistogram, moveCount);
      increment(terminalOccurrenceCounts, trace.terminal.nodeId);
      traceSignatureHasher.update(
        stableJson({
          orderOrdinal: ordinal,
          startNodeId: trace.startNodeId,
          pathNodeIds: trace.pathNodeIds,
          terminalNodeId: trace.terminal.nodeId,
          terminalTechnicalObjective: trace.terminal.technicalObjective,
        }),
      );
      traceSignatureHasher.update("\n");

      if (moveCount > longestMoveCount) {
        longestMoveCount = moveCount;
        longestWitness = witness(
          "longest-path",
          summary,
          trace,
          referenceStartNodeIds.length,
          otherStartNodeIds.length,
        );
      }
    }

    const representativeTrace = traces[0];
    const basinWitness = witness(
      "minimum-reference-basin",
      summary,
      representativeTrace,
      referenceStartNodeIds.length,
      otherStartNodeIds.length,
    );
    if (
      minimumReferenceBasin == null ||
      referenceStartNodeIds.length <
        minimumReferenceBasin.referenceTerminalBasinStartCount
    ) {
      minimumReferenceBasin = basinWitness;
    }
    if (
      maximumReferenceBasin == null ||
      referenceStartNodeIds.length >
        maximumReferenceBasin.referenceTerminalBasinStartCount
    ) {
      maximumReferenceBasin = {
        ...basinWitness,
        classification: "maximum-reference-basin",
      };
    }
  }

  const traceCount = orders.length * startNodeIds.length;
  if (
    !longestWitness ||
    !minimumReferenceBasin ||
    !maximumReferenceBasin
  ) {
    throw new Error("Cached policy census could not select witness traces.");
  }
  const canonical = orderSummaries[0];
  const reverse = orderSummaries.at(-1);
  if (!canonical || !reverse) {
    throw new Error("Cached policy census produced no declared order family.");
  }

  const terminalRows = [...terminalOccurrenceCounts.entries()]
    .map(([terminalNodeId, terminalTraceCount]) => ({
      terminalNodeId,
      technicalObjective: requireComparableObjective(
        input.table,
        terminalNodeId,
      ),
      traceCount: terminalTraceCount,
    }))
    .sort((left, right) =>
      compareByStartOrder(left.terminalNodeId, right.terminalNodeId, startNodeIds),
    );
  const otherTerminalTraceCount = terminalRows
    .filter(({ terminalNodeId }) => terminalNodeId !== tableReference.nodeId)
    .reduce((sum, { traceCount: count }) => sum + count, 0);
  const referenceTerminalTraceCount =
    terminalOccurrenceCounts.get(tableReference.nodeId) ?? 0;
  const terminalTechnicalObjectiveSum = terminalRows.reduce(
    (sum, { technicalObjective, traceCount: terminalTraceCount }) =>
      sum + technicalObjective * terminalTraceCount,
    0,
  );
  const referenceMinusTerminalSum = terminalRows.reduce(
    (sum, { technicalObjective, traceCount: terminalTraceCount }) =>
      sum +
      (tableReference.technicalObjective - technicalObjective) *
        terminalTraceCount,
    0,
  );

  const partitions = [...partitionAccumulators.values()]
    .map(({ referenceStartNodeIds, orderOrdinals }) => ({
      partitionSha256: sha256Text(stableJson(referenceStartNodeIds)),
      referenceTerminalStartNodeIds: referenceStartNodeIds,
      referenceTerminalStartCount: referenceStartNodeIds.length,
      otherTerminalStartCount: startNodeIds.length - referenceStartNodeIds.length,
      orderCount: orderOrdinals.length,
      firstOrderOrdinal: orderOrdinals[0],
      orderOrdinalsSha256: sha256Text(stableJson(orderOrdinals)),
    }))
    .sort(
      (left, right) =>
        left.firstOrderOrdinal - right.firstOrderOrdinal ||
        compareStrings(left.partitionSha256, right.partitionSha256),
    );
  const orderFamilySha256 = sha256Text(
    stableJson(
      orderSummaries.map(
        ({ ordinal, orderSha256, referenceStartNodeIds, otherStartNodeIds }) => ({
          ordinal,
          orderSha256,
          referenceStartNodeIds,
          otherStartNodeIds,
        }),
      ),
    ),
  );
  const allStartPathFamilies = [...allStartPathFamilyCounts.entries()]
    .map(([pathFamilySha256, orderCount]) => ({
      pathFamilySha256,
      orderCount,
    }))
    .sort((left, right) =>
      compareStrings(left.pathFamilySha256, right.pathFamilySha256),
    );
  const allStartPathFamilyMultiplicity = new Map<number, number>();
  for (const { orderCount } of allStartPathFamilies) {
    increment(allStartPathFamilyMultiplicity, orderCount);
  }

  const canonicalTrace = canonical.firstTrace;
  const reverseTrace = reverse.firstTrace;
  const witnesses: CachedDeclaredOrderWitness[] = [
    witness(
      "canonical-order",
      canonical,
      canonicalTrace,
      canonical.referenceStartNodeIds.length,
      canonical.otherStartNodeIds.length,
    ),
    witness(
      "reverse-order",
      reverse,
      reverseTrace,
      reverse.referenceStartNodeIds.length,
      reverse.otherStartNodeIds.length,
    ),
    longestWitness,
    minimumReferenceBasin,
    maximumReferenceBasin,
  ];

  const bestReferenceBasin = bestBasins.find(
    ({ terminalNodeId }) => terminalNodeId === tableReference.nodeId,
  );
  if (!bestReferenceBasin) {
    throw new Error(
      "Cached table reference is not a best-improvement terminal basin.",
    );
  }
  const bestOtherStartCount = bestBasins
    .filter(({ terminalNodeId }) => terminalNodeId !== tableReference.nodeId)
    .reduce((sum, { startCount }) => sum + startCount, 0);
  const oneShotResultNodeIds = oneShotTraces.map(oneShotResultNodeId);

  const withoutDigest = {
    schemaVersion: 1 as const,
    classification: "cached-lattice-policy-robustness-census" as const,
    interpretation: "technical-policy-audit-only" as const,
    evaluationSource: "cached-node-table-only" as const,
    direction: input.direction,
    tolerance: { ...input.tolerance },
    nodeCount: input.table.nodes.length,
    startCount: startNodeIds.length,
    evaluatorCalls: 0 as const,
    tableReference: {
      terminalNodeId: tableReference.nodeId,
      technicalObjective: tableReference.technicalObjective,
    },
    oneShotAllStarts: {
      traceCount: oneShotTraces.length,
      movedTraceCount: oneShotTraces.filter(
        ({ outcome }) => outcome.status === "moved",
      ).length,
      unchangedTraceCount: oneShotTraces.filter(
        ({ outcome }) => outcome.status === "unchanged",
      ).length,
      resultAtLocalTerminalCount: oneShotResultNodeIds.filter((nodeId) =>
        localTerminalIds.has(nodeId),
      ).length,
      resultOutsideLocalTerminalsCount: oneShotResultNodeIds.filter(
        (nodeId) => !localTerminalIds.has(nodeId),
      ).length,
      moveCountHistogram: histogram(
        oneShotTraces.map(({ pathNodeIds }) => pathNodeIds.length - 1),
      ),
      traceSignaturesSha256: sha256Text(
        stableJson(
          oneShotTraces.map(({ startNodeId, pathNodeIds, outcome }) => ({
            startNodeId,
            pathNodeIds,
            outcome,
          })),
        ),
      ),
    },
    bestImprovementAllStarts: {
      traceCount: bestTraces.length,
      terminalBasins: bestBasins,
      referenceTerminalStartCount: bestReferenceBasin.startCount,
      otherTerminalStartCount: bestOtherStartCount,
      moveCountHistogram: histogram(
        bestTraces.map(({ pathNodeIds }) => pathNodeIds.length - 1),
      ),
      longestMoveCount: Math.max(
        ...bestTraces.map(({ pathNodeIds }) => pathNodeIds.length - 1),
      ),
      traceSignaturesSha256: sha256Text(
        stableJson(
          bestTraces.map(({ startNodeId, pathNodeIds, terminal }) => ({
            startNodeId,
            pathNodeIds,
            terminalNodeId: terminal.nodeId,
            terminalTechnicalObjective: terminal.technicalObjective,
          })),
        ),
      ),
    },
    declaredOrderFamily: {
      syntacticDimensionOrderPermutationCount: factorial(
        declaredOrderSeed.length,
      ),
      structurallyEffectiveDimensionOrderPermutationCount: factorial(
        declaredOrderSeed.filter(({ candidateValues }) => candidateValues.length > 1)
          .length,
      ),
      syntacticCandidateValuePermutationProduct: declaredOrderSeed.reduce(
        (product, { candidateValues }) =>
          product * factorial(candidateValues.length),
        1,
      ),
      structurallyEffectiveCandidateOrderProduct: declaredOrderSeed.reduce(
        (product, { candidateValues }) =>
          product * effectiveCandidateOrderCount(candidateValues.length),
        1,
      ),
      syntacticOrderCount:
        factorial(declaredOrderSeed.length) *
        declaredOrderSeed.reduce(
          (product, { candidateValues }) =>
            product * factorial(candidateValues.length),
          1,
        ),
      effectiveOrderCount: orders.length,
      traceCount,
      terminalOccurrenceCounts: terminalRows,
      referenceTerminalTraceCount,
      otherTerminalTraceCount,
      meanTerminalTechnicalObjective:
        terminalTechnicalObjectiveSum / traceCount,
      meanReferenceMinusTerminalTechnicalObjective:
        referenceMinusTerminalSum / traceCount,
      referenceTerminalBasinSizeHistogram: [...referenceBasinHistogram.entries()]
        .map(([referenceTerminalStartCount, orderCount]) => ({
          referenceTerminalStartCount,
          orderCount,
        }))
        .sort(
          (left, right) =>
            left.referenceTerminalStartCount - right.referenceTerminalStartCount,
        ),
      distinctReferenceTerminalBasinSizeCount: referenceBasinHistogram.size,
      partitions,
      distinctStartPartitionCount: partitions.length,
      distinctAllStartPathFamilyCount: allStartPathFamilies.length,
      allStartPathFamilyOrderCountHistogram: [
        ...allStartPathFamilyMultiplicity.entries(),
      ]
        .map(([orderCount, pathFamilyCount]) => ({
          orderCount,
          pathFamilyCount,
        }))
        .sort((left, right) => left.orderCount - right.orderCount),
      allStartPathFamiliesSha256: sha256Text(stableJson(allStartPathFamilies)),
      pathMoveCountHistogram: mapHistogram(declaredMoveHistogram),
      longestMoveCount,
      orderFamilySha256,
      traceSignaturesSha256: traceSignatureHasher.digest("hex"),
      witnesses,
    },
    execution: {
      oneShotPolicyCalls: oneShotTraces.length,
      bestImprovementPolicyCalls: bestTraces.length,
      declaredFirstImprovementPolicyCalls: traceCount,
      tableReferenceCalls: 1 as const,
      totalPolicyCalls:
        oneShotTraces.length + bestTraces.length + traceCount + 1,
      generatorCalls: 0 as const,
      damageReplayCalls: 0 as const,
      downstreamOptimizerCalls: 0 as const,
      recommendationCalls: 0 as const,
      rankCalls: 0 as const,
      energyRecoveryCalls: 0 as const,
    },
  };

  return {
    ...withoutDigest,
    censusPayloadSha256: sha256Text(stableJson(withoutDigest)),
  };
}

/**
 * Enumerate each structurally effective dimension and candidate order exactly
 * once. Singleton dimensions stay in their seed slots because visiting them
 * cannot produce a candidate. The policy also skips the current value, so one-
 * and two-value dimensions have only one effective candidate order even though
 * their full candidate lists have one or two syntactic permutations. Input
 * order defines ordinal zero.
 */
export function enumerateEffectiveDeclaredOrders(
  seed: readonly CachedDeclaredDimensionCandidateOrder[],
): Array<Array<{ dimension: string; candidateValues: string[] }>> {
  const cloned = seed.map(({ dimension, candidateValues }) => ({
    dimension,
    candidateValues: [...candidateValues],
  }));
  requireUnique(cloned.map(({ dimension }) => dimension), "declared dimension");
  for (const { dimension, candidateValues } of cloned) {
    if (candidateValues.length === 0) {
      throw new Error(`Declared dimension ${dimension} has no candidates.`);
    }
    requireUnique(candidateValues, `${dimension} candidate value`);
  }

  const dimensionPermutations = effectiveDimensionOrders(cloned);
  const valuePermutationsByDimension = new Map(
    cloned.map(({ dimension, candidateValues }) => [
      dimension,
      effectiveCandidateOrders(candidateValues),
    ]),
  );
  const valuePermutationProducts = cartesianProduct(
    cloned.map(({ dimension }) =>
      requiredMapValue(valuePermutationsByDimension, dimension),
    ),
  );
  const seedIndexByDimension = new Map(
    cloned.map(({ dimension }, index) => [dimension, index]),
  );
  const orders: Array<
    Array<{ dimension: string; candidateValues: string[] }>
  > = [];
  for (const dimensionOrder of dimensionPermutations) {
    for (const valueProduct of valuePermutationProducts) {
      orders.push(
        dimensionOrder.map((dimension) => ({
          dimension,
          candidateValues: [
            ...valueProduct[
              requiredMapValue(seedIndexByDimension, dimension)
            ],
          ],
        })),
      );
    }
  }
  return orders;
}

function validateStartNodeIds(
  table: BoundedLatticeNodeTable,
  startNodeIds: readonly string[],
): string[] {
  const cloned = [...startNodeIds];
  requireUnique(cloned, "start node ID");
  const tableIds = table.nodes.map(({ nodeId }) => nodeId);
  requireUnique(tableIds, "table node ID");
  const tableSet = new Set(tableIds);
  const startSet = new Set(cloned);
  const missing = tableIds.filter((nodeId) => !startSet.has(nodeId));
  const extra = cloned.filter((nodeId) => !tableSet.has(nodeId));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Start-node boundary must equal the cached table (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}).`,
    );
  }
  return cloned;
}

function cloneAndValidateDeclaredOrderSeed(
  table: BoundedLatticeNodeTable,
  seed: readonly CachedDeclaredDimensionCandidateOrder[],
): Array<{ dimension: string; candidateValues: string[] }> {
  const cloned = seed.map(({ dimension, candidateValues }) => ({
    dimension,
    candidateValues: [...candidateValues],
  }));
  requireUnique(cloned.map(({ dimension }) => dimension), "declared dimension");
  const declared = new Set(cloned.map(({ dimension }) => dimension));
  const dimensions = [...table.dimensions];
  const missing = dimensions.filter((dimension) => !declared.has(dimension));
  const extra = cloned
    .map(({ dimension }) => dimension)
    .filter((dimension) => !dimensions.includes(dimension));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Declared-order dimensions must equal the table (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}).`,
    );
  }
  for (const { dimension, candidateValues } of cloned) {
    requireUnique(candidateValues, `${dimension} candidate value`);
    const observedValues = new Set(
      table.nodes.map(({ coordinates }) => coordinates[dimension]),
    );
    const declaredValues = new Set(candidateValues);
    if (
      candidateValues.length !== observedValues.size ||
      [...observedValues].some((value) => !declaredValues.has(value))
    ) {
      throw new Error(
        `Declared candidates for ${dimension} must equal the cached coordinate values.`,
      );
    }
  }
  return cloned;
}

function requireCompleteBestTrace(
  trace: CachedCoordinateDescentTrace,
): CompleteBestTrace {
  if (
    trace.terminal.reason !== "no-strictly-improving-comparable-neighbor"
  ) {
    throw new Error(
      `Best-improvement trace ${trace.startNodeId} is not fully comparable (${trace.terminal.reason}).`,
    );
  }
  return trace as CompleteBestTrace;
}

function requireCompleteDeclaredTrace(
  trace: CachedDeclaredOrderFirstImprovementTrace,
): CompleteDeclaredTrace {
  if (trace.terminal.status !== "complete") {
    throw new Error(
      `Declared-order trace ${trace.startNodeId} is not fully comparable (${trace.terminal.reason}).`,
    );
  }
  return trace as CompleteDeclaredTrace;
}

function requireCompleteOneShotTrace(
  trace: CachedOneShotBestNeighborPassTrace,
): CachedOneShotBestNeighborPassTrace & {
  outcome: Extract<
    CachedOneShotBestNeighborPassTrace["outcome"],
    { status: "moved" | "unchanged" }
  >;
} {
  if (trace.outcome.status === "withheld") {
    throw new Error(
      `One-shot trace ${trace.startNodeId} is not fully comparable (${trace.outcome.reason}).`,
    );
  }
  return trace as CachedOneShotBestNeighborPassTrace & {
    outcome: Extract<
      CachedOneShotBestNeighborPassTrace["outcome"],
      { status: "moved" | "unchanged" }
    >;
  };
}

function buildTerminalBasins(
  traces: readonly CompleteBestTrace[],
  table: BoundedLatticeNodeTable,
  startOrder: readonly string[],
): CachedPolicyTerminalBasin[] {
  const startsByTerminal = new Map<string, string[]>();
  for (const trace of traces) {
    const starts = startsByTerminal.get(trace.terminal.nodeId) ?? [];
    starts.push(trace.startNodeId);
    startsByTerminal.set(trace.terminal.nodeId, starts);
  }
  return [...startsByTerminal.entries()]
    .map(([terminalNodeId, startNodeIds]) => ({
      terminalNodeId,
      terminalTechnicalObjective: requireComparableObjective(table, terminalNodeId),
      startNodeIds,
      startCount: startNodeIds.length,
      startNodeIdsSha256: sha256Text(stableJson(startNodeIds)),
    }))
    .sort((left, right) =>
      compareByStartOrder(left.terminalNodeId, right.terminalNodeId, startOrder),
    );
}

function requireComparableObjective(
  table: BoundedLatticeNodeTable,
  nodeId: string,
): number {
  const matches = table.nodes.filter((node) => node.nodeId === nodeId);
  if (matches.length !== 1 || matches[0].cachedResult.status !== "comparable") {
    throw new Error(`Expected one comparable cached node ${nodeId}.`);
  }
  return matches[0].cachedResult.technicalObjective;
}

function oneShotResultNodeId(
  trace: ReturnType<typeof requireCompleteOneShotTrace>,
): string {
  return trace.outcome.status === "moved"
    ? trace.outcome.toNodeId
    : trace.outcome.nodeId;
}

function witness(
  classification: CachedDeclaredOrderWitness["classification"],
  summary: OrderRunSummary,
  trace: CompleteDeclaredTrace,
  referenceTerminalBasinStartCount: number,
  otherTerminalBasinStartCount: number,
): CachedDeclaredOrderWitness {
  return {
    classification,
    orderOrdinal: summary.ordinal,
    orderSha256: summary.orderSha256,
    declaredOrder: summary.order.map(({ dimension, candidateValues }) => ({
      dimension,
      candidateValues: [...candidateValues],
    })),
    startNodeId: trace.startNodeId,
    pathNodeIds: [...trace.pathNodeIds],
    moveCount: trace.pathNodeIds.length - 1,
    terminalNodeId: trace.terminal.nodeId,
    terminalTechnicalObjective: trace.terminal.technicalObjective,
    referenceTerminalBasinStartCount,
    otherTerminalBasinStartCount,
  };
}

function histogram(values: readonly number[]): CachedPolicyMoveCountHistogramRow[] {
  const counts = new Map<number, number>();
  for (const value of values) increment(counts, value);
  return mapHistogram(counts);
}

function mapHistogram(
  counts: ReadonlyMap<number, number>,
): CachedPolicyMoveCountHistogramRow[] {
  return [...counts.entries()]
    .map(([moveCount, traceCount]) => ({ moveCount, traceCount }))
    .sort((left, right) => left.moveCount - right.moveCount);
}

function increment(counts: Map<number, number>, key: number): void;
function increment(counts: Map<string, number>, key: string): void;
function increment(
  counts: Map<number, number> | Map<string, number>,
  key: number | string,
): void {
  if (typeof key === "number") {
    const numeric = counts as Map<number, number>;
    numeric.set(key, (numeric.get(key) ?? 0) + 1);
    return;
  }
  const textual = counts as Map<string, number>;
  textual.set(key, (textual.get(key) ?? 0) + 1);
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) return [[...values]];
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const suffix of permutations(rest)) result.push([value, ...suffix]);
  }
  return result;
}

function cartesianProduct<T>(dimensions: readonly (readonly T[])[]): T[][] {
  let products: T[][] = [[]];
  for (const dimension of dimensions) {
    products = products.flatMap((prefix) =>
      dimension.map((value) => [...prefix, value]),
    );
  }
  return products;
}

function factorial(value: number): number {
  let result = 1;
  for (let factor = 2; factor <= value; factor += 1) result *= factor;
  return result;
}

function effectiveCandidateOrderCount(candidateCount: number): number {
  return candidateCount <= 2 ? 1 : factorial(candidateCount);
}

function effectiveCandidateOrders<T>(values: readonly T[]): T[][] {
  return values.length <= 2 ? [[...values]] : permutations(values);
}

function effectiveDimensionOrders(
  seed: ReadonlyArray<{ dimension: string; candidateValues: string[] }>,
): string[][] {
  const activeSlots = seed
    .map(({ candidateValues }, index) =>
      candidateValues.length > 1 ? index : null,
    )
    .filter((index): index is number => index != null);
  const activeDimensions = activeSlots.map((index) => seed[index].dimension);
  return permutations(activeDimensions).map((activeOrder) => {
    const order = seed.map(({ dimension }) => dimension);
    activeSlots.forEach((slot, index) => {
      order[slot] = activeOrder[index];
    });
    return order;
  });
}

function requireUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label} ${value}.`);
    seen.add(value);
  }
}

function requiredMapValue<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value == null) throw new Error(`Missing required map key ${String(key)}.`);
  return value;
}

function compareByStartOrder(
  left: string,
  right: string,
  startOrder: readonly string[],
): number {
  return startOrder.indexOf(left) - startOrder.indexOf(right);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
