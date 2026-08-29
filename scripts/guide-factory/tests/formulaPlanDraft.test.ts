import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import { describe, expect, it } from "vitest";
import { bootstrapGuideFactoryComputation } from "../src/computationReplay";
import {
  compareSourceFormulaCountClaims,
  compareSourceTranslatedFormulaPlan,
  draftCalculatorDefaultFormulaPlan,
  type FormulaPlanCharacterAssumption,
  type FormulaPlanDraftOutput,
  type SourceFormulaCountClaimLine,
} from "../src/formulaPlanDraft";
import { readJson, stableJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import {
  KnowledgeRepositorySchema,
  type KnowledgeRecord,
} from "../src/schemas";

const TEAM_ID = "genshintools-presets:team:JQC4wxT0jJgK50gc0O";
const INVESTMENT: FormulaPlanCharacterAssumption = {
  charLevel: 90,
  constellation: 0,
  refinement: 1,
  talentLevels: { auto: 10, skill: 10, burst: 10 },
};

type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;

describe("calculator-default formula-plan draft", () => {
  it("partitions every available formula deterministically without claiming optimality", async () => {
    const team = await loadBaselineTeam();
    const assumptions = Object.fromEntries(
      team.members.map((member) => [member.characterId, { ...INVESTMENT }])
    );

    const first = await draftCalculatorDefaultFormulaPlan({ team, assumptions });
    const second = await draftCalculatorDefaultFormulaPlan({ team, assumptions });

    expect(stableJson(second)).toBe(stableJson(first));
    expect(first).toMatchObject({
      classification: "calculator-default-draft",
      supportsGuideClaims: false,
      sourceTeamRecordId: TEAM_ID,
      assumptions: { combatOptions: "calculator-defaults" },
    });
    expect(first.cautions.join(" ")).toContain(
      "comboDescriptor implementation defaults"
    );
    expect(first.cautions.join(" ")).toContain(
      "not source-reviewed rotation truth"
    );
    expect(first.cautions.join(" ")).toContain(
      "does not establish an optimal rotation"
    );
    expect(first.lines.length).toBeGreaterThan(0);
    expect(first.lines.every((line) => line.count > 0)).toBe(true);
    expect(first.zeroCountAvailableFormulas.length).toBeGreaterThan(0);
    expect(first.assumptions.characters).toHaveLength(4);
    for (const assumption of first.assumptions.characters) {
      expect(assumption).toMatchObject({
        charLevel: 90,
        constellation: 0,
        refinement: 1,
        talentLevels: { auto: 10, skill: 10, burst: 10 },
      });
    }

    await bootstrapGuideFactoryComputation();
    const configs = buildConfigs(team, assumptions);
    const catalog = new TeamBuild(configs, {}).catalog;
    const available = catalog.getFormulaIds();
    const covered = new Set([
      ...first.lines.map((line) => `${line.characterId}.${line.formulaId}`),
      ...first.zeroCountAvailableFormulas.map(
        (formula) => `${formula.characterId}.${formula.formulaId}`
      ),
    ]);
    const expected = new Set(
      team.members.flatMap((member) =>
        Object.keys(available[member.characterId] ?? {}).map(
          (formulaId) => `${member.characterId}.${formulaId}`
        )
      )
    );

    expect(covered).toEqual(expected);
    expect(covered.size).toBe(
      first.lines.length + first.zeroCountAvailableFormulas.length
    );
    for (const member of team.members) {
      const combo = catalog.getCombo(member.characterId);
      const allFormulas = catalog.getAllFormulaIds()[member.characterId];
      for (const formulaId of Object.keys(combo)) {
        expect(allFormulas[formulaId]).toBeDefined();
      }
    }
  });

  it("rejects a team member without complete selected equipment", async () => {
    const team = await loadBaselineTeam();
    const assumptions = Object.fromEntries(
      team.members.map((member) => [member.characterId, { ...INVESTMENT }])
    );
    const incompleteTeam: KnowledgeTeam = {
      ...team,
      members: team.members.map((member, index) =>
        index === 0 ? { ...member, selectedArtifact: null } : member
      ) as KnowledgeTeam["members"],
    };

    await expect(
      draftCalculatorDefaultFormulaPlan({ team: incompleteTeam, assumptions })
    ).rejects.toThrow("requires a selected artifact set");
  });
});

describe("source-translated formula-plan comparison", () => {
  const draft: FormulaPlanDraftOutput = {
    schemaVersion: 1,
    classification: "calculator-default-draft",
    supportsGuideClaims: false,
    sourceTeamRecordId: "source:team:test",
    assumptions: { combatOptions: "calculator-defaults", characters: [] },
    cautions: ["test fixture"],
    lines: [
      { characterId: "a", formulaId: "a-skill", count: 2 },
      { characterId: "b", formulaId: "b-burst", count: 1 },
    ],
    zeroCountAvailableFormulas: [
      { characterId: "a", formulaId: "a-burst" },
    ],
  };

  it("reports matches and both mismatch directions, including zero defaults", () => {
    const result = compareSourceTranslatedFormulaPlan(draft, [
      {
        characterId: "b",
        formulaId: "b-burst",
        count: 1,
        mappingBasis: "one source Q",
      },
      {
        characterId: "a",
        formulaId: "a-skill",
        count: 1,
        mappingBasis: "one source E",
      },
      {
        characterId: "a",
        formulaId: "a-burst",
        count: 1,
        mappingBasis: "one source Q",
      },
    ]);

    expect(result.formulaComparisons.map((row) => row.relation)).toEqual([
      "source-translation-higher",
      "calculator-default-higher",
      "matches",
    ]);
    expect(result.mismatches).toHaveLength(2);
  });

  it("rejects duplicate, unavailable, and unsupported count rows", () => {
    expect(() =>
      compareSourceTranslatedFormulaPlan(draft, [
        {
          characterId: "a",
          formulaId: "a-skill",
          count: 1,
          mappingBasis: "one source E",
        },
        {
          characterId: "a",
          formulaId: "a-skill",
          count: 2,
          mappingBasis: "duplicate",
        },
      ]),
    ).toThrow("repeats a.a-skill");
    expect(() =>
      compareSourceTranslatedFormulaPlan(draft, [
        {
          characterId: "a",
          formulaId: "a-unknown",
          count: 1,
          mappingBasis: "one source action",
        },
      ]),
    ).toThrow("unavailable calculator formula a.a-unknown");
    expect(() =>
      compareSourceTranslatedFormulaPlan(draft, [
        {
          characterId: "a",
          formulaId: "a-skill",
          count: 0,
          mappingBasis: "one source E",
        },
      ]),
    ).toThrow("count must be positive and finite");
  });
});

describe("source formula count-claim comparison", () => {
  const draft: FormulaPlanDraftOutput = {
    schemaVersion: 1,
    classification: "calculator-default-draft",
    supportsGuideClaims: false,
    sourceTeamRecordId: "source:team:test",
    assumptions: { combatOptions: "calculator-defaults", characters: [] },
    cautions: ["test fixture"],
    lines: [
      { characterId: "a", formulaId: "a-skill", count: 2 },
      { characterId: "b", formulaId: "b-burst", count: 1 },
    ],
    zeroCountAvailableFormulas: [
      { characterId: "a", formulaId: "a-burst" },
    ],
  };

  it("preserves exact, range, and partial-token claims without tuning them", () => {
    const result = compareSourceFormulaCountClaims(draft, [
      {
        characterId: "b",
        formulaId: "b-burst",
        countClaim: { type: "exact", value: 1 },
        sourceTokenCoverage: "complete",
        mappingBasis: "one source Q",
      },
      {
        characterId: "a",
        formulaId: "a-skill",
        countClaim: { type: "range", minimum: 1, maximum: 3 },
        sourceTokenCoverage: "partial",
        mappingBasis: "one required and up to two optional source actions",
      },
      {
        characterId: "a",
        formulaId: "a-burst",
        countClaim: { type: "range", minimum: 1, maximum: 2 },
        sourceTokenCoverage: "complete",
        mappingBasis: "one or two source Q casts",
      },
    ]);

    expect(result.formulaComparisons).toEqual([
      expect.objectContaining({
        formulaId: "a-burst",
        sourceCountClaim: { type: "range", minimum: 1, maximum: 2 },
        calculatorDefaultCount: 0,
        relation: "calculator-default-below-source-range",
      }),
      expect.objectContaining({
        formulaId: "a-skill",
        sourceTokenCoverage: "partial",
        relation: "calculator-default-within-source-range",
      }),
      expect.objectContaining({
        formulaId: "b-burst",
        relation: "matches",
      }),
    ]);
    expect(result.discrepancies).toHaveLength(1);

    expect(
      compareSourceFormulaCountClaims(draft, [
        {
          characterId: "a",
          formulaId: "a-skill",
          countClaim: { type: "range", minimum: 0, maximum: 1 },
          sourceTokenCoverage: "complete",
          mappingBasis: "optional source action",
        },
      ]).formulaComparisons[0]?.relation
    ).toBe("calculator-default-above-source-range");
  });

  it("rejects invalid ranges, duplicates, unavailable formulas, and coverage", () => {
    const validLine: SourceFormulaCountClaimLine = {
      characterId: "a",
      formulaId: "a-skill",
      countClaim: { type: "exact", value: 1 },
      sourceTokenCoverage: "complete",
      mappingBasis: "one source E",
    };

    expect(() =>
      compareSourceFormulaCountClaims(draft, [
        validLine,
        { ...validLine, countClaim: { type: "exact", value: 2 } },
      ])
    ).toThrow("repeat a.a-skill");
    expect(() =>
      compareSourceFormulaCountClaims(draft, [
        {
          ...validLine,
          countClaim: { type: "range", minimum: 1, maximum: 1 },
        },
      ])
    ).toThrow("0 <= minimum < maximum");
    expect(() =>
      compareSourceFormulaCountClaims(draft, [
        { ...validLine, countClaim: { type: "exact", value: 0 } },
      ])
    ).toThrow("exact value must be positive and finite");
    expect(() =>
      compareSourceFormulaCountClaims(draft, [
        { ...validLine, formulaId: "not-available" },
      ])
    ).toThrow("unavailable calculator formula a.not-available");
    expect(() =>
      compareSourceFormulaCountClaims(draft, [
        {
          ...validLine,
          sourceTokenCoverage: "invalid",
        } as unknown as SourceFormulaCountClaimLine,
      ])
    ).toThrow("invalid source-token coverage");
  });
});

async function loadBaselineTeam(): Promise<KnowledgeTeam> {
  const repository = KnowledgeRepositorySchema.parse(
    await readJson(KNOWLEDGE_REPOSITORY_PATH)
  );
  const team = repository.records.find((record) => record.id === TEAM_ID);
  expect(team?.kind).toBe("team");
  if (!team || team.kind !== "team") {
    throw new Error(`Missing baseline knowledge team ${TEAM_ID}.`);
  }
  return team;
}

function buildConfigs(
  team: KnowledgeTeam,
  assumptions: Record<string, FormulaPlanCharacterAssumption>
): TeamSlotConfig[] {
  return team.members.map((member): TeamSlotConfig => {
    if (!member.selectedWeapon || !member.selectedArtifact) {
      throw new Error(
        `Baseline member ${member.characterId} has incomplete equipment.`
      );
    }
    const assumption = assumptions[member.characterId];
    return {
      charId: member.characterId,
      charLevel: assumption.charLevel,
      constellation: assumption.constellation,
      weaponId: member.selectedWeapon.weaponId,
      refinement: assumption.refinement,
      artifactSet:
        member.selectedArtifact.type === "4pc"
          ? { ...member.selectedArtifact }
          : {
              ...member.selectedArtifact,
              halfSetIds: [...member.selectedArtifact.halfSetIds],
            },
      talentLevels: { ...assumption.talentLevels },
    };
  });
}
