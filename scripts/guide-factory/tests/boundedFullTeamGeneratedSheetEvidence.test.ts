import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { MainStat, Slot, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { GeneratorResult } from "@/lib/team-comp/generator/generator";
import {
  isCompleteBoundedFullTeamEquipmentTechnicalComputationReport,
  runBoundedFullTeamEquipmentTechnicalComputation,
  type BoundedFullTeamEquipmentTechnicalComputationEnvironment,
  type BoundedFullTeamEquipmentTechnicalComputationReport,
} from "../src/boundedFullTeamEquipmentTechnicalComputation";
import {
  isCompleteBoundedFullTeamGeneratedSheetEvidenceReport,
  requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport,
  runBoundedFullTeamGeneratedSheetEvidence,
  type BoundedFullTeamGeneratedSheetEvidenceEnvironment,
  type BoundedFullTeamGeneratedSheetEvidenceInput,
  type BoundedFullTeamGeneratedSheetEvidenceReport,
} from "../src/boundedFullTeamGeneratedSheetEvidence";
import { sha256Text, stableJson } from "../src/io";
import {
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
} from "../src/keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import {
  buildSourceBackedEquipmentCandidateLattice,
  isCompleteSourceBackedEquipmentCandidateLattice,
  type SourceBackedEquipmentAxis,
  type SourceBackedEquipmentCandidateLatticeReport,
  type SourceBackedEquipmentJsonValue,
} from "../src/sourceBackedEquipmentCandidateLattice";
import {
  requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport,
  buildSourceBackedEquipmentRuntimePreflight,
  isCompleteSourceBackedEquipmentRuntimePreflightReport,
  type SourceBackedEquipmentRuntimeObjectiveEnvelope,
  type SourceBackedEquipmentRuntimeOccurrenceResolution,
  type SourceBackedEquipmentRuntimePreflightEnvironment,
  type SourceBackedEquipmentRuntimePreflightInput,
  type SourceBackedEquipmentRuntimePreflightReport,
} from "../src/sourceBackedEquipmentRuntimePreflight";
import {
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
} from "../src/keqingIneffaFurinaXilonenEquipmentRuntimePreflight";

type SyntheticPayload = {
  [key: string]: SourceBackedEquipmentJsonValue;
  equipmentId: string;
  refinement: number | null;
  artifactType: "4pc" | null;
};

type GeneratorFault =
  | "config"
  | "progress"
  | "after-final"
  | "missing-final"
  | "emission-cap"
  | "identity-reuse"
  | "domain"
  | "sheet"
  | "illegal-artifacts"
  | "rounding-envelope";

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
  { path: "synthetic/cp38.json", sha256: "a".repeat(64) },
  { path: "synthetic/preflight.json", sha256: "b".repeat(64) },
];

let PREFLIGHT: SourceBackedEquipmentRuntimePreflightReport;
let TECHNICAL: BoundedFullTeamEquipmentTechnicalComputationReport;

beforeAll(async () => {
  PREFLIGHT = await buildSyntheticPreflight();
  expect(isCompleteSourceBackedEquipmentRuntimePreflightReport(PREFLIGHT)).toBe(
    true,
  );
  TECHNICAL = await buildSyntheticTechnicalReport(PREFLIGHT);
  expect(
    isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(TECHNICAL),
    stableJson({
      status: TECHNICAL.validationStatus,
      comparison: TECHNICAL.comparisonStatus,
      issues: TECHNICAL.issues,
      execution: TECHNICAL.execution,
    }),
  ).toBe(true);
});

describe("bounded full-team generated-sheet/allocation evidence", () => {
  it("captures exact CP38 sheets, stable allocations, and one-to-many relationships with zero downstream work", async () => {
    const input = buildInput();
    const before = structuredClone(input);
    const harness = buildHarness();
    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      input,
      harness.environment,
    );

    expect(input).toEqual(before);
    expect(report.validationStatus).toBe(
      "completed-generated-sheet-evidence",
    );
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.execution).toMatchObject({
      generatorOptimizationMode: "injected-generator-not-characterized",
      scheduling: "sequential",
      hardMaximumGeneratorResultEmissionsPerInvocation: "64",
      bootstrapCalls: 1,
      observedGeneratorInvocations: 4,
      freshRuntimeIdentityCount: 4,
      capturedGeneratorResultCount: 4,
      observedCharacterSheetAllocationCount: 16,
    });
    expect(harness.generatorCalls).toEqual(
      CHARACTERS.map((carryCharacterId) => ({
        nodeId: TECHNICAL.nodes[0].nodeId,
        carryCharacterId,
      })),
    );
    expect(harness.bootstrapCalls).toBe(1);
    expect(report).toMatchObject({
      generatorOptimizationExecuted: null,
      generatorDamageObjectiveEvaluated: null,
      damageReplayExecuted: false,
      damageReplayCalls: 0,
      rankingProduced: false,
      recommendationProduced: false,
      downstreamOptimizerExecuted: false,
      downstreamOptimizerCalls: 0,
      energyRecoveryInterpreted: false,
      energyRecoveryCalls: 0,
    });
    expect(Object.values(report.capabilities).every((value) => !value)).toBe(
      true,
    );
    expect(report.nodes[0].originParity.every(({ matched }) => matched)).toBe(
      true,
    );
    expect(report.relationshipSummary).toEqual({
      sheetCount: 1,
      allocationCount: 4,
      occurrenceCount: 16,
      sheetIdsWithMultipleAllocations: 1,
      maximumAllocationsPerSheet: 4,
    });
    const alphaSheet = report.sheetCatalog.find(
      ({ occurrences }) =>
        occurrences.some(({ characterId }) => characterId === "alpha"),
    );
    expect(alphaSheet?.allocationIds).toHaveLength(4);
    expect(
      report.artifactAllocationCatalog.every((allocation) =>
        allocation.artifacts.every(
          (artifact) =>
            !("id" in artifact) &&
            !("setKey" in artifact) &&
            !("lock" in artifact) &&
            artifact.derivedLineEvidence.totalRollCount === null,
        ),
      ),
    ).toBe(true);
    expect(
      report.nodes[0].generatorRuns.every(
        (run) =>
          run.outcome === "captured" &&
          Object.values(run.sheetsByCharacter).every(
            (observation) =>
              observation.displayRoundingEnvelopeSatisfied &&
              observation.exactStatDeltas.every(
                ({ withinEnvelope }) => withinEnvelope,
              ),
          ),
      ),
    ).toBe(true);
    expect(isCompleteBoundedFullTeamGeneratedSheetEvidenceReport(report)).toBe(
      true,
    );
    expect(() =>
      requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report),
    ).not.toThrow();
  });

  it("authenticates CP38 and the preflight before bootstrap or generator execution", async () => {
    const input = buildInput();
    input.technicalReport.capabilities.rankClaims = true as false;
    const harness = buildHarness();
    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      input,
      harness.environment,
    );

    expect(report.validationStatus).toBe("withheld-invalid-input");
    expect(report.generatorExecuted).toBe(false);
    expect(harness.bootstrapCalls).toBe(0);
    expect(harness.generatorCalls).toHaveLength(0);
    expect(report.issues.map(({ code }) => code)).toContain(
      "input.technical_report_unauthenticated",
    );
  });

  it("returns an authenticated withheld report for malformed generated-from rows", async () => {
    const input = buildInput();
    input.generatedFrom = [
      { path: "synthetic/z.json", sha256: "not-a-sha256" },
      { path: "synthetic/a.json", sha256: "a".repeat(64) },
    ];
    const harness = buildHarness();

    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      input,
      harness.environment,
    );

    expect(report.validationStatus).toBe("withheld-invalid-input");
    expect(report.issues.map(({ code }) => code)).toContain(
      "input.invalid_generated_from",
    );
    expect(harness.bootstrapCalls).toBe(0);
    expect(harness.generatorCalls).toEqual([]);
    expect(() =>
      requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report),
    ).not.toThrow();
  });

  it("does not let an injected environment spoof the default generator mode", async () => {
    const harness = buildHarness();
    Object.assign(harness.environment, {
      generatorOptimizationMode: "damage-objective-driven-artifact-generator",
    });

    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      buildInput(),
      harness.environment,
    );

    expect(report.validationStatus).toBe("completed-generated-sheet-evidence");
    expect(report.execution.generatorOptimizationMode).toBe(
      "injected-generator-not-characterized",
    );
    expect(report.generatorOptimizationExecuted).toBeNull();
    expect(report.generatorDamageObjectiveEvaluated).toBeNull();
    expect(harness.bootstrapCalls).toBe(1);
    expect(harness.generatorCalls).toHaveLength(4);
  });

  it("authenticates a withheld report for a blank environment ID", async () => {
    const harness = buildHarness();
    harness.environment.environmentId = " ";

    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      buildInput(),
      harness.environment,
    );

    expect(report.validationStatus).toBe("withheld-invalid-input");
    expect(report.issues.map(({ code }) => code)).toContain(
      "input.invalid_environment_id",
    );
    expect(report.generatorOptimizationExecuted).toBeNull();
    expect(report.generatorDamageObjectiveEvaluated).toBeNull();
    expect(harness.bootstrapCalls).toBe(0);
    expect(harness.generatorCalls).toEqual([]);
    expect(() =>
      requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report),
    ).not.toThrow();
  });

  it.each([
    ["config", "generator.config_mismatch"],
    ["progress", "reconciliation.cp38_progress_mismatch"],
    ["after-final", "generator.result_after_final"],
    ["missing-final", "generator.missing_final_result"],
    ["emission-cap", "generator.result_emission_cap_exceeded"],
    ["identity-reuse", "generator.runtime_identity_reused"],
    ["domain", "capture.character_domain_mismatch"],
    ["sheet", "reconciliation.cp38_sheet_mismatch"],
    ["illegal-artifacts", "capture.illegal_artifact_allocation_shape"],
    ["rounding-envelope", "capture.display_rounding_envelope_exceeded"],
  ] as const)("fails closed for %s generator evidence", async (fault, code) => {
    const harness = buildHarness({ fault, faultAtCall: 1 });
    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      buildInput(),
      harness.environment,
    );

    expect(report.validationStatus).toBe("withheld-incomplete-generation");
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(harness.generatorCalls).toHaveLength(4);
    expect(report.issues.map((issue) => issue.code)).toContain(code);
    expect(isCompleteBoundedFullTeamGeneratedSheetEvidenceReport(report)).toBe(
      false,
    );
    expect(() =>
      requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report),
    ).not.toThrow();
  });

  it("rejects carry binding drift before execution", async () => {
    const input = buildInput();
    input.technicalReport.inputBoundary.carryCharacterIds[0] = "drift";
    const harness = buildHarness();
    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      input,
      harness.environment,
    );
    expect(report.validationStatus).toBe("withheld-invalid-input");
    expect(harness.generatorCalls).toHaveLength(0);
  });

  it("rejects node binding drift before execution", async () => {
    const input = buildInput();
    input.technicalReport.nodes[0].nodeId = "drift";
    const harness = buildHarness();
    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      input,
      harness.environment,
    );
    expect(report.validationStatus).toBe("withheld-invalid-input");
    expect(harness.bootstrapCalls).toBe(0);
    expect(harness.generatorCalls).toHaveLength(0);
  });

  it("rejects resealed origin/multiplicity drift", async () => {
    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      buildInput(),
      buildHarness().environment,
    );
    report.nodes[0].originParity[0].expectedOriginMultiplicity += 1;
    resealGeneratedSheetReport(report);
    expect(() =>
      requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report),
    ).toThrow(/incomplete, inconsistent, or mutated/);
  });

  it("rejects capability mutation even when the outer digest is resealed", async () => {
    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      buildInput(),
      buildHarness().environment,
    );
    report.capabilities.guideClaims = true as false;
    resealGeneratedSheetReport(report);
    expect(() =>
      requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report),
    ).toThrow(/incomplete, inconsistent, or mutated/);
  });

  it("rejects resealed generator and downstream optimizer execution drift", async () => {
    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      buildInput(),
      buildHarness().environment,
    );
    report.generatorOptimizationExecuted = true;
    report.downstreamOptimizerExecuted = true as false;
    resealGeneratedSheetReport(report);
    expect(() =>
      requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report),
    ).toThrow(/incomplete, inconsistent, or mutated/);
  });

  it("rejects content mutation with a stale self-digest", async () => {
    const report = await runBoundedFullTeamGeneratedSheetEvidence(
      buildInput(),
      buildHarness().environment,
    );
    report.sheetCatalog[0].entries[0].value += 1;
    expect(() =>
      requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report),
    ).toThrow(/incomplete, inconsistent, or mutated/);
  });

  it.runIf(process.env.GUIDE_FACTORY_CP39_REAL_SHEET_EVIDENCE === "1")(
    "accepts the real default generator's displayed artifact shape across all 36 CP38 nodes",
    async () => {
      const sourceReport = JSON.parse(
        fs.readFileSync(
          new URL(
            "../reports/keqing-ineffa-furina-xilonen-equipment-technical-computation.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ) as KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport;
      const technicalReport = sourceReport.technicalComputation;
      const sourcePreflight = sourceReport.sourcePreflight;
      const preflight = sourcePreflight?.runtimePreflight;
      if (!technicalReport || !sourcePreflight || !preflight) {
        throw new Error("The real CP38 fixture must expose both nested generic reports.");
      }
      requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
        sourcePreflight,
      );
      requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(preflight);
      expect(
        isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(
          technicalReport,
        ),
      ).toBe(true);
      requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
        sourceReport,
      );
      expect(
        isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(
          technicalReport,
        ),
      ).toBe(true);

      const report = await runBoundedFullTeamGeneratedSheetEvidence({
        technicalReport,
        preflight,
        generatedFrom: [
          { path: "synthetic/real-cp38-wrapper.json", sha256: "c".repeat(64) },
        ],
      });

      expect(report.validationStatus, stableJson(report.issues)).toBe(
        "completed-generated-sheet-evidence",
      );
      expect(report.nodes).toHaveLength(36);
      expect(report.execution).toMatchObject({
        generatorOptimizationMode:
          "damage-objective-driven-artifact-generator",
        observedGeneratorInvocations: 144,
        freshRuntimeIdentityCount: 144,
        capturedGeneratorResultCount: 144,
        observedCharacterSheetAllocationCount: 576,
        damageReplayPermitted: false,
        downstreamOptimizerPermitted: false,
        energyRecoveryInterpretationPermitted: false,
      });
      expect(report).toMatchObject({
        generatorOptimizationExecuted: true,
        generatorDamageObjectiveEvaluated: true,
        downstreamOptimizerExecuted: false,
        downstreamOptimizerCalls: 0,
      });
      expect(report.issues).toEqual([]);
      expect(report.relationshipSummary).toEqual({
        sheetCount: 21,
        allocationCount: 23,
        occurrenceCount: 576,
        sheetIdsWithMultipleAllocations: 2,
        maximumAllocationsPerSheet: 2,
      });
      expect(report.authentication).toMatchObject({
        resultFingerprintSha256:
          "6a958c472fe28f1d4b8c6edaf0a52495309377742f46175541acbf6566233386",
        reportContentSha256:
          "0510351135877d48ba5af2a57656ea007c1594f326b0d5ac38343583e18f6348",
      });
      expect(
        report.nodes.every((node) =>
          node.originParity.every(({ matched }) => matched),
        ),
      ).toBe(true);
      expect(
        report.artifactAllocationCatalog.every((entry) =>
          entry.artifacts.every(
            ({ derivedLineEvidence }) =>
              derivedLineEvidence.totalRollCount === null,
          ),
        ),
      ).toBe(true);
      expect(isCompleteBoundedFullTeamGeneratedSheetEvidenceReport(report)).toBe(
        true,
      );
    },
    30_000,
  );
});

function buildInput(): BoundedFullTeamGeneratedSheetEvidenceInput {
  return {
    technicalReport: structuredClone(TECHNICAL),
    preflight: structuredClone(PREFLIGHT),
    generatedFrom: structuredClone(GENERATED_FROM),
  };
}

function buildHarness(options: {
  fault?: GeneratorFault;
  faultAtCall?: number;
} = {}) {
  let bootstrapCalls = 0;
  const generatorCalls: Array<{ nodeId: string; carryCharacterId: string }> = [];
  const runtimeIdentities: object[] = [];
  const environment: BoundedFullTeamGeneratedSheetEvidenceEnvironment = {
    environmentId: "synthetic-generated-sheet-evidence-v1",
    async bootstrap() {
      bootstrapCalls += 1;
    },
    createGeneratorInvocation(request) {
      const callIndex = generatorCalls.length;
      generatorCalls.push({
        nodeId: request.nodeId,
        carryCharacterId: request.carryCharacterId,
      });
      const observedTeamConfigs = structuredClone(request.teamConfigs);
      const fault =
        callIndex === (options.faultAtCall ?? -1) ? options.fault : undefined;
      if (fault === "config") {
        observedTeamConfigs[0].weaponId = "drift";
      }
      const runtimeIdentity =
        fault === "identity-reuse"
          ? (runtimeIdentities.at(-1) ?? {})
          : {};
      runtimeIdentities.push(runtimeIdentity);
      return {
        runtimeIdentity,
        observedTeamConfigs,
        results: syntheticResults(request.carryCharacterId, fault),
      };
    },
  };
  return {
    environment,
    generatorCalls,
    get bootstrapCalls() {
      return bootstrapCalls;
    },
  };
}

async function* syntheticResults(
  carryCharacterId: string,
  fault?: GeneratorFault,
): AsyncGenerator<GeneratorResult> {
  if (fault === "emission-cap") {
    for (let index = 0; index <= 64; index += 1) {
      yield {
        artifactsByChar: {} as GeneratorResult["artifactsByChar"],
        sheetsByChar: {},
        phase: "progress",
        progress: index / 128,
        done: false,
      };
    }
    return;
  }
  yield {
    artifactsByChar: {} as GeneratorResult["artifactsByChar"],
    sheetsByChar: {},
    phase: "progress",
    progress: fault === "progress" ? 0.4 : 0.5,
    done: false,
  };
  if (fault === "missing-final") return;
  const artifactsByChar = Object.fromEntries(
    CHARACTERS.map((characterId) => [
      characterId,
      buildArtifacts(characterId, carryCharacterId),
    ]),
  ) as GeneratorResult["artifactsByChar"];
  if (fault === "illegal-artifacts") {
    delete (artifactsByChar.alpha as Partial<Record<Slot, ArtifactData>>)
      .circlet;
  }
  if (fault === "rounding-envelope") {
    artifactsByChar.alpha.flower.substats["atk%"] = 1;
  }
  const sheetsByChar = Object.fromEntries(
    CHARACTERS.map((characterId) => [
      characterId,
      StatSheet.fromArtifacts(
        Object.values(buildArtifacts(characterId, carryCharacterId)),
      ),
    ]),
  );
  if (fault === "sheet") {
    sheetsByChar.alpha = new StatSheet([{ key: "atk%", value: 999 }]);
  }
  const domainArtifacts =
    fault === "domain"
      ? Object.fromEntries(Object.entries(artifactsByChar).slice(1))
      : artifactsByChar;
  yield {
    artifactsByChar: domainArtifacts as GeneratorResult["artifactsByChar"],
    sheetsByChar,
    phase: "done",
    progress: 1,
    done: true,
  };
  if (fault === "after-final") {
    yield {
      artifactsByChar,
      sheetsByChar,
      phase: "late",
      progress: 1,
      done: false,
    };
  }
}

function buildArtifacts(
  characterId: string,
  carryCharacterId: string,
): Record<Slot, ArtifactData> {
  const carryIndex = CHARACTERS.indexOf(
    carryCharacterId as (typeof CHARACTERS)[number],
  );
  const alphaShift = characterId === "alpha" ? carryIndex : 0;
  const mainStats: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "electro%",
    circlet: "cr",
  };
  const substats: Record<Slot, Partial<Record<SubStat, number>>> = {
    flower: { "atk%": 4 + alphaShift },
    plume: { "atk%": 6 - alphaShift },
    sands: { cd: 7.8 },
    goblet: { cr: 3.9 },
    circlet: { er: 5.5 },
  };
  return Object.fromEntries(
    allSlots.map((slot) => [
      slot,
      {
        id: `random-${characterId}-${carryCharacterId}-${slot}`,
        setKey: `random-flex-display-${carryCharacterId}-${slot}`,
        slotKey: slot,
        level: 20,
        rarity: 5,
        mainStatKey: mainStats[slot],
        lock: false,
        substats: substats[slot],
      },
    ]),
  ) as Record<Slot, ArtifactData>;
}

async function buildSyntheticTechnicalReport(
  preflight: SourceBackedEquipmentRuntimePreflightReport,
): Promise<BoundedFullTeamEquipmentTechnicalComputationReport> {
  const environment: BoundedFullTeamEquipmentTechnicalComputationEnvironment = {
    environmentId: "synthetic-cp38-for-sheet-evidence-v1",
    async bootstrap() {},
    createGeneratorInvocation(request) {
      return {
        runtimeIdentity: {},
        observedTeamConfigs: structuredClone(request.teamConfigs),
        results: syntheticResults(request.carryCharacterId),
      };
    },
    async evaluateComposition(request) {
      const totalDamage = Object.values(request.artifactSheets).reduce(
        (sum, sheet) =>
          sum + [...sheet.dump()].reduce((nested, row) => nested + row.value, 0),
        0,
      );
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
          passed: true,
          directTotalDamage: totalDamage,
          compiledTotalDamage: totalDamage,
          absoluteDifference: 0,
          allowedDifference: Number(
            Math.max(
              1e-9,
              1e-12 * Math.max(1, Math.abs(totalDamage)),
            ).toPrecision(15),
          ),
        },
        totalDamage,
      };
    },
  };
  return runBoundedFullTeamEquipmentTechnicalComputation(
    {
      preflight,
      executionPolicy: {
        policyId: "synthetic-cp38-sheet-evidence-policy-v1",
        maximumGeneratorInvocations: "4",
        maximumCartesianReplays: "256",
      },
      generatedFrom: [
        { path: "synthetic/preflight.json", sha256: "b".repeat(64) },
      ],
    },
    environment,
  );
}

async function buildSyntheticPreflight(): Promise<SourceBackedEquipmentRuntimePreflightReport> {
  const input = buildSyntheticPreflightInput();
  const environment: SourceBackedEquipmentRuntimePreflightEnvironment = {
    environmentId: "synthetic-cp37-sheet-evidence-v1",
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
    throw new Error("Synthetic lattice must be complete.");
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
              refinement: payload.refinement as number,
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
      assumptionsId: "synthetic-cp39-assumptions-v1",
      expectedNodeCount: "1",
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
    ({ teamMemberId, characterId }) =>
      (["weapon", "artifact"] as const).map((equipmentKind) => {
        const axisId = `synthetic:${characterId}:${equipmentKind}`;
        const groupId = `${axisId}:group`;
        const payload: SyntheticPayload = {
          equipmentId: `${equipmentKind}:${characterId}`,
          refinement: equipmentKind === "weapon" ? 1 : null,
          artifactType: equipmentKind === "artifact" ? "4pc" : null,
        };
        const sourceConditions: string[] = [];
        return {
          axisId,
          teamMemberId,
          characterId,
          equipmentKind,
          groups: [
            {
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
              groupIndex: 0,
              grouping: "single" as const,
              classification: null,
              sourceLocalRank: null,
              sourceListIndex: 0,
              sourceConditions,
              sourceConditionsSha256: sha256Text(stableJson(sourceConditions)),
              occurrences: [
                {
                  occurrenceId: `${groupId}:occurrence`,
                  claimId: `claim:${axisId}`,
                  listIndex: 0,
                  alternativeIndex: null,
                  tieIndex: null,
                  energyDerivation: "not-er-derived" as const,
                  payload,
                },
              ],
            },
          ],
        };
      }),
  );
  return buildSourceBackedEquipmentCandidateLattice({
    request: {
      requestId: "synthetic-cp39-lattice-request",
      assumptions: { exactTeam: true },
    },
    evaluation: {
      evaluationId: "synthetic-cp39-lattice-evaluation",
      assumptions: { damageEvaluationExecuted: false },
    },
    teamMembers: MEMBERS,
    axes,
    bounds: {
      expectedCombinationCount: "1",
      maximumCombinationCount: "1",
    },
  });
}

function buildSyntheticObjective(): SourceBackedEquipmentRuntimeObjectiveEnvelope {
  return {
    objectiveId: "synthetic-cp39-objective-v1",
    sourceTeamRecordId: "synthetic:team",
    sourceRotationRecordId: "synthetic:rotation-record",
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
          message: "Synthetic objective intentionally remains unreviewed.",
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

function resealGeneratedSheetReport(
  report: BoundedFullTeamGeneratedSheetEvidenceReport,
): void {
  report.authentication.resultFingerprintSha256 = sha256Text(
    stableJson({
      validationStatus: report.validationStatus,
      comparisonStatus: report.comparisonStatus,
      nodes: report.nodes,
      sheetCatalog: report.sheetCatalog,
      artifactAllocationCatalog: report.artifactAllocationCatalog,
      relationshipSummary: report.relationshipSummary,
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
