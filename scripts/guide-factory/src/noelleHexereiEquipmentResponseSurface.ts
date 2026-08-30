import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { betaEnabled } from "@/data/betaState";
import { charInfo } from "@/data/charInfo";
import type { MainStat, StatKey } from "@/data/enums";
import { getTalentParam } from "@/data/gameStatsLoader";
import type { StatEntry } from "@/data/types";
import {
  getMainStatValueAtLevel,
  toInternal,
} from "@/lib/artifact/scoring/utils";
import { buildBuffOverrides } from "@/lib/dmgcalc/core/comboBuffOverrides";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/dmgcalc/core/formulaCompiler";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  DamageTag,
  FormulaEntry,
  OptionMap,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import { bootstrapGuideFactoryComputation } from "./computationReplay";
import {
  withScopedFormulaPartProjection,
  type FormulaPartProjectionSpec,
} from "./formulaPartProjection";
import { stableJson } from "./io";
import {
  requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport,
  type NoelleHexereiPartialEquipmentCompositionReport,
  type NoelleHexereiPartialEquipmentValidationCandidate,
} from "./noelleHexereiPartialEquipmentComposition";
import {
  NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS,
  NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
  requireAuthenticatedNoelleNormalPrefixFormulaProjectionReport,
  type NoelleNormalPrefixFormulaProjectionInput,
  type NoelleNormalPrefixFormulaProjectionReport,
} from "./noelleNormalPrefixFormulaProjection";
import { FACTORY_ROOT, REPOSITORY_ROOT } from "./paths";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";

export const NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_ID =
  "noelle-hexerei-equipment-response-surface-v1";
export const NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "noelle-hexerei-equipment-response-surface.json",
);

export const NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-normal-prefix-formula-projection.json";
export const NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/noelleHexereiEquipmentResponseSurface.ts";
export const NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_CLI_RELATIVE_PATH =
  "scripts/guide-factory/src/assemble-noelle-hexerei-equipment-response-surface.ts";

export const NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS = [
  ...NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
] as const;

export const NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS = [
  ...new Set([
    ...NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS,
    NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
    NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_CORE_RELATIVE_PATH,
    NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_CLI_RELATIVE_PATH,
  ]),
].sort(compareText);

export const NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_SOURCE_FILE_PATHS = [
  ...NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
];

const EXPECTED_RUNTIME_INPUT_PATH_COUNT = 80;
const EXPECTED_INPUT_PATH_COUNT = 112;
const EXPECTED_JSON_INPUT_COUNT = 13;
const ABSOLUTE_TOLERANCE = 1e-9;
const RELATIVE_TOLERANCE = 1e-12;

const NOELLE_GEO_NORMAL_TAG = {
  element: "Geo",
  ability: "normal",
  reaction: "none",
} as const satisfies DamageTag;

const PROFILE_IDS = [
  "noelle-lower-investment-artifact-profile-v1",
  "noelle-high-investment-artifact-profile-v1",
] as const;
type ProfileId = (typeof PROFILE_IDS)[number];

const SANDS_STATS = ["atk%", "def%"] as const;
type SandsStat = (typeof SANDS_STATS)[number];

const CIRCLET_STATS = ["cr", "cd"] as const;
type CircletStat = (typeof CIRCLET_STATS)[number];

const REFINEMENTS = [1, 5] as const;
type Refinement = (typeof REFINEMENTS)[number];

const INVESTMENT_WITNESSES = [
  {
    sequence: 0,
    witnessId: "c0-q9",
    profileId: "noelle-lower-investment-artifact-profile-v1",
    constellation: 0,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 1, burst: 9 },
    sourceAlignedSands: "atk%",
  },
  {
    sequence: 1,
    witnessId: "c5-q9",
    profileId: "noelle-lower-investment-artifact-profile-v1",
    constellation: 5,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 12 },
    sourceAlignedSands: "atk%",
  },
  {
    sequence: 2,
    witnessId: "c0-q10",
    profileId: "noelle-high-investment-artifact-profile-v1",
    constellation: 0,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 1, burst: 10 },
    sourceAlignedSands: "def%",
  },
  {
    sequence: 3,
    witnessId: "c5-q10",
    profileId: "noelle-high-investment-artifact-profile-v1",
    constellation: 5,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 13 },
    sourceAlignedSands: "def%",
  },
  {
    sequence: 4,
    witnessId: "c6-q9",
    profileId: "noelle-high-investment-artifact-profile-v1",
    constellation: 6,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 12 },
    sourceAlignedSands: "def%",
  },
  {
    sequence: 5,
    witnessId: "c6-q10",
    profileId: "noelle-high-investment-artifact-profile-v1",
    constellation: 6,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 13 },
    sourceAlignedSands: "def%",
  },
] as const;
type InvestmentWitness = (typeof INVESTMENT_WITNESSES)[number];
type WitnessId = InvestmentWitness["witnessId"];

const TEAMMATE_FIXTURES = [
  {
    charId: "durin",
    charLevel: 90,
    constellation: 0,
    weaponId: "travelers_handy_sword",
    refinement: 1,
    artifactSet: null,
    talentLevels: { auto: 1, skill: 1, burst: 1 },
  },
  {
    charId: "nicole",
    charLevel: 90,
    constellation: 0,
    weaponId: "otherworldly_story",
    refinement: 1,
    artifactSet: null,
    talentLevels: { auto: 1, skill: 1, burst: 1 },
  },
  {
    charId: "xilonen",
    charLevel: 90,
    constellation: 0,
    weaponId: "travelers_handy_sword",
    refinement: 1,
    artifactSet: null,
    talentLevels: { auto: 1, skill: 1, burst: 1 },
  },
] as const;

export const NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST = {
  requestId: "noelle-hexerei-48-cell-equipment-response-surface-v1",
  authorship: "guide-factory-technical-request",
  sourceCandidateSelection: null,
  investmentWitnesses: INVESTMENT_WITNESSES,
  equipmentAxes: {
    sands: SANDS_STATS,
    circlet: CIRCLET_STATS,
    gestRefinement: REFINEMENTS,
  },
  fixedNoelleInputs: {
    charLevel: 90,
    weaponId: "gest_of_the_mighty_wolf",
    artifactSet: { type: "4pc", setId: "husk_of_opulent_dreams" },
    huskStacks: 4,
    flower: "hp",
    plume: "atk",
    goblet: "geo%",
    artifactRarity: 5,
    artifactLevel: 20,
    substatEntryCount: 0,
  },
  exactRoster: ["noelle", "durin", "nicole", "xilonen"],
  teammateFixtures: TEAMMATE_FIXTURES,
  combatOptions: {
    durin: "white",
    nicole: "all-theosis",
    husk_of_opulent_dreams: "4",
  },
  calcContext: {
    enemyLevel: 100,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  },
  objective: {
    formulaId: "noelle-na",
    exactPositivePartHits: [5, 5, 3],
    omittedPartIndexes: [3],
    sourceSupporterFormulaCountsUsed: false,
    sourceRotationTimingUsed: false,
    sourceTeamTotalUsed: false,
    actionTimeValued: false,
  },
  energyRecovery: {
    status: "deferred",
    keyIncludedInMainStats: false,
    thresholdIncluded: false,
    computationRequested: false,
  },
} as const;
type TechnicalRequest =
  typeof NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST;

const NOELLE_PREFIX_PROJECTION_SPEC = {
  formulaId: "noelle-na",
  ownerCharId: "noelle",
  expectedOriginalPartCount: 4,
  projectedParts: [
    { sourcePartIndex: 0, hits: 5, semanticLabel: "N1" },
    { sourcePartIndex: 1, hits: 5, semanticLabel: "N2" },
    { sourcePartIndex: 2, hits: 3, semanticLabel: "N3" },
  ],
} as const satisfies FormulaPartProjectionSpec;

const TECHNICAL_COMBO = {
  id: "noelle-prefix-equipment-response-cell",
  label: { en: "Noelle prefix response cell", zh: "诺艾尔前缀响应单元" },
  lines: [
    {
      charId: "noelle",
      formulaId: "noelle-na",
      count: 1,
      forceOnField: true,
    },
  ],
} as const satisfies ComboFormula;

const CAUTIONS = [
  "This is a 48-cell static technical response surface, not a build score, optimizer, guide, or recommendation.",
  "The six investment witnesses are Guide Factory request points chosen around the two authenticated source predicates. They do not exhaust either branch, and no witness or branch is selected for the source team.",
  "Source predicate matching is evaluated against entered request talent levels. The current runtime separately applies Noelle's C3/C5 talent bonuses; every cell records both entered and runtime-effective levels.",
  "ATK% or DEF% Sands is source-listed only in its corresponding branch. The other Sands is an explicit Guide Factory counterfactual. CRIT Rate and CRIT DMG Circlets are both source-listed and remain unordered.",
  "Gest is only an applicable, unranked source observation with missing refinement and performance. R1 and R5 are Guide Factory endpoint parameters, not source ranks or assignments.",
  "The source does not specify teammate investment, equipment, artifact sets, Durin form, Nicole buff mode, enemy context, or buff state. The fixed C0 teammate equipment and options are technical fixtures, not recommendations.",
  "The current runtime treats Geo resonance as active, hardcodes four Gest damage and Hexerei CRIT DMG stacks, and receives four Husk stacks for every hit. The response surface does not prove that a rotation establishes or retains those buffs.",
  "The artifact sheet contains five level-20 five-star main stats and zero substats. It is an aggregate technical sheet, not a legal complete artifact build or owned inventory.",
  "Only Noelle's exact 5/5/3/0 Normal prefix is evaluated. Noelle Skill/Burst damage, supporter damage, action timing, ATK Speed value, team total, DPS, and Energy Recharge are excluded.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not publish cell totals or signed deltas as expected player damage, rankings, winners, or recommendations.",
  "Do not average cells into a lower- or high-investment branch score; the surface is specifically designed to reveal within-branch interaction changes.",
  "Do not select a Sands, Circlet, refinement, investment witness, teammate option, or artifact allocation from this report.",
  "Do not infer scalar stat weights, ideal rolls, complete equipment, rotation feasibility, buff coverage, DPS, team total, or Energy Recharge requirements.",
] as const;

export interface NoelleHexereiEquipmentResponseSurfaceSourceFile {
  path: string;
  bytesBase64: string;
}

export interface NoelleHexereiEquipmentResponseSurfaceInput {
  cp54ReportInput: NoelleNormalPrefixFormulaProjectionReport;
  cp54Input: NoelleNormalPrefixFormulaProjectionInput;
  technicalRequest: TechnicalRequest;
  sourceFiles: readonly NoelleHexereiEquipmentResponseSurfaceSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

interface AuthenticatedOuterInputs {
  sourceBytesByPath: Map<string, Buffer>;
  generatedFrom: GeneratedFromEntry[];
  cp54Report: NoelleNormalPrefixFormulaProjectionReport;
}

export interface NoelleHexereiResolvedStatObservation {
  atk: number;
  def: number;
  cr: number;
  cd: number;
  geoNormalDamageBonus: number;
}

export interface NoelleHexereiApplicableBuffTraceRow {
  providerCharId: string;
  buffKey: string;
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  implementationClass: string;
  staticEntries: StatEntry[];
  dynamicPhase: "none" | "mid" | "post";
  resolvedDynamicEntries: StatEntry[];
}

export interface NoelleHexereiBuffTraceCatalogEntry {
  traceSha256: string;
  observedCellCount: number;
  rows: NoelleHexereiApplicableBuffTraceRow[];
}

export interface NoelleHexereiEquipmentResponseCell {
  sequence: number;
  cellId: string;
  cellInputSha256: string;
  witnessId: WitnessId;
  profileId: ProfileId;
  sourceCandidateId: string;
  sourceCandidateSha256: string;
  enteredConstellation: 0 | 5 | 6;
  enteredTalentLevels: { auto: 10; skill: 1; burst: 9 | 10 };
  runtimeEffectiveTalentLevels: {
    auto: 10;
    skill: 1 | 4;
    burst: 9 | 10 | 12 | 13;
  };
  runtimeTalentEvidence: {
    expectedLevelsDerivedFromAuthenticatedCharacterMetadata: true;
    autoFormulaMultipliersMatchExpectedLevel: true;
    burstConversionMatchesExpectedLevel: true;
    skillLevelNotUsedByObjective: true;
  };
  sourcePredicateSatisfiedByEnteredFacts: true;
  sourcePredicateEvaluationAuthorship: "guide-factory-request-context-semantics";
  sands: SandsStat;
  sandsAuthority:
    | "source-listed-for-authenticated-branch"
    | "guide-factory-counterfactual";
  circlet: CircletStat;
  circletAuthority: "source-listed-unordered-option";
  refinement: Refinement;
  refinementAuthority: "guide-factory-missing-source-endpoint";
  artifactSheet: {
    mainStats: ["hp", "atk", SandsStat, "geo%", CircletStat];
    mainStatValuesInternal: Record<string, number>;
    substatEntryCount: 0;
    legalCompleteArtifactBuild: false;
    sheetSha256: string;
  };
  runtimeTrace: {
    registeredBuffCount: number;
    registeredBuffLedgerSha256: string;
    applicableBuffCountForOnFieldNoelle: number;
    applicableBuffTraceSha256: string;
    computedBuffOverrideKeys: string[];
    computedBuffOverrideCountDoesNotRepresentApplicableBuffCount: true;
    gestBuffCount: 3;
    gestHexereiCritDamageMaterialized: true;
    gestDamageBonus: number;
    gestCritDamage: number;
    gestAttackSpeed: 0.1;
    huskBuffCount: 1;
    huskDefenseBonus: 0.24;
    huskGeoDamageBonus: 0.24;
    geoResonanceBuffCount: 2;
    geoResonanceDamageBonus: 0.15;
    geoResonanceResistanceReduction: 0.2;
    teammateWeaponBuffCount: 0;
    exactRequiredBuffValuesVerified: true;
    compilerVariableCount: number;
    compilerNoelleCharacterIndex: number;
    compilerErConstraintPresent: false;
  };
  formulaProjection: {
    projectedPartHits: [5, 5, 3];
    omittedPartIndexes: [3];
    originalEntryIdentityRestored: true;
    formulaIndexSizeRestored: true;
    formulaIndexOrderAndEntryIdentitiesRestored: true;
  };
  objective: {
    directTotal: number;
    compiledTotal: number;
    absoluteDifference: number;
    allowedDifference: number;
    directCompiledAgreement: true;
    resolvedNoelleStats: NoelleHexereiResolvedStatObservation;
    numericClassification: "technical-fixture-local-only";
  };
}

export interface NoelleHexereiSingleAxisComparison {
  comparisonId: string;
  changedAxis: "sands" | "circlet" | "refinement";
  leftCellId: string;
  rightCellId: string;
  fixedAxisPayloadSha256: string;
  exactlyOneDeclaredAxisChanged: true;
  leftAxisValue: string | number;
  rightAxisValue: string | number;
  leftDirectTotal: number;
  rightDirectTotal: number;
  signedLeftMinusRightDelta: number;
  sourceExpectedOrdering: null;
  selectionExecuted: false;
}

export interface NoelleHexereiWitnessSandsSummary {
  witnessId: WitnessId;
  profileId: ProfileId;
  comparisonCount: 4;
  sourceAlignedSands: SandsStat;
  counterfactualSands: SandsStat;
  positiveSourceAlignedMinusCounterfactualCount: number;
  negativeSourceAlignedMinusCounterfactualCount: number;
  numericalTieCount: number;
  observedSignSet: Array<"negative" | "positive" | "tie">;
  supportsBranchWideSandsClaim: false;
  selectionExecuted: false;
}

export interface NoelleHexereiBranchSandsVariationSummary {
  profileId: ProfileId;
  witnessIds: WitnessId[];
  observedSignSetAcrossWitnesses: Array<"negative" | "positive" | "tie">;
  crossWitnessSignVariationObserved: boolean;
  supportsBranchWideSandsClaim: false;
  branchAverageComputed: false;
  selectionExecuted: false;
}

export interface NoelleHexereiEquipmentResponseSurfaceReport {
  schemaVersion: 1;
  reportType: "noelle-hexerei-equipment-response-surface";
  surfaceId: typeof NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_ID;
  classification: "authenticated-offline-static-equipment-response-surface";
  validationStatus: "completed-48-cell-technical-surface";
  publicationStatus: "withheld-technical-validation-only";
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allGeneratedFromHashesAuthenticatedFromBytes: true;
    allSourceBytesMatchWorkspaceFiles: true;
    cp54ReportByteAndParsedObjectParity: true;
    exactCp54InputProjection: true;
    exactTechnicalRequest: true;
    sourceFileCount: 112;
    generatedFromCount: 112;
    runtimeInputPathCount: 80;
    jsonInputCount: 13;
    binaryRuntimeInputCount: 2;
  };
  upstreamBoundary: {
    cp54ReportPath: typeof NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH;
    cp54ReportFileSha256: string;
    cp54CanonicalObjectSha256: string;
    cp54FreshlyAuthenticated: true;
    cp53CanonicalObjectSha256: string;
    cp53IndependentlyFreshlyAuthenticated: true;
    cp53CandidateCount: 2;
    cp53SelectedCandidateCount: 0;
    cp53CompleteBuildCount: 0;
    cp54StaticFormulaCountTechnicalComputationPreserved: true;
    sourceRotationReplayStillNotAuthorized: true;
  };
  authorityLedger: {
    sourceBacked: string[];
    runtimeBacked: string[];
    guideFactoryTechnical: string[];
    guideFactoryCounterfactual: string[];
    explicitlyMissing: string[];
  };
  requestBoundary: {
    request: TechnicalRequest;
    requestCanonicalObjectSha256: string;
    sourceAuthored: false;
    sourceCandidateSelection: null;
    investmentWitnessSelectionForSourceTeam: false;
    teammateEquipmentSourceAuthored: false;
    supportOptionsSourceAuthored: false;
    refinementSourceAuthored: false;
    enemyContextSourceAuthored: false;
    energyRecoveryDeferred: true;
  };
  sourceCandidateAnchors: Array<{
    candidateId: string;
    candidateSha256: string;
    candidatePayloadSha256Verified: true;
    profileId: ProfileId;
    sourceRecordId: string;
    sourceCondition: string;
    sourceRequestPredicate: Record<string, unknown>;
    sourceArtifactSet: { type: "4pc"; setId: "husk_of_opulent_dreams" };
    sourceMainStats: {
      sands: string[][];
      goblet: string[][];
      circlet: string[][];
    };
    guardedMainStatAlternativesPreservedButNotEvaluated: Array<{
      slot: "goblet" | "circlet";
      statIds: string[];
      sourceConditions: string[];
    }>;
    sourcePriorityGroupsPreservedButNotEvaluated: string[][];
    sourceScalarWeights: null;
    sourceSelectedAllocation: null;
    sourceWeaponId: "gest_of_the_mighty_wolf";
    sourceWeaponOrdering: "unranked";
    sourceWeaponRefinement: null;
    sourceQuantitativePerformanceStatus: "missing-not-zero";
    matchingTechnicalWitnessIds: WitnessId[];
  }>;
  runtimeAssumptionBoundary: {
    exactRoster: ["noelle", "durin", "nicole", "xilonen"];
    hexereiMembers: ["durin", "nicole"];
    teammateArtifactSheetEntryCount: 0;
    teammateWeaponsHaveNoImplementedBuffs: true;
    durinForm: "white";
    nicoleAtkBuffMode: "all-theosis";
    supportOptionSensitivityExecuted: false;
    huskStacks: 4;
    gestDamageStacksHardcodedByRuntime: 4;
    gestHexereiCritDamageStacksHardcodedByRuntime: 4;
    geoResonanceConditionModeledByRuntimeAsActive: true;
    buffCoverageModel: "existing-static-calculator-state-not-source-timing";
    gestAttackSpeedIncludedButActionTimeNotValued: true;
    rollMultiplierConsumedByConstructedArtifactSheets: false;
    substatBudgetConsumedByConstructedArtifactSheets: false;
    noEnergyRechargeMainStat: true;
    noEnergyRechargeThreshold: true;
  };
  surface: {
    cells: NoelleHexereiEquipmentResponseCell[];
    comparisonPairs: NoelleHexereiSingleAxisComparison[];
    witnessSandsSummaries: NoelleHexereiWitnessSandsSummary[];
    branchSandsVariationSummaries: NoelleHexereiBranchSandsVariationSummary[];
    buffTraceCatalog: NoelleHexereiBuffTraceCatalogEntry[];
    directCompiledAgreement: {
      evaluatedCellCount: 48;
      agreementCount: 48;
      mismatchCount: 0;
      maximumAbsoluteDifference: number;
      allWithinTolerance: true;
    };
    exactCartesianClosure: {
      witnessCount: 6;
      sandsCount: 2;
      circletCount: 2;
      refinementCount: 2;
      expectedCellCount: 48;
      observedCellCount: 48;
      uniqueCellInputCount: 48;
      complete: true;
    };
    cellsSha256: string;
    comparisonsSha256: string;
    summarySha256: string;
  };
  operationSummary: {
    investmentWitnessCount: 6;
    sandsStateCount: 2;
    circletStateCount: 2;
    refinementStateCount: 2;
    responseCellCount: 48;
    singleAxisComparisonCount: 72;
    formulaProjectionRunCount: 48;
    freshTeamBuildCount: 48;
    compilerBuildCount: 48;
    directDamageEvaluationCount: 48;
    compiledDamageEvaluationCount: 48;
    technicalNoelleFormulaObjectiveCount: 48;
    guideFactoryTechnicalEquipmentMaterializationCount: 48;
    sourceCandidateSelectionCount: 0;
    sourceCandidateEquipmentAssignmentCount: 0;
    sourceSubstatPriorityEvaluationCount: 0;
    sourceRotationReplayCount: 0;
    sourceSupporterFormulaEvaluationCount: 0;
    sourceTeamTotalDamageComputationCount: 0;
    optimizerRunCount: 0;
    autoTuneRunCount: 0;
    idealStatAllocationCount: 0;
    energyRecoveryComputationCount: 0;
  };
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsBuildRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsPlayerDamageClaims: false;
  supportsSourceRotationReplay: false;
  supportsTeamTotalDamageComputation: false;
  supportsDpsClaims: false;
  supportsBuffTimingClaims: false;
  supportsEnergyRecoveryClaims: false;
  supportsIdealStatAllocation: false;
  equipmentResponseSurfaceExecuted: true;
  sourceCandidateSelectionExecuted: false;
  sourceCandidateEquipmentAssignmentExecuted: false;
  sourceSubstatPriorityEvaluationExecuted: false;
  sourceRotationReplayExecuted: false;
  sourceTeamTotalDamageComputationExecuted: false;
  optimizerExecuted: false;
  autoTuneExecuted: false;
  idealStatAllocationExecuted: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type NoelleHexereiEquipmentResponseSurfaceAuthentication =
  | {
      authenticated: true;
      canonicalReport: NoelleHexereiEquipmentResponseSurfaceReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      message: string;
    };

interface ProfileAnchor {
  candidate: NoelleHexereiPartialEquipmentValidationCandidate;
  profileId: ProfileId;
  sourceAlignedSands: SandsStat;
}

interface ExecutedCell {
  cell: NoelleHexereiEquipmentResponseCell;
  buffTrace: NoelleHexereiApplicableBuffTraceRow[];
}

interface NormalizedSheetEntry extends StatEntry {
  filterKey: string;
}

export async function buildNoelleHexereiEquipmentResponseSurfaceReport(
  input: NoelleHexereiEquipmentResponseSurfaceInput,
): Promise<NoelleHexereiEquipmentResponseSurfaceReport> {
  assertAuthenticatedNonBetaRuntimeBranch();
  const raw = authenticateOuterInputs(input);
  assertExactTechnicalRequest(input.technicalRequest);
  const boundCp54Input = buildBoundCp54Input(raw, input.cp54Input);
  if (stableJson(boundCp54Input) !== stableJson(input.cp54Input)) {
    throw new Error(
      "CP55 supplied CP54 input is not the exact projection of the outer authenticated byte closure.",
    );
  }
  const cp54Report =
    await requireAuthenticatedNoelleNormalPrefixFormulaProjectionReport(
      raw.cp54Report,
      boundCp54Input,
    );
  assertCp54SemanticBoundary(cp54Report);
  const cp53Report =
    requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport(
      boundCp54Input.cp53ReportInput,
      boundCp54Input.cp53Input,
    );
  assertCp53SemanticBoundary(cp53Report, cp54Report);
  const anchors = buildProfileAnchors(cp53Report);
  const executed = await runResponseSurface(anchors);
  const cells = executed.map(({ cell }) => cell);
  const comparisonPairs = buildSingleAxisComparisons(cells);
  const witnessSandsSummaries = buildWitnessSandsSummaries(
    cells,
    comparisonPairs,
  );
  const branchSandsVariationSummaries =
    buildBranchSandsVariationSummaries(witnessSandsSummaries);
  const buffTraceCatalog = buildBuffTraceCatalog(executed);
  const directCompiledAgreement = buildAgreementSummary(cells);
  const exactCartesianClosure = buildCartesianClosure(cells);
  const sourceCandidateAnchors = buildSourceCandidateAnchors(anchors);
  const summaryPayload = {
    witnessSandsSummaries,
    branchSandsVariationSummaries,
    directCompiledAgreement,
    exactCartesianClosure,
  };

  return {
    schemaVersion: 1,
    reportType: "noelle-hexerei-equipment-response-surface",
    surfaceId: NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_ID,
    classification: "authenticated-offline-static-equipment-response-surface",
    validationStatus: "completed-48-cell-technical-surface",
    publicationStatus: "withheld-technical-validation-only",
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromBytes: true,
      allSourceBytesMatchWorkspaceFiles: true,
      cp54ReportByteAndParsedObjectParity: true,
      exactCp54InputProjection: true,
      exactTechnicalRequest: true,
      sourceFileCount: EXPECTED_INPUT_PATH_COUNT,
      generatedFromCount: EXPECTED_INPUT_PATH_COUNT,
      runtimeInputPathCount: EXPECTED_RUNTIME_INPUT_PATH_COUNT,
      jsonInputCount: EXPECTED_JSON_INPUT_COUNT,
      binaryRuntimeInputCount: 2,
    },
    upstreamBoundary: {
      cp54ReportPath: NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
      cp54ReportFileSha256: sha256Bytes(
        requiredSourceBytes(
          raw.sourceBytesByPath,
          NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
        ),
      ),
      cp54CanonicalObjectSha256: hashValue(cp54Report),
      cp54FreshlyAuthenticated: true,
      cp53CanonicalObjectSha256: hashValue(cp53Report),
      cp53IndependentlyFreshlyAuthenticated: true,
      cp53CandidateCount: 2,
      cp53SelectedCandidateCount: cp53Report.summary.selectionCount,
      cp53CompleteBuildCount: cp53Report.summary.completeBuildCount,
      cp54StaticFormulaCountTechnicalComputationPreserved: true,
      sourceRotationReplayStillNotAuthorized: true,
    },
    authorityLedger: {
      sourceBacked: [
        "exact-roster-and-order",
        "two-investment-branch-predicates",
        "husk-four-piece-observation",
        "branch-local-sands-and-geo-goblet-options",
        "unordered-crit-rate-or-crit-damage-circlet-options",
        "gest-applicability-under-hexerei-section",
        "noelle-normal-action-prefix-counts",
      ],
      runtimeBacked: [
        "formula-id-and-part-order",
        "constellation-talent-bonus-application",
        "character-weapon-and-artifact-stat-tables",
        "registered-buff-applicability-and-values",
        "gest-four-stack-implementation",
        "geo-resonance-active-assumption",
        "direct-and-compiled-evaluation-paths",
      ],
      guideFactoryTechnical: [
        "six-threshold-relevant-investment-witnesses",
        "entered-request-talent-semantics",
        "level-90-and-level-20-five-star-main-stat-sheet",
        "r1-and-r5-refinement-endpoints",
        "uniform-four-husk-stack-state",
        "fixed-teammate-investment-equipment-and-options",
        "fixed-enemy-context",
        "single-noelle-formula-objective",
      ],
      guideFactoryCounterfactual: [
        "atk-sands-inside-high-branch-cells",
        "def-sands-inside-lower-branch-cells",
      ],
      explicitlyMissing: [
        "source-selected-investment-branch",
        "source-selected-weapon-or-refinement",
        "source-teammate-investment-and-equipment",
        "source-buff-stack-and-duration-state",
        "source-enemy-context",
        "complete-artifact-substats",
        "supporter-formula-counts",
        "rotation-timing-and-buff-coverage",
        "energy-recharge-thresholds",
      ],
    },
    requestBoundary: {
      request: structuredClone(
        NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST,
      ),
      requestCanonicalObjectSha256: hashValue(
        NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST,
      ),
      sourceAuthored: false,
      sourceCandidateSelection: null,
      investmentWitnessSelectionForSourceTeam: false,
      teammateEquipmentSourceAuthored: false,
      supportOptionsSourceAuthored: false,
      refinementSourceAuthored: false,
      enemyContextSourceAuthored: false,
      energyRecoveryDeferred: true,
    },
    sourceCandidateAnchors,
    runtimeAssumptionBoundary: {
      exactRoster: ["noelle", "durin", "nicole", "xilonen"],
      hexereiMembers: ["durin", "nicole"],
      teammateArtifactSheetEntryCount: 0,
      teammateWeaponsHaveNoImplementedBuffs: true,
      durinForm: "white",
      nicoleAtkBuffMode: "all-theosis",
      supportOptionSensitivityExecuted: false,
      huskStacks: 4,
      gestDamageStacksHardcodedByRuntime: 4,
      gestHexereiCritDamageStacksHardcodedByRuntime: 4,
      geoResonanceConditionModeledByRuntimeAsActive: true,
      buffCoverageModel: "existing-static-calculator-state-not-source-timing",
      gestAttackSpeedIncludedButActionTimeNotValued: true,
      rollMultiplierConsumedByConstructedArtifactSheets: false,
      substatBudgetConsumedByConstructedArtifactSheets: false,
      noEnergyRechargeMainStat: true,
      noEnergyRechargeThreshold: true,
    },
    surface: {
      cells,
      comparisonPairs,
      witnessSandsSummaries,
      branchSandsVariationSummaries,
      buffTraceCatalog,
      directCompiledAgreement,
      exactCartesianClosure,
      cellsSha256: hashValue(cells),
      comparisonsSha256: hashValue(comparisonPairs),
      summarySha256: hashValue(summaryPayload),
    },
    operationSummary: {
      investmentWitnessCount: 6,
      sandsStateCount: 2,
      circletStateCount: 2,
      refinementStateCount: 2,
      responseCellCount: 48,
      singleAxisComparisonCount: 72,
      formulaProjectionRunCount: 48,
      freshTeamBuildCount: 48,
      compilerBuildCount: 48,
      directDamageEvaluationCount: 48,
      compiledDamageEvaluationCount: 48,
      technicalNoelleFormulaObjectiveCount: 48,
      guideFactoryTechnicalEquipmentMaterializationCount: 48,
      sourceCandidateSelectionCount: 0,
      sourceCandidateEquipmentAssignmentCount: 0,
      sourceSubstatPriorityEvaluationCount: 0,
      sourceRotationReplayCount: 0,
      sourceSupporterFormulaEvaluationCount: 0,
      sourceTeamTotalDamageComputationCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      idealStatAllocationCount: 0,
      energyRecoveryComputationCount: 0,
    },
    supportsSourceAuthorization: false,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsBuildRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsPlayerDamageClaims: false,
    supportsSourceRotationReplay: false,
    supportsTeamTotalDamageComputation: false,
    supportsDpsClaims: false,
    supportsBuffTimingClaims: false,
    supportsEnergyRecoveryClaims: false,
    supportsIdealStatAllocation: false,
    equipmentResponseSurfaceExecuted: true,
    sourceCandidateSelectionExecuted: false,
    sourceCandidateEquipmentAssignmentExecuted: false,
    sourceSubstatPriorityEvaluationExecuted: false,
    sourceRotationReplayExecuted: false,
    sourceTeamTotalDamageComputationExecuted: false,
    optimizerExecuted: false,
    autoTuneExecuted: false,
    idealStatAllocationExecuted: false,
    energyRecoveryComputationExecuted: false,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

export async function authenticateNoelleHexereiEquipmentResponseSurfaceReport(
  serializedReport: NoelleHexereiEquipmentResponseSurfaceReport,
  input: NoelleHexereiEquipmentResponseSurfaceInput,
): Promise<NoelleHexereiEquipmentResponseSurfaceAuthentication> {
  let canonicalReport: NoelleHexereiEquipmentResponseSurfaceReport;
  try {
    canonicalReport = await buildNoelleHexereiEquipmentResponseSurfaceReport(
      input,
    );
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
        "Serialized CP55 report does not match the fresh canonical computation.",
    };
  }
  return { authenticated: true, canonicalReport };
}

export async function requireAuthenticatedNoelleHexereiEquipmentResponseSurfaceReport(
  serializedReport: NoelleHexereiEquipmentResponseSurfaceReport,
  input: NoelleHexereiEquipmentResponseSurfaceInput,
): Promise<NoelleHexereiEquipmentResponseSurfaceReport> {
  const authentication =
    await authenticateNoelleHexereiEquipmentResponseSurfaceReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP55 authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

async function runResponseSurface(
  anchors: ReadonlyMap<ProfileId, ProfileAnchor>,
): Promise<ExecutedCell[]> {
  assertAuthenticatedNonBetaRuntimeBranch();
  await bootstrapGuideFactoryComputation();
  const executed: ExecutedCell[] = [];
  let sequence = 0;
  for (const witness of INVESTMENT_WITNESSES) {
    assertWitnessMatchesEnteredSourcePredicate(witness);
    const anchor = anchors.get(witness.profileId);
    if (!anchor) throw new Error(`CP55 missing anchor ${witness.profileId}.`);
    for (const sands of SANDS_STATS) {
      for (const circlet of CIRCLET_STATS) {
        for (const refinement of REFINEMENTS) {
          executed.push(
            await executeResponseCell(
              sequence,
              witness,
              anchor,
              sands,
              circlet,
              refinement,
            ),
          );
          sequence += 1;
        }
      }
    }
  }
  if (executed.length !== 48) {
    throw new Error(`CP55 expected 48 cells, observed ${executed.length}.`);
  }
  return executed;
}

function assertWitnessMatchesEnteredSourcePredicate(
  witness: InvestmentWitness,
): void {
  const lowerPredicateSatisfied =
    witness.constellation <= 5 && witness.enteredTalentLevels.burst === 9;
  const highPredicateSatisfied =
    witness.constellation >= 6 || witness.enteredTalentLevels.burst >= 10;
  const expectedProfileId = lowerPredicateSatisfied
    ? "noelle-lower-investment-artifact-profile-v1"
    : highPredicateSatisfied
      ? "noelle-high-investment-artifact-profile-v1"
      : null;
  if (
    lowerPredicateSatisfied === highPredicateSatisfied ||
    expectedProfileId !== witness.profileId
  ) {
    throw new Error(
      `CP55 witness ${witness.witnessId} does not match exactly one entered-fact source predicate.`,
    );
  }
}

async function executeResponseCell(
  sequence: number,
  witness: InvestmentWitness,
  anchor: ProfileAnchor,
  sands: SandsStat,
  circlet: CircletStat,
  refinement: Refinement,
): Promise<ExecutedCell> {
  const runtimeEffectiveTalentLevels =
    deriveExpectedRuntimeEffectiveTalentLevels(witness);
  const configs = buildTeamConfigs(witness, refinement);
  const combatOptions: OptionMap = {
    ...NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST.combatOptions,
  };
  const calcContext = cloneCalcContext();
  const artifactSheet = buildArtifactSheet(sands, circlet);
  const sheets = buildTeamSheets(artifactSheet);
  const teamBuild = new TeamBuild(
    configs,
    combatOptions,
    undefined,
    [],
    undefined,
    calcContext,
  );
  const originalEntry = teamBuild.catalog.formulaIndex.get("noelle-na");
  if (
    !originalEntry ||
    originalEntry.owner !== "noelle" ||
    originalEntry.parts.length !== 4
  ) {
    throw new Error("CP55 Noelle formula boundary drifted before projection.");
  }
  const autoFormulaMultipliersMatchExpectedLevel =
    assertAutoFormulaMultipliersMatchExpectedLevel(
      originalEntry,
      runtimeEffectiveTalentLevels.auto,
    );
  const originalFormulaIndex = [...teamBuild.catalog.formulaIndex.entries()];
  teamBuild.teamStats.setArtifacts(sheets, calcContext);
  const buffTrace = buildApplicableBuffTrace(teamBuild, sheets, calcContext);
  const registeredBuffLedger = teamBuild.buffLedger.allBuffs.map(
    ({ buffKey }) => buffKey,
  );
  const buffEvidence = assertRequiredBuffMaterialization(
    teamBuild,
    buffTrace,
    refinement,
  );
  const burstConversionMatchesExpectedLevel =
    assertBurstConversionMatchesExpectedLevel(
      teamBuild,
      buffTrace,
      runtimeEffectiveTalentLevels.burst,
    );
  const cellInput = {
    witness,
    sourceCandidateId: anchor.candidate.candidateId,
    sourceCandidateSha256: anchor.candidate.candidateSha256,
    sands,
    circlet,
    refinement,
    configs,
    combatOptions,
    calcContext,
    artifactSheet: sheetEntries(artifactSheet),
    projectionSpec: NOELLE_PREFIX_PROJECTION_SPEC,
  };
  const cellId = [witness.witnessId, sands, circlet, `r${refinement}`].join(
    ":",
  );

  const scoped = await withScopedFormulaPartProjection(
    teamBuild.catalog,
    NOELLE_PREFIX_PROJECTION_SPEC,
    async () => {
      const buffOverrides =
        buildBuffOverrides(
          TECHNICAL_COMBO.lines,
          teamBuild,
          sheets,
          calcContext,
        ) ?? {};
      const directTotal = teamBuild.getComboDamageResult(
        TECHNICAL_COMBO,
        sheets,
        calcContext,
        buffOverrides,
      ).totalDamage;
      const compiled = compileComboTeamDamage(
        teamBuild,
        TECHNICAL_COMBO,
        ["noelle"],
        sheets,
        calcContext,
        toCompilerBuffOverrides(buffOverrides),
      );
      const charIdx = compiled.charIdxMap?.get("noelle");
      if (charIdx == null) {
        throw new Error("CP55 compiler omitted the Noelle variable index.");
      }
      if (compiled.evaluateEr !== undefined) {
        throw new Error("CP55 unexpectedly constructed an ER constraint.");
      }
      const vars = new Float64Array(compiled.numVars);
      fillVarsFromSheet(
        artifactSheet,
        compiled.varMapping,
        charIdx,
        vars,
      );
      const compiledTotal = compiled.evaluate(vars);
      const absoluteDifference = Math.abs(directTotal - compiledTotal);
      const allowedDifference = comparisonTolerance(
        directTotal,
        compiledTotal,
      );
      if (absoluteDifference > allowedDifference) {
        throw new Error(
          `CP55 direct/compiled mismatch in ${cellId}: ${absoluteDifference} > ${allowedDifference}.`,
        );
      }
      const finalSheet = teamBuild.getTeamStats(
        sheets,
        "noelle",
        calcContext,
      ).noelle;
      if (!finalSheet) throw new Error("CP55 final Noelle sheet is missing.");
      return {
        buffOverrideKeys: Object.keys(buffOverrides).sort(compareText),
        compilerVariableCount: compiled.numVars,
        compilerNoelleCharacterIndex: charIdx,
        directTotal: normalizeNumber(directTotal),
        compiledTotal: normalizeNumber(compiledTotal),
        absoluteDifference: normalizeNumber(absoluteDifference),
        allowedDifference: normalizeNumber(allowedDifference),
        resolvedNoelleStats: observeResolvedStats(finalSheet),
      };
    },
  );

  const afterFormulaIndex = [...teamBuild.catalog.formulaIndex.entries()];
  if (
    teamBuild.catalog.formulaIndex.get("noelle-na") !== originalEntry ||
    stableJson(afterFormulaIndex.map(([id]) => id)) !==
      stableJson(originalFormulaIndex.map(([id]) => id)) ||
    !afterFormulaIndex.every(
      ([, entry], index) => entry === originalFormulaIndex[index]?.[1],
    ) ||
    !scoped.restoration.originalEntryIdentityRestored ||
    !scoped.restoration.formulaIndexSizeRestored ||
    !scoped.restoration.formulaIndexOrderAndEntryIdentitiesRestored
  ) {
    throw new Error("CP55 formula projection did not restore its local catalog.");
  }

  const mainStats = ["hp", "atk", sands, "geo%", circlet] as [
    "hp",
    "atk",
    SandsStat,
    "geo%",
    CircletStat,
  ];
  const mainStatValuesInternal = Object.fromEntries(
    sheetEntries(artifactSheet).map(({ key, value }) => [key, value]),
  );
  const cell: NoelleHexereiEquipmentResponseCell = {
    sequence,
    cellId,
    cellInputSha256: hashValue(cellInput),
    witnessId: witness.witnessId,
    profileId: witness.profileId,
    sourceCandidateId: anchor.candidate.candidateId,
    sourceCandidateSha256: anchor.candidate.candidateSha256,
    enteredConstellation: witness.constellation,
    enteredTalentLevels: structuredClone(witness.enteredTalentLevels),
    runtimeEffectiveTalentLevels: structuredClone(
      runtimeEffectiveTalentLevels,
    ),
    runtimeTalentEvidence: {
      expectedLevelsDerivedFromAuthenticatedCharacterMetadata: true,
      autoFormulaMultipliersMatchExpectedLevel,
      burstConversionMatchesExpectedLevel,
      skillLevelNotUsedByObjective: true,
    },
    sourcePredicateSatisfiedByEnteredFacts: true,
    sourcePredicateEvaluationAuthorship:
      "guide-factory-request-context-semantics",
    sands,
    sandsAuthority:
      sands === witness.sourceAlignedSands
        ? "source-listed-for-authenticated-branch"
        : "guide-factory-counterfactual",
    circlet,
    circletAuthority: "source-listed-unordered-option",
    refinement,
    refinementAuthority: "guide-factory-missing-source-endpoint",
    artifactSheet: {
      mainStats,
      mainStatValuesInternal,
      substatEntryCount: 0,
      legalCompleteArtifactBuild: false,
      sheetSha256: hashValue(sheetEntries(artifactSheet)),
    },
    runtimeTrace: {
      registeredBuffCount: registeredBuffLedger.length,
      registeredBuffLedgerSha256: hashValue(registeredBuffLedger),
      applicableBuffCountForOnFieldNoelle: buffTrace.length,
      applicableBuffTraceSha256: hashValue(buffTrace),
      computedBuffOverrideKeys: scoped.value.buffOverrideKeys,
      computedBuffOverrideCountDoesNotRepresentApplicableBuffCount: true,
      gestBuffCount: 3,
      gestHexereiCritDamageMaterialized: true,
      gestDamageBonus: buffEvidence.gestDamageBonus,
      gestCritDamage: buffEvidence.gestCritDamage,
      gestAttackSpeed: 0.1,
      huskBuffCount: 1,
      huskDefenseBonus: 0.24,
      huskGeoDamageBonus: 0.24,
      geoResonanceBuffCount: 2,
      geoResonanceDamageBonus: 0.15,
      geoResonanceResistanceReduction: 0.2,
      teammateWeaponBuffCount: 0,
      exactRequiredBuffValuesVerified: true,
      compilerVariableCount: scoped.value.compilerVariableCount,
      compilerNoelleCharacterIndex:
        scoped.value.compilerNoelleCharacterIndex,
      compilerErConstraintPresent: false,
    },
    formulaProjection: {
      projectedPartHits: [5, 5, 3],
      omittedPartIndexes: [3],
      originalEntryIdentityRestored: true,
      formulaIndexSizeRestored: true,
      formulaIndexOrderAndEntryIdentitiesRestored: true,
    },
    objective: {
      directTotal: scoped.value.directTotal,
      compiledTotal: scoped.value.compiledTotal,
      absoluteDifference: scoped.value.absoluteDifference,
      allowedDifference: scoped.value.allowedDifference,
      directCompiledAgreement: true,
      resolvedNoelleStats: scoped.value.resolvedNoelleStats,
      numericClassification: "technical-fixture-local-only",
    },
  };
  return { cell, buffTrace };
}

function deriveExpectedRuntimeEffectiveTalentLevels(
  witness: InvestmentWitness,
): NoelleHexereiEquipmentResponseCell["runtimeEffectiveTalentLevels"] {
  const info = charInfo.noelle;
  if (info.c3Talent !== "E" || info.c5Talent !== "Q") {
    throw new Error("CP55 authenticated Noelle talent-bonus metadata drifted.");
  }
  const expected = {
    auto: witness.enteredTalentLevels.auto,
    skill:
      witness.enteredTalentLevels.skill +
      (witness.constellation >= 3 ? 3 : 0),
    burst:
      witness.enteredTalentLevels.burst +
      (witness.constellation >= 5 ? 3 : 0),
  };
  if (stableJson(expected) !== stableJson(witness.runtimeEffectiveTalentLevels)) {
    throw new Error(
      `CP55 witness ${witness.witnessId} runtime-effective talent declaration drifted.`,
    );
  }
  return expected as NoelleHexereiEquipmentResponseCell["runtimeEffectiveTalentLevels"];
}

function assertAutoFormulaMultipliersMatchExpectedLevel(
  entry: FormulaEntry,
  effectiveAutoLevel: number,
): true {
  const observed = entry.parts.map(({ formula }) =>
    normalizeNumber(formula.talentMultiplier),
  );
  const expected = [0, 1, 2, 3].map((paramIndex) =>
    normalizeNumber(
      getTalentParam("noelle", "A", effectiveAutoLevel - 1, paramIndex),
    ),
  );
  if (stableJson(observed) !== stableJson(expected)) {
    throw new Error("CP55 Noelle Normal multipliers do not match the expected runtime talent level.");
  }
  return true;
}

function assertBurstConversionMatchesExpectedLevel(
  teamBuild: TeamBuild,
  buffTrace: readonly NoelleHexereiApplicableBuffTraceRow[],
  effectiveBurstLevel: number,
): true {
  const preNoelle = teamBuild.teamStats.getAllPreStats("noelle").noelle;
  if (!preNoelle) throw new Error("CP55 Noelle pre-stat sheet is missing.");
  const qRows = buffTrace.filter(
    ({ providerCharId, source }) =>
      providerCharId === "noelle" &&
      source.type === "character" &&
      source.id === "noelle" &&
      source.origin === "Q",
  );
  const resolvedAtkEntries = qRows.flatMap(({ resolvedDynamicEntries }) =>
    resolvedDynamicEntries.filter(({ key }) => key === "atk"),
  );
  if (qRows.length !== 1 || resolvedAtkEntries.length !== 1) {
    throw new Error("CP55 Noelle Burst conversion trace is not unique.");
  }
  const expectedConversion =
    preNoelle.get("def", null) *
    getTalentParam("noelle", "Q", effectiveBurstLevel - 1, 2);
  const observedConversion = resolvedAtkEntries[0].value;
  if (
    Math.abs(expectedConversion - observedConversion) >
    comparisonTolerance(expectedConversion, observedConversion)
  ) {
    throw new Error(
      "CP55 Noelle Burst conversion does not match the expected runtime talent level.",
    );
  }
  return true;
}

function assertRequiredBuffMaterialization(
  teamBuild: TeamBuild,
  buffTrace: readonly NoelleHexereiApplicableBuffTraceRow[],
  refinement: Refinement,
): { gestDamageBonus: number; gestCritDamage: number } {
  const gestValue = refinement === 1 ? 0.3 : 0.62;
  const gestRows = buffTrace
    .filter(
      ({ providerCharId, source }) =>
        providerCharId === "noelle" &&
        source.type === "weapon" &&
        source.id === "gest_of_the_mighty_wolf",
    )
    .map(compactBuffTraceRow)
    .sort(compareStableValues);
  const expectedGestRows = [
    {
      source: {
        type: "weapon",
        id: "gest_of_the_mighty_wolf",
        origin: `R${refinement}`,
      },
      target: { receiver: "self" },
      staticEntries: [{ key: "atkSpd%", value: 0.1 }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
    {
      source: {
        type: "weapon",
        id: "gest_of_the_mighty_wolf",
        origin: `R${refinement}`,
        triggers: ["normal", "E", "charge"],
      },
      target: { receiver: "self" },
      staticEntries: [{ key: "cd", value: gestValue }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
    {
      source: {
        type: "weapon",
        id: "gest_of_the_mighty_wolf",
        origin: `R${refinement}`,
        triggers: ["normal", "E", "charge"],
      },
      target: { receiver: "self" },
      staticEntries: [{ key: "dmg%", value: gestValue }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
  ].sort(compareStableValues);

  const huskRows = buffTrace
    .filter(
      ({ providerCharId, source }) =>
        providerCharId === "noelle" &&
        source.type === "artifactSet" &&
        source.id === "husk_of_opulent_dreams",
    )
    .map(compactBuffTraceRow);
  const expectedHuskRows = [
    {
      source: {
        type: "artifactSet",
        id: "husk_of_opulent_dreams",
        triggers: ["geo-hit"],
      },
      target: { receiver: "self" },
      staticEntries: [
        { key: "def%", value: 0.24 },
        { key: "geo%", value: 0.24 },
      ],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
  ];

  const geoRows = buffTrace
    .filter(
      ({ providerCharId, source }) =>
        providerCharId === "resonance" &&
        source.type === "teamResonance" &&
        source.id === "geo",
    )
    .map(compactBuffTraceRow)
    .sort(compareStableValues);
  const expectedGeoRows = [
    {
      source: {
        type: "teamResonance",
        id: "geo",
        internalKey: "res-shred",
        triggers: ["damage"],
      },
      target: { receiver: "team", filter: { elements: ["Geo"] } },
      staticEntries: [{ key: "resReduction%", value: 0.2 }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
    {
      source: {
        type: "teamResonance",
        id: "geo",
        triggers: ["shielded", "lunarCrystallize"],
      },
      target: { receiver: "team" },
      staticEntries: [{ key: "dmg%", value: 0.15 }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
  ].sort(compareStableValues);

  const teammateWeaponBuffCount = teamBuild.buffLedger.allBuffs.filter(
    ({ buff }) =>
      buff.source.type === "weapon" &&
      ["travelers_handy_sword", "otherworldly_story"].includes(
        buff.source.id,
      ),
  ).length;
  if (
    stableJson(gestRows) !== stableJson(expectedGestRows) ||
    stableJson(huskRows) !== stableJson(expectedHuskRows) ||
    stableJson(geoRows) !== stableJson(expectedGeoRows) ||
    teammateWeaponBuffCount !== 0
  ) {
    throw new Error("CP55 required Gest/Husk/Geo/teammate buff materialization drifted.");
  }
  return { gestDamageBonus: gestValue, gestCritDamage: gestValue };
}

function compactBuffTraceRow(row: NoelleHexereiApplicableBuffTraceRow): {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  staticEntries: StatEntry[];
  dynamicPhase: NoelleHexereiApplicableBuffTraceRow["dynamicPhase"];
  resolvedDynamicEntries: StatEntry[];
} {
  return {
    source: row.source,
    target: row.target,
    staticEntries: row.staticEntries,
    dynamicPhase: row.dynamicPhase,
    resolvedDynamicEntries: row.resolvedDynamicEntries,
  };
}

function compareStableValues(left: unknown, right: unknown): number {
  return compareText(stableJson(left), stableJson(right));
}

function buildApplicableBuffTrace(
  teamBuild: TeamBuild,
  sheets: Record<string, StatSheet>,
  calcContext: CalcContext,
): NoelleHexereiApplicableBuffTraceRow[] {
  teamBuild.teamStats.setArtifacts(sheets, calcContext);
  const pre = teamBuild.teamStats.getAllPreStats("noelle");
  const mid = teamBuild.teamStats.getAllMidStats("noelle");
  const postKeys = new Set(
    teamBuild.buffLedger
      .getDynamicPost("noelle", "noelle")
      .map(({ buffKey }) => buffKey),
  );
  const midKeys = new Set(
    teamBuild.buffLedger
      .getDynamicMid("noelle", "noelle")
      .map(({ buffKey }) => buffKey),
  );
  return teamBuild.buffLedger
    .getApplicable("noelle", "noelle")
    .map(({ buff, providerCharId, buffKey }) => {
      const dynamicPhase: NoelleHexereiApplicableBuffTraceRow["dynamicPhase"] = postKeys.has(buffKey)
        ? "post"
        : midKeys.has(buffKey)
          ? "mid"
          : "none";
      const stats = dynamicPhase === "post" ? mid : pre;
      const ownerStats = stats[providerCharId];
      const resolvedDynamicEntries =
        dynamicPhase === "none" || !ownerStats
          ? []
          : buff.dynamicBuffs(ownerStats, Object.values(stats));
      return {
        providerCharId,
        buffKey,
        source: structuredClone(buff.source) as Record<string, unknown>,
        target: structuredClone(buff.target) as Record<string, unknown>,
        implementationClass: buff.constructor.name || "StatBuff",
        staticEntries: structuredClone(buff.staticBuffs),
        dynamicPhase,
        resolvedDynamicEntries: structuredClone(resolvedDynamicEntries),
      };
    })
    .sort((left, right) => compareText(left.buffKey, right.buffKey));
}

function buildSingleAxisComparisons(
  cells: readonly NoelleHexereiEquipmentResponseCell[],
): NoelleHexereiSingleAxisComparison[] {
  const comparisons: NoelleHexereiSingleAxisComparison[] = [];
  for (const witness of INVESTMENT_WITNESSES) {
    for (const circlet of CIRCLET_STATS) {
      for (const refinement of REFINEMENTS) {
        const left = requireCell(cells, witness.witnessId, "atk%", circlet, refinement);
        const right = requireCell(cells, witness.witnessId, "def%", circlet, refinement);
        comparisons.push(
          makeComparison("sands", left, right, "atk%", "def%"),
        );
      }
    }
    for (const sands of SANDS_STATS) {
      for (const refinement of REFINEMENTS) {
        const left = requireCell(cells, witness.witnessId, sands, "cr", refinement);
        const right = requireCell(cells, witness.witnessId, sands, "cd", refinement);
        comparisons.push(makeComparison("circlet", left, right, "cr", "cd"));
      }
    }
    for (const sands of SANDS_STATS) {
      for (const circlet of CIRCLET_STATS) {
        const left = requireCell(cells, witness.witnessId, sands, circlet, 1);
        const right = requireCell(cells, witness.witnessId, sands, circlet, 5);
        comparisons.push(makeComparison("refinement", left, right, 1, 5));
      }
    }
  }
  if (comparisons.length !== 72) {
    throw new Error(`CP55 expected 72 comparisons, got ${comparisons.length}.`);
  }
  return comparisons;
}

function makeComparison(
  changedAxis: NoelleHexereiSingleAxisComparison["changedAxis"],
  left: NoelleHexereiEquipmentResponseCell,
  right: NoelleHexereiEquipmentResponseCell,
  leftAxisValue: string | number,
  rightAxisValue: string | number,
): NoelleHexereiSingleAxisComparison {
  assertExactlyOneAxisChanged(left, right, changedAxis);
  const fixedAxisPayload = {
    witnessId: left.witnessId,
    sands: changedAxis === "sands" ? null : left.sands,
    circlet: changedAxis === "circlet" ? null : left.circlet,
    refinement: changedAxis === "refinement" ? null : left.refinement,
  };
  return {
    comparisonId: `${changedAxis}:${left.cellId}::${right.cellId}`,
    changedAxis,
    leftCellId: left.cellId,
    rightCellId: right.cellId,
    fixedAxisPayloadSha256: hashValue(fixedAxisPayload),
    exactlyOneDeclaredAxisChanged: true,
    leftAxisValue,
    rightAxisValue,
    leftDirectTotal: left.objective.directTotal,
    rightDirectTotal: right.objective.directTotal,
    signedLeftMinusRightDelta: normalizeNumber(
      left.objective.directTotal - right.objective.directTotal,
    ),
    sourceExpectedOrdering: null,
    selectionExecuted: false,
  };
}

function assertExactlyOneAxisChanged(
  left: NoelleHexereiEquipmentResponseCell,
  right: NoelleHexereiEquipmentResponseCell,
  expectedAxis: NoelleHexereiSingleAxisComparison["changedAxis"],
): void {
  const changed = [
    left.witnessId === right.witnessId ? null : "witness",
    left.sands === right.sands ? null : "sands",
    left.circlet === right.circlet ? null : "circlet",
    left.refinement === right.refinement ? null : "refinement",
  ].filter((axis): axis is string => axis !== null);
  if (stableJson(changed) !== stableJson([expectedAxis])) {
    throw new Error(
      `CP55 comparison changed ${changed.join(",") || "no axes"}, expected ${expectedAxis}.`,
    );
  }
}

function buildWitnessSandsSummaries(
  cells: readonly NoelleHexereiEquipmentResponseCell[],
  comparisons: readonly NoelleHexereiSingleAxisComparison[],
): NoelleHexereiWitnessSandsSummary[] {
  return INVESTMENT_WITNESSES.map((witness) => {
    const candidate = comparisons.filter(
      ({ changedAxis, leftCellId }) =>
        changedAxis === "sands" && leftCellId.startsWith(`${witness.witnessId}:`),
    );
    if (candidate.length !== 4) {
      throw new Error(`CP55 expected four Sands pairs for ${witness.witnessId}.`);
    }
    const sourceAlignedSands = witness.sourceAlignedSands;
    const counterfactualSands: SandsStat =
      sourceAlignedSands === "atk%" ? "def%" : "atk%";
    const signed = candidate.map((comparison) => {
      const left = cells.find(({ cellId }) => cellId === comparison.leftCellId);
      const right = cells.find(({ cellId }) => cellId === comparison.rightCellId);
      if (!left || !right) throw new Error("CP55 comparison cell disappeared.");
      const sourceAligned =
        left.sands === sourceAlignedSands ? left : right;
      const counterfactual = sourceAligned === left ? right : left;
      return normalizeNumber(
        sourceAligned.objective.directTotal -
          counterfactual.objective.directTotal,
      );
    });
    const signs = signed.map((delta) => {
      const tolerance = comparisonTolerance(delta, 0);
      return delta > tolerance
        ? ("positive" as const)
        : delta < -tolerance
          ? ("negative" as const)
          : ("tie" as const);
    });
    const observedSignSet = [...new Set(signs)].sort(compareText);
    return {
      witnessId: witness.witnessId,
      profileId: witness.profileId,
      comparisonCount: 4,
      sourceAlignedSands,
      counterfactualSands,
      positiveSourceAlignedMinusCounterfactualCount: signs.filter(
        (sign) => sign === "positive",
      ).length,
      negativeSourceAlignedMinusCounterfactualCount: signs.filter(
        (sign) => sign === "negative",
      ).length,
      numericalTieCount: signs.filter((sign) => sign === "tie").length,
      observedSignSet,
      supportsBranchWideSandsClaim: false,
      selectionExecuted: false,
    };
  });
}

function buildBranchSandsVariationSummaries(
  witnessSummaries: readonly NoelleHexereiWitnessSandsSummary[],
): NoelleHexereiBranchSandsVariationSummary[] {
  return PROFILE_IDS.map((profileId) => {
    const rows = witnessSummaries.filter(
      (summary) => summary.profileId === profileId,
    );
    const expectedCount =
      profileId === "noelle-lower-investment-artifact-profile-v1" ? 2 : 4;
    if (rows.length !== expectedCount) {
      throw new Error(
        `CP55 expected ${expectedCount} witness summaries for ${profileId}.`,
      );
    }
    const observedSignSetAcrossWitnesses = [
      ...new Set(rows.flatMap(({ observedSignSet }) => observedSignSet)),
    ].sort(compareText);
    return {
      profileId,
      witnessIds: rows.map(({ witnessId }) => witnessId),
      observedSignSetAcrossWitnesses,
      crossWitnessSignVariationObserved:
        observedSignSetAcrossWitnesses.length > 1,
      supportsBranchWideSandsClaim: false,
      branchAverageComputed: false,
      selectionExecuted: false,
    };
  });
}

function buildBuffTraceCatalog(
  executed: readonly ExecutedCell[],
): NoelleHexereiBuffTraceCatalogEntry[] {
  const byHash = new Map<
    string,
    { rows: NoelleHexereiApplicableBuffTraceRow[]; count: number }
  >();
  for (const { cell, buffTrace } of executed) {
    const hash = hashValue(buffTrace);
    if (hash !== cell.runtimeTrace.applicableBuffTraceSha256) {
      throw new Error("CP55 cell buff trace hash drifted before cataloging.");
    }
    const existing = byHash.get(hash);
    if (existing) {
      if (stableJson(existing.rows) !== stableJson(buffTrace)) {
        throw new Error("CP55 buff trace hash collision detected.");
      }
      existing.count += 1;
    } else {
      byHash.set(hash, { rows: structuredClone(buffTrace), count: 1 });
    }
  }
  return [...byHash.entries()]
    .map(([traceSha256, { rows, count }]) => ({
      traceSha256,
      observedCellCount: count,
      rows,
    }))
    .sort((left, right) => compareText(left.traceSha256, right.traceSha256));
}

function buildAgreementSummary(
  cells: readonly NoelleHexereiEquipmentResponseCell[],
): NoelleHexereiEquipmentResponseSurfaceReport["surface"]["directCompiledAgreement"] {
  const mismatches = cells.filter(
    ({ objective }) =>
      objective.absoluteDifference > objective.allowedDifference,
  );
  if (cells.length !== 48 || mismatches.length !== 0) {
    throw new Error("CP55 direct/compiled agreement summary drifted.");
  }
  return {
    evaluatedCellCount: 48,
    agreementCount: 48,
    mismatchCount: 0,
    maximumAbsoluteDifference: normalizeNumber(
      Math.max(...cells.map(({ objective }) => objective.absoluteDifference)),
    ),
    allWithinTolerance: true,
  };
}

function buildCartesianClosure(
  cells: readonly NoelleHexereiEquipmentResponseCell[],
): NoelleHexereiEquipmentResponseSurfaceReport["surface"]["exactCartesianClosure"] {
  const uniqueInputs = new Set(cells.map(({ cellInputSha256 }) => cellInputSha256));
  const expectedIds = INVESTMENT_WITNESSES.flatMap((witness) =>
    SANDS_STATS.flatMap((sands) =>
      CIRCLET_STATS.flatMap((circlet) =>
        REFINEMENTS.map((refinement) =>
          [witness.witnessId, sands, circlet, `r${refinement}`].join(":"),
        ),
      ),
    ),
  );
  if (
    cells.length !== 48 ||
    uniqueInputs.size !== 48 ||
    stableJson(cells.map(({ cellId }) => cellId)) !== stableJson(expectedIds)
  ) {
    throw new Error("CP55 exact Cartesian closure drifted.");
  }
  return {
    witnessCount: 6,
    sandsCount: 2,
    circletCount: 2,
    refinementCount: 2,
    expectedCellCount: 48,
    observedCellCount: 48,
    uniqueCellInputCount: 48,
    complete: true,
  };
}

function buildProfileAnchors(
  cp53Report: NoelleHexereiPartialEquipmentCompositionReport,
): Map<ProfileId, ProfileAnchor> {
  if (cp53Report.candidates.length !== 2) {
    throw new Error("CP55 requires exactly two CP53 candidates.");
  }
  const anchors = new Map<ProfileId, ProfileAnchor>();
  for (const profileId of PROFILE_IDS) {
    const matches = cp53Report.candidates.filter(
      ({ artifactProfile }) => artifactProfile.profileId === profileId,
    );
    if (matches.length !== 1) {
      throw new Error(`CP55 missing unique candidate ${profileId}.`);
    }
    const candidate = matches[0];
    assertCandidatePayloadHash(candidate);
    const sourceAlignedSands: SandsStat =
      profileId === "noelle-lower-investment-artifact-profile-v1"
        ? "atk%"
        : "def%";
    assertCandidateTechnicalBoundary(candidate, sourceAlignedSands);
    anchors.set(profileId, { candidate, profileId, sourceAlignedSands });
  }
  return anchors;
}

function buildSourceCandidateAnchors(
  anchors: ReadonlyMap<ProfileId, ProfileAnchor>,
): NoelleHexereiEquipmentResponseSurfaceReport["sourceCandidateAnchors"] {
  return PROFILE_IDS.map((profileId) => {
    const anchor = anchors.get(profileId);
    if (!anchor) throw new Error(`CP55 missing profile anchor ${profileId}.`);
    const { candidate } = anchor;
    const profile = candidate.artifactProfile;
    const guardedMainStatAlternativesPreservedButNotEvaluated = (
      ["goblet", "circlet"] as const
    ).flatMap((slot) =>
      profile.mainStats[slot].options
        .filter(
          ({ conditionStatus }) =>
            conditionStatus === "additional-source-guard-unresolved",
        )
        .map(({ statIds, sourceConditions }) => ({
          slot,
          statIds: [...statIds],
          sourceConditions: [...sourceConditions],
        })),
    );
    return {
      candidateId: candidate.candidateId,
      candidateSha256: candidate.candidateSha256,
      candidatePayloadSha256Verified: true,
      profileId,
      sourceRecordId: profile.sourceRecordId,
      sourceCondition: profile.branch.sourceCondition,
      sourceRequestPredicate: structuredClone(profile.branch.requestPredicate),
      sourceArtifactSet: structuredClone(profile.artifactSet.set),
      sourceMainStats: {
        sands: profile.mainStats.sands.options.map(({ statIds }) => [...statIds]),
        goblet: profile.mainStats.goblet.options.map(({ statIds }) => [...statIds]),
        circlet: profile.mainStats.circlet.options.map(({ statIds }) => [
          ...statIds,
        ]),
      },
      guardedMainStatAlternativesPreservedButNotEvaluated,
      sourcePriorityGroupsPreservedButNotEvaluated:
        [...profile.substatPriority.groups]
          .sort((left, right) => left.priority - right.priority)
          .map(({ statIds }) => [...statIds]),
      sourceScalarWeights: null,
      sourceSelectedAllocation: null,
      sourceWeaponId: "gest_of_the_mighty_wolf",
      sourceWeaponOrdering: "unranked",
      sourceWeaponRefinement: null,
      sourceQuantitativePerformanceStatus: "missing-not-zero",
      matchingTechnicalWitnessIds: INVESTMENT_WITNESSES.filter(
        (witness) => witness.profileId === profileId,
      ).map(({ witnessId }) => witnessId),
    };
  });
}

function assertCandidateTechnicalBoundary(
  candidate: NoelleHexereiPartialEquipmentValidationCandidate,
  sourceAlignedSands: SandsStat,
): void {
  const profile = candidate.artifactProfile;
  const expectedPredicate =
    sourceAlignedSands === "atk%"
      ? {
          type: "all",
          predicates: [
            {
              type: "constellation-at-most",
              characterId: "noelle",
              threshold: 5,
            },
            {
              type: "talent-level-is",
              characterId: "noelle",
              talent: "burst",
              threshold: 9,
            },
          ],
        }
      : {
          type: "any",
          predicates: [
            {
              type: "constellation-at-least",
              characterId: "noelle",
              threshold: 6,
            },
            {
              type: "talent-level-at-least",
              characterId: "noelle",
              talent: "burst",
              threshold: 10,
            },
          ],
        };
  const expectedSourceCondition =
    sourceAlignedSands === "atk%"
      ? "Noelle is C0–C5 and her Burst Talent is Level 9."
      : "Noelle is C6 or her Burst Talent is Level 10 or higher.";
  const expected =
    sourceAlignedSands === "atk%"
      ? {
          sands: [["atk%"]],
          goblet: [["geo%"]],
          circlet: [["cr", "cd"]],
          groups: [["cr", "cd"], ["atk%"], ["def%"]],
          guardedCount: 0,
        }
      : {
          sands: [["def%"]],
          goblet: [["geo%"], ["def%"]],
          circlet: [["cr", "cd"], ["def%"]],
          groups: [["cr", "cd"], ["def%"], ["atk%"]],
          guardedCount: 2,
        };
  const guardedCount = [
    ...profile.mainStats.goblet.options,
    ...profile.mainStats.circlet.options,
  ].filter(
    ({ conditionStatus }) =>
      conditionStatus === "additional-source-guard-unresolved",
  ).length;
  if (
    candidate.characterId !== "noelle" ||
    candidate.team.investmentBranchSelected ||
    candidate.team.investmentBranchEvaluation !== "not-evaluated" ||
    stableJson(candidate.team.orderedCharacterIds) !==
      stableJson(["noelle", "durin", "nicole", "xilonen"]) ||
    candidate.weaponOption.sourceObservation.weaponId !==
      "gest_of_the_mighty_wolf" ||
    candidate.weaponOption.sourceObservation.weaponOrdering !== "unranked" ||
    candidate.weaponOption.refinement !== null ||
    candidate.weaponOption.quantitativePerformanceStatus !==
      "missing-not-zero" ||
    profile.artifactSet.set.setId !== "husk_of_opulent_dreams" ||
    profile.artifactSet.assignedToRuntimeBuild ||
    profile.branch.sourceCondition !== expectedSourceCondition ||
    profile.branch.applicability !==
      "typed-request-context-branch-authenticated" ||
    profile.branch.exhaustiveAcrossAllInvestmentStates ||
    stableJson(profile.branch.requestPredicate) !==
      stableJson(expectedPredicate) ||
    stableJson(profile.mainStats.sands.options.map(({ statIds }) => statIds)) !==
      stableJson(expected.sands) ||
    stableJson(profile.mainStats.goblet.options.map(({ statIds }) => statIds)) !==
      stableJson(expected.goblet) ||
    stableJson(
      profile.mainStats.circlet.options.map(({ statIds }) => statIds),
    ) !== stableJson(expected.circlet) ||
    stableJson(
      [...profile.substatPriority.groups]
        .sort((left, right) => left.priority - right.priority)
        .map(({ statIds }) => statIds),
    ) !== stableJson(expected.groups) ||
    guardedCount !== expected.guardedCount ||
    profile.substatPriority.scalarWeights !== null ||
    profile.substatPriority.selectedAllocation !== null ||
    candidate.selections.selectedWeapon !== null ||
    candidate.selections.selectedArtifactSet !== null ||
    candidate.selections.selectedSubstatAllocation !== null ||
    candidate.completeness.completeBuild ||
    candidate.completeness.completeArtifactAssignment
  ) {
    throw new Error(
      `CP55 candidate boundary drifted for ${profile.profileId}.`,
    );
  }
}

function assertCandidatePayloadHash(
  candidate: NoelleHexereiPartialEquipmentValidationCandidate,
): void {
  const { candidateSha256, ...payload } = candidate;
  if (candidateSha256 !== hashValue(payload)) {
    throw new Error(`CP55 candidate hash drifted for ${candidate.candidateId}.`);
  }
}

function buildTeamConfigs(
  witness: InvestmentWitness,
  refinement: Refinement,
): TeamSlotConfig[] {
  return [
    {
      charId: "noelle",
      charLevel: 90,
      constellation: witness.constellation,
      weaponId: "gest_of_the_mighty_wolf",
      refinement,
      artifactSet: { type: "4pc", setId: "husk_of_opulent_dreams" },
      talentLevels: { ...witness.enteredTalentLevels },
    },
    ...TEAMMATE_FIXTURES.map((fixture) => ({
      ...fixture,
      talentLevels: { ...fixture.talentLevels },
    })),
  ];
}

function buildArtifactSheet(
  sands: SandsStat,
  circlet: CircletStat,
): StatSheet {
  return new StatSheet([
    mainStatEntry("hp"),
    mainStatEntry("atk"),
    mainStatEntry(sands),
    mainStatEntry("geo%"),
    mainStatEntry(circlet),
  ]);
}

function mainStatEntry(stat: MainStat): StatEntry {
  return {
    key: stat as StatKey,
    value: toInternal(stat, getMainStatValueAtLevel(stat, 5, 20)),
  };
}

function buildTeamSheets(noelle: StatSheet): Record<string, StatSheet> {
  return {
    noelle,
    durin: new StatSheet([]),
    nicole: new StatSheet([]),
    xilonen: new StatSheet([]),
  };
}

function sheetEntries(sheet: StatSheet): NormalizedSheetEntry[] {
  return [...sheet.dump()]
    .map(({ key, filterKey, value }) => ({
      key,
      filterKey,
      value: normalizeNumber(value),
    }))
    .sort((left, right) =>
      compareText(
        `${left.key}\0${left.filterKey}`,
        `${right.key}\0${right.filterKey}`,
      ),
    );
}

function observeResolvedStats(
  sheet: StatSheet,
): NoelleHexereiResolvedStatObservation {
  return {
    atk: normalizeNumber(sheet.get("atk", null)),
    def: normalizeNumber(sheet.get("def", null)),
    cr: normalizeNumber(sheet.get("cr", null)),
    cd: normalizeNumber(sheet.get("cd", null)),
    geoNormalDamageBonus: normalizeNumber(
      sheet.get("dmg%", NOELLE_GEO_NORMAL_TAG),
    ),
  };
}

function requireCell(
  cells: readonly NoelleHexereiEquipmentResponseCell[],
  witnessId: WitnessId,
  sands: SandsStat,
  circlet: CircletStat,
  refinement: Refinement,
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
      `CP55 expected one cell ${witnessId}/${sands}/${circlet}/R${refinement}.`,
    );
  }
  return matches[0];
}

function cloneCalcContext(): CalcContext {
  return {
    enemyLevel: 100,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  };
}

function toCompilerBuffOverrides(
  overrides: Record<number, BuffActivationMap>,
): Record<string, BuffActivationMap> {
  return Object.fromEntries(
    Object.entries(overrides).map(([lineIndex, activation]) => [
      `line:${lineIndex}`,
      activation,
    ]),
  );
}

function comparisonTolerance(left: number, right: number): number {
  return Math.max(
    ABSOLUTE_TOLERANCE,
    RELATIVE_TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right)),
  );
}

function authenticateOuterInputs(
  input: NoelleHexereiEquipmentResponseSurfaceInput,
): AuthenticatedOuterInputs {
  if (
    NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS.length !==
      EXPECTED_RUNTIME_INPUT_PATH_COUNT ||
    NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS.length !==
      EXPECTED_INPUT_PATH_COUNT ||
    NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS.filter(
      (sourcePath) => sourcePath.endsWith(".json"),
    ).length !== EXPECTED_JSON_INPUT_COUNT
  ) {
    throw new Error("CP55 declared closure cardinality drifted.");
  }
  const expectedPaths = [
    ...NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
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
    throw new Error("CP55 exact outer source/generatedFrom path closure drifted.");
  }
  const sourceBytesByPath = new Map<string, Buffer>();
  for (const { path: sourcePath, bytesBase64 } of input.sourceFiles) {
    if (!bytesBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(bytesBase64)) {
      throw new Error(`CP55 source bytes are not canonical base64 at ${sourcePath}.`);
    }
    const bytes = Buffer.from(bytesBase64, "base64");
    if (bytes.length === 0 || bytes.toString("base64") !== bytesBase64) {
      throw new Error(`CP55 source bytes failed base64 round-trip at ${sourcePath}.`);
    }
    let workspaceBytes: Buffer;
    try {
      workspaceBytes = readFileSync(path.join(REPOSITORY_ROOT, sourcePath));
    } catch {
      throw new Error(`CP55 workspace source file is unreadable at ${sourcePath}.`);
    }
    if (!bytes.equals(workspaceBytes)) {
      throw new Error(
        `CP55 supplied source bytes do not match the workspace file at ${sourcePath}.`,
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
      throw new Error(`CP55 source/hash authentication drifted at ${sourcePath}.`);
    }
  }
  let parsedCp54Report: unknown;
  try {
    parsedCp54Report = JSON.parse(
      requiredSourceBytes(
        sourceBytesByPath,
        NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
      ).toString("utf8"),
    );
  } catch {
    throw new Error("CP55 CP54 durable report bytes are not valid JSON.");
  }
  if (stableJson(parsedCp54Report) !== stableJson(input.cp54ReportInput)) {
    throw new Error(
      "CP55 CP54 durable report bytes disagree with the supplied parsed object.",
    );
  }
  return {
    sourceBytesByPath,
    generatedFrom: input.generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    cp54Report:
      parsedCp54Report as NoelleNormalPrefixFormulaProjectionReport,
  };
}

function buildBoundCp54Input(
  raw: AuthenticatedOuterInputs,
  supplied: NoelleNormalPrefixFormulaProjectionInput,
): NoelleNormalPrefixFormulaProjectionInput {
  const generatedByPath = new Map(
    raw.generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  const parsedCp53Report = JSON.parse(
    requiredSourceBytes(
      raw.sourceBytesByPath,
      "scripts/guide-factory/reports/noelle-hexerei-partial-equipment-composition.json",
    ).toString("utf8"),
  ) as NoelleHexereiPartialEquipmentCompositionReport;
  return {
    cp53ReportInput: parsedCp53Report,
    cp53Input: structuredClone(supplied.cp53Input),
    sourceFiles: NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS.map(
      (sourcePath) => ({
        path: sourcePath,
        bytesBase64: requiredSourceBytes(
          raw.sourceBytesByPath,
          sourcePath,
        ).toString("base64"),
      }),
    ),
    generatedFrom: NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS.map(
      (sourcePath) => {
        const entry = generatedByPath.get(sourcePath);
        if (!entry) {
          throw new Error(`CP55 missing CP54 generatedFrom ${sourcePath}.`);
        }
        return { ...entry };
      },
    ),
  };
}

function assertExactTechnicalRequest(request: TechnicalRequest): void {
  if (
    stableJson(request) !==
    stableJson(NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST)
  ) {
    throw new Error("CP55 technical request differs from the exact bounded request.");
  }
}

function assertCp54SemanticBoundary(
  report: NoelleNormalPrefixFormulaProjectionReport,
): void {
  if (
    report.validationStatus !==
      "accepted-exact-static-formula-count-representation" ||
    !report.supportsExactStaticFormulaCountRepresentation ||
    !report.supportsExactStaticFormulaCountTechnicalComputation ||
    !report.formulaProjectionExecuted ||
    !report.staticFormulaCountTechnicalComputationExecuted ||
    report.sourceRotationReplayExecuted ||
    report.sourceTeamTotalDamageComputationExecuted ||
    report.candidateSelectionExecuted ||
    report.optimizerExecuted ||
    report.energyRecoveryComputationExecuted ||
    stableJson(report.representationContract.representedHitVector) !==
      stableJson({ n1: 5, n2: 5, n3: 3, n4: 0 }) ||
    stableJson(report.representationContract.projectedParts) !==
      stableJson([
        { sourcePartIndex: 0, semanticLabel: "N1", hits: 5 },
        { sourcePartIndex: 1, semanticLabel: "N2", hits: 5 },
        { sourcePartIndex: 2, semanticLabel: "N3", hits: 3 },
      ]) ||
    stableJson(report.representationContract.omittedSourcePartIndexes) !==
      stableJson([3]) ||
    !report.technicalHarness.calculatorAgreement.passed
  ) {
    throw new Error("CP55 authenticated CP54 semantic boundary drifted.");
  }
}

function assertCp53SemanticBoundary(
  report: NoelleHexereiPartialEquipmentCompositionReport,
  cp54: NoelleNormalPrefixFormulaProjectionReport,
): void {
  if (
    report.validationStatus !== "authenticated-incomplete-validation-candidates" ||
    report.candidates.length !== 2 ||
    report.summary.selectionCount !== 0 ||
    report.summary.assignmentCount !== 0 ||
    report.summary.completeBuildCount !== 0 ||
    report.summary.energyRecoveryComputationCount !== 0 ||
    report.selectionExecuted ||
    report.rankingExecuted ||
    report.energyRecoveryComputationExecuted ||
    cp54.upstreamBoundary.cp53CanonicalObjectSha256 !== hashValue(report)
  ) {
    throw new Error("CP55 independently authenticated CP53 boundary drifted.");
  }
}

function assertAuthenticatedNonBetaRuntimeBranch(): void {
  if (betaEnabled() || process.env.__BETA_ENABLED_OVERRIDE__ === "true") {
    throw new Error(
      "CP55 Noelle response surface requires the authenticated non-beta runtime branch.",
    );
  }
}

function requiredSourceBytes(
  sourceBytesByPath: Map<string, Buffer>,
  sourcePath: string,
): Buffer {
  const bytes = sourceBytesByPath.get(sourcePath);
  if (!bytes) throw new Error(`CP55 missing source bytes ${sourcePath}.`);
  return bytes;
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`CP55 observed a non-finite numeric value: ${value}.`);
  }
  return Number(value.toPrecision(15));
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
