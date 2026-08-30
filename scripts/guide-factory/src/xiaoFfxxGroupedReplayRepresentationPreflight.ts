import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StatKey } from "@/data/enums";
import { betaEnabled } from "@/data/betaState";
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
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import {
  bootstrapGuideFactoryComputation,
  replayTeamDamage,
  type DamageReplayInput,
  type ReplayCombo,
  type ReplayTeamConfigs,
} from "./computationReplay";
import { sha256Text, stableJson } from "./io";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";
import {
  authenticateXiaoFfxxNonErConditionFreeBranchCandidateContract,
  XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
  type BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput,
  type XiaoFfxxNonErConditionFreeBranchCandidate,
  type XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
} from "./xiaoFfxxNonErConditionFreeBranchCandidateContract";
import {
  authenticateXiaoFormulaCountParityReport,
  XIAO_FORMULA_COUNT_PARITY_CODE_PATHS,
  XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS,
  type BuildXiaoFormulaCountParityInput,
  type XiaoFormulaCountParityReport,
} from "./xiaoFormulaCountParity";

const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const REPOSITORY_PATH = "scripts/guide-factory/data/knowledge/repository.json";
const XIAO_MANUAL_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const XIAO_ROTATION_FIXTURE_SNAPSHOT_PATH =
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
const CORE_PATH =
  "scripts/guide-factory/src/xiaoFfxxGroupedReplayRepresentationPreflight.ts";
const CLI_PATH =
  "scripts/guide-factory/src/assemble-xiao-ffxx-grouped-replay-representation-preflight.ts";

const PREFLIGHT_ID =
  "guide-factory-xiao-ffxx-grouped-replay-representation-preflight-version-5-5";
const TEAM_ID = "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5";
const SOURCE_ONLY_VIEW_ID = "source-only-ffxx";
const EXCLUDED_C6_VIEW_ID = "exact-ffxx-plus-wrapper-c6";
const ABSOLUTE_TOLERANCE = 1e-9;
const RELATIVE_TOLERANCE = 1e-12;
const REGRESSION_TOLERANCE = 1e-6;
const EXPECTED_REPLAY_RUNTIME_INPUT_COUNT = 80;
const EXPECTED_INPUT_PATH_COUNT = 118;

/**
 * Static first-party module closure traversed from computationReplay and the
 * damage-calculator side-effect registry. This is deliberately an exact path
 * list: the durable run never discovers calculator inputs with a runtime glob.
 * Both beta archives remain in the closure because the beta-state module has a
 * process-environment override even though this fixture executes non-beta data.
 */
export const XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS = [
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

const EXPECTED_WEAPON_TOTALS = {
  primordial_jade_wingedspear: {
    groupedDirect: 409726.4684584323,
    groupedCompiled: 339534.6317426099,
  },
  staff_of_homa: {
    groupedDirect: 498551.4360819778,
    groupedCompiled: 413936.1355472507,
  },
  lumidouce_elegy: {
    groupedDirect: 379351.8641713425,
    groupedCompiled: 309449.7475489425,
  },
  vortex_vanquisher: {
    groupedDirect: 415546.9373548419,
    groupedCompiled: 352588.4309836003,
  },
  calamity_queller: {
    groupedDirect: 447332.1477512243,
    groupedCompiled: 382447.3229800467,
  },
  deathmatch: {
    groupedDirect: 362037.8393474445,
    groupedCompiled: 292135.7227250446,
  },
} as const;

const COMBAT_OPTIONS = {
  deathmatch: "gte2",
  furina: "300",
  staff_of_homa: "below50",
  xianyun: "4",
  xiao: "3",
} as const;

const CAUTIONS = [
  "This preflight evaluates one deliberately incomplete, Guide Factory-authored fixture. It is a representation diagnostic, not a weapon comparison or Xiao guide.",
  "The grouped line representation makes the interpreted and compiled calculator paths disagree for Xianyun's eight-use stack-limited plunge buff. The unit-expanded representation agrees and reproduces the interpreted grouped total, so grouped outputs are withheld rather than ranked.",
  "Only the source-only FFXX view is executed because the calculator fixture is C0. The explicit-C6 request view remains excluded provenance and does not affect configuration, identity, or execution.",
  "The source-authored twelve-plunge plan is withheld because its no-external-buffs comparison context is not the FFXX context evaluated here. This run uses only the checkpoint-42 calculator-default two-Skill/eleven-plunge plan.",
  "Circlet, substats, and Energy Recharge remain absent. No missing value is filled, optimized, or inferred.",
  "The level-20 five-star Flower, Plume, Sands, and Goblet numeric main-stat values are Guide Factory runtime-materialization assumptions derived from current game data; checkpoint 46 supplies only the MH/ATK%/Anemo choice payloads, not numeric artifact stats.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not sort, rank, select, recommend, or name a winning weapon from these totals.",
  "Do not treat the unit-expanded agreement as validation of the fixture's gameplay sequence, buff timing, rotation feasibility, or DPS.",
  "Do not treat source rank groups or report serialization order as computed damage order.",
  "Do not infer a complete artifact build, ideal substat allocation, Circlet choice, Energy Recharge floor, or guide recommendation.",
] as const;

export interface XiaoFfxxGroupedReplaySourceFile {
  path: string;
  bytesBase64: string;
}

export interface BuildXiaoFfxxGroupedReplayRepresentationPreflightInput {
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
  sourceFiles: readonly XiaoFfxxGroupedReplaySourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface XiaoFfxxGroupedReplayCandidateObservation {
  candidateId: string;
  candidateIdentitySha256: string;
  weaponId: keyof typeof EXPECTED_WEAPON_TOTALS;
  refinement: 1 | 5;
  sourceOnlyViewId: typeof SOURCE_ONLY_VIEW_ID;
  excludedViewIds: [typeof EXCLUDED_C6_VIEW_ID];
  groupedReplay: {
    representation: "two-grouped-formula-lines";
    lineCounts: [2, 11];
    replayTeamDamageRejected: true;
    rejectionMessage: string;
    directTotalDamage: number;
    compiledTotalDamage: number;
    absoluteDifference: number;
    allowedDifference: number;
    calculatorAgreement: false;
    xianyunStackLimitedBuffKey: string;
    xianyunPerCastActivation: number;
    xianyunTotalActivation: 8;
  };
  unitExpandedReplay: {
    representation: "thirteen-unit-formula-lines";
    lineCounts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    replayTeamDamageAccepted: true;
    directTotalDamage: number;
    compiledTotalDamage: number;
    absoluteDifference: number;
    allowedDifference: number;
    calculatorAgreement: true;
    xianyunStackLimitedBuffKey: string;
    xianyunPerCastActivationSequence: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0];
    xianyunTotalActivation: 8;
  };
  crossRepresentation: {
    groupedDirectEqualsExpandedDirect: true;
    groupedCompiledEqualsExpandedCompiled: false;
    groupedDirectMinusExpandedDirect: number;
  };
  disposition: "withheld-grouped-stack-limited-representation-mismatch";
  comparisonEligible: false;
  factoryRank: null;
  winner: false;
  recommendation: false;
  observationSha256: string;
}

export interface XiaoFfxxGroupedReplayRepresentationPreflightReport {
  schemaVersion: 1;
  reportType: "xiao-ffxx-grouped-replay-representation-preflight";
  preflightId: typeof PREFLIGHT_ID;
  classification: "authenticated-bounded-representation-preflight";
  comparisonStatus: "not-comparable";
  publicationStatus: "withheld-grouped-stack-limited-representation-mismatch";
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true;
    combinedJsonInputByteAndParsedObjectParity: true;
    staticFirstPartyReplayRuntimePathClosure: true;
    staticFirstPartyReplayRuntimeFileCount: 80;
    runtimeGlobDiscoveryUsed: false;
    sourceFileCount: 118;
    generatedFromCount: 118;
    authenticatedJsonInputParityCount: 12;
    directDurableReportJsonInputCount: 2;
  };
  branchCandidateUpstreamBoundary: {
    status: "accepted";
    durableReportPath: typeof BRANCH_CANDIDATE_REPORT_PATH;
    durableReportFileSha256: string;
    durableReportCanonicalObjectSha256: string;
    freshlyAuthenticated: true;
    upstreamInputCount: number;
    candidateCount: 6;
  };
  formulaCountUpstreamBoundary: {
    status: "accepted";
    durableReportPath: typeof FORMULA_COUNT_REPORT_PATH;
    durableReportFileSha256: string;
    durableReportCanonicalObjectSha256: string;
    freshlyAuthenticated: true;
    upstreamInputCount: number;
    calculatorDefaultSkillCount: 2;
    calculatorDefaultHighPlungeCount: 11;
    sourceTranslatedSkillCount: 2;
    sourceTranslatedHighPlungeCount: 12;
  };
  executionScope: {
    sourceRosterTeamRecordId: typeof TEAM_ID;
    calculatorFixtureTeamRecordId: "genshintools-presets:team:CX03obKWOJgK51-fWO";
    crossRecordConfigurationJoinAuthoredBy: "guide-factory";
    exactRosterEqualityRequired: true;
    executedViewId: typeof SOURCE_ONLY_VIEW_ID;
    executedViewRequestFactCount: 0;
    excludedViewIds: [typeof EXCLUDED_C6_VIEW_ID];
    excludedViewCount: 1;
    excludedC6ViewAffectedConfiguration: false;
    excludedC6ViewAffectedCandidateIdentity: false;
    excludedC6ViewExecuted: false;
    candidateCount: 6;
    completeBuildCount: 0;
  };
  fixtureBoundary: {
    authoredBy: "guide-factory";
    sourceAuthoredWholeFixture: false;
    fixedMainStatValuesPurpose: "guide-factory-wrapper-runtime-materialization";
    sourceSuppliedNumericArtifactStats: false;
    characterLevel: 90;
    constellation: 0;
    talentLevels: { auto: 10; skill: 10; burst: 10 };
    fiveStarRefinement: 1;
    deathmatchRefinement: 5;
    supporterEquipmentPurpose: "checkpoint-42-calculator-runnability-only";
    xiaoArtifactSetId: "marechaussee_hunter";
    xiaoArtifactSheet: Array<{
      key: StatKey;
      filterKey: string;
      value: number;
    }>;
    teammateArtifactSheetsEmpty: true;
    missingCircletPreserved: true;
    missingSubstatsPreserved: true;
    xiaoArtifactSheetEnergyRechargePresent: false;
    betaDataEnabled: false;
    betaEnvironmentOverrideEnabled: false;
    combatOptions: typeof COMBAT_OPTIONS;
    enemyAura: null;
    extraBuffCount: 0;
    reactionOverrideCount: 0;
    formulaBuffOverrideCount: 0;
    calcContext: {
      enemyLevel: 110;
      enemyRes: 0.1;
      rollMultiplier: 0.85;
      substatBudget: "8_6";
    };
    rejectedArtifactSheetVariant: {
      variantId: "omit-universal-flower-plume-main-stats";
      disposition: "rejected-pinned-witness-not-reproduced";
      probeWeaponId: "primordial_jade_wingedspear";
      pinnedGroupedDirectTotalDamage: number;
      observedGroupedDirectTotalDamage: number;
      absoluteDifference: number;
      variantReplayExecuted: true;
      fullCandidateDomainEvaluationExecuted: false;
    };
  };
  formulaPlanBoundary: {
    formulaIdAndCountOwnership: "guide-factory-checkpoint-42-calculator-default";
    lineOrderAndExecutionFlagOwnership: "guide-factory-checkpoint-47-wrapper";
    checkpoint42SuppliesFormulaIdsAndCountsOnly: true;
    groupedPlan: Array<{
      charId: "xiao";
      formulaId: string;
      count: number;
      reaction: null;
      forceOnField: true;
    }>;
    unitExpandedPlan: Array<{
      charId: "xiao";
      formulaId: string;
      count: 1;
      reaction: null;
      forceOnField: true;
    }>;
    unitExpandedLineCount: 13;
    sourceTwelvePlungePlanExecuted: false;
    sourceTwelvePlungePlanDisposition: "withheld-cross-context-no-external-buffs";
    sourceContextHasNoExternalBuffs: true;
    evaluatedContextHasExternalFfxxBuffs: true;
    rotationQualityEvaluated: false;
  };
  representationBoundary: {
    groupedReplayCount: 6;
    groupedReplayRejectionCount: 6;
    groupedRawDualPathCaptureCount: 6;
    unitExpandedReplayCount: 6;
    unitExpandedAgreementCount: 6;
    groupedDirectExpandedDirectAgreementCount: 6;
    groupedCompiledExpandedCompiledAgreementCount: 0;
    diagnosedCause: "grouped-line-stack-limited-buff-representation";
    comparisonWithheld: true;
    representationInvarianceValidated: false;
    groupedReplayAccepted: false;
    unitExpandedReplayAccepted: true;
  };
  observations: XiaoFfxxGroupedReplayCandidateObservation[];
  identityBoundary: {
    fixtureSha256: string;
    observationSetSha256: string;
    aggregatePreflightSha256: string;
    sourceRankExcludedFromExecutionIdentity: true;
    excludedRequestViewFactsExcludedFromExecutionIdentity: true;
  };
  summary: {
    candidateCount: 6;
    groupedReplayCount: 6;
    rejectedGroupedReplayCount: 6;
    acceptedUnitExpandedReplayCount: 6;
    comparableCandidateCount: 0;
    rankedCandidateCount: 0;
    winnerCount: 0;
    recommendationCount: 0;
    completeBuildCount: 0;
    energyRecoveryComputationCount: 0;
  };
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsBuildRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsWinnerClaims: false;
  supportsDamageClaims: false;
  supportsDamageComparisonClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  formulaInputsUsed: true;
  damageComputationExecuted: true;
  groupedReplayExecuted: true;
  unitExpandedReplayExecuted: true;
  optimizerExecuted: false;
  generatorExecuted: false;
  recommendationCompositionExecuted: false;
  idealRollAllocationExecuted: false;
  energyRecoveryInputsUsed: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
  issues: Array<{ code: string; path: string; message: string }>;
}

export type XiaoFfxxGroupedReplayRepresentationPreflightAuthentication =
  | {
      authenticated: true;
      canonicalReport: XiaoFfxxGroupedReplayRepresentationPreflightReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      issues: Array<{ code: string; path: string; message: string }>;
    };

export const XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS = [
  ...new Set([
    ...XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
    ...XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS,
    ...XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS,
    BRANCH_CANDIDATE_REPORT_PATH,
    FORMULA_COUNT_REPORT_PATH,
    CORE_PATH,
    CLI_PATH,
  ]),
].sort(compareText);

export const XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_SOURCE_FILE_PATHS =
  [...XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS];

export const XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "xiao-ffxx-grouped-replay-representation-preflight.json",
  );

interface AuthenticatedRawInput {
  generatedFrom: GeneratedFromEntry[];
  sourceTextByPath: Map<string, string>;
  branchCandidateReport: XiaoFfxxNonErConditionFreeBranchCandidateContractReport;
  formulaCountReport: XiaoFormulaCountParityReport;
}

interface RawDualPathEvidence {
  directTotalDamage: number;
  compiledTotalDamage: number;
  absoluteDifference: number;
  allowedDifference: number;
  computedBuffOverrides: Record<number, BuffActivationMap>;
}

export async function buildXiaoFfxxGroupedReplayRepresentationPreflightReport(
  input: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
): Promise<XiaoFfxxGroupedReplayRepresentationPreflightReport> {
  if (betaEnabled() || process.env.__BETA_ENABLED_OVERRIDE__ === "true") {
    throw new Error(
      "Xiao FFXX grouped-replay preflight requires the authenticated non-beta runtime branch.",
    );
  }
  const raw = authenticateRawInputs(input);
  const branchAuthentication =
    authenticateXiaoFfxxNonErConditionFreeBranchCandidateContract(
      raw.branchCandidateReport,
      branchCandidateUpstreamInput(input, raw),
    );
  if (!branchAuthentication.authenticated) {
    throw new Error(
      `Checkpoint-46 branch candidates failed fresh authentication (${branchAuthentication.reason}).`,
    );
  }
  const formulaAuthentication = await authenticateXiaoFormulaCountParityReport(
    raw.formulaCountReport,
    formulaCountUpstreamInput(input, raw),
  );
  if (!formulaAuthentication.authenticated) {
    throw new Error(
      `Checkpoint-42 formula-count witness failed fresh authentication (${formulaAuthentication.reason}).`,
    );
  }

  const branchReport = branchAuthentication.canonicalReport;
  const formulaReport = formulaAuthentication.canonicalReport;
  const candidates = requireCandidateBoundary(branchReport);
  requireFormulaCountBoundary(formulaReport);
  const observations: XiaoFfxxGroupedReplayCandidateObservation[] = [];
  for (const candidate of candidates) {
    observations.push(
      await evaluateCandidateRepresentation(candidate, formulaReport),
    );
  }
  authenticateObservationBoundary(observations);

  const branchReportText = requiredSourceText(
    raw.sourceTextByPath,
    BRANCH_CANDIDATE_REPORT_PATH,
  );
  const formulaReportText = requiredSourceText(
    raw.sourceTextByPath,
    FORMULA_COUNT_REPORT_PATH,
  );
  const xiaoArtifactSheet = serializeSheet(buildArtifactSheets().xiao);
  const rejectedArtifactSheetCandidate = candidates.find(
    ({ weaponId }) => weaponId === "primordial_jade_wingedspear",
  );
  const pinnedArtifactSheetObservation = observations.find(
    ({ weaponId }) => weaponId === "primordial_jade_wingedspear",
  );
  if (!rejectedArtifactSheetCandidate || !pinnedArtifactSheetObservation) {
    throw new Error(
      "Xiao FFXX grouped-replay preflight lost the PJWS rejected-sheet witness.",
    );
  }
  const rejectedArtifactSheetRaw = await evaluateRawDualPaths(
    buildReplayInput(
      rejectedArtifactSheetCandidate,
      formulaReport,
      groupedCombo(),
      1,
      "grouped",
      buildArtifactSheets(false),
    ),
  );
  const rejectedArtifactSheetDifference = Math.abs(
    pinnedArtifactSheetObservation.groupedReplay.directTotalDamage -
      rejectedArtifactSheetRaw.directTotalDamage,
  );
  if (rejectedArtifactSheetDifference <= REGRESSION_TOLERANCE) {
    throw new Error(
      "Omitting Xiao's universal Flower/Plume main stats unexpectedly reproduced the pinned grouped direct witness.",
    );
  }
  const rejectedArtifactSheetVariant = {
    variantId: "omit-universal-flower-plume-main-stats" as const,
    disposition: "rejected-pinned-witness-not-reproduced" as const,
    probeWeaponId: "primordial_jade_wingedspear" as const,
    pinnedGroupedDirectTotalDamage:
      pinnedArtifactSheetObservation.groupedReplay.directTotalDamage,
    observedGroupedDirectTotalDamage: normalizeNumber(
      rejectedArtifactSheetRaw.directTotalDamage,
    ),
    absoluteDifference: normalizeNumber(rejectedArtifactSheetDifference),
    variantReplayExecuted: true as const,
    fullCandidateDomainEvaluationExecuted: false as const,
  };
  const fixtureProjection = {
    sourceRosterTeamRecordId: TEAM_ID,
    calculatorFixtureTeamRecordId:
      "genshintools-presets:team:CX03obKWOJgK51-fWO",
    crossRecordConfigurationJoinAuthoredBy: "guide-factory",
    executedViewId: SOURCE_ONLY_VIEW_ID,
    excludedViewIds: [EXCLUDED_C6_VIEW_ID],
    roster: formulaReport.baselineComputationBoundary.roster,
    supporterAssumptions:
      formulaReport.calculatorDefaultDraft.assumptions.characters
        .filter(({ characterId }) => characterId !== "xiao")
        .map((assumption) => ({ ...assumption })),
    xiao: {
      characterLevel: 90,
      constellation: 0,
      talentLevels: { auto: 10, skill: 10, burst: 10 },
      artifactSetId: "marechaussee_hunter",
      artifactSheet: xiaoArtifactSheet,
      weaponAxis: "checkpoint-46-six-candidate-domain",
      refinementPolicy: { fiveStar: 1, deathmatch: 5 },
    },
    combatOptions: COMBAT_OPTIONS,
    calcContext: buildCalcContext(),
    groupedFormulaPlan: groupedCombo().lines.map(
      ({ charId, formulaId, count, reaction, forceOnField }) => ({
        charId,
        formulaId,
        count,
        reaction,
        forceOnField,
      }),
    ),
    expandedFormulaPlan: expandedCombo().lines.map(
      ({ charId, formulaId, count, reaction, forceOnField }) => ({
        charId,
        formulaId,
        count,
        reaction,
        forceOnField,
      }),
    ),
    energyRecharge: "absent-deferred",
  };
  const identityBoundary = {
    fixtureSha256: hashValue(fixtureProjection),
    observationSetSha256: hashValue(
      observations.map(({ observationSha256 }) => observationSha256),
    ),
    aggregatePreflightSha256: hashValue({
      fixtureProjection,
      observations: observations.map(
        ({ observationSha256 }) => observationSha256,
      ),
      rejectedArtifactSheetVariant,
      disposition: "withheld-grouped-stack-limited-representation-mismatch",
    }),
    sourceRankExcludedFromExecutionIdentity: true as const,
    excludedRequestViewFactsExcludedFromExecutionIdentity: true as const,
  };

  return {
    schemaVersion: 1,
    reportType: "xiao-ffxx-grouped-replay-representation-preflight",
    preflightId: PREFLIGHT_ID,
    classification: "authenticated-bounded-representation-preflight",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-grouped-stack-limited-representation-mismatch",
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      combinedJsonInputByteAndParsedObjectParity: true,
      staticFirstPartyReplayRuntimePathClosure: true,
      staticFirstPartyReplayRuntimeFileCount: 80,
      runtimeGlobDiscoveryUsed: false,
      sourceFileCount: 118,
      generatedFromCount: 118,
      authenticatedJsonInputParityCount: 12,
      directDurableReportJsonInputCount: 2,
    },
    branchCandidateUpstreamBoundary: {
      status: "accepted",
      durableReportPath: BRANCH_CANDIDATE_REPORT_PATH,
      durableReportFileSha256: sha256Text(branchReportText),
      durableReportCanonicalObjectSha256: hashValue(branchReport),
      freshlyAuthenticated: true,
      upstreamInputCount:
        XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS.length,
      candidateCount: 6,
    },
    formulaCountUpstreamBoundary: {
      status: "accepted",
      durableReportPath: FORMULA_COUNT_REPORT_PATH,
      durableReportFileSha256: sha256Text(formulaReportText),
      durableReportCanonicalObjectSha256: hashValue(formulaReport),
      freshlyAuthenticated: true,
      upstreamInputCount: XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS.length,
      calculatorDefaultSkillCount: 2,
      calculatorDefaultHighPlungeCount: 11,
      sourceTranslatedSkillCount: 2,
      sourceTranslatedHighPlungeCount: 12,
    },
    executionScope: {
      sourceRosterTeamRecordId: TEAM_ID,
      calculatorFixtureTeamRecordId:
        "genshintools-presets:team:CX03obKWOJgK51-fWO",
      crossRecordConfigurationJoinAuthoredBy: "guide-factory",
      exactRosterEqualityRequired: true,
      executedViewId: SOURCE_ONLY_VIEW_ID,
      executedViewRequestFactCount: 0,
      excludedViewIds: [EXCLUDED_C6_VIEW_ID],
      excludedViewCount: 1,
      excludedC6ViewAffectedConfiguration: false,
      excludedC6ViewAffectedCandidateIdentity: false,
      excludedC6ViewExecuted: false,
      candidateCount: 6,
      completeBuildCount: 0,
    },
    fixtureBoundary: {
      authoredBy: "guide-factory",
      sourceAuthoredWholeFixture: false,
      fixedMainStatValuesPurpose:
        "guide-factory-wrapper-runtime-materialization",
      sourceSuppliedNumericArtifactStats: false,
      characterLevel: 90,
      constellation: 0,
      talentLevels: { auto: 10, skill: 10, burst: 10 },
      fiveStarRefinement: 1,
      deathmatchRefinement: 5,
      supporterEquipmentPurpose: "checkpoint-42-calculator-runnability-only",
      xiaoArtifactSetId: "marechaussee_hunter",
      xiaoArtifactSheet,
      teammateArtifactSheetsEmpty: true,
      missingCircletPreserved: true,
      missingSubstatsPreserved: true,
      xiaoArtifactSheetEnergyRechargePresent: false,
      betaDataEnabled: false,
      betaEnvironmentOverrideEnabled: false,
      combatOptions: { ...COMBAT_OPTIONS },
      enemyAura: null,
      extraBuffCount: 0,
      reactionOverrideCount: 0,
      formulaBuffOverrideCount: 0,
      calcContext: buildCalcContext(),
      rejectedArtifactSheetVariant,
    },
    formulaPlanBoundary: {
      formulaIdAndCountOwnership:
        "guide-factory-checkpoint-42-calculator-default",
      lineOrderAndExecutionFlagOwnership:
        "guide-factory-checkpoint-47-wrapper",
      checkpoint42SuppliesFormulaIdsAndCountsOnly: true,
      groupedPlan: groupedCombo().lines.map(
        ({ formulaId, count, reaction, forceOnField }) => ({
          charId: "xiao" as const,
          formulaId,
          count,
          reaction: reaction as null,
          forceOnField: forceOnField as true,
        }),
      ),
      unitExpandedPlan: expandedCombo().lines.map(
        ({ formulaId, reaction, forceOnField }) => ({
          charId: "xiao" as const,
          formulaId,
          count: 1 as const,
          reaction: reaction as null,
          forceOnField: forceOnField as true,
        }),
      ),
      unitExpandedLineCount: 13,
      sourceTwelvePlungePlanExecuted: false,
      sourceTwelvePlungePlanDisposition:
        "withheld-cross-context-no-external-buffs",
      sourceContextHasNoExternalBuffs: true,
      evaluatedContextHasExternalFfxxBuffs: true,
      rotationQualityEvaluated: false,
    },
    representationBoundary: {
      groupedReplayCount: 6,
      groupedReplayRejectionCount: 6,
      groupedRawDualPathCaptureCount: 6,
      unitExpandedReplayCount: 6,
      unitExpandedAgreementCount: 6,
      groupedDirectExpandedDirectAgreementCount: 6,
      groupedCompiledExpandedCompiledAgreementCount: 0,
      diagnosedCause: "grouped-line-stack-limited-buff-representation",
      comparisonWithheld: true,
      representationInvarianceValidated: false,
      groupedReplayAccepted: false,
      unitExpandedReplayAccepted: true,
    },
    observations,
    identityBoundary,
    summary: {
      candidateCount: 6,
      groupedReplayCount: 6,
      rejectedGroupedReplayCount: 6,
      acceptedUnitExpandedReplayCount: 6,
      comparableCandidateCount: 0,
      rankedCandidateCount: 0,
      winnerCount: 0,
      recommendationCount: 0,
      completeBuildCount: 0,
      energyRecoveryComputationCount: 0,
    },
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsBuildRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsWinnerClaims: false,
    supportsDamageClaims: false,
    supportsDamageComparisonClaims: false,
    supportsRotationClaims: false,
    supportsEnergyRecoveryClaims: false,
    formulaInputsUsed: true,
    damageComputationExecuted: true,
    groupedReplayExecuted: true,
    unitExpandedReplayExecuted: true,
    optimizerExecuted: false,
    generatorExecuted: false,
    recommendationCompositionExecuted: false,
    idealRollAllocationExecuted: false,
    energyRecoveryInputsUsed: false,
    energyRecoveryComputationExecuted: false,
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    issues: observations.map(({ candidateId }) => ({
      code: "representation.grouped-stack-limited-line-disagrees",
      path: `observations.${candidateId}.groupedReplay`,
      message:
        "Grouped interpreted and compiled damage disagree while the unit-expanded replay agrees; candidate comparison is withheld.",
    })),
  };
}

export async function authenticateXiaoFfxxGroupedReplayRepresentationPreflight(
  serializedReport: XiaoFfxxGroupedReplayRepresentationPreflightReport,
  input: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
): Promise<XiaoFfxxGroupedReplayRepresentationPreflightAuthentication> {
  let canonicalReport: XiaoFfxxGroupedReplayRepresentationPreflightReport;
  try {
    canonicalReport =
      await buildXiaoFfxxGroupedReplayRepresentationPreflightReport(input);
  } catch (error) {
    return {
      authenticated: false,
      reason: "canonical-inputs-rejected",
      issues: [
        {
          code: "xiao-ffxx-grouped-replay.canonical-input",
          path: "reports.xiao-ffxx-grouped-replay-representation-preflight",
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
          code: "xiao-ffxx-grouped-replay.serialized-report-mismatch",
          path: "reports.xiao-ffxx-grouped-replay-representation-preflight",
          message:
            "Serialized grouped-replay representation preflight does not match a fresh authenticated rebuild.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export async function requireAuthenticatedXiaoFfxxGroupedReplayRepresentationPreflight(
  report: XiaoFfxxGroupedReplayRepresentationPreflightReport,
  input: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
): Promise<void> {
  const authentication =
    await authenticateXiaoFfxxGroupedReplayRepresentationPreflight(
      report,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `Refusing an unauthenticated Xiao FFXX grouped-replay preflight (${authentication.reason}): ${authentication.issues
        .map(({ message }) => message)
        .join("; ")}`,
    );
  }
}

function authenticateRawInputs(
  input: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
): AuthenticatedRawInput {
  const expectedPaths = [
    ...XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
  ];
  if (
    XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS.length !==
      EXPECTED_REPLAY_RUNTIME_INPUT_COUNT ||
    expectedPaths.length !== EXPECTED_INPUT_PATH_COUNT
  ) {
    throw new Error(
      `Xiao FFXX grouped-replay static closure drifted from 80 runtime / 118 total paths (${XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS.length}/${expectedPaths.length}).`,
    );
  }
  const sourceFiles = [...input.sourceFiles]
    .map((file) => ({
      path: normalizePath(file.path),
      bytesBase64: file.bytesBase64,
    }))
    .sort((left, right) => compareText(left.path, right.path));
  const generatedFrom = [...input.generatedFrom]
    .map((entry) => ({ path: normalizePath(entry.path), sha256: entry.sha256 }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    sourceFiles.length !== expectedPaths.length ||
    new Set(sourceFiles.map(({ path: sourcePath }) => sourcePath)).size !==
      sourceFiles.length ||
    stableJson(sourceFiles.map(({ path: sourcePath }) => sourcePath)) !==
      stableJson(expectedPaths)
  ) {
    throw new Error(
      "Xiao FFXX grouped-replay source-file path closure drifted.",
    );
  }
  if (
    generatedFrom.length !== expectedPaths.length ||
    new Set(generatedFrom.map(({ path: entryPath }) => entryPath)).size !==
      generatedFrom.length ||
    stableJson(generatedFrom.map(({ path: entryPath }) => entryPath)) !==
      stableJson(expectedPaths)
  ) {
    throw new Error(
      "Xiao FFXX grouped-replay generatedFrom path closure drifted.",
    );
  }

  const sourceTextByPath = new Map<string, string>();
  for (let index = 0; index < sourceFiles.length; index += 1) {
    const sourceFile = sourceFiles[index];
    const generated = generatedFrom[index];
    const bytes = decodeBase64(sourceFile.bytesBase64, sourceFile.path);
    const actualSha256 = sha256Bytes(bytes);
    if (
      generated.path !== sourceFile.path ||
      generated.sha256 !== actualSha256
    ) {
      throw new Error(
        `Xiao FFXX grouped-replay source-file hash drifted for ${sourceFile.path}.`,
      );
    }
    sourceTextByPath.set(sourceFile.path, bytes.toString("utf8"));
  }

  const branchCandidateReport = parseDurableJsonParity(
    sourceTextByPath,
    BRANCH_CANDIDATE_REPORT_PATH,
    input.branchCandidateDurableReportInput,
  ) as XiaoFfxxNonErConditionFreeBranchCandidateContractReport;
  const formulaCountReport = parseDurableJsonParity(
    sourceTextByPath,
    FORMULA_COUNT_REPORT_PATH,
    input.formulaCountDurableReportInput,
  ) as XiaoFormulaCountParityReport;

  return {
    generatedFrom,
    sourceTextByPath,
    branchCandidateReport,
    formulaCountReport,
  };
}

function branchCandidateUpstreamInput(
  input: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
  raw: AuthenticatedRawInput,
): BuildXiaoFfxxNonErConditionFreeBranchCandidateContractInput {
  return {
    repositoryInput: input.repositoryInput,
    manualSnapshotInput: input.xiaoManualSnapshotInput,
    manualIndexInput: input.manualIndexInput,
    sourceRegistryInput: input.sourceRegistryInput,
    xiaoSourceLocalDurableReportInput: input.xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput: input.applicableClaimDurableReportInput,
    partialCandidateDurableReportInput:
      input.partialCandidateDurableReportInput,
    branchSourceDurableReportInput: input.branchSourceDurableReportInput,
    sourceFiles: subsetSourceFiles(
      raw.sourceTextByPath,
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
    ),
    generatedFrom: subsetGeneratedFrom(
      raw.generatedFrom,
      XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_INPUT_PATHS,
    ),
  };
}

function formulaCountUpstreamInput(
  input: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
  raw: AuthenticatedRawInput,
): BuildXiaoFormulaCountParityInput {
  return {
    repositoryInput: input.repositoryInput,
    manualFixtureSnapshotInput: input.xiaoRotationFixtureSnapshotInput,
    genshinToolsSnapshotInput: input.genshinToolsSnapshotInput,
    manualIndexInput: input.manualIndexInput,
    sourceRegistryInput: input.sourceRegistryInput,
    sourceFiles: subsetSourceFiles(
      raw.sourceTextByPath,
      XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS,
    ),
    generatedFrom: subsetGeneratedFrom(
      raw.generatedFrom,
      XIAO_FORMULA_COUNT_PARITY_CODE_PATHS,
    ),
  };
}

function subsetSourceFiles(
  sourceTextByPath: ReadonlyMap<string, string>,
  paths: readonly string[],
): Array<{ path: string; text: string }> {
  return paths.map((sourcePath) => ({
    path: sourcePath,
    text: requiredSourceText(sourceTextByPath, sourcePath),
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

function parseDurableJsonParity(
  sourceTextByPath: ReadonlyMap<string, string>,
  sourcePath: string,
  parsedInput: unknown,
): unknown {
  const text = requiredSourceText(sourceTextByPath, sourcePath);
  let parsedFromBytes: unknown;
  try {
    parsedFromBytes = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Xiao FFXX grouped-replay durable input ${sourcePath} is not JSON: ${errorMessage(error)}`,
    );
  }
  if (stableJson(parsedFromBytes) !== stableJson(parsedInput)) {
    throw new Error(
      `Xiao FFXX grouped-replay parsed input disagrees with bytes for ${sourcePath}.`,
    );
  }
  return parsedFromBytes;
}

function requireCandidateBoundary(
  report: XiaoFfxxNonErConditionFreeBranchCandidateContractReport,
): XiaoFfxxNonErConditionFreeBranchCandidate[] {
  const expectedWeapons = Object.keys(EXPECTED_WEAPON_TOTALS).sort(compareText);
  const candidatesByTechnicalIdentity = [...report.candidates].sort(
    (left, right) => compareText(left.candidateId, right.candidateId),
  );
  if (
    report.comparisonStatus !== "comparable" ||
    report.summary.partialCandidateCount !== 6 ||
    report.summary.completeCandidateCount !== 0 ||
    report.candidates.length !== 6 ||
    stableJson(
      report.candidates.map(({ weaponId }) => weaponId).sort(compareText),
    ) !==
      stableJson(expectedWeapons) ||
    report.candidates.some(
      (candidate) =>
        candidate.completionStatus !== "partial" ||
        candidate.completeness.complete ||
        candidate.presentAxisIds.join("|") !==
          "weapon|artifact-set|main-stat:sands|main-stat:goblet" ||
        candidate.missingAxisIds.join("|") !== "main-stat:circlet|substats" ||
        candidate.factoryRank != null ||
        candidate.crossRarityRank != null ||
        candidate.teamRecordId !== TEAM_ID ||
        candidate.baseViewEvidence.length !== 2,
    )
  ) {
    throw new Error(
      "Checkpoint-46 candidate boundary no longer exposes the exact six partial Xiao FFXX candidates.",
    );
  }
  for (const candidate of candidatesByTechnicalIdentity) {
    const sourceOnly = candidate.baseViewEvidence.find(
      ({ viewId }) => viewId === SOURCE_ONLY_VIEW_ID,
    );
    const excludedC6 = candidate.baseViewEvidence.find(
      ({ viewId }) => viewId === EXCLUDED_C6_VIEW_ID,
    );
    if (
      !sourceOnly ||
      sourceOnly.requestFactCount !== 0 ||
      !excludedC6 ||
      excludedC6.requestFactCount !== 1
    ) {
      throw new Error(
        `Checkpoint-46 candidate ${candidate.candidateId} lost the exact source-only/C6 provenance split.`,
      );
    }
    requireCandidateTechnicalAxes(candidate);
  }
  return candidatesByTechnicalIdentity.map((candidate) =>
    structuredClone(candidate),
  );
}

function requireCandidateTechnicalAxes(
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate,
): void {
  const artifactSet = candidate.axes.find(
    ({ axisId }) => axisId === "artifact-set",
  );
  const sands = candidate.axes.find(
    ({ axisId }) => axisId === "main-stat:sands",
  );
  const goblet = candidate.axes.find(
    ({ axisId }) => axisId === "main-stat:goblet",
  );
  if (
    !artifactSet ||
    !("normalizedValues" in artifactSet) ||
    stableJson(artifactSet.normalizedValues) !==
      stableJson([{ setId: "marechaussee_hunter", type: "4pc" }]) ||
    !sands ||
    !("normalizedValues" in sands) ||
    stableJson(sands.normalizedValues) !==
      stableJson([{ slot: "sands", statId: "atk%" }]) ||
    !goblet ||
    !("normalizedValues" in goblet) ||
    stableJson(goblet.normalizedValues) !==
      stableJson([{ slot: "goblet", statId: "anemo%" }])
  ) {
    throw new Error(
      `Checkpoint-46 candidate ${candidate.candidateId} lost the MH/ATK/Anemo technical fixture.`,
    );
  }
}

function requireFormulaCountBoundary(
  report: XiaoFormulaCountParityReport,
): void {
  const calculatorXiaoLines = report.calculatorDefaultDraft.lines
    .filter(({ characterId }) => characterId === "xiao")
    .map(({ characterId, formulaId, count }) => ({
      characterId,
      formulaId,
      count,
    }))
    .sort((left, right) => compareText(left.formulaId, right.formulaId));
  const sourceLines = report.translatedFormulaCounts
    .map(({ characterId, formulaId, count }) => ({
      characterId,
      formulaId,
      count,
    }))
    .sort((left, right) => compareText(left.formulaId, right.formulaId));
  if (
    report.sourceBoundary.rotation.id !== "no-buff-eeq12hp" ||
    report.sourceBoundary.rotation.notation !== "EEQ12HP" ||
    !report.sourceBoundary.rotation.assumptions.includes(
      "No external buffs are assumed.",
    ) ||
    stableJson(report.baselineComputationBoundary.roster) !==
      stableJson(["xiao", "xianyun", "furina", "faruzan"]) ||
    report.baselineComputationBoundary.localInvestmentAssumption
      .constellation !== 0 ||
    stableJson(calculatorXiaoLines) !==
      stableJson([
        {
          characterId: "xiao",
          formulaId: "xiao-plunge-high",
          count: 11,
        },
        { characterId: "xiao", formulaId: "xiao-skill", count: 2 },
      ]) ||
    stableJson(sourceLines) !==
      stableJson([
        {
          characterId: "xiao",
          formulaId: "xiao-plunge-high",
          count: 12,
        },
        { characterId: "xiao", formulaId: "xiao-skill", count: 2 },
      ])
  ) {
    throw new Error(
      "Checkpoint-42 formula-count witness lost the exact C0 FFXX 2-Skill/11-versus-12-plunge boundary.",
    );
  }
}

async function evaluateCandidateRepresentation(
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate,
  formulaReport: XiaoFormulaCountParityReport,
): Promise<XiaoFfxxGroupedReplayCandidateObservation> {
  if (!(candidate.weaponId in EXPECTED_WEAPON_TOTALS)) {
    throw new Error(`Unexpected Xiao candidate weapon ${candidate.weaponId}.`);
  }
  const weaponId = candidate.weaponId as keyof typeof EXPECTED_WEAPON_TOTALS;
  const refinement: 1 | 5 = weaponId === "deathmatch" ? 5 : 1;
  const groupedInput = buildReplayInput(
    candidate,
    formulaReport,
    groupedCombo(),
    refinement,
    "grouped",
  );
  let groupedRejectionMessage: string | null = null;
  try {
    await replayTeamDamage(groupedInput);
  } catch (error) {
    groupedRejectionMessage = errorMessage(error);
  }
  if (
    !groupedRejectionMessage ||
    !groupedRejectionMessage.includes("direct damage") ||
    !groupedRejectionMessage.includes("compiled damage") ||
    !groupedRejectionMessage.includes("above tolerance")
  ) {
    throw new Error(
      `Grouped replay ${candidate.candidateId} did not produce the expected dual-path rejection.`,
    );
  }

  const groupedRaw = await evaluateRawDualPaths(groupedInput);
  const expandedInput = buildReplayInput(
    candidate,
    formulaReport,
    expandedCombo(),
    refinement,
    "unit-expanded",
  );
  const expanded = await replayTeamDamage(expandedInput);
  const expected = EXPECTED_WEAPON_TOTALS[weaponId];
  requireNear(
    `${weaponId} grouped direct regression total`,
    groupedRaw.directTotalDamage,
    expected.groupedDirect,
    REGRESSION_TOLERANCE,
  );
  requireNear(
    `${weaponId} grouped compiled regression total`,
    groupedRaw.compiledTotalDamage,
    expected.groupedCompiled,
    REGRESSION_TOLERANCE,
  );
  requireNear(
    `${weaponId} grouped direct versus unit-expanded direct`,
    groupedRaw.directTotalDamage,
    expanded.validation.calculatorAgreement.directTotalDamage,
    ABSOLUTE_TOLERANCE,
  );
  if (
    Math.abs(
      groupedRaw.compiledTotalDamage -
        expanded.validation.calculatorAgreement.compiledTotalDamage,
    ) <= REGRESSION_TOLERANCE
  ) {
    throw new Error(
      `${weaponId} grouped compiled result unexpectedly equals its unit-expanded result.`,
    );
  }

  const groupedActivation = extractGroupedXianyunActivation(
    groupedRaw.computedBuffOverrides,
  );
  const expandedActivation = extractExpandedXianyunActivation(
    expanded.validation.computedBuffOverrides,
    groupedActivation.buffKey,
  );
  const withoutHash = {
    candidateId: candidate.candidateId,
    candidateIdentitySha256: candidate.candidateIdentitySha256,
    weaponId,
    refinement,
    sourceOnlyViewId: SOURCE_ONLY_VIEW_ID as typeof SOURCE_ONLY_VIEW_ID,
    excludedViewIds: [EXCLUDED_C6_VIEW_ID] as [typeof EXCLUDED_C6_VIEW_ID],
    groupedReplay: {
      representation: "two-grouped-formula-lines" as const,
      lineCounts: [2, 11] as [2, 11],
      replayTeamDamageRejected: true as const,
      rejectionMessage: groupedRejectionMessage,
      directTotalDamage: normalizeNumber(groupedRaw.directTotalDamage),
      compiledTotalDamage: normalizeNumber(groupedRaw.compiledTotalDamage),
      absoluteDifference: normalizeNumber(groupedRaw.absoluteDifference),
      allowedDifference: normalizeNumber(groupedRaw.allowedDifference),
      calculatorAgreement: false as const,
      xianyunStackLimitedBuffKey: groupedActivation.buffKey,
      xianyunPerCastActivation: normalizeNumber(groupedActivation.perCast),
      xianyunTotalActivation: 8 as const,
    },
    unitExpandedReplay: {
      representation: "thirteen-unit-formula-lines" as const,
      lineCounts: Array.from({ length: 13 }, () => 1) as [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
      ],
      replayTeamDamageAccepted: true as const,
      directTotalDamage:
        expanded.validation.calculatorAgreement.directTotalDamage,
      compiledTotalDamage:
        expanded.validation.calculatorAgreement.compiledTotalDamage,
      absoluteDifference:
        expanded.validation.calculatorAgreement.absoluteDifference,
      allowedDifference:
        expanded.validation.calculatorAgreement.allowedDifference,
      calculatorAgreement: true as const,
      xianyunStackLimitedBuffKey: groupedActivation.buffKey,
      xianyunPerCastActivationSequence: expandedActivation,
      xianyunTotalActivation: 8 as const,
    },
    crossRepresentation: {
      groupedDirectEqualsExpandedDirect: true as const,
      groupedCompiledEqualsExpandedCompiled: false as const,
      groupedDirectMinusExpandedDirect: normalizeNumber(
        groupedRaw.directTotalDamage -
          expanded.validation.calculatorAgreement.directTotalDamage,
      ),
    },
    disposition:
      "withheld-grouped-stack-limited-representation-mismatch" as const,
    comparisonEligible: false as const,
    factoryRank: null,
    winner: false as const,
    recommendation: false as const,
  };
  return { ...withoutHash, observationSha256: hashValue(withoutHash) };
}

function buildReplayInput(
  candidate: XiaoFfxxNonErConditionFreeBranchCandidate,
  formulaReport: XiaoFormulaCountParityReport,
  combo: ReplayCombo,
  refinement: 1 | 5,
  representation: "grouped" | "unit-expanded",
  artifactSheets: Record<string, StatSheet> = buildArtifactSheets(),
): DamageReplayInput {
  return {
    replayId: `${PREFLIGHT_ID}:${candidate.weaponId}:${representation}`,
    evidence: {
      classification: "authored_validation_target",
      supportsGuideClaims: false,
      notes: [
        "Checkpoint 46 supplies one incomplete technical weapon/artifact candidate; it does not supply a whole build or damage claim.",
        "Checkpoint 42 supplies the calculator-default Xiao formula IDs and counts used by this representation diagnostic; its source twelve-plunge context is not executed.",
        "The GenshinTools preset reference authenticates roster equality only; supporter equipment is copied by this wrapper for calculator runnability, while character investment and Xiao's candidate equipment remain Guide Factory assumptions.",
        "This replay is wrapper-authored and withheld from comparisons, ranks, winners, recommendations, and player-facing damage claims.",
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
    teamConfigs: buildTeamConfigs(candidate, formulaReport, refinement),
    combatOptions: { ...COMBAT_OPTIONS },
    enemyAura: null,
    extraBuffs: [],
    calcContext: buildCalcContext(),
    combo,
    artifactSheets,
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
  includeUniversalFlowerAndPlume = true,
): Record<string, StatSheet> {
  return {
    xiao: new StatSheet(
      includeUniversalFlowerAndPlume
        ? [
            materializeLevel20FiveStarMainStat("hp"),
            materializeLevel20FiveStarMainStat("atk"),
            materializeLevel20FiveStarMainStat("atk%"),
            materializeLevel20FiveStarMainStat("anemo%"),
          ]
        : [
            materializeLevel20FiveStarMainStat("atk%"),
            materializeLevel20FiveStarMainStat("anemo%"),
          ],
    ),
    xianyun: new StatSheet([]),
    furina: new StatSheet([]),
    faruzan: new StatSheet([]),
  };
}

function materializeLevel20FiveStarMainStat(
  key: "hp" | "atk" | "atk%" | "anemo%",
): { key: "hp" | "atk" | "atk%" | "anemo%"; value: number } {
  return {
    key,
    value: toInternal(key, getMainStatValueAtLevel(key, 5, 20)),
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

function groupedCombo(): ReplayCombo {
  return {
    id: "xiao-ffxx-calculator-default-grouped-2e-11hp",
    label: {
      en: "Xiao grouped 2E + 11 High Plunge representation preflight",
      zh: "魈 2E + 11 次高空下落攻击分组表示预检",
    },
    lines: [
      {
        charId: "xiao",
        formulaId: "xiao-skill",
        count: 2,
        reaction: null,
        forceOnField: true,
      },
      {
        charId: "xiao",
        formulaId: "xiao-plunge-high",
        count: 11,
        reaction: null,
        forceOnField: true,
      },
    ],
  };
}

function expandedCombo(): ReplayCombo {
  return {
    id: "xiao-ffxx-calculator-default-unit-expanded-2e-11hp",
    label: {
      en: "Xiao unit-expanded 2E + 11 High Plunge representation preflight",
      zh: "魈 2E + 11 次高空下落攻击逐次表示预检",
    },
    lines: [
      ...Array.from({ length: 2 }, () => ({
        charId: "xiao",
        formulaId: "xiao-skill",
        count: 1,
        reaction: null,
        forceOnField: true,
      })),
      ...Array.from({ length: 11 }, () => ({
        charId: "xiao",
        formulaId: "xiao-plunge-high",
        count: 1,
        reaction: null,
        forceOnField: true,
      })),
    ],
  };
}

async function evaluateRawDualPaths(
  input: DamageReplayInput,
): Promise<RawDualPathEvidence> {
  await bootstrapGuideFactoryComputation();
  const teamConfigs = input.teamConfigs.map(cloneTeamConfig);
  const teamBuild = new TeamBuild(
    teamConfigs,
    input.combatOptions,
    input.enemyAura ?? undefined,
    input.extraBuffs,
    undefined,
    input.calcContext,
  );
  const combo = toEngineCombo(input.combo);
  const availableFormulas = teamBuild.catalog.getFormulaIds();
  for (const line of combo.lines) {
    if (!availableFormulas[line.charId]?.[line.formulaId]) {
      throw new Error(
        `Raw dual-path capture ${input.replayId} is missing ${line.charId}.${line.formulaId}.`,
      );
    }
  }
  const computedBuffOverrides =
    buildBuffOverrides(
      combo.lines,
      teamBuild,
      input.artifactSheets,
      input.calcContext,
      input.formulaBuffOverrides ?? undefined,
    ) ?? {};
  const direct = teamBuild.getComboDamageResult(
    combo,
    input.artifactSheets,
    input.calcContext,
    computedBuffOverrides,
  );
  const compilerBuffOverrides = Object.fromEntries(
    Object.entries(computedBuffOverrides).map(([lineIndex, activation]) => [
      `line:${lineIndex}`,
      activation,
    ]),
  );
  const charIds = teamConfigs.map(({ charId }) => charId);
  const compiled = compileComboTeamDamage(
    teamBuild,
    combo,
    charIds,
    input.artifactSheets,
    input.calcContext,
    compilerBuffOverrides,
  );
  const vars = new Float64Array(compiled.numVars);
  for (const charId of charIds) {
    const charIdx = compiled.charIdxMap?.get(charId);
    if (charIdx == null) {
      throw new Error(
        `Raw dual-path capture ${input.replayId} lacks compiler variables for ${charId}.`,
      );
    }
    fillVarsFromSheet(
      input.artifactSheets[charId],
      compiled.varMapping,
      charIdx,
      vars,
    );
  }
  const compiledTotalDamage = compiled.evaluate(vars);
  const absoluteDifference = Math.abs(direct.totalDamage - compiledTotalDamage);
  const allowedDifference = Math.max(
    ABSOLUTE_TOLERANCE,
    RELATIVE_TOLERANCE *
      Math.max(1, Math.abs(direct.totalDamage), Math.abs(compiledTotalDamage)),
  );
  return {
    directTotalDamage: direct.totalDamage,
    compiledTotalDamage,
    absoluteDifference,
    allowedDifference,
    computedBuffOverrides,
  };
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

function toEngineCombo(combo: ReplayCombo): ComboFormula {
  return {
    id: combo.id,
    label: { ...combo.label },
    lines: combo.lines.map((line) => ({
      charId: line.charId,
      formulaId: line.formulaId,
      count: line.count,
      ...(line.reaction ? { reaction: { ...line.reaction } } : {}),
      forceOnField: line.forceOnField,
    })),
  };
}

function extractGroupedXianyunActivation(
  overrides: Record<number, BuffActivationMap>,
): { buffKey: string; perCast: number } {
  const plungeActivation = overrides[1];
  if (!plungeActivation) {
    throw new Error("Grouped replay is missing its plunge activation map.");
  }
  const candidates = Object.entries(plungeActivation)
    .map(([buffKey, partMap]) => ({
      buffKey,
      perCast: sumActivation(partMap),
    }))
    .filter(({ perCast }) => near(perCast, 8 / 11, ABSOLUTE_TOLERANCE));
  if (candidates.length !== 1) {
    throw new Error(
      `Grouped replay expected one Xianyun 8/11 activation, found ${candidates.length}.`,
    );
  }
  return candidates[0];
}

function extractExpandedXianyunActivation(
  overrides: Record<string, BuffActivationMap>,
  buffKey: string,
): [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0] {
  const sequence = Array.from({ length: 11 }, (_, plungeIndex) => {
    const partMap = overrides[String(plungeIndex + 2)]?.[buffKey];
    return normalizeNumber(partMap ? sumActivation(partMap) : 0);
  });
  const expected = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0] as const;
  if (stableJson(sequence) !== stableJson(expected)) {
    throw new Error(
      `Unit-expanded replay lost its Xianyun 8x1 then 3x0 activation sequence: ${sequence.join(",")}.`,
    );
  }
  return [...expected];
}

function sumActivation(partMap: Record<number, number>): number {
  return Object.values(partMap).reduce((sum, value) => sum + value, 0);
}

function authenticateObservationBoundary(
  observations: readonly XiaoFfxxGroupedReplayCandidateObservation[],
): void {
  if (
    observations.length !== 6 ||
    stableJson(
      observations.map(({ weaponId }) => weaponId).sort(compareText),
    ) !== stableJson(Object.keys(EXPECTED_WEAPON_TOTALS).sort(compareText)) ||
    stableJson(observations.map(({ candidateId }) => candidateId)) !==
      stableJson(
        observations.map(({ candidateId }) => candidateId).sort(compareText),
      ) ||
    new Set(observations.map(({ observationSha256 }) => observationSha256))
      .size !== 6 ||
    observations.some(
      (observation) =>
        observation.comparisonEligible ||
        observation.factoryRank != null ||
        observation.winner ||
        observation.recommendation ||
        !observation.groupedReplay.replayTeamDamageRejected ||
        !observation.unitExpandedReplay.replayTeamDamageAccepted ||
        !observation.crossRepresentation.groupedDirectEqualsExpandedDirect ||
        observation.crossRepresentation.groupedCompiledEqualsExpandedCompiled,
    )
  ) {
    throw new Error(
      "Xiao FFXX grouped-replay observation closure no longer has six withheld mismatch witnesses.",
    );
  }
}

function serializeSheet(
  sheet: StatSheet,
): Array<{ key: StatKey; filterKey: string; value: number }> {
  return [...sheet.dump()]
    .map((entry) => ({ ...entry, value: normalizeNumber(entry.value) }))
    .sort(
      (left, right) =>
        compareText(left.key, right.key) ||
        compareText(left.filterKey, right.filterKey) ||
        left.value - right.value,
    );
}

function decodeBase64(value: string, sourcePath: string): Buffer {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Xiao FFXX grouped-replay source file ${sourcePath} has no byte payload.`,
    );
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new Error(
      `Xiao FFXX grouped-replay source file ${sourcePath} has non-canonical base64.`,
    );
  }
  return bytes;
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function requiredSourceText(
  sourceTextByPath: ReadonlyMap<string, string>,
  sourcePath: string,
): string {
  const text = sourceTextByPath.get(sourcePath);
  if (text == null) {
    throw new Error(
      `Missing Xiao FFXX grouped-replay source file ${sourcePath}.`,
    );
  }
  return text;
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      `Cannot normalize non-finite grouped-replay value ${value}.`,
    );
  }
  if (Object.is(value, -0)) return 0;
  return Number(value.toPrecision(15));
}

function near(left: number, right: number, tolerance: number): boolean {
  return Math.abs(left - right) <= tolerance;
}

function requireNear(
  label: string,
  actual: number,
  expected: number,
  tolerance: number,
): void {
  if (!near(actual, expected, tolerance)) {
    throw new Error(
      `${label} drifted: expected ${expected}, observed ${actual}, tolerance ${tolerance}.`,
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
