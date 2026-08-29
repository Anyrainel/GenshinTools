import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import type { KeqingIneffaFormulaDraftReport } from "../src/keqingIneffaFormulaDraft";
import {
  buildKeqingLunarCrossRecordCompositionContractReport,
  authenticateKeqingLunarCrossRecordCompositionContract,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS,
  type KeqingLunarCrossRecordCompositionContractReport,
} from "../src/keqingLunarCrossRecordCompositionContract";
import type { KeqingLunarSourceConditionedCandidateLatticeReport } from "../src/keqingLunarSourceConditionedCandidateLattice";
import {
  KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
  REPOSITORY_ROOT,
} from "../src/paths";

const TARGET_TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const GENERAL_MISTSPLITTER_GROUP_ID =
  "kqm:character-guide:keqing-lunar-charged-general-mistsplitter-luna-i:weapon:0";
const MARECHAUSSEE_HUNTER_GROUP_ID =
  "kqm:character-guide:keqing-lunar-charged-furina-marechaussee-hunter-luna-i:artifact:0";
const ONE_NOD_NOTSU_GROUP_ID =
  "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i:artifact:0";
const TWO_NOD_NOTSU_GROUP_ID =
  "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i:artifact:1";
const DEFAULT_STAT_SOURCE_RECORD_ID =
  "keqing-lunar-charged-default-artifact-stats-luna-i";
const CR_CIRCLET_CLAIM_ID =
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:circlet:1";

describe("Keqing Lunar cross-record composition contract", () => {
  it("replays exactly two unordered Guide Factory-authored compositions", async () => {
    const fixture = await loadFixture();
    const latticeBefore = structuredClone(fixture.candidateLattice);
    const formulaBefore = structuredClone(fixture.formulaDraft);
    const generatedFrom = await hashInputs();
    const durable = await readJson(
      KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH,
    );

    const report = buildKeqingLunarCrossRecordCompositionContractReport(
      fixture.candidateLattice,
      fixture.formulaDraft,
      generatedFrom,
    );
    const repeated = buildKeqingLunarCrossRecordCompositionContractReport(
      fixture.candidateLattice,
      fixture.formulaDraft,
      generatedFrom,
    );

    expect(repeated).toEqual(report);
    expect(durable).toEqual(report);
    expect(fixture.candidateLattice).toEqual(latticeBefore);
    expect(fixture.formulaDraft).toEqual(formulaBefore);
    expect(report).toMatchObject({
      contractStatus: "comparable",
      supportsGuideClaims: false,
      supportsSourceAuthoredBuildClaims: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRelativeArtifactClaims: false,
      supportsTechnicalComparison: false,
      supportsEnergyRecoveryClaims: false,
      sourceAuthoredCompositionCount: 0,
      guideFactoryAuthoredCompositionCount: 2,
      crossRecordOrdering: "none",
      generatorExecuted: false,
      damageComputationExecuted: false,
      technicalComparisonExecuted: false,
      energyRecoveryInputsUsed: false,
      issues: [],
    });
    expect(report.targetBoundary).toEqual({
      teamRecordId: TARGET_TEAM_ID,
      characterIds: ["keqing", "ineffa", "furina", "xilonen"],
      sourceRosterAndDeclaredReactionFactsOnly: true,
      exactTeamConditionFactsOnly: true,
      conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper",
    });
    expect(report.targetBoundary).not.toHaveProperty("sourceRosterOnly");
    expect(report.compositions.map(({ compositionId }) => compositionId)).toEqual([
      "guide-factory:keqing-lunar:marechaussee-hunter",
      "guide-factory:keqing-lunar:night-of-the-skys-unveiling-one-nod-krai",
    ]);
    expect(
      report.compositions.map(({ artifact }) => ({
        groupId: artifact.groupId,
        setId: artifact.artifact.setId,
        sourceClassification: artifact.sourceClassification,
      })),
    ).toEqual([
      {
        groupId: MARECHAUSSEE_HUNTER_GROUP_ID,
        setId: "marechaussee_hunter",
        sourceClassification: "default",
      },
      {
        groupId: ONE_NOD_NOTSU_GROUP_ID,
        setId: "night_of_the_skys_unveiling",
        sourceClassification: "alternative",
      },
    ]);
    for (const composition of report.compositions) {
      expect(composition).toMatchObject({
        authoredBy: "guide-factory",
        sourceAuthored: false,
        sourceAuthoredBuild: false,
        joinKind: "cross-record-evidence-composition",
        crossRecordOrdering: "none",
        teamRecordId: TARGET_TEAM_ID,
        weapon: {
          groupId: GENERAL_MISTSPLITTER_GROUP_ID,
          weaponId: "mistsplitter_reforged",
          conditionResolution: "matched-by-exact-team-facts",
          conditionResolutionOrigin:
            "guide-factory-exact-team-facts-wrapper",
          sourceRefinement: null,
        },
        artifact: {
          conditionResolutionOrigin:
            "guide-factory-exact-team-facts-wrapper",
        },
        statProfile: {
          profileSourceRecordId: DEFAULT_STAT_SOURCE_RECORD_ID,
          crossRecordJoinAuthoredByGuideFactory: true,
          matchedClaimCount: 7,
          withheldClaimCount: 1,
        },
        formulaFixtureReference: {
          reviewStatus: "unreviewed",
          sourceBindingEstablished: false,
          technicalExecutionAuthorized: false,
        },
      });
      expect(composition.statProfile.matchedClaims).toHaveLength(7);
      expect(
        composition.statProfile.matchedClaims.every(
          ({ conditionResolutionOrigin }) =>
            conditionResolutionOrigin ===
            "guide-factory-exact-team-facts-wrapper",
        ),
      ).toBe(true);
      expect(composition.statProfile.withheldClaims).toEqual([
        expect.objectContaining({
          claimId: CR_CIRCLET_CLAIM_ID,
          conditionResolution: "withheld-unresolved-source-condition",
          conditionResolutionOrigin:
            "guide-factory-exact-team-facts-wrapper",
          withholdingReason: "unresolved-no-overcap-condition",
        }),
      ]);
      expect(
        composition.statProfile.matchedClaims.map(({ claimId }) => claimId),
      ).not.toContain(CR_CIRCLET_CLAIM_ID);
    }
    expect(report.excludedSourceBranches).toEqual([
      {
        groupId: TWO_NOD_NOTSU_GROUP_ID,
        claimId: `${TWO_NOD_NOTSU_GROUP_ID}:0`,
        artifact: {
          type: "4pc",
          setId: "night_of_the_skys_unveiling",
        },
        conditionResolution: "not-matched-by-exact-team-facts",
        conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper",
        includedInCompositions: false,
        reason: "two-nod-krai-condition-does-not-match-exact-team",
      },
    ]);
    expect(findExactKeys(report, FORBIDDEN_RESULT_KEYS)).toEqual([]);
  });

  it("keeps every non-source input in a separate origin ledger", async () => {
    const fixture = await loadFixture();
    const report = buildKeqingLunarCrossRecordCompositionContractReport(
      fixture.candidateLattice,
      fixture.formulaDraft,
    );
    const ledger = report.originLedger;
    if (ledger == null) throw new Error("Expected a comparable origin ledger.");

    expect(ledger.sourceRoster).toEqual({
      origin: "kqm-exact-team-record",
      sourceAuthored: true,
      teamRecordId: TARGET_TEAM_ID,
      characterIds: ["keqing", "ineffa", "furina", "xilonen"],
      supportsEquipmentBinding: false,
    });
    expect(ledger.sourceClaims).toMatchObject({
      origin: "kqm-character-guide-claim-records",
      sourceAuthored: true,
      sourceAuthoredCrossRecordJoin: false,
      conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper",
      sharedWeaponClaimId: `${GENERAL_MISTSPLITTER_GROUP_ID}:0`,
      artifactClaimIds: [
        `${MARECHAUSSEE_HUNTER_GROUP_ID}:0`,
        `${ONE_NOD_NOTSU_GROUP_ID}:0`,
      ],
      withheldDefaultStatClaimIds: [CR_CIRCLET_CLAIM_ID],
      excludedArtifactClaimIds: [`${TWO_NOD_NOTSU_GROUP_ID}:0`],
    });
    expect(ledger.sourceClaims.matchedDefaultStatClaimIds).toHaveLength(7);
    expect(ledger.fixtureAssumptions).toMatchObject({
      origin: "guide-factory-formula-fixture-assumptions",
      sourceAuthored: false,
      fixtureId: "keqing-ineffa-source-rotation-comparison-v1",
      appliedByThisContract: false,
    });
    expect(ledger.fixtureAssumptions.assumptions).toHaveLength(4);
    expect(ledger.r1ExperimentPolicy).toEqual({
      origin: "guide-factory-experiment-policy",
      sourceAuthored: false,
      characterId: "keqing",
      weaponId: "mistsplitter_reforged",
      sourceRefinement: null,
      experimentRefinement: 1,
      experimentRefinementIsSourceFact: false,
      appliedByThisContract: false,
    });
    expect(ledger.teammateEquipment).toMatchObject({
      origin: "genshintools-baseline-equipment-fixture",
      sourceAuthoredForExactKqmTeam: false,
      exactTeamSourceBindsEquipment: false,
      appliedByThisContract: false,
    });
    expect(
      ledger.teammateEquipment.members.map(
        ({ characterId, buildSourceRecordId }) => [
          characterId,
          buildSourceRecordId,
        ],
      ),
    ).toEqual([
      ["ineffa", "FeFiQU8"],
      ["furina", "BQAI0BO"],
      ["xilonen", "Dbt0Wkm"],
    ]);
    expect(ledger.unreviewedFormulaLines).toMatchObject({
      origin: "guide-factory-authored-source-translation",
      sourceAuthored: false,
      reviewStatus: "unreviewed",
      sourceBindingEstablished: false,
      appliedByThisContract: false,
    });
    expect(ledger.unreviewedFormulaLines.lines).toHaveLength(11);
    expect(ledger.unreviewedFormulaLines.lines).toContainEqual({
      characterId: "keqing",
      formulaId: "keqing-charged",
      count: 8,
      sourceTokenCoverage: "partial",
      relation: "source-translation-higher",
    });
    expect(ledger.calcContext).toEqual({
      origin: "guide-factory-experiment-policy",
      sourceAuthored: false,
      value: {
        enemyLevel: 110,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
      appliedByThisContract: false,
    });
    expect(ledger.energyRecovery).toEqual({
      origin: "absent-by-contract",
      inputsUsed: false,
      thresholdsUsed: false,
      targetsUsed: false,
      sequenceInputUsed: false,
    });
  });

  it("fails closed on selected equipment source or recommendation provenance drift", async () => {
    const fixture = await loadFixture();
    const changedConditions = structuredClone(fixture.candidateLattice);
    requiredEquipmentGroup(
      changedConditions,
      MARECHAUSSEE_HUNTER_GROUP_ID,
    ).sourceConditions.push("Injected condition drift.");
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changedConditions,
        fixture.formulaDraft,
      ),
      "claim.required_group_provenance_changed",
    );

    const metadataDrifts: Array<[string, unknown]> = [
      ["repositoryRecordId", "kqm:character-guide:other-record"],
      ["sourceRecordId", "other-source-record"],
      ["recommendationId", "other-recommendation"],
      ["recommendationScope", "other-scope"],
      ["roles", ["support"]],
    ];
    for (const [field, value] of metadataDrifts) {
      const changed = structuredClone(fixture.candidateLattice);
      const group = requiredEquipmentGroup(
        changed,
        GENERAL_MISTSPLITTER_GROUP_ID,
      );
      (group as unknown as Record<string, unknown>)[field] = value;
      expectWithheld(
        buildKeqingLunarCrossRecordCompositionContractReport(
          changed,
          fixture.formulaDraft,
        ),
        "claim.required_group_provenance_changed",
      );
    }

    const changedCellRepresentability = structuredClone(
      fixture.candidateLattice,
    );
    requiredEquipmentCell(
      requiredTarget(changedCellRepresentability),
      MARECHAUSSEE_HUNTER_GROUP_ID,
    ).members[0].searchRepresentability = "not-representable";
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changedCellRepresentability,
        fixture.formulaDraft,
      ),
      "claim.required_group_or_resolution_changed",
    );
  });

  it("fails closed on selected stat source or recommendation provenance drift", async () => {
    const fixture = await loadFixture();
    const changedConditions = structuredClone(fixture.candidateLattice);
    requiredDefaultStatClaim(changedConditions).sourceConditions.push(
      "Injected stat condition drift.",
    );
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changedConditions,
        fixture.formulaDraft,
      ),
      "stats.default_profile_changed",
    );

    const changedProvenance = structuredClone(fixture.candidateLattice);
    requiredDefaultStatClaim(changedProvenance).recommendationId =
      "other-recommendation";
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changedProvenance,
        fixture.formulaDraft,
      ),
      "stats.default_profile_provenance_changed",
    );

    const changedSourceRecord = structuredClone(fixture.candidateLattice);
    requiredDefaultStatClaim(changedSourceRecord).sourceRecordId =
      "other-source-record";
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changedSourceRecord,
        fixture.formulaDraft,
      ),
      "stats.default_profile_missing_or_duplicated",
    );
  });

  it("fails closed on a duplicate conflicting target stat cell", async () => {
    const fixture = await loadFixture();
    const changed = structuredClone(fixture.candidateLattice);
    const target = requiredTarget(changed);
    const original = target.statClaimCells.find(
      ({ claimId }) => claimId === CR_CIRCLET_CLAIM_ID,
    );
    if (!original) throw new Error("Expected the withheld CRIT Rate cell.");
    const duplicate = structuredClone(original);
    duplicate.conditionResolution = "matched-by-exact-team-facts";
    target.statClaimCells.push(duplicate);

    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changed,
        fixture.formulaDraft,
      ),
      "stats.default_profile_cell_inventory_changed",
    );
  });

  it("fails closed on coherently rebound teammate status or source-reference drift", async () => {
    const fixture = await loadFixture();
    const changedStatusFormula = structuredClone(fixture.formulaDraft);
    const changedStatusEvidence = requiredTeammateEvidence(
      changedStatusFormula,
      "furina",
    );
    changedStatusEvidence.guideStatus = "accepted";
    const statusLattice = structuredClone(fixture.candidateLattice);
    bindFormulaDraft(statusLattice, changedStatusFormula);
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        statusLattice,
        changedStatusFormula,
      ),
      "formula.teammate_equipment_changed",
    );

    const changedRefsFormula = structuredClone(fixture.formulaDraft);
    const changedRefsEvidence = requiredTeammateEvidence(
      changedRefsFormula,
      "xilonen",
    );
    changedRefsEvidence.guideSourceRefs[0].sourceRecordId =
      "other-source-record";
    const refsLattice = structuredClone(fixture.candidateLattice);
    bindFormulaDraft(refsLattice, changedRefsFormula);
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        refsLattice,
        changedRefsFormula,
      ),
      "formula.teammate_equipment_changed",
    );
  });

  it("fails closed when any upstream support flag becomes true", async () => {
    const fixture = await loadFixture();
    const flagNames = [
      "supportsGuideClaims",
      "supportsEquipmentRecommendations",
      "supportsStatRecommendations",
      "supportsConditionApplicabilityClaims",
      "supportsRankClaims",
      "supportsDamageClaims",
      "supportsEnergyRecoveryClaims",
    ] as const;
    for (const flagName of flagNames) {
      const changed = structuredClone(fixture.candidateLattice);
      (changed as unknown as Record<string, boolean>)[flagName] = true;
      expectWithheld(
        buildKeqingLunarCrossRecordCompositionContractReport(
          changed,
          fixture.formulaDraft,
        ),
        "input.candidate_lattice_claim_support_changed",
      );
    }
  });

  it("fails closed when upstream technical availability authorizes anything", async () => {
    const fixture = await loadFixture();
    const mutations: Array<(boundary: Record<string, unknown>) => void> = [
      (boundary) => {
        boundary.status = "withheld-upstream-not-comparable";
      },
      (boundary) => {
        boundary.exactFixtureCount = 2;
      },
      (boundary) => {
        boundary.authorizedSourceConditionedComparisonCount = 1;
      },
      (boundary) => {
        const fixture = requiredAvailableTechnicalFixture(boundary);
        fixture.damageReplayReady = true;
      },
      (boundary) => {
        const fixture = requiredAvailableTechnicalFixture(boundary);
        const anchor = fixture.keqingAnchor as Record<string, unknown>;
        anchor.fixtureRefinementIsSourceFact = true;
      },
      (boundary) => {
        const fixture = requiredAvailableTechnicalFixture(boundary);
        const anchor = fixture.keqingAnchor as Record<string, unknown>;
        anchor.completeSourceConditionedEquipmentAnchor = true;
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(fixture.candidateLattice);
      mutate(
        changed.technicalComparisonBoundary as unknown as Record<
          string,
          unknown
        >,
      );
      expectWithheld(
        buildKeqingLunarCrossRecordCompositionContractReport(
          changed,
          fixture.formulaDraft,
        ),
        "input.candidate_lattice_technical_boundary_changed",
      );
    }
  });

  it("authenticates only an exact contract rebuilt from current typed inputs", async () => {
    const fixture = await loadFixture();
    const generatedFrom = await hashInputs();
    const canonical = buildKeqingLunarCrossRecordCompositionContractReport(
      fixture.candidateLattice,
      fixture.formulaDraft,
      generatedFrom,
    );
    const authenticated =
      authenticateKeqingLunarCrossRecordCompositionContract(
        canonical,
        fixture.candidateLattice,
        fixture.formulaDraft,
        generatedFrom,
      );
    expect(authenticated).toEqual({
      authenticated: true,
      canonicalReport: canonical,
    });

    const tampered = structuredClone(canonical);
    (
      tampered.compositions[0] as unknown as { sourceAuthored: boolean }
    ).sourceAuthored = true;
    expect(
      authenticateKeqingLunarCrossRecordCompositionContract(
        tampered,
        fixture.candidateLattice,
        fixture.formulaDraft,
        generatedFrom,
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-contract-mismatch",
    });

    const changedSource = structuredClone(fixture.candidateLattice);
    requiredEquipmentGroup(
      changedSource,
      ONE_NOD_NOTSU_GROUP_ID,
    ).sourceConditions.push("Injected source drift.");
    expect(
      authenticateKeqingLunarCrossRecordCompositionContract(
        canonical,
        changedSource,
        fixture.formulaDraft,
        generatedFrom,
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "canonical-inputs-not-comparable",
    });

    const changedGeneratedFrom = structuredClone(generatedFrom);
    changedGeneratedFrom[0].sha256 = "0".repeat(64);
    expect(
      authenticateKeqingLunarCrossRecordCompositionContract(
        canonical,
        fixture.candidateLattice,
        fixture.formulaDraft,
        changedGeneratedFrom,
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-contract-mismatch",
    });
  });

  it("fails closed when a matched source condition is changed", async () => {
    const fixture = await loadFixture();
    const changed = structuredClone(fixture.candidateLattice);
    const target = requiredTarget(changed);
    const cell = requiredEquipmentCell(target, MARECHAUSSEE_HUNTER_GROUP_ID);
    cell.conditionResolution = "withheld-unresolved-source-condition";
    cell.members[0].conditionResolution =
      "withheld-unresolved-source-condition";

    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changed,
        fixture.formulaDraft,
      ),
      "claim.required_group_or_resolution_changed",
    );
  });

  it("fails closed rather than accepting the wrong NotSU branch", async () => {
    const fixture = await loadFixture();
    const changed = structuredClone(fixture.candidateLattice);
    const oneNod = changed.equipmentGroups.find(
      ({ groupId }) => groupId === ONE_NOD_NOTSU_GROUP_ID,
    );
    if (
      oneNod?.members[0].sourceClaim.kind !== "artifact" ||
      oneNod.members[0].sourceClaim.artifact.type !== "4pc"
    ) {
      throw new Error("Expected the exactly-one-Nod-Krai artifact claim.");
    }
    oneNod.members[0].sourceClaim.artifact.setId = "thundering_fury";

    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changed,
        fixture.formulaDraft,
      ),
      "claim.required_group_or_resolution_changed",
    );

    const promotedTwoNod = structuredClone(fixture.candidateLattice);
    const target = requiredTarget(promotedTwoNod);
    const twoNodCell = requiredEquipmentCell(target, TWO_NOD_NOTSU_GROUP_ID);
    twoNodCell.conditionResolution = "matched-by-exact-team-facts";
    twoNodCell.members[0].conditionResolution = "matched-by-exact-team-facts";
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        promotedTwoNod,
        fixture.formulaDraft,
      ),
      "claim.required_group_or_resolution_changed",
    );
  });

  it("fails closed if source refinement is inferred", async () => {
    const fixture = await loadFixture();
    const changed = structuredClone(fixture.candidateLattice);
    const group = changed.equipmentGroups.find(
      ({ groupId }) => groupId === GENERAL_MISTSPLITTER_GROUP_ID,
    );
    if (group?.members[0].sourceClaim.kind !== "weapon") {
      throw new Error("Expected the general Mistsplitter source claim.");
    }
    (
      group.members[0] as unknown as {
        sourceRefinement: number | null;
      }
    ).sourceRefinement = 1;

    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changed,
        fixture.formulaDraft,
      ),
      "weapon.source_refinement_or_group_changed",
    );
  });

  it("fails closed if a default stat is promoted or dropped", async () => {
    const fixture = await loadFixture();
    const promoted = structuredClone(fixture.candidateLattice);
    const promotedCr = requiredTarget(promoted).statClaimCells.find(
      ({ claimId }) => claimId === CR_CIRCLET_CLAIM_ID,
    );
    if (!promotedCr) throw new Error("Expected the withheld CRIT Rate Circlet.");
    promotedCr.conditionResolution = "matched-by-exact-team-facts";
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        promoted,
        fixture.formulaDraft,
      ),
      "stats.default_profile_changed",
    );

    const dropped = structuredClone(fixture.candidateLattice);
    dropped.statClaims = dropped.statClaims.filter(
      ({ claimId }) =>
        claimId !==
        "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:substat:2",
    );
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        dropped,
        fixture.formulaDraft,
      ),
      "stats.default_profile_missing_or_duplicated",
    );
  });

  it("fails closed on formula, team, or line drift", async () => {
    const fixture = await loadFixture();
    const changedTeam = structuredClone(fixture.candidateLattice);
    (
      requiredTarget(changedTeam).characterIds as unknown as string[]
    )[3] = "jean";
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        changedTeam,
        fixture.formulaDraft,
      ),
      "target.exact_team_boundary_changed",
    );

    const wrongTeam = structuredClone(fixture.formulaDraft);
    wrongTeam.sourceTeamRecordId =
      "kqm:team:keqing-ineffa-furina-jean-lunar-charged-example";
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        fixture.candidateLattice,
        wrongTeam,
      ),
      "formula.fixture_or_team_changed",
    );

    const changedLine = structuredClone(fixture.formulaDraft);
    changedLine.authoredTranslation.formulaComparisons[0].sourceCountClaim = {
      type: "exact",
      value: 2,
    };
    expectWithheld(
      buildKeqingLunarCrossRecordCompositionContractReport(
        fixture.candidateLattice,
        changedLine,
      ),
      "formula.unreviewed_lines_changed",
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
  "recommendedRefinement",
]);

async function loadFixture(): Promise<{
  candidateLattice: KeqingLunarSourceConditionedCandidateLatticeReport;
  formulaDraft: KeqingIneffaFormulaDraftReport;
}> {
  const [candidateLattice, formulaDraft] = await Promise.all([
    readJson(KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH),
    readJson(KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH),
  ]);
  return {
    candidateLattice:
      candidateLattice as KeqingLunarSourceConditionedCandidateLatticeReport,
    formulaDraft: formulaDraft as KeqingIneffaFormulaDraftReport,
  };
}

async function hashInputs(): Promise<Array<{ path: string; sha256: string }>> {
  return Promise.all(
    KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  );
}

function requiredTarget(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
): NonNullable<
  KeqingLunarSourceConditionedCandidateLatticeReport["lattice"]
>["teams"][number] {
  const target = lattice.lattice?.teams.find(
    ({ teamRecordId }) => teamRecordId === TARGET_TEAM_ID,
  );
  if (!target) throw new Error("Expected the exact Xilonen target team.");
  return target;
}

function requiredEquipmentCell(
  target: ReturnType<typeof requiredTarget>,
  groupId: string,
): ReturnType<typeof requiredTarget>["equipmentGroupCells"][number] {
  const cell = target.equipmentGroupCells.find(
    (candidate) => candidate.groupId === groupId,
  );
  if (!cell) throw new Error(`Expected equipment group cell ${groupId}.`);
  return cell;
}

function requiredEquipmentGroup(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  groupId: string,
): KeqingLunarSourceConditionedCandidateLatticeReport["equipmentGroups"][number] {
  const group = lattice.equipmentGroups.find(
    (candidate) => candidate.groupId === groupId,
  );
  if (!group) throw new Error(`Expected equipment group ${groupId}.`);
  return group;
}

function requiredDefaultStatClaim(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
): KeqingLunarSourceConditionedCandidateLatticeReport["statClaims"][number] {
  const claim = lattice.statClaims.find(
    ({ sourceRecordId }) =>
      sourceRecordId === DEFAULT_STAT_SOURCE_RECORD_ID,
  );
  if (!claim) throw new Error("Expected a default stat claim.");
  return claim;
}

function requiredTeammateEvidence(
  formulaDraft: KeqingIneffaFormulaDraftReport,
  characterId: "ineffa" | "furina" | "xilonen",
): KeqingIneffaFormulaDraftReport["equipmentFixture"]["evidence"][number] {
  const evidence = formulaDraft.equipmentFixture.evidence.find(
    (candidate) => candidate.characterId === characterId,
  );
  if (!evidence) throw new Error(`Expected ${characterId} equipment evidence.`);
  return evidence;
}

function bindFormulaDraft(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  formulaDraft: KeqingIneffaFormulaDraftReport,
): void {
  lattice.inputBoundary.formulaDraftSha256 = sha256Text(
    stableJson(formulaDraft),
  );
}

function requiredAvailableTechnicalFixture(
  boundary: Record<string, unknown>,
): Record<string, unknown> {
  const fixtures = boundary.teamFixtures;
  if (!Array.isArray(fixtures)) {
    throw new Error("Expected technical team fixtures.");
  }
  const fixture = fixtures.find(
    (candidate) =>
      candidate != null &&
      typeof candidate === "object" &&
      (candidate as Record<string, unknown>).status ===
        "fixture-available-but-not-authorized",
  );
  if (fixture == null || typeof fixture !== "object") {
    throw new Error("Expected the availability-only technical fixture.");
  }
  return fixture as Record<string, unknown>;
}

function expectWithheld(
  report: KeqingLunarCrossRecordCompositionContractReport,
  issueCode: string,
): void {
  expect(report.contractStatus).toBe("not-comparable");
  expect(report.guideFactoryAuthoredCompositionCount).toBe(0);
  expect(report.targetBoundary).toBeNull();
  expect(report.compositions).toEqual([]);
  expect(report.excludedSourceBranches).toEqual([]);
  expect(report.originLedger).toBeNull();
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
