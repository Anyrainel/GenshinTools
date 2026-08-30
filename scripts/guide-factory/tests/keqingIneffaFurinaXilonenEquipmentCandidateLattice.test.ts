import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ArtifactChoiceSearchCoverageReport } from "../src/artifactChoiceSearchCoverage";
import { formatKeqingIneffaFurinaXilonenEquipmentCandidateLatticeSummary } from "../src/construct-keqing-ineffa-furina-xilonen-equipment-candidate-lattice";
import { readJson } from "../src/io";
import {
  buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  type BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput,
  type KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
} from "../src/keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "../src/keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "../src/paths";
import type {
  GenshinToolsPresetSnapshot,
  KnowledgeRepository,
  ManualObservationSnapshot,
  ManualSnapshotIndex,
  SourceRegistry,
} from "../src/schemas";
import type { WeaponChoiceSearchCoverageReport } from "../src/weaponChoiceSearchCoverage";

describe("Keqing/Ineffa/Furina/Xilonen equipment candidate lattice", () => {
  it("authenticates and completely enumerates the exact 36-node bounded product", async () => {
    const input = await fixture();
    const inputBefore = structuredClone(input);
    const report =
      buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(input);
    const repeated =
      buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(input);

    expect(report).toEqual(repeated);
    expect(input).toEqual(inputBefore);
    expect(report.validationStatus).toBe("authenticated-enumeration-only");
    expect(report.issues).toEqual([]);
    expect(report.semanticScope).toMatchObject({
      authentication: "accepted",
      acceptedAudit: {
        trust: "authenticated-current-input-rebuild-and-pinned-expectation",
        dependencies: expect.any(Array),
        paritySummary: {
          parityCount: 14,
          exactParityCount: 14,
        },
      },
    });
    expect(report.candidateEnumerationExecuted).toBe(true);
    expect(report).toMatchObject({
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsOptimality: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsGameplayApplicabilityClaims: false,
      supportsEnergyRequirements: false,
    });
    expect(report.sourceBacking).toEqual({
      exactRosterSourceBacked: true,
      activeAxisOccurrencesAllSourceBacked: true,
      sourceGroupsAndListsRetained: true,
      sourceAuthoredWithinCharacterWeaponArtifactPairing: false,
      sourceAuthoredCrossCharacterComposition: false,
      sourcePublishedWholeTeamEquipment: false,
      wholeCandidateCount: 0,
      compositionOwner: "source-specific-wrapper",
      gameplayValidated: false,
    });
    expect(report.inventoryBoundary).toMatchObject({
      groupOrListCount: 9,
      occurrenceCount: 20,
      activeOccurrenceCount: 14,
      excludedNotFirstScopeCount: 4,
      excludedInvestmentCount: 1,
      excludedDeferredEnergyCount: 1,
      erStatWeightsProjected: false,
    });
    expect(report.summary).toEqual({
      memberCount: 4,
      axisCount: 8,
      activeGroupCount: 9,
      activeOccurrenceCount: 14,
      candidateNodeCount: 36,
      candidateReferenceCount: 288,
      sourcePublishedWholeCandidateCount: 0,
      gameplayValidatedCandidateCount: 0,
    });
    expect(report.lattice.comparisonStatus).toBe("comparable");
    expect(report.lattice.capabilities).toEqual({
      sourceClaims: false,
      equipmentRecommendationClaims: false,
      rankClaims: false,
      guideClaims: false,
      evaluation: false,
      damage: false,
      energyRecovery: false,
      enumeration: true,
    });
    expect(report.lattice.lattice?.nodes).toHaveLength(36);
    expect(
      report.lattice.lattice?.nodes.every(
        ({ selections }) => selections.length === 8,
      ),
    ).toBe(true);
    expect(report.lattice.lattice?.domains.map(({ occurrenceCount }) => occurrenceCount)).toEqual([
      3,
      2,
      1,
      1,
      3,
      2,
      1,
      1,
    ]);
  });

  it("preserves KQM grouping and preset list positions without turning them into global ranks", async () => {
    const report = await canonicalReport();
    const groups = report.lattice.lattice?.groups ?? [];
    const lionBlack = groups.find(
      ({ groupId }) => groupId === "kqm-keqing-weapon-group-0",
    );
    const wolf = groups.find(
      ({ groupId }) => groupId === "kqm-keqing-weapon-group-1",
    );
    const furinaWeapons = groups.find(
      ({ groupId }) => groupId === "preset-furina-weapon-list",
    );
    expect(lionBlack).toMatchObject({
      recommendationOrdering: "ranked-groups",
      grouping: "tied",
      classification: "recommended",
      sourceLocalRank: null,
      sourceListIndex: 0,
    });
    expect(lionBlack?.occurrences.map(({ tieIndex }) => tieIndex)).toEqual([0, 1]);
    expect(wolf).toMatchObject({
      recommendationOrdering: "ranked-groups",
      grouping: "single",
      classification: "alternative",
      sourceLocalRank: null,
      sourceListIndex: 1,
    });
    expect(furinaWeapons).toMatchObject({
      recommendationOrdering: null,
      sourceLocalRank: null,
      grouping: "alternatives",
    });
    expect(
      furinaWeapons?.occurrences.map(({ listIndex, payload }) => ({
        listIndex,
        ordering: payload.sourceOrderingSemantics,
        refinement: payload.requestedRefinement,
      })),
    ).toEqual([
      { listIndex: 0, ordering: "preset-list-index-not-rank", refinement: 1 },
      { listIndex: 1, ordering: "preset-list-index-not-rank", refinement: 1 },
      { listIndex: 2, ordering: "preset-list-index-not-rank", refinement: 1 },
    ]);
  });

  it("separates structural condition resolution from unknown gameplay applicability", async () => {
    const report = await canonicalReport();
    expect(report.requestBoundary.conditionResolutions).toEqual({
      lunarChargedRosterCondition: {
        exactSourceCondition: "Keqing is used in a Lunar-Charged team.",
        resolution: "matched-by-exact-team-facts",
      },
      equalRefinementCondition: {
        exactSourceCondition: "The compared weapons have equal Refinement.",
        sourceResolution: "withheld-unresolved-source-condition",
        effectiveResolution: "matched-by-exact-team-and-supplied-request",
        requestRefinement: 5,
      },
      topContributorCondition: {
        exactSourceCondition:
          "Keqing is the team's top Lunar-Charged contributor without using a CRIT Rate artifact set.",
        sourceResolution: "withheld-unresolved-source-condition",
        effectiveResolution: "matched-by-exact-team-and-supplied-request",
        assumptionId:
          "assume-keqing-top-lunar-contributor-without-crit-rate-set-v1",
      },
    });
    expect(report.requestBoundary.gameplayApplicability).toBe(
      "unknown-not-validated",
    );
    expect(report.requestBoundary.presetTeamApplicability).toBe(
      "unknown-not-evaluated",
    );
    expect(report.requestBoundary.xilonenScrollWarning).toContain(
      "generally cannot activate Scroll for Hydro",
    );
  });

  it("projects artifact identity only and explicitly defers the ER-derived holdout", async () => {
    const report = await canonicalReport();
    const deferred = report.inventoryBoundary.occurrences.filter(
      ({ status }) => status === "excluded-deferred-energy",
    );
    expect(deferred).toEqual([
      expect.objectContaining({
        occurrenceId:
          "genshintools-presets:character-guide:furina:build:BOfjRIm",
        equipmentId: "2pc+2pc:er-20+er-20",
      }),
    ]);
    const serializedGroups = JSON.stringify(report.lattice.lattice?.groups);
    expect(serializedGroups).not.toContain("sands");
    expect(serializedGroups).not.toContain("substats");
    expect(serializedGroups).not.toContain("circlet");
    expect(serializedGroups).not.toContain("goblet");
    expect(
      report.lattice.lattice?.groups.every((group) =>
        group.occurrences.every(
          ({ energyDerivation }) => energyDerivation === "not-er-derived",
        ),
      ),
    ).toBe(true);
  });

  it("matches the durable report byte-for-byte through stable JSON", async () => {
    const report = await canonicalReport();
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
        report,
      ),
    ).not.toThrow();
    const durable = (await readJson(
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_PATH,
    )) as KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport;
    expect(durable).toEqual(report);
    expect(
      formatKeqingIneffaFurinaXilonenEquipmentCandidateLatticeSummary(report),
    ).toContain("36 nodes");
  });

  it.each([
    ["repository", (input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput) => { const team = input.repository.records.find(({ id }) => id === "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example"); if (!team || team.kind !== "team") throw new Error("Missing team fixture"); team.label = "drifted"; }],
    ["raw KQM", (input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput) => { const guide = input.kqmSnapshot.records.find(({ sourceRecordId }) => sourceRecordId === "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i"); if (!guide || guide.kind !== "character_guide") throw new Error("Missing raw guide fixture"); guide.recommendation.label = "drifted"; }],
    ["preset snapshot", (input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput) => { input.genshinToolsSnapshot.characterGuides.find(({ characterId }) => characterId === "furina")!.weaponOrder!.reverse(); }],
    ["manual index", (input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput) => { const entry = input.manualIndex.snapshots.find(({ path }) => path === "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json"); if (!entry) throw new Error("Missing index fixture"); entry.sourceId = "gcsim"; }],
    ["registry", (input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput) => { input.sourceRegistry.sources.find(({ id }) => id === "kqm")!.permission = "internal"; }],
    ["live preset", (input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput) => { const live = input.liveBuildPreset as { characterWeapons: Record<string, string[]> }; live.characterWeapons.furina.reverse(); }],
    ["evidence", (input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput) => { const claim = input.evidenceReport.claims.find(({ claimId }) => claimId === "kqm:character-guide:keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i:weapon:0:0"); if (!claim) throw new Error("Missing evidence fixture"); claim.allSourceConditionsMappedExactly = false; }],
    ["weapon coverage", (input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput) => { const observation = input.weaponCoverageReport.observations.find(({ observationId }) => observationId === "genshintools-presets:character-guide:furina:weapon-order:0"); if (!observation) throw new Error("Missing weapon observation fixture"); observation.weaponId = "wrong"; }],
    ["artifact coverage", (input: BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput) => { const observation = input.artifactCoverageReport.observations.find(({ observationId }) => observationId === "genshintools-presets:character-guide:furina:build:BQAI0BO"); if (!observation) throw new Error("Missing artifact observation fixture"); observation.outcome = "not-representable"; }],
  ])("fails closed when %s drifts", async (_label, mutate) => {
    const input = await fixture();
    mutate(input);
    const report =
      buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(input);
    expect(report.validationStatus).toBe("not-authenticated");
    expect(report.candidateEnumerationExecuted).toBe(false);
    expect(report.lattice.lattice).toBeNull();
    expect(report.lattice.preflight.calculatedCombinationCount).toBeNull();
    expect(report.lattice.issues).toEqual([
      expect.objectContaining({
        code: "wrapper.source_authentication_failed",
      }),
    ]);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
        report,
      ),
    ).toThrow(/Refusing to write/);
  });

  it.each([
    ["node reference", (report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport) => { report.lattice.lattice!.nodes[0].selections[0].occurrenceId = "mutated"; }],
    ["source group metadata", (report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport) => { report.lattice.lattice!.groups[0].sourceLocalRank = 6; }],
    ["request assumption", (report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport) => { report.requestBoundary.scenarioAssumption.assumptionId = "mutated"; }],
    ["capability", (report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport) => { report.candidateEvaluationExecuted = true as false; }],
    ["holdout status", (report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport) => { report.inventoryBoundary.occurrences[10].status = "active-experiment-axis"; }],
    ["prohibited interpretations", (report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport) => { report.prohibitedInterpretations.pop(); }],
  ])("write guard rejects a post-build %s mutation", async (_label, mutate) => {
    const report = structuredClone(await canonicalReport());
    mutate(report);
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
        report,
      ),
    ).toThrow(/Refusing to write/);
  });
});

async function canonicalReport() {
  return buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
    await fixture(),
  );
}

async function fixture(): Promise<BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput> {
  const values = await Promise.all(
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS.map(
      (relativePath) => readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ),
  );
  return {
    repository: values[0] as KnowledgeRepository,
    kqmSnapshot: values[1] as ManualObservationSnapshot,
    genshinToolsSnapshot: values[2] as GenshinToolsPresetSnapshot,
    manualIndex: values[3] as ManualSnapshotIndex,
    sourceRegistry: values[4] as SourceRegistry,
    liveBuildPreset: values[5],
    evidenceReport:
      values[6] as KeqingLunarEquipmentEvidenceValidationReport,
    weaponCoverageReport: values[7] as WeaponChoiceSearchCoverageReport,
    artifactCoverageReport: values[8] as ArtifactChoiceSearchCoverageReport,
  };
}
