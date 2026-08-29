import { describe, expect, it } from "vitest";
import type { GameCatalogs } from "../src/catalogs";
import {
  buildTeamTemplateCoverageReport,
  type TeamTemplateCoverageEntry,
} from "../src/teamTemplateCoverage";
import {
  KnowledgeRepositorySchema,
  type KnowledgeRecord,
  type KnowledgeRepository,
} from "../src/schemas";

const SHA256 = "0".repeat(64);

describe("team-template baseline coverage", () => {
  it("matches exact teams regardless of member order", () => {
    const report = buildTeamTemplateCoverageReport(
      repository([
        baselineTeam("baseline:permuted", ["furina", "jean", "xiao", "faruzan"]),
        template("template:permuted", [
          characters("xiao"),
          characters("faruzan"),
          characters("furina"),
          characters("jean"),
        ]),
      ]),
      catalogs(),
    );

    expect(coverage(report.templates, "template:permuted")).toMatchObject({
      outcome: "present",
      matchedBaselineTeamIds: ["baseline:permuted"],
      unresolvedBaselineTeamIds: [],
      unresolvedRoleIds: [],
    });
  });

  it("resolves element selectors against the character catalog", () => {
    const report = buildTeamTemplateCoverageReport(
      repository([
        baselineTeam("baseline:element", ["furina", "jean", "xiao", "faruzan"]),
        template("template:element", [
          characters("furina"),
          elements("anemo"),
          elements("anemo"),
          characters("faruzan"),
        ]),
      ]),
      catalogs(),
    );

    expect(coverage(report.templates, "template:element")).toMatchObject({
      outcome: "present",
      matchedBaselineTeamIds: ["baseline:element"],
    });
  });

  it("keeps source highlights out of hard coverage matching", () => {
    const flexibleSlot: TemplateSlot = {
      id: "flex",
      options: [{ type: "any" }],
      highlightedOptions: [
        { type: "characters", characterIds: ["neuvillette"] },
      ],
    };
    const report = buildTeamTemplateCoverageReport(
      repository([
        baselineTeam("baseline:unhighlighted-flex", [
          "furina",
          "jean",
          "xiao",
          "faruzan",
        ]),
        template("template:unhighlighted-flex", [
          characters("furina"),
          characters("xiao"),
          characters("faruzan"),
          flexibleSlot,
        ]),
      ]),
      catalogs(),
    );

    expect(
      coverage(report.templates, "template:unhighlighted-flex"),
    ).toMatchObject({
      outcome: "present",
      matchedBaselineTeamIds: ["baseline:unhighlighted-flex"],
    });
  });

  it("reports a fully resolved miss as uncovered", () => {
    const report = buildTeamTemplateCoverageReport(
      repository([
        baselineTeam("baseline:miss", ["furina", "jean", "xiao", "faruzan"]),
        template("template:miss", [
          characters("furina"),
          characters("neuvillette"),
          characters("kazuha"),
          characters("xilonen"),
        ]),
      ]),
      catalogs(),
    );

    expect(coverage(report.templates, "template:miss")).toMatchObject({
      outcome: "uncovered",
      matchedBaselineTeamIds: [],
      unresolvedBaselineTeamIds: [],
      unresolvedRoleIds: [],
    });
  });

  it("keeps a role-dependent possible assignment unresolved", () => {
    const report = buildTeamTemplateCoverageReport(
      repository([
        baselineTeam("baseline:role", ["furina", "jean", "xiao", "faruzan"]),
        template("template:role", [
          characters("furina"),
          roles("team-wide-healer", "sustain"),
          characters("xiao"),
          characters("faruzan"),
        ]),
      ]),
      catalogs(),
    );

    expect(coverage(report.templates, "template:role")).toMatchObject({
      outcome: "unresolved",
      matchedBaselineTeamIds: [],
      unresolvedBaselineTeamIds: ["baseline:role"],
      unresolvedRoleIds: ["sustain", "team-wide-healer"],
    });
  });

  it("lets a resolved alternative win over an unresolved role selector", () => {
    const mixedSlot = roles("team-wide-healer");
    mixedSlot.options.push({ type: "characters", characterIds: ["jean"] });
    const report = buildTeamTemplateCoverageReport(
      repository([
        baselineTeam("baseline:resolved-alternative", [
          "faruzan",
          "xiao",
          "jean",
          "furina",
        ]),
        template("template:resolved-alternative", [
          characters("furina"),
          mixedSlot,
          characters("xiao"),
          characters("faruzan"),
        ]),
      ]),
      catalogs(),
    );

    const entry = coverage(report.templates, "template:resolved-alternative");
    expect(entry).toMatchObject({
      outcome: "present",
      matchedBaselineTeamIds: ["baseline:resolved-alternative"],
      unresolvedBaselineTeamIds: [],
      unresolvedRoleIds: [],
    });
    expect(report.prohibitedAggregates).toEqual(["score", "rank", "winner"]);
    expect(entry).not.toHaveProperty("score");
    expect(entry).not.toHaveProperty("rank");
    expect(entry).not.toHaveProperty("winner");
  });

  it("finds exact external team overlap without treating member order as meaningful", () => {
    const baseline = baselineTeam("baseline:exact", [
      "neuvillette",
      "xilonen",
      "furina",
      "kazuha",
    ]);
    const external = {
      ...baselineTeam("external:exact", [
        "furina",
        "neuvillette",
        "kazuha",
        "xilonen",
      ]),
      status: "candidate" as const,
      promotionEligible: false,
    };
    const report = buildTeamTemplateCoverageReport(
      repository([baseline, external]),
      catalogs(),
    );

    expect(report.exactTeams).toEqual([
      expect.objectContaining({
        teamId: "external:exact",
        outcome: "present",
        matchedBaselineTeamIds: ["baseline:exact"],
        outcomeBasis: "character-roster-only",
        investmentEvaluated: false,
      }),
    ]);
  });

  it("preserves bounded external investments without using them for roster overlap", () => {
    const baseline = baselineTeam("baseline:bounded", [
      "neuvillette",
      "xilonen",
      "furina",
      "kazuha",
    ]);
    const external = {
      ...baselineTeam("external:bounded", [
        "furina",
        "neuvillette",
        "kazuha",
        "xilonen",
      ]),
      status: "candidate" as const,
      promotionEligible: false,
    };
    if (external.kind !== "team") {
      throw new Error("External bounded fixture is not a team.");
    }
    external.members[0].investment = {
      status: "partial",
      minConstellation: 2,
      maxConstellation: 6,
      talentLevels: [9, 10, 10],
    };
    external.members[1].investment = {
      status: "partial",
      maxConstellation: 1,
    };
    external.members[2].investment = {
      status: "partial",
      constellation: 2,
    };

    const parsedRepository = repository([baseline, external]);
    const parsedExternal = parsedRepository.records.find(
      ({ id }) => id === "external:bounded",
    );
    if (!parsedExternal || parsedExternal.kind !== "team") {
      throw new Error("Parsed external bounded fixture is missing.");
    }
    const report = buildTeamTemplateCoverageReport(parsedRepository, catalogs());
    const entry = report.exactTeams[0];

    expect(entry).toMatchObject({
      teamId: "external:bounded",
      outcome: "present",
      matchedBaselineTeamIds: ["baseline:bounded"],
      outcomeBasis: "character-roster-only",
      investmentEvaluated: false,
      memberInvestmentScopes: [
        {
          memberIndex: 0,
          characterId: "furina",
          investment: {
            status: "partial",
            minConstellation: 2,
            maxConstellation: 6,
            talentLevels: [9, 10, 10],
          },
        },
        {
          memberIndex: 1,
          characterId: "neuvillette",
          investment: { status: "partial", maxConstellation: 1 },
        },
        {
          memberIndex: 2,
          characterId: "kazuha",
          investment: { status: "partial", constellation: 2 },
        },
        {
          memberIndex: 3,
          characterId: "xilonen",
          investment: { status: "unspecified" },
        },
      ],
    });
    expect(entry?.memberInvestmentScopes[0]?.investment).not.toBe(
      parsedExternal.members[0].investment,
    );
  });
});

type TemplateSlot = Extract<
  KnowledgeRecord,
  { kind: "team_template" }
>["slots"][number];

function repository(records: KnowledgeRecord[]): KnowledgeRepository {
  return KnowledgeRepositorySchema.parse({
    schemaVersion: 1,
    sourceRegistrySha256: SHA256,
    generatedFrom: [],
    records,
  });
}

function baselineTeam(
  id: string,
  characterIds: [string, string, string, string],
): KnowledgeRecord {
  return {
    id,
    kind: "team",
    status: "baseline",
    members: characterIds.map((characterId) => ({
      characterId,
      investment: { status: "unspecified" as const },
      selectedWeapon: null,
      selectedArtifact: null,
    })) as Extract<KnowledgeRecord, { kind: "team" }>["members"],
    damagePlans: [],
    sourceRefs: [sourceRef(id)],
    unknowns: [],
  };
}

function template(
  id: string,
  slots: [TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot],
): KnowledgeRecord {
  return {
    id,
    kind: "team_template",
    status: "candidate",
    promotionEligible: false,
    intent: "example",
    exhaustiveness: "non-exhaustive",
    rankingClaim: "none",
    slots,
    sourceRefs: [sourceRef(id)],
    unknowns: [],
  };
}

function characters(characterId: string): TemplateSlot {
  return {
    id: characterId,
    options: [{ type: "characters", characterIds: [characterId] }],
  };
}

function elements(element: "anemo" | "hydro"): TemplateSlot {
  return {
    id: `${element}-slot`,
    options: [{ type: "elements", elements: [element] }],
  };
}

function roles(...roleIds: string[]): TemplateSlot {
  return {
    id: "role-slot",
    options: [{ type: "roles", roleIds }],
  };
}

function sourceRef(sourceRecordId: string) {
  return {
    sourceId: "test-source",
    sourceRecordId,
    locator: { url: "https://example.com/guide", heading: "Teams" },
  };
}

function catalogs(): GameCatalogs {
  return {
    characterIds: new Set([
      "furina",
      "jean",
      "xiao",
      "faruzan",
      "neuvillette",
      "kazuha",
      "xilonen",
    ]),
    weaponIds: new Set(),
    artifactSetIds: new Set(),
    artifactHalfSetIds: new Set(),
    artifactSetToHalfSetId: new Map(),
    betaCharacterIds: new Set(),
    betaWeaponIds: new Set(),
    betaArtifactSetIds: new Set(),
    characterElements: new Map([
      ["furina", "hydro"],
      ["jean", "anemo"],
      ["xiao", "anemo"],
      ["faruzan", "anemo"],
      ["neuvillette", "hydro"],
      ["kazuha", "anemo"],
      ["xilonen", "geo"],
    ]),
    characterWeaponTypes: new Map(),
    weaponTypes: new Map(),
    reactionIds: new Set(),
    mainStatsBySlot: {
      sands: new Set(),
      goblet: new Set(),
      circlet: new Set(),
    },
    substatIds: new Set(),
  };
}

function coverage(
  entries: TeamTemplateCoverageEntry[],
  templateId: string,
): TeamTemplateCoverageEntry {
  const entry = entries.find((candidate) => candidate.templateId === templateId);
  if (!entry) throw new Error(`Missing coverage for ${templateId}`);
  return entry;
}
