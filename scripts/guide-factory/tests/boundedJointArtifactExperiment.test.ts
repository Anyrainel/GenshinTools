import { runGenerator as runRuntimeGenerator } from "@/lib/team-comp/generator/generator";
import { describe, expect, it } from "vitest";
import {
  runBoundedJointArtifactExperiment,
  type BoundedJointArtifactExperimentInput,
} from "../src/boundedJointArtifactExperiment";
import { replayTeamDamage } from "../src/computationReplay";
import { buildKeqingIneffaArtifactGenerationTechnicalProbeInput } from "../src/keqingIneffaArtifactGenerationTechnicalProbe";
import { readJson, sha256Text, stableJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import { KnowledgeRepositorySchema } from "../src/schemas";

describe("bounded joint artifact experiment", () => {
  it("runs the real four-node carry lattice sequentially", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const baseProbeInput =
      await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(
        repository,
        [],
      );
    const authored = baseProbeInput.formulaDraft as typeof baseProbeInput.formulaDraft & {
      authoredTranslation: {
        formulaComparisons: Array<{
          characterId: string;
          formulaId: string;
          sourceCountClaim: { type: "exact"; value: number };
        }>;
      };
    };
    const teamBuilds = new Set<object>();
    let active = 0;
    let maxActive = 0;
    const input = {
      baseProbeInput,
      candidateIds: [
        "01-seed-aubade-golden",
        "02-aubade-tenacity",
        "03-silken-golden",
        "04-silken-tenacity",
      ] as [string, string, string, string],
      carryCharacterIds: [
        "keqing",
        "ineffa",
        "furina",
        "xilonen",
      ] as [string, string, string, string],
      unreviewedTechnicalFormulaLines:
        authored.authoredTranslation.formulaComparisons.map(
          (line) => ({
            characterId: line.characterId,
            formulaId: line.formulaId,
            count: line.sourceCountClaim.value,
          }),
        ),
      generatedFrom: [],
    };
    const report = await runBoundedJointArtifactExperiment(
      input,
      {
        runGenerator: (options) => {
          expect(options.perChar).toBeUndefined();
          expect(options.ignoreArtifactSets).toBeUndefined();
          teamBuilds.add(options.teamBuild);
          return observedGenerator();

          async function* observedGenerator() {
            active += 1;
            maxActive = Math.max(maxActive, active);
            try {
              yield* runRuntimeGenerator(options);
            } finally {
              active -= 1;
            }
          }
        },
        replayTeamDamage,
      },
    );
    const repeated = await runBoundedJointArtifactExperiment(input);

    expect(repeated).toEqual(report);
    expect(teamBuilds.size).toBe(16);
    expect(maxActive).toBe(1);
    expect(report.execution).toMatchObject({
      plannedGeneratorInvocations: 16,
      observedGeneratorInvocations: 16,
      maximumGeneratorConcurrency: 1,
      explicitGeneratorBuffOverridesPassed: false,
      explicitFormulaBuffOverridesPassedToReplay: false,
    });
    expect(
      report.technicalObjectiveInputs.unreviewedTechnicalFormulaPlan,
    ).toMatchObject({
      reviewStatus: "unreviewed",
      sourceBindingEstablishedByCore: false,
      lines: input.unreviewedTechnicalFormulaLines,
    });
    expect(
      report.technicalObjectiveInputs.unreviewedTechnicalFormulaPlan.sha256,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(report.technicalObjectiveInputs).toMatchObject({
      combatOptions: {},
      enemyAura: null,
      extraBuffs: [],
      explicitFormulaBuffOverrides: null,
    });
    expect(report.technicalObjectiveInputs.sharedCharacterConfigs).toHaveLength(
      4,
    );
    expect(report.nodes.map((node) => node.comparisonStatus)).toEqual([
      "comparable",
      "comparable",
      "comparable",
      "comparable",
    ]);
    expect(report.nodes.map((node) => node.observedCartesianCompositionCount))
      .toEqual([8, 16, 8, 16]);
    expect(report.latticeBoundary).toMatchObject({
      nodeLocalSheetPoolsOnly: true,
      crossNodeSheetCompositionsAllowed: false,
      totalExpectedCompositions: 48,
      totalObservedCompositions: 48,
    });
    for (const node of report.nodes) {
      expect(node.technicalTeamConfigs).toHaveLength(4);
      expect(node.capturedTeamConfigSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(node.capturedTeamConfigSha256).toBe(
        sha256Text(stableJson(node.technicalTeamConfigs)),
      );
      expect(
        Object.values(node.sheetPoolsByCharacter)
          .flat()
          .every((cell) => !("characterId" in cell)),
      ).toBe(true);
      expect(node.expectedCartesianCompositionCount).toBe(
        Object.values(node.poolSizesByCharacter).reduce(
          (product, size) => product * size,
          1,
        ),
      );
      expect(node.intactCarryCoverage.every((cell) => cell.compositionId)).toBe(
        true,
      );
      expect(
        node.compositions.every(
          (composition) =>
            composition.outcome === "evaluated" &&
            composition.normalizedToBoundedReferenceStatus === "available" &&
            composition.normalizedToBoundedReference != null &&
            composition.calculatorAgreement?.passed === true &&
            composition.calculatorAgreement.absoluteDifference <=
              composition.calculatorAgreement.allowedDifference &&
            composition.computedBuffOverrideLineCount === 0 &&
            /^[a-f0-9]{64}$/.test(
              composition.computedBuffOverridesSha256 ?? "",
            ) &&
            Object.values(composition.sheetsByCharacter).every(
              ({ nodeId }) => nodeId === node.nodeId,
            ),
        ),
      ).toBe(true);
      expect(
        node.boundedReferenceComposition?.unreviewedTechnicalObjective,
      ).toBeGreaterThanOrEqual(
        node.bestIntactCarryComposition?.unreviewedTechnicalObjective ??
          Number.POSITIVE_INFINITY,
      );
      expect(node.boundedReferenceOverBestIntactStatus).toBe("available");
    }
    expect(report.boundedReferenceComposition).toMatchObject({
      nodeId: "02-aubade-tenacity",
      representativeSelectionPolicy:
        "first-candidate-then-enumerated-composition-exact-objective-tie",
      equivalentReferences: [
        { nodeId: "02-aubade-tenacity" },
        { nodeId: "04-silken-tenacity" },
      ],
    });
    expect(
      report.nodes[0].boundedReferenceComposition
        ?.unreviewedTechnicalObjective,
    ).toBe(
      report.nodes[2].boundedReferenceComposition
        ?.unreviewedTechnicalObjective,
    );
    expect(
      report.nodes[1].boundedReferenceComposition
        ?.unreviewedTechnicalObjective,
    ).toBe(
      report.nodes[3].boundedReferenceComposition
        ?.unreviewedTechnicalObjective,
    );
    expect(
      report.nodes[0].bestIntactCarryComposition
        ?.unreviewedTechnicalObjective,
    ).toBe(
      report.nodes[2].bestIntactCarryComposition
        ?.unreviewedTechnicalObjective,
    );
    expect(
      report.nodes[1].bestIntactCarryComposition
        ?.unreviewedTechnicalObjective,
    ).toBe(
      report.nodes[3].bestIntactCarryComposition
        ?.unreviewedTechnicalObjective,
    );
  });

  it("nulls the failed node and full-lattice reference after one replay failure", async () => {
    const input = await buildRealInput();
    let replayCalls = 0;
    const report = await runBoundedJointArtifactExperiment(input, {
      runGenerator: runRuntimeGenerator,
      replayTeamDamage: async (replayInput) => {
        replayCalls += 1;
        if (replayCalls === 1) {
          throw new Error("deliberate evaluator failure");
        }
        return replayTeamDamage(replayInput);
      },
    });

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.boundedReferenceComposition).toBeNull();
    expect(report.nodes[0]).toMatchObject({
      comparisonStatus: "not-comparable",
      boundedReferenceComposition: null,
      bestIntactCarryComposition: null,
    });
    expect(
      report.nodes[0].compositions.filter(
        ({ outcome }) => outcome === "evaluation-failed",
      ),
    ).toHaveLength(1);
    expect(report.nodes.slice(1).every(
      ({ comparisonStatus }) => comparisonStatus === "comparable",
    )).toBe(true);
  });

  it("preserves one invalid captured sheet as a typed carry failure and continues", async () => {
    const input = await buildRealInput();
    let generatorInvocations = 0;
    const report = await runBoundedJointArtifactExperiment(input, {
      runGenerator: (options) => {
        generatorInvocations += 1;
        const invocation = generatorInvocations;
        return invalidateFirstFinalSheet();

        async function* invalidateFirstFinalSheet() {
          for await (const result of runRuntimeGenerator(options)) {
            if (invocation === 1 && result.done) {
              yield {
                ...result,
                sheetsByChar: {
                  ...result.sheetsByChar,
                  keqing: {} as never,
                },
              };
            } else {
              yield result;
            }
          }
        }
      },
      replayTeamDamage,
    });

    expect(generatorInvocations).toBe(16);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.boundedReferenceComposition).toBeNull();
    expect(report.nodes[0]).toMatchObject({
      comparisonStatus: "not-comparable",
      technicalTeamConfigs: null,
      capturedTeamConfigSha256: null,
      boundedReferenceComposition: null,
      boundedReferenceOverBestIntactStatus: "not-comparable",
    });
    expect(report.nodes[0].carryRuns).toHaveLength(4);
    expect(report.nodes[0].carryRuns[0]).toMatchObject({
      carryCharacterId: "keqing",
      outcome: "not-comparable",
      failure: {
        code: "captured-result-invalid",
        stage: "capture",
        name: "JointExperimentCaptureError",
      },
    });
    expect(
      report.nodes[0].carryRuns.filter(({ outcome }) => outcome === "captured"),
    ).toHaveLength(3);
    expect(
      report.nodes.slice(1).every(
        ({ comparisonStatus }) => comparisonStatus === "comparable",
      ),
    ).toBe(true);
  });

  it("keeps all-zero objectives comparable with explicit undefined ratios", async () => {
    const input = await buildRealInput();
    const report = await runBoundedJointArtifactExperiment(input, {
      runGenerator: runRuntimeGenerator,
      replayTeamDamage: async (replayInput) => {
        const output = await replayTeamDamage(replayInput);
        return {
          ...output,
          validation: {
            ...output.validation,
            calculatorAgreement: {
              passed: true as const,
              directTotalDamage: 0,
              compiledTotalDamage: 0,
              absoluteDifference: 0,
              allowedDifference: output.validation.calculatorAgreement.allowedDifference,
            },
          },
          result: {
            totalDamage: 0,
            lineDamages: output.result.lineDamages.map((line) => ({
              ...line,
              perHit: 0,
              total: 0,
            })),
          },
        };
      },
    });

    expect(report.comparisonStatus).toBe("comparable");
    expect(
      report.boundedReferenceComposition?.unreviewedTechnicalObjective,
    ).toBe(0);
    expect(report.nodes.every((node) => node.comparisonStatus === "comparable"))
      .toBe(true);
    for (const node of report.nodes) {
      expect(
        node.boundedReferenceComposition?.unreviewedTechnicalObjective,
      ).toBe(0);
      expect(
        node.bestIntactCarryComposition?.unreviewedTechnicalObjective,
      ).toBe(0);
      expect(node.boundedReferenceOverBestIntact).toBeNull();
      expect(node.boundedReferenceOverBestIntactStatus).toBe(
        "undefined-zero-best-intact",
      );
      expect(
        node.compositions.every(
          (composition) =>
            composition.outcome === "evaluated" &&
            composition.unreviewedTechnicalObjective === 0 &&
            composition.normalizedToBoundedReference === null &&
            composition.normalizedToBoundedReferenceStatus ===
              "undefined-zero-reference",
        ),
      ).toBe(true);
    }
  });
});

async function buildRealInput(): Promise<BoundedJointArtifactExperimentInput> {
  const repository = KnowledgeRepositorySchema.parse(
    await readJson(KNOWLEDGE_REPOSITORY_PATH),
  );
  const baseProbeInput =
    await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(
      repository,
      [],
    );
  const authored = baseProbeInput.formulaDraft as typeof baseProbeInput.formulaDraft & {
    authoredTranslation: {
      formulaComparisons: Array<{
        characterId: string;
        formulaId: string;
        sourceCountClaim: { type: "exact"; value: number };
      }>;
    };
  };
  return {
    baseProbeInput,
    candidateIds: [
      "01-seed-aubade-golden",
      "02-aubade-tenacity",
      "03-silken-golden",
      "04-silken-tenacity",
    ],
    carryCharacterIds: ["keqing", "ineffa", "furina", "xilonen"],
    unreviewedTechnicalFormulaLines:
      authored.authoredTranslation.formulaComparisons.map(
        (line) => ({
          characterId: line.characterId,
          formulaId: line.formulaId,
          count: line.sourceCountClaim.value,
        }),
      ),
    generatedFrom: [],
  };
}
