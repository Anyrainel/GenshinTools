import path from "node:path";
import { sha256Text, stableJson } from "./io";
import {
  authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport,
  NOELLE_COMPILED_DAMAGE_RELATIVE_PATH,
  NOELLE_DIRECT_DAMAGE_RELATIVE_PATH,
  NOELLE_IMPLEMENTATION_RELATIVE_PATH,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS,
  NOELLE_REPLAY_ADAPTER_RELATIVE_PATH,
  type NoelleInvestmentArtifactProfileComputationAdmissionInput,
  type NoelleInvestmentArtifactProfileComputationAdmissionReport,
  type NoelleSourceBackedArtifactProfile,
} from "./noelleInvestmentArtifactProfileComputationAdmission";
import {
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalHighInvestmentSliceInput,
  type NoelleSourceLocalHighInvestmentSliceReport,
} from "./noelleSourceLocalHighInvestmentSlice";
import {
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalLowerInvestmentSliceInput,
  type NoelleSourceLocalLowerInvestmentSliceReport,
} from "./noelleSourceLocalLowerInvestmentSlice";
import {
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_SOURCE_FILE_PATHS,
  requireAuthenticatedNoelleHexereiWeaponTeamSourceBindingReport,
  type NoelleHexereiWeaponTeamSourceBindingInput,
  type NoelleHexereiWeaponTeamSourceBindingReport,
} from "./noelleHexereiWeaponTeamSourceBinding";
import { FACTORY_ROOT } from "./paths";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";

export const NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_ID =
  "noelle-hexerei-partial-equipment-composition-v1";
export const NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "noelle-hexerei-partial-equipment-composition.json",
  );

export const NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-investment-artifact-profile-computation-admission.json";
export const NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-hexerei-weapon-team-source-binding.json";
export const NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/noelleHexereiPartialEquipmentComposition.ts";
export const NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_CLI_RELATIVE_PATH =
  "scripts/guide-factory/src/assemble-noelle-hexerei-partial-equipment-composition.ts";

const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json";
const MANUAL_INDEX_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const HIGH_SLICE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-source-local-high-investment-slice.json";
const LOWER_SLICE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-source-local-lower-investment-slice.json";

const JSON_INPUT_PATHS = {
  repositoryInput: REPOSITORY_RELATIVE_PATH,
  manualSnapshotInput: MANUAL_SNAPSHOT_RELATIVE_PATH,
  manualIndexInput: MANUAL_INDEX_RELATIVE_PATH,
  sourceRegistryInput: SOURCE_REGISTRY_RELATIVE_PATH,
  highSliceReportInput: HIGH_SLICE_REPORT_RELATIVE_PATH,
  lowerSliceReportInput: LOWER_SLICE_REPORT_RELATIVE_PATH,
  cp51ReportInput: NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
  cp52ReportInput: NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
} as const;

export const NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS = [
  ...new Set([
    ...NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
    ...NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
    NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
    NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
    NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_CORE_RELATIVE_PATH,
    NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_CLI_RELATIVE_PATH,
  ]),
].sort(compareText);

export const NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_SOURCE_FILE_PATHS = [
  ...NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS,
];

export interface NoelleHexereiPartialEquipmentCompositionSourceFile {
  path: string;
  text: string;
}

export interface NoelleHexereiPartialEquipmentCompositionInput {
  cp51ReportInput: NoelleInvestmentArtifactProfileComputationAdmissionReport;
  cp51Input: NoelleInvestmentArtifactProfileComputationAdmissionInput;
  cp52ReportInput: NoelleHexereiWeaponTeamSourceBindingReport;
  cp52Input: NoelleHexereiWeaponTeamSourceBindingInput;
  sourceFiles: readonly NoelleHexereiPartialEquipmentCompositionSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface NoelleHexereiPartialEquipmentValidationCandidate {
  candidateId: string;
  status: "request-parameterized-partial-validation-candidate";
  characterId: "noelle";
  team: {
    sourceRecordId: string;
    repositoryRecordId: string;
    orderedCharacterIds: ["noelle", "durin", "nicole", "xilonen"];
    noelleInvestment: { status: "unspecified" };
    investmentBranchEvaluation: "not-evaluated";
    investmentBranchSelected: false;
  };
  artifactProfile: NoelleSourceBackedArtifactProfile;
  weaponOption: {
    sourceObservation: NoelleHexereiWeaponTeamSourceBindingReport["weaponObservation"];
    applicabilityBinding: NoelleHexereiWeaponTeamSourceBindingReport["binding"];
    projectedForCandidate: true;
    applicableButUnranked: true;
    refinement: null;
    refinementStatus: "missing-not-zero";
    quantitativePerformanceStatus: "missing-not-zero";
  };
  selections: {
    selectedWeapon: null;
    selectedArtifactSet: null;
    selectedMainStats: { sands: null; goblet: null; circlet: null };
    selectedSubstatAllocation: null;
  };
  completeness: {
    guardedAlternativesPreservedUnchanged: true;
    embeddedArtifactProfileWeaponBoundaryPreserved: "missing-not-zero";
    applicableWeaponOptionProjectedSeparately: true;
    completeArtifactAssignment: false;
    completeBuild: false;
  };
  authorship: {
    sourceAuthoredCandidate: false;
    sourceAuthoredComposite: false;
    guideFactoryAuthoredPartialComposition: true;
    guideFactoryAuthoredProjection: true;
    existingRuntimeGeneratorProducedCandidate: false;
  };
  candidateSha256: string;
}

export interface NoelleHexereiPartialEquipmentCompositionReport {
  schemaVersion: 1;
  reportType: "noelle-hexerei-partial-equipment-composition";
  compositionId: typeof NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_ID;
  classification: "authenticated-guide-factory-partial-validation-composition";
  validationStatus: "authenticated-incomplete-validation-candidates";
  publicationStatus: "withheld-partial-validation-only";
  supportsPartialValidationComposition: true;
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allGeneratedFromHashesAuthenticatedFromText: true;
    jsonByteAndParsedObjectParity: true;
    exactCp51InputProjection: true;
    exactCp52InputProjection: true;
    sourceFileCount: number;
    generatedFromCount: number;
    jsonInputCount: 8;
  };
  upstreamBoundary: {
    cp51: {
      reportPath: typeof NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH;
      reportFileSha256: string;
      canonicalObjectSha256: string;
      freshlyAuthenticated: true;
      inputPathCount: number;
      profileCount: 2;
    };
    cp52: {
      reportPath: typeof NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH;
      reportFileSha256: string;
      canonicalObjectSha256: string;
      freshlyAuthenticated: true;
      inputPathCount: number;
      exactTeamCount: 1;
      localBindingCount: 1;
    };
  };
  preservedComputationRepresentationGate: NoelleInvestmentArtifactProfileComputationAdmissionReport["computationRepresentationAdmission"];
  candidates: NoelleHexereiPartialEquipmentValidationCandidate[];
  summary: {
    candidateCount: 2;
    partialValidationCandidateCount: 2;
    uniqueWeaponCount: 1;
    projectedWeaponOccurrenceCount: 2;
    uniqueArtifactSetCount: 1;
    projectedArtifactSetOccurrenceCount: 2;
    mainStatSlotGroupCount: 6;
    mainStatOptionGroupCount: 8;
    sourceMainStatOptionCount: 8;
    substatPriorityGroupCount: 6;
    candidateProjectionRunCount: 1;
    selectionCount: 0;
    assignmentCount: 0;
    completeBuildCount: 0;
    generatorRunCount: 0;
    optimizerRunCount: 0;
    autoTuneRunCount: 0;
    damageComputationCount: 0;
    rotationReplayCount: 0;
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
  supportsDamageClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  supportsIdealStatAllocation: false;
  arbitraryEnglishParsingAllowed: false;
  partialValidationCompositionExecuted: true;
  partialValidationCandidateProjectionExecuted: true;
  partialCandidateConstructionExecuted: true;
  recommendationCompositionExecuted: false;
  candidateGenerationExecuted: true;
  candidateGenerationKind: "deterministic-authenticated-branch-projection";
  generatorExecuted: false;
  optimizerExecuted: false;
  autoTuneExecuted: false;
  teamCompositionExecuted: false;
  buildCompositionExecuted: false;
  weaponAssignmentExecuted: false;
  artifactAssignmentExecuted: false;
  equipmentAssignmentExecuted: false;
  selectionExecuted: false;
  rankingExecuted: false;
  damageComputationExecuted: false;
  rotationReplayExecuted: false;
  idealStatAllocationExecuted: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type NoelleHexereiPartialEquipmentCompositionAuthentication =
  | {
      authenticated: true;
      canonicalReport: NoelleHexereiPartialEquipmentCompositionReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      message: string;
    };

interface AuthenticatedOuterInputs {
  sourceTextByPath: Map<string, string>;
  generatedFrom: GeneratedFromEntry[];
  parsedByKey: Record<keyof typeof JSON_INPUT_PATHS, unknown>;
}

export function buildNoelleHexereiPartialEquipmentCompositionReport(
  input: NoelleHexereiPartialEquipmentCompositionInput,
): NoelleHexereiPartialEquipmentCompositionReport {
  const raw = authenticateOuterInputs(input);
  const boundCp51Input = buildBoundCp51Input(raw);
  const boundCp52Input = buildBoundCp52Input(raw);
  authenticateSuppliedInputProjection("CP51", input.cp51Input, boundCp51Input);
  authenticateSuppliedInputProjection("CP52", input.cp52Input, boundCp52Input);

  const cp51Report =
    authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport(
      raw.parsedByKey
        .cp51ReportInput as NoelleInvestmentArtifactProfileComputationAdmissionReport,
      boundCp51Input,
    );
  const cp52Report =
    requireAuthenticatedNoelleHexereiWeaponTeamSourceBindingReport(
      raw.parsedByKey
        .cp52ReportInput as NoelleHexereiWeaponTeamSourceBindingReport,
      boundCp52Input,
    );
  assertNoelleHexereiPartialEquipmentUpstreamSemanticBoundaries(
    cp51Report,
    cp52Report,
  );
  const candidates = composeCandidates(cp51Report, cp52Report);
  const summary = buildSummary(candidates);

  return {
    schemaVersion: 1,
    reportType: "noelle-hexerei-partial-equipment-composition",
    compositionId: NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_ID,
    classification:
      "authenticated-guide-factory-partial-validation-composition",
    validationStatus: "authenticated-incomplete-validation-candidates",
    publicationStatus: "withheld-partial-validation-only",
    supportsPartialValidationComposition: true,
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromText: true,
      jsonByteAndParsedObjectParity: true,
      exactCp51InputProjection: true,
      exactCp52InputProjection: true,
      sourceFileCount: raw.sourceTextByPath.size,
      generatedFromCount: raw.generatedFrom.length,
      jsonInputCount: 8,
    },
    upstreamBoundary: {
      cp51: {
        reportPath: NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
        reportFileSha256: sha256Text(
          requiredSourceText(
            raw.sourceTextByPath,
            NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
          ),
        ),
        canonicalObjectSha256: hashValue(cp51Report),
        freshlyAuthenticated: true,
        inputPathCount:
          NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS.length,
        profileCount: 2,
      },
      cp52: {
        reportPath: NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
        reportFileSha256: sha256Text(
          requiredSourceText(
            raw.sourceTextByPath,
            NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
          ),
        ),
        canonicalObjectSha256: hashValue(cp52Report),
        freshlyAuthenticated: true,
        inputPathCount:
          NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS.length,
        exactTeamCount: 1,
        localBindingCount: 1,
      },
    },
    preservedComputationRepresentationGate: structuredClone(
      cp51Report.computationRepresentationAdmission,
    ),
    candidates,
    summary,
    supportsSourceAuthorization: false,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsBuildRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsRotationClaims: false,
    supportsEnergyRecoveryClaims: false,
    supportsIdealStatAllocation: false,
    arbitraryEnglishParsingAllowed: false,
    partialValidationCompositionExecuted: true,
    partialValidationCandidateProjectionExecuted: true,
    partialCandidateConstructionExecuted: true,
    recommendationCompositionExecuted: false,
    candidateGenerationExecuted: true,
    candidateGenerationKind: "deterministic-authenticated-branch-projection",
    generatorExecuted: false,
    optimizerExecuted: false,
    autoTuneExecuted: false,
    teamCompositionExecuted: false,
    buildCompositionExecuted: false,
    weaponAssignmentExecuted: false,
    artifactAssignmentExecuted: false,
    equipmentAssignmentExecuted: false,
    selectionExecuted: false,
    rankingExecuted: false,
    damageComputationExecuted: false,
    rotationReplayExecuted: false,
    idealStatAllocationExecuted: false,
    energyRecoveryComputationExecuted: false,
    cautions: [
      "The two candidates are deterministic projections of authenticated validation targets, not source-authored builds or runtime-generator output.",
      "The exact team has unspecified Noelle investment, so neither source investment predicate is evaluated or selected.",
      "Gest remains an applicable unranked option with missing refinement and quantitative performance, not a selected weapon.",
      "Every artifact main-stat option, ordinal substat group, provenance row, and guarded alternative is preserved without selection.",
      "The source rotation remains blocked by checkpoint 51's rejected exact-formula representation gate.",
    ],
    prohibitedInterpretations: [
      "Do not publish either partial candidate as a Noelle guide, team, build, equipment recommendation, or stat recommendation.",
      "Do not infer which investment branch applies to the exact team or compare the two branch projections.",
      "Do not treat Gest, Husk, a main stat, or a substat allocation as selected or assigned.",
      "Do not infer a refinement, weapon rank, quantitative comparison, complete build, ideal allocation, or owned-inventory result.",
      "Do not emit damage, rotation, DPS, or Energy Recharge claims from this composition.",
    ],
  };
}

export function authenticateNoelleHexereiPartialEquipmentCompositionReport(
  serializedReport: NoelleHexereiPartialEquipmentCompositionReport,
  input: NoelleHexereiPartialEquipmentCompositionInput,
): NoelleHexereiPartialEquipmentCompositionAuthentication {
  let canonicalReport: NoelleHexereiPartialEquipmentCompositionReport;
  try {
    canonicalReport = buildNoelleHexereiPartialEquipmentCompositionReport(input);
  } catch (error) {
    return {
      authenticated: false,
      reason: "canonical-inputs-rejected",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      message:
        "CP53 serialized report does not match a fresh canonical rebuild from authenticated inputs.",
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport(
  serializedReport: NoelleHexereiPartialEquipmentCompositionReport,
  input: NoelleHexereiPartialEquipmentCompositionInput,
): NoelleHexereiPartialEquipmentCompositionReport {
  const authentication =
    authenticateNoelleHexereiPartialEquipmentCompositionReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP53 authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

function authenticateOuterInputs(
  input: NoelleHexereiPartialEquipmentCompositionInput,
): AuthenticatedOuterInputs {
  const expectedPaths = [
    ...NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS,
  ].sort(compareText);
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
    throw new Error("CP53 exact outer source/generatedFrom path closure drifted.");
  }
  const sourceTextByPath = new Map(
    input.sourceFiles.map(({ path: sourcePath, text }) => [sourcePath, text]),
  );
  const generatedByPath = new Map(
    input.generatedFrom.map(({ path: sourcePath, sha256 }) => [
      sourcePath,
      sha256,
    ]),
  );
  for (const sourcePath of expectedPaths) {
    const sourceText = requiredSourceText(sourceTextByPath, sourcePath);
    const declaredSha256 = generatedByPath.get(sourcePath);
    if (
      declaredSha256 == null ||
      !/^[a-f0-9]{64}$/.test(declaredSha256) ||
      declaredSha256 !== sha256Text(sourceText)
    ) {
      throw new Error(`CP53 source/hash authentication drifted at ${sourcePath}.`);
    }
  }

  const parsedByKey = {} as Record<keyof typeof JSON_INPUT_PATHS, unknown>;
  for (const [key, sourcePath] of Object.entries(JSON_INPUT_PATHS) as Array<
    [keyof typeof JSON_INPUT_PATHS, string]
  >) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(requiredSourceText(sourceTextByPath, sourcePath));
    } catch {
      throw new Error(`CP53 JSON input is invalid at ${sourcePath}.`);
    }
    for (const supplied of suppliedJsonProjections(input, key)) {
      if (stableJson(parsed) !== stableJson(supplied)) {
        throw new Error(
          `CP53 parsed JSON input disagrees with a supplied upstream projection at ${sourcePath}.`,
        );
      }
    }
    parsedByKey[key] = parsed;
  }
  return {
    sourceTextByPath,
    generatedFrom: input.generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    parsedByKey,
  };
}

function suppliedJsonProjections(
  input: NoelleHexereiPartialEquipmentCompositionInput,
  key: keyof typeof JSON_INPUT_PATHS,
): unknown[] {
  switch (key) {
    case "repositoryInput":
      return [
        input.cp51Input.highSliceInput.repositoryInput,
        input.cp51Input.lowerSliceInput.repositoryInput,
        input.cp52Input.repositoryInput,
      ];
    case "manualSnapshotInput":
      return [
        input.cp51Input.highSliceInput.manualSnapshotInput,
        input.cp51Input.lowerSliceInput.manualSnapshotInput,
        input.cp52Input.manualSnapshotInput,
      ];
    case "manualIndexInput":
      return [
        input.cp51Input.highSliceInput.manualIndexInput,
        input.cp51Input.lowerSliceInput.manualIndexInput,
        input.cp52Input.manualIndexInput,
      ];
    case "sourceRegistryInput":
      return [
        input.cp51Input.highSliceInput.sourceRegistryInput,
        input.cp51Input.lowerSliceInput.sourceRegistryInput,
        input.cp52Input.sourceRegistryInput,
      ];
    case "highSliceReportInput":
      return [
        input.cp51Input.highSliceReport,
        input.cp52Input.highSliceReportInput,
      ];
    case "lowerSliceReportInput":
      return [input.cp51Input.lowerSliceReport];
    case "cp51ReportInput":
      return [input.cp51ReportInput];
    case "cp52ReportInput":
      return [input.cp52ReportInput];
  }
}

function buildBoundCp51Input(
  raw: AuthenticatedOuterInputs,
): NoelleInvestmentArtifactProfileComputationAdmissionInput {
  const highSliceInput = buildHighSliceInput(raw);
  const lowerSliceInput = buildLowerSliceInput(raw);
  return {
    highSliceReport:
      raw.parsedByKey
        .highSliceReportInput as NoelleSourceLocalHighInvestmentSliceReport,
    highSliceInput,
    lowerSliceReport:
      raw.parsedByKey
        .lowerSliceReportInput as NoelleSourceLocalLowerInvestmentSliceReport,
    lowerSliceInput,
    implementationFile: pinnedTextFile(raw, NOELLE_IMPLEMENTATION_RELATIVE_PATH),
    directDamageFile: pinnedTextFile(raw, NOELLE_DIRECT_DAMAGE_RELATIVE_PATH),
    compiledDamageFile: pinnedTextFile(
      raw,
      NOELLE_COMPILED_DAMAGE_RELATIVE_PATH,
    ),
    replayAdapterFile: pinnedTextFile(raw, NOELLE_REPLAY_ADAPTER_RELATIVE_PATH),
    sourceFiles: selectSourceFiles(
      raw,
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS,
    ),
    generatedFrom: selectGeneratedFrom(
      raw,
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
    ),
  };
}

function buildBoundCp52Input(
  raw: AuthenticatedOuterInputs,
): NoelleHexereiWeaponTeamSourceBindingInput {
  return {
    repositoryInput: raw.parsedByKey.repositoryInput,
    manualSnapshotInput: raw.parsedByKey.manualSnapshotInput,
    manualIndexInput: raw.parsedByKey.manualIndexInput,
    sourceRegistryInput: raw.parsedByKey.sourceRegistryInput,
    highSliceReportInput:
      raw.parsedByKey
        .highSliceReportInput as NoelleSourceLocalHighInvestmentSliceReport,
    sourceFiles: selectSourceFiles(
      raw,
      NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_SOURCE_FILE_PATHS,
    ),
    generatedFrom: selectGeneratedFrom(
      raw,
      NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
    ),
  };
}

function buildHighSliceInput(
  raw: AuthenticatedOuterInputs,
): BuildNoelleSourceLocalHighInvestmentSliceInput {
  return {
    repositoryInput: raw.parsedByKey.repositoryInput,
    manualSnapshotInput: raw.parsedByKey.manualSnapshotInput,
    manualIndexInput: raw.parsedByKey.manualIndexInput,
    sourceRegistryInput: raw.parsedByKey.sourceRegistryInput,
    sourceFiles: selectSourceFiles(
      raw,
      NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
    ),
    generatedFrom: selectGeneratedFrom(
      raw,
      NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
    ),
  };
}

function buildLowerSliceInput(
  raw: AuthenticatedOuterInputs,
): BuildNoelleSourceLocalLowerInvestmentSliceInput {
  return {
    repositoryInput: raw.parsedByKey.repositoryInput,
    manualSnapshotInput: raw.parsedByKey.manualSnapshotInput,
    manualIndexInput: raw.parsedByKey.manualIndexInput,
    sourceRegistryInput: raw.parsedByKey.sourceRegistryInput,
    sourceFiles: selectSourceFiles(
      raw,
      NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
    ),
    generatedFrom: selectGeneratedFrom(
      raw,
      NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
    ),
  };
}

function pinnedTextFile<TPath extends string>(
  raw: AuthenticatedOuterInputs,
  sourcePath: TPath,
): { path: TPath; text: string; sha256: string } {
  const generated = raw.generatedFrom.find(({ path }) => path === sourcePath);
  if (!generated) throw new Error(`CP53 missing generatedFrom ${sourcePath}.`);
  return {
    path: sourcePath,
    text: requiredSourceText(raw.sourceTextByPath, sourcePath),
    sha256: generated.sha256,
  };
}

function selectSourceFiles(
  raw: AuthenticatedOuterInputs,
  paths: readonly string[],
) {
  return paths.map((sourcePath) => ({
    path: sourcePath,
    text: requiredSourceText(raw.sourceTextByPath, sourcePath),
  }));
}

function selectGeneratedFrom(
  raw: AuthenticatedOuterInputs,
  paths: readonly string[],
): GeneratedFromEntry[] {
  const byPath = new Map(
    raw.generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  return paths.map((sourcePath) => {
    const entry = byPath.get(sourcePath);
    if (!entry) throw new Error(`CP53 missing generatedFrom ${sourcePath}.`);
    return { ...entry };
  });
}

function authenticateSuppliedInputProjection(
  label: "CP51" | "CP52",
  supplied:
    | NoelleInvestmentArtifactProfileComputationAdmissionInput
    | NoelleHexereiWeaponTeamSourceBindingInput,
  bound:
    | NoelleInvestmentArtifactProfileComputationAdmissionInput
    | NoelleHexereiWeaponTeamSourceBindingInput,
): void {
  if (stableJson(supplied) !== stableJson(bound)) {
    throw new Error(
      `CP53 supplied ${label} input is not the exact projection of the outer authenticated closure.`,
    );
  }
}

export function assertNoelleHexereiPartialEquipmentUpstreamSemanticBoundaries(
  cp51: NoelleInvestmentArtifactProfileComputationAdmissionReport,
  cp52: NoelleHexereiWeaponTeamSourceBindingReport,
): void {
  if (
    cp51.validationStatus !== "authenticated-representation-blocked" ||
    cp51.profiles.length !== 2 ||
    cp51.summary.profileCount !== 2 ||
    cp51.summary.sourceArtifactSetCount !== 1 ||
    cp51.summary.sourceMainStatOptionCount !== 8 ||
    cp51.summary.sourceSubstatPriorityGroupCount !== 6 ||
    cp51.computationRepresentationAdmission.admissionStatus !==
      "rejected-exact-formula-representation-missing" ||
    cp51.computationRepresentationAdmission.numericReplayAdmitted ||
    cp51.computationRepresentationAdmission.numericResult !== null ||
    cp51.summary.candidateCount !== 0 ||
    cp51.summary.generatedTeamCount !== 0 ||
    cp51.summary.assembledBuildCount !== 0 ||
    cp51.summary.artifactAssignmentCount !== 0 ||
    cp51.summary.optimizerRunCount !== 0 ||
    cp51.summary.admittedReplayCount !== 0 ||
    cp51.summary.numericResultCount !== 0 ||
    cp51.supportsSourceAuthorization ||
    cp51.supportsGuideClaims ||
    cp51.supportsTeamRecommendations ||
    cp51.supportsBuildRecommendations ||
    cp51.supportsEquipmentRecommendations ||
    cp51.supportsStatRecommendations ||
    cp51.supportsRankClaims ||
    cp51.supportsDamageClaims ||
    cp51.supportsRotationClaims ||
    cp51.supportsEnergyRecoveryClaims ||
    cp51.supportsIdealStatAllocation ||
    cp51.recommendationCompositionExecuted ||
    cp51.candidateGenerationExecuted ||
    cp51.generatorExecuted ||
    cp51.autoTuneExecuted ||
    cp51.teamCompositionExecuted ||
    cp51.buildCompositionExecuted ||
    cp51.artifactAssignmentExecuted ||
    cp51.weaponAssignmentExecuted ||
    cp51.optimizerExecuted ||
    cp51.damageComputationExecuted ||
    cp51.rotationReplayExecuted ||
    cp51.energyRecoveryComputationExecuted
  ) {
    throw new Error("CP53 authenticated CP51 semantic boundary drifted.");
  }
  authenticateCp52BindingAuthorityLedger(cp52);
  if (
    cp52.validationStatus !== "authenticated-validation-target" ||
    cp52.summary.exactTeamCount !== 1 ||
    cp52.summary.localBindingCount !== 1 ||
    cp52.summary.candidateCount !== 0 ||
    cp52.summary.assembledBuildCount !== 0 ||
    cp52.summary.equipmentAssignmentCount !== 0 ||
    cp52.summary.selectionCount !== 0 ||
    cp52.summary.derivedRankCount !== 0 ||
    cp52.summary.generatorRunCount !== 0 ||
    cp52.summary.optimizerRunCount !== 0 ||
    cp52.summary.damageComputationCount !== 0 ||
    cp52.summary.rotationReplayCount !== 0 ||
    cp52.summary.energyRecoveryComputationCount !== 0 ||
    cp52.binding.applicabilityClassification !==
      "applicable-under-source-section-classification" ||
    cp52.binding.scope !== "exact-team-only" ||
    cp52.binding.derivedEquipmentRecommendationCreated ||
    cp52.weaponObservation.weaponId !== "gest_of_the_mighty_wolf" ||
    cp52.weaponObservation.weaponOrdering !== "unranked" ||
    cp52.weaponObservation.refinement !== null ||
    cp52.weaponObservation.refinementStatus !== "missing-not-zero" ||
    cp52.weaponObservation.quantitativePerformanceStatus !==
      "missing-not-zero" ||
    cp52.exactTeam.noelleSourceMemberWeaponRecommendationCount !== 0 ||
    cp52.exactTeam.noelleConsolidatedSelectedWeapon !== null ||
    cp52.supportsSourceAuthorization ||
    cp52.supportsGuideClaims ||
    cp52.supportsTeamRecommendations ||
    cp52.supportsBuildRecommendations ||
    cp52.supportsEquipmentRecommendations ||
    cp52.supportsStatRecommendations ||
    cp52.supportsRankClaims ||
    cp52.supportsDamageClaims ||
    cp52.supportsRotationClaims ||
    cp52.supportsEnergyRecoveryClaims ||
    cp52.supportsIdealStatAllocation ||
    cp52.recommendationCompositionExecuted ||
    cp52.candidateGenerationExecuted ||
    cp52.generatorExecuted ||
    cp52.autoTuneExecuted ||
    cp52.teamCompositionExecuted ||
    cp52.buildCompositionExecuted ||
    cp52.weaponAssignmentExecuted ||
    cp52.artifactAssignmentExecuted ||
    cp52.equipmentAssignmentExecuted ||
    cp52.selectionExecuted ||
    cp52.rankingExecuted ||
    cp52.optimizerExecuted ||
    cp52.damageComputationExecuted ||
    cp52.rotationReplayExecuted ||
    cp52.idealStatAllocationExecuted ||
    cp52.energyRecoveryComputationExecuted
  ) {
    throw new Error("CP53 authenticated CP52 semantic boundary drifted.");
  }
  const profileIds = cp51.profiles.map(({ profileId }) => profileId);
  if (
    stableJson(profileIds) !==
      stableJson([
        "noelle-lower-investment-artifact-profile-v1",
        "noelle-high-investment-artifact-profile-v1",
      ]) ||
    cp51.profiles.some(
      (profile) =>
        profile.characterId !== "noelle" ||
        profile.status !== "partial-source-backed-validation-target-not-build" ||
        profile.artifactSet.set.type !== "4pc" ||
        profile.artifactSet.set.setId !== "husk_of_opulent_dreams" ||
        profile.artifactSet.assignedToRuntimeBuild ||
        profile.substatPriority.selectedAllocation !== null ||
        profile.substatPriority.scalarWeights !== null ||
        Object.values(profile.mainStats).some(
          ({ selectedOptionIndex }) => selectedOptionIndex !== null,
        )
    )
  ) {
    throw new Error("CP53 authenticated CP51 profile boundary drifted.");
  }
}

function authenticateCp52BindingAuthorityLedger(
  cp52: NoelleHexereiWeaponTeamSourceBindingReport,
): void {
  const { bindingSha256, ...bindingAuthorityLedger } = cp52.binding;
  const expectedBindingAuthorityLedger = {
    applicabilityClassification:
      "applicable-under-source-section-classification",
    scope: "exact-team-only",
    exactTeamRepositoryRecordId:
      "kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii",
    characterId: "noelle",
    weaponId: "gest_of_the_mighty_wolf",
    sourceCondition: "Noelle is played in a Hexerei team.",
    sourceSectionHeading:
      "Teams > Hexerei Teams > Example Teams > Noelle — Durin — Nicole — Xilonen",
    sourceAuthoredCondition: true,
    sourceAuthoredTeamSectionClassification: true,
    sourceAuthoredCrossRecordJoin: false,
    guideFactoryAuthoredCrossRecordJoin: true,
    bindingMethod: "cp52-exact-condition-and-heading-allowlist",
    arbitraryEnglishParsingAllowed: false,
    teamAssignmentAuthoredBySource: false,
    equipmentAssignmentCreated: false,
    selectionExecuted: false,
    rankDerived: false,
    derivedEquipmentRecommendationCreated: false,
    validationTargetCreated: true,
  };
  const expectedBindingAuthorityLedgerSha256 =
    "7312bd3cac0724d73c0f3265132ecffaeed834d63c95aa4196463e19b998adee";
  if (
    stableJson(bindingAuthorityLedger) !==
      stableJson(expectedBindingAuthorityLedger) ||
    hashValue(expectedBindingAuthorityLedger) !==
      expectedBindingAuthorityLedgerSha256 ||
    bindingSha256 !== expectedBindingAuthorityLedgerSha256 ||
    bindingSha256 !== hashValue(bindingAuthorityLedger)
  ) {
    throw new Error("CP53 authenticated CP52 binding authority ledger drifted.");
  }
}

function composeCandidates(
  cp51: NoelleInvestmentArtifactProfileComputationAdmissionReport,
  cp52: NoelleHexereiWeaponTeamSourceBindingReport,
): NoelleHexereiPartialEquipmentValidationCandidate[] {
  const roster = cp52.exactTeam.orderedCharacterIds;
  if (
    stableJson(roster) !==
      stableJson(["noelle", "durin", "nicole", "xilonen"])
  ) {
    throw new Error("CP53 exact-team roster drifted.");
  }
  return cp51.profiles.map((profile) => {
    const candidateWithoutHash = {
      candidateId: `${profile.profileId}:gest-exact-hexerei-team`,
      status: "request-parameterized-partial-validation-candidate" as const,
      characterId: "noelle" as const,
      team: {
        sourceRecordId: cp52.exactTeam.sourceRecordId,
        repositoryRecordId: cp52.exactTeam.repositoryRecordId,
        orderedCharacterIds: [...roster] as [
          "noelle",
          "durin",
          "nicole",
          "xilonen",
        ],
        noelleInvestment: { status: "unspecified" as const },
        investmentBranchEvaluation: "not-evaluated" as const,
        investmentBranchSelected: false as const,
      },
      artifactProfile: structuredClone(profile),
      weaponOption: {
        sourceObservation: structuredClone(cp52.weaponObservation),
        applicabilityBinding: structuredClone(cp52.binding),
        projectedForCandidate: true as const,
        applicableButUnranked: true as const,
        refinement: null,
        refinementStatus: "missing-not-zero" as const,
        quantitativePerformanceStatus: "missing-not-zero" as const,
      },
      selections: {
        selectedWeapon: null,
        selectedArtifactSet: null,
        selectedMainStats: { sands: null, goblet: null, circlet: null },
        selectedSubstatAllocation: null,
      },
      completeness: {
        guardedAlternativesPreservedUnchanged: true as const,
        embeddedArtifactProfileWeaponBoundaryPreserved:
          "missing-not-zero" as const,
        applicableWeaponOptionProjectedSeparately: true as const,
        completeArtifactAssignment: false as const,
        completeBuild: false as const,
      },
      authorship: {
        sourceAuthoredCandidate: false as const,
        sourceAuthoredComposite: false as const,
        guideFactoryAuthoredPartialComposition: true as const,
        guideFactoryAuthoredProjection: true as const,
        existingRuntimeGeneratorProducedCandidate: false as const,
      },
    };
    return {
      ...candidateWithoutHash,
      candidateSha256: hashValue(candidateWithoutHash),
    };
  });
}

function buildSummary(
  candidates: readonly NoelleHexereiPartialEquipmentValidationCandidate[],
): NoelleHexereiPartialEquipmentCompositionReport["summary"] {
  const weaponIds = candidates.map(
    ({ weaponOption }) => weaponOption.sourceObservation.weaponId,
  );
  const artifactSetIds = candidates.map(({ artifactProfile }) => {
    const { set } = artifactProfile.artifactSet;
    if (set.type !== "4pc") {
      throw new Error("CP53 expected a four-piece artifact-set option.");
    }
    return set.setId;
  });
  const mainStatSlotGroupCount = candidates.reduce(
    (sum, { artifactProfile }) =>
      sum + Object.keys(artifactProfile.mainStats).length,
    0,
  );
  const mainStatOptionGroupCount = candidates.reduce(
    (sum, { artifactProfile }) =>
      sum +
      Object.values(artifactProfile.mainStats).reduce(
        (slotSum, { options }) => slotSum + options.length,
        0,
      ),
    0,
  );
  const substatPriorityGroupCount = candidates.reduce(
    (sum, { artifactProfile }) =>
      sum + artifactProfile.substatPriority.groups.length,
    0,
  );
  if (
    candidates.length !== 2 ||
    new Set(candidates.map(({ candidateId }) => candidateId)).size !== 2 ||
    new Set(weaponIds).size !== 1 ||
    weaponIds.length !== 2 ||
    new Set(artifactSetIds).size !== 1 ||
    artifactSetIds.length !== 2 ||
    mainStatSlotGroupCount !== 6 ||
    mainStatOptionGroupCount !== 8 ||
    substatPriorityGroupCount !== 6 ||
    candidates.some(
      (candidate) =>
        candidate.artifactProfile.missingBoundaries.weapon !==
          "missing-not-zero" ||
        candidate.team.investmentBranchEvaluation !== "not-evaluated" ||
        candidate.team.investmentBranchSelected ||
        candidate.selections.selectedWeapon !== null ||
        candidate.selections.selectedArtifactSet !== null ||
        candidate.selections.selectedMainStats.sands !== null ||
        candidate.selections.selectedMainStats.goblet !== null ||
        candidate.selections.selectedMainStats.circlet !== null ||
        candidate.selections.selectedSubstatAllocation !== null ||
        candidate.completeness.completeArtifactAssignment ||
        candidate.completeness.completeBuild
    )
  ) {
    throw new Error("CP53 partial-candidate closure drifted.");
  }
  return {
    candidateCount: 2,
    partialValidationCandidateCount: 2,
    uniqueWeaponCount: 1,
    projectedWeaponOccurrenceCount: 2,
    uniqueArtifactSetCount: 1,
    projectedArtifactSetOccurrenceCount: 2,
    mainStatSlotGroupCount: 6,
    mainStatOptionGroupCount: 8,
    sourceMainStatOptionCount: 8,
    substatPriorityGroupCount: 6,
    candidateProjectionRunCount: 1,
    selectionCount: 0,
    assignmentCount: 0,
    completeBuildCount: 0,
    generatorRunCount: 0,
    optimizerRunCount: 0,
    autoTuneRunCount: 0,
    damageComputationCount: 0,
    rotationReplayCount: 0,
    idealStatAllocationCount: 0,
    energyRecoveryComputationCount: 0,
  };
}

function requiredSourceText(
  sourceTextByPath: ReadonlyMap<string, string>,
  sourcePath: string,
): string {
  const value = sourceTextByPath.get(sourcePath);
  if (value == null) throw new Error(`CP53 missing source text ${sourcePath}.`);
  return value;
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
