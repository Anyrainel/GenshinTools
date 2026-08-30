import { createHash } from "node:crypto";
import path from "node:path";

import { betaEnabled } from "@/data/betaState";
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
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import { bootstrapGuideFactoryComputation } from "./computationReplay";
import {
  withScopedFormulaPartProjection,
  type FormulaPartProjectionObservation,
  type FormulaPartProjectionSpec,
} from "./formulaPartProjection";
import { stableJson } from "./io";
import {
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS,
  requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport,
  type NoelleHexereiPartialEquipmentCompositionInput,
  type NoelleHexereiPartialEquipmentCompositionReport,
} from "./noelleHexereiPartialEquipmentComposition";
import { FACTORY_ROOT } from "./paths";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";

export const NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_ID =
  "noelle-normal-prefix-formula-projection-v1";
export const NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "noelle-normal-prefix-formula-projection.json",
);

export const NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-hexerei-partial-equipment-composition.json";
export const FORMULA_PART_PROJECTION_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/formulaPartProjection.ts";
export const NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/noelleNormalPrefixFormulaProjection.ts";
export const NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_CLI_RELATIVE_PATH =
  "scripts/guide-factory/src/assemble-noelle-normal-prefix-formula-projection.ts";

/**
 * Exact first-party module closure used by the offline technical harness.
 * Binary archives are authenticated as bytes by the outer checkpoint input.
 */
export const NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS = [
  "scripts/guide-factory/src/computationReplay.ts",
  "src/data/betaState.ts",
  "src/data/charInfo.ts",
  "src/data/constants.ts",
  "src/data/enums.ts",
  "src/data/game/artifact_stat.json",
  "src/data/game/character_beta_stats.json.gz",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_beta_stats.json.gz",
  "src/data/game/weapon_stats.json",
  "src/data/gameDataUtil.ts",
  "src/data/gameResources.ts",
  "src/data/gameStatsLoader.ts",
  "src/data/i18n-app.ts",
  "src/data/i18n-beta.ts",
  "src/data/i18n-game.ts",
  "src/data/resources_beta.ts",
  "src/data/resources.ts",
  "src/data/utils.ts",
  "src/lib/artifact/scoring/constants.ts",
  "src/lib/artifact/scoring/utils.ts",
  "src/lib/dmgcalc/constants.ts",
  "src/lib/dmgcalc/core/charBuild.ts",
  "src/lib/dmgcalc/core/combo.ts",
  "src/lib/dmgcalc/core/comboBuffOverrides.ts",
  "src/lib/dmgcalc/core/damageFormula.ts",
  "src/lib/dmgcalc/core/dynamicBuffEval.ts",
  "src/lib/dmgcalc/core/expr.ts",
  "src/lib/dmgcalc/core/exprStatSheet.ts",
  "src/lib/dmgcalc/core/fieldState.ts",
  "src/lib/dmgcalc/core/formulaCompiler.ts",
  "src/lib/dmgcalc/core/formulaEval.ts",
  "src/lib/dmgcalc/core/implModel.ts",
  "src/lib/dmgcalc/core/marginalGain.ts",
  "src/lib/dmgcalc/core/registry.ts",
  "src/lib/dmgcalc/core/stackRank.ts",
  "src/lib/dmgcalc/core/statBuff.ts",
  "src/lib/dmgcalc/core/statSheet.ts",
  "src/lib/dmgcalc/core/teamBuffLedger.ts",
  "src/lib/dmgcalc/core/teamBuild.ts",
  "src/lib/dmgcalc/core/teamExprStatSheet.ts",
  "src/lib/dmgcalc/core/teamFormulaCatalog.ts",
  "src/lib/dmgcalc/core/teamMeta.ts",
  "src/lib/dmgcalc/core/teamReaction.ts",
  "src/lib/dmgcalc/core/teamResonance.ts",
  "src/lib/dmgcalc/core/teamStatSheet.ts",
  "src/lib/dmgcalc/impl/artifact2pc.ts",
  "src/lib/dmgcalc/impl/artifact4pc.ts",
  "src/lib/dmgcalc/impl/character4Fontaine.ts",
  "src/lib/dmgcalc/impl/character4Inazuma.ts",
  "src/lib/dmgcalc/impl/character4Liyue.ts",
  "src/lib/dmgcalc/impl/character4Mondstadt.ts",
  "src/lib/dmgcalc/impl/character4Natlan.ts",
  "src/lib/dmgcalc/impl/character4NodKrai.ts",
  "src/lib/dmgcalc/impl/character4None.ts",
  "src/lib/dmgcalc/impl/character4Snezhnaya.ts",
  "src/lib/dmgcalc/impl/character4Sumeru.ts",
  "src/lib/dmgcalc/impl/character5Fontaine.ts",
  "src/lib/dmgcalc/impl/character5Inazuma.ts",
  "src/lib/dmgcalc/impl/character5Liyue.ts",
  "src/lib/dmgcalc/impl/character5Mondstadt.ts",
  "src/lib/dmgcalc/impl/character5Natlan.ts",
  "src/lib/dmgcalc/impl/character5NodKrai.ts",
  "src/lib/dmgcalc/impl/character5None.ts",
  "src/lib/dmgcalc/impl/character5Snezhnaya.ts",
  "src/lib/dmgcalc/impl/character5Sumeru.ts",
  "src/lib/dmgcalc/impl/helpers.ts",
  "src/lib/dmgcalc/impl/weapon3.ts",
  "src/lib/dmgcalc/impl/weapon4Bow.ts",
  "src/lib/dmgcalc/impl/weapon4Catalyst.ts",
  "src/lib/dmgcalc/impl/weapon4Claymore.ts",
  "src/lib/dmgcalc/impl/weapon4Polearm.ts",
  "src/lib/dmgcalc/impl/weapon4Sword.ts",
  "src/lib/dmgcalc/impl/weapon5Bow.ts",
  "src/lib/dmgcalc/impl/weapon5Catalyst.ts",
  "src/lib/dmgcalc/impl/weapon5Claymore.ts",
  "src/lib/dmgcalc/impl/weapon5Polearm.ts",
  "src/lib/dmgcalc/impl/weapon5Sword.ts",
  "src/lib/dmgcalc/index.ts",
  "src/lib/dmgcalc/utils.ts",
] as const;

export const NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS = [
  ...new Set([
    ...NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS,
    NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH,
    ...NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
    FORMULA_PART_PROJECTION_CORE_RELATIVE_PATH,
    NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_CORE_RELATIVE_PATH,
    NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_CLI_RELATIVE_PATH,
  ]),
].sort(compareText);

export const NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_SOURCE_FILE_PATHS = [
  ...NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS,
];

const ABSOLUTE_TOLERANCE = 1e-9;
const RELATIVE_TOLERANCE = 1e-12;
const EXPECTED_RUNTIME_INPUT_PATH_COUNT = 80;
const EXPECTED_INPUT_PATH_COUNT = 109;

const EXPECTED_CP53_CALCULATOR_OBSERVATION = {
  characterRegistration: "noelle",
  formulaId: "noelle-na",
  label: "Q Normal (4-hit)",
  representation: "inseparable-four-hit-aggregate",
  aggregateHitVectorPerCount: { n1: 1, n2: 1, n3: 1, n4: 1 },
  normalFormulaPartCount: 4,
  normalFormulaTalentParamIndexes: [1, 2, 3, 4],
  defaultComboDescriptor: [{ formulaId: "noelle-charge", count: 3 }],
  replayLineSupportsPartSelection: false,
  directPathMultipliesWholeEntryByLineCount: true,
  compiledPathMultipliesWholeEntryByLineCount: true,
} as const;

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

const TECHNICAL_CONFIG: TeamSlotConfig = {
  charId: "noelle",
  charLevel: 90,
  constellation: 0,
  weaponId: "white_iron_greatsword",
  refinement: 1,
  artifactSet: null,
  talentLevels: { auto: 1, skill: 1, burst: 1 },
};

const TECHNICAL_CALC_CONTEXT = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
} as const satisfies CalcContext;

const CAUTIONS = [
  "This checkpoint proves one exact static formula-count representation and calculator integration path. It is not a source rotation replay, team simulation, DPS result, or Noelle guide.",
  "The numeric harness uses one Guide Factory-authored Noelle-only baseline with a level-90 C0 character, 1/1/1 talents, an R1 White Iron Greatsword, no artifact set, no artifact stats, and an explicit enemy context. None of those fixture choices are source recommendations.",
  "The projection preserves the source 5/5/3/0 Normal Attack hit vector but has no action timestamps, cancel duration, buff-window coverage, swap timing, or supporter actions.",
  "The zero-hit N4 part is represented by omission rather than by materializing an invalid zero-hit FormulaPart; only the positive 5/5/3 parts enter evaluation.",
  "The calculator's static buff model is not evidence that a source rotation can establish or retain any buff for every projected hit.",
  "The adapter temporarily replaces only one formula-index entry owned by one fresh offline TeamBuild and restores the entire ordered index with its original entry identities in a finally block. The normal calculator bootstrap still performs its one-time process-local entity registration; no published application source or persisted user data is changed.",
  "Energy Recharge remains deferred and is neither inferred nor computed.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not publish the technical damage total as a Noelle damage expectation, team result, benchmark, or guide claim.",
  "Do not infer that the source action sequence is optimal, feasible, correctly timed, or fully represented.",
  "Do not infer a weapon, refinement, artifact set, main stat, substat allocation, investment branch, rank, or recommendation from the technical fixture.",
  "Do not infer supporter damage, team total damage, buff duration coverage, DPS, or Energy Recharge requirements.",
] as const;

export interface NoelleNormalPrefixFormulaProjectionSourceFile {
  path: string;
  bytesBase64: string;
}

export interface NoelleNormalPrefixFormulaProjectionInput {
  cp53ReportInput: NoelleHexereiPartialEquipmentCompositionReport;
  cp53Input: NoelleHexereiPartialEquipmentCompositionInput;
  sourceFiles: readonly NoelleNormalPrefixFormulaProjectionSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface NoelleNormalPrefixTechnicalHarnessObservation {
  harnessId: "noelle-normal-prefix-single-character-technical-harness-v1";
  authorship: "guide-factory-technical-fixture";
  authorityPartitions: {
    sourceBackedInputs: ["rotation-action-prefix-counts"];
    runtimeBackedInputs: ["formula-id", "formula-part-order"];
    guideFactoryDerivedFields: [
      "target-hit-vector",
      "projected-formula-part-counts",
    ];
  };
  guideFactoryAssumptions: {
    teamShape: "single-character-isolation";
    betaDataEnabled: false;
    betaEnvironmentOverrideEnabled: false;
    config: TeamSlotConfig;
    combatOptions: Record<string, never>;
    enemyAura: null;
    extraBuffCount: 0;
    artifactSetAssignmentCount: 0;
    artifactStatEntryCount: 0;
    formulaBuffOverrideCount: 0;
    calcContext: typeof TECHNICAL_CALC_CONTEXT;
    buffCoverageModel: "existing-static-calculator-state-not-source-timing";
  };
  projection: FormulaPartProjectionObservation;
  runtimeIsolation: {
    freshTeamBuildCount: 2;
    projectedTeamBuildOnly: true;
    controlTeamBuildEntryIdentityUnchanged: true;
    originalEntryIdentityRestored: true;
    formulaIndexSizeRestored: true;
    formulaIndexOrderAndEntryIdentitiesRestored: true;
  };
  evaluatedFormula: {
    formulaId: "noelle-na";
    comboLineCount: 1;
    projectedPartHits: [5, 5, 3];
    omittedPartIndexes: [3];
    computedBuffOverrideCount: number;
    originalDirectParts: [
      { semanticLabel: "N1"; hits: 1; damagePerHit: number; total: number },
      { semanticLabel: "N2"; hits: 1; damagePerHit: number; total: number },
      { semanticLabel: "N3"; hits: 1; damagePerHit: number; total: number },
      { semanticLabel: "N4"; hits: 1; damagePerHit: number; total: number },
    ];
    independentlyWeightedOriginalTotal: number;
    directParts: [
      { semanticLabel: "N1"; hits: 5; damagePerHit: number; total: number },
      { semanticLabel: "N2"; hits: 5; damagePerHit: number; total: number },
      { semanticLabel: "N3"; hits: 3; damagePerHit: number; total: number },
    ];
  };
  calculatorAgreement: {
    passed: true;
    directTotalDamage: number;
    compiledTotalDamage: number;
    absoluteDifference: number;
    allowedDifference: number;
    directPartsSumMatchesDirectTotal: true;
    projectedDirectMatchesIndependentWeighting: true;
  };
  numericResultClassification: "technical-regression-only";
  comparisonEligible: false;
  rankingEligible: false;
  recommendationEligible: false;
}

export interface NoelleNormalPrefixFormulaProjectionReport {
  schemaVersion: 1;
  reportType: "noelle-normal-prefix-formula-projection";
  projectionId: typeof NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_ID;
  classification: "authenticated-offline-formula-count-technical-probe";
  validationStatus: "accepted-exact-static-formula-count-representation";
  publicationStatus: "withheld-technical-validation-only";
  supportsExactStaticFormulaCountRepresentation: true;
  supportsExactStaticFormulaCountTechnicalComputation: true;
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allGeneratedFromHashesAuthenticatedFromBytes: true;
    cp53ReportByteAndParsedObjectParity: true;
    exactCp53InputProjection: true;
    sourceFileCount: 109;
    generatedFromCount: 109;
    runtimeInputPathCount: 80;
    binaryRuntimeInputCount: 2;
  };
  upstreamBoundary: {
    cp53ReportPath: typeof NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH;
    cp53ReportFileSha256: string;
    cp53CanonicalObjectSha256: string;
    calculatorObservationCanonicalObjectSha256: string;
    freshlyAuthenticated: true;
    partialCandidateCount: 2;
    selectedCandidateCount: 0;
    completeBuildCount: 0;
    preservedExistingReplayAdapterGate: {
      admissionStatus: "rejected-exact-formula-representation-missing";
      numericReplayAdmitted: false;
      numericResult: null;
      offlineAdapterAdmissionIsSeparate: true;
    };
  };
  sourceFormulaCountTarget: {
    teamSourceRecordId: string;
    rotationNotation: string;
    noelleSegments: NoelleHexereiPartialEquipmentCompositionReport["preservedComputationRepresentationGate"]["sourceRotation"]["noelleSegments"];
    requiredTotalHitVector: { n1: 5; n2: 5; n3: 3; n4: 0 };
    sourceSupportsActionPrefixCounts: true;
    guideFactoryDerivedFormulaPartHitVector: true;
    sourceAuthoredCalculatorFormulaCounts: false;
    sourceSupportsTimingOrBuffCoverage: false;
  };
  representationContract: {
    formulaId: "noelle-na";
    ownerCharId: "noelle";
    originalFormulaPartCount: 4;
    comboLineCount: 1;
    projectedParts: [
      { sourcePartIndex: 0; semanticLabel: "N1"; hits: 5 },
      { sourcePartIndex: 1; semanticLabel: "N2"; hits: 5 },
      { sourcePartIndex: 2; semanticLabel: "N3"; hits: 3 },
    ];
    omittedSourcePartIndexes: [3];
    representedHitVector: { n1: 5; n2: 5; n3: 3; n4: 0 };
    exactTargetMatch: true;
    implementationStrategy: "scoped-local-catalog-entry-replacement";
    existingFormulaIdRetained: true;
    publishedApplicationRuntimeMutated: false;
    applicationSourceMutated: false;
    durableCatalogMutation: false;
    processLocalCalculatorRegistryBootstrapExecuted: true;
    processLocalCalculatorRegistryBootstrapRestored: false;
  };
  technicalHarness: NoelleNormalPrefixTechnicalHarnessObservation;
  operationSummary: {
    formulaProjectionRunCount: 1;
    freshTeamBuildCount: 2;
    directDamageEvaluationCount: 3;
    compiledDamageEvaluationCount: 1;
    technicalFixtureWeaponMaterializationCount: 2;
    technicalSingleCharacterComboEvaluationCount: 2;
    staticFormulaCountTechnicalComputationCount: 1;
    sourceRotationReplayCount: 0;
    sourceTeamTotalDamageComputationCount: 0;
    candidateSelectionCount: 0;
    candidateEquipmentAssignmentCount: 0;
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
  formulaProjectionExecuted: true;
  staticFormulaCountTechnicalComputationExecuted: true;
  technicalFixtureWeaponMaterializationExecuted: true;
  technicalSingleCharacterComboEvaluationExecuted: true;
  sourceRotationReplayExecuted: false;
  sourceTeamTotalDamageComputationExecuted: false;
  candidateSelectionExecuted: false;
  candidateEquipmentAssignmentExecuted: false;
  optimizerExecuted: false;
  autoTuneExecuted: false;
  idealStatAllocationExecuted: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type NoelleNormalPrefixFormulaProjectionAuthentication =
  | {
      authenticated: true;
      canonicalReport: NoelleNormalPrefixFormulaProjectionReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      message: string;
    };

interface AuthenticatedOuterInputs {
  sourceBytesByPath: Map<string, Buffer>;
  generatedFrom: GeneratedFromEntry[];
  cp53Report: NoelleHexereiPartialEquipmentCompositionReport;
}

export async function buildNoelleNormalPrefixFormulaProjectionReport(
  input: NoelleNormalPrefixFormulaProjectionInput,
): Promise<NoelleNormalPrefixFormulaProjectionReport> {
  assertAuthenticatedNonBetaRuntimeBranch();
  const raw = authenticateOuterInputs(input);
  const boundCp53Input = buildBoundCp53Input(raw, input.cp53Input);
  if (stableJson(boundCp53Input) !== stableJson(input.cp53Input)) {
    throw new Error(
      "CP54 supplied CP53 input is not the exact projection of the outer authenticated byte closure.",
    );
  }
  const cp53Report =
    requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport(
      raw.cp53Report,
      boundCp53Input,
    );
  assertCp53SemanticBoundary(cp53Report);

  const sourceRotation =
    cp53Report.preservedComputationRepresentationGate.sourceRotation;
  const technicalHarness =
    await runNoelleNormalPrefixProjectionTechnicalHarness();

  return {
    schemaVersion: 1,
    reportType: "noelle-normal-prefix-formula-projection",
    projectionId: NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_ID,
    classification: "authenticated-offline-formula-count-technical-probe",
    validationStatus: "accepted-exact-static-formula-count-representation",
    publicationStatus: "withheld-technical-validation-only",
    supportsExactStaticFormulaCountRepresentation: true,
    supportsExactStaticFormulaCountTechnicalComputation: true,
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromBytes: true,
      cp53ReportByteAndParsedObjectParity: true,
      exactCp53InputProjection: true,
      sourceFileCount: EXPECTED_INPUT_PATH_COUNT,
      generatedFromCount: EXPECTED_INPUT_PATH_COUNT,
      runtimeInputPathCount: EXPECTED_RUNTIME_INPUT_PATH_COUNT,
      binaryRuntimeInputCount: 2,
    },
    upstreamBoundary: {
      cp53ReportPath: NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH,
      cp53ReportFileSha256: sha256Bytes(
        requiredSourceBytes(
          raw.sourceBytesByPath,
          NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH,
        ),
      ),
      cp53CanonicalObjectSha256: hashValue(cp53Report),
      calculatorObservationCanonicalObjectSha256: hashValue(
        cp53Report.preservedComputationRepresentationGate.calculatorObservation,
      ),
      freshlyAuthenticated: true,
      partialCandidateCount: 2,
      selectedCandidateCount: 0,
      completeBuildCount: 0,
      preservedExistingReplayAdapterGate: {
        admissionStatus: "rejected-exact-formula-representation-missing",
        numericReplayAdmitted: false,
        numericResult: null,
        offlineAdapterAdmissionIsSeparate: true,
      },
    },
    sourceFormulaCountTarget: {
      teamSourceRecordId: sourceRotation.sourceRecordId,
      rotationNotation: sourceRotation.notation,
      noelleSegments: structuredClone(sourceRotation.noelleSegments),
      requiredTotalHitVector: { n1: 5, n2: 5, n3: 3, n4: 0 },
      sourceSupportsActionPrefixCounts: true,
      guideFactoryDerivedFormulaPartHitVector: true,
      sourceAuthoredCalculatorFormulaCounts: false,
      sourceSupportsTimingOrBuffCoverage: false,
    },
    representationContract: {
      formulaId: "noelle-na",
      ownerCharId: "noelle",
      originalFormulaPartCount: 4,
      comboLineCount: 1,
      projectedParts: [
        { sourcePartIndex: 0, semanticLabel: "N1", hits: 5 },
        { sourcePartIndex: 1, semanticLabel: "N2", hits: 5 },
        { sourcePartIndex: 2, semanticLabel: "N3", hits: 3 },
      ],
      omittedSourcePartIndexes: [3],
      representedHitVector: { n1: 5, n2: 5, n3: 3, n4: 0 },
      exactTargetMatch: true,
      implementationStrategy: "scoped-local-catalog-entry-replacement",
      existingFormulaIdRetained: true,
      publishedApplicationRuntimeMutated: false,
      applicationSourceMutated: false,
      durableCatalogMutation: false,
      processLocalCalculatorRegistryBootstrapExecuted: true,
      processLocalCalculatorRegistryBootstrapRestored: false,
    },
    technicalHarness,
    operationSummary: {
      formulaProjectionRunCount: 1,
      freshTeamBuildCount: 2,
      directDamageEvaluationCount: 3,
      compiledDamageEvaluationCount: 1,
      technicalFixtureWeaponMaterializationCount: 2,
      technicalSingleCharacterComboEvaluationCount: 2,
      staticFormulaCountTechnicalComputationCount: 1,
      sourceRotationReplayCount: 0,
      sourceTeamTotalDamageComputationCount: 0,
      candidateSelectionCount: 0,
      candidateEquipmentAssignmentCount: 0,
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
    formulaProjectionExecuted: true,
    staticFormulaCountTechnicalComputationExecuted: true,
    technicalFixtureWeaponMaterializationExecuted: true,
    technicalSingleCharacterComboEvaluationExecuted: true,
    sourceRotationReplayExecuted: false,
    sourceTeamTotalDamageComputationExecuted: false,
    candidateSelectionExecuted: false,
    candidateEquipmentAssignmentExecuted: false,
    optimizerExecuted: false,
    autoTuneExecuted: false,
    idealStatAllocationExecuted: false,
    energyRecoveryComputationExecuted: false,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

export async function authenticateNoelleNormalPrefixFormulaProjectionReport(
  serializedReport: NoelleNormalPrefixFormulaProjectionReport,
  input: NoelleNormalPrefixFormulaProjectionInput,
): Promise<NoelleNormalPrefixFormulaProjectionAuthentication> {
  let canonicalReport: NoelleNormalPrefixFormulaProjectionReport;
  try {
    canonicalReport =
      await buildNoelleNormalPrefixFormulaProjectionReport(input);
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
        "Serialized CP54 report does not match the fresh canonical computation.",
    };
  }
  return { authenticated: true, canonicalReport };
}

export async function requireAuthenticatedNoelleNormalPrefixFormulaProjectionReport(
  serializedReport: NoelleNormalPrefixFormulaProjectionReport,
  input: NoelleNormalPrefixFormulaProjectionInput,
): Promise<NoelleNormalPrefixFormulaProjectionReport> {
  const authentication =
    await authenticateNoelleNormalPrefixFormulaProjectionReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP54 authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export async function runNoelleNormalPrefixProjectionTechnicalHarness(): Promise<NoelleNormalPrefixTechnicalHarnessObservation> {
  assertAuthenticatedNonBetaRuntimeBranch();
  await bootstrapGuideFactoryComputation();

  const projectedTeamBuild = new TeamBuild(
    [{ ...TECHNICAL_CONFIG, talentLevels: { ...TECHNICAL_CONFIG.talentLevels! } }],
    {},
    undefined,
    [],
    undefined,
    { ...TECHNICAL_CALC_CONTEXT },
  );
  const controlTeamBuild = new TeamBuild(
    [{ ...TECHNICAL_CONFIG, talentLevels: { ...TECHNICAL_CONFIG.talentLevels! } }],
    {},
    undefined,
    [],
    undefined,
    { ...TECHNICAL_CALC_CONTEXT },
  );
  const originalProjectedEntry =
    projectedTeamBuild.catalog.formulaIndex.get("noelle-na");
  const originalControlEntry =
    controlTeamBuild.catalog.formulaIndex.get("noelle-na");
  if (!originalProjectedEntry || !originalControlEntry) {
    throw new Error("CP54 technical harness could not materialize noelle-na.");
  }
  if (
    originalProjectedEntry.parts.length !== 4 ||
    originalProjectedEntry.owner !== "noelle" ||
    originalControlEntry.parts.length !== 4 ||
    originalControlEntry.owner !== "noelle"
  ) {
    throw new Error("CP54 noelle-na runtime formula boundary drifted.");
  }

  const combo = buildTechnicalCombo();
  const artifactSheets = { noelle: new StatSheet([]) };
  controlTeamBuild.teamStats.setArtifacts(
    artifactSheets,
    TECHNICAL_CALC_CONTEXT,
  );
  const originalFormulaResult = controlTeamBuild.getDamageResult(
    "noelle",
    "noelle-na",
    TECHNICAL_CALC_CONTEXT,
    undefined,
    undefined,
    true,
  );
  if (
    originalFormulaResult.parts.length !== 4 ||
    stableJson(originalFormulaResult.parts.map(({ hits }) => hits)) !==
      stableJson([1, 1, 1, 1])
  ) {
    throw new Error("CP54 original Noelle direct-part baseline drifted.");
  }
  const originalDirectParts = originalFormulaResult.parts.map((part, index) => ({
    semanticLabel: `N${index + 1}`,
    hits: part.hits,
    damagePerHit: normalizeNumber(part.damage),
    total: normalizeNumber(part.damage * part.hits),
  })) as NoelleNormalPrefixTechnicalHarnessObservation["evaluatedFormula"]["originalDirectParts"];
  const independentlyWeightedOriginalTotal = normalizeNumber(
    originalFormulaResult.parts.reduce(
      (sum, part, index) =>
        sum +
        part.damage *
          ([5, 5, 3, 0] as const)[index],
      0,
    ),
  );
  const scoped = await withScopedFormulaPartProjection(
    projectedTeamBuild.catalog,
    NOELLE_PREFIX_PROJECTION_SPEC,
    async (projectedEntry) => {
      if (
        projectedEntry.parts.length !== 3 ||
        stableJson(projectedEntry.parts.map(({ hits }) => hits)) !==
          stableJson([5, 5, 3]) ||
        projectedTeamBuild.catalog.formulaIndex.get("noelle-na") !==
          projectedEntry ||
        controlTeamBuild.catalog.formulaIndex.get("noelle-na") !==
          originalControlEntry
      ) {
        throw new Error("CP54 scoped Noelle formula projection drifted.");
      }

      const computedBuffOverrides =
        buildBuffOverrides(
          combo.lines,
          projectedTeamBuild,
          artifactSheets,
          TECHNICAL_CALC_CONTEXT,
        ) ?? {};
      const direct = projectedTeamBuild.getComboDamageResult(
        combo,
        artifactSheets,
        TECHNICAL_CALC_CONTEXT,
        computedBuffOverrides,
      );
      const formulaResult = projectedTeamBuild.getDamageResult(
        "noelle",
        "noelle-na",
        TECHNICAL_CALC_CONTEXT,
        undefined,
        computedBuffOverrides[0],
        true,
      );
      const compiled = compileComboTeamDamage(
        projectedTeamBuild,
        combo,
        ["noelle"],
        artifactSheets,
        TECHNICAL_CALC_CONTEXT,
        toCompilerBuffOverrides(computedBuffOverrides),
      );
      const charIdx = compiled.charIdxMap?.get("noelle");
      if (charIdx == null) {
        throw new Error(
          "CP54 compiler did not expose variables for the Noelle technical harness.",
        );
      }
      const vars = new Float64Array(compiled.numVars);
      fillVarsFromSheet(
        artifactSheets.noelle,
        compiled.varMapping,
        charIdx,
        vars,
      );
      const compiledTotalDamage = compiled.evaluate(vars);
      const directTotalDamage = direct.totalDamage;
      const absoluteDifference = Math.abs(
        directTotalDamage - compiledTotalDamage,
      );
      const allowedDifference = Math.max(
        ABSOLUTE_TOLERANCE,
        RELATIVE_TOLERANCE *
          Math.max(1, Math.abs(directTotalDamage), Math.abs(compiledTotalDamage)),
      );
      if (absoluteDifference > allowedDifference) {
        throw new Error(
          `CP54 direct damage ${directTotalDamage} and compiled damage ${compiledTotalDamage} differ by ${absoluteDifference}, above tolerance ${allowedDifference}.`,
        );
      }
      if (
        Math.abs(directTotalDamage - independentlyWeightedOriginalTotal) >
        allowedDifference
      ) {
        throw new Error(
          `CP54 projected direct damage ${directTotalDamage} no longer matches independently weighted original parts ${independentlyWeightedOriginalTotal}.`,
        );
      }
      if (
        direct.lineDamages.length !== 1 ||
        formulaResult.parts.length !== 3 ||
        stableJson(formulaResult.parts.map(({ hits }) => hits)) !==
          stableJson([5, 5, 3])
      ) {
        throw new Error("CP54 direct projected part evaluation drifted.");
      }
      const directParts = formulaResult.parts.map((part, index) => ({
        semanticLabel: NOELLE_PREFIX_PROJECTION_SPEC.projectedParts[index]
          .semanticLabel,
        hits: part.hits,
        damagePerHit: normalizeNumber(part.damage),
        total: normalizeNumber(part.damage * part.hits),
      })) as NoelleNormalPrefixTechnicalHarnessObservation["evaluatedFormula"]["directParts"];
      const directPartsSum = directParts.reduce(
        (sum, { total }) => sum + total,
        0,
      );
      if (
        Math.abs(directPartsSum - directTotalDamage) > ABSOLUTE_TOLERANCE
      ) {
        throw new Error(
          "CP54 projected direct-part sum no longer matches the direct combo total.",
        );
      }
      return {
        computedBuffOverrideCount: Object.keys(computedBuffOverrides).length,
        directParts,
        directTotalDamage: normalizeNumber(directTotalDamage),
        compiledTotalDamage: normalizeNumber(compiledTotalDamage),
        absoluteDifference: normalizeNumber(absoluteDifference),
        allowedDifference: normalizeNumber(allowedDifference),
      };
    },
  );

  if (
    projectedTeamBuild.catalog.formulaIndex.get("noelle-na") !==
      originalProjectedEntry ||
    controlTeamBuild.catalog.formulaIndex.get("noelle-na") !==
      originalControlEntry
  ) {
    throw new Error("CP54 technical harness did not restore runtime isolation.");
  }

  return {
    harnessId: "noelle-normal-prefix-single-character-technical-harness-v1",
    authorship: "guide-factory-technical-fixture",
    authorityPartitions: {
      sourceBackedInputs: ["rotation-action-prefix-counts"],
      runtimeBackedInputs: ["formula-id", "formula-part-order"],
      guideFactoryDerivedFields: [
        "target-hit-vector",
        "projected-formula-part-counts",
      ],
    },
    guideFactoryAssumptions: {
      teamShape: "single-character-isolation",
      betaDataEnabled: false,
      betaEnvironmentOverrideEnabled: false,
      config: {
        ...TECHNICAL_CONFIG,
        talentLevels: { ...TECHNICAL_CONFIG.talentLevels! },
      },
      combatOptions: {},
      enemyAura: null,
      extraBuffCount: 0,
      artifactSetAssignmentCount: 0,
      artifactStatEntryCount: 0,
      formulaBuffOverrideCount: 0,
      calcContext: { ...TECHNICAL_CALC_CONTEXT },
      buffCoverageModel: "existing-static-calculator-state-not-source-timing",
    },
    projection: scoped.observation,
    runtimeIsolation: {
      freshTeamBuildCount: 2,
      projectedTeamBuildOnly: true,
      controlTeamBuildEntryIdentityUnchanged: true,
      originalEntryIdentityRestored:
        scoped.restoration.originalEntryIdentityRestored,
      formulaIndexSizeRestored: scoped.restoration.formulaIndexSizeRestored,
      formulaIndexOrderAndEntryIdentitiesRestored:
        scoped.restoration.formulaIndexOrderAndEntryIdentitiesRestored,
    },
    evaluatedFormula: {
      formulaId: "noelle-na",
      comboLineCount: 1,
      projectedPartHits: [5, 5, 3],
      omittedPartIndexes: [3],
      computedBuffOverrideCount: scoped.value.computedBuffOverrideCount,
      originalDirectParts,
      independentlyWeightedOriginalTotal,
      directParts: scoped.value.directParts,
    },
    calculatorAgreement: {
      passed: true,
      directTotalDamage: scoped.value.directTotalDamage,
      compiledTotalDamage: scoped.value.compiledTotalDamage,
      absoluteDifference: scoped.value.absoluteDifference,
      allowedDifference: scoped.value.allowedDifference,
      directPartsSumMatchesDirectTotal: true,
      projectedDirectMatchesIndependentWeighting: true,
    },
    numericResultClassification: "technical-regression-only",
    comparisonEligible: false,
    rankingEligible: false,
    recommendationEligible: false,
  };
}

function authenticateOuterInputs(
  input: NoelleNormalPrefixFormulaProjectionInput,
): AuthenticatedOuterInputs {
  if (
    NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS.length !==
      EXPECTED_RUNTIME_INPUT_PATH_COUNT ||
    NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS.length !==
      EXPECTED_INPUT_PATH_COUNT
  ) {
    throw new Error("CP54 declared closure cardinality drifted.");
  }
  const expectedPaths = [
    ...NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS,
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
    throw new Error("CP54 exact outer source/generatedFrom path closure drifted.");
  }

  const sourceBytesByPath = new Map<string, Buffer>();
  for (const { path: sourcePath, bytesBase64 } of input.sourceFiles) {
    if (!bytesBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(bytesBase64)) {
      throw new Error(`CP54 source bytes are not canonical base64 at ${sourcePath}.`);
    }
    const bytes = Buffer.from(bytesBase64, "base64");
    if (bytes.length === 0 || bytes.toString("base64") !== bytesBase64) {
      throw new Error(`CP54 source bytes failed base64 round-trip at ${sourcePath}.`);
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
      throw new Error(`CP54 source/hash authentication drifted at ${sourcePath}.`);
    }
  }

  let parsedCp53Report: unknown;
  try {
    parsedCp53Report = JSON.parse(
      requiredSourceText(
        sourceBytesByPath,
        NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH,
      ),
    );
  } catch {
    throw new Error("CP54 CP53 durable report bytes are not valid JSON.");
  }
  if (stableJson(parsedCp53Report) !== stableJson(input.cp53ReportInput)) {
    throw new Error(
      "CP54 CP53 durable report bytes disagree with the supplied parsed object.",
    );
  }

  return {
    sourceBytesByPath,
    generatedFrom: input.generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    cp53Report: parsedCp53Report as NoelleHexereiPartialEquipmentCompositionReport,
  };
}

function buildBoundCp53Input(
  raw: AuthenticatedOuterInputs,
  supplied: NoelleHexereiPartialEquipmentCompositionInput,
): NoelleHexereiPartialEquipmentCompositionInput {
  const generatedByPath = new Map(
    raw.generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  return {
    cp51ReportInput: structuredClone(supplied.cp51ReportInput),
    cp51Input: structuredClone(supplied.cp51Input),
    cp52ReportInput: structuredClone(supplied.cp52ReportInput),
    cp52Input: structuredClone(supplied.cp52Input),
    sourceFiles:
      NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS.map(
        (sourcePath) => ({
          path: sourcePath,
          text: requiredSourceText(raw.sourceBytesByPath, sourcePath),
        }),
      ),
    generatedFrom:
      NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS.map(
        (sourcePath) => {
          const entry = generatedByPath.get(sourcePath);
          if (!entry) {
            throw new Error(`CP54 missing CP53 generatedFrom ${sourcePath}.`);
          }
          return { ...entry };
        },
      ),
  };
}

function assertCp53SemanticBoundary(
  report: NoelleHexereiPartialEquipmentCompositionReport,
): void {
  const gate = report.preservedComputationRepresentationGate;
  const rotation = gate.sourceRotation;
  if (
    report.validationStatus !== "authenticated-incomplete-validation-candidates" ||
    report.summary.partialValidationCandidateCount !== 2 ||
    report.summary.selectionCount !== 0 ||
    report.summary.assignmentCount !== 0 ||
    report.summary.completeBuildCount !== 0 ||
    report.summary.damageComputationCount !== 0 ||
    report.summary.rotationReplayCount !== 0 ||
    report.summary.optimizerRunCount !== 0 ||
    report.summary.energyRecoveryComputationCount !== 0 ||
    report.selectionExecuted ||
    report.rankingExecuted ||
    report.damageComputationExecuted ||
    report.rotationReplayExecuted ||
    report.optimizerExecuted ||
    report.energyRecoveryComputationExecuted ||
    gate.admissionStatus !==
      "rejected-exact-formula-representation-missing" ||
    gate.numericReplayAdmitted ||
    gate.numericResult !== null ||
    stableJson(gate.calculatorObservation) !==
      stableJson(EXPECTED_CP53_CALCULATOR_OBSERVATION) ||
    rotation.sourceRecordId !==
      "noelle-durin-nicole-xilonen-hexerei-example-luna-viii" ||
    rotation.rotationId !== "sample-rotation-xilonen" ||
    rotation.notation !==
      "Nicole (Q)¹E > Durin EEQ > Xilonen EN2 > Noelle EQ 2[N3D] N2 > Xilonen EN2 > Noelle N3D N2" ||
    rotation.unresolvedSegments.length !== 0 ||
    stableJson(rotation.requiredTotalHitVector) !==
      stableJson({ n1: 5, n2: 5, n3: 3, n4: 0 }) ||
    stableJson(rotation.noelleSegments) !==
      stableJson([
        {
          cancelToken: "D",
          cancelTokenPreserved: true,
          formulaCountInferred: false,
          notation: "N3D",
          requiredHitVectorPerOccurrence: { n1: 1, n2: 1, n3: 1, n4: 0 },
          sourceTokenOccurrenceCount: 3,
        },
        {
          cancelToken: null,
          cancelTokenPreserved: true,
          formulaCountInferred: false,
          notation: "N2",
          requiredHitVectorPerOccurrence: { n1: 1, n2: 1, n3: 0, n4: 0 },
          sourceTokenOccurrenceCount: 2,
        },
      ])
  ) {
    throw new Error("CP54 authenticated CP53 semantic boundary drifted.");
  }
}

function assertAuthenticatedNonBetaRuntimeBranch(): void {
  if (betaEnabled() || process.env.__BETA_ENABLED_OVERRIDE__ === "true") {
    throw new Error(
      "CP54 Noelle formula projection requires the authenticated non-beta runtime branch.",
    );
  }
}

function buildTechnicalCombo(): ComboFormula {
  return {
    id: "noelle-normal-prefix-5-5-3-0-technical-projection",
    label: {
      en: "Noelle exact Normal prefix technical projection",
      zh: "诺艾尔普攻前缀精确技术投影",
    },
    lines: [
      {
        charId: "noelle",
        formulaId: "noelle-na",
        count: 1,
        forceOnField: true,
      },
    ],
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

function requiredSourceBytes(
  sourceBytesByPath: Map<string, Buffer>,
  sourcePath: string,
): Buffer {
  const bytes = sourceBytesByPath.get(sourcePath);
  if (!bytes) throw new Error(`CP54 missing source bytes ${sourcePath}.`);
  return bytes;
}

function requiredSourceText(
  sourceBytesByPath: Map<string, Buffer>,
  sourcePath: string,
): string {
  return requiredSourceBytes(sourceBytesByPath, sourcePath).toString("utf8");
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`CP54 observed a non-finite numeric value: ${value}.`);
  }
  return Number(value.toPrecision(15));
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
