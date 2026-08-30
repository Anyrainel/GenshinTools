import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCachedPolicyRobustnessCensus,
  enumerateEffectiveDeclaredOrders,
  type CachedPolicyRobustnessCensus,
} from "../src/boundedLatticePolicyCensus";
import { readJson } from "../src/io";
import {
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
  type KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
} from "../src/keqingIneffaFurinaXilonenCachedPolicyAudit";

let census: CachedPolicyRobustnessCensus;
let sequenceByNodeId: Map<string, number>;

beforeAll(async () => {
  const report = (await readJson(
    KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
  )) as KeqingIneffaFurinaXilonenCachedPolicyAuditReport;
  const nodes = [...report.nodes].sort(
    (left, right) => left.sequence - right.sequence,
  );
  sequenceByNodeId = new Map(
    nodes.map(({ sequence, nodeId }) => [nodeId, sequence]),
  );
  census = buildCachedPolicyRobustnessCensus({
    table: {
      dimensions: [...report.latticeBoundary.dimensions],
      nodes: nodes.map(({ nodeId, coordinates, technicalReference }) => ({
        nodeId,
        coordinates: { ...coordinates },
        cachedResult: {
          status: "comparable" as const,
          technicalObjective: technicalReference.unreviewedTechnicalObjective,
        },
      })),
    },
    startNodeIds: nodes.map(({ nodeId }) => nodeId),
    declaredOrderSeed:
      report.latticeBoundary.declaredFirstImprovementOrder.map(
        ({ dimension, candidateValues }) => ({
          dimension,
          candidateValues: [...candidateValues],
        }),
      ),
    direction: "maximize",
    tolerance: report.latticeBoundary.technicalObjectiveTolerance,
  });
}, 120_000);

describe("bounded cached-lattice policy robustness census", () => {
  it("covers every start with one-shot and best-improvement policies", () => {
    expect(census).toMatchObject({
      schemaVersion: 1,
      classification: "cached-lattice-policy-robustness-census",
      nodeCount: 36,
      startCount: 36,
      evaluatorCalls: 0,
      oneShotAllStarts: {
        traceCount: 36,
        movedTraceCount: 34,
        unchangedTraceCount: 2,
        resultAtLocalTerminalCount: 12,
        resultOutsideLocalTerminalsCount: 24,
      },
      bestImprovementAllStarts: {
        traceCount: 36,
        referenceTerminalStartCount: 24,
        otherTerminalStartCount: 12,
      },
    });
    expect(sequence(census.tableReference.terminalNodeId)).toBe(7);
    expect(
      census.bestImprovementAllStarts.terminalBasins.map((basin) => ({
        terminalSequence: sequence(basin.terminalNodeId),
        startSequences: basin.startNodeIds.map(sequence),
      })),
    ).toEqual([
      {
        terminalSequence: 7,
        startSequences: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 21, 22,
          23, 30, 31, 32, 33, 34, 35,
        ],
      },
      {
        terminalSequence: 13,
        startSequences: [12, 13, 14, 15, 16, 17, 24, 25, 26, 27, 28, 29],
      },
    ]);
    expect(census.bestImprovementAllStarts.moveCountHistogram).toEqual([
      { moveCount: 0, traceCount: 2 },
      { moveCount: 1, traceCount: 10 },
      { moveCount: 2, traceCount: 16 },
      { moveCount: 3, traceCount: 8 },
    ]);
  });

  it("exhausts all 864 structurally effective orders across all 36 starts", () => {
    expect(census.declaredOrderFamily).toMatchObject({
      syntacticDimensionOrderPermutationCount: 24,
      structurallyEffectiveDimensionOrderPermutationCount: 24,
      syntacticCandidateValuePermutationProduct: 144,
      structurallyEffectiveCandidateOrderProduct: 36,
      syntacticOrderCount: 3456,
      effectiveOrderCount: 864,
      traceCount: 31_104,
      referenceTerminalTraceCount: 18_576,
      otherTerminalTraceCount: 12_528,
      distinctReferenceTerminalBasinSizeCount: 10,
      distinctStartPartitionCount: 13,
      distinctAllStartPathFamilyCount: 96,
      allStartPathFamilyOrderCountHistogram: [
        { orderCount: 9, pathFamilyCount: 96 },
      ],
      longestMoveCount: 7,
    });
    expect(
      census.declaredOrderFamily.terminalOccurrenceCounts.map((row) => ({
        terminalSequence: sequence(row.terminalNodeId),
        traceCount: row.traceCount,
      })),
    ).toEqual([
      { terminalSequence: 7, traceCount: 18_576 },
      { terminalSequence: 13, traceCount: 12_528 },
    ]);
    expect(
      census.declaredOrderFamily.meanTerminalTechnicalObjective,
    ).toBeCloseTo(924_111.9968560368, 8);
    expect(
      census.declaredOrderFamily.meanReferenceMinusTerminalTechnicalObjective,
    ).toBeCloseTo(1981.669340684195, 8);
    expect(
      census.declaredOrderFamily.referenceTerminalBasinSizeHistogram,
    ).toEqual([
      { referenceTerminalStartCount: 9, orderCount: 72 },
      { referenceTerminalStartCount: 12, orderCount: 108 },
      { referenceTerminalStartCount: 15, orderCount: 36 },
      { referenceTerminalStartCount: 18, orderCount: 216 },
      { referenceTerminalStartCount: 24, orderCount: 144 },
      { referenceTerminalStartCount: 27, orderCount: 36 },
      { referenceTerminalStartCount: 28, orderCount: 36 },
      { referenceTerminalStartCount: 30, orderCount: 108 },
      { referenceTerminalStartCount: 32, orderCount: 72 },
      { referenceTerminalStartCount: 34, orderCount: 36 },
    ]);
    expect(census.declaredOrderFamily.pathMoveCountHistogram).toEqual([
      { moveCount: 0, traceCount: 1728 },
      { moveCount: 1, traceCount: 5184 },
      { moveCount: 2, traceCount: 7236 },
      { moveCount: 3, traceCount: 7164 },
      { moveCount: 4, traceCount: 5634 },
      { moveCount: 5, traceCount: 3078 },
      { moveCount: 6, traceCount: 954 },
      { moveCount: 7, traceCount: 126 },
    ]);
    expect(census.execution).toEqual({
      oneShotPolicyCalls: 36,
      bestImprovementPolicyCalls: 36,
      declaredFirstImprovementPolicyCalls: 31_104,
      tableReferenceCalls: 1,
      totalPolicyCalls: 31_177,
      generatorCalls: 0,
      damageReplayCalls: 0,
      downstreamOptimizerCalls: 0,
      recommendationCalls: 0,
      rankCalls: 0,
      energyRecoveryCalls: 0,
    });
  });

  it("retains compact deterministic witnesses for order sensitivity", () => {
    const byClassification = new Map(
      census.declaredOrderFamily.witnesses.map((row) => [
        row.classification,
        row,
      ]),
    );
    const canonical = requiredWitness(byClassification, "canonical-order");
    expect(canonical).toMatchObject({
      orderOrdinal: 0,
      referenceTerminalBasinStartCount: 15,
      otherTerminalBasinStartCount: 21,
    });
    expect(sequence(canonical.startNodeId)).toBe(0);
    expect(canonical.pathNodeIds.map(sequence)).toEqual([0, 1, 13]);

    const reverse = requiredWitness(byClassification, "reverse-order");
    expect(reverse).toMatchObject({
      orderOrdinal: 863,
      referenceTerminalBasinStartCount: 12,
      otherTerminalBasinStartCount: 24,
    });
    expect(sequence(reverse.startNodeId)).toBe(0);
    expect(reverse.pathNodeIds.map(sequence)).toEqual([0, 1, 7]);

    const longest = requiredWitness(byClassification, "longest-path");
    expect(longest).toMatchObject({ moveCount: 7 });
    expect(sequence(longest.startNodeId)).toBe(32);
    expect(longest.pathNodeIds.map(sequence)).toEqual([
      32, 20, 8, 2, 4, 0, 1, 13,
    ]);

    expect(
      requiredWitness(byClassification, "minimum-reference-basin"),
    ).toMatchObject({
      referenceTerminalBasinStartCount: 9,
      otherTerminalBasinStartCount: 27,
    });
    expect(
      requiredWitness(byClassification, "maximum-reference-basin"),
    ).toMatchObject({
      referenceTerminalBasinStartCount: 34,
      otherTerminalBasinStartCount: 2,
    });
  });

  it("canonicalizes binary candidate order while reversing dimension order", () => {
    const seed = [
      { dimension: "a", candidateValues: ["a0", "a1", "a2"] },
      { dimension: "singleton", candidateValues: ["only"] },
      { dimension: "b", candidateValues: ["b0", "b1"] },
    ];
    const orders = enumerateEffectiveDeclaredOrders(seed);
    expect(orders).toHaveLength(12);
    expect(orders[0]).toEqual(seed);
    expect(orders.at(-1)).toEqual([
      { dimension: "b", candidateValues: ["b0", "b1"] },
      { dimension: "singleton", candidateValues: ["only"] },
      { dimension: "a", candidateValues: ["a2", "a1", "a0"] },
    ]);
  });
});

function sequence(nodeId: string): number {
  const value = sequenceByNodeId.get(nodeId);
  if (value == null) throw new Error(`Missing node sequence for ${nodeId}.`);
  return value;
}

function requiredWitness(
  rows: ReadonlyMap<
    string,
    CachedPolicyRobustnessCensus["declaredOrderFamily"]["witnesses"][number]
  >,
  classification: string,
) {
  const row = rows.get(classification);
  if (!row) throw new Error(`Missing ${classification} witness.`);
  return row;
}
