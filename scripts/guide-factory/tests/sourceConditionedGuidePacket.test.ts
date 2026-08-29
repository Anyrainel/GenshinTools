import { describe, expect, it } from "vitest";
import { sha256Text, stableJson } from "../src/io";
import {
  authenticateSourceConditionedGuidePacketReport,
  buildSourceConditionedGuidePacketReport,
  type SourceConditionedAtomicClaim,
  type SourceConditionedGuidePacketInput,
  type SourceConditionPredicateAst,
} from "../src/sourceConditionedGuidePacket";

describe("source-conditioned guide packet core", () => {
  it("classifies a pinned condition lattice with fail-closed conjunction precedence", () => {
    const input = fixture();
    const report = buildSourceConditionedGuidePacketReport(input);

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.summary).toMatchObject({
      packetCount: 1,
      sourceClaimCount: 4,
      claimCellCount: 4,
      matchedCellCount: 1,
      inapplicableCellCount: 1,
      withheldCellCount: 2,
      unresolvedCellCount: 1,
      deferredEnergyCellCount: 1,
      assembledBuildCount: 0,
    });
    expect(
      report.teamPackets[0]?.claimCells.map(({ claimId, resolution }) => ({
        claimId,
        resolution,
      })),
    ).toEqual([
      { claimId: "claim:matched", resolution: "matched" },
      { claimId: "claim:false-wins", resolution: "inapplicable" },
      {
        claimId: "claim:deferred-wins",
        resolution: "deferred-omitted-energy-prerequisite",
      },
      { claimId: "claim:unknown", resolution: "unresolved-context" },
    ]);
    expect(report.teamPackets[0]?.partitions).toEqual({
      matchedClaimIds: ["claim:matched"],
      unresolvedClaimIds: ["claim:unknown"],
      deferredEnergyClaimIds: ["claim:deferred-wins"],
      inapplicableClaimIds: ["claim:false-wins"],
    });
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
    });
  });

  it("is deterministic without multiplying claims into assembled builds", () => {
    const input = fixture();
    const first = buildSourceConditionedGuidePacketReport(input);
    const second = buildSourceConditionedGuidePacketReport(
      structuredClone(input),
    );

    expect(stableJson(first)).toBe(stableJson(second));
    expect(first.sourceClaimCatalog).toHaveLength(4);
    expect(first.teamPackets).toHaveLength(1);
    expect(first.teamPackets[0]?.claimCells).toHaveLength(4);
    expect(first.summary.assembledBuildCount).toBe(0);
  });

  it("fails closed when exact source condition text drifts from its pinned map", () => {
    const original = fixture();
    const input: SourceConditionedGuidePacketInput = {
      ...original,
      sourceClaimCatalog: original.sourceClaimCatalog.map((claim, index) =>
        index === 0
          ? {
              ...claim,
              sourceConditions: ["The source wording drifted."],
              sourceConditionsSha256: hash(["The source wording drifted."]),
            }
          : claim,
      ),
    };

    const report = buildSourceConditionedGuidePacketReport(input);

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.sourceClaimCatalog).toEqual([]);
    expect(report.teamPackets).toEqual([]);
    expect(report.summary.claimCellCount).toBe(0);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "input.condition_map_hash_mismatch",
        }),
      ]),
    );
  });

  it("fails closed instead of treating an unknown predicate type as unresolved", () => {
    const original = fixture();
    const forged = {
      type: "invented-natural-language-parser",
      reason: "This type is outside the exact predicate grammar.",
    } as unknown as SourceConditionPredicateAst;
    const input: SourceConditionedGuidePacketInput = {
      ...original,
      sourceClaimCatalog: original.sourceClaimCatalog.map((claim, index) =>
        index === 0 ? { ...claim, predicate: forged } : claim,
      ),
      policyBoundary: {
        ...original.policyBoundary,
        conditionMap: {
          ...original.policyBoundary.conditionMap,
          "claim:matched": {
            ...original.policyBoundary.conditionMap["claim:matched"]!,
            predicate: forged,
          },
        },
      },
    };

    const report = buildSourceConditionedGuidePacketReport(input);

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.teamPackets).toEqual([]);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "input.unsupported_condition_predicate",
        }),
      ]),
    );
  });

  it.each([
    {
      label: "mismatched",
      sourceHashes: [
        { path: "synthetic/input.json", sha256: "b".repeat(64) },
      ],
      code: "input.source_boundary_hash_mismatch",
    },
    {
      label: "duplicated",
      sourceHashes: [
        { path: "synthetic/input.json", sha256: "a".repeat(64) },
        { path: "synthetic/input.json", sha256: "a".repeat(64) },
      ],
      code: "input.duplicate_source_boundary_hash_path",
    },
    {
      label: "missing from generatedFrom",
      sourceHashes: [
        { path: "synthetic/missing.json", sha256: "a".repeat(64) },
      ],
      code: "input.source_boundary_path_not_authenticated",
    },
  ])("fails closed for $label source-boundary provenance", ({ sourceHashes, code }) => {
    const original = fixture();
    const input: SourceConditionedGuidePacketInput = {
      ...original,
      sourceBoundary: { ...original.sourceBoundary, sourceHashes },
    };

    const report = buildSourceConditionedGuidePacketReport(input);

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.teamPackets).toEqual([]);
    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it("authenticates only an exact canonical rebuild", () => {
    const input = fixture();
    const report = buildSourceConditionedGuidePacketReport(input);
    expect(
      authenticateSourceConditionedGuidePacketReport(report, input),
    ).toMatchObject({ authenticated: true });

    const changed = structuredClone(report);
    changed.cautions.push("Untrusted serialized change.");
    expect(
      authenticateSourceConditionedGuidePacketReport(changed, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  });
});

function fixture(): SourceConditionedGuidePacketInput {
  const conditions = {
    matched: ["Furina is in the exact team."],
    falseWins: ["Xianyun is in the exact team; other context is deferred."],
    deferredWins: ["Meet the omitted rotation-specific ER requirement first."],
    unknown: ["The passive can be accommodated."],
  };
  const predicates = {
    matched: {
      type: "exact-team-roster-includes",
      characterId: "furina",
    } satisfies SourceConditionPredicateAst,
    falseWins: {
      type: "all",
      predicates: [
        {
          type: "exact-team-roster-includes",
          characterId: "xianyun",
        },
        {
          type: "deferred-energy-prerequisite",
          reason: "Energy sequence was deliberately omitted.",
        },
        {
          type: "unresolved-context",
          category: "gameplay-sequence",
          reason: "Plunge sequence is not represented by an exact roster.",
        },
      ],
    } satisfies SourceConditionPredicateAst,
    deferredWins: {
      type: "all",
      predicates: [
        {
          type: "deferred-energy-prerequisite",
          reason: "Energy sequence was deliberately omitted.",
        },
        {
          type: "unresolved-context",
          category: "comparative-performance",
          reason: "Offensive tail has not been calculated.",
        },
      ],
    } satisfies SourceConditionPredicateAst,
    unknown: {
      type: "unresolved-context",
      category: "passive-execution",
      reason: "Passive execution is not an exact-roster fact.",
    } satisfies SourceConditionPredicateAst,
  };
  const claims: SourceConditionedAtomicClaim[] = [
    claim(0, "claim:matched", conditions.matched, predicates.matched),
    claim(1, "claim:false-wins", conditions.falseWins, predicates.falseWins),
    claim(
      2,
      "claim:deferred-wins",
      conditions.deferredWins,
      predicates.deferredWins,
    ),
    claim(3, "claim:unknown", conditions.unknown, predicates.unknown),
  ];
  return {
    experimentId: "synthetic-source-conditioned-packet",
    generatedFrom: [
      {
        path: "synthetic/input.json",
        sha256: "a".repeat(64),
      },
    ],
    sourceBoundary: {
      sourceId: "synthetic",
      pageUrl: "https://example.com/guide",
      sourceVersion: "v1",
      rawManualSourceRecordIds: ["raw:guide", "raw:team"],
      consolidatedGuideRecordIds: ["repository:guide"],
      templateRecordId: "repository:template",
      exactTeamRecordIds: ["repository:team"],
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryPermission: "unknown",
      repositoryRecordStatus: "candidate",
      promotionEligible: false,
      sourceHashes: [
        { path: "synthetic/input.json", sha256: "a".repeat(64) },
      ],
    },
    policyBoundary: {
      crossRecordJoinOwner: "guide-factory-wrapper",
      sourceAuthoredCrossRecordJoin: false,
      conditionResolutionPolicy:
        "pinned-exact-condition-array-hash-to-typed-predicate-map",
      arbitraryEnglishParsingAllowed: false,
      conditionMap: Object.fromEntries(
        claims.map(({ claimId, sourceConditions, predicate }) => [
          claimId,
          {
            sourceConditionsSha256: hash(sourceConditions),
            predicate,
          },
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
      {
        packetIndex: 0,
        teamRecordId: "repository:team",
        sourceId: "synthetic",
        sourceRecordId: "raw:team",
        label: "Exact team",
        intent: "example",
        exhaustiveness: "non-exhaustive",
        rankingClaim: "none",
        members: ["itto", "xilonen", "furina", "yelan"].map(
          (characterId) => ({
            characterId,
            rawSourceInvestment: {},
            investment: { status: "unspecified" as const },
          }),
        ),
        unknowns: ["rotation"],
        templateStructuralResult: {
          templateId: "repository:template",
          representation:
            "structural-runtime-representation-not-gameplay-proof",
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
      },
    ],
    expectedCounts: {
      packetCount: 1,
      sourceClaimCount: 4,
      claimCellCount: 4,
    },
    cautions: ["Synthetic only."],
    prohibitedInterpretations: ["No guide claims."],
  };
}

function claim(
  catalogIndex: number,
  claimId: string,
  sourceConditions: string[],
  predicate: SourceConditionPredicateAst,
): SourceConditionedAtomicClaim {
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
    sourceConditionsSha256: hash(sourceConditions),
    predicate,
  };
}

function hash(conditions: readonly string[]): string {
  return sha256Text(stableJson(conditions));
}
