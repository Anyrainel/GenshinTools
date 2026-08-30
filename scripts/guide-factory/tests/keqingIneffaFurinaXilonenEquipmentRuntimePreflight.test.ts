import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import type { KeqingIneffaFormulaDraftReport } from "../src/keqingIneffaFormulaDraft";
import type { KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport } from "../src/keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import {
  buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
  type BuildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightInput,
  type KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
} from "../src/keqingIneffaFurinaXilonenEquipmentRuntimePreflight";
import { formatKeqingIneffaFurinaXilonenEquipmentRuntimePreflightSummary } from "../src/preflight-keqing-ineffa-furina-xilonen-equipment-runtime";
import { REPOSITORY_ROOT } from "../src/paths";
import type { SourceBackedEquipmentRuntimePreflightEnvironment } from "../src/sourceBackedEquipmentRuntimePreflight";

const EXPECTED_REPORT_SHA256 =
  "c0dedcfb87d27dfebeba99d89a26a6ed614f4de536b23d6bef54529b0246155b";

describe("Keqing/Ineffa/Furina/Xilonen equipment runtime preflight", () => {
  it("authenticates both upstream reports and materializes all 36 nodes without evaluating them", async () => {
    const input = await fixture();
    const before = structuredClone(input);
    const report =
      await buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
        input,
      );
    const repeated =
      await buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
        input,
      );

    expect(report).toEqual(repeated);
    expect(input).toEqual(before);
    expect(report).toMatchObject({
      validationStatus: "authenticated-materialized-objective-not-ready",
      issues: [],
      sourceAuthentication: {
        dependencySetClassification:
          "authenticated-declared-non-self-checkpoint-inputs",
        transitiveModuleGraphClaimed: false,
        deliberatelyExcludedProducerPaths: [
          "scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentRuntimePreflight.ts",
          "scripts/guide-factory/src/preflight-keqing-ineffa-furina-xilonen-equipment-runtime.ts",
          "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json",
        ],
        expectedFileCount:
          KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS.length,
        observedFileCount:
          KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS.length,
        exactPathSet: true,
        allByteHashesWellFormed: true,
        allDeclaredFileHashesMatch: true,
        upstreamByteHashesMatch: true,
        latticeReportDigestMatches: true,
        latticeFullDigestAuthenticated: true,
        formulaDraftDigestMatches: true,
        formulaDraftSemanticClosure: true,
        authentication: "accepted",
      },
      materializationExecuted: true,
      candidateGeneratorExecuted: false,
      damageReplayExecuted: false,
      damageEvaluationExecuted: false,
      rankingProduced: false,
      recommendationProduced: false,
      guideProduced: false,
      supportsGuideClaims: false,
      supportsEquipmentRecommendations: false,
      supportsDamageClaims: false,
      supportsOptimality: false,
      supportsEnergyRequirements: false,
      promotionEligible: false,
      summary: {
        candidateNodeCount: 36,
        materializedNodeCount: 36,
        runtimeReadyNodeCount: 36,
        evaluatorReadyNodeCount: 0,
        objectiveFormulaAvailabilityCheckCount: 396,
        unresolvedFormulaReferenceAvailabilityCheckCount: 180,
        generatorCallCount: 0,
        replayCallCount: 0,
        damageEvaluationCallCount: 0,
        energyRecoveryCallCount: 0,
      },
    });
    expect(report.runtimeBoundary.occurrenceResolutionCount).toBe(14);
    expect(report.runtimeBoundary.resolvedEquipmentProjection).toHaveLength(14);
    expect(report.runtimePreflight?.nodes).toHaveLength(36);
    expect(
      report.runtimePreflight?.nodes.every(
        (node) =>
          node.runtimeReady &&
          !node.readyForEvaluator &&
          node.objectiveFormulaCoverage.every(({ available }) => available) &&
          node.unresolvedFormulaReferenceCoverage.every(
            ({ available }) => available,
          ),
      ),
    ).toBe(true);
    expect(sha256Text(stableJson(report))).toBe(EXPECTED_REPORT_SHA256);
  });

  it("retains the exact eight upstream readiness blockers and source caveats", async () => {
    const report = await canonicalReport();

    expect(report.sourceBoundary.sourceReadiness).toMatchObject({
      readyForDamageReplay: false,
      blockerCount: 8,
      mappingSummary: {
        comparisons: 11,
        exactClaims: 11,
        rangeClaims: 0,
        completeTokenMappings: 10,
        partialTokenMappings: 1,
        unresolvedMappings: 6,
        nonNullFormulaUnresolvedMappings: 5,
        nullFormulaUnresolvedMappings: 1,
        sourceAbsentMappings: 2,
      },
    });
    expect(report.sourceBoundary.sourceReadiness.blockerCodes).toEqual([
      "translation-unreviewed",
      "partial-token-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-source-token",
    ]);
    expect(report.sourceBoundary).toMatchObject({
      sourceBindingEstablishedByWrapper: true,
      sourceBindingEstablishedByCore: false,
      gameplayApplicability: "unknown-not-validated",
      sourcePublishedWholeCandidateCount: 0,
      compositionOwner: "source-specific-wrapper",
    });
    expect(report.sourceBoundary.xilonenScrollWarning).toContain(
      "generally cannot activate Scroll for Hydro",
    );
    expect(report.runtimePreflight?.objectiveBoundary.policyChecks).toEqual({
      reviewed: false,
      sourceBindingEstablishedByCaller: true,
      noUnresolvedMappings: false,
      callerReadyForDamageReplay: false,
      noSourceReadinessBlockers: false,
    });
  });

  it("projects exact runtime equipment while keeping levels, talents, enemy, and roll budget wrapper-owned", async () => {
    const report = await canonicalReport();
    expect(report.runtimeBoundary).toMatchObject({
      assumptionsOwner: "source-specific-wrapper",
      sourceAuthoredCharacterLevels: false,
      sourceAuthoredTalentLevels: false,
      sourceAuthoredEnemyContext: false,
      sourceAuthoredArtifactRollBudget: false,
      energyRecoveryInputsUsed: false,
    });
    expect(
      report.runtimeBoundary.resolvedEquipmentProjection.map(
        ({ characterId, equipmentKind, equipmentId, refinement }) => [
          characterId,
          equipmentKind,
          equipmentId,
          refinement,
        ],
      ),
    ).toEqual([
      ["keqing", "weapon", "lions_roar", 5],
      ["keqing", "weapon", "the_black_sword", 5],
      ["keqing", "weapon", "wolffang", 5],
      ["keqing", "artifact", "thundering_fury", null],
      ["keqing", "artifact", "gilded_dreams", null],
      ["ineffa", "weapon", "fractured_halo", 1],
      ["ineffa", "artifact", "aubade_of_morningstar_and_moon", null],
      ["furina", "weapon", "freedomsworn", 1],
      ["furina", "weapon", "key_of_khajnisut", 1],
      ["furina", "weapon", "splendor_of_tranquil_waters", 1],
      ["furina", "artifact", "golden_troupe", null],
      ["furina", "artifact", "tenacity_of_the_millelith", null],
      ["xilonen", "weapon", "peak_patrol_song", 1],
      ["xilonen", "artifact", "scroll_of_the_hero_of_cinder_city", null],
    ]);
    expect(report.runtimePreflight?.runtimeBoundary.assumptions).toMatchObject({
      investments: [
        expect.objectContaining({ characterId: "keqing", charLevel: 90, constellation: 0, talentLevels: { auto: 10, skill: 10, burst: 10 } }),
        expect.objectContaining({ characterId: "ineffa", charLevel: 90, constellation: 0, talentLevels: { auto: 10, skill: 10, burst: 10 } }),
        expect.objectContaining({ characterId: "furina", charLevel: 90, constellation: 0, talentLevels: { auto: 10, skill: 10, burst: 10 } }),
        expect.objectContaining({ characterId: "xilonen", charLevel: 90, constellation: 0, talentLevels: { auto: 10, skill: 10, burst: 10 } }),
      ],
      combatOptions: {},
      enemyAura: null,
      extraBuffs: [],
      calcContext: {
        enemyLevel: 110,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
      energyRecoveryThresholds: null,
      perCharacterConstraints: null,
    });
  });

  it.each([
    [
      "lattice payload",
      (input: MutableInput) =>
        (input.latticeReport.lattice.lattice!.nodes[0].selections[0].occurrenceId =
          "mutated"),
    ],
    [
      "formula count",
      (input: MutableInput) =>
        (input.formulaDraft.authoredTranslation.formulaComparisons[0].sourceCountClaim = {
          type: "exact",
          value: 2,
        }),
    ],
    [
      "upstream byte hash",
      (input: MutableInput) => (input.inputFiles[0].sha256 = "0".repeat(64)),
    ],
    [
      "input path",
      (input: MutableInput) => (input.inputFiles[0].path = "wrong.json"),
    ],
  ])("fails before runtime materialization when %s drifts", async (_label, mutate) => {
    const input = await fixture();
    mutate(input);
    let bootstrapCalls = 0;
    const environment: SourceBackedEquipmentRuntimePreflightEnvironment = {
      environmentId: "must-not-run",
      async bootstrap() {
        bootstrapCalls += 1;
      },
      materialize() {
        throw new Error("materialize must not run");
      },
    };
    const report =
      await buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
        input,
        environment,
      );
    expect(report.validationStatus).toBe("not-authenticated");
    expect(report.materializationExecuted).toBe(false);
    expect(report.runtimePreflight).toBeNull();
    expect(bootstrapCalls).toBe(0);
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
        report,
      ),
    ).toThrow(/Refusing to write/);
  });

  it("rejects a valid-looking non-report dependency hash before bootstrap or materialization", async () => {
    const input = await fixture();
    const dependency = input.inputFiles.find(
      ({ path: inputPath }) =>
        inputPath ===
        "scripts/guide-factory/src/sourceBackedEquipmentRuntimePreflight.ts",
    );
    expect(dependency).toBeDefined();
    if (!dependency) throw new Error("Missing runtime-core dependency fixture.");
    dependency.sha256 = "0".repeat(64);
    let bootstrapCalls = 0;
    let materializationCalls = 0;
    const environment: SourceBackedEquipmentRuntimePreflightEnvironment = {
      environmentId: "must-not-run-for-dependency-hash-drift",
      async bootstrap() {
        bootstrapCalls += 1;
      },
      materialize() {
        materializationCalls += 1;
        throw new Error("materialize must not run");
      },
    };

    const report =
      await buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
        input,
        environment,
      );

    expect(report.validationStatus).toBe("not-authenticated");
    expect(report.sourceAuthentication).toMatchObject({
      allByteHashesWellFormed: true,
      allDeclaredFileHashesMatch: false,
      authentication: "rejected",
    });
    expect(report.issues.map(({ code }) => code)).toContain(
      "input.declared_file_hash_mismatch",
    );
    expect(report.materializationExecuted).toBe(false);
    expect(report.runtimePreflight).toBeNull();
    expect(bootstrapCalls).toBe(0);
    expect(materializationCalls).toBe(0);
  });

  it.each([
    [
      "runtime config",
      (report: MutableReport) =>
        (report.runtimePreflight!.nodes[0].materializedConfigs![0].weaponId =
          "mutated"),
    ],
    [
      "source blocker",
      (report: MutableReport) =>
        report.sourceBoundary.sourceReadiness.blockerCodes.pop(),
    ],
    [
      "capability",
      (report: MutableReport) =>
        ((report.supportsDamageClaims as boolean) = true),
    ],
    [
      "caution",
      (report: MutableReport) => report.cautions.reverse(),
    ],
    [
      "execution count",
      (report: MutableReport) =>
        (report.summary.materializedNodeCount -= 1),
    ],
  ])("full-report guard rejects post-build %s mutation", async (_label, mutate) => {
    const report = structuredClone(await canonicalReport());
    mutate(report);
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
        report,
      ),
    ).toThrow(/Refusing to write/);
  });

  it("matches the durable report and emits an explicit materialization-only summary", async () => {
    const report = await canonicalReport();
    const durable = (await readJson(
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_PATH,
    )) as KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport;
    expect(durable).toEqual(report);
    expect(
      formatKeqingIneffaFurinaXilonenEquipmentRuntimePreflightSummary(report),
    ).toContain("36/36 nodes");
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
        report,
      ),
    ).not.toThrow();
  });
});

type MutableInput =
  BuildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightInput;
type MutableReport =
  KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport;

async function canonicalReport(): Promise<KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport> {
  return buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
    await fixture(),
  );
}

async function fixture(): Promise<MutableInput> {
  const [latticeReport, formulaDraft, inputFiles] = await Promise.all([
    readJson(
      path.join(
        REPOSITORY_ROOT,
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS[0],
      ),
    ),
    readJson(
      path.join(
        REPOSITORY_ROOT,
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS[1],
      ),
    ),
    Promise.all(
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  return {
    latticeReport:
      latticeReport as KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
    formulaDraft: formulaDraft as KeqingIneffaFormulaDraftReport,
    inputFiles,
  };
}
