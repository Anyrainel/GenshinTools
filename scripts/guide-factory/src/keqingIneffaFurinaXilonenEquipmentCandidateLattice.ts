import path from "node:path";
import type { ArtifactChoiceSearchCoverageReport } from "./artifactChoiceSearchCoverage";
import { sha256Text, stableJson } from "./io";
import {
  authenticateKeqingIneffaFurinaXilonenEquipmentScope,
  compactKeqingIneffaFurinaXilonenEquipmentScopeAudit,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION,
  requireKeqingIneffaFurinaXilonenEquipmentScope,
  type AuthenticatedKeqingIneffaFurinaXilonenEquipmentScope,
  type CompactKeqingIneffaFurinaXilonenEquipmentScopeAudit,
} from "./keqingIneffaFurinaXilonenEquipmentCandidateLatticeScope";
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
  "a4477c1e941a12e30d8ef14cf6343fbef46406ccd06416cc8b751394e41e4bb6";

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
  semanticScope: {
    authentication: "accepted" | "rejected";
    expectedManifestSha256: string;
    expectedScopeProjectionSha256: string;
    acceptedAudit: CompactKeqingIneffaFurinaXilonenEquipmentScopeAudit | null;
  };
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
  sourceBoundary: {
    registry: {
      kqmPolicyMatches: boolean;
      genshinToolsPolicyMatches: boolean;
    };
    manualIndex: { exactKeqingEntryCount: number; exactEntryPresent: boolean };
    kqm: {
      selectedRawRecordCount: number;
      selectedRecordIds: string[];
      rawRepositoryParity: boolean;
      evidenceClaimIds: string[];
      evidenceParity: boolean;
    };
    genshinTools: {
      characterIds: string[];
      snapshotRepositoryParity: boolean;
      liveSnapshotParity: boolean;
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
  const scopeAuthentication =
    authenticateKeqingIneffaFurinaXilonenEquipmentScope(input);
  let scopedInput: AuthenticatedKeqingIneffaFurinaXilonenEquipmentScope | null =
    null;
  if (scopeAuthentication.status === "accepted") {
    scopedInput = requireKeqingIneffaFurinaXilonenEquipmentScope(input);
  } else {
    for (const issue of scopeAuthentication.issues) {
      addIssue(
        issues,
        `semantic_scope.${issue.code}`,
        issue.path,
        issue.message,
      );
    }
  }
  const semanticScope = {
    authentication: scopedInput ? ("accepted" as const) : ("rejected" as const),
    expectedManifestSha256:
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.manifestSha256,
    expectedScopeProjectionSha256:
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.scopeProjectionSha256,
    acceptedAudit: scopedInput
      ? compactKeqingIneffaFurinaXilonenEquipmentScopeAudit(scopedInput.audit)
      : null,
  };
  const sourceBoundary = scopedInput
    ? authenticateScopedSources(scopedInput, issues)
    : rejectedSourceBoundary();
  const requestBoundary = scopedInput
    ? authenticateRequest(
        scopedInput.repositoryRecords,
        scopedInput.rawKqmRecords,
        issues,
      )
    : rejectedRequestBoundary();
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
    issues.length === 0 && semanticScope.authentication === "accepted";
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
    semanticScope,
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

type SourceBoundary =
  KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport["sourceBoundary"];
type RequestBoundary =
  KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport["requestBoundary"];


function authenticateScopedSources(
  input: AuthenticatedKeqingIneffaFurinaXilonenEquipmentScope,
  issues: Issue[],
): SourceBoundary {
  const kqmPolicyMatches =
    input.sourceRegistryEntries.filter(({ id }) => id === "kqm").length === 1;
  const genshinToolsPolicyMatches =
    input.sourceRegistryEntries.filter(({ id }) => id === "genshintools-presets")
      .length === 1;
  const rawRepositoryParity =
    input.audit.parities.filter(({ parityId }) =>
      parityId.startsWith("raw-repository:"),
    ).length === 3;
  const snapshotRepositoryParity =
    input.audit.parities.filter(({ parityId }) =>
      parityId.startsWith("preset-repository:"),
    ).length === 3;
  const liveSnapshotParity =
    input.audit.parities.filter(({ parityId }) =>
      parityId.startsWith("preset-live:"),
    ).length === 3;
  const evidenceParity =
    input.audit.parities.filter(({ parityId }) =>
      parityId.startsWith("evidence-coverage:"),
    ).length === 5;
  const allSelectedClaimsWithheld = input.evidence.claims.every(
    ({ exactTeamResolution }) =>
      exactTeamResolution.resolution ===
      "withheld-unresolved-source-condition",
  );
  const exactEvidenceCapability =
    input.evidence.capability.validationStatus === "comparable" &&
    !input.evidence.capability.supportsGuideClaims &&
    !input.evidence.capability.supportsEquipmentRecommendations &&
    !input.evidence.capability.supportsStatRecommendations &&
    !input.evidence.capability.supportsRankClaims &&
    !input.evidence.capability.supportsConditionApplicabilityClaims &&
    !input.evidence.capability.supportsDamageClaims &&
    !input.evidence.capability.supportsEnergyRecoveryClaims &&
    !input.evidence.capability.candidateGenerationInput &&
    !input.evidence.capability.candidateGenerationExecuted &&
    !input.evidence.capability.damageOrRankingComputationExecuted &&
    !input.evidence.capability.energyRecoveryInputsUsed;
  const exactTeamEvidence =
    input.evidence.exactTeam.teamRecordId === TEAM_RECORD_ID &&
    input.evidence.exactTeam.allEquipmentUnselected &&
    input.evidence.exactTeam.allInvestmentsUnspecified &&
    exactEqual(input.evidence.exactTeam.characterIds, EXACT_ROSTER);

  assertCheck(
    issues,
    kqmPolicyMatches && genshinToolsPolicyMatches,
    "source.registry_policy_drift",
    "semanticScope.sourceRegistry",
    "The two selected source-policy entries were not materialized exactly once.",
  );
  assertCheck(
    issues,
    rawRepositoryParity && snapshotRepositoryParity && liveSnapshotParity,
    "source.parity_drift",
    "semanticScope.parities",
    "The selected raw, repository, snapshot, or live preset parity boundary drifted.",
  );
  assertCheck(
    issues,
    evidenceParity &&
      allSelectedClaimsWithheld &&
      exactEvidenceCapability &&
      exactTeamEvidence,
    "source.evidence_drift",
    "semanticScope.evidence",
    "The selected evidence capability, exact team target, claims, or coverage references drifted.",
  );

  return {
    registry: { kqmPolicyMatches, genshinToolsPolicyMatches },
    manualIndex: {
      exactKeqingEntryCount:
        input.manualIndexEntry.sourceId === "kqm" &&
        input.manualIndexEntry.path ===
          "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json"
          ? 1
          : 0,
      exactEntryPresent:
        input.manualIndexEntry.sourceId === "kqm" &&
        input.manualIndexEntry.path ===
          "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
    },
    kqm: {
      selectedRawRecordCount: input.rawKqmRecords.length,
      selectedRecordIds: [
        TEAM_RECORD_ID,
        KQM_WEAPON_RECORD_ID,
        KQM_ARTIFACT_RECORD_ID,
      ],
      rawRepositoryParity,
      evidenceClaimIds: input.evidence.claims.map(({ claimId }) => claimId),
      evidenceParity:
        evidenceParity &&
        allSelectedClaimsWithheld &&
        exactEvidenceCapability &&
        exactTeamEvidence,
    },
    genshinTools: {
      characterIds: ["ineffa", "furina", "xilonen"],
      snapshotRepositoryParity,
      liveSnapshotParity,
    },
    coverage: {
      expectedWeaponObservationCount: 8,
      matchedWeaponObservationCount: input.coverage.weapons.length,
      expectedArtifactObservationCount: 12,
      matchedArtifactObservationCount: input.coverage.artifacts.length,
      exactObservationClosure:
        input.coverage.weapons.length === 8 &&
        input.coverage.artifacts.length === 12,
    },
  };
}

function rejectedSourceBoundary(): SourceBoundary {
  return {
    registry: { kqmPolicyMatches: false, genshinToolsPolicyMatches: false },
    manualIndex: { exactKeqingEntryCount: 0, exactEntryPresent: false },
    kqm: {
      selectedRawRecordCount: 0,
      selectedRecordIds: [],
      rawRepositoryParity: false,
      evidenceClaimIds: [],
      evidenceParity: false,
    },
    genshinTools: {
      characterIds: [],
      snapshotRepositoryParity: false,
      liveSnapshotParity: false,
    },
    coverage: {
      expectedWeaponObservationCount: 8,
      matchedWeaponObservationCount: 0,
      expectedArtifactObservationCount: 12,
      matchedArtifactObservationCount: 0,
      exactObservationClosure: false,
    },
  };
}

function authenticateRequest(
  repositoryRecords: AuthenticatedKeqingIneffaFurinaXilonenEquipmentScope["repositoryRecords"],
  rawKqmRecords: AuthenticatedKeqingIneffaFurinaXilonenEquipmentScope["rawKqmRecords"],
  issues: Issue[],
): RequestBoundary {
  const teams = repositoryRecords.filter(
    (record) => record.id === TEAM_RECORD_ID && record.kind === "team",
  );
  const rawTeams = rawKqmRecords.filter(
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

function rejectedRequestBoundary(): RequestBoundary {
  return {
    requestId: "keqing-lunar-c0-r5-four-star-team-equipment-enumeration-v1",
    teamRecordId: TEAM_RECORD_ID,
    exactRoster: [],
    allSourceTeamEquipmentNull: false,
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

export function requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
  report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
): void {
  const completeReportDigestMatches =
    sha256Text(stableJson(report)) === EXPECTED_AUTHENTICATED_REPORT_SHA256;
  const semanticClosure =
    report.validationStatus === "authenticated-enumeration-only" &&
    report.issues.length === 0 &&
    report.semanticScope.authentication === "accepted" &&
    report.semanticScope.expectedManifestSha256 ===
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.manifestSha256 &&
    report.semanticScope.expectedScopeProjectionSha256 ===
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.scopeProjectionSha256 &&
    report.semanticScope.acceptedAudit?.scopeId ===
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.scopeId &&
    report.semanticScope.acceptedAudit.manifestSha256 ===
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.manifestSha256 &&
    report.semanticScope.acceptedAudit.scopeProjectionSha256 ===
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.scopeProjectionSha256 &&
    report.semanticScope.acceptedAudit.dependencies.length === 16 &&
    report.semanticScope.acceptedAudit.paritySummary.parityCount === 14 &&
    report.semanticScope.acceptedAudit.paritySummary.exactParityCount === 14 &&
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

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
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
