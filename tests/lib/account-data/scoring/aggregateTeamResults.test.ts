/**
 * Tests for aggregateTeamResults — the function that merges multiple
 * single-team auto-tune results into a final AutoTuneOutput.
 */

import type { MainStat, SubStat } from "@/data/types";
import type { AutoTuneTeamResult } from "@/lib/account-data/scoring/pipeline";
import { aggregateTeamResults } from "@/lib/account-data/scoring/pipeline";
import { describe, expect, it } from "vitest";

// ─── Helpers ───

const ZERO_ROLLS: Record<SubStat, number> = {
  cr: 0,
  cd: 0,
  "atk%": 0,
  "hp%": 0,
  "def%": 0,
  em: 0,
  er: 0,
  atk: 0,
  hp: 0,
  def: 0,
};

function makeRolls(
  overrides: Partial<Record<SubStat, number>>
): Record<SubStat, number> {
  return { ...ZERO_ROLLS, ...overrides };
}

function makeWeights(
  overrides: Partial<Record<SubStat, number>>
): Record<SubStat, number> {
  return { ...ZERO_ROLLS, ...overrides };
}

/**
 * Build a single-team result with one qualifying combo.
 * normalizedDamage defaults to 1.0 (best combo).
 */
function makeTeamResult(opts: {
  teamIndex: number;
  label: string;
  sands?: MainStat;
  goblet?: MainStat;
  circlet?: MainStat;
  weights: Partial<Record<SubStat, number>>;
  rolls: Partial<Record<SubStat, number>>;
  finalDamage: number;
  normalizedDamage?: number;
}): AutoTuneTeamResult {
  return {
    qualifying: [
      {
        sands: opts.sands ?? "atk%",
        goblet: opts.goblet ?? "pyro%",
        circlet: opts.circlet ?? "cr",
        tuneResult: {
          weights: makeWeights(opts.weights),
          rollAllocation: makeRolls(opts.rolls),
          midpointMarginals: makeWeights(opts.weights),
          finalDamage: opts.finalDamage,
        },
        normalizedDamage: opts.normalizedDamage ?? 1.0,
      },
    ],
    teamBreakdown: {
      teamIndex: opts.teamIndex,
      label: opts.label,
      combos: [],
      bestDamage: opts.finalDamage,
    },
  };
}

// ─── Tests ───

describe("aggregateTeamResults", () => {
  it("should produce output with correct structure from a single team", () => {
    const teamResult = makeTeamResult({
      teamIndex: 0,
      label: "Team A",
      weights: { cr: 100, cd: 95, "atk%": 80, em: 45 },
      rolls: { cr: 8, cd: 12, "atk%": 6, em: 4 },
      finalDamage: 50000,
    });

    const output = aggregateTeamResults([teamResult], "hutao", "Pyro");

    // Should have substats filtered to >20
    expect(output.substats.length).toBeGreaterThanOrEqual(2);
    // Max substat weight should be 100
    const maxWeight = Math.max(...output.substats.map((s) => s.weight));
    expect(maxWeight).toBe(100);

    // Main stat weights should exist
    expect(output.sandsWeights.length).toBeGreaterThanOrEqual(1);
    expect(output.gobletWeights.length).toBeGreaterThanOrEqual(1);
    expect(output.circletWeights.length).toBeGreaterThanOrEqual(1);

    // Normalizer should be positive
    expect(output.normalizer).toBeGreaterThan(0);

    // Team breakdowns should be passed through
    expect(output.teamBreakdowns).toHaveLength(1);
    expect(output.teamBreakdowns[0].label).toBe("Team A");
  });

  it("should merge multiple teams and average weights", () => {
    const team1 = makeTeamResult({
      teamIndex: 0,
      label: "Vape team",
      weights: { cr: 100, cd: 90, "atk%": 80, em: 60 },
      rolls: { cr: 8, cd: 12, "atk%": 5, em: 5 },
      finalDamage: 50000,
    });
    const team2 = makeTeamResult({
      teamIndex: 1,
      label: "Mono team",
      weights: { cr: 90, cd: 100, "atk%": 85, em: 20 },
      rolls: { cr: 9, cd: 13, "atk%": 8, em: 0 },
      finalDamage: 48000,
    });

    const output = aggregateTeamResults([team1, team2], "hutao", "Pyro");

    expect(output.teamBreakdowns).toHaveLength(2);
    // Both cr and cd should be high (averaged)
    const crWeight = output.substats.find((s) => s.stat === "cr")?.weight ?? 0;
    const cdWeight = output.substats.find((s) => s.stat === "cd")?.weight ?? 0;
    expect(crWeight).toBeGreaterThan(70);
    expect(cdWeight).toBeGreaterThan(70);
  });

  it("should throw if all combos are empty", () => {
    const empty: AutoTuneTeamResult = {
      qualifying: [],
      teamBreakdown: {
        teamIndex: 0,
        label: "Empty",
        combos: [],
        bestDamage: 0,
      },
    };

    expect(() => aggregateTeamResults([empty], "test", "Pyro")).toThrow(
      /All team contexts failed/
    );
  });

  it("should pick best main stat weight as 100", () => {
    const teamResult = makeTeamResult({
      teamIndex: 0,
      label: "Team A",
      sands: "atk%",
      goblet: "pyro%",
      circlet: "cr",
      weights: { cr: 100, cd: 95, "atk%": 80 },
      rolls: { cr: 8, cd: 12, "atk%": 10 },
      finalDamage: 50000,
    });

    const output = aggregateTeamResults([teamResult], "test", "Pyro");

    // The only sands candidate in qualifying is atk%, so it should be 100
    expect(output.sandsWeights[0].stat).toBe("atk%");
    expect(output.sandsWeights[0].weight).toBe(100);
  });

  it("should rank main stat candidates by damage", () => {
    // Two combos: atk% sands (best) and hp% sands (weaker)
    const teamResult: AutoTuneTeamResult = {
      qualifying: [
        {
          sands: "atk%",
          goblet: "pyro%",
          circlet: "cr",
          tuneResult: {
            weights: makeWeights({ cr: 100, cd: 95, "atk%": 80 }),
            rollAllocation: makeRolls({ cr: 8, cd: 12, "atk%": 10 }),
            midpointMarginals: makeWeights({ cr: 100, cd: 95, "atk%": 80 }),
            finalDamage: 50000,
          },
          normalizedDamage: 1.0,
        },
        {
          sands: "hp%",
          goblet: "pyro%",
          circlet: "cr",
          tuneResult: {
            weights: makeWeights({ cr: 100, cd: 95, "hp%": 70 }),
            rollAllocation: makeRolls({ cr: 8, cd: 12, "hp%": 10 }),
            midpointMarginals: makeWeights({ cr: 100, cd: 95, "hp%": 70 }),
            finalDamage: 49000,
          },
          normalizedDamage: 0.98,
        },
      ],
      teamBreakdown: {
        teamIndex: 0,
        label: "Team A",
        combos: [],
        bestDamage: 50000,
      },
    };

    const output = aggregateTeamResults([teamResult], "test", "Pyro");

    // atk% should rank above hp% for sands
    const atkIdx = output.sandsWeights.findIndex((w) => w.stat === "atk%");
    const hpIdx = output.sandsWeights.findIndex((w) => w.stat === "hp%");
    expect(atkIdx).toBeLessThan(hpIdx);
    expect(output.sandsWeights[atkIdx].weight).toBeGreaterThan(
      output.sandsWeights[hpIdx].weight
    );
  });

  it("should filter substats with weight <= 20", () => {
    const teamResult = makeTeamResult({
      teamIndex: 0,
      label: "Team",
      weights: { cr: 100, cd: 95, "atk%": 80, em: 10, def: 2 },
      rolls: { cr: 8, cd: 12, "atk%": 10 },
      finalDamage: 50000,
    });

    const output = aggregateTeamResults([teamResult], "test", "Pyro");

    // em=10 and def=2 should be filtered out (<=20 threshold)
    const emSub = output.substats.find((s) => s.stat === "em");
    const defSub = output.substats.find((s) => s.stat === "def");
    expect(emSub).toBeUndefined();
    expect(defSub).toBeUndefined();
  });

  it("should produce different goblet candidates for different elements", () => {
    const teamResult = makeTeamResult({
      teamIndex: 0,
      label: "Team",
      goblet: "pyro%",
      weights: { cr: 100, cd: 95, "atk%": 80 },
      rolls: { cr: 8, cd: 12, "atk%": 10 },
      finalDamage: 50000,
    });

    const pyroOutput = aggregateTeamResults([teamResult], "test", "Pyro");

    // Pyro output should have pyro% as a goblet candidate
    const hasPyro = pyroOutput.gobletWeights.some((w) => w.stat === "pyro%");
    expect(hasPyro).toBe(true);
  });
});
