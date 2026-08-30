import path from "node:path";
import { sha256Text, stableJson } from "./io";
import {
  authenticateNoelleSourceLocalHighInvestmentSliceReport,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalHighInvestmentSliceInput,
  type NoelleSourceLocalHighInvestmentSliceReport,
} from "./noelleSourceLocalHighInvestmentSlice";
import { FACTORY_ROOT } from "./paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
} from "./schemas";
import type { GeneratedFromEntry } from "./sourceConditionedGuidePacket";

export const NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_ID =
  "noelle-hexerei-gest-exact-team-source-binding-v1";
export const NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "noelle-hexerei-weapon-team-source-binding.json",
);

export const NOELLE_HEXEREI_EXACT_SOURCE_CONDITION =
  "Noelle is played in a Hexerei team.";
export const NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING =
  "Teams > Hexerei Teams > Example Teams > Noelle — Durin — Nicole — Xilonen";

export const NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID =
  "noelle-hexerei-gest-luna-viii";
export const NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID =
  "noelle-durin-nicole-xilonen-hexerei-example-luna-viii";
export const NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID =
  "kqm:character-guide:noelle-hexerei-gest-luna-viii";
export const NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID =
  "kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii";

export const NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-source-local-high-investment-slice.json";
export const NOELLE_HEXEREI_MANUAL_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json";
export const NOELLE_HEXEREI_KNOWLEDGE_REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
export const NOELLE_HEXEREI_MANUAL_INDEX_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
export const NOELLE_HEXEREI_SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
export const NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/noelleHexereiWeaponTeamSourceBinding.ts";
export const NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_CLI_RELATIVE_PATH =
  "scripts/guide-factory/src/assemble-noelle-hexerei-weapon-team-source-binding.ts";

const SOURCE_URL = "https://keqingmains.com/q/noelle-quickguide/";
const SOURCE_VERSION = "Luna VIII";
const GEST_LOCATOR_HEADING = "Weapons > Gest of the Mighty Wolf";
const GEST_OCCURRENCE_ID =
  "kqm:character_guide:noelle-hexerei-gest-luna-viii:recommendation.weaponRecommendations[0].conditions";
const GEST_CONDITIONS_SHA256 =
  "f27375a8ce8833cc0326a17c94f52c71ed4f44a72868e15d087390b864e490cf";
const GEST_MANUAL_RECORD_SHA256 =
  "cc303b82e147a8220675f5e9865868273251e5c68cdad3f88b20a9cbddb73ff8";
const GEST_REPOSITORY_RECORD_SHA256 =
  "bd2d5011230d9348402402ea5b7bee8ec75d4ecd91f7895f6899ef8ffb20f2fe";
const TEAM_MANUAL_RECORD_SHA256 =
  "35c67b57276cafba29250e7416e8ab7efb3b49540b0609621e5a056e146ce9c7";
const TEAM_REPOSITORY_RECORD_SHA256 =
  "f797ff46aff29917c60d50e7e7ebc1abb2fc0dbdd1983752a90df20eb8c7aa79";

const JSON_INPUT_PATHS = {
  repositoryInput: NOELLE_HEXEREI_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
  manualSnapshotInput: NOELLE_HEXEREI_MANUAL_SNAPSHOT_RELATIVE_PATH,
  manualIndexInput: NOELLE_HEXEREI_MANUAL_INDEX_RELATIVE_PATH,
  sourceRegistryInput: NOELLE_HEXEREI_SOURCE_REGISTRY_RELATIVE_PATH,
  highSliceReportInput: NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
} as const;

export const NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS = [
  ...new Set([
    ...NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
    NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
    NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_CORE_RELATIVE_PATH,
    NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_CLI_RELATIVE_PATH,
  ]),
].sort(compareText);

export const NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_SOURCE_FILE_PATHS = [
  ...NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
];

export interface NoelleHexereiWeaponTeamSourceBindingSourceFile {
  path: string;
  text: string;
}

export interface NoelleHexereiWeaponTeamSourceBindingInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  highSliceReportInput: NoelleSourceLocalHighInvestmentSliceReport;
  sourceFiles: readonly NoelleHexereiWeaponTeamSourceBindingSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface NoelleHexereiWeaponTeamSourceBindingReport {
  schemaVersion: 1;
  reportType: "noelle-hexerei-weapon-team-source-binding";
  bindingId: typeof NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_ID;
  classification: "authenticated-same-source-cross-record-applicability-binding";
  validationStatus: "authenticated-validation-target";
  publicationStatus: "withheld-unreviewed-source-binding";
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathSet: true;
    exactGeneratedFromPathSet: true;
    allGeneratedFromHashesAuthenticatedFromText: true;
    jsonByteAndParsedObjectParity: true;
    sourceFileCount: number;
    generatedFromCount: number;
    jsonInputCount: 5;
  };
  upstreamBoundary: {
    status: "accepted";
    durableReportPath: typeof NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH;
    durableReportFileSha256: string;
    durableReportCanonicalObjectSha256: string;
    freshlyAuthenticated: true;
    upstreamInputCount: number;
    occurrenceId: typeof GEST_OCCURRENCE_ID;
    conditionsSha256: typeof GEST_CONDITIONS_SHA256;
    occurrenceDisposition: "holdout";
    consumedByUpstreamSlice: false;
    bindingAuthoredByUpstreamSlice: false;
    energyClassificationAuthoredByUpstreamSlice: false;
    structuralEnergyDimension: "not-structural-er";
  };
  sourceParityBoundary: {
    status: "exact";
    sourceId: "kqm";
    sourceUrl: typeof SOURCE_URL;
    sourceVersion: typeof SOURCE_VERSION;
    sameSourceDocument: true;
    manualRecordCount: 2;
    consolidatedRecordCount: 2;
    records: Array<{
      sourceRecordId: string;
      repositoryRecordId: string;
      kind: "character_guide" | "team";
      manualRecordSha256: string;
      repositoryRecordSha256: string;
      payloadParity: "exact-normalized-consolidation";
      sourceRefParity: "exact";
      repositoryStatus: "candidate";
      promotionEligible: false;
    }>;
  };
  weaponObservation: {
    sourceRecordId: typeof NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID;
    repositoryRecordId: typeof NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID;
    recommendationId: "hexerei-gest";
    weaponId: "gest_of_the_mighty_wolf";
    weaponOrdering: "unranked";
    grouping: "single";
    sourceClassification: "conditional";
    sourceConditions: [typeof NOELLE_HEXEREI_EXACT_SOURCE_CONDITION];
    sourceConditionStatus: "guarded-source-observation";
    refinement: null;
    refinementStatus: "missing-not-zero";
    quantitativePerformanceStatus: "missing-not-zero";
  };
  exactTeam: {
    sourceRecordId: typeof NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID;
    repositoryRecordId: typeof NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID;
    locatorHeading: typeof NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING;
    label: "Noelle — Durin — Nicole — Xilonen";
    intent: "example";
    exhaustiveness: "non-exhaustive";
    rankingClaim: "none";
    orderedCharacterIds: ["noelle", "durin", "nicole", "xilonen"];
    noelleSourceMemberWeaponRecommendations: [];
    noelleSourceMemberWeaponRecommendationCount: 0;
    noelleConsolidatedSelectedWeapon: null;
    teamMemberWeaponAndRefinementStatus: "missing-not-zero";
  };
  binding: {
    applicabilityClassification: "applicable-under-source-section-classification";
    scope: "exact-team-only";
    exactTeamRepositoryRecordId: typeof NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID;
    characterId: "noelle";
    weaponId: "gest_of_the_mighty_wolf";
    sourceCondition: typeof NOELLE_HEXEREI_EXACT_SOURCE_CONDITION;
    sourceSectionHeading: typeof NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING;
    sourceAuthoredCondition: true;
    sourceAuthoredTeamSectionClassification: true;
    sourceAuthoredCrossRecordJoin: false;
    guideFactoryAuthoredCrossRecordJoin: true;
    bindingMethod: "cp52-exact-condition-and-heading-allowlist";
    arbitraryEnglishParsingAllowed: false;
    teamAssignmentAuthoredBySource: false;
    equipmentAssignmentCreated: false;
    selectionExecuted: false;
    rankDerived: false;
    derivedEquipmentRecommendationCreated: false;
    validationTargetCreated: true;
    bindingSha256: string;
  };
  summary: {
    sourceRecordCount: 2;
    upstreamHoldoutOccurrenceCount: 1;
    exactTeamCount: 1;
    localBindingCount: 1;
    candidateCount: 0;
    assembledBuildCount: 0;
    equipmentAssignmentCount: 0;
    selectionCount: 0;
    derivedRankCount: 0;
    generatorRunCount: 0;
    optimizerRunCount: 0;
    damageComputationCount: 0;
    rotationReplayCount: 0;
    energyRecoveryComputationCount: 0;
  };
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsBuildRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsIdealStatAllocation: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  candidateGenerationExecuted: false;
  recommendationCompositionExecuted: false;
  generatorExecuted: false;
  autoTuneExecuted: false;
  optimizerExecuted: false;
  teamCompositionExecuted: false;
  buildCompositionExecuted: false;
  weaponAssignmentExecuted: false;
  artifactAssignmentExecuted: false;
  equipmentAssignmentExecuted: false;
  selectionExecuted: false;
  rankingExecuted: false;
  idealStatAllocationExecuted: false;
  damageComputationExecuted: false;
  rotationReplayExecuted: false;
  energyRecoveryComputationExecuted: false;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type NoelleHexereiWeaponTeamSourceBindingAuthentication =
  | {
      authenticated: true;
      canonicalReport: NoelleHexereiWeaponTeamSourceBindingReport;
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

export function buildNoelleHexereiWeaponTeamSourceBindingReport(
  input: NoelleHexereiWeaponTeamSourceBindingInput,
): NoelleHexereiWeaponTeamSourceBindingReport {
  const raw = authenticateOuterInputs(input);
  const repository = KnowledgeRepositorySchema.parse(
    raw.parsedByKey.repositoryInput,
  );
  const snapshot = ManualObservationSnapshotSchema.parse(
    raw.parsedByKey.manualSnapshotInput,
  );
  const manualIndex = ManualSnapshotIndexSchema.parse(
    raw.parsedByKey.manualIndexInput,
  );
  const sourceRegistry = SourceRegistrySchema.parse(
    raw.parsedByKey.sourceRegistryInput,
  );
  const highSliceReport = raw.parsedByKey
    .highSliceReportInput as NoelleSourceLocalHighInvestmentSliceReport;

  const highSliceInput = buildBoundHighSliceInput(raw, {
    repository,
    snapshot,
    manualIndex,
    sourceRegistry,
  });
  const highAuthentication =
    authenticateNoelleSourceLocalHighInvestmentSliceReport(
      highSliceReport,
      highSliceInput,
    );
  if (!highAuthentication.authenticated) {
    throw new Error(
      `CP52 high-investment slice failed fresh authentication (${highAuthentication.reason}).`,
    );
  }

  const upstreamOccurrence = authenticateGestUpstreamOccurrence(
    highAuthentication.canonicalReport,
  );
  const parity = authenticateSourceParity(repository, snapshot);
  const bindingWithoutHash = {
    applicabilityClassification:
      "applicable-under-source-section-classification" as const,
    scope: "exact-team-only" as const,
    exactTeamRepositoryRecordId:
      NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID as typeof NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
    characterId: "noelle" as const,
    weaponId: "gest_of_the_mighty_wolf" as const,
    sourceCondition:
      NOELLE_HEXEREI_EXACT_SOURCE_CONDITION as typeof NOELLE_HEXEREI_EXACT_SOURCE_CONDITION,
    sourceSectionHeading:
      NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING as typeof NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING,
    sourceAuthoredCondition: true as const,
    sourceAuthoredTeamSectionClassification: true as const,
    sourceAuthoredCrossRecordJoin: false as const,
    guideFactoryAuthoredCrossRecordJoin: true as const,
    bindingMethod: "cp52-exact-condition-and-heading-allowlist" as const,
    arbitraryEnglishParsingAllowed: false as const,
    teamAssignmentAuthoredBySource: false as const,
    equipmentAssignmentCreated: false as const,
    selectionExecuted: false as const,
    rankDerived: false as const,
    derivedEquipmentRecommendationCreated: false as const,
    validationTargetCreated: true as const,
  };
  const highReportText = requiredSourceText(
    raw.sourceTextByPath,
    NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
  );

  return {
    schemaVersion: 1,
    reportType: "noelle-hexerei-weapon-team-source-binding",
    bindingId: NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_ID,
    classification:
      "authenticated-same-source-cross-record-applicability-binding",
    validationStatus: "authenticated-validation-target",
    publicationStatus: "withheld-unreviewed-source-binding",
    generatedFrom: raw.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromText: true,
      jsonByteAndParsedObjectParity: true,
      sourceFileCount: raw.sourceTextByPath.size,
      generatedFromCount: raw.generatedFrom.length,
      jsonInputCount: 5,
    },
    upstreamBoundary: {
      status: "accepted",
      durableReportPath: NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
      durableReportFileSha256: sha256Text(highReportText),
      durableReportCanonicalObjectSha256: sha256Text(
        stableJson(highAuthentication.canonicalReport),
      ),
      freshlyAuthenticated: true,
      upstreamInputCount:
        NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS.length,
      occurrenceId: GEST_OCCURRENCE_ID,
      conditionsSha256: GEST_CONDITIONS_SHA256,
      occurrenceDisposition: "holdout",
      consumedByUpstreamSlice: false,
      bindingAuthoredByUpstreamSlice: false,
      energyClassificationAuthoredByUpstreamSlice: false,
      structuralEnergyDimension: "not-structural-er",
    },
    sourceParityBoundary: parity.sourceParityBoundary,
    weaponObservation: parity.weaponObservation,
    exactTeam: parity.exactTeam,
    binding: {
      ...bindingWithoutHash,
      bindingSha256: hashValue(bindingWithoutHash),
    },
    summary: {
      sourceRecordCount: 2,
      upstreamHoldoutOccurrenceCount: 1,
      exactTeamCount: 1,
      localBindingCount: 1,
      candidateCount: 0,
      assembledBuildCount: 0,
      equipmentAssignmentCount: 0,
      selectionCount: 0,
      derivedRankCount: 0,
      generatorRunCount: 0,
      optimizerRunCount: 0,
      damageComputationCount: 0,
      rotationReplayCount: 0,
      energyRecoveryComputationCount: 0,
    },
    supportsSourceAuthorization: false,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsBuildRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsIdealStatAllocation: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsRotationClaims: false,
    supportsEnergyRecoveryClaims: false,
    candidateGenerationExecuted: false,
    recommendationCompositionExecuted: false,
    generatorExecuted: false,
    autoTuneExecuted: false,
    optimizerExecuted: false,
    teamCompositionExecuted: false,
    buildCompositionExecuted: false,
    weaponAssignmentExecuted: false,
    artifactAssignmentExecuted: false,
    equipmentAssignmentExecuted: false,
    selectionExecuted: false,
    rankingExecuted: false,
    idealStatAllocationExecuted: false,
    damageComputationExecuted: false,
    rotationReplayExecuted: false,
    energyRecoveryComputationExecuted: false,
    cautions: [
      "The Gest and exact-team records are agent-assisted, unreviewed source observations retained as a validation target only.",
      "Applicable-under-source-section-classification is a Guide Factory allowlisted join between two records on one source page, not a source-authored team weapon assignment.",
      "The exact team member row contains no weapon recommendation, and neither source record supplies a refinement assumption or quantitative comparison.",
      "Repository candidate is an ingestion status; checkpoint 52 generates zero equipment or build candidates.",
    ],
    prohibitedInterpretations: [
      "Do not publish this binding as a Noelle guide, team recommendation, equipment recommendation, or build.",
      "Do not claim that the source assigned Gest of the Mighty Wolf to the exact team member row.",
      "Do not infer a refinement, weapon rank, selection, comparison winner, or quantitative performance.",
      "Do not generalize this exact-team validation target to other Hexerei teams or arbitrary teams.",
      "Do not infer damage, rotation feasibility, DPS, ideal stats, or an Energy Recharge requirement.",
    ],
  };
}

export function authenticateNoelleHexereiWeaponTeamSourceBindingReport(
  serializedReport: NoelleHexereiWeaponTeamSourceBindingReport,
  input: NoelleHexereiWeaponTeamSourceBindingInput,
): NoelleHexereiWeaponTeamSourceBindingAuthentication {
  let canonicalReport: NoelleHexereiWeaponTeamSourceBindingReport;
  try {
    canonicalReport = buildNoelleHexereiWeaponTeamSourceBindingReport(input);
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
        "CP52 serialized report does not match a fresh canonical rebuild from authenticated inputs.",
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireAuthenticatedNoelleHexereiWeaponTeamSourceBindingReport(
  serializedReport: NoelleHexereiWeaponTeamSourceBindingReport,
  input: NoelleHexereiWeaponTeamSourceBindingInput,
): NoelleHexereiWeaponTeamSourceBindingReport {
  const authentication =
    authenticateNoelleHexereiWeaponTeamSourceBindingReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP52 authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

function authenticateOuterInputs(
  input: NoelleHexereiWeaponTeamSourceBindingInput,
): AuthenticatedOuterInputs {
  const expectedPaths = [
    ...NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
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
    throw new Error("CP52 exact outer source/generatedFrom path closure drifted.");
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
    const text = requiredSourceText(sourceTextByPath, sourcePath);
    const declaredHash = generatedByPath.get(sourcePath);
    if (
      declaredHash == null ||
      !/^[a-f0-9]{64}$/.test(declaredHash) ||
      declaredHash !== sha256Text(text)
    ) {
      throw new Error(`CP52 source/hash authentication drifted at ${sourcePath}.`);
    }
  }

  const suppliedByKey: Record<keyof typeof JSON_INPUT_PATHS, unknown> = {
    repositoryInput: input.repositoryInput,
    manualSnapshotInput: input.manualSnapshotInput,
    manualIndexInput: input.manualIndexInput,
    sourceRegistryInput: input.sourceRegistryInput,
    highSliceReportInput: input.highSliceReportInput,
  };
  const parsedByKey = {} as Record<keyof typeof JSON_INPUT_PATHS, unknown>;
  for (const [key, sourcePath] of Object.entries(JSON_INPUT_PATHS) as Array<
    [keyof typeof JSON_INPUT_PATHS, string]
  >) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(requiredSourceText(sourceTextByPath, sourcePath));
    } catch {
      throw new Error(`CP52 JSON input is invalid at ${sourcePath}.`);
    }
    if (stableJson(parsed) !== stableJson(suppliedByKey[key])) {
      throw new Error(
        `CP52 parsed JSON input disagrees with authenticated text at ${sourcePath}.`,
      );
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

function buildBoundHighSliceInput(
  raw: AuthenticatedOuterInputs,
  parsed: {
    repository: unknown;
    snapshot: unknown;
    manualIndex: unknown;
    sourceRegistry: unknown;
  },
): BuildNoelleSourceLocalHighInvestmentSliceInput {
  const generatedByPath = new Map(
    raw.generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  return {
    repositoryInput: parsed.repository,
    manualSnapshotInput: parsed.snapshot,
    manualIndexInput: parsed.manualIndex,
    sourceRegistryInput: parsed.sourceRegistry,
    sourceFiles:
      NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS.map(
        (sourcePath) => ({
          path: sourcePath,
          text: requiredSourceText(raw.sourceTextByPath, sourcePath),
        }),
      ),
    generatedFrom: NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS.map(
      (sourcePath) => {
        const entry = generatedByPath.get(sourcePath);
        if (!entry) {
          throw new Error(`CP52 missing upstream generatedFrom ${sourcePath}.`);
        }
        return { ...entry };
      },
    ),
  };
}

function authenticateGestUpstreamOccurrence(
  report: NoelleSourceLocalHighInvestmentSliceReport,
) {
  const matches = report.holdoutOccurrences.filter(
    ({ occurrenceId }) => occurrenceId === GEST_OCCURRENCE_ID,
  );
  const occurrence = matches[0];
  if (
    matches.length !== 1 ||
    !occurrence ||
    occurrence.sourceRecordId !== NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID ||
    occurrence.repositoryRecordId !==
      NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID ||
    occurrence.manualClaimPath !==
      "recommendation.weaponRecommendations[0].conditions" ||
    occurrence.repositoryPath !==
      "recommendations[0].weaponRecommendations[0].conditions" ||
    occurrence.claimAxis !== "weapon-recommendation" ||
    stableJson(occurrence.conditions) !==
      stableJson([NOELLE_HEXEREI_EXACT_SOURCE_CONDITION]) ||
    occurrence.conditionsSha256 !== GEST_CONDITIONS_SHA256 ||
    occurrence.structuralEnergyDimension !== "not-structural-er" ||
    occurrence.repositoryParity !== "exact" ||
    occurrence.sliceDisposition !== "holdout" ||
    occurrence.consumedBySlice ||
    occurrence.bindingAuthoredBySlice ||
    occurrence.energyClassificationAuthoredBySlice
  ) {
    throw new Error("CP52 exact Gest upstream holdout boundary drifted.");
  }
  return occurrence;
}

function authenticateSourceParity(
  repository: { records: readonly unknown[] },
  snapshot: {
    sourceId: string;
    page: { url: string; sourceVersion?: string };
    records: readonly { sourceRecordId: string }[];
  },
): Pick<
  NoelleHexereiWeaponTeamSourceBindingReport,
  "sourceParityBoundary" | "weaponObservation" | "exactTeam"
> {
  if (
    snapshot.sourceId !== "kqm" ||
    snapshot.page.url !== SOURCE_URL ||
    snapshot.page.sourceVersion !== SOURCE_VERSION
  ) {
    throw new Error("CP52 Noelle source document boundary drifted.");
  }
  const gestManual = requiredUniqueManualRecord(
    snapshot.records,
    NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID,
  );
  const teamManual = requiredUniqueManualRecord(
    snapshot.records,
    NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
  );
  const gestRepository = requiredUniqueRepositoryRecord(
    repository.records,
    NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID,
  );
  const teamRepository = requiredUniqueRepositoryRecord(
    repository.records,
    NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
  );
  authenticateRecordHash(
    "Gest manual record",
    gestManual,
    GEST_MANUAL_RECORD_SHA256,
  );
  authenticateRecordHash(
    "Gest repository record",
    gestRepository,
    GEST_REPOSITORY_RECORD_SHA256,
  );
  authenticateRecordHash(
    "team manual record",
    teamManual,
    TEAM_MANUAL_RECORD_SHA256,
  );
  authenticateRecordHash(
    "team repository record",
    teamRepository,
    TEAM_REPOSITORY_RECORD_SHA256,
  );

  const gest = authenticateGestParity(gestManual, gestRepository);
  const team = authenticateTeamParity(teamManual, teamRepository);
  return {
    sourceParityBoundary: {
      status: "exact",
      sourceId: "kqm",
      sourceUrl: SOURCE_URL,
      sourceVersion: SOURCE_VERSION,
      sameSourceDocument: true,
      manualRecordCount: 2,
      consolidatedRecordCount: 2,
      records: [gest.parityRow, team.parityRow],
    },
    weaponObservation: gest.weaponObservation,
    exactTeam: team.exactTeam,
  };
}

function authenticateGestParity(
  manual: Record<string, unknown>,
  repository: Record<string, unknown>,
) {
  authenticateCommonManualRecord(
    manual,
    "character_guide",
    GEST_LOCATOR_HEADING,
  );
  authenticateCommonRepositoryRecord(repository, "character_guide");
  if (
    manual.characterId !== "noelle" ||
    repository.characterId !== "noelle" ||
    stableJson(repository.builds) !== stableJson([])
  ) {
    throw new Error("CP52 Gest character-guide boundary drifted.");
  }
  const recommendation = requiredRecord(
    manual.recommendation,
    "Gest manual recommendation",
  );
  const repositoryRecommendations = requiredArray(
    repository.recommendations,
    "Gest repository recommendations",
  );
  const expectedRecommendation = {
    id: "hexerei-gest",
    label: "Gest of the Mighty Wolf in Hexerei teams",
    scope: "weapons",
    roles: ["dps"],
    weaponOrdering: "unranked",
    weaponRecommendations: [
      {
        weaponIds: ["gest_of_the_mighty_wolf"],
        grouping: "single",
        classification: "conditional",
        conditions: [NOELLE_HEXEREI_EXACT_SOURCE_CONDITION],
      },
    ],
  };
  if (
    repositoryRecommendations.length !== 1 ||
    stableJson(recommendation) !== stableJson(expectedRecommendation) ||
    stableJson(repositoryRecommendations[0]) !==
      stableJson(expectedRecommendation)
  ) {
    throw new Error("CP52 exact Gest recommendation parity drifted.");
  }
  authenticateSourceRefsAndUnknowns(manual, repository);
  const unknowns = requiredStringArray(manual.unknowns, "Gest unknowns");
  if (
    !unknowns.includes("refinement assumptions") ||
    !unknowns.includes("quantitative weapon performance")
  ) {
    throw new Error("CP52 Gest missing-boundary inventory drifted.");
  }
  return {
    parityRow: {
      sourceRecordId: NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID,
      repositoryRecordId: NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID,
      kind: "character_guide" as const,
      manualRecordSha256: GEST_MANUAL_RECORD_SHA256,
      repositoryRecordSha256: GEST_REPOSITORY_RECORD_SHA256,
      payloadParity: "exact-normalized-consolidation" as const,
      sourceRefParity: "exact" as const,
      repositoryStatus: "candidate" as const,
      promotionEligible: false as const,
    },
    weaponObservation: {
      sourceRecordId:
        NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID as typeof NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID,
      repositoryRecordId:
        NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID as typeof NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID,
      recommendationId: "hexerei-gest" as const,
      weaponId: "gest_of_the_mighty_wolf" as const,
      weaponOrdering: "unranked" as const,
      grouping: "single" as const,
      sourceClassification: "conditional" as const,
      sourceConditions: [NOELLE_HEXEREI_EXACT_SOURCE_CONDITION] as [
        typeof NOELLE_HEXEREI_EXACT_SOURCE_CONDITION,
      ],
      sourceConditionStatus: "guarded-source-observation" as const,
      refinement: null,
      refinementStatus: "missing-not-zero" as const,
      quantitativePerformanceStatus: "missing-not-zero" as const,
    },
  };
}

function authenticateTeamParity(
  manual: Record<string, unknown>,
  repository: Record<string, unknown>,
) {
  authenticateCommonManualRecord(
    manual,
    "team",
    NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING,
  );
  authenticateCommonRepositoryRecord(repository, "team");
  const manualMembers = requiredArray(manual.members, "manual team members").map(
    (value, index) => requiredRecord(value, `manual team member ${index}`),
  );
  const expectedCharacterIds = ["noelle", "durin", "nicole", "xilonen"];
  if (
    stableJson(manualMembers.map(({ characterId }) => characterId)) !==
      stableJson(expectedCharacterIds) ||
    manual.label !== "Noelle — Durin — Nicole — Xilonen" ||
    manual.intent !== "example" ||
    manual.exhaustiveness !== "non-exhaustive" ||
    manual.rankingClaim !== "none"
  ) {
    throw new Error("CP52 exact manual team boundary drifted.");
  }
  for (const [index, member] of manualMembers.entries()) {
    if (
      stableJson(member.weaponRecommendations) !== stableJson([]) ||
      stableJson(member.artifactRecommendations) !== stableJson([]) ||
      stableJson(member.erTargets) !== stableJson([])
    ) {
      throw new Error(`CP52 manual team member ${index} is no longer empty.`);
    }
  }
  const expectedMembers = manualMembers.map(({ characterId }) => ({
    characterId,
    investment: { status: "unspecified" },
    selectedArtifact: null,
    selectedWeapon: null,
  }));
  const manualPayload = {
    label: manual.label,
    intent: manual.intent,
    exhaustiveness: manual.exhaustiveness,
    rankingClaim: manual.rankingClaim,
    members: expectedMembers,
    rotations: manual.rotations,
    damagePlans: [],
  };
  const repositoryPayload = {
    label: repository.label,
    intent: repository.intent,
    exhaustiveness: repository.exhaustiveness,
    rankingClaim: repository.rankingClaim,
    members: repository.members,
    rotations: repository.rotations,
    damagePlans: repository.damagePlans,
  };
  if (stableJson(manualPayload) !== stableJson(repositoryPayload)) {
    throw new Error("CP52 exact normalized team payload parity drifted.");
  }
  authenticateSourceRefsAndUnknowns(manual, repository);
  const unknowns = requiredStringArray(manual.unknowns, "team unknowns");
  if (!unknowns.includes("team member weapons and refinements")) {
    throw new Error("CP52 exact team refinement boundary drifted.");
  }
  const repositoryMembers = requiredArray(
    repository.members,
    "repository team members",
  ).map((value, index) =>
    requiredRecord(value, `repository team member ${index}`),
  );
  if (repositoryMembers[0]?.selectedWeapon !== null) {
    throw new Error("CP52 consolidated Noelle selectedWeapon is no longer null.");
  }
  return {
    parityRow: {
      sourceRecordId: NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
      repositoryRecordId: NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
      kind: "team" as const,
      manualRecordSha256: TEAM_MANUAL_RECORD_SHA256,
      repositoryRecordSha256: TEAM_REPOSITORY_RECORD_SHA256,
      payloadParity: "exact-normalized-consolidation" as const,
      sourceRefParity: "exact" as const,
      repositoryStatus: "candidate" as const,
      promotionEligible: false as const,
    },
    exactTeam: {
      sourceRecordId:
        NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID as typeof NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
      repositoryRecordId:
        NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID as typeof NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
      locatorHeading:
        NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING as typeof NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING,
      label: "Noelle — Durin — Nicole — Xilonen" as const,
      intent: "example" as const,
      exhaustiveness: "non-exhaustive" as const,
      rankingClaim: "none" as const,
      orderedCharacterIds: [
        "noelle",
        "durin",
        "nicole",
        "xilonen",
      ] as ["noelle", "durin", "nicole", "xilonen"],
      noelleSourceMemberWeaponRecommendations: [] as [],
      noelleSourceMemberWeaponRecommendationCount: 0 as const,
      noelleConsolidatedSelectedWeapon: null,
      teamMemberWeaponAndRefinementStatus: "missing-not-zero" as const,
    },
  };
}

function authenticateCommonManualRecord(
  manual: Record<string, unknown>,
  expectedKind: "character_guide" | "team",
  expectedHeading: string,
): void {
  const locator = requiredRecord(manual.locator, "manual locator");
  const extraction = requiredRecord(manual.extraction, "manual extraction");
  if (
    manual.kind !== expectedKind ||
    locator.url !== SOURCE_URL ||
    locator.heading !== expectedHeading ||
    stableJson(manual.supportingLocators) !== stableJson([]) ||
    extraction.method !== "agent-assisted" ||
    extraction.reviewStatus !== "unreviewed"
  ) {
    throw new Error(`CP52 manual ${expectedKind} source boundary drifted.`);
  }
}

function authenticateCommonRepositoryRecord(
  repository: Record<string, unknown>,
  expectedKind: "character_guide" | "team",
): void {
  if (
    repository.kind !== expectedKind ||
    repository.status !== "candidate" ||
    repository.promotionEligible !== false
  ) {
    throw new Error(`CP52 repository ${expectedKind} boundary drifted.`);
  }
}

function authenticateSourceRefsAndUnknowns(
  manual: Record<string, unknown>,
  repository: Record<string, unknown>,
): void {
  const expectedSourceRefs = [
    {
      sourceId: "kqm",
      sourceRecordId: manual.sourceRecordId,
      locator: manual.locator,
    },
  ];
  const expectedUnknowns = [
    ...requiredStringArray(manual.unknowns, "manual unknowns"),
    "agent-assisted extraction has not been human-reviewed",
  ];
  if (
    stableJson(repository.sourceRefs) !== stableJson(expectedSourceRefs) ||
    stableJson(repository.unknowns) !== stableJson(expectedUnknowns)
  ) {
    throw new Error("CP52 sourceRefs/unknowns consolidation parity drifted.");
  }
}

function requiredUniqueManualRecord(
  records: readonly { sourceRecordId: string }[],
  sourceRecordId: string,
): Record<string, unknown> {
  const matches = records.filter(
    (record) => record.sourceRecordId === sourceRecordId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `CP52 expected one manual ${sourceRecordId}, found ${matches.length}.`,
    );
  }
  return requiredRecord(matches[0], sourceRecordId);
}

function requiredUniqueRepositoryRecord(
  records: readonly unknown[],
  repositoryRecordId: string,
): Record<string, unknown> {
  const matches = records
    .map((record) => requiredRecord(record, "repository record"))
    .filter(({ id }) => id === repositoryRecordId);
  if (matches.length !== 1) {
    throw new Error(
      `CP52 expected one repository ${repositoryRecordId}, found ${matches.length}.`,
    );
  }
  return matches[0]!;
}

function authenticateRecordHash(
  label: string,
  value: unknown,
  expectedSha256: string,
): void {
  const actual = hashValue(value);
  if (actual !== expectedSha256) {
    throw new Error(
      `CP52 ${label} hash drifted: expected ${expectedSha256}, got ${actual}.`,
    );
  }
}

function requiredSourceText(
  sourceTextByPath: ReadonlyMap<string, string>,
  sourcePath: string,
): string {
  const value = sourceTextByPath.get(sourcePath);
  if (value == null) throw new Error(`CP52 missing source text ${sourcePath}.`);
  return value;
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`CP52 ${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`CP52 ${label} must be an array.`);
  return value;
}

function requiredStringArray(value: unknown, label: string): string[] {
  const values = requiredArray(value, label);
  if (values.some((entry) => typeof entry !== "string")) {
    throw new Error(`CP52 ${label} must contain only strings.`);
  }
  return values as string[];
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
