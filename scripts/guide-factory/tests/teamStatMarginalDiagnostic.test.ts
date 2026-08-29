import type { StatKey } from "@/data/enums";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import { describe, expect, it } from "vitest";
import type {
  DamageReplayInput,
  DamageReplayOutput,
  ReplayTeamConfigs,
} from "../src/computationReplay";
import {
  fingerprintTeamStatMarginalSheet,
  fingerprintTeamStatMarginalTeamConfigs,
  runTeamStatMarginalDiagnostic,
  TEAM_STAT_MARGINAL_NON_ER_STATS,
  type TeamStatMarginalDiagnosticInput,
  type TeamStatMarginalEndpointInput,
  type TeamStatMarginalNonErStat,
} from "../src/teamStatMarginalDiagnostic";

const CHARACTER_IDS = ["a", "b", "c", "d"] as const;
const CAPTURE_A = "a".repeat(64);
const CAPTURE_B = "b".repeat(64);

describe("team stat marginal diagnostic", () => {
  it("retains all non-ER endpoint marginals and range-only summaries", async () => {
    const input = buildInput();
    let replayCalls = 0;
    const report = await runTeamStatMarginalDiagnostic(input, {
      replayTeamDamage: async (replayInput) => {
        replayCalls += 1;
        return syntheticReplay(replayInput);
      },
    });

    expect(TEAM_STAT_MARGINAL_NON_ER_STATS).toEqual([
      "cr",
      "cd",
      "atk%",
      "hp%",
      "def%",
      "em",
      "atk",
      "hp",
      "def",
    ]);
    expect(TEAM_STAT_MARGINAL_NON_ER_STATS).not.toContain("er");
    expect(report.comparisonStatus).toBe("comparable");
    if (report.comparisonStatus !== "comparable") {
      throw new Error("expected comparable synthetic diagnostic");
    }
    expect(replayCalls).toBe(74);
    expect(report.execution).toEqual({
      scheduling: "sequential",
      fullDirectAndCompiledReplayPerPoint: true,
      endpointCount: 2,
      characterCountPerEndpoint: 4,
      statCountPerCharacter: 9,
      plannedReplayCount: 74,
      observedReplayCount: 74,
      allPlannedReplaysObserved: true,
      energyRecoveryEvaluationsUsed: false,
    });
    expect(report.statDomain).toMatchObject({
      energyRecoveryExcluded: true,
      perturbation: "+1-average-five-star-substat-roll",
      representsFeasibleArtifactAllocation: false,
    });
    expect(
      report.statDomain.stats.every(
        ({ stat, averageRollDelta }) =>
          stat !== ("er" as TeamStatMarginalNonErStat) &&
          Number.isFinite(averageRollDelta) &&
          averageRollDelta > 0,
      ),
    ).toBe(true);
    expect(report).toMatchObject({
      supportsGuideClaims: false,
      supportsStatRecommendations: false,
      supportsScalarStatWeights: false,
      supportsIdealStatAllocation: false,
      supportsEnergyRequirements: false,
      failures: [],
    });

    expect(report.endpoints).toHaveLength(2);
    for (const endpoint of report.endpoints) {
      expect(endpoint.outcome).toBe("evaluated");
      expect(endpoint.observedReplayCount).toBe(37);
      expect(endpoint.characters).toHaveLength(4);
      for (const character of endpoint.characters) {
        expect(character.stats.map(({ stat }) => stat)).toEqual(
          TEAM_STAT_MARGINAL_NON_ER_STATS,
        );
        expect(
          character.stats.every(
            ({ replayValidation }) =>
              replayValidation.calculatorAgreement.passed &&
              replayValidation.calculatorAgreement.absoluteDifference <=
                replayValidation.calculatorAgreement.allowedDifference,
          ),
        ).toBe(true);
      }
    }

    expect(report.sheetFingerprintMultiplicity).toMatchObject({
      endpointCount: 2,
      characters: [
        { characterId: "a", uniqueSheetFingerprintCount: 2 },
        { characterId: "b", uniqueSheetFingerprintCount: 1 },
        { characterId: "c", uniqueSheetFingerprintCount: 1 },
        { characterId: "d", uniqueSheetFingerprintCount: 1 },
      ],
    });
    expect(
      report.sheetFingerprintMultiplicity.characters[1].groups[0],
    ).toMatchObject({
      multiplicity: 2,
      endpointIds: ["endpoint-a", "endpoint-b"],
      originIds: ["carry-a", "carry-b"],
    });

    expect(report.crossEndpointSummary.aggregation).toBe(
      "ranges-only-no-survivor-averaging",
    );
    const aSummary = report.crossEndpointSummary.characters.find(
      ({ characterId }) => characterId === "a",
    );
    expect(aSummary?.stats.map(({ stat }) => stat)).toEqual(
      TEAM_STAT_MARGINAL_NON_ER_STATS,
    );
    expect(statSummary(aSummary, "cr")).toMatchObject({
      signClassification: "all-positive",
      zeroClassification: "none-zero",
      positiveEndpointIds: ["endpoint-a", "endpoint-b"],
    });
    expect(statSummary(aSummary, "cr")?.rawDeltaRange.range).toBeGreaterThan(
      0,
    );
    expect(statSummary(aSummary, "cd")).toMatchObject({
      signClassification: "mixed",
      zeroClassification: "some-zero",
      zeroEndpointIds: ["endpoint-b"],
    });
    expect(statSummary(aSummary, "atk%")).toMatchObject({
      signClassification: "all-negative",
      zeroClassification: "none-zero",
      negativeEndpointIds: ["endpoint-a", "endpoint-b"],
    });
    expect(statSummary(aSummary, "em")).toMatchObject({
      signClassification: "all-zero",
      zeroClassification: "all-zero",
      zeroEndpointIds: ["endpoint-a", "endpoint-b"],
    });
    expect(statSummary(aSummary, "cr")?.relativeDeltaRangeStatus).toBe(
      "available",
    );
    expect(statSummary(aSummary, "cr")?.normalizedRangeStatus).toBe(
      "available",
    );
  });

  it("withholds every cross-endpoint summary after one marginal replay fails", async () => {
    const input = buildInput();
    let replayCalls = 0;
    const report = await runTeamStatMarginalDiagnostic(input, {
      replayTeamDamage: async (replayInput) => {
        replayCalls += 1;
        if (replayInput.replayId === "synthetic:endpoint-a:a:cd") {
          throw new Error("deliberate marginal failure");
        }
        return syntheticReplay(replayInput);
      },
    });

    expect(replayCalls).toBe(74);
    expect(report.comparisonStatus).toBe("not-comparable");
    if (report.comparisonStatus !== "not-comparable") {
      throw new Error("expected fail-closed synthetic diagnostic");
    }
    expect(report.crossEndpointSummary).toBeNull();
    expect(report.execution).toMatchObject({
      plannedReplayCount: 74,
      observedReplayCount: 74,
      allPlannedReplaysObserved: true,
    });
    expect(report.failures).toEqual([
      expect.objectContaining({
        code: "replay-failed",
        stage: "marginal-replay",
        endpointId: "endpoint-a",
        characterId: "a",
        stat: "cd",
        message: "deliberate marginal failure",
      }),
    ]);
    expect(report.endpoints.map(({ outcome }) => outcome)).toEqual([
      "not-comparable",
      "evaluated",
    ]);
    expect(report.sheetFingerprintMultiplicity).not.toBeNull();
  });

  it("rejects a capture fingerprint mismatch before invoking any replay", async () => {
    const input = buildInput();
    input.endpoints[1].sheetFingerprintsByCharacter.a = "f".repeat(64);
    let replayCalls = 0;
    const report = await runTeamStatMarginalDiagnostic(input, {
      replayTeamDamage: async (replayInput) => {
        replayCalls += 1;
        return syntheticReplay(replayInput);
      },
    });

    expect(replayCalls).toBe(0);
    expect(report.comparisonStatus).toBe("not-comparable");
    if (report.comparisonStatus !== "not-comparable") {
      throw new Error("expected capture rejection");
    }
    expect(report.crossEndpointSummary).toBeNull();
    expect(report.sheetFingerprintMultiplicity).toBeNull();
    expect(report.execution).toMatchObject({
      plannedReplayCount: 74,
      observedReplayCount: 0,
      allPlannedReplaysObserved: false,
    });
    expect(report.failures).toEqual([
      expect.objectContaining({
        code: "sheet-fingerprint-mismatch",
        stage: "capture-validation",
        endpointId: "endpoint-b",
        characterId: "a",
      }),
    ]);
    expect(report.endpoints).toHaveLength(2);
    expect(report.endpoints.every(({ outcome }) => outcome === "not-comparable"))
      .toBe(true);
  });

  it("turns a calculator-disagreeing replay output into a typed failure", async () => {
    const input = buildInput();
    const report = await runTeamStatMarginalDiagnostic(input, {
      replayTeamDamage: async (replayInput) => {
        const output = syntheticReplay(replayInput);
        if (replayInput.replayId === "synthetic:endpoint-b:baseline") {
          output.validation.calculatorAgreement.absoluteDifference = 2;
          output.validation.calculatorAgreement.allowedDifference = 10;
          output.result.totalDamage += 1;
        }
        return output;
      },
    });

    expect(report.comparisonStatus).toBe("not-comparable");
    if (report.comparisonStatus !== "not-comparable") {
      throw new Error("expected invalid replay output rejection");
    }
    expect(report.crossEndpointSummary).toBeNull();
    expect(report.failures).toEqual([
      expect.objectContaining({
        code: "replay-output-invalid",
        stage: "baseline-replay",
        endpointId: "endpoint-b",
      }),
    ]);
    expect(report.execution).toMatchObject({
      plannedReplayCount: 74,
      observedReplayCount: 38,
      allPlannedReplaysObserved: false,
    });
  });

  it("keeps zero objectives explicit without inventing relative or normalized values", async () => {
    const report = await runTeamStatMarginalDiagnostic(buildInput(), {
      replayTeamDamage: async (replayInput) => {
        const output = syntheticReplay(replayInput);
        output.validation.calculatorAgreement = {
          passed: true,
          directTotalDamage: 0,
          compiledTotalDamage: 0,
          absoluteDifference: 0,
          allowedDifference: 1e-9,
        };
        output.result = {
          totalDamage: 0,
          lineDamages: output.result.lineDamages.map((line) => ({
            ...line,
            perHit: 0,
            total: 0,
          })),
        };
        return output;
      },
    });

    expect(report.comparisonStatus).toBe("comparable");
    if (report.comparisonStatus !== "comparable") {
      throw new Error("expected comparable zero diagnostic");
    }
    for (const endpoint of report.endpoints) {
      for (const character of endpoint.characters) {
        expect(character.maxPositiveRawDelta).toBeNull();
        expect(character.normalizationStatus).toBe(
          "undefined-no-positive-character-marginal",
        );
        expect(
          character.stats.every(
            (stat) =>
              stat.rawDelta === 0 &&
              stat.relativeDeltaToBaseline === null &&
              stat.relativeDeltaStatus === "undefined-zero-baseline" &&
              stat.withinCharacterNormalizedToMaxPositive === null &&
              stat.normalizationStatus ===
                "undefined-no-positive-character-marginal" &&
              stat.sign === "zero",
          ),
        ).toBe(true);
      }
    }
    expect(
      report.crossEndpointSummary.characters.every(({ stats }) =>
        stats.every(
          (stat) =>
            stat.signClassification === "all-zero" &&
            stat.zeroClassification === "all-zero" &&
            stat.relativeDeltaRange === null &&
            stat.relativeDeltaRangeStatus ===
              "unavailable-at-one-or-more-endpoints" &&
            stat.normalizedRange === null &&
            stat.normalizedRangeStatus ===
              "unavailable-at-one-or-more-endpoints",
        ),
      ),
    ).toBe(true);
  });

  it("throws for duplicate endpoints and invalid explicit tolerances", async () => {
    const duplicate = buildInput();
    duplicate.endpoints[1].endpointId = duplicate.endpoints[0].endpointId;
    await expect(runTeamStatMarginalDiagnostic(duplicate)).rejects.toThrow(
      "endpoint IDs must be non-empty and unique",
    );

    const invalidTolerance = buildInput();
    invalidTolerance.zeroTolerance.relative = Number.NaN;
    await expect(
      runTeamStatMarginalDiagnostic(invalidTolerance),
    ).rejects.toThrow("zero tolerance relative must be finite and non-negative");
  });
});

function buildInput(): TeamStatMarginalDiagnosticInput {
  const teamConfigs = CHARACTER_IDS.map(
    (charId): TeamSlotConfig => ({
      charId,
      charLevel: 90,
      constellation: 0,
      weaponId: `weapon-${charId}`,
      refinement: 1,
      artifactSet: null,
      talentLevels: { auto: 10, skill: 10, burst: 10 },
    }),
  ) as unknown as ReplayTeamConfigs;
  const sharedSheets = {
    b: new StatSheet([{ key: "cr", value: 0.25 }]),
    c: new StatSheet([{ key: "cd", value: 0.5 }]),
    d: new StatSheet([{ key: "def%", value: 0.4 }]),
  };
  const endpointA = buildEndpoint(
    "endpoint-a",
    "carry-a",
    CAPTURE_A,
    teamConfigs,
    {
      a: new StatSheet([
        { key: "cr", value: 0 },
        { key: "cd", value: 0.5 },
        { key: "atk%", value: 0.2 },
      ]),
      ...sharedSheets,
    },
  );
  const endpointB = buildEndpoint(
    "endpoint-b",
    "carry-b",
    CAPTURE_B,
    teamConfigs,
    {
      a: new StatSheet([
        { key: "cr", value: 1 },
        { key: "cd", value: 1 },
        { key: "atk%", value: 0.4 },
      ]),
      ...sharedSheets,
    },
  );
  return {
    diagnosticId: "synthetic",
    generatedFrom: [],
    evidence: {
      classification: "structural_smoke",
      supportsGuideClaims: false,
      notes: ["Synthetic marginal diagnostic test."],
      sourceRefs: [],
    },
    objective: {
      combatOptions: {},
      enemyAura: null,
      extraBuffs: [],
      calcContext: {
        enemyLevel: 110,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
      combo: {
        id: "synthetic-objective",
        label: { en: "Synthetic", zh: "Synthetic" },
        lines: [
          {
            charId: "a",
            formulaId: "synthetic-a",
            count: 1,
            reaction: null,
            forceOnField: false,
          },
        ],
      },
      formulaBuffOverrides: null,
    },
    zeroTolerance: { absolute: 1e-9, relative: 1e-12 },
    endpoints: [endpointA, endpointB],
  };
}

function buildEndpoint(
  endpointId: string,
  originId: string,
  captureFingerprintSha256: string,
  teamConfigs: ReplayTeamConfigs,
  artifactSheets: Record<string, StatSheet>,
): TeamStatMarginalEndpointInput {
  return {
    endpointId,
    originId,
    captureFingerprintSha256,
    teamConfigsFingerprintSha256:
      fingerprintTeamStatMarginalTeamConfigs(teamConfigs),
    sheetFingerprintsByCharacter: Object.fromEntries(
      Object.entries(artifactSheets).map(([characterId, sheet]) => [
        characterId,
        fingerprintTeamStatMarginalSheet(sheet),
      ]),
    ),
    teamConfigs,
    artifactSheets,
  };
}

function syntheticReplay(input: DamageReplayInput): DamageReplayOutput {
  const totalDamage = syntheticObjective(input.artifactSheets);
  return {
    schemaVersion: 1,
    replayId: input.replayId,
    evidence: input.evidence,
    inputs: {
      teamConfigs: input.teamConfigs.map((config) => ({ ...config })),
      combatOptions: { ...input.combatOptions },
      enemyAura: input.enemyAura,
      extraBuffs: input.extraBuffs.map((buff) => ({
        ...buff,
        stats: buff.stats.map((stat) => ({ ...stat })),
      })),
      calcContext: { ...input.calcContext },
      combo: {
        ...input.combo,
        label: { ...input.combo.label },
        lines: input.combo.lines.map((line) => ({ ...line })),
      },
      formulaBuffOverrides: input.formulaBuffOverrides,
      artifactSheets: Object.fromEntries(
        Object.entries(input.artifactSheets).map(([characterId, sheet]) => [
          characterId,
          [...sheet.dump()].map((entry) => ({ ...entry })),
        ]),
      ),
    },
    validation: {
      formulaCoverage: input.combo.lines.map(({ charId, formulaId }) => ({
        charId,
        formulaId,
        available: true,
      })),
      computedBuffOverrides: {},
      calculatorAgreement: {
        passed: true,
        directTotalDamage: totalDamage,
        compiledTotalDamage: totalDamage,
        absoluteDifference: 0,
        allowedDifference: 1e-8,
      },
    },
    result: {
      totalDamage,
      lineDamages: input.combo.lines.map(({ charId, formulaId, count }) => ({
        charId,
        formulaId,
        count,
        perHit: totalDamage / count,
        total: totalDamage,
      })),
    },
  };
}

function syntheticObjective(sheets: Record<string, StatSheet>): number {
  let total = 10_000;
  for (const characterId of CHARACTER_IDS) {
    const sheet = sheets[characterId];
    for (const stat of TEAM_STAT_MARGINAL_NON_ER_STATS) {
      const value = sheet.getRaw(stat as StatKey);
      if (characterId === "a" && stat === "cr") {
        total += 100 * value * value;
      } else if (characterId === "a" && stat === "cd") {
        total += 20 * Math.min(value, 1);
      } else if (characterId === "a" && stat === "atk%") {
        total -= 2 * value;
      } else if (characterId === "a" && stat === "em") {
        total += 1e-12 * value;
      } else if (characterId === "a" && stat === "hp%") {
        total += 0;
      } else {
        total += value;
      }
    }
  }
  return total;
}

function statSummary(
  character:
    | {
        stats: Array<{
          stat: TeamStatMarginalNonErStat;
          rawDeltaRange: { range: number };
          signClassification: string;
          zeroClassification: string;
          relativeDeltaRangeStatus: string;
          normalizedRangeStatus: string;
        }>;
      }
    | undefined,
  stat: TeamStatMarginalNonErStat,
) {
  return character?.stats.find((summary) => summary.stat === stat);
}
