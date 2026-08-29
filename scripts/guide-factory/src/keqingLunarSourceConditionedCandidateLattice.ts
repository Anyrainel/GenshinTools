import { sha256Text, stableJson } from "./io";
import {
  type KeqingLunarConditionResolution,
  type KeqingLunarEquipmentEvidenceClaim,
  type KeqingLunarEquipmentEvidenceValidationReport,
} from "./keqingLunarEquipmentEvidenceValidation";
import {
  KEQING_INEFFA_EXTERNAL_TEAM_ID,
  type KeqingIneffaFormulaDraftReport,
} from "./keqingIneffaFormulaDraft";
import { KEQING_ROLE_PAIR_TARGET_TEAM_IDS } from "./keqingSourceScopedRolePairSample";

type EquipmentClaim = KeqingLunarEquipmentEvidenceClaim & {
  sourceClaim: Extract<
    KeqingLunarEquipmentEvidenceClaim["sourceClaim"],
    { kind: "weapon" | "artifact" }
  >;
};

type StatClaim = KeqingLunarEquipmentEvidenceClaim & {
  sourceClaim: Extract<
    KeqingLunarEquipmentEvidenceClaim["sourceClaim"],
    { kind: "main-stat" | "substat" }
  >;
};

type SearchCoverage = KeqingLunarEquipmentEvidenceClaim["searchCoverage"];

export type KeqingLunarMemberRepresentability =
  | "initially-representable"
  | "conditionally-representable"
  | "not-representable";

export type KeqingLunarGroupRepresentability =
  | "all-members-initially-representable"
  | "all-members-conditionally-representable"
  | "partially-representable"
  | "no-members-representable";

export interface KeqingLunarCandidateLatticeIssue {
  code: string;
  path: string;
  message: string;
}

export interface KeqingLunarCandidateEquipmentGroup {
  groupId: string;
  repositoryRecordId: string;
  sourceRecordId: string;
  recommendationId: string;
  recommendationScope: string;
  roles: string[];
  kind: "weapon" | "artifact";
  recommendationOrdering: string | null;
  groupIndex: number;
  grouping: "single" | "alternatives" | "tied";
  classification:
    | "default"
    | "recommended"
    | "alternative"
    | "conditional"
    | "available-only";
  sourceConditions: string[];
  members: Array<{
    claimId: string;
    sourceClaim: EquipmentClaim["sourceClaim"];
    sourceRefinement: null;
    searchCoverage: SearchCoverage;
    representability: KeqingLunarMemberRepresentability;
  }>;
}

export interface KeqingLunarCandidateStatClaim {
  claimId: string;
  repositoryRecordId: string;
  sourceRecordId: string;
  recommendationId: string;
  recommendationScope: string;
  roles: string[];
  sourceClaim: StatClaim["sourceClaim"];
  sourceConditions: string[];
}

type ResolutionSummary = {
  matched: number;
  notMatched: number;
  unresolved: number;
};

type ResolutionRepresentabilitySummary = {
  matched: { representable: number; unrepresentable: number };
  notMatched: { representable: number; unrepresentable: number };
  unresolved: { representable: number; unrepresentable: number };
};

export interface KeqingLunarSourceConditionedCandidateLatticeReport {
  schemaVersion: 1;
  classification: "keqing-lunar-source-conditioned-candidate-lattice";
  comparisonStatus: "comparable" | "not-comparable";
  supportsGuideClaims: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsConditionApplicabilityClaims: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsEnergyRecoveryClaims: false;
  crossProductConstructed: false;
  assembledBuildCount: 0;
  candidateGenerationExecuted: false;
  technicalComparisonExecuted: false;
  energyRecoveryInputsUsed: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  inputBoundary: {
    evidenceReportSha256: string;
    evidenceValidationStatus: string;
    evidenceClaimCount: number;
    exactTeamIds: string[];
    formulaDraftSha256: string;
    formulaFixtureId: string;
    formulaSourceTeamRecordId: string;
  };
  equipmentGroups: KeqingLunarCandidateEquipmentGroup[];
  statClaims: KeqingLunarCandidateStatClaim[];
  lattice: {
    combinationPolicy: "source-groups-only-no-cross-product";
    equipmentGroupCount: number;
    statClaimCount: number;
    teamCount: number;
    equipmentGroupCellCount: number;
    statClaimCellCount: number;
    underlyingClaimTeamRowCount: number;
    teams: Array<{
      teamRecordId: string;
      characterIds: string[];
      equipmentGroupCells: Array<{
        groupId: string;
        conditionResolution: KeqingLunarConditionResolution;
        searchRepresentability: KeqingLunarGroupRepresentability;
        members: Array<{
          claimId: string;
          conditionResolution: KeqingLunarConditionResolution;
          searchRepresentability: KeqingLunarMemberRepresentability;
        }>;
      }>;
      statClaimCells: Array<{
        claimId: string;
        conditionResolution: KeqingLunarConditionResolution;
      }>;
    }>;
    summary: {
      allClaimTeamRows: ResolutionSummary;
      equipmentClaimTeamRows: ResolutionRepresentabilitySummary;
      statClaimTeamRows: ResolutionSummary;
      equipmentGroupCells: ResolutionRepresentabilitySummary;
    };
  } | null;
  technicalComparisonBoundary:
    | {
        status: "withheld-upstream-not-comparable";
        teamFixtures: [];
      }
    | {
        status: "availability-only-no-comparison-authorized";
        exactFixtureCount: 1;
        authorizedSourceConditionedComparisonCount: 0;
        teamFixtures: Array<
          | {
              teamRecordId: string;
              status: "no-exact-formula-fixture";
            }
          | {
              teamRecordId: string;
              status: "fixture-available-but-not-authorized";
              fixtureId: "keqing-ineffa-source-rotation-comparison-v1";
              reviewStatus: "unreviewed";
              damageReplayReady: false;
              blockerCodes: string[];
              keqingAnchor: {
                weaponClaimId: string;
                weaponId: "mistsplitter_reforged";
                weaponConditionResolution: KeqingLunarConditionResolution;
                sourceRefinement: null;
                fixtureRefinement: 1;
                fixtureRefinementIsSourceFact: false;
                artifactClaimId: string;
                artifact: { type: "4pc"; setId: "thundering_fury" };
                artifactConditionResolution: KeqingLunarConditionResolution;
                completeSourceConditionedEquipmentAnchor: false;
              };
            }
        >;
      }
  issues: KeqingLunarCandidateLatticeIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
}

export const KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS = [
  "scripts/guide-factory/src/keqingLunarSourceConditionedCandidateLattice.ts",
  "scripts/guide-factory/src/keqingLunarEquipmentEvidenceValidation.ts",
  "scripts/guide-factory/src/keqingIneffaFormulaDraft.ts",
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json",
  "scripts/guide-factory/reports/keqing-ineffa-formula-plan-draft.json",
] as const;

const EXPECTED_EVIDENCE_CLAIM_COUNT = 42;
const EXPECTED_EQUIPMENT_CLAIM_COUNT = 30;
const EXPECTED_STAT_CLAIM_COUNT = 12;
const EXPECTED_EQUIPMENT_GROUP_COUNT = 19;
const EXPECTED_WEAPON_GROUP_COUNT = 13;
const EXPECTED_ARTIFACT_GROUP_COUNT = 6;
const EXPECTED_TEAM_COUNT = 4;
const EXPECTED_EQUIPMENT_GROUP_STRUCTURE_SHA256 =
  "5aa5e43b2b84f4036c1c35aceb4c69437188a478c811f837c213e06e6ef8290c";
const EXPECTED_STAT_CLAIM_STRUCTURE_SHA256 =
  "a1bcc8a52be5ce3274883007918f4d7ddd2144d27d7d3ba10f467ded29399d77";
const EXPECTED_CLAIM_RESOLUTION_MATRIX_SHA256 =
  "b997d89ab1c78efaf0ec8fc571ddb019944bdd8c3256f2fb48669f9c326e814d";
const EXPECTED_PUBLISHED_TEAM_BOUNDARY_SHA256 =
  "3c82833b54081167e34036b7127072c1731cd168b002ef04afd589b208ea0051";
const EXPECTED_SEARCH_COVERAGE_MATRIX_SHA256 =
  "cfad69d93d1b9f248c80e67b7e2815ddb7ea9fab302d7b6ff79234275dc27f93";
const GENERAL_MISTSPLITTER_CLAIM_ID =
  "kqm:character-guide:keqing-lunar-charged-general-mistsplitter-luna-i:weapon:0:0";
const THUNDERING_FURY_CLAIM_ID =
  "kqm:character-guide:keqing-lunar-charged-top-contributor-artifact-options-luna-i:artifact:0:0";
const EXPECTED_FORMULA_BLOCKER_CODES = [
  "translation-unreviewed",
  "partial-token-mapping",
  "unresolved-formula-mapping",
  "unresolved-formula-mapping",
  "unresolved-formula-mapping",
  "unresolved-formula-mapping",
  "unresolved-formula-mapping",
  "unresolved-source-token",
] as const;
const EXPECTED_FORMULA_ASSUMPTIONS = [
  {
    characterId: "keqing",
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    selectedArtifact: { type: "4pc", setId: "thundering_fury" },
    selectedWeaponId: "mistsplitter_reforged",
    talentLevels: { auto: 10, skill: 10, burst: 10 },
  },
  {
    characterId: "ineffa",
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    selectedArtifact: {
      type: "4pc",
      setId: "aubade_of_morningstar_and_moon",
    },
    selectedWeaponId: "fractured_halo",
    talentLevels: { auto: 10, skill: 10, burst: 10 },
  },
  {
    characterId: "furina",
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    selectedArtifact: { type: "4pc", setId: "golden_troupe" },
    selectedWeaponId: "splendor_of_tranquil_waters",
    talentLevels: { auto: 10, skill: 10, burst: 10 },
  },
  {
    characterId: "xilonen",
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    selectedArtifact: {
      type: "4pc",
      setId: "scroll_of_the_hero_of_cinder_city",
    },
    selectedWeaponId: "peak_patrol_song",
    talentLevels: { auto: 10, skill: 10, burst: 10 },
  },
] as const;
const EXPECTED_FORMULA_EQUIPMENT_LINEAGE = [
  {
    characterId: "keqing",
    characterGuideId: "genshintools-presets:character-guide:keqing",
    weaponId: "mistsplitter_reforged",
    buildSourceRecordId: "1WswsAu",
    artifact: { type: "4pc", setId: "thundering_fury" },
  },
  {
    characterId: "ineffa",
    characterGuideId: "genshintools-presets:character-guide:ineffa",
    weaponId: "fractured_halo",
    buildSourceRecordId: "FeFiQU8",
    artifact: { type: "4pc", setId: "aubade_of_morningstar_and_moon" },
  },
  {
    characterId: "furina",
    characterGuideId: "genshintools-presets:character-guide:furina",
    weaponId: "splendor_of_tranquil_waters",
    buildSourceRecordId: "BQAI0BO",
    artifact: { type: "4pc", setId: "golden_troupe" },
  },
  {
    characterId: "xilonen",
    characterGuideId: "genshintools-presets:character-guide:xilonen",
    weaponId: "peak_patrol_song",
    buildSourceRecordId: "Dbt0Wkm",
    artifact: {
      type: "4pc",
      setId: "scroll_of_the_hero_of_cinder_city",
    },
  },
] as const;

/**
 * Project already validated source claims onto exact teams without creating a
 * weapon x artifact x stat product. This is a classification lattice only.
 */
export function buildKeqingLunarSourceConditionedCandidateLatticeReport(
  evidence: KeqingLunarEquipmentEvidenceValidationReport,
  formulaDraft: KeqingIneffaFormulaDraftReport,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): KeqingLunarSourceConditionedCandidateLatticeReport {
  const issues: KeqingLunarCandidateLatticeIssue[] = [];
  const claims = evidence.claims;
  const equipmentClaims = claims.filter(isEquipmentClaim);
  const statClaims = claims.filter(isStatClaim);
  const rawGroups = buildEquipmentGroups(equipmentClaims, issues);
  const rawStatClaims = buildStatClaims(statClaims);

  validateEvidenceBoundary(evidence, equipmentClaims, statClaims, rawGroups, issues);
  validateClaimResolutionMatrix(evidence, claims, issues);
  validateGroupResolutionMatrix(rawGroups, claims, evidence, issues);
  validateSearchCoverage(equipmentClaims, statClaims, issues);
  validateTechnicalClaimAnchors(evidence, issues);
  validateFormulaBoundary(formulaDraft, issues);

  const inputBoundary = {
    evidenceReportSha256: sha256Text(stableJson(evidence)),
    evidenceValidationStatus: evidence.validationStatus,
    evidenceClaimCount: claims.length,
    exactTeamIds: [...evidence.publishedTeamBoundary.targetTeamIds],
    formulaDraftSha256: sha256Text(stableJson(formulaDraft)),
    formulaFixtureId: formulaDraft.fixtureId,
    formulaSourceTeamRecordId: formulaDraft.sourceTeamRecordId,
  };
  const common = {
    schemaVersion: 1 as const,
    classification:
      "keqing-lunar-source-conditioned-candidate-lattice" as const,
    supportsGuideClaims: false as const,
    supportsEquipmentRecommendations: false as const,
    supportsStatRecommendations: false as const,
    supportsConditionApplicabilityClaims: false as const,
    supportsRankClaims: false as const,
    supportsDamageClaims: false as const,
    supportsEnergyRecoveryClaims: false as const,
    crossProductConstructed: false as const,
    assembledBuildCount: 0 as const,
    candidateGenerationExecuted: false as const,
    technicalComparisonExecuted: false as const,
    energyRecoveryInputsUsed: false as const,
    generatedFrom: generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    inputBoundary,
    cautions: [
      "A matched cell means only that exact roster and declared-reaction facts satisfy the source condition map; it is not computed equipment applicability.",
      "Source groups remain separate and no weapon, artifact, or stat axes are multiplied into assembled builds.",
      "Unresolved and unrepresentable cells are retained as holdouts rather than removed from the candidate boundary.",
      "Analyzer candidate refinements remain search-policy metadata; every source weapon refinement is still unspecified.",
      "The exact Xilonen-team formula fixture is unreviewed and replay-blocked, so its presence authorizes no numerical comparison.",
      "No Energy Recharge input, constraint, target, or interpretation participates in this report.",
    ],
    prohibitedInterpretations: [
      "assembled-build-candidate",
      "equipment-recommendation",
      "stat-recommendation",
      "source-rank-validation",
      "condition-applicability-validation",
      "damage-comparison",
      "optimizer-result",
      "energy-recharge-guidance",
    ],
  };

  if (issues.length > 0) {
    return {
      ...common,
      comparisonStatus: "not-comparable",
      equipmentGroups: [],
      statClaims: [],
      lattice: null,
      technicalComparisonBoundary: {
        status: "withheld-upstream-not-comparable",
        teamFixtures: [],
      },
      issues: sortIssues(issues),
    };
  }

  const lattice = buildLattice(evidence, rawGroups, rawStatClaims);
  return {
    ...common,
    comparisonStatus: "comparable",
    equipmentGroups: rawGroups,
    statClaims: rawStatClaims,
    lattice,
    technicalComparisonBoundary: buildTechnicalComparisonBoundary(
      evidence,
      formulaDraft,
    ),
    issues: [],
  };
}

function validateEvidenceBoundary(
  evidence: KeqingLunarEquipmentEvidenceValidationReport,
  equipmentClaims: readonly EquipmentClaim[],
  statClaims: readonly StatClaim[],
  groups: readonly KeqingLunarCandidateEquipmentGroup[],
  issues: KeqingLunarCandidateLatticeIssue[],
): void {
  expectInvariant(
    evidence.validationStatus === "comparable",
    issues,
    "upstream.evidence_not_comparable",
    "inputBoundary.evidenceValidationStatus",
    "The equipment evidence report must be comparable before a lattice is exposed.",
  );
  expectInvariant(
    evidence.sourceConditionBoundary.allSourceConditionsMappedExactly,
    issues,
    "upstream.unmapped_source_condition",
    "inputBoundary.sourceConditions",
    "Every source condition must retain an exact wrapper-authored mapping.",
  );
  expectInvariant(
    !evidence.searchCoverageBoundary.sourceRefinementsInferred,
    issues,
    "upstream.source_refinement_inferred",
    "inputBoundary.searchCoverage",
    "Source refinements must remain unspecified.",
  );
  expectCount(claimCountUnique(evidence.claims), EXPECTED_EVIDENCE_CLAIM_COUNT, issues, "claims.unique", "unique source claims");
  expectCount(equipmentClaims.length, EXPECTED_EQUIPMENT_CLAIM_COUNT, issues, "claims.equipment", "equipment claims");
  expectCount(statClaims.length, EXPECTED_STAT_CLAIM_COUNT, issues, "claims.stats", "stat claims");
  expectCount(groups.length, EXPECTED_EQUIPMENT_GROUP_COUNT, issues, "groups.all", "equipment groups");
  expectCount(groups.filter(({ kind }) => kind === "weapon").length, EXPECTED_WEAPON_GROUP_COUNT, issues, "groups.weapon", "weapon groups");
  expectCount(groups.filter(({ kind }) => kind === "artifact").length, EXPECTED_ARTIFACT_GROUP_COUNT, issues, "groups.artifact", "artifact groups");
  expectInvariant(
    sha256Text(stableJson(equipmentGroupStructure(groups))) ===
      EXPECTED_EQUIPMENT_GROUP_STRUCTURE_SHA256,
    issues,
    "groups.exact_structure_changed",
    "equipmentGroups",
    "The exact equipment group inventory, ordering semantics, conditions, or member claims changed.",
  );
  expectInvariant(
    sha256Text(stableJson(statClaimStructure(statClaims))) ===
      EXPECTED_STAT_CLAIM_STRUCTURE_SHA256,
    issues,
    "stats.exact_structure_changed",
    "statClaims",
    "The exact stat-claim inventory, priorities, conditions, or claim values changed.",
  );
  expectInvariant(
    sameStrings(
      evidence.publishedTeamBoundary.targetTeamIds,
      KEQING_ROLE_PAIR_TARGET_TEAM_IDS,
    ),
    issues,
    "upstream.team_boundary_changed",
    "inputBoundary.exactTeamIds",
    "The exact four-team boundary changed.",
  );
  expectInvariant(
    sha256Text(stableJson(evidence.publishedTeamBoundary)) ===
      EXPECTED_PUBLISHED_TEAM_BOUNDARY_SHA256,
    issues,
    "upstream.exact_team_boundary_changed",
    "inputBoundary.publishedTeamBoundary",
    "The exact target order, rosters, declared facts, or boundary safety flags changed.",
  );
  expectCount(
    evidence.publishedTeamBoundary.targets.length,
    EXPECTED_TEAM_COUNT,
    issues,
    "teams.targets",
    "exact team targets",
  );
}

function validateClaimResolutionMatrix(
  evidence: KeqingLunarEquipmentEvidenceValidationReport,
  claims: readonly KeqingLunarEquipmentEvidenceClaim[],
  issues: KeqingLunarCandidateLatticeIssue[],
): void {
  const targetIds = evidence.publishedTeamBoundary.targetTeamIds;
  expectInvariant(
    sha256Text(
      stableJson(
        claims.map(({ claimId, teamResolutions }) => ({
          claimId,
          teamResolutions,
        })),
      ),
    ) === EXPECTED_CLAIM_RESOLUTION_MATRIX_SHA256,
    issues,
    "claim.exact_resolution_matrix_changed",
    "claims.teamResolutions",
    "The exact claim/team resolution and condition-acknowledgement matrix changed.",
  );
  for (const claim of claims) {
    const observedIds = claim.teamResolutions.map(({ teamRecordId }) => teamRecordId);
    if (!sameStrings(observedIds, targetIds)) {
      issues.push({
        code: "claim.team_resolution_boundary_mismatch",
        path: `claims.${claim.claimId}.teamResolutions`,
        message:
          "Each claim must contain exactly one resolution for every exact target team in target order.",
      });
    }
    if (!claim.allSourceConditionsMappedExactly) {
      issues.push({
        code: "claim.unmapped_source_condition",
        path: `claims.${claim.claimId}.sourceConditions`,
        message: "A claim contains an unmapped source condition.",
      });
    }
  }
}

function validateGroupResolutionMatrix(
  groups: readonly KeqingLunarCandidateEquipmentGroup[],
  claims: readonly KeqingLunarEquipmentEvidenceClaim[],
  evidence: KeqingLunarEquipmentEvidenceValidationReport,
  issues: KeqingLunarCandidateLatticeIssue[],
): void {
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
  for (const group of groups) {
    for (const teamRecordId of evidence.publishedTeamBoundary.targetTeamIds) {
      const resolutions = group.members.flatMap(({ claimId }) => {
        const claim = claimById.get(claimId);
        if (!claim) return [];
        return claim.teamResolutions
          .filter((resolution) => resolution.teamRecordId === teamRecordId)
          .map(({ resolution }) => resolution);
      });
      if (
        resolutions.length !== group.members.length ||
        new Set(resolutions).size !== 1
      ) {
        issues.push({
          code: "group.inconsistent_member_resolution",
          path: `equipmentGroups.${group.groupId}.teams.${teamRecordId}`,
          message:
            "All members of one source group must share one condition resolution for an exact team.",
        });
      }
    }
  }
}

function validateSearchCoverage(
  equipmentClaims: readonly EquipmentClaim[],
  statClaims: readonly StatClaim[],
  issues: KeqingLunarCandidateLatticeIssue[],
): void {
  expectInvariant(
    sha256Text(
      stableJson(
        [...equipmentClaims, ...statClaims]
          .map(({ claimId, searchCoverage }) => ({
            claimId,
            searchCoverage,
          }))
          .sort((left, right) => compareText(left.claimId, right.claimId)),
      ),
    ) === EXPECTED_SEARCH_COVERAGE_MATRIX_SHA256,
    issues,
    "claim.exact_search_coverage_matrix_changed",
    "claims.searchCoverage",
    "The exact claim-to-search-observation identity or coverage facts changed.",
  );
  for (const claim of equipmentClaims) {
    if (
      claim.sourceClaim.kind === "weapon" &&
      claim.searchCoverage.kind !== "weapon-search-coverage"
    ) {
      issues.push({
        code: "claim.weapon_coverage_kind_mismatch",
        path: `claims.${claim.claimId}.searchCoverage`,
        message: "A weapon claim must carry one weapon search-coverage reference.",
      });
      continue;
    }
    if (
      claim.sourceClaim.kind === "artifact" &&
      claim.searchCoverage.kind !== "artifact-search-coverage"
    ) {
      issues.push({
        code: "claim.artifact_coverage_kind_mismatch",
        path: `claims.${claim.claimId}.searchCoverage`,
        message: "An artifact claim must carry one artifact search-coverage reference.",
      });
      continue;
    }
    if (
      claim.searchCoverage.kind === "weapon-search-coverage" &&
      claim.searchCoverage.refinementCoverageOutcome !== "unspecified"
    ) {
      issues.push({
        code: "claim.source_refinement_inferred",
        path: `claims.${claim.claimId}.searchCoverage.refinementCoverageOutcome`,
        message:
          "Analyzer candidate refinements must not be converted into a source refinement.",
      });
    }
    if (
      claim.searchCoverage.kind === "weapon-search-coverage" &&
      (claim.searchCoverage.weaponIdDomainOutcome !==
        "in-released-candidate-domain" ||
        claim.searchCoverage.nativeTypeCompatibilityOutcome !== "compatible")
    ) {
      issues.push({
        code: "claim.weapon_domain_or_type_mismatch",
        path: `claims.${claim.claimId}.searchCoverage`,
        message:
        "A source weapon lattice member must remain in the released domain and native-type compatible.",
      });
    }
    if (
      claim.searchCoverage.kind === "weapon-search-coverage" &&
      (claim.searchCoverage.candidateRefinements.length === 0 ||
        new Set(claim.searchCoverage.candidateRefinements).size !==
          claim.searchCoverage.candidateRefinements.length ||
        claim.searchCoverage.candidateRefinements.some(
          (refinement) =>
            !Number.isInteger(refinement) || refinement < 1 || refinement > 5,
        ))
    ) {
      issues.push({
        code: "claim.weapon_coverage_domain_inconsistent",
        path: `claims.${claim.claimId}.searchCoverage.candidateRefinements`,
        message:
          "An in-domain weapon observation must retain a non-empty, unique, legal refinement domain.",
      });
    }
  }
  for (const claim of statClaims) {
    if (claim.searchCoverage.kind !== "not-an-equipment-search-candidate") {
      issues.push({
        code: "claim.stat_coverage_kind_mismatch",
        path: `claims.${claim.claimId}.searchCoverage`,
        message: "A stat claim must remain outside the equipment search domain.",
      });
    }
  }
}

function validateTechnicalClaimAnchors(
  evidence: KeqingLunarEquipmentEvidenceValidationReport,
  issues: KeqingLunarCandidateLatticeIssue[],
): void {
  const weaponMatches = evidence.claims.filter(
    ({ claimId }) => claimId === GENERAL_MISTSPLITTER_CLAIM_ID,
  );
  const artifactMatches = evidence.claims.filter(
    ({ claimId }) => claimId === THUNDERING_FURY_CLAIM_ID,
  );
  expectInvariant(
    weaponMatches.length === 1 && artifactMatches.length === 1,
    issues,
    "technical.source_anchor_missing_or_duplicated",
    "technicalComparisonBoundary.keqingAnchor",
    "The exact Mistsplitter and Thundering Fury source claims must each occur once.",
  );
  if (weaponMatches.length !== 1 || artifactMatches.length !== 1) return;
  const weapon = weaponMatches[0];
  const artifact = artifactMatches[0];
  const weaponResolution = weapon.teamResolutions.find(
    ({ teamRecordId }) => teamRecordId === KEQING_INEFFA_EXTERNAL_TEAM_ID,
  );
  const artifactResolution = artifact.teamResolutions.find(
    ({ teamRecordId }) => teamRecordId === KEQING_INEFFA_EXTERNAL_TEAM_ID,
  );
  expectInvariant(
    weapon.sourceClaim.kind === "weapon" &&
      weapon.sourceClaim.weaponId === "mistsplitter_reforged" &&
      weaponResolution?.resolution === "matched-by-exact-team-facts" &&
      weapon.searchCoverage.kind === "weapon-search-coverage" &&
      weapon.searchCoverage.refinementCoverageOutcome === "unspecified",
    issues,
    "technical.weapon_anchor_changed",
    "technicalComparisonBoundary.keqingAnchor.weapon",
    "The general Mistsplitter claim must match the exact fixture roster while retaining unspecified source refinement.",
  );
  expectInvariant(
    artifact.sourceClaim.kind === "artifact" &&
      artifact.sourceClaim.artifact.type === "4pc" &&
      artifact.sourceClaim.artifact.setId === "thundering_fury" &&
      artifactResolution?.resolution ===
        "withheld-unresolved-source-condition",
    issues,
    "technical.artifact_anchor_changed",
    "technicalComparisonBoundary.keqingAnchor.artifact",
    "The fixture's Thundering Fury source claim must remain condition-withheld for the exact team.",
  );
}

function validateFormulaBoundary(
  formulaDraft: KeqingIneffaFormulaDraftReport,
  issues: KeqingLunarCandidateLatticeIssue[],
): void {
  expectInvariant(
    formulaDraft.fixtureId ===
      "keqing-ineffa-source-rotation-comparison-v1",
    issues,
    "formula.fixture_id_changed",
    "technicalComparisonBoundary.fixtureId",
    "The expected exact formula fixture ID changed.",
  );
  expectInvariant(
    formulaDraft.sourceTeamRecordId === KEQING_INEFFA_EXTERNAL_TEAM_ID,
    issues,
    "formula.wrong_team",
    "technicalComparisonBoundary.sourceTeamRecordId",
    "The formula fixture must target the exact Keqing/Ineffa/Furina/Xilonen team.",
  );
  expectInvariant(
    formulaDraft.sourceRotation.recordId === KEQING_INEFFA_EXTERNAL_TEAM_ID &&
      formulaDraft.equipmentFixture.sourceTeamRecordId ===
        KEQING_INEFFA_EXTERNAL_TEAM_ID &&
      formulaDraft.damageReplayReadiness.sourceTeamRecordId ===
        KEQING_INEFFA_EXTERNAL_TEAM_ID,
    issues,
    "formula.nested_team_lineage_mismatch",
    "technicalComparisonBoundary.teamLineage",
    "Every nested formula, rotation, equipment, and readiness lineage must target the same exact team.",
  );
  expectInvariant(
    formulaDraft.authoredTranslation.reviewStatus === "unreviewed" &&
      !formulaDraft.damageReplayReadiness.readyForDamageReplay,
    issues,
    "formula.readiness_boundary_changed",
    "technicalComparisonBoundary.readiness",
      "This checkpoint expects the exact formula fixture to remain unreviewed and replay-blocked.",
  );
  expectInvariant(
    formulaDraft.sourceRotation.rotationId === "sample-rotation" &&
      sameStrings(
        formulaDraft.damageReplayReadiness.blockers.map(({ code }) => code),
        EXPECTED_FORMULA_BLOCKER_CODES,
      ),
    issues,
    "formula.blocker_ledger_changed",
    "technicalComparisonBoundary.blockers",
    "The exact source rotation or eight-blocker readiness ledger changed.",
  );
  const keqingEvidence = formulaDraft.equipmentFixture.evidence.filter(
    ({ characterId }) => characterId === "keqing",
  );
  const keqingAssumptions = formulaDraft.assumptions.characters.filter(
    ({ characterId }) => characterId === "keqing",
  );
  expectInvariant(
    stableJson(formulaDraft.assumptions.characters) ===
      stableJson(EXPECTED_FORMULA_ASSUMPTIONS) &&
      stableJson(
        formulaDraft.equipmentFixture.evidence.map((evidence) => ({
          characterId: evidence.characterId,
          characterGuideId: evidence.characterGuideId,
          weaponId: evidence.weaponId,
          buildSourceRecordId: evidence.buildSourceRecordId,
          artifact: evidence.build.artifact,
        })),
      ) === stableJson(EXPECTED_FORMULA_EQUIPMENT_LINEAGE),
    issues,
    "formula.roster_or_equipment_lineage_changed",
    "technicalComparisonBoundary.equipmentLineage",
    "The exact four-character formula assumptions and repository equipment lineage changed.",
  );
  expectInvariant(
    keqingEvidence.length === 1 &&
      keqingEvidence[0].weaponId === "mistsplitter_reforged" &&
      keqingEvidence[0].build.artifact.type === "4pc" &&
      keqingEvidence[0].build.artifact.setId === "thundering_fury" &&
      keqingAssumptions.length === 1 &&
      keqingAssumptions[0].refinement === 1,
    issues,
    "formula.keqing_anchor_changed",
    "technicalComparisonBoundary.keqingAnchor",
    "The technical fixture no longer has the expected R1 Mistsplitter and 4pc Thundering Fury Keqing anchor.",
  );
}

function equipmentGroupStructure(
  groups: readonly KeqingLunarCandidateEquipmentGroup[],
): unknown[] {
  return groups.map((group) => ({
    groupId: group.groupId,
    repositoryRecordId: group.repositoryRecordId,
    sourceRecordId: group.sourceRecordId,
    recommendationId: group.recommendationId,
    recommendationScope: group.recommendationScope,
    roles: group.roles,
    kind: group.kind,
    recommendationOrdering: group.recommendationOrdering,
    groupIndex: group.groupIndex,
    grouping: group.grouping,
    classification: group.classification,
    sourceConditions: group.sourceConditions,
    members: group.members.map(({ claimId, sourceClaim }) => ({
      claimId,
      sourceClaim,
    })),
  }));
}

function statClaimStructure(
  claims: readonly KeqingLunarCandidateStatClaim[],
): unknown[] {
  return claims
    .map((claim) => ({
      claimId: claim.claimId,
      repositoryRecordId: claim.repositoryRecordId,
      sourceRecordId: claim.sourceRecordId,
      recommendationId: claim.recommendationId,
      recommendationScope: claim.recommendationScope,
      roles: claim.roles,
      sourceClaim: claim.sourceClaim,
      sourceConditions: claim.sourceConditions,
    }))
    .sort((left, right) => compareText(left.claimId, right.claimId));
}

function buildEquipmentGroups(
  claims: readonly EquipmentClaim[],
  issues: KeqingLunarCandidateLatticeIssue[],
): KeqingLunarCandidateEquipmentGroup[] {
  const grouped = new Map<string, EquipmentClaim[]>();
  for (const claim of claims) {
    const key = `${claim.repositoryRecordId}:${claim.sourceClaim.kind}:${claim.sourceClaim.groupIndex}`;
    const values = grouped.get(key) ?? [];
    values.push(claim);
    grouped.set(key, values);
  }
  const result: KeqingLunarCandidateEquipmentGroup[] = [];
  for (const [groupId, members] of grouped) {
    members.sort((left, right) =>
      equipmentMemberIndex(left) - equipmentMemberIndex(right),
    );
    const first = members[0];
    const consistent = members.every(
      (claim) =>
        claim.repositoryRecordId === first.repositoryRecordId &&
        claim.sourceRecordId === first.sourceRecordId &&
        claim.recommendationId === first.recommendationId &&
        claim.recommendationScope === first.recommendationScope &&
        claim.sourceClaim.kind === first.sourceClaim.kind &&
        claim.sourceClaim.recommendationOrdering ===
          first.sourceClaim.recommendationOrdering &&
        claim.sourceClaim.groupIndex === first.sourceClaim.groupIndex &&
        claim.sourceClaim.grouping === first.sourceClaim.grouping &&
        claim.sourceClaim.classification === first.sourceClaim.classification &&
        sameStrings(claim.sourceConditions, first.sourceConditions) &&
        stableJson(claim.roles) === stableJson(first.roles),
    );
    if (!consistent) {
      issues.push({
        code: "group.inconsistent_member_metadata",
        path: `equipmentGroups.${groupId}`,
        message:
          "Members of one source group disagree on ordering, grouping, classification, roles, or conditions.",
      });
    }
    const indices = members.map(equipmentMemberIndex);
    if (new Set(indices).size !== indices.length) {
      issues.push({
        code: "group.duplicate_member_index",
        path: `equipmentGroups.${groupId}.members`,
        message: "A source group contains a duplicate member index.",
      });
    }
    result.push({
      groupId,
      repositoryRecordId: first.repositoryRecordId,
      sourceRecordId: first.sourceRecordId,
      recommendationId: first.recommendationId,
      recommendationScope: first.recommendationScope,
      roles: [...first.roles],
      kind: first.sourceClaim.kind,
      recommendationOrdering:
        first.sourceClaim.recommendationOrdering ?? null,
      groupIndex: first.sourceClaim.groupIndex,
      grouping: first.sourceClaim.grouping,
      classification: first.sourceClaim.classification,
      sourceConditions: [...first.sourceConditions],
      members: members.map((claim) => ({
        claimId: claim.claimId,
        sourceClaim: structuredClone(claim.sourceClaim),
        sourceRefinement: null,
        searchCoverage: structuredClone(claim.searchCoverage),
        representability: memberRepresentability(claim.searchCoverage),
      })),
    });
  }
  return result.sort((left, right) => compareText(left.groupId, right.groupId));
}

function buildStatClaims(
  claims: readonly StatClaim[],
): KeqingLunarCandidateStatClaim[] {
  return claims
    .map((claim) => ({
      claimId: claim.claimId,
      repositoryRecordId: claim.repositoryRecordId,
      sourceRecordId: claim.sourceRecordId,
      recommendationId: claim.recommendationId,
      recommendationScope: claim.recommendationScope,
      roles: [...claim.roles],
      sourceClaim: structuredClone(claim.sourceClaim),
      sourceConditions: [...claim.sourceConditions],
    }))
    .sort((left, right) => compareText(left.claimId, right.claimId));
}

function buildLattice(
  evidence: KeqingLunarEquipmentEvidenceValidationReport,
  groups: readonly KeqingLunarCandidateEquipmentGroup[],
  statClaims: readonly KeqingLunarCandidateStatClaim[],
): NonNullable<
  KeqingLunarSourceConditionedCandidateLatticeReport["lattice"]
> {
  const claimById = new Map(evidence.claims.map((claim) => [claim.claimId, claim]));
  const teams = evidence.publishedTeamBoundary.targets.map((target) => ({
    teamRecordId: target.teamRecordId,
    characterIds: [...target.characterIds],
    equipmentGroupCells: groups.map((group) => {
      const members = group.members.map((member) => {
        const claim = requiredMapValue(claimById, member.claimId);
        return {
          claimId: member.claimId,
          conditionResolution: requiredResolution(
            claim,
            target.teamRecordId,
          ),
          searchRepresentability: member.representability,
        };
      });
      const resolutions = [...new Set(members.map(({ conditionResolution }) => conditionResolution))];
      if (resolutions.length !== 1) {
        throw new Error(
          `Validated group ${group.groupId} has inconsistent member resolutions for ${target.teamRecordId}.`,
        );
      }
      return {
        groupId: group.groupId,
        conditionResolution: resolutions[0],
        searchRepresentability: groupRepresentability(
          members.map(({ searchRepresentability }) => searchRepresentability),
        ),
        members,
      };
    }),
    statClaimCells: statClaims.map(({ claimId }) => ({
      claimId,
      conditionResolution: requiredResolution(
        requiredMapValue(claimById, claimId),
        target.teamRecordId,
      ),
    })),
  }));

  const allClaimTeamRows = emptyResolutionSummary();
  const equipmentClaimTeamRows = emptyResolutionRepresentabilitySummary();
  const statClaimTeamRows = emptyResolutionSummary();
  const equipmentGroupCells = emptyResolutionRepresentabilitySummary();
  for (const team of teams) {
    for (const cell of team.equipmentGroupCells) {
      incrementResolutionRepresentability(
        equipmentGroupCells,
        cell.conditionResolution,
        cell.searchRepresentability !== "no-members-representable",
      );
      for (const member of cell.members) {
        incrementResolution(allClaimTeamRows, member.conditionResolution);
        incrementResolutionRepresentability(
          equipmentClaimTeamRows,
          member.conditionResolution,
          member.searchRepresentability !== "not-representable",
        );
      }
    }
    for (const cell of team.statClaimCells) {
      incrementResolution(allClaimTeamRows, cell.conditionResolution);
      incrementResolution(statClaimTeamRows, cell.conditionResolution);
    }
  }
  return {
    combinationPolicy: "source-groups-only-no-cross-product",
    equipmentGroupCount: groups.length,
    statClaimCount: statClaims.length,
    teamCount: teams.length,
    equipmentGroupCellCount: groups.length * teams.length,
    statClaimCellCount: statClaims.length * teams.length,
    underlyingClaimTeamRowCount: evidence.claims.length * teams.length,
    teams,
    summary: {
      allClaimTeamRows,
      equipmentClaimTeamRows,
      statClaimTeamRows,
      equipmentGroupCells,
    },
  };
}

function buildTechnicalComparisonBoundary(
  evidence: KeqingLunarEquipmentEvidenceValidationReport,
  formulaDraft: KeqingIneffaFormulaDraftReport,
): Extract<
  KeqingLunarSourceConditionedCandidateLatticeReport["technicalComparisonBoundary"],
  { status: "availability-only-no-comparison-authorized" }
> {
  const weaponClaim = requiredClaim(evidence.claims, GENERAL_MISTSPLITTER_CLAIM_ID);
  const artifactClaim = requiredClaim(evidence.claims, THUNDERING_FURY_CLAIM_ID);
  return {
    status: "availability-only-no-comparison-authorized",
    exactFixtureCount: 1,
    authorizedSourceConditionedComparisonCount: 0,
    teamFixtures: evidence.publishedTeamBoundary.targets.map((target) =>
      target.teamRecordId !== KEQING_INEFFA_EXTERNAL_TEAM_ID
        ? {
            teamRecordId: target.teamRecordId,
            status: "no-exact-formula-fixture" as const,
          }
        : {
            teamRecordId: target.teamRecordId,
            status: "fixture-available-but-not-authorized" as const,
            fixtureId: formulaDraft.fixtureId,
            reviewStatus: formulaDraft.authoredTranslation.reviewStatus,
            damageReplayReady: false as const,
            blockerCodes: formulaDraft.damageReplayReadiness.blockers.map(
              ({ code }) => code,
            ),
            keqingAnchor: {
              weaponClaimId: weaponClaim.claimId,
              weaponId: "mistsplitter_reforged" as const,
              weaponConditionResolution: requiredResolution(
                weaponClaim,
                target.teamRecordId,
              ),
              sourceRefinement: null,
              fixtureRefinement: 1 as const,
              fixtureRefinementIsSourceFact: false as const,
              artifactClaimId: artifactClaim.claimId,
              artifact: {
                type: "4pc" as const,
                setId: "thundering_fury" as const,
              },
              artifactConditionResolution: requiredResolution(
                artifactClaim,
                target.teamRecordId,
              ),
              completeSourceConditionedEquipmentAnchor: false as const,
            },
          },
    ),
  };
}

function isEquipmentClaim(
  claim: KeqingLunarEquipmentEvidenceClaim,
): claim is EquipmentClaim {
  return claim.sourceClaim.kind === "weapon" || claim.sourceClaim.kind === "artifact";
}

function isStatClaim(claim: KeqingLunarEquipmentEvidenceClaim): claim is StatClaim {
  return claim.sourceClaim.kind === "main-stat" || claim.sourceClaim.kind === "substat";
}

function equipmentMemberIndex(claim: EquipmentClaim): number {
  return claim.sourceClaim.kind === "weapon"
    ? claim.sourceClaim.weaponIndex
    : claim.sourceClaim.artifactIndex;
}

function memberRepresentability(
  coverage: SearchCoverage,
): KeqingLunarMemberRepresentability {
  if (coverage.kind === "weapon-search-coverage") {
    return coverage.weaponIdDomainOutcome === "in-released-candidate-domain" &&
      coverage.nativeTypeCompatibilityOutcome === "compatible"
      ? "initially-representable"
      : "not-representable";
  }
  if (coverage.kind === "artifact-search-coverage") {
    if (coverage.outcome === "enumerated-initially") {
      return "initially-representable";
    }
    if (coverage.outcome === "conditionally-representable") {
      return "conditionally-representable";
    }
  }
  return "not-representable";
}

function groupRepresentability(
  members: readonly KeqingLunarMemberRepresentability[],
): KeqingLunarGroupRepresentability {
  if (members.every((value) => value === "initially-representable")) {
    return "all-members-initially-representable";
  }
  if (members.every((value) => value === "conditionally-representable")) {
    return "all-members-conditionally-representable";
  }
  if (members.every((value) => value === "not-representable")) {
    return "no-members-representable";
  }
  return "partially-representable";
}

function requiredResolution(
  claim: KeqingLunarEquipmentEvidenceClaim,
  teamRecordId: string,
): KeqingLunarConditionResolution {
  const matches = claim.teamResolutions.filter(
    (resolution) => resolution.teamRecordId === teamRecordId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Validated claim ${claim.claimId} expected one resolution for ${teamRecordId}, found ${matches.length}.`,
    );
  }
  return matches[0].resolution;
}

function requiredClaim(
  claims: readonly KeqingLunarEquipmentEvidenceClaim[],
  claimId: string,
): KeqingLunarEquipmentEvidenceClaim {
  const matches = claims.filter((claim) => claim.claimId === claimId);
  if (matches.length !== 1) {
    throw new Error(`Expected one claim ${claimId}, found ${matches.length}.`);
  }
  return matches[0];
}

function requiredMapValue<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Missing validated map value ${String(key)}.`);
  return value;
}

function claimCountUnique(
  claims: readonly KeqingLunarEquipmentEvidenceClaim[],
): number {
  return new Set(claims.map(({ claimId }) => claimId)).size;
}

function emptyResolutionSummary(): ResolutionSummary {
  return { matched: 0, notMatched: 0, unresolved: 0 };
}

function emptyResolutionRepresentabilitySummary(): ResolutionRepresentabilitySummary {
  return {
    matched: { representable: 0, unrepresentable: 0 },
    notMatched: { representable: 0, unrepresentable: 0 },
    unresolved: { representable: 0, unrepresentable: 0 },
  };
}

function incrementResolution(
  summary: ResolutionSummary,
  resolution: KeqingLunarConditionResolution,
): void {
  summary[resolutionKey(resolution)] += 1;
}

function incrementResolutionRepresentability(
  summary: ResolutionRepresentabilitySummary,
  resolution: KeqingLunarConditionResolution,
  representable: boolean,
): void {
  summary[resolutionKey(resolution)][
    representable ? "representable" : "unrepresentable"
  ] += 1;
}

function resolutionKey(
  resolution: KeqingLunarConditionResolution,
): keyof ResolutionSummary {
  if (resolution === "matched-by-exact-team-facts") return "matched";
  if (resolution === "not-matched-by-exact-team-facts") return "notMatched";
  return "unresolved";
}

function expectCount(
  observed: number,
  expected: number,
  issues: KeqingLunarCandidateLatticeIssue[],
  path: string,
  label: string,
): void {
  expectInvariant(
    observed === expected,
    issues,
    "boundary.count_mismatch",
    path,
    `Expected ${expected} ${label}, found ${observed}.`,
  );
}

function expectInvariant(
  condition: boolean,
  issues: KeqingLunarCandidateLatticeIssue[],
  code: string,
  path: string,
  message: string,
): void {
  if (!condition) issues.push({ code, path, message });
}

function sortIssues(
  issues: readonly KeqingLunarCandidateLatticeIssue[],
): KeqingLunarCandidateLatticeIssue[] {
  return [...issues].sort((left, right) =>
    compareText(
      `${left.path}\u0000${left.code}\u0000${left.message}`,
      `${right.path}\u0000${right.code}\u0000${right.message}`,
    ),
  );
}

function sameStrings(
  observed: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    observed.length === expected.length &&
    observed.every((value, index) => value === expected[index])
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
