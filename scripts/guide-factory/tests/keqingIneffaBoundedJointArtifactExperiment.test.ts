import { describe, expect, it } from "vitest";
import { formatKeqingIneffaBoundedJointArtifactExperimentSummary } from "../src/experiment-keqing-ineffa-bounded-joint-artifacts";
import { readJson } from "../src/io";
import {
  buildKeqingIneffaCachedPolicyReplay,
  buildKeqingIneffaBoundedJointArtifactExperimentInput,
  KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS,
  KEQING_INEFFA_BOUNDED_JOINT_CANDIDATE_IDS,
  KEQING_INEFFA_BOUNDED_JOINT_CARRY_CHARACTER_IDS,
  type KeqingIneffaBoundedJointArtifactExperimentReport,
} from "../src/keqingIneffaBoundedJointArtifactExperiment";
import {
  KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
} from "../src/paths";
import { KnowledgeRepositorySchema } from "../src/schemas";

describe("Keqing-Ineffa bounded joint artifact experiment wiring", () => {
  it("selects the four valid nodes, four team carries, and exact unreviewed source-count lines", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const generatedFrom = [{ path: "example-input", sha256: "abc123" }];
    const input = await buildKeqingIneffaBoundedJointArtifactExperimentInput(
      repository,
      generatedFrom,
    );

    expect(input.candidateIds).toEqual(
      KEQING_INEFFA_BOUNDED_JOINT_CANDIDATE_IDS,
    );
    expect(input.carryCharacterIds).toEqual(
      KEQING_INEFFA_BOUNDED_JOINT_CARRY_CHARACTER_IDS,
    );
    expect(input.generatedFrom).toEqual(generatedFrom);
    expect(input.generatedFrom).not.toBe(generatedFrom);
    expect(input.unreviewedTechnicalFormulaLines).toEqual([
      { characterId: "furina", formulaId: "furina-burst", count: 1 },
      {
        characterId: "furina",
        formulaId: "furina-skill-bubble",
        count: 1,
      },
      { characterId: "ineffa", formulaId: "ineffa-burst", count: 1 },
      {
        characterId: "ineffa",
        formulaId: "ineffa-skill-initial",
        count: 1,
      },
      { characterId: "keqing", formulaId: "keqing-burst", count: 1 },
      { characterId: "keqing", formulaId: "keqing-charged", count: 8 },
      {
        characterId: "keqing",
        formulaId: "keqing-skill-slash",
        count: 2,
      },
      { characterId: "keqing", formulaId: "keqing-stiletto", count: 2 },
      { characterId: "xilonen", formulaId: "xilonen-e-rush", count: 2 },
      { characterId: "xilonen", formulaId: "xilonen-normal-2", count: 2 },
      {
        characterId: "xilonen",
        formulaId: "xilonen-q-initial",
        count: 1,
      },
    ]);
    expect(input.baseProbeInput.formulaDraft.supportsGuideClaims).toBe(false);
    expect(
      input.candidateIds.every((candidateId) =>
        input.baseProbeInput.candidates.some(
          (candidate) =>
            candidate.candidateId === candidateId &&
            candidate.classification !== "repository-build-negative-control",
        ),
      ),
    ).toBe(true);
    expect(
      new Set(KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS)
        .size,
    ).toBe(
      KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS.length,
    );
  });

  it("keeps the durable output explicitly bounded and formats a failure-aware CLI summary", async () => {
    const report = (await readJson(
      KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_REPORT_PATH,
    )) as KeqingIneffaBoundedJointArtifactExperimentReport;

    expect(report).toMatchObject({
      classification: "bounded-joint-artifact-stat-technical-experiment",
      supportsGuideClaims: false,
      supportsArtifactRecommendations: false,
      supportsGamePerformanceClaims: false,
      supportsGlobalOptimality: false,
      supportsTechnicalObjectiveComparison: true,
      execution: {
        plannedGeneratorInvocations: 16,
        energyRecoveryThresholdsUsed: false,
        perCharacterConstraintsPassed: false,
        explicitGeneratorBuffOverridesPassed: false,
        explicitFormulaBuffOverridesPassedToReplay: false,
      },
      latticeBoundary: {
        nodeLocalSheetPoolsOnly: true,
        crossNodeSheetCompositionsAllowed: false,
        candidateNodeCount: 4,
      },
      technicalObjectiveProvenance: {
        classification: "fixture-wrapper-objective-provenance",
        supportsGuideClaims: false,
        sourceBindingEstablishedByCore: false,
        derivation: "exact-authored-translation-comparisons",
        formulaDraftFixtureId:
          "keqing-ineffa-source-rotation-comparison-v1",
        sourceTeamRecordId:
          "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
        sourceRotationRecordId:
          "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
        sourceRotationId: "sample-rotation",
        reviewStatus: "unreviewed",
        formulaLineCount: 11,
        exactClaimCount: 11,
        completeTokenMappingCount: 10,
        partialTokenMappingCount: 1,
        readiness: {
          readyForDamageReplay: false,
          blockerCount: 8,
          blockerCodes: [
            "translation-unreviewed",
            "partial-token-mapping",
            "unresolved-formula-mapping",
            "unresolved-formula-mapping",
            "unresolved-formula-mapping",
            "unresolved-formula-mapping",
            "unresolved-formula-mapping",
            "unresolved-source-token",
          ],
        },
      },
    });
    expect(report.nodes).toHaveLength(4);
    expect(
      report.nodes.every(
        (node) =>
          node.comparisonStatus === "comparable" &&
          node.compositions.every(
            (composition) =>
              composition.outcome === "evaluated" &&
              composition.calculatorAgreement?.passed === true &&
              composition.computedBuffOverrideLineCount === 0 &&
              /^[a-f0-9]{64}$/.test(
                composition.computedBuffOverridesSha256 ?? "",
              ),
          ),
      ),
    ).toBe(true);
    expect(report.cachedPolicyReplay).toMatchObject({
      status: "available",
      evaluationSource: "evaluated-four-node-cache-only",
      evaluatorCalls: 0,
      coordinateDescent: {
        evaluationSource: "cached-node-table-only",
        evaluatorCalls: 0,
        terminal: {
          reason: "no-strictly-improving-comparable-neighbor",
          nodeId: "02-aubade-tenacity",
          equivalentNeighborNodeIds: ["04-silken-tenacity"],
          plateauObserved: true,
        },
      },
      boundedTableReference: {
        classification: "cached-table-best-comparable-reference",
        status: "selected",
        scope: "declared-node-table-only",
        evaluatorCalls: 0,
        direction: "maximize",
        tolerance: { absolute: 0, relative: 0 },
        deterministicTiePolicy:
          "lowest-node-id-among-tolerance-equivalent-best-values",
        failureNodeIds: [],
        nodeId: "02-aubade-tenacity",
        representative: {
          nodeId: "02-aubade-tenacity",
        },
        equivalentNodeIds: [
          "02-aubade-tenacity",
          "04-silken-tenacity",
        ],
      },
      dimensionEffectSummary: {
        classification: "cached-four-node-technical-objective-sensitivity",
        evaluationSource: "evaluated-four-node-cache-only",
        objectiveSource: "node-bounded-reference-compositions",
        supportsArtifactSuitabilityClaims: false,
        supportsCausalGamePerformanceClaims: false,
        ineffaArtifactSetEdges: [
          {
            fromNodeId: "01-seed-aubade-golden",
            toNodeId: "03-silken-golden",
            unreviewedTechnicalObjectiveDelta: 0,
            relation: "exact-zero",
          },
          {
            fromNodeId: "02-aubade-tenacity",
            toNodeId: "04-silken-tenacity",
            unreviewedTechnicalObjectiveDelta: 0,
            relation: "exact-zero",
          },
        ],
        observations: {
          bothIneffaSetEdgesAreExactZero: true,
          bothFurinaSetEdgesShareExactPositiveDelta: true,
        },
      },
      beamCoverage: {
        interpretation: "coverage-only",
        calibration: "not-calibrated",
        exhaustive: false,
        evaluationSource: "cached-node-table-only",
        evaluatorCalls: 0,
      },
    });
    if (report.cachedPolicyReplay.status !== "available") {
      throw new Error("Expected cached policy replay for four comparable nodes.");
    }
    const furinaEdges =
      report.cachedPolicyReplay.dimensionEffectSummary.furinaArtifactSetEdges;
    expect(furinaEdges.every(({ relation }) => relation === "positive")).toBe(
      true,
    );
    expect(furinaEdges[0].unreviewedTechnicalObjectiveDelta).toBeGreaterThan(0);
    expect(furinaEdges[1].unreviewedTechnicalObjectiveDelta).toBe(
      furinaEdges[0].unreviewedTechnicalObjectiveDelta,
    );
    expect(formatKeqingIneffaBoundedJointArtifactExperimentSummary(report)).toBe(
      "Wrote bounded joint artifact experiment: 4/4 nodes comparable, " +
        `${report.latticeBoundary.totalObservedCompositions} compositions observed, ` +
        "0 generator/capture failures, 0 node configuration failures, 0 evaluation failures, cached policy replay available.",
    );

    const failedSummaryFixture = structuredClone(report);
    const failedCarry = failedSummaryFixture.nodes[0].carryRuns[0];
    failedSummaryFixture.nodes[0].comparisonStatus = "not-comparable";
    failedSummaryFixture.nodes[0].carryRuns[0] = {
      carryCharacterId: failedCarry.carryCharacterId,
      outcome: "not-comparable",
      failure: {
        code: "generator-failed",
        stage: "generator",
        name: "Error",
        message: "summary fixture generator failure",
      },
    };
    failedSummaryFixture.nodes[0].nodeFailures = [
      {
        code: "team-config-mismatch",
        stage: "capture",
        name: "JointExperimentCaptureError",
        message: "summary fixture team-config mismatch",
      },
    ];
    const failedComposition = failedSummaryFixture.nodes[1].compositions[0];
    failedSummaryFixture.nodes[1].comparisonStatus = "not-comparable";
    failedSummaryFixture.nodes[1].compositions[0] = {
      ...failedComposition,
      outcome: "evaluation-failed",
      unreviewedTechnicalObjective: null,
      normalizedToBoundedReference: null,
      computedBuffOverrideLineCount: null,
      computedBuffOverridesSha256: null,
      calculatorAgreement: null,
      failure: {
        name: "Error",
        message: "summary fixture evaluation failure",
      },
    };
    failedSummaryFixture.cachedPolicyReplay = {
      status: "withheld-due-to-incomparable-node",
      evaluationSource: "not-run",
      evaluatorCalls: 0,
      incomparableNodeIds: [
        failedSummaryFixture.nodes[0].nodeId,
        failedSummaryFixture.nodes[1].nodeId,
      ],
      reason:
        "At least one node-generation, capture, configuration, or composition-evaluation step failed, so no cross-node cached policy comparison was run.",
    };
    expect(
      formatKeqingIneffaBoundedJointArtifactExperimentSummary(
        failedSummaryFixture,
      ),
    ).toBe(
      "Wrote bounded joint artifact experiment: 2/4 nodes comparable, " +
        `${report.latticeBoundary.totalObservedCompositions} compositions observed, ` +
        "1 generator/capture failure, 1 node configuration failure, 1 evaluation failure, cached policy replay withheld-due-to-incomparable-node.",
    );
  });

  it("rejects node-ID and varied-coordinate geometry drift before labeling edges", async () => {
    const report = (await readJson(
      KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_REPORT_PATH,
    )) as KeqingIneffaBoundedJointArtifactExperimentReport;

    const nodeIdDrift = structuredClone(report);
    nodeIdDrift.nodes[0].nodeId = "unexpected-node";
    expect(() => buildKeqingIneffaCachedPolicyReplay(nodeIdDrift)).toThrow(
      "requires exact unique node IDs",
    );

    const duplicateCoordinate = structuredClone(report);
    duplicateCoordinate.nodes[0].requestedArtifactSetIdsByCharacter.ineffa =
      "silken_moons_serenade";
    expect(() =>
      buildKeqingIneffaCachedPolicyReplay(duplicateCoordinate),
    ).toThrow("duplicate the same Ineffa/Furina coordinate");

    const unexpectedVariedValue = structuredClone(report);
    unexpectedVariedValue.nodes[0].requestedArtifactSetIdsByCharacter.ineffa =
      "emblem_of_severed_fate";
    expect(() =>
      buildKeqingIneffaCachedPolicyReplay(unexpectedVariedValue),
    ).toThrow("Ineffa varied dimension must contain exactly");

    const swappedCoordinates = structuredClone(report);
    const firstFurinaSet =
      swappedCoordinates.nodes[0].requestedArtifactSetIdsByCharacter.furina;
    swappedCoordinates.nodes[0].requestedArtifactSetIdsByCharacter.furina =
      swappedCoordinates.nodes[1].requestedArtifactSetIdsByCharacter.furina;
    swappedCoordinates.nodes[1].requestedArtifactSetIdsByCharacter.furina =
      firstFurinaSet;
    expect(() =>
      buildKeqingIneffaCachedPolicyReplay(swappedCoordinates),
    ).toThrow("does not match its expected Ineffa/Furina artifact-set coordinates");
  });

  it("rejects drift in the fixed Keqing and Xilonen assignments", async () => {
    const report = (await readJson(
      KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_REPORT_PATH,
    )) as KeqingIneffaBoundedJointArtifactExperimentReport;

    const keqingDrift = structuredClone(report);
    keqingDrift.nodes[0].requestedArtifactSetIdsByCharacter.keqing =
      "gladiators_finale";
    expect(() => buildKeqingIneffaCachedPolicyReplay(keqingDrift)).toThrow(
      "Keqing fixed assignment must contain exactly thundering_fury",
    );

    const xilonenDrift = structuredClone(report);
    for (const node of xilonenDrift.nodes) {
      node.requestedArtifactSetIdsByCharacter.xilonen = "archaic_petra";
    }
    expect(() => buildKeqingIneffaCachedPolicyReplay(xilonenDrift)).toThrow(
      "Xilonen fixed assignment must contain exactly scroll_of_the_hero_of_cinder_city",
    );
  });
});
