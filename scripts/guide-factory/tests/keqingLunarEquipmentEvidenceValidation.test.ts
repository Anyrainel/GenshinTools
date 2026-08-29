import characterStatsInput from "@/data/game/character_stats.json";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildKeqingLunarEquipmentEvidenceValidationReport,
  deriveKeqingLunarEvidenceClaimSafety,
  keqingLunarEvidenceClaimSafetyPermitsComparability,
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_RECORD_SOURCE_IDS,
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS,
  KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS,
  type KeqingLunarEquipmentEvidenceClaim,
} from "../src/keqingLunarEquipmentEvidenceValidation";
import {
  KEQING_ROLE_PAIR_PAGE_URL,
  KEQING_ROLE_PAIR_TARGET_TEAM_IDS,
} from "../src/keqingSourceScopedRolePairSample";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  loadManualSnapshotInputs,
  type ManualSnapshotInput,
} from "../src/manualSnapshots";
import {
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
} from "../src/paths";
import {
  type KnowledgeRecord,
  type KnowledgeRepository,
  KnowledgeRepositorySchema,
  type ManualObservationSnapshot,
  ManualObservationSnapshotSchema,
} from "../src/schemas";

describe("Keqing Lunar equipment evidence structural validation", () => {
  it("acknowledges exact roster conditions across four published teams without generating recommendations", async () => {
    const fixture = await loadFixture();
    const repositoryBefore = structuredClone(fixture.repository);
    const manualInputsBefore = structuredClone(fixture.manualInputs);
    const generatedFrom = await hashInputs();
    const durable = await readJson(
      KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
    );

    const report = buildKeqingLunarEquipmentEvidenceValidationReport(
      fixture.repository,
      fixture.manualInputs,
      generatedFrom,
    );
    const repeated = buildKeqingLunarEquipmentEvidenceValidationReport(
      fixture.repository,
      fixture.manualInputs,
      generatedFrom,
    );

    expect(repeated).toEqual(report);
    expect(durable).toEqual(report);
    expect(fixture.repository).toEqual(repositoryBefore);
    expect(fixture.manualInputs).toEqual(manualInputsBefore);
    expect(report.validationStatus).toBe("comparable");
    expect(report.sourceBoundary).toMatchObject({
      sourceId: "kqm",
      expectedCapturedAt: "2026-08-29",
      observedCapturedAt: "2026-08-29",
      pageMatchesExpectation: true,
      expectedParticipatingRecordCount: 17,
      observedSnapshotRecordCount: 24,
      allRecordsPresentExactlyOnce: true,
      allExtractionStatesMatch: true,
      allManualPayloadsMatch: true,
      allRepositoryPayloadsMatch: true,
      allRepositoryRecommendationsMatchManual: true,
      allRepositoryStatesMatch: true,
      allRepositoryPagesMatch: true,
    });
    expect(report.sourceBoundary.expectedPage).toEqual({
      title: "Keqing Quick Guide",
      url: KEQING_ROLE_PAIR_PAGE_URL,
      publisher: "KeqingMains",
      sourceVersion: "Luna I",
      attributionNote:
        "KQM asks readers to link the original guide when using it as a content reference; this snapshot stores narrow paraphrased claims and source locators.",
    });
    expect(report.sourceBoundary.records).toHaveLength(17);
    expect(
      report.sourceBoundary.records.map(({ sourceRecordId }) => sourceRecordId),
    ).toEqual([...KEQING_LUNAR_EQUIPMENT_EVIDENCE_RECORD_SOURCE_IDS]);
    expect(
      report.sourceBoundary.records.every(
        (record) =>
          record.manualOccurrenceCount === 1 &&
          record.repositoryOccurrenceCount === 1 &&
          record.extractionMethod === "agent-assisted" &&
          record.reviewStatus === "unreviewed" &&
          record.manualPayloadMatchesExpectation &&
          record.repositoryPayloadMatchesExpectation &&
          record.repositoryRecommendationMatchesManual &&
          record.repositoryStateMatchesExpectation &&
          record.repositoryUsesExactPage,
      ),
    ).toBe(true);

    expect(report.baselineBoundary).toEqual({
      guideId: "genshintools-presets:character-guide:keqing",
      expectedStatus: "baseline",
      buildSourceRecordId: "1WswsAu",
      expectedWeaponOrder: ["mistsplitter_reforged"],
      guidePresentExactlyOnce: true,
      guideStatusMatches: true,
      characterMatches: true,
      weaponOrderMatchesExactly: true,
      buildPresentExactlyOnce: true,
      buildPayloadMatchesExactly: true,
      allChecksMatch: true,
    });
    expect(report.baselineComparison).toEqual({
      classification: "structural-source-vs-baseline-observations",
      candidateSourceRecordsUsedAsGenerationInputs: false,
      comparisonProducesRecommendationOrRank: false,
      defaultMainStatCoverage: {
        sourceRecordId:
          "keqing-lunar-charged-default-artifact-stats-luna-i",
        baselineBuildSourceRecordId: "1WswsAu",
        sands: {
          baselineStatIds: ["atk%"],
          sourceObservedStatIds: ["atk%"],
          sourceConditionalStatIds: [],
          allBaselineStatIdsCovered: true,
        },
        goblet: {
          baselineStatIds: ["electro%"],
          sourceObservedStatIds: ["atk%", "electro%"],
          sourceConditionalStatIds: [],
          allBaselineStatIdsCovered: true,
        },
        circlet: {
          baselineStatIds: ["cd", "cr"],
          sourceObservedStatIds: ["cd", "cr"],
          sourceConditionalStatIds: ["cr"],
          allBaselineStatIdsCovered: true,
        },
        allBaselineMainStatsCoveredBySourceObservation: true,
      },
      conditionalAtkGoblet: {
        sourceRecordId:
          "keqing-lunar-charged-high-buff-goblet-stats-luna-i",
        sourceCondition: KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.highBuff,
        sourceIncludesAtkGoblet: true,
        baselineIncludesAtkGoblet: false,
        relation: "not-established-by-baseline",
      },
      substatPriority: {
        sourceRecordId:
          "keqing-lunar-charged-default-artifact-stats-luna-i",
        baselinePriorityGroups: [["cd", "cr"], ["atk%", "em"]],
        sourcePriorityGroups: [["cr", "cd"], ["atk%"], ["em"]],
        sharedStatIds: ["atk%", "cd", "cr", "em"],
        relation: "explicit-partial-order-disagreement",
        disagreements: [
          {
            higherStatId: "atk%",
            lowerStatId: "em",
            baselineRelation: "tied",
            sourceRelation: "higher-priority",
          },
        ],
        interpretedAsValidationError: false,
      },
      generalWeapon: {
        sourceRecordId:
          "keqing-lunar-charged-general-mistsplitter-luna-i",
        baselineWeaponOrder: ["mistsplitter_reforged"],
        sourceWeaponIds: ["mistsplitter_reforged"],
        exactStructuralMatch: true,
      },
      baselineArtifact: {
        baselineArtifact: { type: "4pc", setId: "thundering_fury" },
        sourceRecordId:
          "keqing-lunar-charged-top-contributor-artifact-options-luna-i",
        sourceListsBaselineArtifact: true,
        sourceConditionResolutionAcrossTargets: [
          "withheld-unresolved-source-condition",
          "withheld-unresolved-source-condition",
          "withheld-unresolved-source-condition",
          "withheld-unresolved-source-condition",
        ],
        relation:
          "source-observed-only-under-unresolved-top-contributor-condition",
        traditionalSourceRecordId:
          "keqing-lunar-charged-traditional-artifact-options-luna-i",
        sourceTraditionalRecordListsBaselineArtifact: false,
        authoredTraditionalMappingInstalled: false,
        directContradictionClaimed: false,
      },
    });

    expect(report.publishedTeamBoundary).toMatchObject({
      expectedTargetCount: 4,
      targetTeamIds: [...KEQING_ROLE_PAIR_TARGET_TEAM_IDS],
      allTargetsMatchExpectation: true,
    });
    expect(report.publishedTeamBoundary.targets).toEqual([
      expect.objectContaining({
        teamRecordId: KEQING_ROLE_PAIR_TARGET_TEAM_IDS[0],
        characterIds: ["keqing", "ineffa", "aino", "sucrose"],
        nodKraiCharacterIds: ["ineffa", "aino"],
        nodKraiCharacterCount: 2,
        containsFurina: false,
        containsAino: true,
        matchesExpectedBoundary: true,
      }),
      expect.objectContaining({
        teamRecordId: KEQING_ROLE_PAIR_TARGET_TEAM_IDS[1],
        characterIds: ["keqing", "ineffa", "furina", "jean"],
        nodKraiCharacterIds: ["ineffa"],
        nodKraiCharacterCount: 1,
        containsFurina: true,
        containsAino: false,
        matchesExpectedBoundary: true,
      }),
      expect.objectContaining({
        teamRecordId: KEQING_ROLE_PAIR_TARGET_TEAM_IDS[2],
        characterIds: ["keqing", "ineffa", "furina", "xilonen"],
        nodKraiCharacterIds: ["ineffa"],
        nodKraiCharacterCount: 1,
        containsFurina: true,
        containsAino: false,
        matchesExpectedBoundary: true,
      }),
      expect.objectContaining({
        teamRecordId: KEQING_ROLE_PAIR_TARGET_TEAM_IDS[3],
        characterIds: [
          "keqing",
          "ineffa",
          "yelan",
          "kaedehara_kazuha",
        ],
        nodKraiCharacterIds: ["ineffa"],
        nodKraiCharacterCount: 1,
        containsFurina: false,
        containsAino: false,
        matchesExpectedBoundary: true,
      }),
    ]);
    expect(
      report.publishedTeamBoundary.targets.every(
        (target) =>
          target.recordsLunarCharged &&
          target.declaredLunarChargedFactsMatch &&
          target.containsKeqing &&
          target.containsIneffa &&
          target.allInvestmentsUnspecified &&
          target.allEquipmentUnselected &&
          target.sourceStatus === "candidate" &&
          target.promotionEligible === false &&
          target.intent === "example" &&
          target.rankingClaim === "none" &&
          target.sourcePageMatches,
      ),
    ).toBe(true);

    expect(report.sourceConditionBoundary).toEqual({
      mappingKind: "wrapper-authored-exact-text-acknowledgement",
      rosterAndDeclaredReactionFactsOnly: true,
      buildGameplayAndRefinementConditionsRemainUnresolved: true,
      distinctSourceConditionCount: 16,
      mappedSourceConditionCount: 16,
      unmappedSourceConditions: [],
      allSourceConditionsMappedExactly: true,
      gameplayBuildAndRefinementAcknowledgementCount: 96,
      matchedGameplayBuildOrRefinementAcknowledgementCount: 0,
      allowedRosterKnownFalseConjunctCount: 2,
      allowedRosterKnownFalseConjunctTeamIds: [
        KEQING_ROLE_PAIR_TARGET_TEAM_IDS[1],
        KEQING_ROLE_PAIR_TARGET_TEAM_IDS[2],
      ],
      expectedRosterKnownFalseConjunctTeamIds: [
        KEQING_ROLE_PAIR_TARGET_TEAM_IDS[1],
        KEQING_ROLE_PAIR_TARGET_TEAM_IDS[2],
      ],
      allowedRosterKnownFalseConjunctTeamsMatchExpectation: true,
      unexpectedGameplayBuildOrRefinementResolutionCount: 0,
    });
    expect(KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.lunarCharged).toBe(
      "Keqing is used in a Lunar-Charged team.",
    );
    expect(
      report.claims.every(
        ({ roles, sourceConditions }) =>
          stableJson(roles) === stableJson(["dps"]) &&
          sourceConditions.every((condition) => !condition.includes("on-field")),
      ),
    ).toBe(true);
    expect(stableJson(report)).not.toContain("on-field");
    expect(report.claims).toHaveLength(42);
    expect(report.claims.every((claim) => claim.teamResolutions.length === 4)).toBe(
      true,
    );
    expect(countResolutions(report.claims)).toEqual({
      "matched-by-exact-team-facts": 70,
      "not-matched-by-exact-team-facts": 8,
      "withheld-unresolved-source-condition": 90,
    });

    expect(
      findClaim(
        report.claims,
        "keqing-lunar-charged-furina-marechaussee-hunter-luna-i",
        "artifact",
        0,
        0,
      ).teamResolutions.map(({ resolution }) => resolution),
    ).toEqual([
      "not-matched-by-exact-team-facts",
      "matched-by-exact-team-facts",
      "matched-by-exact-team-facts",
      "not-matched-by-exact-team-facts",
    ]);
    expect(
      findClaim(
        report.claims,
        "keqing-lunar-charged-notsu-contexts-luna-i",
        "artifact",
        0,
        0,
      ).teamResolutions.map(({ resolution }) => resolution),
    ).toEqual([
      "not-matched-by-exact-team-facts",
      "matched-by-exact-team-facts",
      "matched-by-exact-team-facts",
      "matched-by-exact-team-facts",
    ]);
    expect(
      findClaim(
        report.claims,
        "keqing-lunar-charged-notsu-contexts-luna-i",
        "artifact",
        1,
        0,
      ).teamResolutions.map(({ resolution }) => resolution),
    ).toEqual([
      "matched-by-exact-team-facts",
      "not-matched-by-exact-team-facts",
      "not-matched-by-exact-team-facts",
      "not-matched-by-exact-team-facts",
    ]);
    expect(
      findClaim(
        report.claims,
        "keqing-lunar-charged-general-mistsplitter-luna-i",
        "weapon",
        0,
        0,
      ).teamResolutions.every(
        ({ resolution }) => resolution === "matched-by-exact-team-facts",
      ),
    ).toBe(true);
    expect(
      findClaim(
        report.claims,
        "keqing-lunar-charged-harbinger-of-dawn-availability-luna-i",
        "weapon",
        0,
        0,
      ).teamResolutions.map(({ resolution }) => resolution),
    ).toEqual([
      "withheld-unresolved-source-condition",
      "not-matched-by-exact-team-facts",
      "not-matched-by-exact-team-facts",
      "withheld-unresolved-source-condition",
    ]);

    const gameplayAndBuildConditions = new Set<string>([
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.traditional,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.topLunarCharged,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.highBuff,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.exceptionalElementalMastery,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.ineffaShield,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.finaleR5,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.finaleBondCleared,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.equalRefinement,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.critRateDoesNotOvercap,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.eshuFullShield,
      KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.noBetterWeapon,
    ]);
    for (const claim of report.claims) {
      for (const [conditionIndex, condition] of claim.sourceConditions.entries()) {
        if (!gameplayAndBuildConditions.has(condition)) continue;
        expect(
          claim.teamResolutions.every(
            ({ conditionAcknowledgements }) =>
              conditionAcknowledgements[conditionIndex]?.resolution ===
              "withheld-unresolved-source-condition",
          ),
        ).toBe(true);
      }
    }

    expect(report.searchCoverageBoundary).toEqual({
      candidateDomainUse: "read-only-coverage-cross-reference-only",
      equipmentClaimCount: 30,
      weaponClaimCount: 21,
      artifactClaimCount: 9,
      exactCoverageReferenceCount: 30,
      allEquipmentClaimsHaveExactlyOneCoverageReference: true,
      allWeaponIdsInReleasedCandidateDomain: true,
      allWeaponNativeTypesCompatible: true,
      allArtifactsRepresentable: false,
      sourceRefinementInferenceCount: 0,
      sourceRefinementsInferred: false,
    });
    const weaponClaims = report.claims.filter(
      ({ searchCoverage }) =>
        searchCoverage.kind === "weapon-search-coverage",
    );
    expect(weaponClaims).toHaveLength(21);
    expect(
      weaponClaims.every(
        ({ searchCoverage }) =>
          searchCoverage.kind === "weapon-search-coverage" &&
          searchCoverage.refinementCoverageOutcome === "unspecified",
      ),
    ).toBe(true);
    const unrepresentableArtifactClaims = report.claims.filter(
      ({ searchCoverage }) =>
        searchCoverage.kind === "artifact-search-coverage" &&
        searchCoverage.outcome === "not-representable",
    );
    expect(unrepresentableArtifactClaims).toHaveLength(4);
    expect(
      unrepresentableArtifactClaims.map(({ searchCoverage }) =>
        searchCoverage.kind === "artifact-search-coverage"
          ? searchCoverage.failureReason
          : null,
      ),
    ).toEqual([
      "tier-list-other-filter",
      "unmapped-dynamic-half-set-family",
      "unmapped-dynamic-half-set-family",
      "unmapped-dynamic-half-set-family",
    ]);

    const jadeClaims = report.claims.filter(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-lunar-charged-traditional-jade-cutter-ranking-luna-i",
    );
    expect(
      jadeClaims.map(({ sourceClaim }) =>
        sourceClaim.kind === "weapon"
          ? {
              weaponId: sourceClaim.weaponId,
              groupIndex: sourceClaim.groupIndex,
              ordering: sourceClaim.recommendationOrdering,
              grouping: sourceClaim.grouping,
            }
          : null,
      ),
    ).toEqual([
      {
        weaponId: "primordial_jade_cutter",
        groupIndex: 0,
        ordering: "ranked-groups",
        grouping: "single",
      },
      {
        weaponId: "mistsplitter_reforged",
        groupIndex: 1,
        ordering: "ranked-groups",
        grouping: "single",
      },
    ]);
    const otherFiveStarCritClaims = report.claims.filter(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-lunar-charged-other-five-star-crit-options-luna-i",
    );
    expect(otherFiveStarCritClaims).toHaveLength(5);
    expect(
      otherFiveStarCritClaims.every(
        ({ sourceClaim }) =>
          sourceClaim.kind === "weapon" &&
          sourceClaim.recommendationOrdering === "unranked" &&
          sourceClaim.grouping === "alternatives" &&
          sourceClaim.weaponId !== "mistsplitter_reforged",
      ),
    ).toBe(true);
    expect(report.cautions).toContain(
      "V1 recommendation ordering is record-local; no cross-record ordering between the Other 5-star CRIT options and Mistsplitter is represented or inferred.",
    );
    expect(report.cautions).toContain(
      "V1 cannot encode only Splendor of Tranquil Waters as worst within its five-option group or only the 2pc Marechaussee Hunter mixed combinations as weakest without over-ranking sibling alternatives; both remain explicit source-fidelity gaps, not report ranks.",
    );
    expect(report).toMatchObject({
      supportsGuideClaims: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsConditionApplicabilityClaims: false,
      supportsDamageClaims: false,
      supportsEnergyRecoveryClaims: false,
      candidateGenerationInput: false,
      candidateGenerationExecuted: false,
      damageOrRankingComputationExecuted: false,
      energyRecoveryInputsUsed: false,
    });
    expect(report.prohibitedInterpretations).toEqual(
      expect.arrayContaining([
        "computed-applicability",
        "generated-build",
        "equipment-recommendation",
        "source-rank-validation",
        "damage-result",
        "energy-requirement",
      ]),
    );
  });

  it("fails closed on condition prose drift instead of parsing or inferring it", async () => {
    const fixture = await loadFixture();
    const repository = structuredClone(fixture.repository);
    const manualInputs = mutateKeqingSnapshot(
      fixture.manualInputs,
      (snapshot) => {
        const record = requiredManualGuide(
          snapshot,
          "keqing-lunar-charged-default-artifact-stats-luna-i",
        );
        const entry = record.recommendation.mainStats?.sands[0];
        if (!entry) throw new Error("Missing default Keqing Sands claim.");
        entry.conditions[0] = `${entry.conditions[0]} Drifted.`;
      },
    );
    const guide = requiredRepositoryGuide(
      repository,
      "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
    );
    const entry = guide.recommendations?.[0].mainStats?.sands[0];
    if (!entry) throw new Error("Missing consolidated default Keqing Sands claim.");
    entry.conditions[0] = `${entry.conditions[0]} Drifted.`;

    const report = buildKeqingLunarEquipmentEvidenceValidationReport(
      repository,
      manualInputs,
    );

    expect(report.validationStatus).toBe("not-comparable");
    expect(report.sourceBoundary.allManualPayloadsMatch).toBe(false);
    expect(report.sourceBoundary.allRepositoryRecommendationsMatchManual).toBe(
      true,
    );
    expect(report.sourceConditionBoundary).toMatchObject({
      allSourceConditionsMappedExactly: false,
      mappedSourceConditionCount: 16,
      unmappedSourceConditions: [
        `${KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.lunarCharged} Drifted.`,
      ],
    });
    const sandsClaim = report.claims.find(
      ({ claimId }) =>
        claimId.endsWith(
          "default-artifact-stats-luna-i:main-stat:sands:0",
        ),
    );
    expect(sandsClaim?.allSourceConditionsMappedExactly).toBe(false);
    expect(
      sandsClaim?.teamResolutions.every(
        ({ resolution, conditionAcknowledgements }) =>
          resolution === "withheld-unresolved-source-condition" &&
          conditionAcknowledgements[0]?.predicateId == null,
      ),
    ).toBe(true);
  });

  it("fails closed when consolidated unknowns or exact same-page source references drift", async () => {
    const fixture = await loadFixture();
    const unknownGap =
      "the source's never-competitive-with-Mistsplitter cross-record ordering is not represented by the V1 recommendation schema";
    const unknownRepository = structuredClone(fixture.repository);
    const otherCritGuide = requiredRepositoryGuide(
      unknownRepository,
      "kqm:character-guide:keqing-lunar-charged-other-five-star-crit-options-luna-i",
    );
    expect(otherCritGuide.unknowns).toContain(unknownGap);
    otherCritGuide.unknowns = otherCritGuide.unknowns.filter(
      (unknown) => unknown !== unknownGap,
    );

    const unknownReport =
      buildKeqingLunarEquipmentEvidenceValidationReport(
        unknownRepository,
        fixture.manualInputs,
      );
    const unknownRecord = unknownReport.sourceBoundary.records.find(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-lunar-charged-other-five-star-crit-options-luna-i",
    );
    expect(unknownReport.validationStatus).toBe("not-comparable");
    expect(unknownReport.sourceBoundary).toMatchObject({
      allManualPayloadsMatch: true,
      allRepositoryPayloadsMatch: false,
      allRepositoryRecommendationsMatchManual: true,
      allRepositoryStatesMatch: true,
      allRepositoryPagesMatch: true,
    });
    expect(unknownRecord).toMatchObject({
      manualPayloadMatchesExpectation: true,
      repositoryPayloadMatchesExpectation: false,
      repositoryRecommendationMatchesManual: true,
      repositoryUsesExactPage: true,
    });

    for (const mutateRef of [
      (guide: ReturnType<typeof requiredRepositoryGuide>) => {
        const sourceRef = guide.sourceRefs[0];
        if (!sourceRef || !("url" in sourceRef.locator)) {
          throw new Error("Missing URL source reference.");
        }
        sourceRef.locator.heading = "Lunar-Charged > Wrong same-page heading";
      },
      (guide: ReturnType<typeof requiredRepositoryGuide>) => {
        const sourceRef = guide.sourceRefs[0];
        if (!sourceRef) throw new Error("Missing source reference.");
        sourceRef.sourceRecordId = "wrong-same-page-source-record-id";
      },
    ]) {
      const repository = structuredClone(fixture.repository);
      const guide = requiredRepositoryGuide(
        repository,
        "kqm:character-guide:keqing-lunar-charged-other-five-star-crit-options-luna-i",
      );
      mutateRef(guide);
      const report = buildKeqingLunarEquipmentEvidenceValidationReport(
        repository,
        fixture.manualInputs,
      );
      const boundary = report.sourceBoundary.records.find(
        ({ sourceRecordId }) =>
          sourceRecordId ===
          "keqing-lunar-charged-other-five-star-crit-options-luna-i",
      );
      expect(report.validationStatus).toBe("not-comparable");
      expect(report.sourceBoundary).toMatchObject({
        allManualPayloadsMatch: true,
        allRepositoryPayloadsMatch: false,
        allRepositoryRecommendationsMatchManual: true,
        allRepositoryPagesMatch: true,
      });
      expect(boundary).toMatchObject({
        repositoryPayloadMatchesExpectation: false,
        repositoryRecommendationMatchesManual: true,
        repositoryUsesExactPage: true,
      });
    }
  });

  it("keeps roster predicate truth separate from target metadata comparability", async () => {
    const fixture = await loadFixture();
    const repository = structuredClone(fixture.repository);
    const targetTeamId = KEQING_ROLE_PAIR_TARGET_TEAM_IDS[0];
    const target = requiredRepositoryTeam(repository, targetTeamId);
    target.status = "accepted";

    const report = buildKeqingLunarEquipmentEvidenceValidationReport(
      repository,
      fixture.manualInputs,
    );
    const targetBoundary = report.publishedTeamBoundary.targets.find(
      ({ teamRecordId }) => teamRecordId === targetTeamId,
    );
    const mistsplitter = findClaim(
      report.claims,
      "keqing-lunar-charged-general-mistsplitter-luna-i",
      "weapon",
      0,
      0,
    );
    const targetResolution = mistsplitter.teamResolutions.find(
      ({ teamRecordId }) => teamRecordId === targetTeamId,
    );

    expect(report.validationStatus).toBe("not-comparable");
    expect(report.publishedTeamBoundary.allTargetsMatchExpectation).toBe(false);
    expect(targetBoundary).toMatchObject({
      sourceStatus: "accepted",
      matchesExpectedBoundary: false,
      containsKeqing: true,
      recordsLunarCharged: true,
      declaredLunarChargedFactsMatch: true,
    });
    expect(targetResolution).toMatchObject({
      resolution: "matched-by-exact-team-facts",
      conditionAcknowledgements: [
        {
          predicateId:
            "roster-contains-keqing-and-declares-lunar-charged",
          resolution: "matched-by-exact-team-facts",
        },
      ],
    });
  });

  it("derives and gates gameplay/refinement safety from actual claim acknowledgements", async () => {
    const fixture = await loadFixture();
    const report = buildKeqingLunarEquipmentEvidenceValidationReport(
      fixture.repository,
      fixture.manualInputs,
    );
    const safety = deriveKeqingLunarEvidenceClaimSafety(report.claims);
    expect(safety).toEqual({
      gameplayBuildAndRefinementAcknowledgementCount: 96,
      matchedGameplayBuildOrRefinementAcknowledgementCount: 0,
      allowedRosterKnownFalseConjunctCount: 2,
      allowedRosterKnownFalseConjunctTeamIds: [
        KEQING_ROLE_PAIR_TARGET_TEAM_IDS[1],
        KEQING_ROLE_PAIR_TARGET_TEAM_IDS[2],
      ],
      expectedRosterKnownFalseConjunctTeamIds: [
        KEQING_ROLE_PAIR_TARGET_TEAM_IDS[1],
        KEQING_ROLE_PAIR_TARGET_TEAM_IDS[2],
      ],
      allowedRosterKnownFalseConjunctTeamsMatchExpectation: true,
      unexpectedGameplayBuildOrRefinementResolutionCount: 0,
      buildGameplayAndRefinementConditionsRemainUnresolved: true,
      sourceRefinementInferenceCount: 0,
      sourceRefinementsInferred: false,
    });
    expect(keqingLunarEvidenceClaimSafetyPermitsComparability(safety)).toBe(
      true,
    );

    const gameplayContradiction = structuredClone(report.claims);
    const traditionalClaim = findClaim(
      gameplayContradiction,
      "keqing-lunar-charged-traditional-artifact-options-luna-i",
      "artifact",
      0,
      0,
    );
    const traditionalAcknowledgement =
      traditionalClaim.teamResolutions[0]?.conditionAcknowledgements.find(
        ({ predicateId }) =>
          predicateId ===
          "traditional-artifact-set-comparison-input-unavailable",
      );
    if (!traditionalAcknowledgement) {
      throw new Error("Missing traditional artifact condition acknowledgement.");
    }
    traditionalAcknowledgement.resolution = "matched-by-exact-team-facts";
    const gameplaySafety =
      deriveKeqingLunarEvidenceClaimSafety(gameplayContradiction);
    expect(gameplaySafety).toMatchObject({
      matchedGameplayBuildOrRefinementAcknowledgementCount: 1,
      unexpectedGameplayBuildOrRefinementResolutionCount: 1,
      buildGameplayAndRefinementConditionsRemainUnresolved: false,
    });
    expect(
      keqingLunarEvidenceClaimSafetyPermitsComparability(gameplaySafety),
    ).toBe(false);

    const falseNonFurinaConjunct = structuredClone(report.claims);
    const harbingerClaim = findClaim(
      falseNonFurinaConjunct,
      "keqing-lunar-charged-harbinger-of-dawn-availability-luna-i",
      "weapon",
      0,
      0,
    );
    const nonFurinaAcknowledgement =
      harbingerClaim.teamResolutions[0]?.conditionAcknowledgements.find(
        ({ predicateId }) =>
          predicateId ===
          "harbinger-passive-and-artifact-inputs-unavailable",
      );
    if (!nonFurinaAcknowledgement) {
      throw new Error("Missing non-Furina Harbinger acknowledgement.");
    }
    nonFurinaAcknowledgement.resolution =
      "not-matched-by-exact-team-facts";
    const nonFurinaSafety = deriveKeqingLunarEvidenceClaimSafety(
      falseNonFurinaConjunct,
    );
    expect(nonFurinaSafety).toMatchObject({
      allowedRosterKnownFalseConjunctCount: 2,
      allowedRosterKnownFalseConjunctTeamsMatchExpectation: true,
      unexpectedGameplayBuildOrRefinementResolutionCount: 1,
      buildGameplayAndRefinementConditionsRemainUnresolved: false,
    });
    expect(
      keqingLunarEvidenceClaimSafetyPermitsComparability(nonFurinaSafety),
    ).toBe(false);

    const missingFurinaConjunct = structuredClone(report.claims);
    const missingHarbingerClaim = findClaim(
      missingFurinaConjunct,
      "keqing-lunar-charged-harbinger-of-dawn-availability-luna-i",
      "weapon",
      0,
      0,
    );
    const missingFurinaAcknowledgement =
      missingHarbingerClaim.teamResolutions[1]?.conditionAcknowledgements.find(
        ({ predicateId }) =>
          predicateId ===
          "harbinger-passive-and-artifact-inputs-unavailable",
      );
    if (!missingFurinaAcknowledgement) {
      throw new Error("Missing Furina Harbinger acknowledgement.");
    }
    missingFurinaAcknowledgement.resolution =
      "withheld-unresolved-source-condition";
    const missingFurinaSafety = deriveKeqingLunarEvidenceClaimSafety(
      missingFurinaConjunct,
    );
    expect(missingFurinaSafety).toMatchObject({
      allowedRosterKnownFalseConjunctCount: 1,
      allowedRosterKnownFalseConjunctTeamsMatchExpectation: false,
      unexpectedGameplayBuildOrRefinementResolutionCount: 0,
      buildGameplayAndRefinementConditionsRemainUnresolved: false,
    });
    expect(
      keqingLunarEvidenceClaimSafetyPermitsComparability(missingFurinaSafety),
    ).toBe(false);

    const refinementContradiction = structuredClone(report.claims);
    const weaponClaim = refinementContradiction.find(
      ({ searchCoverage }) =>
        searchCoverage.kind === "weapon-search-coverage",
    );
    if (!weaponClaim || weaponClaim.searchCoverage.kind !== "weapon-search-coverage") {
      throw new Error("Missing weapon coverage claim.");
    }
    weaponClaim.searchCoverage.refinementCoverageOutcome = "exact-candidate";
    const refinementSafety =
      deriveKeqingLunarEvidenceClaimSafety(refinementContradiction);
    expect(refinementSafety).toMatchObject({
      sourceRefinementInferenceCount: 1,
      sourceRefinementsInferred: true,
    });
    expect(
      keqingLunarEvidenceClaimSafetyPermitsComparability(refinementSafety),
    ).toBe(false);
  });

  it("detects candidate-state, baseline-payload, and released-region drift", async () => {
    const fixture = await loadFixture();

    const acceptedRepository = structuredClone(fixture.repository);
    const externalGuide = requiredRepositoryGuide(
      acceptedRepository,
      "kqm:character-guide:keqing-lunar-charged-general-mistsplitter-luna-i",
    );
    externalGuide.status = "accepted";
    externalGuide.promotionEligible = true;
    const acceptedReport = buildKeqingLunarEquipmentEvidenceValidationReport(
      acceptedRepository,
      fixture.manualInputs,
    );
    expect(acceptedReport.validationStatus).toBe("not-comparable");
    expect(acceptedReport.sourceBoundary.allRepositoryStatesMatch).toBe(false);

    const baselineDriftRepository = structuredClone(fixture.repository);
    const baselineGuide = requiredRepositoryGuide(
      baselineDriftRepository,
      "genshintools-presets:character-guide:keqing",
    );
    const baselineBuild = baselineGuide.builds.find(
      ({ sourceRecordId }) => sourceRecordId === "1WswsAu",
    );
    if (!baselineBuild) throw new Error("Missing Keqing baseline build.");
    baselineBuild.substats[0].weight = 99;
    const baselineDriftReport =
      buildKeqingLunarEquipmentEvidenceValidationReport(
        baselineDriftRepository,
        fixture.manualInputs,
      );
    expect(baselineDriftReport.validationStatus).toBe("not-comparable");
    expect(baselineDriftReport.baselineBoundary).toMatchObject({
      buildPresentExactlyOnce: true,
      buildPayloadMatchesExactly: false,
      allChecksMatch: false,
    });

    const characterRegions = Object.fromEntries(
      Object.entries(characterStatsInput).map(([characterId, stats]) => [
        characterId,
        stats.region,
      ]),
    );
    characterRegions.aino = "Mondstadt";
    const regionDriftReport =
      buildKeqingLunarEquipmentEvidenceValidationReport(
        fixture.repository,
        fixture.manualInputs,
        [],
        { characterRegions },
      );
    expect(regionDriftReport.validationStatus).toBe("not-comparable");
    expect(regionDriftReport.publishedTeamBoundary).toMatchObject({
      allTargetsMatchExpectation: false,
    });
    expect(regionDriftReport.publishedTeamBoundary.targets[0]).toMatchObject({
      nodKraiCharacterIds: ["ineffa"],
      nodKraiCharacterCount: 1,
      matchesExpectedBoundary: false,
    });
  });

  it("allows unrelated future records in the same source snapshot", async () => {
    const fixture = await loadFixture();
    const manualInputs = mutateKeqingSnapshot(
      fixture.manualInputs,
      (snapshot) => {
        const exemplar = requiredManualGuide(
          snapshot,
          "keqing-lunar-charged-general-mistsplitter-luna-i",
        );
        const unrelated = structuredClone(exemplar);
        unrelated.sourceRecordId = "unrelated-future-keqing-guide-test";
        snapshot.records.push(unrelated);
      },
    );

    const report = buildKeqingLunarEquipmentEvidenceValidationReport(
      fixture.repository,
      manualInputs,
    );

    expect(report.validationStatus).toBe("comparable");
    expect(report.sourceBoundary).toMatchObject({
      expectedParticipatingRecordCount: 17,
      observedSnapshotRecordCount: 25,
      allRecordsPresentExactlyOnce: true,
      allManualPayloadsMatch: true,
    });
    expect(report.sourceBoundary.records).toHaveLength(17);
  });
});

interface Fixture {
  repository: KnowledgeRepository;
  manualInputs: ManualSnapshotInput[];
}

async function loadFixture(): Promise<Fixture> {
  const [repositoryInput, manualIndexInput, sourceRegistryInput] =
    await Promise.all([
      readJson(KNOWLEDGE_REPOSITORY_PATH),
      readJson(MANUAL_SNAPSHOT_INDEX_PATH),
      readJson(SOURCE_REGISTRY_PATH),
    ]);
  return {
    repository: KnowledgeRepositorySchema.parse(repositoryInput),
    manualInputs: await loadManualSnapshotInputs(
      manualIndexInput,
      sourceRegistryInput,
    ),
  };
}

async function hashInputs(): Promise<Array<{ path: string; sha256: string }>> {
  return Promise.all(
    KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  );
}

function mutateKeqingSnapshot(
  inputs: readonly ManualSnapshotInput[],
  mutate: (snapshot: ManualObservationSnapshot) => void,
): ManualSnapshotInput[] {
  const changed = inputs.map((input) => structuredClone(input));
  const keqingInput = changed.find(
    ({ snapshotFile }) =>
      snapshotFile.path ===
      "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
  );
  if (!keqingInput) throw new Error("Missing indexed Keqing snapshot.");
  const snapshot = ManualObservationSnapshotSchema.parse(keqingInput.snapshot);
  mutate(snapshot);
  keqingInput.snapshot = snapshot;
  return changed;
}

function requiredManualGuide(
  snapshot: ManualObservationSnapshot,
  sourceRecordId: string,
): Extract<
  ManualObservationSnapshot["records"][number],
  { kind: "character_guide" }
> {
  const matches = snapshot.records.filter(
    (
      record,
    ): record is Extract<
      ManualObservationSnapshot["records"][number],
      { kind: "character_guide" }
    > =>
      record.kind === "character_guide" &&
      record.sourceRecordId === sourceRecordId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one manual character guide ${sourceRecordId}, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function requiredRepositoryGuide(
  repository: KnowledgeRepository,
  id: string,
): Extract<KnowledgeRecord, { kind: "character_guide" }> {
  const matches = repository.records.filter(
    (
      record,
    ): record is Extract<KnowledgeRecord, { kind: "character_guide" }> =>
      record.kind === "character_guide" && record.id === id,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one character guide ${id}, found ${matches.length}.`);
  }
  return matches[0];
}

function requiredRepositoryTeam(
  repository: KnowledgeRepository,
  id: string,
): Extract<KnowledgeRecord, { kind: "team" }> {
  const matches = repository.records.filter(
    (record): record is Extract<KnowledgeRecord, { kind: "team" }> =>
      record.kind === "team" && record.id === id,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one team ${id}, found ${matches.length}.`);
  }
  return matches[0];
}

function findClaim(
  claims: readonly KeqingLunarEquipmentEvidenceClaim[],
  sourceRecordId: string,
  kind: "weapon" | "artifact",
  groupIndex: number,
  itemIndex: number,
): KeqingLunarEquipmentEvidenceClaim {
  const matches = claims.filter(({ sourceClaim, ...claim }) => {
    if (claim.sourceRecordId !== sourceRecordId || sourceClaim.kind !== kind) {
      return false;
    }
    if (sourceClaim.groupIndex !== groupIndex) return false;
    return kind === "weapon"
      ? sourceClaim.kind === "weapon" && sourceClaim.weaponIndex === itemIndex
      : sourceClaim.kind === "artifact" &&
          sourceClaim.artifactIndex === itemIndex;
  });
  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${sourceRecordId}/${kind}/${groupIndex}/${itemIndex} claim, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function countResolutions(
  claims: readonly KeqingLunarEquipmentEvidenceClaim[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const claim of claims) {
    for (const { resolution } of claim.teamResolutions) {
      counts[resolution] = (counts[resolution] ?? 0) + 1;
    }
  }
  return counts;
}
