import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StatKey } from "@/data/enums";
import { AVG_SUBSTAT_ROLL } from "@/lib/artifact/scoring/constants";
import {
  getMainStatValueAtLevel,
  toInternal,
} from "@/lib/artifact/scoring/utils";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { BuffActivationMap, TeamSlotConfig } from "@/lib/dmgcalc/types";
import {
  replayTeamDamage,
  type DamageReplayInput,
  type DamageReplayOutput,
  type ReplayCombo,
  type ReplayTeamConfigs,
} from "./computationReplay";
import { sha256Text, stableJson } from "./io";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";
import {
  authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic,
  compareXiaoFfxxFiveStarSourceGroupTotals,
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
  type BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput,
  type XiaoFfxxFiveStarSourceGroupComparisonOutcome,
  type XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
} from "./xiaoFfxxFiveStarSourceGroupValidationDiagnostic";
import { XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS } from "./xiaoFfxxGroupedReplayRepresentationPreflight";
import {
  authenticateXiaoFfxxNonErConditionFreeBranchCandidateContract,
  XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
  type BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput,
  type XiaoFfxxNonErConditionFreeBranchCandidate,
  type XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
} from "./xiaoFfxxNonErConditionFreeBranchCandidateContract";
import type { XiaoFfxxUnitExpandedExecutionGateReport } from "./xiaoFfxxUnitExpandedExecutionGate";
import {
  authenticateXiaoFormulaCountParityReport,
  XIAO_FORMULA_COUNT_PARITY_CODE_PATHS,
  XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS,
  type BuildXiaoFormulaCountParityInput,
  type XiaoFormulaCountParityReport,
} from "./xiaoFormulaCountParity";
import {
  authenticateXiaoNonErEquipmentBranchSourceSliceReport,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS,
  type BuildXiaoNonErEquipmentBranchSourceSliceInput,
  type XiaoNonErEquipmentBranchSourceSliceReport,
} from "./xiaoNonErEquipmentBranchSourceSlice";

const FACTORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-five-star-source-group-validation-diagnostic.json";
const CORE_PATH =
  "scripts/guide-factory/src/xiaoFfxxCircletSubstatLocalMarginalDiagnostic.ts";
const CLI_PATH =
  "scripts/guide-factory/src/assemble-xiao-ffxx-circlet-substat-local-marginal-diagnostic.ts";
const DIAGNOSTIC_ID =
  "guide-factory-xiao-ffxx-circlet-substat-local-marginal-diagnostic-version-5-5";
const EXPECTED_INPUT_PATH_COUNT = 127;
const EXPECTED_JSON_INPUT_COUNT = 15;
const EXPECTED_RECONSTRUCTION_CONTROL_COUNT = 6;
const EXPECTED_BASELINE_COUNT = 12;
const EXPECTED_PROBE_COUNT = 36;
const EXPECTED_REPLAY_COUNT = 54;
const EXPECTED_LATTICE_NODE_COUNT = 48;
const TEAM_ID = "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5";
const SOURCE_ONLY_VIEW_ID = "source-only-ffxx";
const EXCLUDED_C6_VIEW_ID = "exact-ffxx-plus-wrapper-c6";

const RANK_ONE_GROUP_ID = "xiao-ffxx:five-star-source-rank-group-1";
const RANK_TWO_GROUP_ID = "xiao-ffxx:five-star-source-rank-group-2";
const EXPECTED_RANK_ONE_CANDIDATE_IDS = [
  "guide-factory:xiao-ffxx:partial-non-er:lumidouce_elegy:mh-atk-anemo",
  "guide-factory:xiao-ffxx:partial-non-er:primordial_jade_wingedspear:mh-atk-anemo",
  "guide-factory:xiao-ffxx:partial-non-er:staff_of_homa:mh-atk-anemo",
] as const;
const EXPECTED_RANK_TWO_CANDIDATE_IDS = [
  "guide-factory:xiao-ffxx:partial-non-er:calamity_queller:mh-atk-anemo",
  "guide-factory:xiao-ffxx:partial-non-er:vortex_vanquisher:mh-atk-anemo",
] as const;
const EXPECTED_DEATHMATCH_CANDIDATE_ID =
  "guide-factory:xiao-ffxx:partial-non-er:deathmatch:mh-atk-anemo";

const CIRCLET_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.circlet[0].conditions";
const SUBSTAT_CRIT_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.substats[0].conditions";
const SUBSTAT_ATK_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.substats[1].conditions";
const CIRCLET_GUARD_TEXT =
  "Choose between CRIT Rate and CRIT DMG according to the weapon and artifact substats while maintaining at least 70% CRIT Rate.";
const OFFENSIVE_TAIL_GUARD_TEXT =
  "This priority covers only the offensive tail after the source's deliberately omitted Energy Recharge need.";
const CRIT_TARGET_TEXT =
  "At least 70% CRIT Rate, then further CRIT Rate and CRIT DMG balanced near a 1:2 ratio.";

const EXPECTED_GUARDED_SOURCE_ROWS = [
  {
    axis: "main-stat:circlet" as const,
    occurrenceId: CIRCLET_OCCURRENCE_ID,
    occurrenceSha256: "bad538418c24efa1730bbeeec106cb66bf1145b16e30803b51b517e2b3452fae",
    sourceItemSha256: "244d5a0d008854a6f0dbcf5318c60eab5dc411041cefafb49249f622a42f91c4",
    sourceGroupSha256: "38d7cbb5589c097539074cd00280075bcb3b8c99dab8141915ef108993e4c394",
    conditionsSha256: "59c5435ce1e2d05139f27284146e6b74dff31964e1b0521a1f8848fbd3914839",
    sourceConditionStatus: "guarded-unresolved" as const,
    conditionRole: "candidate-stat-dependent-circlet-selection" as const,
    statIds: ["cr", "cd"] as ["cr", "cd"],
    priority: null,
    target: null,
    conditionText: CIRCLET_GUARD_TEXT,
  },
  {
    axis: "substats" as const,
    occurrenceId: SUBSTAT_CRIT_OCCURRENCE_ID,
    occurrenceSha256: "9de89a000d9d041b5f0f569c784ee8bf991fe50523e947652c64e176043b6c22",
    sourceItemSha256: "f74f6a6eafb068d2f9603df83e866516be4f6c47294ca94806d1122dbe614e6b",
    sourceGroupSha256: "aa9082f99aa6af867b39968e911a144b69c9f5e1d2f43cc99e05df360e55381e",
    conditionsSha256: "668aeb631eaed5ff8f7a7a0e4547e7d428eb8b53aabaaa6b17ae1d450f9a9210",
    sourceConditionStatus: "guarded-unresolved" as const,
    conditionRole: "incomplete-offensive-tail-after-deferred-er" as const,
    statIds: ["cr", "cd"] as ["cr", "cd"],
    priority: 1 as const,
    target: CRIT_TARGET_TEXT,
    conditionText: OFFENSIVE_TAIL_GUARD_TEXT,
  },
  {
    axis: "substats" as const,
    occurrenceId: SUBSTAT_ATK_OCCURRENCE_ID,
    occurrenceSha256: "d43e6cd266d6fc2993c0575daad55fe53a4a2c7ac8bcebaa2369d265b8ae59b5",
    sourceItemSha256: "0374e51a3996ac146ae5b00ea4f0da7a22674b3e6e9ee7153903abe794f74fdf",
    sourceGroupSha256: "548b36f17cba456e7657e769808ddd7f1a6d1d3bc0a236a0385ff3b7a10a0b97",
    conditionsSha256: "668aeb631eaed5ff8f7a7a0e4547e7d428eb8b53aabaaa6b17ae1d450f9a9210",
    sourceConditionStatus: "guarded-unresolved" as const,
    conditionRole: "incomplete-offensive-tail-after-deferred-er" as const,
    statIds: ["atk%"] as ["atk%"],
    priority: 2 as const,
    target: null,
    conditionText: OFFENSIVE_TAIL_GUARD_TEXT,
  },
] as const;

const EXPECTED_CP49_COUNTEREXAMPLE_HOLDOUTS = [
  {
    comparisonId:
      "guide-factory:xiao-ffxx:partial-non-er:lumidouce_elegy:mh-atk-anemo::source-rank-1-v-2::guide-factory:xiao-ffxx:partial-non-er:calamity_queller:mh-atk-anemo",
    comparisonSha256: "36f90eb15823e77e001a1aaf0212e21dff5064052d1bd15a967f46d0da927d7d",
    outcome: "source-order-counterexample" as const,
  },
  {
    comparisonId:
      "guide-factory:xiao-ffxx:partial-non-er:lumidouce_elegy:mh-atk-anemo::source-rank-1-v-2::guide-factory:xiao-ffxx:partial-non-er:vortex_vanquisher:mh-atk-anemo",
    comparisonSha256: "0d1cfa58a09ddd598b7aaf21bbed20c38d70e3e6d0360f6e42d2d55abb4ba671",
    outcome: "source-order-counterexample" as const,
  },
  {
    comparisonId:
      "guide-factory:xiao-ffxx:partial-non-er:primordial_jade_wingedspear:mh-atk-anemo::source-rank-1-v-2::guide-factory:xiao-ffxx:partial-non-er:calamity_queller:mh-atk-anemo",
    comparisonSha256: "48bc2cf239d7c4599b79f5117b06c09231b42884b3a21b4710aeaaff9cd9c667",
    outcome: "source-order-counterexample" as const,
  },
  {
    comparisonId:
      "guide-factory:xiao-ffxx:partial-non-er:primordial_jade_wingedspear:mh-atk-anemo::source-rank-1-v-2::guide-factory:xiao-ffxx:partial-non-er:vortex_vanquisher:mh-atk-anemo",
    comparisonSha256: "518c6772f6b3522647ffc39a1997f565d47acbedf87c1c44e07d4c10ef670678",
    outcome: "source-order-counterexample" as const,
  },
] as const;

const JSON_INPUT_PATHS = {
  repositoryInput: "scripts/guide-factory/data/knowledge/repository.json",
  xiaoManualSnapshotInput:
    "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json",
  xiaoRotationFixtureSnapshotInput:
    "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json",
  genshinToolsSnapshotInput:
    "scripts/guide-factory/data/source-snapshots/genshintools-presets.json",
  manualIndexInput:
    "scripts/guide-factory/data/source-snapshots/manual-index.json",
  sourceRegistryInput: "scripts/guide-factory/sources/registry.json",
  xiaoSourceLocalDurableReportInput:
    "scripts/guide-factory/reports/xiao-source-local-condition-slice.json",
  applicableClaimDurableReportInput:
    "scripts/guide-factory/reports/xiao-ffxx-applicable-claim-projection-contract.json",
  partialCandidateDurableReportInput:
    "scripts/guide-factory/reports/xiao-ffxx-partial-artifact-candidate-contract.json",
  branchSourceDurableReportInput:
    "scripts/guide-factory/reports/xiao-non-er-equipment-branch-source-slice.json",
  branchCandidateDurableReportInput:
    "scripts/guide-factory/reports/xiao-ffxx-non-er-condition-free-branch-candidate-contract.json",
  formulaCountDurableReportInput:
    "scripts/guide-factory/reports/xiao-formula-count-parity.json",
  groupedReplayDurableReportInput:
    "scripts/guide-factory/reports/xiao-ffxx-grouped-replay-representation-preflight.json",
  unitExpandedDurableReportInput:
    "scripts/guide-factory/reports/xiao-ffxx-unit-expanded-execution-gate.json",
  fiveStarSourceGroupDurableReportInput: UPSTREAM_REPORT_RELATIVE_PATH,
} as const;

const COMBAT_OPTIONS = {
  deathmatch: "gte2",
  furina: "300",
  staff_of_homa: "below50",
  xianyun: "4",
  xiao: "3",
} as const;

const CIRCLET_ORDER = ["cr", "cd"] as const;
const PROBE_STAT_ORDER = ["cr", "cd", "atk%"] as const;
const ARTIFACT_SLOT_ORDER = [
  "flower",
  "plume",
  "sands",
  "goblet",
  "circlet",
] as const;

export const XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES = {
  cr: 0.311,
  cd: 0.622,
} as const;

export const XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES = {
  cr: 0.03305,
  cd: 0.06605,
  "atk%": 0.049550000000000004,
} as const;

const CAUTIONS = [
  "This is a wrapper-authored local sensitivity diagnostic for one authenticated Xiao FFXX calculator fixture, not a guide, optimization result, or source-applicability decision.",
  "The source Circlet and offensive-substat rows remain guarded-unresolved. Their values are admitted only as an experimental domain and are not selected or recommended.",
  "Each probe changes exactly one aggregate StatSheet entry by one current average five-star substat roll. A legal non-conflicting placement-slot domain is recorded, but no artifact slot, roll allocation, or feasible inventory is chosen.",
  "The CRIT observations are calculator-wrapper-frame snapshots. Distance from 1:2 is descriptive only; no threshold, tolerance, target satisfaction, or Circlet choice is inferred.",
  "The six no-Circlet replays are reconstruction controls for the private checkpoint-47 fixture builder. They are not fresh candidate comparisons.",
  "Energy Recharge, gameplay sequence optimization, buff-duration scheduling, and rotation feasibility remain deferred.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not select a Circlet, substat, weapon, winner, rank, ideal allocation, or guide recommendation from these local deltas.",
  "Do not compare different weapons after a perturbation, compare different Circlets across weapons, rank members within a source group, or compare Deathmatch against a five-star weapon.",
  "Do not treat the four checkpoint-49 counterexamples as an optimization objective or tune the fixture to erase them.",
  "Do not treat wrapper-frame CRIT distance as proof that the source guard is satisfied or violated.",
  "Do not publish these totals as rotation damage, DPS, gameplay truth, or Energy Recharge advice.",
] as const;

export interface XiaoFfxxCircletSubstatLocalMarginalDiagnosticSourceFile {
  path: string;
  bytesBase64: string;
}

export interface BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput {
  repositoryInput: unknown;
  xiaoManualSnapshotInput: unknown;
  xiaoRotationFixtureSnapshotInput: unknown;
  genshinToolsSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  xiaoSourceLocalDurableReportInput: unknown;
  applicableClaimDurableReportInput: unknown;
  partialCandidateDurableReportInput: unknown;
  branchSourceDurableReportInput: unknown;
  branchCandidateDurableReportInput: unknown;
  formulaCountDurableReportInput: unknown;
  groupedReplayDurableReportInput: unknown;
  unitExpandedDurableReportInput: unknown;
  fiveStarSourceGroupDurableReportInput: unknown;
  sourceFiles: readonly XiaoFfxxCircletSubstatLocalMarginalDiagnosticSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

type CircletStat = (typeof CIRCLET_ORDER)[number];
type ProbeStat = (typeof PROBE_STAT_ORDER)[number];
type ArtifactSlot = (typeof ARTIFACT_SLOT_ORDER)[number];

export interface XiaoFfxxWrapperFrameCritObservation {
  frame: "calculator-post-team-stats-xiao-on-field-before-line-specific-buff-overrides";
  critRate: number;
  critDamage: number;
  critDamageToCritRateRatio: number;
  signedCritDamageMinusTwiceCritRate: number;
  absoluteDistanceToOneToTwo: number;
  sourceGuardResolved: false;
  thresholdApplied: false;
  toleranceApplied: false;
  choiceProduced: false;
  observationSha256: string;
}

export interface XiaoFfxxXianyunActivationTrace {
  buffKey: string;
  perPlungeOccurrence: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0];
  activePlungeOccurrenceCount: 8;
  inactivePlungeOccurrenceCount: 3;
  totalActivation: 8;
  traceSha256: string;
}

export interface XiaoFfxxReconstructionControl {
  controlId: string;
  candidateId: string;
  candidateIdentitySha256: string;
  candidateProvenanceSha256: string;
  weaponId: string;
  refinement: 1 | 5;
  artifactFrame: "flower-plume-atk-sands-anemo-goblet-no-circlet-no-substats";
  upstreamCheckpoint48ObservationSha256: string;
  upstreamCheckpoint48TotalDamage: number;
  directTotalDamage: number;
  compiledTotalDamage: number;
  absoluteDifference: number;
  allowedDifference: number;
  exactUpstreamTotalReproduced: true;
  xianyunActivation: XiaoFfxxXianyunActivationTrace;
  exactUpstreamActivationTraceReproduced: true;
  latticeNode: false;
  comparisonExecuted: false;
  controlSha256: string;
}

export interface XiaoFfxxCircletBaseline {
  nodeId: string;
  candidateId: string;
  candidateIdentitySha256: string;
  candidateProvenanceSha256: string;
  weaponId: string;
  refinement: 1 | 5;
  circletStat: CircletStat;
  circletMainStatValue: number;
  sourceGuardResolved: false;
  sourceApplicabilityEstablished: false;
  experimentalAdmissionOnly: true;
  directTotalDamage: number;
  compiledTotalDamage: number;
  absoluteDifference: number;
  allowedDifference: number;
  xianyunActivation: XiaoFfxxXianyunActivationTrace;
  wrapperFrameCritObservation: XiaoFfxxWrapperFrameCritObservation;
  wrapperFrameCritNumericObservationSha256: string;
  factoryRank: null;
  winner: false;
  recommendation: false;
  nodeSha256: string;
}

export interface XiaoFfxxSubstatProbe {
  nodeId: string;
  baselineNodeId: string;
  candidateId: string;
  candidateIdentitySha256: string;
  candidateProvenanceSha256: string;
  weaponId: string;
  refinement: 1 | 5;
  circletStat: CircletStat;
  probeStat: ProbeStat;
  averageRollValue: number;
  averageRollValueOrigin: "current-AVG_SUBSTAT_ROLL-source-constant";
  nonConflictingPlacementSlotDomain: ArtifactSlot[];
  placementSlotChosen: null;
  placementSelectionExecuted: false;
  sourceGuardResolved: false;
  sourceApplicabilityEstablished: false;
  experimentalAdmissionOnly: true;
  directTotalDamage: number;
  compiledTotalDamage: number;
  absoluteDifference: number;
  allowedDifference: number;
  xianyunActivation: XiaoFfxxXianyunActivationTrace;
  wrapperFrameCritObservation: XiaoFfxxWrapperFrameCritObservation;
  wrapperFrameCritNumericObservationSha256: string;
  factoryRank: null;
  winner: false;
  recommendation: false;
  nodeSha256: string;
}

export interface XiaoFfxxLocalMarginal {
  marginalId: string;
  baselineNodeId: string;
  probeNodeId: string;
  candidateId: string;
  weaponId: string;
  circletStat: CircletStat;
  probeStat: ProbeStat;
  averageRollValue: number;
  baselineDirectTotalDamage: number;
  probeDirectTotalDamage: number;
  absoluteDamageDelta: number;
  relativeDamageDelta: number;
  localOneStepNeighborOnly: true;
  comparisonScope: "same-weapon-same-circlet-one-average-roll";
  winner: false;
  recommendation: false;
  marginalSha256: string;
}

export interface XiaoFfxxSameWeaponCircletDelta {
  comparisonId: string;
  candidateId: string;
  weaponId: string;
  critRateBaselineNodeId: string;
  critDamageBaselineNodeId: string;
  critRateCircletDirectTotalDamage: number;
  critDamageCircletDirectTotalDamage: number;
  critRateMinusCritDamage: number;
  comparisonScope: "same-weapon-unperturbed-cr-circlet-minus-cd-circlet";
  sourceGuardResolved: false;
  choiceProduced: false;
  preferredCirclet: null;
  winner: false;
  recommendation: false;
  comparisonSha256: string;
}

export interface XiaoFfxxSameCircletFiveStarCrossGroupComparison {
  comparisonId: string;
  circletStat: CircletStat;
  rankOneCandidateId: string;
  rankTwoCandidateId: string;
  rankOneBaselineNodeId: string;
  rankTwoBaselineNodeId: string;
  rankOneDirectTotalDamage: number;
  rankTwoDirectTotalDamage: number;
  rankOneMinusRankTwo: number;
  absoluteDifference: number;
  allowedDifference: number;
  outcome: XiaoFfxxFiveStarSourceGroupComparisonOutcome;
  validationTargetOnly: true;
  baselineOnly: true;
  sameCircletOnly: true;
  perturbedCrossWeaponComparison: false;
  withinGroupComparison: false;
  deathmatchComparison: false;
  factoryRank: null;
  winner: false;
  recommendation: false;
  comparisonSha256: string;
}

export interface XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport {
  schemaVersion: 1;
  reportType: "xiao-ffxx-circlet-substat-local-marginal-diagnostic";
  diagnosticId: typeof DIAGNOSTIC_ID;
  classification: "authenticated-wrapper-authored-experimental-local-marginal-diagnostic";
  validationStatus: "accepted-experimental-diagnostic-only";
  publicationStatus: "withheld-not-a-guide-optimizer-or-selection";
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true;
    combinedJsonInputByteAndParsedObjectParity: true;
    sourceFileCount: 127;
    generatedFromCount: 127;
    authenticatedJsonInputParityCount: 15;
    declaredInheritedRuntimePathCount: 80;
    declaredNewRuntimePathCount: 0;
    declaredRuntimePathsRemainInsideInheritedCheckpoint47Set: true;
  };
  upstreamBoundary: {
    durableReportPath: typeof UPSTREAM_REPORT_RELATIVE_PATH;
    durableReportFileSha256: string;
    durableReportCanonicalObjectSha256: string;
    freshlyAuthenticatedCheckpoint49: true;
    checkpoint49InputCount: 124;
    checkpoint49AdditionalReplayCount: 0;
    fullChainFreshlyAuthenticated: true;
    branchSourceFreshlyAuthenticated: true;
    branchCandidateFreshlyAuthenticated: true;
    formulaCountFreshlyAuthenticated: true;
    trustedCheckpoint48ObservationCount: 6;
  };
  sourceVsWrapperLedger: {
    sourceBoundary: {
      checkpoint45GuardedRowsPinnedExactly: true;
      guardedRowCount: 3;
      guardedRows: Array<(typeof EXPECTED_GUARDED_SOURCE_ROWS)[number]>;
      sourceGuardResolved: false;
      sourceApplicabilityEstablished: false;
      sourceCircletSelectionExecuted: false;
      sourceSubstatSelectionExecuted: false;
      sourceCompletePriorityPlan: false;
      sourceEnergyRecoveryNeedOmittedAndDeferred: true;
    };
    wrapperBoundary: {
      experimentalDomainOnly: true;
      guardedRowsConsumedAsRecommendations: false;
      unitExpandedLineOrderAuthoredByWrapper: true;
      teamInvestmentAndSupporterEquipmentAuthoredByWrapper: true;
      combatOptionsAuthoredByWrapper: true;
      artifactNumericMainStatsMaterializedByWrapper: true;
      averageRollNumericValuesReadFromRuntimeConstant: true;
      placementSlotChosen: false;
      thresholdOrToleranceInterpretationApplied: false;
      circletChoiceProduced: false;
      substatChoiceProduced: false;
    };
    sourceLedgerSha256: string;
    wrapperLedgerSha256: string;
  };
  experimentalDomain: {
    circletStats: ["cr", "cd"];
    circletMainStatValues: typeof XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES;
    probeStats: ["cr", "cd", "atk%"];
    averageRollValues: typeof XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES;
    mainStatValueOrigin: "level-20-five-star-getMainStatValueAtLevel-plus-toInternal";
    averageRollValueOrigin: "current-AVG_SUBSTAT_ROLL-source-constant";
    substatPlacementDomainRecorded: true;
    placementSlotChosen: false;
    sourceGuardResolved: false;
    sourceApplicabilityEstablished: false;
    domainSha256: string;
  };
  fixtureBoundary: {
    fixtureOrigin: "independent-checkpoint50-reconstruction-from-fresh-authenticated-cp46-candidates-and-cp42-calculator-default-team-assumptions-and-formula-counts";
    sourceOnlyViewId: typeof SOURCE_ONLY_VIEW_ID;
    excludedViewId: typeof EXCLUDED_C6_VIEW_ID;
    candidateCount: 6;
    comboRepresentation: "thirteen-unit-formula-lines";
    skillLineCount: 2;
    plungeLineCount: 11;
    allLineCountsOne: true;
    teamSize: 4;
    characterLevel: 90;
    constellation: 0;
    talentLevels: "10-10-10";
    baseArtifactMainStats: ["hp", "atk", "atk%", "anemo%"];
    combatOptions: typeof COMBAT_OPTIONS;
    calcContext: {
      enemyLevel: 110;
      enemyRes: 0.1;
      rollMultiplier: 0.85;
      substatBudget: "8_6";
    };
    inheritedArtifactRollMultiplierUnusedByExplicitSheets: true;
    inheritedSubstatBudgetUnusedByExplicitSheets: true;
    fixtureSha256: string;
  };
  operationBoundary: {
    checkpoint50ReplayCount: 54;
    reconstructionControlReplayCount: 6;
    latticeBaselineReplayCount: 12;
    latticeProbeReplayCount: 36;
    latticeNodeCount: 48;
    directPathEvaluationCount: 54;
    compiledPathEvaluationCount: 54;
    dualPathAgreementCount: 54;
    xianyunEightActiveThreeInactiveTraceCount: 54;
    localMarginalCount: 36;
    sameWeaponCircletDeltaCount: 6;
    sameCircletFiveStarCrossGroupComparisonCount: 12;
    mixedCircletCrossWeaponComparisonCount: 0;
    perturbedCrossWeaponComparisonCount: 0;
    withinGroupComparisonCount: 0;
    deathmatchPairComparisonCount: 0;
    allocationCount: 0;
  };
  reconstructionControls: XiaoFfxxReconstructionControl[];
  baselines: XiaoFfxxCircletBaseline[];
  probes: XiaoFfxxSubstatProbe[];
  localMarginals: XiaoFfxxLocalMarginal[];
  sameWeaponCircletDeltas: XiaoFfxxSameWeaponCircletDelta[];
  sameCircletFiveStarCrossGroupComparisons: XiaoFfxxSameCircletFiveStarCrossGroupComparison[];
  sameCircletCrossGroupOutcomeSummary: {
    validationTargetOnly: true;
    rankOrWinnerProduced: false;
    overall: {
      sourceOrderAlignedCount: 5;
      sourceOrderCounterexampleCount: 7;
      withinToleranceTieCount: 0;
    };
    byCirclet: {
      cr: {
        sourceOrderAlignedCount: 2;
        sourceOrderCounterexampleCount: 4;
        withinToleranceTieCount: 0;
      };
      cd: {
        sourceOrderAlignedCount: 3;
        sourceOrderCounterexampleCount: 3;
        withinToleranceTieCount: 0;
      };
    };
    outcomeSummarySha256: string;
  };
  immutableCp49CounterexampleHoldouts: {
    role: "immutable-upstream-validation-target-not-optimization-objective";
    consumedByObjective: false;
    exactHoldoutCount: 4;
    holdouts: Array<(typeof EXPECTED_CP49_COUNTEREXAMPLE_HOLDOUTS)[number]>;
    holdoutSetSha256: string;
  };
  identityBoundary: {
    upstreamCanonicalObjectSha256: string;
    sourceLedgerSha256: string;
    wrapperLedgerSha256: string;
    experimentalDomainSha256: string;
    fixtureSha256: string;
    reconstructionControlSetSha256: string;
    baselineNodeSetSha256: string;
    probeNodeSetSha256: string;
    localMarginalSetSha256: string;
    sameWeaponCircletDeltaSetSha256: string;
    sameCircletCrossGroupComparisonSetSha256: string;
    sameCircletCrossGroupOutcomeSummarySha256: string;
    holdoutSetSha256: string;
    aggregateDiagnosticSha256: string;
    technicalNodeIdentityExcludesCheckpoint50GuardResolutionAndClaimFields: true;
    sourceLedgerIdentityExcludesComputedTotals: true;
    sourceGroupMembershipAffectsOnlyProvenanceAndBaselineValidationPairs: true;
    permutationSemantics: "candidate-id-then-circlet-cr-cd-then-probe-cr-cd-atk-percent-serialization-is-not-rank";
    everyProbeIsOneBaselineOneRollNeighbor: true;
    candidateOrderPermutationCannotAlterNodeIdentity: true;
    circletOrderPermutationCannotAlterNodeIdentity: true;
    probeStatOrderPermutationCannotAlterNodeIdentity: true;
    candidateProvenanceExcludedFromTechnicalNodeIdentity: true;
  };
  summary: {
    authenticatedCandidateCount: 6;
    reconstructionControlCount: 6;
    baselineCount: 12;
    probeCount: 36;
    latticeNodeCount: 48;
    replayCount: 54;
    localMarginalCount: 36;
    sameWeaponCircletDeltaCount: 6;
    sameCircletFiveStarCrossGroupComparisonCount: 12;
    sameCircletSourceOrderAlignedCount: 5;
    sameCircletSourceOrderCounterexampleCount: 7;
    sameCircletWithinToleranceTieCount: 0;
    immutableUpstreamHoldoutCount: 4;
    sourceGuardResolvedCount: 0;
    sourceApplicabilityEstablishedRowCount: 0;
    selectedCircletCount: 0;
    selectedSubstatCount: 0;
    rankedCandidateCount: 0;
    winnerCount: 0;
    recommendationCount: 0;
    completeBuildCount: 0;
    idealRollAllocationCount: 0;
    energyRecoveryComputationCount: 0;
  };
  sourceGuardResolved: false;
  sourceApplicabilityEstablished: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsBuildRecommendations: false;
  supportsStatRecommendations: false;
  supportsCircletRecommendations: false;
  supportsSubstatRecommendations: false;
  supportsRankClaims: false;
  supportsWinnerClaims: false;
  supportsRecommendationClaims: false;
  supportsDamageClaims: false;
  supportsDamageComparisonClaims: false;
  supportsGameplayClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  sourceErrorClaimed: false;
  calculatorCorrectnessClaimed: false;
  computedCorrectionClaimed: false;
  recommendationClaimed: false;
  experimentalDomainAdmitted: true;
  reconstructionControlExecuted: true;
  localMarginalDiagnosticExecuted: true;
  sameWeaponCircletDeltaExecuted: true;
  sameCircletFiveStarCrossGroupValidationExecuted: true;
  circletSelectionExecuted: false;
  substatSelectionExecuted: false;
  placementSelectionExecuted: false;
  rankingExecuted: false;
  winnerSelectionExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  autoTuneExecuted: false;
  recommendationCompositionExecuted: false;
  idealRollAllocationExecuted: false;
  energyRecoveryInputsUsed: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
  issues: [];
}

export type XiaoFfxxCircletSubstatLocalMarginalDiagnosticAuthentication =
  | {
      authenticated: true;
      canonicalReport: XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      issues: Array<{ code: string; path: string; message: string }>;
    };

export const XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS = [
  ...new Set([
    ...XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
    UPSTREAM_REPORT_RELATIVE_PATH,
    CORE_PATH,
    CLI_PATH,
  ]),
].sort(compareText);

export const XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_SOURCE_FILE_PATHS = [
  ...XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
];

export const XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "xiao-ffxx-circlet-substat-local-marginal-diagnostic.json",
  );

export async function buildXiaoFfxxCircletSubstatLocalMarginalDiagnosticReport(
  input: BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
): Promise<XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport> {
  const raw = authenticateRawInputs(input);

  const upstreamAuthentication =
    await authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic(
      raw.upstreamReport,
      toCheckpoint49Input(input, raw),
    );
  if (!upstreamAuthentication.authenticated) {
    throw new Error(
      `Checkpoint-49 source-group diagnostic failed fresh authentication (${upstreamAuthentication.reason}).`,
    );
  }
  const upstream = upstreamAuthentication.canonicalReport;
  requireCheckpoint49Boundary(upstream);

  const branchSourceAuthentication =
    authenticateXiaoNonErEquipmentBranchSourceSliceReport(
      raw.branchSourceReport,
      toBranchSourceInput(raw),
    );
  if (!branchSourceAuthentication.authenticated) {
    throw new Error(
      `Checkpoint-45 branch source failed fresh authentication (${branchSourceAuthentication.reason}).`,
    );
  }
  const branchCandidateAuthentication =
    authenticateXiaoFfxxNonErConditionFreeBranchCandidateContract(
      raw.branchCandidateReport,
      toBranchCandidateInput(raw),
    );
  if (!branchCandidateAuthentication.authenticated) {
    throw new Error(
      `Checkpoint-46 branch candidates failed fresh authentication (${branchCandidateAuthentication.reason}).`,
    );
  }
  const formulaAuthentication = await authenticateXiaoFormulaCountParityReport(
    raw.formulaCountReport,
    toFormulaCountInput(raw),
  );
  if (!formulaAuthentication.authenticated) {
    throw new Error(
      `Checkpoint-42 formula-count witness failed fresh authentication (${formulaAuthentication.reason}).`,
    );
  }

  const branchSource = branchSourceAuthentication.canonicalReport;
  const branchCandidates = branchCandidateAuthentication.canonicalReport;
  const formulaCount = formulaAuthentication.canonicalReport;
  const sourceRows = requireExactGuardedSourceRows(branchSource);
  const candidates = requireCandidateBoundary(branchCandidates);
  requireFormulaBoundary(formulaCount);
  const trustedCheckpoint48 = requireTrustedCheckpoint48(raw, upstream, candidates);
  requireRuntimeMaterializationValues();

  const sourceBoundaryWithoutHash = {
    checkpoint45GuardedRowsPinnedExactly: true as const,
    guardedRowCount: 3 as const,
    guardedRows: sourceRows,
    sourceGuardResolved: false as const,
    sourceApplicabilityEstablished: false as const,
    sourceCircletSelectionExecuted: false as const,
    sourceSubstatSelectionExecuted: false as const,
    sourceCompletePriorityPlan: false as const,
    sourceEnergyRecoveryNeedOmittedAndDeferred: true as const,
  };
  const wrapperBoundaryWithoutHash = {
    experimentalDomainOnly: true as const,
    guardedRowsConsumedAsRecommendations: false as const,
    unitExpandedLineOrderAuthoredByWrapper: true as const,
    teamInvestmentAndSupporterEquipmentAuthoredByWrapper: true as const,
    combatOptionsAuthoredByWrapper: true as const,
    artifactNumericMainStatsMaterializedByWrapper: true as const,
    averageRollNumericValuesReadFromRuntimeConstant: true as const,
    placementSlotChosen: false as const,
    thresholdOrToleranceInterpretationApplied: false as const,
    circletChoiceProduced: false as const,
    substatChoiceProduced: false as const,
  };
  const sourceLedgerSha256 = hashValue(sourceBoundaryWithoutHash);
  const wrapperLedgerSha256 = hashValue(wrapperBoundaryWithoutHash);

  const experimentalDomainWithoutHash = {
    circletStats: [...CIRCLET_ORDER] as ["cr", "cd"],
    circletMainStatValues: { ...XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES },
    probeStats: [...PROBE_STAT_ORDER] as ["cr", "cd", "atk%"],
    averageRollValues: { ...XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES },
    mainStatValueOrigin:
      "level-20-five-star-getMainStatValueAtLevel-plus-toInternal" as const,
    averageRollValueOrigin:
      "current-AVG_SUBSTAT_ROLL-source-constant" as const,
    substatPlacementDomainRecorded: true as const,
    placementSlotChosen: false as const,
    sourceGuardResolved: false as const,
    sourceApplicabilityEstablished: false as const,
  };
  const experimentalDomainSha256 = hashValue(experimentalDomainWithoutHash);

  const combo = buildUnitExpandedCombo(formulaCount);
  const fixtureWithoutHash = buildFixtureBoundaryIdentity(
    candidates,
    formulaCount,
    combo,
  );
  const fixtureSha256 = hashValue(fixtureWithoutHash);

  const reconstructionControls: XiaoFfxxReconstructionControl[] = [];
  const baselines: XiaoFfxxCircletBaseline[] = [];
  const probes: XiaoFfxxSubstatProbe[] = [];
  const checkpoint48ByCandidateId = new Map(
    trustedCheckpoint48.observations.map((observation) => [
      observation.candidateId,
      observation,
    ]),
  );

  for (const candidate of candidates) {
    const upstreamObservation = checkpoint48ByCandidateId.get(
      candidate.candidateId,
    );
    if (!upstreamObservation) {
      throw new Error(
        `Checkpoint 48 lacks reconstruction target ${candidate.candidateId}.`,
      );
    }
    const controlEvaluation = await evaluateFixtureReplay({
      candidate,
      formulaCount,
      combo,
      circletStat: null,
      probeStat: null,
      replayKind: "reconstruction-control",
    });
    if (
      controlEvaluation.directTotalDamage !==
      upstreamObservation.normalizedExecution.unitExpandedDirectTotalDamage
    ) {
      throw new Error(
        `${candidate.candidateId} no-Circlet reconstruction total was not bit-exact: expected ${upstreamObservation.normalizedExecution.unitExpandedDirectTotalDamage}, got ${controlEvaluation.directTotalDamage}.`,
      );
    }
    if (
      stableJson(controlEvaluation.xianyunActivation.perPlungeOccurrence) !==
        stableJson(upstreamObservation.activationEvidence.perPlungeOccurrence) ||
      controlEvaluation.xianyunActivation.buffKey !==
        upstreamObservation.activationEvidence.buffKey ||
      controlEvaluation.xianyunActivation.totalActivation !==
        upstreamObservation.activationEvidence.totalActivation
    ) {
      throw new Error(
        `Checkpoint 50 did not reproduce checkpoint 48 activation evidence for ${candidate.candidateId}.`,
      );
    }
    const controlWithoutHash = {
      controlId: `${DIAGNOSTIC_ID}:control:${candidate.candidateId}`,
      candidateId: candidate.candidateId,
      candidateIdentitySha256: candidate.candidateIdentitySha256,
      candidateProvenanceSha256: candidate.candidateProvenanceSha256,
      weaponId: candidate.weaponId,
      refinement: refinementForCandidate(candidate),
      artifactFrame:
        "flower-plume-atk-sands-anemo-goblet-no-circlet-no-substats" as const,
      upstreamCheckpoint48ObservationSha256:
        upstreamObservation.observationSha256,
      upstreamCheckpoint48TotalDamage:
        upstreamObservation.normalizedExecution.unitExpandedDirectTotalDamage,
      directTotalDamage: controlEvaluation.directTotalDamage,
      compiledTotalDamage: controlEvaluation.compiledTotalDamage,
      absoluteDifference: controlEvaluation.absoluteDifference,
      allowedDifference: controlEvaluation.allowedDifference,
      exactUpstreamTotalReproduced: true as const,
      xianyunActivation: controlEvaluation.xianyunActivation,
      exactUpstreamActivationTraceReproduced: true as const,
      latticeNode: false as const,
      comparisonExecuted: false as const,
    };
    reconstructionControls.push({
      ...controlWithoutHash,
      controlSha256: hashValue(controlWithoutHash),
    });

    for (const circletStat of CIRCLET_ORDER) {
      const baselineEvaluation = await evaluateFixtureReplay({
        candidate,
        formulaCount,
        combo,
        circletStat,
        probeStat: null,
        replayKind: "baseline",
      });
      const baselineNodeId = technicalNodeId(
        candidate.candidateId,
        circletStat,
        null,
      );
      const baselineCritNumericSha256 =
        hashWrapperFrameCritNumericObservation(
          baselineEvaluation.wrapperFrameCritObservation,
        );
      const baselineTechnicalIdentity = {
        nodeId: baselineNodeId,
        candidateId: candidate.candidateId,
        candidateIdentitySha256: candidate.candidateIdentitySha256,
        weaponId: candidate.weaponId,
        refinement: refinementForCandidate(candidate),
        circletStat,
        circletMainStatValue: XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES[circletStat],
        fixtureSha256,
        directTotalDamage: baselineEvaluation.directTotalDamage,
        compiledTotalDamage: baselineEvaluation.compiledTotalDamage,
        xianyunActivationTraceSha256:
          baselineEvaluation.xianyunActivation.traceSha256,
        wrapperFrameCritNumericObservationSha256:
          baselineCritNumericSha256,
      };
      baselines.push({
        nodeId: baselineNodeId,
        candidateId: candidate.candidateId,
        candidateIdentitySha256: candidate.candidateIdentitySha256,
        candidateProvenanceSha256: candidate.candidateProvenanceSha256,
        weaponId: candidate.weaponId,
        refinement: refinementForCandidate(candidate),
        circletStat,
        circletMainStatValue: XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES[circletStat],
        sourceGuardResolved: false,
        sourceApplicabilityEstablished: false,
        experimentalAdmissionOnly: true,
        directTotalDamage: baselineEvaluation.directTotalDamage,
        compiledTotalDamage: baselineEvaluation.compiledTotalDamage,
        absoluteDifference: baselineEvaluation.absoluteDifference,
        allowedDifference: baselineEvaluation.allowedDifference,
        xianyunActivation: baselineEvaluation.xianyunActivation,
        wrapperFrameCritObservation:
          baselineEvaluation.wrapperFrameCritObservation,
        wrapperFrameCritNumericObservationSha256:
          baselineCritNumericSha256,
        factoryRank: null,
        winner: false,
        recommendation: false,
        nodeSha256: hashValue(baselineTechnicalIdentity),
      });

      for (const probeStat of PROBE_STAT_ORDER) {
        const probeEvaluation = await evaluateFixtureReplay({
          candidate,
          formulaCount,
          combo,
          circletStat,
          probeStat,
          replayKind: "one-average-roll-probe",
        });
        const probeNodeId = technicalNodeId(
          candidate.candidateId,
          circletStat,
          probeStat,
        );
        const placementDomain = nonConflictingPlacementDomain(
          circletStat,
          probeStat,
        );
        const probeCritNumericSha256 = hashWrapperFrameCritNumericObservation(
          probeEvaluation.wrapperFrameCritObservation,
        );
        const probeTechnicalIdentity = {
          nodeId: probeNodeId,
          baselineNodeId,
          candidateId: candidate.candidateId,
          candidateIdentitySha256: candidate.candidateIdentitySha256,
          weaponId: candidate.weaponId,
          refinement: refinementForCandidate(candidate),
          circletStat,
          probeStat,
          averageRollValue:
            XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES[probeStat],
          nonConflictingPlacementSlotDomain: placementDomain,
          placementSlotChosen: null,
          fixtureSha256,
          directTotalDamage: probeEvaluation.directTotalDamage,
          compiledTotalDamage: probeEvaluation.compiledTotalDamage,
          xianyunActivationTraceSha256:
            probeEvaluation.xianyunActivation.traceSha256,
          wrapperFrameCritNumericObservationSha256:
            probeCritNumericSha256,
        };
        probes.push({
          nodeId: probeNodeId,
          baselineNodeId,
          candidateId: candidate.candidateId,
          candidateIdentitySha256: candidate.candidateIdentitySha256,
          candidateProvenanceSha256: candidate.candidateProvenanceSha256,
          weaponId: candidate.weaponId,
          refinement: refinementForCandidate(candidate),
          circletStat,
          probeStat,
          averageRollValue:
            XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES[probeStat],
          averageRollValueOrigin: "current-AVG_SUBSTAT_ROLL-source-constant",
          nonConflictingPlacementSlotDomain: placementDomain,
          placementSlotChosen: null,
          placementSelectionExecuted: false,
          sourceGuardResolved: false,
          sourceApplicabilityEstablished: false,
          experimentalAdmissionOnly: true,
          directTotalDamage: probeEvaluation.directTotalDamage,
          compiledTotalDamage: probeEvaluation.compiledTotalDamage,
          absoluteDifference: probeEvaluation.absoluteDifference,
          allowedDifference: probeEvaluation.allowedDifference,
          xianyunActivation: probeEvaluation.xianyunActivation,
          wrapperFrameCritObservation:
            probeEvaluation.wrapperFrameCritObservation,
          wrapperFrameCritNumericObservationSha256:
            probeCritNumericSha256,
          factoryRank: null,
          winner: false,
          recommendation: false,
          nodeSha256: hashValue(probeTechnicalIdentity),
        });
      }
    }
  }

  requireExecutionCardinality(reconstructionControls, baselines, probes);
  const localMarginals = buildLocalMarginals(baselines, probes);
  const sameWeaponCircletDeltas = buildSameWeaponCircletDeltas(baselines);
  const sameCircletFiveStarCrossGroupComparisons =
    buildSameCircletFiveStarCrossGroupComparisons(baselines);
  const sameCircletCrossGroupOutcomeSummary =
    buildSameCircletCrossGroupOutcomeSummary(
      sameCircletFiveStarCrossGroupComparisons,
    );
  requireDerivedDiagnosticBoundary(
    localMarginals,
    sameWeaponCircletDeltas,
    sameCircletFiveStarCrossGroupComparisons,
  );

  const holdouts = EXPECTED_CP49_COUNTEREXAMPLE_HOLDOUTS.map((holdout) => ({
    ...holdout,
  }));
  const holdoutSetSha256 = hashValue(holdouts);
  const reconstructionControlSetSha256 = hashValue(
    reconstructionControls.map(({ controlSha256 }) => controlSha256),
  );
  const baselineNodeSetSha256 = hashValue(
    baselines.map(({ nodeSha256 }) => nodeSha256),
  );
  const probeNodeSetSha256 = hashValue(
    probes.map(({ nodeSha256 }) => nodeSha256),
  );
  const localMarginalSetSha256 = hashValue(
    localMarginals.map(({ marginalSha256 }) => marginalSha256),
  );
  const sameWeaponCircletDeltaSetSha256 = hashValue(
    sameWeaponCircletDeltas.map(({ comparisonSha256 }) => comparisonSha256),
  );
  const sameCircletCrossGroupComparisonSetSha256 = hashValue(
    sameCircletFiveStarCrossGroupComparisons.map(
      ({ comparisonSha256 }) => comparisonSha256,
    ),
  );
  const sameCircletCrossGroupOutcomeSummarySha256 =
    sameCircletCrossGroupOutcomeSummary.outcomeSummarySha256;
  const upstreamCanonicalObjectSha256 = hashValue(upstream);
  const aggregateDiagnosticSha256 = hashValue({
    upstreamCanonicalObjectSha256,
    sourceLedgerSha256,
    wrapperLedgerSha256,
    experimentalDomainSha256,
    fixtureSha256,
    reconstructionControlSetSha256,
    baselineNodeSetSha256,
    probeNodeSetSha256,
    localMarginalSetSha256,
    sameWeaponCircletDeltaSetSha256,
    sameCircletCrossGroupComparisonSetSha256,
    sameCircletCrossGroupOutcomeSummarySha256,
    holdoutSetSha256,
  });

  return {
    schemaVersion: 1,
    reportType: "xiao-ffxx-circlet-substat-local-marginal-diagnostic",
    diagnosticId: DIAGNOSTIC_ID,
    classification:
      "authenticated-wrapper-authored-experimental-local-marginal-diagnostic",
    validationStatus: "accepted-experimental-diagnostic-only",
    publicationStatus: "withheld-not-a-guide-optimizer-or-selection",
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
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
    },
    upstreamBoundary: {
      durableReportPath: UPSTREAM_REPORT_RELATIVE_PATH,
      durableReportFileSha256: sha256Bytes(
        requiredBytes(raw.sourceBytesByPath, UPSTREAM_REPORT_RELATIVE_PATH),
      ),
      durableReportCanonicalObjectSha256: upstreamCanonicalObjectSha256,
      freshlyAuthenticatedCheckpoint49: true,
      checkpoint49InputCount: 124,
      checkpoint49AdditionalReplayCount: 0,
      fullChainFreshlyAuthenticated: true,
      branchSourceFreshlyAuthenticated: true,
      branchCandidateFreshlyAuthenticated: true,
      formulaCountFreshlyAuthenticated: true,
      trustedCheckpoint48ObservationCount: 6,
    },
    sourceVsWrapperLedger: {
      sourceBoundary: sourceBoundaryWithoutHash,
      wrapperBoundary: wrapperBoundaryWithoutHash,
      sourceLedgerSha256,
      wrapperLedgerSha256,
    },
    experimentalDomain: {
      ...experimentalDomainWithoutHash,
      domainSha256: experimentalDomainSha256,
    },
    fixtureBoundary: {
      fixtureOrigin:
        "independent-checkpoint50-reconstruction-from-fresh-authenticated-cp46-candidates-and-cp42-calculator-default-team-assumptions-and-formula-counts",
      sourceOnlyViewId: SOURCE_ONLY_VIEW_ID,
      excludedViewId: EXCLUDED_C6_VIEW_ID,
      candidateCount: 6,
      comboRepresentation: "thirteen-unit-formula-lines",
      skillLineCount: 2,
      plungeLineCount: 11,
      allLineCountsOne: true,
      teamSize: 4,
      characterLevel: 90,
      constellation: 0,
      talentLevels: "10-10-10",
      baseArtifactMainStats: ["hp", "atk", "atk%", "anemo%"],
      combatOptions: { ...COMBAT_OPTIONS },
      calcContext: buildCalcContext(),
      inheritedArtifactRollMultiplierUnusedByExplicitSheets: true,
      inheritedSubstatBudgetUnusedByExplicitSheets: true,
      fixtureSha256,
    },
    operationBoundary: {
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
    },
    reconstructionControls,
    baselines,
    probes,
    localMarginals,
    sameWeaponCircletDeltas,
    sameCircletFiveStarCrossGroupComparisons,
    sameCircletCrossGroupOutcomeSummary,
    immutableCp49CounterexampleHoldouts: {
      role: "immutable-upstream-validation-target-not-optimization-objective",
      consumedByObjective: false,
      exactHoldoutCount: 4,
      holdouts,
      holdoutSetSha256,
    },
    identityBoundary: {
      upstreamCanonicalObjectSha256,
      sourceLedgerSha256,
      wrapperLedgerSha256,
      experimentalDomainSha256,
      fixtureSha256,
      reconstructionControlSetSha256,
      baselineNodeSetSha256,
      probeNodeSetSha256,
      localMarginalSetSha256,
      sameWeaponCircletDeltaSetSha256,
      sameCircletCrossGroupComparisonSetSha256,
      sameCircletCrossGroupOutcomeSummarySha256,
      holdoutSetSha256,
      aggregateDiagnosticSha256,
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
    },
    summary: {
      authenticatedCandidateCount: 6,
      reconstructionControlCount: 6,
      baselineCount: 12,
      probeCount: 36,
      latticeNodeCount: 48,
      replayCount: 54,
      localMarginalCount: 36,
      sameWeaponCircletDeltaCount: 6,
      sameCircletFiveStarCrossGroupComparisonCount: 12,
      sameCircletSourceOrderAlignedCount: 5,
      sameCircletSourceOrderCounterexampleCount: 7,
      sameCircletWithinToleranceTieCount: 0,
      immutableUpstreamHoldoutCount: 4,
      sourceGuardResolvedCount: 0,
      sourceApplicabilityEstablishedRowCount: 0,
      selectedCircletCount: 0,
      selectedSubstatCount: 0,
      rankedCandidateCount: 0,
      winnerCount: 0,
      recommendationCount: 0,
      completeBuildCount: 0,
      idealRollAllocationCount: 0,
      energyRecoveryComputationCount: 0,
    },
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
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    issues: [],
  };
}

export async function authenticateXiaoFfxxCircletSubstatLocalMarginalDiagnostic(
  serializedReport: XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport,
  input: BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
): Promise<XiaoFfxxCircletSubstatLocalMarginalDiagnosticAuthentication> {
  let canonicalReport: XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport;
  try {
    canonicalReport =
      await buildXiaoFfxxCircletSubstatLocalMarginalDiagnosticReport(input);
  } catch (error) {
    return {
      authenticated: false,
      reason: "canonical-inputs-rejected",
      issues: [
        {
          code: "xiao-ffxx-circlet-substat-local-marginal.canonical-input",
          path: "reports.xiao-ffxx-circlet-substat-local-marginal-diagnostic",
          message: errorMessage(error),
        },
      ],
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      issues: [
        {
          code: "xiao-ffxx-circlet-substat-local-marginal.serialized-report-mismatch",
          path: "reports.xiao-ffxx-circlet-substat-local-marginal-diagnostic",
          message:
            "Serialized local-marginal diagnostic does not match a fresh authenticated rebuild.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export async function requireAuthenticatedXiaoFfxxCircletSubstatLocalMarginalDiagnostic(
  report: XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport,
  input: BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
): Promise<void> {
  const authentication =
    await authenticateXiaoFfxxCircletSubstatLocalMarginalDiagnostic(
      report,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `Refusing an unauthenticated Xiao FFXX Circlet/substat local-marginal diagnostic (${authentication.reason}): ${authentication.issues
        .map(({ message }) => message)
        .join("; ")}`,
    );
  }
}

interface AuthenticatedRawInput {
  generatedFrom: GeneratedFromEntry[];
  sourceBytesByPath: Map<string, Buffer>;
  parsedByKey: Record<keyof typeof JSON_INPUT_PATHS, unknown>;
  upstreamReport: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport;
  branchSourceReport: XiaoNonErEquipmentBranchSourceSliceReport;
  branchCandidateReport: XiaoFfxxNonErConditionFreeBranchCandidateContractReport;
  formulaCountReport: XiaoFormulaCountParityReport;
  unitExpandedReport: XiaoFfxxUnitExpandedExecutionGateReport;
}

function authenticateRawInputs(
  input: BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
): AuthenticatedRawInput {
  const expectedPaths = [
    ...XIAO_FFXX_CIRCLET_SUBSTAT_LOCAL_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
  ];
  if (
    expectedPaths.length !== EXPECTED_INPUT_PATH_COUNT ||
    Object.keys(JSON_INPUT_PATHS).length !== EXPECTED_JSON_INPUT_COUNT ||
    XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS.length !== 80 ||
    XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS.some(
      (runtimePath) => !expectedPaths.includes(runtimePath),
    )
  ) {
    throw new Error(
      "Xiao Circlet/substat diagnostic declared path or JSON cardinality drifted from 127/15 with the inherited 80-path runtime set.",
    );
  }
  const sourceFiles = input.sourceFiles
    .map((entry) => ({
      path: normalizePath(entry.path),
      bytesBase64: entry.bytesBase64,
    }))
    .sort((left, right) => compareText(left.path, right.path));
  const generatedFrom = input.generatedFrom
    .map((entry) => ({
      path: normalizePath(entry.path),
      sha256: entry.sha256,
    }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    sourceFiles.length !== expectedPaths.length ||
    new Set(sourceFiles.map(({ path: sourcePath }) => sourcePath)).size !==
      expectedPaths.length ||
    stableJson(sourceFiles.map(({ path: sourcePath }) => sourcePath)) !==
      stableJson(expectedPaths)
  ) {
    throw new Error(
      "Xiao Circlet/substat diagnostic source-file path closure drifted.",
    );
  }
  if (
    generatedFrom.length !== expectedPaths.length ||
    new Set(generatedFrom.map(({ path: sourcePath }) => sourcePath)).size !==
      expectedPaths.length ||
    stableJson(generatedFrom.map(({ path: sourcePath }) => sourcePath)) !==
      stableJson(expectedPaths)
  ) {
    throw new Error(
      "Xiao Circlet/substat diagnostic generatedFrom path closure drifted.",
    );
  }

  const sourceBytesByPath = new Map<string, Buffer>();
  for (let index = 0; index < sourceFiles.length; index += 1) {
    const sourceFile = sourceFiles[index];
    const generated = generatedFrom[index];
    const bytes = decodeBase64(sourceFile.bytesBase64, sourceFile.path);
    if (
      generated.path !== sourceFile.path ||
      !/^[a-f0-9]{64}$/.test(generated.sha256) ||
      sha256Bytes(bytes) !== generated.sha256
    ) {
      throw new Error(
        `Xiao Circlet/substat diagnostic raw hash drifted for ${sourceFile.path}.`,
      );
    }
    sourceBytesByPath.set(sourceFile.path, bytes);
  }

  const parsedByKey = {} as Record<keyof typeof JSON_INPUT_PATHS, unknown>;
  for (const [key, sourcePath] of Object.entries(JSON_INPUT_PATHS) as Array<
    [keyof typeof JSON_INPUT_PATHS, string]
  >) {
    const bytes = requiredBytes(sourceBytesByPath, sourcePath);
    let parsedFromBytes: unknown;
    try {
      parsedFromBytes = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      throw new Error(
        `Xiao Circlet/substat diagnostic JSON input ${sourcePath} could not be parsed: ${errorMessage(error)}`,
      );
    }
    if (stableJson(parsedFromBytes) !== stableJson(input[key])) {
      throw new Error(
        `Xiao Circlet/substat diagnostic parsed input disagrees with bytes for ${sourcePath}.`,
      );
    }
    parsedByKey[key] = parsedFromBytes;
  }

  return {
    generatedFrom,
    sourceBytesByPath,
    parsedByKey,
    upstreamReport:
      parsedByKey.fiveStarSourceGroupDurableReportInput as XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
    branchSourceReport:
      parsedByKey.branchSourceDurableReportInput as XiaoNonErEquipmentBranchSourceSliceReport,
    branchCandidateReport:
      parsedByKey.branchCandidateDurableReportInput as XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
    formulaCountReport:
      parsedByKey.formulaCountDurableReportInput as XiaoFormulaCountParityReport,
    unitExpandedReport:
      parsedByKey.unitExpandedDurableReportInput as XiaoFfxxUnitExpandedExecutionGateReport,
  };
}

function toCheckpoint49Input(
  input: BuildXiaoFfxxCircletSubstatLocalMarginalDiagnosticInput,
  raw: AuthenticatedRawInput,
): BuildXiaoFfxxFiveStarSourceGroupValidationDiagnosticInput {
  const paths = new Set(
    XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
  );
  const parsed = raw.parsedByKey;
  return {
    repositoryInput: parsed.repositoryInput,
    xiaoManualSnapshotInput: parsed.xiaoManualSnapshotInput,
    xiaoRotationFixtureSnapshotInput:
      parsed.xiaoRotationFixtureSnapshotInput,
    genshinToolsSnapshotInput: parsed.genshinToolsSnapshotInput,
    manualIndexInput: parsed.manualIndexInput,
    sourceRegistryInput: parsed.sourceRegistryInput,
    xiaoSourceLocalDurableReportInput:
      parsed.xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput:
      parsed.applicableClaimDurableReportInput,
    partialCandidateDurableReportInput:
      parsed.partialCandidateDurableReportInput,
    branchSourceDurableReportInput: parsed.branchSourceDurableReportInput,
    branchCandidateDurableReportInput:
      parsed.branchCandidateDurableReportInput,
    formulaCountDurableReportInput: parsed.formulaCountDurableReportInput,
    groupedReplayDurableReportInput:
      parsed.groupedReplayDurableReportInput,
    unitExpandedDurableReportInput: parsed.unitExpandedDurableReportInput,
    sourceFiles: input.sourceFiles.filter(({ path: sourcePath }) =>
      paths.has(normalizePath(sourcePath)),
    ),
    generatedFrom: input.generatedFrom.filter(({ path: sourcePath }) =>
      paths.has(normalizePath(sourcePath)),
    ),
  };
}

function toBranchSourceInput(
  raw: AuthenticatedRawInput,
): BuildXiaoNonErEquipmentBranchSourceSliceInput {
  const parsed = raw.parsedByKey;
  return {
    repositoryInput: parsed.repositoryInput,
    manualSnapshotInput: parsed.xiaoManualSnapshotInput,
    manualIndexInput: parsed.manualIndexInput,
    sourceRegistryInput: parsed.sourceRegistryInput,
    xiaoSourceLocalDurableReportInput:
      parsed.xiaoSourceLocalDurableReportInput,
    sourceFiles: subsetTextSourceFiles(
      raw.sourceBytesByPath,
      XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS,
    ),
    generatedFrom: subsetGeneratedFrom(
      raw.generatedFrom,
      XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS,
    ),
  };
}

function toBranchCandidateInput(
  raw: AuthenticatedRawInput,
): BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput {
  const parsed = raw.parsedByKey;
  return {
    repositoryInput: parsed.repositoryInput,
    manualSnapshotInput: parsed.xiaoManualSnapshotInput,
    manualIndexInput: parsed.manualIndexInput,
    sourceRegistryInput: parsed.sourceRegistryInput,
    xiaoSourceLocalDurableReportInput:
      parsed.xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput:
      parsed.applicableClaimDurableReportInput,
    partialCandidateDurableReportInput:
      parsed.partialCandidateDurableReportInput,
    branchSourceDurableReportInput: parsed.branchSourceDurableReportInput,
    sourceFiles: subsetTextSourceFiles(
      raw.sourceBytesByPath,
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
    ),
    generatedFrom: subsetGeneratedFrom(
      raw.generatedFrom,
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
    ),
  };
}

function toFormulaCountInput(
  raw: AuthenticatedRawInput,
): BuildXiaoFormulaCountParityInput {
  const parsed = raw.parsedByKey;
  return {
    repositoryInput: parsed.repositoryInput,
    manualFixtureSnapshotInput: parsed.xiaoRotationFixtureSnapshotInput,
    genshinToolsSnapshotInput: parsed.genshinToolsSnapshotInput,
    manualIndexInput: parsed.manualIndexInput,
    sourceRegistryInput: parsed.sourceRegistryInput,
    sourceFiles: subsetTextSourceFiles(
      raw.sourceBytesByPath,
      XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS,
    ),
    generatedFrom: subsetGeneratedFrom(
      raw.generatedFrom,
      XIAO_FORMULA_COUNT_PARITY_CODE_PATHS,
    ),
  };
}

function subsetTextSourceFiles(
  sourceBytesByPath: ReadonlyMap<string, Buffer>,
  paths: readonly string[],
): Array<{ path: string; text: string }> {
  return paths.map((sourcePath) => ({
    path: sourcePath,
    text: requiredBytes(sourceBytesByPath, sourcePath).toString("utf8"),
  }));
}

function subsetGeneratedFrom(
  generatedFrom: readonly GeneratedFromEntry[],
  paths: readonly string[],
): GeneratedFromEntry[] {
  const byPath = new Map(
    generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  return paths.map((sourcePath) => {
    const entry = byPath.get(sourcePath);
    if (!entry) throw new Error(`Missing generatedFrom entry ${sourcePath}.`);
    return { ...entry };
  });
}

function requireCheckpoint49Boundary(
  report: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
): void {
  const counterexamples = report.comparisons
    .filter(({ sourceOrderCounterexample }) => sourceOrderCounterexample)
    .map(({ comparisonId, comparisonSha256, outcome }) => ({
      comparisonId,
      comparisonSha256,
      outcome,
    }));
  const sourceGroups = report.sourceTargetBoundary.groups.map(
    ({
      branchGroupId,
      candidateIds,
      sourceRankGroup,
      sourceOrdering,
      sourceGroupSha256,
      sourceOccurrenceId,
      membersTied,
      membersTiedMeansSourceCoMembershipOnly,
      withinGroupNumericEqualityAsserted,
      withinGroupRankingProduced,
    }) => ({
      branchGroupId,
      candidateIds,
      sourceRankGroup,
      sourceOrdering,
      sourceGroupSha256,
      sourceOccurrenceId,
      membersTied,
      membersTiedMeansSourceCoMembershipOnly,
      withinGroupNumericEqualityAsserted,
      withinGroupRankingProduced,
    }),
  );
  const deathmatchExclusion = report.sourceTargetBoundary.deathmatchExclusion;
  if (
    report.validationStatus !== "accepted-as-validation-target-only" ||
    report.diagnosticStatus !==
      "counterexamples-observed-validation-target-only" ||
    report.rawInputBoundary.sourceFileCount !== 124 ||
    report.rawInputBoundary.authenticatedJsonInputParityCount !== 14 ||
    report.upstreamBoundary.checkpoint49AdditionalReplayCount !== 0 ||
    report.summary.authenticatedCandidateCount !== 6 ||
    report.summary.sourceOrderCounterexamplePairCount !== 4 ||
    report.summary.sourceOrderAlignedPairCount !== 2 ||
    report.summary.withinToleranceTiePairCount !== 0 ||
    report.summary.rankedCandidateCount !== 0 ||
    report.summary.winnerCount !== 0 ||
    report.summary.recommendationCount !== 0 ||
    report.circletSelectionExecuted ||
    report.substatSelectionExecuted ||
    report.rankingExecuted ||
    report.winnerSelectionExecuted ||
    report.generatorExecuted ||
    report.optimizerExecuted ||
    report.autoTuneExecuted ||
    report.idealRollAllocationExecuted ||
    report.energyRecoveryComputationExecuted ||
    report.supportsGuideClaims ||
    report.supportsRankClaims ||
    report.supportsRecommendationClaims ||
    report.sourceTargetBoundary.sourceGroupCount !== 2 ||
    report.sourceTargetBoundary.sourceMembershipEdgeCount !== 5 ||
    report.sourceTargetBoundary.expectedCrossGroupPairCount !== 6 ||
    report.sourceTargetBoundary.expectedRelation !==
      "every-rank-one-member-above-every-rank-two-member" ||
    report.sourceTargetBoundary.targetKind !==
      "source-authored-five-star-rank-group-ordering" ||
    !report.sourceTargetBoundary.validationTargetOnly ||
    stableJson(sourceGroups) !==
      stableJson([
        {
          branchGroupId: RANK_ONE_GROUP_ID,
          candidateIds: EXPECTED_RANK_ONE_CANDIDATE_IDS,
          sourceRankGroup: 1,
          sourceOrdering: "ranked-groups",
          sourceGroupSha256:
            "65247f1953443f32c5341dc6ed807809fafdd157eae942372e4102e41949850e",
          sourceOccurrenceId:
            "kqm:character_guide:xiao-five-star-weapon-tiers-version-5-5:recommendation.weaponRecommendations[0].conditions",
          membersTied: true,
          membersTiedMeansSourceCoMembershipOnly: true,
          withinGroupNumericEqualityAsserted: false,
          withinGroupRankingProduced: false,
        },
        {
          branchGroupId: RANK_TWO_GROUP_ID,
          candidateIds: EXPECTED_RANK_TWO_CANDIDATE_IDS,
          sourceRankGroup: 2,
          sourceOrdering: "ranked-groups",
          sourceGroupSha256:
            "f34ab041b934495bc413e3770b0c29113e04c5772f3d609f5202430711b7bb04",
          sourceOccurrenceId:
            "kqm:character_guide:xiao-five-star-weapon-tiers-version-5-5:recommendation.weaponRecommendations[1].conditions",
          membersTied: true,
          membersTiedMeansSourceCoMembershipOnly: true,
          withinGroupNumericEqualityAsserted: false,
          withinGroupRankingProduced: false,
        },
      ]) ||
    stableJson({
      branchGroupId: deathmatchExclusion.branchGroupId,
      candidateId: deathmatchExclusion.candidateId,
      sourceRankGroup: deathmatchExclusion.sourceRankGroup,
      sourceOrdering: deathmatchExclusion.sourceOrdering,
      authenticatedTechnicalObservation:
        deathmatchExclusion.authenticatedTechnicalObservation,
      excludedFromFiveStarGroups:
        deathmatchExclusion.excludedFromFiveStarGroups,
      excludedFromAllPairs: deathmatchExclusion.excludedFromAllPairs,
      crossRarityComparisonExecuted:
        deathmatchExclusion.crossRarityComparisonExecuted,
      relativePosition: deathmatchExclusion.relativePosition,
      factoryRank: deathmatchExclusion.factoryRank,
    }) !==
      stableJson({
        branchGroupId: "xiao-ffxx:four-star-unranked-deathmatch",
        candidateId: EXPECTED_DEATHMATCH_CANDIDATE_ID,
        sourceRankGroup: null,
        sourceOrdering: "unranked",
        authenticatedTechnicalObservation: true,
        excludedFromFiveStarGroups: true,
        excludedFromAllPairs: true,
        crossRarityComparisonExecuted: false,
        relativePosition: null,
        factoryRank: null,
      }) ||
    stableJson(counterexamples) !==
      stableJson(EXPECTED_CP49_COUNTEREXAMPLE_HOLDOUTS)
  ) {
    throw new Error(
      "Checkpoint 49 no longer exposes the exact bounded 2/4/0 validation target and immutable four-counterexample holdout.",
    );
  }
}

function requireExactGuardedSourceRows(
  report: XiaoNonErEquipmentBranchSourceSliceReport,
): Array<(typeof EXPECTED_GUARDED_SOURCE_ROWS)[number]> {
  const circletGroup = report.mainStatChoiceGroups.find(
    ({ slot }) => slot === "circlet",
  );
  const priorityByOccurrence = new Map(
    report.guardedOffensiveTailPriorities.map((row) => [
      row.occurrenceId,
      row,
    ]),
  );
  const occurrenceById = new Map(
    report.occurrences.map((row) => [row.occurrenceId, row]),
  );
  for (const expected of EXPECTED_GUARDED_SOURCE_ROWS) {
    const occurrence = occurrenceById.get(expected.occurrenceId);
    if (
      !occurrence ||
      occurrence.axis !== expected.axis ||
      occurrence.occurrenceSha256 !== expected.occurrenceSha256 ||
      occurrence.sourceItemSha256 !== expected.sourceItemSha256 ||
      occurrence.conditionsSha256 !== expected.conditionsSha256 ||
      occurrence.conditionRole !== expected.conditionRole ||
      occurrence.sourceConditionStatus !== "guarded-unresolved" ||
      stableJson(occurrence.conditions) !==
        stableJson([expected.conditionText])
    ) {
      throw new Error(
        `Checkpoint 45 guarded source occurrence drifted for ${expected.occurrenceId}.`,
      );
    }
    if (expected.axis === "main-stat:circlet") {
      if (
        !circletGroup ||
        circletGroup.occurrenceId !== expected.occurrenceId ||
        circletGroup.sourceGroupSha256 !== expected.sourceGroupSha256 ||
        circletGroup.sourceConditionStatus !== "guarded-unresolved" ||
        circletGroup.selectionExecuted ||
        stableJson(circletGroup.statIds) !== stableJson(expected.statIds)
      ) {
        throw new Error("Checkpoint 45 guarded Circlet group drifted.");
      }
    } else {
      const priority = priorityByOccurrence.get(expected.occurrenceId);
      if (
        !priority ||
        priority.sourceGroupSha256 !== expected.sourceGroupSha256 ||
        priority.conditionsSha256 !== expected.conditionsSha256 ||
        priority.sourceConditionStatus !== "guarded-unresolved" ||
        priority.completePriorityPlan ||
        priority.priority !== expected.priority ||
        priority.target !== expected.target ||
        stableJson(priority.statIds) !== stableJson(expected.statIds)
      ) {
        throw new Error(
          `Checkpoint 45 guarded substat priority drifted for ${expected.occurrenceId}.`,
        );
      }
    }
  }
  if (
    report.completenessBoundary.circletSelection !== "guarded-not-executed" ||
    report.completenessBoundary.substatPlan !==
      "guarded-incomplete-offensive-tail" ||
    report.completenessBoundary.energyRecovery !== "excluded-deferred" ||
    report.supportsStatRecommendations ||
    report.supportsEnergyRecoveryClaims ||
    report.choiceSelectionExecuted ||
    report.idealRollAllocationExecuted
  ) {
    throw new Error(
      "Checkpoint 45 guarded Circlet/substat completeness boundary drifted.",
    );
  }
  return EXPECTED_GUARDED_SOURCE_ROWS.map((row) => structuredClone(row));
}

function requireCandidateBoundary(
  report: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
): XiaoFfxxNonErConditionFreeBranchCandidate[] {
  const candidates = report.candidates
    .map((candidate) => structuredClone(candidate))
    .sort((left, right) => compareText(left.candidateId, right.candidateId));
  const expectedIds = [
    ...EXPECTED_RANK_ONE_CANDIDATE_IDS,
    ...EXPECTED_RANK_TWO_CANDIDATE_IDS,
    EXPECTED_DEATHMATCH_CANDIDATE_ID,
  ].sort(compareText);
  if (
    report.comparisonStatus !== "comparable" ||
    candidates.length !== 6 ||
    new Set(candidates.map(({ candidateId }) => candidateId)).size !== 6 ||
    stableJson(candidates.map(({ candidateId }) => candidateId)) !==
      stableJson(expectedIds) ||
    candidates.some(
      (candidate) =>
        candidate.completionStatus !== "partial" ||
        candidate.materializableAsGuideBuildRecommendation ||
        candidate.runtimeArtifactGenerationCandidate ||
        candidate.jointPayloadCompatibility !== "not-evaluated" ||
        stableJson(candidate.presentAxisIds) !==
          stableJson([
            "weapon",
            "artifact-set",
            "main-stat:sands",
            "main-stat:goblet",
          ]) ||
        stableJson(candidate.missingAxisIds) !==
          stableJson(["main-stat:circlet", "substats"]) ||
        candidate.factoryRank != null ||
        candidate.crossRarityRank != null,
    ) ||
    report.withheldGuardedDomain.circletLeafCount !== 2 ||
    report.withheldGuardedDomain.substatLeafCount !== 3 ||
    report.withheldGuardedDomain.candidateCountFromGuardedRows !== 0 ||
    report.summary.guideFactoryRecommendationCount !== 0 ||
    report.supportsGuideClaims ||
    report.supportsDerivedRankClaims ||
    report.supportsEnergyRecoveryClaims
  ) {
    throw new Error(
      "Checkpoint 46 no longer exposes the exact six partial, condition-free weapon candidates with guarded Circlet/substats missing.",
    );
  }
  return candidates;
}

function requireFormulaBoundary(report: XiaoFormulaCountParityReport): void {
  const xiaoLines = report.calculatorDefaultDraft.lines
    .filter(({ characterId }) => characterId === "xiao")
    .map(({ characterId, formulaId, count }) => ({
      characterId,
      formulaId,
      count,
    }));
  if (
    report.comparisonStatus !== "comparable" ||
    report.calculatorDefaultDraft.assumptions.characters.length !== 4 ||
    stableJson(
      report.calculatorDefaultDraft.assumptions.characters.map(
        ({ characterId }) => characterId,
      ),
    ) !== stableJson(["xiao", "xianyun", "furina", "faruzan"]) ||
    stableJson(xiaoLines) !==
      stableJson([
        { characterId: "xiao", formulaId: "xiao-plunge-high", count: 11 },
        { characterId: "xiao", formulaId: "xiao-skill", count: 2 },
      ]) ||
    report.formulaDamageEvaluationExecuted ||
    report.damageComputationExecuted ||
    report.optimizerExecuted ||
    report.generatorExecuted ||
    report.energyRecoveryComputationExecuted ||
    report.supportsGuideClaims ||
    report.supportsRotationClaims ||
    report.supportsDamageClaims
  ) {
    throw new Error(
      "Checkpoint 42 formula-count witness lost the exact calculator-default Xiao 2-Skill/11-plunge boundary.",
    );
  }
}

function requireTrustedCheckpoint48(
  raw: AuthenticatedRawInput,
  upstream: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
  candidates: readonly XiaoFfxxNonErConditionFreeBranchCandidate[],
): XiaoFfxxUnitExpandedExecutionGateReport {
  const report = raw.unitExpandedReport;
  const candidateIds = candidates.map(({ candidateId }) => candidateId);
  const observationIds = report.observations.map(({ candidateId }) => candidateId);
  if (
    hashValue(report) !== upstream.identityBoundary.upstreamCanonicalObjectSha256 ||
    sha256Bytes(
      requiredBytes(raw.sourceBytesByPath, JSON_INPUT_PATHS.unitExpandedDurableReportInput),
    ) !== upstream.upstreamBoundary.durableReportFileSha256 ||
    report.validationStatus !== "accepted" ||
    report.comparisonExecutionStatus !== "not-performed" ||
    report.observations.length !== 6 ||
    stableJson(observationIds) !== stableJson(candidateIds) ||
    report.observations.some(
      (observation) =>
        !observation.technicalObservationEligible ||
        observation.comparisonEligible ||
        observation.executedViewId !== SOURCE_ONLY_VIEW_ID ||
        observation.factoryRank != null ||
        observation.winner ||
        observation.recommendation ||
        !observation.normalizedExecution.dualPathAgreement ||
        observation.activationEvidence.totalActivation !== 8 ||
        stableJson(observation.activationEvidence.perPlungeOccurrence) !==
          stableJson([1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]),
    )
  ) {
    throw new Error(
      "Checkpoint 48 no longer provides the exact six authenticated no-Circlet reproduction targets transitively bound by checkpoint 49.",
    );
  }
  return report;
}

function requireRuntimeMaterializationValues(): void {
  const cr = toInternal("cr", getMainStatValueAtLevel("cr", 5, 20));
  const cd = toInternal("cd", getMainStatValueAtLevel("cd", 5, 20));
  if (
    cr !== XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES.cr ||
    cd !== XIAO_FFXX_CIRCLET_MAIN_STAT_VALUES.cd ||
    AVG_SUBSTAT_ROLL.cr !==
      XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES.cr ||
    AVG_SUBSTAT_ROLL.cd !==
      XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES.cd ||
    AVG_SUBSTAT_ROLL["atk%"] !==
      XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES["atk%"]
  ) {
    throw new Error(
      "Current level-20 five-star Circlet or AVG_SUBSTAT_ROLL values drifted from the exact checkpoint-50 experimental domain.",
    );
  }
}

interface FixtureReplayEvaluation {
  directTotalDamage: number;
  compiledTotalDamage: number;
  absoluteDifference: number;
  allowedDifference: number;
  xianyunActivation: XiaoFfxxXianyunActivationTrace;
  wrapperFrameCritObservation: XiaoFfxxWrapperFrameCritObservation;
}

async function evaluateFixtureReplay(input: {
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate;
  formulaCount: XiaoFormulaCountParityReport;
  combo: ReplayCombo;
  circletStat: CircletStat | null;
  probeStat: ProbeStat | null;
  replayKind:
    | "reconstruction-control"
    | "baseline"
    | "one-average-roll-probe";
}): Promise<FixtureReplayEvaluation> {
  if (
    (input.replayKind === "reconstruction-control" &&
      (input.circletStat != null || input.probeStat != null)) ||
    (input.replayKind === "baseline" &&
      (input.circletStat == null || input.probeStat != null)) ||
    (input.replayKind === "one-average-roll-probe" &&
      (input.circletStat == null || input.probeStat == null))
  ) {
    throw new Error("Checkpoint 50 replay kind and artifact perturbation disagree.");
  }
  const teamConfigs = buildTeamConfigs(
    input.candidate,
    input.formulaCount,
    refinementForCandidate(input.candidate),
  );
  const artifactSheets = buildArtifactSheets(
    input.circletStat,
    input.probeStat,
  );
  const replayInput = buildReplayInput({
    candidate: input.candidate,
    combo: input.combo,
    teamConfigs,
    artifactSheets,
    circletStat: input.circletStat,
    probeStat: input.probeStat,
    replayKind: input.replayKind,
  });
  const replay = await replayTeamDamage(replayInput);
  requireReplayBoundary(replay, input.combo);
  const xianyunActivation = extractXianyunActivationTrace(
    replay.validation.computedBuffOverrides,
  );
  const wrapperFrameCritObservation = buildWrapperFrameCritObservation(
    teamConfigs,
    artifactSheets,
  );
  return {
    directTotalDamage:
      replay.validation.calculatorAgreement.directTotalDamage,
    compiledTotalDamage:
      replay.validation.calculatorAgreement.compiledTotalDamage,
    absoluteDifference:
      replay.validation.calculatorAgreement.absoluteDifference,
    allowedDifference: replay.validation.calculatorAgreement.allowedDifference,
    xianyunActivation,
    wrapperFrameCritObservation,
  };
}

function buildReplayInput(input: {
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate;
  combo: ReplayCombo;
  teamConfigs: ReplayTeamConfigs;
  artifactSheets: Record<string, StatSheet>;
  circletStat: CircletStat | null;
  probeStat: ProbeStat | null;
  replayKind:
    | "reconstruction-control"
    | "baseline"
    | "one-average-roll-probe";
}): DamageReplayInput {
  return {
    replayId: [
      DIAGNOSTIC_ID,
      input.replayKind,
      input.candidate.weaponId,
      input.circletStat ?? "no-circlet",
      input.probeStat ?? "no-probe",
    ].join(":"),
    evidence: {
      classification: "authored_validation_target",
      supportsGuideClaims: false,
      notes: [
        "This replay is a checkpoint-50 wrapper-authored reconstruction control or one-step experimental local-marginal node.",
        "The KQM Circlet and substat rows remain guarded-unresolved and supply only an experimental value domain, not applicability or a recommendation.",
        "The GenshinTools reference authenticates roster equality only. Team investment, supporter equipment, combat options, explicit artifact sheets, and unit-expanded line order are wrapper assumptions.",
        "No rank, winner, selection, allocation, guide, rotation, or Energy Recharge claim is supported.",
      ],
      sourceRefs: [
        {
          kind: "knowledge_record",
          recordId: TEAM_ID,
          supports: ["roster"],
        },
        {
          kind: "knowledge_record",
          recordId: "genshintools-presets:team:CX03obKWOJgK51-fWO",
          supports: ["roster"],
        },
      ],
    },
    teamConfigs: input.teamConfigs,
    combatOptions: { ...COMBAT_OPTIONS },
    enemyAura: null,
    extraBuffs: [],
    calcContext: buildCalcContext(),
    combo: cloneCombo(input.combo),
    artifactSheets: input.artifactSheets,
    formulaBuffOverrides: null,
  };
}

function buildTeamConfigs(
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate,
  formulaReport: XiaoFormulaCountParityReport,
  refinement: 1 | 5,
): ReplayTeamConfigs {
  const assumptions =
    formulaReport.calculatorDefaultDraft.assumptions.characters;
  if (
    stableJson(assumptions.map(({ characterId }) => characterId)) !==
      stableJson(["xiao", "xianyun", "furina", "faruzan"])
  ) {
    throw new Error("Checkpoint-42 FFXX assumption order drifted.");
  }
  const configs = assumptions.map((assumption): TeamSlotConfig => ({
    charId: assumption.characterId,
    charLevel: assumption.charLevel,
    constellation: assumption.constellation,
    weaponId:
      assumption.characterId === "xiao"
        ? candidate.weaponId
        : assumption.selectedWeaponId,
    refinement:
      assumption.characterId === "xiao" ? refinement : assumption.refinement,
    artifactSet:
      assumption.characterId === "xiao"
        ? { type: "4pc", setId: "marechaussee_hunter" }
        : assumption.selectedArtifact.type === "4pc"
          ? { ...assumption.selectedArtifact }
          : {
              ...assumption.selectedArtifact,
              halfSetIds: [...assumption.selectedArtifact.halfSetIds],
            },
    talentLevels: { ...assumption.talentLevels },
  }));
  if (
    configs.length !== 4 ||
    configs.some(
      (config) =>
        config.charLevel !== 90 ||
        config.constellation !== 0 ||
        config.talentLevels?.auto !== 10 ||
        config.talentLevels.skill !== 10 ||
        config.talentLevels.burst !== 10,
    )
  ) {
    throw new Error(
      "Checkpoint-42 FFXX local C0/level-90/10-10-10 assumption drifted.",
    );
  }
  return [configs[0], configs[1], configs[2], configs[3]] as ReplayTeamConfigs;
}

function buildArtifactSheets(
  circletStat: CircletStat | null,
  probeStat: ProbeStat | null,
): Record<string, StatSheet> {
  const xiaoEntries: Array<{ key: StatKey; value: number }> = [
    materializeLevel20FiveStarMainStat("hp"),
    materializeLevel20FiveStarMainStat("atk"),
    materializeLevel20FiveStarMainStat("atk%"),
    materializeLevel20FiveStarMainStat("anemo%"),
  ];
  if (circletStat) {
    xiaoEntries.push(materializeLevel20FiveStarMainStat(circletStat));
  }
  if (probeStat) {
    xiaoEntries.push({
      key: probeStat,
      value: XIAO_FFXX_LOCAL_MARGINAL_AVERAGE_ROLL_VALUES[probeStat],
    });
  }
  return {
    xiao: new StatSheet(xiaoEntries),
    xianyun: new StatSheet([]),
    furina: new StatSheet([]),
    faruzan: new StatSheet([]),
  };
}

function materializeLevel20FiveStarMainStat(
  key: "hp" | "atk" | "atk%" | "anemo%" | CircletStat,
): { key: StatKey; value: number } {
  return {
    key,
    value: toInternal(key, getMainStatValueAtLevel(key, 5, 20)),
  };
}

function buildUnitExpandedCombo(
  formulaReport: XiaoFormulaCountParityReport,
): ReplayCombo {
  const skill = formulaReport.calculatorDefaultDraft.lines.find(
    ({ characterId, formulaId }) =>
      characterId === "xiao" && formulaId === "xiao-skill",
  );
  const plunge = formulaReport.calculatorDefaultDraft.lines.find(
    ({ characterId, formulaId }) =>
      characterId === "xiao" && formulaId === "xiao-plunge-high",
  );
  if (skill?.count !== 2 || plunge?.count !== 11) {
    throw new Error(
      "Cannot independently reconstruct checkpoint-47 unit-expanded lines from checkpoint-42 formula counts.",
    );
  }
  return {
    id: "xiao-ffxx-checkpoint50-unit-expanded-2e-11hp",
    label: {
      en: "Xiao checkpoint 50 unit-expanded 2E + 11 High Plunge diagnostic",
      zh: "魈检查点 50 逐次 2E + 11 次高空下落攻击诊断",
    },
    lines: [
      ...Array.from({ length: skill.count }, () => ({
        charId: skill.characterId,
        formulaId: skill.formulaId,
        count: 1,
        reaction: null,
        forceOnField: true,
      })),
      ...Array.from({ length: plunge.count }, () => ({
        charId: plunge.characterId,
        formulaId: plunge.formulaId,
        count: 1,
        reaction: null,
        forceOnField: true,
      })),
    ],
  };
}

function buildCalcContext(): {
  enemyLevel: 110;
  enemyRes: 0.1;
  rollMultiplier: 0.85;
  substatBudget: "8_6";
} {
  return {
    enemyLevel: 110,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  };
}

function buildFixtureBoundaryIdentity(
  candidates: readonly XiaoFfxxNonErConditionFreeBranchCandidate[],
  formulaReport: XiaoFormulaCountParityReport,
  combo: ReplayCombo,
): unknown {
  return {
    sourceOnlyViewId: SOURCE_ONLY_VIEW_ID,
    excludedViewId: EXCLUDED_C6_VIEW_ID,
    candidates: candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      candidateIdentitySha256: candidate.candidateIdentitySha256,
      weaponId: candidate.weaponId,
      refinement: refinementForCandidate(candidate),
    })),
    teamAssumptions:
      formulaReport.calculatorDefaultDraft.assumptions.characters.map(
        (assumption) => ({
          characterId: assumption.characterId,
          charLevel: assumption.charLevel,
          constellation: assumption.constellation,
          selectedWeaponId: assumption.selectedWeaponId,
          refinement: assumption.refinement,
          selectedArtifact: structuredClone(assumption.selectedArtifact),
          talentLevels: { ...assumption.talentLevels },
        }),
      ),
    xiaoArtifactSetOverride: "marechaussee_hunter",
    baseArtifactMainStats: [
      materializeLevel20FiveStarMainStat("hp"),
      materializeLevel20FiveStarMainStat("atk"),
      materializeLevel20FiveStarMainStat("atk%"),
      materializeLevel20FiveStarMainStat("anemo%"),
    ],
    combo: cloneCombo(combo),
    combatOptions: { ...COMBAT_OPTIONS },
    calcContext: buildCalcContext(),
    calcContextRollFieldsUnusedByExplicitSheets: true,
  };
}

function refinementForCandidate(
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate,
): 1 | 5 {
  return candidate.weaponId === "deathmatch" ? 5 : 1;
}

function technicalNodeId(
  candidateId: string,
  circletStat: CircletStat,
  probeStat: ProbeStat | null,
): string {
  return `${DIAGNOSTIC_ID}:node:${candidateId}:circlet-${circletStat}:${probeStat ? `plus-one-avg-${probeStat}` : "baseline"}`;
}

function nonConflictingPlacementDomain(
  circletStat: CircletStat,
  probeStat: ProbeStat,
): ArtifactSlot[] {
  const mainStats: Record<ArtifactSlot, StatKey> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "anemo%",
    circlet: circletStat,
  };
  const domain = ARTIFACT_SLOT_ORDER.filter(
    (slot) => mainStats[slot] !== probeStat,
  );
  const expectedCount =
    probeStat === "atk%" || probeStat === circletStat ? 4 : 5;
  if (domain.length !== expectedCount) {
    throw new Error(
      `Unexpected placement domain for ${circletStat} Circlet plus ${probeStat}.`,
    );
  }
  return [...domain];
}

function requireReplayBoundary(
  replay: DamageReplayOutput,
  combo: ReplayCombo,
): void {
  if (
    replay.inputs.combo.lines.length !== 13 ||
    replay.inputs.combo.lines.some(({ count }) => count !== 1) ||
    stableJson(replay.inputs.combo.lines) !== stableJson(combo.lines) ||
    replay.validation.formulaCoverage.length !== 13 ||
    !replay.validation.calculatorAgreement.passed ||
    !Number.isFinite(replay.validation.calculatorAgreement.directTotalDamage) ||
    !Number.isFinite(replay.validation.calculatorAgreement.compiledTotalDamage) ||
    replay.validation.calculatorAgreement.absoluteDifference >
      replay.validation.calculatorAgreement.allowedDifference
  ) {
    throw new Error(
      `Checkpoint 50 replay ${replay.replayId} lost its exact thirteen-line dual-path agreement boundary.`,
    );
  }
}

function extractXianyunActivationTrace(
  overrides: Record<string, BuffActivationMap>,
): XiaoFfxxXianyunActivationTrace {
  const candidateKeys = new Set<string>();
  for (let lineIndex = 2; lineIndex < 13; lineIndex += 1) {
    for (const buffKey of Object.keys(overrides[String(lineIndex)] ?? {})) {
      candidateKeys.add(buffKey);
    }
  }
  const expected = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0] as const;
  const matches = [...candidateKeys]
    .map((buffKey) => ({
      buffKey,
      sequence: Array.from({ length: 11 }, (_, plungeIndex) => {
        const partMap = overrides[String(plungeIndex + 2)]?.[buffKey];
        return normalizeNumber(partMap ? sumActivation(partMap) : 0);
      }),
    }))
    .filter(({ sequence }) => stableJson(sequence) === stableJson(expected));
  if (matches.length !== 1) {
    throw new Error(
      `Checkpoint 50 expected one Xianyun 8-active/3-inactive trace, found ${matches.length}.`,
    );
  }
  const withoutHash = {
    buffKey: matches[0].buffKey,
    perPlungeOccurrence: [...expected] as [
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
    ],
    activePlungeOccurrenceCount: 8 as const,
    inactivePlungeOccurrenceCount: 3 as const,
    totalActivation: 8 as const,
  };
  return { ...withoutHash, traceSha256: hashValue(withoutHash) };
}

function buildWrapperFrameCritObservation(
  teamConfigs: ReplayTeamConfigs,
  artifactSheets: Record<string, StatSheet>,
): XiaoFfxxWrapperFrameCritObservation {
  const teamBuild = new TeamBuild(
    teamConfigs.map(cloneTeamConfig),
    { ...COMBAT_OPTIONS },
    undefined,
    [],
    undefined,
    buildCalcContext(),
  );
  const xiao = teamBuild.getTeamStats(
    artifactSheets,
    "xiao",
    buildCalcContext(),
  ).xiao;
  if (!xiao) {
    throw new Error("Checkpoint 50 wrapper frame lacks Xiao post-team stats.");
  }
  const critRate = xiao.get("cr", null);
  const critDamage = xiao.get("cd", null);
  if (
    !Number.isFinite(critRate) ||
    !Number.isFinite(critDamage) ||
    critRate <= 0 ||
    critDamage < 0
  ) {
    throw new Error("Checkpoint 50 wrapper-frame CRIT observation is invalid.");
  }
  const signedDistance = critDamage - 2 * critRate;
  const withoutHash = {
    frame:
      "calculator-post-team-stats-xiao-on-field-before-line-specific-buff-overrides" as const,
    critRate: normalizeNumber(critRate),
    critDamage: normalizeNumber(critDamage),
    critDamageToCritRateRatio: normalizeNumber(critDamage / critRate),
    signedCritDamageMinusTwiceCritRate: normalizeNumber(signedDistance),
    absoluteDistanceToOneToTwo: normalizeNumber(Math.abs(signedDistance)),
    sourceGuardResolved: false as const,
    thresholdApplied: false as const,
    toleranceApplied: false as const,
    choiceProduced: false as const,
  };
  return { ...withoutHash, observationSha256: hashValue(withoutHash) };
}

function hashWrapperFrameCritNumericObservation(
  observation: XiaoFfxxWrapperFrameCritObservation,
): string {
  return hashValue({
    frame: observation.frame,
    critRate: observation.critRate,
    critDamage: observation.critDamage,
    critDamageToCritRateRatio: observation.critDamageToCritRateRatio,
    signedCritDamageMinusTwiceCritRate:
      observation.signedCritDamageMinusTwiceCritRate,
    absoluteDistanceToOneToTwo: observation.absoluteDistanceToOneToTwo,
  });
}

function cloneTeamConfig(config: TeamSlotConfig): TeamSlotConfig {
  return {
    ...config,
    artifactSet:
      config.artifactSet?.type === "4pc"
        ? { ...config.artifactSet }
        : config.artifactSet?.type === "2pc+2pc"
          ? {
              ...config.artifactSet,
              halfSetIds: [...config.artifactSet.halfSetIds],
            }
          : null,
    talentLevels: config.talentLevels ? { ...config.talentLevels } : undefined,
  };
}

function cloneCombo(combo: ReplayCombo): ReplayCombo {
  return {
    id: combo.id,
    label: { ...combo.label },
    lines: combo.lines.map((line) => ({
      ...line,
      reaction: line.reaction ? { ...line.reaction } : null,
    })),
  };
}

function sumActivation(partMap: Record<number, number>): number {
  return Object.values(partMap).reduce((sum, value) => sum + value, 0);
}

function buildLocalMarginals(
  baselines: readonly XiaoFfxxCircletBaseline[],
  probes: readonly XiaoFfxxSubstatProbe[],
): XiaoFfxxLocalMarginal[] {
  const baselineById = new Map(
    baselines.map((baseline) => [baseline.nodeId, baseline]),
  );
  return probes.map((probe) => {
    const baseline = baselineById.get(probe.baselineNodeId);
    if (
      !baseline ||
      baseline.candidateId !== probe.candidateId ||
      baseline.weaponId !== probe.weaponId ||
      baseline.circletStat !== probe.circletStat ||
      baseline.directTotalDamage <= 0
    ) {
      throw new Error(
        `Probe ${probe.nodeId} lacks its exact same-weapon/same-Circlet positive baseline.`,
      );
    }
    const absoluteDamageDelta =
      probe.directTotalDamage - baseline.directTotalDamage;
    const withoutHash = {
      marginalId: `${probe.nodeId}:minus:${baseline.nodeId}`,
      baselineNodeId: baseline.nodeId,
      probeNodeId: probe.nodeId,
      candidateId: probe.candidateId,
      weaponId: probe.weaponId,
      circletStat: probe.circletStat,
      probeStat: probe.probeStat,
      averageRollValue: probe.averageRollValue,
      baselineDirectTotalDamage: baseline.directTotalDamage,
      probeDirectTotalDamage: probe.directTotalDamage,
      absoluteDamageDelta: normalizeNumber(absoluteDamageDelta),
      relativeDamageDelta: normalizeNumber(
        absoluteDamageDelta / baseline.directTotalDamage,
      ),
      localOneStepNeighborOnly: true as const,
      comparisonScope:
        "same-weapon-same-circlet-one-average-roll" as const,
      winner: false as const,
      recommendation: false as const,
    };
    return { ...withoutHash, marginalSha256: hashValue(withoutHash) };
  });
}

function buildSameWeaponCircletDeltas(
  baselines: readonly XiaoFfxxCircletBaseline[],
): XiaoFfxxSameWeaponCircletDelta[] {
  const byCandidate = new Map<string, XiaoFfxxCircletBaseline[]>();
  for (const baseline of baselines) {
    const existing = byCandidate.get(baseline.candidateId) ?? [];
    existing.push(baseline);
    byCandidate.set(baseline.candidateId, existing);
  }
  return [...byCandidate.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([candidateId, candidateBaselines]) => {
      const cr = candidateBaselines.find(({ circletStat }) => circletStat === "cr");
      const cd = candidateBaselines.find(({ circletStat }) => circletStat === "cd");
      if (!cr || !cd || candidateBaselines.length !== 2) {
        throw new Error(
          `Candidate ${candidateId} lacks its exact CR/CD unperturbed baseline pair.`,
        );
      }
      const withoutHash = {
        comparisonId: `${DIAGNOSTIC_ID}:same-weapon-circlet-delta:${candidateId}`,
        candidateId,
        weaponId: cr.weaponId,
        critRateBaselineNodeId: cr.nodeId,
        critDamageBaselineNodeId: cd.nodeId,
        critRateCircletDirectTotalDamage: cr.directTotalDamage,
        critDamageCircletDirectTotalDamage: cd.directTotalDamage,
        critRateMinusCritDamage: normalizeNumber(
          cr.directTotalDamage - cd.directTotalDamage,
        ),
        comparisonScope:
          "same-weapon-unperturbed-cr-circlet-minus-cd-circlet" as const,
        sourceGuardResolved: false as const,
        choiceProduced: false as const,
        preferredCirclet: null,
        winner: false as const,
        recommendation: false as const,
      };
      return { ...withoutHash, comparisonSha256: hashValue(withoutHash) };
    });
}

function buildSameCircletFiveStarCrossGroupComparisons(
  baselines: readonly XiaoFfxxCircletBaseline[],
): XiaoFfxxSameCircletFiveStarCrossGroupComparison[] {
  const byNodeId = new Map(
    baselines.map((baseline) => [baseline.nodeId, baseline]),
  );
  const comparisons: XiaoFfxxSameCircletFiveStarCrossGroupComparison[] = [];
  for (const circletStat of CIRCLET_ORDER) {
    for (const rankOneCandidateId of EXPECTED_RANK_ONE_CANDIDATE_IDS) {
      for (const rankTwoCandidateId of EXPECTED_RANK_TWO_CANDIDATE_IDS) {
        const rankOne = byNodeId.get(
          technicalNodeId(rankOneCandidateId, circletStat, null),
        );
        const rankTwo = byNodeId.get(
          technicalNodeId(rankTwoCandidateId, circletStat, null),
        );
        if (!rankOne || !rankTwo) {
          throw new Error(
            `Missing ${circletStat} baseline for checkpoint-50 five-star cross-group validation pair.`,
          );
        }
        const result = compareXiaoFfxxFiveStarSourceGroupTotals(
          rankOne.directTotalDamage,
          rankTwo.directTotalDamage,
        );
        const withoutHash = {
          comparisonId: `${DIAGNOSTIC_ID}:same-circlet-${circletStat}:${rankOneCandidateId}::source-rank-1-v-2::${rankTwoCandidateId}`,
          circletStat,
          rankOneCandidateId,
          rankTwoCandidateId,
          rankOneBaselineNodeId: rankOne.nodeId,
          rankTwoBaselineNodeId: rankTwo.nodeId,
          rankOneDirectTotalDamage: rankOne.directTotalDamage,
          rankTwoDirectTotalDamage: rankTwo.directTotalDamage,
          rankOneMinusRankTwo: result.rankOneMinusRankTwo,
          absoluteDifference: result.absoluteDifference,
          allowedDifference: result.allowedDifference,
          outcome: result.outcome,
          validationTargetOnly: true as const,
          baselineOnly: true as const,
          sameCircletOnly: true as const,
          perturbedCrossWeaponComparison: false as const,
          withinGroupComparison: false as const,
          deathmatchComparison: false as const,
          factoryRank: null,
          winner: false as const,
          recommendation: false as const,
        };
        comparisons.push({
          ...withoutHash,
          comparisonSha256: hashValue(withoutHash),
        });
      }
    }
  }
  return comparisons;
}

function buildSameCircletCrossGroupOutcomeSummary(
  comparisons: readonly XiaoFfxxSameCircletFiveStarCrossGroupComparison[],
): XiaoFfxxCircletSubstatLocalMarginalDiagnosticReport["sameCircletCrossGroupOutcomeSummary"] {
  const count = (
    rows: readonly XiaoFfxxSameCircletFiveStarCrossGroupComparison[],
  ) => ({
    sourceOrderAlignedCount: rows.filter(
      ({ outcome }) => outcome === "source-order-aligned",
    ).length,
    sourceOrderCounterexampleCount: rows.filter(
      ({ outcome }) => outcome === "source-order-counterexample",
    ).length,
    withinToleranceTieCount: rows.filter(
      ({ outcome }) => outcome === "within-tolerance-tie",
    ).length,
  });
  const overall = count(comparisons);
  const cr = count(
    comparisons.filter(({ circletStat }) => circletStat === "cr"),
  );
  const cd = count(
    comparisons.filter(({ circletStat }) => circletStat === "cd"),
  );
  if (
    comparisons.length !== 12 ||
    overall.sourceOrderAlignedCount !== 5 ||
    overall.sourceOrderCounterexampleCount !== 7 ||
    overall.withinToleranceTieCount !== 0 ||
    cr.sourceOrderAlignedCount !== 2 ||
    cr.sourceOrderCounterexampleCount !== 4 ||
    cr.withinToleranceTieCount !== 0 ||
    cd.sourceOrderAlignedCount !== 3 ||
    cd.sourceOrderCounterexampleCount !== 3 ||
    cd.withinToleranceTieCount !== 0
  ) {
    throw new Error(
      `Checkpoint 50 same-Circlet validation outcomes drifted from CR 2/4/0, CD 3/3/0, total 5/7/0: ${stableJson({ overall, cr, cd })}.`,
    );
  }
  const withoutHash = {
    validationTargetOnly: true as const,
    rankOrWinnerProduced: false as const,
    overall: {
      sourceOrderAlignedCount: overall.sourceOrderAlignedCount as 5,
      sourceOrderCounterexampleCount:
        overall.sourceOrderCounterexampleCount as 7,
      withinToleranceTieCount: overall.withinToleranceTieCount as 0,
    },
    byCirclet: {
      cr: {
        sourceOrderAlignedCount: cr.sourceOrderAlignedCount as 2,
        sourceOrderCounterexampleCount:
          cr.sourceOrderCounterexampleCount as 4,
        withinToleranceTieCount: cr.withinToleranceTieCount as 0,
      },
      cd: {
        sourceOrderAlignedCount: cd.sourceOrderAlignedCount as 3,
        sourceOrderCounterexampleCount:
          cd.sourceOrderCounterexampleCount as 3,
        withinToleranceTieCount: cd.withinToleranceTieCount as 0,
      },
    },
  };
  return {
    ...withoutHash,
    outcomeSummarySha256: hashValue(withoutHash),
  };
}

function requireExecutionCardinality(
  controls: readonly XiaoFfxxReconstructionControl[],
  baselines: readonly XiaoFfxxCircletBaseline[],
  probes: readonly XiaoFfxxSubstatProbe[],
): void {
  const replayEvidence = [...controls, ...baselines, ...probes];
  const activationEvidence = replayEvidence.map(({ xianyunActivation }) =>
    stableJson(xianyunActivation.perPlungeOccurrence),
  );
  if (
    controls.length !== EXPECTED_RECONSTRUCTION_CONTROL_COUNT ||
    baselines.length !== EXPECTED_BASELINE_COUNT ||
    probes.length !== EXPECTED_PROBE_COUNT ||
    replayEvidence.length !== EXPECTED_REPLAY_COUNT ||
    baselines.length + probes.length !== EXPECTED_LATTICE_NODE_COUNT ||
    new Set(controls.map(({ controlId }) => controlId)).size !== controls.length ||
    new Set(baselines.map(({ nodeId }) => nodeId)).size !== baselines.length ||
    new Set(probes.map(({ nodeId }) => nodeId)).size !== probes.length ||
    replayEvidence.some(
      (evidence) =>
        !Number.isFinite(evidence.directTotalDamage) ||
        !Number.isFinite(evidence.compiledTotalDamage) ||
        evidence.absoluteDifference > evidence.allowedDifference ||
        evidence.xianyunActivation.activePlungeOccurrenceCount !== 8 ||
        evidence.xianyunActivation.inactivePlungeOccurrenceCount !== 3 ||
        evidence.xianyunActivation.totalActivation !== 8,
    ) ||
    activationEvidence.some(
      (sequence) =>
        sequence !== stableJson([1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]),
    ) ||
    baselines.some(
      (baseline) =>
        baseline.sourceGuardResolved ||
        baseline.sourceApplicabilityEstablished ||
        baseline.factoryRank != null ||
        baseline.winner ||
        baseline.recommendation,
    ) ||
    probes.some(
      (probe) =>
        probe.sourceGuardResolved ||
        probe.sourceApplicabilityEstablished ||
        probe.placementSlotChosen != null ||
        probe.placementSelectionExecuted ||
        probe.factoryRank != null ||
        probe.winner ||
        probe.recommendation,
    )
  ) {
    throw new Error(
      "Checkpoint 50 lost its exact 6-control + 12-baseline + 36-probe, 54-replay execution boundary.",
    );
  }
}

function requireDerivedDiagnosticBoundary(
  marginals: readonly XiaoFfxxLocalMarginal[],
  sameWeapon: readonly XiaoFfxxSameWeaponCircletDelta[],
  crossGroup: readonly XiaoFfxxSameCircletFiveStarCrossGroupComparison[],
): void {
  if (
    marginals.length !== 36 ||
    new Set(marginals.map(({ marginalId }) => marginalId)).size !== 36 ||
    marginals.some(
      (marginal) =>
        marginal.comparisonScope !==
          "same-weapon-same-circlet-one-average-roll" ||
        !marginal.localOneStepNeighborOnly ||
        marginal.winner ||
        marginal.recommendation,
    ) ||
    sameWeapon.length !== 6 ||
    new Set(sameWeapon.map(({ candidateId }) => candidateId)).size !== 6 ||
    sameWeapon.some(
      (comparison) =>
        comparison.sourceGuardResolved ||
        comparison.choiceProduced ||
        comparison.preferredCirclet != null ||
        comparison.winner ||
        comparison.recommendation,
    ) ||
    crossGroup.length !== 12 ||
    new Set(crossGroup.map(({ comparisonId }) => comparisonId)).size !== 12 ||
    crossGroup.some(
      (comparison) =>
        !comparison.baselineOnly ||
        !comparison.sameCircletOnly ||
        comparison.perturbedCrossWeaponComparison ||
        comparison.withinGroupComparison ||
        comparison.deathmatchComparison ||
        comparison.rankOneCandidateId === EXPECTED_DEATHMATCH_CANDIDATE_ID ||
        comparison.rankTwoCandidateId === EXPECTED_DEATHMATCH_CANDIDATE_ID ||
        comparison.factoryRank != null ||
        comparison.winner ||
        comparison.recommendation,
    )
  ) {
    throw new Error(
      "Checkpoint 50 derived diagnostic escaped its exact local/same-weapon/same-Circlet baseline comparison scopes.",
    );
  }
}

function requiredBytes(
  sourceBytesByPath: ReadonlyMap<string, Buffer>,
  sourcePath: string,
): Buffer {
  const bytes = sourceBytesByPath.get(sourcePath);
  if (!bytes) throw new Error(`Missing raw source bytes ${sourcePath}.`);
  return bytes;
}

function decodeBase64(value: string, sourcePath: string): Buffer {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Xiao Circlet/substat source ${sourcePath} has no bytes.`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new Error(
      `Xiao Circlet/substat source ${sourcePath} has non-canonical base64.`,
    );
  }
  return bytes;
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot normalize non-finite Xiao diagnostic value ${value}.`);
  }
  if (Object.is(value, -0)) return 0;
  return Number(value.toPrecision(15));
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
