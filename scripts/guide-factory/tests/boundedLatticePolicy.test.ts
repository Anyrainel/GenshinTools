import { describe, expect, it } from "vitest";
import {
  runCachedDeclaredOrderFirstImprovementCoordinateDescent,
  runCachedBestImprovementCoordinateDescent,
  runCachedOneShotBestNeighborPass,
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
      selectCachedTableBestComparableReference(table, "maximize", tolerance),
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

  it("performs exactly one best-neighbor pass in an interaction trap", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      comparable("B", "1", "0", 11),
      comparable("C", "0", "1", 12),
      comparable("D", "1", "1", 20),
    ]);

    const trace = runCachedOneShotBestNeighborPass({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
    });

    expect(trace).toMatchObject({
      classification: "cached-lattice-one-shot-best-neighbor-pass-trace",
      interpretation: "technical-policy-audit-only",
      policy: "deterministic-one-shot-best-neighbor",
      evaluationSource: "cached-node-table-only",
      evaluatorCalls: 0,
      maximumNeighborhoodPasses: 1,
      completedNeighborhoodPasses: 1,
      startNodeId: "A",
      pathNodeIds: ["A", "C"],
      examinedNodeIds: ["A", "B", "C"],
      neighborNodeIds: ["B", "C"],
      comparableNeighborNodeIds: ["B", "C"],
      failureNeighborNodeIds: [],
      improvingNeighborNodeIds: ["B", "C"],
      selectedNextNodeId: "C",
      selectedEquivalentNextNodeIds: ["C"],
      outcome: {
        status: "moved",
        reason: "strictly-improving-best-neighbor-selected",
        fromNodeId: "A",
        fromTechnicalObjective: 10,
        toNodeId: "C",
        toTechnicalObjective: 12,
        bestObservedImprovingTechnicalObjective: 12,
      },
    });
    expect(trace.pathNodeIds).not.toContain("D");
  });

  it("preserves tolerance-equivalent best-neighbor ties with a deterministic representative", () => {
    const table = twoByTwoTable([
      comparable("start", "0", "0", 100),
      comparable("z-neighbor", "1", "0", 101.001),
      comparable("a-neighbor", "0", "1", 101),
      comparable("far", "1", "1", 200),
    ]);
    const tolerance = { absolute: 0.0001, relative: 0.0001 } as const;

    const run = () =>
      runCachedOneShotBestNeighborPass({
        table,
        startNodeId: "start",
        direction: "maximize",
        tolerance,
      });

    expect(run()).toEqual(run());
    expect(run()).toMatchObject({
      evaluatorCalls: 0,
      pathNodeIds: ["start", "a-neighbor"],
      improvingNeighborNodeIds: ["a-neighbor", "z-neighbor"],
      selectedNextNodeId: "a-neighbor",
      selectedEquivalentNextNodeIds: ["a-neighbor", "z-neighbor"],
      selectedRepresentativeTiePolicy:
        "lowest-node-id-among-tolerance-equivalent-best-values",
      outcome: {
        status: "moved",
        bestObservedImprovingTechnicalObjective: 101.001,
      },
    });
  });

  it("makes first-improvement dimension and candidate ordering observable and order-sensitive", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      comparable("B", "1", "0", 11),
      comparable("C", "0", "1", 12),
      comparable("D", "1", "1", 9),
    ]);
    const xThenY = [
      { dimension: "x", candidateValues: ["0", "1"] },
      { dimension: "y", candidateValues: ["0", "1"] },
    ] as const;
    const yThenX = [xThenY[1], xThenY[0]] as const;

    const xFirst = runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
      declaredOrder: xThenY,
    });
    const yFirst = runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
      declaredOrder: yThenX,
    });

    expect(xFirst).toMatchObject({
      classification: "cached-lattice-declared-order-first-improvement-trace",
      interpretation: "technical-policy-audit-only",
      policy: "deterministic-declared-order-first-improvement",
      evaluationSource: "cached-node-table-only",
      evaluatorCalls: 0,
      candidateSelectionPolicy: "first-strict-improvement-in-declared-order",
      toleranceTiePolicy: "declared-order-first",
      declaredOrder: xThenY,
      pathNodeIds: ["A", "B"],
      examinedNodeIds: ["A", "B", "D"],
      terminal: {
        status: "complete",
        reason: "no-strictly-improving-declared-candidate",
        nodeId: "B",
        technicalObjective: 11,
      },
    });
    expect(xFirst.steps[0]).toMatchObject({
      currentNodeId: "A",
      orderedCandidates: [
        { orderIndex: 0, dimension: "x", candidateValue: "1", nodeId: "B" },
        { orderIndex: 1, dimension: "y", candidateValue: "1", nodeId: "C" },
      ],
      checkedCandidates: [
        {
          orderIndex: 0,
          dimension: "x",
          candidateValue: "1",
          nodeId: "B",
          cachedStatus: "comparable",
          strictlyImprovesCurrent: true,
        },
      ],
      selectedNextNodeId: "B",
      selectedDimension: "x",
      selectedCandidateValue: "1",
      relevantFailureNodeId: null,
    });
    expect(yFirst).toMatchObject({
      evaluatorCalls: 0,
      declaredOrder: yThenX,
      pathNodeIds: ["A", "C"],
      examinedNodeIds: ["A", "C", "D"],
      terminal: {
        status: "complete",
        nodeId: "C",
        technicalObjective: 12,
      },
    });
  });

  it("uses declared order to resolve tolerance-equivalent improving candidates", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 100),
      comparable("B", "1", "0", 101.001),
      comparable("C", "0", "1", 101),
      comparable("D", "1", "1", 101.0005),
    ]);
    const tolerance = { absolute: 0.0001, relative: 0.0001 } as const;

    const xFirst = runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance,
      declaredOrder: declaredOrder("x", "y"),
    });
    const yFirst = runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance,
      declaredOrder: declaredOrder("y", "x"),
    });

    expect(xFirst.pathNodeIds).toEqual(["A", "B"]);
    expect(yFirst.pathNodeIds).toEqual(["A", "C"]);
    expect(xFirst.terminal).toMatchObject({
      status: "complete",
      equivalentCheckedNodeIds: ["D"],
    });
    expect(yFirst.terminal).toMatchObject({
      status: "complete",
      equivalentCheckedNodeIds: ["D"],
    });
    expect(xFirst.toleranceTiePolicy).toBe("declared-order-first");
    expect(yFirst.toleranceTiePolicy).toBe("declared-order-first");
    expect(xFirst.evaluatorCalls).toBe(0);
    expect(yFirst.evaluatorCalls).toBe(0);
  });

  it("supports minimization without changing either traversal policy", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      comparable("B", "1", "0", 9),
      comparable("C", "0", "1", 8),
      comparable("D", "1", "1", 7),
    ]);

    const oneShot = runCachedOneShotBestNeighborPass({
      table,
      startNodeId: "A",
      direction: "minimize",
      tolerance: ZERO_TOLERANCE,
    });
    const declared = runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "minimize",
      tolerance: ZERO_TOLERANCE,
      declaredOrder: declaredOrder("x", "y"),
    });

    expect(oneShot.pathNodeIds).toEqual(["A", "C"]);
    expect(oneShot.outcome).toMatchObject({ status: "moved", toNodeId: "C" });
    expect(declared.pathNodeIds).toEqual(["A", "B", "D"]);
    expect(declared.terminal).toMatchObject({
      status: "complete",
      nodeId: "D",
      technicalObjective: 7,
    });
    expect(oneShot.evaluatorCalls).toBe(0);
    expect(declared.evaluatorCalls).toBe(0);
  });

  it("treats a difference exactly equal to tolerance as equivalent, not improving", () => {
    const table: BoundedLatticeNodeTable = {
      dimensions: ["choice"],
      nodes: [
        oneDimensionComparable("start", "start", 10),
        oneDimensionComparable("boundary", "boundary", 11),
        oneDimensionComparable("worse", "worse", 9),
      ],
    };
    const tolerance = { absolute: 1, relative: 0 } as const;

    const oneShot = runCachedOneShotBestNeighborPass({
      table,
      startNodeId: "start",
      direction: "maximize",
      tolerance,
    });
    const declared = runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: "start",
      direction: "maximize",
      tolerance,
      declaredOrder: [
        {
          dimension: "choice",
          candidateValues: ["start", "boundary", "worse"],
        },
      ],
    });

    expect(oneShot.outcome.status).toBe("unchanged");
    expect(oneShot.equivalentToStartNeighborNodeIds).toEqual([
      "boundary",
      "worse",
    ]);
    expect(declared.pathNodeIds).toEqual(["start"]);
    expect(declared.steps[0]?.checkedCandidates).toMatchObject([
      {
        nodeId: "boundary",
        toleranceEquivalentToCurrent: true,
        strictlyImprovesCurrent: false,
      },
      {
        nodeId: "worse",
        toleranceEquivalentToCurrent: true,
        strictlyImprovesCurrent: false,
      },
    ]);
  });

  it("withholds one-shot selection when any neighbor has a cached failure", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      failed("B", "1", "0", "capture-failure", "capture failed"),
      comparable("C", "0", "1", 12),
      comparable("D", "1", "1", 9),
    ]);

    const trace = runCachedOneShotBestNeighborPass({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
    });

    expect(trace).toMatchObject({
      evaluatorCalls: 0,
      completedNeighborhoodPasses: 1,
      pathNodeIds: ["A"],
      comparableNeighborNodeIds: ["C"],
      failureNeighborNodeIds: ["B"],
      improvingNeighborNodeIds: ["C"],
      selectedNextNodeId: null,
      encounteredFailures: [
        {
          nodeId: "B",
          failure: { code: "capture-failure", message: "capture failed" },
        },
      ],
      outcome: {
        status: "withheld",
        reason: "neighborhood-incomparable",
        failureNeighborNodeIds: ["B"],
      },
    });
  });

  it("withholds declared-order descent at the first relevant cached failure", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      failed("B", "1", "0", "capture-failure", "capture failed"),
      comparable("C", "0", "1", 12),
      comparable("D", "1", "1", 9),
    ]);

    const trace = runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
      declaredOrder: declaredOrder("x", "y"),
    });

    expect(trace).toMatchObject({
      evaluatorCalls: 0,
      pathNodeIds: ["A"],
      examinedNodeIds: ["A", "B"],
      encounteredFailures: [
        {
          nodeId: "B",
          failure: { code: "capture-failure", message: "capture failed" },
        },
      ],
      terminal: {
        status: "withheld",
        reason: "relevant-cached-candidate-failure",
        nodeId: "A",
        technicalObjective: 10,
        failedCandidate: {
          orderIndex: 0,
          dimension: "x",
          candidateValue: "1",
          nodeId: "B",
        },
        failure: { code: "capture-failure", message: "capture failed" },
      },
    });
    expect(trace.steps[0]?.checkedCandidates).toHaveLength(1);
    expect(
      trace.steps[0]?.orderedCandidates.map(({ nodeId }) => nodeId),
    ).toEqual(["B", "C"]);
  });

  it("does not treat a candidate after the first improvement as an observed failure", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      comparable("B", "1", "0", 11),
      failed("C", "0", "1", "unobserved-failure", "not reached"),
      comparable("D", "1", "1", 9),
    ]);

    const trace = runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
      declaredOrder: declaredOrder("x", "y"),
    });

    expect(trace.pathNodeIds).toEqual(["A", "B"]);
    expect(trace.examinedNodeIds).toEqual(["A", "B", "D"]);
    expect(trace.encounteredFailures).toEqual([]);
    expect(trace.terminal).toMatchObject({
      status: "complete",
      nodeId: "B",
      technicalObjective: 11,
    });
  });

  it("withholds both policies immediately when the start node failed", () => {
    const table = twoByTwoTable([
      failed("A", "0", "0", "start-failure", "start failed"),
      comparable("B", "1", "0", 11),
      comparable("C", "0", "1", 12),
      comparable("D", "1", "1", 13),
    ]);

    const oneShot = runCachedOneShotBestNeighborPass({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
    });
    const declared = runCachedDeclaredOrderFirstImprovementCoordinateDescent({
      table,
      startNodeId: "A",
      direction: "maximize",
      tolerance: ZERO_TOLERANCE,
      declaredOrder: declaredOrder("x", "y"),
    });

    expect(oneShot).toMatchObject({
      evaluatorCalls: 0,
      completedNeighborhoodPasses: 0,
      pathNodeIds: ["A"],
      examinedNodeIds: ["A"],
      encounteredFailures: [
        {
          nodeId: "A",
          failure: { code: "start-failure", message: "start failed" },
        },
      ],
      outcome: {
        status: "withheld",
        reason: "start-node-failure",
      },
    });
    expect(declared).toMatchObject({
      evaluatorCalls: 0,
      pathNodeIds: ["A"],
      examinedNodeIds: ["A"],
      steps: [],
      encounteredFailures: [
        {
          nodeId: "A",
          failure: { code: "start-failure", message: "start failed" },
        },
      ],
      terminal: {
        status: "withheld",
        reason: "start-node-failure",
      },
    });
  });

  it("fails closed on nonfinite, duplicate, absent, and structurally missing coordinates", () => {
    const invalidTables: Array<{
      table: BoundedLatticeNodeTable;
      expected: RegExp;
    }> = [
      {
        table: {
          dimensions: ["x"],
          nodes: [
            {
              nodeId: "A",
              coordinates: { x: "0" },
              cachedResult: {
                status: "comparable",
                technicalObjective: Number.POSITIVE_INFINITY,
              },
            },
          ],
        },
        expected: /non-finite technical objective/,
      },
      {
        table: {
          dimensions: ["x"],
          nodes: [
            {
              nodeId: "A",
              coordinates: { x: "0" },
              cachedResult: { status: "comparable", technicalObjective: 1 },
            },
            {
              nodeId: "B",
              coordinates: { x: "0" },
              cachedResult: { status: "comparable", technicalObjective: 2 },
            },
          ],
        },
        expected: /duplicate coordinates/,
      },
      {
        table: {
          dimensions: ["x", "y"],
          nodes: [
            {
              nodeId: "A",
              coordinates: { x: "0" } as Readonly<Record<string, string>>,
              cachedResult: { status: "comparable", technicalObjective: 1 },
            },
          ],
        },
        expected: /coordinates must match the declared dimensions/,
      },
    ];

    for (const { table, expected } of invalidTables) {
      expect(() =>
        runCachedOneShotBestNeighborPass({
          table,
          startNodeId: "A",
          direction: "maximize",
          tolerance: ZERO_TOLERANCE,
        }),
      ).toThrow(expected);
      expect(() =>
        runCachedDeclaredOrderFirstImprovementCoordinateDescent({
          table,
          startNodeId: "A",
          direction: "maximize",
          tolerance: ZERO_TOLERANCE,
          declaredOrder:
            table.dimensions.length === 1
              ? [{ dimension: "x", candidateValues: ["0"] }]
              : declaredOrder("x", "y"),
        }),
      ).toThrow(expected);
    }

    const sparseTable = twoByTwoTable([
      comparable("A", "0", "0", 10),
      comparable("B", "1", "0", 11),
      comparable("C", "0", "1", 12),
    ]);
    expect(() =>
      runCachedOneShotBestNeighborPass({
        table: sparseTable,
        startNodeId: "A",
        direction: "maximize",
        tolerance: ZERO_TOLERANCE,
      }),
    ).toThrow(/missing Cartesian coordinates/);
    expect(() =>
      runCachedDeclaredOrderFirstImprovementCoordinateDescent({
        table: sparseTable,
        startNodeId: "A",
        direction: "maximize",
        tolerance: ZERO_TOLERANCE,
        declaredOrder: declaredOrder("x", "y"),
      }),
    ).toThrow(/missing Cartesian coordinates/);
    const completeTable = twoByTwoTable([
      ...sparseTable.nodes,
      comparable("D", "1", "1", 13),
    ]);
    expect(() =>
      runCachedOneShotBestNeighborPass({
        table: completeTable,
        startNodeId: "absent",
        direction: "maximize",
        tolerance: ZERO_TOLERANCE,
      }),
    ).toThrow(/Unknown bounded lattice start node/);
  });

  it("rejects unknown and malformed cached-result shapes", () => {
    const invalidResults = [
      {
        cachedResult: { status: "unknown" },
        expected: /invalid cached result status/,
      },
      {
        cachedResult: {
          status: "failure",
          failure: { code: 123, message: "bad code" },
        },
        expected: /invalid cached failure/,
      },
    ];

    for (const { cachedResult, expected } of invalidResults) {
      const table: BoundedLatticeNodeTable = {
        dimensions: ["x"],
        nodes: [
          {
            nodeId: "A",
            coordinates: { x: "0" },
            cachedResult: cachedResult as BoundedLatticeNode["cachedResult"],
          },
        ],
      };
      expect(() =>
        runCachedOneShotBestNeighborPass({
          table,
          startNodeId: "A",
          direction: "maximize",
          tolerance: ZERO_TOLERANCE,
        }),
      ).toThrow(expected);
      expect(() =>
        runCachedDeclaredOrderFirstImprovementCoordinateDescent({
          table,
          startNodeId: "A",
          direction: "maximize",
          tolerance: ZERO_TOLERANCE,
          declaredOrder: [{ dimension: "x", candidateValues: ["0"] }],
        }),
      ).toThrow(expected);
    }
  });

  it("rejects invalid directions and tolerances before policy traversal", () => {
    const table: BoundedLatticeNodeTable = {
      dimensions: ["x"],
      nodes: [
        {
          nodeId: "A",
          coordinates: { x: "0" },
          cachedResult: { status: "comparable", technicalObjective: 1 },
        },
      ],
    };

    expect(() =>
      runCachedOneShotBestNeighborPass({
        table,
        startNodeId: "A",
        direction: "sideways" as never,
        tolerance: ZERO_TOLERANCE,
      }),
    ).toThrow(/direction must be maximize or minimize/);
    expect(() =>
      runCachedDeclaredOrderFirstImprovementCoordinateDescent({
        table,
        startNodeId: "A",
        direction: "maximize",
        tolerance: { absolute: -1, relative: Number.NaN },
        declaredOrder: [{ dimension: "x", candidateValues: ["0"] }],
      }),
    ).toThrow(/tolerances must be finite and non-negative/);
  });

  it("requires an exact, duplicate-free declared dimension and candidate domain order", () => {
    const table = twoByTwoTable([
      comparable("A", "0", "0", 10),
      comparable("B", "1", "0", 11),
      comparable("C", "0", "1", 12),
      comparable("D", "1", "1", 13),
    ]);
    const base = {
      table,
      startNodeId: "A",
      direction: "maximize" as const,
      tolerance: ZERO_TOLERANCE,
    };

    expect(() =>
      runCachedDeclaredOrderFirstImprovementCoordinateDescent({
        ...base,
        declaredOrder: [
          { dimension: "x", candidateValues: ["0", "1"] },
          { dimension: "x", candidateValues: ["0", "1"] },
        ],
      }),
    ).toThrow(/each bounded lattice dimension exactly once/);
    expect(() =>
      runCachedDeclaredOrderFirstImprovementCoordinateDescent({
        ...base,
        declaredOrder: [
          { dimension: "x", candidateValues: ["0", "1"] },
          { dimension: "y", candidateValues: ["0"] },
        ],
      }),
    ).toThrow(/exact table domain/);
    expect(() =>
      runCachedDeclaredOrderFirstImprovementCoordinateDescent({
        ...base,
        declaredOrder: [
          { dimension: "x", candidateValues: ["0", "1"] },
          { dimension: "y", candidateValues: ["0", "0"] },
        ],
      }),
    ).toThrow(/unique non-empty strings/);
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

function declaredOrder(
  first: "x" | "y",
  second: "x" | "y",
): ReadonlyArray<{
  dimension: "x" | "y";
  candidateValues: readonly ["0", "1"];
}> {
  return [
    { dimension: first, candidateValues: ["0", "1"] },
    { dimension: second, candidateValues: ["0", "1"] },
  ];
}
