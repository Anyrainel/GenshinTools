import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  formatKeqingIneffaFurinaXilonenEquipmentTechnicalComputationSummary,
} from "../src/compute-keqing-ineffa-furina-xilonen-equipment-technical";
import {
  buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  type BuildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationInput,
  type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationEnvironment,
  type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
} from "../src/keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import type { KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport } from "../src/keqingIneffaFurinaXilonenEquipmentRuntimePreflight";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import { REPOSITORY_ROOT } from "../src/paths";

let INPUT: BuildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationInput;
let REPORT: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport;

beforeAll(async () => {
  const sourcePreflight = (await readJson(
    path.join(
      REPOSITORY_ROOT,
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS[0],
    ),
  )) as KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport;
  const inputFiles = await Promise.all(
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  );
  INPUT = { sourcePreflight, inputFiles };
  REPORT =
    await buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
      INPUT,
    );
}, 120_000);

describe("Keqing/Ineffa/Furina/Xilonen bounded equipment technical computation", () => {
  it("authenticates the exact durable real-runtime computation", async () => {
    expect(REPORT.validationStatus).toBe(
      "authenticated-completed-technical-objective-source-not-ready",
    );
    expect(REPORT.issues).toEqual([]);
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
        REPORT,
      ),
    ).not.toThrow();
    const durable = (await readJson(
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_PATH,
    )) as KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport;
    expect(durable).toEqual(REPORT);
    expect(await sha256File(
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_PATH,
    )).toBe(sha256Text(stableJson(REPORT)));
  });

  it("keeps source authority narrower than the technical inputs", () => {
    expect(REPORT.sourceAuthentication).toMatchObject({
      dependencySetClassification:
        "authenticated-declared-non-self-selected-checkpoint-inputs",
      dependencySetExhaustive: false,
      transitiveModuleGraphClaimed: false,
      expectedFileCount:
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS.length,
      observedFileCount:
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS.length,
      exactPathSet: true,
      allByteHashesWellFormed: true,
      allDeclaredFileHashesMatch: true,
      sourcePreflightByteHashMatches: true,
      sourceSpecificPreflightFullDigestAuthenticated: true,
      nestedGenericPreflightAuthenticated: true,
      nestedGenericPreflightComplete: true,
      authentication: "accepted",
    });
    expect(REPORT.sourceBoundary).toMatchObject({
      sourceReadyForDamageReplay: false,
      sourceReadinessBlockerCount: 8,
      objectiveReviewStatus: "unreviewed",
      runtimeAssumptionsOwner: "source-specific-runtime-preflight-wrapper",
      equipmentLatticeCompositionOwner:
        "source-specific-equipment-lattice-wrapper",
      sheetRecombinationOwner: "generic-bounded-technical-computation-core",
      sourcePublishedWholeCandidateCount: 0,
      sourceEvidenceRef: {
        supports: ["roster"],
        doesNotSupport: [
          "damage_plan",
          "formula_counts_and_mappings",
          "selected_weapons",
          "selected_artifact_sets",
          "investment",
          "artifact_stats",
        ],
      },
      sourceRotationTextInput: {
        role: "upstream-input-to-unreviewed-wrapper-authored-formula-translation",
        sourceAuthoredFormulaCountsOrMappings: false,
      },
      runtimeAssumptions: {
        characterLevel: 90,
        constellation: 0,
        talentLevels: { auto: 10, skill: 10, burst: 10 },
        enemyLevel: 110,
        enemyResistance: 0.1,
        artifactRollMultiplier: 0.85,
        artifactSubstatBudget: "8_6",
        energyRecoveryThresholds: null,
      },
      gameplayApplicability: "unknown-not-validated",
    });
  });

  it("separates finite synthetic references from intact generator endpoints", () => {
    expect(REPORT.executionBoundary).toMatchObject({
      runtimeEnvironmentId: "existing-generator-and-replay-runtime-v1",
      nodeCount: 36,
      carryCount: 4,
      plannedGeneratorInvocationCount: 144,
      observedGeneratorInvocationCount: 144,
      freshRuntimeIdentityCount: 144,
      freshTeamBuildPerGeneratorInvocation: true,
      hardMaximumGeneratorResultEmissionsPerInvocation: 64,
      observedReplayCount: 364,
      successfulReplayCount: 364,
      completeTechnicalDomain: true,
      nodeLocalSheetPoolsOnly: true,
      crossNodeSheetCompositionsAllowed: false,
    });
    expect(REPORT.provenanceBoundary).toMatchObject({
      compositionCountUnit: "deduplicated-node-local-compositions",
      finiteDomainScope: "complete-for-36-node-local-sheet-products-only",
      candidateSpaceExhaustive: false,
      globalSearchExecuted: false,
      intactGeneratorEndpointCompositionCount: 139,
      crossEndpointRecombinationCount: 225,
      nodesWithCrossEndpointBoundedTechnicalReference: 36,
      allNodeBoundedTechnicalReferencesAreCrossEndpointRecombinations: true,
    });
    expect(REPORT.technicalReferenceSummary).toMatchObject({
      genericReportContentSha256:
        "85a3559e66a7637d4892101978ce25abbe5cefe271eff3d7a20b8ba6c318da89",
      genericStableFullReportSha256:
        "79278ba285e33f7b9fe6749f716bc60f460b0d7fce7eafe6f9df7d988962a711",
      resultFingerprintSha256:
        "ea78f4ea4252bd2b39cfe9d99fb0a7ba37d172e2095c628f9df07d82825392b5",
      objectiveObservationCount: 364,
      uniqueExactObjectiveValueCount: 364,
      boundedTechnicalReference: {
        unreviewedTechnicalObjective: 926_093.666_196_721,
        provenance: "cross-endpoint-recombination",
      },
      intactGeneratorEndpointTechnicalReference: {
        unreviewedTechnicalObjective: 914_219.528_685_479,
        provenance: "intact-generator-endpoint",
      },
    });
    expect(REPORT.technicalReferenceSummary.boundedOverIntact).toEqual({
      absoluteDelta: 11_874.137_511_242_065,
      ratio: 1.012_988_278_130_872_3,
    });
    expect(
      REPORT.technicalComputation?.nodes.every(
        ({ boundedTechnicalReference }) =>
          boundedTechnicalReference?.provenance ===
          "cross-endpoint-recombination",
      ),
    ).toBe(true);
  });

  it("exposes execution but no publication-facing capability", () => {
    expect(Object.values(REPORT.capabilities).every((value) => value === false)).toBe(
      true,
    );
    expect(REPORT).toMatchObject({
      generatorExecuted: true,
      damageComputationExecuted: true,
      rankingProduced: false,
      recommendationProduced: false,
      guideProduced: false,
      supportsGuideClaims: false,
      supportsEquipmentRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsOptimality: false,
      supportsGameplayApplicabilityClaims: false,
      supportsEnergyRequirements: false,
      promotionEligible: false,
    });
    expect(REPORT.technicalComputation?.execution.environmentId).toBe(
      "existing-generator-and-replay-runtime-v1",
    );
    expect(REPORT.technicalComputation?.execution).toMatchObject({
      freshRuntimeIdentityPerGeneratorInvocation: true,
      hardMaximumGeneratorResultEmissionsPerInvocation: "64",
    });
  });

  it("rejects authority, provenance, capability, and nested-report mutations", () => {
    const mutations: Array<
      (report: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport) => void
    > = [
      (report) => {
        (report.sourceBoundary.sourceEvidenceRef.supports as string[]).push(
          "selected_weapons",
        );
      },
      (report) => {
        (report.sourceBoundary.objectiveReviewStatus as string) = "reviewed";
      },
      (report) => {
        (report.sourceBoundary.sourceReadyForDamageReplay as boolean) = true;
      },
      (report) => {
        report.sourceAuthentication.dependencySetExhaustive = true as false;
      },
      (report) => {
        report.sourceAuthentication.transitiveModuleGraphClaimed = true as false;
      },
      (report) => {
        report.sourceAuthentication.deliberatelyExcludedProducerPaths.pop();
      },
      (report) => {
        if (report.technicalReferenceSummary.boundedTechnicalReference) {
          report.technicalReferenceSummary.boundedTechnicalReference.provenance =
            "intact-generator-endpoint";
        }
      },
      (report) => {
        report.capabilities.guideClaims = true as false;
      },
      (report) => {
        report.supportsDamageClaims = true as false;
      },
      (report) => {
        if (report.sourcePreflight?.runtimePreflight) {
          report.sourcePreflight.runtimePreflight.inputBoundary.latticeNodeCount = 35;
        }
      },
      (report) => {
        if (report.technicalComputation) {
          report.technicalComputation.execution.observedReplayCalls = 363;
        }
      },
    ];
    for (const mutate of mutations) {
      const mutated = structuredClone(REPORT);
      mutate(mutated);
      expect(() =>
        requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
          mutated,
        ),
      ).toThrow(/unauthenticated|mutated/i);
    }
  });

  it("fails before runtime for exact-set and byte-hash faults", async () => {
    const cases = [
      (input: BuildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationInput) => {
        input.inputFiles[0].sha256 = "a".repeat(64);
      },
      (input: BuildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationInput) => {
        input.inputFiles[0].sha256 = input.inputFiles[0].sha256.toUpperCase();
      },
      (input: BuildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationInput) => {
        input.inputFiles.pop();
      },
      (input: BuildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationInput) => {
        input.inputFiles.push({ ...input.inputFiles[0] });
      },
      (input: BuildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationInput) => {
        input.inputFiles.push({ path: "valid-looking-extra.ts", sha256: "b".repeat(64) });
      },
    ];
    for (const mutate of cases) {
      const input = structuredClone(INPUT);
      mutate(input);
      const calls = { runtime: 0 };
      const result =
        await buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
          input,
          rejectingRuntime(calls),
        );
      expect(calls.runtime).toBe(0);
      expectWithheld(result);
    }
  });

  it("fails before runtime when the CP37 wrapper is tampered", async () => {
    const input = structuredClone(INPUT);
    input.sourcePreflight.sourceBoundary.exactCharacterIds[0] = "not-keqing";
    const calls = { runtime: 0 };
    const result =
      await buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
        input,
        rejectingRuntime(calls),
      );
    expect(calls.runtime).toBe(0);
    expectWithheld(result);
    expect(result.issues.map(({ code }) => code)).toContain(
      "input.source_preflight_unauthenticated",
    );
  });

  it("retains an unexpected generic diagnostic but withholds every wrapper reference", async () => {
    const unexpected = structuredClone(REPORT.technicalComputation);
    if (!unexpected) throw new Error("Expected completed nested computation.");
    unexpected.authentication.resultFingerprintSha256 = "c".repeat(64);
    const result =
      await buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
        INPUT,
        {
          async runTechnicalComputation() {
            return unexpected;
          },
        },
      );
    expect(result.validationStatus).toBe("not-authenticated");
    expect(result.technicalComputation).toEqual(unexpected);
    expect(result.technicalReferenceSummary).toEqual({
      genericReportContentSha256: null,
      genericStableFullReportSha256: null,
      resultFingerprintSha256: null,
      objectiveObservationCount: 0,
      uniqueExactObjectiveValueCount: 0,
      boundedTechnicalReference: null,
      intactGeneratorEndpointTechnicalReference: null,
      boundedOverIntact: { absoluteDelta: null, ratio: null },
    });
    expect(result.provenanceBoundary).toMatchObject({
      compositionCountUnit: "deduplicated-node-local-compositions",
      finiteDomainScope: "complete-for-36-node-local-sheet-products-only",
      candidateSpaceExhaustive: false,
      globalSearchExecuted: false,
      intactGeneratorEndpointCompositionCount: 0,
      crossEndpointRecombinationCount: 0,
      nodesWithCrossEndpointBoundedTechnicalReference: 0,
      allNodeBoundedTechnicalReferencesAreCrossEndpointRecombinations: false,
    });
    expect(Object.values(result.capabilities).every((value) => value === false)).toBe(
      true,
    );
    expect(result).toMatchObject({
      rankingProduced: false,
      recommendationProduced: false,
      guideProduced: false,
      supportsGuideClaims: false,
      supportsEquipmentRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsOptimality: false,
      supportsGameplayApplicabilityClaims: false,
      supportsEnergyRequirements: false,
      promotionEligible: false,
    });
  });

  it("formats a technical-only CLI summary", () => {
    expect(
      formatKeqingIneffaFurinaXilonenEquipmentTechnicalComputationSummary(REPORT),
    ).toBe(
      "Wrote authenticated bounded equipment technical computation: 36 nodes, 144 fresh generator runs, 364 node-local technical replays (139 intact-generator-endpoint and 225 cross-endpoint recombinations); all 36 node maxima are synthetic technical references; 0 ranks, recommendations, guides, damage/DPS claims, optimality claims, or ER requirements.",
    );
  });
});

function rejectingRuntime(calls: {
  runtime: number;
}): KeqingIneffaFurinaXilonenEquipmentTechnicalComputationEnvironment {
  return {
    async runTechnicalComputation() {
      calls.runtime += 1;
      throw new Error("Runtime must not be reached for invalid source inputs.");
    },
  };
}

function expectWithheld(
  report: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
): void {
  expect(report.validationStatus).toBe("not-authenticated");
  expect(report.technicalComputation).toBeNull();
  expect(report.generatorExecuted).toBe(false);
  expect(report.damageComputationExecuted).toBe(false);
  expect(report.technicalReferenceSummary.boundedTechnicalReference).toBeNull();
  expect(
    report.technicalReferenceSummary.intactGeneratorEndpointTechnicalReference,
  ).toBeNull();
  expect(report.promotionEligible).toBe(false);
  expect(Object.values(report.capabilities).every((value) => value === false)).toBe(
    true,
  );
}
