import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import { allSlots, type MainStat, type Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import {
  runGenerator as runRuntimeGenerator,
  type GeneratorOptions,
} from "@/lib/team-comp/generator/generator";
import { describe, expect, it } from "vitest";
import { fingerprintGeneratedArtifacts } from "../src/artifactGenerationSensitivityProbe";
import { ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT } from "../src/artifactGenerationTechnicalProbe";
import {
  KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_INPUT_PATHS,
  KEQING_INEFFA_SENSITIVITY_FIRST_CANDIDATE_ID,
  KEQING_INEFFA_SENSITIVITY_SECOND_CANDIDATE_ID,
  runKeqingIneffaArtifactGenerationSensitivityProbe,
} from "../src/keqingIneffaArtifactGenerationSensitivityProbe";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "../src/paths";
import { KnowledgeRepositorySchema } from "../src/schemas";

describe("Keqing-Ineffa artifact-generation sensitivity probe", () => {
  it("repeats deterministically and exposes the current carry/order structure", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const first = await runKeqingIneffaArtifactGenerationSensitivityProbe(
      repository,
    );
    const second = await runKeqingIneffaArtifactGenerationSensitivityProbe(
      repository,
    );

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      classification: "artifact-generation-carry-and-order-sensitivity-probe",
      supportsGuideClaims: false,
      supportsArtifactRecommendations: false,
      supportsRankClaims: false,
      supportsPerformanceComparison: false,
      provenance: {
        classification: "interpolation-from-independent-repository-builds",
        exactTeamSourceBindsCandidateEquipment: false,
      },
      execution: {
        scheduling: "sequential",
        plannedGeneratorInvocations: 7,
        observedGeneratorInvocations: 7,
        freshTeamBuildPerInvocation: true,
        energyRecoveryThresholdsUsed: false,
        perCharacterConstraintsPassed: false,
        formulaBuffOverridesPassed: false,
        numericalObjectiveRetained: false,
        calcContext: ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT,
      },
    });
    expect(first.runs).toHaveLength(7);
    expect(first.runs.map(({ sequence }) => sequence)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(
      first.runs.every(
        (run) =>
          run.outcome === "captured-structurally" &&
          /^[a-f0-9]{64}$/.test(run.fingerprint.sha256) &&
          run.structuralSummary.length === 4 &&
          run.structuralSummary.every(({ slots }) => slots.length === 5),
      ),
    ).toBe(true);

    expect(first.carrySensitivity).toMatchObject({
      candidateId: KEQING_INEFFA_SENSITIVITY_FIRST_CANDIDATE_ID,
      comparisonStatus: "comparable",
      artifactOutputDifferenceObserved: true,
      structuralSummaryDifferenceObserved: true,
      notComparableRunIds: [],
      equivalenceClasses: [
        { carryCharacterIds: ["keqing", "ineffa"] },
        { carryCharacterIds: ["furina"] },
        { carryCharacterIds: ["xilonen"] },
      ],
    });
    expect(
      first.carrySensitivity.equivalenceClasses.map(
        ({ fingerprintSha256 }) => fingerprintSha256,
      ),
    ).toHaveLength(3);
    expect(
      new Set(
        first.carrySensitivity.equivalenceClasses.map(
          ({ fingerprintSha256 }) => fingerprintSha256,
        ),
      ).size,
    ).toBe(3);

    const [ineffaDifference, furinaDifference, xilonenDifference] =
      first.carrySensitivity.structuralSummaryDifferencesFromPrimary;
    expect(ineffaDifference).toMatchObject({
      comparedCarryCharacterId: "ineffa",
      comparisonStatus: "comparable",
      changedSlots: [],
    });
    expect(furinaDifference).toMatchObject({
      comparedCarryCharacterId: "furina",
      comparisonStatus: "comparable",
    });
    expect(furinaDifference.changedSlots).toHaveLength(2);
    expect(furinaDifference.changedSlots).toEqual(
      expect.arrayContaining([
        {
          characterId: "furina",
          slot: "circlet",
          primary: {
            mainStat: "cr",
            positiveSubstatKeys: ["cd", "em", "hp", "hp%"],
          },
          compared: {
            mainStat: "cd",
            positiveSubstatKeys: ["cr", "em", "hp", "hp%"],
          },
        },
      ]),
    );
    expect(xilonenDifference).toMatchObject({
      comparedCarryCharacterId: "xilonen",
      comparisonStatus: "comparable",
    });
    expect(xilonenDifference.changedSlots).toHaveLength(2);
    expect(xilonenDifference.changedSlots).toEqual(
      expect.arrayContaining([
        {
          characterId: "xilonen",
          slot: "circlet",
          primary: {
            mainStat: "def%",
            positiveSubstatKeys: ["atk%", "cd", "cr", "def"],
          },
          compared: {
            mainStat: "cd",
            positiveSubstatKeys: ["atk%", "cr", "def", "def%"],
          },
        },
      ]),
    );

    expect(first.candidateExecutionOrderSensitivity).toMatchObject({
      comparisonStatus: "comparable",
      scheduleOrderSensitivityObserved: false,
      comparisons: [
        {
          candidateId: KEQING_INEFFA_SENSITIVITY_FIRST_CANDIDATE_ID,
          comparisonStatus: "comparable",
          fingerprintsEqual: true,
          structuralSummariesEqual: true,
          scheduleOrderSensitivityObserved: false,
        },
        {
          candidateId: KEQING_INEFFA_SENSITIVITY_SECOND_CANDIDATE_ID,
          comparisonStatus: "comparable",
          fingerprintsEqual: true,
          structuralSummariesEqual: true,
          scheduleOrderSensitivityObserved: false,
        },
      ],
    });

    const keys = collectObjectKeys(first).map((key) => key.toLowerCase());
    expect(keys).not.toContain("artifactsbychar");
    expect(keys).not.toContain("substats");
    expect(keys).not.toContain("damage");
    expect(keys).not.toContain("score");
    expect(keys).not.toContain("ranking");
    expect(keys).not.toContain("winner");
  }, 120_000);

  it("uses exactly seven fresh TeamBuilds and omits constraints and overrides", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const teamBuilds: TeamBuild[] = [];
    const optionObservations: Array<{
      carryCharacterId: string;
      assignment: string;
      hasPerChar: boolean;
      hasIgnoreArtifactSets: boolean;
      hasSetKeysOverride: boolean;
      hasBuffOverrides: boolean;
    }> = [];

    const report = await runKeqingIneffaArtifactGenerationSensitivityProbe(
      repository,
      [],
      {
        runGenerator: (options) => {
          teamBuilds.push(options.teamBuild);
          optionObservations.push(observeOptions(options));
          return runRuntimeGenerator(options);
        },
      },
    );

    expect(report.execution.observedGeneratorInvocations).toBe(7);
    expect(teamBuilds).toHaveLength(7);
    expect(new Set(teamBuilds).size).toBe(7);
    expect(optionObservations.map(({ carryCharacterId }) => carryCharacterId))
      .toEqual([
        "keqing",
        "keqing",
        "keqing",
        "keqing",
        "ineffa",
        "furina",
        "xilonen",
      ]);
    expect(optionObservations.map(({ assignment }) => assignment)).toEqual([
      "A",
      "B",
      "B",
      "A",
      "A",
      "A",
      "A",
    ]);
    expect(
      optionObservations.every(
        ({
          hasPerChar,
          hasIgnoreArtifactSets,
          hasSetKeysOverride,
          hasBuffOverrides,
        }) =>
          !hasPerChar &&
          !hasIgnoreArtifactSets &&
          !hasSetKeysOverride &&
          !hasBuffOverrides,
      ),
    ).toBe(true);
  }, 120_000);

  it("marks affected sensitivity cells not-comparable and continues", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    let invocation = 0;
    const report = await runKeqingIneffaArtifactGenerationSensitivityProbe(
      repository,
      [],
      {
        runGenerator: (options) => {
          invocation++;
          if (invocation === 1) {
            return (async function* () {
              throw new TypeError("injected first sensitivity run failure");
            })();
          }
          return runRuntimeGenerator(options);
        },
      },
    );

    expect(invocation).toBe(7);
    expect(report.runs).toHaveLength(7);
    expect(report.runs[0]).toMatchObject({
      outcome: "not-comparable",
      generatorInvoked: true,
      teamBuildFreshForInvocation: true,
      failure: {
        code: "generator-failed",
        stage: "generator",
        name: "TypeError",
        message: "injected first sensitivity run failure",
      },
    });
    expect(
      report.runs.slice(1).every(({ outcome }) =>
        outcome === "captured-structurally",
      ),
    ).toBe(true);
    expect(report.carrySensitivity).toMatchObject({
      comparisonStatus: "not-comparable",
      artifactOutputDifferenceObserved: null,
      structuralSummaryDifferenceObserved: null,
      notComparableRunIds: [report.runs[0].runId],
    });
    expect(report.candidateExecutionOrderSensitivity).toMatchObject({
      comparisonStatus: "not-comparable",
      scheduleOrderSensitivityObserved: null,
      comparisons: [
        {
          candidateId: KEQING_INEFFA_SENSITIVITY_FIRST_CANDIDATE_ID,
          comparisonStatus: "not-comparable",
          fingerprintsEqual: null,
          structuralSummariesEqual: null,
          scheduleOrderSensitivityObserved: null,
          notComparableRunIds: [report.runs[0].runId],
        },
        {
          candidateId: KEQING_INEFFA_SENSITIVITY_SECOND_CANDIDATE_ID,
          comparisonStatus: "comparable",
        },
      ],
    });
  }, 120_000);

  it("keeps the durable report byte-stable with current inputs", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const generatedFrom = await Promise.all(
      KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    );
    const expected =
      await runKeqingIneffaArtifactGenerationSensitivityProbe(
        repository,
        generatedFrom,
      );
    const saved = await readFile(
      KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_REPORT_PATH,
      "utf8",
    );

    expect(saved).toBe(stableJson(expected));
  }, 120_000);

  it("includes every enumerable artifact field in the complete fingerprint", () => {
    const baseline = syntheticArtifacts();
    const withFutureField = structuredClone(baseline) as typeof baseline;
    (withFutureField.keqing.flower as ArtifactData & {
      futureArtifactField: string;
    }).futureArtifactField = "must-affect-the-fingerprint";

    expect(fingerprintGeneratedArtifacts(withFutureField)).not.toBe(
      fingerprintGeneratedArtifacts(baseline),
    );
  });
});

function syntheticArtifacts(): Record<string, Record<Slot, ArtifactData>> {
  const mainStats: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "electro%",
    circlet: "cr",
  };
  return {
    keqing: Object.fromEntries(
      allSlots.map((slot) => [
        slot,
        {
          id: `sensitivity-test-${slot}`,
          setKey: "thundering_fury",
          slotKey: slot,
          level: 20,
          rarity: 5,
          mainStatKey: mainStats[slot],
          lock: false,
          substats: { cd: 12.4 },
        },
      ]),
    ) as Record<Slot, ArtifactData>,
  };
}

function observeOptions(options: GeneratorOptions): {
  carryCharacterId: string;
  assignment: string;
  hasPerChar: boolean;
  hasIgnoreArtifactSets: boolean;
  hasSetKeysOverride: boolean;
  hasBuffOverrides: boolean;
} {
  const byCharacter = Object.fromEntries(
    options.teamBuild.configs.map((config) => {
      if (config.artifactSet?.type !== "4pc") {
        throw new Error(`Expected four-piece set for ${config.charId}.`);
      }
      return [config.charId, config.artifactSet.setId];
    }),
  );
  const assignment =
    byCharacter.ineffa === "aubade_of_morningstar_and_moon" &&
    byCharacter.furina === "golden_troupe"
      ? "A"
      : byCharacter.ineffa === "silken_moons_serenade" &&
          byCharacter.furina === "tenacity_of_the_millelith"
        ? "B"
        : "unexpected";
  return {
    carryCharacterId: options.carryCharId,
    assignment,
    hasPerChar: Object.hasOwn(options, "perChar"),
    hasIgnoreArtifactSets: Object.hasOwn(options, "ignoreArtifactSets"),
    hasSetKeysOverride: Object.hasOwn(options, "setKeysByChar"),
    hasBuffOverrides: options.combo.buffOverrides != null,
  };
}

function collectObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectObjectKeys);
  if (value == null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectObjectKeys(child),
  ]);
}
