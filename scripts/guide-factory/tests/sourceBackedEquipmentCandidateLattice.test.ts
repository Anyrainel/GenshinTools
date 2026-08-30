import { describe, expect, it } from "vitest";
import { sha256Text, stableJson } from "../src/io";
import {
  buildSourceBackedEquipmentCandidateLattice,
  isCompleteSourceBackedEquipmentCandidateLattice,
  type SourceBackedEquipmentAxis,
  type SourceBackedEquipmentCandidateLatticeInput,
  type SourceBackedEquipmentGrouping,
  type SourceBackedEquipmentJsonValue,
} from "../src/sourceBackedEquipmentCandidateLattice";

type EquipmentPayload = {
  equipmentId: string;
  requestedRefinement: number | null;
  sourceRefinement: number | null;
  applicability: "unknown";
};

describe("source-backed equipment candidate lattice", () => {
  it("enumerates the complete 36-node, 288-reference product without making claims", () => {
    const input = fixture();
    const before = structuredClone(input);

    const report = buildSourceBackedEquipmentCandidateLattice(input);
    const repeated = buildSourceBackedEquipmentCandidateLattice(input);

    expect(repeated).toEqual(report);
    expect(input).toEqual(before);
    expect(report).toMatchObject({
      comparisonStatus: "comparable",
      capabilities: {
        sourceClaims: false,
        equipmentRecommendationClaims: false,
        rankClaims: false,
        guideClaims: false,
        evaluation: false,
        damage: false,
        energyRecovery: false,
        enumeration: true,
      },
      inputBoundary: {
        sourceAuthenticationOwner: "source-specific-wrapper",
        sourceAuthenticationPerformedByCore: false,
        memberCount: 4,
        axisCount: 8,
        activeAxisCount: 8,
        occurrenceCount: 14,
      },
      preflight: {
        countArithmetic: "bigint-decimal",
        expectedCombinationCount: "36",
        maximumCombinationCount: "36",
        calculatedCombinationCount: "36",
        countMatchesExpected: true,
        withinMaximum: true,
      },
      issues: [],
    });
    expect(report.lattice?.combinationCount).toBe("36");
    expect(report.lattice?.nodes).toHaveLength(36);
    expect(
      report.lattice?.nodes.reduce(
        (count, node) => count + node.selections.length,
        0,
      ),
    ).toBe(288);
    expect(
      report.lattice?.nodes.every(({ selections }) => selections.length === 8),
    ).toBe(true);
    expect(new Set(report.lattice?.nodes.map(({ nodeId }) => nodeId)).size).toBe(
      36,
    );
    expect(report.lattice?.axisOrder).toEqual([
      "keqing:weapon",
      "keqing:artifact",
      "ineffa:weapon",
      "ineffa:artifact",
      "furina:weapon",
      "furina:artifact",
      "xilonen:weapon",
      "xilonen:artifact",
    ]);
    expect(
      report.lattice?.domains.map(({ occurrenceCount }) => occurrenceCount),
    ).toEqual([3, 2, 1, 1, 3, 2, 1, 1]);
    expect(report.lattice).toMatchObject({
      compositionPolicy:
        "wrapper-authored-cartesian-product-of-source-backed-axis-occurrences",
      sourcePublishedWholeCandidateCount: 0,
    });
    expect(isCompleteSourceBackedEquipmentCandidateLattice(report)).toBe(true);
    expect(report.lattice?.nodes[0].selections.map(({ occurrenceId }) => occurrenceId)).toEqual([
      "keqing:weapon:lions-roar",
      "keqing:artifact:thundering-fury",
      "ineffa:weapon:fractured-halo",
      "ineffa:artifact:aubade",
      "furina:weapon:freedom-sworn",
      "furina:artifact:golden-troupe",
      "xilonen:weapon:peak-patrol-song",
      "xilonen:artifact:scroll",
    ]);
    expect(report.lattice?.nodes.at(-1)?.selections.map(({ occurrenceId }) => occurrenceId)).toEqual([
      "keqing:weapon:wolf-fang",
      "keqing:artifact:gilded-dreams",
      "ineffa:weapon:fractured-halo",
      "ineffa:artifact:aubade",
      "furina:weapon:splendor",
      "furina:artifact:tenacity",
      "xilonen:weapon:peak-patrol-song",
      "xilonen:artifact:scroll",
    ]);
  });

  it("preserves source-local rank, tie, alternative, list, condition, and provenance metadata", () => {
    const report = buildSourceBackedEquipmentCandidateLattice(fixture());
    const groups = report.lattice?.groups ?? [];

    expect(groups[0]).toMatchObject({
      groupId: "keqing:weapon:rank-0-tie",
      provenance: {
        sourceId: "kqm",
        sourceRecordId: "keqing-weapons",
        repositoryRecordId: "repository:keqing-weapons",
        recommendationId: "recommendation:keqing-weapons",
      },
      recommendationOrdering: "ranked-groups",
      groupIndex: 0,
      grouping: "tied",
      classification: "recommended",
      sourceLocalRank: 0,
      sourceListIndex: 0,
      sourceConditions: ["source condition A"],
      occurrences: [
        {
          occurrenceId: "keqing:weapon:lions-roar",
          listIndex: 0,
          alternativeIndex: null,
          tieIndex: 0,
        },
        {
          occurrenceId: "keqing:weapon:black-sword",
          listIndex: 1,
          alternativeIndex: null,
          tieIndex: 1,
        },
      ],
    });
    expect(groups[2]).toMatchObject({
      groupId: "keqing:artifact:conditional-alternatives",
      grouping: "alternatives",
      recommendationOrdering: "unranked",
      sourceLocalRank: null,
      occurrences: [
        { listIndex: 0, alternativeIndex: 0, tieIndex: null },
        { listIndex: 1, alternativeIndex: 1, tieIndex: null },
      ],
    });
    expect(report.lattice?.orderingPolicy).toBe(
      "authenticated-axis-and-source-list-order-only-no-derived-global-order",
    );
  });

  it("keeps equal equipment payloads as distinct source occurrences", () => {
    const input = fixture();
    input.axes[0].groups[1].occurrences[0].payload = structuredClone(
      input.axes[0].groups[0].occurrences[0].payload,
    );

    const report = buildSourceBackedEquipmentCandidateLattice(input);
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.lattice?.combinationCount).toBe("36");
    const selectedKeqingWeaponIds = new Set(
      report.lattice?.nodes.map(({ selections }) => selections[0].occurrenceId),
    );
    expect(selectedKeqingWeaponIds).toEqual(
      new Set([
        "keqing:weapon:lions-roar",
        "keqing:weapon:black-sword",
        "keqing:weapon:wolf-fang",
      ]),
    );
  });

  it("binds node identity to ordered occurrence ids and both assumption boundaries", () => {
    const baseline = buildSourceBackedEquipmentCandidateLattice(fixture());
    const changedRequest = fixture();
    changedRequest.request.assumptions = {
      ...asRecord(changedRequest.request.assumptions),
      constellation: "changed",
    };
    const changedEvaluation = fixture();
    changedEvaluation.evaluation.assumptions = {
      ...asRecord(changedEvaluation.evaluation.assumptions),
      objective: "changed",
    };

    const requestReport = buildSourceBackedEquipmentCandidateLattice(changedRequest);
    const evaluationReport = buildSourceBackedEquipmentCandidateLattice(changedEvaluation);
    expect(requestReport.lattice?.nodes.map(({ selections }) => selections)).toEqual(
      baseline.lattice?.nodes.map(({ selections }) => selections),
    );
    expect(evaluationReport.lattice?.nodes.map(({ selections }) => selections)).toEqual(
      baseline.lattice?.nodes.map(({ selections }) => selections),
    );
    expect(requestReport.lattice?.nodes[0].nodeId).not.toBe(
      baseline.lattice?.nodes[0].nodeId,
    );
    expect(evaluationReport.lattice?.nodes[0].nodeId).not.toBe(
      baseline.lattice?.nodes[0].nodeId,
    );
    expect(reportNodeId(baseline, 0)).toMatch(
      /^source-backed-equipment-node:[a-f0-9]{64}$/,
    );
  });

  it.each([
    [
      "a claim capability",
      (report: BuiltReport) => {
        (report.capabilities as { guideClaims: boolean }).guideClaims = true;
      },
    ],
    [
      "the member shape",
      (report: BuiltReport) => {
        report.inputBoundary.memberCount = 3;
      },
    ],
    [
      "the domain shape",
      (report: BuiltReport) => {
        report.lattice?.domains.pop();
      },
    ],
    [
      "the enumerated count",
      (report: BuiltReport) => {
        report.lattice?.nodes.pop();
      },
    ],
    [
      "one partial node",
      (report: BuiltReport) => {
        report.lattice?.nodes[0].selections.pop();
      },
    ],
    [
      "one duplicate selection tuple",
      (report: BuiltReport) => {
        if (!report.lattice) return;
        report.lattice.nodes[1] = structuredClone(report.lattice.nodes[0]);
      },
    ],
    [
      "one node id",
      (report: BuiltReport) => {
        if (!report.lattice) return;
        report.lattice.nodes[0].nodeId =
          `source-backed-equipment-node:${"0".repeat(64)}`;
      },
    ],
    [
      "the composition policy",
      (report: BuiltReport) => {
        if (!report.lattice) return;
        (
          report.lattice as { compositionPolicy: string }
        ).compositionPolicy = "source-published";
      },
    ],
    [
      "the source-published whole-candidate count",
      (report: BuiltReport) => {
        if (!report.lattice) return;
        (report.lattice as { sourcePublishedWholeCandidateCount: number })
          .sourcePublishedWholeCandidateCount = 1;
      },
    ],
    [
      "an occurrence-to-group binding",
      (report: BuiltReport) => {
        if (!report.lattice) return;
        report.lattice.nodes[0].selections[0].groupId =
          report.lattice.domains[0].groupIds[1];
      },
    ],
    [
      "a source condition",
      (report: BuiltReport) => {
        report.lattice?.groups[0].sourceConditions.push("post-build drift");
      },
    ],
    [
      "source provenance",
      (report: BuiltReport) => {
        if (!report.lattice) return;
        report.lattice.groups[0].provenance.sourceId = "   ";
      },
    ],
    [
      "the non-ER derivation boundary",
      (report: BuiltReport) => {
        if (!report.lattice) return;
        report.lattice.groups[0].occurrences[0].energyDerivation =
          "deferred-er";
      },
    ],
    [
      "one payload",
      (report: BuiltReport) => {
        if (!report.lattice) return;
        (
          report.lattice.groups[0].occurrences[0] as { payload: unknown }
        ).payload = { invalid: undefined };
      },
    ],
  ])("the success predicate rejects post-build mutation of %s", (_label, mutate) => {
    const report = buildSourceBackedEquipmentCandidateLattice(fixture());
    expect(isCompleteSourceBackedEquipmentCandidateLattice(report)).toBe(true);

    mutate(report);

    expect(isCompleteSourceBackedEquipmentCandidateLattice(report)).toBe(false);
  });

  it.each([
    [
      "wrong member count",
      (input: Fixture) => input.teamMembers.pop(),
      "team.member_count_mismatch",
    ],
    [
      "duplicate member",
      (input: Fixture) => {
        input.teamMembers[1].teamMemberId = input.teamMembers[0].teamMemberId;
      },
      "team.duplicate_member_id",
    ],
    [
      "foreign axis",
      (input: Fixture) => {
        input.axes[0].teamMemberId = "foreign";
      },
      "axis.foreign_member",
    ],
    [
      "duplicate axis identity",
      (input: Fixture) => {
        input.axes[1].axisId = input.axes[0].axisId;
      },
      "axis.duplicate_id",
    ],
    [
      "duplicate member-kind axis",
      (input: Fixture) => {
        input.axes[1].equipmentKind = "weapon";
        input.axes[1].groups.forEach((group) => {
          group.equipmentKind = "weapon";
        });
      },
      "axis.duplicate_member_kind",
    ],
    [
      "invalid axis kind",
      (input: Fixture) => {
        (input.axes[0] as { equipmentKind: string }).equipmentKind = "relic";
      },
      "axis.invalid_kind",
    ],
    [
      "axis order drift",
      (input: Fixture) => {
        [input.axes[0], input.axes[1]] = [input.axes[1], input.axes[0]];
      },
      "axis.order_drift",
    ],
    [
      "empty axis",
      (input: Fixture) => {
        input.axes[0].groups = [];
      },
      "axis.empty",
    ],
    [
      "empty group",
      (input: Fixture) => {
        input.axes[0].groups[0].occurrences = [];
      },
      "group.empty",
    ],
  ])("withholds for %s", (_label, mutate, issueCode) => {
    const input = fixture();
    mutate(input);
    expectWithheld(input, issueCode);
  });

  it.each([
    [
      "duplicate occurrence id",
      (input: Fixture) => {
        input.axes[0].groups[0].occurrences[1].occurrenceId =
          input.axes[0].groups[0].occurrences[0].occurrenceId;
      },
      "occurrence.duplicate_id",
    ],
    [
      "duplicate group id",
      (input: Fixture) => {
        input.axes[0].groups[1].groupId = input.axes[0].groups[0].groupId;
      },
      "group.duplicate_id",
    ],
    [
      "group member drift",
      (input: Fixture) => {
        input.axes[0].groups[0].teamMemberId = "ineffa";
      },
      "group.member_drift",
    ],
    [
      "condition hash drift",
      (input: Fixture) => {
        input.axes[0].groups[0].sourceConditions.push("new condition");
      },
      "group.condition_hash_drift",
    ],
    [
      "occurrence list drift",
      (input: Fixture) => {
        input.axes[0].groups[0].occurrences[1].listIndex = 9;
      },
      "occurrence.list_index_drift",
    ],
    [
      "tie metadata drift",
      (input: Fixture) => {
        input.axes[0].groups[0].occurrences[0].tieIndex = null;
      },
      "occurrence.inconsistent_tie_metadata",
    ],
    [
      "rank metadata drift",
      (input: Fixture) => {
        input.axes[0].groups[0].sourceLocalRank = -1;
      },
      "group.invalid_source_local_rank",
    ],
  ])("withholds duplicate or inconsistent metadata for %s", (_label, mutate, issueCode) => {
    const input = fixture();
    mutate(input);
    expectWithheld(input, issueCode);
  });

  it("allows coupled occurrences to retain one shared source claim id", () => {
    const input = fixture();
    input.axes[0].groups[0].occurrences[1].claimId =
      input.axes[0].groups[0].occurrences[0].claimId;

    const report = buildSourceBackedEquipmentCandidateLattice(input);
    expect(isCompleteSourceBackedEquipmentCandidateLattice(report)).toBe(true);
    expect(report.lattice?.combinationCount).toBe("36");
  });

  it.each(["er-derived", "deferred-er"] as const)(
    "rejects %s energy occurrences from the non-ER axes",
    (energyDerivation) => {
      const input = fixture();
      input.axes[0].groups[0].occurrences[0].energyDerivation =
        energyDerivation;
      expectWithheld(input, "occurrence.energy_related_rejected");
    },
  );

  it.each([
    [
      "blank request id",
      (input: Fixture) => {
        input.request.requestId = "   ";
      },
      "request.invalid_id",
    ],
    [
      "blank evaluation id",
      (input: Fixture) => {
        input.evaluation.evaluationId = "\t";
      },
      "evaluation.invalid_id",
    ],
  ])("rejects %s", (_label, mutate, issueCode) => {
    const input = fixture();
    mutate(input);
    expectWithheld(input, issueCode);
  });

  it.each([
    ["declared count mismatch", "35", "36", "bounds.expected_count_mismatch"],
    ["cap exceeded", "36", "35", "bounds.maximum_exceeded"],
    ["noncanonical count", "036", "36", "bounds.invalid_decimal"],
    ["zero cap", "36", "0", "bounds.zero"],
  ])("uses BigInt preflight to withhold for %s", (_label, expected, maximum, issueCode) => {
    const input = fixture();
    input.bounds = {
      expectedCombinationCount: expected,
      maximumCombinationCount: maximum,
    };
    expectWithheld(input, issueCode);
  });

  it("withholds truncated, duplicate, partial, foreign, and failed enumeration output", () => {
    const truncated = buildSourceBackedEquipmentCandidateLattice(
      fixture(),
      (axes) => [axes.map(({ occurrenceIds }) => occurrenceIds[0])],
    );
    expectReportWithheld(truncated, "enumeration.incomplete_count");

    const duplicateRows = buildSourceBackedEquipmentCandidateLattice(
      fixture(),
      (axes) =>
        Array.from({ length: 36 }, () =>
          axes.map(({ occurrenceIds }) => occurrenceIds[0]),
        ),
    );
    expectReportWithheld(duplicateRows, "enumeration.duplicate_selection");

    const partialRows = buildSourceBackedEquipmentCandidateLattice(
      fixture(),
      (axes) =>
        Array.from({ length: 36 }, () =>
          axes.slice(0, 7).map(({ occurrenceIds }) => occurrenceIds[0]),
        ),
    );
    expectReportWithheld(partialRows, "enumeration.partial_row");

    const foreignRows = buildSourceBackedEquipmentCandidateLattice(
      fixture(),
      (axes) =>
        Array.from({ length: 36 }, () => [
          "foreign",
          ...axes.slice(1).map(({ occurrenceIds }) => occurrenceIds[0]),
        ]),
    );
    expectReportWithheld(foreignRows, "enumeration.foreign_occurrence");

    const failed = buildSourceBackedEquipmentCandidateLattice(fixture(), () => {
      throw new Error("enumerator stopped");
    });
    expectReportWithheld(failed, "enumeration.failed");
  });

  it("withholds unstable non-JSON assumptions and payloads", () => {
    const assumptions = fixture();
    (assumptions.request.assumptions as Record<string, unknown>).invalid = Number.NaN;
    expectWithheld(assumptions, "input.non_json_number");

    const payload = fixture();
    (payload.axes[0].groups[0].occurrences[0] as { payload: unknown }).payload = {
      invalid: undefined,
    };
    expectWithheld(payload, "input.undefined");
  });
});

type Fixture = SourceBackedEquipmentCandidateLatticeInput<EquipmentPayload>;
type BuiltReport = ReturnType<typeof buildSourceBackedEquipmentCandidateLattice>;

function fixture(): Fixture {
  return {
    request: {
      requestId: "keqing-ineffa-furina-xilonen:c0-request",
      assumptions: {
        teamOrder: ["keqing", "ineffa", "furina", "xilonen"],
        constellations: { keqing: 0, ineffa: 0, furina: 0, xilonen: 0 },
      },
    },
    evaluation: {
      evaluationId: "non-er-formula-count-v1",
      assumptions: {
        energyRecovery: "deferred",
        objective: "not-evaluated-by-lattice",
      },
    },
    teamMembers: ["keqing", "ineffa", "furina", "xilonen"].map(
      (characterId) => ({ teamMemberId: characterId, characterId }),
    ),
    axes: [
      axis("keqing", "weapon", [
        group(
          "keqing",
          "weapon",
          "rank-0-tie",
          "tied",
          [
            occurrence("keqing", "weapon", "lions-roar", 0, 5, null, 0),
            occurrence("keqing", "weapon", "black-sword", 1, 5, null, 1),
          ],
          {
            recommendationOrdering: "ranked-groups",
            groupIndex: 0,
            sourceLocalRank: 0,
            sourceListIndex: 0,
          },
        ),
        group(
          "keqing",
          "weapon",
          "rank-1-single",
          "single",
          [occurrence("keqing", "weapon", "wolf-fang", 0, 5)],
          {
            recommendationOrdering: "ranked-groups",
            groupIndex: 1,
            sourceLocalRank: 1,
            sourceListIndex: 1,
          },
        ),
      ]),
      axis("keqing", "artifact", [
        group(
          "keqing",
          "artifact",
          "conditional-alternatives",
          "alternatives",
          [
            occurrence("keqing", "artifact", "thundering-fury", 0, null, 0),
            occurrence("keqing", "artifact", "gilded-dreams", 1, null, 1),
          ],
        ),
      ]),
      singletonAxis("ineffa", "weapon", "fractured-halo", 1),
      singletonAxis("ineffa", "artifact", "aubade"),
      axis("furina", "weapon", [
        group(
          "furina",
          "weapon",
          "unranked-options",
          "alternatives",
          [
            occurrence("furina", "weapon", "freedom-sworn", 0, 1, 0),
            occurrence("furina", "weapon", "key", 1, 1, 1),
            occurrence("furina", "weapon", "splendor", 2, 1, 2),
          ],
        ),
      ]),
      axis("furina", "artifact", [
        group(
          "furina",
          "artifact",
          "build-options",
          "alternatives",
          [
            occurrence("furina", "artifact", "golden-troupe", 0, null, 0),
            occurrence("furina", "artifact", "tenacity", 1, null, 1),
          ],
        ),
      ]),
      singletonAxis("xilonen", "weapon", "peak-patrol-song", 1),
      singletonAxis("xilonen", "artifact", "scroll"),
    ],
    bounds: {
      expectedCombinationCount: "36",
      maximumCombinationCount: "36",
    },
  };
}

function axis(
  characterId: string,
  equipmentKind: "weapon" | "artifact",
  groups: SourceBackedEquipmentAxis<EquipmentPayload>["groups"],
): SourceBackedEquipmentAxis<EquipmentPayload> {
  return {
    axisId: `${characterId}:${equipmentKind}`,
    teamMemberId: characterId,
    characterId,
    equipmentKind,
    groups,
  };
}

function singletonAxis(
  characterId: string,
  equipmentKind: "weapon" | "artifact",
  equipmentId: string,
  requestedRefinement: number | null = null,
): SourceBackedEquipmentAxis<EquipmentPayload> {
  return axis(characterId, equipmentKind, [
    group(characterId, equipmentKind, equipmentId, "single", [
      occurrence(
        characterId,
        equipmentKind,
        equipmentId,
        0,
        requestedRefinement,
      ),
    ]),
  ]);
}

function group(
  characterId: string,
  equipmentKind: "weapon" | "artifact",
  suffix: string,
  grouping: SourceBackedEquipmentGrouping,
  occurrences: SourceBackedEquipmentAxis<EquipmentPayload>["groups"][number]["occurrences"],
  metadata: {
    recommendationOrdering?: "ranked-groups" | "unranked" | null;
    groupIndex?: number;
    sourceLocalRank?: number | null;
    sourceListIndex?: number;
  } = {},
): SourceBackedEquipmentAxis<EquipmentPayload>["groups"][number] {
  const sourceConditions = ["source condition A"];
  return {
    groupId: `${characterId}:${equipmentKind}:${suffix}`,
    teamMemberId: characterId,
    characterId,
    equipmentKind,
    provenance: {
      sourceId: "kqm",
      sourceRecordId: `${characterId}-${equipmentKind}s`,
      repositoryRecordId: `repository:${characterId}-${equipmentKind}s`,
      recommendationId: `recommendation:${characterId}-${equipmentKind}s`,
    },
    recommendationOrdering: metadata.recommendationOrdering ?? "unranked",
    groupIndex: metadata.groupIndex ?? 0,
    grouping,
    classification: "recommended",
    sourceLocalRank: metadata.sourceLocalRank ?? null,
    sourceListIndex: metadata.sourceListIndex ?? 0,
    sourceConditions,
    sourceConditionsSha256: sha256Text(stableJson(sourceConditions)),
    occurrences,
  };
}

function occurrence(
  characterId: string,
  equipmentKind: "weapon" | "artifact",
  equipmentId: string,
  listIndex: number,
  requestedRefinement: number | null,
  alternativeIndex: number | null = null,
  tieIndex: number | null = null,
) {
  return {
    occurrenceId: `${characterId}:${equipmentKind}:${equipmentId}`,
    claimId: `claim:${characterId}:${equipmentKind}:${equipmentId}`,
    listIndex,
    alternativeIndex,
    tieIndex,
    energyDerivation: "not-er-derived" as const,
    payload: {
      equipmentId,
      requestedRefinement,
      sourceRefinement: null,
      applicability: "unknown" as const,
    },
  };
}

function expectWithheld(input: Fixture, issueCode: string): void {
  expectReportWithheld(
    buildSourceBackedEquipmentCandidateLattice(input),
    issueCode,
  );
}

function expectReportWithheld(
  report: ReturnType<typeof buildSourceBackedEquipmentCandidateLattice>,
  issueCode: string,
): void {
  expect(report.comparisonStatus).toBe("not-comparable");
  expect(report.lattice).toBeNull();
  expect(report.capabilities.enumeration).toBe(false);
  expect(report.issues.map(({ code }) => code)).toContain(issueCode);
}

function reportNodeId(
  report: ReturnType<typeof buildSourceBackedEquipmentCandidateLattice>,
  index: number,
): string | undefined {
  return report.lattice?.nodes[index]?.nodeId;
}

function asRecord(value: SourceBackedEquipmentJsonValue) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Expected object assumptions fixture.");
  }
  return value;
}
