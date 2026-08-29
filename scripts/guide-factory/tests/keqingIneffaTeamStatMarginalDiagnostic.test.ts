import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  runGenerator as runRuntimeGenerator,
  type GeneratorOptions,
} from "@/lib/team-comp/generator/generator";
import { describe, expect, it } from "vitest";
import { replayTeamDamage as replayRuntimeTeamDamage } from "../src/computationReplay";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID,
  KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
  runKeqingIneffaTeamStatMarginalDiagnostic,
} from "../src/keqingIneffaTeamStatMarginalDiagnostic";
import {
  KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "../src/paths";
import { KnowledgeRepositorySchema } from "../src/schemas";
import { TEAM_STAT_MARGINAL_NON_ER_STATS } from "../src/teamStatMarginalDiagnostic";

const realReportPromise = buildRealReport();

describe("Keqing-Ineffa team-stat marginal diagnostic", () => {
  it("captures four fresh endpoints and preserves raw non-ER marginal ranges", async () => {
    const report = await realReportPromise;

    expect(report).toMatchObject({
      classification: "keqing-ineffa-team-stat-marginal-technical-diagnostic",
      comparisonStatus: "comparable",
      supportsGuideClaims: false,
      supportsStatRecommendations: false,
      supportsScalarStatWeights: false,
      supportsIdealStatAllocation: false,
      supportsOptimalityClaims: false,
      supportsEnergyRequirements: false,
      fixedCandidate: {
        candidateId: KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID,
        exactTeamSourceBindsCandidateEquipment: false,
      },
      technicalObjectiveProvenance: {
        reviewStatus: "unreviewed",
        formulaLineCount: 11,
        exactClaimCount: 11,
        completeTokenMappingCount: 10,
        partialTokenMappingCount: 1,
        reactionLineCount: 0,
        explicitFormulaBuffOverrides: null,
        readiness: {
          readyForDamageReplay: false,
          blockerCount: 8,
        },
      },
      capture: {
        scheduling: "sequential",
        plannedGeneratorInvocations: 4,
        observedGeneratorInvocations: 4,
        maximumGeneratorConcurrency: 1,
        freshTeamBuildPerInvocation: true,
        warmStartSupported: false,
        energyRecoveryThresholdsUsed: false,
        perCharacterConstraintsPassed: false,
        capturedSheetsMayContainIncidentalEnergyRecovery: true,
        incidentalEnergyRecoveryRetainedOnlyInOperatingPointFingerprint: true,
        incidentalEnergyRecoveryAnalyzedOrInterpreted: false,
        domainValidation: {
          expectedCarryCharacterIds: ["keqing", "ineffa", "furina", "xilonen"],
          actualCarryCharacterIds: ["keqing", "ineffa", "furina", "xilonen"],
          exactUniqueCarrySetObserved: true,
          exactRunCountObserved: true,
          exactGeneratorInvocationCountObserved: true,
          sequentialConcurrencyObserved: true,
          observedReactionFormulaLineCounts: [
            { carryCharacterId: "keqing", count: 0 },
            { carryCharacterId: "ineffa", count: 0 },
            { carryCharacterId: "furina", count: 0 },
            { carryCharacterId: "xilonen", count: 0 },
          ],
          exactReactionFreeFormulaDomainObserved: true,
        },
      },
    });
    expect(report.capture.runs).toHaveLength(4);
    expect(
      report.capture.runs.every(
        (run) =>
          run.outcome === "captured" &&
          run.reactionFormulaLineCount === 0 &&
          /^[a-f0-9]{64}$/.test(run.artifactFingerprintSha256) &&
          /^[a-f0-9]{64}$/.test(run.teamConfigsFingerprintSha256) &&
          Object.keys(run.sheetFingerprintsByCharacter).length === 4,
      ),
    ).toBe(true);

    const diagnostic = report.marginalDiagnostic;
    expect(diagnostic?.comparisonStatus).toBe("comparable");
    if (!diagnostic || diagnostic.comparisonStatus !== "comparable") {
      throw new Error("Expected a comparable real stat-marginal diagnostic.");
    }
    expect(diagnostic.execution).toMatchObject({
      endpointCount: 4,
      characterCountPerEndpoint: 4,
      statCountPerCharacter: 9,
      plannedReplayCount: 148,
      observedReplayCount: 148,
      allPlannedReplaysObserved: true,
      fullDirectAndCompiledReplayPerPoint: true,
      energyRecoveryEvaluationsUsed: false,
    });
    expect(diagnostic.statDomain.stats.map(({ stat }) => stat)).toEqual(
      TEAM_STAT_MARGINAL_NON_ER_STATS,
    );
    expect(collectStatFields(report)).not.toContain("er");
    expect(
      diagnostic.endpoints.every(
        (endpoint) =>
          endpoint.outcome === "evaluated" &&
          endpoint.observedReplayCount === 37 &&
          endpoint.characters.every(
            (character) =>
              character.stats.map(({ stat }) => stat).join("\0") ===
              TEAM_STAT_MARGINAL_NON_ER_STATS.join("\0"),
          ),
      ),
    ).toBe(true);

    expect(
      diagnostic.sheetFingerprintMultiplicity.characters.map(
        ({ characterId, uniqueSheetFingerprintCount }) => ({
          characterId,
          uniqueSheetFingerprintCount,
        }),
      ),
    ).toEqual([
      { characterId: "keqing", uniqueSheetFingerprintCount: 2 },
      { characterId: "ineffa", uniqueSheetFingerprintCount: 1 },
      { characterId: "furina", uniqueSheetFingerprintCount: 2 },
      { characterId: "xilonen", uniqueSheetFingerprintCount: 2 },
    ]);

    const keqingCr = requireCrossStat(diagnostic, "keqing", "cr");
    expect(keqingCr).toMatchObject({
      signClassification: "all-positive",
      zeroClassification: "none-zero",
    });
    expect(keqingCr.normalizedRange?.min).toBeCloseTo(0.216991660967273);
    expect(keqingCr.normalizedRange?.max).toBeCloseTo(0.912417333095598);

    const furinaCr = requireCrossStat(diagnostic, "furina", "cr");
    expect(furinaCr).toMatchObject({
      signClassification: "mixed",
      zeroClassification: "some-zero",
      positiveEndpointIds: [
        "carry-keqing",
        "carry-ineffa",
        "carry-xilonen",
      ],
      zeroEndpointIds: ["carry-furina"],
      negativeEndpointIds: [],
    });
    expect(requireCrossStat(diagnostic, "xilonen", "def%")).toMatchObject({
      signClassification: "all-positive",
      zeroClassification: "none-zero",
    });
  }, 120_000);

  it("keeps baseline priority bands categorical and treats zero EM as objective coverage", async () => {
    const report = await realReportPromise;
    const overlap = report.sourcePriorityOverlap;
    expect(overlap).not.toBeNull();
    if (!overlap) throw new Error("Expected source-priority overlap output.");

    expect(overlap).toMatchObject({
      classification: "genshintools-baseline-priority-overlap-diagnostic",
      supportsGuideClaims: false,
      supportsStatPriorityClaims: false,
      sourceBandNamespace: "genshintools-baseline-build-priority",
      sourceBandsAreNumericallyComparableToMarginalValues: false,
      technicalAggregation: "ranges-only-no-survivor-averaging",
    });
    expect(
      overlap.characters.map(
        ({ characterId, excludedPriorityEntryCount }) => ({
          characterId,
          excludedPriorityEntryCount,
        }),
      ),
    ).toEqual([
      { characterId: "keqing", excludedPriorityEntryCount: 0 },
      { characterId: "ineffa", excludedPriorityEntryCount: 0 },
      { characterId: "furina", excludedPriorityEntryCount: 1 },
      { characterId: "xilonen", excludedPriorityEntryCount: 1 },
    ]);
    expect(
      overlap.objectiveCoverageReview.map(
        ({
          characterId,
          stat,
          genshinToolsBaselinePriorityBand,
          technicalZeroClassification,
        }) => ({
          characterId,
          stat,
          genshinToolsBaselinePriorityBand,
          technicalZeroClassification,
        }),
      ),
    ).toEqual([
      {
        characterId: "keqing",
        stat: "em",
        genshinToolsBaselinePriorityBand: 75,
        technicalZeroClassification: "all-zero",
      },
      {
        characterId: "ineffa",
        stat: "em",
        genshinToolsBaselinePriorityBand: 50,
        technicalZeroClassification: "all-zero",
      },
    ]);
    expect(
      overlap.objectiveCoverageReview.every(
        ({ classification, reason }) =>
          classification === "objective-coverage-review" &&
          reason.includes("no reaction lines or reaction overrides"),
      ),
    ).toBe(true);
    expect(overlap.operatingPointSensitivityReview).toEqual([
      {
        characterId: "furina",
        stat: "cr",
        genshinToolsBaselinePriorityBand: 100,
        technicalSignClassification: "mixed",
        technicalZeroClassification: "some-zero",
        positiveEndpointIds: [
          "carry-keqing",
          "carry-ineffa",
          "carry-xilonen",
        ],
        zeroEndpointIds: ["carry-furina"],
        negativeEndpointIds: [],
        classification: "operating-point-sensitivity-review",
        reason:
          "Tolerance-aware sign or zero classification changes across the four captured endpoints, so the local marginal is operating-point-sensitive and cannot support a single priority conclusion.",
      },
    ]);
  }, 120_000);

  it("preserves a generator failure, finishes later captures, and withholds every replay summary", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    let generatorInvocation = 0;
    let replayInvocation = 0;
    const report = await runKeqingIneffaTeamStatMarginalDiagnostic(
      repository,
      [],
      {
        runGenerator: (options: GeneratorOptions) => {
          generatorInvocation += 1;
          if (generatorInvocation === 1) {
            return (async function* () {
              throw new TypeError("injected stat-marginal capture failure");
            })();
          }
          return runRuntimeGenerator(options);
        },
        replayTeamDamage: async (input) => {
          replayInvocation += 1;
          return replayRuntimeTeamDamage(input);
        },
      },
    );

    expect(generatorInvocation).toBe(4);
    expect(replayInvocation).toBe(0);
    expect(report).toMatchObject({
      comparisonStatus: "not-comparable",
      capture: {
        observedGeneratorInvocations: 4,
        maximumGeneratorConcurrency: 1,
        runs: [
          {
            carryCharacterId: "keqing",
            endpointId: "carry-keqing",
            outcome: "not-comparable",
            failure: {
              code: "generator-failed",
              stage: "generator",
              name: "TypeError",
              message: "injected stat-marginal capture failure",
            },
          },
          { carryCharacterId: "ineffa", outcome: "captured" },
          { carryCharacterId: "furina", outcome: "captured" },
          { carryCharacterId: "xilonen", outcome: "captured" },
        ],
      },
      marginalDiagnostic: null,
      sourcePriorityOverlap: null,
    });
  }, 120_000);

  it("keeps the durable report byte-stable with current inputs", async () => {
    const expected = await realReportPromise;
    const saved = await readFile(
      KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_REPORT_PATH,
      "utf8",
    );
    expect(saved).toBe(stableJson(expected));
  }, 120_000);
});

async function buildRealReport() {
  const repository = KnowledgeRepositorySchema.parse(
    await readJson(KNOWLEDGE_REPOSITORY_PATH),
  );
  const generatedFrom = await Promise.all(
    KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  );
  return runKeqingIneffaTeamStatMarginalDiagnostic(
    repository,
    generatedFrom,
  );
}

function requireCrossStat(
  diagnostic: Extract<
    Awaited<ReturnType<typeof runKeqingIneffaTeamStatMarginalDiagnostic>>["marginalDiagnostic"],
    { comparisonStatus: "comparable" }
  >,
  characterId: string,
  stat: string,
) {
  const observation = diagnostic.crossEndpointSummary.characters
    .find((character) => character.characterId === characterId)
    ?.stats.find((candidate) => candidate.stat === stat);
  if (!observation) {
    throw new Error(`Missing cross-endpoint stat ${characterId}/${stat}.`);
  }
  return observation;
}

function collectStatFields(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectStatFields);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) => [
    ...(key === "stat" && typeof nested === "string" ? [nested] : []),
    ...collectStatFields(nested),
  ]);
}
