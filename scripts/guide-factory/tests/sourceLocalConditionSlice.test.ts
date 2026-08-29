import { describe, expect, it } from "vitest";
import { sha256Text, stableJson } from "../src/io";
import {
  authenticateSourceLocalConditionSliceReport,
  buildSourceLocalConditionSliceReport,
  type SourceLocalConditionClaimInput,
  type SourceLocalConditionSliceInput,
  type SourceLocalConditionSliceReport,
} from "../src/sourceLocalConditionSlice";
import type {
  SourceConditionedAtomicClaim,
  SourceConditionPredicateAst,
} from "../src/sourceConditionedGuidePacket";

const SOURCE = "kqm";
const SNAPSHOT = "manual/kqm/klee-luna-iv.json";
const GUIDE_SOURCE_RECORD = "kqm:character_guide:klee-luna-iv";
const GUIDE_REPOSITORY_RECORD =
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv";
const OVERLOAD_TEAM = "kqm:team:klee-overload-example-luna-iv";
const FURINA_TEAM = "kqm:team:klee-furina-example-luna-iv";
const KLEE = "klee";

describe("source-local condition slice", () => {
  it("composes existing source and request evaluators for exact Klee-like claims and teams", () => {
    const report = buildSourceLocalConditionSliceReport(fixture());

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.summary).toMatchObject({
      claimCount: 4,
      teamCount: 2,
      cellCount: 8,
      sourceMatchedCount: 1,
      sourceInapplicableCount: 1,
      sourceUnresolvedCount: 6,
      effectiveMatchedCount: 7,
      effectiveInapplicableCount: 1,
      effectiveUnresolvedCount: 0,
      sourceAlreadyMatchedCount: 1,
      sourceDefinitelyInapplicableCount: 1,
      applicableUnderSuppliedContextCount: 6,
      notApplicableUnderSuppliedContextCount: 0,
      stillUnresolvedCount: 0,
      deferredEnergyCount: 0,
      assembledBuildCount: 0,
    });
    expect(sourceCell(report, "claim:circlet", OVERLOAD_TEAM)).toMatchObject({
      resolution: "unresolved-context",
      predicateRows: [
        expect.objectContaining({
          predicateType: "unresolved-context",
          result: "unknown",
        }),
      ],
    });
    expect(projection(report, "claim:circlet", OVERLOAD_TEAM)).toMatchObject({
      sourceControl: { resolution: "unresolved-context" },
      resolution: "matched",
      contextApplicability: "applicable-under-supplied-context",
      requestContextBindings: [
        expect.objectContaining({
          result: "true",
          predicateRows: [
            expect.objectContaining({
              predicateType: "intended-role-is",
              factScope: {
                teamRecordId: OVERLOAD_TEAM,
                characterId: KLEE,
                accountSnapshotId: null,
              },
            }),
          ],
        }),
      ],
    });
    expect(sourceCell(report, "claim:marechaussee", OVERLOAD_TEAM).resolution).toBe(
      "inapplicable",
    );
    expect(projection(report, "claim:marechaussee", OVERLOAD_TEAM)).toMatchObject({
      resolution: "inapplicable",
      contextApplicability: "source-definitely-inapplicable",
      requestContextBindings: [],
    });
    expect(sourceCell(report, "claim:marechaussee", FURINA_TEAM).resolution).toBe(
      "matched",
    );
    expect(projection(report, "claim:marechaussee", FURINA_TEAM)).toMatchObject({
      resolution: "matched",
      contextApplicability: "source-already-matched",
    });

    for (const team of report.sourceClaimCells) {
      for (const source of team.claimCells) {
        const projected = projection(report, source.claimId, team.teamRecordId);
        expect(projected.sourceControl).toMatchObject({
          resolution: source.resolution,
          sourceConditionsSha256: source.sourceConditionsSha256,
          predicateRows: source.predicateRows,
          reason: source.reason,
        });
      }
    }
    expect(report.sourceClaimCatalog[0]?.recommendation.roles).toEqual(["dps"]);
    expect(sourceCell(report, "claim:circlet", OVERLOAD_TEAM).resolution).toBe(
      "unresolved-context",
    );
  });

  it("keeps omitted request facts unknown and scopes supplied facts independently by team", () => {
    const omittedInput = fixture();
    delete omittedInput.requestContext;
    omittedInput.expectedCounts = {
      ...omittedInput.expectedCounts,
      effectiveResolution: { matched: 1, inapplicable: 1, unresolved: 6 },
      contextApplicability: {
        sourceAlreadyMatched: 1,
        sourceDefinitelyInapplicable: 1,
        applicableUnderSuppliedContext: 0,
        notApplicableUnderSuppliedContext: 0,
        stillUnresolved: 6,
      },
    };
    const omitted = buildSourceLocalConditionSliceReport(omittedInput);
    expect(omitted.comparisonStatus).toBe("comparable");
    expect(projection(omitted, "claim:sands", OVERLOAD_TEAM)).toMatchObject({
      resolution: "unresolved-context",
      contextApplicability: "still-unresolved",
      requestContextBindings: [{ result: "unknown" }],
    });

    const scopedInput = fixture();
    scopedInput.requestContext = {
      requestFactsByTeamRecordId: {
        [OVERLOAD_TEAM]: {
          characterFactsById: {
            [KLEE]: { intendedRole: "on-field-dps" },
          },
        },
      },
    };
    scopedInput.expectedCounts = {
      ...scopedInput.expectedCounts,
      effectiveResolution: { matched: 4, inapplicable: 1, unresolved: 3 },
      contextApplicability: {
        sourceAlreadyMatched: 1,
        sourceDefinitelyInapplicable: 1,
        applicableUnderSuppliedContext: 3,
        notApplicableUnderSuppliedContext: 0,
        stillUnresolved: 3,
      },
    };
    const scoped = buildSourceLocalConditionSliceReport(scopedInput);
    expect(scoped.comparisonStatus).toBe("comparable");
    expect(projection(scoped, "claim:goblet", OVERLOAD_TEAM).resolution).toBe(
      "matched",
    );
    expect(projection(scoped, "claim:goblet", FURINA_TEAM)).toMatchObject({
      resolution: "unresolved-context",
      contextApplicability: "still-unresolved",
      requestContextBindings: [
        expect.objectContaining({
          predicateRows: [
            expect.objectContaining({
              factScope: expect.objectContaining({ teamRecordId: FURINA_TEAM }),
              result: "unknown",
            }),
          ],
        }),
      ],
    });
  });

  it("keeps verbose adapter template and preset metadata out of the public report", () => {
    const report = buildSourceLocalConditionSliceReport(fixture());
    const serialized = stableJson(report);

    expect(report.compositionPolicy).toMatchObject({
      sourcePredicateEvaluationOwner: "source-conditioned-guide-packet-core",
      requestContextEvaluationOwner: "guide-request-context-core",
      sourceCellsPreservedVerbatim: true,
      requestProjectionsPreservedVerbatim: true,
      verboseSourcePacketAdapterMetadataExposed: false,
      teamTemplateEvaluation: "not-evaluated",
      presetOverlapEvaluation: "not-evaluated",
    });
    expect(serialized).not.toContain('"presetOverlap"');
    expect(serialized).not.toContain('"rosterStatus"');
    expect(serialized).not.toContain("not-evaluated:source-local-condition-slice");
    expect(serialized).not.toContain('"templateStructuralResult"');
  });

  it("retains every capability refusal and performs no build or ER work", () => {
    const report = buildSourceLocalConditionSliceReport(fixture());

    expect(report).toMatchObject({
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      playerFacingRecommendations: false,
      ranking: false,
      buildComposition: false,
      damage: false,
      formulas: false,
      rotations: false,
      ER: false,
      recommendationCompositionExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      energyRecoveryComputationExecuted: false,
      assembledBuildCount: 0,
    });
    expect(report.requestContextReport).toMatchObject({
      supportsGuideClaims: false,
      ranking: false,
      buildComposition: false,
      damage: false,
      rotations: false,
      ER: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      energyRecoveryInputsUsed: false,
    });
  });

  it.each([
    {
      name: "condition",
      mutate(input: SourceLocalConditionSliceInput) {
        input.claims[0]!.claim.sourceConditions[0] = "Mutated source prose";
      },
    },
    {
      name: "payload",
      mutate(input: SourceLocalConditionSliceInput) {
        const payload = input.claims[0]!.claim.payload;
        if (payload.type !== "main-stat") throw new Error("Expected main stat.");
        payload.statIds = ["atk_"];
      },
    },
    {
      name: "predicate",
      mutate(input: SourceLocalConditionSliceInput) {
        input.claims[0]!.claim.predicate = {
          type: "exact-team-roster-includes",
          characterId: "furina",
        };
      },
    },
  ])("fails closed when the exact $name control drifts", ({ mutate }) => {
    const input = fixture();
    mutate(input);
    const report = buildSourceLocalConditionSliceReport(input);

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.sourceClaimCells).toEqual([]);
    expect(report.requestContextReport).toBeNull();
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source-local-slice.pinned-hash-mismatch",
        }),
      ]),
    );
  });

  it("rejects request bindings to exact roster facts", () => {
    const input = fixture();
    const rosterClaim = input.claims[3]!;
    rosterClaim.requestBindings = [
      {
        sourcePredicatePath: "predicate",
        sourcePredicateLeafSha256: hash(rosterClaim.claim.predicate),
        requestPredicate: {
          type: "intended-role-is",
          characterId: KLEE,
          roleId: "on-field-dps",
        },
      },
    ];
    const report = buildSourceLocalConditionSliceReport(input);

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source-local-slice.binding-target-not-unresolved",
        }),
      ]),
    );
  });

  it("rejects deferred energy predicates, cross-document rows, and unscoped request facts", () => {
    const energyInput = fixture();
    const energyPredicate = {
      type: "deferred-energy-prerequisite",
      reason: "Rotation data is unavailable.",
    } satisfies SourceConditionPredicateAst;
    energyInput.claims[0]!.claim.predicate = energyPredicate;
    energyInput.claims[0]!.occurrenceControl.sourcePredicateSha256 =
      hash(energyPredicate);
    energyInput.claims[0]!.requestBindings = [];
    const energy = buildSourceLocalConditionSliceReport(energyInput);
    expect(energy.comparisonStatus).toBe("not-comparable");
    expect(energy.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source-local-slice.energy-predicate-forbidden",
        }),
      ]),
    );

    const crossDocumentInput = fixture();
    crossDocumentInput.exactTeams[0]!.snapshotPath = "manual/another-page.json";
    const crossDocument = buildSourceLocalConditionSliceReport(crossDocumentInput);
    expect(crossDocument.comparisonStatus).toBe("not-comparable");
    expect(crossDocument.sourceDocumentBoundary).toMatchObject({
      status: "rejected",
      allClaimsAndTeamsShareExactSourceDocument: false,
    });

    const unscopedInput = fixture();
    unscopedInput.requestContext = {
      requestFactsByTeamRecordId: {
        "unknown-team": {
          characterFactsById: {
            [KLEE]: { intendedRole: "on-field-dps" },
          },
        },
      },
    };
    const unscoped = buildSourceLocalConditionSliceReport(unscopedInput);
    expect(unscoped.comparisonStatus).toBe("not-comparable");
    expect(unscoped.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source-local-slice.request-facts-unknown-team",
        }),
      ]),
    );
  });

  it("fails closed when pinned expected partitions no longer match", () => {
    const input = fixture();
    input.expectedCounts.contextApplicability = {
      sourceAlreadyMatched: 0,
      sourceDefinitelyInapplicable: 1,
      applicableUnderSuppliedContext: 7,
      notApplicableUnderSuppliedContext: 0,
      stillUnresolved: 0,
    };
    const report = buildSourceLocalConditionSliceReport(input);

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source-local-slice.expected-count-mismatch",
        }),
      ]),
    );
  });

  it("authenticates only the exact canonical rebuilt report", () => {
    const input = fixture();
    const report = buildSourceLocalConditionSliceReport(input);
    expect(authenticateSourceLocalConditionSliceReport(report, input)).toEqual({
      authenticated: true,
      canonicalReport: report,
    });

    const changed = structuredClone(report);
    changed.summary.applicableUnderSuppliedContextCount = 5;
    expect(authenticateSourceLocalConditionSliceReport(changed, input)).toEqual({
      authenticated: false,
      reason: "serialized-report-mismatch",
      issues: [
        expect.objectContaining({
          code: "source-local-slice.serialized-report-mismatch",
        }),
      ],
    });

    const staleInput = fixture();
    staleInput.claims[0]!.occurrenceControl.payloadSha256 = "0".repeat(64);
    expect(authenticateSourceLocalConditionSliceReport(report, staleInput)).toEqual({
      authenticated: false,
      reason: "canonical-inputs-not-comparable",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "source-local-slice.pinned-hash-mismatch",
        }),
      ]),
    });
  });
});

function fixture(): SourceLocalConditionSliceInput {
  const rolePredicate = {
    type: "unresolved-context",
    category: "gameplay-role",
    reason:
      "The exact source condition requires an on-field role that the team roster alone cannot establish.",
  } satisfies SourceConditionPredicateAst;
  const furinaPredicate = {
    type: "exact-team-roster-includes",
    characterId: "furina",
  } satisfies SourceConditionPredicateAst;
  const claims = [
    mainStatClaim(0, "claim:circlet", "circlet", ["crit_rate_", "crit_dmg_"], rolePredicate),
    mainStatClaim(1, "claim:goblet", "goblet", ["pyro_dmg_"], rolePredicate),
    mainStatClaim(2, "claim:sands", "sands", ["atk_"], rolePredicate),
    artifactClaim(3, "claim:marechaussee", furinaPredicate),
  ];
  return {
    sliceId: "synthetic-klee-source-local-slice-v1",
    generatedFrom: [
      { path: SNAPSHOT, sha256: "a".repeat(64) },
      { path: "knowledge/repository.json", sha256: "b".repeat(64) },
    ],
    sourceBoundary: {
      sourceId: SOURCE,
      pageUrl: "https://example.com/klee",
      sourceVersion: "Luna IV",
      snapshotPath: SNAPSHOT,
      rawManualSourceRecordIds: [
        GUIDE_SOURCE_RECORD,
        "kqm:team:klee-overload-source",
        "kqm:team:klee-furina-source",
      ],
      consolidatedGuideRecordIds: [GUIDE_REPOSITORY_RECORD],
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryPermission: "unknown",
      repositoryRecordStatus: "candidate",
      sourceHashes: [
        { path: SNAPSHOT, sha256: "a".repeat(64) },
        { path: "knowledge/repository.json", sha256: "b".repeat(64) },
      ],
    },
    claims,
    exactTeams: [
      {
        packetIndex: 0,
        teamRecordId: OVERLOAD_TEAM,
        snapshotPath: SNAPSHOT,
        sourceId: SOURCE,
        sourceRecordId: "kqm:team:klee-overload-source",
        label: "Klee overload example",
        intent: "example",
        exhaustiveness: "non-exhaustive",
        rankingClaim: "none",
        memberCharacterIds: [KLEE, "chevreuse", "durin", "fischl"],
      },
      {
        packetIndex: 1,
        teamRecordId: FURINA_TEAM,
        snapshotPath: SNAPSHOT,
        sourceId: SOURCE,
        sourceRecordId: "kqm:team:klee-furina-source",
        label: "Klee Furina example",
        intent: "example",
        exhaustiveness: "non-exhaustive",
        rankingClaim: "none",
        memberCharacterIds: [KLEE, "furina", "albedo", "xilonen"],
      },
    ],
    requestContext: {
      requestFactsByTeamRecordId: {
        [OVERLOAD_TEAM]: {
          characterFactsById: {
            [KLEE]: { intendedRole: "on-field-dps" },
          },
        },
        [FURINA_TEAM]: {
          characterFactsById: {
            [KLEE]: { intendedRole: "on-field-dps" },
          },
        },
      },
    },
    expectedCounts: {
      claimCount: 4,
      teamCount: 2,
      cellCount: 8,
      sourceResolution: { matched: 1, inapplicable: 1, unresolved: 6 },
      effectiveResolution: { matched: 7, inapplicable: 1, unresolved: 0 },
      contextApplicability: {
        sourceAlreadyMatched: 1,
        sourceDefinitelyInapplicable: 1,
        applicableUnderSuppliedContext: 6,
        notApplicableUnderSuppliedContext: 0,
        stillUnresolved: 0,
      },
    },
    cautions: ["Synthetic test slice only."],
    prohibitedInterpretations: ["No guide or ranking claims."],
  };
}

function mainStatClaim(
  catalogIndex: number,
  claimId: string,
  slot: "sands" | "goblet" | "circlet",
  statIds: string[],
  predicate: SourceConditionPredicateAst,
): SourceLocalConditionClaimInput {
  return controlledClaim(
    {
      claimId,
      catalogIndex,
      repositoryRecordId: GUIDE_REPOSITORY_RECORD,
      sourceId: SOURCE,
      sourceRecordId: GUIDE_SOURCE_RECORD,
      characterId: KLEE,
      recommendation: {
        recommendationId: "klee-on-field-artifact-stats",
        label: "On-field artifact stats",
        scope: "artifact-stats",
        roles: ["dps"],
        ordering: "unranked",
        classification: "conditional",
        grouping: "alternatives",
        sourceIndex: catalogIndex,
      },
      payload: {
        type: "main-stat",
        slot,
        statIds,
        priority: 1,
        target: null,
      },
      sourceConditions: ["Klee is played as an on-field DPS."],
      sourceConditionsSha256: hash(["Klee is played as an on-field DPS."]),
      predicate: structuredClone(predicate),
    },
    "main-stat",
    slot,
    true,
  );
}

function artifactClaim(
  catalogIndex: number,
  claimId: string,
  predicate: SourceConditionPredicateAst,
): SourceLocalConditionClaimInput {
  return controlledClaim(
    {
      claimId,
      catalogIndex,
      repositoryRecordId: GUIDE_REPOSITORY_RECORD,
      sourceId: SOURCE,
      sourceRecordId: GUIDE_SOURCE_RECORD,
      characterId: KLEE,
      recommendation: {
        recommendationId: "klee-contextual-artifact-sets",
        label: "Contextual artifact sets",
        scope: "artifacts",
        roles: ["dps"],
        ordering: "unranked",
        classification: "conditional",
        grouping: "single",
        sourceIndex: catalogIndex,
      },
      payload: {
        type: "artifact-group",
        artifacts: [{ type: "4pc", setId: "marechaussee_hunter" }],
      },
      sourceConditions: ["Use only when Furina is in the team."],
      sourceConditionsSha256: hash(["Use only when Furina is in the team."]),
      predicate: structuredClone(predicate),
    },
    "artifact-recommendation",
    undefined,
    false,
  );
}

function controlledClaim(
  claim: SourceConditionedAtomicClaim,
  claimAxis: "artifact-recommendation" | "main-stat",
  mainStatSlot: "sands" | "goblet" | "circlet" | undefined,
  bindRole: boolean,
): SourceLocalConditionClaimInput {
  return {
    claim,
    occurrenceControl: {
      occurrenceId: `occurrence:${claim.claimId}`,
      snapshotPath: SNAPSHOT,
      sourceId: claim.sourceId,
      sourceRecordId: claim.sourceRecordId,
      repositoryRecordId: claim.repositoryRecordId,
      manualPath: `records[0].recommendations[${claim.catalogIndex}]`,
      manualClaimPath: `recommendations[${claim.catalogIndex}]`,
      repositoryJsonPath: `$[0].recommendations[${claim.catalogIndex}].conditions`,
      claimAxis,
      ...(mainStatSlot ? { mainStatSlot } : {}),
      repositoryParity: "exact",
      sliceDisposition: "selected",
      energyClassification: "not-energy-deferred",
      sourceConditionsSha256: claim.sourceConditionsSha256,
      sourcePredicateSha256: hash(claim.predicate),
      payloadSha256: hash(claim.payload),
    },
    requestBindings: bindRole
      ? [
          {
            sourcePredicatePath: "predicate",
            sourcePredicateLeafSha256: hash(claim.predicate),
            requestPredicate: {
              type: "intended-role-is",
              characterId: KLEE,
              roleId: "on-field-dps",
            },
          },
        ]
      : [],
  };
}

function sourceCell(
  report: SourceLocalConditionSliceReport,
  claimId: string,
  teamRecordId: string,
) {
  const cell = report.sourceClaimCells
    .find((team) => team.teamRecordId === teamRecordId)
    ?.claimCells.find((candidate) => candidate.claimId === claimId);
  if (!cell) throw new Error(`Missing source cell ${teamRecordId}/${claimId}.`);
  return cell;
}

function projection(
  report: SourceLocalConditionSliceReport,
  claimId: string,
  teamRecordId: string,
) {
  const cell = report.requestContextReport?.teamProjections
    .find((team) => team.teamRecordId === teamRecordId)
    ?.claimProjections.find((candidate) => candidate.claimId === claimId);
  if (!cell) throw new Error(`Missing projection ${teamRecordId}/${claimId}.`);
  return cell;
}

function hash(value: unknown): string {
  return sha256Text(stableJson(value));
}
