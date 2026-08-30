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
    "src/data/gameResources.ts",
    "src/data/resources.ts",
    "src/data/resources_beta.ts",
    "src/lib/dmgcalc/impl/weapon4Sword.ts",
  ]),
] as const;

const EXPECTED_INPUT_FILE_SHA256 = {
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-candidate-lattice.json":
    "a4477c1e941a12e30d8ef14cf6343fbef46406ccd06416cc8b751394e41e4bb6",
  "scripts/guide-factory/reports/keqing-ineffa-formula-plan-draft.json":
    "e65fb7f94e5b77845239575321d1b093f50401e9cf10306b2eaba38e06fb860b",
  "scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentCandidateLattice.ts":
    "37353a9d2481607a1a2eb293ac7a445827019cfaf3618ea41469d1d0e04533a8",
  "scripts/guide-factory/src/sourceBackedEquipmentCandidateLattice.ts":
    "d098653f47fed1572dbb2e5ed596c0086b4ed18cf28e6d86f41037c8b966e5cf",
  "scripts/guide-factory/src/sourceBackedEquipmentRuntimePreflight.ts":
    "2602c8af1cf81bec68d824b2a51a2438e5a8945a437adc8c06f11c96dcca53b7",
  "scripts/guide-factory/src/computationReplay.ts":
    "228a1eb55b329acbf46241583b38e2edd957050d705dc37f30c058360e4672ff",
  "scripts/guide-factory/src/formulaPlanDraft.ts":
    "7c2f822b124b0e0143c6b4055a51639d6a0a609cc32765899e65693383346407",
  "scripts/guide-factory/src/formulaPlanReadiness.ts":
    "70417b8fc11b4a25ca3a0e65c52099dffcfd8256591f7870bdfff4fd18f4c922",
  "scripts/guide-factory/src/keqingIneffaFormulaSemanticScope.ts":
    "ad485772ffb7d9cbcc46c43f9c905c6ff4a621dd476d7a271acd83c46a96ffb9",
  "scripts/guide-factory/src/scopedSemanticDependency.ts":
    "57e746459c94a3cbd44f462c9a7b9db420ef8a4b7ff34e24a4f02abc9f2a9619",
  "scripts/guide-factory/src/sourceBackedEquipmentScenario.ts":
    "b877b626adc552b6a672f7c18958e3463498ddb8b1f5a230dc2b91bedb417d42",
  "scripts/guide-factory/src/keqingIneffaFormulaDraft.ts":
    "5f3175d099eb3b34a9c9fa43716e9be458bbddcdca70e274c999d32c636d1072",
  "scripts/guide-factory/src/schemas.ts":
    "a5a22dbe0d4cffcb47392aed613dafa563779df9d5eecd308a0f2cca5d9d02b5",
  "scripts/guide-factory/src/teamMemberInvestment.ts":
    "6788b1a0fa08e390ecc07a687691778716e679b5bb4494b1340523081cfcb58c",
  "src/data/game/character_stats.json":
    "f9ff524039a400b46e453147847fef4d26873a53bfe85af851f554eb7c5d3a0f",
  "src/data/game/weapon_stats.json":
    "e88cb5073dea3e6d45fcd52c020c8be73639cf443b28971a4534c8ea0c63eec8",
  "src/data/charInfo.ts":
    "6ff9b8d1fb7dce4f4d9875eee55df5fac5899e13ba6bebb5bbe45256db345d68",
  "src/data/gameStatsLoader.ts":
    "9cefd00bf25e44ba8ca06915568731728ce94a6c4e19c861456458e1fa9894ce",
  "src/lib/dmgcalc/index.ts":
    "00c92a2f1f53f5c9d21d7f57afbe992563c0105e466cc81aa17f17840b3c0cab",
  "src/lib/dmgcalc/constants.ts":
    "aeee718a71e82e043205279469af1c6884bc6333a528438f0f6fa12fde3fe1a1",
  "src/lib/dmgcalc/core/charBuild.ts":
    "2e78712774a25fb6581b5b498b0fe323f91974ea16624740aa03b1e3e626f2a4",
  "src/lib/dmgcalc/core/combo.ts":
    "e09ce763270285f1805e72f7347cd5a56c65c3ea0fc16758fa58fbf31b535bca",
  "src/lib/dmgcalc/core/implModel.ts":
    "239afd2965af55921c3419eb9fe4a61d65570edbc879ab57ae00ccde9d259a65",
  "src/lib/dmgcalc/core/registry.ts":
    "c80a29a6cea754bb8460bc156dbbe4f6f1c9381782df948e5033505e82da7893",
  "src/lib/dmgcalc/core/teamBuild.ts":
    "0ad001a80494e76d4a0e1aa4af422145d534b6787191f8ec776d7d42c36a0e29",
  "src/lib/dmgcalc/core/teamFormulaCatalog.ts":
    "9332f59cb4d04ee8387cbe7e10bf4a0f06284c6004e6d4f8bd786c26dd6347db",
  "src/lib/dmgcalc/core/teamMeta.ts":
    "010fe2e64205719d60f78991d18af67ad6f4750158764917a6dbb072e9be9858",
  "src/lib/dmgcalc/core/teamReaction.ts":
    "85ad4d2ca90fe7c9c083fde10c774745a5021fa6dd6125752b4160b21f308f18",
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
  "src/lib/dmgcalc/impl/weapon5Polearm.ts":
    "ba43f6e6e8d4b1483d1460d90d08b93c2a4e995aa0a06cef660f934df2e9718c",
  "src/lib/dmgcalc/impl/weapon5Sword.ts":
    "5e5d0c58eb33b67f51288e167b2a691f4693eedfa7709de00346df243ab3a0a8",
  "src/data/gameResources.ts":
    "8cedb648026bd0b2684a61fc5658e724fc67b9016d1bc3909c625421ed1648eb",
  "src/data/resources.ts":
    "f8ab11b08762d1eb9e9bba2f8fb9b3f48ceaab34889b08294045c005de1798bd",
  "src/data/resources_beta.ts":
    "2f53ee6265fa2dc8367d6b5071e0deef95f080b0f34830403f795413fadcab21",
  "src/lib/dmgcalc/impl/weapon4Sword.ts":
    "e57306601e6b105fee72b1183383f916f48c2f5cd175e3f503b10c8df24aec79",
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
  "a4477c1e941a12e30d8ef14cf6343fbef46406ccd06416cc8b751394e41e4bb6";
const EXPECTED_FORMULA_DRAFT_REPORT_SHA256 =
  "e65fb7f94e5b77845239575321d1b093f50401e9cf10306b2eaba38e06fb860b";
const EXPECTED_OBJECTIVE_LINES_SHA256 =
  "cb0f071bd5151936f010b3cbbcc6582233b0ae08f2aace0df654f2f58afe060a";
const EXPECTED_AUTHENTICATED_REPORT_SHA256 =
  "c0dedcfb87d27dfebeba99d89a26a6ed614f4de536b23d6bef54529b0246155b";

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
