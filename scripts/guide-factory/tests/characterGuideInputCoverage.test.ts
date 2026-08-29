import { readFile } from "node:fs/promises";
import path from "node:path";
import { characters } from "@/data/resources";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildArtifactChoiceSearchCoverageReport,
  type ArtifactChoiceSearchCoverageReport,
} from "../src/artifactChoiceSearchCoverage";
import {
  buildCharacterGuideInputCoverageReport,
  buildReleasedGuideDomainCatalog,
  CHARACTER_GUIDE_INPUT_COVERAGE_AXES,
  CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS,
  CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS,
  type BuildCharacterGuideInputCoverageInput,
  type CharacterGuideInputCoverageAxis,
  type CharacterGuideInputCoverageReport,
  type CharacterGuideInputObservation,
} from "../src/characterGuideInputCoverage";
import { loadGameCatalogs } from "../src/catalogs";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import { loadManualSnapshotInputs } from "../src/manualSnapshots";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
  CHARACTER_GUIDE_INPUT_COVERAGE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
  WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
} from "../src/paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  SourceRegistrySchema,
  type KnowledgeRepository,
} from "../src/schemas";
import {
  buildWeaponChoiceSearchCoverageReport,
  type WeaponChoiceSearchCoverageReport,
} from "../src/weaponChoiceSearchCoverage";

const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const WEAPON_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/weapon-choice-search-coverage.json";
const ARTIFACT_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/artifact-choice-search-coverage.json";

type Fixture = BuildCharacterGuideInputCoverageInput;

let fixture: Fixture;
let report: CharacterGuideInputCoverageReport;

beforeAll(async () => {
  fixture = await loadFixture();
  report = buildCharacterGuideInputCoverageReport(fixture);
});

describe("character-guide input coverage", () => {
  it("authenticates the 125-character guide domain and matches the durable report", async () => {
    const durable = await readJson(CHARACTER_GUIDE_INPUT_COVERAGE_REPORT_PATH);

    expect(durable).toEqual(report);
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.summary).toMatchObject({
      characterCount: 125,
      constellationRowCount: 875,
      repositoryAuthoredDamagePlanObservationCount: 0,
      coupledArtifactPlanObservationCount: 1,
      guideLessCharacterIds: [
        "aloy",
        "traveler_anemo",
        "traveler_electro",
        "traveler_geo",
        "traveler_hydro",
      ],
    });
    expect(report.boundaries.releasedGuideDomain).toMatchObject({
      characterCount: 125,
      expectedCharacterCount: 125,
      eligibleCatalogSha256:
        "8eb36c1d496e01698ba40a82d3ac10c506d2c67360f9d6f5580eb2355fba8ef6",
      characterIdsSha256:
        "070e664f88275374348f80e340b2ac1515ed5abe4a0b24029d84baa843f2b87f",
      checkedInRosterReportComparison: { allChecksMatch: true },
    });
    expect(report.boundaries.formula).toEqual({
      source: "repository-authored-team-damagePlans-only",
      derivedFormulaFixturesContributedObservations: false,
      rotationsContributedObservations: false,
    });
    expect(report).toMatchObject({
      supportsGuideClaims: false,
      supportsRecommendations: false,
      supportsRanking: false,
      supportsDamageClaims: false,
      supportsEnergyRecoveryClaims: false,
    });
  });

  it("keeps exact teams atomic and reconstructs every compact row bucket from the ledger", () => {
    expect(report.summary.observationCountsByAxis["exact-team"]).toBe(222);
    const teamObservation = observation(
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:exact-team",
    );
    expect(teamObservation.characterApplicabilities).toHaveLength(4);
    expect(teamObservation.payload).toMatchObject({
      sourceShape: "atomic-exact-team",
      rosterMayNotBeDetached: true,
    });
    expect(
      teamObservation.characterApplicabilities.find(
        ({ characterId }) => characterId === "diona",
      ),
    ).toMatchObject({
      applicability: {
        state: "explicit-range",
        minConstellation: 6,
        maxConstellation: 6,
      },
      basis: "exact-team-member-investment",
    });

    for (const character of report.characters) {
      expect(character.rows).toHaveLength(7);
      for (const row of character.rows) {
        const reconstructed = reconstructRow(character.characterId, row.constellation);
        expect(row.axisStates).toEqual(reconstructed.axisStates);
        expect(row.axisCounts).toEqual(reconstructed.axisCounts);
        expect(row.classificationBucketsSha256).toBe(
          reconstructed.classificationBucketsSha256,
        );
      }
    }
  });

  it("reconstructs global, character, and pinned policy-outcome digests", () => {
    expect(
      sha256Text(
        stableJson({
          axes: CHARACTER_GUIDE_INPUT_COVERAGE_AXES,
          sourceRegistry: report.sourceRegistry,
          sourceProvenance: report.sourceProvenance,
          recordContexts: report.recordContexts,
          observations: report.observations,
          characters: report.characters,
          summary: report.summary,
        }),
      ),
    ).toBe(report.coveragePayloadSha256);

    for (const character of report.characters) {
      const observationIds = report.observations
        .filter(({ characterApplicabilities }) =>
          characterApplicabilities.some(
            ({ characterId }) => characterId === character.characterId,
          ),
        )
        .map(({ observationId }) => observationId)
        .sort();
      expect(sha256Text(stableJson(observationIds))).toBe(
        character.observationIdsSha256,
      );
    }

    const weaponObservation = observation(
      "genshintools-presets:character-guide:furina:weapon:guide-weapon-order",
    );
    if (
      weaponObservation.searchGrammarRepresentability.state !==
      "linked-existing-search-coverage"
    ) {
      throw new Error("Furina weapon-order observation lost policy linkage.");
    }
    const weaponReport =
      fixture.weaponChoiceSearchCoverageReportInput as WeaponChoiceSearchCoverageReport;
    const weaponOutcomes =
      weaponObservation.searchGrammarRepresentability.policyObservationIds.map(
        (policyObservationId) => {
          const match = weaponReport.observations.find(
            ({ observationId }) => observationId === policyObservationId,
          );
          if (!match) throw new Error(`Missing ${policyObservationId}.`);
          return {
            policyObservationId: match.observationId,
            weaponId: match.weaponId,
            requestedRefinement: match.requestedRefinement ?? null,
            weaponIdDomain: match.weaponIdDomain,
            refinementCoverage: match.refinementCoverage,
            nativeTypeCompatibility: match.nativeTypeCompatibility,
          };
        },
      );
    expect(sha256Text(stableJson(weaponOutcomes))).toBe(
      weaponObservation.searchGrammarRepresentability
        .policyOutcomePayloadSha256,
    );

    const artifactObservation = observation(
      "genshintools-presets:character-guide:aino:artifact:build:FwtZU5m",
    );
    if (
      artifactObservation.searchGrammarRepresentability.state !==
      "linked-existing-search-coverage"
    ) {
      throw new Error("Aino artifact observation lost policy linkage.");
    }
    const artifactReport =
      fixture.artifactChoiceSearchCoverageReportInput as ArtifactChoiceSearchCoverageReport;
    const artifactOutcomes =
      artifactObservation.searchGrammarRepresentability.policyObservationIds.map(
        (policyObservationId) => {
          const match = artifactReport.observations.find(
            ({ observationId }) => observationId === policyObservationId,
          );
          if (!match) throw new Error(`Missing ${policyObservationId}.`);
          return {
            policyObservationId: match.observationId,
            artifact: match.artifact,
            outcome: match.outcome,
            failureReason: match.failureReason ?? null,
          };
        },
      );
    expect(sha256Text(stableJson(artifactOutcomes))).toBe(
      artifactObservation.searchGrammarRepresentability
        .policyOutcomePayloadSha256,
    );
    expect(
      report.boundaries.representability
        .policyOutcomePayloadReconstructionRequiresPinnedCoverageReport,
    ).toBe(true);
  });

  it("preserves explicit constellation ranges without turning absent bounds universal", () => {
    const preC2 = observationsForRecord(
      "kqm:character-guide:furina-pre-c2-artifact-main-stats-luna-ii",
    );
    expect(preC2).toHaveLength(4);
    for (const item of preC2) {
      expect(item.characterApplicabilities[0]).toMatchObject({
        applicability: {
          state: "explicit-range",
          minConstellation: 0,
          maxConstellation: 1,
          sourceMinBoundPresent: false,
          sourceMaxBoundPresent: true,
        },
      });
    }
    expect(axisCount("furina", 2, "main-stat", 2)).toBeGreaterThanOrEqual(4);

    const furinaC6 = observationsForRecord(
      "kqm:character-guide:furina-c6-marechaussee-luna-ii",
    );
    expect(furinaC6).toHaveLength(1);
    expect(furinaC6[0]?.characterApplicabilities[0]?.applicability).toMatchObject({
      state: "explicit-range",
      minConstellation: 6,
      maxConstellation: 6,
    });

    const kleeC2 = observationsForRecord(
      "kqm:character-guide:klee-c2-off-field-support-equipment-luna-iv",
    );
    expect(kleeC2.map(({ axis }) => axis).sort()).toEqual([
      "artifact",
      "weapon",
    ]);
    for (const item of kleeC2) {
      expect(item.characterApplicabilities[0]?.applicability).toMatchObject({
        state: "explicit-range",
        minConstellation: 2,
        maxConstellation: 6,
      });
    }

    const baselineBuild = observation(
      "genshintools-presets:character-guide:furina:artifact:build:BQAI0BO",
    );
    expect(baselineBuild.characterApplicabilities[0]).toEqual({
      characterId: "furina",
      applicability: { state: "constellation-unspecified" },
      basis: "source-has-no-constellation-bound",
    });

    const chioriC0 = report.characters
      .find(({ characterId }) => characterId === "chiori")
      ?.rows.find(({ constellation }) => constellation === 0);
    const artifactAxis = CHARACTER_GUIDE_INPUT_COVERAGE_AXES.indexOf("artifact");
    expect(chioriC0?.axisCounts[artifactAxis]).toEqual([0, 5, 1]);
    expect(chioriC0?.axisStates[artifactAxis]).toBe(
      "no-explicit-match-but-has-constellation-unspecified",
    );
  });

  it("keeps the one artifact plan coupled and links every equipment choice to existing search coverage", () => {
    const plans = report.observations.filter(
      ({ inputRepresentability }) =>
        inputRepresentability === "represented-as-coupled-artifact-plan",
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      repositoryRecordId:
        "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example",
      axis: "artifact",
      conditionResolution: "preserved-unresolved-source-conditions",
      payload: {
        sourceShape: "coupled-whole-team-artifact-plan",
        planId: "well-invested-columbina-artifact-delegation",
        assignmentsMayNotBeDetached: true,
      },
      searchGrammarRepresentability: {
        state: "linked-existing-search-coverage",
        policy: "artifact-choice-search-space",
      },
    });
    expect(plans[0]?.characterApplicabilities.map(({ characterId }) => characterId)).toEqual([
      "columbina",
      "sangonomiya_kokomi",
    ]);
    expect(
      (plans[0]?.payload.assignments as unknown[] | undefined)?.length,
    ).toBe(2);
    if (
      plans[0]?.searchGrammarRepresentability.state !==
      "linked-existing-search-coverage"
    ) {
      throw new Error("Coupled plan lost its artifact search linkage.");
    }
    expect(plans[0].searchGrammarRepresentability.policyObservationIds).toHaveLength(2);
    expect(report.boundaries.representability).toMatchObject({
      allEquipmentPolicyObservationsLinked: true,
      weaponCoverageObservationCount: 1008,
      weaponLinkedPolicyObservationCount: 1008,
      artifactCoverageObservationCount: 1068,
      artifactLinkedPolicyObservationCount: 1068,
      weaponOutcomeClassificationCounts: {
        "in-released-candidate-domain|unspecified|compatible": 996,
        "in-released-candidate-domain|unspecified|mismatched": 12,
      },
      artifactOutcomeClassificationCounts: {
        "conditionally-representable": 21,
        "enumerated-initially": 1020,
        "not-representable:non-five-star-filter": 21,
        "not-representable:tier-list-other-filter": 1,
        "not-representable:unmapped-dynamic-half-set-family": 5,
      },
      suitabilityAssessed: false,
      technicalGeneratorOrCalculatorRepresentabilityAssessed: false,
    });
    expect(
      observation(
        "genshintools-presets:character-guide:aino:artifact:build:FwtZU5m",
      ).searchGrammarRepresentability,
    ).toMatchObject({
      state: "linked-existing-search-coverage",
      outcomeClassifications: [
        { classification: "not-representable:non-five-star-filter" },
      ],
    });
  });

  it("pins artifact-policy linkage to the exact recommendation id", () => {
    const repository = clonedRepository();
    const guide = repository.records.find(
      (record) =>
        record.id === "kqm:character-guide:furina-artifact-sets-luna-ii",
    );
    if (!guide || guide.kind !== "character_guide") {
      throw new Error("Missing Furina artifact recommendation fixture.");
    }
    const original = guide.recommendations?.[0];
    if (!original) throw new Error("Missing original artifact recommendation.");
    guide.recommendations?.push({
      ...structuredClone(original),
      id: "second-artifact-recommendation-fixture",
    });

    const changed = buildWithRepository(repository);
    const originalObservation = changed.observations.find(
      ({ observationId }) =>
        observationId ===
        "kqm:character-guide:furina-artifact-sets-luna-ii:artifact:recommendation:off-field-artifact-sets:group:0",
    );
    const secondObservation = changed.observations.find(
      ({ observationId }) =>
        observationId ===
        "kqm:character-guide:furina-artifact-sets-luna-ii:artifact:recommendation:second-artifact-recommendation-fixture:group:0",
    );
    if (
      originalObservation?.searchGrammarRepresentability.state !==
        "linked-existing-search-coverage" ||
      secondObservation?.searchGrammarRepresentability.state !==
        "linked-existing-search-coverage"
    ) {
      throw new Error("Synthetic recommendation linkage was not retained.");
    }
    expect(originalObservation.searchGrammarRepresentability.policyObservationIds).toEqual([
      "kqm:character-guide:furina-artifact-sets-luna-ii:recommendation:off-field-artifact-sets:0:0",
    ]);
    expect(secondObservation.searchGrammarRepresentability.policyObservationIds).toEqual([
      "kqm:character-guide:furina-artifact-sets-luna-ii:recommendation:second-artifact-recommendation-fixture:0:0",
    ]);
  });

  it("attaches registry and exact manual-review metadata without promoting candidate evidence", () => {
    const kqm = report.sourceRegistry.find(({ id }) => id === "kqm");
    expect(kqm).toMatchObject({
      kind: "editorial",
      status: "active",
      ingestionMode: "manual-observation",
      permission: "unknown",
    });
    const provenance = report.sourceProvenance.find(
      ({ provenanceId }) =>
        provenanceId === "kqm:furina-c6-marechaussee-luna-ii",
    );
    expect(provenance?.manualExtraction).toMatchObject({
      state: "matched-indexed-manual-record",
      method: "agent-assisted",
      reviewStatus: "unreviewed",
    });
    const context = report.recordContexts.find(
      ({ repositoryRecordId }) =>
        repositoryRecordId ===
        "kqm:character-guide:furina-c6-marechaussee-luna-ii",
    );
    expect(context).toMatchObject({
      repositoryRecordStatus: "candidate",
      promotionEligibility: "explicitly-ineligible",
    });
    const baseline = report.recordContexts.find(
      ({ repositoryRecordId }) =>
        repositoryRecordId === "genshintools-presets:character-guide:furina",
    );
    expect(baseline?.promotionEligibility).toBe("unspecified");
    const upstreamKqmRecordCount = fixture.manualSnapshotInputs.reduce(
      (count, input) =>
        count + ManualObservationSnapshotSchema.parse(input.snapshot).records.length,
      0,
    );
    expect(upstreamKqmRecordCount).toBe(57);
    expect(
      report.sourceProvenance.filter(({ sourceId }) => sourceId === "kqm"),
    ).toHaveLength(56);
    expect(
      report.recordContexts.some(
        ({ repositoryRecordKind }) =>
          (repositoryRecordKind as string) === "energy_guidance",
      ),
    ).toBe(false);
  });

  it("authenticates supplied registry and manual objects against exact source-file bytes", () => {
    const changedRegistry = structuredClone(fixture) as Fixture;
    const registry = SourceRegistrySchema.parse(changedRegistry.sourceRegistryInput);
    const kqm = registry.sources.find(({ id }) => id === "kqm");
    if (!kqm) throw new Error("Missing KQM registry fixture.");
    kqm.permission = "internal";
    changedRegistry.sourceRegistryInput = registry;
    expect(() => buildCharacterGuideInputCoverageReport(changedRegistry)).toThrow(
      /Source registry object does not match authenticated source-registry bytes/,
    );

    const changedManual = structuredClone(fixture) as Fixture;
    const manual = changedManual.manualSnapshotInputs.find(({ snapshotFile }) =>
      snapshotFile.path.endsWith("kqm-furina-manual.json"),
    );
    if (!manual) throw new Error("Missing Furina manual snapshot fixture.");
    const snapshot = ManualObservationSnapshotSchema.parse(manual.snapshot);
    snapshot.records[0].extraction.method = "manual";
    manual.snapshot = snapshot;
    expect(() => buildCharacterGuideInputCoverageReport(changedManual)).toThrow(
      /Manual snapshot object .* does not match authenticated input bytes/,
    );
  });

  it("rejects a rebound but incomplete dependent search-coverage report", () => {
    const changed = structuredClone(fixture) as Fixture;
    const artifactReport = changed.artifactChoiceSearchCoverageReportInput as {
      generatedFrom: Array<{ path: string; sha256: string }>;
    };
    artifactReport.generatedFrom.pop();
    replaceGeneratedHash(
      changed.generatedFrom,
      ARTIFACT_REPORT_RELATIVE_PATH,
      sha256Text(stableJson(artifactReport)),
    );
    expect(() => buildCharacterGuideInputCoverageReport(changed)).toThrow(
      /artifact-choice-search-coverage\.json has an incomplete generatedFrom boundary/,
    );
  });

  it("is invariant to ER-only fields while retaining ordinary er stat observations", () => {
    const repository = clonedRepository();
    const team = repository.records.find(
      (record) => record.kind === "team" && record.status === "baseline",
    );
    if (!team || team.kind !== "team") {
      throw new Error("Missing baseline team fixture.");
    }
    team.members[0] = {
      ...team.members[0],
      erFloorPercent: 321,
      erTargets: [
        {
          minPercent: 222,
          maxPercent: 333,
          weapon: { type: "specific", weaponIds: ["favonius_sword"] },
          conditions: ["ER-only invariance fixture"],
          assumptions: ["Not a guide input axis"],
        },
      ],
    };
    team.rotations = [
      {
        id: "er-only-rotation-fixture",
        label: "ER-only fixture",
        notation: "A > B",
        unresolvedSegments: ["sequence intentionally ignored"],
        assumptions: [],
      },
    ];
    const energy = repository.records.find(
      (record) => record.kind === "energy_guidance",
    );
    if (!energy) throw new Error("Missing energy-guidance fixture.");
    energy.targets[0] = {
      ...energy.targets[0],
      conditions: ["Mutated ER-only condition"],
    };

    const changed = buildWithRepository(repository);
    expect(changed.coveragePayloadSha256).toBe(report.coveragePayloadSha256);
    expect(changed.summary.ordinaryErStatTokenObservationCount).toBeGreaterThan(0);
    expect(changed.boundaries.energyRecoveryExclusion).toEqual(
      report.boundaries.energyRecoveryExclusion,
    );
    expect(stableJson(changed)).not.toContain("ER-only invariance fixture");
    expect(stableJson(changed)).not.toContain("Mutated ER-only condition");
    const preservedFreeText = observation(
      "kqm:character-guide:furina-contextual-weapons-luna-ii:weapon:recommendation:contextual-weapons:group:0",
    );
    expect(preservedFreeText.sourceConditions).toContain(
      "Prioritize Furina's personal damage after meeting the rotation-specific energy requirement.",
    );
    expect(
      changed.boundaries.energyRecoveryExclusion
        .freeTextSourceConditionsMayMentionEnergyRequirements,
    ).toBe(true);
  });

  it("excludes rejected records and never turns source order or weights into inferred rank", () => {
    const rejectedRepository = clonedRepository();
    const source = rejectedRepository.records.find(
      (record) =>
        record.id ===
        "kqm:character-guide:klee-generalist-best-five-star-weapon-luna-iv",
    );
    if (!source) throw new Error("Missing rejected-record fixture source.");
    rejectedRepository.records.push({
      ...structuredClone(source),
      id: "test:character-guide:rejected-coverage-fixture",
      status: "rejected",
    });
    const rejected = buildWithRepository(rejectedRepository);
    expect(rejected.coveragePayloadSha256).toBe(report.coveragePayloadSha256);
    expect(rejected.boundaries.repository).toMatchObject({
      rejectedRecordCount: 1,
      rejectedRecordsContributedObservationCount: 0,
    });
    expect(stableJson(rejected.observations)).not.toContain(
      "test:character-guide:rejected-coverage-fixture",
    );

    const statArrayReorderedRepository = clonedRepository();
    const furina = requiredGuide(statArrayReorderedRepository, "furina");
    for (const build of furina.builds) {
      build.sands.reverse();
      build.goblet.reverse();
      build.circlet.reverse();
      build.substats.reverse();
    }
    const statArrayReordered = buildWithRepository(statArrayReorderedRepository);
    expect(statArrayReordered.coveragePayloadSha256).toBe(
      report.coveragePayloadSha256,
    );
    expect(statArrayReordered.boundaries.ordering).toMatchObject({
      plainSourceArrayOrderUsedAsRank: false,
      explicitRankedGroupMetadataPreservedButNotEvaluated: true,
      numericStatWeightsPreservedButNotInterpretedAsRank: true,
      unrecognizedSourceMetadataMayBeOmitted: true,
    });

    const weaponOrderReorderedRepository = clonedRepository();
    requiredGuide(weaponOrderReorderedRepository, "furina").weaponOrder?.reverse();
    const weaponOrderReordered = buildWithRepository(
      weaponOrderReorderedRepository,
    );
    const baselineWeaponOrder = observation(
      "genshintools-presets:character-guide:furina:weapon:guide-weapon-order",
    );
    const reorderedWeaponOrder = weaponOrderReordered.observations.find(
      ({ observationId }) => observationId === baselineWeaponOrder.observationId,
    );
    expect(reorderedWeaponOrder?.payload).toEqual(baselineWeaponOrder.payload);
    expect(reorderedWeaponOrder?.searchGrammarRepresentability).toMatchObject({
      state: "linked-existing-search-coverage",
      rankingAssessed: false,
    });
    expect(weaponOrderReordered.coveragePayloadSha256).not.toBe(
      report.coveragePayloadSha256,
    );
    expect(stableJson(reorderedWeaponOrder)).not.toContain('"rank":');

    const explicitRanking = observation(
      "kqm:character-guide:keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i:weapon:recommendation:lunar-charged-equal-refinement-four-star-ranking:group:1",
    );
    expect(explicitRanking.payload).toMatchObject({
      sourceOrderingDeclaration: "ranked-groups",
      groupIndex: 1,
      grouping: "single",
    });
    expect(explicitRanking.searchGrammarRepresentability).toMatchObject({
      state: "linked-existing-search-coverage",
      rankingAssessed: false,
    });
    expect(stableJson(explicitRanking)).not.toContain('"winner"');
  });

  it("preserves authored numeric weights as values without interpreting them as ordinal rank", () => {
    const repository = clonedRepository();
    const furina = requiredGuide(repository, "furina");
    const build = furina.builds.find(
      ({ sourceRecordId }) => sourceRecordId === "BQAI0BO",
    );
    const er = build?.substats.find(({ stat }) => stat === "er");
    if (!er) throw new Error("Missing Furina ER weighted-stat fixture.");
    er.weight = 51;

    const changed = buildWithRepository(repository);
    expect(changed.coveragePayloadSha256).not.toBe(report.coveragePayloadSha256);
    const observation = changed.observations.find(
      ({ observationId }) =>
        observationId ===
        "genshintools-presets:character-guide:furina:substat:build:BQAI0BO",
    );
    expect(observation?.payload).toMatchObject({
      numericWeightsInterpretedAsOrdinalRank: false,
      weightedStats: expect.arrayContaining([{ statId: "er", weight: 51 }]),
    });
    expect(stableJson(observation)).not.toContain('"rank":');
  });

  it("observes only repository-authored damage-plan formulas without executing or promoting them", () => {
    const repository = clonedRepository();
    const team = repository.records.find(
      (record) =>
        record.id ===
        "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt",
    );
    if (!team || team.kind !== "team") {
      throw new Error("Missing formula-axis team fixture.");
    }
    team.damagePlans = [
      {
        id: "repository-authored-formula-fixture",
        label: "Repository-authored test plan",
        durationSeconds: 20,
        lines: [
          {
            characterId: "diona",
            formulaId: "diona.test.formula",
            count: 3,
          },
        ],
      },
    ];

    const changed = buildWithRepository(repository);
    const formulas = changed.observations.filter(({ axis }) => axis === "formula");
    expect(formulas).toHaveLength(1);
    expect(formulas[0]).toMatchObject({
      repositoryRecordId: team.id,
      characterApplicabilities: [
        {
          characterId: "diona",
          applicability: {
            state: "explicit-range",
            minConstellation: 6,
            maxConstellation: 6,
          },
          basis: "exact-team-member-investment",
        },
      ],
      payload: {
        sourceShape: "repository-authored-team-damage-plan-line",
        damagePlanId: "repository-authored-formula-fixture",
        durationSeconds: 20,
        formulaId: "diona.test.formula",
        count: 3,
        formulaExecuted: false,
      },
      searchGrammarRepresentability: { state: "not-applicable" },
    });
    expect(changed.summary.repositoryAuthoredDamagePlanObservationCount).toBe(1);
    expect(changed.boundaries.formula).toEqual({
      source: "repository-authored-team-damagePlans-only",
      derivedFormulaFixturesContributedObservations: false,
      rotationsContributedObservations: false,
    });
    expect(changed.supportsGuideClaims).toBe(false);
    expect(changed.supportsDamageClaims).toBe(false);
    expect(stableJson(formulas)).not.toContain("derived");
  });
});

async function loadFixture(): Promise<Fixture> {
  const [
    repositoryInput,
    sourceRegistryInput,
    manualIndexInput,
    checkedInRosterReportInput,
    weaponChoiceSearchCoverageReportInput,
    artifactChoiceSearchCoverageReportInput,
    catalogs,
    generatedFrom,
    sourceFiles,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
    readJson(WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH),
    readJson(ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH),
    loadGameCatalogs(),
    Promise.all(
      CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS.map(async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      })),
    ),
    Promise.all(
      CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
  ]);
  const manualSnapshotInputs = await loadManualSnapshotInputs(
    manualIndexInput,
    sourceRegistryInput,
  );
  return {
    repositoryInput,
    sourceRegistryInput,
    manualSnapshotInputs,
    sourceFiles,
    releasedCharacters: buildReleasedGuideDomainCatalog(
      characters.map(({ id }) => id),
      catalogs.characterElements,
    ),
    checkedInRosterReportInput,
    weaponChoiceSearchCoverageReportInput,
    artifactChoiceSearchCoverageReportInput,
    generatedFrom,
  };
}

function clonedRepository(): KnowledgeRepository {
  return KnowledgeRepositorySchema.parse(structuredClone(fixture.repositoryInput));
}

function buildWithRepository(
  repository: KnowledgeRepository,
): CharacterGuideInputCoverageReport {
  const changed = structuredClone(fixture) as Fixture;
  changed.repositoryInput = repository;
  const repositorySha256 = sha256Text(stableJson(repository));
  replaceGeneratedHash(changed.generatedFrom, REPOSITORY_RELATIVE_PATH, repositorySha256);
  const weaponInput = changed.weaponChoiceSearchCoverageReportInput as {
    generatedFrom: Array<{ path: string; sha256: string }>;
  };
  replaceGeneratedHash(
    weaponInput.generatedFrom,
    REPOSITORY_RELATIVE_PATH,
    repositorySha256,
  );
  changed.weaponChoiceSearchCoverageReportInput =
    buildWeaponChoiceSearchCoverageReport(repository, weaponInput.generatedFrom);
  replaceGeneratedHash(
    changed.generatedFrom,
    WEAPON_REPORT_RELATIVE_PATH,
    sha256Text(stableJson(changed.weaponChoiceSearchCoverageReportInput)),
  );

  const artifactInput = changed.artifactChoiceSearchCoverageReportInput as {
    generatedFrom: Array<{ path: string; sha256: string }>;
  };
  replaceGeneratedHash(
    artifactInput.generatedFrom,
    REPOSITORY_RELATIVE_PATH,
    repositorySha256,
  );
  changed.artifactChoiceSearchCoverageReportInput =
    buildArtifactChoiceSearchCoverageReport(
      repository,
      artifactInput.generatedFrom,
    );
  replaceGeneratedHash(
    changed.generatedFrom,
    ARTIFACT_REPORT_RELATIVE_PATH,
    sha256Text(stableJson(changed.artifactChoiceSearchCoverageReportInput)),
  );
  return buildCharacterGuideInputCoverageReport(changed);
}

function replaceGeneratedHash(
  files: readonly { path: string; sha256: string }[],
  relativePath: string,
  sha256: string,
): void {
  const file = files.find(({ path }) => path === relativePath);
  if (!file) throw new Error(`Missing generatedFrom fixture ${relativePath}.`);
  file.sha256 = sha256;
}

function requiredGuide(repository: KnowledgeRepository, characterId: string) {
  const guide = repository.records.find(
    (record) =>
      record.kind === "character_guide" &&
      record.status === "baseline" &&
      record.characterId === characterId,
  );
  if (!guide || guide.kind !== "character_guide") {
    throw new Error(`Missing ${characterId} guide fixture.`);
  }
  return guide;
}

function observation(observationId: string): CharacterGuideInputObservation {
  const match = report.observations.find(
    (candidate) => candidate.observationId === observationId,
  );
  if (!match) throw new Error(`Missing observation ${observationId}.`);
  return match;
}

function observationsForRecord(recordId: string): CharacterGuideInputObservation[] {
  return report.observations.filter(
    ({ repositoryRecordId }) => repositoryRecordId === recordId,
  );
}

function axisCount(
  characterId: string,
  constellation: number,
  axis: CharacterGuideInputCoverageAxis,
  bucketIndex: 0 | 1 | 2,
): number {
  const character = report.characters.find(
    (candidate) => candidate.characterId === characterId,
  );
  const row = character?.rows.find(
    (candidate) => candidate.constellation === constellation,
  );
  const axisIndex = CHARACTER_GUIDE_INPUT_COVERAGE_AXES.indexOf(axis);
  if (!row || axisIndex < 0) throw new Error(`Missing ${characterId} C${constellation}.`);
  return row.axisCounts[axisIndex]?.[bucketIndex] ?? 0;
}

function reconstructRow(characterId: string, constellation: number) {
  const cells = CHARACTER_GUIDE_INPUT_COVERAGE_AXES.map((axis) => {
    const explicitMatchObservationIds: string[] = [];
    const constellationUnspecifiedObservationIds: string[] = [];
    const explicitlyOutOfRangeObservationIds: string[] = [];
    for (const item of report.observations) {
      if (item.axis !== axis) continue;
      const applicability = item.characterApplicabilities.find(
        (candidate) => candidate.characterId === characterId,
      )?.applicability;
      if (!applicability) continue;
      if (applicability.state === "constellation-unspecified") {
        constellationUnspecifiedObservationIds.push(item.observationId);
      } else if (
        constellation >= applicability.minConstellation &&
        constellation <= applicability.maxConstellation
      ) {
        explicitMatchObservationIds.push(item.observationId);
      } else {
        explicitlyOutOfRangeObservationIds.push(item.observationId);
      }
    }
    explicitMatchObservationIds.sort();
    constellationUnspecifiedObservationIds.sort();
    explicitlyOutOfRangeObservationIds.sort();
    const state =
      explicitMatchObservationIds.length > 0
        ? "has-explicit-constellation-match"
        : constellationUnspecifiedObservationIds.length > 0
          ? "no-explicit-match-but-has-constellation-unspecified"
          : explicitlyOutOfRangeObservationIds.length > 0
            ? "only-explicitly-out-of-range"
            : "not-observed";
    return {
      state,
      counts: [
        explicitMatchObservationIds.length,
        constellationUnspecifiedObservationIds.length,
        explicitlyOutOfRangeObservationIds.length,
      ] as [number, number, number],
      sha256: sha256Text(
        stableJson({
          explicitMatchObservationIds,
          constellationUnspecifiedObservationIds,
          explicitlyOutOfRangeObservationIds,
        }),
      ),
    };
  });
  return {
    axisStates: cells.map(({ state }) => state),
    axisCounts: cells.map(({ counts }) => counts),
    classificationBucketsSha256: sha256Text(
      stableJson(cells.map(({ sha256 }) => sha256)),
    ),
  };
}
