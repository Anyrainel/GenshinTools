import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import { REPOSITORY_ROOT } from "../src/paths";
import {
  authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic,
  buildXiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
  compareXiaoFfxxFiveStarSourceGroupTotals,
  requireAuthenticatedXiaoFfxxFiveStarSourceGroupValidationDiagnostic,
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_ABSOLUTE_TOLERANCE,
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_RELATIVE_TOLERANCE,
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_REPORT_PATH,
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_SOURCE_FILE_PATHS,
  type BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
  type XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
} from "../src/xiaoFfxxFiveStarSourceGroupValidationDiagnostic";
import {
  XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS,
  type XiaoFfxxUnitExpandedExecutionGateReport,
} from "../src/xiaoFfxxUnitExpandedExecutionGate";

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const XIAO_MANUAL_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const XIAO_ROTATION_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json";
const GENSHINTOOLS_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const XIAO_SOURCE_LOCAL_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-source-local-condition-slice.json";
const APPLICABLE_CLAIM_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-applicable-claim-projection-contract.json";
const PARTIAL_CANDIDATE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-partial-artifact-candidate-contract.json";
const BRANCH_SOURCE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-non-er-equipment-branch-source-slice.json";
const BRANCH_CANDIDATE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-non-er-condition-free-branch-candidate-contract.json";
const FORMULA_COUNT_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-formula-count-parity.json";
const GROUPED_REPLAY_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-grouped-replay-representation-preflight.json";
const UNIT_EXPANDED_GATE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-unit-expanded-execution-gate.json";
const CHARACTER_BETA_STATS_PATH =
  "src/data/game/character_beta_stats.json.gz";
const WEAPON_BETA_STATS_PATH = "src/data/game/weapon_beta_stats.json.gz";

const RANK_ONE_IDS = [
  "guide-factory:xiao-ffxx:partial-non-er:lumidouce_elegy:mh-atk-anemo",
  "guide-factory:xiao-ffxx:partial-non-er:primordial_jade_wingedspear:mh-atk-anemo",
  "guide-factory:xiao-ffxx:partial-non-er:staff_of_homa:mh-atk-anemo",
] as const;
const RANK_TWO_IDS = [
  "guide-factory:xiao-ffxx:partial-non-er:calamity_queller:mh-atk-anemo",
  "guide-factory:xiao-ffxx:partial-non-er:vortex_vanquisher:mh-atk-anemo",
] as const;
const DEATHMATCH_ID =
  "guide-factory:xiao-ffxx:partial-non-er:deathmatch:mh-atk-anemo";

const EXPECTED_PAIRS = [
  {
    rankOneCandidateId: RANK_ONE_IDS[0],
    rankTwoCandidateId: RANK_TWO_IDS[0],
    rankOneMinusRankTwo: -67980.283579882,
    outcome: "source-order-counterexample" as const,
  },
  {
    rankOneCandidateId: RANK_ONE_IDS[0],
    rankTwoCandidateId: RANK_TWO_IDS[1],
    rankOneMinusRankTwo: -36195.0731835,
    outcome: "source-order-counterexample" as const,
  },
  {
    rankOneCandidateId: RANK_ONE_IDS[1],
    rankTwoCandidateId: RANK_TWO_IDS[0],
    rankOneMinusRankTwo: -37605.679292792,
    outcome: "source-order-counterexample" as const,
  },
  {
    rankOneCandidateId: RANK_ONE_IDS[1],
    rankTwoCandidateId: RANK_TWO_IDS[1],
    rankOneMinusRankTwo: -5820.46889641002,
    outcome: "source-order-counterexample" as const,
  },
  {
    rankOneCandidateId: RANK_ONE_IDS[2],
    rankTwoCandidateId: RANK_TWO_IDS[0],
    rankOneMinusRankTwo: 51219.288330754,
    outcome: "source-order-aligned" as const,
  },
  {
    rankOneCandidateId: RANK_ONE_IDS[2],
    rankTwoCandidateId: RANK_TWO_IDS[1],
    rankOneMinusRankTwo: 83004.498727136,
    outcome: "source-order-aligned" as const,
  },
] as const;

const JSON_INPUTS = [
  ["repositoryInput", REPOSITORY_PATH],
  ["xiaoManualSnapshotInput", XIAO_MANUAL_PATH],
  ["xiaoRotationFixtureSnapshotInput", XIAO_ROTATION_PATH],
  ["genshinToolsSnapshotInput", GENSHINTOOLS_SNAPSHOT_PATH],
  ["manualIndexInput", MANUAL_INDEX_PATH],
  ["sourceRegistryInput", SOURCE_REGISTRY_PATH],
  ["xiaoSourceLocalDurableReportInput", XIAO_SOURCE_LOCAL_REPORT_PATH],
  ["applicableClaimDurableReportInput", APPLICABLE_CLAIM_REPORT_PATH],
  ["partialCandidateDurableReportInput", PARTIAL_CANDIDATE_REPORT_PATH],
  ["branchSourceDurableReportInput", BRANCH_SOURCE_REPORT_PATH],
  ["branchCandidateDurableReportInput", BRANCH_CANDIDATE_REPORT_PATH],
  ["formulaCountDurableReportInput", FORMULA_COUNT_REPORT_PATH],
  ["groupedReplayDurableReportInput", GROUPED_REPLAY_REPORT_PATH],
  ["unitExpandedDurableReportInput", UNIT_EXPANDED_GATE_REPORT_PATH],
] as const satisfies ReadonlyArray<
  readonly [
    keyof Omit<
      BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
      "sourceFiles" | "generatedFrom"
    >,
    string,
  ]
>;

let baseInput: BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput;
let durableReport: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport;
let canonicalReport: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadFixture(),
    readJson(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_REPORT_PATH,
    ) as Promise<XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport>,
  ]);
  canonicalReport =
    await buildXiaoFfxxFiveStarSourceGroupValidationDiagnosticReport(fixture());
}, 60_000);

describe("Xiao FFXX five-star source-group validation diagnostic", () => {
  it("rebuilds deterministically and authenticates the exact 124-byte/14-JSON closure", async () => {
    expect(stableJson(canonicalReport)).toBe(stableJson(durableReport));
    expect(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
    ).toHaveLength(124);
    expect(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_SOURCE_FILE_PATHS,
    ).toEqual(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
    );
    expect(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
    ).toEqual(
      [
        ...XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
      ].sort(),
    );
    expect(
      new Set(
        XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
      ).size,
    ).toBe(124);
    expect(JSON_INPUTS).toHaveLength(14);
    expect(
      XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS.every((sourcePath) =>
        XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS.includes(
          sourcePath,
        ),
      ),
    ).toBe(true);
    expect(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS.filter(
        (sourcePath) =>
          !XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS.includes(
            sourcePath,
          ),
      ),
    ).toEqual([
      UNIT_EXPANDED_GATE_REPORT_PATH,
      "scripts/guide-factory/src/assemble-xiao-ffxx-five-star-source-group-validation-diagnostic.ts",
      "scripts/guide-factory/src/xiaoFfxxFiveStarSourceGroupValidationDiagnostic.ts",
    ]);
    expect(canonicalReport.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      combinedJsonInputByteAndParsedObjectParity: true,
      sourceFileCount: 124,
      generatedFromCount: 124,
      authenticatedJsonInputParityCount: 14,
    });

    const hashByPath = new Map(
      baseInput.generatedFrom.map(({ path: sourcePath, sha256 }) => [
        sourcePath,
        sha256,
      ]),
    );
    for (const sourceFile of baseInput.sourceFiles) {
      expect(
        sha256Bytes(Buffer.from(sourceFile.bytesBase64, "base64")),
        sourceFile.path,
      ).toBe(hashByPath.get(sourceFile.path));
    }
    expect(
      await authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic(
        durableReport,
        fixture(),
      ),
    ).toMatchObject({ authenticated: true });
    await expect(
      requireAuthenticatedXiaoFfxxFiveStarSourceGroupValidationDiagnostic(
        durableReport,
        fixture(),
      ),
    ).resolves.toBeUndefined();
  }, 60_000);

  it("fresh-authenticates checkpoint 48 and projects six technical-ID-ordered observations without replay", () => {
    expect(canonicalReport.upstreamBoundary).toEqual({
      durableReportPath: UNIT_EXPANDED_GATE_REPORT_PATH,
      durableReportFileSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      durableReportCanonicalObjectSha256: expect.stringMatching(
        /^[a-f0-9]{64}$/,
      ),
      freshlyAuthenticated: true,
      upstreamInputCount: 121,
      authenticatedTechnicalObservationCount: 6,
      checkpoint49AdditionalReplayCount: 0,
      checkpoint49ReplayExecuted: false,
      upstreamComparisonExecuted: false,
      upstreamRankedCandidateCount: 0,
      upstreamWinnerCount: 0,
      upstreamRecommendationCount: 0,
    });

    const upstream =
      baseInput.unitExpandedDurableReportInput as XiaoFfxxUnitExpandedExecutionGateReport;
    const upstreamById = new Map(
      upstream.observations.map((observation) => [
        observation.candidateId,
        observation,
      ]),
    );
    const observations = canonicalReport.technicalEvidenceBoundary.observations;
    expect(observations).toHaveLength(6);
    expect(observations.map(({ candidateId }) => candidateId)).toEqual(
      observations.map(({ candidateId }) => candidateId).sort(),
    );
    expect(new Set(observations.map(({ candidateId }) => candidateId)).size).toBe(
      6,
    );
    expect(observations.map(({ weaponId }) => weaponId)).toEqual([
      "calamity_queller",
      "deathmatch",
      "lumidouce_elegy",
      "primordial_jade_wingedspear",
      "staff_of_homa",
      "vortex_vanquisher",
    ]);
    for (const observation of observations) {
      const upstreamObservation = upstreamById.get(observation.candidateId);
      expect(upstreamObservation).toBeDefined();
      expect(observation).toMatchObject({
        candidateIdentitySha256: upstreamObservation?.candidateIdentitySha256,
        weaponId: upstreamObservation?.weaponId,
        refinement: upstreamObservation?.refinement,
        unitExpandedDirectTotalDamage:
          upstreamObservation?.normalizedExecution.unitExpandedDirectTotalDamage,
        upstreamObservationSha256: upstreamObservation?.observationSha256,
        technicalObservationEligible: true,
        comparisonEligible: false,
        technicalEvidenceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      const { technicalEvidenceSha256: _hash, ...identity } = observation;
      expect(observation.technicalEvidenceSha256).toBe(sha256Value(identity));
    }
    expect(canonicalReport.technicalEvidenceBoundary).toMatchObject({
      evidenceOrigin:
        "fresh-authenticated-checkpoint-48-unit-expanded-direct-total",
      technicalEvidenceIndependentOfSourceMembership: true,
      sourceRanksExcludedFromTechnicalEvidenceIdentity: true,
      candidateCount: 6,
      fiveStarCandidateCount: 5,
      authenticatedExcludedFourStarCandidateCount: 1,
    });
  });

  it("authenticates exactly the two ranked five-star groups and excludes Deathmatch from every comparison", () => {
    const target = canonicalReport.sourceTargetBoundary;
    expect(target).toMatchObject({
      targetKind: "source-authored-five-star-rank-group-ordering",
      validationTargetOnly: true,
      expectedRelation: "every-rank-one-member-above-every-rank-two-member",
      sourceTargetIndependentOfTechnicalTotals: true,
      numericTotalsExcludedFromSourceTargetIdentity: true,
      sourceGroupCount: 2,
      sourceMembershipEdgeCount: 5,
      expectedCrossGroupPairCount: 6,
      withinGroupPairwiseRelationCount: 0,
      withinGroupPairwiseRelationExecuted: false,
      withinGroupEnvelopeExtremaComputed: true,
      membersTiedMeansSourceCoMembershipOnly: true,
      withinGroupNumericEqualityAsserted: false,
      withinGroupRankingProduced: false,
    });
    expect(
      target.groups.map(
        ({
          sourceRankGroup,
          sourceOrdering,
          membersTied,
          membersTiedMeansSourceCoMembershipOnly,
          withinGroupNumericEqualityAsserted,
          withinGroupRankingProduced,
          candidateIds,
        }) => ({
          sourceRankGroup,
          sourceOrdering,
          membersTied,
          membersTiedMeansSourceCoMembershipOnly,
          withinGroupNumericEqualityAsserted,
          withinGroupRankingProduced,
          candidateIds,
        }),
      ),
    ).toEqual([
      {
        sourceRankGroup: 1,
        sourceOrdering: "ranked-groups",
        membersTied: true,
        membersTiedMeansSourceCoMembershipOnly: true,
        withinGroupNumericEqualityAsserted: false,
        withinGroupRankingProduced: false,
        candidateIds: [...RANK_ONE_IDS],
      },
      {
        sourceRankGroup: 2,
        sourceOrdering: "ranked-groups",
        membersTied: true,
        membersTiedMeansSourceCoMembershipOnly: true,
        withinGroupNumericEqualityAsserted: false,
        withinGroupRankingProduced: false,
        candidateIds: [...RANK_TWO_IDS],
      },
    ]);
    expect(target.deathmatchExclusion).toEqual({
      candidateId: DEATHMATCH_ID,
      branchGroupId: "xiao-ffxx:four-star-unranked-deathmatch",
      authenticatedTechnicalObservation: true,
      sourceOrdering: "unranked",
      sourceRankGroup: null,
      excludedFromFiveStarGroups: true,
      excludedFromAllPairs: true,
      crossRarityComparisonExecuted: false,
      relativePosition: null,
      factoryRank: null,
    });
    expect(
      target.groups.flatMap(({ candidateIds }) => candidateIds),
    ).not.toContain(DEATHMATCH_ID);
    expect(
      canonicalReport.comparisons.some(
        ({ rankOneCandidateId, rankTwoCandidateId }) =>
          rankOneCandidateId === DEATHMATCH_ID ||
          rankTwoCandidateId === DEATHMATCH_ID,
      ),
    ).toBe(false);
  });

  it("enumerates the unique technical-ID-sorted 3x2 cross-product with the exact 2/4/0 witness", () => {
    expect(canonicalReport.comparisons).toHaveLength(6);
    expect(
      new Set(canonicalReport.comparisons.map(({ comparisonId }) => comparisonId))
        .size,
    ).toBe(6);
    expect(canonicalReport.comparisons.map(({ comparisonId }) => comparisonId)).toEqual(
      canonicalReport.comparisons.map(({ comparisonId }) => comparisonId).sort(),
    );
    expect(
      canonicalReport.comparisons.map(
        ({
          rankOneCandidateId,
          rankTwoCandidateId,
          rankOneMinusRankTwo,
          outcome,
        }) => ({
          rankOneCandidateId,
          rankTwoCandidateId,
          rankOneMinusRankTwo,
          outcome,
        }),
      ),
    ).toEqual(EXPECTED_PAIRS);

    for (const comparison of canonicalReport.comparisons) {
      expect(RANK_ONE_IDS).toContain(comparison.rankOneCandidateId);
      expect(RANK_TWO_IDS).toContain(comparison.rankTwoCandidateId);
      expect(comparison.rankOneCandidateId).not.toBe(
        comparison.rankTwoCandidateId,
      );
      const recomputed = compareXiaoFfxxFiveStarSourceGroupTotals(
        comparison.rankOneUnitExpandedDirectTotalDamage,
        comparison.rankTwoUnitExpandedDirectTotalDamage,
      );
      const rankOneEvidence =
        canonicalReport.technicalEvidenceBoundary.observations.find(
          ({ candidateId }) => candidateId === comparison.rankOneCandidateId,
        );
      const rankTwoEvidence =
        canonicalReport.technicalEvidenceBoundary.observations.find(
          ({ candidateId }) => candidateId === comparison.rankTwoCandidateId,
        );
      expect(comparison).toMatchObject({
        rankOneTechnicalEvidenceSha256:
          rankOneEvidence?.technicalEvidenceSha256,
        rankTwoTechnicalEvidenceSha256:
          rankTwoEvidence?.technicalEvidenceSha256,
        rankOneUpstreamObservationSha256:
          rankOneEvidence?.upstreamObservationSha256,
        rankTwoUpstreamObservationSha256:
          rankTwoEvidence?.upstreamObservationSha256,
        rankOneSourceGroupId: "xiao-ffxx:five-star-source-rank-group-1",
        rankTwoSourceGroupId: "xiao-ffxx:five-star-source-rank-group-2",
        rankOneSourceRankGroup: 1,
        rankTwoSourceRankGroup: 2,
        ...recomputed,
        sourceOrderAligned: recomputed.outcome === "source-order-aligned",
        sourceOrderCounterexample:
          recomputed.outcome === "source-order-counterexample",
        withinToleranceTie: recomputed.outcome === "within-tolerance-tie",
        validationTargetOnly: true,
        factoryRank: null,
        winner: false,
        recommendation: false,
        sourceErrorClaimed: false,
        calculatorCorrectnessClaimed: false,
        computedCorrectionClaimed: false,
        recommendationClaimed: false,
        comparisonSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      const { comparisonSha256: _hash, ...identity } = comparison;
      expect(comparison.comparisonSha256).toBe(sha256Value(identity));
    }
    expect(canonicalReport.summary).toMatchObject({
      exhaustiveCrossGroupPairCount: 6,
      sourceOrderAlignedPairCount: 2,
      sourceOrderCounterexamplePairCount: 4,
      withinToleranceTiePairCount: 0,
      withinGroupPairwiseRelationCount: 0,
      crossRarityComparisonCount: 0,
    });
  });

  it("records the exact overlapping envelopes without treating source co-membership as numeric equality", () => {
    expect(canonicalReport.envelopeDiagnostic).toEqual({
      metric: "unit-expanded-direct-total-damage",
      rankOneMinimum: 379351.864171342,
      rankOneMaximum: 498551.436081978,
      rankTwoMinimum: 415546.937354842,
      rankTwoMaximum: 447332.147751224,
      overlapLowerBound: 415546.937354842,
      overlapUpperBound: 447332.147751224,
      overlapWidth: 31785.210396382,
      envelopesOverlap: true,
      classification: "overlapping-source-group-envelopes",
      validationTargetOnly: true,
      strictNumericPartitionReproduced: false,
      envelopeDiagnosticSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const { envelopeDiagnosticSha256: _hash, ...identity } =
      canonicalReport.envelopeDiagnostic;
    expect(canonicalReport.envelopeDiagnostic.envelopeDiagnosticSha256).toBe(
      sha256Value(identity),
    );
    for (const group of canonicalReport.sourceTargetBoundary.groups) {
      const totals = group.candidateIds.map(
        (candidateId) =>
          canonicalReport.technicalEvidenceBoundary.observations.find(
            (observation) => observation.candidateId === candidateId,
          )?.unitExpandedDirectTotalDamage,
      );
      expect(new Set(totals).size).toBe(group.candidateIds.length);
    }
    expect(canonicalReport.groupAverageComputed).toBe(false);
    expect(canonicalReport.groupScoreComputed).toBe(false);
  });

  it("separates technical evidence, source targets, and bound diagnostic-result identities", () => {
    const technicalEvidenceHashes =
      canonicalReport.technicalEvidenceBoundary.observations.map(
        ({ technicalEvidenceSha256 }) => technicalEvidenceSha256,
      );
    expect(canonicalReport.identityBoundary.technicalEvidenceSha256).toBe(
      sha256Value(technicalEvidenceHashes),
    );
    expect(canonicalReport.technicalEvidenceBoundary.technicalEvidenceSha256).toBe(
      canonicalReport.identityBoundary.technicalEvidenceSha256,
    );
    const comparedFiveStarEvidenceHashes =
      canonicalReport.technicalEvidenceBoundary.observations
        .filter(({ candidateId }) => candidateId !== DEATHMATCH_ID)
        .map(({ technicalEvidenceSha256 }) => technicalEvidenceSha256);
    expect(
      canonicalReport.identityBoundary.comparedFiveStarTechnicalEvidenceSha256,
    ).toBe(sha256Value(comparedFiveStarEvidenceHashes));
    expect(
      canonicalReport.technicalEvidenceBoundary
        .comparedFiveStarTechnicalEvidenceSha256,
    ).toBe(
      canonicalReport.identityBoundary.comparedFiveStarTechnicalEvidenceSha256,
    );
    expect(canonicalReport.sourceTargetBoundary.sourceTargetSha256).toBe(
      sha256Value({
        targetKind: "source-authored-five-star-rank-group-ordering",
        expectedRelation: "every-rank-one-member-above-every-rank-two-member",
        groups: canonicalReport.sourceTargetBoundary.groups,
        deathmatchExclusion:
          canonicalReport.sourceTargetBoundary.deathmatchExclusion,
      }),
    );
    expect(canonicalReport.identityBoundary.diagnosticResultSha256).toBe(
      sha256Value({
        comparedFiveStarTechnicalEvidenceSha256:
          canonicalReport.identityBoundary
            .comparedFiveStarTechnicalEvidenceSha256,
        sourceTargetSha256:
          canonicalReport.identityBoundary.sourceTargetSha256,
        comparisonPolicy: canonicalReport.comparisonPolicy,
        comparisonHashes: canonicalReport.comparisons.map(
          ({ comparisonSha256 }) => comparisonSha256,
        ),
        envelopeDiagnosticSha256:
          canonicalReport.envelopeDiagnostic.envelopeDiagnosticSha256,
      }),
    );
    expect(canonicalReport.identityBoundary.aggregateDiagnosticSha256).toBe(
      sha256Value({
        upstreamCanonicalObjectSha256:
          canonicalReport.identityBoundary.upstreamCanonicalObjectSha256,
        diagnosticResultSha256:
          canonicalReport.identityBoundary.diagnosticResultSha256,
      }),
    );
    expect(canonicalReport.identityBoundary).toMatchObject({
      sourceTargetSha256:
        canonicalReport.sourceTargetBoundary.sourceTargetSha256,
      technicalEvidenceIdentityExcludesSourceGroups: true,
      sourceTargetIdentityExcludesTechnicalTotals: true,
      diagnosticResultBindsTechnicalEvidenceAndSourceTarget: true,
      sourceRankIncludedInSourceTargetIdentity: true,
      sourceRankIncludedInDiagnosticJoinIdentity: true,
      sourceRankCannotAlterTechnicalEvidenceValues: true,
      deathmatchExcludedFromCrossGroupPairs: true,
    });
  });

  it("emits validation targets only and withholds every rank, guide, replay, optimizer, and ER claim", () => {
    expect(canonicalReport).toMatchObject({
      validationStatus: "accepted-as-validation-target-only",
      diagnosticStatus: "counterexamples-observed-validation-target-only",
      comparisonExecutionStatus: "performed-validation-target-only",
      publicationStatus: "withheld-not-a-guide-or-ranking",
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsBuildRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsWinnerClaims: false,
      supportsRecommendationClaims: false,
      supportsDamageClaims: false,
      supportsDamageComparisonClaims: false,
      supportsGameplayClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      sourceErrorClaimed: false,
      calculatorCorrectnessClaimed: false,
      computedCorrectionClaimed: false,
      recommendationClaimed: false,
      sourceGroupValidationTargetProduced: true,
      diagnosticComparisonExecuted: true,
      withinGroupPairwiseRelationExecuted: false,
      withinGroupEnvelopeExtremaComputed: true,
      crossRarityComparisonExecuted: false,
      rankingExecuted: false,
      winnerSelectionExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      autoTuneExecuted: false,
      recommendationCompositionExecuted: false,
      idealRollAllocationExecuted: false,
      groupAverageComputed: false,
      groupScoreComputed: false,
      circletSelectionExecuted: false,
      substatSelectionExecuted: false,
      energyRecoveryInputsUsed: false,
      energyRecoveryComputationExecuted: false,
      summary: {
        authenticatedCandidateCount: 6,
        fiveStarCandidateCount: 5,
        deathmatchAuthenticatedExcludedCount: 1,
        sourceGroupCount: 2,
        sourceMembershipEdgeCount: 5,
        exhaustiveCrossGroupPairCount: 6,
        sourceOrderAlignedPairCount: 2,
        sourceOrderCounterexamplePairCount: 4,
        withinToleranceTiePairCount: 0,
        overlappingEnvelopeCount: 1,
        withinGroupPairwiseRelationCount: 0,
        crossRarityComparisonCount: 0,
        rankedCandidateCount: 0,
        winnerCount: 0,
        recommendationCount: 0,
        completeBuildCount: 0,
        energyRecoveryComputationCount: 0,
      },
      issues: [],
    });
    expect(canonicalReport.upstreamBoundary.checkpoint49AdditionalReplayCount).toBe(
      0,
    );
    expect(canonicalReport.upstreamBoundary.checkpoint49ReplayExecuted).toBe(
      false,
    );
  });

  it("compares absolute and relative tolerances purely and rejects non-finite totals", () => {
    expect(XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_ABSOLUTE_TOLERANCE).toBe(1e-9);
    expect(XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_RELATIVE_TOLERANCE).toBe(1e-12);
    expect(canonicalReport.comparisonPolicy).toEqual({
      policyId: "finite-absolute-relative-tolerance-v1",
      metric: "unit-expanded-direct-total-damage",
      direction: "rank-one-minus-rank-two",
      pairEnumeration: "technical-id-ordered-exhaustive-cartesian-3x2",
      expectedPairCount: 6,
      absoluteTolerance: 1e-9,
      relativeTolerance: 1e-12,
      allowedDifferenceFormula:
        "max(absoluteTolerance, relativeTolerance * max(1, abs(rankOne), abs(rankTwo)))",
      finiteInputsRequired: true,
      gameplaySignificanceThresholdApplied: false,
      strictAboveToleranceMeansAligned: true,
      strictBelowNegativeToleranceMeansCounterexample: true,
      withinInclusiveToleranceMeansTie: true,
    });
    expect(compareXiaoFfxxFiveStarSourceGroupTotals(2, 1)).toMatchObject({
      rankOneMinusRankTwo: 1,
      absoluteDifference: 1,
      outcome: "source-order-aligned",
    });
    expect(compareXiaoFfxxFiveStarSourceGroupTotals(1, 2)).toMatchObject({
      rankOneMinusRankTwo: -1,
      absoluteDifference: 1,
      outcome: "source-order-counterexample",
    });
    expect(compareXiaoFfxxFiveStarSourceGroupTotals(1, 1)).toMatchObject({
      rankOneMinusRankTwo: 0,
      absoluteDifference: 0,
      outcome: "within-tolerance-tie",
    });
    expect(compareXiaoFfxxFiveStarSourceGroupTotals(-1, -2).outcome).toBe(
      "source-order-aligned",
    );

    const absoluteDelta =
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_ABSOLUTE_TOLERANCE / 2;
    expect(
      compareXiaoFfxxFiveStarSourceGroupTotals(1 + absoluteDelta, 1).outcome,
    ).toBe("within-tolerance-tie");
    expect(
      compareXiaoFfxxFiveStarSourceGroupTotals(
        1 + XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_ABSOLUTE_TOLERANCE * 2,
        1,
      ).outcome,
    ).toBe("source-order-aligned");
    const relativeBase = 1_000_000_000;
    const relativeDelta =
      relativeBase *
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_RELATIVE_TOLERANCE *
      0.5;
    expect(
      compareXiaoFfxxFiveStarSourceGroupTotals(
        relativeBase + relativeDelta,
        relativeBase,
      ).outcome,
    ).toBe("within-tolerance-tie");
    expect(
      compareXiaoFfxxFiveStarSourceGroupTotals(
        relativeBase +
          relativeBase *
            XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_RELATIVE_TOLERANCE *
            2,
        relativeBase,
      ).outcome,
    ).toBe("source-order-aligned");
    for (const [rankOne, rankTwo] of [
      [Number.NaN, 1],
      [1, Number.NaN],
      [Number.POSITIVE_INFINITY, 1],
      [1, Number.NEGATIVE_INFINITY],
      [Number.MAX_VALUE, -Number.MAX_VALUE],
    ]) {
      expect(() =>
        compareXiaoFfxxFiveStarSourceGroupTotals(rankOne, rankTwo),
      ).toThrow("finite");
    }
  });

  it("rejects missing, duplicate, hash/parity-mismatched, and binary-tampered authenticated inputs", async () => {
    const missing = fixture();
    missing.sourceFiles = missing.sourceFiles.slice(1);
    await expectRejectedInput(missing, "source-file path closure drifted");

    const duplicate = fixture();
    duplicate.generatedFrom = [
      ...duplicate.generatedFrom,
      duplicate.generatedFrom[0],
    ];
    await expectRejectedInput(duplicate, "generatedFrom path closure drifted");

    const rawHashMismatch = fixture();
    rawHashMismatch.generatedFrom = rawHashMismatch.generatedFrom.map((entry) =>
      entry.path === UNIT_EXPANDED_GATE_REPORT_PATH
        ? { ...entry, sha256: "0".repeat(64) }
        : entry,
    );
    await expectRejectedInput(rawHashMismatch, UNIT_EXPANDED_GATE_REPORT_PATH);

    const parityMismatch = fixture();
    const parsedUpstream = structuredClone(
      parityMismatch.unitExpandedDurableReportInput,
    ) as XiaoFfxxUnitExpandedExecutionGateReport;
    Reflect.set(parsedUpstream.summary, "winnerCount", 1);
    parityMismatch.unitExpandedDurableReportInput = parsedUpstream;
    await expectRejectedInput(parityMismatch, "parsed input disagrees with bytes");

    const malformedJson = fixture();
    const malformedText = "{not-json";
    malformedJson.sourceFiles = malformedJson.sourceFiles.map((entry) =>
      entry.path === UNIT_EXPANDED_GATE_REPORT_PATH
        ? {
            ...entry,
            bytesBase64: Buffer.from(malformedText).toString("base64"),
          }
        : entry,
    );
    malformedJson.generatedFrom = malformedJson.generatedFrom.map((entry) =>
      entry.path === UNIT_EXPANDED_GATE_REPORT_PATH
        ? { ...entry, sha256: sha256Text(malformedText) }
        : entry,
    );
    await expectRejectedInput(malformedJson, "is not JSON");

    for (const binaryPath of [
      CHARACTER_BETA_STATS_PATH,
      WEAPON_BETA_STATS_PATH,
    ]) {
      const tampered = fixture();
      tampered.sourceFiles = tampered.sourceFiles.map((entry) => {
        if (entry.path !== binaryPath) return entry;
        const bytes = Buffer.from(entry.bytesBase64, "base64");
        bytes[Math.max(0, bytes.length - 1)] ^= 0xff;
        return { ...entry, bytesBase64: bytes.toString("base64") };
      });
      await expectRejectedInput(tampered, binaryPath);
    }
  }, 60_000);

  it("rejects a parity-valid forged checkpoint-48 report through fresh upstream authentication", async () => {
    const forged = fixture();
    const upstream = structuredClone(
      forged.unitExpandedDurableReportInput,
    ) as XiaoFfxxUnitExpandedExecutionGateReport;
    Reflect.set(upstream.summary, "winnerCount", 1);
    replaceJsonInput(
      forged,
      "unitExpandedDurableReportInput",
      UNIT_EXPANDED_GATE_REPORT_PATH,
      upstream,
    );
    await expectRejectedInput(forged, "Checkpoint-48");
  }, 60_000);

  it("rejects serialized diagnostic tampering", async () => {
    const forged = structuredClone(durableReport);
    Reflect.set(forged.summary, "sourceOrderCounterexamplePairCount", 0);
    expect(
      await authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic(
        forged,
        fixture(),
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  }, 60_000);
});

async function loadFixture(): Promise<BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput> {
  const parsedEntries = await Promise.all(
    JSON_INPUTS.map(async ([key, relativePath]) => [
      key,
      await readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ]),
  );
  const [sourceFiles, generatedFrom] = await Promise.all([
    Promise.all(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          bytesBase64: (
            await readFile(path.join(REPOSITORY_ROOT, relativePath))
          ).toString("base64"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  return {
    ...(Object.fromEntries(parsedEntries) as Omit<
      BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
      "sourceFiles" | "generatedFrom"
    >),
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput {
  return structuredClone(baseInput);
}

async function expectRejectedInput(
  input: BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
  expectedMessage: string,
): Promise<void> {
  const authentication =
    await authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic(
      durableReport,
      input,
    );
  expect(authentication).toMatchObject({
    authenticated: false,
    reason: "canonical-inputs-rejected",
  });
  if (authentication.authenticated) {
    throw new Error("Expected rejected five-star source-group diagnostic input.");
  }
  expect(authentication.issues.map(({ message }) => message).join(" ")).toContain(
    expectedMessage,
  );
}

function replaceJsonInput(
  input: BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
  key: "unitExpandedDurableReportInput",
  relativePath: string,
  value: unknown,
): void {
  const text = stableJson(value);
  input[key] = value;
  input.sourceFiles = input.sourceFiles.map((entry) =>
    entry.path === relativePath
      ? { ...entry, bytesBase64: Buffer.from(text).toString("base64") }
      : entry,
  );
  input.generatedFrom = input.generatedFrom.map((entry) =>
    entry.path === relativePath
      ? { ...entry, sha256: sha256Text(text) }
      : entry,
  );
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Value(value: unknown): string {
  return sha256Text(stableJson(value));
}
