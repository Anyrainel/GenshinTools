import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { stableJson } from "./io";
import {
  NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS,
  requireAuthenticatedNoelleHexereiEquipmentResponseSurfaceReport,
  type NoelleHexereiEquipmentResponseCell,
  type NoelleHexereiEquipmentResponseSurfaceInput,
  type NoelleHexereiEquipmentResponseSurfaceReport,
} from "./noelleHexereiEquipmentResponseSurface";
import {
  evaluateNoelleHexereiTechnicalPoint,
  NOELLE_HEXEREI_POINT_AVERAGE_ROLLS,
  NOELLE_HEXEREI_POINT_CIRCLET_STATS,
  NOELLE_HEXEREI_POINT_HUSK_STACKS,
  NOELLE_HEXEREI_POINT_NICOLE_MODES,
  NOELLE_HEXEREI_POINT_PROBE_STATS,
  NOELLE_HEXEREI_POINT_REFINEMENTS,
  NOELLE_HEXEREI_POINT_WITNESSES,
  type NoelleHexereiTechnicalPointEvaluation,
  type NoelleHexereiTechnicalPointRequest,
} from "./noelleHexereiTechnicalPointEvaluator";
import { FACTORY_ROOT, REPOSITORY_ROOT } from "./paths";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";

export const NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_ID =
  "noelle-hexerei-local-stat-priority-diagnostic-v1";
export const NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "noelle-hexerei-local-stat-priority-diagnostic.json",
  );

export const NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-hexerei-equipment-response-surface.json";
export const NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH =
  "scripts/guide-factory/src/noelleHexereiTechnicalPointEvaluator.ts";
export const NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/noelleHexereiLocalStatPriorityDiagnostic.ts";
export const NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CLI_RELATIVE_PATH =
  "scripts/guide-factory/src/assemble-noelle-hexerei-local-stat-priority-diagnostic.ts";

export const NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS = [
  ...new Set([
    ...NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
    NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH,
    NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH,
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CORE_RELATIVE_PATH,
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CLI_RELATIVE_PATH,
  ]),
].sort(compareText);

export const NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_SOURCE_FILE_PATHS = [
  ...NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS,
];

export const NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS = [
  ...NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS,
] as const;

const EXPECTED_INPUT_PATH_COUNT = 116;
const EXPECTED_RUNTIME_INPUT_PATH_COUNT = 80;
const EXPECTED_JSON_INPUT_COUNT = 14;
const EXPECTED_BINARY_RUNTIME_INPUT_COUNT = 2;
const HUSK_RUNTIME_RELATIVE_PATH = "src/lib/dmgcalc/impl/artifact4pc.ts";
const ABSOLUTE_TOLERANCE = 1e-9;
const RELATIVE_TOLERANCE = 1e-12;

const WITNESS_IDS = [
  "c0-q9",
  "c5-q9",
  "c0-q10",
  "c5-q10",
  "c6-q9",
  "c6-q10",
] as const;
export type NoelleHexereiDiagnosticWitnessId = (typeof WITNESS_IDS)[number];

const CIRCLET_STATS = ["cr", "cd"] as const;
export type NoelleHexereiDiagnosticCircletStat =
  (typeof CIRCLET_STATS)[number];

const REFINEMENTS = [1, 5] as const;
export type NoelleHexereiDiagnosticRefinement = (typeof REFINEMENTS)[number];

const NICOLE_MODES = ["all-theosis", "hexerei-theosis"] as const;
export type NoelleHexereiDiagnosticNicoleMode = (typeof NICOLE_MODES)[number];

const HUSK_STACK_STATES = [4, 0] as const;
export type NoelleHexereiDiagnosticHuskStacks =
  (typeof HUSK_STACK_STATES)[number];

const PROBE_STATS = ["cr", "cd", "atk%", "def%"] as const;
export type NoelleHexereiDiagnosticProbeStat = (typeof PROBE_STATS)[number];
export type NoelleHexereiDiagnosticProbeState =
  | "baseline"
  | NoelleHexereiDiagnosticProbeStat;

const AVERAGE_ROLL_DELTAS = {
  cr: 0.03305,
  cd: 0.06605,
  "atk%": 0.049550000000000004,
  "def%": 0.06194999999999999,
} as const;

const SOURCE_PRIORITY_RELATIONS = {
  "noelle-lower-investment-artifact-profile-v1": [
    { relationId: "p1-cr-over-p2-atk", higherStat: "cr", lowerStat: "atk%" },
    { relationId: "p1-cd-over-p2-atk", higherStat: "cd", lowerStat: "atk%" },
    { relationId: "p2-atk-over-p3-def", higherStat: "atk%", lowerStat: "def%" },
  ],
  "noelle-high-investment-artifact-profile-v1": [
    { relationId: "p1-cr-over-p2-def", higherStat: "cr", lowerStat: "def%" },
    { relationId: "p1-cd-over-p2-def", higherStat: "cd", lowerStat: "def%" },
    { relationId: "p2-def-over-p3-atk", higherStat: "def%", lowerStat: "atk%" },
  ],
} as const satisfies Record<
  NoelleHexereiDiagnosticProfileId,
  readonly {
    relationId: string;
    higherStat: NoelleHexereiDiagnosticProbeStat;
    lowerStat: NoelleHexereiDiagnosticProbeStat;
  }[]
>;

export type NoelleHexereiDiagnosticProfileId =
  | "noelle-lower-investment-artifact-profile-v1"
  | "noelle-high-investment-artifact-profile-v1";
export type NoelleHexereiDiagnosticSandsStat = "atk%" | "def%";
export type NoelleHexereiDiagnosticArtifactSlot =
  | "flower"
  | "plume"
  | "sands"
  | "goblet"
  | "circlet";

export const NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REQUEST = {
  requestId: "noelle-hexerei-480-cell-local-stat-priority-diagnostic-v1",
  authorship: "guide-factory-technical-request",
  sourceCandidateSelection: null,
  investmentWitnessIds: WITNESS_IDS,
  sourceAlignedSandsOnly: true,
  circletStats: CIRCLET_STATS,
  gestRefinements: REFINEMENTS,
  nicoleModes: NICOLE_MODES,
  huskStackStates: HUSK_STACK_STATES,
  probeStats: PROBE_STATS,
  averageRollDeltas: AVERAGE_ROLL_DELTAS,
  probeConstruction: "independent-one-average-roll-neighbor",
  sourcePriorityComparisonPolicy:
    "adjacent-groups-only-no-within-group-order-no-transitive-duplicates",
  expectedCardinality: {
    baselineCount: 96,
    probeCount: 384,
    cellCount: 480,
    localMarginalCount: 384,
    sensitivityEdgeCount: 480,
    ordinalDiagnosticCount: 288,
    contextRobustnessRowCount: 72,
    cp55ReproductionCount: 24,
  },
  sourceSelectionOutputs: {
    statChoice: null,
    circletChoice: null,
    refinementChoice: null,
    supportOptionChoice: null,
    huskStackChoice: null,
    artifactPlacementChoice: null,
  },
  scalarWeightsRequested: false,
  branchAverageRequested: false,
  energyRecoveryRequested: false,
} as const;

type TechnicalRequest =
  typeof NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REQUEST;

const CAUTIONS = [
  "This is an authenticated local one-step sensitivity diagnostic over one static calculator fixture, not a stat priority, optimizer result, build, guide, or recommendation.",
  "Every probe adds exactly one current average five-star substat roll to an aggregate StatSheet. A non-conflicting placement domain is recorded, but no artifact slot, legal roll allocation, or inventory is selected.",
  "The source priority groups are ordinal validation targets only. Alignment means no counterexample in one exact local context; a reversal challenges only an unconditional local-marginal interpretation under that fixture.",
  "CRIT Rate and CRIT DMG share one source group. Their marginals are never ordered against each other or required to be equal.",
  "Husk zero means zero Curiosity stacks while the four-piece set remains equipped and its two-piece DEF bonus remains present. It does not mean no Husk set.",
  "Nicole's Hexerei-only Theosis mode restricts the uplift target; it does not disable Nicole's base Kenosis contribution.",
  "Gest R1/R5, both Nicole modes, both Husk stack states, the six witnesses, teammate equipment, enemy context, and every numeric probe are Guide Factory technical factors rather than source selections.",
  "Only Noelle's exact 5/5/3/0 Normal prefix is valued. Timing, ATK Speed, supporter damage, team total, DPS, buff coverage, and Energy Recharge remain excluded.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not convert local marginals or ordinal outcomes into scalar weights, a selected stat order, an ideal allocation, a winner, or a recommendation.",
  "Do not average witnesses, Circlets, refinements, Nicole modes, Husk states, or source branches into one score.",
  "Do not infer a Sands choice: only the branch-local source-listed Sands is admitted in this diagnostic.",
  "Do not treat context-wide alignment as universal source validation or a counterexample as proof that the source is wrong.",
  "Do not publish technical totals as player damage, a rotation result, DPS, or team performance.",
] as const;

export interface NoelleHexereiLocalStatPriorityDiagnosticSourceFile {
  path: string;
  bytesBase64: string;
}

export interface NoelleHexereiLocalStatPriorityDiagnosticInput {
  cp55ReportInput: NoelleHexereiEquipmentResponseSurfaceReport;
  cp55Input: NoelleHexereiEquipmentResponseSurfaceInput;
  technicalRequest: TechnicalRequest;
  sourceFiles: readonly NoelleHexereiLocalStatPriorityDiagnosticSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

interface AuthenticatedOuterInputs {
  sourceBytesByPath: Map<string, Buffer>;
  generatedFrom: GeneratedFromEntry[];
  cp55Report: NoelleHexereiEquipmentResponseSurfaceReport;
}

interface ExecutedNoelleHexereiLocalStatPriorityCell {
  cell: NoelleHexereiLocalStatPriorityCell;
  normalizedEntries: NoelleHexereiTechnicalPointEvaluation["artifactSheet"]["normalizedEntries"];
  buffTrace: NoelleHexereiTechnicalPointEvaluation["runtimeTrace"]["buffTrace"];
}

export interface NoelleHexereiDiagnosticProbeDescriptor {
  probeState: NoelleHexereiDiagnosticProbeState;
  stat: NoelleHexereiDiagnosticProbeStat | null;
  averageRollValue: number;
  averageRollValueOrigin:
    | "not-applicable-baseline"
    | "current-AVG_SUBSTAT_ROLL-application-constant";
  nonConflictingPlacementSlotDomain: NoelleHexereiDiagnosticArtifactSlot[];
  placementSlotChosen: null;
  placementSelectionExecuted: false;
  independentOneRollNeighbor: boolean;
}

export interface NoelleHexereiCompactTechnicalPointEvidence {
  evaluationInputSha256: string;
  evaluationSha256: string;
  witness: NoelleHexereiTechnicalPointEvaluation["witness"];
  probe: NoelleHexereiTechnicalPointEvaluation["probe"];
  artifactSheet: Omit<
    NoelleHexereiTechnicalPointEvaluation["artifactSheet"],
    "normalizedEntries"
  >;
  runtimeTrace: Omit<
    NoelleHexereiTechnicalPointEvaluation["runtimeTrace"],
    "buffTrace"
  > & {
    canonicalApplicableBuffTraceSha256: string;
  };
  formulaProjection: NoelleHexereiTechnicalPointEvaluation["formulaProjection"];
  objective: NoelleHexereiTechnicalPointEvaluation["objective"];
}

export interface NoelleHexereiArtifactSheetCatalogEntry {
  normalizedEntriesSha256: string;
  observedCellCount: number;
  referencingCellIds: string[];
  normalizedEntries: NoelleHexereiTechnicalPointEvaluation["artifactSheet"]["normalizedEntries"];
  catalogEntrySha256: string;
}

export interface NoelleHexereiApplicableBuffTraceCatalogEntry {
  applicableBuffTraceSha256: string;
  canonicalApplicableBuffTraceSha256: string;
  observedCellCount: number;
  referencingCellIds: string[];
  buffTrace: NoelleHexereiTechnicalPointEvaluation["runtimeTrace"]["buffTrace"];
  catalogEntrySha256: string;
}

export interface NoelleHexereiLocalStatPriorityCell {
  sequence: number;
  cellId: string;
  parentBaselineCellId: string | null;
  witnessId: NoelleHexereiDiagnosticWitnessId;
  profileId: NoelleHexereiDiagnosticProfileId;
  sourceAlignedSands: NoelleHexereiDiagnosticSandsStat;
  circlet: NoelleHexereiDiagnosticCircletStat;
  refinement: NoelleHexereiDiagnosticRefinement;
  nicoleMode: NoelleHexereiDiagnosticNicoleMode;
  huskStacks: NoelleHexereiDiagnosticHuskStacks;
  probe: NoelleHexereiDiagnosticProbeDescriptor;
  evaluation: NoelleHexereiCompactTechnicalPointEvidence;
  directTotal: number;
  cellInputSha256: string;
  cellSha256: string;
}

export interface NoelleHexereiLocalMarginal {
  marginalId: string;
  baselineCellId: string;
  probeCellId: string;
  probeStat: NoelleHexereiDiagnosticProbeStat;
  averageRollValue: number;
  absoluteDelta: number;
  relativeDelta: number;
  localOneStepNeighborOnly: true;
  scalarWeight: null;
  marginalSha256: string;
}

export interface NoelleHexereiSensitivityEdge {
  edgeId: string;
  changedAxis: "nicoleMode" | "huskStacks";
  leftCellId: string;
  rightCellId: string;
  probeState: NoelleHexereiDiagnosticProbeState;
  exactlyOneSensitivityAxisChanged: true;
  fixedAxisPayloadSha256: string;
  signedLeftMinusRightDelta: number;
  sourceExpectedOrdering: null;
  choiceProduced: false;
  edgeSha256: string;
}

export type NoelleHexereiOrdinalOutcome =
  | "source-order-aligned"
  | "source-order-counterexample"
  | "within-tolerance-inconclusive";

export interface NoelleHexereiSourceOrderDiagnostic {
  diagnosticId: string;
  witnessId: NoelleHexereiDiagnosticWitnessId;
  profileId: NoelleHexereiDiagnosticProfileId;
  circlet: NoelleHexereiDiagnosticCircletStat;
  refinement: NoelleHexereiDiagnosticRefinement;
  nicoleMode: NoelleHexereiDiagnosticNicoleMode;
  huskStacks: NoelleHexereiDiagnosticHuskStacks;
  sourceRelationId: string;
  higherPriorityStat: NoelleHexereiDiagnosticProbeStat;
  lowerPriorityStat: NoelleHexereiDiagnosticProbeStat;
  higherPriorityMarginalId: string;
  lowerPriorityMarginalId: string;
  signedHigherMinusLowerDelta: number;
  allowedDifference: number;
  outcome: NoelleHexereiOrdinalOutcome;
  adjacentSourceGroupsOnly: true;
  validationTargetOnly: true;
  sourcePriorityValidated: false;
  diagnosticSha256: string;
}

export interface NoelleHexereiContextRobustnessRow {
  robustnessId: string;
  witnessId: NoelleHexereiDiagnosticWitnessId;
  profileId: NoelleHexereiDiagnosticProfileId;
  circlet: NoelleHexereiDiagnosticCircletStat;
  refinement: NoelleHexereiDiagnosticRefinement;
  sourceRelationId: string;
  higherPriorityStat: NoelleHexereiDiagnosticProbeStat;
  lowerPriorityStat: NoelleHexereiDiagnosticProbeStat;
  sensitivityContextCount: 4;
  diagnosticIds: string[];
  sourceOrderAlignedCount: number;
  sourceOrderCounterexampleCount: number;
  withinToleranceInconclusiveCount: number;
  observedOutcomeSet: NoelleHexereiOrdinalOutcome[];
  classification:
    | "aligned-across-tested-sensitivity-grid"
    | "counterexample-across-tested-sensitivity-grid"
    | "context-dependent-or-inconclusive";
  branchAverageComputed: false;
  scalarWeightComputed: false;
  supportsUniversalPriorityClaim: false;
  robustnessSha256: string;
}

export interface NoelleHexereiCp55Reproduction {
  reproductionId: string;
  cp55CellId: string;
  cp56CellId: string;
  witnessId: NoelleHexereiDiagnosticWitnessId;
  circlet: NoelleHexereiDiagnosticCircletStat;
  refinement: NoelleHexereiDiagnosticRefinement;
  nicoleMode: "all-theosis";
  huskStacks: 4;
  sourceAlignedSandsOnly: true;
  cp55ComparableProjectionSha256: string;
  cp56ComparableProjectionSha256: string;
  exactComparableProjectionMatch: true;
  reproductionSha256: string;
}

export interface NoelleHexereiLocalStatPriorityDiagnosticReport {
  schemaVersion: 1;
  reportType: "noelle-hexerei-local-stat-priority-diagnostic";
  diagnosticId: typeof NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_ID;
  classification: "authenticated-offline-local-stat-priority-diagnostic";
  validationStatus: "completed-480-cell-local-diagnostic";
  publicationStatus: "withheld-technical-validation-only";
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allGeneratedFromHashesAuthenticatedFromBytes: true;
    allSourceBytesMatchWorkspaceFiles: true;
    cp55ReportByteAndParsedObjectParity: true;
    exactCp55InputProjection: true;
    exactTechnicalRequest: true;
    sourceFileCount: 116;
    generatedFromCount: 116;
    runtimeInputPathCount: 80;
    jsonInputCount: 14;
    binaryRuntimeInputCount: 2;
  };
  upstreamBoundary: {
    cp55ReportPath: typeof NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH;
    cp55ReportFileSha256: string;
    cp55CanonicalObjectSha256: string;
    cp55FreshlyAuthenticated: true;
    cp55CellCount: 48;
    cp55SelectionCount: 0;
    cp55EnergyRecoveryComputationCount: 0;
    sourceAlignedDefaultBaselineReproductionCount: 24;
    everySourceAlignedDefaultBaselineExactlyReproduced: true;
  };
  authorityLedger: {
    sourceBacked: string[];
    runtimeOrApplicationBacked: string[];
    guideFactoryTechnical: string[];
    computedValidationObservation: string[];
    explicitlyMissing: string[];
  };
  requestBoundary: {
    request: TechnicalRequest;
    requestCanonicalObjectSha256: string;
    sourceAuthored: false;
    sourceCandidateSelection: null;
    sourceStatSelection: null;
    sourceSupportOptionSelection: null;
    sourceHuskStackSelection: null;
    sourceRefinementSelection: null;
    sourceArtifactPlacementSelection: null;
    energyRecoveryDeferred: true;
  };
  experimentalDomain: {
    witnessIds: NoelleHexereiDiagnosticWitnessId[];
    sourceAlignedSandsOnly: true;
    circletStats: NoelleHexereiDiagnosticCircletStat[];
    refinements: NoelleHexereiDiagnosticRefinement[];
    nicoleModes: NoelleHexereiDiagnosticNicoleMode[];
    huskStackStates: NoelleHexereiDiagnosticHuskStacks[];
    probeStats: NoelleHexereiDiagnosticProbeStat[];
    averageRollDeltas: Record<NoelleHexereiDiagnosticProbeStat, number>;
    averageRollValueOrigin: "current-AVG_SUBSTAT_ROLL-application-constant";
    huskZeroSemantics: "zero-curiosity-stacks-four-piece-equipped-two-piece-retained";
    nicoleHexereiModeSemantics: "theosis-uplift-target-restricted-base-kenosis-retained";
    groupedCritWithinGroupOrderInferred: false;
    scalarWeightsPresent: false;
    branchAveragePresent: false;
  };
  runtimeOptionEvidence: {
    evidenceOrigin: "authenticated-evaluator-and-runtime-plus-observed-cell-traces";
    huskFourPieceConfiguredCellCount: 480;
    huskFourPieceConfiguredInEveryCell: true;
    huskZeroStackCellCount: 240;
    huskZeroMeansZeroCuriosityStacks: true;
    huskZeroCuriosityBuffAbsentInEveryZeroStackCell: true;
    huskTwoPieceHalfSetId: "def%-30";
    huskTwoPieceDefenseBonus: 0.3;
    huskTwoPieceRetainedAtZeroStacks: true;
    huskTwoPieceRuntimeDifferentialVerifiedInEveryCell: true;
    huskFourStackCellCount: 240;
    huskFourStackDefenseAndGeoBonusVerifiedInEveryFourStackCell: true;
    nicoleAllTheosisCellCount: 240;
    nicoleAllTheosisUpliftAppliedToNoelleInEveryAllTheosisCell: true;
    nicoleHexereiTheosisCellCount: 240;
    nicoleHexereiTheosisUpliftExcludedFromNoelleInEveryHexereiTheosisCell: true;
    nicoleTheosisUpliftRegisteredInEveryCell: true;
    nicoleHexereiTheosisRegisteredTargetRestrictedInEveryHexereiTheosisCell: true;
    nicoleBaseKenosisRetainedInEveryCell: true;
  };
  sourcePriorityTargets: Array<{
    profileId: NoelleHexereiDiagnosticProfileId;
    sourcePriorityGroups: NoelleHexereiDiagnosticProbeStat[][];
    adjacentRelations: Array<{
      relationId: string;
      higherStat: NoelleHexereiDiagnosticProbeStat;
      lowerStat: NoelleHexereiDiagnosticProbeStat;
    }>;
    sourceScalarWeights: null;
    sourceSelectedAllocation: null;
  }>;
  artifactSheetCatalog: NoelleHexereiArtifactSheetCatalogEntry[];
  applicableBuffTraceCatalog: NoelleHexereiApplicableBuffTraceCatalogEntry[];
  cells: NoelleHexereiLocalStatPriorityCell[];
  localMarginals: NoelleHexereiLocalMarginal[];
  sensitivityEdges: NoelleHexereiSensitivityEdge[];
  sourceOrderDiagnostics: NoelleHexereiSourceOrderDiagnostic[];
  contextRobustnessRows: NoelleHexereiContextRobustnessRow[];
  cp55Reproductions: NoelleHexereiCp55Reproduction[];
  identityBoundary: {
    artifactSheetCatalogSha256: string;
    applicableBuffTraceCatalogSha256: string;
    cellsSha256: string;
    localMarginalsSha256: string;
    sensitivityEdgesSha256: string;
    sourceOrderDiagnosticsSha256: string;
    contextRobustnessRowsSha256: string;
    cp55ReproductionsSha256: string;
    aggregateDiagnosticSha256: string;
    serializationOrderIsNotRank: true;
    everyProbeHasExactlyOneParentBaseline: true;
    everySensitivityEdgeChangesExactlyOneDeclaredAxis: true;
    everyCellCatalogReferenceResolvedExactlyOnce: true;
    everyEvaluationSha256ReconstructedFromCompactEvidenceAndCatalogs: true;
  };
  operationSummary: {
    countingScope: "cp56-local-diagnostic-only-excludes-upstream-authentication-work";
    upstreamAuthenticationOperationsExcluded: true;
    freshlyRecomputedUpstreamCp55CellCount: 48;
    investmentWitnessCount: 6;
    sourceAlignedSandsStateCount: 1;
    circletStateCount: 2;
    refinementStateCount: 2;
    nicoleModeCount: 2;
    huskStackStateCount: 2;
    probeStatCount: 4;
    baselineCellCount: 96;
    probeCellCount: 384;
    freshCellCount: 480;
    freshTeamBuildCount: 960;
    objectiveTeamBuildCount: 480;
    huskTwoPieceControlTeamBuildCount: 480;
    formulaProjectionRunCount: 480;
    compilerBuildCount: 480;
    directDamageEvaluationCount: 480;
    compiledDamageEvaluationCount: 480;
    directCompiledAgreementCount: 480;
    localMarginalCount: 384;
    sensitivityEdgeCount: 480;
    nicoleSensitivityEdgeCount: 240;
    huskSensitivityEdgeCount: 240;
    sourceOrderDiagnosticCount: 288;
    contextRobustnessRowCount: 72;
    cp55ReproductionCount: 24;
    artifactSheetCatalogEntryCount: 20;
    artifactSheetCatalogReferenceCount: 480;
    applicableBuffTraceCatalogEntryCount: 96;
    applicableBuffTraceCatalogReferenceCount: 480;
    scalarWeightCount: 0;
    selectedStatCount: 0;
    selectedCircletCount: 0;
    selectedRefinementCount: 0;
    selectedSupportOptionCount: 0;
    selectedHuskStackCount: 0;
    selectedArtifactPlacementCount: 0;
    branchAverageCount: 0;
    optimizerRunCount: 0;
    autoTuneRunCount: 0;
    idealStatAllocationCount: 0;
    sourceRotationReplayCount: 0;
    sourceTeamTotalDamageComputationCount: 0;
    energyRecoveryComputationCount: 0;
  };
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsBuildRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsWinnerClaims: false;
  supportsPlayerDamageClaims: false;
  supportsSourceRotationReplay: false;
  supportsTeamTotalDamageComputation: false;
  supportsDpsClaims: false;
  supportsBuffTimingClaims: false;
  supportsEnergyRecoveryClaims: false;
  supportsIdealStatAllocation: false;
  localStatPriorityDiagnosticExecuted: true;
  sourceCandidateSelectionExecuted: false;
  sourceStatSelectionExecuted: false;
  sourceSubstatPriorityValidated: false;
  optimizerExecuted: false;
  autoTuneExecuted: false;
  idealStatAllocationExecuted: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type NoelleHexereiLocalStatPriorityDiagnosticAuthentication =
  | {
      authenticated: true;
      canonicalReport: NoelleHexereiLocalStatPriorityDiagnosticReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      message: string;
    };

export async function authenticateNoelleHexereiLocalStatPriorityDiagnosticReport(
  serializedReport: NoelleHexereiLocalStatPriorityDiagnosticReport,
  input: NoelleHexereiLocalStatPriorityDiagnosticInput,
): Promise<NoelleHexereiLocalStatPriorityDiagnosticAuthentication> {
  let canonicalReport: NoelleHexereiLocalStatPriorityDiagnosticReport;
  try {
    canonicalReport =
      await buildNoelleHexereiLocalStatPriorityDiagnosticReport(input);
  } catch (error) {
    return {
      authenticated: false,
      reason: "canonical-inputs-rejected",
      message: errorMessage(error),
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      message:
        "Serialized CP56 report does not match the fresh canonical computation.",
    };
  }
  return { authenticated: true, canonicalReport };
}

export async function requireAuthenticatedNoelleHexereiLocalStatPriorityDiagnosticReport(
  serializedReport: NoelleHexereiLocalStatPriorityDiagnosticReport,
  input: NoelleHexereiLocalStatPriorityDiagnosticInput,
): Promise<NoelleHexereiLocalStatPriorityDiagnosticReport> {
  const authentication =
    await authenticateNoelleHexereiLocalStatPriorityDiagnosticReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP56 authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export async function buildNoelleHexereiLocalStatPriorityDiagnosticReport(
  input: NoelleHexereiLocalStatPriorityDiagnosticInput,
): Promise<NoelleHexereiLocalStatPriorityDiagnosticReport> {
  const raw = authenticateOuterInputs(input);
  assertExactTechnicalRequest(input.technicalRequest);
  assertExactEvaluatorDomain();
  const boundCp55Input = buildBoundCp55Input(raw, input.cp55Input);
  if (stableJson(boundCp55Input) !== stableJson(input.cp55Input)) {
    throw new Error(
      "CP56 supplied CP55 input is not the exact projection of the outer authenticated byte closure.",
    );
  }
  const cp55Report =
    await requireAuthenticatedNoelleHexereiEquipmentResponseSurfaceReport(
      raw.cp55Report,
      boundCp55Input,
    );
  assertCp55SemanticBoundary(cp55Report);
  const sourcePriorityTargets = buildSourcePriorityTargets(cp55Report);
  const executedCells = await buildCells();
  const cells = executedCells.map(({ cell }) => cell);
  const artifactSheetCatalog = buildArtifactSheetCatalog(executedCells);
  const applicableBuffTraceCatalog =
    buildApplicableBuffTraceCatalog(executedCells);
  assertCatalogReferentialIntegrity(
    cells,
    artifactSheetCatalog,
    applicableBuffTraceCatalog,
  );
  const runtimeOptionEvidence = buildRuntimeOptionEvidence(
    cells,
    raw.sourceBytesByPath,
  );
  const localMarginals = buildLocalMarginals(cells);
  const sensitivityEdges = buildSensitivityEdges(cells);
  const sourceOrderDiagnostics = buildSourceOrderDiagnostics(
    cells,
    localMarginals,
  );
  const contextRobustnessRows = buildContextRobustnessRows(
    sourceOrderDiagnostics,
  );
  const cp55Reproductions = buildCp55Reproductions(cells, cp55Report);
  assertExecutionCardinality({
    cells,
    localMarginals,
    sensitivityEdges,
    sourceOrderDiagnostics,
    contextRobustnessRows,
    cp55Reproductions,
  });

  const cellsSha256 = hashValue(cells.map(({ cellSha256 }) => cellSha256));
  const localMarginalsSha256 = hashValue(
    localMarginals.map(({ marginalSha256 }) => marginalSha256),
  );
  const sensitivityEdgesSha256 = hashValue(
    sensitivityEdges.map(({ edgeSha256 }) => edgeSha256),
  );
  const sourceOrderDiagnosticsSha256 = hashValue(
    sourceOrderDiagnostics.map(({ diagnosticSha256 }) => diagnosticSha256),
  );
  const contextRobustnessRowsSha256 = hashValue(
    contextRobustnessRows.map(({ robustnessSha256 }) => robustnessSha256),
  );
  const cp55ReproductionsSha256 = hashValue(
    cp55Reproductions.map(({ reproductionSha256 }) => reproductionSha256),
  );
  const artifactSheetCatalogSha256 = hashValue(
    artifactSheetCatalog.map(({ catalogEntrySha256 }) => catalogEntrySha256),
  );
  const applicableBuffTraceCatalogSha256 = hashValue(
    applicableBuffTraceCatalog.map(
      ({ catalogEntrySha256 }) => catalogEntrySha256,
    ),
  );
  const aggregateDiagnosticSha256 = hashValue({
    artifactSheetCatalogSha256,
    applicableBuffTraceCatalogSha256,
    cellsSha256,
    localMarginalsSha256,
    sensitivityEdgesSha256,
    sourceOrderDiagnosticsSha256,
    contextRobustnessRowsSha256,
    cp55ReproductionsSha256,
  });

  return {
    schemaVersion: 1,
    reportType: "noelle-hexerei-local-stat-priority-diagnostic",
    diagnosticId: NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_ID,
    classification: "authenticated-offline-local-stat-priority-diagnostic",
    validationStatus: "completed-480-cell-local-diagnostic",
    publicationStatus: "withheld-technical-validation-only",
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromBytes: true,
      allSourceBytesMatchWorkspaceFiles: true,
      cp55ReportByteAndParsedObjectParity: true,
      exactCp55InputProjection: true,
      exactTechnicalRequest: true,
      sourceFileCount: 116,
      generatedFromCount: 116,
      runtimeInputPathCount: 80,
      jsonInputCount: 14,
      binaryRuntimeInputCount: 2,
    },
    upstreamBoundary: {
      cp55ReportPath: NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH,
      cp55ReportFileSha256: sha256Bytes(
        requiredSourceBytes(
          raw.sourceBytesByPath,
          NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH,
        ),
      ),
      cp55CanonicalObjectSha256: hashValue(cp55Report),
      cp55FreshlyAuthenticated: true,
      cp55CellCount: cp55Report.operationSummary.responseCellCount,
      cp55SelectionCount:
        cp55Report.operationSummary.sourceCandidateSelectionCount,
      cp55EnergyRecoveryComputationCount:
        cp55Report.operationSummary.energyRecoveryComputationCount,
      sourceAlignedDefaultBaselineReproductionCount: 24,
      everySourceAlignedDefaultBaselineExactlyReproduced: true,
    },
    authorityLedger: {
      sourceBacked: [
        "exact-roster-and-order",
        "two-investment-branch-predicates",
        "branch-local-source-aligned-sands",
        "unordered-crit-rate-or-crit-damage-circlet-options",
        "three-ordinal-offensive-substat-groups-per-branch",
        "husk-four-piece-observation",
        "gest-applicability-under-hexerei-section",
        "noelle-normal-action-prefix-counts",
      ],
      runtimeOrApplicationBacked: [
        "current-average-five-star-substat-roll-values",
        "nicole-option-definition-and-target-semantics",
        "husk-stack-option-definition-and-buff-semantics",
        "character-weapon-artifact-and-talent-stat-tables",
        "registered-buff-applicability-and-values",
        "direct-and-compiled-evaluation-paths",
      ],
      guideFactoryTechnical: [
        "six-threshold-relevant-investment-witnesses",
        "source-aligned-sands-only-experimental-restriction",
        "r1-and-r5-refinement-endpoints",
        "all-theosis-and-hexerei-theosis-sensitivity-states",
        "four-and-zero-husk-curiosity-stack-sensitivity-states",
        "independent-one-average-roll-probe-construction",
        "level-90-level-20-five-star-static-fixture-and-enemy-context",
        "single-noelle-formula-objective",
      ],
      computedValidationObservation: [
        "parent-to-one-roll-local-marginals",
        "single-axis-nicole-and-husk-sensitivity-edges",
        "adjacent-source-group-ordinal-outcomes",
        "four-context-sensitivity-robustness-rows",
      ],
      explicitlyMissing: [
        "source-selected-stat-circlet-refinement-support-option-or-husk-stacks",
        "source-selected-artifact-placement-or-complete-roll-allocation",
        "source-authored-scalar-stat-weights",
        "artifact-inventory-and-weapon-dependent-balance-policy",
        "rotation-timing-and-buff-coverage",
        "supporter-formula-counts-and-team-total",
        "energy-recharge-thresholds",
      ],
    },
    requestBoundary: {
      request: structuredClone(
        NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REQUEST,
      ),
      requestCanonicalObjectSha256: hashValue(
        NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REQUEST,
      ),
      sourceAuthored: false,
      sourceCandidateSelection: null,
      sourceStatSelection: null,
      sourceSupportOptionSelection: null,
      sourceHuskStackSelection: null,
      sourceRefinementSelection: null,
      sourceArtifactPlacementSelection: null,
      energyRecoveryDeferred: true,
    },
    experimentalDomain: {
      witnessIds: [...WITNESS_IDS],
      sourceAlignedSandsOnly: true,
      circletStats: [...CIRCLET_STATS],
      refinements: [...REFINEMENTS],
      nicoleModes: [...NICOLE_MODES],
      huskStackStates: [...HUSK_STACK_STATES],
      probeStats: [...PROBE_STATS],
      averageRollDeltas: { ...AVERAGE_ROLL_DELTAS },
      averageRollValueOrigin: "current-AVG_SUBSTAT_ROLL-application-constant",
      huskZeroSemantics:
        "zero-curiosity-stacks-four-piece-equipped-two-piece-retained",
      nicoleHexereiModeSemantics:
        "theosis-uplift-target-restricted-base-kenosis-retained",
      groupedCritWithinGroupOrderInferred: false,
      scalarWeightsPresent: false,
      branchAveragePresent: false,
    },
    runtimeOptionEvidence,
    sourcePriorityTargets,
    artifactSheetCatalog,
    applicableBuffTraceCatalog,
    cells,
    localMarginals,
    sensitivityEdges,
    sourceOrderDiagnostics,
    contextRobustnessRows,
    cp55Reproductions,
    identityBoundary: {
      artifactSheetCatalogSha256,
      applicableBuffTraceCatalogSha256,
      cellsSha256,
      localMarginalsSha256,
      sensitivityEdgesSha256,
      sourceOrderDiagnosticsSha256,
      contextRobustnessRowsSha256,
      cp55ReproductionsSha256,
      aggregateDiagnosticSha256,
      serializationOrderIsNotRank: true,
      everyProbeHasExactlyOneParentBaseline: true,
      everySensitivityEdgeChangesExactlyOneDeclaredAxis: true,
      everyCellCatalogReferenceResolvedExactlyOnce: true,
      everyEvaluationSha256ReconstructedFromCompactEvidenceAndCatalogs: true,
    },
    operationSummary: {
      countingScope:
        "cp56-local-diagnostic-only-excludes-upstream-authentication-work",
      upstreamAuthenticationOperationsExcluded: true,
      freshlyRecomputedUpstreamCp55CellCount: 48,
      investmentWitnessCount: 6,
      sourceAlignedSandsStateCount: 1,
      circletStateCount: 2,
      refinementStateCount: 2,
      nicoleModeCount: 2,
      huskStackStateCount: 2,
      probeStatCount: 4,
      baselineCellCount: 96,
      probeCellCount: 384,
      freshCellCount: 480,
      freshTeamBuildCount: 960,
      objectiveTeamBuildCount: 480,
      huskTwoPieceControlTeamBuildCount: 480,
      formulaProjectionRunCount: 480,
      compilerBuildCount: 480,
      directDamageEvaluationCount: 480,
      compiledDamageEvaluationCount: 480,
      directCompiledAgreementCount: 480,
      localMarginalCount: 384,
      sensitivityEdgeCount: 480,
      nicoleSensitivityEdgeCount: 240,
      huskSensitivityEdgeCount: 240,
      sourceOrderDiagnosticCount: 288,
      contextRobustnessRowCount: 72,
      cp55ReproductionCount: 24,
      artifactSheetCatalogEntryCount: 20,
      artifactSheetCatalogReferenceCount: 480,
      applicableBuffTraceCatalogEntryCount: 96,
      applicableBuffTraceCatalogReferenceCount: 480,
      scalarWeightCount: 0,
      selectedStatCount: 0,
      selectedCircletCount: 0,
      selectedRefinementCount: 0,
      selectedSupportOptionCount: 0,
      selectedHuskStackCount: 0,
      selectedArtifactPlacementCount: 0,
      branchAverageCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      idealStatAllocationCount: 0,
      sourceRotationReplayCount: 0,
      sourceTeamTotalDamageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    },
    supportsSourceAuthorization: false,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsBuildRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsWinnerClaims: false,
    supportsPlayerDamageClaims: false,
    supportsSourceRotationReplay: false,
    supportsTeamTotalDamageComputation: false,
    supportsDpsClaims: false,
    supportsBuffTimingClaims: false,
    supportsEnergyRecoveryClaims: false,
    supportsIdealStatAllocation: false,
    localStatPriorityDiagnosticExecuted: true,
    sourceCandidateSelectionExecuted: false,
    sourceStatSelectionExecuted: false,
    sourceSubstatPriorityValidated: false,
    optimizerExecuted: false,
    autoTuneExecuted: false,
    idealStatAllocationExecuted: false,
    energyRecoveryComputationExecuted: false,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

async function buildCells(): Promise<
  ExecutedNoelleHexereiLocalStatPriorityCell[]
> {
  const cells: ExecutedNoelleHexereiLocalStatPriorityCell[] = [];
  let sequence = 0;
  for (const witness of NOELLE_HEXEREI_POINT_WITNESSES) {
    for (const circlet of CIRCLET_STATS) {
      for (const refinement of REFINEMENTS) {
        for (const nicoleMode of NICOLE_MODES) {
          for (const huskStacks of HUSK_STACK_STATES) {
            const baselineRequest: NoelleHexereiTechnicalPointRequest = {
              witnessId: witness.witnessId,
              sourceAlignedSands: witness.sourceAlignedSands,
              circlet,
              refinement,
              nicoleMode,
              huskStacks,
              probeStat: null,
            };
            const baseline = await executeCell(
              sequence,
              baselineRequest,
              null,
            );
            cells.push(baseline);
            sequence += 1;
            for (const probeStat of PROBE_STATS) {
              cells.push(
                await executeCell(
                  sequence,
                  { ...baselineRequest, probeStat },
                  baseline.cell.cellId,
                ),
              );
              sequence += 1;
            }
          }
        }
      }
    }
  }
  return cells;
}

async function executeCell(
  sequence: number,
  request: NoelleHexereiTechnicalPointRequest,
  parentBaselineCellId: string | null,
): Promise<ExecutedNoelleHexereiLocalStatPriorityCell> {
  const evaluation = await evaluateNoelleHexereiTechnicalPoint(request);
  const { evaluationSha256, ...evaluationPayload } = evaluation;
  if (
    evaluationSha256 !== hashValue(evaluationPayload) ||
    stableJson(evaluation.request) !== stableJson(request) ||
    !evaluation.objective.directCompiledAgreement
  ) {
    throw new Error(`CP56 helper evaluation integrity drifted at ${evaluation.evaluationId}.`);
  }
  const profileId = evaluation.witness.profileId;
  const sourceAlignedSands = request.sourceAlignedSands;
  const probe = buildProbeDescriptor(
    request.probeStat,
    sourceAlignedSands,
    request.circlet,
  );
  if (
    evaluation.probe.value !== probe.averageRollValue ||
    evaluation.probe.valueOrigin !== probe.averageRollValueOrigin ||
    evaluation.probe.independentOneRollNeighbor !==
      probe.independentOneRollNeighbor ||
    (request.probeStat == null) !== (parentBaselineCellId == null)
  ) {
    throw new Error(`CP56 probe boundary drifted at ${evaluation.evaluationId}.`);
  }
  const cellInput = {
    request,
    parentBaselineCellId,
    evaluationInputSha256: evaluation.evaluationInputSha256,
  };
  const compactEvaluation = compactTechnicalPointEvidence(evaluation);
  const withoutHash = {
    sequence,
    cellId: evaluation.evaluationId,
    parentBaselineCellId,
    witnessId: request.witnessId,
    profileId,
    sourceAlignedSands,
    circlet: request.circlet,
    refinement: request.refinement,
    nicoleMode: request.nicoleMode,
    huskStacks: request.huskStacks,
    probe,
    evaluation: compactEvaluation,
    directTotal: evaluation.objective.directTotal,
    cellInputSha256: hashValue(cellInput),
  };
  return {
    cell: { ...withoutHash, cellSha256: hashValue(withoutHash) },
    normalizedEntries: structuredClone(
      evaluation.artifactSheet.normalizedEntries,
    ),
    buffTrace: structuredClone(evaluation.runtimeTrace.buffTrace),
  };
}

function compactTechnicalPointEvidence(
  evaluation: NoelleHexereiTechnicalPointEvaluation,
): NoelleHexereiCompactTechnicalPointEvidence {
  const { buffTrace: _buffTrace, ...runtimeTraceWithoutRows } =
    evaluation.runtimeTrace;
  return {
    evaluationInputSha256: evaluation.evaluationInputSha256,
    evaluationSha256: evaluation.evaluationSha256,
    witness: structuredClone(evaluation.witness),
    probe: structuredClone(evaluation.probe),
    artifactSheet: {
      mainStats: structuredClone(evaluation.artifactSheet.mainStats),
      normalizedEntriesSha256:
        evaluation.artifactSheet.normalizedEntriesSha256,
      substatEntryCount: evaluation.artifactSheet.substatEntryCount,
      legalCompleteArtifactBuild:
        evaluation.artifactSheet.legalCompleteArtifactBuild,
    },
    runtimeTrace: {
      ...structuredClone(runtimeTraceWithoutRows),
      canonicalApplicableBuffTraceSha256:
        canonicalBuffTraceSha256(evaluation.runtimeTrace.buffTrace),
    },
    formulaProjection: structuredClone(evaluation.formulaProjection),
    objective: structuredClone(evaluation.objective),
  };
}

function buildArtifactSheetCatalog(
  executedCells: readonly ExecutedNoelleHexereiLocalStatPriorityCell[],
): NoelleHexereiArtifactSheetCatalogEntry[] {
  const groups = new Map<
    string,
    {
      normalizedEntries: NoelleHexereiTechnicalPointEvaluation["artifactSheet"]["normalizedEntries"];
      referencingCellIds: string[];
    }
  >();
  for (const { cell, normalizedEntries } of executedCells) {
    const key = cell.evaluation.artifactSheet.normalizedEntriesSha256;
    if (hashValue(normalizedEntries) !== key) {
      throw new Error(`CP56 artifact-sheet payload hash drifted at ${cell.cellId}.`);
    }
    const existing = groups.get(key);
    if (existing) {
      if (stableJson(existing.normalizedEntries) !== stableJson(normalizedEntries)) {
        throw new Error(`CP56 artifact-sheet hash collision at ${cell.cellId}.`);
      }
      existing.referencingCellIds.push(cell.cellId);
    } else {
      groups.set(key, {
        normalizedEntries: structuredClone(normalizedEntries),
        referencingCellIds: [cell.cellId],
      });
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([normalizedEntriesSha256, group]) => {
      const withoutHash = {
        normalizedEntriesSha256,
        observedCellCount: group.referencingCellIds.length,
        referencingCellIds: [...group.referencingCellIds].sort(compareText),
        normalizedEntries: group.normalizedEntries,
      };
      return {
        ...withoutHash,
        catalogEntrySha256: hashValue(withoutHash),
      };
    });
}

function buildApplicableBuffTraceCatalog(
  executedCells: readonly ExecutedNoelleHexereiLocalStatPriorityCell[],
): NoelleHexereiApplicableBuffTraceCatalogEntry[] {
  const groups = new Map<
    string,
    {
      canonicalApplicableBuffTraceSha256: string;
      buffTrace: NoelleHexereiTechnicalPointEvaluation["runtimeTrace"]["buffTrace"];
      referencingCellIds: string[];
    }
  >();
  for (const { cell, buffTrace } of executedCells) {
    const key = cell.evaluation.runtimeTrace.applicableBuffTraceSha256;
    const canonical = canonicalBuffTraceSha256(buffTrace);
    if (
      hashValue(buffTrace) !== key ||
      canonical !==
        cell.evaluation.runtimeTrace.canonicalApplicableBuffTraceSha256
    ) {
      throw new Error(`CP56 applicable-buff trace payload hash drifted at ${cell.cellId}.`);
    }
    const existing = groups.get(key);
    if (existing) {
      if (
        stableJson(existing.buffTrace) !== stableJson(buffTrace) ||
        existing.canonicalApplicableBuffTraceSha256 !== canonical
      ) {
        throw new Error(`CP56 applicable-buff trace hash collision at ${cell.cellId}.`);
      }
      existing.referencingCellIds.push(cell.cellId);
    } else {
      groups.set(key, {
        canonicalApplicableBuffTraceSha256: canonical,
        buffTrace: structuredClone(buffTrace),
        referencingCellIds: [cell.cellId],
      });
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([applicableBuffTraceSha256, group]) => {
      const withoutHash = {
        applicableBuffTraceSha256,
        canonicalApplicableBuffTraceSha256:
          group.canonicalApplicableBuffTraceSha256,
        observedCellCount: group.referencingCellIds.length,
        referencingCellIds: [...group.referencingCellIds].sort(compareText),
        buffTrace: group.buffTrace,
      };
      return {
        ...withoutHash,
        catalogEntrySha256: hashValue(withoutHash),
      };
    });
}

function assertCatalogReferentialIntegrity(
  cells: readonly NoelleHexereiLocalStatPriorityCell[],
  artifactSheetCatalog: readonly NoelleHexereiArtifactSheetCatalogEntry[],
  applicableBuffTraceCatalog: readonly NoelleHexereiApplicableBuffTraceCatalogEntry[],
): void {
  const sheetByHash = new Map(
    artifactSheetCatalog.map((entry) => [
      entry.normalizedEntriesSha256,
      entry,
    ] as const),
  );
  const traceByHash = new Map(
    applicableBuffTraceCatalog.map((entry) => [
      entry.applicableBuffTraceSha256,
      entry,
    ] as const),
  );
  if (
    cells.length !== 480 ||
    artifactSheetCatalog.length !== 20 ||
    applicableBuffTraceCatalog.length !== 96 ||
    sheetByHash.size !== artifactSheetCatalog.length ||
    traceByHash.size !== applicableBuffTraceCatalog.length ||
    artifactSheetCatalog.reduce(
      (sum, { observedCellCount }) => sum + observedCellCount,
      0,
    ) !== 480 ||
    applicableBuffTraceCatalog.reduce(
      (sum, { observedCellCount }) => sum + observedCellCount,
      0,
    ) !== 480
  ) {
    throw new Error("CP56 catalog cardinality drifted.");
  }
  const expectedCellIds = [...cells.map(({ cellId }) => cellId)].sort(compareText);
  for (const catalog of [artifactSheetCatalog, applicableBuffTraceCatalog]) {
    const referencedCellIds = catalog
      .flatMap(({ referencingCellIds }) => referencingCellIds)
      .sort(compareText);
    if (stableJson(referencedCellIds) !== stableJson(expectedCellIds)) {
      throw new Error("CP56 catalog cell-reference partition drifted.");
    }
  }
  for (const entry of artifactSheetCatalog) {
    const { catalogEntrySha256, ...withoutHash } = entry;
    if (
      hashValue(withoutHash) !== catalogEntrySha256 ||
      hashValue(entry.normalizedEntries) !== entry.normalizedEntriesSha256 ||
      entry.referencingCellIds.length !== entry.observedCellCount
    ) {
      throw new Error(
        `CP56 artifact-sheet catalog integrity drifted at ${entry.normalizedEntriesSha256}.`,
      );
    }
  }
  for (const entry of applicableBuffTraceCatalog) {
    const { catalogEntrySha256, ...withoutHash } = entry;
    if (
      hashValue(withoutHash) !== catalogEntrySha256 ||
      hashValue(entry.buffTrace) !== entry.applicableBuffTraceSha256 ||
      canonicalBuffTraceSha256(entry.buffTrace) !==
        entry.canonicalApplicableBuffTraceSha256 ||
      entry.referencingCellIds.length !== entry.observedCellCount
    ) {
      throw new Error(
        `CP56 applicable-buff trace catalog integrity drifted at ${entry.applicableBuffTraceSha256}.`,
      );
    }
  }
  for (const cell of cells) {
    const sheet = sheetByHash.get(
      cell.evaluation.artifactSheet.normalizedEntriesSha256,
    );
    const trace = traceByHash.get(
      cell.evaluation.runtimeTrace.applicableBuffTraceSha256,
    );
    if (
      !sheet ||
      !trace ||
      !sheet.referencingCellIds.includes(cell.cellId) ||
      !trace.referencingCellIds.includes(cell.cellId)
    ) {
      throw new Error(`CP56 catalog reference is unresolved at ${cell.cellId}.`);
    }
    const request: NoelleHexereiTechnicalPointRequest = {
      witnessId: cell.witnessId,
      sourceAlignedSands: cell.sourceAlignedSands,
      circlet: cell.circlet,
      refinement: cell.refinement,
      nicoleMode: cell.nicoleMode,
      huskStacks: cell.huskStacks,
      probeStat: cell.probe.stat,
    };
    const {
      canonicalApplicableBuffTraceSha256: _canonicalApplicableBuffTraceSha256,
      ...runtimeTraceWithoutCatalogMetadata
    } = cell.evaluation.runtimeTrace;
    const reconstructedEvaluation = {
      evaluationId: cell.cellId,
      evaluationInputSha256: cell.evaluation.evaluationInputSha256,
      request,
      witness: cell.evaluation.witness,
      probe: cell.evaluation.probe,
      artifactSheet: {
        ...cell.evaluation.artifactSheet,
        normalizedEntries: sheet.normalizedEntries,
      },
      runtimeTrace: {
        ...runtimeTraceWithoutCatalogMetadata,
        buffTrace: trace.buffTrace,
      },
      formulaProjection: cell.evaluation.formulaProjection,
      objective: cell.evaluation.objective,
    };
    if (
      hashValue(reconstructedEvaluation) !== cell.evaluation.evaluationSha256
    ) {
      throw new Error(
        `CP56 compact evidence cannot reconstruct helper evaluation ${cell.cellId}.`,
      );
    }
  }
}

function buildProbeDescriptor(
  probeStat: NoelleHexereiDiagnosticProbeStat | null,
  sands: NoelleHexereiDiagnosticSandsStat,
  circlet: NoelleHexereiDiagnosticCircletStat,
): NoelleHexereiDiagnosticProbeDescriptor {
  if (probeStat == null) {
    return {
      probeState: "baseline",
      stat: null,
      averageRollValue: 0,
      averageRollValueOrigin: "not-applicable-baseline",
      nonConflictingPlacementSlotDomain: [],
      placementSlotChosen: null,
      placementSelectionExecuted: false,
      independentOneRollNeighbor: false,
    };
  }
  const mainStatsBySlot: Record<NoelleHexereiDiagnosticArtifactSlot, string> = {
    flower: "hp",
    plume: "atk",
    sands,
    goblet: "geo%",
    circlet,
  };
  return {
    probeState: probeStat,
    stat: probeStat,
    averageRollValue: AVERAGE_ROLL_DELTAS[probeStat],
    averageRollValueOrigin: "current-AVG_SUBSTAT_ROLL-application-constant",
    nonConflictingPlacementSlotDomain: (
      Object.keys(mainStatsBySlot) as NoelleHexereiDiagnosticArtifactSlot[]
    ).filter((slot) => mainStatsBySlot[slot] !== probeStat),
    placementSlotChosen: null,
    placementSelectionExecuted: false,
    independentOneRollNeighbor: true,
  };
}

function buildLocalMarginals(
  cells: readonly NoelleHexereiLocalStatPriorityCell[],
): NoelleHexereiLocalMarginal[] {
  const byId = new Map(cells.map((cell) => [cell.cellId, cell] as const));
  return cells
    .filter(({ probe }) => probe.stat != null)
    .map((probeCell) => {
      const baseline =
        probeCell.parentBaselineCellId == null
          ? undefined
          : byId.get(probeCell.parentBaselineCellId);
      if (
        !baseline ||
        baseline.probe.stat != null ||
        !sameFixedContext(baseline, probeCell) ||
        probeCell.probe.stat == null ||
        baseline.directTotal <= 0
      ) {
        throw new Error(
          `CP56 probe ${probeCell.cellId} lacks one exact positive parent baseline.`,
        );
      }
      const absoluteDelta = probeCell.directTotal - baseline.directTotal;
      const withoutHash = {
        marginalId: `${probeCell.cellId}:minus:${baseline.cellId}`,
        baselineCellId: baseline.cellId,
        probeCellId: probeCell.cellId,
        probeStat: probeCell.probe.stat,
        averageRollValue: probeCell.probe.averageRollValue,
        absoluteDelta: normalizeNumber(absoluteDelta),
        relativeDelta: normalizeNumber(absoluteDelta / baseline.directTotal),
        localOneStepNeighborOnly: true as const,
        scalarWeight: null,
      };
      return { ...withoutHash, marginalSha256: hashValue(withoutHash) };
    });
}

function buildSensitivityEdges(
  cells: readonly NoelleHexereiLocalStatPriorityCell[],
): NoelleHexereiSensitivityEdge[] {
  const edges: NoelleHexereiSensitivityEdge[] = [];
  const probeStates: NoelleHexereiDiagnosticProbeState[] = [
    "baseline",
    ...PROBE_STATS,
  ];
  for (const witnessId of WITNESS_IDS) {
    for (const circlet of CIRCLET_STATS) {
      for (const refinement of REFINEMENTS) {
        for (const probeState of probeStates) {
          for (const huskStacks of HUSK_STACK_STATES) {
            edges.push(
              makeSensitivityEdge(
                "nicoleMode",
                requireCell(cells, {
                  witnessId,
                  circlet,
                  refinement,
                  nicoleMode: "all-theosis",
                  huskStacks,
                  probeState,
                }),
                requireCell(cells, {
                  witnessId,
                  circlet,
                  refinement,
                  nicoleMode: "hexerei-theosis",
                  huskStacks,
                  probeState,
                }),
              ),
            );
          }
          for (const nicoleMode of NICOLE_MODES) {
            edges.push(
              makeSensitivityEdge(
                "huskStacks",
                requireCell(cells, {
                  witnessId,
                  circlet,
                  refinement,
                  nicoleMode,
                  huskStacks: 4,
                  probeState,
                }),
                requireCell(cells, {
                  witnessId,
                  circlet,
                  refinement,
                  nicoleMode,
                  huskStacks: 0,
                  probeState,
                }),
              ),
            );
          }
        }
      }
    }
  }
  return edges;
}

function makeSensitivityEdge(
  changedAxis: NoelleHexereiSensitivityEdge["changedAxis"],
  left: NoelleHexereiLocalStatPriorityCell,
  right: NoelleHexereiLocalStatPriorityCell,
): NoelleHexereiSensitivityEdge {
  const changed = [
    left.witnessId === right.witnessId ? null : "witnessId",
    left.sourceAlignedSands === right.sourceAlignedSands ? null : "sands",
    left.circlet === right.circlet ? null : "circlet",
    left.refinement === right.refinement ? null : "refinement",
    left.nicoleMode === right.nicoleMode ? null : "nicoleMode",
    left.huskStacks === right.huskStacks ? null : "huskStacks",
    left.probe.probeState === right.probe.probeState ? null : "probeState",
  ].filter((axis): axis is string => axis != null);
  if (stableJson(changed) !== stableJson([changedAxis])) {
    throw new Error(
      `CP56 sensitivity edge changed ${changed.join(",") || "no axes"}, expected ${changedAxis}.`,
    );
  }
  const fixedAxisPayload = {
    witnessId: left.witnessId,
    sourceAlignedSands: left.sourceAlignedSands,
    circlet: left.circlet,
    refinement: left.refinement,
    nicoleMode: changedAxis === "nicoleMode" ? null : left.nicoleMode,
    huskStacks: changedAxis === "huskStacks" ? null : left.huskStacks,
    probeState: left.probe.probeState,
  };
  const withoutHash = {
    edgeId: `${changedAxis}:${left.cellId}::${right.cellId}`,
    changedAxis,
    leftCellId: left.cellId,
    rightCellId: right.cellId,
    probeState: left.probe.probeState,
    exactlyOneSensitivityAxisChanged: true as const,
    fixedAxisPayloadSha256: hashValue(fixedAxisPayload),
    signedLeftMinusRightDelta: normalizeNumber(
      left.directTotal - right.directTotal,
    ),
    sourceExpectedOrdering: null,
    choiceProduced: false as const,
  };
  return { ...withoutHash, edgeSha256: hashValue(withoutHash) };
}

function buildSourceOrderDiagnostics(
  cells: readonly NoelleHexereiLocalStatPriorityCell[],
  marginals: readonly NoelleHexereiLocalMarginal[],
): NoelleHexereiSourceOrderDiagnostic[] {
  const diagnostics: NoelleHexereiSourceOrderDiagnostic[] = [];
  const baselineCells = cells.filter(({ probe }) => probe.stat == null);
  for (const baseline of baselineCells) {
    const candidates = marginals.filter(
      ({ baselineCellId }) => baselineCellId === baseline.cellId,
    );
    if (candidates.length !== 4) {
      throw new Error(
        `CP56 baseline ${baseline.cellId} does not have four local marginals.`,
      );
    }
    for (const relation of SOURCE_PRIORITY_RELATIONS[baseline.profileId]) {
      const higher = requireMarginal(candidates, relation.higherStat);
      const lower = requireMarginal(candidates, relation.lowerStat);
      const signedDelta = higher.absoluteDelta - lower.absoluteDelta;
      const allowedDifference = comparisonTolerance(
        higher.absoluteDelta,
        lower.absoluteDelta,
      );
      const outcome: NoelleHexereiOrdinalOutcome =
        signedDelta > allowedDifference
          ? "source-order-aligned"
          : signedDelta < -allowedDifference
            ? "source-order-counterexample"
            : "within-tolerance-inconclusive";
      const withoutHash = {
        diagnosticId: `${baseline.cellId}:source-order:${relation.relationId}`,
        witnessId: baseline.witnessId,
        profileId: baseline.profileId,
        circlet: baseline.circlet,
        refinement: baseline.refinement,
        nicoleMode: baseline.nicoleMode,
        huskStacks: baseline.huskStacks,
        sourceRelationId: relation.relationId,
        higherPriorityStat: relation.higherStat,
        lowerPriorityStat: relation.lowerStat,
        higherPriorityMarginalId: higher.marginalId,
        lowerPriorityMarginalId: lower.marginalId,
        signedHigherMinusLowerDelta: normalizeNumber(signedDelta),
        allowedDifference,
        outcome,
        adjacentSourceGroupsOnly: true as const,
        validationTargetOnly: true as const,
        sourcePriorityValidated: false as const,
      };
      diagnostics.push({
        ...withoutHash,
        diagnosticSha256: hashValue(withoutHash),
      });
    }
  }
  return diagnostics;
}

function buildContextRobustnessRows(
  diagnostics: readonly NoelleHexereiSourceOrderDiagnostic[],
): NoelleHexereiContextRobustnessRow[] {
  const rows: NoelleHexereiContextRobustnessRow[] = [];
  for (const witnessId of WITNESS_IDS) {
    for (const circlet of CIRCLET_STATS) {
      for (const refinement of REFINEMENTS) {
        const profileId = profileForWitness(witnessId);
        for (const relation of SOURCE_PRIORITY_RELATIONS[profileId]) {
          const candidates = diagnostics.filter(
            (diagnostic) =>
              diagnostic.witnessId === witnessId &&
              diagnostic.circlet === circlet &&
              diagnostic.refinement === refinement &&
              diagnostic.sourceRelationId === relation.relationId,
          );
          if (
            candidates.length !== 4 ||
            new Set(
              candidates.map(
                ({ nicoleMode, huskStacks }) =>
                  `${nicoleMode}:${huskStacks}`,
              ),
            ).size !== 4
          ) {
            throw new Error(
              `CP56 robustness row lacks the exact sensitivity grid for ${witnessId}/${circlet}/R${refinement}/${relation.relationId}.`,
            );
          }
          const sorted = [...candidates].sort((left, right) =>
            compareText(left.diagnosticId, right.diagnosticId),
          );
          const aligned = sorted.filter(
            ({ outcome }) => outcome === "source-order-aligned",
          ).length;
          const counterexample = sorted.filter(
            ({ outcome }) => outcome === "source-order-counterexample",
          ).length;
          const inconclusive = sorted.length - aligned - counterexample;
          const observedOutcomeSet = [
            ...new Set(sorted.map(({ outcome }) => outcome)),
          ].sort(compareText);
          const classification =
            aligned === 4
              ? ("aligned-across-tested-sensitivity-grid" as const)
              : counterexample === 4
                ? ("counterexample-across-tested-sensitivity-grid" as const)
                : ("context-dependent-or-inconclusive" as const);
          const withoutHash = {
            robustnessId: [
              witnessId,
              circlet,
              `r${refinement}`,
              relation.relationId,
              "sensitivity-robustness",
            ].join(":"),
            witnessId,
            profileId,
            circlet,
            refinement,
            sourceRelationId: relation.relationId,
            higherPriorityStat: relation.higherStat,
            lowerPriorityStat: relation.lowerStat,
            sensitivityContextCount: 4 as const,
            diagnosticIds: sorted.map(({ diagnosticId }) => diagnosticId),
            sourceOrderAlignedCount: aligned,
            sourceOrderCounterexampleCount: counterexample,
            withinToleranceInconclusiveCount: inconclusive,
            observedOutcomeSet,
            classification,
            branchAverageComputed: false as const,
            scalarWeightComputed: false as const,
            supportsUniversalPriorityClaim: false as const,
          };
          rows.push({
            ...withoutHash,
            robustnessSha256: hashValue(withoutHash),
          });
        }
      }
    }
  }
  return rows;
}

function buildCp55Reproductions(
  cells: readonly NoelleHexereiLocalStatPriorityCell[],
  cp55Report: NoelleHexereiEquipmentResponseSurfaceReport,
): NoelleHexereiCp55Reproduction[] {
  const reproductions: NoelleHexereiCp55Reproduction[] = [];
  for (const witness of NOELLE_HEXEREI_POINT_WITNESSES) {
    for (const circlet of CIRCLET_STATS) {
      for (const refinement of REFINEMENTS) {
        const cp56Cell = requireCell(cells, {
          witnessId: witness.witnessId,
          circlet,
          refinement,
          nicoleMode: "all-theosis",
          huskStacks: 4,
          probeState: "baseline",
        });
        const cp55Cell = requireCp55Cell(
          cp55Report.surface.cells,
          witness.witnessId,
          witness.sourceAlignedSands,
          circlet,
          refinement,
        );
        const cp55Projection = cp55ComparableProjection(cp55Cell, cp55Report);
        const cp56Projection = cp56ComparableProjection(cp56Cell);
        assertComparableProjectionMatch(
          cp55Projection,
          cp56Projection,
          cp55Cell.cellId,
        );
        const cp55ComparableProjectionSha256 = hashValue(
          cp55Projection,
        );
        const cp56ComparableProjectionSha256 = hashValue(
          cp56Projection,
        );
        if (
          cp55ComparableProjectionSha256 !== cp56ComparableProjectionSha256
        ) {
          throw new Error(
            `CP56 canonical CP55 reproduction hash mismatch at ${cp55Cell.cellId}.`,
          );
        }
        const withoutHash = {
          reproductionId: `cp55:${cp55Cell.cellId}:reproduced-by:${cp56Cell.cellId}`,
          cp55CellId: cp55Cell.cellId,
          cp56CellId: cp56Cell.cellId,
          witnessId: witness.witnessId,
          circlet,
          refinement,
          nicoleMode: "all-theosis" as const,
          huskStacks: 4 as const,
          sourceAlignedSandsOnly: true as const,
          cp55ComparableProjectionSha256,
          cp56ComparableProjectionSha256,
          exactComparableProjectionMatch: true as const,
        };
        reproductions.push({
          ...withoutHash,
          reproductionSha256: hashValue(withoutHash),
        });
      }
    }
  }
  return reproductions;
}

interface ComparableProjection {
  witnessId: string;
  profileId: string;
  constellation: number;
  enteredTalentLevels: Record<string, number>;
  runtimeEffectiveTalentLevels: Record<string, number>;
  runtimeTalentEvidence: Record<string, unknown>;
  sourcePredicateSatisfiedByEnteredFacts: boolean;
  sourceAlignedSands: string;
  circlet: string;
  refinement: number;
  artifactSheetSha256: string;
  runtimeTrace: Record<string, unknown>;
  formulaProjection: Record<string, unknown>;
  objective: {
    directTotal: number;
    compiledTotal: number;
    absoluteDifference: number;
    allowedDifference: number;
    directCompiledAgreement: boolean;
    resolvedNoelleStats: {
      atk: number;
      def: number;
      cr: number;
      cd: number;
      geoNormalDamageBonus: number;
    };
    numericClassification: string;
  };
}

function cp55ComparableProjection(
  cell: NoelleHexereiEquipmentResponseCell,
  report: NoelleHexereiEquipmentResponseSurfaceReport,
): ComparableProjection {
  const traceRows = requireCp55TraceRows(report, cell);
  return {
    witnessId: cell.witnessId,
    profileId: cell.profileId,
    constellation: cell.enteredConstellation,
    enteredTalentLevels: cell.enteredTalentLevels,
    runtimeEffectiveTalentLevels: cell.runtimeEffectiveTalentLevels,
    runtimeTalentEvidence: cell.runtimeTalentEvidence,
    sourcePredicateSatisfiedByEnteredFacts:
      cell.sourcePredicateSatisfiedByEnteredFacts,
    sourceAlignedSands: cell.sands,
    circlet: cell.circlet,
    refinement: cell.refinement,
    artifactSheetSha256: cell.artifactSheet.sheetSha256,
    runtimeTrace: {
      registeredBuffCount: cell.runtimeTrace.registeredBuffCount,
      registeredBuffLedgerSha256:
        cell.runtimeTrace.registeredBuffLedgerSha256,
      applicableBuffCountForOnFieldNoelle:
        cell.runtimeTrace.applicableBuffCountForOnFieldNoelle,
      canonicalApplicableBuffTraceSha256: canonicalBuffTraceSha256(traceRows),
      computedBuffOverrideKeys: cell.runtimeTrace.computedBuffOverrideKeys,
      computedBuffOverrideCountDoesNotRepresentApplicableBuffCount:
        cell.runtimeTrace
          .computedBuffOverrideCountDoesNotRepresentApplicableBuffCount,
      gestBuffCount: cell.runtimeTrace.gestBuffCount,
      gestDamageBonus: cell.runtimeTrace.gestDamageBonus,
      gestCritDamage: cell.runtimeTrace.gestCritDamage,
      gestAttackSpeed: cell.runtimeTrace.gestAttackSpeed,
      huskCuriosityBuffCount: cell.runtimeTrace.huskBuffCount,
      huskDefenseBonus: cell.runtimeTrace.huskDefenseBonus,
      huskGeoDamageBonus: cell.runtimeTrace.huskGeoDamageBonus,
      geoResonanceBuffCount: cell.runtimeTrace.geoResonanceBuffCount,
      geoResonanceDamageBonus: cell.runtimeTrace.geoResonanceDamageBonus,
      geoResonanceResistanceReduction:
        cell.runtimeTrace.geoResonanceResistanceReduction,
      teammateWeaponBuffCount: cell.runtimeTrace.teammateWeaponBuffCount,
      exactRequiredBuffValuesVerified:
        cell.runtimeTrace.exactRequiredBuffValuesVerified,
      compilerVariableCount: cell.runtimeTrace.compilerVariableCount,
      compilerNoelleCharacterIndex:
        cell.runtimeTrace.compilerNoelleCharacterIndex,
      compilerErConstraintPresent:
        cell.runtimeTrace.compilerErConstraintPresent,
    },
    formulaProjection: cell.formulaProjection,
    objective: cell.objective,
  };
}

function cp56ComparableProjection(
  cell: NoelleHexereiLocalStatPriorityCell,
): ComparableProjection {
  const evaluation = cell.evaluation;
  return {
    witnessId: cell.witnessId,
    profileId: cell.profileId,
    constellation: evaluation.witness.constellation,
    enteredTalentLevels: evaluation.witness.enteredTalentLevels,
    runtimeEffectiveTalentLevels:
      evaluation.witness.runtimeEffectiveTalentLevels,
    runtimeTalentEvidence: evaluation.witness.runtimeTalentEvidence,
    sourcePredicateSatisfiedByEnteredFacts:
      evaluation.witness.sourcePredicateSatisfiedByEnteredFacts,
    sourceAlignedSands: cell.sourceAlignedSands,
    circlet: cell.circlet,
    refinement: cell.refinement,
    artifactSheetSha256: evaluation.artifactSheet.normalizedEntriesSha256,
    runtimeTrace: {
      registeredBuffCount: evaluation.runtimeTrace.registeredBuffCount,
      registeredBuffLedgerSha256:
        evaluation.runtimeTrace.registeredBuffLedgerSha256,
      applicableBuffCountForOnFieldNoelle:
        evaluation.runtimeTrace.applicableBuffCountForOnFieldNoelle,
      canonicalApplicableBuffTraceSha256:
        evaluation.runtimeTrace.canonicalApplicableBuffTraceSha256,
      computedBuffOverrideKeys:
        evaluation.runtimeTrace.computedBuffOverrideKeys,
      computedBuffOverrideCountDoesNotRepresentApplicableBuffCount:
        evaluation.runtimeTrace
          .computedBuffOverrideCountDoesNotRepresentApplicableBuffCount,
      gestBuffCount: evaluation.runtimeTrace.gestBuffCount,
      gestDamageBonus: evaluation.runtimeTrace.gestDamageBonus,
      gestCritDamage: evaluation.runtimeTrace.gestCritDamage,
      gestAttackSpeed: evaluation.runtimeTrace.gestAttackSpeed,
      huskCuriosityBuffCount:
        evaluation.runtimeTrace.huskCuriosityBuffCount,
      huskDefenseBonus: evaluation.runtimeTrace.huskDefenseBonus,
      huskGeoDamageBonus: evaluation.runtimeTrace.huskGeoDamageBonus,
      geoResonanceBuffCount:
        evaluation.runtimeTrace.geoResonanceBuffCount,
      geoResonanceDamageBonus:
        evaluation.runtimeTrace.geoResonanceDamageBonus,
      geoResonanceResistanceReduction:
        evaluation.runtimeTrace.geoResonanceResistanceReduction,
      teammateWeaponBuffCount:
        evaluation.runtimeTrace.teammateWeaponBuffCount,
      exactRequiredBuffValuesVerified:
        evaluation.runtimeTrace.exactRequiredBuffValuesVerified,
      compilerVariableCount: evaluation.runtimeTrace.compilerVariableCount,
      compilerNoelleCharacterIndex:
        evaluation.runtimeTrace.compilerNoelleCharacterIndex,
      compilerErConstraintPresent:
        evaluation.runtimeTrace.compilerErConstraintPresent,
    },
    formulaProjection: evaluation.formulaProjection,
    objective: evaluation.objective,
  };
}

function assertComparableProjectionMatch(
  cp55: ComparableProjection,
  cp56: ComparableProjection,
  cellId: string,
): void {
  if (
    stableJson(cp55) !== stableJson(cp56)
  ) {
    throw new Error(`CP56 failed to reproduce CP55 source-aligned cell ${cellId}.`);
  }
}

function canonicalBuffTraceSha256(rows: readonly unknown[]): string {
  const canonicalRows = rows
    .map((row) => structuredClone(row))
    .sort((left, right) => compareText(stableJson(left), stableJson(right)));
  return hashValue(canonicalRows);
}

function buildSourcePriorityTargets(
  cp55Report: NoelleHexereiEquipmentResponseSurfaceReport,
): NoelleHexereiLocalStatPriorityDiagnosticReport["sourcePriorityTargets"] {
  const targets = cp55Report.sourceCandidateAnchors
    .map((anchor) => {
      const profileId = anchor.profileId as NoelleHexereiDiagnosticProfileId;
      const expectedGroups =
        profileId === "noelle-lower-investment-artifact-profile-v1"
          ? [["cr", "cd"], ["atk%"], ["def%"]]
          : [["cr", "cd"], ["def%"], ["atk%"]];
      if (
        !(profileId in SOURCE_PRIORITY_RELATIONS) ||
        stableJson(anchor.sourcePriorityGroupsPreservedButNotEvaluated) !==
          stableJson(expectedGroups) ||
        anchor.sourceScalarWeights !== null ||
        anchor.sourceSelectedAllocation !== null
      ) {
        throw new Error(`CP56 source priority target drifted for ${anchor.profileId}.`);
      }
      return {
        profileId,
        sourcePriorityGroups:
          structuredClone(expectedGroups) as NoelleHexereiDiagnosticProbeStat[][],
        adjacentRelations: SOURCE_PRIORITY_RELATIONS[profileId].map(
          (relation) => ({ ...relation }),
        ),
        sourceScalarWeights: null,
        sourceSelectedAllocation: null,
      };
    })
    .sort((left, right) => compareText(left.profileId, right.profileId));
  if (targets.length !== 2 || new Set(targets.map(({ profileId }) => profileId)).size !== 2) {
    throw new Error("CP56 requires exactly two unique source priority targets.");
  }
  return targets;
}

function buildRuntimeOptionEvidence(
  cells: readonly NoelleHexereiLocalStatPriorityCell[],
  sourceBytesByPath: ReadonlyMap<string, Buffer>,
): NoelleHexereiLocalStatPriorityDiagnosticReport["runtimeOptionEvidence"] {
  const evaluatorText = requiredSourceBytes(
    sourceBytesByPath,
    NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH,
  ).toString("utf8");
  const huskRuntimeText = requiredSourceBytes(
    sourceBytesByPath,
    HUSK_RUNTIME_RELATIVE_PATH,
  ).toString("utf8");
  const huskClassStart = huskRuntimeText.indexOf(
    "class HuskOfOpulentDreams4pc extends ArtifactSetBase",
  );
  const nextArtifactRegistration = huskRuntimeText.indexOf(
    "\n@RegisterArtifactSet(",
    huskClassStart + 1,
  );
  const huskClassText =
    huskClassStart >= 0 && nextArtifactRegistration > huskClassStart
      ? huskRuntimeText.slice(huskClassStart, nextArtifactRegistration)
      : "";
  if (
    !NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS.includes(
      HUSK_RUNTIME_RELATIVE_PATH,
    ) ||
    !evaluatorText.includes(
      'artifactSet: { type: "4pc", setId: "husk_of_opulent_dreams" }',
    ) ||
    !evaluatorText.includes(
      "husk_of_opulent_dreams: String(request.huskStacks)",
    ) ||
    !huskClassText.includes(
      "private readonly o = resolveOption(huskOption, this.option);",
    ) ||
    !huskClassText.includes('readonly halfSetId = "def%-30";') ||
    !huskClassText.includes('this.o !== "0"') ||
    !huskClassText.includes(
      '{ key: "def%", value: 0.06 * Number(this.o) }',
    ) ||
    !huskClassText.includes(
      '{ key: "geo%", value: 0.06 * Number(this.o) }',
    )
  ) {
    throw new Error("CP56 authenticated Husk configuration semantics drifted.");
  }
  const zeroStack = cells.filter(({ huskStacks }) => huskStacks === 0);
  const fourStack = cells.filter(({ huskStacks }) => huskStacks === 4);
  const allTheosis = cells.filter(
    ({ nicoleMode }) => nicoleMode === "all-theosis",
  );
  const hexereiTheosis = cells.filter(
    ({ nicoleMode }) => nicoleMode === "hexerei-theosis",
  );
  if (
    cells.length !== 480 ||
    zeroStack.length !== 240 ||
    fourStack.length !== 240 ||
    allTheosis.length !== 240 ||
    hexereiTheosis.length !== 240 ||
    cells.some(
      (cell) =>
        cell.evaluation.runtimeTrace.nicoleBaseKenosisApplicableCountForNoelle !==
          1 ||
        !cell.evaluation.runtimeTrace.huskFourPieceConfigured ||
        cell.evaluation.runtimeTrace.huskTwoPieceDefenseBonus !== 0.3 ||
        !cell.evaluation.runtimeTrace.huskTwoPieceControlTeamBuildMaterialized ||
        cell.evaluation.runtimeTrace.nicoleTheosisUpliftRegisteredCount !== 1,
    ) ||
    zeroStack.some(
      ({ evaluation }) =>
        evaluation.runtimeTrace.huskCuriosityBuffCount !== 0 ||
        evaluation.runtimeTrace.huskDefenseBonus !== 0 ||
        evaluation.runtimeTrace.huskGeoDamageBonus !== 0,
    ) ||
    fourStack.some(
      ({ evaluation }) =>
        evaluation.runtimeTrace.huskCuriosityBuffCount !== 1 ||
        evaluation.runtimeTrace.huskDefenseBonus !== 0.24 ||
        evaluation.runtimeTrace.huskGeoDamageBonus !== 0.24,
    ) ||
    allTheosis.some(
      ({ evaluation }) =>
        evaluation.runtimeTrace
          .nicoleTheosisUpliftApplicableCountForNoelle !== 1 ||
        stableJson(
          evaluation.runtimeTrace.nicoleTheosisUpliftRegisteredTarget,
        ) !== stableJson({ receiver: "team" }),
    ) ||
    hexereiTheosis.some(
      ({ evaluation }) =>
        evaluation.runtimeTrace
          .nicoleTheosisUpliftApplicableCountForNoelle !== 0 ||
        stableJson(
          evaluation.runtimeTrace.nicoleTheosisUpliftRegisteredTarget,
        ) !==
          stableJson({ receiver: "team", factions: ["Hexerei"] }),
    )
  ) {
    throw new Error("CP56 observed runtime option evidence drifted.");
  }
  return {
    evidenceOrigin:
      "authenticated-evaluator-and-runtime-plus-observed-cell-traces",
    huskFourPieceConfiguredCellCount: 480,
    huskFourPieceConfiguredInEveryCell: true,
    huskZeroStackCellCount: 240,
    huskZeroMeansZeroCuriosityStacks: true,
    huskZeroCuriosityBuffAbsentInEveryZeroStackCell: true,
    huskTwoPieceHalfSetId: "def%-30",
    huskTwoPieceDefenseBonus: 0.3,
    huskTwoPieceRetainedAtZeroStacks: true,
    huskTwoPieceRuntimeDifferentialVerifiedInEveryCell: true,
    huskFourStackCellCount: 240,
    huskFourStackDefenseAndGeoBonusVerifiedInEveryFourStackCell: true,
    nicoleAllTheosisCellCount: 240,
    nicoleAllTheosisUpliftAppliedToNoelleInEveryAllTheosisCell: true,
    nicoleHexereiTheosisCellCount: 240,
    nicoleHexereiTheosisUpliftExcludedFromNoelleInEveryHexereiTheosisCell: true,
    nicoleTheosisUpliftRegisteredInEveryCell: true,
    nicoleHexereiTheosisRegisteredTargetRestrictedInEveryHexereiTheosisCell:
      true,
    nicoleBaseKenosisRetainedInEveryCell: true,
  };
}

function assertExecutionCardinality(input: {
  cells: readonly NoelleHexereiLocalStatPriorityCell[];
  localMarginals: readonly NoelleHexereiLocalMarginal[];
  sensitivityEdges: readonly NoelleHexereiSensitivityEdge[];
  sourceOrderDiagnostics: readonly NoelleHexereiSourceOrderDiagnostic[];
  contextRobustnessRows: readonly NoelleHexereiContextRobustnessRow[];
  cp55Reproductions: readonly NoelleHexereiCp55Reproduction[];
}): void {
  const baselineCount = input.cells.filter(({ probe }) => probe.stat == null).length;
  const probeCount = input.cells.length - baselineCount;
  const nicoleEdgeCount = input.sensitivityEdges.filter(
    ({ changedAxis }) => changedAxis === "nicoleMode",
  ).length;
  const huskEdgeCount = input.sensitivityEdges.length - nicoleEdgeCount;
  if (
    input.cells.length !== 480 ||
    baselineCount !== 96 ||
    probeCount !== 384 ||
    new Set(input.cells.map(({ cellId }) => cellId)).size !== 480 ||
    new Set(input.cells.map(({ cellSha256 }) => cellSha256)).size !== 480 ||
    input.localMarginals.length !== 384 ||
    new Set(input.localMarginals.map(({ marginalId }) => marginalId)).size !== 384 ||
    input.sensitivityEdges.length !== 480 ||
    nicoleEdgeCount !== 240 ||
    huskEdgeCount !== 240 ||
    new Set(input.sensitivityEdges.map(({ edgeId }) => edgeId)).size !== 480 ||
    input.sourceOrderDiagnostics.length !== 288 ||
    new Set(
      input.sourceOrderDiagnostics.map(({ diagnosticId }) => diagnosticId),
    ).size !== 288 ||
    input.contextRobustnessRows.length !== 72 ||
    new Set(
      input.contextRobustnessRows.map(({ robustnessId }) => robustnessId),
    ).size !== 72 ||
    input.cp55Reproductions.length !== 24 ||
    new Set(
      input.cp55Reproductions.map(({ cp55CellId }) => cp55CellId),
    ).size !== 24
  ) {
    throw new Error(
      "CP56 lost its exact 96-baseline/384-probe/480-edge/288-order/72-robustness/24-reproduction boundary.",
    );
  }
}

function authenticateOuterInputs(
  input: NoelleHexereiLocalStatPriorityDiagnosticInput,
): AuthenticatedOuterInputs {
  if (
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS.length !==
      EXPECTED_RUNTIME_INPUT_PATH_COUNT ||
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS.some(
      (runtimePath) =>
        !NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS.includes(
          runtimePath,
        ),
    ) ||
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS.filter(
      (runtimePath) => runtimePath.endsWith(".json.gz"),
    ).length !== EXPECTED_BINARY_RUNTIME_INPUT_COUNT ||
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS.length !==
      EXPECTED_INPUT_PATH_COUNT ||
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS.filter(
      (sourcePath) => sourcePath.endsWith(".json"),
    ).length !== EXPECTED_JSON_INPUT_COUNT
  ) {
    throw new Error("CP56 declared closure cardinality drifted.");
  }
  const expectedPaths = [
    ...NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS,
  ];
  const sourcePaths = input.sourceFiles
    .map(({ path: sourcePath }) => sourcePath)
    .sort(compareText);
  const generatedPaths = input.generatedFrom
    .map(({ path: sourcePath }) => sourcePath)
    .sort(compareText);
  if (
    input.sourceFiles.length !== expectedPaths.length ||
    input.generatedFrom.length !== expectedPaths.length ||
    new Set(sourcePaths).size !== sourcePaths.length ||
    new Set(generatedPaths).size !== generatedPaths.length ||
    stableJson(sourcePaths) !== stableJson(expectedPaths) ||
    stableJson(generatedPaths) !== stableJson(expectedPaths)
  ) {
    throw new Error("CP56 exact outer source/generatedFrom path closure drifted.");
  }
  const sourceBytesByPath = new Map<string, Buffer>();
  for (const { path: sourcePath, bytesBase64 } of input.sourceFiles) {
    if (!bytesBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(bytesBase64)) {
      throw new Error(`CP56 source bytes are not canonical base64 at ${sourcePath}.`);
    }
    const bytes = Buffer.from(bytesBase64, "base64");
    if (bytes.length === 0 || bytes.toString("base64") !== bytesBase64) {
      throw new Error(`CP56 source bytes failed base64 round-trip at ${sourcePath}.`);
    }
    let workspaceBytes: Buffer;
    try {
      workspaceBytes = readFileSync(path.join(REPOSITORY_ROOT, sourcePath));
    } catch {
      throw new Error(`CP56 workspace source file is unreadable at ${sourcePath}.`);
    }
    if (!bytes.equals(workspaceBytes)) {
      throw new Error(
        `CP56 supplied source bytes do not match the workspace file at ${sourcePath}.`,
      );
    }
    sourceBytesByPath.set(sourcePath, bytes);
  }
  const generatedByPath = new Map(
    input.generatedFrom.map((entry) => [entry.path, entry.sha256] as const),
  );
  for (const sourcePath of expectedPaths) {
    const declaredSha256 = generatedByPath.get(sourcePath);
    if (
      declaredSha256 == null ||
      !/^[a-f0-9]{64}$/.test(declaredSha256) ||
      declaredSha256 !==
        sha256Bytes(requiredSourceBytes(sourceBytesByPath, sourcePath))
    ) {
      throw new Error(`CP56 source/hash authentication drifted at ${sourcePath}.`);
    }
  }
  let parsedCp55Report: unknown;
  try {
    parsedCp55Report = JSON.parse(
      requiredSourceBytes(
        sourceBytesByPath,
        NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH,
      ).toString("utf8"),
    );
  } catch {
    throw new Error("CP56 CP55 durable report bytes are not valid JSON.");
  }
  if (stableJson(parsedCp55Report) !== stableJson(input.cp55ReportInput)) {
    throw new Error(
      "CP56 CP55 durable report bytes disagree with the supplied parsed object.",
    );
  }
  return {
    sourceBytesByPath,
    generatedFrom: input.generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    cp55Report:
      parsedCp55Report as NoelleHexereiEquipmentResponseSurfaceReport,
  };
}

function buildBoundCp55Input(
  raw: AuthenticatedOuterInputs,
  supplied: NoelleHexereiEquipmentResponseSurfaceInput,
): NoelleHexereiEquipmentResponseSurfaceInput {
  const generatedByPath = new Map(
    raw.generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  const parsedCp54Report = JSON.parse(
    requiredSourceBytes(
      raw.sourceBytesByPath,
      NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
    ).toString("utf8"),
  ) as NoelleHexereiEquipmentResponseSurfaceInput["cp54ReportInput"];
  return {
    cp54ReportInput: parsedCp54Report,
    cp54Input: structuredClone(supplied.cp54Input),
    technicalRequest: structuredClone(
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST,
    ),
    sourceFiles: NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS.map(
      (sourcePath) => ({
        path: sourcePath,
        bytesBase64: requiredSourceBytes(
          raw.sourceBytesByPath,
          sourcePath,
        ).toString("base64"),
      }),
    ),
    generatedFrom: NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS.map(
      (sourcePath) => {
        const entry = generatedByPath.get(sourcePath);
        if (!entry) throw new Error(`CP56 missing CP55 generatedFrom ${sourcePath}.`);
        return { ...entry };
      },
    ),
  };
}

function assertCp55SemanticBoundary(
  report: NoelleHexereiEquipmentResponseSurfaceReport,
): void {
  if (
    report.validationStatus !== "completed-48-cell-technical-surface" ||
    report.publicationStatus !== "withheld-technical-validation-only" ||
    report.operationSummary.responseCellCount !== 48 ||
    report.surface.cells.length !== 48 ||
    report.operationSummary.sourceCandidateSelectionCount !== 0 ||
    report.operationSummary.sourceSubstatPriorityEvaluationCount !== 0 ||
    report.operationSummary.optimizerRunCount !== 0 ||
    report.operationSummary.energyRecoveryComputationCount !== 0 ||
    report.runtimeAssumptionBoundary.nicoleAtkBuffMode !== "all-theosis" ||
    report.runtimeAssumptionBoundary.huskStacks !== 4 ||
    report.runtimeAssumptionBoundary.supportOptionSensitivityExecuted ||
    report.supportsStatRecommendations ||
    report.supportsRankClaims ||
    report.supportsEnergyRecoveryClaims
  ) {
    throw new Error("CP56 upstream CP55 semantic boundary drifted.");
  }
}

function assertExactTechnicalRequest(request: TechnicalRequest): void {
  if (
    stableJson(request) !==
    stableJson(NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REQUEST)
  ) {
    throw new Error("CP56 technical request differs from the exact bounded request.");
  }
}

function assertExactEvaluatorDomain(): void {
  if (
    stableJson(NOELLE_HEXEREI_POINT_WITNESSES.map(({ witnessId }) => witnessId)) !==
      stableJson(WITNESS_IDS) ||
    stableJson(NOELLE_HEXEREI_POINT_CIRCLET_STATS) !==
      stableJson(CIRCLET_STATS) ||
    stableJson(NOELLE_HEXEREI_POINT_REFINEMENTS) !== stableJson(REFINEMENTS) ||
    stableJson(NOELLE_HEXEREI_POINT_NICOLE_MODES) !== stableJson(NICOLE_MODES) ||
    stableJson(NOELLE_HEXEREI_POINT_HUSK_STACKS) !==
      stableJson(HUSK_STACK_STATES) ||
    stableJson(NOELLE_HEXEREI_POINT_PROBE_STATS) !== stableJson(PROBE_STATS) ||
    stableJson(NOELLE_HEXEREI_POINT_AVERAGE_ROLLS) !==
      stableJson(AVERAGE_ROLL_DELTAS)
  ) {
    throw new Error("CP56 shared technical evaluator domain drifted.");
  }
}

interface CellLookup {
  witnessId: NoelleHexereiDiagnosticWitnessId;
  circlet: NoelleHexereiDiagnosticCircletStat;
  refinement: NoelleHexereiDiagnosticRefinement;
  nicoleMode: NoelleHexereiDiagnosticNicoleMode;
  huskStacks: NoelleHexereiDiagnosticHuskStacks;
  probeState: NoelleHexereiDiagnosticProbeState;
}

function requireCell(
  cells: readonly NoelleHexereiLocalStatPriorityCell[],
  lookup: CellLookup,
): NoelleHexereiLocalStatPriorityCell {
  const matches = cells.filter(
    (cell) =>
      cell.witnessId === lookup.witnessId &&
      cell.circlet === lookup.circlet &&
      cell.refinement === lookup.refinement &&
      cell.nicoleMode === lookup.nicoleMode &&
      cell.huskStacks === lookup.huskStacks &&
      cell.probe.probeState === lookup.probeState,
  );
  if (matches.length !== 1) {
    throw new Error(
      `CP56 expected one cell ${stableJson(lookup)}, observed ${matches.length}.`,
    );
  }
  return matches[0];
}

function requireCp55Cell(
  cells: readonly NoelleHexereiEquipmentResponseCell[],
  witnessId: string,
  sands: string,
  circlet: string,
  refinement: number,
): NoelleHexereiEquipmentResponseCell {
  const matches = cells.filter(
    (cell) =>
      cell.witnessId === witnessId &&
      cell.sands === sands &&
      cell.circlet === circlet &&
      cell.refinement === refinement,
  );
  if (matches.length !== 1) {
    throw new Error(
      `CP56 expected one CP55 source-aligned cell ${witnessId}/${sands}/${circlet}/R${refinement}.`,
    );
  }
  return matches[0];
}

function requireCp55TraceRows(
  report: NoelleHexereiEquipmentResponseSurfaceReport,
  cell: NoelleHexereiEquipmentResponseCell,
): NoelleHexereiEquipmentResponseSurfaceReport["surface"]["buffTraceCatalog"][number]["rows"] {
  const matches = report.surface.buffTraceCatalog.filter(
    ({ traceSha256 }) =>
      traceSha256 === cell.runtimeTrace.applicableBuffTraceSha256,
  );
  if (matches.length !== 1) {
    throw new Error(`CP56 missing unique CP55 trace ${cell.runtimeTrace.applicableBuffTraceSha256}.`);
  }
  return matches[0].rows;
}

function requireMarginal(
  marginals: readonly NoelleHexereiLocalMarginal[],
  probeStat: NoelleHexereiDiagnosticProbeStat,
): NoelleHexereiLocalMarginal {
  const matches = marginals.filter((marginal) => marginal.probeStat === probeStat);
  if (matches.length !== 1) {
    throw new Error(`CP56 expected one ${probeStat} marginal, observed ${matches.length}.`);
  }
  return matches[0];
}

function sameFixedContext(
  left: NoelleHexereiLocalStatPriorityCell,
  right: NoelleHexereiLocalStatPriorityCell,
): boolean {
  return (
    left.witnessId === right.witnessId &&
    left.profileId === right.profileId &&
    left.sourceAlignedSands === right.sourceAlignedSands &&
    left.circlet === right.circlet &&
    left.refinement === right.refinement &&
    left.nicoleMode === right.nicoleMode &&
    left.huskStacks === right.huskStacks
  );
}

function profileForWitness(
  witnessId: NoelleHexereiDiagnosticWitnessId,
): NoelleHexereiDiagnosticProfileId {
  const witness = NOELLE_HEXEREI_POINT_WITNESSES.find(
    (candidate) => candidate.witnessId === witnessId,
  );
  if (!witness) throw new Error(`CP56 missing witness ${witnessId}.`);
  return witness.profileId;
}

function requiredSourceBytes(
  sourceBytesByPath: ReadonlyMap<string, Buffer>,
  sourcePath: string,
): Buffer {
  const bytes = sourceBytesByPath.get(sourcePath);
  if (!bytes) throw new Error(`CP56 missing authenticated bytes for ${sourcePath}.`);
  return bytes;
}

function comparisonTolerance(left: number, right: number): number {
  return Math.max(
    ABSOLUTE_TOLERANCE,
    RELATIVE_TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right)),
  );
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`CP56 encountered non-finite numeric output ${value}.`);
  }
  return Number(value.toPrecision(15));
}

function sha256Bytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
