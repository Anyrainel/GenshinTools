import path from "node:path";
import {
  allSlots,
  type MainStat,
  type Slot,
  type SubStat,
} from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { GeneratorOptions } from "@/lib/team-comp/generator/generator";
import { describe, expect, it } from "vitest";
import {
  runArtifactGenerationTechnicalProbe,
  type ArtifactGenerationComposedSourceClaimsValidationTarget,
} from "../src/artifactGenerationTechnicalProbe";
import {
  buildKeqingIneffaArtifactGenerationTechnicalProbeInput,
  KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS,
  runKeqingIneffaArtifactGenerationTechnicalProbe,
} from "../src/keqingIneffaArtifactGenerationTechnicalProbe";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "../src/paths";
import {
  type KnowledgeRepository,
  KnowledgeRepositorySchema,
} from "../src/schemas";

describe("Keqing-Ineffa artifact-generation technical probe", () => {
  it("runs the bounded 2x2 matrix sequentially and preserves the negative control", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const report = await runKeqingIneffaArtifactGenerationTechnicalProbe(
      repository,
    );
    const repeated = await runKeqingIneffaArtifactGenerationTechnicalProbe(
      repository,
    );
    expect(repeated).toEqual(report);

    expect(report).toMatchObject({
      schemaVersion: 2,
      classification: "artifact-generation-technical-probe",
      supportsGuideClaims: false,
      supportsArtifactRecommendations: false,
      supportsComparativeClaims: false,
      seedPreflight: {
        equipmentReadyForTechnicalProbe: true,
        seedPreflightBound: true,
        authorizesChangedCandidateFormulaBinding: false,
        readyForReviewedGeneratorExperiment: false,
        formulaPlanReviewStatus: "unreviewed",
      },
      execution: {
        generatorApi: "runGenerator",
        comparisonWrapperUsed: false,
        scheduling: "sequential",
        carryCharacterId: "keqing",
        energyRecoveryThresholdsUsed: false,
        numericalDamageRetained: false,
        composedSourceClaimsValidationPolicy:
          "default-deny-trusted-environment-capability-only",
        trustedComposedSourceClaimsValidatorAvailable: false,
      },
    });
    expect(report.execution.candidateOrder).toEqual([
      "01-seed-aubade-golden",
      "02-aubade-tenacity",
      "03-silken-golden",
      "04-silken-tenacity",
      "05-instructor-negative-control",
    ]);

    const completed = report.candidates.slice(0, 4);
    expect(completed.every(({ outcome }) => outcome === "completed-structurally"))
      .toBe(true);
    for (const observation of completed) {
      expect(observation).toMatchObject({
        generatorInvoked: true,
        requestedAssignmentsSatisfied: true,
        independentValidation: {
          validationTargetsMatchAssignmentAndProvenance: true,
          allSetsAreFiveStar: true,
          runtimeRegistration: "passed",
        },
      });
      expect(observation.progress.at(-1)).toEqual({
        phase: "done",
        progress: 1,
        done: true,
      });
      expect(
        observation.progress.every(
          (step, index) =>
            step.progress >= 0 &&
            step.progress <= 1 &&
            (index === 0 ||
              step.progress >= observation.progress[index - 1].progress),
        ),
      ).toBe(true);
      if (observation.outcome !== "completed-structurally") {
        throw new Error("Expected a completed structural observation.");
      }
      expect(observation.artifactShape).toHaveLength(4);
      expect(
        observation.artifactShape.every(({ slots }) =>
          slots.every(
            ({ rarity, level, hasMainStat, positiveSubstatKeyCount }) =>
              rarity === 5 &&
              level === 20 &&
              hasMainStat &&
              positiveSubstatKeyCount <= 4,
          ),
        ),
      ).toBe(true);
      expect(observation.validationTargetComparisons).toHaveLength(4);
      expect(
        observation.validationTargetComparisons.every(
          ({ validationTargetProvenance }) =>
            validationTargetProvenance.kind === "repository-build" &&
            validationTargetProvenance.buildSourceRecordId.length > 0,
        ),
      ).toBe(true);
    }
    expect(report.candidates[3].changedFromSeedCharacters).toEqual([
      "furina",
      "ineffa",
    ]);
    expect(
      report.candidates
        .slice(0, 4)
        .map(
          ({ requestedValidationTargetsByCharacter }) =>
            requestedValidationTargetsByCharacter,
        ),
    ).toEqual([
      {
        furina: repositoryTarget("furina", "BQAI0BO"),
        ineffa: repositoryTarget("ineffa", "FeFiQU8"),
        keqing: repositoryTarget("keqing", "1WswsAu"),
        xilonen: repositoryTarget("xilonen", "Dbt0Wkm"),
      },
      {
        furina: repositoryTarget("furina", "BQA4H1m"),
        ineffa: repositoryTarget("ineffa", "FeFiQU8"),
        keqing: repositoryTarget("keqing", "1WswsAu"),
        xilonen: repositoryTarget("xilonen", "Dbt0Wkm"),
      },
      {
        furina: repositoryTarget("furina", "BQAI0BO"),
        ineffa: repositoryTarget("ineffa", "FeFi2JG"),
        keqing: repositoryTarget("keqing", "1WswsAu"),
        xilonen: repositoryTarget("xilonen", "Dbt0Wkm"),
      },
      {
        furina: repositoryTarget("furina", "BQA4H1m"),
        ineffa: repositoryTarget("ineffa", "FeFi2JG"),
        keqing: repositoryTarget("keqing", "1WswsAu"),
        xilonen: repositoryTarget("xilonen", "Dbt0Wkm"),
      },
    ]);

    expect(report.candidates[4]).toMatchObject({
      candidateId: "05-instructor-negative-control",
      outcome: "rejected-before-run",
      generatorInvoked: false,
      requestedAssignmentsSatisfied: false,
      independentValidation: {
        validationTargetsMatchAssignmentAndProvenance: true,
        allSetsAreFiveStar: false,
        runtimeRegistration: "not-attempted",
      },
      failure: {
        code: "non-five-star-set",
        stage: "candidate-validation",
        name: "CandidateValidationError",
        message: expect.stringContaining("non-five-star-filter"),
      },
    });
    expect(
      report.candidates[4].requestedValidationTargetsByCharacter.xilonen,
    ).toEqual(repositoryTarget("xilonen", "Dbspw5m"));

    const forbiddenKeys = collectObjectKeys(report).filter((key) =>
      ["damage", "score", "rank", "ranking", "winner"].includes(
        key.toLowerCase(),
      ),
    );
    expect(forbiddenKeys).toEqual([]);
  }, 120_000);

  it("keeps a runner exception local and continues later candidates", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const input =
      await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
    const invokedAssignments: string[] = [];
    const observedFormulaLines: GeneratorOptions["combo"]["lines"][] = [];

    const report = await runArtifactGenerationTechnicalProbe(input, {
      runGenerator: async function* (options) {
        expect(options.perChar).toBeUndefined();
        expect(options.combo.buffOverrides).toBeUndefined();
        const assignment = assignmentKey(options);
        invokedAssignments.push(assignment);
        observedFormulaLines.push(options.combo.lines);
        yield {
          artifactsByChar: {},
          sheetsByChar: {},
          phase: "starting",
          progress: 0,
          done: false,
        };
        if (
          assignment.includes("ineffa=silken_moons_serenade") &&
          assignment.includes("furina=tenacity_of_the_millelith")
        ) {
          throw new TypeError("injected paired-candidate failure");
        }
        yield makeFinalResult(options);
      },
    });

    expect(invokedAssignments).toHaveLength(4);
    expect(
      observedFormulaLines.every(
        (lines) =>
          lines.length === 13 &&
          lines.every(
            (line) =>
              line.charId.length > 0 &&
              !("characterId" in (line as unknown as Record<string, unknown>)),
          ),
      ),
    ).toBe(true);
    expect(report.candidates.map(({ outcome }) => outcome)).toEqual([
      "completed-structurally",
      "completed-structurally",
      "completed-structurally",
      "failed-during-run",
      "rejected-before-run",
    ]);
    expect(report.candidates[3]).toMatchObject({
      generatorInvoked: true,
      progress: [{ phase: "starting", progress: 0, done: false }],
      failure: {
        code: "generator-failed",
        stage: "generator",
        name: "TypeError",
        message: "injected paired-candidate failure",
      },
    });
    expect(report.candidates[4]).toMatchObject({
      generatorInvoked: false,
      outcome: "rejected-before-run",
    });
  });

  it("rejects unavailable formula rows before invoking the generator", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const input =
      await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
    input.formulaDraft.lines[0].formulaId = "not-a-runtime-formula";
    let invocations = 0;

    const report = await runArtifactGenerationTechnicalProbe(input, {
      runGenerator: async function* () {
        invocations++;
      },
    });

    expect(invocations).toBe(0);
    expect(report.candidates.slice(0, 4)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: "rejected-before-run",
          generatorInvoked: false,
          failure: expect.objectContaining({
            code: "candidate-formula-invalid",
            stage: "formula-validation",
            message: expect.stringContaining("unavailable"),
          }),
        }),
      ]),
    );
    expect(
      report.candidates
        .slice(0, 4)
        .every(
          (candidate) =>
            candidate.outcome === "rejected-before-run" &&
            candidate.failure.code === "candidate-formula-invalid",
        ),
    ).toBe(true);
    expect(report.candidates[4]).toMatchObject({
      outcome: "rejected-before-run",
      failure: { code: "non-five-star-set" },
    });
  });

  it("rejects an empty formula objective before invoking the generator", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const input =
      await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
    input.formulaDraft.lines = [];
    let invocations = 0;

    const report = await runArtifactGenerationTechnicalProbe(input, {
      runGenerator: async function* () {
        invocations++;
      },
    });

    expect(invocations).toBe(0);
    expect(
      report.candidates.slice(0, 4).every(
        (candidate) =>
          candidate.outcome === "rejected-before-run" &&
          candidate.failure.code === "candidate-formula-invalid" &&
          candidate.failure.message.includes("at least one formula line"),
      ),
    ).toBe(true);
    expect(report.candidates[4]).toMatchObject({
      outcome: "rejected-before-run",
      failure: { code: "non-five-star-set" },
    });
  });

  it("rejects fabricated repository guide and build IDs before generator invocation", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );

    for (const fabricatedField of ["characterGuideId", "buildSourceRecordId"] as const) {
      const input =
        await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
      input.candidates = [input.candidates[0]];
      const target = input.candidates[0].validationTargets[0];
      if (target.kind !== "repository-build") {
        throw new Error("Expected repository-build validation target fixture.");
      }
      target[fabricatedField] = `fabricated-${fabricatedField}`;
      let invocations = 0;

      const report = await runArtifactGenerationTechnicalProbe(input, {
        runGenerator: async function* () {
          invocations++;
        },
      });

      expect(invocations).toBe(0);
      expect(report.candidates).toHaveLength(1);
      expect(report.candidates[0]).toMatchObject({
        outcome: "rejected-before-run",
        generatorInvoked: false,
        requestedAssignmentsSatisfied: false,
        independentValidation: {
          validationTargetsMatchAssignmentAndProvenance: false,
          allSetsAreFiveStar: "not-evaluated",
          runtimeRegistration: "not-attempted",
        },
        failure: {
          code: "candidate-validation-target-provenance-mismatch",
          stage: "candidate-validation",
          name: "CandidateValidationError",
          message: expect.stringContaining("failed provenance validation"),
        },
      });
    }
  });

  it("rejects mutated stats, artifact drift, and duplicate character targets before generator invocation", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    type ProbeInput = Awaited<
      ReturnType<
        typeof buildKeqingIneffaArtifactGenerationTechnicalProbeInput
      >
    >;
    const cases: Array<{
      label: string;
      expectedCode:
        | "candidate-build-target-mismatch"
        | "candidate-validation-target-provenance-mismatch";
      mutate: (input: ProbeInput) => void;
    }> = [
      {
        label: "legal-but-mutated-stat",
        expectedCode: "candidate-validation-target-provenance-mismatch",
        mutate: (input) => {
          const target = input.candidates[0].validationTargets[0];
          target.sands[0] = target.sands[0] === "em" ? "atk%" : "em";
        },
      },
      {
        label: "target-and-assignment-artifact-drift",
        expectedCode: "candidate-validation-target-provenance-mismatch",
        mutate: (input) => {
          const target = input.candidates[0].validationTargets[0];
          input.candidates[0].artifactSetIdsByCharacter[target.characterId] =
            "gladiators_finale";
          target.artifactSetId = "gladiators_finale";
        },
      },
      {
        label: "duplicate-character-target",
        expectedCode: "candidate-build-target-mismatch",
        mutate: (input) => {
          input.candidates[0].validationTargets[3] = structuredClone(
            input.candidates[0].validationTargets[0],
          );
        },
      },
    ];

    for (const testCase of cases) {
      const input =
        await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
      input.candidates = [input.candidates[0]];
      testCase.mutate(input);
      let invocations = 0;
      const report = await runArtifactGenerationTechnicalProbe(input, {
        runGenerator: async function* () {
          invocations++;
        },
      });

      expect(invocations, testCase.label).toBe(0);
      expect(report.candidates[0], testCase.label).toMatchObject({
        outcome: "rejected-before-run",
        generatorInvoked: false,
        independentValidation: {
          validationTargetsMatchAssignmentAndProvenance: false,
          allSetsAreFiveStar: "not-evaluated",
        },
        failure: {
          code: testCase.expectedCode,
          stage: "candidate-validation",
        },
      });
    }
  });

  it("rejects caller-authored composed targets without a trusted environment validator", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const { input } = await buildComposedTargetProbeInput(repository);
    let invocations = 0;

    const rejected = await runArtifactGenerationTechnicalProbe(input, {
      runGenerator: async function* () {
        invocations++;
      },
    });
    expect(invocations).toBe(0);
    expect(rejected.candidates[0]).toMatchObject({
      outcome: "rejected-before-run",
      generatorInvoked: false,
      requestedValidationTargetsByCharacter: {
        keqing: {
          kind: "composed-source-claims",
          compositionId: "validated-test-composition",
        },
      },
      independentValidation: {
        validationTargetsMatchAssignmentAndProvenance: false,
        allSetsAreFiveStar: "not-evaluated",
      },
      failure: {
        code: "candidate-validation-target-provenance-mismatch",
        message: expect.stringContaining("trusted source-specific"),
      },
    });
  });

  it("admits composed targets only through an explicit trusted environment validator", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const { input } = await buildComposedTargetProbeInput(repository);
    let trustedValidationCalls = 0;

    const accepted = await runArtifactGenerationTechnicalProbe(input, {
      validateComposedSourceClaimsTarget: (target) => {
        trustedValidationCalls++;
        return target.compositionId === "validated-test-composition"
          ? { valid: true }
          : { valid: false, message: "unexpected test composition" };
      },
      runGenerator: async function* (options) {
        yield makeFinalResult(options);
      },
    });

    expect(trustedValidationCalls).toBe(1);
    expect(accepted.execution.trustedComposedSourceClaimsValidatorAvailable).toBe(
      true,
    );
    expect(accepted.candidates[0]).toMatchObject({
      outcome: "completed-structurally",
      generatorInvoked: true,
      requestedValidationTargetsByCharacter: {
        keqing: {
          kind: "composed-source-claims",
          compositionId: "validated-test-composition",
        },
      },
    });
    if (accepted.candidates[0].outcome !== "completed-structurally") {
      throw new Error("Expected trusted composed-target run to complete.");
    }
    expect(
      accepted.candidates[0].validationTargetComparisons.find(
        ({ characterId }) => characterId === "keqing",
      )?.validationTargetProvenance,
    ).toMatchObject({
      kind: "composed-source-claims",
      compositionId: "validated-test-composition",
    });
  });

  it("rejects slot-illegal main stats and illegal substats before a permissive trusted validator", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const cases: Array<{
      label: string;
      expectedMessage: string;
      mutate: (
        target: ArtifactGenerationComposedSourceClaimsValidationTarget,
      ) => void;
    }> = [
      {
        label: "slot-illegal-sands-main-stat",
        expectedMessage: "sands contains slot-illegal main stat electro%",
        mutate: (target) => {
          target.sands[0] = "electro%";
        },
      },
      {
        label: "illegal-validation-target-substat",
        expectedMessage: "substats contain illegal substat electro%",
        mutate: (target) => {
          target.substats[0] = "electro%" as SubStat;
        },
      },
      {
        label: "illegal-source-priority-substat",
        expectedMessage:
          "source priority groups contain illegal substat electro%",
        mutate: (target) => {
          target.sourcePriorityGroups[0][0] = "electro%" as SubStat;
        },
      },
    ];

    for (const testCase of cases) {
      const { input } = await buildComposedTargetProbeInput(repository);
      const composedTarget = input.candidates[0].validationTargets.find(
        (
          target,
        ): target is ArtifactGenerationComposedSourceClaimsValidationTarget =>
          target.kind === "composed-source-claims",
      );
      if (!composedTarget) {
        throw new Error("Expected composed-source-claims target fixture.");
      }
      testCase.mutate(composedTarget);
      let trustedValidationCalls = 0;
      let generatorInvocations = 0;

      const report = await runArtifactGenerationTechnicalProbe(input, {
        validateComposedSourceClaimsTarget: () => {
          trustedValidationCalls++;
          return { valid: true };
        },
        runGenerator: async function* () {
          generatorInvocations++;
        },
      });

      expect(trustedValidationCalls, testCase.label).toBe(0);
      expect(generatorInvocations, testCase.label).toBe(0);
      expect(report.candidates[0], testCase.label).toMatchObject({
        outcome: "rejected-before-run",
        generatorInvoked: false,
        independentValidation: {
          validationTargetsMatchAssignmentAndProvenance: false,
          allSetsAreFiveStar: "not-evaluated",
        },
        failure: {
          code: "candidate-validation-target-provenance-mismatch",
          stage: "candidate-validation",
          message: expect.stringContaining(testCase.expectedMessage),
        },
      });
    }
  });

  it("rejects composed targets missing nested provenance arrays before trusted validation", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const cases: Array<{
      label: string;
      remove: "matchedStatClaimIds" | "sourcePriorityGroups";
    }> = [
      {
        label: "missing-matched-stat-claim-ids",
        remove: "matchedStatClaimIds",
      },
      {
        label: "missing-source-priority-groups",
        remove: "sourcePriorityGroups",
      },
    ];

    for (const testCase of cases) {
      const { input } = await buildComposedTargetProbeInput(repository);
      const target = requireComposedTarget(input);
      delete (target as unknown as Record<string, unknown>)[testCase.remove];
      let trustedValidationCalls = 0;
      let generatorInvocations = 0;

      const report = await runArtifactGenerationTechnicalProbe(input, {
        validateComposedSourceClaimsTarget: () => {
          trustedValidationCalls++;
          return { valid: true };
        },
        runGenerator: async function* () {
          generatorInvocations++;
        },
      });

      expect(trustedValidationCalls, testCase.label).toBe(0);
      expect(generatorInvocations, testCase.label).toBe(0);
      expect(report.candidates[0], testCase.label).toMatchObject({
        outcome: "rejected-before-run",
        generatorInvoked: false,
        independentValidation: {
          validationTargetsMatchAssignmentAndProvenance: false,
          allSetsAreFiveStar: "not-evaluated",
        },
        failure: {
          code: "candidate-validation-target-provenance-mismatch",
          stage: "candidate-validation",
          message: expect.stringContaining("malformed identity envelope"),
        },
      });
    }
  });

  it("passes a deep clone to the trusted validator and preserves caller input", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const { input } = await buildComposedTargetProbeInput(repository);
    const callerTarget = requireComposedTarget(input);
    const callerTargetBefore = stableJson(callerTarget);
    let trustedValidationCalls = 0;
    let generatorInvocations = 0;

    const report = await runArtifactGenerationTechnicalProbe(input, {
      validateComposedSourceClaimsTarget: (validatorTarget) => {
        trustedValidationCalls++;
        expect(validatorTarget).not.toBe(callerTarget);
        validatorTarget.repositoryRecordIds.push("mutated-repository-record");
        validatorTarget.equipmentClaimIds.push("mutated-equipment-claim");
        validatorTarget.matchedStatClaimIds.sands.push("mutated-sands-claim");
        validatorTarget.matchedStatClaimIds.goblet.push("mutated-goblet-claim");
        validatorTarget.matchedStatClaimIds.circlet.push(
          "mutated-circlet-claim",
        );
        validatorTarget.matchedStatClaimIds.substats.push(
          "mutated-substat-claim",
        );
        validatorTarget.withheldStatClaimIds.push("mutated-withheld-claim");
        validatorTarget.sourcePriorityGroups[0].push("er");
        validatorTarget.sourcePriorityGroups.push(["cr"]);
        validatorTarget.sands.push("em");
        validatorTarget.goblet.push("electro%");
        validatorTarget.circlet.push("cd");
        validatorTarget.substats.push("er");
        return { valid: true };
      },
      runGenerator: async function* (options) {
        generatorInvocations++;
        yield makeFinalResult(options);
      },
    });

    expect(trustedValidationCalls).toBe(1);
    expect(generatorInvocations).toBe(1);
    expect(report.candidates[0]).toMatchObject({
      outcome: "completed-structurally",
      generatorInvoked: true,
    });
    expect(stableJson(callerTarget)).toBe(callerTargetBefore);
  });

  it("rejects candidate classifications inconsistent with their target kinds before trusted validation", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const withComposedTarget = await buildComposedTargetProbeInput(repository);
    withComposedTarget.input.candidates[0].classification =
      "repository-build-composition";
    const withoutComposedTarget =
      await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
    withoutComposedTarget.candidates = [withoutComposedTarget.candidates[0]];
    withoutComposedTarget.candidates[0].classification =
      "composed-source-claims";
    let trustedValidationCalls = 0;
    let generatorInvocations = 0;

    for (const input of [withComposedTarget.input, withoutComposedTarget]) {
      const report = await runArtifactGenerationTechnicalProbe(input, {
        validateComposedSourceClaimsTarget: () => {
          trustedValidationCalls++;
          return { valid: true };
        },
        runGenerator: async function* () {
          generatorInvocations++;
        },
      });
      expect(report.candidates[0]).toMatchObject({
        outcome: "rejected-before-run",
        generatorInvoked: false,
        independentValidation: {
          validationTargetsMatchAssignmentAndProvenance: false,
          allSetsAreFiveStar: "not-evaluated",
        },
        failure: {
          code: "candidate-validation-target-provenance-mismatch",
          message: expect.stringContaining("inconsistent"),
        },
      });
    }

    expect(trustedValidationCalls).toBe(0);
    expect(generatorInvocations).toBe(0);
  });

  it("rejects unknown runtime classifications and target kinds without invoking the generator", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const invalidClassification =
      await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
    invalidClassification.candidates = [invalidClassification.candidates[0]];
    (
      invalidClassification.candidates[0] as unknown as {
        classification: string;
      }
    ).classification = "fabricated-classification";

    const invalidTargetKind =
      await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
    invalidTargetKind.candidates = [invalidTargetKind.candidates[0]];
    (
      invalidTargetKind.candidates[0].validationTargets[0] as unknown as {
        kind: string;
      }
    ).kind = "fabricated-target-kind";
    const malformedRecognizedTarget =
      await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
    malformedRecognizedTarget.candidates = [
      malformedRecognizedTarget.candidates[0],
    ];
    (
      malformedRecognizedTarget.candidates[0]
        .validationTargets[0] as unknown as { sands?: MainStat[] }
    ).sands = undefined;
    let generatorInvocations = 0;

    const [classificationReport, targetKindReport, malformedTargetReport] =
      await Promise.all(
        [
          invalidClassification,
          invalidTargetKind,
          malformedRecognizedTarget,
        ].map((input) =>
        runArtifactGenerationTechnicalProbe(input, {
          runGenerator: async function* () {
            generatorInvocations++;
          },
        }),
        ),
      );

    expect(generatorInvocations).toBe(0);
    expect(classificationReport.candidates[0]).toMatchObject({
      outcome: "rejected-before-run",
      generatorInvoked: false,
      requestedClassification: "fabricated-classification",
      independentValidation: {
        allSetsAreFiveStar: "not-evaluated",
      },
      failure: {
        code: "candidate-classification-invalid",
      },
    });
    expect("classification" in classificationReport.candidates[0]).toBe(false);
    expect(targetKindReport.candidates[0]).toMatchObject({
      outcome: "rejected-before-run",
      generatorInvoked: false,
      requestedValidationTargetsByCharacter: {
        keqing: {
          kind: "unrecognized",
          requestedKind: "fabricated-target-kind",
        },
      },
      independentValidation: {
        allSetsAreFiveStar: "not-evaluated",
      },
      failure: {
        code: "candidate-validation-target-provenance-mismatch",
        message: expect.stringContaining("unsupported kind"),
      },
    });
    expect(malformedTargetReport.candidates[0]).toMatchObject({
      outcome: "rejected-before-run",
      generatorInvoked: false,
      independentValidation: {
        allSetsAreFiveStar: "not-evaluated",
      },
      failure: {
        code: "candidate-validation-target-provenance-mismatch",
        message: expect.stringContaining("malformed identity envelope"),
      },
    });
  });

  it("keeps the durable report byte-stable and tied to its inputs", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const generatedFrom = await Promise.all(
      KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    );
    const expected = await runKeqingIneffaArtifactGenerationTechnicalProbe(
      repository,
      generatedFrom,
    );
    const saved = await readJson(
      KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_REPORT_PATH,
    );

    expect(stableJson(saved)).toBe(stableJson(expected));
    expect(expected.generatedFrom).toHaveLength(generatedFrom.length);
  }, 120_000);
});

async function buildComposedTargetProbeInput(
  repository: KnowledgeRepository,
) {
  const input =
    await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository);
  input.candidates = [input.candidates[0]];
  input.candidates[0].classification = "composed-source-claims";
  const targetIndex = input.candidates[0].validationTargets.findIndex(
    ({ characterId }) => characterId === "keqing",
  );
  const repositoryBuild = input.candidates[0].validationTargets[targetIndex];
  if (repositoryBuild.kind !== "repository-build") {
    throw new Error("Expected repository-build Keqing target fixture.");
  }
  input.candidates[0].validationTargets[targetIndex] = {
    kind: "composed-source-claims",
    characterId: repositoryBuild.characterId,
    artifactSetId: repositoryBuild.artifactSetId,
    sands: [...repositoryBuild.sands],
    goblet: [...repositoryBuild.goblet],
    circlet: [...repositoryBuild.circlet],
    substats: [...repositoryBuild.substats],
    compositionId: "validated-test-composition",
    repositoryRecordIds: ["kqm:character-guide:validated-test-source"],
    equipmentClaimIds: ["validated-test-weapon", "validated-test-artifact"],
    matchedStatClaimIds: {
      sands: ["validated-test-sands"],
      goblet: ["validated-test-goblet"],
      circlet: ["validated-test-circlet"],
      substats: ["validated-test-substats"],
    },
    withheldStatClaimIds: ["validated-test-withheld-circlet"],
    sourcePriorityGroups: [[...repositoryBuild.substats]],
    sourceAuthored: false,
  };
  return { input };
}

function requireComposedTarget(
  input: Awaited<
    ReturnType<typeof buildKeqingIneffaArtifactGenerationTechnicalProbeInput>
  >,
): ArtifactGenerationComposedSourceClaimsValidationTarget {
  const target = input.candidates[0].validationTargets.find(
    (
      candidateTarget,
    ): candidateTarget is ArtifactGenerationComposedSourceClaimsValidationTarget =>
      candidateTarget.kind === "composed-source-claims",
  );
  if (!target) {
    throw new Error("Expected composed-source-claims target fixture.");
  }
  return target;
}

function assignmentKey(options: GeneratorOptions): string {
  return options.teamBuild.configs
    .map(({ charId, artifactSet }) => {
      if (artifactSet?.type !== "4pc") {
        throw new Error(`Expected four-piece assignment for ${charId}.`);
      }
      return `${charId}=${artifactSet.setId}`;
    })
    .sort()
    .join("|");
}

function makeFinalResult(options: GeneratorOptions) {
  const artifactsByChar = Object.fromEntries(
    options.teamBuild.configs.map(({ charId, artifactSet }) => {
      if (artifactSet?.type !== "4pc") {
        throw new Error(`Expected four-piece assignment for ${charId}.`);
      }
      return [charId, makeArtifacts(charId, artifactSet.setId)];
    }),
  );
  const sheetsByChar = Object.fromEntries(
    options.teamBuild.configs.map(({ charId }) => [charId, new StatSheet([])]),
  );
  return {
    artifactsByChar,
    sheetsByChar,
    phase: "done",
    progress: 1,
    done: true,
  };
}

function makeArtifacts(
  characterId: string,
  setId: string,
): Record<Slot, ArtifactData> {
  const mainStats: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "electro%",
    circlet: "cr",
  };
  return Object.fromEntries(
    allSlots.map((slot) => [
      slot,
      {
        id: `gen-${characterId}-${slot}`,
        setKey: setId,
        slotKey: slot,
        level: 20,
        rarity: 5,
        mainStatKey: mainStats[slot],
        lock: false,
        substats: { cd: 12.4 },
      },
    ]),
  ) as Record<Slot, ArtifactData>;
}

function collectObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectObjectKeys);
  if (value == null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectObjectKeys(child),
  ]);
}

function repositoryTarget(characterId: string, buildSourceRecordId: string) {
  return {
    kind: "repository-build",
    characterGuideId: `genshintools-presets:character-guide:${characterId}`,
    buildSourceRecordId,
  };
}
