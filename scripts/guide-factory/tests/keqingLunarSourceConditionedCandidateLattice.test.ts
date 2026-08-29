import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson, sha256File } from "../src/io";
import type { KeqingIneffaFormulaDraftReport } from "../src/keqingIneffaFormulaDraft";
import type {
  KeqingLunarEquipmentEvidenceClaim,
  KeqingLunarEquipmentEvidenceValidationReport,
} from "../src/keqingLunarEquipmentEvidenceValidation";
import {
  buildKeqingLunarSourceConditionedCandidateLatticeReport,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS,
  type KeqingLunarCandidateEquipmentGroup,
  type KeqingLunarSourceConditionedCandidateLatticeReport,
} from "../src/keqingLunarSourceConditionedCandidateLattice";
import { KEQING_ROLE_PAIR_TARGET_TEAM_IDS } from "../src/keqingSourceScopedRolePairSample";
import {
  KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH,
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
  REPOSITORY_ROOT,
} from "../src/paths";

describe("Keqing Lunar source-conditioned candidate lattice", () => {
  it("replays the durable 19-group lattice without constructing builds or comparisons", async () => {
    const fixture = await loadFixture();
    const evidenceBefore = structuredClone(fixture.evidence);
    const formulaBefore = structuredClone(fixture.formulaDraft);
    const generatedFrom = await hashInputs();
    const durable = await readJson(
      KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
    );

    const report = buildKeqingLunarSourceConditionedCandidateLatticeReport(
      fixture.evidence,
      fixture.formulaDraft,
      generatedFrom,
    );
    const repeated = buildKeqingLunarSourceConditionedCandidateLatticeReport(
      fixture.evidence,
      fixture.formulaDraft,
      generatedFrom,
    );

    expect(repeated).toEqual(report);
    expect(durable).toEqual(report);
    expect(fixture.evidence).toEqual(evidenceBefore);
    expect(fixture.formulaDraft).toEqual(formulaBefore);
    expect(report).toMatchObject({
      comparisonStatus: "comparable",
      supportsGuideClaims: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsConditionApplicabilityClaims: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsEnergyRecoveryClaims: false,
      crossProductConstructed: false,
      assembledBuildCount: 0,
      candidateGenerationExecuted: false,
      technicalComparisonExecuted: false,
      energyRecoveryInputsUsed: false,
      issues: [],
    });
    expect(report.equipmentGroups).toHaveLength(19);
    expect(report.equipmentGroups.filter(({ kind }) => kind === "weapon")).toHaveLength(
      13,
    );
    expect(report.equipmentGroups.filter(({ kind }) => kind === "artifact")).toHaveLength(
      6,
    );
    expect(report.statClaims).toHaveLength(12);
    expect(report.lattice).toMatchObject({
      combinationPolicy: "source-groups-only-no-cross-product",
      equipmentGroupCount: 19,
      statClaimCount: 12,
      teamCount: 4,
      equipmentGroupCellCount: 76,
      statClaimCellCount: 48,
      underlyingClaimTeamRowCount: 168,
      summary: {
        allClaimTeamRows: { matched: 70, notMatched: 8, unresolved: 90 },
        equipmentClaimTeamRows: {
          matched: { representable: 34, unrepresentable: 0 },
          notMatched: { representable: 8, unrepresentable: 0 },
          unresolved: { representable: 62, unrepresentable: 16 },
        },
        statClaimTeamRows: { matched: 36, notMatched: 0, unresolved: 12 },
        equipmentGroupCells: {
          matched: { representable: 18, unrepresentable: 0 },
          notMatched: { representable: 8, unrepresentable: 0 },
          unresolved: { representable: 42, unrepresentable: 8 },
        },
      },
    });
    expect(report.lattice?.teams.map(({ teamRecordId }) => teamRecordId)).toEqual(
      [...KEQING_ROLE_PAIR_TARGET_TEAM_IDS],
    );
    expect(findExactKeys(report, FORBIDDEN_RESULT_KEYS)).toEqual([]);
  });

  it("preserves record-local grouping, contextual duplicates, and unsupported artifacts", async () => {
    const fixture = await loadFixture();
    const report = buildKeqingLunarSourceConditionedCandidateLatticeReport(
      fixture.evidence,
      fixture.formulaDraft,
    );

    const jadeGroups = groupsForSource(
      report,
      "keqing-lunar-charged-traditional-jade-cutter-ranking-luna-i",
    );
    expect(jadeGroups).toHaveLength(2);
    expect(jadeGroups.map(({ recommendationOrdering }) => recommendationOrdering)).toEqual([
      "ranked-groups",
      "ranked-groups",
    ]);
    expect(groupWeaponIds(jadeGroups[0])).toEqual(["primordial_jade_cutter"]);
    expect(groupWeaponIds(jadeGroups[1])).toEqual(["mistsplitter_reforged"]);

    const foliar = onlyGroupForSource(
      report,
      "keqing-lunar-charged-exceptional-em-foliar-tie-luna-i",
    );
    expect(foliar.grouping).toBe("tied");
    expect(groupWeaponIds(foliar)).toEqual([
      "light_of_foliar_incision",
      "mistsplitter_reforged",
    ]);

    const critAlternatives = onlyGroupForSource(
      report,
      "keqing-lunar-charged-other-five-star-crit-options-luna-i",
    );
    expect(critAlternatives).toMatchObject({
      recommendationOrdering: "unranked",
      grouping: "alternatives",
    });
    expect(groupWeaponIds(critAlternatives)).toEqual([
      "absolution",
      "azurelight",
      "haran_geppaku_futsu",
      "uraku_misugiri",
      "splendor_of_tranquil_waters",
    ]);

    const contextualMistsplitterClaims = report.equipmentGroups.flatMap(
      ({ members }) =>
        members.filter(
          ({ sourceClaim }) =>
            sourceClaim.kind === "weapon" &&
            sourceClaim.weaponId === "mistsplitter_reforged",
        ),
    );
    expect(contextualMistsplitterClaims).toHaveLength(3);
    expect(new Set(contextualMistsplitterClaims.map(({ claimId }) => claimId)).size).toBe(
      3,
    );

    const unsupportedArtifacts = report.equipmentGroups.flatMap(({ members }) =>
      members.filter(
        ({ sourceClaim, representability }) =>
          sourceClaim.kind === "artifact" &&
          representability === "not-representable",
      ),
    );
    expect(unsupportedArtifacts).toHaveLength(4);
    expect(
      unsupportedArtifacts.every(
        ({ searchCoverage }) =>
          searchCoverage.kind === "artifact-search-coverage" &&
          searchCoverage.outcome === "not-representable",
      ),
    ).toBe(true);

    const weaponMembers = report.equipmentGroups.flatMap(({ members }) =>
      members.filter(({ sourceClaim }) => sourceClaim.kind === "weapon"),
    );
    expect(weaponMembers).toHaveLength(21);
    expect(
      weaponMembers.every(
        ({ sourceRefinement, searchCoverage }) =>
          sourceRefinement === null &&
          searchCoverage.kind === "weapon-search-coverage" &&
          searchCoverage.refinementCoverageOutcome === "unspecified" &&
          searchCoverage.candidateRefinements.length > 0,
      ),
    ).toBe(true);
  });

  it("attaches the one blocked technical fixture without authorizing a comparison", async () => {
    const fixture = await loadFixture();
    const report = buildKeqingLunarSourceConditionedCandidateLatticeReport(
      fixture.evidence,
      fixture.formulaDraft,
    );
    expect(report.technicalComparisonBoundary).toMatchObject({
      status: "availability-only-no-comparison-authorized",
      exactFixtureCount: 1,
      authorizedSourceConditionedComparisonCount: 0,
    });
    if (
      report.technicalComparisonBoundary.status !==
      "availability-only-no-comparison-authorized"
    ) {
      throw new Error("Expected available technical fixture metadata.");
    }
    expect(
      report.technicalComparisonBoundary.teamFixtures.map(({ status }) => status),
    ).toEqual([
      "no-exact-formula-fixture",
      "no-exact-formula-fixture",
      "fixture-available-but-not-authorized",
      "no-exact-formula-fixture",
    ]);
    const available = report.technicalComparisonBoundary.teamFixtures.find(
      ({ status }) => status === "fixture-available-but-not-authorized",
    );
    expect(available).toMatchObject({
      teamRecordId: KEQING_ROLE_PAIR_TARGET_TEAM_IDS[2],
      fixtureId: "keqing-ineffa-source-rotation-comparison-v1",
      reviewStatus: "unreviewed",
      damageReplayReady: false,
      blockerCodes: [
        "translation-unreviewed",
        "partial-token-mapping",
        "unresolved-formula-mapping",
        "unresolved-formula-mapping",
        "unresolved-formula-mapping",
        "unresolved-formula-mapping",
        "unresolved-formula-mapping",
        "unresolved-source-token",
      ],
      keqingAnchor: {
        weaponId: "mistsplitter_reforged",
        weaponConditionResolution: "matched-by-exact-team-facts",
        sourceRefinement: null,
        fixtureRefinement: 1,
        fixtureRefinementIsSourceFact: false,
        artifact: { type: "4pc", setId: "thundering_fury" },
        artifactConditionResolution: "withheld-unresolved-source-condition",
        completeSourceConditionedEquipmentAnchor: false,
      },
    });
  });

  it("withholds the whole lattice for missing, duplicate, unmapped, or inconsistent evidence", async () => {
    const fixture = await loadFixture();

    const missingResolution = structuredClone(fixture.evidence);
    missingResolution.claims[0].teamResolutions.pop();
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        missingResolution,
        fixture.formulaDraft,
      ),
      "claim.team_resolution_boundary_mismatch",
    );

    const duplicateResolution = structuredClone(fixture.evidence);
    duplicateResolution.claims[0].teamResolutions.push(
      structuredClone(duplicateResolution.claims[0].teamResolutions[0]),
    );
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        duplicateResolution,
        fixture.formulaDraft,
      ),
      "claim.team_resolution_boundary_mismatch",
    );

    const unmapped = structuredClone(fixture.evidence);
    unmapped.claims[0].allSourceConditionsMappedExactly = false;
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        unmapped,
        fixture.formulaDraft,
      ),
      "claim.unmapped_source_condition",
    );

    const inconsistentGroup = structuredClone(fixture.evidence);
    const tiedClaims = inconsistentGroup.claims.filter(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-lunar-charged-exceptional-em-foliar-tie-luna-i",
    );
    tiedClaims[1].sourceConditions.push("Injected condition drift.");
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        inconsistentGroup,
        fixture.formulaDraft,
      ),
      "group.inconsistent_member_metadata",
    );

    const flattenedRanking = structuredClone(fixture.evidence);
    const jadeGroups = flattenedRanking.claims.filter(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-lunar-charged-traditional-jade-cutter-ranking-luna-i",
    );
    for (const claim of jadeGroups) {
      if (
        claim.sourceClaim.kind === "weapon" ||
        claim.sourceClaim.kind === "artifact"
      ) {
        claim.sourceClaim.recommendationOrdering = "unranked";
      }
    }
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        flattenedRanking,
        fixture.formulaDraft,
      ),
      "groups.exact_structure_changed",
    );

    const flattenedTie = structuredClone(fixture.evidence);
    const foliarClaims = flattenedTie.claims.filter(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-lunar-charged-exceptional-em-foliar-tie-luna-i",
    );
    for (const claim of foliarClaims) {
      if (
        claim.sourceClaim.kind === "weapon" ||
        claim.sourceClaim.kind === "artifact"
      ) {
        claim.sourceClaim.grouping = "alternatives";
      }
    }
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        flattenedTie,
        fixture.formulaDraft,
      ),
      "groups.exact_structure_changed",
    );

    const promotedUnresolved = structuredClone(fixture.evidence);
    const unresolvedRow = promotedUnresolved.claims
      .flatMap(({ teamResolutions }) => teamResolutions)
      .find(
        ({ resolution }) =>
          resolution === "withheld-unresolved-source-condition",
      );
    if (!unresolvedRow) throw new Error("Expected one unresolved row.");
    unresolvedRow.resolution = "matched-by-exact-team-facts";
    for (const acknowledgement of unresolvedRow.conditionAcknowledgements) {
      if (
        acknowledgement.resolution === "withheld-unresolved-source-condition"
      ) {
        acknowledgement.resolution = "matched-by-exact-team-facts";
      }
    }
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        promotedUnresolved,
        fixture.formulaDraft,
      ),
      "claim.exact_resolution_matrix_changed",
    );

    const promotedFalse = structuredClone(fixture.evidence);
    const falseRow = promotedFalse.claims
      .flatMap(({ teamResolutions }) => teamResolutions)
      .find(
        ({ resolution }) =>
          resolution === "not-matched-by-exact-team-facts",
      );
    if (!falseRow) throw new Error("Expected one not-matched row.");
    falseRow.resolution = "matched-by-exact-team-facts";
    for (const acknowledgement of falseRow.conditionAcknowledgements) {
      if (acknowledgement.resolution === "not-matched-by-exact-team-facts") {
        acknowledgement.resolution = "matched-by-exact-team-facts";
      }
    }
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        promotedFalse,
        fixture.formulaDraft,
      ),
      "claim.exact_resolution_matrix_changed",
    );

    const leakedRefinementCondition = structuredClone(fixture.evidence);
    const finaleClaim = leakedRefinementCondition.claims.find(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-lunar-charged-r5-finale-healer-luna-i",
    );
    if (!finaleClaim) throw new Error("Expected the Finale source claim.");
    for (const row of finaleClaim.teamResolutions) {
      row.resolution = "matched-by-exact-team-facts";
      for (const acknowledgement of row.conditionAcknowledgements) {
        acknowledgement.resolution = "matched-by-exact-team-facts";
      }
    }
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        leakedRefinementCondition,
        fixture.formulaDraft,
      ),
      "claim.exact_resolution_matrix_changed",
    );

    const changedTeamBoundary = structuredClone(fixture.evidence);
    changedTeamBoundary.publishedTeamBoundary.allTargetsMatchExpectation = false;
    changedTeamBoundary.publishedTeamBoundary.targets[0].characterIds = [
      "keqing",
      "ineffa",
      "furina",
      "jean",
    ];
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        changedTeamBoundary,
        fixture.formulaDraft,
      ),
      "upstream.exact_team_boundary_changed",
    );
  });

  it("withholds coverage/refinement drift and a formula fixture for the wrong team", async () => {
    const fixture = await loadFixture();

    const wrongCoverage = structuredClone(fixture.evidence);
    const weapon = requiredWeaponClaim(wrongCoverage.claims);
    weapon.searchCoverage = {
      kind: "not-an-equipment-search-candidate",
    };
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        wrongCoverage,
        fixture.formulaDraft,
      ),
      "claim.weapon_coverage_kind_mismatch",
    );

    const inferredRefinement = structuredClone(fixture.evidence);
    const refinedWeapon = requiredWeaponClaim(inferredRefinement.claims);
    if (refinedWeapon.searchCoverage.kind !== "weapon-search-coverage") {
      throw new Error("Expected weapon search coverage.");
    }
    refinedWeapon.searchCoverage.refinementCoverageOutcome = "exact-candidate";
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        inferredRefinement,
        fixture.formulaDraft,
      ),
      "claim.source_refinement_inferred",
    );

    const detachedCoverage = structuredClone(fixture.evidence);
    const detachedWeapon = requiredWeaponClaim(detachedCoverage.claims);
    if (detachedWeapon.searchCoverage.kind !== "weapon-search-coverage") {
      throw new Error("Expected weapon search coverage.");
    }
    detachedWeapon.searchCoverage.observationId = "bogus-other-weapon";
    detachedWeapon.searchCoverage.candidateRefinements = [];
    const detachedReport =
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        detachedCoverage,
        fixture.formulaDraft,
      );
    expectWithheld(
      detachedReport,
      "claim.exact_search_coverage_matrix_changed",
    );
    expect(detachedReport.issues.map(({ code }) => code)).toContain(
      "claim.weapon_coverage_domain_inconsistent",
    );

    const wrongFormula = structuredClone(fixture.formulaDraft);
    wrongFormula.sourceTeamRecordId =
      "kqm:team:keqing-ineffa-furina-jean-lunar-charged-example";
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        fixture.evidence,
        wrongFormula,
      ),
      "formula.wrong_team",
    );

    const splitNestedLineage = structuredClone(fixture.formulaDraft);
    const wrongTeam =
      "kqm:team:keqing-ineffa-furina-jean-lunar-charged-example";
    (
      splitNestedLineage.sourceRotation as {
        recordId: string;
      }
    ).recordId = wrongTeam;
    splitNestedLineage.equipmentFixture.sourceTeamRecordId = wrongTeam;
    splitNestedLineage.damageReplayReadiness.sourceTeamRecordId = wrongTeam;
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        fixture.evidence,
        splitNestedLineage,
      ),
      "formula.nested_team_lineage_mismatch",
    );

    const changedRoster = structuredClone(fixture.formulaDraft);
    changedRoster.assumptions.characters[3].characterId = "jean";
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        fixture.evidence,
        changedRoster,
      ),
      "formula.roster_or_equipment_lineage_changed",
    );

    const changedKeqingAnchor = structuredClone(fixture.formulaDraft);
    changedKeqingAnchor.assumptions.characters[0].selectedWeaponId =
      "primordial_jade_cutter";
    changedKeqingAnchor.assumptions.characters[0].selectedArtifact = {
      type: "4pc",
      setId: "marechaussee_hunter",
    };
    expectWithheld(
      buildKeqingLunarSourceConditionedCandidateLatticeReport(
        fixture.evidence,
        changedKeqingAnchor,
      ),
      "formula.roster_or_equipment_lineage_changed",
    );
  });
});

const FORBIDDEN_RESULT_KEYS = new Set([
  "damage",
  "technicalObjective",
  "score",
  "rank",
  "winner",
  "statWeight",
  "idealRolls",
  "er",
  "minEr",
  "energyRecharge",
  "generatedBuild",
]);

async function loadFixture(): Promise<{
  evidence: KeqingLunarEquipmentEvidenceValidationReport;
  formulaDraft: KeqingIneffaFormulaDraftReport;
}> {
  const [evidence, formulaDraft] = await Promise.all([
    readJson(KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH),
    readJson(KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH),
  ]);
  return {
    evidence: evidence as KeqingLunarEquipmentEvidenceValidationReport,
    formulaDraft: formulaDraft as KeqingIneffaFormulaDraftReport,
  };
}

async function hashInputs(): Promise<Array<{ path: string; sha256: string }>> {
  return Promise.all(
    KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  );
}

function groupsForSource(
  report: KeqingLunarSourceConditionedCandidateLatticeReport,
  sourceRecordId: string,
): KeqingLunarCandidateEquipmentGroup[] {
  return report.equipmentGroups.filter(
    (group) => group.sourceRecordId === sourceRecordId,
  );
}

function onlyGroupForSource(
  report: KeqingLunarSourceConditionedCandidateLatticeReport,
  sourceRecordId: string,
): KeqingLunarCandidateEquipmentGroup {
  const groups = groupsForSource(report, sourceRecordId);
  if (groups.length !== 1) {
    throw new Error(`Expected one group for ${sourceRecordId}, found ${groups.length}.`);
  }
  return groups[0];
}

function groupWeaponIds(group: KeqingLunarCandidateEquipmentGroup): string[] {
  return group.members.flatMap(({ sourceClaim }) =>
    sourceClaim.kind === "weapon" ? [sourceClaim.weaponId] : [],
  );
}

function requiredWeaponClaim(
  claims: KeqingLunarEquipmentEvidenceClaim[],
): KeqingLunarEquipmentEvidenceClaim {
  const claim = claims.find(({ sourceClaim }) => sourceClaim.kind === "weapon");
  if (!claim) throw new Error("Missing weapon claim.");
  return claim;
}

function expectWithheld(
  report: KeqingLunarSourceConditionedCandidateLatticeReport,
  issueCode: string,
): void {
  expect(report.comparisonStatus).toBe("not-comparable");
  expect(report.equipmentGroups).toEqual([]);
  expect(report.statClaims).toEqual([]);
  expect(report.lattice).toBeNull();
  expect(report.technicalComparisonBoundary).toEqual({
    status: "withheld-upstream-not-comparable",
    teamFixtures: [],
  });
  expect(report.issues.map(({ code }) => code)).toContain(issueCode);
}

function findExactKeys(value: unknown, keys: ReadonlySet<string>): string[] {
  const matches: string[] = [];
  visit(value, "$");
  return matches.sort();

  function visit(current: unknown, pathPrefix: string): void {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${pathPrefix}[${index}]`));
      return;
    }
    if (current == null || typeof current !== "object") return;
    for (const [key, entry] of Object.entries(current)) {
      if (keys.has(key)) matches.push(`${pathPrefix}.${key}`);
      visit(entry, `${pathPrefix}.${key}`);
    }
  }
}
