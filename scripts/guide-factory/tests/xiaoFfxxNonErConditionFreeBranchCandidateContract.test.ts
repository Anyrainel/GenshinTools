import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";
import {
  authenticateXiaoFfxxNonErConditionFreeBranchCandidateContract,
  buildXiaoFfxxNonErConditionFreeBranchCandidateContractReport,
  requireComparableXiaoFfxxNonErConditionFreeBranchCandidateContract,
  XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
  XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_REPORT_PATH,
  XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_SOURCE_FILE_PATHS,
  type BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput,
  type XiaoFfxxNonErConditionFreeBranchCandidate,
  type XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
  type XiaoFfxxNonErConditionFreeBranchGroup,
} from "../src/xiaoFfxxNonErConditionFreeBranchCandidateContract";
import type { XiaoNonErEquipmentBranchSourceSliceReport } from "../src/xiaoNonErEquipmentBranchSourceSlice";

const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const XIAO_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const MANUAL_INDEX_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const XIAO_SOURCE_LOCAL_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-source-local-condition-slice.json";
const APPLICABLE_CLAIM_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-applicable-claim-projection-contract.json";
const PARTIAL_CANDIDATE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-partial-artifact-candidate-contract.json";
const BRANCH_SOURCE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-non-er-equipment-branch-source-slice.json";
const PATHS_RELATIVE_PATH = "scripts/guide-factory/src/paths.ts";

const FIVE_STAR_SOURCE_ID = "xiao-five-star-weapon-tiers-version-5-5";
const FOUR_STAR_SOURCE_ID = "xiao-unranked-four-star-weapons-version-5-5";
const STATS_SOURCE_ID = "xiao-offensive-artifact-stats-version-5-5";

const occurrenceId = (sourceRecordId: string, itemPath: string) =>
  `kqm:character_guide:${sourceRecordId}:recommendation.${itemPath}.conditions`;

const FIVE_STAR_0 = occurrenceId(
  FIVE_STAR_SOURCE_ID,
  "weaponRecommendations[0]",
);
const FIVE_STAR_1 = occurrenceId(
  FIVE_STAR_SOURCE_ID,
  "weaponRecommendations[1]",
);
const FIVE_STAR_2 = occurrenceId(
  FIVE_STAR_SOURCE_ID,
  "weaponRecommendations[2]",
);
const FOUR_STAR_0 = occurrenceId(
  FOUR_STAR_SOURCE_ID,
  "weaponRecommendations[0]",
);
const FOUR_STAR_1 = occurrenceId(
  FOUR_STAR_SOURCE_ID,
  "weaponRecommendations[1]",
);
const FOUR_STAR_2 = occurrenceId(
  FOUR_STAR_SOURCE_ID,
  "weaponRecommendations[2]",
);
const FOUR_STAR_3 = occurrenceId(
  FOUR_STAR_SOURCE_ID,
  "weaponRecommendations[3]",
);
const FOUR_STAR_4 = occurrenceId(
  FOUR_STAR_SOURCE_ID,
  "weaponRecommendations[4]",
);
const FOUR_STAR_5 = occurrenceId(
  FOUR_STAR_SOURCE_ID,
  "weaponRecommendations[5]",
);
const SANDS = occurrenceId(STATS_SOURCE_ID, "mainStats.sands[0]");
const CIRCLET = occurrenceId(STATS_SOURCE_ID, "mainStats.circlet[0]");
const SUBSTAT_0 = occurrenceId(STATS_SOURCE_ID, "substats[0]");
const SUBSTAT_1 = occurrenceId(STATS_SOURCE_ID, "substats[1]");

const ADMITTED_OCCURRENCE_IDS = [
  FIVE_STAR_0,
  FIVE_STAR_1,
  FOUR_STAR_1,
  SANDS,
];
const GUARDED_OCCURRENCE_IDS = [
  FIVE_STAR_2,
  FOUR_STAR_0,
  FOUR_STAR_2,
  FOUR_STAR_3,
  FOUR_STAR_4,
  FOUR_STAR_5,
  CIRCLET,
  SUBSTAT_0,
  SUBSTAT_1,
];
const CANDIDATE_WEAPONS = [
  "primordial_jade_wingedspear",
  "staff_of_homa",
  "lumidouce_elegy",
  "vortex_vanquisher",
  "calamity_queller",
  "deathmatch",
];
const GUARDED_WEAPONS = [
  "staff_of_the_scarlet_sands",
  "engulfing_lightning",
  "skyward_spine",
  "lithic_spear",
  "prospectors_drill",
  "blackcliff_pole",
  "favonius_lance",
  "missive_windspear",
];

type JsonInputKey =
  | "repositoryInput"
  | "manualSnapshotInput"
  | "manualIndexInput"
  | "sourceRegistryInput"
  | "xiaoSourceLocalDurableReportInput"
  | "applicableClaimDurableReportInput"
  | "partialCandidateDurableReportInput"
  | "branchSourceDurableReportInput";

const JSON_INPUT_CASES: ReadonlyArray<{
  key: JsonInputKey;
  path: string;
}> = [
  { key: "repositoryInput", path: REPOSITORY_RELATIVE_PATH },
  { key: "manualSnapshotInput", path: XIAO_SNAPSHOT_RELATIVE_PATH },
  { key: "manualIndexInput", path: MANUAL_INDEX_RELATIVE_PATH },
  { key: "sourceRegistryInput", path: SOURCE_REGISTRY_RELATIVE_PATH },
  {
    key: "xiaoSourceLocalDurableReportInput",
    path: XIAO_SOURCE_LOCAL_REPORT_RELATIVE_PATH,
  },
  {
    key: "applicableClaimDurableReportInput",
    path: APPLICABLE_CLAIM_REPORT_RELATIVE_PATH,
  },
  {
    key: "partialCandidateDurableReportInput",
    path: PARTIAL_CANDIDATE_REPORT_RELATIVE_PATH,
  },
  {
    key: "branchSourceDurableReportInput",
    path: BRANCH_SOURCE_REPORT_RELATIVE_PATH,
  },
];

let baseInput: BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput;
let durableReport: XiaoFfxxNonErConditionFreeBranchCandidateContractReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadFixture(),
    readJson(
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_REPORT_PATH,
    ) as Promise<XiaoFfxxNonErConditionFreeBranchCandidateContractReport>,
  ]);
});

describe("Xiao FFXX non-ER condition-free branch candidate contract", () => {
  it("rebuilds deterministically and authenticates the durable 27/27 and eight-JSON closure", () => {
    const first = canonicalReport();
    const second =
      buildXiaoFfxxNonErConditionFreeBranchCandidateContractReport(fixture());

    expect(stableJson(second)).toBe(stableJson(first));
    expect(stableJson(first)).toBe(stableJson(durableReport));
    expect(
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
    ).toHaveLength(27);
    expect(
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_SOURCE_FILE_PATHS,
    ).toHaveLength(27);
    expect(
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
    ).toContain(PATHS_RELATIVE_PATH);
    expect(first.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      jsonInputByteAndParsedObjectParity: true,
      sourceFileCount: 27,
      generatedFromCount: 27,
      jsonInputCount: 8,
    });
    expect(
      authenticateXiaoFfxxNonErConditionFreeBranchCandidateContract(
        durableReport,
        fixture(),
      ),
    ).toMatchObject({ authenticated: true });
    expect(() =>
      requireComparableXiaoFfxxNonErConditionFreeBranchCandidateContract(
        durableReport,
        fixture(),
      ),
    ).not.toThrow();
  });

  it("fresh-authenticates both upstream contracts before consuming their canonical reports", () => {
    const report = canonicalReport();

    expect(report.partialCandidateUpstreamBoundary).toMatchObject({
      status: "accepted",
      freshlyAuthenticated: true,
      upstreamInputCount: 20,
      partialCandidateCount: 1,
      basePresentAxisCount: 2,
      baseMissingAxisCount: 4,
      baseViewBindingCount: 2,
    });
    expect(report.branchSourceUpstreamBoundary).toMatchObject({
      status: "accepted",
      freshlyAuthenticated: true,
      sourceObservationCount: 13,
      conditionFreeOccurrenceCount: 4,
      guardedOccurrenceCount: 9,
      conditionFreeWeaponGroupCount: 3,
      conditionFreeWeaponLeafCount: 6,
    });
    expect(
      report.partialCandidateUpstreamBoundary.durableReportFileSha256,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(
      report.partialCandidateUpstreamBoundary
        .durableReportCanonicalObjectSha256,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(report.branchSourceUpstreamBoundary.durableReportFileSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(
      report.branchSourceUpstreamBoundary.durableReportCanonicalObjectSha256,
    ).toMatch(/^[a-f0-9]{64}$/);
  });

  it("enumerates exactly 1 x 6 x 1 = 6 candidates, three groups, and twelve view bindings", () => {
    const report = canonicalReport();

    expect(report.enumerationBoundary).toEqual({
      basePartialCandidateCount: 1,
      admittedWeaponLeafCount: 6,
      sandsSingletonCount: 1,
      theoreticalCartesianCandidateCount: 6,
      enumeratedCandidateCount: 6,
      deduplicatedCandidateCount: 0,
      exactCardinalityEquation: "1 x 6 x 1 = 6",
    });
    expect(report.candidates.map(({ weaponId }) => weaponId)).toEqual(
      CANDIDATE_WEAPONS,
    );
    expect(new Set(report.candidates.map(({ candidateId }) => candidateId))).toHaveLength(
      6,
    );
    expect(
      new Set(report.candidates.map(({ candidateIdentitySha256 }) =>
        candidateIdentitySha256,
      )),
    ).toHaveLength(6);
    expect([
      ...report.rankedFiveStarBranchGroups,
      ...report.unrankedFourStarBranchGroups,
    ]).toHaveLength(3);
    expect(
      report.candidates.flatMap(({ baseViewEvidence }) => baseViewEvidence),
    ).toHaveLength(12);
    expect(report.summary).toMatchObject({
      branchGroupCount: 3,
      rankedFiveStarBranchGroupCount: 2,
      unrankedFourStarBranchGroupCount: 1,
      partialCandidateCount: 6,
      provenanceBindingCount: 12,
      uniqueWeaponCount: 6,
    });
  });

  it("keeps four exact present axes and two guarded missing axes on every candidate", () => {
    const report = canonicalReport();

    expect(report.singletonAxes).toMatchObject({
      artifactSet: {
        axisId: "artifact-set",
        ordinal: 1,
        status: "present-authenticated-singleton",
        normalizedValues: [{ type: "4pc", setId: "marechaussee_hunter" }],
      },
      sands: {
        axisId: "main-stat:sands",
        ordinal: 2,
        status: "present-authenticated-singleton",
        normalizedValues: [{ slot: "sands", statId: "atk%" }],
        sourceOccurrenceIds: [SANDS],
      },
      goblet: {
        axisId: "main-stat:goblet",
        ordinal: 3,
        status: "present-authenticated-singleton",
        normalizedValues: [{ slot: "goblet", statId: "anemo%" }],
      },
    });
    expect(report.missingAxes).toEqual({
      circlet: expect.objectContaining({
        axisId: "main-stat:circlet",
        ordinal: 4,
        status: "missing-guarded-choice-not-evaluated",
        reason: "candidate-stat-dependent-selection-not-executed",
        sourceOccurrenceIds: [CIRCLET],
        guardedValues: ["cr", "cd"],
      }),
      substats: expect.objectContaining({
        axisId: "substats",
        ordinal: 5,
        status: "missing-guarded-incomplete-offensive-tail",
        reason: "leading-er-term-deferred-offensive-tail-not-complete",
        sourceOccurrenceIds: [SUBSTAT_0, SUBSTAT_1],
        guardedValues: ["cr", "cd", "atk%"],
      }),
    });
    for (const candidate of report.candidates) {
      expect(candidate.presentAxisIds).toEqual([
        "weapon",
        "artifact-set",
        "main-stat:sands",
        "main-stat:goblet",
      ]);
      expect(candidate.missingAxisIds).toEqual([
        "main-stat:circlet",
        "substats",
      ]);
      expect(candidate.axes.map(({ axisId, ordinal }) => ({ axisId, ordinal }))).toEqual([
        { axisId: "weapon", ordinal: 0 },
        { axisId: "artifact-set", ordinal: 1 },
        { axisId: "main-stat:sands", ordinal: 2 },
        { axisId: "main-stat:goblet", ordinal: 3 },
        { axisId: "main-stat:circlet", ordinal: 4 },
        { axisId: "substats", ordinal: 5 },
      ]);
      expect(candidate.completeness).toEqual({
        axisCount: 6,
        presentAxisCount: 4,
        missingAxisCount: 2,
        complete: false,
        energyRecoveryPolicy: "excluded-deferred-not-a-completeness-axis",
      });
      expect(candidate).toMatchObject({
        branchAdmissionConditionStatus:
          "weapon-and-sands-source-condition-free",
        inheritedBasePayloadConditionStatus:
          "team-conditioned-view-provenance-preserved",
        allPresentAxesSourceConditionFree: false,
      });
    }
  });

  it("preserves two ranked tied five-star groups while Deathmatch remains unranked and cross-rarity-incomparable", () => {
    const report = canonicalReport();

    expect(report.rankingBoundary).toEqual({
      fiveStarOrdering: "ranked-groups",
      fiveStarMembersWithinGroup: "tied",
      admittedFiveStarRankGroups: [1, 2],
      fourStarOrdering: "unranked",
      crossRarityOrdering: "not-defined",
      flatCandidateSerializationOrderIsRank: false,
      guideFactoryDerivedRankCount: 0,
    });
    expect(
      report.rankedFiveStarBranchGroups.map(projectGroupSemantics),
    ).toEqual([
      {
        sourceRankGroup: 1,
        sourceOrdering: "ranked-groups",
        membersTied: true,
        crossRarityOrdering: "not-defined",
        weaponIds: CANDIDATE_WEAPONS.slice(0, 3),
      },
      {
        sourceRankGroup: 2,
        sourceOrdering: "ranked-groups",
        membersTied: true,
        crossRarityOrdering: "not-defined",
        weaponIds: CANDIDATE_WEAPONS.slice(3, 5),
      },
    ]);
    expect(report.unrankedFourStarBranchGroups.map(projectGroupSemantics)).toEqual([
      {
        sourceRankGroup: null,
        sourceOrdering: "unranked",
        membersTied: false,
        crossRarityOrdering: "not-defined",
        weaponIds: ["deathmatch"],
      },
    ]);
    const deathmatch = requiredCandidate(report, "deathmatch");
    expect(deathmatch).toMatchObject({
      rarityClass: "four-star",
      sourceRankGroup: null,
      tiedWithinSourceGroup: false,
      fourStarOrdering: "unranked",
      factoryRank: null,
      crossRarityRank: null,
      flatSerializationOrderIsRank: false,
    });
    expect(
      report.candidates.every(
        ({ factoryRank, crossRarityRank, flatSerializationOrderIsRank }) =>
          factoryRank == null &&
          crossRarityRank == null &&
          !flatSerializationOrderIsRank,
      ),
    ).toBe(true);
  });

  it("excludes source rank and request facts from technical identity while retaining them in provenance and group hashes", () => {
    const report = canonicalReport();
    const candidate = requiredCandidate(report, "primordial_jade_wingedspear");
    const group = report.rankedFiveStarBranchGroups[0]!;

    expect(report.identityBoundary).toMatchObject({
      requestFactExcludedFromCandidateIdentity: true,
      sourceRankExcludedFromTechnicalIdentity: true,
    });
    expect(candidate.baseViewEvidence).toEqual([
      expect.objectContaining({
        viewId: "source-only-ffxx",
        requestFactCount: 0,
        inheritedWithoutChangingTechnicalCandidate: true,
      }),
      expect.objectContaining({
        viewId: "exact-ffxx-plus-wrapper-c6",
        requestFactCount: 1,
        inheritedWithoutChangingTechnicalCandidate: true,
      }),
    ]);
    expect(candidate.technicalCombinationSha256).toBe(
      hashValue(technicalProjection(candidate, report)),
    );
    expect(candidate.candidateIdentitySha256).toBe(
      hashValue(identityProjection(candidate, report)),
    );
    expect(candidate.candidateProvenanceSha256).toBe(
      hashValue(provenanceProjection(candidate, group)),
    );
    const { branchGroupSha256: _branchGroupSha256, ...branchGroupProjection } =
      group;
    expect(group.branchGroupSha256).toBe(hashValue(branchGroupProjection));

    const provenanceDrift = structuredClone(candidate);
    provenanceDrift.sourceRankGroup = 99;
    provenanceDrift.baseViewEvidence[1]!.requestFactCount = 0;
    expect(hashValue(technicalProjection(provenanceDrift, report))).toBe(
      candidate.technicalCombinationSha256,
    );
    expect(hashValue(identityProjection(provenanceDrift, report))).toBe(
      candidate.candidateIdentitySha256,
    );
    expect(hashValue(provenanceProjection(provenanceDrift, group))).not.toBe(
      candidate.candidateProvenanceSha256,
    );
    expect(
      report.identityBoundary.candidateIdentitySetSha256,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(
      report.identityBoundary.candidateProvenanceSetSha256,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(report.identityBoundary.branchGroupSetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.identityBoundary.aggregateCompositionSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("withholds all nine guarded rows, all eight guarded weapon leaves, Circlet, and substats", () => {
    const report = canonicalReport();
    const branch = baseInput.branchSourceDurableReportInput as XiaoNonErEquipmentBranchSourceSliceReport;
    const guardedWeaponGroups = [
      ...branch.rankedFiveStarGroups,
      ...branch.unrankedFourStarOptions,
    ].filter(
      ({ sourceConditionStatus }) =>
        sourceConditionStatus === "guarded-unresolved",
    );

    expect(report.compositionBoundary.selectedOccurrenceIds).toEqual(
      ADMITTED_OCCURRENCE_IDS,
    );
    expect(report.compositionBoundary.guardedOccurrenceIds).toEqual(
      GUARDED_OCCURRENCE_IDS,
    );
    expect(report.compositionBoundary).toMatchObject({
      newlyAdmittedBranchRowsSourceConditionFreeOnly: true,
      inheritedBasePayloadsSourceConditionFree: false,
      inheritedBasePayloadConditionStatus:
        "team-conditioned-view-provenance-preserved",
      selectedEmptyConditionOccurrenceCount: 4,
      guardedOccurrenceCount: 9,
      guardedRowsConsumedCount: 0,
      conditionTruthEvaluationCount: 0,
      emptyConditionArrayTreatedAsUniversalBest: false,
      repeatedSandsEvidenceEstablishesCorroboration: false,
    });
    expect(guardedWeaponGroups).toHaveLength(6);
    expect(guardedWeaponGroups.flatMap(({ weaponIds }) => weaponIds)).toEqual(
      GUARDED_WEAPONS,
    );
    expect(report.withheldGuardedDomain).toEqual({
      weaponGroupCount: 6,
      weaponLeafCount: 8,
      circletGroupCount: 1,
      circletLeafCount: 2,
      substatPriorityGroupCount: 2,
      substatLeafCount: 3,
      candidateCountFromGuardedRows: 0,
    });
    expect(
      report.candidates.some(({ weaponId }) => GUARDED_WEAPONS.includes(weaponId)),
    ).toBe(false);
    expect(report.missingAxes?.circlet.sourceOccurrenceIds).toEqual([CIRCLET]);
    expect(report.missingAxes?.substats.sourceOccurrenceIds).toEqual([
      SUBSTAT_0,
      SUBSTAT_1,
    ]);
  });

  it("keeps every complete-build, recommendation, selection, compatibility, generator, formula, damage, rotation, ideal-roll, and ER capability at zero", () => {
    const report = canonicalReport();

    expect(report).toMatchObject({
      arbitraryEnglishParsingAllowed: false,
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsBuildRecommendations: false,
      supportsStatRecommendations: false,
      supportsDerivedRankClaims: false,
      supportsCrossRarityRankClaims: false,
      supportsCompatibilityClaims: false,
      supportsDamageClaims: false,
      supportsFormulaClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      sourceConditionEvaluationExecuted: false,
      crossAxisCompositionExecuted: true,
      branchEnumerationExecuted: true,
      boundedCartesianEnumerationExecuted: true,
      partialCandidateGenerationExecuted: true,
      partialCandidateConstructionExecuted: true,
      choiceSelectionExecuted: false,
      payloadCompatibilityEvaluated: false,
      recommendationCompositionExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      formulaInputsUsed: false,
      damageComputationExecuted: false,
      rotationComputationExecuted: false,
      idealRollAllocationExecuted: false,
      energyRecoveryInputsUsed: false,
      energyRecoveryComputationExecuted: false,
      summary: {
        completeCandidateCount: 0,
        assembledBuildCount: 0,
        guideFactoryRecommendationCount: 0,
        sourcePublishedWholeCandidateCount: 0,
        derivedRankCount: 0,
      },
    });
    expect(
      report.candidates.every(
        ({
          completionStatus,
          materializableAsGuideBuildRecommendation,
          runtimeArtifactGenerationCandidate,
          jointPayloadCompatibility,
        }) =>
          completionStatus === "partial" &&
          !materializableAsGuideBuildRecommendation &&
          !runtimeArtifactGenerationCandidate &&
          jointPayloadCompatibility === "not-evaluated",
      ),
    ).toBe(true);
  });

  it("fails closed on exact path, paths.ts bytes, and paths.ts declared-hash drift", () => {
    const missingPath = fixture();
    missingPath.sourceFiles = missingPath.sourceFiles.filter(
      ({ path: sourcePath }) => sourcePath !== PATHS_RELATIVE_PATH,
    );
    expectFailedBuild(missingPath);

    const byteDrift = fixture();
    byteDrift.sourceFiles = byteDrift.sourceFiles.map((entry) =>
      entry.path === PATHS_RELATIVE_PATH
        ? { ...entry, text: `${entry.text}\n` }
        : entry,
    );
    expectFailedBuild(byteDrift);

    const hashDrift = fixture();
    hashDrift.generatedFrom = hashDrift.generatedFrom.map((entry) =>
      entry.path === PATHS_RELATIVE_PATH
        ? { ...entry, sha256: "0".repeat(64) }
        : entry,
    );
    expectFailedBuild(hashDrift);
  });

  it("fails closed when any of the eight parsed JSON inputs disagrees with authenticated bytes", () => {
    for (const { key } of JSON_INPUT_CASES) {
      const input = fixture();
      const value = structuredClone(input[key]) as Record<string, unknown>;
      value.__forged = key;
      input[key] = value;
      expectFailedBuild(input, key);
    }
  });

  it("fails closed on locally rehashed tampering of every durable upstream report", () => {
    const cases: ReadonlyArray<{
      key: JsonInputKey;
      path: string;
      mutate: (value: Record<string, unknown>) => void;
    }> = [
      {
        key: "xiaoSourceLocalDurableReportInput",
        path: XIAO_SOURCE_LOCAL_REPORT_RELATIVE_PATH,
        mutate: (value) => {
          requiredObject(value.summary, "checkpoint-42 summary").selectedOccurrenceCount =
            2;
        },
      },
      {
        key: "applicableClaimDurableReportInput",
        path: APPLICABLE_CLAIM_REPORT_RELATIVE_PATH,
        mutate: (value) => {
          value.candidateCount = 1;
        },
      },
      {
        key: "partialCandidateDurableReportInput",
        path: PARTIAL_CANDIDATE_REPORT_RELATIVE_PATH,
        mutate: (value) => {
          requiredObject(value.summary, "checkpoint-44 summary")
            .uniquePartialTechnicalCandidateCount = 2;
        },
      },
      {
        key: "branchSourceDurableReportInput",
        path: BRANCH_SOURCE_REPORT_RELATIVE_PATH,
        mutate: (value) => {
          requiredObject(value.summary, "checkpoint-45 summary")
            .conditionFreeOccurrenceCount = 3;
        },
      },
    ];

    for (const testCase of cases) {
      const input = fixture();
      const value = structuredClone(input[testCase.key]) as Record<string, unknown>;
      testCase.mutate(value);
      replaceJsonInput(input, testCase.key, testCase.path, value);
      expectFailedBuild(input, testCase.key);
    }
  });

  it("fails closed on admitted/guarded swaps, condition drift, tie membership/order/rank, Deathmatch promotion, and Sands substitution", () => {
    const cases: ReadonlyArray<{
      label: string;
      mutate: (report: XiaoNonErEquipmentBranchSourceSliceReport) => void;
    }> = [
      {
        label: "admitted guarded swap",
        mutate: (report) => {
          report.conditionFreeOccurrenceIds[2] = FIVE_STAR_2;
          report.conditionallyDeferredOccurrenceIds[0] = FOUR_STAR_1;
        },
      },
      {
        label: "empty to nonempty",
        mutate: (report) => {
          const row = report.occurrences.find(
            ({ occurrenceId: id }) => id === FOUR_STAR_1,
          );
          if (!row) throw new Error("Missing Deathmatch occurrence.");
          row.conditions = ["forged condition"];
        },
      },
      {
        label: "tied membership",
        mutate: (report) => {
          report.rankedFiveStarGroups[0]!.weaponIds.pop();
        },
      },
      {
        label: "tied member order",
        mutate: (report) => {
          report.rankedFiveStarGroups[0]!.weaponIds.reverse();
        },
      },
      {
        label: "source rank",
        mutate: (report) => {
          report.rankedFiveStarGroups[0]!.sourceRankGroup = 2;
        },
      },
      {
        label: "Deathmatch promotion",
        mutate: (report) => {
          const deathmatch = report.unrankedFourStarOptions.find(
            ({ occurrenceId: id }) => id === FOUR_STAR_1,
          );
          if (!deathmatch) throw new Error("Missing Deathmatch source group.");
          Reflect.set(deathmatch, "weaponOrdering", "ranked-groups");
          deathmatch.sourcePositionIsRank = true;
          deathmatch.sourceRankGroup = 3;
        },
      },
      {
        label: "Sands substitution",
        mutate: (report) => {
          const sands = report.mainStatChoiceGroups.find(
            ({ slot }) => slot === "sands",
          );
          if (!sands) throw new Error("Missing Sands source group.");
          sands.statIds = ["er%"];
        },
      },
    ];

    for (const testCase of cases) {
      const input = fixture();
      const report = structuredClone(
        input.branchSourceDurableReportInput,
      ) as XiaoNonErEquipmentBranchSourceSliceReport;
      testCase.mutate(report);
      replaceJsonInput(
        input,
        "branchSourceDurableReportInput",
        BRANCH_SOURCE_REPORT_RELATIVE_PATH,
        report,
      );
      expectFailedBuild(input, testCase.label);
    }
  });

  it("rejects serialized missing-axis defaults and candidate, group, provenance, count, and capability tampering", () => {
    const cases: ReadonlyArray<{
      label: string;
      mutate: (
        report: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
      ) => void;
    }> = [
      {
        label: "missing-axis default",
        mutate: (report) => {
          const circlet = report.candidates[0]?.axes.find(
            ({ axisId }) => axisId === "main-stat:circlet",
          );
          if (!circlet) throw new Error("Missing candidate Circlet axis.");
          Reflect.set(circlet, "status", "present-defaulted");
          Reflect.set(circlet, "normalizedValues", [{ statId: "cr" }]);
        },
      },
      {
        label: "candidate",
        mutate: (report) => {
          report.candidates[0]!.weaponId = "forged_weapon";
        },
      },
      {
        label: "group",
        mutate: (report) => {
          report.rankedFiveStarBranchGroups[0]!.weaponIds.reverse();
        },
      },
      {
        label: "provenance",
        mutate: (report) => {
          report.candidates[0]!.candidateProvenanceSha256 = "0".repeat(64);
        },
      },
      {
        label: "count",
        mutate: (report) => {
          report.summary.partialCandidateCount = 5;
        },
      },
      {
        label: "condition scope",
        mutate: (report) => {
          Reflect.set(
            report.candidates[0],
            "allPresentAxesSourceConditionFree",
            true,
          );
          Reflect.set(
            report.compositionBoundary,
            "inheritedBasePayloadsSourceConditionFree",
            true,
          );
        },
      },
      {
        label: "capability",
        mutate: (report) => {
          Reflect.set(report, "supportsGuideClaims", true);
          Reflect.set(report, "choiceSelectionExecuted", true);
        },
      },
    ];

    for (const testCase of cases) {
      const forged = structuredClone(durableReport);
      testCase.mutate(forged);
      expect(
        authenticateXiaoFfxxNonErConditionFreeBranchCandidateContract(
          forged,
          fixture(),
        ),
        testCase.label,
      ).toMatchObject({
        authenticated: false,
        reason: "serialized-report-mismatch",
      });
    }

    const forged = structuredClone(durableReport);
    forged.summary.provenanceBindingCount = 11;
    expect(() =>
      requireComparableXiaoFfxxNonErConditionFreeBranchCandidateContract(
        forged,
        fixture(),
      ),
    ).toThrow("serialized-report-mismatch");
  });
});

async function loadFixture(): Promise<BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput> {
  const xiaoSnapshotPath = path.join(
    SOURCE_SNAPSHOT_ROOT,
    "kqm-xiao-manual.json",
  );
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput,
    partialCandidateDurableReportInput,
    branchSourceDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(xiaoSnapshotPath),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(path.join(REPOSITORY_ROOT, XIAO_SOURCE_LOCAL_REPORT_RELATIVE_PATH)),
    readJson(path.join(REPOSITORY_ROOT, APPLICABLE_CLAIM_REPORT_RELATIVE_PATH)),
    readJson(path.join(REPOSITORY_ROOT, PARTIAL_CANDIDATE_REPORT_RELATIVE_PATH)),
    readJson(path.join(REPOSITORY_ROOT, BRANCH_SOURCE_REPORT_RELATIVE_PATH)),
    Promise.all(
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  return {
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput,
    partialCandidateDurableReportInput,
    branchSourceDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput {
  return structuredClone(baseInput);
}

function canonicalReport(): XiaoFfxxNonErConditionFreeBranchCandidateContractReport {
  const report =
    buildXiaoFfxxNonErConditionFreeBranchCandidateContractReport(fixture());
  if (report.comparisonStatus !== "comparable") {
    throw new Error(
      `Expected comparable Xiao FFXX branch contract: ${report.issues
        .map(({ message }) => message)
        .join("; ")}`,
    );
  }
  return report;
}

function expectFailedBuild(
  input: BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput,
  label?: string,
): void {
  const report =
    buildXiaoFfxxNonErConditionFreeBranchCandidateContractReport(input);
  expect(report, label).toMatchObject({
    comparisonStatus: "not-comparable",
    rawInputBoundary: { status: "rejected" },
    singletonAxes: null,
    missingAxes: null,
    rankedFiveStarBranchGroups: [],
    unrankedFourStarBranchGroups: [],
    candidates: [],
    summary: {
      branchGroupCount: 0,
      partialCandidateCount: 0,
      provenanceBindingCount: 0,
      completeCandidateCount: 0,
      assembledBuildCount: 0,
      guideFactoryRecommendationCount: 0,
    },
  });
  expect(report.issues, label).toHaveLength(1);
}

function replaceJsonInput(
  input: BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput,
  key: JsonInputKey,
  relativePath: string,
  value: unknown,
): void {
  const text = stableJson(value);
  input[key] = value;
  input.sourceFiles = input.sourceFiles.map((entry) =>
    entry.path === relativePath ? { path: entry.path, text } : entry,
  );
  input.generatedFrom = input.generatedFrom.map((entry) =>
    entry.path === relativePath
      ? { path: entry.path, sha256: sha256Text(text) }
      : entry,
  );
}

function requiredCandidate(
  report: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
  weaponId: string,
): XiaoFfxxNonErConditionFreeBranchCandidate {
  const candidate = report.candidates.find(
    ({ weaponId: candidateWeaponId }) => candidateWeaponId === weaponId,
  );
  if (!candidate) throw new Error(`Missing candidate ${weaponId}.`);
  return candidate;
}

function projectGroupSemantics(group: XiaoFfxxNonErConditionFreeBranchGroup) {
  return {
    sourceRankGroup: group.sourceRankGroup,
    sourceOrdering: group.sourceOrdering,
    membersTied: group.membersTied,
    crossRarityOrdering: group.crossRarityOrdering,
    weaponIds: group.weaponIds,
  };
}

function technicalProjection(
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate,
  report: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
) {
  const singletonAxes = requireSingletonAxes(report);
  return {
    teamRecordId: candidate.teamRecordId,
    characterId: candidate.characterId,
    weapon: { weaponId: candidate.weaponId, refinement: "unspecified" },
    artifactSet: singletonAxes.artifactSet.normalizedValues,
    sands: singletonAxes.sands.normalizedValues,
    goblet: singletonAxes.goblet.normalizedValues,
  };
}

function identityProjection(
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate,
  report: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
) {
  const singletonAxes = requireSingletonAxes(report);
  const missingAxes = requireMissingAxes(report);
  return {
    contractId: report.contractId,
    candidateId: candidate.candidateId,
    teamRecordId: candidate.teamRecordId,
    characterId: candidate.characterId,
    basePartialCandidateIdentitySha256:
      candidate.basePartialCandidateIdentitySha256,
    technicalCombinationSha256: candidate.technicalCombinationSha256,
    technicalAxes: {
      weapon: { weaponId: candidate.weaponId, refinement: "unspecified" },
      artifactSet: singletonAxes.artifactSet.normalizedValues,
      sands: singletonAxes.sands.normalizedValues,
      goblet: singletonAxes.goblet.normalizedValues,
    },
    missingAxisPolicy: {
      circlet: {
        status: missingAxes.circlet.status,
        reason: missingAxes.circlet.reason,
      },
      substats: {
        status: missingAxes.substats.status,
        reason: missingAxes.substats.reason,
      },
    },
    energyRecoveryPolicy: "excluded-deferred-not-a-completeness-axis",
  };
}

function provenanceProjection(
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate,
  group: XiaoFfxxNonErConditionFreeBranchGroup,
) {
  return {
    candidateId: candidate.candidateId,
    candidateIdentitySha256: candidate.candidateIdentitySha256,
    baseViewEvidence: candidate.baseViewEvidence,
    weaponSourceGroup: {
      occurrenceId: candidate.weaponEvidence.occurrenceId,
      sourceGroupSha256: candidate.weaponEvidence.sourceGroupSha256,
      rarityClass: candidate.rarityClass,
      sourceRankGroup: candidate.sourceRankGroup,
      grouping: group.membersTied ? "tied" : "single",
      sourceClassification: candidate.weaponSourceClassification,
    },
    sandsSourceGroup: {
      occurrenceId: candidate.sandsEvidence.occurrenceId,
      sourceGroupSha256: candidate.sandsEvidence.sourceGroupSha256,
    },
  };
}

function requireSingletonAxes(
  report: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
) {
  if (!report.singletonAxes) throw new Error("Missing singleton axes.");
  return report.singletonAxes;
}

function requireMissingAxes(
  report: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
) {
  if (!report.missingAxes) throw new Error("Missing guarded missing axes.");
  return report.missingAxes;
}

function requiredObject(value: unknown, label: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Missing ${label}.`);
  }
  return value as Record<string, unknown>;
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}
