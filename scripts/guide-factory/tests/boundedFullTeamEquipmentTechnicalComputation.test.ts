import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { GeneratorResult } from "@/lib/team-comp/generator/generator";
import {
  isCompleteBoundedFullTeamEquipmentTechnicalComputationReport,
  requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport,
  runBoundedFullTeamEquipmentTechnicalComputation,
  type BoundedFullTeamEquipmentTechnicalComputationEnvironment,
  type BoundedFullTeamEquipmentTechnicalComputationInput,
  type BoundedFullTeamEquipmentTechnicalComputationReport,
} from "../src/boundedFullTeamEquipmentTechnicalComputation";
import { sha256Text, stableJson } from "../src/io";
import {
  buildSourceBackedEquipmentCandidateLattice,
  isCompleteSourceBackedEquipmentCandidateLattice,
  type SourceBackedEquipmentAxis,
  type SourceBackedEquipmentCandidateLatticeReport,
  type SourceBackedEquipmentJsonValue,
} from "../src/sourceBackedEquipmentCandidateLattice";
import {
  buildSourceBackedEquipmentRuntimePreflight,
  isCompleteSourceBackedEquipmentRuntimePreflightReport,
  requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport,
  type SourceBackedEquipmentRuntimeObjectiveEnvelope,
  type SourceBackedEquipmentRuntimeOccurrenceResolution,
  type SourceBackedEquipmentRuntimePreflightEnvironment,
  type SourceBackedEquipmentRuntimePreflightInput,
  type SourceBackedEquipmentRuntimePreflightReport,
} from "../src/sourceBackedEquipmentRuntimePreflight";

type SyntheticPayload = {
  [key: string]: SourceBackedEquipmentJsonValue;
  equipmentId: string;
  refinement: number | null;
  artifactType: "4pc" | null;
};

type HarnessFault =
  | "config"
  | "progress"
  | "final-domain"
  | "missing-final"
  | "identity-reuse"
  | "emission-cap"
  | "generator-throw";

type HarnessOptions = {
  generatorFault?: HarnessFault;
  generatorFaultAtCall?: number;
  replayFault?: "throw" | "agreement" | "tolerance";
  replayFaultAtCall?: number;
  evaluationMode?: "sheet-sum" | "zero";
};

const CHARACTERS = ["alpha", "beta", "gamma", "delta"] as const;
const MEMBERS = CHARACTERS.map((characterId) => ({
  teamMemberId: `member:${characterId}`,
  characterId,
}));
const FORMULA_LINES = CHARACTERS.map((characterId) => ({
  characterId,
  formulaId: `formula:${characterId}`,
  count: 1,
}));
const GENERATED_FROM = [
  {
    path: "synthetic/source-backed-runtime-preflight.json",
    sha256: "a".repeat(64),
  },
];

let PREFLIGHT: SourceBackedEquipmentRuntimePreflightReport;

beforeAll(async () => {
  PREFLIGHT = await buildSyntheticPreflight();
  expect(PREFLIGHT.validationStatus).toBe(
    "materialized-objective-not-ready",
  );
  expect(isCompleteSourceBackedEquipmentRuntimePreflightReport(PREFLIGHT)).toBe(
    true,
  );
});

describe("bounded full-team equipment technical computation", () => {
  it("enumerates the exact full domain with node-local pools, endpoint provenance, and technical-only references", async () => {
    const input = buildComputationInput();
    const before = structuredClone(input);
    const harness = buildHarness();

    const report = await runBoundedFullTeamEquipmentTechnicalComputation(
      input,
      harness.environment,
    );

    expect(input).toEqual(before);
    expect(report.validationStatus).toBe("completed-technical-objective");
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.inputBoundary).toMatchObject({
      preflightAuthenticated: true,
      preflightComplete: true,
      nodeCount: 2,
      teamCharacterIds: [...CHARACTERS],
      carryCharacterIds: [...CHARACTERS],
      objectiveReviewStatus: "unreviewed",
      sourceBindingEstablishedByCaller: true,
      sourceReadyForDamageReplay: false,
      sourceReadinessBlockerCount: 1,
    });
    expect(report.execution).toMatchObject({
      scheduling: "sequential",
      freshRuntimeIdentityPerGeneratorInvocation: true,
      hardMaximumGeneratorResultEmissionsPerInvocation: "64",
      hardMaximumCartesianReplays: "9216",
      plannedGeneratorInvocations: "8",
      theoreticalMaximumCartesianReplays: "512",
      observedGeneratorInvocations: 8,
      freshRuntimeIdentityCount: 8,
      capturedGeneratorResultCount: 8,
      knownCompleteNodeExpectedReplayCount: "32",
      fullDomainExpectedReplayCount: "32",
      observedReplayCalls: 32,
      successfulReplayCount: 32,
    });
    expect(harness.bootstrapCalls).toBe(1);
    expect(harness.generatorCalls).toHaveLength(8);
    expect(new Set(harness.runtimeIdentities).size).toBe(8);
    expect(harness.replayCalls).toHaveLength(32);
    expect(harness.events.slice(0, 8)).toEqual(
      PREFLIGHT.nodes.flatMap(({ nodeId }) =>
        CHARACTERS.map((carryCharacterId) =>
          `generator:${nodeId}:${carryCharacterId}`,
        ),
      ),
    );
    expect(harness.events.slice(8).every((event) => event.startsWith("replay:"))).toBe(
      true,
    );

    expect(report.nodes).toHaveLength(2);
    for (const node of report.nodes) {
      expect(node.comparisonStatus).toBe("comparable");
      expect(node.generatorRuns.map(({ carryCharacterId }) => carryCharacterId)).toEqual(
        CHARACTERS,
      );
      expect(node.poolSizesByCharacter).toEqual({
        alpha: 2,
        beta: 2,
        gamma: 2,
        delta: 2,
      });
      expect(node.expectedCartesianCompositionCount).toBe("16");
      expect(node.observedCartesianCompositionCount).toBe(16);
      expect(node.provenanceSummary).toEqual({
        intactGeneratorEndpointCompositionCount: 4,
        crossEndpointRecombinationCount: 12,
      });
      expect(
        Object.values(node.sheetPoolsByCharacter).every(
          (cells) =>
            cells
              .map(({ originMultiplicity }) => originMultiplicity)
              .sort((left, right) => left - right)
              .join(",") === "1,3",
        ),
      ).toBe(true);
      const intact = node.compositions.filter(
        ({ provenance }) =>
          provenance.classification === "intact-generator-endpoint",
      );
      expect(intact).toHaveLength(4);
      expect(
        intact.every(
          ({ provenance }) =>
            provenance.originMultiplicity === 1 &&
            provenance.originCarryCharacterIds.length === 1,
        ),
      ).toBe(true);
      expect(node.boundedTechnicalReference).toMatchObject({
        unreviewedTechnicalObjective: 406,
        provenance: "cross-endpoint-recombination",
      });
      expect(node.intactGeneratorEndpointTechnicalReference).toMatchObject({
        unreviewedTechnicalObjective: 106,
        provenance: "intact-generator-endpoint",
      });
      expect(node.boundedReferenceOverIntact).toMatchObject({
        status: "available",
        absoluteDelta: 300,
      });
      expect(node.boundedReferenceOverIntact.ratio).toBeCloseTo(406 / 106, 14);
    }
    expect(report.provenanceSummary).toEqual({
      intactGeneratorEndpointCompositionCount: 8,
      crossEndpointRecombinationCount: 24,
    });
    expect(report.boundedTechnicalReference).toMatchObject({
      unreviewedTechnicalObjective: 406,
      provenance: "cross-endpoint-recombination",
    });
    expect(report.boundedTechnicalReference?.equivalentReferences).toHaveLength(
      2,
    );
    expect(report.intactGeneratorEndpointTechnicalReference).toMatchObject({
      unreviewedTechnicalObjective: 106,
      provenance: "intact-generator-endpoint",
    });
    expect(report.objectiveDistribution).toMatchObject({
      scope: "complete-domain",
      observationCount: 32,
      minimum: 4,
      maximum: 406,
    });
    expect(report.objectiveDistribution?.maximumExactTieClassSize).toBeGreaterThanOrEqual(
      2,
    );
    expect(Object.values(report.capabilities).every((value) => value === false)).toBe(
      true,
    );
    expect(report).toMatchObject({
      generatorExecuted: true,
      damageComputationExecuted: true,
      rankingProduced: false,
      recommendationProduced: false,
      guideProduced: false,
      optimizerExecuted: false,
      energyRecoveryInputsUsed: false,
      supportsGuideClaims: false,
      supportsEquipmentRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsOptimality: false,
      supportsEnergyRequirements: false,
      issues: [],
    });
    expect(report.authentication.resultFingerprintSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(report.authentication.reportContentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(report)).toBe(
      true,
    );
    expect(() =>
      requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
        report,
      ),
    ).not.toThrow();
  });

  it("is deterministic across fresh injected runtimes", async () => {
    const first = await runBoundedFullTeamEquipmentTechnicalComputation(
      buildComputationInput(),
      buildHarness().environment,
    );
    const second = await runBoundedFullTeamEquipmentTechnicalComputation(
      buildComputationInput(),
      buildHarness().environment,
    );

    expect(second.authentication.resultFingerprintSha256).toBe(
      first.authentication.resultFingerprintSha256,
    );
    expect(second.authentication.reportContentSha256).toBe(
      first.authentication.reportContentSha256,
    );
    expect(second).toEqual(first);
  });

  it("authenticates canonical durable records without assigning meaning to record-key insertion order", async () => {
    const fresh = await runBoundedFullTeamEquipmentTechnicalComputation(
      buildComputationInput(),
      buildHarness().environment,
    );
    const durable = JSON.parse(
      stableJson(fresh),
    ) as BoundedFullTeamEquipmentTechnicalComputationReport;

    for (const node of durable.nodes) {
      node.sheetPoolsByCharacter = reverseRecord(node.sheetPoolsByCharacter);
      node.poolSizesByCharacter = reverseRecord(node.poolSizesByCharacter);
      for (const composition of node.compositions) {
        composition.sheetsByCharacter = reverseRecord(
          composition.sheetsByCharacter,
        );
      }
    }

    expect(stableJson(durable)).toBe(stableJson(fresh));
    expect(Object.keys(durable.nodes[0].sheetPoolsByCharacter)).toEqual(
      [...CHARACTERS].sort().reverse(),
    );
    expect(() =>
      requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
        durable,
      ),
    ).not.toThrow();
  });

  it.each([
    ["generator invocation", { maximumGeneratorInvocations: "7" }, "bounds.generator_cap_exceeded"],
    ["theoretical replay", { maximumCartesianReplays: "511" }, "bounds.theoretical_replay_cap_exceeded"],
    ["hard replay", { maximumCartesianReplays: "9217" }, "bounds.replay_policy_exceeds_hard_cap"],
  ])("withholds before bootstrap when the %s cap fails", async (
    _name,
    policyOverride,
    expectedCode,
  ) => {
    const harness = buildHarness();
    const report = await runBoundedFullTeamEquipmentTechnicalComputation(
      buildComputationInput(policyOverride),
      harness.environment,
    );

    expect(report.validationStatus).toBe("withheld-invalid-input");
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues.map(({ code }) => code)).toContain(expectedCode);
    expect(report.execution).toMatchObject({
      bootstrapCalls: 0,
      observedGeneratorInvocations: 0,
      observedReplayCalls: 0,
      successfulReplayCount: 0,
    });
    expect(report.nodes).toEqual([]);
    expect(report.authentication.resultFingerprintSha256).toBeNull();
    expect(harness.bootstrapCalls).toBe(0);
    expect(harness.generatorCalls).toEqual([]);
    expect(harness.replayCalls).toEqual([]);
    expect(() =>
      requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
        report,
      ),
    ).not.toThrow();
  });

  it("withholds before bootstrap when CP37 authentication or full-domain closure is lost", async () => {
    const mutatedPreflight = structuredClone(PREFLIGHT);
    mutatedPreflight.nodes.pop();
    const harness = buildHarness();
    const report = await runBoundedFullTeamEquipmentTechnicalComputation(
      buildComputationInput({}, mutatedPreflight),
      harness.environment,
    );

    expect(report.validationStatus).toBe("withheld-invalid-input");
    expect(report.issues.map(({ code }) => code)).toContain(
      "input.preflight_unauthenticated",
    );
    expect(report.execution.bootstrapCalls).toBe(0);
    expect(harness.generatorCalls).toEqual([]);
    expect(harness.replayCalls).toEqual([]);
  });

  it("withholds before bootstrap when the injected environment has no stable identity", async () => {
    const harness = buildHarness();
    harness.environment.environmentId = "";
    const report = await runBoundedFullTeamEquipmentTechnicalComputation(
      buildComputationInput(),
      harness.environment,
    );

    expect(report.validationStatus).toBe("withheld-invalid-input");
    expect(report.issues.map(({ code }) => code)).toContain(
      "input.invalid_environment_id",
    );
    expect(report.execution.bootstrapCalls).toBe(0);
    expect(harness.bootstrapCalls).toBe(0);
    expect(harness.generatorCalls).toEqual([]);
    expect(harness.replayCalls).toEqual([]);
  });

  it.each([
    ["config", "generator.config_mismatch", 0],
    ["progress", "generator.invalid_final_marker", 0],
    ["final-domain", "capture.character_domain_mismatch", 0],
    ["missing-final", "generator.missing_final_result", 0],
    ["generator-throw", "generator.failed", 0],
    ["identity-reuse", "generator.runtime_identity_reused", 1],
    ["emission-cap", "generator.result_emission_cap_exceeded", 0],
  ] as const)(
    "retains a %s generator failure while replaying unaffected complete nodes",
    async (generatorFault, expectedCode, generatorFaultAtCall) => {
      const harness = buildHarness({
        generatorFault,
        generatorFaultAtCall,
      });
      const report = await runBoundedFullTeamEquipmentTechnicalComputation(
        buildComputationInput(),
        harness.environment,
      );

      expect(report.validationStatus).toBe("withheld-incomplete-generation");
      expect(report.comparisonStatus).toBe("not-comparable");
      expect(report.execution).toMatchObject({
        observedGeneratorInvocations: 8,
        capturedGeneratorResultCount: 7,
        knownCompleteNodeExpectedReplayCount: "16",
        fullDomainExpectedReplayCount: null,
        observedReplayCalls: 16,
        successfulReplayCount: 16,
      });
      expect(report.nodes[0]).toMatchObject({
        comparisonStatus: "not-comparable",
        expectedCartesianCompositionCount: null,
        observedCartesianCompositionCount: 0,
        boundedTechnicalReference: null,
        intactGeneratorEndpointTechnicalReference: null,
        boundedReferenceOverIntact: { status: "not-comparable" },
      });
      expect(report.nodes[0].issues.map(({ code }) => code)).toContain(
        expectedCode,
      );
      expect(
        report.nodes[0].generatorRuns.every(
          ({ progress }) => progress.length <= 64,
        ),
      ).toBe(true);
      expect(report.nodes[1]).toMatchObject({
        comparisonStatus: "comparable",
        expectedCartesianCompositionCount: "16",
        observedCartesianCompositionCount: 16,
      });
      expect(report.nodes[1].boundedTechnicalReference).not.toBeNull();
      expect(report.objectiveDistribution).toMatchObject({
        scope: "partial-diagnostic",
        observationCount: 16,
      });
      expect(report.boundedTechnicalReference).toBeNull();
      expect(report.intactGeneratorEndpointTechnicalReference).toBeNull();
      expect(report.issues.map(({ code }) => code)).toContain(expectedCode);
      expect(() =>
        requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
          report,
        ),
      ).not.toThrow();
    },
  );

  it.each([
    ["throw", "replay.failed"],
    ["agreement", "replay.calculator_disagreement"],
    ["tolerance", "replay.calculator_disagreement"],
  ] as const)(
    "retains a replay %s per composition and withholds only affected-node and global references",
    async (replayFault, expectedCode) => {
      const harness = buildHarness({ replayFault, replayFaultAtCall: 0 });
      const report = await runBoundedFullTeamEquipmentTechnicalComputation(
        buildComputationInput(),
        harness.environment,
      );

      expect(report.validationStatus).toBe("withheld-incomplete-replay");
      expect(report.comparisonStatus).toBe("not-comparable");
      expect(report.execution).toMatchObject({
        observedGeneratorInvocations: 8,
        capturedGeneratorResultCount: 8,
        fullDomainExpectedReplayCount: "32",
        observedReplayCalls: 32,
        successfulReplayCount: 31,
      });
      expect(report.nodes[0].comparisonStatus).toBe("not-comparable");
      expect(report.nodes[0].compositions).toHaveLength(16);
      expect(report.nodes[0].compositions[0]).toMatchObject({
        outcome: "evaluation-failed",
        unreviewedTechnicalObjective: null,
        calculatorAgreement: null,
        failure: { code: expectedCode },
      });
      expect(report.nodes[0].boundedTechnicalReference).toBeNull();
      expect(report.nodes[1].comparisonStatus).toBe("comparable");
      expect(report.nodes[1].boundedTechnicalReference).not.toBeNull();
      expect(report.objectiveDistribution).toMatchObject({
        scope: "partial-diagnostic",
        observationCount: 31,
      });
      expect(report.boundedTechnicalReference).toBeNull();
      expect(report.intactGeneratorEndpointTechnicalReference).toBeNull();
      expect(report.issues.map(({ code }) => code)).toContain(expectedCode);
      expect(() =>
        requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
          report,
        ),
      ).not.toThrow();
    },
  );

  it("audits exact ties and avoids a ratio when the intact reference is zero", async () => {
    const report = await runBoundedFullTeamEquipmentTechnicalComputation(
      buildComputationInput(),
      buildHarness({ evaluationMode: "zero" }).environment,
    );

    expect(report.validationStatus).toBe("completed-technical-objective");
    expect(report.nodes.every(({ boundedReferenceOverIntact }) =>
      boundedReferenceOverIntact.status === "undefined-zero-intact" &&
      boundedReferenceOverIntact.absoluteDelta === 0 &&
      boundedReferenceOverIntact.ratio === null,
    )).toBe(true);
    expect(report.objectiveDistribution).toEqual({
      scope: "complete-domain",
      observationCount: 32,
      uniqueExactValueCount: 1,
      exactTieClassCount: 1,
      observationsInExactTieClasses: 32,
      maximumExactTieClassSize: 32,
      exactTieClassSizeHistogram: { "32": 1 },
      minimum: 0,
      percentile25: 0,
      median: 0,
      mean: 0,
      percentile75: 0,
      maximum: 0,
    });
    expect(report.boundedTechnicalReference?.equivalentReferences).toHaveLength(
      32,
    );
    expect(
      report.intactGeneratorEndpointTechnicalReference?.equivalentReferences,
    ).toHaveLength(8);
  });

  it("rejects a resealed truncated Cartesian replay domain after a typed replay failure", async () => {
    const report = await runBoundedFullTeamEquipmentTechnicalComputation(
      buildComputationInput(),
      buildHarness({ replayFault: "throw", replayFaultAtCall: 0 }).environment,
    );
    const node = report.nodes[0];
    const removed = node.compositions.pop();
    expect(removed?.outcome).toBe("evaluated");
    node.observedCartesianCompositionCount = node.compositions.length;
    node.provenanceSummary = summarizeTestProvenance(node.compositions);
    report.execution.observedReplayCalls -= 1;
    report.execution.successfulReplayCount -= 1;
    const allCompositions = report.nodes.flatMap(
      ({ compositions }) => compositions,
    );
    report.provenanceSummary = summarizeTestProvenance(allCompositions);
    report.objectiveDistribution = buildTestDistribution(
      allCompositions.flatMap(({ unreviewedTechnicalObjective }) =>
        unreviewedTechnicalObjective === null
          ? []
          : [unreviewedTechnicalObjective],
      ),
      "partial-diagnostic",
    );
    resealReport(report);

    expect(report.execution.fullDomainExpectedReplayCount).toBe("32");
    expect(report.execution.observedReplayCalls).toBe(31);
    expect(node.expectedCartesianCompositionCount).toBe("16");
    expect(node.observedCartesianCompositionCount).toBe(15);
    expect(() =>
      requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
        report,
      ),
    ).toThrow(/incomplete, inconsistent, or mutated/);
  });

  it.runIf(process.env.GUIDE_FACTORY_CP38_REAL_RUNTIME === "1")(
    "replays the authenticated 36-node CP37 fixture through the real runtime",
    async () => {
      const reportUrl = new URL(
        "../reports/keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json",
        import.meta.url,
      );
      const reportBytes = fs.readFileSync(reportUrl, "utf8");
      const wrapper = JSON.parse(reportBytes) as {
        runtimePreflight: SourceBackedEquipmentRuntimePreflightReport | null;
      };
      if (!wrapper.runtimePreflight) {
        throw new Error("The authenticated CP37 fixture has no runtime preflight.");
      }
      requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
        wrapper.runtimePreflight,
      );

      const report = await runBoundedFullTeamEquipmentTechnicalComputation({
        preflight: wrapper.runtimePreflight,
        executionPolicy: {
          policyId: "cp38-real-runtime-focused-regression-v1",
          maximumGeneratorInvocations: "144",
          maximumCartesianReplays: "9216",
        },
        generatedFrom: [
          {
            path: "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json",
            sha256: sha256Text(reportBytes),
          },
        ],
      });

      expect(report.validationStatus).toBe("completed-technical-objective");
      expect(report.comparisonStatus).toBe("comparable");
      expect(report.nodes).toHaveLength(36);
      expect(report.execution).toMatchObject({
        observedGeneratorInvocations: 144,
        freshRuntimeIdentityCount: 144,
        capturedGeneratorResultCount: 144,
        fullDomainExpectedReplayCount: "364",
        observedReplayCalls: 364,
        successfulReplayCount: 364,
      });
      expect(report.issues).toEqual([]);
      expect(report.boundedTechnicalReference).not.toBeNull();
      expect(report.intactGeneratorEndpointTechnicalReference).not.toBeNull();
      expect(isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(report)).toBe(
        true,
      );
    },
    30_000,
  );

  it.each([
    [
      "composition provenance",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        const provenance = report.nodes[0].compositions[0].provenance;
        provenance.classification =
          provenance.classification === "intact-generator-endpoint"
            ? "cross-endpoint-recombination"
            : "intact-generator-endpoint";
      },
    ],
    [
      "global reference",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        const reference = report.boundedTechnicalReference;
        if (!reference) throw new Error("Expected a global reference fixture.");
        reference.unreviewedTechnicalObjective -= 1;
      },
    ],
    [
      "objective distribution",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        const distribution = report.objectiveDistribution;
        if (!distribution) throw new Error("Expected a distribution fixture.");
        distribution.mean -= 1;
      },
    ],
    [
      "derived replay count",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        report.execution.knownCompleteNodeExpectedReplayCount = "31";
      },
    ],
    [
      "node sequence",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        report.nodes[0].sequence = 1;
      },
    ],
    [
      "generator progress",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        report.nodes[0].generatorRuns[0].progress[0].progress = 2;
      },
    ],
    [
      "captured sheet fingerprint",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        const run = report.nodes[0].generatorRuns[0];
        if (run.outcome !== "captured") {
          throw new Error("Expected a captured generator run fixture.");
        }
        run.sheetFingerprintsByCharacter.alpha = "0".repeat(64);
      },
    ],
    [
      "captured config provenance",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        const run = report.nodes[0].generatorRuns[0];
        if (run.outcome !== "captured") {
          throw new Error("Expected a captured generator run fixture.");
        }
        run.observedTeamConfigsSha256 = "0".repeat(64);
      },
    ],
    [
      "fixed cautions",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        report.cautions = [];
      },
    ],
    [
      "calculator agreement math",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        const agreement = report.nodes[0].compositions[0].calculatorAgreement;
        if (!agreement) throw new Error("Expected an agreement fixture.");
        agreement.absoluteDifference = 1e-10;
      },
    ],
    [
      "calculator tolerance",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        const agreement = report.nodes[0].compositions[0].calculatorAgreement;
        if (!agreement) throw new Error("Expected an agreement fixture.");
        agreement.compiledObjective = agreement.interpretedObjective + 1;
        agreement.absoluteDifference = 1;
        agreement.allowedDifference = 1;
      },
    ],
    [
      "fresh runtime identity execution invariant",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        (report.execution
          .freshRuntimeIdentityPerGeneratorInvocation as boolean) = false;
      },
    ],
    [
      "generator result emission hard cap",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        (report.execution
          .hardMaximumGeneratorResultEmissionsPerInvocation as string) = "65";
      },
    ],
    [
      "generator result emission trace",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        const run = report.nodes[0].generatorRuns[0];
        if (run.outcome !== "captured") {
          throw new Error("Expected a captured generator run fixture.");
        }
        run.progress = [
          ...Array.from({ length: 64 }, (_, index) => ({
            phase: "synthetic-progress",
            progress: index / 128,
            done: false,
          })),
          { phase: "done", progress: 1, done: true },
        ];
      },
    ],
    [
      "validation status",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        report.validationStatus = "withheld-incomplete-replay";
      },
    ],
    [
      "issue closure",
      (report: BoundedFullTeamEquipmentTechnicalComputationReport) => {
        report.issues.push({
          code: "synthetic.extra_issue",
          stage: "replay",
          path: "synthetic.extra",
          message: "Synthetic extra issue.",
          name: "SyntheticIssue",
        });
      },
    ],
  ])("rejects a resealed mutation of %s through semantic authentication", async (
    _name,
    mutate,
  ) => {
    const report = await runBoundedFullTeamEquipmentTechnicalComputation(
      buildComputationInput(),
      buildHarness().environment,
    );
    mutate(report);
    resealReport(report);

    expect(() =>
      requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
        report,
      ),
    ).toThrow(/incomplete, inconsistent, or mutated/);
    expect(isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(report)).toBe(
      false,
    );
  });
});

function buildComputationInput(
  policyOverride: Partial<
    BoundedFullTeamEquipmentTechnicalComputationInput["executionPolicy"]
  > = {},
  preflight = PREFLIGHT,
): BoundedFullTeamEquipmentTechnicalComputationInput {
  return {
    preflight,
    executionPolicy: {
      policyId: "synthetic-bounded-full-team-v1",
      maximumGeneratorInvocations: "8",
      maximumCartesianReplays: "512",
      ...policyOverride,
    },
    generatedFrom: structuredClone(GENERATED_FROM),
  };
}

function buildHarness(options: HarnessOptions = {}) {
  let bootstrapCalls = 0;
  const generatorCalls: Array<{ nodeId: string; carryCharacterId: string }> = [];
  const replayCalls: Array<{ nodeId: string; compositionId: string }> = [];
  const runtimeIdentities: object[] = [];
  const events: string[] = [];
  const environment: BoundedFullTeamEquipmentTechnicalComputationEnvironment = {
    environmentId: "synthetic-bounded-full-team-runtime-v1",
    async bootstrap() {
      bootstrapCalls += 1;
    },
    createGeneratorInvocation(request) {
      const callIndex = generatorCalls.length;
      generatorCalls.push({
        nodeId: request.nodeId,
        carryCharacterId: request.carryCharacterId,
      });
      events.push(`generator:${request.nodeId}:${request.carryCharacterId}`);
      const fault =
        callIndex === (options.generatorFaultAtCall ?? -1)
          ? options.generatorFault
          : undefined;
      if (fault === "generator-throw") {
        throw new Error(`synthetic generator failure at ${callIndex}`);
      }
      const runtimeIdentity =
        fault === "identity-reuse"
          ? (runtimeIdentities.at(-1) ?? {})
          : {};
      runtimeIdentities.push(runtimeIdentity);
      const observedTeamConfigs = structuredClone(request.teamConfigs);
      if (fault === "config") {
        observedTeamConfigs[0].weaponId = "synthetic-config-drift";
      }
      return {
        runtimeIdentity,
        observedTeamConfigs,
        results: syntheticGeneratorResults(
          request.carryCharacterId,
          fault,
        ),
      };
    },
    async evaluateComposition(request) {
      const callIndex = replayCalls.length;
      replayCalls.push({
        nodeId: request.nodeId,
        compositionId: request.replayId,
      });
      events.push(`replay:${request.nodeId}:${request.replayId}`);
      const fault =
        callIndex === (options.replayFaultAtCall ?? -1)
          ? options.replayFault
          : undefined;
      if (fault === "throw") {
        throw new Error(`synthetic replay failure at ${callIndex}`);
      }
      const totalDamage =
        options.evaluationMode === "zero"
          ? 0
          : Object.values(request.artifactSheets).reduce(
              (sum, sheet) =>
                sum +
                [...sheet.dump()].reduce(
                  (sheetSum, entry) => sheetSum + entry.value,
                  0,
                ),
              0,
            );
      const calculatorDiverges =
        fault === "agreement" || fault === "tolerance";
      return {
        formulaCoverage: request.objectiveLines.map(
          ({ characterId, formulaId }) => ({
            characterId,
            formulaId,
            available: true,
          }),
        ),
        computedBuffOverrides: {},
        calculatorAgreement: {
          passed: fault !== "agreement",
          directTotalDamage: totalDamage,
          compiledTotalDamage: calculatorDiverges
            ? totalDamage + 1
            : totalDamage,
          absoluteDifference: calculatorDiverges ? 1 : 0,
          allowedDifference: fault === "tolerance" ? 1 : 1e-9,
        },
        totalDamage,
      };
    },
  };
  return {
    environment,
    get bootstrapCalls() {
      return bootstrapCalls;
    },
    generatorCalls,
    replayCalls,
    runtimeIdentities,
    events,
  };
}

async function* syntheticGeneratorResults(
  carryCharacterId: string,
  fault: HarnessFault | undefined,
): AsyncGenerator<GeneratorResult> {
  if (fault === "emission-cap") {
    for (let index = 0; index <= 64; index += 1) {
      yield {
        artifactsByChar: {} as GeneratorResult["artifactsByChar"],
        sheetsByChar: {},
        phase: "synthetic-progress",
        progress: index / 128,
        done: false,
      };
    }
    return;
  }
  yield {
    artifactsByChar: {} as GeneratorResult["artifactsByChar"],
    sheetsByChar: {},
    phase: "synthetic-progress",
    progress: 0.5,
    done: false,
  };
  if (fault === "progress") {
    yield {
      artifactsByChar: {} as GeneratorResult["artifactsByChar"],
      sheetsByChar: {},
      phase: "done",
      progress: 0.75,
      done: true,
    };
    return;
  }
  if (fault === "missing-final") return;
  const sheetsByChar = Object.fromEntries(
    CHARACTERS.map((characterId, characterIndex) => [
      characterId,
      new StatSheet([
        {
          key: "atk%",
          value:
            carryCharacterId === characterId ? 100 + characterIndex : 1,
        },
      ]),
    ]),
  );
  const artifactCharacters =
    fault === "final-domain" ? CHARACTERS.slice(1) : CHARACTERS;
  yield {
    artifactsByChar: Object.fromEntries(
      artifactCharacters.map((characterId) => [characterId, {}]),
    ) as GeneratorResult["artifactsByChar"],
    sheetsByChar,
    phase: "done",
    progress: 1,
    done: true,
  };
}

async function buildSyntheticPreflight(): Promise<SourceBackedEquipmentRuntimePreflightReport> {
  const input = buildSyntheticPreflightInput();
  const environment: SourceBackedEquipmentRuntimePreflightEnvironment = {
    environmentId: "synthetic-cp37-materialization-v1",
    async bootstrap() {},
    materialize(request) {
      return {
        teamCharacterOrder: request.teamMembers.map(
          ({ characterId }) => characterId,
        ),
        configs: structuredClone(request.configs),
        availableFormulaIdsByCharacter: Object.fromEntries(
          FORMULA_LINES.map(({ characterId, formulaId }) => [
            characterId,
            [formulaId],
          ]),
        ),
        formulaOwnerById: Object.fromEntries(
          FORMULA_LINES.map(({ characterId, formulaId }) => [
            formulaId,
            characterId,
          ]),
        ),
      };
    },
  };
  return buildSourceBackedEquipmentRuntimePreflight(input, environment);
}

function buildSyntheticPreflightInput(): SourceBackedEquipmentRuntimePreflightInput<SyntheticPayload> {
  const lattice = buildSyntheticLattice();
  if (!isCompleteSourceBackedEquipmentCandidateLattice(lattice)) {
    throw new Error("Synthetic lattice fixture must be complete.");
  }
  const occurrenceResolutions: SourceBackedEquipmentRuntimeOccurrenceResolution[] =
    lattice.lattice.groups.flatMap((group) => {
      const domain = lattice.lattice.domains.find(({ groupIds }) =>
        groupIds.includes(group.groupId),
      );
      if (!domain) throw new Error(`Missing domain for ${group.groupId}.`);
      return group.occurrences.map(({ occurrenceId, payload }) => {
        const base = {
          occurrenceId,
          axisId: domain.axisId,
          groupId: group.groupId,
          teamMemberId: domain.teamMemberId,
          characterId: domain.characterId,
          latticePayloadSha256: sha256Text(stableJson(payload)),
        };
        return domain.equipmentKind === "weapon"
          ? {
              ...base,
              equipmentKind: "weapon" as const,
              weaponId: payload.equipmentId,
              refinement: requiredNumber(payload.refinement),
            }
          : {
              ...base,
              equipmentKind: "artifact" as const,
              artifactSet: {
                type: "4pc" as const,
                setId: payload.equipmentId,
              },
            };
      });
    });
  return {
    lattice,
    occurrenceResolutions,
    objective: buildSyntheticObjective(),
    runtimeAssumptions: {
      assumptionsId: "synthetic-cp38-assumptions-v1",
      expectedNodeCount: "2",
      investments: MEMBERS.map(({ teamMemberId, characterId }) => ({
        teamMemberId,
        characterId,
        charLevel: 90,
        constellation: 0,
        talentLevels: { auto: 10, skill: 10, burst: 10 },
      })),
      combatOptions: {},
      enemyAura: null,
      extraBuffs: [],
      calcContext: {
        enemyLevel: 110,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
      carryCharacterIds: [...CHARACTERS],
      energyRecoveryThresholds: null,
      perCharacterConstraints: null,
    },
  };
}

function buildSyntheticLattice(): SourceBackedEquipmentCandidateLatticeReport<SyntheticPayload> {
  const axes: Array<SourceBackedEquipmentAxis<SyntheticPayload>> = MEMBERS.flatMap(
    ({ teamMemberId, characterId }, memberIndex) =>
      (["weapon", "artifact"] as const).map((equipmentKind) => {
        const axisId = `synthetic:${characterId}:${equipmentKind}`;
        const equipmentCount = memberIndex === 0 && equipmentKind === "weapon" ? 2 : 1;
        return {
          axisId,
          teamMemberId,
          characterId,
          equipmentKind,
          groups: Array.from({ length: equipmentCount }, (_, groupIndex) => {
            const groupId = `${axisId}:group:${groupIndex}`;
            const payload: SyntheticPayload = {
              equipmentId: `${equipmentKind}:${characterId}:${groupIndex}`,
              refinement: equipmentKind === "weapon" ? 1 : null,
              artifactType: equipmentKind === "artifact" ? "4pc" : null,
            };
            const sourceConditions: string[] = [];
            return {
              groupId,
              teamMemberId,
              characterId,
              equipmentKind,
              provenance: {
                sourceId: "synthetic-source",
                sourceRecordId: `synthetic-record:${axisId}`,
                repositoryRecordId: `synthetic-repository:${axisId}`,
                recommendationId: `synthetic-recommendation:${axisId}`,
              },
              recommendationOrdering: null,
              groupIndex,
              grouping: "single" as const,
              classification: null,
              sourceLocalRank: null,
              sourceListIndex: groupIndex,
              sourceConditions,
              sourceConditionsSha256: sha256Text(stableJson(sourceConditions)),
              occurrences: [
                {
                  occurrenceId: `${groupId}:occurrence:0`,
                  claimId: `synthetic-claim:${axisId}:${groupIndex}`,
                  listIndex: 0,
                  alternativeIndex: null,
                  tieIndex: null,
                  energyDerivation: "not-er-derived" as const,
                  payload,
                },
              ],
            };
          }),
        };
      }),
  );
  return buildSourceBackedEquipmentCandidateLattice({
    request: {
      requestId: "synthetic-cp38-lattice-request",
      assumptions: { exactTeam: true },
    },
    evaluation: {
      evaluationId: "synthetic-cp38-lattice-evaluation",
      assumptions: { damageEvaluationExecuted: false },
    },
    teamMembers: MEMBERS,
    axes,
    bounds: {
      expectedCombinationCount: "2",
      maximumCombinationCount: "2",
    },
  });
}

function buildSyntheticObjective(): SourceBackedEquipmentRuntimeObjectiveEnvelope {
  return {
    objectiveId: "synthetic-unreviewed-four-line-objective-v1",
    sourceTeamRecordId: "synthetic:team:alpha-beta-gamma-delta",
    sourceRotationRecordId: "synthetic:rotation:record",
    sourceRotationId: "synthetic-rotation",
    expectedFormulaLineCount: FORMULA_LINES.length,
    formulaLines: structuredClone(FORMULA_LINES),
    formulaLinesSha256: sha256Text(stableJson(FORMULA_LINES)),
    reviewStatus: "unreviewed",
    sourceBindingEstablishedByCaller: true,
    unresolvedMappings: [],
    sourceReadiness: {
      readyForDamageReplay: false,
      blockers: [
        {
          code: "translation-unreviewed",
          message: "The synthetic source translation is intentionally unreviewed.",
        },
      ],
      mappingSummary: {
        comparisons: FORMULA_LINES.length,
        exactClaims: FORMULA_LINES.length,
        rangeClaims: 0,
        completeTokenMappings: FORMULA_LINES.length,
        partialTokenMappings: 0,
        unresolvedMappings: 0,
        nonNullFormulaUnresolvedMappings: 0,
        nullFormulaUnresolvedMappings: 0,
        sourceAbsentMappings: 0,
      },
    },
  };
}

function requiredNumber(value: number | null): number {
  if (value === null) throw new Error("Expected a numeric refinement.");
  return value;
}

function summarizeTestProvenance(
  compositions: BoundedFullTeamEquipmentTechnicalComputationReport["nodes"][number]["compositions"],
): BoundedFullTeamEquipmentTechnicalComputationReport["provenanceSummary"] {
  return {
    intactGeneratorEndpointCompositionCount: compositions.filter(
      ({ provenance }) =>
        provenance.classification === "intact-generator-endpoint",
    ).length,
    crossEndpointRecombinationCount: compositions.filter(
      ({ provenance }) =>
        provenance.classification === "cross-endpoint-recombination",
    ).length,
  };
}

function buildTestDistribution(
  rawValues: number[],
  scope: "complete-domain" | "partial-diagnostic",
): NonNullable<
  BoundedFullTeamEquipmentTechnicalComputationReport["objectiveDistribution"]
> {
  const values = [...rawValues].sort((left, right) => left - right);
  const classes = new Map<number, number>();
  for (const value of values) classes.set(value, (classes.get(value) ?? 0) + 1);
  const histogram = new Map<number, number>();
  for (const count of classes.values()) {
    histogram.set(count, (histogram.get(count) ?? 0) + 1);
  }
  const tied = [...classes.values()].filter((count) => count > 1);
  return {
    scope,
    observationCount: values.length,
    uniqueExactValueCount: classes.size,
    exactTieClassCount: tied.length,
    observationsInExactTieClasses: tied.reduce(
      (sum, count) => sum + count,
      0,
    ),
    maximumExactTieClassSize: Math.max(...classes.values()),
    exactTieClassSizeHistogram: Object.fromEntries(
      [...histogram.entries()]
        .sort(([left], [right]) => left - right)
        .map(([size, count]) => [String(size), count]),
    ),
    minimum: values[0],
    percentile25: normalizeTestNumber(testQuantile(values, 0.25)),
    median: normalizeTestNumber(testQuantile(values, 0.5)),
    mean: normalizeTestNumber(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    ),
    percentile75: normalizeTestNumber(testQuantile(values, 0.75)),
    maximum: values.at(-1) as number,
  };
}

function testQuantile(values: number[], percentile: number): number {
  const position = (values.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper
    ? values[lower]
    : values[lower] +
        (values[upper] - values[lower]) * (position - lower);
}

function normalizeTestNumber(value: number): number {
  return Object.is(value, -0) ? 0 : Number(value.toPrecision(15));
}

function reverseRecord<Value>(
  record: Record<string, Value>,
): Record<string, Value> {
  return Object.fromEntries(Object.entries(record).reverse());
}

function resealReport(
  report: BoundedFullTeamEquipmentTechnicalComputationReport,
): void {
  report.authentication.resultFingerprintSha256 = sha256Text(
    stableJson({
      validationStatus: report.validationStatus,
      comparisonStatus: report.comparisonStatus,
      nodes: report.nodes.map((node) => ({
        nodeId: node.nodeId,
        generatorRuns: node.generatorRuns,
        sheetPoolsByCharacter: node.sheetPoolsByCharacter,
        compositions: node.compositions,
        boundedTechnicalReference: node.boundedTechnicalReference,
        intactGeneratorEndpointTechnicalReference:
          node.intactGeneratorEndpointTechnicalReference,
      })),
      objectiveDistribution: report.objectiveDistribution,
      boundedTechnicalReference: report.boundedTechnicalReference,
      intactGeneratorEndpointTechnicalReference:
        report.intactGeneratorEndpointTechnicalReference,
      issues: report.issues,
    }),
  );
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
