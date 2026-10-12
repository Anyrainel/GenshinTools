import { characters } from "@/generated/catalog/resources";
import { describe, expect, it, vi } from "vitest";
import { loadGameCatalogs } from "../src/catalogs";
import { readJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import {
  buildTeamRosterCandidateDomainReport,
  type ReleasedCharacterCatalogEntry,
  type TeamRosterCandidateTemplateReport,
  type TeamRosterReactionGateEnvironment,
  type TeamTemplateRecord,
} from "../src/teamRosterCandidateDomain";
import { KnowledgeRepositorySchema } from "../src/schemas";

const FURINA_ELECTRO_CHARGED =
  "kqm:team-template:furina-team-template-electro-charged";
const FURINA_FREEZE = "kqm:team-template:furina-team-template-freeze";
const FURINA_HYPERCARRY =
  "kqm:team-template:furina-team-template-hypercarry-mono";
const FURINA_QUICKBLOOM =
  "kqm:team-template:furina-team-template-quickbloom";
const FURINA_VAPORIZE =
  "kqm:team-template:furina-team-template-vaporize";
const KEQING_LUNAR_CHARGED =
  "kqm:team-template:keqing-team-template-lunar-charged";

describe("team roster candidate domain", () => {
  it(
    "enumerates the four resolved KQM templates and gates reactions with TeamMeta",
    async () => {
      const repository = KnowledgeRepositorySchema.parse(
        await readJson(KNOWLEDGE_REPOSITORY_PATH),
      );
      const templateIds = new Set([
        FURINA_ELECTRO_CHARGED,
        FURINA_FREEZE,
        FURINA_HYPERCARRY,
        FURINA_QUICKBLOOM,
        FURINA_VAPORIZE,
        KEQING_LUNAR_CHARGED,
      ]);
      const templates = repository.records.filter(
        (record): record is TeamTemplateRecord =>
          record.kind === "team_template" && templateIds.has(record.id),
      );
      const releasedCharacters = await guideDomainCatalog();

      const report = await buildTeamRosterCandidateDomainReport({
        templates,
        releasedCharacters,
        holdoutTargets: [
          {
            targetId:
              "kqm:team:furina-alhaitham-shinobu-nahida-quickbloom-example",
            templateId: FURINA_QUICKBLOOM,
            memberCharacterIds: [
              "furina",
              "alhaitham",
              "kuki_shinobu",
              "nahida",
            ],
            expectedOutcome: "accepted",
            expectedStructuralAssignmentMultiplicity: 2,
            sourceSlotBinding: {
              furina: "furina",
              dendro: "alhaitham",
              electro: "kuki_shinobu",
              flex: "nahida",
            },
            sourceSlotBindingBasis: "same-page-inferred-fit",
            category: "same-page-authored-example",
            provenance: {
              sourceId: "kqm",
              sourceRecordId:
                "furina-alhaitham-shinobu-nahida-quickbloom-example",
            },
          },
          {
            targetId: "kqm:team:furina-nahida-cyno-baizhu-quickbloom-example",
            templateId: FURINA_QUICKBLOOM,
            memberCharacterIds: ["furina", "nahida", "cyno", "baizhu"],
            expectedOutcome: "accepted",
            expectedStructuralAssignmentMultiplicity: 2,
            sourceSlotBinding: {
              furina: "furina",
              dendro: "nahida",
              electro: "cyno",
              flex: "baizhu",
            },
            sourceSlotBindingBasis: "same-page-inferred-fit",
            category: "same-page-authored-example",
            provenance: {
              sourceId: "kqm",
              sourceRecordId:
                "furina-nahida-cyno-baizhu-quickbloom-example",
            },
          },
          {
            targetId: "runtime-negative:furina-keqing-ineffa-xilonen",
            templateId: FURINA_ELECTRO_CHARGED,
            memberCharacterIds: ["furina", "keqing", "ineffa", "xilonen"],
            expectedOutcome: "reaction-rejected",
            expectedStructuralAssignmentMultiplicity: 2,
            category: "explicit-runtime-gate-negative",
          },
          {
            targetId:
              "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
            templateId: KEQING_LUNAR_CHARGED,
            memberCharacterIds: ["keqing", "ineffa", "furina", "xilonen"],
            expectedOutcome: "template-withheld",
            category: "same-page-authored-example",
          },
        ],
      });

      expect(report.catalogBoundary).toMatchObject({
        label: "guide-domain-eligible-released-character-ids",
        characterCount: 127,
        characterIdsSha256:
          "9a0fd29ca4344912db8b5b77ba64dea7a4e073761df0ec618e73816257d7ddfa",
        playableIdentityCount: 121,
      });
      expect(
        report.catalogBoundary.sharedPlayableIdentityGroups,
      ).toContainEqual({
        playableIdentityId: "traveler",
        characterIds: [
          "traveler_anemo",
          "traveler_cryo",
          "traveler_dendro",
          "traveler_electro",
          "traveler_geo",
          "traveler_hydro",
          "traveler_pyro",
        ],
      });

      expectComparable(report.templates, FURINA_ELECTRO_CHARGED, {
        validOrderedAssignmentCount: 88_718,
        acceptedOrderedAssignmentCount: 71_357,
        rejectedOrderedAssignmentCount: 17_361,
        acceptedCanonicalRosterCount: 44_307,
        structuralDomainSha256:
          "a65ecd79c8f2ae9be691bfefd058d959ce44098dbf0da3dec9ad333eb6c8141a",
      });
      expect(
        templateReport(report.templates, FURINA_ELECTRO_CHARGED)
          .reactionAcceptedDomainSha256,
      ).toBe(
        "027821e7cdd7d4a9c2bc349e58b1fd6112056bc1d13cbd93606749a31fbf9d11",
      );
      expectComparable(report.templates, FURINA_FREEZE, {
        validOrderedAssignmentCount: 103_066,
        acceptedOrderedAssignmentCount: 103_066,
        rejectedOrderedAssignmentCount: 0,
        acceptedCanonicalRosterCount: 60_680,
        structuralDomainSha256:
          "39532fc3d426837f2c6da075fd08ac71d71b41e2b77c055967a37f7bcaf82cf6",
      });
      expectComparable(report.templates, FURINA_QUICKBLOOM, {
        validOrderedAssignmentCount: 31_930,
        acceptedOrderedAssignmentCount: 31_930,
        rejectedOrderedAssignmentCount: 0,
        acceptedCanonicalRosterCount: 27_931,
        structuralDomainSha256:
          "66bb9991880b99e16ee1ab554e1ebbad762560fbaeab216f1878a958a3f078dc",
      });
      expect(templateReport(report.templates, FURINA_QUICKBLOOM)).toMatchObject({
        assignmentMultiplicityHistogram: [
          { assignmentCount: 1, rosterCount: 23_932 },
          { assignmentCount: 2, rosterCount: 3_999 },
        ],
      });
      expectComparable(report.templates, FURINA_VAPORIZE, {
        validOrderedAssignmentCount: 128_690,
        acceptedOrderedAssignmentCount: 128_690,
        rejectedOrderedAssignmentCount: 0,
        acceptedCanonicalRosterCount: 80_509,
        structuralDomainSha256:
          "3beff4d290d1f2f2f650782667fbab631bbbf0721d1346a9906a3d811ee985f1",
      });

      expect(templateReport(report.templates, FURINA_HYPERCARRY)).toMatchObject({
        status: "withheld-unresolved-role",
        unresolvedRoleIds: ["healer"],
        theoreticalOrderedAssignmentCount: null,
        structuralDomainSha256: null,
      });
      expect(
        templateReport(report.templates, KEQING_LUNAR_CHARGED),
      ).toMatchObject({
        status: "withheld-unresolved-role",
        unresolvedRoleIds: [
          "off-field-hydro-applier",
          "resistance-shred",
        ],
      });
      expect(
        templateReport(report.templates, FURINA_ELECTRO_CHARGED)
          .samePlayableIdentityAssignmentRejectionCount,
      ).toBeGreaterThan(0);

      expect(report.holdouts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            targetId:
              "kqm:team:furina-alhaitham-shinobu-nahida-quickbloom-example",
            actualOutcome: "accepted",
            structuralMembership: true,
            acceptedMembership: true,
            structuralAssignmentMultiplicity: 2,
            bindingMultiplicityMatchesExpectation: true,
            sourceSlotBindingMembership: true,
            sourceSlotBindingBasis: "same-page-inferred-fit",
            failure: null,
          }),
          expect.objectContaining({
            targetId: "runtime-negative:furina-keqing-ineffa-xilonen",
            actualOutcome: "reaction-rejected",
            structuralMembership: true,
            acceptedMembership: false,
            reactionRejected: true,
            reactionById: { electroCharged: false },
          }),
          expect.objectContaining({
            targetId:
              "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
            actualOutcome: "template-withheld",
          }),
        ]),
      );
      expect(report.allHoldoutsMatch).toBe(true);
      expect(report.failures).toEqual([]);
      expect(report.claimFlags).toEqual({
        supportsRanking: false,
        supportsRecommendation: false,
        supportsDamageComparison: false,
        supportsOptimality: false,
        supportsIndependentGameplayValidation: false,
        usesEnergyRecovery: false,
      });
      expect(JSON.stringify(report)).not.toContain("canonicalRosters");
    },
    15_000,
  );

  it("rejects exact duplicates and multiple Traveler element forms separately", async () => {
    const report = await buildTeamRosterCandidateDomainReport(
      {
        templates: [
          template("multiplicity", [
            characterSlot("first", "a", "b"),
            characterSlot("second", "a", "b"),
            characterSlot("third", "c"),
            characterSlot("fourth", "d"),
          ]),
          template("traveler-identity", [
            characterSlot("first", "traveler_hydro"),
            characterSlot("second", "traveler_electro"),
            characterSlot("third", "c"),
            characterSlot("fourth", "d"),
          ]),
        ],
        releasedCharacters: [
          catalogEntry("a", "hydro"),
          catalogEntry("b", "electro"),
          catalogEntry("c", "dendro"),
          catalogEntry("d", "anemo"),
          catalogEntry("traveler_hydro", "hydro"),
          catalogEntry("traveler_electro", "electro"),
        ],
        holdoutTargets: [],
      },
      acceptingGate(),
    );

    expect(templateReport(report.templates, "multiplicity")).toMatchObject({
      theoreticalOrderedAssignmentCount: 4,
      validOrderedAssignmentCount: 2,
      duplicateMemberAssignmentRejectionCount: 2,
      exactDuplicateMemberAssignmentRejectionCount: 2,
      samePlayableIdentityAssignmentRejectionCount: 0,
      canonicalRosterCount: 1,
      assignmentMultiplicityHistogram: [
        { assignmentCount: 2, rosterCount: 1 },
      ],
    });
    expect(templateReport(report.templates, "traveler-identity")).toMatchObject({
      theoreticalOrderedAssignmentCount: 1,
      validOrderedAssignmentCount: 0,
      duplicateMemberAssignmentRejectionCount: 1,
      exactDuplicateMemberAssignmentRejectionCount: 0,
      samePlayableIdentityAssignmentRejectionCount: 1,
      canonicalRosterCount: 0,
      structuralDomainSha256:
        "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570",
      reactionAcceptedDomainSha256:
        "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570",
    });
  });

  it("withholds required roles without invoking or guessing the role gate", async () => {
    const evaluate = vi.fn(() => ({ accepted: true, byReaction: {} }));
    const report = await buildTeamRosterCandidateDomainReport(
      {
        templates: [
          template("role-template", [
            characterSlot("first", "a"),
            {
              id: "healer",
              options: [{ type: "roles", roleIds: ["healer"] }],
            },
            characterSlot("third", "c"),
            characterSlot("fourth", "d"),
          ]),
        ],
        releasedCharacters: [
          catalogEntry("a", "hydro"),
          catalogEntry("b", "electro"),
          catalogEntry("c", "dendro"),
          catalogEntry("d", "anemo"),
        ],
        holdoutTargets: [],
      },
      { evaluate },
    );

    expect(templateReport(report.templates, "role-template")).toMatchObject({
      status: "withheld-unresolved-role",
      unresolvedRoleIds: ["healer"],
      theoreticalOrderedAssignmentCount: null,
      reactionGate: null,
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("fails closed on reaction-gate errors while retaining structural evidence", async () => {
    const report = await buildTeamRosterCandidateDomainReport(
      {
        templates: [
          template(
            "gate-failure",
            [
              characterSlot("first", "a"),
              characterSlot("second", "b"),
              characterSlot("third", "c"),
              characterSlot("fourth", "d"),
            ],
            ["vaporize"],
          ),
        ],
        releasedCharacters: [
          catalogEntry("a", "hydro"),
          catalogEntry("b", "pyro"),
          catalogEntry("c", "dendro"),
          catalogEntry("d", "anemo"),
        ],
        holdoutTargets: [
          {
            targetId: "gate-failure-holdout",
            templateId: "gate-failure",
            memberCharacterIds: ["a", "b", "c", "d"],
            expectedOutcome: "template-not-comparable",
          },
        ],
      },
      {
        evaluate: () => {
          throw new Error("injected TeamMeta failure");
        },
      },
    );

    expect(templateReport(report.templates, "gate-failure")).toMatchObject({
      status: "not-comparable",
      validOrderedAssignmentCount: 1,
      canonicalRosterCount: 1,
      structuralDomainSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      reactionAcceptedDomainSha256: null,
      reactionGate: {
        status: "failed",
        declaredReactions: ["vaporize"],
        acceptedCanonicalRosterCount: null,
        acceptedOrderedAssignmentCount: null,
      },
      failures: [
        expect.objectContaining({ code: "reaction-gate-evaluate-failed" }),
      ],
    });
    expect(report.holdouts[0]).toMatchObject({
      actualOutcome: "template-not-comparable",
      structuralMembership: true,
      acceptedMembership: null,
      structuralAssignmentMultiplicity: 1,
    });
    expect(report.failures).toContainEqual(
      expect.objectContaining({ code: "reaction-gate-evaluate-failed" }),
    );
  });

  it("fails every affected template closed when reaction-gate preparation fails", async () => {
    const evaluate = vi.fn(() => ({
      accepted: true,
      byReaction: { vaporize: true },
    }));
    const report = await buildTeamRosterCandidateDomainReport(
      {
        templates: [
          template(
            "prepare-failure",
            [
              characterSlot("first", "a"),
              characterSlot("second", "b"),
              characterSlot("third", "c"),
              characterSlot("fourth", "d"),
            ],
            ["vaporize"],
          ),
        ],
        releasedCharacters: [
          catalogEntry("a", "hydro"),
          catalogEntry("b", "pyro"),
          catalogEntry("c", "dendro"),
          catalogEntry("d", "anemo"),
        ],
        holdoutTargets: [],
      },
      {
        prepare: async () => {
          throw new Error("injected preload failure");
        },
        evaluate,
      },
    );

    expect(templateReport(report.templates, "prepare-failure")).toMatchObject({
      status: "not-comparable",
      validOrderedAssignmentCount: 1,
      structuralDomainSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      reactionAcceptedDomainSha256: null,
      reactionGate: {
        status: "failed",
        declaredReactions: ["vaporize"],
      },
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "reaction-gate-prepare-failed" }),
      ]),
    );
  });

  it("keeps reactionless templates comparable when preparation fails for another template", async () => {
    const evaluate = vi.fn(() => ({
      accepted: true,
      byReaction: { vaporize: true },
    }));
    const slots = [
      characterSlot("first", "a"),
      characterSlot("second", "b"),
      characterSlot("third", "c"),
      characterSlot("fourth", "d"),
    ];
    const report = await buildTeamRosterCandidateDomainReport(
      {
        templates: [
          template("reactionless", slots),
          template("reactionful", slots, ["vaporize"]),
        ],
        releasedCharacters: [
          catalogEntry("a", "hydro"),
          catalogEntry("b", "pyro"),
          catalogEntry("c", "dendro"),
          catalogEntry("d", "anemo"),
        ],
        holdoutTargets: [],
      },
      {
        prepare: async () => {
          throw new Error("injected preload failure");
        },
        evaluate,
      },
    );

    expect(templateReport(report.templates, "reactionful").status).toBe(
      "not-comparable",
    );
    expect(templateReport(report.templates, "reactionless")).toMatchObject({
      status: "comparable",
      reactionGate: {
        status: "completed",
        declaredReactions: [],
        acceptedCanonicalRosterCount: 1,
        rejectedCanonicalRosterCount: 0,
      },
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("turns invalid inputs and holdout mismatches into typed failures", async () => {
    const invalidReactionTemplate = {
      ...template("invalid-reaction", [
        characterSlot("first", "a"),
        characterSlot("second", "b"),
        characterSlot("third", "c"),
        characterSlot("fourth", "d"),
      ]),
      reactions: ["invented-reaction"],
    } as unknown as TeamTemplateRecord;
    const report = await buildTeamRosterCandidateDomainReport(
      {
        templates: [invalidReactionTemplate],
        releasedCharacters: [
          catalogEntry("a", "hydro"),
          catalogEntry("b", "pyro"),
          catalogEntry("c", "dendro"),
          catalogEntry("d", "anemo"),
        ],
        holdoutTargets: [
          {
            targetId: "duplicate-target",
            templateId: "invalid-reaction",
            memberCharacterIds: ["a", "b", "c", "d"],
            expectedOutcome: "accepted",
          },
          {
            targetId: "duplicate-target",
            templateId: "invalid-reaction",
            memberCharacterIds: ["a", "b", "c", "d"],
            expectedOutcome: "accepted",
          },
          {
            targetId: "mismatched-target",
            templateId: "invalid-reaction",
            memberCharacterIds: ["a", "b", "c", "d"],
            expectedOutcome: "accepted",
          },
        ],
      },
      acceptingGate(),
    );

    expect(templateReport(report.templates, "invalid-reaction")).toMatchObject({
      status: "not-comparable",
      failures: [expect.objectContaining({ code: "invalid-template-reaction" })],
    });
    expect(report.holdouts).toHaveLength(3);
    expect(report.holdouts.every((target) => !target.matchesExpectation)).toBe(
      true,
    );
    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-template-reaction" }),
        expect.objectContaining({ code: "duplicate-holdout-target" }),
        expect.objectContaining({ code: "holdout-expectation-mismatch" }),
      ]),
    );
    expect(report.allHoldoutsMatch).toBe(false);

    const invalidCatalogReport = await buildTeamRosterCandidateDomainReport(
      {
        templates: [
          template("invalid-catalog", [
            characterSlot("first", "a"),
            characterSlot("second", "b"),
            characterSlot("third", "c"),
            characterSlot("fourth", "d"),
          ]),
        ],
        releasedCharacters: [
          catalogEntry("a", "hydro"),
          catalogEntry("b", "pyro"),
          catalogEntry("c", "dendro"),
          catalogEntry("d", "void"),
        ],
        holdoutTargets: [],
      },
      acceptingGate(),
    );
    expect(invalidCatalogReport.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-catalog-entry" }),
      ]),
    );
    expect(
      templateReport(invalidCatalogReport.templates, "invalid-catalog").status,
    ).toBe("not-comparable");
  });
});

async function guideDomainCatalog(): Promise<ReleasedCharacterCatalogEntry[]> {
  const catalogs = await loadGameCatalogs();
  expect(catalogs.reactionIds.has("shatter")).toBe(true);
  expect(catalogs.reactionIds.has("crystallize")).toBe(true);
  return characters
    .filter(({ id }) => !/^manekin(?:a)?_/.test(id))
    .map(({ id }) => {
      const elementId = catalogs.characterElements.get(id);
      if (!elementId) throw new Error(`Missing stable element for ${id}`);
      return { characterId: id, elementId };
    });
}

function expectComparable(
  reports: TeamRosterCandidateTemplateReport[],
  templateId: string,
  expected: {
    validOrderedAssignmentCount: number;
    acceptedOrderedAssignmentCount: number;
    rejectedOrderedAssignmentCount: number;
    acceptedCanonicalRosterCount: number;
    structuralDomainSha256: string;
  },
): void {
  expect(templateReport(reports, templateId)).toMatchObject({
    status: "comparable",
    validOrderedAssignmentCount: expected.validOrderedAssignmentCount,
    structuralDomainSha256: expected.structuralDomainSha256,
    reactionGate: {
      status: "completed",
      acceptedCanonicalRosterCount: expected.acceptedCanonicalRosterCount,
      acceptedOrderedAssignmentCount: expected.acceptedOrderedAssignmentCount,
      rejectedOrderedAssignmentCount: expected.rejectedOrderedAssignmentCount,
    },
    failures: [],
  });
}

function templateReport(
  reports: TeamRosterCandidateTemplateReport[],
  templateId: string,
): TeamRosterCandidateTemplateReport {
  const report = reports.find((candidate) => candidate.templateId === templateId);
  if (!report) throw new Error(`Missing template report ${templateId}`);
  return report;
}

function catalogEntry(
  characterId: string,
  elementId: string,
): ReleasedCharacterCatalogEntry {
  return { characterId, elementId };
}

function template(
  id: string,
  slots: TeamTemplateRecord["slots"],
  reactions?: string[],
): TeamTemplateRecord {
  return {
    id,
    kind: "team_template",
    status: "candidate",
    promotionEligible: false,
    intent: "example",
    exhaustiveness: "non-exhaustive",
    rankingClaim: "none",
    slots,
    reactions,
    sourceRefs: [
      {
        sourceId: "test",
        sourceRecordId: id,
        locator: { url: "https://example.com/guide", heading: "Teams" },
      },
    ],
    unknowns: [],
  };
}

function characterSlot(
  id: string,
  ...characterIds: string[]
): TeamTemplateRecord["slots"][number] {
  return {
    id,
    options: [{ type: "characters", characterIds }],
  };
}

function acceptingGate(): TeamRosterReactionGateEnvironment {
  return {
    evaluate: ({ declaredReactions }) => ({
      accepted: true,
      byReaction: Object.fromEntries(
        declaredReactions.map((reaction) => [reaction, true]),
      ),
    }),
  };
}
