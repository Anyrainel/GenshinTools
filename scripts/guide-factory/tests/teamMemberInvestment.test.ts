import { describe, expect, it } from "vitest";
import {
  InvestmentSchema,
  ManualObservationSnapshotSchema,
} from "../src/schemas";
import {
  cloneTeamMemberInvestment,
  investmentAllowsConstellation,
  investmentMatchesConcreteAssumption,
  type TeamMemberInvestment,
} from "../src/teamMemberInvestment";

describe("team-member investment bounds", () => {
  it("accepts exact and one- or two-sided partial constellation knowledge", () => {
    expect(
      InvestmentSchema.parse({ status: "partial", constellation: 2 }),
    ).toEqual({ status: "partial", constellation: 2 });
    expect(
      InvestmentSchema.parse({ status: "partial", minConstellation: 2 }),
    ).toEqual({ status: "partial", minConstellation: 2 });
    expect(
      InvestmentSchema.parse({ status: "partial", maxConstellation: 4 }),
    ).toEqual({ status: "partial", maxConstellation: 4 });
    expect(
      InvestmentSchema.parse({
        status: "partial",
        minConstellation: 1,
        maxConstellation: 5,
      }),
    ).toEqual({
      status: "partial",
      minConstellation: 1,
      maxConstellation: 5,
    });
  });

  it("rejects mixed exact/range knowledge and inverted ranges", () => {
    expect(
      InvestmentSchema.safeParse({
        status: "partial",
        constellation: 2,
        minConstellation: 2,
      }).success,
    ).toBe(false);
    expect(
      InvestmentSchema.safeParse({
        status: "partial",
        minConstellation: 5,
        maxConstellation: 2,
      }).success,
    ).toBe(false);
    expect(
      InvestmentSchema.safeParse({
        status: "specified",
        constellation: 2,
        minConstellation: 2,
        talentLevels: [10, 10, 10],
      }).success,
    ).toBe(false);
  });

  it("applies the same exact-or-bounds contract to manual team members", () => {
    const parsed = ManualObservationSnapshotSchema.parse(
      manualTeamSnapshot([
        { characterId: "a", minConstellation: 2 },
        { characterId: "b", maxConstellation: 4 },
        { characterId: "c", minConstellation: 1, maxConstellation: 5 },
        { characterId: "d", constellation: 6 },
      ]),
    );
    const team = parsed.records[0];
    if (!team || team.kind !== "team") throw new Error("Missing test team.");
    expect(team.members.map(({ characterId, ...member }) => ({
      characterId,
      constellation: member.constellation,
      minConstellation: member.minConstellation,
      maxConstellation: member.maxConstellation,
    }))).toEqual([
      {
        characterId: "a",
        constellation: undefined,
        minConstellation: 2,
        maxConstellation: undefined,
      },
      {
        characterId: "b",
        constellation: undefined,
        minConstellation: undefined,
        maxConstellation: 4,
      },
      {
        characterId: "c",
        constellation: undefined,
        minConstellation: 1,
        maxConstellation: 5,
      },
      {
        characterId: "d",
        constellation: 6,
        minConstellation: undefined,
        maxConstellation: undefined,
      },
    ]);

    expect(
      ManualObservationSnapshotSchema.safeParse(
        manualTeamSnapshot([
          { characterId: "a", constellation: 2, minConstellation: 2 },
        ]),
      ).success,
    ).toBe(false);
    expect(
      ManualObservationSnapshotSchema.safeParse(
        manualTeamSnapshot([
          { characterId: "a", minConstellation: 5, maxConstellation: 2 },
        ]),
      ).success,
    ).toBe(false);
  });

  it("checks concrete constellations against exact, lower, upper, and closed bounds", () => {
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((constellation) =>
        investmentAllowsConstellation(
          { status: "partial", constellation: 2 },
          constellation,
        ),
      ),
    ).toEqual([false, false, true, false, false, false, false]);
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((constellation) =>
        investmentAllowsConstellation(
          { status: "partial", minConstellation: 2 },
          constellation,
        ),
      ),
    ).toEqual([false, false, true, true, true, true, true]);
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((constellation) =>
        investmentAllowsConstellation(
          { status: "partial", maxConstellation: 4 },
          constellation,
        ),
      ),
    ).toEqual([true, true, true, true, true, false, false]);
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((constellation) =>
        investmentAllowsConstellation(
          { status: "partial", minConstellation: 2, maxConstellation: 4 },
          constellation,
        ),
      ),
    ).toEqual([false, false, true, true, true, false, false]);
    expect(
      [0, 6].every((constellation) =>
        investmentAllowsConstellation({ status: "unspecified" }, constellation),
      ),
    ).toBe(true);
  });

  it("retains talent matching and clones all optional bounds without aliases", () => {
    const investment: TeamMemberInvestment = {
      status: "partial",
      minConstellation: 2,
      talentLevels: [8, 9, 10],
    };
    const clone = cloneTeamMemberInvestment(investment);

    expect(clone).toEqual(investment);
    expect(clone).not.toBe(investment);
    if (clone.status !== "partial" || clone.talentLevels == null) {
      throw new Error("Expected cloned partial talents.");
    }
    expect(clone.talentLevels).not.toBe(investment.talentLevels);
    expect(
      investmentMatchesConcreteAssumption(investment, {
        constellation: 2,
        talentLevels: { auto: 8, skill: 9, burst: 10 },
      }),
    ).toBe(true);
    expect(
      investmentMatchesConcreteAssumption(investment, {
        constellation: 1,
        talentLevels: { auto: 8, skill: 9, burst: 10 },
      }),
    ).toBe(false);
    expect(
      investmentMatchesConcreteAssumption(investment, {
        constellation: 2,
        talentLevels: { auto: 8, skill: 9, burst: 9 },
      }),
    ).toBe(false);
  });
});

function manualTeamSnapshot(
  overrides: Array<{
    characterId: string;
    constellation?: number;
    minConstellation?: number;
    maxConstellation?: number;
  }>,
) {
  const members = ["a", "b", "c", "d"].map((characterId) => ({
    characterId,
    weaponRecommendations: [],
    artifactRecommendations: [],
    erTargets: [],
    ...overrides.find((override) => override.characterId === characterId),
  }));
  return {
    schemaVersion: 1,
    sourceId: "test-source",
    capturedAt: "2026-08-29",
    page: {
      title: "Test source",
      url: "https://example.com/guide",
      publisher: "Test publisher",
      attributionNote: "Test-only fixture.",
    },
    records: [
      {
        kind: "team",
        sourceRecordId: "bounded-team",
        locator: { url: "https://example.com/guide", heading: "Teams" },
        supportingLocators: [],
        extraction: { method: "manual", reviewStatus: "unreviewed" },
        intent: "example",
        exhaustiveness: "non-exhaustive",
        rankingClaim: "none",
        members,
        rotations: [],
        unknowns: [],
      },
    ],
  };
}
