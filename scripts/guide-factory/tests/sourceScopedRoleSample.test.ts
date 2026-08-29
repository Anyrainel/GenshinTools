import { describe, expect, it } from "vitest";
import type { KnowledgeRecord } from "../src/schemas";
import {
  evaluateSourceScopedRoleSample,
  type SourceScopedCharacterRoleRecord,
  type SourceScopedRoleSampleInput,
  type SourceScopedRoleSampleIssueCode,
} from "../src/sourceScopedRoleSample";
import type { TeamTemplateRecord } from "../src/teamRosterCandidateDomain";

type ExactTeamRecord = Extract<KnowledgeRecord, { kind: "team" }>;

const PAGE_URL = "https://keqingmains.com/q/furina-quickguide/";
const TEMPLATE_ID =
  "kqm:team-template:furina-team-template-hypercarry-mono";
const ROLE_RECORD_ID =
  "kqm:character-role:furina-xilonen-healer-role-luna-ii";
const TEAM_ID = "kqm:team:furina-neuvillette-kazuha-xilonen-example";

describe("source-scoped role sample", () => {
  it("proves only the named Xilonen binding on the exact same-page team", () => {
    const report = evaluateSourceScopedRoleSample(fixture());

    expect(report).toEqual({
      schemaVersion: 1,
      reportType: "source-scoped-role-sample",
      comparisonStatus: "comparable",
      reviewStatus: "unreviewed",
      completeDomain: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsRankClaims: false,
      bindingProvenance: "same-page-inferred-fit",
      evidencePoolCharacterIds: ["xilonen"],
      structuralBindingMultiplicity: 2,
      survivor: {
        targetTeamId: TEAM_ID,
        targetMemberCharacterIds: [
          "furina",
          "neuvillette",
          "kaedehara_kazuha",
          "xilonen",
        ],
        templateId: TEMPLATE_ID,
        slotId: "healer",
        roleId: "healer",
        characterId: "xilonen",
        sourceSlotBinding: {
          furina: "furina",
          healer: "xilonen",
          "flex-1": "neuvillette",
          "flex-2": "kaedehara_kazuha",
        },
        sourceSlotBindingBasis: "same-page-inferred-fit",
        structuralBindingMultiplicity: 2,
        sourceLineage: { sourceId: "kqm", pageUrl: PAGE_URL },
      },
      issues: [],
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("candidateRosters");
    expect(serialized).not.toContain("rankings");
    expect(serialized).not.toContain("resolvedRoleCatalog");
  });

  it.each([
    {
      name: "the role record is marked accepted",
      mutate(input: SourceScopedRoleSampleInput) {
        input.roleRecord.status = "accepted";
      },
      code: "role-record-state-invalid",
    },
    {
      name: "the role record becomes promotion-eligible",
      mutate(input: SourceScopedRoleSampleInput) {
        input.roleRecord.promotionEligible = true;
      },
      code: "role-record-state-invalid",
    },
    {
      name: "the role evidence is from a different page",
      mutate(input: SourceScopedRoleSampleInput) {
        input.roleRecord.sourceRefs[0] = sourceRef(
          "https://keqingmains.com/q/xilonen-quickguide/",
          "xilonen-healer",
        );
      },
      code: "source-lineage-mismatch",
    },
    {
      name: "the role appears only as a highlighted annotation",
      mutate(input: SourceScopedRoleSampleInput) {
        input.template.slots[1] = {
          id: "healer",
          options: [{ type: "any" }],
          highlightedOptions: [{ type: "roles", roleIds: ["healer"] }],
        };
      },
      code: "role-option-missing",
    },
    {
      name: "the named member disappears from role evidence",
      mutate(input: SourceScopedRoleSampleInput) {
        input.roleRecord.members = [
          { characterId: "jean", conditions: [] },
        ];
      },
      code: "role-member-missing",
    },
    {
      name: "the named sample is widened to multiple role members",
      mutate(input: SourceScopedRoleSampleInput) {
        input.roleRecord.members.push({
          characterId: "jean",
          conditions: [],
        });
      },
      code: "role-evidence-invalid",
    },
    {
      name: "the explicit role slot binds a different target member",
      mutate(input: SourceScopedRoleSampleInput) {
        input.sourceSlotBinding = {
          furina: "furina",
          healer: "neuvillette",
          "flex-1": "xilonen",
          "flex-2": "kaedehara_kazuha",
        };
      },
      code: "binding-role-member-mismatch",
    },
    {
      name: "the exact target no longer has the expected multiplicity",
      mutate(input: SourceScopedRoleSampleInput) {
        input.expectation.expectedStructuralBindingMultiplicity = 1;
      },
      code: "structural-multiplicity-mismatch",
    },
    {
      name: "another role selector would require global role resolution",
      mutate(input: SourceScopedRoleSampleInput) {
        input.template.slots[2] = {
          id: "flex-1",
          options: [{ type: "roles", roleIds: ["support"] }],
        };
      },
      code: "unresolved-additional-role-option",
    },
    {
      name: "the role evidence has an unverified constellation floor",
      mutate(input: SourceScopedRoleSampleInput) {
        input.roleRecord.members[0] = {
          characterId: "xilonen",
          minConstellation: 2,
          conditions: [],
        };
      },
      code: "role-constellation-unverified",
    },
    {
      name: "a natural-language role condition is not acknowledged",
      mutate(input: SourceScopedRoleSampleInput) {
        input.roleRecord.members[0] = {
          characterId: "xilonen",
          conditions: ["healing stance is active"],
        };
      },
      code: "role-condition-unverified",
    },
  ] satisfies Array<{
    name: string;
    mutate(input: SourceScopedRoleSampleInput): void;
    code: SourceScopedRoleSampleIssueCode;
  }>) ("fails closed when $name", ({ mutate, code }) => {
    const input = fixture();
    mutate(input);

    const report = evaluateSourceScopedRoleSample(input);

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.survivor).toBeNull();
    expect(report.issues).toContainEqual(expect.objectContaining({ code }));
    expect(report).toMatchObject({
      completeDomain: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsRankClaims: false,
      reviewStatus: "unreviewed",
    });
  });

  it("does not invent a C0 bound when both sources omit investment", () => {
    const unbounded = fixture();
    expect(
      evaluateSourceScopedRoleSample(unbounded).issues.map(({ code }) => code),
    ).not.toContain("role-constellation-unverified");

    const bounded = fixture();
    bounded.roleRecord.members[0] = {
      characterId: "xilonen",
      minConstellation: 0,
      maxConstellation: 0,
      conditions: [],
    };
    const report = evaluateSourceScopedRoleSample(bounded);
    expect(report.survivor).toBeNull();
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "role-constellation-unverified" }),
    );
  });
});

function fixture(): SourceScopedRoleSampleInput {
  return {
    roleRecord: roleRecord(),
    template: template(),
    targetTeam: targetTeam(),
    eligibleCharacters: [
      { characterId: "furina", elementId: "hydro" },
      { characterId: "neuvillette", elementId: "hydro" },
      { characterId: "kaedehara_kazuha", elementId: "anemo" },
      { characterId: "xilonen", elementId: "geo" },
      { characterId: "jean", elementId: "anemo" },
    ],
    expectation: {
      roleRecordId: ROLE_RECORD_ID,
      templateId: TEMPLATE_ID,
      slotId: "healer",
      roleId: "healer",
      targetTeamId: TEAM_ID,
      targetMemberCharacterIds: [
        "furina",
        "neuvillette",
        "kaedehara_kazuha",
        "xilonen",
      ],
      evidenceCharacterId: "xilonen",
      expectedStructuralBindingMultiplicity: 2,
    },
    sourceSlotBinding: {
      furina: "furina",
      healer: "xilonen",
      "flex-1": "neuvillette",
      "flex-2": "kaedehara_kazuha",
    },
    sourceSlotBindingBasis: "same-page-inferred-fit",
  };
}

function roleRecord(): SourceScopedCharacterRoleRecord {
  return {
    id: ROLE_RECORD_ID,
    kind: "character_role",
    status: "candidate",
    promotionEligible: false,
    roleId: "healer",
    appliesTo: { teamTemplateId: TEMPLATE_ID, slotId: "healer" },
    members: [{ characterId: "xilonen", conditions: [] }],
    exhaustiveness: "non-exhaustive",
    rankingClaim: "none",
    sourceRefs: [
      sourceRef(PAGE_URL, "furina-xilonen-healer-role-luna-ii"),
    ],
    unknowns: ["agent-assisted extraction has not been human-reviewed"],
  };
}

function template(): TeamTemplateRecord {
  return {
    id: TEMPLATE_ID,
    kind: "team_template",
    status: "candidate",
    promotionEligible: false,
    label: "Furina — Healer — Flex — Flex",
    intent: "prescriptive",
    exhaustiveness: "non-exhaustive",
    rankingClaim: "none",
    slots: [
      {
        id: "furina",
        options: [{ type: "characters", characterIds: ["furina"] }],
      },
      {
        id: "healer",
        options: [{ type: "roles", roleIds: ["healer"] }],
      },
      { id: "flex-1", options: [{ type: "any" }] },
      { id: "flex-2", options: [{ type: "any" }] },
    ],
    sourceRefs: [sourceRef(PAGE_URL, "furina-team-template-hypercarry-mono")],
    unknowns: [],
  };
}

function targetTeam(): ExactTeamRecord {
  return {
    id: TEAM_ID,
    kind: "team",
    status: "candidate",
    promotionEligible: false,
    label: "Furina — Neuvillette — Kazuha — Xilonen",
    intent: "example",
    exhaustiveness: "non-exhaustive",
    rankingClaim: "none",
    members: [
      member("furina"),
      member("neuvillette"),
      member("kaedehara_kazuha"),
      member("xilonen"),
    ],
    damagePlans: [],
    sourceRefs: [
      sourceRef(PAGE_URL, "furina-neuvillette-kazuha-xilonen-example"),
    ],
    unknowns: [],
  };
}

function member(characterId: string): ExactTeamRecord["members"][number] {
  return {
    characterId,
    investment: { status: "unspecified" },
    selectedWeapon: null,
    selectedArtifact: null,
  };
}

function sourceRef(
  url: string,
  sourceRecordId: string,
): ExactTeamRecord["sourceRefs"][number] {
  return {
    sourceId: "kqm",
    sourceRecordId,
    locator: { url, heading: "Teams > Hypercarry & Mono Element" },
  };
}
