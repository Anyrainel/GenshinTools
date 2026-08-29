import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  KEQING_HYDRO_ROLE_RECORD_ID,
  KEQING_ROLE_PAIR_PAGE_URL,
  KEQING_ROLE_PAIR_TARGET_TEAM_IDS,
  KEQING_ROLE_PAIR_TEMPLATE_ID,
  KEQING_ROLE_PAIR_VV_CONDITION,
  KEQING_SHRED_ROLE_RECORD_ID,
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS,
  runKeqingSourceScopedRolePairSample,
} from "../src/keqingSourceScopedRolePairSample";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  loadManualSnapshotInputs,
  type ManualSnapshotInput,
} from "../src/manualSnapshots";
import {
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
} from "../src/paths";
import {
  type KnowledgeRepository,
  KnowledgeRepositorySchema,
  type ManualObservationSnapshot,
  ManualObservationSnapshotSchema,
} from "../src/schemas";

describe("Keqing source-scoped role-pair sample integration", () => {
  it("validates exactly four published pairs while retaining full exercised and unexercised evidence", async () => {
    const fixture = await loadFixture();
    const durable = await readJson(
      KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
    );
    const generatedFrom = await hashInputs();
    const report = await runKeqingSourceScopedRolePairSample(
      fixture.repository,
      fixture.manualInputs,
      fixture.checkedInRosterDomainReportInput,
      generatedFrom,
    );
    const repeated = await runKeqingSourceScopedRolePairSample(
      fixture.repository,
      fixture.manualInputs,
      fixture.checkedInRosterDomainReportInput,
      generatedFrom,
    );

    expect(repeated).toEqual(report);
    expect(durable).toEqual(report);
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.sourceExtractionBoundary).toMatchObject({
      sourceId: "kqm",
      expectedParticipatingRecordCount: 7,
      observedSnapshotRecordCount: 7,
      configuredRecordsPresentExactlyOnce: true,
      expectedExtractionMethod: "agent-assisted",
      expectedReviewStatus: "unreviewed",
      allExtractionStatesMatch: true,
    });
    expect(report.sourceExtractionBoundary.records).toHaveLength(7);
    expect(report.sourceExtractionBoundary.records).toSatisfy(
      (records: typeof report.sourceExtractionBoundary.records) =>
        records.every(
          (record) =>
            record.occurrenceCount === 1 &&
            record.presentExactlyOnce &&
            record.observedExtractionMethod === "agent-assisted" &&
            record.observedReviewStatus === "unreviewed" &&
            record.matchesExpectedExtractionMethod &&
            record.matchesExpectedReviewStatus,
        ),
    );
    expect(report.sourcePageBoundary).toMatchObject({
      expectedPageUrl: KEQING_ROLE_PAIR_PAGE_URL,
      observedSnapshotPageUrl: KEQING_ROLE_PAIR_PAGE_URL,
      snapshotPageUrlMatchesExpectation: true,
      allRepositoryRecordsUseExactPage: true,
    });
    expect(report.sourcePageBoundary.repositoryRecords).toHaveLength(7);
    expect(
      report.sourcePageBoundary.repositoryRecords.every(
        ({ usesExactPage }) => usesExactPage,
      ),
    ).toBe(true);

    expect(report.roleInventoryBoundary).toMatchObject({
      expectedRoleRecordCount: 2,
      allRoleInventoriesMatchExpectation: true,
    });
    expect(report.roleInventoryBoundary.roleRecords).toEqual([
      {
        roleRecordId: KEQING_HYDRO_ROLE_RECORD_ID,
        templateId: KEQING_ROLE_PAIR_TEMPLATE_ID,
        slotId: "off-field-hydro",
        roleId: "off-field-hydro-applier",
        status: "candidate",
        promotionEligible: false,
        members: [
          { characterId: "aino", conditions: [] },
          { characterId: "furina", conditions: [] },
          { characterId: "xingqiu", conditions: [] },
          { characterId: "yelan", conditions: [] },
        ],
        exhaustiveness: "unspecified",
        rankingClaim: "none",
        matchesExpectedMemberInventory: true,
        matchesExpectedUnspecifiedUnrankedScope: true,
      },
      {
        roleRecordId: KEQING_SHRED_ROLE_RECORD_ID,
        templateId: KEQING_ROLE_PAIR_TEMPLATE_ID,
        slotId: "resistance-shred",
        roleId: "resistance-shred",
        status: "candidate",
        promotionEligible: false,
        members: [
          {
            characterId: "jean",
            conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
          },
          {
            characterId: "kaedehara_kazuha",
            conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
          },
          {
            characterId: "sayu",
            conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
          },
          {
            characterId: "sucrose",
            conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
          },
          {
            characterId: "xianyun",
            conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
          },
          { characterId: "xilonen", conditions: [] },
        ],
        exhaustiveness: "unspecified",
        rankingClaim: "none",
        matchesExpectedMemberInventory: true,
        matchesExpectedUnspecifiedUnrankedScope: true,
      },
    ]);

    expect(report.publishedTargetBoundary).toEqual({
      expectedTargetCount: 4,
      configuredTargetCount: 4,
      evaluatedTargetCount: 4,
      expectedTargetTeamIds: [...KEQING_ROLE_PAIR_TARGET_TEAM_IDS],
      configuredTargetTeamIds: [...KEQING_ROLE_PAIR_TARGET_TEAM_IDS],
      evaluatedTargetTeamIds: [...KEQING_ROLE_PAIR_TARGET_TEAM_IDS],
      configuredTargetsMatchExpectation: true,
      evaluatedTargetsMatchConfiguration: true,
    });
    expect(report.configuredPublishedTargets).toHaveLength(4);
    expect(report.rolePairSample).toMatchObject({
      comparisonStatus: "comparable",
      completeRoleDomains: false,
      completePairDomain: false,
      pairCombinationPolicy: "configured-published-targets-only",
      unconfiguredRoleMemberPairsEvaluated: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsRankClaims: false,
      supportsGlobalRoleResolution: false,
      issues: [],
    });
    expect(report.rolePairSample.targets).toHaveLength(4);
    expect(
      report.rolePairSample.targets.every(
        ({ comparisonStatus, structuralBindingMultiplicity, issues }) =>
          comparisonStatus === "comparable" &&
          structuralBindingMultiplicity === 1 &&
          issues.length === 0,
      ),
    ).toBe(true);
    expect(report.rolePairSample.validatedPairObservations).toHaveLength(4);
    expect(report.rolePairSample.roleEvidence).toEqual([
      {
        roleRecordId: KEQING_HYDRO_ROLE_RECORD_ID,
        templateId: KEQING_ROLE_PAIR_TEMPLATE_ID,
        slotId: "off-field-hydro",
        roleId: "off-field-hydro-applier",
        sourceObservedMemberIds: ["aino", "furina", "xingqiu", "yelan"],
        exercisedByConfiguredTargetMemberIds: ["aino", "furina", "yelan"],
        unexercisedByConfiguredTargetMemberIds: ["xingqiu"],
        exhaustiveness: "unspecified",
        rankingClaim: "none",
      },
      {
        roleRecordId: KEQING_SHRED_ROLE_RECORD_ID,
        templateId: KEQING_ROLE_PAIR_TEMPLATE_ID,
        slotId: "resistance-shred",
        roleId: "resistance-shred",
        sourceObservedMemberIds: [
          "jean",
          "kaedehara_kazuha",
          "sayu",
          "sucrose",
          "xianyun",
          "xilonen",
        ],
        exercisedByConfiguredTargetMemberIds: [
          "jean",
          "kaedehara_kazuha",
          "sucrose",
          "xilonen",
        ],
        unexercisedByConfiguredTargetMemberIds: ["sayu", "xianyun"],
        exhaustiveness: "unspecified",
        rankingClaim: "none",
      },
    ]);

    const expectedRepresentedPairs = [
      "aino|sucrose",
      "furina|jean",
      "furina|xilonen",
      "yelan|kaedehara_kazuha",
    ];
    const representedPairSets = [
      extractRepresentedPairs(report.configuredPublishedTargets),
      extractRepresentedPairs(report.rolePairSample.targets),
      extractRepresentedPairs(
        report.rolePairSample.validatedPairObservations ?? [],
      ),
    ];
    for (const representedPairs of representedPairSets) {
      expect(representedPairs).toEqual(expectedRepresentedPairs);
    }
    const hydroMembers = report.roleInventoryBoundary.roleRecords.find(
      ({ roleRecordId }) => roleRecordId === KEQING_HYDRO_ROLE_RECORD_ID,
    )?.members;
    const shredMembers = report.roleInventoryBoundary.roleRecords.find(
      ({ roleRecordId }) => roleRecordId === KEQING_SHRED_ROLE_RECORD_ID,
    )?.members;
    if (!hydroMembers || !shredMembers) {
      throw new Error("Missing paired role inventories.");
    }
    const otherCrossRolePairs = hydroMembers
      .flatMap((hydro) =>
        shredMembers.map(
          (shred) => `${hydro.characterId}|${shred.characterId}`,
        ),
      )
      .filter((pair) => !expectedRepresentedPairs.includes(pair));
    expect(otherCrossRolePairs).toHaveLength(20);
    for (const representedPairs of representedPairSets) {
      expect(
        otherCrossRolePairs.some((pair) => representedPairs.includes(pair)),
      ).toBe(false);
    }

    const shredBindings = report.rolePairSample.targets.map((target) =>
      target.roleMemberBindings.find(
        ({ roleRecordId }) => roleRecordId === KEQING_SHRED_ROLE_RECORD_ID,
      ),
    );
    const vvBindings = shredBindings.filter(
      (
        binding,
      ): binding is NonNullable<(typeof shredBindings)[number]> =>
        binding !== undefined &&
        ["jean", "kaedehara_kazuha", "sucrose"].includes(
          binding.characterId,
        ),
    );
    expect(vvBindings).toHaveLength(3);
    expect(
      vvBindings.every(
        (binding) =>
          binding.requiredConditions[0] === KEQING_ROLE_PAIR_VV_CONDITION &&
          binding.acknowledgedConditions[0] ===
            KEQING_ROLE_PAIR_VV_CONDITION &&
          binding.conditionsMatch,
      ),
    ).toBe(true);
    expect(
      shredBindings.find((binding) => binding?.characterId === "xilonen"),
    ).toMatchObject({
      requiredConditions: [],
      acknowledgedConditions: [],
      conditionsMatch: true,
    });

    expect(report.releasedCatalogBoundary).toMatchObject({
      source: "stable-resources",
      fullStableCharacterCount: 139,
      excludedSpecialAvatarFormCount: 14,
      eligibleCharacterCount: 125,
      expectedEligibleCharacterCount: 125,
      eligibleCharacterCountMatchesExpectation: true,
      playableIdentityCount: 119,
      checkedInRosterReportComparison: {
        referenceReportComparable: true,
        eligibleCharacterCountMatches: true,
        eligibleCatalogHashMatches: true,
        eligibleCharacterIdsHashMatches: true,
        playableIdentityCountMatches: true,
        allChecksMatch: true,
      },
    });
    expect(report.existingRosterDomainBoundary).toEqual({
      templateId: KEQING_ROLE_PAIR_TEMPLATE_ID,
      expectedStatus: "withheld-unresolved-role",
      freshObservedStatus: "withheld-unresolved-role",
      freshRemainsWithheldUnresolvedRole: true,
      checkedInObservedStatus: "withheld-unresolved-role",
      checkedInRemainsWithheldUnresolvedRole: true,
      namedRoleEvidenceInstalledAsGlobalResolver: false,
    });
    expect(report).toMatchObject({
      completeRoleDomains: false,
      completePairDomain: false,
      unconfiguredRoleMemberPairsEvaluated: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsRankClaims: false,
      supportsGlobalRoleResolution: false,
      supportsGameplayValidation: false,
      supportsDamageClaims: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsEnergyRecoveryClaims: false,
      energyRecoveryInputsUsed: false,
    });
    expect(Object.keys(report).sort()).toEqual(
      [
        "cautions",
        "classification",
        "comparisonStatus",
        "completePairDomain",
        "completeRoleDomains",
        "configuredPublishedTargets",
        "energyRecoveryInputsUsed",
        "existingRosterDomainBoundary",
        "generatedFrom",
        "prohibitedInterpretations",
        "publishedTargetBoundary",
        "releasedCatalogBoundary",
        "roleInventoryBoundary",
        "rolePairSample",
        "schemaVersion",
        "sourceExtractionBoundary",
        "sourcePageBoundary",
        "supportsDamageClaims",
        "supportsEnergyRecoveryClaims",
        "supportsEquipmentRecommendations",
        "supportsGameplayValidation",
        "supportsGlobalRoleResolution",
        "supportsGuideClaims",
        "supportsRankClaims",
        "supportsStatRecommendations",
        "supportsTeamRecommendations",
        "unconfiguredRoleMemberPairsEvaluated",
      ].sort(),
    );
    expect(Object.keys(report.rolePairSample).sort()).toEqual(
      [
        "comparisonStatus",
        "completePairDomain",
        "completeRoleDomains",
        "issues",
        "pairCombinationPolicy",
        "reportType",
        "roleEvidence",
        "schemaVersion",
        "supportsGlobalRoleResolution",
        "supportsGuideClaims",
        "supportsRankClaims",
        "supportsTeamRecommendations",
        "targets",
        "unconfiguredRoleMemberPairsEvaluated",
        "validatedPairObservations",
      ].sort(),
    );
    const serialized = stableJson(report);
    expect(serialized).not.toContain('"candidatePairs"');
    expect(serialized).not.toContain('"cartesianProduct"');
    expect(serialized).not.toContain('"resolvedRoleCatalog"');
    expect(serialized).not.toContain('"eligibleCharacters"');
    expect(serialized.length).toBeLessThan(45_000);
  });

  it("fails the wrapper comparison when any participating indexed review state drifts", async () => {
    const fixture = await loadFixture();
    const changedInputs = mutateKeqingSnapshot(
      fixture.manualInputs,
      (snapshot) => {
        const record = snapshot.records.find(
          ({ sourceRecordId }) =>
            sourceRecordId ===
            "keqing-ineffa-furina-jean-lunar-charged-example",
        );
        if (!record) throw new Error("Missing configured Keqing team record.");
        record.extraction = {
          method: record.extraction.method,
          reviewStatus: "reviewed",
          reviewer: "integration-test",
          reviewedAt: "2026-08-29",
        };
      },
    );

    const report = await runKeqingSourceScopedRolePairSample(
      fixture.repository,
      changedInputs,
      fixture.checkedInRosterDomainReportInput,
      [],
    );

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.sourceExtractionBoundary.allExtractionStatesMatch).toBe(
      false,
    );
    expect(
      report.sourceExtractionBoundary.records.find(
        ({ sourceRecordId }) =>
          sourceRecordId ===
          "keqing-ineffa-furina-jean-lunar-charged-example",
      ),
    ).toMatchObject({
      occurrenceCount: 1,
      observedReviewStatus: "reviewed",
      matchesExpectedReviewStatus: false,
    });
    expect(report.rolePairSample.comparisonStatus).toBe("comparable");
  });

  it.each([
    {
      name: "the configured template is accepted",
      recordId: KEQING_ROLE_PAIR_TEMPLATE_ID,
    },
    {
      name: "a configured exact team is accepted",
      recordId: KEQING_ROLE_PAIR_TARGET_TEAM_IDS[0],
    },
  ])("fails the wrapper comparison when $name", async ({ recordId }) => {
    const fixture = await loadFixture();
    const repository = structuredClone(fixture.repository);
    const record = repository.records.find(({ id }) => id === recordId);
    if (!record) throw new Error(`Missing configured record ${recordId}.`);
    record.status = "accepted";
    record.promotionEligible = true;

    const report = await runKeqingSourceScopedRolePairSample(
      repository,
      fixture.manualInputs,
      fixture.checkedInRosterDomainReportInput,
      [],
    );

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.rolePairSample.comparisonStatus).toBe("not-comparable");
    expect(report.rolePairSample.validatedPairObservations).toBeNull();
  });

  it("permits unrelated future records in the same indexed Keqing snapshot", async () => {
    const fixture = await loadFixture();
    const exemplar = findCharacterGuideRecord(fixture.manualInputs);
    const changedInputs = mutateKeqingSnapshot(
      fixture.manualInputs,
      (snapshot) => {
        const unrelated = structuredClone(exemplar);
        unrelated.sourceRecordId =
          "keqing-unrelated-future-character-guide-integration-test";
        unrelated.locator = {
          ...unrelated.locator,
          url: KEQING_ROLE_PAIR_PAGE_URL,
        };
        unrelated.supportingLocators = unrelated.supportingLocators.map(
          (locator) =>
            "url" in locator
              ? { ...locator, url: KEQING_ROLE_PAIR_PAGE_URL }
              : locator,
        );
        snapshot.records.push(unrelated);
      },
    );

    const report = await runKeqingSourceScopedRolePairSample(
      fixture.repository,
      changedInputs,
      fixture.checkedInRosterDomainReportInput,
      [],
    );

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.sourceExtractionBoundary).toMatchObject({
      expectedParticipatingRecordCount: 7,
      observedSnapshotRecordCount: 8,
      configuredRecordsPresentExactlyOnce: true,
      allExtractionStatesMatch: true,
    });
    expect(report.sourceExtractionBoundary.records).toHaveLength(7);
  });

  it("detects same-count catalog fingerprint drift against the checked-in boundary", async () => {
    const fixture = await loadFixture();
    const drifted = structuredClone(
      fixture.checkedInRosterDomainReportInput,
    ) as CheckedInRosterReportShape;
    const originalCount = drifted.releasedCatalogBoundary.eligibleCharacterCount;
    drifted.releasedCatalogBoundary.eligibleCatalogSha256 = "0".repeat(64);
    drifted.domain.catalogBoundary.characterIdsSha256 = "1".repeat(64);

    const report = await runKeqingSourceScopedRolePairSample(
      fixture.repository,
      fixture.manualInputs,
      drifted,
      [],
    );

    expect(drifted.releasedCatalogBoundary.eligibleCharacterCount).toBe(
      originalCount,
    );
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(
      report.releasedCatalogBoundary.checkedInRosterReportComparison,
    ).toMatchObject({
      eligibleCharacterCountMatches: true,
      eligibleCatalogHashMatches: false,
      eligibleCharacterIdsHashMatches: false,
      allChecksMatch: false,
    });
  });

  it("fails when the checked-in Keqing roster status stops being role-withheld while the fresh status remains withheld", async () => {
    const fixture = await loadFixture();
    const drifted = structuredClone(
      fixture.checkedInRosterDomainReportInput,
    ) as CheckedInRosterReportShape;
    const template = drifted.domain.templates.find(
      ({ templateId }) => templateId === KEQING_ROLE_PAIR_TEMPLATE_ID,
    );
    if (!template) throw new Error("Missing checked-in Keqing template.");
    template.status = "comparable";

    const report = await runKeqingSourceScopedRolePairSample(
      fixture.repository,
      fixture.manualInputs,
      drifted,
      [],
    );

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.existingRosterDomainBoundary).toMatchObject({
      freshObservedStatus: "withheld-unresolved-role",
      freshRemainsWithheldUnresolvedRole: true,
      checkedInObservedStatus: "comparable",
      checkedInRemainsWithheldUnresolvedRole: false,
    });
  });

  it("pins the full unexercised role inventory instead of accepting member removal", async () => {
    const fixture = await loadFixture();
    const repository = structuredClone(fixture.repository);
    const hydroRole = repository.records.find(
      (record) =>
        record.kind === "character_role" &&
        record.id === KEQING_HYDRO_ROLE_RECORD_ID,
    );
    if (!hydroRole || hydroRole.kind !== "character_role") {
      throw new Error("Missing Keqing Hydro role.");
    }
    hydroRole.members = hydroRole.members.filter(
      ({ characterId }) => characterId !== "xingqiu",
    );

    const report = await runKeqingSourceScopedRolePairSample(
      repository,
      fixture.manualInputs,
      fixture.checkedInRosterDomainReportInput,
      [],
    );

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.rolePairSample.comparisonStatus).toBe("comparable");
    expect(
      report.roleInventoryBoundary.roleRecords.find(
        ({ roleRecordId }) => roleRecordId === KEQING_HYDRO_ROLE_RECORD_ID,
      )?.matchesExpectedMemberInventory,
    ).toBe(false);
    expect(
      report.roleInventoryBoundary.allRoleInventoriesMatchExpectation,
    ).toBe(false);
  });

  it("rejects a shared but wrong page and fails closed if any required published target is removed", async () => {
    const fixture = await loadFixture();
    const wrongPageRepository = structuredClone(fixture.repository);
    const relevantIds = new Set([
      KEQING_ROLE_PAIR_TEMPLATE_ID,
      KEQING_HYDRO_ROLE_RECORD_ID,
      KEQING_SHRED_ROLE_RECORD_ID,
      ...KEQING_ROLE_PAIR_TARGET_TEAM_IDS,
    ]);
    for (const record of wrongPageRepository.records) {
      if (!relevantIds.has(record.id)) continue;
      record.sourceRefs = record.sourceRefs.map((sourceRef) =>
        "url" in sourceRef.locator
          ? {
              ...sourceRef,
              locator: {
                ...sourceRef.locator,
                url: "https://keqingmains.com/q/not-the-keqing-guide/",
              },
            }
          : sourceRef,
      );
    }
    const wrongPageReport = await runKeqingSourceScopedRolePairSample(
      wrongPageRepository,
      fixture.manualInputs,
      fixture.checkedInRosterDomainReportInput,
      [],
    );
    expect(wrongPageReport.comparisonStatus).toBe("not-comparable");
    expect(wrongPageReport.rolePairSample.comparisonStatus).toBe("comparable");
    expect(
      wrongPageReport.sourcePageBoundary.allRepositoryRecordsUseExactPage,
    ).toBe(false);

    const missingTargetRepository = structuredClone(fixture.repository);
    missingTargetRepository.records = missingTargetRepository.records.filter(
      ({ id }) => id !== KEQING_ROLE_PAIR_TARGET_TEAM_IDS[3],
    );
    await expect(
      runKeqingSourceScopedRolePairSample(
        missingTargetRepository,
        fixture.manualInputs,
        fixture.checkedInRosterDomainReportInput,
        [],
      ),
    ).rejects.toThrow(KEQING_ROLE_PAIR_TARGET_TEAM_IDS[3]);
  });
});

interface Fixture {
  repository: KnowledgeRepository;
  manualInputs: ManualSnapshotInput[];
  checkedInRosterDomainReportInput: unknown;
}

interface CheckedInRosterReportShape {
  releasedCatalogBoundary: {
    eligibleCharacterCount: number;
    eligibleCatalogSha256: string;
  };
  domain: {
    catalogBoundary: { characterIdsSha256: string };
    templates: Array<{ templateId: string; status: string }>;
  };
}

interface RepresentedTarget {
  roleMemberBindings: ReadonlyArray<{
    roleRecordId: string;
    characterId: string;
  }>;
}

function extractRepresentedPairs(
  targets: readonly RepresentedTarget[],
): string[] {
  return [
    ...new Set(
      targets.map(({ roleMemberBindings }) => {
        const hydro = roleMemberBindings.find(
          ({ roleRecordId }) => roleRecordId === KEQING_HYDRO_ROLE_RECORD_ID,
        );
        const shred = roleMemberBindings.find(
          ({ roleRecordId }) => roleRecordId === KEQING_SHRED_ROLE_RECORD_ID,
        );
        if (!hydro || !shred) {
          throw new Error("A represented target is missing one exact role binding.");
        }
        return `${hydro.characterId}|${shred.characterId}`;
      }),
    ),
  ].sort();
}

async function loadFixture(): Promise<Fixture> {
  const [
    repositoryInput,
    manualIndexInput,
    sourceRegistryInput,
    checkedInRosterDomainReportInput,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
  ]);
  return {
    repository: KnowledgeRepositorySchema.parse(repositoryInput),
    manualInputs: await loadManualSnapshotInputs(
      manualIndexInput,
      sourceRegistryInput,
    ),
    checkedInRosterDomainReportInput,
  };
}

function mutateKeqingSnapshot(
  inputs: readonly ManualSnapshotInput[],
  mutate: (snapshot: ManualObservationSnapshot) => void,
): ManualSnapshotInput[] {
  const changedInputs = inputs.map((input) => structuredClone(input));
  const keqingInput = changedInputs.find(
    ({ snapshotFile }) =>
      snapshotFile.path ===
      "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
  );
  if (!keqingInput) throw new Error("Missing indexed Keqing snapshot.");
  const snapshot = ManualObservationSnapshotSchema.parse(keqingInput.snapshot);
  mutate(snapshot);
  keqingInput.snapshot = snapshot;
  return changedInputs;
}

function findCharacterGuideRecord(
  inputs: readonly ManualSnapshotInput[],
): Extract<ManualObservationSnapshot["records"][number], { kind: "character_guide" }> {
  for (const input of inputs) {
    const parsed = ManualObservationSnapshotSchema.safeParse(input.snapshot);
    if (!parsed.success) continue;
    const record = parsed.data.records.find(
      (candidate): candidate is Extract<
        ManualObservationSnapshot["records"][number],
        { kind: "character_guide" }
      > => candidate.kind === "character_guide",
    );
    if (record) return record;
  }
  throw new Error("Missing manual character-guide exemplar.");
}

async function hashInputs(): Promise<Array<{ path: string; sha256: string }>> {
  return Promise.all(
    KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  );
}
