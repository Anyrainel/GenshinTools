import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FURINA_ROLE_RECORD_ID,
  FURINA_ROLE_TARGET_TEAM_ID,
  FURINA_ROLE_TEMPLATE_ID,
  FURINA_SOURCE_SCOPED_ROLE_SAMPLE_INPUT_PATHS,
  runFurinaSourceScopedRoleSample,
} from "../src/furinaSourceScopedRoleSample";
import { readJson, sha256File, stableJson } from "../src/io";
import { loadManualSnapshotInputs } from "../src/manualSnapshots";
import {
  FURINA_SOURCE_SCOPED_ROLE_SAMPLE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
} from "../src/paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
} from "../src/schemas";
import {
  compareEligibleCatalogWithCheckedInRosterReport,
  parseCheckedInRosterCatalogReference,
} from "../src/rosterCatalogReference";
import { buildTeamRosterCandidateDomainExperimentFixture } from "../src/teamRosterCandidateDomainExperiment";

describe("Furina source-scoped role sample integration", () => {
  it("checks one indexed Xilonen role observation without resolving the broader role domain", async () => {
    const [
      repositoryInput,
      manualIndexInput,
      sourceRegistryInput,
      checkedInRosterDomainReportInput,
      durable,
    ] = await Promise.all([
        readJson(KNOWLEDGE_REPOSITORY_PATH),
        readJson(MANUAL_SNAPSHOT_INDEX_PATH),
        readJson(SOURCE_REGISTRY_PATH),
        readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
        readJson(FURINA_SOURCE_SCOPED_ROLE_SAMPLE_REPORT_PATH),
      ]);
    const manualInputs = await loadManualSnapshotInputs(
      manualIndexInput,
      sourceRegistryInput,
    );
    const generatedFrom = await hashInputs();
    const repository = KnowledgeRepositorySchema.parse(repositoryInput);

    const report = await runFurinaSourceScopedRoleSample(
      repository,
      manualInputs,
      checkedInRosterDomainReportInput,
      generatedFrom,
    );
    const repeated = await runFurinaSourceScopedRoleSample(
      repository,
      manualInputs,
      checkedInRosterDomainReportInput,
      generatedFrom,
    );

    expect(repeated).toEqual(report);
    expect(durable).toEqual(report);
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.sourceExtractionBoundary).toMatchObject({
      sourceId: "kqm",
      sourceRecordId: "furina-xilonen-healer-role-luna-ii",
      extractionMethod: "agent-assisted",
      observedReviewStatus: "unreviewed",
      expectedReviewStatus: "unreviewed",
      matchesExpectedReviewStatus: true,
    });
    expect(report.sourceExtractionBoundary.snapshotFile.path).toBe(
      "scripts/guide-factory/data/source-snapshots/kqm-furina-manual.json",
    );
    expect(report.releasedCatalogBoundary).toMatchObject({
      source: "stable-resources",
      fullStableCharacterCount: 139,
      excludedSpecialAvatarFormCount: 14,
      eligibleCharacterCount: 125,
      expectedEligibleCharacterCount: 125,
      eligibleCharacterCountMatchesExpectation: true,
      playableIdentityCount: 119,
      checkedInRosterReportReference: {
        source: "checked-in-team-roster-candidate-domain-report",
        reportComparisonStatus: "comparable",
        eligibleCharacterCount: 125,
        playableIdentityCount: 119,
      },
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
      templateId: FURINA_ROLE_TEMPLATE_ID,
      expectedStatus: "withheld-unresolved-role",
      observedStatus: "withheld-unresolved-role",
      remainsWithheldUnresolvedRole: true,
      namedRoleEvidenceInstalledAsGlobalResolver: false,
    });
    expect(report.namedSampleBoundary).toEqual({
      roleRecordId: FURINA_ROLE_RECORD_ID,
      templateId: FURINA_ROLE_TEMPLATE_ID,
      targetTeamId: FURINA_ROLE_TARGET_TEAM_ID,
      evidenceCharacterId: "xilonen",
      expectedStructuralBindingMultiplicity: 2,
      sourceSlotBinding: {
        furina: "furina",
        healer: "xilonen",
        "flex-1": "neuvillette",
        "flex-2": "kaedehara_kazuha",
      },
      sourceSlotBindingBasis: "same-page-inferred-fit",
    });
    expect(report.roleSample).toMatchObject({
      comparisonStatus: "comparable",
      reviewStatus: "unreviewed",
      completeDomain: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsRankClaims: false,
      evidencePoolCharacterIds: ["xilonen"],
      structuralBindingMultiplicity: 2,
      issues: [],
      survivor: {
        targetTeamId: FURINA_ROLE_TARGET_TEAM_ID,
        targetMemberCharacterIds: [
          "furina",
          "neuvillette",
          "kaedehara_kazuha",
          "xilonen",
        ],
        templateId: FURINA_ROLE_TEMPLATE_ID,
        slotId: "healer",
        roleId: "healer",
        characterId: "xilonen",
        structuralBindingMultiplicity: 2,
      },
    });
    expect(report).toMatchObject({
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsRankClaims: false,
      supportsGlobalRoleResolution: false,
      energyRecoveryInputsUsed: false,
    });
    expect(report.releasedCatalogBoundary).not.toHaveProperty(
      "eligibleCharacters",
    );
    const serialized = stableJson(report);
    expect(serialized).not.toContain('"resolvedRoleCatalog"');
    expect(serialized).not.toContain('"candidateRosters"');
    expect(serialized).not.toContain('"energyRecoveryInputsUsed":true');
    expect(serialized.length).toBeLessThan(20_000);

    const existingRosterReport = checkedInRosterDomainReportInput as {
      domain: {
        templates: Array<{ templateId: string; status: string }>;
      };
    };
    expect(
      existingRosterReport.domain.templates.find(
        ({ templateId }) => templateId === FURINA_ROLE_TEMPLATE_ID,
      )?.status,
    ).toBe("withheld-unresolved-role");
  });

  it("detects same-count eligible-membership drift against the checked-in roster report", async () => {
    const [repositoryInput, checkedInRosterDomainReportInput] =
      await Promise.all([
        readJson(KNOWLEDGE_REPOSITORY_PATH),
        readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
      ]);
    const repository = KnowledgeRepositorySchema.parse(repositoryInput);
    const fixture =
      await buildTeamRosterCandidateDomainExperimentFixture(repository);
    const reference = parseCheckedInRosterCatalogReference(
      checkedInRosterDomainReportInput,
    );
    const current = fixture.coreInput.releasedCharacters;
    const baseline = compareEligibleCatalogWithCheckedInRosterReport(
      current,
      reference,
    );
    const mutated = current.map((entry, index) =>
      index === 0 ? { ...entry, characterId: `${entry.characterId}-drift` } : entry,
    );
    const drifted = compareEligibleCatalogWithCheckedInRosterReport(
      mutated,
      reference,
    );

    expect(baseline.allChecksMatch).toBe(true);
    expect(mutated).toHaveLength(current.length);
    expect(drifted).toMatchObject({
      referenceReportComparable: true,
      eligibleCharacterCountMatches: true,
      eligibleCatalogHashMatches: false,
      eligibleCharacterIdsHashMatches: false,
      allChecksMatch: false,
    });
  });

  it("fails the wrapper comparison when the indexed extraction review status changes", async () => {
    const [
      repositoryInput,
      manualIndexInput,
      sourceRegistryInput,
      checkedInRosterDomainReportInput,
    ] =
      await Promise.all([
        readJson(KNOWLEDGE_REPOSITORY_PATH),
        readJson(MANUAL_SNAPSHOT_INDEX_PATH),
        readJson(SOURCE_REGISTRY_PATH),
        readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
      ]);
    const manualInputs = await loadManualSnapshotInputs(
      manualIndexInput,
      sourceRegistryInput,
    );
    const changedInputs = structuredClone(manualInputs);
    const furinaInput = changedInputs.find(({ snapshot }) => {
      const parsed = ManualObservationSnapshotSchema.safeParse(snapshot);
      return (
        parsed.success &&
        parsed.data.records.some(
          (record) =>
            record.kind === "character_role" &&
            record.sourceRecordId === "furina-xilonen-healer-role-luna-ii",
        )
      );
    });
    if (!furinaInput) throw new Error("Missing indexed Furina snapshot.");
    const snapshot = ManualObservationSnapshotSchema.parse(
      furinaInput.snapshot,
    );
    const roleRecord = snapshot.records.find(
      (record) =>
        record.kind === "character_role" &&
        record.sourceRecordId === "furina-xilonen-healer-role-luna-ii",
    );
    if (!roleRecord) throw new Error("Missing Furina role observation.");
    roleRecord.extraction = {
      method: roleRecord.extraction.method,
      reviewStatus: "reviewed",
      reviewer: "integration-test",
      reviewedAt: "2026-08-29",
    };
    furinaInput.snapshot = snapshot;

    const report = await runFurinaSourceScopedRoleSample(
      KnowledgeRepositorySchema.parse(repositoryInput),
      changedInputs,
      checkedInRosterDomainReportInput,
      [],
    );

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.sourceExtractionBoundary).toMatchObject({
      observedReviewStatus: "reviewed",
      expectedReviewStatus: "unreviewed",
      matchesExpectedReviewStatus: false,
    });
    expect(report.roleSample.comparisonStatus).toBe("comparable");
    expect(
      report.existingRosterDomainBoundary.remainsWithheldUnresolvedRole,
    ).toBe(true);
  });
});

async function hashInputs(): Promise<Array<{ path: string; sha256: string }>> {
  return Promise.all(
    FURINA_SOURCE_SCOPED_ROLE_SAMPLE_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  );
}
