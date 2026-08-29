import { describe, expect, it } from "vitest";
import type { KnowledgeRecord } from "../src/schemas";
import {
  evaluateSourceScopedRolePairSample,
  type SourceScopedRolePairIssueCode,
  type SourceScopedRolePairSampleInput,
  type SourceScopedRolePairTargetInput,
} from "../src/sourceScopedRolePairSample";
import type { SourceScopedCharacterRoleRecord } from "../src/sourceScopedRoleSample";
import type {
  ReleasedCharacterCatalogEntry,
  TeamTemplateRecord,
} from "../src/teamRosterCandidateDomain";

type ExactTeamRecord = Extract<KnowledgeRecord, { kind: "team" }>;

const PAGE_URL = "https://keqingmains.com/q/keqing-quickguide/";
const TEMPLATE_ID = "kqm:team-template:keqing-team-template-lunar-charged";
const HYDRO_ROLE_RECORD_ID =
  "kqm:character-role:keqing-off-field-hydro-luna-i";
const SHRED_ROLE_RECORD_ID =
  "kqm:character-role:keqing-resistance-shred-luna-i";
const VV_CONDITION =
  "Equipped with 4pc Viridescent Venerer and activates its relevant RES reduction.";

describe("source-scoped paired-role sample", () => {
  it("validates only four configured same-page pairs while retaining unexercised positive evidence", () => {
    const report = evaluateSourceScopedRolePairSample(fixture());

    expect(report.comparisonStatus).toBe("comparable");
    expect(report).toMatchObject({
      schemaVersion: 1,
      reportType: "source-scoped-role-pair-sample",
      completeRoleDomains: false,
      completePairDomain: false,
      pairCombinationPolicy: "configured-published-targets-only",
      unconfiguredRoleMemberPairsEvaluated: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsRankClaims: false,
      supportsGlobalRoleResolution: false,
      issues: [],
    });
    expect(report.roleEvidence).toEqual([
      {
        roleRecordId: HYDRO_ROLE_RECORD_ID,
        templateId: TEMPLATE_ID,
        slotId: "off-field-hydro",
        roleId: "off-field-hydro-applier",
        sourceObservedMemberIds: ["aino", "furina", "xingqiu", "yelan"],
        exercisedByConfiguredTargetMemberIds: ["aino", "furina", "yelan"],
        unexercisedByConfiguredTargetMemberIds: ["xingqiu"],
        exhaustiveness: "unspecified",
        rankingClaim: "none",
      },
      {
        roleRecordId: SHRED_ROLE_RECORD_ID,
        templateId: TEMPLATE_ID,
        slotId: "resistance-shred",
        roleId: "resistance-shred",
        sourceObservedMemberIds: [
          "jean",
          "kaedehara_kazuha",
          "sayu",
          "sucrose",
          "xianyun",
          "xilonen",
        ],
        exercisedByConfiguredTargetMemberIds: [
          "jean",
          "kaedehara_kazuha",
          "sucrose",
          "xilonen",
        ],
        unexercisedByConfiguredTargetMemberIds: ["sayu", "xianyun"],
        exhaustiveness: "unspecified",
        rankingClaim: "none",
      },
    ]);
    expect(report.targets).toHaveLength(4);
    expect(
      report.targets
        .flatMap(({ roleMemberBindings }) => roleMemberBindings)
        .every(
          (binding) =>
            Array.isArray(binding.requiredConditions) &&
            Array.isArray(binding.acknowledgedConditions) &&
            binding.conditionsMatch === true,
        ),
    ).toBe(true);
    expect(
      report.targets.flatMap(({ roleMemberBindings }) =>
        roleMemberBindings.filter(
          ({ characterId }) => characterId === "sucrose",
        ),
      ),
    ).toEqual([
      {
        roleRecordId: SHRED_ROLE_RECORD_ID,
        characterId: "sucrose",
        slotId: "resistance-shred",
        roleId: "resistance-shred",
        requiredConditions: [VV_CONDITION],
        acknowledgedConditions: [VV_CONDITION],
        conditionsMatch: true,
      },
    ]);
    expect(
      report.targets.map(({ sourceSlotBinding }) =>
        Object.keys(sourceSlotBinding),
      ),
    ).toEqual([
      ["ineffa", "keqing", "off-field-hydro", "resistance-shred"],
      ["ineffa", "keqing", "off-field-hydro", "resistance-shred"],
      ["ineffa", "keqing", "off-field-hydro", "resistance-shred"],
      ["ineffa", "keqing", "off-field-hydro", "resistance-shred"],
    ]);
    expect(
      report.targets.map(
        ({ targetId, comparisonStatus, structuralBindingMultiplicity }) => ({
          targetId,
          comparisonStatus,
          structuralBindingMultiplicity,
        }),
      ),
    ).toEqual([
      targetOutcome("01-furina-xilonen"),
      targetOutcome("02-aino-sucrose"),
      targetOutcome("03-furina-jean"),
      targetOutcome("04-yelan-kazuha"),
    ]);
    expect(report.validatedPairObservations).toHaveLength(4);
    expect(
      report.validatedPairObservations
        ?.flatMap(({ roleMemberBindings }) => roleMemberBindings)
        .every(
          (binding) =>
            Array.isArray(binding.requiredConditions) &&
            Array.isArray(binding.acknowledgedConditions) &&
            binding.conditionsMatch === true,
        ),
    ).toBe(true);
    expect(
      report.validatedPairObservations?.map(({ targetId }) => targetId),
    ).toEqual([
      "01-furina-xilonen",
      "02-aino-sucrose",
      "03-furina-jean",
      "04-yelan-kazuha",
    ]);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("candidatePairs");
    expect(serialized).not.toContain("cartesianProduct");
    expect(serialized).not.toContain("generatedRolePairs");
    expect(serialized).not.toContain("resolvedRoleCatalog");
    expect(serialized).not.toContain("furina\",\"characterId\":\"sucrose");
    expect(serialized).not.toContain("aino\",\"characterId\":\"xilonen");
  });

  it("is invariant to descriptor, binding, target, and slot-binding key order", () => {
    const input = fixture();
    const expected = evaluateSourceScopedRolePairSample(input);
    input.roles = [input.roles[1], input.roles[0]];
    input.targets = [...input.targets]
      .reverse()
      .map((target) => ({
        ...target,
        roleMemberBindings: [
          target.roleMemberBindings[1],
          target.roleMemberBindings[0],
        ],
        sourceSlotBinding: Object.fromEntries(
          Object.entries(target.sourceSlotBinding).reverse(),
        ),
      }));

    const reordered = evaluateSourceScopedRolePairSample(input);
    expect(reordered).toEqual(expected);
    expect(JSON.stringify(reordered)).toBe(JSON.stringify(expected));
  });

  it("fails the combined comparison when one role is from the same source on a different page", () => {
    const input = fixture();
    input.roles[1].record.sourceRefs = [
      sourceRef(
        "https://keqingmains.com/q/xilonen-quickguide/",
        "keqing-resistance-shred-luna-i",
      ),
    ];

    const report = evaluateSourceScopedRolePairSample(input);

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.validatedPairObservations).toBeNull();
    expect(
      report.targets.every(({ comparisonStatus }) =>
        comparisonStatus === "not-comparable",
      ),
    ).toBe(true);
    expect(
      report.targets.every(({ issues }) =>
        issues.some(({ code }) => code === "source-lineage-mismatch"),
      ),
    ).toBe(true);
  });

  it("retains unexercised members without treating their missing target as a failure", () => {
    const input = fixture();
    input.targets = [input.targets[0]];

    const report = evaluateSourceScopedRolePairSample(input);

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.validatedPairObservations).toHaveLength(1);
    expect(report.roleEvidence[0]).toMatchObject({
      exercisedByConfiguredTargetMemberIds: ["furina"],
      unexercisedByConfiguredTargetMemberIds: ["aino", "xingqiu", "yelan"],
    });
    expect(report.roleEvidence[1]).toMatchObject({
      exercisedByConfiguredTargetMemberIds: ["xilonen"],
      unexercisedByConfiguredTargetMemberIds: [
        "jean",
        "kaedehara_kazuha",
        "sayu",
        "sucrose",
        "xianyun",
      ],
    });
  });

  it("requires explicit acknowledgement of a targeted member condition", () => {
    const missing = fixtureWithOnlyFirstTarget();
    hydroRole(missing).members.find(
      ({ characterId }) => characterId === "furina",
    )?.conditions.push("off-field application is active");

    const failed = evaluateSourceScopedRolePairSample(missing);
    expect(failed.comparisonStatus).toBe("not-comparable");
    expect(failed.validatedPairObservations).toBeNull();
    expect(targetIssueCodes(failed)).toContain("role-condition-unverified");

    const acknowledged = fixtureWithOnlyFirstTarget();
    hydroRole(acknowledged).members.find(
      ({ characterId }) => characterId === "furina",
    )?.conditions.push("off-field application is active");
    acknowledged.targets[0].acknowledgedConditionsByRoleRecordId = {
      [HYDRO_ROLE_RECORD_ID]: ["off-field application is active"],
    };
    const acknowledgedReport =
      evaluateSourceScopedRolePairSample(acknowledged);
    expect(acknowledgedReport.comparisonStatus).toBe("comparable");
    expect(acknowledgedReport.targets[0].roleMemberBindings[0]).toMatchObject({
      requiredConditions: ["off-field application is active"],
      acknowledgedConditions: ["off-field application is active"],
      conditionsMatch: true,
    });
  });

  it("fails closed and reports a missing real VV condition acknowledgement", () => {
    const input = fixture();
    input.targets[1].acknowledgedConditionsByRoleRecordId = {};

    const report = evaluateSourceScopedRolePairSample(input);
    const sucroseBinding = report.targets[1].roleMemberBindings.find(
      ({ characterId }) => characterId === "sucrose",
    );

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.validatedPairObservations).toBeNull();
    expect(targetIssueCodes(report)).toContain("role-condition-unverified");
    expect(sucroseBinding).toMatchObject({
      requiredConditions: [VV_CONDITION],
      acknowledgedConditions: [],
      conditionsMatch: false,
    });
  });

  it("fails closed and exposes a stale real VV condition acknowledgement", () => {
    const input = fixture();
    const staleCondition =
      "Equipped with Viridescent Venerer and triggers a RES reduction.";
    input.targets[2].acknowledgedConditionsByRoleRecordId = {
      [SHRED_ROLE_RECORD_ID]: [staleCondition],
    };

    const report = evaluateSourceScopedRolePairSample(input);
    const jeanBinding = report.targets[2].roleMemberBindings.find(
      ({ characterId }) => characterId === "jean",
    );

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.validatedPairObservations).toBeNull();
    expect(targetIssueCodes(report)).toContain("role-condition-unverified");
    expect(jeanBinding).toMatchObject({
      requiredConditions: [VV_CONDITION],
      acknowledgedConditions: [staleCondition],
      conditionsMatch: false,
    });
  });

  it("fails closed on unverified and out-of-range constellation bounds", () => {
    const unspecified = fixtureWithOnlyFirstTarget();
    const unspecifiedFurina = hydroRole(unspecified).members.find(
      ({ characterId }) => characterId === "furina",
    );
    if (!unspecifiedFurina) throw new Error("Missing Furina role member.");
    unspecifiedFurina.minConstellation = 1;
    expect(targetIssueCodes(evaluateSourceScopedRolePairSample(unspecified))).toContain(
      "role-constellation-unverified",
    );

    const outOfRange = fixtureWithOnlyFirstTarget();
    const boundedFurina = hydroRole(outOfRange).members.find(
      ({ characterId }) => characterId === "furina",
    );
    if (!boundedFurina) throw new Error("Missing Furina role member.");
    boundedFurina.minConstellation = 1;
    outOfRange.targets[0].targetTeam.members[2].investment = {
      status: "partial",
      constellation: 0,
    };
    expect(targetIssueCodes(evaluateSourceScopedRolePairSample(outOfRange))).toContain(
      "role-constellation-out-of-range",
    );
  });

  it("reports structural role-slot ambiguity as multiplicity rather than extra teams", () => {
    const input = fixtureWithOnlyFirstTarget();
    hydroRole(input).members.push({ characterId: "xilonen", conditions: [] });
    shredRole(input).members.push({ characterId: "furina", conditions: [] });
    input.targets[0].expectedStructuralBindingMultiplicity = 2;

    const report = evaluateSourceScopedRolePairSample(input);
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.targets[0].structuralBindingMultiplicity).toBe(2);
    expect(report.validatedPairObservations).toHaveLength(1);

    input.targets[0].expectedStructuralBindingMultiplicity = 1;
    const drifted = evaluateSourceScopedRolePairSample(input);
    expect(drifted.comparisonStatus).toBe("not-comparable");
    expect(drifted.validatedPairObservations).toBeNull();
    expect(targetIssueCodes(drifted)).toContain(
      "structural-multiplicity-mismatch",
    );
  });

  it.each([
    {
      name: "the template is already accepted",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.template.status = "accepted";
      },
      code: "template-record-state-mismatch",
    },
    {
      name: "the template is prematurely promotion eligible",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.template.promotionEligible = true;
      },
      code: "template-record-state-mismatch",
    },
    {
      name: "a target team is already accepted",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.targets[0].targetTeam.status = "accepted";
      },
      code: "target-record-state-mismatch",
    },
    {
      name: "a target team is prematurely promotion eligible",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.targets[0].targetTeam.promotionEligible = true;
      },
      code: "target-record-state-mismatch",
    },
    {
      name: "a role record is rejected",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.roles[0].record.status = "rejected";
      },
      code: "role-record-state-mismatch",
    },
    {
      name: "a role record is already accepted",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.roles[0].record.status = "accepted";
      },
      code: "role-record-state-mismatch",
    },
    {
      name: "a role record is prematurely promotion eligible",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.roles[0].record.promotionEligible = true;
      },
      code: "role-record-state-mismatch",
    },
    {
      name: "a role record claims an exhaustive domain",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.roles[0].record.exhaustiveness = "exhaustive";
      },
      code: "role-evidence-invalid",
    },
    {
      name: "the same role record appears twice",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.roles = [input.roles[0], { ...input.roles[0] }];
      },
      code: "duplicate-role-record",
    },
    {
      name: "a role applies to another template",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.roles[0].record.appliesTo.teamTemplateId = "other-template";
        input.roles[0].expectedTemplateId = "other-template";
      },
      code: "role-application-mismatch",
    },
    {
      name: "both roles apply to one slot",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.roles[1].record.appliesTo.slotId = "off-field-hydro";
        input.roles[1].expectedSlotId = "off-field-hydro";
      },
      code: "duplicate-role-slot",
    },
    {
      name: "the template adds an unresolved role option",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.template.slots[0].options.push({
          type: "roles",
          roleIds: ["on-field-driver"],
        });
      },
      code: "unresolved-additional-role-option",
    },
    {
      name: "the exact role option disappears",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.template.slots[2].options = [{ type: "any" }];
      },
      code: "role-option-missing",
    },
    {
      name: "a positive role member is outside the eligible catalog",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.eligibleCharacters = input.eligibleCharacters.filter(
          ({ characterId }) => characterId !== "xingqiu",
        );
      },
      code: "role-member-not-eligible",
    },
    {
      name: "two target members share one playable identity",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.eligibleCharacters = input.eligibleCharacters.map((entry) =>
          entry.characterId === "furina" || entry.characterId === "xilonen"
            ? { ...entry, playableIdentityId: "shared-test-identity" }
            : entry,
        );
      },
      code: "shared-target-playable-identity",
    },
    {
      name: "a target binds the wrong role member",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.targets[0].roleMemberBindings[0].characterId = "xingqiu";
      },
      code: "role-member-not-in-target",
    },
    {
      name: "a target slot binding disagrees with its named role member",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.targets[0].sourceSlotBinding = {
          keqing: "keqing",
          ineffa: "ineffa",
          "off-field-hydro": "xilonen",
          "resistance-shred": "furina",
        };
      },
      code: "binding-role-member-mismatch",
    },
    {
      name: "two configured targets reuse one exact team",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.targets = [
          ...input.targets,
          {
            ...structuredClone(input.targets[0]),
            targetId: "05-duplicate-team",
          },
        ];
      },
      code: "duplicate-target-team",
    },
    {
      name: "two configured targets reuse one target ID",
      mutate(input: SourceScopedRolePairSampleInput) {
        input.targets = [
          ...input.targets,
          {
            ...structuredClone(input.targets[0]),
            targetId: input.targets[1].targetId,
            targetTeam: structuredClone(input.targets[0].targetTeam),
          },
        ];
        input.targets[input.targets.length - 1].targetTeam.id =
          "kqm:team:synthetic-distinct-team";
        input.targets[input.targets.length - 1].expectedTargetTeamId =
          "kqm:team:synthetic-distinct-team";
      },
      code: "duplicate-target-id",
    },
  ] satisfies Array<{
    name: string;
    mutate(input: SourceScopedRolePairSampleInput): void;
    code: SourceScopedRolePairIssueCode;
  }>) ("fails closed when $name", ({ mutate, code }) => {
    const input = fixture();
    mutate(input);

    const report = evaluateSourceScopedRolePairSample(input);

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.validatedPairObservations).toBeNull();
    expect(allIssueCodes(report)).toContain(code);
  });
});

function fixtureWithOnlyFirstTarget(): SourceScopedRolePairSampleInput {
  const input = fixture();
  input.targets = [input.targets[0]];
  return input;
}

function fixture(): SourceScopedRolePairSampleInput {
  const hydro = roleRecord(
    HYDRO_ROLE_RECORD_ID,
    "off-field-hydro",
    "off-field-hydro-applier",
    ["furina", "aino", "yelan", "xingqiu"],
  );
  const shred = roleRecord(
    SHRED_ROLE_RECORD_ID,
    "resistance-shred",
    "resistance-shred",
    ["kaedehara_kazuha", "sucrose", "jean", "xianyun", "sayu", "xilonen"],
  );
  for (const member of shred.members) {
    if (member.characterId !== "xilonen") member.conditions.push(VV_CONDITION);
  }
  return {
    template: template(),
    expectedTemplateId: TEMPLATE_ID,
    roles: [
      descriptor(hydro, "off-field-hydro", "off-field-hydro-applier"),
      descriptor(shred, "resistance-shred", "resistance-shred"),
    ],
    targets: [
      target(
        "01-furina-xilonen",
        "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
        "furina",
        "xilonen",
      ),
      target(
        "02-aino-sucrose",
        "kqm:team:keqing-ineffa-aino-sucrose-lunar-charged-example",
        "aino",
        "sucrose",
      ),
      target(
        "03-furina-jean",
        "kqm:team:keqing-ineffa-furina-jean-lunar-charged-example",
        "furina",
        "jean",
      ),
      target(
        "04-yelan-kazuha",
        "kqm:team:keqing-ineffa-yelan-kazuha-lunar-charged-example",
        "yelan",
        "kaedehara_kazuha",
      ),
    ],
    eligibleCharacters: eligibleCatalog(),
  };
}

function descriptor(
  record: SourceScopedCharacterRoleRecord,
  slotId: string,
  roleId: string,
): SourceScopedRolePairSampleInput["roles"][number] {
  return {
    record,
    expectedRecordId: record.id,
    expectedTemplateId: TEMPLATE_ID,
    expectedSlotId: slotId,
    expectedRoleId: roleId,
  };
}

function target(
  targetId: string,
  teamId: string,
  hydroCharacterId: string,
  shredCharacterId: string,
): SourceScopedRolePairTargetInput {
  const memberIds = [
    "keqing",
    "ineffa",
    hydroCharacterId,
    shredCharacterId,
  ] as const;
  const acknowledgedConditionsByRoleRecordId =
    shredCharacterId === "xilonen"
      ? undefined
      : { [SHRED_ROLE_RECORD_ID]: [VV_CONDITION] };
  return {
    targetId,
    targetTeam: targetTeam(teamId, memberIds),
    expectedTargetTeamId: teamId,
    expectedMemberCharacterIds: memberIds,
    roleMemberBindings: [
      { roleRecordId: HYDRO_ROLE_RECORD_ID, characterId: hydroCharacterId },
      { roleRecordId: SHRED_ROLE_RECORD_ID, characterId: shredCharacterId },
    ],
    sourceSlotBinding: {
      keqing: "keqing",
      ineffa: "ineffa",
      "off-field-hydro": hydroCharacterId,
      "resistance-shred": shredCharacterId,
    },
    sourceSlotBindingBasis: "same-page-inferred-fit",
    acknowledgedConditionsByRoleRecordId,
    expectedStructuralBindingMultiplicity: 1,
  };
}

function template(): TeamTemplateRecord {
  return {
    id: TEMPLATE_ID,
    kind: "team_template",
    status: "candidate",
    promotionEligible: false,
    label: "Keqing — Ineffa — Hydro — Anemo / Flex",
    intent: "prescriptive",
    exhaustiveness: "unspecified",
    rankingClaim: "none",
    slots: [
      {
        id: "keqing",
        options: [{ type: "characters", characterIds: ["keqing"] }],
      },
      {
        id: "ineffa",
        options: [{ type: "characters", characterIds: ["ineffa"] }],
      },
      {
        id: "off-field-hydro",
        options: [
          { type: "roles", roleIds: ["off-field-hydro-applier"] },
        ],
      },
      {
        id: "resistance-shred",
        options: [{ type: "roles", roleIds: ["resistance-shred"] }],
      },
    ],
    reactions: ["lunarCharged"],
    sourceRefs: [sourceRef(PAGE_URL, "keqing-team-template-lunar-charged")],
    unknowns: [],
  };
}

function roleRecord(
  id: string,
  slotId: string,
  roleId: string,
  memberIds: readonly string[],
): SourceScopedCharacterRoleRecord {
  return {
    id,
    kind: "character_role",
    status: "candidate",
    promotionEligible: false,
    roleId,
    appliesTo: { teamTemplateId: TEMPLATE_ID, slotId },
    members: memberIds.map((characterId) => ({
      characterId,
      conditions: [],
    })),
    exhaustiveness: "unspecified",
    rankingClaim: "none",
    sourceRefs: [sourceRef(PAGE_URL, id.split(":").at(-1) ?? id)],
    unknowns: [],
  };
}

function targetTeam(
  id: string,
  memberIds: readonly [string, string, string, string],
): ExactTeamRecord {
  return {
    id,
    kind: "team",
    status: "candidate",
    promotionEligible: false,
    label: memberIds.join(" — "),
    intent: "example",
    exhaustiveness: "unspecified",
    rankingClaim: "none",
    members: memberIds.map(member) as ExactTeamRecord["members"],
    reactions: ["lunarCharged"],
    damagePlans: [],
    sourceRefs: [sourceRef(PAGE_URL, id.split(":").at(-1) ?? id)],
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
    locator: { url, heading: "Lunar-Charged > Teams" },
  };
}

function eligibleCatalog(): ReleasedCharacterCatalogEntry[] {
  return [
    character("aino", "hydro"),
    character("furina", "hydro"),
    character("ineffa", "electro"),
    character("jean", "anemo"),
    character("kaedehara_kazuha", "anemo"),
    character("keqing", "electro"),
    character("sayu", "anemo"),
    character("sucrose", "anemo"),
    character("xianyun", "anemo"),
    character("xilonen", "geo"),
    character("xingqiu", "hydro"),
    character("yelan", "hydro"),
  ];
}

function character(
  characterId: string,
  elementId: string,
): ReleasedCharacterCatalogEntry {
  return { characterId, elementId };
}

function hydroRole(
  input: SourceScopedRolePairSampleInput,
): SourceScopedCharacterRoleRecord {
  return input.roles.find(
    ({ record }) => record.id === HYDRO_ROLE_RECORD_ID,
  )?.record as SourceScopedCharacterRoleRecord;
}

function shredRole(
  input: SourceScopedRolePairSampleInput,
): SourceScopedCharacterRoleRecord {
  return input.roles.find(
    ({ record }) => record.id === SHRED_ROLE_RECORD_ID,
  )?.record as SourceScopedCharacterRoleRecord;
}

function targetOutcome(targetId: string): {
  targetId: string;
  comparisonStatus: "comparable";
  structuralBindingMultiplicity: 1;
} {
  return {
    targetId,
    comparisonStatus: "comparable",
    structuralBindingMultiplicity: 1,
  };
}

function targetIssueCodes(
  report: ReturnType<typeof evaluateSourceScopedRolePairSample>,
): SourceScopedRolePairIssueCode[] {
  return report.targets.flatMap(({ issues }) =>
    issues.map(({ code }) => code),
  );
}

function allIssueCodes(
  report: ReturnType<typeof evaluateSourceScopedRolePairSample>,
): SourceScopedRolePairIssueCode[] {
  return [
    ...report.issues.map(({ code }) => code),
    ...targetIssueCodes(report),
  ];
}
