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
  "src/stores/betaState.ts",
  "src/generated/catalog/characterInfo.ts",
  "src/config/gameConstants.ts",
  "src/domain/enums.ts",
  "src/generated/catalog/artifact_stat.json",
  "src/generated/catalog/character_stats.json",
  "src/generated/catalog/weapon_stats.json",
  "src/lib/resources/cache.ts",
  "src/domain/reference/catalog.ts",
  "src/providers/reference/statLoaders.ts",
  "src/generated/catalog/resources.ts",
  "src/generated/catalog/resources_beta.ts",
  "src/domain/build/statUtils.ts",
  "src/domain/build/artifact/scoring/constants.ts",
  "src/domain/build/artifact/scoring/sheetBuilder.ts",
  "src/domain/build/artifact/scoring/utils.ts",
  "src/domain/combat/generator/constrainedGreedy.ts",
  "src/domain/combat/generator/generator.ts",
  "src/domain/combat/generator/substatBudget.ts",
  "src/domain/combat/optimizer/erCrConstraints.ts",
  "src/domain/team/teamConfigUtils.ts",
  "src/domain/combat/damage/index.ts",
  "src/domain/combat/damage/constants.ts",
  "src/domain/combat/damage/utils.ts",
  "src/domain/combat/damage/core/charBuild.ts",
  "src/domain/combat/damage/core/combo.ts",
  "src/domain/combat/damage/core/comboBuffOverrides.ts",
  "src/domain/combat/damage/core/damageFormula.ts",
  "src/domain/combat/damage/core/dynamicBuffEval.ts",
  "src/domain/combat/damage/core/expr.ts",
  "src/domain/combat/damage/core/exprStatSheet.ts",
  "src/domain/combat/damage/core/fieldState.ts",
  "src/domain/combat/damage/core/formulaCompiler.ts",
  "src/domain/combat/damage/core/formulaEval.ts",
  "src/domain/combat/damage/core/implModel.ts",
  "src/domain/combat/damage/core/marginalGain.ts",
  "src/domain/combat/damage/core/registry.ts",
  "src/domain/combat/damage/core/stackRank.ts",
  "src/domain/combat/damage/core/statBuff.ts",
  "src/domain/combat/damage/core/statSheet.ts",
  "src/domain/combat/damage/core/teamBuffLedger.ts",
  "src/domain/combat/damage/core/teamBuild.ts",
  "src/domain/combat/damage/core/teamExprStatSheet.ts",
  "src/domain/combat/damage/core/teamFormulaCatalog.ts",
  "src/domain/combat/damage/core/teamMeta.ts",
  "src/domain/combat/damage/core/teamReaction.ts",
  "src/domain/combat/damage/core/teamResonance.ts",
  "src/domain/combat/damage/core/teamStatSheet.ts",
  "src/domain/combat/damage/impl/artifact2pc.ts",
  "src/domain/combat/damage/impl/artifact4pc.ts",
  "src/domain/combat/damage/impl/character5Fontaine.ts",
  "src/domain/combat/damage/impl/character5Liyue.ts",
  "src/domain/combat/damage/impl/character5Natlan.ts",
  "src/domain/combat/damage/impl/character5NodKrai.ts",
  "src/domain/combat/damage/impl/helpers.ts",
  "src/domain/combat/damage/impl/weapon4Sword.ts",
  "src/domain/combat/damage/impl/weapon5Polearm.ts",
  "src/domain/combat/damage/impl/weapon5Sword.ts",
] as const;

const EXPECTED_INPUT_FILE_SHA256 = {
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json":
    "00377729276cd5f53271e60c6bad1db819622e66a594c44e232987fb73482d59",
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentRuntimePreflight.ts":
    "a95dc3dc7e9556ae228338a8be021b83520cbcd1838f9cee13e1e2fe7a229726",
  "scripts/guide-factory/src/sourceBackedEquipmentRuntimePreflight.ts":
    "9810032c3ec3067720ac62cd934ee0e3a161d1ab73869788b7f75666a2090cfd",
  "scripts/guide-factory/src/boundedFullTeamEquipmentTechnicalComputation.ts":
    "e5eb39fbc0e6940bab2c7c10420fcb7873e0f93a3e0097ef47f1082af1a3017c",
  "scripts/guide-factory/src/computationReplay.ts":
    "3c974458435a61938dadba8f7bc0be43467a3382c0ac2175210d6f65aa3074ff",
  "scripts/guide-factory/src/io.ts":
    "c5a691734e8a65219ec43254c7f08fd5df5c4819fe023c84e79f41ce3ed5c553",
  "src/stores/betaState.ts":
    "68af501983f02b9db6700c494147ae0765c2c0daf1d243ae19bfe9f7f690994e",
  "src/generated/catalog/characterInfo.ts":
    "b38abdfe2436e8063697d1d10bcbf4894a60368c4da525f1a3572622c19f3aeb",
  "src/config/gameConstants.ts":
    "432240461c5d88c19b8f55d924cbd480f0594b701eb98dc2f08b0d83e90dd72d",
  "src/domain/enums.ts":
    "50ba2322815509b90e3a45a8e2c35889d73385279e38955afc75fab4cac8070a",
  "src/generated/catalog/artifact_stat.json":
    "b2b6fcee736e7be28228f70a9d7624bc80bfce809c7a450377b46f0eef103f67",
  "src/generated/catalog/character_stats.json":
    "74a3bd262f9ff26f1777f9a3a50ccf13bb2a7906f51030adde7fe1b756d96033",
  "src/generated/catalog/weapon_stats.json":
    "62821edb2b6e1b9be888a7330edc020f5f4c397e3329693f9ca2f23406d6b36c",
  "src/lib/resources/cache.ts":
    "b156981a5e4b55b580a3a78cecd87c48c566efbfd5122cba8d7db7475d183577",
  "src/domain/reference/catalog.ts":
    "ffaaa71669580a7972dfda2f7a431a4b0885c36ac03220ff42a242112ebe3308",
  "src/providers/reference/statLoaders.ts":
    "01940c5233c94d915d2c17dcc920aabe79f2fa57add4f4df8a182af8d35b4acd",
  "src/generated/catalog/resources.ts":
    "7a6c531254b0943d430c72ac51ad52c49657715dcd3d9ee14ccdfd506ccb191a",
  "src/generated/catalog/resources_beta.ts":
    "beaa526631c00e6d796b87e1cceae358abeee1a3ced078a4002e524b932b2d60",
  "src/domain/build/statUtils.ts":
    "b855aba1f83d0bb07472652711f2a1490bc97de58cbd2bf202a5c5d1877866fe",
  "src/domain/build/artifact/scoring/constants.ts":
    "0695870e54aaed24d741c8f93d5769f2a3080fe71558b1ad0f7a97ab4a4d6375",
  "src/domain/build/artifact/scoring/sheetBuilder.ts":
    "6e9eb28df3f57c39cb2702fad3bcfcc75a609efcad5cd68b27c3c576a65b8d43",
  "src/domain/build/artifact/scoring/utils.ts":
    "647cef3ef7fbfdb825bf85bb9e9279e967178a55737592925c503c54a9303048",
  "src/domain/combat/generator/constrainedGreedy.ts":
    "5adeaa8256d9166242af2eccf9fbdfb073da23bc159272f907857810e91afc47",
  "src/domain/combat/generator/generator.ts":
    "c7f83fdfd7aeba31c98a50ff4c8a6504a32a0cb601c7326cacd0359aa336e8e6",
  "src/domain/combat/generator/substatBudget.ts":
    "6cc97c792d1e671135f44c268cb2bf4b3e3eb8ea51328c94099078745e73d1b9",
  "src/domain/combat/optimizer/erCrConstraints.ts":
    "a994002ead3cca1ee5275fdec62618dd713ef5ca5081f8547655dfc1e4e36916",
  "src/domain/team/teamConfigUtils.ts":
    "83bfc4d8b70033125b62b8ac545fa8e14786aef885cbaa59119f96e67625a3ef",
  "src/domain/combat/damage/index.ts":
    "00c92a2f1f53f5c9d21d7f57afbe992563c0105e466cc81aa17f17840b3c0cab",
  "src/domain/combat/damage/constants.ts":
    "d8548a6174124f7e50edf9de43015e865b7ef0129140d759ed73642d99db6932",
  "src/domain/combat/damage/utils.ts":
    "5035a4dbe92700892e876a05790636a460791a5497814339bc6d97a3885fa00f",
  "src/domain/combat/damage/core/charBuild.ts":
    "9ae06e5424b7ab087856c5f622828701c79f3361f9de47e607d7d17387dfdd15",
  "src/domain/combat/damage/core/combo.ts":
    "b459aeb9103ef6de2330bb221a1cbf8c04205bb35c22193e0c02a6848751c2c6",
  "src/domain/combat/damage/core/comboBuffOverrides.ts":
    "971a590e6cdf6e5d18a46877d46c559a672113431f2c28347be0be0c959ae148",
  "src/domain/combat/damage/core/damageFormula.ts":
    "bb126130f6a2713f909b6a1324552a61c1873ced3b56890583b0a02d2eaebed0",
  "src/domain/combat/damage/core/dynamicBuffEval.ts":
    "46ee5420e868687c124b0ae164639b8faaa15131af537aec153e35d575294e78",
  "src/domain/combat/damage/core/expr.ts":
    "1f408cc800ab5f3493ffba9e54e51350cbed13939f7d5c1e60749b22be91616c",
  "src/domain/combat/damage/core/exprStatSheet.ts":
    "179f93f15cc5c301f64194267318453357a8ec869d90acea76992cfbdb8d2541",
  "src/domain/combat/damage/core/fieldState.ts":
    "5f962130bde4c9a8520bfa9d680a2a7974b020a0e520242353360e1b4dbaae5f",
  "src/domain/combat/damage/core/formulaCompiler.ts":
    "9660463da2084a28eeda3b14604e2a48349b7e3056256ede56e5c69a3eac150d",
  "src/domain/combat/damage/core/formulaEval.ts":
    "440a0096660c2b30b2879c25f5d49496877f7e75cc75a214163ffb27185d3402",
  "src/domain/combat/damage/core/implModel.ts":
    "f62785b391ea48753fdb51a8265a2aa742990b941af3cfb4e6d6a40978dbcd42",
  "src/domain/combat/damage/core/marginalGain.ts":
    "7236a68dba53adf9902006cf54947c07a85fd32a9d4ba97f692a79e28a4797eb",
  "src/domain/combat/damage/core/registry.ts":
    "36ae833c856559d44c5092fcf35238c03c7262473e3874b5e9deebac098380c6",
  "src/domain/combat/damage/core/stackRank.ts":
    "5d78bde954704c23e73a0de51c8189bf6f3810731eaac2c7ef5ba7a2a7d589ef",
  "src/domain/combat/damage/core/statBuff.ts":
    "c35c696cd07d2073c438e5225849ba745577a268d8db985ab77f32f285ac963d",
  "src/domain/combat/damage/core/statSheet.ts":
    "a20b5a421d02be52785ab48ae52eb67c62910c10c64fea9298e3075c789660c5",
  "src/domain/combat/damage/core/teamBuffLedger.ts":
    "25e3d3efc48ad2a6446c77d7ad01a2607326962c8dd0af5a247621c4931a1578",
  "src/domain/combat/damage/core/teamBuild.ts":
    "1f57bedcb89de09ea2bd096e5c09c9b65e61fd21a8b5559fba0561110f866180",
  "src/domain/combat/damage/core/teamExprStatSheet.ts":
    "2be7fb4db92ae02d46f3468752cb2f18485ad3e1eb2fec31afd810e7f41bd259",
  "src/domain/combat/damage/core/teamFormulaCatalog.ts":
    "fc181e07e43e28c6462b9237977630feb7eeceef57fba56d7ff11d3e49c686cd",
  "src/domain/combat/damage/core/teamMeta.ts":
    "f83591945518a8650a3ee8ceb73e5eab28c6670f91e6042b293357af07e2ab44",
  "src/domain/combat/damage/core/teamReaction.ts":
    "f2889b2933b63872dc890a651d6d54c9a05c360e489c1c6edb2e286244a20b0c",
  "src/domain/combat/damage/core/teamResonance.ts":
    "3760b885c4ee8d867701f5914fea4481526f84753db43419fc8e4f12dea3dbed",
  "src/domain/combat/damage/core/teamStatSheet.ts":
    "c6e274a95ba207883e81a159e09927bc5666ea5d0a55f88a995de3ea072e43e6",
  "src/domain/combat/damage/impl/artifact2pc.ts":
    "5e8f686b19f1197430cff9a055dfb23dbed3f55d6f0d64f8722b95aa8f43eea3",
  "src/domain/combat/damage/impl/artifact4pc.ts":
    "5af5136e5fbe19c0cde575bc40e4a9e097a87fbb118d61fc250a2fc3b2c46405",
  "src/domain/combat/damage/impl/character5Fontaine.ts":
    "7e981b0b557abd9495a6240d9dba25537d3787b98d9a2e125f97b2a23c9220ee",
  "src/domain/combat/damage/impl/character5Liyue.ts":
    "7c3c8f125019e904354621796ca6b4c2159ae95f1b7612de6ee56398133351b5",
  "src/domain/combat/damage/impl/character5Natlan.ts":
    "ab629ca2dc02e62ed87815c8fcd3cb04f35cf2b0e37e1f0473be28eaa73e7b25",
  "src/domain/combat/damage/impl/character5NodKrai.ts":
    "70520075b58e54b99826b50fe975be71377f68d600ffb3051cdb3c5bbecaeb25",
  "src/domain/combat/damage/impl/helpers.ts":
    "2c3f9ece25cf126a50e63b10472c928c3fe881125b3c5a42ff771f65414e61cc",
  "src/domain/combat/damage/impl/weapon4Sword.ts":
    "48c30464c6dae1565b8a54600566a6feab11611a3a5525cab0df68d175325cc7",
  "src/domain/combat/damage/impl/weapon5Polearm.ts":
    "ba43f6e6e8d4b1483d1460d90d08b93c2a4e995aa0a06cef660f934df2e9718c",
  "src/domain/combat/damage/impl/weapon5Sword.ts":
    "18c81de8d027fbcd99c6bdb9eee0e025c0d3d89b15517857f342bc5689028f1f",
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
  "00377729276cd5f53271e60c6bad1db819622e66a594c44e232987fb73482d59";
const EXPECTED_RESULT_FINGERPRINT_SHA256 =
  "ea78f4ea4252bd2b39cfe9d99fb0a7ba37d172e2095c628f9df07d82825392b5";
const EXPECTED_GENERIC_REPORT_CONTENT_SHA256 =
  "e79fb6100d2f7c00b028f5127db9353fd776b961dac97ea37a2156cc545eb848";
const EXPECTED_GENERIC_STABLE_FULL_REPORT_SHA256 =
  "7ccf8ae26a77846e294fda4cd2555e5e0a59173ccb00b4fff6ec22bdc6d323ea";
const EXPECTED_BOUNDED_TECHNICAL_OBJECTIVE = 926_093.666_196_721;
const EXPECTED_INTACT_TECHNICAL_OBJECTIVE = 914_219.528_685_479;
const EXPECTED_AUTHENTICATED_REPORT_SHA256 =
  "b196a533b7606157b91b2916a7e53dcf4aeed64d541c594273e3fd622dae4ace";

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
