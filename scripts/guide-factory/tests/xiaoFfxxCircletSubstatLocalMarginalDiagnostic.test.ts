import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import { REPOSITORY_ROOT } from "../src/paths";
import {
  authenticateXiaoFfxxCircletSubstatLocalMarginalDiagnostic,
  buildXiaoFfxxCircletSubstatLocalMarginalDiagnosticReport,
  requireAuthenticatedXiaoFfxxCircletSubstatLocalMarginalDiagnostic,
  XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES,
  XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
  XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_REPORT_PATH,
  XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_SOURCE_FILE_PATHS,
  XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES,
  type BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
  type XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport,
  type XiaoFfxxWrapperFrameCritObservation,
} from "../src/xiaoFfxxCircletSubstatLocalMarginalDiagnostic";
import {
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
  type XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
} from "../src/xiaoFfxxFiveStarSourceGroupValidationDiagnostic";
import { XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS } from "../src/xiaoFfxxGroupedReplayRepresentationPreflight";
import type { XiaoFfxxNonErConditionFreeBranchCandidateContractReport } from "../src/xiaoFfxxNonErConditionFreeBranchCandidateContract";
import type { XiaoFfxxUnitExpandedExecutionGateReport } from "../src/xiaoFfxxUnitExpandedExecutionGate";
import type { XiaoNonErEquipmentBranchSourceSliceReport } from "../src/xiaoNonErEquipmentBranchSourceSlice";

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
const FIVE_STAR_GROUP_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-five-star-source-group-validation-diagnostic.json";
const CHARACTER_BETA_STATS_PATH =
  "src/data/game/character_beta_stats.json.gz";
const WEAPON_BETA_STATS_PATH = "src/data/game/weapon_beta_stats.json.gz";
const CP50_CORE_PATH =
  "scripts/guide-factory/src/xiaoFfxxCircletSubstatLocalMarginalDiagnostic.ts";
const CP50_CLI_PATH =
  "scripts/guide-factory/src/assemble-xiao-ffxx-circlet-substat-local-marginal-diagnostic.ts";

const CIRCLET_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.circlet[0].conditions";
const CRIT_TAIL_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.substats[0].conditions";
const ATK_TAIL_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.substats[1].conditions";
const CIRCLET_GUARD_TEXT =
  "Choose between CRIT Rate and CRIT DMG according to the weapon and artifact substats while maintaining at least 70% CRIT Rate.";
const OFFENSIVE_TAIL_GUARD_TEXT =
  "This priority covers only the offensive tail after the source's deliberately omitted Energy Recharge need.";
const CRIT_TAIL_TARGET =
  "At least 70% CRIT Rate, then further CRIT Rate and CRIT DMG balanced near a 1:2 ratio.";

const EXPECTED_CP49_COUNTEREXAMPLE_HOLDOUTS = [
  {
    comparisonId:
      "guide-factory:xiao-ffxx:partial-non-er:lumidouce_elegy:mh-atk-anemo::source-rank-1-v-2::guide-factory:xiao-ffxx:partial-non-er:calamity_queller:mh-atk-anemo",
    comparisonSha256:
      "36f90eb15823e77e001a1aaf0212e21dff5064052d1bd15a967f46d0da927d7d",
    outcome: "source-order-counterexample",
  },
  {
    comparisonId:
      "guide-factory:xiao-ffxx:partial-non-er:lumidouce_elegy:mh-atk-anemo::source-rank-1-v-2::guide-factory:xiao-ffxx:partial-non-er:vortex_vanquisher:mh-atk-anemo",
    comparisonSha256:
      "0d1cfa58a09ddd598b7aaf21bbed20c38d70e3e6d0360f6e42d2d55abb4ba671",
    outcome: "source-order-counterexample",
  },
  {
    comparisonId:
      "guide-factory:xiao-ffxx:partial-non-er:primordial_jade_wingedspear:mh-atk-anemo::source-rank-1-v-2::guide-factory:xiao-ffxx:partial-non-er:calamity_queller:mh-atk-anemo",
    comparisonSha256:
      "48bc2cf239d7c4599b79f5117b06c09231b42884b3a21b4710aeaaff9cd9c667",
    outcome: "source-order-counterexample",
  },
  {
    comparisonId:
      "guide-factory:xiao-ffxx:partial-non-er:primordial_jade_wingedspear:mh-atk-anemo::source-rank-1-v-2::guide-factory:xiao-ffxx:partial-non-er:vortex_vanquisher:mh-atk-anemo",
    comparisonSha256:
      "518c6772f6b3522647ffc39a1997f565d47acbedf87c1c44e07d4c10ef670678",
    outcome: "source-order-counterexample",
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
  ["fiveStarSourceGroupDurableReportInput", FIVE_STAR_GROUP_REPORT_PATH],
] as const satisfies ReadonlyArray<
  readonly [
    keyof Omit<
      BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
      "sourceFiles" | "generatedFrom"
    >,
    string,
  ]
>;

let baseInput: BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput;
let durableReport: XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport;
let canonicalReport: XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadFixture(),
    readJson(
      XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_REPORT_PATH,
    ) as Promise<XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport>,
  ]);
  canonicalReport =
    await buildXiaoFfxxCircletSubstatLocalMarginalDiagnosticReport(fixture());
}, 120_000);

describe("Xiao FFXX guarded Circlet and local-substat marginal diagnostic", () => {
  it("rebuilds deterministically and authenticates the exact 127-byte/15-JSON closure", async () => {
    expect(stableJson(canonicalReport)).toBe(stableJson(durableReport));
    expect(
      XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
    ).toHaveLength(127);
    expect(
      XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_SOURCE_FILE_PATHS,
    ).toEqual(
      XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
    );
    expect(
      XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
    ).toEqual(
      [
        ...XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
      ].sort(),
    );
    expect(
      new Set(
        XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
      ).size,
    ).toBe(127);
    expect(JSON_INPUTS).toHaveLength(15);
    expect(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS.every(
        (sourcePath) =>
          XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS.includes(
            sourcePath,
          ),
      ),
    ).toBe(true);
    expect(
      XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS.filter(
        (sourcePath) =>
          !XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS.includes(
            sourcePath,
          ),
      ),
    ).toEqual([FIVE_STAR_GROUP_REPORT_PATH, CP50_CLI_PATH, CP50_CORE_PATH]);
    expect(canonicalReport.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      combinedJsonInputByteAndParsedObjectParity: true,
      sourceFileCount: 127,
      generatedFromCount: 127,
      authenticatedJsonInputParityCount: 15,
      declaredInheritedRuntimePathCount: 80,
      declaredNewRuntimePathCount: 0,
      declaredRuntimePathsRemainInsideInheritedCheckpoint47Set: true,
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
      await authenticateXiaoFfxxCircletSubstatLocalMarginalDiagnostic(
        durableReport,
        fixture(),
      ),
    ).toMatchObject({ authenticated: true });
    await expect(
      requireAuthenticatedXiaoFfxxCircletSubstatLocalMarginalDiagnostic(
        durableReport,
        fixture(),
      ),
    ).resolves.toBeUndefined();
  }, 120_000);

  it("independently validates the inherited static replay set and every CP50 implementation import", async () => {
    const declared = new Set(
      XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
    );
    const expectedRuntime = new Set<string>(
      XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS,
    );
    expect(expectedRuntime.size).toBe(80);
    expect([...expectedRuntime].every((sourcePath) => declared.has(sourcePath))).toBe(
      true,
    );

    const importCache = new Map<string, string[]>();
    const importsFor = async (sourcePath: string): Promise<string[]> => {
      const cached = importCache.get(sourcePath);
      if (cached) return cached;
      if (!/\.tsx?$/.test(sourcePath)) return [];
      const sourceText = await readFile(
        path.join(REPOSITORY_ROOT, sourcePath),
        "utf8",
      );
      const sourceFile = ts.createSourceFile(
        sourcePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
      );
      const imports = runtimeStaticModuleSpecifiers(sourceFile).flatMap(
        (moduleSpecifier) => {
          const resolved = resolveFirstPartyModulePath(
            sourcePath,
            moduleSpecifier,
          );
          return resolved ? [resolved] : [];
        },
      );
      importCache.set(sourcePath, imports);
      return imports;
    };

    for (const implementationPath of [CP50_CORE_PATH, CP50_CLI_PATH]) {
      for (const importedPath of await importsFor(implementationPath)) {
        expect(declared.has(importedPath), `${implementationPath} -> ${importedPath}`).toBe(
          true,
        );
      }
    }

    const outsideInheritedRuntimeSet: string[] = [];
    for (const runtimePath of expectedRuntime) {
      for (const importedPath of await importsFor(runtimePath)) {
        if (!expectedRuntime.has(importedPath)) {
          outsideInheritedRuntimeSet.push(`${runtimePath} -> ${importedPath}`);
        }
      }
    }
    expect(outsideInheritedRuntimeSet).toEqual([]);

    const runtimeRoots = new Set<string>([
      "scripts/guide-factory/src/computationReplay.ts",
    ]);
    for (const importedPath of await importsFor(CP50_CORE_PATH)) {
      if (expectedRuntime.has(importedPath)) runtimeRoots.add(importedPath);
    }
    const derivedRuntime = new Set<string>();
    const queue = [...runtimeRoots];
    while (queue.length > 0) {
      const sourcePath = queue.shift();
      if (!sourcePath || derivedRuntime.has(sourcePath)) continue;
      derivedRuntime.add(sourcePath);
      for (const importedPath of await importsFor(sourcePath)) {
        if (expectedRuntime.has(importedPath) && !derivedRuntime.has(importedPath)) {
          queue.push(importedPath);
        }
      }
    }
    expect([...derivedRuntime].sort()).toEqual([...expectedRuntime].sort());
  });

  it("fresh-authenticates CP49 and pins the exact three still-unresolved checkpoint-45 source rows", () => {
    expect(canonicalReport.upstreamBoundary).toMatchObject({
      durableReportPath: FIVE_STAR_GROUP_REPORT_PATH,
      durableReportFileSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      durableReportCanonicalObjectSha256: expect.stringMatching(
        /^[a-f0-9]{64}$/,
      ),
      freshlyAuthenticatedCheckpoint49: true,
      checkpoint49InputCount: 124,
      checkpoint49AdditionalReplayCount: 0,
      fullChainFreshlyAuthenticated: true,
      branchSourceFreshlyAuthenticated: true,
      branchCandidateFreshlyAuthenticated: true,
      formulaCountFreshlyAuthenticated: true,
      trustedCheckpoint48ObservationCount: 6,
    });
    const checkpoint49 =
      baseInput.fiveStarSourceGroupDurableReportInput as XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport;
    expect(
      checkpoint49.sourceTargetBoundary.groups.map(
        ({
          branchGroupId,
          candidateIds,
          sourceRankGroup,
          sourceOrdering,
          sourceGroupSha256,
        }) => ({
          branchGroupId,
          candidateIds,
          sourceRankGroup,
          sourceOrdering,
          sourceGroupSha256,
        }),
      ),
    ).toEqual([
      {
        branchGroupId: "xiao-ffxx:five-star-source-rank-group-1",
        candidateIds: [
          "guide-factory:xiao-ffxx:partial-non-er:lumidouce_elegy:mh-atk-anemo",
          "guide-factory:xiao-ffxx:partial-non-er:primordial_jade_wingedspear:mh-atk-anemo",
          "guide-factory:xiao-ffxx:partial-non-er:staff_of_homa:mh-atk-anemo",
        ],
        sourceRankGroup: 1,
        sourceOrdering: "ranked-groups",
        sourceGroupSha256:
          "65247f1953443f32c5341dc6ed807809fafdd157eae942372e4102e41949850e",
      },
      {
        branchGroupId: "xiao-ffxx:five-star-source-rank-group-2",
        candidateIds: [
          "guide-factory:xiao-ffxx:partial-non-er:calamity_queller:mh-atk-anemo",
          "guide-factory:xiao-ffxx:partial-non-er:vortex_vanquisher:mh-atk-anemo",
        ],
        sourceRankGroup: 2,
        sourceOrdering: "ranked-groups",
        sourceGroupSha256:
          "f34ab041b934495bc413e3770b0c29113e04c5772f3d609f5202430711b7bb04",
      },
    ]);
    expect(checkpoint49.sourceTargetBoundary.deathmatchExclusion).toMatchObject(
      {
        branchGroupId: "xiao-ffxx:four-star-unranked-deathmatch",
        candidateId:
          "guide-factory:xiao-ffxx:partial-non-er:deathmatch:mh-atk-anemo",
        sourceRankGroup: null,
        sourceOrdering: "unranked",
        excludedFromFiveStarGroups: true,
        excludedFromAllPairs: true,
        crossRarityComparisonExecuted: false,
        relativePosition: null,
        factoryRank: null,
      },
    );

    const source = canonicalReport.sourceVsWrapperLedger.sourceBoundary;
    expect(source).toEqual({
      checkpoint45GuardedRowsPinnedExactly: true,
      guardedRowCount: 3,
      guardedRows: [
        {
          axis: "main-stat:circlet",
          occurrenceId: CIRCLET_OCCURRENCE_ID,
          occurrenceSha256:
            "bad538418c24efa1730bbeeec106cb66bf1145b16e30803b51b517e2b3452fae",
          sourceItemSha256:
            "244d5a0d008854a6f0dbcf5318c60eab5dc411041cefafb49249f622a42f91c4",
          sourceGroupSha256:
            "38d7cbb5589c097539074cd00280075bcb3b8c99dab8141915ef108993e4c394",
          conditionsSha256:
            "59c5435ce1e2d05139f27284146e6b74dff31964e1b0521a1f8848fbd3914839",
          sourceConditionStatus: "guarded-unresolved",
          conditionRole: "candidate-stat-dependent-circlet-selection",
          statIds: ["cr", "cd"],
          priority: null,
          target: null,
          conditionText: CIRCLET_GUARD_TEXT,
        },
        {
          axis: "substats",
          occurrenceId: CRIT_TAIL_OCCURRENCE_ID,
          occurrenceSha256:
            "9de89a000d9d041b5f0f569c784ee8bf991fe50523e947652c64e176043b6c22",
          sourceItemSha256:
            "f74f6a6eafb068d2f9603df83e866516be4f6c47294ca94806d1122dbe614e6b",
          sourceGroupSha256:
            "aa9082f99aa6af867b39968e911a144b69c9f5e1d2f43cc99e05df360e55381e",
          conditionsSha256:
            "668aeb631eaed5ff8f7a7a0e4547e7d428eb8b53aabaaa6b17ae1d450f9a9210",
          sourceConditionStatus: "guarded-unresolved",
          conditionRole: "incomplete-offensive-tail-after-deferred-er",
          statIds: ["cr", "cd"],
          priority: 1,
          target: CRIT_TAIL_TARGET,
          conditionText: OFFENSIVE_TAIL_GUARD_TEXT,
        },
        {
          axis: "substats",
          occurrenceId: ATK_TAIL_OCCURRENCE_ID,
          occurrenceSha256:
            "d43e6cd266d6fc2993c0575daad55fe53a4a2c7ac8bcebaa2369d265b8ae59b5",
          sourceItemSha256:
            "0374e51a3996ac146ae5b00ea4f0da7a22674b3e6e9ee7153903abe794f74fdf",
          sourceGroupSha256:
            "548b36f17cba456e7657e769808ddd7f1a6d1d3bc0a236a0385ff3b7a10a0b97",
          conditionsSha256:
            "668aeb631eaed5ff8f7a7a0e4547e7d428eb8b53aabaaa6b17ae1d450f9a9210",
          sourceConditionStatus: "guarded-unresolved",
          conditionRole: "incomplete-offensive-tail-after-deferred-er",
          statIds: ["atk%"],
          priority: 2,
          target: null,
          conditionText: OFFENSIVE_TAIL_GUARD_TEXT,
        },
      ],
      sourceGuardResolved: false,
      sourceApplicabilityEstablished: false,
      sourceCircletSelectionExecuted: false,
      sourceSubstatSelectionExecuted: false,
      sourceCompletePriorityPlan: false,
      sourceEnergyRecoveryNeedOmittedAndDeferred: true,
    });
    expect(canonicalReport.sourceVsWrapperLedger.wrapperBoundary).toEqual({
      experimentalDomainOnly: true,
      guardedRowsConsumedAsRecommendations: false,
      unitExpandedLineOrderAuthoredByWrapper: true,
      teamInvestmentAndSupporterEquipmentAuthoredByWrapper: true,
      combatOptionsAuthoredByWrapper: true,
      artifactNumericMainStatsMaterializedByWrapper: true,
      averageRollNumericValuesReadFromRuntimeConstant: true,
      placementSlotChosen: false,
      thresholdOrToleranceInterpretationApplied: false,
      circletChoiceProduced: false,
      substatChoiceProduced: false,
    });
    expect(canonicalReport.sourceGuardResolved).toBe(false);
    expect(canonicalReport.sourceApplicabilityEstablished).toBe(false);
  });

  it("admits exact numeric experimental factors and records legal placement domains without selecting a slot", () => {
    expect(XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES).toEqual({
      cr: 0.311,
      cd: 0.622,
    });
    expect(XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES).toEqual({
      cr: 0.03305,
      cd: 0.06605,
      "atk%": 0.049550000000000004,
    });
    expect(canonicalReport.experimentalDomain).toMatchObject({
      circletStats: ["cr", "cd"],
      circletMainStatValues: XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES,
      probeStats: ["cr", "cd", "atk%"],
      averageRollValues: XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES,
      mainStatValueOrigin:
        "level-20-five-star-getMainStatValueAtLevel-plus-toInternal",
      averageRollValueOrigin: "current-AVG_SUBSTAT_ROLL-source-constant",
      substatPlacementDomainRecorded: true,
      placementSlotChosen: false,
      sourceGuardResolved: false,
      sourceApplicabilityEstablished: false,
      domainSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(canonicalReport.fixtureBoundary).toMatchObject({
      baseArtifactMainStats: ["hp", "atk", "atk%", "anemo%"],
      calcContext: {
        enemyLevel: 110,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
      inheritedArtifactRollMultiplierUnusedByExplicitSheets: true,
      inheritedSubstatBudgetUnusedByExplicitSheets: true,
    });
    for (const node of [
      ...canonicalReport.baselines,
      ...canonicalReport.probes,
    ]) {
      expect(Reflect.has(node, "rollMultiplier")).toBe(false);
      expect(Reflect.has(node, "substatBudget")).toBe(false);
    }

    expect(canonicalReport.baselines).toHaveLength(12);
    for (const baseline of canonicalReport.baselines) {
      expect(baseline.circletMainStatValue).toBe(
        XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES[baseline.circletStat],
      );
      expect(baseline).toMatchObject({
        sourceGuardResolved: false,
        sourceApplicabilityEstablished: false,
        experimentalAdmissionOnly: true,
        factoryRank: null,
        winner: false,
        recommendation: false,
      });
    }

    expect(canonicalReport.probes).toHaveLength(36);
    for (const probe of canonicalReport.probes) {
      expect(probe.averageRollValue).toBe(
        XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES[probe.probeStat],
      );
      expect(probe.nonConflictingPlacementSlotDomain).toEqual(
        expectedPlacementDomain(probe.circletStat, probe.probeStat),
      );
      expect(probe).toMatchObject({
        placementSlotChosen: null,
        placementSelectionExecuted: false,
        sourceGuardResolved: false,
        sourceApplicabilityEstablished: false,
        experimentalAdmissionOnly: true,
        factoryRank: null,
        winner: false,
        recommendation: false,
      });
    }
    expect(canonicalReport.placementSelectionExecuted).toBe(false);
    expect(canonicalReport.summary.selectedCircletCount).toBe(0);
    expect(canonicalReport.summary.selectedSubstatCount).toBe(0);
  });

  it("executes exactly six reconstruction controls plus the 12+36 lattice and preserves every dual path and activation trace", () => {
    expect(canonicalReport.operationBoundary).toEqual({
      checkpoint50ReplayCount: 54,
      reconstructionControlReplayCount: 6,
      latticeBaselineReplayCount: 12,
      latticeProbeReplayCount: 36,
      latticeNodeCount: 48,
      directPathEvaluationCount: 54,
      compiledPathEvaluationCount: 54,
      dualPathAgreementCount: 54,
      xianyunEightActiveThreeInactiveTraceCount: 54,
      localMarginalCount: 36,
      sameWeaponCircletDeltaCount: 6,
      sameCircletFiveStarCrossGroupComparisonCount: 12,
      mixedCircletCrossWeaponComparisonCount: 0,
      perturbedCrossWeaponComparisonCount: 0,
      withinGroupComparisonCount: 0,
      deathmatchPairComparisonCount: 0,
      allocationCount: 0,
    });

    const checkpoint48 =
      baseInput.unitExpandedDurableReportInput as XiaoFfxxUnitExpandedExecutionGateReport;
    const checkpoint48ByCandidate = new Map(
      checkpoint48.observations.map((observation) => [
        observation.candidateId,
        observation,
      ]),
    );
    expect(canonicalReport.reconstructionControls).toHaveLength(6);
    expect(
      canonicalReport.reconstructionControls.map(({ candidateId }) => candidateId),
    ).toEqual(
      canonicalReport.reconstructionControls
        .map(({ candidateId }) => candidateId)
        .sort(),
    );
    for (const control of canonicalReport.reconstructionControls) {
      const upstream = checkpoint48ByCandidate.get(control.candidateId);
      expect(upstream).toBeDefined();
      expect(control).toMatchObject({
        candidateIdentitySha256: upstream?.candidateIdentitySha256,
        weaponId: upstream?.weaponId,
        refinement: upstream?.refinement,
        upstreamCheckpoint48ObservationSha256: upstream?.observationSha256,
        upstreamCheckpoint48TotalDamage:
          upstream?.normalizedExecution.unitExpandedDirectTotalDamage,
        directTotalDamage:
          upstream?.normalizedExecution.unitExpandedDirectTotalDamage,
        exactUpstreamTotalReproduced: true,
        exactUpstreamActivationTraceReproduced: true,
        latticeNode: false,
        comparisonExecuted: false,
      });
      expect(control.candidateProvenanceSha256).toMatch(/^[a-f0-9]{64}$/);
      const { controlSha256: _hash, ...controlIdentity } = control;
      expect(control.controlSha256).toBe(sha256Value(controlIdentity));
    }

    const executions = [
      ...canonicalReport.reconstructionControls,
      ...canonicalReport.baselines,
      ...canonicalReport.probes,
    ];
    expect(executions).toHaveLength(54);
    for (const execution of executions) {
      expect(execution.absoluteDifference).toBeLessThanOrEqual(
        execution.allowedDifference,
      );
      expect(execution.directTotalDamage).toBeGreaterThan(0);
      expect(execution.compiledTotalDamage).toBeGreaterThan(0);
      expect(execution.xianyunActivation).toMatchObject({
        buffKey: expect.any(String),
        perPlungeOccurrence: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
        activePlungeOccurrenceCount: 8,
        inactivePlungeOccurrenceCount: 3,
        totalActivation: 8,
        traceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      const { traceSha256: _traceHash, ...traceIdentity } =
        execution.xianyunActivation;
      expect(execution.xianyunActivation.traceSha256).toBe(
        sha256Value(traceIdentity),
      );
    }
    expect(canonicalReport.summary).toMatchObject({
      authenticatedCandidateCount: 6,
      reconstructionControlCount: 6,
      baselineCount: 12,
      probeCount: 36,
      latticeNodeCount: 48,
      replayCount: 54,
    });
  });

  it("records exactly three below-70%-CR CD-Circlet baselines without resolving or applying the source guard", () => {
    const belowThreshold = canonicalReport.baselines.filter(
      ({ wrapperFrameCritObservation }) =>
        wrapperFrameCritObservation.critRate < 0.7,
    );
    expect(belowThreshold).toHaveLength(3);
    expect(
      belowThreshold.every(({ circletStat }) => circletStat === "cd"),
    ).toBe(true);
    expect(
      canonicalReport.baselines.filter(({ circletStat }) => circletStat === "cd"),
    ).toHaveLength(6);
    for (const baseline of canonicalReport.baselines) {
      expect(baseline.sourceGuardResolved).toBe(false);
      expect(baseline.wrapperFrameCritObservation).toMatchObject({
        frame:
          "calculator-post-team-stats-xiao-on-field-before-line-specific-buff-overrides",
        sourceGuardResolved: false,
        thresholdApplied: false,
        toleranceApplied: false,
        choiceProduced: false,
        observationSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      const { observationSha256: _hash, ...identity } =
        baseline.wrapperFrameCritObservation;
      expect(baseline.wrapperFrameCritObservation.observationSha256).toBe(
        sha256Value(identity),
      );
    }
    expect(canonicalReport.sourceVsWrapperLedger.wrapperBoundary).toMatchObject({
      thresholdOrToleranceInterpretationApplied: false,
      circletChoiceProduced: false,
    });
    expect(canonicalReport.summary.sourceGuardResolvedCount).toBe(0);
    expect(
      canonicalReport.summary.sourceApplicabilityEstablishedRowCount,
    ).toBe(0);
  });

  it("keeps all 36 marginals local and restricts Circlet and source-group comparisons to their exact scopes", () => {
    const baselineById = new Map(
      canonicalReport.baselines.map((baseline) => [baseline.nodeId, baseline]),
    );
    const probeById = new Map(
      canonicalReport.probes.map((probe) => [probe.nodeId, probe]),
    );
    expect(canonicalReport.localMarginals).toHaveLength(36);
    for (const marginal of canonicalReport.localMarginals) {
      const baseline = baselineById.get(marginal.baselineNodeId);
      const probe = probeById.get(marginal.probeNodeId);
      expect(baseline).toBeDefined();
      expect(probe).toBeDefined();
      expect(marginal).toMatchObject({
        candidateId: baseline?.candidateId,
        weaponId: baseline?.weaponId,
        circletStat: baseline?.circletStat,
        probeStat: probe?.probeStat,
        averageRollValue: probe?.averageRollValue,
        baselineDirectTotalDamage: baseline?.directTotalDamage,
        probeDirectTotalDamage: probe?.directTotalDamage,
        localOneStepNeighborOnly: true,
        comparisonScope: "same-weapon-same-circlet-one-average-roll",
        winner: false,
        recommendation: false,
      });
      expect(marginal.absoluteDamageDelta).toBeCloseTo(
        marginal.probeDirectTotalDamage - marginal.baselineDirectTotalDamage,
        9,
      );
      expect(marginal.relativeDamageDelta).toBeCloseTo(
        marginal.absoluteDamageDelta / marginal.baselineDirectTotalDamage,
        12,
      );
      expect(Reflect.has(marginal, "weight")).toBe(false);
      expect(Reflect.has(marginal, "priority")).toBe(false);
    }

    expect(canonicalReport.sameWeaponCircletDeltas).toHaveLength(6);
    for (const comparison of canonicalReport.sameWeaponCircletDeltas) {
      const cr = baselineById.get(comparison.critRateBaselineNodeId);
      const cd = baselineById.get(comparison.critDamageBaselineNodeId);
      expect(cr).toMatchObject({
        candidateId: comparison.candidateId,
        weaponId: comparison.weaponId,
        circletStat: "cr",
      });
      expect(cd).toMatchObject({
        candidateId: comparison.candidateId,
        weaponId: comparison.weaponId,
        circletStat: "cd",
      });
      expect(comparison).toMatchObject({
        critRateCircletDirectTotalDamage: cr?.directTotalDamage,
        critDamageCircletDirectTotalDamage: cd?.directTotalDamage,
        comparisonScope:
          "same-weapon-unperturbed-cr-circlet-minus-cd-circlet",
        sourceGuardResolved: false,
        choiceProduced: false,
        preferredCirclet: null,
        winner: false,
        recommendation: false,
      });
    }

    expect(canonicalReport.sameCircletFiveStarCrossGroupComparisons).toHaveLength(
      12,
    );
    for (const circletStat of ["cr", "cd"] as const) {
      expect(
        canonicalReport.sameCircletFiveStarCrossGroupComparisons.filter(
          (comparison) => comparison.circletStat === circletStat,
        ),
      ).toHaveLength(6);
    }
    expect(
      new Set(
        canonicalReport.sameCircletFiveStarCrossGroupComparisons.map(
          ({ comparisonId }) => comparisonId,
        ),
      ).size,
    ).toBe(12);
    for (const comparison of
      canonicalReport.sameCircletFiveStarCrossGroupComparisons) {
      const rankOne = baselineById.get(comparison.rankOneBaselineNodeId);
      const rankTwo = baselineById.get(comparison.rankTwoBaselineNodeId);
      expect(rankOne?.circletStat).toBe(comparison.circletStat);
      expect(rankTwo?.circletStat).toBe(comparison.circletStat);
      expect(rankOne?.candidateId).toBe(comparison.rankOneCandidateId);
      expect(rankTwo?.candidateId).toBe(comparison.rankTwoCandidateId);
      expect(comparison).toMatchObject({
        validationTargetOnly: true,
        baselineOnly: true,
        sameCircletOnly: true,
        perturbedCrossWeaponComparison: false,
        withinGroupComparison: false,
        deathmatchComparison: false,
        factoryRank: null,
        winner: false,
        recommendation: false,
      });
      expect(comparison.rankOneCandidateId).not.toContain(":deathmatch:");
      expect(comparison.rankTwoCandidateId).not.toContain(":deathmatch:");
    }
    expect(canonicalReport.operationBoundary).toMatchObject({
      mixedCircletCrossWeaponComparisonCount: 0,
      perturbedCrossWeaponComparisonCount: 0,
      withinGroupComparisonCount: 0,
      deathmatchPairComparisonCount: 0,
    });
  });

  it("preserves the four exact checkpoint-49 counterexamples as immutable non-objective holdouts", () => {
    expect(canonicalReport.immutableCp49CounterexampleHoldouts).toEqual({
      role: "immutable-upstream-validation-target-not-optimization-objective",
      consumedByObjective: false,
      exactHoldoutCount: 4,
      holdouts: EXPECTED_CP49_COUNTEREXAMPLE_HOLDOUTS,
      holdoutSetSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(
      canonicalReport.immutableCp49CounterexampleHoldouts.holdoutSetSha256,
    ).toBe(sha256Value(EXPECTED_CP49_COUNTEREXAMPLE_HOLDOUTS));
    const upstream =
      baseInput.fiveStarSourceGroupDurableReportInput as XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport;
    expect(
      upstream.comparisons
        .filter(({ sourceOrderCounterexample }) => sourceOrderCounterexample)
        .map(({ comparisonId, comparisonSha256, outcome }) => ({
          comparisonId,
          comparisonSha256,
          outcome,
        })),
    ).toEqual(EXPECTED_CP49_COUNTEREXAMPLE_HOLDOUTS);
  });

  it("binds technical identities separately from source provenance and treats serialization permutations as non-ranking", () => {
    const checkpoint46 =
      baseInput.branchCandidateDurableReportInput as XiaoFfxxNonErConditionFreeBranchCandidateContractReport;
    const provenanceByCandidate = new Map(
      checkpoint46.candidates.map(
        ({ candidateId, candidateProvenanceSha256 }) => [
          candidateId,
          candidateProvenanceSha256,
        ],
      ),
    );
    for (const observation of [
      ...canonicalReport.reconstructionControls,
      ...canonicalReport.baselines,
      ...canonicalReport.probes,
    ]) {
      expect(observation.candidateProvenanceSha256).toBe(
        provenanceByCandidate.get(observation.candidateId),
      );
    }
    const baselineOrder = canonicalReport.reconstructionControls.flatMap(
      ({ candidateId }) =>
        (["cr", "cd"] as const).map((circletStat) => ({
          candidateId,
          circletStat,
        })),
    );
    expect(
      canonicalReport.baselines.map(({ candidateId, circletStat }) => ({
        candidateId,
        circletStat,
      })),
    ).toEqual(baselineOrder);
    expect(
      canonicalReport.probes.map(
        ({ candidateId, circletStat, probeStat }) => ({
          candidateId,
          circletStat,
          probeStat,
        }),
      ),
    ).toEqual(
      baselineOrder.flatMap(({ candidateId, circletStat }) =>
        (["cr", "cd", "atk%"] as const).map((probeStat) => ({
          candidateId,
          circletStat,
          probeStat,
        })),
      ),
    );

    for (const baseline of canonicalReport.baselines) {
      expect(baseline.candidateProvenanceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(baseline.wrapperFrameCritNumericObservationSha256).toBe(
        sha256Value(wrapperFrameNumericIdentity(baseline.wrapperFrameCritObservation)),
      );
      expect(baseline.nodeSha256).toBe(
        sha256Value({
          nodeId: baseline.nodeId,
          candidateId: baseline.candidateId,
          candidateIdentitySha256: baseline.candidateIdentitySha256,
          weaponId: baseline.weaponId,
          refinement: baseline.refinement,
          circletStat: baseline.circletStat,
          circletMainStatValue: baseline.circletMainStatValue,
          fixtureSha256: canonicalReport.fixtureBoundary.fixtureSha256,
          directTotalDamage: baseline.directTotalDamage,
          compiledTotalDamage: baseline.compiledTotalDamage,
          xianyunActivationTraceSha256:
            baseline.xianyunActivation.traceSha256,
          wrapperFrameCritNumericObservationSha256:
            baseline.wrapperFrameCritNumericObservationSha256,
        }),
      );
    }
    for (const probe of canonicalReport.probes) {
      expect(probe.candidateProvenanceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(probe.wrapperFrameCritNumericObservationSha256).toBe(
        sha256Value(wrapperFrameNumericIdentity(probe.wrapperFrameCritObservation)),
      );
      expect(probe.nodeSha256).toBe(
        sha256Value({
          nodeId: probe.nodeId,
          baselineNodeId: probe.baselineNodeId,
          candidateId: probe.candidateId,
          candidateIdentitySha256: probe.candidateIdentitySha256,
          weaponId: probe.weaponId,
          refinement: probe.refinement,
          circletStat: probe.circletStat,
          probeStat: probe.probeStat,
          averageRollValue: probe.averageRollValue,
          nonConflictingPlacementSlotDomain:
            probe.nonConflictingPlacementSlotDomain,
          placementSlotChosen: null,
          fixtureSha256: canonicalReport.fixtureBoundary.fixtureSha256,
          directTotalDamage: probe.directTotalDamage,
          compiledTotalDamage: probe.compiledTotalDamage,
          xianyunActivationTraceSha256:
            probe.xianyunActivation.traceSha256,
          wrapperFrameCritNumericObservationSha256:
            probe.wrapperFrameCritNumericObservationSha256,
        }),
      );
    }
    for (const marginal of canonicalReport.localMarginals) {
      const { marginalSha256: _hash, ...identity } = marginal;
      expect(marginal.marginalSha256).toBe(sha256Value(identity));
    }
    for (const comparison of canonicalReport.sameWeaponCircletDeltas) {
      const { comparisonSha256: _hash, ...identity } = comparison;
      expect(comparison.comparisonSha256).toBe(sha256Value(identity));
    }
    for (const comparison of
      canonicalReport.sameCircletFiveStarCrossGroupComparisons) {
      const { comparisonSha256: _hash, ...identity } = comparison;
      expect(comparison.comparisonSha256).toBe(sha256Value(identity));
    }
    expect(canonicalReport.identityBoundary).toMatchObject({
      upstreamCanonicalObjectSha256:
        canonicalReport.upstreamBoundary.durableReportCanonicalObjectSha256,
      sourceLedgerSha256:
        canonicalReport.sourceVsWrapperLedger.sourceLedgerSha256,
      wrapperLedgerSha256:
        canonicalReport.sourceVsWrapperLedger.wrapperLedgerSha256,
      experimentalDomainSha256:
        canonicalReport.experimentalDomain.domainSha256,
      fixtureSha256: canonicalReport.fixtureBoundary.fixtureSha256,
      holdoutSetSha256:
        canonicalReport.immutableCp49CounterexampleHoldouts.holdoutSetSha256,
      technicalNodeIdentityExcludesCheckpoint50GuardResolutionAndClaimFields:
        true,
      sourceLedgerIdentityExcludesComputedTotals: true,
      sourceGroupMembershipAffectsOnlyProvenanceAndBaselineValidationPairs:
        true,
      permutationSemantics:
        "candidate-id-then-circlet-cr-cd-then-probe-cr-cd-atk-percent-serialization-is-not-rank",
      everyProbeIsOneBaselineOneRollNeighbor: true,
      candidateOrderPermutationCannotAlterNodeIdentity: true,
      circletOrderPermutationCannotAlterNodeIdentity: true,
      probeStatOrderPermutationCannotAlterNodeIdentity: true,
      candidateProvenanceExcludedFromTechnicalNodeIdentity: true,
      aggregateDiagnosticSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(canonicalReport.summary.rankedCandidateCount).toBe(0);
  });

  it("emits an experimental diagnostic only and withholds every guide, allocator, optimizer, selection, and ER claim", () => {
    expect(canonicalReport).toMatchObject({
      validationStatus: "accepted-experimental-diagnostic-only",
      publicationStatus: "withheld-not-a-guide-optimizer-or-selection",
      sourceGuardResolved: false,
      sourceApplicabilityEstablished: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsBuildRecommendations: false,
      supportsStatRecommendations: false,
      supportsCircletRecommendations: false,
      supportsSubstatRecommendations: false,
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
      experimentalDomainAdmitted: true,
      reconstructionControlExecuted: true,
      localMarginalDiagnosticExecuted: true,
      sameWeaponCircletDeltaExecuted: true,
      sameCircletFiveStarCrossGroupValidationExecuted: true,
      circletSelectionExecuted: false,
      substatSelectionExecuted: false,
      placementSelectionExecuted: false,
      rankingExecuted: false,
      winnerSelectionExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      autoTuneExecuted: false,
      recommendationCompositionExecuted: false,
      idealRollAllocationExecuted: false,
      energyRecoveryInputsUsed: false,
      energyRecoveryComputationExecuted: false,
      summary: {
        selectedCircletCount: 0,
        selectedSubstatCount: 0,
        rankedCandidateCount: 0,
        winnerCount: 0,
        recommendationCount: 0,
        completeBuildCount: 0,
        idealRollAllocationCount: 0,
        energyRecoveryComputationCount: 0,
      },
      issues: [],
    });
    expect(stableJson(canonicalReport)).not.toContain('"factoryRank":1');
    expect(stableJson(canonicalReport)).not.toContain('"preferredCirclet":"');
  });

  it("rejects missing, duplicate, raw/hash/JSON, and binary-tampered authenticated inputs", async () => {
    const missing = fixture();
    missing.sourceFiles = missing.sourceFiles.slice(1);
    await expectRejectedInput(missing, "source-file path closure drifted");

    const duplicate = fixture();
    duplicate.generatedFrom = [
      ...duplicate.generatedFrom,
      duplicate.generatedFrom[0],
    ];
    await expectRejectedInput(duplicate, "generatedFrom path closure drifted");

    const rawTamper = fixture();
    rawTamper.sourceFiles = rawTamper.sourceFiles.map((entry) =>
      entry.path === CP50_CORE_PATH
        ? {
            ...entry,
            bytesBase64: Buffer.from(
              `${Buffer.from(entry.bytesBase64, "base64").toString("utf8")}\n`,
            ).toString("base64"),
          }
        : entry,
    );
    await expectRejectedInput(rawTamper, CP50_CORE_PATH);

    const hashTamper = fixture();
    hashTamper.generatedFrom = hashTamper.generatedFrom.map((entry) =>
      entry.path === FIVE_STAR_GROUP_REPORT_PATH
        ? { ...entry, sha256: "0".repeat(64) }
        : entry,
    );
    await expectRejectedInput(hashTamper, FIVE_STAR_GROUP_REPORT_PATH);

    const parityMismatch = fixture();
    const parsedUpstream = structuredClone(
      parityMismatch.fiveStarSourceGroupDurableReportInput,
    ) as XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport;
    Reflect.set(parsedUpstream.summary, "winnerCount", 1);
    parityMismatch.fiveStarSourceGroupDurableReportInput = parsedUpstream;
    await expectRejectedInput(parityMismatch, "parsed input disagrees with bytes");

    const malformedJson = fixture();
    const malformedText = "{not-json";
    malformedJson.sourceFiles = malformedJson.sourceFiles.map((entry) =>
      entry.path === FIVE_STAR_GROUP_REPORT_PATH
        ? {
            ...entry,
            bytesBase64: Buffer.from(malformedText).toString("base64"),
          }
        : entry,
    );
    malformedJson.generatedFrom = malformedJson.generatedFrom.map((entry) =>
      entry.path === FIVE_STAR_GROUP_REPORT_PATH
        ? { ...entry, sha256: sha256Text(malformedText) }
        : entry,
    );
    await expectRejectedInput(malformedJson, "could not be parsed");

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
  }, 120_000);

  it("rejects parity-valid checkpoint-45 source-row and checkpoint-49 upstream forgeries", async () => {
    const sourceForgery = fixture();
    const branchSource = structuredClone(
      sourceForgery.branchSourceDurableReportInput,
    ) as XiaoNonErEquipmentBranchSourceSliceReport;
    const mutableBranchSource = branchSource as unknown as {
      occurrences: Array<{
        occurrenceId: string;
        sourceItem: { statIds: string[] };
      }>;
    };
    const circletRow = mutableBranchSource.occurrences.find(
      ({ occurrenceId }) => occurrenceId === CIRCLET_OCCURRENCE_ID,
    );
    if (!circletRow) throw new Error("Missing checkpoint-45 Circlet source row.");
    circletRow.sourceItem.statIds = ["cr"];
    replaceJsonInput(
      sourceForgery,
      "branchSourceDurableReportInput",
      BRANCH_SOURCE_REPORT_PATH,
      branchSource,
    );
    await expectRejectedInput(sourceForgery, "Checkpoint-49");

    const upstreamForgery = fixture();
    const upstream = structuredClone(
      upstreamForgery.fiveStarSourceGroupDurableReportInput,
    ) as XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport;
    Reflect.set(upstream.summary, "winnerCount", 1);
    replaceJsonInput(
      upstreamForgery,
      "fiveStarSourceGroupDurableReportInput",
      FIVE_STAR_GROUP_REPORT_PATH,
      upstream,
    );
    await expectRejectedInput(upstreamForgery, "Checkpoint-49");
  }, 120_000);

  it("rejects resealed runtime-numeric drift and serialized report tampering", async () => {
    const numericSourcePath = "src/data/game/artifact_stat.json";
    const numericTamper = fixture();
    const original = numericTamper.sourceFiles.find(
      ({ path: sourcePath }) => sourcePath === numericSourcePath,
    );
    if (!original) throw new Error("Missing authenticated artifact stat source.");
    const originalText = Buffer.from(original.bytesBase64, "base64").toString(
      "utf8",
    );
    const mutatedText = originalText.replace("0.311]", "0.312]");
    expect(mutatedText).not.toBe(originalText);
    numericTamper.sourceFiles = numericTamper.sourceFiles.map((entry) =>
      entry.path === numericSourcePath
        ? {
            ...entry,
            bytesBase64: Buffer.from(mutatedText).toString("base64"),
          }
        : entry,
    );
    numericTamper.generatedFrom = numericTamper.generatedFrom.map((entry) =>
      entry.path === numericSourcePath
        ? { ...entry, sha256: sha256Text(mutatedText) }
        : entry,
    );
    expect(
      await authenticateXiaoFfxxCircletSubstatLocalMarginalDiagnostic(
        durableReport,
        numericTamper,
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "canonical-inputs-rejected",
    });

    const serializedTamper = structuredClone(durableReport);
    serializedTamper.baselines[0].directTotalDamage += 1;
    expect(
      await authenticateXiaoFfxxCircletSubstatLocalMarginalDiagnostic(
        serializedTamper,
        fixture(),
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  }, 120_000);
});

function runtimeStaticModuleSpecifiers(sourceFile: ts.SourceFile): string[] {
  const moduleSpecifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !isTypeOnlyImportDeclaration(node)
    ) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      moduleSpecifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return moduleSpecifiers;
}

function isTypeOnlyImportDeclaration(
  declaration: ts.ImportDeclaration,
): boolean {
  const clause = declaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  if (!clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) {
    return false;
  }
  return clause.namedBindings.elements.every(({ isTypeOnly }) => isTypeOnly);
}

function resolveFirstPartyModulePath(
  importerPath: string,
  moduleSpecifier: string,
): string | null {
  const bareModuleSpecifier = moduleSpecifier.split("?", 1)[0];
  let basePath: string;
  if (bareModuleSpecifier.startsWith("@/")) {
    basePath = `src/${bareModuleSpecifier.slice(2)}`;
  } else if (bareModuleSpecifier.startsWith(".")) {
    basePath = path.posix.normalize(
      path.posix.join(path.posix.dirname(importerPath), bareModuleSpecifier),
    );
  } else {
    return null;
  }
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.json`,
    `${basePath}.json.gz`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ];
  const resolved = candidates.find((candidate) => {
    const absolutePath = path.join(REPOSITORY_ROOT, candidate);
    return existsSync(absolutePath) && statSync(absolutePath).isFile();
  });
  if (!resolved) {
    throw new Error(
      `Could not resolve first-party static import ${moduleSpecifier} from ${importerPath}.`,
    );
  }
  return resolved.replaceAll("\\", "/");
}

function expectedPlacementDomain(
  circletStat: "cr" | "cd",
  probeStat: "cr" | "cd" | "atk%",
): Array<"flower" | "plume" | "sands" | "goblet" | "circlet"> {
  return (["flower", "plume", "sands", "goblet", "circlet"] as const).filter(
    (slot) =>
      !(probeStat === "atk%" && slot === "sands") &&
      !(probeStat === circletStat && slot === "circlet"),
  );
}

async function loadFixture(): Promise<BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput> {
  const parsedEntries = await Promise.all(
    JSON_INPUTS.map(async ([key, relativePath]) => [
      key,
      await readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ]),
  );
  const [sourceFiles, generatedFrom] = await Promise.all([
    Promise.all(
      XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          bytesBase64: (
            await readFile(path.join(REPOSITORY_ROOT, relativePath))
          ).toString("base64"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  return {
    ...(Object.fromEntries(parsedEntries) as Omit<
      BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
      "sourceFiles" | "generatedFrom"
    >),
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput {
  return structuredClone(baseInput);
}

async function expectRejectedInput(
  input: BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
  expectedMessage: string,
): Promise<void> {
  const authentication =
    await authenticateXiaoFfxxCircletSubstatLocalMarginalDiagnostic(
      durableReport,
      input,
    );
  expect(authentication).toMatchObject({
    authenticated: false,
    reason: "canonical-inputs-rejected",
  });
  if (authentication.authenticated) {
    throw new Error("Expected rejected Xiao Circlet/substat diagnostic input.");
  }
  expect(authentication.issues.map(({ message }) => message).join(" ")).toContain(
    expectedMessage,
  );
}

function replaceJsonInput(
  input: BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
  key:
    | "branchSourceDurableReportInput"
    | "unitExpandedDurableReportInput"
    | "fiveStarSourceGroupDurableReportInput",
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

function wrapperFrameNumericIdentity(
  observation: XiaoFfxxWrapperFrameCritObservation,
): unknown {
  return {
    frame: observation.frame,
    critRate: observation.critRate,
    critDamage: observation.critDamage,
    critDamageToCritRateRatio: observation.critDamageToCritRateRatio,
    signedCritDamageMinusTwiceCritRate:
      observation.signedCritDamageMinusTwiceCritRate,
    absoluteDistanceToOneToTwo: observation.absoluteDistanceToOneToTwo,
  };
}
