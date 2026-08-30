import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatDionaSourceLocalSupportSliceSummary } from "../src/assemble-diona-source-local-support-slice";
import {
  authenticateDionaSourceLocalSupportSliceReport,
  buildDionaSourceLocalSupportSliceReport,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_REPORT_PATH,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS,
  requireComparableDionaSourceLocalSupportSliceReport,
  type BuildDionaSourceLocalSupportSliceInput,
  type DionaSourceLocalSupportSliceReport,
} from "../src/dionaSourceLocalSupportSlice";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";

const DIONA_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-diona-manual.json",
);
const DIONA_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-diona-manual.json";
const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const TEAM_ID = "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt";
const SOURCE_TEAM_ID = "c6-diona-mavuika-citlali-bennett-forward-melt";

const SELECTED = [
  {
    characterId: "diona",
    occurrenceId: `${TEAM_ID}:members[0].artifactRecommendations[0].conditions`,
    conditionsSha256:
      "08f670b7ac533e6bc210b941362676ca19e7e9d3cf8b33e1d4398fb92161c2fe",
    artifacts: [
      { type: "4pc", setId: "song_of_days_past" },
      { type: "4pc", setId: "noblesse_oblige" },
    ],
    grouping: "alternatives",
  },
  {
    characterId: "citlali",
    occurrenceId: `${TEAM_ID}:members[2].artifactRecommendations[0].conditions`,
    conditionsSha256:
      "026768a7de22a1a5ec52ba1f5cc420fe147cc120dc19c94996ff8ad3c1cfa1d9",
    artifacts: [{ type: "4pc", setId: "scroll_of_the_hero_of_cinder_city" }],
    grouping: "single",
  },
  {
    characterId: "bennett",
    occurrenceId: `${TEAM_ID}:members[3].artifactRecommendations[0].conditions`,
    conditionsSha256:
      "8dd1603ab20802ef0f0f91ce3e1d46d0a15baa87eb7d3c4e57fb5bf6e932405e",
    artifacts: [
      { type: "4pc", setId: "noblesse_oblige" },
      { type: "4pc", setId: "instructor" },
    ],
    grouping: "alternatives",
  },
] as const;

describe("Diona source-local support slice", () => {
  it("authenticates the exact three-claim same-record support slice", async () => {
    const input = await fixture();
    const report = buildDionaSourceLocalSupportSliceReport(input);

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.rawInputBoundary).toMatchObject({
      status: "accepted",
      exactPathSet: true,
      byteAndParsedObjectClosure: true,
      sourceFileCount: 4,
    });
    expect(report.sourceBoundary).toMatchObject({
      status: "accepted",
      rawRecordCount: 5,
      totalConditionArrayCount: 26,
      nonemptyConditionArrayCount: 18,
      emptyConditionArrayCount: 8,
      selectedOccurrenceCount: 3,
      holdoutOccurrenceCount: 15,
      ordinaryHoldoutInventoryCount: 10,
      erDeferredHoldoutInventoryCount: 5,
      selectedAndHoldoutsCloseAllNonemptyDionaConditions: true,
      repositoryParity: "exact",
      samePageLineage: true,
      selectedClaimsAndTeamShareExactSourceRecord: true,
      promotionEligible: false,
    });
    expect(report.summary).toEqual({
      totalConditionArrayCount: 26,
      nonemptyConditionArrayCount: 18,
      emptyConditionArrayCount: 8,
      selectedOccurrenceCount: 3,
      selectedUniqueConditionArrayCount: 3,
      holdoutOccurrenceCount: 15,
      sourceTeamCount: 1,
      sourceCellCount: 3,
      sourceMatchedCount: 0,
      sourceInapplicableCount: 0,
      sourceUnresolvedCount: 3,
      contextApplicableCount: 3,
      sourceAlreadyMatchedCount: 0,
      sourceDefinitelyInapplicableCount: 0,
      effectiveMatchedCount: 3,
      effectiveInapplicableCount: 0,
      effectiveUnresolvedCount: 0,
      selectedNotEnergyDeferredCount: 3,
      ordinaryHoldoutInventoryCount: 10,
      erDeferredHoldoutInventoryCount: 5,
      holdoutConsumedCount: 0,
      holdoutBindingAuthoredCount: 0,
      holdoutEnergyClassificationAuthoredCount: 0,
      assembledBuildCount: 0,
    });
    expect(() =>
      requireComparableDionaSourceLocalSupportSliceReport(report, input),
    ).not.toThrow();
    expect(formatDionaSourceLocalSupportSliceSummary(report)).toContain(
      "15 nonempty occurrences were held out (10 ordinary, 5 ER-deferred)",
    );
  });

  it("closes only the exact 18 nonempty arrays and leaves all holdouts unconsumed", async () => {
    const report = buildDionaSourceLocalSupportSliceReport(await fixture());
    const selectedIds = report.selectedOccurrences.map(
      ({ occurrenceId }) => occurrenceId,
    );
    const holdoutIds = report.holdoutOccurrences.map(
      ({ occurrenceId }) => occurrenceId,
    );

    expect(new Set([...selectedIds, ...holdoutIds]).size).toBe(18);
    expect(new Set(selectedIds).size).toBe(3);
    expect(new Set(holdoutIds).size).toBe(15);
    expect(selectedIds).toEqual(
      SELECTED.map(({ occurrenceId }) => occurrenceId),
    );
    expect(
      report.selectedOccurrences.map(
        ({ conditionsSha256 }) => conditionsSha256,
      ),
    ).toEqual(SELECTED.map(({ conditionsSha256 }) => conditionsSha256));
    expect(
      report.holdoutOccurrences.every(
        ({
          sliceDisposition,
          consumedBySlice,
          bindingAuthoredBySlice,
          energyClassificationAuthoredBySlice,
        }) =>
          sliceDisposition === "holdout" &&
          !consumedBySlice &&
          !bindingAuthoredBySlice &&
          !energyClassificationAuthoredBySlice,
      ),
    ).toBe(true);
    expect(
      report.holdoutOccurrences.filter(
        ({ descriptiveInventory }) =>
          descriptiveInventory === "ordinary-holdout",
      ),
    ).toHaveLength(10);
    expect(
      report.holdoutOccurrences.filter(
        ({ descriptiveInventory }) =>
          descriptiveInventory === "er-deferred-holdout",
      ),
    ).toHaveLength(5);
  });

  it("preserves each authored artifact group without choosing an assignment", async () => {
    const report = buildDionaSourceLocalSupportSliceReport(await fixture());
    const slice = requiredSlice(report);

    for (const expected of SELECTED) {
      const selected = report.selectedOccurrences.find(
        ({ characterId }) => characterId === expected.characterId,
      );
      const claim = slice.sourceClaimCatalog.find(
        ({ characterId }) => characterId === expected.characterId,
      );
      expect(selected?.payload).toEqual({
        type: "artifact-group",
        artifacts: expected.artifacts,
      });
      expect(claim?.recommendation).toMatchObject({
        scope: "team-member-artifact-sets",
        roles: [],
        ordering: "unranked",
        classification: "recommended",
        grouping: expected.grouping,
        sourceIndex: 0,
      });
    }
    expect(report.artifactAssignmentExecuted).toBe(false);
    expect(report.buildCompositionExecuted).toBe(false);
    expect(report.recommendationCompositionExecuted).toBe(false);
  });

  it("keeps source role claims unresolved until exact team-and-character request facts apply", async () => {
    const report = buildDionaSourceLocalSupportSliceReport(await fixture());
    const slice = requiredSlice(report);
    const context = slice.requestContextReport;
    if (!context) throw new Error("Expected request-context report.");

    expect(slice.sourceClaimCells).toHaveLength(1);
    expect(slice.sourceClaimCells[0]?.teamRecordId).toBe(TEAM_ID);
    expect(
      slice.sourceClaimCells[0]?.claimCells.every(
        ({ resolution }) => resolution === "unresolved-context",
      ),
    ).toBe(true);
    for (const expected of SELECTED) {
      const projection = projectedCell(context, TEAM_ID, expected.occurrenceId);
      expect(projection.contextApplicability).toBe(
        "applicable-under-supplied-context",
      );
      expect(projection.resolution).toBe("matched");
      expect(
        projection.requestContextBindings.flatMap(
          ({ predicateRows }) => predicateRows,
        ),
      ).toEqual([
        expect.objectContaining({
          result: "true",
          factScope: expect.objectContaining({
            teamRecordId: TEAM_ID,
            characterId: expected.characterId,
          }),
        }),
      ]);
    }
  });

  it("exposes no guide, composition, optimizer, damage, rotation, or ER capability", async () => {
    const report = buildDionaSourceLocalSupportSliceReport(await fixture());
    expect(report).toMatchObject({
      arbitraryEnglishParsingAllowed: false,
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      conditionTruthEstablishedFromRecommendationMetadata: false,
      recommendationCompositionExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      artifactAssignmentExecuted: false,
      teamCompositionExecuted: false,
      buildCompositionExecuted: false,
      damageComputationExecuted: false,
      rotationComputationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
    expect(report.sourceLocalSlice).toMatchObject({
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      buildComposition: false,
      formulas: false,
      rotations: false,
      ER: false,
      assembledBuildCount: 0,
    });
  });

  it("fails closed on a consistently rehashed selected-condition drift", async () => {
    const input = await fixture();
    const repository = structuredClone(
      input.repositoryInput as Record<string, unknown>,
    );
    const snapshot = structuredClone(
      input.manualSnapshotInput as Record<string, unknown>,
    );
    selectedArtifactRecommendation(repository, TEAM_ID, 0).conditions = [
      "Forged exact support-role condition.",
    ];
    selectedArtifactRecommendation(snapshot, SOURCE_TEAM_ID, 0).conditions = [
      "Forged exact support-role condition.",
    ];
    replaceJsonInput(
      input,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      repository,
    );
    replaceJsonInput(
      input,
      DIONA_SNAPSHOT_RELATIVE_PATH,
      "manualSnapshotInput",
      snapshot,
    );

    const report = buildDionaSourceLocalSupportSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain(
      "Exact occurrence boundary drifted",
    );
  });

  it("fails closed on selected payload or member recommendation metadata drift", async () => {
    const input = await fixture();
    const repository = structuredClone(
      input.repositoryInput as Record<string, unknown>,
    );
    selectedArtifactRecommendation(repository, TEAM_ID, 2).grouping =
      "alternatives";
    replaceJsonInput(
      input,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      repository,
    );

    const report = buildDionaSourceLocalSupportSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain("Exact source payload drifted");
  });

  it("fails closed on exact team roster or semantic drift", async () => {
    const rosterInput = await fixture();
    const rosterRepository = structuredClone(
      rosterInput.repositoryInput as Record<string, unknown>,
    );
    const rosterSnapshot = structuredClone(
      rosterInput.manualSnapshotInput as Record<string, unknown>,
    );
    teamMember(rosterRepository, TEAM_ID, 1).characterId = "fischl";
    teamMember(rosterSnapshot, SOURCE_TEAM_ID, 1).characterId = "fischl";
    replaceJsonInput(
      rosterInput,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      rosterRepository,
    );
    replaceJsonInput(
      rosterInput,
      DIONA_SNAPSHOT_RELATIVE_PATH,
      "manualSnapshotInput",
      rosterSnapshot,
    );
    const rosterReport = buildDionaSourceLocalSupportSliceReport(rosterInput);
    expect(rosterReport.comparisonStatus).toBe("not-comparable");
    expect(rosterReport.issues[0]?.message).toContain(
      "Exact team lineage drifted",
    );

    const semanticInput = await fixture();
    const semanticRepository = structuredClone(
      semanticInput.repositoryInput as Record<string, unknown>,
    );
    requiredRecord(semanticRepository, TEAM_ID).rankingClaim = "ordered";
    replaceJsonInput(
      semanticInput,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      semanticRepository,
    );
    const semanticReport =
      buildDionaSourceLocalSupportSliceReport(semanticInput);
    expect(semanticReport.comparisonStatus).toBe("not-comparable");
    expect(semanticReport.issues[0]?.message).toContain(
      "Exact team lineage drifted",
    );
  });

  it("fails closed when the source registry no longer matches repository authentication", async () => {
    const input = await fixture();
    const registry = structuredClone(
      input.sourceRegistryInput as Record<string, unknown>,
    );
    const sources = registry.sources as Array<Record<string, unknown>>;
    const kqm = sources.find(({ id }) => id === "kqm");
    if (!kqm) throw new Error("Missing KQM source.");
    (kqm.notes as string[]).push("Unauthenticated registry mutation.");
    replaceJsonInput(
      input,
      SOURCE_REGISTRY_RELATIVE_PATH,
      "sourceRegistryInput",
      registry,
    );

    const report = buildDionaSourceLocalSupportSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain(
      "source-document, index, or registry boundary drifted",
    );
  });

  it("authenticates the durable report and rejects report or path-boundary tampering", async () => {
    const input = await fixture();
    const canonical = buildDionaSourceLocalSupportSliceReport(input);
    const durable = (await readJson(
      DIONA_SOURCE_LOCAL_SUPPORT_SLICE_REPORT_PATH,
    )) as DionaSourceLocalSupportSliceReport;

    expect(stableJson(durable)).toBe(stableJson(canonical));
    expect(
      authenticateDionaSourceLocalSupportSliceReport(durable, input),
    ).toMatchObject({ authenticated: true });

    const changed = structuredClone(durable);
    changed.summary.contextApplicableCount += 1;
    expect(
      authenticateDionaSourceLocalSupportSliceReport(changed, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
    expect(() =>
      requireComparableDionaSourceLocalSupportSliceReport(changed, input),
    ).toThrow("serialized-report-mismatch");

    const missingPathInput = structuredClone(input);
    missingPathInput.generatedFrom = missingPathInput.generatedFrom.slice(1);
    const nonComparable =
      buildDionaSourceLocalSupportSliceReport(missingPathInput);
    expect(nonComparable.comparisonStatus).toBe("not-comparable");
    expect(nonComparable.issues[0]?.message).toContain(
      "generatedFrom path closure drifted",
    );
  });
});

async function fixture(): Promise<BuildDionaSourceLocalSupportSliceInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(DIONA_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(
            path.join(REPOSITORY_ROOT, relativePath),
            "utf8",
          ),
        }),
      ),
    ),
    Promise.all(
      DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  return {
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  };
}

function replaceJsonInput(
  input: BuildDionaSourceLocalSupportSliceInput,
  relativePath: string,
  field: "repositoryInput" | "manualSnapshotInput" | "sourceRegistryInput",
  value: unknown,
): void {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  input[field] = value;
  input.sourceFiles = input.sourceFiles.map((sourceFile) =>
    sourceFile.path === relativePath
      ? { path: sourceFile.path, text }
      : sourceFile,
  );
  input.generatedFrom = input.generatedFrom.map((entry) =>
    entry.path === relativePath
      ? { path: entry.path, sha256: sha256Text(text) }
      : entry,
  );
}

function requiredRecord(
  root: Record<string, unknown>,
  id: string,
): Record<string, unknown> {
  const records = root.records as Array<Record<string, unknown>>;
  const record = records.find(
    (candidate) => candidate.id === id || candidate.sourceRecordId === id,
  );
  if (!record) throw new Error(`Missing record ${id}.`);
  return record;
}

function teamMember(
  root: Record<string, unknown>,
  id: string,
  memberIndex: number,
): Record<string, unknown> {
  const record = requiredRecord(root, id);
  const members = record.members as Array<Record<string, unknown>>;
  const member = members[memberIndex];
  if (!member) throw new Error(`Missing member ${memberIndex}.`);
  return member;
}

function selectedArtifactRecommendation(
  root: Record<string, unknown>,
  id: string,
  memberIndex: number,
): Record<string, unknown> {
  const member = teamMember(root, id, memberIndex);
  const recommendations = member.artifactRecommendations as Array<
    Record<string, unknown>
  >;
  const recommendation = recommendations[0];
  if (!recommendation) throw new Error("Missing artifact recommendation.");
  return recommendation;
}

function requiredSlice(
  report: DionaSourceLocalSupportSliceReport,
): NonNullable<DionaSourceLocalSupportSliceReport["sourceLocalSlice"]> {
  if (!report.sourceLocalSlice) throw new Error("Expected source-local slice.");
  return report.sourceLocalSlice;
}

function projectedCell(
  report: NonNullable<
    NonNullable<
      DionaSourceLocalSupportSliceReport["sourceLocalSlice"]
    >["requestContextReport"]
  >,
  teamRecordId: string,
  claimId: string,
) {
  const projection = report.teamProjections
    .find((team) => team.teamRecordId === teamRecordId)
    ?.claimProjections.find((candidate) => candidate.claimId === claimId);
  if (!projection) {
    throw new Error(`Missing projected cell ${teamRecordId}:${claimId}.`);
  }
  return projection;
}
