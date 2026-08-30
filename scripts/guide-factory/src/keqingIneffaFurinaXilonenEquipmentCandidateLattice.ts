import path from "node:path";
import type { ArtifactChoiceSearchCoverageReport } from "./artifactChoiceSearchCoverage";
import { sha256Text, stableJson } from "./io";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "./paths";
import type {
  GenshinToolsPresetSnapshot,
  KnowledgeRepository,
  ManualObservationSnapshot,
  ManualSnapshotIndex,
  SourceRegistry,
} from "./schemas";
import {
  buildSourceBackedEquipmentCandidateLattice,
  isCompleteSourceBackedEquipmentCandidateLattice,
  type SourceBackedEquipmentAxis,
  type SourceBackedEquipmentCandidateLatticeInput,
  type SourceBackedEquipmentCandidateLatticeReport,
  type SourceBackedEquipmentJsonValue,
} from "./sourceBackedEquipmentCandidateLattice";
import type { WeaponChoiceSearchCoverageReport } from "./weaponChoiceSearchCoverage";

export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_ID =
  "keqing-ineffa-furina-xilonen-source-backed-equipment-lattice-v1";
export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-candidate-lattice.json";
export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_PATH =
  path.join(
    REPOSITORY_ROOT,
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_RELATIVE_PATH,
  );

export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS = [
  "scripts/guide-factory/data/knowledge/repository.json",
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json",
  "scripts/guide-factory/data/source-snapshots/manual-index.json",
  "scripts/guide-factory/sources/registry.json",
  "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json",
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json",
  "scripts/guide-factory/reports/weapon-choice-search-coverage.json",
  "scripts/guide-factory/reports/artifact-choice-search-coverage.json",
] as const;

const EXPECTED_INPUT_FILE_SHA256: Record<string, string> = {
  [KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[0]]:
    "66179b2cfea81c74cc233a73ed25df6697984f6ebf04289df2cce67fbefd08c8",
  [KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[1]]:
    "da42e500bbd68a68dbbefc7ee77d69ab107956016226002c7df445f8b3056087",
  [KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[2]]:
    "f3d831a925f150c10acd3641311cd4b6af99334bcb3bc771bbcffcc89bf94dc9",
  [KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[3]]:
    "45515e3bb3ee7a68b217b2f3263a542f22d4a2e987eeba9003bb71a170ba6010",
  [KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[4]]:
    "3b628e74cb1372b3c0773c75e214d7d4b90a7e064ee83c0c925940f315eddfe2",
  [KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[5]]:
    "edbce81e2cb036cc07fe8f0dae08662e2ab75f3328b977849fb50e75478e7b04",
  [KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[6]]:
    "9764c1e355e68ca92463ddd37f6ded55cf487b7eaf98b820944f0ff6a1594598",
  [KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[7]]:
    "8b62758676ef6333bd1e2af3b7d7e1be2a0c2ebd617fa5cd433f266a0b0f847b",
  [KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[8]]:
    "d3d300312cff0aa9bba86e565f179d4cdd4bb986d2819c50707915723749bcb6",
};

const EXPECTED_PARSED_PAYLOAD_SHA256 = {
  repository:
    "66179b2cfea81c74cc233a73ed25df6697984f6ebf04289df2cce67fbefd08c8",
  kqmSnapshot:
    "00558796187d9c2d806c51fe100eef4cbe9918a209029243d2c57fcd1bc09480",
  genshinToolsSnapshot:
    "f3d831a925f150c10acd3641311cd4b6af99334bcb3bc771bbcffcc89bf94dc9",
  manualIndex:
    "c669b925cdbbf3b591bcac66f4e7ec42332f98dc5e1a37be128662fa40504630",
  sourceRegistry:
    "2974828169ee2a7290bdcb8108b30db5beabf8ea3a0eb879878fe468044501a8",
  liveBuildPreset:
    "849483499dd387399af2492bfc8faa2b126a84e588f76b6e4f8ecb64bab0dc94",
  evidenceReport:
    "9764c1e355e68ca92463ddd37f6ded55cf487b7eaf98b820944f0ff6a1594598",
  weaponCoverageReport:
    "8b62758676ef6333bd1e2af3b7d7e1be2a0c2ebd617fa5cd433f266a0b0f847b",
  artifactCoverageReport:
    "d3d300312cff0aa9bba86e565f179d4cdd4bb986d2819c50707915723749bcb6",
} as const;

const TEAM_RECORD_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const KQM_WEAPON_RECORD_ID =
  "kqm:character-guide:keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i";
const KQM_WEAPON_SOURCE_RECORD_ID =
  "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i";
const KQM_WEAPON_RECOMMENDATION_ID =
  "lunar-charged-equal-refinement-four-star-ranking";
const KQM_ARTIFACT_RECORD_ID =
  "kqm:character-guide:keqing-lunar-charged-top-contributor-artifact-options-luna-i";
const KQM_ARTIFACT_SOURCE_RECORD_ID =
  "keqing-lunar-charged-top-contributor-artifact-options-luna-i";
const KQM_ARTIFACT_RECOMMENDATION_ID =
  "lunar-charged-top-contributor-artifact-options";
const EXACT_ROSTER = ["keqing", "ineffa", "furina", "xilonen"] as const;
const LUNAR_CONDITION = "Keqing is used in a Lunar-Charged team.";
const EQUAL_REFINEMENT_CONDITION =
  "The compared weapons have equal Refinement.";
const TOP_CONTRIBUTOR_CONDITION =
  "Keqing is the team's top Lunar-Charged contributor without using a CRIT Rate artifact set.";
const XILONEN_SCROLL_WARNING =
  "Xilonen generally cannot activate Scroll for Hydro in the stated setup because of the Crystallize interaction; the source presents pause-menu booking only as a niche exception";

const EXPECTED_AUTHENTICATED_REPORT_SHA256 =
  "ace0bb3068a9f84788b6f93d6f526b59cd485765f9bd74e16547bf7074bf0822";

export type GuideFactoryHashedInput = { path: string; sha256: string };

export type BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput = {
  repository: KnowledgeRepository;
  kqmSnapshot: ManualObservationSnapshot;
  genshinToolsSnapshot: GenshinToolsPresetSnapshot;
  manualIndex: ManualSnapshotIndex;
  sourceRegistry: SourceRegistry;
  liveBuildPreset: unknown;
  evidenceReport: KeqingLunarEquipmentEvidenceValidationReport;
  weaponCoverageReport: WeaponChoiceSearchCoverageReport;
  artifactCoverageReport: ArtifactChoiceSearchCoverageReport;
  inputFiles: GuideFactoryHashedInput[];
};

type Issue = { code: string; path: string; message: string };
type InventoryStatus =
  | "active-experiment-axis"
  | "excluded-not-first-preset-build-scope"
  | "excluded-investment-mismatch"
  | "excluded-deferred-energy";

export type EquipmentInventoryOccurrence = {
  occurrenceId: string;
  groupId: string;
  characterId: string;
  equipmentKind: "weapon" | "artifact";
  equipmentId: string;
  sourceRecordId: string;
  sourceListIndex: number;
  sourceGroupIndex: number | null;
  sourceMemberIndex: number;
  status: InventoryStatus;
  reason: string;
};

type LatticePayload = {
  equipmentId: string;
  artifactType: string | null;
  sourceRefinement: number | null;
  requestedRefinement: number | null;
  sourceOrderingSemantics:
    | "ranked-groups-with-tie"
    | "unranked-alternatives"
    | "preset-list-index-not-rank"
    | "preset-build-index-not-rank";
  sourceConditionResolution:
    | "withheld-unresolved-source-condition"
    | "no-source-team-condition";
  effectiveConditionResolution:
    | "matched-by-exact-team-and-supplied-request"
    | "not-evaluated";
  gameplayApplicability: "unknown-not-validated";
  sourcePublishedWholeCandidate: false;
};

export type KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport = {
  schemaVersion: 1;
  classification: "keqing-ineffa-furina-xilonen-source-backed-equipment-candidate-lattice";
  latticeId: typeof KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_ID;
  validationStatus: "authenticated-enumeration-only" | "not-authenticated";
  issues: Issue[];
  generatedFrom: GuideFactoryHashedInput[];
  candidateEnumerationExecuted: boolean;
  candidateEvaluationExecuted: false;
  candidateGeneratorExecuted: false;
  optimizerExecuted: false;
  damageComputationExecuted: false;
  rankingProduced: false;
  guideProduced: false;
  recommendationProduced: false;
  energyRecoveryInputsUsed: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsOptimality: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsGameplayApplicabilityClaims: false;
  supportsEnergyRequirements: false;
  promotionEligible: false;
  inputBoundary: {
    expectedFileCount: 9;
    observedFileCount: number;
    exactPathSet: boolean;
    byteHashesMatch: boolean;
    parsedPayloadsMatch: boolean;
    authentication: "accepted" | "rejected";
    files: Array<{
      path: string;
      expectedSha256: string;
      observedSha256: string | null;
      matches: boolean;
    }>;
    parsedPayloadSha256: Record<string, string>;
  };
  sourceBoundary: {
    registry: {
      repositoryRegistryHashMatches: boolean;
      kqmPolicyMatches: boolean;
      genshinToolsPolicyMatches: boolean;
    };
    manualIndex: { exactKeqingEntryCount: number; exactEntryPresent: boolean };
    kqm: {
      rawRecordCount: number;
      selectedRecordIds: string[];
      rawRepositoryParity: boolean;
      evidenceClaimIds: string[];
      evidenceParity: boolean;
    };
    genshinTools: {
      characterIds: string[];
      snapshotRepositoryParity: boolean;
      liveSnapshotParity: boolean;
      liveRevisionHashMatches: boolean;
    };
    coverage: {
      expectedWeaponObservationCount: 8;
      matchedWeaponObservationCount: number;
      expectedArtifactObservationCount: 12;
      matchedArtifactObservationCount: number;
      exactObservationClosure: boolean;
    };
  };
  requestBoundary: {
    requestId: string;
    teamRecordId: typeof TEAM_RECORD_ID;
    exactRoster: string[];
    allSourceTeamEquipmentNull: boolean;
    sourceTeamArtifactPlanCount: 0;
    constellationByCharacter: Record<string, 0>;
    requestedWeaponRefinementByCharacter: Record<string, 1 | 5>;
    scenarioAssumption: {
      assumptionId: string;
      provenance: "wrapper-supplied-request-assumption";
      exactSourceCondition: typeof TOP_CONTRIBUTOR_CONDITION;
      gameplayValidated: false;
    };
    conditionResolutions: {
      lunarChargedRosterCondition: {
        exactSourceCondition: typeof LUNAR_CONDITION;
        resolution: "matched-by-exact-team-facts";
      };
      equalRefinementCondition: {
        exactSourceCondition: typeof EQUAL_REFINEMENT_CONDITION;
        sourceResolution: "withheld-unresolved-source-condition";
        effectiveResolution: "matched-by-exact-team-and-supplied-request";
        requestRefinement: 5;
      };
      topContributorCondition: {
        exactSourceCondition: typeof TOP_CONTRIBUTOR_CONDITION;
        sourceResolution: "withheld-unresolved-source-condition";
        effectiveResolution: "matched-by-exact-team-and-supplied-request";
        assumptionId: string;
      };
    };
    gameplayApplicability: "unknown-not-validated";
    presetTeamApplicability: "unknown-not-evaluated";
    xilonenScrollWarning: typeof XILONEN_SCROLL_WARNING;
  };
  sourceBacking: {
    exactRosterSourceBacked: boolean;
    activeAxisOccurrencesAllSourceBacked: boolean;
    sourceGroupsAndListsRetained: boolean;
    sourceAuthoredWithinCharacterWeaponArtifactPairing: false;
    sourceAuthoredCrossCharacterComposition: false;
    sourcePublishedWholeTeamEquipment: false;
    wholeCandidateCount: 0;
    compositionOwner: "source-specific-wrapper";
    gameplayValidated: false;
  };
  inventoryBoundary: {
    groupOrListCount: number;
    occurrenceCount: number;
    activeOccurrenceCount: number;
    excludedNotFirstScopeCount: number;
    excludedInvestmentCount: number;
    excludedDeferredEnergyCount: number;
    erStatWeightsProjected: false;
    occurrences: EquipmentInventoryOccurrence[];
  };
  lattice: SourceBackedEquipmentCandidateLatticeReport<LatticePayload>;
  summary: {
    memberCount: number;
    axisCount: number;
    activeGroupCount: number;
    activeOccurrenceCount: number;
    candidateNodeCount: number;
    candidateReferenceCount: number;
    sourcePublishedWholeCandidateCount: 0;
    gameplayValidatedCandidateCount: 0;
  };
  cautions: string[];
  prohibitedInterpretations: string[];
};

export function buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
  input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput,
): KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport {
  const issues: Issue[] = [];
  const inputBoundary = authenticateInputs(input, issues);
  const sourceBoundary = authenticateSources(input, issues);
  const requestBoundary = authenticateRequest(input.repository, input.kqmSnapshot, issues);
  const occurrences = buildInventory();
  authenticateInventory(occurrences, issues);
  const axes = buildActiveAxes();
  const coreInput: SourceBackedEquipmentCandidateLatticeInput<LatticePayload> = {
    request: {
      requestId: requestBoundary.requestId,
      assumptions: {
        teamRecordId: TEAM_RECORD_ID,
        constellationByCharacter: requestBoundary.constellationByCharacter,
        requestedWeaponRefinementByCharacter:
          requestBoundary.requestedWeaponRefinementByCharacter,
        scenarioAssumption: requestBoundary.scenarioAssumption,
      },
    },
    evaluation: {
      evaluationId: "enumeration-only-no-evaluation-v1",
      assumptions: {
        gameplayApplicability: "unknown-not-validated",
        presetTeamApplicability: "unknown-not-evaluated",
        xilonenScrollWarning: XILONEN_SCROLL_WARNING,
      },
    },
    teamMembers: EXACT_ROSTER.map((characterId) => ({
      teamMemberId: `member:${characterId}`,
      characterId,
    })),
    axes,
    bounds: { expectedCombinationCount: "36", maximumCombinationCount: "36" },
  };
  const preCoreAuthenticated =
    issues.length === 0 && inputBoundary.authentication === "accepted";
  const core = preCoreAuthenticated
    ? buildSourceBackedEquipmentCandidateLattice<LatticePayload>(coreInput)
    : buildWrapperWithheldCoreReport(coreInput);
  if (preCoreAuthenticated && !isCompleteSourceBackedEquipmentCandidateLattice(core)) {
    for (const issue of core.issues) {
      issues.push({
        code: `core.${issue.code}`,
        path: `lattice.${issue.path}`,
        message: issue.message,
      });
    }
  }
  const candidateNodeCount = core.lattice?.nodes.length ?? 0;
  const candidateReferenceCount =
    core.lattice?.nodes.reduce((sum, node) => sum + node.selections.length, 0) ?? 0;
  if (core.lattice && (candidateNodeCount !== 36 || candidateReferenceCount !== 288)) {
    issues.push({
      code: "lattice.count_drift",
      path: "lattice",
      message: `Expected 36 nodes and 288 references; observed ${candidateNodeCount} and ${candidateReferenceCount}.`,
    });
  }
  const authenticated =
    preCoreAuthenticated &&
    issues.length === 0 &&
    isCompleteSourceBackedEquipmentCandidateLattice(core);
  const lattice = core;
  return {
    schemaVersion: 1,
    classification:
      "keqing-ineffa-furina-xilonen-source-backed-equipment-candidate-lattice",
    latticeId:
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_ID,
    validationStatus: authenticated
      ? "authenticated-enumeration-only"
      : "not-authenticated",
    issues,
    generatedFrom: input.inputFiles.map((entry) => ({ ...entry })),
    candidateEnumerationExecuted: authenticated,
    candidateEvaluationExecuted: false,
    candidateGeneratorExecuted: false,
    optimizerExecuted: false,
    damageComputationExecuted: false,
    rankingProduced: false,
    guideProduced: false,
    recommendationProduced: false,
    energyRecoveryInputsUsed: false,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsOptimality: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsGameplayApplicabilityClaims: false,
    supportsEnergyRequirements: false,
    promotionEligible: false,
    inputBoundary,
    sourceBoundary,
    requestBoundary,
    sourceBacking: {
      exactRosterSourceBacked:
        authenticated && exactEqual(requestBoundary.exactRoster, EXACT_ROSTER),
      activeAxisOccurrencesAllSourceBacked:
        authenticated && sourceBoundary.coverage.exactObservationClosure,
      sourceGroupsAndListsRetained:
        authenticated &&
        new Set(occurrences.map(({ groupId }) => groupId)).size === 9,
      sourceAuthoredWithinCharacterWeaponArtifactPairing: false,
      sourceAuthoredCrossCharacterComposition: false,
      sourcePublishedWholeTeamEquipment: false,
      wholeCandidateCount: 0,
      compositionOwner: "source-specific-wrapper",
      gameplayValidated: false,
    },
    inventoryBoundary: {
      groupOrListCount: new Set(occurrences.map(({ groupId }) => groupId)).size,
      occurrenceCount: occurrences.length,
      activeOccurrenceCount: occurrences.filter(
        ({ status }) => status === "active-experiment-axis",
      ).length,
      excludedNotFirstScopeCount: occurrences.filter(
        ({ status }) => status === "excluded-not-first-preset-build-scope",
      ).length,
      excludedInvestmentCount: occurrences.filter(
        ({ status }) => status === "excluded-investment-mismatch",
      ).length,
      excludedDeferredEnergyCount: occurrences.filter(
        ({ status }) => status === "excluded-deferred-energy",
      ).length,
      erStatWeightsProjected: false,
      occurrences,
    },
    lattice,
    summary: {
      memberCount: 4,
      axisCount: 8,
      activeGroupCount: axes.reduce((sum, axis) => sum + axis.groups.length, 0),
      activeOccurrenceCount: axes.reduce(
        (sum, axis) =>
          sum + axis.groups.reduce((nested, group) => nested + group.occurrences.length, 0),
        0,
      ),
      candidateNodeCount: authenticated ? candidateNodeCount : 0,
      candidateReferenceCount: authenticated ? candidateReferenceCount : 0,
      sourcePublishedWholeCandidateCount: 0,
      gameplayValidatedCandidateCount: 0,
    },
    cautions: [
      "Every whole-team weapon/artifact combination is wrapper-authored from separately attributed member axes; no source published a whole candidate.",
      "Active preset occurrences are enumerated experiment inputs, not claims that those choices apply to this team.",
      "The Keqing conditional artifact axis is structurally admitted only under an explicit request assumption; reaction ownership and gameplay applicability remain unvalidated.",
      XILONEN_SCROLL_WARNING,
      "Only artifact identity is projected. Sands, goblet, circlet, substat weights, and all ER-related stat fields in active preset builds are not consumed.",
    ],
    prohibitedInterpretations: [
      "guide",
      "recommendation",
      "rank",
      "winner",
      "score",
      "damage-result",
      "optimizer-result",
      "gameplay-applicability",
      "energy-requirement",
    ],
  };
}

type InputBoundary =
  KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport["inputBoundary"];
type SourceBoundary =
  KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport["sourceBoundary"];
type RequestBoundary =
  KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport["requestBoundary"];

function authenticateInputs(
  input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput,
  issues: Issue[],
): InputBoundary {
  const expectedPaths = [
    ...KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS,
  ];
  const observedByPath = new Map<string, string>();
  for (const [index, file] of input.inputFiles.entries()) {
    if (observedByPath.has(file.path)) {
      addIssue(
        issues,
        "input.duplicate_path",
        `inputFiles[${index}].path`,
        `Duplicate input path ${file.path}.`,
      );
    }
    observedByPath.set(file.path, file.sha256);
  }
  const exactPathSet =
    input.inputFiles.length === expectedPaths.length &&
    input.inputFiles.every((file, index) => file.path === expectedPaths[index]);
  if (!exactPathSet) {
    addIssue(
      issues,
      "input.path_set_drift",
      "inputFiles",
      "The exact ordered nine-file input closure changed.",
    );
  }
  const files = expectedPaths.map((filePath) => {
    const expectedSha256 = EXPECTED_INPUT_FILE_SHA256[filePath] ?? "";
    const observedSha256 = observedByPath.get(filePath) ?? null;
    const matches = observedSha256 === expectedSha256;
    if (!matches) {
      addIssue(
        issues,
        "input.byte_hash_drift",
        filePath,
        `Expected ${expectedSha256}, observed ${observedSha256 ?? "missing"}.`,
      );
    }
    return { path: filePath, expectedSha256, observedSha256, matches };
  });
  const parsedPayloadSha256: Record<string, string> = {
    repository: hashPayload(input.repository),
    kqmSnapshot: hashPayload(input.kqmSnapshot),
    genshinToolsSnapshot: hashPayload(input.genshinToolsSnapshot),
    manualIndex: hashPayload(input.manualIndex),
    sourceRegistry: hashPayload(input.sourceRegistry),
    liveBuildPreset: hashPayload(input.liveBuildPreset),
    evidenceReport: hashPayload(input.evidenceReport),
    weaponCoverageReport: hashPayload(input.weaponCoverageReport),
    artifactCoverageReport: hashPayload(input.artifactCoverageReport),
  };
  const parsedPayloadsMatch = Object.entries(
    EXPECTED_PARSED_PAYLOAD_SHA256,
  ).every(([key, expected]) => {
    const matches = parsedPayloadSha256[key] === expected;
    if (!matches) {
      addIssue(
        issues,
        "input.parsed_payload_drift",
        key,
        `Parsed payload hash changed from ${expected} to ${parsedPayloadSha256[key] ?? "missing"}.`,
      );
    }
    return matches;
  });
  const byteHashesMatch = files.every(({ matches }) => matches);
  return {
    expectedFileCount: 9,
    observedFileCount: input.inputFiles.length,
    exactPathSet,
    byteHashesMatch,
    parsedPayloadsMatch,
    authentication:
      exactPathSet && byteHashesMatch && parsedPayloadsMatch
        ? "accepted"
        : "rejected",
    files,
    parsedPayloadSha256,
  };
}

function authenticateSources(
  input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput,
  issues: Issue[],
): SourceBoundary {
  const kqmPolicies = input.sourceRegistry.sources.filter(
    ({ id }) => id === "kqm",
  );
  const genshinToolsPolicies = input.sourceRegistry.sources.filter(
    ({ id }) => id === "genshintools-presets",
  );
  const kqmPolicyMatches =
    kqmPolicies.length === 1 &&
    exactEqual(
      pick(kqmPolicies[0], [
        "id",
        "status",
        "ingestionMode",
        "permission",
        "recordFormat",
        "checkedAt",
      ]),
      {
        id: "kqm",
        status: "active",
        ingestionMode: "manual-observation",
        permission: "unknown",
        recordFormat: "manual-observation-v1",
        checkedAt: "2026-08-29",
      },
    );
  const genshinToolsPolicyMatches =
    genshinToolsPolicies.length === 1 &&
    exactEqual(
      pick(genshinToolsPolicies[0], [
        "id",
        "status",
        "ingestionMode",
        "permission",
        "recordFormat",
        "checkedAt",
      ]),
      {
        id: "genshintools-presets",
        status: "active",
        ingestionMode: "internal-adapter",
        permission: "internal",
        recordFormat: "genshintools-presets-v1",
        checkedAt: "2026-08-28",
      },
    );
  const repositoryRegistryHashMatches =
    input.repository.sourceRegistrySha256 ===
    EXPECTED_INPUT_FILE_SHA256[
      "scripts/guide-factory/sources/registry.json"
    ];
  assertCheck(
    issues,
    repositoryRegistryHashMatches,
    "source.registry_hash_drift",
    "repository.sourceRegistrySha256",
    "Repository registry binding changed.",
  );
  assertCheck(
    issues,
    kqmPolicyMatches,
    "source.kqm_policy_drift",
    "sourceRegistry.kqm",
    "KQM registry policy changed.",
  );
  assertCheck(
    issues,
    genshinToolsPolicyMatches,
    "source.genshintools_policy_drift",
    "sourceRegistry.genshintools-presets",
    "GenshinTools preset registry policy changed.",
  );

  const keqingIndexEntries = input.manualIndex.snapshots.filter(
    ({ sourceId, path: snapshotPath }) =>
      sourceId === "kqm" &&
      snapshotPath ===
        "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
  );
  assertCheck(
    issues,
    keqingIndexEntries.length === 1,
    "source.manual_index_drift",
    "manualIndex.snapshots",
    "Expected exactly one indexed KQM Keqing snapshot.",
  );

  const selectedKqmSourceIds = [
    "keqing-ineffa-furina-xilonen-lunar-charged-example",
    KQM_WEAPON_SOURCE_RECORD_ID,
    KQM_ARTIFACT_SOURCE_RECORD_ID,
  ];
  const rawKqmRecords = selectedKqmSourceIds.flatMap((sourceRecordId) =>
    input.kqmSnapshot.records.filter(
      (record) => record.sourceRecordId === sourceRecordId,
    ),
  );
  const repositoryKqmIds = [
    TEAM_RECORD_ID,
    KQM_WEAPON_RECORD_ID,
    KQM_ARTIFACT_RECORD_ID,
  ];
  const repositoryKqmRecords = repositoryKqmIds.flatMap((id) =>
    input.repository.records.filter((record) => record.id === id),
  );
  const rawRepositoryParity = authenticateKqmRecordParity(
    rawKqmRecords,
    repositoryKqmRecords,
  );
  assertCheck(
    issues,
    rawKqmRecords.length === 3 && repositoryKqmRecords.length === 3,
    "source.kqm_record_closure_drift",
    "kqm.selectedRecords",
    "Each of the three selected KQM records must occur exactly once in raw and normalized inputs.",
  );
  assertCheck(
    issues,
    rawRepositoryParity,
    "source.kqm_parity_drift",
    "kqm.selectedRecords",
    "Selected raw KQM claims no longer match normalized repository records.",
  );

  const expectedEvidenceClaimIds = [
    `${KQM_WEAPON_RECORD_ID}:weapon:0:0`,
    `${KQM_WEAPON_RECORD_ID}:weapon:0:1`,
    `${KQM_WEAPON_RECORD_ID}:weapon:1:0`,
    `${KQM_ARTIFACT_RECORD_ID}:artifact:0:0`,
    `${KQM_ARTIFACT_RECORD_ID}:artifact:0:1`,
  ];
  const evidenceClaims = expectedEvidenceClaimIds.flatMap((claimId) =>
    input.evidenceReport.claims.filter((claim) => claim.claimId === claimId),
  );
  const evidenceParity = authenticateEvidenceClaims(
    evidenceClaims,
    input.evidenceReport,
  );
  assertCheck(
    issues,
    evidenceClaims.length === expectedEvidenceClaimIds.length && evidenceParity,
    "source.evidence_claim_drift",
    "evidenceReport.claims",
    "The exact five KQM equipment evidence claims or their team/coverage bindings changed.",
  );

  const presetCharacterIds = ["ineffa", "furina", "xilonen"];
  const snapshotGuides = presetCharacterIds.flatMap((characterId) =>
    input.genshinToolsSnapshot.characterGuides.filter(
      (guide) => guide.characterId === characterId,
    ),
  );
  const repositoryGuides = presetCharacterIds.flatMap((characterId) =>
    input.repository.records.filter(
      (record) =>
        record.id === `genshintools-presets:character-guide:${characterId}`,
    ),
  );
  const snapshotRepositoryParity =
    snapshotGuides.length === 3 &&
    repositoryGuides.length === 3 &&
    presetCharacterIds.every((characterId) => {
      const snapshot = snapshotGuides.find(
        (guide) => guide.characterId === characterId,
      );
      const repository = repositoryGuides.find(
        (record) =>
          record.kind === "character_guide" &&
          record.characterId === characterId,
      );
      return Boolean(
        snapshot &&
          repository &&
          repository.kind === "character_guide" &&
          exactEqual(snapshot, projectRepositoryPresetGuide(repository)),
      );
    });
  const liveSnapshotParity = presetCharacterIds.every((characterId) => {
    const guide = snapshotGuides.find(
      (candidate) => candidate.characterId === characterId,
    );
    return Boolean(
      guide &&
        exactEqual(
          guide,
          projectLivePresetGuide(input.liveBuildPreset, characterId),
        ),
    );
  });
  const liveRevisionHashMatches =
    input.genshinToolsSnapshot.sourceRevision.files.some(
      ({ path: revisionPath, sha256 }) =>
        revisionPath ===
          "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json" &&
        sha256 ===
          EXPECTED_INPUT_FILE_SHA256[
            "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json"
          ],
    );
  assertCheck(
    issues,
    snapshotRepositoryParity,
    "source.preset_repository_parity_drift",
    "genshinTools.characterGuides",
    "Selected preset snapshot guides no longer match their repository records.",
  );
  assertCheck(
    issues,
    liveSnapshotParity,
    "source.live_preset_parity_drift",
    "liveBuildPreset",
    "Selected live preset lists/builds no longer match their source snapshot.",
  );
  assertCheck(
    issues,
    liveRevisionHashMatches,
    "source.live_revision_drift",
    "genshinToolsSnapshot.sourceRevision",
    "Preset snapshot no longer binds the exact live build file.",
  );

  const weaponCoverage = authenticateWeaponCoverage(
    input.weaponCoverageReport,
  );
  const artifactCoverage = authenticateArtifactCoverage(
    input.artifactCoverageReport,
  );
  assertCheck(
    issues,
    weaponCoverage.matched === 8,
    "source.weapon_coverage_drift",
    "weaponCoverageReport.observations",
    "Expected exact coverage for eight weapon occurrences.",
  );
  assertCheck(
    issues,
    artifactCoverage.matched === 12,
    "source.artifact_coverage_drift",
    "artifactCoverageReport.observations",
    "Expected exact coverage for twelve artifact occurrences.",
  );

  return {
    registry: {
      repositoryRegistryHashMatches,
      kqmPolicyMatches,
      genshinToolsPolicyMatches,
    },
    manualIndex: {
      exactKeqingEntryCount: keqingIndexEntries.length,
      exactEntryPresent: keqingIndexEntries.length === 1,
    },
    kqm: {
      rawRecordCount: input.kqmSnapshot.records.length,
      selectedRecordIds: repositoryKqmIds,
      rawRepositoryParity,
      evidenceClaimIds: expectedEvidenceClaimIds,
      evidenceParity,
    },
    genshinTools: {
      characterIds: presetCharacterIds,
      snapshotRepositoryParity,
      liveSnapshotParity,
      liveRevisionHashMatches,
    },
    coverage: {
      expectedWeaponObservationCount: 8,
      matchedWeaponObservationCount: weaponCoverage.matched,
      expectedArtifactObservationCount: 12,
      matchedArtifactObservationCount: artifactCoverage.matched,
      exactObservationClosure:
        weaponCoverage.matched === 8 && artifactCoverage.matched === 12,
    },
  };
}

function authenticateRequest(
  repository: KnowledgeRepository,
  kqmSnapshot: ManualObservationSnapshot,
  issues: Issue[],
): RequestBoundary {
  const teams = repository.records.filter(
    (record) => record.id === TEAM_RECORD_ID && record.kind === "team",
  );
  const rawTeams = kqmSnapshot.records.filter(
    (record) =>
      record.sourceRecordId ===
        "keqing-ineffa-furina-xilonen-lunar-charged-example" &&
      record.kind === "team",
  );
  const team = teams[0];
  const rawTeam = rawTeams[0];
  const exactRoster =
    team?.kind === "team"
      ? team.members.map(({ characterId }) => characterId)
      : [];
  const allSourceTeamEquipmentNull =
    team?.kind === "team" &&
    team.members.every(
      ({ selectedArtifact, selectedWeapon }) =>
        selectedArtifact === null && selectedWeapon === null,
    ) &&
    rawTeam?.kind === "team" &&
    rawTeam.members.every(
      ({ weaponRecommendations, artifactRecommendations, erTargets }) =>
        weaponRecommendations.length === 0 &&
        artifactRecommendations.length === 0 &&
        erTargets.length === 0,
    );
  const sourceTeamArtifactPlanCount =
    team?.kind === "team" && "artifactPlans" in team && team.artifactPlans
      ? team.artifactPlans.length
      : 0;
  const warningPresent =
    team?.kind === "team" && team.unknowns.includes(XILONEN_SCROLL_WARNING);
  assertCheck(
    issues,
    teams.length === 1 && rawTeams.length === 1,
    "request.team_identity_drift",
    "request.teamRecordId",
    "The exact team must occur once in raw and normalized inputs.",
  );
  assertCheck(
    issues,
    exactEqual(exactRoster, EXACT_ROSTER),
    "request.roster_drift",
    "request.exactRoster",
    "The exact four-character roster changed.",
  );
  assertCheck(
    issues,
    Boolean(allSourceTeamEquipmentNull) && sourceTeamArtifactPlanCount === 0,
    "request.source_equipment_drift",
    "request.sourceTeamEquipment",
    "The source team must remain equipment-null with no artifact plan.",
  );
  assertCheck(
    issues,
    warningPresent,
    "request.xilonen_warning_drift",
    "request.xilonenScrollWarning",
    "The exact source warning about Xilonen Scroll is missing.",
  );
  return {
    requestId: "keqing-lunar-c0-r5-four-star-team-equipment-enumeration-v1",
    teamRecordId: TEAM_RECORD_ID,
    exactRoster: [...EXACT_ROSTER],
    allSourceTeamEquipmentNull: Boolean(allSourceTeamEquipmentNull),
    sourceTeamArtifactPlanCount: 0,
    constellationByCharacter: {
      keqing: 0,
      ineffa: 0,
      furina: 0,
      xilonen: 0,
    },
    requestedWeaponRefinementByCharacter: {
      keqing: 5,
      ineffa: 1,
      furina: 1,
      xilonen: 1,
    },
    scenarioAssumption: {
      assumptionId:
        "assume-keqing-top-lunar-contributor-without-crit-rate-set-v1",
      provenance: "wrapper-supplied-request-assumption",
      exactSourceCondition: TOP_CONTRIBUTOR_CONDITION,
      gameplayValidated: false,
    },
    conditionResolutions: {
      lunarChargedRosterCondition: {
        exactSourceCondition: LUNAR_CONDITION,
        resolution: "matched-by-exact-team-facts",
      },
      equalRefinementCondition: {
        exactSourceCondition: EQUAL_REFINEMENT_CONDITION,
        sourceResolution: "withheld-unresolved-source-condition",
        effectiveResolution: "matched-by-exact-team-and-supplied-request",
        requestRefinement: 5,
      },
      topContributorCondition: {
        exactSourceCondition: TOP_CONTRIBUTOR_CONDITION,
        sourceResolution: "withheld-unresolved-source-condition",
        effectiveResolution: "matched-by-exact-team-and-supplied-request",
        assumptionId:
          "assume-keqing-top-lunar-contributor-without-crit-rate-set-v1",
      },
    },
    gameplayApplicability: "unknown-not-validated",
    presetTeamApplicability: "unknown-not-evaluated",
    xilonenScrollWarning: XILONEN_SCROLL_WARNING,
  };
}

function buildInventory(): EquipmentInventoryOccurrence[] {
  const active = "active-experiment-axis" as const;
  const notFirst = "excluded-not-first-preset-build-scope" as const;
  return [
    inventory("kqm-keqing-weapon-group-0", "keqing", "weapon", "lions_roar", `${KQM_WEAPON_RECORD_ID}:weapon:0:0`, KQM_WEAPON_SOURCE_RECORD_ID, 0, 0, 0, active, "Exact KQM tied group member; request supplies R5."),
    inventory("kqm-keqing-weapon-group-0", "keqing", "weapon", "the_black_sword", `${KQM_WEAPON_RECORD_ID}:weapon:0:1`, KQM_WEAPON_SOURCE_RECORD_ID, 0, 0, 1, active, "Exact KQM tied group member; request supplies R5."),
    inventory("kqm-keqing-weapon-group-1", "keqing", "weapon", "wolffang", `${KQM_WEAPON_RECORD_ID}:weapon:1:0`, KQM_WEAPON_SOURCE_RECORD_ID, 1, 1, 0, active, "Exact KQM second ranked group member; request supplies R5."),
    inventory("kqm-keqing-artifact-group-0", "keqing", "artifact", "4pc:thundering_fury", `${KQM_ARTIFACT_RECORD_ID}:artifact:0:0`, KQM_ARTIFACT_SOURCE_RECORD_ID, 0, 0, 0, active, "Conditional source alternative admitted under the explicit request assumption only."),
    inventory("kqm-keqing-artifact-group-0", "keqing", "artifact", "4pc:gilded_dreams", `${KQM_ARTIFACT_RECORD_ID}:artifact:0:1`, KQM_ARTIFACT_SOURCE_RECORD_ID, 0, 0, 1, active, "Conditional source alternative admitted under the explicit request assumption only."),
    inventory("preset-furina-weapon-list", "furina", "weapon", "freedomsworn", "genshintools-presets:character-guide:furina:weapon-order:0", "furina", 0, null, 0, active, "Preset weapon list entry selected at R1; list index is not a rank."),
    inventory("preset-furina-weapon-list", "furina", "weapon", "key_of_khajnisut", "genshintools-presets:character-guide:furina:weapon-order:1", "furina", 1, null, 1, active, "Preset weapon list entry selected at R1; list index is not a rank."),
    inventory("preset-furina-weapon-list", "furina", "weapon", "splendor_of_tranquil_waters", "genshintools-presets:character-guide:furina:weapon-order:2", "furina", 2, null, 2, active, "Preset weapon list entry selected at R1; list index is not a rank."),
    inventory("preset-furina-build-list", "furina", "artifact", "4pc:golden_troupe", "genshintools-presets:character-guide:furina:build:BQAI0BO", "BQAI0BO", 0, null, 0, active, "Visible preset build identity projected without stat weights."),
    inventory("preset-furina-build-list", "furina", "artifact", "4pc:tenacity_of_the_millelith", "genshintools-presets:character-guide:furina:build:BQA4H1m", "BQA4H1m", 1, null, 1, active, "Visible preset build identity projected without stat weights."),
    inventory("preset-furina-build-list", "furina", "artifact", "2pc+2pc:er-20+er-20", "genshintools-presets:character-guide:furina:build:BOfjRIm", "BOfjRIm", 2, null, 2, "excluded-deferred-energy", "Artifact-choice identity is explicitly ER-derived and deferred from CP36."),
    inventory("preset-ineffa-weapon-list", "ineffa", "weapon", "fractured_halo", "genshintools-presets:character-guide:ineffa:weapon-order:0", "ineffa", 0, null, 0, active, "Singleton preset weapon list entry selected at R1."),
    inventory("preset-ineffa-build-list", "ineffa", "artifact", "4pc:aubade_of_morningstar_and_moon", "genshintools-presets:character-guide:ineffa:build:FeFiQU8", "FeFiQU8", 0, null, 0, active, "First preset build is the bounded fixture scope."),
    inventory("preset-ineffa-build-list", "ineffa", "artifact", "4pc:silken_moons_serenade", "genshintools-presets:character-guide:ineffa:build:FeFi2JG", "FeFi2JG", 1, null, 1, notFirst, "Outside the bounded first-build fixture scope; no suitability judgment."),
    inventory("preset-ineffa-build-list", "ineffa", "artifact", "4pc:gilded_dreams", "genshintools-presets:character-guide:ineffa:build:FeFbxRe", "FeFbxRe", 2, null, 2, notFirst, "Outside the bounded first-build fixture scope; no suitability judgment."),
    inventory("preset-ineffa-build-list", "ineffa", "artifact", "4pc:tenacity_of_the_millelith", "genshintools-presets:character-guide:ineffa:build:FeFQVGG", "FeFQVGG", 3, null, 3, notFirst, "Outside the bounded first-build fixture scope; no suitability judgment."),
    inventory("preset-xilonen-weapon-list", "xilonen", "weapon", "peak_patrol_song", "genshintools-presets:character-guide:xilonen:weapon-order:0", "xilonen", 0, null, 0, active, "Singleton preset weapon list entry selected at R1."),
    inventory("preset-xilonen-build-list", "xilonen", "artifact", "4pc:scroll_of_the_hero_of_cinder_city", "genshintools-presets:character-guide:xilonen:build:Dbt0Wkm", "Dbt0Wkm", 0, null, 0, active, "First preset build identity; team applicability remains unknown."),
    inventory("preset-xilonen-build-list", "xilonen", "artifact", "4pc:instructor", "genshintools-presets:character-guide:xilonen:build:Dbspw5m", "Dbspw5m", 1, null, 1, notFirst, "Outside the bounded first-build fixture scope; no suitability judgment."),
    inventory("preset-xilonen-build-list", "xilonen", "artifact", "4pc:obsidian_codex", "genshintools-presets:character-guide:xilonen:build:Dbt0reG", "Dbt0reG", 2, null, 2, "excluded-investment-mismatch", "Source build requires C6 while the exact request is C0."),
  ];
}

function inventory(
  groupId: string,
  characterId: string,
  equipmentKind: "weapon" | "artifact",
  equipmentId: string,
  occurrenceId: string,
  sourceRecordId: string,
  sourceListIndex: number,
  sourceGroupIndex: number | null,
  sourceMemberIndex: number,
  status: InventoryStatus,
  reason: string,
): EquipmentInventoryOccurrence {
  return {
    occurrenceId,
    groupId,
    characterId,
    equipmentKind,
    equipmentId,
    sourceRecordId,
    sourceListIndex,
    sourceGroupIndex,
    sourceMemberIndex,
    status,
    reason,
  };
}

function authenticateInventory(
  occurrences: EquipmentInventoryOccurrence[],
  issues: Issue[],
): void {
  const statusCounts = {
    active: occurrences.filter(({ status }) => status === "active-experiment-axis").length,
    notFirst: occurrences.filter(({ status }) => status === "excluded-not-first-preset-build-scope").length,
    investment: occurrences.filter(({ status }) => status === "excluded-investment-mismatch").length,
    deferredEr: occurrences.filter(({ status }) => status === "excluded-deferred-energy").length,
  };
  assertCheck(
    issues,
    occurrences.length === 20 &&
      new Set(occurrences.map(({ occurrenceId }) => occurrenceId)).size === 20 &&
      new Set(occurrences.map(({ groupId }) => groupId)).size === 9 &&
      exactEqual(statusCounts, { active: 14, notFirst: 4, investment: 1, deferredEr: 1 }),
    "inventory.closure_drift",
    "inventory",
    "Expected 20 unique occurrences over nine groups/lists with status counts 14/4/1/1.",
  );
}

function buildActiveAxes(): SourceBackedEquipmentAxis<LatticePayload>[] {
  const axes: SourceBackedEquipmentAxis<LatticePayload>[] = [];
  const kqmWeaponConditions = [LUNAR_CONDITION, EQUAL_REFINEMENT_CONDITION];
  const kqmArtifactConditions = [LUNAR_CONDITION, TOP_CONTRIBUTOR_CONDITION];
  axes.push({
    axisId: "member:keqing:weapon",
    teamMemberId: "member:keqing",
    characterId: "keqing",
    equipmentKind: "weapon",
    groups: [
      sourceGroup({
        groupId: "kqm-keqing-weapon-group-0",
        characterId: "keqing",
        kind: "weapon",
        sourceId: "kqm",
        sourceRecordId: KQM_WEAPON_SOURCE_RECORD_ID,
        repositoryRecordId: KQM_WEAPON_RECORD_ID,
        recommendationId: KQM_WEAPON_RECOMMENDATION_ID,
        ordering: "ranked-groups",
        groupIndex: 0,
        grouping: "tied",
        classification: "recommended",
        sourceLocalRank: null,
        sourceConditions: kqmWeaponConditions,
        occurrenceSpecs: [
          ["lions_roar", `${KQM_WEAPON_RECORD_ID}:weapon:0:0`, 5],
          ["the_black_sword", `${KQM_WEAPON_RECORD_ID}:weapon:0:1`, 5],
        ],
      }),
      sourceGroup({
        groupId: "kqm-keqing-weapon-group-1",
        characterId: "keqing",
        kind: "weapon",
        sourceId: "kqm",
        sourceRecordId: KQM_WEAPON_SOURCE_RECORD_ID,
        repositoryRecordId: KQM_WEAPON_RECORD_ID,
        recommendationId: KQM_WEAPON_RECOMMENDATION_ID,
        ordering: "ranked-groups",
        groupIndex: 1,
        grouping: "single",
        classification: "alternative",
        sourceLocalRank: null,
        sourceConditions: kqmWeaponConditions,
        occurrenceSpecs: [
          ["wolffang", `${KQM_WEAPON_RECORD_ID}:weapon:1:0`, 5],
        ],
      }),
    ],
  });
  axes.push({
    axisId: "member:keqing:artifact",
    teamMemberId: "member:keqing",
    characterId: "keqing",
    equipmentKind: "artifact",
    groups: [
      sourceGroup({
        groupId: "kqm-keqing-artifact-group-0",
        characterId: "keqing",
        kind: "artifact",
        sourceId: "kqm",
        sourceRecordId: KQM_ARTIFACT_SOURCE_RECORD_ID,
        repositoryRecordId: KQM_ARTIFACT_RECORD_ID,
        recommendationId: KQM_ARTIFACT_RECOMMENDATION_ID,
        ordering: "unranked",
        groupIndex: 0,
        grouping: "alternatives",
        classification: "conditional",
        sourceLocalRank: null,
        sourceConditions: kqmArtifactConditions,
        occurrenceSpecs: [
          ["4pc:thundering_fury", `${KQM_ARTIFACT_RECORD_ID}:artifact:0:0`, null],
          ["4pc:gilded_dreams", `${KQM_ARTIFACT_RECORD_ID}:artifact:0:1`, null],
        ],
      }),
    ],
  });
  axes.push(...presetAxes("ineffa", ["fractured_halo"], [["FeFiQU8", "4pc:aubade_of_morningstar_and_moon"]]));
  axes.push(...presetAxes("furina", ["freedomsworn", "key_of_khajnisut", "splendor_of_tranquil_waters"], [["BQAI0BO", "4pc:golden_troupe"], ["BQA4H1m", "4pc:tenacity_of_the_millelith"]]));
  axes.push(...presetAxes("xilonen", ["peak_patrol_song"], [["Dbt0Wkm", "4pc:scroll_of_the_hero_of_cinder_city"]]));
  return axes;
}

type GroupSpec = {
  groupId: string;
  characterId: string;
  kind: "weapon" | "artifact";
  sourceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  recommendationId: string;
  ordering: "ranked-groups" | "unranked" | null;
  groupIndex: number;
  grouping: "single" | "alternatives" | "tied";
  classification:
    | "default"
    | "recommended"
    | "alternative"
    | "conditional"
    | "available-only"
    | null;
  sourceLocalRank: number | null;
  sourceConditions: string[];
  occurrenceSpecs: Array<readonly [string, string, number | null]>;
};

function buildWrapperWithheldCoreReport(
  input: SourceBackedEquipmentCandidateLatticeInput<LatticePayload>,
): SourceBackedEquipmentCandidateLatticeReport<LatticePayload> {
  const occurrenceCount = input.axes.reduce(
    (sum, axis) =>
      sum +
      axis.groups.reduce(
        (groupSum, group) => groupSum + group.occurrences.length,
        0,
      ),
    0,
  );
  return {
    schemaVersion: 1,
    classification: "source-backed-equipment-candidate-lattice",
    comparisonStatus: "not-comparable",
    capabilities: {
      sourceClaims: false,
      equipmentRecommendationClaims: false,
      rankClaims: false,
      guideClaims: false,
      evaluation: false,
      damage: false,
      energyRecovery: false,
      enumeration: false,
    },
    inputBoundary: {
      sourceAuthenticationOwner: "source-specific-wrapper",
      sourceAuthenticationPerformedByCore: false,
      memberCount: input.teamMembers.length,
      axisCount: input.axes.length,
      activeAxisCount: input.axes.filter((axis) =>
        axis.groups.some((group) => group.occurrences.length > 0),
      ).length,
      occurrenceCount,
      requestAssumptionsSha256: sha256Text(
        stableJson({
          requestId: input.request.requestId,
          assumptions: input.request.assumptions,
        }),
      ),
      evaluationAssumptionsSha256: sha256Text(
        stableJson({
          evaluationId: input.evaluation.evaluationId,
          assumptions: input.evaluation.assumptions,
        }),
      ),
    },
    preflight: {
      countArithmetic: "bigint-decimal",
      expectedCombinationCount: input.bounds.expectedCombinationCount,
      maximumCombinationCount: input.bounds.maximumCombinationCount,
      calculatedCombinationCount: null,
      countMatchesExpected: false,
      withinMaximum: false,
    },
    lattice: null,
    issues: [
      {
        code: "wrapper.source_authentication_failed",
        path: "source-specific-wrapper",
        message:
          "Source-specific authentication failed before generic enumeration; the core was not executed.",
      },
    ],
  };
}

function sourceGroup(
  spec: GroupSpec,
): SourceBackedEquipmentAxis<LatticePayload>["groups"][number] {
  const preset = spec.sourceId === "genshintools-presets";
  return {
    groupId: spec.groupId,
    teamMemberId: `member:${spec.characterId}`,
    characterId: spec.characterId,
    equipmentKind: spec.kind,
    provenance: {
      sourceId: spec.sourceId,
      sourceRecordId: spec.sourceRecordId,
      repositoryRecordId: spec.repositoryRecordId,
      recommendationId: spec.recommendationId,
    },
    recommendationOrdering: spec.ordering,
    groupIndex: spec.groupIndex,
    grouping: spec.grouping,
    classification: spec.classification,
    sourceLocalRank: spec.sourceLocalRank,
    sourceListIndex: spec.groupIndex,
    sourceConditions: [...spec.sourceConditions],
    sourceConditionsSha256: sha256Text(stableJson(spec.sourceConditions)),
    occurrences: spec.occurrenceSpecs.map(
      ([equipmentId, claimId, requestedRefinement], index) => ({
        occurrenceId: claimId,
        claimId,
        listIndex: index,
        alternativeIndex: spec.grouping === "alternatives" ? index : null,
        tieIndex: spec.grouping === "tied" ? index : null,
        energyDerivation: "not-er-derived" as const,
        payload: {
          equipmentId,
          artifactType: spec.kind === "artifact" ? equipmentId.split(":")[0] : null,
          sourceRefinement: null,
          requestedRefinement,
          sourceOrderingSemantics: preset
            ? spec.kind === "weapon"
              ? "preset-list-index-not-rank"
              : "preset-build-index-not-rank"
            : spec.kind === "weapon"
              ? "ranked-groups-with-tie"
              : "unranked-alternatives",
          sourceConditionResolution: preset
            ? "no-source-team-condition"
            : "withheld-unresolved-source-condition",
          effectiveConditionResolution: preset
            ? "not-evaluated"
            : "matched-by-exact-team-and-supplied-request",
          gameplayApplicability: "unknown-not-validated",
          sourcePublishedWholeCandidate: false,
        },
      }),
    ),
  };
}

function presetAxes(
  characterId: "ineffa" | "furina" | "xilonen",
  weaponIds: string[],
  artifacts: Array<readonly [string, string]>,
): SourceBackedEquipmentAxis<LatticePayload>[] {
  const repositoryRecordId = `genshintools-presets:character-guide:${characterId}`;
  const weaponGrouping = weaponIds.length === 1 ? "single" : "alternatives";
  const artifactGrouping = artifacts.length === 1 ? "single" : "alternatives";
  return [
    {
      axisId: `member:${characterId}:weapon`,
      teamMemberId: `member:${characterId}`,
      characterId,
      equipmentKind: "weapon",
      groups: [
        sourceGroup({
          groupId: `preset-${characterId}-weapon-list`,
          characterId,
          kind: "weapon",
          sourceId: "genshintools-presets",
          sourceRecordId: characterId,
          repositoryRecordId,
          recommendationId: "weaponOrder",
          ordering: null,
          groupIndex: 0,
          grouping: weaponGrouping,
          classification: null,
          sourceLocalRank: null,
          sourceConditions: [],
          occurrenceSpecs: weaponIds.map((weaponId, index) => [
            weaponId,
            `${repositoryRecordId}:weapon-order:${index}`,
            1,
          ]),
        }),
      ],
    },
    {
      axisId: `member:${characterId}:artifact`,
      teamMemberId: `member:${characterId}`,
      characterId,
      equipmentKind: "artifact",
      groups: [
        sourceGroup({
          groupId: `preset-${characterId}-build-list`,
          characterId,
          kind: "artifact",
          sourceId: "genshintools-presets",
          sourceRecordId: characterId,
          repositoryRecordId,
          recommendationId: "builds",
          ordering: null,
          groupIndex: 0,
          grouping: artifactGrouping,
          classification: null,
          sourceLocalRank: null,
          sourceConditions: [],
          occurrenceSpecs: artifacts.map(([buildId, artifactId]) => [
            artifactId,
            `${repositoryRecordId}:build:${buildId}`,
            null,
          ]),
        }),
      ],
    },
  ];
}

function authenticateKqmRecordParity(
  rawRecords: ManualObservationSnapshot["records"],
  repositoryRecords: KnowledgeRepository["records"],
): boolean {
  if (rawRecords.length !== 3 || repositoryRecords.length !== 3) return false;
  const rawTeam = rawRecords.find((record) => record.kind === "team");
  const repositoryTeam = repositoryRecords.find(
    (record) => record.kind === "team",
  );
  const rawWeapon = rawRecords.find(
    (record) => record.sourceRecordId === KQM_WEAPON_SOURCE_RECORD_ID,
  );
  const repositoryWeapon = repositoryRecords.find(
    (record) => record.id === KQM_WEAPON_RECORD_ID,
  );
  const rawArtifact = rawRecords.find(
    (record) => record.sourceRecordId === KQM_ARTIFACT_SOURCE_RECORD_ID,
  );
  const repositoryArtifact = repositoryRecords.find(
    (record) => record.id === KQM_ARTIFACT_RECORD_ID,
  );
  if (
    !rawTeam ||
    rawTeam.kind !== "team" ||
    !repositoryTeam ||
    repositoryTeam.kind !== "team" ||
    !rawWeapon ||
    rawWeapon.kind !== "character_guide" ||
    !repositoryWeapon ||
    repositoryWeapon.kind !== "character_guide" ||
    !rawArtifact ||
    rawArtifact.kind !== "character_guide" ||
    !repositoryArtifact ||
    repositoryArtifact.kind !== "character_guide" ||
    !repositoryWeapon.recommendations ||
    repositoryWeapon.recommendations.length !== 1 ||
    !repositoryArtifact.recommendations ||
    repositoryArtifact.recommendations.length !== 1
  ) {
    return false;
  }
  return (
    exactEqual(rawWeapon.recommendation, repositoryWeapon.recommendations[0]) &&
    exactEqual(rawArtifact.recommendation, repositoryArtifact.recommendations[0]) &&
    exactEqual(
      rawTeam.members.map(({ characterId }) => characterId),
      repositoryTeam.members.map(({ characterId }) => characterId),
    ) &&
    exactEqual(rawTeam.reactions, repositoryTeam.reactions) &&
    exactEqual(rawTeam.rotations, repositoryTeam.rotations) &&
    rawTeam.label === repositoryTeam.label &&
    rawTeam.intent === repositoryTeam.intent &&
    rawTeam.rankingClaim === repositoryTeam.rankingClaim
  );
}

function authenticateEvidenceClaims(
  claims: KeqingLunarEquipmentEvidenceValidationReport["claims"],
  report: KeqingLunarEquipmentEvidenceValidationReport,
): boolean {
  if (
    report.validationStatus !== "comparable" ||
    report.supportsGuideClaims ||
    report.supportsEquipmentRecommendations ||
    report.supportsStatRecommendations ||
    report.supportsRankClaims ||
    report.supportsConditionApplicabilityClaims ||
    report.supportsDamageClaims ||
    report.supportsEnergyRecoveryClaims ||
    report.candidateGenerationInput ||
    report.candidateGenerationExecuted ||
    report.damageOrRankingComputationExecuted ||
    report.energyRecoveryInputsUsed
  ) {
    return false;
  }
  const target = report.publishedTeamBoundary.targets.filter(
    ({ teamRecordId }) => teamRecordId === TEAM_RECORD_ID,
  );
  if (
    target.length !== 1 ||
    !target[0].allEquipmentUnselected ||
    !target[0].allInvestmentsUnspecified ||
    !exactEqual(target[0].characterIds, EXACT_ROSTER)
  ) {
    return false;
  }
  const expected = [
    {
      claimId: `${KQM_WEAPON_RECORD_ID}:weapon:0:0`,
      sourceRecordId: KQM_WEAPON_SOURCE_RECORD_ID,
      recommendationId: KQM_WEAPON_RECOMMENDATION_ID,
      sourceClaim: {
        kind: "weapon",
        recommendationOrdering: "ranked-groups",
        groupIndex: 0,
        weaponIndex: 0,
        weaponId: "lions_roar",
        grouping: "tied",
        classification: "recommended",
      },
      conditions: [LUNAR_CONDITION, EQUAL_REFINEMENT_CONDITION],
    },
    {
      claimId: `${KQM_WEAPON_RECORD_ID}:weapon:0:1`,
      sourceRecordId: KQM_WEAPON_SOURCE_RECORD_ID,
      recommendationId: KQM_WEAPON_RECOMMENDATION_ID,
      sourceClaim: {
        kind: "weapon",
        recommendationOrdering: "ranked-groups",
        groupIndex: 0,
        weaponIndex: 1,
        weaponId: "the_black_sword",
        grouping: "tied",
        classification: "recommended",
      },
      conditions: [LUNAR_CONDITION, EQUAL_REFINEMENT_CONDITION],
    },
    {
      claimId: `${KQM_WEAPON_RECORD_ID}:weapon:1:0`,
      sourceRecordId: KQM_WEAPON_SOURCE_RECORD_ID,
      recommendationId: KQM_WEAPON_RECOMMENDATION_ID,
      sourceClaim: {
        kind: "weapon",
        recommendationOrdering: "ranked-groups",
        groupIndex: 1,
        weaponIndex: 0,
        weaponId: "wolffang",
        grouping: "single",
        classification: "alternative",
      },
      conditions: [LUNAR_CONDITION, EQUAL_REFINEMENT_CONDITION],
    },
    ...["thundering_fury", "gilded_dreams"].map((setId, artifactIndex) => ({
      claimId: `${KQM_ARTIFACT_RECORD_ID}:artifact:0:${artifactIndex}`,
      sourceRecordId: KQM_ARTIFACT_SOURCE_RECORD_ID,
      recommendationId: KQM_ARTIFACT_RECOMMENDATION_ID,
      sourceClaim: {
        kind: "artifact",
        recommendationOrdering: "unranked",
        groupIndex: 0,
        artifactIndex,
        artifact: { type: "4pc", setId },
        grouping: "alternatives",
        classification: "conditional",
      },
      conditions: [LUNAR_CONDITION, TOP_CONTRIBUTOR_CONDITION],
    })),
  ];
  return expected.every((spec) => {
    const matches = claims.filter(({ claimId }) => claimId === spec.claimId);
    if (matches.length !== 1) return false;
    const claim = matches[0];
    const teamResolutions = claim.teamResolutions.filter(
      ({ teamRecordId }) => teamRecordId === TEAM_RECORD_ID,
    );
    return (
      claim.repositoryRecordId ===
        (spec.sourceClaim.kind === "weapon"
          ? KQM_WEAPON_RECORD_ID
          : KQM_ARTIFACT_RECORD_ID) &&
      claim.sourceRecordId === spec.sourceRecordId &&
      claim.recommendationId === spec.recommendationId &&
      claim.allSourceConditionsMappedExactly &&
      exactEqual(claim.sourceClaim, spec.sourceClaim) &&
      exactEqual(claim.sourceConditions, spec.conditions) &&
      teamResolutions.length === 1 &&
      teamResolutions[0].resolution ===
        "withheld-unresolved-source-condition"
    );
  });
}

function projectRepositoryPresetGuide(
  record: Extract<
    KnowledgeRepository["records"][number],
    { kind: "character_guide" }
  >,
): GenshinToolsPresetSnapshot["characterGuides"][number] {
  const sourceRef = record.sourceRefs[0];
  return {
    builds: record.builds,
    characterId: record.characterId,
    kind: "character_guide",
    locator: sourceRef.locator,
    sourceRecordId: sourceRef.sourceRecordId,
    unknowns: record.unknowns,
    weaponOrder: record.weaponOrder,
  };
}

function projectLivePresetGuide(
  input: unknown,
  characterId: string,
): unknown {
  const live = asRecord(input);
  const builds = asRecord(live.builds);
  const characterBuilds = asRecord(live.characterBuilds);
  const characterWeapons = asRecord(live.characterWeapons);
  const buildIds = asStringArray(characterBuilds[characterId]);
  const weaponOrder = asStringArray(characterWeapons[characterId]);
  return {
    builds: buildIds.map((buildId) => projectLiveBuild(builds[buildId])),
    characterId,
    kind: "character_guide",
    locator: {
      file: "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json",
      recordId: characterId,
    },
    sourceRecordId: characterId,
    unknowns: [
      "team applicability",
      "weapon refinement assumptions",
      "ER floors",
      "formula counts",
    ],
    weaponOrder,
  };
}

function projectLiveBuild(input: unknown): unknown {
  const build = asRecord(input);
  const composition = String(build.composition ?? "");
  const artifact =
    composition === "4pc"
      ? { type: "4pc", setId: String(build.artifactSet ?? "") }
      : {
          type: "2pc+2pc",
          halfSetIds: [String(build.halfSet1 ?? ""), String(build.halfSet2 ?? "")],
        };
  const result: Record<string, unknown> = {
    artifact,
    circlet: build.circletWeights,
    goblet: build.gobletWeights,
    roles: build.roles,
    sands: build.sandsWeights,
    sourceRecordId: build.id,
    styles: build.styles,
    substats: build.substats,
    visible: build.visible,
  };
  if (typeof build.name === "string" && build.name.length > 0) {
    result.name = build.name;
  }
  if (typeof build.minCons === "number") {
    result.minConstellation = build.minCons;
  }
  return result;
}

function authenticateWeaponCoverage(
  report: WeaponChoiceSearchCoverageReport,
): { matched: number } {
  const specs = [
    weaponCoverageSpec(
      `${KQM_WEAPON_RECORD_ID}:recommendation:${KQM_WEAPON_RECOMMENDATION_ID}:weapon-group:0:0`,
      KQM_WEAPON_RECORD_ID,
      "keqing",
      "lions_roar",
      [5],
      "character-guide-recommendation",
      0,
      0,
    ),
    weaponCoverageSpec(
      `${KQM_WEAPON_RECORD_ID}:recommendation:${KQM_WEAPON_RECOMMENDATION_ID}:weapon-group:0:1`,
      KQM_WEAPON_RECORD_ID,
      "keqing",
      "the_black_sword",
      [5],
      "character-guide-recommendation",
      0,
      1,
    ),
    weaponCoverageSpec(
      `${KQM_WEAPON_RECORD_ID}:recommendation:${KQM_WEAPON_RECOMMENDATION_ID}:weapon-group:1:0`,
      KQM_WEAPON_RECORD_ID,
      "keqing",
      "wolffang",
      [5],
      "character-guide-recommendation",
      1,
      0,
    ),
    ...[
      ["furina", "freedomsworn", 0],
      ["furina", "key_of_khajnisut", 1],
      ["furina", "splendor_of_tranquil_waters", 2],
      ["ineffa", "fractured_halo", 0],
      ["xilonen", "peak_patrol_song", 0],
    ].map(([characterId, weaponId, index]) =>
      weaponCoverageSpec(
        `genshintools-presets:character-guide:${characterId}:weapon-order:${index}`,
        `genshintools-presets:character-guide:${characterId}`,
        String(characterId),
        String(weaponId),
        [1, 5],
        "guide-weapon-order",
        Number(index),
        null,
      ),
    ),
  ];
  let matched = 0;
  for (const spec of specs) {
    const observations = report.observations.filter(
      ({ observationId }) => observationId === spec.observationId,
    );
    if (observations.length !== 1) continue;
    const observation = observations[0] as unknown as Record<string, unknown>;
    const domain = asRecord(observation.weaponIdDomain);
    const compatibility = asRecord(observation.nativeTypeCompatibility);
    const refinement = asRecord(observation.refinementCoverage);
    const indexMatches =
      spec.sourceKind === "guide-weapon-order"
        ? observation.sourceListIndex === spec.groupOrListIndex
        : observation.recommendationGroupIndex === spec.groupOrListIndex &&
          observation.weaponIndex === spec.memberIndex;
    if (
      observation.recordId === spec.recordId &&
      observation.characterId === spec.characterId &&
      observation.weaponId === spec.weaponId &&
      observation.sourceKind === spec.sourceKind &&
      indexMatches &&
      compatibility.outcome === "compatible" &&
      domain.outcome === "in-released-candidate-domain" &&
      exactEqual(domain.candidateRefinements, spec.candidateRefinements) &&
      refinement.outcome === "unspecified"
    ) {
      matched += 1;
    }
  }
  return { matched };
}

function weaponCoverageSpec(
  observationId: string,
  recordId: string,
  characterId: string,
  weaponId: string,
  candidateRefinements: number[],
  sourceKind: "character-guide-recommendation" | "guide-weapon-order",
  groupOrListIndex: number,
  memberIndex: number | null,
) {
  return {
    observationId,
    recordId,
    characterId,
    weaponId,
    candidateRefinements,
    sourceKind,
    groupOrListIndex,
    memberIndex,
  };
}

function authenticateArtifactCoverage(
  report: ArtifactChoiceSearchCoverageReport,
): { matched: number } {
  const specs = [
    artifactCoverageSpec(
      `${KQM_ARTIFACT_RECORD_ID}:recommendation:${KQM_ARTIFACT_RECOMMENDATION_ID}:0:0`,
      KQM_ARTIFACT_RECORD_ID,
      "keqing",
      "thundering_fury",
      "enumerated-initially",
      "character-guide-recommendation",
      0,
      0,
    ),
    artifactCoverageSpec(
      `${KQM_ARTIFACT_RECORD_ID}:recommendation:${KQM_ARTIFACT_RECOMMENDATION_ID}:0:1`,
      KQM_ARTIFACT_RECORD_ID,
      "keqing",
      "gilded_dreams",
      "enumerated-initially",
      "character-guide-recommendation",
      0,
      1,
    ),
    artifactCoverageSpec(
      "genshintools-presets:character-guide:furina:build:BQAI0BO",
      "genshintools-presets:character-guide:furina",
      "furina",
      "golden_troupe",
      "enumerated-initially",
      "guide-build",
      null,
      null,
    ),
    artifactCoverageSpec(
      "genshintools-presets:character-guide:furina:build:BQA4H1m",
      "genshintools-presets:character-guide:furina",
      "furina",
      "tenacity_of_the_millelith",
      "enumerated-initially",
      "guide-build",
      null,
      null,
    ),
    {
      ...artifactCoverageSpec(
        "genshintools-presets:character-guide:furina:build:BOfjRIm",
        "genshintools-presets:character-guide:furina",
        "furina",
        "er-20+er-20",
        "conditionally-representable",
        "guide-build",
        null,
        null,
      ),
      artifactType: "2pc+2pc" as const,
    },
    ...[
      ["ineffa", "FeFiQU8", "aubade_of_morningstar_and_moon", "enumerated-initially"],
      ["ineffa", "FeFi2JG", "silken_moons_serenade", "enumerated-initially"],
      ["ineffa", "FeFbxRe", "gilded_dreams", "enumerated-initially"],
      ["ineffa", "FeFQVGG", "tenacity_of_the_millelith", "enumerated-initially"],
      ["xilonen", "Dbt0Wkm", "scroll_of_the_hero_of_cinder_city", "enumerated-initially"],
      ["xilonen", "Dbspw5m", "instructor", "not-representable"],
      ["xilonen", "Dbt0reG", "obsidian_codex", "enumerated-initially"],
    ].map(([characterId, buildId, setId, outcome]) =>
      artifactCoverageSpec(
        `genshintools-presets:character-guide:${characterId}:build:${buildId}`,
        `genshintools-presets:character-guide:${characterId}`,
        String(characterId),
        String(setId),
        String(outcome),
        "guide-build",
        null,
        null,
      ),
    ),
  ];
  let matched = 0;
  for (const spec of specs) {
    const observations = report.observations.filter(
      ({ observationId }) => observationId === spec.observationId,
    );
    if (observations.length !== 1) continue;
    const observation = observations[0] as unknown as Record<string, unknown>;
    const artifact = asRecord(observation.artifact);
    const artifactIdentity =
      spec.artifactType === "2pc+2pc"
        ? Array.isArray(artifact.halfSetIds) &&
          artifact.halfSetIds.join("+") === spec.artifactId
        : artifact.setId === spec.artifactId;
    const indexMatches =
      spec.sourceKind === "guide-build" ||
      (observation.recommendationGroupIndex === spec.groupIndex &&
        observation.artifactIndex === spec.memberIndex);
    if (
      observation.recordId === spec.recordId &&
      observation.characterId === spec.characterId &&
      observation.sourceKind === spec.sourceKind &&
      observation.outcome === spec.outcome &&
      artifact.type === spec.artifactType &&
      artifactIdentity &&
      indexMatches
    ) {
      matched += 1;
    }
  }
  return { matched };
}

function artifactCoverageSpec(
  observationId: string,
  recordId: string,
  characterId: string,
  artifactId: string,
  outcome: string,
  sourceKind: "character-guide-recommendation" | "guide-build",
  groupIndex: number | null,
  memberIndex: number | null,
) {
  return {
    observationId,
    recordId,
    characterId,
    artifactId,
    artifactType: "4pc" as "4pc" | "2pc+2pc",
    outcome,
    sourceKind,
    groupIndex,
    memberIndex,
  };
}

export function requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
  report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
): void {
  const completeReportDigestMatches =
    sha256Text(stableJson(report)) === EXPECTED_AUTHENTICATED_REPORT_SHA256;
  const semanticClosure =
    report.validationStatus === "authenticated-enumeration-only" &&
    report.issues.length === 0 &&
    report.inputBoundary.authentication === "accepted" &&
    report.candidateEnumerationExecuted &&
    !report.candidateEvaluationExecuted &&
    !report.candidateGeneratorExecuted &&
    !report.optimizerExecuted &&
    !report.damageComputationExecuted &&
    !report.rankingProduced &&
    !report.guideProduced &&
    !report.recommendationProduced &&
    !report.energyRecoveryInputsUsed &&
    !report.supportsGuideClaims &&
    !report.supportsTeamRecommendations &&
    !report.supportsEquipmentRecommendations &&
    !report.supportsOptimality &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsGameplayApplicabilityClaims &&
    !report.supportsEnergyRequirements &&
    !report.promotionEligible &&
    report.sourceBacking.exactRosterSourceBacked &&
    report.sourceBacking.activeAxisOccurrencesAllSourceBacked &&
    report.sourceBacking.sourceGroupsAndListsRetained &&
    !report.sourceBacking.sourceAuthoredWithinCharacterWeaponArtifactPairing &&
    !report.sourceBacking.sourceAuthoredCrossCharacterComposition &&
    !report.sourceBacking.sourcePublishedWholeTeamEquipment &&
    report.sourceBacking.wholeCandidateCount === 0 &&
    report.sourceBacking.compositionOwner === "source-specific-wrapper" &&
    !report.sourceBacking.gameplayValidated &&
    report.inventoryBoundary.groupOrListCount === 9 &&
    report.inventoryBoundary.occurrenceCount === 20 &&
    report.inventoryBoundary.activeOccurrenceCount === 14 &&
    report.inventoryBoundary.excludedNotFirstScopeCount === 4 &&
    report.inventoryBoundary.excludedInvestmentCount === 1 &&
    report.inventoryBoundary.excludedDeferredEnergyCount === 1 &&
    !report.inventoryBoundary.erStatWeightsProjected &&
    report.summary.memberCount === 4 &&
    report.summary.axisCount === 8 &&
    report.summary.activeGroupCount === 9 &&
    report.summary.activeOccurrenceCount === 14 &&
    report.summary.candidateNodeCount === 36 &&
    report.summary.candidateReferenceCount === 288 &&
    report.summary.sourcePublishedWholeCandidateCount === 0 &&
    report.summary.gameplayValidatedCandidateCount === 0 &&
    isCompleteSourceBackedEquipmentCandidateLattice(report.lattice) &&
    report.lattice.lattice.nodes.every(
      ({ selections }) => selections.length === 8,
    ) &&
    report.lattice.lattice.groups.every((group) =>
      group.occurrences.every(
        ({ energyDerivation, payload }) =>
          energyDerivation === "not-er-derived" &&
          payload.sourcePublishedWholeCandidate === false &&
          payload.gameplayApplicability === "unknown-not-validated",
      ),
    );
  if (!completeReportDigestMatches || !semanticClosure) {
    throw new Error(
      "Refusing to write unauthenticated or mutated Keqing/Ineffa/Furina/Xilonen equipment candidate lattice report.",
    );
  }
}

function hashPayload(value: unknown): string {
  return sha256Text(stableJson(value));
}

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function pick(
  input: object | undefined,
  keys: string[],
): Record<string, unknown> {
  const record = asRecord(input);
  return Object.fromEntries(keys.map((key) => [key, record[key]]));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? [...value]
    : [];
}

function assertCheck(
  issues: Issue[],
  condition: boolean,
  code: string,
  path: string,
  message: string,
): void {
  if (!condition) addIssue(issues, code, path, message);
}

function addIssue(
  issues: Issue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}
