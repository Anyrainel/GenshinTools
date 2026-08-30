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
  authenticateXiaoNonErEquipmentBranchSourceSliceReport,
  buildXiaoNonErEquipmentBranchSourceSliceReport,
  requireComparableXiaoNonErEquipmentBranchSourceSliceReport,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_REPORT_PATH,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS,
  type BuildXiaoNonErEquipmentBranchSourceSliceInput,
  type XiaoNonErEquipmentBranchSourceSliceReport,
} from "../src/xiaoNonErEquipmentBranchSourceSlice";
import type { XiaoSourceLocalConditionSliceReport } from "../src/xiaoSourceLocalConditionSlice";

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
const CORE_PATH =
  "scripts/guide-factory/src/xiaoNonErEquipmentBranchSourceSlice.ts";
const CLI_PATH =
  "scripts/guide-factory/src/assemble-xiao-non-er-equipment-branch-source-slice.ts";
const PATHS_PATH = "scripts/guide-factory/src/paths.ts";
const XIAO_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-manual.json",
);

const FIVE_STAR_SOURCE_ID = "xiao-five-star-weapon-tiers-version-5-5";
const FOUR_STAR_SOURCE_ID = "xiao-unranked-four-star-weapons-version-5-5";
const STATS_SOURCE_ID = "xiao-offensive-artifact-stats-version-5-5";
const FIVE_STAR_REPOSITORY_ID =
  "kqm:character-guide:xiao-five-star-weapon-tiers-version-5-5";
const FOUR_STAR_REPOSITORY_ID =
  "kqm:character-guide:xiao-unranked-four-star-weapons-version-5-5";
const STATS_REPOSITORY_ID =
  "kqm:character-guide:xiao-offensive-artifact-stats-version-5-5";

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
const CONDITION_FREE_IDS = [FIVE_STAR_0, FIVE_STAR_1, FOUR_STAR_1, SANDS];

let baseInput: BuildXiaoNonErEquipmentBranchSourceSliceInput;
let durableReport: XiaoNonErEquipmentBranchSourceSliceReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadFixture(),
    readJson(
      XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_REPORT_PATH,
    ) as Promise<XiaoNonErEquipmentBranchSourceSliceReport>,
  ]);
});

describe("Xiao non-ER equipment branch source slice", () => {
  it("rebuilds deterministically and authenticates the durable 18/18 and five-JSON boundary", () => {
    const first = canonicalReport();
    const second = buildXiaoNonErEquipmentBranchSourceSliceReport(fixture());

    expect(stableJson(second)).toBe(stableJson(first));
    expect(stableJson(first)).toBe(stableJson(durableReport));
    expect(XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS).toHaveLength(
      18,
    );
    expect(
      XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS,
    ).toHaveLength(18);
    expect(first.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      jsonInputByteAndParsedObjectParity: true,
      sourceFileCount: 18,
      generatedFromCount: 18,
      jsonInputCount: 5,
    });
    expect(first.upstreamBoundary).toMatchObject({
      status: "accepted",
      freshlyAuthenticated: true,
      upstreamInputCount: 11,
      selectedOccurrenceCount: 3,
      holdoutOccurrenceCount: 14,
      emptyOccurrenceCount: 4,
      projectedHoldoutOccurrenceCount: 9,
      projectedEmptyOccurrenceCount: 4,
      conditionBindingsAddedToCheckpoint42: 0,
    });
    expect(
      authenticateXiaoNonErEquipmentBranchSourceSliceReport(
        durableReport,
        fixture(),
      ),
    ).toMatchObject({ authenticated: true });
    expect(() =>
      requireComparableXiaoNonErEquipmentBranchSourceSliceReport(
        durableReport,
        fixture(),
      ),
    ).not.toThrow();
  });

  it("pins the exact 13 / 4 / 9 / 8 source-observation counts", () => {
    const report = canonicalReport();

    expect(report.occurrences).toHaveLength(13);
    expect(report.conditionFreeOccurrenceIds).toEqual(CONDITION_FREE_IDS);
    expect(report.conditionallyDeferredOccurrenceIds).toHaveLength(9);
    expect(report.summary).toMatchObject({
      sourceRecordCount: 3,
      occurrenceCount: 13,
      conditionFreeOccurrenceCount: 4,
      conditionallyDeferredOccurrenceCount: 9,
      uniqueNonemptyConditionArrayCount: 8,
      weaponGroupCount: 9,
      uniqueWeaponCount: 14,
      rankedFiveStarGroupCount: 3,
      rankedFiveStarWeaponCount: 8,
      unrankedFourStarOptionCount: 6,
      unrankedFourStarWeaponCount: 6,
      conditionFreeWeaponGroupCount: 3,
      conditionFreeWeaponLeafCount: 6,
      guardedWeaponGroupCount: 6,
      guardedWeaponLeafCount: 8,
      mainStatChoiceGroupCount: 2,
      mainStatLeafCount: 3,
      substatPriorityGroupCount: 2,
      substatLeafCount: 3,
      sourceRecommendationObservationCount: 13,
    });
    expect(
      report.occurrences.filter(
        ({ sourceConditionStatus }) =>
          sourceConditionStatus === "source-condition-free",
      ),
    ).toHaveLength(4);
    expect(
      report.occurrences.filter(
        ({ sourceConditionStatus }) =>
          sourceConditionStatus === "guarded-unresolved",
      ),
    ).toHaveLength(9);
  });

  it("preserves exact five-star rank groups, ties, membership, and source order", () => {
    const report = canonicalReport();

    expect(report.rankingBoundary).toEqual({
      fiveStarOrdering: "ranked-groups",
      fiveStarMembersWithinGroup: "tied",
      fourStarOrdering: "unranked",
      fourStarSourcePositionsAreRanks: false,
      crossRarityOrdering: "not-defined",
      sourceRankedFiveStarGroupCount: 3,
      guideFactoryDerivedRankCount: 0,
    });
    expect(
      report.rankedFiveStarGroups.map(
        ({
          occurrenceId: id,
          sourcePosition,
          sourcePositionIsRank,
          sourceRankGroup,
          grouping,
          classification,
          weaponIds,
        }) => ({
          id,
          sourcePosition,
          sourcePositionIsRank,
          sourceRankGroup,
          grouping,
          classification,
          weaponIds,
        }),
      ),
    ).toEqual([
      {
        id: FIVE_STAR_0,
        sourcePosition: 0,
        sourcePositionIsRank: true,
        sourceRankGroup: 1,
        grouping: "tied",
        classification: "default",
        weaponIds: [
          "primordial_jade_wingedspear",
          "staff_of_homa",
          "lumidouce_elegy",
        ],
      },
      {
        id: FIVE_STAR_1,
        sourcePosition: 1,
        sourcePositionIsRank: true,
        sourceRankGroup: 2,
        grouping: "tied",
        classification: "alternative",
        weaponIds: ["vortex_vanquisher", "calamity_queller"],
      },
      {
        id: FIVE_STAR_2,
        sourcePosition: 2,
        sourcePositionIsRank: true,
        sourceRankGroup: 3,
        grouping: "tied",
        classification: "available-only",
        weaponIds: [
          "staff_of_the_scarlet_sands",
          "engulfing_lightning",
          "skyward_spine",
        ],
      },
    ]);
  });

  it("keeps every four-star option unranked and defines no cross-rarity order", () => {
    const report = canonicalReport();
    const groups = report.unrankedFourStarOptions;

    expect(groups.map(({ occurrenceId: id }) => id)).toEqual([
      FOUR_STAR_0,
      FOUR_STAR_1,
      FOUR_STAR_2,
      FOUR_STAR_3,
      FOUR_STAR_4,
      FOUR_STAR_5,
    ]);
    expect(groups.map(({ weaponIds }) => weaponIds)).toEqual([
      ["lithic_spear"],
      ["deathmatch"],
      ["prospectors_drill"],
      ["blackcliff_pole"],
      ["favonius_lance"],
      ["missive_windspear"],
    ]);
    for (const [sourcePosition, group] of groups.entries()) {
      expect(group).toMatchObject({
        rarityClass: "four-star",
        weaponOrdering: "unranked",
        sourcePosition,
        sourcePositionIsRank: false,
        sourceRankGroup: null,
        grouping: "single",
      });
    }
    expect(report.supportsCrossRarityRankClaims).toBe(false);
    expect(report.rankingBoundary.crossRarityOrdering).toBe("not-defined");
    expect(report.summary.derivedRankCount).toBe(0);
  });

  it("preserves guarded classifications and conditions without evaluating applicability", () => {
    const report = canonicalReport();
    const guardedWeapons = [
      ...report.rankedFiveStarGroups,
      ...report.unrankedFourStarOptions,
    ].filter(
      ({ sourceConditionStatus }) =>
        sourceConditionStatus === "guarded-unresolved",
    );

    expect(
      guardedWeapons.map(
        ({
          occurrenceId: id,
          classification,
          conditionRole,
          conditions,
        }) => ({ id, classification, conditionRole, conditionCount: conditions.length }),
      ),
    ).toEqual([
      {
        id: FIVE_STAR_2,
        classification: "available-only",
        conditionRole: "owned-best-available-pull-policy",
        conditionCount: 1,
      },
      {
        id: FOUR_STAR_0,
        classification: "conditional",
        conditionRole: "team-composition-and-refinement",
        conditionCount: 1,
      },
      {
        id: FOUR_STAR_2,
        classification: "conditional",
        conditionRole: "healing-and-rotation-timing",
        conditionCount: 1,
      },
      {
        id: FOUR_STAR_3,
        classification: "conditional",
        conditionRole: "enemy-defeat-and-scenario",
        conditionCount: 1,
      },
      {
        id: FOUR_STAR_4,
        classification: "conditional",
        conditionRole: "refinement-floor-energy-effect-deferred",
        conditionCount: 1,
      },
      {
        id: FOUR_STAR_5,
        classification: "conditional",
        conditionRole: "swirl-and-rotation-uptime",
        conditionCount: 1,
      },
    ]);
    expect(
      report.occurrences.every(
        ({
          projectedAsSourceObservationOnly,
          conditionTruthEvaluated,
          conditionBindingAuthoredByThisSlice,
          energyRecoveryValueProjected,
        }) =>
          projectedAsSourceObservationOnly &&
          !conditionTruthEvaluated &&
          !conditionBindingAuthoredByThisSlice &&
          !energyRecoveryValueProjected,
      ),
    ).toBe(true);
  });

  it("normalizes only the exact Favonius R3 guard and keeps its energy effect deferred", () => {
    const report = canonicalReport();
    const favonius = report.unrankedFourStarOptions.find(
      ({ occurrenceId: id }) => id === FOUR_STAR_4,
    );

    expect(favonius).toMatchObject({
      weaponIds: ["favonius_lance"],
      conditionRole: "refinement-floor-energy-effect-deferred",
      sourceConditionStatus: "guarded-unresolved",
      normalizedGuard: {
        type: "refinement-at-least",
        weaponId: "favonius_lance",
        refinement: 3,
        satisfaction: "not-evaluated",
        energyEffect: "deferred",
      },
    });
    expect(
      [
        ...report.rankedFiveStarGroups,
        ...report.unrankedFourStarOptions,
      ].filter(({ normalizedGuard }) => normalizedGuard != null),
    ).toHaveLength(1);
    expect(report.completenessBoundary.energyRecovery).toBe(
      "excluded-deferred",
    );
    expect(report.supportsEnergyRecoveryClaims).toBe(false);
    expect(report.energyRecoveryComputationExecuted).toBe(false);
  });

  it("retains unconditional ATK Sands and guarded unresolved CRIT Circlet semantics", () => {
    const report = canonicalReport();

    expect(report.mainStatChoiceGroups).toEqual([
      expect.objectContaining({
        occurrenceId: SANDS,
        slot: "sands",
        statIds: ["atk%"],
        sourcePosition: 0,
        sourceConditionStatus: "source-condition-free",
        conditionRole: "none",
        selectionExecuted: false,
      }),
      expect.objectContaining({
        occurrenceId: CIRCLET,
        slot: "circlet",
        statIds: ["cr", "cd"],
        sourcePosition: 0,
        sourceConditionStatus: "guarded-unresolved",
        conditionRole: "candidate-stat-dependent-circlet-selection",
        selectionExecuted: false,
      }),
    ]);
    expect(report.completenessBoundary).toMatchObject({
      representedAxes: [
        "weapon",
        "main-stat:sands",
        "main-stat:circlet",
        "substats",
      ],
      missingAxes: ["artifact-set", "main-stat:goblet"],
      missingAxisPolicy: "outside-this-source-slice-no-default",
      circletSelection: "guarded-not-executed",
    });
  });

  it("preserves the shared deferred-ER substat guard, distinct priorities, and target", () => {
    const report = canonicalReport();
    const [first, second] = report.guardedOffensiveTailPriorities;

    expect(first).toEqual(
      expect.objectContaining({
        occurrenceId: SUBSTAT_0,
        priority: 1,
        statIds: ["cr", "cd"],
        target:
          "At least 70% CRIT Rate, then further CRIT Rate and CRIT DMG balanced near a 1:2 ratio.",
        conditionsSha256:
          "668aeb631eaed5ff8f7a7a0e4547e7d428eb8b53aabaaa6b17ae1d450f9a9210",
        sharesGuardWithOccurrenceIds: [SUBSTAT_1],
        sourceConditionStatus: "guarded-unresolved",
        conditionRole: "incomplete-offensive-tail-after-deferred-er",
        completePriorityPlan: false,
      }),
    );
    expect(second).toEqual(
      expect.objectContaining({
        occurrenceId: SUBSTAT_1,
        priority: 2,
        statIds: ["atk%"],
        target: null,
        conditionsSha256: first?.conditionsSha256,
        sharesGuardWithOccurrenceIds: [SUBSTAT_0],
        sourceConditionStatus: "guarded-unresolved",
        conditionRole: "incomplete-offensive-tail-after-deferred-er",
        completePriorityPlan: false,
      }),
    );
    expect(report.completenessBoundary.substatPlan).toBe(
      "guarded-incomplete-offensive-tail",
    );
  });

  it("keeps every guide, rank, candidate, computation, and ER capability at zero", () => {
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
      supportsDamageClaims: false,
      supportsFormulaClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      applicabilityEvaluationExecuted: false,
      crossRecordCompositionExecuted: false,
      candidateGenerationExecuted: false,
      choiceSelectionExecuted: false,
      compatibilityEvaluationExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      rotationComputationExecuted: false,
      idealRollAllocationExecuted: false,
      energyRecoveryComputationExecuted: false,
      summary: {
        candidateCount: 0,
        completeBuildCount: 0,
        sourceRecommendationObservationCount: 13,
        guideFactoryRecommendationCount: 0,
        derivedRankCount: 0,
      },
    });
  });

  it("fails closed on source-file path, byte, declared-hash, and five parsed-JSON drift", () => {
    const missingPath = fixture();
    missingPath.sourceFiles = missingPath.sourceFiles.slice(1);
    expectFailedBuild(missingPath);

    for (const sourcePath of [
      XIAO_SNAPSHOT_RELATIVE_PATH,
      CORE_PATH,
      CLI_PATH,
      PATHS_PATH,
    ]) {
      const input = fixture();
      input.sourceFiles = input.sourceFiles.map((entry) =>
        entry.path === sourcePath
          ? { ...entry, text: `${entry.text}\n` }
          : entry,
      );
      expectFailedBuild(input);
    }

    const hashDrift = fixture();
    hashDrift.generatedFrom = hashDrift.generatedFrom.map((entry) =>
      entry.path === CORE_PATH ? { ...entry, sha256: "0".repeat(64) } : entry,
    );
    expectFailedBuild(hashDrift);

    const parsedInputKeys: Array<keyof Pick<
      BuildXiaoNonErEquipmentBranchSourceSliceInput,
      | "repositoryInput"
      | "manualSnapshotInput"
      | "manualIndexInput"
      | "sourceRegistryInput"
      | "xiaoSourceLocalDurableReportInput"
    >> = [
      "repositoryInput",
      "manualSnapshotInput",
      "manualIndexInput",
      "sourceRegistryInput",
      "xiaoSourceLocalDurableReportInput",
    ];
    for (const inputKey of parsedInputKeys) {
      const input = fixture();
      const value = structuredClone(input[inputKey]) as Record<string, unknown>;
      value.__forged = inputKey;
      input[inputKey] = value;
      expectFailedBuild(input);
    }
  });

  it("fails closed on locally rehashed rank, tie, unranked, empty-condition, classification, Circlet, and target source tampering", () => {
    const cases: Array<{
      label: string;
      sourceRecordId: string;
      repositoryRecordId: string;
      mutate: (manual: MutableRecommendation, repository: MutableRecommendation) => void;
    }> = [
      {
        label: "rank order",
        sourceRecordId: FIVE_STAR_SOURCE_ID,
        repositoryRecordId: FIVE_STAR_REPOSITORY_ID,
        mutate: (manual, repository) => {
          manual.weaponRecommendations!.reverse();
          repository.weaponRecommendations!.reverse();
        },
      },
      {
        label: "tied membership",
        sourceRecordId: FIVE_STAR_SOURCE_ID,
        repositoryRecordId: FIVE_STAR_REPOSITORY_ID,
        mutate: (manual, repository) => {
          manual.weaponRecommendations![0]!.weaponIds.pop();
          repository.weaponRecommendations![0]!.weaponIds.pop();
        },
      },
      {
        label: "unranked marker",
        sourceRecordId: FOUR_STAR_SOURCE_ID,
        repositoryRecordId: FOUR_STAR_REPOSITORY_ID,
        mutate: (manual, repository) => {
          manual.weaponOrdering = "ranked-groups";
          repository.weaponOrdering = "ranked-groups";
        },
      },
      {
        label: "empty condition",
        sourceRecordId: FOUR_STAR_SOURCE_ID,
        repositoryRecordId: FOUR_STAR_REPOSITORY_ID,
        mutate: (manual, repository) => {
          manual.weaponRecommendations![1]!.conditions = ["forged guard"];
          repository.weaponRecommendations![1]!.conditions = ["forged guard"];
        },
      },
      {
        label: "classification",
        sourceRecordId: FIVE_STAR_SOURCE_ID,
        repositoryRecordId: FIVE_STAR_REPOSITORY_ID,
        mutate: (manual, repository) => {
          manual.weaponRecommendations![2]!.classification = "recommended";
          repository.weaponRecommendations![2]!.classification = "recommended";
        },
      },
      {
        label: "Circlet",
        sourceRecordId: STATS_SOURCE_ID,
        repositoryRecordId: STATS_REPOSITORY_ID,
        mutate: (manual, repository) => {
          manual.mainStats!.circlet[0]!.statIds = ["cr"];
          repository.mainStats!.circlet[0]!.statIds = ["cr"];
        },
      },
      {
        label: "target",
        sourceRecordId: STATS_SOURCE_ID,
        repositoryRecordId: STATS_REPOSITORY_ID,
        mutate: (manual, repository) => {
          manual.substats![0]!.target = "forged target";
          repository.substats![0]!.target = "forged target";
        },
      },
    ];

    for (const testCase of cases) {
      const input = fixture();
      mutateSourcePair(
        input,
        testCase.sourceRecordId,
        testCase.repositoryRecordId,
        testCase.mutate,
      );
      const report = buildXiaoNonErEquipmentBranchSourceSliceReport(input);
      expect(report.comparisonStatus, testCase.label).toBe("not-comparable");
      expect(report.occurrences, testCase.label).toEqual([]);
      expect(report.rankedFiveStarGroups, testCase.label).toEqual([]);
      expect(report.unrankedFourStarOptions, testCase.label).toEqual([]);
      expect(report.issues, testCase.label).toHaveLength(1);
    }
  });

  it("fails closed on a locally rehashed forged checkpoint-42 durable report", () => {
    const input = fixture();
    const upstream = structuredClone(
      input.xiaoSourceLocalDurableReportInput,
    ) as XiaoSourceLocalConditionSliceReport;
    upstream.summary.holdoutOccurrenceCount = 13;
    replaceJsonInput(
      input,
      "xiaoSourceLocalDurableReportInput",
      XIAO_SOURCE_LOCAL_REPORT_RELATIVE_PATH,
      upstream,
    );

    const report = buildXiaoNonErEquipmentBranchSourceSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.upstreamBoundary.freshlyAuthenticated).toBe(false);
    expect(report.occurrences).toEqual([]);
    expect(report.issues[0]?.message).toContain("failed fresh authentication");
  });

  it("rejects serialized rank, tie, unranked, condition, classification, Circlet, target, and capability tampering", () => {
    const cases: Array<{
      label: string;
      mutate: (report: XiaoNonErEquipmentBranchSourceSliceReport) => void;
    }> = [
      {
        label: "rank order",
        mutate: (report) => report.rankedFiveStarGroups.reverse(),
      },
      {
        label: "tied membership",
        mutate: (report) => report.rankedFiveStarGroups[0]!.weaponIds.pop(),
      },
      {
        label: "unranked marker",
        mutate: (report) => {
          Reflect.set(
            report.unrankedFourStarOptions[0],
            "weaponOrdering",
            "ranked-groups",
          );
        },
      },
      {
        label: "empty condition",
        mutate: (report) => {
          report.conditionFreeOccurrenceIds = report.conditionFreeOccurrenceIds.slice(1);
        },
      },
      {
        label: "classification",
        mutate: (report) => {
          report.rankedFiveStarGroups[2]!.classification = "recommended";
        },
      },
      {
        label: "Circlet",
        mutate: (report) => {
          report.mainStatChoiceGroups[1]!.statIds = ["cr"];
        },
      },
      {
        label: "target",
        mutate: (report) => {
          report.guardedOffensiveTailPriorities[0]!.target = "forged target";
        },
      },
      {
        label: "capability",
        mutate: (report) => {
          Reflect.set(report, "supportsDerivedRankClaims", true);
          Reflect.set(report, "candidateGenerationExecuted", true);
          Reflect.set(report.summary, "candidateCount", 1);
        },
      },
    ];

    for (const testCase of cases) {
      const forged = structuredClone(durableReport);
      testCase.mutate(forged);
      expect(
        authenticateXiaoNonErEquipmentBranchSourceSliceReport(
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
    forged.summary.occurrenceCount = 12;
    expect(() =>
      requireComparableXiaoNonErEquipmentBranchSourceSliceReport(
        forged,
        fixture(),
      ),
    ).toThrow("serialized-report-mismatch");
  });
});

type MutableWeaponRecommendation = {
  weaponIds: string[];
  grouping: string;
  classification: string;
  conditions: string[];
};

type MutableStatRecommendation = {
  statIds: string[];
  conditions: string[];
  priority?: number;
  target?: string;
};

type MutableRecommendation = {
  weaponOrdering?: string;
  weaponRecommendations?: MutableWeaponRecommendation[];
  mainStats?: {
    sands: MutableStatRecommendation[];
    goblet: MutableStatRecommendation[];
    circlet: MutableStatRecommendation[];
  };
  substats?: MutableStatRecommendation[];
};

type MutableManualSnapshot = {
  records: Array<{
    sourceRecordId: string;
    recommendation: MutableRecommendation;
  }>;
};

type MutableRepository = {
  records: Array<{
    id: string;
    recommendations: MutableRecommendation[];
  }>;
};

async function loadFixture(): Promise<BuildXiaoNonErEquipmentBranchSourceSliceInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    xiaoSourceLocalDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(XIAO_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(
      path.join(REPOSITORY_ROOT, XIAO_SOURCE_LOCAL_REPORT_RELATIVE_PATH),
    ),
    Promise.all(
      XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS.map(
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
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildXiaoNonErEquipmentBranchSourceSliceInput {
  return structuredClone(baseInput);
}

function canonicalReport(): XiaoNonErEquipmentBranchSourceSliceReport {
  const report = buildXiaoNonErEquipmentBranchSourceSliceReport(fixture());
  if (report.comparisonStatus !== "comparable") {
    throw new Error(
      `Expected comparable Xiao non-ER source slice: ${report.issues
        .map(({ message }) => message)
        .join("; ")}`,
    );
  }
  return report;
}

function expectFailedBuild(
  input: BuildXiaoNonErEquipmentBranchSourceSliceInput,
): void {
  const report = buildXiaoNonErEquipmentBranchSourceSliceReport(input);
  expect(report).toMatchObject({
    comparisonStatus: "not-comparable",
    sourceBoundary: { status: "rejected", occurrenceCount: 0 },
    occurrences: [],
    rankedFiveStarGroups: [],
    unrankedFourStarOptions: [],
    mainStatChoiceGroups: [],
    guardedOffensiveTailPriorities: [],
    summary: {
      occurrenceCount: 0,
      sourceRecommendationObservationCount: 0,
      candidateCount: 0,
      completeBuildCount: 0,
      guideFactoryRecommendationCount: 0,
      derivedRankCount: 0,
    },
  });
  expect(report.issues).toHaveLength(1);
}

function mutateSourcePair(
  input: BuildXiaoNonErEquipmentBranchSourceSliceInput,
  sourceRecordId: string,
  repositoryRecordId: string,
  mutate: (
    manual: MutableRecommendation,
    repository: MutableRecommendation,
  ) => void,
): void {
  const manual = structuredClone(
    input.manualSnapshotInput,
  ) as MutableManualSnapshot;
  const repository = structuredClone(
    input.repositoryInput,
  ) as MutableRepository;
  const manualRecommendation = manual.records.find(
    (record) => record.sourceRecordId === sourceRecordId,
  )?.recommendation;
  const repositoryRecommendation = repository.records.find(
    (record) => record.id === repositoryRecordId,
  )?.recommendations[0];
  if (!manualRecommendation || !repositoryRecommendation) {
    throw new Error(`Missing mutation pair ${sourceRecordId}.`);
  }
  mutate(manualRecommendation, repositoryRecommendation);
  replaceJsonInput(
    input,
    "manualSnapshotInput",
    XIAO_SNAPSHOT_RELATIVE_PATH,
    manual,
  );
  replaceJsonInput(
    input,
    "repositoryInput",
    REPOSITORY_RELATIVE_PATH,
    repository,
  );
}

function replaceJsonInput(
  input: BuildXiaoNonErEquipmentBranchSourceSliceInput,
  inputKey:
    | "repositoryInput"
    | "manualSnapshotInput"
    | "manualIndexInput"
    | "sourceRegistryInput"
    | "xiaoSourceLocalDurableReportInput",
  relativePath: string,
  value: unknown,
): void {
  const text = stableJson(value);
  input[inputKey] = value;
  input.sourceFiles = input.sourceFiles.map((entry) =>
    entry.path === relativePath ? { path: entry.path, text } : entry,
  );
  input.generatedFrom = input.generatedFrom.map((entry) =>
    entry.path === relativePath
      ? { path: entry.path, sha256: sha256Text(text) }
      : entry,
  );
}
