import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ArtifactRatingModelSnapshot } from "../src/artifactRatingModel";
import { formatKeqingArtifactRatingKqmMarginalValidationSliceSummary } from "../src/assemble-keqing-artifact-rating-kqm-marginal-validation-slice";
import { readJson, sha256Text, stableJson } from "../src/io";
import {
  buildKeqingArtifactRatingKqmMarginalValidationSliceReport,
  KEQING_ARTIFACT_RATING_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_KQM_EQUIPMENT_REPORT_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_REPORT_PATH,
  KEQING_ARTIFACT_RATING_KQM_RAW_SNAPSHOT_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_MARGINAL_REPORT_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_SNAPSHOT_RELATIVE_PATH,
  requireAuthenticatedKeqingArtifactRatingKqmMarginalValidationSliceReport,
  type BuildKeqingArtifactRatingKqmMarginalValidationSliceInput,
} from "../src/keqingArtifactRatingKqmMarginalValidationSlice";
import type { KeqingIneffaTeamStatMarginalDiagnosticReport } from "../src/keqingIneffaTeamStatMarginalDiagnostic";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "../src/keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "../src/paths";
import type {
  KnowledgeRepository,
  ManualObservationSnapshot,
} from "../src/schemas";

describe("Keqing ArtifactRatingDB x KQM x local-marginal isolated validation", () => {
  it("authenticates the exact isolated source, KQM, and four-endpoint marginal boundaries", async () => {
    const report = buildKeqingArtifactRatingKqmMarginalValidationSliceReport(
      await fixture(),
    );

    expect(report.validationStatus).toBe(
      "authenticated-isolated-observation",
    );
    expect(report.issues).toEqual([]);
    expect(report.semanticScope).toMatchObject({
      acceptedAudit: {
        status: "accepted",
        trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      },
    });
    expect(report.artifactRatingDbBoundary).toMatchObject({
      authentication: "accepted",
      sourceId: "artifact-rating-db",
      sourceCommit: "255c084b0c35c33519d554c2532054fec57119cf",
      sourceRecordId: "avatar-10000042",
      characterId: "keqing",
      recordOccurrenceCount: 1,
      sourcePolicy: {
        status: "planned",
        permission: "mixed",
        integration: "isolated-pilot-only",
        consolidation: "blocked-pending-permission-review",
      },
      sourcePolicyMatchesExactly: true,
      sourceContext: {
        team: "unknown",
        roleVariant: "unknown",
        weapon: "unknown",
        constellation: "unknown",
        scenario: "unknown",
      },
      sourceContextMatchesExactly: true,
      crossSourceContextComparability: "not-established",
      coefficientMeaning: "source-native-heuristic-only",
    });
    expect(
      report.artifactRatingDbBoundary.deferredEnergyEvidence,
    ).toEqual({
      classification: "retained-source-evidence-no-er-computation",
      expectedOccurrenceCount: 2,
      observedOccurrenceCount: 2,
      observedRawOccurrenceCount: 2,
      observedNormalizedOccurrenceCount: 2,
      occurrences: [
        {
          rawPath: "records[0].rawModel.main.3.SPRatioBase",
          normalizedPath:
            "records[0].normalizedModel.main.sands.SPRatioBase",
          rawCoefficient: 0,
          normalizedCoefficient: 0,
          statId: "er",
          handling: "ignored-deferred-energy",
        },
        {
          rawPath: "records[0].rawModel.weight.SPRatioBase",
          normalizedPath:
            "records[0].normalizedModel.coefficients.SPRatioBase",
          rawCoefficient: 0,
          normalizedCoefficient: 0,
          statId: "er",
          handling: "ignored-deferred-energy",
        },
      ],
      exactOccurrenceClosure: true,
    });
    expect(report.kqmBoundary).toMatchObject({
      authentication: "accepted",
      rawSourceBoundary: {
        authentication: "accepted",
        sourceRecordId:
          "keqing-lunar-charged-default-artifact-stats-luna-i",
        locator: {
          url: "https://keqingmains.com/q/keqing-quickguide/",
          heading: "Lunar-Charged > Artifact Stats",
        },
        selectedRecordCount: 1,
        defaultRecordOccurrenceCount: 1,
        recommendationParityWithRepository: "exact",
      },
      equipmentEvidenceBoundary: {
        authentication: "accepted",
        validationStatus: "comparable",
        defaultClaimCount: 8,
        exactTeamMatchedClaimCount: 7,
        exactTeamUnresolvedClaimCount: 1,
        capabilityBoundary: {
          supportsGuideClaims: false,
          supportsEquipmentRecommendations: false,
          supportsStatRecommendations: false,
          supportsRankClaims: false,
          supportsConditionApplicabilityClaims: false,
          supportsDamageClaims: false,
          supportsEnergyRecoveryClaims: false,
          candidateGenerationInput: false,
          candidateGenerationExecuted: false,
          damageOrRankingComputationExecuted: false,
          energyRecoveryInputsUsed: false,
        },
      },
      guideRecordOccurrenceCount: 1,
      guideState: "candidate",
      sourcePromotionEligible: false,
      teamRecordOccurrenceCount: 1,
      exactRoster: ["keqing", "ineffa", "furina", "xilonen"],
      declaredReactions: ["lunarCharged"],
      conditionResolution: {
        occurrenceCount: 8,
        exactTeamFacts: {
          containsKeqing: true,
          declaresLunarCharged: true,
        },
        resolution: "matched-by-exact-team-facts",
        secondaryConditionOccurrenceCount: 1,
        secondaryConditionResolution:
          "withheld-unresolved-source-condition",
      },
      crossRecordJoin: "wrapper-owned-validation-only",
      sourceAuthoredCrossRecordJoin: false,
      comparisonPolicy: {
        comparedAxes: ["main-stat-presence", "substat-presence"],
        coefficientMagnitudeToMarginal: "not-compared",
        priorityOrdering: "not-compared-or-sorted",
        contextComparability: "not-established",
      },
    });
    expect(report.marginalBoundary).toMatchObject({
      authentication: "accepted",
      comparisonStatus: "comparable",
      endpointCount: 4,
      exactFourEndpointDomain: true,
      statCountPerCharacter: 9,
      exactNineStatDomain: true,
      plannedReplayCount: 148,
      observedReplayCount: 148,
      reactionFormulaLineCount: 0,
      capturedReactionFormulaLineCounts: [0, 0, 0, 0],
      reactionDomain: "reaction-free",
      formulaLineCount: 11,
      formulaBuffOverrides: null,
      readiness: {
        readyForDamageReplay: false,
        blockerCount: 8,
      },
    });
    expect(report.marginalBoundary.readiness.blockerCodes).toEqual([
      "translation-unreviewed",
      "partial-token-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-source-token",
    ]);
    expect(() =>
      requireAuthenticatedKeqingArtifactRatingKqmMarginalValidationSliceReport(
        report,
      ),
    ).not.toThrow();
    expect(
      formatKeqingArtifactRatingKqmMarginalValidationSliceSummary(report),
    ).toContain("0 guides, ranks, stat weights, or ER requirements produced");
  });

  it("emits the exact 4+4+1 rows and keeps Electro DMG source-only", async () => {
    const report = buildKeqingArtifactRatingKqmMarginalValidationSliceReport(
      await fixture(),
    );

    expect(report.summary).toEqual({
      rowCount: 10,
      sourceNonzeroLocalPositiveCount: 4,
      sourceZeroLocalZeroCount: 4,
      objectiveCoverageMismatchCount: 1,
      sourceMainOnlyCount: 1,
      deferredEnergyOccurrenceCount: 2,
      promotedRowCount: 0,
      rankedRowCount: 0,
      producedGuideCount: 0,
      producedStatWeightCount: 0,
      producedEnergyRequirementCount: 0,
    });
    expect(
      report.rows.map(({ statId, rowClassification }) => [
        statId,
        rowClassification,
      ]),
    ).toEqual([
      ["atk%", "source-nonzero-and-local-all-positive"],
      ["atk", "source-nonzero-and-local-all-positive"],
      ["cr", "source-nonzero-and-local-all-positive"],
      ["cd", "source-nonzero-and-local-all-positive"],
      ["def%", "source-zero-and-local-all-zero"],
      ["def", "source-zero-and-local-all-zero"],
      ["hp%", "source-zero-and-local-all-zero"],
      ["hp", "source-zero-and-local-all-zero"],
      ["em", "objective-coverage-mismatch"],
      ["electro%", "source-main-only-no-local-marginal"],
    ]);

    const expectedKqmPresence = {
      "atk%": { mainStatSlots: ["sands", "goblet"], listedAsSubstat: true },
      atk: { mainStatSlots: [], listedAsSubstat: false },
      cr: { mainStatSlots: ["circlet"], listedAsSubstat: true },
      cd: { mainStatSlots: ["circlet"], listedAsSubstat: true },
      "def%": { mainStatSlots: [], listedAsSubstat: false },
      def: { mainStatSlots: [], listedAsSubstat: false },
      "hp%": { mainStatSlots: [], listedAsSubstat: false },
      hp: { mainStatSlots: [], listedAsSubstat: false },
      em: { mainStatSlots: [], listedAsSubstat: true },
      "electro%": { mainStatSlots: ["goblet"], listedAsSubstat: false },
    };
    expect(
      Object.fromEntries(
        report.rows.map(({ statId, kqmPresence }) => [statId, kqmPresence]),
      ),
    ).toEqual(expectedKqmPresence);

    const em = report.rows.find(({ statId }) => statId === "em");
    expect(em).toMatchObject({
      artifactRatingDb: { coefficient: 0.85, coefficientClass: "positive" },
      localMarginal: {
        status: "observed-in-nine-stat-domain",
        endpointCount: 4,
        signClassification: "all-zero",
        zeroClassification: "all-zero",
      },
      coefficientMagnitudeComparedToLocalMarginal: false,
      kqmPriorityOrderingComparedOrSorted: false,
      contextsClaimedComparable: false,
    });
    const electro = report.rows.find(({ statId }) => statId === "electro%");
    expect(electro).toMatchObject({
      artifactRatingDb: {
        sourceLocation: "rawModel.main.4.ThunderAddedRatio",
        coefficient: 1,
        variableMainStatSlots: ["goblet"],
      },
      kqmPresence: {
        mainStatSlots: ["goblet"],
        listedAsSubstat: false,
      },
      localMarginal: {
        status: "not-in-nine-stat-marginal-domain",
        reason: "elemental-damage-main-stat-not-perturbed",
      },
    });
    expect(
      report.rows.every(
        ({ coefficientMagnitudeComparedToLocalMarginal }) =>
          coefficientMagnitudeComparedToLocalMarginal === false,
      ),
    ).toBe(true);
    expect(
      report.rows.every(
        ({ kqmPriorityOrderingComparedOrSorted }) =>
          kqmPriorityOrderingComparedOrSorted === false,
      ),
    ).toBe(true);
    expect(
      report.rows.every(
        ({ contextsClaimedComparable }) => contextsClaimedComparable === false,
      ),
    ).toBe(true);
  });

  it("keeps every guide, promotion, rank, stat-weight, and ER capability false", async () => {
    const report = buildKeqingArtifactRatingKqmMarginalValidationSliceReport(
      await fixture(),
    );
    expect(report).toMatchObject({
      supportsGuideClaims: false,
      supportsBuildRecommendations: false,
      supportsMainStatRecommendations: false,
      supportsSubstatRecommendations: false,
      supportsStatPriorityClaims: false,
      supportsScalarStatWeights: false,
      supportsIdealStatAllocation: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsContextApplicabilityClaims: false,
      supportsEnergyRequirements: false,
      promotionEligible: false,
      rankingProduced: false,
      guideProduced: false,
      statWeightsProduced: false,
      energyRequirementsProduced: false,
      energyRecoveryInputsUsed: false,
      candidateGenerationExecuted: false,
      optimizationExecuted: false,
    });
  });

  it("matches the durable report byte-for-structured-byte", async () => {
    const expected = buildKeqingArtifactRatingKqmMarginalValidationSliceReport(
      await fixture(),
    );
    const durable = await readJson(
      KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_REPORT_PATH,
    );
    expect(stableJson(durable)).toBe(stableJson(expected));
  });

  it("write guard rejects post-build provenance and interpretive-safety mutation", async () => {
    const original = buildKeqingArtifactRatingKqmMarginalValidationSliceReport(
      await fixture(),
    );
    const mutations = [
      (report: ReturnType<typeof mutable>) => {
        report.semanticScope.acceptedAudit.scopeProjectionSha256 = "0".repeat(
          64,
        );
      },
      (report: ReturnType<typeof mutable>) => {
        report.summary.promotedRowCount = 1;
      },
      (report: ReturnType<typeof mutable>) => {
        report.rows[0].coefficientMagnitudeComparedToLocalMarginal = true;
      },
      (report: ReturnType<typeof mutable>) => {
        report.rows[0].kqmPriorityOrderingComparedOrSorted = true;
      },
      (report: ReturnType<typeof mutable>) => {
        report.rows[0].contextsClaimedComparable = true;
      },
      (report: ReturnType<typeof mutable>) => {
        report.rows[0].rowOrdering = "ranked";
      },
      (report: ReturnType<typeof mutable>) => {
        report.rows.reverse();
      },
      (report: ReturnType<typeof mutable>) => {
        report.rows[0].artifactRatingDb.coefficient = 999;
      },
      (report: ReturnType<typeof mutable>) => {
        if (report.rows[0].localMarginal.status === "observed-in-nine-stat-domain") {
          report.rows[0].localMarginal.signClassification = "all-zero";
        }
      },
      (report: ReturnType<typeof mutable>) => {
        report.artifactRatingDbBoundary.sourcePolicy.status = "approved";
      },
      (report: ReturnType<typeof mutable>) => {
        report.marginalBoundary.readiness.blockerCodes = [];
      },
      (report: ReturnType<typeof mutable>) => {
        report.prohibitedInterpretations = [];
      },
    ];
    for (const mutateReport of mutations) {
      const report = mutable(original);
      mutateReport(report);
      expect(() =>
        requireAuthenticatedKeqingArtifactRatingKqmMarginalValidationSliceReport(
          report,
        ),
      ).toThrow("Refusing to write");
    }
  });

  it("rejects a rehashed source coefficient mutation", async () => {
    const input = mutable(await fixture());
    const record = input.artifactRatingSnapshot.records[0];
    record.rawModel.weight.AttackAddedRatio = 0.66;
    record.normalizedModel.coefficients.AttackAddedRatio.coefficient = 0.66;
    record.rawModelSha256 = sha256Text(stableJson(record.rawModel));
    expectScopeRejected(input);
  });

  it.each([
    [
      "source policy",
      (input: ReturnType<typeof mutable>) => {
        input.artifactRatingSnapshot.sourcePolicy.status = "accepted";
      },
      "artifact-rating-db.policy-drift",
    ],
    [
      "source context",
      (input: ReturnType<typeof mutable>) => {
        input.artifactRatingSnapshot.records[0].context.team =
          "keqing-ineffa-furina-xilonen";
      },
      "artifact-rating-db.context-drift",
    ],
    [
      "deferred energy closure",
      (input: ReturnType<typeof mutable>) => {
        delete input.artifactRatingSnapshot.records[0].rawModel.main["3"]
          .SPRatioBase;
        delete input.artifactRatingSnapshot.records[0].normalizedModel.main
          .sands.SPRatioBase;
      },
      "artifact-rating-db.energy-drift",
    ],
    [
      "extra normalized energy occurrence",
      (input: ReturnType<typeof mutable>) => {
        input.artifactRatingSnapshot.records[0].normalizedModel.main.goblet.SPRatioBase =
          {
            statId: "er",
            coefficient: 0,
            handling: "ignored-deferred-energy",
          };
      },
      "artifact-rating-db.energy-drift",
    ],
  ])("rejects %s drift", async (_label, mutate) => {
    const input = mutable(await fixture());
    mutate(input);
    expectScopeRejected(input);
  });

  it.each([
    [
      "KQM source record",
      (input: ReturnType<typeof mutable>) => {
        const guide = input.repository.records.find(
          ({ id }: { id: string }) =>
            id ===
            "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
        );
        guide.recommendations[0].mainStats.sands[0].statIds = ["em"];
      },
      "kqm.guide-drift",
    ],
    [
      "KQM team facts",
      (input: ReturnType<typeof mutable>) => {
        const team = input.repository.records.find(
          ({ id }: { id: string }) =>
            id ===
            "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
        );
        team.reactions = [];
      },
      "kqm.team-drift",
    ],
    [
      "raw KQM source parity",
      (input: ReturnType<typeof mutable>) => {
        const record = input.kqmRawSnapshot.records.find(
          ({ sourceRecordId }: { sourceRecordId?: string }) =>
            sourceRecordId ===
            "keqing-lunar-charged-default-artifact-stats-luna-i",
        );
        record.recommendation.mainStats.sands[0].statIds = ["em"];
      },
      "kqm.raw-source-drift",
    ],
    [
      "equipment-evidence capability boundary",
      (input: ReturnType<typeof mutable>) => {
        input.kqmEquipmentReport.supportsGuideClaims = true;
      },
      "kqm.equipment-evidence-drift",
    ],
    [
      "equipment-evidence exact-team resolution",
      (input: ReturnType<typeof mutable>) => {
        const claim = input.kqmEquipmentReport.claims.find(
          ({ claimId }: { claimId: string }) =>
            claimId.endsWith(":main-stat:sands:0"),
        );
        const resolution = claim.teamResolutions.find(
          ({ teamRecordId }: { teamRecordId: string }) =>
            teamRecordId ===
            "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
        );
        resolution.resolution = "withheld-unresolved-source-condition";
      },
      "kqm.equipment-evidence-drift",
    ],
  ])("rejects %s drift", async (_label, mutate) => {
    const input = mutable(await fixture());
    mutate(input);
    expectScopeRejected(input);
  });

  it("rejects local-marginal sign drift even when a caller supplies the old file hash", async () => {
    const input = mutable(await fixture());
    const stats = input.marginalReport.marginalDiagnostic.crossEndpointSummary
      .characters.find(
        ({ characterId }: { characterId: string }) =>
          characterId === "keqing",
      ).stats;
    const cr = stats.find(({ stat }: { stat: string }) => stat === "cr");
    cr.signClassification = "all-zero";
    cr.zeroClassification = "all-zero";
    cr.positiveEndpointIds = [];
    cr.zeroEndpointIds = [
      "carry-keqing",
      "carry-ineffa",
      "carry-furina",
      "carry-xilonen",
    ];

    expectScopeRejected(input);
  });

  it.each([
    [
      "reaction-free objective",
      (input: ReturnType<typeof mutable>) => {
        input.marginalReport.marginalDiagnostic.technicalObjective.combo.lines[0].reaction =
          "lunarCharged";
      },
      "marginal.objective-drift",
    ],
    [
      "eight-blocker readiness",
      (input: ReturnType<typeof mutable>) => {
        input.marginalReport.technicalObjectiveProvenance.readiness.blockers.pop();
        input.marginalReport.technicalObjectiveProvenance.readiness.blockerCount =
          7;
      },
      "marginal.readiness-drift",
    ],
    [
      "EM objective gap",
      (input: ReturnType<typeof mutable>) => {
        const stats = input.marginalReport.marginalDiagnostic
          .crossEndpointSummary.characters.find(
            ({ characterId }: { characterId: string }) =>
              characterId === "keqing",
          ).stats;
        const em = stats.find(({ stat }: { stat: string }) => stat === "em");
        em.signClassification = "all-positive";
        em.zeroClassification = "none-zero";
        em.zeroEndpointIds = [];
        em.positiveEndpointIds = [
          "carry-keqing",
          "carry-ineffa",
          "carry-furina",
          "carry-xilonen",
        ];
      },
      "marginal.keqing-stat-outcome-drift",
    ],
  ])("rejects %s drift", async (_label, mutate) => {
    const input = mutable(await fixture());
    mutate(input);
    expectScopeRejected(input);
  });
});

async function fixture(): Promise<BuildKeqingArtifactRatingKqmMarginalValidationSliceInput> {
  const [
    artifactRatingSnapshot,
    repository,
    marginalReport,
    kqmRawSnapshot,
    kqmEquipmentReport,
  ] = await Promise.all([
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_SNAPSHOT_RELATIVE_PATH,
        ),
      ),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
        ),
      ),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_MARGINAL_REPORT_RELATIVE_PATH,
        ),
      ),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_KQM_RAW_SNAPSHOT_RELATIVE_PATH,
        ),
      ),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_KQM_EQUIPMENT_REPORT_RELATIVE_PATH,
        ),
      ),
    ]);
  return {
    artifactRatingSnapshot:
      artifactRatingSnapshot as ArtifactRatingModelSnapshot,
    repository: repository as KnowledgeRepository,
    marginalReport:
      marginalReport as KeqingIneffaTeamStatMarginalDiagnosticReport,
    kqmRawSnapshot: kqmRawSnapshot as ManualObservationSnapshot,
    kqmEquipmentReport:
      kqmEquipmentReport as KeqingLunarEquipmentEvidenceValidationReport,
  };
}

function mutable<T>(input: T): any {
  return structuredClone(input);
}

function expectScopeRejected(
  input: BuildKeqingArtifactRatingKqmMarginalValidationSliceInput,
): void {
  expect(() =>
    buildKeqingArtifactRatingKqmMarginalValidationSliceReport(
      input,
    ),
  ).toThrow("semantic scope authentication failed");
}
