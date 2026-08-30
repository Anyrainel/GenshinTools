import fs from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  formatKeqingIneffaFurinaXilonenGeneratedSheetEvidenceSummary,
  writeKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
} from "../src/compute-keqing-ineffa-furina-xilonen-generated-sheet-evidence";
import { sha256File, sha256Text, stableJson } from "../src/io";
import type { KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport } from "../src/keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "../src/keqingLunarEquipmentEvidenceValidation";
import {
  buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
  type BuildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceInput,
  type KeqingIneffaFurinaXilonenGeneratedSheetEvidenceEnvironment,
  type KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
} from "../src/keqingIneffaFurinaXilonenGeneratedSheetEvidence";
import type { KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport } from "../src/keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import {
  GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY,
  type GeneratedSheetKnowledgeTargetComparison,
} from "../src/keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets";
import { REPOSITORY_ROOT } from "../src/paths";
import type {
  GenshinToolsPresetSnapshot,
  KnowledgeRepository,
} from "../src/schemas";

const SOURCE_TECHNICAL_REPORT =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-technical-computation.json";
const EQUIPMENT_LATTICE_REPORT =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-candidate-lattice.json";
const KNOWLEDGE_REPOSITORY =
  "scripts/guide-factory/data/knowledge/repository.json";
const GENSHINTOOLS_SNAPSHOT =
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json";
const LIVE_BUILD_PRESET =
  "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";
const KQM_EVIDENCE_REPORT =
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json";
const EXPECTED_FULL_SHA256 =
  "d6b8f196891ee122a9ce8267f7da7efae3e7e39076b5babf28c3d352b56e6b4a";

let INPUT: BuildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceInput;
let REPORT: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport;

beforeAll(async () => {
  INPUT = await loadInput();
  REPORT =
    await buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(INPUT);
}, 90_000);

describe("Keqing/Ineffa/Furina/Xilonen generated-sheet evidence", () => {
  it("authenticates the exact real capture and occurrence-scoped comparison oracle", () => {
    expect(REPORT.validationStatus, stableJson(REPORT.issues)).toBe(
      "authenticated-completed-occurrence-evidence-source-not-ready",
    );
    expect(REPORT.issues).toEqual([]);
    expect(REPORT.sourceAuthentication).toMatchObject({
      dependencySetClassification:
        "authenticated-declared-non-self-selected-checkpoint-inputs",
      dependencySetExhaustive: false,
      transitiveModuleGraphClaimed: false,
      transitiveRuntimeDependenciesAuthenticatedBeforeExecution: false,
      selectedInputsAuthenticatedBeforeExecution: true,
      postExecutionGenericOutputAuthenticationRequired: true,
      expectedFileCount: 5,
      observedFileCount: 5,
      exactPathSet: true,
      allByteHashesWellFormed: true,
      allDeclaredFileHashesMatch: true,
      sourceSpecificTechnicalReportAuthenticated: true,
      nestedGenericTechnicalReportAuthenticated: true,
      nestedGenericTechnicalReportComplete: true,
      nestedGenericPreflightAuthenticated: true,
      knowledgeTargetsAuthenticated: true,
      authentication: "accepted",
    });
    expect(REPORT.executionBoundary).toEqual({
      nodeCount: 36,
      carryCount: 4,
      characterCount: 4,
      plannedGeneratorInvocationCount: 144,
      observedGeneratorInvocationCount: 144,
      freshRuntimeIdentityCount: 144,
      generatedOccurrenceCount: 576,
      genericEvidenceReportsGeneratorExecuted: true,
      genericEvidenceReportsGeneratorOptimizationExecuted: true,
      genericEvidenceReportsGeneratorDamageObjectiveEvaluated: true,
      deterministicEvidenceReplayable: true,
      wrapperExecutionAttestationClaimed: false,
      defaultCliConfiguredToExecuteDefaultRuntime: true,
      damageReplayExecuted: false,
      damageReplayCalls: 0,
      downstreamOptimizerExecuted: false,
      downstreamOptimizerCalls: 0,
      comparisonRankingExecuted: false,
      comparisonScalarWeightComputationExecuted: false,
      energyRecoveryInputsConsumedForDeferralProvenance: true,
      energyRecoveryValuesUsedForComparison: false,
      energyRecoveryValuesUsedForOptimization: false,
      energyRecoveryRequirementComputed: false,
    });
    expect(REPORT.generatedSheetEvidence?.execution).toMatchObject({
      environmentId: "existing-generator-sheet-evidence-runtime-v1",
      generatorOptimizationMode:
        "damage-objective-driven-artifact-generator",
      observedGeneratorInvocations: 144,
      freshRuntimeIdentityCount: 144,
      capturedGeneratorResultCount: 144,
      observedCharacterSheetAllocationCount: 576,
    });
    expect(REPORT.generatedSheetEvidence?.authentication).toMatchObject({
      resultFingerprintSha256:
        "6a958c472fe28f1d4b8c6edaf0a52495309377742f46175541acbf6566233386",
      reportContentSha256:
        "dfb21991f2f0d8f83aa9d0896a8752c288bcf5286f2f0e767f742bbca57d5b76",
    });
    expect(REPORT.comparisonBoundary).toMatchObject({
      occurrenceCount: 576,
      comparisonRowCount: 4608,
      stateCounts: {
        "listed-condition-resolved": 816,
        "listed-condition-withheld": 48,
        "listed-baseline-context-unknown": 2202,
        "not-listed-nonexhaustive": 1542,
        "no-applicable-target": 0,
      },
      attachmentCounts: {
        presetOnly: 3456,
        kqmOnly: 576,
        kqmAndPreset: 576,
        none: 0,
      },
      matchingLayerStatusCounts: {
        "kqmAndPreset|listed-condition-resolved": 336,
        "kqmAndPreset|listed-condition-withheld": 24,
        "kqmOnly|listed-condition-resolved": 480,
        "kqmOnly|listed-condition-withheld": 24,
        "none|not-listed-nonexhaustive": 1542,
        "presetOnly|listed-baseline-context-unknown": 2202,
      },
      targetCoverageCount: 17,
      targetMatchEdgeCount: 3858,
      kqmResolvedTargetMatchEdgeCount: 1056,
      kqmWithheldTargetMatchEdgeCount: 240,
      presetTargetMatchEdgeCount: 2562,
      sourcePartialOrderObservationCount: 864,
    });
    expect(Object.values(REPORT.capabilities).every((value) => !value)).toBe(
      true,
    );
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
        REPORT,
      ),
    ).not.toThrow();
    expect(sha256Text(stableJson(REPORT))).toBe(EXPECTED_FULL_SHA256);
  });

  it("reconstructs the exact per-node vector and never attaches targets through a global sheet ID", () => {
    const nodeVectors = [
      ...new Set(REPORT.occurrenceComparisons.map(({ nodeId }) => nodeId)),
    ]
      .sort((left, right) => left.localeCompare(right))
      .map((nodeId) => {
        const rows = REPORT.occurrenceComparisons
          .filter((occurrence) => occurrence.nodeId === nodeId)
          .flatMap(({ observableComparisons }) => observableComparisons);
        return { nodeId, stateCounts: countStates(rows) };
      });
    expect(nodeVectors).toHaveLength(36);
    expect(
      nodeVectors.every(({ stateCounts }) =>
        [
          stateCounts["listed-condition-resolved"],
          stateCounts["listed-condition-withheld"],
          stateCounts["listed-baseline-context-unknown"],
          stateCounts["not-listed-nonexhaustive"],
          stateCounts["no-applicable-target"],
        ].reduce((sum, value) => sum + value, 0) === 128,
      ),
    ).toBe(true);
    expect(sha256Text(stableJson(nodeVectors))).toBe(
      "de3f7f737ba8a9b5618e129fb84a98bf61856de49217235fafdc2a3d9d611b87",
    );
    expect(REPORT.comparisonBoundary.nodeStateVectorSha256).toBe(
      sha256Text(stableJson(nodeVectors)),
    );
    expect(
      stableJson({
        occurrences: REPORT.occurrenceComparisons,
        targetCoverage: REPORT.targetCoverage,
      }),
    ).not.toContain('"sheetId"');
    expect(
      REPORT.occurrenceComparisons.every(
        (occurrence) =>
          occurrence.observableComparisons.length === 8 &&
          occurrence.observableComparisons.filter(
            ({ relationship }) => relationship === "positive-substat",
          ).length === 5,
      ),
    ).toBe(true);
  });

  it("preserves every matching source target before applying status precedence", () => {
    const keqingAtkGoblet = REPORT.occurrenceComparisons
      .filter(({ characterId }) => characterId === "keqing")
      .flatMap(({ observableComparisons }) => observableComparisons)
      .find(
        ({ relationship, observedStatId }) =>
          relationship === "main-stat:goblet" && observedStatId === "atk%",
      );
    expect(keqingAtkGoblet?.comparisonStatus).toBe(
      "listed-condition-resolved",
    );
    expect(keqingAtkGoblet?.matchingTargetApplicabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ applicability: "exact-team-resolved" }),
        expect.objectContaining({ applicability: "condition-withheld" }),
      ]),
    );
    expect(keqingAtkGoblet?.matchingTargetIds).toEqual(
      expect.arrayContaining([
        expect.stringContaining("default-artifact-stats-luna-i:main-stat:goblet:1:"),
        expect.stringContaining("high-buff-goblet-stats-luna-i:main-stat:goblet:0:"),
      ]),
    );

    const keqingPresetCrCirclet = REPORT.occurrenceComparisons
      .filter(
        ({ characterId, artifactOccurrenceId }) =>
          characterId === "keqing" &&
          artifactOccurrenceId.includes("top-contributor-artifact-options"),
      )
      .flatMap(({ observableComparisons }) => observableComparisons)
      .find(
        ({ relationship, observedStatId }) =>
          relationship === "main-stat:circlet" && observedStatId === "cr",
      );
    expect(keqingPresetCrCirclet?.comparisonStatus).toBe(
      "listed-condition-withheld",
    );
    expect(keqingPresetCrCirclet?.matchingTargetApplicabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          applicability: "baseline-team-applicability-unknown",
        }),
        expect.objectContaining({ applicability: "condition-withheld" }),
      ]),
    );
  });

  it("retains zero-match and ER-deferred targets without converting absence into judgment", () => {
    const emCoverage = REPORT.targetCoverage.find(({ targetId }) =>
      targetId.includes("default-artifact-stats-luna-i:substat:2:"),
    );
    expect(emCoverage).toMatchObject({
      applicability: "exact-team-resolved",
      authority: "kqm-agent-assisted-unreviewed",
      applicableOccurrenceCount: 144,
      applicableObservableCount: 720,
      matchingObservableCount: 0,
      matchingOccurrenceCount: 0,
      matchingStatIds: [],
      zeroGeneratedMatches: true,
      sourceExhaustivenessClaimed: false,
      correctnessJudgmentProduced: false,
      rankProduced: false,
    });
    const tenacityTarget = REPORT.knowledgeTargets?.targets.find(
      (target) => target.kind === "preset-build" && target.buildId === "BQA4H1m",
    );
    if (!tenacityTarget || tenacityTarget.kind !== "preset-build") {
      throw new Error("Missing authenticated Furina Tenacity target.");
    }
    const tenacityOccurrence = REPORT.occurrenceComparisons.find(
      ({ characterId, artifactOccurrenceId }) =>
        characterId === "furina" &&
        artifactOccurrenceId === tenacityTarget.activeArtifactOccurrenceId,
    );
    const sandsHp = tenacityOccurrence?.observableComparisons.find(
      ({ relationship, observedStatId }) =>
        relationship === "main-stat:sands" && observedStatId === "hp%",
    );
    expect(sandsHp?.comparisonStatus).toBe("not-listed-nonexhaustive");
    expect(tenacityOccurrence?.deferredEnergyEvidence.sourceEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "sands", statId: "er" }),
      ]),
    );
    expect(
      REPORT.occurrenceComparisons
        .flatMap(({ observableComparisons }) => observableComparisons)
        .some(({ observedStatId }) => observedStatId === "er"),
    ).toBe(false);
    expect(REPORT.knowledgeTargets?.sourceBoundary).toMatchObject({
      exactAuthorityAndAssociationClosure: true,
    });
    expect(
      REPORT.knowledgeTargets?.targets
        .filter((target) => target.kind === "kqm-stat-claim")
        .every(
          (target) =>
            target.sourceReviewState.extractionMethod === "agent-assisted" &&
            target.sourceReviewState.reviewStatus === "unreviewed" &&
            !target.sourceReviewState.promotionEligible,
        ),
    ).toBe(true);
    expect(REPORT.knowledgeTargets?.exclusions.furinaPostErSubstats).not.toBeNull();
  });

  it.each([
    ["valid-looking byte mutation", mutateInputHash],
    ["authenticated CP38 report mutation", mutateSourceReport],
    ["unreviewed KQM authority mutation", mutateKqmReviewState],
  ])("withholds before runtime for %s", async (_label, mutate) => {
    expect(REPORT.validationStatus, stableJson(REPORT.issues)).toBe(
      "authenticated-completed-occurrence-evidence-source-not-ready",
    );
    const input = structuredClone(INPUT);
    mutate(input);
    let runtimeCalls = 0;
    const environment: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceEnvironment = {
      async runGeneratedSheetEvidence() {
        runtimeCalls += 1;
        throw new Error("runtime must remain unreachable");
      },
    };
    const report =
      await buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
        input,
        environment,
      );
    expect(report.validationStatus).toBe("not-authenticated");
    expect(report.occurrenceComparisons).toEqual([]);
    expect(report.targetCoverage).toEqual([]);
    expect(report.generatedSheetEvidence).toBeNull();
    expect(report.executionBoundary).toMatchObject({
      deterministicEvidenceReplayable: false,
      energyRecoveryInputsConsumedForDeferralProvenance: false,
    });
    expect(report.comparisonBoundary.everyNodeComparisonRowCount).toBe(0);
    expect(runtimeCalls).toBe(0);
  });

  it("is invariant to unrelated knowledge-carrier and live-weapon drift", async () => {
    const input = structuredClone(INPUT);
    input.knowledgeTargetInput.repository.schemaVersion = 2 as 1;
    const unrelatedRepositoryRecord =
      input.knowledgeTargetInput.repository.records.find(
        ({ id }) =>
          !id.startsWith("genshintools-presets:character-guide:") &&
          !id.includes("keqing-lunar-charged") &&
          !id.includes("furina-post-er-substats"),
      );
    unrelatedRepositoryRecord?.unknowns.push(
      "Unrelated carrier drift outside the CP39 semantic scope.",
    );
    input.knowledgeTargetInput.genshinToolsSnapshot.capturedAt = "2099-12-31";
    input.knowledgeTargetInput.genshinToolsSnapshot.sourceRevision.files.push({
      path: "unrelated-preset-source.json",
      sha256: "b".repeat(64),
    });
    const live = input.knowledgeTargetInput.liveBuildPreset as {
      characterWeapons?: Record<string, string[]>;
    };
    live.characterWeapons = { unrelated: ["not-selected"] };
    input.knowledgeTargetInput.evidenceReport.generatedFrom.push({
      path: "unrelated-evidence-source.json",
      sha256: "c".repeat(64),
    });
    const unrelatedOccurrence =
      input.knowledgeTargetInput.equipmentLatticeReport.inventoryBoundary.occurrences.find(
        ({ occurrenceId }) =>
          !REPORT.knowledgeTargets?.targets.some(
            (target) =>
              target.kind === "preset-build" &&
              target.activeArtifactOccurrenceId === occurrenceId,
          ),
      );
    if (unrelatedOccurrence) {
      unrelatedOccurrence.equipmentId = "4pc:unselected";
    }

    let runtimeCalls = 0;
    const report =
      await buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
        input,
        {
          async runGeneratedSheetEvidence() {
            runtimeCalls += 1;
            if (!REPORT.generatedSheetEvidence) {
              throw new Error("Missing canonical generic evidence.");
            }
            return structuredClone(REPORT.generatedSheetEvidence);
          },
        },
      );
    expect(runtimeCalls).toBe(1);
    expect(report).toEqual(REPORT);
  });

  it("withholds all target comparisons when the generic capture is mutated", async () => {
    const mutatedGeneric = structuredClone(REPORT.generatedSheetEvidence);
    if (!mutatedGeneric) throw new Error("Missing real generic report.");
    mutatedGeneric.relationshipSummary.sheetCount = 20;
    let runtimeCalls = 0;
    const report =
      await buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(INPUT, {
        async runGeneratedSheetEvidence() {
          runtimeCalls += 1;
          return mutatedGeneric;
        },
      });
    expect(runtimeCalls).toBe(1);
    expect(report.validationStatus).toBe("not-authenticated");
    expect(report.issues.map(({ code }) => code)).toContain(
      "generation.unexpected_generic_evidence",
    );
    expect(report.occurrenceComparisons).toEqual([]);
    expect(report.targetCoverage).toEqual([]);
  });

  it("rejects output mutations and matches the durable report and CLI wording", async () => {
    const mutated = structuredClone(REPORT);
    const row = mutated.occurrenceComparisons[0]?.observableComparisons[0];
    if (!row) throw new Error("Missing canonical row.");
    row.correctnessJudgmentProduced = true as false;
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
        mutated,
      ),
    ).toThrow(/Refusing unauthenticated or mutated/);

    const durable = JSON.parse(
      fs.readFileSync(
        KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_PATH,
        "utf8",
      ),
    ) as KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport;
    expect(sha256Text(stableJson(durable))).toBe(EXPECTED_FULL_SHA256);
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
        durable,
      ),
    ).not.toThrow();
    expect(
      formatKeqingIneffaFurinaXilonenGeneratedSheetEvidenceSummary(durable),
    ).toContain(
      "replayable evidence for 144 generator runs using the existing damage-objective artifact optimization (not an execution attestation)",
    );
    expect(
      formatKeqingIneffaFurinaXilonenGeneratedSheetEvidenceSummary(durable),
    ).toContain("0 damage replays, downstream optimizer calls");
    expect(
      formatKeqingIneffaFurinaXilonenGeneratedSheetEvidenceSummary(durable),
    ).toContain("ER values are retained only as deferred provenance");
  });

  it("never overwrites a durable checkpoint with rejected evidence", async () => {
    const temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "guide-factory-generated-sheet-evidence-"),
    );
    const outputPath = path.join(temporaryDirectory, "durable-report.json");
    const sentinel = "trusted checkpoint\n";
    try {
      await writeFile(outputPath, sentinel, "utf8");
      const rejected = structuredClone(REPORT);
      rejected.capabilities.rankClaims = true as false;
      await expect(
        writeKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
          rejected,
          outputPath,
        ),
      ).rejects.toThrow(/Refusing unauthenticated or mutated/);
      expect(await readFile(outputPath, "utf8")).toBe(sentinel);

      await writeKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
        REPORT,
        outputPath,
      );
      expect(
        sha256Text(stableJson(JSON.parse(await readFile(outputPath, "utf8")))),
      ).toBe(EXPECTED_FULL_SHA256);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});

async function loadInput(): Promise<BuildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceInput> {
  const read = (relativePath: string) =>
    JSON.parse(
      fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
    );
  return {
    sourceTechnicalReport:
      read(
        SOURCE_TECHNICAL_REPORT,
      ) as KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
    knowledgeTargetInput: {
      equipmentLatticeReport:
        read(
          EQUIPMENT_LATTICE_REPORT,
        ) as KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
      repository: read(KNOWLEDGE_REPOSITORY) as KnowledgeRepository,
      genshinToolsSnapshot:
        read(GENSHINTOOLS_SNAPSHOT) as GenshinToolsPresetSnapshot,
      liveBuildPreset: read(LIVE_BUILD_PRESET),
      evidenceReport:
        read(KQM_EVIDENCE_REPORT) as KeqingLunarEquipmentEvidenceValidationReport,
    },
    inputFiles: await Promise.all(
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  };
}

function countStates(
  rows: Array<{ comparisonStatus: GeneratedSheetKnowledgeTargetComparison }>,
): Record<GeneratedSheetKnowledgeTargetComparison, number> {
  return Object.fromEntries(
    GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY.map((status) => [
      status,
      rows.filter(({ comparisonStatus }) => comparisonStatus === status).length,
    ]),
  ) as Record<GeneratedSheetKnowledgeTargetComparison, number>;
}

function mutateInputHash(
  input: BuildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceInput,
): void {
  const row = input.inputFiles.find(({ path: inputPath }) =>
    inputPath.endsWith("boundedFullTeamGeneratedSheetEvidence.ts"),
  );
  if (!row) throw new Error("Missing generic core hash row.");
  row.sha256 = "a".repeat(64);
}

function mutateSourceReport(
  input: BuildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceInput,
): void {
  input.sourceTechnicalReport.capabilities.rankClaims = true as false;
}

function mutateKqmReviewState(
  input: BuildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceInput,
): void {
  const record = input.knowledgeTargetInput.evidenceReport.sourceBoundary.records.find(
    ({ repositoryRecordId }) =>
      repositoryRecordId ===
      "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
  );
  if (!record) throw new Error("Missing KQM review-state record.");
  record.reviewStatus = "reviewed" as "unreviewed";
}
