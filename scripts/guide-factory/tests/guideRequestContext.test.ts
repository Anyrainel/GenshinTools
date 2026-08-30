import { describe, expect, it } from "vitest";
import {
  buildGuideRequestContextApplicabilityReport,
  type GuideRequestClaimRule,
  type GuideRequestContext,
  type GuideRequestContextApplicabilityReport,
  type GuideRequestContextPredicateAst,
} from "../src/guideRequestContext";
import { GuideRequestContextSchema } from "../src/guideRequestContextSchema";
import { sha256Text, stableJson } from "../src/io";
import {
  buildSourceConditionedGuidePacketReport,
  type SourceConditionedAtomicClaim,
  type SourceConditionedGuidePacketInput,
  type SourceConditionedGuidePacketReport,
  type SourceConditionPredicateAst,
  type SourceTeamPacketInput,
} from "../src/sourceConditionedGuidePacket";

const ROLE_CLAIM = "claim:role";
const INVENTORY_CLAIM = "claim:inventory";
const ROSTER_PASSIVE_CLAIM = "claim:roster-passive";
const DEFERRED_CLAIM = "claim:deferred";
const PREFERENCE_CLAIM = "claim:preference";
const TEAM_A = "repository:team-a";
const TEAM_B = "repository:team-b";
const ITTO = "itto";

describe("guide request/account context applicability", () => {
  it("keeps omitted request and account facts unknown while retaining all capability refusals", () => {
    const report = project(
      {},
      [
        rule(ROLE_CLAIM, "predicate", {
          type: "intended-role-is",
          characterId: ITTO,
          roleId: "on-field-dps",
        }),
        rule(INVENTORY_CLAIM, "predicate", {
          type: "weapon-inventory-includes",
          weaponId: "redhorn_stonethresher",
        }),
      ],
    );

    expect(report.comparisonStatus).toBe("comparable");
    expect(cell(report, ROLE_CLAIM)).toMatchObject({
      sourceControl: { resolution: "unresolved-context" },
      resolution: "unresolved-context",
      requestContextBindings: [
        {
          result: "unknown",
          predicateRows: [
            expect.objectContaining({
              factProvenance: "request",
              result: "unknown",
            }),
          ],
        },
      ],
    });
    expect(cell(report, INVENTORY_CLAIM)).toMatchObject({
      resolution: "unresolved-context",
      requestContextBindings: [
        {
          result: "unknown",
          predicateRows: [
            expect.objectContaining({
              factProvenance: "account",
              result: "unknown",
            }),
          ],
        },
      ],
    });
    expect(cell(report, DEFERRED_CLAIM).resolution).toBe(
      "deferred-omitted-energy-prerequisite",
    );
    expect(report).toMatchObject({
      supportsGuideClaims: false,
      playerFacingRecommendations: false,
      ranking: false,
      damage: false,
      optimality: false,
      formulas: false,
      rotations: false,
      ER: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      energyRecoveryInputsUsed: false,
      baselineEquipmentUsed: false,
      axesMultipliedIntoBuilds: false,
      policyBoundary: {
        requestContextMaySatisfyExactSourceTeamFacts: false,
        omittedFacts: "unknown",
        missingWeaponInCompleteInventory: "false",
        missingWeaponInIncompleteInventory: "unknown",
      },
    });
    expect(report.summary.assembledBuildCount).toBe(0);
  });

  it("treats a missing weapon as false only for a complete inventory domain", () => {
    const inventoryRule = rule(INVENTORY_CLAIM, "predicate", {
      type: "weapon-inventory-includes",
      weaponId: "redhorn_stonethresher",
    });
    const complete = project(
      {
        accountFacts: {
          snapshotId: "complete-inventory",
          weaponInventory: {
            domain: "complete",
            weaponIds: ["whiteblind"],
          },
        },
      },
      [inventoryRule],
    );
    const incomplete = project(
      {
        accountFacts: {
          snapshotId: "incomplete-inventory",
          weaponInventory: {
            domain: "incomplete",
            weaponIds: ["whiteblind"],
          },
        },
      },
      [inventoryRule],
    );
    const observed = project(
      {
        accountFacts: {
          snapshotId: "observed-inventory",
          weaponInventory: {
            domain: "incomplete",
            weaponIds: ["redhorn_stonethresher"],
          },
        },
      },
      [inventoryRule],
    );

    expect(cell(complete, INVENTORY_CLAIM)).toMatchObject({
      resolution: "inapplicable",
      contextApplicability: "not-applicable-under-supplied-context",
      requestContextBindings: [{ result: "false" }],
    });
    expect(cell(incomplete, INVENTORY_CLAIM)).toMatchObject({
      resolution: "unresolved-context",
      requestContextBindings: [{ result: "unknown" }],
    });
    expect(cell(observed, INVENTORY_CLAIM)).toMatchObject({
      resolution: "matched",
      contextApplicability: "applicable-under-supplied-context",
      requestContextBindings: [{ result: "true" }],
    });
  });

  it("evaluates nested any/all predicates with three-valued semantics", () => {
    const requestPredicate = {
      type: "all",
      predicates: [
        {
          type: "intended-role-is",
          characterId: ITTO,
          roleId: "on-field-dps",
        },
        {
          type: "any",
          predicates: [
            {
              type: "optimization-goal-is",
              characterId: ITTO,
              goalId: "speedrun",
            },
            {
              type: "acquisition-preference-is",
              preferenceId: "owned-only",
            },
          ],
        },
      ],
    } satisfies GuideRequestContextPredicateAst;
    const matched = project(
      {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: {
              [ITTO]: {
                intendedRole: "on-field-dps",
                optimizationGoal: "comfort",
              },
            },
            acquisitionPreference: "owned-only",
          },
        },
      },
      [rule(PREFERENCE_CLAIM, "predicate", requestPredicate)],
    );
    const unresolved = project(
      {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: {
              [ITTO]: { intendedRole: "on-field-dps" },
            },
            acquisitionPreference: "craftable-only",
          },
        },
      },
      [rule(PREFERENCE_CLAIM, "predicate", requestPredicate)],
    );
    const inapplicable = project(
      {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: {
              [ITTO]: { intendedRole: "off-field-support" },
            },
            acquisitionPreference: "owned-only",
          },
        },
      },
      [rule(PREFERENCE_CLAIM, "predicate", requestPredicate)],
    );

    expect(cell(matched, PREFERENCE_CLAIM)).toMatchObject({
      resolution: "matched",
      requestContextBindings: [
        {
          result: "true",
          predicateRows: [
            expect.objectContaining({ predicateType: "intended-role-is" }),
            expect.objectContaining({ predicateType: "optimization-goal-is" }),
            expect.objectContaining({
              predicateType: "acquisition-preference-is",
            }),
          ],
        },
      ],
    });
    expect(cell(unresolved, PREFERENCE_CLAIM).resolution).toBe(
      "unresolved-context",
    );
    expect(cell(inapplicable, PREFERENCE_CLAIM).resolution).toBe(
      "inapplicable",
    );
  });

  it("evaluates constellation-or-talent thresholds with exact three-valued semantics", () => {
    const numericRule = rule(PREFERENCE_CLAIM, "predicate", {
      type: "any",
      predicates: [
        {
          type: "constellation-at-least",
          characterId: ITTO,
          threshold: 6,
        },
        {
          type: "talent-level-at-least",
          characterId: ITTO,
          talent: "burst",
          threshold: 10,
        },
      ],
    });
    const cases = [
      { facts: {}, result: "unknown" },
      { facts: { constellation: 5 }, result: "unknown" },
      { facts: { talentLevels: { burst: 9 } }, result: "unknown" },
      {
        facts: { constellation: 5, talentLevels: { burst: 9 } },
        result: "false",
      },
      { facts: { constellation: 6 }, result: "true" },
      { facts: { talentLevels: { burst: 10 } }, result: "true" },
      {
        facts: { constellation: 6, talentLevels: { burst: 9 } },
        result: "true",
      },
      {
        facts: { constellation: 5, talentLevels: { burst: 10 } },
        result: "true",
      },
    ] as const;

    for (const { facts, result } of cases) {
      const report = project(
        {
          requestFactsByTeamRecordId: {
            [TEAM_A]: { characterFactsById: { [ITTO]: facts } },
          },
        },
        [numericRule],
      );
      expect(report.comparisonStatus).toBe("comparable");
      expect(
        cell(report, PREFERENCE_CLAIM).requestContextBindings[0]?.result,
      ).toBe(result);
    }

    const falseReport = project(
      {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: {
              [ITTO]: { constellation: 5, talentLevels: { burst: 9 } },
            },
          },
        },
      },
      [numericRule],
    );
    expect(falseReport.context).toEqual({
      requestFactsByTeamRecordId: {
        [TEAM_A]: {
          characterFactsById: {
            [ITTO]: { constellation: 5, talentLevels: { burst: 9 } },
          },
        },
      },
    });
    expect(falseReport.factProvenance).toMatchObject({
      constellation: "request",
      talentLevels: "request",
    });
    expect(falseReport.sourceControl).toMatchObject({
      reportType: "source-conditioned-guide-packet-report",
    });
    expect(sourceFixture().policyBoundary.talentLevelsEvaluated).toBe(false);

    const c6Only = project(
      {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: { [ITTO]: { constellation: 6 } },
          },
        },
      },
      [numericRule],
    );
    const rows = cell(c6Only, PREFERENCE_CLAIM).requestContextBindings[0]
      ?.predicateRows;
    expect(rows).toEqual([
      expect.objectContaining({
        predicateType: "constellation-at-least",
        result: "true",
        factScope: {
          teamRecordId: TEAM_A,
          characterId: ITTO,
          accountSnapshotId: null,
        },
      }),
      expect.objectContaining({
        predicateType: "talent-level-at-least",
        result: "unknown",
        factScope: {
          teamRecordId: TEAM_A,
          characterId: ITTO,
          accountSnapshotId: null,
        },
      }),
    ]);
  });

  it("evaluates lower-investment constellation-and-talent facts with false-dominant three-valued semantics", () => {
    const lowerInvestmentRule = rule(PREFERENCE_CLAIM, "predicate", {
      type: "all",
      predicates: [
        {
          type: "constellation-at-most",
          characterId: ITTO,
          threshold: 5,
        },
        {
          type: "talent-level-is",
          characterId: ITTO,
          talent: "burst",
          threshold: 9,
        },
      ],
    });
    const cases = [
      { facts: {}, result: "unknown" },
      { facts: { constellation: 5 }, result: "unknown" },
      { facts: { talentLevels: { burst: 9 } }, result: "unknown" },
      {
        facts: { constellation: 5, talentLevels: { burst: 9 } },
        result: "true",
      },
      {
        facts: { constellation: 6, talentLevels: { burst: 9 } },
        result: "false",
      },
      {
        facts: { constellation: 5, talentLevels: { burst: 10 } },
        result: "false",
      },
      { facts: { constellation: 6 }, result: "false" },
      { facts: { talentLevels: { burst: 10 } }, result: "false" },
    ] as const;

    for (const { facts, result } of cases) {
      const report = project(
        {
          requestFactsByTeamRecordId: {
            [TEAM_A]: { characterFactsById: { [ITTO]: facts } },
          },
        },
        [lowerInvestmentRule],
      );
      expect(report.comparisonStatus).toBe("comparable");
      expect(
        cell(report, PREFERENCE_CLAIM).requestContextBindings[0]?.result,
      ).toBe(result);
    }

    const c5Only = project(
      {
        requestFactsByTeamRecordId: {
          [TEAM_A]: { characterFactsById: { [ITTO]: { constellation: 5 } } },
        },
      },
      [lowerInvestmentRule],
    );
    expect(
      cell(c5Only, PREFERENCE_CLAIM).requestContextBindings[0]?.predicateRows,
    ).toEqual([
      expect.objectContaining({
        predicateType: "constellation-at-most",
        result: "true",
        factProvenance: "request",
        factScope: {
          teamRecordId: TEAM_A,
          characterId: ITTO,
          accountSnapshotId: null,
        },
      }),
      expect.objectContaining({
        predicateType: "talent-level-is",
        result: "unknown",
        factProvenance: "request",
        factScope: {
          teamRecordId: TEAM_A,
          characterId: ITTO,
          accountSnapshotId: null,
        },
      }),
    ]);
  });

  it("accepts both valid constellation-at-most boundary thresholds", () => {
    for (const { threshold, constellation, result } of [
      { threshold: 0, constellation: 0, result: "true" },
      { threshold: 0, constellation: 1, result: "false" },
      { threshold: 6, constellation: 6, result: "true" },
    ] as const) {
      const report = project(
        {
          requestFactsByTeamRecordId: {
            [TEAM_A]: {
              characterFactsById: { [ITTO]: { constellation } },
            },
          },
        },
        [
          rule(PREFERENCE_CLAIM, "predicate", {
            type: "constellation-at-most",
            characterId: ITTO,
            threshold,
          }),
        ],
      );
      expect(report.comparisonStatus).toBe("comparable");
      expect(
        cell(report, PREFERENCE_CLAIM).requestContextBindings[0]?.result,
      ).toBe(result);
    }
  });

  it("fails closed for invalid numeric request facts and thresholds", () => {
    const validPredicate = {
      type: "constellation-at-least",
      characterId: ITTO,
      threshold: 6,
    } as const;
    const invalidConstellation = project(
      {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: { [ITTO]: { constellation: 7 } },
          },
        },
      },
      [rule(PREFERENCE_CLAIM, "predicate", validPredicate)],
    );
    const invalidTalent = project(
      {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: {
              [ITTO]: { talentLevels: { burst: 0 } },
            },
          },
        },
      },
      [rule(PREFERENCE_CLAIM, "predicate", validPredicate)],
    );
    const invalidThreshold = project({}, [
      rule(PREFERENCE_CLAIM, "predicate", {
        type: "talent-level-at-least",
        characterId: ITTO,
        talent: "burst",
        threshold: 0,
      }),
    ]);
    const invalidAtMostThreshold = project({}, [
      rule(PREFERENCE_CLAIM, "predicate", {
        type: "constellation-at-most",
        characterId: ITTO,
        threshold: 7,
      } as never),
    ]);
    const invalidTalentLevelIs = project({}, [
      rule(PREFERENCE_CLAIM, "predicate", {
        type: "talent-level-is",
        characterId: ITTO,
        talent: "burst",
        threshold: 0,
      } as never),
    ]);
    const fractionalAtMostThreshold = project({}, [
      rule(PREFERENCE_CLAIM, "predicate", {
        type: "constellation-at-most",
        characterId: ITTO,
        threshold: 5.5,
      } as never),
    ]);
    const malformedTalentLevelIs = project({}, [
      rule(PREFERENCE_CLAIM, "predicate", {
        type: "talent-level-is",
        characterId: ITTO,
        talent: "charged",
        threshold: 9,
      } as never),
    ]);
    const negativeAtMostThreshold = project({}, [
      rule(PREFERENCE_CLAIM, "predicate", {
        type: "constellation-at-most",
        characterId: ITTO,
        threshold: -1,
      } as never),
    ]);
    const unsafeAtMostThreshold = project({}, [
      rule(PREFERENCE_CLAIM, "predicate", {
        type: "constellation-at-most",
        characterId: ITTO,
        threshold: Number.MAX_SAFE_INTEGER + 1,
      } as never),
    ]);
    const unsafeTalentLevelIs = project({}, [
      rule(PREFERENCE_CLAIM, "predicate", {
        type: "talent-level-is",
        characterId: ITTO,
        talent: "burst",
        threshold: Number.MAX_SAFE_INTEGER + 1,
      } as never),
    ]);
    const malformedAtMost = () =>
      project({}, [
        rule(PREFERENCE_CLAIM, "predicate", {
          type: "constellation-at-most",
          threshold: 5,
        } as never),
      ]);

    expect(invalidConstellation).toMatchObject({
      comparisonStatus: "not-comparable",
      teamProjections: [],
    });
    expect(invalidConstellation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.invalid-constellation-fact",
        }),
      ]),
    );
    expect(invalidTalent.comparisonStatus).toBe("not-comparable");
    expect(invalidTalent.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.invalid-talent-level-fact",
        }),
      ]),
    );
    expect(invalidThreshold.comparisonStatus).toBe("not-comparable");
    expect(invalidThreshold.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.invalid-numeric-predicate-threshold",
        }),
      ]),
    );
    expect(invalidAtMostThreshold.comparisonStatus).toBe("not-comparable");
    expect(invalidAtMostThreshold.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.invalid-numeric-predicate-threshold",
        }),
      ]),
    );
    expect(invalidTalentLevelIs.comparisonStatus).toBe("not-comparable");
    expect(invalidTalentLevelIs.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.invalid-numeric-predicate-threshold",
        }),
      ]),
    );
    expect(fractionalAtMostThreshold.comparisonStatus).toBe("not-comparable");
    expect(fractionalAtMostThreshold.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.invalid-numeric-predicate-threshold",
        }),
      ]),
    );
    expect(malformedTalentLevelIs.comparisonStatus).toBe("not-comparable");
    expect(malformedTalentLevelIs.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.invalid-talent-predicate-kind",
        }),
      ]),
    );
    for (const report of [
      negativeAtMostThreshold,
      unsafeAtMostThreshold,
      unsafeTalentLevelIs,
    ]) {
      expect(report.comparisonStatus).toBe("not-comparable");
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "request-context.invalid-numeric-predicate-threshold",
          }),
        ]),
      );
    }
    expect(malformedAtMost).not.toThrow();
    expect(malformedAtMost().comparisonStatus).toBe("not-comparable");
  });

  it("fails closed without throwing for unknown and non-record predicates", () => {
    const cases = [
      {
        predicate: { type: "unknown-json-predicate" },
        code: "request-context.unsupported-predicate",
      },
      {
        predicate: null,
        code: "request-context.invalid-predicate",
      },
    ] as const;

    for (const { predicate, code } of cases) {
      const build = () =>
        project({}, [
          rule(PREFERENCE_CLAIM, "predicate", predicate as never),
        ]);
      expect(build).not.toThrow();
      const report = build();
      expect(report.comparisonStatus).toBe("not-comparable");
      expect(report.teamProjections).toEqual([]);
      expect(report.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
    }
  });

  it("parses only bounded integer constellation and positive safe-integer talent facts", () => {
    const context = (characterFacts: Record<string, unknown>) => ({
      requestFactsByTeamRecordId: {
        [TEAM_A]: { characterFactsById: { [ITTO]: characterFacts } },
      },
    });
    expect(
      GuideRequestContextSchema.safeParse(
        context({ constellation: 6, talentLevels: { burst: 10 } }),
      ).success,
    ).toBe(true);
    for (const invalid of [
      { constellation: 7 },
      { constellation: 5.5 },
      { talentLevels: { burst: 0 } },
      { talentLevels: { skill: 9.5 } },
      { talentLevels: { charged: 10 } },
    ]) {
      expect(GuideRequestContextSchema.safeParse(context(invalid)).success).toBe(
        false,
      );
    }
  });

  it("never lets request context satisfy an exact-team source fact", () => {
    const sourceReport = sourceFixture();
    const valid = buildGuideRequestContextApplicabilityReport({
      projectionId: "valid-source-isolation",
      sourceReport,
      context: {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            passiveExecutionAssumptions: { execute_passive: true },
          },
        },
      },
      claimRules: [
        rule(ROSTER_PASSIVE_CLAIM, "predicate.predicates[1]", {
          type: "passive-execution-is",
          assumptionId: "execute_passive",
          expected: true,
        }),
      ],
    });
    const invalid = buildGuideRequestContextApplicabilityReport({
      projectionId: "invalid-source-isolation",
      sourceReport,
      context: {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: {
              [ITTO]: { intendedRole: "xianyun" },
            },
          },
        },
      },
      claimRules: [
        rule(ROSTER_PASSIVE_CLAIM, "predicate.predicates[0]", {
          type: "intended-role-is",
          characterId: ITTO,
          roleId: "xianyun",
        }),
      ],
    });

    expect(cell(valid, ROSTER_PASSIVE_CLAIM)).toMatchObject({
      sourceControl: { resolution: "inapplicable" },
      requestContextBindings: [{ result: "true" }],
      resolution: "inapplicable",
      contextApplicability: "source-definitely-inapplicable",
    });
    expect(invalid.comparisonStatus).toBe("not-comparable");
    expect(invalid.teamProjections).toEqual([]);
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.binding-target-not-unresolved-context",
        }),
      ]),
    );
  });

  it("retains deferred source prerequisites after a request fact is satisfied", () => {
    const report = project(
      {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: {
              [ITTO]: { optimizationGoal: "maximize-damage" },
            },
          },
        },
      },
      [
        rule(DEFERRED_CLAIM, "predicate.predicates[1]", {
          type: "optimization-goal-is",
          characterId: ITTO,
          goalId: "maximize-damage",
        }),
      ],
    );

    expect(cell(report, DEFERRED_CLAIM)).toMatchObject({
      sourceControl: {
        resolution: "deferred-omitted-energy-prerequisite",
      },
      requestContextBindings: [{ result: "true" }],
      resolution: "deferred-omitted-energy-prerequisite",
      contextApplicability: "deferred-energy-unchanged",
    });
  });

  it("projects contexts independently without mutating the source control", () => {
    const sourceReport = sourceFixture();
    const before = stableJson(sourceReport);
    const claimRules = [
      rule(ROLE_CLAIM, "predicate", {
        type: "intended-role-is",
        characterId: ITTO,
        roleId: "on-field-dps",
      }),
    ];
    const matching = buildGuideRequestContextApplicabilityReport({
      projectionId: "matching-context",
      sourceReport,
      context: {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: {
              [ITTO]: { intendedRole: "on-field-dps" },
            },
          },
        },
      },
      claimRules,
    });
    const conflicting = buildGuideRequestContextApplicabilityReport({
      projectionId: "conflicting-context",
      sourceReport,
      context: {
        requestFactsByTeamRecordId: {
          [TEAM_A]: {
            characterFactsById: {
              [ITTO]: { intendedRole: "off-field-support" },
            },
          },
        },
      },
      claimRules,
    });

    expect(cell(matching, ROLE_CLAIM).resolution).toBe("matched");
    expect(cell(conflicting, ROLE_CLAIM).resolution).toBe("inapplicable");
    expect(cell(matching, ROLE_CLAIM, TEAM_B)).toMatchObject({
      resolution: "unresolved-context",
      contextApplicability: "still-unresolved",
      requestContextBindings: [{ result: "unknown" }],
    });
    expect(cell(conflicting, ROLE_CLAIM, TEAM_B).resolution).toBe(
      "unresolved-context",
    );
    expect(cell(matching, INVENTORY_CLAIM).resolution).toBe(
      "unresolved-context",
    );
    expect(cell(conflicting, INVENTORY_CLAIM).resolution).toBe(
      "unresolved-context",
    );
    expect(stableJson(sourceReport)).toBe(before);
    expect(matching.sourceControl).toEqual(conflicting.sourceControl);
  });
});

function project(
  context: GuideRequestContext,
  claimRules: GuideRequestClaimRule[],
): GuideRequestContextApplicabilityReport {
  return buildGuideRequestContextApplicabilityReport({
    projectionId: "synthetic-request-context",
    sourceReport: sourceFixture(),
    context,
    claimRules,
  });
}

function cell(
  report: GuideRequestContextApplicabilityReport,
  claimId: string,
  teamRecordId = TEAM_A,
) {
  const projection = report.teamProjections
    .find((team) => team.teamRecordId === teamRecordId)
    ?.claimProjections.find(
    (candidate) => candidate.claimId === claimId,
  );
  if (!projection) throw new Error(`Missing projection ${claimId}.`);
  return projection;
}

function rule(
  claimId: string,
  sourcePredicatePath: string,
  requestPredicate: GuideRequestContextPredicateAst,
): GuideRequestClaimRule {
  const sourceReport = sourceFixture();
  const claim = sourceReport.sourceClaimCatalog.find(
    (candidate) => candidate.claimId === claimId,
  );
  if (!claim) throw new Error(`Missing source claim ${claimId}.`);
  const sourceLeaf = sourceNodeAtPath(claim.predicate, sourcePredicatePath);
  if (!sourceLeaf) {
    throw new Error(`Missing source predicate leaf ${sourcePredicatePath}.`);
  }
  return {
    claimId,
    sourceConditionsSha256: claim.sourceConditionsSha256,
    sourcePredicateSha256: sha256Text(stableJson(claim.predicate)),
    bindings: [
      {
        sourcePredicatePath,
        sourcePredicateLeafSha256: sha256Text(stableJson(sourceLeaf)),
        requestPredicate,
      },
    ],
  };
}

function sourceFixture(): SourceConditionedGuidePacketReport {
  const predicates = {
    role: {
      type: "unresolved-context",
      category: "gameplay-role",
      reason: "Intended role is absent from the exact source roster.",
    },
    inventory: {
      type: "unresolved-context",
      category: "owned-inventory",
      reason: "Owned weapon inventory is outside source-only control.",
    },
    rosterPassive: {
      type: "all",
      predicates: [
        {
          type: "exact-team-roster-includes",
          characterId: "xianyun",
        },
        {
          type: "unresolved-context",
          category: "passive-execution",
          reason: "Passive execution is not an exact-roster fact.",
        },
      ],
    },
    deferred: {
      type: "all",
      predicates: [
        {
          type: "deferred-energy-prerequisite",
          reason: "Rotation-specific energy remains deliberately omitted.",
        },
        {
          type: "unresolved-context",
          category: "player-preference",
          reason: "Optimization goal was omitted from source-only control.",
        },
      ],
    },
    preference: {
      type: "unresolved-context",
      category: "player-preference",
      reason: "Request preference is outside source-only control.",
    },
  } satisfies Record<string, SourceConditionPredicateAst>;
  const claims = [
    claim(0, ROLE_CLAIM, predicates.role),
    claim(1, INVENTORY_CLAIM, predicates.inventory),
    claim(2, ROSTER_PASSIVE_CLAIM, predicates.rosterPassive),
    claim(3, DEFERRED_CLAIM, predicates.deferred),
    claim(4, PREFERENCE_CLAIM, predicates.preference),
  ];
  const input: SourceConditionedGuidePacketInput = {
    experimentId: "synthetic-source-control",
    generatedFrom: [
      { path: "synthetic/source.json", sha256: "a".repeat(64) },
    ],
    sourceBoundary: {
      sourceId: "synthetic",
      pageUrl: "https://example.com/guide",
      sourceVersion: "v1",
      rawManualSourceRecordIds: ["raw:guide", "raw:team"],
      consolidatedGuideRecordIds: ["repository:guide"],
      templateRecordId: "repository:template",
      exactTeamRecordIds: [TEAM_A, TEAM_B],
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryPermission: "unknown",
      repositoryRecordStatus: "candidate",
      promotionEligible: false,
      sourceHashes: [
        { path: "synthetic/source.json", sha256: "a".repeat(64) },
      ],
    },
    policyBoundary: {
      crossRecordJoinOwner: "guide-factory-wrapper",
      sourceAuthoredCrossRecordJoin: false,
      conditionResolutionPolicy:
        "pinned-exact-condition-array-hash-to-typed-predicate-map",
      arbitraryEnglishParsingAllowed: false,
      conditionMap: Object.fromEntries(
        claims.map(({ claimId, sourceConditions, sourceConditionsSha256, predicate }) => [
          claimId,
          { sourceConditionsSha256, predicate },
        ]),
      ),
      allowedStructuredFacts: [
        "exact-source-team-roster",
        "exact-catalog-identity",
        "source-and-baseline-constellation-scope",
      ],
      disallowedStructuredFacts: [
        "gameplay-sequence",
        "account-inventory",
        "player-preference",
      ],
      investmentComparisonScope: "constellation-only",
      talentLevelsEvaluated: false,
    },
    sourceClaimCatalog: claims,
    teamPackets: [
      sourcePacket(0, TEAM_A, ["itto", "xilonen", "furina", "yelan"]),
      sourcePacket(1, TEAM_B, ["itto", "xilonen", "furina", "xingqiu"]),
    ],
    expectedCounts: {
      packetCount: 2,
      sourceClaimCount: claims.length,
      claimCellCount: claims.length * 2,
    },
    cautions: ["Synthetic source control."],
    prohibitedInterpretations: ["No guide claims."],
  };
  const report = buildSourceConditionedGuidePacketReport(input);
  if (report.comparisonStatus !== "comparable") {
    throw new Error(`Synthetic source fixture failed: ${stableJson(report.issues)}`);
  }
  return report;
}

function sourcePacket(
  packetIndex: number,
  teamRecordId: string,
  characterIds: readonly [string, string, string, string],
): SourceTeamPacketInput {
  return {
    packetIndex,
    teamRecordId,
    sourceId: "synthetic",
    sourceRecordId: `raw:team:${packetIndex}`,
    label: "Exact source team",
    intent: "example",
    exhaustiveness: "non-exhaustive",
    rankingClaim: "none",
    members: characterIds.map((characterId) => ({
      characterId,
      rawSourceInvestment: {},
      investment: { status: "unspecified" as const },
    })),
    unknowns: [],
    templateStructuralResult: {
      templateId: "repository:template",
      representation: "structural-runtime-representation-not-gameplay-proof",
      declaredReactions: ["crystallize"],
      reactionGate: "TeamMeta.hasReaction",
      actualOutcome: "accepted",
      structuralMembership: true,
      acceptedMembership: true,
      structuralAssignmentMultiplicity: 2,
      reactionById: { crystallize: true },
      runtimeGateExecutedForStructuralCandidates: true,
      supportsGameplayProof: false,
    },
    presetOverlap: {
      rosterStatus: "uncovered",
      presetTeamId: null,
      rosterComparison: "exact-unordered-character-ids",
      investmentStatus: "not-evaluated-roster-uncovered",
      memberInvestmentComparisons: [],
    },
  };
}

function claim(
  catalogIndex: number,
  claimId: string,
  predicate: SourceConditionPredicateAst,
): SourceConditionedAtomicClaim {
  const sourceConditions = [`Synthetic condition for ${claimId}.`];
  return {
    claimId,
    catalogIndex,
    repositoryRecordId: "repository:guide",
    sourceId: "synthetic",
    sourceRecordId: "raw:guide",
    characterId: "itto",
    recommendation: {
      recommendationId: "recommendation",
      label: null,
      scope: "weapons",
      roles: ["dps"],
      ordering: "unranked",
      classification: "conditional",
      grouping: "single",
      sourceIndex: catalogIndex,
    },
    payload: {
      type: "weapon-group",
      weaponIds: [`weapon-${catalogIndex}`],
    },
    sourceConditions,
    sourceConditionsSha256: sha256Text(stableJson(sourceConditions)),
    predicate,
  };
}

function sourceNodeAtPath(
  predicate: SourceConditionPredicateAst,
  targetPath: string,
): SourceConditionPredicateAst | undefined {
  let found: SourceConditionPredicateAst | undefined;
  visit(predicate, "predicate");
  return found;

  function visit(node: SourceConditionPredicateAst, path: string): void {
    if (path === targetPath) found = node;
    if (node.type !== "all") return;
    node.predicates.forEach((child, index) =>
      visit(child, `${path}.predicates[${index}]`),
    );
  }
}
