import path from "node:path";
import {
  isCompleteBoundedFullTeamEquipmentTechnicalComputationReport,
  requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport,
  runBoundedFullTeamEquipmentTechnicalComputation,
  type BoundedFullTeamEquipmentTechnicalComputationEnvironment,
  type BoundedFullTeamEquipmentTechnicalComputationReport,
  type BoundedFullTeamEquipmentTechnicalExecutionPolicy,
} from "./boundedFullTeamEquipmentTechnicalComputation";
import { sha256Text, stableJson } from "./io";
import {
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
  type KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
} from "./keqingIneffaFurinaXilonenEquipmentRuntimePreflight";
import { REPOSITORY_ROOT } from "./paths";
import {
  isCompleteSourceBackedEquipmentRuntimePreflightReport,
  requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport,
} from "./sourceBackedEquipmentRuntimePreflight";

const SHA256 = /^[a-f0-9]{64}$/;

export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_ID =
  "keqing-ineffa-furina-xilonen-bounded-equipment-technical-computation-v1";
export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-technical-computation.json";
export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_PATH =
  path.join(
    REPOSITORY_ROOT,
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_RELATIVE_PATH,
  );

/**
 * Exact declared non-self checkpoint inputs for this durable experiment. The
 * list deliberately covers the committed CP37 report, the CP38 generic core,
 * and selected generator/replay/runtime inputs whose bytes define this run.
 * It is intentionally non-exhaustive and makes no transitive module-graph
 * claim. The producing wrapper, CLI, and output report are excluded to avoid
 * a self-referential digest.
 */
export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS = [
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json",
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentRuntimePreflight.ts",
  "scripts/guide-factory/src/sourceBackedEquipmentRuntimePreflight.ts",
  "scripts/guide-factory/src/boundedFullTeamEquipmentTechnicalComputation.ts",
  "scripts/guide-factory/src/computationReplay.ts",
  "scripts/guide-factory/src/io.ts",
  "src/data/betaState.ts",
  "src/data/charInfo.ts",
  "src/data/constants.ts",
  "src/data/enums.ts",
  "src/data/game/artifact_stat.json",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_stats.json",
  "src/data/gameDataUtil.ts",
  "src/data/gameResources.ts",
  "src/data/gameStatsLoader.ts",
  "src/data/resources.ts",
  "src/data/resources_beta.ts",
  "src/data/utils.ts",
  "src/lib/artifact/scoring/constants.ts",
  "src/lib/artifact/scoring/sheetBuilder.ts",
  "src/lib/artifact/scoring/utils.ts",
  "src/lib/team-comp/generator/constrainedGreedy.ts",
  "src/lib/team-comp/generator/generator.ts",
  "src/lib/team-comp/generator/substatBudget.ts",
  "src/lib/team-comp/optimizer/erCrConstraints.ts",
  "src/lib/team-comp/teamConfigUtils.ts",
  "src/lib/dmgcalc/index.ts",
  "src/lib/dmgcalc/constants.ts",
  "src/lib/dmgcalc/utils.ts",
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
  "src/lib/dmgcalc/impl/character5Fontaine.ts",
  "src/lib/dmgcalc/impl/character5Liyue.ts",
  "src/lib/dmgcalc/impl/character5Natlan.ts",
  "src/lib/dmgcalc/impl/character5NodKrai.ts",
  "src/lib/dmgcalc/impl/helpers.ts",
  "src/lib/dmgcalc/impl/weapon4Sword.ts",
  "src/lib/dmgcalc/impl/weapon5Polearm.ts",
  "src/lib/dmgcalc/impl/weapon5Sword.ts",
] as const;

const EXPECTED_INPUT_FILE_SHA256 = {
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json":
    "c0dedcfb87d27dfebeba99d89a26a6ed614f4de536b23d6bef54529b0246155b",
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentRuntimePreflight.ts":
    "9095bc051441d6beb784a4a0c71ed7246e9d71769eb92e874fc2d9c53209eace",
  "scripts/guide-factory/src/sourceBackedEquipmentRuntimePreflight.ts":
    "2602c8af1cf81bec68d824b2a51a2438e5a8945a437adc8c06f11c96dcca53b7",
  "scripts/guide-factory/src/boundedFullTeamEquipmentTechnicalComputation.ts":
    "29e33ede271813d2bb1ea4a07549377afdc36cd775a72325683191908244f600",
  "scripts/guide-factory/src/computationReplay.ts":
    "228a1eb55b329acbf46241583b38e2edd957050d705dc37f30c058360e4672ff",
  "scripts/guide-factory/src/io.ts":
    "cbfae2bef83feac01e841adfbef0d30e96f828e4a20fa8a4c6f8c12fc9200935",
  "src/data/betaState.ts":
    "b90184db728c9d6f7b95dbb49efa08abc47ee6259dd9dbb9dc68c966317f90ce",
  "src/data/charInfo.ts":
    "6ff9b8d1fb7dce4f4d9875eee55df5fac5899e13ba6bebb5bbe45256db345d68",
  "src/data/constants.ts":
    "3e076788dfac5447d5d59456dc23d47c8d7fe5827795264b2d1dc20bde532c08",
  "src/data/enums.ts":
    "50ba2322815509b90e3a45a8e2c35889d73385279e38955afc75fab4cac8070a",
  "src/data/game/artifact_stat.json":
    "b2b6fcee736e7be28228f70a9d7624bc80bfce809c7a450377b46f0eef103f67",
  "src/data/game/character_stats.json":
    "f9ff524039a400b46e453147847fef4d26873a53bfe85af851f554eb7c5d3a0f",
  "src/data/game/weapon_stats.json":
    "e88cb5073dea3e6d45fcd52c020c8be73639cf443b28971a4534c8ea0c63eec8",
  "src/data/gameDataUtil.ts":
    "1192437fa64753fc11f23236a8c2018510ebc62390cffb1f1220e210c037434f",
  "src/data/gameResources.ts":
    "8cedb648026bd0b2684a61fc5658e724fc67b9016d1bc3909c625421ed1648eb",
  "src/data/gameStatsLoader.ts":
    "9cefd00bf25e44ba8ca06915568731728ce94a6c4e19c861456458e1fa9894ce",
  "src/data/resources.ts":
    "f8ab11b08762d1eb9e9bba2f8fb9b3f48ceaab34889b08294045c005de1798bd",
  "src/data/resources_beta.ts":
    "2f53ee6265fa2dc8367d6b5071e0deef95f080b0f34830403f795413fadcab21",
  "src/data/utils.ts":
    "8b55991704c1de9b661dac596fa34155a54a43f915f814185dc7f8db3c93f15d",
  "src/lib/artifact/scoring/constants.ts":
    "a1fbd7d200971276e96e61b3ad405112f592fe538250c75ac18b06256db1ad91",
  "src/lib/artifact/scoring/sheetBuilder.ts":
    "d982609ee2be21c3c0d3ff461a4b627a1b0f386e76356441bdf9712d2e1b989f",
  "src/lib/artifact/scoring/utils.ts":
    "7f8adecffa41ad02e21e7f64cac859845d89080b0446f5d2c142e547f0620e6a",
  "src/lib/team-comp/generator/constrainedGreedy.ts":
    "64fba22398fd2283f1cb1f0de2eb1edf186ca5a8680d3279ae99ebac3aedbd7c",
  "src/lib/team-comp/generator/generator.ts":
    "d0c0b7cc165504fab2a913d1d2ab02db787639764750e93a90a7e6723b6a5cc0",
  "src/lib/team-comp/generator/substatBudget.ts":
    "1ad0229b3a5a5eb370d239d371bea95037b0525f6dcf37173115459a11acfc02",
  "src/lib/team-comp/optimizer/erCrConstraints.ts":
    "01ea055b9e92cdf7e728b663d02e6fc5861102f5297d8eb8515270aa4d62daa0",
  "src/lib/team-comp/teamConfigUtils.ts":
    "538633ab68a20c0af9833d9a77120bc2855b4b8dbd99f588b6fea43ab7f48bbc",
  "src/lib/dmgcalc/index.ts":
    "00c92a2f1f53f5c9d21d7f57afbe992563c0105e466cc81aa17f17840b3c0cab",
  "src/lib/dmgcalc/constants.ts":
    "aeee718a71e82e043205279469af1c6884bc6333a528438f0f6fa12fde3fe1a1",
  "src/lib/dmgcalc/utils.ts":
    "0e79095bea4fd3e16d64e306f33701d7750e38eed672967517590eb585827bc6",
  "src/lib/dmgcalc/core/charBuild.ts":
    "2e78712774a25fb6581b5b498b0fe323f91974ea16624740aa03b1e3e626f2a4",
  "src/lib/dmgcalc/core/combo.ts":
    "e09ce763270285f1805e72f7347cd5a56c65c3ea0fc16758fa58fbf31b535bca",
  "src/lib/dmgcalc/core/comboBuffOverrides.ts":
    "623c65023bd11f572eca9e04d7158b70ce237504041992c21058b88504d7a342",
  "src/lib/dmgcalc/core/damageFormula.ts":
    "12284b73d51deae51e6b99d6e79ae75cbeb25b06daf5155ba6e256fe01336764",
  "src/lib/dmgcalc/core/dynamicBuffEval.ts":
    "35ef36d58b6ab297f2065b89da191ee8516fb1d9e77dfd5f4a660b80cab9df11",
  "src/lib/dmgcalc/core/expr.ts":
    "1f408cc800ab5f3493ffba9e54e51350cbed13939f7d5c1e60749b22be91616c",
  "src/lib/dmgcalc/core/exprStatSheet.ts":
    "3569cfb82143c617f9f39f71ccc48472b8747eaeccea941129a4811834951370",
  "src/lib/dmgcalc/core/fieldState.ts":
    "5f962130bde4c9a8520bfa9d680a2a7974b020a0e520242353360e1b4dbaae5f",
  "src/lib/dmgcalc/core/formulaCompiler.ts":
    "0bfca4750fdceda75df8080df977e1c2f6e942b46e14c037bb4928525233beb3",
  "src/lib/dmgcalc/core/formulaEval.ts":
    "440a0096660c2b30b2879c25f5d49496877f7e75cc75a214163ffb27185d3402",
  "src/lib/dmgcalc/core/implModel.ts":
    "239afd2965af55921c3419eb9fe4a61d65570edbc879ab57ae00ccde9d259a65",
  "src/lib/dmgcalc/core/marginalGain.ts":
    "394f7791aa1df123ea8c75d89b02903f3972cf4daa088eb6a83395892d868413",
  "src/lib/dmgcalc/core/registry.ts":
    "c80a29a6cea754bb8460bc156dbbe4f6f1c9381782df948e5033505e82da7893",
  "src/lib/dmgcalc/core/stackRank.ts":
    "653a4b3df480af79f4b9ee95dc019f1b6d91506e7384153d11a5a04036a514f6",
  "src/lib/dmgcalc/core/statBuff.ts":
    "b4afe113ab9ed6f815819334beef97979f2acd731559266ea18c128135668a41",
  "src/lib/dmgcalc/core/statSheet.ts":
    "1239c11fe3774ef46c8bafaf9ee1354debca3eab34b4e105bb802477ad4cee10",
  "src/lib/dmgcalc/core/teamBuffLedger.ts":
    "25e3d3efc48ad2a6446c77d7ad01a2607326962c8dd0af5a247621c4931a1578",
  "src/lib/dmgcalc/core/teamBuild.ts":
    "0ad001a80494e76d4a0e1aa4af422145d534b6787191f8ec776d7d42c36a0e29",
  "src/lib/dmgcalc/core/teamExprStatSheet.ts":
    "550b12859436569a4c2f426d2f088e8350123a8ab7490f2e88d9525369ba9c82",
  "src/lib/dmgcalc/core/teamFormulaCatalog.ts":
    "9332f59cb4d04ee8387cbe7e10bf4a0f06284c6004e6d4f8bd786c26dd6347db",
  "src/lib/dmgcalc/core/teamMeta.ts":
    "010fe2e64205719d60f78991d18af67ad6f4750158764917a6dbb072e9be9858",
  "src/lib/dmgcalc/core/teamReaction.ts":
    "85ad4d2ca90fe7c9c083fde10c774745a5021fa6dd6125752b4160b21f308f18",
  "src/lib/dmgcalc/core/teamResonance.ts":
    "9a393d567ba2ec7947e1bb84106f23fd7b1a6f8a068465f4f75636f7932e52f4",
  "src/lib/dmgcalc/core/teamStatSheet.ts":
    "c6e274a95ba207883e81a159e09927bc5666ea5d0a55f88a995de3ea072e43e6",
  "src/lib/dmgcalc/impl/artifact2pc.ts":
    "7000a8bd41d193e11a58b1a77b7846ecde1441503cccfbe429c2beca10fe5b77",
  "src/lib/dmgcalc/impl/artifact4pc.ts":
    "d8b3a69e11cf01e02122f0040b0225ea5860ad520a82429faf2e09a0a71b4948",
  "src/lib/dmgcalc/impl/character5Fontaine.ts":
    "7db2d79b2623ef0a6871f64b5d6ae5c6ac018fedf4e9549b90f524a51859b5eb",
  "src/lib/dmgcalc/impl/character5Liyue.ts":
    "a9fa0c572e3ca1ea8a09e9498c0f7fd5c9bab6a82c854bcd4af0cdc5f08ad264",
  "src/lib/dmgcalc/impl/character5Natlan.ts":
    "2fe28a48b6a6918634bc0c581326e9f971aac5c0aba9b1a2bbfe96572b0d22e2",
  "src/lib/dmgcalc/impl/character5NodKrai.ts":
    "86a07352cef23faaa7de023adcd619eed02b6ba282224cd88a38a565ac583557",
  "src/lib/dmgcalc/impl/helpers.ts":
    "ba17f4585ad579ac9a1dbe14a49387cd1bea23409b343254e1764ef54bec1b08",
  "src/lib/dmgcalc/impl/weapon4Sword.ts":
    "e57306601e6b105fee72b1183383f916f48c2f5cd175e3f503b10c8df24aec79",
  "src/lib/dmgcalc/impl/weapon5Polearm.ts":
    "ba43f6e6e8d4b1483d1460d90d08b93c2a4e995aa0a06cef660f934df2e9718c",
  "src/lib/dmgcalc/impl/weapon5Sword.ts":
    "5e5d0c58eb33b67f51288e167b2a691f4693eedfa7709de00346df243ab3a0a8",
} as const satisfies Record<
  (typeof KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS)[number],
  string
>;

const DELIBERATELY_EXCLUDED_PRODUCER_PATHS = [
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentTechnicalComputation.ts",
  "scripts/guide-factory/src/compute-keqing-ineffa-furina-xilonen-equipment-technical.ts",
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_RELATIVE_PATH,
] as const;

const EXPECTED_SOURCE_PREFLIGHT_REPORT_SHA256 =
  "c0dedcfb87d27dfebeba99d89a26a6ed614f4de536b23d6bef54529b0246155b";
const EXPECTED_RESULT_FINGERPRINT_SHA256 =
  "ea78f4ea4252bd2b39cfe9d99fb0a7ba37d172e2095c628f9df07d82825392b5";
const EXPECTED_GENERIC_REPORT_CONTENT_SHA256 =
  "3b9147e01cb01cc7d321970b3765e9720c28afacbf013653fcddc36e1fa17e6f";
const EXPECTED_GENERIC_STABLE_FULL_REPORT_SHA256 =
  "d2c460e59f55216ec0ff9914f106284d41eee817f65d77f7a241202c7dacf0ed";
const EXPECTED_BOUNDED_TECHNICAL_OBJECTIVE = 926_093.666_196_721;
const EXPECTED_INTACT_TECHNICAL_OBJECTIVE = 914_219.528_685_479;
const EXPECTED_AUTHENTICATED_REPORT_SHA256 =
  "c1e62f94d50be01cb5a8b24f2b419a9e52ecafad6829320e2341322691111063";

const TEAM_RECORD_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const EXACT_CHARACTER_IDS = ["keqing", "ineffa", "furina", "xilonen"] as const;

export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_EXECUTION_POLICY = {
  policyId: "keqing-ineffa-furina-xilonen-bounded-36x4-v1",
  maximumGeneratorInvocations: "144",
  maximumCartesianReplays: "9216",
} as const satisfies BoundedFullTeamEquipmentTechnicalExecutionPolicy;

export type EquipmentTechnicalComputationHashedInput = {
  path: string;
  sha256: string;
};

export type BuildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationInput = {
  sourcePreflight: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport;
  inputFiles: EquipmentTechnicalComputationHashedInput[];
};

export type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationEnvironment = {
  technicalEnvironment?: BoundedFullTeamEquipmentTechnicalComputationEnvironment;
  runTechnicalComputation: typeof runBoundedFullTeamEquipmentTechnicalComputation;
};

const DEFAULT_WRAPPER_ENVIRONMENT: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationEnvironment = {
  runTechnicalComputation: runBoundedFullTeamEquipmentTechnicalComputation,
};

export type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationIssue = {
  code: string;
  stage: "input" | "computation";
  path: string;
  message: string;
};

export type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport = {
  schemaVersion: 1;
  classification:
    "keqing-ineffa-furina-xilonen-bounded-equipment-technical-computation";
  computationId: typeof KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_ID;
  validationStatus:
    | "authenticated-completed-technical-objective-source-not-ready"
    | "not-authenticated";
  generatedFrom: EquipmentTechnicalComputationHashedInput[];
  issues: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationIssue[];
  sourceAuthentication: {
    dependencySetClassification:
      "authenticated-declared-non-self-selected-checkpoint-inputs";
    dependencySetExhaustive: false;
    transitiveModuleGraphClaimed: false;
    deliberatelyExcludedProducerPaths: string[];
    expectedFileCount: number;
    observedFileCount: number;
    exactPathSet: boolean;
    allByteHashesWellFormed: boolean;
    allDeclaredFileHashesMatch: boolean;
    sourcePreflightReportSha256: string;
    sourcePreflightByteHashMatches: boolean;
    sourceSpecificPreflightFullDigestAuthenticated: boolean;
    nestedGenericPreflightAuthenticated: boolean;
    nestedGenericPreflightComplete: boolean;
    authentication: "accepted" | "rejected";
  };
  sourceBoundary: {
    sourceTeamRecordId: typeof TEAM_RECORD_ID;
    exactCharacterIds: string[];
    sourceReadyForDamageReplay: false;
    sourceReadinessBlockerCount: 8;
    objectiveReviewStatus: "unreviewed";
    runtimeAssumptionsOwner: "source-specific-runtime-preflight-wrapper";
    equipmentLatticeCompositionOwner:
      "source-specific-equipment-lattice-wrapper";
    sheetRecombinationOwner: "generic-bounded-technical-computation-core";
    sourcePublishedWholeCandidateCount: 0;
    sourceEvidenceRef: {
      kind: "knowledge_record";
      recordId: typeof TEAM_RECORD_ID;
      supports: ["roster"];
      doesNotSupport: [
        "damage_plan",
        "formula_counts_and_mappings",
        "selected_weapons",
        "selected_artifact_sets",
        "investment",
        "artifact_stats",
      ];
    };
    sourceRotationTextInput: {
      rotationId: "sample-rotation";
      role: "upstream-input-to-unreviewed-wrapper-authored-formula-translation";
      sourceAuthoredFormulaCountsOrMappings: false;
    };
    runtimeAssumptions: {
      characterLevel: 90;
      constellation: 0;
      talentLevels: { auto: 10; skill: 10; burst: 10 };
      enemyLevel: 110;
      enemyResistance: 0.1;
      artifactRollMultiplier: 0.85;
      artifactSubstatBudget: "8_6";
      energyRecoveryThresholds: null;
    };
    gameplayApplicability: "unknown-not-validated";
  };
  executionBoundary: {
    policy: typeof KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_EXECUTION_POLICY;
    runtimeEnvironmentId: "existing-generator-and-replay-runtime-v1";
    nodeCount: 36;
    carryCount: 4;
    plannedGeneratorInvocationCount: 144;
    observedGeneratorInvocationCount: number;
    freshRuntimeIdentityCount: number;
    freshTeamBuildPerGeneratorInvocation: true;
    hardMaximumGeneratorResultEmissionsPerInvocation: 64;
    observedReplayCount: number;
    successfulReplayCount: number;
    completeTechnicalDomain: boolean;
    nodeLocalSheetPoolsOnly: true;
    crossNodeSheetCompositionsAllowed: false;
  };
  provenanceBoundary: {
    compositionCountUnit: "deduplicated-node-local-compositions";
    finiteDomainScope: "complete-for-36-node-local-sheet-products-only";
    candidateSpaceExhaustive: false;
    globalSearchExecuted: false;
    intactGeneratorEndpointCompositionCount: number;
    crossEndpointRecombinationCount: number;
    nodesWithCrossEndpointBoundedTechnicalReference: number;
    allNodeBoundedTechnicalReferencesAreCrossEndpointRecombinations: boolean;
    boundedReferenceDescription: string;
    intactReferenceDescription: string;
  };
  technicalReferenceSummary: {
    genericReportContentSha256: string | null;
    genericStableFullReportSha256: string | null;
    resultFingerprintSha256: string | null;
    objectiveObservationCount: number;
    uniqueExactObjectiveValueCount: number;
    boundedTechnicalReference: BoundedFullTeamEquipmentTechnicalComputationReport["boundedTechnicalReference"];
    intactGeneratorEndpointTechnicalReference: BoundedFullTeamEquipmentTechnicalComputationReport["intactGeneratorEndpointTechnicalReference"];
    boundedOverIntact: {
      absoluteDelta: number | null;
      ratio: number | null;
    };
  };
  capabilities: {
    sourceClaims: false;
    guideClaims: false;
    teamRecommendationClaims: false;
    equipmentRecommendationClaims: false;
    rankClaims: false;
    gameplayClaims: false;
    damageClaims: false;
    dpsClaims: false;
    optimalityClaims: false;
    energyRecoveryClaims: false;
  };
  generatorExecuted: boolean;
  damageComputationExecuted: boolean;
  rankingProduced: false;
  recommendationProduced: false;
  guideProduced: false;
  supportsGuideClaims: false;
  supportsEquipmentRecommendations: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsOptimality: false;
  supportsGameplayApplicabilityClaims: false;
  supportsEnergyRequirements: false;
  promotionEligible: false;
  sourcePreflight: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport | null;
  technicalComputation: BoundedFullTeamEquipmentTechnicalComputationReport | null;
  cautions: string[];
  prohibitedInterpretations: string[];
};

export async function buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
  rawInput: BuildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationInput,
  environment: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationEnvironment =
    DEFAULT_WRAPPER_ENVIRONMENT,
): Promise<KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport> {
  const input = structuredClone(rawInput);
  const generatedFrom = input.inputFiles
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const issues: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationIssue[] = [];
  const authentication = authenticateInputs(
    input.sourcePreflight,
    generatedFrom,
    issues,
  );

  // This gate must remain before bootstrap, generator construction, or replay.
  if (authentication.authentication !== "accepted") {
    return emptyReport(generatedFrom, issues, authentication);
  }

  const nestedPreflight = input.sourcePreflight.runtimePreflight;
  if (!nestedPreflight) {
    throw new Error("Authenticated CP37 preflight unexpectedly lacks its nested runtime preflight.");
  }
  const technicalComputation = await environment.runTechnicalComputation(
    {
      preflight: nestedPreflight,
      executionPolicy: {
        ...KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_EXECUTION_POLICY,
      },
      generatedFrom,
    },
    environment.technicalEnvironment,
  );
  if (!authenticateExpectedTechnicalComputation(technicalComputation)) {
    addIssue(
      issues,
      "computation.unexpected_result",
      "computation",
      "technicalComputation",
      "The bounded runtime result did not close over the exact authenticated CP38 technical domain.",
    );
  }
  if (issues.length > 0) {
    return emptyReport(generatedFrom, issues, authentication, technicalComputation);
  }

  const report = completeReport(
    generatedFrom,
    authentication,
    input.sourcePreflight,
    technicalComputation,
  );
  return report;
}

/** Full byte-level guard plus nested CP37 and generic CP38 semantic guards. */
export function requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
  report: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
): void {
  const sourcePreflight = report.sourcePreflight;
  const technicalComputation = report.technicalComputation;
  let nestedGuardsPass = false;
  try {
    if (!sourcePreflight?.runtimePreflight || !technicalComputation) {
      throw new Error("Nested authenticated inputs are absent.");
    }
    requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
      sourcePreflight,
    );
    requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
      sourcePreflight.runtimePreflight,
    );
    requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
      technicalComputation,
    );
    nestedGuardsPass = true;
  } catch {
    nestedGuardsPass = false;
  }
  const semanticClosure =
    report.validationStatus ===
      "authenticated-completed-technical-objective-source-not-ready" &&
    report.issues.length === 0 &&
    report.sourceAuthentication.authentication === "accepted" &&
    report.sourceAuthentication.dependencySetClassification ===
      "authenticated-declared-non-self-selected-checkpoint-inputs" &&
    !report.sourceAuthentication.dependencySetExhaustive &&
    !report.sourceAuthentication.transitiveModuleGraphClaimed &&
    exactEqual(
      report.sourceAuthentication.deliberatelyExcludedProducerPaths,
      DELIBERATELY_EXCLUDED_PRODUCER_PATHS,
    ) &&
    report.sourceAuthentication.exactPathSet &&
    report.sourceAuthentication.allByteHashesWellFormed &&
    report.sourceAuthentication.allDeclaredFileHashesMatch &&
    report.sourceAuthentication.sourcePreflightByteHashMatches &&
    report.sourceAuthentication.sourceSpecificPreflightFullDigestAuthenticated &&
    report.sourceAuthentication.nestedGenericPreflightAuthenticated &&
    report.sourceAuthentication.nestedGenericPreflightComplete &&
    report.sourceBoundary.sourceTeamRecordId === TEAM_RECORD_ID &&
    exactEqual(report.sourceBoundary.exactCharacterIds, EXACT_CHARACTER_IDS) &&
    !report.sourceBoundary.sourceReadyForDamageReplay &&
    report.sourceBoundary.sourceReadinessBlockerCount === 8 &&
    report.sourceBoundary.objectiveReviewStatus === "unreviewed" &&
    exactEqual(report.sourceBoundary.sourceEvidenceRef.supports, ["roster"]) &&
    exactEqual(report.sourceBoundary.sourceEvidenceRef.doesNotSupport, [
      "damage_plan",
      "formula_counts_and_mappings",
      "selected_weapons",
      "selected_artifact_sets",
      "investment",
      "artifact_stats",
    ]) &&
    report.sourceBoundary.sourceRotationTextInput.role ===
      "upstream-input-to-unreviewed-wrapper-authored-formula-translation" &&
    !report.sourceBoundary.sourceRotationTextInput
      .sourceAuthoredFormulaCountsOrMappings &&
    report.sourceBoundary.equipmentLatticeCompositionOwner ===
      "source-specific-equipment-lattice-wrapper" &&
    report.sourceBoundary.sheetRecombinationOwner ===
      "generic-bounded-technical-computation-core" &&
    exactEqual(report.sourceBoundary.runtimeAssumptions, {
      characterLevel: 90,
      constellation: 0,
      talentLevels: { auto: 10, skill: 10, burst: 10 },
      enemyLevel: 110,
      enemyResistance: 0.1,
      artifactRollMultiplier: 0.85,
      artifactSubstatBudget: "8_6",
      energyRecoveryThresholds: null,
    }) &&
    report.sourceBoundary.sourcePublishedWholeCandidateCount === 0 &&
    report.executionBoundary.nodeCount === 36 &&
    report.executionBoundary.runtimeEnvironmentId ===
      "existing-generator-and-replay-runtime-v1" &&
    report.executionBoundary.carryCount === 4 &&
    report.executionBoundary.plannedGeneratorInvocationCount === 144 &&
    report.executionBoundary.observedGeneratorInvocationCount === 144 &&
    report.executionBoundary.freshRuntimeIdentityCount === 144 &&
    report.executionBoundary.freshTeamBuildPerGeneratorInvocation &&
    report.executionBoundary.hardMaximumGeneratorResultEmissionsPerInvocation ===
      64 &&
    report.executionBoundary.observedReplayCount === 364 &&
    report.executionBoundary.successfulReplayCount === 364 &&
    report.executionBoundary.completeTechnicalDomain &&
    report.executionBoundary.nodeLocalSheetPoolsOnly &&
    !report.executionBoundary.crossNodeSheetCompositionsAllowed &&
    report.provenanceBoundary.compositionCountUnit ===
      "deduplicated-node-local-compositions" &&
    report.provenanceBoundary.finiteDomainScope ===
      "complete-for-36-node-local-sheet-products-only" &&
    !report.provenanceBoundary.candidateSpaceExhaustive &&
    !report.provenanceBoundary.globalSearchExecuted &&
    report.provenanceBoundary.intactGeneratorEndpointCompositionCount === 139 &&
    report.provenanceBoundary.crossEndpointRecombinationCount === 225 &&
    report.provenanceBoundary.nodesWithCrossEndpointBoundedTechnicalReference ===
      36 &&
    report.provenanceBoundary
      .allNodeBoundedTechnicalReferencesAreCrossEndpointRecombinations &&
    report.technicalReferenceSummary.resultFingerprintSha256 ===
      EXPECTED_RESULT_FINGERPRINT_SHA256 &&
    report.technicalReferenceSummary.genericReportContentSha256 ===
      EXPECTED_GENERIC_REPORT_CONTENT_SHA256 &&
    report.technicalReferenceSummary.genericStableFullReportSha256 ===
      EXPECTED_GENERIC_STABLE_FULL_REPORT_SHA256 &&
    report.technicalReferenceSummary.objectiveObservationCount === 364 &&
    report.technicalReferenceSummary.uniqueExactObjectiveValueCount === 364 &&
    report.technicalReferenceSummary.boundedTechnicalReference
      ?.unreviewedTechnicalObjective === EXPECTED_BOUNDED_TECHNICAL_OBJECTIVE &&
    report.technicalReferenceSummary.boundedTechnicalReference.provenance ===
      "cross-endpoint-recombination" &&
    report.technicalReferenceSummary.intactGeneratorEndpointTechnicalReference
      ?.unreviewedTechnicalObjective === EXPECTED_INTACT_TECHNICAL_OBJECTIVE &&
    report.technicalReferenceSummary.intactGeneratorEndpointTechnicalReference
      .provenance === "intact-generator-endpoint" &&
    exactEqual(report.capabilities, fixedCapabilities()) &&
    report.generatorExecuted &&
    report.damageComputationExecuted &&
    !report.rankingProduced &&
    !report.recommendationProduced &&
    !report.guideProduced &&
    !report.supportsGuideClaims &&
    !report.supportsEquipmentRecommendations &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsOptimality &&
    !report.supportsGameplayApplicabilityClaims &&
    !report.supportsEnergyRequirements &&
    !report.promotionEligible &&
    sourcePreflight !== null &&
    technicalComputation !== null &&
    nestedGuardsPass &&
    authenticateExpectedTechnicalComputation(technicalComputation);
  if (
    !semanticClosure ||
    sha256Text(stableJson(report)) !== EXPECTED_AUTHENTICATED_REPORT_SHA256
  ) {
    throw new Error(
      "Refusing unauthenticated or mutated Keqing/Ineffa/Furina/Xilonen bounded equipment technical computation report.",
    );
  }
}

function authenticateInputs(
  sourcePreflight: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
  generatedFrom: EquipmentTechnicalComputationHashedInput[],
  issues: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationIssue[],
): KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport["sourceAuthentication"] {
  const expectedPaths = [
    ...KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS,
  ].sort((left, right) => left.localeCompare(right));
  const observedPaths = generatedFrom.map(({ path: inputPath }) => inputPath);
  const exactPathSet = exactEqual(observedPaths, expectedPaths);
  const allByteHashesWellFormed = generatedFrom.every(({ sha256 }) =>
    SHA256.test(sha256),
  );
  const allDeclaredFileHashesMatch =
    exactPathSet &&
    generatedFrom.every(
      ({ path: inputPath, sha256 }) =>
        EXPECTED_INPUT_FILE_SHA256[
          inputPath as keyof typeof EXPECTED_INPUT_FILE_SHA256
        ] === sha256,
    );
  const sourcePreflightReportSha256 = sha256Text(stableJson(sourcePreflight));
  const sourcePreflightByteHashMatches =
    sourcePreflightReportSha256 === EXPECTED_SOURCE_PREFLIGHT_REPORT_SHA256 &&
    generatedFrom.find(
      ({ path: inputPath }) =>
        inputPath ===
        "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json",
    )?.sha256 === EXPECTED_SOURCE_PREFLIGHT_REPORT_SHA256;
  let sourceSpecificPreflightFullDigestAuthenticated = false;
  let nestedGenericPreflightAuthenticated = false;
  let nestedGenericPreflightComplete = false;
  try {
    requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
      sourcePreflight,
    );
    sourceSpecificPreflightFullDigestAuthenticated = true;
  } catch {
    sourceSpecificPreflightFullDigestAuthenticated = false;
  }
  if (sourcePreflight.runtimePreflight) {
    try {
      requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
        sourcePreflight.runtimePreflight,
      );
      nestedGenericPreflightAuthenticated = true;
      nestedGenericPreflightComplete =
        isCompleteSourceBackedEquipmentRuntimePreflightReport(
          sourcePreflight.runtimePreflight,
        );
    } catch {
      nestedGenericPreflightAuthenticated = false;
      nestedGenericPreflightComplete = false;
    }
  }
  if (!exactPathSet) {
    addIssue(
      issues,
      "input.path_set_mismatch",
      "input",
      "inputFiles",
      "Declared CP38 checkpoint inputs must match the exact non-self selected path set.",
    );
  }
  if (!allByteHashesWellFormed) {
    addIssue(
      issues,
      "input.malformed_hash",
      "input",
      "inputFiles",
      "Every CP38 checkpoint byte hash must be a lowercase SHA-256 digest.",
    );
  }
  if (!allDeclaredFileHashesMatch) {
    addIssue(
      issues,
      "input.hash_mismatch",
      "input",
      "inputFiles",
      "At least one declared CP38 checkpoint input differs from its authenticated byte hash.",
    );
  }
  if (!sourcePreflightByteHashMatches) {
    addIssue(
      issues,
      "input.source_preflight_byte_mismatch",
      "input",
      "sourcePreflight",
      "The supplied CP37 source-specific report does not match its committed durable bytes.",
    );
  }
  if (
    !sourceSpecificPreflightFullDigestAuthenticated ||
    !nestedGenericPreflightAuthenticated ||
    !nestedGenericPreflightComplete
  ) {
    addIssue(
      issues,
      "input.source_preflight_unauthenticated",
      "input",
      "sourcePreflight",
      "The CP37 source-specific report and its exact nested generic preflight must both authenticate and be complete.",
    );
  }
  return {
    dependencySetClassification:
      "authenticated-declared-non-self-selected-checkpoint-inputs",
    dependencySetExhaustive: false,
    transitiveModuleGraphClaimed: false,
    deliberatelyExcludedProducerPaths: [...DELIBERATELY_EXCLUDED_PRODUCER_PATHS],
    expectedFileCount: expectedPaths.length,
    observedFileCount: generatedFrom.length,
    exactPathSet,
    allByteHashesWellFormed,
    allDeclaredFileHashesMatch,
    sourcePreflightReportSha256,
    sourcePreflightByteHashMatches,
    sourceSpecificPreflightFullDigestAuthenticated,
    nestedGenericPreflightAuthenticated,
    nestedGenericPreflightComplete,
    authentication: issues.length === 0 ? "accepted" : "rejected",
  };
}

function authenticateExpectedTechnicalComputation(
  report: BoundedFullTeamEquipmentTechnicalComputationReport,
): boolean {
  try {
    requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
      report,
    );
  } catch {
    return false;
  }
  return (
    isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(report) &&
    report.validationStatus === "completed-technical-objective" &&
    report.comparisonStatus === "comparable" &&
    report.issues.length === 0 &&
    report.inputBoundary.nodeCount === 36 &&
    exactEqual(report.inputBoundary.teamCharacterIds, EXACT_CHARACTER_IDS) &&
    exactEqual(report.inputBoundary.carryCharacterIds, EXACT_CHARACTER_IDS) &&
    report.inputBoundary.objectiveReviewStatus === "unreviewed" &&
    report.inputBoundary.sourceBindingEstablishedByCaller === true &&
    report.inputBoundary.sourceReadyForDamageReplay === false &&
    report.inputBoundary.sourceReadinessBlockerCount === 8 &&
    exactEqual(
      report.inputBoundary.executionPolicy,
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_EXECUTION_POLICY,
    ) &&
    exactEqual(report.generatedFrom, expectedGeneratedFrom()) &&
    report.execution.environmentId ===
      "existing-generator-and-replay-runtime-v1" &&
    report.execution.freshRuntimeIdentityPerGeneratorInvocation &&
    report.execution.hardMaximumGeneratorResultEmissionsPerInvocation ===
      "64" &&
    report.execution.plannedGeneratorInvocations === "144" &&
    report.execution.maximumGeneratorInvocations === "144" &&
    report.execution.maximumCartesianReplays === "9216" &&
    report.execution.theoreticalMaximumCartesianReplays === "9216" &&
    report.execution.observedGeneratorInvocations === 144 &&
    report.execution.freshRuntimeIdentityCount === 144 &&
    report.execution.capturedGeneratorResultCount === 144 &&
    report.execution.fullDomainExpectedReplayCount === "364" &&
    report.execution.observedReplayCalls === 364 &&
    report.execution.successfulReplayCount === 364 &&
    report.provenanceSummary.intactGeneratorEndpointCompositionCount === 139 &&
    report.provenanceSummary.crossEndpointRecombinationCount === 225 &&
    report.nodes.length === 36 &&
    report.nodes.every(
      ({ comparisonStatus, boundedTechnicalReference }) =>
        comparisonStatus === "comparable" &&
        boundedTechnicalReference?.provenance ===
          "cross-endpoint-recombination",
    ) &&
    report.objectiveDistribution?.scope === "complete-domain" &&
    report.objectiveDistribution.observationCount === 364 &&
    report.objectiveDistribution.uniqueExactValueCount === 364 &&
    report.boundedTechnicalReference?.unreviewedTechnicalObjective ===
      EXPECTED_BOUNDED_TECHNICAL_OBJECTIVE &&
    report.boundedTechnicalReference.provenance ===
      "cross-endpoint-recombination" &&
    report.intactGeneratorEndpointTechnicalReference
      ?.unreviewedTechnicalObjective === EXPECTED_INTACT_TECHNICAL_OBJECTIVE &&
    report.intactGeneratorEndpointTechnicalReference.provenance ===
      "intact-generator-endpoint" &&
    report.authentication.resultFingerprintSha256 ===
      EXPECTED_RESULT_FINGERPRINT_SHA256 &&
    report.authentication.reportContentSha256 ===
      EXPECTED_GENERIC_REPORT_CONTENT_SHA256 &&
    sha256Text(stableJson(report)) ===
      EXPECTED_GENERIC_STABLE_FULL_REPORT_SHA256 &&
    exactEqual(report.capabilities, fixedCapabilities()) &&
    report.generatorExecuted &&
    report.damageComputationExecuted &&
    !report.rankingProduced &&
    !report.recommendationProduced &&
    !report.guideProduced &&
    !report.optimizerExecuted &&
    !report.energyRecoveryInputsUsed &&
    !report.supportsGuideClaims &&
    !report.supportsEquipmentRecommendations &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsOptimality &&
    !report.supportsEnergyRequirements
  );
}

function completeReport(
  generatedFrom: EquipmentTechnicalComputationHashedInput[],
  sourceAuthentication: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport["sourceAuthentication"],
  sourcePreflight: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
  technicalComputation: BoundedFullTeamEquipmentTechnicalComputationReport,
): KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport {
  const bounded = technicalComputation.boundedTechnicalReference;
  const intact =
    technicalComputation.intactGeneratorEndpointTechnicalReference;
  return {
    schemaVersion: 1,
    classification:
      "keqing-ineffa-furina-xilonen-bounded-equipment-technical-computation",
    computationId:
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_ID,
    validationStatus:
      "authenticated-completed-technical-objective-source-not-ready",
    generatedFrom,
    issues: [],
    sourceAuthentication,
    sourceBoundary: fixedSourceBoundary(),
    executionBoundary: {
      policy: {
        ...KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_EXECUTION_POLICY,
      },
      runtimeEnvironmentId: "existing-generator-and-replay-runtime-v1",
      nodeCount: 36,
      carryCount: 4,
      plannedGeneratorInvocationCount: 144,
      observedGeneratorInvocationCount:
        technicalComputation.execution.observedGeneratorInvocations,
      freshRuntimeIdentityCount:
        technicalComputation.execution.freshRuntimeIdentityCount,
      freshTeamBuildPerGeneratorInvocation: true,
      hardMaximumGeneratorResultEmissionsPerInvocation: 64,
      observedReplayCount: technicalComputation.execution.observedReplayCalls,
      successfulReplayCount:
        technicalComputation.execution.successfulReplayCount,
      completeTechnicalDomain:
        technicalComputation.comparisonStatus === "comparable",
      nodeLocalSheetPoolsOnly: true,
      crossNodeSheetCompositionsAllowed: false,
    },
    provenanceBoundary: {
      compositionCountUnit: "deduplicated-node-local-compositions",
      finiteDomainScope: "complete-for-36-node-local-sheet-products-only",
      candidateSpaceExhaustive: false,
      globalSearchExecuted: false,
      intactGeneratorEndpointCompositionCount:
        technicalComputation.provenanceSummary
          .intactGeneratorEndpointCompositionCount,
      crossEndpointRecombinationCount:
        technicalComputation.provenanceSummary.crossEndpointRecombinationCount,
      nodesWithCrossEndpointBoundedTechnicalReference:
        technicalComputation.nodes.filter(
          ({ boundedTechnicalReference }) =>
            boundedTechnicalReference?.provenance ===
            "cross-endpoint-recombination",
        ).length,
      allNodeBoundedTechnicalReferencesAreCrossEndpointRecombinations:
        technicalComputation.nodes.every(
          ({ boundedTechnicalReference }) =>
            boundedTechnicalReference?.provenance ===
            "cross-endpoint-recombination",
        ),
      boundedReferenceDescription:
        "Maximum of the exact bounded node-local cross-endpoint sheet product under the unreviewed technical objective; not a generator endpoint, rank, recommendation, damage claim, or optimum outside this finite domain.",
      intactReferenceDescription:
        "Maximum among the captured intact four-character generator endpoints under the same unreviewed technical objective; not a source-authored build, rank, recommendation, gameplay claim, or global optimum.",
    },
    technicalReferenceSummary: {
      genericReportContentSha256:
        technicalComputation.authentication.reportContentSha256,
      genericStableFullReportSha256: sha256Text(
        stableJson(technicalComputation),
      ),
      resultFingerprintSha256:
        technicalComputation.authentication.resultFingerprintSha256,
      objectiveObservationCount:
        technicalComputation.objectiveDistribution?.observationCount ?? 0,
      uniqueExactObjectiveValueCount:
        technicalComputation.objectiveDistribution?.uniqueExactValueCount ?? 0,
      boundedTechnicalReference: bounded,
      intactGeneratorEndpointTechnicalReference: intact,
      boundedOverIntact: {
        absoluteDelta:
          bounded && intact
            ? bounded.unreviewedTechnicalObjective -
              intact.unreviewedTechnicalObjective
            : null,
        ratio:
          bounded && intact && intact.unreviewedTechnicalObjective !== 0
            ? bounded.unreviewedTechnicalObjective /
              intact.unreviewedTechnicalObjective
            : null,
      },
    },
    capabilities: fixedCapabilities(),
    generatorExecuted: true,
    damageComputationExecuted: true,
    rankingProduced: false,
    recommendationProduced: false,
    guideProduced: false,
    supportsGuideClaims: false,
    supportsEquipmentRecommendations: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsOptimality: false,
    supportsGameplayApplicabilityClaims: false,
    supportsEnergyRequirements: false,
    promotionEligible: false,
    sourcePreflight,
    technicalComputation,
    cautions: fixedCautions(),
    prohibitedInterpretations: fixedProhibitedInterpretations(),
  };
}

function emptyReport(
  generatedFrom: EquipmentTechnicalComputationHashedInput[],
  issues: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationIssue[],
  sourceAuthentication: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport["sourceAuthentication"],
  technicalComputation: BoundedFullTeamEquipmentTechnicalComputationReport | null = null,
): KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport {
  return {
    schemaVersion: 1,
    classification:
      "keqing-ineffa-furina-xilonen-bounded-equipment-technical-computation",
    computationId:
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_ID,
    validationStatus: "not-authenticated",
    generatedFrom,
    issues,
    sourceAuthentication,
    sourceBoundary: fixedSourceBoundary(),
    executionBoundary: {
      policy: {
        ...KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_EXECUTION_POLICY,
      },
      runtimeEnvironmentId: "existing-generator-and-replay-runtime-v1",
      nodeCount: 36,
      carryCount: 4,
      plannedGeneratorInvocationCount: 144,
      observedGeneratorInvocationCount:
        technicalComputation?.execution.observedGeneratorInvocations ?? 0,
      freshRuntimeIdentityCount:
        technicalComputation?.execution.freshRuntimeIdentityCount ?? 0,
      freshTeamBuildPerGeneratorInvocation: true,
      hardMaximumGeneratorResultEmissionsPerInvocation: 64,
      observedReplayCount:
        technicalComputation?.execution.observedReplayCalls ?? 0,
      successfulReplayCount:
        technicalComputation?.execution.successfulReplayCount ?? 0,
      completeTechnicalDomain: false,
      nodeLocalSheetPoolsOnly: true,
      crossNodeSheetCompositionsAllowed: false,
    },
    provenanceBoundary: {
      compositionCountUnit: "deduplicated-node-local-compositions",
      finiteDomainScope: "complete-for-36-node-local-sheet-products-only",
      candidateSpaceExhaustive: false,
      globalSearchExecuted: false,
      intactGeneratorEndpointCompositionCount: 0,
      crossEndpointRecombinationCount: 0,
      nodesWithCrossEndpointBoundedTechnicalReference: 0,
      allNodeBoundedTechnicalReferencesAreCrossEndpointRecombinations: false,
      boundedReferenceDescription:
        "Withheld because the source boundary or technical computation did not authenticate.",
      intactReferenceDescription:
        "Withheld because the source boundary or technical computation did not authenticate.",
    },
    technicalReferenceSummary: {
      genericReportContentSha256: null,
      genericStableFullReportSha256: null,
      resultFingerprintSha256: null,
      objectiveObservationCount: 0,
      uniqueExactObjectiveValueCount: 0,
      boundedTechnicalReference: null,
      intactGeneratorEndpointTechnicalReference: null,
      boundedOverIntact: { absoluteDelta: null, ratio: null },
    },
    capabilities: fixedCapabilities(),
    generatorExecuted:
      technicalComputation?.generatorExecuted === true,
    damageComputationExecuted:
      technicalComputation?.damageComputationExecuted === true,
    rankingProduced: false,
    recommendationProduced: false,
    guideProduced: false,
    supportsGuideClaims: false,
    supportsEquipmentRecommendations: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsOptimality: false,
    supportsGameplayApplicabilityClaims: false,
    supportsEnergyRequirements: false,
    promotionEligible: false,
    sourcePreflight: null,
    technicalComputation,
    cautions: fixedCautions(),
    prohibitedInterpretations: fixedProhibitedInterpretations(),
  };
}

function fixedCapabilities(): KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport["capabilities"] {
  return {
    sourceClaims: false,
    guideClaims: false,
    teamRecommendationClaims: false,
    equipmentRecommendationClaims: false,
    rankClaims: false,
    gameplayClaims: false,
    damageClaims: false,
    dpsClaims: false,
    optimalityClaims: false,
    energyRecoveryClaims: false,
  };
}

function fixedSourceBoundary(): KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport["sourceBoundary"] {
  return {
    sourceTeamRecordId: TEAM_RECORD_ID,
    exactCharacterIds: [...EXACT_CHARACTER_IDS],
    sourceReadyForDamageReplay: false,
    sourceReadinessBlockerCount: 8,
    objectiveReviewStatus: "unreviewed",
    runtimeAssumptionsOwner: "source-specific-runtime-preflight-wrapper",
    equipmentLatticeCompositionOwner:
      "source-specific-equipment-lattice-wrapper",
    sheetRecombinationOwner: "generic-bounded-technical-computation-core",
    sourcePublishedWholeCandidateCount: 0,
    sourceEvidenceRef: {
      kind: "knowledge_record",
      recordId: TEAM_RECORD_ID,
      supports: ["roster"],
      doesNotSupport: [
        "damage_plan",
        "formula_counts_and_mappings",
        "selected_weapons",
        "selected_artifact_sets",
        "investment",
        "artifact_stats",
      ],
    },
    sourceRotationTextInput: {
      rotationId: "sample-rotation",
      role: "upstream-input-to-unreviewed-wrapper-authored-formula-translation",
      sourceAuthoredFormulaCountsOrMappings: false,
    },
    runtimeAssumptions: {
      characterLevel: 90,
      constellation: 0,
      talentLevels: { auto: 10, skill: 10, burst: 10 },
      enemyLevel: 110,
      enemyResistance: 0.1,
      artifactRollMultiplier: 0.85,
      artifactSubstatBudget: "8_6",
      energyRecoveryThresholds: null,
    },
    gameplayApplicability: "unknown-not-validated",
  };
}

function fixedCautions(): string[] {
  return [
    "The knowledge record supports only the four-character roster. Its rotation text is an upstream input to an unreviewed wrapper-authored formula translation; the record contains no source-authored damage plan, formula counts, or formula mappings.",
    "The technical objective remains unreviewed and source-not-ready with eight retained mapping, duration, hit-count, and trigger-ownership blockers.",
    "All 36 bounded technical references are cross-endpoint recombinations. They were evaluated by the replay runtime but were not emitted intact by one generator invocation.",
    "Successful calculator execution does not establish rotation order, buff timing coverage, field time, reaction ownership, gameplay applicability, DPS, or source-backed damage.",
    "No rank, recommendation, guide, optimality, publication, promotion, or ER capability is produced.",
  ];
}

function expectedGeneratedFrom(): EquipmentTechnicalComputationHashedInput[] {
  return KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS.map(
    (inputPath) => ({
      path: inputPath,
      sha256: EXPECTED_INPUT_FILE_SHA256[inputPath],
    }),
  ).sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
}

function fixedProhibitedInterpretations(): string[] {
  return [
    "Do not present either technical reference as a best build, best team, ranking, recommendation, guide, source claim, DPS result, gameplay result, or global optimum.",
    "Do not attribute wrapper-authored levels, talents, enemy context, artifact budget, weapon choices, artifact choices, or cross-endpoint recombinations to KQM.",
    "Do not call a cross-endpoint recombination generator-produced; only intact-generator-endpoint observations reproduce one complete captured endpoint.",
    "Do not infer ER floors or rotation feasibility from this computation.",
  ];
}

function addIssue(
  issues: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationIssue[],
  code: string,
  stage: "input" | "computation",
  pathValue: string,
  message: string,
): void {
  issues.push({ code, stage, path: pathValue, message });
}

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}
