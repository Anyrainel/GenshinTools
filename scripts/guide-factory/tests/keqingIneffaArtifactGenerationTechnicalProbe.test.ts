import path from "node:path";
import { allSlots, type MainStat, type Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { GeneratorOptions } from "@/lib/team-comp/generator/generator";
import { describe, expect, it } from "vitest";
import { runArtifactGenerationTechnicalProbe } from "../src/artifactGenerationTechnicalProbe";
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
import { KnowledgeRepositorySchema } from "../src/schemas";

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
          repositoryBuildTargetsMatchAssignment: true,
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
          ({ buildSourceRecordId }) => buildSourceRecordId.length > 0,
        ),
      ).toBe(true);
    }
    expect(report.candidates[3].changedFromSeedCharacters).toEqual([
      "furina",
      "ineffa",
    ]);
    expect(
      report.candidates.slice(0, 4).map(({ sourceBuildIdsByCharacter }) =>
        sourceBuildIdsByCharacter,
      ),
    ).toEqual([
      {
        furina: "BQAI0BO",
        ineffa: "FeFiQU8",
        keqing: "1WswsAu",
        xilonen: "Dbt0Wkm",
      },
      {
        furina: "BQA4H1m",
        ineffa: "FeFiQU8",
        keqing: "1WswsAu",
        xilonen: "Dbt0Wkm",
      },
      {
        furina: "BQAI0BO",
        ineffa: "FeFi2JG",
        keqing: "1WswsAu",
        xilonen: "Dbt0Wkm",
      },
      {
        furina: "BQA4H1m",
        ineffa: "FeFi2JG",
        keqing: "1WswsAu",
        xilonen: "Dbt0Wkm",
      },
    ]);

    expect(report.candidates[4]).toMatchObject({
      candidateId: "05-instructor-negative-control",
      outcome: "rejected-before-run",
      generatorInvoked: false,
      requestedAssignmentsSatisfied: false,
      independentValidation: {
        repositoryBuildTargetsMatchAssignment: true,
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
    expect(report.candidates[4].sourceBuildIdsByCharacter.xilonen).toBe(
      "Dbspw5m",
    );

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
