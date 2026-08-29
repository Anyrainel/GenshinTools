import { describe, expect, it } from "vitest";
import {
  runCachedBestImprovementCoordinateDescent,
  selectCachedTableBestComparableReference,
  traceCachedBeamCoverage,
  type BoundedLatticeNode,
  type BoundedLatticeNodeTable,
} from "../src/boundedLatticePolicy";

const ZERO_TOLERANCE = { absolute: 0, relative: 0 } as const;

describe("cached bounded-lattice policies", () => {
  it("exposes the pair-only trap without presenting a local optimum as the table best", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      comparable("B", "1", "0", 9),
      comparable("C", "0", "1", 9),
      comparable("D", "1", "1", 12),
    ]);

    const descent = runCachedBestImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
    });
    const tableReference = selectCachedTableBestComparableReference(
      table,
      "maximize",
      ZERO_TOLERANCE,
    );

    expect(descent.evaluatorCalls).toBe(0);
    expect(descent.pathNodeIds).toEqual(["A"]);
    expect(descent.terminal).toEqual({
      reason: "no-strictly-improving-comparable-neighbor",
      nodeId: "A",
      technicalObjective: 10,
      equivalentNeighborNodeIds: [],
      plateauObserved: false,
    });
    expect(descent.steps[0]).toMatchObject({
      neighborNodeIds: ["B", "C"],
      improvingNeighborNodeIds: [],
      selectedNextNodeId: null,
      selectedEquivalentNextNodeIds: [],
      selectedRepresentativeTiePolicy: null,
    });
    expect(tableReference).toEqual({
      classification: "cached-table-best-comparable-reference",
      status: "selected",
      scope: "declared-node-table-only",
      evaluatorCalls: 0,
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
      deterministicTiePolicy:
        "lowest-node-id-among-tolerance-equivalent-best-values",
      failureNodeIds: [],
      bestObservedTechnicalObjective: 12,
      nodeId: "D",
      technicalObjective: 12,
      representative: { nodeId: "D", technicalObjective: 12 },
      equivalentNodeIds: ["D"],
    });
  });

  it("uses absolute and relative tolerance before the nodeId tie-break", () => {
    const table: BoundedLatticeNodeTable = {
      dimensions: ["choice"],
      nodes: [
        oneDimensionComparable("start", "start", 100),
        oneDimensionComparable("z-neighbor", "z", 101.001),
        oneDimensionComparable("a-neighbor", "a", 101),
      ],
    };
    const tolerance = { absolute: 0.0001, relative: 0.0001 } as const;

    const run = () =>
      runCachedBestImprovementCoordinateDescent({
        table,
        startNodeId: "start",
        direction: "maximize",
        tolerance,
      });

    expect(run()).toEqual(run());
    expect(run().pathNodeIds.slice(0, 2)).toEqual(["start", "a-neighbor"]);
    expect(run().steps[0]).toMatchObject({
      selectedNextNodeId: "a-neighbor",
      selectedEquivalentNextNodeIds: ["a-neighbor", "z-neighbor"],
      selectedRepresentativeTiePolicy:
        "lowest-node-id-among-tolerance-equivalent-best-values",
    });
    expect(run().terminal).toEqual({
      reason: "no-strictly-improving-comparable-neighbor",
      nodeId: "a-neighbor",
      technicalObjective: 101,
      equivalentNeighborNodeIds: ["z-neighbor"],
      plateauObserved: true,
    });
    expect(
      selectCachedTableBestComparableReference(
        table,
        "maximize",
        tolerance,
      ),
    ).toEqual({
      classification: "cached-table-best-comparable-reference",
      status: "selected",
      scope: "declared-node-table-only",
      evaluatorCalls: 0,
      direction: "maximize",
      tolerance,
      deterministicTiePolicy:
        "lowest-node-id-among-tolerance-equivalent-best-values",
      failureNodeIds: [],
      bestObservedTechnicalObjective: 101.001,
      nodeId: "a-neighbor",
      technicalObjective: 101,
      representative: {
        nodeId: "a-neighbor",
        technicalObjective: 101,
      },
      equivalentNodeIds: ["a-neighbor", "z-neighbor"],
    });
  });

  it("keeps cached failures incomparable and propagates their diagnostics", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      failed("B", "1", "0", "runtime-failure", "cached run failed"),
      comparable("C", "0", "1", 9),
      comparable("D", "1", "1", 12),
    ]);

    const fromComparable = runCachedBestImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
    });
    const fromFailure = runCachedBestImprovementCoordinateDescent({
      table,
      startNodeId: "B",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
    });

    expect(fromComparable.steps[0]).toMatchObject({
      comparableNeighborNodeIds: ["C"],
      failureNeighborNodeIds: ["B"],
      improvingNeighborNodeIds: [],
    });
    expect(fromComparable.encounteredFailures).toEqual([
      {
        nodeId: "B",
        failure: { code: "runtime-failure", message: "cached run failed" },
      },
    ]);
    expect(fromComparable.terminal).toEqual({
      reason: "neighborhood-incomparable",
      nodeId: "A",
      technicalObjective: 10,
      equivalentNeighborNodeIds: [],
      plateauObserved: false,
      failureNeighborNodeIds: ["B"],
    });
    expect(fromFailure.terminal).toEqual({
      reason: "start-node-failure",
      nodeId: "B",
      failure: { code: "runtime-failure", message: "cached run failed" },
    });
    expect(fromFailure.pathNodeIds).toEqual(["B"]);
    expect(fromFailure.steps).toEqual([]);
  });

  it("does not move to an improving survivor when another neighbor failed", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      failed("B", "1", "0", "runtime-failure", "cached run failed"),
      comparable("C", "0", "1", 11),
      comparable("D", "1", "1", 12),
    ]);

    const trace = runCachedBestImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
    });

    expect(trace.pathNodeIds).toEqual(["A"]);
    expect(trace.steps[0]).toMatchObject({
      improvingNeighborNodeIds: ["C"],
      failureNeighborNodeIds: ["B"],
      selectedNextNodeId: null,
      selectedEquivalentNextNodeIds: [],
      selectedRepresentativeTiePolicy: null,
    });
    expect(trace.terminal).toEqual({
      reason: "neighborhood-incomparable",
      nodeId: "A",
      technicalObjective: 10,
      equivalentNeighborNodeIds: [],
      plateauObserved: false,
      failureNeighborNodeIds: ["B"],
    });
  });

  it("withholds a table-wide reference when any declared node failed", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      failed("B", "1", "0", "runtime-failure", "cached run failed"),
      comparable("C", "0", "1", 9),
      comparable("D", "1", "1", 12),
    ]);

    expect(
      selectCachedTableBestComparableReference(
        table,
        "maximize",
        ZERO_TOLERANCE,
      ),
    ).toEqual({
      classification: "cached-table-best-comparable-reference",
      status: "withheld",
      reason: "declared-node-failure",
      scope: "declared-node-table-only",
      evaluatorCalls: 0,
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
      failureNodeIds: ["B"],
      bestObservedTechnicalObjective: null,
      nodeId: null,
      technicalObjective: null,
      representative: null,
      equivalentNodeIds: [],
    });
  });

  it("labels width-one beam traversal as non-calibrated coverage and records pruning", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      comparable("B", "1", "0", 11),
      comparable("C", "0", "1", 11),
      comparable("D", "1", "1", 12),
    ]);

    const trace = traceCachedBeamCoverage({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
      width: 1,
      maxDepth: 1,
    });

    expect(trace).toMatchObject({
      classification: "cached-lattice-beam-coverage-trace",
      interpretation: "coverage-only",
      calibration: "not-calibrated",
      exhaustive: false,
      evaluatorCalls: 0,
      width: 1,
      maxDepth: 1,
      visitedNodeIds: ["A", "B", "C"],
      frontierByDepth: [
        { depth: 0, nodeIds: ["A"] },
        { depth: 1, nodeIds: ["B"] },
      ],
    });
    expect(trace.levels).toEqual([
      {
        depth: 1,
        parentFrontierNodeIds: ["A"],
        visitedNodeIds: ["B", "C"],
        comparableNodeIds: ["B", "C"],
        failureNodeIds: [],
        retainedNodeIds: ["B"],
        prunedComparableNodeIds: ["C"],
      },
    ]);
    expect(trace.visitedNodeIds).not.toContain("D");
  });
});

function twoByTwoTable(nodes: BoundedLatticeNode[]): BoundedLatticeNodeTable {
  return { dimensions: ["x", "y"], nodes };
}

function comparable(
  nodeId: string,
  x: string,
  y: string,
  technicalObjective: number,
): BoundedLatticeNode {
  return {
    nodeId,
    coordinates: { x, y },
    cachedResult: { status: "comparable", technicalObjective },
  };
}

function failed(
  nodeId: string,
  x: string,
  y: string,
  code: string,
  message: string,
): BoundedLatticeNode {
  return {
    nodeId,
    coordinates: { x, y },
    cachedResult: { status: "failure", failure: { code, message } },
  };
}

function oneDimensionComparable(
  nodeId: string,
  choice: string,
  technicalObjective: number,
): BoundedLatticeNode {
  return {
    nodeId,
    coordinates: { choice },
    cachedResult: { status: "comparable", technicalObjective },
  };
}
