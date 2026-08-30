import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCachedPolicyRobustnessCensus } from "../src/boundedLatticePolicyCensus";
import {
  formatKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusSummary,
  writeAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
} from "../src/compute-keqing-ineffa-furina-xilonen-cached-policy-robustness-census";
import { sha256Text, stableJson } from "../src/io";
import {
  buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
  type BuildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusInput,
  type KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusEnvironment,
  type KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
} from "../src/keqingIneffaFurinaXilonenCachedPolicyRobustnessCensus";
import {
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
  type KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
} from "../src/keqingIneffaFurinaXilonenCachedPolicyAudit";
import { REPOSITORY_ROOT } from "../src/paths";

const CP40_REPORT = JSON.parse(
  readFileSync(
    KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
    "utf8",
  ),
) as KeqingIneffaFurinaXilonenCachedPolicyAuditReport;
const INPUT_FILES =
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_INPUT_PATHS.map(
    (relativePath) => ({
      path: relativePath,
      sha256: fileSha256(path.join(REPOSITORY_ROOT, relativePath)),
    }),
  );
const REAL_INPUT: BuildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusInput =
  { cp40Report: CP40_REPORT, inputFiles: INPUT_FILES };

let realReport: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport;

beforeAll(() => {
  realReport =
    buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
      REAL_INPUT,
    );
}, 120_000);

describe("Keqing/Ineffa/Furina/Xilonen cached-policy robustness census", () => {
  it("authenticates the exact CP40 projection and matches the durable report", () => {
    requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
      realReport,
    );
    expect(realReport).toMatchObject({
      schemaVersion: 1,
      classification:
        "keqing-ineffa-furina-xilonen-cached-policy-robustness-census",
      validationStatus:
        "authenticated-completed-cached-policy-robustness-census-source-not-ready",
      issues: [],
      sourceAuthentication: {
        expectedFileCount: 3,
        observedFileCount: 3,
        exactPathSet: true,
        allDeclaredFileHashesMatch: true,
        cp40ByteSha256:
          "a2ce1d99443deb81a9559bb0aed9c4d378aefa5d564d2f16074a82fadd987a46",
        cp40PayloadHashMatches: true,
        cp40FullGuardPassed: true,
        authentication: "accepted",
      },
      censusInputBoundary: {
        nodeCount: 36,
        startCount: 36,
        exactNodeSequence: true,
        exactCartesianClosure: true,
        reviewOccurrenceCount: 576,
        reviewComparisonRowCount: 4608,
        reviewUsedForObjective: false,
        reviewUsedAsPolicyFilter: false,
        reviewDiagnosticsProjectedIntoCensusInput: false,
        cp40PolicyAuditProjectedIntoCensusInput: false,
        energyRecoveryProvenanceReadForAuthentication: true,
        energyRecoveryValuesProjectedIntoCensusInput: false,
        censusInputProjectionSha256:
          "86fb2b9c41881840b348adc66dffa5d4f4a198a67ec6609363095af22793d294",
      },
      authentication: {
        censusPayloadSha256:
          "a98fd6d0c708be4f7b6974df0c2ae0021f693faa7577b9ee9ee517dccda5e986",
        reportContentSha256:
          "148493d115ac799579ce36a4a6f8b7947ef3d3bd7882b4110b2463091178955c",
      },
    });
    expect(stableJson(realReport)).toBe(
      readFileSync(
        KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_PATH,
        "utf8",
      ),
    );
    expect(
      fileSha256(
        KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_PATH,
      ),
    ).toBe(
      "c446dec2027cc2b77d20d46ea8d521d3ae4f43f798f34715a4c4ddb771ac2b73",
    );
  });

  it("pins the exhaustive all-start and all-effective-order aggregate oracle", () => {
    const census = requireCensus(realReport);
    expect(census).toMatchObject({
      nodeCount: 36,
      startCount: 36,
      evaluatorCalls: 0,
      tableReference: { technicalObjective: 926093.666196721 },
      oneShotAllStarts: {
        traceCount: 36,
        movedTraceCount: 34,
        unchangedTraceCount: 2,
        resultAtLocalTerminalCount: 12,
        resultOutsideLocalTerminalsCount: 24,
        traceSignaturesSha256:
          "cd97374ac860914010331e6790ec893bf97c728af9ff836a801aa8feeadcccd3",
      },
      bestImprovementAllStarts: {
        traceCount: 36,
        referenceTerminalStartCount: 24,
        otherTerminalStartCount: 12,
        traceSignaturesSha256:
          "0338fd4bf29b1122cf2ccee95f8c87aa8f4d1f576e96fd14a464f4399d33173c",
      },
      declaredOrderFamily: {
        syntacticOrderCount: 3456,
        effectiveOrderCount: 864,
        traceCount: 31_104,
        referenceTerminalTraceCount: 18_576,
        otherTerminalTraceCount: 12_528,
        distinctReferenceTerminalBasinSizeCount: 10,
        distinctStartPartitionCount: 13,
        distinctAllStartPathFamilyCount: 96,
        longestMoveCount: 7,
        orderFamilySha256:
          "1aa53446b8ea6217a0e146fcd56cd873c4a251ed15292a28e85cd387b25d09bc",
        traceSignaturesSha256:
          "45a21703b88d5c2b71f314c01f5754a87e4b3dbde8e7b44ba7e7a9bc88875418",
        allStartPathFamiliesSha256:
          "83a1a9267c7adb0b2a9c2f98293a857179784a55c11b930d30dda0b9a780c1c7",
      },
      execution: {
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
      },
    });
    expect(
      census.declaredOrderFamily.meanTerminalTechnicalObjective,
    ).toBeCloseTo(924_111.9968560368, 8);
    expect(
      census.declaredOrderFamily.meanReferenceMinusTerminalTechnicalObjective,
    ).toBeCloseTo(1981.6693406841966, 8);
    expect(census.declaredOrderFamily.referenceTerminalBasinSizeHistogram).toEqual(
      [
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
      ],
    );
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
  });

  it("retains deterministic witnesses without turning them into ranks", () => {
    const census = requireCensus(realReport);
    const sequenceByNodeId = new Map(
      CP40_REPORT.nodes.map(({ sequence, nodeId }) => [nodeId, sequence]),
    );
    expect(
      census.declaredOrderFamily.witnesses.map((witness) => ({
        classification: witness.classification,
        orderOrdinal: witness.orderOrdinal,
        startSequence: sequenceByNodeId.get(witness.startNodeId),
        pathSequences: witness.pathNodeIds.map((nodeId) =>
          sequenceByNodeId.get(nodeId),
        ),
        referenceCount: witness.referenceTerminalBasinStartCount,
        otherCount: witness.otherTerminalBasinStartCount,
      })),
    ).toEqual([
      {
        classification: "canonical-order",
        orderOrdinal: 0,
        startSequence: 0,
        pathSequences: [0, 1, 13],
        referenceCount: 15,
        otherCount: 21,
      },
      {
        classification: "reverse-order",
        orderOrdinal: 863,
        startSequence: 0,
        pathSequences: [0, 1, 7],
        referenceCount: 12,
        otherCount: 24,
      },
      {
        classification: "longest-path",
        orderOrdinal: 15,
        startSequence: 32,
        pathSequences: [32, 20, 8, 2, 4, 0, 1, 13],
        referenceCount: 15,
        otherCount: 21,
      },
      {
        classification: "minimum-reference-basin",
        orderOrdinal: 72,
        startSequence: 0,
        pathSequences: [0, 1, 13],
        referenceCount: 9,
        otherCount: 27,
      },
      {
        classification: "maximum-reference-basin",
        orderOrdinal: 216,
        startSequence: 0,
        pathSequences: [0, 1, 7],
        referenceCount: 34,
        otherCount: 2,
      },
    ]);
    expect(realReport.capabilities).toEqual({
      guideClaims: false,
      recommendationClaims: false,
      rankClaims: false,
      scalarWeightClaims: false,
      damageClaims: false,
      gameplayClaims: false,
      optimalityClaims: false,
      energyRecoveryClaims: false,
    });
  });

  it("authenticates before any census call when the CP40 payload or input set drifts", () => {
    const counters = { census: 0 };
    const environment = countingEnvironment(counters);
    const invalidInputs: BuildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusInput[] =
      [
        {
          ...REAL_INPUT,
          cp40Report: { ...CP40_REPORT, validationStatus: "not-authenticated" },
        },
        {
          ...REAL_INPUT,
          inputFiles: INPUT_FILES.map((entry, index) =>
            index === 0 ? { ...entry, sha256: "0".repeat(64) } : entry,
          ),
        },
        { ...REAL_INPUT, inputFiles: INPUT_FILES.slice(1) },
      ];
    for (const invalidInput of invalidInputs) {
      const report =
        buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
          invalidInput,
          environment,
        );
      expect(report.validationStatus).toBe("not-authenticated");
      expect(report.census).toBeNull();
      expect(report.executionBoundary.censusBuilderCalls).toBe(0);
      expect(report.issues.length).toBeGreaterThan(0);
    }
    expect(counters.census).toBe(0);
  });

  it("withholds a post-authentication census that drifts from the fixed oracle", () => {
    const counters = { census: 0 };
    const report =
      buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
        REAL_INPUT,
        {
          buildCensus(input) {
            counters.census += 1;
            return {
              ...buildCachedPolicyRobustnessCensus(input),
              nodeCount: 35,
            };
          },
        },
      );
    expect(counters.census).toBe(1);
    expect(report.validationStatus).toBe("not-authenticated");
    expect(report.census).toBeNull();
    expect(report.executionBoundary.censusBuilderCalls).toBe(1);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "census.expected_empirical_facts_mismatch",
        stage: "census",
      }),
    );
  });

  it("accepts an exact injected census while withholding forbidden-seam attestations", () => {
    const counters = { census: 0 };
    const report =
      buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
        REAL_INPUT,
        countingEnvironment(counters),
      );
    requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
      report,
    );
    expect(counters.census).toBe(1);
    expect(report.executionBoundary).toMatchObject({
      censusProductionEnvironment: "injected-uncharacterized-census-builder",
      censusBuilderCalls: 1,
      censusReportedPolicyCalls: 31_177,
      censusReportedEvaluatorCalls: null,
      forbiddenSeamCallCountsAttestation:
        "uncharacterized-injected-environment",
      generatorCalls: null,
      damageReplayCalls: null,
      downstreamOptimizerCalls: null,
      recommendationCalls: null,
      rankCalls: null,
      energyRecoveryCalls: null,
      energyRecoveryValuesInfluencedCensus: null,
    });
    expect(report.authentication.reportContentSha256).toBe(
      "c9aee97b2b61035a4448984181ca2bfcc340690abf5301db75c259de18812278",
    );
  });

  it("rejects self-resealed capability, ER-boundary, source, and census mutations", () => {
    const mutations: Array<
      (
        report: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
      ) => void
    > = [
      (report) => {
        (report.capabilities as { guideClaims: boolean }).guideClaims = true;
      },
      (report) => {
        (
          report.censusInputBoundary as {
            energyRecoveryValuesProjectedIntoCensusInput: boolean;
          }
        ).energyRecoveryValuesProjectedIntoCensusInput = true;
      },
      (report) => {
        report.generatedFrom[0].sha256 = "0".repeat(64);
      },
      (report) => {
        const census = requireCensus(report);
        census.declaredOrderFamily.witnesses[0].orderOrdinal = 1;
        resealCensusDigest(census);
      },
    ];
    for (const mutate of mutations) {
      const report = structuredClone(realReport);
      mutate(report);
      resealReportDigest(report);
      expect(() =>
        requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
          report,
        ),
      ).toThrow(/Refusing unauthenticated or mutated/);
    }
  });

  it("fails closed before the durable writer and uses explicit no-claim CLI wording", async () => {
    const invalid = structuredClone(realReport);
    (invalid.capabilities as { rankClaims: boolean }).rankClaims = true;
    let writerCalls = 0;
    await expect(
      writeAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
        invalid,
        async () => {
          writerCalls += 1;
        },
      ),
    ).rejects.toThrow(/Refusing unauthenticated or mutated/);
    expect(writerCalls).toBe(0);
    expect(
      formatKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusSummary(
        realReport,
      ),
    ).toBe(
      "Wrote authenticated cached-policy robustness census for 36 nodes and 36 starts: 864 effective declared orders, 31104 declared-order traces, 2 best-improvement basins, and 31177 reported cached policy calls; 0 generator, replay, downstream optimizer, recommendation, rank, or ER calls; CP40 ER-deferral provenance authenticated and no ER values projected. This is a source-not-ready technical policy census, not a guide, rank, recommendation, or optimality claim.",
    );
  });
});

function countingEnvironment(
  counters: { census: number },
): KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusEnvironment {
  return {
    buildCensus(input) {
      counters.census += 1;
      return buildCachedPolicyRobustnessCensus(input);
    },
  };
}

function requireCensus(
  report: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
): NonNullable<
  KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport["census"]
> {
  if (!report.census) throw new Error("Authenticated census missing.");
  return report.census;
}

function resealCensusDigest(
  census: NonNullable<
    KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport["census"]
  >,
): void {
  const { censusPayloadSha256: _digest, ...withoutDigest } = census;
  census.censusPayloadSha256 = sha256Text(stableJson(withoutDigest));
}

function resealReportDigest(
  report: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
): void {
  report.authentication.reportContentSha256 = sha256Text(
    stableJson({
      ...report,
      authentication: {
        ...report.authentication,
        reportContentSha256: "",
      },
    }),
  );
}

function fileSha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
