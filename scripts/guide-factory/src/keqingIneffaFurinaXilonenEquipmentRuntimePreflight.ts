import path from "node:path";
import { sha256Text, stableJson } from "./io";
import type { KeqingIneffaFormulaDraftReport } from "./keqingIneffaFormulaDraft";
import { KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS } from "./keqingIneffaFormulaDraft";
import {
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_RELATIVE_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  type KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
} from "./keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import { REPOSITORY_ROOT } from "./paths";
import {
  buildSourceBackedEquipmentRuntimePreflight,
  isCompleteSourceBackedEquipmentRuntimePreflightReport,
  requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport,
  type SourceBackedEquipmentRuntimeObjectiveEnvelope,
  type SourceBackedEquipmentRuntimeOccurrenceResolution,
  type SourceBackedEquipmentRuntimePreflightEnvironment,
  type SourceBackedEquipmentRuntimePreflightReport,
  type SourceBackedEquipmentRuntimeSourceReadinessBlocker,
} from "./sourceBackedEquipmentRuntimePreflight";

export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_ID =
  "keqing-ineffa-furina-xilonen-equipment-runtime-preflight-v1";
export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json";
export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_PATH =
  path.join(
    REPOSITORY_ROOT,
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_RELATIVE_PATH,
  );

/**
 * Declared non-self checkpoint inputs. This deliberately excludes this
 * producing wrapper, its CLI, and its output report to avoid a self-referential
 * digest. It is not an exhaustive dependency closure or transitive module-graph
 * claim; the durable validator also reexecutes the current runtime.
 */
export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS = [
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_RELATIVE_PATH,
  "scripts/guide-factory/reports/keqing-ineffa-formula-plan-draft.json",
  ...new Set([
    "scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentCandidateLattice.ts",
    "scripts/guide-factory/src/sourceBackedEquipmentCandidateLattice.ts",
    "scripts/guide-factory/src/sourceBackedEquipmentRuntimePreflight.ts",
    ...KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS,
    "src/domain/reference/catalog.ts",
    "src/generated/catalog/resources.ts",
    "src/generated/catalog/resources_beta.ts",
    "src/domain/combat/damage/impl/weapon4Sword.ts",
  ]),
] as const;

const EXPECTED_INPUT_FILE_SHA256 = {
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-candidate-lattice.json":
    "b81199dde159fac7c08990e26318f0ea3f391854115234df76243deadba8620b",
  "scripts/guide-factory/reports/keqing-ineffa-formula-plan-draft.json":
    "bf415e8ff6b8c3ba216ab208574ad632c7c3ed59caef3bb380c7f9cfae87aa96",
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentCandidateLattice.ts":
    "4f2c92dd2c5bdc0cb08a251fc26c352ea57408bf60fada256ca60c8f0a711250",
  "scripts/guide-factory/src/sourceBackedEquipmentCandidateLattice.ts":
    "d098653f47fed1572dbb2e5ed596c0086b4ed18cf28e6d86f41037c8b966e5cf",
  "scripts/guide-factory/src/sourceBackedEquipmentRuntimePreflight.ts":
    "9810032c3ec3067720ac62cd934ee0e3a161d1ab73869788b7f75666a2090cfd",
  "scripts/guide-factory/src/computationReplay.ts":
    "3c974458435a61938dadba8f7bc0be43467a3382c0ac2175210d6f65aa3074ff",
  "scripts/guide-factory/src/formulaPlanDraft.ts":
    "6e1e19fb82c327142eeecdb6dd024f6fd936438671eb37dd196b151f70492977",
  "scripts/guide-factory/src/formulaPlanReadiness.ts":
    "70417b8fc11b4a25ca3a0e65c52099dffcfd8256591f7870bdfff4fd18f4c922",
  "scripts/guide-factory/src/keqingIneffaFormulaSemanticScope.ts":
    "13ef01e504879d0bc242bf4114213bbbce29d6ad83e742b16f4dcc9e21d1152b",
  "scripts/guide-factory/src/scopedSemanticDependency.ts":
    "57e746459c94a3cbd44f462c9a7b9db420ef8a4b7ff34e24a4f02abc9f2a9619",
  "scripts/guide-factory/src/sourceBackedEquipmentScenario.ts":
    "b877b626adc552b6a672f7c18958e3463498ddb8b1f5a230dc2b91bedb417d42",
  "scripts/guide-factory/src/keqingIneffaFormulaDraft.ts":
    "2dc326af79b394b61432936e3907f3ccc597d61d35e2021ff1dc5bfb10586acc",
  "scripts/guide-factory/src/schemas.ts":
    "a5a22dbe0d4cffcb47392aed613dafa563779df9d5eecd308a0f2cca5d9d02b5",
  "scripts/guide-factory/src/teamMemberInvestment.ts":
    "6788b1a0fa08e390ecc07a687691778716e679b5bb4494b1340523081cfcb58c",
  "src/generated/catalog/character_stats.json":
    "74a3bd262f9ff26f1777f9a3a50ccf13bb2a7906f51030adde7fe1b756d96033",
  "src/generated/catalog/weapon_stats.json":
    "62821edb2b6e1b9be888a7330edc020f5f4c397e3329693f9ca2f23406d6b36c",
  "src/generated/catalog/characterInfo.ts":
    "b38abdfe2436e8063697d1d10bcbf4894a60368c4da525f1a3572622c19f3aeb",
  "src/providers/reference/statLoaders.ts":
    "01940c5233c94d915d2c17dcc920aabe79f2fa57add4f4df8a182af8d35b4acd",
  "src/domain/combat/damage/index.ts":
    "00c92a2f1f53f5c9d21d7f57afbe992563c0105e466cc81aa17f17840b3c0cab",
  "src/domain/combat/damage/constants.ts":
    "d8548a6174124f7e50edf9de43015e865b7ef0129140d759ed73642d99db6932",
  "src/domain/combat/damage/core/charBuild.ts":
    "9ae06e5424b7ab087856c5f622828701c79f3361f9de47e607d7d17387dfdd15",
  "src/domain/combat/damage/core/combo.ts":
    "b459aeb9103ef6de2330bb221a1cbf8c04205bb35c22193e0c02a6848751c2c6",
  "src/domain/combat/damage/core/implModel.ts":
    "f62785b391ea48753fdb51a8265a2aa742990b941af3cfb4e6d6a40978dbcd42",
  "src/domain/combat/damage/core/registry.ts":
    "36ae833c856559d44c5092fcf35238c03c7262473e3874b5e9deebac098380c6",
  "src/domain/combat/damage/core/teamBuild.ts":
    "1f57bedcb89de09ea2bd096e5c09c9b65e61fd21a8b5559fba0561110f866180",
  "src/domain/combat/damage/core/teamFormulaCatalog.ts":
    "fc181e07e43e28c6462b9237977630feb7eeceef57fba56d7ff11d3e49c686cd",
  "src/domain/combat/damage/core/teamMeta.ts":
    "f83591945518a8650a3ee8ceb73e5eab28c6670f91e6042b293357af07e2ab44",
  "src/domain/combat/damage/core/teamReaction.ts":
    "f2889b2933b63872dc890a651d6d54c9a05c360e489c1c6edb2e286244a20b0c",
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
  "src/domain/combat/damage/impl/weapon5Polearm.ts":
    "ba43f6e6e8d4b1483d1460d90d08b93c2a4e995aa0a06cef660f934df2e9718c",
  "src/domain/combat/damage/impl/weapon5Sword.ts":
    "18c81de8d027fbcd99c6bdb9eee0e025c0d3d89b15517857f342bc5689028f1f",
  "src/domain/reference/catalog.ts":
    "ffaaa71669580a7972dfda2f7a431a4b0885c36ac03220ff42a242112ebe3308",
  "src/generated/catalog/resources.ts":
    "7a6c531254b0943d430c72ac51ad52c49657715dcd3d9ee14ccdfd506ccb191a",
  "src/generated/catalog/resources_beta.ts":
    "beaa526631c00e6d796b87e1cceae358abeee1a3ced078a4002e524b932b2d60",
  "src/domain/combat/damage/impl/weapon4Sword.ts":
    "48c30464c6dae1565b8a54600566a6feab11611a3a5525cab0df68d175325cc7",
} as const satisfies Record<
  (typeof KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS)[number],
  string
>;

const DELIBERATELY_EXCLUDED_PRODUCER_PATHS = [
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentRuntimePreflight.ts",
  "scripts/guide-factory/src/preflight-keqing-ineffa-furina-xilonen-equipment-runtime.ts",
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_RELATIVE_PATH,
] as const;

const EXPECTED_LATTICE_REPORT_SHA256 =
  "b81199dde159fac7c08990e26318f0ea3f391854115234df76243deadba8620b";
const EXPECTED_FORMULA_DRAFT_REPORT_SHA256 =
  "bf415e8ff6b8c3ba216ab208574ad632c7c3ed59caef3bb380c7f9cfae87aa96";
const EXPECTED_OBJECTIVE_LINES_SHA256 =
  "cb0f071bd5151936f010b3cbbcc6582233b0ae08f2aace0df654f2f58afe060a";
const EXPECTED_AUTHENTICATED_REPORT_SHA256 =
  "00377729276cd5f53271e60c6bad1db819622e66a594c44e232987fb73482d59";

const TEAM_RECORD_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const FORMULA_FIXTURE_ID = "keqing-ineffa-source-rotation-comparison-v1";
const ROTATION_ID = "sample-rotation";
const EXACT_CHARACTER_IDS = ["keqing", "ineffa", "furina", "xilonen"] as const;

const EXPECTED_RESOLVED_EQUIPMENT = [
  ["keqing", "weapon", "lions_roar", 5],
  ["keqing", "weapon", "the_black_sword", 5],
  ["keqing", "weapon", "wolffang", 5],
  ["keqing", "artifact", "thundering_fury", null],
  ["keqing", "artifact", "gilded_dreams", null],
  ["ineffa", "weapon", "fractured_halo", 1],
  ["ineffa", "artifact", "aubade_of_morningstar_and_moon", null],
  ["furina", "weapon", "freedomsworn", 1],
  ["furina", "weapon", "key_of_khajnisut", 1],
  ["furina", "weapon", "splendor_of_tranquil_waters", 1],
  ["furina", "artifact", "golden_troupe", null],
  ["furina", "artifact", "tenacity_of_the_millelith", null],
  ["xilonen", "weapon", "peak_patrol_song", 1],
  ["xilonen", "artifact", "scroll_of_the_hero_of_cinder_city", null],
] as const;

export type EquipmentRuntimeHashedInput = { path: string; sha256: string };

export type BuildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightInput = {
  latticeReport: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport;
  formulaDraft: KeqingIneffaFormulaDraftReport;
  inputFiles: EquipmentRuntimeHashedInput[];
};

export type KeqingIneffaFurinaXilonenEquipmentRuntimePreflightIssue = {
  code: string;
  path: string;
  message: string;
};

export type KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport = {
  schemaVersion: 1;
  classification:
    "keqing-ineffa-furina-xilonen-equipment-runtime-materialization-preflight";
  preflightId: typeof KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_ID;
  validationStatus:
    | "authenticated-materialized-objective-not-ready"
    | "not-authenticated";
  generatedFrom: EquipmentRuntimeHashedInput[];
  issues: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightIssue[];
  sourceAuthentication: {
    dependencySetClassification:
      "authenticated-declared-non-self-checkpoint-inputs";
    transitiveModuleGraphClaimed: false;
    deliberatelyExcludedProducerPaths: string[];
    expectedFileCount: number;
    observedFileCount: number;
    exactPathSet: boolean;
    allByteHashesWellFormed: boolean;
    allDeclaredFileHashesMatch: boolean;
    upstreamByteHashesMatch: boolean;
    latticeReportSha256: string;
    latticeReportDigestMatches: boolean;
    latticeFullDigestAuthenticated: boolean;
    formulaDraftReportSha256: string;
    formulaDraftDigestMatches: boolean;
    formulaDraftSemanticClosure: boolean;
    authentication: "accepted" | "rejected";
  };
  sourceBoundary: {
    sourceTeamRecordId: typeof TEAM_RECORD_ID;
    formulaFixtureId: typeof FORMULA_FIXTURE_ID;
    sourceRotationId: typeof ROTATION_ID;
    exactCharacterIds: string[];
    latticeNodeCount: 36;
    activeOccurrenceCount: 14;
    objectiveFormulaLineCount: 11;
    objectiveFormulaLinesSha256: typeof EXPECTED_OBJECTIVE_LINES_SHA256;
    sourceReadiness: {
      readyForDamageReplay: false;
      blockerCount: 8;
      blockerCodes: string[];
      mappingSummary: SourceBackedEquipmentRuntimeObjectiveEnvelope["sourceReadiness"]["mappingSummary"];
    };
    sourceBindingEstablishedByWrapper: true;
    sourceBindingEstablishedByCore: false;
    gameplayApplicability: "unknown-not-validated";
    xilonenScrollWarning: string;
    sourcePublishedWholeCandidateCount: 0;
    compositionOwner: "source-specific-wrapper";
  };
  runtimeBoundary: {
    assumptionsOwner: "source-specific-wrapper";
    sourceAuthoredCharacterLevels: false;
    sourceAuthoredTalentLevels: false;
    sourceAuthoredEnemyContext: false;
    sourceAuthoredArtifactRollBudget: false;
    energyRecoveryInputsUsed: false;
    occurrenceResolutionCount: number;
    resolvedEquipmentProjection: Array<{
      occurrenceId: string;
      characterId: string;
      equipmentKind: "weapon" | "artifact";
      equipmentId: string;
      refinement: number | null;
    }>;
  };
  materializationExecuted: boolean;
  candidateGeneratorExecuted: false;
  damageReplayExecuted: false;
  damageEvaluationExecuted: false;
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
  runtimePreflight: SourceBackedEquipmentRuntimePreflightReport | null;
  summary: {
    candidateNodeCount: number;
    materializedNodeCount: number;
    runtimeReadyNodeCount: number;
    evaluatorReadyNodeCount: number;
    objectiveFormulaAvailabilityCheckCount: number;
    unresolvedFormulaReferenceAvailabilityCheckCount: number;
    generatorCallCount: 0;
    replayCallCount: 0;
    damageEvaluationCallCount: 0;
    energyRecoveryCallCount: 0;
  };
  cautions: string[];
  prohibitedInterpretations: string[];
};

export async function buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
  rawInput: BuildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightInput,
  environment?: SourceBackedEquipmentRuntimePreflightEnvironment,
): Promise<KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport> {
  const input = structuredClone(rawInput);
  const issues: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightIssue[] = [];
  const generatedFrom = input.inputFiles
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const expectedPaths = [
    ...KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS,
  ].sort((left, right) => left.localeCompare(right));
  const observedPaths = generatedFrom.map(({ path: inputPath }) => inputPath);
  const exactPathSet = exactEqual(expectedPaths, observedPaths);
  const allByteHashesWellFormed = generatedFrom.every(({ sha256 }) =>
    /^[a-f0-9]{64}$/.test(sha256),
  );
  const allDeclaredFileHashesMatch =
    exactPathSet &&
    generatedFrom.every(
      ({ path: inputPath, sha256 }) =>
        EXPECTED_INPUT_FILE_SHA256[
          inputPath as keyof typeof EXPECTED_INPUT_FILE_SHA256
        ] === sha256,
    );
  const latticeReportSha256 = sha256Text(stableJson(input.latticeReport));
  const formulaDraftReportSha256 = sha256Text(stableJson(input.formulaDraft));
  const latticeReportDigestMatches =
    latticeReportSha256 === EXPECTED_LATTICE_REPORT_SHA256;
  const formulaDraftDigestMatches =
    formulaDraftReportSha256 === EXPECTED_FORMULA_DRAFT_REPORT_SHA256;
  const inputHashByPath = new Map(
    generatedFrom.map(({ path: inputPath, sha256 }) => [inputPath, sha256]),
  );
  const upstreamByteHashesMatch =
    inputHashByPath.get(
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS[0],
    ) === EXPECTED_LATTICE_REPORT_SHA256 &&
    inputHashByPath.get(
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS[1],
    ) === EXPECTED_FORMULA_DRAFT_REPORT_SHA256;
  let latticeFullDigestAuthenticated = false;
  try {
    requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
      input.latticeReport,
    );
    latticeFullDigestAuthenticated = true;
  } catch (error) {
    addIssue(
      issues,
      "source.lattice_not_authenticated",
      "latticeReport",
      error instanceof Error ? error.message : String(error),
    );
  }
  const formulaDraftSemanticClosure = authenticateFormulaDraft(
    input.formulaDraft,
  );
  if (!exactPathSet) {
    addIssue(
      issues,
      "input.path_set_mismatch",
      "inputFiles",
      "Runtime preflight requires the exact declared non-self checkpoint-input path set.",
    );
  }
  if (!allByteHashesWellFormed) {
    addIssue(
      issues,
      "input.invalid_hash",
      "inputFiles",
      "Every declared checkpoint input requires a lowercase SHA-256 byte hash.",
    );
  }
  if (!allDeclaredFileHashesMatch) {
    addIssue(
      issues,
      "input.declared_file_hash_mismatch",
      "inputFiles",
      "Every declared non-self checkpoint input must match its exact authenticated byte hash.",
    );
  }
  if (!upstreamByteHashesMatch) {
    addIssue(
      issues,
      "input.upstream_byte_hash_mismatch",
      "inputFiles",
      "The lattice and formula-draft byte hashes must match the exact parsed upstream reports.",
    );
  }
  if (!latticeReportDigestMatches) {
    addIssue(
      issues,
      "source.lattice_digest_mismatch",
      "latticeReport",
      "The source-backed equipment lattice does not match checkpoint 36.",
    );
  }
  if (!formulaDraftDigestMatches || !formulaDraftSemanticClosure) {
    addIssue(
      issues,
      "source.formula_draft_mismatch",
      "formulaDraft",
      "The source rotation/formula draft does not match its exact unreviewed eleven-line and eight-blocker boundary.",
    );
  }

  const sourceAuthentication = {
    dependencySetClassification:
      "authenticated-declared-non-self-checkpoint-inputs" as const,
    transitiveModuleGraphClaimed: false as const,
    deliberatelyExcludedProducerPaths: [
      ...DELIBERATELY_EXCLUDED_PRODUCER_PATHS,
    ],
    expectedFileCount:
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS.length,
    observedFileCount: generatedFrom.length,
    exactPathSet,
    allByteHashesWellFormed,
    allDeclaredFileHashesMatch,
    upstreamByteHashesMatch,
    latticeReportSha256,
    latticeReportDigestMatches,
    latticeFullDigestAuthenticated,
    formulaDraftReportSha256,
    formulaDraftDigestMatches,
    formulaDraftSemanticClosure,
    authentication: "rejected" as "accepted" | "rejected",
  };
  const commonSourceBoundary = sourceBoundary(input.formulaDraft, input.latticeReport);
  if (issues.length > 0) {
    return emptyReport(
      generatedFrom,
      issues,
      sourceAuthentication,
      commonSourceBoundary,
    );
  }
  sourceAuthentication.authentication = "accepted";

  const occurrenceResolutions = buildOccurrenceResolutions(
    input.latticeReport,
    issues,
  );
  if (issues.length > 0) {
    sourceAuthentication.authentication = "rejected";
    return emptyReport(
      generatedFrom,
      issues,
      sourceAuthentication,
      commonSourceBoundary,
    );
  }
  const objective = buildObjectiveEnvelope(input.formulaDraft);
  const runtimePreflight = await buildSourceBackedEquipmentRuntimePreflight(
    {
      lattice: input.latticeReport.lattice,
      occurrenceResolutions,
      objective,
      runtimeAssumptions: {
        assumptionsId:
          "keqing-ineffa-furina-xilonen-c0-level90-talents10-runtime-v1",
        expectedNodeCount: "36",
        investments: EXACT_CHARACTER_IDS.map((characterId) => ({
          teamMemberId: `member:${characterId}`,
          characterId,
          charLevel: 90,
          constellation: 0,
          talentLevels: { auto: 10, skill: 10, burst: 10 },
        })),
        combatOptions: {},
        enemyAura: null,
        extraBuffs: [],
        calcContext: {
          enemyLevel: 110,
          enemyRes: 0.1,
          rollMultiplier: 0.85,
          substatBudget: "8_6",
        },
        carryCharacterIds: [...EXACT_CHARACTER_IDS],
        energyRecoveryThresholds: null,
        perCharacterConstraints: null,
      },
    },
    environment,
  );
  const complete = isCompleteSourceBackedEquipmentRuntimePreflightReport(
    runtimePreflight,
  );
  if (
    !complete ||
    runtimePreflight.validationStatus !== "materialized-objective-not-ready"
  ) {
    addIssue(
      issues,
      "runtime.incomplete_materialization",
      "runtimePreflight",
      "The authenticated 36-node runtime preflight did not completely materialize while preserving objective non-readiness.",
    );
  }

  const resolvedEquipmentProjection = occurrenceResolutions.map((resolution) =>
    resolution.equipmentKind === "weapon"
      ? {
          occurrenceId: resolution.occurrenceId,
          characterId: resolution.characterId,
          equipmentKind: resolution.equipmentKind,
          equipmentId: resolution.weaponId,
          refinement: resolution.refinement,
        }
      : {
          occurrenceId: resolution.occurrenceId,
          characterId: resolution.characterId,
          equipmentKind: resolution.equipmentKind,
          equipmentId: resolution.artifactSet.setId,
          refinement: null,
        },
  );
  const report: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport = {
    schemaVersion: 1,
    classification:
      "keqing-ineffa-furina-xilonen-equipment-runtime-materialization-preflight",
    preflightId:
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_ID,
    validationStatus:
      issues.length === 0
        ? "authenticated-materialized-objective-not-ready"
        : "not-authenticated",
    generatedFrom,
    issues,
    sourceAuthentication,
    sourceBoundary: commonSourceBoundary,
    runtimeBoundary: {
      assumptionsOwner: "source-specific-wrapper",
      sourceAuthoredCharacterLevels: false,
      sourceAuthoredTalentLevels: false,
      sourceAuthoredEnemyContext: false,
      sourceAuthoredArtifactRollBudget: false,
      energyRecoveryInputsUsed: false,
      occurrenceResolutionCount: occurrenceResolutions.length,
      resolvedEquipmentProjection,
    },
    materializationExecuted: runtimePreflight.execution.observedMaterializationCalls > 0,
    candidateGeneratorExecuted: false,
    damageReplayExecuted: false,
    damageEvaluationExecuted: false,
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
    runtimePreflight,
    summary: summarize(runtimePreflight),
    cautions: fixedCautions(),
    prohibitedInterpretations: fixedProhibitedInterpretations(),
  };
  return report;
}

export function requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
  report: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
): void {
  const completeDigestMatches =
    sha256Text(stableJson(report)) === EXPECTED_AUTHENTICATED_REPORT_SHA256;
  const runtime = report.runtimePreflight;
  let genericAuthenticated = false;
  if (runtime) {
    try {
      requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(runtime);
      genericAuthenticated = true;
    } catch {
      genericAuthenticated = false;
    }
  }
  const semanticClosure =
    report.validationStatus ===
      "authenticated-materialized-objective-not-ready" &&
    report.issues.length === 0 &&
    report.sourceAuthentication.dependencySetClassification ===
      "authenticated-declared-non-self-checkpoint-inputs" &&
    !report.sourceAuthentication.transitiveModuleGraphClaimed &&
    exactEqual(
      report.sourceAuthentication.deliberatelyExcludedProducerPaths,
      DELIBERATELY_EXCLUDED_PRODUCER_PATHS,
    ) &&
    report.sourceAuthentication.authentication === "accepted" &&
    report.sourceAuthentication.exactPathSet &&
    report.sourceAuthentication.allByteHashesWellFormed &&
    report.sourceAuthentication.allDeclaredFileHashesMatch &&
    report.sourceAuthentication.upstreamByteHashesMatch &&
    report.sourceAuthentication.latticeReportDigestMatches &&
    report.sourceAuthentication.latticeFullDigestAuthenticated &&
    report.sourceAuthentication.formulaDraftDigestMatches &&
    report.sourceAuthentication.formulaDraftSemanticClosure &&
    report.materializationExecuted &&
    !report.candidateGeneratorExecuted &&
    !report.damageReplayExecuted &&
    !report.damageEvaluationExecuted &&
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
    report.sourceBoundary.sourceReadiness.blockerCount === 8 &&
    !report.sourceBoundary.sourceReadiness.readyForDamageReplay &&
    report.sourceBoundary.sourceBindingEstablishedByWrapper &&
    !report.sourceBoundary.sourceBindingEstablishedByCore &&
    report.sourceBoundary.sourcePublishedWholeCandidateCount === 0 &&
    report.sourceBoundary.compositionOwner === "source-specific-wrapper" &&
    report.runtimeBoundary.occurrenceResolutionCount === 14 &&
    !report.runtimeBoundary.energyRecoveryInputsUsed &&
    report.summary.candidateNodeCount === 36 &&
    report.summary.materializedNodeCount === 36 &&
    report.summary.runtimeReadyNodeCount === 36 &&
    report.summary.evaluatorReadyNodeCount === 0 &&
    report.summary.objectiveFormulaAvailabilityCheckCount === 396 &&
    report.summary.unresolvedFormulaReferenceAvailabilityCheckCount === 180 &&
    report.summary.generatorCallCount === 0 &&
    report.summary.replayCallCount === 0 &&
    report.summary.damageEvaluationCallCount === 0 &&
    report.summary.energyRecoveryCallCount === 0 &&
    runtime !== null &&
    genericAuthenticated &&
    isCompleteSourceBackedEquipmentRuntimePreflightReport(runtime) &&
    runtime.validationStatus === "materialized-objective-not-ready";
  if (!completeDigestMatches || !semanticClosure) {
    throw new Error(
      "Refusing to write unauthenticated or mutated Keqing/Ineffa/Furina/Xilonen equipment runtime preflight report.",
    );
  }
}

function authenticateFormulaDraft(report: KeqingIneffaFormulaDraftReport): boolean {
  const comparisons = report.authoredTranslation.formulaComparisons;
  const lines = comparisons.map((comparison) => ({
    characterId: comparison.characterId,
    formulaId: comparison.formulaId,
    count:
      comparison.sourceCountClaim.type === "exact"
        ? comparison.sourceCountClaim.value
        : Number.NaN,
  }));
  const readiness = report.damageReplayReadiness;
  return (
    report.fixtureId === FORMULA_FIXTURE_ID &&
    report.sourceTeamRecordId === TEAM_RECORD_ID &&
    report.sourceRotation.recordId === TEAM_RECORD_ID &&
    report.sourceRotation.rotationId === ROTATION_ID &&
    report.status === "needs-domain-review" &&
    !report.promotionEligible &&
    !report.supportsGuideClaims &&
    report.authoredTranslation.reviewStatus === "unreviewed" &&
    comparisons.length === 11 &&
    comparisons.every(({ sourceCountClaim }) => sourceCountClaim.type === "exact") &&
    sha256Text(stableJson(lines)) === EXPECTED_OBJECTIVE_LINES_SHA256 &&
    readiness.reviewStatus === "unreviewed" &&
    !readiness.readyForDamageReplay &&
    readiness.blockers.length === 8 &&
    readiness.sourceMappingSummary.comparisons === 11 &&
    readiness.sourceMappingSummary.exactClaims === 11 &&
    readiness.sourceMappingSummary.rangeClaims === 0 &&
    readiness.sourceMappingSummary.completeTokenMappings === 10 &&
    readiness.sourceMappingSummary.partialTokenMappings === 1 &&
    readiness.sourceMappingSummary.unresolvedMappings === 6 &&
    readiness.sourceMappingSummary.nonNullFormulaUnresolvedMappings === 5 &&
    readiness.sourceMappingSummary.nullFormulaUnresolvedMappings === 1 &&
    readiness.sourceMappingSummary.sourceAbsentMappings === 2 &&
    report.authoredTranslation.unresolvedMappings.length === 6 &&
    report.authoredTranslation.sourceAbsentMappings.length === 2
  );
}

function buildObjectiveEnvelope(
  formulaDraft: KeqingIneffaFormulaDraftReport,
): SourceBackedEquipmentRuntimeObjectiveEnvelope {
  const formulaLines = formulaDraft.authoredTranslation.formulaComparisons.map(
    (comparison) => {
      if (comparison.sourceCountClaim.type !== "exact") {
        throw new Error(
          `Runtime objective requires an exact count for ${comparison.characterId}.${comparison.formulaId}.`,
        );
      }
      return {
        characterId: comparison.characterId,
        formulaId: comparison.formulaId,
        count: comparison.sourceCountClaim.value,
      };
    },
  );
  return {
    objectiveId: "keqing-ineffa-source-rotation-technical-objective-v1",
    sourceTeamRecordId: formulaDraft.sourceTeamRecordId,
    sourceRotationRecordId: formulaDraft.sourceRotation.recordId,
    sourceRotationId: formulaDraft.sourceRotation.rotationId,
    expectedFormulaLineCount: 11,
    formulaLines,
    formulaLinesSha256: sha256Text(stableJson(formulaLines)),
    reviewStatus: formulaDraft.authoredTranslation.reviewStatus,
    sourceBindingEstablishedByCaller: true,
    unresolvedMappings: formulaDraft.authoredTranslation.unresolvedMappings.map(
      (mapping) => ({ ...mapping }),
    ),
    sourceReadiness: {
      readyForDamageReplay: formulaDraft.damageReplayReadiness.readyForDamageReplay,
      blockers: formulaDraft.damageReplayReadiness.blockers.map((blocker) => ({
        ...blocker,
      })) as SourceBackedEquipmentRuntimeSourceReadinessBlocker[],
      mappingSummary: {
        ...formulaDraft.damageReplayReadiness.sourceMappingSummary,
      },
    },
  };
}

function buildOccurrenceResolutions(
  report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  issues: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightIssue[],
): SourceBackedEquipmentRuntimeOccurrenceResolution[] {
  const lattice = report.lattice.lattice;
  if (!lattice) {
    addIssue(issues, "lattice.missing", "lattice", "Authenticated lattice is absent.");
    return [];
  }
  const resolutions: SourceBackedEquipmentRuntimeOccurrenceResolution[] = [];
  const projection: Array<readonly [string, "weapon" | "artifact", string, number | null]> = [];
  for (const group of lattice.groups) {
    const domain = lattice.domains.find(({ groupIds }) =>
      groupIds.includes(group.groupId),
    );
    if (!domain) {
      addIssue(issues, "lattice.domain_missing", group.groupId, "Source group has no active domain.");
      continue;
    }
    for (const occurrence of group.occurrences) {
      const payload = occurrence.payload as Record<string, unknown>;
      const equipmentId = payload.equipmentId;
      if (typeof equipmentId !== "string") {
        addIssue(issues, "lattice.invalid_payload", occurrence.occurrenceId, "Equipment payload lacks an ID.");
        continue;
      }
      const base = {
        occurrenceId: occurrence.occurrenceId,
        axisId: domain.axisId,
        groupId: group.groupId,
        teamMemberId: domain.teamMemberId,
        characterId: domain.characterId,
        latticePayloadSha256: sha256Text(stableJson(occurrence.payload)),
      };
      if (domain.equipmentKind === "weapon") {
        const refinement = payload.requestedRefinement;
        if (!Number.isInteger(refinement) || Number(refinement) < 1 || Number(refinement) > 5) {
          addIssue(issues, "lattice.invalid_weapon_payload", occurrence.occurrenceId, "Weapon payload lacks a valid requested refinement.");
          continue;
        }
        resolutions.push({
          ...base,
          equipmentKind: "weapon",
          weaponId: equipmentId,
          refinement: Number(refinement),
        });
        projection.push([domain.characterId, "weapon", equipmentId, Number(refinement)]);
      } else {
        if (payload.artifactType !== "4pc" || !equipmentId.startsWith("4pc:")) {
          addIssue(issues, "lattice.invalid_artifact_payload", occurrence.occurrenceId, "Artifact payload is not one exact four-piece set.");
          continue;
        }
        const setId = equipmentId.slice("4pc:".length);
        resolutions.push({
          ...base,
          equipmentKind: "artifact",
          artifactSet: { type: "4pc", setId },
        });
        projection.push([domain.characterId, "artifact", setId, null]);
      }
    }
  }
  if (!exactEqual(projection, EXPECTED_RESOLVED_EQUIPMENT)) {
    addIssue(
      issues,
      "lattice.runtime_projection_mismatch",
      "lattice.groups",
      "The 14 active source occurrences no longer resolve to the exact bounded runtime equipment domain.",
    );
  }
  return resolutions;
}

function sourceBoundary(
  formulaDraft: KeqingIneffaFormulaDraftReport,
  latticeReport: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
): KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport["sourceBoundary"] {
  return {
    sourceTeamRecordId: TEAM_RECORD_ID,
    formulaFixtureId: FORMULA_FIXTURE_ID,
    sourceRotationId: ROTATION_ID,
    exactCharacterIds: [...EXACT_CHARACTER_IDS],
    latticeNodeCount: 36,
    activeOccurrenceCount: 14,
    objectiveFormulaLineCount: 11,
    objectiveFormulaLinesSha256: EXPECTED_OBJECTIVE_LINES_SHA256,
    sourceReadiness: {
      readyForDamageReplay: false,
      blockerCount: 8,
      blockerCodes: formulaDraft.damageReplayReadiness.blockers.map(({ code }) => code),
      mappingSummary: {
        ...formulaDraft.damageReplayReadiness.sourceMappingSummary,
      },
    },
    sourceBindingEstablishedByWrapper: true,
    sourceBindingEstablishedByCore: false,
    gameplayApplicability: "unknown-not-validated",
    xilonenScrollWarning: latticeReport.requestBoundary.xilonenScrollWarning,
    sourcePublishedWholeCandidateCount: 0,
    compositionOwner: "source-specific-wrapper",
  };
}

function emptyReport(
  generatedFrom: EquipmentRuntimeHashedInput[],
  issues: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightIssue[],
  sourceAuthentication: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport["sourceAuthentication"],
  sourceBoundaryValue: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport["sourceBoundary"],
): KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport {
  return {
    schemaVersion: 1,
    classification:
      "keqing-ineffa-furina-xilonen-equipment-runtime-materialization-preflight",
    preflightId:
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_ID,
    validationStatus: "not-authenticated",
    generatedFrom,
    issues,
    sourceAuthentication,
    sourceBoundary: sourceBoundaryValue,
    runtimeBoundary: {
      assumptionsOwner: "source-specific-wrapper",
      sourceAuthoredCharacterLevels: false,
      sourceAuthoredTalentLevels: false,
      sourceAuthoredEnemyContext: false,
      sourceAuthoredArtifactRollBudget: false,
      energyRecoveryInputsUsed: false,
      occurrenceResolutionCount: 0,
      resolvedEquipmentProjection: [],
    },
    materializationExecuted: false,
    candidateGeneratorExecuted: false,
    damageReplayExecuted: false,
    damageEvaluationExecuted: false,
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
    runtimePreflight: null,
    summary: {
      candidateNodeCount: 0,
      materializedNodeCount: 0,
      runtimeReadyNodeCount: 0,
      evaluatorReadyNodeCount: 0,
      objectiveFormulaAvailabilityCheckCount: 0,
      unresolvedFormulaReferenceAvailabilityCheckCount: 0,
      generatorCallCount: 0,
      replayCallCount: 0,
      damageEvaluationCallCount: 0,
      energyRecoveryCallCount: 0,
    },
    cautions: fixedCautions(),
    prohibitedInterpretations: fixedProhibitedInterpretations(),
  };
}

function summarize(
  report: SourceBackedEquipmentRuntimePreflightReport,
): KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport["summary"] {
  return {
    candidateNodeCount: report.inputBoundary.latticeNodeCount,
    materializedNodeCount: report.execution.materializedNodeCount,
    runtimeReadyNodeCount: report.execution.runtimeReadyNodeCount,
    evaluatorReadyNodeCount: report.execution.evaluatorReadyNodeCount,
    objectiveFormulaAvailabilityCheckCount:
      report.execution.objectiveFormulaAvailabilityChecks,
    unresolvedFormulaReferenceAvailabilityCheckCount:
      report.execution.unresolvedFormulaReferenceAvailabilityChecks,
    generatorCallCount: 0,
    replayCallCount: 0,
    damageEvaluationCallCount: 0,
    energyRecoveryCallCount: 0,
  };
}

function fixedCautions(): string[] {
  return [
    "All character levels, talent levels, enemy context, and artifact-roll budget are wrapper-owned technical assumptions rather than source-authored guide facts.",
    "All 36 weapon/artifact pairings and cross-character compositions remain wrapper-authored; materialization does not validate gameplay applicability.",
    "The exact source readiness blockers remain active, including unmapped N1 hits, unresolved summon duration/hit counts, and Lunar-Charged trigger ownership.",
    "No generator, damage replay, ranker, optimizer, or ER calculation runs in this preflight.",
  ];
}

function fixedProhibitedInterpretations(): string[] {
  return [
    "source-published-whole-candidate",
    "gameplay-validated-team",
    "damage-result",
    "candidate-ranking",
    "winner",
    "equipment-recommendation",
    "guide",
    "optimality",
    "energy-requirement",
  ];
}

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function addIssue(
  issues: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightIssue[],
  code: string,
  issuePath: string,
  message: string,
): void {
  issues.push({ code, path: issuePath, message });
}
