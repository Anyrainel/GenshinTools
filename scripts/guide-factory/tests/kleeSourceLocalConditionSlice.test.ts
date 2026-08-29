import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatKleeSourceLocalConditionSliceSummary } from "../src/assemble-klee-source-local-condition-slice";
import {
  authenticateKleeSourceLocalConditionSliceReport,
  buildKleeSourceLocalConditionSliceReport,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
  requireComparableKleeSourceLocalConditionSliceReport,
  type BuildKleeSourceLocalConditionSliceInput,
  type KleeSourceLocalConditionSliceReport,
} from "../src/kleeSourceLocalConditionSlice";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";

const KLEE_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-klee-manual.json",
);
const KLEE_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-klee-manual.json";
const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const ROLE_CONDITION_HASH =
  "96d033ed6175b014f87697f126ede158cd83aa84a9ccd85981eb5b0c1001d900";
const FURINA_CONDITION_HASH =
  "feb2ecd578fdfa80c453e6507a69e41c32422d5d0fdd7ef7e965573235595092";
const FURINA_TEAM_ID =
  "kqm:team:klee-furina-albedo-xilonen-example-luna-iv";
const OVERLOAD_TEAM_ID =
  "kqm:team:klee-chevreuse-durin-fischl-overload-example-luna-iv";

describe("Klee source-local condition slice", () => {
  it("authenticates four exact bindings while retaining all eleven Klee holdouts", async () => {
    const input = await fixture();
    const report = buildKleeSourceLocalConditionSliceReport(input);

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
      rawRecordCount: 7,
      selectedOccurrenceCount: 4,
      holdoutOccurrenceCount: 11,
      selectedAndHoldoutsCloseAllKleeConditions: true,
      repositoryParity: "exact",
      samePageLineage: true,
      promotionEligible: false,
    });
    expect(report.summary).toEqual({
      selectedOccurrenceCount: 4,
      selectedUniqueConditionArrayCount: 2,
      holdoutOccurrenceCount: 11,
      sourceTeamCount: 2,
      sourceCellCount: 8,
      sourceMatchedCount: 1,
      sourceInapplicableCount: 1,
      sourceUnresolvedCount: 6,
      contextApplicableCount: 6,
      sourceAlreadyMatchedCount: 1,
      sourceDefinitelyInapplicableCount: 1,
      effectiveMatchedCount: 7,
      effectiveInapplicableCount: 1,
      effectiveUnresolvedCount: 0,
      selectedNotEnergyDeferredCount: 4,
      holdoutWithoutAuthoredEnergyClassificationCount: 11,
      assembledBuildCount: 0,
    });
    expect(report.selectedOccurrences).toHaveLength(4);
    expect(report.holdoutOccurrences).toHaveLength(11);
    expect(() =>
      requireComparableKleeSourceLocalConditionSliceReport(report, input),
    ).not.toThrow();
    expect(formatKleeSourceLocalConditionSliceSummary(report)).toContain(
      "11 Klee occurrences were held out from this binding slice",
    );
  });

  it("closes the exact 15-occurrence Klee partition without sharing bindings by text", async () => {
    const report = buildKleeSourceLocalConditionSliceReport(await fixture());
    const selectedIds = report.selectedOccurrences.map(
      ({ occurrenceId }) => occurrenceId,
    );
    const holdoutIds = report.holdoutOccurrences.map(
      ({ occurrenceId }) => occurrenceId,
    );

    expect(new Set([...selectedIds, ...holdoutIds])).toHaveLength(15);
    expect(new Set(selectedIds)).toHaveLength(4);
    expect(new Set(holdoutIds)).toHaveLength(11);
    expect(report.selectedOccurrences.map(({ conditionsSha256 }) => conditionsSha256)).toEqual([
      ROLE_CONDITION_HASH,
      ROLE_CONDITION_HASH,
      ROLE_CONDITION_HASH,
      FURINA_CONDITION_HASH,
    ]);
    expect(
      report.selectedOccurrences.every(
        ({
          sliceDisposition,
          bindingAuthoredBySlice,
          sliceBindingClassification,
          energyClassificationAuthoredBySlice,
          sliceEnergyClassification,
        }) =>
          sliceDisposition === "selected" &&
          bindingAuthoredBySlice &&
          sliceBindingClassification === "typed-bound" &&
          energyClassificationAuthoredBySlice &&
          sliceEnergyClassification === "not-energy-deferred",
      ),
    ).toBe(true);
    expect(
      report.holdoutOccurrences.every(
        ({
          sliceDisposition,
          bindingAuthoredBySlice,
          energyClassificationAuthoredBySlice,
        }) =>
          sliceDisposition === "holdout" &&
          !bindingAuthoredBySlice &&
          !energyClassificationAuthoredBySlice,
      ),
    ).toBe(true);
    expect(
      report.holdoutOccurrences.filter(
        ({ conditions }) => conditions[0]?.includes("on-field DPS"),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("keeps recommendation role metadata out of source truth and request facts out of roster truth", async () => {
    const report = buildKleeSourceLocalConditionSliceReport(await fixture());
    const slice = report.sourceLocalSlice;
    if (!slice?.requestContextReport) throw new Error("Expected context report.");

    expect(slice.summary.sourceUnresolvedCount).toBe(6);
    expect(
      slice.sourceClaimCatalog
        .filter(({ sourceConditionsSha256 }) =>
          sourceConditionsSha256 === ROLE_CONDITION_HASH,
        )
        .every(({ recommendation }) =>
          recommendation.roles.includes("dps"),
        ),
    ).toBe(true);
    const furinaClaim = slice.sourceClaimCatalog.find(
      ({ sourceConditionsSha256 }) =>
        sourceConditionsSha256 === FURINA_CONDITION_HASH,
    );
    if (!furinaClaim) throw new Error("Expected Furina roster claim.");

    const overloadSource = sourceCell(slice, OVERLOAD_TEAM_ID, furinaClaim.claimId);
    const furinaSource = sourceCell(slice, FURINA_TEAM_ID, furinaClaim.claimId);
    expect(overloadSource.resolution).toBe("inapplicable");
    expect(furinaSource.resolution).toBe("matched");

    const overloadProjection = projectedCell(
      slice.requestContextReport,
      OVERLOAD_TEAM_ID,
      furinaClaim.claimId,
    );
    const furinaProjection = projectedCell(
      slice.requestContextReport,
      FURINA_TEAM_ID,
      furinaClaim.claimId,
    );
    expect(overloadProjection).toMatchObject({
      contextApplicability: "source-definitely-inapplicable",
      requestContextBindings: [],
    });
    expect(furinaProjection).toMatchObject({
      contextApplicability: "source-already-matched",
      requestContextBindings: [],
    });

    const roleProjections = slice.requestContextReport.teamProjections.flatMap(
      ({ teamRecordId, claimProjections }) =>
        claimProjections
          .filter(({ claimId }) => claimId !== furinaClaim.claimId)
          .map((projection) => ({ teamRecordId, projection })),
    );
    expect(roleProjections).toHaveLength(6);
    expect(
      roleProjections.every(
        ({ teamRecordId, projection }) =>
          projection.contextApplicability ===
            "applicable-under-supplied-context" &&
          projection.requestContextBindings.every(({ predicateRows }) =>
            predicateRows.every(
              ({ factScope }) =>
                factScope.teamRecordId === teamRecordId &&
                factScope.characterId === "klee",
            ),
          ),
      ),
    ).toBe(true);
  });

  it("exposes no adapter-only preset/template evidence or computation capability", async () => {
    const report = buildKleeSourceLocalConditionSliceReport(await fixture());
    const serialized = stableJson(report);

    expect(serialized).not.toContain('"presetOverlap":');
    expect(serialized).not.toContain("not-evaluated:source-local-condition-slice");
    expect(serialized).not.toContain('"rosterStatus": "uncovered"');
    expect(report).toMatchObject({
      arbitraryEnglishParsingAllowed: false,
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsEnergyRecoveryClaims: false,
      conditionTruthEstablishedFromRecommendationMetadata: false,
      recommendationCompositionExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
    expect(report.sourceLocalSlice).toMatchObject({
      supportsGuideClaims: false,
      buildComposition: false,
      damage: false,
      rotations: false,
      ER: false,
      assembledBuildCount: 0,
    });
  });

  it("fails closed on a consistently rehashed exact-condition drift", async () => {
    const input = await fixture();
    const repository = structuredClone(
      input.repositoryInput as Record<string, unknown>,
    );
    const snapshot = structuredClone(
      input.manualSnapshotInput as Record<string, unknown>,
    );
    const repositoryRecords = repository.records as Array<Record<string, unknown>>;
    const repositoryRecord = repositoryRecords.find(
      ({ id }) =>
        id === "kqm:character-guide:klee-on-field-artifact-stats-luna-iv",
    );
    const manualRecords = snapshot.records as Array<Record<string, unknown>>;
    const manualRecord = manualRecords.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "klee-on-field-artifact-stats-luna-iv",
    );
    if (!repositoryRecord || !manualRecord) throw new Error("Missing fixture records.");
    const repositoryRecommendations = repositoryRecord.recommendations as Array<
      Record<string, unknown>
    >;
    const manualRecommendation = manualRecord.recommendation as Record<
      string,
      unknown
    >;
    const repositoryMainStats = repositoryRecommendations[0]?.mainStats as Record<
      string,
      Array<Record<string, unknown>>
    >;
    const manualMainStats = manualRecommendation.mainStats as Record<
      string,
      Array<Record<string, unknown>>
    >;
    repositoryMainStats.sands![0]!.conditions = ["Forged exact role condition."];
    manualMainStats.sands![0]!.conditions = ["Forged exact role condition."];
    replaceJsonInput(input, REPOSITORY_RELATIVE_PATH, "repositoryInput", repository);
    replaceJsonInput(
      input,
      KLEE_SNAPSHOT_RELATIVE_PATH,
      "manualSnapshotInput",
      snapshot,
    );

    const report = buildKleeSourceLocalConditionSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain("Exact occurrence boundary drifted");
    expect(() =>
      requireComparableKleeSourceLocalConditionSliceReport(report, input),
    ).toThrow("Refusing an unauthenticated");
  });

  it("fails closed on an exact source-team roster drift even when raw and consolidated inputs agree", async () => {
    const input = await fixture();
    const repository = structuredClone(
      input.repositoryInput as Record<string, unknown>,
    );
    const snapshot = structuredClone(
      input.manualSnapshotInput as Record<string, unknown>,
    );
    const repositoryRecord = (
      repository.records as Array<Record<string, unknown>>
    ).find(({ id }) => id === OVERLOAD_TEAM_ID);
    const manualRecord = (snapshot.records as Array<Record<string, unknown>>).find(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "klee-chevreuse-durin-fischl-overload-example-luna-iv",
    );
    if (!repositoryRecord || !manualRecord) throw new Error("Missing team fixture.");
    const repositoryMembers = repositoryRecord.members as Array<
      Record<string, unknown>
    >;
    const manualMembers = manualRecord.members as Array<Record<string, unknown>>;
    repositoryMembers[2]!.characterId = "bennett";
    manualMembers[2]!.characterId = "bennett";
    replaceJsonInput(input, REPOSITORY_RELATIVE_PATH, "repositoryInput", repository);
    replaceJsonInput(
      input,
      KLEE_SNAPSHOT_RELATIVE_PATH,
      "manualSnapshotInput",
      snapshot,
    );

    const report = buildKleeSourceLocalConditionSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain("Exact team lineage drifted");
  });

  it("fails closed on repository-only exact-team semantic drift", async () => {
    const input = await fixture();
    const repository = structuredClone(
      input.repositoryInput as Record<string, unknown>,
    );
    const repositoryRecord = (
      repository.records as Array<Record<string, unknown>>
    ).find(({ id }) => id === OVERLOAD_TEAM_ID);
    if (!repositoryRecord) throw new Error("Missing team fixture.");
    repositoryRecord.rankingClaim = "ordered";
    replaceJsonInput(input, REPOSITORY_RELATIVE_PATH, "repositoryInput", repository);

    const report = buildKleeSourceLocalConditionSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain("Exact team lineage drifted");
  });

  it("fails closed on repository-only parent recommendation metadata drift", async () => {
    const input = await fixture();
    const repository = structuredClone(
      input.repositoryInput as Record<string, unknown>,
    );
    const repositoryRecord = (
      repository.records as Array<Record<string, unknown>>
    ).find(
      ({ id }) =>
        id === "kqm:character-guide:klee-on-field-artifact-stats-luna-iv",
    );
    if (!repositoryRecord) throw new Error("Missing guide fixture.");
    const recommendations = repositoryRecord.recommendations as Array<
      Record<string, unknown>
    >;
    recommendations[0]!.roles = ["support"];
    replaceJsonInput(input, REPOSITORY_RELATIVE_PATH, "repositoryInput", repository);

    const report = buildKleeSourceLocalConditionSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain(
      "Exact parent recommendation lineage drifted",
    );
  });

  it("fails closed when the repository embeds a stale source-registry hash", async () => {
    const input = await fixture();
    const registry = structuredClone(
      input.sourceRegistryInput as Record<string, unknown>,
    );
    const sources = registry.sources as Array<Record<string, unknown>>;
    const kqmSource = sources.find(({ id }) => id === "kqm");
    if (!kqmSource) throw new Error("Missing KQM source fixture.");
    const notes = kqmSource.notes as string[];
    notes.push("Fresh registry note that the repository has not authenticated.");
    replaceJsonInput(
      input,
      SOURCE_REGISTRY_RELATIVE_PATH,
      "sourceRegistryInput",
      registry,
    );

    const report = buildKleeSourceLocalConditionSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain(
      "source-document, index, or registry boundary drifted",
    );
  });

  it("fails closed on a duplicate KQM registry row even when repository hashes are current", async () => {
    const input = await fixture();
    const registry = structuredClone(
      input.sourceRegistryInput as Record<string, unknown>,
    );
    const repository = structuredClone(
      input.repositoryInput as Record<string, unknown>,
    );
    const sources = registry.sources as Array<Record<string, unknown>>;
    const kqmSource = sources.find(({ id }) => id === "kqm");
    if (!kqmSource) throw new Error("Missing KQM source fixture.");
    sources.push(structuredClone(kqmSource));
    const registryText = `${JSON.stringify(registry, null, 2)}\n`;
    repository.sourceRegistrySha256 = sha256Text(registryText);
    replaceJsonInput(
      input,
      SOURCE_REGISTRY_RELATIVE_PATH,
      "sourceRegistryInput",
      registry,
    );
    replaceJsonInput(input, REPOSITORY_RELATIVE_PATH, "repositoryInput", repository);

    const report = buildKleeSourceLocalConditionSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain(
      "source-document, index, or registry boundary drifted",
    );
  });

  it("authenticates the durable report and rejects nested report or path-boundary mutations", async () => {
    const input = await fixture();
    const canonical = buildKleeSourceLocalConditionSliceReport(input);
    const durable = (await readJson(
      KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH,
    )) as KleeSourceLocalConditionSliceReport;

    expect(stableJson(durable)).toBe(stableJson(canonical));
    expect(
      authenticateKleeSourceLocalConditionSliceReport(durable, input),
    ).toMatchObject({ authenticated: true });

    const changed = structuredClone(durable);
    changed.summary.contextApplicableCount += 1;
    expect(
      authenticateKleeSourceLocalConditionSliceReport(changed, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
    expect(() =>
      requireComparableKleeSourceLocalConditionSliceReport(changed, input),
    ).toThrow("serialized-report-mismatch");

    const forgedBoundary = structuredClone(durable);
    forgedBoundary.rawInputBoundary.exactPathSet = false;
    forgedBoundary.rawInputBoundary.byteAndParsedObjectClosure = false;
    forgedBoundary.sourceBoundary.repositoryParity = "mismatch";
    forgedBoundary.sourceBoundary.samePageLineage = false;
    forgedBoundary.selectedOccurrences[0]!.conditions = ["Forged condition."];
    expect(() =>
      requireComparableKleeSourceLocalConditionSliceReport(
        forgedBoundary,
        input,
      ),
    ).toThrow("serialized-report-mismatch");

    const missingPathInput = structuredClone(input);
    missingPathInput.generatedFrom = missingPathInput.generatedFrom.slice(1);
    const nonComparable = buildKleeSourceLocalConditionSliceReport(
      missingPathInput,
    );
    expect(nonComparable.comparisonStatus).toBe("not-comparable");
    expect(nonComparable.issues[0]?.message).toContain(
      "generatedFrom path closure drifted",
    );
  });
});

async function fixture(): Promise<BuildKleeSourceLocalConditionSliceInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(KLEE_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS.map(
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
      KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS.map(
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
  input: BuildKleeSourceLocalConditionSliceInput,
  relativePath: string,
  field:
    | "repositoryInput"
    | "manualSnapshotInput"
    | "sourceRegistryInput",
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

function sourceCell(
  report: NonNullable<KleeSourceLocalConditionSliceReport["sourceLocalSlice"]>,
  teamRecordId: string,
  claimId: string,
) {
  const cell = report.sourceClaimCells
    .find((team) => team.teamRecordId === teamRecordId)
    ?.claimCells.find((candidate) => candidate.claimId === claimId);
  if (!cell) throw new Error(`Missing source cell ${teamRecordId}:${claimId}.`);
  return cell;
}

function projectedCell(
  report: NonNullable<
    NonNullable<
      KleeSourceLocalConditionSliceReport["sourceLocalSlice"]
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
