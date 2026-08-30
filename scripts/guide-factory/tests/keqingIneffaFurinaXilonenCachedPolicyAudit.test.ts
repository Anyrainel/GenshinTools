import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  runCachedBestImprovementCoordinateDescent,
  runCachedDeclaredOrderFirstImprovementCoordinateDescent,
  runCachedOneShotBestNeighborPass,
  selectCachedTableBestComparableReference,
} from "../src/boundedLatticePolicy";
import { formatKeqingIneffaFurinaXilonenCachedPolicyAuditSummary } from "../src/compute-keqing-ineffa-furina-xilonen-cached-policy-audit";
import { sha256Text, stableJson } from "../src/io";
import {
  buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  type BuildKeqingIneffaFurinaXilonenCachedPolicyAuditInput,
  type KeqingIneffaFurinaXilonenCachedPolicyAuditEnvironment,
  type KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  type ReviewStateCounts,
} from "../src/keqingIneffaFurinaXilonenCachedPolicyAudit";
import type { KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport } from "../src/keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import type { KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport } from "../src/keqingIneffaFurinaXilonenGeneratedSheetEvidence";
import { REPOSITORY_ROOT } from "../src/paths";

const CP38_PATH = path.join(
  REPOSITORY_ROOT,
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-technical-computation.json",
);
const CP39_PATH = path.join(
  REPOSITORY_ROOT,
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-generated-sheet-evidence.json",
);
const EXPECTED_REPORT_SHA256 =
  "a2ce1d99443deb81a9559bb0aed9c4d378aefa5d564d2f16074a82fadd987a46";
const EXPECTED_REPORT_SIZE = 2_029_334;

const CP38_REPORT = JSON.parse(
  readFileSync(CP38_PATH, "utf8"),
) as KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport;
const CP39_REPORT = JSON.parse(
  readFileSync(CP39_PATH, "utf8"),
) as KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport;
const INPUT_FILES =
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_INPUT_PATHS.map(
    (relativePath) => ({
      path: relativePath,
      sha256: fileSha256(path.join(REPOSITORY_ROOT, relativePath)),
    }),
  );
const REAL_INPUT: BuildKeqingIneffaFurinaXilonenCachedPolicyAuditInput = {
  cp38Report: CP38_REPORT,
  cp39Report: CP39_REPORT,
  inputFiles: INPUT_FILES,
};
const REAL_REPORT =
  buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport(REAL_INPUT);

describe("Keqing/Ineffa/Furina/Xilonen cached-policy audit", () => {
  it("authenticates the exact real 36-node policy oracle and durable report", () => {
    requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
      REAL_REPORT,
    );
    const durable = JSON.parse(
      readFileSync(
        KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
        "utf8",
      ),
    ) as KeqingIneffaFurinaXilonenCachedPolicyAuditReport;

    expect(REAL_REPORT).toEqual(durable);
    expect(REAL_REPORT).toMatchObject({
      validationStatus:
        "authenticated-completed-cached-policy-audit-source-not-ready",
      issues: [],
      sourceAuthentication: {
        authentication: "accepted",
        selectedInputsAuthenticatedBeforePolicyExecution: true,
        cp38ByteSha256:
          "c1e62f94d50be01cb5a8b24f2b419a9e52ecafad6829320e2341322691111063",
        cp38FullGuardPassed: true,
        cp39ByteSha256:
          "d6b8f196891ee122a9ce8267f7da7efae3e7e39076b5babf28c3d352b56e6b4a",
        cp39FullGuardPassed: true,
        policySourceByteSha256:
          "73a9ee8f253686ec63fb841287953fe3fb342b491316b7915bb4299144266bbc",
        policySourceHashMatches: true,
      },
      latticeBoundary: {
        nodeCount: 36,
        exactCartesianCoordinateCount: 36,
        exactCartesianClosure: true,
        startNodeSequence: 0,
      },
      reviewBoundary: {
        attachmentScope: "node-carry-character-occurrence-only",
        globalSheetIdAttachmentCount: 0,
        nodeCount: 36,
        occurrenceCount: 576,
        comparisonRowCount: 4608,
        usedForObjective: false,
        usedAsPolicyFilter: false,
        energyRecoveryProvenanceReadForAuthentication: true,
        energyRecoveryValuesProjectedIntoPolicyInput: false,
      },
      executionBoundary: {
        scheduling: "sequential",
        traceProductionEnvironment: "default-cached-policy-functions",
        traceProductionPolicyCallCounts: {
          oneShotBestNeighbor: 1,
          iterativeBestImprovement: 1,
          declaredFirstImprovement: 1,
          fullBoundedTableReference: 1,
        },
        traceProductionTotalPolicyCalls: 4,
        authenticationUsesDefaultPolicyRecomputation: true,
        authenticationPolicyRecomputationCallsPerGuard: 4,
        outerGuardInvocationCountAttested: false,
        actualTotalPolicyCallsAttested: false,
        forbiddenSeamCallCountsAttestation: "verified-zero-default-environment",
        evaluatorCalls: 0,
        generatorCalls: 0,
        damageReplayCalls: 0,
        optimizerCalls: 0,
        rankCalls: 0,
        recommendationCalls: 0,
        energyRecoveryCalls: 0,
        energyRecoveryValuesInfluencedPolicy: false,
      },
      capabilities: {
        guideClaims: false,
        recommendationClaims: false,
        rankClaims: false,
        scalarWeightClaims: false,
        damageClaims: false,
        gameplayClaims: false,
        optimalityClaims: false,
        energyRecoveryClaims: false,
      },
      authentication: {
        compactNodeTableSha256:
          "95dbf16cb035227488f77fa12673120505b058a7e81a2914adf848a293d37106",
        reviewProjectionSha256:
          "ea108239bcadd49bfcdbde1057b5caf476eeb2c168271f9c97f87ac8bc855d73",
        policyAuditSha256:
          "159828178c5a42affc6d7d97c5092842fa8fab41b0fbb58ee8e55f626ec8b5a2",
        reportContentSha256:
          "7e923f9aeeca1abc2d6bf1a96abc38dc4ae9579718c2c37bc073bd9ac60fe296",
      },
    });
    expect(
      fileSha256(KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH),
    ).toBe(EXPECTED_REPORT_SHA256);
    expect(
      statSync(KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH)
        .size,
    ).toBe(EXPECTED_REPORT_SIZE);
  });

  it("reproduces the one-shot, iterative, declared-order, and full-table facts", () => {
    const audit = requireAudit(REAL_REPORT);
    const sequencePath = (nodeIds: readonly string[]) =>
      nodeIds.map(
        (nodeId) =>
          REAL_REPORT.nodes.find((node) => node.nodeId === nodeId)?.sequence,
      );

    expect(sequencePath(audit.oneShotBestNeighbor.pathNodeIds)).toEqual([0, 1]);
    expect(sequencePath(audit.iterativeBestImprovement.pathNodeIds)).toEqual([
      0, 1, 7,
    ]);
    expect(sequencePath(audit.declaredFirstImprovement.pathNodeIds)).toEqual([
      0, 1, 13,
    ]);
    expect(audit.fullBoundedTableReference).toMatchObject({
      status: "selected",
      evaluatorCalls: 0,
      technicalObjective: 926_093.666_196_721,
    });
    expect(audit.technicalGaps.oneShotBestNeighbor).toMatchObject({
      terminalSequence: 1,
      referenceSequence: 7,
      referenceMinusTerminalAbsolute: 7276.3972660599975,
      referenceMinusTerminalPercentOfReference: 0.785708566169412,
    });
    expect(audit.technicalGaps.iterativeBestImprovement).toMatchObject({
      terminalSequence: 7,
      referenceSequence: 7,
      referenceMinusTerminalAbsolute: 0,
      referenceMinusTerminalPercentOfReference: 0,
    });
    expect(audit.technicalGaps.declaredFirstImprovement).toMatchObject({
      terminalSequence: 13,
      referenceSequence: 7,
      referenceMinusTerminalAbsolute: 4920.0066389400745,
      referenceMinusTerminalPercentOfReference: 0.531264473403165,
    });
    expect(audit.oneShotBestNeighbor.evaluatorCalls).toBe(0);
    expect(audit.iterativeBestImprovement.evaluatorCalls).toBe(0);
    expect(audit.declaredFirstImprovement.evaluatorCalls).toBe(0);
  });

  it("attaches compact CP39 diagnostics only through exact node/carry/character occurrences", () => {
    const sourceByOccurrenceId = new Map(
      CP39_REPORT.occurrenceComparisons.map((occurrence) => [
        occurrence.occurrenceId,
        occurrence,
      ]),
    );
    const expectedStates: Record<number, ReviewStateCounts> = {
      0: stateCounts(21, 3, 62, 42),
      1: stateCounts(21, 3, 58, 46),
      7: stateCounts(21, 3, 58, 46),
      13: stateCounts(23, 1, 58, 46),
    };
    const expectedAttachments = {
      0: { presetOnly: 96, kqmOnly: 0, kqmAndPreset: 32, none: 0 },
      1: { presetOnly: 96, kqmOnly: 0, kqmAndPreset: 32, none: 0 },
      7: { presetOnly: 96, kqmOnly: 32, kqmAndPreset: 0, none: 0 },
      13: { presetOnly: 96, kqmOnly: 0, kqmAndPreset: 32, none: 0 },
    };
    const globalOccurrenceIds = new Set<string>();

    for (const node of REAL_REPORT.nodes) {
      expect(node.reviewDiagnostics.occurrences).toHaveLength(16);
      expect(node.reviewDiagnostics.comparisonRowCount).toBe(128);
      const contexts = new Set<string>();
      for (const diagnostic of node.reviewDiagnostics.occurrences) {
        const source = sourceByOccurrenceId.get(diagnostic.occurrenceId);
        expect(source).toBeDefined();
        expect(diagnostic).toMatchObject({
          nodeId: source?.nodeId,
          carryCharacterId: source?.carryCharacterId,
          characterId: source?.characterId,
          artifactOccurrenceId: source?.artifactOccurrenceId,
          allocationId: source?.allocationId,
          attachmentScope: "node-carry-character-occurrence",
          comparisonRowCount: 8,
          usedForObjective: false,
          usedAsPolicyFilter: false,
          rankProduced: false,
        });
        expect(diagnostic.comparisonRows).toEqual(
          source?.observableComparisons.map((comparison) => ({
            relationship: comparison.relationship,
            observedStatId: comparison.observedStatId,
            comparisonStatus: comparison.comparisonStatus,
          })),
        );
        expect(globalOccurrenceIds.has(diagnostic.occurrenceId)).toBe(false);
        globalOccurrenceIds.add(diagnostic.occurrenceId);
        contexts.add(
          `${diagnostic.carryCharacterId}\u0000${diagnostic.characterId}`,
        );
        expect("sheetId" in diagnostic).toBe(false);
      }
      expect(contexts.size).toBe(16);
    }
    expect(globalOccurrenceIds.size).toBe(576);
    for (const sequence of [0, 1, 7, 13] as const) {
      expect(
        REAL_REPORT.nodes[sequence]?.reviewDiagnostics.stateCounts,
      ).toEqual(expectedStates[sequence]);
      expect(
        REAL_REPORT.nodes[sequence]?.reviewDiagnostics
          .applicableLayerAttachmentCounts,
      ).toEqual(expectedAttachments[sequence]);
    }
  });

  it("authenticates before any policy call when CP38, CP39, or an input hash drifts", () => {
    const counters = emptyCounters();
    const environment = countingEnvironment(counters);
    const invalidInputs: BuildKeqingIneffaFurinaXilonenCachedPolicyAuditInput[] =
      [
        {
          ...REAL_INPUT,
          cp38Report: {
            ...CP38_REPORT,
            validationStatus: "not-authenticated",
          },
        },
        {
          ...REAL_INPUT,
          cp39Report: {
            ...CP39_REPORT,
            occurrenceComparisons: CP39_REPORT.occurrenceComparisons.slice(1),
          },
        },
        {
          ...REAL_INPUT,
          inputFiles: INPUT_FILES.map((entry, index) =>
            index === 0 ? { ...entry, sha256: "0".repeat(64) } : entry,
          ),
        },
      ];

    for (const invalidInput of invalidInputs) {
      const report = buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
        invalidInput,
        environment,
      );
      expect(report.validationStatus).toBe("not-authenticated");
      expect(report.nodes).toEqual([]);
      expect(report.policyAudit).toBeNull();
      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.executionBoundary.traceProductionTotalPolicyCalls).toBe(0);
    }
    expect(counters).toEqual(emptyCounters());
  });

  it("accepts exact injected policy traces while withholding uninstrumented forbidden seams", () => {
    const counters = emptyCounters();
    const report = buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
      REAL_INPUT,
      countingEnvironment(counters),
    );

    requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
      report,
    );
    expect(counters).toEqual({
      oneShot: 1,
      best: 1,
      declared: 1,
      reference: 1,
    });
    expect(report.executionBoundary).toMatchObject({
      traceProductionEnvironment: "injected-uncharacterized-policy-functions",
      traceProductionTotalPolicyCalls: 4,
      authenticationUsesDefaultPolicyRecomputation: true,
      authenticationPolicyRecomputationCallsPerGuard: 4,
      actualTotalPolicyCallsAttested: false,
      forbiddenSeamCallCountsAttestation:
        "uncharacterized-injected-environment",
      evaluatorCalls: null,
      generatorCalls: null,
      damageReplayCalls: null,
      optimizerCalls: null,
      rankCalls: null,
      recommendationCalls: null,
      energyRecoveryCalls: null,
      energyRecoveryValuesInfluencedPolicy: null,
    });
    expect(report.authentication.reportContentSha256).toBe(
      "ed41cf3970d36f204388af2c033a6a1396884000b59ae99327a3093c0d250bf2",
    );

    const falselyAttested = structuredClone(report);
    falselyAttested.executionBoundary.evaluatorCalls = 0;
    resealSelfDigest(falselyAttested);
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
        falselyAttested,
      ),
    ).toThrow(/Refusing unauthenticated or mutated/);
  });

  it("withholds an injected policy trace that drifts from the default cached oracle", () => {
    const counters = emptyCounters();
    const environment = countingEnvironment(counters);
    const original = environment.runOneShotBestNeighbor;
    environment.runOneShotBestNeighbor = (input) => {
      const trace = original(input);
      return { ...trace, pathNodeIds: [trace.startNodeId] };
    };

    const report = buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
      REAL_INPUT,
      environment,
    );

    expect(report.validationStatus).toBe("not-authenticated");
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "policy.expected_empirical_facts_mismatch",
        stage: "policy",
      }),
    );
    expect(report.nodes).toEqual([]);
    expect(report.policyAudit).toBeNull();
    expect(counters).toEqual({
      oneShot: 1,
      best: 1,
      declared: 1,
      reference: 1,
    });
    expect(report.executionBoundary.traceProductionTotalPolicyCalls).toBe(4);
  });

  it("rejects self-resealed capability, context, trace, and digest mutations", () => {
    const mutations: Array<
      (report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport) => void
    > = [
      (report) => {
        (report.capabilities as { guideClaims: boolean }).guideClaims = true;
      },
      (report) => {
        const occurrence = report.nodes[0]?.reviewDiagnostics.occurrences[0];
        if (occurrence) occurrence.nodeId = report.nodes[1]?.nodeId ?? "drift";
      },
      (report) => {
        if (report.policyAudit) {
          report.policyAudit.oneShotBestNeighbor.pathNodeIds = [
            report.policyAudit.startNodeId,
          ];
        }
      },
      (report) => {
        report.authentication.compactNodeTableSha256 = "0".repeat(64);
      },
      (report) => {
        (
          report.reviewBoundary as {
            energyRecoveryProvenanceReadForAuthentication: boolean;
          }
        ).energyRecoveryProvenanceReadForAuthentication = false;
      },
      (report) => {
        (
          report.reviewBoundary as {
            energyRecoveryValuesProjectedIntoPolicyInput: boolean;
          }
        ).energyRecoveryValuesProjectedIntoPolicyInput = true;
      },
    ];

    for (const mutate of mutations) {
      const report = structuredClone(REAL_REPORT);
      mutate(report);
      resealSelfDigest(report);
      expect(() =>
        requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
          report,
        ),
      ).toThrow(/Refusing unauthenticated or mutated/);
    }
  });

  it("uses explicit no-claim CLI wording", () => {
    expect(
      formatKeqingIneffaFurinaXilonenCachedPolicyAuditSummary(REAL_REPORT),
    ).toBe(
      "Wrote authenticated cached-policy audit for 36 CP38 nodes: one-shot sequence 0→1, iterative best-improvement sequence 0→1→7, declared first-improvement sequence 0→1→13; 576 exact CP39 node/carry/character diagnostics; 0 evaluator, generator, replay, optimizer, rank, recommendation, or ER calls. CP39 ER-deferral provenance was authenticated; no ER value influenced the default cached policies. This is a source-not-ready technical policy audit, not a guide or equipment recommendation.",
    );

    const injectedReport =
      buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
        REAL_INPUT,
        countingEnvironment(emptyCounters()),
      );
    expect(
      formatKeqingIneffaFurinaXilonenCachedPolicyAuditSummary(injectedReport),
    ).toBe(
      "Wrote authenticated cached-policy audit for 36 CP38 nodes: one-shot sequence 0→1, iterative best-improvement sequence 0→1→7, declared first-improvement sequence 0→1→13; 576 exact CP39 node/carry/character diagnostics; Evaluator, generator, replay, optimizer, rank, recommendation, and ER call counts are uncharacterized for the injected policy environment. CP39 ER-deferral provenance was authenticated; CP40 projected no ER values, while injected-policy ER-value influence remains uncharacterized. This is a source-not-ready technical policy audit, not a guide or equipment recommendation.",
    );
  });
});

type Counters = {
  oneShot: number;
  best: number;
  declared: number;
  reference: number;
};

function emptyCounters(): Counters {
  return { oneShot: 0, best: 0, declared: 0, reference: 0 };
}

function countingEnvironment(
  counters: Counters,
): KeqingIneffaFurinaXilonenCachedPolicyAuditEnvironment {
  return {
    runOneShotBestNeighbor(input) {
      counters.oneShot += 1;
      return runCachedOneShotBestNeighborPass(input);
    },
    runBestImprovement(input) {
      counters.best += 1;
      return runCachedBestImprovementCoordinateDescent(input);
    },
    runDeclaredFirstImprovement(input) {
      counters.declared += 1;
      return runCachedDeclaredOrderFirstImprovementCoordinateDescent(input);
    },
    selectTableReference(table, direction, tolerance) {
      counters.reference += 1;
      return selectCachedTableBestComparableReference(
        table,
        direction,
        tolerance,
      );
    },
  };
}

function requireAudit(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
): NonNullable<
  KeqingIneffaFurinaXilonenCachedPolicyAuditReport["policyAudit"]
> {
  if (!report.policyAudit)
    throw new Error("Authenticated policy audit missing.");
  return report.policyAudit;
}

function stateCounts(
  resolved: number,
  withheld: number,
  baseline: number,
  unlisted: number,
): ReviewStateCounts {
  return {
    "listed-condition-resolved": resolved,
    "listed-condition-withheld": withheld,
    "listed-baseline-context-unknown": baseline,
    "not-listed-nonexhaustive": unlisted,
    "no-applicable-target": 0,
  };
}

function resealSelfDigest(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
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
